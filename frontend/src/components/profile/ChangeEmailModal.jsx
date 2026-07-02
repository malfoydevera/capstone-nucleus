import { useState } from 'react';
import { Mail, X, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../../utils/api';
import { supabase } from '../../utils/supabaseClient';
import { getAccessToken, getRefreshToken } from '../../utils/authStorage';
import { validateEmailDomainForRole, getAllowedDomainsForRole } from '../../utils/emailDomain';

const ChangeEmailModal = ({ user, onClose, onUpdated }) => {
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const role = user?.role;
  const allowedDomains = getAllowedDomainsForRole(role).map((d) => `@${d}`).join(', ');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const normalized = newEmail.trim().toLowerCase();
    if (!normalized) {
      toast.error('Please enter your new email address');
      return;
    }

    if (normalized === String(user?.email || '').toLowerCase()) {
      toast.error('That is already your current email');
      return;
    }

    const domainCheck = validateEmailDomainForRole(normalized, role);
    if (!domainCheck.valid) {
      toast.error(domainCheck.message);
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.changeEmail(normalized);
      const payload = response?.data?.data ?? response?.data ?? {};

      if (payload.directUpdate) {
        toast.success('Institutional email updated.');
        onUpdated?.();
        onClose();
        return;
      }

      // Perform the actual Supabase email change from the client using the
      // existing session, so Supabase sends its built-in confirm-change email.
      const accessToken = getAccessToken();
      const refreshToken = getRefreshToken();
      if (!accessToken || !refreshToken) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) throw sessionError;

      const { error: updateError } = await supabase.auth.updateUser(
        { email: normalized },
        { emailRedirectTo: `${window.location.origin}/auth/callback` }
      );
      if (updateError) throw updateError;

      setSent(true);
      toast.success('Confirmation link sent to your new email.');
    } catch (error) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to start email change';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close change email"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-fadeIn">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-[#3674B5]/5 to-transparent">
          <div className="flex items-center gap-2">
            <span className="h-9 w-9 rounded-lg bg-[#3674B5]/10 text-[#3674B5] inline-flex items-center justify-center">
              <Mail size={16} />
            </span>
            <div>
              <h3 className="font-semibold text-slate-900">Change email</h3>
              <p className="text-xs text-slate-500 mt-0.5">Move to your active institutional email</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 inline-flex items-center justify-center"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {sent ? (
          <div className="p-6 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h4 className="font-semibold text-slate-900 mb-1">Confirm your new email</h4>
            <p className="text-sm text-slate-600 mb-6">
              We sent a confirmation link to <span className="font-semibold break-all">{newEmail.trim().toLowerCase()}</span>.
              Your email updates only after you click that link.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-10 rounded-xl bg-[#3674B5] text-white text-sm font-semibold hover:bg-[#2d6299]"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            <div>
              <span className="block text-xs font-semibold text-slate-600 mb-1">Current email</span>
              <div className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600 flex items-center break-all">
                {user?.email || '—'}
              </div>
            </div>

            <div>
              <label htmlFor="ce-newEmail" className="block text-xs font-semibold text-slate-600 mb-1">
                New email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  id="ce-newEmail"
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder={`yourname${allowedDomains ? ' ' + allowedDomains.split(',')[0].trim() : ''}`}
                  autoComplete="email"
                  className="w-full h-11 pl-9 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3674B5]/30"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Allowed: {allowedDomains}</p>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 h-10 rounded-xl bg-[#3674B5] text-white text-sm font-semibold hover:bg-[#2d6299] disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send confirmation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChangeEmailModal;
