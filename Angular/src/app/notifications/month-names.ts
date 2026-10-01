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

/** Renders an ISO date (date-only or a full timestamp) in Spanish words, e.g. "10 de
 *  septiembre de 2026". Reads the year/month/day digits directly instead of going through
 *  `new Date(...)`, which parses a date-only string as UTC midnight and would render a day
 *  earlier than intended in any timezone behind UTC (Colombia is UTC-5). */
export function formatDateInWords(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const [, year, month, day] = match;
  return `${Number(day)} de ${monthName(Number(month)).toLowerCase()} de ${year}`;
}
