/** @import { Station, Snapshot, RejectedPrice } from '../types.js' */
/** @import { Config } from '../config.js' */

/**
 * Stub until roadmap stage 2: accepts every price.
 *
 * @param {Station[]} stations
 * @param {Snapshot | null} _previous
 * @param {Config['validation']} _limits
 * @returns {{ stations: Station[], rejected: RejectedPrice[] }}
 */
export function validate(stations, _previous, _limits) {
  return { stations, rejected: [] };
}
