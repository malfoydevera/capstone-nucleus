jest.mock('../../config/supabase', () => ({
  from: jest.fn(),
}));

jest.mock('../../utils/audit', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

const supabase = require('../../config/supabase');
const { logAuditEvent } = require('../../utils/audit');
const researchController = require('../../controllers/research.controller');

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

function mockFetchPaper(paper) {
  supabase.from.mockImplementation((table) => {
    if (table === 'research_papers') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: paper, error: null }),
          }),
        }),
      };
    }

    return {
      insert: async () => ({ error: null }),
    };
  });
}

describe('research workflow endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('approveResearch rejects invalid transition', async () => {
    mockFetchPaper({
      id: 'p1',
      status: 'pending_admin',
      faculty_id: 'f1',
      dean_chair_id: 'd1',
      title: 'Paper',
      author_id: 'a1',
    });

    const req = {
      params: { id: 'p1' },
      body: { comments: 'ok' },
      user: { id: 'f1', role: 'faculty' },
    };
    const res = createRes();

    await researchController.approveResearch(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_WORKFLOW_TRANSITION');
  });

  test('rejectResearch requires reason', async () => {
    const req = {
      params: { id: 'p1' },
      body: {},
      user: { id: 'f1', role: 'faculty' },
    };
    const res = createRes();

    await researchController.rejectResearch(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error.code).toBe('INVALID_INPUT');
  });

  test('requestRevision rejects invalid transition', async () => {
    mockFetchPaper({
      id: 'p1',
      status: 'pending_admin',
      faculty_id: 'f1',
      dean_chair_id: 'd1',
      title: 'Paper',
      author_id: 'a1',
    });

    const req = {
      params: { id: 'p1' },
      body: { notes: 'need changes' },
      user: { id: 'f1', role: 'faculty' },
    };
    const res = createRes();

    await researchController.requestRevision(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error.code).toBe('INVALID_WORKFLOW_TRANSITION');
  });

  test('deanBypassApprove blocks finalized papers', async () => {
    mockFetchPaper({
      id: 'p1',
      status: 'approved',
      title: 'Done Paper',
      author_id: 'a1',
      author: { full_name: 'Author One' },
    });

    const req = {
      params: { id: 'p1' },
      body: { reason: 'urgent', targetStatus: 'approved' },
      user: { id: 'd1', role: 'dean' },
    };
    const res = createRes();

    await researchController.deanBypassApprove(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error.code).toBe('INVALID_WORKFLOW_TRANSITION');
  });

  test('rejectResearch success writes audit and returns success envelope', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'p1',
                  status: 'pending_faculty',
                  faculty_id: 'f1',
                  dean_chair_id: 'd1',
                  author_id: 'a1',
                  title: 'Paper',
                },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }

      if (table === 'approval_workflow') {
        return {
          insert: async () => ({ error: null }),
        };
      }

      return {
        insert: async () => ({ error: null }),
      };
    });

    const req = {
      params: { id: 'p1' },
      body: { reason: 'Not aligned yet' },
      user: { id: 'f1', role: 'faculty' },
    };
    const res = createRes();

    await researchController.rejectResearch(req, res);

    expect(res.json).toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.message).toBe('Research rejected successfully');
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
  });
});
