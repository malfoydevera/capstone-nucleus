import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Clock, 
  Eye, 
  User, 
  Calendar, 
  Filter, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  TrendingUp,
  BarChart3,
  Search,
  ChevronRight,
  RefreshCw,
  FileCheck,
  Shield,
  Zap,
  Sparkles,
  Hash,
  MoreVertical,
  Download,
  ExternalLink,
  BookOpen,
  Award,
  Timer,
  Bell,
  CalendarDays
} from 'lucide-react';
import { researchAPI } from '../../utils/api';

const ReviewSubmissions = () => {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [filteredPapers, setFilteredPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('needs_review');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    pending: 0,
    underReview: 0,
    needsReview: 0,
    approved: 0,
    rejected: 0,
    revisionRequired: 0
  });

  useEffect(() => {
    fetchPapers();

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchPapers(true); // Silent refresh
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterAndSearchPapers();
  }, [papers, statusFilter, searchTerm]);

  const fetchPapers = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await researchAPI.getAllResearch();
      const allPapers = response.data.papers;
      
      console.log('=== STAFF: All papers fetched ===', allPapers.length);
      console.log('Status breakdown:', {
        pending_faculty: allPapers.filter(p => p.status === 'pending_faculty').length,
        pending_editor: allPapers.filter(p => p.status === 'pending_editor').length,
        pending_admin: allPapers.filter(p => p.status === 'pending_admin').length,
        approved: allPapers.filter(p => p.status === 'approved').length,
      });
      console.log('Papers with pending_editor:', allPapers.filter(p => p.status === 'pending_editor'));
      
      setPapers(allPapers);
      
      // Calculate comprehensive stats - filter for papers at editor stage
      const editorStagePapers = allPapers.filter(p => 
        p.status === 'pending_editor' || 
        p.status === 'pending_admin' ||
        p.status === 'under_review' ||
        p.status === 'approved' ||
        p.status === 'rejected' ||
        p.status === 'revision_required' ||
        p.status === 'pending' // Legacy papers without faculty assignment
      );
      
      const statsData = {
        pending: editorStagePapers.filter(p => p.status === 'pending').length,
        underReview: editorStagePapers.filter(p => p.status === 'under_review').length,
        needsReview: editorStagePapers.filter(p => p.status === 'pending_editor' || p.status === 'under_review').length,
        approved: editorStagePapers.filter(p => p.status === 'approved').length,
        rejected: editorStagePapers.filter(p => p.status === 'rejected').length,
        revisionRequired: editorStagePapers.filter(p => p.status === 'revision_required').length
      };
      
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch papers:', error);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const filterAndSearchPapers = () => {
    let filtered = [...papers];
    
    console.log('=== STAFF: Filtering papers ===');
    console.log('Total papers before filter:', papers.length);
    console.log('Current statusFilter:', statusFilter);
    
    // Apply status filter - Staff should only see papers that passed faculty review
    if (statusFilter === 'needs_review') {
      // Staff sees papers that are pending_editor or under_review (for legacy papers)
      filtered = papers.filter(p => p.status === 'pending_editor' || p.status === 'under_review');
      console.log('Filtered for needs_review:', filtered.length);
    } else if (statusFilter !== 'all') {
      filtered = papers.filter(p => p.status === statusFilter);
      console.log('Filtered for specific status:', statusFilter, filtered.length);
    } else {
      // For 'all' filter, staff should only see papers at editor stage or beyond (exclude pending_faculty)
      filtered = papers.filter(p => p.status !== 'pending_faculty');
      console.log('Filtered for all (excluding pending_faculty):', filtered.length);
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(paper =>
        paper.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.abstract.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.users?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.keywords?.some(keyword => 
          keyword.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Sort by submission date (newest first)
    filtered.sort((a, b) => new Date(b.submission_date || b.created_at) - new Date(a.submission_date || a.created_at));
    
    setFilteredPapers(filtered);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusConfig = (status) => {
    const configs = {
      pending: {
        color: 'from-yellow-100 to-amber-50 border-yellow-200',
        text: 'text-yellow-800',
        icon: Clock,
        label: 'Pending Review',
        badge: 'bg-gradient-to-r from-yellow-500 to-amber-500',
        priority: 'high'
      },
      pending_faculty: {
        color: 'from-purple-100 to-pink-50 border-purple-200',
        text: 'text-purple-800',
        icon: Clock,
        label: 'With Faculty',
        badge: 'bg-gradient-to-r from-purple-500 to-pink-500',
        priority: 'medium'
      },
      pending_editor: {
        color: 'from-blue-100 to-cyan-50 border-blue-200',
        text: 'text-blue-800',
        icon: Eye,
        label: 'Awaiting Editor Review',
        badge: 'bg-gradient-to-r from-blue-500 to-cyan-500',
        priority: 'high'
      },
      pending_admin: {
        color: 'from-indigo-100 to-purple-50 border-indigo-200',
        text: 'text-indigo-800',
        icon: AlertCircle,
        label: 'With Admin',
        badge: 'bg-gradient-to-r from-indigo-500 to-purple-500',
        priority: 'medium'
      },
      under_review: {
        color: 'from-blue-100 to-cyan-50 border-blue-200',
        text: 'text-blue-800',
        icon: Eye,
        label: 'Under Review',
        badge: 'bg-gradient-to-r from-blue-500 to-cyan-500',
        priority: 'medium'
      },
      approved: {
        color: 'from-green-100 to-emerald-50 border-green-200',
        text: 'text-green-800',
        icon: CheckCircle,
        label: 'Approved',
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
    return configs[status] || configs.pending;
  };

  const filterOptions = [
    { id: 'needs_review', label: 'Needs Review', count: stats.needsReview, color: 'from-orange-500 to-amber-500' },
    { id: 'pending', label: 'Pending', count: stats.pending, color: 'from-yellow-500 to-amber-500' },
    { id: 'under_review', label: 'Under Review', count: stats.underReview, color: 'from-blue-500 to-cyan-500' },
    { id: 'revision_required', label: 'Revision Required', count: stats.revisionRequired, color: 'from-orange-500 to-red-500' },
    { id: 'approved', label: 'Approved', count: stats.approved, color: 'from-green-500 to-emerald-500' },
    { id: 'rejected', label: 'Rejected', count: stats.rejected, color: 'from-red-500 to-pink-500' },
    { id: 'all', label: 'All Papers', count: papers.length, color: 'from-slate-500 to-slate-700' }
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-indigo-100 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="mt-6 text-lg font-medium text-slate-600 animate-pulse">Loading review submissions...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
            <FileCheck size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
              Review <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-600">Submissions</span>
            </h1>
            <p className="text-lg text-slate-600 font-medium">
              Evaluate and provide feedback on student research papers
            </p>
          </div>
          <div className="hidden md:block">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
              <Shield size={14} />
              Faculty Reviewer
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="text-2xl font-black text-orange-600 mb-1">{stats.needsReview}</div>
            <div className="text-sm text-slate-600 font-medium">Needs Review</div>
          </div>
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="text-2xl font-black text-yellow-600 mb-1">{stats.pending}</div>
            <div className="text-sm text-slate-600 font-medium">Pending</div>
          </div>
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="text-2xl font-black text-blue-600 mb-1">{stats.underReview}</div>
            <div className="text-sm text-slate-600 font-medium">In Review</div>
          </div>
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="text-2xl font-black text-emerald-600 mb-1">{stats.approved}</div>
            <div className="text-sm text-slate-600 font-medium">Approved</div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 mb-8">
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder="Search papers, authors, or keywords..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 font-medium"
                />
              </div>
            </div>

            {/* Refresh Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchPapers()}
                disabled={refreshing}
                className="px-4 py-3 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 font-medium hover:from-slate-200 hover:to-white transition-all duration-300 flex items-center gap-2"
              >
                <RefreshCw size={18} className={`${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter size={18} className="text-slate-600" />
              <span className="text-sm font-semibold text-slate-900">Filter by status:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => {
                const isActive = statusFilter === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => setStatusFilter(option.id)}
                    className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 flex items-center gap-2 ${
                      isActive
                        ? `bg-gradient-to-r ${option.color} text-white shadow-lg`
                        : 'bg-white text-slate-700 border border-slate-300 hover:border-indigo-300'
                    }`}
                  >
                    {option.label}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {option.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Papers List */}
      {filteredPapers.length === 0 ? (
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-xl border border-slate-200 p-16 text-center">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center mx-auto mb-8">
            <FileText size={40} className="text-indigo-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">No submissions found</h3>
          <p className="text-lg text-slate-600 mb-8 max-w-md mx-auto">
            {searchTerm
              ? `No papers match your search for "${searchTerm}"`
              : statusFilter === 'needs_review'
                ? 'All caught up! No submissions need review at the moment.'
                : `No papers with status: ${statusFilter.replace('_', ' ')}`
            }
          </p>
          {(searchTerm || statusFilter !== 'needs_review') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('needs_review');
              }}
              className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-blue-700 transition-all duration-500 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Show All Papers
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Results Header */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">Research Papers</h2>
              <div className="px-3 py-1 rounded-full bg-gradient-to-r from-indigo-100 to-blue-100 text-indigo-700 text-sm font-bold">
                {filteredPapers.length} found
              </div>
            </div>
            <div className="text-sm text-slate-600">
              Sorted by: <span className="font-medium">Newest First</span>
            </div>
          </div>

          {/* Papers Grid */}
          {filteredPapers.map((paper) => {
            const statusConfig = getStatusConfig(paper.status);
            const StatusIcon = statusConfig.icon;
            
            return (
              <div
                key={paper.id}
                onClick={() => navigate(`/staff/review/${paper.id}`)}
                className="group bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 hover:shadow-2xl hover:border-indigo-200 transition-all duration-500 cursor-pointer overflow-hidden"
              >
                {/* Priority Indicator */}
                {statusConfig.priority === 'high' && (
                  <div className="h-1.5 bg-gradient-to-r from-orange-500 to-amber-500"></div>
                )}
                {statusConfig.priority === 'medium' && (
                  <div className="h-1.5 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
                )}
                
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                    {/* Paper Info */}
                    <div className="flex-1">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-white flex items-center justify-center shadow-sm flex-shrink-0">
                          <FileText size={24} className="text-slate-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-700 transition-colors duration-300 line-clamp-2">
                              {paper.title}
                            </h3>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${statusConfig.color} ${statusConfig.text} border ml-4`}>
                              <StatusIcon size={14} />
                              {statusConfig.label}
                            </div>
                          </div>
                          
                          <p className="text-slate-600 text-sm leading-relaxed line-clamp-2 mb-4">
                            {paper.abstract}
                          </p>

                          {/* Author & Details */}
                          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                            <div className="flex items-center gap-2">
                              <User size={14} />
                              <span className="font-medium">{paper.users?.full_name || 'Student Researcher'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar size={14} />
                              <span>Submitted {formatDate(paper.submission_date || paper.created_at)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <FileText size={14} />
                              <span className="font-medium">{paper.file_name}</span>
                            </div>
                          </div>

                          {/* Keywords */}
                          {paper.keywords && paper.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-4">
                              {paper.keywords.slice(0, 4).map((keyword, index) => (
                                <span
                                  key={index}
                                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-slate-100 to-white border border-slate-200 text-slate-700 text-xs font-medium"
                                >
                                  {keyword}
                                </span>
                              ))}
                              {paper.keywords.length > 4 && (
                                <span className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-slate-100 to-white border border-slate-200 text-slate-500 text-xs font-medium">
                                  +{paper.keywords.length - 4} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-3 lg:w-48">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/staff/review/${paper.id}`);
                        }}
                        className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl hover:from-indigo-700 hover:to-blue-700 transition-all duration-300 font-bold text-sm shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
                      >
                        <FileCheck size={16} />
                        Review Paper
                        <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(paper.file_url, '_blank');
                        }}
                        className="px-6 py-3 bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 rounded-xl hover:border-indigo-300 transition-all duration-300 font-medium text-sm flex items-center justify-center gap-2"
                      >
                        <ExternalLink size={16} />
                        Preview PDF
                      </button>
                    </div>
                  </div>

                  {/* Review Timeline */}
                  {paper.status === 'pending' && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                      <div className="flex items-center gap-2 text-sm text-amber-600">
                        <Timer size={14} />
                        <span className="font-medium">Pending review for 2 days</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Stats */}
      <div className="mt-12 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-200 p-8">
        <div className="flex items-start gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg flex-shrink-0">
            <BarChart3 size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Review Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 rounded-xl bg-white/80 border border-indigo-100">
                <div className="text-2xl font-black text-indigo-700 mb-1">{stats.approved}</div>
                <div className="text-sm text-slate-700 font-medium">Approved</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-white/80 border border-indigo-100">
                <div className="text-2xl font-black text-orange-700 mb-1">{stats.revisionRequired}</div>
                <div className="text-sm text-slate-700 font-medium">Revisions</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-white/80 border border-indigo-100">
                <div className="text-2xl font-black text-emerald-700 mb-1">94%</div>
                <div className="text-sm text-slate-700 font-medium">Completion</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-white/80 border border-indigo-100">
                <div className="text-2xl font-black text-blue-700 mb-1">4.9★</div>
                <div className="text-sm text-slate-700 font-medium">Quality</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewSubmissions;