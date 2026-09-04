import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, of, tap, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';
import { UtilityDto } from './utility.model';

@Injectable({ providedIn: 'root' })
export class UtilitiesService {
  private readonly http = inject(HttpClient);
  private cache$: Observable<UtilityDto[]> | null = null;

  private fetchAll(): Observable<UtilityDto[]> {
    if (!this.cache$) {
      this.cache$ = this.http.get<UtilityDto[]>(`${environment.apiUrl}/Utilities`).pipe(shareReplay(1));
    }
    return this.cache$;
  }

  getUtilities(): Observable<UtilityDto[]> {
    return this.fetchAll();
  }

  /**
   * POST's response body echoes the request, not the server-assigned Id
   * (a backend quirk shared by every resource) - so after creating, this
   * refetches and finds the new row by name rather than trusting the
   * response.
   */
  getOrCreateUtility(name: string): Observable<UtilityDto> {
    return this.fetchAll().pipe(
      switchMap((utilities) => {
        const existing = utilities.find((u) => u.name === name);
        if (existing) {
          return of(existing);
        }
        return this.http.post(`${environment.apiUrl}/Utilities`, { name }).pipe(
          tap(() => (this.cache$ = null)),
          switchMap(() => this.fetchAll()),
          switchMap((refreshed) => {
            const created = refreshed.find((u) => u.name === name);
            if (!created) {
              throw new Error(`Failed to create Utility "${name}"`);
            }
            return of(created);
          }),
        );
      }),
    );
  }
}
