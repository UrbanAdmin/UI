import { parseEsDecimal, formatEsDecimal, formatEsPercentage } from './es-number';

describe('es-number', () => {
  describe('parseEsDecimal', () => {
    it('treats a comma as the decimal separator (Colombian convention)', () => {
      expect(parseEsDecimal('516,425')).toBe('516.425');
    });

    it('treats a period as a thousands separator and strips it', () => {
      expect(parseEsDecimal('1.520')).toBe('1520');
    });

    it('handles both together (thousands and a decimal part)', () => {
      expect(parseEsDecimal('12.516,425')).toBe('12516.425');
    });

    it('leaves a plain digit string untouched', () => {
      expect(parseEsDecimal('1520')).toBe('1520');
    });

    it('returns null for null, undefined, and blank input', () => {
      expect(parseEsDecimal(null)).toBeNull();
      expect(parseEsDecimal(undefined)).toBeNull();
      expect(parseEsDecimal('   ')).toBeNull();
    });
  });

  describe('formatEsDecimal', () => {
    it('renders an invariant decimal string in es-CO style', () => {
      expect(formatEsDecimal('516.425')).toBe('516,425');
    });

    it('adds thousands separators', () => {
      expect(formatEsDecimal('12516.425')).toBe('12.516,425');
    });

    it('trims a long unrounded decimal to the given number of digits for display only', () => {
      expect(formatEsDecimal('0.17777777777777777', 2)).toBe('0,18');
    });

    it('returns an empty string for null/undefined/empty', () => {
      expect(formatEsDecimal(null)).toBe('');
      expect(formatEsDecimal(undefined)).toBe('');
      expect(formatEsDecimal('')).toBe('');
    });
  });

  describe('formatEsPercentage', () => {
    it('multiplies by 100, appends %, and uses the es-CO decimal comma', () => {
      expect(formatEsPercentage('0.177777777777')).toBe('17,78%');
    });

    it('handles an exact value with no rounding artifacts', () => {
      expect(formatEsPercentage('0.3')).toBe('30%');
    });

    it('returns an empty string for null/undefined/empty', () => {
      expect(formatEsPercentage(null)).toBe('');
      expect(formatEsPercentage(undefined)).toBe('');
      expect(formatEsPercentage('')).toBe('');
    });
  });
});
