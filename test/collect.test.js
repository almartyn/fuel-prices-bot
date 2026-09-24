import assert from 'node:assert/strict';
import { test } from 'node:test';

import { collectAll } from '../src/core/collect.js';
import { fakeLogger, fakeSource } from './helpers/fakes.js';

const context = { http: { timeoutMs: 1_000, retries: 1 } };

test('a failing source does not stop the others', async () => {
  const { log, lines } = fakeLogger();
  const { results, errors } = await collectAll(
    [
      fakeSource('okko', [{ rawName: 'A-95', price: 92.9 }]),
      fakeSource('wog', new Error('Timeout after 20000ms')),
      fakeSource('upg', [{ rawName: 'A-95', price: 88.9 }]),
    ],
    context,
    log,
  );
  assert.deepEqual(
    results.map(({ source }) => source.id),
    ['okko', 'upg'],
  );
  assert.deepEqual(
    errors.map(({ source, error }) => [source.id, error.message]),
    [['wog', 'Timeout after 20000ms']],
  );
  assert.ok(lines.includes('[warn] wog: Timeout after 20000ms'));
});

test('an empty result counts as a failure', async () => {
  const { log } = fakeLogger();
  const { results, errors } = await collectAll([fakeSource('okko', [])], context, log);
  assert.equal(results.length, 0);
  assert.match(errors[0].error.message, /returned no prices/);
});

test('non-Error rejections are wrapped', async () => {
  const { log } = fakeLogger();
  const source = { ...fakeSource('okko', []), fetchPrices: () => Promise.reject('boom') };
  const { errors } = await collectAll([source], context, log);
  assert.ok(errors[0].error instanceof Error);
  assert.equal(errors[0].error.message, 'boom');
});

test('passes HTTP settings to parsers', async () => {
  const { log } = fakeLogger();
  /** @type {unknown} */
  let received;
  const source = {
    ...fakeSource('okko', []),
    async fetchPrices(/** @type {unknown} */ ctx) {
      received = ctx;
      return [{ rawName: 'A-95', price: 92.9 }];
    },
  };
  await collectAll([source], context, log);
  assert.deepEqual(received, context);
});
