import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Apartment, ApartmentDto } from './apartment.model';

@Injectable({ providedIn: 'root' })
export class ApartmentsService {
  private readonly http = inject(HttpClient);
  private cache$: Observable<Apartment[]> | null = null;

  getApartments(): Observable<Apartment[]> {
    if (!this.cache$) {
      this.cache$ = this.http
        .get<ApartmentDto[]>(`${environment.apiUrl}/Apartments`)
        .pipe(
          map((dtos) => dtos.map((dto) => ({ id: dto.id, number: dto.name, owner: dto.owner }))),
          shareReplay(1),
        );
    }
    return this.cache$;
  }

  createApartment(number: string, owner: string): Observable<void> {
    return this.http
      .post(`${environment.apiUrl}/Apartments`, { Name: number, Owner: owner })
      .pipe(
        tap(() => (this.cache$ = null)),
        map(() => undefined),
      );
  }

  updateApartment(id: number, number: string, owner: string): Observable<void> {
    return this.http
      .put(`${environment.apiUrl}/Apartment/${id}`, { Name: number, Owner: owner })
      .pipe(
        tap(() => (this.cache$ = null)),
        map(() => undefined),
      );
  }

  deleteApartment(id: number): Observable<void> {
    return this.http.delete(`${environment.apiUrl}/Apartment/${id}`).pipe(
      tap(() => (this.cache$ = null)),
      map(() => undefined),
    );
  }
}
