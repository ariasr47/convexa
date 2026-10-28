#!/usr/bin/env node
// `npm run verify`: the fast local check before a push.
//   1. Nx lint, typecheck and test for the projects the changes reach since the merge base with
//      origin/main (committed, uncommitted and untracked): the projects Nx's affected graph names,
//      plus each project whose test target lists a changed file among its inputs (planProjects).
//      So a test that reads a file outside its project lists that file in its test inputs, and
//      then both its cache key and this check follow the file. The local Nx cache restores
//      unchanged work. A project in CACHE_ONLY_INPUTS runs only when another of its test inputs
//      changed: the Rust project `api` also scans dashboard sources, and its run costs ~7 minutes.
//   2. The hermetic tool specs (`npm run test:tools`) and the research notes' filing check
//      (tools/research-notes/check-filings.mjs), only when the change touches what they guard.
//   3. The contract check's place in the task graph and the command it runs, only when a
//      project.json, package.json, nx.json or this file changed (checkContractGateWiring below).
// `--base=<ref>` overrides the merge base, e.g. `npm run verify -- --base=HEAD` checks only the
// uncommitted work. `--task-graph` runs check 3 alone. `--plan` prints what verify would run, down
// to check 1's Nx tasks, and runs nothing; `--plan --files=a,b` plans for those files instead.
// CI is off (CLAUDE.md, CI mode); `.github/workflows/ci.yml` keeps the full set it ran.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

// Nothing here calls `tools/api-contract.mjs check` directly: it runs only as the Nx task
// api:api-contract-check, through the dependsOn edges in apps/api/project.json and
// libs/api/package.json. A config edit that drops an edge, caches the task (a cached pass replays
// an old result), or changes what the task runs (a no-op, the writing `generate`, or `args` and
// configurations, which nx:run-commands appends to or swaps for the command) would stop the check
// without failing anything. So read the resolved task and project graphs and fail unless each
// gated task still reaches the check, the check is uncached and runs exactly CONTRACT_COMMAND, and
// no task in the graph runs the generator.
const CONTRACT_CHECK = 'api:api-contract-check';
const CONTRACT_COMMAND = 'node tools/api-contract.mjs check';
const GENERATOR = /api-contract\.mjs\s+generate|api:contract:generate/;
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
  let projects = {};
  if (result.status !== 0) {
    problems.push(`npx ${args.join(' ')} --graph=stdout exited ${result.status}\n${result.stderr}`);
  } else {
    try {
      const parsed = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
      graph = parsed.tasks;
      projects = parsed.graph?.nodes ?? {};
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
    const targetOf = ({ target }) => projects[target.project]?.data?.targets?.[target.target];
    const runs = check && targetOf(check);
    if (check && !runs) problems.push(`${CONTRACT_CHECK} has no target in the project graph`);
    else if (runs) {
      if (runs.executor !== 'nx:run-commands')
        problems.push(`${CONTRACT_CHECK} uses ${runs.executor}, not nx:run-commands`);
      if (runs.options?.command !== CONTRACT_COMMAND)
        problems.push(
          `${CONTRACT_CHECK} runs ${JSON.stringify(runs.options?.command ?? runs.options?.commands)}, not "${CONTRACT_COMMAND}"`,
        );
      const extra = Object.keys(runs.options ?? {}).filter(
        (key) => !['command', 'cwd'].includes(key),
      );
      if (extra.length)
        problems.push(`${CONTRACT_CHECK} has options beyond command and cwd: ${extra.join(', ')}`);
      const configurations = Object.keys(runs.configurations ?? {});
      if (configurations.length)
        problems.push(`${CONTRACT_CHECK} has configurations: ${configurations.join(', ')}`);
    }
    for (const [id, task] of Object.entries(graph.tasks ?? {})) {
      const target = targetOf(task);
      const text = JSON.stringify([target?.options, target?.configurations]);
      if (GENERATOR.test(text)) problems.push(`${id} runs the contract generator`);
    }
  }
  for (const problem of problems) console.log(`[verify] task graph: ${problem}`);
  const status = problems.length ? 1 : 0;
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `[verify] task graph: ${GATED_TASKS.join(', ')} depend on ${CONTRACT_CHECK}, uncached, running "${CONTRACT_COMMAND}": exit ${status} in ${seconds} s`,
  );
  return status;
}

const TARGETS = ['lint', 'typecheck', 'test'];

// Test inputs that key a project's cache but do not schedule its test here. A project listed here
// runs only when another of its test inputs changed, whatever Nx's affected graph says (Nx names a
// project when a {workspaceRoot} input of any of its targets changes). api:test scans the dashboard
// sources (apps/api/tests/capacity_baseline_isolation.rs), so a dashboard edit must miss its cache,
// but cargo test would add ~7 minutes to every dashboard edit. It runs with the next change to
// another api:test input, or by hand: `npx nx test api`. A dashboard file that a Rust test compiles
// in is its own api:test input, so verify runs api when it changes: apps/dashboard/src/app/shared/
// dataState/vocabulary.ts (include_str! in apps/api/src/services/analyst/package.rs), where a moved
// file or a dropped DataStateKey fails cargo test. planProjects fails when an entry here is not one
// of the project's test inputs, spelled the same way, or when the project has dependency inputs,
// which a dependency-only change would then hold back.
const CACHE_ONLY_INPUTS = { api: ['{workspaceRoot}/apps/dashboard/src/**/*'] };

// Nx hashes dotfiles under `**` (apps/api/.env.example is an api:test input), but a wildcard in
// path.matchesGlob skips a name that starts with a dot. So a leading dot becomes a private-use
// character, in the path and the pattern alike: a wildcard then matches it, and a literal `.spire`
// still matches `.spire`.
const LEADING_DOT = /(^|[/{,(|])\./g;
const undot = (text) => text.replace(LEADING_DOT, '$1\uE000');
const matchesInput = (file, pattern) => posix.matchesGlob(undot(file), undot(pattern));

// Inputs that name no file: they key the cache, but no changed file can match them.
const NOT_FILES = ['runtime', 'env', 'externalDependencies', 'workingDirectory'];
// Nx's inputs for a target that lists none (DEFAULT_INPUTS in nx/dist/src/hasher/task-hasher.js).
const NX_DEFAULT_INPUTS = [{ input: 'default' }, { input: 'default', dependencies: true }];

// A project's test inputs, read as Nx's task hasher reads them (nx/dist/src/hasher/task-hasher.js):
// `patterns`, each workspace-relative file pattern with the input it came from, and `dependencies`,
// the dependency inputs (`^name`, `dependencies: true`). Named inputs expand, and `{input,
// projects}` reads another project's named input. Dependency inputs are left to Nx's affected
// graph, which names a project when one of its dependencies changes. An exclusion (`!pattern`) is
// left out: it can only widen the match. Any other input fails the plan rather than drop out
// silently. One such is `dependentTasksOutputFiles`, the outputs of the tasks this one depends on: a
// task linked only by dependsOn (as @convexa/api:test reaches api:api-contract-check) is in neither
// the project graph nor Nx's affected list, so a change there would schedule nothing.
function testInputs(project, nodes, namedInputs = {}) {
  const patterns = [];
  const dependencies = [];
  const expand = (name, inputs, seen) => {
    const node = nodes[name];
    if (!node) throw new Error(`a test input names project "${name}", not in the project graph`);
    const named = { default: ['{projectRoot}/**/*'], ...namedInputs, ...node.data.namedInputs };
    const file = (input) => {
      if (input.startsWith('!')) return;
      const pattern = input
        .replaceAll('{projectRoot}', node.data.root)
        .replaceAll('{projectName}', name)
        .replace(/^\{workspaceRoot\}\//, '')
        .replace(/^\.\//, '');
      patterns.push({ input, pattern });
    };
    for (const input of inputs) {
      if (typeof input === 'string') {
        if (input.startsWith('^')) dependencies.push(input);
        else if (!Object.hasOwn(named, input)) file(input);
        else if (!seen.has(`${name}:${input}`))
          expand(name, named[input], new Set(seen).add(`${name}:${input}`));
      } else if (input.dependencies || input.projects === 'dependencies') {
        dependencies.push(input);
      } else if (typeof input.fileset === 'string') {
        file(input.fileset);
      } else if (typeof input.json === 'string') {
        file(input.json);
      } else if (typeof input.input === 'string') {
        const owners = input.projects && input.projects !== 'self' ? [input.projects] : [name];
        for (const owner of owners.flat()) expand(owner, [input.input], seen);
      } else if (!NOT_FILES.some((key) => Object.hasOwn(input, key))) {
        throw new Error(
          `${project}:test has an input verify cannot plan for: ${JSON.stringify(input)}`,
        );
      }
    }
  };
  expand(project, nodes[project].data.targets.test.inputs ?? NX_DEFAULT_INPUTS, new Set());
  return { patterns, dependencies };
}

// What check 1 lints, typechecks and tests, given `affected`, Nx's affected projects for the same
// changes. Returns the projects to run, the changed test inputs that brought each project in, the
// CACHE_ONLY_INPUTS projects held back, and the Nx command. It names projects exactly: `nx affected
// --exclude=api` dropped @convexa/api whenever api itself was not affected, because Nx then matches
// "api" as a word inside other project names (nx/dist/src/utils/find-matching-projects.js:114-126).
export function planProjects({
  changed,
  nodes,
  namedInputs,
  affected,
  cacheOnly = CACHE_ONLY_INPUTS,
}) {
  const inputs = {};
  for (const [name, node] of Object.entries(nodes)) {
    if (node.data.targets?.test) inputs[name] = testInputs(name, nodes, namedInputs);
  }
  // A held input that no longer matches the project's own spelling holds nothing, and a project
  // with dependency inputs can change through a dependency alone, which no own input would show.
  for (const [name, held] of Object.entries(cacheOnly)) {
    if (!inputs[name]) {
      throw new Error(`CACHE_ONLY_INPUTS names ${name}, which has no test target in the graph`);
    }
    const own = new Set(inputs[name].patterns.map(({ input }) => input));
    const missing = held.filter((input) => !own.has(input));
    if (missing.length) {
      throw new Error(
        `CACHE_ONLY_INPUTS holds ${missing.join(', ')} for ${name}, but ${name}:test has no input spelled that way`,
      );
    }
    if (inputs[name].dependencies.length) {
      throw new Error(
        `CACHE_ONLY_INPUTS holds ${name}, but ${name}:test has dependency inputs (${JSON.stringify(inputs[name].dependencies)}): a change to a dependency alone would skip it`,
      );
    }
  }
  const scheduled = {};
  for (const [name, { patterns }] of Object.entries(inputs)) {
    const skip = new Set(cacheOnly[name]);
    const own = patterns.filter(({ input }) => !skip.has(input));
    for (const file of changed) {
      const hit = own.find(({ pattern }) => matchesInput(file, pattern));
      if (hit) (scheduled[name] ??= []).push({ file, input: hit.input });
    }
  }
  const held = (name) => Object.hasOwn(cacheOnly, name) && !scheduled[name];
  const run = [...new Set([...affected, ...Object.keys(scheduled)])]
    .filter((name) => !held(name))
    .filter((name) => !nodes[name] || TARGETS.some((target) => nodes[name].data.targets?.[target]))
    .sort();
  const skipped = Object.keys(cacheOnly).filter((name) => nodes[name] && held(name));
  const args = run.length ? ['nx', 'run-many', '-t', ...TARGETS, '-p', run.join(',')] : null;
  return { affected, run, scheduled, skipped, args };
}

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

function run(command, args, env = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[verify] ${[command, ...args].join(' ')}: exit ${result.status} in ${seconds} s`);
  return result.status ?? 1;
}

// The files a change touches since `base`: committed, staged, unstaged and untracked, as paths
// relative to the repository root (run it there). --no-renames, as Nx's own diff: a moved file
// counts at both its old and its new path. -z prints each path as it is; without it, git quotes a
// path with non-ASCII bytes ("apps/caf\303\251.tsx", quotes included), which matches no input.
export function changedFiles(base, cwd = process.cwd()) {
  const paths = (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\0')
      .filter(Boolean);
  return [
    ...paths('diff', '--name-only', '--no-renames', '-z', base),
    ...paths('ls-files', '--others', '--exclude-standard', '-z'),
  ];
}

// Nx runs its own `git diff` for the affected list and splits it on newlines, so it misses a quoted
// path the same way (nx/dist/src/utils/command-line-utils.js:245-251). git reads core.quotePath from
// the environment too (GIT_CONFIG_COUNT, git 2.31 or later); this adds it after any set already.
function unquotedGitPaths(env) {
  const count = Number.parseInt(env.GIT_CONFIG_COUNT ?? '0', 10) || 0;
  return {
    ...env,
    GIT_CONFIG_COUNT: String(count + 1),
    [`GIT_CONFIG_KEY_${count}`]: 'core.quotePath',
    [`GIT_CONFIG_VALUE_${count}`]: 'false',
  };
}

// The JSON an Nx command prints, from its first `open` character on (Nx may print notes first).
function jsonFromNx(args, open, input) {
  const result = spawnSync('npx', args, {
    encoding: 'utf8',
    input,
    maxBuffer: 256 * 1024 * 1024,
    env: unquotedGitPaths({ ...process.env, NX_NO_CLOUD: 'true' }),
  });
  if (result.status !== 0) {
    throw new Error(`npx ${args.join(' ')} exited ${result.status}\n${result.stderr}`);
  }
  return JSON.parse(result.stdout.slice(result.stdout.indexOf(open)));
}

const nxJsonNamedInputs = () =>
  JSON.parse(readFileSync(new URL('../nx.json', import.meta.url), 'utf8')).namedInputs;

// The plan for `changed`: the project graph and Nx's affected projects, read through `nx` (an Nx
// command's args, the JSON's first character, stdin), then planProjects. With `files`, `changed`
// came from --files and Nx reads that list on stdin; otherwise Nx diffs against `base` itself.
export function planChanges(
  changed,
  { base, files = false, nx = jsonFromNx, namedInputs = nxJsonNamedInputs() },
) {
  const affectedArgs = ['nx', 'show', 'projects', '--affected', '--json'];
  return planProjects({
    changed,
    nodes: nx(['nx', 'graph', '--print'], '{').graph.nodes,
    namedInputs,
    affected: !changed.length
      ? []
      : files
        ? nx([...affectedArgs, '--stdin'], '[', changed.join('\n'))
        : nx([...affectedArgs, `--base=${base}`], '['),
  });
}

function printPlan({ affected, run, scheduled, skipped }) {
  console.log(`[verify] Nx affected: ${affected.join(', ') || 'none'}`);
  for (const [name, hits] of Object.entries(scheduled)) {
    const shown = hits.slice(0, 3).map(({ file, input }) => `${file} (${input})`);
    if (hits.length > 3) shown.push(`${hits.length - 3} more`);
    console.log(`[verify] ${name}:test inputs changed: ${shown.join(', ')}`);
  }
  for (const name of skipped) {
    const inputs = CACHE_ONLY_INPUTS[name].join(', ');
    console.log(
      `[verify] ${name} skipped: no ${name}:test input changed (cache-only ones do not count: ${inputs})`,
    );
  }
  console.log(`[verify] lint, typecheck and test: ${run.join(', ') || 'nothing'}`);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--task-graph')) process.exit(checkContractGateWiring());
  const planOnly = argv.includes('--plan');
  const filesArg = argv.find((arg) => arg.startsWith('--files='));
  if (filesArg && !planOnly) {
    console.log('[verify] --files works only with --plan: verify checks the real changes');
    process.exit(2);
  }
  const baseArg = argv.find((arg) => arg.startsWith('--base='));
  const base = filesArg ? null : baseArg ? baseArg.slice('--base='.length) : mergeBase();
  const changed = filesArg
    ? filesArg.slice('--files='.length).split(',').filter(Boolean)
    : changedFiles(base);
  console.log(`[verify] ${base ? `base ${base}` : '--files'}; ${changed.length} changed file(s)`);

  let plan;
  try {
    plan = planChanges(changed, { base, files: Boolean(filesArg) });
  } catch (error) {
    console.log(`[verify] could not plan the Nx checks: ${error.message}`);
    process.exit(1);
  }
  printPlan(plan);
  // A dependsOn, cache flag or command lives in a project.json, a package.json "nx" block or
  // nx.json; an edit to this file can change the check itself.
  const taskGraphScope = /(^|\/)(project|package)\.json$|^nx\.json$|^tools\/verify\.mjs$/;
  const taskGraphDue = changed.some((file) => taskGraphScope.test(file));
  const toolScope =
    /^(tools\/|functions\/|research\/|apps\/dashboard-e2e\/tools\/|\.github\/|\.supply-chain\/|package(-lock)?\.json$)/;
  const toolsDue = changed.some((file) => toolScope.test(file));

  if (planOnly) {
    try {
      const tasks = plan.args ? jsonFromNx([...plan.args, '--graph=stdout'], '{').tasks.tasks : {};
      console.log(`[verify] Nx tasks: ${Object.keys(tasks).sort().join(', ') || 'none'}`);
    } catch (error) {
      console.log(`[verify] could not list the Nx tasks: ${error.message}`);
      process.exit(1);
    }
    console.log(`[verify] task graph check: ${taskGraphDue ? 'runs' : 'skipped'}`);
    console.log(`[verify] tool specs and filing check: ${toolsDue ? 'run' : 'skipped'}`);
    process.exit(0);
  }

  // The API contract gate compiles the dashboard against libs/api's built declarations and, by
  // design, writes nothing itself. Build them first, as CI did, so a change to libs/api is never
  // checked against stale declarations.
  let status = run('npx', ['tsc', '-p', 'libs/api/tsconfig.lib.json', '--pretty', 'false']);
  // Secrets (audit 2026-10-15, W-A01): the commits since the base, with the repo's .gitleaks.toml
  // and .gitleaksignore. The pre-push hook runs the same scan; with Actions off these are the only two.
  const gitleaks = spawnSync('gitleaks', ['version'], { stdio: 'ignore' });
  if (gitleaks.status === 0) {
    status =
      run('gitleaks', ['git', '--no-banner', '--redact', `--log-opts=${base}..HEAD`, '.']) ||
      status;
  } else {
    console.log('[verify] gitleaks is not installed (brew install gitleaks): secret scan FAILED');
    status = 1;
  }
  if (taskGraphDue) {
    status = checkContractGateWiring() || status;
  } else {
    console.log(
      '[verify] task graph check skipped: no project.json, package.json, nx.json or tools/verify.mjs changed',
    );
  }
  // No .env: run tests the way CI did. A developer .env (real AI keys, live settings) changes what
  // hermetic tests see; five recommendation key-resolution tests failed locally for that reason alone.
  if (plan.args) {
    const env = { NX_NO_CLOUD: 'true', NX_LOAD_DOT_ENV_FILES: 'false' };
    status = run('npx', plan.args, env) || status;
  }

  if (toolsDue) {
    status = run('npm', ['run', 'test:tools']) || status;
    // Figures against the filing: each note figure that names an XBRL concept, against the company
    // facts saved under research/_filings (never fetched here). Exits 1 on an unexplained difference.
    status = run('node', ['tools/research-notes/check-filings.mjs']) || status;
  } else {
    console.log(
      '[verify] tool specs and filing check skipped: nothing under tools/, functions/, research/, .github/ or packages',
    );
  }

  process.exit(status);
}

// Run only as a script: tools/verify.spec.mjs imports changedFiles, planChanges and planProjects.
// Both paths are resolved, so a symlinked checkout still runs.
const realpath = (file) => {
  try {
    return realpathSync(file);
  } catch {
    return null;
  }
};
if (realpath(process.argv[1] ?? '') === realpath(fileURLToPath(import.meta.url))) main();
