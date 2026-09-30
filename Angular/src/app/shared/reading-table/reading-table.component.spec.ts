import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { ReadingTableComponent } from './reading-table.component';
import { AddReadingDialogComponent } from '../../add-reading-dialog/add-reading-dialog.component';
import { ApartmentDto } from '../apartment.model';
import { ServiceName } from '../service-name';
import { environment } from '../../../environments/environment';

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
const CURRENT_YEAR = String(new Date().getFullYear());
// getReadings() fetches a FULL year of billing periods for both the current
// year and the previous one, each mapped through getOrCreateDate - every
// month of both years needs a seeded Date row, or the missing ones trigger
// real POST /Dates creates instead of resolving from this fixture.
// Current year's ids match `month` 1-12 exactly (tests key their fixtures off
// `dateId = new Date().getMonth() + 1`) - the previous year's ids are offset
// clear of that range so both years can be seeded without collisions.
const MOCK_DATES = [
  ...MONTH_NAMES.map((month, i) => ({ id: i + 1, month, year: CURRENT_YEAR })),
  ...MONTH_NAMES.map((month, i) => ({ id: i + 13, month, year: String(Number(CURRENT_YEAR) - 1) })),
];

function utilityIdFor(service: ServiceName): number {
  return MOCK_UTILITIES.find((u) => u.name === service)!.id;
}

describe('ReadingTableComponent', () => {
  let component: ReadingTableComponent;
  let fixture: ComponentFixture<ReadingTableComponent>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let httpMock: HttpTestingController;

  // Only one utility is ever involved (the single `service` input), so -
  // unlike the old all-three-services CounterUtilitiesComponent test - the
  // Utilities -> BillingPeriods(x2 years) -> Dates + CounterUtilities
  // sequence is fully deterministic and can be flushed in a fixed order
  // rather than needing a generic drain loop.
  async function setup(isReadOnly = false, service: ServiceName = 'Agua') {
    dialogOpen = vi.fn().mockReturnValue({ afterClosed: () => of(null) });

    await TestBed.configureTestingModule({
      imports: [ReadingTableComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: { open: dialogOpen } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReadingTableComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('service', service);
    fixture.componentRef.setInput('isReadOnly', isReadOnly);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush(MOCK_APARTMENTS);
    fixture.detectChanges();

    const utilityId = utilityIdFor(service);
    httpMock.expectOne(`${environment.apiUrl}/Utilities`).flush(MOCK_UTILITIES);
    httpMock
      .expectOne(`${environment.apiUrl}/Utilities/${utilityId}/BillingPeriods?year=${Number(CURRENT_YEAR) - 1}`)
      .flush({ utilityId, periods: defaultMonthlyPeriods(Number(CURRENT_YEAR) - 1) });
    httpMock
      .expectOne(`${environment.apiUrl}/Utilities/${utilityId}/BillingPeriods?year=${CURRENT_YEAR}`)
      .flush({ utilityId, periods: defaultMonthlyPeriods(Number(CURRENT_YEAR)) });
    httpMock.expectOne(`${environment.apiUrl}/Dates`).flush(MOCK_DATES);
    httpMock.expectOne(`${environment.apiUrl}/CounterUtilities`).flush([]);
    fixture.detectChanges();
  }

  beforeEach(() => setup());

  afterEach(() => {
    try {
      httpMock.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lists a tab per apartment', () => {
    expect(fixture.nativeElement.textContent).toContain('Apto 101');
    expect(fixture.nativeElement.textContent).toContain('Apto 201');
  });

  it('getRows$ returns only the previous and current period, cached across repeated calls', () => {
    let rows: { month: number }[] | undefined;
    component.getRows$({ id: 1, number: '101', owner: 'TBD', ...CONTRACT_FIELDS }).subscribe((r) => (rows = r));

    const currentMonth = new Date().getMonth() + 1;
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    expect(rows?.map((r) => r.month)).toEqual([previousMonth, currentMonth]);
  });

  it('shows a Cantidad a pagar column and hides Acciones for a read-only (tenant) caller', async () => {
    expect(component.displayedColumns).toContain('cantidadAPagar');
    expect(component.displayedColumns).toContain('acciones');

    TestBed.resetTestingModule();
    await setup(true);

    expect(component.displayedColumns).toContain('cantidadAPagar');
    expect(component.displayedColumns).not.toContain('acciones');
  });

  it('shows the Agregar Lectura button only for an admin', async () => {
    expect(fixture.nativeElement.textContent).toContain('Agregar Lectura');

    TestBed.resetTestingModule();
    await setup(true);

    expect(fixture.nativeElement.textContent).not.toContain('Agregar Lectura');
  });

  it('openAddReadingDialog opens the dialog with the apartment/service context', () => {
    const apartment = { id: 2, number: '201', owner: 'Bryan', ...CONTRACT_FIELDS };

    component.openAddReadingDialog(apartment);

    expect(dialogOpen).toHaveBeenCalledWith(
      AddReadingDialogComponent,
      expect.objectContaining({
        data: { apartmentId: apartment.id, apartment: apartment.number, owner: apartment.owner, service: 'Agua' },
      }),
    );
  });

  it('openAddReadingDialog passes the existing month/counter through when editing a row', () => {
    const apartment = { id: 2, number: '201', owner: 'Bryan', ...CONTRACT_FIELDS };
    const existing = { month: 5, year: 2026, counter: '1520', evidenceFileName: null, fee: '12500', monthLabel: 'Mayo' };

    component.openAddReadingDialog(apartment, existing);

    expect(dialogOpen).toHaveBeenCalledWith(
      AddReadingDialogComponent,
      expect.objectContaining({
        data: { apartmentId: apartment.id, apartment: apartment.number, owner: apartment.owner, service: 'Agua', month: 5, year: 2026, counter: '1520' },
      }),
    );
  });

  it('emits readingSaved and invalidates the cached rows for that apartment when the dialog closes with a save', () => {
    const apartment = { id: 1, number: '101', owner: 'TBD', ...CONTRACT_FIELDS };
    // getRows$ already resolved once during setup()'s render pass, caching
    // it under this apartment/service key.
    const cachedBeforeSave = component.getRows$(apartment);
    let emitted = false;
    component.readingSaved.subscribe(() => (emitted = true));
    dialogOpen.mockReturnValue({ afterClosed: () => of(true) });

    component.openAddReadingDialog(apartment);

    expect(emitted).toBe(true);
    // A fresh Observable instance means the rowsCache entry was invalidated -
    // the next render's async pipe will re-subscribe instead of replaying
    // the stale rows (the underlying Utilities/BillingPeriods/Dates/
    // CounterUtilities lookups all stay cached at their own service level,
    // so this resolves synchronously with no further HTTP calls).
    expect(component.getRows$(apartment)).not.toBe(cachedBeforeSave);
  });

  it('does not emit readingSaved when the dialog is closed without saving', () => {
    const apartment = { id: 1, number: '101', owner: 'TBD', ...CONTRACT_FIELDS };
    let emitted = false;
    component.readingSaved.subscribe(() => (emitted = true));

    component.openAddReadingDialog(apartment);

    expect(emitted).toBe(false);
  });
});
