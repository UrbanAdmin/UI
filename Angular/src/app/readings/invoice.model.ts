export interface InvoiceDto {
  id: number;
  totalCounter: string;
  total: string;
  dateId: number;
  utilityId: number;
}

/** See CounterUtilityWrite for why these keys carry underscores. */
export interface InvoiceWrite {
  Total_counter: string;
  Total: string;
  Date_id: number;
  Utility_id: number;
}
