import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { forkJoin } from 'rxjs';
import { Apartment } from '../shared/apartment.model';
import { ApartmentsService } from '../shared/apartments.service';
import { AuthService } from '../auth.service';
import { LoadingService } from '../loading.service';
import { CopCurrencyPipe } from '../shared/cop-currency.pipe';
import { EsNumberPipe } from '../shared/es-number.pipe';
import { formatEsDecimal, parseEsDecimal } from '../shared/es-number';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingIndicatorComponent } from '../shared/loading-indicator/loading-indicator.component';
import { WaterBillingService } from './water-billing.service';
import { WaterBillPeriodDto, WaterMeterReadingDto, WaterBillDto, WaterBillWrite } from './water-billing.model';

function emptyBillDraft(): Required<WaterBillWrite> {
  return {
    totalValue: null, totalM3: null, fixedAqueduct: null, fixedSewer: null,
    basicResidentialAqueduct: null, superiorResidentialAqueduct: null,
    basicResidentialSewer: null, superiorResidentialSewer: null,
    startDate: null, endDate: null,
  };
}

/** The server serializes DateTime as full ISO-8601 ("2026-09-20T00:00:00"), but a native
 *  <input type="date"> silently blanks itself unless given exactly "YYYY-MM-DD" - every date-bound
 *  field in this component goes through this before reaching an ngModel-bound date input. */
function toDateInputValue(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}

const ZONA_COMUN_LABEL = 'Zona Común';

interface WaterReadingRow {
  apartmentId: number | null; // null = Zona Común
  label: string;
  status: 'Arrendado' | 'No arrendado' | null;
  reading: WaterMeterReadingDto | null;
  // editable, local until saved
  previousReading: string | null;
  currentReading: string | null;
  readingDate: string | null;
}

/** Water's guided allocation flow, embedded inside AguaBillingComponent in place of the generic
 *  receipt-card/reading-table pair. Unlike the pre-revision shape, this component owns its own
 *  period list/creation/editing directly (FR-042, FR-046, FR-047, research.md §11) - a period IS a
 *  WaterBill row now, so there is no "period without a bill yet" state to bridge; AguaBillingComponent
 *  no longer resolves or passes down a period at all. */
@Component({
  selector: 'app-water-billing',
  standalone: true,
  templateUrl: './water-billing.component.html',
  styleUrl: './water-billing.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTableModule,
    CopCurrencyPipe,
    EsNumberPipe,
    EmptyStateComponent,
    LoadingIndicatorComponent,
  ],
})
export class WaterBillingComponent {
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly authService = inject(AuthService);
  private readonly waterBillingService = inject(WaterBillingService);
  protected readonly loadingService = inject(LoadingService);

  readonly isReadOnly = this.authService.isApartmentOwner();
  readonly displayedColumns = this.isReadOnly
    ? ['apartamento', 'lecturaAnterior', 'lecturaActual', 'consumo', 'porcentaje', 'total']
    : ['apartamento', 'lecturaAnterior', 'lecturaActual', 'fechaLectura', 'consumo', 'porcentaje', 'valorAcueducto',
        'valorAlcantarillado', 'cargoFijo', 'costoNoArrendados', 'costoZonaComun', 'total', 'comentario'];

  /** FR-047: the period list is the entry point - 'detail' is the existing guided-flow content for
   *  whichever period is open. */
  view: 'list' | 'detail' = 'list';
  periods: WaterBillPeriodDto[] = [];
  nextSuggestedStartDate: string | null = null;

  showNewPeriodForm = false;
  newPeriodStart: string | null = null;
  newPeriodEnd: string | null = null;
  newPeriodError: string | null = null;

  selectedBillId: number | null = null;
  bill: WaterBillDto | null = null;
  // Always a plain, non-null object so the bill-info inputs can bind even before the first load
  // resolves - synced from `bill` on every reload.
  billDraft: Required<WaterBillWrite> = emptyBillDraft();
  // FR-044: the period's own dates, editable on the detail view until the bill is confirmed.
  periodStartDraft: string | null = null;
  periodEndDraft: string | null = null;
  periodDateError: string | null = null;

  rows: WaterReadingRow[] = [];
  confirmMessage: string | null = null;
  confirmSucceeded = false;
  newCommentText = '';

  /** FR-038: Confirm stays disabled while any row has a validation error - named individually so
   *  the admin knows exactly which meter(s) need attention. */
  get blockedMeterLabels(): string[] {
    return this.rows.filter((r) => r.reading?.validationError).map((r) => r.label);
  }

  /** FR-014/FR-038: zero Arrendado apartments is a distinct, critical block - checked among the
   *  real apartments only (Zona Común's own null status never counts). */
  get hasZeroArrendado(): boolean {
    return !this.isReadOnly && !this.rows.some((r) => r.status === 'Arrendado');
  }

  get hasBlockingErrors(): boolean {
    return this.blockedMeterLabels.length > 0 || this.hasZeroArrendado;
  }

  get showMismatchWarning(): boolean {
    return !this.isReadOnly && this.bill !== null && !this.bill.meterVsBillPasses;
  }

  constructor() {
    this.loadPeriods();
  }

  private loadPeriods(): void {
    this.waterBillingService.listPeriods().subscribe((list) => {
      this.periods = list.periods.map((p) => ({
        ...p,
        startDate: toDateInputValue(p.startDate)!,
        endDate: toDateInputValue(p.endDate)!,
      }));
      this.nextSuggestedStartDate = toDateInputValue(list.nextSuggestedStartDate);
    });
  }

  openPeriod(id: number): void {
    this.selectedBillId = id;
    this.view = 'detail';
    this.confirmMessage = null;
    this.reload();
  }

  backToPeriods(): void {
    this.view = 'list';
    this.selectedBillId = null;
    this.bill = null;
    this.rows = [];
    this.loadPeriods();
  }

  toggleNewPeriodForm(): void {
    this.showNewPeriodForm = !this.showNewPeriodForm;
    this.newPeriodStart = toDateInputValue(this.nextSuggestedStartDate);
    this.newPeriodEnd = null;
    this.newPeriodError = null;
  }

  /** FR-043: the start date is pre-filled from the server's suggestion, but the admin can change it -
   *  the server re-validates contiguity on submit either way. */
  createPeriod(): void {
    if (!this.newPeriodStart || !this.newPeriodEnd) {
      return;
    }
    this.newPeriodError = null;
    this.waterBillingService.createPeriod(this.newPeriodStart, this.newPeriodEnd).subscribe({
      next: (id) => {
        this.showNewPeriodForm = false;
        this.openPeriod(id);
      },
      error: (err: HttpErrorResponse) => {
        this.newPeriodError = typeof err.error === 'string' ? err.error : 'No se pudo crear el periodo.';
      },
    });
  }

  /** FR-044/FR-050: rejected server-side (409/400) if the bill is confirmed or the edit would break
   *  contiguity with a neighboring period. */
  savePeriodDates(): void {
    if (!this.bill || this.bill.confirmed || !this.periodStartDraft || !this.periodEndDraft) {
      return;
    }
    this.periodDateError = null;
    this.waterBillingService
      .updateBill(this.bill.id, { startDate: this.periodStartDraft, endDate: this.periodEndDraft })
      .subscribe({
        next: () => this.reload(),
        error: (err: HttpErrorResponse) => {
          this.periodDateError = typeof err.error === 'string' ? err.error : 'No se pudo guardar la fecha.';
        },
      });
  }

  private reload(): void {
    if (this.selectedBillId === null) {
      return;
    }
    forkJoin([this.waterBillingService.getBill(this.selectedBillId), this.apartmentsService.getApartments()]).subscribe(
      ([bill, apartments]) => {
        this.bill = bill;
        this.billDraft = bill
          ? {
              totalValue: bill.totalValue,
              totalM3: bill.totalM3,
              fixedAqueduct: bill.fixedAqueduct,
              fixedSewer: bill.fixedSewer,
              basicResidentialAqueduct: bill.basicResidentialAqueduct,
              superiorResidentialAqueduct: bill.superiorResidentialAqueduct,
              basicResidentialSewer: bill.basicResidentialSewer,
              superiorResidentialSewer: bill.superiorResidentialSewer,
              startDate: bill.startDate,
              endDate: bill.endDate,
            }
          : emptyBillDraft();
        this.periodStartDraft = toDateInputValue(bill?.startDate ?? null);
        this.periodEndDraft = toDateInputValue(bill?.endDate ?? null);
        this.rows = this.buildRows(bill, apartments);
      },
    );
  }

  private buildRows(bill: WaterBillDto | null, apartments: Apartment[]): WaterReadingRow[] {
    if (this.isReadOnly) {
      // The server already scopes this to just the caller's own apartment (FR-034) - never Zona Común.
      return (bill?.readings ?? []).map((r) => this.toRow(r));
    }
    const apartmentRows = apartments.map((apartment) => {
      const reading = bill?.readings.find((r) => r.apartmentId === apartment.id) ?? null;
      return reading
        ? this.toRow(reading)
        : {
            apartmentId: apartment.id,
            label: apartment.number,
            status: apartment.status,
            reading: null,
            previousReading: null,
            currentReading: null,
            readingDate: null,
          };
    });
    const zonaComunReading = bill?.readings.find((r) => r.apartmentId === null) ?? null;
    const zonaComunRow: WaterReadingRow = zonaComunReading
      ? this.toRow(zonaComunReading)
      : { apartmentId: null, label: ZONA_COMUN_LABEL, status: null, reading: null, previousReading: null, currentReading: null, readingDate: null };
    return [...apartmentRows, zonaComunRow];
  }

  private toRow(reading: WaterMeterReadingDto): WaterReadingRow {
    return {
      apartmentId: reading.apartmentId,
      label: reading.label,
      status: reading.status,
      reading,
      // Stored values are plain invariant decimals ("516.425") - shown here in es-CO style
      // ("516,425") so the editable field round-trips correctly through parseEsDecimal on save.
      previousReading: formatEsDecimal(reading.previousReading) || null,
      currentReading: formatEsDecimal(reading.currentReading) || null,
      readingDate: toDateInputValue(reading.readingDate),
    };
  }

  /** FR-039: saves whatever the admin has entered so far - every bill-field edit persists
   *  immediately rather than waiting for a final submit. */
  saveBillFields(): void {
    if (!this.bill) {
      return;
    }
    const figures: WaterBillWrite = {
      totalValue: this.billDraft.totalValue,
      totalM3: this.billDraft.totalM3,
      fixedAqueduct: this.billDraft.fixedAqueduct,
      fixedSewer: this.billDraft.fixedSewer,
      basicResidentialAqueduct: this.billDraft.basicResidentialAqueduct,
      superiorResidentialAqueduct: this.billDraft.superiorResidentialAqueduct,
      basicResidentialSewer: this.billDraft.basicResidentialSewer,
      superiorResidentialSewer: this.billDraft.superiorResidentialSewer,
    };
    this.waterBillingService.updateBill(this.bill.id, figures).subscribe(() => this.reload());
  }

  saveReading(row: WaterReadingRow): void {
    if (!this.bill) {
      return;
    }
    const currentReading = parseEsDecimal(row.currentReading);
    const readingDate = row.readingDate;
    if (row.reading) {
      // PreviousReading is server-resolved (research.md §9) once a prior period has set it - but on
      // this meter's very first period, the row can already exist (e.g. CurrentReading saved first)
      // with PreviousReading still unset; it stays editable and re-sent until then (FR-006).
      const write = row.reading.previousReading === null
        ? { previousReading: parseEsDecimal(row.previousReading), currentReading, readingDate }
        : { currentReading, readingDate };
      this.waterBillingService.updateReading(row.reading.id, write).subscribe(() => this.reload());
      return;
    }
    const write = { previousReading: parseEsDecimal(row.previousReading), currentReading, readingDate };
    this.waterBillingService.createReading(this.bill.id, row.apartmentId, write).subscribe(() => this.reload());
  }

  /** FR-036: a comment on the bill overall (no meter tied to it). */
  addBillComment(): void {
    if (!this.bill || !this.newCommentText.trim()) {
      return;
    }
    const text = this.newCommentText;
    this.waterBillingService.addComment(this.bill.id, text, null).subscribe(() => {
      this.newCommentText = '';
      this.reload();
    });
  }

  /** FR-036: a comment tied to one meter's line, including Zona Común - prompts inline rather than
   *  a full dialog, since this is a short, occasional note. */
  addReadingComment(row: WaterReadingRow): void {
    if (!this.bill || !row.reading) {
      return;
    }
    const text = window.prompt(`Comentario para ${row.label}:`, '');
    if (!text || !text.trim()) {
      return;
    }
    this.waterBillingService.addComment(this.bill.id, text, row.reading.id).subscribe(() => this.reload());
  }

  confirm(): void {
    if (!this.bill) {
      return;
    }
    this.waterBillingService.confirmBill(this.bill.id).subscribe((result) => {
      this.confirmSucceeded = result.success;
      if (result.success) {
        this.confirmMessage = 'Factura confirmada.';
        this.reload();
      } else if (result.hasZeroArrendadoError) {
        this.confirmMessage = 'No hay apartamentos arrendados — no se puede confirmar la factura.';
      } else {
        this.confirmMessage = `No se puede confirmar: revisa ${result.blockedMeterLabels.join(', ')}.`;
      }
    });
  }
}
