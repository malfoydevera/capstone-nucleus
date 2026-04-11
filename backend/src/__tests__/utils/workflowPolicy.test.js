const {
  WORKFLOW_POLICY,
  isWorkflowActionAllowed,
  validateWorkflowAction,
} = require('../../utils/workflowPolicy');

describe('workflowPolicy', () => {
  test('allows valid approve transition for faculty pending_faculty', () => {
    expect(isWorkflowActionAllowed('approve', 'faculty', 'pending_faculty')).toBe(true);
  });

  test('blocks invalid approve transition for faculty pending_admin', () => {
    expect(isWorkflowActionAllowed('approve', 'faculty', 'pending_admin')).toBe(false);
  });

  test('validateWorkflowAction rejects faculty not assigned to paper', () => {
    const result = validateWorkflowAction(
      'approve',
      { id: 'faculty-2', role: 'faculty' },
      { status: 'pending_faculty', faculty_id: 'faculty-1' }
    );

    expect(result.ok).toBe(false);
    expect(result.code).toBe(403);
  });

  test('validateWorkflowAction rejects dean not assigned to paper', () => {
    const result = validateWorkflowAction(
      'revision',
      { id: 'dean-2', role: 'dean' },
      { status: 'pending_dean', dean_chair_id: 'dean-1' }
    );

    expect(result.ok).toBe(false);
    expect(result.code).toBe(403);
  });

  test('validateWorkflowAction allows admin pending_admin reject', () => {
    const result = validateWorkflowAction(
      'reject',
      { id: 'admin-1', role: 'admin' },
      { status: 'pending_admin' }
    );

    expect(result).toEqual({ ok: true });
  });

  test('validateWorkflowAction blocks admin legacy under_review reject', () => {
    const result = validateWorkflowAction(
      'reject',
      { id: 'admin-1', role: 'admin' },
      { status: 'under_review' }
    );

    expect(result.ok).toBe(false);
    expect(result.code).toBe(400);
  });

  test('validateWorkflowAction blocks program chair direct reject', () => {
    const result = validateWorkflowAction(
      'reject',
      { id: 'pc-1', role: 'program_chair' },
      { status: 'pending_program_chair', dean_chair_id: 'pc-1' }
    );

    expect(result.ok).toBe(false);
    expect(result.code).toBe(403);
  });

  test('dean bypass policy includes approved target and blocks finalized statuses', () => {
    expect(WORKFLOW_POLICY.deanBypass.validTargets).toContain('approved');
    expect(WORKFLOW_POLICY.deanBypass.blockedStatuses).toContain('rejected');
  });
});
