/**
 * submission.controller.js — F-002
 * Handles: paper submission, retrieval, browsing, tracking, and lookup endpoints.
 */
const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const {
  canAccessPaper,
  extractStoragePathFromUrl,
  isPublicPaperStatus,
  resolvePaperFileUrl,
} = require('../utils/fileAccess');
const { sendSuccess, sendError } = require('../utils/response');
const { getOrSet, TTL } = require('../utils/cache'); // P-001
const { attachFullName, buildFullName } = require('../utils/name');
const { sendPaperStatusEmail, sendReviewAssignmentEmail } = require('../utils/workflowEmail');
const { getSystemPolicy, isFileAllowedByPolicy } = require('../utils/systemPolicy');

// Submit new research or update existing revision
exports.submitResearch = async (req, res) => {
  try {
    const { id, title, abstract, keywords, coAuthors, category, facultyId, department, departmentId } = req.body;
    const file = req.file;
    const userId = req.user.id;

    if (!id && !file) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Research file is required' });
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
        console.error('Upload error:', uploadError);
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

    let resolvedDepartmentId = departmentId || null;
    let resolvedDepartmentName = department || null;

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
      co_authors: coAuthors || null,
      category,
      author_id: userId,
      faculty_id: facultyId || null,
      department: resolvedDepartmentName || null,
      department_id: resolvedDepartmentId,
      status: id ? undefined : (facultyId ? 'pending_faculty' : 'pending'),
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

    if (dbError) {
      return sendError(res, { status: 500, code: 'SAVE_RESEARCH_FAILED', message: 'Failed to save research data' });
    }

    // Co-authors
    let coAuthorIds = [];
    try {
      if (req.body.coAuthorIds) {
        coAuthorIds = typeof req.body.coAuthorIds === 'string'
          ? JSON.parse(req.body.coAuthorIds)
          : req.body.coAuthorIds;
      }
    } catch { coAuthorIds = []; }

    if (coAuthorIds.length > 0) {
      try {
        if (id) {
          await supabase.from('research_authors').delete().eq('research_id', research.id).neq('is_primary', true);
        }
        await supabase.from('research_authors').upsert(
          { research_id: research.id, user_id: userId, author_order: 0, is_primary: true },
          { onConflict: 'research_id,user_id' }
        );
        const coAuthorsData = coAuthorIds.map((authorId, index) => ({
          research_id: research.id, user_id: authorId, author_order: index + 1, is_primary: false,
        }));
        await supabase.from('research_authors').upsert(coAuthorsData, { onConflict: 'research_id,user_id' });
      } catch { /* research_authors table may not exist yet */ }
    } else {
      try {
        await supabase.from('research_authors').upsert(
          { research_id: research.id, user_id: userId, author_order: 0, is_primary: true },
          { onConflict: 'research_id,user_id' }
        );
      } catch { /* research_authors table may not exist yet */ }
    }

    let statusAfterSubmit = research.status || (facultyId ? 'pending_faculty' : 'pending');

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
          || (existingPaper.faculty_id ? 'pending_faculty' : 'pending');

        await supabase.from('research_papers').update({
          status: newStatus, revision_notes: null, last_reviewer_role: null, previous_status: null,
        }).eq('id', id);
        statusAfterSubmit = newStatus;
      }
    }

    const { data: author } = await supabase.from('users').select('first_name, middle_name, last_name, email').eq('id', userId).single();
    const authorName = buildFullName(author) || author?.email;

    if (!id && facultyId) {
      await supabase.from('notifications').insert([{
        user_id: facultyId, research_id: research.id, type: 'submission',
        title: 'New Research Submission',
        message: `${authorName} submitted "${title}" for your review`,
      }]);

      try {
        const { data: facultyUser } = await supabase
          .from('users')
          .select('id, first_name, middle_name, last_name, email')
          .eq('id', facultyId)
          .single();
        await sendReviewAssignmentEmail({ user: facultyUser, paperTitle: title });
      } catch (emailErr) {
        console.error('Faculty assignment email error:', emailErr.message);
      }
    }

    if (id || !facultyId) {
      const { data: staffUsers } = await supabase.from('users').select('id').eq('role', 'staff');
      if (staffUsers?.length > 0) {
        await supabase.from('notifications').insert(
          staffUsers.map(staff => ({
            user_id: staff.id, research_id: research.id, type: 'submission',
            title: id ? 'Research Revised' : 'New Research Submission',
            message: `${authorName} ${id ? 'resubmitted' : 'submitted'} "${title}" for review`,
          }))
        );

        try {
          const { data: staffRecipients } = await supabase
            .from('users')
            .select('id, first_name, middle_name, last_name, email')
            .eq('role', 'staff');
          if (staffRecipients?.length) {
            await Promise.all(
              staffRecipients.map((staff) => sendReviewAssignmentEmail({ user: staff, paperTitle: title }))
            );
          }
        } catch (emailErr) {
          console.error('Staff assignment email error:', emailErr.message);
        }
      }
    }

    await sendPaperStatusEmail({
      user: author,
      paperTitle: title,
      statusLabel: statusAfterSubmit,
      message: id
        ? 'Your revision has been submitted successfully and routed to the next reviewer.'
        : 'Your submission has been received and entered the review workflow.',
    });

    return sendSuccess(res, {
      status: id ? 200 : 201,
      message: id ? 'Research updated successfully' : 'Research submitted successfully',
      data: { research: { ...research, file_url: await resolvePaperFileUrl(research) } },
    });
  } catch (error) {
    console.error('Submit research error:', error);
    return sendError(res, { status: 500, code: 'SUBMIT_RESEARCH_FAILED', message: 'Server error' });
  }
};

exports.getMyResearch = async (req, res) => {
  try {
    const { data: papers, error } = await supabase
      .from('research_papers').select('*').eq('author_id', req.user.id).is('deleted_at', null).order('created_at', { ascending: false });
    if (error) throw error;
    const papersWithUrls = await Promise.all((papers || []).map(async p => ({ ...p, file_url: await resolvePaperFileUrl(p) })));
    return sendSuccess(res, { data: { papers: papersWithUrls } });
  } catch (error) {
    console.error('Get my research error:', error);
    return sendError(res, { status: 500, code: 'GET_MY_RESEARCH_FAILED', message: 'Server error' });
  }
};

exports.getProfileResearchData = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const { title, startDate, endDate, department, program, details, status } = req.query;

    let query = supabase.from('research_papers').select(`
      id, title, abstract, category, status, department, keywords, co_authors,
      author_id, faculty_id, dean_chair_id, created_at, submission_date, published_date,
      author:users!author_id (id, first_name, middle_name, last_name, email, program, department)
    `).order('created_at', { ascending: false });

    if (role === 'student') query = query.eq('author_id', userId);
    else if (role === 'faculty') query = query.eq('faculty_id', userId);
    else if (['dean', 'program_chair'].includes(role)) query = query.eq('dean_chair_id', userId);

    if (title) query = query.ilike('title', `%${title}%`);
    if (status) query = query.eq('status', status);
    if (department) query = query.eq('department', department);
    if (startDate) query = query.gte('submission_date', startDate);
    if (endDate) query = query.lte('submission_date', endDate);
    if (details) {
      const safe = String(details).replace(/,/g, ' ');
      query = query.or(`title.ilike.%${safe}%,abstract.ilike.%${safe}%,category.ilike.%${safe}%`);
    }

    const { data: papers, error } = await query;
    if (error) throw error;

    let filtered = papers || [];
    if (program) {
      const norm = String(program).toLowerCase();
      filtered = filtered.filter(p => String(p.author?.program || '').toLowerCase() === norm);
    }

    const records = filtered.map(p => ({
      id: p.id, title: p.title, category: p.category, status: p.status,
      department: p.department || p.author?.department || null,
      program: p.author?.program || null,
      submissionDate: p.submission_date || p.created_at,
      publishedDate: p.published_date,
      authorName: buildFullName(p.author) || null,
      authorEmail: p.author?.email || null,
      details: { abstract: p.abstract, keywords: p.keywords || [], coAuthors: p.co_authors || null },
    }));

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
    console.error('Get profile research data error:', error);
    return sendError(res, { status: 500, code: 'GET_PROFILE_DATA_FAILED', message: 'Failed to fetch profile data' });
  }
};

exports.getPublishedResearch = async (req, res) => {
  try {
    const { category, search, year, author } = req.query;
    let query = supabase.from('research_papers').select(`
      *, author:users!author_id (id, first_name, middle_name, last_name, email),
      research_authors!research_authors_research_id_fkey (
        user_id, is_primary, author_order,
        author:users!research_authors_user_id_fkey (id, first_name, middle_name, last_name, email)
      )
    `).eq('status', 'approved').is('deleted_at', null).order('published_date', { ascending: false });

    if (category) query = query.eq('category', category);
    if (search) query = query.or(`title.ilike.%${search}%,abstract.ilike.%${search}%`);
    if (year) query = query.gte('published_date', `${year}-01-01`).lte('published_date', `${year}-12-31`);

    const { data: papers, error } = await query;
    if (error) throw error;

    let transformed = await Promise.all((papers || []).map(async p => ({
      ...p,
      users: attachFullName(p.author),
      co_authors: (p.research_authors || []).map(ca => ({ ...ca, author: attachFullName(ca.author) })),
      file_url: await resolvePaperFileUrl(p),
    })));

    if (author) {
      const norm = author.toLowerCase();
      transformed = transformed.filter(p =>
        p.users?.full_name?.toLowerCase().includes(norm) ||
        p.co_authors?.some(ca => ca.author?.full_name?.toLowerCase().includes(norm))
      );
    }
    return sendSuccess(res, { data: { papers: transformed } });
  } catch (error) {
    console.error('Get published research error:', error);
    return sendError(res, { status: 500, code: 'GET_PUBLISHED_RESEARCH_FAILED', message: 'Server error' });
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
    const { department } = req.query;
    const cacheKey = `faculty:${department || 'all'}`;
    const facultyMembers = await getOrSet(cacheKey, TTL.FACULTY, async () => {
      let query = supabase
        .from('users')
        .select('id, first_name, middle_name, last_name, email, department')
        .eq('role', 'faculty')
        .order('last_name')
        .order('first_name');
      if (department) query = query.eq('department', department);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    });
    return sendSuccess(res, { data: { facultyMembers: (facultyMembers || []).map(attachFullName) } });
  } catch (error) {
    console.error('Get faculty members error:', error);
    return sendError(res, { status: 500, code: 'GET_FACULTY_MEMBERS_FAILED', message: 'Server error' });
  }
};

exports.getDeanChairMembers = async (req, res) => {
  try {
    const members = await getOrSet('dean_chair:all', TTL.DEAN_CHAIR, async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, middle_name, last_name, email, role, department')
        .in('role', ['dean', 'program_chair'])
        .order('role')
        .order('last_name')
        .order('first_name');
      if (error) throw error;
      return data;
    });
    return sendSuccess(res, { data: { members: (members || []).map(attachFullName) } });
  } catch (error) {
    console.error('Get dean/chair members error:', error);
    return sendError(res, { status: 500, code: 'GET_DEAN_CHAIR_MEMBERS_FAILED', message: 'Server error' });
  }
};

exports.getResearchById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: paper, error } = await supabase
      .from('research_papers').select('*, author:users!author_id (id, first_name, middle_name, last_name, email)').eq('id', id).single();
    if (error || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    if (paper.deleted_at && req.user.role !== 'admin') {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    }
    if (!canAccessPaper(req.user, paper)) return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' });

    let workflowHistory = [];
    try {
      const { data: historyRows, error: historyError } = await supabase
        .from('approval_workflow')
        .select('id, reviewer_role, status, comments, previous_status, new_status, reviewed_at, created_at, reviewer:users!approval_workflow_reviewer_id_fkey(id, first_name, middle_name, last_name, email)')
        .eq('research_id', id)
        .order('created_at', { ascending: true });

      if (historyError) throw historyError;
      workflowHistory = (historyRows || []).map((item) => ({
        ...item,
        reviewer: attachFullName(item.reviewer),
      }));
    } catch (historyErr) {
      console.error('Get workflow history error:', historyErr);
    }

    return sendSuccess(res, {
      data: {
        paper: { ...paper, users: attachFullName(paper.author), file_url: await resolvePaperFileUrl(paper) },
        workflowHistory,
      },
    });
  } catch (error) {
    console.error('Get research error:', error);
    return sendError(res, { status: 500, code: 'GET_RESEARCH_BY_ID_FAILED', message: 'Server error' });
  }
};

exports.getResearchFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: paper, error } = await supabase.from('research_papers').select('*').eq('id', id).single();
    if (error || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    if (!canAccessPaper(req.user, paper)) return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' });
    const fileUrl = await resolvePaperFileUrl(paper);
    if (!fileUrl) return sendError(res, { status: 400, code: 'FILE_UNAVAILABLE', message: 'Paper file is not available' });
    return sendSuccess(res, {
      data: {
        fileUrl, isSigned: !isPublicPaperStatus(paper.status),
        source: paper.file_storage_path ? 'storage_path' : 'file_url',
        storagePath: paper.file_storage_path || extractStoragePathFromUrl(paper.file_url),
      },
    });
  } catch (error) {
    console.error('Get research file error:', error);
    return sendError(res, { status: 500, code: 'GET_RESEARCH_FILE_FAILED', message: 'Server error' });
  }
};

exports.trackView = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: paper, error: paperError } = await supabase
      .from('research_papers').select('id, status, author_id, faculty_id, dean_chair_id').eq('id', id).single();
    if (paperError || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    if (!canAccessPaper(req.user, paper)) return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' });
    const { error: updateError } = await supabase.rpc('increment_view_count', { row_id: id });
    if (updateError) throw updateError;
    await supabase.from('paper_views').insert({ paper_id: id, user_id: req.user.id, viewed_at: new Date().toISOString() });
    return sendSuccess(res, { message: 'View tracked successfully', data: {} });
  } catch (error) {
    console.error('Error tracking view:', error);
    return sendError(res, { status: 500, code: 'TRACK_VIEW_FAILED', message: 'Failed to track view' });
  }
};

exports.trackDownload = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: paper, error: paperError } = await supabase
      .from('research_papers').select('id, status, author_id, faculty_id, dean_chair_id').eq('id', id).single();
    if (paperError || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    if (!canAccessPaper(req.user, paper)) return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' });
    const { error: updateError } = await supabase.rpc('increment_download_count', { row_id: id });
    if (updateError) throw updateError;
    await supabase.from('paper_downloads').insert({ paper_id: id, user_id: req.user.id, downloaded_at: new Date().toISOString() });
    return sendSuccess(res, { message: 'Download tracked successfully', data: {} });
  } catch (error) {
    console.error('Error tracking download:', error);
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
    console.error('Get draft error:', error);
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
    console.error('Save draft error:', error);
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
    console.error('Delete draft error:', error);
    return sendError(res, { status: 500, code: 'DELETE_DRAFT_FAILED', message: 'Failed to delete draft' });
  }
};
