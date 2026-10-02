import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ServiceName } from '../shared/service-name';
import { AuthService } from '../auth.service';
import { PageHeaderComponent } from '../shared/page-header/page-header.component';
import { GasBillingComponent } from '../gas-billing/gas-billing.component';
import { AguaBillingComponent } from '../agua-billing/agua-billing.component';
import { ElectricityBillingComponent } from '../electricity-billing/electricity-billing.component';

/** Lecturas' host: picks a Servicio, then hands off entirely to whichever module owns that
 *  service's UI - Agua, Gas, and Luz (030-electricity-utility-billing) each have their own
 *  self-contained seam (AguaBillingComponent, GasBillingComponent, ElectricityBillingComponent).
 *  This component owns no reading/receipt logic itself. */
@Component({
  selector: 'app-counter-utilities',
  standalone: true,
  templateUrl: './counter-utilities.component.html',
  styleUrls: ['./counter-utilities.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    GasBillingComponent,
    AguaBillingComponent,
    ElectricityBillingComponent,
  ],
})
export class CounterUtilitiesComponent {
  private readonly authService = inject(AuthService);

  readonly services: ServiceName[] = ['Agua', 'Luz', 'Gas'];
  readonly isReadOnly = this.authService.isApartmentOwner();

  selectedService: ServiceName = 'Agua';
}
