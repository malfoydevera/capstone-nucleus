require('dotenv').config();

// All authentication emails (signup confirmation, email change, password recovery)
// are sent exclusively by Supabase Auth's built-in email service. No third-party
// mail providers (e.g. Resend) are used for auth flows.

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase auth environment variables.');
}

let publicAuthClient;
let adminAuthClient;

function getPublicAuthClient() {
  if (!publicAuthClient) {
    publicAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return publicAuthClient;
}

function getAdminAuthClient() {
  if (!adminAuthClient) {
    adminAuthClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminAuthClient;
}

async function signInWithPassword(email, password) {
  return getPublicAuthClient().auth.signInWithPassword({ email, password });
}

async function refreshAuthSession(refreshToken) {
  return getPublicAuthClient().auth.refreshSession({ refresh_token: refreshToken });
}

// Public signup that makes Supabase send its built-in confirmation email.
// With "Confirm email" enabled, the returned session is null until confirmed.
async function signUpWithConfirmation({ email, password, emailRedirectTo, userMetadata = {} }) {
  return getPublicAuthClient().auth.signUp({
    email: String(email || '').trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo,
      data: userMetadata,
    },
  });
}

// Re-send the signup confirmation email via Supabase Auth (supabase.auth.resend).
async function resendSignupConfirmation({ email, emailRedirectTo }) {
  return getPublicAuthClient().auth.resend({
    type: 'signup',
    email: String(email || '').trim().toLowerCase(),
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });
}

async function getAuthUserById(authUserId) {
  if (!authUserId) return null;
  const adminClient = getAdminAuthClient();
  const { data, error } = await adminClient.auth.admin.getUserById(authUserId);
  if (error) {
    throw error;
  }
  return data?.user || null;
}

async function findAuthUserByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const adminClient = getAdminAuthClient();
  let page = 1;

  while (page <= 10) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    const users = data?.users || [];
    const found = users.find((user) => String(user.email || '').trim().toLowerCase() === normalizedEmail);
    if (found) {
      return found;
    }

    if (users.length < 200) {
      break;
    }

    page += 1;
  }

  return null;
}

async function ensureAuthUser({
  email,
  password,
  userMetadata = {},
  forcePasswordSync = false,
}) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const adminClient = getAdminAuthClient();
  const existingUser = await findAuthUserByEmail(normalizedEmail);

  if (existingUser) {
    if (password || forcePasswordSync) {
      const { data, error } = await adminClient.auth.admin.updateUserById(existingUser.id, {
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          ...(existingUser.user_metadata || {}),
          ...userMetadata,
        },
      });

      if (error) {
        throw error;
      }

      return {
        user: data.user,
        created: false,
      };
    }

    return {
      user: existingUser,
      created: false,
    };
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (error) {
    throw error;
  }

  return {
    user: data.user,
    created: true,
  };
}

async function updateAuthUserPasswordById(userId, password) {
  if (!userId) {
    throw new Error('A Supabase auth user id is required to update the password');
  }

  const adminClient = getAdminAuthClient();
  const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    throw error;
  }

  return data?.user || null;
}

async function deleteAuthUserById(userId) {
  if (!userId) return;
  const adminClient = getAdminAuthClient();
  await adminClient.auth.admin.deleteUser(userId);
}

async function deleteAuthUserByEmail(email) {
  const authUser = await findAuthUserByEmail(email);
  if (!authUser?.id) {
    return false;
  }

  await deleteAuthUserById(authUser.id);
  return true;
}

async function resetPasswordForEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Email is required');
  }

  return getPublicAuthClient().auth.resetPasswordForEmail(normalizedEmail);
}

async function verifyRecoveryOtp({ email, token }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedToken = String(token || '').trim();

  return getPublicAuthClient().auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedToken,
    type: 'recovery',
  });
}

async function updateAuthUserEmailById(authUserId, email) {
  if (!authUserId) {
    throw new Error('A Supabase auth user id is required to update the email');
  }

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const adminClient = getAdminAuthClient();
  const { data, error } = await adminClient.auth.admin.updateUserById(authUserId, {
    email: normalizedEmail,
    email_confirm: true,
  });

  if (error) {
    throw error;
  }

  return data?.user || null;
}

// Generate OTP helpers kept for optional custom mailers; auth flows use Supabase built-in email.
async function generateRecoveryEmailOtp({ currentAuthEmail, recoveryEmail }) {
  const adminClient = getAdminAuthClient();
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'email_change_new',
    email: String(currentAuthEmail).trim().toLowerCase(),
    newEmail: String(recoveryEmail).trim().toLowerCase(),
  });
  if (error) throw error;
  return data?.properties?.email_otp || null;
}

// Generate a password-reset OTP using Supabase Admin API (no email sent).
async function generatePasswordResetOtp({ authEmail }) {
  const adminClient = getAdminAuthClient();
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: String(authEmail).trim().toLowerCase(),
  });
  if (error) throw error;
  return data?.properties?.email_otp || null;
}

// Reset auth.users back to the confirmed institutional email so the next
// generateLink always starts from a clean state.
async function resetPendingEmailChange(authUserId, confirmedEmail) {
  if (!authUserId || !confirmedEmail) return;
  const adminClient = getAdminAuthClient();
  const { error } = await adminClient.auth.admin.updateUserById(authUserId, {
    email: String(confirmedEmail).trim().toLowerCase(),
    email_confirm: true,
  });
  if (error) {
    throw error;
  }
}

async function initiateRecoveryEmailChangeViaSupabase({
  accessToken,
  refreshToken,
  recoveryEmail,
  currentEmail,
  resendOnly = false,
  emailRedirectTo,
}) {
  if (!accessToken || !refreshToken) {
    throw new Error('Your session has expired. Please sign out and sign in again.');
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { error: sessionError } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) {
    throw sessionError;
  }

  const normalizedRecoveryEmail = String(recoveryEmail || '').trim().toLowerCase();
  const normalizedCurrentEmail = String(currentEmail || '').trim().toLowerCase();
  const redirectOptions = emailRedirectTo ? { emailRedirectTo } : undefined;

  if (resendOnly) {
    // GoTrue looks up the user by their CURRENT email, not the pending new one.
    const { error: resendError } = await client.auth.resend({
      type: 'email_change',
      email: normalizedCurrentEmail,
      options: redirectOptions,
    });

    if (!resendError) {
      return { method: 'resend' };
    }

    // Known workaround when resend silently fails: re-request the same change.
    const { error: updateError } = await client.auth.updateUser(
      { email: normalizedRecoveryEmail },
      redirectOptions
    );
    if (updateError) {
      throw updateError;
    }
    return { method: 'updateUser_resend_fallback' };
  }

  const { error: updateError } = await client.auth.updateUser(
    { email: normalizedRecoveryEmail },
    redirectOptions
  );
  if (updateError) {
    throw updateError;
  }

  return { method: 'updateUser' };
}

async function verifyEmailChangeOtp({ email, token }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedToken = String(token || '').trim();

  return getPublicAuthClient().auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedToken,
    type: 'email_change',
  });
}

module.exports = {
  signInWithPassword,
  refreshAuthSession,
  signUpWithConfirmation,
  resendSignupConfirmation,
  findAuthUserByEmail,
  getAuthUserById,
  ensureAuthUser,
  updateAuthUserPasswordById,
  updateAuthUserEmailById,
  resetPasswordForEmail,
  verifyRecoveryOtp,
  resetPendingEmailChange,
  verifyEmailChangeOtp,
  initiateRecoveryEmailChangeViaSupabase,
  generateRecoveryEmailOtp,
  generatePasswordResetOtp,
  deleteAuthUserById,
  deleteAuthUserByEmail,
};
