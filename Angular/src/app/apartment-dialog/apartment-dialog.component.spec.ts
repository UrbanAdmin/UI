import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { ApartmentDialogComponent, ApartmentDialogData } from './apartment-dialog.component';
import { environment } from '../../environments/environment';

describe('ApartmentDialogComponent', () => {
  let component: ApartmentDialogComponent;
  let fixture: ComponentFixture<ApartmentDialogComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let httpMock: HttpTestingController;

  function setup(data: ApartmentDialogData) {
    dialogRef = { close: vi.fn() };

    TestBed.configureTestingModule({
      imports: [ApartmentDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });

    fixture = TestBed.createComponent(ApartmentDialogComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('starts blank in create mode', () => {
    setup({ apartment: null });

    expect(component.number).toBe('');
    expect(component.owner).toBe('');
    expect(component.isEdit).toBe(false);
  });

  it('pre-fills the form in edit mode', () => {
    setup({ apartment: { id: 3, number: '301', owner: 'Oscar' } });

    expect(component.number).toBe('301');
    expect(component.owner).toBe('Oscar');
    expect(component.isEdit).toBe(true);
  });

  it('save POSTs a new apartment and closes the dialog', () => {
    setup({ apartment: null });
    component.number = '501';
    component.owner = 'Nueva';

    component.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/Apartments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ Name: '501', Owner: 'Nueva' });
    req.flush({ id: 0 });

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('save PUTs an edited apartment and closes the dialog', () => {
    setup({ apartment: { id: 3, number: '301', owner: 'Oscar' } });
    component.owner = 'Nuevo Dueño';

    component.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/Apartment/3`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ Name: '301', Owner: 'Nuevo Dueño' });
    req.flush({ id: 3, name: '301', owner: 'Nuevo Dueño' });

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });
});
