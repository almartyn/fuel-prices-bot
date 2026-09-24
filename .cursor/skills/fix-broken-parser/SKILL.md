---
name: fix-broken-parser
description: Repair a fuel price parser after a site changed its layout or API. Use when a source fails in a run (admin notice, "not found" / "missing" errors, HTTP 404), when prices look wrong, or when unknown fuel names appear in the logs.
---

# Fix a broken parser

Rule of the project: no post beats a wrong post. Do not loosen checks to make a source "work".

## Steps

1. **Reproduce live**: `SOURCES=<id> npm run dry-run` (network needed). Note the exact error or the `unknown fuel` warnings.

2. **Classify**:
   - HTTP error (404, 403/429, timeout) → the URL moved or the site blocks us. Re-run the `research-source` skill for this site instead of patching the parser.
   - Shape error from `parse` → the response changed; continue below.
   - `unknown fuel "…"` warnings → a new or renamed product; only `FUEL_MAP` needs updating (step 5).

3. **Refresh the fixture**: `npm run fixtures:update -- <id>`. Look at `git diff --stat test/fixtures/` and at the new structure.

4. **Watch it fail**: `npm test`. The source's tests in `test/sources.test.js` and `test/e2e.test.js` should now fail the same way as the live run. If they pass, the fixture does not capture the problem; find out why before changing code.

5. **Fix** `parse` in `src/sources/<id>.js` (and `FUEL_MAP` in `src/core/fuels.js` for renamed fuels). Update the expected array in the source's test to the new fixture's values.

6. **Golden post**: `UPDATE_GOLDEN=1 npm test`; the diff in `test/golden/dry-run.txt` should only show this chain's new prices or fuels.

7. **Verify**: `npm run check`, then `SOURCES=<id> npm run dry-run` live.

8. **Docs**: update the source's notes in `docs/sources.md` (path, names, quirks, date of the change).

## Report back

What changed on the site, what you changed, and the before/after post lines for this chain.
