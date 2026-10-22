// The loopback guard in front of every promoted-conformance run that signs up: candidate
// qualification (`--url U`: all four specs, one JSON document) and `npm run conformance:auth`
// (`--spec auth-gated --url U`: one spec, its report streamed to the terminal, then the JSON).
// `--auth-signup` creates a throwaway account, so a production URL would write accounts into the
// production user store. Anything but http(s)://127.0.0.1[:port] is refused before a process starts.
import { spawn } from 'node:child_process';
import process from 'node:process';
import { spawnCaptured } from './lib/process.mjs';

const SPECS = Object.freeze([
  {
    id: 'public-surface',
    path: '.spire/clusters/tech/state/conformance/public-surface.json',
    auth: false,
  },
  { id: 'auth-gated', path: '.spire/clusters/tech/state/conformance/auth-gated.json', auth: true },
  { id: 'scanner', path: '.spire/clusters/tech/state/conformance/scanner.json', auth: false },
  {
    id: 'api-contract-generation',
    path: '.spire/clusters/tech/state/conformance/api-contract-generation.json',
    auth: false,
  },
]);

export async function runPromotedConformance({
  url,
  runner = spawnCaptured,
  root = process.cwd(),
  only,
} = {}) {
  if (!url || !/^https?:\/\/127\.0\.0\.1(?::\d+)?\/?$/.test(url))
    return blocked('loopback-url-required');
  const specs = only === undefined ? SPECS : SPECS.filter((spec) => spec.id === only);
  if (specs.length === 0) return blocked('unknown-spec');
  const results = [];
  for (const spec of specs) {
    const argv = ['.codex/tools/interface_conformance.mjs', '--spec', spec.path, '--url', url];
    if (spec.auth) argv.push('--auth-signup');
    const run = await runner(process.execPath, argv, {
      cwd: root,
      maxOutputBytes: 64 * 1024,
      timeoutMs: 180000,
    });
    const state = run.raw_exit_code === 0 ? 'pass' : run.raw_exit_code === 1 ? 'fail' : 'blocked';
    results.push({
      spec_id: spec.id,
      spec: spec.path,
      state,
      raw_exit_code: run.raw_exit_code,
      raw_output_sha256: run.raw_output_sha256,
    });
  }
  const state = results.some((x) => x.state === 'blocked')
    ? 'blocked'
    : results.some((x) => x.state === 'fail')
      ? 'fail'
      : 'pass';
  return { schema_version: 1, complete: state !== 'blocked', state, results };
}

function blocked(reason_code) {
  return { schema_version: 1, complete: false, state: 'blocked', reason_code, results: [] };
}

// A person reads `npm run conformance:auth`, so the child's report goes straight to the terminal.
function spawnInherited(executable, argv, { cwd }) {
  return new Promise((resolve) => {
    const child = spawn(executable, argv, {
      cwd,
      shell: false,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('error', () => resolve({ raw_exit_code: null, raw_output_sha256: null }));
    child.on('close', (code) => resolve({ raw_exit_code: code, raw_output_sha256: null }));
  });
}

function parse(argv) {
  if (argv.length === 2 && argv[0] === '--url') return { url: argv[1] };
  if (argv.length === 4 && argv[0] === '--spec' && argv[2] === '--url')
    return { only: argv[1], url: argv[3], runner: spawnInherited };
  throw new TypeError('invalid invocation');
}
if (import.meta.url === new URL(`file://${process.argv[1]?.replaceAll('\\', '/')}`).href) {
  let result;
  try {
    result = await runPromotedConformance(parse(process.argv.slice(2)));
  } catch {
    result = blocked('invalid-invocation');
  }
  process.stdout.write(JSON.stringify(result));
  process.exitCode = result.state === 'blocked' ? 2 : result.state === 'fail' ? 1 : 0;
}
