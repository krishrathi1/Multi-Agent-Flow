import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';

export function CheckEmail() {
  const location = useLocation();
  const email = (location.state as { email?: string })?.email || '';
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setResendStatus(null);
    try {
      await api.auth.resendVerification(email);
      setResendStatus('Verification email resent! Check your inbox.');
    } catch {
      setResendStatus('Failed to resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-nexus-500 to-nexus-700 flex items-center justify-center text-white font-bold text-3xl animate-glow mb-4">
            N
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Check your email</h1>
        </div>

        {/* Card */}
        <div className="bg-surface-850 border border-white/5 rounded-2xl p-8 text-center">
          {/* Mail icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-nexus-500/10 border border-nexus-500/20 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-nexus-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>

          <p className="text-gray-300 mb-2">
            We've sent a verification link to
          </p>
          {email && (
            <p className="text-white font-medium mb-6">{email}</p>
          )}
          <p className="text-gray-500 text-sm mb-6">
            Click the link in the email to verify your account. The link expires in 24 hours.
          </p>

          {email && (
            <div className="mb-6">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-nexus-400 hover:text-nexus-300 text-sm transition-colors disabled:opacity-50"
              >
                {resending ? 'Sending...' : "Didn't receive the email? Resend"}
              </button>
              {resendStatus && (
                <p className="mt-2 text-emerald-400 text-xs">{resendStatus}</p>
              )}
            </div>
          )}

          <Link
            to="/login"
            className="inline-block w-full bg-surface-900 hover:bg-surface-800 text-white font-medium py-2.5 rounded-lg transition-colors duration-200 border border-white/10"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
