import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, switchMap, tap, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';
import { getNotificationStatus } from '../notifications/notification-status';
import { NotificationStatus } from '../notifications/notification.model';
import { OwnerPayment, PaymentStatusDto, PaymentStatusWrite, sentinelDueDate } from './owner-payment.model';
import { ServiceName } from '../shared/service-name';
import { ApartmentsService } from '../shared/apartments.service';
import { UtilitiesService } from '../shared/utilities.service';
import { DatesService } from '../shared/dates.service';
import { resolveUtilityDateIds } from '../shared/resolve-utility-date-ids';
import { DeadlinesService } from '../deadlines/deadlines.service';
import { rentDueDate } from './rent-due-date';

@Injectable({ providedIn: 'root' })
export class OwnerPaymentsService {
  private readonly http = inject(HttpClient);
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly utilitiesService = inject(UtilitiesService);
  private readonly datesService = inject(DatesService);
  private readonly deadlinesService = inject(DeadlinesService);

  private paymentStatusesCache$: Observable<PaymentStatusDto[]> | null = null;

  private fetchPaymentStatuses(): Observable<PaymentStatusDto[]> {
    if (!this.paymentStatusesCache$) {
      this.paymentStatusesCache$ = this.http
        .get<PaymentStatusDto[]>(`${environment.apiUrl}/PaymentStatuses`)
        .pipe(shareReplay(1));
    }
    return this.paymentStatusesCache$;
  }

  /** Every PaymentStatus row, raw - ActiveNotificationsService's Arriendo
   *  scan needs the full list, same reason DeadlinesService.getAllDeadlines
   *  exists. */
  getAllPaymentStatuses(): Observable<PaymentStatusDto[]> {
    return this.fetchPaymentStatuses();
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
      resolveUtilityDateIds(this.utilitiesService, this.datesService, service, month, year),
      this.apartmentsService.getApartments(),
      this.fetchPaymentStatuses(),
      this.deadlinesService.getDeadline(service, month, year),
    ]).pipe(
      map(([{ utilityId, dateId }, apartments, paymentStatuses, deadline]) =>
        apartments.map((apartment) => {
          const existing = paymentStatuses.find(
            (p) => p.apartmentId === apartment.id && p.utilityId === utilityId && p.dateId === dateId,
          );
          const paid = existing?.paid ?? false;
          const amount = existing?.amount ?? null;
          const dueDate = deadline?.dueDate ?? sentinelDueDate();
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
      resolveUtilityDateIds(this.utilitiesService, this.datesService, 'Arriendo', month, year),
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
    return resolveUtilityDateIds(this.utilitiesService, this.datesService, service, month, year).pipe(
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
    return resolveUtilityDateIds(this.utilitiesService, this.datesService, service, month, year).pipe(
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

  clearCache(): void {
    this.paymentStatusesCache$ = null;
  }
}
