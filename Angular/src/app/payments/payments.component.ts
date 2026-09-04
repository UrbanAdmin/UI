import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { BehaviorSubject, Observable, switchMap, map } from 'rxjs';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationStatus, OwnerPayment, ServiceName } from '../notifications/notification.model';
import { MONTH_NAMES } from '../notifications/month-names';

type OwnerRow = OwnerPayment & { status: NotificationStatus };

interface Period {
  service: ServiceName;
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
  readonly services: ServiceName[] = ['Agua', 'Luz', 'Gas'];
  readonly monthNames: string[] = MONTH_NAMES;
  readonly years: number[];
  readonly displayedColumns: string[] = ['apartment', 'owner', 'status', 'paid'];

  selectedService: ServiceName = 'Agua';
  selectedMonth: number;
  selectedYear: number;

  private readonly period$: BehaviorSubject<Period>;
  readonly deadline$: Observable<Date | null>;
  readonly rows$: Observable<OwnerRow[]>;

  constructor(private notificationsService: NotificationsService) {
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
      switchMap((p) => this.notificationsService.getDeadline(p.service, p.month, p.year)),
      map((deadline) => deadline?.dueDate ?? null),
    );

    this.rows$ = this.period$.pipe(
      switchMap((p) => this.notificationsService.getOwnerPayments(p.service, p.month, p.year)),
    );
  }

  onPeriodChange(): void {
    this.period$.next({ service: this.selectedService, month: this.selectedMonth, year: this.selectedYear });
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
