import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const BASELINE_PATH = 'apps/api/openapi/router-integration-prechange-baseline.json';
export const ARTIFACT_PATHS = Object.freeze([
  'apps/api/openapi/convexa.openapi.json',
  'libs/api/src/generated/schema.ts',
  'apps/api/openapi/parity-coverage.json',
  'apps/api/openapi/generated-artifacts.manifest.json',
]);
export const PINNED_SOURCE_PATHS = Object.freeze([
  'Cargo.lock', 'apps/api/Cargo.toml', 'apps/api/src', 'apps/api/tests',
  ...ARTIFACT_PATHS, 'apps/api/openapi/precutover-operation-baseline.json',
  'libs/api/src/generated/schema.ts', 'tools/api-contract.mjs', 'package.json', 'package-lock.json',
]);
const ROOT = resolve(import.meta.dirname, '..');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonical = (value) => `${JSON.stringify(value, null, 2)}\n`;
const fail = (message) => { throw new Error(message); };
const read = (path) => readFileSync(join(ROOT, path));

export const canonicalIdSetHash = (ids) => {
  if (new Set(ids).size !== ids.length) fail('duplicate evidence identifier');
  const sorted = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sha256(Buffer.from(`${JSON.stringify(sorted)}\n`, 'utf8'));
};

export function validateBaselineShape(value) {
  if (!value || value.schema_version !== 1 || value.baseline_id !== 'openapi-router-integration-prechange')
    fail('baseline schema');
  if (!/^[0-9a-f]{40}$/i.test(value.source?.revision ?? '')) fail('baseline schema source revision');
  if (!value.capture || !/^[0-9a-f]{64}$/i.test(value.capture.tool_sha256 ?? '')) fail('baseline schema capture');
  if (!Array.isArray(value.artifacts) || value.artifacts.length !== 4 ||
      value.artifacts.some((x, i) => x.path !== ARTIFACT_PATHS[i] || !/^[0-9a-f]{64}$/.test(x.raw_sha256)))
    fail('baseline schema artifacts');
  if (value.openapi_version !== '3.1.0' || !value.openapi_info || typeof value.openapi_info !== 'object')
    fail('baseline schema OpenAPI');
  if (value.evidence?.response_conversion?.count !== 181 || value.evidence?.direct_http?.count !== 87 ||
      !/^[0-9a-f]{64}$/.test(value.evidence.response_conversion.id_set_sha256) ||
      !/^[0-9a-f]{64}$/.test(value.evidence.direct_http.id_set_sha256)) fail('baseline schema evidence');
  return true;
}

function args(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) {
    const key = argv[i].slice(2); result[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return result;
}
function fullRevision() { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); }
function ensurePinnedClean(revision) {
  const result = spawnSync('git', ['diff', '--quiet', revision, '--', ...PINNED_SOURCE_PATHS], { cwd: ROOT });
  if (result.status !== 0) fail('pinned source is dirty relative to source revision');
}
function runEvidence() {
  const result = spawnSync('npm.cmd', ['run', 'api:contract:check'], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, API_CONTRACT_EXECUTE_EVIDENCE: '1' },
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (result.status !== 0) fail(`contract evidence runner failed: ${output.split('\n').find(Boolean) ?? 'unknown'}`);
  const response = [...output.matchAll(/CONTRACT_EVIDENCE_OUTCOME\s+(\S+)\s/g)].map((m) => m[1]);
  const direct = [...output.matchAll(/DIRECT_HTTP_EVIDENCE_OUTCOME\s+(.+?)\s+\{/g)].map((m) => m[1]);
  if (response.length !== 181 || new Set(response).size !== 181) fail(`response evidence set (${response.length}/181)`);
  if (direct.length !== 87 || new Set(direct).size !== 87) fail(`direct HTTP evidence set (${direct.length}/87)`);
  return { response, direct };
}

export function buildCandidate({ sourceRevision = fullRevision(), out } = {}) {
  if (!out) fail('--out is required');
  if (!/^[0-9a-f]{40}$/i.test(sourceRevision)) fail('source revision must be a full 40-hex SHA');
  ensurePinnedClean(sourceRevision);
  const evidence = runEvidence();
  const openapi = JSON.parse(read('apps/api/openapi/convexa.openapi.json'));
  const toolBytes = read('tools/api-router-integration-baseline.mjs');
  const baseline = {
    schema_version: 1,
    baseline_id: 'openapi-router-integration-prechange',
    source: { revision: sourceRevision },
    capture: {
      tool_path: 'tools/api-router-integration-baseline.mjs', tool_sha256: sha256(toolBytes),
      candidate_command: `npm run api:router-integration:baseline:candidate -- --source-revision ${sourceRevision} --out ${out}`,
      accept_command: 'npm run api:router-integration:baseline:accept',
      review_contract: '.spire/clusters/tech/contracts/openapi-router-dependency-replacement/INTERFACE_CONTRACT.md',
      reviewer_provenance: 'pending-review', captured_at_utc: new Date().toISOString(),
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
  const target = resolve(ROOT, out); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, canonical(baseline));
  return baseline;
}

export function acceptBaseline({ candidate, reviewContract, reviewerProvenance }) {
  if (!candidate || !reviewContract || !reviewerProvenance) fail('candidate, review contract, and reviewer provenance are required');
  const target = join(ROOT, BASELINE_PATH);
  if (existsSync(target)) fail('baseline already exists; refusing overwrite');
  const data = JSON.parse(readFileSync(resolve(ROOT, candidate), 'utf8')); validateBaselineShape(data);
  if (data.capture.reviewer_provenance === 'pending-review') data.capture.reviewer_provenance = reviewerProvenance;
  data.capture.review_contract = reviewContract;
  const temp = `${target}.tmp-${process.pid}`; mkdirSync(dirname(target), { recursive: true });
  writeFileSync(temp, canonical(data)); renameSync(temp, target); return data;
}

export function compareBaseline() {
  const baseline = JSON.parse(read(BASELINE_PATH)); validateBaselineShape(baseline);
  const current = buildCandidate({ sourceRevision: baseline.source.revision, out: join('.tmp', `router-candidate-${process.pid}.json`) });
  for (let i = 0; i < ARTIFACT_PATHS.length; i++) if (current.artifacts[i].raw_sha256 !== baseline.artifacts[i].raw_sha256) fail('contract drift');
  if (JSON.stringify(current.openapi_info) !== JSON.stringify(baseline.openapi_info) ||
      current.openapi_version !== baseline.openapi_version ||
      JSON.stringify(current.evidence) !== JSON.stringify(baseline.evidence)) fail('contract drift');
  return true;
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  const command = process.argv[2]; const flags = args(process.argv.slice(3));
  if (command === 'candidate') buildCandidate({ sourceRevision: flags['source-revision'], out: flags.out });
  else if (command === 'accept') acceptBaseline({ candidate: flags.candidate, reviewContract: flags['review-contract'], reviewerProvenance: flags['reviewer-provenance'] });
  else if (command === 'compare') compareBaseline();
  else fail('usage: api-router-integration-baseline.mjs <candidate|accept|compare>');
}
