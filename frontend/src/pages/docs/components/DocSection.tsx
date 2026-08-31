import { type ReactNode, useState } from 'react';

interface DocSectionProps {
  id: string;
  title: string;
  children: ReactNode;
}

export function DocSection({ id, title, children }: DocSectionProps) {
  const [showAnchor, setShowAnchor] = useState(false);

  return (
    <section id={id} className="mb-12 scroll-mt-20">
      <h2
        className="text-2xl font-bold text-white mb-4 group flex items-center gap-2"
        onMouseEnter={() => setShowAnchor(true)}
        onMouseLeave={() => setShowAnchor(false)}
      >
        {title}
        <a
          href={`#${id}`}
          className={`text-nexus-500 text-lg transition-opacity duration-200 ${
            showAnchor ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label={`Link to ${title}`}
        >
          #
        </a>
      </h2>
      {children}
    </section>
  );
}
