import { LOG_LEVELS } from './utils/logger.js';

/** @import { LogLevel } from './utils/logger.js' */
/** @import { HttpSettings } from './types.js' */

/**
 * @typedef {object} Config
 * @property {{ botToken: string, channelId: string, adminChatId: string | null }} telegram
 *   botToken and channelId are empty strings only in dry-run mode.
 * @property {boolean} dryRun
 * @property {boolean} offline  answer HTTP from test/fixtures instead of the network; dry-run only
 * @property {boolean} force
 * @property {string[] | null} sources  null means all sources
 * @property {{ priceMin: number, priceMax: number, maxDailyChangePct: number }} validation
 * @property {HttpSettings} http
 * @property {LogLevel} logLevel
 * @property {string} timeZone
 */

export class ConfigError extends Error {
  name = 'ConfigError';
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {Readonly<Config>}
 * @throws {ConfigError} listing every invalid or missing variable
 */
export function loadConfig(env = process.env) {
  /** @type {string[]} */
  const problems = [];

  /** @param {string} name */
  const text = (name) => env[name]?.trim() || null;

  /** @param {string} name @param {boolean} fallback */
  const bool = (name, fallback) => {
    const value = text(name);
    if (value === null) return fallback;
    if (/^(true|1|yes)$/i.test(value)) return true;
    if (/^(false|0|no)$/i.test(value)) return false;
    problems.push(`${name} must be true or false, got "${value}"`);
    return fallback;
  };

  /** @param {string} name @param {number} fallback @param {{ integer?: boolean, min?: number }} [rules] */
  const number = (name, fallback, { integer = false, min = 0 } = {}) => {
    const value = text(name);
    if (value === null) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || (integer && !Number.isInteger(parsed))) {
      problems.push(`${name} must be ${integer ? 'an integer' : 'a number'} >= ${min}, got "${value}"`);
      return fallback;
    }
    return parsed;
  };

  const dryRun = bool('DRY_RUN', false);
  const offline = bool('OFFLINE', false);
  if (offline && !dryRun) problems.push('OFFLINE=true requires DRY_RUN=true');
  const botToken = text('TELEGRAM_BOT_TOKEN') ?? '';
  const channelId = text('TELEGRAM_CHANNEL_ID') ?? '';
  if (!dryRun) {
    if (!botToken) problems.push('TELEGRAM_BOT_TOKEN is not set');
    if (!channelId) problems.push('TELEGRAM_CHANNEL_ID is not set');
  }

  const sourceIds = text('SOURCES')
    ?.split(',')
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);

  const priceMin = number('PRICE_MIN', 20);
  const priceMax = number('PRICE_MAX', 200);
  if (priceMin >= priceMax) problems.push(`PRICE_MIN (${priceMin}) must be less than PRICE_MAX (${priceMax})`);

  const logLevel = /** @type {LogLevel} */ (text('LOG_LEVEL')?.toLowerCase() ?? 'info');
  if (!LOG_LEVELS.includes(logLevel)) problems.push(`LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')}, got "${logLevel}"`);

  const timeZone = text('TZ_NAME') ?? 'Europe/Kyiv';
  try {
    new Intl.DateTimeFormat('en', { timeZone });
  } catch {
    problems.push(`TZ_NAME is not a valid time zone: "${timeZone}"`);
  }

  /** @type {Config} */
  const config = {
    telegram: { botToken, channelId, adminChatId: text('TELEGRAM_ADMIN_CHAT_ID') },
    dryRun,
    offline,
    force: bool('FORCE', false),
    sources: sourceIds?.length ? sourceIds : null,
    validation: {
      priceMin,
      priceMax,
      maxDailyChangePct: number('MAX_DAILY_CHANGE_PCT', 15),
    },
    http: {
      timeoutMs: number('HTTP_TIMEOUT_MS', 20_000, { integer: true, min: 1 }),
      retries: number('HTTP_RETRIES', 3, { integer: true, min: 1 }),
    },
    logLevel,
    timeZone,
  };

  if (problems.length) throw new ConfigError(problems.join('\n'));
  return deepFreeze(config);
}

/**
 * @template {object} T
 * @param {T} value
 * @returns {Readonly<T>}
 */
function deepFreeze(value) {
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') deepFreeze(nested);
  }
  return Object.freeze(value);
}
