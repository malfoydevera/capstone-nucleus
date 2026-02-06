import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Users,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Download,
  Eye,
  Calendar,
  Award,
  BarChart3,
  BookOpen,
  ChevronRight,
  Plus,
  Search,
  Bell,
  Shield,
  GraduationCap,
  Sparkles,
  Activity,
  Target,
  Zap,
  Star,
  PieChart,
  Users2,
  FileCheck,
  Upload,
  Settings
} from 'lucide-react';
import { researchAPI } from '../../utils/api';

const StaffDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    pendingReviews: 0,
    reviewedThisMonth: 0,
    totalPapers: 0,
    studentResearchers: 0,
    approvalRate: 0,
    avgReviewTime: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [topPapers, setTopPapers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const researchRes = await researchAPI.getAllResearch();
      const papers = researchRes.data.papers;

      // Calculate statistics
      const pendingCount = papers.filter(p => 
        p.status === 'pending' || 
        p.status === 'under_review' || 
        p.status === 'pending_editor'
      ).length;
      const reviewedCount = papers.filter(p => p.status === 'approved' || p.status === 'rejected').length;
      const approvedCount = papers.filter(p => p.status === 'approved').length;
      
      // Mock recent activity
      const mockActivity = [
        { id: 1, type: 'review', paper: 'Machine Learning in Healthcare', author: 'John Doe', time: '2 hours ago' },
        { id: 2, type: 'approval', paper: 'AI Ethics Framework', author: 'Jane Smith', time: '1 day ago' },
        { id: 3, type: 'revision', paper: 'Data Privacy Study', author: 'Mike Johnson', time: '2 days ago' }
      ];

      // Get top papers
      const mockTopPapers = papers.slice(0, 3).map(p => ({
        ...p,
        views: Math.floor(Math.random() * 1000),
        downloads: Math.floor(Math.random() * 500)
      }));

      setStats({
        pendingReviews: pendingCount,
        reviewedThisMonth: reviewedCount,
        totalPapers: papers.length,
        studentResearchers: Math.floor(papers.length / 3),
        approvalRate: papers.length > 0 ? Math.round((approvedCount / papers.length) * 100) : 0,
        avgReviewTime: 48
      });

      setRecentActivity(mockActivity);
      setTopPapers(mockTopPapers);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getActivityIcon = (type) => {
    switch(type) {
      case 'review': return <FileText size={16} className="text-blue-500" />;
      case 'approval': return <CheckCircle size={16} className="text-green-500" />;
      case 'revision': return <AlertCircle size={16} className="text-orange-500" />;
      default: return <Activity size={16} className="text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-lg text-slate-600 font-medium">Loading staff dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg">
                <Award size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">Faculty Dashboard</h1>
                <p className="text-slate-300 font-medium">National University Dasmariñas</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm">
                <Bell size={18} className="text-amber-400" />
                <span className="text-sm font-medium">Academic Portal</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold">{user?.fullName || 'Faculty Member'}</p>
                  <p className="text-xs text-slate-300">Faculty Staff</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center font-bold">
                  {user?.fullName?.charAt(0) || 'F'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome & Quick Stats */}
        <div className="mb-10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-violet-600">Dr. {user?.fullName?.split(' ')[0] || 'Professor'}</span>
              </h2>
              <p className="text-slate-600 font-medium">
                Here's an overview of your academic review activities and statistics
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 text-emerald-700 text-sm font-bold flex items-center gap-2">
                <Calendar size={16} />
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-all duration-300 group">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Pending Reviews</p>
                  <p className="text-3xl font-black text-purple-700">{stats.pendingReviews}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <FileText size={24} className="text-purple-600" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock size={14} />
                <span>Avg. review time: {stats.avgReviewTime}h</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-all duration-300 group">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Reviewed This Month</p>
                  <p className="text-3xl font-black text-blue-700">{stats.reviewedThisMonth}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle size={24} className="text-blue-600" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <TrendingUp size={14} />
                <span>{stats.approvalRate}% approval rate</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-all duration-300 group">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Total Papers</p>
                  <p className="text-3xl font-black text-emerald-700">{stats.totalPapers}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <BookOpen size={24} className="text-emerald-600" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Users size={14} />
                <span>{stats.studentResearchers} student researchers</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-all duration-300 group">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Performance Score</p>
                  <p className="text-3xl font-black text-amber-700">98%</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Star size={24} className="text-amber-600" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Zap size={14} />
                <span>Excellent review quality</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Quick Actions & Recent Activity */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
                      <Zap size={20} className="text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Quick Actions</h3>
                      <p className="text-slate-600 text-sm">Common tasks and actions</p>
                    </div>
                  </div>
                  <Sparkles size={20} className="text-amber-500" />
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => navigate('/staff/review')}
                    className="group relative overflow-hidden bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-12 translate-x-12"></div>
                    <div className="relative z-10 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <FileCheck size={24} className="text-white" />
                      </div>
                      <div className="text-left">
                        <p className="text-lg font-bold text-white mb-1">Review Submissions</p>
                        <p className="text-indigo-100 text-sm">{stats.pendingReviews} papers pending</p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="absolute bottom-5 right-5 text-white opacity-70 group-hover:translate-x-2 transition-transform" />
                  </button>

                  <button
                    onClick={() => navigate('/staff/my-research')}
                    className="group relative overflow-hidden bg-gradient-to-br from-purple-600 to-violet-600 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-12 translate-x-12"></div>
                    <div className="relative z-10 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Upload size={24} className="text-white" />
                      </div>
                      <div className="text-left">
                        <p className="text-lg font-bold text-white mb-1">My Research</p>
                        <p className="text-purple-100 text-sm">Manage publications</p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="absolute bottom-5 right-5 text-white opacity-70 group-hover:translate-x-2 transition-transform" />
                  </button>

                  <button
                    onClick={() => navigate('/student/browse')}
                    className="group relative overflow-hidden bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-12 translate-x-12"></div>
                    <div className="relative z-10 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Search size={24} className="text-white" />
                      </div>
                      <div className="text-left">
                        <p className="text-lg font-bold text-white mb-1">Browse Repository</p>
                        <p className="text-emerald-100 text-sm">Explore research papers</p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="absolute bottom-5 right-5 text-white opacity-70 group-hover:translate-x-2 transition-transform" />
                  </button>

                  <button
                    onClick={() => navigate('/staff/settings')}
                    className="group relative overflow-hidden bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-12 translate-x-12"></div>
                    <div className="relative z-10 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Settings size={24} className="text-white" />
                      </div>
                      <div className="text-left">
                        <p className="text-lg font-bold text-white mb-1">Settings</p>
                        <p className="text-slate-100 text-sm">Account preferences</p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="absolute bottom-5 right-5 text-white opacity-70 group-hover:translate-x-2 transition-transform" />
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
                      <Activity size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Recent Activity</h3>
                      <p className="text-slate-600 text-sm">Latest review actions and updates</p>
                    </div>
                  </div>
                  <button
                    onClick={fetchDashboardData}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-indigo-300 transition-colors text-sm font-medium"
                  >
                    Refresh
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                {recentActivity.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity size={48} className="text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">No recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200 hover:border-indigo-200 transition-colors">
                        <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 mb-1">
                            {activity.type === 'review' && 'Reviewed paper: '}
                            {activity.type === 'approval' && 'Approved paper: '}
                            {activity.type === 'revision' && 'Requested revision for: '}
                            {activity.paper}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span>By {activity.author}</span>
                            <span>•</span>
                            <span>{activity.time}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Statistics & Top Papers */}
          <div className="space-y-8">
            {/* Statistics Card */}
            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center">
                    <PieChart size={20} className="text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Review Statistics</h3>
                    <p className="text-slate-600 text-sm">Performance overview</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700">Approval Rate</span>
                    <span className="font-bold text-emerald-600">{stats.approvalRate}%</span>
                  </div>
                  <div className="w-full h-2 bg-gradient-to-r from-slate-200 to-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-green-500"
                      style={{ width: `${stats.approvalRate}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-700">Review Completion</span>
                    <span className="font-bold text-blue-600">94%</span>
                  </div>
                  <div className="w-full h-2 bg-gradient-to-r from-slate-200 to-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500" style={{ width: '94%' }}></div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-700">Student Satisfaction</span>
                    <span className="font-bold text-amber-600">4.8★</span>
                  </div>
                  <div className="w-full h-2 bg-gradient-to-r from-slate-200 to-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500" style={{ width: '96%' }}></div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-200">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-black text-slate-900">{stats.avgReviewTime}h</div>
                      <div className="text-xs text-slate-600">Avg. Review Time</div>
                    </div>
                    <div>
                      <div className="text-2xl font-black text-slate-900">24h</div>
                      <div className="text-xs text-slate-600">Response Time</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Papers */}
            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                    <Target size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Popular Papers</h3>
                    <p className="text-slate-600 text-sm">Recently reviewed papers</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {topPapers.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen size={48} className="text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">No papers available</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {topPapers.map((paper, index) => (
                      <div key={paper.id} className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200 hover:border-indigo-200 transition-colors">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-100 to-white flex items-center justify-center text-slate-700 font-bold text-sm">
                            #{index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-900 text-sm line-clamp-2 mb-1">
                              {paper.title}
                            </h4>
                            <p className="text-xs text-slate-600">
                              By {paper.users?.full_name || 'Researcher'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Eye size={12} />
                              {paper.views?.toLocaleString() || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <Download size={12} />
                              {paper.downloads?.toLocaleString() || 0}
                            </span>
                          </div>
                          <span className="px-2 py-1 bg-gradient-to-r from-slate-100 to-white border border-slate-200 text-slate-700 rounded-full text-xs">
                            {paper.category || 'Research'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Tips */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-200 p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center">
                  <Sparkles size={24} className="text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-2">Review Tips</h4>
                  <ul className="space-y-2 text-sm text-slate-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                      Provide constructive feedback
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                      Review within 72 hours
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                      Check for academic integrity
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StaffDashboard;