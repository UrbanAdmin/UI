import { Component, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { Observable, map } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { NotificationStatus, ServicePayment } from './notification.model';
import { monthName } from './month-names';
import { LoadingService } from '../loading.service';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingIndicatorComponent } from '../shared/loading-indicator/loading-indicator.component';
import { StatusChipComponent } from '../shared/status-chip/status-chip.component';

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
  imports: [
    CommonModule,
    DatePipe,
    MatCardModule,
    MatTableModule,
    EmptyStateComponent,
    LoadingIndicatorComponent,
    StatusChipComponent,
  ],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css',
})
export class NotificationsComponent {
  protected readonly loadingService = inject(LoadingService);
  displayedColumns: string[] = ['service', 'dueDate', 'status'];
  readonly groups$: Observable<ApartmentGroup[]>;

  constructor(private notificationsService: NotificationsService) {
    this.groups$ = this.notificationsService
      .getActiveNotifications()
      .pipe(map((notifications) => this.groupByApartmentAndPeriod(notifications)));
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
