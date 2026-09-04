import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Observable, of, switchMap } from 'rxjs';

import { Apartment } from '../shared/apartment.model';
import { ApartmentsService } from '../shared/apartments.service';

export interface ApartmentDialogData {
  apartment: Apartment | null;
}

@Component({
  selector: 'app-apartment-dialog',
  standalone: true,
  templateUrl: './apartment-dialog.component.html',
  styleUrl: './apartment-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [provideNativeDateAdapter()],
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
  ],
})
export class ApartmentDialogComponent {
  number: string;
  owner: string;
  contractStartDate: Date | null;
  selectedFile: File | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ApartmentDialogData,
    private dialogRef: MatDialogRef<ApartmentDialogComponent>,
    private apartmentsService: ApartmentsService,
  ) {
    this.number = data.apartment?.number ?? '';
    this.owner = data.apartment?.owner ?? '';
    this.contractStartDate = data.apartment?.contractStartDate ? new Date(data.apartment.contractStartDate) : null;
  }

  get isEdit(): boolean {
    return this.data.apartment !== null;
  }

  get hasContract(): boolean {
    return this.data.apartment?.hasContract ?? false;
  }

  get contractFileName(): string | null {
    return this.data.apartment?.contractFileName ?? null;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
  }

  viewContract(): void {
    if (!this.data.apartment) {
      return;
    }
    this.apartmentsService.downloadContract(this.data.apartment.id).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    });
  }

  save(): void {
    const existing = this.data.apartment;
    const contractStartDateIso = this.contractStartDate ? this.contractStartDate.toISOString() : null;
    const request$ = existing
      ? this.apartmentsService.updateApartment(existing.id, this.number, this.owner, contractStartDateIso)
      : this.apartmentsService.createApartment(this.number, this.owner, contractStartDateIso);

    request$.pipe(switchMap(() => this.uploadFileIfSelected(existing))).subscribe(() => this.dialogRef.close(true));
  }

  private uploadFileIfSelected(existing: Apartment | null): Observable<void> {
    if (!this.selectedFile) {
      return of(undefined);
    }
    if (existing) {
      return this.apartmentsService.uploadContract(existing.id, this.selectedFile);
    }
    // create()'s response can't be trusted for the new id (same quirk as
    // every other resource) - refetch and match by natural key instead.
    return this.apartmentsService.getApartments().pipe(
      switchMap((apartments) => {
        const created = apartments.find((a) => a.number === this.number && a.owner === this.owner);
        if (!created) {
          throw new Error(`Failed to find newly created apartment "${this.number}"`);
        }
        return this.apartmentsService.uploadContract(created.id, this.selectedFile!);
      }),
    );
  }
}
