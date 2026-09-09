export type ApartmentStatus = 'Arrendado' | 'No arrendado';

export interface ApartmentDto {
  id: number;
  name: string;
  owner: string;
  contractStartDate: string | null;
  hasContract: boolean;
  contractFileName: string | null;
  status: ApartmentStatus;
}

export interface Apartment {
  id: number;
  number: string;
  owner: string;
  contractStartDate: string | null;
  hasContract: boolean;
  contractFileName: string | null;
  status: ApartmentStatus;
}
