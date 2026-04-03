/**
 * review.controller.js — F-002
 * Handles: approve, reject, revision, dean-bypass, faculty/dean-chair listings, and activity monitoring.
 */
const supabase = require('../config/supabase');
const { logAuditEvent } = require('../utils/audit');
const { resolvePaperFileUrl } = require('../utils/fileAccess');
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
const { runPlagiarismCheck } = require('../utils/plagiarism');
const PDFDocument = require('pdfkit');

const FINAL_STATUSES = ['approved', 'published', 'rejected'];

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
        status: 'pending',
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

    try {
      await supabase.from('approval_workflow').insert([{
        research_id: id,
        reviewer_id: req.user.id,
        reviewer_role: 'faculty',
        status: 'conflict_declared',
        comments: reason.trim(),
      }]);
    } catch {}

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

      await supabase.from('notifications').insert([
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
      statusLabel: 'pending',
      message: `A faculty reviewer declared a conflict of interest. Reason: ${reason.trim()}`,
    });

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: 'declare_conflict',
      targetType: 'research_paper',
      targetId: id,
      details: {
        paperTitle: paper.title,
        previousStatus: paper.status,
        newStatus: 'pending',
      },
      reason: reason.trim(),
    });

    return sendSuccess(res, {
      message: 'Conflict declared successfully. Paper removed from your queue.',
      data: {
        paperId: id,
        status: 'pending',
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

exports.runPlagiarismScan = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'staff') {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Only research editor can run plagiarism scan' });
    }

    const { data: paper, error } = await supabase
      .from('research_papers')
      .select('id, title, abstract, status')
      .eq('id', id)
      .single();

    if (error || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Paper not found' });
    }

    if (!['pending_editor', 'under_review', 'pending_admin'].includes(paper.status)) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_WORKFLOW_TRANSITION',
        message: `Cannot run plagiarism scan from status "${paper.status}"`,
      });
    }

    const scan = await runPlagiarismCheck({ title: paper.title, abstract: paper.abstract });
    const nowIso = new Date().toISOString();

    const updatePayload = {
      plagiarism_status: 'checked',
      plagiarism_score: scan.score,
      plagiarism_checked_at: nowIso,
      plagiarism_provider: scan.provider,
      plagiarism_summary: scan.summary,
      plagiarism_report: {
        ...scan.report,
        paperId: id,
      },
      updated_at: nowIso,
    };

    const { data: updated, error: updateError } = await supabase
      .from('research_papers')
      .update(updatePayload)
      .eq('id', id)
      .select('id, plagiarism_status, plagiarism_score, plagiarism_checked_at, plagiarism_provider, plagiarism_summary, plagiarism_report')
      .single();

    if (updateError) {
      const missingColumn = String(updateError.message || '').includes('plagiarism_');
      if (missingColumn) {
        return sendError(res, {
          status: 500,
          code: 'PLAGIARISM_MIGRATION_REQUIRED',
          message: 'Plagiarism columns are missing. Apply add_plagiarism_checks.sql migration first.',
        });
      }

      return sendError(res, {
        status: 500,
        code: 'RUN_PLAGIARISM_SCAN_FAILED',
        message: 'Failed to save plagiarism scan result',
      });
    }

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: 'plagiarism_scan',
      targetType: 'research_paper',
      targetId: id,
      details: {
        paperTitle: paper.title,
        score: updated.plagiarism_score,
        provider: updated.plagiarism_provider,
      },
    });

    return sendSuccess(res, {
      message: 'Plagiarism scan completed',
      data: {
        plagiarism: {
          status: updated.plagiarism_status,
          score: updated.plagiarism_score,
          checkedAt: updated.plagiarism_checked_at,
          provider: updated.plagiarism_provider,
          summary: updated.plagiarism_summary,
          report: updated.plagiarism_report,
        },
      },
    });
  } catch (error) {
    console.error('Run plagiarism scan error:', error.message);
    return sendError(res, {
      status: 500,
      code: 'RUN_PLAGIARISM_SCAN_FAILED',
      message: 'Server error',
    });
  }
};

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
    } else if (reviewerRole === 'admin' && ['pending_admin', 'under_review'].includes(paper.status)) {
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

    try { await supabase.from('approval_workflow').insert([{ research_id: id, reviewer_id: reviewerId, reviewer_role: reviewerRole, status: 'approved', comments: comments || null }]); } catch {}
    await logAuditEvent({ userId: reviewerId, userRole: reviewerRole, action: 'approve', targetType: 'research_paper', targetId: id, details: { previousStatus: paper.status, newStatus, paperTitle: paper.title } });
    try { await supabase.from('notifications').insert([{ user_id: paper.author_id, research_id: id, type: 'approval', title: 'Research Approved', message: notificationMessage }]); } catch {}
    await sendPaperStatusEmail({
      user: paper.author,
      paperTitle: paper.title,
      statusLabel: newStatus,
      message: notificationMessage,
    });

    if (nextReviewers.length > 0) {
      try { await supabase.from('notifications').insert(nextReviewers.map(rId => ({ user_id: rId, research_id: id, type: 'review_request', title: 'New Research for Review', message: `Research "${paper.title}" is ready for your review` }))); } catch {}
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

    try {
      await supabase.from('notifications').insert([{
        user_id: paper.author_id,
        research_id: id,
        type: 'rejection',
        title: 'Research Rejected',
        message: reason.trim(),
      }]);
    } catch {}

    try { await supabase.from('approval_workflow').insert([{ research_id: id, reviewer_id: req.user.id, reviewer_role: req.user.role, status: 'rejected', comments: reason }]); } catch {}
    if (req.user.role === 'faculty') {
      try {
        await supabase.from('faculty_reviews').upsert({
          research_id: id,
          faculty_id: req.user.id,
          status: 'rejected',
          comments: reason,
          rejection_category: rejectionCategory || null,
          reviewed_at: new Date().toISOString(),
        }, { onConflict: 'research_id,faculty_id' });
      } catch {}
    }

    await sendPaperStatusEmail({
      user: paper.author,
      paperTitle: paper.title,
      statusLabel: rejectedStatus,
      message: reason,
    });

    await logAuditEvent({ userId: req.user.id, userRole: req.user.role, action: 'reject', targetType: 'research_paper', targetId: id, details: { paperTitle: paper.title, reason, rejection_category: rejectionCategory || null } });
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

    if (notificationUserId) {
      const { error: notifError } = await supabase.from('notifications').insert({ user_id: notificationUserId, research_id: id, type: newStatus === 'revision_required' ? 'revision_required' : 'returned_for_review', title: notificationTitle, message: notificationMessage });
      if (notifError) console.error('Notification error:', notifError);

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
        await supabase.from('notifications').insert(staffUsers.map(s => ({ user_id: s.id, research_id: id, type: 'returned_for_review', title: notificationTitle, message: notificationMessage })));

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

    try { await supabase.from('approval_workflow').insert([{ research_id: id, reviewer_id: req.user.id, reviewer_role: reviewerRole, status: newStatus === 'revision_required' ? 'revision_required' : 'returned', comments: notes }]); } catch {}
    await logAuditEvent({ userId: req.user.id, userRole: reviewerRole, action: 'revision', targetType: 'research_paper', targetId: id, details: { previousStatus: paper.status, newStatus, paperTitle: paper.title, notes } });

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

    if (!['pending_editor', 'under_review'].includes(paper.status)) {
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

    try {
      await supabase.from('approval_workflow').insert([{
        research_id: id,
        reviewer_id: req.user.id,
        reviewer_role: 'staff',
        status: 'returned_to_author',
        comments: notes.trim(),
      }]);
    } catch {}

    try {
      await supabase.from('notifications').insert([{
        user_id: paper.author_id,
        research_id: id,
        type: 'returned_to_author',
        title: `Returned for Author Revision: ${paper.title}`,
        message: `Your paper has been returned by the Research Editor. Notes: ${notes.trim()}`,
      }]);
    } catch {}

    await sendPaperStatusEmail({
      user: paper.author,
      paperTitle: paper.title,
      statusLabel: newStatus,
      message: `Returned by Research Editor. Notes: ${notes.trim()}`,
    });

    await logAuditEvent({
      userId: req.user.id,
      userRole: 'staff',
      action: 'return_to_author',
      targetType: 'research_paper',
      targetId: id,
      details: {
        previousStatus,
        newStatus,
        paperTitle: paper.title,
      },
      reason: notes.trim(),
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
    const { title, abstract, keywords, category, co_authors } = req.body;

    if (req.user.role !== 'staff') {
      return sendError(res, {
        status: 403,
        code: 'ACCESS_DENIED',
        message: 'Only research editor can correct metadata',
      });
    }

    const hasAnyField = [title, abstract, keywords, category, co_authors].some((value) => value !== undefined);
    if (!hasAnyField) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'At least one metadata field is required',
      });
    }

    const { data: paper, error: fetchError } = await supabase
      .from('research_papers')
      .select('id, title, abstract, keywords, category, co_authors, status, author_id')
      .eq('id', id)
      .single();

    if (fetchError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Paper not found' });
    }

    if (!['pending_editor', 'under_review'].includes(paper.status)) {
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
    if (co_authors !== undefined) updates.co_authors = co_authors;
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

    try {
      await supabase.from('notifications').insert([{
        user_id: paper.author_id,
        research_id: id,
        type: 'metadata_corrected',
        title: 'Paper Metadata Updated by Research Editor',
        message: 'Your paper metadata was corrected by the Research Editor.',
      }]);
    } catch {}

    await logAuditEvent({
      userId: req.user.id,
      userRole: 'staff',
      action: 'correct_metadata',
      targetType: 'research_paper',
      targetId: id,
      details: {
        previous: {
          title: paper.title,
          abstract: paper.abstract,
          keywords: paper.keywords,
          category: paper.category,
          co_authors: paper.co_authors,
        },
        updated: {
          title: updatedPaper.title,
          abstract: updatedPaper.abstract,
          keywords: updatedPaper.keywords,
          category: updatedPaper.category,
          co_authors: updatedPaper.co_authors,
        },
      },
    });

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

    try { await supabase.from('approval_workflow').insert([{ research_id: id, reviewer_id: deanId, reviewer_role: 'dean', status: 'bypassed', comments: `BYPASS: ${reason}` }]); } catch {}
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
        authorName: buildFullName(paper.author),
        bypass_justification: reason,
      },
      reason,
    });
    try { await supabase.from('notifications').insert([{ user_id: paper.author_id, research_id: id, type: 'bypass_approval', title: 'Research Bypass Approved by Dean', message: `The Dean has bypass-approved your research "${paper.title}". Reason: ${reason}` }]); } catch {}
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

    try {
      await supabase.from('approval_workflow').insert([{
        research_id: id,
        reviewer_id: req.user.id,
        reviewer_role: req.user.role,
        status: 'assigned_to_faculty',
        comments: notes || null,
      }]);
    } catch {}

    try {
      await supabase.from('notifications').insert([
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
    } catch {}

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

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: 'assign_faculty',
      targetType: 'research_paper',
      targetId: id,
      details: {
        paperTitle: paper.title,
        previousStatus,
        newStatus: 'pending_faculty',
        assignedFacultyId: faculty.id,
      },
      reason: notes || null,
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
    const { data: chairProfile, error: profileError } = await supabase
      .from('users')
      .select('id, department, department_id')
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
      .select('id, title, status, keywords, created_at, submission_date, updated_at, department, department_id, author:users!author_id(id, first_name, middle_name, last_name, email)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (chairProfile.department_id) {
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
          department: chairProfile.department || null,
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
      .select('id, department, department_id')
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
      .select('id, title, status, dean_chair_id, department, department_id')
      .eq('id', id)
      .single();

    if (paperError || !paper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Paper not found' });
    }

    const inScope = chairProfile.department_id
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

    try {
      await supabase.from('notifications').insert([{
        user_id: req.user.id,
        research_id: id,
        type: 'review_deadline_set',
        title: 'Review Deadline Set',
        message: `Deadline set for "${paper.title}" on ${parsedDeadline.toLocaleString()}.`,
      }]);
    } catch {}

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: 'set_review_deadline',
      targetType: 'research_paper',
      targetId: id,
      details: {
        paperTitle: paper.title,
        deadlineAt: parsedDeadline.toISOString(),
      },
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
      .select('id, department, department_id')
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
      .select('id, title, status, review_deadline_at, updated_at, submission_date, author:users!author_id(id, first_name, middle_name, last_name, email)')
      .is('deleted_at', null)
      .not('review_deadline_at', 'is', null)
      .order('review_deadline_at', { ascending: true });

    if (chairProfile.department_id) {
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
      const label = paper.department || (paper.department_id ? `Department ${String(paper.department_id).slice(0, 8)}` : 'Unassigned');
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

exports.getDeanActivityMonitor = async (req, res) => {
  try {
    const { data: allPapers, error: papersError } = await supabase.from('research_papers')
      .select('id, title, status, created_at, updated_at, submission_date, bypass_reason, bypassed_by, bypassed_at, dean_chair_id, faculty_id, author:users!author_id(id, first_name, middle_name, last_name, email, role)')
      .order('updated_at', { ascending: false }).limit(200);
    if (papersError) throw papersError;

    let recentActions = [], auditLogs = [];
    try { const { data } = await supabase.from('approval_workflow').select('*, reviewer:users!approval_workflow_reviewer_id_fkey(first_name, middle_name, last_name, role)').order('created_at', { ascending: false }).limit(50); recentActions = data || []; } catch {}
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
        summary,
        papers: papers.map(p => ({ ...p, users: attachFullName(p.author) })),
        recentActions: recentActions.map(action => ({ ...action, reviewer: attachFullName(action.reviewer) })),
        auditLogs,
        inactivityAlerts: stalePcPapers.map(p => ({ ...p, users: attachFullName(p.author), daysStale: Math.ceil((Date.now() - new Date(p.updated_at || p.created_at)) / 86400000) })),
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

exports.exportAuditLogsPdf = async (req, res) => {
  try {
    const { action, role, from, to, limit: queryLimit } = req.query;
    const maxLimit = Math.min(parseInt(queryLimit) || 300, 1000);

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

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const fileName = `dean_audit_logs_${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=\"${fileName}\"`);

    doc.pipe(res);

    doc.fontSize(18).text('NUCLEUS Audit Logs', { align: 'left' });
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .fillColor('#555')
      .text(`Generated: ${new Date().toLocaleString()}`)
      .text(`Filters: action=${action || 'all'}, role=${role || 'all'}, from=${from || '-'}, to=${to || '-'}`)
      .text(`Entries: ${(logs || []).length}`);

    doc.moveDown(0.8);
    doc.fillColor('#000');

    if (!logs || logs.length === 0) {
      doc.fontSize(12).text('No audit logs found for the selected filters.');
      doc.end();
      return;
    }

    logs.forEach((log, index) => {
      const timestamp = log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A';
      const detailsText = log.details ? JSON.stringify(log.details) : '-';
      const reasonText = log.reason || '-';
      const summary = `#${index + 1} | ${timestamp} | ${log.action || '-'} | ${log.user_role || '-'} | ${log.user_name || 'Unknown'}`;

      if (doc.y > 740) {
        doc.addPage();
      }

      doc.fontSize(10).font('Helvetica-Bold').text(summary);
      doc.font('Helvetica').fontSize(9).text(`Target: ${log.target_type || '-'} (${log.target_id || '-'})`);
      doc.text(`Reason: ${reasonText}`);
      doc.text(`Details: ${detailsText.substring(0, 700)}${detailsText.length > 700 ? '...' : ''}`);
      doc.moveDown(0.6);
      doc.strokeColor('#dddddd').lineWidth(0.5).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.6);
    });

    doc.end();
  } catch (error) {
    console.error('Export audit logs PDF error:', error);
    return sendError(res, { status: 500, code: 'EXPORT_AUDIT_LOGS_PDF_FAILED', message: 'Failed to export audit logs PDF' });
  }
};
