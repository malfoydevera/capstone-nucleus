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

const supabase = require('../../config/supabase');
const authController = require('../../controllers/auth.controller');
const { getSystemPolicy, updateSystemPolicy } = require('../../utils/systemPolicy');

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
  test('TC-AUTH-001: rejects when email already exists (returns 400 USER_EXISTS)', async () => {
    // register() checks DB only after role/password/email validation passes.
    // Set up: valid role+password, but DB returns existing user.
    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { id: 'u1', email: 'taken@test.com' }, error: null }),
            }),
          }),
          insert: () => ({
            select: () => ({ single: async () => ({ data: null, error: { message: 'duplicate' } }) }),
          }),
        };
      }
      return { insert: async () => ({ error: null }) };
    });

    const req = { body: { email: 'taken@test.com', password: 'SecurePass1', fullName: 'Test User', role: 'student' } };
    const res = createRes();

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('USER_EXISTS');
  });

  test('TC-AUTH-002: rejects password shorter than 8 characters', async () => {
    const req = { body: { email: 'new@test.com', password: 'short', fullName: 'Test User', role: 'student' } };
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
    const req = { body: { email: 'hacker@test.com', password: 'SecurePass1', fullName: 'Attacker', role: 'admin' } };
    const res = createRes();

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error.code).toBe('REGISTRATION_ROLE_NOT_ALLOWED');
  });
});

// ─── Login tests ───────────────────────────────────────────────────────────────

describe('authController.login', () => {
  test('TC-AUTH-003: returns 401 for incorrect password', async () => {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('CorrectPassword', 10);

    // Only the users lookup matters here — wrong password means refresh_tokens is never reached
    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: 'u1', email: 'user@test.com', password: hashedPassword, role: 'student', first_name: 'Test', middle_name: null, last_name: 'User', department: null, program: null },
                error: null,
              }),
            }),
          }),
        };
      }
      return { insert: async () => ({ error: null }) };
    });

    const req = { body: { email: 'user@test.com', password: 'WrongPassword' } };
    const res = createRes();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
  });

  test('TC-AUTH-003b: returns 401 when user not found', async () => {
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

    const req = { body: { email: 'ghost@test.com', password: 'AnyPass123' } };
    const res = createRes();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('TC-AUTH-004 (F-001 regression): email normalization — mixed case login succeeds', async () => {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('SecurePass1', 10);

    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: (col, val) => ({
              single: async () => {
                // Verify the controller lowercased the email before querying
                expect(val).toBe('mixed@test.com');
                return {
                  data: { id: 'u2', email: 'mixed@test.com', password: hashedPassword, role: 'student', first_name: 'Mixed', middle_name: null, last_name: 'Case', department: null, program: null },
                  error: null,
                };
              },
            }),
          }),
        };
      }
      // refresh_tokens insert (S-005)
      if (table === 'refresh_tokens') {
        return { insert: async () => ({ error: null }) };
      }
      return { insert: async () => ({ error: null }) };
    });

    const req = { body: { email: 'MiXeD@Test.COM', password: 'SecurePass1' } };
    const res = createRes();

    await authController.login(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.token).toBeDefined();
    expect(payload.data.refreshToken).toBeDefined(); // S-005
  });

  test('returns 403 when account is suspended', async () => {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('SecurePass1', 10);

    supabase.from.mockImplementation((table) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'u3',
                  email: 'suspended@test.com',
                  password: hashedPassword,
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

    const req = { body: { email: 'suspended@test.com', password: 'SecurePass1' } };
    const res = createRes();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error.code).toBe('ACCOUNT_SUSPENDED');
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

describe('authController.getSystemHealth', () => {
  test('returns aggregated health metrics in success envelope', async () => {
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
                { file_size: 1024 * 1024, status: 'pending_faculty' },
                { file_size: 2 * 1024 * 1024, status: 'pending_admin' },
              ],
              error: null,
            }),
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
    expect(payload.data.workflow.pendingFaculty).toBe(1);
    expect(payload.data.ai.requests30d).toBeGreaterThan(0);
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
