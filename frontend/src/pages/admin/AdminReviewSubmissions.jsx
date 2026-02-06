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
  BookOpen,
  ChevronRight,
  RefreshCw,
  Download,
  ShieldCheck,
  FileCheck,
  Users,
  Tag,
  Sparkles,
  Award,
  Lightbulb
} from 'lucide-react';
import { researchAPI } from '../../utils/api';

const AdminReviewSubmissions = () => {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [filteredPapers, setFilteredPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('under_review');
  const [stats, setStats] = useState({
    pending: 0,
    underReview: 0,
    pendingAdmin: 0,
    approved: 0,
    rejected: 0,
    revisionRequired: 0,
    total: 0
  });

  useEffect(() => {
    fetchPapers();

    // Auto-refresh every 30 seconds instead of 5 seconds for better performance
    const interval = setInterval(() => {
      fetchPapers();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterPapers();
  }, [papers, statusFilter]);

  const fetchPapers = async () => {
    try {
      const response = await researchAPI.getAllResearch();
      const allPapers = response.data.papers;
      
      console.log('=== ADMIN: All papers fetched ===', allPapers.length);
      console.log('Status breakdown:', {
        pending_admin: allPapers.filter(p => p.status === 'pending_admin').length,
        under_review: allPapers.filter(p => p.status === 'under_review').length,
        approved: allPapers.filter(p => p.status === 'approved').length,
      });
      console.log('Papers with pending_admin:', allPapers.filter(p => p.status === 'pending_admin'));
      
      setPapers(allPapers);
      
      // Calculate stats
      setStats({
        pending: allPapers.filter(p => p.status === 'pending').length,
        underReview: allPapers.filter(p => p.status === 'under_review').length,
        pendingAdmin: allPapers.filter(p => p.status === 'pending_admin').length,
        approved: allPapers.filter(p => p.status === 'approved').length,
        rejected: allPapers.filter(p => p.status === 'rejected').length,
        revisionRequired: allPapers.filter(p => p.status === 'revision_required').length,
        total: allPapers.length
      });
    } catch (error) {
      console.error('Failed to fetch papers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterPapers = () => {
    let filtered = papers;
    
    if (statusFilter === 'all') {
      filtered = papers;
    } else if (statusFilter === 'needs_action') {
      filtered = papers.filter(p => 
        p.status === 'pending' || 
        p.status === 'under_review' || 
        p.status === 'pending_admin'
      );
    } else if (statusFilter === 'pending_admin') {
      filtered = papers.filter(p => p.status === 'pending_admin');
    } else {
      filtered = papers.filter(p => p.status === statusFilter);
    }

    // Sort by submission date (newest first)
    filtered.sort((a, b) => new Date(b.submission_date) - new Date(a.submission_date));
    
    setFilteredPapers(filtered);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
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
        color: 'from-yellow-500 to-amber-500',
        bgColor: 'bg-gradient-to-r from-yellow-100 to-amber-100',
        textColor: 'text-yellow-800',
        borderColor: 'border-yellow-200',
        icon: Clock,
        label: 'Pending Staff Review'
      },
      under_review: {
        color: 'from-blue-500 to-cyan-500',
        bgColor: 'bg-gradient-to-r from-blue-100 to-cyan-100',
        textColor: 'text-blue-800',
        borderColor: 'border-blue-200',
        icon: Eye,
        label: 'Awaiting Final Approval'
      },
      approved: {
        color: 'from-green-500 to-emerald-500',
        bgColor: 'bg-gradient-to-r from-green-100 to-emerald-100',
        textColor: 'text-green-800',
        borderColor: 'border-green-200',
        icon: CheckCircle,
        label: 'Published'
      },
      rejected: {
        color: 'from-red-500 to-pink-500',
        bgColor: 'bg-gradient-to-r from-red-100 to-pink-100',
        textColor: 'text-red-800',
        borderColor: 'border-red-200',
        icon: XCircle,
        label: 'Rejected'
      },
      revision_required: {
        color: 'from-orange-500 to-amber-500',
        bgColor: 'bg-gradient-to-r from-orange-100 to-amber-100',
        textColor: 'text-orange-800',
        borderColor: 'border-orange-200',
        icon: AlertCircle,
        label: 'Revision Required'
      }
    };
    return configs[status] || configs.pending;
  };

  const getStatusBadge = (status) => {
    const config = getStatusConfig(status);
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold ${config.bgColor} ${config.textColor} border ${config.borderColor}`}>
        <Icon size={14} />
        {config.label}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-indigo-100 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="mt-6 text-lg font-medium text-slate-600 animate-pulse">Loading research submissions...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg">
                <ShieldCheck size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
                  Final <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">Approval</span>
                </h1>
                <p className="text-slate-600 font-medium">
                  Review and publish research submissions requiring final administrative approval
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={fetchPapers}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-indigo-300 transition-colors"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            {/* <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-blue-700 transition-all duration-300">
              <Download size={16} />
              Export Data
            </button> */}
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        {[
          { 
            label: 'Total Papers', 
            value: stats.total, 
            icon: FileText, 
            color: 'from-slate-500 to-gray-500',
            change: null 
          },
          { 
            label: 'Awaiting Admin Approval', 
            value: stats.pendingAdmin, 
            icon: Eye, 
            color: 'from-purple-500 to-indigo-500',
            change: null 
          },
          { 
            label: 'Published', 
            value: stats.approved, 
            icon: CheckCircle, 
            color: 'from-emerald-500 to-green-500',
            change: '+12%' 
          },
          { 
            label: 'Staff Review', 
            value: stats.pending, 
            icon: Clock, 
            color: 'from-amber-500 to-orange-500',
            change: null 
          },
          { 
            label: 'Rejected', 
            value: stats.rejected, 
            icon: XCircle, 
            color: 'from-red-500 to-pink-500',
            change: '-3%' 
          },
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div 
              key={index} 
              className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                  <Icon size={22} className="text-white" />
                </div>
                {stat.change && (
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    stat.change.startsWith('+') ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {stat.change}
                  </span>
                )}
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-1">{stat.value}</h3>
              <p className="text-slate-600 font-medium">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filter Section */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 mb-8">
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
              <Filter size={20} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Filter Submissions</h3>
              <p className="text-slate-600 text-sm">View papers by status</p>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="flex flex-wrap gap-3">
            {[
              { key: 'pending_admin', label: 'Awaiting Admin Approval', count: stats.pendingAdmin, color: 'purple' },
              { key: 'needs_action', label: 'Needs Action', count: stats.pending + stats.underReview + stats.pendingAdmin, color: 'indigo' },
              { key: 'under_review', label: 'Under Review', count: stats.underReview, color: 'blue' },
              { key: 'pending', label: 'Pending Staff Review', count: stats.pending, color: 'amber' },
              { key: 'approved', label: 'Published', count: stats.approved, color: 'emerald' },
              { key: 'rejected', label: 'Rejected', count: stats.rejected, color: 'red' },
              { key: 'all', label: 'All Papers', count: stats.total, color: 'slate' },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setStatusFilter(filter.key)}
                className={`group px-5 py-3 rounded-xl font-medium transition-all duration-300 ${
                  statusFilter === filter.key
                    ? `bg-gradient-to-r from-${filter.color}-600 to-${filter.color === 'emerald' ? 'green' : filter.color === 'amber' ? 'orange' : filter.color}-600 text-white shadow-lg`
                    : 'bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{filter.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    statusFilter === filter.key
                      ? 'bg-white/20'
                      : `bg-${filter.color}-100 text-${filter.color}-700`
                  }`}>
                    {filter.count}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Papers List */}
      {filteredPapers.length === 0 ? (
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="text-center py-16">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-slate-100 to-white flex items-center justify-center mx-auto mb-6">
              <BookOpen size={40} className="text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">
              {statusFilter === 'under_review' 
                ? 'No papers awaiting final approval'
                : `No papers found with status: ${statusFilter.replace('_', ' ')}`
              }
            </h3>
            <p className="text-slate-600 mb-8 max-w-md mx-auto">
              {statusFilter === 'under_review'
                ? 'All pending papers have been processed or are currently under staff review.'
                : 'Try selecting a different filter to view more papers.'
              }
            </p>
            {statusFilter !== 'all' && (
              <button
                onClick={() => setStatusFilter('all')}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-blue-700 transition-all duration-300"
              >
                View All Papers
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
                <FileCheck size={20} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Research Submissions</h3>
                <p className="text-slate-600 text-sm">
                  {filteredPapers.length} {filteredPapers.length === 1 ? 'paper' : 'papers'} found
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200">
              <Lightbulb size={16} className="text-indigo-600" />
              <span className="text-sm font-medium text-slate-700">
                Click on any paper to review and make final decisions
              </span>
            </div>
          </div>

          {filteredPapers.map((paper) => {
            const statusConfig = getStatusConfig(paper.status);
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={paper.id}
                onClick={() => navigate(`/admin/review/${paper.id}`)}
                className="group bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 hover:shadow-xl hover:border-indigo-300 transition-all duration-300 cursor-pointer hover:-translate-y-1"
              >
                <div className="p-8">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-6">
                    <div className="flex-1">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                          <BookOpen size={24} className="text-indigo-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-2xl font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                              {paper.title}
                            </h3>
                            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold ${statusConfig.bgColor} ${statusConfig.textColor} border ${statusConfig.borderColor}`}>
                              <StatusIcon size={14} />
                              {statusConfig.label}
                            </div>
                          </div>
                          <p className="text-slate-600 leading-relaxed line-clamp-2">
                            {paper.abstract}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center flex-shrink-0">
                        <User size={18} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Author</p>
                        <p className="text-slate-600 text-sm truncate">{paper.users?.full_name || 'Unknown Author'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center flex-shrink-0">
                        <Calendar size={18} className="text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Submitted</p>
                        <p className="text-slate-600 text-sm">{formatDate(paper.submission_date)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0">
                        <FileText size={18} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Document</p>
                        <p className="text-slate-600 text-sm truncate">{paper.file_name}</p>
                      </div>
                    </div>

                    {paper.published_date && (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center flex-shrink-0">
                          <TrendingUp size={18} className="text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-emerald-900">Published</p>
                          <p className="text-emerald-700 text-sm">{formatDate(paper.published_date)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Keywords */}
                  {paper.keywords && paper.keywords.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Tag size={16} className="text-indigo-600" />
                        <span className="text-sm font-semibold text-slate-900">Keywords</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {paper.keywords.slice(0, 6).map((keyword, index) => (
                          <span
                            key={index}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-100 to-blue-100 text-indigo-700 text-sm font-medium border border-indigo-200"
                          >
                            {keyword}
                          </span>
                        ))}
                        {paper.keywords.length > 6 && (
                          <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-slate-100 to-white text-slate-600 text-sm font-medium border border-slate-300">
                            +{paper.keywords.length - 6} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="pt-6 border-t border-slate-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/review/${paper.id}`);
                      }}
                      className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-bold group/btn transition-colors"
                    >
                      {paper.status === 'under_review' 
                        ? 'Final Approval Required'
                        : paper.status === 'pending'
                          ? 'View Staff Review Progress'
                          : 'Review Details'
                      }
                      <ChevronRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                    </button>
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

export default AdminReviewSubmissions;