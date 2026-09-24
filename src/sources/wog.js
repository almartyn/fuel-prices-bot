import { getJson } from '../utils/http.js';

/** @import { RawPrice, Source } from '../types.js' */

const API_URL = 'https://api.wog.ua/fuel_stations';

/** @type {Source} */
export default {
  id: 'wog',
  name: 'WOG',
  url: 'https://wog.ua/ua/fuels/',
  async fetchPrices({ http }) {
    return parse(await getJson(API_URL, http));
  },
};

/**
 * `data.fuel_filters[]`: `{ name: "95", brand?: "Mustang Євро5-Е10", price: 9590 }`, price in kopecks.
 *
 * @param {unknown} body  parsed JSON from the API
 * @returns {RawPrice[]}
 */
export function parse(body) {
  const filters = /** @type {{ data?: { fuel_filters?: unknown } } | null} */ (body)?.data?.fuel_filters;
  if (!Array.isArray(filters) || filters.length === 0) {
    throw new Error('data.fuel_filters is missing or empty in the API response');
  }
  return filters.map((filter, index) => {
    const { name, brand, price } = filter ?? {};
    if (typeof name !== 'string' || !name.trim() || !Number.isInteger(price)) {
      throw new Error(`data.fuel_filters[${index}] has no name or integer price: ${JSON.stringify(filter)}`);
    }
    const rawName = typeof brand === 'string' && brand.trim() ? `${name.trim()} ${brand.trim()}` : name.trim();
    return { rawName, price: price / 100 };
  });
}
