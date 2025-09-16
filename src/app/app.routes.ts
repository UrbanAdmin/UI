import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent, canActivate: [authGuard] }, // Homepage protected
  { path: 'login', component: LoginComponent } // Login page
];
