import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { authGuard } from './auth.guard';
import { CounterUtilitiesComponent } from './counter-utilities/counter-utilities.component';
import { PaymentsComponent } from './payments/payments.component';
import { NotificationsComponent } from './notifications/notifications.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, canActivate: [authGuard] }, // Homepage protected
  { path: 'login', component: LoginComponent }, // Login page
  { path: 'counter-utilities', component: CounterUtilitiesComponent, canActivate: [authGuard] }, // Counter Utilities page protected
  { path: 'payments', component: PaymentsComponent, canActivate: [authGuard] }, // Pagos page protected
  { path: 'notifications', component: NotificationsComponent, canActivate: [authGuard] } // Notifications page protected
];
