import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { AddReadingDialogComponent } from './add-reading-dialog.component';
import { environment } from '../../environments/environment';

describe('AddReadingDialogComponent', () => {
  let component: AddReadingDialogComponent;
  let fixture: ComponentFixture<AddReadingDialogComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let httpMock: HttpTestingController;

  const dialogData = { apartmentId: 2, apartment: '201', owner: 'Bryan', service: 'Agua' as const };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AddReadingDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddReadingDialogComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the apartment, owner and service from dialog data', () => {
    expect(component.data.apartment).toBe('201');
    expect(component.data.owner).toBe('Bryan');
    expect(component.data.service).toBe('Agua');
  });

  it('defaults to the current month with a blank counter and is not in edit mode when adding', () => {
    expect(component.isEditing).toBe(false);
    expect(component.month).toBe(new Date().getMonth() + 1);
    expect(component.counter).toBeNull();
  });

  it('onFileSelected requests an OCR preview and pre-fills the counter with the suggestion', () => {
    const file = new File(['content'], 'medidor.png', { type: 'image/png' });

    component.onFileSelected({ target: { files: [file] } } as unknown as Event);

    expect(component.selectedFile).toBe(file);
    expect(component.ocrLoading).toBe(true);

    const req = httpMock.expectOne(`${environment.apiUrl}/CounterUtilities/OcrPreview`);
    req.flush({ suggestedCounter: '1523' });

    expect(component.counter).toBe('1523');
    expect(component.ocrLoading).toBe(false);
  });

  it('onFileSelected does not overwrite the counter when OCR finds no digits', () => {
    const file = new File(['content'], 'medidor.png', { type: 'image/png' });
    component.counter = '999';

    component.onFileSelected({ target: { files: [file] } } as unknown as Event);
    httpMock.expectOne(`${environment.apiUrl}/CounterUtilities/OcrPreview`).flush({ suggestedCounter: null });

    expect(component.counter).toBe('999');
  });

  it('save with only a counter (no photo) records the reading and closes, without uploading a photo', () => {
    component.month = 5;
    component.counter = '777';

    component.save();

    httpMock.expectOne(`${environment.apiUrl}/Utilities`).flush([{ id: 1, name: 'Agua' }]);
    httpMock.expectOne(`${environment.apiUrl}/Dates`).flush([{ id: 1, month: 'Mayo', year: String(new Date().getFullYear()) }]);
    httpMock.expectOne(`${environment.apiUrl}/Invoices`).flush([{ id: 5, totalCounter: '', total: '', dateId: 1, utilityId: 1 }]);
    httpMock.expectOne(`${environment.apiUrl}/CounterUtilities`).flush([]);
    httpMock.expectOne(`${environment.apiUrl}/CounterUtilities`).flush({ id: 0 });
    httpMock
      .expectOne(`${environment.apiUrl}/CounterUtilities`)
      .flush([{ id: 42, apartmentId: 2, utilityId: 1, dateId: 1, invoiceId: 5, counter: '777', difference: '0', fee: '0' }]);

    httpMock.expectNone(`${environment.apiUrl}/CounterUtility/42/Photo`);
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('save with a counter and a photo records the reading then uploads the photo before closing', () => {
    const file = new File(['content'], 'medidor.png', { type: 'image/png' });
    component.onFileSelected({ target: { files: [file] } } as unknown as Event);
    httpMock.expectOne(`${environment.apiUrl}/CounterUtilities/OcrPreview`).flush({ suggestedCounter: '1523' });
    component.month = 5;

    component.save();

    httpMock.expectOne(`${environment.apiUrl}/Utilities`).flush([{ id: 1, name: 'Agua' }]);
    httpMock.expectOne(`${environment.apiUrl}/Dates`).flush([{ id: 1, month: 'Mayo', year: String(new Date().getFullYear()) }]);
    httpMock.expectOne(`${environment.apiUrl}/Invoices`).flush([{ id: 5, totalCounter: '', total: '', dateId: 1, utilityId: 1 }]);
    httpMock.expectOne(`${environment.apiUrl}/CounterUtilities`).flush([]);
    httpMock.expectOne(`${environment.apiUrl}/CounterUtilities`).flush({ id: 0 });
    httpMock
      .expectOne(`${environment.apiUrl}/CounterUtilities`)
      .flush([{ id: 42, apartmentId: 2, utilityId: 1, dateId: 1, invoiceId: 5, counter: '1523', difference: '0', fee: '0' }]);

    const photoReq = httpMock.expectOne(`${environment.apiUrl}/CounterUtility/42/Photo`);
    expect(photoReq.request.body instanceof FormData).toBe(true);
    photoReq.flush(null);

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });
});

describe('AddReadingDialogComponent (editing an existing reading)', () => {
  let component: AddReadingDialogComponent;
  let fixture: ComponentFixture<AddReadingDialogComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let httpMock: HttpTestingController;

  const editData = { apartmentId: 2, apartment: '201', owner: 'Bryan', service: 'Agua' as const, month: 5, counter: '1520' };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AddReadingDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: editData },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddReadingDialogComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('pre-fills the month and counter from the existing reading, and flags edit mode', () => {
    expect(component.isEditing).toBe(true);
    expect(component.month).toBe(5);
    expect(component.counter).toBe('1520');
  });

  it('locks the month select so editing cannot accidentally target a different period', () => {
    const monthSelect: HTMLElement = fixture.nativeElement.querySelector('mat-select[name="month"]');
    expect(monthSelect.getAttribute('aria-disabled')).toBe('true');
  });

  it('save updates the same month it was opened with', () => {
    component.counter = '1600';

    component.save();

    httpMock.expectOne(`${environment.apiUrl}/Utilities`).flush([{ id: 1, name: 'Agua' }]);
    httpMock
      .expectOne(`${environment.apiUrl}/Dates`)
      .flush([{ id: 1, month: 'Mayo', year: String(new Date().getFullYear()) }]);
    httpMock.expectOne(`${environment.apiUrl}/Invoices`).flush([{ id: 5, totalCounter: '', total: '', dateId: 1, utilityId: 1 }]);
    const existing = [{ id: 42, apartmentId: 2, utilityId: 1, dateId: 1, invoiceId: 5, counter: '1520', difference: '15', fee: '12500' }];
    httpMock.expectOne(`${environment.apiUrl}/CounterUtilities`).flush(existing);

    const putReq = httpMock.expectOne(`${environment.apiUrl}/CounterUtility/42`);
    expect(putReq.request.body).toEqual({
      Apartment_Id: 2,
      Date_Id: 1,
      Utility_Id: 1,
      Invoice_Id: 5,
      Counter: '1600',
      Difference: '15',
      Fee: '12500',
    });
    putReq.flush({});

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });
});
