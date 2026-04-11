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
jest.mock('../../utils/fileAccess', () => ({
  canAccessPaper: jest.fn(() => true),
  extractStoragePathFromUrl: jest.fn(),
  isPublicPaperStatus: jest.fn(() => false),
  resolvePaperFileUrl: jest.fn(async () => 'https://example.com/paper.pdf'),
}));

const supabase = require('../../config/supabase');
const submissionController = require('../../controllers/submission.controller');

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('submission getMyResearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns structured_authors for authored papers', async () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn(async () => ({
        data: [
          {
            id: 'paper-1',
            title: 'My Paper',
            author_id: 'author-1',
            status: 'revision_required',
            deleted_at: null,
            created_at: '2026-04-11T00:00:00.000Z',
            submission_date: '2026-04-11T00:00:00.000Z',
            research_authors: [
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
            ],
          },
        ],
        error: null,
      })),
    };

    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        return query;
      }

      return {};
    });

    const req = {
      user: { id: 'author-1', role: 'student' },
    };
    const res = createRes();

    await submissionController.getMyResearch(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.papers).toHaveLength(1);
    expect(payload.data.papers[0].file_url).toBe('https://example.com/paper.pdf');
    expect(payload.data.papers[0].structured_authors).toHaveLength(2);
    expect(payload.data.papers[0].structured_authors[1].author.full_name).toBe('Bob Contributor');
  });
});
