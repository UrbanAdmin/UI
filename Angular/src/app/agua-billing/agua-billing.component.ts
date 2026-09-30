import { Component, ChangeDetectionStrategy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { forkJoin } from 'rxjs';
import { BillingPeriod } from '../billing-periods/billing-period.model';
import { BillingPeriodsService } from '../billing-periods/billing-periods.service';
import { UtilitiesService } from '../shared/utilities.service';
import { ReceiptCardComponent } from '../shared/receipt-card/receipt-card.component';
import { ReadingTableComponent } from '../shared/reading-table/reading-table.component';
import { AguaCycleDialogComponent } from '../agua-cycle-dialog/agua-cycle-dialog.component';
import { AuthService } from '../auth.service';

/** Agua's own seam in Lecturas, mirroring GasBillingComponent's shape: the
 *  period selector and cycle-start dialog are Agua-specific, so they live
 *  here; the reading table and the receipt-total/file-upload UI are
 *  identical to Luz's, so this composes the same two shared modules Luz's
 *  path in CounterUtilitiesComponent also composes, rather than owning its
 *  own copy of either. */
@Component({
  selector: 'app-agua-billing',
  standalone: true,
  templateUrl: './agua-billing.component.html',
  styleUrl: './agua-billing.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatIconModule, MatSelectModule, ReceiptCardComponent, ReadingTableComponent],
})
export class AguaBillingComponent {
  private readonly utilitiesService = inject(UtilitiesService);
  private readonly billingPeriodsService = inject(BillingPeriodsService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);

  @ViewChild(ReceiptCardComponent) private receiptCard?: ReceiptCardComponent;

  readonly isReadOnly = this.authService.isApartmentOwner();

  aguaPeriods: BillingPeriod[] = [];
  selectedAguaPeriodKey: string | null = null;
  selectedMonth: number = new Date().getMonth() + 1;
  selectedYear: number = new Date().getFullYear();

  constructor() {
    if (!this.isReadOnly) {
      this.loadAguaPeriods();
    }
  }

  periodKey(period: BillingPeriod): string {
    return `${period.anchorMonth}-${period.anchorYear}`;
  }

  onAguaPeriodChanged(): void {
    const period = this.aguaPeriods.find((p) => this.periodKey(p) === this.selectedAguaPeriodKey);
    if (!period) {
      return;
    }
    this.selectedMonth = period.anchorMonth;
    this.selectedYear = period.anchorYear;
  }

  /** Fetches Agua's computed billing periods (current + previous year, same
   *  span ReadingTableComponent's own getRows$ already covers) and defaults
   *  the selection to whichever period contains "today" - found by POSITION
   *  in the combined, chronologically-ordered list, not a fixed month
   *  index, since a period can be two calendar months wide. */
  private loadAguaPeriods(): void {
    this.utilitiesService.getOrCreateUtility('Agua').subscribe((utility) => {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      forkJoin([
        this.billingPeriodsService.getBillingPeriods(utility.id, currentYear - 1),
        this.billingPeriodsService.getBillingPeriods(utility.id, currentYear),
      ]).subscribe(([previousYearPeriods, currentYearPeriods]) => {
        this.aguaPeriods = [...previousYearPeriods, ...currentYearPeriods];

        let currentIndex = -1;
        for (let i = 0; i < this.aguaPeriods.length; i++) {
          const p = this.aguaPeriods[i];
          if (p.anchorYear < currentYear || (p.anchorYear === currentYear && p.anchorMonth <= currentMonth)) {
            currentIndex = i;
          }
        }
        const selected = this.aguaPeriods[currentIndex] ?? this.aguaPeriods[this.aguaPeriods.length - 1] ?? null;
        if (selected) {
          this.selectedAguaPeriodKey = this.periodKey(selected);
          this.selectedMonth = selected.anchorMonth;
          this.selectedYear = selected.anchorYear;
        }
      });
    });
  }

  /** 022-bimonthly-agua-billing (T017): the admin-only cycle-start setting,
   *  opened from a text link - see Mockups/agua-billing-cycle-setting. */
  openAguaCycleDialog(): void {
    this.utilitiesService.getOrCreateUtility('Agua').subscribe((utility) => {
      this.dialog
        .open(AguaCycleDialogComponent, { width: '420px', maxHeight: '90vh', data: { utilityId: utility.id } })
        .afterClosed()
        .subscribe((saved) => {
          // A new cycle reshapes which months are anchors -
          // BillingPeriodsService's own cache is already cleared by
          // setBillingCycle; this period dropdown just needs to re-read it.
          if (saved) {
            this.loadAguaPeriods();
          }
        });
    });
  }

  onReadingSaved(): void {
    this.receiptCard?.reload();
  }
}
