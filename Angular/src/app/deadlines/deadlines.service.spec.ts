import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { DeadlinesService } from './deadlines.service';
import { environment } from '../../environments/environment';

const UTILITIES_URL = `${environment.apiUrl}/Utilities`;
const DATES_URL = `${environment.apiUrl}/Dates`;
const DEADLINES_URL = `${environment.apiUrl}/Deadlines`;

describe('DeadlinesService', () => {
  let service: DeadlinesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DeadlinesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getDeadline resolves utility/date ids and finds the matching Deadline row', () => {
    let result: { dueDate: Date } | undefined;
    service.getDeadline('Agua', 9, 2026).subscribe((d) => (result = d));

    httpMock.expectOne(UTILITIES_URL).flush([{ id: 1, name: 'Agua' }]);
    httpMock.expectOne(DATES_URL).flush([{ id: 5, month: 'Septiembre', year: '2026' }]);
    httpMock.expectOne(DEADLINES_URL).flush([{ id: 9, utilityId: 1, dateId: 5, dueDate: '2026-09-15T00:00:00' }]);

    expect(result?.dueDate.toDateString()).toBe(new Date('2026-09-15T00:00:00').toDateString());
  });

  it('setDeadline POSTs an underscore-keyed body with an ISO date when none exists yet', () => {
    const newDate = new Date('2026-09-20T00:00:00');
    service.setDeadline('Agua', 9, 2026, newDate).subscribe();

    httpMock.expectOne(UTILITIES_URL).flush([{ id: 1, name: 'Agua' }]);
    httpMock.expectOne(DATES_URL).flush([{ id: 5, month: 'Septiembre', year: '2026' }]);
    httpMock.expectOne(DEADLINES_URL).flush([]);

    const postReq = httpMock.expectOne(DEADLINES_URL);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ Utility_Id: 1, Date_Id: 5, DueDate: newDate.toISOString() });
    postReq.flush({ id: 0 });
  });

  it('getAllDeadlines returns the raw Deadline rows', () => {
    let result: { id: number }[] | undefined;
    service.getAllDeadlines().subscribe((rows) => (result = rows));

    httpMock.expectOne(DEADLINES_URL).flush([{ id: 1, utilityId: 3, dateId: 10, dueDate: '2026-01-15T00:00:00' }]);

    expect(result?.length).toBe(1);
  });

  it('clearCache forces the next Deadlines read to refetch instead of replaying stale data', () => {
    service.getDeadline('Agua', 9, 2026).subscribe();
    httpMock.expectOne(UTILITIES_URL).flush([{ id: 1, name: 'Agua' }]);
    httpMock.expectOne(DATES_URL).flush([{ id: 5, month: 'Septiembre', year: '2026' }]);
    httpMock.expectOne(DEADLINES_URL).flush([]);

    service.clearCache();

    // Utility/Date ids resolve from UtilitiesService/DatesService's own
    // caches (covered by their own clearCache tests) - only Deadlines
    // itself is this service's cache to clear, so only it refetches.
    service.getDeadline('Agua', 9, 2026).subscribe();
    httpMock.expectOne(DEADLINES_URL).flush([]);
  });
});
