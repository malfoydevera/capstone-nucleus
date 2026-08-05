import { useState } from 'react';
import { KeyRound, Mail, Shield, X, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../../utils/api';
import { getRefreshToken } from '../../utils/authStorage';
import { validateRecoveryEmail } from '../../utils/emailDomain';

const ChangeRecoveryEmailModal = ({ user, onClose, onUpdated }) => {
  const [recoveryEmail, setRecoveryEmail] = useState(user?.recoveryEmail || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmingOtp, setConfirmingOtp] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentAt, setSentAt] = useState('');

  const normalizedRecoveryEmail = recoveryEmail.trim().toLowerCase();

  const sendVerification = async () => {
    if (!normalizedRecoveryEmail) {
      toast.error('Please enter your recovery email address');
      return false;
    }

    if (normalizedRecoveryEmail === String(user?.recoveryEmail || '').toLowerCase()) {
      toast.error('That is already your recovery email');
      return false;
    }

    const domainCheck = validateRecoveryEmail(normalizedRecoveryEmail, user?.email);
    if (!domainCheck.valid) {
      toast.error(domainCheck.message);
      return false;
    }

    setLoading(true);
    try {
      const response = await authAPI.requestRecoveryEmail(normalizedRecoveryEmail, getRefreshToken());
      const payload = response?.data?.data || response?.data || {};

      if (payload.alreadyVerified) {
        toast.success('Recovery email saved.');
        onUpdated?.();
        onClose();
        return true;
      }

      const timestamp = payload.sentAt
        ? new Date(payload.sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

      setSent(true);
      setSentAt(timestamp);
      setOtp('');
      toast.success('Verification email sent. Check your inbox.');
      return true;
    } catch (error) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to start recovery email setup';
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await sendVerification();
  };

  const handleResend = async () => {
    setOtp('');
    await sendVerification();
  };

  const handleOtpConfirm = async (e) => {
    e.preventDefault();

    const code = otp.replace(/\D/g, '');
    if (code.length < 6 || code.length > 8) {
      toast.error('Enter the full code from your latest email (6–8 digits)');
      return;
    }

    setConfirmingOtp(true);
    try {
      await authAPI.confirmRecoveryEmailOtp({
        recoveryEmail: normalizedRecoveryEmail,
        code,
      });
      toast.success('Recovery email saved.');
      onUpdated?.();
      onClose();
    } catch (error) {
      const message =
        error?.response?.data?.error?.code === 'INVALID_RECOVERY_CODE'
          ? 'That code is invalid or expired. Tap Send again and use the newest email.'
          : error?.response?.data?.error?.message ||
            error?.response?.data?.message ||
            error?.message ||
            'Failed to verify recovery email';
      toast.error(message);
    } finally {
      setConfirmingOtp(false);
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
          <div className="p-6">
            <div className="text-center mb-5">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h4 className="font-semibold text-slate-900 mb-1">Verify your recovery email</h4>
              <p className="text-sm text-slate-600">
                We sent a confirmation email to{' '}
                <span className="font-semibold break-all">{normalizedRecoveryEmail}</span>
                {sentAt ? ` at ${sentAt}` : ''}.
              </p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 mb-4">
              Only the <strong>latest</strong> email/code works. Check your spam folder. Send again if this one expires.
            </div>

            <form onSubmit={handleOtpConfirm} className="space-y-3">
              <label htmlFor="cr-otp" className="block text-xs font-semibold text-slate-600">
                Verification code
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  id="cr-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="000000"
                  className="w-full h-11 pl-9 pr-3 rounded-lg border border-slate-200 text-sm font-mono tracking-[0.2em] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <p className="text-xs text-slate-500">
                Enter the code from the email we sent. You can also click the confirmation link in that email.
              </p>

              <button
                type="submit"
                disabled={confirmingOtp}
                className="w-full h-10 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {confirmingOtp ? 'Verifying…' : 'Confirm with code'}
              </button>
            </form>

            <button
              type="button"
              onClick={handleResend}
              disabled={loading}
              className="mt-3 w-full h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send again'}
            </button>

            <button
              type="button"
              onClick={() => {
                onUpdated?.();
                onClose();
              }}
              className="mt-2 w-full h-10 rounded-xl text-sm font-medium text-[#3674B5] hover:underline"
            >
              Done for now
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
