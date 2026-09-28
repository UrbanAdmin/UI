import { Component, ChangeDetectionStrategy, NgZone, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AddReadingDialogComponent } from '../add-reading-dialog/add-reading-dialog.component';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';

import { Observable, forkJoin, map, shareReplay } from 'rxjs';
import { Apartment } from '../shared/apartment.model';
import { ApartmentsService } from '../shared/apartments.service';
import { DatesService } from '../shared/dates.service';
import { UtilitiesService } from '../shared/utilities.service';
import { BillingPeriod, ServiceName } from '../notifications/notification.model';
import { MONTH_NAMES, monthName } from '../notifications/month-names';
import { NotificationsService } from '../notifications/notifications.service';
import { ReadingsService } from '../readings/readings.service';
import { InvoicesService } from '../readings/invoices.service';
import { MeterReading } from '../readings/reading.model';
import { AuthService } from '../auth.service';
import { CopCurrencyPipe } from '../shared/cop-currency.pipe';
import { CopCurrencyInputDirective } from '../shared/cop-currency-input.directive';
import { LoadingService } from '../loading.service';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingIndicatorComponent } from '../shared/loading-indicator/loading-indicator.component';
import { PageHeaderComponent } from '../shared/page-header/page-header.component';
import { GasBillingComponent } from '../gas-billing/gas-billing.component';
import { AguaCycleDialogComponent } from '../agua-cycle-dialog/agua-cycle-dialog.component';

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
    MatSelectModule,
    MatTabsModule,
    MatTableModule,
    CopCurrencyPipe,
    CopCurrencyInputDirective,
    EmptyStateComponent,
    LoadingIndicatorComponent,
    PageHeaderComponent,
    GasBillingComponent,
  ],
})
export class CounterUtilitiesComponent {
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly authService = inject(AuthService);
  private readonly utilitiesService = inject(UtilitiesService);
  private readonly notificationsService = inject(NotificationsService);
  private readonly datesService = inject(DatesService);
  private readonly invoicesService = inject(InvoicesService);
  private readonly ngZone = inject(NgZone);
  protected readonly loadingService = inject(LoadingService);

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
  // 022-bimonthly-agua-billing: for Agua, the Mes/Año pair above is driven by
  // picking one of these computed billing periods instead of a raw month -
  // selectedReceiptMonth/Year still hold the chosen period's ANCHOR month,
  // since every existing endpoint (Invoices, readings) already keys off that
  // anchor (research.md Decision 4) and needs no change here.
  aguaPeriods: BillingPeriod[] = [];
  selectedAguaPeriodKey: string | null = null;
  receiptTotal: string | null = null;
  receiptFile: File | null = null;
  receiptOcrLoading = false;
  readonly receiptOcrError = signal<string | null>(null);
  // 100% denominator behind each row's proportionally-split Fee (see
  // Backend's RecalculateFeesForPeriodHandler) - shown so the admin can see
  // why a single apartment's Cantidad a pagar equals the full Total del
  // recibo whenever it's currently the only one with a recorded reading.
  consumoTotal: number | null = null;

  get consumoTotalFormatted(): string {
    if (this.consumoTotal === null) {
      return 'Sin lecturas registradas';
    }
    return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(this.consumoTotal)} m³`;
  }

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
      this.refreshReceiptPeriod();
    }
  }

  /** Loads whatever the current Servicio needs to show a period selector:
   *  Agua's computed billing periods, or (for every other service) just the
   *  existing Total del recibo for the already-selected Mes/Año. */
  private refreshReceiptPeriod(): void {
    if (this.selectedService === 'Agua') {
      this.loadAguaPeriods();
    } else {
      this.loadExistingReceiptTotal();
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
    this.selectedReceiptMonth = period.anchorMonth;
    this.selectedReceiptYear = period.anchorYear;
    this.loadExistingReceiptTotal();
  }

  /** Fetches Agua's computed billing periods (current + previous year, same
   *  span getRows$ already covers) and defaults the selection to whichever
   *  period contains "today" - found by POSITION in the combined,
   *  chronologically-ordered list, not a fixed month index, since a period
   *  can be two calendar months wide (mirrors getRows$'s own lookup). */
  private loadAguaPeriods(): void {
    this.utilitiesService.getOrCreateUtility('Agua').subscribe((utility) => {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      forkJoin([
        this.notificationsService.getBillingPeriods(utility.id, currentYear - 1),
        this.notificationsService.getBillingPeriods(utility.id, currentYear),
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
          this.selectedReceiptMonth = selected.anchorMonth;
          this.selectedReceiptYear = selected.anchorYear;
        }
        this.loadExistingReceiptTotal();
      });
    });
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

      const current$ = this.readingsService.getReadings(apartment.id, service, currentYear);
      const previousYear$ = this.readingsService.getReadings(apartment.id, service, currentYear - 1);

      rows$ = forkJoin([previousYear$, current$]).pipe(
        map(([previousYearRows, currentYearRows]) => {
          // getReadings returns one row per billing period in chronological
          // order - for Agua with a cycle, a period can be 2 calendar months
          // wide, so "previous period" isn't reliably "last calendar month"
          // and can't be found by a fixed month-index anymore (FR-004). Find
          // the latest period whose anchor is at or before today by
          // POSITION in the combined, already-ordered list instead, and take
          // it plus the one right before it.
          const combined = [...previousYearRows, ...currentYearRows];
          let currentIndex = -1;
          for (let i = 0; i < combined.length; i++) {
            const r = combined[i];
            if (r.year < currentYear || (r.year === currentYear && r.month <= currentMonth)) {
              currentIndex = i;
            }
          }
          if (currentIndex === -1) {
            currentIndex = 0;
          }

          const selected = currentIndex > 0 ? [combined[currentIndex - 1], combined[currentIndex]] : [combined[currentIndex]];
          return selected.filter((reading): reading is (typeof combined)[number] => !!reading).map((reading) => ({
            ...reading,
            monthLabel: reading.periodLabel ?? `${monthName(reading.month)} ${reading.year}`,
          }));
        }),
        shareReplay(1),
      );
      this.rowsCache.set(key, rows$);
    }
    return rows$;
  }

  onServiceChanged(): void {
    if (!this.isReadOnly) {
      this.refreshReceiptPeriod();
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

  /** 022-bimonthly-agua-billing (T017): the admin-only cycle-start setting,
   *  opened from a text link below the Servicio pills - see
   *  Mockups/agua-billing-cycle-setting. */
  openAguaCycleDialog(): void {
    this.utilitiesService.getOrCreateUtility('Agua').subscribe((utility) => {
      this.dialog
        .open(AguaCycleDialogComponent, { width: '420px', maxHeight: '90vh', data: { utilityId: utility.id } })
        .afterClosed()
        .subscribe((saved) => {
          if (saved) {
            // A new cycle reshapes which months are anchors - every cached
            // row (and the notifications service's own billing-periods
            // cache, already cleared by setBillingCycle) must be refetched,
            // including the Recibo card's own period dropdown.
            this.ngZone.run(() => {
              this.rowsCache.clear();
              this.loadAguaPeriods();
            });
          }
        });
    });
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
    this.receiptOcrError.set(null);
    this.invoicesService.ocrPreviewTotal(file).subscribe({
      next: (result) => {
        this.receiptOcrLoading = false;
        if (result.suggestedTotal) {
          this.receiptTotal = result.suggestedTotal;
        }
      },
      error: () => {
        this.receiptOcrLoading = false;
        this.receiptOcrError.set('No se pudo leer el recibo automáticamente. Ingresa el total manualmente.');
      },
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
