import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { AuthService } from './auth.service';
import { environment } from '../environments/environment';

const ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

function fakeJwt(payload: Record<string, unknown>): string {
  const base64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}.fake-signature`;
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('stores the token and username on successful login', () => {
    let result: boolean | undefined;
    service.login('admin', 'password').subscribe((value) => (result = value));

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'admin', password: 'password' });
    req.flush({ token: 'fake-token' });

    expect(result).toBe(true);
    expect(service.isLoggedIn()).toBe(true);
    expect(service.getUsername()).toBe('admin');
    expect(service.getToken()).toBe('fake-token');
  });

  it('does not log the user in when the backend rejects the credentials', () => {
    let result: boolean | undefined;
    service.login('admin', 'wrong').subscribe((value) => (result = value));

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(result).toBe(false);
    expect(service.isLoggedIn()).toBe(false);
    expect(service.getUsername()).toBeNull();
  });

  it('clears the token and username on logout', () => {
    service.login('admin', 'password').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({ token: 'fake-token' });

    service.logout();

    expect(service.isLoggedIn()).toBe(false);
    expect(service.getUsername()).toBeNull();
  });

  it('isAdmin() is true when the JWT role claim is Admin', () => {
    const token = fakeJwt({ [ROLE_CLAIM]: 'Admin' });
    service.login('admin', 'password').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({ token });

    expect(service.isAdmin()).toBe(true);
  });

  it('isAdmin() is false for a non-admin role', () => {
    const token = fakeJwt({ [ROLE_CLAIM]: 'Owner' });
    service.login('owner', 'password').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({ token });

    expect(service.isAdmin()).toBe(false);
  });

  it('isAdmin() is false when the token cannot be decoded', () => {
    service.login('admin', 'password').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({ token: 'fake-token' });

    expect(service.isAdmin()).toBe(false);
  });

  it('isAdmin() is false after logout', () => {
    const token = fakeJwt({ [ROLE_CLAIM]: 'Admin' });
    service.login('admin', 'password').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({ token });

    service.logout();

    expect(service.isAdmin()).toBe(false);
  });

  it('isApartmentOwner() is true when the JWT role claim is ApartmentOwner', () => {
    const token = fakeJwt({ [ROLE_CLAIM]: 'ApartmentOwner', ApartmentId: '3' });
    service.login('owner101', 'password').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({ token });

    expect(service.isApartmentOwner()).toBe(true);
    expect(service.isAdmin()).toBe(false);
  });

  it('getOwnApartmentId() reads the ApartmentId claim as a number', () => {
    const token = fakeJwt({ [ROLE_CLAIM]: 'ApartmentOwner', ApartmentId: '3' });
    service.login('owner101', 'password').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({ token });

    expect(service.getOwnApartmentId()).toBe(3);
  });

  it('getOwnApartmentId() is null for an Admin token with no ApartmentId claim', () => {
    const token = fakeJwt({ [ROLE_CLAIM]: 'Admin' });
    service.login('admin', 'password').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({ token });

    expect(service.getOwnApartmentId()).toBeNull();
  });
});
