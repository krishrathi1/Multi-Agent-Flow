import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { api } from '../lib/api';
import { SEO } from '../components/SEO';
import { ThemeToggle } from '../components/layout/ThemeToggle';

export function Login() {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setEmailNotVerified(false);
    setResendStatus(null);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      if (err.message === 'Email not verified') {
        setEmailNotVerified(true);
      } else {
        setLocalError(err.message);
      }
    }
  };

  const handleResendVerification = async () => {
    if (!email) return;
    setResendStatus(null);
    try {
      await api.auth.resendVerification(email);
      setResendStatus('Verification email sent! Check your inbox.');
    } catch {
      setResendStatus('Failed to resend. Please try again.');
    }
  };

  const displayError = !emailNotVerified ? (localError || error) : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4 py-12 relative transition-colors duration-200">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <SEO
        title="Log In — MyceliumOps AI Agent Platform"
        description="Sign in to MyceliumOps, the AI agent orchestration and mission control platform by Blostem. Manage your autonomous AI agents, agentic workflows, and enterprise agent operations."
        canonical="/login"
        keywords="MyceliumOps login, AI agent platform login, Blostem AI"
      />
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-3xl shadow-lg shadow-brand-500/25 animate-glow mb-4">
            M
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Welcome back</h1>
          <p className="text-ink-subtle text-sm mt-1">Sign in to your MyceliumOps account</p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-line-subtle rounded-2xl p-8 shadow-e3 backdrop-blur-xl">
          {displayError && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium">
              {displayError}
            </div>
          )}

          {emailNotVerified && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm">
              <p className="font-semibold mb-1">Email not verified</p>
              <p className="text-amber-600 dark:text-amber-400/80 mb-2">
                Please check your inbox and click the verification link before signing in.
              </p>
              <button
                type="button"
                onClick={handleResendVerification}
                className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium underline text-sm transition-colors cursor-pointer"
              >
                Resend verification email
              </button>
              {resendStatus && (
                <p className="mt-2 text-emerald-600 dark:text-emerald-400 text-xs font-medium">{resendStatus}</p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink-muted mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-inset border border-line hover:border-line-strong rounded-xl px-4 py-2.5 text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all text-sm"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink-muted mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-inset border border-line hover:border-line-strong rounded-xl px-4 py-2.5 text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all text-sm"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand-600 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl shadow-e1 shadow-brand-600/20 transition-all duration-200 text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p className="text-center text-sm text-ink-subtle mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
