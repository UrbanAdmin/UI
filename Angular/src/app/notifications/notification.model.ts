export type ServiceName = 'Agua' | 'Luz' | 'Gas' | 'Arriendo';

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
  /** This row's own due date - for Agua/Luz/Gas it repeats the shared
   *  deadline; for Arriendo it's derived per-apartment from the contract
   *  start date, so every row can have a different value. */
  dueDate: Date;
}
