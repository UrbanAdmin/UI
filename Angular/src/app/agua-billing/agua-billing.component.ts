import { Component, ChangeDetectionStrategy } from '@angular/core';
import { WaterBillingComponent } from '../water-billing/water-billing.component';

/** Agua's routed entry point in Lecturas - a thin shell with no period logic of its own.
 *  022-bimonthly-agua-billing's period selector/cycle dialog no longer governs Water (FR-046);
 *  WaterBillingComponent now owns its own period list/creation/editing directly
 *  (FR-042, FR-047, research.md §11). AguaCycleDialogComponent and the shared
 *  UtilityBillingCycle/BillingPeriodsService infrastructure stay untouched elsewhere in the app -
 *  they're still load-bearing for Luz and Gas's own Mes/Año pickers. */
@Component({
  selector: 'app-agua-billing',
  standalone: true,
  templateUrl: './agua-billing.component.html',
  styleUrl: './agua-billing.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [WaterBillingComponent],
})
export class AguaBillingComponent {}
