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

  test('adminPublishResearch only updates supported publish fields', async () => {
    let updatePayload;

    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'paper-1',
                  status: 'approved',
                  title: 'Paper',
                  author_id: 'author-1',
                  doi: null,
                },
                error: null,
              }),
            }),
          }),
          update: (payload) => {
            updatePayload = payload;
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({
                    data: {
                      id: 'paper-1',
                      author_id: 'author-1',
                      title: 'Paper',
                      status: 'published',
                      published_date: '2026-04-10T00:00:00.000Z',
                      doi: '10.1000/182',
                      author: {
                        id: 'author-1',
                        first_name: 'Author',
                        middle_name: null,
                        last_name: 'One',
                        email: 'author@example.com',
                      },
                    },
                    error: null,
                  }),
                }),
              }),
            };
          },
        };
      }

      if (table === 'notifications') {
        return {
          insert: async () => ({ error: null }),
        };
      }

      return {};
    });

    const req = {
      params: { id: 'paper-1' },
      user: { id: 'admin-1', role: 'admin' },
      body: { doi: '10.1000/182' },
    };
    const res = createRes();

    await adminController.adminPublishResearch(req, res);

    expect(updatePayload).toEqual(expect.objectContaining({ status: 'published', doi: '10.1000/182' }));
    expect(updatePayload).not.toHaveProperty('is_published');
    expect(res.json).toHaveBeenCalled();
  });

  test('getAllResearch returns structured_authors for staff/admin repository consumers', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        return {
          select: () => ({
            order: async () => ({
              data: [
                {
                  id: 'paper-1',
                  title: 'Canonical Authors',
                  status: 'approved',
                  external_author_notes: 'External Collaborator',
                  author: {
                    id: 'author-1',
                    first_name: 'Alice',
                    middle_name: null,
                    last_name: 'Author',
                    email: 'alice@example.com',
                  },
                  research_authors: [
                    {
                      user_id: 'author-2',
                      is_primary: false,
                      author_order: 1,
                      author: {
                        id: 'author-2',
                        first_name: 'Bob',
                        middle_name: null,
                        last_name: 'Contributor',
                        email: 'bob@example.com',
                      },
                    },
                    {
                      user_id: 'author-1',
                      is_primary: true,
                      author_order: 0,
                      author: {
                        id: 'author-1',
                        first_name: 'Alice',
                        middle_name: null,
                        last_name: 'Author',
                        email: 'alice@example.com',
                      },
                    },
                  ],
                },
              ],
              error: null,
            }),
          }),
        };
      }

      return {};
    });

    const req = { query: { includeDeleted: 'true' }, user: { id: 'staff-1', role: 'staff' } };
    const res = createRes();

    await adminController.getAllResearch(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.papers[0].structured_authors).toHaveLength(2);
    expect(payload.data.papers[0].structured_authors[0].author.full_name).toBe('Alice Author');
    expect(payload.data.papers[0].external_author_notes).toBe('External Collaborator');
  });

  test('adminUnpublishResearch only updates supported unpublish fields', async () => {
    let updatePayload;

    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        return {
          update: (payload) => {
            updatePayload = payload;
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({
                    data: {
                      id: 'paper-1',
                      author_id: 'author-1',
                      title: 'Paper',
                      status: 'approved',
                      published_date: null,
                      author: {
                        id: 'author-1',
                        first_name: 'Author',
                        middle_name: null,
                        last_name: 'One',
                        email: 'author@example.com',
                      },
                    },
                    error: null,
                  }),
                }),
              }),
            };
          },
        };
      }

      return {};
    });

    const req = { params: { id: 'paper-1' }, user: { id: 'admin-1', role: 'admin' } };
    const res = createRes();

    await adminController.adminUnpublishResearch(req, res);

    expect(updatePayload).toEqual(expect.objectContaining({ status: 'approved', published_date: null, doi: null }));
    expect(updatePayload).not.toHaveProperty('is_published');
    expect(res.json).toHaveBeenCalled();
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

  test('workflow stage mutations are disabled', async () => {
    const createReq = { body: { code: 'pending_qc', label: 'QC', reviewerRole: 'staff', position: 5 }, user: { id: 'admin-1', role: 'admin' } };
    const updateReq = { params: { stageId: 'stage-1' }, body: { isActive: false }, user: { id: 'admin-1', role: 'admin' } };
    const deleteReq = { params: { stageId: 'stage-1' }, user: { id: 'admin-1', role: 'admin' } };

    const createResponse = createRes();
    const updateResponse = createRes();
    const deleteResponse = createRes();

    await adminController.createWorkflowStage(createReq, createResponse);
    await adminController.updateWorkflowStage(updateReq, updateResponse);
    await adminController.deleteWorkflowStage(deleteReq, deleteResponse);

    for (const res of [createResponse, updateResponse, deleteResponse]) {
      expect(res.status).toHaveBeenCalledWith(409);
      const payload = res.json.mock.calls[0][0];
      expect(payload.success).toBe(false);
      expect(payload.error.code).toBe('WORKFLOW_STAGE_MUTATIONS_DISABLED');
    }

    expect(supabase.from).not.toHaveBeenCalled();
  });
});
