import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { GasBillingService } from './gas-billing.service';
import { GasBillDto, GasBillSummaryDto, ConfirmGasBillResult } from './gas-billing.model';
import { environment } from '../../environments/environment';

const GAS_BILLS_URL = `${environment.apiUrl}/GasBills`;
const GAS_READINGS_URL = `${environment.apiUrl}/GasApartmentReadings`;

describe('GasBillingService', () => {
  let service: GasBillingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GasBillingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('listBills GETs the period list', () => {
    let result: GasBillSummaryDto[] | undefined;
    service.listBills().subscribe((r) => (result = r));

    httpMock.expectOne(GAS_BILLS_URL).flush([{ dateId: 1, month: 'Enero', year: '2027', confirmed: false }]);

    expect(result?.length).toBe(1);
  });

  it('getBill returns the bill when the server responds 200', () => {
    let result: GasBillDto | null | undefined;
    service.getBill(1).subscribe((r) => (result = r));

    const bill: GasBillDto = {
      id: 1, dateId: 1, totalConsumption: '45', unitPrice: '3800', consumoGasSubtotal: null,
      fixedCharge: '18000', otherConcepts: null, ajusteDecena: null, totalAmount: '191500',
      administrationAmount: '0', percentagePasses: true, percentageDifference: '0',
      totalPasses: true, totalDifference: '0', confirmed: false, confirmedAt: null,
      readings: [], comments: [],
    };
    httpMock.expectOne(`${GAS_BILLS_URL}/1`).flush(bill);

    expect(result?.id).toBe(1);
  });

  it('getBill returns null (not throws) when the server responds 404', () => {
    let result: GasBillDto | null | undefined;
    let errored = false;
    service.getBill(999).subscribe({ next: (r) => (result = r), error: () => (errored = true) });

    httpMock.expectOne(`${GAS_BILLS_URL}/999`).flush('not found', { status: 404, statusText: 'Not Found' });

    expect(result).toBeNull();
    expect(errored).toBe(false);
  });

  it('createBill POSTs the dateId plus whatever fields are provided', () => {
    let id: number | undefined;
    service.createBill(1, { totalConsumption: '45' }).subscribe((r) => (id = r));

    const req = httpMock.expectOne(GAS_BILLS_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ dateId: 1, totalConsumption: '45' });
    req.flush({ id: 7 });

    expect(id).toBe(7);
  });

  it('updateBill PUTs the provided fields', () => {
    let done = false;
    service.updateBill(7, { fixedCharge: '18000' }).subscribe(() => (done = true));

    const req = httpMock.expectOne(`${GAS_BILLS_URL}/7`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ fixedCharge: '18000' });
    req.flush(null);

    expect(done).toBe(true);
  });

  it('createReading POSTs the gasBillId, apartmentId and the write fields', () => {
    let id: number | undefined;
    service.createReading(7, 101, { isNewTenant: false, currentReading: '30' }).subscribe((r) => (id = r));

    const req = httpMock.expectOne(GAS_READINGS_URL);
    expect(req.request.body).toEqual({ gasBillId: 7, apartmentId: 101, isNewTenant: false, currentReading: '30' });
    req.flush({ id: 42 });

    expect(id).toBe(42);
  });

  it('updateReading PUTs the write fields', () => {
    let done = false;
    service.updateReading(42, { isNewTenant: true, initialReading: '500', currentReading: '510' }).subscribe(() => (done = true));

    const req = httpMock.expectOne(`${GAS_READINGS_URL}/42`);
    expect(req.request.method).toBe('PUT');
    req.flush(null);

    expect(done).toBe(true);
  });

  it('confirmBill resolves success on 204', () => {
    let result: ConfirmGasBillResult | undefined;
    service.confirmBill(7).subscribe((r) => (result = r));

    httpMock.expectOne(`${GAS_BILLS_URL}/7/Confirm`).flush(null, { status: 204, statusText: 'No Content' });

    expect(result?.success).toBe(true);
  });

  it('confirmBill resolves failure with the blocked apartment numbers on 409, without throwing', () => {
    let result: ConfirmGasBillResult | undefined;
    let errored = false;
    service.confirmBill(7).subscribe({ next: (r) => (result = r), error: () => (errored = true) });

    httpMock.expectOne(`${GAS_BILLS_URL}/7/Confirm`).flush(['101', '105'], { status: 409, statusText: 'Conflict' });

    expect(errored).toBe(false);
    expect(result?.success).toBe(false);
    expect(result?.blockedApartmentNumbers).toEqual(['101', '105']);
  });

  it('uploadPhoto POSTs the file as FormData', () => {
    let done = false;
    const file = new File(['x'], 'medidor.jpg', { type: 'image/jpeg' });
    service.uploadPhoto(42, file).subscribe(() => (done = true));

    const req = httpMock.expectOne(`${GAS_READINGS_URL}/42/Photo`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush(null);

    expect(done).toBe(true);
  });

  it('addComment POSTs the text and optional reading id', () => {
    let done = false;
    service.addComment(7, 'Comentario general', null).subscribe(() => (done = true));

    const req = httpMock.expectOne(`${GAS_BILLS_URL}/7/Comments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ gasApartmentReadingId: null, text: 'Comentario general' });
    req.flush({ id: 1 });

    expect(done).toBe(true);
  });
});
