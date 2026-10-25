import { useState, FormEvent, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ThemeToggle } from '../components/layout/ThemeToggle';

export function CheckEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const navState = (location.state as { email?: string; otp?: string }) || {};
  const [email, setEmail] = useState(navState.email || '');
  const [devOtp, setDevOtp] = useState(navState.otp || '');
  const [otp, setOtp] = useState(navState.otp || '');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (navState.email) setEmail(navState.email);
    if (navState.otp) {
      setDevOtp(navState.otp);
      setOtp(navState.otp);
    }
  }, [navState.email, navState.otp]);

  const handleVerifyOtp = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!email) {
      setError('Please provide your email address.');
      return;
    }
    if (otp.trim().length !== 6) {
      setError('Please enter a valid 6-digit OTP code.');
      return;
    }

    setVerifying(true);
    setError(null);
    try {
      await api.auth.verifyOtp({ email: email.trim(), otp: otp.trim() });
      setSuccess(true);
      setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: { email, message: 'Account verified successfully! Please log in.' },
        });
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired verification code');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setResendStatus(null);
    setError(null);
    try {
      const res = await api.auth.resendVerification(email);
      setResendStatus('Verification code resent! Please check your inbox.');
      if (res.otp) {
        setDevOtp(res.otp);
        setOtp(res.otp);
      }
    } catch {
      setResendStatus('Failed to resend. Please try again in a few moments.');
    } finally {
      setResending(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-ink tracking-tight">Enter Verification Code</h1>
          <p className="text-ink-subtle text-sm mt-1">Confirm your email address</p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-line-subtle rounded-2xl p-8 shadow-e3 backdrop-blur-xl">
          {success ? (
            <div className="text-center py-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-ink mb-1">Email Verified!</h3>
              <p className="text-ink-subtle text-sm">Redirecting to sign in...</p>
            </div>
          ) : (
            <>
              {/* Mail icon */}
              <div className="mx-auto w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-5">
                <svg className="w-7 h-7 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>

              <div className="text-center mb-6">
                <p className="text-ink-muted text-sm mb-1">
                  We've sent a 6-digit verification code to
                </p>
                {email ? (
                  <p className="text-ink font-semibold text-sm break-all">{email}</p>
                ) : (
                  <div className="mt-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full text-center px-3 py-1.5 text-sm rounded-lg border border-line bg-inset text-ink focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Dev helper chip if OTP is present */}
              {devOtp && (
                <div className="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold uppercase tracking-wider">OTP Code:</span>
                    <span className="font-mono font-bold text-sm bg-amber-500/20 px-2 py-0.5 rounded">{devOtp}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOtp(devOtp)}
                    className="text-amber-800 dark:text-amber-200 underline font-medium hover:opacity-80 cursor-pointer"
                  >
                    Auto-fill
                  </button>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium text-center">
                  {error}
                </div>
              )}

              {/* OTP Form */}
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label htmlFor="otp" className="block text-xs font-medium text-ink-muted uppercase tracking-wider text-center mb-2">
                    6-Digit Verification Code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus
                    required
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtp(val);
                      if (val.length === 6) setError(null);
                    }}
                    placeholder="123456"
                    className="w-full text-center font-mono text-2xl font-bold tracking-[0.3em] py-3 px-4 rounded-xl border border-line bg-inset text-ink placeholder:text-ink-subtle/40 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={verifying || otp.trim().length !== 6}
                  className="w-full bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white font-medium py-3 rounded-xl shadow-e1 shadow-brand-600/20 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  {verifying ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Verifying Code...
                    </>
                  ) : (
                    'Verify & Continue'
                  )}
                </button>
              </form>

              {/* Resend Action */}
              <div className="mt-6 pt-5 border-t border-line-subtle text-center">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || !email}
                  className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium text-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {resending ? 'Sending new code...' : "Didn't receive the email? Resend Code"}
                </button>
                {resendStatus && (
                  <p className="mt-2 text-emerald-600 dark:text-emerald-400 text-xs font-medium">{resendStatus}</p>
                )}
              </div>

              {/* Back to sign in */}
              <div className="mt-4 text-center">
                <Link
                  to="/login"
                  className="inline-block w-full text-center bg-inset hover:bg-hover text-ink font-medium py-2.5 rounded-xl transition-all duration-200 border border-line text-xs"
                >
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
