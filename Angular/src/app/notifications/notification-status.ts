import { NotificationStatus, ServicePayment } from './notification.model';

function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const fromMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toMidnight = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toMidnight.getTime() - fromMidnight.getTime()) / msPerDay);
}

export function getNotificationStatus(payment: ServicePayment, today: Date): NotificationStatus {
  if (payment.paid) {
    return 'paid';
  }

  const daysUntilDue = daysBetween(today, payment.dueDate);

  if (daysUntilDue < 0) {
    return 'overdue';
  }
  if (daysUntilDue === 0) {
    return 'due-today';
  }
  if (daysUntilDue === 2) {
    return 'due-soon';
  }
  return 'not-due';
}