import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../utils/supabaseClient';
import { setAuthTokens } from '../../utils/authStorage';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../utils/api';
import { isInstitutionalEmail } from '../../utils/emailDomain';

const parseHashParams = () => {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(hash);
};

const parseQueryParams = () => new URLSearchParams(window.location.search);

const parseHashError = () => {
  const params = parseHashParams();
  const error = params.get('error_description') || params.get('error');
  return error ? decodeURIComponent(error.replace(/\+/g, ' ')) : '';
};

// Landing page for Supabase confirmation links (signup + email change + recovery email).
const AuthCallback = () => {
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const { reloadUser } = useAuth();
  const handled = useRef(false);

  useEffect(() => {
    let mounted = true;

    const syncEmailChanges = async (session) => {
      const authEmail = String(session?.user?.email || '').trim().toLowerCase();
      if (!authEmail) return;

      try {
        const meResponse = await authAPI.getCurrentUser();
        const profile = meResponse?.data?.user || meResponse?.data?.data?.user || null;
        const institutionalEmail = String(profile?.email || '').trim().toLowerCase();

        if (!institutionalEmail) return;

        if (authEmail !== institutionalEmail && !isInstitutionalEmail(authEmail)) {
          await authAPI.confirmRecoveryEmail();
          toast.success('Recovery email saved.');
          return;
        }

        if (isInstitutionalEmail(authEmail) && authEmail !== institutionalEmail) {
          await authAPI.confirmInstitutionalEmail();
          toast.success('Institutional email updated.');
        }
      } catch (syncError) {
        console.warn('[AuthCallback] email sync skipped:', syncError?.response?.data || syncError?.message);
      }
    };

    const adoptSession = async (session) => {
      if (handled.current || !session?.access_token) return;
      handled.current = true;

      setAuthTokens(session.access_token, session.refresh_token, false);
      await syncEmailChanges(session);
      const loadedUser = await reloadUser();

      if (!mounted) return;

      setStatus('success');
      if (loadedUser) {
        toast.success('Email confirmed. You are now signed in.');
        setMessage('Redirecting you to your dashboard…');
        setTimeout(() => navigate('/dashboard'), 800);
      } else {
        setMessage('Email confirmed. Please sign in to continue.');
        setTimeout(() => navigate('/login'), 1200);
      }
    };

    const verifyFromUrl = async () => {
      const hashParams = parseHashParams();
      const queryParams = parseQueryParams();
      const tokenHash = queryParams.get('token_hash') || hashParams.get('token_hash');
      const type = queryParams.get('type') || hashParams.get('type');

      if (tokenHash && type === 'email_change') {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'email_change',
        });

        if (!mounted) return false;

        if (error) {
          setStatus('error');
          setMessage(
            'This confirmation link is invalid or expired. Open Profile, resend verification, and use the newest code instead.'
          );
          handled.current = true;
          return true;
        }

        if (data?.session) {
          await adoptSession(data.session);
          return true;
        }
      }

      return false;
    };

    const hashError = parseHashError();
    if (hashError) {
      setStatus('error');
      setMessage(
        hashError.includes('invalid') || hashError.includes('expired')
          ? 'This confirmation link is invalid or expired. Open Profile, resend verification, and use the newest code instead.'
          : hashError
      );
      return undefined;
    }

    verifyFromUrl().then((verified) => {
      if (!mounted || verified) return undefined;

      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (!mounted) return;
        if (session && (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION')) {
          adoptSession(session);
        }
      });

      supabase.auth.getSession().then(({ data }) => {
        if (!mounted) return;
        if (data?.session) {
          adoptSession(data.session);
        } else {
          setTimeout(() => {
            if (mounted && !handled.current) {
              setStatus('error');
              setMessage(
                'This confirmation link is invalid or expired. Open Profile, resend verification, and use the newest code instead.'
              );
            }
          }, 3000);
        }
      });

      return () => {
        authListener?.subscription?.unsubscribe();
      };
    });

    return () => {
      mounted = false;
    };
  }, [navigate, reloadUser]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
        {status === 'verifying' && (
          <>
            <div className="h-10 w-10 mx-auto rounded-full border-2 border-[#3674B5] border-t-transparent animate-spin mb-4" />
            <h1 className="text-xl font-bold text-slate-900">Confirming your account…</h1>
            <p className="text-slate-600 mt-2">Hang tight while we verify your email.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h1 className="text-xl font-bold text-slate-900">You&apos;re all set</h1>
            <p className="text-slate-600 mt-2">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-12 w-12 mx-auto text-rose-500 mb-4" />
            <h1 className="text-xl font-bold text-slate-900">Confirmation failed</h1>
            <p className="text-slate-600 mt-2">{message}</p>
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="mt-4 w-full py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700"
            >
              Back to Profile
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="mt-3 w-full py-3 border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50"
            >
              Go to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
