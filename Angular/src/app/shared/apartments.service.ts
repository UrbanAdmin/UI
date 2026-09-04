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
          map((dtos) =>
            dtos.map((dto) => ({
              id: dto.id,
              number: dto.name,
              owner: dto.owner,
              contractStartDate: dto.contractStartDate,
              hasContract: dto.hasContract,
              contractFileName: dto.contractFileName,
            })),
          ),
          shareReplay(1),
        );
    }
    return this.cache$;
  }

  createApartment(number: string, owner: string, contractStartDate: string | null): Observable<void> {
    return this.http
      .post(`${environment.apiUrl}/Apartments`, { Name: number, Owner: owner, ContractStartDate: contractStartDate })
      .pipe(
        tap(() => (this.cache$ = null)),
        map(() => undefined),
      );
  }

  updateApartment(id: number, number: string, owner: string, contractStartDate: string | null): Observable<void> {
    return this.http
      .put(`${environment.apiUrl}/Apartment/${id}`, { Name: number, Owner: owner, ContractStartDate: contractStartDate })
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

  uploadContract(id: number, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${environment.apiUrl}/Apartments/${id}/Contract`, formData).pipe(
      tap(() => (this.cache$ = null)),
      map(() => undefined),
    );
  }

  downloadContract(id: number): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/Apartments/${id}/Contract`, { responseType: 'blob' });
  }
}
