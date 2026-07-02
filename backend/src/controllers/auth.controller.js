const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { attachFullName, buildFullName, normalizeNameParts, splitFullName } = require('../utils/name');
const { sendSuccess, sendError } = require('../utils/response');
const { getSystemPolicy, updateSystemPolicy, SUPPORTED_FILE_TYPES } = require('../utils/systemPolicy');
const { validatePasswordStrength } = require('../utils/passwordPolicy');
const { validateEmailDomainForRole, validateRecoveryEmail } = require('../utils/emailDomain');
const {
  signInWithPassword,
  refreshAuthSession,
  signUpWithConfirmation,
  resendSignupConfirmation,
  ensureAuthUser,
  updateAuthUserPasswordById,
  findAuthUserByEmail,
  getAuthUserById,
  resetPasswordForEmail,
  verifyRecoveryOtp,
  deleteAuthUserById,
  deleteAuthUserByEmail,
} = require('../utils/supabaseAuth');

function getConfirmationRedirectUrl() {
  const base = (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${base}/auth/callback`;
}

function getBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

function resolveAuthEmail(user) {
  if (!user) return '';
  const recoveryEmail = String(user.recovery_email || '').trim().toLowerCase();
  if (recoveryEmail) return recoveryEmail;
  return String(user.email || '').trim().toLowerCase();
}

// Authenticate against the account's OWN Supabase auth user. The auth user's
// current email is the source of truth for signInWithPassword — it may be the
// institutional email or (once a recovery email is verified) the recovery email.
// Never trust recovery_email directly here: it can belong to a different auth
// user, which would route the session to the wrong account.
async function resolveAuthLoginEmail(user) {
  if (!user) return '';
  if (user.auth_user_id) {
    try {
      const authUser = await getAuthUserById(user.auth_user_id);
      if (authUser?.email) {
        return String(authUser.email).trim().toLowerCase();
      }
    } catch (lookupError) {
      console.warn('[login] auth user lookup failed:', lookupError?.message || lookupError);
    }
  }
  return String(user.email || '').trim().toLowerCase();
}

async function getAuthEmailFromRequest(req) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.email) return null;
  return String(data.user.email).trim().toLowerCase();
}

const BULK_IMPORT_ALLOWED_ROLES = ['student', 'faculty', 'dean', 'program_chair', 'staff', 'admin'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeOrganizationKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

async function findProgramByIdentifier(identifier) {
  const normalizedIdentifier = normalizeOrganizationKey(identifier);
  if (!normalizedIdentifier) return null;

  const { data: programs, error } = await supabase
    .from('programs')
    .select('id, name, code, department_id, departments(name)');

  if (error) {
    throw error;
  }

  const rows = programs || [];
  const directMatch = rows.find((programRow) => {
    const normalizedName = normalizeOrganizationKey(programRow.name);
    const normalizedCode = normalizeOrganizationKey(programRow.code);
    return normalizedIdentifier === normalizedName || normalizedIdentifier === normalizedCode;
  });

  if (directMatch) {
    return directMatch;
  }

  if (normalizedIdentifier === 'bsit') {
    return rows.find((programRow) => {
      const normalizedName = normalizeOrganizationKey(programRow.name);
      const normalizedCode = normalizeOrganizationKey(programRow.code);
      return normalizedCode === 'bsit-mwa' || normalizedName.startsWith('bs-information-technology');
    }) || null;
  }

  return null;
}

function normalizeCsvHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  cells.push(current.trim());
  return cells;
}

function isUuid(value) {
  return UUID_PATTERN.test(String(value || '').trim());
}

async function getOrganizationLookups() {
  try {
    const [departmentsResult, programsResult] = await Promise.all([
      supabase.from('departments').select('id, name'),
      supabase.from('programs').select('id, name'),
    ]);

    if (departmentsResult?.error) throw departmentsResult.error;
    if (programsResult?.error) throw programsResult.error;

    return {
      departmentById: new Map((departmentsResult?.data || []).map((entry) => [entry.id, entry.name])),
      programById: new Map((programsResult?.data || []).map((entry) => [entry.id, entry.name])),
    };
  } catch {
    return {
      departmentById: new Map(),
      programById: new Map(),
    };
  }
}

function attachOrganizationLabels(user, organizationLookups = {}) {
  const department = user?.department_id && organizationLookups.departmentById?.has(user.department_id)
    ? organizationLookups.departmentById.get(user.department_id)
    : user?.department || null;
  const program = user?.program_id && organizationLookups.programById?.has(user.program_id)
    ? organizationLookups.programById.get(user.program_id)
    : user?.program || null;

  return {
    ...user,
    department,
    program,
  };
}

function formatUserResponse(user, organizationLookups = {}) {
  const normalizedUser = normalizeNameParts(user);
  const userWithOrgLabels = attachOrganizationLabels(user, organizationLookups);
  return {
    id: user.id,
    email: user.email,
    recoveryEmail: user.recovery_email || null,
    hasRecoveryEmail: Boolean(user.recovery_email),
    firstName: normalizedUser.first_name,
    middleName: normalizedUser.middle_name || '',
    lastName: normalizedUser.last_name,
    fullName: buildFullName(normalizedUser),
    role: user.role,
    department: userWithOrgLabels.department || null,
    departmentId: user.department_id || null,
    program: userWithOrgLabels.program || null,
    programId: user.program_id || null,
    bio: user.bio || null,
    createdAt: user.created_at || null,
  };
}

function buildAuthSuccessData(user, session, organizationLookups = {}) {
  return {
    token: session?.access_token || null,
    refreshToken: session?.refresh_token || null,
    user: formatUserResponse(user, organizationLookups),
  };
}

async function getOptionalTableRowCount(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('id');

    if (error) {
      throw error;
    }

    return (data || []).length;
  } catch (error) {
    if (/does not exist|relation .* does not exist|could not find the table .* in the schema cache/i.test(String(error?.message || ''))) {
      return 0;
    }

    throw error;
  }
}

async function resolveUserOrganizationAssignment({
  role,
  department,
  departmentId,
  program,
  programId,
  requireProgramForRoles = [],
}) {
  let resolvedDepartmentId = departmentId || null;
  let resolvedDepartmentName = department?.trim() || null;
  const supportsProgramAssignment = ['student', 'program_chair'].includes(role);
  let resolvedProgramId = supportsProgramAssignment ? (programId || null) : null;
  let resolvedProgramName = supportsProgramAssignment ? (program?.trim() || null) : null;

  if (requireProgramForRoles.includes(role) && !resolvedProgramId && !resolvedProgramName) {
    return {
      errorMessage: role === 'student'
        ? 'Program is required for student registration'
        : 'Program is required for program chair accounts',
    };
  }

  if (resolvedProgramId) {
    const { data: selectedProgram } = await supabase
      .from('programs')
      .select('id, name, department_id, departments(name)')
      .eq('id', resolvedProgramId)
      .maybeSingle();

    if (!selectedProgram) {
      return { errorMessage: 'Selected program is invalid.' };
    }

    resolvedProgramId = selectedProgram.id;
    resolvedProgramName = selectedProgram.name;
    resolvedDepartmentId = selectedProgram.department_id;
    resolvedDepartmentName = selectedProgram.departments?.name || resolvedDepartmentName;
  } else if (resolvedProgramName) {
    const selectedProgram = await findProgramByIdentifier(resolvedProgramName);

    if (selectedProgram) {
      resolvedProgramId = selectedProgram.id;
      resolvedProgramName = selectedProgram.name;
      resolvedDepartmentId = selectedProgram.department_id;
      resolvedDepartmentName = selectedProgram.departments?.name || resolvedDepartmentName;
    } else if (requireProgramForRoles.includes(role)) {
      return { errorMessage: 'Selected program is invalid.' };
    }
  }

  if (resolvedDepartmentId) {
    const { data: selectedDepartment } = await supabase
      .from('departments')
      .select('id, name')
      .eq('id', resolvedDepartmentId)
      .maybeSingle();

    if (!selectedDepartment) {
      return { errorMessage: 'Selected department is invalid.' };
    }

    resolvedDepartmentId = selectedDepartment.id;
    resolvedDepartmentName = selectedDepartment.name;
  } else if (resolvedDepartmentName) {
    const { data: selectedDepartment } = await supabase
      .from('departments')
      .select('id, name, code')
      .or(`name.eq.${resolvedDepartmentName},code.eq.${resolvedDepartmentName}`)
      .limit(1)
      .maybeSingle();

    if (selectedDepartment) {
      resolvedDepartmentId = selectedDepartment.id;
      resolvedDepartmentName = selectedDepartment.name;
    }
  }

  return {
    resolvedDepartmentId,
    resolvedDepartmentName,
    resolvedProgramId,
    resolvedProgramName,
  };
}

function isMissingProgramColumnError(error) {
  return String(error?.message || '').includes('program_id');
}

// Register new user (student self-registration with email confirmation)
exports.register = async (req, res) => {
  try {
    const {
      email,
      password,
      fullName,
      firstName,
      middleName,
      lastName,
      role,
      departmentId,
      programId,
      department,
      program,
    } = req.body;

    const parsedFromFullName = splitFullName(fullName);
    const normalizedNames = normalizeNameParts({
      first_name: firstName || parsedFromFullName.first_name || '',
      middle_name: middleName || parsedFromFullName.middle_name || '',
      last_name: lastName || parsedFromFullName.last_name || '',
    });
    const resolvedFirstName = normalizedNames.first_name;
    const resolvedMiddleName = normalizedNames.middle_name;
    const resolvedLastName = normalizedNames.last_name;

    if (!email || !password || !role || !resolvedFirstName || !resolvedLastName) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'All fields are required' });
    }

    const passwordStrength = validatePasswordStrength(password);
    if (!passwordStrength.valid) {
      return sendError(res, { status: 400, code: 'WEAK_PASSWORD', message: passwordStrength.message });
    }

    // Only students can self-register; all other roles are created by an admin.
    const allowedSelfRegisterRoles = ['student'];
    if (!allowedSelfRegisterRoles.includes(role)) {
      return sendError(res, {
        status: 403,
        code: 'REGISTRATION_ROLE_NOT_ALLOWED',
        message: 'This account type must be created by an administrator',
      });
    }

    const domainCheck = validateEmailDomainForRole(email, role);
    if (!domainCheck.valid) {
      return sendError(res, { status: 400, code: 'INVALID_EMAIL_DOMAIN', message: domainCheck.message });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      return sendError(res, { status: 400, code: 'USER_EXISTS', message: 'User already exists' });
    }

    const {
      resolvedDepartmentId,
      resolvedDepartmentName,
      resolvedProgramId,
      resolvedProgramName,
      errorMessage,
    } = await resolveUserOrganizationAssignment({
      role,
      department,
      departmentId,
      program,
      programId,
      requireProgramForRoles: ['student'],
    });

    if (errorMessage) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: errorMessage });
    }

    // Supabase public signUp creates an UNCONFIRMED auth user and sends the
    // built-in confirmation email. No session is issued until the user confirms.
    const { data: signUpData, error: signUpError } = await signUpWithConfirmation({
      email: normalizedEmail,
      password,
      emailRedirectTo: getConfirmationRedirectUrl(),
      userMetadata: { role },
    });

    if (signUpError) {
      const message = /registered|exists/i.test(signUpError.message || '')
        ? 'User already exists'
        : (signUpError.message || 'Failed to start registration');
      return sendError(res, { status: 400, code: 'REGISTER_FAILED', message });
    }

    const authUserId = signUpData?.user?.id || null;

    const profileRow = {
      email: normalizedEmail,
      first_name: resolvedFirstName,
      middle_name: resolvedMiddleName,
      last_name: resolvedLastName,
      role,
      department_id: resolvedDepartmentId,
      program_id: resolvedProgramId,
      department: resolvedDepartmentName,
      program: resolvedProgramName,
      auth_user_id: authUserId,
    };

    let insertResult = await supabase
      .from('users')
      .insert([profileRow])
      .select()
      .single();

    if (insertResult.error && isMissingProgramColumnError(insertResult.error)) {
      const fallbackRow = { ...profileRow };
      delete fallbackRow.program_id;
      delete fallbackRow.program;
      insertResult = await supabase
        .from('users')
        .insert([fallbackRow])
        .select()
        .single();
    }

    const { data: newUser, error } = insertResult;

    if (error) {
      // Roll back the auth user so a failed profile insert doesn't orphan it.
      if (authUserId) {
        await deleteAuthUserById(authUserId);
      }
      throw error;
    }

    // If Supabase "Confirm email" is OFF, signUp returns a live session and the
    // account is already active — log the user in directly. When it is ON (the
    // recommended setting), no session is issued and we ask them to confirm.
    if (signUpData?.session) {
      const organizationLookups = await getOrganizationLookups();
      return sendSuccess(res, {
        status: 201,
        message: 'User registered successfully',
        data: buildAuthSuccessData(newUser, signUpData.session, organizationLookups),
      });
    }

    return sendSuccess(res, {
      status: 201,
      message: 'Registration successful. Please check your email to confirm your account before signing in.',
      data: { confirmationRequired: true, email: normalizedEmail },
    });
  } catch (error) {
    console.error('Register error:', error);
    return sendError(res, { status: 500, code: 'REGISTER_FAILED', message: 'Server error' });
  }
};

// Resend the signup confirmation email
exports.resendConfirmation = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Email is required' });
    }

    await resendSignupConfirmation({
      email,
      emailRedirectTo: getConfirmationRedirectUrl(),
    });

    // Always respond generically to avoid leaking which emails are registered.
    return sendSuccess(res, {
      message: 'If an unconfirmed account exists for that email, a new confirmation link has been sent.',
    });
  } catch (error) {
    console.error('Resend confirmation error:', error);
    return sendSuccess(res, {
      message: 'If an unconfirmed account exists for that email, a new confirmation link has been sent.',
    });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const organizationLookups = await getOrganizationLookups();
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    const authEmail = user ? await resolveAuthLoginEmail(user) : normalizedEmail;
    const { data: authLoginData, error: authLoginError } = await signInWithPassword(authEmail, password);

    if (!authLoginError && authLoginData?.session) {
      if (error || !user) {
        return sendError(res, { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
      }

      // Guard: the authenticated Supabase user must be THIS account's auth user.
      // Prevents an email collision (e.g. a recovery email that is also another
      // account's login email) from routing the session to the wrong account.
      if (user.auth_user_id && authLoginData.user?.id && authLoginData.user.id !== user.auth_user_id) {
        return sendError(res, { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
      }

      if (user.is_active === false || user.suspended_at) {
        return sendError(res, {
          status: 403,
          code: 'ACCOUNT_SUSPENDED',
          message: user.suspended_reason
            ? `Account suspended: ${user.suspended_reason}`
            : 'Account is suspended. Please contact administrator.',
        });
      }

      // Self-heal the stable auth link for accounts predating auth_user_id.
      if (!user.auth_user_id && authLoginData.user?.id) {
        await supabase
          .from('users')
          .update({ auth_user_id: authLoginData.user.id })
          .eq('id', user.id);
      }

      return sendSuccess(res, {
        message: 'Login successful',
        data: buildAuthSuccessData(user, authLoginData.session, organizationLookups),
      });
    }

    // Correct credentials but the email hasn't been confirmed yet.
    if (authLoginError && /not confirmed/i.test(authLoginError.message || '')) {
      return sendError(res, {
        status: 403,
        code: 'EMAIL_NOT_CONFIRMED',
        message: 'Please confirm your email address before signing in. Check your inbox for the confirmation link.',
      });
    }

    if (error || !user) {
      return sendError(res, { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }

    if (user.is_active === false || user.suspended_at) {
      return sendError(res, {
        status: 403,
        code: 'ACCOUNT_SUSPENDED',
        message: user.suspended_reason
          ? `Account suspended: ${user.suspended_reason}`
          : 'Account is suspended. Please contact administrator.',
      });
    }

    // Legacy fallback: only users created before the Supabase-native migration
    // still carry a bcrypt hash here. Accounts without a stored hash must
    // authenticate through Supabase Auth (handled above).
    if (!user.password) {
      return sendError(res, { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return sendError(res, { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }

    await ensureAuthUser({
      email: normalizedEmail,
      password,
      userMetadata: { role: user.role },
      forcePasswordSync: true,
    });

    const { data: migratedAuthSession, error: migratedAuthError } = await signInWithPassword(normalizedEmail, password);
    if (migratedAuthError || !migratedAuthSession?.session) {
      throw migratedAuthError || new Error('Failed to establish Supabase session after legacy password migration');
    }

    // Persist the stable auth link discovered during legacy migration.
    if (!user.auth_user_id && migratedAuthSession.user?.id) {
      await supabase
        .from('users')
        .update({ auth_user_id: migratedAuthSession.user.id })
        .eq('id', user.id);
    }

    return sendSuccess(res, {
      message: 'Login successful',
      data: buildAuthSuccessData(user, migratedAuthSession.session, organizationLookups),
    });
  } catch (error) {
    console.error('Login error:', error);
    return sendError(res, { status: 500, code: 'LOGIN_FAILED', message: 'Server error' });
  }
};

exports.refreshSession = async (req, res) => {
  try {
    const organizationLookups = await getOrganizationLookups();
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'Refresh token is required',
      });
    }

    const { data, error } = await refreshAuthSession(refreshToken);
    if (error || !data?.session || !data?.user?.email) {
      return sendError(res, {
        status: 401,
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired',
      });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, middle_name, last_name, role, department, department_id, program, program_id, is_active, suspended_at, suspended_reason')
      .eq('email', String(data.user.email).toLowerCase().trim())
      .maybeSingle();

    if (userError || !user) {
      return sendError(res, {
        status: 401,
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired',
      });
    }

    if (user.is_active === false || user.suspended_at) {
      return sendError(res, {
        status: 403,
        code: 'ACCOUNT_SUSPENDED',
        message: user.suspended_reason
          ? `Account suspended: ${user.suspended_reason}`
          : 'Account is suspended. Please contact administrator.',
      });
    }

    return sendSuccess(res, {
      message: 'Session refreshed successfully',
      data: buildAuthSuccessData(user, data.session, organizationLookups),
    });
  } catch (error) {
    console.error('Refresh session error:', error);
    return sendError(res, {
      status: 500,
      code: 'REFRESH_SESSION_FAILED',
      message: 'Failed to refresh session',
    });
  }
};

// Change password for an authenticated user.
// Supabase Auth is the single source of truth for passwords, so this verifies
// the current password via a Supabase sign-in and then updates it by auth id.
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!currentPassword || !newPassword) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Current and new password are required' });
    }

    if (!userId) {
      return sendError(res, { status: 401, code: 'UNAUTHORIZED', message: 'Unable to resolve the current account' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, recovery_email, auth_user_id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return sendError(res, { status: 404, code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const authEmail = await resolveAuthLoginEmail(profile);
    if (!authEmail) {
      return sendError(res, { status: 401, code: 'UNAUTHORIZED', message: 'Unable to resolve the current account' });
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      return sendError(res, { status: 400, code: 'WEAK_PASSWORD', message: strength.message });
    }

    if (currentPassword === newPassword) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'New password must be different from your current password',
      });
    }

    // Verifying the current password via sign-in also yields the exact Supabase
    // auth user id without scanning the entire auth user list.
    const { data: signInData, error: signInError } = await signInWithPassword(authEmail, currentPassword);
    if (signInError || !signInData?.user) {
      return sendError(res, { status: 400, code: 'INVALID_CURRENT_PASSWORD', message: 'Current password is incorrect' });
    }

    await updateAuthUserPasswordById(signInData.user.id, newPassword);

    return sendSuccess(res, {
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return sendError(res, { status: 500, code: 'CHANGE_PASSWORD_FAILED', message: 'Server error' });
  }
};

// Validate a self-service email change (domain + uniqueness). The actual auth
// email update is performed client-side via Supabase (verified change flow);
// public.users.email is then kept in sync by the on_auth_user_email_change trigger.
exports.changeEmail = async (req, res) => {
  try {
    const { newEmail } = req.body;
    const role = req.user?.role;
    const userId = req.user?.id;
    const currentEmail = req.user?.email;

    if (!newEmail) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'A new email address is required' });
    }

    if (!role || !currentEmail || !userId) {
      return sendError(res, { status: 401, code: 'UNAUTHORIZED', message: 'Unable to resolve the current account' });
    }

    const normalizedNewEmail = String(newEmail).toLowerCase().trim();

    if (normalizedNewEmail === String(currentEmail).toLowerCase().trim()) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'The new email is the same as your current email',
      });
    }

    const domainCheck = validateEmailDomainForRole(normalizedNewEmail, role);
    if (!domainCheck.valid) {
      return sendError(res, { status: 400, code: 'INVALID_EMAIL_DOMAIN', message: domainCheck.message });
    }

    // Reject if the target email already belongs to another profile or auth user.
    const { data: existingProfile } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedNewEmail)
      .maybeSingle();

    if (existingProfile && existingProfile.id !== userId) {
      return sendError(res, { status: 409, code: 'EMAIL_TAKEN', message: 'That email is already in use' });
    }

    const existingAuthUser = await findAuthUserByEmail(normalizedNewEmail);
    if (existingAuthUser) {
      return sendError(res, { status: 409, code: 'EMAIL_TAKEN', message: 'That email is already in use' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, recovery_email')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw profileError;

    // When a recovery email is configured, auth.users.email stays on the personal
    // inbox — update the institutional login email in public.users only.
    if (profile?.recovery_email) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ email: normalizedNewEmail })
        .eq('id', userId);

      if (updateError) throw updateError;

      return sendSuccess(res, {
        message: 'Institutional email updated successfully.',
        data: { email: normalizedNewEmail, directUpdate: true },
      });
    }

    return sendSuccess(res, {
      message: 'Email change allowed. A confirmation link will be sent to the new address.',
      data: { email: normalizedNewEmail },
    });
  } catch (error) {
    console.error('Change email error:', error);
    return sendError(res, { status: 500, code: 'CHANGE_EMAIL_FAILED', message: 'Server error' });
  }
};

async function assertRecoveryEmailAvailable({ recoveryEmail, userId, institutionalEmail }) {
  const domainCheck = validateRecoveryEmail(recoveryEmail, institutionalEmail);
  if (!domainCheck.valid) {
    return domainCheck;
  }

  const { data: existingRecoveryOwner } = await supabase
    .from('users')
    .select('id')
    .eq('recovery_email', recoveryEmail)
    .maybeSingle();

  if (existingRecoveryOwner && existingRecoveryOwner.id !== userId) {
    return { valid: false, message: 'That recovery email is already linked to another account' };
  }

  const { data: existingLoginOwner } = await supabase
    .from('users')
    .select('id')
    .eq('email', recoveryEmail)
    .maybeSingle();

  if (existingLoginOwner && existingLoginOwner.id !== userId) {
    return { valid: false, message: 'That email is already in use as a login email' };
  }

  const existingAuthUser = await findAuthUserByEmail(recoveryEmail);
  if (existingAuthUser) {
    const { data: linkedProfile } = await supabase
      .from('users')
      .select('id, auth_user_id')
      .eq('auth_user_id', existingAuthUser.id)
      .maybeSingle();

    if (linkedProfile && linkedProfile.id !== userId) {
      return { valid: false, message: 'That recovery email is already linked to another account' };
    }
  }

  return { valid: true, message: '' };
}

exports.validateRecoveryEmail = async (req, res) => {
  try {
    const { recoveryEmail } = req.body;
    const userId = req.user?.id;
    const institutionalEmail = req.user?.email;

    if (!recoveryEmail) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'A recovery email address is required' });
    }

    if (!userId || !institutionalEmail) {
      return sendError(res, { status: 401, code: 'UNAUTHORIZED', message: 'Unable to resolve the current account' });
    }

    const normalizedRecoveryEmail = String(recoveryEmail).toLowerCase().trim();
    const availability = await assertRecoveryEmailAvailable({
      recoveryEmail: normalizedRecoveryEmail,
      userId,
      institutionalEmail,
    });

    if (!availability.valid) {
      return sendError(res, { status: 400, code: 'INVALID_RECOVERY_EMAIL', message: availability.message });
    }

    return sendSuccess(res, {
      message: 'Recovery email is valid. A verification message will be sent to that address.',
      data: { recoveryEmail: normalizedRecoveryEmail },
    });
  } catch (error) {
    console.error('Validate recovery email error:', error);
    return sendError(res, { status: 500, code: 'RECOVERY_EMAIL_FAILED', message: 'Server error' });
  }
};

exports.confirmRecoveryEmail = async (req, res) => {
  try {
    const userId = req.user?.id;
    const institutionalEmail = String(req.user?.email || '').trim().toLowerCase();

    if (!userId || !institutionalEmail) {
      return sendError(res, { status: 401, code: 'UNAUTHORIZED', message: 'Unable to resolve the current account' });
    }

    const authEmail = await getAuthEmailFromRequest(req);
    if (!authEmail) {
      return sendError(res, { status: 401, code: 'UNAUTHORIZED', message: 'Unable to resolve your verified auth email' });
    }

    if (authEmail === institutionalEmail) {
      return sendError(res, {
        status: 400,
        code: 'RECOVERY_NOT_VERIFIED',
        message: 'No verified recovery email change was detected. Check your inbox and try again.',
      });
    }

    const availability = await assertRecoveryEmailAvailable({
      recoveryEmail: authEmail,
      userId,
      institutionalEmail,
    });

    if (!availability.valid) {
      return sendError(res, { status: 400, code: 'INVALID_RECOVERY_EMAIL', message: availability.message });
    }

    const authUserId = req.user?.auth_user_id || null;
    let resolvedAuthUserId = authUserId;

    if (!resolvedAuthUserId) {
      const token = getBearerToken(req.headers.authorization);
      const { data: authData } = await supabase.auth.getUser(token);
      resolvedAuthUserId = authData?.user?.id || null;
    }

    const updatePayload = {
      recovery_email: authEmail,
    };

    if (resolvedAuthUserId) {
      updatePayload.auth_user_id = resolvedAuthUserId;
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select('id, email, recovery_email, first_name, middle_name, last_name, role, department, department_id, program, program_id, bio, created_at')
      .single();

    if (updateError) throw updateError;

    const organizationLookups = await getOrganizationLookups();
    return sendSuccess(res, {
      message: 'Recovery email saved successfully.',
      data: { user: formatUserResponse(updatedUser, organizationLookups) },
    });
  } catch (error) {
    console.error('Confirm recovery email error:', error);
    return sendError(res, { status: 500, code: 'RECOVERY_EMAIL_FAILED', message: 'Server error' });
  }
};

exports.confirmInstitutionalEmail = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId || !role) {
      return sendError(res, { status: 401, code: 'UNAUTHORIZED', message: 'Unable to resolve the current account' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, recovery_email')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return sendError(res, { status: 404, code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    if (profile.recovery_email) {
      return sendSuccess(res, {
        message: 'Institutional email is managed separately while a recovery email is configured.',
      });
    }

    const authEmail = await getAuthEmailFromRequest(req);
    if (!authEmail) {
      return sendError(res, { status: 401, code: 'UNAUTHORIZED', message: 'Unable to resolve your verified auth email' });
    }

    const domainCheck = validateEmailDomainForRole(authEmail, role);
    if (!domainCheck.valid) {
      return sendError(res, { status: 400, code: 'INVALID_EMAIL_DOMAIN', message: domainCheck.message });
    }

    if (authEmail === String(profile.email || '').trim().toLowerCase()) {
      return sendSuccess(res, { message: 'Institutional email is already up to date.' });
    }

    const { data: existingProfile } = await supabase
      .from('users')
      .select('id')
      .eq('email', authEmail)
      .maybeSingle();

    if (existingProfile && existingProfile.id !== userId) {
      return sendError(res, { status: 409, code: 'EMAIL_TAKEN', message: 'That email is already in use' });
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ email: authEmail })
      .eq('id', userId)
      .select('id, email, recovery_email, first_name, middle_name, last_name, role, department, department_id, program, program_id, bio, created_at')
      .single();

    if (updateError) throw updateError;

    const organizationLookups = await getOrganizationLookups();
    return sendSuccess(res, {
      message: 'Institutional email updated successfully.',
      data: { user: formatUserResponse(updatedUser, organizationLookups) },
    });
  } catch (error) {
    console.error('Confirm institutional email error:', error);
    return sendError(res, { status: 500, code: 'CONFIRM_EMAIL_FAILED', message: 'Server error' });
  }
};

exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Email is required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, recovery_email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error) throw error;

    if (!user) {
      return sendSuccess(res, {
        message: 'If an account exists, a reset code was sent to the recovery email on file.',
      });
    }

    if (!user.recovery_email) {
      return sendError(res, {
        status: 400,
        code: 'RECOVERY_EMAIL_REQUIRED',
        message: 'Add a recovery email in your Profile before resetting your password.',
      });
    }

    const { error: resetError } = await resetPasswordForEmail(user.recovery_email);
    if (resetError && resetError.status && resetError.status >= 500) {
      throw resetError;
    }

    return sendSuccess(res, {
      message: 'If an account exists, a reset code was sent to the recovery email on file.',
    });
  } catch (error) {
    console.error('Request password reset error:', error);
    return sendError(res, { status: 500, code: 'PASSWORD_RESET_FAILED', message: 'Server error' });
  }
};

exports.confirmPasswordReset = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'Email, verification code, and new password are required',
      });
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      return sendError(res, { status: 400, code: 'WEAK_PASSWORD', message: strength.message });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedCode = String(code).replace(/\D/g, '');

    if (normalizedCode.length < 6 || normalizedCode.length > 8) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'Enter the full code from your recovery email (6–8 digits)',
      });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, recovery_email, auth_user_id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (userError) throw userError;

    if (!user?.recovery_email) {
      return sendError(res, {
        status: 400,
        code: 'RECOVERY_EMAIL_REQUIRED',
        message: 'Add a recovery email in your Profile before resetting your password.',
      });
    }

    const { data: verifyData, error: verifyError } = await verifyRecoveryOtp({
      email: user.recovery_email,
      token: normalizedCode,
    });

    if (verifyError || !verifyData?.user) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_RESET_CODE',
        message: 'That code is invalid or expired. Request a new one.',
      });
    }

    const authUserId = verifyData.user.id || user.auth_user_id;
    if (!authUserId) {
      return sendError(res, { status: 500, code: 'PASSWORD_RESET_FAILED', message: 'Unable to update password' });
    }

    await updateAuthUserPasswordById(authUserId, newPassword);

    if (!user.auth_user_id) {
      await supabase
        .from('users')
        .update({ auth_user_id: authUserId })
        .eq('id', user.id);
    }

    return sendSuccess(res, {
      message: 'Password updated successfully. You can sign in now.',
    });
  } catch (error) {
    console.error('Confirm password reset error:', error);
    return sendError(res, { status: 500, code: 'PASSWORD_RESET_FAILED', message: 'Server error' });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const organizationLookups = await getOrganizationLookups();
    let { data: user, error } = await supabase
      .from('users')
      .select('id, email, recovery_email, first_name, middle_name, last_name, role, department, department_id, program, program_id, bio, created_at')
      .eq('id', req.user.id)
      .single();

    if (error && String(error.message || '').includes('bio')) {
      const fallback = await supabase
        .from('users')
        .select('id, email, recovery_email, first_name, middle_name, last_name, role, department, department_id, program, program_id, created_at')
        .eq('id', req.user.id)
        .single();
      user = fallback.data;
      error = fallback.error;
    }

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: formatUserResponse(user, organizationLookups),
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateOwnProfile = async (req, res) => {
  try {
    const organizationLookups = await getOrganizationLookups();
    const userId = req.user.id;
    const {
      firstName,
      middleName,
      lastName,
      department,
      departmentId,
      program,
      programId,
      bio,
    } = req.body;

    let { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('id, email, role, first_name, middle_name, last_name, department, department_id, program, program_id, bio, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (existingUserError && String(existingUserError.message || '').includes('bio')) {
      const fallback = await supabase
        .from('users')
        .select('id, email, role, first_name, middle_name, last_name, department, department_id, program, program_id, created_at')
        .eq('id', userId)
        .maybeSingle();
      existingUser = fallback.data;
      existingUserError = fallback.error;
    }

    if (existingUserError) throw existingUserError;
    if (!existingUser) {
      return sendError(res, { status: 404, code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const normalizedNames = normalizeNameParts({
      first_name: firstName ?? existingUser.first_name ?? '',
      middle_name: middleName ?? existingUser.middle_name ?? '',
      last_name: lastName ?? existingUser.last_name ?? '',
    });
    const resolvedFirstName = normalizedNames.first_name;
    const resolvedMiddleName = normalizedNames.middle_name;
    const resolvedLastName = normalizedNames.last_name;

    if (!resolvedFirstName || !resolvedLastName) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'First name and last name are required' });
    }

    if (bio !== undefined && bio !== null && String(bio).length > 200) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Bio must be 200 characters or fewer' });
    }

    const {
      resolvedDepartmentId,
      resolvedDepartmentName,
      resolvedProgramId,
      resolvedProgramName,
      errorMessage,
    } = await resolveUserOrganizationAssignment({
      role: existingUser.role,
      department: department ?? existingUser.department,
      departmentId: departmentId ?? existingUser.department_id,
      program: program ?? existingUser.program,
      programId: programId ?? existingUser.program_id,
      requireProgramForRoles: [],
    });

    if (errorMessage) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: errorMessage });
    }

    const updatePayload = {
      first_name: resolvedFirstName,
      middle_name: resolvedMiddleName,
      last_name: resolvedLastName,
      department_id: resolvedDepartmentId || null,
      department: resolvedDepartmentName || null,
      program_id: ['student', 'program_chair'].includes(existingUser.role) ? (resolvedProgramId || null) : null,
      program: ['student', 'program_chair'].includes(existingUser.role) ? (resolvedProgramName || null) : null,
      updated_at: new Date().toISOString(),
    };

    if (bio !== undefined) {
      updatePayload.bio = bio === null || String(bio).trim() === '' ? null : String(bio).trim();
    }

    let { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select('id, email, recovery_email, first_name, middle_name, last_name, role, program, program_id, department, department_id, bio, created_at')
      .maybeSingle();

    if (updateError && String(updateError.message || '').includes('bio')) {
      const fallbackPayload = { ...updatePayload };
      delete fallbackPayload.bio;
      const fallbackResult = await supabase
        .from('users')
        .update(fallbackPayload)
        .eq('id', userId)
        .select('id, email, recovery_email, first_name, middle_name, last_name, role, program, program_id, department, department_id, created_at')
        .maybeSingle();
      updatedUser = fallbackResult.data;
      updateError = fallbackResult.error;
    } else if (isMissingProgramColumnError(updateError)) {
      const fallbackPayload = { ...updatePayload };
      delete fallbackPayload.program_id;
      const fallbackResult = await supabase
        .from('users')
        .update(fallbackPayload)
        .eq('id', userId)
        .select('id, email, recovery_email, first_name, middle_name, last_name, role, program, department, department_id, bio, created_at')
        .maybeSingle();
      updatedUser = fallbackResult.data;
      updateError = fallbackResult.error;
    }

    if (updateError) throw updateError;

    return sendSuccess(res, {
      message: 'Profile updated successfully',
      data: { user: formatUserResponse(updatedUser, organizationLookups) },
    });
  } catch (error) {
    console.error('Update own profile error:', error);
    return sendError(res, { status: 500, code: 'UPDATE_PROFILE_FAILED', message: 'Failed to update profile' });
  }
};

exports.getProfileActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

    if (role === 'student') {
      const { data: authoredPapers, error: authoredError } = await supabase
        .from('research_papers')
        .select('id, title, status, submission_date, created_at')
        .eq('author_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (authoredError) throw authoredError;

      let coAuthoredPapers = [];
      try {
        const { data: coAuthorLinks } = await supabase
          .from('research_authors')
          .select('research_id')
          .eq('user_id', userId)
          .eq('is_primary', false);

        const coAuthoredIds = (coAuthorLinks || []).map((row) => row.research_id).filter(Boolean);
        if (coAuthoredIds.length > 0) {
          const { data: coAuthored } = await supabase
            .from('research_papers')
            .select('id, title, status, submission_date, created_at')
            .in('id', coAuthoredIds)
            .neq('author_id', userId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
          coAuthoredPapers = (coAuthored || []).map((paper) => ({ ...paper, is_coauthored: true }));
        }
      } catch (coAuthorErr) {
        console.warn('[getProfileActivity] co-author lookup skipped:', coAuthorErr.message);
      }

      let pendingInvites = 0;
      try {
        const { data: invites } = await supabase
          .from('co_author_invitations')
          .select('id, status, expires_at')
          .eq('invitee_id', userId)
          .eq('status', 'pending');
        pendingInvites = (invites || []).filter((inv) => !inv.expires_at || new Date(inv.expires_at) >= new Date()).length;
      } catch (inviteErr) {
        console.warn('[getProfileActivity] invitation lookup skipped:', inviteErr.message);
      }

      const authored = authoredPapers || [];
      const merged = [
        ...authored.map((paper) => ({ ...paper, is_coauthored: false })),
        ...coAuthoredPapers,
      ].sort((a, b) => new Date(b.submission_date || b.created_at) - new Date(a.submission_date || a.created_at));

      const items = merged.slice(0, limit).map((paper) => ({
        type: 'submission',
        id: paper.id,
        title: paper.title,
        status: paper.status,
        occurredAt: paper.submission_date || paper.created_at,
        isCoauthored: !!paper.is_coauthored,
      }));

      return sendSuccess(res, {
        data: {
          stats: {
            submitted: authored.length,
            published: authored.filter((p) => ['approved', 'published'].includes(p.status)).length,
            coAuthored: coAuthoredPapers.length,
            pendingInvites,
          },
          items,
        },
      });
    }

    if (role === 'admin') {
      const [{ data: auditRows, error: auditError }, { data: reviewRows, error: reviewError }] = await Promise.all([
        supabase
          .from('audit_logs')
          .select('id, action, target_type, target_id, details, reason, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('approval_workflow')
          .select('id, status, reviewer_role, research_id, reviewed_at, created_at')
          .eq('reviewer_id', userId)
          .eq('reviewer_role', 'admin')
          .neq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(limit),
      ]);

      if (auditError && !String(auditError.message || '').includes('audit_logs')) throw auditError;
      if (reviewError && !String(reviewError.message || '').includes('approval_workflow')) throw reviewError;

      const auditItems = (auditRows || []).map((row) => ({
        type: 'audit',
        id: row.id,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        occurredAt: row.created_at,
        details: row.details || {},
        reason: row.reason || null,
      }));

      const reviewItems = (reviewRows || []).map((row) => ({
        type: 'review',
        id: row.id,
        action: row.status,
        reviewerRole: row.reviewer_role,
        paperId: row.research_id,
        paperTitle: null,
        occurredAt: row.reviewed_at || row.created_at,
        comments: null,
      }));

      const items = [...auditItems, ...reviewItems]
        .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
        .slice(0, limit);

      return sendSuccess(res, {
        data: {
          stats: {
            totalActions: auditItems.length,
            papersApproved: (reviewRows || []).filter((row) => row.status === 'approved').length,
            reviewsCompleted: (reviewRows || []).length,
          },
          items,
        },
      });
    }

    const [{ data: workflowRows, error: workflowError }, assignedResult] = await Promise.all([
      supabase
        .from('approval_workflow')
        .select(`
          id, status, reviewer_role, research_id, comments, reviewed_at, created_at,
          research:research_papers!approval_workflow_research_id_fkey (id, title)
        `)
        .eq('reviewer_id', userId)
        .neq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(limit),
      (async () => {
        if (role === 'faculty') {
          return supabase
            .from('research_papers')
            .select('id, status')
            .eq('faculty_id', userId)
            .is('deleted_at', null);
        }
        if (['dean', 'program_chair'].includes(role)) {
          return supabase
            .from('research_papers')
            .select('id, status')
            .eq('dean_chair_id', userId)
            .is('deleted_at', null);
        }
        if (role === 'staff') {
          return supabase
            .from('research_papers')
            .select('id, status')
            .eq('status', 'pending_editor')
            .is('deleted_at', null);
        }
        return { data: [], error: null };
      })(),
    ]);

    if (workflowError && !String(workflowError.message || '').includes('approval_workflow')) {
      throw workflowError;
    }

    const assignedPapers = assignedResult?.data || [];
    const pendingAssigned = assignedPapers.filter((paper) =>
      ['pending_faculty', 'pending_dean', 'pending_program_chair', 'pending_editor', 'pending_admin', 'under_review'].includes(paper.status)
    ).length;

    const rows = workflowRows || [];
    const items = rows.map((row) => ({
      type: 'review',
      id: row.id,
      action: row.status,
      reviewerRole: row.reviewer_role,
      paperId: row.research_id,
      paperTitle: row.research?.title || null,
      occurredAt: row.reviewed_at || row.created_at,
      comments: row.comments || null,
    }));

    return sendSuccess(res, {
      data: {
        stats: {
          totalReviews: rows.length,
          approved: rows.filter((row) => row.status === 'approved').length,
          revisionRequired: rows.filter((row) => row.status === 'revision_required').length,
          rejected: rows.filter((row) => row.status === 'rejected').length,
          pendingAssigned,
        },
        items,
      },
    });
  } catch (error) {
    console.error('Get profile activity error:', error);
    return sendError(res, { status: 500, code: 'GET_PROFILE_ACTIVITY_FAILED', message: 'Failed to fetch profile activity' });
  }
};

// NEW: Get All Users (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const organizationLookups = await getOrganizationLookups();
    // 1. Check if a role filter was provided in the URL (e.g., ?role=staff)
    const { role } = req.query;

    // 2. Start the query
    let query = supabase
      .from('users')
      .select('id, email, first_name, middle_name, last_name, role, program, program_id, department, department_id, is_active, suspended_at, suspended_reason, created_at')
      .order('created_at', { ascending: false });

    // 3. Apply filter if a role is requested
    if (role) {
      query = query.eq('role', role);
    }

    const { data: users, error } = await query;

    if (error) throw error;

    res.json({
      users: (users || []).map((user) => attachFullName(attachOrganizationLabels(user, organizationLookups))),
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const organizationLookups = await getOrganizationLookups();
    const { id } = req.params;
    const {
      firstName,
      middleName,
      lastName,
      department,
      departmentId,
      program,
      programId,
    } = req.body;

    const { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('id, email, role, first_name, middle_name, last_name, department, department_id, program, program_id, is_active, suspended_at, suspended_reason, created_at')
      .eq('id', id)
      .maybeSingle();

    if (existingUserError) throw existingUserError;
    if (!existingUser) {
      return sendError(res, { status: 404, code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const normalizedNames = normalizeNameParts({
      first_name: firstName ?? existingUser.first_name ?? '',
      middle_name: middleName ?? existingUser.middle_name ?? '',
      last_name: lastName ?? existingUser.last_name ?? '',
    });
    const resolvedFirstName = normalizedNames.first_name;
    const resolvedMiddleName = normalizedNames.middle_name;
    const resolvedLastName = normalizedNames.last_name;

    if (!resolvedFirstName || !resolvedLastName) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'First name and last name are required' });
    }

    const {
      resolvedDepartmentId,
      resolvedDepartmentName,
      resolvedProgramId,
      resolvedProgramName,
      errorMessage,
    } = await resolveUserOrganizationAssignment({
      role: existingUser.role,
      department: department ?? existingUser.department,
      departmentId: departmentId ?? existingUser.department_id,
      program: program ?? existingUser.program,
      programId: programId ?? existingUser.program_id,
      requireProgramForRoles: ['student', 'program_chair'],
    });

    if (errorMessage) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: errorMessage });
    }

    const updatePayload = {
      first_name: resolvedFirstName,
      middle_name: resolvedMiddleName,
      last_name: resolvedLastName,
      department_id: resolvedDepartmentId || null,
      department: resolvedDepartmentName || null,
      program_id: ['student', 'program_chair'].includes(existingUser.role) ? (resolvedProgramId || null) : null,
      program: ['student', 'program_chair'].includes(existingUser.role) ? (resolvedProgramName || null) : null,
      updated_at: new Date().toISOString(),
    };

    let { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', id)
      .select('id, email, first_name, middle_name, last_name, role, program, program_id, department, department_id, is_active, suspended_at, suspended_reason, created_at')
      .maybeSingle();

    if (isMissingProgramColumnError(updateError)) {
      const fallbackPayload = { ...updatePayload };
      delete fallbackPayload.program_id;
      const fallbackResult = await supabase
        .from('users')
        .update(fallbackPayload)
        .eq('id', id)
        .select('id, email, first_name, middle_name, last_name, role, program, department, department_id, is_active, suspended_at, suspended_reason, created_at')
        .maybeSingle();
      updatedUser = fallbackResult.data;
      updateError = fallbackResult.error;
    }

    if (updateError) throw updateError;

    return sendSuccess(res, {
      message: 'User updated successfully',
      data: { user: attachFullName(attachOrganizationLabels(updatedUser, organizationLookups)) },
    });
  } catch (error) {
    console.error('Update user error:', error);
    return sendError(res, { status: 500, code: 'UPDATE_USER_FAILED', message: 'Failed to update user' });
  }
};

// Search students (for co-author selection)
exports.searchStudents = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.json({ students: [] });
    }

    const { data: students, error } = await supabase
      .from('users')
      .select('id, first_name, middle_name, last_name, email, program')
      .eq('role', 'student')
      .or(`first_name.ilike.%${query}%,middle_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);

    if (error) throw error;

    res.json({ students: (students || []).map(attachFullName) });
  } catch (error) {
    console.error('Search students error:', error);
    res.status(500).json({ error: 'Failed to search students' });
  }
};

// NEW: Create Privileged User (Admin only)
// Creates faculty, staff, dean, program_chair, or admin accounts
exports.createPrivilegedUser = async (req, res) => {
  try {
    const organizationLookups = await getOrganizationLookups();
    const { email, password, fullName, firstName, middleName, lastName, role, department, departmentId, program, programId } = req.body;

    const allowedRoles = ['faculty', 'staff', 'dean', 'program_chair', 'admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be faculty, staff, dean, program_chair, or admin.' });
    }

    const parsedFromFullName = splitFullName(fullName);
    const normalizedNames = normalizeNameParts({
      first_name: firstName || parsedFromFullName.first_name || '',
      middle_name: middleName || parsedFromFullName.middle_name || '',
      last_name: lastName || parsedFromFullName.last_name || '',
    });
    const resolvedFirstName = normalizedNames.first_name;
    const resolvedMiddleName = normalizedNames.middle_name;
    const resolvedLastName = normalizedNames.last_name;

    if (!email || !password || !role || !resolvedFirstName || !resolvedLastName) {
      return res.status(400).json({ error: 'Email, password, full name, and role are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const domainCheck = validateEmailDomainForRole(email, role);
    if (!domainCheck.valid) {
      return res.status(400).json({ error: domainCheck.message });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const organization = await resolveUserOrganizationAssignment({
      role,
      department,
      departmentId,
      program,
      programId,
      requireProgramForRoles: ['program_chair'],
    });

    if (organization.errorMessage) {
      return res.status(400).json({ error: organization.errorMessage });
    }

    const {
      resolvedDepartmentId,
      resolvedDepartmentName,
      resolvedProgramId,
      resolvedProgramName,
    } = organization;

    if (role === 'program_chair' && !resolvedProgramId && !resolvedProgramName) {
      return res.status(400).json({ error: 'Program is required for program chair accounts.' });
    }

    const authProvision = await ensureAuthUser({
      email: email.toLowerCase().trim(),
      password,
      userMetadata: { role },
    });

    const basePayload = {
      email: email.toLowerCase().trim(),
      first_name: resolvedFirstName,
      middle_name: resolvedMiddleName,
      last_name: resolvedLastName,
      role,
      department: resolvedDepartmentName,
      department_id: resolvedDepartmentId,
      program: resolvedProgramName,
      program_id: resolvedProgramId,
      auth_user_id: authProvision.user?.id || null,
    };

    let insertResult = await supabase
      .from('users')
      .insert([basePayload])
      .select('id, email, first_name, middle_name, last_name, role, department, department_id, program, program_id, created_at')
      .single();

    if (insertResult.error && isMissingProgramColumnError(insertResult.error)) {
      const fallbackPayload = { ...basePayload };
      delete fallbackPayload.program_id;
      delete fallbackPayload.program;
      insertResult = await supabase
        .from('users')
        .insert([fallbackPayload])
        .select('id, email, recovery_email, first_name, middle_name, last_name, role, department, department_id, program, program_id, created_at')
        .single();
    }

    const { data: newUser, error } = insertResult;

    if (error) {
      if (authProvision.created) {
        await deleteAuthUserById(authProvision.user?.id);
      }
      throw error;
    }

    res.status(201).json({
      message: `${role.replace('_', ' ')} account created successfully.`,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: buildFullName(newUser),
        role: newUser.role,
        department: attachOrganizationLabels(newUser, organizationLookups).department,
        departmentId: newUser.department_id,
        program: attachOrganizationLabels(newUser, organizationLookups).program || null,
        programId: newUser.program_id || null,
        createdAt: newUser.created_at,
      },
    });
  } catch (error) {
    console.error('Create privileged user error:', error);
    res.status(500).json({ error: 'Failed to create user account.' });
  }
};

exports.bulkImportUsersCsv = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'CSV file is required' });
    }

    const csvText = req.file.buffer.toString('utf8');
    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'CSV must include a header row and at least one data row',
      });
    }

    const headers = parseCsvLine(lines[0]).map(normalizeCsvHeader);
    const idx = {
      email: headers.findIndex((h) => h === 'email'),
      password: headers.findIndex((h) => h === 'password'),
      role: headers.findIndex((h) => h === 'role'),
      firstname: headers.findIndex((h) => h === 'firstname' || h === 'first'),
      middlename: headers.findIndex((h) => h === 'middlename' || h === 'middle'),
      lastname: headers.findIndex((h) => h === 'lastname' || h === 'last'),
      fullname: headers.findIndex((h) => h === 'fullname' || h === 'name'),
      department: headers.findIndex((h) => h === 'department'),
      departmentId: headers.findIndex((h) => h === 'departmentid'),
      program: headers.findIndex((h) => h === 'program'),
      programId: headers.findIndex((h) => h === 'programid'),
    };

    if (idx.email < 0 || idx.password < 0 || idx.role < 0 || (idx.fullname < 0 && (idx.firstname < 0 || idx.lastname < 0))) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'CSV headers must include email,password,role and either fullName or firstName+lastName',
      });
    }

    const summary = {
      totalRows: lines.length - 1,
      created: 0,
      skipped: 0,
      failed: 0,
      results: [],
    };

    for (let i = 1; i < lines.length; i += 1) {
      const rowNumber = i + 1;
      const cells = parseCsvLine(lines[i]);
      const row = {
        email: (cells[idx.email] || '').toLowerCase().trim(),
        password: (cells[idx.password] || '').trim(),
        role: (cells[idx.role] || '').trim().toLowerCase(),
        firstName: idx.firstname >= 0 ? (cells[idx.firstname] || '').trim() : '',
        middleName: idx.middlename >= 0 ? (cells[idx.middlename] || '').trim() : '',
        lastName: idx.lastname >= 0 ? (cells[idx.lastname] || '').trim() : '',
        fullName: idx.fullname >= 0 ? (cells[idx.fullname] || '').trim() : '',
        department: idx.department >= 0 ? (cells[idx.department] || '').trim() : '',
        departmentId: idx.departmentId >= 0 ? (cells[idx.departmentId] || '').trim() : '',
        program: idx.program >= 0 ? (cells[idx.program] || '').trim() : '',
        programId: idx.programId >= 0 ? (cells[idx.programId] || '').trim() : '',
      };

      try {
        const parsedFullName = splitFullName(row.fullName);
        const normalizedNames = normalizeNameParts({
          first_name: row.firstName || parsedFullName.first_name || '',
          middle_name: row.middleName || parsedFullName.middle_name || '',
          last_name: row.lastName || parsedFullName.last_name || '',
        });
        const resolvedFirstName = normalizedNames.first_name;
        const resolvedMiddleName = normalizedNames.middle_name;
        const resolvedLastName = normalizedNames.last_name;

        if (!row.email || !row.password || !row.role || !resolvedFirstName || !resolvedLastName) {
          summary.failed += 1;
          summary.results.push({ row: rowNumber, email: row.email || null, status: 'failed', reason: 'Missing required fields' });
          continue;
        }

        if (!BULK_IMPORT_ALLOWED_ROLES.includes(row.role)) {
          summary.failed += 1;
          summary.results.push({ row: rowNumber, email: row.email, status: 'failed', reason: 'Invalid role' });
          continue;
        }

        if (row.password.length < 6) {
          summary.failed += 1;
          summary.results.push({ row: rowNumber, email: row.email, status: 'failed', reason: 'Password must be at least 6 characters' });
          continue;
        }

        const rowDomainCheck = validateEmailDomainForRole(row.email, row.role);
        if (!rowDomainCheck.valid) {
          summary.failed += 1;
          summary.results.push({ row: rowNumber, email: row.email, status: 'failed', reason: rowDomainCheck.message });
          continue;
        }

        const { data: existingUser, error: existingError } = await supabase
          .from('users')
          .select('id')
          .eq('email', row.email)
          .maybeSingle();

        if (existingError) throw existingError;

        if (existingUser) {
          summary.skipped += 1;
          summary.results.push({ row: rowNumber, email: row.email, status: 'skipped', reason: 'Email already exists' });
          continue;
        }

        const organization = await resolveUserOrganizationAssignment({
          role: row.role,
          department: row.department,
          departmentId: row.departmentId || null,
          program: row.program,
          programId: row.programId || null,
          requireProgramForRoles: ['student', 'program_chair'],
        });

        if (organization.errorMessage) {
          summary.failed += 1;
          summary.results.push({ row: rowNumber, email: row.email, status: 'failed', reason: organization.errorMessage });
          continue;
        }

        const authProvision = await ensureAuthUser({
          email: row.email,
          password: row.password,
          userMetadata: { role: row.role },
        });

        const basePayload = {
          email: row.email,
          first_name: resolvedFirstName,
          middle_name: resolvedMiddleName,
          last_name: resolvedLastName,
          role: row.role,
          department: organization.resolvedDepartmentName,
          department_id: organization.resolvedDepartmentId,
          program: organization.resolvedProgramName,
          program_id: organization.resolvedProgramId,
          auth_user_id: authProvision.user?.id || null,
        };

        let insertResult = await supabase
          .from('users')
          .insert([basePayload]);

        if (insertResult.error && isMissingProgramColumnError(insertResult.error)) {
          const fallbackPayload = { ...basePayload };
          delete fallbackPayload.program_id;
          delete fallbackPayload.program;
          insertResult = await supabase
            .from('users')
            .insert([fallbackPayload]);
        }

        const { error: insertError } = insertResult;

        if (insertError) {
          if (authProvision.created) {
            await deleteAuthUserById(authProvision.user?.id);
          }
          throw insertError;
        }

        summary.created += 1;
        summary.results.push({ row: rowNumber, email: row.email, status: 'created' });
      } catch (rowError) {
        summary.failed += 1;
        summary.results.push({
          row: rowNumber,
          email: row.email || null,
          status: 'failed',
          reason: rowError.message || 'Unknown row error',
        });
      }
    }

    return sendSuccess(res, {
      message: `Bulk import completed: ${summary.created} created, ${summary.skipped} skipped, ${summary.failed} failed`,
      data: summary,
    });
  } catch (error) {
    console.error('Bulk import users CSV error:', error);
    return sendError(res, {
      status: 500,
      code: 'BULK_IMPORT_FAILED',
      message: 'Failed to import users CSV',
    });
  }
};

exports.getSystemHealth = async (req, res) => {
  try {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const response = {
      generatedAt: now.toISOString(),
      api: {
        requests24h: 0,
        errors24h: 0,
        errorRate24h: 0,
      },
      storage: {
        filesCount: 0,
        totalBytes: 0,
        totalMB: 0,
        averageFileMB: 0,
      },
      ai: {
        requests30d: 0,
        failures30d: 0,
        successRate30d: 0,
        quotaUsedPercent: null,
        configuredQuota: null,
      },
      workflow: {
        pendingFaculty: 0,
        pendingDeanOrChair: 0,
        pendingEditor: 0,
        pendingAdmin: 0,
      },
      runtime: {
        uptimeSeconds: Math.round(process.uptime()),
        memoryRSSMB: Math.round((process.memoryUsage().rss / (1024 * 1024)) * 100) / 100,
        nodeVersion: process.version,
      },
      cleanup: {
        usersMissingDepartment: 0,
        scopedUsersMissingProgram: 0,
        unresolvedUsers: [],
        orphanedUnresolvedUsers: 0,
        legacyWorkflowStatusPapers: 0,
        legacyWorkflowStatuses: [],
        usersNeedingNameReview: 0,
        nameReviewUsers: [],
        unresolvedCategoryPapers: 0,
        unresolvedCategoryValues: [],
        papersUsingExternalAuthorNotes: 0,
        externalAuthorNoteMismatches: 0,
        fullNameCompatibilityWindowActive: false,
        fullNameRetirementBlocked: false,
        coAuthorsCompatibilityWindowActive: false,
        coAuthorsRetirementBlocked: false,
        legacyTableRows: {
          facultyReviews: 0,
          authorInvitations: 0,
          systemPolicies: 0,
        },
      },
    };

    try {
      const { data: auditRows, error: auditError } = await supabase
        .from('audit_logs')
        .select('action, created_at')
        .gte('created_at', since24h)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (auditError) throw auditError;

      const rows = auditRows || [];
      const errors = rows.filter((row) => /error|failed|fail|denied|invalid/i.test(String(row.action || '')));
      const requests24h = rows.length;
      const errors24h = errors.length;

      response.api.requests24h = requests24h;
      response.api.errors24h = errors24h;
      response.api.errorRate24h = requests24h > 0
        ? Math.round((errors24h / requests24h) * 10000) / 100
        : 0;
    } catch (err) {
      console.error('System health API metrics error:', err.message);
    }

    try {
      const { data: papers, error: papersError } = await supabase
        .from('research_papers')
        .select('file_size, status')
        .is('deleted_at', null);

      if (papersError) throw papersError;

      const rows = papers || [];
      const totalBytes = rows.reduce((sum, row) => sum + (Number(row.file_size) || 0), 0);
      const filesCount = rows.filter((row) => Number(row.file_size) > 0).length;

      response.storage.filesCount = filesCount;
      response.storage.totalBytes = totalBytes;
      response.storage.totalMB = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;
      response.storage.averageFileMB = filesCount > 0
        ? Math.round(((totalBytes / filesCount) / (1024 * 1024)) * 100) / 100
        : 0;

      response.workflow.pendingFaculty = rows.filter((p) => p.status === 'pending_faculty').length;
      response.workflow.pendingDeanOrChair = rows.filter((p) => ['pending_dean', 'pending_program_chair'].includes(p.status)).length;
      response.workflow.pendingEditor = rows.filter((p) => p.status === 'pending_editor').length;
      response.workflow.pendingAdmin = rows.filter((p) => p.status === 'pending_admin').length;
    } catch (err) {
      console.error('System health storage/workflow metrics error:', err.message);
    }

    try {
      const { data: aiAuditRows, error: aiAuditError } = await supabase
        .from('audit_logs')
        .select('action, created_at')
        .gte('created_at', since30d)
        .order('created_at', { ascending: false })
        .limit(10000);

      if (aiAuditError) throw aiAuditError;

      const aiRows = (aiAuditRows || []).filter((row) => /ai/i.test(String(row.action || '')));
      const aiFailures = aiRows.filter((row) => /error|failed|fail|denied|quota/i.test(String(row.action || '')));

      response.ai.requests30d = aiRows.length;
      response.ai.failures30d = aiFailures.length;
      response.ai.successRate30d = aiRows.length > 0
        ? Math.round(((aiRows.length - aiFailures.length) / aiRows.length) * 10000) / 100
        : 0;

      const envQuota = parseInt(process.env.AI_MONTHLY_QUOTA || process.env.AI_DAILY_QUOTA || '', 10);
      if (!Number.isNaN(envQuota) && envQuota > 0) {
        response.ai.configuredQuota = envQuota;
        response.ai.quotaUsedPercent = Math.min(
          100,
          Math.round((response.ai.requests30d / envQuota) * 10000) / 100
        );
      }
    } catch (err) {
      console.error('System health AI metrics error:', err.message);
    }

    try {
      const [
        usersResult,
        papersResult,
        authoredPapersResult,
        researchAuthorLinksResult,
        draftsResult,
        invitationsResult,
        notificationsResult,
        facultyReviewsCount,
        authorInvitationsCount,
        systemPoliciesCount,
      ] = await Promise.all([
        supabase
          .from('users')
          .select('id, email, role, first_name, middle_name, last_name, department_id, program_id'),
        supabase
          .from('research_papers')
          .select('id, title, status, category, external_author_notes')
          .is('deleted_at', null),
        supabase.from('research_papers').select('author_id'),
        supabase.from('research_authors').select('user_id'),
        supabase.from('submission_drafts').select('user_id'),
        supabase.from('co_author_invitations').select('invitee_id'),
        supabase.from('notifications').select('user_id'),
        getOptionalTableRowCount('faculty_reviews'),
        getOptionalTableRowCount('author_invitations'),
        getOptionalTableRowCount('system_policies'),
      ]);

      if (usersResult.error) throw usersResult.error;
      if (papersResult.error) throw papersResult.error;
      if (authoredPapersResult.error) throw authoredPapersResult.error;
      if (researchAuthorLinksResult.error) throw researchAuthorLinksResult.error;
      if (draftsResult.error) throw draftsResult.error;
      if (invitationsResult.error) throw invitationsResult.error;
      if (notificationsResult.error) throw notificationsResult.error;

      const users = usersResult.data || [];
      const scopedProgramRoles = new Set(['student', 'program_chair']);
      const requiredDepartmentRoles = new Set(['student', 'faculty', 'program_chair', 'dean', 'staff']);
      const footprintUserIds = new Set([
        ...(authoredPapersResult.data || []).map((row) => row.author_id).filter(Boolean),
        ...(researchAuthorLinksResult.data || []).map((row) => row.user_id).filter(Boolean),
        ...(draftsResult.data || []).map((row) => row.user_id).filter(Boolean),
        ...(invitationsResult.data || []).map((row) => row.invitee_id).filter(Boolean),
        ...(notificationsResult.data || []).map((row) => row.user_id).filter(Boolean),
      ]);

      response.cleanup.usersMissingDepartment = users.filter((user) => requiredDepartmentRoles.has(user.role) && !user.department_id).length;
      response.cleanup.scopedUsersMissingProgram = users.filter((user) => scopedProgramRoles.has(user.role) && !user.program_id).length;
      response.cleanup.unresolvedUsers = users
        .filter((user) => (requiredDepartmentRoles.has(user.role) && !user.department_id) || (scopedProgramRoles.has(user.role) && !user.program_id))
        .map((user) => ({
          id: user.id,
          email: user.email,
          role: user.role,
          missingDepartment: requiredDepartmentRoles.has(user.role) && !user.department_id,
          missingProgram: scopedProgramRoles.has(user.role) && !user.program_id,
          orphaned: !footprintUserIds.has(user.id),
        }))
        .sort((left, right) => left.email.localeCompare(right.email));
      response.cleanup.orphanedUnresolvedUsers = response.cleanup.unresolvedUsers.filter((user) => user.orphaned).length;

      response.cleanup.nameReviewUsers = users
        .filter((user) => !String(user.first_name || '').trim() || !String(user.last_name || '').trim())
        .map((user) => ({
          id: user.id,
          email: user.email,
          role: user.role,
          missingFirstName: !String(user.first_name || '').trim(),
          missingLastName: !String(user.last_name || '').trim(),
          currentDisplayName: buildFullName(user),
        }))
        .sort((left, right) => left.email.localeCompare(right.email));
      response.cleanup.usersNeedingNameReview = response.cleanup.nameReviewUsers.length;

      const unresolvedCategoryCounts = new Map();
      const legacyWorkflowStatuses = [];
      let papersUsingExternalAuthorNotes = 0;
      for (const paper of papersResult.data || []) {
        const normalizedExternalAuthorNotes = String(paper.external_author_notes || '').trim();
        if (normalizedExternalAuthorNotes) {
          papersUsingExternalAuthorNotes += 1;
        }

        if (['pending', 'under_review', 'faculty_approved', 'editor_approved'].includes(String(paper.status || ''))) {
          legacyWorkflowStatuses.push({
            id: paper.id,
            title: paper.title,
            status: paper.status,
          });
        }

        const value = String(paper.category || '').trim();
        if (!value || isUuid(value)) continue;
        unresolvedCategoryCounts.set(value, (unresolvedCategoryCounts.get(value) || 0) + 1);
      }

      response.cleanup.legacyWorkflowStatusPapers = legacyWorkflowStatuses.length;
      response.cleanup.legacyWorkflowStatuses = legacyWorkflowStatuses
        .sort((left, right) => String(left.title || '').localeCompare(String(right.title || '')))
        .slice(0, 10);
      response.cleanup.unresolvedCategoryPapers = Array.from(unresolvedCategoryCounts.values()).reduce((sum, count) => sum + count, 0);
      response.cleanup.unresolvedCategoryValues = Array.from(unresolvedCategoryCounts.entries())
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([value, count]) => ({ value, count }));
      response.cleanup.papersUsingExternalAuthorNotes = papersUsingExternalAuthorNotes;
      response.cleanup.externalAuthorNoteMismatches = 0;
      response.cleanup.coAuthorsCompatibilityWindowActive = false;
      response.cleanup.coAuthorsRetirementBlocked = false;

      response.cleanup.legacyTableRows.facultyReviews = facultyReviewsCount;
      response.cleanup.legacyTableRows.authorInvitations = authorInvitationsCount;
      response.cleanup.legacyTableRows.systemPolicies = systemPoliciesCount;
    } catch (err) {
      console.error('System health cleanup metrics error:', err.message);
    }

    return sendSuccess(res, { data: response });
  } catch (error) {
    console.error('Get system health error:', error);
    return sendError(res, {
      status: 500,
      code: 'GET_SYSTEM_HEALTH_FAILED',
      message: 'Failed to fetch system health metrics',
    });
  }
};

exports.getSubmissionPolicy = async (req, res) => {
  try {
    const policy = await getSystemPolicy();
    return sendSuccess(res, { data: policy });
  } catch (error) {
    console.error('Get submission policy error:', error);
    return sendError(res, {
      status: 500,
      code: 'GET_SUBMISSION_POLICY_FAILED',
      message: 'Failed to fetch submission policy',
    });
  }
};

exports.getSystemPolicySettings = async (req, res) => {
  try {
    const policy = await getSystemPolicy();
    return sendSuccess(res, {
      data: {
        ...policy,
        supportedFileTypes: SUPPORTED_FILE_TYPES,
      },
    });
  } catch (error) {
    console.error('Get system policy settings error:', error);
    return sendError(res, {
      status: 500,
      code: 'GET_SYSTEM_POLICY_SETTINGS_FAILED',
      message: 'Failed to fetch system policy settings',
    });
  }
};

exports.updateSystemPolicySettings = async (req, res) => {
  try {
    const { maxFileSizeMb, allowedFileTypes } = req.body;
    const policy = await updateSystemPolicy({
      maxFileSizeMb,
      allowedFileTypes,
      updatedBy: req.user?.id || null,
    });

    return sendSuccess(res, {
      message: 'System policy updated successfully',
      data: {
        ...policy,
        supportedFileTypes: SUPPORTED_FILE_TYPES,
      },
    });
  } catch (error) {
    if (error.code === 'INVALID_MAX_FILE_SIZE' || error.code === 'INVALID_ALLOWED_FILE_TYPES') {
      return sendError(res, {
        status: 400,
        code: 'INVALID_POLICY_INPUT',
        message: error.message,
      });
    }

    console.error('Update system policy settings error:', error);
    return sendError(res, {
      status: 500,
      code: 'UPDATE_SYSTEM_POLICY_SETTINGS_FAILED',
      message: 'Failed to update system policy settings',
    });
  }
};

// NEW: Delete User (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', id)
      .maybeSingle();

    if (existingUserError) throw existingUserError;
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;

    try {
      await deleteAuthUserByEmail(existingUser.email);
    } catch (authDeleteError) {
      console.error('Delete auth user warning:', authDeleteError.message);
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

exports.suspendUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot suspend your own account' });
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        is_active: false,
        suspended_at: new Date().toISOString(),
        suspended_reason: reason?.trim() || null,
      })
      .eq('id', id)
      .select('id, email, first_name, middle_name, last_name, role, is_active, suspended_at, suspended_reason')
      .single();

    if (error) throw error;

    return res.json({
      message: 'User suspended successfully',
      user: {
        ...data,
        fullName: buildFullName(data),
      },
    });
  } catch (error) {
    console.error('Suspend user error:', error);
    return res.status(500).json({ error: 'Failed to suspend user' });
  }
};

exports.reactivateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('users')
      .update({
        is_active: true,
        suspended_at: null,
        suspended_reason: null,
      })
      .eq('id', id)
      .select('id, email, first_name, middle_name, last_name, role, is_active, suspended_at, suspended_reason')
      .single();

    if (error) throw error;

    return res.json({
      message: 'User reactivated successfully',
      user: {
        ...data,
        fullName: buildFullName(data),
      },
    });
  } catch (error) {
    console.error('Reactivate user error:', error);
    return res.status(500).json({ error: 'Failed to reactivate user' });
  }
};
