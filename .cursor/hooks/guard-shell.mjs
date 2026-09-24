#!/usr/bin/env node
// beforeShellExecution: deny reading .env, ask before anything that can publish or push.

const ENV_READ = /\b(cat|less|more|head|tail|bat|grep|rg|sed|awk|strings|xxd|od|base64)\b[^|;&]*(^|[\s'"/=])\.env(?!\.example)(\.[\w-]+)?(?=$|[\s'";|&])/;
const ENV_COPY = /\b(cp|mv|scp|rsync)\s+(-\S+\s+)*\S*\.env(?!\.example)(\.[\w-]+)?\s/;
const ENV_DUMP = /(^|[;&|]\s*)(env|printenv)\s*($|[;&|])|\bsource\s+\S*\.env\b|(^|\s)\.\s+\S*\.env\b/;

const ASK_RULES = [
  { re: /\bgit\s+push\b/, why: 'git push' },
  { re: /api\.telegram\.org/, why: 'a direct request to the Telegram Bot API' },
  { re: /\bnpm\s+(run\s+)?start\b/, why: '`npm start` publishes to the channel' },
];

const input = JSON.parse(await readStdin() || '{}');
const command = String(input.command ?? '');

if (ENV_READ.test(command) || ENV_COPY.test(command) || ENV_DUMP.test(command)) {
  respond({
    permission: 'deny',
    user_message: 'Blocked: the command would expose .env or environment secrets.',
    agent_message: 'Reading .env or dumping the environment is forbidden in this project. Use .env.example to learn variable names.',
  });
}

for (const { re, why } of ASK_RULES) {
  if (re.test(command)) ask(why);
}

if (/\bsrc\/index\.js\b/.test(command) && !/\bDRY_RUN=(true|1)\b/.test(command)) {
  ask('running src/index.js without DRY_RUN=true publishes to the channel');
}

respond({ permission: 'allow' });

/** @param {string} why */
function ask(why) {
  respond({
    permission: 'ask',
    user_message: `Review: ${why}.`,
    agent_message: `This command needs the user's approval: ${why}. Prefer DRY_RUN=true or ask the user first.`,
  });
}

/** @param {{ permission: 'allow' | 'ask' | 'deny', user_message?: string, agent_message?: string }} payload */
function respond(payload) {
  process.stdout.write(JSON.stringify(payload));
  process.exit(0);
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}
