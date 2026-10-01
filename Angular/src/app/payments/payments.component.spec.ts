import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { PaymentsComponent } from './payments.component';
import { AuthService } from '../auth.service';
import { environment } from '../../environments/environment';

const UTILITIES_URL = `${environment.apiUrl}/Utilities`;
const DATES_URL = `${environment.apiUrl}/Dates`;
const APARTMENTS_URL = `${environment.apiUrl}/Apartments`;
const DEADLINES_URL = `${environment.apiUrl}/Deadlines`;
const PAYMENT_STATUSES_URL = `${environment.apiUrl}/PaymentStatuses`;
const WATER_BILLS_URL = `${environment.apiUrl}/WaterBills`;

const MOCK_APARTMENTS = [
  { id: 1, name: '101', owner: 'TBD' },
  { id: 2, name: '201', owner: 'Bryan' },
  { id: 3, name: '202', owner: 'Yesenia' },
  { id: 4, name: '301', owner: 'Oscar' },
  { id: 5, name: '302', owner: 'Olga' },
  { id: 6, name: '401', owner: 'Daniel' },
];
const MOCK_UTILITIES = [{ id: 1, name: 'Agua' }, { id: 2, name: 'Luz' }, { id: 3, name: 'Gas' }];

describe('PaymentsComponent', () => {
  let component: PaymentsComponent;
  let fixture: ComponentFixture<PaymentsComponent>;
  let httpMock: HttpTestingController;
  let currentDateId: number;

  function emptyBillDetail(period: { id: number; startDate: string; endDate: string; confirmed: boolean }) {
    return { ...period, totalValue: null, readings: [], comments: [] };
  }

  async function setup(
    isApartmentOwner = false,
    waterBillPeriods: { id: number; startDate: string; endDate: string; confirmed: boolean }[] = [],
    billDetailByPeriodId: Record<number, unknown> = {},
  ) {
    await TestBed.configureTestingModule({
      imports: [PaymentsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isApartmentOwner: () => isApartmentOwner } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    const now = new Date();
    currentDateId = 1;
    httpMock.expectOne(UTILITIES_URL).flush(MOCK_UTILITIES);
    httpMock.expectOne(DATES_URL).flush([{ id: currentDateId, month: monthNameFor(now), year: String(now.getFullYear()) }]);
    httpMock.expectOne(APARTMENTS_URL).flush(MOCK_APARTMENTS);
    httpMock.expectOne(PAYMENT_STATUSES_URL).flush([]);
    httpMock.expectOne(DEADLINES_URL).flush([]);
    // Agua is the default selectedService, so the admin template renders the
    // Periodo picker (and subscribes aguaPeriods$) on this very first
    // detectChanges(). A non-empty list auto-selects a period synchronously
    // (within this same flush), which immediately fires rows$'s own
    // GET /WaterBills/{id} for that period's live Total a pagar - flush it
    // with a minimal stub unless the test supplied real reading data.
    httpMock.expectOne(WATER_BILLS_URL).flush({ periods: waterBillPeriods, nextSuggestedStartDate: null });
    if (component.selectedPeriodId !== null) {
      const period = waterBillPeriods.find((p) => p.id === component.selectedPeriodId)!;
      httpMock
        .expectOne(`${WATER_BILLS_URL}/${component.selectedPeriodId}`)
        .flush(billDetailByPeriodId[component.selectedPeriodId] ?? emptyBillDetail(period));
    }
    fixture.detectChanges();
  }

  /** An ApartmentOwner's page loads every servicio (including Arriendo) at
   *  once instead of one selected servicio, so its initial HTTP exchange
   *  differs from the admin setup() above: no separate rows$ subscription,
   *  and Arriendo's utility-creation dance happens on the very first load
   *  rather than only after switching selectedService. */
  async function setupOwner() {
    await TestBed.configureTestingModule({
      imports: [PaymentsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isApartmentOwner: () => true } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    const now = new Date();
    currentDateId = 1;
    flushArriendoUtilityCreation();
    httpMock.expectOne(DATES_URL).flush([{ id: currentDateId, month: monthNameFor(now), year: String(now.getFullYear()) }]);
    httpMock.expectOne(APARTMENTS_URL).flush(MOCK_APARTMENTS);
    httpMock.expectOne(PAYMENT_STATUSES_URL).flush([]);
    httpMock.expectOne(DEADLINES_URL).flush([]);
    fixture.detectChanges();
  }

  beforeEach(() => setup());

  afterEach(() => {
    httpMock.verify();
  });

  function monthNameFor(date: Date): string {
    const names = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    return names[date.getMonth()];
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to the current month/year and load rows for all apartments', () => {
    const now = new Date();
    expect(component.selectedMonth).toBe(now.getMonth() + 1);
    expect(component.selectedYear).toBe(now.getFullYear());

    let rows: unknown[] | undefined;
    component.rows$.subscribe((r) => (rows = r));
    expect(rows?.length).toBe(6);
  });

  it('togglePaid should PUT/POST the new paid state and reload the rows', () => {
    let rows: { apartmentId: number; paid: boolean }[] | undefined;
    component.rows$.subscribe((r) => (rows = r as typeof rows));
    const row = rows!.find((r) => r.apartmentId === 1)!;

    component.togglePaid(row as never, true);

    // Utilities/Dates/PaymentStatuses were already fetched (and cached) by
    // the initial load in beforeEach, so setPaid's existing-row lookup
    // reuses that cache and goes straight to POST - no new GETs here.
    const postReq = httpMock.expectOne(PAYMENT_STATUSES_URL);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ Apartment_Id: 1, Utility_Id: 1, Date_Id: currentDateId, Paid: true, Amount: null });
    postReq.flush({ id: 0 });

    // reload triggered by onPeriodChange(): only PaymentStatuses' cache was
    // invalidated by the write above, so only it refetches - aguaPeriods$ is
    // deliberately NOT re-fetched here (only on Servicio->Agua or opening the
    // Periodo dropdown), so no WaterBills call happens from this write.
    httpMock.expectOne(PAYMENT_STATUSES_URL).flush([{ id: 1, apartmentId: 1, utilityId: 1, dateId: currentDateId, paid: true }]);
  });

  it('saveDeadline should POST the new deadline and reload the period', () => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 7);

    component.saveDeadline(newDate);

    // Utilities/Dates/Deadlines were already fetched (and cached) by the
    // initial load in beforeEach, so setDeadline's existing-row lookup
    // reuses that cache and goes straight to POST - no new GETs here.
    const postReq = httpMock.expectOne(DEADLINES_URL);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ Utility_Id: 1, Date_Id: currentDateId, DueDate: newDate.toISOString() });
    postReq.flush({ id: 0 });

    // reload triggered by onPeriodChange(): only Deadlines' cache was
    // invalidated by the write above, so only it refetches - aguaPeriods$ is
    // deliberately NOT re-fetched here (only on Servicio->Agua or opening the
    // Periodo dropdown), so no WaterBills call happens from this write.
    httpMock.expectOne(DEADLINES_URL).flush([{ id: 9, utilityId: 1, dateId: currentDateId, dueDate: newDate.toISOString() }]);

    let deadline: Date | null | undefined;
    component.deadline$.subscribe((d) => (deadline = d));
    expect(deadline?.toDateString()).toBe(newDate.toDateString());
  });

  it('Arriendo has no shared deadline - deadline$ resolves to null without any extra fetch', () => {
    component.selectedService = 'Arriendo';
    component.onPeriodChange();

    let deadline: Date | null | undefined = undefined;
    component.deadline$.subscribe((d) => (deadline = d));

    expect(deadline).toBeNull();
    httpMock.expectNone(DEADLINES_URL);

    // The table's own live binding to rows$ independently reacts to the same
    // onPeriodChange() and needs 'Arriendo' created as a Utility - drain that
    // so it doesn't leak into this test's httpMock.verify().
    flushArriendoUtilityCreation();
  });

  it('Arriendo rows still load (via a newly created Arriendo utility), each carrying its own dueDate', () => {
    component.selectedService = 'Arriendo';
    component.onPeriodChange();

    // 'Arriendo' isn't in the cached Utilities list yet, so getOrCreateUtility
    // creates it - both the table's own live binding to rows$ and this test's
    // subscribe() below trigger that independently, so drain every matching
    // request rather than assuming exactly one.
    flushArriendoUtilityCreation();

    let rows: { apartmentId: number; dueDate: Date }[] | undefined;
    component.rows$.subscribe((r) => (rows = r as typeof rows));
    flushArriendoUtilityCreation();

    expect(rows?.length).toBe(6);
    expect(rows?.every((r) => r.dueDate instanceof Date)).toBe(true);
  });

  it('shows an editable "Cantidad a pagar" column for Arriendo when an Admin', () => {
    component.selectedService = 'Arriendo';
    component.onPeriodChange();
    flushArriendoUtilityCreation();
    fixture.detectChanges();

    expect(component.displayedColumns).toContain('amount');
    expect(fixture.nativeElement.textContent).toContain('Cantidad a pagar');
    expect(fixture.nativeElement.querySelector('input[inputmode="numeric"]')).toBeTruthy();
  });

  it('shows an editable "Cantidad a pagar" column for every servicio, not just Arriendo', () => {
    // Luz, not the default Agua: Agua now needs a real Lecturas period selected first
    // (covered by its own tests below) - this one just checks the generic column/input.
    component.selectedService = 'Luz';
    component.onServicioChange();
    fixture.detectChanges();

    expect(component.displayedColumns).toContain('amount');
    expect(fixture.nativeElement.textContent).toContain('Cantidad a pagar');
    expect(fixture.nativeElement.querySelector('input[inputmode="numeric"]')).toBeTruthy();
  });

  it('onAmountChange calls setAmount and reloads the rows', () => {
    component.selectedService = 'Arriendo';
    component.onPeriodChange();
    flushArriendoUtilityCreation();

    let rows: { apartmentId: number }[] | undefined;
    component.rows$.subscribe((r) => (rows = r as typeof rows));
    flushArriendoUtilityCreation();
    const row = rows!.find((r) => r.apartmentId === 1)!;

    component.onAmountChange(row as never, '750000');

    const postReq = httpMock.expectOne(PAYMENT_STATUSES_URL);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ Apartment_Id: 1, Utility_Id: 4, Date_Id: currentDateId, Paid: false, Amount: '750000' });
    postReq.flush({ id: 0 });

    httpMock.expectOne(PAYMENT_STATUSES_URL).flush([]);
  });

  it('typing several keystrokes then blurring saves exactly once, with the final value', () => {
    component.selectedService = 'Arriendo';
    component.onPeriodChange();
    flushArriendoUtilityCreation();

    let rows: { apartmentId: number }[] | undefined;
    component.rows$.subscribe((r) => (rows = r as typeof rows));
    flushArriendoUtilityCreation();
    const row = rows!.find((r) => r.apartmentId === 1)!;

    component.onAmountFocus(row as never);
    component.onAmountInput(row as never, '7');
    component.onAmountInput(row as never, '75');
    component.onAmountInput(row as never, '750000');
    httpMock.expectNone(PAYMENT_STATUSES_URL);

    component.onAmountBlur(row as never);

    const postReq = httpMock.expectOne(PAYMENT_STATUSES_URL);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ Apartment_Id: 1, Utility_Id: 4, Date_Id: currentDateId, Paid: false, Amount: '750000' });
    postReq.flush({ id: 0 });

    httpMock.expectOne(PAYMENT_STATUSES_URL).flush([]);
  });

  it('leaving the amount blank on blur does not save and reverts to the original amount', () => {
    component.selectedService = 'Arriendo';
    component.onPeriodChange();
    flushArriendoUtilityCreation();

    let rows: { apartmentId: number; amount: string | null }[] | undefined;
    component.rows$.subscribe((r) => (rows = r as typeof rows));
    flushArriendoUtilityCreation();
    const row = rows!.find((r) => r.apartmentId === 1)!;
    const originalAmount = row.amount;

    component.onAmountFocus(row as never);
    component.onAmountInput(row as never, '750000');
    component.onAmountInput(row as never, '');
    component.onAmountBlur(row as never);

    httpMock.expectNone(PAYMENT_STATUSES_URL);
    expect(row.amount).toBe(originalAmount);
  });

  it('blurring without having typed anything does not re-save the unchanged amount', () => {
    component.selectedService = 'Arriendo';
    component.onPeriodChange();
    flushArriendoUtilityCreation();

    let rows: { apartmentId: number }[] | undefined;
    component.rows$.subscribe((r) => (rows = r as typeof rows));
    flushArriendoUtilityCreation();
    const row = rows!.find((r) => r.apartmentId === 1)!;

    component.onAmountFocus(row as never);
    component.onAmountBlur(row as never);

    httpMock.expectNone(PAYMENT_STATUSES_URL);
  });

  it('shows the Pagado toggle for an Admin', () => {
    // Luz, not the default Agua: Agua now needs a real Lecturas period selected first
    // (covered by its own tests below) - this one just checks the generic toggle.
    component.selectedService = 'Luz';
    component.onServicioChange();
    fixture.detectChanges();

    expect(component.isReadOnly).toBe(false);
    expect(fixture.nativeElement.querySelector('.pay-chip')).toBeTruthy();
  });

  it('shows the editable Fecha límite de pago control for an Admin', () => {
    expect(fixture.nativeElement.textContent).toContain('Guardar');
  });

  it('hides the Servicio filter for an ApartmentOwner but keeps Mes/Año', async () => {
    TestBed.resetTestingModule();
    await setupOwner();

    const labels: string[] = Array.from(fixture.nativeElement.querySelectorAll('.field > label')).map(
      (el) => (el as Element).textContent ?? '',
    );
    expect(labels).not.toContain('Servicio');
    expect(labels).toContain('Mes');
    expect(labels).toContain('Año');
  });

  it('groups every servicio (including Arriendo) into one table for an ApartmentOwner', async () => {
    TestBed.resetTestingModule();
    await setupOwner();

    let rows: { service: string }[] | undefined;
    component.ownerRows$.subscribe((r) => (rows = r as typeof rows));

    expect(Array.from(new Set(rows?.map((r) => r.service))).sort()).toEqual(['Agua', 'Arriendo', 'Gas', 'Luz']);
    expect(component.ownerDisplayedColumns).toContain('service');
    expect(fixture.nativeElement.textContent).toContain('Servicio');
  });

  it('drops the Pagado column entirely for an ApartmentOwner (redundant with Estado)', async () => {
    TestBed.resetTestingModule();
    await setupOwner();

    expect(component.isReadOnly).toBe(true);
    expect(component.ownerDisplayedColumns).not.toContain('paid');
    expect(fixture.nativeElement.querySelector('.pay-chip')).toBeFalsy();
    expect(fixture.nativeElement.textContent).not.toContain('Pagado');
  });

  it('shows the Cantidad a pagar amount as read-only text for an ApartmentOwner', async () => {
    TestBed.resetTestingModule();
    await setupOwner();

    expect(component.ownerDisplayedColumns).toContain('amount');
    expect(fixture.nativeElement.querySelector('input[inputmode="numeric"]')).toBeFalsy();
    expect(fixture.nativeElement.textContent).toContain('Cantidad a pagar');
  });

  it('does not show a Servicio-select-driven Fecha límite de pago/Guardar control for an ApartmentOwner', async () => {
    TestBed.resetTestingModule();
    await setupOwner();

    expect(fixture.nativeElement.textContent).not.toContain('Guardar');
  });

  // ---- Pagos follow-up to 027-align-pagos-facturas (mockup Mockups/pagos-agua-periodo/): a ----
  // ---- real Periodo picker replaces Mes/Año for Agua, since Water billing periods are ----
  // ---- day-precise and often bimonthly, not month-keyed like every other service ----

  function flushDateCreation(month: number, year: number, dateId: number): void {
    const postReq = httpMock.expectOne(DATES_URL);
    expect(postReq.request.method).toBe('POST');
    postReq.flush({ id: 0 });
    httpMock
      .expectOne(DATES_URL)
      .flush([
        { id: currentDateId, month: monthNameFor(new Date()), year: String(new Date().getFullYear()) },
        { id: dateId, month: monthNameFor(new Date(year, month - 1, 1)), year: String(year) },
      ]);
  }

  it('falls back to the selected WaterBill\'s own live Total a pagar when Pagos has nothing synced yet', async () => {
    TestBed.resetTestingModule();
    const now = new Date();
    const period = {
      id: 2,
      startDate: new Date(now.getFullYear(), now.getMonth(), 10).toISOString(),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 7).toISOString(),
      confirmed: false, // unconfirmed - 027 would not have synced PaymentStatus.Amount yet
    };
    await setup(false, [period], {
      2: {
        ...period,
        readings: [
          { id: 1, apartmentId: 1, finalAmount: '52000' },
          { id: 2, apartmentId: null, finalAmount: '9000' }, // Zona Común - no apartment row to merge into
        ],
        comments: [],
      },
    });

    let rows: { apartmentId: number; amount: string | null }[] | undefined;
    component.rows$.subscribe((r) => (rows = r as typeof rows));
    expect(rows?.find((r) => r.apartmentId === 1)?.amount).toBe('52000');
  });

  it('prefers an already-synced Pagos amount over the live Lecturas figure', async () => {
    TestBed.resetTestingModule();
    const now = new Date();
    const period = {
      id: 2,
      startDate: new Date(now.getFullYear(), now.getMonth(), 10).toISOString(),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 7).toISOString(),
      confirmed: true,
    };
    await TestBed.configureTestingModule({
      imports: [PaymentsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: { isApartmentOwner: () => false } }],
    }).compileComponents();
    fixture = TestBed.createComponent(PaymentsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    currentDateId = 1;
    httpMock.expectOne(UTILITIES_URL).flush(MOCK_UTILITIES);
    httpMock.expectOne(DATES_URL).flush([{ id: currentDateId, month: monthNameFor(now), year: String(now.getFullYear()) }]);
    httpMock.expectOne(APARTMENTS_URL).flush(MOCK_APARTMENTS);
    // Apartment 1 already has a synced PaymentStatus amount (post-confirm, via 027).
    httpMock.expectOne(PAYMENT_STATUSES_URL).flush([{ id: 1, apartmentId: 1, utilityId: 1, dateId: currentDateId, paid: false, amount: '45000' }]);
    httpMock.expectOne(DEADLINES_URL).flush([]);
    httpMock.expectOne(WATER_BILLS_URL).flush({ periods: [period], nextSuggestedStartDate: null });
    httpMock.expectOne(`${WATER_BILLS_URL}/2`).flush({ ...period, readings: [{ id: 1, apartmentId: 1, finalAmount: '99999' }], comments: [] });
    fixture.detectChanges();

    let rows: { apartmentId: number; amount: string | null }[] | undefined;
    component.rows$.subscribe((r) => (rows = r as typeof rows));
    expect(rows?.find((r) => r.apartmentId === 1)?.amount).toBe('45000');
  });

  it('lists real Lecturas periods newest-first and auto-selects the one matching the current month', async () => {
    TestBed.resetTestingModule();
    const now = new Date();
    const olderStart = new Date(now.getFullYear(), now.getMonth() - 2, 15).toISOString();
    const olderEnd = new Date(now.getFullYear(), now.getMonth() - 1, 12).toISOString();
    const currentStart = new Date(now.getFullYear(), now.getMonth(), 10).toISOString();
    const currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 7).toISOString();
    await setup(false, [
      { id: 1, startDate: olderStart, endDate: olderEnd, confirmed: true },
      { id: 2, startDate: currentStart, endDate: currentEnd, confirmed: false },
    ]);

    let periods: { id: number }[] | undefined;
    component.aguaPeriods$.subscribe((p) => (periods = p as typeof periods));
    expect(periods?.map((p) => p.id)).toEqual([2, 1]);
    expect(component.selectedPeriodId).toBe(2);
    expect(component.selectedMonth).toBe(now.getMonth() + 1);
    expect(component.selectedYear).toBe(now.getFullYear());
  });

  it('shows the empty-periods hint and hides the table when Agua has no Lecturas periods yet', async () => {
    TestBed.resetTestingModule();
    await setup(false, []);

    expect(fixture.nativeElement.querySelector('[data-testid="agua-no-periods-hint"]')).toBeTruthy();
    expect(component.selectedPeriodId).toBeNull();
    expect(fixture.nativeElement.querySelector('.pay-chip')).toBeFalsy();
  });

  it('selecting a different Agua period moves the table to that period\'s month', async () => {
    TestBed.resetTestingModule();
    const now = new Date();
    const olderStart = new Date(now.getFullYear(), now.getMonth() - 2, 15);
    const currentStart = new Date(now.getFullYear(), now.getMonth(), 10);
    await setup(false, [
      { id: 1, startDate: olderStart.toISOString(), endDate: new Date(now.getFullYear(), now.getMonth() - 1, 12).toISOString(), confirmed: true },
      { id: 2, startDate: currentStart.toISOString(), endDate: new Date(now.getFullYear(), now.getMonth() + 1, 7).toISOString(), confirmed: false },
    ]);
    // Default auto-selected period 2 (current month, already-cached Dates row) - no extra fetch yet.

    component.onAguaPeriodChange(1);
    // Period 1's month isn't the already-cached "today" row, so resolving it needs a new Dates row -
    // Utilities/Apartments/PaymentStatuses/Deadlines all fetch their whole table once and filter
    // client-side by period, so only Dates itself needs a fresh round trip here, plus the newly
    // selected period's own live bill detail for its Total a pagar fallback.
    flushDateCreation(olderStart.getMonth() + 1, olderStart.getFullYear(), 99);
    httpMock.expectOne(`${WATER_BILLS_URL}/1`).flush(emptyBillDetail({ id: 1, startDate: olderStart.toISOString(), endDate: olderStart.toISOString(), confirmed: true }));

    expect(component.selectedPeriodId).toBe(1);
    expect(component.selectedMonth).toBe(olderStart.getMonth() + 1);
    expect(component.selectedYear).toBe(olderStart.getFullYear());
  });

  it('shows Mes/Año (not Periodo) for a different servicio, and does not fetch WaterBills again', () => {
    component.selectedService = 'Luz';
    component.onServicioChange();
    flushArriendoUtilityCreation();
    fixture.detectChanges();

    const labels: string[] = Array.from(fixture.nativeElement.querySelectorAll('.field > label')).map(
      (el) => (el as Element).textContent ?? '',
    );
    expect(labels).toContain('Mes');
    expect(labels).toContain('Año');
    expect(labels).not.toContain('Periodo');
    httpMock.expectNone(WATER_BILLS_URL);
  });

  it('re-fetches periods and auto-selects again when Servicio switches back to Agua', () => {
    component.selectedService = 'Luz';
    component.onServicioChange();
    flushArriendoUtilityCreation();

    component.selectedService = 'Agua';
    component.onServicioChange();

    const now = new Date();
    const period = { id: 5, startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), endDate: new Date(now.getFullYear(), now.getMonth(), 28).toISOString(), confirmed: true };
    httpMock.expectOne(WATER_BILLS_URL).flush({ periods: [period], nextSuggestedStartDate: null });
    httpMock.expectOne(`${WATER_BILLS_URL}/5`).flush(emptyBillDetail(period));

    expect(component.selectedPeriodId).toBe(5);
  });

  it('never fetches WaterBills for an ApartmentOwner', async () => {
    TestBed.resetTestingModule();
    await setupOwner();

    httpMock.expectNone(WATER_BILLS_URL);
  });

  function flushArriendoUtilityCreation(): void {
    let posted = false;
    for (const req of httpMock.match(UTILITIES_URL)) {
      if (req.request.method === 'POST') {
        req.flush({ id: 0 });
        posted = true;
      } else {
        req.flush([...MOCK_UTILITIES, { id: 4, name: 'Arriendo' }]);
      }
    }
    if (posted) {
      for (const req of httpMock.match(UTILITIES_URL)) {
        req.flush([...MOCK_UTILITIES, { id: 4, name: 'Arriendo' }]);
      }
    }
  }
});
