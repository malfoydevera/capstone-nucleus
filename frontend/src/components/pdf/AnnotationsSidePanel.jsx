import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  MessageSquare, StickyNote, Reply, X,
  Bold, Italic, Underline, List, Trash2, Loader2,
} from 'lucide-react';

const ANNOTATION_TYPES = {
  draw: { icon: StickyNote, label: 'Drawing', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  highlight: { icon: StickyNote, label: 'Highlight (legacy)', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  note: { icon: StickyNote, label: 'Note', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  comment: { icon: MessageSquare, label: 'Feedback', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
};

/**
 * Feedback / annotation side panel.
 *
 * Responsive behaviour:
 * - Below `xl` (1280px): renders as an off-canvas drawer with a dim backdrop.
 *   A floating tab on the right edge re-opens it when closed.
 * - `xl` and up: renders as an in-flow column inside its parent flex/grid.
 *   The parent (ReviewDetail) places it next to the main content so the
 *   layout never overflows the viewport. When closed at `xl`, a thin rail
 *   sticks to the right edge to reopen.
 *
 * The component avoids fixed-overlay-plus-manual-padding tricks; the parent
 * gives it real layout space, which is what was breaking the previous version.
 */
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
  embedded = false,
  drawerOnly = false,
}) => {
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [pageInput, setPageInput] = useState('');
  const [saving, setSaving] = useState(false);
  const editorRef = useRef(null);

  // Lock body scroll when drawer is open as an overlay.
  useEffect(() => {
    if (embedded || !isOpen) return undefined;
    const useOverlay = drawerOnly || !window.matchMedia('(min-width: 1280px)').matches;
    if (!useOverlay) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen, embedded, drawerOnly]);

  useEffect(() => {
    if (!isOpen || !onToggle) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onToggle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onToggle]);

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
    const trimmed = pageInput.trim();
    if (!trimmed) return null;
    const n = parseInt(trimmed, 10);
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

    if (Number.isNaN(pageNum)) {
      toast.error('Enter the PDF page number for this note.');
      return;
    }
    if (!body) {
      toast.error('Write your note in the feedback box.');
      return;
    }

    setSaving(true);
    try {
      await onAddAnnotation({
        annotationType: 'note',
        pageNumber: pageNum,
        selectedText: '',
        highlightColor: null,
        note: body,
      });
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

  // Collapsed: floating open control (drawer modes).
  if (!embedded && !isOpen) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={
          drawerOnly
            ? 'fixed bottom-5 right-4 z-30 inline-flex lg:hidden items-center gap-2 rounded-full bg-[#3674B5] px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#2d6299] transition-colors'
            : 'fixed right-0 top-24 z-30 inline-flex items-center gap-1.5 rounded-l-lg bg-[#3674B5] px-2 py-3 text-xs font-semibold text-white shadow-lg hover:bg-[#2d6299] transition-colors xl:top-32'
        }
        aria-label="Open author feedback drawer"
      >
        <StickyNote size={16} aria-hidden="true" />
        <span>{drawerOnly ? 'Author feedback' : 'Feedback'}</span>
        {rootAnnotations.length > 0 && (
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">
            {rootAnnotations.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      {!embedded && (
        <div
          onClick={onToggle}
          aria-hidden="true"
          className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm ${drawerOnly ? '' : 'xl:hidden'}`}
        />
      )}

      <aside
        aria-label="Author feedback drawer"
        className={embedded ? [
          'w-full rounded-xl border border-slate-200 bg-white flex flex-col overflow-hidden shadow-sm',
        ].join(' ') : drawerOnly ? [
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white border-l border-slate-200 shadow-2xl',
        ].join(' ') : [
          // Drawer (small / mid screens)
          'fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col bg-white border-l border-slate-200 shadow-2xl',
          // Inline column at xl+: switch from fixed to static, drop overlay chrome.
          'xl:static xl:z-auto xl:flex xl:w-[22rem] xl:max-w-none xl:shrink-0 xl:shadow-none xl:border-l xl:self-stretch',
          // Sticky behaviour on desktop so the panel stays in view as user scrolls the document.
          'xl:sticky xl:top-0 xl:h-[100dvh]',
        ].join(' ')}
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3674B5]/10 text-[#3674B5]">
              <StickyNote size={16} aria-hidden="true" />
            </span>
            <h3 className="text-sm font-bold text-slate-900">Author feedback</h3>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
              {rootAnnotations.length}
            </span>
          </div>
          {onToggle && !embedded && (
            <button
              type="button"
              onClick={onToggle}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              aria-label="Close author feedback drawer"
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {canEdit && onAddAnnotation && (
            <section className="border-b border-slate-100 p-4 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Add note for author
              </p>

              <div>
                <label htmlFor="annotation-page" className="mb-1 block text-xs font-medium text-slate-600">
                  Page in PDF
                </label>
                <input
                  id="annotation-page"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  placeholder="e.g. 3"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30 focus:border-[#3674B5]"
                />
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">Note</p>
                <div className="flex flex-wrap gap-0.5 rounded-t-lg border border-b-0 border-slate-200 bg-slate-50 px-1 py-1">
                  <button
                    type="button"
                    onClick={() => exec('bold')}
                    className="rounded p-1.5 text-slate-700 hover:bg-white transition-colors"
                    title="Bold"
                    aria-label="Bold"
                  >
                    <Bold size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => exec('italic')}
                    className="rounded p-1.5 text-slate-700 hover:bg-white transition-colors"
                    title="Italic"
                    aria-label="Italic"
                  >
                    <Italic size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => exec('underline')}
                    className="rounded p-1.5 text-slate-700 hover:bg-white transition-colors"
                    title="Underline"
                    aria-label="Underline"
                  >
                    <Underline size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => exec('insertUnorderedList')}
                    className="rounded p-1.5 text-slate-700 hover:bg-white transition-colors"
                    title="Bullets"
                    aria-label="Bullet list"
                  >
                    <List size={14} />
                  </button>
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="min-h-[110px] rounded-b-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#3674B5]/30 focus:border-[#3674B5]"
                  data-placeholder="Type a note for the author…"
                />
              </div>

              <button
                type="button"
                onClick={handleSubmitNew}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#3674B5] py-2.5 text-sm font-semibold text-white hover:bg-[#2d6299] disabled:opacity-60 transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Save note
              </button>
            </section>
          )}

          <section className="p-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Thread</p>

            {rootAnnotations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-10 text-center text-sm text-slate-400">
                <StickyNote size={28} className="mx-auto mb-2 opacity-40" aria-hidden="true" />
                No notes yet.
              </div>
            ) : (
              <div className="space-y-3">
                {rootAnnotations.map((annotation) => {
                  const config = ANNOTATION_TYPES[annotation.annotationType] || ANNOTATION_TYPES.note;
                  const Icon = config.icon;
                  const replies = annotations
                    .filter((item) => item.parentId === annotation.id)
                    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

                  return (
                    <div key={annotation.id} className={`rounded-lg border ${config.border} ${config.bg} p-3`}>
                      <div className="flex items-start gap-2">
                        <Icon size={14} className={`${config.color} mt-0.5 flex-shrink-0`} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-bold text-slate-900 truncate">
                              {annotation.reviewerName}
                            </span>
                            {annotation.pageNumber != null && (
                              <span className="text-slate-500">· Page {annotation.pageNumber}</span>
                            )}
                          </div>
                          {(annotation.annotationType === 'draw' || annotation.drawImageUrl) && annotation.drawImageUrl && (
                            <div className="mb-2">
                              <img
                                src={annotation.drawImageUrl}
                                alt="Saved page with reviewer markup"
                                className="max-h-48 w-full rounded border border-slate-300 object-contain bg-white shadow-sm"
                              />
                            </div>
                          )}
                          {annotation.note?.trim() ? (
                            <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{annotation.note}</p>
                          ) : null}
                        </div>
                        {canDelete(annotation) && (
                          <button
                            type="button"
                            onClick={() => onDelete(annotation.id)}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete"
                            aria-label="Delete annotation"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      {replies.length > 0 && (
                        <div className="mt-2 space-y-2 border-l-2 border-slate-200 pl-3">
                          {replies.map((reply) => (
                            <div key={reply.id} className="rounded-md border border-slate-200 bg-white/90 p-2">
                              <p className="mb-0.5 text-xs font-semibold text-slate-600 truncate">
                                {reply.reviewerName}
                              </p>
                              <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{reply.note}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {canEdit && replyingToId === annotation.id && (
                        <div className="mt-2 space-y-2">
                          <textarea
                            // eslint-disable-next-line jsx-a11y/no-autofocus
                            autoFocus
                            rows={2}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Reply…"
                            className="w-full resize-none rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30 focus:border-[#3674B5]"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSubmitReply(annotation)}
                              disabled={!replyText.trim()}
                              className="rounded-lg bg-[#3674B5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2d6299] disabled:opacity-50 transition-colors"
                            >
                              Post
                            </button>
                            <button
                              type="button"
                              onClick={() => { setReplyingToId(null); setReplyText(''); }}
                              className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300 transition-colors"
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
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#3674B5] hover:text-[#2d6299] transition-colors"
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
          </section>
        </div>
      </aside>
    </>
  );
};

export default AnnotationsSidePanel;
