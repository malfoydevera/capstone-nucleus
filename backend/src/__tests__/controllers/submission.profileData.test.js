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

describe('submission getProfileResearchData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('filters by department_id and program_id when provided', async () => {
    const eqCalls = [];

    const researchQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      eq: jest.fn((column, value) => {
        eqCalls.push([column, value]);
        return researchQuery;
      }),
      ilike: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      then: (resolve) => resolve({
        data: [
          {
            id: 'paper-1',
            title: 'Profile Paper',
            category: 'cat-1',
            status: 'approved',
            department: 'School of Engineering, Computing, and Architecture',
            department_id: 'dept-1',
            program_id: 'prog-1',
            keywords: ['ai'],
            submission_date: '2026-04-01T00:00:00.000Z',
            published_date: '2026-04-10T00:00:00.000Z',
            created_at: '2026-04-01T00:00:00.000Z',
            author_id: 'user-1',
            author: {
              id: 'user-1',
              first_name: 'Alice',
              middle_name: null,
              last_name: 'Author',
              email: 'alice@example.com',
              program: 'BS Information Technology - Mobile and Web Applications',
              program_id: 'prog-1',
              department: 'School of Engineering, Computing, and Architecture',
              department_id: 'dept-1',
            },
            research_authors: [
              {
                user_id: 'user-1',
                is_primary: true,
                author_order: 1,
                author: {
                  id: 'user-1',
                  first_name: 'Alice',
                  middle_name: null,
                  last_name: 'Author',
                  email: 'alice@example.com',
                },
              },
              {
                user_id: 'user-2',
                is_primary: false,
                author_order: 2,
                author: {
                  id: 'user-2',
                  first_name: 'Bob',
                  middle_name: null,
                  last_name: 'Coauthor',
                  email: 'bob@example.com',
                },
              },
            ],
          },
        ],
        error: null,
      }),
    };

    const categoriesQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn(async () => ({
        data: [{ id: 'cat-1', name: 'Artificial Intelligence' }],
        error: null,
      })),
    };

    const departmentsQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn(async () => ({
        data: [{ id: 'dept-1', name: 'School of Engineering, Computing, and Architecture', code: 'SECA' }],
        error: null,
      })),
    };

    const programsQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn(async () => ({
        data: [{ id: 'prog-1', name: 'BS Information Technology - Mobile and Web Applications', code: 'BSIT-MWA', department_id: 'dept-1' }],
        error: null,
      })),
    };

    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') return researchQuery;
      if (table === 'research_categories') return categoriesQuery;
      if (table === 'departments') return departmentsQuery;
      if (table === 'programs') return programsQuery;
      return {};
    });

    const req = {
      user: { id: 'user-1', role: 'student' },
      query: {
        departmentId: 'dept-1',
        programId: 'prog-1',
      },
    };
    const res = createRes();

    await submissionController.getProfileResearchData(req, res);

    expect(eqCalls).toEqual(expect.arrayContaining([
      ['author_id', 'user-1'],
      ['department_id', 'dept-1'],
      ['program_id', 'prog-1'],
    ]));

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.records[0].program).toBe('BS Information Technology - Mobile and Web Applications');
    expect(payload.data.records[0].category).toBe('Artificial Intelligence');
    expect(payload.data.records[0].details.coAuthors).toBe('Bob Coauthor');
    expect(payload.data.records[0].details.structuredAuthors).toHaveLength(2);
  });

  test('resolves department and program name filters to canonical ids before querying', async () => {
    const eqCalls = [];

    const researchQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      eq: jest.fn((column, value) => {
        eqCalls.push([column, value]);
        return researchQuery;
      }),
      ilike: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      then: (resolve) => resolve({ data: [], error: null }),
    };

    const categoriesQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn(async () => ({ data: [], error: null })),
    };

    const departmentsQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn(async () => ({
        data: [{ id: 'dept-1', name: 'School of Engineering, Computing, and Architecture', code: 'SECA' }],
        error: null,
      })),
    };

    const programsQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn(async () => ({
        data: [{ id: 'prog-1', name: 'BS Information Technology - Mobile and Web Applications', code: 'BSIT-MWA', department_id: 'dept-1' }],
        error: null,
      })),
    };

    supabase.from.mockImplementation((table) => {
      if (table === 'research_papers') return researchQuery;
      if (table === 'research_categories') return categoriesQuery;
      if (table === 'departments') return departmentsQuery;
      if (table === 'programs') return programsQuery;
      return {};
    });

    const req = {
      user: { id: 'user-1', role: 'student' },
      query: {
        department: 'SECA',
        program: 'BSIT-MWA',
      },
    };
    const res = createRes();

    await submissionController.getProfileResearchData(req, res);

    expect(eqCalls).toEqual(expect.arrayContaining([
      ['author_id', 'user-1'],
      ['department_id', 'dept-1'],
      ['program_id', 'prog-1'],
    ]));
  });
});
