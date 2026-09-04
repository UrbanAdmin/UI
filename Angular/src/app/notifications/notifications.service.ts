import { Injectable } from '@angular/core';
import { getNotificationStatus } from './notification-status';
import { NotificationStatus, ServiceName, ServicePayment } from './notification.model';

interface Apartment {
  number: string;
  owner: string;
}

const APARTMENTS: Apartment[] = [
  { number: '101', owner: 'TBD' },
  { number: '201', owner: 'Bryan' },
  { number: '202', owner: 'Yesenia' },
  { number: '301', owner: 'Oscar' },
  { number: '302', owner: 'Olga' },
  { number: '401', owner: 'Daniel' },
];

const SERVICES: ServiceName[] = ['Agua', 'Luz', 'Gas'];

function daysFromToday(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly payments: ServicePayment[] = this.buildMockPayments();

  getPayments(): ServicePayment[] {
    return this.payments;
  }

  getActiveNotifications(): (ServicePayment & { status: NotificationStatus })[] {
    const today = new Date();
    return this.payments
      .map((payment) => ({ ...payment, status: getNotificationStatus(payment, today) }))
      .filter((payment) => payment.status !== 'paid' && payment.status !== 'not-due');
  }

  private buildMockPayments(): ServicePayment[] {
    // A handful of apartment+service combos are deliberately unpaid with
    // due dates chosen to hit each notification state; everything else is
    // paid, with a due date far enough out to be unremarkable either way.
    const unpaidDueDateOffsets: Record<string, number> = {
      '101-Agua': 2, // due-soon
      '201-Luz': 0, // due-today
      '202-Gas': -3, // overdue
      '302-Gas': 10, // not-due
    };

    const payments: ServicePayment[] = [];
    for (const apartment of APARTMENTS) {
      for (const service of SERVICES) {
        const key = `${apartment.number}-${service}`;
        const isUnpaid = key in unpaidDueDateOffsets;
        payments.push({
          apartment: apartment.number,
          owner: apartment.owner,
          service,
          dueDate: daysFromToday(isUnpaid ? unpaidDueDateOffsets[key] : 15),
          paid: !isUnpaid,
        });
      }
    }
    return payments;
  }
}
