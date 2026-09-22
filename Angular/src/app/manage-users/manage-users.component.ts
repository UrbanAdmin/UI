import { Component, ChangeDetectionStrategy, NgZone, inject, signal } from '@angular/core';
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
import { LoadingService } from '../loading.service';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingIndicatorComponent } from '../shared/loading-indicator/loading-indicator.component';
import { PageHeaderComponent } from '../shared/page-header/page-header.component';

@Component({
  selector: 'app-manage-users',
  standalone: true,
  templateUrl: './manage-users.component.html',
  styleUrl: './manage-users.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    EmptyStateComponent,
    LoadingIndicatorComponent,
    PageHeaderComponent,
  ],
})
export class ManageUsersComponent {
  private readonly usersService = inject(UsersService);
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly dialog = inject(MatDialog);
  private readonly ngZone = inject(NgZone);
  protected readonly loadingService = inject(LoadingService);

  readonly displayedColumns: string[] = ['username', 'role', 'apartment', 'actions'];
  users$: Observable<User[]> = this.usersService.getUsers();
  readonly deleteError = signal<string | null>(null);

  private readonly apartments = toSignal(this.apartmentsService.getApartments(), { initialValue: [] as Apartment[] });

  roleLabel(role: string): string {
    return role === 'Admin' ? 'Administrador' : 'Arrendatario';
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
        // MatDialog emits afterClosed() from outside NgZone (its close
        // animation runs via runOutsideAngular), so reassigning users$
        // here needs to explicitly re-enter the zone - otherwise no change
        // detection ever runs and the async pipe never re-subscribes,
        // silently skipping the refetch.
        if (saved) {
          this.ngZone.run(() => this.refresh());
        }
      });
  }

  openEditDialog(user: User): void {
    this.dialog
      .open(UserDialogComponent, { width: '420px', data: { user } })
      .afterClosed()
      .subscribe((saved) => {
        // MatDialog emits afterClosed() from outside NgZone (its close
        // animation runs via runOutsideAngular), so reassigning users$
        // here needs to explicitly re-enter the zone - otherwise no change
        // detection ever runs and the async pipe never re-subscribes,
        // silently skipping the refetch.
        if (saved) {
          this.ngZone.run(() => this.refresh());
        }
      });
  }

  deleteUser(user: User): void {
    if (!window.confirm(`¿Eliminar el usuario ${user.username}?`)) {
      return;
    }
    this.deleteError.set(null);
    this.usersService.deleteUser(user.id).subscribe({
      next: () => this.refresh(),
      error: (err: HttpErrorResponse) =>
        this.deleteError.set(typeof err.error === 'string' ? err.error : 'No se pudo eliminar el usuario'),
    });
  }

  private refresh(): void {
    this.users$ = this.usersService.getUsers();
  }
}
