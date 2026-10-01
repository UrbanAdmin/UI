import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CopCurrencyPipe } from '../cop-currency.pipe';
import { EsNumberPipe } from '../es-number.pipe';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { TenantStatement } from './tenant-statement.model';

/** 028-tenant-readings-statement: a read-only, one-apartment view of a confirmed
 *  Gas/Agua bill, replacing the nine/ten-column admin table for an ApartmentOwner.
 *  Every value is a real API field passed straight through (FR-005) - this
 *  component formats and lays them out, it never sums or derives one. */
@Component({
  selector: 'app-tenant-statement',
  standalone: true,
  imports: [CommonModule, MatIconModule, CopCurrencyPipe, EsNumberPipe, EmptyStateComponent],
  templateUrl: './tenant-statement.component.html',
  styleUrl: './tenant-statement.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantStatementComponent {
  readonly statement = input.required<TenantStatement>();

  /** Clamped to 0-100 for the bar's width only; the percentage label itself
   *  always shows the API value unchanged (data-model.md). */
  readonly barWidth = computed(() => {
    const raw = Number(this.statement().percentage ?? 0) * 100;
    return Math.min(100, Math.max(0, raw));
  });
}
