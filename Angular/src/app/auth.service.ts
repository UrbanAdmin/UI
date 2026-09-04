import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../environments/environment';

interface LoginResponse {
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  // In-memory only, by design: never persisted to localStorage/sessionStorage
  // so a page refresh logs the user out, trading convenience for reduced
  // exposure to token theft via XSS.
  private readonly token = signal<string | null>(null);
  private readonly username = signal<string | null>(null);

  login(username: string, password: string): Observable<boolean> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { username, password })
      .pipe(
        tap((response) => {
          this.token.set(response.token);
          this.username.set(username);
        }),
        map(() => true),
        catchError(() => {
          this.token.set(null);
          this.username.set(null);
          return of(false);
        }),
      );
  }

  logout(): void {
    this.token.set(null);
    this.username.set(null);
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
