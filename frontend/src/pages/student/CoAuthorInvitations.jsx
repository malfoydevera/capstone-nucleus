import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock3, MailOpen, RefreshCw, XCircle } from 'lucide-react';
import { authAPI } from '../../utils/api';
import { formatFullName } from '../../utils/names';

const STATUS_STYLES = {
  pending: 'bg-amber-50 border-amber-200 text-amber-800',
  accepted: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  declined: 'bg-rose-50 border-rose-200 text-rose-800',
  expired: 'bg-slate-100 border-slate-200 text-slate-700',
};

const CoAuthorInvitations = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingToken, setActingToken] = useState('');
  const [invitations, setInvitations] = useState([]);

  const highlightedToken = searchParams.get('token') || '';

  const fetchInvitations = async (silent = false) => {
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
  };

  useEffect(() => {
    fetchInvitations();
  }, []);

  const pendingInvitations = useMemo(
    () => invitations.filter((inv) => inv.status === 'pending'),
    [invitations]
  );

  const handleAction = async (token, action) => {
    try {
      setActingToken(token);
      if (action === 'accept') {
        await authAPI.acceptCoAuthorInvitation(token);
        toast.success('Invitation accepted');
      } else {
        await authAPI.declineCoAuthorInvitation(token);
        toast.success('Invitation declined');
      }
      await fetchInvitations(true);
    } catch (error) {
      toast.error(error.response?.data?.error || `Failed to ${action} invitation`);
    } finally {
      setActingToken('');
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 text-slate-700">
          <RefreshCw size={16} className="animate-spin" />
          Loading invitations...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fadeIn">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Co-author Invitations</h1>
          <p className="text-slate-600 mt-1">Accept invitations to be added as an official co-author on a paper.</p>
        </div>
        <button
          onClick={() => fetchInvitations(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Pending</p>
          <p className="text-2xl font-black text-slate-900">{pendingInvitations.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Accepted</p>
          <p className="text-2xl font-black text-emerald-700">{invitations.filter((i) => i.status === 'accepted').length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Declined/Expired</p>
          <p className="text-2xl font-black text-rose-700">{invitations.filter((i) => i.status === 'declined' || i.status === 'expired').length}</p>
        </div>
      </div>

      {invitations.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600">
          <MailOpen size={28} className="mx-auto mb-3 text-slate-400" />
          No co-author invitations yet.
        </div>
      ) : (
        <div className="space-y-4">
          {invitations.map((invitation) => {
            const isPending = invitation.status === 'pending';
            const isHighlighted = highlightedToken && invitation.token === highlightedToken;
            const style = STATUS_STYLES[invitation.status] || STATUS_STYLES.expired;
            const expiresAt = invitation.expires_at ? new Date(invitation.expires_at) : null;
            const expired = isPending && expiresAt && expiresAt < new Date();

            return (
              <div
                key={invitation.id}
                className={`rounded-2xl border p-5 bg-white ${isHighlighted ? 'ring-2 ring-indigo-400' : ''}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <h3 className="text-lg font-bold text-slate-900">{invitation.research?.title || 'Untitled Research'}</h3>
                  <span className={`px-3 py-1 rounded-full border text-xs font-bold uppercase ${style}`}>
                    {expired ? 'expired' : invitation.status}
                  </span>
                </div>

                <p className="text-sm text-slate-600 mb-2">
                  Invited by <span className="font-semibold text-slate-800">{formatFullName(invitation.inviter) || invitation.inviter?.email || 'Unknown'}</span>
                </p>

                <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                  <Clock3 size={14} />
                  Expires: {expiresAt ? expiresAt.toLocaleString() : 'N/A'}
                </div>

                {isPending && !expired && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleAction(invitation.token, 'accept')}
                      disabled={actingToken === invitation.token}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 size={16} />
                      Accept
                    </button>
                    <button
                      onClick={() => handleAction(invitation.token, 'decline')}
                      disabled={actingToken === invitation.token}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      <XCircle size={16} />
                      Decline
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CoAuthorInvitations;
