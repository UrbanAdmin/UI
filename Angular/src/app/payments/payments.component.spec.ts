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

  async function setup(isApartmentOwner = false) {
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
    // invalidated by the write above, so only it refetches.
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
    // invalidated by the write above, so only it refetches.
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

  it('shows the Pagado toggle for an Admin', () => {
    expect(component.isReadOnly).toBe(false);
    expect(fixture.nativeElement.querySelector('mat-slide-toggle')).toBeTruthy();
  });

  it('shows the editable Fecha límite de pago control for an Admin', () => {
    expect(fixture.nativeElement.textContent).toContain('Guardar');
  });

  it('hides the Servicio filter for an ApartmentOwner but keeps Mes/Año', async () => {
    TestBed.resetTestingModule();
    await setupOwner();

    const labels: string[] = Array.from(fixture.nativeElement.querySelectorAll('mat-label')).map(
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

  it('hides the Pagado toggle for an ApartmentOwner, showing a check/cancel icon instead', async () => {
    TestBed.resetTestingModule();
    await setupOwner();

    expect(component.isReadOnly).toBe(true);
    expect(fixture.nativeElement.querySelector('mat-slide-toggle')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('mat-icon')).toBeTruthy();
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
