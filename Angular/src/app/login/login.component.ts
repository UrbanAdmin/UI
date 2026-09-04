import { Component, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service'; // <-- Import AuthService

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule
]
})
export class LoginComponent {
  username = '';
  password = '';
  errorMessage = '';

  constructor(private router: Router, private authService: AuthService) {}

  onSubmit() {
    if (this.username === 'admin' && this.password === 'password') {
      this.errorMessage = '';
      this.authService.login(this.username); // Mark user as logged in
      this.router.navigate(['/']); // Redirect to homepage
    } else {
      this.errorMessage = 'Invalid username or password';
    }
  }
}
