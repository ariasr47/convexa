#!/usr/bin/env node
// `npm run verify`: the fast local check before a push.
//   1. Nx lint, typecheck and test for the projects affected since the merge base with origin/main
//      (committed, uncommitted and untracked changes). The local Nx cache restores unchanged work.
//      The Rust project `api` runs only when a Rust path changed: its test also scans dashboard
//      sources, which would cost ~7 minutes on every dashboard edit. CI runs it on every dispatch.
//   2. The hermetic tool specs (`npm run test:tools`) and the research notes' filing check
//      (tools/research-notes/check-filings.mjs), only when the change touches what they guard.
//   3. The contract check's place in the task graph, only when a project.json, package.json or
//      nx.json changed (checkContractGateWiring below).
// `--base=<ref>` overrides the merge base, e.g. `npm run verify -- --base=HEAD` checks only the
// uncommitted work. `--task-graph` runs check 3 alone. CI (`.github/workflows/ci.yml`, manual
// dispatch) still runs the full set.
import { execFileSync, spawnSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

// Nothing here calls `tools/api-contract.mjs check` directly: it runs only as the Nx task
// api:api-contract-check, through the dependsOn edges in apps/api/project.json and
// libs/api/package.json. A config edit that drops an edge, or caches the task (a cached pass
// replays an old result), would stop the check without failing anything. So read the resolved task
// graph and fail unless each gated task still reaches the check and the check is uncached.
const CONTRACT_CHECK = 'api:api-contract-check';
const GATED_TASKS = ['api:test', '@convexa/api:typecheck', '@convexa/api:test'];

function checkContractGateWiring() {
  const started = Date.now();
  const args = ['nx', 'run-many', '-t', 'typecheck', 'test', '-p', 'api,@convexa/api'];
  const result = spawnSync('npx', [...args, '--graph=stdout'], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, NX_NO_CLOUD: 'true' },
  });
  const problems = [];
  let graph = null;
  if (result.status !== 0) {
    problems.push(`npx ${args.join(' ')} --graph=stdout exited ${result.status}\n${result.stderr}`);
  } else {
    try {
      graph = JSON.parse(result.stdout.slice(result.stdout.indexOf('{'))).tasks;
    } catch (error) {
      problems.push(`the task graph is not JSON (${error.message})`);
    }
  }
  if (graph) {
    const dependencies = graph.dependencies ?? {};
    const reaches = (task, seen = new Set([task])) =>
      (dependencies[task] ?? []).some(
        (next) =>
          next === CONTRACT_CHECK || (!seen.has(next) && seen.add(next) && reaches(next, seen)),
      );
    for (const task of GATED_TASKS) {
      if (!graph.tasks?.[task]) problems.push(`${task} is not in the task graph`);
      else if (!reaches(task)) problems.push(`${task} no longer depends on ${CONTRACT_CHECK}`);
    }
    const check = graph.tasks?.[CONTRACT_CHECK];
    if (!check) problems.push(`${CONTRACT_CHECK} is not in the task graph`);
    else if (check.cache !== false)
      problems.push(`${CONTRACT_CHECK} is cached (cache: ${check.cache})`);
  }
  for (const problem of problems) console.log(`[verify] task graph: ${problem}`);
  const status = problems.length ? 1 : 0;
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `[verify] task graph: ${GATED_TASKS.join(', ')} depend on ${CONTRACT_CHECK}, uncached: exit ${status} in ${seconds} s`,
  );
  return status;
}

if (process.argv.includes('--task-graph')) process.exit(checkContractGateWiring());

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
// writes nothing itself. Build them first, as CI does, so a change to libs/api is never checked
// against stale declarations.
let status = run('npx', ['tsc', '-p', 'libs/api/tsconfig.lib.json', '--pretty', 'false']);
// Secrets (audit 2026-10-15, W-A01): the commits since the base, with the repo's .gitleaks.toml and
// .gitleaksignore. The pre-push hook runs the same scan; with Actions off these are the only two.
const gitleaks = spawnSync('gitleaks', ['version'], { stdio: 'ignore' });
if (gitleaks.status === 0) {
  status =
    run('gitleaks', ['git', '--no-banner', '--redact', `--log-opts=${base}..HEAD`, '.']) || status;
} else {
  console.log('[verify] gitleaks is not installed (brew install gitleaks): secret scan FAILED');
  status = 1;
}
// A dependsOn or cache flag lives in a project.json, a package.json "nx" block or nx.json.
if (changed.some((file) => /(^|\/)(project|package)\.json$|^nx\.json$/.test(file))) {
  status = checkContractGateWiring() || status;
} else {
  console.log(
    '[verify] task graph check skipped: no project.json, package.json or nx.json changed',
  );
}
// No .env: run tests the way CI does. A developer .env (real AI keys, live settings) changes what
// hermetic tests see; five recommendation key-resolution tests failed locally for that reason alone.
status = run('npx', nxArgs, { NX_NO_CLOUD: 'true', NX_LOAD_DOT_ENV_FILES: 'false' }) || status;

const toolScope =
  /^(tools\/|functions\/|research\/|apps\/dashboard-e2e\/tools\/|\.github\/|\.supply-chain\/|package(-lock)?\.json$)/;
if (changed.some((file) => toolScope.test(file))) {
  status = run('npm', ['run', 'test:tools']) || status;
  // Figures against the filing: each note figure that names an XBRL concept, against the company facts
  // saved under research/_filings (never fetched here). Exits 1 on an unexplained difference.
  status = run('node', ['tools/research-notes/check-filings.mjs']) || status;
} else {
  console.log(
    '[verify] tool specs and filing check skipped: nothing under tools/, functions/, research/, .github/ or packages',
  );
}

process.exit(status);
