import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { UserDialogComponent, UserDialogData } from './user-dialog.component';
import { environment } from '../../environments/environment';

describe('UserDialogComponent', () => {
  let component: UserDialogComponent;
  let fixture: ComponentFixture<UserDialogComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let httpMock: HttpTestingController;

  const APARTMENTS_URL = `${environment.apiUrl}/Apartments`;
  const MOCK_APARTMENTS = [
    { id: 1, name: '101', owner: 'Eduardo', contractStartDate: null, hasContract: false, contractFileName: null },
  ];

  function setup(data: UserDialogData) {
    dialogRef = { close: vi.fn() };

    TestBed.configureTestingModule({
      imports: [UserDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });

    fixture = TestBed.createComponent(UserDialogComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne(APARTMENTS_URL).flush(MOCK_APARTMENTS);
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('starts blank in create mode', () => {
    setup({ user: null });

    expect(component.username).toBe('');
    expect(component.password).toBe('');
    expect(component.apartmentId).toBeNull();
    expect(component.isEdit).toBe(false);
  });

  it('pre-fills the form in edit mode, leaving the password blank', () => {
    setup({ user: { id: 2, username: 'owner101', role: 'ApartmentOwner', apartmentId: 1 } });

    expect(component.username).toBe('owner101');
    expect(component.role).toBe('ApartmentOwner');
    expect(component.apartmentId).toBe(1);
    expect(component.password).toBe('');
    expect(component.isEdit).toBe(true);
  });

  it('save POSTs a new user and closes the dialog', () => {
    setup({ user: null });
    component.username = 'owner101';
    component.password = 'Password1!';
    component.role = 'ApartmentOwner';
    component.apartmentId = 1;

    component.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/Users`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ Username: 'owner101', Password: 'Password1!', Role: 'ApartmentOwner', ApartmentId: 1 });
    req.flush({ success: true, userId: 2, error: null });

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('save PUTs an edited user with no password change when the password field is left blank', () => {
    setup({ user: { id: 2, username: 'owner101', role: 'ApartmentOwner', apartmentId: 1 } });
    component.apartmentId = 2;

    component.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/User/2`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ Role: 'ApartmentOwner', ApartmentId: 2, NewPassword: null });
    req.flush({ success: true, error: null });

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('save PUTs the new password when one is entered', () => {
    setup({ user: { id: 2, username: 'owner101', role: 'ApartmentOwner', apartmentId: 1 } });
    component.password = 'BrandNewPassword1!';

    component.save();

    const req = httpMock.expectOne(`${environment.apiUrl}/User/2`);
    expect(req.request.body).toEqual({ Role: 'ApartmentOwner', ApartmentId: 1, NewPassword: 'BrandNewPassword1!' });
    req.flush({ success: true, error: null });
  });

  it('shows an error and does not close the dialog when the backend rejects the request', () => {
    setup({ user: null });
    component.username = 'admin';
    component.password = 'Password1!';
    component.role = 'Admin';

    component.save();

    httpMock.expectOne(`${environment.apiUrl}/Users`).flush('Username is already taken', { status: 400, statusText: 'Bad Request' });

    expect(component.errorMessage).toBe('Username is already taken');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
