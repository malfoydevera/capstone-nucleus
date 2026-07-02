require('dotenv').config();

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

// Resend the signup confirmation email via Supabase's built-in service.
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
  deleteAuthUserById,
  deleteAuthUserByEmail,
};
