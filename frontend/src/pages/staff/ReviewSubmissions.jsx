import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  BookOpen,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { researchAPI, unwrapApiData } from '../../utils/api';
import { formatFullName } from '../../utils/names';
import UserGuideLink from '../../components/ui/UserGuideLink';
import ReviewWorkspaceLayout from '../../components/review/ReviewWorkspaceLayout';
import { PriorityBanner } from '../../components/review/ReviewListShell';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 10;

const ReviewSubmissions = () => {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending_editor');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [lastRefreshed, setLastRefreshed] = useState(null);

  useEffect(() => {
    fetchPapers();
    const interval = setInterval(() => fetchPapers(true), 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchPapers = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [response, categoriesResponse] = await Promise.all([
        researchAPI.getAllResearch(),
        researchAPI.getCategories(),
      ]);
      setPapers(unwrapApiData(response).papers || []);
      setCategories(unwrapApiData(categoriesResponse).categories || []);
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Failed to fetch papers:', error);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const stats = useMemo(() => ({
    needsReview: papers.filter((p) => p.status === 'pending_editor').length,
    revisionRequired: papers.filter((p) => p.status === 'revision_required').length,
    withAdmin: papers.filter((p) => p.status === 'pending_admin').length,
    approved: papers.filter((p) => p.status === 'approved' || p.status === 'published').length,
    total: papers.length,
  }), [papers]);

  const filteredPapers = useMemo(() => {
    let filtered = [...papers];

    if (statusFilter !== 'all') {
      filtered = papers.filter((p) => p.status === statusFilter);
    }

    if (searchTerm) {
      const needle = searchTerm.toLowerCase();
      filtered = filtered.filter((paper) =>
        [
          paper.title,
          paper.abstract,
          paper.file_name,
          formatFullName(paper.users),
          ...(paper.keywords || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle),
      );
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
  }, [papers, statusFilter, searchTerm, dateFilter, sortBy]);

  const priorityPaper = useMemo(() => (
    papers.find((p) => p.status === 'pending_editor' && p.revision_notes) ||
    papers.find((p) => p.status === 'pending_editor') ||
    null
  ), [papers]);

  const getCategoryName = (categoryValue) => {
    if (!categoryValue) return 'General';
    const category = categories.find((entry) => entry.id === categoryValue);
    if (category) return category.name;
    if (typeof categoryValue === 'string' && !UUID_PATTERN.test(categoryValue)) return categoryValue;
    return 'General';
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

  const queueItems = [
    {
      key: 'pending_editor',
      label: 'Awaiting your edit',
      description: 'Manuscripts ready for editorial review',
      count: stats.needsReview,
    },
    {
      key: 'revision_required',
      label: 'Author revisions',
      description: 'Resubmissions after revision requests',
      count: stats.revisionRequired,
    },
    {
      key: 'pending_admin',
      label: 'With administrator',
      description: 'Forwarded for final admin approval',
      count: stats.withAdmin,
    },
    {
      key: 'approved',
      label: 'Approved & published',
      description: 'Completed editorial decisions',
      count: stats.approved,
    },
    {
      key: 'all',
      label: 'All manuscripts',
      description: 'Every paper in the editorial pipeline',
      count: stats.total,
    },
  ];

  const advancedFilters = [
    {
      id: 'date-filter',
      label: 'Submission date',
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
        { value: 'title', label: 'Title A–Z' },
        { value: 'author', label: 'Author A–Z' },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="review-screen flex flex-1 min-h-0 flex-col items-center justify-center h-full">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#3674B5]/20 rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#3674B5] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="mt-5 text-sm font-medium text-slate-500">Loading editorial queue…</p>
      </div>
    );
  }

  const submissions = filteredPapers.map((paper) => ({
    id: paper.id,
    title: paper.title,
    authorName: formatFullName(paper.users),
    categoryName: getCategoryName(paper.category),
    formattedDate: formatDate(paper.submission_date || paper.created_at),
    status: paper.status,
    onOpen: () => navigate(`/staff/review/${paper.id}`),
  }));

  return (
    <ReviewWorkspaceLayout
      breadcrumbs={[
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Editorial review queue' },
      ]}
      roleLabel="Research Editor"
      title="Editorial Review Queue"
      subtitle="Open a manuscript to read the PDF, leave feedback for the author, and record your editorial decision."
      badge={(
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#3674B5]/10 border border-[#3674B5]/20 text-[#3674B5] text-[11px] font-semibold">
          <Shield size={11} aria-hidden="true" /> Staff role
        </span>
      )}
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
      priorityBanner={priorityPaper && statusFilter === 'pending_editor' ? (
        <PriorityBanner
          label="Next manuscript to review"
          title={priorityPaper.title}
          action={(
            <button
              type="button"
              onClick={() => navigate(`/staff/review/${priorityPaper.id}`)}
              className="shrink-0 h-9 px-3 rounded-lg bg-[#3674B5] text-white text-xs font-semibold hover:bg-[#2d6299] inline-flex items-center gap-1.5 transition-colors"
            >
              Open manuscript
              <ChevronRight size={13} aria-hidden="true" />
            </button>
          )}
        />
      ) : null}
      isEmpty={filteredPapers.length === 0}
      emptyTitle="This queue is empty"
      emptyDescription="No manuscripts match the selected queue or search. Pick another queue from the left panel."
      submissions={submissions}
      pageSize={PAGE_SIZE}
    />
  );
};

export default ReviewSubmissions;
