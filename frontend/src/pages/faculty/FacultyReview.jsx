import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  ChevronRight,
  XCircle,
} from 'lucide-react';
import { researchAPI, unwrapApiData } from '../../utils/api';
import { formatFullName } from '../../utils/names';
import UserGuideLink from '../../components/ui/UserGuideLink';
import ReviewWorkspaceLayout from '../../components/review/ReviewWorkspaceLayout';
import { PriorityBanner } from '../../components/review/ReviewListShell';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 10;

const getDepartmentScopeKey = (paper) => paper?.department_id || paper?.department || 'unassigned';

const getDepartmentScopeLabel = (paper) => {
  if (paper?.department) return paper.department;
  if (paper?.department_id) return `Department ${String(paper.department_id).slice(0, 8)}`;
  return 'Unassigned';
};

const FacultyReview = () => {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending_faculty');
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [conflictModalPaper, setConflictModalPaper] = useState(null);
  const [conflictReason, setConflictReason] = useState('');
  const [conflictLoading, setConflictLoading] = useState(false);

  useEffect(() => {
    fetchPapers();
    const interval = setInterval(() => fetchPapers(true), 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchPapers = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [response, categoriesResponse] = await Promise.all([
        researchAPI.getFacultyAssignedPapers(),
        researchAPI.getCategories(),
      ]);
      const allPapers = unwrapApiData(response).papers || [];
      setCategories(unwrapApiData(categoriesResponse).categories || []);
      setPapers(allPapers);
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Failed to fetch papers:', error);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const stats = useMemo(() => ({
    pendingFaculty: papers.filter((p) => p.status === 'pending_faculty').length,
    revisionRequired: papers.filter((p) => p.status === 'revision_required').length,
    facultyApproved: papers.filter((p) =>
      ['pending_editor', 'pending_admin', 'approved', 'published'].includes(p.status),
    ).length,
    total: papers.length,
  }), [papers]);

  const filteredPapers = useMemo(() => {
    let filtered = [...papers];

    if (statusFilter === 'pending_faculty') {
      filtered = papers.filter((p) => p.status === 'pending_faculty' || p.status === 'revision_required');
    } else if (statusFilter !== 'all') {
      filtered = papers.filter((p) => p.status === statusFilter);
    }

    if (searchTerm) {
      const normalizedSearch = searchTerm.toLowerCase();
      filtered = filtered.filter((paper) => {
        const searchCorpus = [
          paper.title,
          paper.abstract,
          paper.file_name,
          paper.department,
          formatFullName(paper.users),
          ...(paper.keywords || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return searchCorpus.includes(normalizedSearch);
      });
    }

    if (departmentFilter !== 'all') {
      filtered = filtered.filter((paper) => getDepartmentScopeKey(paper) === departmentFilter);
    }

    if (dateFilter !== 'all') {
      const now = Date.now();
      const windowDays = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : 90;
      filtered = filtered.filter((paper) => {
        const submitted = new Date(paper.submission_date || paper.created_at).getTime();
        if (Number.isNaN(submitted)) return false;
        return now - submitted <= windowDays * 24 * 60 * 60 * 1000;
      });
    }

    filtered.sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.submission_date || a.created_at) - new Date(b.submission_date || b.created_at);
      }
      if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
      if (sortBy === 'author') return formatFullName(a.users).localeCompare(formatFullName(b.users));
      return new Date(b.submission_date || b.created_at) - new Date(a.submission_date || a.created_at);
    });

    return filtered;
  }, [papers, statusFilter, searchTerm, departmentFilter, dateFilter, sortBy]);

  const priorityPaper = useMemo(() => (
    papers.find((p) => p.status === 'pending_faculty' && p.revision_notes) ||
    papers.find((p) => p.status === 'revision_required') ||
    papers.find((p) => p.status === 'pending_faculty') ||
    null
  ), [papers]);

  const departmentOptions = useMemo(() => [
    { value: 'all', label: 'All Departments' },
    ...Array.from(
      new Map(
        papers.map((paper) => [getDepartmentScopeKey(paper), getDepartmentScopeLabel(paper)]),
      ).entries(),
    ).map(([value, label]) => ({
      value,
      label: label === 'Unassigned' ? 'Unassigned' : label,
    })),
  ].sort((left, right) => {
    if (left.value === 'all') return -1;
    if (right.value === 'all') return 1;
    return left.label.localeCompare(right.label);
  }), [papers]);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.max(0, Math.floor(Math.abs(now - date) / (1000 * 60 * 60 * 24)));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getCategoryName = (categoryValue) => {
    if (!categoryValue) return 'General';
    const category = categories.find((entry) => entry.id === categoryValue);
    if (category) return category.name;
    if (typeof categoryValue === 'string' && !UUID_PATTERN.test(categoryValue)) return categoryValue;
    return 'General';
  };

  const handleDeclareConflict = async () => {
    if (!conflictModalPaper) return;
    if (!conflictReason.trim()) {
      toast.error('Please provide a reason for the conflict declaration.');
      return;
    }

    setConflictLoading(true);
    const loadingToast = toast.loading('Declaring conflict...');
    try {
      await researchAPI.declareConflictOfInterest(conflictModalPaper.id, conflictReason.trim());
      toast.success('Conflict declared. This paper has been removed from your queue.', { id: loadingToast });
      setConflictModalPaper(null);
      setConflictReason('');
      fetchPapers(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to declare conflict', { id: loadingToast });
    } finally {
      setConflictLoading(false);
    }
  };

  const queueItems = [
    {
      key: 'pending_faculty',
      label: 'Needs your review',
      shortLabel: 'Needs review',
      description: 'New submissions and resubmissions',
      count: stats.pendingFaculty + stats.revisionRequired,
    },
    {
      key: 'revision_required',
      label: 'Revision requested',
      shortLabel: 'Revisions',
      description: 'Sent back to the author',
      count: stats.revisionRequired,
    },
    {
      key: 'pending_editor',
      label: 'Approved by you',
      shortLabel: 'Approved',
      description: 'With the research editor',
      count: stats.facultyApproved,
    },
    {
      key: 'all',
      label: 'All assigned',
      shortLabel: 'All',
      description: 'Every paper in your scope',
      count: stats.total,
    },
  ];

  const advancedFilters = [
    {
      id: 'department-filter',
      label: 'Department',
      value: departmentFilter,
      onChange: setDepartmentFilter,
      options: departmentOptions.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    },
    {
      id: 'date-filter',
      label: 'Submitted',
      value: dateFilter,
      onChange: setDateFilter,
      options: [
        { value: 'all', label: 'Any time' },
        { value: '7d', label: 'Last 7 days' },
        { value: '30d', label: 'Last 30 days' },
        { value: '90d', label: 'Last 90 days' },
      ],
    },
    {
      id: 'sort-filter',
      label: 'Sort order',
      value: sortBy,
      onChange: setSortBy,
      options: [
        { value: 'newest', label: 'Newest first' },
        { value: 'oldest', label: 'Oldest first' },
        { value: 'title', label: 'Title (A–Z)' },
        { value: 'author', label: 'Author (A–Z)' },
      ],
    },
  ];

  const submissions = filteredPapers.map((paper) => ({
    id: paper.id,
    title: paper.title,
    authorName: formatFullName(paper.users),
    categoryName: getCategoryName(paper.category),
    formattedDate: formatDate(paper.submission_date || paper.created_at),
    status: paper.status,
    onOpen: () => navigate(`/faculty/review/${paper.id}`),
    paper,
  }));

  return (
    <>
      <ReviewWorkspaceLayout
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Adviser review queue' },
        ]}
        roleLabel="Faculty Adviser"
        title="Adviser Review Queue"
        subtitle="Review manuscripts from your advisees, leave feedback, and forward approved work to the dean or program chair."
        headerExtra={<UserGuideLink />}
        lastRefreshed={lastRefreshed}
        refreshing={refreshing}
        onRefresh={() => fetchPapers()}
        queueItems={queueItems}
        activeQueue={statusFilter}
        onQueueChange={setStatusFilter}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        advancedFilters={advancedFilters}
        priorityBanner={priorityPaper && statusFilter === 'pending_faculty' ? (
          <PriorityBanner
            label="Review this next"
            title={priorityPaper.title}
            action={(
              <button
                type="button"
                onClick={() => navigate(`/faculty/review/${priorityPaper.id}`)}
                className="w-full sm:w-auto shrink-0 h-9 px-3 rounded-lg bg-[#3674B5] text-white text-xs font-semibold hover:bg-[#2d6299] inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                Open manuscript
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            )}
          />
        ) : null}
        isEmpty={filteredPapers.length === 0}
        emptyTitle="No manuscripts in this queue"
        emptyDescription="Switch to another queue above, or clear your department and date filters."
        submissions={submissions}
        pageSize={PAGE_SIZE}
        loading={loading}
        renderRowActions={(submission) => (
          (submission.paper?.status === 'pending_faculty' || submission.paper?.status === 'revision_required') ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setConflictModalPaper(submission.paper);
              }}
              className="inline-flex min-h-[2.75rem] items-center justify-center px-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm font-medium hover:bg-rose-100 transition-colors"
            >
              Declare conflict
            </button>
          ) : null
        )}
      />

      {conflictModalPaper && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="conflict-modal-title"
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-rose-50 border-b border-rose-100 flex items-center gap-3">
              <XCircle size={18} className="text-rose-600 shrink-0" aria-hidden="true" />
              <h3 id="conflict-modal-title" className="text-base sm:text-lg font-bold text-slate-900">
                Declare Conflict of Interest
              </h3>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-700">
                You are declaring a conflict for:
                <span className="block mt-1 font-semibold text-slate-900 break-words">{conflictModalPaper.title}</span>
              </p>

              <div>
                <label htmlFor="conflict-reason" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Reason <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="conflict-reason"
                  value={conflictReason}
                  onChange={(e) => setConflictReason(e.target.value)}
                  rows={4}
                  placeholder="Explain why you cannot review this paper impartially…"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 resize-none"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setConflictModalPaper(null);
                    setConflictReason('');
                  }}
                  disabled={conflictLoading}
                  className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeclareConflict}
                  disabled={conflictLoading || !conflictReason.trim()}
                  className="flex-1 py-2.5 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50"
                >
                  {conflictLoading ? 'Submitting…' : 'Declare Conflict'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FacultyReview;
