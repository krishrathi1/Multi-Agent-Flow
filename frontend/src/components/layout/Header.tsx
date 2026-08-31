import type { ReactNode } from 'react';
import { PageHeader } from '../ui/PageHeader';

/**
 * Back-compat shim. Screens still importing the old `<Header>` now render the
 * shared <PageHeader>, so titles, spacing and action placement match the rest
 * of the app. New screens should use <PageHeader> directly.
 */
export function Header({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return <PageHeader title={title} description={subtitle} actions={actions} />;
}
