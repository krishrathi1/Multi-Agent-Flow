import { Link, Outlet } from 'react-router-dom';
import { DocsSidebar } from './DocsSidebar';

export function DocsLayout() {
  return (
    <div className="min-h-screen bg-surface-950">
      {/* Top nav */}
      <header className="sticky top-0 z-50 bg-surface-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-nexus-500 to-nexus-700 flex items-center justify-center text-white font-bold text-sm">
              N
            </div>
            <span className="text-white font-semibold text-sm">
              Nexus <span className="text-gray-400 font-normal">Docs</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/signup"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Sign Up
            </Link>
            <Link
              to="/login"
              className="text-sm px-3.5 py-1.5 rounded-lg bg-nexus-600 hover:bg-nexus-500 text-white font-medium transition-colors"
            >
              Log In
            </Link>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex max-w-7xl mx-auto">
        <DocsSidebar />
        <main className="flex-1 min-w-0 px-8 py-10 max-w-4xl">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
