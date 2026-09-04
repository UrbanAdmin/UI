import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationStatus, OwnerPayment, ServiceName } from '../notifications/notification.model';
import { MONTH_NAMES } from '../notifications/month-names';

type OwnerRow = OwnerPayment & { status: NotificationStatus };

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTableModule,
  ],
  templateUrl: './payments.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './payments.component.css',
})
export class PaymentsComponent {
  readonly services: ServiceName[] = ['Agua', 'Luz', 'Gas'];
  readonly monthNames: string[] = MONTH_NAMES;
  readonly displayedColumns: string[] = ['apartment', 'owner', 'status', 'paid'];

  selectedService: ServiceName = 'Agua';
  selectedMonth: number;
  selectedYear: number;
  deadline: Date | null = null;
  rows: OwnerRow[] = [];

  constructor(private notificationsService: NotificationsService) {
    const now = new Date();
    this.selectedMonth = now.getMonth() + 1;
    this.selectedYear = now.getFullYear();
    this.reload();
  }

  onPeriodChange(): void {
    this.reload();
  }

  saveDeadline(newDate: Date): void {
    this.notificationsService.setDeadline(
      this.selectedService,
      this.selectedMonth,
      this.selectedYear,
      newDate,
    );
    this.reload();
  }

  /** Native <input type="date"> works with 'yyyy-MM-dd' strings, not Date objects. */
  get deadlineInputValue(): string {
    if (!this.deadline) {
      return '';
    }
    const y = this.deadline.getFullYear();
    const m = String(this.deadline.getMonth() + 1).padStart(2, '0');
    const d = String(this.deadline.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  onSaveDeadlineClick(value: string): void {
    if (!value) {
      return;
    }
    const [year, month, day] = value.split('-').map(Number);
    this.saveDeadline(new Date(year, month - 1, day));
  }

  togglePaid(row: OwnerRow, paid: boolean): void {
    this.notificationsService.setPaid(
      row.apartment,
      this.selectedService,
      this.selectedMonth,
      this.selectedYear,
      paid,
    );
    this.reload();
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

  private reload(): void {
    this.deadline =
      this.notificationsService.getDeadline(
        this.selectedService,
        this.selectedMonth,
        this.selectedYear,
      )?.dueDate ?? null;
    this.rows = this.notificationsService.getOwnerPayments(
      this.selectedService,
      this.selectedMonth,
      this.selectedYear,
    );
  }
}
