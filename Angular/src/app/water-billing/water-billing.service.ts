import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ConfirmWaterBillResult,
  WaterBillDto,
  WaterBillPeriodListDto,
  WaterBillWrite,
  WaterMeterReadingWrite,
} from './water-billing.model';

@Injectable({ providedIn: 'root' })
export class WaterBillingService {
  private readonly http = inject(HttpClient);

  /** FR-047: the period list plus the suggested next start date (research.md §14). An
   *  ApartmentOwner caller is scoped server-side to confirmed periods only, with no suggestion. */
  listPeriods(): Observable<WaterBillPeriodListDto> {
    return this.http.get<WaterBillPeriodListDto>(`${environment.apiUrl}/WaterBills`);
  }

  /** Resolves to null (not an error) when no bill exists for this id, or - for an apartment owner -
   *  when it exists but isn't confirmed yet (FR-035: same as "not recorded"). */
  getBill(id: number): Observable<WaterBillDto | null> {
    return this.http.get<WaterBillDto>(`${environment.apiUrl}/WaterBills/${id}`).pipe(
      catchError((err: HttpErrorResponse) => (err.status === 404 ? of(null) : throwError(() => err))),
    );
  }

  /** FR-042/FR-043: starts a new period from its own start/end dates (contiguity-checked
   *  server-side); the eight bill figures are entered afterward via updateBill. */
  createPeriod(startDate: string, endDate: string): Observable<number> {
    return this.http
      .post<{ id: number }>(`${environment.apiUrl}/WaterBills`, { startDate, endDate })
      .pipe(map((r) => r.id));
  }

  updateBill(id: number, write: WaterBillWrite): Observable<void> {
    return this.http.put(`${environment.apiUrl}/WaterBills/${id}`, write).pipe(map(() => undefined));
  }

  /** apartmentId null creates/targets the building's single Zona Común row (research.md §2). */
  createReading(waterBillId: number, apartmentId: number | null, write: WaterMeterReadingWrite): Observable<number> {
    return this.http
      .post<{ id: number }>(`${environment.apiUrl}/WaterMeterReadings`, { waterBillId, apartmentId, ...write })
      .pipe(map((r) => r.id));
  }

  updateReading(id: number, write: WaterMeterReadingWrite): Observable<void> {
    return this.http.put(`${environment.apiUrl}/WaterMeterReadings/${id}`, write).pipe(map(() => undefined));
  }

  uploadPhoto(readingId: number, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post(`${environment.apiUrl}/WaterMeterReadings/${readingId}/Photo`, formData)
      .pipe(map(() => undefined));
  }

  addComment(waterBillId: number, text: string, waterMeterReadingId: number | null): Observable<void> {
    return this.http
      .post(`${environment.apiUrl}/WaterBills/${waterBillId}/Comments`, { waterMeterReadingId, text })
      .pipe(map(() => undefined));
  }

  /** Resolves (never throws) with success:false plus the blocking detail on a 409, so callers don't
   *  need a separate error handler just to show FR-038's blocking message. */
  confirmBill(id: number): Observable<ConfirmWaterBillResult> {
    return this.http.post(`${environment.apiUrl}/WaterBills/${id}/Confirm`, {}).pipe(
      map(() => ({ success: true, blockedMeterLabels: [] as string[], hasZeroArrendadoError: false })),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 409) {
          const body = err.error as { blockedMeterLabels?: string[]; hasZeroArrendadoError?: boolean } | null;
          return of({
            success: false,
            blockedMeterLabels: body?.blockedMeterLabels ?? [],
            hasZeroArrendadoError: body?.hasZeroArrendadoError ?? false,
          });
        }
        return throwError(() => err);
      }),
    );
  }
}
