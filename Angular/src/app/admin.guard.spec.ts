import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router } from '@angular/router';

import { adminGuard } from './admin.guard';
import { AuthService } from './auth.service';

describe('adminGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => adminGuard(...guardParameters));

  let isAdmin: boolean;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    isAdmin = false;
    navigate = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAdmin: () => isAdmin } },
        { provide: Router, useValue: { navigate } },
      ],
    });
  });

  it('allows access when the current user is an admin', () => {
    isAdmin = true;

    expect(executeGuard({} as never, {} as never)).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('redirects to home and denies access when the current user is not an admin', () => {
    isAdmin = false;

    expect(executeGuard({} as never, {} as never)).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/']);
  });
});
