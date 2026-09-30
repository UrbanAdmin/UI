import { rentDueDate } from './rent-due-date';

describe('rentDueDate', () => {
  it('uses the same day-of-month as the contract start date', () => {
    const result = rentDueDate(new Date(2026, 0, 10), 3, 2026); // month is 1-based here
    expect(result).toEqual(new Date(2026, 2, 10));
  });

  it('clamps to the last day of a 30-day month', () => {
    const result = rentDueDate(new Date(2026, 0, 31), 4, 2026); // April has 30 days
    expect(result).toEqual(new Date(2026, 3, 30));
  });

  it('clamps to the 28th of February in a non-leap year', () => {
    const result = rentDueDate(new Date(2026, 0, 31), 2, 2026); // 2026 is not a leap year
    expect(result).toEqual(new Date(2026, 1, 28));
  });

  it('clamps to the 29th of February in a leap year', () => {
    const result = rentDueDate(new Date(2026, 0, 31), 2, 2028); // 2028 is a leap year
    expect(result).toEqual(new Date(2028, 1, 29));
  });

  it('does not clamp when the target month has enough days', () => {
    const result = rentDueDate(new Date(2026, 0, 15), 2, 2026);
    expect(result).toEqual(new Date(2026, 1, 15));
  });

  it('returns a far-future sentinel date when there is no contract start date', () => {
    const result = rentDueDate(null, 3, 2026);
    expect(result.getFullYear()).toBeGreaterThan(2100);
  });
});
