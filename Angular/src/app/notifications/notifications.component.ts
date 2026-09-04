import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { NotificationsService } from './notifications.service';
import { NotificationStatus, ServicePayment } from './notification.model';
import { monthName } from './month-names';

type ActiveNotification = ServicePayment & { status: NotificationStatus; month: number; year: number };

interface PeriodGroup {
  month: number;
  year: number;
  monthLabel: string;
  items: ActiveNotification[];
}

interface ApartmentGroup {
  apartment: string;
  owner: string;
  periods: PeriodGroup[];
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [DatePipe, MatCardModule, MatChipsModule, MatTableModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css',
})
export class NotificationsComponent {
  displayedColumns: string[] = ['service', 'dueDate', 'status'];
  groups: ApartmentGroup[];

  constructor(private notificationsService: NotificationsService) {
    this.groups = this.groupByApartmentAndPeriod(this.notificationsService.getActiveNotifications());
  }

  statusLabel(status: NotificationStatus): string {
    switch (status) {
      case 'due-soon':
        return 'Vence en 2 días';
      case 'due-today':
        return 'Vence hoy';
      case 'overdue':
        return 'Vencido';
      default:
        return status;
    }
  }

  private groupByApartmentAndPeriod(notifications: ActiveNotification[]): ApartmentGroup[] {
    const byApartment = new Map<string, ApartmentGroup>();

    for (const notification of notifications) {
      let apartmentGroup = byApartment.get(notification.apartment);
      if (!apartmentGroup) {
        apartmentGroup = { apartment: notification.apartment, owner: notification.owner, periods: [] };
        byApartment.set(notification.apartment, apartmentGroup);
      }

      let periodGroup = apartmentGroup.periods.find(
        (p) => p.month === notification.month && p.year === notification.year,
      );
      if (!periodGroup) {
        periodGroup = {
          month: notification.month,
          year: notification.year,
          monthLabel: monthName(notification.month),
          items: [],
        };
        apartmentGroup.periods.push(periodGroup);
      }

      periodGroup.items.push(notification);
    }

    return Array.from(byApartment.values());
  }
}
