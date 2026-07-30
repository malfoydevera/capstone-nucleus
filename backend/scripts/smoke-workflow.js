require('dotenv').config();

const axios = require('axios');
const jwt = require('jsonwebtoken');
const supabase = require('../src/config/supabase');

const API_BASE_URL = process.env.SMOKE_API_BASE_URL || process.env.VITE_API_URL || 'http://localhost:5001/api';

const ROLE_CREDENTIALS = {
  student: {
    email: process.env.SMOKE_STUDENT_EMAIL,
    password: process.env.SMOKE_STUDENT_PASSWORD,
  },
  faculty: {
    email: process.env.SMOKE_FACULTY_EMAIL,
    password: process.env.SMOKE_FACULTY_PASSWORD,
  },
  dean: {
    email: process.env.SMOKE_DEAN_EMAIL,
    password: process.env.SMOKE_DEAN_PASSWORD,
  },
  program_chair: {
    email: process.env.SMOKE_PROGRAM_CHAIR_EMAIL,
    password: process.env.SMOKE_PROGRAM_CHAIR_PASSWORD,
  },
  staff: {
    email: process.env.SMOKE_STAFF_EMAIL,
    password: process.env.SMOKE_STAFF_PASSWORD,
  },
  admin: {
    email: process.env.SMOKE_ADMIN_EMAIL,
    password: process.env.SMOKE_ADMIN_PASSWORD,
  },
};

const ROLE_CHECKS = {
  student: [
    { name: 'Auth profile', method: 'get', path: '/auth/me' },
    { name: 'Submission policy', method: 'get', path: '/auth/submission-policy' },
    { name: 'My papers', method: 'get', path: '/research/my/papers' },
    { name: 'Co-author invitations', method: 'get', path: '/auth/co-author-invitations' },
  ],
  faculty: [
    { name: 'Auth profile', method: 'get', path: '/auth/me' },
    { name: 'Assigned queue', method: 'get', path: '/research/faculty/assigned' },
    { name: 'Workload summary', method: 'get', path: '/research/faculty/workload' },
  ],
  dean: [
    { name: 'Auth profile', method: 'get', path: '/auth/me' },
    { name: 'Dean queue', method: 'get', path: '/research/dean-chair/assigned' },
  ],
  program_chair: [
    { name: 'Auth profile', method: 'get', path: '/auth/me' },
    { name: 'Chair queue', method: 'get', path: '/research/dean-chair/assigned' },
    { name: 'Program analytics', method: 'get', path: '/research/program-chair/analytics' },
    { name: 'Program deadlines', method: 'get', path: '/research/program-chair/deadlines' },
  ],
  staff: [
    { name: 'Auth profile', method: 'get', path: '/auth/me' },
    { name: 'Editor queue', method: 'get', path: '/research/all/papers' },
  ],
  admin: [
    { name: 'Auth profile', method: 'get', path: '/auth/me' },
    { name: 'System health', method: 'get', path: '/auth/system-health' },
    { name: 'Workflow validation', method: 'get', path: '/research/admin/workflow-stages/validate' },
    { name: 'All papers', method: 'get', path: '/research/admin/all?includeDeleted=true' },
  ],
};

function hasCreds(role) {
  const creds = ROLE_CREDENTIALS[role];
  return Boolean(creds?.email && creds?.password);
}

async function login(role) {
  const creds = ROLE_CREDENTIALS[role];
  const response = await axios.post(`${API_BASE_URL}/auth/login`, creds, {
    validateStatus: () => true,
    timeout: 15000,
  });

  if (response.status !== 200) {
    return {
      ok: false,
      status: response.status,
      message: response.data?.error?.message || response.data?.error || response.data?.message || 'Login failed',
    };
  }

  const token = response.data?.data?.token || response.data?.token;
  if (!token) {
    return {
      ok: false,
      status: 500,
      message: 'Login succeeded but token missing in response',
    };
  }

  return { ok: true, token };
}

async function buildLocalTokenByRole(role) {
  if (!process.env.JWT_SECRET) {
    return {
      ok: false,
      status: 500,
      message: 'JWT_SECRET is not configured for local token fallback',
    };
  }

  const email = ROLE_CREDENTIALS[role]?.email;
  if (!email) {
    return {
      ok: false,
      status: 400,
      message: `Missing email for role ${role}`,
    };
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('email', String(email).toLowerCase().trim())
    .single();

  if (error || !user) {
    return {
      ok: false,
      status: 404,
      message: `Cannot build fallback token, user not found: ${email}`,
    };
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  return { ok: true, token };
}

async function runRoleChecks(role) {
  const checks = ROLE_CHECKS[role] || [];
  let loginResult = await login(role);
  let usedFallbackToken = false;

  if (!loginResult.ok && loginResult.status === 429) {
    const fallbackResult = await buildLocalTokenByRole(role);
    if (fallbackResult.ok) {
      loginResult = fallbackResult;
      usedFallbackToken = true;
    }
  }

  if (!loginResult.ok) {
    return {
      role,
      ok: false,
      failures: [`Login failed (${loginResult.status}): ${loginResult.message}`],
      passes: [],
      warnings: [],
    };
  }

  const token = loginResult.token;
  const failures = [];
  const passes = [];
  const warnings = [];

  if (usedFallbackToken) {
    warnings.push('Login hit rate limit (429); continued with local JWT fallback token for endpoint verification.');
  }

  for (const check of checks) {
    // eslint-disable-next-line no-await-in-loop
    const response = await axios({
      method: check.method,
      url: `${API_BASE_URL}${check.path}`,
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true,
      timeout: 15000,
    });

    if (response.status >= 200 && response.status < 300) {
      passes.push(`${check.name} (${response.status})`);
    } else {
      failures.push(
        `${check.name} failed (${response.status}): ${
          response.data?.error?.message || response.data?.error || response.data?.message || 'Unknown error'
        }`
      );
    }
  }

  return {
    role,
    ok: failures.length === 0,
    passes,
    failures,
    warnings,
  };
}

async function main() {
  console.log(`Running role smoke checks against: ${API_BASE_URL}`);

  const roles = Object.keys(ROLE_CHECKS);
  const enabledRoles = roles.filter(hasCreds);

  if (enabledRoles.length === 0) {
    console.log('No smoke credentials configured. Set SMOKE_<ROLE>_EMAIL and SMOKE_<ROLE>_PASSWORD to run checks.');
    process.exit(0);
  }

  const results = [];
  for (const role of enabledRoles) {
    // eslint-disable-next-line no-await-in-loop
    const result = await runRoleChecks(role);
    results.push(result);

    console.log(`\n[${role}] ${result.ok ? 'PASS' : 'FAIL'}`);
    result.passes.forEach((line) => console.log(`  + ${line}`));
    result.warnings.forEach((line) => console.log(`  ! ${line}`));
    result.failures.forEach((line) => console.log(`  - ${line}`));
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    console.log(`\nSmoke check failed for ${failed.length} role(s).`);
    process.exit(1);
  }

  console.log('\nAll configured role smoke checks passed.');
  process.exit(0);
}

main().catch((error) => {
  console.error('Smoke check run failed unexpectedly:', error.message || error);
  process.exit(1);
});
