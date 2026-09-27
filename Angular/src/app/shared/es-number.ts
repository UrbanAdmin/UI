/**
 * Colombian (es-CO) number convention: ',' is the decimal separator, '.' groups thousands - the
 * opposite of the invariant/US convention ('.' decimal, ',' thousands) this app's backend stores
 * and parses everything in (see GasBillCalculator, DifferenceCalculator). Money already has its
 * own equivalent pair (cop-currency.ts's formatCop/parseCop) for whole-peso amounts with no
 * decimals; this is the general-purpose counterpart for values that can have a fractional part
 * (meter readings, consumption, percentages).
 */

/** Converts free-form es-CO user input (e.g. "516,425" meaning 516.425, or "1.520" meaning 1520,
 *  or both together "12.516,425") into the plain invariant-decimal string the backend expects
 *  ("516.425", "1520", "12516.425"). A plain digit string with no separators passes through
 *  unchanged. */
export function parseEsDecimal(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\./g, '').replace(',', '.');
}

/** Renders a stored invariant-decimal string back in the es-CO convention a user expects to read
 *  (e.g. "516.425" -> "516,425", "12516.425" -> "12.516,425"). `maximumFractionDigits` trims a
 *  long, unrounded decimal down to a readable number of digits for DISPLAY only - the underlying
 *  stored value (e.g. an unrounded consumption percentage, FR-025) is never rounded by this. */
export function formatEsDecimal(value: string | number | null | undefined, maximumFractionDigits = 3): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits }).format(numeric);
}

/** Same idea, rendered as a percentage: multiplies by 100, appends "%", es-CO decimal comma - e.g.
 *  a stored "0.177777777777..." consumption percentage becomes "17,78%". */
export function formatEsPercentage(value: string | number | null | undefined, maximumFractionDigits = 2): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }
  return new Intl.NumberFormat('es-CO', { style: 'percent', maximumFractionDigits }).format(numeric);
}
