import { useState } from 'react';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
}

export function CodeBlock({ code, language, title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative mb-4 rounded-lg overflow-hidden border border-white/5">
      {title && (
        <div className="bg-surface-850 px-4 py-2 text-xs text-gray-400 border-b border-white/5 flex items-center justify-between">
          <span>{title}</span>
          {language && (
            <span className="text-gray-500 uppercase tracking-wider text-[10px]">{language}</span>
          )}
        </div>
      )}
      <div className="relative">
        <pre className={cn('bg-surface-900 p-4 overflow-x-auto', !title && 'rounded-lg')}>
          <code className="text-sm font-mono text-gray-300">{code}</code>
        </pre>
        <button
          onClick={handleCopy}
          className={cn(
            'absolute top-2 right-2 px-2.5 py-1 rounded text-xs font-medium transition-all duration-200',
            copied
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-surface-850 text-gray-400 border border-white/10 hover:text-gray-300 hover:border-white/20'
          )}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
