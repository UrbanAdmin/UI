import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ServiceName } from '../shared/service-name';
import { MONTH_NAMES } from '../notifications/month-names';
import { AuthService } from '../auth.service';
import { ReceiptCardComponent } from '../shared/receipt-card/receipt-card.component';
import { ReadingTableComponent } from '../shared/reading-table/reading-table.component';
import { PageHeaderComponent } from '../shared/page-header/page-header.component';
import { GasBillingComponent } from '../gas-billing/gas-billing.component';
import { AguaBillingComponent } from '../agua-billing/agua-billing.component';

/** Lecturas' host: picks a Servicio, then hands off entirely to whichever
 *  module owns that service's UI - Gas and Agua each have their own
 *  self-contained seam (GasBillingComponent, AguaBillingComponent); Luz has
 *  no service-specific behavior of its own, so it composes the same
 *  ReceiptCardComponent/ReadingTableComponent Agua's own component also
 *  composes, just driven by a plain Mes/Año pair instead of a billing
 *  period. This component owns no reading/receipt logic itself. */
@Component({
  selector: 'app-counter-utilities',
  standalone: true,
  templateUrl: './counter-utilities.component.html',
  styleUrls: ['./counter-utilities.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    PageHeaderComponent,
    ReceiptCardComponent,
    ReadingTableComponent,
    GasBillingComponent,
    AguaBillingComponent,
  ],
})
export class CounterUtilitiesComponent {
  private readonly authService = inject(AuthService);

  readonly services: ServiceName[] = ['Agua', 'Luz', 'Gas'];
  readonly isReadOnly = this.authService.isApartmentOwner();
  readonly monthNames = MONTH_NAMES;
  readonly years: number[];

  selectedService: ServiceName = 'Agua';
  selectedReceiptMonth: number = new Date().getMonth() + 1;
  selectedReceiptYear: number = new Date().getFullYear();

  constructor() {
    this.years = Array.from({ length: 7 }, (_, i) => this.selectedReceiptYear - 1 + i);
  }
}
