import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** @param {string} script @param {object} input @returns {string} */
const run = (script, input) =>
  JSON.parse(
    execFileSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url))], {
      input: JSON.stringify(input),
    }).toString(),
  ).permission;

const shell = {
  allow: [
    'npm test',
    'npm run dry-run',
    'SOURCES=okko npm run dry-run',
    'DRY_RUN=true node --env-file=.env src/index.js',
    'env DRY_RUN=true node src/index.js',
    'git status && git commit -m x',
    'curl -A Mozilla https://www.okko.ua/fuel-map',
    'cat .env.example',
    'cp .env.example .env',
    'ls -la',
  ],
  ask: [
    'npm start',
    'npm run start',
    'node --env-file=.env src/index.js',
    'git push origin main',
    'curl -s https://api.telegram.org/bot123/getMe',
  ],
  deny: [
    'cat .env',
    'cat ./.env.local',
    'grep TOKEN .env',
    'cp .env /tmp/leak',
    'mv -f ./.env.local backup',
    'env',
    'printenv',
    'source .env',
  ],
};

for (const [expected, commands] of Object.entries(shell)) {
  for (const command of commands) {
    test(`shell ${expected}: ${command}`, () => {
      assert.equal(run('./guard-shell.mjs', { command }), expected);
    });
  }
}

const files = {
  allow: ['/repo/.env.example', '/repo/src/config.js', '/repo/docs/configuration.md'],
  deny: ['/repo/.env', '/repo/.env.production'],
};

for (const [expected, paths] of Object.entries(files)) {
  for (const file_path of paths) {
    test(`read ${expected}: ${file_path}`, () => {
      assert.equal(run('./guard-env.mjs', { file_path }), expected);
    });
  }
}

test('empty input is allowed', () => {
  assert.equal(run('./guard-shell.mjs', {}), 'allow');
  assert.equal(run('./guard-env.mjs', {}), 'allow');
});
