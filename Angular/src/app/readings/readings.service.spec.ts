import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { ReadingsService } from './readings.service';
import { CounterUtilityDto } from './counter-utility.model';
import { environment } from '../../environments/environment';

const UTILITIES_URL = `${environment.apiUrl}/Utilities`;
const DATES_URL = `${environment.apiUrl}/Dates`;
const COUNTER_UTILITIES_URL = `${environment.apiUrl}/CounterUtilities`;
const INVOICES_URL = `${environment.apiUrl}/Invoices`;

const FULL_YEAR_DATES = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  month: [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ][i],
  year: '2026',
}));

describe('ReadingsService', () => {
  let service: ReadingsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReadingsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getReadings returns 12 months, gap-filled with null counter where no CounterUtility row matches', () => {
    let result: { month: number; counter: string | null }[] | undefined;

    service.getReadings(1, 'Agua', 2026).subscribe((rows) => (result = rows));

    httpMock.expectOne(UTILITIES_URL).flush([{ id: 1, name: 'Agua' }]);
    httpMock.expectOne(DATES_URL).flush(FULL_YEAR_DATES);
    const counterUtilities: CounterUtilityDto[] = [
      { id: 1, apartmentId: 1, utilityId: 1, dateId: 3, invoiceId: 1, counter: '1520', difference: '15', fee: '12500' },
    ];
    httpMock.expectOne(COUNTER_UTILITIES_URL).flush(counterUtilities);

    expect(result?.length).toBe(12);
    expect(result?.find((r) => r.month === 3)?.counter).toBe('1520');
    expect(result?.find((r) => r.month === 1)?.counter).toBeNull();
  });

  it('recordReading creates a new CounterUtility with underscore-keyed body when none exists', () => {
    let done = false;
    service.recordReading(1, 'Agua', 3, 2026, '1520', null).subscribe(() => (done = true));

    httpMock.expectOne(UTILITIES_URL).flush([{ id: 1, name: 'Agua' }]);
    httpMock.expectOne(DATES_URL).flush(FULL_YEAR_DATES);
    httpMock.expectOne(INVOICES_URL).flush([{ id: 5, totalCounter: '', total: '', dateId: 3, utilityId: 1 }]);
    httpMock.expectOne(COUNTER_UTILITIES_URL).flush([]);

    const postReq = httpMock.expectOne(COUNTER_UTILITIES_URL);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({
      Apartment_Id: 1,
      Date_Id: 3,
      Utility_Id: 1,
      Invoice_Id: 5,
      Counter: '1520',
      Difference: '0',
      Fee: '0',
    });
    postReq.flush({ id: 0 });

    expect(done).toBe(true);
  });

  it('recordReading updates the existing CounterUtility (PUT) when one already exists', () => {
    service.recordReading(1, 'Agua', 3, 2026, '1600', null).subscribe();

    httpMock.expectOne(UTILITIES_URL).flush([{ id: 1, name: 'Agua' }]);
    httpMock.expectOne(DATES_URL).flush(FULL_YEAR_DATES);
    httpMock.expectOne(INVOICES_URL).flush([{ id: 5, totalCounter: '', total: '', dateId: 3, utilityId: 1 }]);
    const existing: CounterUtilityDto[] = [
      { id: 9, apartmentId: 1, utilityId: 1, dateId: 3, invoiceId: 5, counter: '1520', difference: '15', fee: '12500' },
    ];
    httpMock.expectOne(COUNTER_UTILITIES_URL).flush(existing);

    const putReq = httpMock.expectOne(`${environment.apiUrl}/CounterUtility/9`);
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body).toEqual({
      Apartment_Id: 1,
      Date_Id: 3,
      Utility_Id: 1,
      Invoice_Id: 5,
      Counter: '1600',
      Difference: '15',
      Fee: '12500',
    });
    putReq.flush({});
  });

  it('recordReading with a null counter (evidence-only save) never calls the CounterUtilities API', () => {
    let done = false;
    service.recordReading(1, 'Agua', 3, 2026, null, 'foto.jpg').subscribe(() => (done = true));

    httpMock.expectNone(UTILITIES_URL);
    httpMock.expectNone(COUNTER_UTILITIES_URL);
    expect(done).toBe(true);
  });

  it('getReadings overlays an in-memory evidenceFileName after an evidence-only recordReading', () => {
    service.recordReading(1, 'Agua', 3, 2026, null, 'foto.jpg').subscribe();

    let result: { month: number; evidenceFileName: string | null }[] | undefined;
    service.getReadings(1, 'Agua', 2026).subscribe((rows) => (result = rows));

    httpMock.expectOne(UTILITIES_URL).flush([{ id: 1, name: 'Agua' }]);
    httpMock.expectOne(DATES_URL).flush(FULL_YEAR_DATES);
    httpMock.expectOne(COUNTER_UTILITIES_URL).flush([]);

    expect(result?.find((r) => r.month === 3)?.evidenceFileName).toBe('foto.jpg');
    expect(result?.find((r) => r.month === 1)?.evidenceFileName).toBeNull();
  });
});
