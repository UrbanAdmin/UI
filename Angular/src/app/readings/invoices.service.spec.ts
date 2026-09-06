import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { InvoicesService } from './invoices.service';
import { InvoiceDto } from './invoice.model';
import { environment } from '../../environments/environment';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let httpMock: HttpTestingController;
  const invoicesUrl = `${environment.apiUrl}/Invoices`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InvoicesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('returns the existing invoice without POSTing when one already exists for (utilityId, dateId)', () => {
    const existing: InvoiceDto[] = [{ id: 1, totalCounter: '15', total: '30000', dateId: 1, utilityId: 1 }];
    let result: InvoiceDto | undefined;

    service.getOrCreateInvoice(1, 1).subscribe((i) => (result = i));
    httpMock.expectOne(invoicesUrl).flush(existing);

    expect(result).toEqual(existing[0]);
  });

  it('creates a placeholder invoice with underscore-keyed body when none exists', () => {
    let result: InvoiceDto | undefined;

    service.getOrCreateInvoice(3, 5).subscribe((i) => (result = i));

    httpMock.expectOne(invoicesUrl).flush([]);
    const postReq = httpMock.expectOne(invoicesUrl);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ Total_counter: '', Total: '', Date_id: 5, Utility_id: 3 });
    postReq.flush({ id: 0, totalCounter: '', total: '', dateId: 5, utilityId: 3 });

    httpMock
      .expectOne(invoicesUrl)
      .flush([{ id: 9, totalCounter: '', total: '', dateId: 5, utilityId: 3 }]);

    expect(result).toEqual({ id: 9, totalCounter: '', total: '', dateId: 5, utilityId: 3 });
  });

  it('clearCache forces the next getOrCreateInvoice lookup to refetch instead of replaying stale data', () => {
    service.getOrCreateInvoice(1, 1).subscribe();
    httpMock.expectOne(invoicesUrl).flush([{ id: 1, totalCounter: '15', total: '30000', dateId: 1, utilityId: 1 }]);

    service.clearCache();

    let result: InvoiceDto | undefined;
    service.getOrCreateInvoice(1, 1).subscribe((i) => (result = i));
    httpMock.expectOne(invoicesUrl).flush([]);
    httpMock.expectOne(invoicesUrl).flush({ id: 0, totalCounter: '', total: '', dateId: 1, utilityId: 1 });
    httpMock.expectOne(invoicesUrl).flush([{ id: 2, totalCounter: '', total: '', dateId: 1, utilityId: 1 }]);

    expect(result).toEqual({ id: 2, totalCounter: '', total: '', dateId: 1, utilityId: 1 });
  });

  it('setTotal gets-or-creates the invoice then PUTs the confirmed Total', () => {
    let result: number | undefined;

    service.setTotal(3, 5, '95000').subscribe((id) => (result = id));

    httpMock.expectOne(invoicesUrl).flush([{ id: 9, totalCounter: '', total: '', dateId: 5, utilityId: 3 }]);
    const putReq = httpMock.expectOne(`${environment.apiUrl}/Invoice/9`);
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body).toEqual({ Total_counter: '', Total: '95000', Date_id: 5, Utility_id: 3 });
    putReq.flush({});

    expect(result).toBe(9);
  });

  it('ocrPreviewTotal POSTs the file as FormData and returns the suggestion', () => {
    let result: { suggestedTotal: string | null } | undefined;
    const file = new File(['x'], 'recibo.pdf', { type: 'application/pdf' });

    service.ocrPreviewTotal(file).subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${environment.apiUrl}/Invoices/OcrPreview`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ suggestedTotal: '95000' });

    expect(result?.suggestedTotal).toBe('95000');
  });

  it('uploadReceipt POSTs the file as FormData to the Invoice receipt endpoint', () => {
    let done = false;
    const file = new File(['x'], 'recibo.pdf', { type: 'application/pdf' });

    service.uploadReceipt(9, file).subscribe(() => (done = true));

    const req = httpMock.expectOne(`${environment.apiUrl}/Invoice/9/Receipt`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush(null);

    expect(done).toBe(true);
  });
});
