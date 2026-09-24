import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, test } from 'node:test';

import { ConfigError } from '../src/config.js';
import { FUEL_MAP } from '../src/core/fuels.js';
import { allSources, selectSources } from '../src/sources/index.js';
import { parse as parseOkko } from '../src/sources/okko.js';
import { parse as parseSocar } from '../src/sources/socar.js';
import { parse as parseUpg } from '../src/sources/upg.js';
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

test('registry order is the post order', () => {
  assert.deepEqual(allSources.map((source) => source.id), ['okko', 'wog', 'upg', 'socar']);
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

describe('okko', () => {
  test('parses the saved API response', async () => {
    assert.deepEqual(parseOkko(JSON.parse(await readFixture('okko.json'))), [
      { rawName: 'Pulls 100', price: 99.9 },
      { rawName: 'Pulls Diesel', price: 99.9 },
      { rawName: 'DP', price: 99.9 },
      { rawName: 'Pulls 95', price: 95.9 },
      { rawName: 'A-95', price: 92.9 },
      { rawName: 'SPBT', price: 45.5 },
      { rawName: 'AdBlue', price: 59.9 },
    ]);
  });

  test('every name in the fixture is known to FUEL_MAP', async () => {
    for (const { rawName } of parseOkko(JSON.parse(await readFixture('okko.json')))) {
      assert.ok(Object.hasOwn(FUEL_MAP.okko, rawName), `FUEL_MAP.okko lacks "${rawName}"`);
    }
  });

  test('throws when the response shape changes', () => {
    /** @param {unknown} items */
    const withItems = (items) => ({ data: { layout: [{ data: {} }, { data: { bullets: { componentName: 'Global_BulletsFuel', items } } }] } });
    assert.throws(() => parseOkko({ data: {} }), /data\.layout is missing/);
    assert.throws(() => parseOkko({ data: { layout: [{ data: {} }] } }), /no block with data\.bullets\.componentName "Global_BulletsFuel"/);
    assert.throws(() => parseOkko(withItems([])), /items is missing or empty/);
    assert.throws(() => parseOkko(withItems([{ fuel_code: 'A-95', price: 'скоро' }])), /items\[0\] has no fuel_code or price/);
  });
});

describe('upg', () => {
  test('parses the prices embedded in the saved page, one per fuel', async () => {
    assert.deepEqual(parseUpg(await readFixture('upg.html')), [
      { rawName: 'upgDIESEL', price: 99.9 },
      { rawName: 'A-95', price: 88.9 },
      { rawName: 'Газ', price: 43.9 },
      { rawName: 'EURO DIESEL', price: 97.9 },
      { rawName: 'AdBlue', price: 46 },
      { rawName: 'upg100', price: 99.9 },
      { rawName: 'upg95', price: 91.9 },
    ]);
  });

  test('every name in the fixture is known to FUEL_MAP', async () => {
    for (const { rawName } of parseUpg(await readFixture('upg.html'))) {
      assert.ok(Object.hasOwn(FUEL_MAP.upg, rawName), `FUEL_MAP.upg lacks "${rawName}"`);
    }
  });

  /** @param {{ Title: string, AveragePrice: string }[]} rows */
  const page = (rows) => `<script>\n  var obj = ${JSON.stringify({ data: rows, note: 'a } in "a string"' })};\n</script>`;

  test('takes the most common regional price, the lower one on a tie', () => {
    const row = (/** @type {string} */ Title, /** @type {string} */ AveragePrice) => ({ Title, AveragePrice });
    assert.deepEqual(
      parseUpg(page([row('A-95', '88.90'), row('A-95', '88.95'), row('A-95', '88.90'), row('Газ', '43.99'), row('Газ', '43.90')])),
      [
        { rawName: 'A-95', price: 88.9 },
        { rawName: 'Газ', price: 43.9 },
      ],
    );
  });

  test('throws when the page changes', () => {
    assert.throws(() => parseUpg('<html>no prices</html>'), /var obj not found/);
    assert.throws(() => parseUpg('<script>var obj = {"data": [</script>'), /var obj is not closed/);
    assert.throws(() => parseUpg("<script>var obj = {data: 1};</script>"), /var obj is not valid JSON/);
    assert.throws(() => parseUpg(page([])), /obj\.data is missing or empty/);
    assert.throws(() => parseUpg(page([{ Title: 'A-95', AveragePrice: '' }])), /obj\.data\[0\] has no Title or AveragePrice/);
  });
});

describe('socar', () => {
  test('parses the saved API response, prices taken from the text', async () => {
    assert.deepEqual(parseSocar(JSON.parse(await readFixture('socar.json'))), [
      { rawName: 'NANO 100', price: 104 },
      { rawName: 'DIESEL NANO Extro', price: 104 },
      { rawName: 'NANO ДП', price: 103 },
      { rawName: 'NANO 95', price: 97.9 },
      { rawName: 'Бензин А-95', price: 94.9 },
      { rawName: 'LPG', price: 45.5 },
      { rawName: 'AdBlue', price: 59.9 },
    ]);
  });

  test('every name in the fixture is known to FUEL_MAP', async () => {
    for (const { rawName } of parseSocar(JSON.parse(await readFixture('socar.json')))) {
      assert.ok(Object.hasOwn(FUEL_MAP.socar, rawName), `FUEL_MAP.socar lacks "${rawName}"`);
    }
  });

  test('throws when the response shape changes', () => {
    /** @param {unknown[]} items */
    const withItems = (items) => ({ data: { attributes: { blocks: { data: [{ id: 'contentCardList', attributes: { items } }] } } } });
    assert.throws(() => parseSocar({ data: {} }), /data\.attributes\.blocks\.data is missing/);
    assert.throws(() => parseSocar({ data: { attributes: { blocks: { data: [{ id: 'other' }] } } } }), /"contentCardList" with attributes\.items is missing/);
    assert.throws(() => parseSocar(withItems([{ title: { text: 'LPG' }, price: 'Ціну уточнюйте на АЗК' }])), /items\[0\] has no title\.text or "Ціна: … грн" price/);
    assert.throws(() => parseSocar(withItems([{ title: {}, price: '*Ціна: 45.5 грн/л' }])), /items\[0\] has no title\.text/);
  });
});
