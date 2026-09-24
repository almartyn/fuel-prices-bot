import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getJson, HttpError, request } from '../src/utils/http.js';

/**
 * @param {(Response | Error)[]} replies  consumed one per call
 */
function fakeFetch(replies) {
  /** @type {{ url: string, init: RequestInit | undefined }[]} */
  const calls = [];
  const fetch = /** @type {typeof globalThis.fetch} */ (
    async (url, init) => {
      calls.push({ url: String(url), init });
      const reply = replies.shift();
      if (!reply) throw new Error('fakeFetch: no more replies');
      if (reply instanceof Error) throw reply;
      return reply;
    }
  );
  return { fetch, calls };
}

function fakeSleep() {
  /** @type {number[]} */
  const delays = [];
  return { sleep: async (/** @type {number} */ ms) => void delays.push(ms), delays };
}

/** @param {number} status */
const reply = (status, body = 'body') => new Response(body, { status });

const settings = { timeoutMs: 1_000, retries: 3 };

/**
 * @param {Promise<unknown>} promise
 * @param {RegExp} message
 */
async function rejectsWith(promise, message) {
  await assert.rejects(promise, (error) => error instanceof HttpError && message.test(error.message));
}

describe('request', () => {
  test('returns a 2xx response with browser headers and a timeout signal', async () => {
    const { fetch, calls } = fakeFetch([reply(200, 'ok')]);
    const response = await request('https://site.example/prices', { ...settings, fetch });
    assert.equal(await response.text(), 'ok');
    const headers = /** @type {Record<string, string>} */ (calls[0].init?.headers);
    assert.match(headers['User-Agent'], /Mozilla/);
    assert.equal(headers['Accept-Language'], 'uk-UA,uk;q=0.9');
    assert.ok(calls[0].init?.signal instanceof AbortSignal);
  });

  test('retries 5xx with exponential backoff and gives up after `retries` attempts', async () => {
    const { fetch, calls } = fakeFetch([reply(503), reply(502), reply(500)]);
    const { sleep, delays } = fakeSleep();
    await rejectsWith(request('https://site.example/', { ...settings, fetch, sleep }), /HTTP 500 \(3 attempts\)/);
    assert.equal(calls.length, 3);
    assert.deepEqual(delays, [2_000, 4_000]);
  });

  test('recovers when a retry succeeds', async () => {
    const { fetch } = fakeFetch([new TypeError('fetch failed'), reply(200, 'ok')]);
    const { sleep } = fakeSleep();
    const response = await request('https://site.example/', { ...settings, fetch, sleep });
    assert.equal(response.status, 200);
  });

  test('fails at once on other 4xx', async () => {
    const { fetch, calls } = fakeFetch([reply(404)]);
    await rejectsWith(request('https://site.example/', { ...settings, fetch }), /HTTP 404 \(1 attempt\)/);
    assert.equal(calls.length, 1);
  });

  for (const status of [403, 429]) {
    test(`retries ${status} once after 10 s, even when more attempts are allowed`, async () => {
      const { fetch, calls } = fakeFetch([reply(status), reply(status)]);
      const { sleep, delays } = fakeSleep();
      const options = { ...settings, retries: 5, fetch, sleep };
      await rejectsWith(request('https://site.example/', options), new RegExp(`HTTP ${status} \\(2 attempts\\)`));
      assert.equal(calls.length, 2);
      assert.deepEqual(delays, [10_000]);
    });
  }

  test('describes timeouts and network error codes', async () => {
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const network = new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
    const { fetch } = fakeFetch([timeout, network]);
    const { sleep } = fakeSleep();
    await rejectsWith(
      request('https://site.example/', { ...settings, retries: 1, fetch, sleep }),
      /Timeout after 1000ms \(1 attempt\)/,
    );
    await rejectsWith(
      request('https://site.example/', { ...settings, retries: 1, fetch, sleep }),
      /fetch failed \(ECONNRESET\)/,
    );
  });

  test('never puts a bot token into the error', async () => {
    const { fetch } = fakeFetch([reply(401)]);
    await assert.rejects(request('https://api.telegram.org/bot123:secret/sendMessage', { ...settings, fetch }), (error) => {
      assert.ok(error instanceof HttpError);
      assert.doesNotMatch(error.message, /secret/);
      assert.doesNotMatch(error.url, /secret/);
      return true;
    });
  });
});

test('getJson parses the body', async () => {
  const { fetch } = fakeFetch([new Response('{"price":9290}', { status: 200 })]);
  assert.deepEqual(await getJson('https://api.example/', { ...settings, fetch }), { price: 9290 });
});

test('global fetch is disabled in tests', async () => {
  await assert.rejects(fetch('https://www.okko.ua/'), /Network access is disabled in tests/);
});
