import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Clock, CheckCircle, Eye, ChevronRight, RefreshCw,
  BookOpen, Users, Calendar, AlertTriangle
} from 'lucide-react';
import { researchAPI, unwrapApiData } from '../../utils/api';
import { formatFullName } from '../../utils/names';
import GuidancePanel from '../../components/ui/GuidancePanel';
import { getRoleGuidance } from '../../utils/guidance';

const ProgramChairDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const guide = getRoleGuidance(user?.role);
  const [programScope, setProgramScope] = useState('');
  const [topKeywords, setTopKeywords] = useState([]);
  const [stats, setStats] = useState({
    total: 0, pending: 0, approved: 0, rejected: 0, revisionRequired: 0, thisMonth: 0
  });
  const [deadlineSummary, setDeadlineSummary] = useState({ totalWithDeadline: 0, overdueCount: 0, dueSoonCount: 0 });
  const [deadlineItems, setDeadlineItems] = useState([]);
  const [recentPapers, setRecentPapers] = useState([]);
  const [allPapers, setAllPapers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await researchAPI.getProgramChairAnalytics();
      const deadlinesResponse = await researchAPI.getProgramChairDeadlines();
      const payload = unwrapApiData(response);
      const deadlinesPayload = unwrapApiData(deadlinesResponse);
      const papers = payload.papers || [];
      setProgramScope(payload.program?.program || payload.program?.department || 'Unassigned Program');
      setTopKeywords(payload.topKeywords || []);
      setAllPapers(papers);
      setDeadlineSummary(deadlinesPayload.summary || { totalWithDeadline: 0, overdueCount: 0, dueSoonCount: 0 });
      setDeadlineItems([...(deadlinesPayload.overdue || []), ...(deadlinesPayload.upcoming || [])].slice(0, 6));
      setStats(payload.summary || {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        revisionRequired: 0,
        thisMonth: 0,
      });

      const sortedPapers = [...papers].sort((a, b) =>
        new Date(b.submission_date || b.created_at) - new Date(a.submission_date || a.created_at)
      );
      setRecentPapers(sortedPapers.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setProgramScope('');
      setTopKeywords([]);
      setDeadlineSummary({ totalWithDeadline: 0, overdueCount: 0, dueSoonCount: 0 });
      setDeadlineItems([]);
      setStats({ total: 0, pending: 0, approved: 0, rejected: 0, revisionRequired: 0, thisMonth: 0 });
      setRecentPapers([]);
      setAllPapers([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending_program_chair: 'Awaiting Your Review',
      pending_editor: 'With Research Editor',
      pending_admin: 'With Admin',
      approved: 'Approved',
      published: 'Published',
      rejected: 'Rejected',
      revision_required: 'Revision Required'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      pending_program_chair: 'text-teal-700 bg-teal-50',
      pending_editor: 'text-blue-600 bg-blue-50',
      pending_admin: 'text-indigo-600 bg-indigo-50',
      approved: 'text-emerald-600 bg-emerald-50',
      published: 'text-emerald-600 bg-emerald-50',
      rejected: 'text-red-600 bg-red-50',
      revision_required: 'text-orange-600 bg-orange-50'
    };
    return colors[status] || 'text-slate-600 bg-slate-50';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] animate-fadeIn">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-200 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-sm text-slate-500">Loading dashboard...</p>
      </div>
    );
  }

  const reviewedPapers = stats.approved + stats.rejected + stats.revisionRequired;
  const approvalRate = reviewedPapers > 0 ? Math.round((stats.approved / reviewedPapers) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-6 py-8 animate-fadeIn">
        <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-sm text-slate-600">
              <Calendar size={14} />
              <span>{new Date().toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-slate-300 transition-all text-sm font-semibold"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <div className="flex items-center gap-2">
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'Program Chair')}&background=0f766e&color=fff`}
                alt="Profile"
                className="w-9 h-9 rounded-full"
              />
              <span className="hidden text-sm font-medium text-slate-700 sm:inline">{user?.fullName}</span>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <GuidancePanel
            title={guide.heading}
            description={guide.summary}
            items={guide.dashboardSteps}
            tone="emerald"
          />
        </div>

        <div className="mb-5 bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500 mb-1">Program Scope</p>
              <h2 className="text-xl font-bold text-slate-900">{programScope || 'Unassigned Program'}</h2>
              <p className="text-sm text-slate-500 mt-2">
                You are the program-level clearance reviewer before papers move to the research editor.
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
              <Users size={22} className="text-teal-600" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Pending Review</p>
                <p className="text-3xl font-bold text-slate-900">{stats.pending}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                <Clock size={20} className="text-teal-600" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1">
              <span className="text-xs text-teal-600 font-medium">Needs your decision</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Approved</p>
                <p className="text-3xl font-bold text-slate-900">{stats.approved}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle size={20} className="text-emerald-600" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1">
              <span className="text-xs text-emerald-600 font-medium">Forwarded to editor</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Revision Sent</p>
                <p className="text-3xl font-bold text-slate-900">{stats.revisionRequired}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                <Eye size={20} className="text-orange-600" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1">
              <span className="text-xs text-orange-600 font-medium">Returned to student</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Total Assigned</p>
                <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <BookOpen size={20} className="text-blue-600" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1">
              <span className="text-xs text-slate-400">{stats.thisMonth} received this month</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          {reviewedPapers > 0 ? (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle size={24} className="text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-500">Approval Rate</p>
                <p className="text-xl font-bold text-slate-900">{approvalRate}%</p>
                <p className="text-xs text-slate-400">{reviewedPapers} papers reviewed in total</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle size={24} className="text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-500">Approval Rate</p>
                <p className="text-xl font-bold text-slate-900">0%</p>
                <p className="text-xs text-slate-400">No completed reviews yet</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
              <AlertTriangle size={24} className="text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-500">Deadline Risk</p>
              <p className="text-xl font-bold text-slate-900">{deadlineSummary.overdueCount + deadlineSummary.dueSoonCount} Papers</p>
              <p className="text-xs text-slate-400">{deadlineSummary.overdueCount} overdue, {deadlineSummary.dueSoonCount} due soon</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <button
            onClick={() => navigate('/program-chair/review')}
            className="group bg-gradient-to-br from-teal-600 to-cyan-600 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Eye size={24} className="text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-white">Review Queue</p>
                <p className="text-sm text-teal-100">{stats.pending} papers waiting for your review</p>
              </div>
              <ChevronRight size={20} className="text-white/70 ml-auto group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          <button
            onClick={() => navigate('/program-chair/assign-faculty')}
            className="group bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Users size={24} className="text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-white">Assign Faculty</p>
                <p className="text-sm text-slate-200">Manage reviewer coverage inside your program</p>
              </div>
              <ChevronRight size={20} className="text-white/70 ml-auto group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>

        {/* Deadline Monitor */}
        <div className="mb-10 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Review Deadlines</h2>
            <span className="text-xs font-semibold text-slate-500">Program Chair reminders</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <p className="text-xs font-semibold text-slate-600 mb-1">With Deadlines</p>
              <p className="text-2xl font-black text-slate-900">{deadlineSummary.totalWithDeadline}</p>
            </div>
            <div className="rounded-xl border border-orange-200 p-4 bg-orange-50">
              <p className="text-xs font-semibold text-orange-700 mb-1">Due in 48h</p>
              <p className="text-2xl font-black text-orange-700">{deadlineSummary.dueSoonCount}</p>
            </div>
            <div className="rounded-xl border border-red-200 p-4 bg-red-50">
              <p className="text-xs font-semibold text-red-700 mb-1">Overdue</p>
              <p className="text-2xl font-black text-red-700">{deadlineSummary.overdueCount}</p>
            </div>
          </div>

          {deadlineItems.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming or overdue deadlines yet.</p>
          ) : (
            <div className="space-y-3">
              {deadlineItems.map((paper) => {
                const overdue = (paper.hoursUntilDeadline || 0) <= 0;
                return (
                  <button
                    key={paper.id}
                    onClick={() => navigate(`/program-chair/review/${paper.id}`)}
                    className="w-full text-left rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 line-clamp-1">{paper.title}</p>
                        <p className="text-xs text-slate-500 mt-1">Deadline: {formatDate(paper.review_deadline_at)}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${overdue ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                        <AlertTriangle size={12} />
                        {overdue ? `Overdue by ${Math.abs(paper.hoursUntilDeadline)}h` : `${paper.hoursUntilDeadline}h left`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Program Topic Trends */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Program Topic Trends</h2>
            <span className="text-xs font-semibold text-slate-500">Top keywords in your program</span>
          </div>
          {topKeywords.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500">
              No keyword data yet for this program.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="space-y-3">
                {topKeywords.slice(0, 8).map((item) => {
                  const max = topKeywords[0]?.count || 1;
                  const widthPct = Math.max(8, Math.round((item.count / max) * 100));
                  return (
                    <div key={item.keyword} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-700 capitalize">{item.keyword}</span>
                        <span className="text-slate-500">{item.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500" style={{ width: `${widthPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Recent Submissions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Recent Submissions</h2>
            <button onClick={() => navigate('/program-chair/review')} className="text-sm font-semibold text-teal-600 hover:text-teal-800 flex items-center gap-1 transition-colors">
              View all <ChevronRight size={16} />
            </button>
          </div>

          {recentPapers.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-slate-200 p-12 text-center">
              <FileText size={36} className="text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No papers assigned to you yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentPapers.map(paper => (
                <div
                  key={paper.id}
                  onClick={() => navigate(`/program-chair/review/${paper.id}`)}
                  className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-600 flex items-center justify-center flex-shrink-0">
                    <FileText size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 group-hover:text-inherit line-clamp-1">{paper.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>{formatFullName(paper.users) || 'Unknown'}</span>
                      <span>&middot;</span>
                      <span>{formatDate(paper.submission_date || paper.created_at)}</span>
                    </div>
                  </div>
                  <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${getStatusColor(paper.status)}`}>
                    {getStatusBadge(paper.status)}
                  </span>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgramChairDashboard;
