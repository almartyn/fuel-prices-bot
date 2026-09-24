---
name: add-fuel-source
description: Implement a parser for a gas station chain and wire it into the bot (OKKO, UPG, SOCAR or a new chain). Use for roadmap stages 2 and 5 or whenever the user asks to add or implement a source.
---

# Add a fuel price source

Prerequisite: the site is researched (`docs/sources.md` has its notes and `test/fixtures/manifest.json` its entry). If not, run the `research-source` skill first.

## Steps

1. **Read** the source's notes in `docs/sources.md` and look at its fixture. Use `src/sources/wog.js` as the model; the rule in `.cursor/rules/sources.mdc` lists the contract.

2. **Write `src/sources/<id>.js`**: default export `{ id, name, url, fetchPrices }` and a named pure `parse(body)`.
   - JSON API: `parse(await getJson(API_URL, http))`. JSON in HTML: `getText`, cut the object out of the script text and `JSON.parse` it; never `eval` or `vm`.
   - `API_URL` must be exactly the manifest URL.
   - Throw with the missing path when the shape is wrong.

3. **Map fuel names** in `FUEL_MAP` in `src/core/fuels.js`. Print the `rawName`s from the fixture with their code points first, to catch Cyrillic/Latin look-alikes:
   ```bash
   ID=<id> FILE=test/fixtures/<file> node --input-type=module -e '
   const { parse } = await import(`./src/sources/${process.env.ID}.js`);
   const raw = (await import("node:fs")).readFileSync(process.env.FILE, "utf8");
   for (const item of parse(process.env.FILE.endsWith(".json") ? JSON.parse(raw) : raw)) {
     const nonAscii = [...item.rawName].filter((c) => c > "\x7f").map((c) => `${c}=U+${c.codePointAt(0).toString(16)}`);
     console.log(JSON.stringify(item), nonAscii.join(" "));
   }'
   ```
   Every name gets a code or `null` (not fuel, or deliberately skipped, with a comment why).

4. **Register** it in `src/sources/index.js`, keeping the order OKKO, WOG, UPG, SOCAR.

5. **Test** in `test/sources.test.js`, in a `describe('<id>')` block like `wog`:
   - `parse` on the fixture returns the exact expected array;
   - every fixture name is in `FUEL_MAP.<id>`;
   - `parse` throws on a changed shape (missing key, wrong type).

6. **Update the golden post**: `UPDATE_GOLDEN=1 npm test`, then check `git diff test/golden/dry-run.txt` shows only the new chain, in the right place, with the prices from the fixture.

7. **Verify**: `npm run check`, then `SOURCES=<id> npm run dry-run` against the live site (network needed). Compare a couple of prices with the site.

8. **Docs**: in `docs/sources.md` set the status to `реалізовано` and fix any notes that turned out wrong; tick the matching item in `docs/roadmap.md`.

## Report back

The chain's fuels and prices as they appear in the post, anything skipped and why, and anything in the data that looked off.
