import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Plus, 
  Eye, 
  Calendar,
  Tag,
  Download,
  Edit3,
  ExternalLink,
  BarChart3,
  Filter,
  RefreshCw,
  Shield,
  TrendingUp,
  ArrowRight,
  MoreVertical,
  ChevronRight,
  Award
} from 'lucide-react';
import { researchAPI } from '../../utils/api';

const MyResearch = () => {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMyResearch();
    
    const interval = setInterval(() => {
      fetchMyResearch(true); // Silent refresh every 3 seconds for realtime updates
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const fetchMyResearch = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await researchAPI.getMyResearch();
      const fetchedPapers = response.data.papers;
      
      console.log('=== STUDENT: Fetched papers ===', fetchedPapers.length);
      console.log('Papers with revision_required:', fetchedPapers.filter(p => p.status === 'revision_required'));
      console.log('All paper statuses:', fetchedPapers.map(p => ({ title: p.title, status: p.status })));
      
      setPapers(fetchedPapers);
      setError('');
    } catch (err) {
      if (!silent) {
        setError('Failed to load research papers');
        console.error(err);
      }
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusConfig = (status) => {
    const configs = {
      pending: {
        color: 'from-yellow-100 to-yellow-50 border-yellow-200',
        text: 'text-yellow-800',
        icon: Clock,
        label: 'Pending Review',
        badge: 'bg-gradient-to-r from-yellow-500 to-amber-500',
        badgeColor: 'text-yellow-700',
        bgColor: 'bg-yellow-50'
      },
      pending_faculty: {
        color: 'from-purple-100 to-purple-50 border-purple-200',
        text: 'text-purple-800',
        icon: Eye,
        label: 'With Faculty Reviewer',
        badge: 'bg-gradient-to-r from-purple-500 to-pink-500',
        badgeColor: 'text-purple-700',
        bgColor: 'bg-purple-50'
      },
      pending_editor: {
        color: 'from-blue-100 to-blue-50 border-blue-200',
        text: 'text-blue-800',
        icon: Eye,
        label: 'With Editor',
        badge: 'bg-gradient-to-r from-blue-500 to-cyan-500',
        badgeColor: 'text-blue-700',
        bgColor: 'bg-blue-50'
      },
      pending_admin: {
        color: 'from-indigo-100 to-indigo-50 border-indigo-200',
        text: 'text-indigo-800',
        icon: Shield,
        label: 'With Admin',
        badge: 'bg-gradient-to-r from-indigo-500 to-purple-500',
        badgeColor: 'text-indigo-700',
        bgColor: 'bg-indigo-50'
      },
      under_review: {
        color: 'from-blue-100 to-blue-50 border-blue-200',
        text: 'text-blue-800',
        icon: Eye,
        label: 'Under Review',
        badge: 'bg-gradient-to-r from-blue-500 to-cyan-500',
        badgeColor: 'text-blue-700',
        bgColor: 'bg-blue-50'
      },
      approved: {
        color: 'from-green-100 to-green-50 border-green-200',
        text: 'text-green-800',
        icon: CheckCircle,
        label: 'Published',
        badge: 'bg-gradient-to-r from-green-500 to-emerald-500',
        badgeColor: 'text-green-700',
        bgColor: 'bg-green-50'
      },
      rejected: {
        color: 'from-red-100 to-red-50 border-red-200',
        text: 'text-red-800',
        icon: XCircle,
        label: 'Rejected',
        badge: 'bg-gradient-to-r from-red-500 to-pink-500',
        badgeColor: 'text-red-700',
        bgColor: 'bg-red-50'
      },
      revision_required: {
        color: 'from-orange-100 to-orange-50 border-orange-200',
        text: 'text-orange-800',
        icon: AlertCircle,
        label: 'Revision Required',
        badge: 'bg-gradient-to-r from-orange-500 to-amber-500',
        badgeColor: 'text-orange-700',
        bgColor: 'bg-orange-50'
      }
    };
    return configs[status] || configs.pending;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const filteredPapers = papers.filter(paper => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'needs_action') {
      return paper.status === 'rejected' || paper.status === 'revision_required';
    }
    return paper.status === activeFilter;
  });

  const statusCounts = papers.reduce((acc, paper) => {
    acc[paper.status] = (acc[paper.status] || 0) + 1;
    return acc;
  }, {});

  const handleRefresh = () => {
    fetchMyResearch();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] animate-fadeIn">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-indigo-100 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="mt-6 text-lg font-medium text-slate-600 animate-pulse">Loading your research portfolio...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-2">
              My Research Portfolio
            </h1>
            <p className="text-lg text-slate-600 font-medium">
              Track and manage your academic submissions
            </p>
          </div>
          <button
            onClick={() => navigate('/student/submit')}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-blue-700 transition-all duration-500 shadow-lg hover:shadow-xl hover:shadow-indigo-500/25 transform hover:-translate-y-0.5 flex items-center gap-3 group"
          >
            <Plus size={20} />
            Submit New Research
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform duration-300" />
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="text-2xl font-black text-slate-900 mb-1">{papers.length}</div>
            <div className="text-sm text-slate-600 font-medium">Total Papers</div>
          </div>
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="text-2xl font-black text-blue-600 mb-1">{statusCounts.pending || 0}</div>
            <div className="text-sm text-slate-600 font-medium">Pending</div>
          </div>
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="text-2xl font-black text-green-600 mb-1">{statusCounts.approved || 0}</div>
            <div className="text-sm text-slate-600 font-medium">Published</div>
          </div>
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="text-2xl font-black text-orange-600 mb-1">{(statusCounts.rejected || 0) + (statusCounts.revision_required || 0)}</div>
            <div className="text-sm text-slate-600 font-medium">Needs Action</div>
          </div>
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="text-2xl font-black text-indigo-600 mb-1">{statusCounts.under_review || 0}</div>
            <div className="text-sm text-slate-600 font-medium">In Review</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Filter size={20} className="text-indigo-600" />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${activeFilter === 'all' ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg' : 'bg-white text-slate-700 border border-slate-300 hover:border-indigo-300'}`}
              >
                All Papers ({papers.length})
              </button>
              <button
                onClick={() => setActiveFilter('needs_action')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${activeFilter === 'needs_action' ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg' : 'bg-white text-slate-700 border border-slate-300 hover:border-orange-300'}`}
              >
                Needs Action ({(statusCounts.rejected || 0) + (statusCounts.revision_required || 0)})
              </button>
              <button
                onClick={() => setActiveFilter('approved')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${activeFilter === 'approved' ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg' : 'bg-white text-slate-700 border border-slate-300 hover:border-green-300'}`}
              >
                Published ({statusCounts.approved || 0})
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 font-medium hover:from-slate-200 hover:to-white transition-all duration-300 flex items-center gap-2"
            >
              <RefreshCw size={16} className={`${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-8 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4 animate-shake">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={24} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-900 mb-1">Unable to Load Research</h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Papers List */}
      {filteredPapers.length === 0 ? (
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-xl border border-slate-200 p-16 text-center">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center mx-auto mb-8">
            <FileText size={40} className="text-indigo-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">No research papers found</h3>
          <p className="text-lg text-slate-600 mb-8 max-w-md mx-auto">
            {activeFilter === 'all' 
              ? 'Start your academic journey by submitting your first research paper'
              : 'No papers match the current filter criteria'}
          </p>
          <button
            onClick={() => navigate('/student/submit')}
            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-blue-700 transition-all duration-500 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-3 mx-auto"
          >
            <Plus size={20} />
            Submit Your First Paper
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredPapers.map((paper) => {
            const statusConfig = getStatusConfig(paper.status);
            const StatusIcon = statusConfig.icon;
            
            return (
              <div 
                key={paper.id} 
                className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-xl border border-slate-200 hover:shadow-2xl transition-all duration-500 group overflow-hidden"
              >
                {/* Status Indicator Bar */}
                <div className={`h-2 ${statusConfig.badge}`}></div>
                
                <div className="p-8">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-6">
                    <div className="flex-1">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-white flex items-center justify-center shadow-sm flex-shrink-0">
                          <FileText size={24} className="text-slate-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-indigo-700 transition-colors duration-300">
                            {paper.title}
                          </h3>
                          <div className="flex items-center gap-4 mb-3">
                            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold ${statusConfig.color} ${statusConfig.text} border`}>
                              <StatusIcon size={14} />
                              {statusConfig.label}
                            </div>
                            <div className="flex items-center gap-1 text-sm text-slate-500">
                              <Calendar size={14} />
                              Submitted {formatDate(paper.submission_date || paper.created_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-slate-600 text-sm leading-relaxed line-clamp-2 mb-4 pl-16">
                        {paper.abstract}
                      </p>

                      {/* Keywords */}
                      {paper.keywords && paper.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4 pl-16">
                          {paper.keywords.slice(0, 5).map((keyword, index) => (
                            <span
                              key={index}
                              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-slate-100 to-white border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1"
                            >
                              <Tag size={10} />
                              {keyword}
                            </span>
                          ))}
                          {paper.keywords.length > 5 && (
                            <span className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-slate-100 to-white border border-slate-200 text-slate-500 text-xs font-medium">
                              +{paper.keywords.length - 5} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* File Info */}
                      <div className="flex items-center gap-6 text-sm text-slate-500 pl-16">
                        <div className="flex items-center gap-2">
                          <FileText size={14} />
                          <span className="font-medium">{paper.file_name}</span>
                        </div>
                        {paper.published_date && (
                          <div className="flex items-center gap-2">
                            <CheckCircle size={14} className="text-green-500" />
                            <span>Published {formatDate(paper.published_date)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 lg:flex-col">
                      <a
                        href={paper.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 font-medium hover:from-slate-200 hover:to-white transition-all duration-300 flex items-center gap-2 group-hover:border-indigo-300"
                      >
                        <Eye size={16} />
                        Preview
                      </a>
                      
                      {(paper.status === 'rejected' || paper.status === 'revision_required') && (
                        <button
                          onClick={() => {
                            console.log('Resubmit clicked for paper:', paper.id, 'Status:', paper.status);
                            navigate('/student/submit', { state: { resubmit: paper } });
                          }}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-medium hover:from-indigo-700 hover:to-blue-700 transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl"
                        >
                          <Edit3 size={16} />
                          {paper.status === 'revision_required' ? 'Edit & Resubmit' : 'Try Again'}
                        </button>
                      )}

                      {/* Debug: Show current status */}
                      <div className="text-xs text-slate-500 mt-2">
                        Current DB Status: {paper.status}
                      </div>
                    </div>
                  </div>
                  {/* Progress Tracker */}
                  <div className="mb-6 px-4 py-5 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200">
                    <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                      <BarChart3 size={16} className="text-indigo-600" />
                      Submission Progress
                    </h4>
                    <div className="relative">
                      {/* Progress Line */}
                      <div className="absolute top-5 left-0 w-full h-1 bg-slate-200 rounded-full"></div>
                      <div 
                        className="absolute top-5 left-0 h-1 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${
                            paper.status === 'pending_faculty' ? '25%' :
                            paper.status === 'pending' ? '50%' :
                            ['pending_editor', 'pending_admin', 'under_review'].includes(paper.status) ? '75%' :
                            paper.status === 'approved' ? '100%' :
                            paper.status === 'revision_required' ? '50%' :
                            paper.status === 'rejected' ? '100%' :
                            '25%'
                          }%` 
                        }}
                      ></div>
                      
                      {/* Progress Steps */}
                      <div className="relative flex justify-between items-start">
                        {/* Step 1: Submitted */}
                        <div className="flex flex-col items-center" style={{ width: '25%' }}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                            ['pending', 'pending_faculty', 'pending_editor', 'pending_admin', 'under_review', 'approved', 'revision_required', 'rejected'].includes(paper.status)
                              ? 'bg-gradient-to-br from-indigo-500 to-blue-500 border-indigo-500 shadow-lg'
                              : 'bg-white border-slate-300'
                          }`}>
                            <CheckCircle size={20} className={
                              ['pending', 'pending_faculty', 'pending_editor', 'pending_admin', 'under_review', 'approved', 'revision_required', 'rejected'].includes(paper.status)
                                ? 'text-white'
                                : 'text-slate-400'
                            } />
                          </div>
                          <span className="text-xs font-semibold text-slate-700 mt-2 text-center">Submitted</span>
                        </div>

                        {/* Step 2: Faculty Review */}
                        <div className="flex flex-col items-center" style={{ width: '25%' }}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                            ['pending', 'pending_editor', 'pending_admin', 'under_review', 'approved'].includes(paper.status)
                              ? 'bg-gradient-to-br from-indigo-500 to-blue-500 border-indigo-500 shadow-lg'
                              : paper.status === 'pending_faculty'
                              ? 'bg-gradient-to-br from-purple-400 to-pink-400 border-purple-500 shadow-lg animate-pulse'
                              : paper.status === 'revision_required'
                              ? 'bg-gradient-to-br from-orange-400 to-amber-400 border-orange-500 shadow-lg'
                              : paper.status === 'rejected'
                              ? 'bg-gradient-to-br from-red-400 to-pink-400 border-red-500 shadow-lg'
                              : 'bg-white border-slate-300'
                          }`}>
                            {paper.status === 'pending_faculty' ? (
                              <Clock size={20} className="text-white animate-pulse" />
                            ) : ['pending', 'pending_editor', 'pending_admin', 'under_review', 'approved'].includes(paper.status) ? (
                              <CheckCircle size={20} className="text-white" />
                            ) : paper.status === 'revision_required' ? (
                              <AlertCircle size={20} className="text-white" />
                            ) : paper.status === 'rejected' ? (
                              <XCircle size={20} className="text-white" />
                            ) : (
                              <Eye size={20} className="text-slate-400" />
                            )}
                          </div>
                          <span className="text-xs font-semibold text-slate-700 mt-2 text-center">Faculty Review</span>
                        </div>

                        {/* Step 3: Staff Review */}
                        <div className="flex flex-col items-center" style={{ width: '25%' }}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                            ['pending_editor', 'pending_admin', 'under_review', 'approved'].includes(paper.status)
                              ? 'bg-gradient-to-br from-indigo-500 to-blue-500 border-indigo-500 shadow-lg'
                              : paper.status === 'pending'
                              ? 'bg-gradient-to-br from-yellow-400 to-amber-400 border-yellow-500 shadow-lg animate-pulse'
                              : 'bg-white border-slate-300'
                          }`}>
                            {paper.status === 'pending' ? (
                              <Clock size={20} className="text-white animate-pulse" />
                            ) : ['pending_editor', 'pending_admin', 'under_review', 'approved'].includes(paper.status) ? (
                              <CheckCircle size={20} className="text-white" />
                            ) : (
                              <Clock size={20} className="text-slate-400" />
                            )}
                          </div>
                          <span className="text-xs font-semibold text-slate-700 mt-2 text-center">Staff Review</span>
                        </div>

                        {/* Step 4: Final Review */}
                        <div className="flex flex-col items-center" style={{ width: '25%' }}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                            paper.status === 'approved'
                              ? 'bg-gradient-to-br from-indigo-500 to-blue-500 border-indigo-500 shadow-lg'
                              : ['pending_editor', 'pending_admin', 'under_review'].includes(paper.status)
                              ? 'bg-gradient-to-br from-blue-400 to-cyan-400 border-blue-500 shadow-lg animate-pulse'
                              : 'bg-white border-slate-300'
                          }`}>
                            {['pending_editor', 'pending_admin', 'under_review'].includes(paper.status) ? (
                              <Clock size={20} className="text-white animate-pulse" />
                            ) : paper.status === 'approved' ? (
                              <CheckCircle size={20} className="text-white" />
                            ) : (
                              <Shield size={20} className="text-slate-400" />
                            )}
                          </div>
                          <span className="text-xs font-semibold text-slate-700 mt-2 text-center">Final Review</span>
                        </div>

                        {/* Step 5: Published */}
                        <div className="flex flex-col items-center" style={{ width: '25%' }}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                            paper.status === 'approved'
                              ? 'bg-gradient-to-br from-green-500 to-emerald-500 border-green-500 shadow-lg'
                              : paper.status === 'rejected'
                              ? 'bg-gradient-to-br from-red-500 to-pink-500 border-red-500 shadow-lg'
                              : 'bg-white border-slate-300'
                          }`}>
                            {paper.status === 'approved' ? (
                              <CheckCircle size={20} className="text-white" />
                            ) : paper.status === 'rejected' ? (
                              <XCircle size={20} className="text-white" />
                            ) : (
                              <Award size={20} className="text-slate-400" />
                            )}
                          </div>
                          <span className="text-xs font-semibold text-slate-700 mt-2 text-center">
                            {paper.status === 'approved' ? 'Published' : paper.status === 'rejected' ? 'Rejected' : 'Publish'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Current Status Description */}
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <p className="text-sm text-slate-600">
                        <span className="font-bold text-slate-900">Current Status: </span>
                        {paper.status === 'pending_faculty' && 'Your research has been assigned to a faculty reviewer for evaluation.'}
                        {paper.status === 'pending' && 'Your research passed faculty review and is now with staff for processing.'}
                        {['pending_editor', 'pending_admin', 'under_review'].includes(paper.status) && 'Your research is undergoing final administrative review before publication.'}
                        {paper.status === 'approved' && '🎉 Congratulations! Your research has been published to the repository.'}
                        {paper.status === 'revision_required' && '⚠️ Please review the feedback below and resubmit with revisions.'}
                        {paper.status === 'rejected' && 'Your submission was not accepted. Please review the feedback below.'}
                      </p>
                    </div>
                  </div>
                  {/* Feedback Messages */}
                  {paper.rejection_reason && (
                    <div className={`p-4 rounded-xl ${statusConfig.bgColor} border ${statusConfig.text.replace('text-', 'border-')} mt-6`}>
                      <div className="flex items-start gap-3">
                        <XCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-bold mb-1">Reviewer Feedback</p>
                          <p className="text-sm">{paper.rejection_reason}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {paper.revision_notes && (
                    <div className={`p-4 rounded-xl ${statusConfig.bgColor} border ${statusConfig.text.replace('text-', 'border-')} mt-6`}>
                      <div className="flex items-start gap-3">
                        <AlertCircle size={20} className="text-orange-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-bold mb-1">Revision Required</p>
                          <p className="text-sm">{paper.revision_notes}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Statistics Card */}
      <div className="mt-12 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-200 p-8">
        <div className="flex items-start gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg flex-shrink-0">
            <TrendingUp size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Research Insights</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 rounded-xl bg-white/80 border border-indigo-100">
                <div className="text-2xl font-black text-indigo-700 mb-1">{statusCounts.pending || 0}</div>
                <div className="text-sm text-slate-700 font-medium">Awaiting Review</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-white/80 border border-indigo-100">
                <div className="text-2xl font-black text-green-700 mb-1">{statusCounts.approved || 0}</div>
                <div className="text-sm text-slate-700 font-medium">Published Works</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-white/80 border border-indigo-100">
                <div className="text-2xl font-black text-orange-700 mb-1">{statusCounts.revision_required || 0}</div>
                <div className="text-sm text-slate-700 font-medium">Revisions Needed</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-white/80 border border-indigo-100">
                <div className="text-2xl font-black text-blue-700 mb-1">{statusCounts.under_review || 0}</div>
                <div className="text-sm text-slate-700 font-medium">In Active Review</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyResearch;