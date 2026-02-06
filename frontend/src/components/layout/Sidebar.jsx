import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { researchAPI } from '../../utils/api';
import { 
  LayoutDashboard, 
  Settings, 
  BarChart3, 
  BookOpen, 
  LogOut, 
  ChevronLeft, 
  Menu,
  FileSearch,
  CalendarDays,
  Users,
  FileText,
  Upload,
  Bell,
  HelpCircle,
  User,
  Shield,
  Database,
  Award,
  TrendingUp,
  FileCheck,
  CheckCircle,
  Clock,
  Home,
  Grid,
  Library,
  PenTool,
  Search,
  FolderOpen,
  PieChart,
  UserCog,
  FileEdit,
  Calendar,
  Download,
  Eye,
  PlusCircle,
  ExternalLink,
  Sparkles,
  BellDot,
  ChevronRight,
  MoreVertical,
  Settings2,
  GraduationCap
} from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [stats, setStats] = useState({ staffPending: 0, adminPending: 0 });
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user?.role === 'staff' || user?.role === 'admin' || user?.role === 'faculty') {
      fetchBadgeStats();
      fetchNotifications();
      
      const interval = setInterval(() => {
        fetchBadgeStats();
        fetchNotifications();
      }, 10000);
      
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchBadgeStats = async () => {
    try {
      if (user?.role === 'faculty') {
        const response = await researchAPI.getFacultyAssignedPapers();
        const papers = response.data.papers;
        const pendingCount = papers.filter(p => p.status === 'pending_faculty').length;
        setStats({ facultyPending: pendingCount });
      } else {
        const response = await researchAPI.getAllResearch();
        const papers = response.data.papers;
        
        const staffCount = papers.filter(p => p.status === 'pending_editor' || p.status === 'under_review').length;
        const adminCount = papers.filter(p => p.status === 'pending_admin' || p.status === 'under_review').length;
        
        setStats({
          staffPending: staffCount,
          adminPending: adminCount
        });
      }
    } catch (error) {
      console.error('Failed to fetch sidebar stats:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      // Mock notifications for demo
      const mockNotifications = [
        { id: 1, type: 'review', message: 'New paper needs review', count: 2 },
        { id: 2, type: 'update', message: 'System update available', count: 1 }
      ];
      setNotifications(mockNotifications);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleConfig = (role) => {
    const configs = {
      admin: {
        color: 'from-red-500 to-pink-500',
        badgeColor: 'bg-red-100 text-red-700 border-red-200',
        icon: Shield,
        name: 'Administrator'
      },
      faculty: {
        color: 'from-purple-500 to-indigo-500',
        badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
        icon: GraduationCap,
        name: 'Faculty Member'
      },
      staff: {
        color: 'from-violet-500 to-purple-500',
        badgeColor: 'bg-violet-100 text-violet-700 border-violet-200',
        icon: Award,
        name: 'Editor Staff'
      },
      student: {
        color: 'from-blue-500 to-cyan-500',
        badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: BookOpen,
        name: 'Student Scholar'
      }
    };
    return configs[role] || { color: 'from-gray-500 to-slate-500', badgeColor: 'bg-gray-100 text-gray-700', icon: User, name: 'User' };
  };

  const menuConfig = {
    admin: [
      { 
        name: 'Dashboard', 
        icon: LayoutDashboard, 
        path: '/dashboard',
        badge: null,
        description: 'Overview & Analytics'
      },
      { 
        name: 'User Management', 
        icon: UserCog, 
        path: '/admin/users',
        badge: null,
        description: 'Manage system users'
      },
      { 
        name: 'Research Papers', 
        icon: FileEdit, 
        path: '/admin/papers',
        badge: stats.adminPending > 0 ? stats.adminPending : null,
        description: 'Review & approve papers'
      },
      { 
        name: 'Analytics', 
        icon: PieChart, 
        path: '/admin/analytics',
        badge: null,
        description: 'System insights'
      },
      { 
        name: 'Settings', 
        icon: Settings2, 
        path: '/admin/settings',
        badge: null,
        description: 'System configuration'
      },
    ],
    staff: [
      { 
        name: 'Dashboard', 
        icon: LayoutDashboard, 
        path: '/dashboard',
        badge: null,
        description: 'Overview'
      },
      { 
        name: 'Review Submissions', 
        icon: FileCheck, 
        path: '/staff/review',
        badge: stats.staffPending > 0 ? stats.staffPending : null,
        description: 'Review student papers'
      },
      { 
        name: 'My Research', 
        icon: BookOpen, 
        path: '/staff/my-research',
        badge: null,
        description: 'Your publications'
      },
      { 
        name: 'Schedule', 
        icon: Calendar, 
        path: '/staff/schedule',
        badge: null,
        description: 'Review schedule'
      },
      { 
        name: 'Settings', 
        icon: Settings, 
        path: '/staff/settings',
        badge: null,
        description: 'Preferences'
      },
    ],
    faculty: [
      { 
        name: 'Dashboard', 
        icon: LayoutDashboard, 
        path: '/dashboard',
        badge: null,
        description: 'Overview'
      },
      { 
        name: 'Review Submissions', 
        icon: FileCheck, 
        path: '/faculty/review',
        badge: stats.facultyPending > 0 ? stats.facultyPending : null,
        description: 'Review assigned papers'
      },
      { 
        name: 'Browse Repository', 
        icon: Search, 
        path: '/student/browse',
        badge: null,
        description: 'Explore papers'
      },
      { 
        name: 'Profile', 
        icon: User, 
        path: '/faculty/profile',
        badge: null,
        description: 'Account settings'
      },
    ],
    student: [
      { 
        name: 'Dashboard', 
        icon: LayoutDashboard, 
        path: '/dashboard',
        badge: null,
        description: 'Overview'
      },
      { 
        name: 'My Research', 
        icon: FileText, 
        path: '/student/my-research',
        badge: null,
        description: 'Your submissions'
      },
      { 
        name: 'Submit Research', 
        icon: PlusCircle, 
        path: '/student/submit',
        badge: null,
        description: 'Upload new paper'
      },
      { 
        name: 'Browse Repository', 
        icon: Search, 
        path: '/student/browse',
        badge: null,
        description: 'Explore papers'
      },
      { 
        name: 'Profile', 
        icon: User, 
        path: '/student/profile',
        badge: null,
        description: 'Account settings'
      },
    ]
  };

  const menuItems = menuConfig[user?.role] || [];
  const roleConfig = getRoleConfig(user?.role);
  const RoleIcon = roleConfig.icon;

  const totalNotifications = notifications.reduce((sum, notif) => sum + notif.count, 0);

  return (
    <aside className={`bg-gradient-to-b from-slate-900 to-slate-800 border-r border-slate-700 transition-all duration-300 flex flex-col sticky top-0 h-screen ${isCollapsed ? 'w-20' : 'w-72'}`}>
      {/* Header */}
      <div className={`h-20 flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between px-6'} border-b border-slate-700/50 relative`}>
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg">
              <Library size={24} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-white text-lg tracking-tight">ResearchHub</div>
              <div className="text-xs text-slate-400 font-medium">NU Dasmariñas</div>
            </div>
          </div>
        )}
        
        {isCollapsed && (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg">
            <Library size={24} className="text-white" />
          </div>
        )}
        
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className="absolute -right-3 top-8 w-6 h-6 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-full flex items-center justify-center text-white shadow-lg hover:from-indigo-600 hover:to-blue-600 transition-all duration-300 z-10 border-2 border-slate-900"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft size={14} className={isCollapsed ? '' : 'rotate-180'} />
        </button>
      </div>

      {/* User Profile Section */}
      {!isCollapsed && (
        <div className="px-5 py-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${roleConfig.color} flex items-center justify-center shadow-lg`}>
              <RoleIcon size={24} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{user?.fullName || 'User'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full border ${roleConfig.badgeColor}`}>
                  {roleConfig.name}
                </span>
                {totalNotifications > 0 && (
                  <span className="relative">
                    <Bell size={14} className="text-amber-400" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {totalNotifications}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Quick Stats */}
          {(user?.role === 'staff' || user?.role === 'admin') && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-white">{stats.staffPending}</div>
                <div className="text-xs text-slate-400">Pending</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-emerald-400">{stats.adminPending}</div>
                <div className="text-xs text-slate-400">In Review</div>
              </div>
            </div>
          )}
        </div>
      )}

      {isCollapsed && (
        <div className="px-4 py-6 border-b border-slate-700/50">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${roleConfig.color} flex items-center justify-center mx-auto`}>
            <RoleIcon size={20} className="text-white" />
          </div>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.name} 
              to={item.path} 
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative ${
                isActive 
                  ? 'bg-gradient-to-r from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 text-white shadow-lg' 
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white hover:shadow-md'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActive ? 'bg-gradient-to-br from-indigo-500 to-blue-500' : 'bg-slate-800/50 group-hover:bg-slate-700/50'}`}>
                <Icon size={20} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'} />
              </div>
              
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{item.name}</span>
                    {item.badge && (
                      <span className="px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{item.description}</div>
                </div>
              )}
              
              {isCollapsed && item.badge && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg">
                  {item.badge}
                </span>
              )}
              
              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-3 py-2 bg-gradient-to-r from-slate-800 to-slate-900 text-white text-sm rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-2xl border border-slate-700">
                  <div className="font-medium">{item.name}</div>
                  {item.description && (
                    <div className="text-xs text-slate-300 mt-0.5">{item.description}</div>
                  )}
                  {item.badge && (
                    <div className="mt-1 px-2 py-0.5 text-xs bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-full inline-block">
                      {item.badge} pending
                    </div>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Quick Actions */}
      {!isCollapsed && (
        <div className="px-4 py-4 border-t border-slate-700/50">
          <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-amber-400" />
              <span className="text-sm font-bold text-white">Quick Actions</span>
            </div>
            <div className="space-y-2">
              {user?.role === 'student' && (
                <>
                  <button 
                    onClick={() => navigate('/student/submit')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg transition-all duration-200"
                  >
                    <PlusCircle size={16} />
                    Submit Paper
                  </button>
                  <button 
                    onClick={() => navigate('/student/browse')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-slate-300 rounded-lg transition-all duration-200 border border-slate-700"
                  >
                    <Search size={16} />
                    Browse Papers
                  </button>
                </>
              )}
              {(user?.role === 'staff' || user?.role === 'admin') && (
                <button 
                  onClick={() => navigate(user.role === 'staff' ? '/staff/review' : '/admin/papers')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-lg transition-all duration-200"
                >
                  <FileCheck size={16} />
                  Review Papers
                  {(stats.staffPending > 0 || stats.adminPending > 0) && (
                    <span className="ml-auto px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                      {user.role === 'staff' ? stats.staffPending : stats.adminPending}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Section */}
      <div className="border-t border-slate-700/50">
        {/* Help & Support */}
        <div className="p-4">
          <Link
            to="/help"
            className={`flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-xl transition-all duration-200 group relative ${isCollapsed ? 'justify-center' : ''}`}
          >
            <div className="w-10 h-10 rounded-lg bg-slate-800/50 flex items-center justify-center group-hover:bg-slate-700/50">
              <HelpCircle size={20} />
            </div>
            {!isCollapsed && <span className="font-medium">Help Center</span>}
            {isCollapsed && (
              <div className="absolute left-full ml-3 px-3 py-2 bg-gradient-to-r from-slate-800 to-slate-900 text-white text-sm rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-2xl border border-slate-700">
                Help Center
              </div>
            )}
          </Link>
        </div>

        {/* Logout Button */}
        <div className="p-4 pt-0">
          <button 
            onClick={handleLogout} 
            className={`flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-gradient-to-r hover:from-red-500/10 hover:to-pink-500/10 rounded-xl transition-all duration-200 group relative w-full ${isCollapsed ? 'justify-center' : ''}`}
          >
            <div className="w-10 h-10 rounded-lg bg-slate-800/50 flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-red-500/20 group-hover:to-pink-500/20">
              <LogOut size={20} />
            </div>
            {!isCollapsed && <span className="font-medium">Sign Out</span>}
            {isCollapsed && (
              <div className="absolute left-full ml-3 px-3 py-2 bg-gradient-to-r from-slate-800 to-slate-900 text-white text-sm rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-2xl border border-slate-700">
                Sign Out
              </div>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;