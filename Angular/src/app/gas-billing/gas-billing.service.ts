import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ConfirmGasBillResult,
  GasApartmentReadingWrite,
  GasBillDto,
  GasBillSummaryDto,
  GasBillWrite,
} from './gas-billing.model';

@Injectable({ providedIn: 'root' })
export class GasBillingService {
  private readonly http = inject(HttpClient);

  listBills(): Observable<GasBillSummaryDto[]> {
    return this.http.get<GasBillSummaryDto[]>(`${environment.apiUrl}/GasBills`);
  }

  /** Resolves to null (not an error) when no bill is recorded for this period yet, or - for an
   *  apartment owner - when it exists but isn't confirmed yet (FR-028c: same as "not recorded"). */
  getBill(dateId: number): Observable<GasBillDto | null> {
    return this.http.get<GasBillDto>(`${environment.apiUrl}/GasBills/${dateId}`).pipe(
      catchError((err: HttpErrorResponse) => (err.status === 404 ? of(null) : throwError(() => err))),
    );
  }

  createBill(dateId: number, write: GasBillWrite): Observable<number> {
    return this.http
      .post<{ id: number }>(`${environment.apiUrl}/GasBills`, { dateId, ...write })
      .pipe(map((r) => r.id));
  }

  updateBill(id: number, write: GasBillWrite): Observable<void> {
    return this.http.put(`${environment.apiUrl}/GasBills/${id}`, write).pipe(map(() => undefined));
  }

  createReading(gasBillId: number, apartmentId: number, write: GasApartmentReadingWrite): Observable<number> {
    return this.http
      .post<{ id: number }>(`${environment.apiUrl}/GasApartmentReadings`, { gasBillId, apartmentId, ...write })
      .pipe(map((r) => r.id));
  }

  updateReading(id: number, write: GasApartmentReadingWrite): Observable<void> {
    return this.http.put(`${environment.apiUrl}/GasApartmentReadings/${id}`, write).pipe(map(() => undefined));
  }

  uploadPhoto(readingId: number, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post(`${environment.apiUrl}/GasApartmentReadings/${readingId}/Photo`, formData)
      .pipe(map(() => undefined));
  }

  addComment(gasBillId: number, text: string, gasApartmentReadingId: number | null): Observable<void> {
    return this.http
      .post(`${environment.apiUrl}/GasBills/${gasBillId}/Comments`, { gasApartmentReadingId, text })
      .pipe(map(() => undefined));
  }

  /** Resolves (never throws) with success:false and the blocked apartment numbers on a 409, so
   *  callers don't need a separate error handler just to show FR-031's blocking message. */
  confirmBill(id: number): Observable<ConfirmGasBillResult> {
    return this.http.post(`${environment.apiUrl}/GasBills/${id}/Confirm`, {}).pipe(
      map(() => ({ success: true, blockedApartmentNumbers: [] as string[] })),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 409) {
          return of({ success: false, blockedApartmentNumbers: (err.error as string[]) ?? [] });
        }
        return throwError(() => err);
      }),
    );
  }
}
