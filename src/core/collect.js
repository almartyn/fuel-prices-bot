import { toError } from '../utils/errors.js';

/** @import { Source, SourceContext, SourceResult, SourceError } from '../types.js' */
/** @import { Logger } from '../utils/logger.js' */

/**
 * Runs every parser in parallel; one failing source never stops the others.
 *
 * @param {Source[]} sources
 * @param {SourceContext} context
 * @param {Logger} log
 * @returns {Promise<{ results: SourceResult[], errors: SourceError[] }>}
 */
export async function collectAll(sources, context, log) {
  const settled = await Promise.allSettled(
    sources.map(async (source) => {
      const startedAt = performance.now();
      const items = await source.fetchPrices(context);
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('parser returned no prices; it must throw instead');
      }
      log.info(`${source.id}: ${items.length} prices in ${Math.round(performance.now() - startedAt)}ms`);
      log.debug(`${source.id}: ${JSON.stringify(items)}`);
      return items;
    }),
  );

  /** @type {SourceResult[]} */
  const results = [];
  /** @type {SourceError[]} */
  const errors = [];
  settled.forEach((outcome, index) => {
    const source = sources[index];
    if (outcome.status === 'fulfilled') {
      results.push({ source, items: outcome.value });
    } else {
      const error = toError(outcome.reason);
      log.warn(`${source.id}: ${error.message}`);
      errors.push({ source, error });
    }
  });
  return { results, errors };
}
