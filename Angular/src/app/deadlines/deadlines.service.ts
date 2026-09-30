import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, switchMap, tap, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';
import { DeadlineDto, DeadlineWrite, ServiceDeadline } from './deadline.model';
import { ServiceName } from '../shared/service-name';
import { UtilitiesService } from '../shared/utilities.service';
import { DatesService } from '../shared/dates.service';
import { resolveUtilityDateIds } from '../shared/resolve-utility-date-ids';

@Injectable({ providedIn: 'root' })
export class DeadlinesService {
  private readonly http = inject(HttpClient);
  private readonly utilitiesService = inject(UtilitiesService);
  private readonly datesService = inject(DatesService);

  private deadlinesCache$: Observable<DeadlineDto[]> | null = null;

  private fetchDeadlines(): Observable<DeadlineDto[]> {
    if (!this.deadlinesCache$) {
      this.deadlinesCache$ = this.http.get<DeadlineDto[]>(`${environment.apiUrl}/Deadlines`).pipe(shareReplay(1));
    }
    return this.deadlinesCache$;
  }

  /** Every Deadline row, raw - ActiveNotificationsService scans all of them
   *  (not just one service/month/year) to find every period with a deadline
   *  set, not just the current month. */
  getAllDeadlines(): Observable<DeadlineDto[]> {
    return this.fetchDeadlines();
  }

  getDeadline(service: ServiceName, month: number, year: number): Observable<ServiceDeadline | undefined> {
    return forkJoin([resolveUtilityDateIds(this.utilitiesService, this.datesService, service, month, year), this.fetchDeadlines()]).pipe(
      map(([{ utilityId, dateId }, deadlines]) => {
        const match = deadlines.find((d) => d.utilityId === utilityId && d.dateId === dateId);
        return match ? { service, month, year, dueDate: new Date(match.dueDate) } : undefined;
      }),
    );
  }

  setDeadline(service: ServiceName, month: number, year: number, dueDate: Date): Observable<void> {
    return resolveUtilityDateIds(this.utilitiesService, this.datesService, service, month, year).pipe(
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

  clearCache(): void {
    this.deadlinesCache$ = null;
  }
}
