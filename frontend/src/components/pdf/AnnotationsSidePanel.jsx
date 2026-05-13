import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  MessageSquare, Highlighter, StickyNote, ChevronRight, Reply, X,
  Bold, Italic, Underline, List, Trash2, Loader2, Pencil,
} from 'lucide-react';
import SidebarPdfDrawPreview from './SidebarPdfDrawPreview';

const HL_SWATCH = {
  yellow: { dot: 'bg-yellow-300', ring: 'ring-yellow-500' },
  red: { dot: 'bg-red-300', ring: 'ring-red-500' },
  blue: { dot: 'bg-blue-300', ring: 'ring-blue-500' },
  green: { dot: 'bg-green-300', ring: 'ring-green-500' },
};

const AnnotationsSidePanel = ({
  annotations = [],
  onReply,
  onDelete,
  onAddAnnotation,
  canEdit = false,
  isOpen = true,
  onToggle,
  currentUserId = null,
  userRole = null,
  pdfFileUrl = null,
  pdfPageNumber = 1,
  pdfNumPages = null,
  onPdfPageChange,
  onSaveDrawing,
}) => {
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [formTab, setFormTab] = useState('draw');
  const [pageInput, setPageInput] = useState('');
  const [saving, setSaving] = useState(false);
  const editorRef = useRef(null);

  const rootAnnotations = annotations.filter((a) => !a.parentId);

  const exec = (command) => {
    editorRef.current?.focus();
    try {
      document.execCommand(command, false);
    } catch {
      /* ignore */
    }
  };

  const parsePage = () => {
    const t = pageInput.trim();
    if (!t) return null;
    const n = parseInt(t, 10);
    return Number.isFinite(n) && n >= 1 ? n : NaN;
  };

  const resetForm = () => {
    setPageInput('');
    if (editorRef.current) editorRef.current.innerHTML = '';
  };

  const handleSubmitNew = async () => {
    if (!onAddAnnotation || !canEdit) return;
    const pageNum = parsePage();
    const body = editorRef.current?.innerText?.trim() || '';

    if (formTab === 'note') {
      if (Number.isNaN(pageNum)) {
        toast.error('Enter the PDF page number for this note.');
        return;
      }
      if (!body) {
        toast.error('Write your note in the feedback box.');
        return;
      }
    } else {
      if (!body) {
        toast.error('Write your feedback.');
        return;
      }
    }

    setSaving(true);
    try {
      if (formTab === 'note') {
        await onAddAnnotation({
          annotationType: 'note',
          pageNumber: pageNum,
          selectedText: '',
          highlightColor: null,
          note: body,
        });
      } else {
        await onAddAnnotation({
          annotationType: 'comment',
          pageNumber: Number.isFinite(pageNum) ? pageNum : null,
          selectedText: '',
          highlightColor: null,
          note: body,
        });
      }
      resetForm();
    } catch {
      /* parent shows API error */
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReply = async (annotation) => {
    if (!replyText.trim() || !onReply) return;
    try {
      await onReply(annotation, replyText.trim());
      setReplyText('');
      setReplyingToId(null);
    } catch {
      /* parent toasts errors */
    }
  };

  const canDelete = (annotation) =>
    onDelete && (annotation.userId === currentUserId || userRole === 'admin');

  const ANNOTATION_TYPES = {
    draw: { icon: Pencil, label: 'Drawing', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    highlight: { icon: Highlighter, label: 'Highlight (legacy)', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
    note: { icon: StickyNote, label: 'Note', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    comment: { icon: MessageSquare, label: 'Feedback', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="fixed right-0 top-1/2 z-40 -translate-y-1/2 rounded-l-lg bg-indigo-600 px-2 py-4 text-white shadow-lg hover:bg-indigo-700"
      >
        <ChevronRight size={20} className="rotate-180" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 top-0 z-40 flex w-[min(100%,24rem)] flex-col border-l border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-indigo-600" />
          <h3 className="font-bold text-slate-900">Feedback</h3>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
            {rootAnnotations.length}
          </span>
        </div>
        {onToggle && (
          <button type="button" onClick={onToggle} className="rounded-lg p-1 text-slate-600 hover:bg-slate-200">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {canEdit && onAddAnnotation && (
          <div className="border-b border-slate-200 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Add for author</p>
            <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1">
              {[
                { id: 'draw', label: 'Draw', Icon: Pencil },
                { id: 'note', label: 'Note', Icon: StickyNote },
                { id: 'feedback', label: 'Written', Icon: MessageSquare },
              ].map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFormTab(id)}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                    formTab === id ? 'bg-white text-indigo-700 shadow' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>

            {formTab === 'draw' && (
              <div className="space-y-3">
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/90 p-3 text-sm text-slate-700">
                  <p className="mb-1 font-semibold text-indigo-900">Draw on this duplicate page</p>
                  <p>
                    The main document preview stays untouched. Sketch below on a copy of the same page; <strong>Save markup</strong> sends it to the author as an overlay on that page number.
                  </p>
                </div>
                {pdfFileUrl && typeof onSaveDrawing === 'function' && typeof onPdfPageChange === 'function' ? (
                  <SidebarPdfDrawPreview
                    fileUrl={pdfFileUrl}
                    pageNumber={pdfPageNumber}
                    numPages={pdfNumPages}
                    onPageChange={onPdfPageChange}
                    onSaveDrawing={onSaveDrawing}
                  />
                ) : (
                  <p className="text-xs text-amber-800">PDF URL missing — cannot load markup preview.</p>
                )}
              </div>
            )}

            {formTab === 'note' && (
              <label className="mb-2 block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Page in PDF</span>
                <input
                  type="number"
                  min={1}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  placeholder="e.g. 3"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            )}

            {formTab === 'feedback' && (
              <label className="mb-2 block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Page (optional)</span>
                <input
                  type="number"
                  min={1}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  placeholder="Leave blank for general comments"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            )}

            {formTab !== 'draw' && (
              <>
                <p className="mb-1 text-xs font-medium text-slate-600">Feedback</p>
                <div className="mb-1 flex flex-wrap gap-0.5 rounded-t-lg border border-b-0 border-slate-200 bg-slate-50 px-1 py-1">
                  <button type="button" onClick={() => exec('bold')} className="rounded p-1.5 text-slate-700 hover:bg-white" title="Bold">
                    <Bold size={16} />
                  </button>
                  <button type="button" onClick={() => exec('italic')} className="rounded p-1.5 text-slate-700 hover:bg-white" title="Italic">
                    <Italic size={16} />
                  </button>
                  <button type="button" onClick={() => exec('underline')} className="rounded p-1.5 text-slate-700 hover:bg-white" title="Underline">
                    <Underline size={16} />
                  </button>
                  <button type="button" onClick={() => exec('insertUnorderedList')} className="rounded p-1.5 text-slate-700 hover:bg-white" title="Bullets">
                    <List size={16} />
                  </button>
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="min-h-[120px] rounded-b-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300"
                  data-placeholder="Type feedback for the author…"
                />

                <button
                  type="button"
                  onClick={handleSubmitNew}
                  disabled={saving}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                  Save to author
                </button>
              </>
            )}
          </div>
        )}

        <div className="p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Thread</p>
          {rootAnnotations.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              <MessageSquare size={36} className="mx-auto mb-2 opacity-40" />
              No entries yet.
            </div>
          ) : (
            <div className="space-y-3">
              {rootAnnotations.map((annotation) => {
                const config = ANNOTATION_TYPES[annotation.annotationType] || ANNOTATION_TYPES.comment;
                const Icon = config.icon;
                const replies = annotations
                  .filter((item) => item.parentId === annotation.id)
                  .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

                return (
                  <div key={annotation.id} className={`rounded-lg border ${config.border} ${config.bg} p-3`}>
                    <div className="flex items-start gap-2">
                      <Icon size={14} className={`${config.color} mt-0.5 flex-shrink-0`} />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-bold text-slate-900">{annotation.reviewerName}</span>
                          {annotation.pageNumber != null && (
                            <span className="text-slate-500">• Page {annotation.pageNumber}</span>
                          )}
                        </div>
                        {annotation.annotationType === 'highlight' && annotation.highlightColor && HL_SWATCH[annotation.highlightColor] && (
                          <span className={`mb-1 inline-block h-2.5 w-2.5 rounded-full ${HL_SWATCH[annotation.highlightColor].dot}`} />
                        )}
                        {(annotation.annotationType === 'draw' || annotation.drawImageUrl) && annotation.drawImageUrl && (
                          <div className="mb-2">
                            <img
                              src={annotation.drawImageUrl}
                              alt="Saved page with reviewer markup"
                              className="max-h-48 w-full rounded border border-slate-300 object-contain bg-white shadow-sm"
                            />
                            <p className="mt-1 text-[10px] text-slate-500">Snapshot of this PDF page including your markup.</p>
                          </div>
                        )}
                        {annotation.selectedText && (
                          <p className="mb-1 rounded border border-slate-200 bg-white/70 p-2 text-xs italic text-slate-600">
                            &ldquo;{annotation.selectedText}&rdquo;
                          </p>
                        )}
                        {annotation.note?.trim() ? (
                          <p className="whitespace-pre-wrap text-sm text-slate-800">{annotation.note}</p>
                        ) : null}
                      </div>
                      {canDelete(annotation) && (
                        <button
                          type="button"
                          onClick={() => onDelete(annotation.id)}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {replies.length > 0 && (
                      <div className="mt-2 space-y-2 border-l-2 border-slate-200 pl-3">
                        {replies.map((reply) => (
                          <div key={reply.id} className="rounded-md border border-slate-200 bg-white/90 p-2">
                            <p className="mb-0.5 text-xs font-semibold text-slate-600">{reply.reviewerName}</p>
                            <p className="whitespace-pre-wrap text-sm text-slate-700">{reply.note}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {canEdit && replyingToId === annotation.id && (
                      <div className="mt-2 space-y-2">
                        <textarea
                          autoFocus
                          rows={2}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Reply…"
                          className="w-full resize-none rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSubmitReply(annotation)}
                            disabled={!replyText.trim()}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Post
                          </button>
                          <button
                            type="button"
                            onClick={() => { setReplyingToId(null); setReplyText(''); }}
                            className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {canEdit && replyingToId !== annotation.id && (
                      <button
                        type="button"
                        onClick={() => setReplyingToId(annotation.id)}
                        className="mt-2 flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        <Reply size={12} />
                        Reply
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnnotationsSidePanel;
