export type ServiceName = 'Agua' | 'Luz' | 'Gas';

export type NotificationStatus = 'paid' | 'due-soon' | 'due-today' | 'overdue' | 'not-due';

export interface ServicePayment {
  apartment: string;
  owner: string;
  service: ServiceName;
  dueDate: Date;
  paid: boolean;
}