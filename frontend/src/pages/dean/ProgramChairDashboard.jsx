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
  Bell,
  Tag,
} from 'lucide-react';
import { researchAPI, unwrapApiData } from '../../utils/api';
import { formatFullName } from '../../utils/names';
import UserGuideLink from '../../components/ui/UserGuideLink';
import { reviewStatusLabel, reviewStatusTone } from '../../components/review/reviewStatus';

const DEADLINE_TONE = {
  overdue: {
    icon: AlertCircle,
    iconWrap: 'bg-rose-100 text-rose-700',
    dot: 'bg-rose-500',
  },
  due_soon: {
    icon: Bell,
    iconWrap: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
  },
};

const DeadlineNotificationList = ({ items, onOpen }) => {
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="pc-deadlines-heading"
      className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
    >
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h2 id="pc-deadlines-heading" className="font-semibold text-slate-900 text-sm">
            Review deadlines
          </h2>
          <span className="rounded-full bg-[#3674B5] px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">
            {items.length}
          </span>
        </div>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map((item) => {
          const tone = DEADLINE_TONE[item.type] || DEADLINE_TONE.due_soon;
          const Icon = tone.icon;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="w-full flex items-start gap-3 px-4 sm:px-5 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone.iconWrap}`}>
                  <Icon size={15} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
                    <span className="text-sm font-medium text-slate-900 line-clamp-1">{item.title}</span>
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5 line-clamp-2">{item.message}</span>
                </span>
                <ChevronRight size={14} className="text-slate-300 shrink-0 mt-2" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const POLL_MS = 10000;

const formatDate = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

const ProgramChairDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [programScope, setProgramScope] = useState('');
  const [topKeywords, setTopKeywords] = useState([]);
  const [stats, setStats] = useState({
    total: 0, pending: 0, approved: 0, rejected: 0, revisionRequired: 0, thisMonth: 0,
  });
  const [deadlineSummary, setDeadlineSummary] = useState({ totalWithDeadline: 0, overdueCount: 0, dueSoonCount: 0 });
  const [deadlineItems, setDeadlineItems] = useState([]);
  const [recentPapers, setRecentPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchDashboardData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [response, deadlinesResponse] = await Promise.all([
        researchAPI.getProgramChairAnalytics(),
        researchAPI.getProgramChairDeadlines(),
      ]);
      const payload = unwrapApiData(response);
      const deadlinesPayload = unwrapApiData(deadlinesResponse);
      const papers = payload.papers || [];

      setProgramScope(payload.program?.program || payload.program?.department || 'Unassigned Program');
      setTopKeywords(payload.topKeywords || []);
      setStats(payload.summary || {
        total: 0, pending: 0, approved: 0, rejected: 0, revisionRequired: 0, thisMonth: 0,
      });
      setDeadlineSummary(deadlinesPayload.summary || { totalWithDeadline: 0, overdueCount: 0, dueSoonCount: 0 });
      setDeadlineItems([...(deadlinesPayload.overdue || []), ...(deadlinesPayload.upcoming || [])].slice(0, 6));

      const priority = (status) => {
        if (status === 'pending_program_chair') return 0;
        if (status === 'revision_required') return 1;
        return 2;
      };
      const sortedPapers = [...papers].sort((a, b) => {
        const p = priority(a.status) - priority(b.status);
        if (p !== 0) return p;
        return new Date(b.updated_at || b.submission_date || b.created_at)
          - new Date(a.updated_at || a.submission_date || a.created_at);
      });
      setRecentPapers(sortedPapers.slice(0, 5));
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

  const reviewedPapers = stats.approved + stats.rejected + stats.revisionRequired;
  const approvalRate = reviewedPapers > 0 ? Math.round((stats.approved / reviewedPapers) * 100) : 0;
  const deadlineRiskCount = deadlineSummary.overdueCount + deadlineSummary.dueSoonCount;

  const deadlineNotifications = useMemo(() => (
    deadlineItems.slice(0, 4).map((paper) => {
      const overdue = (paper.hoursUntilDeadline || 0) <= 0;
      return {
        id: paper.id,
        type: overdue ? 'overdue' : 'due_soon',
        researchId: paper.id,
        title: paper.title || 'Untitled manuscript',
        message: overdue
          ? `Overdue by ${Math.abs(paper.hoursUntilDeadline)}h · Due ${formatDate(paper.review_deadline_at)}`
          : `${paper.hoursUntilDeadline}h remaining · Due ${formatDate(paper.review_deadline_at)}`,
      };
    })
  ), [deadlineItems]);

  const taskCards = useMemo(() => [
    {
      key: 'pending',
      label: 'Needs your review',
      count: stats.pending,
      icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      description: stats.pending > 0
        ? deadlineRiskCount > 0
          ? `${deadlineRiskCount} deadline alert${deadlineRiskCount !== 1 ? 's' : ''}`
          : 'Awaiting your decision'
        : 'All caught up',
      onClick: () => navigate('/program-chair/review'),
    },
    {
      key: 'approved',
      label: 'Approved',
      count: stats.approved,
      icon: CheckCircle,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      description: reviewedPapers > 0 ? `${approvalRate}% approval rate` : 'Forwarded to editor',
      onClick: () => navigate('/program-chair/review'),
    },
    {
      key: 'revision',
      label: 'Revisions sent',
      count: stats.revisionRequired,
      icon: AlertCircle,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      description: `${stats.total} total in program scope`,
      onClick: () => navigate('/program-chair/review'),
    },
  ], [stats, deadlineRiskCount, approvalRate, reviewedPapers, navigate]);

  const handleOpenDeadline = (item) => {
    if (item.researchId) {
      navigate(`/program-chair/review/${item.researchId}`);
    }
  };

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
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'Program Chair')}&background=3674B5&color=fff`}
              alt=""
              className="w-9 h-9 rounded-full shrink-0"
            />
            <span className="text-sm font-medium text-slate-700 truncate">{user?.fullName}</span>
          </div>
        </div>

        <UserGuideLink />

        <div className="mb-5 sm:mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-[#3674B5]/15 bg-[#3674B5]/5 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#3674B5]/10">
            <Users size={18} className="text-[#3674B5]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#3674B5] uppercase tracking-wide">Program scope</p>
            <p className="text-sm font-semibold text-slate-900 truncate">{programScope || 'Unassigned Program'}</p>
          </div>
          <span className="text-xs text-slate-500 shrink-0">{stats.thisMonth} new this month</span>
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
            onClick={() => navigate('/program-chair/review')}
            className="group bg-gradient-to-br from-[#3674B5] to-[#578FCA] rounded-xl p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <Eye size={20} className="text-white" aria-hidden="true" />
              </div>
              <div className="text-left min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Review queue</p>
                <p className="text-xs text-blue-100 truncate">
                  {stats.pending > 0 ? `${stats.pending} pending` : 'Open workspace'}
                </p>
              </div>
              <ChevronRight size={16} className="text-white/70 shrink-0" aria-hidden="true" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/program-chair/repository')}
            className="group bg-white rounded-xl p-3.5 sm:p-4 shadow-sm border border-slate-100 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <Search size={20} className="text-emerald-600" aria-hidden="true" />
              </div>
              <div className="text-left min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">Repository</p>
                <p className="text-xs text-slate-500">Browse program papers</p>
              </div>
              <ChevronRight size={16} className="text-slate-300 shrink-0" aria-hidden="true" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/program-chair/review')}
            className="group bg-white rounded-xl p-3.5 sm:p-4 shadow-sm border border-slate-100 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#3674B5]/10 flex items-center justify-center shrink-0">
                <Clock size={20} className="text-[#3674B5]" aria-hidden="true" />
              </div>
              <div className="text-left min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">Deadlines</p>
                <p className="text-xs text-slate-500">
                  {deadlineRiskCount > 0
                    ? `${deadlineSummary.overdueCount} overdue · ${deadlineSummary.dueSoonCount} due soon`
                    : 'No urgent deadlines'}
                </p>
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
                onClick={() => navigate('/program-chair/review')}
                className="text-xs font-semibold text-[#3674B5] hover:text-[#2d6299]"
              >
                View all
              </button>
            </div>

            {recentPapers.length === 0 ? (
              <div className="px-4 sm:px-5 py-10 text-center">
                <FileText size={28} className="mx-auto text-slate-300 mb-3" aria-hidden="true" />
                <p className="text-sm text-slate-500">No manuscripts in your program scope yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentPapers.map((paper) => (
                  <button
                    key={paper.id}
                    type="button"
                    onClick={() => navigate(`/program-chair/review/${paper.id}`)}
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
            <DeadlineNotificationList
              items={deadlineNotifications}
              onOpen={handleOpenDeadline}
            />

            {topKeywords.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                  <Tag size={14} className="text-[#3674B5]" aria-hidden="true" />
                  <h2 className="font-semibold text-slate-900 text-sm">Topic trends</h2>
                </div>
                <ul className="divide-y divide-slate-100">
                  {topKeywords.slice(0, 5).map((item) => {
                    const max = topKeywords[0]?.count || 1;
                    const widthPct = Math.max(8, Math.round((item.count / max) * 100));
                    return (
                      <li key={item.keyword} className="px-4 sm:px-5 py-3">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-sm font-medium text-slate-800 capitalize truncate">{item.keyword}</span>
                          <span className="text-xs text-slate-500 tabular-nums shrink-0">{item.count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#3674B5] to-[#578FCA]"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900 text-sm">Program summary</h2>
              </div>
              <dl className="divide-y divide-slate-100">
                <div className="flex items-center justify-between px-4 sm:px-5 py-3">
                  <dt className="text-xs text-slate-500">With deadlines</dt>
                  <dd className="text-sm font-semibold text-slate-900 tabular-nums">{deadlineSummary.totalWithDeadline}</dd>
                </div>
                <div className="flex items-center justify-between px-4 sm:px-5 py-3">
                  <dt className="text-xs text-slate-500">Rejected</dt>
                  <dd className="text-sm font-semibold text-slate-900 tabular-nums">{stats.rejected}</dd>
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

export default ProgramChairDashboard;
