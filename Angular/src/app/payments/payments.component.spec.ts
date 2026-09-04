import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentsComponent } from './payments.component';
import { NotificationsService } from '../notifications/notifications.service';

describe('PaymentsComponent', () => {
  let component: PaymentsComponent;
  let fixture: ComponentFixture<PaymentsComponent>;
  let notificationsService: NotificationsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentsComponent);
    component = fixture.componentInstance;
    notificationsService = TestBed.inject(NotificationsService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to the current month/year and load rows for all apartments', () => {
    const now = new Date();
    expect(component.selectedMonth).toBe(now.getMonth() + 1);
    expect(component.selectedYear).toBe(now.getFullYear());
    expect(component.rows.length).toBe(6);
  });

  it('togglePaid should update the service and the displayed row', () => {
    const row = component.rows.find((r) => r.apartment === '101')!;
    const newPaidValue = !row.paid;

    component.togglePaid(row, newPaidValue);

    const updated = notificationsService.getOwnerPayments(
      component.selectedService,
      component.selectedMonth,
      component.selectedYear,
    );
    expect(updated.find((r) => r.apartment === '101')?.paid).toBe(newPaidValue);
    expect(component.rows.find((r) => r.apartment === '101')?.paid).toBe(newPaidValue);
  });

  it('saveDeadline should update the deadline used for the selected period', () => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 7);

    component.saveDeadline(newDate);

    const deadline = notificationsService.getDeadline(
      component.selectedService,
      component.selectedMonth,
      component.selectedYear,
    );
    expect(deadline?.dueDate.toDateString()).toBe(newDate.toDateString());
    expect(component.deadline?.toDateString()).toBe(newDate.toDateString());
  });
});
