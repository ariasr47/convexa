const ID = /^[a-z0-9][a-z0-9._-]+$/;
export function validateWaivers(waivers) {
  if (!Array.isArray(waivers)) throw new Error('waivers must be an array');
  const ids = new Set();
  return waivers.map((value) => {
    if (
      !value ||
      typeof value.waiver_id !== 'string' ||
      !ID.test(value.waiver_id) ||
      ids.has(value.waiver_id) ||
      !['axe_false_positive', 'third_party_uncontrolled'].includes(value.type) ||
      !value.scan_id ||
      !value.rule_id ||
      !value.target_selector ||
      value.target_selector === '*' ||
      !value.evidence ||
      !value.rationale ||
      !value.owner ||
      !value.removal_condition ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value.expires_at) ||
      Date.parse(value.expires_at) <= Date.now()
    )
      throw new Error('invalid waiver');
    ids.add(value.waiver_id);
    return value;
  });
}
export function applyWaivers(findings, waivers) {
  return findings.map((finding) => {
    const waiver = waivers.find(
      (w) =>
        w.scan_id === finding.scan_id &&
        w.rule_id === finding.rule_id &&
        w.target_selector.trim().replace(/\s+/g, ' ') ===
          finding.target_selector.trim().replace(/\s+/g, ' '),
    );
    return { ...finding, waived: Boolean(waiver), waiver_id: waiver?.waiver_id ?? null };
  });
}
export function hasBlockingAxeFinding(findings) {
  return findings.some((f) => !f.waived && ['serious', 'critical'].includes(f.impact));
}
