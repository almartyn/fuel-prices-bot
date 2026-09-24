---
name: research-source
description: Research a gas station chain website (OKKO, WOG, UPG, SOCAR or a new one) to find how to get its fuel prices before writing a parser. Use for roadmap stage 0, when adding a new source, or when a parser broke because the site changed.
---

# Research a fuel price source

Goal: for one source, find the most stable way to get prices, save a real response as a test fixture, and record the findings in `docs/sources.md`. No parser code in this step.

Live requests are expected here, so the sandbox needs full network access. One source per session is fine; do not hammer the site (a handful of requests in total).

## Steps

1. **Rules of the site.** Fetch `<site>/robots.txt`. Note whether the price page path is disallowed and whether the terms of use forbid automated access. If it is forbidden, stop and tell the user.

2. **Find the price page.** Locate the page that lists current prices (often "Ціни на пальне", "Fuel prices", a station map). Record its exact URL.

3. **Pick the method, most stable first.** Check in this order and stop at the first that works:
   1. **Internal JSON API.** Look for XHR/fetch endpoints returning prices: search the page HTML and JS bundles for `api`, `price`, `fuel`, `graphql`; ask the user to check DevTools → Network → Fetch/XHR if nothing is found statically.
   2. **Prices in server HTML.** `curl -sL -A "Mozilla/5.0" -H "Accept-Language: uk-UA,uk;q=0.9" <url>` and search for a price visible on the page (e.g. `56.99` or `56,99`). If found, `fetch` + `cheerio` is enough.
   3. **JSON inside `<script>`**: `__NEXT_DATA__`, `__NUXT__`, `window.__INITIAL_STATE__`, `application/ld+json`.
   4. **Rendered by JavaScript only** → `playwright`. Last resort: it adds a heavy dependency and 30–60 s per CI run. Confirm with the user before choosing it.

4. **Check the data shape.**
   - Are prices national or per region/station? If per station, how to get one representative value (the post shows one price per fuel per chain).
   - Exact fuel names as the site writes them (`rawName`), including premium brands (PULLS, Mustang, Energy…). Map each to a code from the normalization table in `docs/sources.md` (`a92`, `a95`, `a95_premium`, `a100`, `diesel`, `diesel_premium`, `lpg`) or flag it as unknown.
   - Price format: decimal separator, currency suffix, per-liter vs. per-unit.
   - Required headers, cookies, redirects, anti-bot protection (403/429, Cloudflare challenge).

5. **Save a fixture.** Store the exact response the parser will consume in `test/fixtures/<id>.html` or `test/fixtures/<id>.json` (`<id>` is the lowercase source id: `okko`, `wog`, `upg`, `socar`). Keep the raw response, do not prettify or trim it, so the parser test sees what production sees. If the response is huge (>1 MB), ask the user before committing it.

6. **Record findings** in `docs/sources.md` (in Ukrainian, like the rest of `docs/`):
   - the source's row in the "Перелік джерел" table: method and status `досліджено`;
   - its "Нотатки по джерелах" section: URL, method, selectors or JSON path, peculiarities;
   - new fuel names in the normalization table if the site uses names not listed there.

7. **Update the roadmap.** Tick the stage 0 items in `docs/roadmap.md` only when all four sources are done; otherwise leave them and mention progress to the user.

## Report back

Tell the user in a few sentences: chosen method and why, fuel names found and their codes, anything risky (anti-bot, per-region prices, Playwright needed), and the files changed.
