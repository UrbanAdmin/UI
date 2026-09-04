import { monthName, MONTH_NAMES } from './month-names';

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
