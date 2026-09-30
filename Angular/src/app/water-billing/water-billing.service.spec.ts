import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { WaterBillingService } from './water-billing.service';
import { WaterBillDto, WaterBillPeriodListDto, ConfirmWaterBillResult } from './water-billing.model';
import { environment } from '../../environments/environment';

const WATER_BILLS_URL = `${environment.apiUrl}/WaterBills`;
const WATER_READINGS_URL = `${environment.apiUrl}/WaterMeterReadings`;

const EMPTY_BILL: WaterBillDto = {
  id: 1, startDate: '2026-09-10', endDate: '2026-10-07',
  totalValue: '905000', totalM3: '95', fixedAqueduct: '90000', fixedSewer: '60000',
  basicResidentialAqueduct: '500000', superiorResidentialAqueduct: '100000',
  basicResidentialSewer: '250000', superiorResidentialSewer: '50000',
  nonRentedWaterCost: '0', commonAreaWaterCost: '0',
  percentagePasses: true, percentageDifference: '0',
  meterVsBillPasses: true, meterVsBillDifference: '0',
  aqueductAllocationPasses: true, aqueductAllocationDifference: '0',
  sewerAllocationPasses: true, sewerAllocationDifference: '0',
  finalPasses: true, finalDifference: '0',
  confirmed: false, confirmedAt: null, readings: [], comments: [],
};

describe('WaterBillingService', () => {
  let service: WaterBillingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WaterBillingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('listPeriods GETs the period list', () => {
    let result: WaterBillPeriodListDto | undefined;
    service.listPeriods().subscribe((r) => (result = r));

    httpMock.expectOne(WATER_BILLS_URL).flush({
      periods: [{ id: 1, startDate: '2026-09-10', endDate: '2026-10-07', confirmed: true }],
      nextSuggestedStartDate: '2026-10-08',
    });

    expect(result?.periods.length).toBe(1);
    expect(result?.nextSuggestedStartDate).toBe('2026-10-08');
  });

  it('getBill returns the bill when the server responds 200', () => {
    let result: WaterBillDto | null | undefined;
    service.getBill(1).subscribe((r) => (result = r));

    httpMock.expectOne(`${WATER_BILLS_URL}/1`).flush(EMPTY_BILL);

    expect(result?.id).toBe(1);
  });

  it('getBill returns null (not throws) when the server responds 404', () => {
    let result: WaterBillDto | null | undefined;
    let errored = false;
    service.getBill(999).subscribe({ next: (r) => (result = r), error: () => (errored = true) });

    httpMock.expectOne(`${WATER_BILLS_URL}/999`).flush('not found', { status: 404, statusText: 'Not Found' });

    expect(result).toBeNull();
    expect(errored).toBe(false);
  });

  it('createPeriod POSTs the start and end dates', () => {
    let id: number | undefined;
    service.createPeriod('2026-09-10', '2026-10-07').subscribe((r) => (id = r));

    const req = httpMock.expectOne(WATER_BILLS_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ startDate: '2026-09-10', endDate: '2026-10-07' });
    req.flush({ id: 7 });

    expect(id).toBe(7);
  });

  it('updateBill PUTs the provided fields, including a period-date edit', () => {
    let done = false;
    service.updateBill(7, { totalM3: '95', endDate: '2026-12-10' }).subscribe(() => (done = true));

    const req = httpMock.expectOne(`${WATER_BILLS_URL}/7`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ totalM3: '95', endDate: '2026-12-10' });
    req.flush(null);

    expect(done).toBe(true);
  });

  it('createReading POSTs the waterBillId, apartmentId, and the write fields including readingDate', () => {
    let id: number | undefined;
    service.createReading(7, 101, { previousReading: '500', currentReading: '530', readingDate: '2026-09-15' }).subscribe((r) => (id = r));

    const req = httpMock.expectOne(WATER_READINGS_URL);
    expect(req.request.body).toEqual({ waterBillId: 7, apartmentId: 101, previousReading: '500', currentReading: '530', readingDate: '2026-09-15' });
    req.flush({ id: 42 });

    expect(id).toBe(42);
  });

  it('createReading POSTs a null apartmentId for the Zona Común row', () => {
    let id: number | undefined;
    service.createReading(7, null, { previousReading: '50', currentReading: '70', readingDate: '2026-09-15' }).subscribe((r) => (id = r));

    const req = httpMock.expectOne(WATER_READINGS_URL);
    expect(req.request.body).toEqual({ waterBillId: 7, apartmentId: null, previousReading: '50', currentReading: '70', readingDate: '2026-09-15' });
    req.flush({ id: 43 });

    expect(id).toBe(43);
  });

  it('updateReading PUTs the write fields', () => {
    let done = false;
    service.updateReading(42, { currentReading: '540', readingDate: '2026-09-16' }).subscribe(() => (done = true));

    const req = httpMock.expectOne(`${WATER_READINGS_URL}/42`);
    expect(req.request.method).toBe('PUT');
    req.flush(null);

    expect(done).toBe(true);
  });

  it('confirmBill resolves success on 204', () => {
    let result: ConfirmWaterBillResult | undefined;
    service.confirmBill(7).subscribe((r) => (result = r));

    httpMock.expectOne(`${WATER_BILLS_URL}/7/Confirm`).flush(null, { status: 204, statusText: 'No Content' });

    expect(result?.success).toBe(true);
  });

  it('confirmBill resolves failure with the blocked meter labels on 409, without throwing', () => {
    let result: ConfirmWaterBillResult | undefined;
    let errored = false;
    service.confirmBill(7).subscribe({ next: (r) => (result = r), error: () => (errored = true) });

    httpMock.expectOne(`${WATER_BILLS_URL}/7/Confirm`).flush(
      { blockedMeterLabels: ['101', 'Zona Común'], hasZeroArrendadoError: false },
      { status: 409, statusText: 'Conflict' },
    );

    expect(errored).toBe(false);
    expect(result?.success).toBe(false);
    expect(result?.blockedMeterLabels).toEqual(['101', 'Zona Común']);
    expect(result?.hasZeroArrendadoError).toBe(false);
  });

  it('confirmBill resolves hasZeroArrendadoError distinctly on 409', () => {
    let result: ConfirmWaterBillResult | undefined;
    service.confirmBill(7).subscribe((r) => (result = r));

    httpMock.expectOne(`${WATER_BILLS_URL}/7/Confirm`).flush(
      { blockedMeterLabels: [], hasZeroArrendadoError: true },
      { status: 409, statusText: 'Conflict' },
    );

    expect(result?.success).toBe(false);
    expect(result?.blockedMeterLabels).toEqual([]);
    expect(result?.hasZeroArrendadoError).toBe(true);
  });

  it('uploadPhoto POSTs the file as FormData', () => {
    let done = false;
    const file = new File(['x'], 'medidor.jpg', { type: 'image/jpeg' });
    service.uploadPhoto(42, file).subscribe(() => (done = true));

    const req = httpMock.expectOne(`${WATER_READINGS_URL}/42/Photo`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush(null);

    expect(done).toBe(true);
  });

  it('addComment POSTs the text and optional reading id', () => {
    let done = false;
    service.addComment(7, 'Comentario general', null).subscribe(() => (done = true));

    const req = httpMock.expectOne(`${WATER_BILLS_URL}/7/Comments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ waterMeterReadingId: null, text: 'Comentario general' });
    req.flush({ id: 1 });

    expect(done).toBe(true);
  });
});
