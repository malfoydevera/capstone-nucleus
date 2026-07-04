/**
 * admin.controller.js — F-002
 * Handles: admin-only CRUD, publish/unpublish, and staff/admin listing.
 */
const supabase = require('../config/supabase');
const { resolvePaperFileUrl } = require('../utils/fileAccess');
const { sendSuccess, sendError } = require('../utils/response');
const { attachFullName, buildFullName } = require('../utils/name');
const { logAuditEvent } = require('../utils/audit');
const { validateWorkflowStages } = require('../utils/workflowEngine');
const { notifyUser, notifyCoAuthors } = require('../utils/notify');
const { invalidateBrowseCaches } = require('../utils/cache');
const { parseListPagination } = require('../utils/pagination');

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

/** Fields admins may PATCH via PUT /research/admin/:id (status changes use dedicated endpoints). */
const ADMIN_UPDATE_ALLOWED_KEYS = new Set([
  'title',
  'abstract',
  'keywords',
  'category',
  'doi',
  'citation_key',
  'external_author_notes',
  'department_id',
  'program_id',
]);

function pickAdminUpdatePayload(body) {
  if (!body || typeof body !== 'object') return {};
  const out = {};
  for (const key of Object.keys(body)) {
    if (ADMIN_UPDATE_ALLOWED_KEYS.has(key)) out[key] = body[key];
  }
  return out;
}

/** Loose DOI check: optional https://doi.org/ prefix, then common DOI patterns */
function normalizeDoiInput(raw) {
  if (raw === undefined || raw === null) return '';
  let s = String(raw).trim();
  if (!s) return '';
  s = s.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  return s.trim();
}

function isValidDoiFormat(doi) {
  if (!doi || doi.length > 512) return false;
  // Typical Crossref-style DOI
  if (/^10\.\d{4,9}\/\S+$/i.test(doi)) return true;
  return false;
}

function csvEscape(value) {
  const raw = value == null ? '' : String(value);
  if (raw.includes('"') || raw.includes(',') || raw.includes('\n') || raw.includes('\r')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function toCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  rows.forEach((row) => lines.push(row.map(csvEscape).join(',')));
  return `${lines.join('\n')}\n`;
}

async function auditCsvExport(req, action, details = {}) {
  await logAuditEvent({
    userId: req.user?.id,
    userRole: req.user?.role,
    userName: req.user?.fullName,
    action,
    targetType: 'system',
    details,
    ipAddress: req.ip || null,
  });
}

exports.getAllResearch = async (req, res) => {
  try {
    const { status, includeDeleted } = req.query;
    const { page, limit, from, to } = parseListPagination(req.query);
    let query = supabase.from('research_papers')
      .select(`
        *,
        author:users!author_id (id, first_name, middle_name, last_name, email),
        research_authors!research_authors_research_id_fkey (
          user_id, is_primary, author_order,
          author:users!research_authors_user_id_fkey (id, first_name, middle_name, last_name, email)
        )
      `, { count: 'exact' })
      .order('submission_date', { ascending: false })
      .range(from, to);
    if (status) query = query.eq('status', status);
    if (includeDeleted !== 'true') query = query.is('deleted_at', null);
    const { data: papers, error, count } = await query;
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
    return sendSuccess(res, { data: { papers: transformed, total: count ?? transformed.length, page, limit } });
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
    const payload = pickAdminUpdatePayload(req.body);
    if (Object.keys(payload).length === 0) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'No allowed fields to update' });
    }
    if (payload.doi !== undefined && payload.doi !== null && String(payload.doi).trim()) {
      const nd = normalizeDoiInput(payload.doi);
      if (!isValidDoiFormat(nd)) {
        return sendError(res, { status: 400, code: 'INVALID_DOI', message: 'Invalid DOI format' });
      }
      payload.doi = nd;
    }
    const { data: updatedPaper, error } = await supabase
      .from('research_papers')
      .update(payload)
      .eq('id', id)
      .select('*, author:users!author_id (id, first_name, middle_name, last_name, email)')
      .single();
    if (error) throw error;
    if (!updatedPaper) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    }
    return sendSuccess(res, {
      message: 'Research updated successfully',
      data: { paper: { ...updatedPaper, users: attachFullName(updatedPaper.author) } },
    });
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
    const doiRaw = req.body?.doi;
    const doiNormalized = normalizeDoiInput(doiRaw);

    const { data: existing, error: fetchError } = await supabase
      .from('research_papers')
      .select('id, status, title, author_id, doi')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    }

    const nowIso = new Date().toISOString();

    // Already published: allow DOI / citation metadata updates only
    if (existing.status === 'published') {
      if (!doiNormalized || !isValidDoiFormat(doiNormalized)) {
        return sendError(res, {
          status: 400,
          code: 'INVALID_DOI',
          message: 'A valid DOI is required to update a published record',
        });
      }
      const { data: updated, error: updErr } = await supabase
        .from('research_papers')
        .update({ doi: doiNormalized, updated_at: nowIso })
        .eq('id', id)
        .select('*, author:users!author_id (id, first_name, middle_name, last_name, email)')
        .single();
      if (updErr) throw updErr;
      return sendSuccess(res, { data: { paper: { ...updated, users: attachFullName(updated.author) } } });
    }

    if (existing.status !== 'approved') {
      return sendError(res, {
        status: 400,
        code: 'INVALID_WORKFLOW_TRANSITION',
        message: `Only approved research can be marked published (current status: ${existing.status})`,
      });
    }

    if (!doiNormalized || !isValidDoiFormat(doiNormalized)) {
      return sendError(res, {
        status: 400,
        code: 'INVALID_DOI',
        message: 'A valid DOI is required to publish',
      });
    }

    const { data: publishedPaper, error } = await supabase
      .from('research_papers')
      .update({
        status: 'published',
        published_date: nowIso,
        doi: doiNormalized,
        updated_at: nowIso,
      })
      .eq('id', id)
      .select('*, author:users!author_id (id, first_name, middle_name, last_name, email)')
      .single();
    if (error) throw error;

    await notifyUser({
      userId: publishedPaper.author_id,
      researchId: id,
      type: 'publication',
      title: 'Research Published',
      message: `Congratulations! Your research "${publishedPaper.title}" is now published (DOI: ${doiNormalized}).`,
      senderUserId: req.user?.id || null,
    });

    try {
      await notifyCoAuthors({
        researchId: id,
        type: 'publication',
        title: 'Co-authored Paper Published',
        message: `The paper "${publishedPaper.title}" you co-authored is now published (DOI: ${doiNormalized}).`,
        senderUserId: req.user?.id || null,
        alreadyNotifiedIds: [publishedPaper.author_id],
      });
    } catch (coAuthorErr) {
      console.error('[adminPublishResearch] co-author notification failed:', coAuthorErr.message);
    }

    return sendSuccess(res, { data: { paper: { ...publishedPaper, users: attachFullName(publishedPaper.author) } } });
  } catch (error) {
    console.error('Publish error:', error);
    return sendError(res, { status: 500, code: 'ADMIN_PUBLISH_RESEARCH_FAILED', message: 'Failed to publish research' });
  } finally {
    invalidateBrowseCaches();
  }
};

exports.adminUnpublishResearch = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: unpublishedPaper, error } = await supabase.from('research_papers')
      .update({ status: 'approved', published_date: null, doi: null })
      .eq('id', id).select('*, author:users!author_id (id, first_name, middle_name, last_name, email)').single();
    if (error) throw error;
    return sendSuccess(res, { data: { paper: { ...unpublishedPaper, users: attachFullName(unpublishedPaper.author) } } });
  } catch (error) {
    console.error('Unpublish error:', error);
    return sendError(res, { status: 500, code: 'ADMIN_UNPUBLISH_RESEARCH_FAILED', message: 'Failed to unpublish research' });
  } finally {
    invalidateBrowseCaches();
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

exports.exportStudentsCsv = async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, first_name, middle_name, last_name, program, department, is_active, created_at')
      .eq('role', 'student')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const headers = ['id', 'email', 'full_name', 'program', 'department', 'is_active', 'created_at'];
    const rows = (users || []).map((user) => [
      user.id,
      user.email,
      buildFullName(user),
      user.program || '',
      user.department || '',
      user.is_active !== false ? 'active' : 'inactive',
      user.created_at || '',
    ]);

    await auditCsvExport(req, 'export_students_csv', { rowCount: rows.length });

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="nucleus_students_${stamp}.csv"`);
    return res.status(200).send(toCsv(headers, rows));
  } catch (error) {
    console.error('Export students CSV error:', error);
    return sendError(res, {
      status: 500,
      code: 'EXPORT_STUDENTS_CSV_FAILED',
      message: 'Failed to export students',
    });
  }
};

exports.exportPapersCsv = async (req, res) => {
  try {
    const { status, includeDeleted } = req.query;
    let query = supabase
      .from('research_papers')
      .select(`
        id, title, status, category, author_id, submission_date, published_date, created_at, deleted_at,
        author:users!author_id (first_name, middle_name, last_name, email)
      `)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (includeDeleted !== 'true') query = query.is('deleted_at', null);

    const { data: papers, error } = await query;
    if (error) throw error;

    const headers = [
      'id', 'title', 'status', 'category', 'author_name', 'author_email',
      'submission_date', 'published_date', 'created_at',
    ];
    const rows = (papers || []).map((paper) => [
      paper.id,
      paper.title || '',
      paper.status || '',
      paper.category || '',
      buildFullName(paper.author),
      paper.author?.email || '',
      paper.submission_date || '',
      paper.published_date || '',
      paper.created_at || '',
    ]);

    await auditCsvExport(req, 'export_papers_csv', {
      rowCount: rows.length,
      status: status || null,
      includeDeleted: includeDeleted === 'true',
    });

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="nucleus_papers_${stamp}.csv"`);
    return res.status(200).send(toCsv(headers, rows));
  } catch (error) {
    console.error('Export papers CSV error:', error);
    return sendError(res, {
      status: 500,
      code: 'EXPORT_PAPERS_CSV_FAILED',
      message: 'Failed to export papers',
    });
  }
};
