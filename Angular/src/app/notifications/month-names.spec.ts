import { monthName, formatDateInWords, MONTH_NAMES } from './month-names';

describe('monthName', () => {
  it('has 12 Spanish month names', () => {
    expect(MONTH_NAMES.length).toBe(12);
  });

  it('returns the Spanish name for a 1-based month number', () => {
    expect(monthName(1)).toBe('Enero');
    expect(monthName(12)).toBe('Diciembre');
  });

  it('returns an empty string for an out-of-range month', () => {
    expect(monthName(0)).toBe('');
    expect(monthName(13)).toBe('');
  });
});

describe('formatDateInWords', () => {
  it('renders an ISO date-only string in Spanish words', () => {
    expect(formatDateInWords('2026-09-10')).toBe('10 de septiembre de 2026');
  });

  it('does not shift the day backward due to timezone conversion', () => {
    // A naive `new Date('2026-10-01')` parses as UTC midnight, which renders as
    // "30 de septiembre" in any timezone behind UTC - this must parse the parts directly instead.
    expect(formatDateInWords('2026-10-01')).toBe('1 de octubre de 2026');
  });

  it('tolerates a full ISO timestamp by only reading the date part', () => {
    expect(formatDateInWords('2026-01-05T00:00:00Z')).toBe('5 de enero de 2026');
  });

  it('returns an empty string for null/undefined/empty', () => {
    expect(formatDateInWords(null)).toBe('');
    expect(formatDateInWords(undefined)).toBe('');
    expect(formatDateInWords('')).toBe('');
  });
});
