/**
 * auth.controller.test.js — M-001
 * Unit tests for register() and login() in auth.controller.js
 * Covers TC-AUTH-001 (duplicate email), TC-AUTH-002 (short password),
 * TC-AUTH-003 (invalid credentials), TC-AUTH-004 (email normalization / F-001 regression).
 */

jest.mock('../../config/supabase', () => ({
  from: jest.fn(),
}));
jest.mock('../../utils/audit', () => ({ logAuditEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../utils/systemPolicy', () => ({
  getSystemPolicy: jest.fn(),
  updateSystemPolicy: jest.fn(),
  SUPPORTED_FILE_TYPES: ['pdf', 'doc', 'docx'],
}));
jest.mock('../../utils/supabaseAuth', () => ({
  signInWithPassword: jest.fn(),
  refreshAuthSession: jest.fn(),
  ensureAuthUser: jest.fn(),
  deleteAuthUserById: jest.fn().mockResolvedValue(undefined),
  signUpWithConfirmation: jest.fn(),
  getAuthUserById: jest.fn(),
}));

const STUDENT_EMAIL_DOMAIN = 'students.nu-dasma.edu.ph';
const STAFF_EMAIL_DOMAIN = 'nu-dasma.edu.ph';
const studentEmail = (local) => `${local}@${STUDENT_EMAIL_DOMAIN}`;
const staffEmail = (local) => `${local}@${STAFF_EMAIL_DOMAIN}`;

const supabase = require('../../config/supabase');
const authController = require('../../controllers/auth.controller');
const { getSystemPolicy, updateSystemPolicy } = require('../../utils/systemPolicy');
const {
  signInWithPassword,
  refreshAuthSession,
  ensureAuthUser,
  deleteAuthUserById,
  signUpWithConfirmation,
  getAuthUserById,
} = require('../../utils/supabaseAuth');

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-that-is-32-chars!!';
});

function createRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json:   jest.fn().mockReturnThis(),
  };
  return res;
}

// ─── Register tests ────────────────────────────────────────────────────────────

describe('authController.register', () => {
  beforeEach(() => {
    ensureAuthUser.mockResolvedValue({
      user: { id: 'auth-user-1', email: studentEmail('user') },
      created: false,
    });
    signUpWithConfirmation.mockResolvedValue({
      data: {
        user: { id: 'auth-user-1', email: studentEmail('user') },
        session: {
          access_token: 'supabase-access-token',
          refresh_token: 'supabase-refresh-token',
        },
      },
      error: null,
    });
    signInWithPassword.mockResolvedValue({
      data: {
        session: {
          access_token: 'supabase-access-token',
          refresh_token: 'supabase-refresh-token',
        },
        user: { id: 'auth-user-1', email: studentEmail('user') },
      },
      error: null,
    });
    getAuthUserById.mockResolvedValue(null);
  });

  test('TC-AUTH-001: rejects when email already exists (returns 400 USER_EXISTS)', async () => {
    // register() checks DB only after role/password/email validation passes.
    // Set up: valid role+password, but DB returns existing user.
    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'u1', email: studentEmail('taken') }, error: null }),
            }),
          }),
          insert: () => ({
            select: () => ({ single: async () => ({ data: null, error: { message: 'duplicate' } }) }),
          }),
        };
      }
      return { insert: async () => ({ error: null }) };
    });

    const req = { body: { email: studentEmail('taken'), password: 'SecurePass1', fullName: 'Test User', role: 'student' } };
    const res = createRes();

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('USER_EXISTS');
  });

  test('TC-AUTH-002: rejects password shorter than 8 characters', async () => {
    const req = { body: { email: studentEmail('new'), password: 'short', fullName: 'Test User', role: 'student' } };
    const res = createRes();

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('WEAK_PASSWORD');
    expect(payload.error.message).toMatch(/8/);
  });

  test('TC-AUTH-002b: rejects missing required fields (email, password, fullName, role)', async () => {
    const req = { body: { fullName: 'No Email' } }; // missing email, password, role
    const res = createRes();

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error.code).toBe('INVALID_INPUT');
  });

  test('TC-AUTH-002c: rejects non-student role on public registration (returns 403)', async () => {
    const req = { body: { email: staffEmail('hacker'), password: 'SecurePass1', fullName: 'Attacker Admin', role: 'admin' } };
    const res = createRes();

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error.code).toBe('REGISTRATION_ROLE_NOT_ALLOWED');
  });

  test('maps BSIT program alias to the canonical program during student registration', async () => {
    let insertPayload;

    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          insert: (rows) => {
            insertPayload = rows[0];
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'student-1',
                    email: insertPayload.email,
                    first_name: insertPayload.first_name,
                    middle_name: insertPayload.middle_name,
                    last_name: insertPayload.last_name,
                    role: insertPayload.role,
                    department: insertPayload.department,
                    department_id: insertPayload.department_id,
                    program: insertPayload.program,
                    program_id: insertPayload.program_id,
                  },
                  error: null,
                }),
              }),
            };
          },
        };
      }

      if (table === 'programs') {
        const programRows = [
          {
            id: 'prog-1',
            name: 'BS Information Technology - Mobile and Web Applications',
            code: 'BSIT-MWA',
            department_id: 'dept-1',
            departments: { name: 'School of Engineering, Computing, and Architecture' },
          },
        ];
        return {
          select: () => {
            const chain = {
              eq: () => ({
                maybeSingle: async () => ({
                  data: programRows[0],
                  error: null,
                }),
              }),
            };
            chain.then = (resolve) => resolve({ data: programRows, error: null });
            return chain;
          },
        };
      }

      if (table === 'departments') {
        const departmentRows = [{ id: 'dept-1', name: 'School of Engineering, Computing, and Architecture' }];
        return {
          select: () => {
            const chain = {
              eq: () => ({
                maybeSingle: async () => ({
                  data: departmentRows[0],
                  error: null,
                }),
              }),
            };
            chain.then = (resolve) => resolve({ data: departmentRows, error: null });
            return chain;
          },
        };
      }

      return {};
    });

    const req = {
      body: {
        email: studentEmail('student'),
        password: 'SecurePass1',
        firstName: 'Test',
        lastName: 'Student',
        role: 'student',
        program: 'BSIT',
      },
    };
    const res = createRes();

    await authController.register(req, res);

    expect(insertPayload).toEqual(expect.objectContaining({
      role: 'student',
      department: 'School of Engineering, Computing, and Architecture',
      department_id: 'dept-1',
      program: 'BS Information Technology - Mobile and Web Applications',
      program_id: 'prog-1',
    }));
    expect(res.json).toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
  });
});

// ─── Login tests ───────────────────────────────────────────────────────────────

describe('authController.login', () => {
  test('TC-AUTH-003: returns 401 for incorrect password', async () => {
    signInWithPassword.mockResolvedValue({
      data: null,
      error: new Error('Invalid login credentials'),
    });

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('CorrectPassword', 10);

    // Only the users lookup matters here — wrong password short-circuits before token issuance
    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: 'u1', email: studentEmail('user'), password: hashedPassword, role: 'student', first_name: 'Test', middle_name: null, last_name: 'User', department: null, program: null },
                error: null,
              }),
            }),
          }),
        };
      }
      return { insert: async () => ({ error: null }) };
    });

    const req = { body: { email: studentEmail('user'), password: 'WrongPassword' } };
    const res = createRes();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
  });

  test('TC-AUTH-003b: returns 401 when user not found', async () => {
    signInWithPassword.mockResolvedValue({
      data: null,
      error: new Error('Invalid login credentials'),
    });

    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: null, error: { code: 'PGRST116', message: 'No rows' } }),
            }),
          }),
        };
      }
      return { insert: async () => ({ error: null }) };
    });

    const req = { body: { email: studentEmail('ghost'), password: 'AnyPass123' } };
    const res = createRes();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('TC-AUTH-004 (F-001 regression): email normalization — mixed case login succeeds', async () => {
    signInWithPassword.mockResolvedValue({
      data: {
        session: {
          access_token: 'supabase-access-token',
          refresh_token: 'supabase-refresh-token',
        },
        user: { id: 'auth-1', email: studentEmail('mixed') },
      },
      error: null,
    });

    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: (col, val) => ({
              single: async () => {
                expect(val).toBe(studentEmail('mixed'));
                return {
                  data: { id: 'u2', email: studentEmail('mixed'), password: 'unused-under-supabase-auth', role: 'student', first_name: 'Mixed', middle_name: null, last_name: 'Case', department: null, program: null },
                  error: null,
                };
              },
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }
      return { insert: async () => ({ error: null }) };
    });

    const req = { body: { email: 'MiXeD@STUDENTS.NU-DASMA.EDU.PH', password: 'SecurePass1' } };
    const res = createRes();

    await authController.login(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.token).toBeDefined();
    expect(payload.data.refreshToken).toBeDefined();
  });

  test('returns 403 when account is suspended', async () => {
    signInWithPassword.mockResolvedValue({
      data: {
        session: {
          access_token: 'supabase-access-token',
          refresh_token: 'supabase-refresh-token',
        },
        user: { id: 'auth-1', email: studentEmail('suspended') },
      },
      error: null,
    });

    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'u3',
                  email: studentEmail('suspended'),
                  password: 'unused-under-supabase-auth',
                  role: 'student',
                  is_active: false,
                  suspended_at: new Date().toISOString(),
                  suspended_reason: 'Policy violation',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return { insert: async () => ({ error: null }) };
    });

    const req = { body: { email: studentEmail('suspended'), password: 'SecurePass1' } };
    const res = createRes();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  test('refreshSession returns a renewed Supabase-backed session', async () => {
    refreshAuthSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
        },
        user: {
          email: studentEmail('student'),
        },
      },
      error: null,
    });

    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'student-1',
                  email: studentEmail('student'),
                  first_name: 'Test',
                  middle_name: null,
                  last_name: 'Student',
                  role: 'student',
                  department: 'SECA',
                  department_id: 'dept-1',
                  program: 'BSIT-MWA',
                  program_id: 'prog-1',
                  is_active: true,
                  suspended_at: null,
                  suspended_reason: null,
                },
                error: null,
              }),
            }),
          }),
        };
      }

      return {};
    });

    const req = { body: { refreshToken: 'refresh-token' } };
    const res = createRes();

    await authController.refreshSession(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.token).toBe('new-access-token');
    expect(payload.data.refreshToken).toBe('new-refresh-token');
    expect(payload.data.user.email).toBe(studentEmail('student'));
  });
});

describe('authController suspension management', () => {
  test('suspendUser blocks self-suspension', async () => {
    const req = {
      params: { id: 'admin-1' },
      user: { id: 'admin-1' },
      body: { reason: 'test' },
    };
    const res = createRes();

    await authController.suspendUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('reactivateUser clears suspension metadata', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          update: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'u9',
                    email: 'reactivate@test.com',
                    first_name: 'Re',
                    middle_name: null,
                    last_name: 'Activated',
                    role: 'faculty',
                    is_active: true,
                    suspended_at: null,
                    suspended_reason: null,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const req = { params: { id: 'u9' } };
    const res = createRes();

    await authController.reactivateUser(req, res);

    expect(res.json).toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.user.is_active).toBe(true);
    expect(payload.user.suspended_at).toBeNull();
  });
});

describe('authController.createPrivilegedUser', () => {
  test('creates a program chair with canonical program and department assignment', async () => {
    ensureAuthUser.mockResolvedValue({
      user: { id: 'auth-user-2', email: staffEmail('chair') },
      created: true,
    });

    let insertPayload;

    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: null, error: null }),
            }),
          }),
          insert: (rows) => {
            insertPayload = rows[0];
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'chair-1',
                    email: insertPayload.email,
                    first_name: insertPayload.first_name,
                    middle_name: insertPayload.middle_name,
                    last_name: insertPayload.last_name,
                    role: insertPayload.role,
                    department: insertPayload.department,
                    department_id: insertPayload.department_id,
                    program: insertPayload.program,
                    program_id: insertPayload.program_id,
                    created_at: '2026-04-10T00:00:00.000Z',
                  },
                  error: null,
                }),
              }),
            };
          },
        };
      }

      if (table === 'programs') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'prog-1',
                  name: 'BS Computer Engineering',
                  department_id: 'dept-1',
                  departments: { name: 'College of Engineering' },
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'departments') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 'dept-1', name: 'College of Engineering' },
                error: null,
              }),
            }),
          }),
        };
      }

      return {};
    });

    const req = {
      body: {
        email: staffEmail('chair'),
        password: 'SecurePass1',
        firstName: 'Program',
        lastName: 'Chair',
        role: 'program_chair',
        programId: 'prog-1',
      },
    };
    const res = createRes();

    await authController.createPrivilegedUser(req, res);

    expect(insertPayload).toEqual(expect.objectContaining({
      role: 'program_chair',
      department: 'College of Engineering',
      department_id: 'dept-1',
      program: 'BS Computer Engineering',
      program_id: 'prog-1',
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('authController.updateUser', () => {
  test('updates a program chair with canonical program and department assignment', async () => {
    let updatePayload;

    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'chair-1',
                  email: staffEmail('chair'),
                  role: 'program_chair',
                  first_name: 'Program',
                  middle_name: null,
                  last_name: 'Chair',
                  department: 'School of Engineering, Computing, and Architecture',
                  department_id: 'dept-1',
                  program: null,
                  program_id: null,
                  is_active: true,
                  suspended_at: null,
                  suspended_reason: null,
                  created_at: '2026-04-10T00:00:00.000Z',
                },
                error: null,
              }),
            }),
          }),
          update: (payload) => {
            updatePayload = payload;
            return {
              eq: () => ({
                select: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: 'chair-1',
                      email: staffEmail('chair'),
                      first_name: payload.first_name,
                      middle_name: payload.middle_name,
                      last_name: payload.last_name,
                      role: 'program_chair',
                      department: payload.department,
                      department_id: payload.department_id,
                      program: payload.program,
                      program_id: payload.program_id,
                      is_active: true,
                      suspended_at: null,
                      suspended_reason: null,
                      created_at: '2026-04-10T00:00:00.000Z',
                    },
                    error: null,
                  }),
                }),
              }),
            };
          },
        };
      }

      if (table === 'programs') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'prog-1',
                  name: 'BS Information Technology - Mobile and Web Applications',
                  department_id: 'dept-1',
                  departments: { name: 'School of Engineering, Computing, and Architecture' },
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'departments') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 'dept-1', name: 'School of Engineering, Computing, and Architecture' },
                error: null,
              }),
            }),
          }),
        };
      }

      return {};
    });

    const req = {
      params: { id: 'chair-1' },
      body: {
        firstName: 'Maria',
        lastName: 'Reyes',
        programId: 'prog-1',
      },
    };
    const res = createRes();

    await authController.updateUser(req, res);

    expect(updatePayload).toEqual(expect.objectContaining({
      first_name: 'Maria',
      last_name: 'Reyes',
      department: 'School of Engineering, Computing, and Architecture',
      department_id: 'dept-1',
      program: 'BS Information Technology - Mobile and Web Applications',
      program_id: 'prog-1',
    }));
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.user.program_id).toBe('prog-1');
  });
});

describe('authController.bulkImportUsersCsv', () => {
  test('normalizes program chair department and program during CSV import', async () => {
    ensureAuthUser.mockResolvedValue({
      user: { id: 'auth-user-3', email: staffEmail('chair') },
      created: true,
    });

    const insertedRows = [];

    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          insert: (rows) => {
            insertedRows.push(rows[0]);
            return Promise.resolve({ error: null });
          },
        };
      }

      if (table === 'programs') {
        return {
          select: async () => ({
            data: [
              {
                id: 'prog-1',
                name: 'BS Computer Engineering',
                code: 'BSCPE',
                department_id: 'dept-1',
                departments: { name: 'College of Engineering' },
              },
            ],
            error: null,
          }),
        };
      }

      if (table === 'departments') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 'dept-1', name: 'College of Engineering' },
                error: null,
              }),
            }),
          }),
        };
      }

      return {};
    });

    const req = {
      file: {
        buffer: Buffer.from([
          'email,password,role,firstName,lastName,department,program',
          `${staffEmail('chair')},SecurePass1,program_chair,Program,Chair,College of Engineering,BS Computer Engineering`,
        ].join('\n')),
      },
    };
    const res = createRes();

    await authController.bulkImportUsersCsv(req, res);

    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toEqual(expect.objectContaining({
      role: 'program_chair',
      department: 'College of Engineering',
      department_id: 'dept-1',
      program: 'BS Computer Engineering',
      program_id: 'prog-1',
    }));

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.created).toBe(1);
  });
});

describe('authController.getSystemHealth', () => {
  test('returns aggregated health metrics and cleanup backlog in success envelope', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'audit_logs') {
        return {
          select: () => ({
            gte: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    { action: 'login_success', created_at: new Date().toISOString() },
                    { action: 'ai_review_summary', created_at: new Date().toISOString() },
                    { action: 'ai_review_summary_failed', created_at: new Date().toISOString() },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'research_papers') {
        return {
          select: () => ({
            is: async () => ({
              data: [
                {
                  id: 'paper-legacy-1',
                  title: 'Legacy Pending Paper',
                  file_size: 1024 * 1024,
                  status: 'pending',
                  category: 'legacy-a',
                  external_author_notes: 'External Collaborator',
                },
                {
                  id: 'paper-current-1',
                  title: 'Current Admin Paper',
                  file_size: 2 * 1024 * 1024,
                  status: 'pending_admin',
                  category: '4ec6a72b-9d2a-43ae-a034-d1e7a3b3535d',
                  external_author_notes: null,
                },
              ],
              error: null,
            }),
          }),
        };
      }

      if (table === 'research_authors') {
        return {
          select: async () => ({
            data: [{ user_id: 'faculty-user-id' }],
            error: null,
          }),
        };
      }

      if (table === 'submission_drafts') {
        return {
          select: async () => ({
            data: [],
            error: null,
          }),
        };
      }

      if (table === 'co_author_invitations') {
        return {
          select: async () => ({
            data: [],
            error: null,
          }),
        };
      }

      if (table === 'notifications') {
        return {
          select: async () => ({
            data: [],
            error: null,
          }),
        };
      }

      if (table === 'users') {
        return {
          select: async () => ({
            data: [
              { id: 'student-user-id', email: 'student@example.com', role: 'student', department_id: null, program_id: null },
              { id: 'chair-user-id', email: 'chair@example.com', role: 'program_chair', department_id: 'dept-1', program_id: null },
              { id: 'faculty-user-id', email: 'faculty@example.com', role: 'faculty', department_id: 'dept-1', program_id: null },
              { id: 'admin-user-id', email: 'admin@example.com', role: 'admin', department_id: null, program_id: null },
            ],
            error: null,
          }),
        };
      }

      if (table === 'faculty_reviews') {
        return {
          select: async () => ({
            data: [],
            error: null,
          }),
        };
      }

      if (table === 'author_invitations') {
        return {
          select: async () => ({
            data: [{ id: 'invite-1' }],
            error: null,
          }),
        };
      }

      if (table === 'system_policies') {
        return {
          select: async () => ({
            data: [{ id: 'policy-1' }, { id: 'policy-2' }],
            error: null,
          }),
        };
      }

      return {};
    });

    const req = { user: { id: 'admin-1', role: 'admin' } };
    const res = createRes();

    await authController.getSystemHealth(req, res);

    expect(res.json).toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.storage.totalMB).toBeGreaterThan(0);
    expect(payload.data.workflow.pendingFaculty).toBe(0);
    expect(payload.data.ai.requests30d).toBeGreaterThan(0);
    expect(payload.data.cleanup.usersMissingDepartment).toBe(1);
    expect(payload.data.cleanup.scopedUsersMissingProgram).toBe(2);
    expect(payload.data.cleanup.unresolvedUsers).toEqual([
      {
        id: 'chair-user-id',
        email: 'chair@example.com',
        role: 'program_chair',
        missingDepartment: false,
        missingProgram: true,
        orphaned: true,
      },
      {
        id: 'student-user-id',
        email: 'student@example.com',
        role: 'student',
        missingDepartment: true,
        missingProgram: true,
        orphaned: true,
      },
    ]);
    expect(payload.data.cleanup.orphanedUnresolvedUsers).toBe(2);
    expect(payload.data.cleanup.legacyWorkflowStatusPapers).toBe(1);
    expect(payload.data.cleanup.legacyWorkflowStatuses).toEqual([
      {
        id: 'paper-legacy-1',
        title: 'Legacy Pending Paper',
        status: 'pending',
      },
    ]);
    expect(payload.data.cleanup.unresolvedCategoryPapers).toBe(1);
    expect(payload.data.cleanup.unresolvedCategoryValues).toEqual([{ value: 'legacy-a', count: 1 }]);
    expect(payload.data.cleanup.papersUsingExternalAuthorNotes).toBe(1);
    expect(payload.data.cleanup.externalAuthorNoteMismatches).toBe(0);
    expect(payload.data.cleanup.coAuthorsCompatibilityWindowActive).toBe(false);
    expect(payload.data.cleanup.coAuthorsRetirementBlocked).toBe(false);
    expect(payload.data.cleanup.legacyTableRows).toEqual({
      facultyReviews: 0,
      authorInvitations: 1,
      systemPolicies: 2,
    });
  });
});

describe('authController system policy settings', () => {
  test('getSubmissionPolicy returns policy in success envelope', async () => {
    getSystemPolicy.mockResolvedValueOnce({ maxFileSizeMb: 12, allowedFileTypes: ['pdf', 'docx'] });

    const req = { user: { id: 'u1' } };
    const res = createRes();

    await authController.getSubmissionPolicy(req, res);

    expect(res.json).toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.maxFileSizeMb).toBe(12);
    expect(payload.data.allowedFileTypes).toContain('docx');
  });

  test('updateSystemPolicySettings validates and persists payload', async () => {
    updateSystemPolicy.mockResolvedValueOnce({ maxFileSizeMb: 8, allowedFileTypes: ['pdf'] });

    const req = {
      user: { id: 'admin-1', role: 'admin' },
      body: { maxFileSizeMb: 8, allowedFileTypes: ['pdf'] },
    };
    const res = createRes();

    await authController.updateSystemPolicySettings(req, res);

    expect(updateSystemPolicy).toHaveBeenCalledWith({
      maxFileSizeMb: 8,
      allowedFileTypes: ['pdf'],
      updatedBy: 'admin-1',
    });

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.maxFileSizeMb).toBe(8);
  });
});
