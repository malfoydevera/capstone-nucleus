import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
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
} from 'lucide-react';
import { notificationsAPI, unwrapApiData } from '../../utils/api';
import GuidancePanel from '../../components/ui/GuidancePanel';
import useAutoLoadMore from '../../hooks/useAutoLoadMore';

const APPROVAL_PAGE_SIZE = 3;

const formatTimeAgo = (isoDate) => {
  if (!isoDate) return 'just now';
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);

  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

const Notifications = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [query, setQuery] = useState('');
  const [showNotes, setShowNotes] = useState(true);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [visibleApprovalCount, setVisibleApprovalCount] = useState(APPROVAL_PAGE_SIZE);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  const fetchNotifications = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const response = await notificationsAPI.getMine({ limit: 100 });
      setNotifications(unwrapApiData(response).notifications || []);
    } catch (error) {
      console.error('Failed to fetch notifications page data:', error);
      setNotifications([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
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
        setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }

    if (item.research_id) {
      navigate(`/research/${item.research_id}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await notificationsAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    } finally {
      setMarkingAll(false);
    }
  };

  const getCategory = (item) => {
    const source = `${item.type || ''} ${item.title || ''} ${item.message || ''}`.toLowerCase();

    if (/(revision|revise|rejected|action required|needs action|returned)/.test(source)) {
      return 'action';
    }

    if (/(approval|approved|publish|forwarded|workflow)/.test(source)) {
      return 'approval';
    }

    return 'update';
  };

  const categorized = useMemo(() => {
    const action = [];
    const approval = [];
    const update = [];

    notifications.forEach((item) => {
      const category = getCategory(item);
      if (category === 'action') action.push(item);
      if (category === 'approval') approval.push(item);
      if (category === 'update') update.push(item);
    });

    return { action, approval, update };
  }, [notifications]);

  const filteredByTab = useMemo(() => {
    if (activeTab === 'action') {
      return categorized.action;
    }
    if (activeTab === 'updates') {
      return [...categorized.approval, ...categorized.update];
    }
    return notifications;
  }, [activeTab, categorized.action, categorized.approval, categorized.update, notifications]);

  const searchedNotifications = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return filteredByTab;

    return filteredByTab.filter((item) => {
      const corpus = `${item.type || ''} ${item.title || ''} ${item.message || ''}`.toLowerCase();
      return corpus.includes(normalized);
    });
  }, [filteredByTab, query]);

  const highPriorityNotification = useMemo(() => {
    const source = searchedNotifications.filter((item) => getCategory(item) === 'action');
    if (source.length === 0) return null;
    return source.find((item) => !item.is_read) || source[0];
  }, [searchedNotifications]);

  const approvalItems = useMemo(() => {
    return searchedNotifications
      .filter((item) => getCategory(item) === 'approval' && item.id !== highPriorityNotification?.id)
  }, [highPriorityNotification?.id, searchedNotifications]);

  const visibleApprovalItems = useMemo(
    () => approvalItems.slice(0, visibleApprovalCount),
    [approvalItems, visibleApprovalCount]
  );
  const canLoadMoreApprovals = visibleApprovalCount < approvalItems.length;
  const approvalLoadMoreRef = useAutoLoadMore({
    canLoadMore: canLoadMoreApprovals,
    setVisibleCount: setVisibleApprovalCount,
    step: APPROVAL_PAGE_SIZE,
  });

  useEffect(() => {
    setVisibleApprovalCount(APPROVAL_PAGE_SIZE);
  }, [activeTab, query, approvalItems.length, highPriorityNotification?.id]);

  const snapshot = useMemo(() => {
    const pendingRevision = categorized.action.filter((item) => !item.is_read).length;
    const activeReviews = categorized.approval.filter((item) => !item.is_read).length;
    const totalTracked = Math.max(1, pendingRevision + activeReviews);
    const progress = Math.min(100, Math.round((activeReviews / totalTracked) * 100));

    return {
      pendingRevision,
      activeReviews,
      progress,
    };
  }, [categorized.action, categorized.approval]);

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

  return (
    <div
      className="w-full min-h-full -m-4 md:-m-8 p-4 md:p-8"
      style={{
        fontFamily: 'Montserrat, Inter, Segoe UI, sans-serif',
        background: 'radial-gradient(circle at 20% -30%, #ffffff 0%, #f5f6f7 42%, #eceff1 100%)',
      }}
    >
      <div className="mx-auto max-w-7xl animate-fadeIn">
        <div className="grid grid-cols-1 xl:grid-cols-[1.8fr_0.9fr] gap-5">
          <section className="rounded-lg border border-slate-200 bg-white/95 p-5 md:p-6 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-[1.75rem] leading-tight font-bold text-slate-800">
                Notifications <span className="font-medium text-slate-500">({notifications.length})</span>
              </h1>

              <div className="flex flex-wrap items-center gap-2 relative">
                <button
                  onClick={() => setShowActionsMenu((prev) => !prev)}
                  className="px-3 py-2 rounded-md border border-slate-300 text-slate-700 bg-slate-50 hover:bg-slate-100 text-sm font-semibold inline-flex items-center gap-2"
                >
                  Actions <ChevronDown size={14} />
                </button>
                <button
                  onClick={() => fetchNotifications({ silent: true })}
                  disabled={refreshing}
                  className="px-2.5 py-2 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
                  aria-label="Refresh notifications"
                >
                  <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                </button>

                {showActionsMenu ? (
                  <div className="absolute z-20 right-0 top-full mt-1.5 w-48 rounded-md border border-slate-200 bg-white shadow-lg py-1">
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        handleMarkAllRead();
                      }}
                      disabled={markingAll || unreadCount === 0}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {markingAll ? 'Marking...' : 'Mark all as read'}
                    </button>
                    <button
                      onClick={() => setShowActionsMenu(false)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Configure Alerts
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="relative flex-1 max-w-xl">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search notifications..."
                  className="w-full h-10 rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <button
                onClick={handleMarkAllRead}
                disabled={markingAll || unreadCount === 0}
                className="h-10 px-4 rounded-md border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-2"
              >
                <CheckCheck size={15} />
                {markingAll ? 'Marking...' : 'Mark all as read'}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-5 border-b border-slate-200 pb-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${
                  activeTab === 'all' ? 'border-slate-700 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setActiveTab('action')}
                className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${
                  activeTab === 'action' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Needs Action ({categorized.action.length})
              </button>
              <button
                onClick={() => setActiveTab('updates')}
                className={`text-sm font-semibold pb-2 border-b-2 transition-colors ${
                  activeTab === 'updates' ? 'border-slate-700 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                System Updates ({categorized.approval.length + categorized.update.length})
              </button>
            </div>

            <div className="mt-5">
              <GuidancePanel
                title="Notification Guidance"
                description="Use notifications to understand what changed, who acted, and which page to open next."
                items={[
                  'Open unread action items first because they usually require a response or a workflow decision.',
                  'Use search and tabs to separate urgent revisions from general workflow updates.',
                  'If a notification is unclear, open the linked paper or the User Guide before taking action.',
                ]}
                tone="blue"
              />
            </div>

            <div className="mt-4 space-y-4">
              {highPriorityNotification ? (
                <article className="rounded-md border border-amber-200 bg-white shadow-sm overflow-hidden animate-slideInLeft">
                  <div className="flex">
                    <div className="w-2 bg-amber-500" />
                    <div className="flex-1 p-4 md:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-2 text-xs font-bold tracking-wide text-amber-700 uppercase">
                          <ShieldAlert size={14} /> Action Required
                        </div>
                        {!highPriorityNotification.is_read ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">New</span>
                        ) : null}
                      </div>

                      <h2 className="mt-2 text-2xl font-bold text-slate-900 leading-tight">
                        {highPriorityNotification.title || 'Revision Request'}
                      </h2>
                      <p className="text-slate-600 mt-1">
                        {highPriorityNotification.message || 'Your adviser requires revisions. Review the detailed notes to proceed.'}
                      </p>

                      <button
                        onClick={() => setShowNotes((prev) => !prev)}
                        className="mt-3 text-sm font-semibold text-slate-700 inline-flex items-center gap-1"
                      >
                        {showNotes ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        Notes
                      </button>

                      {showNotes ? (
                        <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          <p className="font-semibold text-slate-800">Annotation Summary</p>
                          <p className="mt-1 leading-relaxed break-words">{highPriorityNotification.message || 'No revision note attached yet.'}</p>
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                        <button
                          onClick={() => openNotification(highPriorityNotification)}
                          className="h-10 px-4 rounded-md bg-[#bb5b00] text-white text-sm font-semibold hover:bg-[#a44f00] shadow-[0_5px_14px_rgba(187,91,0,0.28)]"
                        >
                          Resolve Revision
                        </button>

                        <div className="min-w-[220px]">
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1"><Check size={13} className="text-emerald-600" /> Adviser Review</span>
                            <span className="h-px flex-1 bg-amber-300" />
                            <span className="inline-flex items-center gap-1 text-amber-700 font-semibold"><Clock3 size={13} /> Revisions</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ) : (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-slate-600 text-sm">
                  No high-priority revision requests match your current filters.
                </div>
              )}

              <section className="rounded-md border border-emerald-200 bg-emerald-50/45 p-4 animate-slideInRight">
                <h3 className="text-xs tracking-wide uppercase font-bold text-slate-600 mb-3">Approvals and Workflow</h3>

                {approvalItems.length === 0 ? (
                  <div className="rounded-md border border-emerald-100 bg-white/80 p-4 text-sm text-slate-600">
                    No approval updates found for your current tab or search.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleApprovalItems.map((item, index) => (
                      <article
                        key={item.id}
                        className="rounded-md border border-emerald-100 bg-white p-4 shadow-sm"
                        style={{ animationDelay: `${index * 80}ms` }}
                      >
                        <div className="flex gap-3">
                          <div className="mt-0.5 h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <Sparkles size={15} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xl font-semibold text-slate-900 leading-tight">{item.title || 'Paper Approved'}</p>
                              <button
                                onClick={() => openNotification(item)}
                                className="h-9 px-3 rounded-md border border-slate-300 bg-slate-50 text-slate-700 text-sm font-semibold hover:bg-slate-100"
                              >
                                View Document
                              </button>
                            </div>
                            <p className="mt-1 text-slate-700">{item.message || 'Approved and moved to the next review stage.'}</p>
                            <p className="mt-1 text-xs text-slate-500">{formatTimeAgo(item.created_at)}</p>

                            <div className="mt-3 pt-3 border-t border-slate-200 text-sm text-slate-700 overflow-x-auto">
                              <div className="min-w-[360px] flex items-center gap-2">
                                <span className="inline-flex items-center gap-1"><Check size={12} className="text-emerald-600" /> Adviser</span>
                                <span className="text-slate-400">→</span>
                                <span className="inline-flex items-center gap-1"><Check size={12} className="text-emerald-600" /> Chair</span>
                                <span className="text-slate-400">→</span>
                                <span className="font-semibold text-slate-800">Editor [current]</span>
                                <span className="text-slate-400">→</span>
                                <span className="text-slate-500">Admin</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}

                    {approvalItems.length > APPROVAL_PAGE_SIZE ? (
                      <div ref={approvalLoadMoreRef} className="rounded-md border border-emerald-100 bg-white/90 px-4 py-4 text-center">
                        <p className="text-sm text-slate-600">
                          Showing {visibleApprovalItems.length} of {approvalItems.length} workflow updates
                        </p>
                        {canLoadMoreApprovals ? (
                          <button
                            onClick={() => setVisibleApprovalCount((count) => count + APPROVAL_PAGE_SIZE)}
                            className="mt-3 h-9 px-4 rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Load more updates
                          </button>
                        ) : (
                          <p className="mt-2 text-xs text-slate-500">All matching workflow updates are visible.</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </section>
            </div>
          </section>

          <aside className="rounded-lg border border-slate-200 bg-white/95 p-5 md:p-6 shadow-[0_8px_20px_rgba(15,23,42,0.06)] h-fit xl:sticky xl:top-6">
            <h2 className="text-2xl font-bold text-slate-900">Snapshot</h2>
            <p className="text-slate-700 text-lg mt-1">My Paper Status</p>

            <div className="mt-4">
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                  style={{ width: `${snapshot.progress}%` }}
                />
              </div>
              <p className="text-sm text-slate-500 mt-2">Workflow progress: {snapshot.progress}%</p>
            </div>

            <div className="mt-5 space-y-2 text-slate-800">
              <div className="flex items-center justify-between rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
                <span className="inline-flex items-center gap-2 text-sm"><ShieldAlert size={14} className="text-amber-600" /> Pending Revision</span>
                <span className="font-bold">{snapshot.pendingRevision}</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
                <span className="inline-flex items-center gap-2 text-sm"><ListChecks size={14} className="text-emerald-600" /> Active Reviews</span>
                <span className="font-bold">{snapshot.activeReviews}</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
                <span className="inline-flex items-center gap-2 text-sm"><Bell size={14} className="text-slate-600" /> Unread Alerts</span>
                <span className="font-bold">{unreadCount}</span>
              </div>
            </div>

            <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 leading-relaxed">
              <p className="font-semibold text-slate-800 mb-1">Status Insight</p>
              <p>
                Prioritize pending revisions first, then continue review progression through the Adviser, Chair,
                Editor, and Admin pipeline.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Notifications;
