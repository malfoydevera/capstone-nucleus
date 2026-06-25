import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Clock, AlertCircle, MessageSquare,
  Highlighter, StickyNote, ExternalLink, Loader2, Upload,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { researchAPI, unwrapApiData } from '../../utils/api';
import { formatFullName } from '../../utils/names';
import { getStudentStatusLabel, getStudentStatusTone } from '../../utils/studentStatus';

const STATUS_HINTS = {
  revision_required: 'Your reviewers asked for changes. Review the notes below and submit a revised file from Submit Research.',
  rejected: 'This submission was not accepted. See the workflow history for the reason.',
  pending_faculty: 'Your adviser is reviewing your paper.',
  pending_editor: 'Your paper is with the research editor.',
  pending_admin: 'Final administrative review before publication.',
  approved: 'Your work has been approved and is available in the repository.',
};

const ANNOTATION_ICONS = {
  highlight: Highlighter,
  note: StickyNote,
  comment: MessageSquare,
};

const SubmissionUpdates = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [paper, setPaper] = useState(null);
  const [workflowHistory, setWorkflowHistory] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAuthorOrCoAuthor = useMemo(() => {
    if (!user || !paper) return false;
    if (paper.users?.id === user.id || paper.author_id === user.id) return true;
    const list = Array.isArray(paper.structured_authors) ? paper.structured_authors : [];
    return list.some(
      (entry) =>
        entry?.user_id === user.id ||
        entry?.author_id === user.id ||
        entry?.author?.id === user.id
    );
  }, [user, paper]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [paperRes, annoRes] = await Promise.all([
          researchAPI.getResearchById(id),
          researchAPI.getAnnotations(id),
        ]);
        if (cancelled) return;
        const payload = unwrapApiData(paperRes);
        setPaper(payload.paper || null);
        setWorkflowHistory(payload.workflowHistory || []);
        setAnnotations(unwrapApiData(annoRes).annotations || []);
      } catch (e) {
        if (!cancelled) {
          setError(e?.response?.data?.message || e?.message || 'Could not load this submission.');
          setPaper(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id]);

  const rootAnnotations = useMemo(
    () => annotations.filter((a) => !a.parentId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [annotations]
  );

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-amber-500" />
        <h1 className="text-xl font-bold text-slate-900">Unable to load submission</h1>
        <p className="mt-2 text-slate-600">{error || 'Paper not found.'}</p>
        <button
          type="button"
          onClick={() => navigate('/student/my-research')}
          className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Back to My Research
        </button>
      </div>
    );
  }

  if (user?.role === 'student' && !isAuthorOrCoAuthor) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900">Access denied</h1>
        <p className="mt-2 text-slate-600">You can only open submissions you authored or co-authored.</p>
        <button
          type="button"
          onClick={() => navigate('/student/my-research')}
          className="mt-6 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back to My Research
        </button>
      </div>
    );
  }

  const status = paper.status;
  const hint = STATUS_HINTS[status] || 'Track progress below. Reviewer notes appear in the feedback section when your reviewers add them.';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-16">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <button
          type="button"
          onClick={() => navigate('/student/my-research')}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-700"
        >
          <ArrowLeft size={16} />
          My research
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-slate-900">{paper.title || 'Untitled'}</h1>
              <p className="mt-1 text-sm text-slate-500">
                Primary author: {formatFullName(paper.users) || '—'}
              </p>
            </div>
            <span className={`inline-flex shrink-0 items-center rounded-full border px-4 py-1.5 text-sm font-bold ${getStudentStatusTone(status)}`}>
              {getStudentStatusLabel(status)}
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">{hint}</p>

          {status === 'revision_required' && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => navigate('/student/submit', { state: { resubmit: paper } })}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
              >
                <Upload size={16} />
                Upload revision
              </button>
            </div>
          )}

          {(paper.revision_notes || paper.rejection_reason) && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Latest official message</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                {paper.revision_notes || paper.rejection_reason}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={`/research/${id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              <ExternalLink size={16} />
              Open full paper view
            </Link>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900">
            <MessageSquare size={20} className="text-indigo-600" />
            Reviewer feedback & annotations
          </h2>
          <p className="mb-4 text-sm text-slate-600">
            Drawings, notes, and written comments your reviewers saved for you (newest first).
          </p>
          {rootAnnotations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-500">
              No reviewer annotations yet. Check back after your adviser or editor adds feedback.
            </div>
          ) : (
            <ul className="space-y-4">
              {rootAnnotations.map((item) => {
                const Icon = ANNOTATION_ICONS[item.annotationType] || MessageSquare;
                const replies = annotations
                  .filter((r) => r.parentId === item.id)
                  .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                return (
                  <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 rounded-lg bg-indigo-50 p-2 text-indigo-700">
                        <Icon size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-bold text-slate-800">{item.reviewerName}</span>
                          {item.pageNumber != null && <span>• Page {item.pageNumber}</span>}
                          <span>• {item.annotationType}</span>
                          {item.createdAt && (
                            <span>• {new Date(item.createdAt).toLocaleString()}</span>
                          )}
                        </div>
                        {item.selectedText ? (
                          <p className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-2 text-sm italic text-slate-700">
                            &ldquo;{item.selectedText}&rdquo;
                          </p>
                        ) : null}
                        {item.note ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{item.note}</p>
                        ) : null}
                        {replies.length > 0 && (
                          <ul className="mt-3 space-y-2 border-l-2 border-indigo-100 pl-3">
                            {replies.map((r) => (
                              <li key={r.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                                <span className="text-xs font-semibold text-slate-600">{r.reviewerName}</span>
                                <p className="mt-1 whitespace-pre-wrap text-slate-800">{r.note}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900">
            <Clock size={20} className="text-indigo-600" />
            Workflow status history
          </h2>
          {workflowHistory.length === 0 ? (
            <p className="text-sm text-slate-500">No workflow events recorded yet.</p>
          ) : (
            <ol className="space-y-4">
              {workflowHistory.map((entry, idx) => (
                <li key={entry.id || `wf-${idx}`} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {entry.reviewed_at || entry.created_at
                        ? new Date(entry.reviewed_at || entry.created_at).toLocaleString()
                        : ''}
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {(entry.action_type || 'update').replace(/_/g, ' ')}
                      <span className="ml-1 font-normal text-slate-600">
                        {entry.previous_status && entry.new_status
                          ? `(${entry.previous_status} → ${entry.new_status})`
                          : `— ${entry.new_status || entry.status || ''}`}
                      </span>
                    </p>
                    {entry.reviewer ? (
                      <p className="text-xs text-slate-500">
                        By {entry.reviewer.full_name || formatFullName(entry.reviewer) || 'Reviewer'}
                      </p>
                    ) : null}
                    {entry.comments ? (
                      <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-slate-700 shadow-sm">{entry.comments}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
};

export default SubmissionUpdates;
