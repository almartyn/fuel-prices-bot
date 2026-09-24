import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { run } from '../src/index.js';
import { fakeLogger, fakeSource, fakeStore, fakeTelegram, testConfig } from './helpers/fakes.js';

/** @import { Snapshot, Source } from '../src/types.js' */

// 22:30 UTC on Sep 23 is already Sep 24 in Kyiv (UTC+3).
const NOW = new Date('2026-09-23T22:30:00Z');
const KYIV_TODAY = '2026-09-24';

const okko = fakeSource('okko', [{ rawName: 'A-95', price: 92.9 }]);
const wog = fakeSource('wog', [{ rawName: '95 Євро5-Е10', price: 92.9 }]);
const broken = fakeSource('upg', new Error('HTTP 503 (3 attempts)'));

/** @type {Snapshot} */
const postedToday = { schemaVersion: 1, date: KYIV_TODAY, collectedAt: '', postedDate: KYIV_TODAY, stations: [], failedSources: [] };

/**
 * @param {object} [options]
 * @param {Record<string, string>} [options.env]
 * @param {Source[]} [options.sources]
 * @param {Parameters<typeof fakeStore>[0]} [options.store]
 * @param {Parameters<typeof fakeTelegram>[0]} [options.telegram]
 */
async function runWith({ env = {}, sources = [okko, wog], store: storeOptions, telegram: telegramOptions } = {}) {
  /** @type {string[]} */
  const events = [];
  /** @type {string[]} */
  const printed = [];
  const { log, lines } = fakeLogger();
  const { store, saved } = fakeStore(storeOptions, events);
  const { telegram, sent } = fakeTelegram(telegramOptions, events);
  const exitCode = await run({
    config: testConfig(env),
    log,
    sources,
    store,
    telegram,
    output: (text) => printed.push(text),
    now: () => NOW,
  });
  const toChannel = sent.filter(({ chatId }) => chatId === '@test_channel');
  const toAdmin = sent.filter(({ chatId }) => chatId === '42');
  return { exitCode, events, printed, lines, saved, toChannel, toAdmin };
}

describe('run', () => {
  test('publishes, then saves the snapshot stamped with the Kyiv date', async () => {
    const { exitCode, events, saved, toChannel, toAdmin } = await runWith();
    assert.equal(exitCode, 0);
    assert.deepEqual(events, ['send:@test_channel', 'save']);
    assert.equal(toChannel.length, 1);
    assert.equal(toAdmin.length, 0);
    assert.equal(saved[0].date, KYIV_TODAY);
    assert.equal(saved[0].postedDate, KYIV_TODAY);
    assert.equal(saved[0].collectedAt, NOW.toISOString());
    assert.deepEqual(saved[0].failedSources, []);
  });

  test('dry-run prints the post and neither publishes nor saves', async () => {
    const { exitCode, events, printed } = await runWith({ env: { DRY_RUN: 'true' } });
    assert.equal(exitCode, 0);
    assert.deepEqual(events, []);
    assert.equal(printed.length, 1);
    assert.match(printed[0], /OKKO/);
  });

  test('dry-run only logs admin notices', async () => {
    const { events, lines } = await runWith({ env: { DRY_RUN: 'true' }, sources: [okko, broken] });
    assert.deepEqual(events, []);
    assert.ok(lines.some((line) => line.startsWith('[warn] Admin notice (not sent)')));
  });

  test('skips when today was already posted', async () => {
    const { exitCode, events } = await runWith({ store: { previous: postedToday } });
    assert.equal(exitCode, 0);
    assert.deepEqual(events, []);
  });

  test('FORCE posts again on the same day', async () => {
    const { events } = await runWith({ env: { FORCE: 'true' }, store: { previous: postedToday } });
    assert.deepEqual(events, ['send:@test_channel', 'save']);
  });

  test('dry-run is not blocked by an earlier post today', async () => {
    const { printed } = await runWith({ env: { DRY_RUN: 'true' }, store: { previous: postedToday } });
    assert.equal(printed.length, 1);
  });

  test('publishes what is available when some sources fail and tells the admin', async () => {
    const { exitCode, saved, toChannel, toAdmin } = await runWith({ sources: [okko, broken] });
    assert.equal(exitCode, 0);
    assert.match(toChannel[0].text, /Не вдалося отримати дані: UPG/);
    assert.deepEqual(saved[0].failedSources, ['upg']);
    assert.equal(toAdmin.length, 1);
    assert.match(toAdmin[0].text, /UPG: HTTP 503/);
  });

  test('a source whose prices are all unknown or implausible counts as failed', async () => {
    const junk = fakeSource('upg', [{ rawName: 'Unknown 98', price: 90 }, { rawName: 'A-95', price: 5.69 }]);
    const { exitCode, saved, toChannel, toAdmin } = await runWith({ sources: [okko, junk] });
    assert.equal(exitCode, 0);
    assert.deepEqual(saved[0].failedSources, ['upg']);
    assert.match(toChannel[0].text, /Не вдалося отримати дані: UPG/);
    assert.match(toAdmin[0].text, /UPG: no usable prices left/);
    assert.match(toAdmin[0].text, /upg a95: 5\.69 \(outside 20–200 UAH\)/);
  });

  test('posts nothing and fails when every source fails', async () => {
    const { exitCode, toChannel, saved, toAdmin } = await runWith({ sources: [broken] });
    assert.equal(exitCode, 1);
    assert.equal(toChannel.length, 0);
    assert.equal(saved.length, 0);
    assert.match(toAdmin[0].text, /No source returned prices/);
  });

  test('does not save the snapshot when publishing fails', async () => {
    const { exitCode, saved, toAdmin } = await runWith({ telegram: { failFor: ['@test_channel'] } });
    assert.equal(exitCode, 1);
    assert.equal(saved.length, 0);
    assert.match(toAdmin[0].text, /Опубліковано: ні/);
    assert.match(toAdmin[0].text, /Publishing failed/);
  });

  test('reports a failed save after a successful publish', async () => {
    const { exitCode, toChannel, toAdmin } = await runWith({ store: { saveError: new Error('disk full') } });
    assert.equal(exitCode, 1);
    assert.equal(toChannel.length, 1);
    assert.match(toAdmin[0].text, /Опубліковано: так/);
    assert.match(toAdmin[0].text, /disk full/);
  });

  test('an unreadable previous snapshot is treated as missing and reported', async () => {
    const { exitCode, saved, toAdmin } = await runWith({ store: { previous: new Error('Unexpected token in JSON') } });
    assert.equal(exitCode, 0);
    assert.equal(saved.length, 1);
    assert.match(toAdmin[0].text, /Previous snapshot is unreadable/);
  });

  test('a failing admin notice does not change the outcome', async () => {
    const { exitCode, saved, lines } = await runWith({ sources: [okko, broken], telegram: { failFor: ['42'] } });
    assert.equal(exitCode, 0);
    assert.equal(saved.length, 1);
    assert.ok(lines.some((line) => line.startsWith('[error] Admin notice failed')));
  });
});
