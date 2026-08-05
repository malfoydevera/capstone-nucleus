jest.mock('../../config/supabase', () => ({
  from: jest.fn(),
  auth: {
    getUser: jest.fn(),
  },
}));
jest.mock('../../utils/supabaseAuth', () => ({
  signInWithPassword: jest.fn(),
  updateAuthUserPasswordById: jest.fn(),
  ensureAuthUser: jest.fn(),
  getAuthUserById: jest.fn(),
  findAuthUserByEmail: jest.fn(),
  resetPendingEmailChange: jest.fn(),
  verifyEmailChangeOtp: jest.fn(),
  initiateRecoveryEmailChangeViaSupabase: jest.fn().mockResolvedValue({ method: 'updateUser' }),
}));
const supabase = require('../../config/supabase');
const {
  signInWithPassword,
  updateAuthUserPasswordById,
  ensureAuthUser,
  getAuthUserById,
  resetPendingEmailChange,
  verifyEmailChangeOtp,
  initiateRecoveryEmailChangeViaSupabase,
} = require('../../utils/supabaseAuth');
const authController = require('../../controllers/auth.controller');

function createRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('authController.changePassword legacy hash cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('clears legacy bcrypt hash after a successful Supabase password update', async () => {
    const updateEq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn(() => ({ eq: updateEq }));

    supabase.from.mockImplementation((table) => {
      if (table !== 'users') {
        return { update: jest.fn(() => ({ eq: jest.fn() })) };
      }

      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                id: 'user-1',
                email: 'william@students.com',
                auth_user_id: 'auth-1',
                password: '$2a$10$legacyhash',
                role: 'student',
              },
              error: null,
            }),
          })),
        })),
        update,
      };
    });

    getAuthUserById.mockResolvedValue({ id: 'auth-1', email: 'william@students.com' });
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'auth-1' } },
      error: null,
    });
    updateAuthUserPasswordById.mockResolvedValue({ id: 'auth-1' });

    const req = {
      body: { currentPassword: 'OldPass123', newPassword: 'NewPass123' },
      user: { id: 'user-1' },
      headers: {},
    };
    const res = createRes();

    await authController.changePassword(req, res);

    expect(updateAuthUserPasswordById).toHaveBeenCalledWith('auth-1', 'NewPass123');
    expect(update).toHaveBeenCalledWith({ password: null });
    expect(updateEq).toHaveBeenCalledWith('id', 'user-1');
    expect(res.status).not.toHaveBeenCalledWith(500);
  });
});

describe('authController.requestRecoveryEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPendingEmailChange.mockResolvedValue(undefined);
    getAuthUserById.mockResolvedValue({ id: 'auth-1', email: 'admin@nucleus.local' });
  });

  test('triggers Supabase built-in email server-side and never returns OTP', async () => {
    const updateEq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn(() => ({ eq: updateEq }));

    supabase.from.mockImplementation((table) => {
      if (table !== 'users') return {};

      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: 'user-1', email: 'admin@nucleus.local', auth_user_id: 'auth-1' },
              error: null,
            }),
          })),
        })),
        update,
      };
    });

    const req = {
      body: { recoveryEmail: 'jadefrancineb@gmail.com', refreshToken: 'test-refresh-token' },
      user: { id: 'user-1', email: 'admin@nucleus.local' },
      headers: { authorization: 'Bearer test-access-token' },
    };
    const res = createRes();

    await authController.requestRecoveryEmail(req, res);

    expect(initiateRecoveryEmailChangeViaSupabase).toHaveBeenCalledWith(
      expect.objectContaining({
        recoveryEmail: 'jadefrancineb@gmail.com',
        currentEmail: 'admin@nucleus.local',
        refreshToken: 'test-refresh-token',
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          deliveryProvider: 'supabase',
          recoveryEmail: 'jadefrancineb@gmail.com',
          supportsOtp: true,
        }),
      })
    );
    const responsePayload = res.json.mock.calls[0][0];
    expect(responsePayload.data?.devVerificationCode).toBeUndefined();
  });
});

describe('authController.confirmRecoveryEmailOtp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('verifies OTP and saves recovery email', async () => {
    supabase.from.mockImplementation((table) => {
      if (table !== 'users') {
        return {};
      }

      return {
        select: jest.fn(() => ({
          eq: jest.fn((field) => {
            if (field === 'recovery_email' || field === 'email' || field === 'auth_user_id') {
              return { maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) };
            }
            return { maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) };
          }),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'user-1',
                  email: 'william@students.com',
                  recovery_email: 'malfoydevera3@gmail.com',
                  first_name: 'William',
                  last_name: 'Test',
                  role: 'student',
                },
                error: null,
              }),
            })),
          })),
        })),
      };
    });

    verifyEmailChangeOtp.mockResolvedValue({
      data: { user: { id: 'auth-1', email: 'malfoydevera3@gmail.com' } },
      error: null,
    });

    const req = {
      body: { recoveryEmail: 'malfoydevera3@gmail.com', code: '123456' },
      user: { id: 'user-1', email: 'william@students.com' },
      headers: {},
    };
    const res = createRes();

    await authController.confirmRecoveryEmailOtp(req, res);

    expect(verifyEmailChangeOtp).toHaveBeenCalledWith({
      email: 'malfoydevera3@gmail.com',
      token: '123456',
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: expect.stringContaining('saved successfully'),
      })
    );
  });
});
