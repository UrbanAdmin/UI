/** Shape returned by GET /CounterUtilities and GET /CounterUtilityById/{id} (camelCase DTO). */
export interface CounterUtilityDto {
  id: number;
  apartmentId: number;
  dateId: number;
  utilityId: number;
  invoiceId: number;
  counter: string;
  difference: string;
  fee: string;
}

/**
 * Shape expected by POST /CounterUtilities and PUT /CounterUtility/{id}.
 * The backend binds these endpoints directly to the C# entity (not the
 * DTO), and that entity's properties are named with underscores
 * (Apartment_Id, Date_Id, ...) - confirmed empirically against the live
 * API, since ASP.NET Core's case-insensitive JSON matching still requires
 * the underscore to be present (it ignores case, not structure).
 */
export interface CounterUtilityWrite {
  Apartment_Id: number;
  Date_Id: number;
  Utility_Id: number;
  Invoice_Id: number;
  Counter: string;
  Difference: string;
  Fee: string;
}
