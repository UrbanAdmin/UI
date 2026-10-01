import { hasRealDueDate, sentinelDueDate } from './owner-payment.model';

describe('hasRealDueDate', () => {
  it('is false for the shared "nothing billed yet" sentinel date', () => {
    expect(hasRealDueDate(sentinelDueDate())).toBe(false);
  });

  it('is true for a real, resolved due date', () => {
    expect(hasRealDueDate(new Date(2026, 9, 15))).toBe(true);
  });
});
