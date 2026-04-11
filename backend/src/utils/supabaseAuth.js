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

module.exports = {
  signInWithPassword,
  refreshAuthSession,
  findAuthUserByEmail,
  ensureAuthUser,
  deleteAuthUserById,
  deleteAuthUserByEmail,
};
