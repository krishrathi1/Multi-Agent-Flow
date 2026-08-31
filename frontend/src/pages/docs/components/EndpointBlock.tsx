import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CodeBlock } from './CodeBlock';

interface EndpointBlockProps {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  body?: string;
  response?: string;
  auth?: string;
}

const methodColors: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  POST: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  PATCH: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
};

export function EndpointBlock({ method, path, description, body, response, auth }: EndpointBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = body || response;

  return (
    <div className="mb-4 border border-white/5 rounded-lg overflow-hidden bg-surface-900/50">
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3',
          hasDetails && 'cursor-pointer hover:bg-surface-850/50'
        )}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        <span
          className={cn(
            'px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border',
            methodColors[method]
          )}
        >
          {method}
        </span>
        <code className="text-sm font-mono text-gray-300">{path}</code>
        {auth && (
          <span className="ml-auto text-xs text-gray-500 border border-white/5 rounded px-2 py-0.5">
            {auth}
          </span>
        )}
        {hasDetails && (
          <span className={cn('text-gray-500 text-xs ml-auto transition-transform', expanded && 'rotate-180')}>
            &#9660;
          </span>
        )}
      </div>
      <div className="px-4 pb-3">
        <p className="text-sm text-gray-400">{description}</p>
      </div>
      {expanded && hasDetails && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
          {body && <CodeBlock code={body} title="Request Body" language="json" />}
          {response && <CodeBlock code={response} title="Response" language="json" />}
        </div>
      )}
    </div>
  );
}
