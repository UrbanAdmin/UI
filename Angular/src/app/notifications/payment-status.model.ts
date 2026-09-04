export interface PaymentStatusDto {
  id: number;
  apartmentId: number;
  utilityId: number;
  dateId: number;
  paid: boolean;
}

/** See CounterUtilityWrite (readings/counter-utility.model.ts) for why these keys carry underscores. */
export interface PaymentStatusWrite {
  Apartment_Id: number;
  Utility_Id: number;
  Date_Id: number;
  Paid: boolean;
}
