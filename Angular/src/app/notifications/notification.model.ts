export type ServiceName = 'Agua' | 'Luz' | 'Gas' | 'Arriendo';

export type NotificationStatus = 'paid' | 'due-soon' | 'due-today' | 'overdue' | 'not-due';

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

export interface ServicePayment {
  apartmentId: number;
  apartment: string;
  owner: string;
  service: ServiceName;
  dueDate: Date;
  paid: boolean;
  /** Optional: getNotificationStatus() (status derivation) doesn't need it, but
   *  getActiveNotifications() populates it so dashboard-style totals (Inicio's
   *  hero card) can sum real amounts instead of just counting rows. */
  amount?: string | null;
  /** Set only for a charge whose service has an active billing cycle (Agua
   *  today) - labels which two calendar months the charge covers (FR-009). */
  periodLabel?: string;
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
  /** Admin-only "cantidad a pagar" for this apartment/period - only used by
   *  the Arriendo view today. */
  amount: string | null;
  /** Set only for a service with an active billing cycle (Agua today) -
   *  labels which two calendar months this row covers (FR-009). */
  periodLabel?: string;
}
