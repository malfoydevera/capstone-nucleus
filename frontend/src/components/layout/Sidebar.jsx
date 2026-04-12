import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { notificationsAPI, researchAPI, unwrapApiData } from '../../utils/api';
import {
  LayoutDashboard,
  BookOpen,
  LogOut,
  ChevronLeft,
  Users,
  FileText,
  Bell,
  User,
  Shield,
  Database,
  Award,
  FileCheck,
  Grid,
  PieChart,
  UserCog,
  FileEdit,
  Eye,
  PlusCircle,
  Search,
  Trash2,
  UserPlus,
  Menu,
  X,
  CircleHelp,
} from 'lucide-react';

const MobileNavItem = ({ to, onClick, icon: Icon, label, badge, active, collapsed }) => {
  const commonClassName = `group relative flex items-center rounded-2xl border text-sm font-medium ${
    collapsed ? 'justify-center px-3 py-3' : 'gap-3 px-4 py-3'
  } ${
    active
      ? 'border-[#1C4D8D]/15 bg-[#1C4D8D]/8 text-[#1C4D8D] shadow-sm'
      : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white/80 hover:text-slate-900'
  }`;

  const content = (
    <>
      <Icon size={18} className="flex-shrink-0" />
      {!collapsed ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
      {!collapsed && badge ? (
        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#1C4D8D] px-2 py-0.5 text-[11px] font-bold text-white">
          {badge}
        </span>
      ) : null}
      {collapsed ? (
        <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block">
          {label}
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={commonClassName}>
        {content}
      </button>
    );
  }

  return (
    <Link to={to} className={commonClassName}>
      {content}
    </Link>
  );
};

const Sidebar = () => {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [stats, setStats] = useState({ staffPending: 0, adminPending: 0, facultyPending: 0, deanChairPending: 0 });
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user?.id) return;

    const fetchBadgeStats = async () => {
      try {
        if (user?.role === 'faculty') {
          const res = await researchAPI.getFacultyAssignedPapers();
          const papers = unwrapApiData(res).papers || [];
          const cnt = papers.filter((paper) => paper.status === 'pending_faculty').length;
          setStats((prev) => ({ ...prev, facultyPending: cnt }));
          return;
        }

        if (user?.role === 'dean' || user?.role === 'program_chair') {
          const res = await researchAPI.getDeanChairAssignedPapers();
          const status = user.role === 'dean' ? 'pending_dean' : 'pending_program_chair';
          const papers = unwrapApiData(res).papers || [];
          const cnt = papers.filter((paper) => paper.status === status).length;
          setStats((prev) => ({ ...prev, deanChairPending: cnt }));
          return;
        }

        if (['staff', 'admin'].includes(user?.role)) {
          const res = await researchAPI.getAllResearch();
          const papers = unwrapApiData(res).papers || [];
          setStats((prev) => ({
            ...prev,
            staffPending: papers.filter((paper) => paper.status === 'pending_editor').length,
            adminPending: papers.filter((paper) => paper.status === 'pending_admin').length,
          }));
        }
      } catch {
        // Intentionally silent: navigation should stay usable even if badges fail.
      }
    };

    const fetchNotifications = async () => {
      try {
        const res = await notificationsAPI.getMine({ limit: 30 });
        const rows = res.data.notifications || [];
        const grouped = rows.reduce((acc, notification) => {
          if (notification.is_read) return acc;
          const key = notification.type || 'general';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
        setNotifications(Object.entries(grouped).map(([type, count], index) => ({ id: `${type}-${index}`, type, count })));
      } catch {
        // Intentionally silent.
      }
    };

    fetchNotifications();
    fetchBadgeStats();

    const interval = setInterval(() => {
      fetchNotifications();
      fetchBadgeStats();
    }, 10000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const menuItems = useMemo(() => {
    const totalNotifications = notifications.reduce((sum, item) => sum + item.count, 0);

    const menuConfig = {
      admin: [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { name: 'User Management', icon: UserCog, path: '/admin/users' },
        { name: 'Research Papers', icon: FileEdit, path: '/admin/papers', badge: stats.adminPending || null },
        { name: 'Recycle Bin', icon: Trash2, path: '/admin/papers?recycleBin=1' },
        { name: 'Analytics', icon: PieChart, path: '/admin/analytics' },
        { name: 'System Health', icon: Database, path: '/admin/health' },
        { name: 'Settings', icon: Grid, path: '/admin/settings' },
      ],
      staff: [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { name: 'Editorial Workspace', icon: FileCheck, path: '/staff/review', badge: stats.staffPending || null },
        { name: 'Repository', icon: BookOpen, path: '/staff/repository' },
      ],
      faculty: [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { name: 'Review Submissions', icon: FileCheck, path: '/faculty/review', badge: stats.facultyPending || null },
        { name: 'Repository', icon: Search, path: '/faculty/repository' },
      ],
      dean: [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { name: 'Review Submissions', icon: FileCheck, path: '/dean/review', badge: stats.deanChairPending || null },
        { name: 'Activity Monitor', icon: Eye, path: '/dean/activity-monitor' },
        { name: 'Audit Logs', icon: Shield, path: '/dean/audit-logs' },
        { name: 'Repository', icon: Search, path: '/dean/repository' },
      ],
      program_chair: [
        { name: 'Program Analytics', icon: LayoutDashboard, path: '/program-chair/analytics' },
        { name: 'Assign Faculty', icon: FileCheck, path: '/program-chair/review', badge: stats.deanChairPending || null },
        { name: 'Repository', icon: Search, path: '/program-chair/repository' },
      ],
      student: [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { name: 'Portfolio', icon: FileText, path: '/student/portfolio' },
        { name: 'Submit Research', icon: PlusCircle, path: '/student/submit' },
        { name: 'Co-author Invites', icon: UserPlus, path: '/student/co-author-invitations' },
        { name: 'Repository', icon: Search, path: '/student/browse' },
      ],
    };

    return {
      primary: menuConfig[user?.role] || [],
      secondary: [
        { name: 'Notifications', icon: Bell, path: '/notifications', badge: totalNotifications || null },
        { name: 'Profile', icon: User, path: '/profile' },
        { name: 'User Guide', icon: CircleHelp, path: '/guide' },
      ],
    };
  }, [notifications, stats.adminPending, stats.deanChairPending, stats.facultyPending, stats.staffPending, user?.role]);

  const roleLabel = (user?.role || 'user').replace(/_/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());

  const isActive = (path) => {
    const [pathname, query] = path.split('?');
    return location.pathname.startsWith(pathname) && (!query || location.search.includes(query));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="fixed left-4 top-4 z-50 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white/95 text-slate-700 shadow-lg backdrop-blur lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      {isMobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[18rem] max-w-[85vw] flex-col border-r border-slate-200 bg-[rgba(255,255,255,0.96)] shadow-2xl backdrop-blur-xl transition-transform duration-300 lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:translate-x-0 lg:shadow-none ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'lg:w-[5.5rem]' : 'lg:w-[17rem]'}`}
      >
        <div className={`flex items-center border-b border-slate-200 ${isCollapsed ? 'justify-center px-3 py-5' : 'justify-between px-5 py-5'}`}>
          {!isCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1C4D8D] text-white shadow-sm">
                <BookOpen size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1C4D8D]">NUCLEUS</p>
                <p className="text-xs text-slate-500">Research portal</p>
              </div>
            </div>
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1C4D8D] text-white shadow-sm">
              <BookOpen size={18} />
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-white hover:text-slate-900 lg:inline-flex"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronLeft size={16} className={isCollapsed ? 'rotate-180' : ''} />
            </button>
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-white hover:text-slate-900 lg:hidden"
              aria-label="Close navigation"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {!isCollapsed ? (
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="truncate text-sm font-semibold text-slate-900">{user?.fullName || 'User'}</p>
            <p className="truncate text-xs text-slate-500">{user?.email || ''}</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#1C4D8D]/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#1C4D8D]">
              <Shield size={12} />
              {roleLabel}
            </div>
          </div>
        ) : null}

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4" aria-label="Primary navigation">
          <div className="space-y-1">
            {menuItems.primary.map((item) => (
              <MobileNavItem
                key={item.name}
                to={item.path}
                icon={item.icon}
                label={item.name}
                badge={item.badge}
                active={isActive(item.path)}
                collapsed={isCollapsed}
              />
            ))}
          </div>

          <div className="mt-5 border-t border-slate-200 pt-5">
            <p className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 ${isCollapsed ? 'text-center' : ''}`}>
              {isCollapsed ? 'More' : 'Account'}
            </p>
            <div className="space-y-1">
              {menuItems.secondary.map((item) => (
                <MobileNavItem
                  key={item.name}
                  to={item.path}
                  icon={item.icon}
                  label={item.name}
                  badge={item.badge}
                  active={isActive(item.path)}
                  collapsed={isCollapsed}
                />
              ))}
            </div>
          </div>
        </nav>

        <div className="border-t border-slate-200 px-3 py-4">
          <MobileNavItem
            onClick={handleLogout}
            icon={LogOut}
            label="Sign Out"
            active={false}
            collapsed={isCollapsed}
          />
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
