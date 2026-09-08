import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { NotificationStatus } from '../../notifications/notification.model';

interface StatusVisual {
  icon: string;
  label: string;
}

// Canonical icon + label per status - the single source every screen renders a
// NotificationStatus chip from, instead of each screen defining (and drifting
// from) its own label text. Labels match payments.component.ts's existing
// statusLabel(), which already covers every status correctly.
const STATUS_VISUALS: Record<NotificationStatus, StatusVisual> = {
  paid: { icon: 'check_circle', label: 'Pagado' },
  'due-soon': { icon: 'schedule', label: 'Vence en 2 días' },
  'due-today': { icon: 'warning', label: 'Vence hoy' },
  overdue: { icon: 'error', label: 'Vencido' },
  'not-due': { icon: 'radio_button_unchecked', label: 'No vence aún' },
};

@Component({
  selector: 'app-status-chip',
  standalone: true,
  imports: [MatChipsModule, MatIconModule],
  templateUrl: './status-chip.component.html',
  styleUrl: './status-chip.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusChipComponent {
  readonly status = input.required<NotificationStatus>();

  readonly visual = computed(() => STATUS_VISUALS[this.status()]);
}
