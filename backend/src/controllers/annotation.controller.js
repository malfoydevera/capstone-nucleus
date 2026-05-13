/**
 * annotation.controller.js — F-002
 * Handles: get/add/delete paper annotations.
 */
const supabase = require('../config/supabase');
const { canAccessPaper } = require('../utils/fileAccess');
const { sendSuccess, sendError } = require('../utils/response');
const { buildFullName } = require('../utils/name');
const { notifyUser } = require('../utils/notify');

function clampPct(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}

function sanitizeHighlightRects(input) {
  if (!Array.isArray(input)) return null;
  const out = [];
  for (const r of input.slice(0, 80)) {
    if (!r || typeof r !== 'object') continue;
    const left = clampPct(Number(r.left));
    const top = clampPct(Number(r.top));
    const width = clampPct(Number(r.width));
    const height = clampPct(Number(r.height));
    if (left === null || top === null || width === null || height === null) continue;
    if (width <= 0 || height <= 0) continue;
    out.push({ left, top, width, height });
  }
  return out.length ? out : null;
}

function sanitizeAnchorPercent(input) {
  if (!input || typeof input !== 'object') return null;
  const x = clampPct(Number(input.x));
  const y = clampPct(Number(input.y));
  if (x === null || y === null) return null;
  return { x, y };
}

exports.getPaperAnnotations = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: paper, error: paperError } = await supabase
      .from('research_papers').select('id, status, author_id, faculty_id, dean_chair_id').eq('id', id).single();
    if (paperError || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    if (!canAccessPaper(req.user, paper)) return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' });

    const { data: annotations, error } = await supabase
      .from('research_comments')
      .select('id, comment, created_at, user_id, is_internal, parent_id, user:users!research_comments_user_id_fkey (first_name, middle_name, last_name, role)')
      .eq('research_id', id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const privilegedRoles = ['faculty', 'dean', 'program_chair', 'staff', 'admin'];
    const result = (annotations || [])
      .filter(item => !item.is_internal || privilegedRoles.includes(req.user.role))
      .map(item => {
        const commentText = String(item.comment || '');
        const metaStart = commentText.indexOf('[[meta]]');
        const metaEnd = commentText.indexOf('[[/meta]]');
        let metadata = {};
        let body = commentText;
        if (metaStart === 0 && metaEnd > 8) {
          try { metadata = JSON.parse(commentText.slice(8, metaEnd)); } catch { metadata = {}; }
          body = commentText.slice(metaEnd + 9).trim();
        }
        return {
          id: item.id, userId: item.user_id, note: body,
          parentId: item.parent_id || null,
          annotationType: metadata.annotationType || 'comment',
          highlightColor: metadata.highlightColor || null,
          pageNumber: metadata.pageNumber || null,
          sectionLabel: metadata.sectionLabel || null,
          selectedText: metadata.selectedText || null,
          highlightRects: sanitizeHighlightRects(metadata.highlightRects),
          anchorPercent: sanitizeAnchorPercent(metadata.anchorPercent),
          drawImageUrl: typeof metadata.drawImageUrl === 'string' ? metadata.drawImageUrl.slice(0, 2048) : null,
          createdAt: item.created_at,
          reviewerName: buildFullName(item.user) || 'Reviewer',
          reviewerRole: item.user?.role || null,
        };
      });
    return sendSuccess(res, { data: { annotations: result } });
  } catch (error) {
    console.error('Get paper annotations error:', error);
    return sendError(res, { status: 500, code: 'GET_ANNOTATIONS_FAILED', message: 'Failed to fetch annotations' });
  }
};

exports.addPaperAnnotation = async (req, res) => {
  try {
    const { id } = req.params;
    const { note, pageNumber, sectionLabel, selectedText, annotationType, highlightColor, parentId, highlightRects, anchorPercent, drawImageUrl } = req.body;
    const validTypes = ['draw', 'comment', 'note'];
    const type = validTypes.includes(annotationType) ? annotationType : 'comment';

    if (type === 'draw') {
      const pn = Number(pageNumber);
      if (!Number.isFinite(pn) || pn < 1) {
        return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Valid page number is required for drawings' });
      }
      const url = String(drawImageUrl || '').trim();
      if (!/^https?:\/\//i.test(url) || url.length > 2048) {
        return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'A valid drawImageUrl is required' });
      }
    } else if (!note || !String(note).trim()) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Annotation note is required' });
    }

    const { data: paper, error: paperError } = await supabase
      .from('research_papers').select('id, status, author_id, faculty_id, dean_chair_id').eq('id', id).single();
    if (paperError || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    if (!canAccessPaper(req.user, paper)) return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' });

    if (parentId) {
      const { data: parent, error: parentError } = await supabase
        .from('research_comments')
        .select('id')
        .eq('id', parentId)
        .eq('research_id', id)
        .maybeSingle();

      if (parentError) throw parentError;
      if (!parent) {
        return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Parent annotation not found for this paper' });
      }
    }

    const metadata = {
      annotationType: type,
      highlightColor: highlightColor || null,
      pageNumber: pageNumber || null,
      sectionLabel: sectionLabel || null,
      selectedText: selectedText || null,
      highlightRects: sanitizeHighlightRects(highlightRects),
      anchorPercent: sanitizeAnchorPercent(anchorPercent),
      drawImageUrl: type === 'draw' ? String(drawImageUrl || '').trim().slice(0, 2048) : null,
    };
    const noteText = note ? String(note).trim() : '';
    const payloadComment = `[[meta]]${JSON.stringify(metadata)}[[/meta]]\n${noteText}`;

    const { data, error } = await supabase
      .from('research_comments')
      .insert({ research_id: id, user_id: req.user.id, comment: payloadComment, is_internal: false, parent_id: parentId || null })
      .select('id, comment, created_at').single();
    if (error) throw error;

    const reviewerRoles = ['faculty', 'dean', 'program_chair', 'staff', 'admin'];
    if (
      !parentId
      && reviewerRoles.includes(req.user.role)
      && ['draw', 'note'].includes(type)
      && paper.author_id
      && paper.author_id !== req.user.id
    ) {
      const pg = metadata.pageNumber != null ? `page ${metadata.pageNumber}` : 'your document';
      await notifyUser({
        userId: paper.author_id,
        researchId: id,
        type: 'review',
        title: 'New reviewer feedback',
        message: type === 'draw'
          ? `A reviewer added a drawing on ${pg}. Open your paper to view it on the PDF.`
          : `A reviewer added a sticky note on ${pg}. Open your paper to view it on the PDF.`,
      });
    }

    return sendSuccess(res, {
      status: 201, message: 'Annotation added successfully',
      data: {
        annotation: {
          id: data.id,
          note: noteText,
          parentId: parentId || null,
          annotationType: type,
          highlightColor: metadata.highlightColor,
          pageNumber: metadata.pageNumber,
          sectionLabel: metadata.sectionLabel,
          selectedText: metadata.selectedText,
          highlightRects: metadata.highlightRects,
          anchorPercent: metadata.anchorPercent,
          drawImageUrl: metadata.drawImageUrl || null,
          createdAt: data.created_at,
        },
      },
    });
  } catch (error) {
    console.error('Add paper annotation error:', error);
    return sendError(res, { status: 500, code: 'ADD_ANNOTATION_FAILED', message: 'Failed to add annotation' });
  }
};

exports.deletePaperAnnotation = async (req, res) => {
  try {
    const { id, annotationId } = req.params;
    const { data: paper, error: paperError } = await supabase
      .from('research_papers').select('id, status, author_id, faculty_id, dean_chair_id').eq('id', id).single();
    if (paperError || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    if (!canAccessPaper(req.user, paper)) return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' });

    const { data: annotation, error: annoError } = await supabase
      .from('research_comments').select('id, user_id').eq('id', annotationId).eq('research_id', id).single();
    if (annoError || !annotation) return sendError(res, { status: 404, code: 'ANNOTATION_NOT_FOUND', message: 'Annotation not found' });
    if (annotation.user_id !== req.user.id && req.user.role !== 'admin') {
      return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'You can only delete your own annotations' });
    }

    const { error: deleteError } = await supabase.from('research_comments').delete().eq('id', annotationId);
    if (deleteError) throw deleteError;
    return sendSuccess(res, { message: 'Annotation deleted successfully' });
  } catch (error) {
    console.error('Delete paper annotation error:', error);
    return sendError(res, { status: 500, code: 'DELETE_ANNOTATION_FAILED', message: 'Failed to delete annotation' });
  }
};
