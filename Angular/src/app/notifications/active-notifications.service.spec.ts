import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { ActiveNotificationsService } from './active-notifications.service';
import { environment } from '../../environments/environment';
import { monthName } from './month-names';

const UTILITIES_URL = `${environment.apiUrl}/Utilities`;
const DATES_URL = `${environment.apiUrl}/Dates`;
const APARTMENTS_URL = `${environment.apiUrl}/Apartments`;
const DEADLINES_URL = `${environment.apiUrl}/Deadlines`;
const PAYMENT_STATUSES_URL = `${environment.apiUrl}/PaymentStatuses`;

const MOCK_APARTMENTS = [
  { id: 1, name: '101', owner: 'TBD' },
  { id: 2, name: '201', owner: 'Bryan' },
  { id: 3, name: '202', owner: 'Yesenia' },
  { id: 4, name: '301', owner: 'Oscar' },
  { id: 5, name: '302', owner: 'Olga' },
  { id: 6, name: '401', owner: 'Daniel' },
];

describe('ActiveNotificationsService', () => {
  let service: ActiveNotificationsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ActiveNotificationsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getActiveNotifications includes an overdue Arriendo row for the current month when unpaid', () => {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    // Contract due on the 1st: overdue for every "today" past the 1st of the month.
    const overdueContract = new Date(2020, 0, 1).toISOString();
    const apartmentsWithContract = [{ id: 1, name: '101', owner: 'TBD', contractStartDate: overdueContract }];
    let result: { service: string; status: string }[] | undefined;

    service.getActiveNotifications().subscribe((n) => (result = n));

    httpMock.expectOne(DEADLINES_URL).flush([]);
    httpMock.expectOne(APARTMENTS_URL).flush(apartmentsWithContract);
    httpMock.expectOne(UTILITIES_URL).flush([{ id: 4, name: 'Arriendo' }]);
    httpMock
      .expectOne(DATES_URL)
      .flush([{ id: 20, month: monthName(currentMonth), year: String(currentYear) }]);
    httpMock.expectOne(PAYMENT_STATUSES_URL).flush([]);

    expect(result?.some((n) => n.service === 'Arriendo' && n.status === 'overdue')).toBe(true);
  });

  it('getActiveNotifications resolves each Deadline back to a service/month/year and keeps only unpaid/due rows', () => {
    let result: { apartment: string; status: string; month: number; year: number }[] | undefined;
    service.getActiveNotifications().subscribe((n) => (result = n));

    httpMock
      .expectOne(DEADLINES_URL)
      .flush([{ id: 1, utilityId: 3, dateId: 10, dueDate: '2026-01-15T00:00:00' }]);
    httpMock.expectOne(UTILITIES_URL).flush([{ id: 3, name: 'Gas' }]);
    httpMock.expectOne(DATES_URL).flush([{ id: 10, month: 'Enero', year: '2026' }]);
    httpMock.expectOne(APARTMENTS_URL).flush(MOCK_APARTMENTS);
    httpMock.expectOne(PAYMENT_STATUSES_URL).flush([]);

    expect(result?.length).toBe(6);
    expect(result?.every((n) => n.status === 'overdue')).toBe(true);
    expect(result?.every((n) => n.month === 1 && n.year === 2026)).toBe(true);
  });
});
