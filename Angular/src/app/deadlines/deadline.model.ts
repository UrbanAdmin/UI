import { ServiceName } from '../shared/service-name';

/** A single deadline shared by every apartment for one service in one month/year. */
export interface ServiceDeadline {
  service: ServiceName;
  month: number; // 1-12
  year: number;
  dueDate: Date;
}

export interface DeadlineDto {
  id: number;
  utilityId: number;
  dateId: number;
  dueDate: string; // ISO 8601, e.g. "2026-09-15T00:00:00"
}

/** See CounterUtilityWrite (readings/counter-utility.model.ts) for why these keys carry underscores. */
export interface DeadlineWrite {
  Utility_Id: number;
  Date_Id: number;
  DueDate: string;
}
