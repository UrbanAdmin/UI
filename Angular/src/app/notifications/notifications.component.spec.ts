import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationsComponent } from './notifications.component';

describe('NotificationsComponent', () => {
  let component: NotificationsComponent;
  let fixture: ComponentFixture<NotificationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should list only active (unpaid, due-soon/due-today/overdue) notifications', () => {
    expect(component.notifications.length).toBeGreaterThan(0);
    expect(component.notifications.every((n) => n.status !== 'paid' && n.status !== 'not-due')).toBe(true);
  });

  it('should render one row per active notification', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="notification-row"]');
    expect(rows.length).toBe(component.notifications.length);
  });
});
