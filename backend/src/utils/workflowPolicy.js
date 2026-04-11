const WORKFLOW_POLICY = {
  approve: {
    faculty: ['pending_faculty'],
    dean: ['pending_dean'],
    program_chair: ['pending_program_chair'],
    staff: ['pending_editor'],
    admin: ['pending_admin'],
  },
  reject: {
    faculty: ['pending_faculty'],
    dean: ['pending_dean'],
    staff: ['pending_editor'],
    admin: ['pending_admin'],
  },
  revision: {
    faculty: ['pending_faculty'],
    dean: ['pending_dean'],
    program_chair: ['pending_program_chair'],
    staff: ['pending_editor'],
    admin: ['pending_admin'],
  },
  deanBypass: {
    validTargets: ['pending_dean', 'pending_editor', 'pending_admin', 'approved'],
    blockedStatuses: ['approved', 'published', 'rejected'],
  },
};

function isWorkflowActionAllowed(action, role, status) {
  const allowedStatuses = WORKFLOW_POLICY[action]?.[role] || [];
  return allowedStatuses.includes(status);
}

function validateWorkflowAction(action, user, paper) {
  if (action === 'reject' && user.role === 'program_chair') {
    return {
      ok: false,
      code: 403,
      error: 'Program Chair cannot reject directly; request revision or escalate to Dean',
    };
  }

  if (!isWorkflowActionAllowed(action, user.role, paper.status)) {
    return {
      ok: false,
      code: 400,
      error: `Invalid ${action} workflow for current role/status`,
    };
  }

  if (user.role === 'faculty' && paper.faculty_id !== user.id) {
    return {
      ok: false,
      code: 403,
      error: 'You are not assigned as the faculty reviewer for this paper',
    };
  }

  if (['dean', 'program_chair'].includes(user.role) && paper.dean_chair_id !== user.id) {
    return {
      ok: false,
      code: 403,
      error: 'You are not assigned as the dean/program chair reviewer for this paper',
    };
  }

  return { ok: true };
}

module.exports = {
  WORKFLOW_POLICY,
  isWorkflowActionAllowed,
  validateWorkflowAction,
};
