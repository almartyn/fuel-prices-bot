import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createTelegramClient, TelegramError } from '../src/telegram/client.js';
import { formatAdminNotice } from '../src/telegram/formatter.js';
import { fakeSource } from './helpers/fakes.js';

const TOKEN = '123456:SECRET-token';

/** @param {number} status @param {object} body */
const reply = (status, body) => new Response(JSON.stringify(body), { status });
const ok = () => reply(200, { ok: true, result: { message_id: 1 } });

/** @param {(Response | Error)[]} replies */
function fakeBotApi(replies) {
  /** @type {{ url: string, init: RequestInit | undefined }[]} */
  const calls = [];
  /** @type {number[]} */
  const delays = [];
  const client = createTelegramClient({
    botToken: TOKEN,
    timeoutMs: 1_000,
    fetch: /** @type {typeof fetch} */ (
      async (url, init) => {
        calls.push({ url: String(url), init });
        const next = replies.shift();
        if (!next) throw new Error('fakeBotApi: no more replies');
        if (next instanceof Error) throw next;
        return next;
      }
    ),
    sleep: async (ms) => void delays.push(ms),
  });
  return { client, calls, delays };
}

/**
 * @param {Promise<unknown>} promise
 * @param {RegExp} message
 */
async function rejectsWithoutToken(promise, message) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof TelegramError);
    assert.match(error.message, message);
    assert.ok(!error.message.includes('SECRET'), error.message);
    return true;
  });
}

describe('telegram client', () => {
  test('posts HTML without link previews to the chat', async () => {
    const { client, calls } = fakeBotApi([ok()]);
    await client.sendMessage('@test_channel', '<b>Ціни</b>');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `https://api.telegram.org/bot${TOKEN}/sendMessage`);
    assert.equal(calls[0].init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      chat_id: '@test_channel',
      text: '<b>Ціни</b>',
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  });

  test('waits retry_after on 429, then retries once', async () => {
    const tooMany = reply(429, { ok: false, description: 'Too Many Requests: retry after 7', parameters: { retry_after: 7 } });
    const { client, calls, delays } = fakeBotApi([tooMany, ok()]);
    await client.sendMessage('@c', 'text');
    assert.equal(calls.length, 2);
    assert.deepEqual(delays, [7_000]);
  });

  test('gives up when retry_after is unreasonably long', async () => {
    const tooMany = reply(429, { ok: false, description: 'Too Many Requests', parameters: { retry_after: 3600 } });
    const { client, calls } = fakeBotApi([tooMany]);
    await rejectsWithoutToken(client.sendMessage('@c', 'text'), /Too Many Requests/);
    assert.equal(calls.length, 1);
  });

  test('retries a 5xx once and fails if it repeats', async () => {
    const { client, calls, delays } = fakeBotApi([reply(502, { ok: false }), reply(502, { ok: false })]);
    await rejectsWithoutToken(client.sendMessage('@c', 'text'), /Telegram sendMessage: HTTP 502/);
    assert.equal(calls.length, 2);
    assert.deepEqual(delays, [2_000]);
  });

  test('does not retry other client errors', async () => {
    const { client, calls } = fakeBotApi([reply(400, { ok: false, description: 'Bad Request: chat not found' })]);
    await rejectsWithoutToken(client.sendMessage('@c', 'text'), /Bad Request: chat not found/);
    assert.equal(calls.length, 1);
  });

  test('retries a refused connection, but not a timeout that may have delivered the message', async () => {
    const refused = new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
    const first = fakeBotApi([refused, ok()]);
    await first.client.sendMessage('@c', 'text');
    assert.equal(first.calls.length, 2);

    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const second = fakeBotApi([timeout]);
    await rejectsWithoutToken(second.client.sendMessage('@c', 'text'), /Timeout after 1000ms/);
    assert.equal(second.calls.length, 1);
  });

  test('never leaks the token, even if an error message contains the URL', async () => {
    const { client } = fakeBotApi([new TypeError(`request to https://api.telegram.org/bot${TOKEN}/sendMessage failed`)]);
    await rejectsWithoutToken(client.sendMessage('@c', 'text'), /bot\*\*\*/);
  });
});

describe('formatAdminNotice', () => {
  test('follows the template in docs/error-handling.md', () => {
    const text = formatAdminNotice({
      date: '2026-09-23',
      published: true,
      errors: [
        { source: { ...fakeSource('socar', []), name: 'SOCAR' }, error: new Error('Timeout after 20000ms (3 attempts)') },
        { source: { ...fakeSource('upg', []), name: 'UPG' }, error: new Error('var obj not found in <script>') },
      ],
      rejected: [
        { stationId: 'wog', stationName: 'WOG', code: 'a95', price: 5.69, previous: 56.69, reason: '-90.0% since previous 56.69' },
      ],
      messages: [],
      runUrl: 'https://github.com/me/fuel-prices-bot/actions/runs/1',
    });
    assert.equal(
      text,
      [
        '🚨 fuel-prices-bot — 23.09.2026',
        '',
        'Опубліковано: так',
        '',
        'Не спрацювали джерела:',
        '• SOCAR: Timeout after 20000ms (3 attempts)',
        '• UPG: var obj not found in &lt;script&gt;',
        '',
        'Підозрілі ціни (пропущено):',
        '• WOG А-95: 5.69 (-90.0% since previous 56.69)',
        '',
        'Лог: https://github.com/me/fuel-prices-bot/actions/runs/1',
      ].join('\n'),
    );
  });

  test('lists other problems and omits the log line outside GitHub Actions', () => {
    const text = formatAdminNotice({
      date: '2026-09-24',
      published: false,
      errors: [],
      rejected: [],
      messages: ['Publishing failed: Telegram sendMessage: Bad Request: chat not found'],
      runUrl: null,
    });
    assert.equal(
      text,
      '🚨 fuel-prices-bot — 24.09.2026\n\nОпубліковано: ні\n\nІнші проблеми:\n• Publishing failed: Telegram sendMessage: Bad Request: chat not found',
    );
  });

  test('cuts an oversized notice instead of failing', () => {
    const text = formatAdminNotice({
      date: '2026-09-24',
      published: false,
      errors: [],
      rejected: [],
      messages: ['x'.repeat(5000)],
      runUrl: null,
    });
    assert.equal(text.length, 4096);
    assert.ok(text.endsWith('…'));
  });
});
