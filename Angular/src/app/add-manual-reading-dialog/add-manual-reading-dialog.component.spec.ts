import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { AddManualReadingDialogComponent } from './add-manual-reading-dialog.component';
import { environment } from '../../environments/environment';

describe('AddManualReadingDialogComponent', () => {
  let component: AddManualReadingDialogComponent;
  let fixture: ComponentFixture<AddManualReadingDialogComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let httpMock: HttpTestingController;

  const dialogData = { apartmentId: 2, apartment: '201', owner: 'Bryan', service: 'Agua' as const };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AddManualReadingDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddManualReadingDialogComponent);
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

  it('should show the apartment and service from dialog data', () => {
    expect(component.data.apartment).toBe('201');
    expect(component.data.service).toBe('Agua');
  });

  it('save should record the reading and close the dialog once the API call completes', () => {
    component.month = 5;
    component.counter = '777';

    component.save();

    httpMock.expectOne(`${environment.apiUrl}/Utilities`).flush([{ id: 1, name: 'Agua' }]);
    httpMock.expectOne(`${environment.apiUrl}/Dates`).flush([{ id: 1, month: 'Mayo', year: String(new Date().getFullYear()) }]);
    httpMock.expectOne(`${environment.apiUrl}/Invoices`).flush([{ id: 5, totalCounter: '', total: '', dateId: 1, utilityId: 1 }]);
    httpMock.expectOne(`${environment.apiUrl}/CounterUtilities`).flush([]);
    httpMock.expectOne(`${environment.apiUrl}/CounterUtilities`).flush({ id: 0 });

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });
});
