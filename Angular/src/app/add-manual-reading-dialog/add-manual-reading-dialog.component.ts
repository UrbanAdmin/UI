import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { ReadingsService } from '../readings/readings.service';
import { MONTH_NAMES } from '../notifications/month-names';
import { ServiceName } from '../notifications/notification.model';

export interface AddReadingDialogData {
  apartmentId: number;
  apartment: string;
  owner: string;
  service: ServiceName;
}

@Component({
  selector: 'app-add-manual-reading-dialog',
  standalone: true,
  templateUrl: './add-manual-reading-dialog.component.html',
  styleUrls: ['./add-manual-reading-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDialogModule,
  ],
})
export class AddManualReadingDialogComponent {
  readonly monthNames = MONTH_NAMES;

  month: number = new Date().getMonth() + 1;
  counter: string | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AddReadingDialogData,
    private dialogRef: MatDialogRef<AddManualReadingDialogComponent>,
    private readingsService: ReadingsService,
  ) {}

  save(): void {
    this.readingsService
      .recordReading(this.data.apartmentId, this.data.service, this.month, new Date().getFullYear(), this.counter, null)
      .subscribe(() => this.dialogRef.close(true));
  }
}
