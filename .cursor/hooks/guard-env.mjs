#!/usr/bin/env node
// beforeReadFile: never let the agent read .env files (bot token); .env.example is fine.

import { basename } from 'node:path';

const input = JSON.parse(await readStdin() || '{}');
const name = basename(String(input.file_path ?? ''));

if (/^\.env(\..+)?$/.test(name) && name !== '.env.example') {
  respond({
    permission: 'deny',
    user_message: `Blocked reading ${name}: it contains secrets.`,
  });
}

respond({ permission: 'allow' });

/** @param {{ permission: 'allow' | 'deny', user_message?: string }} payload */
function respond(payload) {
  process.stdout.write(JSON.stringify(payload));
  process.exit(0);
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}
