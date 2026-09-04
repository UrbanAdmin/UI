import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { DatesService } from './dates.service';
import { DateRecordDto } from './date.model';
import { environment } from '../../environments/environment';

describe('DatesService', () => {
  let service: DatesService;
  let httpMock: HttpTestingController;
  const datesUrl = `${environment.apiUrl}/Dates`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DatesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('returns the existing date without POSTing when month+year already exist', () => {
    const existing: DateRecordDto[] = [{ id: 7, month: 'Diciembre', year: '2025' }];
    let result: DateRecordDto | undefined;

    service.getOrCreateDate(12, 2025).subscribe((d) => (result = d));
    httpMock.expectOne(datesUrl).flush(existing);

    expect(result).toEqual({ id: 7, month: 'Diciembre', year: '2025' });
  });

  it('creates and refetches when the period does not exist yet (e.g. 2026 dates)', () => {
    let result: DateRecordDto | undefined;

    service.getOrCreateDate(9, 2026).subscribe((d) => (result = d));

    httpMock.expectOne(datesUrl).flush([{ id: 7, month: 'Diciembre', year: '2025' }]);
    const postReq = httpMock.expectOne(datesUrl);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ month: 'Septiembre', year: '2026' });
    postReq.flush({ id: 0, month: 'Septiembre', year: '2026' });

    httpMock
      .expectOne(datesUrl)
      .flush([{ id: 7, month: 'Diciembre', year: '2025' }, { id: 8, month: 'Septiembre', year: '2026' }]);

    expect(result).toEqual({ id: 8, month: 'Septiembre', year: '2026' });
  });
});
