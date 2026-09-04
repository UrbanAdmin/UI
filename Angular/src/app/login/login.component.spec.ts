import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { LoginComponent } from './login.component';
import { environment } from '../../environments/environment';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
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

  it('submits the entered credentials to AuthService.login', () => {
    component.username = 'admin';
    component.password = 'secret';

    component.onSubmit();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.body).toEqual({ username: 'admin', password: 'secret' });
    req.flush({ token: 'fake-token' });

    expect(component.errorMessage).toBe('');
  });

  it('shows an error message when the backend rejects the credentials', () => {
    component.username = 'admin';
    component.password = 'wrong';

    component.onSubmit();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(component.errorMessage).toBe('Invalid username or password');
  });

  it('is loading while the request is pending and stops once it succeeds', () => {
    component.username = 'admin';
    component.password = 'secret';

    component.onSubmit();
    expect(component.loading).toBe(true);

    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({ token: 'fake-token' });

    expect(component.loading).toBe(false);
  });

  it('stops loading even when the backend rejects the credentials', () => {
    component.username = 'admin';
    component.password = 'wrong';

    component.onSubmit();
    expect(component.loading).toBe(true);

    httpMock
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(component.loading).toBe(false);
  });

  it('disables the submit button and relabels it while logging in', async () => {
    component.username = 'admin';
    component.password = 'secret';
    fixture.detectChanges();
    // Template-driven forms register each NgModel with its NgForm via a
    // microtask (to avoid ExpressionChangedAfterItHasBeenCheckedError), so
    // loginForm.invalid isn't accurate until that microtask has flushed.
    await fixture.whenStable();
    fixture.detectChanges();

    component.onSubmit();
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Ingresando');

    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({ token: 'fake-token' });
    fixture.detectChanges();

    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain('Ingresar');
  });
});
