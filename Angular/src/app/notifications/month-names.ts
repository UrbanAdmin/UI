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
