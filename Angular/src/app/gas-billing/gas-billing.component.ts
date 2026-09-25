import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
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
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingIndicatorComponent } from '../shared/loading-indicator/loading-indicator.component';
import { GasBillingService } from './gas-billing.service';
import { GasApartmentReadingDto, GasBillDto, GasBillWrite } from './gas-billing.model';

function emptyBillDraft(): Required<GasBillWrite> {
  return {
    totalConsumption: null, unitPrice: null, consumoGasSubtotal: null,
    fixedCharge: null, otherConcepts: null, ajusteDecena: null, totalAmount: null,
  };
}

interface GasReadingRow {
  apartmentId: number;
  apartmentNumber: string;
  status: 'Arrendado' | 'No arrendado';
  reading: GasApartmentReadingDto | null;
  // editable, local until saved
  isNewTenant: boolean;
  initialReading: string | null;
  currentReading: string | null;
}

@Component({
  selector: 'app-gas-billing',
  standalone: true,
  templateUrl: './gas-billing.component.html',
  styleUrls: ['./gas-billing.component.css'],
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    CopCurrencyPipe,
    EmptyStateComponent,
    LoadingIndicatorComponent,
  ],
})
export class GasBillingComponent {
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly datesService = inject(DatesService);
  private readonly authService = inject(AuthService);
  private readonly gasBillingService = inject(GasBillingService);
  protected readonly loadingService = inject(LoadingService);

  readonly monthNames = MONTH_NAMES;
  readonly years: number[];
  readonly isReadOnly = this.authService.isApartmentOwner();
  readonly displayedColumns = [
    'apartamento', 'nuevoInquilino', 'lecturaAnterior', 'lecturaActual',
    'consumo', 'porcentaje', 'costoVariable', 'cargoFijo', 'total', 'comentario',
  ];

  selectedMonth: number = new Date().getMonth() + 1;
  selectedYear: number = new Date().getFullYear();

  dateId: number | null = null;
  bill: GasBillDto | null = null;
  // Always a plain, non-null object so the bill-info inputs can bind and be typed into before the
  // GasBill row itself exists (FR-031a) - synced from `bill` on every reload.
  billDraft: Required<GasBillWrite> = emptyBillDraft();
  rows: GasReadingRow[] = [];
  confirmMessage: string | null = null;
  confirmSucceeded = false;
  newCommentText = '';

  /** FR-031: Confirm stays disabled while any row has a validation error - named individually so
   *  the admin knows exactly which apartment(s) need attention before trying to confirm at all. */
  get blockedApartmentNumbers(): string[] {
    return this.rows.filter((r) => r.reading?.validationError).map((r) => r.apartmentNumber);
  }

  get hasBlockingErrors(): boolean {
    return this.blockedApartmentNumbers.length > 0;
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
    forkJoin([this.gasBillingService.getBill(this.dateId), this.apartmentsService.getApartments()]).subscribe(
      ([bill, apartments]) => {
        this.bill = bill;
        this.billDraft = bill
          ? {
              totalConsumption: bill.totalConsumption,
              unitPrice: bill.unitPrice,
              consumoGasSubtotal: bill.consumoGasSubtotal,
              fixedCharge: bill.fixedCharge,
              otherConcepts: bill.otherConcepts,
              ajusteDecena: bill.ajusteDecena,
              totalAmount: bill.totalAmount,
            }
          : emptyBillDraft();
        this.rows = this.buildRows(bill, apartments);
      },
    );
  }

  private buildRows(bill: GasBillDto | null, apartments: Apartment[]): GasReadingRow[] {
    if (this.isReadOnly) {
      // The server already scopes this to just the caller's own apartment (FR-028b).
      return (bill?.readings ?? []).map((r) => this.toRow(r));
    }
    return apartments.map((apartment) => {
      const reading = bill?.readings.find((r) => r.apartmentId === apartment.id) ?? null;
      return reading
        ? this.toRow(reading)
        : {
            apartmentId: apartment.id,
            apartmentNumber: apartment.number,
            status: apartment.status,
            reading: null,
            isNewTenant: false,
            initialReading: null,
            currentReading: null,
          };
    });
  }

  private toRow(reading: GasApartmentReadingDto): GasReadingRow {
    return {
      apartmentId: reading.apartmentId,
      apartmentNumber: reading.apartmentNumber,
      status: reading.status,
      reading,
      isNewTenant: reading.isNewTenant,
      initialReading: reading.initialReading,
      currentReading: reading.currentReading,
    };
  }

  /** FR-031a: saves whatever the admin has entered so far - every bill-field edit persists
   *  immediately rather than waiting for a final submit. */
  saveBillFields(): void {
    if (this.dateId === null) {
      return;
    }
    const write = this.billDraft;
    if (this.bill) {
      this.gasBillingService.updateBill(this.bill.id, write).subscribe(() => this.reload());
    } else {
      this.gasBillingService.createBill(this.dateId, write).subscribe(() => this.reload());
    }
  }

  saveReading(row: GasReadingRow): void {
    if (this.dateId === null) {
      return;
    }
    const write = {
      isNewTenant: row.isNewTenant,
      initialReading: row.initialReading,
      currentReading: row.currentReading,
    };
    if (row.reading) {
      this.gasBillingService.updateReading(row.reading.id, write).subscribe(() => this.reload());
    } else if (!this.bill) {
      // The bill itself doesn't exist yet - create it (with no totals filled in) so the reading has
      // somewhere to attach; the admin can fill in the bill's own fields in any order (FR-031a).
      this.gasBillingService.createBill(this.dateId, {}).subscribe((billId) => {
        this.gasBillingService.createReading(billId, row.apartmentId, write).subscribe(() => this.reload());
      });
    } else {
      this.gasBillingService.createReading(this.bill.id, row.apartmentId, write).subscribe(() => this.reload());
    }
  }

  /** FR-007: swaps the read-only "previous reading" for an editable "initial reading," defaulting
   *  it from the previous reading as a starting point the admin can then correct. */
  toggleNewTenant(row: GasReadingRow, checked: boolean): void {
    row.isNewTenant = checked;
    if (checked && row.initialReading === null) {
      row.initialReading = row.reading?.previousReading ?? null;
    }
    if (row.reading) {
      this.saveReading(row);
    }
  }

  /** FR-029: a comment on the bill overall (no apartment tied to it). */
  addBillComment(): void {
    if (this.dateId === null || !this.newCommentText.trim()) {
      return;
    }
    const text = this.newCommentText;
    if (this.bill) {
      this.gasBillingService.addComment(this.bill.id, text, null).subscribe(() => {
        this.newCommentText = '';
        this.reload();
      });
    } else {
      // No bill saved yet - create it first (empty totals) so the comment has somewhere to attach.
      this.gasBillingService.createBill(this.dateId, {}).subscribe((billId) => {
        this.gasBillingService.addComment(billId, text, null).subscribe(() => {
          this.newCommentText = '';
          this.reload();
        });
      });
    }
  }

  /** FR-029: a comment tied to one apartment's line - prompts inline rather than a full dialog,
   *  since this is a short, occasional note, not a primary editing flow. */
  addReadingComment(row: GasReadingRow): void {
    if (!this.bill || !row.reading) {
      return;
    }
    const text = window.prompt(`Comentario para ${row.apartmentNumber}:`, '');
    if (!text || !text.trim()) {
      return;
    }
    this.gasBillingService.addComment(this.bill.id, text, row.reading.id).subscribe(() => this.reload());
  }

  confirm(): void {
    if (!this.bill) {
      return;
    }
    this.gasBillingService.confirmBill(this.bill.id).subscribe((result) => {
      this.confirmSucceeded = result.success;
      this.confirmMessage = result.success
        ? 'Factura confirmada.'
        : `No se puede confirmar: revisa ${result.blockedApartmentNumbers.join(', ')}.`;
      if (result.success) {
        this.reload();
      }
    });
  }
}
