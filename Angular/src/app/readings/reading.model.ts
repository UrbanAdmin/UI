export interface MeterReading {
  month: number; // 1-12, the period's anchor month for a bimonthly service (Agua)
  year: number;
  counter: string | null;
  evidenceFileName: string | null;
  fee: string | null;
  /** Set only when this row is a real multi-month billing period (Agua with
   *  an active cycle) - undefined for a plain calendar month (FR-004/FR-009). */
  periodLabel?: string;
}
