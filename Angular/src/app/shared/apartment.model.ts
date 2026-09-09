export type ApartmentStatus = 'Arrendado' | 'En arriendo';

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
