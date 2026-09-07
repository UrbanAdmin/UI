import { Component, ChangeDetectionStrategy, NgZone, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AddReadingDialogComponent } from '../add-reading-dialog/add-reading-dialog.component';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';

import { Observable, forkJoin, map, shareReplay } from 'rxjs';
import { Apartment } from '../shared/apartment.model';
import { ApartmentsService } from '../shared/apartments.service';
import { DatesService } from '../shared/dates.service';
import { UtilitiesService } from '../shared/utilities.service';
import { ServiceName } from '../notifications/notification.model';
import { MONTH_NAMES, monthName } from '../notifications/month-names';
import { ReadingsService } from '../readings/readings.service';
import { InvoicesService } from '../readings/invoices.service';
import { MeterReading } from '../readings/reading.model';
import { AuthService } from '../auth.service';
import { CopCurrencyPipe } from '../shared/cop-currency.pipe';
import { CopCurrencyInputDirective } from '../shared/cop-currency-input.directive';

type ReadingRow = MeterReading & { monthLabel: string };

@Component({
  selector: 'app-counter-utilities',
  standalone: true,
  templateUrl: './counter-utilities.component.html',
  styleUrls: ['./counter-utilities.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTabsModule,
    MatTableModule,
    CopCurrencyPipe,
    CopCurrencyInputDirective,
  ],
})
export class CounterUtilitiesComponent {
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly authService = inject(AuthService);
  private readonly utilitiesService = inject(UtilitiesService);
  private readonly datesService = inject(DatesService);
  private readonly invoicesService = inject(InvoicesService);
  private readonly ngZone = inject(NgZone);

  readonly apartments$: Observable<Apartment[]> = this.apartmentsService.getApartments();
  readonly services: ServiceName[] = ['Agua', 'Luz', 'Gas'];
  readonly isReadOnly = this.authService.isApartmentOwner();
  // Both admin and inquilino see each month's calculated share of the bill
  // (CounterUtility.Fee) - admin additionally gets the edit action.
  readonly displayedColumns: string[] = this.isReadOnly
    ? ['mes', 'lectura', 'evidencia', 'cantidadAPagar']
    : ['mes', 'lectura', 'evidencia', 'cantidadAPagar', 'acciones'];

  // Not per-apartment: Invoice.Total is one shared bill per (Servicio, Mes,
  // Año), split across every apartment's consumption server-side - shown
  // once here rather than repeated identically inside every apartment tab.
  readonly monthNames = MONTH_NAMES;
  readonly years: number[];
  selectedService: ServiceName = 'Agua';
  selectedReceiptMonth: number = new Date().getMonth() + 1;
  selectedReceiptYear: number = new Date().getFullYear();
  receiptTotal: string | null = null;
  receiptFile: File | null = null;
  receiptOcrLoading = false;
  // 100% denominator behind each row's proportionally-split Fee (see
  // Backend's RecalculateFeesForPeriodHandler) - shown so the admin can see
  // why a single apartment's Cantidad a pagar equals the full Total del
  // recibo whenever it's currently the only one with a recorded reading.
  consumoTotal: number | null = null;

  // getRows$ is called directly from the template on every apartment x
  // service tab, which re-evaluates on every change-detection cycle -
  // without memoizing the Observable per key, that would fire a fresh
  // HTTP request each time. shareReplay(1) additionally covers multiple
  // concurrent async-pipe subscriptions to the same cached Observable.
  private readonly rowsCache = new Map<string, Observable<ReadingRow[]>>();

  constructor(
    private dialog: MatDialog,
    private readingsService: ReadingsService,
  ) {
    this.years = Array.from({ length: 7 }, (_, i) => this.selectedReceiptYear - 1 + i);
    if (!this.isReadOnly) {
      this.loadExistingReceiptTotal();
    }
  }

  // Only the previous and current calendar month are shown - a full year of
  // mostly-empty rows was more noise than signal for a bill that's read and
  // paid month to month. In January, "previous" falls in the prior year, so
  // that month has to be fetched separately from a different getReadings() call.
  getRows$(apartment: Apartment, service: ServiceName): Observable<ReadingRow[]> {
    const key = `${apartment.id}|${service}`;
    let rows$ = this.rowsCache.get(key);
    if (!rows$) {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

      const current$ = this.readingsService.getReadings(apartment.id, service, currentYear);
      const previous$ =
        previousYear === currentYear ? current$ : this.readingsService.getReadings(apartment.id, service, previousYear);

      rows$ = forkJoin([previous$, current$]).pipe(
        map(([previousYearRows, currentYearRows]) =>
          [previousYearRows[previousMonth - 1], currentYearRows[currentMonth - 1]].map((reading) => ({
            ...reading,
            monthLabel: `${monthName(reading.month)} ${reading.year}`,
          })),
        ),
        shareReplay(1),
      );
      this.rowsCache.set(key, rows$);
    }
    return rows$;
  }

  onServiceChanged(): void {
    if (!this.isReadOnly) {
      this.loadExistingReceiptTotal();
    }
  }

  private invalidateRows(apartment: Apartment, service: ServiceName): void {
    this.rowsCache.delete(`${apartment.id}|${service}`);
  }

  openAddReadingDialog(apartment: Apartment, service: ServiceName, existing?: ReadingRow) {
    this.dialog
      .open(AddReadingDialogComponent, {
        width: '420px',
        maxHeight: '90vh',
        data: {
          apartmentId: apartment.id,
          apartment: apartment.number,
          owner: apartment.owner,
          service,
          month: existing?.month,
          year: existing?.year,
          counter: existing?.counter,
        },
      })
      .afterClosed()
      .subscribe((saved) => {
        // MatDialog emits afterClosed() from outside NgZone (its close
        // animation runs via runOutsideAngular), so invalidating the rows
        // cache here needs to explicitly re-enter the zone - otherwise no
        // change detection runs and the table's async pipe never
        // re-subscribes to pick up the fresh getRows$ call.
        if (saved) {
          this.ngZone.run(() => {
            this.invalidateRows(apartment, service);
            // A new/edited reading shifts every apartment's consumption
            // share for this period - refresh Consumo total (and Total del
            // recibo, in case it's the currently-selected Servicio/Mes/Año).
            if (!this.isReadOnly) {
              this.loadExistingReceiptTotal();
            }
          });
        }
      });
  }

  onReceiptPeriodChanged(): void {
    this.loadExistingReceiptTotal();
  }

  /** Pre-fills "Total del recibo" with whatever is already saved for the
   *  selected Servicio/Mes/Año, so switching back to (or reopening) a period
   *  that was already billed doesn't show a misleading blank field. */
  private loadExistingReceiptTotal(): void {
    forkJoin([this.utilitiesService.getUtilities(), this.datesService.getDates()]).subscribe(([utilities, dates]) => {
      const utility = utilities.find((u) => u.name === this.selectedService);
      const date = dates.find(
        (d) => d.month === this.monthNames[this.selectedReceiptMonth - 1] && d.year === String(this.selectedReceiptYear),
      );
      if (!utility || !date) {
        this.receiptTotal = null;
        this.consumoTotal = null;
        return;
      }

      this.invoicesService.findInvoice(utility.id, date.id).subscribe((invoice) => {
        this.receiptTotal = invoice?.total || null;
      });
      this.readingsService.getTotalDifference(utility.id, date.id).subscribe((total) => {
        this.consumoTotal = total > 0 ? total : null;
      });
    });
  }

  onReceiptFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.receiptFile = file;
    if (!file) {
      return;
    }

    this.receiptOcrLoading = true;
    this.invoicesService.ocrPreviewTotal(file).subscribe({
      next: (result) => {
        this.receiptOcrLoading = false;
        if (result.suggestedTotal) {
          this.receiptTotal = result.suggestedTotal;
        }
      },
      error: () => (this.receiptOcrLoading = false),
    });
  }

  saveReceiptTotal(): void {
    const total = this.receiptTotal;
    if (!total) {
      return;
    }

    forkJoin([
      this.utilitiesService.getOrCreateUtility(this.selectedService),
      this.datesService.getOrCreateDate(this.selectedReceiptMonth, this.selectedReceiptYear),
    ]).subscribe(([utility, date]) => {
      this.invoicesService.setTotal(utility.id, date.id, total).subscribe((invoiceId) => {
        if (this.receiptFile) {
          this.invoicesService.uploadReceipt(invoiceId, this.receiptFile).subscribe(() => (this.receiptFile = null));
        }
      });
    });
  }
}
