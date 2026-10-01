export type TenantStatementState = 'ready' | 'pending-receipt' | 'empty';

/** One line of the summary panel's breakdown - a real API field relabeled,
 *  never a value summed or derived in the UI (FR-005). */
export interface TenantStatementBreakdownLine {
  label: string;
  /** Raw invariant decimal money string - the component formats it via copCurrency. */
  value: string;
}

export interface TenantStatement {
  state: TenantStatementState;
  periodLabel: string;
  apartmentLine: string;
  unit: 'm³' | 'kWh';
  /** Only used when state === 'empty'. */
  emptyMessage?: string;
  /** Raw invariant decimals - the component formats them via esNumber. */
  previousReading?: string;
  currentReading?: string;
  consumption?: string;
  /** Raw invariant fraction (0-1) - the component formats it via esNumber 'percent'. */
  percentage?: string;
  /** Only present for 'ready'. */
  breakdown?: TenantStatementBreakdownLine[];
  /** Raw invariant decimal money - only present for 'ready'. */
  total?: string;
}
