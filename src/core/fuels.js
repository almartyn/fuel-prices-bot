/**
 * @typedef {'a92' | 'a95' | 'a95_premium' | 'a100' | 'diesel' | 'diesel_premium' | 'lpg'} FuelCode
 */

/**
 * Display order in the post.
 *
 * @type {readonly FuelCode[]}
 */
export const FUEL_CODES = ['a92', 'a95', 'a95_premium', 'a100', 'diesel', 'diesel_premium', 'lpg'];

/** @type {Readonly<Record<FuelCode, string>>} */
export const FUEL_LABELS = {
  a92: 'А-92',
  a95: 'А-95',
  a95_premium: 'А-95+',
  a100: 'А-100',
  diesel: 'ДП',
  diesel_premium: 'ДП+',
  lpg: 'Газ',
};

/**
 * Per-source map from `rawName` to a fuel code. `null` marks a known product that is not
 * fuel (AdBlue) or is deliberately left out; it is skipped without a warning.
 * Names must match the site byte for byte: OKKO and UPG write "A-95" with a Latin A,
 * SOCAR writes "А-95" and WOG "Е10" with Cyrillic letters.
 *
 * @type {Readonly<Record<string, Readonly<Record<string, FuelCode | null>>>>}
 */
export const FUEL_MAP = {
  okko: {
    'A-95': 'a95',
    'Pulls 95': 'a95_premium',
    'Pulls 100': 'a100',
    DP: 'diesel',
    'Pulls Diesel': 'diesel_premium',
    SPBT: 'lpg',
    AdBlue: null,
  },
  wog: {
    '95 Євро5-Е10': 'a95',
    '95 Mustang Євро5-Е10': 'a95_premium',
    '100 Mustang Євро5-Е0': 'a100',
    'ДП Євро5': 'diesel',
    'ДП Mustang+': 'diesel_premium',
    'ГАЗ': 'lpg',
    AdBlue: null,
  },
  upg: {
    'A-95': 'a95',
    upg95: 'a95_premium',
    upg100: 'a100',
    'EURO DIESEL': 'diesel',
    upgDIESEL: 'diesel_premium',
    'Газ': 'lpg',
    AdBlue: null,
  },
  socar: {
    'Бензин А-95': 'a95',
    'NANO 95': 'a95_premium',
    'NANO 100': 'a100',
    'DIESEL NANO Extro': 'diesel_premium',
    // SOCAR has two premium diesels and no regular one; Extro is shown as ДП+.
    'NANO ДП': null,
    LPG: 'lpg',
    AdBlue: null,
  },
};
