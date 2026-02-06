import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  FileText,
  Download,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  Award,
  PieChart,
  LineChart,
  Activity,
  Calendar,
  ChevronRight,
  Filter,
  RefreshCw,
  Database,
  BookOpen,
  GraduationCap,
  Shield,
  Sparkles,
  Target,
  BarChart2,
  ChartNoAxesColumn
} from 'lucide-react';

const AdminAnalytics = () => {
  const [timeRange, setTimeRange] = useState('month');
  const [loading, setLoading] = useState(false);

  // Mock data - in a real app, this would come from an API
  const [stats, setStats] = useState({
    totalDownloads: 1234,
    activeUsers: 856,
    submissionRate: 24,
    approvalRate: 78,
    avgReviewTime: 2.5,
    totalPapers: 342
  });

  const [trends, setTrends] = useState({
    downloads: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
      data: [65, 78, 92, 105, 120, 134, 156]
    },
    submissions: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
      data: [12, 15, 18, 22, 24, 28, 24]
    },
    users: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
      data: [456, 478, 512, 560, 612, 698, 856]
    }
  });

  const topCategories = [
    { name: 'Computer Science', count: 124, color: 'from-blue-500 to-cyan-500' },
    { name: 'Engineering', count: 89, color: 'from-emerald-500 to-green-500' },
    { name: 'Medicine', count: 76, color: 'from-red-500 to-pink-500' },
    { name: 'Business', count: 54, color: 'from-purple-500 to-violet-500' },
    { name: 'Education', count: 42, color: 'from-amber-500 to-orange-500' },
  ];

  const recentActivity = [
    { user: 'John Smith', action: 'downloaded paper', paper: 'AI in Healthcare', time: '10 min ago', type: 'download' },
    { user: 'Dr. Sarah Chen', action: 'approved research', paper: 'Quantum Computing', time: '25 min ago', type: 'approval' },
    { user: 'Research Team A', action: 'submitted new paper', paper: 'Renewable Energy', time: '1 hour ago', type: 'submission' },
    { user: 'Prof. James Wilson', action: 'reviewed paper', paper: 'Climate Change', time: '2 hours ago', type: 'review' },
    { user: 'Admin', action: 'published batch', count: 5, time: '4 hours ago', type: 'system' },
  ];

  const handleRefresh = () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const getPercentageChange = (current, previous) => {
    if (previous === 0) return 100;
    return ((current - previous) / previous) * 100;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg">
                <BarChart3 size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
                  System <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">Analytics</span>
                </h1>
                <p className="text-slate-600 font-medium">
                  Comprehensive overview of repository performance and usage metrics
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex gap-2 p-1 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300">
              {['day', 'week', 'month', 'year'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
                    timeRange === range
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg'
                      : 'text-slate-700 hover:text-indigo-600'
                  }`}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-indigo-300 transition-colors"
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg`}>
              <Download size={22} className="text-white" />
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
              +12% this month
            </span>
          </div>
          <h3 className="text-3xl font-black text-slate-900 mb-1">{stats.totalDownloads.toLocaleString()}</h3>
          <p className="text-slate-600 font-medium">Total Downloads</p>
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="text-sm text-slate-500">Avg. 42 downloads/day</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center shadow-lg`}>
              <Users size={22} className="text-white" />
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
              +5% this month
            </span>
          </div>
          <h3 className="text-3xl font-black text-slate-900 mb-1">{stats.activeUsers.toLocaleString()}</h3>
          <p className="text-slate-600 font-medium">Active Users</p>
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="text-sm text-slate-500">42 new users this week</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg`}>
              <CheckCircle size={22} className="text-white" />
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
              {stats.approvalRate}% rate
            </span>
          </div>
          <h3 className="text-3xl font-black text-slate-900 mb-1">{stats.submissionRate}/week</h3>
          <p className="text-slate-600 font-medium">Submission Rate</p>
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="text-sm text-slate-500">Consistent with last week</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Charts */}
        <div className="lg:col-span-2 space-y-8">
          {/* Downloads Chart */}
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
                    <LineChart size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Download Trends</h3>
                    <p className="text-slate-600 text-sm">Monthly download volume</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar size={16} />
                  Last 7 months
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="h-64 flex items-end justify-between gap-1">
                {trends.downloads.data.map((value, index) => (
                  <div key={index} className="flex flex-col items-center flex-1">
                    <div className="text-xs text-slate-500 mb-2">{trends.downloads.labels[index]}</div>
                    <div
                      className="w-full bg-gradient-to-t from-blue-500 to-cyan-500 rounded-t-lg transition-all duration-300 hover:opacity-80"
                      style={{ height: `${(value / Math.max(...trends.downloads.data)) * 80}%` }}
                      title={`${value} downloads`}
                    />
                    <div className="text-xs font-medium text-slate-700 mt-2">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Submissions Chart */}
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center">
                  <Activity size={20} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Submission Activity</h3>
                  <p className="text-slate-600 text-sm">Weekly research submissions</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="h-64 flex items-center justify-center">
                <div className="relative w-48 h-48">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl font-black text-slate-900">{stats.submissionRate}</div>
                      <div className="text-slate-600 text-sm">submissions/week</div>
                    </div>
                  </div>
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    {[0, 60, 120, 180, 240, 300].map((angle, index) => (
                      <circle
                        key={index}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="url(#gradient)"
                        strokeWidth="8"
                        strokeDasharray={`${stats.submissionRate * 2} 100`}
                        strokeDashoffset={angle}
                        transform="rotate(-90 50 50)"
                      />
                    ))}
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Categories & Activity */}
        <div className="space-y-8">
          {/* Top Categories */}
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center">
                  <PieChart size={20} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Top Categories</h3>
                  <p className="text-slate-600 text-sm">Research distribution by field</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {topCategories.map((category, index) => (
                  <div key={index} className="group flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200 hover:border-indigo-300 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${category.color} flex items-center justify-center shadow-sm`}>
                        <BookOpen size={14} className="text-white" />
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-900">{category.name}</h4>
                        <div className="text-xs text-slate-500">{category.count} papers</div>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-slate-700">
                      {Math.round((category.count / stats.totalPapers) * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                  <Clock size={20} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Recent Activity</h3>
                  <p className="text-slate-600 text-sm">Latest system events</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200 hover:border-slate-300 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      activity.type === 'download' ? 'bg-blue-100 text-blue-600' :
                      activity.type === 'approval' ? 'bg-emerald-100 text-emerald-600' :
                      activity.type === 'submission' ? 'bg-purple-100 text-purple-600' :
                      activity.type === 'review' ? 'bg-amber-100 text-amber-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {activity.type === 'download' && <Download size={14} />}
                      {activity.type === 'approval' && <CheckCircle size={14} />}
                      {activity.type === 'submission' && <FileText size={14} />}
                      {activity.type === 'review' && <Eye size={14} />}
                      {activity.type === 'system' && <Database size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        <span className="font-semibold">{activity.user}</span> {activity.action}
                        {activity.paper && (
                          <span className="font-semibold text-indigo-600"> "{activity.paper}"</span>
                        )}
                        {activity.count && (
                          <span className="font-semibold text-indigo-600"> ({activity.count} papers)</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 hover:border-indigo-300 transition-colors text-sm font-medium">
                View All Activity
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
              <Clock size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Avg. Review Time</p>
              <p className="text-2xl font-black text-slate-900">{stats.avgReviewTime} days</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center">
              <Award size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Approval Rate</p>
              <p className="text-2xl font-black text-slate-900">{stats.approvalRate}%</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-100 to-pink-100 flex items-center justify-center">
              <XCircle size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Rejection Rate</p>
              <p className="text-2xl font-black text-slate-900">{100 - stats.approvalRate}%</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center">
              <Target size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">System Uptime</p>
              <p className="text-2xl font-black text-slate-900">99.8%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Placeholder */}
      <div className="mt-8 bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border-2 border-dashed border-slate-300 overflow-hidden">
        <div className="p-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center mx-auto mb-6">
            <ChartNoAxesColumn size={36} className="text-indigo-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-3">Advanced Analytics Dashboard</h3>
          <p className="text-slate-600 mb-8 max-w-md mx-auto">
            More detailed charts, predictive analytics, and custom reporting features are coming soon.
          </p>
          <div className="flex justify-center gap-4">
            <button className="px-6 py-3 bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 rounded-xl font-medium hover:border-indigo-300 transition-colors">
              Request Feature
            </button>
            <button className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-blue-700 transition-all duration-300">
              Schedule Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;