import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Apartment } from '../shared/apartment.model';
import { ApartmentsService } from '../shared/apartments.service';
import { User } from '../shared/user.model';
import { UsersService } from '../shared/users.service';
import { UserDialogComponent } from '../user-dialog/user-dialog.component';

@Component({
  selector: 'app-manage-users',
  standalone: true,
  templateUrl: './manage-users.component.html',
  styleUrl: './manage-users.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatTableModule],
})
export class ManageUsersComponent {
  private readonly usersService = inject(UsersService);
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly dialog = inject(MatDialog);

  readonly displayedColumns: string[] = ['username', 'role', 'apartment', 'actions'];
  users$: Observable<User[]> = this.usersService.getUsers();

  private readonly apartments = toSignal(this.apartmentsService.getApartments(), { initialValue: [] as Apartment[] });

  roleLabel(role: string): string {
    return role === 'Admin' ? 'Administrador' : 'Propietario';
  }

  apartmentNumber(apartmentId: number | null): string {
    if (apartmentId === null) {
      return '—';
    }
    return this.apartments().find((a) => a.id === apartmentId)?.number ?? '—';
  }

  openCreateDialog(): void {
    this.dialog
      .open(UserDialogComponent, { width: '420px', data: { user: null } })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.refresh();
        }
      });
  }

  openEditDialog(user: User): void {
    this.dialog
      .open(UserDialogComponent, { width: '420px', data: { user } })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.refresh();
        }
      });
  }

  deleteUser(user: User): void {
    if (!window.confirm(`¿Eliminar el usuario ${user.username}?`)) {
      return;
    }
    this.usersService.deleteUser(user.id).subscribe({
      next: () => this.refresh(),
      error: (err: HttpErrorResponse) => window.alert(typeof err.error === 'string' ? err.error : 'No se pudo eliminar el usuario'),
    });
  }

  private refresh(): void {
    this.users$ = this.usersService.getUsers();
  }
}
