const {
  DEFAULT_ACTIVE_STAGES,
  resolveApprovalTransition,
  resolveRevisionTransition,
  resolveRejectionStatus,
  validateWorkflowStages,
} = require('../../utils/workflowEngine');

describe('workflow smoke', () => {
  test('core approval path: faculty -> dean -> staff -> admin -> approved', () => {
    const stages = DEFAULT_ACTIVE_STAGES;

    const step1 = resolveApprovalTransition({
      stages,
      currentStatus: 'pending_faculty',
      reviewerRole: 'faculty',
      targetRole: 'dean',
    });
    expect(step1.code).toBe('pending_dean');

    const step2 = resolveApprovalTransition({
      stages,
      currentStatus: step1.code,
      reviewerRole: 'dean',
    });
    expect(step2.code).toBe('pending_editor');

    const step3 = resolveApprovalTransition({
      stages,
      currentStatus: step2.code,
      reviewerRole: 'staff',
    });
    expect(step3.code).toBe('pending_admin');

    const step4 = resolveApprovalTransition({
      stages,
      currentStatus: step3.code,
      reviewerRole: 'admin',
    });
    expect(step4.code).toBe('approved');
  });

  test('alternate approval path: faculty -> program chair -> staff', () => {
    const stages = DEFAULT_ACTIVE_STAGES;

    const step1 = resolveApprovalTransition({
      stages,
      currentStatus: 'pending_faculty',
      reviewerRole: 'faculty',
      targetRole: 'program_chair',
    });
    expect(step1.code).toBe('pending_program_chair');

    const step2 = resolveApprovalTransition({
      stages,
      currentStatus: step1.code,
      reviewerRole: 'program_chair',
    });
    expect(step2.code).toBe('pending_editor');
  });

  test('revision path: admin returns to staff and staff returns to dean/faculty', () => {
    const stages = DEFAULT_ACTIVE_STAGES;

    const fromAdmin = resolveRevisionTransition({
      stages,
      currentStatus: 'pending_admin',
      reviewerRole: 'admin',
    });
    expect(fromAdmin).toBe('pending_editor');

    const fromStaffToDean = resolveRevisionTransition({
      stages,
      currentStatus: 'pending_editor',
      reviewerRole: 'staff',
      deanChairRole: 'dean',
    });
    expect(fromStaffToDean).toBe('pending_dean');

    const fromStaffDefault = resolveRevisionTransition({
      stages,
      currentStatus: 'pending_editor',
      reviewerRole: 'staff',
    });
    expect(fromStaffDefault).toBe('pending_faculty');
  });

  test('rejection path resolves to rejected and stage graph validates', () => {
    const rejectedStatus = resolveRejectionStatus({ stages: DEFAULT_ACTIVE_STAGES });
    expect(rejectedStatus).toBe('rejected');

    const validation = validateWorkflowStages(DEFAULT_ACTIVE_STAGES);
    expect(validation.ok).toBe(true);
    expect(validation.warnings).toEqual([]);
  });
});
