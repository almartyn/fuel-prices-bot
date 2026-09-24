/** @import { Snapshot } from '../types.js' */

/**
 * @typedef {object} SnapshotStore
 * @property {() => Promise<Snapshot | null>} readLatest
 * @property {(snapshot: Snapshot) => Promise<void>} save
 */

/**
 * Stub until roadmap stage 4: nothing is read or written.
 *
 * @param {{ dir: string }} _options
 * @returns {SnapshotStore}
 */
export function createJsonStore(_options) {
  return {
    async readLatest() {
      return null;
    },
    async save() {
      throw new Error('JSON store is not implemented yet (roadmap stage 4)');
    },
  };
}
