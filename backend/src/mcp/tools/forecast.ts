/**
 * Forecasting tool: projects the next values of a numeric series.
 *
 * Holt's linear method (double exponential smoothing) with its two smoothing
 * factors fitted by grid search on one-step-ahead error, plus an ordinary
 * least-squares trend line for comparison. The interval is ±1.28σ√h of the
 * Holt residuals — roughly 80% if the errors are normal.
 */

export interface ForecastResult {
  method: string;
  points: number;
  horizon: number;
  forecast: Array<{ step: number; value: number; low: number; high: number }>;
  /** What low/high mean, so a reader doesn't assume a 95% interval. */
  interval: string;
  trend: { perStep: number; direction: 'rising' | 'falling' | 'flat' };
  fit: { alpha?: number; beta?: number; rmse: number; mape?: number };
  regression?: { slope: number; intercept: number; r2: number; next: number[] };
  note?: string;
}

const round = (n: number) => Number(n.toPrecision(6));

function holt(values: number[], alpha: number, beta: number) {
  let level = values[0];
  let trend = values[1] - values[0];
  let sse = 0;
  let ape = 0;
  let apeCount = 0;
  for (let t = 1; t < values.length; t++) {
    const predicted = level + trend;
    const err = values[t] - predicted;
    sse += err * err;
    if (values[t] !== 0) { ape += Math.abs(err / values[t]); apeCount++; }
    const prevLevel = level;
    level = alpha * values[t] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const n = values.length - 1;
  return { level, trend, rmse: Math.sqrt(sse / n), mape: apeCount ? ape / apeCount : undefined };
}

function regression(values: number[]) {
  const n = values.length;
  const xs = values.map((_, i) => i);
  const mx = (n - 1) / 2;
  const my = values.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (values[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (values[i] - my) ** 2;
  }
  const slope = sxx ? sxy / sxx : 0;
  const intercept = my - slope * mx;
  const r2 = syy ? (sxy * sxy) / (sxx * syy) : 1;
  return { slope, intercept, r2 };
}

export function forecast(values: number[], horizon = 3): ForecastResult {
  const series = values.filter((v) => Number.isFinite(v));
  if (series.length === 0) throw new Error('The series has no numeric values');
  const h = Math.max(1, Math.min(24, Math.round(horizon)));

  // Too short to fit a trend: carry the mean forward.
  if (series.length < 3) {
    const mean = series.reduce((s, v) => s + v, 0) / series.length;
    const spread = series.length === 2 ? Math.abs(series[1] - series[0]) : Math.abs(mean) * 0.25;
    return {
      method: 'mean (too few points for a trend)',
      points: series.length,
      horizon: h,
      forecast: Array.from({ length: h }, (_, i) => ({ step: i + 1, value: round(mean), low: round(mean - spread), high: round(mean + spread) })),
      interval: 'rough range from the spread of the values, not a statistical interval',
      trend: { perStep: 0, direction: 'flat' },
      fit: { rmse: round(spread) },
      note: 'Give at least 3 values for a trend-based forecast.',
    };
  }

  let best = { alpha: 0.5, beta: 0.3, ...holt(series, 0.5, 0.3) };
  for (let a = 0.1; a <= 0.91; a += 0.1) {
    for (let b = 0.05; b <= 0.91; b += 0.1) {
      const fit = holt(series, a, b);
      if (fit.rmse < best.rmse) best = { alpha: a, beta: b, ...fit };
    }
  }

  const reg = regression(series);
  const scale = Math.max(...series.map(Math.abs), 1e-9);
  const direction = Math.abs(best.trend) < scale * 0.01 ? 'flat' : best.trend > 0 ? 'rising' : 'falling';
  return {
    method: "Holt's linear exponential smoothing",
    points: series.length,
    horizon: h,
    forecast: Array.from({ length: h }, (_, i) => {
      const step = i + 1;
      const value = best.level + step * best.trend;
      const band = 1.28 * best.rmse * Math.sqrt(step);
      return { step, value: round(value), low: round(value - band), high: round(value + band) };
    }),
    interval: 'about 80% (±1.28 × residual σ × √step)',
    trend: { perStep: round(best.trend), direction },
    fit: { alpha: round(best.alpha), beta: round(best.beta), rmse: round(best.rmse), mape: best.mape === undefined ? undefined : round(best.mape) },
    regression: {
      slope: round(reg.slope),
      intercept: round(reg.intercept),
      r2: round(reg.r2),
      next: Array.from({ length: h }, (_, i) => round(reg.intercept + reg.slope * (series.length + i))),
    },
  };
}
