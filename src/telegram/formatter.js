import { FUEL_CODES, FUEL_LABELS } from '../core/fuels.js';

/** @import { Comparison, FuelDiff, RejectedPrice, Source, SourceError } from '../types.js' */
/** @import { FuelCode } from '../core/fuels.js' */

/**
 * @typedef {object} AdminNotice
 * @property {string} date
 * @property {boolean} published
 * @property {SourceError[]} errors
 * @property {RejectedPrice[]} rejected
 * @property {string[]} messages
 */

export const TELEGRAM_MESSAGE_LIMIT = 4096;

const MONTHS_GENITIVE = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
];

const LABEL_WIDTH = Math.max(...Object.values(FUEL_LABELS).map((label) => label.length)) + 2;

/**
 * Builds the channel post in Telegram HTML (template: docs/message-format.md).
 *
 * @param {object} input
 * @param {Comparison} input.comparison
 * @param {SourceError[]} input.errors
 * @param {Source[]} input.sources  every source that was queried, for the "Джерела" line
 * @returns {string}
 * @throws {Error} when the post exceeds the Telegram limit; it is never truncated silently
 */
export function formatPost({ comparison, errors, sources }) {
  const allFuels = [...comparison.stations.flatMap((station) => station.fuels), ...comparison.averages];
  const priceWidth = Math.max(0, ...allFuels.map((fuel) => fuel.price.toFixed(2).length));
  /** @param {FuelDiff[]} fuels */
  const fuelLines = (fuels) => sortFuels(fuels).map((fuel) => `<code>${fuelLine(fuel, priceWidth)}</code>`);

  const lines = [`⛽ <b>Ціни на пальне — ${humanDate(comparison.date, { year: true })}</b>`];
  if (comparison.previousDate) {
    const withYear = comparison.previousDate.slice(0, 4) !== comparison.date.slice(0, 4);
    lines.push(`<i>Зміни відносно ${humanDate(comparison.previousDate, { year: withYear })}</i>`);
  }

  for (const station of comparison.stations) {
    if (station.fuels.length) lines.push('', `<b>${escapeHtml(station.name)}</b>`, ...fuelLines(station.fuels));
  }
  if (comparison.averages.length) {
    lines.push('', '<b>Середні ціни</b>', ...fuelLines(comparison.averages));
  }
  if (errors.length) {
    lines.push('', `⚠️ Не вдалося отримати дані: ${errors.map(({ source }) => escapeHtml(source.name)).join(', ')}`);
  }
  lines.push('', `Джерела: ${sources.map((source) => escapeHtml(siteName(source.url))).join(', ')}`);

  const text = lines.join('\n');
  if (text.length > TELEGRAM_MESSAGE_LIMIT) {
    throw new Error(`Post is ${text.length} characters, Telegram allows ${TELEGRAM_MESSAGE_LIMIT}`);
  }
  return text;
}

/**
 * Stub until roadmap stage 3: plain text without the run link.
 *
 * @param {AdminNotice} notice
 * @returns {string}
 */
export function formatAdminNotice({ date, published, errors, rejected, messages }) {
  const lines = [`🚨 fuel-prices-bot — ${date}`, '', `Опубліковано: ${published ? 'так' : 'ні'}`];
  if (errors.length) {
    lines.push('Не спрацювали джерела:', ...errors.map(({ source, error }) => `• ${source.name}: ${error.message}`));
  }
  if (rejected.length) {
    lines.push(
      'Підозрілі ціни (пропущено):',
      ...rejected.map((item) => `• ${item.stationId} ${item.code}: ${item.price} (${item.reason})`),
    );
  }
  lines.push(...messages.map((message) => `• ${message}`));
  return lines.join('\n');
}

/**
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * @param {FuelDiff} fuel
 * @param {number} priceWidth
 */
function fuelLine(fuel, priceWidth) {
  const label = FUEL_LABELS[/** @type {FuelCode} */ (fuel.code)] ?? fuel.code;
  const line = `${label.padEnd(LABEL_WIDTH)}${fuel.price.toFixed(2).padStart(priceWidth)}`;
  return fuel.delta === null ? line : `${line} ${changeMark(fuel.delta)}`;
}

/** @param {number} delta */
function changeMark(delta) {
  if (Math.round(delta * 100) === 0) return '=';
  return `${delta > 0 ? '▲' : '▼'}${Math.abs(delta).toFixed(2)}`;
}

/**
 * @template {FuelDiff} T
 * @param {T[]} fuels
 * @returns {T[]}
 */
function sortFuels(fuels) {
  /** @param {string} code */
  const rank = (code) => {
    const index = FUEL_CODES.indexOf(/** @type {FuelCode} */ (code));
    return index === -1 ? FUEL_CODES.length : index;
  };
  return [...fuels].sort((a, b) => rank(a.code) - rank(b.code));
}

/**
 * @param {string} isoDate  YYYY-MM-DD
 * @param {{ year: boolean }} options
 */
function humanDate(isoDate, { year }) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d} ${MONTHS_GENITIVE[m - 1]}${year ? ` ${y}` : ''}`;
}

/** @param {string} url */
function siteName(url) {
  return new URL(url).hostname.replace(/^www\./, '');
}
