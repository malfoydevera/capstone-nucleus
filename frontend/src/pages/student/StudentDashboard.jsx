import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Upload, 
  Search, 
  TrendingUp,
  BookOpen,
  BarChart3,
  ChevronRight,
  Sparkles,
  GraduationCap,
  Calendar,
  Eye,
  Download,
  Users,
  Lightbulb
} from 'lucide-react';
import { researchAPI } from '../../utils/api';

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    underReview: 0,
    approved: 0,
    rejected: 0,
    revisionRequired: 0
  });
  const [recentPapers, setRecentPapers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await researchAPI.getMyResearch();
      const papers = response.data.papers;

      // Calculate statistics
      const statistics = {
        total: papers.length,
        pending: papers.filter(p => p.status === 'pending').length,
        underReview: papers.filter(p => p.status === 'under_review').length,
        approved: papers.filter(p => p.status === 'approved').length,
        rejected: papers.filter(p => p.status === 'rejected').length,
        revisionRequired: papers.filter(p => p.status === 'revision_required').length
      };

      setStats(statistics);
      setRecentPapers(papers.slice(0, 3)); // Get 3 most recent
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'text-yellow-700 bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200',
      under_review: 'text-blue-700 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200',
      approved: 'text-green-700 bg-gradient-to-r from-green-50 to-green-100 border border-green-200',
      rejected: 'text-red-700 bg-gradient-to-r from-red-50 to-red-100 border border-red-200',
      revision_required: 'text-orange-700 bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200'
    };
    return colors[status] || 'text-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200';
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: <Clock size={14} className="text-yellow-600" />,
      under_review: <Eye size={14} className="text-blue-600" />,
      approved: <CheckCircle size={14} className="text-green-600" />,
      rejected: <AlertCircle size={14} className="text-red-600" />,
      revision_required: <AlertCircle size={14} className="text-orange-600" />
    };
    return icons[status] || <FileText size={14} className="text-gray-600" />;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: 'Pending Review',
      under_review: 'Under Review',
      approved: 'Published',
      rejected: 'Rejected',
      revision_required: 'Revision Required'
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] animate-fadeIn">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-indigo-100 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="mt-6 text-lg font-medium text-slate-600 animate-pulse">Loading your academic dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn">
      {/* Header with Welcome */}
      <div className="mb-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                <GraduationCap size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                  Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">{user?.fullName}</span>!
                </h1>
                <p className="text-slate-600 font-medium mt-2">
                  Research Scholar • National University Dasmariñas
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 text-indigo-700 text-sm font-semibold">
              <Calendar size={14} />
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
          <div className="hidden md:block">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200 shadow-sm">
              <Sparkles size={16} className="text-amber-500" />
              <span className="text-sm font-semibold text-slate-700">Academic Profile</span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Grid with Enhanced Design */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 p-6 border border-slate-100 hover:border-indigo-200 group transform hover:-translate-y-1">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Total Submissions</p>
              <p className="text-3xl font-black text-slate-900">{stats.total}</p>
            </div>
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
              <FileText size={28} className="text-blue-600" />
            </div>
          </div>
          <div className="w-full h-1.5 bg-gradient-to-r from-blue-500 to-blue-300 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-400 to-blue-200 transition-all duration-1000 ease-out" 
              style={{ width: `${Math.min(stats.total * 20, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 p-6 border border-slate-100 hover:border-yellow-200 group transform hover:-translate-y-1">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">In Review</p>
              <p className="text-3xl font-black text-yellow-700">{stats.pending + stats.underReview}</p>
            </div>
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-100 to-yellow-50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
              <Clock size={28} className="text-yellow-600" />
            </div>
          </div>
          <div className="w-full h-1.5 bg-gradient-to-r from-yellow-500 to-yellow-300 rounded-full"></div>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 p-6 border border-slate-100 hover:border-green-200 group transform hover:-translate-y-1">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Published</p>
              <p className="text-3xl font-black text-green-700">{stats.approved}</p>
            </div>
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
              <CheckCircle size={28} className="text-green-600" />
            </div>
          </div>
          <div className="w-full h-1.5 bg-gradient-to-r from-green-500 to-green-300 rounded-full"></div>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 p-6 border border-slate-100 hover:border-orange-200 group transform hover:-translate-y-1">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Needs Action</p>
              <p className="text-3xl font-black text-orange-700">{stats.revisionRequired}</p>
            </div>
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
              <AlertCircle size={28} className="text-orange-600" />
            </div>
          </div>
          <div className="w-full h-1.5 bg-gradient-to-r from-orange-500 to-orange-300 rounded-full">
            {stats.revisionRequired > 0 && (
              <div className="h-full bg-gradient-to-r from-orange-400 to-orange-200 animate-pulse"></div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions - Enhanced Design */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Research Actions</h2>
            <p className="text-slate-600 font-medium">Manage your academic contributions</p>
          </div>
          <BarChart3 size={24} className="text-indigo-600" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => navigate('/student/submit')}
            className="group relative overflow-hidden bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1 hover:scale-[1.02]"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Upload size={24} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-xl font-bold text-white mb-1">Submit Research</p>
                <p className="text-indigo-100 text-sm">Upload new academic paper</p>
              </div>
            </div>
            <ChevronRight size={20} className="absolute bottom-6 right-6 text-white opacity-70 group-hover:translate-x-2 transition-transform duration-300" />
          </button>
          
          <button
            onClick={() => navigate('/student/my-research')}
            className="group relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-500 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1 hover:scale-[1.02]"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <BookOpen size={24} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-xl font-bold text-white mb-1">My Research</p>
                <p className="text-blue-100 text-sm">View all submissions</p>
              </div>
            </div>
            <ChevronRight size={20} className="absolute bottom-6 right-6 text-white opacity-70 group-hover:translate-x-2 transition-transform duration-300" />
          </button>
          
          <button
            onClick={() => navigate('/student/browse')}
            className="group relative overflow-hidden bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1 hover:scale-[1.02]"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Search size={24} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-xl font-bold text-white mb-1">Browse Repository</p>
                <p className="text-purple-100 text-sm">Explore academic papers</p>
              </div>
            </div>
            <ChevronRight size={20} className="absolute bottom-6 right-6 text-white opacity-70 group-hover:translate-x-2 transition-transform duration-300" />
          </button>
        </div>
      </div>

      {/* Recent Submissions - Enhanced Design */}
      <div className="mb-10">
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">Recent Submissions</h3>
              <p className="text-slate-600 text-sm font-medium">Latest research activity</p>
            </div>
            <button
              onClick={() => navigate('/student/my-research')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-700 font-semibold hover:from-indigo-100 hover:to-blue-100 transition-all duration-300 group"
            >
              View All
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          </div>
          
          {recentPapers.length === 0 ? (
            <div className="px-8 py-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center mx-auto mb-6">
                <FileText size={32} className="text-indigo-400" />
              </div>
              <h4 className="text-lg font-semibold text-slate-700 mb-2">No submissions yet</h4>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">Start your research journey by submitting your first academic paper</p>
              <button
                onClick={() => navigate('/student/submit')}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Submit Your First Paper
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {recentPapers.map((paper, index) => (
                <div 
                  key={paper.id} 
                  className="px-8 py-6 hover:bg-gradient-to-r from-slate-50 to-white transition-all duration-300 group cursor-pointer"
                  onClick={() => navigate(`/student/my-research/${paper.id}`)}
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-100 to-white flex items-center justify-center shadow-sm">
                          <FileText size={18} className="text-slate-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 group-hover:text-indigo-700 transition-colors duration-300 mb-1 line-clamp-1">
                            {paper.title}
                          </h4>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1 text-slate-500">
                              <Calendar size={12} />
                              {formatDate(paper.submission_date)}
                            </span>
                            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(paper.status)}`}>
                              {getStatusIcon(paper.status)}
                              {getStatusBadge(paper.status)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-slate-600 text-sm line-clamp-2 pl-13">{paper.abstract}</p>
                    </div>
                    <ChevronRight size={20} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-2 transition-all duration-300 flex-shrink-0 mt-2" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Tips Section */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-8 shadow-lg">
        <div className="flex items-start gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg flex-shrink-0">
            <Lightbulb size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <h4 className="text-xl font-bold text-slate-900">Academic Success Guide</h4>
              <div className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 text-xs font-bold">
                PRO TIPS
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/80 border border-blue-100 hover:bg-white transition-all duration-300 transform hover:-translate-y-1">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center flex-shrink-0">
                    <CheckCircle size={16} className="text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">Clear Research Titles</p>
                    <p className="text-sm text-slate-600">Ensure your title is descriptive and specific</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/80 border border-blue-100 hover:bg-white transition-all duration-300 transform hover:-translate-y-1">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center flex-shrink-0">
                    <FileText size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">Comprehensive Abstracts</p>
                    <p className="text-sm text-slate-600">Write detailed abstracts (150-250 words recommended)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/80 border border-blue-100 hover:bg-white transition-all duration-300 transform hover:-translate-y-1">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center flex-shrink-0">
                    <Search size={16} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">Relevant Keywords</p>
                    <p className="text-sm text-slate-600">Add keywords to improve discoverability</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/80 border border-blue-100 hover:bg-white transition-all duration-300 transform hover:-translate-y-1">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center flex-shrink-0">
                    <Download size={16} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">Proper Formatting</p>
                    <p className="text-sm text-slate-600">Ensure PDFs are well-formatted and readable</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/80 border border-blue-100 hover:bg-white transition-all duration-300 transform hover:-translate-y-1">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center flex-shrink-0">
                    <Users size={16} className="text-orange-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">Timely Responses</p>
                    <p className="text-sm text-slate-600">Respond promptly to revision requests</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/80 border border-blue-100 hover:bg-white transition-all duration-300 transform hover:-translate-y-1">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center flex-shrink-0">
                    <TrendingUp size={16} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">Continuous Improvement</p>
                    <p className="text-sm text-slate-600">Use feedback to enhance future submissions</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;