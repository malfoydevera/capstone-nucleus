jest.mock('../../config/supabase', () => ({
  from: jest.fn(),
  storage: {
    from: jest.fn(),
  },
  getPublicFileUrl: jest.fn(),
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
  resolvePaperFileUrl: jest.fn(async () => 'https://example.com/research.pdf'),
}));

jest.mock('../../utils/workflowEmail', () => ({
  sendPaperStatusEmail: jest.fn().mockResolvedValue(undefined),
  sendReviewAssignmentEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/systemPolicy', () => ({
  getSystemPolicy: jest.fn().mockResolvedValue({
    maxFileSizeMb: 10,
    allowedFileTypes: ['pdf'],
  }),
  isFileAllowedByPolicy: jest.fn(() => true),
}));

const supabase = require('../../config/supabase');
const submissionController = require('../../controllers/submission.controller');

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('submission submitResearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('resubmission with no selected co-author ids removes stale non-primary research_authors', async () => {
    const researchAuthorsDelete = jest.fn(() => ({
      eq: () => ({
        neq: async () => ({ error: null }),
      }),
    }));
    const researchAuthorsUpsert = jest.fn(async () => ({ error: null }));
    let researchUpsertPayload;

    let usersCallCount = 0;
    let researchPapersCallCount = 0;

    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        usersCallCount += 1;

        if (usersCallCount === 1) {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'student-1',
                    department: null,
                    department_id: null,
                    program: null,
                    program_id: null,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (usersCallCount === 2) {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    first_name: 'Stu',
                    middle_name: null,
                    last_name: 'Dent',
                    email: 'student@example.com',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        return {
          select: () => ({
            eq: async () => ({
              data: [],
              error: null,
            }),
          }),
        };
      }

      if (table === 'research_papers') {
        researchPapersCallCount += 1;

        if (researchPapersCallCount === 1) {
          return {
            upsert: (payload) => {
              researchUpsertPayload = payload;
              return {
                select: () => ({
                  single: async () => ({
                    data: {
                      id: 'paper-1',
                      title: 'Updated Title',
                      status: 'revision_required',
                    },
                    error: null,
                  }),
                }),
              };
            },
          };
        }

        return {
          update: () => ({
            eq: async () => ({ error: null }),
          }),
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  status: 'revision_required',
                  last_reviewer_role: 'faculty',
                  previous_status: null,
                  faculty_id: 'faculty-1',
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'research_authors') {
        return {
          delete: researchAuthorsDelete,
          upsert: researchAuthorsUpsert,
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
      body: {
        id: 'paper-1',
        title: 'Updated Title',
        abstract: 'Updated abstract',
        keywords: 'alpha, beta',
        category: 'category-1',
        facultyId: '',
        coAuthors: 'External Collaborator',
        externalAuthorNotes: 'External Collaborator',
      },
      file: null,
      user: { id: 'student-1', role: 'student' },
    };
    const res = createRes();

    await submissionController.submitResearch(req, res);

    expect(researchAuthorsDelete).toHaveBeenCalledTimes(1);
    expect(researchAuthorsUpsert).toHaveBeenCalledWith(
      {
        research_id: 'paper-1',
        user_id: 'student-1',
        author_order: 0,
        is_primary: true,
      },
      { onConflict: 'research_id,user_id' }
    );
    expect(researchUpsertPayload.external_author_notes).toBe('External Collaborator');

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.message).toMatch(/updated successfully/i);
  });
});
