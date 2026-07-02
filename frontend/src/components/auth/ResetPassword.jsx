import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../utils/supabaseClient';
import { validatePasswordStrength } from '../../utils/passwordPolicy';

const parseHashError = () => {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  const error = params.get('error_description') || params.get('error');
  return error ? decodeURIComponent(error.replace(/\+/g, ' ')) : '';
};

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [linkError, setLinkError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const hashError = parseHashError();
    if (hashError) {
      if (mounted) {
        setLinkError(hashError);
        setVerifying(false);
      }
      return undefined;
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setRecoveryReady(true);
        setVerifying(false);
      }
    });

    // getSession() resolves after Supabase has parsed the recovery token from
    // the URL, so it reliably reflects whether a valid session was established.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data?.session) {
        setRecoveryReady(true);
      }
      setVerifying(false);
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!recoveryReady) {
      toast.error('Your reset link is invalid or has expired. Please request a new one.');
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
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      // Clear the temporary recovery session so it can't be reused.
      await supabase.auth.signOut();
      toast.success('Password reset successful. You can now sign in.');
      navigate('/login');
    } catch (error) {
      toast.error(error?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft size={16} />
          Back to sign in
        </button>

        <h1 className="text-2xl font-bold text-slate-900">Set a new password</h1>
        <p className="text-slate-600 mt-2 mb-6">Choose a strong password to secure your account.</p>

        {verifying ? (
          <div className="flex items-center gap-3 text-slate-600 text-sm py-6">
            <span className="h-5 w-5 rounded-full border-2 border-[#3674B5] border-t-transparent animate-spin" />
            Verifying your reset link...
          </div>
        ) : !recoveryReady ? (
          <div className="p-4 rounded-lg bg-rose-50 border border-rose-200">
            <p className="text-sm text-rose-800">
              {linkError || 'This reset link is invalid or has expired.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="mt-3 text-sm font-medium text-[#3674B5] hover:underline"
            >
              Use the 6-digit code instead
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="At least 8 characters, with a letter and a number"
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
              Confirm password
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
              {loading ? 'Resetting password...' : 'Reset password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
