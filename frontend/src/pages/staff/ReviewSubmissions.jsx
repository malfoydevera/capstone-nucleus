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
  MoreVertical,
  BookOpen,
  Award,
  Timer,
  Bell,
  CalendarDays
} from 'lucide-react';
import { researchAPI, unwrapApiData } from '../../utils/api';
import { formatFullName } from '../../utils/names';
import GuidancePanel from '../../components/ui/GuidancePanel';
import useAutoLoadMore from '../../hooks/useAutoLoadMore';

const PAGE_SIZE = 4;

const ReviewSubmissions = () => {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [filteredPapers, setFilteredPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    pending: 0,
    needsReview: 0,
    approved: 0,
    rejected: 0,
    revisionRequired: 0
  });
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [statusFilter, searchTerm, filteredPapers.length]);

  const fetchPapers = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await researchAPI.getAllResearch();
      const allPapers = unwrapApiData(response).papers || [];

      setPapers(allPapers);

      const statsData = {
        pending: allPapers.filter(p => p.status === 'pending_faculty').length,
        needsReview: allPapers.filter(p => p.status === 'pending_editor').length,
        approved: allPapers.filter(p => p.status === 'approved').length,
        rejected: allPapers.filter(p => p.status === 'rejected').length,
        revisionRequired: allPapers.filter(p => p.status === 'revision_required').length,
      };

      setStats(statsData);
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Failed to fetch papers:', error);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const formatRelativeTime = (date) => {
    if (!date) return null;
    const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return date.toLocaleTimeString();
  };

  const filterAndSearchPapers = () => {
    let filtered = [...papers];

    if (statusFilter === 'needs_review') {
      filtered = papers.filter(p => p.status === 'pending_editor');
    } else if (statusFilter !== 'all') {
      filtered = papers.filter(p => p.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(paper =>
        paper.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        paper.abstract.toLowerCase().includes(searchTerm.toLowerCase()) ||
        formatFullName(paper.users).toLowerCase().includes(searchTerm.toLowerCase()) ||
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
        label: 'Legacy Pending',
        badge: 'bg-gradient-to-r from-yellow-500 to-amber-500',
        priority: 'high'
      },
      pending_faculty: {
        color: 'from-[#1C4D8D]/10 to-[#2563eb]/10 border-[#1C4D8D]/20',
        text: 'text-[#1C4D8D]',
        icon: Clock,
        label: 'With Faculty',
        badge: 'bg-gradient-to-r from-[#1C4D8D] to-[#2563eb]',
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
        color: 'from-[#1C4D8D]/10 to-[#2563eb]/10 border-[#1C4D8D]/20',
        text: 'text-[#1C4D8D]',
        icon: AlertCircle,
        label: 'With Admin',
        badge: 'bg-gradient-to-r from-[#1C4D8D] to-[#2563eb]',
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

  const countByStatus = (status) => papers.filter((p) => p.status === status).length;

  const filterOptions = [
    { id: 'all', label: 'All Papers', count: papers.length, color: 'from-slate-600 to-slate-800' },
    { id: 'needs_review', label: 'Needs Review', count: stats.needsReview, color: 'from-orange-500 to-amber-500' },
    { id: 'pending_faculty', label: 'Pending Faculty', count: countByStatus('pending_faculty'), color: 'from-[#1C4D8D] to-[#2563eb]' },
    { id: 'pending_editor', label: 'Pending Editor', count: countByStatus('pending_editor'), color: 'from-blue-500 to-cyan-500' },
    { id: 'pending_admin', label: 'Pending Admin', count: countByStatus('pending_admin'), color: 'from-indigo-500 to-violet-500' },
    { id: 'pending_dean', label: 'Pending Dean', count: countByStatus('pending_dean'), color: 'from-purple-500 to-fuchsia-500' },
    { id: 'pending_program_chair', label: 'Pending Program Chair', count: countByStatus('pending_program_chair'), color: 'from-teal-500 to-emerald-500' },
    { id: 'revision_required', label: 'Revision Required', count: stats.revisionRequired, color: 'from-orange-500 to-red-500' },
    { id: 'approved', label: 'Approved', count: stats.approved, color: 'from-green-500 to-emerald-500' },
    { id: 'rejected', label: 'Rejected', count: stats.rejected, color: 'from-red-500 to-pink-500' },
  ];

  const visiblePapers = filteredPapers.slice(0, visibleCount);
  const canLoadMore = visibleCount < filteredPapers.length;
  const loadMoreRef = useAutoLoadMore({ canLoadMore, setVisibleCount, step: PAGE_SIZE });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-[#1C4D8D]/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-[#1C4D8D] border-t-transparent rounded-full animate-spin"></div>
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
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-3xl md:text-4xl font-black text-slate-900">
                Editorial <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-600">Workspace</span>
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                <Shield size={12} /> Research Editor
              </span>
            </div>
            <p className="text-lg text-slate-600 font-medium">
              Evaluate and provide feedback on student research papers
            </p>
            {lastRefreshed && (
              <p className="text-xs text-slate-500 mt-1">
                Last refreshed {formatRelativeTime(lastRefreshed)}
              </p>
            )}
          </div>
          <button
            onClick={() => fetchPapers()}
            disabled={refreshing}
            className="hidden md:flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="mb-6">
          <GuidancePanel
            title="Editorial Queue Guidance"
            description="Use this queue to validate metadata, identify revisions, and keep each paper moving through the editorial review stage."
            items={[
              'Start with Needs Review so waiting papers are handled before already-reviewed items.',
              'Check the card details first so you know whether you are validating metadata, requesting revision, or reviewing an updated submission.',
              'When you return a paper, make the correction path explicit so the author knows what to do next.',
            ]}
            tone="amber"
          />
        </div>

        <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-5">
          <h2 className="text-base font-bold text-orange-900 mb-3">Editorial Toolkit</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2 text-orange-800">
              <AlertCircle size={16} className="mt-0.5" />
              <span><strong>Return to Author:</strong> Send back without full rejection</span>
            </div>
            <div className="flex items-start gap-2 text-orange-800">
              <FileText size={16} className="mt-0.5" />
              <span><strong>Metadata Correction:</strong> Fix title, abstract, and authors</span>
            </div>
          </div>
          <p className="text-xs text-orange-700 mt-3">
            Open any paper card to access these actions in the Review Actions panel.
          </p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <button
            type="button"
            onClick={() => setStatusFilter('pending_editor')}
            className={`text-left rounded-2xl border-2 p-4 transition-all duration-300 ${
              statusFilter === 'pending_editor'
                ? 'border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 shadow-md'
                : 'border-slate-200 bg-white hover:border-orange-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-orange-600" />
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Needs Review</p>
            </div>
            <p className="text-3xl font-black text-slate-900">{stats.needsReview}</p>
            <p className="text-xs text-slate-500 mt-1">Awaiting editor decision</p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('revision_required')}
            className={`text-left rounded-2xl border-2 p-4 transition-all duration-300 ${
              statusFilter === 'revision_required'
                ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 shadow-md'
                : 'border-slate-200 bg-white hover:border-amber-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={14} className="text-amber-600" />
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Revisions</p>
            </div>
            <p className="text-3xl font-black text-slate-900">{stats.revisionRequired}</p>
            <p className="text-xs text-slate-500 mt-1">Returned to author</p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('approved')}
            className={`text-left rounded-2xl border-2 p-4 transition-all duration-300 ${
              statusFilter === 'approved'
                ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50 shadow-md'
                : 'border-slate-200 bg-white hover:border-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={14} className="text-emerald-600" />
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Approved</p>
            </div>
            <p className="text-3xl font-black text-slate-900">{stats.approved}</p>
            <p className="text-xs text-slate-500 mt-1">Published</p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`text-left rounded-2xl border-2 p-4 transition-all duration-300 ${
              statusFilter === 'all'
                ? 'border-[#1C4D8D]/40 bg-gradient-to-br from-[#1C4D8D]/10 to-[#2563eb]/10 shadow-md'
                : 'border-slate-200 bg-white hover:border-[#1C4D8D]/20'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <BookOpen size={14} className="text-[#1C4D8D]" />
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">All Papers</p>
            </div>
            <p className="text-3xl font-black text-slate-900">{papers.length}</p>
            <p className="text-xs text-slate-500 mt-1">Across every status</p>
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 mb-8">
        <div className="p-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search papers, authors, or keywords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1C4D8D] focus:border-transparent transition-all duration-300 font-medium"
            />
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
                        : 'bg-white text-slate-700 border border-slate-300 hover:border-[#1C4D8D]/30'
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
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#1C4D8D]/10 to-[#2563eb]/10 flex items-center justify-center mx-auto mb-8">
            <FileText size={40} className="text-[#1C4D8D]" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">No submissions found</h3>
          <p className="text-lg text-slate-600 mb-8 max-w-md mx-auto">
            {searchTerm
              ? `No papers match your search for "${searchTerm}"`
              : statusFilter === 'all'
                ? 'No submissions in the system yet.'
                : statusFilter === 'needs_review'
                  ? 'All caught up! No submissions need review at the moment.'
                  : `No papers with status: ${statusFilter.replace('_', ' ')}`
            }
          </p>
          {(searchTerm || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
              className="px-8 py-3 bg-gradient-to-r from-[#1C4D8D] to-[#2563eb] text-white rounded-xl font-bold hover:from-[#163d6e] hover:to-[#1d4ed8] transition-all duration-500 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
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
              <div className="px-3 py-1 rounded-full bg-gradient-to-r from-[#1C4D8D]/10 to-[#2563eb]/10 text-[#1C4D8D] text-sm font-bold">
                {filteredPapers.length} found
              </div>
            </div>
            <div className="text-sm text-slate-600">
              Showing <span className="font-medium">{visiblePapers.length}</span> of{' '}
              <span className="font-medium">{filteredPapers.length}</span>
            </div>
          </div>

          {/* Papers Grid */}
          {visiblePapers.map((paper) => {
            const statusConfig = getStatusConfig(paper.status);
            const StatusIcon = statusConfig.icon;
            
            return (
              <div
                key={paper.id}
                onClick={() => navigate(`/staff/review/${paper.id}`)}
                className="group bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 hover:shadow-2xl hover:border-[#1C4D8D]/20 transition-all duration-500 cursor-pointer overflow-hidden"
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
                            <h3 className="text-xl font-bold text-slate-900 group-hover:text-[#1C4D8D] transition-colors duration-300 line-clamp-2">
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
                              <span className="font-medium">{formatFullName(paper.users) || 'Student Researcher'}</span>
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
                        className="px-6 py-3 bg-gradient-to-r from-[#1C4D8D] to-[#2563eb] text-white rounded-xl hover:from-[#163d6e] hover:to-[#1d4ed8] transition-all duration-300 font-bold text-sm shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
                      >
                        <FileCheck size={16} />
                        Review Paper
                        <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredPapers.length > PAGE_SIZE ? (
            <div ref={loadMoreRef} className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-center">
              {canLoadMore ? (
                <button
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Load more papers
                </button>
              ) : (
                <p className="text-sm text-slate-600">All matching papers are visible.</p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Footer Stats */}
      <div className="mt-12 bg-gradient-to-br from-[#1C4D8D]/10 to-[#2563eb]/10 rounded-2xl border border-[#1C4D8D]/20 p-8">
        <div className="flex items-start gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1C4D8D] to-[#2563eb] flex items-center justify-center shadow-lg flex-shrink-0">
            <BarChart3 size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Review Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 rounded-xl bg-white/80 border border-[#1C4D8D]/10">
                <div className="text-2xl font-black text-[#1C4D8D] mb-1">{stats.approved}</div>
                <div className="text-sm text-slate-700 font-medium">Approved</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-white/80 border border-[#1C4D8D]/10">
                <div className="text-2xl font-black text-orange-700 mb-1">{stats.revisionRequired}</div>
                <div className="text-sm text-slate-700 font-medium">Revisions</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-white/80 border border-[#1C4D8D]/10">
                <div className="text-2xl font-black text-emerald-700 mb-1">94%</div>
                <div className="text-sm text-slate-700 font-medium">Completion</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-white/80 border border-[#1C4D8D]/10">
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
