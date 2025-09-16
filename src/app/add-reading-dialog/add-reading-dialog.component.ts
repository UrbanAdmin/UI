import { Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-add-reading-dialog',
  standalone: true,
  templateUrl: './add-reading-dialog.component.html',
  styleUrls: ['./add-reading-dialog.component.css'],
  imports: [CommonModule, FormsModule, MatDialogModule]
})
export class AddReadingDialogComponent {}
