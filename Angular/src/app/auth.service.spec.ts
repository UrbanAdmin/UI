import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should store the username passed to login and clear it on logout', () => {
    service.login('admin');
    expect(service.getUsername()).toBe('admin');

    service.logout();
    expect(service.getUsername()).toBeNull();
  });
});
