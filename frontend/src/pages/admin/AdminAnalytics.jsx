import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Download,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  Award,
  Activity,
  Calendar,
  ChevronRight,
  RefreshCw,
  BookOpen,
  Shield,
  FileDown,
  FileSpreadsheet,
  AlertTriangle,
  Percent,
  ChevronDown,
} from 'lucide-react';
import { researchAPI, authAPI, unwrapApiData } from '../../utils/api';
import { formatFullName } from '../../utils/names';
import UserGuideLink from '../../components/ui/UserGuideLink';
import { reviewStatusLabel, reviewStatusTone } from '../../components/review/reviewStatus';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ANALYTICS_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'trends', label: 'Trends' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'users', label: 'Users' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'papers', label: 'Papers' },
];

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = searchParams.get('section') || 'overview';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [error, setError] = useState(null);
  const [downloadLoading, setDownloadLoading] = useState('');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [activeChart, setActiveChart] = useState('submissions');
  const [hoveredBar, setHoveredBar] = useState(null);
  const downloadRef = useRef(null);

  const [papers, setPapers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [categoryLookup, setCategoryLookup] = useState([]);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      setLoading(true);
      setError(null);
      const [papersRes, usersRes, categoriesRes] = await Promise.all([
        researchAPI.adminGetAllResearch(),
        authAPI.getAllUsers(),
        researchAPI.getCategories(),
      ]);
      const allPapers = unwrapApiData(papersRes).papers || [];
      setPapers(allPapers.filter((paper) => !paper.deleted_at));
      setAllUsers(unwrapApiData(usersRes).users || []);
      setCategoryLookup(unwrapApiData(categoriesRes).categories || []);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError('Failed to load analytics data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const section = searchParams.get('section');
    if (!section || loading) return;
    const timer = setTimeout(() => {
      document.getElementById(`analytics-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => clearTimeout(timer);
  }, [searchParams, loading]);

  // Close download menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (downloadRef.current && !downloadRef.current.contains(e.target)) setShowDownloadMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── All derived stats from real data ──
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Users
  const usersByRole = {
    student: allUsers.filter(u => u.role === 'student').length,
    faculty: allUsers.filter(u => u.role === 'faculty').length,
    staff: allUsers.filter(u => u.role === 'staff').length,
    admin: allUsers.filter(u => u.role === 'admin').length,
    dean: allUsers.filter(u => u.role === 'dean').length,
    program_chair: allUsers.filter(u => u.role === 'program_chair').length,
  };
  const usersThisMonth = allUsers.filter(u => new Date(u.created_at) >= firstOfMonth).length;
  const usersLastMonth = allUsers.filter(u => {
    const d = new Date(u.created_at);
    return d >= firstOfLastMonth && d <= endOfLastMonth;
  }).length;

  const pendingAdmin = papers.filter((p) => p.status === 'pending_admin').length;

  // Papers by status
  const statusGroups = {
    pending: papers.filter(p => ['pending_faculty', 'pending_editor', 'pending_admin'].includes(p.status)).length,
    approved: papers.filter(p => p.status === 'approved').length,
    published: papers.filter(p => p.status === 'published').length,
    rejected: papers.filter(p => p.status === 'rejected').length,
    revision: papers.filter(p => p.status === 'revision_required').length,
  };

  const papersThisMonth = papers.filter(p => new Date(p.created_at || p.submission_date) >= firstOfMonth).length;
  const papersLastMonth = papers.filter(p => {
    const d = new Date(p.created_at || p.submission_date);
    return d >= firstOfLastMonth && d <= endOfLastMonth;
  }).length;

  const totalViews = papers.reduce((s, p) => s + (p.view_count || 0), 0);
  const totalDownloads = papers.reduce((s, p) => s + (p.download_count || 0), 0);

  const reviewedPapers = papers.filter(p =>
    ['approved', 'published', 'rejected', 'revision_required'].includes(p.status)
  );
  const approvalRate = reviewedPapers.length > 0
    ? Math.round(((statusGroups.approved + statusGroups.published) / reviewedPapers.length) * 100)
    : 0;

  const avgReviewTime = (() => {
    const reviewed = reviewedPapers.filter(p => p.created_at && p.updated_at);
    if (!reviewed.length) return 0;
    const total = reviewed.reduce((sum, p) => {
      return sum + Math.abs(new Date(p.updated_at) - new Date(p.created_at)) / (1000 * 60 * 60 * 24);
    }, 0);
    return Math.round((total / reviewed.length) * 10) / 10;
  })();

  const getCategoryName = (categoryValue) => {
    if (!categoryValue) return 'Uncategorized';
    const category = categoryLookup.find((entry) => entry.id === categoryValue);
    if (category) return category.name;
    if (typeof categoryValue === 'string' && !UUID_PATTERN.test(categoryValue)) return categoryValue;
    return 'Uncategorized';
  };

  // Category distribution
  const categoryMap = papers.reduce((acc, p) => {
    const cat = getCategoryName(p.category);
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  const categories = Object.entries(categoryMap)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({ name, count, pct: papers.length > 0 ? Math.round((count / papers.length) * 100) : 0 }));

  // Monthly trend data (last 6 months)
  const monthlyData = (() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const label = d.toLocaleDateString('en-US', { month: 'short' });

      const monthPapers = papers.filter(p => {
        const pd = new Date(p.created_at || p.submission_date);
        return pd >= d && pd <= end;
      });
      const monthUsers = allUsers.filter(u => {
        const ud = new Date(u.created_at);
        return ud >= d && ud <= end;
      });

      months.push({
        label,
        submissions: monthPapers.length,
        views: monthPapers.reduce((s, p) => s + (p.view_count || 0), 0),
        downloads: monthPapers.reduce((s, p) => s + (p.download_count || 0), 0),
        users: monthUsers.length,
      });
    }
    return months;
  })();

  // Recent papers
  const recentPapers = [...papers]
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
    .slice(0, 8);

  // Top viewed papers
  const topPapers = [...papers]
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 5);

  // ── Helpers ──
  const pctChange = (curr, prev) => {
    if (prev === 0 && curr === 0) return 0;
    if (prev === 0) return 100;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const papersPctChange = pctChange(papersThisMonth, papersLastMonth);
  const usersPctChange = pctChange(usersThisMonth, usersLastMonth);

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '—';
    const diff = now - new Date(dateStr);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  const getStatusBadge = (status) => {
    const map = {
      pending: { label: 'Pending', cls: 'bg-yellow-100 text-yellow-800' },
      pending_faculty: { label: 'With Faculty', cls: 'bg-yellow-100 text-yellow-800' },
      pending_editor: { label: 'With Editor', cls: 'bg-blue-100 text-blue-800' },
      pending_admin: { label: 'With Admin', cls: 'bg-indigo-100 text-indigo-800' },
      approved: { label: 'Approved', cls: 'bg-green-100 text-green-800' },
      published: { label: 'Published', cls: 'bg-emerald-100 text-emerald-800' },
      rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-800' },
      revision_required: { label: 'Revision', cls: 'bg-orange-100 text-orange-800' },
    };
    return map[status] || { label: status, cls: 'bg-gray-100 text-gray-800' };
  };

  // ── Report Downloads ──
  const downloadReport = async (format) => {
    setDownloadLoading(format);
    setShowDownloadMenu(false);
    try {
      const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
      let content, mimeType, filename;

      if (format === 'csv') {
        content = generateCSV();
        mimeType = 'text/csv;charset=utf-8;';
        filename = `Research_Analytics_Report_${dateStr}.csv`;
      } else if (format === 'json') {
        content = generateJSON();
        mimeType = 'application/json';
        filename = `Research_Analytics_Report_${dateStr}.json`;
      }

      const BOM = '\uFEFF';
      const blob = new Blob([format === 'csv' ? BOM + content : content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloadLoading('');
    }
  };

  const generateCSV = () => {
    const lines = [];
    const sep = ',';

    // Header
    lines.push('RESEARCH REPOSITORY — ANALYTICS REPORT');
    lines.push(`"Generated: ${now.toLocaleString()}"`);
    lines.push('');

    // Summary
    lines.push('SUMMARY STATISTICS');
    lines.push(`Metric${sep}Value`);
    lines.push(`Total Papers${sep}${papers.length}`);
    lines.push(`Total Users${sep}${allUsers.length}`);
    lines.push(`Total Views${sep}${totalViews}`);
    lines.push(`Total Downloads${sep}${totalDownloads}`);
    lines.push(`Approval Rate${sep}${approvalRate}%`);
    lines.push(`Average Review Time${sep}${avgReviewTime} days`);
    lines.push(`Papers This Month${sep}${papersThisMonth}`);
    lines.push(`New Users This Month${sep}${usersThisMonth}`);
    lines.push('');

    // Status breakdown
    lines.push('PAPER STATUS BREAKDOWN');
    lines.push(`Status${sep}Count${sep}Percentage`);
    [
      ['Pending', statusGroups.pending],
      ['Approved', statusGroups.approved],
      ['Published', statusGroups.published],
      ['Revision Required', statusGroups.revision],
      ['Rejected', statusGroups.rejected],
    ].forEach(([label, count]) => {
      const pct = papers.length > 0 ? Math.round((count / papers.length) * 100) : 0;
      lines.push(`${label}${sep}${count}${sep}${pct}%`);
    });
    lines.push('');

    // Users by role
    lines.push('USER DISTRIBUTION BY ROLE');
    lines.push(`Role${sep}Count`);
    lines.push(`Students${sep}${usersByRole.student}`);
    lines.push(`Faculty${sep}${usersByRole.faculty}`);
    lines.push(`Staff${sep}${usersByRole.staff}`);
    lines.push(`Admin${sep}${usersByRole.admin}`);
    lines.push('');

    // Categories
    lines.push('CATEGORY DISTRIBUTION');
    lines.push(`Category${sep}Papers${sep}Percentage`);
    categories.forEach(c => {
      lines.push(`"${c.name}"${sep}${c.count}${sep}${c.pct}%`);
    });
    lines.push('');

    // Monthly trends
    lines.push('MONTHLY TRENDS (Last 6 Months)');
    lines.push(`Month${sep}Submissions${sep}Views${sep}Downloads${sep}New Users`);
    monthlyData.forEach(m => {
      lines.push(`${m.label}${sep}${m.submissions}${sep}${m.views}${sep}${m.downloads}${sep}${m.users}`);
    });
    lines.push('');

    // All papers
    lines.push('ALL RESEARCH PAPERS');
    lines.push(`Title${sep}Author${sep}Category${sep}Status${sep}Views${sep}Downloads${sep}Submitted${sep}Last Updated`);
    papers.forEach(p => {
      lines.push(
        `"${(p.title || '').replace(/"/g, '""')}"${sep}` +
        `"${(formatFullName(p.users) || 'Unknown').replace(/"/g, '""')}"${sep}` +
        `"${getCategoryName(p.category).replace(/"/g, '""')}"${sep}` +
        `${p.status}${sep}` +
        `${p.view_count || 0}${sep}` +
        `${p.download_count || 0}${sep}` +
        `${formatDate(p.created_at || p.submission_date)}${sep}` +
        `${formatDate(p.updated_at)}`
      );
    });

    return lines.join('\n');
  };

  const generateJSON = () => {
    return JSON.stringify({
      report: {
        title: 'Research Repository — Analytics Report',
        generatedAt: now.toISOString(),
      },
      summary: {
        totalPapers: papers.length,
        totalUsers: allUsers.length,
        totalViews,
        totalDownloads,
        approvalRate: `${approvalRate}%`,
        avgReviewTimeDays: avgReviewTime,
        papersThisMonth,
        newUsersThisMonth: usersThisMonth,
      },
      statusBreakdown: statusGroups,
      usersByRole,
      categories: categories.map(c => ({ name: c.name, count: c.count, percentage: `${c.pct}%` })),
      monthlyTrends: monthlyData,
      papers: papers.map(p => ({
        id: p.id,
        title: p.title,
        author: formatFullName(p.users) || 'Unknown',
        category: getCategoryName(p.category),
        status: p.status,
        views: p.view_count || 0,
        downloads: p.download_count || 0,
        submitted: p.created_at || p.submission_date,
        updated: p.updated_at,
      })),
    }, null, 2);
  };

  // ── Chart helpers ──
  const chartFields = {
    submissions: { label: 'Submissions', color: 'from-[#3674B5] to-[#578FCA]' },
    views: { label: 'Views', color: 'from-[#3674B5] to-[#578FCA]' },
    downloads: { label: 'Downloads', color: 'from-[#578FCA] to-[#3674B5]' },
    users: { label: 'New users', color: 'from-[#3674B5]/80 to-[#578FCA]/80' },
  };

  const overviewMetrics = useMemo(() => [
    {
      key: 'papers',
      label: 'Total papers',
      value: papers.length,
      change: papersPctChange,
      sub: `+${papersThisMonth} this month`,
      section: 'pipeline',
    },
    {
      key: 'users',
      label: 'Total users',
      value: allUsers.length,
      change: usersPctChange,
      sub: `+${usersThisMonth} this month`,
      section: 'users',
    },
    {
      key: 'views',
      label: 'Total views',
      value: totalViews,
      sub: `Across ${papers.length} papers`,
      section: 'engagement',
    },
    {
      key: 'downloads',
      label: 'Total downloads',
      value: totalDownloads,
      sub: `Across ${papers.length} papers`,
      section: 'engagement',
    },
  ], [papers.length, allUsers.length, totalViews, totalDownloads, papersPctChange, usersPctChange, papersThisMonth, usersThisMonth]);

  const setSection = (sectionId) => {
    setSearchParams({ section: sectionId });
  };

  const chartData = monthlyData.map(m => m[activeChart]);
  const maxVal = Math.max(...chartData, 1);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] animate-fadeIn">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-200 rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#3674B5] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="mt-4 text-sm text-slate-500">Loading analytics…</p>
      </div>
    );
  }

  const SectionShell = ({ id, title, description, children, action }) => (
    <section id={`analytics-${id}`} className="scroll-mt-28 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fadeIn">
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Analytics</h1>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-sm text-slate-600">
              <Calendar size={14} aria-hidden="true" />
              <span>{new Date().toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
            </div>
            {lastRefreshed && (
              <span className="text-[11px] text-slate-400">
                Updated {lastRefreshed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => fetchData()}
              disabled={refreshing}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
              Refresh
            </button>
            <div className="relative" ref={downloadRef}>
              <button
                type="button"
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-[#3674B5] to-[#578FCA] px-3 text-sm font-semibold text-white shadow-sm"
              >
                <FileDown size={15} aria-hidden="true" />
                Export
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              {showDownloadMenu && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
                  {[
                    { format: 'csv', icon: FileSpreadsheet, label: 'CSV spreadsheet' },
                    { format: 'json', icon: FileText, label: 'JSON data' },
                  ].map(({ format, icon: Icon, label }) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => downloadReport(format)}
                      disabled={!!downloadLoading}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left disabled:opacity-50"
                    >
                      <Icon size={14} className="text-[#3674B5]" aria-hidden="true" />
                      <span className="text-sm font-medium text-slate-900">{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <UserGuideLink />

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-500 shrink-0" aria-hidden="true" />
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button type="button" onClick={() => fetchData()} className="text-sm font-semibold text-red-700">Retry</button>
          </div>
        )}

        <nav aria-label="Analytics sections" className="mb-5 sm:mb-6 -mx-1 overflow-x-auto">
          <div className="flex gap-2 px-1 pb-1 min-w-max">
            {ANALYTICS_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setSection(section.id)}
                className={`rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-colors ${
                  activeSection === section.id
                    ? 'bg-[#3674B5] text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-[#3674B5]/30 hover:text-[#3674B5]'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="space-y-5 sm:space-y-6">
          <SectionShell id="overview" title="Overview" description="Key metrics aligned with your admin dashboard">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
              {overviewMetrics.map((metric) => (
                <button
                  key={metric.key}
                  type="button"
                  onClick={() => setSection(metric.section)}
                  className="text-left rounded-xl border border-slate-100 bg-slate-50/50 p-4 hover:border-[#3674B5]/25 hover:bg-white transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-xs font-medium text-slate-500">{metric.label}</p>
                    {metric.change !== undefined && (
                      <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
                        metric.change >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {metric.change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {metric.change >= 0 ? '+' : ''}{metric.change}%
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">{metric.value.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-1">{metric.sub}</p>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Percent size={16} className="text-emerald-600" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-900">Approval rate</p>
                </div>
                <p className="text-2xl font-bold text-slate-900">{approvalRate}%</p>
                <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#3674B5] to-[#578FCA]" style={{ width: `${approvalRate}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={16} className="text-[#3674B5]" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-900">Avg. review time</p>
                </div>
                <p className="text-2xl font-bold text-slate-900">{avgReviewTime > 0 ? `${avgReviewTime}d` : '—'}</p>
                <p className="text-xs text-slate-500 mt-1">{reviewedPapers.length} reviewed papers</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/papers')}
                className="rounded-xl border border-slate-100 p-4 text-left hover:border-[#3674B5]/25 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={16} className="text-amber-600" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-900">Final approval queue</p>
                </div>
                <p className="text-2xl font-bold text-slate-900">{pendingAdmin}</p>
                <p className="text-xs text-[#3674B5] mt-1 font-semibold">Open queue →</p>
              </button>
            </div>
          </SectionShell>

          <SectionShell
            id="trends"
            title="Monthly trends"
            description="Last 6 months — switch metric below"
            action={(
              <div className="flex flex-wrap gap-1">
                {Object.entries(chartFields).map(([key, { label }]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveChart(key)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                      activeChart === key ? 'bg-[#3674B5] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          >
            <div className="flex items-end gap-2 h-44 sm:h-52">
              {monthlyData.map((m, i) => {
                const val = m[activeChart];
                const heightPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                    <span className="text-[10px] font-semibold text-slate-500 tabular-nums">{val}</span>
                    <div
                      className={`w-full rounded-t bg-gradient-to-t ${chartFields[activeChart].color} transition-all duration-300`}
                      style={{ height: `${Math.max(heightPct, val > 0 ? 6 : 2)}%` }}
                      title={`${m.label}: ${val}`}
                    />
                    <span className="text-[10px] text-slate-400">{m.label}</span>
                  </div>
                );
              })}
            </div>
          </SectionShell>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-6">
            <SectionShell id="pipeline" title="Paper pipeline" description={`${papers.length} manuscripts in system`}>
              <div className="space-y-3">
                {[
                  { label: 'Pending review', count: statusGroups.pending, tone: 'bg-amber-500' },
                  { label: 'Approved', count: statusGroups.approved, tone: 'bg-emerald-500' },
                  { label: 'Published', count: statusGroups.published, tone: 'bg-emerald-600' },
                  { label: 'Revision required', count: statusGroups.revision, tone: 'bg-orange-500' },
                  { label: 'Rejected', count: statusGroups.rejected, tone: 'bg-rose-500' },
                ].map((item) => {
                  const pct = papers.length > 0 ? Math.round((item.count / papers.length) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700">{item.label}</span>
                        <span className="font-semibold text-slate-900 tabular-nums">{item.count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${item.tone}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/papers')}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#3674B5] hover:text-[#2d6299]"
              >
                Manage final approval <ChevronRight size={14} aria-hidden="true" />
              </button>
            </SectionShell>

            <SectionShell id="users" title="Users by role" description={`${allUsers.length} registered accounts`}>
              <ul className="space-y-3">
                {[
                  { label: 'Students', count: usersByRole.student },
                  { label: 'Faculty', count: usersByRole.faculty },
                  { label: 'Staff', count: usersByRole.staff },
                  { label: 'Deans', count: usersByRole.dean },
                  { label: 'Program chairs', count: usersByRole.program_chair },
                  { label: 'Admins', count: usersByRole.admin },
                ].map((row) => {
                  const pct = allUsers.length > 0 ? Math.round((row.count / allUsers.length) * 100) : 0;
                  return (
                    <li key={row.label}>
                      <button
                        type="button"
                        onClick={() => navigate('/admin/users')}
                        className="w-full text-left"
                      >
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-700">{row.label}</span>
                          <span className="font-semibold text-slate-900">{row.count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#3674B5] to-[#578FCA]" style={{ width: `${Math.max(pct, row.count ? 4 : 0)}%` }} />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={() => navigate('/admin/users')}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#3674B5] hover:text-[#2d6299]"
              >
                Open user management <ChevronRight size={14} aria-hidden="true" />
              </button>
            </SectionShell>
          </div>

          <SectionShell id="engagement" title="Engagement & categories" description="Repository usage and topic distribution">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Top viewed papers</h3>
                {topPapers.length === 0 ? (
                  <p className="text-sm text-slate-500">No view data yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                    {topPapers.map((paper, i) => (
                      <li key={paper.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/research/${paper.id}`)}
                          className="w-full text-left px-3 py-3 hover:bg-slate-50 flex items-start gap-3"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#3674B5]/10 text-[11px] font-bold text-[#3674B5]">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-slate-900 line-clamp-1">{paper.title}</span>
                            <span className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                              <span className="inline-flex items-center gap-1"><Eye size={11} /> {paper.view_count || 0}</span>
                              <span className="inline-flex items-center gap-1"><Download size={11} /> {paper.download_count || 0}</span>
                            </span>
                          </span>
                          <ChevronRight size={14} className="text-slate-300 shrink-0 mt-1" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Categories</h3>
                {categories.length === 0 ? (
                  <p className="text-sm text-slate-500">No category data.</p>
                ) : (
                  <ul className="space-y-3">
                    {categories.slice(0, 6).map((cat) => (
                      <li key={cat.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-700 truncate mr-2">{cat.name}</span>
                          <span className="font-semibold text-slate-900 shrink-0">{cat.count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#3674B5] to-[#578FCA]" style={{ width: `${cat.pct}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </SectionShell>

          <SectionShell
            id="papers"
            title="Recent activity"
            description="Latest manuscript updates"
            action={(
              <button
                type="button"
                onClick={() => navigate('/admin/papers')}
                className="text-xs font-semibold text-[#3674B5] hover:text-[#2d6299]"
              >
                View all
              </button>
            )}
          >
            {recentPapers.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No activity yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                {recentPapers.slice(0, 6).map((paper) => (
                  <button
                    key={paper.id}
                    type="button"
                    onClick={() => navigate(`/admin/review/${paper.id}`)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-start gap-3 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-slate-500" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 line-clamp-1">{paper.title || 'Untitled'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatFullName(paper.users) || 'Unknown'} · {formatRelativeTime(paper.updated_at || paper.created_at)}
                      </p>
                      <span className={`inline-flex mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium border ${reviewStatusTone(paper.status)}`}>
                        {reviewStatusLabel(paper.status)}
                      </span>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 shrink-0 mt-2" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </SectionShell>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
