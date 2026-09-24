import { fileURLToPath } from 'node:url';

import { ConfigError, loadConfig } from './config.js';
import { collectAll } from './core/collect.js';
import { compare } from './core/compare.js';
import { normalize } from './core/normalize.js';
import { validate } from './core/validate.js';
import { selectSources } from './sources/index.js';
import { createJsonStore } from './storage/jsonStore.js';
import { createTelegramClient } from './telegram/client.js';
import { formatAdminNotice, formatPost } from './telegram/formatter.js';
import { localDate } from './utils/date.js';
import { errorMessage } from './utils/errors.js';
import { createFixtureFetch } from './utils/fixtureFetch.js';
import { createLogger } from './utils/logger.js';

/** @import { Config } from './config.js' */
/** @import { Source, Snapshot } from './types.js' */
/** @import { Logger } from './utils/logger.js' */
/** @import { SnapshotStore } from './storage/jsonStore.js' */
/** @import { TelegramClient } from './telegram/client.js' */
/** @import { AdminNotice } from './telegram/formatter.js' */

export const SCHEMA_VERSION = 1;

const FIXTURES_DIR = fileURLToPath(new URL('../test/fixtures/', import.meta.url));

/**
 * @typedef {object} RunDeps
 * @property {Readonly<Config>} config
 * @property {Logger} log
 * @property {Source[]} sources
 * @property {SnapshotStore} store
 * @property {TelegramClient} telegram
 * @property {(text: string) => void} output  receives the post in dry-run mode
 * @property {() => Date} [now]
 * @property {typeof fetch} [fetch]  replaces the network for every source
 */

/**
 * One daily run. The snapshot is saved only after a successful publish,
 * so a failed run is retried against the same previous day.
 *
 * @param {RunDeps} deps
 * @returns {Promise<number>} process exit code
 */
export async function run({ config, log, sources, store, telegram, output, now = () => new Date(), fetch }) {
  const startedAt = now();
  const today = localDate(startedAt, config.timeZone);
  /** @type {string[]} */
  const messages = [];

  /** @type {Snapshot | null} */
  let previous = null;
  try {
    previous = await store.readLatest();
  } catch (error) {
    log.error(`Cannot read the previous snapshot, comparing with nothing: ${errorMessage(error)}`);
    messages.push(`Previous snapshot is unreadable: ${errorMessage(error)}`);
  }

  if (!config.force && !config.dryRun && previous?.postedDate === today) {
    log.info(`Already posted for ${today}, skipping (set FORCE=true to post again)`);
    return 0;
  }

  const http = fetch ? { ...config.http, fetch } : config.http;
  const { results, errors } = await collectAll(sources, { http }, log);
  const validated = validate(normalize(results, log), previous, config.validation);
  const rejected = validated.rejected;
  const stations = [];
  for (const station of validated.stations) {
    if (Object.keys(station.prices).length) {
      stations.push(station);
      continue;
    }
    const source = /** @type {Source} */ (sources.find(({ id }) => id === station.id));
    const error = new Error('no usable prices left after normalization and validation');
    log.warn(`${source.id}: ${error.message}`);
    errors.push({ source, error });
  }

  /** @type {Snapshot} */
  const snapshot = {
    schemaVersion: SCHEMA_VERSION,
    date: today,
    collectedAt: startedAt.toISOString(),
    stations,
    failedSources: errors.map(({ source }) => source.id),
  };

  /** @param {boolean} published @param {string[]} [extra] */
  const notify = (published, extra = []) =>
    notifyAdmin(
      { config, log, telegram },
      { date: today, published, errors, rejected, messages: [...messages, ...extra] },
    );
  const hasProblems = () => errors.length > 0 || rejected.length > 0 || messages.length > 0;

  if (stations.length === 0) {
    log.error('No source returned prices, nothing to post');
    await notify(false, ['No source returned prices']);
    return 1;
  }

  const text = formatPost({ comparison: compare(previous, snapshot), errors, sources });

  if (config.dryRun) {
    output(text);
    if (hasProblems()) await notify(false);
    return 0;
  }

  try {
    await telegram.sendMessage(config.telegram.channelId, text);
  } catch (error) {
    log.error(`Publishing failed, snapshot not saved: ${errorMessage(error)}`);
    await notify(false, [`Publishing failed: ${errorMessage(error)}`]);
    return 1;
  }
  log.info('Post published');

  try {
    await store.save({ ...snapshot, postedDate: today });
  } catch (error) {
    log.error(`Saving the snapshot failed: ${errorMessage(error)}`);
    await notify(true, [`Saving the snapshot failed: ${errorMessage(error)}`]);
    return 1;
  }

  if (hasProblems()) await notify(true);
  return 0;
}

/**
 * Never throws: a failed notice must not change the outcome of the run.
 *
 * @param {{ config: Readonly<Config>, log: Logger, telegram: TelegramClient }} deps
 * @param {AdminNotice} notice
 */
async function notifyAdmin({ config, log, telegram }, notice) {
  const text = formatAdminNotice(notice);
  const chatId = config.telegram.adminChatId;
  if (config.dryRun || !chatId) {
    log.warn(`Admin notice (not sent):\n${text}`);
    return;
  }
  try {
    await telegram.sendMessage(chatId, text);
  } catch (error) {
    log.error(`Admin notice failed: ${errorMessage(error)}\n${text}`);
  }
}

async function main() {
  let config;
  let sources;
  try {
    config = loadConfig(process.env);
    sources = selectSources(config.sources);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    process.stderr.write(`Configuration error:\n${error.message}\n`);
    process.exitCode = 1;
    return;
  }

  const log = createLogger({ level: config.logLevel });
  try {
    process.exitCode = await run({
      config,
      log,
      sources,
      store: createJsonStore({ dir: 'data' }),
      telegram: createTelegramClient({ botToken: config.telegram.botToken }),
      output: (text) => process.stdout.write(`${text}\n`),
      fetch: config.offline ? createFixtureFetch(FIXTURES_DIR) : undefined,
    });
  } catch (error) {
    log.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  }
}

if (import.meta.main) await main();
