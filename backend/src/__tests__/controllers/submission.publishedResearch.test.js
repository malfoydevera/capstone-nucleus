jest.mock('../../config/supabase', () => ({
  from: jest.fn(),
  rpc: jest.fn(async () => ({ data: [], error: null })),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

jest.mock('../../utils/fileAccess', () => ({
  canAccessPaper: jest.fn(() => true),
  extractStoragePathFromUrl: jest.fn(),
  isPublicPaperStatus: jest.fn(() => false),
  resolvePaperFileUrl: jest.fn(async () => 'https://example.com/published-paper.pdf'),
}));

const supabase = require('../../config/supabase');
const submissionController = require('../../controllers/submission.controller');

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('submission getPublishedResearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns canonical structured_authors and exposes external author notes separately from structured authorship', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'research_categories') {
        return {
          select: () => ({
            order: async () => ({
              data: [{ id: 'category-1', name: 'General' }],
              error: null,
            }),
          }),
        };
      }

      if (table !== 'research_papers') {
        return {};
      }

      const paperRows = [
                  {
                    id: 'paper-1',
                    title: 'Published Paper',
                    status: 'approved',
                    category: 'category-1',
                    external_author_notes: 'External Collaborator',
                    created_at: '2026-04-01T00:00:00.000Z',
                    published_date: '2026-04-02T00:00:00.000Z',
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
      ];

      const publishedQuery = {
        in: () => ({
          is: () => ({
            order: () => ({
              range: async () => ({
                data: paperRows,
                error: null,
                count: 1,
              }),
            }),
            eq: () => publishedQuery,
          }),
          eq: () => publishedQuery,
        }),
        is: () => publishedQuery,
        eq: () => publishedQuery,
      };

      return {
        select: () => publishedQuery,
      };
    });

    const req = { query: {}, user: { id: 'viewer-1', role: 'admin' } };
    const res = createRes();

    await submissionController.getPublishedResearch(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.papers).toHaveLength(1);
    expect(payload.data.total).toBe(1);
    expect(payload.data.page).toBe(1);
    expect(payload.data.facets).toBeDefined();
    expect(payload.data.papers[0].file_url).toBe('https://example.com/published-paper.pdf');
    expect(payload.data.papers[0].structured_authors).toHaveLength(2);
    expect(payload.data.papers[0].structured_authors[0].author.full_name).toBe('Alice Author');
    expect(payload.data.papers[0].structured_authors[1].author.full_name).toBe('Bob Contributor');
    expect(payload.data.papers[0].external_author_notes).toBe('External Collaborator');
  });
});
