import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { errorMessage } from '../utils/errors.js';

/** @import { Snapshot } from '../types.js' */

export const SCHEMA_VERSION = 1;

const DATE_FILE = /^(\d{4}-\d{2}-\d{2})\.json$/;

/**
 * @typedef {object} SnapshotStore
 * @property {() => Promise<Snapshot | null>} readLatest  null before the first publish
 * @property {(date: string) => Promise<Snapshot | null>} readBefore  newest history snapshot older than `date`
 * @property {(snapshot: Snapshot) => Promise<void>} save  writes history/<date>.json, then latest.json
 */

/**
 * Snapshots as JSON files (layout: docs/storage-and-comparison.md). Every file is written
 * to a temporary name and renamed, so a crash never leaves half a JSON behind.
 *
 * @param {{ dir: string }} options
 * @returns {SnapshotStore}
 */
export function createJsonStore({ dir }) {
  const latestFile = path.join(dir, 'latest.json');
  const historyDir = path.join(dir, 'history');
  /** @param {string} file */
  const read = (file) => readSnapshot(file, path.relative(dir, file));

  return {
    readLatest: () => read(latestFile),

    async readBefore(date) {
      const names = await readdir(historyDir).catch((error) => {
        if (error?.code === 'ENOENT') return [];
        throw error;
      });
      const older = names.filter((name) => DATE_FILE.test(name) && name.slice(0, 10) < date).sort();
      const newest = older.at(-1);
      return newest ? read(path.join(historyDir, newest)) : null;
    },

    async save(snapshot) {
      const json = serialize(snapshot);
      await mkdir(historyDir, { recursive: true });
      await writeAtomic(path.join(historyDir, `${snapshot.date}.json`), json);
      await writeAtomic(latestFile, json);
    },
  };
}

/**
 * @param {string} file
 * @param {string} label  path shown in errors
 * @returns {Promise<Snapshot | null>}
 */
async function readSnapshot(file, label) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') return null;
    throw error;
  }

  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`${label}: invalid JSON: ${errorMessage(error)}`, { cause: error });
  }
  const problem = snapshotProblem(value);
  if (problem) throw new Error(`${label}: ${problem}`);
  return value;
}

/**
 * @param {any} value
 * @returns {string | null}
 */
function snapshotProblem(value) {
  if (typeof value !== 'object' || value === null) return 'not an object';
  if (value.schemaVersion !== SCHEMA_VERSION) return `unsupported schemaVersion ${JSON.stringify(value.schemaVersion)}`;
  if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return 'date is not YYYY-MM-DD';
  if (!Array.isArray(value.stations)) return 'stations is not an array';
  for (const station of value.stations) {
    if (typeof station?.id !== 'string' || typeof station.prices !== 'object' || station.prices === null) {
      return 'a station has no id or prices';
    }
    if (!Object.values(station.prices).every(Number.isFinite)) return `station ${station.id} has a non-numeric price`;
  }
  if (!Array.isArray(value.failedSources)) return 'failedSources is not an array';
  return null;
}

/**
 * Fixed key order, as in the docs, so history diffs stay readable.
 *
 * @param {Snapshot} snapshot
 */
function serialize({ schemaVersion, date, collectedAt, postedDate, stations, failedSources }) {
  return `${JSON.stringify({ schemaVersion, date, collectedAt, postedDate, stations, failedSources }, null, 2)}\n`;
}

/**
 * @param {string} file
 * @param {string} text
 */
async function writeAtomic(file, text) {
  const temp = `${file}.${process.pid}.tmp`;
  try {
    await writeFile(temp, text);
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}
