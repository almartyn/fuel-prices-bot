/**
 * @typedef {'debug' | 'info' | 'warn' | 'error'} LogLevel
 * @typedef {Record<LogLevel, (message: string) => void>} Logger
 */

/** @type {Record<LogLevel, number>} */
const SEVERITY = { debug: 10, info: 20, warn: 30, error: 40 };

/** @type {readonly LogLevel[]} */
export const LOG_LEVELS = /** @type {LogLevel[]} */ (Object.keys(SEVERITY));

/**
 * Logs go to stderr so that stdout carries only the post in dry-run mode.
 *
 * @param {object} [options]
 * @param {LogLevel} [options.level]
 * @param {(line: string) => void} [options.write]
 * @returns {Logger}
 */
export function createLogger({ level = 'info', write = (line) => process.stderr.write(`${line}\n`) } = {}) {
  /** @param {LogLevel} lineLevel */
  const method = (lineLevel) => (/** @type {string} */ message) => {
    if (SEVERITY[lineLevel] >= SEVERITY[level]) write(`[${lineLevel}] ${message}`);
  };
  return { debug: method('debug'), info: method('info'), warn: method('warn'), error: method('error') };
}
