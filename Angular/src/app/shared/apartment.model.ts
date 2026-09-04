export interface ApartmentDto {
  id: number;
  name: string;
  owner: string;
  contractStartDate: string | null;
  hasContract: boolean;
  contractFileName: string | null;
}

export interface Apartment {
  id: number;
  number: string;
  owner: string;
  contractStartDate: string | null;
  hasContract: boolean;
  contractFileName: string | null;
}
