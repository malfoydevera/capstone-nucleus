import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  FileText,
  Shield,
  Clock,
  CheckCircle,
  TrendingUp,
  Eye,
  Calendar,
  Award,
  BarChart3,
  ChevronRight,
  Download,
  BookOpen,
  GraduationCap
} from 'lucide-react';
import { researchAPI, authAPI } from '../../utils/api';

const AdminDashboard = () => {
  const navigate = useNavigate();

  const [papers, setPapers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [papersRes, usersRes] = await Promise.all([
        researchAPI.getAllResearch(),
        authAPI.getAllUsers()
      ]);
      setPapers(papersRes.data?.papers || papersRes.data || []);
      setAllUsers(usersRes.data?.users || usersRes.data || []);
    } catch (err) {
      console.error('Admin dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ── Derived stats ──
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const usersByRole = {
    student: allUsers.filter(u => u.role === 'student').length,
    faculty: allUsers.filter(u => u.role === 'faculty').length,
    staff: allUsers.filter(u => u.role === 'staff').length,
    admin: allUsers.filter(u => u.role === 'admin').length,
  };

  const pendingPapers = papers.filter(p =>
    ['pending', 'pending_faculty', 'pending_editor', 'pending_admin', 'under_review'].includes(p.status)
  );
  const approvedPapers = papers.filter(p => p.status === 'approved' || p.status === 'published');
  const rejectedPapers = papers.filter(p => p.status === 'rejected');

  const papersThisMonth = papers.filter(p => new Date(p.created_at || p.submission_date) >= firstOfMonth).length;
  const usersThisMonth = allUsers.filter(u => new Date(u.created_at) >= firstOfMonth).length;

  const totalViews = papers.reduce((s, p) => s + (p.view_count || 0), 0);
  const totalDownloads = papers.reduce((s, p) => s + (p.download_count || 0), 0);

  const recentPapers = [...papers]
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
    .slice(0, 5);

  const formatDate = (dateString) => {
    if (!dateString) return 'Recently';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { label: 'Pending', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      pending_faculty: { label: 'With Faculty', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      pending_editor: { label: 'With Editor', class: 'bg-blue-100 text-blue-800 border-blue-200' },
      pending_admin: { label: 'With Admin', class: 'bg-[#1C4D8D]/10 text-[#1C4D8D] border-[#1C4D8D]/20' },
      under_review: { label: 'Under Review', class: 'bg-blue-100 text-blue-800 border-blue-200' },
      approved: { label: 'Approved', class: 'bg-green-100 text-green-800 border-green-200' },
      published: { label: 'Published', class: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
      rejected: { label: 'Rejected', class: 'bg-red-100 text-red-800 border-red-200' },
      revision_required: { label: 'Revision Required', class: 'bg-orange-100 text-orange-800 border-orange-200' }
    };
    return badges[status] || { label: 'Unknown', class: 'bg-gray-100 text-gray-800 border-gray-200' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-[#1C4D8D]/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-[#1C4D8D] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn">
      {/* Welcome Header */}
      <div className="mb-10">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1C4D8D] to-[#2563eb] flex items-center justify-center shadow-lg shadow-[#1C4D8D]/20">
              <Shield size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-1">
                Welcome, Admin
              </h1>
              <p className="text-lg text-slate-500 font-medium">
                System administration dashboard
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium">
            <Calendar size={16} />
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-[#1C4D8D]/20 via-[#2563eb]/10 to-transparent"></div>
      </div>

      {/* Stats Grid */}
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Overview</h2>
        <div className="flex-1 h-px bg-slate-200"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl border-2 border-blue-200 p-6 shadow-lg transform transition-all duration-300 hover:scale-105">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md">
              <Users size={24} className="text-white" />
            </div>
            <span className="px-3 py-1 rounded-full bg-blue-200 text-blue-800 text-xs font-bold">
              +{usersThisMonth} new
            </span>
          </div>
          <p className="text-blue-700 font-semibold mb-1">Total Users</p>
          <p className="text-4xl font-black text-blue-900 mb-2">{allUsers.length}</p>
          <p className="text-sm text-blue-600">{usersByRole.student} students · {usersByRole.faculty} faculty</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl border-2 border-emerald-200 p-6 shadow-lg transform transition-all duration-300 hover:scale-105">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-md">
              <FileText size={24} className="text-white" />
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-200 text-emerald-800 text-xs font-bold">
              +{papersThisMonth} new
            </span>
          </div>
          <p className="text-emerald-700 font-semibold mb-1">Research Papers</p>
          <p className="text-4xl font-black text-emerald-900 mb-2">{papers.length}</p>
          <p className="text-sm text-emerald-600">{approvedPapers.length} approved · {rejectedPapers.length} rejected</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl border-2 border-yellow-200 p-6 shadow-lg transform transition-all duration-300 hover:scale-105">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center shadow-md">
              <Clock size={24} className="text-white" />
            </div>
            {pendingPapers.length > 0 && (
              <span className="px-3 py-1 rounded-full bg-yellow-200 text-yellow-800 text-xs font-bold">
                Action Needed
              </span>
            )}
          </div>
          <p className="text-yellow-700 font-semibold mb-1">Pending Review</p>
          <p className="text-4xl font-black text-yellow-900 mb-2">{pendingPapers.length}</p>
          <p className="text-sm text-yellow-600">Awaiting approval</p>
        </div>

        <div className="bg-gradient-to-br from-[#1C4D8D]/10 to-[#2563eb]/10 rounded-2xl border-2 border-[#1C4D8D]/20 p-6 shadow-lg transform transition-all duration-300 hover:scale-105">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1C4D8D] to-[#2563eb] flex items-center justify-center shadow-md">
              <CheckCircle size={24} className="text-white" />
            </div>
          </div>
          <p className="text-[#1C4D8D] font-semibold mb-1">Approved / Published</p>
          <p className="text-4xl font-black text-slate-900 mb-2">{approvedPapers.length}</p>
          <p className="text-sm text-[#1C4D8D]/80">All-time approved</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Quick Actions</h2>
        <div className="flex-1 h-px bg-slate-200"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <button
          onClick={() => navigate('/admin/users')}
          className="bg-gradient-to-br from-[#1C4D8D] to-[#2563eb] text-white rounded-2xl p-8 shadow-2xl hover:shadow-[#1C4D8D]/30 transition-all duration-500 transform hover:scale-[1.03] text-left group ring-0 hover:ring-4 ring-[#1C4D8D]/10"
        >
          <div className="flex items-start justify-between mb-5">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm group-hover:bg-white/30 transition-colors duration-300">
              <Users size={28} className="text-white" />
            </div>
            <ChevronRight size={28} className="text-white/60 group-hover:text-white group-hover:translate-x-2 transition-all duration-300" />
          </div>
          <h3 className="text-2xl font-bold mb-2">User Management</h3>
          <p className="text-white/70 text-base">
            {allUsers.length} registered users · {usersThisMonth} joined this month
          </p>
        </button>

        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 p-8 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center">
              <TrendingUp size={28} className="text-emerald-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-900 mb-1">System Overview</h3>
              <p className="text-slate-500 text-sm">Platform engagement metrics</p>
            </div>
          </div>
          <div className="flex items-center gap-4 pt-4 border-t border-dashed border-slate-200">
            <div className="flex-1 text-center">
              <p className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Views</p>
              <p className="text-2xl font-black text-slate-900">{totalViews.toLocaleString()}</p>
            </div>
            <div className="w-px h-10 bg-slate-200"></div>
            <div className="flex-1 text-center">
              <p className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Downloads</p>
              <p className="text-2xl font-black text-slate-900">{totalDownloads.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <button
          onClick={() => navigate('/admin/papers')}
          className="bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 text-left group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <FileText size={24} className="text-white" />
            </div>
            <ChevronRight size={22} className="text-white/70 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-lg font-bold">Review Submissions</p>
          <p className="text-sm text-white/80 mt-1">{pendingPapers.length} papers pending</p>
        </button>

        <button
          onClick={() => navigate('/admin/analytics')}
          className="bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 text-left group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <BarChart3 size={24} className="text-white" />
            </div>
            <ChevronRight size={22} className="text-white/70 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-lg font-bold">Analytics</p>
          <p className="text-sm text-white/80 mt-1">View system reports</p>
        </button>

        <button
          onClick={() => navigate('/admin/settings')}
          className="bg-gradient-to-br from-slate-600 to-slate-800 text-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 text-left group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Shield size={24} className="text-white" />
            </div>
            <ChevronRight size={22} className="text-white/70 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-lg font-bold">Settings</p>
          <p className="text-sm text-white/80 mt-1">System configuration</p>
        </button>
      </div>

      {/* Users by Role + Engagement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1C4D8D]/10 to-[#2563eb]/10 flex items-center justify-center">
              <Users size={20} className="text-[#1C4D8D]" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Users by Role</h2>
          </div>

          <div className="space-y-4">
            {[
              { role: 'Students', count: usersByRole.student, icon: BookOpen, gradient: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50' },
              { role: 'Faculty', count: usersByRole.faculty, icon: GraduationCap, gradient: 'from-violet-500 to-purple-500', bg: 'bg-violet-50' },
              { role: 'Staff', count: usersByRole.staff, icon: Award, gradient: 'from-cyan-500 to-teal-500', bg: 'bg-cyan-50' },
              { role: 'Admins', count: usersByRole.admin, icon: Shield, gradient: 'from-red-500 to-rose-500', bg: 'bg-red-50' },
            ].map((item, i) => {
              const Icon = item.icon;
              const pct = allUsers.length > 0 ? Math.round((item.count / allUsers.length) * 100) : 0;
              return (
                <div key={i} className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={20} className="text-slate-700" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold text-slate-700">{item.role}</span>
                      <span className="text-sm font-bold text-slate-900">{item.count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full bg-gradient-to-r ${item.gradient} transition-all duration-500`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="pt-3 mt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-500 font-medium">Total Users</span>
              <span className="text-lg font-bold text-slate-900">{allUsers.length}</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1C4D8D]/10 to-[#2563eb]/10 flex items-center justify-center">
              <Eye size={20} className="text-[#1C4D8D]" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Engagement</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-5 rounded-xl bg-blue-50 border border-blue-100 hover:border-blue-300 hover:shadow-md transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mx-auto mb-3">
                <Eye size={20} className="text-blue-600" />
              </div>
              <p className="text-2xl font-black text-slate-900">{totalViews.toLocaleString()}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wide">Total Views</p>
            </div>
            <div className="text-center p-5 rounded-xl bg-emerald-50 border border-emerald-100 hover:border-emerald-300 hover:shadow-md transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <Download size={20} className="text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-slate-900">{totalDownloads.toLocaleString()}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wide">Downloads</p>
            </div>
            <div className="text-center p-5 rounded-xl bg-amber-50 border border-amber-100 hover:border-amber-300 hover:shadow-md transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center mx-auto mb-3">
                <Calendar size={20} className="text-amber-600" />
              </div>
              <p className="text-2xl font-black text-slate-900">{papersThisMonth}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wide">This Month</p>
            </div>
            <div className="text-center p-5 rounded-xl bg-violet-50 border border-violet-100 hover:border-violet-300 hover:shadow-md transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center mx-auto mb-3">
                <Users size={20} className="text-violet-600" />
              </div>
              <p className="text-2xl font-black text-slate-900">{usersThisMonth}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wide">New Users</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Papers */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 p-8 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1C4D8D]/10 to-[#2563eb]/10 flex items-center justify-center">
              <FileText size={20} className="text-[#1C4D8D]" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Recent Submissions</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold">{papers.length} total</span>
          </div>
          <button
            onClick={() => navigate('/admin/papers')}
            className="text-[#1C4D8D] hover:text-[#163a6b] font-semibold flex items-center gap-2 transition-colors duration-300 hover:gap-3"
          >
            View All
            <ChevronRight size={18} />
          </button>
        </div>

        {recentPapers.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <FileText size={32} className="text-slate-300" />
            </div>
            <p className="text-slate-500 text-lg font-medium">No papers submitted yet</p>
            <p className="text-slate-400 text-sm mt-1">Submissions will appear here as they come in</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentPapers.map((paper) => {
              const statusBadge = getStatusBadge(paper.status);
              return (
                <div
                  key={paper.id}
                  onClick={() => navigate(`/research/${paper.id}`)}
                  className="p-5 rounded-xl border-2 border-slate-200 bg-white hover:bg-[#1C4D8D]/[0.02] transition-all duration-300 cursor-pointer group hover:border-[#1C4D8D]/30 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#1C4D8D] transition-colors duration-300 mb-2 line-clamp-1">
                        {paper.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                        <span className="font-medium">{paper.users?.full_name || 'Unknown'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {formatDate(paper.submission_date || paper.created_at)}
                        </span>
                        {(paper.view_count > 0 || paper.download_count > 0) && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Eye size={14} /> {paper.view_count || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <Download size={14} /> {paper.download_count || 0}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full border text-xs font-bold ${statusBadge.class}`}>
                        {statusBadge.label}
                      </span>
                      <ChevronRight size={20} className="text-slate-400 group-hover:text-[#1C4D8D] group-hover:translate-x-1 transition-all duration-300" />
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

export default AdminDashboard;
