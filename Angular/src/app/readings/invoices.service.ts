import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, map, of, tap, shareReplay } from 'rxjs';
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

  /** Read-only lookup - unlike getOrCreateInvoice, never creates a placeholder,
   *  so it's safe to call just from browsing the Servicio/Mes/Año filters. */
  findInvoice(utilityId: number, dateId: number): Observable<InvoiceDto | undefined> {
    return this.fetchAll().pipe(
      map((invoices) => invoices.find((i) => i.utilityId === utilityId && i.dateId === dateId)),
    );
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

  /** Sets the real bill Total (get-or-create the placeholder Invoice first),
   *  triggering Backend's fee recalculation for every apartment on that
   *  Utility+Date - returns the Invoice id so a receipt can be attached next. */
  setTotal(utilityId: number, dateId: number, total: string): Observable<number> {
    return this.getOrCreateInvoice(utilityId, dateId).pipe(
      switchMap((invoice) => {
        const write: InvoiceWrite = { Total_counter: invoice.totalCounter, Total: total, Date_id: dateId, Utility_id: utilityId };
        return this.http.put(`${environment.apiUrl}/Invoice/${invoice.id}`, write).pipe(
          tap(() => (this.cache$ = null)),
          map(() => invoice.id),
        );
      }),
    );
  }

  /** Sends a receipt (real digital PDF or a photo) to Backend, which extracts
   *  the PDF's real text or runs OCR on a photo - a suggestion only. */
  ocrPreviewTotal(file: File): Observable<{ suggestedTotal: string | null }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ suggestedTotal: string | null }>(`${environment.apiUrl}/Invoices/OcrPreview`, formData);
  }

  uploadReceipt(invoiceId: number, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${environment.apiUrl}/Invoice/${invoiceId}/Receipt`, formData).pipe(map(() => undefined));
  }

  clearCache(): void {
    this.cache$ = null;
  }
}
