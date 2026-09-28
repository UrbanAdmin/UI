import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { CounterUtilitiesComponent } from './counter-utilities.component';
import { AddReadingDialogComponent } from '../add-reading-dialog/add-reading-dialog.component';
import { AguaCycleDialogComponent } from '../agua-cycle-dialog/agua-cycle-dialog.component';
import { ApartmentDto } from '../shared/apartment.model';
import { AuthService } from '../auth.service';
import { ReadingsService } from '../readings/readings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { environment } from '../../environments/environment';

const CONTRACT_FIELDS = { contractStartDate: null, hasContract: false, contractFileName: null, status: 'Arrendado' as const };

const MOCK_APARTMENTS: ApartmentDto[] = [
  { id: 1, name: '101', owner: 'TBD', ...CONTRACT_FIELDS },
  { id: 2, name: '201', owner: 'Bryan', ...CONTRACT_FIELDS },
  { id: 3, name: '202', owner: 'Yesenia', ...CONTRACT_FIELDS },
  { id: 4, name: '301', owner: 'Oscar', ...CONTRACT_FIELDS },
  { id: 5, name: '302', owner: 'Olga', ...CONTRACT_FIELDS },
  { id: 6, name: '401', owner: 'Daniel', ...CONTRACT_FIELDS },
];

const MOCK_UTILITIES = [{ id: 1, name: 'Agua' }, { id: 2, name: 'Luz' }, { id: 3, name: 'Gas' }];

// A utility with no UtilityBillingCycle gets one plain calendar-month period
// per month (today's default behavior, GetUtilityBillingPeriods) - the same
// 12-month shape getReadings iterated before this feature existed.
function defaultMonthlyPeriods(year: number) {
  return Array.from({ length: 12 }, (_, i) => ({
    anchorMonth: i + 1,
    anchorYear: year,
    secondMonth: null,
    secondYear: null,
    label: `${i + 1}/${year}`,
  }));
}

// Drains and dispatches whatever HTTP requests are actually pending after
// Utilities is flushed, based on URL pattern rather than an assumed firing
// order - getBillingPeriods is a NEW request nested inside getReadings'
// chain (Utilities -> BillingPeriods -> Dates + CounterUtilities in
// parallel), and the exact number/order of BillingPeriods requests that
// exist at any one synchronous checkpoint isn't worth hard-coding.
function drainRemainingRequests(
  httpMock: HttpTestingController,
  opts: { year: number; invoices: unknown[]; counterUtilities: unknown[]; isApartmentOwner: boolean },
): void {
  let flushedInvoices = opts.isApartmentOwner;
  let flushedCounterUtilities = false;
  let safety = 50;

  while ((!flushedInvoices || !flushedCounterUtilities) && safety-- > 0) {
    const pending = httpMock.match(() => true);
    if (pending.length === 0) {
      throw new Error('drainRemainingRequests: no pending requests left but Invoices/CounterUtilities never arrived');
    }

    for (const req of pending) {
      const url = req.request.url;
      const billingMatch = url.match(/\/Utilities\/(\d+)\/BillingPeriods$/);
      if (url === `${environment.apiUrl}/Dates`) {
        req.flush(MOCK_DATES);
      } else if (billingMatch) {
        req.flush({ utilityId: Number(billingMatch[1]), periods: defaultMonthlyPeriods(opts.year) });
      } else if (url === `${environment.apiUrl}/Invoices`) {
        req.flush(opts.invoices);
        flushedInvoices = true;
      } else if (url === `${environment.apiUrl}/CounterUtilities`) {
        req.flush(opts.counterUtilities);
        flushedCounterUtilities = true;
      } else {
        throw new Error(`drainRemainingRequests: unexpected request ${req.request.method} ${url}`);
      }
    }
  }
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const CURRENT_YEAR = String(new Date().getFullYear());
// Includes December of the previous year too (id 0, distinct from the 1-12
// used below) so getRows$'s previous-month lookup still resolves without an
// unexpected create whenever a test happens to run in January.
const MOCK_DATES = [
  { id: 0, month: 'Diciembre', year: String(Number(CURRENT_YEAR) - 1) },
  ...MONTH_NAMES.map((month, i) => ({ id: i + 1, month, year: CURRENT_YEAR })),
];

describe('CounterUtilitiesComponent', () => {
  let component: CounterUtilitiesComponent;
  let fixture: ComponentFixture<CounterUtilitiesComponent>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let httpMock: HttpTestingController;

  async function setup(isApartmentOwner = false, invoices: unknown[] = [], counterUtilities: unknown[] = []) {
    dialogOpen = vi.fn().mockReturnValue({ afterClosed: () => of(null) });

    await TestBed.configureTestingModule({
      imports: [CounterUtilitiesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: AuthService, useValue: { isApartmentOwner: () => isApartmentOwner } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CounterUtilitiesComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush(MOCK_APARTMENTS);
    fixture.detectChanges();

    // The tab group renders all 6 apartments x 3 services eagerly, each
    // calling getRows$ - these fire once each (cached across all 18 combos):
    // Utilities, one BillingPeriods per distinct utility (new in this
    // feature), Dates, and CounterUtilities. Utilities/Dates are flushed
    // fully seeded so no lookup ever misses and tries to POST-create
    // mid-render. For Admin, the receipt card's constructor-time lookup
    // (loadExistingReceiptTotal) shares the Utilities/Dates caches, then
    // queries Invoices once they resolve.
    httpMock.expectOne(`${environment.apiUrl}/Utilities`).flush(MOCK_UTILITIES);
    drainRemainingRequests(httpMock, { year: Number(CURRENT_YEAR), invoices, counterUtilities, isApartmentOwner });
    fixture.detectChanges();
  }

  beforeEach(() => setup());

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should list all 6 apartments and the 3 services', async () => {
    const apartments = await new Promise<{ number: string }[]>((resolve) =>
      component.apartments$.subscribe(resolve),
    );
    expect(apartments.length).toBe(6);
    expect(component.services).toEqual(['Agua', 'Luz', 'Gas']);
  });

  it('getRows$ returns only the previous and current month, cached across repeated calls', () => {
    let rows: { month: number }[] | undefined;
    component.getRows$({ id: 1, number: '101', owner: 'TBD', ...CONTRACT_FIELDS }, 'Agua').subscribe((r) => (rows = r));

    // Already resolved during beforeEach's render pass - shareReplay(1)
    // replays it synchronously, no further HTTP calls expected here.
    const currentMonth = new Date().getMonth() + 1;
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    expect(rows?.map((r) => r.month)).toEqual([previousMonth, currentMonth]);
  });

  it('getRows$ shows a plain single-month label when no billing cycle is configured', () => {
    let rows: { monthLabel: string }[] | undefined;
    component.getRows$({ id: 1, number: '101', owner: 'TBD', ...CONTRACT_FIELDS }, 'Agua').subscribe((r) => (rows = r));

    // beforeEach's setup() seeds every utility with plain monthly periods
    // (no cycle configured), so today's row is a single month, not a range.
    expect(rows?.every((r) => !r.monthLabel.includes('–'))).toBe(true);
  });

  it('getRows$ labels a row with both months when Agua has a real billing period covering "now"', async () => {
    TestBed.resetTestingModule();
    dialogOpen = vi.fn().mockReturnValue({ afterClosed: () => of(null) });
    await TestBed.configureTestingModule({
      imports: [CounterUtilitiesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: AuthService, useValue: { isApartmentOwner: () => false } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CounterUtilitiesComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush(MOCK_APARTMENTS);
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/Utilities`).flush(MOCK_UTILITIES);

    const now = new Date();
    const anchorMonth = now.getMonth() % 2 === 0 ? now.getMonth() + 1 : now.getMonth();
    const period = {
      anchorMonth,
      anchorYear: now.getFullYear(),
      secondMonth: anchorMonth + 1,
      secondYear: now.getFullYear(),
      label: 'Un Periodo 2026',
    };

    let flushedInvoices = false;
    let flushedCounterUtilities = false;
    let safety = 50;
    while ((!flushedInvoices || !flushedCounterUtilities) && safety-- > 0) {
      const pending = httpMock.match(() => true);
      for (const req of pending) {
        const url = req.request.url;
        const billingMatch = url.match(/\/Utilities\/(\d+)\/BillingPeriods$/);
        if (billingMatch && Number(billingMatch[1]) === 1) {
          req.flush({ utilityId: 1, periods: [period] });
        } else if (billingMatch) {
          req.flush({ utilityId: Number(billingMatch[1]), periods: defaultMonthlyPeriods(now.getFullYear()) });
        } else if (url === `${environment.apiUrl}/Dates`) {
          req.flush(MOCK_DATES);
        } else if (url === `${environment.apiUrl}/Invoices`) {
          req.flush([]);
          flushedInvoices = true;
        } else if (url === `${environment.apiUrl}/CounterUtilities`) {
          req.flush([]);
          flushedCounterUtilities = true;
        } else {
          throw new Error(`unexpected request ${url}`);
        }
      }
    }
    fixture.detectChanges();

    let rows: { monthLabel: string }[] | undefined;
    component.getRows$({ id: 1, number: '101', owner: 'TBD', ...CONTRACT_FIELDS }, 'Agua').subscribe((r) => (rows = r));

    expect(rows?.some((r) => r.monthLabel === 'Un Periodo 2026')).toBe(true);
  });

  it('openAddReadingDialog should open the dialog with the apartment/service context', () => {
    const apartment = { id: 3, number: '202', owner: 'Yesenia', ...CONTRACT_FIELDS };

    component.openAddReadingDialog(apartment, 'Gas');

    expect(dialogOpen).toHaveBeenCalledWith(
      AddReadingDialogComponent,
      expect.objectContaining({
        data: { apartmentId: apartment.id, apartment: apartment.number, owner: apartment.owner, service: 'Gas' },
      }),
    );
  });

  it('openAddReadingDialog passes the existing month/counter through when editing a row', () => {
    const apartment = { id: 3, number: '202', owner: 'Yesenia', ...CONTRACT_FIELDS };
    const existing = { month: 5, year: 2026, counter: '1520', evidenceFileName: null, fee: '12500', monthLabel: 'Mayo' };

    component.openAddReadingDialog(apartment, 'Gas', existing);

    expect(dialogOpen).toHaveBeenCalledWith(
      AddReadingDialogComponent,
      expect.objectContaining({
        data: { apartmentId: apartment.id, apartment: apartment.number, owner: apartment.owner, service: 'Gas', month: 5, year: 2026, counter: '1520' },
      }),
    );
  });

  it('openAddReadingDialog refreshes Total del recibo and Consumo total when a reading is saved', async () => {
    TestBed.resetTestingModule();
    const dateId = new Date().getMonth() + 1;
    await setup(false, [{ id: 5, totalCounter: '', total: '437590', dateId, utilityId: 1 }], [
      { id: 1, apartmentId: 1, utilityId: 1, dateId, invoiceId: 5, counter: '1520', difference: '11829', fee: '437590' },
    ]);
    expect(component.consumoTotal).toBe(11829);

    // Simulates a new apartment's reading landing (its Difference now
    // shares the same period's consumption total): recordReading() would
    // have invalidated ReadingsService's CounterUtilities cache for real -
    // clearCache() reproduces that without needing the full dialog+save flow.
    TestBed.inject(ReadingsService).clearCache();
    dialogOpen.mockReturnValue({ afterClosed: () => of(true) });
    const apartment = { id: 2, number: '201', owner: 'Bryan', ...CONTRACT_FIELDS };

    component.openAddReadingDialog(apartment, 'Agua');

    httpMock
      .expectOne(`${environment.apiUrl}/CounterUtilities`)
      .flush([
        { id: 1, apartmentId: 1, utilityId: 1, dateId, invoiceId: 5, counter: '1520', difference: '11829', fee: '218795' },
        { id: 2, apartmentId: 2, utilityId: 1, dateId, invoiceId: 5, counter: '500', difference: '11829', fee: '218795' },
      ]);

    expect(component.consumoTotal).toBe(23658);
  });

  it('shows the add-reading buttons for an Admin', () => {
    expect(component.isReadOnly).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Agregar Lectura');
  });

  it('shows the "Configurar periodo de facturación" link only when Agua is selected and only for an admin', () => {
    component.selectedService = 'Agua';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="agua-cycle-link"]')).not.toBeNull();

    component.selectedService = 'Luz';
    fixture.detectChanges();
    // Switching selectedService re-evaluates the active apartment tab's
    // getRows$ binding for Luz, which fires fresh BillingPeriods requests
    // (Utilities/Dates/CounterUtilities are already cached from setup()) -
    // drain them so httpMock.verify() doesn't see them as leftover.
    for (const req of httpMock.match(() => true)) {
      const billingMatch = req.request.url.match(/\/Utilities\/(\d+)\/BillingPeriods$/);
      if (!billingMatch) {
        throw new Error(`unexpected request ${req.request.method} ${req.request.url}`);
      }
      req.flush({ utilityId: Number(billingMatch[1]), periods: defaultMonthlyPeriods(Number(CURRENT_YEAR)) });
    }
    expect(fixture.nativeElement.querySelector('[data-testid="agua-cycle-link"]')).toBeNull();
  });

  it('never shows the "Configurar periodo de facturación" link for an owner/tenant, even with Agua selected', async () => {
    TestBed.resetTestingModule();
    await setup(true);
    component.selectedService = 'Agua';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="agua-cycle-link"]')).toBeNull();
  });

  it('openAguaCycleDialog opens AguaCycleDialogComponent with the Agua utility id', () => {
    component.openAguaCycleDialog();

    expect(dialogOpen).toHaveBeenCalledWith(AguaCycleDialogComponent, expect.objectContaining({ data: { utilityId: 1 } }));
  });

  it('openAguaCycleDialog clears the cached rows so Lecturas refreshes after a cycle change is saved', () => {
    // getRows$ already resolved once during beforeEach's render pass -
    // without invalidating the cache, this would replay the stale rows
    // instead of refetching with the newly-saved cycle in effect.
    component.getRows$({ id: 1, number: '101', owner: 'TBD', ...CONTRACT_FIELDS }, 'Agua').subscribe();

    // The dialog is mocked here (its own save→POST flow is covered by
    // AguaCycleDialogComponent's and NotificationsService's own specs) -
    // clearCache() simulates the billing-periods cache invalidation the
    // real setBillingCycle() call would already have done before closing.
    TestBed.inject(NotificationsService).clearCache();
    dialogOpen.mockReturnValue({ afterClosed: () => of(true) });
    component.openAguaCycleDialog();

    component.getRows$({ id: 1, number: '101', owner: 'TBD', ...CONTRACT_FIELDS }, 'Agua').subscribe();
    // Both requests are flushed with CURRENT_YEAR-anchored periods (matching
    // this file's existing convention, e.g. drainRemainingRequests) so every
    // date resolved is one of the 12 MOCK_DATES already covers - a real
    // previous-year anchor would need Dates for 11 more months MOCK_DATES
    // deliberately doesn't stock (only its December is there).
    httpMock.expectOne(`${environment.apiUrl}/Utilities/1/BillingPeriods?year=${CURRENT_YEAR}`).flush({ utilityId: 1, periods: defaultMonthlyPeriods(Number(CURRENT_YEAR)) });
    httpMock.expectOne(`${environment.apiUrl}/Utilities/1/BillingPeriods?year=${Number(CURRENT_YEAR) - 1}`).flush({ utilityId: 1, periods: defaultMonthlyPeriods(Number(CURRENT_YEAR)) });
  });

  it('hides the add-reading buttons for an ApartmentOwner', async () => {
    TestBed.resetTestingModule();
    await setup(true);

    expect(component.isReadOnly).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('Agregar Lectura');
  });

  it('shows the receipt card for an Admin', () => {
    expect(fixture.nativeElement.textContent).toContain('Recibo de Agua');
  });

  it('hides the receipt card for an ApartmentOwner', async () => {
    TestBed.resetTestingModule();
    await setup(true);

    expect(fixture.nativeElement.textContent).not.toContain('Recibo de Agua');
  });

  it('shows a billing-period dropdown (not Mes/Año) for Agua, defaulting to the period containing today', () => {
    expect(fixture.nativeElement.textContent).toContain('Periodo');
    expect(component.aguaPeriods.length).toBeGreaterThan(0);
    const now = new Date();
    expect(component.selectedReceiptMonth).toBe(now.getMonth() + 1);
    expect(component.selectedReceiptYear).toBe(now.getFullYear());
    expect(component.selectedAguaPeriodKey).toBe(`${now.getMonth() + 1}-${now.getFullYear()}`);
  });

  it('shows plain Mes/Año dropdowns (not a period selector) for Luz/Gas', () => {
    component.selectedService = 'Luz';
    component.onServiceChanged();
    fixture.detectChanges();
    // Switching away from Agua re-evaluates the active apartment tab's
    // getRows$ binding for Luz, firing fresh BillingPeriods requests
    // (Utilities/Dates/CounterUtilities are already cached from setup()).
    for (const req of httpMock.match(() => true)) {
      const billingMatch = req.request.url.match(/\/Utilities\/(\d+)\/BillingPeriods$/);
      if (!billingMatch) {
        throw new Error(`unexpected request ${req.request.method} ${req.request.url}`);
      }
      req.flush({ utilityId: Number(billingMatch[1]), periods: defaultMonthlyPeriods(Number(CURRENT_YEAR)) });
    }
    fixture.detectChanges();

    const labels = Array.from(fixture.nativeElement.querySelectorAll('.field label')).map((el: any) => el.textContent);
    expect(labels).toContain('Mes');
    expect(labels).toContain('Año');
    expect(labels).not.toContain('Periodo');
  });

  it('onAguaPeriodChanged switches the selected anchor month/year to match the chosen period', () => {
    const otherPeriod = component.aguaPeriods.find((p) => p.anchorMonth !== component.selectedReceiptMonth || p.anchorYear !== component.selectedReceiptYear);
    if (!otherPeriod) {
      throw new Error('test fixture needs at least two distinct Agua periods');
    }

    component.selectedAguaPeriodKey = component.periodKey(otherPeriod);
    component.onAguaPeriodChanged();

    // Utilities/Dates/Invoices/CounterUtilities are all already cached from
    // setup()'s initial render - loadExistingReceiptTotal() replays them
    // rather than firing new requests, so only the state change is asserted.
    expect(component.selectedReceiptMonth).toBe(otherPeriod.anchorMonth);
    expect(component.selectedReceiptYear).toBe(otherPeriod.anchorYear);
  });

  it('still shows the shared Servicio selector for an ApartmentOwner, who has no receipt card of their own', async () => {
    TestBed.resetTestingModule();
    await setup(true);

    expect(fixture.nativeElement.querySelectorAll('.pill').length).toBe(3);
    expect(() => component.onServiceChanged()).not.toThrow();
  });

  it('shows a Cantidad a pagar column for both Admin and ApartmentOwner (inquilino)', async () => {
    expect(component.displayedColumns).toContain('cantidadAPagar');
    expect(fixture.nativeElement.textContent).toContain('Cantidad a pagar');

    TestBed.resetTestingModule();
    await setup(true);

    expect(component.displayedColumns).toContain('cantidadAPagar');
    expect(fixture.nativeElement.textContent).toContain('Cantidad a pagar');
  });

  it('pre-fills Total del recibo from an already-saved Invoice for the default Servicio/Mes/Año', async () => {
    TestBed.resetTestingModule();
    const dateId = new Date().getMonth() + 1;
    await setup(false, [{ id: 5, totalCounter: '', total: '437590', dateId, utilityId: 1 }]);

    expect(component.receiptTotal).toBe('437590');
  });

  it('has no pre-filled Total when no Invoice exists yet for the default period', () => {
    expect(component.receiptTotal).toBeNull();
  });

  it('onReceiptPeriodChanged re-filters the already-cached Invoices for the newly selected period', async () => {
    TestBed.resetTestingModule();
    const dateId = new Date().getMonth() + 1;
    await setup(false, [
      { id: 5, totalCounter: '', total: '437590', dateId, utilityId: 1 }, // Agua
      { id: 8, totalCounter: '', total: '95000', dateId, utilityId: 2 }, // Luz
    ]);
    expect(component.receiptTotal).toBe('437590');

    component.selectedService = 'Luz';
    component.onReceiptPeriodChanged();

    expect(component.receiptTotal).toBe('95000');
  });

  it('onServiceChanged recomputes Total del recibo for the newly selected Servicio - the single Servicio selector drives both the receipt card and the reading tables, so there is no separate per-tab selection to keep in sync', async () => {
    TestBed.resetTestingModule();
    const dateId = new Date().getMonth() + 1;
    await setup(false, [
      { id: 5, totalCounter: '', total: '437590', dateId, utilityId: 1 }, // Agua
      { id: 8, totalCounter: '', total: '95000', dateId, utilityId: 2 }, // Luz
    ]);
    expect(component.receiptTotal).toBe('437590');

    component.selectedService = 'Luz';
    component.onServiceChanged();

    expect(component.receiptTotal).toBe('95000');
  });

  it('has no Consumo total when no readings exist yet for the default period', () => {
    expect(component.consumoTotal).toBeNull();
  });

  it('computes Consumo total as the sum of every apartment\'s Difference for the default Servicio/Mes/Año', async () => {
    TestBed.resetTestingModule();
    const dateId = new Date().getMonth() + 1;
    await setup(false, [], [
      { id: 1, apartmentId: 1, utilityId: 1, dateId, invoiceId: 5, counter: '1520', difference: '11829', fee: '437590' },
      { id: 2, apartmentId: 2, utilityId: 1, dateId, invoiceId: 5, counter: '900', difference: '500', fee: '0' },
      { id: 3, apartmentId: 1, utilityId: 2, dateId, invoiceId: 6, counter: '200', difference: '20', fee: '0' }, // different Servicio
    ]);

    expect(component.consumoTotal).toBe(12329);
  });

  it('onReceiptPeriodChanged recomputes Consumo total for the newly selected Servicio', async () => {
    TestBed.resetTestingModule();
    const dateId = new Date().getMonth() + 1;
    await setup(false, [], [
      { id: 1, apartmentId: 1, utilityId: 1, dateId, invoiceId: 5, counter: '1520', difference: '11829', fee: '437590' }, // Agua
      { id: 2, apartmentId: 1, utilityId: 2, dateId, invoiceId: 6, counter: '200', difference: '20', fee: '0' }, // Luz
    ]);
    expect(component.consumoTotal).toBe(11829);

    component.selectedService = 'Luz';
    component.onReceiptPeriodChanged();

    expect(component.consumoTotal).toBe(20);
  });

  it('onReceiptFileSelected requests an OCR preview and pre-fills the receipt total', () => {
    const file = new File(['x'], 'recibo.pdf', { type: 'application/pdf' });

    component.onReceiptFileSelected({ target: { files: [file] } } as unknown as Event);

    expect(component.receiptFile).toBe(file);
    httpMock.expectOne(`${environment.apiUrl}/Invoices/OcrPreview`).flush({ suggestedTotal: '95000' });

    expect(component.receiptTotal).toBe('95000');
  });

  it('saveReceiptTotal sets the Invoice total then uploads the receipt when a file was chosen', async () => {
    TestBed.resetTestingModule();
    const dateId = new Date().getMonth() + 1;
    await setup(false, [{ id: 5, totalCounter: '', total: '', dateId, utilityId: 1 }]);

    const file = new File(['x'], 'recibo.pdf', { type: 'application/pdf' });
    component.onReceiptFileSelected({ target: { files: [file] } } as unknown as Event);
    httpMock.expectOne(`${environment.apiUrl}/Invoices/OcrPreview`).flush({ suggestedTotal: '95000' });

    component.saveReceiptTotal();

    // The Invoice for this period is already known (cached from the
    // constructor's pre-fill lookup, seeded via setup's `invoices` param),
    // so getOrCreateInvoice finds it without another GET /Invoices.
    const putReq = httpMock.expectOne(`${environment.apiUrl}/Invoice/5`);
    expect(putReq.request.body).toEqual({ Total_counter: '', Total: '95000', Date_id: dateId, Utility_id: 1 });
    putReq.flush({});

    const receiptReq = httpMock.expectOne(`${environment.apiUrl}/Invoice/5/Receipt`);
    expect(receiptReq.request.body instanceof FormData).toBe(true);
    receiptReq.flush(null);

    // The saved value stays visible - it was persisted correctly (verified
    // against the live Invoice/CounterUtility/PaymentStatus rows), so
    // clearing the field here only made it look like the save had failed.
    expect(component.receiptTotal).toBe('95000');
    expect(component.receiptFile).toBeNull();
  });

  it('saveReceiptTotal sets the Invoice total without uploading anything when no file was chosen', async () => {
    TestBed.resetTestingModule();
    const dateId = new Date().getMonth() + 1;
    await setup(false, [{ id: 5, totalCounter: '', total: '', dateId, utilityId: 1 }]);
    component.receiptTotal = '95000';

    component.saveReceiptTotal();

    httpMock.expectOne(`${environment.apiUrl}/Invoice/5`).flush({});

    httpMock.expectNone(`${environment.apiUrl}/Invoice/5/Receipt`);
    expect(component.receiptTotal).toBe('95000');
  });

  it('selecting the Gas pill swaps the Recibo card and apartment tabs for the embedded Gas billing flow', () => {
    component.selectedService = 'Gas';
    component.onServiceChanged();
    fixture.detectChanges();

    // DatesService/ApartmentsService are already cached from setup() (same current-year Dates,
    // same 6 apartments) - the only new call GasBillingComponent makes is its own bill lookup.
    const currentDateId = new Date().getMonth() + 1;
    httpMock.expectOne(`${environment.apiUrl}/GasBills/${currentDateId}`).flush(null, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-gas-billing')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.receipt-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('mat-tab-group')).toBeNull();
  });
});
