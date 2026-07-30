/**
 * review.controller.js — F-002
 * Handles: approve, reject, revision, dean-bypass, faculty/dean-chair listings.
 */
const supabase = require('../config/supabase');
const { resolvePaperFileUrl, createSignedUrl, canAccessPaper } = require('../utils/fileAccess');
const { notifyUser, notifyUsers, notifyCoAuthors } = require('../utils/notify');
const { WORKFLOW_POLICY, validateWorkflowAction } = require('../utils/workflowPolicy');
const {
  getActiveWorkflowStages,
  resolveApprovalTransition,
  resolveRevisionTransition,
  resolveRejectionStatus,
  resolveBypassTargets,
} = require('../utils/workflowEngine');
const { sendSuccess, sendError } = require('../utils/response');
const { attachFullName, buildFullName } = require('../utils/name');
const { sendPaperStatusEmail, sendReviewAssignmentEmail } = require('../utils/workflowEmail');
const { invalidateBrowseCaches } = require('../utils/cache');
const PDFDocument = require('pdfkit');
const path = require('path');
const crypto = require('crypto');

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'research-papers';
const FINAL_STATUSES = ['approved', 'published', 'rejected'];
const BROWSE_VISIBLE_STATUSES = new Set(['approved', 'published']);

const maybeInvalidateBrowseCache = (previousStatus, newStatus) => {
  if (BROWSE_VISIBLE_STATUSES.has(previousStatus) || BROWSE_VISIBLE_STATUSES.has(newStatus)) {
    invalidateBrowseCaches();
  }
};
const WORKFLOW_EVENT_STATUS_BY_ACTION = {
  approve: 'approved',
  reject: 'rejected',
  request_revision: 'revision_required',
  returned_to_author: 'revision_required',
};

const resolveWorkflowEventStatus = ({ actionType, newStatus }) => {
  if (WORKFLOW_EVENT_STATUS_BY_ACTION[actionType]) {
    return WORKFLOW_EVENT_STATUS_BY_ACTION[actionType];
  }

  if (['approved', 'published'].includes(newStatus)) {
    return 'approved';
  }

  if (newStatus === 'rejected') {
    return 'rejected';
  }

  if (newStatus === 'revision_required') {
    return 'revision_required';
  }

  return 'pending';
};

const getDepartmentLookup = async () => {
  const { data, error } = await supabase.from('departments').select('id, name');
  if (error) throw error;
  return new Map((data || []).map((entry) => [entry.id, entry.name]));
};

const getProgramLookup = async () => {
  const { data, error } = await supabase.from('programs').select('id, name');
  if (error) throw error;
  return new Map((data || []).map((entry) => [entry.id, entry.name]));
};

const insertApprovalWorkflowEvent = async ({
  researchId,
  reviewerId,
  reviewerRole,
  actionType,
  comments = null,
  previousStatus = null,
  newStatus = null,
  metadata = {},
}) => {
  const status = resolveWorkflowEventStatus({ actionType, newStatus });
  const payload = {
    research_id: researchId,
    reviewer_id: reviewerId,
    reviewer_role: reviewerRole,
    status,
    comments: comments || null,
    previous_status: previousStatus,
    new_status: newStatus,
    action_type: actionType,
    metadata,
  };

  let { error } = await supabase.from('approval_workflow').insert([payload]);
  if (!error) {
    return true;
  }

  const missingExtendedColumns = ['action_type', 'previous_status', 'new_status', 'metadata'].some((column) =>
    String(error.message || '').includes(column)
  );

  if (missingExtendedColumns) {
    const fallbackPayload = {
      research_id: researchId,
      reviewer_id: reviewerId,
      reviewer_role: reviewerRole,
      status,
      comments: comments || null,
    };

    const fallbackResult = await supabase.from('approval_workflow').insert([fallbackPayload]);
    if (!fallbackResult.error) {
      return true;
    }

    error = fallbackResult.error;
  }

  console.error('Approval workflow insert failed:', {
    researchId,
    reviewerId,
    reviewerRole,
    actionType,
    status,
    previousStatus,
    newStatus,
    error: error.message || error,
  });

  return false;
};

exports.declareConflictOfInterest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'Conflict declaration reason is required',
      });
    }

    const { data: paper, error: paperError } = await supabase
      .from('research_papers')
      .select('id, title, status, author_id, faculty_id, author:users!author_id(first_name, middle_name, last_name, email)')
      .eq('id', id)
      .single();

    if (paperError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Paper not found' });
    }

    if (req.user.role !== 'faculty') {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Faculty access required' });
    }

    if (paper.faculty_id !== req.user.id) {
      return sendError(res, {
        status: 403,
        code: 'ACCESS_DENIED',
        message: 'You are not the assigned faculty reviewer for this paper',
      });
    }

    if (!['pending_faculty', 'revision_required'].includes(paper.status)) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_WORKFLOW_TRANSITION',
        message: `Cannot declare conflict from status "${paper.status}"`,
      });
    }

    const nowIso = new Date().toISOString();

    const { error: declarationError } = await supabase
      .from('faculty_conflict_declarations')
      .upsert(
        {
          faculty_id: req.user.id,
          research_id: id,
          reason: reason.trim(),
          declared_at: nowIso,
        },
        { onConflict: 'faculty_id,research_id' }
      );

    if (declarationError) {
      if (String(declarationError.message || '').includes('faculty_conflict_declarations')) {
        return sendError(res, {
          status: 500,
          code: 'MIGRATION_REQUIRED',
          message: 'Conflict declaration table is missing. Apply add_conflict_of_interest.sql migration.',
        });
      }

      return sendError(res, {
        status: 500,
        code: 'DECLARE_CONFLICT_FAILED',
        message: 'Failed to save conflict declaration',
      });
    }

    const { error: updateError } = await supabase
      .from('research_papers')
      .update({
        faculty_id: null,
        status: 'pending_editor',
        updated_at: nowIso,
      })
      .eq('id', id);

    if (updateError) {
      return sendError(res, {
        status: 500,
        code: 'DECLARE_CONFLICT_FAILED',
        message: 'Failed to update paper assignment',
      });
    }

    await insertApprovalWorkflowEvent({
      researchId: id,
      reviewerId: req.user.id,
      reviewerRole: 'faculty',
      actionType: 'conflict_declared',
      comments: reason.trim(),
      previousStatus: paper.status,
      newStatus: 'pending_editor',
    });

    try {
      const { data: staffUsers } = await supabase
        .from('users')
        .select('id, first_name, middle_name, last_name, email')
        .eq('role', 'staff')
        .eq('is_active', true);

      const staffNotifications = (staffUsers || []).map((staffUser) => ({
        user_id: staffUser.id,
        research_id: id,
        type: 'conflict_declared',
        title: 'Faculty Conflict Declared',
        message: `A faculty reviewer declared a conflict for "${paper.title}". Reassignment is required.`,
      }));

      await notifyUsers([
        {
          user_id: paper.author_id,
          research_id: id,
          type: 'workflow_update',
          title: 'Paper Reassignment in Progress',
          message: 'Your paper is being reassigned after a faculty conflict declaration.',
        },
        ...staffNotifications,
      ]);

      if (staffUsers?.length) {
        await Promise.all(
          staffUsers.map((staffUser) =>
            sendReviewAssignmentEmail({
              user: staffUser,
              paperTitle: paper.title,
            })
          )
        );
      }
    } catch {}

    await sendPaperStatusEmail({
      user: paper.author,
      paperTitle: paper.title,
      statusLabel: 'pending_editor',
      message: `A faculty reviewer declared a conflict of interest. Reason: ${reason.trim()}`,
    });



    return sendSuccess(res, {
      message: 'Conflict declared successfully. Paper removed from your queue.',
      data: {
        paperId: id,
        status: 'pending_editor',
      },
    });
  } catch (error) {
    console.error('Declare conflict error:', error.message);
    return sendError(res, {
      status: 500,
      code: 'DECLARE_CONFLICT_FAILED',
      message: 'Server error',
    });
  }
};

exports.getPlagiarismReport = async (req, res) => {
  try {
    const { id } = req.params;

    if (!['staff', 'admin'].includes(req.user.role)) {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' });
    }

    const { data: paper, error } = await supabase
      .from('research_papers')
      .select('id, title, status, plagiarism_status, plagiarism_score, plagiarism_checked_at, plagiarism_provider, plagiarism_summary, plagiarism_report')
      .eq('id', id)
      .single();

    if (error || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Paper not found' });
    }

    return sendSuccess(res, {
      data: {
        plagiarism: {
          status: paper.plagiarism_status || 'not_checked',
          score: paper.plagiarism_score ?? null,
          checkedAt: paper.plagiarism_checked_at || null,
          provider: paper.plagiarism_provider || null,
          summary: paper.plagiarism_summary || null,
          report: paper.plagiarism_report || null,
        },
      },
    });
  } catch (error) {
    if (String(error.message || '').includes('plagiarism_')) {
      return sendSuccess(res, {
        data: {
          plagiarism: {
            status: 'migration_required',
            score: null,
            checkedAt: null,
            provider: null,
            summary: 'Plagiarism columns are not available. Apply add_plagiarism_checks.sql migration.',
            report: null,
          },
        },
      });
    }

    console.error('Get plagiarism report error:', error.message);
    return sendError(res, {
      status: 500,
      code: 'GET_PLAGIARISM_REPORT_FAILED',
      message: 'Server error',
    });
  }
};

exports.runPlagiarismScan = async (req, res) =>
  sendError(res, {
    status: 410,
    code: 'PLAGIARISM_RUN_DEPRECATED',
    message:
      'Integrated plagiarism scanning is disabled. Use your institution\'s Turnitin or Grammarly workflow via the links in the review UI.',
  });

exports.approveResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const reviewerId = req.user.id;
    const reviewerRole = req.user.role;

    const { data: paper, error: fetchError } = await supabase
      .from('research_papers').select('*, author:users!author_id(first_name, middle_name, last_name, email)').eq('id', id).single();
    if (fetchError || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });

    const validation = validateWorkflowAction('approve', req.user, paper);
    if (!validation.ok) {
      return sendError(res, { status: validation.code, code: 'INVALID_WORKFLOW_TRANSITION', message: validation.error, details: JSON.stringify({ currentStatus: paper.status, yourRole: reviewerRole }) });
    }

    const activeStages = await getActiveWorkflowStages();
    let newStatus, nextStageLabel = null, nextReviewerRole = null;
    let notificationMessage, nextReviewers = [], extraUpdate = {};

    if (reviewerRole === 'faculty' && paper.status === 'pending_faculty') {
      const { targetUserId, targetRole } = req.body;
      if (!targetUserId || !targetRole) return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'targetUserId and targetRole are required when adviser approves a paper.' });
      if (!['dean', 'program_chair'].includes(targetRole)) return sendError(res, { status: 400, code: 'INVALID_TARGET_ROLE', message: 'targetRole must be either "dean" or "program_chair".' });
      const { data: targetUser } = await supabase.from('users').select('id, first_name, middle_name, last_name, role').eq('id', targetUserId).eq('role', targetRole).single();
      if (!targetUser) return sendError(res, { status: 400, code: 'INVALID_TARGET_REVIEWER', message: 'Target reviewer not found or does not have the specified role.' });
      const stage = resolveApprovalTransition({
        stages: activeStages,
        currentStatus: paper.status,
        reviewerRole,
        targetRole,
      });
      newStatus = stage?.code || (targetRole === 'dean' ? 'pending_dean' : 'pending_program_chair');
      nextStageLabel = stage?.label || (targetRole === 'dean' ? 'Dean Review' : 'Program Chair Review');
      nextReviewerRole = targetRole;
      extraUpdate.dean_chair_id = targetUserId;
      notificationMessage = 'Your research has been approved by your adviser and is now pending Dean/Program Chair review';
      nextReviewers = [targetUserId];
    } else if (reviewerRole === 'dean' && paper.status === 'pending_dean') {
      const stage = resolveApprovalTransition({
        stages: activeStages,
        currentStatus: paper.status,
        reviewerRole,
      });
      newStatus = stage?.code || 'pending_editor';
      nextStageLabel = stage?.label || 'Research Editor Review';
      nextReviewerRole = stage?.reviewer_role || 'staff';
      notificationMessage = 'Your research has been approved by the Dean and is now under Research Editor review';
      const { data: staffUsers } = await supabase.from('users').select('id').eq('role', nextReviewerRole);
      if (staffUsers) nextReviewers = staffUsers.map(s => s.id);
    } else if (reviewerRole === 'program_chair' && paper.status === 'pending_program_chair') {
      const stage = resolveApprovalTransition({
        stages: activeStages,
        currentStatus: paper.status,
        reviewerRole,
      });
      newStatus = stage?.code || 'pending_editor';
      nextStageLabel = stage?.label || 'Research Editor Review';
      nextReviewerRole = stage?.reviewer_role || 'staff';
      notificationMessage = 'Your research has been approved by the Program Chair and is now under Research Editor review';
      const { data: staffUsers } = await supabase.from('users').select('id').eq('role', nextReviewerRole);
      if (staffUsers) nextReviewers = staffUsers.map(s => s.id);
    } else if (reviewerRole === 'staff' && paper.status === 'pending_editor') {
      const stage = resolveApprovalTransition({
        stages: activeStages,
        currentStatus: paper.status,
        reviewerRole,
      });
      newStatus = stage?.code || 'pending_admin';
      nextStageLabel = stage?.label || 'Admin Final Review';
      nextReviewerRole = stage?.reviewer_role || 'admin';
      notificationMessage = 'Your research has been approved by the Research Editor and is awaiting final Admin approval';
      const { data: adminUsers } = await supabase.from('users').select('id').eq('role', nextReviewerRole);
      if (adminUsers) nextReviewers = adminUsers.map(a => a.id);
    } else if (reviewerRole === 'admin' && paper.status === 'pending_admin') {
      const stage = resolveApprovalTransition({
        stages: activeStages,
        currentStatus: paper.status,
        reviewerRole,
      });
      newStatus = stage?.code || 'approved';
      nextStageLabel = stage?.label || 'Approved / Published';
      notificationMessage = 'Congratulations! Your research has been approved and published';
    }

    const updatePayload = {
      status: newStatus,
      published_date: newStatus === 'approved' ? new Date().toISOString() : null,
      ...extraUpdate,
    };

    const { error: updateError } = await supabase.from('research_papers')
      .update(updatePayload)
      .eq('id', id).select();

    if (updateError) return sendError(res, { status: 500, code: 'UPDATE_PAPER_STATUS_FAILED', message: 'Failed to update paper status' });

    maybeInvalidateBrowseCache(paper.status, newStatus);

    await insertApprovalWorkflowEvent({
      researchId: id,
      reviewerId,
      reviewerRole,
      actionType: 'approve',
      comments: comments || null,
      previousStatus: paper.status,
      newStatus,
    });

    await notifyUser({
      userId: paper.author_id,
      researchId: id,
      type: 'approval',
      title: 'Research Approved',
      message: notificationMessage,
      senderUserId: reviewerId,
    });

    // Notify co-authors about the approval / status advancement
    try {
      const isFullyApproved = newStatus === 'approved';
      await notifyCoAuthors({
        researchId: id,
        type: 'approval',
        title: isFullyApproved ? 'Co-authored Paper Approved' : 'Co-authored Paper Advanced',
        message: isFullyApproved
          ? `The paper "${paper.title}" that you co-authored has been approved.`
          : `The paper "${paper.title}" that you co-authored has been advanced to the next review stage.`,
        senderUserId: reviewerId,
        alreadyNotifiedIds: [paper.author_id],
      });
    } catch (coAuthorErr) {
      console.error('[approveResearch] co-author notification failed:', coAuthorErr.message);
    }

    await sendPaperStatusEmail({
      user: paper.author,
      paperTitle: paper.title,
      statusLabel: newStatus,
      message: notificationMessage,
    });

    if (nextReviewers.length > 0) {
      await notifyUsers(nextReviewers.map((rId) => ({ user_id: rId, research_id: id, type: 'review_request', title: 'New Research for Review', message: `Research "${paper.title}" is ready for your review` })));
      try {
        const { data: reviewerUsers } = await supabase
          .from('users')
          .select('id, first_name, middle_name, last_name, email')
          .in('id', nextReviewers);

        if (reviewerUsers?.length) {
          await Promise.all(reviewerUsers.map((reviewer) => sendReviewAssignmentEmail({ user: reviewer, paperTitle: paper.title })));
        }
      } catch (emailErr) {
        console.error('Review assignment email error:', emailErr.message);
      }
    }

    const computedNextStage =
      nextStageLabel ||
      (newStatus === 'approved'
        ? 'Published'
        : newStatus === 'pending_editor'
          ? 'Editor Review'
          : newStatus === 'pending_admin'
            ? 'Admin Review'
            : 'Unknown');

    return sendSuccess(res, { message: 'Research approved successfully', data: { status: newStatus, nextStage: computedNextStage } });
  } catch (error) {
    console.error('Approve error:', error.message);
    return sendError(res, { status: 500, code: 'APPROVE_RESEARCH_FAILED', message: 'Server error' });
  }
};

exports.rejectResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, rejectionCategory } = req.body;
    if (!reason?.trim()) return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Rejection reason is required' });

    const { data: paper, error: fetchError } = await supabase
      .from('research_papers').select('author_id, title, status, faculty_id, dean_chair_id, author:users!author_id(first_name, middle_name, last_name, email)').eq('id', id).single();
    if (fetchError || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Paper not found' });

    const validation = validateWorkflowAction('reject', req.user, paper);
    if (!validation.ok) return sendError(res, { status: validation.code, code: 'INVALID_WORKFLOW_TRANSITION', message: validation.error, details: JSON.stringify({ currentStatus: paper.status, yourRole: req.user.role }) });

    const activeStages = await getActiveWorkflowStages();
    const rejectedStatus = resolveRejectionStatus({ stages: activeStages });

    const { error: updateError } = await supabase
      .from('research_papers')
      .update({ status: rejectedStatus, rejection_reason: reason.trim() })
      .eq('id', id);
    if (updateError) return sendError(res, { status: 500, code: 'REJECT_RESEARCH_FAILED', message: 'Failed to reject paper' });

    maybeInvalidateBrowseCache(paper.status, rejectedStatus);

    await notifyUser({
      userId: paper.author_id,
      researchId: id,
      type: 'rejection',
      title: 'Research Rejected',
      message: reason.trim(),
      senderUserId: req.user.id,
    });

    // Notify co-authors about the rejection
    try {
      await notifyCoAuthors({
        researchId: id,
        type: 'rejection',
        title: 'Co-authored Paper Rejected',
        message: `The paper "${paper.title}" that you co-authored has been rejected. Please check the feedback.`,
        senderUserId: req.user.id,
        alreadyNotifiedIds: [paper.author_id],
      });
    } catch (coAuthorErr) {
      console.error('[rejectResearch] co-author notification failed:', coAuthorErr.message);
    }

    await insertApprovalWorkflowEvent({
      researchId: id,
      reviewerId: req.user.id,
      reviewerRole: req.user.role,
      actionType: 'reject',
      comments: reason,
      previousStatus: paper.status,
      newStatus: rejectedStatus,
      metadata: {
        rejectionCategory: rejectionCategory || null,
      },
    });

    await sendPaperStatusEmail({
      user: paper.author,
      paperTitle: paper.title,
      statusLabel: rejectedStatus,
      message: reason,
    });


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

    const activeStages = await getActiveWorkflowStages();

    let newStatus, notificationUserId, notificationTitle, notificationMessage;

    if (reviewerRole === 'faculty' && paper.status === 'pending_faculty') {
      newStatus = 'revision_required'; notificationUserId = paper.author_id;
      notificationTitle = `Revision Required: ${paper.title}`; notificationMessage = `Your adviser requires revisions. Notes: ${notes}`;
    } else if ((reviewerRole === 'dean' && paper.status === 'pending_dean') || (reviewerRole === 'program_chair' && paper.status === 'pending_program_chair')) {
      newStatus = 'revision_required'; notificationUserId = paper.author_id;
      const roleLabel = reviewerRole === 'dean' ? 'Dean' : 'Program Chair';
      notificationTitle = `Revision Required: ${paper.title}`; notificationMessage = `The ${roleLabel} requires revisions. Notes: ${notes}`;
    } else if (reviewerRole === 'staff' && paper.status === 'pending_editor') {
      let deanChairRole = null;
      if (paper.dean_chair_id) {
        const { data: dcUser } = await supabase.from('users').select('role').eq('id', paper.dean_chair_id).single();
        deanChairRole = dcUser?.role || null;
        newStatus = resolveRevisionTransition({
          stages: activeStages,
          currentStatus: paper.status,
          reviewerRole,
          deanChairRole,
        }) || (dcUser?.role === 'dean' ? 'pending_dean' : 'pending_program_chair');
      } else {
        newStatus = resolveRevisionTransition({
          stages: activeStages,
          currentStatus: paper.status,
          reviewerRole,
        }) || 'pending_faculty';
      }

      if (newStatus === 'pending_dean' || newStatus === 'pending_program_chair') {
        notificationUserId = paper.dean_chair_id;
      } else if (newStatus === 'pending_faculty') {
        notificationUserId = paper.faculty_id;
      }

      notificationTitle = `Paper Returned for Review: ${paper.title}`; notificationMessage = `The Research Editor returned this paper with notes: ${notes}`;
    } else if (reviewerRole === 'admin' && paper.status === 'pending_admin') {
      newStatus = resolveRevisionTransition({
        stages: activeStages,
        currentStatus: paper.status,
        reviewerRole,
      }) || 'pending_editor';
      notificationUserId = null;
      notificationTitle = `Paper Returned for Review: ${paper.title}`; notificationMessage = `The Admin returned this paper with notes: ${notes}`;
    } else {
      return sendError(res, { status: 400, code: 'INVALID_WORKFLOW_TRANSITION', message: `Cannot request revision from status "${paper.status}" as role "${reviewerRole}"` });
    }

    const { data: updatedPaper, error: updateError } = await supabase.from('research_papers')
      .update({ status: newStatus, revision_notes: notes, last_reviewer_role: reviewerRole, previous_status: paper.status, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (updateError) return sendError(res, { status: 500, code: 'UPDATE_PAPER_STATUS_FAILED', message: 'Failed to update paper status' });

    maybeInvalidateBrowseCache(paper.status, newStatus);

    if (notificationUserId) {
      await notifyUser({
        userId: notificationUserId,
        researchId: id,
        type: newStatus === 'revision_required' ? 'revision_required' : 'returned_for_review',
        title: notificationTitle,
        message: notificationMessage,
        senderUserId: req.user.id,
      });

      // When paper goes back to the student for revision, also notify co-authors
      if (newStatus === 'revision_required') {
        try {
          await notifyCoAuthors({
            researchId: id,
            type: 'revision_required',
            title: 'Revision Requested for Co-authored Paper',
            message: `Revision has been requested for the paper "${paper.title}". Please check the feedback.`,
            senderUserId: req.user.id,
            alreadyNotifiedIds: [notificationUserId],
          });
        } catch (coAuthorErr) {
          console.error('[requestRevision] co-author notification failed:', coAuthorErr.message);
        }
      }

      try {
        const { data: recipient } = await supabase
          .from('users')
          .select('first_name, middle_name, last_name, email')
          .eq('id', notificationUserId)
          .single();
        await sendPaperStatusEmail({
          user: recipient,
          paperTitle: paper.title,
          statusLabel: newStatus,
          message: notificationMessage,
        });
      } catch (emailErr) {
        console.error('Revision email error:', emailErr.message);
      }
    } else if (newStatus === 'pending_editor') {
      const { data: staffUsers } = await supabase.from('users').select('id').eq('role', 'staff');
      if (staffUsers?.length > 0) {
        await notifyUsers(staffUsers.map((s) => ({ user_id: s.id, research_id: id, type: 'returned_for_review', title: notificationTitle, message: notificationMessage })));

        try {
          const { data: staffRecipients } = await supabase
            .from('users')
            .select('id, first_name, middle_name, last_name, email')
            .eq('role', 'staff');
          if (staffRecipients?.length) {
            await Promise.all(
              staffRecipients.map((staff) =>
                sendPaperStatusEmail({
                  user: staff,
                  paperTitle: paper.title,
                  statusLabel: newStatus,
                  message: notificationMessage,
                })
              )
            );
          }
        } catch (emailErr) {
          console.error('Staff revision email error:', emailErr.message);
        }
      }
    }

    await insertApprovalWorkflowEvent({
      researchId: id,
      reviewerId: req.user.id,
      reviewerRole,
      actionType: newStatus === 'revision_required' ? 'request_revision' : 'returned_for_review',
      comments: notes,
      previousStatus: paper.status,
      newStatus,
    });


    return sendSuccess(res, { message: 'Revision requested successfully', data: { newStatus, paper: updatedPaper } });
  } catch (error) {
    console.error('Request revision error:', error.message);
    return sendError(res, { status: 500, code: 'REQUEST_REVISION_FAILED', message: 'Server error' });
  }
};

exports.returnToAuthor = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    if (!notes?.trim()) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'Return notes are required',
      });
    }

    const { data: paper, error: fetchError } = await supabase
      .from('research_papers')
      .select('id, title, status, author_id, author:users!author_id(first_name, middle_name, last_name, email)')
      .eq('id', id)
      .single();

    if (fetchError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Paper not found' });
    }

    if (req.user.role !== 'staff') {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Only research editor can return paper to author' });
    }

    if (paper.status !== 'pending_editor') {
      return sendError(res, {
        status: 400,
        code: 'INVALID_WORKFLOW_TRANSITION',
        message: `Cannot return paper to author from status "${paper.status}"`,
      });
    }

    const previousStatus = paper.status;
    const newStatus = 'revision_required';

    const { data: updatedPaper, error: updateError } = await supabase
      .from('research_papers')
      .update({
        status: newStatus,
        revision_notes: notes.trim(),
        last_reviewer_role: 'staff',
        previous_status: previousStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return sendError(res, {
        status: 500,
        code: 'RETURN_TO_AUTHOR_FAILED',
        message: 'Failed to return paper to author',
      });
    }

    await insertApprovalWorkflowEvent({
      researchId: id,
      reviewerId: req.user.id,
      reviewerRole: 'staff',
      actionType: 'returned_to_author',
      comments: notes.trim(),
      previousStatus,
      newStatus,
    });

    await notifyUser({
      userId: paper.author_id,
      researchId: id,
      type: 'returned_to_author',
      title: `Returned for Author Revision: ${paper.title}`,
      message: `Your paper has been returned by the Research Editor. Notes: ${notes.trim()}`,
      senderUserId: req.user.id,
    });

    // Notify co-authors that the paper was returned for revision
    try {
      await notifyCoAuthors({
        researchId: id,
        type: 'returned_to_author',
        title: 'Co-authored Paper Returned for Revision',
        message: `The paper "${paper.title}" has been returned for revision by the Research Editor.`,
        senderUserId: req.user.id,
        alreadyNotifiedIds: [paper.author_id],
      });
    } catch (coAuthorErr) {
      console.error('[returnToAuthor] co-author notification failed:', coAuthorErr.message);
    }

    await sendPaperStatusEmail({
      user: paper.author,
      paperTitle: paper.title,
      statusLabel: newStatus,
      message: `Returned by Research Editor. Notes: ${notes.trim()}`,
    });



    return sendSuccess(res, {
      message: 'Paper returned to author successfully',
      data: { paper: updatedPaper, newStatus },
    });
  } catch (error) {
    console.error('Return to author error:', error.message);
    return sendError(res, {
      status: 500,
      code: 'RETURN_TO_AUTHOR_FAILED',
      message: 'Server error',
    });
  }
};

exports.correctMetadata = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, abstract, keywords, category, external_author_notes } = req.body;
    const normalizedExternalAuthorNotes =
      external_author_notes === undefined || external_author_notes === null
        ? null
        : String(external_author_notes).trim() || null;

    if (req.user.role !== 'staff') {
      return sendError(res, {
        status: 403,
        code: 'ACCESS_DENIED',
        message: 'Only research editor can correct metadata',
      });
    }

    const hasAnyField = [title, abstract, keywords, category, external_author_notes].some((value) => value !== undefined);
    if (!hasAnyField) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'At least one metadata field is required',
      });
    }

    const { data: paper, error: fetchError } = await supabase
      .from('research_papers')
      .select('id, title, abstract, keywords, category, external_author_notes, status, author_id')
      .eq('id', id)
      .single();

    if (fetchError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Paper not found' });
    }

    if (paper.status !== 'pending_editor') {
      return sendError(res, {
        status: 400,
        code: 'INVALID_WORKFLOW_TRANSITION',
        message: `Cannot correct metadata from status "${paper.status}"`,
      });
    }

    const updates = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updates.title = String(title).trim();
    if (abstract !== undefined) updates.abstract = String(abstract).trim();
    if (category !== undefined) updates.category = String(category).trim();
    if (external_author_notes !== undefined) {
      updates.external_author_notes = normalizedExternalAuthorNotes || null;
    }
    if (keywords !== undefined) {
      if (Array.isArray(keywords)) {
        updates.keywords = keywords.map((k) => String(k).trim()).filter(Boolean);
      } else {
        updates.keywords = String(keywords)
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean);
      }
    }

    if (updates.title !== undefined && !updates.title) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'title cannot be empty' });
    }
    if (updates.abstract !== undefined && !updates.abstract) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'abstract cannot be empty' });
    }

    const { data: updatedPaper, error: updateError } = await supabase
      .from('research_papers')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      return sendError(res, {
        status: 500,
        code: 'METADATA_CORRECTION_FAILED',
        message: 'Failed to update paper metadata',
      });
    }

    await notifyUser({
      userId: paper.author_id,
      researchId: id,
      type: 'metadata_corrected',
      title: 'Paper Metadata Updated by Research Editor',
      message: 'Your paper metadata was corrected by the Research Editor.',
      senderUserId: req.user.id,
    });

    // Notify co-authors about the metadata correction
    try {
      await notifyCoAuthors({
        researchId: id,
        type: 'metadata_corrected',
        title: 'Co-authored Paper Metadata Updated',
        message: `Metadata for the paper "${paper.title}" was corrected by the Research Editor.`,
        senderUserId: req.user.id,
        alreadyNotifiedIds: [paper.author_id],
      });
    } catch (coAuthorErr) {
      console.error('[correctMetadata] co-author notification failed:', coAuthorErr.message);
    }



    return sendSuccess(res, {
      message: 'Paper metadata corrected successfully',
      data: { paper: updatedPaper },
    });
  } catch (error) {
    console.error('Correct metadata error:', error.message);
    return sendError(res, {
      status: 500,
      code: 'METADATA_CORRECTION_FAILED',
      message: 'Server error',
    });
  }
};

exports.deanBypassApprove = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, targetStatus } = req.body;
    const deanId = req.user.id;
    if (!reason?.trim()) return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'A reason is required for bypass approval' });

    const { data: paper, error: fetchError } = await supabase.from('research_papers').select('*, author:users!author_id(first_name, middle_name, last_name, email)').eq('id', id).single();
    if (fetchError || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    if (WORKFLOW_POLICY.deanBypass.blockedStatuses.includes(paper.status)) return sendError(res, { status: 400, code: 'INVALID_WORKFLOW_TRANSITION', message: 'Paper is already finalized and cannot be bypassed' });

    const activeStages = await getActiveWorkflowStages();
    const validTargets = resolveBypassTargets({
      stages: activeStages,
      currentStatus: paper.status,
    });
    const target = targetStatus || 'approved';
    if (!validTargets.includes(target)) return sendError(res, { status: 400, code: 'INVALID_TARGET_STATUS', message: `Invalid target status. Must be one of: ${validTargets.join(', ')}` });

    const previousStatus = paper.status;
    const { data: updatedPaper, error: updateError } = await supabase.from('research_papers')
      .update({ status: target, bypass_reason: reason, bypassed_by: deanId, bypassed_at: new Date().toISOString(), ...(target === 'approved' ? { published_date: new Date().toISOString() } : {}) })
      .eq('id', id).select().single();
    if (updateError) return sendError(res, { status: 500, code: 'DEAN_BYPASS_FAILED', message: 'Failed to bypass approve paper' });

    maybeInvalidateBrowseCache(previousStatus, target);

    await insertApprovalWorkflowEvent({
      researchId: id,
      reviewerId: deanId,
      reviewerRole: 'dean',
      actionType: 'dean_bypass',
      comments: `BYPASS: ${reason}`,
      previousStatus,
      newStatus: target,
      metadata: {
        bypassReason: reason,
        targetStatus: target,
      },
    });

    await notifyUser({
      userId: paper.author_id,
      researchId: id,
      type: 'bypass_approval',
      title: 'Research Bypass Approved by Dean',
      message: `The Dean has bypass-approved your research "${paper.title}". Reason: ${reason}`,
      senderUserId: deanId,
    });

    // Notify co-authors about the dean bypass approval
    try {
      await notifyCoAuthors({
        researchId: id,
        type: 'bypass_approval',
        title: 'Co-authored Paper Bypass Approved by Dean',
        message: `The paper "${paper.title}" that you co-authored has been bypass-approved by the Dean.`,
        senderUserId: deanId,
        alreadyNotifiedIds: [paper.author_id],
      });
    } catch (coAuthorErr) {
      console.error('[deanBypassApprove] co-author notification failed:', coAuthorErr.message);
    }

    await sendPaperStatusEmail({
      user: paper.author,
      paperTitle: paper.title,
      statusLabel: target,
      message: `Dean bypass applied. Reason: ${reason}`,
    });

    return sendSuccess(res, { message: 'Paper bypass-approved by Dean successfully', data: { previousStatus, newStatus: target, paper: updatedPaper } });
  } catch (error) {
    console.error('Dean bypass error:', error);
    return sendError(res, { status: 500, code: 'DEAN_BYPASS_FAILED', message: 'Server error' });
  }
};

exports.assignFacultyReviewer = async (req, res) => {
  try {
    const { id } = req.params;
    const { facultyId, notes } = req.body;

    if (!facultyId) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'facultyId is required',
      });
    }

    const { data: paper, error: paperError } = await supabase
      .from('research_papers')
      .select('id, title, status, author_id, department, department_id, dean_chair_id, author:users!author_id(first_name, middle_name, last_name, email)')
      .eq('id', id)
      .single();

    if (paperError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    }

    if (!['dean', 'program_chair'].includes(req.user.role)) {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' });
    }

    if (req.user.role === 'program_chair' && paper.dean_chair_id !== req.user.id) {
      return sendError(res, {
        status: 403,
        code: 'ACCESS_DENIED',
        message: 'You are not assigned as the program chair reviewer for this paper',
      });
    }

    if (!['pending_program_chair', 'pending_dean', 'revision_required'].includes(paper.status)) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_WORKFLOW_TRANSITION',
        message: `Cannot assign faculty reviewer from status "${paper.status}"`,
      });
    }

    let facultyQuery = supabase
      .from('users')
      .select('id, first_name, middle_name, last_name, email, role, department, department_id')
      .eq('id', facultyId)
      .eq('role', 'faculty');

    if (paper.department_id) {
      facultyQuery = facultyQuery.eq('department_id', paper.department_id);
    } else if (paper.department) {
      facultyQuery = facultyQuery.eq('department', paper.department);
    }

    let { data: faculty } = await facultyQuery.single();

    // Fallback to any faculty account when strict department matching is unavailable.
    if (!faculty) {
      const { data: fallbackFaculty } = await supabase
        .from('users')
        .select('id, first_name, middle_name, last_name, email, role, department, department_id')
        .eq('id', facultyId)
        .eq('role', 'faculty')
        .single();
      faculty = fallbackFaculty;
    }

    if (!faculty) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_TARGET_REVIEWER',
        message: 'Selected faculty reviewer is invalid',
      });
    }

    const previousStatus = paper.status;
    const { data: updatedPaper, error: updateError } = await supabase
      .from('research_papers')
      .update({
        faculty_id: faculty.id,
        dean_chair_id: null,
        status: 'pending_faculty',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, status, faculty_id, dean_chair_id')
      .single();

    if (updateError) {
      return sendError(res, {
        status: 500,
        code: 'ASSIGN_FACULTY_FAILED',
        message: 'Failed to assign faculty reviewer',
      });
    }

    await insertApprovalWorkflowEvent({
      researchId: id,
      reviewerId: req.user.id,
      reviewerRole: req.user.role,
      actionType: 'assigned_to_faculty',
      comments: notes || null,
      previousStatus,
      newStatus: 'pending_faculty',
      metadata: {
        assignedFacultyId: faculty.id,
      },
    });

    await notifyUsers([
      {
        user_id: faculty.id,
        research_id: id,
        type: 'review_request',
        title: 'Paper Assigned for Faculty Review',
        message: `Research "${paper.title}" was assigned to you for review${notes ? `: ${notes}` : ''}`,
      },
      {
        user_id: paper.author_id,
        research_id: id,
        type: 'workflow_update',
        title: 'Paper Reassigned to Faculty',
        message: `Your paper "${paper.title}" has been reassigned to a faculty reviewer.`,
      },
    ]);

    await sendReviewAssignmentEmail({
      user: faculty,
      paperTitle: paper.title,
    });

    await sendPaperStatusEmail({
      user: paper.author,
      paperTitle: paper.title,
      statusLabel: 'pending_faculty',
      message: 'Your paper was reassigned to a faculty reviewer for continued evaluation.',
    });



    return sendSuccess(res, {
      message: 'Faculty reviewer assigned successfully',
      data: {
        paper: updatedPaper,
        assignedFaculty: attachFullName(faculty),
      },
    });
  } catch (error) {
    console.error('Assign faculty reviewer error:', error);
    return sendError(res, {
      status: 500,
      code: 'ASSIGN_FACULTY_FAILED',
      message: 'Server error',
    });
  }
};

exports.getFacultyAssignedPapers = async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase.from('research_papers').select('*, author:users!author_id (id, first_name, middle_name, last_name, email)').eq('faculty_id', req.user.id).is('deleted_at', null).order('submission_date', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data: papers, error } = await query;
    if (error) throw error;
    const transformed = await Promise.all((papers || []).map(async p => ({ ...p, users: attachFullName(p.author), file_url: await resolvePaperFileUrl(p) })));
    return sendSuccess(res, { data: { papers: transformed } });
  } catch (error) {
    console.error('Get faculty papers error:', error);
    return sendError(res, { status: 500, code: 'GET_FACULTY_PAPERS_FAILED', message: 'Server error' });
  }
};

exports.getFacultyWorkloadSummary = async (req, res) => {
  try {
    const overdueDays = Math.max(1, parseInt(req.query.overdueDays, 10) || 7);

    const { data: papers, error } = await supabase
      .from('research_papers')
      .select('id, title, status, created_at, submission_date, updated_at, author:users!author_id(id, first_name, middle_name, last_name, email)')
      .eq('faculty_id', req.user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = papers || [];
    const pending = rows.filter((p) => p.status === 'pending_faculty');
    const completed = rows.filter((p) => ['pending_editor', 'pending_admin', 'approved', 'published', 'rejected', 'revision_required'].includes(p.status));

    const turnaroundDays = completed
      .map((p) => {
        const start = new Date(p.submission_date || p.created_at).getTime();
        const end = new Date(p.updated_at || p.created_at).getTime();
        if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
        return (end - start) / 86400000;
      })
      .filter((value) => value !== null);

    const avgReviewDays = turnaroundDays.length > 0
      ? Number((turnaroundDays.reduce((sum, value) => sum + value, 0) / turnaroundDays.length).toFixed(1))
      : 0;

    const staleCutoff = Date.now() - overdueDays * 86400000;
    const overdueItems = pending
      .filter((p) => {
        const baseline = new Date(p.updated_at || p.submission_date || p.created_at).getTime();
        return !Number.isNaN(baseline) && baseline < staleCutoff;
      })
      .map((p) => {
        const baseline = new Date(p.updated_at || p.submission_date || p.created_at).getTime();
        const ageDays = Math.ceil((Date.now() - baseline) / 86400000);
        return {
          ...p,
          users: attachFullName(p.author),
          ageDays,
        };
      })
      .sort((a, b) => b.ageDays - a.ageDays);

    return sendSuccess(res, {
      data: {
        overdueThresholdDays: overdueDays,
        summary: {
          totalAssigned: rows.length,
          pendingCount: pending.length,
          reviewedCount: completed.length,
          avgReviewDays,
          overdueCount: overdueItems.length,
        },
        overdueItems: overdueItems.slice(0, 10),
      },
    });
  } catch (error) {
    console.error('Get faculty workload summary error:', error);
    return sendError(res, {
      status: 500,
      code: 'GET_FACULTY_WORKLOAD_FAILED',
      message: 'Server error',
    });
  }
};

exports.getDeanChairAssignedPapers = async (req, res) => {
  try {
    const { status } = req.query;
    const pendingStatus = req.user.role === 'dean' ? 'pending_dean' : 'pending_program_chair';
    let query = supabase.from('research_papers').select('*, author:users!author_id (id, first_name, middle_name, last_name, email)').eq('dean_chair_id', req.user.id).is('deleted_at', null).order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data: papers, error } = await query;
    if (error) throw error;
    const transformed = await Promise.all((papers || []).map(async p => ({ ...p, users: attachFullName(p.author), file_url: await resolvePaperFileUrl(p) })));
    return sendSuccess(res, { data: { papers: transformed, pendingStatus } });
  } catch (error) {
    console.error('Get dean/chair papers error:', error);
    return sendError(res, { status: 500, code: 'GET_DEAN_CHAIR_PAPERS_FAILED', message: 'Server error' });
  }
};

exports.getProgramChairAnalytics = async (req, res) => {
  try {
    const [departmentLookup, programLookup] = await Promise.all([
      getDepartmentLookup(),
      getProgramLookup(),
    ]);
    const { data: chairProfile, error: profileError } = await supabase
      .from('users')
      .select('id, program, program_id, department, department_id')
      .eq('id', req.user.id)
      .single();

    if (profileError || !chairProfile) {
      return sendError(res, {
        status: 404,
        code: 'PROFILE_NOT_FOUND',
        message: 'Program Chair profile not found',
      });
    }

    let query = supabase
      .from('research_papers')
      .select('id, title, status, keywords, created_at, submission_date, updated_at, department, department_id, program_id, author:users!author_id(id, first_name, middle_name, last_name, email)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (chairProfile.program_id) {
      query = query.eq('program_id', chairProfile.program_id);
    } else if (chairProfile.department_id) {
      query = query.eq('department_id', chairProfile.department_id);
    } else if (chairProfile.department) {
      query = query.eq('department', chairProfile.department);
    } else {
      return sendError(res, {
        status: 400,
        code: 'MISSING_PROGRAM_SCOPE',
        message: 'Program Chair account has no department configured',
      });
    }

    const { data: papers, error } = await query;
    if (error) throw error;

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const transformed = (papers || []).map((p) => ({ ...p, users: attachFullName(p.author) }));
    const keywordCounts = transformed.reduce((acc, paper) => {
      const paperKeywords = Array.isArray(paper.keywords) ? paper.keywords : [];
      paperKeywords.forEach((keyword) => {
        const normalized = String(keyword || '').trim().toLowerCase();
        if (!normalized) return;
        acc[normalized] = (acc[normalized] || 0) + 1;
      });
      return acc;
    }, {});
    const topKeywords = Object.entries(keywordCounts)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const summary = {
      total: transformed.length,
      pending: transformed.filter((p) => p.status === 'pending_program_chair').length,
      approved: transformed.filter((p) => ['pending_editor', 'pending_admin', 'approved', 'published'].includes(p.status)).length,
      rejected: transformed.filter((p) => p.status === 'rejected').length,
      revisionRequired: transformed.filter((p) => p.status === 'revision_required').length,
      thisMonth: transformed.filter((p) => new Date(p.created_at) >= firstDayOfMonth).length,
    };

    return sendSuccess(res, {
      data: {
        program: {
          program: (chairProfile.program_id && programLookup.get(chairProfile.program_id)) || chairProfile.program || null,
          programId: chairProfile.program_id || null,
          department: (chairProfile.department_id && departmentLookup.get(chairProfile.department_id)) || chairProfile.department || null,
          departmentId: chairProfile.department_id || null,
        },
        summary,
        topKeywords,
        papers: transformed,
        recentPapers: transformed.slice(0, 8),
      },
    });
  } catch (error) {
    console.error('Get program chair analytics error:', error);
    return sendError(res, {
      status: 500,
      code: 'GET_PROGRAM_CHAIR_ANALYTICS_FAILED',
      message: 'Server error',
    });
  }
};

exports.setProgramChairReviewDeadline = async (req, res) => {
  try {
    const { id } = req.params;
    const { deadlineAt } = req.body;

    if (!deadlineAt) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'deadlineAt is required',
      });
    }

    const parsedDeadline = new Date(deadlineAt);
    if (Number.isNaN(parsedDeadline.getTime())) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'deadlineAt must be a valid datetime',
      });
    }

    const { data: chairProfile, error: profileError } = await supabase
      .from('users')
      .select('id, program, program_id, department, department_id')
      .eq('id', req.user.id)
      .single();

    if (profileError || !chairProfile) {
      return sendError(res, {
        status: 404,
        code: 'PROFILE_NOT_FOUND',
        message: 'Program Chair profile not found',
      });
    }

    const { data: paper, error: paperError } = await supabase
      .from('research_papers')
      .select('id, title, status, dean_chair_id, department, department_id, program_id')
      .eq('id', id)
      .single();

    if (paperError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Paper not found' });
    }

    const inScope = chairProfile.program_id
      ? paper.program_id === chairProfile.program_id
      : chairProfile.department_id
        ? paper.department_id === chairProfile.department_id
        : chairProfile.department && paper.department === chairProfile.department;

    if (!inScope) {
      return sendError(res, {
        status: 403,
        code: 'ACCESS_DENIED',
        message: 'Paper is outside your program scope',
      });
    }

    if (FINAL_STATUSES.includes(paper.status)) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_WORKFLOW_TRANSITION',
        message: 'Cannot set deadline for finalized paper',
      });
    }

    const now = Date.now();
    if (parsedDeadline.getTime() <= now) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'deadlineAt must be in the future',
      });
    }

    const baseUpdate = {
      review_deadline_at: parsedDeadline.toISOString(),
      dean_chair_id: paper.dean_chair_id || req.user.id,
      updated_at: new Date().toISOString(),
    };

    let updateResult = await supabase
      .from('research_papers')
      .update({
        ...baseUpdate,
        deadline_reminder_last_sent_at: null,
      })
      .eq('id', id)
      .select('id, title, status, review_deadline_at, dean_chair_id')
      .single();

    if (updateResult.error && String(updateResult.error.message || '').includes('deadline_reminder_last_sent_at')) {
      updateResult = await supabase
        .from('research_papers')
        .update(baseUpdate)
        .eq('id', id)
        .select('id, title, status, review_deadline_at, dean_chair_id')
        .single();
    }

    const { data: updatedPaper, error: updateError } = updateResult;

    if (updateError) {
      const missingColumn = String(updateError.message || '').includes('review_deadline_at');
      if (missingColumn) {
        return sendError(res, {
          status: 500,
          code: 'DEADLINE_MIGRATION_REQUIRED',
          message: 'Review deadline columns are missing. Apply add_review_deadlines.sql migration first.',
        });
      }

      return sendError(res, {
        status: 500,
        code: 'SET_REVIEW_DEADLINE_FAILED',
        message: 'Failed to set review deadline',
      });
    }

    await notifyUser({
      userId: req.user.id,
      researchId: id,
      type: 'review_deadline_set',
      title: 'Review Deadline Set',
      message: `Deadline set for "${paper.title}" on ${parsedDeadline.toLocaleString()}.`,
    });



    return sendSuccess(res, {
      message: 'Review deadline set successfully',
      data: { paper: updatedPaper },
    });
  } catch (error) {
    console.error('Set program chair review deadline error:', error.message);
    return sendError(res, {
      status: 500,
      code: 'SET_REVIEW_DEADLINE_FAILED',
      message: 'Server error',
    });
  }
};

exports.getProgramChairDeadlines = async (req, res) => {
  try {
    const { data: chairProfile, error: profileError } = await supabase
      .from('users')
      .select('id, program, program_id, department, department_id')
      .eq('id', req.user.id)
      .single();

    if (profileError || !chairProfile) {
      return sendError(res, {
        status: 404,
        code: 'PROFILE_NOT_FOUND',
        message: 'Program Chair profile not found',
      });
    }

    let query = supabase
      .from('research_papers')
      .select('id, title, status, review_deadline_at, updated_at, submission_date, department, department_id, program_id, author:users!author_id(id, first_name, middle_name, last_name, email)')
      .is('deleted_at', null)
      .not('review_deadline_at', 'is', null)
      .order('review_deadline_at', { ascending: true });

    if (chairProfile.program_id) {
      query = query.eq('program_id', chairProfile.program_id);
    } else if (chairProfile.department_id) {
      query = query.eq('department_id', chairProfile.department_id);
    } else if (chairProfile.department) {
      query = query.eq('department', chairProfile.department);
    } else {
      return sendError(res, {
        status: 400,
        code: 'MISSING_PROGRAM_SCOPE',
        message: 'Program Chair account has no department configured',
      });
    }

    const { data: papers, error } = await query;
    if (error) {
      const missingColumn = String(error.message || '').includes('review_deadline_at');
      if (missingColumn) {
        return sendSuccess(res, {
          data: {
            upcoming: [],
            overdue: [],
            summary: { totalWithDeadline: 0, overdueCount: 0, dueSoonCount: 0 },
          },
        });
      }
      throw error;
    }

    const now = Date.now();
    const dueSoonCutoff = now + 48 * 3600000;
    const filtered = (papers || [])
      .filter((paper) => !FINAL_STATUSES.includes(paper.status))
      .map((paper) => {
        const deadlineMs = new Date(paper.review_deadline_at).getTime();
        const hoursUntilDeadline = Number.isNaN(deadlineMs)
          ? null
          : Math.ceil((deadlineMs - now) / 3600000);
        return {
          ...paper,
          users: attachFullName(paper.author),
          hoursUntilDeadline,
        };
      });

    const overdue = filtered.filter((p) => p.hoursUntilDeadline !== null && p.hoursUntilDeadline <= 0);
    const upcoming = filtered.filter((p) => {
      const deadlineMs = new Date(p.review_deadline_at).getTime();
      return !Number.isNaN(deadlineMs) && deadlineMs > now && deadlineMs <= dueSoonCutoff;
    });

    return sendSuccess(res, {
      data: {
        upcoming,
        overdue,
        summary: {
          totalWithDeadline: filtered.length,
          overdueCount: overdue.length,
          dueSoonCount: upcoming.length,
        },
      },
    });
  } catch (error) {
    console.error('Get program chair deadlines error:', error.message);
    return sendError(res, {
      status: 500,
      code: 'GET_PROGRAM_CHAIR_DEADLINES_FAILED',
      message: 'Server error',
    });
  }
};

exports.getDepartmentComparison = async (req, res) => {
  try {
    const { from, to } = req.query;
    const departmentLookup = await getDepartmentLookup();
    let query = supabase
      .from('research_papers')
      .select('id, status, department, department_id, created_at, submission_date, updated_at, published_date')
      .is('deleted_at', null);

    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data: papers, error } = await query;
    if (error) throw error;

    const rows = papers || [];
    const byDepartment = new Map();

    rows.forEach((paper) => {
      const label = (paper.department_id && departmentLookup.get(paper.department_id))
        || paper.department
        || (paper.department_id ? `Department ${String(paper.department_id).slice(0, 8)}` : 'Unassigned');
      if (!byDepartment.has(label)) {
        byDepartment.set(label, {
          department: label,
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          revisionRequired: 0,
          forwardedToEditor: 0,
          decisionCount: 0,
          approvalRate: 0,
          avgTurnaroundDays: 0,
          _turnaroundTotalMs: 0,
          _turnaroundCount: 0,
        });
      }

      const bucket = byDepartment.get(label);
      bucket.total += 1;

      if (['approved', 'published'].includes(paper.status)) bucket.approved += 1;
      if (paper.status === 'rejected') bucket.rejected += 1;
      if (paper.status === 'revision_required') bucket.revisionRequired += 1;
      if (paper.status === 'pending_editor') bucket.forwardedToEditor += 1;
      if (['pending_faculty', 'pending_program_chair', 'pending_dean', 'pending_editor', 'pending_admin'].includes(paper.status)) {
        bucket.pending += 1;
      }

      if (['approved', 'published', 'rejected'].includes(paper.status)) {
        bucket.decisionCount += 1;
      }

      const start = new Date(paper.submission_date || paper.created_at).getTime();
      const end = new Date(paper.published_date || paper.updated_at).getTime();
      if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
        bucket._turnaroundTotalMs += (end - start);
        bucket._turnaroundCount += 1;
      }
    });

    const departments = Array.from(byDepartment.values())
      .map((bucket) => {
        const approvalRateBase = bucket.approved + bucket.rejected;
        return {
          department: bucket.department,
          total: bucket.total,
          pending: bucket.pending,
          approved: bucket.approved,
          rejected: bucket.rejected,
          revisionRequired: bucket.revisionRequired,
          forwardedToEditor: bucket.forwardedToEditor,
          decisionCount: bucket.decisionCount,
          approvalRate: approvalRateBase > 0 ? Math.round((bucket.approved / approvalRateBase) * 100) : 0,
          avgTurnaroundDays:
            bucket._turnaroundCount > 0
              ? Number((bucket._turnaroundTotalMs / bucket._turnaroundCount / 86400000).toFixed(1))
              : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    return sendSuccess(res, {
      data: {
        totalDepartments: departments.length,
        totalPapers: rows.length,
        departments,
      },
    });
  } catch (error) {
    console.error('Get department comparison error:', error);
    return sendError(res, {
      status: 500,
      code: 'GET_DEPARTMENT_COMPARISON_FAILED',
      message: 'Server error',
    });
  }
};



exports.uploadAnnotationDrawing = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;
    if (!file) {
      return sendError(res, { status: 400, code: 'NO_FILE', message: 'No image uploaded' });
    }

    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return sendError(res, { status: 400, code: 'INVALID_FILE_TYPE', message: 'Only PNG, JPEG, or WebP images are allowed' });
    }

    const privilegedRoles = ['faculty', 'dean', 'program_chair', 'staff', 'admin'];
    if (!privilegedRoles.includes(req.user.role)) {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' });
    }

    const { data: paper, error: paperError } = await supabase
      .from('research_papers')
      .select(`
        id, status, author_id, faculty_id, dean_chair_id,
        research_authors!research_authors_research_id_fkey (user_id)
      `)
      .eq('id', id)
      .single();

    if (paperError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    }
    if (!canAccessPaper(req.user, paper)) {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' });
    }

    const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const storagePath = `annotation-drawings/${id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error('Annotation drawing upload error:', uploadError);
      return sendError(res, { status: 500, code: 'UPLOAD_FAILED', message: 'Failed to upload image' });
    }

    const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    const url = publicUrlData?.publicUrl || null;
    if (!url) {
      return sendError(res, { status: 500, code: 'UPLOAD_FAILED', message: 'Could not resolve public URL' });
    }

    return sendSuccess(res, { data: { url } });
  } catch (error) {
    console.error('Upload annotation drawing error:', error);
    return sendError(res, { status: 500, code: 'UPLOAD_ANNOTATION_DRAWING_FAILED', message: 'Failed to upload drawing' });
  }
};

exports.uploadAnnotatedFile = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return sendError(res, { status: 400, code: 'NO_FILE', message: 'No file uploaded' });
    }

    if (file.mimetype !== 'application/pdf') {
      return sendError(res, { status: 400, code: 'INVALID_FILE_TYPE', message: 'Only PDF files are allowed' });
    }

    const { data: paper, error: paperError} = await supabase
      .from('research_papers')
      .select('id, status, author_id, faculty_id, dean_chair_id')
      .eq('id', id)
      .single();

    if (paperError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    }

    const privilegedRoles = ['faculty', 'dean', 'program_chair', 'staff', 'admin'];
    if (!privilegedRoles.includes(req.user.role)) {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' });
    }

    const timestamp = Date.now();
    const sanitized = path.parse(file.originalname).name.replace(/[^a-z0-9_-]/gi, '_');
    const storagePath = `annotated/${id}_${sanitized}_${timestamp}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Annotated file upload error:', uploadError);
      return sendError(res, { status: 500, code: 'UPLOAD_FAILED', message: 'Failed to upload annotated file' });
    }

    const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    const annotatedFileUrl = publicUrlData?.publicUrl || null;

    const { error: updateError } = await supabase
      .from('research_papers')
      .update({
        annotated_file_url: annotatedFileUrl,
        annotated_file_storage_path: storagePath,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to update paper with annotated file:', updateError);
      return sendError(res, { status: 500, code: 'UPDATE_FAILED', message: 'Failed to update paper record' });
    }



    await notifyUser({
      userId: paper.author_id,
      researchId: id,
      type: 'review',
      title: 'Annotated PDF available',
      message: 'Your reviewer uploaded a marked-up PDF copy. Open your paper to download it.',
    });

    return sendSuccess(res, {
      message: 'Annotated PDF uploaded successfully',
      data: { annotatedFileUrl },
    });
  } catch (error) {
    console.error('Upload annotated file error:', error);
    return sendError(res, { status: 500, code: 'UPLOAD_ANNOTATED_FILE_FAILED', message: 'Failed to upload annotated file' });
  }
};
