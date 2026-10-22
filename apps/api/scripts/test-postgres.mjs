#!/usr/bin/env node
// `npm run test:postgres`: the Rust tests that need a real PostgreSQL (`--features postgres`).
// Nothing else runs them: verify and `api:test` build default features, and CI is off. Two runner
// cases sat red for seven weeks because of that (docs/testing/2026-10-22/TEST_PLAN.md, batch 5).
//
//   1. `initdb` a scratch cluster in a temp directory, on a free loopback port (trust auth, no
//      fsync: it is thrown away), and create `convexa_test` in it.
//   2. `api-rust postgres-migrate` against it: the release command, run the way Railway runs it.
//   3. `cargo test -p api-rust --features postgres` over the lib unit tests, every
//      `apps/api/tests/*_postgres.rs` target and `archive_coverage_audit`, with TEST_DATABASE_URL,
//      RELEASE_GIT_SHA (HEAD unless already set) and POSTGRES_RELEASE_NEGATIVE_CONTROL_OUT.
//   4. Stop the cluster and delete the temp directory, whatever happened.
//
// It fails closed when the PostgreSQL server tools are missing, as verify does for gitleaks.
// Arguments after `--` go to the test binaries: `npm run test:postgres -- runner_fresh` runs one case.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const say = (line) => console.log(`[test:postgres] ${line}`);

let interrupted = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    interrupted = true;
  });
}

// initdb, pg_ctl and createdb from one directory, so the server and its tools share a version.
function postgresBin() {
  const dirs = [...(process.env.PATH ?? '').split(':'), '/opt/homebrew/bin', '/usr/local/bin'];
  return (
    dirs.find(
      (dir) => dir && ['initdb', 'pg_ctl', 'createdb'].every((tool) => existsSync(join(dir, tool))),
    ) ?? null
  );
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// Runs a step; prints its exit code and time. `quiet` keeps a tool's chatter out of the log
// unless the step fails.
function step(command, args, { env = process.env, quiet = false } = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: repo,
    env,
    stdio: quiet ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });
  const status = result.status ?? 1;
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  say(`${[command, ...args].join(' ')}: exit ${status} in ${seconds} s`);
  if (status !== 0 && quiet) process.stdout.write(`${result.stdout ?? ''}${result.stderr ?? ''}`);
  if (interrupted) throw new Error('interrupted');
  return status;
}

const bin = postgresBin();
if (!bin) {
  say('initdb, pg_ctl or createdb is not installed (brew install postgresql@16): FAILED');
  process.exit(1);
}

let releaseSha = process.env.RELEASE_GIT_SHA;
if (!releaseSha) {
  try {
    releaseSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  } catch {
    say('RELEASE_GIT_SHA is unset and git rev-parse HEAD failed: FAILED');
    process.exit(1);
  }
}

const postgresTargets = readdirSync(join(repo, 'apps/api/tests'))
  .filter((file) => file.endsWith('_postgres.rs'))
  .map((file) => file.slice(0, -'.rs'.length))
  .sort();
if (postgresTargets.length === 0) {
  say('no apps/api/tests/*_postgres.rs target found: FAILED');
  process.exit(1);
}

// With no locale in the environment, macOS's locale lookup starts threads inside the postmaster,
// which then refuses to start ("postmaster became multithreaded during startup").
const clusterEnv = { ...process.env, LC_ALL: 'C' };
const started = Date.now();
const scratch = mkdtempSync(join(tmpdir(), 'convexa-pg-'));
const data = join(scratch, 'data');
const log = join(scratch, 'postgres.log');
let clusterUp = false;
let status = 1;
try {
  if (
    step(
      join(bin, 'initdb'),
      ['-D', data, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--no-locale'],
      { env: clusterEnv, quiet: true },
    ) !== 0
  ) {
    throw new Error('initdb failed');
  }
  // A free port can be taken between the probe and the bind; three tries cover that race.
  let port;
  for (let attempt = 1; attempt <= 3 && !clusterUp; attempt += 1) {
    port = await freePort();
    const options = `-p ${port} -k '${scratch}' -c listen_addresses=127.0.0.1 -c fsync=off -c synchronous_commit=off -c full_page_writes=off`;
    clusterUp =
      step(join(bin, 'pg_ctl'), ['-D', data, '-l', log, '-w', '-t', '30', '-o', options, 'start'], {
        env: clusterEnv,
        quiet: true,
      }) === 0;
  }
  if (!clusterUp) {
    if (existsSync(log)) process.stdout.write(readFileSync(log, 'utf8'));
    throw new Error('the scratch cluster did not start');
  }
  if (
    step(join(bin, 'createdb'), [
      '-h',
      '127.0.0.1',
      '-p',
      String(port),
      '-U',
      'postgres',
      'convexa_test',
    ]) !== 0
  ) {
    throw new Error('createdb failed');
  }
  const databaseUrl = `postgresql://postgres@127.0.0.1:${port}/convexa_test`;
  // A developer's DATABASE_URL must not reach the tests; each sets its own where it needs one.
  const { DATABASE_URL: _unused, ...inherited } = process.env;
  const migrate = step(
    'cargo',
    ['run', '-q', '-p', 'api-rust', '--features', 'postgres', '--locked', '--', 'postgres-migrate'],
    { env: { ...inherited, DATABASE_URL: databaseUrl } },
  );
  if (migrate !== 0) throw new Error('postgres-migrate failed');
  const testArgs = ['test', '-p', 'api-rust', '--features', 'postgres', '--locked', '--lib'];
  for (const target of [...postgresTargets, 'archive_coverage_audit'])
    testArgs.push('--test', target);
  const passthrough = process.argv.slice(2);
  if (passthrough.length > 0) testArgs.push('--', ...passthrough);
  status = step('cargo', testArgs, {
    env: {
      ...inherited,
      TEST_DATABASE_URL: databaseUrl,
      RELEASE_GIT_SHA: releaseSha,
      POSTGRES_RELEASE_NEGATIVE_CONTROL_OUT:
        process.env.POSTGRES_RELEASE_NEGATIVE_CONTROL_OUT ??
        join(scratch, 'postgres-release-negative-control.json'),
    },
  });
} catch (error) {
  say(`${error.message}: FAILED`);
  status = 1;
} finally {
  if (clusterUp) {
    spawnSync(join(bin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], {
      env: clusterEnv,
      stdio: 'ignore',
    });
  }
  rmSync(scratch, { recursive: true, force: true });
}
say(`exit ${status} in ${((Date.now() - started) / 1000).toFixed(1)} s`);
process.exit(status);
