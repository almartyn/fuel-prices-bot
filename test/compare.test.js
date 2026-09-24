import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { compare } from '../src/core/compare.js';

/** @import { Snapshot, Station } from '../src/types.js' */

/**
 * @param {string} date
 * @param {Station[]} stations
 * @returns {Snapshot}
 */
const snapshot = (date, stations) => ({ schemaVersion: 1, date, collectedAt: `${date}T06:00:00.000Z`, stations, failedSources: [] });

/** @param {string} id @param {Record<string, number>} prices @returns {Station} */
const station = (id, prices) => ({ id, name: id.toUpperCase(), prices });

describe('compare', () => {
  test('first run: no previous date and no deltas', () => {
    const result = compare(null, snapshot('2026-09-24', [station('wog', { a95: 92.9 }), station('okko', { a95: 92.7 })]));
    assert.equal(result.previousDate, null);
    assert.deepEqual(result.stations[0].fuels, [{ code: 'a95', price: 92.9, previous: null, delta: null }]);
    assert.deepEqual(result.averages, [{ code: 'a95', price: 92.8, previous: null, delta: null, stationsCount: 2 }]);
  });

  test('up, down and unchanged, counted in kopecks without float noise', () => {
    const result = compare(
      snapshot('2026-09-23', [station('okko', { a95: 56.69, diesel: 54.69, lpg: 32.99 })]),
      snapshot('2026-09-24', [station('okko', { a95: 56.99, diesel: 54.49, lpg: 32.99 })]),
    );
    assert.equal(result.previousDate, '2026-09-23');
    assert.deepEqual(result.stations[0].fuels, [
      { code: 'a95', price: 56.99, previous: 56.69, delta: 0.3 },
      { code: 'diesel', price: 54.49, previous: 54.69, delta: -0.2 },
      { code: 'lpg', price: 32.99, previous: 32.99, delta: 0 },
    ]);
  });

  test('a new fuel or a station missing from the previous snapshot has no delta', () => {
    const result = compare(
      snapshot('2026-09-23', [station('okko', { a95: 56.69 })]),
      snapshot('2026-09-24', [station('okko', { a95: 56.69, a100: 64.99 }), station('socar', { a95: 57.49 })]),
    );
    assert.deepEqual(result.stations[0].fuels[1], { code: 'a100', price: 64.99, previous: null, delta: null });
    assert.deepEqual(result.stations[1].fuels, [{ code: 'a95', price: 57.49, previous: null, delta: null }]);
  });

  test('a fuel that disappeared today is not shown', () => {
    const result = compare(
      snapshot('2026-09-23', [station('wog', { a95: 56.69, lpg: 32.99 })]),
      snapshot('2026-09-24', [station('wog', { a95: 56.69 })]),
    );
    assert.deepEqual(result.stations[0].fuels.map(({ code }) => code), ['a95']);
  });

  test('keeps the date of an older snapshot when days were skipped', () => {
    const result = compare(snapshot('2026-09-20', []), snapshot('2026-09-24', [station('wog', { a95: 1 })]));
    assert.equal(result.previousDate, '2026-09-20');
  });

  describe('averages', () => {
    test('are rounded to kopecks, follow the fuel order and skip fuels of a single station', () => {
      const result = compare(
        null,
        snapshot('2026-09-24', [
          station('okko', { diesel: 54.49, a95: 56.99, a100: 64.99 }),
          station('wog', { diesel: 54.39, a95: 56.89 }),
          station('upg', { a95: 56.5 }),
        ]),
      );
      assert.deepEqual(
        result.averages.map(({ code, price, stationsCount }) => ({ code, price, stationsCount })),
        [
          { code: 'a95', price: 56.79, stationsCount: 3 },
          { code: 'diesel', price: 54.44, stationsCount: 2 },
        ],
      );
    });

    test('change counts only stations priced on both days', () => {
      // UPG failed yesterday. Its low price must not look like a drop of the average.
      const result = compare(
        snapshot('2026-09-23', [station('okko', { a95: 56.69 }), station('wog', { a95: 56.59 })]),
        snapshot('2026-09-24', [station('okko', { a95: 56.99 }), station('wog', { a95: 56.79 }), station('upg', { a95: 50.0 })]),
      );
      assert.deepEqual(result.averages, [{ code: 'a95', price: 54.59, previous: 56.64, delta: 0.25, stationsCount: 3 }]);
    });

    test('have no change when no station was priced yesterday', () => {
      const result = compare(
        snapshot('2026-09-23', [station('okko', { diesel: 54.49 })]),
        snapshot('2026-09-24', [station('okko', { a95: 56.99 }), station('wog', { a95: 56.79 })]),
      );
      assert.deepEqual(result.averages, [{ code: 'a95', price: 56.89, previous: null, delta: null, stationsCount: 2 }]);
    });
  });
});
