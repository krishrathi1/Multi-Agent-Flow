import { describe, it, expect } from 'vitest';
import { intParam, strParam, boolParam } from '../lib/query.js';

/**
 * `?limit=abc` used to reach Prisma as `take: NaN` and come back as a 500 on
 * six endpoints. A malformed query parameter is a bad request at worst.
 */

describe('intParam', () => {
  it('ignores values that are not numbers', () => {
    // Each of these produced NaN and a 500 before.
    for (const bad of ['abc', 'null', 'undefined', 'NaN', '{}', '', '   ']) {
      expect(intParam(bad), bad).toBeUndefined();
    }
  });

  it('ignores non-finite numbers', () => {
    expect(intParam('Infinity')).toBeUndefined();
    expect(intParam('-Infinity')).toBeUndefined();
  });

  it('returns undefined when absent', () => {
    expect(intParam(undefined)).toBeUndefined();
    expect(intParam(null)).toBeUndefined();
  });

  it('clamps into range instead of trusting the caller', () => {
    // Negative take reads from the end in Prisma — surprising, not requested.
    expect(intParam('-5')).toBe(1);
    expect(intParam('0')).toBe(1);
    expect(intParam('999999')).toBe(100);
    expect(intParam('1e9')).toBe(100);
    expect(intParam('50')).toBe(50);
  });

  it('respects a custom ceiling', () => {
    expect(intParam('100000', { max: 8760 })).toBe(8760);
  });

  it('truncates fractions rather than passing them through', () => {
    expect(intParam('7.9')).toBe(7);
  });

  it('takes the first value of a repeated parameter', () => {
    // ?limit=1&limit=2 arrives as an array; String(array) would give "1,2".
    expect(intParam(['25', '50'])).toBe(25);
  });

  it('ignores a nested object parameter', () => {
    // ?limit[a]=5 parses to an object, not a scalar.
    expect(intParam({ a: '5' })).toBeUndefined();
  });
});

describe('strParam', () => {
  it('reads a plain string and drops empties', () => {
    expect(strParam('abc')).toBe('abc');
    expect(strParam('')).toBeUndefined();
    expect(strParam(undefined)).toBeUndefined();
  });

  it('takes the first value of a repeated parameter', () => {
    expect(strParam(['x', 'y'])).toBe('x');
  });

  it('ignores objects rather than stringifying them', () => {
    expect(strParam({ a: 'b' })).toBeUndefined();
  });
});

describe('boolParam', () => {
  it('accepts the usual spellings of true', () => {
    for (const v of ['true', '1', '']) expect(boolParam(v), v).toBe(true);
  });

  it('treats everything else as false', () => {
    for (const v of ['false', '0', 'no', undefined, { a: 'b' }]) {
      expect(boolParam(v), String(v)).toBe(false);
    }
  });
});
