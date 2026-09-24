import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createLogger } from '../src/utils/logger.js';

test('logger prints lines at or above its level with a level prefix', () => {
  /** @type {string[]} */
  const lines = [];
  const log = createLogger({ level: 'warn', write: (line) => lines.push(line) });
  log.debug('d');
  log.info('i');
  log.warn('w');
  log.error('e');
  assert.deepEqual(lines, ['[warn] w', '[error] e']);
});
