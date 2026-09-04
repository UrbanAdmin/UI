import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';

import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-add-reading-dialog',
  standalone: true,
  templateUrl: './add-reading-dialog.component.html',
  styleUrls: ['./add-reading-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [FormsModule, MatDialogModule]
})
export class AddReadingDialogComponent {}
