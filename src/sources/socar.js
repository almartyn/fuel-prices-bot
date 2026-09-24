import { parseUah } from '../core/money.js';
import { getJson } from '../utils/http.js';

/** @import { RawPrice, Source } from '../types.js' */

const API_URL = 'https://socar.ua/api/pages/fuel';
const CARD_BLOCK = 'contentCardList';
const PRICE_TEXT = /Ціна:\s*([\d.,]+)\s*грн/;

/** @type {Source} */
export default {
  id: 'socar',
  name: 'SOCAR',
  url: 'https://socar.ua/fuel',
  async fetchPrices({ http }) {
    return parse(await getJson(API_URL, http));
  },
};

/**
 * JSON:API page: `data.attributes.blocks.data[]` → block `id: "contentCardList"` →
 * `attributes.items[]`: `{ title: { text: "NANO 95" }, price: "*Ціна: 97.9 грн/л" }`.
 * The price is marketing text, sometimes rounded to whole hryvnias ("104").
 *
 * @param {unknown} body  parsed JSON from the API
 * @returns {RawPrice[]}
 */
export function parse(body) {
  const blocks = /** @type {{ data?: { attributes?: { blocks?: { data?: unknown } } } } | null} */ (body)?.data?.attributes
    ?.blocks?.data;
  if (!Array.isArray(blocks)) throw new Error('data.attributes.blocks.data is missing in the API response');

  const block = blocks.find((candidate) => candidate?.id === CARD_BLOCK);
  const items = block?.attributes?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`block "${CARD_BLOCK}" with attributes.items is missing or empty`);
  }
  return items.map((item, index) => {
    const rawName = typeof item?.title?.text === 'string' ? item.title.text.trim() : '';
    const price = parseUah(typeof item?.price === 'string' ? PRICE_TEXT.exec(item.price)?.[1] : undefined);
    if (!rawName || price === null) {
      throw new Error(`${CARD_BLOCK} items[${index}] has no title.text or "Ціна: … грн" price: ${JSON.stringify(item)}`);
    }
    return { rawName, price };
  });
}
