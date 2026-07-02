import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../utils/supabaseClient';
import { setAuthTokens } from '../../utils/authStorage';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../utils/api';
import { isInstitutionalEmail } from '../../utils/emailDomain';

const parseHashError = () => {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  const error = params.get('error_description') || params.get('error');
  return error ? decodeURIComponent(error.replace(/\+/g, ' ')) : '';
};

// Landing page for Supabase confirmation links (signup + email change + recovery email).
// Supabase puts the confirmed session in the URL; we adopt those tokens for the
// Express API session and send the user into the app.
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

    const hashError = parseHashError();
    if (hashError) {
      setStatus('error');
      setMessage(hashError);
      return undefined;
    }

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
            setMessage('This confirmation link is invalid or has expired.');
          }
        }, 2500);
      }
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
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
              onClick={() => navigate('/login')}
              className="mt-6 w-full py-3 bg-[#3674B5] text-white rounded-lg font-semibold hover:bg-[#2d6299]"
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
