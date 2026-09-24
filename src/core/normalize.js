import { FUEL_MAP } from './fuels.js';

/** @import { SourceResult, Station } from '../types.js' */
/** @import { Logger } from '../utils/logger.js' */

/**
 * Maps raw fuel names to codes. Unknown names are skipped with a warning so a new
 * product on a site never breaks the post.
 *
 * @param {SourceResult[]} results
 * @param {Logger} log
 * @returns {Station[]}
 */
export function normalize(results, log) {
  return results.map(({ source, items }) => {
    const map = FUEL_MAP[source.id] ?? {};
    /** @type {Record<string, number>} */
    const prices = {};
    for (const { rawName, price } of items) {
      if (!Object.hasOwn(map, rawName)) {
        log.warn(`${source.id}: unknown fuel "${rawName}" skipped, add it to FUEL_MAP in src/core/fuels.js`);
        continue;
      }
      const code = map[rawName];
      if (code === null) continue;
      if (Object.hasOwn(prices, code)) {
        log.warn(`${source.id}: "${rawName}" maps to ${code} again, keeping the first price`);
        continue;
      }
      prices[code] = price;
    }
    return { id: source.id, name: source.name, prices };
  });
}
