import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { notificationsAPI, researchAPI, unwrapApiData } from '../../utils/api';
import {
  LayoutDashboard,
  BookOpen,
  LogOut,
  ChevronLeft,
  FileSearch,
  Users,
  FileText,
  Upload,
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
  GraduationCap,
  Trash2,
  UserPlus
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────
   STYLE CONSTANTS  (Apple design tokens via CSS vars)
───────────────────────────────────────────────────────── */

const S = {
  // Sidebar containers
  aside: (collapsed) => ({
    background: 'var(--color-light-gray)',          // #f5f5f7
    borderRight: '1px solid rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    height: '100vh',
    width: collapsed ? 72 : 264,
    transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
    overflow: 'hidden',
    flexShrink: 0,
  }),

  // Header strip
  header: (collapsed) => ({
    height: 80,
    display: 'flex',
    alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'space-between',
    padding: collapsed ? '0 16px' : '0 20px',
    borderBottom: '1px solid rgba(0,0,0,0.08)',
    position: 'relative',
    flexShrink: 0,
  }),

  // NUCLEUS wordmark
  wordmark: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.31rem',               // 21px – card title size
    fontWeight: 600,
    letterSpacing: 'var(--tracking-card)',
    lineHeight: 'var(--leading-card)',
    color: 'var(--color-near-black)',
  },

  // Collapse toggle button
  collapseBtn: {
    position: 'absolute',
    right: -18,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-circle)',
    background: 'var(--color-overlay)',     // rgba(210,210,215,0.64) — Apple media control
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--color-text-tertiary)',
    zIndex: 20,
    transition: 'background 0.2s, color 0.2s',
  },

  // User profile section
  profileSection: {
    padding: '18px 20px',
    borderBottom: '1px solid rgba(0,0,0,0.08)',
    flexShrink: 0,
  },

  userName: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 'var(--text-link)',             // 14px body emphasis
    letterSpacing: 'var(--tracking-link)',
    color: 'var(--color-near-black)',
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  userEmail: {
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-nano)',              // 10px
    letterSpacing: 'var(--tracking-nano)',
    color: 'var(--color-text-tertiary)',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  roleBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    padding: '3px 10px',
    borderRadius: 'var(--radius-pill)',
    background: 'rgba(0,113,227,0.08)',
    border: '1px solid rgba(0,113,227,0.15)',
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-nano)',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--color-apple-blue)',
  },

  // Nav scroll area
  nav: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },

  // Nav item base
  navItem: (active, collapsed) => ({
    display: 'flex',
    alignItems: 'center',
    gap: collapsed ? 0 : 12,
    justifyContent: collapsed ? 'center' : 'flex-start',
    padding: collapsed ? '10px' : '9px 12px',
    borderRadius: 'var(--radius-standard)',
    textDecoration: 'none',
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-link)',
    fontWeight: active ? 600 : 400,
    letterSpacing: 'var(--tracking-link)',
    color: active ? 'var(--color-apple-blue)' : 'var(--color-text-secondary)',
    background: active ? 'rgba(0,113,227,0.08)' : 'transparent',
    transition: 'background 0.15s, color 0.15s',
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    position: 'relative',
  }),

  // Badge pill on nav item
  badge: {
    marginLeft: 'auto',
    minWidth: 20,
    height: 20,
    padding: '0 6px',
    borderRadius: 'var(--radius-pill)',
    background: 'var(--color-apple-blue)',
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontSize: 10,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Bottom zone (notifications, profile, logout)
  bottomZone: {
    borderTop: '1px solid rgba(0,0,0,0.08)',
    padding: '10px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flexShrink: 0,
  },

  // Tooltip for collapsed state
  tooltip: {
    position: 'absolute',
    left: 'calc(100% + 12px)',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'var(--color-near-black)',
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-nano)',
    letterSpacing: 'var(--tracking-micro)',
    padding: '5px 10px',
    borderRadius: 'var(--radius-micro)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    zIndex: 100,
    opacity: 0,
    transition: 'opacity 0.15s',
  },
};

/* ─────────────────────────────────────────────────────────
   NavItem component
───────────────────────────────────────────────────────── */

const NavItem = ({ to, onClick, icon: Icon, label, badge, active, collapsed, notifType }) => {
  const [hover, setHover] = useState(false);

  const containerStyle = {
    ...S.navItem(active, collapsed),
    background: active
      ? 'rgba(0,113,227,0.08)'
      : hover ? 'rgba(0,0,0,0.04)' : 'transparent',
    color: active ? 'var(--color-apple-blue)' : 'var(--color-text-secondary)',
  };

  const content = (
    <>
      <Icon
        size={18}
        style={{ flexShrink: 0, color: active ? 'var(--color-apple-blue)' : 'inherit' }}
      />
      {!collapsed && (
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      )}
      {!collapsed && badge ? (
        <span style={S.badge}>{badge}</span>
      ) : null}
      {collapsed && (
        <span
          className="apple-nav-tooltip"
          style={{ ...S.tooltip, opacity: hover ? 1 : 0 }}
        >
          {label}
        </span>
      )}
    </>
  );

  const sharedProps = {
    style: containerStyle,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
  };

  if (onClick) {
    return <button {...sharedProps} onClick={onClick}>{content}</button>;
  }

  return <Link to={to} {...sharedProps}>{content}</Link>;
};

/* ─────────────────────────────────────────────────────────
   SIDEBAR
───────────────────────────────────────────────────────── */

const Sidebar = () => {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [stats, setStats] = useState({ staffPending: 0, adminPending: 0 });
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  // ── Data fetching ──────────────────────────────────────
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

  const fetchBadgeStats = async () => {
    try {
      if (user?.role === 'faculty') {
        const res = await researchAPI.getFacultyAssignedPapers();
        const papers = unwrapApiData(res).papers || [];
        const cnt = papers.filter(p => p.status === 'pending_faculty').length;
        setStats({ facultyPending: cnt });
      } else if (user?.role === 'dean' || user?.role === 'program_chair') {
        const res = await researchAPI.getDeanChairAssignedPapers();
        const status = user.role === 'dean' ? 'pending_dean' : 'pending_program_chair';
        const papers = unwrapApiData(res).papers || [];
        const cnt = papers.filter(p => p.status === status).length;
        setStats({ deanChairPending: cnt });
      } else {
        const res = await researchAPI.getAllResearch();
        const papers = unwrapApiData(res).papers || [];
        setStats({
          staffPending: papers.filter(p => p.status === 'pending_editor').length,
          adminPending: papers.filter(p => p.status === 'pending_admin').length,
        });
      }
    } catch { /* silent */ }
  };

  const fetchNotifications = async () => {
    try {
      const res = await notificationsAPI.getMine({ limit: 30 });
      const rows = res.data.notifications || [];
      const grouped = rows.reduce((acc, n) => {
        if (n.is_read) return acc;
        const key = n.type || 'general';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      setNotifications(Object.entries(grouped).map(([type, count], i) => ({ id: `${type}-${i}`, type, count })));
    } catch { /* silent */ }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  // ── Menu config ────────────────────────────────────────
  const menuConfig = {
    admin: [
      { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', description: 'Overview & Analytics' },
      { name: 'User Management', icon: UserCog, path: '/admin/users', badge: null },
      { name: 'Research Papers', icon: FileEdit, path: '/admin/papers', badge: stats.adminPending > 0 ? stats.adminPending : null },
      { name: 'Recycle Bin', icon: Trash2, path: '/admin/papers?recycleBin=1', badge: null },
      { name: 'Analytics', icon: PieChart, path: '/admin/analytics', badge: null },
      { name: 'System Health', icon: Database, path: '/admin/health', badge: null },
      { name: 'Settings', icon: Grid, path: '/admin/settings', badge: null },
    ],
    staff: [
      { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { name: 'Editorial Workspace', icon: FileCheck, path: '/staff/review', badge: stats.staffPending > 0 ? stats.staffPending : null },
      { name: 'Repository', icon: BookOpen, path: '/staff/repository' },
    ],
    faculty: [
      { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { name: 'Review Submissions', icon: FileCheck, path: '/faculty/review', badge: stats.facultyPending > 0 ? stats.facultyPending : null },
      { name: 'Repository', icon: Search, path: '/faculty/repository' },
    ],
    dean: [
      { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { name: 'Review Submissions', icon: FileCheck, path: '/dean/review', badge: stats.deanChairPending > 0 ? stats.deanChairPending : null },
      { name: 'Activity Monitor', icon: Eye, path: '/dean/activity-monitor' },
      { name: 'Audit Logs', icon: Shield, path: '/dean/audit-logs' },
      { name: 'Repository', icon: Search, path: '/dean/repository' },
    ],
    program_chair: [
      { name: 'Program Analytics', icon: LayoutDashboard, path: '/program-chair/analytics' },
      { name: 'Assign Faculty', icon: FileCheck, path: '/program-chair/review', badge: stats.deanChairPending > 0 ? stats.deanChairPending : null },
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

  const menuItems = menuConfig[user?.role] || [];
  const roleLabel = (user?.role || 'user').replace('_', ' ').toUpperCase();
  const totalNotifications = notifications.reduce((s, n) => s + n.count, 0);

  // Active check helper
  const isActive = (path) => {
    const [pathname, query] = path.split('?');
    return location.pathname.startsWith(pathname) && (!query || location.search.includes(query));
  };

  return (
    <aside style={S.aside(isCollapsed)}>

      {/* ── Header ── */}
      <div style={S.header(isCollapsed)}>
        {!isCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 'var(--radius-standard)',
              background: 'var(--color-apple-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <BookOpen size={16} style={{ color: '#fff' }} />
            </div>
            <span style={S.wordmark}>NUCLEUS</span>
          </div>
        )}
        {isCollapsed && (
          <div style={{
            width: 32, height: 32, borderRadius: 'var(--radius-standard)',
            background: 'var(--color-apple-blue)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <BookOpen size={16} style={{ color: '#fff' }} />
          </div>
        )}

        {/* Collapse toggle — Apple media control style */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={S.collapseBtn}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.12)'; e.currentTarget.style.color = 'var(--color-near-black)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-overlay)'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft
            size={14}
            style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}
          />
        </button>
      </div>

      {/* ── User profile ── */}
      {!isCollapsed && (
        <div style={S.profileSection}>
          <div style={S.userName}>{user?.fullName || 'User'}</div>
          <div style={S.userEmail}>{user?.email || ''}</div>
          <div style={S.roleBadge}>
            <Shield size={10} style={{ color: 'var(--color-apple-blue)' }} />
            {roleLabel}
          </div>
        </div>
      )}

      {/* ── Primary nav ── */}
      <nav style={S.nav} aria-label="Main navigation">
        {menuItems.map((item) => (
          <NavItem
            key={item.name}
            to={item.path}
            icon={item.icon}
            label={item.name}
            badge={item.badge}
            active={isActive(item.path)}
            collapsed={isCollapsed}
          />
        ))}
      </nav>

      {/* ── Bottom zone ── */}
      <div style={S.bottomZone}>
        {/* Notifications */}
        <NavItem
          to="/notifications"
          icon={Bell}
          label="Notifications"
          badge={totalNotifications > 0 ? totalNotifications : null}
          active={location.pathname.startsWith('/notifications')}
          collapsed={isCollapsed}
        />

        {/* Profile */}
        <NavItem
          to="/profile"
          icon={User}
          label="Profile"
          active={location.pathname.startsWith('/profile')}
          collapsed={isCollapsed}
        />

        {/* Sign out */}
        <NavItem
          onClick={handleLogout}
          icon={LogOut}
          label="Sign Out"
          active={false}
          collapsed={isCollapsed}
          style={{ color: 'var(--color-text-tertiary)' }}
        />
      </div>
    </aside>
  );
};

export default Sidebar;
