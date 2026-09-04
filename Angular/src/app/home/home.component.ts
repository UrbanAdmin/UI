import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { map } from 'rxjs';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthService } from '../auth.service';

interface QuickAccessCard {
  path: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, MatCardModule, MatIconModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private readonly notificationsService = inject(NotificationsService);
  private readonly authService = inject(AuthService);

  readonly isAdmin = this.authService.isAdmin();

  readonly quickAccessCards: QuickAccessCard[] = [
    { path: '/counter-utilities', label: 'Lecturas', icon: 'speed' },
    { path: '/payments', label: 'Pagos', icon: 'payments' },
    { path: '/notifications', label: 'Notificaciones', icon: 'notifications' },
    { path: '/apartments', label: 'Apartamentos', icon: 'apartment', adminOnly: true },
  ];

  // toSignal (not the async pipe) so the template can compare the count to
  // 0 directly - `@if (obs$ | async; as x)` treats a resolved value of 0
  // as falsy and would hide the whole card list, not just the badge.
  readonly pendingNotificationsCount = toSignal(
    this.notificationsService.getActiveNotifications().pipe(map((list) => list.length)),
    { initialValue: 0 },
  );
}
