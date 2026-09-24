/** @import { Snapshot, Comparison } from '../types.js' */

/**
 * Stub until roadmap stage 4: no deltas, no averages.
 *
 * @param {Snapshot | null} previous
 * @param {Snapshot} current
 * @returns {Comparison}
 */
export function compare(previous, current) {
  return {
    date: current.date,
    previousDate: previous?.date ?? null,
    stations: current.stations.map((station) => ({
      id: station.id,
      name: station.name,
      fuels: Object.entries(station.prices).map(([code, price]) => ({ code, price, previous: null, delta: null })),
    })),
    averages: [],
  };
}
