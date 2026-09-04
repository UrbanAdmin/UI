import { Injectable } from '@angular/core';
import { getNotificationStatus } from './notification-status';
import {
  NotificationStatus,
  OwnerPayment,
  ServiceDeadline,
  ServiceName,
  ServicePayment,
} from './notification.model';
import { APARTMENTS } from '../shared/apartments';

const SERVICES: ServiceName[] = ['Agua', 'Luz', 'Gas'];

function daysFromToday(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

function periodKey(service: ServiceName, month: number, year: number): string {
  return `${service}-${month}-${year}`;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly deadlines: ServiceDeadline[] = [];
  private readonly ownerPayments: OwnerPayment[] = [];

  constructor() {
    this.seedMockData();
  }

  getDeadline(service: ServiceName, month: number, year: number): ServiceDeadline | undefined {
    return this.deadlines.find(
      (d) => d.service === service && d.month === month && d.year === year,
    );
  }

  setDeadline(service: ServiceName, month: number, year: number, dueDate: Date): void {
    const existing = this.getDeadline(service, month, year);
    if (existing) {
      existing.dueDate = dueDate;
    } else {
      this.deadlines.push({ service, month, year, dueDate });
    }
  }

  getOwnerPayments(
    service: ServiceName,
    month: number,
    year: number,
  ): (OwnerPayment & { status: NotificationStatus })[] {
    const deadline = this.getDeadline(service, month, year);
    const today = new Date();

    return APARTMENTS.map((apartment) => {
      const existing = this.ownerPayments.find(
        (p) =>
          p.apartment === apartment.number &&
          p.service === service &&
          p.month === month &&
          p.year === year,
      );
      const paid = existing?.paid ?? false;
      const status = deadline
        ? getNotificationStatus({ apartment: apartment.number, owner: apartment.owner, service, dueDate: deadline.dueDate, paid }, today)
        : 'not-due';
      return {
        apartment: apartment.number,
        owner: apartment.owner,
        service,
        month,
        year,
        paid,
        status,
      };
    });
  }

  setPaid(apartment: string, service: ServiceName, month: number, year: number, paid: boolean): void {
    const owner = APARTMENTS.find((a) => a.number === apartment)?.owner ?? '';
    const existing = this.ownerPayments.find(
      (p) => p.apartment === apartment && p.service === service && p.month === month && p.year === year,
    );
    if (existing) {
      existing.paid = paid;
    } else {
      this.ownerPayments.push({ apartment, owner, service, month, year, paid });
    }
  }

  /** Scans every period that has a deadline set (not just the current month), so a
   *  never-marked-paid balance from an earlier or later period still shows up. */
  getActiveNotifications(): (ServicePayment & { status: NotificationStatus; month: number; year: number })[] {
    const active: (ServicePayment & { status: NotificationStatus; month: number; year: number })[] = [];
    for (const deadline of this.deadlines) {
      const rows = this.getOwnerPayments(deadline.service, deadline.month, deadline.year);
      for (const row of rows) {
        if (row.status !== 'paid' && row.status !== 'not-due') {
          active.push({
            apartment: row.apartment,
            owner: row.owner,
            service: row.service,
            dueDate: deadline.dueDate,
            paid: row.paid,
            status: row.status,
            month: deadline.month,
            year: deadline.year,
          });
        }
      }
    }
    return active;
  }

  private seedMockData(): void {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    this.setDeadline('Agua', month, year, daysFromToday(2)); // due-soon
    this.setDeadline('Luz', month, year, daysFromToday(0)); // due-today
    this.setDeadline('Gas', month, year, daysFromToday(-3)); // overdue

    // A handful of apartments still owe money for the current period;
    // everyone else is marked paid so they don't show up as notifications.
    const unpaid = new Set([
      periodKey('Agua', month, year) + '-101',
      periodKey('Agua', month, year) + '-401',
      periodKey('Luz', month, year) + '-201',
      periodKey('Gas', month, year) + '-202',
      periodKey('Gas', month, year) + '-302',
    ]);

    for (const apartment of APARTMENTS) {
      for (const service of SERVICES) {
        const key = periodKey(service, month, year) + '-' + apartment.number;
        this.setPaid(apartment.number, service, month, year, !unpaid.has(key));
      }
    }
  }
}
