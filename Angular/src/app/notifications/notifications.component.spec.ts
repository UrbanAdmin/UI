import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { NotificationsComponent } from './notifications.component';
import { environment } from '../../environments/environment';

const UTILITIES_URL = `${environment.apiUrl}/Utilities`;
const DATES_URL = `${environment.apiUrl}/Dates`;
const APARTMENTS_URL = `${environment.apiUrl}/Apartments`;
const DEADLINES_URL = `${environment.apiUrl}/Deadlines`;
const PAYMENT_STATUSES_URL = `${environment.apiUrl}/PaymentStatuses`;

const MOCK_APARTMENTS = [
  { id: 1, name: '101', owner: 'TBD' },
  { id: 2, name: '201', owner: 'Bryan' },
];

describe('NotificationsComponent', () => {
  let component: NotificationsComponent;
  let fixture: ComponentFixture<NotificationsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(DEADLINES_URL).flush([{ id: 1, utilityId: 1, dateId: 1, dueDate: '2026-01-15T00:00:00' }]);
    httpMock.expectOne(UTILITIES_URL).flush([{ id: 1, name: 'Agua' }]);
    httpMock.expectOne(DATES_URL).flush([{ id: 1, month: 'Enero', year: '2026' }]);
    httpMock.expectOne(APARTMENTS_URL).flush(MOCK_APARTMENTS);
    httpMock.expectOne(PAYMENT_STATUSES_URL).flush([]);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should group active notifications by apartment, one group per apartment', async () => {
    const groups = await new Promise<{ apartment: string }[]>((resolve) =>
      component.groups$.subscribe(resolve),
    );
    expect(groups.length).toBe(2);
    const apartments = groups.map((g) => g.apartment);
    expect(new Set(apartments).size).toBe(apartments.length);
  });

  it('should sub-group each apartment by month/year', async () => {
    const groups = await new Promise<{ periods: { month: number; year: number; items: { month: number; year: number }[] }[] }[]>(
      (resolve) => component.groups$.subscribe(resolve),
    );
    const groupWithPeriods = groups.find((g) => g.periods.length > 0);
    expect(groupWithPeriods).toBeTruthy();
    for (const period of groupWithPeriods!.periods) {
      expect(period.items.every((i) => i.month === period.month && i.year === period.year)).toBe(true);
    }
  });

  it('should render exactly one row per active notification across all groups', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="notification-row"]');
    expect(rows.length).toBe(2);
  });
});
