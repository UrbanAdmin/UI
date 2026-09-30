import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { ReceiptCardComponent } from './receipt-card.component';
import { ReadingsService } from '../../readings/readings.service';
import { environment } from '../../../environments/environment';

const MOCK_UTILITIES = [{ id: 1, name: 'Agua' }, { id: 2, name: 'Luz' }];

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const NOW = new Date();
const CURRENT_MONTH = NOW.getMonth() + 1;
const CURRENT_YEAR = NOW.getFullYear();
const DATE_ID = 5;
const MOCK_DATES = [{ id: DATE_ID, month: MONTH_NAMES[CURRENT_MONTH - 1], year: String(CURRENT_YEAR) }];

describe('ReceiptCardComponent', () => {
  let component: ReceiptCardComponent;
  let fixture: ComponentFixture<ReceiptCardComponent>;
  let httpMock: HttpTestingController;

  async function setup(
    invoices: { id: number; totalCounter: string; total: string; dateId: number; utilityId: number }[] = [],
    counterUtilities: { id: number; apartmentId: number; utilityId: number; dateId: number; invoiceId: number; counter: string; difference: string; fee: string }[] = [],
    service: 'Agua' | 'Luz' = 'Agua',
    month = CURRENT_MONTH,
    year = CURRENT_YEAR,
  ) {
    await TestBed.configureTestingModule({
      imports: [ReceiptCardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ReceiptCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('service', service);
    fixture.componentRef.setInput('month', month);
    fixture.componentRef.setInput('year', year);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/Utilities`).flush(MOCK_UTILITIES);
    httpMock.expectOne(`${environment.apiUrl}/Dates`).flush(MOCK_DATES);
    httpMock.expectOne(`${environment.apiUrl}/Invoices`).flush(invoices);
    httpMock.expectOne(`${environment.apiUrl}/CounterUtilities`).flush(counterUtilities);
    fixture.detectChanges();
  }

  afterEach(() => {
    try {
      httpMock.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('should create', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  it('shows "Recibo de {service}" in the title', async () => {
    await setup([], [], 'Agua');
    expect(fixture.nativeElement.textContent).toContain('Recibo de Agua');
  });

  it('has no pre-filled total and no Consumo when no Invoice/reading exists yet for the period', async () => {
    await setup();
    expect(component.receiptTotal).toBeNull();
    expect(component.consumoTotal).toBeNull();
    expect(component.consumoTotalFormatted).toBe('Sin lecturas registradas');
  });

  it('pre-fills Total del recibo from an already-saved Invoice for the given Servicio/Mes/Año', async () => {
    await setup([{ id: 5, totalCounter: '', total: '437590', dateId: DATE_ID, utilityId: 1 }]);
    expect(component.receiptTotal).toBe('437590');
  });

  it('computes Consumo total as the sum of every apartment\'s Difference for the given Servicio/Mes/Año', async () => {
    await setup([], [
      { id: 1, apartmentId: 1, utilityId: 1, dateId: DATE_ID, invoiceId: 5, counter: '1520', difference: '11829', fee: '437590' },
      { id: 2, apartmentId: 2, utilityId: 1, dateId: DATE_ID, invoiceId: 5, counter: '900', difference: '500', fee: '0' },
      { id: 3, apartmentId: 1, utilityId: 2, dateId: DATE_ID, invoiceId: 6, counter: '200', difference: '20', fee: '0' }, // different Servicio
    ]);

    expect(component.consumoTotal).toBe(12329);
    expect(component.consumoTotalFormatted).toContain('m³');
  });

  it('reloads Total del recibo and Consumo total when [service]/[month]/[year] change', async () => {
    await setup(
      [
        { id: 5, totalCounter: '', total: '437590', dateId: DATE_ID, utilityId: 1 }, // Agua
        { id: 8, totalCounter: '', total: '95000', dateId: DATE_ID, utilityId: 2 }, // Luz
      ],
      [
        { id: 1, apartmentId: 1, utilityId: 1, dateId: DATE_ID, invoiceId: 5, counter: '1520', difference: '11829', fee: '437590' },
        { id: 2, apartmentId: 1, utilityId: 2, dateId: DATE_ID, invoiceId: 8, counter: '200', difference: '20', fee: '95000' },
      ],
    );
    expect(component.receiptTotal).toBe('437590');
    expect(component.consumoTotal).toBe(11829);

    fixture.componentRef.setInput('service', 'Luz');
    fixture.detectChanges();

    expect(component.receiptTotal).toBe('95000');
    expect(component.consumoTotal).toBe(20);
  });

  it('reload() (called by a parent bridging a sibling ReadingTableComponent) picks up a newly-saved reading', async () => {
    await setup();
    expect(component.consumoTotal).toBeNull();

    // Simulates what a real save does: AddReadingDialogComponent's save flow
    // calls ReadingsService.recordReading(), which clears its own
    // CounterUtilities cache - reload() reproduces the resulting refetch
    // without needing the full dialog+save round trip.
    TestBed.inject(ReadingsService).clearCache();
    component.reload();

    httpMock
      .expectOne(`${environment.apiUrl}/CounterUtilities`)
      .flush([{ id: 1, apartmentId: 1, utilityId: 1, dateId: DATE_ID, invoiceId: 5, counter: '1520', difference: '11829', fee: '437590' }]);

    expect(component.consumoTotal).toBe(11829);
  });

  it('onReceiptFileSelected requests an OCR preview and pre-fills the receipt total', async () => {
    await setup();
    const file = new File(['x'], 'recibo.pdf', { type: 'application/pdf' });

    component.onReceiptFileSelected({ target: { files: [file] } } as unknown as Event);

    expect(component.receiptFile).toBe(file);
    httpMock.expectOne(`${environment.apiUrl}/Invoices/OcrPreview`).flush({ suggestedTotal: '95000' });

    expect(component.receiptTotal).toBe('95000');
  });

  it('onReceiptFileSelected shows a Spanish error message and leaves the total untouched when OCR fails', async () => {
    await setup();
    const file = new File(['x'], 'recibo.pdf', { type: 'application/pdf' });

    component.onReceiptFileSelected({ target: { files: [file] } } as unknown as Event);
    httpMock.expectOne(`${environment.apiUrl}/Invoices/OcrPreview`).flush(null, { status: 500, statusText: 'Server Error' });

    expect(component.receiptTotal).toBeNull();
    expect(component.receiptOcrError()).toContain('No se pudo leer el recibo automáticamente');
  });

  it('saveReceiptTotal sets the Invoice total then uploads the receipt when a file was chosen', async () => {
    await setup([{ id: 5, totalCounter: '', total: '', dateId: DATE_ID, utilityId: 1 }]);
    const file = new File(['x'], 'recibo.pdf', { type: 'application/pdf' });
    component.onReceiptFileSelected({ target: { files: [file] } } as unknown as Event);
    httpMock.expectOne(`${environment.apiUrl}/Invoices/OcrPreview`).flush({ suggestedTotal: '95000' });

    component.saveReceiptTotal();

    const putReq = httpMock.expectOne(`${environment.apiUrl}/Invoice/5`);
    expect(putReq.request.body).toEqual({ Total_counter: '', Total: '95000', Date_id: DATE_ID, Utility_id: 1 });
    putReq.flush({});

    const receiptReq = httpMock.expectOne(`${environment.apiUrl}/Invoice/5/Receipt`);
    expect(receiptReq.request.body instanceof FormData).toBe(true);
    receiptReq.flush(null);

    expect(component.receiptTotal).toBe('95000');
    expect(component.receiptFile).toBeNull();
  });

  it('saveReceiptTotal sets the Invoice total without uploading anything when no file was chosen', async () => {
    await setup([{ id: 5, totalCounter: '', total: '', dateId: DATE_ID, utilityId: 1 }]);
    component.receiptTotal = '95000';

    component.saveReceiptTotal();

    httpMock.expectOne(`${environment.apiUrl}/Invoice/5`).flush({});

    httpMock.expectNone(`${environment.apiUrl}/Invoice/5/Receipt`);
    expect(component.receiptTotal).toBe('95000');
  });

  it('saveReceiptTotal does nothing when no total has been entered', async () => {
    await setup();

    component.saveReceiptTotal();

    httpMock.expectNone(`${environment.apiUrl}/Invoice/5`);
  });
});
