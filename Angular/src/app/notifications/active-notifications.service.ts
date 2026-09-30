import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { NotificationStatus, ServicePayment } from './notification.model';
import { ServiceName } from '../shared/service-name';
import { ApartmentsService } from '../shared/apartments.service';
import { UtilitiesService } from '../shared/utilities.service';
import { DatesService } from '../shared/dates.service';
import { DeadlinesService } from '../deadlines/deadlines.service';
import { OwnerPaymentsService } from '../owner-payments/owner-payments.service';
import { monthNumber } from './month-names';

export type ActiveNotification = ServicePayment & { status: NotificationStatus; month: number; year: number };

/** Composes DeadlinesService + OwnerPaymentsService into the one cross-
 *  service, cross-apartment view Notificaciones/Inicio actually need: every
 *  currently-unpaid/due charge, regardless of which service or period it
 *  belongs to. Holds no cache of its own - each call recomposes its two
 *  dependencies' already-cached reads. */
@Injectable({ providedIn: 'root' })
export class ActiveNotificationsService {
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly utilitiesService = inject(UtilitiesService);
  private readonly datesService = inject(DatesService);
  private readonly deadlinesService = inject(DeadlinesService);
  private readonly ownerPaymentsService = inject(OwnerPaymentsService);

  /** Scans every period that has a deadline set (not just the current month), so a
   *  never-marked-paid balance from an earlier or later period still shows up.
   *  Arriendo has no Deadlines-equivalent backlog to scan (see
   *  arriendoNotifications), so its notifications only look at the
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
        return this.ownerPaymentsService.getOwnerPayments('Arriendo', month, year).pipe(
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
    return this.deadlinesService.getAllDeadlines().pipe(
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
              return this.ownerPaymentsService.getOwnerPayments(service, month, year).pipe(
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
}
