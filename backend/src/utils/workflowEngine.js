const supabase = require('../config/supabase');

const DEFAULT_ACTIVE_STAGES = [
  { code: 'pending_faculty', label: 'Faculty Review', reviewer_role: 'faculty', position: 10, is_active: true },
  { code: 'pending_dean', label: 'Dean Review', reviewer_role: 'dean', position: 20, is_active: true },
  { code: 'pending_program_chair', label: 'Program Chair Review', reviewer_role: 'program_chair', position: 30, is_active: true },
  { code: 'pending_editor', label: 'Research Editor Review', reviewer_role: 'staff', position: 40, is_active: true },
  { code: 'pending_admin', label: 'Admin Final Review', reviewer_role: 'admin', position: 50, is_active: true },
  { code: 'approved', label: 'Approved / Published', reviewer_role: 'admin', position: 60, is_active: true },
];

function normalizeStages(stages) {
  const safeStages = Array.isArray(stages) ? stages.filter((stage) => stage && stage.is_active !== false) : [];
  return safeStages
    .map((stage) => ({
      code: stage.code,
      label: stage.label,
      reviewer_role: stage.reviewer_role,
      position: Number(stage.position) || 0,
      is_active: stage.is_active !== false,
    }))
    .sort((a, b) => a.position - b.position);
}

async function getActiveWorkflowStages() {
  try {
    const { data, error } = await supabase
      .from('workflow_stages')
      .select('code, label, reviewer_role, position, is_active')
      .eq('is_active', true)
      .order('position', { ascending: true });

    if (error || !data || data.length === 0) {
      return DEFAULT_ACTIVE_STAGES;
    }

    return normalizeStages(data);
  } catch {
    return DEFAULT_ACTIVE_STAGES;
  }
}

function findStageByCode(stages, code) {
  return stages.find((stage) => stage.code === code) || null;
}

function findStageByRole(stages, role) {
  return stages.find((stage) => stage.reviewer_role === role) || null;
}

function resolveNextStageByRole(stages, currentStatus, targetRole) {
  const directRoleStage = findStageByRole(stages, targetRole);
  if (directRoleStage) return directRoleStage;

  const currentStage = findStageByCode(stages, currentStatus);
  if (!currentStage) return null;

  return stages.find((stage) => stage.position > currentStage.position) || null;
}

function resolveApprovalTransition({ stages, currentStatus, reviewerRole, targetRole }) {
  const safeStages = normalizeStages(stages);

  if (reviewerRole === 'faculty') {
    if (!['dean', 'program_chair'].includes(targetRole)) {
      return null;
    }
    return resolveNextStageByRole(safeStages, currentStatus, targetRole);
  }

  if (reviewerRole === 'dean' || reviewerRole === 'program_chair') {
    return resolveNextStageByRole(safeStages, currentStatus, 'staff');
  }

  if (reviewerRole === 'staff') {
    return resolveNextStageByRole(safeStages, currentStatus, 'admin');
  }

  if (reviewerRole === 'admin') {
    const approvedStage = findStageByCode(safeStages, 'approved');
    if (approvedStage) return approvedStage;
    return {
      code: 'approved',
      label: 'Approved / Published',
      reviewer_role: 'admin',
      position: Number.MAX_SAFE_INTEGER,
      is_active: true,
    };
  }

  return null;
}

function resolveRejectionStatus({ stages }) {
  const safeStages = normalizeStages(stages);
  const rejectedStage = findStageByCode(safeStages, 'rejected');
  return rejectedStage?.code || 'rejected';
}

function resolveBypassTargets({ stages, currentStatus }) {
  const safeStages = normalizeStages(stages);
  if (safeStages.length === 0) {
    return ['pending_dean', 'pending_editor', 'pending_admin', 'approved'];
  }

  const currentStage = findStageByCode(safeStages, currentStatus);
  const candidateStages = currentStage
    ? safeStages.filter((stage) => stage.position >= currentStage.position)
    : safeStages;

  const filteredCodes = candidateStages
    .map((stage) => stage.code)
    .filter((code) => code !== 'rejected' && code !== 'published');

  if (!filteredCodes.includes('approved')) {
    filteredCodes.push('approved');
  }

  return Array.from(new Set(filteredCodes));
}

function resolvePreviousStageCode(stages, currentStatus, preferredRoles = []) {
  const safeStages = normalizeStages(stages);
  const currentStage = findStageByCode(safeStages, currentStatus);
  if (!currentStage) return null;

  const previousStages = safeStages
    .filter((stage) => stage.position < currentStage.position)
    .sort((a, b) => b.position - a.position);

  if (preferredRoles.length > 0) {
    const preferred = previousStages.find((stage) => preferredRoles.includes(stage.reviewer_role));
    if (preferred) return preferred.code;
  }

  return previousStages[0]?.code || null;
}

function resolveRevisionTransition({ reviewerRole }) {
  if (['faculty', 'dean', 'program_chair', 'staff', 'admin'].includes(reviewerRole)) {
    return 'revision_required';
  }
  return null;
}

function validateWorkflowStages(stages) {
  const safeStages = normalizeStages(stages);
  const warnings = [];

  if (safeStages.length === 0) {
    warnings.push('No active workflow stages configured. Default workflow fallback will be used.');
    return { ok: false, warnings };
  }

  const requiredCodes = ['pending_faculty', 'pending_editor', 'pending_admin', 'approved'];
  const existingCodes = new Set(safeStages.map((stage) => stage.code));

  requiredCodes.forEach((code) => {
    if (!existingCodes.has(code)) {
      warnings.push(`Missing recommended stage: ${code}`);
    }
  });

  const roleCounts = safeStages.reduce((acc, stage) => {
    acc[stage.reviewer_role] = (acc[stage.reviewer_role] || 0) + 1;
    return acc;
  }, {});

  ['faculty', 'staff', 'admin'].forEach((role) => {
    if (!roleCounts[role]) {
      warnings.push(`No active stage is assigned to role: ${role}`);
    }
  });

  for (let i = 1; i < safeStages.length; i += 1) {
    if (safeStages[i].position === safeStages[i - 1].position) {
      warnings.push(`Stages "${safeStages[i - 1].code}" and "${safeStages[i].code}" share the same position value.`);
    }
  }

  return { ok: warnings.length === 0, warnings };
}

module.exports = {
  DEFAULT_ACTIVE_STAGES,
  getActiveWorkflowStages,
  resolveApprovalTransition,
  resolveRevisionTransition,
  resolveRejectionStatus,
  resolveBypassTargets,
  validateWorkflowStages,
};
