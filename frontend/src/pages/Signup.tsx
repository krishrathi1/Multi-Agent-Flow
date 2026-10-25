import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { SEO } from '../components/SEO';
import { ThemeToggle } from '../components/layout/ThemeToggle';

export function Signup() {
  const navigate = useNavigate();
  const { signup, isLoading, error } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      const res: any = await signup(email, password, name, orgName);
      // Redirect to check-email page with the email and otp as state
      navigate('/check-email', { replace: true, state: { email, otp: res?.otp } });
    } catch (err: any) {
      setLocalError(err.message);
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4 py-12 relative transition-colors duration-200">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <SEO
        title="Sign Up Free — MyceliumOps AI Agent Orchestration Platform"
        description="Create your free MyceliumOps account and start orchestrating autonomous AI agents. Deploy agents, build agentic workflows, and manage enterprise AI operations with Blostem's AI agent platform."
        canonical="/signup"
        keywords="sign up AI agent platform, free AI agent management, MyceliumOps registration, Blostem AI, agentic workflow platform"
      />
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-3xl shadow-lg shadow-brand-500/25 animate-glow mb-4">
            M
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Create your account</h1>
          <p className="text-ink-subtle text-sm mt-1">Get started with MyceliumOps</p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-line-subtle rounded-2xl p-8 shadow-e3 backdrop-blur-xl">
          {displayError && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium">
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-ink-muted mb-1.5">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-inset border border-line hover:border-line-strong rounded-xl px-4 py-2.5 text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all text-sm"
                placeholder="John Doe"
              />
            </div>

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
                placeholder="Choose a strong password"
              />
            </div>

            <div>
              <label htmlFor="orgName" className="block text-sm font-medium text-ink-muted mb-1.5">
                Organization Name
              </label>
              <input
                id="orgName"
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full bg-inset border border-line hover:border-line-strong rounded-xl px-4 py-2.5 text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all text-sm"
                placeholder="Acme Inc."
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
                  Creating account...
                </span>
              ) : (
                'Create account'
              )}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p className="text-center text-sm text-ink-subtle mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
