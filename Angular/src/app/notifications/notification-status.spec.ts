import { getNotificationStatus } from './notification-status';
import { ServicePayment } from './notification.model';

function payment(overrides: Partial<ServicePayment> = {}): ServicePayment {
  return {
    apartmentId: 2,
    apartment: '201',
    owner: 'Bryan',
    service: 'Agua',
    dueDate: new Date('2026-09-10T00:00:00'),
    paid: false,
    ...overrides,
  };
}

describe('getNotificationStatus', () => {
  it('returns paid when the payment is marked paid, regardless of date', () => {
    const result = getNotificationStatus(
      payment({ paid: true, dueDate: new Date('2026-09-10T00:00:00') }),
      new Date('2026-09-10T00:00:00'),
    );
    expect(result).toBe('paid');
  });

  it('returns due-soon exactly 2 days before the due date when unpaid', () => {
    const result = getNotificationStatus(
      payment({ dueDate: new Date('2026-09-10T00:00:00') }),
      new Date('2026-09-08T00:00:00'),
    );
    expect(result).toBe('due-soon');
  });

  it('returns due-today on the due date when unpaid', () => {
    const result = getNotificationStatus(
      payment({ dueDate: new Date('2026-09-10T00:00:00') }),
      new Date('2026-09-10T00:00:00'),
    );
    expect(result).toBe('due-today');
  });

  it('returns overdue after the due date has passed when unpaid', () => {
    const result = getNotificationStatus(
      payment({ dueDate: new Date('2026-09-10T00:00:00') }),
      new Date('2026-09-12T00:00:00'),
    );
    expect(result).toBe('overdue');
  });

  it('returns not-due more than 2 days before the due date when unpaid', () => {
    const result = getNotificationStatus(
      payment({ dueDate: new Date('2026-09-10T00:00:00') }),
      new Date('2026-09-05T00:00:00'),
    );
    expect(result).toBe('not-due');
  });

  it('does not treat 1 day before the due date as due-soon', () => {
    const result = getNotificationStatus(
      payment({ dueDate: new Date('2026-09-10T00:00:00') }),
      new Date('2026-09-09T00:00:00'),
    );
    expect(result).toBe('not-due');
  });

  it('does not treat 3 days before the due date as due-soon', () => {
    const result = getNotificationStatus(
      payment({ dueDate: new Date('2026-09-10T00:00:00') }),
      new Date('2026-09-07T00:00:00'),
    );
    expect(result).toBe('not-due');
  });
});