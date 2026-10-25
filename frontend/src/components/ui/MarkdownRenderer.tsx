import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Copy, Check, Terminal } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  maxHeight?: string;
  hideScrollbar?: boolean;
}

/** Render inline tokens: `code`, ***bold-italic***, **bold**, *italic*, [links](url) */
export function renderInline(text: string): React.ReactNode[] {
  // Normalize messy consecutive asterisks e.g. * *** to * **
  const sanitized = text.replace(/\*\s+\*\*\*/g, '* **').replace(/\*\*\*\*/g, '***');

  // Regex to split on `code`, ***bold-italic***, **bold**, *italic*, [link](url)
  const regex = /(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = sanitized.split(regex);

  return parts.map((part, i) => {
    if (!part) return null;

    // Inline code
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const code = part.slice(1, -1);
      return (
        <code
          key={i}
          className="rounded-md bg-inset px-1.5 py-0.5 font-mono text-[11px] font-semibold text-brand-600 dark:text-brand-400 border border-line-subtle inline-block my-0.5 align-middle"
        >
          {code}
        </code>
      );
    }

    // Bold + Italic (***text***)
    if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
      return (
        <strong key={i} className="font-bold italic text-ink">
          {part.slice(3, -3)}
        </strong>
      );
    }

    // Bold (**text**)
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={i} className="font-bold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic (*text*)
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={i} className="italic text-ink font-medium">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Link [label](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const rawHref = (linkMatch[2] || '').trim();
      const isAllowed = /^https?:\/\//i.test(rawHref) || /^mailto:/i.test(rawHref) || rawHref.startsWith('/');
      const safeHref = isAllowed ? rawHref : '#';
      return (
        <a
          key={i}
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-600 dark:text-brand-400 font-semibold underline underline-offset-2 hover:text-brand-500"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="relative my-2.5 rounded-xl border border-line-subtle bg-inset/90 overflow-hidden shadow-2xs group">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-line-subtle bg-surface/50 text-2xs font-mono text-ink-muted">
        <span className="flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider text-brand-600 dark:text-brand-400">
          <Terminal size={11} /> {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-[10px] font-bold text-ink-muted hover:text-ink transition-colors cursor-pointer py-0.5 px-1.5 rounded bg-surface border border-line-subtle shadow-2xs"
        >
          {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3 font-mono text-xs text-ink leading-relaxed overflow-x-auto no-scrollbar whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function TableBlock({ headerRows, bodyRows }: { headerRows: string[]; bodyRows: string[][] }) {
  return (
    <div className="my-2.5 overflow-hidden rounded-xl border border-line bg-surface shadow-2xs">
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-left text-xs font-sans border-collapse">
          <thead>
            <tr className="border-b border-line bg-inset/90 text-ink">
              {headerRows.map((cell, idx) => (
                <th key={idx} className="p-2.5 font-bold uppercase tracking-wider text-[10px] text-ink-muted border-r border-line-subtle last:border-r-0">
                  {renderInline(cell.trim())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle text-ink/90">
            {bodyRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-hover/40 transition-colors">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="p-2.5 align-top border-r border-line-subtle last:border-r-0">
                    {renderInline(cell.trim())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Check if a line is part of a markdown table */
function isTableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|');
}

/** Check if a line is a table divider e.g. |---|---| */
function isTableDivider(line: string): boolean {
  const trimmed = line.trim();
  if (!isTableLine(trimmed)) return false;
  const inner = trimmed.slice(1, -1);
  return inner.split('|').every((cell) => /^[\s:-]+$/.test(cell.trim()));
}

/** Split pipe table row into array of cell strings */
function parseTableRow(line: string): string[] {
  const trimmed = line.trim();
  const inner = trimmed.startsWith('|') && trimmed.endsWith('|') ? trimmed.slice(1, -1) : trimmed;
  return inner.split('|').map((s) => s.trim());
}

/** Check if a line looks like an ASCII diagram */
function isAsciiDiagramLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    /^\+[-+]+\+$/.test(trimmed) ||
    /^\|.*\|$/.test(trimmed) ||
    /^[+|\\/<>v^-]{3,}$/.test(trimmed) ||
    /^(---+|====+|\.\.\.\.+)$/.test(trimmed)
  );
}

/** Check if a group of lines look like source code (import/const/function/class) */
function isCodeLine(line: string): boolean {
  const t = line.trim();
  return (
    t.startsWith('//') ||
    t.startsWith('/*') ||
    t.startsWith('import ') ||
    t.startsWith('export ') ||
    t.startsWith('const ') ||
    t.startsWith('let ') ||
    t.startsWith('var ') ||
    t.startsWith('function ') ||
    t.startsWith('class ') ||
    t.startsWith('return ') ||
    t.endsWith(';') ||
    t.endsWith('{') ||
    t.endsWith('}')
  );
}

export function MarkdownRenderer({
  content,
  className,
  maxHeight,
  hideScrollbar = true,
}: MarkdownRendererProps) {
  if (!content) return null;

  // Clean JSON wrappers if LLM returned JSON string
  let text = content.trim();
  try {
    if (text.startsWith('{') && text.endsWith('}')) {
      const parsed = JSON.parse(text);
      if (typeof parsed.summary === 'string') text = parsed.summary;
      else if (typeof parsed.message === 'string') text = parsed.message;
    }
  } catch {
    /* ignore */
  }

  // If the whole content is wrapped in ```markdown or ```md or ```text or ```
  const outerFenceMatch = text.match(/^```(markdown|md|text|txt)?\s*([\s\S]*?)\s*```$/i);
  if (outerFenceMatch) {
    text = outerFenceMatch[2].trim();
  }

  const rawLines = text.split('\n');
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // 1. Fenced Code Block for real programming languages (ts, js, py, json, etc.)
    if (trimmed.startsWith('```')) {
      const lang = trimmed.replace(/^```/, '').trim().toLowerCase();
      const codeLines: string[] = [];
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith('```')) {
        codeLines.push(rawLines[i]);
        i++;
      }
      i++; // skip closing ```

      // If it's markdown or text, don't wrap in CodeBlock, just render contents
      if (lang === 'markdown' || lang === 'md' || lang === 'text' || lang === 'txt') {
        const innerText = codeLines.join('\n');
        elements.push(
          <MarkdownRenderer key={`inner-md-${elements.length}`} content={innerText} hideScrollbar={false} />
        );
      } else {
        elements.push(
          <CodeBlock
            key={`code-${elements.length}`}
            code={codeLines.join('\n')}
            language={lang || 'code'}
          />
        );
      }
      continue;
    }

    // 2. Markdown Table Detection
    if (isTableLine(trimmed) && i + 1 < rawLines.length && isTableDivider(rawLines[i + 1])) {
      const header = parseTableRow(trimmed);
      i += 2; // skip header + divider
      const rows: string[][] = [];
      while (i < rawLines.length && isTableLine(rawLines[i])) {
        rows.push(parseTableRow(rawLines[i]));
        i++;
      }
      elements.push(
        <TableBlock
          key={`table-${elements.length}`}
          headerRows={header}
          bodyRows={rows}
        />
      );
      continue;
    }

    // 3. Consecutive ASCII Diagram Lines
    if (isAsciiDiagramLine(trimmed) && !isTableLine(trimmed)) {
      const diagLines: string[] = [line];
      i++;
      while (
        i < rawLines.length &&
        (isAsciiDiagramLine(rawLines[i]) || rawLines[i].trim() === 'v' || rawLines[i].trim() === '|' || !rawLines[i].trim())
      ) {
        diagLines.push(rawLines[i]);
        i++;
      }
      elements.push(
        <pre
          key={`diag-${elements.length}`}
          className="my-2 rounded-xl border border-line bg-inset/80 p-3 font-mono text-xs text-brand-600 dark:text-brand-400 overflow-x-auto no-scrollbar whitespace-pre shadow-2xs leading-tight"
        >
          {diagLines.join('\n')}
        </pre>
      );
      continue;
    }

    // 4. Consecutive un-fenced Code Lines (like imports, const, classes, etc.)
    if (isCodeLine(trimmed) && trimmed.length > 4 && !trimmed.startsWith('#')) {
      const codeBlockLines: string[] = [line];
      i++;
      while (i < rawLines.length && (isCodeLine(rawLines[i]) || !rawLines[i].trim())) {
        codeBlockLines.push(rawLines[i]);
        i++;
      }
      // If there are at least 3 code-like lines, render as a code block
      if (codeBlockLines.filter((l) => l.trim()).length >= 3) {
        elements.push(
          <CodeBlock
            key={`auto-code-${elements.length}`}
            code={codeBlockLines.join('\n')}
            language="typescript"
          />
        );
        continue;
      } else {
        // Fall back to normal line
        i -= (codeBlockLines.length - 1);
      }
    }

    // 5. Headings / Step Titles
    if (trimmed.startsWith('# ') || trimmed.startsWith('## ') || trimmed.startsWith('### ') || trimmed.startsWith('#### ')) {
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const headingText = trimmed.replace(/^#+\s*/, '');
      if (level === 1) {
        elements.push(
          <h4 key={`h1-${elements.length}`} className="text-sm font-bold text-ink tracking-tight pt-2 pb-1 border-b border-line-subtle">
            {renderInline(headingText)}
          </h4>
        );
      } else if (level === 2) {
        elements.push(
          <h5 key={`h2-${elements.length}`} className="text-xs font-bold text-ink pt-2 pb-0.5 uppercase tracking-wider text-brand-600 dark:text-brand-400">
            {renderInline(headingText)}
          </h5>
        );
      } else {
        elements.push(
          <h6 key={`h3-${elements.length}`} className="text-xs font-bold text-ink/90 pt-1.5 pb-0.5">
            {renderInline(headingText)}
          </h6>
        );
      }
      i++;
      continue;
    }

    if (
      /^STEP\s+\d+:/i.test(trimmed) ||
      /^TABLE OF /i.test(trimmed) ||
      /^ARCHITECTURE /i.test(trimmed) ||
      /^[A-Z\s]{4,}:$/i.test(trimmed)
    ) {
      elements.push(
        <h5
          key={`h-${elements.length}`}
          className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider pt-2.5 pb-0.5 flex items-center gap-1.5"
        >
          {renderInline(trimmed)}
        </h5>
      );
      i++;
      continue;
    }

    // 6. Numbered and Bullet lists
    if (/^\d+\.\s/.test(trimmed)) {
      const numMatch = trimmed.match(/^(\d+\.)\s*(.*)$/);
      elements.push(
        <div key={`num-li-${elements.length}`} className="flex items-start gap-2 pt-1 text-xs text-ink/90">
          <span className="text-brand-600 dark:text-brand-400 font-mono font-bold shrink-0">{numMatch?.[1]}</span>
          <span className="flex-1 leading-relaxed">{renderInline(numMatch?.[2] || '')}</span>
        </div>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const isNested = line.startsWith('  ') || line.startsWith('\t');
      const textOnly = trimmed.substring(2).trim();
      elements.push(
        <div key={`li-${elements.length}`} className={cn('flex items-start gap-2 text-xs text-ink/90', isNested ? 'ml-4' : 'ml-1')}>
          <span className="text-brand-500 font-bold mt-0.5 shrink-0">•</span>
          <span className="flex-1 leading-relaxed">{renderInline(textOnly)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 7. Empty line
    if (!trimmed) {
      elements.push(<div key={`space-${elements.length}`} className="h-1" />);
      i++;
      continue;
    }

    // 8. Normal Paragraph Text
    elements.push(
      <p key={`p-${elements.length}`} className="text-xs leading-relaxed text-ink/90 font-normal">
        {renderInline(trimmed)}
      </p>
    );
    i++;
  }

  return (
    <div
      className={cn(
        'space-y-1.5 text-xs text-ink font-sans pt-0.5',
        maxHeight,
        maxHeight && 'overflow-y-auto pr-1 scroll-smooth',
        hideScrollbar && 'no-scrollbar',
        className,
      )}
    >
      {elements}
    </div>
  );
}
