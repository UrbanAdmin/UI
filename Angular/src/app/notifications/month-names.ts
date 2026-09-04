export const MONTH_NAMES: string[] = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** month is 1-based (1 = Enero, 12 = Diciembre). */
export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? '';
}

/** Reverse of monthName - returns the 1-based month number, or null if unrecognized. */
export function monthNumber(name: string): number | null {
  const index = MONTH_NAMES.indexOf(name);
  return index === -1 ? null : index + 1;
}
