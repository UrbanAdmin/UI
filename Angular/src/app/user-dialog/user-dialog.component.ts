import { Component, ChangeDetectionStrategy, Inject, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';

import { Apartment } from '../shared/apartment.model';
import { ApartmentsService } from '../shared/apartments.service';
import { User } from '../shared/user.model';
import { UsersService } from '../shared/users.service';

export interface UserDialogData {
  user: User | null;
}

@Component({
  selector: 'app-user-dialog',
  standalone: true,
  templateUrl: './user-dialog.component.html',
  styleUrl: './user-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatDialogModule],
})
export class UserDialogComponent {
  username: string;
  password = '';
  role: string;
  apartmentId: number | null;
  errorMessage: string | null = null;

  private readonly apartmentsService = inject(ApartmentsService);
  private readonly usersService = inject(UsersService);
  readonly apartments = toSignal(this.apartmentsService.getApartments(), { initialValue: [] as Apartment[] });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: UserDialogData,
    private dialogRef: MatDialogRef<UserDialogComponent>,
  ) {
    this.username = data.user?.username ?? '';
    this.role = data.user?.role ?? 'ApartmentOwner';
    this.apartmentId = data.user?.apartmentId ?? null;
  }

  get isEdit(): boolean {
    return this.data.user !== null;
  }

  get canSave(): boolean {
    if (this.role === 'ApartmentOwner' && this.apartmentId === null) {
      return false;
    }
    if (!this.isEdit && (!this.username || !this.password)) {
      return false;
    }
    return true;
  }

  save(): void {
    this.errorMessage = null;
    const apartmentId = this.role === 'ApartmentOwner' ? this.apartmentId : null;
    const existing = this.data.user;

    const request$ = existing
      ? this.usersService.updateUser(existing.id, this.role, apartmentId, this.password || null)
      : this.usersService.createUser(this.username, this.password, this.role, apartmentId);

    request$.subscribe({
      next: () => this.dialogRef.close(true),
      error: (err: HttpErrorResponse) => {
        this.errorMessage = typeof err.error === 'string' ? err.error : 'No se pudo guardar el usuario';
      },
    });
  }
}
