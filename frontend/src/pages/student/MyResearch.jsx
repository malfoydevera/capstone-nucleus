import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Check, CheckCircle2, ChevronDown, ChevronRight, Clock3, FileText, Plus, RefreshCw } from 'lucide-react';
import { researchAPI } from '../../utils/api';

const MyResearch = () => {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedActionNotes, setExpandedActionNotes] = useState(true);

  useEffect(() => {
    fetchMyResearch();
    
    const interval = setInterval(() => {
      fetchMyResearch(true); // Silent refresh every 3 seconds for realtime updates
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const fetchMyResearch = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await researchAPI.getMyResearch();
      const fetchedPapers = response.data.papers;

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

  const isActionStatus = (status) => status === 'revision_required' || status === 'rejected';

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Pending Review',
      pending_faculty: 'With Adviser',
      pending_editor: 'With Editor',
      pending_admin: 'With Admin',
      under_review: 'Under Review',
      approved: 'Published',
      rejected: 'Rejected',
      revision_required: 'Revision Required',
    };

    return labels[status] || 'Pending Review';
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'just now';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const days = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    if (days === 0) return 'today';
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getPipelineStage = (status) => {
    if (status === 'approved') return 5;
    if (status === 'pending_admin') return 4;
    if (status === 'pending_editor' || status === 'under_review') return 3;
    if (status === 'pending') return 2;
    if (status === 'pending_faculty') return 1;
    return 1;
  };

  const getProgressColor = (status) => {
    if (status === 'revision_required') return 'bg-amber-500';
    if (status === 'rejected') return 'bg-rose-500';
    if (status === 'approved') return 'bg-emerald-700';
    return 'bg-slate-400';
  };

  const statusCounts = useMemo(() => {
    return papers.reduce((acc, paper) => {
      acc[paper.status] = (acc[paper.status] || 0) + 1;
      return acc;
    }, {});
  }, [papers]);

  const summary = useMemo(() => {
    const pending = (statusCounts.pending || 0) + (statusCounts.pending_faculty || 0) + (statusCounts.pending_editor || 0) + (statusCounts.pending_admin || 0);
    const published = statusCounts.approved || 0;
    const needsAction = (statusCounts.rejected || 0) + (statusCounts.revision_required || 0);
    const inReview = statusCounts.under_review || 0;

    return {
      total: papers.length,
      pending,
      published,
      needsAction,
      inReview,
    };
  }, [papers.length, statusCounts]);

  const topActionPaper = useMemo(() => {
    return papers.find((paper) => paper.status === 'revision_required') || papers.find((paper) => paper.status === 'rejected') || null;
  }, [papers]);

  const filteredPapers = useMemo(() => {
    return papers.filter((paper) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'needs_action') return isActionStatus(paper.status);
      if (activeFilter === 'updates') return !isActionStatus(paper.status) && paper.status !== 'approved';
      if (activeFilter === 'archive') return paper.status === 'approved';
      return true;
    });
  }, [activeFilter, papers]);

  const visibleRows = useMemo(() => {
    return filteredPapers.filter((paper) => paper.id !== topActionPaper?.id);
  }, [filteredPapers, topActionPaper?.id]);

  const sparkline = (color) => (
    <svg viewBox="0 0 80 24" className="h-6 w-16" fill="none" aria-hidden="true">
      <path d="M2 18 L16 14 L28 16 L40 7 L54 10 L68 5 L78 7" className={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const handleRefresh = () => {
    fetchMyResearch();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] animate-fadeIn">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-[#1C4D8D]/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-[#1C4D8D] border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="mt-6 text-lg font-medium text-slate-600 animate-pulse">Loading your research portfolio...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 animate-fadeIn">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.95fr_0.85fr] gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">My Research Portfolio</h1>
              <p className="text-sm text-slate-500">Track and manage your academic submissions</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="h-9 px-3 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 inline-flex items-center gap-2 text-sm"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                onClick={() => navigate('/student/submit')}
                className="h-9 px-3 rounded-lg bg-[#1C4D8D] text-white text-sm font-semibold hover:bg-[#163d70] inline-flex items-center gap-2"
              >
                <Plus size={14} />
                Submit New Research
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 lg:grid-cols-5 gap-2">
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-slate-900">{summary.total}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
                {sparkline('stroke-slate-500')}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-slate-900">{summary.pending}</p>
                  <p className="text-xs text-slate-500">Pending</p>
                </div>
                {sparkline('stroke-amber-500')}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-emerald-700">{summary.published}</p>
                  <p className="text-xs text-slate-500">Published</p>
                </div>
                {sparkline('stroke-emerald-700')}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-amber-700">{summary.needsAction}</p>
                  <p className="text-xs text-slate-500">Needs Action</p>
                </div>
                {sparkline('stroke-amber-600')}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-slate-900">{summary.inReview}</p>
                  <p className="text-xs text-slate-500">In Review</p>
                </div>
                {sparkline('stroke-sky-500')}
              </div>
            </div>
          </div>

          <div className="mt-3 border-b border-slate-200 flex items-center gap-5">
            <button
              onClick={() => setActiveFilter('all')}
              className={`pb-2 text-sm font-semibold border-b-2 ${activeFilter === 'all' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              All
            </button>
            <button
              onClick={() => setActiveFilter('needs_action')}
              className={`pb-2 text-sm font-semibold border-b-2 ${activeFilter === 'needs_action' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Needs Action
            </button>
            <button
              onClick={() => setActiveFilter('updates')}
              className={`pb-2 text-sm font-semibold border-b-2 ${activeFilter === 'updates' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Updates
            </button>
            <button
              onClick={() => setActiveFilter('archive')}
              className={`pb-2 text-sm font-semibold border-b-2 ${activeFilter === 'archive' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Archive
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {topActionPaper && activeFilter !== 'archive' ? (
              <article className="rounded-lg border border-amber-200 border-l-4 border-l-amber-500 bg-amber-50/50 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                      <AlertCircle size={13} /> Urgent: Revision Request
                    </div>
                    <h2 className="mt-1 text-[1.35rem] leading-tight font-bold text-slate-900">
                      {topActionPaper.title || 'Revision Request'}
                    </h2>
                  </div>

                  <button
                    onClick={() => navigate('/student/submit', { state: { resubmit: topActionPaper } })}
                    className="h-9 px-3 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700"
                  >
                    Resolve Revision
                  </button>
                </div>

                <button
                  onClick={() => setExpandedActionNotes((prev) => !prev)}
                  className="mt-2 text-sm font-medium text-slate-700 inline-flex items-center gap-1"
                >
                  {expandedActionNotes ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Adviser&apos;s Notes
                </button>

                {expandedActionNotes ? (
                  <div className="mt-1 rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-sm font-mono text-slate-700 whitespace-pre-wrap">
                    {topActionPaper.revision_notes || topActionPaper.rejection_reason || 'Page 1: hi'}
                  </div>
                ) : null}

                <div className="mt-3 overflow-x-auto">
                  <div className="min-w-[420px] flex items-center gap-2 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1"><Check size={12} className="text-emerald-600" /> Adviser Review</span>
                    <span className="h-px flex-1 bg-slate-300" />
                    <span className="inline-flex items-center gap-1"><Clock3 size={12} className="text-amber-600" /> Staff Review</span>
                    <span className="h-px flex-1 bg-slate-300" />
                    <span>Final Review</span>
                    <span className="h-px flex-1 bg-slate-300" />
                    <span>Publish</span>
                  </div>
                </div>
              </article>
            ) : null}

            {visibleRows.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No research items found for this filter.
              </div>
            ) : (
              visibleRows.map((paper) => {
                const stage = getPipelineStage(paper.status);
                const statusColor = getProgressColor(paper.status);
                const isPublished = paper.status === 'approved';
                const isRejected = paper.status === 'rejected';
                const isRevision = paper.status === 'revision_required';
                const stageNames = ['Adviser', 'Program Chair', 'Editor', 'Admin', 'Publish'];
                const currentStageName = isPublished ? 'Published' : stageNames[Math.max(0, Math.min(stage - 1, 4))];
                const progressPercent = Math.max(0, Math.min(100, ((stage - 1) / 4) * 100));

                return (
                  <article
                    key={paper.id}
                    className={`rounded-lg border p-3 ${
                      isPublished
                        ? 'border-emerald-400 bg-emerald-100/60'
                        : isRejected
                        ? 'border-rose-200 bg-rose-50/20'
                        : isRevision
                        ? 'border-amber-200 bg-amber-50/20'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1.15fr_auto] items-center gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-bold text-slate-900 truncate">{paper.title}</p>
                          {isPublished ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold bg-emerald-200 text-emerald-900 border border-emerald-400">
                              <CheckCircle2 size={11} /> Published
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-slate-500">
                          {getStatusLabel(paper.status)} • Submitted {formatTimeAgo(paper.submission_date || paper.created_at)}
                        </p>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700">
                            Current Stage: <span className={`${isPublished ? 'text-emerald-900' : isRevision ? 'text-amber-700' : isRejected ? 'text-rose-700' : 'text-sky-700'}`}>{currentStageName}</span>
                          </span>
                          <span className="text-slate-500">Step {stage}/5</span>
                        </div>

                        <div className="relative">
                          <div className="absolute left-[10%] right-[10%] top-4 h-0.5 bg-slate-200" />
                          <div className="absolute left-[10%] top-4 h-0.5 bg-emerald-700" style={{ width: `${progressPercent * 0.8}%` }} />

                          <div className="relative grid grid-cols-5 gap-1.5 text-xs text-slate-600">
                            <div className="flex flex-col items-center gap-1">
                              <span className="h-8 w-8 rounded-full border border-slate-200 bg-white inline-flex items-center justify-center shadow-sm">
                                {stage > 1 ? <CheckCircle2 size={15} className="text-emerald-700" /> : stage === 1 ? <Clock3 size={14} className="text-sky-600" /> : <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />}
                              </span>
                              <span className="text-center leading-tight">Adviser</span>
                            </div>

                            <div className="flex flex-col items-center gap-1">
                              <span className="h-8 w-8 rounded-full border border-slate-200 bg-white inline-flex items-center justify-center shadow-sm">
                                {stage > 2 ? <CheckCircle2 size={15} className="text-emerald-700" /> : stage === 2 ? <Clock3 size={14} className="text-sky-600" /> : <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />}
                              </span>
                              <span className="text-center leading-tight">Chair</span>
                            </div>

                            <div className="flex flex-col items-center gap-1">
                              <span className="h-8 w-8 rounded-full border border-slate-200 bg-white inline-flex items-center justify-center shadow-sm">
                                {stage > 3 ? <CheckCircle2 size={15} className="text-emerald-700" /> : stage === 3 ? <Clock3 size={14} className="text-sky-600" /> : <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />}
                              </span>
                              <span className="text-center leading-tight">Editor</span>
                            </div>

                            <div className="flex flex-col items-center gap-1">
                              <span className="h-8 w-8 rounded-full border border-slate-200 bg-white inline-flex items-center justify-center shadow-sm">
                                {stage > 4 ? <CheckCircle2 size={15} className="text-emerald-700" /> : stage === 4 ? <Clock3 size={14} className="text-sky-600" /> : <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />}
                              </span>
                              <span className="text-center leading-tight">Admin</span>
                            </div>

                            <div className="flex flex-col items-center gap-1">
                              <span className={`h-8 w-8 rounded-full border inline-flex items-center justify-center shadow-sm ${isPublished ? 'border-emerald-500 bg-emerald-200' : 'border-slate-200 bg-white'}`}>
                                {stage >= 5 ? <CheckCircle2 size={15} className="text-emerald-800" /> : <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />}
                              </span>
                              <span className={`text-center leading-tight ${isPublished ? 'font-semibold text-emerald-900' : ''}`}>Publish</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-700" /> Completed</span>
                          <span className="inline-flex items-center gap-1"><Clock3 size={12} className="text-sky-600" /> Current</span>
                          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300" /> Upcoming</span>
                        </div>
                      </div>

                      <a
                        href={paper.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 px-3 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 inline-flex items-center justify-center"
                      >
                        {isPublished ? 'Open Published' : 'View Document'}
                      </a>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <aside className="h-fit xl:sticky xl:top-6 rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-xl font-semibold text-slate-900">Snapshot</h3>
          <p className="text-sm text-slate-600 mt-1">My Paper Status</p>

          <div className="mt-4 h-3 rounded-full bg-slate-200 overflow-hidden flex">
            <div className="bg-amber-500" style={{ width: `${summary.total ? Math.round((summary.pending / summary.total) * 100) : 0}%` }} />
            <div className="bg-emerald-700" style={{ width: `${summary.total ? Math.round((summary.published / summary.total) * 100) : 0}%` }} />
            <div className="bg-slate-400" style={{ width: `${summary.total ? Math.round((summary.inReview / summary.total) * 100) : 0}%` }} />
            <div className="bg-rose-400" style={{ width: `${summary.total ? Math.round((summary.needsAction / summary.total) * 100) : 0}%` }} />
          </div>

          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between text-slate-700"><span>Pending Revision</span><span className="font-semibold">{statusCounts.revision_required || 0}</span></div>
            <div className="flex items-center justify-between text-slate-700"><span>Active Reviews</span><span className="font-semibold">{summary.pending + summary.inReview}</span></div>
            <div className="flex items-center justify-between text-slate-700"><span>Published</span><span className="font-semibold">{summary.published}</span></div>
            <div className="flex items-center justify-between text-slate-700"><span>Needs Action</span><span className="font-semibold">{summary.needsAction}</span></div>
          </div>
        </aside>
      </div>

      {papers.length === 0 && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
          <FileText size={24} className="mx-auto text-slate-400" />
          <h3 className="mt-2 text-lg font-semibold text-slate-900">No research papers yet</h3>
          <p className="text-sm text-slate-500 mt-1">Start by submitting your first paper.</p>
          <button
            onClick={() => navigate('/student/submit')}
            className="mt-3 h-9 px-3 rounded-lg bg-[#1C4D8D] text-white text-sm font-semibold hover:bg-[#163d70]"
          >
            Submit New Research
          </button>
        </div>
      )}
    </div>
  );
};

export default MyResearch;