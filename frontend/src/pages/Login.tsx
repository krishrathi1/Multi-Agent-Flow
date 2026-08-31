import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { api } from '../lib/api';
import { SEO } from '../components/SEO';

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
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
      <SEO
        title="Log In — MyceliumOps AI Agent Platform"
        description="Sign in to MyceliumOps, the AI agent orchestration and mission control platform by Blostem. Manage your autonomous AI agents, agentic workflows, and enterprise agent operations."
        canonical="https://nexus.blostem.com/login"
        keywords="MyceliumOps login, AI agent platform login, Blostem AI"
      />
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-nexus-500 to-nexus-700 flex items-center justify-center text-white font-bold text-3xl animate-glow mb-4">
            M
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Welcome back</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your MyceliumOps account</p>
        </div>

        {/* Card */}
        <div className="bg-surface-850 border border-white/5 rounded-2xl p-8">
          {displayError && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {displayError}
            </div>
          )}

          {emailNotVerified && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
              <p className="font-medium mb-1">Email not verified</p>
              <p className="text-amber-400/80 mb-2">
                Please check your inbox and click the verification link before signing in.
              </p>
              <button
                type="button"
                onClick={handleResendVerification}
                className="text-nexus-400 hover:text-nexus-300 underline text-sm transition-colors"
              >
                Resend verification email
              </button>
              {resendStatus && (
                <p className="mt-2 text-emerald-400 text-xs">{resendStatus}</p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-900 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-nexus-500/50 focus:ring-1 focus:ring-nexus-500/30 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-900 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-nexus-500/50 focus:ring-1 focus:ring-nexus-500/30 transition-colors"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-nexus-600 hover:bg-nexus-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors duration-200"
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
        <p className="text-center text-sm text-gray-500 mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-nexus-400 hover:text-nexus-300 transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
