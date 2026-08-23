export const CHECK_AUTHORITIES = Object.freeze({
  npm_advisories: 'npm-audit',
  npm_licenses: 'npm-license-inventory',
  npm_sources: 'npm-lock-guard',
  cargo_policy: 'cargo-deny',
  repository_secrets: 'gitleaks',
  configuration: 'trivy',
  api_image: 'trivy',
  api_dependency_inventory: 'syft',
  dashboard_dependency_inventory: 'syft',
});
const rank = Object.freeze({ blocked: 4, fail: 3, pass_with_advisories: 2, pass: 1 });
const completions = new Set([
  'complete',
  'failed_to_start',
  'timed_out',
  'unavailable',
  'malformed',
  'partial',
  'authorized_skip',
]);
export function requiredChecksFor(event, path = 'policy') {
  const policy =
    event === 'schedule'
      ? ['npm_advisories', 'cargo_policy', 'repository_secrets', 'configuration']
      : [
          'npm_advisories',
          'npm_licenses',
          'npm_sources',
          'cargo_policy',
          'repository_secrets',
          'configuration',
        ];
  return path === 'artifacts'
    ? [...policy, 'api_image', 'api_dependency_inventory', 'dashboard_dependency_inventory']
    : policy;
}
function blocked(check_id, reason_code) {
  return {
    check_id,
    authority: CHECK_AUTHORITIES[check_id] ?? 'normalizer',
    required: true,
    scope: [],
    tool: CHECK_AUTHORITIES[check_id] ?? 'normalizer',
    tool_version: 'unknown',
    advisory_data_revision: null,
    state: 'blocked',
    completion: 'malformed',
    rule_id: 'report-input',
    reason_code,
    reason_params: {},
    finding_count: 0,
    evidence_sha256: null,
  };
}
export function validateCheck(check, id) {
  if (!check || typeof check !== 'object' || Array.isArray(check))
    return blocked(id, 'missing-check');
  if (check.check_id !== id || check.authority !== CHECK_AUTHORITIES[id])
    return blocked(id, 'authority-mismatch');
  if (!rank[check.state] || !completions.has(check.completion)) return blocked(id, 'invalid-state');
  if (check.completion !== 'complete' && check.state !== 'blocked')
    return blocked(id, 'incomplete-not-blocked');
  if (check.state === 'pass' && check.finding_count !== 0) return blocked(id, 'pass-has-findings');
  if (check.state === 'fail' && !(check.finding_count > 0))
    return blocked(id, 'fail-without-findings');
  return check;
}
export function normalizePolicyReport(
  input,
  required = requiredChecksFor(input?.event, input?.path),
) {
  const byId = new Map();
  let duplicate = false;
  for (const check of Array.isArray(input?.checks) ? input.checks : []) {
    if (!check?.check_id || byId.has(check.check_id)) duplicate = true;
    else byId.set(check.check_id, check);
  }
  const checks = required.map((id) => validateCheck(byId.get(id), id));
  if (duplicate && checks.length) checks[0] = blocked(required[0], 'duplicate-check');
  const state = checks.reduce((a, c) => (rank[c.state] > rank[a] ? c.state : a), 'pass');
  const complete = checks.every((c) => c.completion === 'complete') && !duplicate;
  return { ...input, complete, aggregate: complete ? state : 'blocked', checks };
}
export function aggregate(checks) {
  if (!Array.isArray(checks) || !checks.length) return { state: 'blocked', complete: false };
  return {
    state: checks.reduce((a, c) => (rank[c?.state] > rank[a] ? c.state : a), 'pass'),
    complete: checks.every((c) => c?.completion === 'complete'),
  };
}
export function normalize(input) {
  if (!input?.event || !input?.path) {
    const r = aggregate(input?.checks);
    return { ...r, checks: Array.isArray(input?.checks) ? input.checks : [] };
  }
  return normalizePolicyReport(input);
}
