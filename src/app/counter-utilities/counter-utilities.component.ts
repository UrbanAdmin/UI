import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AddReadingDialogComponent } from '../add-reading-dialog/add-reading-dialog.component';
import { CommonModule } from '@angular/common';
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
    CommonModule,
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
    { mes: 'Marzo', evidencia: '' }
  ];

  constructor(private dialog: MatDialog) {}

  openAddReadingDialog() {
    this.dialog.open(AddReadingDialogComponent);
  }

  openAddManualReadingDialog() {
    this.dialog.open(AddManualReadingDialogComponent);
  }
}