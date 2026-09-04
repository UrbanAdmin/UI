import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

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
  imports: [FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatDialogModule],
})
export class ApartmentDialogComponent {
  number: string;
  owner: string;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ApartmentDialogData,
    private dialogRef: MatDialogRef<ApartmentDialogComponent>,
    private apartmentsService: ApartmentsService,
  ) {
    this.number = data.apartment?.number ?? '';
    this.owner = data.apartment?.owner ?? '';
  }

  get isEdit(): boolean {
    return this.data.apartment !== null;
  }

  save(): void {
    const request$ = this.data.apartment
      ? this.apartmentsService.updateApartment(this.data.apartment.id, this.number, this.owner)
      : this.apartmentsService.createApartment(this.number, this.owner);
    request$.subscribe(() => this.dialogRef.close(true));
  }
}
