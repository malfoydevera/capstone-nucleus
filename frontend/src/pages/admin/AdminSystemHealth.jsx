import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Database, RefreshCw, Server, Sparkles } from 'lucide-react';
import { authAPI } from '../../utils/api';

const formatUptime = (seconds) => {
  if (!seconds || seconds < 1) return '0s';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const HealthCard = ({ title, value, subtitle, icon: Icon, tone = 'slate' }) => {
  const toneMap = {
    slate: 'from-slate-50 to-slate-100 border-slate-200 text-slate-800',
    green: 'from-emerald-50 to-green-100 border-emerald-200 text-emerald-800',
    amber: 'from-amber-50 to-orange-100 border-amber-200 text-amber-800',
    red: 'from-red-50 to-rose-100 border-red-200 text-red-800',
    blue: 'from-blue-50 to-cyan-100 border-blue-200 text-blue-800',
    violet: 'from-violet-50 to-purple-100 border-violet-200 text-violet-800',
  };

  return (
    <div className={`bg-gradient-to-br rounded-2xl border p-5 ${toneMap[tone] || toneMap.slate}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-semibold opacity-80">{title}</p>
        <div className="w-10 h-10 rounded-xl bg-white/70 border border-white/80 flex items-center justify-center">
          <Icon size={19} />
        </div>
      </div>
      <p className="text-3xl font-black tracking-tight">{value}</p>
      <p className="text-xs font-medium mt-1 opacity-80">{subtitle}</p>
    </div>
  );
};

const AdminSystemHealth = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);

  const fetchHealth = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');

      const response = await authAPI.getSystemHealth();
      const data = response?.data?.data || response?.data || null;
      setHealth(data);
    } catch (err) {
      console.error('Failed to fetch system health:', err);
      setError('Unable to load system health metrics right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(() => fetchHealth(true), 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const apiRiskTone = useMemo(() => {
    const rate = Number(health?.api?.errorRate24h || 0);
    if (rate >= 20) return 'red';
    if (rate >= 10) return 'amber';
    return 'green';
  }, [health?.api?.errorRate24h]);

  const aiTone = useMemo(() => {
    const success = Number(health?.ai?.successRate30d || 0);
    if (success < 80 && Number(health?.ai?.requests30d || 0) > 0) return 'red';
    if (success < 92 && Number(health?.ai?.requests30d || 0) > 0) return 'amber';
    return 'violet';
  }, [health?.ai?.successRate30d, health?.ai?.requests30d]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[360px]">
        <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-blue-500 animate-spin" />
        <p className="mt-5 text-slate-600 font-semibold">Loading system health...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3 text-red-700">
            <AlertTriangle size={18} />
            <h2 className="font-bold text-lg">System Health Unavailable</h2>
          </div>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => fetchHealth()}
            className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 mb-1">System Health Dashboard</h1>
          <p className="text-slate-600 font-medium">
            Last generated: {health?.generatedAt ? new Date(health.generatedAt).toLocaleString() : 'N/A'}
          </p>
        </div>

        <button
          onClick={() => fetchHealth(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh Metrics'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <HealthCard
          title="API Error Rate (24h)"
          value={`${Number(health?.api?.errorRate24h || 0).toFixed(2)}%`}
          subtitle={`${health?.api?.errors24h || 0} errors out of ${health?.api?.requests24h || 0} events`}
          icon={Activity}
          tone={apiRiskTone}
        />
        <HealthCard
          title="Storage Used"
          value={`${Number(health?.storage?.totalMB || 0).toFixed(2)} MB`}
          subtitle={`${health?.storage?.filesCount || 0} files, avg ${Number(health?.storage?.averageFileMB || 0).toFixed(2)} MB`}
          icon={Database}
          tone="blue"
        />
        <HealthCard
          title="AI Success Rate (30d)"
          value={`${Number(health?.ai?.successRate30d || 0).toFixed(2)}%`}
          subtitle={`${health?.ai?.requests30d || 0} requests, ${health?.ai?.failures30d || 0} failed`}
          icon={Sparkles}
          tone={aiTone}
        />
        <HealthCard
          title="Backend Uptime"
          value={formatUptime(health?.runtime?.uptimeSeconds || 0)}
          subtitle={`Node ${health?.runtime?.nodeVersion || 'N/A'} • RSS ${Number(health?.runtime?.memoryRSSMB || 0).toFixed(2)} MB`}
          icon={Server}
          tone="slate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4">AI Quota</h2>
          {health?.ai?.configuredQuota ? (
            <>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-indigo-500"
                  style={{ width: `${Math.min(100, Number(health?.ai?.quotaUsedPercent || 0))}%` }}
                />
              </div>
              <p className="text-sm text-slate-700 font-medium">
                {Number(health?.ai?.quotaUsedPercent || 0).toFixed(2)}% used
              </p>
              <p className="text-sm text-slate-500">
                {health?.ai?.requests30d || 0} / {health?.ai?.configuredQuota || 0} configured requests
              </p>
            </>
          ) : (
            <p className="text-slate-600">No AI quota environment variable configured.</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Workflow Queue Load</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-slate-700 font-semibold">Pending Faculty</span>
              <span className="text-slate-900 font-black">{health?.workflow?.pendingFaculty || 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-slate-700 font-semibold">Pending Dean / Chair</span>
              <span className="text-slate-900 font-black">{health?.workflow?.pendingDeanOrChair || 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-slate-700 font-semibold">Pending Editor</span>
              <span className="text-slate-900 font-black">{health?.workflow?.pendingEditor || 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-slate-700 font-semibold">Pending Admin</span>
              <span className="text-slate-900 font-black">{health?.workflow?.pendingAdmin || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 text-sm text-slate-600">
        <CheckCircle2 size={16} className="text-emerald-600" />
        Metrics refresh every 30 seconds while this page is open.
      </div>
    </div>
  );
};

export default AdminSystemHealth;
