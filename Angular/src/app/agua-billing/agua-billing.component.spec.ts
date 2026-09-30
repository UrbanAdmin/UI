import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { AguaBillingComponent } from './agua-billing.component';
import { AguaCycleDialogComponent } from '../agua-cycle-dialog/agua-cycle-dialog.component';
import { ApartmentDto } from '../shared/apartment.model';
import { AuthService } from '../auth.service';
import { BillingPeriodsService } from '../billing-periods/billing-periods.service';
import { ReadingsService } from '../readings/readings.service';
import { environment } from '../../environments/environment';

const CONTRACT_FIELDS = { contractStartDate: null, hasContract: false, contractFileName: null, status: 'Arrendado' as const };

const MOCK_APARTMENTS: ApartmentDto[] = [
  { id: 1, name: '101', owner: 'TBD', ...CONTRACT_FIELDS },
  { id: 2, name: '201', owner: 'Bryan', ...CONTRACT_FIELDS },
];

const MOCK_UTILITIES = [{ id: 1, name: 'Agua' }, { id: 2, name: 'Luz' }, { id: 3, name: 'Gas' }];

function defaultMonthlyPeriods(year: number) {
  return Array.from({ length: 12 }, (_, i) => ({
    anchorMonth: i + 1,
    anchorYear: year,
    secondMonth: null,
    secondYear: null,
    label: `${i + 1}/${year}`,
  }));
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const CURRENT_YEAR = new Date().getFullYear();
// getReadings() fetches a FULL year of billing periods for both the current
// year and the previous one, each mapped through getOrCreateDate - every
// month of both years needs a seeded Date row, or the missing ones trigger
// real POST /Dates creates instead of resolving from this fixture.
// Current year's ids match `month` 1-12 exactly (tests key their fixtures off
// `dateId = new Date().getMonth() + 1`) - the previous year's ids are offset
// clear of that range so both years can be seeded without collisions.
const MOCK_DATES = [
  ...MONTH_NAMES.map((month, i) => ({ id: i + 1, month, year: String(CURRENT_YEAR) })),
  ...MONTH_NAMES.map((month, i) => ({ id: i + 13, month, year: String(CURRENT_YEAR - 1) })),
];

// AguaBillingComponent's own period lookup and its child ReadingTableComponent's
// getRows$ both resolve through the same shared Utilities/BillingPeriods/Dates/
// CounterUtilities caches, but from two independent call sites - the exact
// interleaving of which request becomes pending first isn't worth hard-coding,
// so drain whatever's actually pending by URL pattern (same approach the old
// CounterUtilitiesComponent spec used for its own multi-source request tangle).
function drainRemainingRequests(
  httpMock: HttpTestingController,
  opts: { invoices: unknown[]; counterUtilities: unknown[]; needsInvoices: boolean },
): void {
  let flushedInvoices = !opts.needsInvoices;
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
        const year = Number(new URL(req.request.urlWithParams, 'http://x').searchParams.get('year'));
        req.flush({ utilityId: Number(billingMatch[1]), periods: defaultMonthlyPeriods(year) });
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

describe('AguaBillingComponent', () => {
  let component: AguaBillingComponent;
  let fixture: ComponentFixture<AguaBillingComponent>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let httpMock: HttpTestingController;

  async function setup(isApartmentOwner = false, invoices: unknown[] = [], counterUtilities: unknown[] = []) {
    dialogOpen = vi.fn().mockReturnValue({ afterClosed: () => of(null) });

    await TestBed.configureTestingModule({
      imports: [AguaBillingComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: AuthService, useValue: { isApartmentOwner: () => isApartmentOwner } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AguaBillingComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush(MOCK_APARTMENTS);
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/Utilities`).flush(MOCK_UTILITIES);
    drainRemainingRequests(httpMock, { invoices, counterUtilities, needsInvoices: !isApartmentOwner });
    fixture.detectChanges();
  }

  afterEach(() => {
    try {
      httpMock.verify();
    } finally {
      // Defensive: a leftover unflushed request throwing out of verify()
      // must not skip resetting TestBed, or every later test/file in this
      // worker fails with "test module already instantiated".
      TestBed.resetTestingModule();
    }
  });

  it('should create', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  it('shows a billing-period dropdown defaulting to the period containing today, for an admin', async () => {
    await setup();

    expect(fixture.nativeElement.textContent).toContain('Periodo');
    expect(component.aguaPeriods.length).toBeGreaterThan(0);
    const now = new Date();
    expect(component.selectedMonth).toBe(now.getMonth() + 1);
    expect(component.selectedYear).toBe(now.getFullYear());
    expect(component.selectedAguaPeriodKey).toBe(`${now.getMonth() + 1}-${now.getFullYear()}`);
  });

  it('shows the "Configurar periodo de facturación" link and the receipt card for an admin', async () => {
    await setup();

    expect(fixture.nativeElement.querySelector('[data-testid="agua-cycle-link"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Recibo de Agua');
  });

  it('hides the cycle link, the period dropdown and the receipt card for an ApartmentOwner, but still shows the reading table', async () => {
    await setup(true);

    expect(fixture.nativeElement.querySelector('[data-testid="agua-cycle-link"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Periodo');
    expect(fixture.nativeElement.textContent).not.toContain('Recibo de Agua');
    expect(fixture.nativeElement.querySelector('app-reading-table')).toBeTruthy();
  });

  it('onAguaPeriodChanged switches the selected month/year to match the chosen period', async () => {
    await setup();
    const otherPeriod = component.aguaPeriods.find(
      (p) => p.anchorMonth !== component.selectedMonth || p.anchorYear !== component.selectedYear,
    );
    if (!otherPeriod) {
      throw new Error('test fixture needs at least two distinct Agua periods');
    }

    component.selectedAguaPeriodKey = component.periodKey(otherPeriod);
    component.onAguaPeriodChanged();

    expect(component.selectedMonth).toBe(otherPeriod.anchorMonth);
    expect(component.selectedYear).toBe(otherPeriod.anchorYear);
  });

  it('openAguaCycleDialog opens AguaCycleDialogComponent with the Agua utility id', async () => {
    await setup();

    component.openAguaCycleDialog();

    expect(dialogOpen).toHaveBeenCalledWith(AguaCycleDialogComponent, expect.objectContaining({ data: { utilityId: 1 } }));
  });

  it('openAguaCycleDialog reloads the period list after a cycle change is saved', async () => {
    await setup();

    TestBed.inject(BillingPeriodsService).clearCache();
    dialogOpen.mockReturnValue({ afterClosed: () => of(true) });
    component.openAguaCycleDialog();

    httpMock
      .expectOne(`${environment.apiUrl}/Utilities/1/BillingPeriods?year=${CURRENT_YEAR - 1}`)
      .flush({ utilityId: 1, periods: defaultMonthlyPeriods(CURRENT_YEAR - 1) });
    httpMock
      .expectOne(`${environment.apiUrl}/Utilities/1/BillingPeriods?year=${CURRENT_YEAR}`)
      .flush({ utilityId: 1, periods: defaultMonthlyPeriods(CURRENT_YEAR) });

    expect(component.aguaPeriods.length).toBeGreaterThan(0);
  });

  it('onReadingSaved refreshes Total del recibo and Consumo total via the receipt card', async () => {
    const dateId = new Date().getMonth() + 1;
    await setup(false, [{ id: 5, totalCounter: '', total: '437590', dateId, utilityId: 1 }], [
      { id: 1, apartmentId: 1, utilityId: 1, dateId, invoiceId: 5, counter: '1520', difference: '11829', fee: '437590' },
    ]);
    expect(fixture.nativeElement.textContent).toContain('Recibo de Agua');

    // Simulates a saved reading's Difference landing (recordReading() would
    // have invalidated ReadingsService's CounterUtilities cache for real).
    TestBed.inject(ReadingsService).clearCache();

    component.onReadingSaved();

    httpMock
      .expectOne(`${environment.apiUrl}/CounterUtilities`)
      .flush([
        { id: 1, apartmentId: 1, utilityId: 1, dateId, invoiceId: 5, counter: '1520', difference: '11829', fee: '218795' },
        { id: 2, apartmentId: 2, utilityId: 1, dateId, invoiceId: 5, counter: '500', difference: '11829', fee: '218795' },
      ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('23.658');
  });
});
