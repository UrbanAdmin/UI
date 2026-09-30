import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, tap, shareReplay, catchError } from 'rxjs';
import { environment } from '../../environments/environment';
import { BillingCycleDto, BillingCycleWrite, BillingPeriod } from './billing-period.model';
import { monthName } from '../notifications/month-names';

@Injectable({ providedIn: 'root' })
export class BillingPeriodsService {
  private readonly http = inject(HttpClient);

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

  clearCache(): void {
    this.billingPeriodsCache.clear();
  }
}
