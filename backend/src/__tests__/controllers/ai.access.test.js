/**
 * ai.access.test.js — M-001 (TC-AI-001)
 * Tests that chatWithPaper() enforces access control and validates input.
 */

jest.mock('../../config/supabase', () => ({ from: jest.fn() }));
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      startChat: () => ({ sendMessage: async () => ({ response: { text: () => 'ok' } }) }),
    }),
  })),
}));

const supabase = require('../../config/supabase');
const aiController = require('../../controllers/ai.controller');

function createRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

beforeAll(() => {
  process.env.GOOGLE_API_KEY = 'fake-key';
  process.env.SUPABASE_URL   = 'https://example.supabase.co';
});

describe('aiController.chatWithPaper', () => {
  test('TC-AI-001a: returns 400 when paperId is missing', async () => {
    const req = { body: { message: 'hello' }, user: { id: 'u1', role: 'student' } };
    const res = createRes();

    await aiController.chatWithPaper(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
  });

  test('TC-AI-001b: returns 403 when user cannot access the paper', async () => {
    // Simulate paper belonging to a different student (no access)
    supabase.from.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: 'paper-1',
              status: 'pending_faculty',
              author_id: 'other-user',
              faculty_id: 'fac-1',
              dean_chair_id: null,
              file_url: 'https://example.supabase.co/storage/v1/object/public/research-papers/x.pdf',
            },
            error: null,
          }),
        }),
      }),
    });

    const req = {
      body: { paperId: 'paper-1', message: 'explain this' },
      user: { id: 'u1', role: 'student' }, // not the author, not faculty
    };
    const res = createRes();

    await aiController.chatWithPaper(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('TC-AI-001c: returns 404 when paper not found', async () => {
    supabase.from.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: { message: 'No rows' } }),
        }),
      }),
    });

    const req = {
      body: { paperId: 'nonexistent', message: 'hello' },
      user: { id: 'u1', role: 'admin' },
    };
    const res = createRes();

    await aiController.chatWithPaper(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
