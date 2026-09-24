import { loadConfig } from '../../src/config.js';
import { createLogger } from '../../src/utils/logger.js';

/** @import { RawPrice, Snapshot, Source } from '../../src/types.js' */
/** @import { SnapshotStore } from '../../src/storage/jsonStore.js' */
/** @import { TelegramClient } from '../../src/telegram/client.js' */

/** @param {Record<string, string>} [env] */
export function testConfig(env = {}) {
  return loadConfig({
    TELEGRAM_BOT_TOKEN: '123:secret',
    TELEGRAM_CHANNEL_ID: '@test_channel',
    TELEGRAM_ADMIN_CHAT_ID: '42',
    ...env,
  });
}

export function fakeLogger() {
  /** @type {string[]} */
  const lines = [];
  return { log: createLogger({ level: 'debug', write: (line) => lines.push(line) }), lines };
}

/**
 * @param {string} id
 * @param {RawPrice[] | Error} result
 * @returns {Source}
 */
export function fakeSource(id, result) {
  return {
    id,
    name: id.toUpperCase(),
    url: `https://${id}.example`,
    async fetchPrices() {
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

/**
 * @param {{ previous?: Snapshot | null | Error, before?: Snapshot | null | Error, saveError?: Error }} [options]
 *   `previous` answers readLatest, `before` answers readBefore
 * @param {string[]} [events]  shared call log to check ordering
 */
export function fakeStore({ previous = null, before = null, saveError } = {}, events = []) {
  /** @type {Snapshot[]} */
  const saved = [];
  /** @type {SnapshotStore} */
  const store = {
    async readLatest() {
      if (previous instanceof Error) throw previous;
      return previous;
    },
    async readBefore() {
      if (before instanceof Error) throw before;
      return before;
    },
    async save(snapshot) {
      events.push('save');
      if (saveError) throw saveError;
      saved.push(snapshot);
    },
  };
  return { store, saved };
}

/**
 * @param {{ failFor?: string[] }} [options]  chat ids whose sendMessage throws
 * @param {string[]} [events]
 */
export function fakeTelegram({ failFor = [] } = {}, events = []) {
  /** @type {{ chatId: string, text: string }[]} */
  const sent = [];
  /** @type {TelegramClient} */
  const telegram = {
    async sendMessage(chatId, text) {
      events.push(`send:${chatId}`);
      if (failFor.includes(chatId)) throw new Error(`Telegram: chat ${chatId} failed`);
      sent.push({ chatId, text });
    },
  };
  return { telegram, sent };
}
