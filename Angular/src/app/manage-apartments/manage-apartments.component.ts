import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';

import { Apartment } from '../shared/apartment.model';
import { ApartmentsService } from '../shared/apartments.service';
import { ApartmentDialogComponent } from '../apartment-dialog/apartment-dialog.component';

@Component({
  selector: 'app-manage-apartments',
  standalone: true,
  templateUrl: './manage-apartments.component.html',
  styleUrl: './manage-apartments.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatTableModule],
})
export class ManageApartmentsComponent {
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly dialog = inject(MatDialog);

  readonly displayedColumns: string[] = ['number', 'owner', 'contractStartDate', 'contract', 'actions'];
  apartments$: Observable<Apartment[]> = this.apartmentsService.getApartments();

  viewContract(apartment: Apartment): void {
    this.apartmentsService.downloadContract(apartment.id).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    });
  }

  openCreateDialog(): void {
    this.dialog
      .open(ApartmentDialogComponent, { width: '420px', data: { apartment: null } })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.refresh();
        }
      });
  }

  openEditDialog(apartment: Apartment): void {
    this.dialog
      .open(ApartmentDialogComponent, { width: '420px', data: { apartment } })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.refresh();
        }
      });
  }

  deleteApartment(apartment: Apartment): void {
    if (!window.confirm(`¿Eliminar el apartamento ${apartment.number}?`)) {
      return;
    }
    this.apartmentsService.deleteApartment(apartment.id).subscribe(() => this.refresh());
  }

  private refresh(): void {
    this.apartments$ = this.apartmentsService.getApartments();
  }
}
