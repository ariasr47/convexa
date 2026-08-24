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
} = {}) {
  if (!url || !/^https?:\/\/127\.0\.0\.1(?::\d+)?\/?$/.test(url))
    return {
      schema_version: 1,
      complete: false,
      state: 'blocked',
      reason_code: 'loopback-url-required',
      results: [],
    };
  const results = [];
  for (const spec of SPECS) {
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

function parse(argv) {
  if (argv.length !== 2 || argv[0] !== '--url') throw new TypeError('invalid invocation');
  return argv[1];
}
if (import.meta.url === new URL(`file://${process.argv[1]?.replaceAll('\\', '/')}`).href) {
  let result;
  try {
    result = await runPromotedConformance({ url: parse(process.argv.slice(2)) });
  } catch {
    result = {
      schema_version: 1,
      complete: false,
      state: 'blocked',
      reason_code: 'invalid-invocation',
      results: [],
    };
  }
  process.stdout.write(JSON.stringify(result));
  process.exitCode = result.state === 'blocked' ? 2 : result.state === 'fail' ? 1 : 0;
}
