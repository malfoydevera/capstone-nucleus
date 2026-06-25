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
  Activity,
  Users,
  Bell,
} from 'lucide-react';
import { notificationsAPI, researchAPI, unwrapApiData } from '../../utils/api';
import { formatFullName } from '../../utils/names';
import UserGuideLink from '../../components/ui/UserGuideLink';
import { reviewStatusLabel, reviewStatusTone } from '../../components/review/reviewStatus';

const POLL_MS = 10000;

const NOTIFICATION_TONE = {
  inactivity: {
    icon: AlertCircle,
    iconWrap: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
  },
  escalation: {
    icon: Bell,
    iconWrap: 'bg-rose-100 text-rose-700',
    dot: 'bg-rose-500',
  },
};

const DashboardNotificationList = ({ items, onOpen, onViewAll }) => {
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="dean-notifications-heading"
      className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
    >
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h2 id="dean-notifications-heading" className="font-semibold text-slate-900 text-sm">
            Notifications
          </h2>
          <span className="rounded-full bg-[#3674B5] px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">
            {items.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-semibold text-[#3674B5] hover:text-[#2d6299] shrink-0"
        >
          View all
        </button>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map((item) => {
          const tone = NOTIFICATION_TONE[item.type] || NOTIFICATION_TONE.escalation;
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

const DeanDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignedPapers, setAssignedPapers] = useState([]);
  const [monitorData, setMonitorData] = useState(null);
  const [deptComparison, setDeptComparison] = useState(null);
  const [escalationAlerts, setEscalationAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [papersRes, monitorRes, notificationRes, comparisonRes] = await Promise.all([
        researchAPI.getDeanChairAssignedPapers(),
        researchAPI.getDeanActivityMonitor(),
        notificationsAPI.getMine({ limit: 80 }),
        researchAPI.getDepartmentComparison(),
      ]);

      setAssignedPapers(unwrapApiData(papersRes).papers || []);
      setMonitorData(unwrapApiData(monitorRes));
      setDeptComparison(unwrapApiData(comparisonRes));
      setEscalationAlerts(
        (unwrapApiData(notificationRes).notifications || [])
          .filter((item) => item.type === 'escalation_alert')
          .slice(0, 5),
      );
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Failed to fetch Dean dashboard:', error);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(() => fetchDashboard(true), POLL_MS);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const summary = monitorData?.summary || {};
  const inactivityAlerts = monitorData?.inactivityAlerts || [];
  const recentLogs = (monitorData?.auditLogs || []).slice(0, 5);
  const departmentRows = (deptComparison?.departments || []).slice(0, 4);

  const stats = useMemo(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      needsDeanReview: assignedPapers.filter((p) => p.status === 'pending_dean').length,
      needsChairReview: summary.pendingProgramChair || 0,
      forwarded: assignedPapers.filter((p) =>
        ['pending_editor', 'pending_admin', 'approved', 'published'].includes(p.status),
      ).length,
      revisionRequired: assignedPapers.filter((p) => p.status === 'revision_required').length,
      totalAssigned: assignedPapers.length,
      pendingEditor: summary.pendingEditor || 0,
      approved: summary.approved || 0,
      thisMonth: assignedPapers.filter((p) => {
        const d = new Date(p.created_at || p.submission_date);
        return !Number.isNaN(d.getTime()) && d >= firstDayOfMonth;
      }).length,
    };
  }, [assignedPapers, summary]);

  const recentPapers = useMemo(() => {
    const priority = (status) => {
      if (status === 'pending_dean') return 0;
      if (status === 'pending_program_chair') return 1;
      if (status === 'revision_required') return 2;
      return 3;
    };
    return [...assignedPapers]
      .sort((a, b) => {
        const p = priority(a.status) - priority(b.status);
        if (p !== 0) return p;
        return new Date(b.updated_at || b.submission_date || b.created_at)
          - new Date(a.updated_at || a.submission_date || a.created_at);
      })
      .slice(0, 5);
  }, [assignedPapers]);

  const dashboardNotifications = useMemo(() => {
    const items = [];
    const seenPapers = new Set();

    inactivityAlerts.forEach((paper) => {
      if (!paper?.id || seenPapers.has(paper.id)) return;
      seenPapers.add(paper.id);
      items.push({
        id: `inactivity-${paper.id}`,
        type: 'inactivity',
        researchId: paper.id,
        title: paper.title || 'Untitled manuscript',
        message: `Program chair review overdue · ${paper.daysStale} day${paper.daysStale !== 1 ? 's' : ''}${
          paper.users ? ` · ${formatFullName(paper.users)}` : ''
        }`,
      });
    });

    escalationAlerts.forEach((alert) => {
      const researchId = alert.research_id;
      if (researchId && seenPapers.has(researchId)) return;
      if (researchId) seenPapers.add(researchId);
      items.push({
        id: `escalation-${alert.id}`,
        type: 'escalation',
        researchId,
        title: alert.title?.replace(/^Escalation:\s*/i, '') || 'Chair review delay',
        message: alert.message || 'A manuscript needs your attention.',
      });
    });

    return items.slice(0, 4);
  }, [inactivityAlerts, escalationAlerts]);

  const taskCards = useMemo(() => [
    {
      key: 'dean-review',
      label: 'Needs your review',
      count: stats.needsDeanReview,
      icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      description: stats.needsDeanReview > 0 ? 'Awaiting dean decision' : 'All caught up',
      onClick: () => navigate('/dean/review'),
    },
    {
      key: 'chair-queue',
      label: 'Program chair queue',
      count: stats.needsChairReview,
      icon: Users,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
      description: dashboardNotifications.length > 0
        ? `${dashboardNotifications.length} alert${dashboardNotifications.length !== 1 ? 's' : ''}`
        : 'Oversight on chair queue',
      onClick: () => navigate('/dean/review'),
    },
    {
      key: 'forwarded',
      label: 'Forwarded',
      count: stats.forwarded,
      icon: CheckCircle,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      description: `${stats.pendingEditor} with editor`,
      onClick: () => navigate('/dean/review'),
    },
  ], [stats, dashboardNotifications.length, navigate]);

  const handleOpenNotification = (item) => {
    if (item.researchId) {
      navigate(`/dean/review/${item.researchId}`);
      return;
    }
    navigate('/notifications');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getActionLabel = (action) => {
    const map = {
      approve: 'Approved',
      reject: 'Rejected',
      revision: 'Revision',
      bypass: 'Bypass',
      login: 'Login',
    };
    return map[action] || action || 'Activity';
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
              onClick={() => fetchDashboard()}
              disabled={refreshing}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
              Refresh
            </button>
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'Dean')}&background=3674B5&color=fff`}
              alt=""
              className="w-9 h-9 rounded-full shrink-0"
            />
            <span className="text-sm font-medium text-slate-700 truncate">{user?.fullName}</span>
          </div>
        </div>

        <UserGuideLink />

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
            onClick={() => navigate('/dean/review')}
            className="group bg-gradient-to-br from-[#3674B5] to-[#578FCA] rounded-xl p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <Eye size={20} className="text-white" aria-hidden="true" />
              </div>
              <div className="text-left min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Review queue</p>
                <p className="text-xs text-blue-100 truncate">
                  {stats.needsDeanReview > 0 ? `${stats.needsDeanReview} pending` : 'Open workspace'}
                </p>
              </div>
              <ChevronRight size={16} className="text-white/70 shrink-0" aria-hidden="true" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/dean/activity-monitor')}
            className="group bg-white rounded-xl p-3.5 sm:p-4 shadow-sm border border-slate-100 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#3674B5]/10 flex items-center justify-center shrink-0">
                <Activity size={20} className="text-[#3674B5]" aria-hidden="true" />
              </div>
              <div className="text-left min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">Activity monitor</p>
                <p className="text-xs text-slate-500">Workflow overview</p>
              </div>
              <ChevronRight size={16} className="text-slate-300 shrink-0" aria-hidden="true" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/dean/repository')}
            className="group bg-white rounded-xl p-3.5 sm:p-4 shadow-sm border border-slate-100 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <Search size={20} className="text-emerald-600" aria-hidden="true" />
              </div>
              <div className="text-left min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">Repository</p>
                <p className="text-xs text-slate-500">Browse manuscripts</p>
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
                onClick={() => navigate('/dean/review')}
                className="text-xs font-semibold text-[#3674B5] hover:text-[#2d6299]"
              >
                View all
              </button>
            </div>

            {recentPapers.length === 0 ? (
              <div className="px-4 sm:px-5 py-10 text-center">
                <FileText size={28} className="mx-auto text-slate-300 mb-3" aria-hidden="true" />
                <p className="text-sm text-slate-500">No manuscripts in your review scope yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentPapers.map((paper) => (
                  <button
                    key={paper.id}
                    type="button"
                    onClick={() => navigate(`/dean/review/${paper.id}`)}
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
            <DashboardNotificationList
              items={dashboardNotifications}
              onOpen={handleOpenNotification}
              onViewAll={() => navigate('/notifications')}
            />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
                <h2 className="font-semibold text-slate-900">By department</h2>
                <span className="text-[11px] text-slate-400">{deptComparison?.totalDepartments || 0} total</span>
              </div>
              {departmentRows.length === 0 ? (
                <p className="px-4 py-8 text-sm text-slate-500 text-center">No department data yet</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {departmentRows.map((row) => (
                    <div key={row.department} className="px-4 sm:px-5 py-3.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{row.department}</p>
                        <span className="text-xs font-semibold text-slate-600 shrink-0">{row.total} papers</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {row.pending} pending · {row.approved} approved · {row.approvalRate}% approval rate
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2">
                <h2 className="font-semibold text-slate-900 text-sm">Recent activity</h2>
                <button
                  type="button"
                  onClick={() => navigate('/dean/audit-logs')}
                  className="text-xs font-semibold text-[#3674B5] hover:text-[#2d6299] inline-flex items-center gap-0.5"
                >
                  Audit logs <ChevronRight size={12} aria-hidden="true" />
                </button>
              </div>
              {recentLogs.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500 text-center">No recent activity</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentLogs.slice(0, 3).map((log, index) => (
                    <div key={log.id || index} className="px-4 sm:px-5 py-3">
                      <p className="text-sm font-medium text-slate-900">{getActionLabel(log.action)}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {log.user_name || log.user_role || 'User'}
                        {log.details?.paperTitle ? ` · ${log.details.paperTitle}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">{formatDateTime(log.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeanDashboard;
