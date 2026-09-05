import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { User } from './user.model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private cache$: Observable<User[]> | null = null;

  getUsers(): Observable<User[]> {
    if (!this.cache$) {
      this.cache$ = this.http.get<User[]>(`${environment.apiUrl}/Users`).pipe(shareReplay(1));
    }
    return this.cache$;
  }

  createUser(username: string, password: string, role: string, apartmentId: number | null): Observable<void> {
    return this.http
      .post(`${environment.apiUrl}/Users`, { Username: username, Password: password, Role: role, ApartmentId: apartmentId })
      .pipe(
        tap(() => (this.cache$ = null)),
        map(() => undefined),
      );
  }

  updateUser(id: number, role: string, apartmentId: number | null, newPassword: string | null): Observable<void> {
    return this.http.put(`${environment.apiUrl}/User/${id}`, { Role: role, ApartmentId: apartmentId, NewPassword: newPassword }).pipe(
      tap(() => (this.cache$ = null)),
      map(() => undefined),
    );
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete(`${environment.apiUrl}/User/${id}`).pipe(
      tap(() => (this.cache$ = null)),
      map(() => undefined),
    );
  }
}
