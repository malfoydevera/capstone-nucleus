import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FileText,
  Clock,
  Eye,
  AlertCircle,
  Search,
  ChevronRight,
  RefreshCw,
  BookOpen,
  Activity,
  TrendingUp,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react';
import { researchAPI, unwrapApiData } from '../../utils/api';
import { formatFullName } from '../../utils/names';
import UserGuideLink from '../../components/ui/UserGuideLink';
import LoadMoreFooter from '../../components/ui/LoadMoreFooter';
import useAutoLoadMore from '../../hooks/useAutoLoadMore';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 8;

const getDepartmentScopeKey = (paper) => paper?.department_id || paper?.department || 'unassigned';

const getDepartmentScopeLabel = (paper) => {
  if (paper?.department) return paper.department;
  if (paper?.department_id) return `Department ${String(paper.department_id).slice(0, 8)}`;
  return 'Unassigned';
};

const getFacultyStatusLabel = (status) => {
  const labels = {
    pending_faculty: 'Awaiting Review',
    pending_editor: 'With Editor',
    pending_admin: 'With Admin',
    approved: 'Approved',
    published: 'Published',
    rejected: 'Rejected',
    revision_required: 'Revision Required',
  };
  return labels[status] || status;
};

const getFacultyStatusTone = (status) => {
  const tones = {
    pending_faculty: 'text-amber-700 bg-amber-50 border-amber-100',
    pending_editor: 'text-blue-700 bg-blue-50 border-blue-100',
    pending_admin: 'text-[#3674B5] bg-[#3674B5]/10 border-[#3674B5]/20',
    approved: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    published: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    rejected: 'text-red-700 bg-red-50 border-red-100',
    revision_required: 'text-orange-700 bg-orange-50 border-orange-100',
  };
  return tones[status] || 'text-slate-600 bg-slate-50 border-slate-100';
};

const SubmissionCard = ({ paper, categoryName, formattedDate, onReview, onConflict }) => {
  const isActionable = ['pending_faculty', 'revision_required'].includes(paper.status);
  const wasReturned = paper.status === 'pending_faculty' && paper.revision_notes && paper.last_reviewer_role;
  const authorName = formatFullName(paper.users) || 'Unknown author';

  return (
    <article className="group flex items-center gap-3 px-4 py-4 sm:gap-5 sm:px-5 hover:bg-slate-50/80 transition-colors">
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
        <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#3674B5]/10 text-[#3674B5]">
          <FileText size={18} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getFacultyStatusTone(paper.status)}`}
            >
              {getFacultyStatusLabel(paper.status)}
            </span>
            {wasReturned && (
              <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700">
                Returned
              </span>
            )}
          </div>

          <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-[#3674B5] transition-colors">
            {paper.title}
          </h3>

          <p className="mt-1 truncate text-xs text-slate-500">
            <span className="font-medium text-slate-700">{authorName}</span>
            <span className="mx-2 text-slate-300" aria-hidden="true">·</span>
            {formattedDate}
            <span className="mx-2 text-slate-300" aria-hidden="true">·</span>
            {categoryName}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {isActionable && (
          <button
            type="button"
            onClick={onConflict}
            className="hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition-colors md:inline-flex"
            aria-label="Declare conflict of interest"
          >
            <XCircle size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={onReview}
          className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-[#3674B5] px-3 text-xs font-semibold text-white hover:bg-[#2d6299] transition-colors sm:px-4"
        >
          <Eye size={14} className="sm:hidden" aria-hidden="true" />
          <span className="hidden sm:inline">Review</span>
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [conflictModalPaper, setConflictModalPaper] = useState(null);
  const [conflictReason, setConflictReason] = useState('');
  const [conflictLoading, setConflictLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    fetchPapers();
    const interval = setInterval(() => fetchPapers(true), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [statusFilter, searchTerm, departmentFilter, dateFilter, sortBy]);

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

  const visiblePapers = filteredPapers.slice(0, visibleCount);
  const canLoadMore = visibleCount < filteredPapers.length;
  const loadMoreRef = useAutoLoadMore({ canLoadMore, setVisibleCount, step: PAGE_SIZE });

  const FILTERS = [
    {
      key: 'pending_faculty',
      label: 'Needs Review',
      count: stats.pendingFaculty + stats.revisionRequired,
    },
    { key: 'revision_required', label: 'Revisions', count: stats.revisionRequired },
    {
      key: 'pending_editor',
      label: 'Approved by You',
      count: papers.filter((p) => ['pending_editor', 'pending_admin', 'approved', 'published'].includes(p.status)).length,
    },
    { key: 'all', label: 'All Assigned', count: stats.total },
  ];

  const formatRelativeTime = (date) => {
    if (!date) return null;
    const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return date.toLocaleTimeString();
  };

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
      toast.success('Conflict declared. Paper removed from your queue.', { id: loadingToast });
      setConflictModalPaper(null);
      setConflictReason('');
      await fetchPapers(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to declare conflict', { id: loadingToast });
    } finally {
      setConflictLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#3674B5]/20 rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#3674B5] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="mt-5 text-sm font-medium text-slate-500">Loading assigned papers…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fadeIn space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Review Submissions</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Review research papers assigned to you as faculty adviser
            </p>
            {lastRefreshed && (
              <p className="text-[11px] text-slate-400 mt-1">
                Last refreshed {formatRelativeTime(lastRefreshed)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => fetchPapers()}
            disabled={refreshing}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5 text-xs font-medium transition-colors shrink-0"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <UserGuideLink />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-amber-100 bg-white px-3 py-2.5 flex items-center gap-2.5 shadow-sm">
            <span className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <Clock size={16} className="text-amber-600" />
            </span>
            <div>
              <p className="text-lg font-bold leading-none text-slate-900">{stats.pendingFaculty}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Pending Review</p>
            </div>
          </div>
          <div className="rounded-xl border border-orange-100 bg-white px-3 py-2.5 flex items-center gap-2.5 shadow-sm">
            <span className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
              <AlertCircle size={16} className="text-orange-600" />
            </span>
            <div>
              <p className="text-lg font-bold leading-none text-slate-900">{stats.revisionRequired}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Revisions</p>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-white px-3 py-2.5 flex items-center gap-2.5 shadow-sm">
            <span className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <TrendingUp size={16} className="text-emerald-600" />
            </span>
            <div>
              <p className="text-lg font-bold leading-none text-slate-900">{stats.facultyApproved}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Approved by You</p>
            </div>
          </div>
          <div className="rounded-xl border border-[#3674B5]/20 bg-white px-3 py-2.5 flex items-center gap-2.5 shadow-sm">
            <span className="h-9 w-9 rounded-lg bg-[#3674B5]/10 flex items-center justify-center shrink-0">
              <BookOpen size={16} className="text-[#3674B5]" />
            </span>
            <div>
              <p className="text-lg font-bold leading-none text-slate-900">{stats.total}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Total Assigned</p>
            </div>
          </div>
        </div>

        {priorityPaper && statusFilter === 'pending_faculty' && (
          <div className="rounded-xl border border-l-4 border-amber-200 border-l-amber-500 bg-amber-50/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">
                  <Activity size={13} />
                  Action Required
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900 line-clamp-1">{priorityPaper.title}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/faculty/review/${priorityPaper.id}`)}
                className="shrink-0 h-8 px-3 rounded-lg bg-[#3674B5] text-white text-xs font-semibold hover:bg-[#2d6299] inline-flex items-center gap-1.5 transition-colors"
              >
                Review Now
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex items-center gap-1 border-b border-slate-200 min-w-max">
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setStatusFilter(filter.key)}
                className={`pb-2.5 px-1 mr-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  statusFilter === filter.key
                    ? 'border-[#3674B5] text-[#3674B5]'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {filter.label}
                {filter.count > 0 && (
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      statusFilter === filter.key
                        ? 'bg-[#3674B5]/10 text-[#3674B5]'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {filter.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 min-w-0">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search by title, author, or keywords…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30 focus:border-[#3674B5]"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-colors sm:hidden"
            >
              <SlidersHorizontal size={14} />
              {showAdvancedFilters ? 'Hide Filters' : 'More Filters'}
            </button>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${showAdvancedFilters ? 'block' : 'hidden sm:grid'}`}>
            <div>
              <label htmlFor="department-filter" className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Department
              </label>
              <select
                id="department-filter"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30 focus:border-[#3674B5]"
              >
                {departmentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="date-filter" className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Date Range
              </label>
              <select
                id="date-filter"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30 focus:border-[#3674B5]"
              >
                <option value="all">All Dates</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
            </div>
            <div>
              <label htmlFor="sort-filter" className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Sort By
              </label>
              <select
                id="sort-filter"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30 focus:border-[#3674B5]"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Title A–Z</option>
                <option value="author">Author A–Z</option>
              </select>
            </div>
          </div>
        </div>

        {filteredPapers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
            <FileText size={28} className="mx-auto text-slate-300" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-semibold text-slate-700">No papers found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchTerm || departmentFilter !== 'all' || dateFilter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'No research papers have been assigned to you yet.'}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
                <p className="text-xs font-medium text-slate-600">
                  {filteredPapers.length} paper{filteredPapers.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-slate-400">
                  Showing {visiblePapers.length} of {filteredPapers.length}
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                {visiblePapers.map((paper) => (
                  <SubmissionCard
                    key={paper.id}
                    paper={paper}
                    categoryName={getCategoryName(paper.category)}
                    formattedDate={formatDate(paper.submission_date || paper.created_at)}
                    onReview={() => navigate(`/faculty/review/${paper.id}`)}
                    onConflict={() => setConflictModalPaper(paper)}
                  />
                ))}
              </div>
            </div>

            {filteredPapers.length > PAGE_SIZE && (
              <>
                <LoadMoreFooter
                  visibleCount={visiblePapers.length}
                  totalCount={filteredPapers.length}
                  canLoadMore={canLoadMore}
                  onLoadMore={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  label="papers"
                  step={PAGE_SIZE}
                />
                <div ref={loadMoreRef} className="h-1" aria-hidden="true" />
              </>
            )}
          </>
        )}
      </div>

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
                  placeholder="Explain the conflict (e.g., collaborator relationship, advisory overlap)…"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-400"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <p className="text-xs text-amber-800">
                  This removes the paper from your queue and sends it for reassignment.
                </p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (conflictLoading) return;
                    setConflictModalPaper(null);
                    setConflictReason('');
                  }}
                  className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  disabled={conflictLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeclareConflict}
                  disabled={conflictLoading || !conflictReason.trim()}
                  className="flex-1 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 transition-colors"
                >
                  {conflictLoading ? 'Submitting…' : 'Declare Conflict'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyReview;
