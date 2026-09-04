import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationsComponent } from './notifications.component';
import { NotificationsService } from './notifications.service';

describe('NotificationsComponent', () => {
  let component: NotificationsComponent;
  let fixture: ComponentFixture<NotificationsComponent>;
  let notificationsService: NotificationsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsComponent);
    component = fixture.componentInstance;
    notificationsService = TestBed.inject(NotificationsService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should group active notifications by apartment', () => {
    expect(component.groups.length).toBeGreaterThan(0);
    const apartments = component.groups.map((g) => g.apartment);
    expect(new Set(apartments).size).toBe(apartments.length); // no duplicate apartment groups
  });

  it('should sub-group each apartment by month/year', () => {
    const groupWithPeriods = component.groups.find((g) => g.periods.length > 0);
    expect(groupWithPeriods).toBeTruthy();
    for (const period of groupWithPeriods!.periods) {
      expect(period.items.every((i) => i.month === period.month && i.year === period.year)).toBe(true);
    }
  });

  it('should render exactly one row per active notification across all groups', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="notification-row"]');
    const totalActive = notificationsService.getActiveNotifications().length;
    expect(rows.length).toBe(totalActive);
  });
});
