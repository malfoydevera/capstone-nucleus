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
const WORKFLOW_STAGE_MUTATION_MESSAGE = 'Workflow stages are fixed and cannot be modified through the admin UI.';

const normalizeResearchAuthors = (researchAuthors = []) =>
  [...(researchAuthors || [])]
    .sort((left, right) => {
      const leftOrder = Number.isFinite(left?.author_order) ? left.author_order : Number.MAX_SAFE_INTEGER;
      const rightOrder = Number.isFinite(right?.author_order) ? right.author_order : Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    })
    .map((entry) => ({
      ...entry,
      author: attachFullName(entry.author),
    }));

const normalizeExternalAuthorNotes = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
};

exports.getAllResearch = async (req, res) => {
  try {
    const { status, includeDeleted } = req.query;
    let query = supabase.from('research_papers')
      .select(`
        *,
        author:users!author_id (id, first_name, middle_name, last_name, email),
        research_authors!research_authors_research_id_fkey (
          user_id, is_primary, author_order,
          author:users!research_authors_user_id_fkey (id, first_name, middle_name, last_name, email)
        )
      `)
      .order('submission_date', { ascending: false });
    if (status) query = query.eq('status', status);
    if (includeDeleted !== 'true') query = query.is('deleted_at', null);
    const { data: papers, error } = await query;
    if (error) throw error;
    const transformed = await Promise.all((papers || []).map(async (paper) => {
      const structuredAuthors = normalizeResearchAuthors(paper.research_authors);

      return {
        ...paper,
        users: attachFullName(paper.author),
        structured_authors: structuredAuthors,
        external_author_notes: normalizeExternalAuthorNotes(paper.external_author_notes),
        file_url: await resolvePaperFileUrl(paper),
      };
    }));
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
      .update({ status: 'published', published_date: new Date().toISOString() })
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
      .update({ status: 'approved', published_date: null })
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
  return sendError(res, {
    status: 409,
    code: 'WORKFLOW_STAGE_MUTATIONS_DISABLED',
    message: WORKFLOW_STAGE_MUTATION_MESSAGE,
  });
};

exports.updateWorkflowStage = async (req, res) => {
  return sendError(res, {
    status: 409,
    code: 'WORKFLOW_STAGE_MUTATIONS_DISABLED',
    message: WORKFLOW_STAGE_MUTATION_MESSAGE,
  });
};

exports.deleteWorkflowStage = async (req, res) => {
  return sendError(res, {
    status: 409,
    code: 'WORKFLOW_STAGE_MUTATIONS_DISABLED',
    message: WORKFLOW_STAGE_MUTATION_MESSAGE,
  });
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
