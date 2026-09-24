/**
 * Money is compared in whole kopecks to avoid floating point drift.
 *
 * @param {number} uah
 * @returns {number}
 */
export function toKopecks(uah) {
  return Math.round(uah * 100);
}
