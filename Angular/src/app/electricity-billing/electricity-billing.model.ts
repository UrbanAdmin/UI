export type ElectricityValidationError = 'MissingReading' | 'ReadingBelowPrevious';

export interface ElectricityMeterReadingDto {
  id: number;
  apartmentId: number | null; // null = Zona Común
  label: string;
  status: 'Arrendado' | 'No arrendado' | null; // null for Zona Común
  previousReading: string | null;
  currentReading: string | null;
  consumption: string | null;
  consumptionPercentage: string | null;
  allocatedElectricityCost: string | null;
  aseoShare: string | null;
  nonRentedCostShare: string | null;
  commonAreaCostShare: string | null;
  finalAmount: string | null;
  validationError: ElectricityValidationError | null;
  photoFileName: string | null;
}

export interface ElectricityCommentDto {
  id: number;
  electricityMeterReadingId: number | null;
  text: string;
  createdAt: string;
}

export interface ElectricityBillDto {
  id: number;
  dateId: number;
  totalConsumptionKwh: string | null;
  electricityConsumptionValue: string | null;
  aseoValue: string | null;
  totalAmount: string | null;
  nonRentedElectricityCost: string | null;
  commonAreaElectricityCost: string | null;
  percentagePasses: boolean;
  percentageDifference: string | null;
  meterVsBillPasses: boolean;
  meterVsBillDifference: string | null;
  allocationPasses: boolean;
  allocationDifference: string | null;
  finalPasses: boolean;
  finalDifference: string | null;
  confirmed: boolean;
  confirmedAt: string | null;
  readings: ElectricityMeterReadingDto[];
  comments: ElectricityCommentDto[];
}

export interface ElectricityBillSummaryDto {
  dateId: number;
  month: string;
  year: string;
  confirmed: boolean;
}

export interface ElectricityBillWrite {
  totalConsumptionKwh?: string | null;
  electricityConsumptionValue?: string | null;
  aseoValue?: string | null;
}

export interface ElectricityMeterReadingWrite {
  previousReading?: string | null;
  currentReading?: string | null;
}

export interface ConfirmElectricityBillResult {
  success: boolean;
  blockedMeterLabels: string[];
  hasZeroArrendadoError: boolean;
}
