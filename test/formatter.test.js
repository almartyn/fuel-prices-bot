import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { formatPost } from '../src/telegram/formatter.js';
import { fakeSource } from './helpers/fakes.js';

/** @import { Comparison, Source } from '../src/types.js' */

/** @param {string} id @param {string} name @param {string} url @returns {Source} */
const source = (id, name, url) => ({ ...fakeSource(id, []), name, url });

const okko = source('okko', 'OKKO', 'https://www.okko.ua/fuels');
const wog = source('wog', 'WOG', 'https://wog.ua/ua/fuels/');
const upg = source('upg', 'UPG', 'https://upg.ua/cini-na-palne/');
const socar = source('socar', 'SOCAR', 'https://socar.ua/fuel');

/** @type {Comparison} */
const docsExample = {
  date: '2026-09-23',
  previousDate: '2026-09-22',
  stations: [
    {
      id: 'okko',
      name: 'OKKO',
      fuels: [
        { code: 'lpg', price: 32.99, previous: 32.99, delta: 0 },
        { code: 'a95_premium', price: 59.99, previous: 59.69, delta: 0.3 },
        { code: 'a95', price: 56.99, previous: 56.69, delta: 0.3 },
        { code: 'diesel', price: 54.49, previous: 54.69, delta: -0.2 },
      ],
    },
    {
      id: 'wog',
      name: 'WOG',
      fuels: [
        { code: 'a95', price: 56.89, previous: 56.69, delta: 0.2 },
        { code: 'diesel', price: 54.39, previous: 54.49, delta: -0.1 },
      ],
    },
  ],
  averages: [
    { code: 'a95', price: 56.85, previous: 56.63, delta: 0.22, stationsCount: 2 },
    { code: 'diesel', price: 54.44, previous: 54.59, delta: -0.15, stationsCount: 2 },
  ],
};

describe('formatPost', () => {
  test('matches the template in docs/message-format.md', () => {
    const text = formatPost({
      comparison: docsExample,
      errors: [{ source: socar, error: new Error('timeout') }],
      sources: [okko, wog, upg, socar],
    });
    assert.equal(
      text,
      [
        '⛽ <b>Ціни на пальне — 23 вересня 2026</b>',
        '<i>Зміни відносно 22 вересня</i>',
        '',
        '<b>OKKO</b>',
        '<code>А-95   56.99 ▲0.30</code>',
        '<code>А-95+  59.99 ▲0.30</code>',
        '<code>ДП     54.49 ▼0.20</code>',
        '<code>Газ    32.99 =</code>',
        '',
        '<b>WOG</b>',
        '<code>А-95   56.89 ▲0.20</code>',
        '<code>ДП     54.39 ▼0.10</code>',
        '',
        '<b>Середні ціни</b>',
        '<code>А-95   56.85 ▲0.22</code>',
        '<code>ДП     54.44 ▼0.15</code>',
        '',
        '⚠️ Не вдалося отримати дані: SOCAR',
        '',
        'Джерела: okko.ua, wog.ua, upg.ua, socar.ua',
      ].join('\n'),
    );
  });

  test('without a previous snapshot shows no change line and no marks', () => {
    const text = formatPost({
      comparison: {
        date: '2026-09-24',
        previousDate: null,
        stations: [{ id: 'wog', name: 'WOG', fuels: [{ code: 'a95', price: 92.9, previous: null, delta: null }] }],
        averages: [],
      },
      errors: [],
      sources: [wog],
    });
    assert.equal(text, ['⛽ <b>Ціни на пальне — 24 вересня 2026</b>', '', '<b>WOG</b>', '<code>А-95   92.90</code>', '', 'Джерела: wog.ua'].join('\n'));
  });

  test('aligns prices of 100 UAH and more', () => {
    const text = formatPost({
      comparison: {
        date: '2026-09-24',
        previousDate: null,
        stations: [
          {
            id: 'socar',
            name: 'SOCAR',
            fuels: [
              { code: 'a100', price: 104, previous: null, delta: null },
              { code: 'a95', price: 94.9, previous: null, delta: null },
            ],
          },
        ],
        averages: [],
      },
      errors: [],
      sources: [socar],
    });
    assert.ok(text.includes('<code>А-95    94.90</code>\n<code>А-100  104.00</code>'), text);
  });

  test('shows the year of the previous date when it differs', () => {
    const text = formatPost({
      comparison: { date: '2027-01-02', previousDate: '2026-12-31', stations: [], averages: [] },
      errors: [],
      sources: [],
    });
    assert.match(text, /Зміни відносно 31 грудня 2026/);
  });

  test('escapes HTML in names that come from sites', () => {
    const text = formatPost({
      comparison: { date: '2026-09-24', previousDate: null, stations: [{ id: 'x', name: 'A&B <AZS>', fuels: [{ code: 'a95', price: 50, previous: null, delta: null }] }], averages: [] },
      errors: [],
      sources: [],
    });
    assert.match(text, /<b>A&amp;B &lt;AZS&gt;<\/b>/);
  });

  test('throws instead of truncating a post over the Telegram limit', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      id: `s${i}`,
      name: `Station ${i}`,
      fuels: [{ code: 'a95', price: 50, previous: null, delta: null }],
    }));
    assert.throws(
      () => formatPost({ comparison: { date: '2026-09-24', previousDate: null, stations: many, averages: [] }, errors: [], sources: [] }),
      /Telegram allows 4096/,
    );
  });
});
