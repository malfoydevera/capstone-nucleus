import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Clock, CheckCircle, Eye, ChevronRight, RefreshCw,
  BookOpen, Award, Users, AlertTriangle, Shield, Activity,
  BarChart3, Search, Bell
} from 'lucide-react';
import { notificationsAPI, researchAPI } from '../../utils/api';
import { formatFullName } from '../../utils/names';

const DeanDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [monitorData, setMonitorData] = useState(null);
  const [deptComparison, setDeptComparison] = useState(null);
  const [escalationAlerts, setEscalationAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDashboard(); }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const [monitorRes, notificationRes, comparisonRes] = await Promise.all([
        researchAPI.getDeanActivityMonitor(),
        notificationsAPI.getMine({ limit: 80 }),
        researchAPI.getDepartmentComparison(),
      ]);

      setMonitorData(monitorRes.data);
      setDeptComparison(comparisonRes.data);
      const escalation = (notificationRes.data.notifications || [])
        .filter((item) => item.type === 'escalation_alert')
        .slice(0, 5);
      setEscalationAlerts(escalation);
    } catch (error) {
      console.error('Failed to fetch Dean dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getActionBadge = (action) => {
    const map = {
      approve: { bg: 'bg-emerald-100 text-emerald-700', label: 'Approved' },
      reject: { bg: 'bg-red-100 text-red-700', label: 'Rejected' },
      revision: { bg: 'bg-amber-100 text-amber-700', label: 'Revision' },
      bypass: { bg: 'bg-violet-100 text-violet-700', label: 'Bypass' },
      login: { bg: 'bg-blue-100 text-blue-700', label: 'Login' },
    };
    return map[action] || { bg: 'bg-slate-100 text-slate-700', label: action };
  };

  const s = monitorData?.summary || {};
  const inactivityAlerts = monitorData?.inactivityAlerts || [];
  const recentLogs = (monitorData?.auditLogs || []).slice(0, 10);
  const papers = monitorData?.papers || [];

  const trendSeries = useMemo(() => {
    const months = [];
    const now = new Date();

    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        submissions: 0,
        approved: 0,
      });
    }

    const monthMap = new Map(months.map((m) => [m.key, m]));

    papers.forEach((paper) => {
      const created = new Date(paper.created_at || paper.submission_date || paper.updated_at);
      if (!Number.isNaN(created.getTime())) {
        const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
        const row = monthMap.get(key);
        if (row) row.submissions += 1;
      }

      if (paper.status === 'approved' || paper.status === 'published') {
        const approvedDate = new Date(paper.published_date || paper.updated_at || paper.created_at);
        if (!Number.isNaN(approvedDate.getTime())) {
          const key = `${approvedDate.getFullYear()}-${String(approvedDate.getMonth() + 1).padStart(2, '0')}`;
          const row = monthMap.get(key);
          if (row) row.approved += 1;
        }
      }
    });

    return months;
  }, [papers]);

  const trendMax = Math.max(1, ...trendSeries.map((m) => Math.max(m.submissions, m.approved)));
  const departmentRows = deptComparison?.departments || [];
  const departmentMax = Math.max(1, ...departmentRows.map((row) => row.total || 0));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] animate-fadeIn">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-200 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-sm text-slate-500">Loading Dean dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-6 py-8 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg">
              <Award size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dean Dashboard</h1>
              <p className="text-sm text-slate-500">
                System overview & monitoring &middot; {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <button onClick={fetchDashboard} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-slate-300 transition-all text-sm font-semibold">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Inactivity Alerts */}
        {inactivityAlerts.length > 0 && (
          <div className="mb-8 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={22} className="text-amber-600" />
              <h2 className="text-lg font-bold text-amber-800">Program Chair Inactivity Alerts</h2>
              <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-xs font-bold rounded-full">{inactivityAlerts.length}</span>
            </div>
            <div className="space-y-3">
              {inactivityAlerts.map(paper => (
                <div key={paper.id} onClick={() => navigate(`/dean/review/${paper.id}`)} className="bg-white rounded-xl p-4 border border-amber-200 flex items-center justify-between cursor-pointer hover:shadow-md transition-all">
                  <div>
                    <p className="font-bold text-slate-900 line-clamp-1">{paper.title}</p>
                    <p className="text-sm text-slate-500">{formatFullName(paper.users) || 'Unknown'} &middot; Pending for <span className="font-bold text-amber-700">{paper.daysStale} days</span></p>
                  </div>
                  <ChevronRight size={18} className="text-slate-400" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Escalation Notification Alerts */}
        {escalationAlerts.length > 0 && (
          <div className="mb-8 bg-gradient-to-r from-rose-50 to-red-50 border-2 border-rose-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Bell size={22} className="text-rose-600" />
              <h2 className="text-lg font-bold text-rose-800">Escalation Notifications</h2>
              <span className="px-2 py-0.5 bg-rose-200 text-rose-800 text-xs font-bold rounded-full">{escalationAlerts.length}</span>
            </div>
            <div className="space-y-3">
              {escalationAlerts.map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => alert.research_id && navigate(`/dean/review/${alert.research_id}`)}
                  className="bg-white rounded-xl p-4 border border-rose-200 flex items-center justify-between cursor-pointer hover:shadow-md transition-all"
                >
                  <div>
                    <p className="font-bold text-slate-900 line-clamp-1">{alert.title || 'Escalation Alert'}</p>
                    <p className="text-sm text-slate-600 line-clamp-1">{alert.message}</p>
                  </div>
                  <ChevronRight size={18} className="text-slate-400" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* System-wide Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'With Advisers', value: s.pendingFaculty, color: 'from-blue-50 to-indigo-50 border-blue-200', text: 'text-blue-700' },
            { label: 'With Program Chair', value: s.pendingProgramChair, color: 'from-teal-50 to-cyan-50 border-teal-200', text: 'text-teal-700' },
            { label: 'With Dean', value: s.pendingDean, color: 'from-violet-50 to-purple-50 border-violet-200', text: 'text-violet-700' },
            { label: 'With Editor', value: s.pendingEditor, color: 'from-sky-50 to-blue-50 border-sky-200', text: 'text-sky-700' },
            { label: 'With Admin', value: s.pendingAdmin, color: 'from-indigo-50 to-blue-50 border-indigo-200', text: 'text-indigo-700' },
            { label: 'Approved', value: s.approved, color: 'from-emerald-50 to-green-50 border-emerald-200', text: 'text-emerald-700' },
            { label: 'Rejected', value: s.rejected, color: 'from-red-50 to-pink-50 border-red-200', text: 'text-red-700' },
            { label: 'Revision Req.', value: s.revisionRequired, color: 'from-orange-50 to-amber-50 border-orange-200', text: 'text-orange-700' },
            { label: 'Bypassed', value: s.bypassed, color: 'from-purple-50 to-violet-50 border-purple-200', text: 'text-purple-700' },
            { label: 'Total Papers', value: s.total, color: 'bg-white border-slate-200', text: 'text-slate-700' },
          ].map(card => (
            <div key={card.label} className={`bg-gradient-to-br ${card.color} rounded-2xl border-2 p-5 shadow-sm hover:shadow-md transition-shadow`}>
              <p className={`text-xs font-semibold mb-1 ${card.text}`}>{card.label}</p>
              <p className="text-3xl font-black text-slate-900">{card.value || 0}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <button onClick={() => navigate('/dean/review')} className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-3 hover:from-violet-700 hover:to-purple-700 transition-all shadow-lg">
            <FileText size={24} /> Review Papers <ChevronRight className="ml-auto" size={20} />
          </button>
          <button onClick={() => navigate('/dean/activity-monitor')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-3 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg">
            <Activity size={24} /> Activity Monitor <ChevronRight className="ml-auto" size={20} />
          </button>
          <button onClick={() => navigate('/dean/audit-logs')} className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-3 hover:from-slate-800 hover:to-slate-900 transition-all shadow-lg">
            <Shield size={24} /> Audit Logs <ChevronRight className="ml-auto" size={20} />
          </button>
        </div>

        {/* Cross-Department Comparison */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-10">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Users size={20} className="text-violet-600" />
              <h2 className="text-lg font-bold text-slate-900">Cross-Department Comparison</h2>
            </div>
            <div className="text-xs text-slate-500 font-semibold">
              {deptComparison?.totalDepartments || 0} departments · {deptComparison?.totalPapers || 0} papers
            </div>
          </div>

          {departmentRows.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Users size={34} className="mx-auto mb-3" />
              <p className="font-medium">No department comparison data available</p>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {departmentRows.slice(0, 8).map((row) => (
                <div key={row.department} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="font-bold text-slate-900 line-clamp-1">{row.department}</p>
                    <div className="text-xs text-slate-600 flex items-center gap-3">
                      <span>Total: <strong>{row.total}</strong></span>
                      <span>Approval: <strong>{row.approvalRate}%</strong></span>
                      <span>Avg turnaround: <strong>{row.avgTurnaroundDays}d</strong></span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full"
                      style={{ width: `${Math.max(6, (row.total / departmentMax) * 100)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                    <span className="px-2 py-1 rounded bg-sky-50 text-sky-700 font-semibold">Pending: {row.pending}</span>
                    <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-semibold">Approved: {row.approved}</span>
                    <span className="px-2 py-1 rounded bg-red-50 text-red-700 font-semibold">Rejected: {row.rejected}</span>
                    <span className="px-2 py-1 rounded bg-amber-50 text-amber-700 font-semibold">Revision: {row.revisionRequired}</span>
                    <span className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 font-semibold">To Editor: {row.forwardedToEditor}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submission Trend */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-10">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
            <BarChart3 size={20} className="text-violet-600" />
            <h2 className="text-lg font-bold text-slate-900">Submission Trend (Last 6 Months)</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-6 gap-3 items-end h-56">
              {trendSeries.map((point) => (
                <div key={point.key} className="flex flex-col items-center gap-2">
                  <div className="w-full flex items-end justify-center gap-1 h-44">
                    <div
                      className="w-4 rounded-t-md bg-blue-500"
                      style={{ height: `${Math.max(6, (point.submissions / trendMax) * 160)}px` }}
                      title={`Submissions: ${point.submissions}`}
                    />
                    <div
                      className="w-4 rounded-t-md bg-emerald-500"
                      style={{ height: `${Math.max(6, (point.approved / trendMax) * 160)}px` }}
                      title={`Approved: ${point.approved}`}
                    />
                  </div>
                  <p className="text-xs font-semibold text-slate-600">{point.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-6 text-xs text-slate-600">
              <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-blue-500" /> Submissions</span>
              <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-emerald-500" /> Approved</span>
            </div>
          </div>
        </div>

        {/* Recent Audit Trail */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield size={20} className="text-violet-600" />
              <h2 className="text-lg font-bold text-slate-900">Recent Activity</h2>
            </div>
            <button onClick={() => navigate('/dean/audit-logs')} className="text-sm font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1">
              View all <ChevronRight size={16} />
            </button>
          </div>
          {recentLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Activity size={36} className="mx-auto mb-3" />
              <p className="font-medium">No recent activity recorded</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentLogs.map((log, i) => {
                const badge = getActionBadge(log.action);
                return (
                  <div key={log.id || i} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold ${badge.bg}`}>{badge.label}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {log.user_name || log.user_role} &middot; <span className="font-normal text-slate-500">{log.details?.paperTitle || log.action}</span>
                      </p>
                      {log.reason && <p className="text-xs text-slate-500 mt-0.5">Reason: {log.reason}</p>}
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{formatDate(log.created_at)}</span>
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

export default DeanDashboard;
