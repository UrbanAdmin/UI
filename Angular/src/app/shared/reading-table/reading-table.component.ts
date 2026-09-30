import { Component, ChangeDetectionStrategy, NgZone, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { Observable, forkJoin, map, shareReplay } from 'rxjs';
import { Apartment } from '../apartment.model';
import { ApartmentsService } from '../apartments.service';
import { CopCurrencyPipe } from '../cop-currency.pipe';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { LoadingIndicatorComponent } from '../loading-indicator/loading-indicator.component';
import { ServiceName } from '../service-name';
import { AddReadingDialogComponent } from '../../add-reading-dialog/add-reading-dialog.component';
import { monthName } from '../../notifications/month-names';
import { MeterReading } from '../../readings/reading.model';
import { ReadingsService } from '../../readings/readings.service';
import { LoadingService } from '../../loading.service';

type ReadingRow = MeterReading & { monthLabel: string };

/** Every apartment's reading history for one service - a deep module on its
 *  own seam (mirrors GasBillingComponent's independence): given just a
 *  service and a read-only flag, it resolves its own apartments, fetches
 *  and caches every apartment's rows, and owns the Agregar Lectura/Editar
 *  dialog end to end. No output - nothing outside this component reacts to
 *  a reading being saved. */
@Component({
  selector: 'app-reading-table',
  standalone: true,
  templateUrl: './reading-table.component.html',
  styleUrl: './reading-table.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [CommonModule, MatButtonModule, MatTableModule, MatTabsModule, CopCurrencyPipe, EmptyStateComponent, LoadingIndicatorComponent],
})
export class ReadingTableComponent {
  readonly service = input.required<ServiceName>();
  readonly isReadOnly = input.required<boolean>();
  /** Fires after a reading is saved - a sibling ReceiptCardComponent's
   *  Consumo total (the sum of every apartment's consumption Difference)
   *  shifts whenever any reading changes, so it needs to know to reload. */
  readonly readingSaved = output<void>();

  private readonly apartmentsService = inject(ApartmentsService);
  private readonly readingsService = inject(ReadingsService);
  private readonly dialog = inject(MatDialog);
  private readonly ngZone = inject(NgZone);
  protected readonly loadingService = inject(LoadingService);

  readonly apartments$: Observable<Apartment[]> = this.apartmentsService.getApartments();

  get displayedColumns(): string[] {
    return this.isReadOnly()
      ? ['mes', 'lectura', 'evidencia', 'cantidadAPagar']
      : ['mes', 'lectura', 'evidencia', 'cantidadAPagar', 'acciones'];
  }

  // getRows$ is called directly from the template on every apartment tab,
  // which re-evaluates on every change-detection cycle - without memoizing
  // the Observable per key, that would fire a fresh HTTP request each time.
  // shareReplay(1) additionally covers multiple concurrent async-pipe
  // subscriptions to the same cached Observable.
  private readonly rowsCache = new Map<string, Observable<ReadingRow[]>>();

  // Only the previous and current calendar month are shown - a full year of
  // mostly-empty rows was more noise than signal for a bill that's read and
  // paid month to month. In January, "previous" falls in the prior year, so
  // that month has to be fetched separately from a different getReadings() call.
  getRows$(apartment: Apartment): Observable<ReadingRow[]> {
    const service = this.service();
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

  private invalidateRows(apartment: Apartment): void {
    this.rowsCache.delete(`${apartment.id}|${this.service()}`);
  }

  openAddReadingDialog(apartment: Apartment, existing?: ReadingRow): void {
    const service = this.service();
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
            this.invalidateRows(apartment);
            this.readingSaved.emit();
          });
        }
      });
  }
}
