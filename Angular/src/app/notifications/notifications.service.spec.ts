import { TestBed } from '@angular/core/testing';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('setDeadline should change the due date used to compute status', () => {
    const nearFuture = new Date();
    nearFuture.setDate(nearFuture.getDate() + 2);

    service.setDeadline('Agua', currentMonth, currentYear, nearFuture);

    const deadline = service.getDeadline('Agua', currentMonth, currentYear);
    expect(deadline?.dueDate.toDateString()).toBe(nearFuture.toDateString());
  });

  it('setPaid should remove that owner from active notifications', () => {
    const nearFuture = new Date();
    nearFuture.setDate(nearFuture.getDate() + 2);
    service.setDeadline('Agua', currentMonth, currentYear, nearFuture);
    service.setPaid('101', 'Agua', currentMonth, currentYear, false);

    expect(
      service
        .getActiveNotifications()
        .some((n) => n.apartment === '101' && n.service === 'Agua'),
    ).toBe(true);

    service.setPaid('101', 'Agua', currentMonth, currentYear, true);

    expect(
      service
        .getActiveNotifications()
        .some((n) => n.apartment === '101' && n.service === 'Agua'),
    ).toBe(false);
  });

  it('getOwnerPayments should return one row per apartment, defaulting to unpaid for a period with no data yet', () => {
    const futureYear = currentYear + 5;
    const rows = service.getOwnerPayments('Gas', 6, futureYear);

    expect(rows.length).toBe(6);
    expect(rows.every((r) => r.paid === false)).toBe(true);
    expect(rows.every((r) => r.status === 'not-due')).toBe(true);
  });

  it('getOwnerPayments should reflect a setPaid call for that period', () => {
    service.setPaid('201', 'Luz', currentMonth, currentYear, false);
    const rows = service.getOwnerPayments('Luz', currentMonth, currentYear);
    const row = rows.find((r) => r.apartment === '201');
    expect(row?.paid).toBe(false);
  });

  it('getActiveNotifications should include unpaid deadlines from periods other than the current month', () => {
    const otherMonth = currentMonth === 1 ? 2 : 1;
    const pastDue = new Date();
    pastDue.setMonth(pastDue.getMonth() - 1);

    service.setDeadline('Gas', otherMonth, currentYear, pastDue);
    service.setPaid('301', 'Gas', otherMonth, currentYear, false);

    const notification = service
      .getActiveNotifications()
      .find((n) => n.apartment === '301' && n.service === 'Gas' && n.month === otherMonth);

    expect(notification).toBeTruthy();
    expect(notification?.year).toBe(currentYear);
  });
});
