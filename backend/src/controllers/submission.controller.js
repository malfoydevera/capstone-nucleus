/**
 * submission.controller.js — F-002
 * Handles: paper submission, retrieval, browsing, tracking, and lookup endpoints.
 */
const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const {
  canAccessPaper,
  canDownloadPaper,
  extractStoragePathFromUrl,
  isPublicPaperStatus,
  resolvePaperFileUrl,
} = require('../utils/fileAccess');
const { sendSuccess, sendError } = require('../utils/response');
const { getOrSet, TTL, invalidateBrowseCaches } = require('../utils/cache'); // P-001
const logger = require('../utils/logger');
const { validateResearchFileBuffer } = require('../config/upload');
const { attachFullName, buildFullName } = require('../utils/name');
const { sendPaperStatusEmail, sendReviewAssignmentEmail } = require('../utils/workflowEmail');
const { getSystemPolicy, isFileAllowedByPolicy } = require('../utils/systemPolicy');
const { notifyUser, notifyUsers, notifyCoAuthors } = require('../utils/notify');
const { parseListPagination } = require('../utils/pagination');
const {
  buildEmbeddingInput,
  contentHash,
  embedDocument,
  embedQuery,
} = require('../utils/embeddings');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeResearchAuthors = (researchAuthors = []) =>
  [...(researchAuthors || [])]
    .sort((left, right) => {
      const leftOrder = Number.isFinite(left?.author_order) ? left.author_order : Number.MAX_SAFE_INTEGER;
      const rightOrder = Number.isFinite(right?.author_order) ? right.author_order : Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    })
    .map((entry) => ({
      ...entry,
      author: attachFullName(entry.author),
    }));

const normalizeExternalAuthorNotes = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
};

const resolveExternalAuthorNotes = (...candidates) => {
  for (const candidate of candidates) {
    const normalized = normalizeExternalAuthorNotes(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const resolveCompatibleCoAuthorText = (structuredAuthors = [], compatibilityNotes = null) => {
  const canonicalNames = (structuredAuthors || [])
    .filter((entry) => !entry?.is_primary)
    .map((entry) => buildFullName(entry?.author))
    .filter(Boolean);

  if (canonicalNames.length > 0) {
    return canonicalNames.join('; ');
  }

  if (!compatibilityNotes) {
    return null;
  }

  return String(compatibilityNotes)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join('; ');
};

const normalizeCoAuthorIds = (coAuthorIds = [], primaryAuthorId) =>
  Array.from(
    new Set(
      (Array.isArray(coAuthorIds) ? coAuthorIds : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  ).filter((authorId) => authorId !== String(primaryAuthorId));

/**
 * Generate and persist the semantic-search embedding for a paper.
 * Best-effort: never throws (embedding is an enhancement, not a hard dependency
 * of submission). Skips the Gemini call when the embeddable content is unchanged.
 * @param {{ id: string, title?: string, abstract?: string, keywords?: string[], embedding_source_hash?: string }} paper
 */
const persistPaperEmbedding = async (paper) => {
  try {
    if (!paper?.id) return;

    const input = buildEmbeddingInput({
      title: paper.title,
      abstract: paper.abstract,
      keywords: paper.keywords,
    });
    const nextHash = contentHash(input);
    if (!nextHash) return;

    // Content unchanged since last embedding — nothing to do.
    if (paper.embedding_source_hash && paper.embedding_source_hash === nextHash) return;

    const vector = await embedDocument(input);
    if (!vector) return;

    // pgvector accepts its text literal form: "[v1,v2,...]".
    const { error } = await supabase
      .from('research_papers')
      .update({
        embedding: JSON.stringify(vector),
        embedding_model: 'gemini-embedding-001',
        embedding_source_hash: nextHash,
        embedding_generated_at: new Date().toISOString(),
      })
      .eq('id', paper.id);

    if (error && !String(error.message || '').includes('embedding')) {
      logger.warn('[embeddings] Failed to persist paper embedding:', error.message);
    }
  } catch (error) {
    // Migration not yet applied or transient failure — log and move on.
    logger.warn('[embeddings] persistPaperEmbedding skipped:', error?.message || error);
  }
};

const getCategoryLookup = async () => {
  const categories = await getOrSet('categories:all', TTL.CATEGORIES, async () => {
    const { data, error } = await supabase.from('research_categories').select('*').order('name');
    if (error) throw error;
    return data || [];
  });

  return new Map((categories || []).map((entry) => [entry.id, entry.name]));
};

const getDepartmentLookup = async () => {
  const departments = await getOrSet('departments:all', TTL.CATEGORIES, async () => {
    const { data, error } = await supabase.from('departments').select('id, name, code').order('name');
    if (error) throw error;
    return data || [];
  });

  const byId = new Map();
  const byNormalizedValue = new Map();

  (departments || []).forEach((entry) => {
    byId.set(entry.id, entry.name);
    [entry.name, entry.code].filter(Boolean).forEach((value) => {
      byNormalizedValue.set(String(value).trim().toLowerCase(), entry);
    });
  });

  return { byId, byNormalizedValue };
};

const getProgramLookup = async () => {
  const programs = await getOrSet('programs:all', TTL.CATEGORIES, async () => {
    const { data, error } = await supabase
      .from('programs')
      .select('id, name, code, department_id')
      .order('name');
    if (error) throw error;
    return data || [];
  });

  const byId = new Map();
  const byNormalizedValue = new Map();

  (programs || []).forEach((entry) => {
    byId.set(entry.id, entry.name);
    [entry.name, entry.code].filter(Boolean).forEach((value) => {
      byNormalizedValue.set(String(value).trim().toLowerCase(), entry);
    });
  });

  return { byId, byNormalizedValue };
};

const resolveDepartmentLabel = (departmentId, fallbackLabel, departmentLookup) => {
  if (departmentId && departmentLookup?.byId?.has(departmentId)) {
    return departmentLookup.byId.get(departmentId);
  }

  return fallbackLabel || null;
};

const resolveProgramLabel = (programId, fallbackLabel, programLookup) => {
  if (programId && programLookup?.byId?.has(programId)) {
    return programLookup.byId.get(programId);
  }

  return fallbackLabel || null;
};

const resolveCategoryLabel = (categoryValue, categoryLookup) => {
  if (!categoryValue) return '';

  const categoryName = categoryLookup.get(categoryValue);
  if (categoryName) return categoryName;

  if (typeof categoryValue === 'string' && !UUID_PATTERN.test(categoryValue)) {
    return categoryValue;
  }

  return '';
};

// Submit new research or update existing revision
exports.submitResearch = async (req, res) => {
  try {
    const {
      id,
      title,
      abstract,
      keywords,
      coAuthors,
      externalAuthorNotes,
      category,
      facultyId,
      department,
      departmentId,
      programId,
    } = req.body;
    const file = req.file;
    const userId = req.user.id;
    const normalizedExternalAuthorNotes = resolveExternalAuthorNotes(externalAuthorNotes, coAuthors);

    if (!id && !file) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Research file is required' });
    }

    if (file) {
      const fileCheck = validateResearchFileBuffer(file.buffer, file.mimetype);
      if (!fileCheck.valid) {
        return sendError(res, { status: 400, code: 'INVALID_FILE', message: fileCheck.message });
      }
    }

    if (!title || !abstract || !category) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'All required fields must be filled' });
    }

    let fileData = {};

    if (file) {
      const submissionPolicy = await getSystemPolicy();
      const maxFileSizeBytes = submissionPolicy.maxFileSizeMb * 1024 * 1024;

      if (file.size > maxFileSizeBytes) {
        return sendError(res, {
          status: 400,
          code: 'FILE_TOO_LARGE',
          message: `File exceeds allowed size (${submissionPolicy.maxFileSizeMb} MB)`
        });
      }

      if (!isFileAllowedByPolicy(file, submissionPolicy.allowedFileTypes)) {
        return sendError(res, {
          status: 400,
          code: 'INVALID_FILE_TYPE',
          message: `Invalid file type. Allowed types: ${submissionPolicy.allowedFileTypes.join(', ')}`
        });
      }

      const fileExt = file.originalname.split('.').pop();
      const fileName = `${userId}/${uuidv4()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('research-papers')
        .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });

      if (uploadError) {
        logger.error('Upload error:', uploadError);
        return sendError(res, { status: 500, code: 'FILE_UPLOAD_FAILED', message: 'Failed to upload file' });
      }

      const publicUrl = supabase.getPublicFileUrl(fileName);
      fileData = {
        file_url: publicUrl,
        file_storage_path: fileName,
        file_name: file.originalname,
        file_size: file.size,
      };
    }

    const { data: authorProfile } = await supabase
      .from('users')
      .select('id, department, department_id, program, program_id')
      .eq('id', userId)
      .maybeSingle();

    let resolvedDepartmentId = departmentId || authorProfile?.department_id || null;
    let resolvedDepartmentName = department || authorProfile?.department || null;
    let resolvedProgramId = programId || authorProfile?.program_id || null;

    if (resolvedProgramId) {
      const { data: selectedProgram } = await supabase
        .from('programs')
        .select('id, name, department_id, departments(name)')
        .eq('id', resolvedProgramId)
        .maybeSingle();

      if (selectedProgram) {
        resolvedProgramId = selectedProgram.id;
        resolvedDepartmentId = selectedProgram.department_id || resolvedDepartmentId;
        resolvedDepartmentName = selectedProgram.departments?.name || resolvedDepartmentName;
      }
    }

    if (resolvedDepartmentId) {
      const { data: selectedDepartment } = await supabase
        .from('departments')
        .select('id, name')
        .eq('id', resolvedDepartmentId)
        .single();

      if (!selectedDepartment) {
        return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Selected department is invalid' });
      }

      resolvedDepartmentId = selectedDepartment.id;
      resolvedDepartmentName = selectedDepartment.name;
    } else if (resolvedDepartmentName) {
      const { data: selectedDepartment } = await supabase
        .from('departments')
        .select('id, name, code')
        .or(`name.eq.${resolvedDepartmentName},code.eq.${resolvedDepartmentName}`)
        .limit(1)
        .maybeSingle();

      if (selectedDepartment) {
        resolvedDepartmentId = selectedDepartment.id;
        resolvedDepartmentName = selectedDepartment.name;
      }
    }

    const basePayload = {
      ...(id && { id }),
      title,
      abstract,
      keywords: keywords ? keywords.split(',').map(k => k.trim()) : [],
      external_author_notes: normalizedExternalAuthorNotes,
      category,
      author_id: userId,
      faculty_id: facultyId || null,
      department: resolvedDepartmentName || null,
      department_id: resolvedDepartmentId,
      program_id: resolvedProgramId,
      status: id ? undefined : (facultyId ? 'pending_faculty' : 'pending_editor'),
      ...fileData,
    };

    let { data: research, error: dbError } = await supabase
      .from('research_papers')
      .upsert(basePayload)
      .select()
      .single();

    // Backward compatibility
    if (dbError?.message?.includes('file_storage_path')) {
      const fallbackPayload = { ...basePayload };
      delete fallbackPayload.file_storage_path;
      const fallbackResult = await supabase.from('research_papers').upsert(fallbackPayload).select().single();
      research = fallbackResult.data;
      dbError = fallbackResult.error;
    }

    if (dbError?.message?.includes('department_id')) {
      const fallbackPayload = { ...basePayload };
      delete fallbackPayload.department_id;
      const fallbackResult = await supabase.from('research_papers').upsert(fallbackPayload).select().single();
      research = fallbackResult.data;
      dbError = fallbackResult.error;
    }

    if (dbError?.message?.includes('program_id')) {
      const fallbackPayload = { ...basePayload };
      delete fallbackPayload.program_id;
      const fallbackResult = await supabase.from('research_papers').upsert(fallbackPayload).select().single();
      research = fallbackResult.data;
      dbError = fallbackResult.error;
    }

    if (dbError?.message?.includes('external_author_notes')) {
      const fallbackPayload = { ...basePayload };
      delete fallbackPayload.external_author_notes;
      const fallbackResult = await supabase.from('research_papers').upsert(fallbackPayload).select().single();
      research = fallbackResult.data;
      dbError = fallbackResult.error;
    }

    if (dbError) {
      return sendError(res, { status: 500, code: 'SAVE_RESEARCH_FAILED', message: 'Failed to save research data' });
    }

    // Generate the thematic-search embedding from Title + Abstract + Keywords.
    // Best-effort and awaited so the vector is ready by the time the paper is
    // searchable; failures are swallowed inside the helper.
    await persistPaperEmbedding(research);

    // Co-authors
    let coAuthorIds = [];
    try {
      if (req.body.coAuthorIds) {
        coAuthorIds = typeof req.body.coAuthorIds === 'string'
          ? JSON.parse(req.body.coAuthorIds)
          : req.body.coAuthorIds;
      }
    } catch { coAuthorIds = []; }

    const normalizedCoAuthorIds = normalizeCoAuthorIds(coAuthorIds, userId);

    if (normalizedCoAuthorIds.length > 0) {
      try {
        if (id) {
          await supabase.from('research_authors').delete().eq('research_id', research.id).neq('is_primary', true);
        }
        await supabase.from('research_authors').upsert(
          { research_id: research.id, user_id: userId, author_order: 0, is_primary: true },
          { onConflict: 'research_id,user_id' }
        );
        const coAuthorsData = normalizedCoAuthorIds.map((authorId, index) => ({
          research_id: research.id, user_id: authorId, author_order: index + 1, is_primary: false,
        }));
        await supabase.from('research_authors').upsert(coAuthorsData, { onConflict: 'research_id,user_id' });
      } catch { /* research_authors table may not exist yet */ }
    } else {
      try {
        if (id) {
          await supabase.from('research_authors').delete().eq('research_id', research.id).neq('is_primary', true);
        }
        await supabase.from('research_authors').upsert(
          { research_id: research.id, user_id: userId, author_order: 0, is_primary: true },
          { onConflict: 'research_id,user_id' }
        );
      } catch { /* research_authors table may not exist yet */ }
    }

    let statusAfterSubmit = research.status || (facultyId ? 'pending_faculty' : 'pending_editor');

    // Handle revision resubmission
    if (id) {
      const { data: existingPaper } = await supabase
        .from('research_papers')
        .select('status, last_reviewer_role, previous_status, faculty_id')
        .eq('id', id)
        .single();

      if (existingPaper && existingPaper.status === 'revision_required') {
        const roleMap = {
          faculty: 'pending_faculty', dean: 'pending_dean',
          program_chair: 'pending_program_chair', staff: 'pending_editor', admin: 'pending_admin',
        };
        const newStatus = roleMap[existingPaper.last_reviewer_role]
          || existingPaper.previous_status
          || (existingPaper.faculty_id ? 'pending_faculty' : 'pending_editor');

        await supabase.from('research_papers').update({
          status: newStatus, revision_notes: null, last_reviewer_role: null, previous_status: null,
        }).eq('id', id);
        statusAfterSubmit = newStatus;
      }
    }

    const { data: author } = await supabase.from('users').select('first_name, middle_name, last_name, email').eq('id', userId).single();
    const authorName = buildFullName(author) || author?.email;

    // Notify the submitting author about the successful upload / resubmission
    if (!id) {
      void notifyUser({
        userId,
        researchId: research.id,
        type: 'paper_uploaded',
        title: 'Paper Uploaded Successfully',
        message: `Your paper "${title}" has been uploaded and is now pending review.`,
      }).catch((notifyErr) => {
        logger.error('[submitResearch] author self-notification failed:', notifyErr.message);
      });
    } else {
      void notifyUser({
        userId,
        researchId: research.id,
        type: 'paper_resubmitted',
        title: 'Revision Submitted Successfully',
        message: `Your revision for "${title}" has been submitted and routed to the next reviewer.`,
      }).catch((notifyErr) => {
        logger.error('[submitResearch] author self-notification failed:', notifyErr.message);
      });
    }

    // Notify newly-added co-authors (only on first submission or when co-author list changes)
    if (normalizedCoAuthorIds.length > 0) {
      try {
        const coAuthorNotifications = normalizedCoAuthorIds.map((coAuthorId) => ({
          user_id: coAuthorId,
          research_id: research.id,
          type: 'coauthor_added',
          title: 'You Were Added as a Co-author',
          message: `You have been added as a co-author of the paper "${title}".`,
          sender_user_id: userId,
        }));
        void notifyUsers(coAuthorNotifications).catch((notifyErr) => {
          logger.error('[submitResearch] co-author notification failed:', notifyErr.message);
        });
      } catch (notifyErr) {
        logger.error('[submitResearch] co-author notification failed:', notifyErr.message);
      }
    }

    // On revision resubmit, notify existing accepted co-authors about the resubmission
    if (id && normalizedCoAuthorIds.length === 0) {
      try {
        void notifyCoAuthors({
          researchId: research.id,
          type: 'paper_resubmitted',
          title: 'Co-authored Paper Revision Submitted',
          message: `A revision has been submitted for the paper "${title}" that you co-authored.`,
          senderUserId: userId,
          excludeUserId: userId,
        }).catch((notifyErr) => {
          logger.error('[submitResearch] co-author resubmit notification failed:', notifyErr.message);
        });
      } catch (notifyErr) {
        logger.error('[submitResearch] co-author resubmit notification failed:', notifyErr.message);
      }
    }

    if (!id && facultyId) {
      void notifyUser({
        userId: facultyId,
        researchId: research.id,
        type: 'submission',
        title: 'New Research Submission',
        message: `${authorName} submitted "${title}" for your review`,
        senderUserId: userId,
      }).catch((notifyErr) => {
        logger.error('[submitResearch] faculty notification failed:', notifyErr.message);
      });

      try {
        const { data: facultyUser } = await supabase
          .from('users')
          .select('id, first_name, middle_name, last_name, email')
          .eq('id', facultyId)
          .single();
        void sendReviewAssignmentEmail({ user: facultyUser, paperTitle: title }).catch((emailErr) => {
          logger.error('Faculty assignment email error:', emailErr.message);
        });
      } catch (emailErr) {
        logger.error('Faculty assignment email error:', emailErr.message);
      }
    }

    if (id || !facultyId) {
      const { data: staffUsers } = await supabase.from('users').select('id').eq('role', 'staff');
      if (staffUsers?.length > 0) {
        void notifyUsers(
          staffUsers.map((staff) => ({
            user_id: staff.id,
            research_id: research.id,
            type: 'submission',
            title: id ? 'Research Revised' : 'New Research Submission',
            message: `${authorName} ${id ? 'resubmitted' : 'submitted'} "${title}" for review`,
            sender_user_id: userId,
          }))
        ).catch((notifyErr) => {
          logger.error('[submitResearch] staff notification failed:', notifyErr.message);
        });

        try {
          const { data: staffRecipients } = await supabase
            .from('users')
            .select('id, first_name, middle_name, last_name, email')
            .eq('role', 'staff');
          if (staffRecipients?.length) {
            void Promise.allSettled(
              staffRecipients.map((staff) => sendReviewAssignmentEmail({ user: staff, paperTitle: title }))
            ).then((results) => {
              results.forEach((result) => {
                if (result.status === 'rejected') {
                  logger.error('Staff assignment email error:', result.reason?.message || result.reason);
                }
              });
            });
          }
        } catch (emailErr) {
          logger.error('Staff assignment email error:', emailErr.message);
        }
      }
    }

    void sendPaperStatusEmail({
      user: author,
      paperTitle: title,
      statusLabel: statusAfterSubmit,
      message: id
        ? 'Your revision has been submitted successfully and routed to the next reviewer.'
        : 'Your submission has been received and entered the review workflow.',
    }).catch((emailErr) => {
      logger.error('[submitResearch] status email failed:', emailErr.message);
    });

    return sendSuccess(res, {
      status: id ? 200 : 201,
      message: id ? 'Research updated successfully' : 'Research submitted successfully',
      data: {
        research: {
          ...research,
          external_author_notes: resolveExternalAuthorNotes(research?.external_author_notes, normalizedExternalAuthorNotes),
          file_url: await resolvePaperFileUrl(research),
        },
      },
    });
  } catch (error) {
    logger.error('Submit research error:', error);
    return sendError(res, { status: 500, code: 'SUBMIT_RESEARCH_FAILED', message: 'Server error' });
  }
};

exports.getMyResearch = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit, from, to } = parseListPagination(req.query);

    const PAPER_SELECT = `
      *,
      research_authors!research_authors_research_id_fkey (
        user_id, is_primary, author_order,
        author:users!research_authors_user_id_fkey (id, first_name, middle_name, last_name, email)
      )
    `;

    // Authored papers (primary author)
    const { data: authoredPapers, error: authoredError } = await supabase
      .from('research_papers')
      .select(PAPER_SELECT)
      .eq('author_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (authoredError) throw authoredError;

    // Co-authored papers (accepted co-author via research_authors)
    let coAuthoredPapers = [];
    try {
      const { data: coAuthorLinks } = await supabase
        .from('research_authors')
        .select('research_id')
        .eq('user_id', userId)
        .eq('is_primary', false);

      const coAuthoredIds = (coAuthorLinks || [])
        .map((r) => r.research_id)
        .filter(Boolean);

      if (coAuthoredIds.length > 0) {
        const { data: coAuthored } = await supabase
          .from('research_papers')
          .select(PAPER_SELECT)
          .in('id', coAuthoredIds)
          .neq('author_id', userId) // avoid duplicates with authored set
          .is('deleted_at', null)
          .order('created_at', { ascending: false });
        coAuthoredPapers = coAuthored || [];
      }
    } catch (coAuthorErr) {
      // research_authors table may not exist yet — silently skip
      logger.warn('[getMyResearch] co-author lookup skipped:', coAuthorErr.message);
    }

    // Merge, mark co-authored papers, and resolve URLs
    const seen = new Set((authoredPapers || []).map((p) => p.id));
    const mergedPapers = [
      ...(authoredPapers || []),
      ...coAuthoredPapers.filter((p) => !seen.has(p.id)).map((p) => ({ ...p, is_coauthored: true })),
    ];

    const total = mergedPapers.length;
    const pageSlice = mergedPapers.slice(from, to + 1);

    const papersWithUrls = await Promise.all(
      pageSlice.map(async (paper) => ({
        ...paper,
        external_author_notes: resolveExternalAuthorNotes(paper.external_author_notes),
        file_url: canDownloadPaper(req.user) ? await resolvePaperFileUrl(paper) : null,
        structured_authors: normalizeResearchAuthors(paper.research_authors),
      }))
    );

    return sendSuccess(res, { data: { papers: papersWithUrls, total, page, limit } });
  } catch (error) {
    logger.error('Get my research error:', error);
    return sendError(res, { status: 500, code: 'GET_MY_RESEARCH_FAILED', message: 'Server error' });
  }
};

exports.getProfileResearchData = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const { title, startDate, endDate, department, departmentId, program, programId, details, status } = req.query;
    const [categoryLookup, departmentLookup, programLookup] = await Promise.all([
      getCategoryLookup(),
      getDepartmentLookup(),
      getProgramLookup(),
    ]);

    const resolvedDepartmentFilterId =
      departmentId || departmentLookup.byNormalizedValue.get(String(department || '').trim().toLowerCase())?.id || null;
    const resolvedProgramFilterId =
      programId || programLookup.byNormalizedValue.get(String(program || '').trim().toLowerCase())?.id || null;

    let query = supabase.from('research_papers').select(`
      id, title, abstract, category, status, department, department_id, program_id, keywords, external_author_notes,
      author_id, faculty_id, dean_chair_id, created_at, submission_date, published_date,
      author:users!author_id (id, first_name, middle_name, last_name, email, program, program_id, department, department_id),
      research_authors!research_authors_research_id_fkey (
        user_id, is_primary, author_order,
        author:users!research_authors_user_id_fkey (id, first_name, middle_name, last_name, email)
      )
    `).order('created_at', { ascending: false });

    if (role === 'student') query = query.eq('author_id', userId);
    else if (role === 'faculty') query = query.eq('faculty_id', userId);
    else if (['dean', 'program_chair'].includes(role)) query = query.eq('dean_chair_id', userId);

    if (title) query = query.ilike('title', `%${title}%`);
    if (status) query = query.eq('status', status);
    if (resolvedDepartmentFilterId) query = query.eq('department_id', resolvedDepartmentFilterId);
    else if (department) query = query.eq('department', department);
    if (resolvedProgramFilterId) query = query.eq('program_id', resolvedProgramFilterId);
    if (startDate) query = query.gte('submission_date', startDate);
    if (endDate) query = query.lte('submission_date', endDate);
    if (details) {
      const safe = String(details).replace(/,/g, ' ');
      query = query.or(`title.ilike.%${safe}%,abstract.ilike.%${safe}%,category.ilike.%${safe}%`);
    }

    const { data: papers, error } = await query;
    if (error) throw error;

    let filtered = papers || [];
    if (!resolvedProgramFilterId && program) {
      const norm = String(program).toLowerCase();
      filtered = filtered.filter((p) => {
        const programLabel = resolveProgramLabel(p.author?.program_id, p.author?.program, programLookup);
        return String(programLabel || '').toLowerCase() === norm;
      });
    }

    const records = filtered.map((p) => {
      const structuredAuthors = normalizeResearchAuthors(p.research_authors);
      const departmentLabel = resolveDepartmentLabel(
        p.department_id,
        p.department || p.author?.department || null,
        departmentLookup
      );
      const programLabel = resolveProgramLabel(p.program_id || p.author?.program_id, p.author?.program || null, programLookup);

      return {
        id: p.id,
        title: p.title,
        category: resolveCategoryLabel(p.category, categoryLookup) || p.category,
        status: p.status,
        department: departmentLabel,
        program: programLabel,
        submissionDate: p.submission_date || p.created_at,
        publishedDate: p.published_date,
        authorName: buildFullName(p.author) || null,
        authorEmail: p.author?.email || null,
        details: {
          abstract: p.abstract,
          keywords: p.keywords || [],
          externalAuthorNotes: resolveExternalAuthorNotes(p.external_author_notes),
          coAuthors: resolveCompatibleCoAuthorText(structuredAuthors, resolveExternalAuthorNotes(p.external_author_notes)),
          structuredAuthors,
        },
      };
    });

    return sendSuccess(res, {
      data: {
        profile: { userId, role },
        stats: {
          totalRecords: records.length,
          uploadedCount: filtered.filter(p => p.author_id === userId).length,
          publishedCount: filtered.filter(p => p.author_id === userId && ['approved', 'published'].includes(p.status)).length,
        },
        records,
      },
    });
  } catch (error) {
    logger.error('Get profile research data error:', error);
    return sendError(res, { status: 500, code: 'GET_PROFILE_DATA_FAILED', message: 'Failed to fetch profile data' });
  }
};

const PUBLISHED_PAPER_SELECT = `
  *, author:users!author_id (id, first_name, middle_name, last_name, email),
  research_authors!research_authors_research_id_fkey (
    user_id, is_primary, author_order,
    author:users!research_authors_user_id_fkey (id, first_name, middle_name, last_name, email)
  )
`;

const parsePublishedPagination = (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, from: (page - 1) * limit, to: (page - 1) * limit + limit - 1 };
};

const sanitizeSearchTerm = (value) => String(value || '').replace(/[,%()]/g, ' ').trim();

const applyPublishedSort = (query, sortBy) => {
  switch (sortBy) {
    case 'oldest':
      return query.order('created_at', { ascending: true });
    case 'title':
      return query.order('title', { ascending: true });
    case 'newest':
    default:
      return query.order('updated_at', { ascending: false });
  }
};

const transformPublishedPaper = async (paper, user) => {
  const structuredAuthors = normalizeResearchAuthors(paper.research_authors);
  const includeFileUrl = user?.role === 'admin';
  return {
    ...paper,
    users: attachFullName(paper.author),
    structured_authors: structuredAuthors,
    external_author_notes: resolveExternalAuthorNotes(paper.external_author_notes),
    file_url: includeFileUrl ? await resolvePaperFileUrl(paper) : null,
  };
};

const buildPublishedFacets = async (baseFilters = {}) => {
  let facetQuery = supabase
    .from('research_papers')
    .select('category')
    .in('status', ['approved', 'published'])
    .is('deleted_at', null);

  if (baseFilters.category) facetQuery = facetQuery.eq('category', baseFilters.category);
  if (baseFilters.themeCategories?.length) facetQuery = facetQuery.in('category', baseFilters.themeCategories);

  const { data: rows, error } = await facetQuery;
  if (error) throw error;

  const counts = new Map();
  (rows || []).forEach((row) => {
    if (!row.category) return;
    counts.set(row.category, (counts.get(row.category) || 0) + 1);
  });

  const categoryLookup = await getCategoryLookup();
  return {
    categories: Array.from(counts.entries()).map(([id, count]) => ({
      id,
      name: categoryLookup.get(id) || id,
      count,
    })),
  };
};

const resolveAuthorPaperIds = async (authorTerm) => {
  const term = sanitizeSearchTerm(authorTerm);
  if (!term) return null;

  const { data, error } = await supabase.rpc('published_paper_ids_by_author', { author_term: term });
  if (error) {
    if (String(error.message || '').includes('published_paper_ids_by_author')) {
      return null;
    }
    throw error;
  }
  return (data || []).map((row) => (typeof row === 'string' ? row : row?.id)).filter(Boolean);
};

exports.getPublishedResearch = async (req, res) => {
  try {
    const {
      category,
      search,
      q,
      year,
      author,
      themes,
      sort = 'newest',
    } = req.query;
    const { page, limit, from, to } = parsePublishedPagination(req.query);
    const textQuery = sanitizeSearchTerm(q || search);
    const themeCategories = String(themes || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    const cacheKey = `published:${JSON.stringify({ category, textQuery, year, author, themes, sort, page, limit })}`;
    const cachedPayload = await getOrSet(cacheKey, TTL.PUBLISHED, async () => {
      let query = supabase
        .from('research_papers')
        .select(PUBLISHED_PAPER_SELECT, { count: 'exact' })
        .in('status', ['approved', 'published'])
        .is('deleted_at', null);

      if (category) query = query.eq('category', category);
      if (themeCategories.length > 0) query = query.in('category', themeCategories);

      if (year) {
        const yStart = `${year}-01-01`;
        const yEnd = `${year}-12-31`;
        query = query.or(
          `and(status.eq.published,published_date.gte.${yStart},published_date.lte.${yEnd}),and(status.eq.approved,created_at.gte.${yStart},created_at.lte.${yEnd})`
        );
      }

      const applyTextFilter = (builder, useFts) => {
        if (!textQuery) return builder;
        if (useFts) {
          return builder.textSearch('search_vector', textQuery, {
            type: 'websearch',
            config: 'english',
          });
        }
        const safe = textQuery.replace(/'/g, "''");
        return builder.or(`title.ilike.%${safe}%,abstract.ilike.%${safe}%`);
      };

      const authorPaperIds = author ? await resolveAuthorPaperIds(author) : null;
      if (author && Array.isArray(authorPaperIds)) {
        if (authorPaperIds.length === 0) {
          return { papers: [], total: 0, page, limit, facets: await buildPublishedFacets({ category, themeCategories }) };
        }
        query = query.in('id', authorPaperIds);
      }

      query = applyPublishedSort(applyTextFilter(query, true), sort).range(from, to);

      let { data: papers, error, count } = await query;
      if (error && textQuery && String(error.message || '').includes('search_vector')) {
        let fallbackQuery = supabase
          .from('research_papers')
          .select(PUBLISHED_PAPER_SELECT, { count: 'exact' })
          .in('status', ['approved', 'published'])
          .is('deleted_at', null);
        if (category) fallbackQuery = fallbackQuery.eq('category', category);
        if (themeCategories.length > 0) fallbackQuery = fallbackQuery.in('category', themeCategories);
        if (year) {
          const yStart = `${year}-01-01`;
          const yEnd = `${year}-12-31`;
          fallbackQuery = fallbackQuery.or(
            `and(status.eq.published,published_date.gte.${yStart},published_date.lte.${yEnd}),and(status.eq.approved,created_at.gte.${yStart},created_at.lte.${yEnd})`
          );
        }
        if (author && Array.isArray(authorPaperIds) && authorPaperIds.length > 0) {
          fallbackQuery = fallbackQuery.in('id', authorPaperIds);
        }
        fallbackQuery = applyPublishedSort(applyTextFilter(fallbackQuery, false), sort).range(from, to);
        ({ data: papers, error, count } = await fallbackQuery);
      }
      if (error) throw error;

      const transformed = await Promise.all(
        (papers || []).map((paper) => transformPublishedPaper(paper, req.user))
      );

      if (author && authorPaperIds === null) {
        const norm = author.toLowerCase();
        const filtered = transformed.filter((paper) =>
          paper.structured_authors?.some((entry) =>
            buildFullName(entry?.author).toLowerCase().includes(norm)
          )
        );
        return {
          papers: filtered,
          total: filtered.length,
          page,
          limit,
          facets: await buildPublishedFacets({ category, themeCategories }),
        };
      }

      return {
        papers: transformed,
        total: count ?? transformed.length,
        page,
        limit,
        facets: await buildPublishedFacets({ category, themeCategories }),
      };
    });

    return sendSuccess(res, { data: cachedPayload });
  } catch (error) {
    logger.error('Get published research error:', error);
    return sendError(res, { status: 500, code: 'GET_PUBLISHED_RESEARCH_FAILED', message: 'Server error' });
  }
};

// Max candidate pool the hybrid RPC returns for a query. The pool is cached and
// sliced for pagination so we embed the query (and hit pgvector) only once per
// unique query+filters, regardless of how many pages the user loads.
const SEMANTIC_CANDIDATE_LIMIT = 100;
const SEMANTIC_SIMILARITY_THRESHOLD = Number(process.env.SEMANTIC_SIMILARITY_THRESHOLD || 0.3);
const SEMANTIC_WEIGHT = Number(process.env.SEMANTIC_WEIGHT || 0.6);
const KEYWORD_WEIGHT = Number(process.env.KEYWORD_WEIGHT || 0.4);

const roundScore = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;

/**
 * GET /api/research/semantic-search
 * AI-powered hybrid (semantic + keyword) thematic search over published papers.
 * Query params: q (required), page, limit, department, year, author.
 */
exports.getSemanticSearch = async (req, res) => {
  try {
    const { q, department, year, author } = req.query;
    const { page, limit, from, to } = parsePublishedPagination(req.query);
    const queryText = sanitizeSearchTerm(q);

    if (!queryText || queryText.length < 2) {
      return sendError(res, {
        status: 400,
        code: 'SEARCH_QUERY_REQUIRED',
        message: 'A search query of at least 2 characters is required.',
      });
    }

    const filterDepartment = UUID_PATTERN.test(String(department || '')) ? department : null;
    const filterYear = /^\d{4}$/.test(String(year || '')) ? Number(year) : null;
    const filterAuthor = sanitizeSearchTerm(author) || null;

    // Cache the ranked candidate pool by query + filters (not page) so paging is free.
    const cacheKey = `semantic:${JSON.stringify({ queryText, filterDepartment, filterYear, filterAuthor })}`;

    const ranked = await getOrSet(cacheKey, TTL.PUBLISHED, async () => {
      // 1. Embed the query (asymmetric RETRIEVAL_QUERY task type).
      const queryEmbedding = await embedQuery(queryText);

      // 2. Hybrid rank in Postgres (pgvector cosine + tsvector keyword).
      const { data: matches, error } = await supabase.rpc('match_research_papers', {
        query_embedding: queryEmbedding ? JSON.stringify(queryEmbedding) : null,
        query_text: queryText,
        match_count: SEMANTIC_CANDIDATE_LIMIT,
        similarity_threshold: SEMANTIC_SIMILARITY_THRESHOLD,
        semantic_weight: SEMANTIC_WEIGHT,
        keyword_weight: KEYWORD_WEIGHT,
        filter_department: filterDepartment,
        filter_year: filterYear,
        filter_author: filterAuthor,
      });

      if (error) throw error;
      if (!matches || matches.length === 0) return [];

      // 3. Hydrate full paper rows in one query, preserving the RPC ranking.
      const orderedIds = matches.map((row) => row.id);
      const scoreById = new Map(matches.map((row) => [row.id, row]));

      const { data: papers, error: hydrateError } = await supabase
        .from('research_papers')
        .select(PUBLISHED_PAPER_SELECT)
        .in('id', orderedIds);

      if (hydrateError) throw hydrateError;

      const paperById = new Map((papers || []).map((paper) => [paper.id, paper]));

      return orderedIds
        .map((id) => {
          const paper = paperById.get(id);
          if (!paper) return null;
          const scores = scoreById.get(id) || {};
          return {
            ...paper,
            users: attachFullName(paper.author),
            structured_authors: normalizeResearchAuthors(paper.research_authors),
            external_author_notes: resolveExternalAuthorNotes(paper.external_author_notes),
            file_url: null,
            similarityScore: roundScore(scores.semantic_score),
            keywordScore: roundScore(scores.keyword_score),
            hybridScore: roundScore(scores.hybrid_score),
          };
        })
        .filter(Boolean);
    });

    const paged = ranked.slice(from, to + 1);

    return sendSuccess(res, {
      data: {
        papers: paged,
        total: ranked.length,
        page,
        limit,
        query: queryText,
      },
    });
  } catch (error) {
    logger.error('Semantic search error:', error);
    if (String(error?.message || '').includes('match_research_papers')) {
      return sendError(res, {
        status: 503,
        code: 'SEMANTIC_SEARCH_UNAVAILABLE',
        message: 'Semantic search is not available yet. Apply add_semantic_search.sql.',
      });
    }
    return sendError(res, { status: 500, code: 'SEMANTIC_SEARCH_FAILED', message: 'Server error' });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await getOrSet('categories:all', TTL.CATEGORIES, async () => {
      const { data, error } = await supabase.from('research_categories').select('*').order('name');
      if (error) throw error;
      return data;
    });
    return sendSuccess(res, { data: { categories } });
  } catch {
    return sendError(res, { status: 500, code: 'GET_CATEGORIES_FAILED', message: 'Server error' });
  }
};

exports.getFacultyMembers = async (req, res) => {
  try {
    const { department, departmentId } = req.query;
    const departmentLookup = await getDepartmentLookup();
    const resolvedDepartmentFilterId =
      departmentId || departmentLookup.byNormalizedValue.get(String(department || '').trim().toLowerCase())?.id || null;
    const cacheKey = `faculty:${resolvedDepartmentFilterId || department || 'all'}`;
    const facultyMembers = await getOrSet(cacheKey, TTL.FACULTY, async () => {
      let query = supabase
        .from('users')
        .select('id, first_name, middle_name, last_name, email, department, department_id')
        .eq('role', 'faculty')
        .order('last_name')
        .order('first_name');
      if (resolvedDepartmentFilterId) query = query.eq('department_id', resolvedDepartmentFilterId);
      else if (department) query = query.eq('department', department);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    });
    return sendSuccess(res, {
      data: {
        facultyMembers: (facultyMembers || []).map((member) => attachFullName({
          ...member,
          department: resolveDepartmentLabel(member.department_id, member.department, departmentLookup),
        })),
      },
    });
  } catch (error) {
    logger.error('Get faculty members error:', error);
    return sendError(res, { status: 500, code: 'GET_FACULTY_MEMBERS_FAILED', message: 'Server error' });
  }
};

exports.getDeanChairMembers = async (req, res) => {
  try {
    const [departmentLookup, programLookup] = await Promise.all([
      getDepartmentLookup(),
      getProgramLookup(),
    ]);
    const members = await getOrSet('dean_chair:all', TTL.DEAN_CHAIR, async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, middle_name, last_name, email, role, department, department_id, program, program_id')
        .in('role', ['dean', 'program_chair'])
        .order('role')
        .order('last_name')
        .order('first_name');
      if (error) throw error;
      return data;
    });
    return sendSuccess(res, {
      data: {
        members: (members || []).map((member) => attachFullName({
          ...member,
          department: resolveDepartmentLabel(member.department_id, member.department, departmentLookup),
          program: resolveProgramLabel(member.program_id, member.program, programLookup),
        })),
      },
    });
  } catch (error) {
    logger.error('Get dean/chair members error:', error);
    return sendError(res, { status: 500, code: 'GET_DEAN_CHAIR_MEMBERS_FAILED', message: 'Server error' });
  }
};

exports.getResearchById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: paper, error } = await supabase
      .from('research_papers')
      .select(`
        *,
        author:users!author_id (id, first_name, middle_name, last_name, email),
        research_authors!research_authors_research_id_fkey (
          user_id, is_primary, author_order,
          author:users!research_authors_user_id_fkey (id, first_name, middle_name, last_name, email)
        )
      `)
      .eq('id', id)
      .single();
    if (error || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    if (paper.deleted_at && req.user.role !== 'admin') {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    }
    if (!canAccessPaper(req.user, paper)) return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' });

    let workflowHistory = [];
    try {
      const { data: historyRows, error: historyError } = await supabase
        .from('approval_workflow')
        .select('id, reviewer_role, action_type, status, comments, previous_status, new_status, reviewed_at, created_at, reviewer:users!approval_workflow_reviewer_id_fkey(id, first_name, middle_name, last_name, email)')
        .eq('research_id', id)
        .order('created_at', { ascending: true });

      if (historyError) throw historyError;
      workflowHistory = (historyRows || []).map((item) => ({
        ...item,
        reviewer: attachFullName(item.reviewer),
      }));
    } catch (historyErr) {
      logger.error('Get workflow history error:', historyErr);
    }

    return sendSuccess(res, {
      data: {
        paper: {
          ...paper,
          users: attachFullName(paper.author),
          structured_authors: normalizeResearchAuthors(paper.research_authors),
          external_author_notes: resolveExternalAuthorNotes(paper.external_author_notes),
          file_url: canDownloadPaper(req.user) ? await resolvePaperFileUrl(paper) : null,
        },
        workflowHistory,
      },
    });
  } catch (error) {
    logger.error('Get research error:', error);
    return sendError(res, { status: 500, code: 'GET_RESEARCH_BY_ID_FAILED', message: 'Server error' });
  }
};

exports.getResearchFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: paper, error } = await supabase
      .from('research_papers')
      .select('*, research_authors!research_authors_research_id_fkey(user_id)')
      .eq('id', id)
      .single();
    if (error || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    if (!canAccessPaper(req.user, paper)) return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' });
    const fileUrl = await resolvePaperFileUrl(paper);
    if (!fileUrl) return sendError(res, { status: 400, code: 'FILE_UNAVAILABLE', message: 'Paper file is not available' });
    return sendSuccess(res, {
      data: {
        fileUrl,
        isSigned: !isPublicPaperStatus(paper.status),
        canDownload: canDownloadPaper(req.user),
        source: paper.file_storage_path ? 'storage_path' : 'file_url',
        storagePath: paper.file_storage_path || extractStoragePathFromUrl(paper.file_url),
      },
    });
  } catch (error) {
    logger.error('Get research file error:', error);
    return sendError(res, { status: 500, code: 'GET_RESEARCH_FILE_FAILED', message: 'Server error' });
  }
};

exports.trackView = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: paper, error: paperError } = await supabase
      .from('research_papers')
      .select('id, status, author_id, faculty_id, dean_chair_id, research_authors!research_authors_research_id_fkey(user_id)')
      .eq('id', id)
      .single();
    if (paperError || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    if (!canAccessPaper(req.user, paper)) return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' });
    const { error: updateError } = await supabase.rpc('increment_view_count', { row_id: id });
    if (updateError) throw updateError;
    await supabase.from('paper_views').insert({ paper_id: id, user_id: req.user.id, viewed_at: new Date().toISOString() });
    return sendSuccess(res, { message: 'View tracked successfully', data: {} });
  } catch (error) {
    logger.error('Error tracking view:', error);
    return sendError(res, { status: 500, code: 'TRACK_VIEW_FAILED', message: 'Failed to track view' });
  }
};

exports.trackDownload = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Only administrators can download PDF files' });
    }
    const { id } = req.params;
    const { data: paper, error: paperError } = await supabase
      .from('research_papers')
      .select('id, status, title, author_id, faculty_id, dean_chair_id, research_authors!research_authors_research_id_fkey(user_id)')
      .eq('id', id)
      .single();
    if (paperError || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    if (!canAccessPaper(req.user, paper)) return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' });
    const { error: updateError } = await supabase.rpc('increment_download_count', { row_id: id });
    if (updateError) throw updateError;
    await supabase.from('paper_downloads').insert({ paper_id: id, user_id: req.user.id, downloaded_at: new Date().toISOString() });

    const title = paper.title || 'Your paper';
    await notifyUser({
      userId: paper.author_id,
      researchId: id,
      type: 'admin_download',
      title: 'Paper downloaded by administrator',
      message: `An administrator downloaded the PDF for "${title}".`,
      senderUserId: req.user.id,
    });
    try {
      await notifyCoAuthors({
        researchId: id,
        type: 'admin_download',
        title: 'Paper downloaded by administrator',
        message: `An administrator downloaded the PDF for "${title}" that you co-authored.`,
        senderUserId: req.user.id,
        excludeUserId: paper.author_id,
        alreadyNotifiedIds: [],
      });
    } catch (e) {
      logger.warn('[trackDownload] co-author notify failed', e.message);
    }

    return sendSuccess(res, { message: 'Download tracked successfully', data: {} });
  } catch (error) {
    logger.error('Error tracking download:', error);
    return sendError(res, { status: 500, code: 'TRACK_DOWNLOAD_FAILED', message: 'Failed to track download' });
  }
};

exports.getMyDraft = async (req, res) => {
  try {
    const { paperId } = req.query;
    let query = supabase
      .from('submission_drafts')
      .select('id, user_id, paper_id, draft_data, updated_at')
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (paperId) {
      query = query.eq('paper_id', paperId);
    } else {
      query = query.is('paper_id', null);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;

    return sendSuccess(res, { data: { draft: data || null } });
  } catch (error) {
    logger.error('Get draft error:', error);
    return sendError(res, { status: 500, code: 'GET_DRAFT_FAILED', message: 'Failed to get draft' });
  }
};

exports.upsertMyDraft = async (req, res) => {
  try {
    const { paperId = null, draftData } = req.body;
    if (!draftData || typeof draftData !== 'object') {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'draftData object is required' });
    }

    const payload = {
      user_id: req.user.id,
      paper_id: paperId,
      draft_data: draftData,
      updated_at: new Date().toISOString(),
    };

    let result = await supabase
      .from('submission_drafts')
      .upsert(payload, { onConflict: 'user_id,paper_id' })
      .select('id, user_id, paper_id, draft_data, updated_at')
      .single();

    if (result.error && String(result.error.message || '').includes('there is no unique or exclusion constraint')) {
      const { data: existing } = await supabase
        .from('submission_drafts')
        .select('id')
        .eq('user_id', req.user.id)
        .is('paper_id', paperId)
        .maybeSingle();

      if (existing?.id) {
        result = await supabase
          .from('submission_drafts')
          .update(payload)
          .eq('id', existing.id)
          .select('id, user_id, paper_id, draft_data, updated_at')
          .single();
      } else {
        result = await supabase
          .from('submission_drafts')
          .insert(payload)
          .select('id, user_id, paper_id, draft_data, updated_at')
          .single();
      }
    }

    if (result.error) throw result.error;

    return sendSuccess(res, {
      message: 'Draft saved',
      data: { draft: result.data },
    });
  } catch (error) {
    logger.error('Save draft error:', error);
    return sendError(res, { status: 500, code: 'SAVE_DRAFT_FAILED', message: 'Failed to save draft' });
  }
};

exports.deleteMyDraft = async (req, res) => {
  try {
    const { paperId } = req.query;
    let query = supabase.from('submission_drafts').delete().eq('user_id', req.user.id);

    if (paperId) {
      query = query.eq('paper_id', paperId);
    } else {
      query = query.is('paper_id', null);
    }

    const { error } = await query;
    if (error) throw error;

    return sendSuccess(res, { message: 'Draft deleted', data: {} });
  } catch (error) {
    logger.error('Delete draft error:', error);
    return sendError(res, { status: 500, code: 'DELETE_DRAFT_FAILED', message: 'Failed to delete draft' });
  }
};
