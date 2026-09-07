import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, switchMap, tap, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';
import { ServiceName } from '../notifications/notification.model';
import { MeterReading } from './reading.model';
import { CounterUtilityDto, CounterUtilityWrite } from './counter-utility.model';
import { UtilitiesService } from '../shared/utilities.service';
import { DatesService } from '../shared/dates.service';
import { InvoicesService } from './invoices.service';

@Injectable({ providedIn: 'root' })
export class ReadingsService {
  private readonly http = inject(HttpClient);
  private readonly utilitiesService = inject(UtilitiesService);
  private readonly datesService = inject(DatesService);
  private readonly invoicesService = inject(InvoicesService);

  // The Lecturas tab group renders every apartment x service combination
  // eagerly (18 of them), each calling getReadings - without caching this,
  // that would fire 18 separate GET /CounterUtilities calls for the exact
  // same list. Invalidated after any successful create/update.
  private counterUtilitiesCache$: Observable<CounterUtilityDto[]> | null = null;

  private fetchCounterUtilities(): Observable<CounterUtilityDto[]> {
    if (!this.counterUtilitiesCache$) {
      this.counterUtilitiesCache$ = this.http
        .get<CounterUtilityDto[]>(`${environment.apiUrl}/CounterUtilities`)
        .pipe(shareReplay(1));
    }
    return this.counterUtilitiesCache$;
  }

  getReadings(apartmentId: number, service: ServiceName, year: number): Observable<MeterReading[]> {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return forkJoin([
      this.utilitiesService.getOrCreateUtility(service),
      forkJoin(months.map((month) => this.datesService.getOrCreateDate(month, year))),
      this.fetchCounterUtilities(),
    ]).pipe(
      map(([utility, dates, counterUtilities]) =>
        months.map((month, index) => {
          const date = dates[index];
          const match = counterUtilities.find(
            (cu) => cu.apartmentId === apartmentId && cu.utilityId === utility.id && cu.dateId === date.id,
          );
          return {
            month,
            year,
            counter: match?.counter ?? null,
            evidenceFileName: match?.photoFileName ?? null,
            fee: match?.fee ?? null,
          };
        }),
      ),
    );
  }

  /** Returns the saved reading's CounterUtility id, so a photo can be
   *  attached to it right after via uploadCounterUtilityPhoto(). */
  recordReading(
    apartmentId: number,
    service: ServiceName,
    month: number,
    year: number,
    counter: string,
  ): Observable<number> {
    return forkJoin([
      this.utilitiesService.getOrCreateUtility(service),
      this.datesService.getOrCreateDate(month, year),
    ]).pipe(
      switchMap(([utility, date]) =>
        forkJoin([
          this.invoicesService.getOrCreateInvoice(utility.id, date.id),
          this.fetchCounterUtilities(),
        ]).pipe(
          switchMap(([invoice, all]) => {
            const existing = all.find(
              (cu) => cu.apartmentId === apartmentId && cu.utilityId === utility.id && cu.dateId === date.id,
            );
            // Difference/Fee are server-computed (see Backend's
            // DifferenceCalculator/RecalculateFeesForPeriodHandler) - these
            // values are ignored on save, kept only to satisfy the write shape.
            const write: CounterUtilityWrite = {
              Apartment_Id: apartmentId,
              Date_Id: date.id,
              Utility_Id: utility.id,
              Invoice_Id: invoice.id,
              Counter: counter,
              Difference: existing?.difference ?? '0',
              Fee: existing?.fee ?? '0',
            };

            if (existing) {
              return this.http.put(`${environment.apiUrl}/CounterUtility/${existing.id}`, write).pipe(
                tap(() => (this.counterUtilitiesCache$ = null)),
                map(() => existing.id),
              );
            }
            return this.http.post(`${environment.apiUrl}/CounterUtilities`, write).pipe(
              tap(() => (this.counterUtilitiesCache$ = null)),
              switchMap(() => this.fetchCounterUtilities()),
              map((refreshed) => {
                const created = refreshed.find(
                  (cu) => cu.apartmentId === apartmentId && cu.utilityId === utility.id && cu.dateId === date.id,
                );
                if (!created) {
                  throw new Error('Failed to create CounterUtility reading');
                }
                return created.id;
              }),
            );
          }),
        ),
      ),
    );
  }

  /** Sum of every apartment's consumption Difference for a Utility+Date -
   *  the 100% denominator behind each row's proportionally-split Fee
   *  (see Backend's RecalculateFeesForPeriodHandler). Shares the same
   *  cached list getReadings() already fetches. */
  getTotalDifference(utilityId: number, dateId: number): Observable<number> {
    return this.fetchCounterUtilities().pipe(
      map((all) =>
        all
          .filter((cu) => cu.utilityId === utilityId && cu.dateId === dateId)
          .reduce((sum, cu) => sum + (Number(cu.difference) || 0), 0),
      ),
    );
  }

  /** Sends a meter photo to Backend's Tesseract OCR - a suggestion only, never trusted blind. */
  ocrPreviewCounter(file: File): Observable<{ suggestedCounter: string | null }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ suggestedCounter: string | null }>(`${environment.apiUrl}/CounterUtilities/OcrPreview`, formData);
  }

  uploadCounterUtilityPhoto(counterUtilityId: number, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${environment.apiUrl}/CounterUtility/${counterUtilityId}/Photo`, formData).pipe(map(() => undefined));
  }

  clearCache(): void {
    this.counterUtilitiesCache$ = null;
  }
}
