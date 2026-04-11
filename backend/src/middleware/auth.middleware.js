const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { buildFullName } = require('../utils/name');

const getBearerToken = (authHeader) => {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
};

const resolveTokenIdentity = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return {
      userId: decoded.id || null,
      email: decoded.email || null,
      tokenClaims: decoded,
      authSource: 'legacy_jwt',
    };
  } catch (legacyError) {
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        throw error || new Error('Supabase user not found');
      }

      return {
        userId: data.user.id,
        email: data.user.email || null,
        tokenClaims: data.user,
        authSource: 'supabase_auth',
      };
    } catch (supabaseError) {
      return null;
    }
  }
};

const fetchUserBy = async (column, value) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, first_name, middle_name, last_name, role, department, department_id, program, program_id, is_active, suspended_at, suspended_reason, created_at')
    .eq(column, value)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
};

const getOrganizationLookups = async () => {
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
};

const loadCurrentUser = async ({ userId, email }) => {
  if (userId) {
    const userById = await fetchUserBy('id', userId);
    if (userById) {
      return userById;
    }
  }

  if (email) {
    return fetchUserBy('email', String(email).toLowerCase().trim());
  }

  return null;
};

// Verify token and rehydrate the current user from the database.
exports.authenticate = async (req, res, next) => {
  try {
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const identity = await resolveTokenIdentity(token);
    if (!identity) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = await loadCurrentUser(identity);
    if (!user) {
      return res.status(401).json({ error: 'User not found or not provisioned' });
    }

    const organizationLookups = await getOrganizationLookups();
    const departmentLabel = user.department_id && organizationLookups.departmentById.has(user.department_id)
      ? organizationLookups.departmentById.get(user.department_id)
      : user.department || null;
    const programLabel = user.program_id && organizationLookups.programById.has(user.program_id)
      ? organizationLookups.programById.get(user.program_id)
      : user.program || null;

    if (user.is_active === false || user.suspended_at) {
      return res.status(403).json({
        error: user.suspended_reason
          ? `Account suspended: ${user.suspended_reason}`
          : 'Account is suspended. Please contact administrator.',
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      department: departmentLabel,
      department_id: user.department_id || null,
      program: programLabel,
      program_id: user.program_id || null,
      fullName: buildFullName(user),
      authSource: identity.authSource,
      tokenClaims: identity.tokenClaims,
    };
    next();
  } catch (error) {
    console.error('Authenticate middleware error:', error.message || error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Check user role
exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  };
};

// Faculty role check helper
exports.isFaculty = (req, res, next) => {
  if (!req.user || req.user.role !== 'faculty') {
    return res.status(403).json({ error: 'Faculty access required' });
  }
  next();
};

// Staff or Admin check helper
exports.isStaffOrAdmin = (req, res, next) => {
  if (!req.user || !['staff', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Staff or Admin access required' });
  }
  next();
};

// Dean only check helper
exports.isDean = (req, res, next) => {
  if (!req.user || req.user.role !== 'dean') {
    return res.status(403).json({ error: 'Dean access required' });
  }
  next();
};

// Dean or Program Chair check helper
exports.isDeanOrProgramChair = (req, res, next) => {
  if (!req.user || !['dean', 'program_chair'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Dean or Program Chair access required' });
  }
  next();
};
