import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

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
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-nexus-500 to-nexus-700 flex items-center justify-center text-white font-bold text-3xl animate-glow mb-4">
            N
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Email Verification</h1>
        </div>

        {/* Card */}
        <div className="bg-surface-850 border border-white/5 rounded-2xl p-8 text-center">
          {state === 'loading' && (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-nexus-500/10 border border-nexus-500/20 flex items-center justify-center mb-6">
                <svg className="animate-spin h-8 w-8 text-nexus-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <p className="text-gray-300">Verifying your email...</p>
            </>
          )}

          {state === 'success' && (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-white font-medium mb-2">{message}</p>
              <p className="text-gray-500 text-sm mb-6">You can now sign in to your account.</p>
              <Link
                to="/login"
                className="inline-block w-full bg-nexus-600 hover:bg-nexus-700 text-white font-medium py-2.5 rounded-lg transition-colors duration-200"
              >
                Sign in
              </Link>
            </>
          )}

          {state === 'expired' && (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-white font-medium mb-2">Link expired</p>
              <p className="text-gray-500 text-sm mb-6">{message}</p>
              <Link
                to="/login"
                className="inline-block w-full bg-surface-900 hover:bg-surface-800 text-white font-medium py-2.5 rounded-lg transition-colors duration-200 border border-white/10"
              >
                Go to sign in to resend
              </Link>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-white font-medium mb-2">Verification failed</p>
              <p className="text-gray-500 text-sm mb-6">{message}</p>
              <Link
                to="/login"
                className="inline-block w-full bg-surface-900 hover:bg-surface-800 text-white font-medium py-2.5 rounded-lg transition-colors duration-200 border border-white/10"
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
