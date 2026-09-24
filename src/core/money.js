/**
 * Money is compared in whole kopecks to avoid floating point drift.
 *
 * @param {number} uah
 * @returns {number}
 */
export function toKopecks(uah) {
  return Math.round(uah * 100);
}

/**
 * Strict price text: "92.90", "97.9", "104", "92,90". Anything else is not guessed at.
 *
 * @param {unknown} text
 * @returns {number | null}
 */
export function parseUah(text) {
  if (typeof text !== 'string') return null;
  const match = /^\s*(\d{1,4})(?:[.,](\d{1,2}))?\s*$/.exec(text);
  return match ? Number(`${match[1]}.${match[2] ?? '0'}`) : null;
}
