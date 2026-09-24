import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { run } from '../src/index.js';
import { allSources } from '../src/sources/index.js';
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

test('the fixture fetch refuses URLs missing from the manifest', async () => {
  await assert.rejects(fixtureFetch('https://unknown.example/'), /No fixture for https:\/\/unknown\.example\//);
});
