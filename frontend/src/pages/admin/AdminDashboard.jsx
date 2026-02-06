import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Settings,
  BarChart3,
  FileText,
  Database,
  Shield,
  LogOut,
  Bell,
  Search,
  ChevronRight,
  Award,
  BookOpen,
  GraduationCap,
  Calendar,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  FileCheck
} from 'lucide-react';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const stats = [
    { label: 'Total Users', value: '1,247', change: '+12%', icon: Users, color: 'from-blue-500 to-cyan-500' },
    { label: 'Research Papers', value: '856', change: '+8%', icon: FileText, color: 'from-emerald-500 to-green-500' },
    { label: 'Pending Reviews', value: '42', change: '-3%', icon: Clock, color: 'from-amber-500 to-orange-500' },
    { label: 'Approved Today', value: '18', change: '+15%', icon: CheckCircle, color: 'from-violet-500 to-purple-500' },
  ];

  const quickActions = [
    { title: 'User Management', icon: Users, description: 'Manage users and permissions', color: 'bg-gradient-to-br from-blue-100 to-cyan-100', border: 'border-blue-200', textColor: 'text-blue-700', link: '/admin/users' },
    { title: 'Research Oversight', icon: FileCheck, description: 'Review all submissions', color: 'bg-gradient-to-br from-emerald-100 to-green-100', border: 'border-emerald-200', textColor: 'text-emerald-700', link: '/admin/research' },
    { title: 'System Analytics', icon: BarChart3, description: 'View detailed reports', color: 'bg-gradient-to-br from-violet-100 to-purple-100', border: 'border-violet-200', textColor: 'text-violet-700', link: '/admin/analytics' },
    { title: 'Repository Access', icon: Database, description: 'Full research archive', color: 'bg-gradient-to-br from-amber-100 to-orange-100', border: 'border-amber-200', textColor: 'text-amber-700', link: '/admin/repository' },
  ];

  const recentActivities = [
    { user: 'Dr. Sarah Chen', action: 'approved a research paper', time: '10 min ago', type: 'approval' },
    { user: 'John Smith', action: 'submitted new research', time: '25 min ago', type: 'submission' },
    { user: 'Prof. James Wilson', action: 'requested revision', time: '1 hour ago', type: 'revision' },
    { user: 'System', action: 'auto-backup completed', time: '2 hours ago', type: 'system' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg">
                <Shield size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Academic Admin Portal</h1>
                <p className="text-sm text-slate-300">Research Management System</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button className="relative p-2 rounded-lg hover:bg-white/10 transition-colors">
                <Bell size={20} />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-pink-500 text-xs font-bold rounded-full flex items-center justify-center">
                  3
                </span>
              </button>
              
              <div className="hidden md:flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium">{user?.fullName}</p>
                  <p className="text-xs text-slate-300 capitalize">{user?.role} Account</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-blue-400 flex items-center justify-center font-bold text-white shadow-lg">
                  {user?.fullName?.charAt(0) || 'A'}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 transition-all duration-300 border border-slate-600 shadow-lg group"
              >
                <LogOut size={16} />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg">
                    <GraduationCap size={28} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
                      Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">{user?.fullName?.split(' ')[0] || 'Admin'}</span>
                    </h2>
                    <p className="text-slate-600 font-medium">
                      Here's what's happening in your academic research portal today.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-300">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-indigo-600" />
                    <span className="text-sm font-semibold text-slate-700">
                      {new Date().toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                </div>
                <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700 capitalize">{user?.role}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                    <Icon size={22} className="text-white" />
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${parseInt(stat.change) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {stat.change}
                  </span>
                </div>
                <h3 className="text-3xl font-black text-slate-900 mb-1">{stat.value}</h3>
                <p className="text-slate-600 font-medium">{stat.label}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
                    <Award size={20} className="text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Quick Actions</h3>
                    <p className="text-slate-600 text-sm">Manage your academic portal</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {quickActions.map((action, index) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={index}
                        onClick={() => navigate(action.link)}
                        className={`group flex items-center justify-between p-4 rounded-xl ${action.color} border ${action.border} hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-lg ${action.color} flex items-center justify-center border ${action.border}`}>
                            <Icon size={20} className={action.textColor} />
                          </div>
                          <div className="text-left">
                            <h4 className="font-bold text-slate-900">{action.title}</h4>
                            <p className={`text-sm ${action.textColor}`}>{action.description}</p>
                          </div>
                        </div>
                        <ChevronRight size={18} className={`${action.textColor} group-hover:translate-x-1 transition-transform`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                    <Clock size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Recent Activity</h3>
                    <p className="text-slate-600 text-sm">Latest system updates</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  {recentActivities.map((activity, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200 hover:border-slate-300 transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        activity.type === 'approval' ? 'bg-emerald-100 text-emerald-600' :
                        activity.type === 'submission' ? 'bg-blue-100 text-blue-600' :
                        activity.type === 'revision' ? 'bg-amber-100 text-amber-600' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {activity.type === 'approval' && <CheckCircle size={14} />}
                        {activity.type === 'submission' && <FileText size={14} />}
                        {activity.type === 'revision' && <Eye size={14} />}
                        {activity.type === 'system' && <Settings size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          <span className="font-semibold">{activity.user}</span> {activity.action}
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

        {/* Additional Admin Tools */}
        <div className="mt-8">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center">
                  <Settings size={20} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Admin Tools</h3>
                  <p className="text-slate-600 text-sm">Advanced system management</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200 hover:border-blue-200 transition-colors">
                  <UserCheck size={20} className="text-blue-600 mb-2" />
                  <h4 className="font-bold text-slate-900 mb-1">User Roles</h4>
                  <p className="text-sm text-slate-600">Manage permissions and access levels</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200 hover:border-emerald-200 transition-colors">
                  <BookOpen size={20} className="text-emerald-600 mb-2" />
                  <h4 className="font-bold text-slate-900 mb-1">Categories</h4>
                  <p className="text-sm text-slate-600">Manage research categories and tags</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200 hover:border-amber-200 transition-colors">
                  <FileCheck size={20} className="text-amber-600 mb-2" />
                  <h4 className="font-bold text-slate-900 mb-1">Review Queue</h4>
                  <p className="text-sm text-slate-600">Monitor pending reviews</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200 hover:border-purple-200 transition-colors">
                  <Database size={20} className="text-purple-600 mb-2" />
                  <h4 className="font-bold text-slate-900 mb-1">Backup</h4>
                  <p className="text-sm text-slate-600">System backup and restore</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Profile Summary */}
        <div className="mt-8">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
                  <Shield size={20} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Your Account</h3>
                  <p className="text-slate-600 text-sm">Administrator profile</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-400 to-blue-400 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                      {user?.fullName?.charAt(0) || 'A'}
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">{user?.fullName}</h4>
                      <p className="text-slate-600 font-medium">{user?.email}</p>
                      <div className="mt-2">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 text-sm font-bold border border-emerald-200">
                          <Shield size={12} />
                          {user?.role?.toUpperCase() || 'ADMIN'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200">
                  <h4 className="font-bold text-slate-900 mb-3">Account Security</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Last Login</span>
                      <span className="text-sm font-medium text-slate-900">Today, 09:42 AM</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Password Updated</span>
                      <span className="text-sm font-medium text-slate-900">2 weeks ago</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Session Active</span>
                      <span className="text-sm font-medium text-emerald-600">● Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;