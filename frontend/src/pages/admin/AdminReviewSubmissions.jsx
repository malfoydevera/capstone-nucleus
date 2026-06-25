import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  CheckCircle,
  AlertCircle,
  BookOpen,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { researchAPI, unwrapApiData } from '../../utils/api';
import { formatFullName } from '../../utils/names';
import UserGuideLink from '../../components/ui/UserGuideLink';
import ReviewWorkspaceLayout from '../../components/review/ReviewWorkspaceLayout';
import { PriorityBanner } from '../../components/review/ReviewListShell';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 10;

const AdminReviewSubmissions = () => {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('needs_action');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [lastRefreshed, setLastRefreshed] = useState(null);

  useEffect(() => {
    fetchPapers();
    const interval = setInterval(() => fetchPapers(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPapers = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [response, categoriesResponse] = await Promise.all([
        researchAPI.adminGetAllResearch(),
        researchAPI.getCategories(),
      ]);
      const allPapers = unwrapApiData(response).papers || [];
      setCategories(unwrapApiData(categoriesResponse).categories || []);
      setPapers(allPapers.filter((paper) => !paper.deleted_at));
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Failed to fetch papers:', error);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const stats = useMemo(() => ({
    pendingStaff: papers.filter((p) => ['pending_faculty', 'pending_editor'].includes(p.status)).length,
    pendingAdmin: papers.filter((p) => p.status === 'pending_admin').length,
    approved: papers.filter((p) => p.status === 'approved').length,
    published: papers.filter((p) => p.status === 'published').length,
    rejected: papers.filter((p) => p.status === 'rejected').length,
    revisionRequired: papers.filter((p) => p.status === 'revision_required').length,
    total: papers.length,
  }), [papers]);

  const filteredPapers = useMemo(() => {
    let filtered = [...papers];

    if (statusFilter === 'needs_action') {
      filtered = filtered.filter((p) =>
        ['pending_admin', 'pending_faculty', 'pending_editor'].includes(p.status),
      );
    } else if (statusFilter === 'pending_faculty') {
      filtered = filtered.filter((p) => ['pending_faculty', 'pending_editor'].includes(p.status));
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter);
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
    papers.find((p) => p.status === 'pending_admin') ||
    papers.find((p) => p.status === 'revision_required') ||
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
      key: 'pending_admin',
      label: 'Awaiting admin approval',
      description: 'Ready for final sign-off and publication',
      count: stats.pendingAdmin,
    },
    {
      key: 'needs_action',
      label: 'All open items',
      description: 'Anything still moving through review',
      count: stats.pendingStaff + stats.pendingAdmin,
    },
    {
      key: 'pending_faculty',
      label: 'Still in peer review',
      description: 'With faculty adviser or research editor',
      count: stats.pendingStaff,
    },
    {
      key: 'revision_required',
      label: 'Revision requested',
      description: 'Authors must resubmit changes',
      count: stats.revisionRequired,
    },
    {
      key: 'approved',
      label: 'Approved (internal)',
      description: 'In repository, not yet published',
      count: stats.approved,
    },
    {
      key: 'published',
      label: 'Published',
      description: 'Formally published with DOI',
      count: stats.published,
    },
    {
      key: 'rejected',
      label: 'Rejected',
      description: 'Declined submissions',
      count: stats.rejected,
    },
    {
      key: 'all',
      label: 'All manuscripts',
      description: 'Complete institutional record',
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
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#3674B5]/20 rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#3674B5] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="mt-5 text-sm font-medium text-slate-500">Loading research submissions…</p>
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
    onOpen: () => navigate(`/admin/review/${paper.id}`),
  }));

  return (
    <ReviewWorkspaceLayout
      breadcrumbs={[
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Admin approval queue' },
      ]}
      roleLabel="System Administrator"
      title="Final Approval Queue"
      subtitle="Approve manuscripts for the internal repository, assign DOIs, and publish completed research."
      badge={(
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#3674B5]/10 border border-[#3674B5]/20 text-[#3674B5] text-[11px] font-semibold">
          <ShieldCheck size={11} aria-hidden="true" /> Administrator
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
      priorityBanner={priorityPaper && ['needs_action', 'pending_admin'].includes(statusFilter) ? (
        <PriorityBanner
          label="Manuscript awaiting admin approval"
          title={priorityPaper.title}
          action={(
            <button
              type="button"
              onClick={() => navigate(`/admin/review/${priorityPaper.id}`)}
              className="shrink-0 h-9 px-3 rounded-lg bg-[#3674B5] text-white text-xs font-semibold hover:bg-[#2d6299] inline-flex items-center gap-1.5 transition-colors"
            >
              Open manuscript
              <ChevronRight size={13} aria-hidden="true" />
            </button>
          )}
        />
      ) : null}
      isEmpty={filteredPapers.length === 0}
      emptyTitle="No manuscripts in this queue"
      emptyDescription="Select another queue from the left panel to view different workflow stages."
      submissions={submissions}
      pageSize={PAGE_SIZE}
    />
  );
};

export default AdminReviewSubmissions;
