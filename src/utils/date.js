/**
 * @param {Date} date
 * @param {string} timeZone
 * @returns {string} YYYY-MM-DD in the given time zone
 */
export function localDate(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
