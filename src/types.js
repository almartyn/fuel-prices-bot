/**
 * @typedef {object} RawPrice
 * @property {string} rawName  fuel name exactly as the site writes it
 * @property {number} price    UAH per liter
 */

/**
 * @typedef {object} HttpSettings
 * @property {number} timeoutMs
 * @property {number} retries  total attempts, not extra ones
 */

/**
 * @typedef {object} SourceContext
 * @property {HttpSettings & { fetch?: typeof fetch }} http  pass as is to getJson / getText
 */

/**
 * @typedef {object} Source
 * @property {string} id
 * @property {string} name
 * @property {string} url
 * @property {(context: SourceContext) => Promise<RawPrice[]>} fetchPrices
 */

/**
 * @typedef {{ source: Source, items: RawPrice[] }} SourceResult
 * @typedef {{ source: Source, error: Error }} SourceError
 */

/**
 * @typedef {object} Station
 * @property {string} id
 * @property {string} name
 * @property {Record<string, number>} prices  fuel code -> UAH per liter
 */

/**
 * @typedef {object} Snapshot
 * @property {number} schemaVersion
 * @property {string} date  Kyiv date, YYYY-MM-DD
 * @property {string} collectedAt  ISO timestamp, UTC
 * @property {string} [postedDate]
 * @property {Station[]} stations
 * @property {string[]} failedSources
 */

/**
 * @typedef {object} RejectedPrice
 * @property {string} stationId
 * @property {string} code
 * @property {number} price
 * @property {number | null} previous
 * @property {string} reason
 */

/**
 * @typedef {object} FuelDiff
 * @property {string} code
 * @property {number} price
 * @property {number | null} previous
 * @property {number | null} delta
 */

/**
 * @typedef {object} Comparison
 * @property {string} date
 * @property {string | null} previousDate
 * @property {{ id: string, name: string, fuels: FuelDiff[] }[]} stations
 * @property {(FuelDiff & { stationsCount: number })[]} averages
 */

export {};
