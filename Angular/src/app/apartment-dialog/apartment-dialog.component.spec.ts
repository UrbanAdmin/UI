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

  const CONTRACT_FIELDS = { contractStartDate: null, hasContract: false, contractFileName: null, status: 'Arrendado' as const };

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

  it('starts blank in create mode, defaulting Estado to Arrendado', () => {
    setup({ apartment: null });

    expect(component.number).toBe('');
    expect(component.owner).toBe('');
    expect(component.contractStartDate).toBeNull();
    expect(component.isEdit).toBe(false);
    expect(component.hasContract).toBe(false);
    expect(component.status).toBe('Arrendado');
    expect(component.ownerRequired).toBe(true);
  });

  it('pre-fills the form (incl. contract start date and status) in edit mode', () => {
    setup({
      apartment: {
        id: 3,
        number: '301',
        owner: 'Oscar',
        contractStartDate: '2026-03-10T00:00:00',
        hasContract: true,
        contractFileName: 'contrato.pdf',
        status: 'En arriendo',
      },
    });

    expect(component.number).toBe('301');
    expect(component.owner).toBe('Oscar');
    expect(component.contractStartDate).toEqual(new Date('2026-03-10T00:00:00'));
    expect(component.isEdit).toBe(true);
    expect(component.hasContract).toBe(true);
    expect(component.contractFileName).toBe('contrato.pdf');
    expect(component.status).toBe('En arriendo');
    expect(component.ownerRequired).toBe(false);
  });

  it('save button is disabled for a blank Owner while Estado is Arrendado', () => {
    setup({ apartment: null });
    component.number = '501';
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[mat-raised-button]');
    expect(button.disabled).toBe(true);
  });

  it('save button is enabled with a blank Owner once Estado is En arriendo', () => {
    setup({ apartment: null });
    component.number = '501';
    component.status = 'En arriendo';
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[mat-raised-button]');
    expect(button.disabled).toBe(false);
  });

  it('shows a "Sin arrendatario" placeholder on the Owner field while it is optional and blank', () => {
    setup({ apartment: null });
    component.status = 'En arriendo';
    fixture.detectChanges();

    const ownerInput: HTMLInputElement = fixture.nativeElement.querySelector('input[name="owner"]');
    expect(ownerInput.placeholder).toBe('Sin arrendatario');
  });

  it('shows no Owner placeholder while Estado is Arrendado (Owner is required)', () => {
    setup({ apartment: null });
    fixture.detectChanges();

    const ownerInput: HTMLInputElement = fixture.nativeElement.querySelector('input[name="owner"]');
    expect(ownerInput.placeholder).toBe('');
  });

  it('save POSTs a new apartment (incl. ContractStartDate) and closes the dialog', () => {
    setup({ apartment: null });
    component.number = '501';
    component.owner = 'Nueva';
    const contractStartDate = new Date('2026-04-01T00:00:00');
    component.contractStartDate = contractStartDate;

    component.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/Apartments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      Name: '501',
      Owner: 'Nueva',
      ContractStartDate: contractStartDate.toISOString(),
      Status: 'Arrendado',
    });
    req.flush({ id: 0 });

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('save PUTs an edited apartment (incl. ContractStartDate) and closes the dialog', () => {
    setup({ apartment: { id: 3, number: '301', owner: 'Oscar', ...CONTRACT_FIELDS } });
    component.owner = 'Nuevo Dueño';

    component.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/Apartment/3`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ Name: '301', Owner: 'Nuevo Dueño', ContractStartDate: null, Status: 'Arrendado' });
    req.flush({ id: 3, name: '301', owner: 'Nuevo Dueño', ...CONTRACT_FIELDS });

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('does not upload anything when no file was selected', () => {
    setup({ apartment: { id: 3, number: '301', owner: 'Oscar', ...CONTRACT_FIELDS } });

    component.save();

    httpMock.expectOne(`${environment.apiUrl}/Apartment/3`).flush({ id: 3, name: '301', owner: 'Oscar', ...CONTRACT_FIELDS });

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('uploads the selected file after updating an existing apartment', () => {
    setup({ apartment: { id: 3, number: '301', owner: 'Oscar', ...CONTRACT_FIELDS } });
    const file = new File(['contents'], 'contrato.pdf', { type: 'application/pdf' });
    component.onFileSelected({ target: { files: [file] } } as unknown as Event);

    component.save();

    httpMock.expectOne(`${environment.apiUrl}/Apartment/3`).flush({ id: 3, name: '301', owner: 'Oscar', ...CONTRACT_FIELDS });
    const uploadReq = httpMock.expectOne(`${environment.apiUrl}/Apartments/3/Contract`);
    expect(uploadReq.request.method).toBe('POST');
    expect(uploadReq.request.body instanceof FormData).toBe(true);
    uploadReq.flush(null);

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('uploads the selected file by matching the newly created apartment by natural key', () => {
    setup({ apartment: null });
    component.number = '501';
    component.owner = 'Nueva';
    const file = new File(['contents'], 'contrato.pdf', { type: 'application/pdf' });
    component.onFileSelected({ target: { files: [file] } } as unknown as Event);

    component.save();

    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush({ id: 0 });
    httpMock
      .expectOne(`${environment.apiUrl}/Apartments`)
      .flush([{ id: 9, name: '501', owner: 'Nueva', ...CONTRACT_FIELDS }]);
    const uploadReq = httpMock.expectOne(`${environment.apiUrl}/Apartments/9/Contract`);
    uploadReq.flush(null);

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('save surfaces the backend error instead of failing silently', () => {
    setup({ apartment: { id: 3, number: '301', owner: 'Oscar', ...CONTRACT_FIELDS } });

    component.save();

    httpMock
      .expectOne(`${environment.apiUrl}/Apartment/3`)
      .flush('El número de apartamento ya existe', { status: 400, statusText: 'Bad Request' });

    expect(component.saveError()).toBe('El número de apartamento ya existe');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('viewContract downloads the contract and opens it in a new tab', () => {
    setup({
      apartment: {
        id: 3,
        number: '301',
        owner: 'Oscar',
        contractStartDate: null,
        hasContract: true,
        contractFileName: 'contrato.pdf',
        status: 'Arrendado',
      },
    });
    const objectUrl = 'blob:fake-url';
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(objectUrl);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    component.viewContract();

    const req = httpMock.expectOne(`${environment.apiUrl}/Apartments/3/Contract`);
    req.flush(new Blob(['contents'], { type: 'application/pdf' }));

    expect(openSpy).toHaveBeenCalledWith(objectUrl, '_blank');
  });
});
