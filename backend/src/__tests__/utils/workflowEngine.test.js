jest.mock('../../config/supabase', () => ({
  from: jest.fn(),
}));

const supabase = require('../../config/supabase');
const {
  DEFAULT_ACTIVE_STAGES,
  getActiveWorkflowStages,
  resolveApprovalTransition,
  resolveRevisionTransition,
  resolveRejectionStatus,
  resolveBypassTargets,
  validateWorkflowStages,
} = require('../../utils/workflowEngine');

describe('workflowEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getActiveWorkflowStages returns DB stages when available', async () => {
    const mockData = [
      { code: 'pending_editor', label: 'Editor', reviewer_role: 'staff', position: 40, is_active: true },
      { code: 'pending_admin', label: 'Admin', reviewer_role: 'admin', position: 50, is_active: true },
    ];

    supabase.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: mockData, error: null }),
        }),
      }),
    }));

    const stages = await getActiveWorkflowStages();
    expect(stages).toEqual(mockData);
  });

  test('getActiveWorkflowStages falls back to defaults on error', async () => {
    supabase.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: null, error: new Error('missing table') }),
        }),
      }),
    }));

    const stages = await getActiveWorkflowStages();
    expect(stages).toEqual(DEFAULT_ACTIVE_STAGES);
  });

  test('resolveApprovalTransition chooses staff stage after dean review', () => {
    const stage = resolveApprovalTransition({
      stages: DEFAULT_ACTIVE_STAGES,
      currentStatus: 'pending_dean',
      reviewerRole: 'dean',
    });

    expect(stage.code).toBe('pending_editor');
    expect(stage.reviewer_role).toBe('staff');
  });

  test('resolveApprovalTransition chooses targeted role stage for faculty', () => {
    const stage = resolveApprovalTransition({
      stages: DEFAULT_ACTIVE_STAGES,
      currentStatus: 'pending_faculty',
      reviewerRole: 'faculty',
      targetRole: 'program_chair',
    });

    expect(stage.code).toBe('pending_program_chair');
    expect(stage.reviewer_role).toBe('program_chair');
  });

  test('resolveRevisionTransition routes admin back to previous staff stage', () => {
    const stageCode = resolveRevisionTransition({
      stages: DEFAULT_ACTIVE_STAGES,
      currentStatus: 'pending_admin',
      reviewerRole: 'admin',
    });

    expect(stageCode).toBe('pending_editor');
  });

  test('resolveRejectionStatus uses configured rejected stage when present', () => {
    const customStages = [
      ...DEFAULT_ACTIVE_STAGES,
      {
        code: 'rejected',
        label: 'Rejected',
        reviewer_role: 'admin',
        position: 70,
        is_active: true,
      },
    ];

    const rejectedStatus = resolveRejectionStatus({ stages: customStages });
    expect(rejectedStatus).toBe('rejected');
  });

  test('validateWorkflowStages returns warnings for missing required stages', () => {
    const validation = validateWorkflowStages([
      { code: 'pending_editor', label: 'Editor', reviewer_role: 'staff', position: 10, is_active: true },
    ]);

    expect(validation.ok).toBe(false);
    expect(validation.warnings.length).toBeGreaterThan(0);
  });

  test('resolveBypassTargets returns forward stages from current status', () => {
    const targets = resolveBypassTargets({
      stages: DEFAULT_ACTIVE_STAGES,
      currentStatus: 'pending_dean',
    });

    expect(targets).toEqual(expect.arrayContaining(['pending_dean', 'pending_program_chair', 'pending_editor', 'pending_admin', 'approved']));
    expect(targets).not.toContain('pending_faculty');
    expect(targets).not.toContain('rejected');
  });

  test('resolveBypassTargets falls back safely with empty stage list', () => {
    const targets = resolveBypassTargets({
      stages: [],
      currentStatus: 'pending_dean',
    });

    expect(targets).toEqual(expect.arrayContaining(['pending_dean', 'pending_editor', 'pending_admin', 'approved']));
  });
});
