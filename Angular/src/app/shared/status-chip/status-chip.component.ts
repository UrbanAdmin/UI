import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { NotificationStatus } from '../../notifications/notification.model';

interface StatusVisual {
  label: string;
}

// Canonical label per status - the single source every screen renders a
// NotificationStatus chip from, instead of each screen defining (and drifting
// from) its own label text. Labels match payments.component.ts's existing
// statusLabel(), which already covers every status correctly.
const STATUS_VISUALS: Record<NotificationStatus, StatusVisual> = {
  paid: { label: 'Pagado' },
  'due-soon': { label: 'Vence en 2 días' },
  'due-today': { label: 'Vence hoy' },
  overdue: { label: 'Vencido' },
  'not-due': { label: 'No vence aún' },
};

@Component({
  selector: 'app-status-chip',
  standalone: true,
  imports: [MatChipsModule],
  templateUrl: './status-chip.component.html',
  styleUrl: './status-chip.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusChipComponent {
  readonly status = input.required<NotificationStatus>();

  readonly visual = computed(() => STATUS_VISUALS[this.status()]);
}
