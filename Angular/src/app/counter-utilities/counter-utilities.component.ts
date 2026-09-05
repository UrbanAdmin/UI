import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AddReadingDialogComponent } from '../add-reading-dialog/add-reading-dialog.component';

import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { AddManualReadingDialogComponent } from '../add-manual-reading-dialog/add-manual-reading-dialog.component';

import { Observable, map, shareReplay } from 'rxjs';
import { Apartment } from '../shared/apartment.model';
import { ApartmentsService } from '../shared/apartments.service';
import { ServiceName } from '../notifications/notification.model';
import { monthName } from '../notifications/month-names';
import { ReadingsService } from '../readings/readings.service';
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
    MatButtonModule,
    MatTabsModule,
    MatTableModule
]
})
export class CounterUtilitiesComponent {
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly authService = inject(AuthService);

  readonly apartments$: Observable<Apartment[]> = this.apartmentsService.getApartments();
  readonly services: ServiceName[] = ['Agua', 'Luz', 'Gas'];
  readonly displayedColumns: string[] = ['mes', 'lectura', 'evidencia'];
  readonly isReadOnly = this.authService.isApartmentOwner();

  // getRows$ is called directly from the template on every apartment x
  // service tab, which re-evaluates on every change-detection cycle -
  // without memoizing the Observable per key, that would fire a fresh
  // HTTP request each time. shareReplay(1) additionally covers multiple
  // concurrent async-pipe subscriptions to the same cached Observable.
  private readonly rowsCache = new Map<string, Observable<ReadingRow[]>>();

  constructor(
    private dialog: MatDialog,
    private readingsService: ReadingsService,
  ) { }

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

  openAddReadingDialog(apartment: Apartment, service: ServiceName) {
    this.dialog
      .open(AddReadingDialogComponent, {
        data: { apartmentId: apartment.id, apartment: apartment.number, owner: apartment.owner, service },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.invalidateRows(apartment, service);
        }
      });
  }

  openAddManualReadingDialog(apartment: Apartment, service: ServiceName) {
    this.dialog
      .open(AddManualReadingDialogComponent, {
        width: '420px',
        maxHeight: '90vh',
        data: { apartmentId: apartment.id, apartment: apartment.number, owner: apartment.owner, service },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.invalidateRows(apartment, service);
        }
      });
  }
}
