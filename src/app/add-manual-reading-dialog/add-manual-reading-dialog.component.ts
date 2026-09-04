import { Component } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-add-manual-reading-dialog',
  standalone: true,
  templateUrl: './add-manual-reading-dialog.component.html',
  styleUrls: ['./add-manual-reading-dialog.component.css'],
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule
]
})
export class AddManualReadingDialogComponent {}
