import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseUah, toKopecks } from '../src/core/money.js';

test('toKopecks rounds away float noise', () => {
  assert.equal(toKopecks(56.99) - toKopecks(56.69), 30);
});

test('parseUah reads plain price text', () => {
  assert.equal(parseUah('92.90'), 92.9);
  assert.equal(parseUah('97.9'), 97.9);
  assert.equal(parseUah(' 104 '), 104);
  assert.equal(parseUah('92,90'), 92.9);
});

test('parseUah refuses anything it would have to guess', () => {
  for (const text of ['', 'скоро', '92.905', '92.90 грн', '-5', '1 092.90', '0x5A']) {
    assert.equal(parseUah(text), null, JSON.stringify(text));
  }
  assert.equal(parseUah(92.9), null);
  assert.equal(parseUah(undefined), null);
});
