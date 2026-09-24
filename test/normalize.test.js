import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalize } from '../src/core/normalize.js';
import { fakeLogger, fakeSource } from './helpers/fakes.js';

/** @param {string} id @param {[string, number][]} items */
const result = (id, items) => ({
  source: fakeSource(id, []),
  items: items.map(([rawName, price]) => ({ rawName, price })),
});

test('maps raw names to fuel codes per source', () => {
  const { log } = fakeLogger();
  const stations = normalize(
    [
      result('okko', [['A-95', 92.9], ['Pulls 95', 95.9], ['SPBT', 45.5]]),
      result('wog', [['95 Mustang Євро5-Е10', 95.9]]),
    ],
    log,
  );
  assert.deepEqual(stations, [
    { id: 'okko', name: 'OKKO', prices: { a95: 92.9, a95_premium: 95.9, lpg: 45.5 } },
    { id: 'wog', name: 'WOG', prices: { a95_premium: 95.9 } },
  ]);
});

test('skips unknown names with a warning and ignored products silently', () => {
  const { log, lines } = fakeLogger();
  const [station] = normalize([result('okko', [['A-95', 92.9], ['Pulls 98', 97], ['AdBlue', 59.9]])], log);
  assert.deepEqual(station.prices, { a95: 92.9 });
  assert.deepEqual(lines, ['[warn] okko: unknown fuel "Pulls 98" skipped, add it to FUEL_MAP in src/core/fuels.js']);
});

test('the same name means different things per source', () => {
  const { log, lines } = fakeLogger();
  const [station] = normalize([result('wog', [['A-95', 92.9]])], log);
  assert.deepEqual(station.prices, {});
  assert.equal(lines.length, 1);
});

test('keeps the first price when two names map to one code', () => {
  const { log, lines } = fakeLogger();
  const [station] = normalize([result('okko', [['A-95', 92.9], ['A-95', 93.9]])], log);
  assert.deepEqual(station.prices, { a95: 92.9 });
  assert.match(lines[0], /maps to a95 again/);
});
