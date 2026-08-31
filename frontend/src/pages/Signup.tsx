import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { SEO } from '../components/SEO';

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
      await signup(email, password, name, orgName);
      // Redirect to check-email page with the email as state
      navigate('/check-email', { replace: true, state: { email } });
    } catch (err: any) {
      setLocalError(err.message);
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
      <SEO
        title="Sign Up Free — MyceliumOps AI Agent Orchestration Platform"
        description="Create your free MyceliumOps account and start orchestrating autonomous AI agents. Deploy agents, build agentic workflows, and manage enterprise AI operations with Blostem's AI agent platform."
        canonical="https://nexus.blostem.com/signup"
        keywords="sign up AI agent platform, free AI agent management, MyceliumOps registration, Blostem AI, agentic workflow platform"
      />
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-nexus-500 to-nexus-700 flex items-center justify-center text-white font-bold text-3xl animate-glow mb-4">
            M
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Create your account</h1>
          <p className="text-gray-500 text-sm mt-1">Get started with MyceliumOps</p>
        </div>

        {/* Card */}
        <div className="bg-surface-850 border border-white/5 rounded-2xl p-8">
          {displayError && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1.5">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface-900 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-nexus-500/50 focus:ring-1 focus:ring-nexus-500/30 transition-colors"
                placeholder="John Doe"
              />
            </div>

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
                placeholder="Choose a strong password"
              />
            </div>

            <div>
              <label htmlFor="orgName" className="block text-sm font-medium text-gray-300 mb-1.5">
                Organization Name
              </label>
              <input
                id="orgName"
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full bg-surface-900 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-nexus-500/50 focus:ring-1 focus:ring-nexus-500/30 transition-colors"
                placeholder="Acme Inc."
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
                  Creating account...
                </span>
              ) : (
                'Create account'
              )}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-nexus-400 hover:text-nexus-300 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
