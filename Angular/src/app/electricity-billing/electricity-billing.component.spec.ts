import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { ElectricityBillingComponent } from './electricity-billing.component';
import { AuthService } from '../auth.service';
import { environment } from '../../environments/environment';
import { ElectricityBillDto } from './electricity-billing.model';

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

describe('ElectricityBillingComponent', () => {
  let httpMock: HttpTestingController;

  async function setup(isApartmentOwner: boolean, bill: ElectricityBillDto | null): Promise<ComponentFixture<ElectricityBillingComponent>> {
    await TestBed.configureTestingModule({
      imports: [ElectricityBillingComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isApartmentOwner: () => isApartmentOwner, getOwnApartmentId: () => 1 } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ElectricityBillingComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/Dates`).flush(MOCK_DATES);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/ElectricityBills/${DATE_ID}`).flush(bill, bill ? {} : { status: 404, statusText: 'Not Found' });
    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush(MOCK_APARTMENTS);
    fixture.detectChanges();

    return fixture;
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('shows one row per apartment plus a Zona Común row (admin) even before any reading is recorded', async () => {
    const fixture = await setup(false, null);
    expect(fixture.componentInstance.rows.length).toBe(3);
    expect(fixture.componentInstance.rows.every((r) => r.reading === null)).toBe(true);
    expect(fixture.componentInstance.rows[2].apartmentId).toBeNull();
    expect(fixture.componentInstance.rows[2].label).toBe('Zona Común');
  });

  it('creates the bill and the reading when the admin enters a first reading with no bill yet', async () => {
    const fixture = await setup(false, null);
    const row = fixture.componentInstance.rows[0];
    row.previousReading = '0';
    row.currentReading = '30';

    fixture.componentInstance.saveReading(row);

    const createBillReq = httpMock.expectOne(`${environment.apiUrl}/ElectricityBills`);
    expect(createBillReq.request.body).toEqual({ dateId: DATE_ID });
    createBillReq.flush({ id: 7 });

    const createReadingReq = httpMock.expectOne(`${environment.apiUrl}/ElectricityMeterReadings`);
    expect(createReadingReq.request.body).toEqual({
      electricityBillId: 7, apartmentId: 1, previousReading: '0', currentReading: '30',
    });
    createReadingReq.flush({ id: 99 });

    httpMock.expectOne(`${environment.apiUrl}/ElectricityBills/${DATE_ID}`).flush(null, { status: 404, statusText: 'Not Found' });
  });

  it('creates the Zona Común reading with apartmentId null', async () => {
    const fixture = await setup(false, null);
    const zonaComunRow = fixture.componentInstance.rows[2];
    zonaComunRow.previousReading = '0';
    zonaComunRow.currentReading = '20';

    fixture.componentInstance.saveReading(zonaComunRow);

    const createBillReq = httpMock.expectOne(`${environment.apiUrl}/ElectricityBills`);
    createBillReq.flush({ id: 7 });
    const createReadingReq = httpMock.expectOne(`${environment.apiUrl}/ElectricityMeterReadings`);
    expect(createReadingReq.request.body.apartmentId).toBeNull();
    createReadingReq.flush({ id: 1 });

    httpMock.expectOne(`${environment.apiUrl}/ElectricityBills/${DATE_ID}`).flush(null, { status: 404, statusText: 'Not Found' });
  });

  function readyBill(overrides: Partial<ElectricityBillDto> = {}): ElectricityBillDto {
    return {
      id: 7, dateId: DATE_ID, totalConsumptionKwh: '100', electricityConsumptionValue: '1000', aseoValue: '600',
      totalAmount: '1600', nonRentedElectricityCost: '0', commonAreaElectricityCost: '0',
      percentagePasses: true, percentageDifference: '0', meterVsBillPasses: true, meterVsBillDifference: '0',
      allocationPasses: true, allocationDifference: '0', finalPasses: true, finalDifference: '0',
      confirmed: false, confirmedAt: null,
      readings: [
        {
          id: 99, apartmentId: 1, label: '101', status: 'Arrendado',
          previousReading: '0', currentReading: '100', consumption: '100', consumptionPercentage: '1',
          allocatedElectricityCost: '1000', aseoShare: '600', nonRentedCostShare: '0', commonAreaCostShare: '0',
          finalAmount: '1600', validationError: null, photoFileName: null,
        },
      ],
      comments: [],
      ...overrides,
    };
  }

  it('renders computed columns, including Aseo, from an existing bill', async () => {
    const fixture = await setup(false, readyBill());

    const row = fixture.componentInstance.rows.find((r) => r.apartmentId === 1);
    expect(row?.reading?.finalAmount).toBe('1600');
    const aseoCell = fixture.nativeElement.querySelectorAll('table.readings-table tbody tr')[0].querySelectorAll('td')[6];
    expect(aseoCell.textContent).toContain('600');
  });

  it('shows a dash in the Aseo column for No arrendado and Zona Común rows, and a redistribution note on their total', async () => {
    const bill = readyBill({
      readings: [
        {
          id: 99, apartmentId: 1, label: '101', status: 'Arrendado',
          previousReading: '0', currentReading: '75', consumption: '75', consumptionPercentage: '0.75',
          allocatedElectricityCost: '750', aseoShare: '600', nonRentedCostShare: '250', commonAreaCostShare: '0',
          finalAmount: '1600', validationError: null, photoFileName: null,
        },
        {
          id: 100, apartmentId: 2, label: '102', status: 'No arrendado',
          previousReading: '0', currentReading: '25', consumption: '25', consumptionPercentage: '0.25',
          allocatedElectricityCost: '250', aseoShare: '0', nonRentedCostShare: '0', commonAreaCostShare: '0',
          finalAmount: '0', validationError: null, photoFileName: null,
        },
      ],
      nonRentedElectricityCost: '250',
    });
    const fixture = await setup(false, bill);

    const rowCells = (idx: number) => fixture.nativeElement.querySelectorAll('table.readings-table tbody tr')[idx].querySelectorAll('td');
    expect(rowCells(1)[6].textContent.trim()).toBe('—'); // No arrendado's Aseo column
    expect(rowCells(1)[7].textContent).toContain('redistribuido a Arrendado');
    expect(rowCells(0)[7].textContent).toContain('no arr.'); // Arrendado's breakdown note mentions the redistributed share
  });

  it('shows the zero-Arrendado critical banner and disables Confirm when no apartment is Arrendado', async () => {
    // Both apartments' own readings explicitly mark them No arrendado - row.status is sourced from
    // the reading (not the apartment's own, possibly stale, status) whenever a reading exists.
    const bill = readyBill({
      readings: [
        {
          id: 99, apartmentId: 1, label: '101', status: 'No arrendado',
          previousReading: '0', currentReading: '0', consumption: '0', consumptionPercentage: '0',
          allocatedElectricityCost: '0', aseoShare: '0', nonRentedCostShare: '0', commonAreaCostShare: '0',
          finalAmount: '0', validationError: null, photoFileName: null,
        },
        {
          id: 100, apartmentId: 2, label: '102', status: 'No arrendado',
          previousReading: '0', currentReading: '100', consumption: '100', consumptionPercentage: '1',
          allocatedElectricityCost: '1000', aseoShare: '0', nonRentedCostShare: '0', commonAreaCostShare: '0',
          finalAmount: '0', validationError: null, photoFileName: null,
        },
      ],
    });
    const fixture = await setup(false, bill);

    expect(fixture.componentInstance.hasZeroArrendado).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="zero-arrendado-banner"]')).toBeTruthy();
    const confirmButton: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="confirm-button"]');
    expect(confirmButton.disabled).toBe(true);
  });

  it('does not show the zero-Arrendado banner when at least one apartment is Arrendado', async () => {
    const fixture = await setup(false, readyBill());

    expect(fixture.componentInstance.hasZeroArrendado).toBe(false);
    expect(fixture.nativeElement.querySelector('[data-testid="zero-arrendado-banner"]')).toBeNull();
  });

  it('reports hasZeroArrendadoError distinctly from a blocked reading on confirm', async () => {
    const fixture = await setup(false, readyBill());

    fixture.componentInstance.confirm();
    httpMock.expectOne(`${environment.apiUrl}/ElectricityBills/7/Confirm`).flush(
      { blockedMeterLabels: [], hasZeroArrendado: true },
      { status: 409, statusText: 'Conflict' },
    );

    expect(fixture.componentInstance.confirmSucceeded).toBe(false);
    expect(fixture.componentInstance.confirmMessage).toContain('No hay apartamentos arrendados');
  });

  it('shows no fixed-charge field in the bill fields section (FR-003)', async () => {
    const fixture = await setup(false, null);

    expect(fixture.nativeElement.textContent).not.toContain('Cargo fijo');
    expect(fixture.nativeElement.textContent).toContain('Luz no tiene cargo fijo');
  });

  it('shows all four verifiers with a pass chip when they pass', async () => {
    const fixture = await setup(false, readyBill());

    expect(fixture.nativeElement.querySelector('[data-testid="verifier-percentage-chip"]').textContent).toContain('Cumple');
    expect(fixture.nativeElement.querySelector('[data-testid="verifier-kwh-chip"]').textContent).toContain('Cumple');
    expect(fixture.nativeElement.querySelector('[data-testid="verifier-allocation-chip"]').textContent).toContain('Cumple');
    expect(fixture.nativeElement.querySelector('[data-testid="verifier-final-chip"]').textContent).toContain('Cumple');
  });

  it('shows a fail chip with the exact difference when a verifier fails', async () => {
    const fixture = await setup(false, readyBill({ finalPasses: false, finalDifference: '150' }));

    const chip: HTMLElement = fixture.nativeElement.querySelector('[data-testid="verifier-final-chip"]');
    expect(chip.textContent).toContain('Falla');
    expect(fixture.nativeElement.textContent).toContain('150');
  });

  it('shows the redistribution cards with the bill-level totals', async () => {
    const fixture = await setup(false, readyBill({ nonRentedElectricityCost: '12000', commonAreaElectricityCost: '8000' }));

    expect(fixture.nativeElement.querySelector('[data-testid="non-rented-cost"]').textContent).toContain('12.000');
    expect(fixture.nativeElement.querySelector('[data-testid="common-area-cost"]').textContent).toContain('8.000');
  });

  it('disables Confirm and reports every blocked meter when a reading has a validation error', async () => {
    const bill = readyBill({
      readings: [
        {
          id: 99, apartmentId: 1, label: '101', status: 'Arrendado',
          previousReading: '0', currentReading: null, consumption: null, consumptionPercentage: null,
          allocatedElectricityCost: null, aseoShare: '0', nonRentedCostShare: '0', commonAreaCostShare: '0',
          finalAmount: null, validationError: 'MissingReading', photoFileName: null,
        },
      ],
    });
    const fixture = await setup(false, bill);

    expect(fixture.componentInstance.hasBlockingErrors).toBe(true);
    expect(fixture.componentInstance.blockedMeterLabels).toEqual(['101']);
    const confirmButton: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="confirm-button"]');
    expect(confirmButton.disabled).toBe(true);
  });

  it('calls confirm and reports success', async () => {
    const fixture = await setup(false, readyBill());

    fixture.componentInstance.confirm();
    httpMock.expectOne(`${environment.apiUrl}/ElectricityBills/7/Confirm`).flush(null, { status: 204, statusText: 'No Content' });

    httpMock.expectOne(`${environment.apiUrl}/ElectricityBills/${DATE_ID}`).flush(readyBill());

    expect(fixture.componentInstance.confirmSucceeded).toBe(true);
  });

  it('lets the admin add a bill-level comment, and it persists after a reload', async () => {
    const bill = readyBill({ comments: [{ id: 1, electricityMeterReadingId: null, text: 'Existente', createdAt: '2027-01-01T00:00:00Z' }] });
    const fixture = await setup(false, bill);
    expect(fixture.componentInstance.bill?.comments.length).toBe(1);

    fixture.componentInstance.newCommentText = 'Nuevo comentario';
    fixture.componentInstance.addBillComment();

    const req = httpMock.expectOne(`${environment.apiUrl}/ElectricityBills/7/Comments`);
    expect(req.request.body).toEqual({ electricityMeterReadingId: null, text: 'Nuevo comentario' });
    req.flush({ id: 2 });

    httpMock.expectOne(`${environment.apiUrl}/ElectricityBills/${DATE_ID}`).flush(bill);

    expect(fixture.componentInstance.newCommentText).toBe('');
  });

  // ---- Owner (apartment-owner) view: narrower field set, FR-033 ----

  it('shows only the owners own row, read-only, when the caller is an apartment owner', async () => {
    const bill = readyBill({ confirmed: true, confirmedAt: '2027-01-05T00:00:00Z' });
    const fixture = await setup(true, bill);

    expect(fixture.componentInstance.rows.length).toBe(1);
    expect(fixture.componentInstance.rows[0].apartmentId).toBe(1);
    expect(fixture.nativeElement.querySelector('table.readings-table')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="confirm-button"]')).toBeNull();
  });

  it('renders app-tenant-statement with no breakdown for an apartment owner, in ready state (FR-033)', async () => {
    const bill = readyBill({ confirmed: true, confirmedAt: '2027-01-05T00:00:00Z' });
    const fixture = await setup(true, bill);

    const statement = fixture.nativeElement.querySelector('app-tenant-statement');
    expect(statement).toBeTruthy();
    expect(statement.textContent).toContain('Apto 101 · TBD · Arrendado');
    expect(fixture.componentInstance.tenantStatement.state).toBe('ready');
    // FR-033: no Aseo share, no redistributed-cost shares shown to the owner - only the total.
    expect(fixture.componentInstance.tenantStatement.breakdown).toBeUndefined();
    expect(fixture.componentInstance.tenantStatement.total).toBe('1600');
    expect(statement.textContent).not.toContain('Aseo');
  });

  it('hides Verificadores and the redistribution cards for an apartment owner - admin-only reconciliation tools', async () => {
    const bill = readyBill({ confirmed: true, confirmedAt: '2027-01-05T00:00:00Z' });
    const fixture = await setup(true, bill);

    expect(fixture.nativeElement.querySelector('.verifiers-heading')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="verifier-percentage-chip"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="non-rented-cost"]')).toBeNull();
  });

  it('shows the same empty state as an unrecorded period when the bill is not confirmed yet', async () => {
    const fixture = await setup(true, null);

    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
    expect(fixture.componentInstance.rows.length).toBe(0);
    expect(fixture.componentInstance.tenantStatement.state).toBe('empty');
  });

  it('shows the "Solo lectura" tag for an apartment owner', async () => {
    const fixture = await setup(true, null);
    expect(fixture.nativeElement.querySelector('[data-testid="readonly-tag"]')).toBeTruthy();
  });

  it('keeps the admin hint and shows no "Solo lectura" tag for an admin', async () => {
    const fixture = await setup(false, null);
    expect(fixture.nativeElement.textContent).toContain('sin cargo fijo');
    expect(fixture.nativeElement.querySelector('[data-testid="readonly-tag"]')).toBeNull();
  });
});
