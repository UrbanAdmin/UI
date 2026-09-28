import { Component, ChangeDetectionStrategy, Inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { NotificationsService } from '../notifications/notifications.service';
import { DatesService } from '../shared/dates.service';
import { MONTH_NAMES } from '../notifications/month-names';

export interface AguaCycleDialogData {
  utilityId: number;
}

@Component({
  selector: 'app-agua-cycle-dialog',
  standalone: true,
  templateUrl: './agua-cycle-dialog.component.html',
  styleUrls: ['./agua-cycle-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
})
export class AguaCycleDialogComponent {
  readonly monthNames = MONTH_NAMES;
  readonly years: number[];

  /** null until the initial GET resolves, then null forever if the utility
   *  has no configured cycle yet (still on the default one-month cycle). */
  currentCycleStartMonth: number | null = null;

  startMonth: number;
  fromMonth: number;
  fromYear: number;
  /** 1-31, optional (Clarifications, 2026-09-28): the real bill's cutoff
   *  day, for reference only - never affects which calendar month a
   *  reading/invoice belongs to (periods are still whole calendar months). */
  cutoffDay: number | null = null;
  saving = false;
  readonly errorMessage = signal<string | null>(null);

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AguaCycleDialogData,
    private dialogRef: MatDialogRef<AguaCycleDialogComponent>,
    private notificationsService: NotificationsService,
    private datesService: DatesService,
  ) {
    const now = new Date();
    this.fromMonth = now.getMonth() + 1;
    this.fromYear = now.getFullYear();
    this.startMonth = this.fromMonth;
    this.years = [now.getFullYear(), now.getFullYear() + 1];

    this.notificationsService.getBillingCycle(this.data.utilityId).subscribe((cycle) => {
      if (cycle) {
        this.currentCycleStartMonth = cycle.startMonth;
        this.startMonth = cycle.startMonth;
        this.cutoffDay = cycle.cutoffDay ?? null;
      }
    });
  }

  /** A change can only shape periods starting today or later - an
   *  already-recorded period never gets retroactively re-sliced
   *  (Clarifications, 2026-09-24). Mirrors the Backend's own check
   *  (CreateUtilityBillingCycleHandler) so the admin sees this before
   *  submitting, not only after a rejected request. */
  get isPast(): boolean {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    return this.fromYear < currentYear || (this.fromYear === currentYear && this.fromMonth < currentMonth);
  }

  save(): void {
    if (this.isPast) {
      return;
    }

    this.saving = true;
    this.errorMessage.set(null);
    // The Backend takes an already-resolved Date_Id, not a raw month/year
    // pair - find-or-create against /Dates first, the same pattern already
    // used for Deadlines/PaymentStatuses (notification.model.ts).
    this.datesService.getOrCreateDate(this.fromMonth, this.fromYear).subscribe({
      next: (date) => {
        this.notificationsService
          .setBillingCycle(this.data.utilityId, {
            periodLengthMonths: 2,
            startMonth: this.startMonth,
            effectiveFromDateId: date.id,
            cutoffDay: this.cutoffDay,
          })
          .subscribe({
            next: () => this.dialogRef.close(true),
            error: (err) => {
              this.saving = false;
              this.errorMessage.set(typeof err?.error === 'string' ? err.error : 'No se pudo guardar el ciclo.');
            },
          });
      },
      error: () => {
        this.saving = false;
        this.errorMessage.set('No se pudo guardar el ciclo.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
