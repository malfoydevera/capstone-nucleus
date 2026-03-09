import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  FileText,
  Clock,
  Eye,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  ChevronRight,
  RefreshCw,
  Award,
  BookOpen,
  Users
} from 'lucide-react';
import { researchAPI } from '../../utils/api';

const DeanChairReview = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [papers, setPapers] = useState([]);
  const [filteredPapers, setFilteredPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('needs_review');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    pendingReview: 0, revisionRequired: 0, forwarded: 0, total: 0
  });

  const isDean = user?.role === 'dean';
  const pendingStatus = isDean ? 'pending_dean' : 'pending_program_chair';
  const accentFrom = isDean ? 'from-violet-600' : 'from-teal-600';
  const accentTo = isDean ? 'to-purple-600' : 'to-cyan-600';
  const accentRing = isDean ? 'focus:ring-violet-500' : 'focus:ring-teal-500';
  const accentSpinner = isDean ? 'border-violet-600' : 'border-teal-600';

  useEffect(() => {
    fetchPapers();
    const interval = setInterval(() => fetchPapers(true), 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterAndSearchPapers();
  }, [papers, statusFilter, searchTerm]);

  const fetchPapers = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await researchAPI.getDeanChairAssignedPapers();
      const allPapers = response.data.papers || [];
      setPapers(allPapers);
      setStats({
        pendingReview: allPapers.filter(p => p.status === pendingStatus).length,
        revisionRequired: allPapers.filter(p => p.status === 'revision_required').length,
        forwarded: allPapers.filter(p => ['pending_editor', 'pending_admin', 'approved', 'published'].includes(p.status)).length,
        total: allPapers.length
      });
    } catch (error) {
      console.error('Failed to fetch papers:', error);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const filterAndSearchPapers = () => {
    let filtered = [...papers];
    if (statusFilter === 'needs_review') {
      filtered = papers.filter(p => p.status === pendingStatus);
    } else if (statusFilter === 'revision_required') {
      filtered = papers.filter(p => p.status === 'revision_required');
    } else if (statusFilter === 'forwarded') {
      filtered = papers.filter(p => ['pending_editor', 'pending_admin', 'approved', 'published'].includes(p.status));
    }
    // else 'all' — show everything

    if (searchTerm) {
      const lc = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.title?.toLowerCase().includes(lc) ||
        p.abstract?.toLowerCase().includes(lc) ||
        p.users?.full_name?.toLowerCase().includes(lc) ||
        p.keywords?.some(k => k.toLowerCase().includes(lc))
      );
    }

    filtered.sort((a, b) =>
      new Date(b.submission_date || b.created_at) - new Date(a.submission_date || a.created_at)
    );

    setFilteredPapers(filtered);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil(Math.abs(now - date) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusConfig = (status) => {
    const configs = {
      pending_dean: {
        color: 'from-violet-100 to-purple-50 border-violet-200',
        text: 'text-violet-800',
        icon: Clock,
        label: 'Awaiting Your Approval',
        badge: 'bg-gradient-to-r from-violet-500 to-purple-500',
        priority: 'high'
      },
      pending_program_chair: {
        color: 'from-teal-100 to-cyan-50 border-teal-200',
        text: 'text-teal-800',
        icon: Clock,
        label: 'Awaiting Your Approval',
        badge: 'bg-gradient-to-r from-teal-500 to-cyan-500',
        priority: 'high'
      },
      pending_editor: {
        color: 'from-blue-100 to-cyan-50 border-blue-200',
        text: 'text-blue-800',
        icon: Eye,
        label: 'With Research Editor',
        badge: 'bg-gradient-to-r from-blue-500 to-cyan-500',
        priority: 'medium'
      },
      pending_admin: {
        color: 'from-indigo-100 to-blue-50 border-indigo-200',
        text: 'text-indigo-800',
        icon: Award,
        label: 'With Admin',
        badge: 'bg-gradient-to-r from-indigo-500 to-blue-500',
        priority: 'medium'
      },
      approved: {
        color: 'from-green-100 to-emerald-50 border-green-200',
        text: 'text-green-800',
        icon: CheckCircle,
        label: 'Approved & Published',
        badge: 'bg-gradient-to-r from-green-500 to-emerald-500',
        priority: 'low'
      },
      rejected: {
        color: 'from-red-100 to-pink-50 border-red-200',
        text: 'text-red-800',
        icon: XCircle,
        label: 'Rejected',
        badge: 'bg-gradient-to-r from-red-500 to-pink-500',
        priority: 'low'
      },
      revision_required: {
        color: 'from-orange-100 to-amber-50 border-orange-200',
        text: 'text-orange-800',
        icon: AlertCircle,
        label: 'Revision Required',
        badge: 'bg-gradient-to-r from-orange-500 to-amber-500',
        priority: 'medium'
      }
    };
    return configs[status] || configs[pendingStatus];
  };

  const filterOptions = [
    { id: 'needs_review', label: 'Needs Review', count: stats.pendingReview, color: isDean ? 'from-violet-500 to-purple-500' : 'from-teal-500 to-cyan-500' },
    { id: 'revision_required', label: 'Revision Sent', count: stats.revisionRequired, color: 'from-orange-500 to-red-500' },
    { id: 'forwarded', label: 'Forwarded', count: stats.forwarded, color: 'from-blue-500 to-indigo-500' },
    { id: 'all', label: 'All Assigned', count: stats.total, color: 'from-slate-500 to-slate-700' }
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-slate-200 rounded-full"></div>
          <div className={`absolute top-0 left-0 w-20 h-20 border-4 ${accentSpinner} border-t-transparent rounded-full animate-spin`}></div>
        </div>
        <p className="mt-6 text-lg font-semibold text-slate-700">Loading assigned papers...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${accentFrom} ${accentTo} flex items-center justify-center shadow-lg`}>
              {isDean ? <Award size={28} className="text-white" /> : <Users size={28} className="text-white" />}
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
                {isDean ? 'Dean' : 'Program Chair'} Review Queue
              </h1>
              <p className="text-lg text-slate-600 font-medium">
                Research papers forwarded to you by advisers
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchPapers()}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-white to-slate-50 border border-slate-200 text-slate-700 font-semibold hover:from-slate-50 hover:to-white transition-all duration-300 disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`bg-gradient-to-br ${isDean ? 'from-violet-50 to-purple-50 border-violet-200' : 'from-teal-50 to-cyan-50 border-teal-200'} rounded-2xl border-2 p-5 shadow-sm`}>
            <p className={`text-sm font-semibold mb-1 ${isDean ? 'text-violet-700' : 'text-teal-700'}`}>Pending Review</p>
            <p className="text-3xl font-black text-slate-900">{stats.pendingReview}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 rounded-2xl border-2 p-5 shadow-sm">
            <p className="text-sm font-semibold text-orange-700 mb-1">Revision Sent</p>
            <p className="text-3xl font-black text-slate-900">{stats.revisionRequired}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 rounded-2xl border-2 p-5 shadow-sm">
            <p className="text-sm font-semibold text-blue-700 mb-1">Forwarded to Editor</p>
            <p className="text-3xl font-black text-slate-900">{stats.forwarded}</p>
          </div>
          <div className="bg-white border-slate-200 rounded-2xl border-2 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600 mb-1">Total Assigned</p>
            <p className="text-3xl font-black text-slate-900">{stats.total}</p>
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border border-slate-200 p-6 mb-8 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <label className="block text-sm font-bold text-slate-700 mb-3">Filter by Status</label>
            <div className="flex flex-wrap gap-3">
              {filterOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setStatusFilter(option.id)}
                  className={`px-5 py-2.5 rounded-xl font-semibold transition-all duration-300 transform hover:-translate-y-0.5 ${
                    statusFilter === option.id
                      ? `bg-gradient-to-r ${option.color} text-white shadow-md`
                      : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {option.label}
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                    statusFilter === option.id ? 'bg-white/30 text-white' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {option.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:w-80">
            <label className="block text-sm font-bold text-slate-700 mb-3">Search Papers</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by title, author, keywords..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full px-5 py-3 pl-12 bg-white border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 ${accentRing} focus:border-transparent transition-all duration-300`}
              />
              <Search size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Papers List */}
      {filteredPapers.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl border-2 border-slate-200 p-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mx-auto mb-6">
            <FileText size={32} className="text-slate-400" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">No Papers Found</h3>
          <p className="text-slate-600 text-lg">
            {searchTerm
              ? 'Try adjusting your search or filters'
              : 'No research papers have been assigned to you yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredPapers.map((paper) => {
            const statusConfig = getStatusConfig(paper.status);
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={paper.id}
                className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 p-6 hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1 cursor-pointer group"
                onClick={() => navigate(`/dean/review/${paper.id}`)}
              >
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    <div className={`w-16 h-16 rounded-xl ${statusConfig.badge} flex items-center justify-center shadow-lg`}>
                      <StatusIcon size={28} className="text-white" />
                    </div>
                  </div>

                  {/* Paper Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <h3 className="text-xl font-bold text-slate-900 group-hover:text-slate-700 transition-colors duration-300 line-clamp-2">
                        {paper.title}
                      </h3>
                      <div className={`px-4 py-2 rounded-xl border-2 ${statusConfig.color} ${statusConfig.text} text-sm font-bold whitespace-nowrap`}>
                        {statusConfig.label}
                      </div>
                    </div>

                    <p className="text-slate-600 mb-4 line-clamp-2">{paper.abstract}</p>

                    <div className="flex flex-wrap items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-slate-400" />
                        <span className="text-slate-700 font-semibold">
                          {paper.users?.full_name || 'Unknown Author'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-slate-400" />
                        <span className="text-slate-600">{formatDate(paper.submission_date || paper.created_at)}</span>
                      </div>
                      {paper.category && (
                        <div className="flex items-center gap-2">
                          <BookOpen size={16} className="text-slate-400" />
                          <span className="text-slate-600">{paper.category}</span>
                        </div>
                      )}
                    </div>

                    {paper.keywords && paper.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {paper.keywords.slice(0, 5).map((keyword, idx) => (
                          <span
                            key={idx}
                            className={`px-3 py-1 rounded-full ${isDean ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-teal-50 border-teal-200 text-teal-700'} border text-xs font-semibold`}
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <div className="flex-shrink-0 flex items-center">
                    <ChevronRight size={24} className="text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DeanChairReview;
