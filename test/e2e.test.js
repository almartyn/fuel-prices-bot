import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { run } from '../src/index.js';
import { allSources } from '../src/sources/index.js';
import { createJsonStore } from '../src/storage/jsonStore.js';
import { createFixtureFetch } from '../src/utils/fixtureFetch.js';
import { fakeLogger, fakeStore, fakeTelegram, testConfig } from './helpers/fakes.js';
import { assertGolden } from './helpers/golden.js';

const fixtureFetch = createFixtureFetch(fileURLToPath(new URL('fixtures/', import.meta.url)));

test('offline dry-run of every registered source produces the golden post', async () => {
  /** @type {string[]} */
  const printed = [];
  const { log, lines } = fakeLogger();
  const exitCode = await run({
    config: testConfig({ DRY_RUN: 'true' }),
    log,
    sources: [...allSources],
    store: fakeStore().store,
    telegram: fakeTelegram().telegram,
    output: (text) => printed.push(text),
    now: () => new Date('2026-09-24T06:17:00Z'),
    fetch: fixtureFetch,
  });
  assert.equal(exitCode, 0, lines.join('\n'));
  assert.deepEqual(
    lines.filter((line) => !line.startsWith('[info]') && !line.startsWith('[debug]')),
    [],
    'fixtures should parse without warnings',
  );
  await assertGolden('dry-run.txt', `${printed[0]}\n`);
});

test('one source down: the others are posted, the failure is named and reported', async () => {
  /** @type {typeof fetch} */
  const socarDown = async (input, init) => {
    if (String(input).startsWith('https://socar.ua/')) throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
    return fixtureFetch(input, init);
  };
  const { telegram, sent } = fakeTelegram();
  const { store, saved } = fakeStore();
  const exitCode = await run({
    config: testConfig({ HTTP_RETRIES: '1' }),
    log: fakeLogger().log,
    sources: [...allSources],
    store,
    telegram,
    output: () => {},
    now: () => new Date('2026-09-24T06:17:00Z'),
    fetch: socarDown,
  });
  assert.equal(exitCode, 0);
  const [post, notice] = sent;
  assert.equal(post.chatId, '@test_channel');
  assert.deepEqual([...post.text.matchAll(/<b>(\w+)<\/b>/g)].map((match) => match[1]), ['OKKO', 'WOG', 'UPG']);
  assert.match(post.text, /⚠️ Не вдалося отримати дані: SOCAR/);
  assert.equal(notice.chatId, '42');
  assert.match(notice.text, /SOCAR: .*fetch failed/);
  assert.deepEqual(saved[0].failedSources, ['socar']);
});

test('two daily runs on the JSON store: the second post compares with the first', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fuel-prices-bot-e2e-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = createJsonStore({ dir });
  const { telegram, sent } = fakeTelegram();
  /** @param {string} iso */
  const runAt = (iso) =>
    run({ config: testConfig(), log: fakeLogger().log, sources: [...allSources], store, telegram, output: () => {}, now: () => new Date(iso), fetch: fixtureFetch });

  assert.equal(await runAt('2026-09-23T06:00:00Z'), 0);
  assert.equal(await runAt('2026-09-23T09:00:00Z'), 0, 'same day: skipped');
  assert.equal(await runAt('2026-09-24T06:00:00Z'), 0);

  const posts = sent.filter(({ chatId }) => chatId === '@test_channel').map(({ text }) => text);
  assert.equal(posts.length, 2);
  assert.doesNotMatch(posts[0], /Зміни відносно/);
  assert.match(posts[1], /<i>Зміни відносно 23 вересня<\/i>/);
  assert.match(posts[1], /<code>А-95 +\d+\.\d\d =<\/code>/);
  assert.deepEqual((await readdir(path.join(dir, 'history'))).sort(), ['2026-09-23.json', '2026-09-24.json']);
  assert.equal((await store.readLatest())?.postedDate, '2026-09-24');
});

test('the fixture fetch refuses URLs missing from the manifest', async () => {
  await assert.rejects(fixtureFetch('https://unknown.example/'), /No fixture for https:\/\/unknown\.example\//);
});
