jest.mock('../../config/supabase', () => ({
  from: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

jest.mock('../../utils/cache', () => ({
  getOrSet: jest.fn(async (_key, _ttl, fn) => fn()),
  TTL: { PUBLIC_STATS: 60 },
  invalidateBrowseCaches: jest.fn(),
}));

const supabase = require('../../config/supabase');
const submissionController = require('../../controllers/submission.controller');

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

function mockCountQuery(count, error = null) {
  return {
    select: () => ({
      in: () => ({
        is: async () => ({ count, error }),
      }),
      eq: () => ({
        is: () => ({
          or: async () => ({ count, error }),
        }),
      }),
    }),
  };
}

describe('submission getPublicStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns research paper and active scholar counts', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        return mockCountQuery(42);
      }
      if (table === 'users') {
        return mockCountQuery(128);
      }
      return {};
    });

    const req = {};
    const res = createRes();

    await submissionController.getPublicStats(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          researchPapers: 42,
          activeScholars: 128,
          updatedAt: expect.any(String),
        }),
      })
    );
  });
});
