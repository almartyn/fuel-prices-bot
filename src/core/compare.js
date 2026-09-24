import { FUEL_CODES } from './fuels.js';
import { toKopecks } from './money.js';

/** @import { Snapshot, Comparison, FuelDiff } from '../types.js' */

/** An "average" of a single station would just repeat its prices. */
export const MIN_STATIONS_FOR_AVERAGE = 2;

/**
 * Diffs today's prices against the last published snapshot (docs/storage-and-comparison.md).
 * `delta` is null when there is nothing to compare with.
 *
 * @param {Snapshot | null} previous
 * @param {Snapshot} current
 * @returns {Comparison}
 */
export function compare(previous, current) {
  /** @param {string} stationId @param {string} code */
  const previousPrice = (stationId, code) => {
    const prices = previous?.stations.find(({ id }) => id === stationId)?.prices;
    return prices && Object.hasOwn(prices, code) ? prices[code] : null;
  };

  const stations = current.stations.map((station) => ({
    id: station.id,
    name: station.name,
    fuels: Object.entries(station.prices).map(([code, price]) => diff(code, price, previousPrice(station.id, code))),
  }));

  const codes = [...new Set([...FUEL_CODES, ...current.stations.flatMap((station) => Object.keys(station.prices))])];
  const averages = [];
  for (const code of codes) {
    const today = current.stations.filter((station) => Object.hasOwn(station.prices, code));
    if (today.length < MIN_STATIONS_FOR_AVERAGE) continue;

    // Only stations priced on both days take part in the change, otherwise a station
    // that failed yesterday would move the average without any real price change.
    const both = today.flatMap((station) => {
      const before = previousPrice(station.id, code);
      return before === null ? [] : [{ now: toKopecks(station.prices[code]), before: toKopecks(before) }];
    });

    averages.push({
      code,
      price: mean(today.map((station) => toKopecks(station.prices[code]))) / 100,
      previous: both.length ? mean(both.map(({ before }) => before)) / 100 : null,
      delta: both.length ? mean(both.map(({ now, before }) => now - before)) / 100 : null,
      stationsCount: today.length,
    });
  }

  return { date: current.date, previousDate: previous?.date ?? null, stations, averages };
}

/**
 * @param {string} code
 * @param {number} price
 * @param {number | null} previous
 * @returns {FuelDiff}
 */
function diff(code, price, previous) {
  const delta = previous === null ? null : (toKopecks(price) - toKopecks(previous)) / 100;
  return { code, price, previous, delta };
}

/**
 * @param {number[]} kopecks
 * @returns {number} whole kopecks
 */
function mean(kopecks) {
  return Math.round(kopecks.reduce((sum, value) => sum + value, 0) / kopecks.length);
}
