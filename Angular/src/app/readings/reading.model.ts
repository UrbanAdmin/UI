import { ServiceName } from '../notifications/notification.model';

export interface MeterReading {
  apartment: string;
  owner: string;
  service: ServiceName;
  month: number; // 1-12
  year: number;
  counterValue: number | null;
  evidenceFileName: string | null;
}
