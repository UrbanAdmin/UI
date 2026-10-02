import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { ElectricityBillingService } from './electricity-billing.service';
import { ElectricityBillDto, ElectricityBillSummaryDto, ConfirmElectricityBillResult } from './electricity-billing.model';
import { environment } from '../../environments/environment';

const ELECTRICITY_BILLS_URL = `${environment.apiUrl}/ElectricityBills`;
const ELECTRICITY_READINGS_URL = `${environment.apiUrl}/ElectricityMeterReadings`;

describe('ElectricityBillingService', () => {
  let service: ElectricityBillingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ElectricityBillingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('listBills GETs the period list', () => {
    let result: ElectricityBillSummaryDto[] | undefined;
    service.listBills().subscribe((r) => (result = r));

    httpMock.expectOne(ELECTRICITY_BILLS_URL).flush([{ dateId: 1, month: 'Enero', year: '2027', confirmed: false }]);

    expect(result?.length).toBe(1);
  });

  it('getBill returns the bill when the server responds 200', () => {
    let result: ElectricityBillDto | null | undefined;
    service.getBill(1).subscribe((r) => (result = r));

    const bill: ElectricityBillDto = {
      id: 1, dateId: 1, totalConsumptionKwh: '1200', electricityConsumptionValue: '612000', aseoValue: '90000',
      totalAmount: '702000', nonRentedElectricityCost: '0', commonAreaElectricityCost: '0',
      percentagePasses: true, percentageDifference: '0', meterVsBillPasses: true, meterVsBillDifference: '0',
      allocationPasses: true, allocationDifference: '0', finalPasses: true, finalDifference: '0',
      confirmed: false, confirmedAt: null, readings: [], comments: [],
    };
    httpMock.expectOne(`${ELECTRICITY_BILLS_URL}/1`).flush(bill);

    expect(result?.id).toBe(1);
  });

  it('getBill returns null (not throws) when the server responds 404', () => {
    let result: ElectricityBillDto | null | undefined;
    let errored = false;
    service.getBill(999).subscribe({ next: (r) => (result = r), error: () => (errored = true) });

    httpMock.expectOne(`${ELECTRICITY_BILLS_URL}/999`).flush('not found', { status: 404, statusText: 'Not Found' });

    expect(result).toBeNull();
    expect(errored).toBe(false);
  });

  it('createBill POSTs the dateId plus whatever fields are provided', () => {
    let id: number | undefined;
    service.createBill(1, { totalConsumptionKwh: '1200' }).subscribe((r) => (id = r));

    const req = httpMock.expectOne(ELECTRICITY_BILLS_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ dateId: 1, totalConsumptionKwh: '1200' });
    req.flush({ id: 7 });

    expect(id).toBe(7);
  });

  it('updateBill PUTs the provided fields', () => {
    let done = false;
    service.updateBill(7, { aseoValue: '90000' }).subscribe(() => (done = true));

    const req = httpMock.expectOne(`${ELECTRICITY_BILLS_URL}/7`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ aseoValue: '90000' });
    req.flush(null);

    expect(done).toBe(true);
  });

  it('createReading POSTs the electricityBillId, apartmentId and the write fields', () => {
    let id: number | undefined;
    service.createReading(7, 101, { currentReading: '4820' }).subscribe((r) => (id = r));

    const req = httpMock.expectOne(ELECTRICITY_READINGS_URL);
    expect(req.request.body).toEqual({ electricityBillId: 7, apartmentId: 101, currentReading: '4820' });
    req.flush({ id: 42 });

    expect(id).toBe(42);
  });

  it('createReading sends apartmentId null for the Zona Común row', () => {
    service.createReading(7, null, { previousReading: '0', currentReading: '20' }).subscribe();

    const req = httpMock.expectOne(ELECTRICITY_READINGS_URL);
    expect(req.request.body.apartmentId).toBeNull();
    req.flush({ id: 1 });
  });

  it('updateReading PUTs the write fields', () => {
    let done = false;
    service.updateReading(42, { previousReading: '4500', currentReading: '4820' }).subscribe(() => (done = true));

    const req = httpMock.expectOne(`${ELECTRICITY_READINGS_URL}/42`);
    expect(req.request.method).toBe('PUT');
    req.flush(null);

    expect(done).toBe(true);
  });

  it('confirmBill resolves success on 204', () => {
    let result: ConfirmElectricityBillResult | undefined;
    service.confirmBill(7).subscribe((r) => (result = r));

    httpMock.expectOne(`${ELECTRICITY_BILLS_URL}/7/Confirm`).flush(null, { status: 204, statusText: 'No Content' });

    expect(result?.success).toBe(true);
  });

  it('confirmBill resolves failure with the blocked meter labels on 409, without throwing', () => {
    let result: ConfirmElectricityBillResult | undefined;
    let errored = false;
    service.confirmBill(7).subscribe({ next: (r) => (result = r), error: () => (errored = true) });

    httpMock.expectOne(`${ELECTRICITY_BILLS_URL}/7/Confirm`).flush(
      { blockedMeterLabels: ['101', 'Zona Común'], hasZeroArrendado: false },
      { status: 409, statusText: 'Conflict' },
    );

    expect(errored).toBe(false);
    expect(result?.success).toBe(false);
    expect(result?.blockedMeterLabels).toEqual(['101', 'Zona Común']);
    expect(result?.hasZeroArrendadoError).toBe(false);
  });

  it('confirmBill resolves hasZeroArrendadoError on a zero-Arrendado 409', () => {
    let result: ConfirmElectricityBillResult | undefined;
    service.confirmBill(7).subscribe((r) => (result = r));

    httpMock.expectOne(`${ELECTRICITY_BILLS_URL}/7/Confirm`).flush(
      { blockedMeterLabels: [], hasZeroArrendado: true },
      { status: 409, statusText: 'Conflict' },
    );

    expect(result?.hasZeroArrendadoError).toBe(true);
  });

  it('uploadPhoto POSTs the file as FormData', () => {
    let done = false;
    const file = new File(['x'], 'medidor.jpg', { type: 'image/jpeg' });
    service.uploadPhoto(42, file).subscribe(() => (done = true));

    const req = httpMock.expectOne(`${ELECTRICITY_READINGS_URL}/42/Photo`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush(null);

    expect(done).toBe(true);
  });

  it('addComment POSTs the text and optional reading id', () => {
    let done = false;
    service.addComment(7, 'Comentario general', null).subscribe(() => (done = true));

    const req = httpMock.expectOne(`${ELECTRICITY_BILLS_URL}/7/Comments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ electricityMeterReadingId: null, text: 'Comentario general' });
    req.flush({ id: 1 });

    expect(done).toBe(true);
  });
});
