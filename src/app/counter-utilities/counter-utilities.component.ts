import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AddReadingDialogComponent } from '../add-reading-dialog/add-reading-dialog.component';

import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { AddManualReadingDialogComponent } from '../add-manual-reading-dialog/add-manual-reading-dialog.component';

@Component({
  selector: 'app-counter-utilities',
  standalone: true,
  templateUrl: './counter-utilities.component.html',
  styleUrls: ['./counter-utilities.component.css'],
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatTabsModule,
    MatTableModule
]
})
export class CounterUtilitiesComponent {
  displayedColumns: string[] = ['mes', 'evidencia'];
  dataSource = [
    { mes: 'Enero', evidencia: 'Link' },
    { mes: 'Febrero', evidencia: 'Link' },
    { mes: 'Marzo', evidencia: 'Link' },
    { mes: 'Abril', evidencia: 'Link' },
    { mes: 'Mayo', evidencia: 'Link' },
    { mes: 'Junio', evidencia: 'Link' },
    { mes: 'Julio', evidencia: 'Link' },
    { mes: 'Agosto', evidencia: 'Link' },
    { mes: 'Septiembre', evidencia: 'Link' },
    { mes: 'Octubre', evidencia: 'Link' },
    { mes: 'Noviembre', evidencia: 'Link' },
    { mes: 'Diciembre', evidencia: 'Link' }
  ];

  constructor(private dialog: MatDialog) { }

  openAddReadingDialog() {
    this.dialog.open(AddReadingDialogComponent);
  }

  openAddManualReadingDialog() {
    this.dialog.open(AddManualReadingDialogComponent, {
      width: '420px',
      maxHeight: '90vh'
    });
  }
}