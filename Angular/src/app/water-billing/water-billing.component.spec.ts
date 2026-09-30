import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { WaterBillingComponent } from './water-billing.component';
import { AuthService } from '../auth.service';
import { environment } from '../../environments/environment';
import { WaterBillDto, WaterBillPeriodDto } from './water-billing.model';

const CONTRACT_FIELDS = { contractStartDate: null, hasContract: false, contractFileName: null, status: 'Arrendado' as const };
const MOCK_APARTMENTS = [
  { id: 1, name: '101', owner: 'TBD', ...CONTRACT_FIELDS },
  { id: 2, name: '102', owner: 'Bryan', ...CONTRACT_FIELDS },
];

const PERIOD: WaterBillPeriodDto = { id: 7, startDate: '2026-09-10', endDate: '2026-10-07', confirmed: false };

const EMPTY_BILL_FIELDS = {
  totalValue: null, totalM3: null, fixedAqueduct: null, fixedSewer: null,
  basicResidentialAqueduct: null, superiorResidentialAqueduct: null,
  basicResidentialSewer: null, superiorResidentialSewer: null,
};

function billFrom(overrides: Partial<WaterBillDto>): WaterBillDto {
  return {
    id: 7, startDate: '2026-09-10', endDate: '2026-10-07', ...EMPTY_BILL_FIELDS,
    nonRentedWaterCost: '0', commonAreaWaterCost: '0',
    percentagePasses: true, percentageDifference: '0',
    meterVsBillPasses: true, meterVsBillDifference: '0',
    aqueductAllocationPasses: true, aqueductAllocationDifference: '0',
    sewerAllocationPasses: true, sewerAllocationDifference: '0',
    finalPasses: true, finalDifference: '0',
    confirmed: false, confirmedAt: null, readings: [], comments: [],
    ...overrides,
  };
}

describe('WaterBillingComponent', () => {
  let httpMock: HttpTestingController;

  async function setup(isApartmentOwner: boolean, periods: WaterBillPeriodDto[]): Promise<ComponentFixture<WaterBillingComponent>> {
    await TestBed.configureTestingModule({
      imports: [WaterBillingComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isApartmentOwner: () => isApartmentOwner, getOwnApartmentId: () => 1 } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(WaterBillingComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/WaterBills`).flush({ periods, nextSuggestedStartDate: '2026-12-08' });
    fixture.detectChanges();

    return fixture;
  }

  function open(fixture: ComponentFixture<WaterBillingComponent>, id: number, bill: WaterBillDto | null): void {
    fixture.componentInstance.openPeriod(id);
    httpMock.expectOne(`${environment.apiUrl}/WaterBills/${id}`).flush(bill, bill ? {} : { status: 404, statusText: 'Not Found' });
    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush(MOCK_APARTMENTS);
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  // ---- FR-047: period list ----

  it('shows the period list with start/end dates and confirmed state, for an admin', async () => {
    const fixture = await setup(false, [PERIOD, { id: 3, startDate: '2026-07-10', endDate: '2026-09-09', confirmed: true }]);

    expect(fixture.componentInstance.view).toBe('list');
    expect(fixture.nativeElement.querySelector('[data-testid="open-period-7"]')).toBeTruthy();
    const rowTexts = fixture.nativeElement.textContent;
    expect(rowTexts).toContain('10/09/2026'); // dd/MM/yyyy - readable for the end user, not raw ISO
    expect(rowTexts).toContain('Sin confirmar');
    expect(rowTexts).toContain('Confirmado');
  });

  it('shows only confirmed periods for an ApartmentOwner, and the empty state when there are none', async () => {
    const fixture = await setup(true, []);

    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
  });

  it('shows the "Iniciar nuevo periodo" form pre-filled with the suggested next start date, for an admin', async () => {
    const fixture = await setup(false, [PERIOD]);

    fixture.componentInstance.toggleNewPeriodForm();
    fixture.detectChanges();

    expect(fixture.componentInstance.newPeriodStart).toBe('2026-12-08');
    expect(fixture.nativeElement.querySelector('[data-testid="new-period-form"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="new-period-button"]')).toBeTruthy();
  });

  it('never shows "Iniciar nuevo periodo" for an ApartmentOwner', async () => {
    const fixture = await setup(true, [{ ...PERIOD, confirmed: true }]);

    expect(fixture.nativeElement.querySelector('[data-testid="new-period-button"]')).toBeNull();
  });

  it('createPeriod POSTs the dates and opens the new period on success', async () => {
    const fixture = await setup(false, []);
    fixture.componentInstance.newPeriodStart = '2026-12-08';
    fixture.componentInstance.newPeriodEnd = '2027-02-07';

    fixture.componentInstance.createPeriod();

    const req = httpMock.expectOne(`${environment.apiUrl}/WaterBills`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ startDate: '2026-12-08', endDate: '2027-02-07' });
    req.flush({ id: 9 });

    httpMock.expectOne(`${environment.apiUrl}/WaterBills/9`).flush(billFrom({ id: 9, startDate: '2026-12-08', endDate: '2027-02-07' }));
    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush(MOCK_APARTMENTS);
    fixture.detectChanges();

    expect(fixture.componentInstance.view).toBe('detail');
    expect(fixture.componentInstance.selectedBillId).toBe(9);
  });

  it('createPeriod shows the server-rejected contiguity error without switching views', async () => {
    const fixture = await setup(false, [PERIOD]);
    fixture.componentInstance.toggleNewPeriodForm();
    fixture.componentInstance.newPeriodStart = '2026-10-09'; // a day off the expected start
    fixture.componentInstance.newPeriodEnd = '2027-02-07';

    fixture.componentInstance.createPeriod();

    httpMock.expectOne(`${environment.apiUrl}/WaterBills`).flush(
      'A new period must start on 2026-10-08, the day after the latest period\'s end date.',
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(fixture.componentInstance.view).toBe('list');
    expect(fixture.nativeElement.querySelector('[data-testid="new-period-error"]').textContent).toContain('2026-10-08');
  });

  // ---- period detail ----

  it('opening a period shows two apartment rows plus a Zona Común row for an admin, even before any reading is recorded', async () => {
    const fixture = await setup(false, [PERIOD]);
    open(fixture, 7, null);

    expect(fixture.componentInstance.rows.length).toBe(3);
    expect(fixture.componentInstance.rows.map((r) => r.label)).toEqual(['101', '102', 'Zona Común']);
    expect(fixture.componentInstance.rows.find((r) => r.apartmentId === null)?.status).toBeNull();
  });

  it('shows the period header with the raw start/end dates, editable pre-confirm', async () => {
    const fixture = await setup(false, [PERIOD]);
    open(fixture, 7, billFrom({}));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const startInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="period-start-input"]');
    const endInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="period-end-input"]');
    expect(startInput.value).toBe('2026-09-10');
    expect(endInput.value).toBe('2026-10-07');
    expect(startInput.disabled).toBe(false);
  });

  it('locks the period header dates once the bill is confirmed', async () => {
    const fixture = await setup(false, [{ ...PERIOD, confirmed: true }]);
    open(fixture, 7, billFrom({ confirmed: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const startInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="period-start-input"]');
    expect(startInput.disabled).toBe(true);
  });

  it('savePeriodDates PUTs the edited dates and shows the server-rejected contiguity error', async () => {
    const fixture = await setup(false, [PERIOD]);
    open(fixture, 7, billFrom({}));

    fixture.componentInstance.periodEndDraft = '2026-10-06';
    fixture.componentInstance.savePeriodDates();

    const req = httpMock.expectOne(`${environment.apiUrl}/WaterBills/7`);
    expect(req.request.body).toEqual({ startDate: '2026-09-10', endDate: '2026-10-06' });
    req.flush('This period\'s end date must stay 2026-10-07 to remain contiguous with the next period.', { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="period-date-error"]').textContent).toContain('2026-10-07');
  });

  it('backToPeriods returns to the list view and reloads it', async () => {
    const fixture = await setup(false, [PERIOD]);
    open(fixture, 7, billFrom({}));

    fixture.componentInstance.backToPeriods();
    httpMock.expectOne(`${environment.apiUrl}/WaterBills`).flush({ periods: [PERIOD], nextSuggestedStartDate: '2026-12-08' });
    fixture.detectChanges();

    expect(fixture.componentInstance.view).toBe('list');
    expect(fixture.componentInstance.bill).toBeNull();
  });

  it('shows the eight bill-info fields, grouped, for an admin', async () => {
    const fixture = await setup(false, [PERIOD]);
    open(fixture, 7, null);

    expect(fixture.nativeElement.querySelector('[data-testid="total-value"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="basic-aqueduct"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="basic-sewer"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Acueducto');
    expect(fixture.nativeElement.textContent).toContain('Alcantarillado');
  });

  it('hides bill-info fields, verifiers, and redistribution cards for an ApartmentOwner', async () => {
    const bill = billFrom({
      confirmed: true, confirmedAt: '2026-10-08T00:00:00Z',
      readings: [{
        id: 1, apartmentId: 1, label: '101', status: 'Arrendado',
        previousReading: '500', currentReading: '530', readingDate: '2026-09-20', consumption: '30', consumptionPercentage: '0.3',
        aqueductValue: '180000', sewerValue: '90000', fixedChargeShare: '50000',
        nonRentedCostShare: '11667', commonAreaCostShare: '20000', finalAmount: '351700',
        validationError: null, photoFileName: null,
      }],
    });
    const fixture = await setup(true, [{ ...PERIOD, confirmed: true }]);
    open(fixture, 7, bill);

    expect(fixture.componentInstance.isReadOnly).toBe(true);
    expect(fixture.componentInstance.rows.length).toBe(1); // server already scopes to own apartment
    expect(fixture.nativeElement.querySelector('[data-testid="total-value"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="verifier-percentage-chip"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="non-rented-cost"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Valor Acueducto');
    expect(fixture.componentInstance.displayedColumns).toEqual(['apartamento', 'lecturaAnterior', 'lecturaActual', 'consumo', 'porcentaje', 'total']);
    // No edit controls at all (FR-034) - not the reading input, not the comment button, not Confirm.
    expect(fixture.nativeElement.querySelector('[data-testid="current-reading-1"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="comment-1"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="confirm-button"]')).toBeNull();
    // The server already excludes the Zona Común row entirely for an owner - never reachable here.
    expect(fixture.nativeElement.textContent).not.toContain('Zona Común');
  });

  it('shows the mismatch warning only when meterVsBillPasses is false', async () => {
    const fixture = await setup(false, [PERIOD]);
    open(fixture, 7, billFrom({}));
    expect(fixture.nativeElement.querySelector('[data-testid="mismatch-card"]')).toBeNull();

    fixture.componentInstance.bill = { ...fixture.componentInstance.bill!, meterVsBillPasses: false, meterVsBillDifference: '5' };
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="mismatch-card"]')).toBeTruthy();
  });

  it('disables Confirm and shows the zero-Arrendado critical message distinctly from a blocked reading', async () => {
    const fixture = await setup(false, [PERIOD]);
    open(fixture, 7, billFrom({}));

    fixture.componentInstance.rows = fixture.componentInstance.rows.map((r) => ({ ...r, status: 'No arrendado' as const }));
    fixture.detectChanges();

    expect(fixture.componentInstance.hasZeroArrendado).toBe(true);
    const confirmButton: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="confirm-button"]');
    expect(confirmButton.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="confirm-hint"]').textContent).toContain('No hay apartamentos arrendados');
  });

  it('disables Confirm and shows a per-meter error, including for Zona Común, when a reading is blocked', async () => {
    const bill = billFrom({
      readings: [{
        id: 1, apartmentId: null, label: 'Zona Común', status: null,
        previousReading: '50', currentReading: '40', readingDate: '2026-09-20', consumption: null, consumptionPercentage: null,
        aqueductValue: null, sewerValue: null, fixedChargeShare: '0', nonRentedCostShare: '0',
        commonAreaCostShare: '0', finalAmount: null, validationError: 'ReadingBelowPrevious', photoFileName: null,
      }],
    });
    const fixture = await setup(false, [PERIOD]);
    open(fixture, 7, bill);

    expect(fixture.componentInstance.blockedMeterLabels).toEqual(['Zona Común']);
    expect(fixture.componentInstance.hasZeroArrendado).toBe(false); // distinct condition, both apartments are Arrendado
    const confirmButton: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="confirm-button"]');
    expect(confirmButton.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="confirm-hint"]').textContent).toContain('Zona Común');
    expect(fixture.nativeElement.textContent).toContain('Menor que la anterior');
  });

  // ---- FR-005, FR-049: reading-date field and its own blocking error ----

  it('shows a reading-date input per row and saves it alongside the current reading', async () => {
    const fixture = await setup(false, [PERIOD]);
    open(fixture, 7, billFrom({}));

    const dateInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="reading-date-1"]');
    expect(dateInput).toBeTruthy();

    const row = fixture.componentInstance.rows.find((r) => r.apartmentId === 1)!;
    row.previousReading = '500';
    row.currentReading = '530';
    row.readingDate = '2026-09-20';
    fixture.componentInstance.saveReading(row);

    const req = httpMock.expectOne(`${environment.apiUrl}/WaterMeterReadings`);
    expect(req.request.body).toEqual({ waterBillId: 7, apartmentId: 1, previousReading: '500', currentReading: '530', readingDate: '2026-09-20' });
    req.flush({ id: 50 });

    // saveReading() triggers reload() - flush the follow-up GET so it doesn't leak into afterEach's verify().
    httpMock.expectOne(`${environment.apiUrl}/WaterBills/7`).flush(billFrom({}));
  });

  it('truncates a server DateTime ("2026-09-20T00:00:00") to a bare date so the native date input actually shows it', async () => {
    const bill = billFrom({
      readings: [{
        id: 1, apartmentId: 1, label: '101', status: 'Arrendado',
        previousReading: '500', currentReading: '530', readingDate: '2026-09-20T00:00:00', consumption: '30', consumptionPercentage: '0.3',
        aqueductValue: '180000', sewerValue: '90000', fixedChargeShare: '0', nonRentedCostShare: '0',
        commonAreaCostShare: '0', finalAmount: '270000', validationError: null, photoFileName: null,
      }],
    });
    const fixture = await setup(false, [PERIOD]);
    open(fixture, 7, bill);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const row = fixture.componentInstance.rows.find((r) => r.apartmentId === 1)!;
    expect(row.readingDate).toBe('2026-09-20'); // not the raw "2026-09-20T00:00:00" from the server
    const dateInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="reading-date-1"]');
    expect(dateInput.value).toBe('2026-09-20');
  });

  it('truncates the period header dates the same way, from a server DateTime', async () => {
    const bill = billFrom({ startDate: '2026-09-10T00:00:00', endDate: '2026-10-07T00:00:00' });
    const fixture = await setup(false, [PERIOD]);
    open(fixture, 7, bill);

    expect(fixture.componentInstance.periodStartDraft).toBe('2026-09-10');
    expect(fixture.componentInstance.periodEndDraft).toBe('2026-10-07');
  });

  it('keeps Lect. anterior editable and savable when a reading row already exists but its previousReading is still null', async () => {
    // A meter's first period can end up with CurrentReading saved before PreviousReading - the
    // admin must still be able to fill it in, not get permanently locked out of the field (FR-006).
    const bill = billFrom({
      readings: [{
        id: 1, apartmentId: 1, label: '101', status: 'Arrendado',
        previousReading: null, currentReading: '167.84', readingDate: null, consumption: null, consumptionPercentage: null,
        aqueductValue: null, sewerValue: null, fixedChargeShare: '0', nonRentedCostShare: '0',
        commonAreaCostShare: '0', finalAmount: null, validationError: 'MissingReading', photoFileName: null,
      }],
    });
    const fixture = await setup(false, [PERIOD]);
    open(fixture, 7, bill);

    const input: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="previous-reading-1"]');
    expect(input).toBeTruthy(); // editable, not the read-only muted pill

    const row = fixture.componentInstance.rows.find((r) => r.apartmentId === 1)!;
    row.previousReading = '140';
    fixture.componentInstance.saveReading(row);

    const req = httpMock.expectOne(`${environment.apiUrl}/WaterMeterReadings/1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ previousReading: '140', currentReading: '167.84', readingDate: null });
    req.flush(null);

    httpMock.expectOne(`${environment.apiUrl}/WaterBills/7`).flush(bill);
  });

  it('shows "Fecha fuera del periodo" and blocks Confirm when a reading date falls outside the period', async () => {
    const bill = billFrom({
      readings: [{
        id: 1, apartmentId: 1, label: '101', status: 'Arrendado',
        previousReading: '0', currentReading: '10', readingDate: '2026-10-08', consumption: null, consumptionPercentage: null,
        aqueductValue: null, sewerValue: null, fixedChargeShare: '0', nonRentedCostShare: '0',
        commonAreaCostShare: '0', finalAmount: null, validationError: 'ReadingDateOutsidePeriod', photoFileName: null,
      }],
    });
    const fixture = await setup(false, [PERIOD]);
    open(fixture, 7, bill);

    expect(fixture.componentInstance.blockedMeterLabels).toEqual(['101']);
    expect(fixture.nativeElement.textContent).toContain('Fecha fuera del periodo');
    const confirmButton: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="confirm-button"]');
    expect(confirmButton.disabled).toBe(true);
  });

  it('shows Zona Común and No-arrendado rows with $0 and a redistributed note, and distinct cost-share columns for Arrendado rows', async () => {
    const bill = billFrom({
      nonRentedWaterCost: '250000', commonAreaWaterCost: '250000',
      readings: [
        {
          id: 1, apartmentId: 1, label: '101', status: 'Arrendado',
          previousReading: '0', currentReading: '25', readingDate: '2026-09-20', consumption: '25', consumptionPercentage: '0.25',
          aqueductValue: '250000', sewerValue: '0', fixedChargeShare: '0',
          nonRentedCostShare: '125000', commonAreaCostShare: '125000', finalAmount: '500000',
          validationError: null, photoFileName: null,
        },
        {
          id: 2, apartmentId: 2, label: '102', status: 'No arrendado',
          previousReading: '0', currentReading: '25', readingDate: '2026-09-20', consumption: '25', consumptionPercentage: '0.25',
          aqueductValue: '250000', sewerValue: '0', fixedChargeShare: '0',
          nonRentedCostShare: '0', commonAreaCostShare: '0', finalAmount: '0',
          validationError: null, photoFileName: null,
        },
        {
          id: 3, apartmentId: null, label: 'Zona Común', status: null,
          previousReading: '0', currentReading: '25', readingDate: '2026-09-20', consumption: '25', consumptionPercentage: '0.25',
          aqueductValue: '250000', sewerValue: '0', fixedChargeShare: '0',
          nonRentedCostShare: '0', commonAreaCostShare: '0', finalAmount: '0',
          validationError: null, photoFileName: null,
        },
      ],
    });
    const fixture = await setup(false, [PERIOD]);
    open(fixture, 7, bill);

    const rowTexts: string[] = Array.from(fixture.nativeElement.querySelectorAll('tr.mat-mdc-row')).map(
      (tr: any) => tr.textContent,
    );
    const noArrendadoRow = rowTexts.find((t) => t.includes('102'));
    const zonaComunRow = rowTexts.find((t) => t.includes('Zona Común'));
    expect(noArrendadoRow).toContain('redistribuido a Arrendado');
    expect(zonaComunRow).toContain('redistribuido a Arrendado');
    expect(fixture.nativeElement.querySelector('[data-testid="non-rented-cost"]').textContent).toContain('250.000');
    expect(fixture.nativeElement.querySelector('[data-testid="common-area-cost"]').textContent).toContain('250.000');
  });

  it('shows all five verifier chips with pass/fail state and the exact difference on failure', async () => {
    const bill = billFrom({
      meterVsBillPasses: false, meterVsBillDifference: '-5',
      sewerAllocationPasses: false, sewerAllocationDifference: '-1200',
    });
    const fixture = await setup(false, [PERIOD]);
    open(fixture, 7, bill);

    expect(fixture.nativeElement.querySelector('[data-testid="verifier-percentage-chip"]').textContent).toContain('Cumple');
    expect(fixture.nativeElement.querySelector('[data-testid="verifier-m3-chip"]').textContent).toContain('Falla');
    expect(fixture.nativeElement.querySelector('[data-testid="verifier-aqueduct-chip"]').textContent).toContain('Cumple');
    expect(fixture.nativeElement.querySelector('[data-testid="verifier-sewer-chip"]').textContent).toContain('Falla');
    expect(fixture.nativeElement.querySelector('[data-testid="verifier-final-chip"]').textContent).toContain('Cumple');
    expect(fixture.nativeElement.textContent).toContain('-5 m³');
    expect(fixture.nativeElement.textContent).toContain('1.200');
  });

  it('adding a bill-level comment persists it and clears the input', async () => {
    const bill = billFrom({});
    const fixture = await setup(false, [PERIOD]);
    open(fixture, 7, bill);
    fixture.componentInstance.newCommentText = 'Fuga reportada en octubre';

    fixture.componentInstance.addBillComment();

    const req = httpMock.expectOne(`${environment.apiUrl}/WaterBills/7/Comments`);
    expect(req.request.body).toEqual({ waterMeterReadingId: null, text: 'Fuga reportada en octubre' });
    req.flush({ id: 1 });

    // addBillComment() triggers reload() - ApartmentsService caches its response for the session
    // (already warm from open()'s own initial reload), so only the bill itself is re-fetched.
    httpMock.expectOne(`${environment.apiUrl}/WaterBills/7`).flush({ ...bill, comments: [{ id: 1, waterMeterReadingId: null, text: 'Fuga reportada en octubre', createdAt: '2027-01-01T00:00:00Z' }] });
    fixture.detectChanges();

    expect(fixture.componentInstance.newCommentText).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Fuga reportada en octubre');
  });
});
