import { Link } from 'react-router-dom';

interface FooterLink {
  label: string;
  href: string;
  isRoute?: boolean;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const columns: FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Dashboard', href: '/dashboard', isRoute: true },
      { label: 'Boards', href: '/dashboard', isRoute: true },
      { label: 'Approvals', href: '/dashboard', isRoute: true },
      { label: 'Agent Chat', href: '/dashboard', isRoute: true },
      { label: 'Gateways', href: '/dashboard', isRoute: true },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Documentation', href: '/docs', isRoute: true },
      { label: 'API Reference', href: '/docs/api-reference', isRoute: true },
      { label: 'Agent SDK', href: '/docs', isRoute: true },
      {
        label: 'WebSocket Events',
        href: '/docs/websocket-events',
        isRoute: true,
      },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Changelog', href: '#' },
      { label: 'Status', href: '#' },
      { label: 'Privacy Policy', href: '#' },
      { label: 'Terms of Service', href: '#' },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-white/5 bg-surface-900">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:gap-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-nexus-500 to-nexus-700 text-sm font-bold text-white">
                M
              </div>
              <span className="text-lg font-semibold text-white">MyceliumOps</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-gray-500">
              AI Agent Orchestration &amp; Mission Control. Deploy, manage, and
              orchestrate autonomous AI agents with agentic workflows.
            </p>
            <p className="mt-3 text-sm text-gray-600">
              A product by{' '}
              <a
                href="https://blostem.com"
                className="text-nexus-500 transition-colors hover:text-nexus-400"
                target="_blank"
                rel="noopener noreferrer"
              >
                Blostem
              </a>
            </p>
          </div>

          {/* Link columns */}
          {columns.map((column) => (
            <div key={column.title}>
              <h4 className="mb-4 text-sm font-semibold text-white">
                {column.title}
              </h4>
              <ul className="flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.isRoute ? (
                      <Link
                        to={link.href}
                        className="text-sm text-gray-500 transition-colors hover:text-gray-300"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-gray-500 transition-colors hover:text-gray-300"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 border-t border-white/5 pt-8">
          <p className="text-center text-sm text-gray-500">
            &copy; 2025&ndash;2026 MyceliumOps by Blostem. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
