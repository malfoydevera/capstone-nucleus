/**
 * review.controller.js — F-002
 * Handles: approve, reject, revision, dean-bypass, faculty/dean-chair listings, and activity monitoring.
 */
const supabase = require('../config/supabase');
const { logAuditEvent } = require('../utils/audit');
const { resolvePaperFileUrl } = require('../utils/fileAccess');
const { WORKFLOW_POLICY, validateWorkflowAction } = require('../utils/workflowPolicy');
const { sendSuccess, sendError } = require('../utils/response');

exports.approveResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const reviewerId = req.user.id;
    const reviewerRole = req.user.role;

    const { data: paper, error: fetchError } = await supabase
      .from('research_papers').select('*, author:users!author_id(full_name, email)').eq('id', id).single();
    if (fetchError || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });

    const validation = validateWorkflowAction('approve', req.user, paper);
    if (!validation.ok) {
      return sendError(res, { status: validation.code, code: 'INVALID_WORKFLOW_TRANSITION', message: validation.error, details: JSON.stringify({ currentStatus: paper.status, yourRole: reviewerRole }) });
    }

    let newStatus, notificationMessage, nextReviewers = [], extraUpdate = {};

    if (reviewerRole === 'faculty' && paper.status === 'pending_faculty') {
      const { targetUserId, targetRole } = req.body;
      if (!targetUserId || !targetRole) return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'targetUserId and targetRole are required when adviser approves a paper.' });
      if (!['dean', 'program_chair'].includes(targetRole)) return sendError(res, { status: 400, code: 'INVALID_TARGET_ROLE', message: 'targetRole must be either "dean" or "program_chair".' });
      const { data: targetUser } = await supabase.from('users').select('id, full_name, role').eq('id', targetUserId).eq('role', targetRole).single();
      if (!targetUser) return sendError(res, { status: 400, code: 'INVALID_TARGET_REVIEWER', message: 'Target reviewer not found or does not have the specified role.' });
      newStatus = targetRole === 'dean' ? 'pending_dean' : 'pending_program_chair';
      extraUpdate.dean_chair_id = targetUserId;
      notificationMessage = 'Your research has been approved by your adviser and is now pending Dean/Program Chair review';
      nextReviewers = [targetUserId];
    } else if (reviewerRole === 'dean' && paper.status === 'pending_dean') {
      newStatus = 'pending_editor';
      notificationMessage = 'Your research has been approved by the Dean and is now under Research Editor review';
      const { data: staffUsers } = await supabase.from('users').select('id').eq('role', 'staff');
      if (staffUsers) nextReviewers = staffUsers.map(s => s.id);
    } else if (reviewerRole === 'program_chair' && paper.status === 'pending_program_chair') {
      newStatus = 'pending_editor';
      notificationMessage = 'Your research has been approved by the Program Chair and is now under Research Editor review';
      const { data: staffUsers } = await supabase.from('users').select('id').eq('role', 'staff');
      if (staffUsers) nextReviewers = staffUsers.map(s => s.id);
    } else if (reviewerRole === 'staff' && paper.status === 'pending_editor') {
      newStatus = 'pending_admin';
      notificationMessage = 'Your research has been approved by the Research Editor and is awaiting final Admin approval';
      const { data: adminUsers } = await supabase.from('users').select('id').eq('role', 'admin');
      if (adminUsers) nextReviewers = adminUsers.map(a => a.id);
    } else if (reviewerRole === 'admin' && ['pending_admin', 'under_review'].includes(paper.status)) {
      newStatus = 'approved';
      notificationMessage = 'Congratulations! Your research has been approved and published';
    }

    const { data: updateData, error: updateError } = await supabase.from('research_papers')
      .update({ status: newStatus, published_date: newStatus === 'approved' ? new Date().toISOString() : null, ...extraUpdate })
      .eq('id', id).select();
    if (updateError) return sendError(res, { status: 500, code: 'UPDATE_PAPER_STATUS_FAILED', message: 'Failed to update paper status' });

    try { await supabase.from('approval_workflow').insert([{ research_id: id, reviewer_id: reviewerId, reviewer_role: reviewerRole, status: 'approved', comments: comments || null }]); } catch {}
    await logAuditEvent({ userId: reviewerId, userRole: reviewerRole, action: 'approve', targetType: 'research_paper', targetId: id, details: { previousStatus: paper.status, newStatus, paperTitle: paper.title } });
    try { await supabase.from('notifications').insert([{ user_id: paper.author_id, research_id: id, type: 'approval', title: 'Research Approved', message: notificationMessage }]); } catch {}
    if (nextReviewers.length > 0) {
      try { await supabase.from('notifications').insert(nextReviewers.map(rId => ({ user_id: rId, research_id: id, type: 'review_request', title: 'New Research for Review', message: `Research "${paper.title}" is ready for your review` }))); } catch {}
    }

    return sendSuccess(res, { message: 'Research approved successfully', data: { status: newStatus, nextStage: newStatus === 'approved' ? 'Published' : newStatus === 'pending_editor' ? 'Editor Review' : newStatus === 'pending_admin' ? 'Admin Review' : 'Unknown' } });
  } catch (error) {
    console.error('Approve error:', error.message);
    return sendError(res, { status: 500, code: 'APPROVE_RESEARCH_FAILED', message: 'Server error' });
  }
};

exports.rejectResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason?.trim()) return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Rejection reason is required' });

    const { data: paper, error: fetchError } = await supabase
      .from('research_papers').select('author_id, title, status, faculty_id, dean_chair_id').eq('id', id).single();
    if (fetchError || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Paper not found' });

    const validation = validateWorkflowAction('reject', req.user, paper);
    if (!validation.ok) return sendError(res, { status: validation.code, code: 'INVALID_WORKFLOW_TRANSITION', message: validation.error, details: JSON.stringify({ currentStatus: paper.status, yourRole: req.user.role }) });

    const { error: updateError } = await supabase.from('research_papers').update({ status: 'rejected', rejection_reason: reason.trim() }).eq('id', id);
    if (updateError) return sendError(res, { status: 500, code: 'REJECT_RESEARCH_FAILED', message: 'Failed to reject paper' });

    try { await supabase.from('approval_workflow').insert([{ research_id: id, reviewer_id: req.user.id, reviewer_role: req.user.role, status: 'rejected', comments: reason }]); } catch {}
    await logAuditEvent({ userId: req.user.id, userRole: req.user.role, action: 'reject', targetType: 'research_paper', targetId: id, details: { paperTitle: paper.title, reason } });
    return sendSuccess(res, { message: 'Research rejected successfully', data: {} });
  } catch (error) {
    console.error('Reject research error:', error);
    return sendError(res, { status: 500, code: 'REJECT_RESEARCH_FAILED', message: 'Server error' });
  }
};

exports.requestRevision = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const reviewerRole = req.user.role;
    if (!notes) return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Revision notes are required' });

    const { data: paper, error: fetchError } = await supabase.from('research_papers').select('*').eq('id', id).single();
    if (fetchError || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Paper not found' });

    const validation = validateWorkflowAction('revision', req.user, paper);
    if (!validation.ok) return sendError(res, { status: validation.code, code: 'INVALID_WORKFLOW_TRANSITION', message: validation.error, details: JSON.stringify({ currentStatus: paper.status, yourRole: reviewerRole }) });

    let newStatus, notificationUserId, notificationTitle, notificationMessage;

    if (reviewerRole === 'faculty' && paper.status === 'pending_faculty') {
      newStatus = 'revision_required'; notificationUserId = paper.author_id;
      notificationTitle = `Revision Required: ${paper.title}`; notificationMessage = `Your adviser requires revisions. Notes: ${notes}`;
    } else if ((reviewerRole === 'dean' && paper.status === 'pending_dean') || (reviewerRole === 'program_chair' && paper.status === 'pending_program_chair')) {
      newStatus = 'revision_required'; notificationUserId = paper.author_id;
      const roleLabel = reviewerRole === 'dean' ? 'Dean' : 'Program Chair';
      notificationTitle = `Revision Required: ${paper.title}`; notificationMessage = `The ${roleLabel} requires revisions. Notes: ${notes}`;
    } else if (reviewerRole === 'staff' && paper.status === 'pending_editor') {
      if (paper.dean_chair_id) {
        const { data: dcUser } = await supabase.from('users').select('role').eq('id', paper.dean_chair_id).single();
        newStatus = dcUser?.role === 'dean' ? 'pending_dean' : 'pending_program_chair';
        notificationUserId = paper.dean_chair_id;
      } else {
        newStatus = 'pending_faculty'; notificationUserId = paper.faculty_id;
      }
      notificationTitle = `Paper Returned for Review: ${paper.title}`; notificationMessage = `The Research Editor returned this paper with notes: ${notes}`;
    } else if (reviewerRole === 'admin' && paper.status === 'pending_admin') {
      newStatus = 'pending_editor'; notificationUserId = null;
      notificationTitle = `Paper Returned for Review: ${paper.title}`; notificationMessage = `The Admin returned this paper with notes: ${notes}`;
    } else {
      return sendError(res, { status: 400, code: 'INVALID_WORKFLOW_TRANSITION', message: `Cannot request revision from status "${paper.status}" as role "${reviewerRole}"` });
    }

    const { data: updatedPaper, error: updateError } = await supabase.from('research_papers')
      .update({ status: newStatus, revision_notes: notes, last_reviewer_role: reviewerRole, previous_status: paper.status, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (updateError) return sendError(res, { status: 500, code: 'UPDATE_PAPER_STATUS_FAILED', message: 'Failed to update paper status' });

    if (notificationUserId) {
      const { error: notifError } = await supabase.from('notifications').insert({ user_id: notificationUserId, research_id: id, type: newStatus === 'revision_required' ? 'revision_required' : 'returned_for_review', title: notificationTitle, message: notificationMessage });
      if (notifError) console.error('Notification error:', notifError);
    } else if (newStatus === 'pending_editor') {
      const { data: staffUsers } = await supabase.from('users').select('id').eq('role', 'staff');
      if (staffUsers?.length > 0) {
        await supabase.from('notifications').insert(staffUsers.map(s => ({ user_id: s.id, research_id: id, type: 'returned_for_review', title: notificationTitle, message: notificationMessage })));
      }
    }

    try { await supabase.from('approval_workflow').insert([{ research_id: id, reviewer_id: req.user.id, reviewer_role: reviewerRole, status: newStatus === 'revision_required' ? 'revision_required' : 'returned', comments: notes }]); } catch {}
    await logAuditEvent({ userId: req.user.id, userRole: reviewerRole, action: 'revision', targetType: 'research_paper', targetId: id, details: { previousStatus: paper.status, newStatus, paperTitle: paper.title, notes } });

    return sendSuccess(res, { message: 'Revision requested successfully', data: { newStatus, paper: updatedPaper } });
  } catch (error) {
    console.error('Request revision error:', error.message);
    return sendError(res, { status: 500, code: 'REQUEST_REVISION_FAILED', message: 'Server error' });
  }
};

exports.deanBypassApprove = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, targetStatus } = req.body;
    const deanId = req.user.id;
    if (!reason?.trim()) return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'A reason is required for bypass approval' });

    const validTargets = WORKFLOW_POLICY.deanBypass.validTargets;
    const target = targetStatus || 'approved';
    if (!validTargets.includes(target)) return sendError(res, { status: 400, code: 'INVALID_TARGET_STATUS', message: `Invalid target status. Must be one of: ${validTargets.join(', ')}` });

    const { data: paper, error: fetchError } = await supabase.from('research_papers').select('*, author:users!author_id(full_name, email)').eq('id', id).single();
    if (fetchError || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    if (WORKFLOW_POLICY.deanBypass.blockedStatuses.includes(paper.status)) return sendError(res, { status: 400, code: 'INVALID_WORKFLOW_TRANSITION', message: 'Paper is already finalized and cannot be bypassed' });

    const previousStatus = paper.status;
    const { data: updatedPaper, error: updateError } = await supabase.from('research_papers')
      .update({ status: target, bypass_reason: reason, bypassed_by: deanId, bypassed_at: new Date().toISOString(), ...(target === 'approved' ? { published_date: new Date().toISOString() } : {}) })
      .eq('id', id).select().single();
    if (updateError) return sendError(res, { status: 500, code: 'DEAN_BYPASS_FAILED', message: 'Failed to bypass approve paper' });

    try { await supabase.from('approval_workflow').insert([{ research_id: id, reviewer_id: deanId, reviewer_role: 'dean', status: 'bypassed', comments: `BYPASS: ${reason}` }]); } catch {}
    await logAuditEvent({ userId: deanId, userRole: 'dean', action: 'bypass', targetType: 'research_paper', targetId: id, details: { previousStatus, newStatus: target, paperTitle: paper.title, authorName: paper.author?.full_name }, reason });
    try { await supabase.from('notifications').insert([{ user_id: paper.author_id, research_id: id, type: 'bypass_approval', title: 'Research Bypass Approved by Dean', message: `The Dean has bypass-approved your research "${paper.title}". Reason: ${reason}` }]); } catch {}

    return sendSuccess(res, { message: 'Paper bypass-approved by Dean successfully', data: { previousStatus, newStatus: target, paper: updatedPaper } });
  } catch (error) {
    console.error('Dean bypass error:', error);
    return sendError(res, { status: 500, code: 'DEAN_BYPASS_FAILED', message: 'Server error' });
  }
};

exports.getFacultyAssignedPapers = async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase.from('research_papers').select('*, author:users!author_id (id, full_name, email)').eq('faculty_id', req.user.id).order('submission_date', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data: papers, error } = await query;
    if (error) throw error;
    const transformed = await Promise.all((papers || []).map(async p => ({ ...p, users: p.author, file_url: await resolvePaperFileUrl(p) })));
    return sendSuccess(res, { data: { papers: transformed } });
  } catch (error) {
    console.error('Get faculty papers error:', error);
    return sendError(res, { status: 500, code: 'GET_FACULTY_PAPERS_FAILED', message: 'Server error' });
  }
};

exports.getDeanChairAssignedPapers = async (req, res) => {
  try {
    const { status } = req.query;
    const pendingStatus = req.user.role === 'dean' ? 'pending_dean' : 'pending_program_chair';
    let query = supabase.from('research_papers').select('*, author:users!author_id (id, full_name, email)').eq('dean_chair_id', req.user.id).order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data: papers, error } = await query;
    if (error) throw error;
    const transformed = await Promise.all((papers || []).map(async p => ({ ...p, users: p.author, file_url: await resolvePaperFileUrl(p) })));
    return sendSuccess(res, { data: { papers: transformed, pendingStatus } });
  } catch (error) {
    console.error('Get dean/chair papers error:', error);
    return sendError(res, { status: 500, code: 'GET_DEAN_CHAIR_PAPERS_FAILED', message: 'Server error' });
  }
};

exports.getDeanActivityMonitor = async (req, res) => {
  try {
    const { data: allPapers, error: papersError } = await supabase.from('research_papers')
      .select('id, title, status, created_at, updated_at, submission_date, bypass_reason, bypassed_by, bypassed_at, dean_chair_id, faculty_id, author:users!author_id(id, full_name, email, role)')
      .order('updated_at', { ascending: false }).limit(200);
    if (papersError) throw papersError;

    let recentActions = [], auditLogs = [];
    try { const { data } = await supabase.from('approval_workflow').select('*, reviewer:users!approval_workflow_reviewer_id_fkey(full_name, role)').order('created_at', { ascending: false }).limit(50); recentActions = data || []; } catch {}
    try { const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50); auditLogs = data || []; } catch {}

    const papers = allPapers || [];
    const summary = {
      total: papers.length,
      pendingFaculty: papers.filter(p => p.status === 'pending_faculty').length,
      pendingDean: papers.filter(p => p.status === 'pending_dean').length,
      pendingProgramChair: papers.filter(p => p.status === 'pending_program_chair').length,
      pendingEditor: papers.filter(p => p.status === 'pending_editor').length,
      pendingAdmin: papers.filter(p => p.status === 'pending_admin').length,
      approved: papers.filter(p => ['approved', 'published'].includes(p.status)).length,
      rejected: papers.filter(p => p.status === 'rejected').length,
      revisionRequired: papers.filter(p => p.status === 'revision_required').length,
      bypassed: papers.filter(p => p.bypass_reason).length,
    };

    const inactivityThresholdDays = parseInt(req.query.inactivityDays) || 3;
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - inactivityThresholdDays);
    const stalePcPapers = papers.filter(p => p.status === 'pending_program_chair' && new Date(p.updated_at || p.created_at) < thresholdDate);

    return sendSuccess(res, {
      data: {
        summary, papers: papers.map(p => ({ ...p, users: p.author })), recentActions, auditLogs,
        inactivityAlerts: stalePcPapers.map(p => ({ ...p, users: p.author, daysStale: Math.ceil((Date.now() - new Date(p.updated_at || p.created_at)) / 86400000) })),
        inactivityThresholdDays,
      },
    });
  } catch (error) {
    console.error('Dean activity monitor error:', error);
    return sendError(res, { status: 500, code: 'GET_DEAN_ACTIVITY_MONITOR_FAILED', message: 'Server error' });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const { action, role, from, to, limit: queryLimit } = req.query;
    const maxLimit = Math.min(parseInt(queryLimit) || 100, 500);
    let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(maxLimit);
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
