import { useState } from 'react';
import { Mail, Shield, X, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../../utils/api';
import { supabase } from '../../utils/supabaseClient';
import { getAccessToken, getRefreshToken } from '../../utils/authStorage';
import { validateRecoveryEmail } from '../../utils/emailDomain';

const ChangeRecoveryEmailModal = ({ user, onClose, onUpdated }) => {
  const [recoveryEmail, setRecoveryEmail] = useState(user?.recoveryEmail || '');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const normalized = recoveryEmail.trim().toLowerCase();
    if (!normalized) {
      toast.error('Please enter your recovery email address');
      return;
    }

    if (normalized === String(user?.recoveryEmail || '').toLowerCase()) {
      toast.error('That is already your recovery email');
      return;
    }

    const domainCheck = validateRecoveryEmail(normalized, user?.email);
    if (!domainCheck.valid) {
      toast.error(domainCheck.message);
      return;
    }

    setLoading(true);
    try {
      await authAPI.validateRecoveryEmail(normalized);

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
        { emailRedirectTo: `${window.location.origin}/auth/callback?flow=recovery` }
      );
      if (updateError) throw updateError;

      setSent(true);
      toast.success('Verification sent to your recovery email.');
    } catch (error) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to start recovery email setup';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close recovery email"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-fadeIn">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-500/5 to-transparent">
          <div className="flex items-center gap-2">
            <span className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 inline-flex items-center justify-center">
              <Shield size={16} />
            </span>
            <div>
              <h3 className="font-semibold text-slate-900">
                {user?.hasRecoveryEmail ? 'Change recovery email' : 'Set recovery email'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Personal inbox for password reset codes</p>
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
            <h4 className="font-semibold text-slate-900 mb-1">Verify your recovery email</h4>
            <p className="text-sm text-slate-600 mb-6">
              We sent a confirmation link to{' '}
              <span className="font-semibold break-all">{recoveryEmail.trim().toLowerCase()}</span>.
              Your recovery email is saved only after you click that link.
            </p>
            <button
              type="button"
              onClick={() => {
                onUpdated?.();
                onClose();
              }}
              className="w-full h-10 rounded-xl bg-[#3674B5] text-white text-sm font-semibold hover:bg-[#2d6299]"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            <div>
              <span className="block text-xs font-semibold text-slate-600 mb-1">Login email (institutional)</span>
              <div className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600 flex items-center break-all">
                {user?.email || '—'}
              </div>
            </div>

            <div>
              <label htmlFor="cr-recoveryEmail" className="block text-xs font-semibold text-slate-600 mb-1">
                Recovery email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  id="cr-recoveryEmail"
                  type="email"
                  required
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  autoComplete="email"
                  className="w-full h-11 pl-9 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Use a personal inbox you can access. Password reset codes are sent here — not to your institutional email.
              </p>
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
                className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send verification'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChangeRecoveryEmailModal;
