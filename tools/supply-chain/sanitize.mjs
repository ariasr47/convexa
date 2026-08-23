import { CHECK_AUTHORITIES, requiredChecksFor } from './normalize.mjs';

const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const GIT_SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const EVIDENCE =
  /^artifact:[a-z0-9][a-z0-9._-]{0,63}(#\/(?:[A-Za-z0-9._~-]+\/)*[A-Za-z0-9._~-]+)?$/;
const ARTIFACT = /^[a-z0-9][a-z0-9._-]{0,95}$/;
const STATES = new Set(['pass', 'pass_with_advisories', 'fail', 'blocked', 'skipped']);
const COMPLETIONS = new Set([
  'complete',
  'failed_to_start',
  'timed_out',
  'unavailable',
  'malformed',
  'partial',
  'authorized_skip',
]);
const REPORT_KEYS = [
  'schema_version',
  'report_kind',
  'revision_sha',
  'event',
  'path',
  'run_key',
  'policy_sha256',
  'created_at',
  'retention_days',
  'complete',
  'aggregate',
  'toolchain',
  'checks',
  'findings',
  'exceptions',
  'subjects',
  'redaction',
  'artifacts',
];
const CHECK_KEYS = [
  'check_id',
  'authority',
  'required',
  'scope',
  'tool',
  'tool_version',
  'advisory_data_revision',
  'state',
  'completion',
  'rule_id',
  'reason_code',
  'reason_params',
  'finding_count',
  'evidence_sha256',
];
const FINDING_KEYS = [
  'finding_id',
  'check_id',
  'rule_id',
  'classification',
  'subject_kind',
  'subject',
  'message_code',
  'message_params',
  'owner_id',
  'action_code',
  'evidence_ref',
  'rationale',
  'approver_id',
  'review_at',
  'expires_at',
  'exception_id',
];
const SUBJECT_KEYS = [
  'subject_id',
  'subject_kind',
  'digest',
  'revision_sha',
  'run_key',
  'build_run_id',
  'source_inputs_sha256',
  'scan_artifact_id',
  'dependency_inventory_artifact_id',
  'inventory_receipt_artifact_id',
];
const ARTIFACT_KEYS = [
  'artifact_id',
  'kind',
  'file_name',
  'media_type',
  'sha256',
  'size_bytes',
  'created_at',
  'retention_days',
  'expires_at',
];
const PARAM_KEYS = new Set([
  'check_name',
  'rule_id',
  'reason_code',
  'target',
  'count',
  'shown',
  'total',
  'sha',
  'evidence_short_sha',
  'current_short_sha',
  'digest',
  'reason',
]);
const ARTIFACT_KINDS = new Set([
  'policy_report',
  'capability_receipts',
  'toolchain_receipt',
  'scan_report',
  'component_oracle',
  'subject_archive',
  'dependency_inventory',
  'dependency_inventory_receipt',
  'summary',
]);
const MEDIA_TYPES = new Set([
  'application/json',
  'text/markdown',
  'application/vnd.cyclonedx+json',
  'application/x-tar',
]);

export function sanitize(value, catalogs = {}) {
  try {
    rejectPoison(value);
    const report = validatePolicyReport(value, catalogs);
    return {
      safe: true,
      value: structuredClone(report),
      redaction: structuredClone(report.redaction),
    };
  } catch (error) {
    return {
      safe: false,
      state: 'blocked',
      rule_id: 'sanitizer-input',
      reason_code: safeReason(error),
    };
  }
}

export function validatePolicyReport(
  report,
  { owners = null, actions = null, messages = null } = {},
) {
  objectExact(report, REPORT_KEYS, 'report');
  if (
    report.schema_version !== 1 ||
    report.report_kind !== 'supply_chain_policy' ||
    !GIT_SHA.test(report.revision_sha) ||
    !['pull_request', 'default_branch', 'schedule', 'workflow_dispatch'].includes(report.event) ||
    !['policy', 'artifacts'].includes(report.path) ||
    !SHA256.test(report.run_key) ||
    !SHA256.test(report.policy_sha256) ||
    !rfc3339(report.created_at) ||
    report.retention_days !== 30 ||
    typeof report.complete !== 'boolean' ||
    !STATES.has(report.aggregate)
  )
    throw new TypeError('report-identity');
  objectExact(report.toolchain, ['node', 'npm', 'rust'], 'toolchain');
  for (const value of Object.values(report.toolchain)) safeText(value, 64);
  if (
    !Array.isArray(report.checks) ||
    !Array.isArray(report.findings) ||
    !Array.isArray(report.exceptions) ||
    !Array.isArray(report.subjects) ||
    !Array.isArray(report.artifacts)
  )
    throw new TypeError('report-arrays');
  objectExact(report.redaction, ['count', 'kinds'], 'redaction');
  if (
    !Number.isInteger(report.redaction.count) ||
    report.redaction.count < 0 ||
    !Array.isArray(report.redaction.kinds) ||
    new Set(report.redaction.kinds).size !== report.redaction.kinds.length ||
    report.redaction.kinds.some(
      (x) =>
        ![
          'snippet',
          'authorization',
          'url_userinfo',
          'url_query',
          'environment',
          'command',
          'filename',
          'control_character',
        ].includes(x),
    ) ||
    (report.redaction.count === 0) !== (report.redaction.kinds.length === 0)
  )
    throw new TypeError('redaction');
  const required = requiredChecksFor(report.event, report.path),
    checkIds = new Set();
  for (const check of report.checks) {
    objectExact(check, CHECK_KEYS, 'check');
    if (
      !SAFE_ID.test(check.check_id) ||
      check.authority !== CHECK_AUTHORITIES[check.check_id] ||
      check.required !== true ||
      !Array.isArray(check.scope) ||
      check.scope.length === 0 ||
      check.scope.some((x) => !safeScope(x)) ||
      !SAFE_ID.test(check.tool) ||
      typeof check.tool_version !== 'string' ||
      check.tool_version.length > 64 ||
      !(check.advisory_data_revision === null || safeText(check.advisory_data_revision, 128)) ||
      !STATES.has(check.state) ||
      !COMPLETIONS.has(check.completion) ||
      !(check.rule_id === null || SAFE_ID.test(check.rule_id)) ||
      !(check.reason_code === null || SAFE_ID.test(check.reason_code)) ||
      !validParams(check.reason_params) ||
      !Number.isInteger(check.finding_count) ||
      check.finding_count < 0 ||
      !(check.evidence_sha256 === null || SHA256.test(check.evidence_sha256)) ||
      checkIds.has(check.check_id)
    )
      throw new TypeError('check');
    checkIds.add(check.check_id);
    if (
      check.completion !== 'complete' &&
      check.state !== 'blocked' &&
      check.completion !== 'authorized_skip'
    )
      throw new TypeError('check-completion');
    if (
      check.state === 'skipped' &&
      (check.completion !== 'authorized_skip' || !check.rule_id || !check.reason_code)
    )
      throw new TypeError('check-skip');
  }
  if (
    required.some((id) => !checkIds.has(id)) ||
    report.checks.some((x) => !required.includes(x.check_id))
  )
    throw new TypeError('check-set');
  const ownerIds = catalogIds(owners, 'owners', 'owner_id'),
    actionIds = catalogIds(actions, 'actions', 'action_code'),
    messageMap = messages?.messages ?? null,
    artifactIds = new Set();
  for (const artifact of report.artifacts) {
    objectExact(artifact, ARTIFACT_KEYS, 'artifact');
    if (
      !SAFE_ID.test(artifact.artifact_id) ||
      artifactIds.has(artifact.artifact_id) ||
      !ARTIFACT_KINDS.has(artifact.kind) ||
      !ARTIFACT.test(artifact.file_name) ||
      ['.', '..'].includes(artifact.file_name) ||
      !MEDIA_TYPES.has(artifact.media_type) ||
      !SHA256.test(artifact.sha256) ||
      !Number.isInteger(artifact.size_bytes) ||
      artifact.size_bytes < 1 ||
      artifact.size_bytes > 1073741824 ||
      !rfc3339(artifact.created_at) ||
      artifact.retention_days !== 30 ||
      !rfc3339(artifact.expires_at) ||
      Date.parse(artifact.expires_at) - Date.parse(artifact.created_at) !== 30 * 86400000
    )
      throw new TypeError('artifact');
    artifactIds.add(artifact.artifact_id);
  }
  const findingIds = new Set(),
    findingCounts = new Map();
  for (const finding of report.findings) {
    objectExact(finding, FINDING_KEYS, 'finding');
    if (
      !SAFE_ID.test(finding.finding_id) ||
      findingIds.has(finding.finding_id) ||
      !checkIds.has(finding.check_id) ||
      !SAFE_ID.test(finding.rule_id) ||
      !['blocker', 'advisory'].includes(finding.classification) ||
      !['repo_path', 'package', 'digest'].includes(finding.subject_kind) ||
      !subjectMatches(finding.subject_kind, finding.subject) ||
      !SAFE_ID.test(finding.message_code) ||
      !validParams(finding.message_params) ||
      !SAFE_ID.test(finding.owner_id) ||
      !SAFE_ID.test(finding.action_code) ||
      !EVIDENCE.test(finding.evidence_ref) ||
      !(finding.rationale === null || safeText(finding.rationale, 512)) ||
      !(finding.approver_id === null || SAFE_ID.test(finding.approver_id)) ||
      !(finding.review_at === null || rfc3339(finding.review_at)) ||
      !(finding.expires_at === null || rfc3339(finding.expires_at)) ||
      !(finding.exception_id === null || SAFE_ID.test(finding.exception_id))
    )
      throw new TypeError('finding');
    if (
      (ownerIds && !ownerIds.has(finding.owner_id)) ||
      (actionIds && !actionIds.has(finding.action_code)) ||
      (ownerIds && finding.approver_id && !ownerIds.has(finding.approver_id)) ||
      (messageMap && !validMessageParams(messageMap, finding.message_code, finding.message_params))
    )
      throw new TypeError('finding-catalog');
    const artifactId = finding.evidence_ref.slice('artifact:'.length).split('#')[0];
    if (!artifactIds.has(artifactId)) throw new TypeError('finding-evidence');
    if (
      finding.classification === 'blocker' &&
      (finding.owner_id === null || finding.action_code === null)
    )
      throw new TypeError('blocker-accountability');
    if (
      finding.classification === 'advisory' &&
      (!finding.rationale ||
        !finding.approver_id ||
        !finding.review_at ||
        !finding.expires_at ||
        Date.parse(finding.expires_at) <= Date.now())
    )
      throw new TypeError('advisory-accountability');
    findingIds.add(finding.finding_id);
    findingCounts.set(finding.check_id, (findingCounts.get(finding.check_id) ?? 0) + 1);
  }
  for (const check of report.checks) {
    if (check.finding_count !== (findingCounts.get(check.check_id) ?? 0))
      throw new TypeError('finding-count');
    if (check.state === 'pass' && check.finding_count !== 0) throw new TypeError('pass-findings');
  }
  if (
    new Set(report.exceptions).size !== report.exceptions.length ||
    report.exceptions.some((x) => !SAFE_ID.test(x))
  )
    throw new TypeError('exceptions');
  const subjectIds = new Set();
  for (const subject of report.subjects) {
    objectExact(subject, SUBJECT_KEYS, 'subject');
    if (
      !['api-production-image', 'dashboard-distribution-archive'].includes(subject.subject_id) ||
      subjectIds.has(subject.subject_id) ||
      subject.subject_kind !==
        (subject.subject_id === 'api-production-image' ? 'oci_image' : 'file_archive') ||
      !DIGEST.test(subject.digest) ||
      subject.revision_sha !== report.revision_sha ||
      subject.run_key !== report.run_key ||
      !/^[0-9]{1,32}$/.test(subject.build_run_id) ||
      !SHA256.test(subject.source_inputs_sha256) ||
      !(subject.scan_artifact_id === null || artifactIds.has(subject.scan_artifact_id)) ||
      !artifactIds.has(subject.dependency_inventory_artifact_id) ||
      !artifactIds.has(subject.inventory_receipt_artifact_id)
    )
      throw new TypeError('subject');
    subjectIds.add(subject.subject_id);
  }
  const expectedSubjects =
    report.path === 'artifacts' ? ['api-production-image', 'dashboard-distribution-archive'] : [];
  if (
    expectedSubjects.some((x) => !subjectIds.has(x)) ||
    subjectIds.size !== expectedSubjects.length
  )
    throw new TypeError('subject-set');
  if (
    report.complete !== report.checks.every((x) => x.completion === 'complete') ||
    (!report.complete && report.aggregate !== 'blocked')
  )
    throw new TypeError('report-completion');
  return report;
}

function objectExact(value, keys, label) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== [...keys].sort().join(',')
  )
    throw new TypeError(`${label}-fields`);
}
function catalogIds(doc, arrayKey, idKey) {
  if (doc === null) return null;
  if (!doc || !Array.isArray(doc[arrayKey])) throw new TypeError('catalog');
  return new Set(doc[arrayKey].map((x) => x[idKey]));
}
function validMessageParams(messages, code, params) {
  const item = messages[code];
  return (
    item &&
    Array.isArray(item.params) &&
    Object.keys(params).sort().join(',') === [...item.params].sort().join(',')
  );
}
function validParams(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((x) => !PARAM_KEYS.has(x))
  )
    return false;
  return Object.entries(value).every(([key, v]) =>
    ['count', 'shown', 'total'].includes(key)
      ? Number.isInteger(v) && v >= 0
      : key === 'digest'
        ? DIGEST.test(v)
        : ['sha', 'evidence_short_sha', 'current_short_sha'].includes(key)
          ? /^[0-9a-f]{7,64}$/.test(v)
          : safeText(v, 512),
  );
}
function safeScope(value) {
  return (
    DIGEST.test(value) ||
    safeRepoPath(value) ||
    (safeText(value, 240) && /^(?:npm|cargo):[^@\r\n]+@[^\r\n]+$/.test(value))
  );
}
function subjectMatches(kind, value) {
  return kind === 'digest'
    ? DIGEST.test(value)
    : kind === 'repo_path'
      ? safeRepoPath(value)
      : safeText(value, 240) && /^(?:npm|cargo):[^@\r\n]+@[^\r\n]+$/.test(value);
}
function safeRepoPath(value) {
  return (
    typeof value === 'string' &&
    Buffer.byteLength(value) <= 240 &&
    !value.startsWith('/') &&
    !/^[A-Za-z]:/.test(value) &&
    !value.includes('\\') &&
    !value.includes('://') &&
    value.split('/').every((x) => x && x !== '.' && x !== '..') &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}
function safeText(value, max) {
  return (
    typeof value === 'string' &&
    Buffer.byteLength(value) >= 1 &&
    Buffer.byteLength(value) <= max &&
    !/[\u0000-\u001f\u007f\u001b]/u.test(value) &&
    !value.startsWith('::')
  );
}
function rfc3339(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}
function rejectPoison(value) {
  for (const text of strings(value)) {
    if (
      /[\r\n\u0000-\u001f\u007f\u001b]/u.test(text) ||
      /sca[-_]?canary|canary[-_]?secret|authorization:\s|bearer\s+|password\s*=|cookie\s*=|token\s*=/i.test(
        text,
      )
    )
      throw new TypeError('unsafe-bytes');
    if (/^https?:/i.test(text)) {
      const url = new URL(text);
      if (url.username || url.password || url.search) throw new TypeError('unsafe-url');
    }
  }
}
function* strings(value) {
  if (typeof value === 'string') yield value;
  else if (Array.isArray(value)) for (const x of value) yield* strings(x);
  else if (value && typeof value === 'object')
    for (const x of Object.values(value)) yield* strings(x);
}
function safeReason(error) {
  return String(error?.message ?? 'invalid')
    .replace(/[^a-z0-9-]/gi, '-')
    .toLowerCase()
    .slice(0, 64);
}
