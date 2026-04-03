jest.mock('../../config/supabase', () => ({
  from: jest.fn(),
}));
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));
jest.mock('../../utils/cache', () => ({
  getOrSet: jest.fn(async (_key, _ttl, fn) => fn()),
  TTL: {
    FACULTY: 60,
    DEAN_CHAIR: 60,
    CATEGORIES: 60,
  },
}));

const supabase = require('../../config/supabase');
const submissionController = require('../../controllers/submission.controller');

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('submission draft endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getMyDraft returns current user draft', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'submission_drafts') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  is: () => ({
                    maybeSingle: async () => ({
                      data: { id: 'd1', user_id: 'u1', draft_data: { title: 'Draft' } },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const req = { user: { id: 'u1' }, query: {} };
    const res = createRes();
    await submissionController.getMyDraft(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.draft.id).toBe('d1');
  });

  test('upsertMyDraft validates draftData object', async () => {
    const req = { user: { id: 'u1' }, body: { paperId: null, draftData: null } };
    const res = createRes();

    await submissionController.upsertMyDraft(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error.code).toBe('INVALID_INPUT');
  });

  test('upsertMyDraft saves payload', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'submission_drafts') {
        return {
          upsert: () => ({
            select: () => ({
              single: async () => ({
                data: {
                  id: 'd2',
                  user_id: 'u1',
                  paper_id: null,
                  draft_data: { title: 'Saved draft' },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const req = { user: { id: 'u1' }, body: { paperId: null, draftData: { title: 'Saved draft' } } };
    const res = createRes();
    await submissionController.upsertMyDraft(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.draft.id).toBe('d2');
  });

  test('deleteMyDraft returns success envelope', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'submission_drafts') {
        return {
          delete: () => ({
            eq: () => ({
              is: async () => ({ error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const req = { user: { id: 'u1' }, query: {} };
    const res = createRes();
    await submissionController.deleteMyDraft(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.message).toMatch(/Draft deleted/i);
  });
});
