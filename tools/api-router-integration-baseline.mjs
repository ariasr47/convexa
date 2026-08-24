import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const BASELINE_PATH = 'apps/api/openapi/router-integration-prechange-baseline.json';
export const ARTIFACT_PATHS = Object.freeze([
  'apps/api/openapi/convexa.openapi.json',
  'libs/api/src/generated/schema.ts',
  'apps/api/openapi/parity-coverage.json',
  'apps/api/openapi/generated-artifacts.manifest.json',
]);
export const PINNED_SOURCE_PATHS = Object.freeze([
  'Cargo.lock',
  'apps/api/Cargo.toml',
  'apps/api/src',
  'apps/api/tests',
  ...ARTIFACT_PATHS,
  'apps/api/openapi/precutover-operation-baseline.json',
  'libs/api/src/generated/schema.ts',
  'tools/api-contract.mjs',
  'package.json',
  'package-lock.json',
]);
export const APPROVED_REPLACEMENT_REVISION = '7d5095f5a60f49400884813540e3349f8026df80';
export const ALLOWED_POSTCUTOVER_DELTA = Object.freeze([
  ['M', 'Cargo.lock'],
  ['M', 'apps/api/Cargo.toml'],
  ['M', 'apps/api/src/bin/export_openapi.rs'],
  ['A', 'apps/api/src/routes/contract_router.rs'],
  ['M', 'apps/api/src/routes/mod.rs'],
  ['M', 'apps/api/src/server.rs'],
  ['M', 'apps/api/tests/api_contract_gate_isolation.rs'],
  ['M', 'apps/api/tests/api_contract_parity.rs'],
  ['M', 'apps/api/tests/api_contract_router.rs'],
  ['M', 'apps/api/tests/api_contract_runtime_auth_research.rs'],
  ['M', 'apps/api/tests/api_contract_runtime_market_stream.rs'],
  ['M', 'apps/api/tests/production_runtime_guardrails.rs'],
  ['M', 'tools/api-contract.mjs'],
]);
const ROOT = resolve(import.meta.dirname, '..');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonical = (value) => `${JSON.stringify(value, null, 2)}\n`;
const fail = (message) => {
  throw new Error(message);
};
const read = (path) => readFileSync(join(ROOT, path));

export const canonicalIdSetHash = (ids) => {
  if (new Set(ids).size !== ids.length) fail('duplicate evidence identifier');
  const sorted = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sha256(Buffer.from(`${JSON.stringify(sorted)}\n`, 'utf8'));
};

export function validateBaselineShape(value) {
  if (
    !value ||
    value.schema_version !== 1 ||
    value.baseline_id !== 'openapi-router-integration-prechange'
  )
    fail('baseline schema');
  if (!/^[0-9a-f]{40}$/i.test(value.source?.revision ?? ''))
    fail('baseline schema source revision');
  if (!value.capture || !/^[0-9a-f]{64}$/i.test(value.capture.tool_sha256 ?? ''))
    fail('baseline schema capture');
  if (
    !Array.isArray(value.artifacts) ||
    value.artifacts.length !== 4 ||
    value.artifacts.some(
      (x, i) => x.path !== ARTIFACT_PATHS[i] || !/^[0-9a-f]{64}$/.test(x.raw_sha256),
    )
  )
    fail('baseline schema artifacts');
  if (
    value.openapi_version !== '3.1.0' ||
    !value.openapi_info ||
    typeof value.openapi_info !== 'object'
  )
    fail('baseline schema OpenAPI');
  if (
    value.evidence?.response_conversion?.count !== 181 ||
    value.evidence?.direct_http?.count !== 87 ||
    !/^[0-9a-f]{64}$/.test(value.evidence.response_conversion.id_set_sha256) ||
    !/^[0-9a-f]{64}$/.test(value.evidence.direct_http.id_set_sha256)
  )
    fail('baseline schema evidence');
  return true;
}

function args(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++)
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      result[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  return result;
}
function fullRevision() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
}
function ensurePinnedClean(revision) {
  const result = spawnSync('git', ['diff', '--quiet', revision, '--', ...PINNED_SOURCE_PATHS], {
    cwd: ROOT,
  });
  if (result.status !== 0) fail('pinned source is dirty relative to source revision');
}
function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) fail(`baseline history: ${result.stderr?.trim() || args.join(' ')}`);
  return result.stdout.trim();
}
function requireCommit(root, revision) {
  git(root, ['cat-file', '-e', `${revision}^{commit}`]);
}
export function validatePostcutoverDelta({
  root = ROOT,
  sourceRevision,
  approvedRevision = APPROVED_REPLACEMENT_REVISION,
} = {}) {
  requireCommit(root, sourceRevision);
  requireCommit(root, approvedRevision);
  const actual = git(root, ['diff', '--name-status', sourceRevision, approvedRevision])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [status, ...parts] = line.split('\t');
      return [status, parts.join('\t')];
    });
  const expected = [...ALLOWED_POSTCUTOVER_DELTA].sort((a, b) => a[1].localeCompare(b[1]));
  const expectedPaths = new Set(expected.map(([, path]) => path));
  const protectedActual = actual.filter(([, path]) =>
    PINNED_SOURCE_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)),
  );
  const observed = protectedActual
    .filter(([, path]) => expectedPaths.has(path))
    .sort((a, b) => a[1].localeCompare(b[1]));
  const unexpected = protectedActual.filter(
    ([, path]) => !expectedPaths.has(path) && path !== BASELINE_PATH,
  );
  if (unexpected.length) fail('pinned source is dirty relative to approved replacement delta');
  if (JSON.stringify(observed) !== JSON.stringify(expected))
    fail('pinned source is dirty relative to approved replacement delta');
  return true;
}
function npmCliPath(env = process.env) {
  const supplied = env.npm_execpath;
  if (!supplied || !isAbsolute(supplied)) fail('npm CLI path is missing or invalid');
  let canonical;
  try {
    canonical = realpathSync(supplied);
  } catch {
    fail('npm CLI path is missing or invalid');
  }
  if (!statSync(canonical).isFile() || basename(canonical).toLowerCase() !== 'npm-cli.js')
    fail('npm CLI path is missing or invalid');
  return canonical;
}
function runEvidence() {
  const npmCli = npmCliPath();
  const result = spawnSync(process.execPath, [npmCli, 'run', 'api:contract:check'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, API_CONTRACT_EXECUTE_EVIDENCE: '1' },
  });
  const checkOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (result.error || result.status !== 0)
    fail(
      `contract evidence runner failed: ${result.error?.code ?? checkOutput.split('\n').find(Boolean) ?? 'unknown'}`,
    );
  const commands = [
    [
      'cargo',
      [
        'test',
        '-p',
        'api-rust',
        '--test',
        'api_contract_parity',
        'boundary_evidence_',
        '--',
        '--nocapture',
      ],
    ],
    ['cargo', ['test', '-p', 'api-rust', '--test', 'api_contract_parity', '--', '--nocapture']],
    [
      'cargo',
      [
        'test',
        '-p',
        'api-rust',
        '--test',
        'api_contract_runtime_auth_research',
        '--',
        '--nocapture',
      ],
    ],
    [
      'cargo',
      [
        'test',
        '-p',
        'api-rust',
        '--test',
        'api_contract_runtime_market_stream',
        '--',
        '--nocapture',
      ],
    ],
  ];
  const outputs = commands.map(([command, argv]) => {
    const run = spawnSync(command, argv, { cwd: ROOT, encoding: 'utf8', shell: false });
    if (run.error || run.status !== 0)
      fail(`contract evidence runner failed: ${run.error?.code ?? run.stderr ?? 'unknown'}`);
    return `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  });
  const responseOutput = outputs[0];
  const directOutput = outputs.slice(1).join('\n');
  const response = [...responseOutput.matchAll(/CONTRACT_EVIDENCE_OUTCOME\s+(\S+)\s/g)].map(
    (m) => m[1],
  );
  const direct = [...directOutput.matchAll(/DIRECT_HTTP_EVIDENCE_OUTCOME\s+(.+?)\s+\{/g)].map(
    (m) => m[1],
  );
  if (response.length !== 181 || new Set(response).size !== 181)
    fail(`response evidence set (${response.length}/181)`);
  if (direct.length !== 87 || new Set(direct).size !== 87)
    fail(`direct HTTP evidence set (${direct.length}/87)`);
  return { response, direct };
}

export function buildCandidate({
  sourceRevision = fullRevision(),
  out,
  sourceGuard = ensurePinnedClean,
} = {}) {
  if (!out) fail('--out is required');
  if (!/^[0-9a-f]{40}$/i.test(sourceRevision)) fail('source revision must be a full 40-hex SHA');
  sourceGuard(sourceRevision);
  const evidence = runEvidence();
  const openapi = JSON.parse(read('apps/api/openapi/convexa.openapi.json'));
  const toolBytes = read('tools/api-router-integration-baseline.mjs');
  const baseline = {
    schema_version: 1,
    baseline_id: 'openapi-router-integration-prechange',
    source: { revision: sourceRevision },
    capture: {
      tool_path: 'tools/api-router-integration-baseline.mjs',
      tool_sha256: sha256(toolBytes),
      candidate_command: `npm run api:router-integration:baseline:candidate -- --source-revision ${sourceRevision} --out ${out}`,
      accept_command: 'npm run api:router-integration:baseline:accept',
      review_contract:
        '.spire/clusters/tech/contracts/openapi-router-dependency-replacement/INTERFACE_CONTRACT.md',
      reviewer_provenance: 'pending-review',
      captured_at_utc: new Date().toISOString(),
    },
    artifacts: ARTIFACT_PATHS.map((path) => ({ path, raw_sha256: sha256(read(path)) })),
    openapi_version: openapi.openapi,
    openapi_info: openapi.info,
    evidence: {
      response_conversion: { count: 181, id_set_sha256: canonicalIdSetHash(evidence.response) },
      direct_http: { count: 87, id_set_sha256: canonicalIdSetHash(evidence.direct) },
    },
  };
  validateBaselineShape(baseline);
  const target = resolve(ROOT, out);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, canonical(baseline));
  return baseline;
}

export function acceptBaseline({ candidate, reviewContract, reviewerProvenance }) {
  if (!candidate || !reviewContract || !reviewerProvenance)
    fail('candidate, review contract, and reviewer provenance are required');
  const target = join(ROOT, BASELINE_PATH);
  if (existsSync(target)) fail('baseline already exists; refusing overwrite');
  const data = JSON.parse(readFileSync(resolve(ROOT, candidate), 'utf8'));
  validateBaselineShape(data);
  ensurePinnedClean(data.source.revision);
  if (data.capture.reviewer_provenance === 'pending-review')
    data.capture.reviewer_provenance = reviewerProvenance;
  data.capture.review_contract = reviewContract;
  const temp = `${target}.tmp-${process.pid}`;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(temp, canonical(data));
  renameSync(temp, target);
  return data;
}

export function compareBaseline() {
  const baseline = JSON.parse(read(BASELINE_PATH));
  validateBaselineShape(baseline);
  validatePostcutoverDelta({ sourceRevision: baseline.source.revision });
  const current = buildCandidate({
    sourceRevision: baseline.source.revision,
    out: join('.tmp', `router-candidate-${process.pid}.json`),
    sourceGuard: () => {},
  });
  validateCandidateAgainstBaseline(current, baseline);
  return true;
}

export function validateCandidateAgainstBaseline(candidate, baseline) {
  validateBaselineShape(baseline);
  if (
    !candidate ||
    !Array.isArray(candidate.artifacts) ||
    candidate.artifacts.length !== ARTIFACT_PATHS.length
  )
    fail('contract drift');
  for (let i = 0; i < ARTIFACT_PATHS.length; i++)
    if (
      candidate.artifacts[i].path !== baseline.artifacts[i].path ||
      candidate.artifacts[i].raw_sha256 !== baseline.artifacts[i].raw_sha256
    )
      fail('contract drift');
  if (
    candidate.openapi_version !== baseline.openapi_version ||
    JSON.stringify(candidate.openapi_info) !== JSON.stringify(baseline.openapi_info) ||
    JSON.stringify(candidate.evidence) !== JSON.stringify(baseline.evidence)
  )
    fail('contract drift');
  return true;
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const command = process.argv[2];
  const flags = args(process.argv.slice(3));
  if (command === 'candidate')
    buildCandidate({ sourceRevision: flags['source-revision'], out: flags.out });
  else if (command === 'accept')
    acceptBaseline({
      candidate: flags.candidate,
      reviewContract: flags['review-contract'],
      reviewerProvenance: flags['reviewer-provenance'],
    });
  else if (command === 'compare') compareBaseline();
  else fail('usage: api-router-integration-baseline.mjs <candidate|accept|compare>');
}
