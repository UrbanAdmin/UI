import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { NotificationsService } from './notifications.service';
import { NotificationStatus, ServicePayment } from './notification.model';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [DatePipe, MatCardModule, MatChipsModule, MatTableModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css',
})
export class NotificationsComponent {
  displayedColumns: string[] = ['apartment', 'owner', 'service', 'dueDate', 'status'];
  notifications: (ServicePayment & { status: NotificationStatus })[];

  constructor(private notificationsService: NotificationsService) {
    this.notifications = this.notificationsService.getActiveNotifications();
  }

  statusLabel(status: NotificationStatus): string {
    switch (status) {
      case 'due-soon':
        return 'Vence en 2 días';
      case 'due-today':
        return 'Vence hoy';
      case 'overdue':
        return 'Vencido';
      default:
        return status;
    }
  }
}
