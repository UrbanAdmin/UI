export type ServiceName = 'Agua' | 'Luz' | 'Gas';

export type NotificationStatus = 'paid' | 'due-soon' | 'due-today' | 'overdue' | 'not-due';

export interface ServicePayment {
  apartmentId: number;
  apartment: string;
  owner: string;
  service: ServiceName;
  dueDate: Date;
  paid: boolean;
}

/** A single deadline shared by every apartment for one service in one month/year. */
export interface ServiceDeadline {
  service: ServiceName;
  month: number; // 1-12
  year: number;
  dueDate: Date;
}

/** One apartment's paid/unpaid status for a service in one month/year. */
export interface OwnerPayment {
  apartmentId: number;
  apartment: string;
  owner: string;
  service: ServiceName;
  month: number; // 1-12
  year: number;
  paid: boolean;
}
