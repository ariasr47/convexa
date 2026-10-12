#!/usr/bin/env node
// `npm run verify`: the fast local check before a push.
//   1. Nx lint, typecheck and test for the projects affected since the merge base with origin/main
//      (committed, uncommitted and untracked changes). The local Nx cache restores unchanged work.
//      The Rust project `api` runs only when a Rust path changed: its test also scans dashboard
//      sources, which would cost ~7 minutes on every dashboard edit. CI runs it on every dispatch.
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

const rustScope =
  /^(apps\/api\/|libs\/quant-engine\/|libs\/api\/src\/generated\/|Cargo\.(toml|lock)$)/;
const nxArgs = ['nx', 'affected', '-t', 'lint', 'typecheck', 'test', `--base=${base}`];
if (!changed.some((file) => rustScope.test(file))) {
  nxArgs.push('--exclude=api');
  console.log(
    '[verify] api skipped: no Rust, quant-engine, generated-client or Cargo path changed',
  );
}

console.log(`[verify] base ${base}; ${changed.length} changed file(s)`);
// The API contract gate compiles the dashboard against libs/api's built declarations and, by design,
// writes nothing itself (apps/api/tests/api_contract_gate_isolation.rs). Build them first, as CI does,
// so a change to libs/api is never checked against stale declarations.
let status = run('npx', ['tsc', '-p', 'libs/api/tsconfig.lib.json', '--pretty', 'false']);
// No .env: run tests the way CI does. A developer .env (real AI keys, live settings) changes what
// hermetic tests see; five recommendation key-resolution tests failed locally for that reason alone.
status = run('npx', nxArgs, { NX_NO_CLOUD: 'true', NX_LOAD_DOT_ENV_FILES: 'false' }) || status;

const toolScope =
  /^(tools\/|functions\/|apps\/dashboard-e2e\/tools\/|\.github\/|\.supply-chain\/|package(-lock)?\.json$)/;
if (changed.some((file) => toolScope.test(file))) {
  status = run('npm', ['run', 'test:tools']) || status;
} else {
  console.log(
    '[verify] tool specs skipped: nothing changed under tools/, functions/, .github/ or packages',
  );
}

process.exit(status);
