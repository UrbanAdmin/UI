import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ConfirmElectricityBillResult,
  ElectricityBillDto,
  ElectricityBillSummaryDto,
  ElectricityBillWrite,
  ElectricityMeterReadingWrite,
} from './electricity-billing.model';

@Injectable({ providedIn: 'root' })
export class ElectricityBillingService {
  private readonly http = inject(HttpClient);

  listBills(): Observable<ElectricityBillSummaryDto[]> {
    return this.http.get<ElectricityBillSummaryDto[]>(`${environment.apiUrl}/ElectricityBills`);
  }

  /** Resolves to null (not an error) when no bill is recorded for this period yet, or - for an
   *  apartment owner - when it exists but isn't confirmed yet (FR-035: same as "not recorded"). */
  getBill(dateId: number): Observable<ElectricityBillDto | null> {
    return this.http.get<ElectricityBillDto>(`${environment.apiUrl}/ElectricityBills/${dateId}`).pipe(
      catchError((err: HttpErrorResponse) => (err.status === 404 ? of(null) : throwError(() => err))),
    );
  }

  createBill(dateId: number, write: ElectricityBillWrite): Observable<number> {
    return this.http
      .post<{ id: number }>(`${environment.apiUrl}/ElectricityBills`, { dateId, ...write })
      .pipe(map((r) => r.id));
  }

  updateBill(id: number, write: ElectricityBillWrite): Observable<void> {
    return this.http.put(`${environment.apiUrl}/ElectricityBills/${id}`, write).pipe(map(() => undefined));
  }

  /** apartmentId null creates/targets the building's single Zona Común row (research.md §2). */
  createReading(electricityBillId: number, apartmentId: number | null, write: ElectricityMeterReadingWrite): Observable<number> {
    return this.http
      .post<{ id: number }>(`${environment.apiUrl}/ElectricityMeterReadings`, { electricityBillId, apartmentId, ...write })
      .pipe(map((r) => r.id));
  }

  updateReading(id: number, write: ElectricityMeterReadingWrite): Observable<void> {
    return this.http.put(`${environment.apiUrl}/ElectricityMeterReadings/${id}`, write).pipe(map(() => undefined));
  }

  uploadPhoto(readingId: number, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post(`${environment.apiUrl}/ElectricityMeterReadings/${readingId}/Photo`, formData)
      .pipe(map(() => undefined));
  }

  addComment(electricityBillId: number, text: string, electricityMeterReadingId: number | null): Observable<void> {
    return this.http
      .post(`${environment.apiUrl}/ElectricityBills/${electricityBillId}/Comments`, { electricityMeterReadingId, text })
      .pipe(map(() => undefined));
  }

  /** Resolves (never throws) with success:false plus the blocking detail on a 409, so callers don't
   *  need a separate error handler just to show FR-020/FR-039's blocking message. */
  confirmBill(id: number): Observable<ConfirmElectricityBillResult> {
    return this.http.post(`${environment.apiUrl}/ElectricityBills/${id}/Confirm`, {}).pipe(
      map(() => ({ success: true, blockedMeterLabels: [] as string[], hasZeroArrendadoError: false })),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 409) {
          const body = err.error as { blockedMeterLabels?: string[]; hasZeroArrendado?: boolean } | null;
          return of({
            success: false,
            blockedMeterLabels: body?.blockedMeterLabels ?? [],
            hasZeroArrendadoError: body?.hasZeroArrendado ?? false,
          });
        }
        return throwError(() => err);
      }),
    );
  }
}
