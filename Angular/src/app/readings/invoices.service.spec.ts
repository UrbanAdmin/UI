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
});
