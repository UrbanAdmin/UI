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

  it('two concurrent getOrCreateDate calls for the same missing period share one POST instead of racing into duplicates', () => {
    let resultA: DateRecordDto | undefined;
    let resultB: DateRecordDto | undefined;

    // Mirrors counter-utilities.component's eager render, which fires many
    // concurrent getOrCreateDate calls for the same month across apartments -
    // without de-duping in-flight creates, each one independently sees "not
    // found" (before the first POST's refetch lands) and creates its own
    // duplicate Dates row.
    service.getOrCreateDate(9, 2026).subscribe((d) => (resultA = d));
    service.getOrCreateDate(9, 2026).subscribe((d) => (resultB = d));

    httpMock.expectOne(datesUrl).flush([]);

    const postReq = httpMock.expectOne(datesUrl);
    expect(postReq.request.method).toBe('POST');
    postReq.flush({ id: 0, month: 'Septiembre', year: '2026' });

    httpMock.expectOne(datesUrl).flush([{ id: 8, month: 'Septiembre', year: '2026' }]);

    expect(resultA).toEqual({ id: 8, month: 'Septiembre', year: '2026' });
    expect(resultB).toEqual({ id: 8, month: 'Septiembre', year: '2026' });
  });

  it('clearCache forces the next getDates call to refetch instead of replaying stale data', () => {
    service.getDates().subscribe();
    httpMock.expectOne(datesUrl).flush([{ id: 7, month: 'Diciembre', year: '2025' }]);

    service.clearCache();

    let result: DateRecordDto[] | undefined;
    service.getDates().subscribe((r) => (result = r));
    httpMock.expectOne(datesUrl).flush([]);

    expect(result).toEqual([]);
  });
});
