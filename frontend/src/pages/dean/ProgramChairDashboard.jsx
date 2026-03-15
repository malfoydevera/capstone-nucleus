import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Clock, CheckCircle, Eye, ChevronRight, RefreshCw,
  BookOpen, Users, Calendar
} from 'lucide-react';
import { researchAPI } from '../../utils/api';

const ProgramChairDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0, pending: 0, approved: 0, rejected: 0, revisionRequired: 0, thisMonth: 0
  });
  const [recentPapers, setRecentPapers] = useState([]);
  const [allPapers, setAllPapers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await researchAPI.getDeanChairAssignedPapers();
      const papers = response.data.papers || [];
      setAllPapers(papers);

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      setStats({
        total: papers.length,
        pending: papers.filter(p => p.status === 'pending_program_chair').length,
        approved: papers.filter(p => ['pending_editor', 'pending_admin', 'approved', 'published'].includes(p.status)).length,
        rejected: papers.filter(p => p.status === 'rejected').length,
        revisionRequired: papers.filter(p => p.status === 'revision_required').length,
        thisMonth: papers.filter(p => new Date(p.created_at) >= firstDayOfMonth).length
      });

      const sortedPapers = [...papers].sort((a, b) =>
        new Date(b.submission_date || b.created_at) - new Date(a.submission_date || a.created_at)
      );
      setRecentPapers(sortedPapers.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
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
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-600 flex items-center justify-center shadow-lg">
              <Users size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Program Chair Dashboard</h1>
              <p className="text-sm text-slate-500">
                Primary clearance reviewer &middot; {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <button onClick={fetchDashboardData} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-slate-300 transition-all text-sm font-semibold">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Primary Reviewer Banner */}
        <div className="mb-8 bg-gradient-to-r from-teal-600 to-cyan-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <Users size={24} className="text-white/80" />
            <h2 className="text-lg font-bold">Primary Clearance Reviewer</h2>
          </div>
          <p className="text-teal-100 text-sm">You are the primary person responsible for reviewing and processing student clearance requests forwarded by advisers.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200 rounded-2xl border-2 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-teal-700 mb-1">Awaiting Review</p>
                <p className="text-4xl font-black text-slate-900">{stats.pending}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                <Clock size={20} className="text-white" />
              </div>
            </div>
            <p className="text-xs mt-3 text-teal-600">Requires your approval</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 rounded-2xl border-2 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-700 mb-1">Approved</p>
                <p className="text-4xl font-black text-slate-900">{stats.approved}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                <CheckCircle size={20} className="text-white" />
              </div>
            </div>
            <p className="text-xs text-emerald-600 mt-3">Forwarded to Editor</p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 rounded-2xl border-2 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-orange-700 mb-1">Revision Sent</p>
                <p className="text-4xl font-black text-slate-900">{stats.revisionRequired}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <Eye size={20} className="text-white" />
              </div>
            </div>
            <p className="text-xs text-orange-600 mt-3">Returned to student</p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 rounded-2xl border-2 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-700 mb-1">Total Assigned</p>
                <p className="text-4xl font-black text-slate-900">{stats.total}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                <BookOpen size={20} className="text-white" />
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-3">All-time assignments</p>
          </div>
        </div>

        {/* Approval Rate */}
        {reviewedPapers > 0 && (
          <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-2xl p-6 text-white mb-10 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium mb-1">Your Approval Rate</p>
                <p className="text-4xl font-black">{approvalRate}%</p>
                <p className="text-white/70 text-xs mt-1">{reviewedPapers} papers reviewed in total</p>
              </div>
              <Users size={60} className="text-white/20" />
            </div>
          </div>
        )}

        {/* Recent Submissions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Recent Submissions</h2>
            <button onClick={() => navigate('/dean/review')} className="text-sm font-semibold text-teal-600 hover:text-teal-800 flex items-center gap-1 transition-colors">
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
                  onClick={() => navigate(`/dean/review/${paper.id}`)}
                  className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-600 flex items-center justify-center flex-shrink-0">
                    <FileText size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 group-hover:text-inherit line-clamp-1">{paper.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>{paper.users?.full_name || 'Unknown'}</span>
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
