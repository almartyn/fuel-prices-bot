import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { ConfigError } from '../src/config.js';
import { selectSources } from '../src/sources/index.js';
import { fakeSource } from './helpers/fakes.js';

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
