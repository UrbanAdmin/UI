import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of, switchMap, tap, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';
import { getNotificationStatus } from './notification-status';
import {
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
import { monthNumber } from './month-names';

type ActiveNotification = ServicePayment & { status: NotificationStatus; month: number; year: number };

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly utilitiesService = inject(UtilitiesService);
  private readonly datesService = inject(DatesService);

  private deadlinesCache$: Observable<DeadlineDto[]> | null = null;
  private paymentStatusesCache$: Observable<PaymentStatusDto[]> | null = null;

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
          const status = deadline
            ? getNotificationStatus(
                {
                  apartmentId: apartment.id,
                  apartment: apartment.number,
                  owner: apartment.owner,
                  service,
                  dueDate: deadline.dueDate,
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
            status,
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
            const write: PaymentStatusWrite = { Apartment_Id: apartmentId, Utility_Id: utilityId, Date_Id: dateId, Paid: paid };
            const request$ = existing
              ? this.http.put(`${environment.apiUrl}/PaymentStatus/${existing.id}`, write)
              : this.http.post(`${environment.apiUrl}/PaymentStatuses`, write);
            return request$.pipe(tap(() => (this.paymentStatusesCache$ = null)));
          }),
        ),
      ),
      map(() => undefined),
    );
  }

  /** Scans every period that has a deadline set (not just the current month), so a
   *  never-marked-paid balance from an earlier or later period still shows up. */
  getActiveNotifications(): Observable<ActiveNotification[]> {
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
}
