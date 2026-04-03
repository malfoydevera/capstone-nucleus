import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  GraduationCap,
  Shield,
  FileDown,
  FileSpreadsheet,
  AlertTriangle,
  ArrowUpRight,
  Percent,
  ChevronDown
} from 'lucide-react';
import { researchAPI, authAPI } from '../../utils/api';
import { formatFullName } from '../../utils/names';

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadLoading, setDownloadLoading] = useState('');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [activeChart, setActiveChart] = useState('submissions');
  const [hoveredBar, setHoveredBar] = useState(null);
  const downloadRef = useRef(null);

  const [papers, setPapers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [papersRes, usersRes] = await Promise.all([
        researchAPI.getAllResearch(),
        authAPI.getAllUsers()
      ]);
      setPapers(papersRes.data?.papers || papersRes.data || []);
      setAllUsers(usersRes.data?.users || usersRes.data || []);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError('Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
  };
  const usersThisMonth = allUsers.filter(u => new Date(u.created_at) >= firstOfMonth).length;
  const usersLastMonth = allUsers.filter(u => {
    const d = new Date(u.created_at);
    return d >= firstOfLastMonth && d <= endOfLastMonth;
  }).length;

  // Papers by status
  const statusGroups = {
    pending: papers.filter(p => ['pending', 'pending_faculty', 'pending_editor', 'pending_admin'].includes(p.status)).length,
    underReview: papers.filter(p => p.status === 'under_review').length,
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

  // Category distribution
  const categoryMap = papers.reduce((acc, p) => {
    const cat = p.category || 'Uncategorized';
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
      under_review: { label: 'Under Review', cls: 'bg-blue-100 text-blue-800' },
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
      ['Under Review', statusGroups.underReview],
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
        `"${(p.category || 'N/A').replace(/"/g, '""')}"${sep}` +
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
        category: p.category || 'N/A',
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
    submissions: { label: 'Submissions', color: 'from-[#1C4D8D] to-[#2563eb]', solidColor: '#1C4D8D' },
    views: { label: 'Views', color: 'from-blue-500 to-cyan-500', solidColor: '#3b82f6' },
    downloads: { label: 'Downloads', color: 'from-emerald-500 to-green-500', solidColor: '#10b981' },
    users: { label: 'New Users', color: 'from-violet-500 to-purple-500', solidColor: '#8b5cf6' },
  };

  const chartData = monthlyData.map(m => m[activeChart]);
  const maxVal = Math.max(...chartData, 1);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-[#1C4D8D]/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-[#1C4D8D] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn">
      {/* Header */}
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1C4D8D] to-[#2563eb] flex items-center justify-center shadow-lg">
              <BarChart3 size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
                System Analytics
              </h1>
              <p className="text-lg text-slate-600 font-medium">
                Real-time repository performance &amp; usage metrics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border-2 border-slate-200 text-slate-700 hover:border-[#1C4D8D]/30 transition-all font-medium text-sm"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>

            {/* Download dropdown */}
            <div className="relative" ref={downloadRef}>
              <button
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#1C4D8D] to-[#2563eb] text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-all"
              >
                <FileDown size={16} />
                Download Report
                <ChevronDown size={14} />
              </button>
              {showDownloadMenu && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl border-2 border-slate-200 shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Export Format</p>
                  </div>
                  {[
                    { format: 'csv', icon: FileSpreadsheet, label: 'CSV Spreadsheet', desc: 'Open in Excel / Sheets' },
                    { format: 'json', icon: FileText, label: 'JSON Data', desc: 'Raw structured data' },
                  ].map(({ format, icon: Icon, label, desc }) => (
                    <button
                      key={format}
                      onClick={() => downloadReport(format)}
                      disabled={!!downloadLoading}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left disabled:opacity-50"
                    >
                      {downloadLoading === format ? (
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                          <RefreshCw size={14} className="animate-spin text-slate-500" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1C4D8D]/10 to-[#2563eb]/10 flex items-center justify-center">
                          <Icon size={14} className="text-[#1C4D8D]" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{label}</p>
                        <p className="text-xs text-slate-500">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-8 p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-center gap-3">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm font-medium flex-1">{error}</p>
          <button onClick={fetchData} className="text-red-600 hover:text-red-800 text-sm font-bold underline">Retry</button>
        </div>
      )}

      {/* ── Key Metrics ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          {
            label: 'Total Papers',
            value: papers.length,
            change: papersPctChange,
            sub: `+${papersThisMonth} this month`,
            icon: FileText,
            gradient: 'from-blue-500 to-cyan-500',
            bgLight: 'from-blue-50 to-cyan-50',
            border: 'border-blue-200',
          },
          {
            label: 'Total Users',
            value: allUsers.length,
            change: usersPctChange,
            sub: `+${usersThisMonth} this month`,
            icon: Users,
            gradient: 'from-[#1C4D8D] to-[#2563eb]',
            bgLight: 'from-indigo-50 to-blue-50',
            border: 'border-indigo-200',
          },
          {
            label: 'Total Views',
            value: totalViews,
            sub: `Across ${papers.length} papers`,
            icon: Eye,
            gradient: 'from-emerald-500 to-green-500',
            bgLight: 'from-emerald-50 to-green-50',
            border: 'border-emerald-200',
          },
          {
            label: 'Total Downloads',
            value: totalDownloads,
            sub: `Across ${papers.length} papers`,
            icon: Download,
            gradient: 'from-violet-500 to-purple-500',
            bgLight: 'from-violet-50 to-purple-50',
            border: 'border-violet-200',
          },
        ].map((metric, i) => {
          const Icon = metric.icon;
          return (
            <div key={i} className={`bg-gradient-to-br ${metric.bgLight} rounded-2xl border-2 ${metric.border} p-6 shadow-lg transform transition-all duration-300 hover:scale-105`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${metric.gradient} flex items-center justify-center shadow-md`}>
                  <Icon size={24} className="text-white" />
                </div>
                {metric.change !== undefined && (
                  <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                    metric.change >= 0
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {metric.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {metric.change >= 0 ? '+' : ''}{metric.change}%
                  </span>
                )}
              </div>
              <p className="text-4xl font-black text-slate-900 mb-1">{metric.value.toLocaleString()}</p>
              <p className="text-sm font-semibold text-slate-700">{metric.label}</p>
              <p className="text-xs text-slate-500 mt-1">{metric.sub}</p>
            </div>
          );
        })}
      </div>

      {/* ── Performance Indicators ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
              <Percent size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600">Approval Rate</p>
              <p className="text-3xl font-black text-slate-900">{approvalRate}%</p>
            </div>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-700" style={{ width: `${approvalRate}%` }}></div>
          </div>
          <p className="text-xs text-slate-500 mt-2">{statusGroups.approved + statusGroups.published} approved out of {reviewedPapers.length} reviewed</p>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
              <Clock size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600">Avg. Review Time</p>
              <p className="text-3xl font-black text-slate-900">{avgReviewTime > 0 ? `${avgReviewTime}d` : '—'}</p>
            </div>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-700" style={{ width: `${Math.min(avgReviewTime * 5, 100)}%` }}></div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Based on {reviewedPapers.length} reviewed papers</p>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
              <Activity size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600">Submissions / Month</p>
              <p className="text-3xl font-black text-slate-900">{papersThisMonth}</p>
            </div>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-700" style={{ width: `${Math.min(papersThisMonth * 10, 100)}%` }}></div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {papersPctChange >= 0 ? `+${papersPctChange}%` : `${papersPctChange}%`} vs last month ({papersLastMonth})
          </p>
        </div>
      </div>

      {/* ── Charts + Sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        {/* Bar Chart */}
        <div className="lg:col-span-2 bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1C4D8D]/10 to-[#2563eb]/10 flex items-center justify-center">
                <BarChart3 size={20} className="text-[#1C4D8D]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Monthly Trends</h3>
                <p className="text-sm text-slate-500">Last 6 months</p>
              </div>
            </div>
            <div className="flex gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
              {Object.entries(chartFields).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => setActiveChart(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeChart === key
                      ? 'bg-gradient-to-r from-[#1C4D8D] to-[#2563eb] text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* Y-axis labels + bars */}
            <div className="flex gap-4">
              {/* Y axis */}
              <div className="flex flex-col justify-between h-56 text-xs text-slate-400 font-medium py-1 w-8 text-right">
                <span>{maxVal}</span>
                <span>{Math.round(maxVal * 0.75)}</span>
                <span>{Math.round(maxVal * 0.5)}</span>
                <span>{Math.round(maxVal * 0.25)}</span>
                <span>0</span>
              </div>

              {/* Bars */}
              <div className="flex-1 flex items-end gap-3 h-56 border-l border-b border-slate-200 pl-2 pb-1 relative">
                {/* Horizontal grid lines */}
                {[0.25, 0.5, 0.75, 1].map((pct) => (
                  <div
                    key={pct}
                    className="absolute left-0 right-0 border-t border-dashed border-slate-100"
                    style={{ bottom: `${pct * 100}%` }}
                  />
                ))}

                {monthlyData.map((m, i) => {
                  const val = m[activeChart];
                  const heightPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                  const isHovered = hoveredBar === i;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center relative">
                      {/* Tooltip */}
                      {isHovered && (
                        <div className="absolute -top-10 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg z-10 whitespace-nowrap">
                          {val.toLocaleString()} {chartFields[activeChart].label.toLowerCase()}
                          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                        </div>
                      )}
                      <div
                        className={`w-full rounded-t-lg bg-gradient-to-t ${chartFields[activeChart].color} transition-all duration-500 cursor-pointer ${isHovered ? 'opacity-100 shadow-lg' : 'opacity-80 hover:opacity-100'}`}
                        style={{ height: `${heightPct}%`, minHeight: val > 0 ? '4px' : '0px' }}
                        onMouseEnter={() => setHoveredBar(i)}
                        onMouseLeave={() => setHoveredBar(null)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            {/* X-axis labels */}
            <div className="flex gap-3 ml-12 mt-2">
              {monthlyData.map((m, i) => (
                <div key={i} className="flex-1 text-center text-xs font-semibold text-slate-500">{m.label}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1C4D8D]/10 to-[#2563eb]/10 flex items-center justify-center">
                <Award size={20} className="text-[#1C4D8D]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Paper Status</h3>
                <p className="text-sm text-slate-500">{papers.length} total</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-3">
            {[
              { label: 'Pending', count: statusGroups.pending, gradient: 'from-yellow-500 to-amber-500', bg: 'bg-yellow-50' },
              { label: 'Under Review', count: statusGroups.underReview, gradient: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50' },
              { label: 'Approved', count: statusGroups.approved, gradient: 'from-green-500 to-emerald-500', bg: 'bg-green-50' },
              { label: 'Published', count: statusGroups.published, gradient: 'from-emerald-600 to-teal-600', bg: 'bg-emerald-50' },
              { label: 'Revision', count: statusGroups.revision, gradient: 'from-amber-500 to-orange-500', bg: 'bg-amber-50' },
              { label: 'Rejected', count: statusGroups.rejected, gradient: 'from-red-500 to-rose-500', bg: 'bg-red-50' },
            ].map((item, i) => {
              const pct = papers.length > 0 ? Math.round((item.count / papers.length) * 100) : 0;
              return (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                    <span className="text-sm font-bold text-slate-900">{item.count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${item.gradient} transition-all duration-700`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Categories + Users ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        {/* Categories */}
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1C4D8D]/10 to-[#2563eb]/10 flex items-center justify-center">
              <BookOpen size={20} className="text-[#1C4D8D]" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Categories</h2>
          </div>

          {categories.length === 0 ? (
            <p className="text-center text-slate-400 py-8">No category data</p>
          ) : (
            <div className="space-y-3">
              {categories.slice(0, 6).map((cat, i) => {
                const colors = [
                  'from-blue-500 to-cyan-500',
                  'from-emerald-500 to-green-500',
                  'from-violet-500 to-purple-500',
                  'from-[#1C4D8D] to-[#2563eb]',
                  'from-amber-500 to-orange-500',
                  'from-red-500 to-pink-500',
                ];
                return (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold text-slate-700 truncate mr-3">{cat.name}</span>
                      <span className="text-sm font-bold text-slate-900 flex-shrink-0">{cat.count} <span className="text-slate-400 font-normal">({cat.pct}%)</span></span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full bg-gradient-to-r ${colors[i % colors.length]} transition-all duration-700`} style={{ width: `${cat.pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Users by Role */}
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1C4D8D]/10 to-[#2563eb]/10 flex items-center justify-center">
              <Users size={20} className="text-[#1C4D8D]" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Users by Role</h2>
          </div>

          <div className="space-y-4">
            {[
              { role: 'Students', count: usersByRole.student, icon: BookOpen, gradient: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50' },
              { role: 'Faculty', count: usersByRole.faculty, icon: GraduationCap, gradient: 'from-violet-500 to-purple-500', bg: 'bg-violet-50' },
              { role: 'Staff', count: usersByRole.staff, icon: Award, gradient: 'from-cyan-500 to-teal-500', bg: 'bg-cyan-50' },
              { role: 'Admins', count: usersByRole.admin, icon: Shield, gradient: 'from-red-500 to-rose-500', bg: 'bg-red-50' },
            ].map((item, i) => {
              const Icon = item.icon;
              const pct = allUsers.length > 0 ? Math.round((item.count / allUsers.length) * 100) : 0;
              return (
                <div key={i} className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={20} className="text-slate-700" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold text-slate-700">{item.role}</span>
                      <span className="text-sm font-bold text-slate-900">{item.count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full bg-gradient-to-r ${item.gradient} transition-all duration-700`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="pt-3 mt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-500 font-medium">Total</span>
              <span className="text-lg font-bold text-slate-900">{allUsers.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Top Papers + Recent Activity ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Top Viewed Papers */}
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1C4D8D]/10 to-[#2563eb]/10 flex items-center justify-center">
                <TrendingUp size={20} className="text-[#1C4D8D]" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Top Papers</h2>
            </div>
          </div>

          {topPapers.length === 0 ? (
            <p className="text-center text-slate-400 py-8">No view data yet</p>
          ) : (
            <div className="space-y-3">
              {topPapers.map((paper, i) => (
                <div
                  key={paper.id || i}
                  onClick={() => navigate(`/research/${paper.id}`)}
                  className="p-4 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-[#1C4D8D]/30 cursor-pointer transition-all duration-300 group"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1C4D8D] to-[#2563eb] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 group-hover:text-[#1C4D8D] transition-colors line-clamp-1">{paper.title}</p>
                      <p className="text-xs text-slate-500 mt-1">{formatFullName(paper.users) || 'Unknown'}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Eye size={12} /> {(paper.view_count || 0).toLocaleString()}</span>
                        <span className="flex items-center gap-1"><Download size={12} /> {(paper.download_count || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-[#1C4D8D] group-hover:translate-x-1 transition-all mt-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1C4D8D]/10 to-[#2563eb]/10 flex items-center justify-center">
                <Clock size={20} className="text-[#1C4D8D]" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Recent Activity</h2>
            </div>
            <button
              onClick={() => navigate('/admin/papers')}
              className="text-[#1C4D8D] hover:text-[#163a6b] font-semibold flex items-center gap-1 text-sm transition-colors"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>

          {recentPapers.length === 0 ? (
            <p className="text-center text-slate-400 py-8">No activity yet</p>
          ) : (
            <div className="space-y-2">
              {recentPapers.map((paper, i) => {
                const badge = getStatusBadge(paper.status);
                return (
                  <div
                    key={paper.id || i}
                    onClick={() => navigate(`/research/${paper.id}`)}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {paper.status === 'approved' || paper.status === 'published'
                        ? <CheckCircle size={14} className="text-green-500" />
                        : paper.status === 'rejected'
                        ? <XCircle size={14} className="text-red-500" />
                        : <FileText size={14} className="text-blue-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{paper.title || 'Untitled'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatFullName(paper.users) || 'Unknown'} · {formatRelativeTime(paper.updated_at || paper.created_at)}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full whitespace-nowrap ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
