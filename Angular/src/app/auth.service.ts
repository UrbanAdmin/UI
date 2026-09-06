import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../environments/environment';
import { ApartmentsService } from './shared/apartments.service';
import { UsersService } from './shared/users.service';
import { NotificationsService } from './notifications/notifications.service';
import { ReadingsService } from './readings/readings.service';
import { InvoicesService } from './readings/invoices.service';
import { DatesService } from './shared/dates.service';
import { UtilitiesService } from './shared/utilities.service';

interface LoginResponse {
  token: string;
}

const ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

// JWT signature isn't verified here - the backend is the real enforcement
// point (see the AdminOnly policy on Apartments' write endpoints, and the
// owner-scoped filtering on GET /Apartments et al). This decode is only
// used to decide what the UI shows, never to authorize anything by itself.
function decodeClaims(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  // Every service below holds an in-memory HTTP response cache
  // (shareReplay/cache$) that has no idea a login/logout happened - without
  // clearing them here, a second identity in the same tab could silently
  // reuse the previous identity's cached responses (e.g. an ApartmentOwner
  // seeing an Admin's full apartments list that was fetched and cached
  // before the switch).
  private readonly cacheClearingServices = [
    inject(ApartmentsService),
    inject(UsersService),
    inject(NotificationsService),
    inject(ReadingsService),
    inject(InvoicesService),
    inject(DatesService),
    inject(UtilitiesService),
  ];

  // In-memory only, by design: never persisted to localStorage/sessionStorage
  // so a page refresh logs the user out, trading convenience for reduced
  // exposure to token theft via XSS.
  private readonly token = signal<string | null>(null);
  private readonly username = signal<string | null>(null);
  private readonly role = signal<string | null>(null);
  private readonly apartmentId = signal<number | null>(null);

  private clearAllCaches(): void {
    this.cacheClearingServices.forEach((service) => service.clearCache());
  }

  login(username: string, password: string): Observable<boolean> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { username, password })
      .pipe(
        tap((response) => {
          this.clearAllCaches();
          const claims = decodeClaims(response.token);
          this.token.set(response.token);
          this.username.set(username);
          this.role.set((claims?.[ROLE_CLAIM] as string) ?? null);
          const apartmentId = claims?.['ApartmentId'];
          this.apartmentId.set(typeof apartmentId === 'string' ? Number(apartmentId) : null);
        }),
        map(() => true),
        catchError(() => {
          this.clearAllCaches();
          this.token.set(null);
          this.username.set(null);
          this.role.set(null);
          this.apartmentId.set(null);
          return of(false);
        }),
      );
  }

  logout(): void {
    this.clearAllCaches();
    this.token.set(null);
    this.username.set(null);
    this.role.set(null);
    this.apartmentId.set(null);
  }

  isAdmin(): boolean {
    return this.role() === 'Admin';
  }

  isApartmentOwner(): boolean {
    return this.role() === 'ApartmentOwner';
  }

  getOwnApartmentId(): number | null {
    return this.apartmentId();
  }

  isLoggedIn(): boolean {
    return this.token() !== null;
  }

  getUsername(): string | null {
    return this.username();
  }

  getToken(): string | null {
    return this.token();
  }
}
