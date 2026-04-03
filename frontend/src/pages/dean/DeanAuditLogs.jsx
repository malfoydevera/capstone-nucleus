import { useState, useEffect } from 'react';
import {
  Shield, Search, RefreshCw, Filter, CheckCircle, XCircle,
  AlertCircle, Users, Activity, Clock
} from 'lucide-react';
import { researchAPI } from '../../utils/api';

const DeanAuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', role: '' });

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async (customFilters) => {
    try {
      setLoading(true);
      const params = customFilters || filters;
      const cleanParams = {};
      if (params.action) cleanParams.action = params.action;
      if (params.role) cleanParams.role = params.role;
      const res = await researchAPI.getAuditLogs(cleanParams);
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => fetchLogs(filters);
  const clearFilters = () => {
    const empty = { action: '', role: '' };
    setFilters(empty);
    fetchLogs(empty);
  };

  const formatDate = (d) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getActionConfig = (action) => {
    const map = {
      approve: { bg: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, label: 'Approve' },
      reject: { bg: 'bg-red-100 text-red-700', icon: XCircle, label: 'Reject' },
      revision: { bg: 'bg-amber-100 text-amber-700', icon: AlertCircle, label: 'Revision' },
      bypass: { bg: 'bg-violet-100 text-violet-700', icon: Shield, label: 'Bypass' },
      login: { bg: 'bg-blue-100 text-blue-700', icon: Users, label: 'Login' },
    };
    return map[action] || { bg: 'bg-slate-100 text-slate-700', icon: Activity, label: action };
  };

  const getRoleBadge = (role) => {
    const colors = {
      dean: 'bg-violet-100 text-violet-700',
      program_chair: 'bg-teal-100 text-teal-700',
      faculty: 'bg-blue-100 text-blue-700',
      staff: 'bg-sky-100 text-sky-700',
      admin: 'bg-red-100 text-red-700',
      student: 'bg-green-100 text-green-700',
    };
    return colors[role] || 'bg-slate-100 text-slate-700';
  };

  const escapeCsvValue = (value) => {
    const text = value == null ? '' : String(value);
    if (text.includes('"') || text.includes(',') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const exportCsv = () => {
    if (!logs.length) return;

    const header = ['timestamp', 'action', 'role', 'user', 'target_type', 'target_id', 'reason', 'details'];
    const rows = logs.map((log) => [
      log.created_at || '',
      log.action || '',
      log.user_role || '',
      log.user_name || '',
      log.target_type || '',
      log.target_id || '',
      log.reason || '',
      log.details ? JSON.stringify(log.details) : '',
    ]);

    const csvContent = [header, ...rows]
      .map((row) => row.map(escapeCsvValue).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dean_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    try {
      const cleanParams = {};
      if (filters.action) cleanParams.action = filters.action;
      if (filters.role) cleanParams.role = filters.role;

      const response = await researchAPI.getAuditLogsPdf(cleanParams);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dean_audit_logs_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export PDF:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-lg">
            <Shield size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 mb-1">Audit Logs</h1>
            <p className="text-slate-600">Complete trail of all system actions — approvals, rejections, revisions, bypasses, and logins</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} disabled={loading || logs.length === 0} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:border-slate-300 transition-all disabled:opacity-50">
            Export CSV
          </button>
          <button onClick={exportPdf} disabled={loading || logs.length === 0} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:border-slate-300 transition-all disabled:opacity-50">
            Export PDF
          </button>
          <button onClick={() => fetchLogs()} disabled={loading} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:border-slate-300 transition-all">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} className="text-slate-600" />
          <h3 className="font-bold text-slate-900">Filters</h3>
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Action Type</label>
            <select value={filters.action} onChange={e => setFilters({ ...filters, action: e.target.value })} className="px-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none">
              <option value="">All Actions</option>
              <option value="approve">Approve</option>
              <option value="reject">Reject</option>
              <option value="revision">Revision</option>
              <option value="bypass">Bypass</option>
              <option value="login">Login</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Role</label>
            <select value={filters.role} onChange={e => setFilters({ ...filters, role: e.target.value })} className="px-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none">
              <option value="">All Roles</option>
              <option value="dean">Dean</option>
              <option value="program_chair">Program Chair</option>
              <option value="faculty">Faculty/Adviser</option>
              <option value="staff">Staff/Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button onClick={applyFilters} className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-bold text-sm hover:from-violet-700 hover:to-purple-700 transition-all">
            Apply
          </button>
          <button onClick={clearFilters} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">
            Clear
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-violet-200 rounded-full mx-auto relative">
              <div className="absolute inset-0 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-500 mt-4">Loading logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Shield size={48} className="mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Logs Found</h3>
            <p>No audit logs match the current filters.</p>
          </div>
        ) : (
          <>
            {/* Header row */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-2">Action</div>
              <div className="col-span-2">User</div>
              <div className="col-span-1">Role</div>
              <div className="col-span-3">Details</div>
              <div className="col-span-2">Reason</div>
              <div className="col-span-2">Timestamp</div>
            </div>
            <div className="divide-y divide-slate-100">
              {logs.map((log, i) => {
                const actionConfig = getActionConfig(log.action);
                const ActionIcon = actionConfig.icon;
                return (
                  <div key={log.id || i} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 hover:bg-slate-50 transition-colors items-center">
                    <div className="col-span-2 flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${actionConfig.bg}`}>
                        <ActionIcon size={14} /> {actionConfig.label}
                      </span>
                    </div>
                    <div className="col-span-2 text-sm font-semibold text-slate-900 truncate">{log.user_name || 'Unknown'}</div>
                    <div className="col-span-1">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${getRoleBadge(log.user_role)}`}>{log.user_role}</span>
                    </div>
                    <div className="col-span-3 text-xs text-slate-600 truncate">{log.details?.paperTitle || log.details?.email || '-'}</div>
                    <div className="col-span-2 text-xs text-slate-500 truncate">{log.reason || '-'}</div>
                    <div className="col-span-2 text-xs text-slate-400">{formatDate(log.created_at)}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Count */}
      <div className="mt-4 text-sm text-slate-500 text-right">
        Showing {logs.length} log entries
      </div>
    </div>
  );
};

export default DeanAuditLogs;
