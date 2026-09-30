import { ServiceName } from '../shared/service-name';

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
  /** Admin-only "cantidad a pagar" for this apartment/period - only used by
   *  the Arriendo view today. */
  amount: string | null;
  /** Set only for a service with an active billing cycle (Agua today) -
   *  labels which two calendar months this row covers (FR-009). */
  periodLabel?: string;
}

export interface PaymentStatusDto {
  id: number;
  apartmentId: number;
  utilityId: number;
  dateId: number;
  paid: boolean;
  amount: string | null;
}

/** See CounterUtilityWrite (readings/counter-utility.model.ts) for why these keys carry underscores. */
export interface PaymentStatusWrite {
  Apartment_Id: number;
  Utility_Id: number;
  Date_Id: number;
  Paid: boolean;
  Amount: string | null;
}
