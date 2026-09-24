/** @import { Comparison, SourceError, RejectedPrice } from '../types.js' */

/**
 * @typedef {object} AdminNotice
 * @property {string} date
 * @property {boolean} published
 * @property {SourceError[]} errors
 * @property {RejectedPrice[]} rejected
 * @property {string[]} messages
 */

/**
 * Stub until roadmap stage 2: plain list without the final template.
 *
 * @param {Comparison} comparison
 * @param {SourceError[]} errors
 * @returns {string}
 */
export function formatPost(comparison, errors) {
  const lines = [`⛽ Ціни на пальне — ${comparison.date}`];
  for (const station of comparison.stations) {
    lines.push('', station.name, ...station.fuels.map((fuel) => `${fuel.code} ${fuel.price.toFixed(2)}`));
  }
  if (errors.length) {
    lines.push('', `⚠️ Не вдалося отримати дані: ${errors.map(({ source }) => source.name).join(', ')}`);
  }
  return lines.join('\n');
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
