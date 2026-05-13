import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  ListChecks,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { notificationsAPI, unwrapApiData } from '../../utils/api';
import GuidancePanel from '../../components/ui/GuidancePanel';
import useAutoLoadMore from '../../hooks/useAutoLoadMore';

const APPROVAL_PAGE_SIZE = 3;

// notification.type → category mapping
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

// Map type → icon component
function getNotificationIcon(type) {
  const t = String(type || '').toLowerCase();
  if (COAUTHOR_TYPES.has(t)) return UserPlus;
  if (UPLOAD_TYPES.has(t)) return Upload;
  if (APPROVAL_TYPES.has(t)) return Sparkles;
  if (t === 'rejection') return X;
  if (t === 'revision_required' || t === 'returned_to_author') return ShieldAlert;
  if (t === 'metadata_corrected') return FileText;
  if (t === 'publication') return BookOpen;
  return Bell;
}

// Map type → color class (icon background + text)
function getNotificationColor(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'rejection') return { bg: 'bg-rose-100', text: 'text-rose-600' };
  if (t === 'revision_required' || t === 'returned_to_author' || t === 'returned_for_review')
    return { bg: 'bg-amber-100', text: 'text-amber-600' };
  if (APPROVAL_TYPES.has(t)) return { bg: 'bg-emerald-100', text: 'text-emerald-600' };
  if (COAUTHOR_TYPES.has(t)) return { bg: 'bg-violet-100', text: 'text-violet-600' };
  if (UPLOAD_TYPES.has(t)) return { bg: 'bg-blue-100', text: 'text-blue-600' };
  if (t === 'publication') return { bg: 'bg-sky-100', text: 'text-sky-600' };
  return { bg: 'bg-slate-100', text: 'text-slate-600' };
}

function getCategory(item) {
  const typeKey = String(item.type || '').toLowerCase();
  if (ACTION_TYPES.has(typeKey)) return 'action';
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

// ─── Notification card ────────────────────────────────────────────────────────
function NotificationCard({ item, onOpen, onDelete, onMarkRead }) {
  const [deleting, setDeleting] = useState(false);
  const Icon = getNotificationIcon(item.type);
  const color = getNotificationColor(item.type);
  const isUnread = !item.is_read;

  const handleDelete = async (e) => {
    e.stopPropagation();
    setDeleting(true);
    await onDelete(item.id);
    setDeleting(false);
  };

  const handleMarkRead = async (e) => {
    e.stopPropagation();
    await onMarkRead(item.id);
  };

  return (
    <article
      className={`group relative rounded-lg border transition-all duration-150 ${
        isUnread
          ? 'border-slate-300 bg-white shadow-sm ring-1 ring-slate-200'
          : 'border-slate-200 bg-slate-50/60'
      }`}
    >
      {/* Unread left accent stripe */}
      {isUnread && (
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-[#1C4D8D]" />
      )}

      <div className={`flex gap-3 p-4 ${isUnread ? 'pl-5' : ''}`}>
        {/* Icon */}
        <div className={`mt-0.5 h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center ${color.bg}`}>
          <Icon size={16} className={color.text} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={`text-sm leading-snug truncate ${isUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                {item.title || 'Notification'}
              </p>
              <p className="mt-0.5 text-sm text-slate-600 line-clamp-2 break-words">
                {item.message}
              </p>
            </div>

            {/* Action buttons — visible on hover */}
            <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {isUnread && (
                <button
                  onClick={handleMarkRead}
                  title="Mark as read"
                  className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                >
                  <Check size={13} />
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={deleting}
                title="Delete notification"
                className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:bg-rose-100 hover:text-rose-600"
              >
                {deleting ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className={`text-[11px] ${isUnread ? 'font-semibold text-[#1C4D8D]' : 'text-slate-400'}`}>
              {formatTimeAgo(item.created_at)}
            </span>

            {item.research_id && (
              <button
                onClick={() => onOpen(item)}
                className="text-[11px] font-semibold text-slate-600 hover:text-[#1C4D8D] hover:underline"
              >
                View paper →
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
const Notifications = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [query, setQuery] = useState('');
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [visibleApprovalCount, setVisibleApprovalCount] = useState(APPROVAL_PAGE_SIZE);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const fetchNotifications = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(false);

    try {
      const response = await notificationsAPI.getMine({ limit: 100 });
      setNotifications(unwrapApiData(response).notifications || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      if (!silent) setError(true);
      setNotifications([]);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
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
    } catch { /* non-critical */ }

    if (item.action_url) {
      navigate(item.action_url);
    } else if (item.research_id) {
      navigate(`/research/${item.research_id}`);
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
      await notificationsAPI.deleteOne(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Delete notification error:', err);
    }
  };

  // ── Categorisation ──────────────────────────────────────────────────────────
  const categorized = useMemo(() => {
    const action = [], approval = [], update = [];
    notifications.forEach((item) => {
      const cat = getCategory(item);
      if (cat === 'action') action.push(item);
      else if (cat === 'approval') approval.push(item);
      else update.push(item);
    });
    return { action, approval, update };
  }, [notifications]);

  const tabCounts = useMemo(() => ({
    all: notifications.length,
    action: categorized.action.length,
    updates: categorized.approval.length + categorized.update.length,
  }), [notifications.length, categorized]);

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

  const highPriorityItem = useMemo(() => {
    const actionItems = searchedNotifications.filter((n) => getCategory(n) === 'action');
    return actionItems.find((n) => !n.is_read) || actionItems[0] || null;
  }, [searchedNotifications]);

  const approvalItems = useMemo(
    () => searchedNotifications.filter((n) => getCategory(n) === 'approval' && n.id !== highPriorityItem?.id),
    [searchedNotifications, highPriorityItem]
  );

  const visibleApprovalItems = useMemo(
    () => approvalItems.slice(0, visibleApprovalCount),
    [approvalItems, visibleApprovalCount]
  );

  const updateItems = useMemo(
    () => searchedNotifications.filter((n) => getCategory(n) === 'update' && n.id !== highPriorityItem?.id),
    [searchedNotifications, highPriorityItem]
  );

  const canLoadMoreApprovals = visibleApprovalCount < approvalItems.length;
  const approvalLoadMoreRef = useAutoLoadMore({
    canLoadMore: canLoadMoreApprovals,
    setVisibleCount: setVisibleApprovalCount,
    step: APPROVAL_PAGE_SIZE,
  });

  useEffect(() => {
    setVisibleApprovalCount(APPROVAL_PAGE_SIZE);
  }, [activeTab, query]);

  const snapshot = useMemo(() => {
    const pending = categorized.action.filter((n) => !n.is_read).length;
    const active = categorized.approval.filter((n) => !n.is_read).length;
    const total = Math.max(1, pending + active);
    return { pending, active, progress: Math.min(100, Math.round((active / total) * 100)) };
  }, [categorized]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 text-slate-600 bg-white rounded-lg border border-slate-200 px-5 py-4 shadow-sm">
          <RefreshCw size={18} className="animate-spin" />
          <span className="font-medium">Loading notifications...</span>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between gap-3 bg-rose-50 rounded-lg border border-rose-200 px-5 py-4">
          <div className="flex items-center gap-3 text-rose-700">
            <ShieldAlert size={18} />
            <span className="font-medium">Failed to load notifications. Check your connection and try again.</span>
          </div>
          <button
            onClick={() => fetchNotifications({ silent: false })}
            className="h-9 px-4 rounded-md border border-rose-300 bg-white text-rose-700 text-sm font-semibold hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full min-h-full -m-4 md:-m-8 p-4 md:p-8"
      style={{
        fontFamily: 'Montserrat, Inter, Segoe UI, sans-serif',
        background: 'radial-gradient(circle at 20% -30%, #ffffff 0%, #f5f6f7 42%, #eceff1 100%)',
      }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 xl:grid-cols-[1.8fr_0.9fr] gap-5">

          {/* ── Main panel ── */}
          <section className="rounded-xl border border-slate-200 bg-white/95 p-5 md:p-6 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">

            {/* Header row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 leading-tight">
                  Notifications
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  {notifications.length} total
                  {unreadCount > 0 && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full bg-[#1C4D8D] text-white text-[11px] font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 relative">
                <button
                  onClick={() => fetchNotifications({ silent: true })}
                  disabled={refreshing}
                  className="h-9 w-9 flex items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
                  aria-label="Refresh notifications"
                >
                  <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowActionsMenu((p) => !p)}
                    className="h-9 px-3 rounded-md border border-slate-300 text-slate-700 bg-slate-50 hover:bg-slate-100 text-sm font-semibold inline-flex items-center gap-1.5"
                  >
                    Actions <ChevronDown size={13} />
                  </button>
                  {showActionsMenu && (
                    <div className="absolute z-20 right-0 top-full mt-1 w-48 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                      <button
                        onClick={() => { setShowActionsMenu(false); handleMarkAllRead(); }}
                        disabled={markingAll || unreadCount === 0}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2"
                      >
                        <CheckCheck size={14} className="text-emerald-600" />
                        {markingAll ? 'Marking...' : 'Mark all as read'}
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleMarkAllRead}
                  disabled={markingAll || unreadCount === 0}
                  className="h-9 px-4 rounded-md border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 hidden sm:inline-flex items-center gap-2"
                >
                  <CheckCheck size={14} />
                  {markingAll ? 'Marking...' : 'Mark all read'}
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="mt-4 relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notifications..."
                className="w-full h-10 rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1C4D8D]/30 focus:border-[#1C4D8D]"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="mt-4 flex items-center gap-6 border-b border-slate-200 pb-0">
              {[
                { key: 'all', label: 'All', count: tabCounts.all },
                { key: 'action', label: 'Needs Action', count: tabCounts.action },
                { key: 'updates', label: 'System Updates', count: tabCounts.updates },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === key
                      ? key === 'action'
                        ? 'border-amber-500 text-amber-700'
                        : 'border-[#1C4D8D] text-[#1C4D8D]'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`ml-1.5 inline-flex items-center justify-center min-w-5 h-4.5 px-1.5 rounded-full text-[10px] font-bold ${
                      activeTab === key
                        ? key === 'action' ? 'bg-amber-100 text-amber-700' : 'bg-[#1C4D8D]/10 text-[#1C4D8D]'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Guidance */}
            <div className="mt-4">
              <GuidancePanel
                title="Notification Guide"
                description="Stay on top of your paper's journey through the review pipeline."
                items={[
                  'Unread notifications appear with a blue accent and bold title — address action items first.',
                  'Click "View paper →" or the notification itself to jump directly to the related paper.',
                  'Hover over any notification to reveal Mark-as-read and Delete controls.',
                ]}
                tone="blue"
              />
            </div>

            {/* Empty state for the whole view */}
            {searchedNotifications.length === 0 && (
              <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-6 py-10 text-center">
                <Bell size={32} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-700 font-semibold">
                  {query ? 'No notifications match your search.' : 'No notifications yet.'}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {query
                    ? 'Try a different search term or clear the filter.'
                    : 'Notifications will appear here when there is activity on your papers.'}
                </p>
              </div>
            )}

            {searchedNotifications.length > 0 && (
              <div className="mt-5 space-y-5">

                {/* ── Action required banner ─────────────────────────── */}
                {highPriorityItem ? (
                  <article className="rounded-lg border border-amber-300 bg-amber-50/60 overflow-hidden">
                    <div className="flex">
                      <div className="w-1.5 bg-amber-500 flex-shrink-0" />
                      <div className="flex-1 p-4 md:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="inline-flex items-center gap-2 text-xs font-bold tracking-wide text-amber-700 uppercase">
                            <ShieldAlert size={14} /> Action Required
                          </div>
                          {!highPriorityItem.is_read && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#1C4D8D] text-white">New</span>
                          )}
                        </div>

                        <h2 className="mt-2 text-xl font-bold text-slate-900 leading-tight">
                          {highPriorityItem.title}
                        </h2>
                        <p className="text-slate-700 mt-1 text-sm">
                          {highPriorityItem.message}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => openNotification(highPriorityItem)}
                            className="h-9 px-4 rounded-md bg-[#bb5b00] text-white text-sm font-semibold hover:bg-[#a44f00] shadow-sm"
                          >
                            Resolve Revision
                          </button>
                          <button
                            onClick={() => handleDelete(highPriorityItem.id)}
                            className="h-9 px-3 rounded-md border border-slate-300 text-slate-600 text-sm hover:bg-slate-100 inline-flex items-center gap-1.5"
                          >
                            <Trash2 size={13} /> Dismiss
                          </button>
                          <span className="text-xs text-slate-500 ml-auto">
                            <Clock3 size={12} className="inline mr-1" />
                            {formatTimeAgo(highPriorityItem.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                ) : activeTab !== 'updates' && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    No high-priority action items match your current filters.
                  </div>
                )}

                {/* ── Approvals / Workflow ───────────────────────────── */}
                {approvalItems.length > 0 && (
                  <section>
                    <h3 className="text-xs tracking-widest uppercase font-bold text-slate-500 mb-3">
                      Approvals &amp; Workflow
                    </h3>
                    <div className="space-y-2">
                      {visibleApprovalItems.map((item) => (
                        <NotificationCard
                          key={item.id}
                          item={item}
                          onOpen={openNotification}
                          onDelete={handleDelete}
                          onMarkRead={handleMarkRead}
                        />
                      ))}
                    </div>

                    {approvalItems.length > APPROVAL_PAGE_SIZE && (
                      <div ref={approvalLoadMoreRef} className="mt-3 text-center">
                        <p className="text-xs text-slate-500">
                          Showing {visibleApprovalItems.length} of {approvalItems.length} workflow updates
                        </p>
                        {canLoadMoreApprovals && (
                          <button
                            onClick={() => setVisibleApprovalCount((c) => c + APPROVAL_PAGE_SIZE)}
                            className="mt-2 h-8 px-4 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Load more
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                )}

                {/* ── General Updates ────────────────────────────────── */}
                {updateItems.length > 0 && (
                  <section>
                    <h3 className="text-xs tracking-widest uppercase font-bold text-slate-500 mb-3">
                      General Updates
                    </h3>
                    <div className="space-y-2">
                      {updateItems.map((item) => (
                        <NotificationCard
                          key={item.id}
                          item={item}
                          onOpen={openNotification}
                          onDelete={handleDelete}
                          onMarkRead={handleMarkRead}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </section>

          {/* ── Sidebar snapshot ── */}
          <aside className="rounded-xl border border-slate-200 bg-white/95 p-5 md:p-6 shadow-[0_8px_20px_rgba(15,23,42,0.06)] h-fit xl:sticky xl:top-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">My Paper Status</h2>
              <p className="text-sm text-slate-500 mt-0.5">Workflow snapshot</p>
            </div>

            {/* Progress bar */}
            <div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#1C4D8D] to-blue-400 transition-all duration-500"
                  style={{ width: `${snapshot.progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">Progress: {snapshot.progress}%</p>
            </div>

            {/* Stats */}
            <div className="space-y-2">
              {[
                { icon: ShieldAlert, color: 'text-amber-600', label: 'Pending Revision', value: snapshot.pending },
                { icon: ListChecks, color: 'text-emerald-600', label: 'Active Reviews', value: snapshot.active },
                { icon: Bell, color: 'text-[#1C4D8D]', label: 'Unread', value: unreadCount },
              ].map(({ icon: Icon, color, label, value }) => (
                <div key={label} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <span className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <Icon size={14} className={color} /> {label}
                  </span>
                  <span className={`text-sm font-bold ${value > 0 ? 'text-slate-900' : 'text-slate-400'}`}>{value}</span>
                </div>
              ))}
            </div>

            {/* Insight */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 leading-relaxed">
              <p className="font-semibold text-slate-800 mb-1">Priority Tip</p>
              <p>
                {snapshot.pending > 0
                  ? 'You have revision requests waiting — open the Needs Action tab to address them.'
                  : snapshot.active > 0
                    ? 'Your papers are progressing through review. Check back for approvals.'
                    : 'All caught up! No urgent items at the moment.'}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Notifications;
