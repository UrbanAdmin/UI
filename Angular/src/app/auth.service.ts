import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../environments/environment';

interface LoginResponse {
  token: string;
}

const ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

// JWT signature isn't verified here - the backend is the real enforcement
// point (see the AdminOnly policy on Apartments' write endpoints). This
// decode is only used to decide what the UI shows, never to authorize
// anything by itself.
function decodeRole(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(json);
    return claims[ROLE_CLAIM] ?? null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  // In-memory only, by design: never persisted to localStorage/sessionStorage
  // so a page refresh logs the user out, trading convenience for reduced
  // exposure to token theft via XSS.
  private readonly token = signal<string | null>(null);
  private readonly username = signal<string | null>(null);
  private readonly role = signal<string | null>(null);

  login(username: string, password: string): Observable<boolean> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { username, password })
      .pipe(
        tap((response) => {
          this.token.set(response.token);
          this.username.set(username);
          this.role.set(decodeRole(response.token));
        }),
        map(() => true),
        catchError(() => {
          this.token.set(null);
          this.username.set(null);
          this.role.set(null);
          return of(false);
        }),
      );
  }

  logout(): void {
    this.token.set(null);
    this.username.set(null);
    this.role.set(null);
  }

  isAdmin(): boolean {
    return this.role() === 'Admin';
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
