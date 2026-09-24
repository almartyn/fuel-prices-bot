import { setTimeout as delay } from 'node:timers/promises';

/** @import { HttpSettings } from '../types.js' */

/**
 * @typedef {HttpSettings & {
 *   headers?: Record<string, string>,
 *   fetch?: typeof fetch,
 *   sleep?: (ms: number) => Promise<unknown>,
 * }} RequestOptions
 */

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
  'Accept-Language': 'uk-UA,uk;q=0.9',
};

const BACKOFF_BASE_MS = 2_000;
const BLOCKED_STATUSES = new Set([403, 429]);
const BLOCKED_RETRY_DELAY_MS = 10_000;

export class HttpError extends Error {
  name = 'HttpError';

  /**
   * @param {string} message
   * @param {{ url: string, status: number | null, attempts: number }} details
   */
  constructor(message, { url, status, attempts }) {
    super(message);
    this.url = url;
    this.status = status;
    this.attempts = attempts;
  }
}

/**
 * GET with timeout, browser-like headers and retries:
 * network errors, timeouts and 5xx back off 2 s, 4 s, 8 s… up to `retries` attempts;
 * 403/429 get a single retry after 10 s; other non-2xx statuses fail at once.
 *
 * @param {string} url
 * @param {RequestOptions} options
 * @returns {Promise<Response>}
 * @throws {HttpError}
 */
export async function request(url, { timeoutMs, retries, headers = {}, fetch: fetchImpl = fetch, sleep = delay }) {
  const shownUrl = redactUrl(url);
  let blockedRetryUsed = false;

  for (let attempt = 1; ; attempt++) {
    /** @type {string} */
    let failure;
    /** @type {number | null} */
    let status = null;
    /** @type {number | null} null means the failure is final */
    let retryDelayMs = BACKOFF_BASE_MS * 2 ** (attempt - 1);

    try {
      const response = await fetchImpl(url, {
        headers: { ...BROWSER_HEADERS, ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return response;
      await response.body?.cancel();

      status = response.status;
      failure = `HTTP ${status}`;
      if (BLOCKED_STATUSES.has(status)) {
        retryDelayMs = blockedRetryUsed ? null : BLOCKED_RETRY_DELAY_MS;
        blockedRetryUsed = true;
      } else if (status < 500) {
        retryDelayMs = null;
      }
    } catch (error) {
      failure = describeFetchError(error, timeoutMs);
    }

    if (retryDelayMs === null || attempt >= retries) {
      const attempts = `${attempt} attempt${attempt === 1 ? '' : 's'}`;
      throw new HttpError(`GET ${shownUrl}: ${failure} (${attempts})`, { url: shownUrl, status, attempts: attempt });
    }
    await sleep(retryDelayMs);
  }
}

/**
 * @param {string} url
 * @param {RequestOptions} options
 * @returns {Promise<unknown>}
 */
export async function getJson(url, options) {
  const response = await request(url, options);
  return response.json();
}

/**
 * @param {string} url
 * @param {RequestOptions} options
 * @returns {Promise<string>}
 */
export async function getText(url, options) {
  const response = await request(url, options);
  return response.text();
}

/**
 * Bot API URLs embed the token: https://api.telegram.org/bot<token>/method
 *
 * @param {string} url
 */
export function redactUrl(url) {
  return url.replace(/\/bot[^/]+\//, '/bot***/');
}

/**
 * @param {unknown} error
 * @param {number} timeoutMs
 */
function describeFetchError(error, timeoutMs) {
  if (!(error instanceof Error)) return String(error);
  if (error.name === 'TimeoutError') return `Timeout after ${timeoutMs}ms`;
  const cause = /** @type {{ code?: string } | undefined} */ (error.cause);
  return cause?.code ? `${error.message} (${cause.code})` : error.message;
}
