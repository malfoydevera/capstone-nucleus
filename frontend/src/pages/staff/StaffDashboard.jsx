import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle,
  TrendingUp,
  Eye,
  Calendar,
  Award,
  ChevronRight,
  Search,
  Download,
  BookOpen,
  Users
} from 'lucide-react';
import { researchAPI } from '../../utils/api';

const StaffDashboard = () => {
  const navigate = useNavigate();

  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const researchRes = await researchAPI.getAllResearch();
      setPapers(researchRes.data?.papers || researchRes.data || []);
    } catch (err) {
      console.error('Staff dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ── Derived statistics ──
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const pendingPapers = papers.filter(p =>
    ['pending', 'pending_editor', 'pending_admin', 'under_review'].includes(p.status)
  );
  const approvedPapers = papers.filter(p => p.status === 'approved' || p.status === 'published');
  const rejectedPapers = papers.filter(p => p.status === 'rejected');
  const revisionPapers = papers.filter(p => p.status === 'revision_required');
  const reviewedPapers = [...approvedPapers, ...rejectedPapers, ...revisionPapers];

  const papersThisMonth = papers.filter(p => new Date(p.created_at || p.submission_date) >= firstOfMonth).length;
  const reviewedThisMonth = reviewedPapers.filter(p => new Date(p.updated_at || p.created_at) >= firstOfMonth).length;

  const approvalRate = reviewedPapers.length > 0
    ? Math.round((approvedPapers.length / reviewedPapers.length) * 100)
    : 0;

  const uniqueStudents = new Set(papers.map(p => p.author_id || p.users?.id)).size;

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
              <Award size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-1">
                Welcome, Staff Member
              </h1>
              <p className="text-lg text-slate-500 font-medium">
                Your editorial review dashboard
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
          <p className="text-yellow-700 font-semibold mb-1">Pending Reviews</p>
          <p className="text-4xl font-black text-yellow-900 mb-2">{pendingPapers.length}</p>
          <p className="text-sm text-yellow-600">Awaiting your review</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200 p-6 shadow-lg transform transition-all duration-300 hover:scale-105">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-md">
              <CheckCircle size={24} className="text-white" />
            </div>
            <span className="px-3 py-1 rounded-full bg-green-200 text-green-800 text-xs font-bold">
              {approvalRate}% rate
            </span>
          </div>
          <p className="text-green-700 font-semibold mb-1">Reviewed This Month</p>
          <p className="text-4xl font-black text-green-900 mb-2">{reviewedThisMonth}</p>
          <p className="text-sm text-green-600">{reviewedPapers.length} total reviewed</p>
        </div>

        <div className="bg-gradient-to-br from-[#1C4D8D]/10 to-[#2563eb]/10 rounded-2xl border-2 border-[#1C4D8D]/20 p-6 shadow-lg transform transition-all duration-300 hover:scale-105">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1C4D8D] to-[#2563eb] flex items-center justify-center shadow-md">
              <BookOpen size={24} className="text-white" />
            </div>
          </div>
          <p className="text-[#1C4D8D] font-semibold mb-1">Total Papers</p>
          <p className="text-4xl font-black text-slate-900 mb-2">{papers.length}</p>
          <p className="text-sm text-[#1C4D8D]/80">+{papersThisMonth} this month</p>
        </div>

        <div className="bg-gradient-to-br from-[#1C4D8D]/10 to-[#2563eb]/10 rounded-2xl border-2 border-[#1C4D8D]/20 p-6 shadow-lg transform transition-all duration-300 hover:scale-105">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1C4D8D] to-[#2563eb] flex items-center justify-center shadow-md">
              <Users size={24} className="text-white" />
            </div>
          </div>
          <p className="text-[#1C4D8D] font-semibold mb-1">Student Researchers</p>
          <p className="text-4xl font-black text-slate-900 mb-2">{uniqueStudents}</p>
          <p className="text-sm text-[#1C4D8D]/80">Active contributors</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Quick Actions</h2>
        <div className="flex-1 h-px bg-slate-200"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <button
          onClick={() => navigate('/staff/review')}
          className="bg-gradient-to-br from-[#1C4D8D] to-[#2563eb] text-white rounded-2xl p-8 shadow-2xl hover:shadow-[#1C4D8D]/30 transition-all duration-500 transform hover:scale-[1.03] text-left group ring-0 hover:ring-4 ring-[#1C4D8D]/10"
        >
          <div className="flex items-start justify-between mb-5">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm group-hover:bg-white/30 transition-colors duration-300">
              <Eye size={28} className="text-white" />
            </div>
            <ChevronRight size={28} className="text-white/60 group-hover:text-white group-hover:translate-x-2 transition-all duration-300" />
          </div>
          <h3 className="text-2xl font-bold mb-2">Review Submissions</h3>
          <p className="text-white/80 text-lg">
            {pendingPapers.length > 0
              ? `${pendingPapers.length} paper${pendingPapers.length !== 1 ? 's' : ''} awaiting your review`
              : 'No papers pending review'}
          </p>
        </button>

        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 p-8 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
              <TrendingUp size={28} className="text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-900 mb-1">Your Performance</h3>
              <p className="text-slate-500 text-sm">Processed {reviewedPapers.length} research submissions</p>
            </div>
          </div>
          <div className="flex items-center gap-4 pt-4 border-t border-dashed border-slate-200">
            <div className="flex-1 text-center">
              <p className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Approval Rate</p>
              <p className="text-2xl font-black text-slate-900">{approvalRate}%</p>
            </div>
            <div className="w-px h-10 bg-slate-200"></div>
            <div className="flex-1 text-center">
              <p className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">This Month</p>
              <p className="text-2xl font-black text-slate-900">{reviewedThisMonth}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        <button
          onClick={() => navigate('/staff/repository')}
          className="bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 text-left group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Search size={24} className="text-white" />
            </div>
            <ChevronRight size={22} className="text-white/70 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-lg font-bold">Browse Repository</p>
          <p className="text-sm text-white/80 mt-1">Explore research papers</p>
        </button>

        <button
          onClick={() => navigate('/staff/settings')}
          className="bg-gradient-to-br from-slate-600 to-slate-800 text-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 text-left group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Award size={24} className="text-white" />
            </div>
            <ChevronRight size={22} className="text-white/70 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-lg font-bold">Settings</p>
          <p className="text-sm text-white/80 mt-1">Account preferences</p>
        </button>
      </div>

      {/* Engagement + Status Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
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
              <p className="text-2xl font-black text-slate-900">{uniqueStudents}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wide">Researchers</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1C4D8D]/10 to-[#2563eb]/10 flex items-center justify-center">
              <TrendingUp size={20} className="text-[#1C4D8D]" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Status Breakdown</h2>
          </div>

          <div className="space-y-4">
            {[
              { label: 'Pending', count: pendingPapers.length, gradient: 'from-yellow-500 to-amber-500' },
              { label: 'Approved', count: approvedPapers.length, gradient: 'from-green-500 to-emerald-500' },
              { label: 'Revision Required', count: revisionPapers.length, gradient: 'from-amber-500 to-orange-500' },
              { label: 'Rejected', count: rejectedPapers.length, gradient: 'from-red-500 to-rose-500' },
            ].map((item, i) => {
              const pct = papers.length > 0 ? Math.round((item.count / papers.length) * 100) : 0;
              return (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                    <span className="text-sm font-bold text-slate-900">{item.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${item.gradient} transition-all duration-500`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
            <div className="pt-3 mt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm text-slate-500 font-medium">Total</span>
              <span className="text-lg font-bold text-slate-900">{papers.length}</span>
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
            onClick={() => navigate('/staff/review')}
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
                  onClick={() => navigate(`/staff/review/${paper.id}`)}
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

export default StaffDashboard;
