import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { ConfigError, loadConfig } from '../src/config.js';

const required = { TELEGRAM_BOT_TOKEN: '123:secret', TELEGRAM_CHANNEL_ID: '@chan' };

describe('loadConfig', () => {
  test('applies documented defaults', () => {
    const config = loadConfig(required);
    assert.deepEqual(config, {
      telegram: { botToken: '123:secret', channelId: '@chan', adminChatId: null },
      dryRun: false,
      offline: false,
      force: false,
      sources: null,
      validation: { priceMin: 20, priceMax: 200, maxDailyChangePct: 15 },
      http: { timeoutMs: 20_000, retries: 3 },
      logLevel: 'info',
      timeZone: 'Europe/Kyiv',
      runUrl: null,
    });
  });

  test('builds the GitHub Actions run link from variables GitHub sets', () => {
    const config = loadConfig({
      ...required,
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_REPOSITORY: 'me/fuel-prices-bot',
      GITHUB_RUN_ID: '123',
    });
    assert.equal(config.runUrl, 'https://github.com/me/fuel-prices-bot/actions/runs/123');
  });

  test('requires Telegram settings outside dry-run and reports all problems at once', () => {
    assert.throws(
      () => loadConfig({}),
      (error) =>
        error instanceof ConfigError &&
        error.message.includes('TELEGRAM_BOT_TOKEN is not set') &&
        error.message.includes('TELEGRAM_CHANNEL_ID is not set'),
    );
  });

  test('does not require Telegram settings in dry-run', () => {
    const config = loadConfig({ DRY_RUN: 'true' });
    assert.equal(config.dryRun, true);
    assert.equal(config.telegram.botToken, '');
  });

  test('parses booleans, numbers and the source list', () => {
    const config = loadConfig({
      ...required,
      DRY_RUN: '1',
      FORCE: 'TRUE',
      SOURCES: ' OKKO, wog ,,',
      PRICE_MIN: '25.5',
      HTTP_RETRIES: '5',
      LOG_LEVEL: 'DEBUG',
    });
    assert.equal(config.dryRun, true);
    assert.equal(config.force, true);
    assert.deepEqual(config.sources, ['okko', 'wog']);
    assert.equal(config.validation.priceMin, 25.5);
    assert.equal(config.http.retries, 5);
    assert.equal(config.logLevel, 'debug');
  });

  test('treats empty values as unset', () => {
    const config = loadConfig({ ...required, SOURCES: ' ', TELEGRAM_ADMIN_CHAT_ID: '', DRY_RUN: '' });
    assert.equal(config.sources, null);
    assert.equal(config.telegram.adminChatId, null);
    assert.equal(config.dryRun, false);
  });

  for (const [name, value] of [
    ['DRY_RUN', 'maybe'],
    ['HTTP_RETRIES', '0'],
    ['HTTP_RETRIES', '2.5'],
    ['HTTP_TIMEOUT_MS', 'abc'],
    ['PRICE_MAX', '-1'],
    ['LOG_LEVEL', 'verbose'],
    ['TZ_NAME', 'Mars/Olympus'],
  ]) {
    test(`rejects ${name}=${value}`, () => {
      assert.throws(() => loadConfig({ ...required, [name]: value }), (error) => {
        return error instanceof ConfigError && error.message.includes(name);
      });
    });
  }

  test('allows OFFLINE only together with DRY_RUN', () => {
    assert.equal(loadConfig({ DRY_RUN: 'true', OFFLINE: 'true' }).offline, true);
    assert.throws(() => loadConfig({ ...required, OFFLINE: 'true' }), /OFFLINE=true requires DRY_RUN=true/);
  });

  test('rejects PRICE_MIN not below PRICE_MAX', () => {
    assert.throws(() => loadConfig({ ...required, PRICE_MIN: '100', PRICE_MAX: '50' }), ConfigError);
  });

  test('returns a deeply frozen object', () => {
    const config = loadConfig(required);
    assert.ok(Object.isFrozen(config));
    assert.ok(Object.isFrozen(config.telegram));
    assert.ok(Object.isFrozen(config.http));
  });
});
