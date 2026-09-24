// Loaded via `node --import` before every test file.
globalThis.fetch = /** @type {typeof fetch} */ (
  async (input) => {
    throw new Error(`Network access is disabled in tests (${String(input)}). Inject a fake fetch instead.`);
  }
);
