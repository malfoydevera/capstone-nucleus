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
      }
    }

    const { data: author } = await supabase.from('users').select('full_name, email').eq('id', userId).single();

    if (!id && facultyId) {
      await supabase.from('notifications').insert([{
        user_id: facultyId, research_id: research.id, type: 'submission',
        title: 'New Research Submission',
        message: `${author?.full_name || author?.email} submitted "${title}" for your review`,
      }]);
    }

    if (id || !facultyId) {
      const { data: staffUsers } = await supabase.from('users').select('id').eq('role', 'staff');
      if (staffUsers?.length > 0) {
        await supabase.from('notifications').insert(
          staffUsers.map(staff => ({
            user_id: staff.id, research_id: research.id, type: 'submission',
            title: id ? 'Research Revised' : 'New Research Submission',
            message: `${author?.full_name || author?.email} ${id ? 'resubmitted' : 'submitted'} "${title}" for review`,
          }))
        );
      }
    }

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
      .from('research_papers').select('*').eq('author_id', req.user.id).order('created_at', { ascending: false });
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
      author:users!author_id (id, full_name, email, program, department)
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
      authorName: p.author?.full_name || null,
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
      *, author:users!author_id (id, full_name, email),
      research_authors!research_authors_research_id_fkey (
        user_id, is_primary, author_order,
        author:users!research_authors_user_id_fkey (id, full_name, email)
      )
    `).eq('status', 'approved').order('published_date', { ascending: false });

    if (category) query = query.eq('category', category);
    if (search) query = query.or(`title.ilike.%${search}%,abstract.ilike.%${search}%`);
    if (year) query = query.gte('published_date', `${year}-01-01`).lte('published_date', `${year}-12-31`);

    const { data: papers, error } = await query;
    if (error) throw error;

    let transformed = await Promise.all((papers || []).map(async p => ({
      ...p, users: p.author, co_authors: p.research_authors || [], file_url: await resolvePaperFileUrl(p),
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
      let query = supabase.from('users').select('id, full_name, email, department').eq('role', 'faculty').order('full_name');
      if (department) query = query.eq('department', department);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    });
    return sendSuccess(res, { data: { facultyMembers } });
  } catch (error) {
    console.error('Get faculty members error:', error);
    return sendError(res, { status: 500, code: 'GET_FACULTY_MEMBERS_FAILED', message: 'Server error' });
  }
};

exports.getDeanChairMembers = async (req, res) => {
  try {
    const members = await getOrSet('dean_chair:all', TTL.DEAN_CHAIR, async () => {
      const { data, error } = await supabase
        .from('users').select('id, full_name, email, role, department').in('role', ['dean', 'program_chair']).order('role').order('full_name');
      if (error) throw error;
      return data;
    });
    return sendSuccess(res, { data: { members } });
  } catch (error) {
    console.error('Get dean/chair members error:', error);
    return sendError(res, { status: 500, code: 'GET_DEAN_CHAIR_MEMBERS_FAILED', message: 'Server error' });
  }
};

exports.getResearchById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: paper, error } = await supabase
      .from('research_papers').select('*, author:users!author_id (id, full_name, email)').eq('id', id).single();
    if (error || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    if (!canAccessPaper(req.user, paper)) return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' });
    return sendSuccess(res, { data: { paper: { ...paper, users: paper.author, file_url: await resolvePaperFileUrl(paper) } } });
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
