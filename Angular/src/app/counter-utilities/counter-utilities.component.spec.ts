import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { CounterUtilitiesComponent } from './counter-utilities.component';
import { AddReadingDialogComponent } from '../add-reading-dialog/add-reading-dialog.component';
import { ApartmentDto } from '../shared/apartment.model';
import { AuthService } from '../auth.service';
import { ReadingsService } from '../readings/readings.service';
import { environment } from '../../environments/environment';

const CONTRACT_FIELDS = { contractStartDate: null, hasContract: false, contractFileName: null };

const MOCK_APARTMENTS: ApartmentDto[] = [
  { id: 1, name: '101', owner: 'TBD', ...CONTRACT_FIELDS },
  { id: 2, name: '201', owner: 'Bryan', ...CONTRACT_FIELDS },
  { id: 3, name: '202', owner: 'Yesenia', ...CONTRACT_FIELDS },
  { id: 4, name: '301', owner: 'Oscar', ...CONTRACT_FIELDS },
  { id: 5, name: '302', owner: 'Olga', ...CONTRACT_FIELDS },
  { id: 6, name: '401', owner: 'Daniel', ...CONTRACT_FIELDS },
];

const MOCK_UTILITIES = [{ id: 1, name: 'Agua' }, { id: 2, name: 'Luz' }, { id: 3, name: 'Gas' }];

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const CURRENT_YEAR = String(new Date().getFullYear());
const MOCK_DATES = MONTH_NAMES.map((month, i) => ({ id: i + 1, month, year: CURRENT_YEAR }));

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
    // calling getRows$ - these three fire once each (cached across all 18
    // combos). Utilities/Dates are flushed fully seeded so no lookup ever
    // misses and tries to POST-create mid-render. For Admin, the receipt
    // card's constructor-time lookup (loadExistingReceiptTotal) shares
    // those same two caches, then queries Invoices once they resolve.
    httpMock.expectOne(`${environment.apiUrl}/Utilities`).flush(MOCK_UTILITIES);
    httpMock.expectOne(`${environment.apiUrl}/Dates`).flush(MOCK_DATES);
    if (!isApartmentOwner) {
      httpMock.expectOne(`${environment.apiUrl}/Invoices`).flush(invoices);
    }
    httpMock.expectOne(`${environment.apiUrl}/CounterUtilities`).flush(counterUtilities);
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

  it('getRows$ should return 12 months for a given apartment/service, cached across repeated calls', () => {
    let rows: unknown[] | undefined;
    component.getRows$({ id: 1, number: '101', owner: 'TBD', ...CONTRACT_FIELDS }, 'Agua').subscribe((r) => (rows = r));

    // Already resolved during beforeEach's render pass - shareReplay(1)
    // replays it synchronously, no further HTTP calls expected here.
    expect(rows?.length).toBe(12);
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
        data: { apartmentId: apartment.id, apartment: apartment.number, owner: apartment.owner, service: 'Gas', month: 5, counter: '1520' },
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

  it('hides the add-reading buttons for an ApartmentOwner', async () => {
    TestBed.resetTestingModule();
    await setup(true);

    expect(component.isReadOnly).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('Agregar Lectura');
  });

  it('shows the receipt card for an Admin', () => {
    expect(fixture.nativeElement.textContent).toContain('Recibo del servicio');
  });

  it('hides the receipt card for an ApartmentOwner', async () => {
    TestBed.resetTestingModule();
    await setup(true);

    expect(fixture.nativeElement.textContent).not.toContain('Recibo del servicio');
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

    component.selectedReceiptService = 'Luz';
    component.onReceiptPeriodChanged();

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

    component.selectedReceiptService = 'Luz';
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
});
