// Re-downloads saved source responses: `npm run fixtures:update -- [id ...]` (all when no ids).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { request } from '../src/utils/http.js';

/** @import { FixtureManifest } from '../src/utils/fixtureFetch.js' */

const dir = new URL('../test/fixtures/', import.meta.url);
/** @type {FixtureManifest} */
const manifest = JSON.parse(await readFile(new URL('manifest.json', dir), 'utf8'));

const requested = process.argv.slice(2);
const unknown = requested.filter((id) => !Object.hasOwn(manifest, id));
if (unknown.length) {
  console.error(`Unknown source(s): ${unknown.join(', ')}. Known: ${Object.keys(manifest).join(', ')}`);
  process.exit(1);
}

for (const id of requested.length ? requested : Object.keys(manifest)) {
  const { url, file } = manifest[id];
  const response = await request(url, { timeoutMs: 20_000, retries: 3 });
  const body = Buffer.from(await response.arrayBuffer());
  await writeFile(new URL(file, dir), body);
  console.log(`${id}: ${fileURLToPath(new URL(file, dir))} (${body.length} bytes)`);
}
