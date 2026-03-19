/**
 * admin.controller.js — F-002
 * Handles: admin-only CRUD, publish/unpublish, and staff/admin listing.
 */
const supabase = require('../config/supabase');
const { resolvePaperFileUrl } = require('../utils/fileAccess');
const { sendSuccess, sendError } = require('../utils/response');

exports.getAllResearch = async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase.from('research_papers')
      .select('*, author:users!author_id (id, full_name, email)')
      .order('submission_date', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data: papers, error } = await query;
    if (error) throw error;
    const transformed = await Promise.all((papers || []).map(async p => ({ ...p, users: p.author, file_url: await resolvePaperFileUrl(p) })));
    return sendSuccess(res, { data: { papers: transformed } });
  } catch (error) {
    console.error('Get all research error:', error);
    return sendError(res, { status: 500, code: 'GET_ALL_RESEARCH_FAILED', message: 'Server error' });
  }
};

exports.adminGetAllResearch = async (req, res) => {
  try {
    const { data: papers, error } = await supabase.from('research_papers')
      .select('*, author:users!author_id (id, full_name, email, role), reviews:approval_workflow(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return sendSuccess(res, { data: { papers: papers.map(p => ({ ...p, users: p.author })) } });
  } catch (error) {
    console.error('Admin fetch error:', error);
    return sendError(res, { status: 500, code: 'ADMIN_GET_ALL_RESEARCH_FAILED', message: 'Failed to fetch research data' });
  }
};

exports.adminUpdateResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: updatedPaper, error } = await supabase.from('research_papers')
      .update(req.body).eq('id', id)
      .select('*, author:users!author_id (id, full_name, email)').single();
    if (error) throw error;
    return sendSuccess(res, { message: 'Research updated successfully', data: { paper: { ...updatedPaper, users: updatedPaper.author } } });
  } catch (error) {
    console.error('Admin update error:', error);
    return sendError(res, { status: 500, code: 'ADMIN_UPDATE_RESEARCH_FAILED', message: 'Failed to update research' });
  }
};

exports.adminDeleteResearch = async (req, res) => {
  try {
    const { error } = await supabase.from('research_papers').delete().eq('id', req.params.id);
    if (error) throw error;
    return sendSuccess(res, { message: 'Research deleted successfully', data: {} });
  } catch (error) {
    console.error('Admin delete error:', error);
    return sendError(res, { status: 500, code: 'ADMIN_DELETE_RESEARCH_FAILED', message: 'Failed to delete research' });
  }
};

exports.adminPublishResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: publishedPaper, error } = await supabase.from('research_papers')
      .update({ status: 'published', is_published: true, published_date: new Date().toISOString() })
      .eq('id', id).select('*, author:users!author_id (id, full_name, email)').single();
    if (error) throw error;
    await supabase.from('notifications').insert([{
      user_id: publishedPaper.author_id, research_id: id, type: 'publication',
      title: 'Research Published',
      message: `Congratulations! Your research "${publishedPaper.title}" is now available.`,
    }]);
    return sendSuccess(res, { data: { paper: { ...publishedPaper, users: publishedPaper.author } } });
  } catch (error) {
    console.error('Publish error:', error);
    return sendError(res, { status: 500, code: 'ADMIN_PUBLISH_RESEARCH_FAILED', message: 'Failed to publish research' });
  }
};

exports.adminUnpublishResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: unpublishedPaper, error } = await supabase.from('research_papers')
      .update({ status: 'approved', is_published: false, published_date: null })
      .eq('id', id).select('*, author:users!author_id (id, full_name, email)').single();
    if (error) throw error;
    return sendSuccess(res, { data: { paper: { ...unpublishedPaper, users: unpublishedPaper.author } } });
  } catch (error) {
    console.error('Unpublish error:', error);
    return sendError(res, { status: 500, code: 'ADMIN_UNPUBLISH_RESEARCH_FAILED', message: 'Failed to unpublish research' });
  }
};
