import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { AuthService } from './auth.service';
import { environment } from '../environments/environment';

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
});
