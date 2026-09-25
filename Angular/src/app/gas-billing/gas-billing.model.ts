export type GasValidationError = 'MissingReading' | 'ReadingBelowPrevious';

export interface GasApartmentReadingDto {
  id: number;
  apartmentId: number;
  apartmentNumber: string;
  status: 'Arrendado' | 'No arrendado';
  isNewTenant: boolean;
  initialReading: string | null;
  previousReading: string | null;
  currentReading: string | null;
  consumption: string | null;
  consumptionPercentage: string | null;
  allocatedConsumption: string | null;
  variableCost: string | null;
  fixedChargeShare: string | null;
  finalTotal: string | null;
  validationError: GasValidationError | null;
  photoFileName: string | null;
}

export interface GasCommentDto {
  id: number;
  gasApartmentReadingId: number | null;
  text: string;
  createdAt: string;
}

export interface GasBillDto {
  id: number;
  dateId: number;
  totalConsumption: string | null;
  unitPrice: string | null;
  consumoGasSubtotal: string | null;
  fixedCharge: string | null;
  otherConcepts: string | null;
  ajusteDecena: string | null;
  totalAmount: string | null;
  administrationAmount: string | null;
  percentagePasses: boolean;
  percentageDifference: string | null;
  totalPasses: boolean;
  totalDifference: string | null;
  confirmed: boolean;
  confirmedAt: string | null;
  readings: GasApartmentReadingDto[];
  comments: GasCommentDto[];
}

export interface GasBillSummaryDto {
  dateId: number;
  month: string;
  year: string;
  confirmed: boolean;
}

export interface GasBillWrite {
  totalConsumption?: string | null;
  unitPrice?: string | null;
  consumoGasSubtotal?: string | null;
  fixedCharge?: string | null;
  otherConcepts?: string | null;
  ajusteDecena?: string | null;
  totalAmount?: string | null;
}

export interface GasApartmentReadingWrite {
  isNewTenant: boolean;
  initialReading?: string | null;
  currentReading?: string | null;
}

export interface ConfirmGasBillResult {
  success: boolean;
  blockedApartmentNumbers: string[];
}
