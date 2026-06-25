import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  ChevronRight,
  RefreshCw,
  Calendar,
  Search,
  Users,
  BookOpen,
} from 'lucide-react';
import { researchAPI, unwrapApiData } from '../../utils/api';
import { formatFullName } from '../../utils/names';
import UserGuideLink from '../../components/ui/UserGuideLink';
import { reviewStatusLabel, reviewStatusTone } from '../../components/review/reviewStatus';

const POLL_MS = 10000;
const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

const formatDate = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

const CompactMonthlyChart = ({ data, year, onYearChange }) => {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const currentMonth = new Date().getMonth();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900 text-sm">Submissions</h2>
        <select
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
          className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30"
          aria-label="Select year"
        >
          {[2026, 2025, 2024].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-1 h-20 px-4 sm:px-5 py-4">
        {data.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div
              className={`w-full rounded-t transition-all ${
                index === currentMonth && year === new Date().getFullYear()
                  ? 'bg-gradient-to-t from-[#3674B5] to-[#578FCA]'
                  : 'bg-[#3674B5]/20'
              }`}
              style={{ height: `${Math.max((item.value / maxValue) * 48, item.value > 0 ? 4 : 2)}px` }}
              title={`${item.value} submission${item.value !== 1 ? 's' : ''}`}
            />
            <span className="text-[9px] text-slate-400">{MONTH_LABELS[index]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const StaffDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allPapers, setAllPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const fetchDashboardData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await researchAPI.getAllResearch();
      setAllPapers(unwrapApiData(response).papers || []);
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => fetchDashboardData(true), POLL_MS);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const stats = useMemo(() => ({
    needsReview: allPapers.filter((p) => p.status === 'pending_editor').length,
    withAdmin: allPapers.filter((p) => p.status === 'pending_admin').length,
    approved: allPapers.filter((p) => p.status === 'approved' || p.status === 'published').length,
    revisionRequired: allPapers.filter((p) => p.status === 'revision_required').length,
    rejected: allPapers.filter((p) => p.status === 'rejected').length,
    total: allPapers.length,
    thisMonth: allPapers.filter((p) => {
      const d = new Date(p.created_at || p.submission_date);
      const now = new Date();
      return !Number.isNaN(d.getTime())
        && d.getMonth() === now.getMonth()
        && d.getFullYear() === now.getFullYear();
    }).length,
  }), [allPapers]);

  const uniqueResearchers = useMemo(
    () => new Set(allPapers.map((p) => p.author_id || p.users?.id).filter(Boolean)).size,
    [allPapers],
  );

  const reviewedPapers = stats.approved + stats.rejected + stats.revisionRequired;
  const approvalRate = reviewedPapers > 0 ? Math.round((stats.approved / reviewedPapers) * 100) : 0;

  const recentPapers = useMemo(() => {
    const priority = (status) => {
      if (status === 'pending_editor') return 0;
      if (status === 'pending_admin') return 1;
      if (status === 'revision_required') return 2;
      return 3;
    };
    return [...allPapers]
      .sort((a, b) => {
        const p = priority(a.status) - priority(b.status);
        if (p !== 0) return p;
        return new Date(b.updated_at || b.submission_date || b.created_at)
          - new Date(a.updated_at || a.submission_date || a.created_at);
      })
      .slice(0, 5);
  }, [allPapers]);

  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({ month: i, value: 0 }));
    allPapers.forEach((paper) => {
      const date = new Date(paper.submission_date || paper.created_at);
      if (date.getFullYear() === selectedYear) {
        months[date.getMonth()].value += 1;
      }
    });
    return months;
  }, [allPapers, selectedYear]);

  const taskCards = useMemo(() => [
    {
      key: 'review',
      label: 'Needs your review',
      count: stats.needsReview,
      icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      description: stats.needsReview > 0 ? 'Editorial queue' : 'All caught up',
      onClick: () => navigate('/staff/review'),
    },
    {
      key: 'approved',
      label: 'Approved',
      count: stats.approved,
      icon: CheckCircle,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      description: reviewedPapers > 0 ? `${approvalRate}% approval rate` : 'Forwarded or published',
      onClick: () => navigate('/staff/review'),
    },
    {
      key: 'attention',
      label: 'Needs attention',
      count: stats.revisionRequired + stats.withAdmin,
      icon: AlertCircle,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      description: `${stats.withAdmin} with admin · ${stats.revisionRequired} revisions`,
      onClick: () => navigate('/staff/review'),
    },
  ], [stats, approvalRate, reviewedPapers, navigate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] animate-fadeIn">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-200 rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#3674B5] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="mt-4 text-sm text-slate-500">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fadeIn">
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Dashboard</h1>
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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fetchDashboardData()}
              disabled={refreshing}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
              Refresh
            </button>
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'Staff')}&background=3674B5&color=fff`}
              alt=""
              className="w-9 h-9 rounded-full shrink-0"
            />
            <span className="text-sm font-medium text-slate-700 truncate">{user?.fullName}</span>
          </div>
        </div>

        <UserGuideLink />

        <div className="mb-5 sm:mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-[#3674B5]/15 bg-[#3674B5]/5 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#3674B5]/10">
            <BookOpen size={18} className="text-[#3674B5]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#3674B5] uppercase tracking-wide">Editorial review</p>
            <p className="text-sm text-slate-700">Review manuscripts forwarded from program chairs before final admin approval.</p>
          </div>
          <span className="text-xs text-slate-500 shrink-0">{stats.total} total papers</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-5 sm:mb-6">
          {taskCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                type="button"
                onClick={card.onClick}
                className="text-left bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 hover:shadow-md hover:border-[#3674B5]/20 transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-500 mb-1">{card.label}</p>
                    <p className="text-2xl sm:text-3xl font-bold text-slate-900">{card.count}</p>
                    <p className="mt-2 text-xs text-slate-400 truncate">{card.description}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl shrink-0 ${card.iconBg} flex items-center justify-center`}>
                    <Icon size={20} className={card.iconColor} aria-hidden="true" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <button
            type="button"
            onClick={() => navigate('/staff/review')}
            className="group bg-gradient-to-br from-[#3674B5] to-[#578FCA] rounded-xl p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <Eye size={20} className="text-white" aria-hidden="true" />
              </div>
              <div className="text-left min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Review queue</p>
                <p className="text-xs text-blue-100 truncate">
                  {stats.needsReview > 0 ? `${stats.needsReview} pending` : 'Open workspace'}
                </p>
              </div>
              <ChevronRight size={16} className="text-white/70 shrink-0" aria-hidden="true" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/staff/repository')}
            className="group bg-white rounded-xl p-3.5 sm:p-4 shadow-sm border border-slate-100 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <Search size={20} className="text-emerald-600" aria-hidden="true" />
              </div>
              <div className="text-left min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">Repository</p>
                <p className="text-xs text-slate-500">Browse all papers</p>
              </div>
              <ChevronRight size={16} className="text-slate-300 shrink-0" aria-hidden="true" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/staff/review')}
            className="group bg-white rounded-xl p-3.5 sm:p-4 shadow-sm border border-slate-100 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#3674B5]/10 flex items-center justify-center shrink-0">
                <Users size={20} className="text-[#3674B5]" aria-hidden="true" />
              </div>
              <div className="text-left min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">Researchers</p>
                <p className="text-xs text-slate-500">{uniqueResearchers} active contributors</p>
              </div>
              <ChevronRight size={16} className="text-slate-300 shrink-0" aria-hidden="true" />
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 sm:gap-6">
          <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-900">Recent manuscripts</h2>
              <button
                type="button"
                onClick={() => navigate('/staff/review')}
                className="text-xs font-semibold text-[#3674B5] hover:text-[#2d6299]"
              >
                View all
              </button>
            </div>

            {recentPapers.length === 0 ? (
              <div className="px-4 sm:px-5 py-10 text-center">
                <FileText size={28} className="mx-auto text-slate-300 mb-3" aria-hidden="true" />
                <p className="text-sm text-slate-500">No submissions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentPapers.map((paper) => (
                  <button
                    key={paper.id}
                    type="button"
                    onClick={() => navigate(`/staff/review/${paper.id}`)}
                    className="w-full text-left px-4 sm:px-5 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText size={16} className="text-slate-500" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 line-clamp-2">{paper.title || 'Untitled'}</p>
                        <p className="text-xs text-slate-500 mt-1 truncate">
                          {formatFullName(paper.users) || 'Unknown author'} · {formatDate(paper.submission_date || paper.created_at)}
                        </p>
                        <span className={`inline-flex mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium border ${reviewStatusTone(paper.status)}`}>
                          {reviewStatusLabel(paper.status)}
                        </span>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 shrink-0 mt-1" aria-hidden="true" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-5 sm:space-y-6">
            <CompactMonthlyChart
              data={monthlyData}
              year={selectedYear}
              onYearChange={setSelectedYear}
            />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900 text-sm">Workflow summary</h2>
              </div>
              <dl className="divide-y divide-slate-100">
                <div className="flex items-center justify-between px-4 sm:px-5 py-3">
                  <dt className="text-xs text-slate-500">With editor (you)</dt>
                  <dd className="text-sm font-semibold text-slate-900 tabular-nums">{stats.needsReview}</dd>
                </div>
                <div className="flex items-center justify-between px-4 sm:px-5 py-3">
                  <dt className="text-xs text-slate-500">With admin</dt>
                  <dd className="text-sm font-semibold text-slate-900 tabular-nums">{stats.withAdmin}</dd>
                </div>
                <div className="flex items-center justify-between px-4 sm:px-5 py-3">
                  <dt className="text-xs text-slate-500">This month</dt>
                  <dd className="text-sm font-semibold text-slate-900 tabular-nums">{stats.thisMonth}</dd>
                </div>
                <div className="flex items-center justify-between px-4 sm:px-5 py-3">
                  <dt className="text-xs text-slate-500">Approval rate</dt>
                  <dd className="text-sm font-semibold text-emerald-600 tabular-nums">{approvalRate}%</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
