import { toKopecks } from './money.js';

/** @import { Station, Snapshot, RejectedPrice } from '../types.js' */
/** @import { Config } from '../config.js' */

/**
 * Drops implausible prices: outside [priceMin, priceMax] or changed by more than
 * maxDailyChangePct against the previous snapshot. Wrong prices are worse than none.
 *
 * @param {Station[]} stations
 * @param {Snapshot | null} previous
 * @param {Config['validation']} limits
 * @returns {{ stations: Station[], rejected: RejectedPrice[] }}
 */
export function validate(stations, previous, { priceMin, priceMax, maxDailyChangePct }) {
  /** @type {RejectedPrice[]} */
  const rejected = [];

  const checked = stations.map((station) => {
    const previousPrices = previous?.stations.find(({ id }) => id === station.id)?.prices ?? {};
    /** @type {Record<string, number>} */
    const prices = {};

    for (const [code, price] of Object.entries(station.prices)) {
      const before = Object.hasOwn(previousPrices, code) ? previousPrices[code] : null;
      /** @param {string} reason */
      const reject = (reason) => rejected.push({ stationId: station.id, code, price, previous: before, reason });

      if (!Number.isFinite(price) || price < priceMin || price > priceMax) {
        reject(`outside ${priceMin}–${priceMax} UAH`);
        continue;
      }
      if (before !== null && before > 0) {
        const changePct = ((toKopecks(price) - toKopecks(before)) / toKopecks(before)) * 100;
        if (Math.abs(changePct) > maxDailyChangePct) {
          reject(`${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}% since previous ${before.toFixed(2)}`);
          continue;
        }
      }
      prices[code] = price;
    }
    return { ...station, prices };
  });

  return { stations: checked, rejected };
}
