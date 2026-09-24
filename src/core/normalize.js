/** @import { SourceResult, Station } from '../types.js' */
/** @import { Logger } from '../utils/logger.js' */

/**
 * Stub until roadmap stage 2: raw names are used as fuel codes.
 *
 * @param {SourceResult[]} results
 * @param {Logger} _log
 * @returns {Station[]}
 */
export function normalize(results, _log) {
  return results.map(({ source, items }) => ({
    id: source.id,
    name: source.name,
    prices: Object.fromEntries(items.map((item) => [item.rawName, item.price])),
  }));
}
