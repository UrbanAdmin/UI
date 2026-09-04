import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of, switchMap, tap, shareReplay } from 'rxjs';
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

  // Evidence-photo filenames are never sent to the backend (confirmed
  // decision: the upload dialog stays UI-only, no file storage exists) -
  // kept here in memory only, so they're visible for the rest of this
  // session but reset on page reload.
  private readonly evidenceByKey = new Map<string, string>();

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

  private key(apartmentId: number, service: ServiceName, month: number, year: number): string {
    return `${apartmentId}|${service}|${month}|${year}`;
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
            evidenceFileName: this.evidenceByKey.get(this.key(apartmentId, service, month, year)) ?? null,
          };
        }),
      ),
    );
  }

  recordReading(
    apartmentId: number,
    service: ServiceName,
    month: number,
    year: number,
    counter: string | null,
    evidenceFileName: string | null,
  ): Observable<void> {
    if (evidenceFileName !== null) {
      this.evidenceByKey.set(this.key(apartmentId, service, month, year), evidenceFileName);
    }
    if (counter === null) {
      // Evidence-only save (photo dialog) - nothing to persist server-side.
      return of(undefined);
    }

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
            const write: CounterUtilityWrite = {
              Apartment_Id: apartmentId,
              Date_Id: date.id,
              Utility_Id: utility.id,
              Invoice_Id: invoice.id,
              Counter: counter,
              Difference: existing?.difference ?? '0',
              Fee: existing?.fee ?? '0',
            };
            const request$ = existing
              ? this.http.put(`${environment.apiUrl}/CounterUtility/${existing.id}`, write)
              : this.http.post(`${environment.apiUrl}/CounterUtilities`, write);
            return request$.pipe(tap(() => (this.counterUtilitiesCache$ = null)));
          }),
        ),
      ),
      map(() => undefined),
    );
  }
}
