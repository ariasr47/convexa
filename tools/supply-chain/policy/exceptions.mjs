const glob = /[*?\[\]{}]/;
export function validateExceptions(registry, { now = new Date(), securityRuleIds = [] } = {}) {
  if (!registry || registry.schema_version !== 1 || !Array.isArray(registry.exceptions))
    return out('blocked', 'exception-registry-malformed');
  const ids = new Map();
  const active = new Set();
  for (const item of registry.exceptions) {
    if (!valid(item) || ids.has(item.exception_id))
      return out('blocked', 'exception-record-malformed');
    if (securityRuleIds.includes(item.rule_id))
      return out('blocked', 'security-exception-prohibited');
    const created = Date.parse(item.created_at),
      review = Date.parse(item.review_at),
      expires = Date.parse(item.expires_at);
    if (!(created < review && review <= expires && expires <= created + 30 * 86400000))
      return out('blocked', 'exception-date-window');
    if (expires <= now.getTime()) return out('blocked', 'exception-expired');
    if (item.predecessor_id !== null) {
      const predecessor = ids.get(item.predecessor_id);
      if (!predecessor) return out('blocked', 'exception-predecessor-missing');
      if (Date.parse(predecessor.expires_at) > now.getTime())
        return out('blocked', 'exception-predecessor-active');
      for (const field of [
        'finding_id',
        'ecosystem',
        'package',
        'version_or_range',
        'surface',
        'rule_id',
      ])
        if (predecessor[field] !== item[field]) return out('blocked', 'exception-scope-changed');
      if (Date.parse(item.created_at) <= Date.parse(predecessor.created_at))
        return out('blocked', 'exception-renewal-not-new');
    }
    const key = [item.finding_id, item.surface, item.package, item.version_or_range].join('\0');
    if (active.has(key)) return out('blocked', 'exception-duplicate-active');
    active.add(key);
    ids.set(item.exception_id, item);
  }
  return {
    state: 'pass',
    rule_id: 'exception-registry-valid',
    completion: 'complete',
    count: registry.exceptions.length,
  };
}
function valid(x) {
  const keys = [
    'exception_id',
    'predecessor_id',
    'finding_id',
    'ecosystem',
    'package',
    'version_or_range',
    'dependency_path',
    'surface',
    'rule_id',
    'rationale',
    'compensating_control',
    'owner_id',
    'approver_id',
    'created_at',
    'review_at',
    'expires_at',
    'intended_fixed_version',
  ];
  if (!x || Object.keys(x).length !== keys.length || keys.some((key) => !(key in x))) return false;
  if (
    ![x.exception_id, x.finding_id, x.surface, x.rule_id, x.owner_id, x.approver_id].every(
      (value) =>
        typeof value === 'string' && value.length > 0 && value.length <= 128 && !glob.test(value),
    )
  )
    return false;
  if (
    !['npm', 'cargo', 'image', 'configuration', 'license'].includes(x.ecosystem) ||
    !Array.isArray(x.dependency_path) ||
    x.dependency_path.length < 1 ||
    x.dependency_path.length > 64 ||
    x.dependency_path.some((value) => typeof value !== 'string' || glob.test(value))
  )
    return false;
  for (const value of [x.package, x.version_or_range, x.intended_fixed_version])
    if (value !== null && (typeof value !== 'string' || !value || glob.test(value))) return false;
  return (
    typeof x.rationale === 'string' &&
    x.rationale.length > 0 &&
    typeof x.compensating_control === 'string' &&
    x.compensating_control.length > 0
  );
}
const out = (state, rule_id) => ({
  state,
  rule_id,
  completion: state === 'blocked' ? 'malformed' : 'complete',
  count: 1,
});
