import { ServiceName } from '../shared/service-name';

export type NotificationStatus = 'paid' | 'due-soon' | 'due-today' | 'overdue' | 'not-due';

export interface ServicePayment {
  apartmentId: number;
  apartment: string;
  owner: string;
  service: ServiceName;
  dueDate: Date;
  paid: boolean;
  /** Optional: getNotificationStatus() (status derivation) doesn't need it, but
   *  getActiveNotifications() populates it so dashboard-style totals (Inicio's
   *  hero card) can sum real amounts instead of just counting rows. */
  amount?: string | null;
  /** Set only for a charge whose service has an active billing cycle (Agua
   *  today) - labels which two calendar months the charge covers (FR-009). */
  periodLabel?: string;
}
