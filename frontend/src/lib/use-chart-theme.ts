import { useMemo } from 'react';
import { useUiStore } from '../stores/ui-store';
import { getChartTheme, type ChartTheme } from './design';

/**
 * Chart colours for the theme currently painted.
 *
 * Recharts needs concrete values (it writes `fill`/`stroke` attributes), so
 * charts can't inherit CSS variables the way the rest of the UI does. This
 * resolves the palette reactively instead.
 */
export function useChartTheme(): ChartTheme {
  const resolved = useUiStore((s) => s.resolvedTheme);
  return useMemo(() => getChartTheme(resolved), [resolved]);
}
