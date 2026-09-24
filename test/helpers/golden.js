import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const GOLDEN_DIR = new URL('../golden/', import.meta.url);

/**
 * Compares output with `test/golden/<name>`. `UPDATE_GOLDEN=1 npm test` rewrites the file;
 * review the diff before committing, the golden file is the spec.
 *
 * @param {string} name
 * @param {string} actual
 */
export async function assertGolden(name, actual) {
  const file = new URL(name, GOLDEN_DIR);
  if (process.env.UPDATE_GOLDEN === '1') {
    await mkdir(GOLDEN_DIR, { recursive: true });
    await writeFile(file, actual);
    return;
  }
  let expected;
  try {
    expected = await readFile(file, 'utf8');
  } catch {
    assert.fail(`test/golden/${name} is missing. Create it with UPDATE_GOLDEN=1 npm test and review it.`);
  }
  assert.equal(actual, expected, `Output differs from test/golden/${name}. If intended: UPDATE_GOLDEN=1 npm test, then review the diff.`);
}
