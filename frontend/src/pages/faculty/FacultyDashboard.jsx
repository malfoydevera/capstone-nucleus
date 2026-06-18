import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Search,
  BookOpen,
  ChevronRight,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { researchAPI, unwrapApiData } from '../../utils/api';
import { formatFullName } from '../../utils/names';
import UserGuideLink from '../../components/ui/UserGuideLink';

const FacultyDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0, pending: 0, approved: 0, rejected: 0, revisionRequired: 0, thisMonth: 0,
  });
  const [recentPapers, setRecentPapers] = useState([]);
  const [allPapers, setAllPapers] = useState([]);
  const [workload, setWorkload] = useState({ avgReviewDays: 0, overdueCount: 0, overdueThresholdDays: 7 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [response, workloadResponse] = await Promise.all([
        researchAPI.getFacultyAssignedPapers(),
        researchAPI.getFacultyWorkloadSummary(),
      ]);
      const papers = unwrapApiData(response).papers || [];
      const workloadPayload = unwrapApiData(workloadResponse);
      const workloadData = workloadPayload.summary || {};
      const overdueThresholdDays = workloadPayload.overdueThresholdDays || 7;
      setAllPapers(papers);
      setWorkload({
        avgReviewDays: Number(workloadData.avgReviewDays || 0),
        overdueCount: Number(workloadData.overdueCount || 0),
        overdueThresholdDays,
      });

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const statistics = {
        total: papers.length,
        pending: papers.filter((p) => p.status === 'pending_faculty').length,
        approved: papers.filter((p) => ['pending_editor', 'pending_admin', 'approved', 'published'].includes(p.status)).length,
        rejected: papers.filter((p) => p.status === 'rejected').length,
        revisionRequired: papers.filter((p) => p.status === 'revision_required').length,
        thisMonth: papers.filter((p) => new Date(p.created_at) >= firstDayOfMonth).length,
      };
      setStats(statistics);

      const sortedPapers = [...papers].sort(
        (a, b) => new Date(b.submission_date || b.created_at) - new Date(a.submission_date || a.created_at),
      );
      setRecentPapers(sortedPapers.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setStats({ total: 0, pending: 0, approved: 0, rejected: 0, revisionRequired: 0, thisMonth: 0 });
      setWorkload({ avgReviewDays: 0, overdueCount: 0, overdueThresholdDays: 7 });
      setRecentPapers([]);
      setAllPapers([]);
    } finally {
      setLoading(false);
    }
  };

  const reviewedPapers = stats.approved + stats.rejected + stats.revisionRequired;
  const approvalRate = reviewedPapers > 0 ? Math.round((stats.approved / reviewedPapers) * 100) : 0;

  const getStatusColor = (status) => {
    const colors = {
      pending_faculty: 'text-amber-600 bg-amber-50 border-amber-100',
      pending_editor: 'text-blue-600 bg-blue-50 border-blue-100',
      pending_admin: 'text-indigo-600 bg-indigo-50 border-indigo-100',
      approved: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      published: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      rejected: 'text-red-600 bg-red-50 border-red-100',
      revision_required: 'text-orange-600 bg-orange-50 border-orange-100',
    };
    return colors[status] || 'text-slate-600 bg-slate-50 border-slate-100';
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const getStatusBadge = (status) => {
    const statusMap = {
      pending_faculty: 'Pending Review',
      pending_editor: 'With Editor',
      pending_admin: 'With Admin',
      approved: 'Approved',
      published: 'Published',
      rejected: 'Rejected',
      revision_required: 'Revision',
    };
    return statusMap[status] || status;
  };

  const taskCards = useMemo(() => [
    {
      key: 'pending',
      label: 'Pending Review',
      count: stats.pending,
      icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      description: workload.overdueCount > 0
        ? `${workload.overdueCount} overdue item${workload.overdueCount > 1 ? 's' : ''}`
        : stats.pending > 0
          ? 'Awaiting your review'
          : 'All caught up',
      onClick: () => navigate('/faculty/review'),
    },
    {
      key: 'approved',
      label: 'Completed',
      count: stats.approved,
      icon: CheckCircle,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      description: reviewedPapers > 0 ? `${approvalRate}% approval rate` : 'Approved or forwarded',
      onClick: () => navigate('/faculty/review'),
    },
    {
      key: 'revision',
      label: 'Needs Attention',
      count: stats.revisionRequired,
      icon: AlertCircle,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      description: 'Revisions requested from students',
      onClick: () => navigate('/faculty/review'),
    },
  ], [stats, workload.overdueCount, approvalRate, reviewedPapers, navigate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] animate-fadeIn">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-200 rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#3674B5] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="mt-4 text-sm text-slate-500">Loading dashboard...</p>
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
          </div>
          <div className="flex items-center gap-3">
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'Faculty')}&background=3674B5&color=fff`}
              alt=""
              className="w-9 h-9 rounded-full shrink-0"
            />
            <span className="text-sm font-medium text-slate-700 truncate">{user?.fullName}</span>
          </div>
        </div>

        <UserGuideLink />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-6 sm:mb-8">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-6 sm:mb-8">
          <button
            type="button"
            onClick={() => navigate('/faculty/review')}
            className="group bg-gradient-to-br from-[#3674B5] to-[#578FCA] rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5 sm:col-span-2 lg:col-span-1"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Eye size={22} className="text-white sm:w-6 sm:h-6" aria-hidden="true" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-semibold text-white">Review Papers</p>
                <p className="text-sm text-blue-100 truncate">
                  {stats.pending > 0 ? `${stats.pending} pending review` : 'No pending reviews'}
                </p>
              </div>
              <ChevronRight size={20} className="text-white/70 ml-auto shrink-0 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/faculty/review')}
            className="group bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#3674B5]/10 flex items-center justify-center shrink-0">
                <BookOpen size={22} className="text-[#3674B5] sm:w-6 sm:h-6" aria-hidden="true" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-semibold text-slate-900">Assigned Papers</p>
                <p className="text-sm text-slate-500">{allPapers.length} total</p>
              </div>
              <ChevronRight size={20} className="text-slate-300 ml-auto shrink-0 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/faculty/repository')}
            className="group bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all hover:-translate-y-0.5 sm:col-span-2 lg:col-span-1"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <Search size={22} className="text-emerald-600 sm:w-6 sm:h-6" aria-hidden="true" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-semibold text-slate-900">Browse Repository</p>
                <p className="text-sm text-slate-500">Explore all papers</p>
              </div>
              <ChevronRight size={20} className="text-slate-300 ml-auto shrink-0 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </div>
          </button>
        </div>

        {stats.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-100 shadow-sm">
              <p className="text-xs text-slate-500 mb-1">Total Assigned</p>
              <p className="text-lg sm:text-xl font-bold text-slate-900">{stats.total}</p>
            </div>
            <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-100 shadow-sm">
              <p className="text-xs text-slate-500 mb-1">This Month</p>
              <p className="text-lg sm:text-xl font-bold text-slate-900">{stats.thisMonth}</p>
            </div>
            <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-100 shadow-sm">
              <p className="text-xs text-slate-500 mb-1">Avg Review</p>
              <p className="text-lg sm:text-xl font-bold text-slate-900">
                {workload.avgReviewDays}
                <span className="text-xs font-normal text-slate-400 ml-1">days</span>
              </p>
            </div>
            <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-100 shadow-sm">
              <p className="text-xs text-slate-500 mb-1">Overdue</p>
              <p className={`text-lg sm:text-xl font-bold ${workload.overdueCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {workload.overdueCount}
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-900">Assigned Papers</h3>
            <button
              type="button"
              onClick={fetchDashboardData}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
              aria-label="Refresh assigned papers"
            >
              <RefreshCw size={16} className="text-slate-400" />
            </button>
          </div>

          {recentPapers.length === 0 ? (
            <div className="px-4 sm:px-5 py-10 sm:py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <FileText size={24} className="text-slate-400" aria-hidden="true" />
              </div>
              <p className="text-slate-600 font-medium mb-1">No papers assigned</p>
              <p className="text-sm text-slate-400 mb-4">Papers will appear here when assigned to you</p>
              <button
                type="button"
                onClick={() => navigate('/faculty/repository')}
                className="px-4 py-2 bg-[#3674B5] text-white text-sm font-medium rounded-lg hover:bg-[#2d6299] transition-colors"
              >
                Browse Repository
              </button>
            </div>
          ) : (
            <>
              <div className="md:hidden divide-y divide-slate-100">
                {recentPapers.map((paper) => (
                  <button
                    key={paper.id}
                    type="button"
                    onClick={() => navigate(`/faculty/review/${paper.id}`)}
                    className="w-full text-left px-4 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText size={16} className="text-slate-500" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 line-clamp-2">{paper.title}</p>
                        <p className="text-xs text-slate-500 mt-1 truncate">
                          {formatFullName(paper.users) || 'Unknown'} · {formatDate(paper.submission_date || paper.created_at)}
                        </p>
                        <span className={`inline-flex mt-2 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(paper.status)}`}>
                          {getStatusBadge(paper.status)}
                        </span>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 shrink-0 mt-1" aria-hidden="true" />
                    </div>
                  </button>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Title</th>
                      <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">Author</th>
                      <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden xl:table-cell">Date</th>
                      <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentPapers.map((paper) => (
                      <tr
                        key={paper.id}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/faculty/review/${paper.id}`)}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                              <FileText size={16} className="text-slate-500" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                              <span className="block font-medium text-slate-900 truncate max-w-[220px] lg:max-w-[280px]">{paper.title}</span>
                              <span className="block text-xs text-slate-500 lg:hidden truncate">
                                {formatFullName(paper.users) || 'Unknown'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600 hidden lg:table-cell">
                          {formatFullName(paper.users) || 'Unknown'}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-500 hidden xl:table-cell">
                          {formatDate(paper.submission_date || paper.created_at)}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(paper.status)}`}>
                            {getStatusBadge(paper.status)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <ChevronRight size={16} className="text-slate-300" aria-hidden="true" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacultyDashboard;
