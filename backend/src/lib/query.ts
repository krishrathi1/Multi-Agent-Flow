/**
 * Safe readers for query-string values.
 *
 * `req.query.x ? Number(req.query.x) : undefined` looks harmless but turns any
 * non-numeric string into NaN, which reaches Prisma as `take: NaN` and comes
 * back to the caller as a 500. A malformed query parameter is a bad request at
 * worst — it should never crash the endpoint.
 *
 * Express 5 also types query values as `string | string[] | ParsedQs`, so a
 * repeated parameter (`?limit=1&limit=2`) arrives as an array; these helpers
 * take the first value rather than stringifying the whole thing.
 */

function first(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
}

/**
 * Reads a positive integer, or `undefined` when absent or unusable.
 *
 * Clamps into [1, max] so a negative value can't mean "read from the end" and
 * an enormous one can't be used to pull the whole table.
 */
export function intParam(
  value: unknown,
  opts: { max?: number; min?: number } = {},
): number | undefined {
  const raw = first(value);
  if (raw === undefined || raw.trim() === '') return undefined;

  const n = Number(raw);
  // Rejects NaN and Infinity together — neither is a usable row count.
  if (!Number.isFinite(n)) return undefined;

  const min = opts.min ?? 1;
  const max = opts.max ?? 100;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

/** Reads a single string parameter, ignoring repeats and non-strings. */
export function strParam(value: unknown): string | undefined {
  const raw = first(value);
  return raw === undefined || raw === '' ? undefined : raw;
}

/** Reads a flag, accepting the `?flag`, `?flag=true` and `?flag=1` spellings. */
export function boolParam(value: unknown): boolean {
  const raw = first(value);
  if (raw === undefined) return false;
  return raw === '' || raw === 'true' || raw === '1';
}
