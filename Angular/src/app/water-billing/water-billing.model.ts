export type WaterValidationError = 'MissingReading' | 'ReadingBelowPrevious' | 'ReadingDateOutsidePeriod';

export interface WaterMeterReadingDto {
  id: number;
  apartmentId: number | null; // null = Zona Común
  label: string;
  status: 'Arrendado' | 'No arrendado' | null; // null for Zona Común
  previousReading: string | null;
  currentReading: string | null;
  readingDate: string | null;
  consumption: string | null;
  consumptionPercentage: string | null;
  aqueductValue: string | null;
  sewerValue: string | null;
  fixedChargeShare: string | null;
  nonRentedCostShare: string | null;
  commonAreaCostShare: string | null;
  finalAmount: string | null;
  validationError: WaterValidationError | null;
  photoFileName: string | null;
}

export interface WaterCommentDto {
  id: number;
  waterMeterReadingId: number | null;
  text: string;
  createdAt: string;
}

/** StartDate/EndDate are the period's real identity (FR-042) - there is no Dates link (FR-045, FR-048). */
export interface WaterBillDto {
  id: number;
  startDate: string;
  endDate: string;
  totalValue: string | null;
  totalM3: string | null;
  fixedAqueduct: string | null;
  fixedSewer: string | null;
  basicResidentialAqueduct: string | null;
  superiorResidentialAqueduct: string | null;
  basicResidentialSewer: string | null;
  superiorResidentialSewer: string | null;
  nonRentedWaterCost: string | null;
  commonAreaWaterCost: string | null;
  percentagePasses: boolean;
  percentageDifference: string | null;
  meterVsBillPasses: boolean;
  meterVsBillDifference: string | null;
  aqueductAllocationPasses: boolean;
  aqueductAllocationDifference: string | null;
  sewerAllocationPasses: boolean;
  sewerAllocationDifference: string | null;
  finalPasses: boolean;
  finalDifference: string | null;
  confirmed: boolean;
  confirmedAt: string | null;
  readings: WaterMeterReadingDto[];
  comments: WaterCommentDto[];
}

/** One row in the period list (FR-047). */
export interface WaterBillPeriodDto {
  id: number;
  startDate: string;
  endDate: string;
  confirmed: boolean;
}

/** Powers the period list. NextSuggestedStartDate is null when no period exists yet, or for an
 *  ApartmentOwner caller - owners never create a period (research.md §14). */
export interface WaterBillPeriodListDto {
  periods: WaterBillPeriodDto[];
  nextSuggestedStartDate: string | null;
}

export interface WaterBillWrite {
  totalValue?: string | null;
  totalM3?: string | null;
  fixedAqueduct?: string | null;
  fixedSewer?: string | null;
  basicResidentialAqueduct?: string | null;
  superiorResidentialAqueduct?: string | null;
  basicResidentialSewer?: string | null;
  superiorResidentialSewer?: string | null;
  /** FR-044: only accepted while the bill isn't confirmed yet; validated server-side against
   *  contiguity with this period's neighbors (FR-050). */
  startDate?: string | null;
  endDate?: string | null;
}

export interface WaterMeterReadingWrite {
  previousReading?: string | null;
  currentReading?: string | null;
  readingDate?: string | null;
}

export interface ConfirmWaterBillResult {
  success: boolean;
  blockedMeterLabels: string[];
  hasZeroArrendadoError: boolean;
}
