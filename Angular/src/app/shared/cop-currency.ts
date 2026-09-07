/** Colombian peso formatting: "$ 437.590" - no decimals (COP has no cents
 *  in everyday use), "." as the thousands separator. */
export function formatCop(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return '';
  }

  // Intl inserts a non-breaking space (U+00A0) between "$" and the amount -
  // normalized to a plain space so the displayed text is predictable and
  // trivially comparable (tests, copy/paste) instead of looking identical
  // to a regular space while silently not being one.
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  })
    .format(numeric)
    .replace(/ /g, ' ');
}

/** Strips everything but digits, so a formatted "$ 437.590" (or whatever a
 *  user is mid-typing) becomes the plain "437590" the backend expects. */
export function parseCop(formatted: string): string {
  return formatted.replace(/\D/g, '');
}
