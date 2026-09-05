import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';
import { CounterUtilitiesComponent } from './counter-utilities/counter-utilities.component';
import { PaymentsComponent } from './payments/payments.component';
import { NotificationsComponent } from './notifications/notifications.component';
import { ManageApartmentsComponent } from './manage-apartments/manage-apartments.component';
import { ManageUsersComponent } from './manage-users/manage-users.component';
import { ShellComponent } from './shell/shell.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent }, // Login page
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: HomeComponent }, // Homepage
      { path: 'counter-utilities', component: CounterUtilitiesComponent }, // Counter Utilities page
      { path: 'payments', component: PaymentsComponent }, // Pagos page
      { path: 'notifications', component: NotificationsComponent }, // Notifications page
      { path: 'apartments', component: ManageApartmentsComponent, canActivate: [adminGuard] }, // Manage Apartments page (admin only)
      { path: 'users', component: ManageUsersComponent, canActivate: [adminGuard] }, // Manage Users page (admin only)
    ],
  },
];
