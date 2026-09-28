import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of, switchMap, tap, shareReplay, catchError } from 'rxjs';
import { environment } from '../../environments/environment';
import { getNotificationStatus } from './notification-status';
import {
  BillingCycleDto,
  BillingCycleWrite,
  BillingPeriod,
  NotificationStatus,
  OwnerPayment,
  ServiceDeadline,
  ServiceName,
  ServicePayment,
} from './notification.model';
import { DeadlineDto, DeadlineWrite } from './deadline.model';
import { PaymentStatusDto, PaymentStatusWrite } from './payment-status.model';
import { ApartmentsService } from '../shared/apartments.service';
import { UtilitiesService } from '../shared/utilities.service';
import { DatesService } from '../shared/dates.service';
import { monthName, monthNumber } from './month-names';
import { rentDueDate } from './rent-due-date';

export type ActiveNotification = ServicePayment & { status: NotificationStatus; month: number; year: number };

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly utilitiesService = inject(UtilitiesService);
  private readonly datesService = inject(DatesService);

  private deadlinesCache$: Observable<DeadlineDto[]> | null = null;
  private paymentStatusesCache$: Observable<PaymentStatusDto[]> | null = null;
  private readonly billingPeriodsCache = new Map<string, Observable<BillingPeriod[]>>();

  /** The single source of Agua's (or any future bimonthly service's) period
   *  boundaries (research.md Decision 3) - no client re-derives the pairing
   *  rule itself. For a utility with no cycle, every period is one plain
   *  calendar month (secondMonth/secondYear null). Cached per utility/year. */
  getBillingPeriods(utilityId: number, year: number): Observable<BillingPeriod[]> {
    const key = `${utilityId}|${year}`;
    let cached = this.billingPeriodsCache.get(key);
    if (!cached) {
      cached = this.http
        .get<{ utilityId: number; periods: BillingPeriod[] }>(`${environment.apiUrl}/Utilities/${utilityId}/BillingPeriods`, {
          params: { year },
        })
        .pipe(
          map((r) => r.periods),
          // Without this, a failing request errors the shared cached
          // Observable - shareReplay resets on error, so the next
          // change-detection cycle's async-pipe re-subscription re-runs the
          // whole HTTP call again, and again, forever (every Lecturas
          // render becomes an infinite request loop instead of one failed
          // call). Falling back to the same "no cycle configured" shape the
          // Backend itself returns degrades Lecturas to its pre-feature,
          // one-row-per-month behavior instead of breaking outright.
          catchError((err) => {
            console.error(`GET .../Utilities/${utilityId}/BillingPeriods failed - falling back to one period per calendar month`, err);
            return of(this.defaultMonthlyPeriods(year));
          }),
          shareReplay(1),
        );
      this.billingPeriodsCache.set(key, cached);
    }
    return cached;
  }

  private defaultMonthlyPeriods(year: number): BillingPeriod[] {
    return Array.from({ length: 12 }, (_, i) => ({
      anchorMonth: i + 1,
      anchorYear: year,
      secondMonth: null,
      secondYear: null,
      label: `${monthName(i + 1)} ${year}`,
    }));
  }

  /** The label for one specific month/year if it's a real multi-month period
   *  (undefined for a plain calendar month) - callers that already display a
   *  single period (Pagos, Notificaciones) use this instead of every reader
   *  of getOwnerPayments/getActiveNotifications paying for an extra request
   *  they don't render a label for (e.g. Inicio's hero-card counts). */
  getPeriodLabel(utilityId: number, month: number, year: number): Observable<string | undefined> {
    return this.getBillingPeriods(utilityId, year).pipe(
      map((periods) => {
        const match = periods.find((p) => p.anchorMonth === month && p.anchorYear === year);
        return match?.secondMonth != null ? match.label : undefined;
      }),
    );
  }

  /** The building's current cycle-start config for a utility (admin-only
   *  setting), or null on the default one-month cycle. Angular's HttpClient
   *  resolves a 204 No Content body as null on its own - no explicit status
   *  handling needed here. */
  getBillingCycle(utilityId: number): Observable<BillingCycleDto | null> {
    return this.http.get<BillingCycleDto | null>(`${environment.apiUrl}/Utilities/${utilityId}/BillingCycle`);
  }

  /** Always inserts a new cycle row server-side (never updates in place) -
   *  clears the cached billing-period lists so the next read reflects it. */
  setBillingCycle(utilityId: number, write: BillingCycleWrite): Observable<BillingCycleDto> {
    return this.http.post<BillingCycleDto>(`${environment.apiUrl}/Utilities/${utilityId}/BillingCycle`, write).pipe(
      tap(() => this.billingPeriodsCache.clear()),
    );
  }

  private fetchDeadlines(): Observable<DeadlineDto[]> {
    if (!this.deadlinesCache$) {
      this.deadlinesCache$ = this.http.get<DeadlineDto[]>(`${environment.apiUrl}/Deadlines`).pipe(shareReplay(1));
    }
    return this.deadlinesCache$;
  }

  private fetchPaymentStatuses(): Observable<PaymentStatusDto[]> {
    if (!this.paymentStatusesCache$) {
      this.paymentStatusesCache$ = this.http
        .get<PaymentStatusDto[]>(`${environment.apiUrl}/PaymentStatuses`)
        .pipe(shareReplay(1));
    }
    return this.paymentStatusesCache$;
  }

  private resolveIds(service: ServiceName, month: number, year: number): Observable<{ utilityId: number; dateId: number }> {
    return forkJoin([
      this.utilitiesService.getOrCreateUtility(service),
      this.datesService.getOrCreateDate(month, year),
    ]).pipe(map(([utility, date]) => ({ utilityId: utility.id, dateId: date.id })));
  }

  getDeadline(service: ServiceName, month: number, year: number): Observable<ServiceDeadline | undefined> {
    return forkJoin([this.resolveIds(service, month, year), this.fetchDeadlines()]).pipe(
      map(([{ utilityId, dateId }, deadlines]) => {
        const match = deadlines.find((d) => d.utilityId === utilityId && d.dateId === dateId);
        return match ? { service, month, year, dueDate: new Date(match.dueDate) } : undefined;
      }),
    );
  }

  setDeadline(service: ServiceName, month: number, year: number, dueDate: Date): Observable<void> {
    return this.resolveIds(service, month, year).pipe(
      switchMap(({ utilityId, dateId }) =>
        this.fetchDeadlines().pipe(
          switchMap((deadlines) => {
            const existing = deadlines.find((d) => d.utilityId === utilityId && d.dateId === dateId);
            const write: DeadlineWrite = { Utility_Id: utilityId, Date_Id: dateId, DueDate: dueDate.toISOString() };
            const request$ = existing
              ? this.http.put(`${environment.apiUrl}/Deadline/${existing.id}`, write)
              : this.http.post(`${environment.apiUrl}/Deadlines`, write);
            return request$.pipe(tap(() => (this.deadlinesCache$ = null)));
          }),
        ),
      ),
      map(() => undefined),
    );
  }

  getOwnerPayments(
    service: ServiceName,
    month: number,
    year: number,
  ): Observable<(OwnerPayment & { status: NotificationStatus })[]> {
    if (service === 'Arriendo') {
      return this.getArriendoOwnerPayments(month, year);
    }

    const today = new Date();
    return forkJoin([
      this.resolveIds(service, month, year),
      this.apartmentsService.getApartments(),
      this.fetchPaymentStatuses(),
      this.getDeadline(service, month, year),
    ]).pipe(
      map(([{ utilityId, dateId }, apartments, paymentStatuses, deadline]) =>
        apartments.map((apartment) => {
          const existing = paymentStatuses.find(
            (p) => p.apartmentId === apartment.id && p.utilityId === utilityId && p.dateId === dateId,
          );
          const paid = existing?.paid ?? false;
          const amount = existing?.amount ?? null;
          const dueDate = deadline?.dueDate ?? new Date(9999, 11, 31);
          const status = deadline
            ? getNotificationStatus(
                {
                  apartmentId: apartment.id,
                  apartment: apartment.number,
                  owner: apartment.owner,
                  service,
                  dueDate,
                  paid,
                },
                today,
              )
            : 'not-due';
          return {
            apartmentId: apartment.id,
            apartment: apartment.number,
            owner: apartment.owner,
            service,
            month,
            year,
            paid,
            dueDate,
            status,
            amount,
          };
        }),
      ),
    );
  }

  /** Arriendo has no shared Deadline - each apartment's due date is derived
   *  from its own contract start date, so this skips getDeadline entirely
   *  and computes a per-row dueDate instead of using one shared value. */
  private getArriendoOwnerPayments(
    month: number,
    year: number,
  ): Observable<(OwnerPayment & { status: NotificationStatus })[]> {
    const today = new Date();
    return forkJoin([
      this.resolveIds('Arriendo', month, year),
      this.apartmentsService.getApartments(),
      this.fetchPaymentStatuses(),
    ]).pipe(
      map(([{ utilityId, dateId }, apartments, paymentStatuses]) =>
        apartments.map((apartment) => {
          const existing = paymentStatuses.find(
            (p) => p.apartmentId === apartment.id && p.utilityId === utilityId && p.dateId === dateId,
          );
          const paid = existing?.paid ?? false;
          const amount = existing?.amount ?? null;
          const contractStartDate = apartment.contractStartDate ? new Date(apartment.contractStartDate) : null;
          const dueDate = rentDueDate(contractStartDate, month, year);
          const status = getNotificationStatus(
            {
              apartmentId: apartment.id,
              apartment: apartment.number,
              owner: apartment.owner,
              service: 'Arriendo',
              dueDate,
              paid,
            },
            today,
          );
          return {
            apartmentId: apartment.id,
            apartment: apartment.number,
            owner: apartment.owner,
            service: 'Arriendo' as const,
            month,
            year,
            paid,
            dueDate,
            status,
            amount,
          };
        }),
      ),
    );
  }

  setPaid(apartmentId: number, service: ServiceName, month: number, year: number, paid: boolean): Observable<void> {
    return this.resolveIds(service, month, year).pipe(
      switchMap(({ utilityId, dateId }) =>
        this.fetchPaymentStatuses().pipe(
          switchMap((paymentStatuses) => {
            const existing = paymentStatuses.find(
              (p) => p.apartmentId === apartmentId && p.utilityId === utilityId && p.dateId === dateId,
            );
            return this.upsertPaymentStatus(apartmentId, utilityId, dateId, paid, existing?.amount ?? null, existing);
          }),
        ),
      ),
    );
  }

  /** Admin-only "cantidad a pagar", stored on the same per-apartment/period
   *  PaymentStatus row as Paid. For Agua/Luz/Gas, the backend mirrors this
   *  into the matching CounterUtility.Fee so Lecturas' "Cantidad a pagar" shows
   *  the same number (see PaymentStatusCounterUtilityFeeSync). */
  setAmount(apartmentId: number, service: ServiceName, month: number, year: number, amount: string): Observable<void> {
    return this.resolveIds(service, month, year).pipe(
      switchMap(({ utilityId, dateId }) =>
        this.fetchPaymentStatuses().pipe(
          switchMap((paymentStatuses) => {
            const existing = paymentStatuses.find(
              (p) => p.apartmentId === apartmentId && p.utilityId === utilityId && p.dateId === dateId,
            );
            return this.upsertPaymentStatus(apartmentId, utilityId, dateId, existing?.paid ?? false, amount, existing);
          }),
        ),
      ),
    );
  }

  private upsertPaymentStatus(
    apartmentId: number,
    utilityId: number,
    dateId: number,
    paid: boolean,
    amount: string | null,
    existing: PaymentStatusDto | undefined,
  ): Observable<void> {
    const write: PaymentStatusWrite = { Apartment_Id: apartmentId, Utility_Id: utilityId, Date_Id: dateId, Paid: paid, Amount: amount };
    const request$ = existing
      ? this.http.put(`${environment.apiUrl}/PaymentStatus/${existing.id}`, write)
      : this.http.post(`${environment.apiUrl}/PaymentStatuses`, write);
    return request$.pipe(
      tap(() => (this.paymentStatusesCache$ = null)),
      map(() => undefined),
    );
  }

  /** Scans every period that has a deadline set (not just the current month), so a
   *  never-marked-paid balance from an earlier or later period still shows up.
   *  Arriendo has no Deadlines-equivalent backlog to scan (see
   *  getArriendoOwnerPayments), so its notifications only look at the
   *  current month - a reasonable v1 scope, revisit if a rent backlog view
   *  turns out to matter. */
  getActiveNotifications(): Observable<ActiveNotification[]> {
    return forkJoin([this.deadlineDrivenNotifications(), this.arriendoNotifications()]).pipe(
      map(([deadlineDriven, arriendo]) => [...deadlineDriven, ...arriendo]),
    );
  }

  private arriendoNotifications(): Observable<ActiveNotification[]> {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    return this.apartmentsService.getApartments().pipe(
      switchMap((apartments) => {
        if (!apartments.some((a) => a.contractStartDate)) {
          return of([] as ActiveNotification[]);
        }
        return this.getOwnerPayments('Arriendo', month, year).pipe(
          map((rows) =>
            rows
              .filter((row) => row.status !== 'paid' && row.status !== 'not-due')
              .map((row) => ({
                apartmentId: row.apartmentId,
                apartment: row.apartment,
                owner: row.owner,
                service: row.service,
                dueDate: row.dueDate,
                paid: row.paid,
                amount: row.amount,
                status: row.status,
                month,
                year,
              })),
          ),
        );
      }),
    );
  }

  private deadlineDrivenNotifications(): Observable<ActiveNotification[]> {
    return this.fetchDeadlines().pipe(
      switchMap((deadlines) => {
        if (deadlines.length === 0) {
          return of([] as ActiveNotification[]);
        }
        return forkJoin([this.utilitiesService.getUtilities(), this.datesService.getDates()]).pipe(
          switchMap(([utilities, dates]) => {
            const perDeadline$ = deadlines.map((deadline) => {
              const utility = utilities.find((u) => u.id === deadline.utilityId);
              const date = dates.find((d) => d.id === deadline.dateId);
              const month = date ? monthNumber(date.month) : null;
              if (!utility || !date || month === null) {
                return of([] as ActiveNotification[]);
              }
              const service = utility.name as ServiceName;
              const year = Number(date.year);
              return this.getOwnerPayments(service, month, year).pipe(
                map((rows) =>
                  rows
                    .filter((row) => row.status !== 'paid' && row.status !== 'not-due')
                    .map((row) => ({
                      apartmentId: row.apartmentId,
                      apartment: row.apartment,
                      owner: row.owner,
                      service: row.service,
                      dueDate: new Date(deadline.dueDate),
                      paid: row.paid,
                      amount: row.amount,
                      status: row.status,
                      month,
                      year,
                    })),
                ),
              );
            });
            return forkJoin(perDeadline$).pipe(map((groups) => groups.flat()));
          }),
        );
      }),
    );
  }

  clearCache(): void {
    this.deadlinesCache$ = null;
    this.paymentStatusesCache$ = null;
    this.billingPeriodsCache.clear();
  }
}
