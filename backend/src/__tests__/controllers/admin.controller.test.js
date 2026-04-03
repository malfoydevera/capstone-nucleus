jest.mock('../../config/supabase', () => ({
  from: jest.fn(),
}));

jest.mock('../../utils/workflowEngine', () => ({
  validateWorkflowStages: jest.fn(),
}));

const supabase = require('../../config/supabase');
const { validateWorkflowStages } = require('../../utils/workflowEngine');
const adminController = require('../../controllers/admin.controller');

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('admin controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('validateWorkflowStages returns validation payload', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'workflow_stages') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  {
                    code: 'pending_faculty',
                    label: 'Faculty Review',
                    reviewer_role: 'faculty',
                    position: 10,
                    is_active: true,
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }

      return {};
    });

    validateWorkflowStages.mockReturnValue({
      isValid: true,
      warnings: [],
    });

    const req = { user: { id: 'admin-1', role: 'admin' } };
    const res = createRes();

    await adminController.validateWorkflowStages(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.validation.isValid).toBe(true);
    expect(validateWorkflowStages).toHaveBeenCalledTimes(1);
  });

  test('validateWorkflowStages returns server error on query failure', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'workflow_stages') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: null,
                error: new Error('boom'),
              }),
            }),
          }),
        };
      }

      return {};
    });

    const req = { user: { id: 'admin-1', role: 'admin' } };
    const res = createRes();

    await adminController.validateWorkflowStages(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('VALIDATE_WORKFLOW_STAGES_FAILED');
  });
});
