import { spawnSync } from 'node:child_process';
import { runPolicy } from './policy.mjs';
import { computeRunKey, subjectSetHash } from './run-key.mjs';

const allowedEvents = new Set(['pull_request', 'default_branch', 'schedule', 'workflow_dispatch']);
function gitSha() {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', shell: false });
  return r.status === 0 ? r.stdout.trim() : '0'.repeat(40);
}
function parse(argv) {
  const allowed = new Set(['--event', '--path']);
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!allowed.has(argv[i]) || !argv[i + 1] || argv[i + 1].startsWith('--'))
      throw new Error('invalid');
    out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}
let result;
try {
  const input = parse(process.argv.slice(2));
  const event = input.event ?? 'pull_request';
  if (!allowedEvents.has(event)) throw new Error('invalid');
  const path =
    event === 'default_branch'
      ? 'artifacts'
      : event === 'workflow_dispatch'
        ? (input.path ?? 'policy')
        : 'policy';
  if (!['policy', 'artifacts'].includes(path) || (input.path && event !== 'workflow_dispatch'))
    throw new Error('invalid');
  const revision = gitSha();
  const subjects =
    path === 'artifacts' ? ['api-production-image', 'dashboard-distribution-archive'] : [];
  const runKey = computeRunKey(event, revision, path, subjectSetHash(subjects));
  result =
    path === 'policy'
      ? await runPolicy({ event, path, runKey })
      : {
          schema_version: 1,
          revision_sha: revision,
          event,
          path,
          run_key: runKey,
          complete: false,
          aggregate: 'blocked',
          checks: [],
          reason_code: 'artifact-host-required',
        };
} catch {
  result = {
    schema_version: 1,
    revision_sha: '0'.repeat(40),
    event: 'unknown',
    path: 'unknown',
    run_key: '',
    complete: false,
    aggregate: 'blocked',
    checks: [],
    reason_code: 'invalid-invocation',
  };
}
process.stdout.write(JSON.stringify(result));
process.exitCode = result.aggregate === 'blocked' ? 2 : result.aggregate === 'fail' ? 1 : 0;
