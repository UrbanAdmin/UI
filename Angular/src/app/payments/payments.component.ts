import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { BehaviorSubject, Observable, forkJoin, switchMap, map, of } from 'rxjs';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationStatus, OwnerPayment, ServiceName } from '../notifications/notification.model';
import { MONTH_NAMES } from '../notifications/month-names';
import { AuthService } from '../auth.service';

type OwnerRow = OwnerPayment & { status: NotificationStatus };
type OwnerServiceRow = OwnerRow & { service: ServiceName };

interface Period {
  service: ServiceName;
  month: number;
  year: number;
}

interface MonthYear {
  month: number;
  year: number;
}

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTableModule,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './payments.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './payments.component.css',
})
export class PaymentsComponent {
  readonly services: ServiceName[] = ['Agua', 'Luz', 'Gas', 'Arriendo'];
  readonly monthNames: string[] = MONTH_NAMES;
  readonly years: number[];

  selectedService: ServiceName = 'Agua';
  selectedMonth: number;
  selectedYear: number;

  private readonly period$: BehaviorSubject<Period>;
  private readonly ownerPeriod$: BehaviorSubject<MonthYear>;
  readonly deadline$: Observable<Date | null>;
  readonly rows$: Observable<OwnerRow[]>;
  readonly isReadOnly: boolean;

  /** An arrendatario only ever sees their own apartment (server-scoped
   *  already), so instead of a Servicio filter they get every servicio's
   *  row on one page - grouped by an extra "Servicio" column. */
  readonly ownerServices: ServiceName[] = ['Agua', 'Luz', 'Gas', 'Arriendo'];
  readonly ownerDisplayedColumns: string[] = ['service', 'dueDate', 'status', 'amount', 'paid'];
  readonly ownerRows$: Observable<OwnerServiceRow[]>;

  constructor(
    private notificationsService: NotificationsService,
    private authService: AuthService,
  ) {
    this.isReadOnly = this.authService.isApartmentOwner();
    const now = new Date();
    this.selectedMonth = now.getMonth() + 1;
    this.selectedYear = now.getFullYear();
    this.years = Array.from({ length: 7 }, (_, i) => this.selectedYear - 1 + i);

    this.period$ = new BehaviorSubject<Period>({
      service: this.selectedService,
      month: this.selectedMonth,
      year: this.selectedYear,
    });

    this.deadline$ = this.period$.pipe(
      switchMap((p) =>
        p.service === 'Arriendo'
          ? of(null)
          : this.notificationsService.getDeadline(p.service, p.month, p.year).pipe(map((d) => d?.dueDate ?? null)),
      ),
    );

    this.rows$ = this.period$.pipe(
      switchMap((p) => this.notificationsService.getOwnerPayments(p.service, p.month, p.year)),
    );

    this.ownerPeriod$ = new BehaviorSubject<MonthYear>({ month: this.selectedMonth, year: this.selectedYear });

    this.ownerRows$ = this.ownerPeriod$.pipe(
      switchMap(({ month, year }) =>
        forkJoin(
          this.ownerServices.map((service) =>
            this.notificationsService
              .getOwnerPayments(service, month, year)
              .pipe(map((rows) => rows.map((row) => ({ ...row, service })))),
          ),
        ).pipe(map((groups) => groups.flat())),
      ),
    );
  }

  readonly displayedColumns: string[] = ['apartment', 'owner', 'dueDate', 'status', 'amount', 'paid'];

  onPeriodChange(): void {
    this.period$.next({ service: this.selectedService, month: this.selectedMonth, year: this.selectedYear });
    this.ownerPeriod$.next({ month: this.selectedMonth, year: this.selectedYear });
  }

  saveDeadline(newDate: Date): void {
    this.notificationsService
      .setDeadline(this.selectedService, this.selectedMonth, this.selectedYear, newDate)
      .subscribe(() => this.onPeriodChange());
  }

  togglePaid(row: OwnerRow, paid: boolean): void {
    this.notificationsService
      .setPaid(row.apartmentId, this.selectedService, this.selectedMonth, this.selectedYear, paid)
      .subscribe(() => this.onPeriodChange());
  }

  onTogglePaid(row: OwnerRow, event: MatSlideToggleChange): void {
    this.togglePaid(row, event.checked);
  }

  onAmountChange(row: OwnerRow, amount: string): void {
    this.notificationsService
      .setAmount(row.apartmentId, this.selectedService, this.selectedMonth, this.selectedYear, amount)
      .subscribe(() => this.onPeriodChange());
  }

  statusLabel(status: NotificationStatus): string {
    switch (status) {
      case 'paid':
        return 'Pagado';
      case 'due-soon':
        return 'Vence en 2 días';
      case 'due-today':
        return 'Vence hoy';
      case 'overdue':
        return 'Vencido';
      default:
        return 'No vence aún';
    }
  }
}
