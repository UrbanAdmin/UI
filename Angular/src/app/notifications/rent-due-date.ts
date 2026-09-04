/**
 * Each apartment's rent is due on the same day-of-month as its contract
 * started, clamped to the target month's actual length (e.g. a contract
 * that started on the 31st is due on the 28th/29th in February). Returns a
 * far-future sentinel when there's no contract date yet, so
 * getNotificationStatus naturally resolves to 'not-due' without widening
 * its signature.
 */
export function rentDueDate(contractStartDate: Date | null, month: number, year: number): Date {
  if (!contractStartDate) {
    return new Date(9999, 11, 31);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const day = Math.min(contractStartDate.getDate(), daysInMonth);
  return new Date(year, month - 1, day);
}
