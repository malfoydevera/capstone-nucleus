require('dotenv').config();

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const supabase = require('../src/config/supabase');

const ENV_PATH = path.resolve(__dirname, '..', '.env');
const DEFAULT_PASSWORD = process.env.SMOKE_DEFAULT_PASSWORD || 'SmokePass123!';

const ROLE_SPECS = [
  {
    role: 'student',
    envEmailKey: 'SMOKE_STUDENT_EMAIL',
    envPasswordKey: 'SMOKE_STUDENT_PASSWORD',
    defaultEmail: 'smoke.student@nucleus.local',
    firstName: 'Smoke',
    lastName: 'Student',
  },
  {
    role: 'faculty',
    envEmailKey: 'SMOKE_FACULTY_EMAIL',
    envPasswordKey: 'SMOKE_FACULTY_PASSWORD',
    defaultEmail: 'smoke.faculty@nucleus.local',
    firstName: 'Smoke',
    lastName: 'Faculty',
  },
  {
    role: 'dean',
    envEmailKey: 'SMOKE_DEAN_EMAIL',
    envPasswordKey: 'SMOKE_DEAN_PASSWORD',
    defaultEmail: 'smoke.dean@nucleus.local',
    firstName: 'Smoke',
    lastName: 'Dean',
  },
  {
    role: 'program_chair',
    envEmailKey: 'SMOKE_PROGRAM_CHAIR_EMAIL',
    envPasswordKey: 'SMOKE_PROGRAM_CHAIR_PASSWORD',
    defaultEmail: 'smoke.programchair@nucleus.local',
    firstName: 'Smoke',
    lastName: 'ProgramChair',
  },
  {
    role: 'staff',
    envEmailKey: 'SMOKE_STAFF_EMAIL',
    envPasswordKey: 'SMOKE_STAFF_PASSWORD',
    defaultEmail: 'smoke.staff@nucleus.local',
    firstName: 'Smoke',
    lastName: 'Staff',
  },
  {
    role: 'admin',
    envEmailKey: 'SMOKE_ADMIN_EMAIL',
    envPasswordKey: 'SMOKE_ADMIN_PASSWORD',
    defaultEmail: 'smoke.admin@nucleus.local',
    firstName: 'Smoke',
    lastName: 'Admin',
  },
];

function setOrAppendEnvVar(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');

  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }

  const suffix = content.endsWith('\n') ? '' : '\n';
  return `${content}${suffix}${line}\n`;
}

function loadEnvFile() {
  if (!fs.existsSync(ENV_PATH)) {
    fs.writeFileSync(ENV_PATH, '', 'utf8');
    return '';
  }

  return fs.readFileSync(ENV_PATH, 'utf8');
}

async function getDepartmentAndProgram() {
  const { data: programRows, error: programError } = await supabase
    .from('programs')
    .select('id, name, department_id, departments(name)')
    .limit(1);

  if (programError) {
    throw new Error(`Failed to query programs: ${programError.message}`);
  }

  const firstProgram = programRows?.[0] || null;

  const { data: departmentRows, error: departmentError } = await supabase
    .from('departments')
    .select('id, name')
    .limit(1);

  if (departmentError) {
    throw new Error(`Failed to query departments: ${departmentError.message}`);
  }

  const firstDepartment = departmentRows?.[0] || null;

  return {
    departmentId: firstProgram?.department_id || firstDepartment?.id || null,
    departmentName: firstProgram?.departments?.name || firstDepartment?.name || null,
    programId: firstProgram?.id || null,
    programName: firstProgram?.name || null,
  };
}

async function upsertSmokeUser(spec, sharedScope, hashedPassword) {
  const email = String(process.env[spec.envEmailKey] || spec.defaultEmail).toLowerCase().trim();

  const basePayload = {
    email,
    password: hashedPassword,
    first_name: spec.firstName,
    middle_name: null,
    last_name: spec.lastName,
    role: spec.role,
    is_active: true,
    suspended_at: null,
    suspended_reason: null,
    department_id: sharedScope.departmentId,
    department: sharedScope.departmentName,
    updated_at: new Date().toISOString(),
  };

  if (spec.role === 'student') {
    basePayload.program_id = sharedScope.programId;
    basePayload.program = sharedScope.programName;
  } else {
    basePayload.program_id = null;
    basePayload.program = null;
  }

  const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to query existing user (${email}): ${existingError.message}`);
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('users')
      .update(basePayload)
      .eq('id', existing.id);

    if (updateError) {
      throw new Error(`Failed to update smoke user (${email}): ${updateError.message}`);
    }

    return { email, mode: 'updated' };
  }

  const insertPayload = {
    ...basePayload,
    created_at: new Date().toISOString(),
  };

  const { error: insertError } = await supabase
    .from('users')
    .insert([insertPayload]);

  if (insertError) {
    throw new Error(`Failed to create smoke user (${email}): ${insertError.message}`);
  }

  return { email, mode: 'created' };
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  const sharedScope = await getDepartmentAndProgram();

  if (!sharedScope.departmentId && !sharedScope.departmentName) {
    throw new Error('No department found. Seed departments before bootstrapping smoke users.');
  }

  const password = DEFAULT_PASSWORD;
  const hashedPassword = await bcrypt.hash(password, 10);
  const summary = [];

  for (const spec of ROLE_SPECS) {
    // eslint-disable-next-line no-await-in-loop
    const result = await upsertSmokeUser(spec, sharedScope, hashedPassword);
    summary.push({ ...result, role: spec.role });
  }

  let envContent = loadEnvFile();

  for (const spec of ROLE_SPECS) {
    const email = String(process.env[spec.envEmailKey] || spec.defaultEmail).toLowerCase().trim();
    envContent = setOrAppendEnvVar(envContent, spec.envEmailKey, email);
    envContent = setOrAppendEnvVar(envContent, spec.envPasswordKey, password);
  }

  envContent = setOrAppendEnvVar(envContent, 'SMOKE_API_BASE_URL', process.env.SMOKE_API_BASE_URL || 'http://localhost:5001/api');

  fs.writeFileSync(ENV_PATH, envContent, 'utf8');

  console.log('Smoke users bootstrap complete.');
  summary.forEach((item) => {
    console.log(`- ${item.role}: ${item.mode} (${item.email})`);
  });
  console.log('Updated smoke credentials in backend .env');
}

main().catch((error) => {
  console.error('Bootstrap smoke users failed:', error.message || error);
  process.exit(1);
});
