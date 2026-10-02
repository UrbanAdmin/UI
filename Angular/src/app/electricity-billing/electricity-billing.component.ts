import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { forkJoin } from 'rxjs';
import { Apartment } from '../shared/apartment.model';
import { ApartmentsService } from '../shared/apartments.service';
import { DatesService } from '../shared/dates.service';
import { AuthService } from '../auth.service';
import { MONTH_NAMES } from '../notifications/month-names';
import { LoadingService } from '../loading.service';
import { CopCurrencyPipe } from '../shared/cop-currency.pipe';
import { EsNumberPipe } from '../shared/es-number.pipe';
import { formatEsDecimal, parseEsDecimal } from '../shared/es-number';
import { LoadingIndicatorComponent } from '../shared/loading-indicator/loading-indicator.component';
import { TenantStatementComponent } from '../shared/tenant-statement/tenant-statement.component';
import { TenantStatement } from '../shared/tenant-statement/tenant-statement.model';
import { ElectricityBillingService } from './electricity-billing.service';
import { ElectricityBillDto, ElectricityBillWrite, ElectricityMeterReadingDto } from './electricity-billing.model';

function emptyBillDraft(): Required<ElectricityBillWrite> {
  return { totalConsumptionKwh: null, electricityConsumptionValue: null, aseoValue: null };
}

const ZONA_COMUN_LABEL = 'Zona Común';

interface ElectricityReadingRow {
  apartmentId: number | null; // null = Zona Común
  label: string;
  status: 'Arrendado' | 'No arrendado' | null;
  reading: ElectricityMeterReadingDto | null;
  // editable, local until saved
  previousReading: string | null;
  currentReading: string | null;
}

/** 030-electricity-utility-billing: Luz's guided allocation flow, embedded inside
 *  counter-utilities.component in place of the generic receipt-card/reading-table pair Luz alone
 *  still used before this feature (research.md §11, FR-041). No fixed charge exists for Luz
 *  (FR-003); Aseo is split only among Arrendado apartments, and No arrendado/Zona Común's own cost
 *  is redistributed - not zeroed out (research.md §1/§5/§8, mirrors WaterBillingComponent's
 *  redistribution shape more than GasBillingComponent's). */
@Component({
  selector: 'app-electricity-billing',
  standalone: true,
  templateUrl: './electricity-billing.component.html',
  styleUrl: './electricity-billing.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    CopCurrencyPipe,
    EsNumberPipe,
    LoadingIndicatorComponent,
    TenantStatementComponent,
  ],
})
export class ElectricityBillingComponent {
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly datesService = inject(DatesService);
  private readonly authService = inject(AuthService);
  private readonly electricityBillingService = inject(ElectricityBillingService);
  protected readonly loadingService = inject(LoadingService);

  readonly monthNames = MONTH_NAMES;
  readonly years: number[];
  readonly isReadOnly = this.authService.isApartmentOwner();
  readonly displayedColumns = [
    'apartamento', 'lecturaAnterior', 'lecturaActual', 'consumo', 'porcentaje',
    'costoElectrico', 'aseo', 'total', 'comentario',
  ];

  selectedMonth: number = new Date().getMonth() + 1;
  selectedYear: number = new Date().getFullYear();

  dateId: number | null = null;
  bill: ElectricityBillDto | null = null;
  // Always a plain, non-null object so the bill-info inputs can bind and be typed into before the
  // ElectricityBill row itself exists (FR-040) - synced from `bill` on every reload.
  billDraft: Required<ElectricityBillWrite> = emptyBillDraft();
  rows: ElectricityReadingRow[] = [];
  // Only consulted by tenantStatement - the admin table reads straight off `apartments` passed into
  // buildRows() instead, so this stays private rather than widening its scope.
  private apartments: Apartment[] = [];
  confirmMessage: string | null = null;
  confirmSucceeded = false;
  newCommentText = '';

  /** The tenant's own row, mapped to the shared statement view model - breakdown is intentionally
   *  omitted (FR-033): an owner sees only previous/current reading, consumption, percentage and the
   *  final amount, never the Aseo share or the redistributed-cost shares. The server already scopes
   *  `rows` to at most one entry for an ApartmentOwner (FR-034) and hides an unconfirmed bill from
   *  them entirely (FR-035). */
  get tenantStatement(): TenantStatement {
    const periodLabel = `${this.monthNames[this.selectedMonth - 1]} ${this.selectedYear}`;
    const reading = this.rows[0]?.reading ?? null;
    if (!reading) {
      return {
        state: 'empty',
        periodLabel,
        apartmentLine: '',
        unit: 'kWh',
        emptyMessage: `Aún no hay lectura de Luz para ${periodLabel}.`,
      };
    }

    const apartment = this.apartments.find((a) => a.id === reading.apartmentId);
    const apartmentLine = `Apto ${reading.label} · ${apartment?.owner ?? ''} · ${reading.status ?? ''}`;

    if (reading.finalAmount === null) {
      return {
        state: 'pending-receipt',
        periodLabel,
        apartmentLine,
        unit: 'kWh',
        previousReading: reading.previousReading ?? undefined,
        currentReading: reading.currentReading ?? undefined,
        consumption: reading.consumption ?? undefined,
      };
    }

    return {
      state: 'ready',
      periodLabel,
      apartmentLine,
      unit: 'kWh',
      previousReading: reading.previousReading ?? undefined,
      currentReading: reading.currentReading ?? undefined,
      consumption: reading.consumption ?? undefined,
      percentage: reading.consumptionPercentage ?? undefined,
      total: reading.finalAmount,
    };
  }

  /** FR-039: Confirm stays disabled while any row has a validation error - named individually so
   *  the admin knows exactly which meter(s) need attention. */
  get blockedMeterLabels(): string[] {
    return this.rows.filter((r) => r.reading?.validationError).map((r) => r.label);
  }

  /** FR-020/FR-039: zero Arrendado apartments is a distinct, critical block - checked among the
   *  real apartments only (Zona Común's own null status never counts). */
  get hasZeroArrendado(): boolean {
    return !this.isReadOnly && !this.rows.some((r) => r.status === 'Arrendado');
  }

  get hasBlockingErrors(): boolean {
    return this.blockedMeterLabels.length > 0 || this.hasZeroArrendado;
  }

  constructor() {
    this.years = Array.from({ length: 7 }, (_, i) => this.selectedYear - 1 + i);
    this.loadPeriod();
  }

  onPeriodChanged(): void {
    this.loadPeriod();
  }

  private loadPeriod(): void {
    this.confirmMessage = null;
    this.datesService.getOrCreateDate(this.selectedMonth, this.selectedYear).subscribe((date) => {
      this.dateId = date.id;
      this.reload();
    });
  }

  private reload(): void {
    if (this.dateId === null) {
      return;
    }
    forkJoin([this.electricityBillingService.getBill(this.dateId), this.apartmentsService.getApartments()]).subscribe(
      ([bill, apartments]) => {
        this.bill = bill;
        this.apartments = apartments;
        this.billDraft = bill
          ? {
              totalConsumptionKwh: bill.totalConsumptionKwh,
              electricityConsumptionValue: bill.electricityConsumptionValue,
              aseoValue: bill.aseoValue,
            }
          : emptyBillDraft();
        this.rows = this.buildRows(bill, apartments);
      },
    );
  }

  private buildRows(bill: ElectricityBillDto | null, apartments: Apartment[]): ElectricityReadingRow[] {
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
          };
    });
    const zonaComunReading = bill?.readings.find((r) => r.apartmentId === null) ?? null;
    const zonaComunRow: ElectricityReadingRow = zonaComunReading
      ? this.toRow(zonaComunReading)
      : { apartmentId: null, label: ZONA_COMUN_LABEL, status: null, reading: null, previousReading: null, currentReading: null };
    return [...apartmentRows, zonaComunRow];
  }

  private toRow(reading: ElectricityMeterReadingDto): ElectricityReadingRow {
    return {
      apartmentId: reading.apartmentId,
      label: reading.label,
      status: reading.status,
      reading,
      // Stored values are plain invariant decimals ("4532.5") - shown here in es-CO style
      // ("4532,5") so the editable field round-trips correctly through parseEsDecimal on save.
      previousReading: formatEsDecimal(reading.previousReading) || null,
      currentReading: formatEsDecimal(reading.currentReading) || null,
    };
  }

  /** FR-040: saves whatever the admin has entered so far - every bill-field edit persists
   *  immediately rather than waiting for a final submit. */
  saveBillFields(): void {
    if (this.dateId === null) {
      return;
    }
    const write = this.billDraft;
    if (this.bill) {
      this.electricityBillingService.updateBill(this.bill.id, write).subscribe(() => this.reload());
    } else {
      this.electricityBillingService.createBill(this.dateId, write).subscribe(() => this.reload());
    }
  }

  saveReading(row: ElectricityReadingRow): void {
    if (this.dateId === null) {
      return;
    }
    // The field holds whatever the admin typed in es-CO style (or the display-formatted stored
    // value, from toRow()) - parseEsDecimal turns "4532,5"/"1.520" back into the plain invariant
    // decimal the backend expects ("4532.5"/"1520").
    const currentReading = parseEsDecimal(row.currentReading);
    if (row.reading) {
      // PreviousReading is server-resolved (research.md §3) once a prior period has set it - but on
      // this meter's very first period, the row can already exist (e.g. CurrentReading saved first)
      // with PreviousReading still unset; it stays editable and re-sent until then (FR-007).
      const write = row.reading.previousReading === null
        ? { previousReading: parseEsDecimal(row.previousReading), currentReading }
        : { currentReading };
      this.electricityBillingService.updateReading(row.reading.id, write).subscribe(() => this.reload());
      return;
    }
    const write = { previousReading: parseEsDecimal(row.previousReading), currentReading };
    if (!this.bill) {
      // The bill itself doesn't exist yet - create it (with no totals filled in) so the reading has
      // somewhere to attach; the admin can fill in the bill's own fields in any order (FR-040).
      this.electricityBillingService.createBill(this.dateId, {}).subscribe((billId) => {
        this.electricityBillingService.createReading(billId, row.apartmentId, write).subscribe(() => this.reload());
      });
    } else {
      this.electricityBillingService.createReading(this.bill.id, row.apartmentId, write).subscribe(() => this.reload());
    }
  }

  /** FR-037: a comment on the bill overall (no meter tied to it). */
  addBillComment(): void {
    if (this.dateId === null || !this.newCommentText.trim()) {
      return;
    }
    const text = this.newCommentText;
    if (this.bill) {
      this.electricityBillingService.addComment(this.bill.id, text, null).subscribe(() => {
        this.newCommentText = '';
        this.reload();
      });
    } else {
      // No bill saved yet - create it first (empty totals) so the comment has somewhere to attach.
      this.electricityBillingService.createBill(this.dateId, {}).subscribe((billId) => {
        this.electricityBillingService.addComment(billId, text, null).subscribe(() => {
          this.newCommentText = '';
          this.reload();
        });
      });
    }
  }

  /** FR-037: a comment tied to one meter's line, including Zona Común - prompts inline rather than
   *  a full dialog, since this is a short, occasional note. */
  addReadingComment(row: ElectricityReadingRow): void {
    if (!this.bill || !row.reading) {
      return;
    }
    const text = window.prompt(`Comentario para ${row.label}:`, '');
    if (!text || !text.trim()) {
      return;
    }
    this.electricityBillingService.addComment(this.bill.id, text, row.reading.id).subscribe(() => this.reload());
  }

  confirm(): void {
    if (!this.bill) {
      return;
    }
    this.electricityBillingService.confirmBill(this.bill.id).subscribe((result) => {
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
