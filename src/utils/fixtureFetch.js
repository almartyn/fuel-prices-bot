import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * @typedef {Record<string, { url: string, file: string }>} FixtureManifest  keyed by source id
 */

/**
 * A `fetch` that answers from saved responses listed in `<dir>/manifest.json`,
 * for OFFLINE=true dry-runs and end-to-end tests.
 *
 * @param {string} dir
 * @returns {typeof fetch}
 */
export function createFixtureFetch(dir) {
  return /** @type {typeof fetch} */ (
    async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      /** @type {FixtureManifest} */
      const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
      const entry = Object.values(manifest).find((candidate) => candidate.url === url);
      if (!entry) throw new Error(`No fixture for ${url} in ${join(dir, 'manifest.json')}`);
      return new Response(await readFile(join(dir, entry.file)), { status: 200 });
    }
  );
}
