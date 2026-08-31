import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'Integrations', href: '#integrations' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Use Cases', href: '#use-cases' },
    { label: 'Docs', href: '/docs', isRoute: true },
  ];

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-surface-950/80 backdrop-blur-xl border-b border-white/5'
          : 'bg-transparent'
      )}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-nexus-500 to-nexus-700 font-bold text-white text-sm">
            M
          </div>
          <span className="text-lg font-semibold text-white">MyceliumOps</span>
        </Link>

        {/* Center nav links — desktop */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) =>
            link.isRoute ? (
              <Link
                key={link.label}
                to={link.href}
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            )
          )}
        </div>

        {/* Right actions — desktop */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="text-sm text-gray-400 transition-colors hover:text-white"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded-lg bg-nexus-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-nexus-500"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-lg md:hidden"
          aria-label="Toggle navigation"
        >
          <span
            className={cn(
              'h-0.5 w-5 rounded-full bg-gray-400 transition-all duration-300',
              mobileOpen && 'translate-y-2 rotate-45'
            )}
          />
          <span
            className={cn(
              'h-0.5 w-5 rounded-full bg-gray-400 transition-all duration-300',
              mobileOpen && 'opacity-0'
            )}
          />
          <span
            className={cn(
              'h-0.5 w-5 rounded-full bg-gray-400 transition-all duration-300',
              mobileOpen && '-translate-y-2 -rotate-45'
            )}
          />
        </button>
      </nav>

      {/* Mobile menu */}
      <div
        className={cn(
          'overflow-hidden border-b border-white/5 bg-surface-950/95 backdrop-blur-xl transition-all duration-300 md:hidden',
          mobileOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0 border-none'
        )}
      >
        <div className="flex flex-col gap-4 px-6 py-4">
          {navLinks.map((link) =>
            link.isRoute ? (
              <Link
                key={link.label}
                to={link.href}
                className="text-sm text-gray-400 transition-colors hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-gray-400 transition-colors hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            )
          )}
          <hr className="border-white/5" />
          <Link
            to="/login"
            className="text-sm text-gray-400 transition-colors hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="inline-block rounded-lg bg-nexus-600 px-5 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-nexus-500"
            onClick={() => setMobileOpen(false)}
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
