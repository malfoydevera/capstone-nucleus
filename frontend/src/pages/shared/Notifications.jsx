import { memo, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ExternalLink,
  FileText,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  X,
  Award,
} from 'lucide-react';
import { notificationsAPI, unwrapApiData } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import UserGuideLink from '../../components/ui/UserGuideLink';
import LoadMoreFooter from '../../components/ui/LoadMoreFooter';
import useAutoLoadMore from '../../hooks/useAutoLoadMore';

const FETCH_PAGE_SIZE = 12;
const LIST_PAGE_SIZE = 8;

const ACTION_TYPES = new Set([
  'revision_required',
  'returned_for_review',
  'returned_to_author',
  'rejection',
  'review_request',
  'coauthor_invite',
  'conflict_declared',
  'escalation_alert',
  'review_deadline_reminder',
  'review_deadline_set',
  'publish_request',
  'publish_request_declined',
]);

const APPROVAL_TYPES = new Set([
  'approval',
  'bypass_approval',
  'workflow_update',
  'publication',
]);

const COAUTHOR_TYPES = new Set([
  'coauthor_added',
  'coauthor_invite',
  'coauthor_invite_accepted',
  'coauthor_invite_declined',
]);

const UPLOAD_TYPES = new Set([
  'paper_uploaded',
  'paper_resubmitted',
  'submission',
]);

const TYPE_LEGEND = [
  { key: 'action', label: 'Action Required', stripe: 'bg-amber-500', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  { key: 'approval', label: 'Approval', stripe: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { key: 'coauthor', label: 'Co-Author', stripe: 'bg-violet-500', badge: 'bg-violet-50 text-violet-800 border-violet-200' },
  { key: 'upload', label: 'Submission', stripe: 'bg-blue-500', badge: 'bg-blue-50 text-blue-800 border-blue-200' },
  { key: 'rejection', label: 'Rejected', stripe: 'bg-rose-500', badge: 'bg-rose-50 text-rose-800 border-rose-200' },
  { key: 'general', label: 'General', stripe: 'bg-slate-400', badge: 'bg-slate-50 text-slate-700 border-slate-200' },
];

function getTypeMeta(type) {
  const t = String(type || '').toLowerCase();

  if (t === 'rejection') {
    return {
      label: 'Rejected',
      legendKey: 'rejection',
      stripe: 'bg-rose-500',
      badge: 'bg-rose-50 text-rose-800 border-rose-200',
      iconBg: 'bg-rose-100',
      iconText: 'text-rose-600',
      Icon: X,
    };
  }
  if (t === 'publish_request') {
    return {
      label: 'Publish Request',
      legendKey: 'action',
      stripe: 'bg-amber-500',
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      iconBg: 'bg-amber-100',
      iconText: 'text-amber-600',
      Icon: Award,
    };
  }
  if (t === 'publish_request_declined') {
    return {
      label: 'Publish Declined',
      legendKey: 'action',
      stripe: 'bg-amber-500',
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      iconBg: 'bg-amber-100',
      iconText: 'text-amber-600',
      Icon: ShieldAlert,
    };
  }
  if (t === 'revision_required' || t === 'returned_to_author' || t === 'returned_for_review') {
    return {
      label: 'Revision',
      legendKey: 'action',
      stripe: 'bg-amber-500',
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      iconBg: 'bg-amber-100',
      iconText: 'text-amber-600',
      Icon: ShieldAlert,
    };
  }
  if (ACTION_TYPES.has(t)) {
    return {
      label: 'Action Required',
      legendKey: 'action',
      stripe: 'bg-amber-500',
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      iconBg: 'bg-amber-100',
      iconText: 'text-amber-600',
      Icon: ShieldAlert,
    };
  }
  if (APPROVAL_TYPES.has(t)) {
    return {
      label: 'Approval',
      legendKey: 'approval',
      stripe: 'bg-emerald-500',
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      iconBg: 'bg-emerald-100',
      iconText: 'text-emerald-600',
      Icon: Sparkles,
    };
  }
  if (COAUTHOR_TYPES.has(t)) {
    return {
      label: 'Co-Author',
      legendKey: 'coauthor',
      stripe: 'bg-violet-500',
      badge: 'bg-violet-50 text-violet-800 border-violet-200',
      iconBg: 'bg-violet-100',
      iconText: 'text-violet-600',
      Icon: UserPlus,
    };
  }
  if (UPLOAD_TYPES.has(t)) {
    return {
      label: 'Submission',
      legendKey: 'upload',
      stripe: 'bg-blue-500',
      badge: 'bg-blue-50 text-blue-800 border-blue-200',
      iconBg: 'bg-blue-100',
      iconText: 'text-blue-600',
      Icon: Upload,
    };
  }
  if (t === 'publication') {
    return {
      label: 'Published',
      legendKey: 'approval',
      stripe: 'bg-sky-500',
      badge: 'bg-sky-50 text-sky-800 border-sky-200',
      iconBg: 'bg-sky-100',
      iconText: 'text-sky-600',
      Icon: BookOpen,
    };
  }
  if (t === 'metadata_corrected') {
    return {
      label: 'Metadata',
      legendKey: 'general',
      stripe: 'bg-slate-400',
      badge: 'bg-slate-50 text-slate-700 border-slate-200',
      iconBg: 'bg-slate-100',
      iconText: 'text-slate-600',
      Icon: FileText,
    };
  }

  return {
    label: 'Update',
    legendKey: 'general',
    stripe: 'bg-slate-400',
    badge: 'bg-slate-50 text-slate-700 border-slate-200',
    iconBg: 'bg-slate-100',
    iconText: 'text-slate-600',
    Icon: Bell,
  };
}

const REVIEW_ROUTE_BY_ROLE = {
  faculty: '/faculty/review',
  dean: '/dean/review',
  program_chair: '/program-chair/review',
  staff: '/staff/review',
  admin: '/admin/review',
};

function resolveNotificationNavigatePath(user, item) {
  const researchId = item.research_id;
  const typeKey = String(item.type || '').toLowerCase();

  if (user?.role === 'student' && researchId) {
    if (
      typeKey === 'revision_required' ||
      typeKey === 'returned_to_author' ||
      typeKey === 'returned_for_review' ||
      typeKey === 'rejection'
    ) {
      return `/student/my-research/${researchId}`;
    }
    return `/research/${researchId}`;
  }

  const workflowish =
    ACTION_TYPES.has(typeKey) ||
    APPROVAL_TYPES.has(typeKey) ||
    UPLOAD_TYPES.has(typeKey) ||
    typeKey === 'metadata_corrected';

  const base = REVIEW_ROUTE_BY_ROLE[user?.role];
  const action = (item.action_url || '').trim();
  const isGenericResearch =
    !action || /^\/research\/[0-9a-f-]{36}\/?$/i.test(action) || action.startsWith('/research/');

  if (researchId && base && workflowish && isGenericResearch) {
    return `${base}/${researchId}`;
  }
  if (action) return action;
  if (researchId) return `/research/${researchId}`;
  return null;
}

function getCategory(item) {
  const typeKey = String(item.type || '').toLowerCase();
  if (ACTION_TYPES.has(typeKey) || typeKey === 'rejection') return 'action';
  if (APPROVAL_TYPES.has(typeKey)) return 'approval';

  const source = `${item.type || ''} ${item.title || ''} ${item.message || ''}`.toLowerCase();
  if (/(revision|revise|rejected|action required|needs action|returned)/.test(source)) return 'action';
  if (/(approval|approved|publish|forwarded|workflow)/.test(source)) return 'approval';
  return 'update';
}

const formatTimeAgo = (isoDate) => {
  if (!isoDate) return 'just now';
  const diffMs = Math.max(0, Date.now() - new Date(isoDate).getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const formatFullDate = (isoDate) => {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const TypeBadge = ({ type }) => {
  const meta = getTypeMeta(type);
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${meta.badge}`}>
      {meta.label}
    </span>
  );
};

const NotificationCard = memo(function NotificationCard({
  item,
  expanded,
  onToggle,
  onOpen,
  onDelete,
  onMarkRead,
  deletingId,
  user,
  isStudent,
}) {
  const meta = getTypeMeta(item.type);
  const Icon = meta.Icon;
  const isUnread = !item.is_read;
  const isDeleting = deletingId === item.id;
  const navigatePath = user ? resolveNotificationNavigatePath(user, item) : null;

  return (
    <article
      className={`relative overflow-hidden rounded-xl border transition-all duration-200 ${
        expanded
          ? 'border-[#3674B5]/40 bg-white shadow-sm ring-1 ring-[#3674B5]/15'
          : isUnread
          ? 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
          : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300'
      }`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${meta.stripe}`} />

      <div className="flex items-start gap-3 px-4 py-3.5 pl-5">
        <button
          type="button"
          onClick={() => onToggle(item)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-start gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3674B5]/40 rounded-lg"
        >
          <div className={`mt-0.5 h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${meta.iconBg}`}>
            <Icon size={16} className={meta.iconText} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <TypeBadge type={item.type} />
              {isUnread && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#3674B5]" aria-label="Unread" />
              )}
            </div>
            <p className={`text-sm leading-snug break-words ${isUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
              {item.title || 'Notification'}
            </p>
            {!expanded && (
              <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{item.message}</p>
            )}
            <p className="mt-1.5 text-[11px] text-slate-400">{formatTimeAgo(item.created_at)}</p>
          </div>

          <ChevronDown
            size={16}
            className={`mt-1 shrink-0 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>

        <button
          type="button"
          onClick={() => onDelete(item.id)}
          disabled={isDeleting}
          aria-label="Delete notification"
          className="mt-1 h-9 w-9 shrink-0 rounded-lg border border-transparent text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 inline-flex items-center justify-center transition-colors"
        >
          {isDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>

      <div
        className={`grid transition-all duration-200 ease-in-out ${
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-slate-100 px-4 py-4 pl-5 space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Full message</p>
              <p className="mt-1.5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                {item.message || 'No additional details provided.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>{formatFullDate(item.created_at)}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span className="capitalize">{getCategory(item)}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>{item.is_read ? 'Read' : 'Unread'}</span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {navigatePath && (
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className="h-8 px-3 rounded-lg bg-[#3674B5] text-white text-xs font-semibold hover:bg-[#2d6299] inline-flex items-center gap-1.5"
                >
                  <ExternalLink size={13} />
                  {isStudent ? 'Open submission' : 'Open related page'}
                </button>
              )}
              {!item.is_read && (
                <button
                  type="button"
                  onClick={() => onMarkRead(item.id)}
                  className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 inline-flex items-center gap-1.5"
                >
                  <Check size={13} />
                  Mark as read
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                disabled={isDeleting}
                className="h-8 px-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                {isDeleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
});

const NotificationCardSkeleton = () => (
  <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white animate-pulse" aria-hidden="true">
    <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200" />
    <div className="flex items-start gap-3 px-4 py-3.5 pl-5">
      <div className="mt-0.5 h-9 w-9 shrink-0 rounded-lg bg-slate-100" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-20 rounded-full bg-slate-100" />
        <div className="h-3.5 w-2/3 rounded bg-slate-200" />
        <div className="h-3 w-1/2 rounded bg-slate-100" />
      </div>
    </div>
  </div>
);

const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStudent = user?.role === 'student';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const applyNotificationPayload = (payload, { append = false } = {}) => {
    const rows = payload.notifications || [];
    setNotifications((prev) => (append ? [...prev, ...rows] : rows));
    setTotalCount(payload.total ?? rows.length);
    setHasMore(Boolean(payload.hasMore));
  };

  const fetchNotifications = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(false);

    try {
      const response = await notificationsAPI.getMine({ limit: FETCH_PAGE_SIZE, offset: 0 });
      applyNotificationPayload(unwrapApiData(response));
      setExpandedId(null);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      if (!silent) setError(true);
      setNotifications([]);
      setTotalCount(0);
      setHasMore(false);
      setExpandedId(null);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMoreNotifications = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await notificationsAPI.getMine({
        limit: FETCH_PAGE_SIZE,
        offset: notifications.length,
      });
      applyNotificationPayload(unwrapApiData(response), { append: true });
    } catch (err) {
      console.error('Failed to load more notifications:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchNotifications({ silent: false });
  }, []);

  const openNotification = async (item) => {
    try {
      if (!item.is_read) {
        await notificationsAPI.markRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
        );
      }
    } catch {
      /* non-critical */
    }

    const path = resolveNotificationNavigatePath(user, item);
    if (path) navigate(path);
  };

  const handleToggle = (item) => {
    const willExpand = expandedId !== item.id;
    setExpandedId(willExpand ? item.id : null);
    if (willExpand && !item.is_read) {
      handleMarkRead(item.id);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await notificationsAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Mark all read error:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      setDeletingId(id);
      await notificationsAPI.deleteOne(id);
      setNotifications((prev) => {
        const next = prev.filter((n) => n.id !== id);
        setTotalCount((count) => Math.max(0, count - 1));
        return next;
      });
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      console.error('Delete notification error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    try {
      setClearingAll(true);
      await notificationsAPI.deleteAll();
      setNotifications([]);
      setTotalCount(0);
      setHasMore(false);
      setExpandedId(null);
      setShowClearConfirm(false);
    } catch (err) {
      console.error('Clear all notifications error:', err);
    } finally {
      setClearingAll(false);
    }
  };

  const categorized = useMemo(() => {
    const action = [];
    const approval = [];
    const update = [];
    notifications.forEach((item) => {
      const cat = getCategory(item);
      if (cat === 'action') action.push(item);
      else if (cat === 'approval') approval.push(item);
      else update.push(item);
    });
    return { action, approval, update };
  }, [notifications]);

  const tabCounts = useMemo(
    () => ({
      all: totalCount || notifications.length,
      action: categorized.action.length,
      updates: categorized.approval.length + categorized.update.length,
    }),
    [totalCount, notifications.length, categorized]
  );

  const filteredByTab = useMemo(() => {
    if (activeTab === 'action') return categorized.action;
    if (activeTab === 'updates') return [...categorized.approval, ...categorized.update];
    return notifications;
  }, [activeTab, notifications, categorized]);

  const searchedNotifications = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filteredByTab;
    return filteredByTab.filter((item) =>
      `${item.type || ''} ${item.title || ''} ${item.message || ''}`.toLowerCase().includes(q)
    );
  }, [filteredByTab, query]);

  const sortedNotifications = useMemo(() => {
    return [...searchedNotifications].sort((a, b) => {
      const score = (item) =>
        (!item.is_read ? 10 : 0) + (getCategory(item) === 'action' ? 5 : 0);
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [searchedNotifications]);

  const visibleNotifications = useMemo(
    () => sortedNotifications.slice(0, visibleCount),
    [sortedNotifications, visibleCount]
  );

  const canLoadMoreList = visibleCount < sortedNotifications.length;
  const listLoadMoreRef = useAutoLoadMore({
    canLoadMore: canLoadMoreList,
    enabled: !loading,
    setVisibleCount,
    step: LIST_PAGE_SIZE,
  });
  const fetchLoadMoreRef = useAutoLoadMore({
    canLoadMore: hasMore,
    enabled: !loading && !canLoadMoreList,
    onLoadMore: loadMoreNotifications,
    step: FETCH_PAGE_SIZE,
  });

  useEffect(() => {
    setVisibleCount(LIST_PAGE_SIZE);
  }, [activeTab, query]);

  useEffect(() => {
    if (expandedId && !notifications.some((n) => n.id === expandedId)) {
      setExpandedId(null);
    }
  }, [notifications, expandedId]);

  if (error) {
    return (
      <div className="w-full min-h-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4">
          <div className="flex items-center gap-3 text-rose-700">
            <ShieldAlert size={18} />
            <span className="font-medium">Failed to load notifications.</span>
          </div>
          <button
            type="button"
            onClick={() => fetchNotifications({ silent: false })}
            className="h-9 px-4 rounded-lg border border-rose-300 bg-white text-rose-700 text-sm font-semibold hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isStudent ? 'Stay updated on your submissions and reviews' : 'Your activity and system updates'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fetchNotifications({ silent: true })}
            disabled={refreshing}
            className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center"
            aria-label="Refresh notifications"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markingAll || unreadCount === 0}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <CheckCheck size={14} />
            {markingAll ? 'Marking…' : 'Mark all read'}
          </button>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            disabled={notifications.length === 0 || clearingAll}
            className="h-9 px-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Trash2 size={14} />
            Clear all
          </button>
        </div>
      </div>

      {showClearConfirm && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-rose-800 font-medium">
            Delete all {notifications.length} loaded notifications? This cannot be undone.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={clearingAll}
              className="h-8 px-3 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {clearingAll ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
              {clearingAll ? 'Clearing…' : 'Confirm clear'}
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {TYPE_LEGEND.map((entry) => (
          <span
            key={entry.key}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${entry.badge}`}
          >
            <span className={`h-2 w-2 rounded-full ${entry.stripe}`} />
            {entry.label}
          </span>
        ))}
      </div>

      <div className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            {loading ? (
              <div className="h-4 w-24 rounded bg-slate-100 animate-pulse" aria-hidden="true" />
            ) : (
              <p className="text-sm text-slate-600">
                <span className="font-bold text-slate-900">{totalCount || notifications.length}</span> total
                {unreadCount > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-[#3674B5] px-2 py-0.5 text-[10px] font-bold text-white">
                    {unreadCount} unread
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="px-4 py-3 border-b border-slate-100">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notifications…"
                className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3674B5]/25 focus:border-[#3674B5]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-1 border-b border-slate-100 -mb-px">
              {[
                { key: 'all', label: 'All', count: tabCounts.all },
                { key: 'action', label: 'Needs Action', count: tabCounts.action },
                { key: 'updates', label: 'Updates', count: tabCounts.updates },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`pb-2.5 px-2 mr-2 text-xs font-semibold border-b-2 transition-colors ${
                    activeTab === key
                      ? key === 'action'
                        ? 'border-amber-500 text-amber-700'
                        : 'border-[#3674B5] text-[#3674B5]'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <UserGuideLink />

          {loading ? (
            <div className="space-y-2 p-3 sm:p-4" role="status" aria-label="Loading notifications">
              {Array.from({ length: 5 }).map((_, index) => (
                <NotificationCardSkeleton key={index} />
              ))}
            </div>
          ) : sortedNotifications.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Bell size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-700">
                {query ? 'No notifications match your search.' : 'No notifications yet.'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {query
                  ? 'Try a different search term.'
                  : 'Activity on your papers will appear here.'}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2 p-3 sm:p-4">
                {visibleNotifications.map((item) => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    expanded={expandedId === item.id}
                    onToggle={handleToggle}
                    onOpen={openNotification}
                    onDelete={handleDelete}
                    onMarkRead={handleMarkRead}
                    deletingId={deletingId}
                    user={user}
                    isStudent={isStudent}
                  />
                ))}
                {loadingMore && (
                  <>
                    <NotificationCardSkeleton />
                    <NotificationCardSkeleton />
                  </>
                )}
              </div>

              {sortedNotifications.length > LIST_PAGE_SIZE && (
                <div className="border-t border-slate-100 px-4">
                  <LoadMoreFooter
                    visibleCount={visibleNotifications.length}
                    totalCount={sortedNotifications.length}
                    canLoadMore={canLoadMoreList}
                    onLoadMore={() => setVisibleCount((c) => c + LIST_PAGE_SIZE)}
                    label="in this view"
                    step={LIST_PAGE_SIZE}
                  />
                  {/* Auto-loads more as this scrolls into view; button above remains as a manual fallback */}
                  <div ref={listLoadMoreRef} className="h-1" aria-hidden="true" />
                </div>
              )}

              {hasMore && (
                <div className="border-t border-slate-100 px-4">
                  <LoadMoreFooter
                    visibleCount={notifications.length}
                    totalCount={totalCount || notifications.length}
                    canLoadMore={hasMore}
                    onLoadMore={loadMoreNotifications}
                    loading={loadingMore}
                    label="notifications"
                    step={FETCH_PAGE_SIZE}
                  />
                  {!canLoadMoreList && (
                    <div ref={fetchLoadMoreRef} className="h-1" aria-hidden="true" />
                  )}
                </div>
              )}
            </>
          )}
      </div>
    </div>
  );
};

export default Notifications;
