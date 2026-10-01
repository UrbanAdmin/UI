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

// 025-arriendo-amount-preload follow-up: "Cartera del mes" was listing every
// tracked service for every apartment, including Agua/Luz/Arriendo rows with
// nothing actually billed yet (no Deadline configured, no contract start
// date) - shown as "No vence aún" / "—" noise. Only a row with a real due
// date (hasRealDueDate) belongs in a receivables ledger.
describe('HomeComponent - carteraDelMes only shows real charges', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });

    fixture = TestBed.createComponent(HomeComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    const now = new Date();

    // Wave 1: ActiveNotificationsService's own calls - Deadlines now carries
    // one real Gas deadline (so it no longer short-circuits), Apartments has
    // one apartment with no contract start date (so the Arriendo pass still
    // short-circuits, same as the empty-everything suite above).
    httpMock
      .expectOne(`${environment.apiUrl}/Deadlines`)
      .flush([{ id: 1, utilityId: 3, dateId: 1, dueDate: '2026-01-15T00:00:00' }]);
    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush([{ id: 1, name: '101', owner: 'TBD' }]);
    fixture.detectChanges();

    // Wave 2: currentMonthByService's fan-out - Utilities/Dates/PaymentStatuses
    // each resolve once (shareReplay-cached across all 4 getOwnerPayments calls
    // and ActiveNotificationsService's own Gas lookup).
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

  it('includes only the service with a real deadline, excluding Agua/Luz (no Deadline) and Arriendo (no contract)', () => {
    const rows = fixture.componentInstance.carteraDelMes();
    expect(rows.map((r) => r.service)).toEqual(['Gas']);
  });
});
