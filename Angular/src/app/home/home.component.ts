import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { NotificationsService } from '../notifications/notifications.service';

interface QuickAccessCard {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, MatCardModule, MatIconModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  readonly quickAccessCards: QuickAccessCard[] = [
    { path: '/counter-utilities', label: 'Lecturas', icon: 'speed' },
    { path: '/payments', label: 'Pagos', icon: 'payments' },
    { path: '/notifications', label: 'Notificaciones', icon: 'notifications' },
  ];

  readonly pendingNotificationsCount: number;

  constructor(private notificationsService: NotificationsService) {
    this.pendingNotificationsCount = this.notificationsService.getActiveNotifications().length;
  }
}
