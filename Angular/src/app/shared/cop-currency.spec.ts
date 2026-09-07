import { formatCop, parseCop } from './cop-currency';

describe('formatCop', () => {
  it('formats a whole-peso string with the $ symbol and "." thousands separator', () => {
    expect(formatCop('437590')).toBe('$ 437.590');
  });

  it('formats a number the same way as a numeric string', () => {
    expect(formatCop(50500)).toBe('$ 50.500');
  });

  it('formats zero as "$ 0" rather than blank', () => {
    expect(formatCop('0')).toBe('$ 0');
  });

  it('rounds a fractional value to whole pesos (COP has no cents in practice)', () => {
    expect(formatCop('419.6')).toBe('$ 420');
  });

  it('returns an empty string for null, undefined or empty input', () => {
    expect(formatCop(null)).toBe('');
    expect(formatCop(undefined)).toBe('');
    expect(formatCop('')).toBe('');
  });

  it('returns an empty string for a non-numeric value rather than "$ NaN"', () => {
    expect(formatCop('not-a-number')).toBe('');
  });
});

describe('parseCop', () => {
  it('strips the currency symbol, thousands separators and spaces back to plain digits', () => {
    expect(parseCop('$ 437.590')).toBe('437590');
  });

  it('passes plain digits through unchanged', () => {
    expect(parseCop('50500')).toBe('50500');
  });

  it('returns an empty string when there are no digits', () => {
    expect(parseCop('$ ')).toBe('');
    expect(parseCop('')).toBe('');
  });
});
