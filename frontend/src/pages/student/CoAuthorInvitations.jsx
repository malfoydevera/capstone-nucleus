import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  MailOpen,
  RefreshCw,
  Search,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { authAPI } from '../../utils/api';
import { formatFullName, getInitials } from '../../utils/names';
import UserGuideLink from '../../components/ui/UserGuideLink';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'closed', label: 'Declined / Expired' },
];

const STATUS_BADGE = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  accepted: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  declined: 'bg-rose-50 text-rose-800 border-rose-200',
  expired: 'bg-slate-100 text-slate-700 border-slate-200',
};

const formatDate = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatRelativeExpiry = (expiresAt, isPending) => {
  if (!expiresAt) return 'No expiry date';
  const expiry = new Date(expiresAt);
  const now = new Date();
  const diffMs = expiry - now;

  if (!isPending || diffMs <= 0) {
    return `Expired ${formatDate(expiresAt)}`;
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 1) return `Expires in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  if (diffHours >= 1) return `Expires in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  return 'Expires soon';
};

const getEffectiveStatus = (invitation) => {
  const expiresAt = invitation.expires_at ? new Date(invitation.expires_at) : null;
  if (invitation.status === 'pending' && expiresAt && expiresAt < new Date()) {
    return 'expired';
  }
  return invitation.status;
};

const CoAuthorInvitations = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedToken = searchParams.get('token') || '';
  const statusParam = searchParams.get('status') || 'all';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingToken, setActingToken] = useState('');
  const [invitations, setInvitations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState(
    STATUS_FILTERS.some((f) => f.key === statusParam) ? statusParam : 'all'
  );

  const cardRefs = useRef({});

  const fetchInvitations = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await authAPI.getCoAuthorInvitations();
      const rows = response.data?.data?.invitations || response.data?.invitations || [];
      setInvitations(rows);
    } catch (error) {
      console.error('Failed to fetch co-author invitations:', error);
      toast.error('Failed to load invitations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  useEffect(() => {
    if (STATUS_FILTERS.some((f) => f.key === statusParam)) {
      setActiveFilter(statusParam);
    }
  }, [statusParam]);

  useEffect(() => {
    if (!highlightedToken || loading) return;

    const match = invitations.find((inv) => inv.token === highlightedToken);
    if (match && match.status === 'pending') {
      setActiveFilter('pending');
    }

    const timer = setTimeout(() => {
      cardRefs.current[highlightedToken]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);

    return () => clearTimeout(timer);
  }, [highlightedToken, invitations, loading]);

  const counts = useMemo(() => {
    const pending = invitations.filter((inv) => getEffectiveStatus(inv) === 'pending').length;
    const accepted = invitations.filter((inv) => inv.status === 'accepted').length;
    const closed = invitations.filter((inv) => {
      const status = getEffectiveStatus(inv);
      return status === 'declined' || status === 'expired';
    }).length;

    return { total: invitations.length, pending, accepted, closed };
  }, [invitations]);

  const filteredInvitations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return invitations.filter((invitation) => {
      const effectiveStatus = getEffectiveStatus(invitation);

      if (activeFilter === 'pending' && effectiveStatus !== 'pending') return false;
      if (activeFilter === 'accepted' && invitation.status !== 'accepted') return false;
      if (activeFilter === 'closed' && effectiveStatus !== 'declined' && effectiveStatus !== 'expired') {
        return false;
      }

      if (!query) return true;

      const title = String(invitation.research?.title || '').toLowerCase();
      const inviterName = formatFullName(invitation.inviter).toLowerCase();
      const inviterEmail = String(invitation.inviter?.email || '').toLowerCase();

      return title.includes(query) || inviterName.includes(query) || inviterEmail.includes(query);
    });
  }, [activeFilter, invitations, searchTerm]);

  const applyFilter = (key) => {
    setActiveFilter(key);
    const next = new URLSearchParams(searchParams);
    if (key === 'all') {
      next.delete('status');
    } else {
      next.set('status', key);
    }
    setSearchParams(next, { replace: true });
  };

  const handleAction = async (token, action) => {
    try {
      setActingToken(token);
      if (action === 'accept') {
        await authAPI.acceptCoAuthorInvitation(token);
        toast.success('Invitation accepted — you are now listed as a co-author');
      } else {
        await authAPI.declineCoAuthorInvitation(token);
        toast.success('Invitation declined');
      }
      await fetchInvitations(true);
    } catch (error) {
      toast.error(error.response?.data?.error || error.response?.data?.message || `Failed to ${action} invitation`);
    } finally {
      setActingToken('');
    }
  };

  const summaryCards = [
    {
      key: 'all',
      label: 'Total invites',
      count: counts.total,
      desc: 'All co-author requests',
      icon: UserPlus,
      bg: 'bg-[#3674B5]/10',
      color: 'text-[#3674B5]',
      border: 'border-slate-200',
    },
    {
      key: 'pending',
      label: 'Awaiting response',
      count: counts.pending,
      desc: 'Need your accept or decline',
      icon: Clock3,
      bg: 'bg-amber-50',
      color: 'text-amber-600',
      border: 'border-amber-100',
    },
    {
      key: 'accepted',
      label: 'Accepted',
      count: counts.accepted,
      desc: 'You joined as co-author',
      icon: CheckCircle2,
      bg: 'bg-emerald-50',
      color: 'text-emerald-600',
      border: 'border-emerald-100',
    },
    {
      key: 'closed',
      label: 'Declined / expired',
      count: counts.closed,
      desc: 'No longer actionable',
      icon: XCircle,
      bg: 'bg-slate-100',
      color: 'text-slate-600',
      border: 'border-slate-200',
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#3674B5]/20 rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#3674B5] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="mt-5 text-sm font-medium text-slate-500">Loading invitations…</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
      <div className="w-full space-y-5 max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Co-author Invitations</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and respond to invitations to join a research paper as an official co-author
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchInvitations(true)}
            disabled={refreshing}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <UserGuideLink />

        {counts.pending > 0 && (
          <div className="rounded-xl border border-l-4 border-amber-200 border-l-amber-500 bg-amber-50/70 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {counts.pending} invitation{counts.pending > 1 ? 's' : ''} need your response
                </p>
                <p className="text-xs text-amber-800/80 mt-0.5">
                  Accepting adds you to the paper&apos;s author list. Invitations expire after 7 days.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => applyFilter('pending')}
              className="shrink-0 h-9 px-3 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors inline-flex items-center gap-1"
            >
              Review pending
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            const isActive = activeFilter === card.key;

            return (
              <button
                key={card.key}
                type="button"
                onClick={() => applyFilter(card.key)}
                className={`rounded-xl border px-3 py-3 text-left transition-all ${
                  isActive
                    ? 'border-[#3674B5]/40 bg-[#3674B5]/5 shadow-sm ring-1 ring-[#3674B5]/20'
                    : `${card.border} bg-white hover:border-[#3674B5]/25 hover:shadow-sm`
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500 truncate">{card.label}</p>
                    <p className="text-xl font-bold leading-none text-slate-900 mt-1">{card.count}</p>
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{card.desc}</p>
                  </div>
                  <span className={`h-8 w-8 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                    <Icon size={15} className={card.color} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by paper title or inviter…"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30 focus:border-[#3674B5]/40"
              aria-label="Search invitations"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => applyFilter(filter.key)}
                className={`h-9 px-3 rounded-lg text-xs font-semibold transition-colors ${
                  activeFilter === filter.key
                    ? 'bg-[#3674B5] text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {filteredInvitations.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <MailOpen size={24} className="text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-1">
              {invitations.length === 0 ? 'No co-author invitations yet' : 'No invitations match this view'}
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {invitations.length === 0
                ? 'When another student invites you to co-author their paper, it will appear here and in your notifications.'
                : 'Try a different filter or clear your search to see more results.'}
            </p>
            {invitations.length === 0 && (
              <button
                type="button"
                onClick={() => navigate('/student/my-research')}
                className="mt-4 h-9 px-4 rounded-lg bg-[#3674B5] text-white text-xs font-semibold hover:bg-[#2d6299] transition-colors inline-flex items-center gap-1.5"
              >
                View my submissions
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInvitations.map((invitation) => {
              const effectiveStatus = getEffectiveStatus(invitation);
              const isPending = effectiveStatus === 'pending';
              const isHighlighted = highlightedToken && invitation.token === highlightedToken;
              const badgeStyle = STATUS_BADGE[effectiveStatus] || STATUS_BADGE.expired;
              const inviterName = formatFullName(invitation.inviter) || invitation.inviter?.email || 'Unknown';
              const isActing = actingToken === invitation.token;
              const researchId = invitation.research?.id || invitation.research_id;

              return (
                <article
                  key={invitation.id}
                  ref={(node) => {
                    if (invitation.token) {
                      cardRefs.current[invitation.token] = node;
                    }
                  }}
                  className={`rounded-xl border bg-white p-4 sm:p-5 transition-shadow ${
                    isHighlighted
                      ? 'border-[#3674B5] ring-2 ring-[#3674B5]/30 shadow-md'
                      : isPending
                        ? 'border-amber-100 hover:shadow-sm'
                        : 'border-slate-200 hover:shadow-sm'
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-xl bg-[#3674B5]/10 flex items-center justify-center shrink-0">
                        <FileText size={18} className="text-[#3674B5]" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h2 className="text-sm font-semibold text-slate-900 break-words">
                            {invitation.research?.title || 'Untitled research'}
                          </h2>
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide ${badgeStyle}`}>
                            {effectiveStatus}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                              {getInitials(invitation.inviter)}
                            </span>
                            Invited by <span className="font-medium text-slate-700">{inviterName}</span>
                          </span>
                          <span className="hidden sm:inline text-slate-300">·</span>
                          <span>Sent {formatDate(invitation.created_at)}</span>
                        </div>

                        <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
                          <Clock3 size={12} className={isPending ? 'text-amber-500' : 'text-slate-400'} />
                          {formatRelativeExpiry(invitation.expires_at, isPending)}
                        </div>

                        {invitation.responded_at && !isPending && (
                          <p className="mt-1 text-[11px] text-slate-400">
                            Responded {formatDate(invitation.responded_at)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0">
                      {researchId && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/student/my-research/${researchId}`, {
                              state: { from: '/student/co-author-invitations' },
                            })
                          }
                          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                        >
                          <ExternalLink size={13} />
                          View paper
                        </button>
                      )}

                      {isPending && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAction(invitation.token, 'accept')}
                            disabled={isActing}
                            className="h-9 min-w-[44px] px-4 rounded-lg bg-[#3674B5] text-white text-xs font-semibold hover:bg-[#2d6299] disabled:opacity-50 inline-flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <CheckCircle2 size={14} />
                            {isActing ? 'Saving…' : 'Accept'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction(invitation.token, 'decline')}
                            disabled={isActing}
                            className="h-9 min-w-[44px] px-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <XCircle size={14} />
                            Decline
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoAuthorInvitations;
