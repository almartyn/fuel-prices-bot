import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validate } from '../src/core/validate.js';

/** @import { Snapshot, Station } from '../src/types.js' */

const limits = { priceMin: 20, priceMax: 200, maxDailyChangePct: 15 };

/** @param {Record<string, number>} prices @returns {Station} */
const wog = (prices) => ({ id: 'wog', name: 'WOG', prices });

/** @param {Station[]} stations @returns {Snapshot} */
const snapshot = (stations) => ({ schemaVersion: 1, date: '2026-09-23', collectedAt: '', stations, failedSources: [] });

test('keeps plausible prices', () => {
  const { stations, rejected } = validate([wog({ a95: 92.9, lpg: 45.5 })], null, limits);
  assert.deepEqual(stations, [wog({ a95: 92.9, lpg: 45.5 })]);
  assert.deepEqual(rejected, []);
});

test('drops prices outside the plausible range', () => {
  const { stations, rejected } = validate([wog({ a95: 5.69, diesel: 999, lpg: Number.NaN, a100: 99.9 })], null, limits);
  assert.deepEqual(stations[0].prices, { a100: 99.9 });
  assert.deepEqual(
    rejected.map(({ code, reason }) => [code, reason]),
    [
      ['a95', 'outside 20–200 UAH'],
      ['diesel', 'outside 20–200 UAH'],
      ['lpg', 'outside 20–200 UAH'],
    ],
  );
});

test('drops sharp jumps against the previous snapshot of the same station', () => {
  const previous = snapshot([wog({ a95: 56.69, diesel: 99.9 }), { id: 'okko', name: 'OKKO', prices: { lpg: 20 } }]);
  const { stations, rejected } = validate([wog({ a95: 92.9, diesel: 101.9, lpg: 45.5 })], previous, limits);
  assert.deepEqual(stations[0].prices, { diesel: 101.9, lpg: 45.5 });
  assert.deepEqual(rejected, [
    { stationId: 'wog', code: 'a95', price: 92.9, previous: 56.69, reason: '+63.9% since previous 56.69' },
  ]);
});

test('a change exactly at the limit is allowed', () => {
  const { rejected } = validate([wog({ a95: 115 })], snapshot([wog({ a95: 100 })]), limits);
  assert.deepEqual(rejected, []);
});
