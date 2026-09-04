import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { NotificationsService } from './notifications.service';
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

describe('NotificationsService', () => {
  let service: NotificationsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NotificationsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getDeadline resolves utility/date ids and finds the matching Deadline row', () => {
    let result: { dueDate: Date } | undefined;
    service.getDeadline('Agua', 9, 2026).subscribe((d) => (result = d));

    httpMock.expectOne(UTILITIES_URL).flush([{ id: 1, name: 'Agua' }]);
    httpMock.expectOne(DATES_URL).flush([{ id: 5, month: 'Septiembre', year: '2026' }]);
    httpMock.expectOne(DEADLINES_URL).flush([{ id: 9, utilityId: 1, dateId: 5, dueDate: '2026-09-15T00:00:00' }]);

    expect(result?.dueDate.toDateString()).toBe(new Date('2026-09-15T00:00:00').toDateString());
  });

  it('setDeadline POSTs an underscore-keyed body with an ISO date when none exists yet', () => {
    const newDate = new Date('2026-09-20T00:00:00');
    service.setDeadline('Agua', 9, 2026, newDate).subscribe();

    httpMock.expectOne(UTILITIES_URL).flush([{ id: 1, name: 'Agua' }]);
    httpMock.expectOne(DATES_URL).flush([{ id: 5, month: 'Septiembre', year: '2026' }]);
    httpMock.expectOne(DEADLINES_URL).flush([]);

    const postReq = httpMock.expectOne(DEADLINES_URL);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ Utility_Id: 1, Date_Id: 5, DueDate: newDate.toISOString() });
    postReq.flush({ id: 0 });
  });

  it('getOwnerPayments returns one row per apartment, defaulting to unpaid/not-due with no deadline set', () => {
    let result: { paid: boolean; status: string }[] | undefined;
    service.getOwnerPayments('Gas', 6, 2026).subscribe((rows) => (result = rows));

    httpMock.expectOne(UTILITIES_URL).flush([{ id: 3, name: 'Gas' }]);
    httpMock.expectOne(DATES_URL).flush([{ id: 10, month: 'Junio', year: '2026' }]);
    httpMock.expectOne(APARTMENTS_URL).flush(MOCK_APARTMENTS);
    httpMock.expectOne(PAYMENT_STATUSES_URL).flush([]);
    httpMock.expectOne(DEADLINES_URL).flush([]);

    expect(result?.length).toBe(6);
    expect(result?.every((r) => r.paid === false)).toBe(true);
    expect(result?.every((r) => r.status === 'not-due')).toBe(true);
  });

  it('setPaid POSTs an underscore-keyed body when no PaymentStatus row exists yet', () => {
    service.setPaid(2, 'Luz', 9, 2026, true).subscribe();

    httpMock.expectOne(UTILITIES_URL).flush([{ id: 2, name: 'Luz' }]);
    httpMock.expectOne(DATES_URL).flush([{ id: 5, month: 'Septiembre', year: '2026' }]);
    httpMock.expectOne(PAYMENT_STATUSES_URL).flush([]);

    const postReq = httpMock.expectOne(PAYMENT_STATUSES_URL);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ Apartment_Id: 2, Utility_Id: 2, Date_Id: 5, Paid: true });
    postReq.flush({ id: 0 });
  });

  it('getOwnerPayments for Arriendo derives each row\'s own due date from its contract start date, skipping Deadlines', () => {
    const apartmentsWithContracts = [
      { id: 1, name: '101', owner: 'TBD', contractStartDate: '2026-01-10T00:00:00' },
      { id: 2, name: '201', owner: 'Bryan', contractStartDate: '2026-01-31T00:00:00' },
      { id: 3, name: '202', owner: 'Yesenia', contractStartDate: null },
    ];
    let result: { apartmentId: number; dueDate: Date }[] | undefined;

    service.getOwnerPayments('Arriendo', 2, 2026).subscribe((rows) => (result = rows));

    httpMock.expectOne(UTILITIES_URL).flush([{ id: 4, name: 'Arriendo' }]);
    httpMock.expectOne(DATES_URL).flush([{ id: 11, month: 'Febrero', year: '2026' }]);
    httpMock.expectOne(APARTMENTS_URL).flush(apartmentsWithContracts);
    httpMock.expectOne(PAYMENT_STATUSES_URL).flush([]);

    // Deadlines is never consulted for Arriendo - only Utilities/Dates/Apartments/PaymentStatuses fire.
    httpMock.expectNone(DEADLINES_URL);

    expect(result?.length).toBe(3);
    expect(result?.find((r) => r.apartmentId === 1)!.dueDate).toEqual(new Date(2026, 1, 10));
    // Contract day 31 clamped to February's 28 days (2026 is not a leap year).
    expect(result?.find((r) => r.apartmentId === 2)!.dueDate).toEqual(new Date(2026, 1, 28));
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
