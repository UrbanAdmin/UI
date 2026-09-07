import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
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
  ],
})
export class CounterUtilitiesComponent {
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly authService = inject(AuthService);
  private readonly utilitiesService = inject(UtilitiesService);
  private readonly datesService = inject(DatesService);
  private readonly invoicesService = inject(InvoicesService);

  readonly apartments$: Observable<Apartment[]> = this.apartmentsService.getApartments();
  readonly services: ServiceName[] = ['Agua', 'Luz', 'Gas'];
  readonly isReadOnly = this.authService.isApartmentOwner();
  // Inquilino sees what each reading translates into: its share of that
  // period's bill (CounterUtility.Fee). Admin edits raw readings here and
  // already sees the bill split elsewhere, so it stays off their view.
  readonly displayedColumns: string[] = this.isReadOnly
    ? ['mes', 'lectura', 'evidencia', 'valorAPagar']
    : ['mes', 'lectura', 'evidencia', 'acciones'];

  // Not per-apartment: Invoice.Total is one shared bill per (Servicio, Mes,
  // Año), split across every apartment's consumption server-side - shown
  // once here rather than repeated identically inside every apartment tab.
  readonly monthNames = MONTH_NAMES;
  readonly years: number[];
  selectedReceiptService: ServiceName = 'Agua';
  selectedReceiptMonth: number = new Date().getMonth() + 1;
  selectedReceiptYear: number = new Date().getFullYear();
  receiptTotal: string | null = null;
  receiptFile: File | null = null;
  receiptOcrLoading = false;

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

  getRows$(apartment: Apartment, service: ServiceName): Observable<ReadingRow[]> {
    const key = `${apartment.id}|${service}`;
    let rows$ = this.rowsCache.get(key);
    if (!rows$) {
      const year = new Date().getFullYear();
      rows$ = this.readingsService.getReadings(apartment.id, service, year).pipe(
        map((readings) => readings.map((reading) => ({ ...reading, monthLabel: monthName(reading.month) }))),
        shareReplay(1),
      );
      this.rowsCache.set(key, rows$);
    }
    return rows$;
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
          counter: existing?.counter,
        },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.invalidateRows(apartment, service);
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
      const utility = utilities.find((u) => u.name === this.selectedReceiptService);
      const date = dates.find(
        (d) => d.month === this.monthNames[this.selectedReceiptMonth - 1] && d.year === String(this.selectedReceiptYear),
      );
      if (!utility || !date) {
        this.receiptTotal = null;
        return;
      }

      this.invoicesService.findInvoice(utility.id, date.id).subscribe((invoice) => {
        this.receiptTotal = invoice?.total || null;
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
      this.utilitiesService.getOrCreateUtility(this.selectedReceiptService),
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
