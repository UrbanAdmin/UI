import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, of, tap, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';
import { DateRecordDto } from './date.model';
import { monthName } from '../notifications/month-names';

@Injectable({ providedIn: 'root' })
export class DatesService {
  private readonly http = inject(HttpClient);
  private cache$: Observable<DateRecordDto[]> | null = null;

  private fetchAll(): Observable<DateRecordDto[]> {
    if (!this.cache$) {
      this.cache$ = this.http.get<DateRecordDto[]>(`${environment.apiUrl}/Dates`).pipe(shareReplay(1));
    }
    return this.cache$;
  }

  getDates(): Observable<DateRecordDto[]> {
    return this.fetchAll();
  }

  /**
   * Live data only had Dates rows through Dec 2025 as of this writing, so
   * most periods an admin opens won't exist yet - this creates them
   * transparently on first use. Same POST-doesn't-return-the-real-Id
   * workaround as UtilitiesService: refetch and find by natural key.
   */
  getOrCreateDate(month: number, year: number): Observable<DateRecordDto> {
    const monthLabel = monthName(month);
    const yearLabel = String(year);
    return this.fetchAll().pipe(
      switchMap((dates) => {
        const existing = dates.find((d) => d.month === monthLabel && d.year === yearLabel);
        if (existing) {
          return of(existing);
        }
        return this.http.post(`${environment.apiUrl}/Dates`, { month: monthLabel, year: yearLabel }).pipe(
          tap(() => (this.cache$ = null)),
          switchMap(() => this.fetchAll()),
          switchMap((refreshed) => {
            const created = refreshed.find((d) => d.month === monthLabel && d.year === yearLabel);
            if (!created) {
              throw new Error(`Failed to create Date "${monthLabel} ${yearLabel}"`);
            }
            return of(created);
          }),
        );
      }),
    );
  }
}
