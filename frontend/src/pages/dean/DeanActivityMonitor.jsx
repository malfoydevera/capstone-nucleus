import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, Shield, Users, Clock, CheckCircle, XCircle,
  AlertTriangle, Search, RefreshCw, ChevronRight, Eye,
  Award, FileText, Filter, BarChart3, AlertCircle
} from 'lucide-react';
import { researchAPI } from '../../utils/api';
import { formatFullName } from '../../utils/names';

const DeanActivityMonitor = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await researchAPI.getDeanActivityMonitor();
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch activity monitor data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusConfig = (status) => {
    const map = {
      pending_faculty: { label: 'With Adviser', color: 'bg-blue-100 text-blue-700' },
      pending_dean: { label: 'With Dean', color: 'bg-violet-100 text-violet-700' },
      pending_program_chair: { label: 'With Program Chair', color: 'bg-teal-100 text-teal-700' },
      pending_editor: { label: 'With Editor', color: 'bg-sky-100 text-sky-700' },
      pending_admin: { label: 'With Admin', color: 'bg-indigo-100 text-indigo-700' },
      approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700' },
      published: { label: 'Published', color: 'bg-green-100 text-green-700' },
      rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
      revision_required: { label: 'Revision Required', color: 'bg-orange-100 text-orange-700' },
    };
    return map[status] || { label: status, color: 'bg-slate-100 text-slate-700' };
  };

  const getActionBadge = (action) => {
    const map = {
      approve: { bg: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, label: 'Approved' },
      reject: { bg: 'bg-red-100 text-red-700', icon: XCircle, label: 'Rejected' },
      revision: { bg: 'bg-amber-100 text-amber-700', icon: AlertCircle, label: 'Revision' },
      bypass: { bg: 'bg-violet-100 text-violet-700', icon: Shield, label: 'Bypass' },
      login: { bg: 'bg-blue-100 text-blue-700', icon: Users, label: 'Login' },
      returned: { bg: 'bg-orange-100 text-orange-700', icon: RefreshCw, label: 'Returned' },
    };
    return map[action] || { bg: 'bg-slate-100 text-slate-700', icon: Activity, label: action };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-slate-200 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="mt-6 text-lg font-semibold text-slate-700">Loading activity monitor...</p>
      </div>
    );
  }

  const papers = data?.papers || [];
  const recentActions = data?.recentActions || [];
  const auditLogs = data?.auditLogs || [];
  const inactivityAlerts = data?.inactivityAlerts || [];
  const s = data?.summary || {};

  const filteredPapers = searchTerm
    ? papers.filter(p =>
        p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        formatFullName(p.users).toLowerCase().includes(searchTerm.toLowerCase())
      )
    : papers;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'papers', label: 'All Papers', icon: FileText, count: papers.length },
    { id: 'actions', label: 'Recent Actions', icon: Activity, count: recentActions.length },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, count: inactivityAlerts.length },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg">
            <Activity size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 mb-1">Activity Monitor</h1>
            <p className="text-slate-600">Monitor all system activity, approvals, rejections, and potential issues</p>
          </div>
        </div>
        <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:border-slate-300 transition-all">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <Icon size={18} />
              {tab.label}
              {tab.count != null && (
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === tab.id ? 'bg-white/25' : 'bg-slate-100'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Pipeline Stats */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <BarChart3 size={20} className="text-violet-600" /> Clearance Pipeline
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Adviser', value: s.pendingFaculty, color: 'border-blue-300 bg-blue-50' },
                { label: 'Program Chair', value: s.pendingProgramChair, color: 'border-teal-300 bg-teal-50' },
                { label: 'Dean', value: s.pendingDean, color: 'border-violet-300 bg-violet-50' },
                { label: 'Editor', value: s.pendingEditor, color: 'border-sky-300 bg-sky-50' },
                { label: 'Admin', value: s.pendingAdmin, color: 'border-indigo-300 bg-indigo-50' },
              ].map(item => (
                <div key={item.label} className={`rounded-xl border-2 ${item.color} p-4 text-center`}>
                  <p className="text-2xl font-black text-slate-900">{item.value || 0}</p>
                  <p className="text-xs font-semibold text-slate-600 mt-1">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Audit Logs */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2"><Shield size={18} className="text-violet-600" />Recent Audit Trail</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {auditLogs.slice(0, 15).map((log, i) => {
                const badge = getActionBadge(log.action);
                const BadgeIcon = badge.icon;
                return (
                  <div key={log.id || i} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50">
                    <div className={`w-10 h-10 rounded-lg ${badge.bg} flex items-center justify-center flex-shrink-0`}>
                      <BadgeIcon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{log.user_name || log.user_role}</p>
                      <p className="text-xs text-slate-500">{badge.label} &middot; {log.details?.paperTitle || ''}</p>
                      {log.reason && <p className="text-xs text-amber-600 mt-0.5">Reason: {log.reason}</p>}
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{formatDate(log.created_at)}</span>
                  </div>
                );
              })}
              {auditLogs.length === 0 && (
                <div className="p-12 text-center text-slate-400">
                  <Activity size={36} className="mx-auto mb-3" />
                  <p>No audit logs recorded yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Papers Tab */}
      {activeTab === 'papers' && (
        <div>
          <div className="mb-6">
            <div className="relative max-w-md">
              <input
                type="text"
                placeholder="Search papers by title or author..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-5 py-3 pl-12 bg-white border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
          <div className="space-y-3">
            {filteredPapers.map(paper => {
              const sc = getStatusConfig(paper.status);
              return (
                <div key={paper.id} onClick={() => navigate(`/dean/review/${paper.id}`)} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 line-clamp-1">{paper.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{formatFullName(paper.users) || 'Unknown'} &middot; {formatDate(paper.updated_at || paper.created_at)}</p>
                  </div>
                  {paper.bypass_reason && (
                    <span className="px-2 py-1 bg-violet-100 text-violet-700 text-xs font-bold rounded-lg">Bypassed</span>
                  )}
                  <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${sc.color}`}>{sc.label}</span>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500" />
                </div>
              );
            })}
            {filteredPapers.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
                <FileText size={36} className="mx-auto mb-3" />
                <p>No papers found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions Tab */}
      {activeTab === 'actions' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {recentActions.map((action, i) => (
              <div key={action.id || i} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatFullName(action.reviewer) || 'Unknown'} <span className="text-slate-400">({action.reviewer_role})</span>
                  </p>
                  <p className="text-xs text-slate-500">Status: {action.status} &middot; {action.comments ? `"${action.comments.substring(0, 100)}"` : 'No comments'}</p>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">{formatDate(action.created_at)}</span>
              </div>
            ))}
            {recentActions.length === 0 && (
              <div className="p-12 text-center text-slate-400">
                <Activity size={36} className="mx-auto mb-3" />
                <p>No recent actions</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div>
          {inactivityAlerts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
              <CheckCircle size={48} className="text-emerald-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">All Clear</h3>
              <p className="text-slate-600">No inactivity alerts. All papers are being processed within the expected timeframe.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={20} className="text-amber-600" />
                  <h3 className="font-bold text-amber-800">
                    {inactivityAlerts.length} paper{inactivityAlerts.length > 1 ? 's' : ''} pending Program Chair review beyond {data?.inactivityThresholdDays || 3} days
                  </h3>
                </div>
                <p className="text-sm text-amber-700">As Dean, you may bypass-approve these papers if the Program Chair is unavailable.</p>
              </div>
              {inactivityAlerts.map(paper => (
                <div key={paper.id} onClick={() => navigate(`/dean/review/${paper.id}`)} className="bg-white rounded-xl border-2 border-amber-200 p-5 flex items-center gap-4 hover:shadow-md transition-all cursor-pointer group">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={22} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 line-clamp-1">{paper.title}</p>
                    <p className="text-sm text-slate-500">{formatFullName(paper.users) || 'Unknown'}</p>
                    <p className="text-xs text-amber-700 font-semibold mt-1">
                      Pending for {paper.daysStale} days
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-slate-400 group-hover:text-slate-600" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DeanActivityMonitor;
