import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { forkJoin, map, of } from 'rxjs';
import { ActiveNotificationsService } from '../notifications/active-notifications.service';
import { OwnerPaymentsService } from '../owner-payments/owner-payments.service';
import { NotificationStatus } from '../notifications/notification.model';
import { OwnerPayment } from '../owner-payments/owner-payment.model';
import { ServiceName } from '../shared/service-name';
import { AuthService } from '../auth.service';
import { ApartmentsService } from '../shared/apartments.service';
import { UsersService } from '../shared/users.service';
import { monthName } from '../notifications/month-names';
import { PageHeaderComponent } from '../shared/page-header/page-header.component';
import { StatusChipComponent } from '../shared/status-chip/status-chip.component';
import { CopCurrencyPipe } from '../shared/cop-currency.pipe';
import { formatCop } from '../shared/cop-currency';
import { CarteraService, CarteraChargeDto } from '../cartera/cartera.service';

const TRACKED_SERVICES: ServiceName[] = ['Agua', 'Luz', 'Gas', 'Arriendo'];

type CarteraRow = OwnerPayment & { status: NotificationStatus };

/** One row of the admin "Cartera del mes" table - sourced from GET /admin/cartera, which already
 *  spans every period with real data (not just the current month) and only ever returns unpaid
 *  charges, so there's no paid/placeholder filtering to do on this side (unlike CarteraRow). */
interface AdminCarteraRow {
  apartment: string;
  service: string;
  dueDate: Date;
  status: NotificationStatus;
  amount: number | null;
}

function toAdminCarteraRow(charge: CarteraChargeDto, status: NotificationStatus): AdminCarteraRow {
  return {
    apartment: charge.apartmentNumber,
    service: charge.service,
    dueDate: new Date(charge.dueDate),
    status,
    amount: charge.amount,
  };
}

/** Mirrors getNotificationStatus's thresholds for an upcoming (not yet overdue) charge, from the
 *  days-until-due GET /admin/cartera already computed server-side. */
function dueSoonStatus(daysUntilDue: number | null): NotificationStatus {
  if (daysUntilDue === 0) {
    return 'due-today';
  }
  if (daysUntilDue === 1 || daysUntilDue === 2) {
    return 'due-soon';
  }
  return 'not-due';
}

interface QuickAccessCard {
  path: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    DatePipe,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    PageHeaderComponent,
    StatusChipComponent,
    CopCurrencyPipe,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private readonly activeNotificationsService = inject(ActiveNotificationsService);
  private readonly ownerPaymentsService = inject(OwnerPaymentsService);
  private readonly authService = inject(AuthService);
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly usersService = inject(UsersService);
  private readonly carteraService = inject(CarteraService);

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
  // means not paid and not-yet-due (see ActiveNotificationsService.getActiveNotifications),
  // i.e. exactly what the Notificaciones screen itself lists. For an
  // ApartmentOwner it already comes back scoped to just their apartment
  // (server-side), same call as Admin.
  private readonly activeNotifications = toSignal(this.activeNotificationsService.getActiveNotifications(), {
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

  // "Tus conceptos del mes" (owner): every tracked service's row for the
  // current month regardless of paid status - the owner's statement shows
  // what's already paid too. getOwnerPayments() is already server-scoped (an
  // Owner only ever gets their own apartment's rows).
  private readonly currentMonthByService = toSignal(
    forkJoin(
      TRACKED_SERVICES.map((service) => {
        const now = new Date();
        return this.ownerPaymentsService.getOwnerPayments(service, now.getMonth() + 1, now.getFullYear());
      }),
    ).pipe(map((groups): CarteraRow[] => groups.flat())),
    { initialValue: [] as CarteraRow[] },
  );

  // "Cartera del mes" (admin): the building-wide receivables ledger, spanning
  // every period with real data - not just the current month, so a Servicio
  // or Arriendo charge left unpaid since an earlier month still shows up.
  // GET /admin/cartera already does this scan server-side (the same one the
  // Mobile admin Cartera tab uses) and only ever returns unpaid charges, so
  // there's no client-side paid/placeholder filtering left to do.
  private readonly carteraData = toSignal(this.isAdmin ? this.carteraService.getCartera() : of(null), {
    initialValue: null,
  });

  readonly carteraDelMes = computed<AdminCarteraRow[]>(() => {
    const data = this.carteraData();
    if (!data) {
      return [];
    }
    const rows: AdminCarteraRow[] = [];
    for (const year of data.years) {
      for (const month of year.months) {
        for (const charge of month.charges) {
          rows.push(toAdminCarteraRow(charge, 'overdue'));
        }
        for (const charge of month.upcomingCharges) {
          rows.push(toAdminCarteraRow(charge, dueSoonStatus(charge.daysUntilDue)));
        }
      }
    }
    return rows.sort((a, b) => a.apartment.localeCompare(b.apartment));
  });

  /** Owner: every row, paid or not - their own statement for the month. */
  readonly misConceptosDelMes = computed<CarteraRow[]>(() =>
    this.currentMonthByService()
      .slice()
      .sort((a, b) => TRACKED_SERVICES.indexOf(a.service) - TRACKED_SERVICES.indexOf(b.service)),
  );

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
