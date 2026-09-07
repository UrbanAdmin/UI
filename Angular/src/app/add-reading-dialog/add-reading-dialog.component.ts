import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import { ReadingsService } from '../readings/readings.service';
import { MONTH_NAMES } from '../notifications/month-names';
import { ServiceName } from '../notifications/notification.model';

export interface AddReadingDialogData {
  apartmentId: number;
  apartment: string;
  owner: string;
  service: ServiceName;
  /** When set, the dialog opens pre-filled for that existing reading instead
   *  of a new one - month is locked so an edit can't drift to another period. */
  month?: number;
  /** The existing reading's actual year - required alongside month when
   *  editing, since "previous month" can fall in an earlier year (January's
   *  previous month is December of the prior year). */
  year?: number;
  counter?: string | null;
}

@Component({
  selector: 'app-add-reading-dialog',
  standalone: true,
  templateUrl: './add-reading-dialog.component.html',
  styleUrls: ['./add-reading-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
})
export class AddReadingDialogComponent {
  readonly monthNames = MONTH_NAMES;
  readonly isEditing: boolean;

  month: number;
  year: number;
  counter: string | null;
  selectedFile: File | null = null;
  ocrLoading = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AddReadingDialogData,
    private dialogRef: MatDialogRef<AddReadingDialogComponent>,
    private readingsService: ReadingsService,
  ) {
    this.isEditing = data.month != null;
    this.month = data.month ?? new Date().getMonth() + 1;
    this.year = data.year ?? new Date().getFullYear();
    this.counter = data.counter ?? null;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile = file;
    if (!file) {
      return;
    }

    this.ocrLoading = true;
    this.readingsService.ocrPreviewCounter(file).subscribe({
      next: (result) => {
        this.ocrLoading = false;
        // A suggestion pre-fills the field - never overwrites silently,
        // the admin still reviews/edits it before Guardar.
        if (result.suggestedCounter) {
          this.counter = result.suggestedCounter;
        }
      },
      error: () => (this.ocrLoading = false),
    });
  }

  save(): void {
    if (!this.counter) {
      return;
    }

    this.readingsService
      .recordReading(this.data.apartmentId, this.data.service, this.month, this.year, this.counter)
      .subscribe((counterUtilityId) => {
        if (this.selectedFile) {
          this.readingsService
            .uploadCounterUtilityPhoto(counterUtilityId, this.selectedFile)
            .subscribe(() => this.dialogRef.close(true));
        } else {
          this.dialogRef.close(true);
        }
      });
  }
}
