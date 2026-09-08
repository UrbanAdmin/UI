import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatusChipComponent } from './status-chip.component';
import { NotificationStatus } from '../../notifications/notification.model';

describe('StatusChipComponent', () => {
  let fixture: ComponentFixture<StatusChipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusChipComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusChipComponent);
  });

  const statuses: NotificationStatus[] = ['paid', 'due-soon', 'due-today', 'overdue', 'not-due'];

  for (const status of statuses) {
    it(`renders a non-empty icon and a non-empty label for "${status}" (not color alone)`, () => {
      fixture.componentRef.setInput('status', status);
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const icon = el.querySelector('mat-icon');
      const chip = el.querySelector('mat-chip');

      expect(icon?.textContent?.trim()).toBeTruthy();
      expect(chip?.textContent?.trim().length).toBeGreaterThan(0);
      expect(chip?.className).toContain(`status-${status}`);
    });
  }
});
