import { ConfigError } from '../config.js';

/** @import { Source } from '../types.js' */

/**
 * Order here is the order of chains in the post.
 *
 * @type {readonly Source[]}
 */
export const allSources = [];

/**
 * @param {string[] | null} ids  null selects every source
 * @param {readonly Source[]} [registry]
 * @returns {Source[]}
 * @throws {ConfigError} on ids missing from the registry
 */
export function selectSources(ids, registry = allSources) {
  if (!ids) return [...registry];
  const unknown = ids.filter((id) => !registry.some((source) => source.id === id));
  if (unknown.length) {
    const known = registry.map((source) => source.id).join(', ') || 'none';
    throw new ConfigError(`Unknown source(s) in SOURCES: ${unknown.join(', ')}. Known: ${known}`);
  }
  return registry.filter((source) => ids.includes(source.id));
}
