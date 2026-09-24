import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { createJsonStore } from '../src/storage/jsonStore.js';

/** @import { Snapshot } from '../src/types.js' */

/** @param {string} date @param {number} a95 @returns {Snapshot} */
const snapshot = (date, a95) => ({
  failedSources: ['socar'],
  stations: [{ id: 'wog', name: 'WOG', prices: { a95 } }],
  postedDate: date,
  collectedAt: `${date}T06:00:12.345Z`,
  date,
  schemaVersion: 1,
});

describe('createJsonStore', () => {
  /** @type {string} */
  let dir;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'fuel-prices-bot-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('reads nothing before the first save', async () => {
    const store = createJsonStore({ dir });
    assert.equal(await store.readLatest(), null);
    assert.equal(await store.readBefore('2026-09-24'), null);
  });

  test('save writes the same JSON to history and latest, keys in the documented order', async () => {
    const store = createJsonStore({ dir });
    await store.save(snapshot('2026-09-24', 92.9));

    const latest = await readFile(path.join(dir, 'latest.json'), 'utf8');
    assert.equal(await readFile(path.join(dir, 'history', '2026-09-24.json'), 'utf8'), latest);
    assert.deepEqual(Object.keys(JSON.parse(latest)), ['schemaVersion', 'date', 'collectedAt', 'postedDate', 'stations', 'failedSources']);
    assert.ok(latest.endsWith('}\n'));
    assert.deepEqual(await store.readLatest(), snapshot('2026-09-24', 92.9));
  });

  test('leaves no temporary files and overwrites a second save on the same day', async () => {
    const store = createJsonStore({ dir });
    await store.save(snapshot('2026-09-24', 92.9));
    await store.save(snapshot('2026-09-24', 93.1));
    assert.deepEqual((await readdir(dir)).sort(), ['history', 'latest.json']);
    assert.deepEqual(await readdir(path.join(dir, 'history')), ['2026-09-24.json']);
    assert.equal((await store.readLatest())?.stations[0].prices.a95, 93.1);
  });

  test('readBefore returns the newest snapshot strictly older than the date', async () => {
    const store = createJsonStore({ dir });
    for (const [date, price] of /** @type {const} */ ([['2026-09-20', 1], ['2026-09-22', 2], ['2026-09-24', 3]])) {
      await store.save(snapshot(date, price));
    }
    await writeFile(path.join(dir, 'history', 'notes.txt'), 'not a snapshot');
    assert.equal((await store.readBefore('2026-09-24'))?.date, '2026-09-22');
    assert.equal((await store.readBefore('2026-09-21'))?.date, '2026-09-20');
    assert.equal(await store.readBefore('2026-09-20'), null);
  });

  test('a broken file throws with its name instead of pretending it is empty', async () => {
    const store = createJsonStore({ dir });
    await writeFile(path.join(dir, 'latest.json'), '{"schemaVersion": 1,');
    await assert.rejects(store.readLatest(), /^Error: latest\.json: invalid JSON/);

    await mkdir(path.join(dir, 'history'));
    await writeFile(path.join(dir, 'history', '2026-09-23.json'), JSON.stringify({ ...snapshot('2026-09-23', 1), schemaVersion: 2 }));
    await assert.rejects(store.readBefore('2026-09-24'), /history\/2026-09-23\.json: unsupported schemaVersion 2/);
  });

  test('rejects a snapshot with a non-numeric price', async () => {
    const store = createJsonStore({ dir });
    const bad = { ...snapshot('2026-09-24', 1), stations: [{ id: 'wog', name: 'WOG', prices: { a95: '92.90' } }] };
    await writeFile(path.join(dir, 'latest.json'), JSON.stringify(bad));
    await assert.rejects(store.readLatest(), /station wog has a non-numeric price/);
  });
});
