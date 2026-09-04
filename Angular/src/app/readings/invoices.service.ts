import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, of, tap, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';
import { InvoiceDto, InvoiceWrite } from './invoice.model';

/**
 * CounterUtility.Invoice_Id is a required FK, but no invoice-entry UI
 * exists anywhere in the app yet. This looks-up-or-creates a placeholder
 * Invoice per (utilityId, dateId), invisible to the admin - the same
 * lookup-or-create pattern as UtilitiesService/DatesService.
 */
@Injectable({ providedIn: 'root' })
export class InvoicesService {
  private readonly http = inject(HttpClient);
  private cache$: Observable<InvoiceDto[]> | null = null;

  private fetchAll(): Observable<InvoiceDto[]> {
    if (!this.cache$) {
      this.cache$ = this.http.get<InvoiceDto[]>(`${environment.apiUrl}/Invoices`).pipe(shareReplay(1));
    }
    return this.cache$;
  }

  getOrCreateInvoice(utilityId: number, dateId: number): Observable<InvoiceDto> {
    return this.fetchAll().pipe(
      switchMap((invoices) => {
        const existing = invoices.find((i) => i.utilityId === utilityId && i.dateId === dateId);
        if (existing) {
          return of(existing);
        }
        const write: InvoiceWrite = { Total_counter: '', Total: '', Date_id: dateId, Utility_id: utilityId };
        return this.http.post(`${environment.apiUrl}/Invoices`, write).pipe(
          tap(() => (this.cache$ = null)),
          switchMap(() => this.fetchAll()),
          switchMap((refreshed) => {
            const created = refreshed.find((i) => i.utilityId === utilityId && i.dateId === dateId);
            if (!created) {
              throw new Error(`Failed to create placeholder Invoice for utility ${utilityId}, date ${dateId}`);
            }
            return of(created);
          }),
        );
      }),
    );
  }
}
