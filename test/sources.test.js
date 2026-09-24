import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, test } from 'node:test';

import { ConfigError } from '../src/config.js';
import { FUEL_MAP } from '../src/core/fuels.js';
import { allSources, selectSources } from '../src/sources/index.js';
import { parse as parseWog } from '../src/sources/wog.js';
import { fakeSource } from './helpers/fakes.js';

/** @param {string} file */
const readFixture = (file) => readFile(new URL(`fixtures/${file}`, import.meta.url), 'utf8');

describe('selectSources', () => {
  const registry = ['okko', 'wog', 'upg'].map((id) => fakeSource(id, []));

  test('selects every source when no ids are given', () => {
    assert.deepEqual(selectSources(null, registry), registry);
  });

  test('keeps registry order, not the order in SOURCES', () => {
    assert.deepEqual(
      selectSources(['upg', 'okko'], registry).map((source) => source.id),
      ['okko', 'upg'],
    );
  });

  test('rejects unknown ids', () => {
    assert.throws(
      () => selectSources(['okko', 'shell'], registry),
      (error) => error instanceof ConfigError && /Unknown source\(s\) in SOURCES: shell/.test(error.message),
    );
  });
});

test('every registered source has a fuel map and a fixture in the manifest', async () => {
  const manifest = JSON.parse(await readFixture('manifest.json'));
  for (const source of allSources) {
    assert.ok(FUEL_MAP[source.id], `FUEL_MAP has no entry for ${source.id}`);
    assert.ok(manifest[source.id], `test/fixtures/manifest.json has no entry for ${source.id}`);
  }
});

describe('wog', () => {
  test('parses the saved API response', async () => {
    const items = parseWog(JSON.parse(await readFixture('wog.json')));
    assert.deepEqual(items, [
      { rawName: 'ДП Євро5', price: 99.9 },
      { rawName: 'ДП Mustang+', price: 99.9 },
      { rawName: '95 Євро5-Е10', price: 92.9 },
      { rawName: '95 Mustang Євро5-Е10', price: 95.9 },
      { rawName: '100 Mustang Євро5-Е0', price: 99.9 },
      { rawName: 'ГАЗ', price: 45.5 },
      { rawName: 'AdBlue', price: 59.9 },
    ]);
  });

  test('every name in the fixture is known to FUEL_MAP', async () => {
    for (const { rawName } of parseWog(JSON.parse(await readFixture('wog.json')))) {
      assert.ok(Object.hasOwn(FUEL_MAP.wog, rawName), `FUEL_MAP.wog lacks "${rawName}"`);
    }
  });

  test('throws when the response shape changes', () => {
    assert.throws(() => parseWog({ data: {} }), /data\.fuel_filters is missing or empty/);
    assert.throws(() => parseWog(null), /data\.fuel_filters is missing or empty/);
    assert.throws(() => parseWog({ data: { fuel_filters: [{ name: '95', price: '92.90' }] } }), /integer price/);
  });
});
