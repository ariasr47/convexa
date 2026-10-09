#!/usr/bin/env node
// `npm run verify`: the fast local check before a push.
//   1. Nx lint, typecheck and test for the projects affected since the merge base with origin/main
//      (committed, uncommitted and untracked changes). The local Nx cache restores unchanged work.
//   2. The hermetic tool specs (`npm run test:tools`), only when the change touches what they guard.
// `--base=<ref>` overrides the merge base, e.g. `npm run verify -- --base=HEAD` checks only the
// uncommitted work. CI (`.github/workflows/ci.yml`, manual dispatch) still runs the full set.
import { execFileSync, spawnSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

function mergeBase() {
  for (const ref of ['origin/main', 'main']) {
    try {
      return git('merge-base', 'HEAD', ref);
    } catch {
      // try the next ref
    }
  }
  return git('rev-parse', 'HEAD~1');
}

const baseArg = process.argv.find((arg) => arg.startsWith('--base='));
const base = baseArg ? baseArg.slice('--base='.length) : mergeBase();

const changed = [
  ...git('diff', '--name-only', base).split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n'),
].filter(Boolean);

function run(command, args, env = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[verify] ${[command, ...args].join(' ')}: exit ${result.status} in ${seconds} s`);
  return result.status ?? 1;
}

console.log(`[verify] base ${base}; ${changed.length} changed file(s)`);
let status = run('npx', ['nx', 'affected', '-t', 'lint', 'typecheck', 'test', `--base=${base}`], {
  NX_NO_CLOUD: 'true',
});

const toolScope =
  /^(tools\/|apps\/dashboard-e2e\/tools\/|\.github\/|\.supply-chain\/|package(-lock)?\.json$)/;
if (changed.some((file) => toolScope.test(file))) {
  status = run('npm', ['run', 'test:tools']) || status;
} else {
  console.log('[verify] tool specs skipped: nothing changed under tools/, .github/ or packages');
}

process.exit(status);
