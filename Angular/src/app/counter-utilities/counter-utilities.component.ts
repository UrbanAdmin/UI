import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AddReadingDialogComponent } from '../add-reading-dialog/add-reading-dialog.component';

import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { AddManualReadingDialogComponent } from '../add-manual-reading-dialog/add-manual-reading-dialog.component';

import { Apartment, APARTMENTS } from '../shared/apartments';
import { ServiceName } from '../notifications/notification.model';
import { monthName } from '../notifications/month-names';
import { ReadingsService } from '../readings/readings.service';
import { MeterReading } from '../readings/reading.model';

@Component({
  selector: 'app-counter-utilities',
  standalone: true,
  templateUrl: './counter-utilities.component.html',
  styleUrls: ['./counter-utilities.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    MatButtonModule,
    MatTabsModule,
    MatTableModule
]
})
export class CounterUtilitiesComponent {
  readonly apartments: Apartment[] = APARTMENTS;
  readonly services: ServiceName[] = ['Agua', 'Luz', 'Gas'];
  readonly displayedColumns: string[] = ['mes', 'lectura', 'evidencia'];

  constructor(private dialog: MatDialog, private readingsService: ReadingsService) { }

  getRows(apartment: string, service: ServiceName): (MeterReading & { monthLabel: string })[] {
    return this.readingsService
      .getReadings(apartment, service)
      .map((reading) => ({ ...reading, monthLabel: monthName(reading.month) }));
  }

  openAddReadingDialog(apartment: Apartment, service: ServiceName) {
    this.dialog.open(AddReadingDialogComponent, {
      data: { apartment: apartment.number, owner: apartment.owner, service },
    });
  }

  openAddManualReadingDialog(apartment: Apartment, service: ServiceName) {
    this.dialog.open(AddManualReadingDialogComponent, {
      width: '420px',
      maxHeight: '90vh',
      data: { apartment: apartment.number, owner: apartment.owner, service },
    });
  }
}
