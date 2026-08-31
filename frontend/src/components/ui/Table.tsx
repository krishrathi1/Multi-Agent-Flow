import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * Table primitives. The wrapper owns horizontal overflow so a wide table
 * scrolls inside its own card instead of pushing the page sideways.
 */
export function TableWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-xl border border-line-subtle bg-surface',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Table({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <table className={cn('w-full border-collapse text-left text-base', className)}>
      {children}
    </table>
  );
}

export function Th({
  children,
  className,
  align = 'left',
  scope = 'col',
}: {
  children?: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
  scope?: string;
}) {
  return (
    <th
      scope={scope}
      className={cn(
        'sticky top-0 z-10 whitespace-nowrap border-b border-line bg-surface',
        'px-4 py-2.5 text-2xs font-semibold uppercase tracking-[0.07em] text-ink-faint',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = 'left',
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        'border-b border-line-subtle px-4 py-3 align-middle text-ink-muted',
        align === 'right' && 'text-right tabular-nums',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({
  children,
  className,
  interactive = false,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'last:[&>td]:border-b-0',
        interactive && 'cursor-pointer transition-colors duration-150 hover:wash',
        className,
      )}
    >
      {children}
    </tr>
  );
}
