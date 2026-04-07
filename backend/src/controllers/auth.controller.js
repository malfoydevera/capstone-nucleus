const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { attachFullName, buildFullName, splitFullName } = require('../utils/name');
const { sendSuccess, sendError } = require('../utils/response');
const { sendTransactionalEmail } = require('../utils/mailer');
const { getSystemPolicy, updateSystemPolicy, SUPPORTED_FILE_TYPES } = require('../utils/systemPolicy');

const BULK_IMPORT_ALLOWED_ROLES = ['student', 'faculty', 'dean', 'program_chair', 'staff', 'admin'];

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

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// Register new user
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
    const resolvedFirstName = (firstName || parsedFromFullName.first_name || '').trim();
    const resolvedMiddleName = (middleName || parsedFromFullName.middle_name || '').trim() || null;
    const resolvedLastName = (lastName || parsedFromFullName.last_name || '').trim();

    if (!email || !password || !role || !resolvedFirstName || !resolvedLastName) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'All fields are required' });
    }

    if (password.length < 8) {
      return sendError(res, { status: 400, code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters long' });
    }

    // Only students and faculty can self-register
    const allowedSelfRegisterRoles = ['student', 'faculty'];
    if (!allowedSelfRegisterRoles.includes(role)) {
      return sendError(res, {
        status: 403,
        code: 'REGISTRATION_ROLE_NOT_ALLOWED',
        message: 'This account type must be created by an administrator',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (existingUser) {
      return sendError(res, { status: 400, code: 'USER_EXISTS', message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let resolvedDepartmentId = departmentId || null;
    let resolvedProgramId = role === 'student' ? (programId || null) : null;
    let resolvedDepartmentName = department?.trim() || null;
    let resolvedProgramName = role === 'student' ? (program?.trim() || null) : null;

    // Students should always map to a concrete program row.
    if (role === 'student' && !resolvedProgramId && !resolvedProgramName) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Program is required for student registration' });
    }

    if (role === 'student' && resolvedProgramId) {
      const { data: selectedProgram } = await supabase
        .from('programs')
        .select('id, name, department_id, departments(name)')
        .eq('id', resolvedProgramId)
        .single();

      if (!selectedProgram) {
        return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Selected program is invalid' });
      }

      resolvedProgramName = selectedProgram.name;
      resolvedDepartmentId = selectedProgram.department_id;
      resolvedDepartmentName = selectedProgram.departments?.name || resolvedDepartmentName;
    }

    if (role === 'student' && !resolvedProgramId && resolvedProgramName) {
      const { data: selectedProgram } = await supabase
        .from('programs')
        .select('id, name, department_id, departments(name)')
        .ilike('name', resolvedProgramName)
        .limit(1)
        .maybeSingle();

      if (selectedProgram) {
        resolvedProgramId = selectedProgram.id;
        resolvedProgramName = selectedProgram.name;
        resolvedDepartmentId = selectedProgram.department_id;
        resolvedDepartmentName = selectedProgram.departments?.name || resolvedDepartmentName;
      }
    }

    if (!resolvedDepartmentName && resolvedDepartmentId) {
      const { data: selectedDepartment } = await supabase
        .from('departments')
        .select('name')
        .eq('id', resolvedDepartmentId)
        .single();
      if (selectedDepartment) resolvedDepartmentName = selectedDepartment.name;
    }

    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{
        email: normalizedEmail,
        password: hashedPassword,
        first_name: resolvedFirstName,
        middle_name: resolvedMiddleName,
        last_name: resolvedLastName,
        role,
        department_id: resolvedDepartmentId,
        program_id: resolvedProgramId,
        department: resolvedDepartmentName,
        program: resolvedProgramName,
      }])
      .select()
      .single();

    if (error) throw error;

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return sendSuccess(res, {
      status: 201,
      message: 'User registered successfully',
      data: {
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: buildFullName(newUser),
          role: newUser.role,
        },
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return sendError(res, { status: 500, code: 'REGISTER_FAILED', message: 'Server error' });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

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

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return sendError(res, { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    try {
      await supabase.from('refresh_tokens').insert([{
        user_id: user.id,
        token: refreshToken,
        expires_at: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString(),
      }]);
    } catch (refreshError) {
      console.log('Refresh token persistence skipped:', refreshError.message);
    }

    return sendSuccess(res, {
      message: 'Login successful',
      data: {
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          fullName: buildFullName(user),
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return sendError(res, { status: 500, code: 'LOGIN_FAILED', message: 'Server error' });
  }
};

// Request password reset
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const { data: user } = await supabase
      .from('users')
      .select('id, email, recovery_email')
      .or(`email.eq.${normalizedEmail},recovery_email.eq.${normalizedEmail}`)
      .maybeSingle();

    // Prevent account enumeration by returning a generic success response either way.
    if (!user) {
      const diagnostics = process.env.NODE_ENV !== 'production'
        ? { emailDelivery: { delivered: false, skipped: true, reason: 'ACCOUNT_NOT_FOUND' } }
        : {};

      return sendSuccess(res, {
        message: 'If an account exists for that email, a password reset link has been generated.',
        data: diagnostics,
      });
    }

    const ttlMinutesRaw = Number(process.env.RESET_PASSWORD_TOKEN_TTL_MINUTES || 30);
    const ttlMinutes = Number.isFinite(ttlMinutesRaw) ? Math.max(5, ttlMinutesRaw) : 30;
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + (ttlMinutes * 60 * 1000)).toISOString();

    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('used_at', null);

    const { error: tokenInsertError } = await supabase
      .from('password_reset_tokens')
      .insert([{
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      }]);

    if (tokenInsertError) {
      throw tokenInsertError;
    }

    const frontendBaseUrl = (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
    const resetLink = `${frontendBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;

    const resetRecipient = (user.recovery_email || user.email || '').trim();

    const emailResult = await sendTransactionalEmail({
      to: resetRecipient,
      subject: 'NUCLEUS Password Reset',
      text: [
        'Hello,',
        '',
        'We received a request to reset your password.',
        `Reset link: ${resetLink}`,
        `This link expires in ${ttlMinutes} minutes.`,
        '',
        'If you did not request this, you can ignore this email.',
      ].join('\n'),
    });

    if (process.env.NODE_ENV !== 'production' || process.env.EXPOSE_RESET_TOKEN === 'true') {
      return sendSuccess(res, {
        message: 'If an account exists for that email, a password reset link has been generated.',
        data: {
          resetLink,
          emailDelivery: emailResult,
        },
      });
    }

    return sendSuccess(res, {
      message: 'If an account exists for that email, a password reset link has been generated.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return sendError(res, { status: 500, code: 'FORGOT_PASSWORD_FAILED', message: 'Server error' });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Token and new password are required' });
    }

    if (newPassword.length < 8) {
      return sendError(res, { status: 400, code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters long' });
    }

    const tokenHash = hashResetToken(token);

    const { data: resetRecord, error: resetRecordError } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .maybeSingle();

    if (resetRecordError || !resetRecord) {
      return sendError(res, { status: 400, code: 'INVALID_RESET_TOKEN', message: 'Reset token is invalid or expired' });
    }

    const isExpired = new Date(resetRecord.expires_at).getTime() <= Date.now();
    if (isExpired) {
      return sendError(res, { status: 400, code: 'INVALID_RESET_TOKEN', message: 'Reset token is invalid or expired' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        password: hashedPassword,
        updated_at: new Date().toISOString(),
      })
      .eq('id', resetRecord.user_id)
      .select('id')
      .maybeSingle();

    if (updateError || !updatedUser) {
      return sendError(res, { status: 400, code: 'INVALID_RESET_TOKEN', message: 'Reset token is invalid or expired' });
    }

    try {
      await supabase
        .from('password_reset_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('user_id', resetRecord.user_id)
        .is('used_at', null);

      await supabase.from('refresh_tokens').delete().eq('user_id', resetRecord.user_id);
    } catch (refreshDeleteError) {
      console.log('Refresh token invalidation skipped:', refreshDeleteError.message);
    }

    return sendSuccess(res, {
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return sendError(res, { status: 500, code: 'RESET_PASSWORD_FAILED', message: 'Server error' });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, first_name, middle_name, last_name, role, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: buildFullName(user),
        role: user.role,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// NEW: Get All Users (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    // 1. Check if a role filter was provided in the URL (e.g., ?role=staff)
    const { role } = req.query;

    // 2. Start the query
    let query = supabase
      .from('users')
      .select('id, email, first_name, middle_name, last_name, role, program, department, is_active, suspended_at, suspended_reason, created_at')
      .order('created_at', { ascending: false });

    // 3. Apply filter if a role is requested
    if (role) {
      query = query.eq('role', role);
    }

    const { data: users, error } = await query;

    if (error) throw error;

    res.json({ users: (users || []).map(attachFullName) });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Server error' });
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
    const { email, password, fullName, firstName, middleName, lastName, role, department, departmentId } = req.body;

    const allowedRoles = ['faculty', 'staff', 'dean', 'program_chair', 'admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be faculty, staff, dean, program_chair, or admin.' });
    }

    const parsedFromFullName = splitFullName(fullName);
    const resolvedFirstName = (firstName || parsedFromFullName.first_name || '').trim();
    const resolvedMiddleName = (middleName || parsedFromFullName.middle_name || '').trim() || null;
    const resolvedLastName = (lastName || parsedFromFullName.last_name || '').trim();

    if (!email || !password || !role || !resolvedFirstName || !resolvedLastName) {
      return res.status(400).json({ error: 'Email, password, full name, and role are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let resolvedDepartmentId = departmentId || null;
    let resolvedDepartmentName = department?.trim() || null;

    if (resolvedDepartmentId) {
      const { data: selectedDepartment } = await supabase
        .from('departments')
        .select('id, name')
        .eq('id', resolvedDepartmentId)
        .single();

      if (!selectedDepartment) {
        return res.status(400).json({ error: 'Selected department is invalid.' });
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

    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        first_name: resolvedFirstName,
        middle_name: resolvedMiddleName,
        last_name: resolvedLastName,
        role,
        department: resolvedDepartmentName,
        department_id: resolvedDepartmentId,
      }])
      .select('id, email, first_name, middle_name, last_name, role, department, department_id, created_at')
      .single();

    if (error) throw error;

    res.status(201).json({
      message: `${role.replace('_', ' ')} account created successfully.`,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: buildFullName(newUser),
        role: newUser.role,
        department: newUser.department,
        departmentId: newUser.department_id,
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
      program: headers.findIndex((h) => h === 'program'),
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
        program: idx.program >= 0 ? (cells[idx.program] || '').trim() : '',
      };

      try {
        const parsedFullName = splitFullName(row.fullName);
        const resolvedFirstName = (row.firstName || parsedFullName.first_name || '').trim();
        const resolvedMiddleName = (row.middleName || parsedFullName.middle_name || '').trim() || null;
        const resolvedLastName = (row.lastName || parsedFullName.last_name || '').trim();

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

        const hashedPassword = await bcrypt.hash(row.password, 10);

        const { error: insertError } = await supabase
          .from('users')
          .insert([{
            email: row.email,
            password: hashedPassword,
            first_name: resolvedFirstName,
            middle_name: resolvedMiddleName,
            last_name: resolvedLastName,
            role: row.role,
            department: row.department || null,
            program: row.role === 'student' ? (row.program || null) : null,
          }]);

        if (insertError) throw insertError;

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

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;

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