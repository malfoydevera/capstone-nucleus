const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { logAuditEvent } = require('../utils/audit');
const { sendSuccess, sendError } = require('../utils/response');

// ... (Keep existing register and login functions exactly as they are) ...

// Register new user
exports.register = async (req, res) => {
  // ... (Keep existing code) ...
  try {
    const { email, password, fullName, role, program, department } = req.body;

    if (!email || !password || !fullName || !role) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'All fields are required' });
    }

    const normalizedRole = String(role).trim();
    if (normalizedRole !== 'student') {
      return sendError(res, {
        status: 403,
        code: 'REGISTRATION_ROLE_NOT_ALLOWED',
        message: 'Public registration is only available for students'
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedFullName = String(fullName).trim();

    if (normalizedFullName.length < 2) {
      return sendError(res, { status: 400, code: 'INVALID_FULL_NAME', message: 'Full name is too short' });
    }

    if (String(password).length < 6) {
      return sendError(res, { status: 400, code: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters' });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (existingUser) {
      return sendError(res, { status: 400, code: 'USER_EXISTS', message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{
        email: normalizedEmail,
        password: hashedPassword,
        full_name: normalizedFullName,
        role: 'student',
        program: program?.trim() || null,
        department: department?.trim() || null,
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
          fullName: newUser.full_name,
          role: newUser.role,
          department: newUser.department,
          program: newUser.program,
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
  // ... (Keep existing code) ...
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'Email and password are required'
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return sendError(res, { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
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

    sendSuccess(res, {
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          department: user.department,
          program: user.program,
        },
      },
    });

    // Audit log (fire-and-forget after response)
    logAuditEvent({
      userId: user.id,
      userRole: user.role,
      userName: user.full_name,
      action: 'login',
      targetType: 'system',
      details: { email: user.email },
      ipAddress: req.ip,
    });
  } catch (error) {
    console.error('Login error:', error);
    return sendError(res, { status: 500, code: 'LOGIN_FAILED', message: 'Server error' });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, department, program, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return sendError(res, { status: 404, code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    return sendSuccess(res, {
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          department: user.department,
          program: user.program,
          createdAt: user.created_at,
        },
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return sendError(res, { status: 500, code: 'GET_USER_FAILED', message: 'Server error' });
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
      .select('id, email, full_name, role, program, created_at') // ADDED: 'program'
      .order('created_at', { ascending: false });

    // 3. Apply filter if a role is requested
    if (role) {
      query = query.eq('role', role);
    }

    const { data: users, error } = await query;

    if (error) throw error;

    res.json({ users });
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
      return sendSuccess(res, { data: { students: [] } });
    }

    const { data: students, error } = await supabase
      .from('users')
      .select('id, full_name, email, program')
      .eq('role', 'student')
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);

    if (error) throw error;

    return sendSuccess(res, { data: { students: students || [] } });
  } catch (error) {
    console.error('Search students error:', error);
    return sendError(res, { status: 500, code: 'SEARCH_STUDENTS_FAILED', message: 'Failed to search students' });
  }
};

// NEW: Create Privileged User (Admin only)
// Creates faculty, staff, dean, program_chair, or admin accounts
exports.createPrivilegedUser = async (req, res) => {
  try {
    const { email, password, fullName, role, department, program } = req.body;

    const allowedRoles = ['faculty', 'staff', 'dean', 'program_chair', 'admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be faculty, staff, dean, program_chair, or admin.' });
    }

    if (!email || !password || !fullName || !role) {
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

    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        full_name: fullName.trim(),
        role,
        department: department?.trim() || null,
        program: program?.trim() || null,
      }])
      .select('id, email, full_name, role, department, program, created_at')
      .single();

    if (error) throw error;

    res.status(201).json({
      message: `${role.replace('_', ' ')} account created successfully.`,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.full_name,
        role: newUser.role,
        department: newUser.department,
        program: newUser.program,
        createdAt: newUser.created_at,
      },
    });
  } catch (error) {
    console.error('Create privileged user error:', error);
    res.status(500).json({ error: 'Failed to create user account.' });
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