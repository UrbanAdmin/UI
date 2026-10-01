import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { HomeComponent } from './home.component';
import { AuthService } from '../auth.service';
import { CarteraDto } from '../cartera/cartera.service';
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

// 026 follow-up: "Cartera del mes" was only ever asking GET /admin/cartera... no wait, it was
// asking getOwnerPayments() for the CURRENT month only, so a Servicio or Arriendo charge left
// unpaid since an earlier month never showed up - only the current month's row did. It now reads
// GET /admin/cartera instead, which already scans every period with real data server-side.
describe('HomeComponent - admin Cartera del mes spans every period, not just the current month', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isAdmin: () => true } },
      ],
    });

    fixture = TestBed.createComponent(HomeComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    const now = new Date();

    // Wave 1: ActiveNotificationsService's own calls, plus whichever of Apartments/Users fire
    // eagerly alongside them - all empty/short-circuiting, since this suite only cares about
    // carteraData's own GET /admin/cartera, not the hero stats.
    httpMock.expectOne(`${environment.apiUrl}/Deadlines`).flush([]);
    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush([]);
    httpMock.expectOne(`${environment.apiUrl}/Users`).flush([]);
    fixture.detectChanges();

    // Wave 2: currentMonthByService's own fan-out (now owner-only, but still unconditional) -
    // Utilities/Dates/PaymentStatuses each resolve once, pre-seeded so nothing falls back to a
    // POST-create round trip this setup doesn't mock.
    httpMock
      .expectOne(`${environment.apiUrl}/Utilities`)
      .flush([{ id: 1, name: 'Agua' }, { id: 2, name: 'Luz' }, { id: 3, name: 'Gas' }, { id: 4, name: 'Arriendo' }]);
    httpMock
      .expectOne(`${environment.apiUrl}/Dates`)
      .flush([{ id: 1, month: MONTH_NAMES[now.getMonth()], year: String(now.getFullYear()) }]);
    httpMock.expectOne(`${environment.apiUrl}/PaymentStatuses`).flush([]);
    fixture.detectChanges();

    // Wave 3: carteraData's own GET /admin/cartera - two different months, proving the admin
    // ledger is no longer limited to the current one.
    const response: CarteraDto = {
      totalServicios: 50000,
      totalArriendo: 1600000,
      total: 1650000,
      chargeCount: 2,
      apartmentCount: 2,
      years: [
        {
          year: 2026,
          months: [
            {
              month: 10,
              year: 2026,
              charges: [],
              upcomingCharges: [
                {
                  apartmentId: 1, apartmentNumber: '201', owner: 'Bryan', service: 'Arriendo', isRent: true,
                  amount: 1600000, dueDate: '2026-10-01T00:00:00', daysOverdue: 0, recorded: true, daysUntilDue: 0,
                },
              ],
            },
            {
              month: 9,
              year: 2026,
              charges: [
                {
                  apartmentId: 2, apartmentNumber: '101', owner: 'TBD', service: 'Gas', isRent: false,
                  amount: 50000, dueDate: '2026-09-15T00:00:00', daysOverdue: 16, recorded: true, daysUntilDue: null,
                },
              ],
              upcomingCharges: [],
            },
          ],
        },
      ],
    };
    httpMock.expectOne(`${environment.apiUrl}/admin/cartera`).flush(response);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('includes a charge from a prior month, not just the current one', () => {
    const rows = fixture.componentInstance.carteraDelMes();
    expect(rows.map((r) => r.service).sort()).toEqual(['Arriendo', 'Gas']);
  });

  it('marks a genuinely overdue charge as overdue and an upcoming due-today charge as due-today', () => {
    const rows = fixture.componentInstance.carteraDelMes();
    expect(rows.find((r) => r.service === 'Gas')?.status).toBe('overdue');
    expect(rows.find((r) => r.service === 'Arriendo')?.status).toBe('due-today');
  });
});
