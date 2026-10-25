import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { ThemeToggle } from '../components/layout/ThemeToggle';

type VerifyState = 'loading' | 'success' | 'expired' | 'error';

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<VerifyState>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('No verification token provided.');
      return;
    }

    api.auth.verifyEmail(token)
      .then((res) => {
        setState('success');
        setMessage(res.message);
      })
      .catch((err: Error) => {
        if (err.message.includes('expired')) {
          setState('expired');
          setMessage('Your verification link has expired. Please request a new one.');
        } else {
          setState('error');
          setMessage(err.message || 'Verification failed.');
        }
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4 py-12 relative transition-colors duration-200">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-3xl shadow-lg shadow-brand-500/25 animate-glow mb-4">
            M
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Email Verification</h1>
        </div>

        {/* Card */}
        <div className="bg-surface border border-line-subtle rounded-2xl p-8 shadow-e3 backdrop-blur-xl text-center">
          {state === 'loading' && (
            <>
              <div className="mx-auto w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-6">
                <svg className="animate-spin h-8 w-8 text-brand-600 dark:text-brand-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <p className="text-ink-muted">Verifying your email...</p>
            </>
          )}

          {state === 'success' && (
            <>
              <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-ink font-semibold mb-2">{message}</p>
              <p className="text-ink-subtle text-sm mb-6">You can now sign in to your account.</p>
              <Link
                to="/login"
                className="inline-block w-full bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white font-medium py-2.5 rounded-xl shadow-e1 shadow-brand-600/20 transition-all duration-200 text-sm"
              >
                Sign in
              </Link>
            </>
          )}

          {state === 'expired' && (
            <>
              <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-ink font-semibold mb-2">Link expired</p>
              <p className="text-ink-subtle text-sm mb-6">{message}</p>
              <Link
                to="/login"
                className="inline-block w-full bg-inset hover:bg-hover text-ink font-medium py-2.5 rounded-xl transition-all duration-200 border border-line text-sm"
              >
                Go to sign in to resend
              </Link>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-ink font-semibold mb-2">Verification failed</p>
              <p className="text-ink-subtle text-sm mb-6">{message}</p>
              <Link
                to="/login"
                className="inline-block w-full bg-inset hover:bg-hover text-ink font-medium py-2.5 rounded-xl transition-all duration-200 border border-line text-sm"
              >
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
