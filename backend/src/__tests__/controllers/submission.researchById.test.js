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

describe('submission getResearchById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns structured_authors when research_authors rows exist', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'paper-1',
                  title: 'Structured Authors Paper',
                  status: 'approved',
                  deleted_at: null,
                  author_id: 'author-1',
                  author: {
                    id: 'author-1',
                    first_name: 'Alice',
                    middle_name: null,
                    last_name: 'Author',
                    email: 'alice@example.com',
                  },
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
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'approval_workflow') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }

      return {};
    });

    const req = {
      params: { id: 'paper-1' },
      user: { id: 'author-1', role: 'student' },
    };
    const res = createRes();

    await submissionController.getResearchById(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.paper.file_url).toBe('https://example.com/paper.pdf');
    expect(payload.data.paper.structured_authors).toHaveLength(2);
    expect(payload.data.paper.structured_authors[0].author.full_name).toBe('Alice Author');
    expect(payload.data.paper.structured_authors[1].author.full_name).toBe('Bob Contributor');
  });
});
