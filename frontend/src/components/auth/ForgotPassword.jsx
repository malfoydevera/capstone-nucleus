import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../../utils/api';
import { validatePasswordStrength } from '../../utils/passwordPolicy';

const getApiErrorCode = (error) =>
  error?.response?.data?.error?.code || error?.response?.data?.code || null;

const getApiErrorMessage = (error, fallback) =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

const ForgotPassword = () => {
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [recoveryEmailHint, setRecoveryEmailHint] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const navigate = useNavigate();

  const normalizedEmail = email.trim().toLowerCase();

  const sendResetCode = async () => {
    if (!normalizedEmail) {
      toast.error('Please enter your institutional email address');
      return false;
    }

    setLoading(true);
    setRecoveryRequired(false);
    try {
      const res = await authAPI.requestPasswordReset(normalizedEmail);
      const hint = res?.data?.data?.recoveryEmailHint || '';
      setRecoveryEmailHint(hint);
      toast.success('Check your personal inbox for the reset code.');
      return true;
    } catch (error) {
      if (getApiErrorCode(error) === 'RECOVERY_EMAIL_REQUIRED') {
        setRecoveryRequired(true);
        toast.error(getApiErrorMessage(error, 'Add a recovery email in Profile first.'));
        return false;
      }

      toast.error(getApiErrorMessage(error, 'Failed to send reset code. Please try again.'));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    const sent = await sendResetCode();
    if (sent) {
      setStep('code');
    }
  };

  const handleResendCode = async () => {
    await sendResetCode();
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();

    const code = otp.replace(/\D/g, '');
    if (code.length < 6 || code.length > 8) {
      toast.error('Enter the full code from your recovery email (6–8 digits)');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      toast.error(strength.message);
      return;
    }

    setLoading(true);
    try {
      await authAPI.confirmPasswordReset({
        email: normalizedEmail,
        code,
        newPassword,
      });

      toast.success('Password updated. You can sign in now.');
      navigate('/login');
    } catch (error) {
      const message = getApiErrorCode(error) === 'INVALID_RESET_CODE'
        ? 'That code is invalid or expired. Request a new one.'
        : getApiErrorMessage(error, 'Failed to reset password');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <button
          type="button"
          onClick={() => (step === 'code' ? setStep('email') : navigate('/login'))}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft size={16} />
          {step === 'code' ? 'Back' : 'Back to sign in'}
        </button>

        {step === 'email' ? (
          <>
            <h1 className="text-2xl font-bold text-slate-900">Forgot your password?</h1>
            <p className="text-slate-600 mt-2 mb-2">
              Enter your <strong>institutional login email</strong> (e.g.{' '}
              <span className="font-mono text-sm">you@students.nu-dasma.edu.ph</span>).
            </p>
            <p className="text-sm text-slate-500 mb-6">
              A reset code will be sent to the personal recovery email saved in your Profile.
            </p>

            {recoveryRequired && (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">Recovery email required</p>
                <p className="mt-1 text-amber-800/90">
                  Sign in and add a personal recovery email in{' '}
                  <Link to="/profile" className="font-semibold underline hover:text-amber-950">
                    Profile
                  </Link>{' '}
                  before resetting your password.
                </p>
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Institutional email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
                  placeholder="you@students.nu-dasma.edu.ph"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#3674B5] text-white rounded-lg font-semibold hover:bg-[#2d6299] disabled:opacity-50"
              >
                {loading ? 'Sending code…' : 'Send reset code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-900">Enter your code</h1>
            <p className="text-slate-600 mt-2 mb-1">
              We sent a reset code to the recovery email linked to{' '}
              <span className="font-semibold text-slate-800">{normalizedEmail}</span>.
              {recoveryEmailHint && (
                <span> It was delivered to <span className="font-semibold">{recoveryEmailHint}</span>.</span>
              )}
            </p>
            <p className="text-xs text-slate-500 mb-6">
              Check your personal inbox and spam folder. Codes expire after about an hour.
            </p>

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <label htmlFor="otp" className="block text-sm font-medium text-slate-700">
                Reset code
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={8}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3674B5] tracking-[0.2em] font-mono text-lg"
                  placeholder="00000000"
                />
              </div>

              <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700">
                New password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
                  placeholder="At least 8 characters, letter + number"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
                Confirm new password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
                  placeholder="Re-enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#3674B5] text-white rounded-lg font-semibold hover:bg-[#2d6299] disabled:opacity-50"
              >
                {loading ? 'Updating password…' : 'Reset password'}
              </button>

              <button
                type="button"
                onClick={handleResendCode}
                disabled={loading}
                className="w-full py-2 text-sm font-medium text-[#3674B5] hover:underline disabled:opacity-50"
              >
                Send code again
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
