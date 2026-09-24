import { setTimeout as delay } from 'node:timers/promises';

/**
 * @typedef {object} TelegramClient
 * @property {(chatId: string, text: string) => Promise<void>} sendMessage  HTML parse mode, no link previews
 */

const API_BASE = 'https://api.telegram.org';
const RETRY_DELAY_MS = 2_000;
const MAX_RETRY_AFTER_S = 60;
/** Connection never reached Telegram, so the message was surely not sent. */
const SAFE_NETWORK_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']);

export class TelegramError extends Error {
  name = 'TelegramError';

  /**
   * @param {string} message
   * @param {{ status: number | null, retryAfterS: number | null, retryable: boolean }} details
   */
  constructor(message, { status, retryAfterS, retryable }) {
    super(message);
    this.status = status;
    this.retryAfterS = retryAfterS;
    this.retryable = retryable;
  }
}

/**
 * Bot API client. Retries once, and only when the message was certainly not delivered:
 * 429 (after `retry_after`), 5xx and connection failures. Timeouts are not retried,
 * the message may already be in the channel.
 *
 * @param {object} options
 * @param {string} options.botToken
 * @param {number} [options.timeoutMs]
 * @param {typeof fetch} [options.fetch]
 * @param {(ms: number) => Promise<unknown>} [options.sleep]
 * @returns {TelegramClient}
 */
export function createTelegramClient({ botToken, timeoutMs = 20_000, fetch: fetchImpl = fetch, sleep = delay }) {
  /** @param {string} text */
  const redact = (text) => (botToken ? text.replaceAll(botToken, '***') : text);

  /**
   * @param {string} method
   * @param {object} payload
   */
  async function call(method, payload) {
    let response;
    try {
      response = await fetchImpl(`${API_BASE}/bot${botToken}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const err = /** @type {Error & { cause?: { code?: string } }} */ (error);
      const code = err.cause?.code;
      const reason = err.name === 'TimeoutError' ? `Timeout after ${timeoutMs}ms` : `${err.message}${code ? ` (${code})` : ''}`;
      throw new TelegramError(redact(`Telegram ${method}: ${reason}`), {
        status: null,
        retryAfterS: null,
        retryable: code !== undefined && SAFE_NETWORK_CODES.has(code),
      });
    }

    /** @type {{ ok?: boolean, description?: string, parameters?: { retry_after?: number } } | null} */
    const data = await response.json().catch(() => null);
    if (response.ok && data?.ok) return;

    const status = response.status;
    const retryAfterS = typeof data?.parameters?.retry_after === 'number' ? data.parameters.retry_after : null;
    throw new TelegramError(redact(`Telegram ${method}: ${data?.description ?? `HTTP ${status}`}`), {
      status,
      retryAfterS,
      retryable: status === 429 || status >= 500,
    });
  }

  return {
    async sendMessage(chatId, text) {
      const payload = { chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } };
      try {
        await call('sendMessage', payload);
      } catch (error) {
        if (!(error instanceof TelegramError) || !error.retryable) throw error;
        if (error.retryAfterS !== null && error.retryAfterS > MAX_RETRY_AFTER_S) throw error;
        await sleep(error.retryAfterS !== null ? error.retryAfterS * 1000 : RETRY_DELAY_MS);
        await call('sendMessage', payload);
      }
    },
  };
}
