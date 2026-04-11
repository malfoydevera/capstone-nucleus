jest.mock('../../config/supabase', () => ({
  from: jest.fn(),
  auth: {
    getUser: jest.fn(),
  },
}));

const jwt = require('jsonwebtoken');
const supabase = require('../../config/supabase');
const {
  authenticate,
  authorize,
  isFaculty,
  isStaffOrAdmin,
  isDean,
  isDeanOrProgramChair,
} = require('../../middleware/auth.middleware');

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('auth.middleware', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('authenticate sets req.user for valid legacy token and current DB user', async () => {
    const token = jwt.sign({ id: 'u1', role: 'student' }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createRes();
    const next = jest.fn();

    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'u1',
                  email: 'user@example.com',
                  first_name: 'Test',
                  middle_name: null,
                  last_name: 'User',
                  role: 'student',
                  department: null,
                  department_id: null,
                  program: null,
                  program_id: null,
                  is_active: true,
                  suspended_at: null,
                },
                error: null,
              }),
            }),
          }),
        };
      }

      return {};
    });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: 'u1', role: 'student', authSource: 'legacy_jwt' });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('authenticate rejects when token is missing', async () => {
    const req = { headers: {} };
    const res = createRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
  });

  test('authenticate rejects invalid token', async () => {
    const req = { headers: { authorization: 'Bearer invalid' } };
    const res = createRes();
    const next = jest.fn();

    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') });

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
  });

  test('authenticate rejects suspended users even when token is valid', async () => {
    const token = jwt.sign({ id: 'u1', role: 'student' }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createRes();
    const next = jest.fn();

    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'u1',
                  email: 'user@example.com',
                  first_name: 'Suspended',
                  middle_name: null,
                  last_name: 'User',
                  role: 'student',
                  department: null,
                  department_id: null,
                  program: null,
                  program_id: null,
                  is_active: false,
                  suspended_at: '2026-04-10T00:00:00.000Z',
                  suspended_reason: 'Policy violation',
                },
                error: null,
              }),
            }),
          }),
        };
      }

      return {};
    });

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Account suspended: Policy violation' });
  });

  test('authenticate falls back to email lookup when Supabase auth user id does not match public.users.id', async () => {
    const req = { headers: { authorization: 'Bearer supabase-token' } };
    const res = createRes();
    const next = jest.fn();

    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'auth-u1',
          email: 'user@example.com',
        },
      },
      error: null,
    });

    let lookupCount = 0;
    supabase.from.mockImplementation((table) => {
      if (table !== 'users') return {};
      return {
        select: () => ({
          eq: (_column, value) => ({
            maybeSingle: async () => {
              lookupCount += 1;
              if (value === 'auth-u1') {
                return { data: null, error: null };
              }

              return {
                data: {
                  id: 'public-u1',
                  email: 'user@example.com',
                  first_name: 'Test',
                  middle_name: null,
                  last_name: 'User',
                  role: 'student',
                  department: null,
                  department_id: null,
                  program: null,
                  program_id: null,
                  is_active: true,
                  suspended_at: null,
                },
                error: null,
              };
            },
          }),
        }),
      };
    });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(lookupCount).toBe(2);
    expect(req.user).toMatchObject({
      id: 'public-u1',
      email: 'user@example.com',
      authSource: 'supabase_auth',
    });
  });

  test('authenticate resolves department and program labels from canonical ids when lookups are available', async () => {
    const token = jwt.sign({ id: 'u1', role: 'student' }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createRes();
    const next = jest.fn();

    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'u1',
                  email: 'user@example.com',
                  first_name: 'Test',
                  middle_name: null,
                  last_name: 'User',
                  role: 'student',
                  department: 'SECA',
                  department_id: 'dept-1',
                  program: 'BSIT-MWA',
                  program_id: 'prog-1',
                  is_active: true,
                  suspended_at: null,
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'departments') {
        return {
          select: async () => ({
            data: [{ id: 'dept-1', name: 'School of Engineering, Computing, and Architecture' }],
            error: null,
          }),
        };
      }

      if (table === 'programs') {
        return {
          select: async () => ({
            data: [{ id: 'prog-1', name: 'BS Information Technology - Mobile and Web Applications' }],
            error: null,
          }),
        };
      }

      return {};
    });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user.department).toBe('School of Engineering, Computing, and Architecture');
    expect(req.user.program).toBe('BS Information Technology - Mobile and Web Applications');
  });

  test('authorize allows required role', () => {
    const req = { user: { role: 'staff' } };
    const res = createRes();
    const next = jest.fn();

    authorize('staff', 'admin')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('authorize blocks disallowed role', () => {
    const req = { user: { role: 'student' } };
    const res = createRes();
    const next = jest.fn();

    authorize('staff', 'admin')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
  });

  test('role helpers enforce expected access', () => {
    const res = createRes();
    const next = jest.fn();

    isFaculty({ user: { role: 'faculty' } }, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    const res2 = createRes();
    const next2 = jest.fn();
    isStaffOrAdmin({ user: { role: 'student' } }, res2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(res2.status).toHaveBeenCalledWith(403);

    const res3 = createRes();
    const next3 = jest.fn();
    isDean({ user: { role: 'dean' } }, res3, next3);
    expect(next3).toHaveBeenCalledTimes(1);

    const res4 = createRes();
    const next4 = jest.fn();
    isDeanOrProgramChair({ user: { role: 'program_chair' } }, res4, next4);
    expect(next4).toHaveBeenCalledTimes(1);
  });
});
