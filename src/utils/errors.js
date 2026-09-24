/**
 * @param {unknown} error
 * @returns {Error}
 */
export function toError(error) {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * @param {unknown} error
 * @returns {string}
 */
export function errorMessage(error) {
  return toError(error).message;
}
