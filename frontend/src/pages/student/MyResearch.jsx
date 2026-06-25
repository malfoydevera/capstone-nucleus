import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  RefreshCw,
  MessageSquare,
  ExternalLink,
  Upload,
  BookOpen,
  TrendingUp,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { researchAPI, unwrapApiData } from '../../utils/api';
import LoadMoreFooter from '../../components/ui/LoadMoreFooter';
import { formatFullName } from '../../utils/names';
import { getStudentStatusLabel, getStudentStatusTone, isNeedsAction } from '../../utils/studentStatus';

const getStructuredAuthors = (paper) =>
  Array.isArray(paper?.structured_authors) ? paper.structured_authors : [];

const getAuthorName = (paper) => {
  const primary = getStructuredAuthors(paper).find((entry) => entry?.is_primary);
  if (primary?.author) {
    return formatFullName(primary.author) || primary.author.full_name || '—';
  }
  return formatFullName(paper?.users) || '—';
};

const getCoAuthorNames = (paper) =>
  getStructuredAuthors(paper)
    .filter((entry) => !entry?.is_primary)
    .map((entry) => formatFullName(entry?.author) || entry?.author?.full_name)
    .filter(Boolean);

const PAGE_SIZE = 8;

const STAGE_LABELS = ['Adviser', 'Chair', 'Editor', 'Admin', 'Published'];

const TABLE_HEAD_CELL =
  'text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide border-r border-slate-200 last:border-r-0';

const TABLE_BODY_CELL = 'px-5 py-4 align-top border-r border-slate-200/70 last:border-r-0';

const getPipelineStage = (status) => {
  if (status === 'approved') return 5;
  if (status === 'pending_admin') return 4;
  if (status === 'pending_editor' || status === 'under_review') return 3;
  if (status === 'pending_faculty') return 2;
  return 1;
};

const MyResearch = () => {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedActionNotes, setExpandedActionNotes] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    fetchMyResearch();
    const interval = setInterval(() => {
      fetchMyResearch(true);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMyResearch = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await researchAPI.getMyResearch();
      const fetchedPapers = unwrapApiData(response).papers || [];
      setPapers(fetchedPapers);
      setError('');
    } catch (err) {
      if (!silent) {
        setError('Failed to load research papers');
        console.error(err);
      }
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const days = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;
    return formatDate(dateString);
  };

  const statusCounts = useMemo(() => {
    return papers.reduce((acc, paper) => {
      acc[paper.status] = (acc[paper.status] || 0) + 1;
      return acc;
    }, {});
  }, [papers]);

  const summary = useMemo(() => {
    const pending =
      (statusCounts.pending_faculty || 0) +
      (statusCounts.pending_editor || 0) +
      (statusCounts.pending_admin || 0);
    const published = statusCounts.approved || 0;
    const needsAction = (statusCounts.rejected || 0) + (statusCounts.revision_required || 0);
    const inReview = statusCounts.pending_editor || 0;
    return { total: papers.length, pending, published, needsAction, inReview };
  }, [papers.length, statusCounts]);

  const topActionPaper = useMemo(() => {
    return (
      papers.find((p) => p.status === 'revision_required') ||
      papers.find((p) => p.status === 'rejected') ||
      null
    );
  }, [papers]);

  const filteredPapers = useMemo(() => {
    return papers.filter((paper) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'needs_action') return isNeedsAction(paper.status);
      if (activeFilter === 'updates') return !isNeedsAction(paper.status) && paper.status !== 'approved';
      if (activeFilter === 'archive') return paper.status === 'approved';
      return true;
    });
  }, [activeFilter, papers]);

  const listRows = useMemo(() => {
    return filteredPapers.filter((p) => p.id !== topActionPaper?.id);
  }, [filteredPapers, topActionPaper?.id]);

  const visibleRows = useMemo(() => listRows.slice(0, visibleCount), [listRows, visibleCount]);
  const canLoadMore = visibleCount < listRows.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeFilter, filteredPapers.length, topActionPaper?.id]);

  const FILTERS = [
    { key: 'all', label: 'All', count: papers.length },
    { key: 'needs_action', label: 'Needs Action', count: summary.needsAction },
    { key: 'updates', label: 'In Progress', count: summary.pending + summary.inReview },
    { key: 'archive', label: 'Published', count: summary.published },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#3674B5]/20 rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#3674B5] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="mt-5 text-sm font-medium text-slate-500">Loading submissions…</p>
      </div>
    );
  }

  const renderRowActions = (paper, isPublished) => (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => navigate(`/student/my-research/${paper.id}`)}
        className="h-8 px-3 rounded-md bg-[#3674B5] text-white text-xs font-semibold hover:bg-[#2d6299] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
        title="Status & Reviewer Feedback"
      >
        <MessageSquare size={13} />
        <span className="hidden sm:inline">Status &amp; Feedback</span>
        <span className="sm:hidden">Feedback</span>
      </button>
      <button
        type="button"
        onClick={() =>
          navigate(`/research/${paper.id}`, {
            state: { from: '/student/my-research' },
          })
        }
        className="h-8 w-8 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 inline-flex items-center justify-center transition-colors"
        title={isPublished ? 'Open Published Paper' : 'View Document'}
      >
        <ExternalLink size={13} />
      </button>
    </div>
  );

  const getRowTone = (isRevision, isRejected, isPublished) => {
    if (isRevision) return 'bg-amber-50/40 hover:bg-amber-50/70 border-amber-100';
    if (isRejected) return 'bg-rose-50/30 hover:bg-rose-50/60 border-rose-100';
    if (isPublished) return 'bg-emerald-50/30 hover:bg-emerald-50/60 border-emerald-100';
    return 'bg-white hover:bg-slate-50/80 border-slate-100';
  };

  const renderCoAuthors = (paper) => {
    const coAuthors = getCoAuthorNames(paper);
    const externalNotes = String(paper?.external_author_notes || '').trim();

    if (coAuthors.length > 0) {
      return (
        <div className="space-y-0.5">
          {coAuthors.map((name, index) => (
            <p key={`${name}-${index}`} className="text-xs text-slate-600 break-words">
              {name}
            </p>
          ))}
        </div>
      );
    }

    if (externalNotes) {
      return <p className="text-xs text-slate-500 italic break-words">{externalNotes}</p>;
    }

    return <span className="text-xs text-slate-400">—</span>;
  };

  return (
    <div className="w-full min-h-full px-4 sm:px-6 lg:px-8 py-6">
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="w-full space-y-5">

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">My Submissions</h1>
              <p className="text-xs text-slate-500 mt-0.5">Track and manage your academic submissions</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchMyResearch()}
                disabled={refreshing}
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
              >
                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
              <button
                onClick={() => navigate('/student/submit')}
                className="h-8 px-3 rounded-lg bg-[#3674B5] text-white text-xs font-semibold hover:bg-[#2d6299] inline-flex items-center gap-1.5 transition-colors"
              >
                <Plus size={13} />
                New Submission
              </button>
            </div>
          </div>

          {/* Summary stat pills */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <BookOpen size={15} className="text-slate-600" />
              </span>
              <div>
                <p className="text-lg font-bold leading-none text-slate-900">{summary.total}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Total</p>
              </div>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <Activity size={15} className="text-amber-600" />
              </span>
              <div>
                <p className="text-lg font-bold leading-none text-amber-800">{summary.pending}</p>
                <p className="text-[11px] text-amber-700 mt-0.5">Pending</p>
              </div>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5 flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <TrendingUp size={15} className="text-emerald-600" />
              </span>
              <div>
                <p className="text-lg font-bold leading-none text-emerald-800">{summary.published}</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">Published</p>
              </div>
            </div>
            <div className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2.5 flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={15} className="text-orange-600" />
              </span>
              <div>
                <p className="text-lg font-bold leading-none text-orange-800">{summary.needsAction}</p>
                <p className="text-[11px] text-orange-700 mt-0.5">Needs Action</p>
              </div>
            </div>
          </div>

          {/* Urgent revision banner */}
          {topActionPaper && activeFilter !== 'archive' && (
            <div className="rounded-lg border border-l-4 border-amber-200 border-l-amber-500 bg-amber-50/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">
                    <AlertCircle size={13} />
                    {topActionPaper.status === 'rejected' ? 'Submission Rejected' : 'Revision Requested'}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900 break-words">{topActionPaper.title}</p>
                </div>
                {topActionPaper.status === 'revision_required' && (
                  <button
                    onClick={() => navigate('/student/submit', { state: { resubmit: topActionPaper } })}
                    className="shrink-0 h-8 px-3 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Upload size={13} />
                    Upload Revision
                  </button>
                )}
              </div>
              <button
                onClick={() => setExpandedActionNotes((prev) => !prev)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800"
              >
                {expandedActionNotes ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                Adviser&apos;s Notes
              </button>
              {expandedActionNotes && (
                <div className="mt-2 rounded-md border border-amber-100 bg-white/70 px-3 py-2.5 text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {topActionPaper.revision_notes ||
                    topActionPaper.rejection_reason ||
                    'No detailed notes were provided. Contact your assigned reviewer for clarification.'}
                </div>
              )}
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`pb-2.5 px-1 mr-3 text-xs font-semibold border-b-2 transition-colors ${
                  activeFilter === f.key
                    ? 'border-[#3674B5] text-[#3674B5]'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {f.label}
                {f.count > 0 && (
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      activeFilter === f.key
                        ? 'bg-[#3674B5]/10 text-[#3674B5]'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Table */}
          {papers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
              <FileText size={28} className="mx-auto text-slate-300" />
              <h3 className="mt-3 text-sm font-semibold text-slate-700">No submissions yet</h3>
              <p className="text-xs text-slate-500 mt-1">Start by submitting your first research paper.</p>
              <button
                onClick={() => navigate('/student/submit')}
                className="mt-4 h-8 px-4 rounded-lg bg-[#3674B5] text-white text-xs font-semibold hover:bg-[#2d6299] transition-colors"
              >
                Submit Research
              </button>
            </div>
          ) : listRows.length === 0 && !topActionPaper ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm text-slate-500">No submissions match this filter.</p>
            </div>
          ) : (
            <>
              {/* Mobile card list */}
              <div className="space-y-3 md:hidden">
                {visibleRows.map((paper) => {
                  const stage = getPipelineStage(paper.status);
                  const isPublished = paper.status === 'approved';
                  const isRejected = paper.status === 'rejected';
                  const isRevision = paper.status === 'revision_required';
                  const authorName = getAuthorName(paper);
                  const currentStageName = isPublished
                    ? 'Published'
                    : STAGE_LABELS[Math.max(0, Math.min(stage - 1, 4))];

                  return (
                    <article
                      key={paper.id}
                      className={`rounded-lg border p-4 transition-colors ${getRowTone(isRevision, isRejected, isPublished)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900 leading-snug break-words">
                            {paper.title || 'Untitled'}
                          </p>
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${getStudentStatusTone(paper.status)}`}
                        >
                          {getStudentStatusLabel(paper.status)}
                        </span>
                      </div>

                      <div className="mt-3 border-t border-slate-200 pt-3 grid grid-cols-1 gap-2 text-xs">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Author</p>
                          <p className="mt-0.5 font-medium text-slate-700 break-words">{authorName}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Co-Authors</p>
                          <div className="mt-0.5">{renderCoAuthors(paper)}</div>
                        </div>
                      </div>

                      <div className="mt-3 border-t border-slate-200 pt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>
                          Stage: <span className="font-semibold text-slate-700">{currentStageName}</span>
                        </span>
                        <span>
                          Submitted {formatTimeAgo(paper.submission_date || paper.created_at)}
                        </span>
                      </div>

                      <div className="mt-3 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isRevision
                              ? 'bg-amber-400'
                              : isRejected
                              ? 'bg-rose-400'
                              : isPublished
                              ? 'bg-emerald-500'
                              : 'bg-[#3674B5]'
                          }`}
                          style={{ width: `${Math.max(10, ((stage - 1) / 4) * 100)}%` }}
                        />
                      </div>

                      <div className="mt-4 border-t border-slate-200 pt-4 flex items-center justify-between gap-2">
                        {renderRowActions(paper, isPublished)}
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block rounded-lg border border-slate-200 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1024px] text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className={`${TABLE_HEAD_CELL} min-w-[220px]`}>Title</th>
                        <th className={`${TABLE_HEAD_CELL} min-w-[140px]`}>Author</th>
                        <th className={`${TABLE_HEAD_CELL} min-w-[160px]`}>Co-Authors</th>
                        <th className={TABLE_HEAD_CELL}>Status</th>
                        <th className={TABLE_HEAD_CELL}>Stage</th>
                        <th className={TABLE_HEAD_CELL}>Submitted</th>
                        <th className={`${TABLE_HEAD_CELL} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((paper) => {
                        const stage = getPipelineStage(paper.status);
                        const isPublished = paper.status === 'approved';
                        const isRejected = paper.status === 'rejected';
                        const isRevision = paper.status === 'revision_required';
                        const authorName = getAuthorName(paper);
                        const currentStageName = isPublished
                          ? 'Published'
                          : STAGE_LABELS[Math.max(0, Math.min(stage - 1, 4))];

                        return (
                          <tr
                            key={paper.id}
                            className={`group border-b border-slate-200 transition-colors ${getRowTone(isRevision, isRejected, isPublished)}`}
                          >
                            <td className={TABLE_BODY_CELL}>
                              <div className="flex items-start gap-2 min-w-0">
                                {isRevision && (
                                  <span className="mt-1.5 shrink-0 h-1.5 w-1.5 rounded-full bg-amber-500" />
                                )}
                                {isRejected && (
                                  <span className="mt-1.5 shrink-0 h-1.5 w-1.5 rounded-full bg-rose-500" />
                                )}
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-900 leading-snug break-words">
                                    {paper.title || 'Untitled'}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className={TABLE_BODY_CELL}>
                              <p className="text-xs font-medium text-slate-700 break-words">{authorName}</p>
                            </td>

                            <td className={TABLE_BODY_CELL}>
                              {renderCoAuthors(paper)}
                            </td>

                            <td className={TABLE_BODY_CELL}>
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${getStudentStatusTone(paper.status)}`}
                              >
                                {getStudentStatusLabel(paper.status)}
                              </span>
                            </td>

                            <td className={TABLE_BODY_CELL}>
                              <div className="min-w-[140px] space-y-1.5">
                                <div className="flex items-center justify-between gap-3">
                                  <span
                                    className={`text-xs font-semibold ${
                                      isPublished
                                        ? 'text-emerald-700'
                                        : isRevision
                                        ? 'text-amber-700'
                                        : isRejected
                                        ? 'text-rose-600'
                                        : 'text-slate-700'
                                    }`}
                                  >
                                    {currentStageName}
                                  </span>
                                  <span className="text-[10px] text-slate-400">{stage}/5</span>
                                </div>
                                <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      isRevision
                                        ? 'bg-amber-400'
                                        : isRejected
                                        ? 'bg-rose-400'
                                        : isPublished
                                        ? 'bg-emerald-500'
                                        : 'bg-[#3674B5]'
                                    }`}
                                    style={{ width: `${Math.max(10, ((stage - 1) / 4) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            <td className={TABLE_BODY_CELL}>
                              <span className="text-xs text-slate-500 whitespace-nowrap">
                                {formatTimeAgo(paper.submission_date || paper.created_at)}
                              </span>
                            </td>

                            <td className={TABLE_BODY_CELL}>
                              <div className="flex items-center justify-end">
                                {renderRowActions(paper, isPublished)}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {listRows.length > PAGE_SIZE && (
                <LoadMoreFooter
                  visibleCount={visibleRows.length}
                  totalCount={listRows.length}
                  canLoadMore={canLoadMore}
                  onLoadMore={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  label="submissions"
                  step={PAGE_SIZE}
                />
              )}
            </>
          )}
      </div>
    </div>
  );
};

export default MyResearch;
