import { parseUah, toKopecks } from '../core/money.js';
import { getText } from '../utils/http.js';

/** @import { RawPrice, Source } from '../types.js' */

const PAGE_URL = 'https://upg.ua/cini-na-palne/';
const OBJECT_START = /var\s+obj\s*=\s*\{/;

/** @type {Source} */
export default {
  id: 'upg',
  name: 'UPG',
  url: PAGE_URL,
  async fetchPrices({ http }) {
    return parse(await getText(PAGE_URL, http));
  },
};

/**
 * The page embeds `var obj = {...};` with `data[]`: one row per region and fuel,
 * `{ RegionName: "Волинська", Title: "A-95", AveragePrice: "88.90" }`. The post has one price
 * per chain, so each fuel gets its most common regional price (the lower one on a tie).
 *
 * @param {string} html
 * @returns {RawPrice[]}
 */
export function parse(html) {
  let obj;
  try {
    obj = JSON.parse(extractObject(html));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`var obj is not valid JSON: ${error.message}`, { cause: error });
    throw error;
  }

  const rows = obj?.data;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('obj.data is missing or empty');

  /** @type {Map<string, Map<number, number>>} rawName -> price in kopecks -> regions */
  const counts = new Map();
  rows.forEach((row, index) => {
    const rawName = typeof row?.Title === 'string' ? row.Title.trim() : '';
    const price = parseUah(row?.AveragePrice);
    if (!rawName || price === null) {
      throw new Error(`obj.data[${index}] has no Title or AveragePrice: ${JSON.stringify(row)}`);
    }
    const byPrice = counts.get(rawName) ?? new Map();
    const kopecks = toKopecks(price);
    byPrice.set(kopecks, (byPrice.get(kopecks) ?? 0) + 1);
    counts.set(rawName, byPrice);
  });

  return [...counts].map(([rawName, byPrice]) => {
    const [kopecks] = [...byPrice].sort(([priceA, countA], [priceB, countB]) => countB - countA || priceA - priceB)[0];
    return { rawName, price: kopecks / 100 };
  });
}

/**
 * Cuts the `var obj = {...}` literal out of the page by matching braces outside strings.
 * The text is only ever handed to JSON.parse, never evaluated.
 *
 * @param {string} html
 */
function extractObject(html) {
  const match = OBJECT_START.exec(html);
  if (!match) throw new Error('var obj not found in the page');

  const start = match.index + match[0].length - 1;
  let depth = 0;
  let inString = false;
  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (inString) {
      if (char === '\\') i++;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth++;
    } else if (char === '}' && --depth === 0) {
      return html.slice(start, i + 1);
    }
  }
  throw new Error('var obj is not closed in the page');
}
