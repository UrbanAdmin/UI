import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { HomeComponent } from './home.component';
import { environment } from '../../environments/environment';
import { MONTH_NAMES } from '../notifications/month-names';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    // getActiveNotifications() always resolves Deadlines (the shared-deadline
    // services) and Apartments (to check for any Arriendo contract dates) in
    // parallel; with no contracts set, the Arriendo pass stops there and
    // never fans out to Utilities/Dates/PaymentStatuses.
    httpMock.expectOne(`${environment.apiUrl}/Deadlines`).flush([]);
    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush([]);
    fixture.detectChanges();

    // currentMonthByService ("Cartera del mes"/"Tus conceptos del mes") fans
    // out to getOwnerPayments() for all 4 tracked services - Utilities/Dates/
    // PaymentStatuses each resolve once (shareReplay-cached across all 4
    // calls); Deadlines/Apartments reuse the empty responses already flushed
    // above via the same caches. All 4 services are pre-seeded so
    // getOrCreateUtility/getOrCreateDate find an existing row instead of
    // falling back to a POST-create round trip this setup doesn't mock.
    const now = new Date();
    httpMock
      .expectOne(`${environment.apiUrl}/Utilities`)
      .flush([{ id: 1, name: 'Agua' }, { id: 2, name: 'Luz' }, { id: 3, name: 'Gas' }, { id: 4, name: 'Arriendo' }]);
    httpMock
      .expectOne(`${environment.apiUrl}/Dates`)
      .flush([{ id: 1, month: MONTH_NAMES[now.getMonth()], year: String(now.getFullYear()) }]);
    httpMock.expectOne(`${environment.apiUrl}/PaymentStatuses`).flush([]);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose the count of active notifications', () => {
    expect(component.pendingNotificationsCount()).toBe(0);
  });

  it('should render 3 quick-access cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('[data-testid="quick-access-card"]');
    expect(cards.length).toBe(3);
  });
});
