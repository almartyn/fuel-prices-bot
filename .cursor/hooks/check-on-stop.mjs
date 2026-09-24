#!/usr/bin/env node
// stop: run `npm run check` when the agent finishes; on failure send the output back so it keeps fixing.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const MAX_OUTPUT_CHARS = 6_000;

const input = JSON.parse((await readStdin()) || '{}');
if (input.status !== 'completed' || !existsSync('node_modules')) respond({});

// Hooks do not inherit the interactive shell, so load the Node version from .nvmrc when nvm is present.
const script = [
  'if [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1; nvm use >/dev/null 2>&1; fi',
  'npm run -s check 2>&1',
].join('\n');
const result = spawnSync('bash', ['-c', script], { encoding: 'utf8', timeout: 150_000 });

if (result.status === 0) respond({});

const output = filterOutput(`${result.stdout ?? ''}${result.error ? `\n${result.error.message}` : ''}`);
respond({
  followup_message: [
    '`npm run check` failed after your changes. Fix the cause (do not weaken tests or lint rules), then finish again.',
    '',
    '```',
    output.length > MAX_OUTPUT_CHARS ? `…${output.slice(-MAX_OUTPUT_CHARS)}` : output,
    '```',
  ].join('\n'),
});

/** @param {string} text */
function filterOutput(text) {
  return text
    .split('\n')
    .filter((line) => !/^\s*✔ |Unknown env config "devdir"/.test(line))
    .join('\n')
    .trim();
}

/** @param {{ followup_message?: string }} payload */
function respond(payload) {
  process.stdout.write(JSON.stringify(payload));
  process.exit(0);
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}
