import { parseUah } from '../core/money.js';
import { getJson } from '../utils/http.js';

/** @import { RawPrice, Source } from '../types.js' */

const API_URL = 'https://www.okko.ua/api/uk/fuels';
const FUEL_COMPONENT = 'Global_BulletsFuel';

/** @type {Source} */
export default {
  id: 'okko',
  name: 'OKKO',
  url: 'https://www.okko.ua/fuels',
  async fetchPrices({ http }) {
    return parse(await getJson(API_URL, http));
  },
};

/**
 * `data.layout[]` → the block whose `data.bullets.componentName` is "Global_BulletsFuel" →
 * `data.bullets.items[]`: `{ fuel_code: "A-95", price: "92.90", title: "95" }`.
 * `fuel_code` is the stable name; `title` is shared by several fuels ("95", "ДП").
 *
 * @param {unknown} body  parsed JSON from the API
 * @returns {RawPrice[]}
 */
export function parse(body) {
  const layout = /** @type {{ data?: { layout?: unknown } } | null} */ (body)?.data?.layout;
  if (!Array.isArray(layout)) throw new Error('data.layout is missing in the API response');

  const block = layout.find((element) => element?.data?.bullets?.componentName === FUEL_COMPONENT);
  if (!block) throw new Error(`data.layout[] has no block with data.bullets.componentName "${FUEL_COMPONENT}"`);

  const items = block.data.bullets.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`${FUEL_COMPONENT} data.bullets.items is missing or empty`);
  }
  return items.map((item, index) => {
    const rawName = typeof item?.fuel_code === 'string' ? item.fuel_code.trim() : '';
    const price = parseUah(item?.price);
    if (!rawName || price === null) {
      throw new Error(`${FUEL_COMPONENT} items[${index}] has no fuel_code or price: ${JSON.stringify(item)}`);
    }
    return { rawName, price };
  });
}
