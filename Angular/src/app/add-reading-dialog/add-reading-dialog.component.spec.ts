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
