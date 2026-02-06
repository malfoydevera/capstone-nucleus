import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, 
  FileText, 
  Clock, 
  CheckCircle, 
  TrendingUp,
  Eye,
  Calendar,
  Award,
  BarChart3,
  Zap,
  ChevronRight
} from 'lucide-react';
import { researchAPI } from '../../utils/api';

const FacultyDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    pendingReview: 0,
    approved: 0,
    totalAssigned: 0,
    thisMonth: 0
  });
  const [recentPapers, setRecentPapers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await researchAPI.getFacultyAssignedPapers();
      const papers = response.data.papers;

      // Calculate stats
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      setStats({
        pendingReview: papers.filter(p => p.status === 'pending_faculty').length,
        approved: papers.filter(p => ['pending_editor', 'pending_admin', 'approved'].includes(p.status)).length,
        totalAssigned: papers.length,
        thisMonth: papers.filter(p => new Date(p.created_at) >= firstDayOfMonth).length
      });

      // Get recent papers (last 5)
      const sortedPapers = [...papers].sort((a, b) => 
        new Date(b.submission_date || b.created_at) - new Date(a.submission_date || a.created_at)
      );
      setRecentPapers(sortedPapers.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending_faculty: { label: 'Pending Review', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      pending_editor: { label: 'With Editor', class: 'bg-blue-100 text-blue-800 border-blue-200' },
      pending_admin: { label: 'With Admin', class: 'bg-purple-100 text-purple-800 border-purple-200' },
      approved: { label: 'Approved', class: 'bg-green-100 text-green-800 border-green-200' },
      rejected: { label: 'Rejected', class: 'bg-red-100 text-red-800 border-red-200' },
      revision_required: { label: 'Revision Required', class: 'bg-orange-100 text-orange-800 border-orange-200' }
    };
    return badges[status] || badges.pending_faculty;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-indigo-100 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn">
      {/* Welcome Header */}
      <div className="mb-10">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg">
            <GraduationCap size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
              Welcome, Faculty Member
            </h1>
            <p className="text-lg text-slate-600 font-medium">
              Your research review dashboard
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl border-2 border-yellow-200 p-6 shadow-lg transform transition-all duration-300 hover:scale-105">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center shadow-md">
              <Clock size={24} className="text-white" />
            </div>
            <span className="px-3 py-1 rounded-full bg-yellow-200 text-yellow-800 text-xs font-bold">
              Action Needed
            </span>
          </div>
          <p className="text-yellow-700 font-semibold mb-1">Pending Review</p>
          <p className="text-4xl font-black text-yellow-900 mb-2">{stats.pendingReview}</p>
          <p className="text-sm text-yellow-600">Awaiting your review</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200 p-6 shadow-lg transform transition-all duration-300 hover:scale-105">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-md">
              <CheckCircle size={24} className="text-white" />
            </div>
            <span className="px-3 py-1 rounded-full bg-green-200 text-green-800 text-xs font-bold">
              Approved
            </span>
          </div>
          <p className="text-green-700 font-semibold mb-1">Approved by You</p>
          <p className="text-4xl font-black text-green-900 mb-2">{stats.approved}</p>
          <p className="text-sm text-green-600">Moved forward</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border-2 border-indigo-200 p-6 shadow-lg transform transition-all duration-300 hover:scale-105">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-md">
              <FileText size={24} className="text-white" />
            </div>
          </div>
          <p className="text-indigo-700 font-semibold mb-1">Total Assigned</p>
          <p className="text-4xl font-black text-indigo-900 mb-2">{stats.totalAssigned}</p>
          <p className="text-sm text-indigo-600">All-time papers</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200 p-6 shadow-lg transform transition-all duration-300 hover:scale-105">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
              <TrendingUp size={24} className="text-white" />
            </div>
          </div>
          <p className="text-purple-700 font-semibold mb-1">This Month</p>
          <p className="text-4xl font-black text-purple-900 mb-2">{stats.thisMonth}</p>
          <p className="text-sm text-purple-600">New submissions</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <button
          onClick={() => navigate('/faculty/review')}
          className="bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-2xl p-8 shadow-2xl hover:shadow-indigo-500/25 transition-all duration-500 transform hover:scale-105 text-left group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Eye size={28} className="text-white" />
            </div>
            <ChevronRight size={28} className="text-white/80 group-hover:translate-x-1 transition-transform duration-300" />
          </div>
          <h3 className="text-2xl font-bold mb-2">Review Submissions</h3>
          <p className="text-indigo-100 text-lg">
            {stats.pendingReview > 0 
              ? `${stats.pendingReview} paper${stats.pendingReview !== 1 ? 's' : ''} awaiting your review`
              : 'No papers pending review'}
          </p>
        </button>

        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 p-8 shadow-lg">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
              <Award size={28} className="text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-900 mb-1">Your Impact</h3>
              <p className="text-slate-600">You've reviewed {stats.totalAssigned} research submissions</p>
            </div>
          </div>
          <div className="flex items-center gap-4 pt-4 border-t border-slate-200">
            <div className="flex-1">
              <p className="text-sm text-slate-600 mb-1">Approval Rate</p>
              <p className="text-2xl font-bold text-slate-900">
                {stats.totalAssigned > 0 ? Math.round((stats.approved / stats.totalAssigned) * 100) : 0}%
              </p>
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-600 mb-1">This Month</p>
              <p className="text-2xl font-bold text-slate-900">{stats.thisMonth}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Papers */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 p-8 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
              <FileText size={20} className="text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Recent Assignments</h2>
          </div>
          <button
            onClick={() => navigate('/faculty/review')}
            className="text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-2 transition-colors duration-300"
          >
            View All
            <ChevronRight size={18} />
          </button>
        </div>

        {recentPapers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <FileText size={28} className="text-slate-400" />
            </div>
            <p className="text-slate-600 text-lg">No papers assigned yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentPapers.map((paper) => {
              const statusBadge = getStatusBadge(paper.status);
              
              return (
                <div
                  key={paper.id}
                  onClick={() => navigate(`/faculty/review/${paper.id}`)}
                  className="p-5 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 transition-all duration-300 cursor-pointer group hover:border-indigo-300"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors duration-300 mb-2 line-clamp-1">
                        {paper.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                        <span className="font-medium">{paper.users?.full_name}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {formatDate(paper.submission_date || paper.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full border text-xs font-bold ${statusBadge.class}`}>
                        {statusBadge.label}
                      </span>
                      <ChevronRight size={20} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all duration-300" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FacultyDashboard;
