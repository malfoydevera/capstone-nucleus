/**
 * admin.controller.js — F-002
 * Handles: admin-only CRUD, publish/unpublish, and staff/admin listing.
 */
const supabase = require('../config/supabase');
const { resolvePaperFileUrl } = require('../utils/fileAccess');
const { sendSuccess, sendError } = require('../utils/response');
const { attachFullName } = require('../utils/name');
const { validateWorkflowStages } = require('../utils/workflowEngine');

const RECYCLE_BIN_RETENTION_DAYS = Number.parseInt(process.env.RECYCLE_BIN_RETENTION_DAYS || '30', 10);
const WORKFLOW_STAGE_ROLES = ['faculty', 'dean', 'program_chair', 'staff', 'admin'];

exports.getAllResearch = async (req, res) => {
  try {
    const { status, includeDeleted } = req.query;
    let query = supabase.from('research_papers')
      .select('*, author:users!author_id (id, first_name, middle_name, last_name, email)')
      .order('submission_date', { ascending: false });
    if (status) query = query.eq('status', status);
    if (includeDeleted !== 'true') query = query.is('deleted_at', null);
    const { data: papers, error } = await query;
    if (error) throw error;
    const transformed = await Promise.all((papers || []).map(async p => ({ ...p, users: attachFullName(p.author), file_url: await resolvePaperFileUrl(p) })));
    return sendSuccess(res, { data: { papers: transformed } });
  } catch (error) {
    console.error('Get all research error:', error);
    return sendError(res, { status: 500, code: 'GET_ALL_RESEARCH_FAILED', message: 'Server error' });
  }
};

exports.adminGetAllResearch = async (req, res) => {
  try {
    const { includeDeleted } = req.query;
    let query = supabase.from('research_papers')
      .select('*, author:users!author_id (id, first_name, middle_name, last_name, email, role), reviews:approval_workflow(*)')
      .order('created_at', { ascending: false });
    if (includeDeleted !== 'true') query = query.is('deleted_at', null);

    const { data: papers, error } = await query;
    if (error) throw error;
    return sendSuccess(res, { data: { papers: papers.map(p => ({ ...p, users: attachFullName(p.author) })) } });
  } catch (error) {
    console.error('Admin fetch error:', error);
    return sendError(res, { status: 500, code: 'ADMIN_GET_ALL_RESEARCH_FAILED', message: 'Failed to fetch research data' });
  }
};

exports.adminUpdateResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: updatedPaper, error } = await supabase.from('research_papers')
      .update(req.body).eq('id', id)
      .select('*, author:users!author_id (id, first_name, middle_name, last_name, email)').single();
    if (error) throw error;
    return sendSuccess(res, { message: 'Research updated successfully', data: { paper: { ...updatedPaper, users: attachFullName(updatedPaper.author) } } });
  } catch (error) {
    console.error('Admin update error:', error);
    return sendError(res, { status: 500, code: 'ADMIN_UPDATE_RESEARCH_FAILED', message: 'Failed to update research' });
  }
};

exports.adminDeleteResearch = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('research_papers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found or already deleted' });
    }

    return sendSuccess(res, { message: 'Research moved to recycle bin', data: {} });
  } catch (error) {
    console.error('Admin delete error:', error);
    return sendError(res, { status: 500, code: 'ADMIN_DELETE_RESEARCH_FAILED', message: 'Failed to delete research' });
  }
};

exports.adminRestoreResearch = async (req, res) => {
  try {
    const { data: existing, error: findError } = await supabase
      .from('research_papers')
      .select('id, deleted_at')
      .eq('id', req.params.id)
      .not('deleted_at', 'is', null)
      .maybeSingle();

    if (findError) throw findError;
    if (!existing) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found in recycle bin' });
    }

    const deletedAt = new Date(existing.deleted_at);
    const expiresAt = new Date(deletedAt);
    expiresAt.setDate(expiresAt.getDate() + RECYCLE_BIN_RETENTION_DAYS);
    if (Date.now() > expiresAt.getTime()) {
      return sendError(res, {
        status: 410,
        code: 'RECYCLE_BIN_EXPIRED',
        message: `Restore window expired after ${RECYCLE_BIN_RETENTION_DAYS} days`,
      });
    }

    const { data, error } = await supabase
      .from('research_papers')
      .update({ deleted_at: null })
      .eq('id', req.params.id)
      .not('deleted_at', 'is', null)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found in recycle bin' });
    }

    return sendSuccess(res, { message: 'Research restored successfully', data: {} });
  } catch (error) {
    console.error('Admin restore error:', error);
    return sendError(res, { status: 500, code: 'ADMIN_RESTORE_RESEARCH_FAILED', message: 'Failed to restore research' });
  }
};

exports.adminPublishResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: publishedPaper, error } = await supabase.from('research_papers')
      .update({ status: 'published', is_published: true, published_date: new Date().toISOString() })
      .eq('id', id).select('*, author:users!author_id (id, first_name, middle_name, last_name, email)').single();
    if (error) throw error;
    await supabase.from('notifications').insert([{
      user_id: publishedPaper.author_id, research_id: id, type: 'publication',
      title: 'Research Published',
      message: `Congratulations! Your research "${publishedPaper.title}" is now available.`,
    }]);
    return sendSuccess(res, { data: { paper: { ...publishedPaper, users: attachFullName(publishedPaper.author) } } });
  } catch (error) {
    console.error('Publish error:', error);
    return sendError(res, { status: 500, code: 'ADMIN_PUBLISH_RESEARCH_FAILED', message: 'Failed to publish research' });
  }
};

exports.adminUnpublishResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: unpublishedPaper, error } = await supabase.from('research_papers')
      .update({ status: 'approved', is_published: false, published_date: null })
      .eq('id', id).select('*, author:users!author_id (id, first_name, middle_name, last_name, email)').single();
    if (error) throw error;
    return sendSuccess(res, { data: { paper: { ...unpublishedPaper, users: attachFullName(unpublishedPaper.author) } } });
  } catch (error) {
    console.error('Unpublish error:', error);
    return sendError(res, { status: 500, code: 'ADMIN_UNPUBLISH_RESEARCH_FAILED', message: 'Failed to unpublish research' });
  }
};

exports.getWorkflowStages = async (req, res) => {
  try {
    const { data: stages, error } = await supabase
      .from('workflow_stages')
      .select('*')
      .order('position', { ascending: true });

    if (error) throw error;
    return sendSuccess(res, { data: { stages: stages || [] } });
  } catch (error) {
    console.error('Get workflow stages error:', error);
    return sendError(res, {
      status: 500,
      code: 'GET_WORKFLOW_STAGES_FAILED',
      message: 'Failed to fetch workflow stages',
    });
  }
};

exports.createWorkflowStage = async (req, res) => {
  try {
    const { code, label, reviewerRole, position, isActive = true } = req.body;

    if (!code || !label || !reviewerRole || !Number.isFinite(Number(position))) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: 'code, label, reviewerRole and numeric position are required',
      });
    }

    if (!WORKFLOW_STAGE_ROLES.includes(reviewerRole)) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_INPUT',
        message: `reviewerRole must be one of: ${WORKFLOW_STAGE_ROLES.join(', ')}`,
      });
    }

    const payload = {
      code: String(code).trim().toLowerCase(),
      label: String(label).trim(),
      reviewer_role: reviewerRole,
      position: Number(position),
      is_active: Boolean(isActive),
      updated_at: new Date().toISOString(),
    };

    const { data: stage, error } = await supabase
      .from('workflow_stages')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;
    return sendSuccess(res, {
      status: 201,
      message: 'Workflow stage created',
      data: { stage },
    });
  } catch (error) {
    console.error('Create workflow stage error:', error);
    return sendError(res, {
      status: 500,
      code: 'CREATE_WORKFLOW_STAGE_FAILED',
      message: 'Failed to create workflow stage',
    });
  }
};

exports.updateWorkflowStage = async (req, res) => {
  try {
    const { stageId } = req.params;
    const { label, reviewerRole, position, isActive } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (typeof label === 'string' && label.trim()) updates.label = label.trim();
    if (reviewerRole) {
      if (!WORKFLOW_STAGE_ROLES.includes(reviewerRole)) {
        return sendError(res, {
          status: 400,
          code: 'INVALID_INPUT',
          message: `reviewerRole must be one of: ${WORKFLOW_STAGE_ROLES.join(', ')}`,
        });
      }
      updates.reviewer_role = reviewerRole;
    }
    if (position !== undefined) {
      if (!Number.isFinite(Number(position))) {
        return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'position must be numeric' });
      }
      updates.position = Number(position);
    }
    if (isActive !== undefined) updates.is_active = Boolean(isActive);

    const { data: stage, error } = await supabase
      .from('workflow_stages')
      .update(updates)
      .eq('id', stageId)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!stage) {
      return sendError(res, { status: 404, code: 'WORKFLOW_STAGE_NOT_FOUND', message: 'Workflow stage not found' });
    }

    return sendSuccess(res, {
      message: 'Workflow stage updated',
      data: { stage },
    });
  } catch (error) {
    console.error('Update workflow stage error:', error);
    return sendError(res, {
      status: 500,
      code: 'UPDATE_WORKFLOW_STAGE_FAILED',
      message: 'Failed to update workflow stage',
    });
  }
};

exports.deleteWorkflowStage = async (req, res) => {
  try {
    const { stageId } = req.params;
    const { data: stage, error } = await supabase
      .from('workflow_stages')
      .delete()
      .eq('id', stageId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!stage) {
      return sendError(res, { status: 404, code: 'WORKFLOW_STAGE_NOT_FOUND', message: 'Workflow stage not found' });
    }

    return sendSuccess(res, { message: 'Workflow stage deleted', data: {} });
  } catch (error) {
    console.error('Delete workflow stage error:', error);
    return sendError(res, {
      status: 500,
      code: 'DELETE_WORKFLOW_STAGE_FAILED',
      message: 'Failed to delete workflow stage',
    });
  }
};

exports.validateWorkflowStages = async (req, res) => {
  try {
    const { data: stages, error } = await supabase
      .from('workflow_stages')
      .select('code, label, reviewer_role, position, is_active')
      .eq('is_active', true)
      .order('position', { ascending: true });

    if (error) throw error;

    const validation = validateWorkflowStages(stages || []);
    return sendSuccess(res, {
      data: {
        validation,
      },
    });
  } catch (error) {
    console.error('Validate workflow stages error:', error);
    return sendError(res, {
      status: 500,
      code: 'VALIDATE_WORKFLOW_STAGES_FAILED',
      message: 'Failed to validate workflow stages',
    });
  }
};
