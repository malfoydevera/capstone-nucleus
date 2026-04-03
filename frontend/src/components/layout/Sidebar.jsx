import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { notificationsAPI, researchAPI } from '../../utils/api';
import supabase from '../../config/supabase';
import { 
  LayoutDashboard, 
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
  GraduationCap,
  Trash2,
  UserPlus
} from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [stats, setStats] = useState({ staffPending: 0, adminPending: 0 });
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user?.id) return;

    fetchNotifications();

    if (['staff', 'admin', 'faculty', 'dean', 'program_chair'].includes(user.role)) {
      fetchBadgeStats();
    }

    const interval = setInterval(() => {
      fetchNotifications();
      if (['staff', 'admin', 'faculty', 'dean', 'program_chair'].includes(user.role)) {
        fetchBadgeStats();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user?.id || !supabase) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const fetchBadgeStats = async () => {
    try {
      if (user?.role === 'faculty') {
        const response = await researchAPI.getFacultyAssignedPapers();
        const papers = response.data.papers;
        const pendingCount = papers.filter(p => p.status === 'pending_faculty').length;
        setStats({ facultyPending: pendingCount });
      } else if (user?.role === 'dean' || user?.role === 'program_chair') {
        const response = await researchAPI.getDeanChairAssignedPapers();
        const papers = response.data.papers;
        const pendingStatus = user.role === 'dean' ? 'pending_dean' : 'pending_program_chair';
        const pendingCount = papers.filter(p => p.status === pendingStatus).length;
        setStats({ deanChairPending: pendingCount });
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
      const response = await notificationsAPI.getMine({ limit: 30 });
      const rows = response.data.notifications || [];

      const groupedUnread = rows.reduce((acc, notif) => {
        if (notif.is_read) return acc;
        const key = notif.type || 'general';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const summary = Object.entries(groupedUnread).map(([type, count], index) => ({
        id: `${type}-${index}`,
        type,
        count,
      }));

      setNotifications(summary);
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
        color: 'from-[#1C4D8D] to-[#2563eb]',
        badgeColor: 'bg-[#1C4D8D]/10 text-[#1C4D8D] border-[#1C4D8D]/20',
        icon: GraduationCap,
        name: 'Adviser'
      },
      dean: {
        color: 'from-violet-600 to-purple-600',
        badgeColor: 'bg-violet-100 text-violet-700 border-violet-200',
        icon: Award,
        name: 'Dean'
      },
      program_chair: {
        color: 'from-teal-600 to-cyan-600',
        badgeColor: 'bg-teal-100 text-teal-700 border-teal-200',
        icon: Users,
        name: 'Program Chair'
      },
      staff: {
        color: 'from-[#2563eb] to-[#1C4D8D]',
        badgeColor: 'bg-[#2563eb]/10 text-[#2563eb] border-[#2563eb]/20',
        icon: Award,
        name: 'Research Editor'
      },
      student: {
        color: 'from-[#1C4D8D] to-[#2563eb]',
        badgeColor: 'bg-[#1C4D8D]/10 text-[#1C4D8D] border-[#1C4D8D]/20',
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
        name: 'Recycle Bin',
        icon: Trash2,
        path: '/admin/papers?recycleBin=1',
        badge: null,
        description: 'Restore deleted papers'
      },
      { 
        name: 'Analytics', 
        icon: PieChart, 
        path: '/admin/analytics',
        badge: null,
        description: 'System insights'
      },
      {
        name: 'System Health',
        icon: Database,
        path: '/admin/health',
        badge: null,
        description: 'API, storage, AI metrics'
      },
      {
        name: 'System Settings',
        icon: Grid,
        path: '/admin/settings',
        badge: null,
        description: 'Upload and policy controls'
      },
      { 
        name: 'Profile', 
        icon: User, 
        path: '/profile',
        badge: null,
        description: 'Profile & exports'
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
        name: 'Browse Repository', 
        icon: BookOpen, 
        path: '/staff/repository',
        badge: null,
        description: 'Browse research papers'
      },
      { 
        name: 'Profile', 
        icon: User, 
        path: '/profile',
        badge: null,
        description: 'Profile & exports'
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
        path: '/faculty/repository',
        badge: null,
        description: 'Explore papers'
      },
      { 
        name: 'Profile', 
        icon: User, 
        path: '/profile',
        badge: null,
        description: 'Account settings'
      },
    ],
    dean: [
      { 
        name: 'Dashboard', 
        icon: LayoutDashboard, 
        path: '/dashboard',
        badge: null,
        description: 'Overview & Monitoring'
      },
      { 
        name: 'Review Submissions', 
        icon: FileCheck, 
        path: '/dean/review',
        badge: stats.deanChairPending > 0 ? stats.deanChairPending : null,
        description: 'Review assigned papers'
      },
      { 
        name: 'Activity Monitor', 
        icon: Eye, 
        path: '/dean/activity-monitor',
        badge: null,
        description: 'Monitor all accounts'
      },
      { 
        name: 'Audit Logs', 
        icon: Shield, 
        path: '/dean/audit-logs',
        badge: null,
        description: 'System activity trail'
      },
      { 
        name: 'Browse Repository', 
        icon: Search, 
        path: '/dean/repository',
        badge: null,
        description: 'Explore papers'
      },
      {
        name: 'Profile',
        icon: User,
        path: '/profile',
        badge: null,
        description: 'Profile & exports'
      },
    ],
    program_chair: [
      { 
        name: 'Program Analytics', 
        icon: LayoutDashboard, 
        path: '/program-chair/analytics',
        badge: null,
        description: 'PC1 and PC3 insights'
      },
      { 
        name: 'Assign Faculty', 
        icon: FileCheck, 
        path: '/program-chair/review',
        badge: stats.deanChairPending > 0 ? stats.deanChairPending : null,
        description: 'PC2 reassignment queue'
      },
      { 
        name: 'Browse Repository', 
        icon: Search, 
        path: '/program-chair/repository',
        badge: null,
        description: 'Explore papers'
      },
      {
        name: 'Profile',
        icon: User,
        path: '/profile',
        badge: null,
        description: 'Profile & exports'
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
        name: 'Portfolio', 
        icon: FileText, 
        path: '/student/portfolio',
        badge: null,
        description: 'Your papers and timeline'
      },
      { 
        name: 'Submit Research', 
        icon: PlusCircle, 
        path: '/student/submit',
        badge: null,
        description: 'Upload new paper'
      },
      {
        name: 'Co-author Invites',
        icon: UserPlus,
        path: '/student/co-author-invitations',
        badge: null,
        description: 'Accept or decline invites'
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
        path: '/profile',
        badge: null,
        description: 'Account settings'
      },
    ]
  };

  const menuItems = menuConfig[user?.role] || [];
  const roleConfig = getRoleConfig(user?.role);
  const primaryMenuItems = menuItems.filter((item) => item.path !== '/profile');
  const roleLabel = (user?.role || 'user').replace('_', ' ').toUpperCase();

  const totalNotifications = notifications.reduce((sum, notif) => sum + notif.count, 0);

  return (
    <aside className={`bg-[#f5f6f7] border-r border-slate-200 transition-all duration-300 flex flex-col sticky top-0 h-screen ${isCollapsed ? 'w-20' : 'w-72'}`}>
      <div className={`h-24 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-5 border-b border-slate-200 relative`}>
        {!isCollapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center shadow-md">
              <BookOpen size={22} className="text-white" />
            </div>
            <h1 className="text-3xl leading-none tracking-tight font-black text-slate-800">NUCLEUS</h1>
          </div>
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center shadow-md">
            <BookOpen size={22} className="text-white" />
          </div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white border border-slate-200 text-slate-500 shadow-md hover:text-slate-700 transition-colors flex items-center justify-center"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft size={18} className={isCollapsed ? 'rotate-180' : ''} />
        </button>
      </div>

      {!isCollapsed && (
        <div className="px-6 py-6 border-b border-slate-200">
          <p className="text-2xl leading-tight font-extrabold text-slate-800 truncate">{user?.fullName || 'User'}</p>
          <p className="text-base leading-tight text-slate-600 truncate mt-1">{user?.email || 'No email'}</p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-200 text-slate-700 font-black text-xs tracking-[0.08em]">
            <Shield size={14} className="text-emerald-500" />
            {roleLabel}
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
        {primaryMenuItems.map((item) => {
          const [itemPathname, itemQuery] = item.path.split('?');
          const isPathMatch = location.pathname.startsWith(itemPathname);
          const isQueryMatch = !itemQuery || location.search.includes(itemQuery);
          const isActive = isPathMatch && isQueryMatch;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`group relative flex items-center ${isCollapsed ? 'justify-center' : 'gap-4'} px-3 py-3.5 rounded-2xl transition-colors ${
                isActive
                  ? 'bg-white text-slate-800 border border-slate-200 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Icon size={22} className="flex-shrink-0" />
              {!isCollapsed && <span className="text-lg leading-none font-semibold">{item.name === 'Browse Repository' ? 'Repository' : item.name}</span>}
              {!isCollapsed && item.badge ? (
                <span className="ml-auto min-w-[22px] h-[22px] px-1.5 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center">
                  {item.badge}
                </span>
              ) : null}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                  {item.name}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 px-4 py-5 space-y-1">
        <Link
          to="/notifications"
          className={`w-full relative flex items-center ${isCollapsed ? 'justify-center' : 'gap-4'} px-3 py-3.5 rounded-2xl transition-colors ${
            location.pathname.startsWith('/notifications')
              ? 'bg-emerald-100 text-emerald-700'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          <Bell size={22} />
          {!isCollapsed && <span className="text-lg leading-none font-semibold">Notifications</span>}
          {totalNotifications > 0 && (
            <span className="absolute right-3 min-w-[22px] h-[22px] px-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
              {totalNotifications}
            </span>
          )}
        </Link>

        <Link
          to="/profile"
          className={`group relative flex items-center ${isCollapsed ? 'justify-center' : 'gap-4'} px-3 py-3.5 rounded-2xl transition-colors ${
            location.pathname.startsWith('/profile')
              ? 'bg-white text-slate-800 border border-slate-200 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          <User size={22} />
          {!isCollapsed && <span className="text-lg leading-none font-semibold">Profile</span>}
          {isCollapsed && (
            <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
              Profile
            </div>
          )}
        </Link>

        <button
          onClick={handleLogout}
          className={`group relative w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-4'} px-3 py-3.5 rounded-2xl text-rose-600 hover:bg-rose-50 transition-colors`}
        >
          <LogOut size={22} />
          {!isCollapsed && <span className="text-lg leading-none font-semibold">Sign Out</span>}
          {isCollapsed && (
            <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
              Sign Out
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;