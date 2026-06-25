import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  BookOpen,
  ChevronRight,
  Award,
  Users,
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

const DeanChairReview = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDean = user?.role === 'dean';
  const pendingStatus = isDean ? 'pending_dean' : 'pending_program_chair';
  const reviewBasePath = isDean ? '/dean/review' : '/program-chair/review';

  const [papers, setPapers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('needs_review');
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
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
        researchAPI.getDeanChairAssignedPapers(),
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
    pendingReview: papers.filter((p) => p.status === pendingStatus).length,
    revisionRequired: papers.filter((p) => p.status === 'revision_required').length,
    forwarded: papers.filter((p) =>
      ['pending_editor', 'pending_admin', 'approved', 'published'].includes(p.status),
    ).length,
    total: papers.length,
  }), [papers, pendingStatus]);

  const departmentOptions = useMemo(() => [
    { value: 'all', label: 'All departments' },
    ...Array.from(
      new Map(
        papers.map((paper) => [getDepartmentScopeKey(paper), getDepartmentScopeLabel(paper)]),
      ).entries(),
    ).map(([value, label]) => ({ value, label })),
  ].sort((left, right) => {
    if (left.value === 'all') return -1;
    if (right.value === 'all') return 1;
    return left.label.localeCompare(right.label);
  }), [papers]);

  const filteredPapers = useMemo(() => {
    let filtered = [...papers];

    if (statusFilter === 'needs_review') {
      filtered = papers.filter((p) => p.status === pendingStatus);
    } else if (statusFilter === 'revision_required') {
      filtered = papers.filter((p) => p.status === 'revision_required');
    } else if (statusFilter === 'forwarded') {
      filtered = papers.filter((p) =>
        ['pending_editor', 'pending_admin', 'approved', 'published'].includes(p.status),
      );
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
  }, [papers, statusFilter, searchTerm, departmentFilter, dateFilter, sortBy, pendingStatus]);

  const priorityPaper = useMemo(() => (
    papers.find((p) => p.status === pendingStatus) || null
  ), [papers, pendingStatus]);

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

  const queueItems = [
    {
      key: 'needs_review',
      label: 'Needs your decision',
      description: 'Manuscripts waiting for your sign-off',
      count: stats.pendingReview,
    },
    {
      key: 'revision_required',
      label: 'Sent back for revision',
      description: 'Papers where you requested changes',
      count: stats.revisionRequired,
    },
    {
      key: 'forwarded',
      label: 'Forwarded downstream',
      description: 'Approved and sent to editor or admin',
      count: stats.forwarded,
    },
    {
      key: 'all',
      label: 'All assigned',
      description: 'Complete list in your scope',
      count: stats.total,
    },
  ];

  const advancedFilters = [
    {
      id: 'department-filter',
      label: 'Department',
      value: departmentFilter,
      onChange: setDepartmentFilter,
      options: departmentOptions,
    },
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
        <p className="mt-5 text-sm font-medium text-slate-500">Loading review queue…</p>
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
    onOpen: () => navigate(`${reviewBasePath}/${paper.id}`),
  }));

  const RoleIcon = isDean ? Award : Users;

  return (
    <ReviewWorkspaceLayout
      breadcrumbs={[
        { label: 'Dashboard', path: '/dashboard' },
        { label: isDean ? 'Dean review queue' : 'Program chair review queue' },
      ]}
      roleLabel={isDean ? 'Dean of College' : 'Program Chair'}
      title={isDean ? 'Dean Review Queue' : 'Program Chair Review Queue'}
      subtitle="Review manuscripts forwarded by faculty advisers before they proceed to editorial review."
      badge={(
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#3674B5]/10 border border-[#3674B5]/20 text-[#3674B5] text-[11px] font-semibold">
          <RoleIcon size={11} aria-hidden="true" /> {isDean ? 'Dean' : 'Program Chair'}
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
      priorityBanner={priorityPaper && statusFilter === 'needs_review' ? (
        <PriorityBanner
          label="Manuscript awaiting your review"
          title={priorityPaper.title}
          action={(
            <button
              type="button"
              onClick={() => navigate(`${reviewBasePath}/${priorityPaper.id}`)}
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
      emptyDescription="Select a different queue from the left panel or adjust your search."
      submissions={submissions}
      pageSize={PAGE_SIZE}
    />
  );
};

export default DeanChairReview;
