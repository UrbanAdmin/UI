import { Component, Signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { Observable, map, shareReplay } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { NotificationStatus, ServicePayment } from './notification.model';
import { monthName } from './month-names';
import { LoadingService } from '../loading.service';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingIndicatorComponent } from '../shared/loading-indicator/loading-indicator.component';
import { StatusChipComponent } from '../shared/status-chip/status-chip.component';
import { PageHeaderComponent } from '../shared/page-header/page-header.component';

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
  worstStatus: NotificationStatus;
}

// Most urgent first - the badge shown at the top of each apartment card is
// the single most urgent status among that apartment's active items, so a
// "Vencido" item elsewhere in the card is never masked by a calmer "Pagado"
// or "No vence aún" row sitting above it.
const STATUS_SEVERITY: Record<NotificationStatus, number> = {
  overdue: 0,
  'due-today': 1,
  'due-soon': 2,
  'not-due': 3,
  paid: 4,
};

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
    PageHeaderComponent,
  ],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css',
})
export class NotificationsComponent {
  protected readonly loadingService = inject(LoadingService);
  displayedColumns: string[] = ['service', 'dueDate', 'status'];
  readonly groups$: Observable<ApartmentGroup[]>;
  private readonly groups: Signal<ApartmentGroup[]>;

  constructor(private notificationsService: NotificationsService) {
    // shareReplay(1): both the template's `async` pipe and the hint's
    // count/apartment signals below subscribe to this.
    this.groups$ = this.notificationsService
      .getActiveNotifications()
      .pipe(
        map((notifications) => this.groupByApartmentAndPeriod(notifications)),
        shareReplay(1),
      );
    this.groups = toSignal(this.groups$, { initialValue: [] as ApartmentGroup[] });
  }

  private readonly notificationCount = computed(() =>
    this.groups().reduce((sum, g) => sum + g.periods.reduce((s, p) => s + p.items.length, 0), 0),
  );
  private readonly apartmentCount = computed(() => this.groups().length);

  readonly hint = computed(() => {
    const notifications = this.notificationCount();
    const apartments = this.apartmentCount();
    return `${notifications} aviso${notifications === 1 ? '' : 's'} activo${notifications === 1 ? '' : 's'} en ${apartments} apartamento${apartments === 1 ? '' : 's'}.`;
  });

  private groupByApartmentAndPeriod(notifications: ActiveNotification[]): ApartmentGroup[] {
    const byApartment = new Map<string, ApartmentGroup>();

    for (const notification of notifications) {
      let apartmentGroup = byApartment.get(notification.apartment);
      if (!apartmentGroup) {
        apartmentGroup = {
          apartment: notification.apartment,
          owner: notification.owner,
          periods: [],
          worstStatus: notification.status,
        };
        byApartment.set(notification.apartment, apartmentGroup);
      } else if (STATUS_SEVERITY[notification.status] < STATUS_SEVERITY[apartmentGroup.worstStatus]) {
        apartmentGroup.worstStatus = notification.status;
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
