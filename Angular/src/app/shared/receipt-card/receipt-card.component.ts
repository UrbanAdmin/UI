import { Component, ChangeDetectionStrategy, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { forkJoin } from 'rxjs';
import { CopCurrencyInputDirective } from '../cop-currency-input.directive';
import { DatesService } from '../dates.service';
import { UtilitiesService } from '../utilities.service';
import { ServiceName } from '../service-name';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';
import { MONTH_NAMES } from '../../notifications/month-names';
import { InvoicesService } from '../../readings/invoices.service';
import { ReadingsService } from '../../readings/readings.service';

/** One service's "Total del recibo" entry point: the shared bill total,
 *  receipt upload/OCR, and the Consumo total denominator - agnostic about
 *  how [month]/[year] were chosen (a plain Mes/Año pair or an Agua billing
 *  period), so it serves Luz today and any future non-bimonthly service the
 *  same way. Reloads whenever service/month/year change. */
@Component({
  selector: 'app-receipt-card',
  standalone: true,
  templateUrl: './receipt-card.component.html',
  styleUrl: './receipt-card.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, CopCurrencyInputDirective, LoadingIndicatorComponent],
})
export class ReceiptCardComponent {
  readonly service = input.required<ServiceName>();
  readonly month = input.required<number>();
  readonly year = input.required<number>();

  private readonly utilitiesService = inject(UtilitiesService);
  private readonly datesService = inject(DatesService);
  private readonly invoicesService = inject(InvoicesService);
  private readonly readingsService = inject(ReadingsService);

  readonly monthNames = MONTH_NAMES;

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

  constructor() {
    // Reads all three signals so the effect re-runs on any of them changing -
    // whoever drives [month]/[year] (a plain Mes/Año pair, or Agua's period
    // dropdown) doesn't need to call anything here itself.
    effect(() => {
      this.service();
      this.month();
      this.year();
      this.loadExistingReceiptTotal();
    });
  }

  /** Called by the parent (via a template reference variable) when a
   *  sibling ReadingTableComponent reports a reading was saved - Consumo
   *  total shifts with every apartment's consumption, so it can't just wait
   *  for service/month/year to change. */
  reload(): void {
    this.loadExistingReceiptTotal();
  }

  /** Pre-fills "Total del recibo" with whatever is already saved for the
   *  selected Servicio/Mes/Año, so switching back to (or reopening) a period
   *  that was already billed doesn't show a misleading blank field. */
  private loadExistingReceiptTotal(): void {
    forkJoin([this.utilitiesService.getUtilities(), this.datesService.getDates()]).subscribe(([utilities, dates]) => {
      const utility = utilities.find((u) => u.name === this.service());
      const date = dates.find(
        (d) => d.month === this.monthNames[this.month() - 1] && d.year === String(this.year()),
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
      this.utilitiesService.getOrCreateUtility(this.service()),
      this.datesService.getOrCreateDate(this.month(), this.year()),
    ]).subscribe(([utility, date]) => {
      this.invoicesService.setTotal(utility.id, date.id, total).subscribe((invoiceId) => {
        if (this.receiptFile) {
          this.invoicesService.uploadReceipt(invoiceId, this.receiptFile).subscribe(() => (this.receiptFile = null));
        }
      });
    });
  }
}
