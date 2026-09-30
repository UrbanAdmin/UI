// 022-bimonthly-agua-billing: one billing period computed by the Backend's
// GetUtilityBillingPeriodsQuery (the single source of the pairing rule -
// research.md Decision 3). secondMonth/secondYear are null for a plain
// calendar-month period (a utility with no UtilityBillingCycle - every
// service but Agua today).
export interface BillingPeriod {
  anchorMonth: number;
  anchorYear: number;
  secondMonth: number | null;
  secondYear: number | null;
  label: string;
}

// The building's configured cycle-start for a utility (Agua today) - GET
// .../BillingCycle returns this, or 204/null when the utility is still on
// the default one-month cycle (contracts/billing-cycle-api.md).
export interface BillingCycleDto {
  utilityId: number;
  periodLengthMonths: number;
  startMonth: number;
  effectiveFromMonth: number;
  effectiveFromYear: number;
  // 1-31, optional (Clarifications, 2026-09-28): the real bill's cutoff day,
  // reference-only - never affects which calendar month a reading/invoice
  // belongs to.
  cutoffDay?: number | null;
}

// The real POST body the Backend route binds to (Program.cs deserializes it
// directly as a UtilityBillingCycle entity) - it takes an already-resolved
// Date_Id, not a raw month/year pair, mirroring the find-or-create-against-
// /Dates pattern already used for Deadlines/PaymentStatuses. This diverges
// from billing-cycle-api.md's originally-documented effectiveFromMonth/Year
// shape - the doc was wrong, not the code (Constitution X).
export interface BillingCycleWrite {
  periodLengthMonths: number;
  startMonth: number;
  effectiveFromDateId: number;
  cutoffDay?: number | null;
}
