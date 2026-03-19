const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const { logAuditEvent } = require('../utils/audit');
const {
  canAccessPaper,
  extractStoragePathFromUrl,
  isPublicPaperStatus,
  resolvePaperFileUrl,
} = require('../utils/fileAccess');
const {
  WORKFLOW_POLICY,
  validateWorkflowAction,
} = require('../utils/workflowPolicy');
const { sendSuccess, sendError } = require('../utils/response');

// Submit new research or update existing revision
exports.submitResearch = async (req, res) => {
  try {
    const { id, title, abstract, keywords, coAuthors, category, facultyId, department } = req.body;
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
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${userId}/${uuidv4()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('research-papers')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: true 
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return sendError(res, { status: 500, code: 'FILE_UPLOAD_FAILED', message: 'Failed to upload file' });
      }

      const publicUrl = supabase.getPublicFileUrl(fileName);

      fileData = {
        file_url: publicUrl,
        file_storage_path: fileName,
        file_name: file.originalname,
        file_size: file.size
      };
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
      department: department || null,
      // Status logic:
      // - New submission with faculty: pending_faculty
      // - New submission without faculty: pending
      // - Resubmission: return to the stage that requested revision
      status: id ? undefined : (facultyId ? 'pending_faculty' : 'pending'),
      ...fileData
    };

    let { data: research, error: dbError } = await supabase
      .from('research_papers')
      .upsert(basePayload)
      .select()
      .single();

    // Backward compatibility for databases where migration for file_storage_path is not applied yet.
    if (dbError?.message?.includes('file_storage_path')) {
      const fallbackPayload = { ...basePayload };
      delete fallbackPayload.file_storage_path;

      const fallbackResult = await supabase
        .from('research_papers')
        .upsert(fallbackPayload)
        .select()
        .single();

      research = fallbackResult.data;
      dbError = fallbackResult.error;
    }

    if (dbError) {
      console.error('=== DATABASE ERROR DETAILS ===');
      console.error('Error message:', dbError.message);
      console.error('Error code:', dbError.code);
      console.error('Error details:', dbError.details);
      console.error('Error hint:', dbError.hint);
      console.error('Full error:', JSON.stringify(dbError, null, 2));
      return sendError(res, {
        status: 500,
        code: 'SAVE_RESEARCH_FAILED',
        message: 'Failed to save research data',
        details: dbError.message,
      });
    }

    // Handle co-authors - parse coAuthorIds from request
    let coAuthorIds = [];
    try {
      if (req.body.coAuthorIds) {
        // If it's a string, parse it; if it's already an array, use it
        coAuthorIds = typeof req.body.coAuthorIds === 'string' 
          ? JSON.parse(req.body.coAuthorIds) 
          : req.body.coAuthorIds;
      }
    } catch (parseError) {
      console.error('Error parsing coAuthorIds:', parseError);
      coAuthorIds = [];
    }
    
    if (coAuthorIds.length > 0) {
      try {
        // Delete existing co-authors for resubmission
        if (id) {
          await supabase
            .from('research_authors')
            .delete()
            .eq('research_id', research.id)
            .neq('is_primary', true);
        }

        // Insert primary author first (the submitter)
        const { error: primaryError } = await supabase
          .from('research_authors')
          .upsert({
            research_id: research.id,
            user_id: userId,
            author_order: 0,
            is_primary: true
          }, {
            onConflict: 'research_id,user_id'
          });

        if (primaryError) {
          console.error('Error inserting primary author:', primaryError);
        }

        // Insert co-authors
        const coAuthorsData = coAuthorIds.map((authorId, index) => ({
          research_id: research.id,
          user_id: authorId,
          author_order: index + 1,
          is_primary: false
        }));

        const { error: authorsError } = await supabase
          .from('research_authors')
          .upsert(coAuthorsData, {
            onConflict: 'research_id,user_id'
          });

        if (authorsError) {
          console.error('Error inserting co-authors:', authorsError);
        }
      } catch (authorTableError) {
        // If table doesn't exist yet, just log and continue
        console.log('Note: research_authors table may not exist yet. Run migration to enable co-author feature.');
        console.error('Author table error:', authorTableError);
      }
    } else {
      // Just insert primary author
      try {
        await supabase
          .from('research_authors')
          .upsert({
            research_id: research.id,
            user_id: userId,
            author_order: 0,
            is_primary: true
          }, {
            onConflict: 'research_id,user_id'
          });
      } catch (authorTableError) {
        // If table doesn't exist yet, just log and continue
        console.log('Note: research_authors table may not exist yet. Run migration to enable co-author feature.');
      }
    }

    // Handle revision resubmission - return paper to the appropriate reviewer
    if (id) {
      const { data: existingPaper } = await supabase
        .from('research_papers')
        .select('status, last_reviewer_role, previous_status, faculty_id')
        .eq('id', id)
        .single();

      if (existingPaper && existingPaper.status === 'revision_required') {
        // Determine where to return the paper based on who requested the revision
        let newStatus;
        const lastReviewerRole = existingPaper.last_reviewer_role;
        const previousStatus = existingPaper.previous_status;

        if (lastReviewerRole === 'faculty') {
          newStatus = 'pending_faculty';
        } else if (lastReviewerRole === 'dean') {
          newStatus = 'pending_dean';
        } else if (lastReviewerRole === 'program_chair') {
          newStatus = 'pending_program_chair';
        } else if (lastReviewerRole === 'staff') {
          newStatus = 'pending_editor';
        } else if (lastReviewerRole === 'admin') {
          newStatus = 'pending_admin';
        } else if (previousStatus) {
          // Fallback to previous status if last_reviewer_role is not set
          newStatus = previousStatus;
        } else if (existingPaper.faculty_id) {
          // Default: if faculty is assigned, go back to faculty
          newStatus = 'pending_faculty';
        } else {
          // Legacy papers without faculty
          newStatus = 'pending';
        }

        console.log(`Resubmission: Returning paper ${id} from revision_required to ${newStatus}`);

        // Update the status
        await supabase
          .from('research_papers')
          .update({ 
            status: newStatus,
            revision_notes: null,
            last_reviewer_role: null,
            previous_status: null
          })
          .eq('id', id);
      }
    }

    const { data: author } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', userId)
      .single();

    // Notify the assigned faculty member for new submissions
    if (!id && facultyId) {
      await supabase.from('notifications').insert([{
        user_id: facultyId,
        research_id: research.id,
        type: 'submission',
        title: 'New Research Submission',
        message: `${author?.full_name || author?.email} submitted "${title}" for your review`
      }]);
    }
    
    // Notify staff for revisions or if no faculty assigned (legacy flow)
    if (id || !facultyId) {
      const { data: staffUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'staff');

      if (staffUsers && staffUsers.length > 0) {
        const notifications = staffUsers.map(staff => ({
          user_id: staff.id,
          research_id: research.id,
          type: 'submission',
          title: id ? 'Research Revised' : 'New Research Submission',
          message: `${author?.full_name || author?.email} ${id ? 'resubmitted' : 'submitted'} "${title}" for review`
        }));

        await supabase.from('notifications').insert(notifications);
      }
    }

    const researchWithAccessUrl = {
      ...research,
      file_url: await resolvePaperFileUrl(research),
    };

    return sendSuccess(res, {
      status: id ? 200 : 201,
      message: id ? 'Research updated successfully' : 'Research submitted successfully',
      data: {
        research: researchWithAccessUrl,
      },
    });
  } catch (error) {
    console.error('Submit research error:', error);
    return sendError(res, { status: 500, code: 'SUBMIT_RESEARCH_FAILED', message: 'Server error' });
  }
};

// Get user's research papers
exports.getMyResearch = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: papers, error } = await supabase
      .from('research_papers')
      .select('*')
      .eq('author_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const papersWithAccessUrls = await Promise.all(
      (papers || []).map(async (paper) => ({
        ...paper,
        file_url: await resolvePaperFileUrl(paper),
      }))
    );

    return sendSuccess(res, { data: { papers: papersWithAccessUrls } });
  } catch (error) {
    console.error('Get my research error:', error);
    return sendError(res, { status: 500, code: 'GET_MY_RESEARCH_FAILED', message: 'Server error' });
  }
};

// Get profile records and stats for any account type
exports.getProfileResearchData = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const {
      title,
      startDate,
      endDate,
      department,
      program,
      details,
      status,
    } = req.query;

    let query = supabase
      .from('research_papers')
      .select(`
        id,
        title,
        abstract,
        category,
        status,
        department,
        keywords,
        co_authors,
        author_id,
        faculty_id,
        dean_chair_id,
        created_at,
        submission_date,
        published_date,
        author:users!author_id (id, full_name, email, program, department)
      `)
      .order('created_at', { ascending: false });

    if (role === 'student') {
      query = query.eq('author_id', userId);
    } else if (role === 'faculty') {
      query = query.eq('faculty_id', userId);
    } else if (role === 'dean' || role === 'program_chair') {
      query = query.eq('dean_chair_id', userId);
    }

    if (title) {
      query = query.ilike('title', `%${title}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (department) {
      query = query.eq('department', department);
    }

    if (startDate) {
      query = query.gte('submission_date', startDate);
    }

    if (endDate) {
      query = query.lte('submission_date', endDate);
    }

    if (details) {
      const safe = String(details).replace(/,/g, ' ');
      query = query.or(
        `title.ilike.%${safe}%,abstract.ilike.%${safe}%,category.ilike.%${safe}%,co_authors.ilike.%${safe}%`
      );
    }

    const { data: papers, error } = await query;
    if (error) throw error;

    let filtered = papers || [];

    if (program) {
      const normalizedProgram = String(program).toLowerCase();
      filtered = filtered.filter((paper) =>
        String(paper.author?.program || '').toLowerCase() === normalizedProgram
      );
    }

    const uploadedCount = filtered.filter((paper) => paper.author_id === userId).length;
    const publishedCount = filtered.filter(
      (paper) =>
        paper.author_id === userId && ['approved', 'published'].includes(paper.status)
    ).length;

    const records = filtered.map((paper) => ({
      id: paper.id,
      title: paper.title,
      category: paper.category,
      status: paper.status,
      department: paper.department || paper.author?.department || null,
      program: paper.author?.program || null,
      submissionDate: paper.submission_date || paper.created_at,
      publishedDate: paper.published_date,
      authorName: paper.author?.full_name || null,
      authorEmail: paper.author?.email || null,
      details: {
        abstract: paper.abstract,
        keywords: paper.keywords || [],
        coAuthors: paper.co_authors || null,
      },
    }));

    return sendSuccess(res, {
      data: {
        profile: {
          userId,
          role,
        },
        stats: {
          totalRecords: records.length,
          uploadedCount,
          publishedCount,
        },
        records,
      },
    });
  } catch (error) {
    console.error('Get profile research data error:', error);
    return sendError(res, {
      status: 500,
      code: 'GET_PROFILE_DATA_FAILED',
      message: 'Failed to fetch profile data',
    });
  }
};

exports.getPaperAnnotations = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: paper, error: paperError } = await supabase
      .from('research_papers')
      .select('id, status, author_id, faculty_id, dean_chair_id')
      .eq('id', id)
      .single();

    if (paperError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    }

    if (!canAccessPaper(req.user, paper)) {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied for this research paper' });
    }

    const { data: annotations, error } = await supabase
      .from('research_comments')
      .select('id, comment, created_at, user_id, is_internal, user:users!research_comments_user_id_fkey (full_name, role)')
      .eq('research_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const result = (annotations || [])
      .filter((item) => !item.is_internal || ['faculty', 'dean', 'program_chair', 'staff', 'admin'].includes(req.user.role))
      .map((item) => {
        const commentText = String(item.comment || '');
        const metaStart = commentText.indexOf('[[meta]]');
        const metaEnd = commentText.indexOf('[[/meta]]');
        let metadata = {};
        let body = commentText;

        if (metaStart === 0 && metaEnd > 8) {
          const rawMeta = commentText.slice(8, metaEnd);
          try {
            metadata = JSON.parse(rawMeta);
          } catch (_err) {
            metadata = {};
          }
          body = commentText.slice(metaEnd + 9).trim();
        }

        return {
          id: item.id,
          userId: item.user_id,
          note: body,
          annotationType: metadata.annotationType || 'comment',
          highlightColor: metadata.highlightColor || null,
          pageNumber: metadata.pageNumber || null,
          sectionLabel: metadata.sectionLabel || null,
          selectedText: metadata.selectedText || null,
          createdAt: item.created_at,
          reviewerName: item.user?.full_name || 'Reviewer',
          reviewerRole: item.user?.role || null,
        };
      });

    return sendSuccess(res, { data: { annotations: result } });
  } catch (error) {
    console.error('Get paper annotations error:', error);
    return sendError(res, { status: 500, code: 'GET_ANNOTATIONS_FAILED', message: 'Failed to fetch annotations' });
  }
};

exports.addPaperAnnotation = async (req, res) => {
  try {
    const { id } = req.params;
    const { note, pageNumber, sectionLabel, selectedText, annotationType, highlightColor } = req.body;

    const validTypes = ['highlight', 'comment', 'note'];
    const type = validTypes.includes(annotationType) ? annotationType : 'comment';

    // Highlights may have an empty note (just the highlighted text), but comments/notes require one
    if (type !== 'highlight' && (!note || !String(note).trim())) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Annotation note is required' });
    }

    const { data: paper, error: paperError } = await supabase
      .from('research_papers')
      .select('id, status, author_id, faculty_id, dean_chair_id')
      .eq('id', id)
      .single();

    if (paperError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    }

    if (!canAccessPaper(req.user, paper)) {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied for this research paper' });
    }

    const metadata = {
      annotationType: type,
      highlightColor: highlightColor || null,
      pageNumber: pageNumber || null,
      sectionLabel: sectionLabel || null,
      selectedText: selectedText || null,
    };

    const noteText = note ? String(note).trim() : '';
    const payloadComment = `[[meta]]${JSON.stringify(metadata)}[[/meta]]\n${noteText}`;

    const { data, error } = await supabase
      .from('research_comments')
      .insert({
        research_id: id,
        user_id: req.user.id,
        comment: payloadComment,
        is_internal: false,
      })
      .select('id, comment, created_at')
      .single();

    if (error) throw error;

    return sendSuccess(res, {
      status: 201,
      message: 'Annotation added successfully',
      data: {
        annotation: {
          id: data.id,
          note: noteText,
          annotationType: type,
          highlightColor: metadata.highlightColor,
          pageNumber: metadata.pageNumber,
          sectionLabel: metadata.sectionLabel,
          selectedText: metadata.selectedText,
          createdAt: data.created_at,
        },
      },
    });
  } catch (error) {
    console.error('Add paper annotation error:', error);
    return sendError(res, { status: 500, code: 'ADD_ANNOTATION_FAILED', message: 'Failed to add annotation' });
  }
};

exports.deletePaperAnnotation = async (req, res) => {
  try {
    const { id, annotationId } = req.params;

    const { data: paper, error: paperError } = await supabase
      .from('research_papers')
      .select('id, status, author_id, faculty_id, dean_chair_id')
      .eq('id', id)
      .single();

    if (paperError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    }

    if (!canAccessPaper(req.user, paper)) {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied for this research paper' });
    }

    // Verify the annotation exists and belongs to the requesting user
    const { data: annotation, error: annoError } = await supabase
      .from('research_comments')
      .select('id, user_id')
      .eq('id', annotationId)
      .eq('research_id', id)
      .single();

    if (annoError || !annotation) {
      return sendError(res, { status: 404, code: 'ANNOTATION_NOT_FOUND', message: 'Annotation not found' });
    }

    // Only the creator or an admin can delete
    if (annotation.user_id !== req.user.id && req.user.role !== 'admin') {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'You can only delete your own annotations' });
    }

    const { error: deleteError } = await supabase
      .from('research_comments')
      .delete()
      .eq('id', annotationId);

    if (deleteError) throw deleteError;

    return sendSuccess(res, { message: 'Annotation deleted successfully' });
  } catch (error) {
    console.error('Delete paper annotation error:', error);
    return sendError(res, { status: 500, code: 'DELETE_ANNOTATION_FAILED', message: 'Failed to delete annotation' });
  }
};

// Get all research papers (staff/admin)
exports.getAllResearch = async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase
      .from('research_papers')
      .select(`*, author:users!author_id (id, full_name, email)`)
      .order('submission_date', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data: papers, error } = await query;
    if (error) throw error;

    const transformedPapers = await Promise.all(
      (papers || []).map(async (paper) => ({
        ...paper,
        users: paper.author,
        file_url: await resolvePaperFileUrl(paper),
      }))
    );
    return sendSuccess(res, { data: { papers: transformedPapers } });
  } catch (error) {
    console.error('Get all research error:', error);
    return sendError(res, { status: 500, code: 'GET_ALL_RESEARCH_FAILED', message: 'Server error' });
  }
};

// Get single research paper
exports.getResearchById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: paper, error } = await supabase
      .from('research_papers')
      .select(`*, author:users!author_id (id, full_name, email)`)
      .eq('id', id)
      .single();

    if (error || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    }

    if (!canAccessPaper(req.user, paper)) {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied for this research paper' });
    }

    const transformedPaper = {
      ...paper,
      users: paper.author,
      file_url: await resolvePaperFileUrl(paper),
    };
    return sendSuccess(res, { data: { paper: transformedPaper } });
  } catch (error) {
    console.error('Get research error:', error);
    return sendError(res, { status: 500, code: 'GET_RESEARCH_BY_ID_FAILED', message: 'Server error' });
  }
};

// Resolve a paper file URL for authorized users.
exports.getResearchFile = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: paper, error } = await supabase
      .from('research_papers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    }

    if (!canAccessPaper(req.user, paper)) {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied for this research paper' });
    }

    const fileUrl = await resolvePaperFileUrl(paper);

    if (!fileUrl) {
      return sendError(res, { status: 400, code: 'FILE_UNAVAILABLE', message: 'Paper file is not available' });
    }

    return sendSuccess(res, {
      data: {
        fileUrl,
        isSigned: !isPublicPaperStatus(paper.status),
        source: paper.file_storage_path ? 'storage_path' : 'file_url',
        storagePath: paper.file_storage_path || extractStoragePathFromUrl(paper.file_url),
      },
    });
  } catch (error) {
    console.error('Get research file error:', error);
    return sendError(res, { status: 500, code: 'GET_RESEARCH_FILE_FAILED', message: 'Server error' });
  }
};

// Track research view (Explicit tracking for paper_views table)
exports.trackView = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: paper, error: paperError } = await supabase
      .from('research_papers')
      .select('id, status, author_id, faculty_id, dean_chair_id')
      .eq('id', id)
      .single();

    if (paperError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    }

    if (!canAccessPaper(req.user, paper)) {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied for this research paper' });
    }

    // Use await to ensure the RPC call completes before moving forward
    const { error: updateError } = await supabase.rpc('increment_view_count', { row_id: id });
    if (updateError) throw updateError;

    // Insert into detailed tracking table
    await supabase
      .from('paper_views')
      .insert({
        paper_id: id,
        user_id: userId,
        viewed_at: new Date().toISOString()
      });

    return sendSuccess(res, { message: 'View tracked successfully', data: {} });
  } catch (error) {
    console.error('Error tracking view:', error);
    return sendError(res, { status: 500, code: 'TRACK_VIEW_FAILED', message: 'Failed to track view' });
  }
};

// Track research download
exports.trackDownload = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: paper, error: paperError } = await supabase
      .from('research_papers')
      .select('id, status, author_id, faculty_id, dean_chair_id')
      .eq('id', id)
      .single();

    if (paperError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    }

    if (!canAccessPaper(req.user, paper)) {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied for this research paper' });
    }

    // Use await for incrementing
    const { error: updateError } = await supabase.rpc('increment_download_count', { row_id: id });
    if (updateError) throw updateError;

    // Insert into detailed tracking table
    await supabase
      .from('paper_downloads')
      .insert({
        paper_id: id,
        user_id: userId,
        downloaded_at: new Date().toISOString()
      });

    return sendSuccess(res, { message: 'Download tracked successfully', data: {} });
  } catch (error) {
    console.error('Error tracking download:', error);
    return sendError(res, { status: 500, code: 'TRACK_DOWNLOAD_FAILED', message: 'Failed to track download' });
  }
};

// Admin: Get all research with full details
exports.adminGetAllResearch = async (req, res) => {
  try {
    const { data: papers, error } = await supabase
      .from('research_papers')
      .select(`*, author:users!author_id (id, full_name, email, role), reviews:approval_workflow(*)`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const transformedPapers = papers.map(paper => ({ ...paper, users: paper.author }));
    return sendSuccess(res, { data: { papers: transformedPapers } });
  } catch (error) {
    console.error('Admin fetch error:', error);
    return sendError(res, { status: 500, code: 'ADMIN_GET_ALL_RESEARCH_FAILED', message: 'Failed to fetch research data' });
  }
};

// Admin: Update research
exports.adminUpdateResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const { data: updatedPaper, error: updateError } = await supabase
      .from('research_papers')
      .update(updateData)
      .eq('id', id)
      .select(`*, author:users!author_id (id, full_name, email)`)
      .single();

    if (updateError) throw updateError;

    return sendSuccess(res, {
      message: 'Research updated successfully',
      data: {
        paper: { ...updatedPaper, users: updatedPaper.author },
      },
    });
  } catch (error) {
    console.error('Admin update error:', error);
    return sendError(res, { status: 500, code: 'ADMIN_UPDATE_RESEARCH_FAILED', message: 'Failed to update research' });
  }
};

// Admin: Delete research
exports.adminDeleteResearch = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Deletions are handled by ON DELETE CASCADE in your SQL schema
    const { error: deleteError } = await supabase
      .from('research_papers')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return sendSuccess(res, { message: 'Research deleted successfully', data: {} });
  } catch (error) {
    console.error('Admin delete error:', error);
    return sendError(res, { status: 500, code: 'ADMIN_DELETE_RESEARCH_FAILED', message: 'Failed to delete research' });
  }
};

// Admin: Publish research
exports.adminPublishResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: publishedPaper, error: updateError } = await supabase
      .from('research_papers')
      .update({ 
        status: 'published',
        is_published: true,
        published_date: new Date().toISOString()
      })
      .eq('id', id)
      .select(`*, author:users!author_id (id, full_name, email)`)
      .single();

    if (updateError) throw updateError;

    await supabase.from('notifications').insert([{
      user_id: publishedPaper.author_id,
      research_id: id,
      type: 'publication',
      title: 'Research Published',
      message: `Congratulations! Your research "${publishedPaper.title}" is now available.`
    }]);

    return sendSuccess(res, { data: { paper: { ...publishedPaper, users: publishedPaper.author } } });
  } catch (error) {
    console.error('Publish error:', error);
    return sendError(res, { status: 500, code: 'ADMIN_PUBLISH_RESEARCH_FAILED', message: 'Failed to publish research' });
  }
};

// Admin: Unpublish research
exports.adminUnpublishResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: unpublishedPaper, error: updateError } = await supabase
      .from('research_papers')
      .update({ 
        status: 'approved',
        is_published: false,
        published_date: null
      })
      .eq('id', id)
      .select(`*, author:users!author_id (id, full_name, email)`)
      .single();

    if (updateError) throw updateError;

    return sendSuccess(res, { data: { paper: { ...unpublishedPaper, users: unpublishedPaper.author } } });
  } catch (error) {
    console.error('Unpublish error:', error);
    return sendError(res, { status: 500, code: 'ADMIN_UNPUBLISH_RESEARCH_FAILED', message: 'Failed to unpublish research' });
  }
};

// Approve research - Updated for sequential workflow
exports.approveResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const reviewerId = req.user.id;
    const reviewerRole = req.user.role;

    const { data: paper, error: fetchError } = await supabase
      .from('research_papers')
      .select('*, author:users!author_id(full_name, email)')
      .eq('id', id)
      .single();

    if (fetchError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    }

    const approveValidation = validateWorkflowAction('approve', req.user, paper);
    if (!approveValidation.ok) {
      return sendError(res, {
        status: approveValidation.code,
        code: 'INVALID_WORKFLOW_TRANSITION',
        message: approveValidation.error,
        details: JSON.stringify({ currentStatus: paper.status, yourRole: reviewerRole }),
      });
    }

    let newStatus;
    let notificationMessage;
    let nextReviewers = [];
    let extraUpdate = {}; // additional fields to write on update

    // Sequential approval workflow:
    // Adviser (faculty) → Dean OR Program Chair → Research Editor (staff) → Admin
    if (reviewerRole === 'faculty' && paper.status === 'pending_faculty') {
      // Adviser approves: must specify which Dean or Program Chair to forward to
      const { targetUserId, targetRole } = req.body;

      if (!targetUserId || !targetRole) {
        return sendError(res, {
          status: 400,
          code: 'INVALID_INPUT',
          message: 'targetUserId and targetRole are required when adviser approves a paper.'
        });
      }
      if (!['dean', 'program_chair'].includes(targetRole)) {
        return sendError(res, {
          status: 400,
          code: 'INVALID_TARGET_ROLE',
          message: 'targetRole must be either "dean" or "program_chair".'
        });
      }

      // Verify the target user actually has the claimed role
      const { data: targetUser } = await supabase
        .from('users')
        .select('id, full_name, role')
        .eq('id', targetUserId)
        .eq('role', targetRole)
        .single();

      if (!targetUser) {
        return sendError(res, {
          status: 400,
          code: 'INVALID_TARGET_REVIEWER',
          message: 'Target reviewer not found or does not have the specified role.'
        });
      }

      newStatus = targetRole === 'dean' ? 'pending_dean' : 'pending_program_chair';
      extraUpdate.dean_chair_id = targetUserId;
      notificationMessage = 'Your research has been approved by your adviser and is now pending Dean/Program Chair review';

      nextReviewers = [targetUserId];
    } else if (reviewerRole === 'dean' && paper.status === 'pending_dean') {
      // Dean approves: move to Research Editor
      newStatus = 'pending_editor';
      notificationMessage = 'Your research has been approved by the Dean and is now under Research Editor review';

      const { data: staffUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'staff');

      if (staffUsers) nextReviewers = staffUsers.map(s => s.id);
    } else if (reviewerRole === 'program_chair' && paper.status === 'pending_program_chair') {
      // Program Chair approves: move to Research Editor
      newStatus = 'pending_editor';
      notificationMessage = 'Your research has been approved by the Program Chair and is now under Research Editor review';

      const { data: staffUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'staff');

      if (staffUsers) nextReviewers = staffUsers.map(s => s.id);
    } else if (reviewerRole === 'staff' && paper.status === 'pending_editor') {
      // Research Editor approves: move to Admin review
      newStatus = 'pending_admin';
      notificationMessage = 'Your research has been approved by the Research Editor and is awaiting final Admin approval';

      const { data: adminUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin');

      if (adminUsers) nextReviewers = adminUsers.map(a => a.id);
    } else if (reviewerRole === 'admin' && (paper.status === 'pending_admin' || paper.status === 'under_review')) {
      // Admin final approval
      newStatus = 'approved';
      notificationMessage = 'Congratulations! Your research has been approved and published';
    }

    console.log('=== BACKEND: Approval Process ===');
    console.log('Paper ID:', id);
    console.log('Current status:', paper.status);
    console.log('Reviewer role:', reviewerRole);
    console.log('New status:', newStatus);

    // Update paper status
    const { data: updateData, error: updateError } = await supabase
      .from('research_papers')
      .update({ 
        status: newStatus,
        published_date: newStatus === 'approved' ? new Date().toISOString() : null,
        ...extraUpdate
      })
      .eq('id', id)
      .select();

    if (updateError) {
      console.error('Database update error:', updateError);
      return sendError(res, {
        status: 500,
        code: 'UPDATE_PAPER_STATUS_FAILED',
        message: 'Failed to update paper status',
        details: updateError.message,
      });
    }

    console.log('Update successful. Updated paper:', updateData);

    // Record approval in workflow (optional - skip if table doesn't exist)
    try {
      await supabase.from('approval_workflow').insert([{
        research_id: id, 
        reviewer_id: reviewerId, 
        reviewer_role: reviewerRole, 
        status: 'approved', 
        comments: comments || null
      }]);
    } catch (workflowError) {
      console.log('Approval workflow table not available, skipping...', workflowError.message);
    }

    // Audit log
    await logAuditEvent({
      userId: reviewerId,
      userRole: reviewerRole,
      action: 'approve',
      targetType: 'research_paper',
      targetId: id,
      details: { previousStatus: paper.status, newStatus, paperTitle: paper.title },
    });

    // Notify author (optional - skip if table doesn't exist)
    try {
      await supabase.from('notifications').insert([{
        user_id: paper.author_id, 
        research_id: id, 
        type: 'approval', 
        title: 'Research Approved', 
        message: notificationMessage
      }]);
    } catch (notifError) {
      console.log('Notifications table not available, skipping...', notifError.message);
    }

    // Notify next reviewers in the workflow (optional)
    if (nextReviewers.length > 0) {
      try {
        const nextNotifications = nextReviewers.map(reviewerId => ({
          user_id: reviewerId,
          research_id: id,
          type: 'review_request',
          title: 'New Research for Review',
          message: `Research "${paper.title}" is ready for your review`
        }));
        
        await supabase.from('notifications').insert(nextNotifications);
      } catch (notifError) {
        console.log('Could not send notifications to next reviewers:', notifError.message);
      }
    }

    return sendSuccess(res, {
      message: 'Research approved successfully',
      data: {
        status: newStatus,
        nextStage: newStatus === 'approved' ? 'Published' :
          newStatus === 'pending_editor' ? 'Editor Review' :
            newStatus === 'pending_admin' ? 'Admin Review' : 'Unknown',
      },
    });
  } catch (error) {
    console.error('=== APPROVE ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error:', error);
    return sendError(res, {
      status: 500,
      code: 'APPROVE_RESEARCH_FAILED',
      message: 'Server error',
      details: error.message,
    });
  }
};

// Reject research
exports.rejectResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason?.trim()) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Rejection reason is required' });
    }

    const { data: paper, error: fetchError } = await supabase
      .from('research_papers')
      .select('author_id, title, status, faculty_id, dean_chair_id')
      .eq('id', id)
      .single();
    
    if (fetchError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Paper not found' });
    }

    const rejectValidation = validateWorkflowAction('reject', req.user, paper);
    if (!rejectValidation.ok) {
      return sendError(res, {
        status: rejectValidation.code,
        code: 'INVALID_WORKFLOW_TRANSITION',
        message: rejectValidation.error,
        details: JSON.stringify({ currentStatus: paper.status, yourRole: req.user.role }),
      });
    }
    
    const { error: updateError } = await supabase
      .from('research_papers')
      .update({ status: 'rejected', rejection_reason: reason.trim() })
      .eq('id', id);
    
    if (updateError) {
      console.error('Reject update error:', updateError);
      return sendError(res, { status: 500, code: 'REJECT_RESEARCH_FAILED', message: 'Failed to reject paper' });
    }
    
    // Try to insert into approval_workflow if table exists
    try {
      await supabase.from('approval_workflow').insert([{
        research_id: id, 
        reviewer_id: req.user.id, 
        reviewer_role: req.user.role, 
        status: 'rejected', 
        comments: reason
      }]);
    } catch (workflowError) {
      console.log('Approval workflow insert skipped:', workflowError.message);
    }

    // Audit log
    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: 'reject',
      targetType: 'research_paper',
      targetId: id,
      details: { paperTitle: paper.title, reason },
    });

    return sendSuccess(res, { message: 'Research rejected successfully', data: {} });
  } catch (error) {
    console.error('Reject research error:', error);
    return sendError(res, { status: 500, code: 'REJECT_RESEARCH_FAILED', message: 'Server error', details: error.message });
  }
};

// Request revision
exports.requestRevision = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const reviewerRole = req.user.role;
    
    console.log('=== BACKEND: Request Revision ===');
    console.log('Paper ID:', id);
    console.log('Reviewer role:', reviewerRole);
    console.log('Revision notes:', notes);
    
    if (!notes) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Revision notes are required' });
    }

    // Get current paper to check its status
    const { data: paper, error: fetchError } = await supabase
      .from('research_papers')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !paper) {
      console.error('Paper not found:', fetchError);
      return sendError(res, {
        status: 404,
        code: 'PAPER_NOT_FOUND',
        message: 'Paper not found',
        details: fetchError?.message,
      });
    }

    const revisionValidation = validateWorkflowAction('revision', req.user, paper);
    if (!revisionValidation.ok) {
      return sendError(res, {
        status: revisionValidation.code,
        code: 'INVALID_WORKFLOW_TRANSITION',
        message: revisionValidation.error,
        details: JSON.stringify({ currentStatus: paper.status, yourRole: reviewerRole }),
      });
    }

    console.log('Current paper status:', paper.status);

    // Determine new status and notification recipient based on reviewer role
    let newStatus;
    let notificationUserId;
    let notificationTitle;
    let notificationMessage;

    if (reviewerRole === 'faculty' && paper.status === 'pending_faculty') {
      // Adviser sends directly to student for revision
      newStatus = 'revision_required';
      notificationUserId = paper.author_id;
      notificationTitle = `Revision Required: ${paper.title}`;
      notificationMessage = `Your adviser requires revisions. Notes: ${notes}`;
      console.log('Flow: Adviser → Student (revision required)');
    }
    else if (
      (reviewerRole === 'dean' && paper.status === 'pending_dean') ||
      (reviewerRole === 'program_chair' && paper.status === 'pending_program_chair')
    ) {
      // Dean / Program Chair sends back to student for revision
      newStatus = 'revision_required';
      notificationUserId = paper.author_id;
      const roleLabel = reviewerRole === 'dean' ? 'Dean' : 'Program Chair';
      notificationTitle = `Revision Required: ${paper.title}`;
      notificationMessage = `The ${roleLabel} requires revisions. Notes: ${notes}`;
      console.log(`Flow: ${roleLabel} → Student (revision required)`);
    }
    else if (reviewerRole === 'staff' && paper.status === 'pending_editor') {
      // Research Editor sends back to Dean/Program Chair (or faculty if no dean_chair_id)
      if (paper.dean_chair_id) {
        // Determine which status to return to based on the assigned reviewer's role
        const { data: deanChairUser } = await supabase
          .from('users')
          .select('role')
          .eq('id', paper.dean_chair_id)
          .single();
        newStatus = deanChairUser?.role === 'dean' ? 'pending_dean' : 'pending_program_chair';
        notificationUserId = paper.dean_chair_id;
      } else {
        newStatus = 'pending_faculty';
        notificationUserId = paper.faculty_id;
      }
      notificationTitle = `Paper Returned for Review: ${paper.title}`;
      notificationMessage = `The Research Editor returned this paper with notes: ${notes}`;
      console.log('Flow: Research Editor → Dean/Program Chair (returned with notes)');
    }
    else if (reviewerRole === 'admin' && paper.status === 'pending_admin') {
      // Admin sends back to Research Editor
      newStatus = 'pending_editor';
      notificationUserId = null; // Notify all staff
      notificationTitle = `Paper Returned for Review: ${paper.title}`;
      notificationMessage = `The Admin returned this paper with notes: ${notes}`;
      console.log('Flow: Admin → Research Editor (returned with notes)');
    }
    else {
      return sendError(res, {
        status: 400,
        code: 'INVALID_WORKFLOW_TRANSITION',
        message: `Cannot request revision from status "${paper.status}" as role "${reviewerRole}"`
      });
    }

    // Update paper with new status and revision notes
    const updateData = { 
      status: newStatus, 
      revision_notes: notes,
      last_reviewer_role: reviewerRole,
      previous_status: paper.status,
      updated_at: new Date().toISOString()
    };

    const { data: updatedPaper, error: updateError } = await supabase
      .from('research_papers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return sendError(res, {
        status: 500,
        code: 'UPDATE_PAPER_STATUS_FAILED',
        message: 'Failed to update paper status',
        details: updateError.message,
      });
    }

    console.log('Paper updated successfully. New status:', updatedPaper.status);
    
    // Create notifications
    if (notificationUserId) {
      // Single recipient (student, faculty, dean, or program_chair)
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: notificationUserId,
          research_id: id,
          type: newStatus === 'revision_required' ? 'revision_required' : 'returned_for_review',
          title: notificationTitle,
          message: notificationMessage
        });
      if (notifError) console.error('Notification error:', notifError);
    } else if (newStatus === 'pending_editor') {
      // Admin returned to Research Editor — notify all staff
      const { data: staffUsers } = await supabase
        .from('users').select('id').eq('role', 'staff');
      if (staffUsers?.length > 0) {
        await supabase.from('notifications').insert(
          staffUsers.map(s => ({
            user_id: s.id,
            research_id: id,
            type: 'returned_for_review',
            title: notificationTitle,
            message: notificationMessage
          }))
        );
      }
    }
    
    // Try to insert into approval_workflow if table exists
    try {
      await supabase.from('approval_workflow').insert([{
        research_id: id, 
        reviewer_id: req.user.id, 
        reviewer_role: reviewerRole, 
        status: newStatus === 'revision_required' ? 'revision_required' : 'returned', 
        comments: notes
      }]);
    } catch (workflowError) {
      console.log('Approval workflow insert skipped:', workflowError.message);
    }

    // Audit log
    await logAuditEvent({
      userId: req.user.id,
      userRole: reviewerRole,
      action: 'revision',
      targetType: 'research_paper',
      targetId: id,
      details: { previousStatus: paper.status, newStatus, paperTitle: paper.title, notes },
    });

    return sendSuccess(res, {
      message: 'Revision requested successfully',
      data: {
        newStatus,
        paper: updatedPaper,
      },
    });
  } catch (error) {
    console.error('=== REQUEST REVISION ERROR ===');
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    return sendError(res, { status: 500, code: 'REQUEST_REVISION_FAILED', message: 'Server error', details: error.message });
  }
};

// Get published research (public)
exports.getPublishedResearch = async (req, res) => {
  try {
    const { category, search, year, author } = req.query;
    
    let query = supabase
      .from('research_papers')
      .select(`
        *, 
        author:users!author_id (id, full_name, email),
        research_authors!research_authors_research_id_fkey (
          user_id,
          is_primary,
          author_order,
          author:users!research_authors_user_id_fkey (id, full_name, email)
        )
      `)
      .eq('status', 'approved')
      .order('published_date', { ascending: false });

    if (category) query = query.eq('category', category);
    if (search) query = query.or(`title.ilike.%${search}%,abstract.ilike.%${search}%`);
    
    // Year filter
    if (year) {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      query = query.gte('published_date', yearStart).lte('published_date', yearEnd);
    }

    const { data: papers, error } = await query;
    if (error) throw error;

    let transformedPapers = await Promise.all(
      (papers || []).map(async (paper) => ({
        ...paper,
        users: paper.author,
        co_authors: paper.research_authors || [],
        file_url: await resolvePaperFileUrl(paper),
      }))
    );

    // Author filter (search across all authors)
    if (author) {
      transformedPapers = transformedPapers.filter(paper => {
        const authorName = author.toLowerCase();
        // Check primary author
        if (paper.users?.full_name?.toLowerCase().includes(authorName)) {
          return true;
        }
        // Check co-authors
        if (paper.co_authors?.some(ca => 
          ca.author?.full_name?.toLowerCase().includes(authorName)
        )) {
          return true;
        }
        return false;
      });
    }

    return sendSuccess(res, { data: { papers: transformedPapers } });
  } catch (error) {
    console.error('Get published research error:', error);
    return sendError(res, { status: 500, code: 'GET_PUBLISHED_RESEARCH_FAILED', message: 'Server error' });
  }
};

// Get research categories
exports.getCategories = async (req, res) => {
  try {
    const { data: categories, error } = await supabase.from('research_categories').select('*').order('name');
    if (error) throw error;
    return sendSuccess(res, { data: { categories } });
  } catch (error) {
    return sendError(res, { status: 500, code: 'GET_CATEGORIES_FAILED', message: 'Server error' });
  }
};

// Get faculty members (for student to select during submission)
exports.getFacultyMembers = async (req, res) => {
  try {
    const { department } = req.query;
    
    let query = supabase
      .from('users')
      .select('id, full_name, email, department')
      .eq('role', 'faculty')
      .order('full_name');
    
    if (department) {
      query = query.eq('department', department);
    }

    const { data: facultyMembers, error } = await query;
    if (error) throw error;
    
    return sendSuccess(res, { data: { facultyMembers } });
  } catch (error) {
    console.error('Get faculty members error:', error);
    return sendError(res, { status: 500, code: 'GET_FACULTY_MEMBERS_FAILED', message: 'Server error' });
  }
};

// Get Dean and Program Chair members (for adviser to pick a target when approving)
exports.getDeanChairMembers = async (req, res) => {
  try {
    const { data: members, error } = await supabase
      .from('users')
      .select('id, full_name, email, role, department')
      .in('role', ['dean', 'program_chair'])
      .order('role')
      .order('full_name');

    if (error) throw error;
    return sendSuccess(res, { data: { members } });
  } catch (error) {
    console.error('Get dean/chair members error:', error);
    return sendError(res, { status: 500, code: 'GET_DEAN_CHAIR_MEMBERS_FAILED', message: 'Server error' });
  }
};

// Get papers assigned to the logged-in Dean or Program Chair
exports.getDeanChairAssignedPapers = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { status } = req.query;

    const pendingStatus = userRole === 'dean' ? 'pending_dean' : 'pending_program_chair';

    let query = supabase
      .from('research_papers')
      .select(`*, author:users!author_id (id, full_name, email)`)
      .eq('dean_chair_id', userId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: papers, error } = await query;
    if (error) throw error;

    const transformedPapers = await Promise.all(
      (papers || []).map(async (paper) => ({
        ...paper,
        users: paper.author,
        file_url: await resolvePaperFileUrl(paper),
      }))
    );
    return sendSuccess(res, { data: { papers: transformedPapers, pendingStatus } });
  } catch (error) {
    console.error('Get dean/chair papers error:', error);
    return sendError(res, { status: 500, code: 'GET_DEAN_CHAIR_PAPERS_FAILED', message: 'Server error' });
  }
};

// Get faculty assigned papers (for faculty dashboard)
exports.getFacultyAssignedPapers = async (req, res) => {
  try {
    const facultyId = req.user.id;
    const { status } = req.query;
    
    let query = supabase
      .from('research_papers')
      .select(`*, author:users!author_id (id, full_name, email)`)
      .eq('faculty_id', facultyId)
      .order('submission_date', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: papers, error } = await query;
    if (error) throw error;

    const transformedPapers = await Promise.all(
      (papers || []).map(async (paper) => ({
        ...paper,
        users: paper.author,
        file_url: await resolvePaperFileUrl(paper),
      }))
    );
    return sendSuccess(res, { data: { papers: transformedPapers } });
  } catch (error) {
    console.error('Get faculty papers error:', error);
    return sendError(res, { status: 500, code: 'GET_FACULTY_PAPERS_FAILED', message: 'Server error' });
  }
};

// ========== DEAN-ONLY FUNCTIONS ==========

// Dean bypass approve — advance a paper from any stage
exports.deanBypassApprove = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, targetStatus } = req.body;
    const deanId = req.user.id;

    if (!reason || !reason.trim()) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'A reason is required for bypass approval' });
    }

    // Valid target statuses for bypass
    const validTargets = WORKFLOW_POLICY.deanBypass.validTargets;
    const target = targetStatus || 'approved';

    if (!validTargets.includes(target)) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_TARGET_STATUS',
        message: `Invalid target status. Must be one of: ${validTargets.join(', ')}`
      });
    }

    // Get current paper
    const { data: paper, error: fetchError } = await supabase
      .from('research_papers')
      .select('*, author:users!author_id(full_name, email)')
      .eq('id', id)
      .single();

    if (fetchError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    }

    // Cannot bypass a paper that is already approved/published/rejected
    if (WORKFLOW_POLICY.deanBypass.blockedStatuses.includes(paper.status)) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_WORKFLOW_TRANSITION',
        message: 'Paper is already finalized and cannot be bypassed'
      });
    }

    const previousStatus = paper.status;

    // Update the paper
    const updateData = {
      status: target,
      bypass_reason: reason,
      bypassed_by: deanId,
      bypassed_at: new Date().toISOString(),
      ...(target === 'approved' ? { published_date: new Date().toISOString() } : {}),
    };

    const { data: updatedPaper, error: updateError } = await supabase
      .from('research_papers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Dean bypass update error:', updateError);
      return sendError(res, { status: 500, code: 'DEAN_BYPASS_FAILED', message: 'Failed to bypass approve paper' });
    }

    // Record in approval_workflow
    try {
      await supabase.from('approval_workflow').insert([{
        research_id: id,
        reviewer_id: deanId,
        reviewer_role: 'dean',
        status: 'bypassed',
        comments: `BYPASS: ${reason}`
      }]);
    } catch (e) {
      console.log('Approval workflow insert skipped:', e.message);
    }

    // Audit log with full details
    await logAuditEvent({
      userId: deanId,
      userRole: 'dean',
      action: 'bypass',
      targetType: 'research_paper',
      targetId: id,
      details: {
        previousStatus,
        newStatus: target,
        paperTitle: paper.title,
        authorName: paper.author?.full_name,
      },
      reason,
    });

    // Notify the author
    try {
      await supabase.from('notifications').insert([{
        user_id: paper.author_id,
        research_id: id,
        type: 'bypass_approval',
        title: 'Research Bypass Approved by Dean',
        message: `The Dean has bypass-approved your research "${paper.title}". Reason: ${reason}`,
      }]);
    } catch (e) {
      console.log('Notification insert skipped:', e.message);
    }

    return sendSuccess(res, {
      message: 'Paper bypass-approved by Dean successfully',
      data: {
        previousStatus,
        newStatus: target,
        paper: updatedPaper,
      },
    });
  } catch (error) {
    console.error('Dean bypass error:', error);
    return sendError(res, { status: 500, code: 'DEAN_BYPASS_FAILED', message: 'Server error', details: error.message });
  }
};

// Dean activity monitor — aggregated data for the Dean's monitoring dashboard
exports.getDeanActivityMonitor = async (req, res) => {
  try {
    // 1. All papers with author info, ordered by most recent
    const { data: allPapers, error: papersError } = await supabase
      .from('research_papers')
      .select('id, title, status, created_at, updated_at, submission_date, bypass_reason, bypassed_by, bypassed_at, dean_chair_id, faculty_id, author:users!author_id(id, full_name, email, role)')
      .order('updated_at', { ascending: false })
      .limit(200);

    if (papersError) throw papersError;

    // 2. Recent approval workflow entries
    let recentActions = [];
    try {
      const { data, error } = await supabase
        .from('approval_workflow')
        .select('*, reviewer:users!approval_workflow_reviewer_id_fkey(full_name, role)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error) recentActions = data || [];
    } catch (e) {
      console.log('approval_workflow query skipped:', e.message);
    }

    // 3. Recent audit logs
    let auditLogs = [];
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error) auditLogs = data || [];
    } catch (e) {
      console.log('audit_logs query skipped:', e.message);
    }

    // 4. Summary statistics
    const papers = allPapers || [];
    const summary = {
      total: papers.length,
      pendingFaculty: papers.filter(p => p.status === 'pending_faculty').length,
      pendingDean: papers.filter(p => p.status === 'pending_dean').length,
      pendingProgramChair: papers.filter(p => p.status === 'pending_program_chair').length,
      pendingEditor: papers.filter(p => p.status === 'pending_editor').length,
      pendingAdmin: papers.filter(p => p.status === 'pending_admin').length,
      approved: papers.filter(p => p.status === 'approved' || p.status === 'published').length,
      rejected: papers.filter(p => p.status === 'rejected').length,
      revisionRequired: papers.filter(p => p.status === 'revision_required').length,
      bypassed: papers.filter(p => p.bypass_reason).length,
    };

    // 5. Program Chair inactivity check — papers assigned to a PC that have been
    //    pending for more than 3 days (configurable via query param)
    const inactivityThresholdDays = parseInt(req.query.inactivityDays) || 3;
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - inactivityThresholdDays);

    const stalePcPapers = papers.filter(p =>
      p.status === 'pending_program_chair' &&
      new Date(p.updated_at || p.created_at) < thresholdDate
    );

    return sendSuccess(res, {
      data: {
        summary,
        papers: papers.map(p => ({ ...p, users: p.author })),
        recentActions,
        auditLogs,
        inactivityAlerts: stalePcPapers.map(p => ({
          ...p,
          users: p.author,
          daysStale: Math.ceil((Date.now() - new Date(p.updated_at || p.created_at)) / 86400000),
        })),
        inactivityThresholdDays,
      },
    });
  } catch (error) {
    console.error('Dean activity monitor error:', error);
    return sendError(res, { status: 500, code: 'GET_DEAN_ACTIVITY_MONITOR_FAILED', message: 'Server error', details: error.message });
  }
};

// Get audit logs — filterable by action, role, date range
exports.getAuditLogs = async (req, res) => {
  try {
    const { action, role, from, to, limit: queryLimit } = req.query;
    const maxLimit = Math.min(parseInt(queryLimit) || 100, 500);

    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(maxLimit);

    if (action) query = query.eq('action', action);
    if (role) query = query.eq('user_role', role);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data: logs, error } = await query;
    if (error) throw error;

    return sendSuccess(res, { data: { logs: logs || [] } });
  } catch (error) {
    console.error('Get audit logs error:', error);
    return sendError(res, { status: 500, code: 'GET_AUDIT_LOGS_FAILED', message: 'Server error' });
  }
};