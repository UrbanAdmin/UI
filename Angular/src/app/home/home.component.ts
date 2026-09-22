import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { map, of } from 'rxjs';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthService } from '../auth.service';
import { ApartmentsService } from '../shared/apartments.service';
import { UsersService } from '../shared/users.service';
import { monthName } from '../notifications/month-names';
import { PageHeaderComponent } from '../shared/page-header/page-header.component';
import { formatCop } from '../shared/cop-currency';

interface QuickAccessCard {
  path: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, MatCardModule, MatIconModule, PageHeaderComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private readonly notificationsService = inject(NotificationsService);
  private readonly authService = inject(AuthService);
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly usersService = inject(UsersService);

  readonly isAdmin = this.authService.isAdmin();

  // Admin sees the month; an owner sees their own apartment (GET /Apartments
  // is already owner-scoped server-side, so the first result is theirs).
  private readonly ownApartment = toSignal(
    this.apartmentsService.getApartments().pipe(map((apartments) => apartments[0] ?? null)),
    { initialValue: null },
  );

  readonly kicker = computed(() => {
    const now = new Date();
    const monthYear = `${monthName(now.getMonth() + 1)} ${now.getFullYear()}`;
    if (this.isAdmin) {
      return monthYear;
    }
    const apartment = this.ownApartment();
    return apartment ? `Apto ${apartment.number} · ${apartment.owner}` : monthYear;
  });

  readonly quickAccessCards: QuickAccessCard[] = [
    { path: '/counter-utilities', label: 'Lecturas', icon: 'speed' },
    { path: '/payments', label: 'Pagos', icon: 'payments' },
    { path: '/notifications', label: 'Notificaciones', icon: 'notifications' },
    { path: '/apartments', label: 'Apartamentos', icon: 'apartment', adminOnly: true },
    { path: '/users', label: 'Usuarios', icon: 'people', adminOnly: true },
  ];

  // Single source for the hero card and the quick-access badge - "active"
  // means not paid and not-yet-due (see NotificationsService.getActiveNotifications),
  // i.e. exactly what the Notificaciones screen itself lists. For an
  // ApartmentOwner it already comes back scoped to just their apartment
  // (server-side), same call as Admin.
  private readonly activeNotifications = toSignal(this.notificationsService.getActiveNotifications(), {
    initialValue: [],
  });

  // toSignal (not the async pipe) so the template can compare the count to
  // 0 directly - `@if (obs$ | async; as x)` treats a resolved value of 0
  // as falsy and would hide the whole card list, not just the badge.
  readonly pendingNotificationsCount = computed(() => this.activeNotifications().length);

  readonly totalApartments = toSignal(
    this.apartmentsService.getApartments().pipe(map((apartments) => apartments.length)),
    { initialValue: 0 },
  );

  private readonly totalUsers = toSignal(
    this.isAdmin ? this.usersService.getUsers().pipe(map((users) => users.length)) : of(0),
    { initialValue: 0 },
  );

  private readonly monthYear = computed(() => {
    const now = new Date();
    return `${monthName(now.getMonth() + 1)} ${now.getFullYear()}`;
  });

  /** Real, derivable subtitles for each quick-access card - no fabricated copy. */
  cardSubtitle(path: string): string {
    switch (path) {
      case '/payments':
        return this.monthYear();
      case '/counter-utilities':
        return 'Agua, Luz y Gas';
      case '/notifications':
        return `${this.pendingNotificationsCount()} aviso${this.pendingNotificationsCount() === 1 ? '' : 's'} activo${this.pendingNotificationsCount() === 1 ? '' : 's'}`;
      case '/apartments':
        return `${this.totalApartments()} unidad${this.totalApartments() === 1 ? '' : 'es'}`;
      case '/users':
        return `${this.totalUsers()} cuenta${this.totalUsers() === 1 ? '' : 's'}`;
      default:
        return '';
    }
  }

  /** Admin hero ("Cartera vencida"): apartments are "al día" when they have
   *  zero active (unpaid, due-or-past-due) notifications of any service. */
  readonly apartmentsPendientes = computed(() => new Set(this.activeNotifications().map((n) => n.apartmentId)).size);
  readonly apartmentsAlDia = computed(() => Math.max(0, this.totalApartments() - this.apartmentsPendientes()));
  readonly carteraVencida = computed(() =>
    this.activeNotifications()
      .filter((n) => n.status === 'overdue')
      .reduce((sum, n) => sum + (Number(n.amount) || 0), 0),
  );

  /** Owner hero ("Pendiente este mes"): scoped to the current month/year only
   *  (unlike the admin total, which looks across every open deadline). */
  private readonly thisMonthNotifications = computed(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    return this.activeNotifications().filter((n) => n.month === month && n.year === year);
  });
  readonly pendienteEsteMes = computed(() =>
    this.thisMonthNotifications().reduce((sum, n) => sum + (Number(n.amount) || 0), 0),
  );
  readonly conceptosPorPagar = computed(() => this.thisMonthNotifications().length);
  readonly proximoVencimiento = computed(() => {
    const rows = this.thisMonthNotifications();
    if (rows.length === 0) {
      return null;
    }
    return rows.reduce((earliest, n) => (n.dueDate < earliest ? n.dueDate : earliest), rows[0].dueDate);
  });

  readonly carteraVencidaFormatted = computed(() => formatCop(this.carteraVencida()));
  readonly pendienteEsteMesFormatted = computed(() => formatCop(this.pendienteEsteMes()));
  readonly proximoVencimientoFormatted = computed(() => {
    const date = this.proximoVencimiento();
    if (!date) {
      return null;
    }
    return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(date);
  });
}
