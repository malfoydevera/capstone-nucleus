import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  Eye, 
  Search, 
  Users,
  ChevronRight,
  Calendar,
  RefreshCw,
  Sun,
  Moon,
  Settings,
  BarChart3,
  Shield
} from 'lucide-react';
import { researchAPI, authAPI } from '../../utils/api';
import { formatFullName } from '../../utils/names';

// Donut Chart Component
const DonutChart = ({ data, colors, size = 80 }) => {
  const total = data.reduce((acc, item) => acc + item.value, 0);
  let cumulativePercent = 0;

  const getCoordinatesForPercent = (percent) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  return (
    <svg width={size} height={size} viewBox="-1.1 -1.1 2.2 2.2" style={{ transform: 'rotate(-90deg)' }}>
      {total === 0 ? (
        <circle cx="0" cy="0" r="1" fill="none" stroke="#e2e8f0" strokeWidth="0.35" />
      ) : (
        data.map((slice, index) => {
          if (slice.value === 0) return null;
          const percent = slice.value / total;
          const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
          cumulativePercent += percent;
          const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
          const largeArcFlag = percent > 0.5 ? 1 : 0;
          const pathData = [
            `M ${startX} ${startY}`,
            `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
          ].join(' ');
          return (
            <path
              key={index}
              d={pathData}
              fill="none"
              stroke={colors[index]}
              strokeWidth="0.35"
              strokeLinecap="round"
            />
          );
        })
      )}
      <circle cx="0" cy="0" r="0.65" fill="white" />
    </svg>
  );
};

// Mini Bar Chart Component
const MiniBarChart = ({ data, maxHeight = 100 }) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return (
    <div className="flex items-end gap-2 h-full">
      {data.map((item, index) => {
        const height = (item.value / maxValue) * maxHeight;
        const isCurrentMonth = index === new Date().getMonth();
        return (
          <div key={index} className="flex flex-col items-center gap-1 flex-1">
            <div 
              className={`w-full rounded-t-sm transition-all duration-500 ${
                isCurrentMonth 
                  ? 'bg-gradient-to-t from-indigo-600 to-indigo-400' 
                  : 'bg-gradient-to-t from-indigo-200 to-indigo-100 hover:from-indigo-300 hover:to-indigo-200'
              }`}
              style={{ height: `${Math.max(height, 4)}px` }}
            />
            <span className="text-[10px] text-slate-400 font-medium">{months[index]}</span>
          </div>
        );
      })}
    </div>
  );
};

// Circular Progress Component
const CircularProgress = ({ percentage, color, size = 48 }) => {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-xs font-bold`} style={{ color }}>{percentage}%</span>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [papersRes, usersRes] = await Promise.all([
        researchAPI.getAllResearch(),
        authAPI.getAllUsers()
      ]);
      setPapers(papersRes.data?.papers || papersRes.data || []);
      setAllUsers(usersRes.data?.users || usersRes.data || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setPapers([]);
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const monthlyData = useMemo(() => {
    const months = Array(12).fill(0).map((_, i) => ({ month: i, value: 0 }));
    papers.forEach(paper => {
      const date = new Date(paper.submission_date || paper.created_at);
      if (date.getFullYear() === selectedYear) {
        months[date.getMonth()].value++;
      }
    });
    return months;
  }, [papers, selectedYear]);

  // Stats calculations
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const usersByRole = {
    student: allUsers.filter(u => u.role === 'student').length,
    faculty: allUsers.filter(u => u.role === 'faculty').length,
    staff: allUsers.filter(u => u.role === 'staff').length,
    admin: allUsers.filter(u => u.role === 'admin').length,
  };

  const pendingPapers = papers.filter(p => ['pending', 'pending_faculty', 'pending_editor', 'pending_admin', 'under_review'].includes(p.status));
  const approvedPapers = papers.filter(p => p.status === 'approved' || p.status === 'published');
  const rejectedPapers = papers.filter(p => p.status === 'rejected');
  const revisionPapers = papers.filter(p => p.status === 'revision_required');
  const reviewedPapers = approvedPapers.length + rejectedPapers.length + revisionPapers.length;

  const papersThisMonth = papers.filter(p => new Date(p.created_at || p.submission_date) >= firstOfMonth).length;
  const usersThisMonth = allUsers.filter(u => new Date(u.created_at) >= firstOfMonth).length;
  const approvalRate = reviewedPapers > 0 ? Math.round((approvedPapers.length / reviewedPapers) * 100) : 0;

  const recentPapers = [...papers]
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
    .slice(0, 5);

  const getStatusColor = (status) => {
    const colors = {
      pending: 'text-amber-600 bg-amber-50',
      pending_faculty: 'text-amber-600 bg-amber-50',
      pending_editor: 'text-cyan-600 bg-cyan-50',
      pending_admin: 'text-indigo-600 bg-indigo-50',
      under_review: 'text-blue-600 bg-blue-50',
      approved: 'text-emerald-600 bg-emerald-50',
      published: 'text-emerald-600 bg-emerald-50',
      rejected: 'text-red-600 bg-red-50',
      revision_required: 'text-orange-600 bg-orange-50'
    };
    return colors[status] || 'text-slate-600 bg-slate-50';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: 'Pending', pending_faculty: 'With Faculty', pending_editor: 'With Editor',
      pending_admin: 'With Admin', under_review: 'In Review', approved: 'Approved',
      published: 'Published', rejected: 'Rejected', revision_required: 'Revision'
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] animate-fadeIn">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-200 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-sm text-slate-500">Loading dashboard...</p>
      </div>
    );
  }

  const paperStatusData = [
    { value: approvedPapers.length, label: 'Approved' },
    { value: pendingPapers.length, label: 'Pending' },
    { value: rejectedPapers.length, label: 'Rejected' }
  ];
  const paperStatusColors = ['#10b981', '#f59e0b', '#ef4444'];

  const userRoleData = [
    { value: usersByRole.student, label: 'Students' },
    { value: usersByRole.faculty, label: 'Faculty' },
    { value: usersByRole.staff, label: 'Staff' },
    { value: usersByRole.admin, label: 'Admin' }
  ];
  const userRoleColors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b'];

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-6 py-8 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-sm text-slate-600">
              <Calendar size={14} />
              <span>{new Date().toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-slate-200">
              <button className="p-1.5 rounded text-slate-400 hover:text-slate-600"><Sun size={16} /></button>
              <button className="p-1.5 rounded bg-slate-100 text-slate-600"><div className="w-4 h-4 rounded-full bg-slate-600"></div></button>
              <button className="p-1.5 rounded text-slate-400 hover:text-slate-600"><Moon size={16} /></button>
            </div>
            <div className="flex items-center gap-2">
              <img 
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'Admin')}&background=6366f1&color=fff`}
                alt="Profile"
                className="w-9 h-9 rounded-full"
              />
              <span className="text-sm font-medium text-slate-700">{user?.fullName}</span>
            </div>
          </div>
        </div>

        {/* Stats Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Total Papers</p>
                <p className="text-3xl font-bold text-slate-900">{papers.length}</p>
                <p className="text-xs text-slate-400 mt-1">+{papersThisMonth} this month</p>
              </div>
              <DonutChart data={paperStatusData} colors={paperStatusColors} size={70} />
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-slate-500">{approvedPapers.length} Approved</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-slate-500">{pendingPapers.length} Pending</span>
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Total Users</p>
                <p className="text-3xl font-bold text-slate-900">{allUsers.length}</p>
                <p className="text-xs text-slate-400 mt-1">+{usersThisMonth} this month</p>
              </div>
              <DonutChart data={userRoleData} colors={userRoleColors} size={70} />
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-slate-500">{usersByRole.student} Students</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                <span className="text-slate-500">{usersByRole.faculty} Faculty</span>
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Pending Review</p>
                <p className="text-3xl font-bold text-slate-900">{pendingPapers.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Clock size={20} className="text-amber-600" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1">
              {pendingPapers.length > 0 ? (
                <span className="text-xs text-amber-600 font-medium">Action needed</span>
              ) : (
                <span className="text-xs text-slate-400">All caught up</span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Approval Rate</p>
                <p className="text-3xl font-bold text-slate-900">{approvalRate}%</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle size={20} className="text-emerald-600" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1">
              <span className="text-xs text-slate-400">{reviewedPapers} papers reviewed</span>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-slate-900">Submission Trends</h3>
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="text-sm text-slate-600 bg-transparent border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
                <option value={2024}>2024</option>
              </select>
            </div>
            <div className="h-40">
              <MiniBarChart data={monthlyData} maxHeight={120} />
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle size={24} className="text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-500">Approval Rate</p>
                <p className="text-xl font-bold text-slate-900">{approvalRate}%</p>
                <p className="text-xs text-slate-400">{reviewedPapers} reviewed</p>
              </div>
              <CircularProgress percentage={approvalRate || 0} color="#10b981" size={52} />
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Users size={24} className="text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-500">User Growth</p>
                <p className="text-xl font-bold text-slate-900">+{usersThisMonth}</p>
                <p className="text-xs text-slate-400">this month</p>
              </div>
              <CircularProgress percentage={Math.min(usersThisMonth * 10, 100) || 0} color="#6366f1" size={52} />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-5">
          <button
            onClick={() => navigate('/admin/review')}
            className="group bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Eye size={24} className="text-white" />
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-white">Review Papers</p>
                <p className="text-sm text-indigo-100">{pendingPapers.length} pending</p>
              </div>
              <ChevronRight size={20} className="text-white/70 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/users')}
            className="group bg-gradient-to-br from-violet-600 to-violet-700 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Users size={24} className="text-white" />
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-white">Manage Users</p>
                <p className="text-sm text-violet-100">{allUsers.length} users</p>
              </div>
              <ChevronRight size={20} className="text-white/70 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/analytics')}
            className="group bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <BarChart3 size={24} className="text-white" />
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-white">Analytics</p>
                <p className="text-sm text-cyan-100">View reports</p>
              </div>
              <ChevronRight size={20} className="text-white/70 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/settings')}
            className="group bg-gradient-to-br from-slate-600 to-slate-700 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Settings size={24} className="text-white" />
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-white">Settings</p>
                <p className="text-sm text-slate-300">System config</p>
              </div>
              <ChevronRight size={20} className="text-white/70 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>

        {/* Recent Papers Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Recent Submissions</h3>
            <button onClick={() => fetchDashboardData()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <RefreshCw size={16} className="text-slate-400" />
            </button>
          </div>
          
          {recentPapers.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <FileText size={24} className="text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium mb-1">No submissions yet</p>
              <p className="text-sm text-slate-400">Papers will appear here as they are submitted</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Title</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Author</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentPapers.map((paper) => (
                    <tr 
                      key={paper.id} 
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/admin/review/${paper.id}`)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                            <FileText size={16} className="text-slate-500" />
                          </div>
                          <span className="font-medium text-slate-900 truncate max-w-[200px]">{paper.title}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{formatFullName(paper.users) || 'Unknown'}</td>
                      <td className="px-5 py-4 text-sm text-slate-500">{formatDate(paper.submission_date || paper.created_at)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(paper.status)}`}>
                          {getStatusBadge(paper.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <ChevronRight size={16} className="text-slate-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
