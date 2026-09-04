import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { ReadingsService } from '../readings/readings.service';
import { MONTH_NAMES } from '../notifications/month-names';
import { AddReadingDialogData } from '../add-manual-reading-dialog/add-manual-reading-dialog.component';

@Component({
  selector: 'app-add-reading-dialog',
  standalone: true,
  templateUrl: './add-reading-dialog.component.html',
  styleUrls: ['./add-reading-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatSelectModule],
})
export class AddReadingDialogComponent {
  readonly monthNames = MONTH_NAMES;

  month: number = new Date().getMonth() + 1;
  selectedFileName: string | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AddReadingDialogData,
    private dialogRef: MatDialogRef<AddReadingDialogComponent>,
    private readingsService: ReadingsService,
  ) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFileName = input.files?.[0]?.name ?? null;
  }

  save(): void {
    this.readingsService.recordReading(
      this.data.apartment,
      this.data.service,
      this.month,
      new Date().getFullYear(),
      null,
      this.selectedFileName,
    );
    this.dialogRef.close(true);
  }
}
