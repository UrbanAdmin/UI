import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { GasBillingComponent } from './gas-billing.component';
import { AuthService } from '../auth.service';
import { environment } from '../../environments/environment';
import { GasBillDto } from './gas-billing.model';

const CONTRACT_FIELDS = { contractStartDate: null, hasContract: false, contractFileName: null, status: 'Arrendado' as const };
const MOCK_APARTMENTS = [
  { id: 1, name: '101', owner: 'TBD', ...CONTRACT_FIELDS },
  { id: 2, name: '102', owner: 'Bryan', ...CONTRACT_FIELDS },
];

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const NOW = new Date();
const CURRENT_MONTH = MONTH_NAMES[NOW.getMonth()];
const CURRENT_YEAR = String(NOW.getFullYear());
const DATE_ID = 5;
const MOCK_DATES = [{ id: DATE_ID, month: CURRENT_MONTH, year: CURRENT_YEAR }];

describe('GasBillingComponent', () => {
  let httpMock: HttpTestingController;

  async function setup(isApartmentOwner: boolean, bill: GasBillDto | null): Promise<ComponentFixture<GasBillingComponent>> {
    await TestBed.configureTestingModule({
      imports: [GasBillingComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isApartmentOwner: () => isApartmentOwner, getOwnApartmentId: () => 1 } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(GasBillingComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/Dates`).flush(MOCK_DATES);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/GasBills/${DATE_ID}`).flush(bill, bill ? {} : { status: 404, statusText: 'Not Found' });
    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush(MOCK_APARTMENTS);
    fixture.detectChanges();

    return fixture;
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('shows one row per apartment (admin) even before any reading is recorded', async () => {
    const fixture = await setup(false, null);
    expect(fixture.componentInstance.rows.length).toBe(2);
    expect(fixture.componentInstance.rows.every((r) => r.reading === null)).toBe(true);
  });

  it('creates the bill and the reading when the admin enters a first reading with no bill yet', async () => {
    const fixture = await setup(false, null);
    const row = fixture.componentInstance.rows[0];
    row.currentReading = '30';

    fixture.componentInstance.saveReading(row);

    const createBillReq = httpMock.expectOne(`${environment.apiUrl}/GasBills`);
    expect(createBillReq.request.body).toEqual({ dateId: DATE_ID });
    createBillReq.flush({ id: 7 });

    const createReadingReq = httpMock.expectOne(`${environment.apiUrl}/GasApartmentReadings`);
    expect(createReadingReq.request.body).toEqual({
      gasBillId: 7, apartmentId: 1, isNewTenant: false, initialReading: null, currentReading: '30',
    });
    createReadingReq.flush({ id: 99 });

    // ApartmentsService caches its response for the session - the reload's second fetch resolves
    // from that cache, no second HTTP call.
    httpMock.expectOne(`${environment.apiUrl}/GasBills/${DATE_ID}`).flush(null, { status: 404, statusText: 'Not Found' });
  });

  it('renders computed columns from an existing bill', async () => {
    const bill: GasBillDto = {
      id: 7, dateId: DATE_ID, totalConsumption: '30', unitPrice: '10', consumoGasSubtotal: null,
      fixedCharge: '0', otherConcepts: null, ajusteDecena: null, totalAmount: '300',
      administrationAmount: '0', percentagePasses: true, percentageDifference: '0',
      totalPasses: true, totalDifference: '0', confirmed: false, confirmedAt: null,
      readings: [{
        id: 99, apartmentId: 1, apartmentNumber: '101', status: 'Arrendado', isNewTenant: false,
        initialReading: null, previousReading: '0', currentReading: '30', consumption: '30',
        consumptionPercentage: '1', allocatedConsumption: '30', variableCost: '300',
        fixedChargeShare: '0', finalTotal: '300', validationError: null, photoFileName: null,
      }],
      comments: [],
    };
    const fixture = await setup(false, bill);

    const row = fixture.componentInstance.rows.find((r) => r.apartmentId === 1);
    expect(row?.reading?.finalTotal).toBe('300');
  });

  it('calls confirm and reports success', async () => {
    const bill: GasBillDto = {
      id: 7, dateId: DATE_ID, totalConsumption: null, unitPrice: null, consumoGasSubtotal: null,
      fixedCharge: null, otherConcepts: null, ajusteDecena: null, totalAmount: null,
      administrationAmount: null, percentagePasses: true, percentageDifference: '0',
      totalPasses: true, totalDifference: '0', confirmed: false, confirmedAt: null,
      readings: [], comments: [],
    };
    const fixture = await setup(false, bill);

    fixture.componentInstance.confirm();
    httpMock.expectOne(`${environment.apiUrl}/GasBills/7/Confirm`).flush(null, { status: 204, statusText: 'No Content' });

    // ApartmentsService caches its response for the session - no second /Apartments call here.
    httpMock.expectOne(`${environment.apiUrl}/GasBills/${DATE_ID}`).flush(bill);

    expect(fixture.componentInstance.confirmSucceeded).toBe(true);
  });

  it('toggling new-tenant swaps the previous-reading display for an editable initial-reading field', async () => {
    const bill: GasBillDto = {
      id: 7, dateId: DATE_ID, totalConsumption: '30', unitPrice: '10', consumoGasSubtotal: null,
      fixedCharge: '0', otherConcepts: null, ajusteDecena: null, totalAmount: '300',
      administrationAmount: '0', percentagePasses: true, percentageDifference: '0',
      totalPasses: true, totalDifference: '0', confirmed: false, confirmedAt: null,
      readings: [{
        id: 99, apartmentId: 1, apartmentNumber: '101', status: 'Arrendado', isNewTenant: false,
        initialReading: null, previousReading: '500', currentReading: '510', consumption: '10',
        consumptionPercentage: '1', allocatedConsumption: '30', variableCost: '300',
        fixedChargeShare: '0', finalTotal: '300', validationError: null, photoFileName: null,
      }],
      comments: [],
    };
    const fixture = await setup(false, bill);
    const row = fixture.componentInstance.rows[0];
    expect(row.isNewTenant).toBe(false);

    fixture.componentInstance.toggleNewTenant(row, true);

    expect(row.isNewTenant).toBe(true);
    expect(row.initialReading).toBe('500'); // defaults from the previous reading as a starting point

    const req = httpMock.expectOne(`${environment.apiUrl}/GasApartmentReadings/99`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ isNewTenant: true, initialReading: '500', currentReading: '510' });
    req.flush(null);

    httpMock.expectOne(`${environment.apiUrl}/GasBills/${DATE_ID}`).flush(bill);
  });

  it('shows the verifiers panel and the comments box even before any bill has been saved yet', async () => {
    const fixture = await setup(false, null);

    const pctChip: HTMLElement = fixture.nativeElement.querySelector('[data-testid="verifier-percentage-chip"]');
    const totalChip: HTMLElement = fixture.nativeElement.querySelector('[data-testid="verifier-total-chip"]');
    expect(pctChip.textContent).toContain('Sin datos');
    expect(totalChip.textContent).toContain('Sin datos');
    expect(fixture.nativeElement.querySelector('[data-testid="new-comment-input"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="confirm-button"]').disabled).toBe(true);
  });

  it('creates the bill first when adding a comment before any bill field has been saved', async () => {
    const fixture = await setup(false, null);
    fixture.componentInstance.newCommentText = 'Primer comentario';

    fixture.componentInstance.addBillComment();

    const createBillReq = httpMock.expectOne(`${environment.apiUrl}/GasBills`);
    expect(createBillReq.request.body).toEqual({ dateId: DATE_ID });
    createBillReq.flush({ id: 9 });

    const addCommentReq = httpMock.expectOne(`${environment.apiUrl}/GasBills/9/Comments`);
    expect(addCommentReq.request.body).toEqual({ gasApartmentReadingId: null, text: 'Primer comentario' });
    addCommentReq.flush({ id: 1 });

    httpMock.expectOne(`${environment.apiUrl}/GasBills/${DATE_ID}`).flush(null, { status: 404, statusText: 'Not Found' });
  });

  it('shows a fail chip with the exact difference when the total verifier fails', async () => {
    const bill: GasBillDto = {
      id: 7, dateId: DATE_ID, totalConsumption: '30', unitPrice: '10', consumoGasSubtotal: null,
      fixedCharge: '0', otherConcepts: null, ajusteDecena: null, totalAmount: '1000',
      administrationAmount: '0', percentagePasses: true, percentageDifference: '0',
      totalPasses: false, totalDifference: '100', confirmed: false, confirmedAt: null,
      readings: [], comments: [],
    };
    const fixture = await setup(false, bill);

    const totalChip: HTMLElement = fixture.nativeElement.querySelector('[data-testid="verifier-total-chip"]');
    expect(totalChip.textContent).toContain('Falla');
    const totalDetail: HTMLElement = fixture.nativeElement.querySelector('[data-testid="verifier-total-detail"]');
    expect(totalDetail.textContent).toContain('100');
  });

  it('shows a pass chip for both verifiers when they pass', async () => {
    const bill: GasBillDto = {
      id: 7, dateId: DATE_ID, totalConsumption: '30', unitPrice: '10', consumoGasSubtotal: null,
      fixedCharge: '0', otherConcepts: null, ajusteDecena: null, totalAmount: '300',
      administrationAmount: '0', percentagePasses: true, percentageDifference: '0',
      totalPasses: true, totalDifference: '0', confirmed: false, confirmedAt: null,
      readings: [], comments: [],
    };
    const fixture = await setup(false, bill);

    const pctChip: HTMLElement = fixture.nativeElement.querySelector('[data-testid="verifier-percentage-chip"]');
    const totalChip: HTMLElement = fixture.nativeElement.querySelector('[data-testid="verifier-total-chip"]');
    expect(pctChip.textContent).toContain('Cumple');
    expect(totalChip.textContent).toContain('Cumple');
  });

  it('disables Confirm and reports every blocked apartment when a reading has a validation error', async () => {
    const bill: GasBillDto = {
      id: 7, dateId: DATE_ID, totalConsumption: '30', unitPrice: '10', consumoGasSubtotal: null,
      fixedCharge: '0', otherConcepts: null, ajusteDecena: null, totalAmount: '300',
      administrationAmount: '0', percentagePasses: true, percentageDifference: '0',
      totalPasses: true, totalDifference: '0', confirmed: false, confirmedAt: null,
      readings: [
        {
          id: 99, apartmentId: 1, apartmentNumber: '101', status: 'Arrendado', isNewTenant: false,
          initialReading: null, previousReading: '0', currentReading: null, consumption: null,
          consumptionPercentage: null, allocatedConsumption: null, variableCost: null,
          fixedChargeShare: '0', finalTotal: null, validationError: 'MissingReading', photoFileName: null,
        },
      ],
      comments: [],
    };
    const fixture = await setup(false, bill);

    expect(fixture.componentInstance.hasBlockingErrors).toBe(true);
    expect(fixture.componentInstance.blockedApartmentNumbers).toEqual(['101']);

    const confirmButton: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="confirm-button"]');
    expect(confirmButton.disabled).toBe(true);
  });

  it('enables Confirm when no reading has a validation error', async () => {
    const bill: GasBillDto = {
      id: 7, dateId: DATE_ID, totalConsumption: '30', unitPrice: '10', consumoGasSubtotal: null,
      fixedCharge: '0', otherConcepts: null, ajusteDecena: null, totalAmount: '300',
      administrationAmount: '0', percentagePasses: true, percentageDifference: '0',
      totalPasses: true, totalDifference: '0', confirmed: false, confirmedAt: null,
      readings: [
        {
          id: 99, apartmentId: 1, apartmentNumber: '101', status: 'Arrendado', isNewTenant: false,
          initialReading: null, previousReading: '0', currentReading: '30', consumption: '30',
          consumptionPercentage: '1', allocatedConsumption: '30', variableCost: '300',
          fixedChargeShare: '0', finalTotal: '300', validationError: null, photoFileName: null,
        },
      ],
      comments: [],
    };
    const fixture = await setup(false, bill);

    expect(fixture.componentInstance.hasBlockingErrors).toBe(false);
    const confirmButton: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="confirm-button"]');
    expect(confirmButton.disabled).toBe(false);
  });

  it('shows only the owners own row, read-only, when the caller is an apartment owner', async () => {
    const bill: GasBillDto = {
      id: 7, dateId: DATE_ID, totalConsumption: '30', unitPrice: '10', consumoGasSubtotal: null,
      fixedCharge: '0', otherConcepts: null, ajusteDecena: null, totalAmount: '300',
      administrationAmount: '0', percentagePasses: true, percentageDifference: '0',
      totalPasses: true, totalDifference: '0', confirmed: true, confirmedAt: '2027-01-05T00:00:00Z',
      readings: [{
        id: 99, apartmentId: 1, apartmentNumber: '101', status: 'Arrendado', isNewTenant: false,
        initialReading: null, previousReading: '0', currentReading: '30', consumption: '30',
        consumptionPercentage: '1', allocatedConsumption: '30', variableCost: '300',
        fixedChargeShare: '0', finalTotal: '300', validationError: null, photoFileName: null,
      }],
      comments: [],
    };
    const fixture = await setup(true, bill);

    expect(fixture.componentInstance.rows.length).toBe(1);
    expect(fixture.componentInstance.rows[0].apartmentId).toBe(1);
    expect(fixture.componentInstance.isReadOnly).toBe(true);

    // FR-028b: no edit controls at all - not the reading input, not the new-tenant toggle, not Confirm.
    expect(fixture.nativeElement.querySelector('[data-testid="current-reading-1"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="new-tenant-1"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="confirm-button"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="total-amount"]')).toBeNull();
  });

  it('lets the admin add a bill-level comment, and it persists after a reload', async () => {
    const bill: GasBillDto = {
      id: 7, dateId: DATE_ID, totalConsumption: null, unitPrice: null, consumoGasSubtotal: null,
      fixedCharge: null, otherConcepts: null, ajusteDecena: null, totalAmount: null,
      administrationAmount: null, percentagePasses: true, percentageDifference: '0',
      totalPasses: true, totalDifference: '0', confirmed: false, confirmedAt: null,
      readings: [], comments: [{ id: 1, gasApartmentReadingId: null, text: 'Existente', createdAt: '2027-01-01T00:00:00Z' }],
    };
    const fixture = await setup(false, bill);
    expect(fixture.componentInstance.bill?.comments.length).toBe(1);

    fixture.componentInstance.newCommentText = 'Nuevo comentario';
    fixture.componentInstance.addBillComment();

    const req = httpMock.expectOne(`${environment.apiUrl}/GasBills/7/Comments`);
    expect(req.request.body).toEqual({ gasApartmentReadingId: null, text: 'Nuevo comentario' });
    req.flush({ id: 2 });

    httpMock.expectOne(`${environment.apiUrl}/GasBills/${DATE_ID}`).flush(bill);

    expect(fixture.componentInstance.newCommentText).toBe('');
  });

  it('shows the same empty state as an unrecorded period when the bill is not confirmed yet', async () => {
    const fixture = await setup(true, null);

    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
    expect(fixture.componentInstance.rows.length).toBe(0);
  });
});
