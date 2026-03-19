/**
 * annotation.controller.js — F-002
 * Handles: get/add/delete paper annotations.
 */
const supabase = require('../config/supabase');
const { canAccessPaper } = require('../utils/fileAccess');
const { sendSuccess, sendError } = require('../utils/response');

exports.getPaperAnnotations = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: paper, error: paperError } = await supabase
      .from('research_papers').select('id, status, author_id, faculty_id, dean_chair_id').eq('id', id).single();
    if (paperError || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    if (!canAccessPaper(req.user, paper)) return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' });

    const { data: annotations, error } = await supabase
      .from('research_comments')
      .select('id, comment, created_at, user_id, is_internal, user:users!research_comments_user_id_fkey (full_name, role)')
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
          annotationType: metadata.annotationType || 'comment',
          highlightColor: metadata.highlightColor || null,
          pageNumber: metadata.pageNumber || null,
          sectionLabel: metadata.sectionLabel || null,
          selectedText: metadata.selectedText || null,
          createdAt: item.created_at,
          reviewerName: item.user?.full_name || 'Reviewer',
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
    const { note, pageNumber, sectionLabel, selectedText, annotationType, highlightColor } = req.body;
    const validTypes = ['highlight', 'comment', 'note'];
    const type = validTypes.includes(annotationType) ? annotationType : 'comment';

    if (type !== 'highlight' && (!note || !String(note).trim())) {
      return sendError(res, { status: 400, code: 'INVALID_INPUT', message: 'Annotation note is required' });
    }

    const { data: paper, error: paperError } = await supabase
      .from('research_papers').select('id, status, author_id, faculty_id, dean_chair_id').eq('id', id).single();
    if (paperError || !paper) return sendError(res, { status: 404, code: 'PAPER_NOT_FOUND', message: 'Research paper not found' });
    if (!canAccessPaper(req.user, paper)) return sendError(res, { status: 403, code: 'ACCESS_DENIED', message: 'Access denied' });

    const metadata = { annotationType: type, highlightColor: highlightColor || null, pageNumber: pageNumber || null, sectionLabel: sectionLabel || null, selectedText: selectedText || null };
    const noteText = note ? String(note).trim() : '';
    const payloadComment = `[[meta]]${JSON.stringify(metadata)}[[/meta]]\n${noteText}`;

    const { data, error } = await supabase
      .from('research_comments')
      .insert({ research_id: id, user_id: req.user.id, comment: payloadComment, is_internal: false })
      .select('id, comment, created_at').single();
    if (error) throw error;

    return sendSuccess(res, {
      status: 201, message: 'Annotation added successfully',
      data: { annotation: { id: data.id, note: noteText, annotationType: type, highlightColor: metadata.highlightColor, pageNumber: metadata.pageNumber, sectionLabel: metadata.sectionLabel, selectedText: metadata.selectedText, createdAt: data.created_at } },
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
