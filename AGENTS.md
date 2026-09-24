# AGENTS.md

Telegram bot that once a day scrapes fuel prices from Ukrainian gas station chains (OKKO, WOG, UPG, SOCAR), compares them with the previous snapshot and posts the result to a Telegram channel. Runs as a one-shot Node.js script on a GitHub Actions schedule; snapshots are stored as JSON in `data/` and committed to the repo.

**Status: design phase.** Only `docs/` exists; no code yet. Follow [docs/roadmap.md](docs/roadmap.md) for what to build next and tick its checkboxes when a step is done.

## Where to look

The design lives in `docs/` (written in Ukrainian). Read the relevant file before changing the matching area instead of guessing:

| Area | Doc |
|---|---|
| Modules, data flow, folder layout, `index.js` pseudocode | [docs/architecture.md](docs/architecture.md) |
| Parser contract, fuel name normalization, researching a site | [docs/sources.md](docs/sources.md) |
| Snapshot format, comparison algorithm, averages | [docs/storage-and-comparison.md](docs/storage-and-comparison.md) |
| Post template, Telegram HTML rules | [docs/message-format.md](docs/message-format.md) |
| Retries, partial failures, admin notifications | [docs/error-handling.md](docs/error-handling.md) |
| Env variables | [docs/configuration.md](docs/configuration.md) |
| Scripts, tests, adding a source, code style | [docs/development.md](docs/development.md) |
| GitHub Actions workflow | [docs/deployment.md](docs/deployment.md) |

## Commands

Node.js 24 (`nvm use`, version pinned in `.nvmrc`). The commands below appear with the project skeleton (roadmap stage 1):

- `npm test` — `node:test`, offline, fixtures only.
- `npm run lint` — ESLint.
- `npm run dry-run` — collect prices and print the post; publishes and saves nothing.
- `SOURCES=okko npm run dry-run` — same, for one source.

## Invariants

Do not break these without explicitly discussing it first:

- **Wrong prices are worse than no post.** Suspicious data is dropped, never published.
- **The snapshot is saved only after a successful publish.** Otherwise the next run compares against the wrong day.
- **A parser throws on failure** (page not loaded, selectors not found). It never returns an empty array.
- **Parsers return raw names** (`rawName`); mapping to fuel codes happens only in `src/core/normalize.js`.
- **Sources are isolated**: run through `Promise.allSettled`; one failing source must not stop the others.
- **Money is compared in kopecks** (`Math.round(price * 100)`), converted to UAH only for display.
- **Side effects live only in** `sources/*.fetchPrices`, `storage/`, `telegram/client.js` and `index.js`. Everything else (`parse`, `normalize`, `validate`, `compare`, `formatPost`) is a pure function.
- **Dates are Kyiv dates** (`Europe/Kyiv`), not UTC and not machine-local.
- **No extra dependencies** beyond `cheerio`, `playwright` (only if a source truly needs it) and `eslint`. Use built-in `fetch`, `node:test`, `--env-file`.

## Safety

- Never read `.env` or print the bot token. A hook blocks reading `.env`.
- Never publish to Telegram from the agent: use `DRY_RUN=true`. `npm start`, `node src/index.js` without `DRY_RUN=true`, requests to `api.telegram.org` and `git push` require the user's approval (enforced by hooks in `.cursor/hooks/`).
- Tests never hit real sites or Telegram. Live requests are allowed only while researching a source.
- Respect the sites: one request per source per run, realistic `User-Agent`, check `robots.txt`.

## Language

- `docs/` and the Telegram post: Ukrainian.
- Code, identifiers, code comments, commit messages, `AGENTS.md`, Cursor rules and skills: English.

## Definition of done

1. Lint and tests pass (once they exist).
2. `npm run dry-run` prints a correct post for the affected sources.
3. Docs are updated when behavior changes: `docs/sources.md` for sources, `docs/roadmap.md` checkboxes for finished steps.
