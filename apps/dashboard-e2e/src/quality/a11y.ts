export type AxeFinding = {
  scan_id: string;
  route: string;
  state: string;
  rule_id: string;
  impact: string | null;
  help_url: string;
  target_selector: string;
  waived: boolean;
  waiver_id: string | null;
};
export type Waiver = {
  waiver_id: string;
  type: 'axe_false_positive' | 'third_party_uncontrolled';
  scan_id: string;
  rule_id: string;
  target_selector: string;
  evidence: string;
  rationale: string;
  owner: string;
  removal_condition: string;
  expires_at: string;
};
const ID = /^[a-z0-9][a-z0-9._-]+$/;
export function validateWaivers(waivers: unknown): Waiver[] {
  if (!Array.isArray(waivers)) throw new Error('waivers must be an array');
  const ids = new Set<string>();
  return waivers.map((w) => {
    if (!w || typeof w !== 'object') throw new Error('invalid waiver');
    const value = w as Waiver;
    if (
      typeof value.waiver_id !== 'string' ||
      !ID.test(value.waiver_id) ||
      ids.has(value.waiver_id) ||
      !['axe_false_positive', 'third_party_uncontrolled'].includes(value.type) ||
      !value.scan_id ||
      !value.rule_id ||
      !value.target_selector ||
      value.target_selector.trim() === '*' ||
      !value.evidence ||
      !value.rationale ||
      !value.owner ||
      !value.removal_condition
    )
      throw new Error('invalid waiver fields');
    if (
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value.expires_at) ||
      Date.parse(value.expires_at) <= Date.now()
    )
      throw new Error('waiver expiry must be future UTC');
    ids.add(value.waiver_id);
    return value;
  });
}
export function applyWaivers(findings: AxeFinding[], waivers: Waiver[]) {
  return findings.map((finding) => {
    const waiver = waivers.find(
      (w) =>
        w.scan_id === finding.scan_id &&
        w.rule_id === finding.rule_id &&
        normalizeSelector(w.target_selector) === normalizeSelector(finding.target_selector),
    );
    return { ...finding, waived: Boolean(waiver), waiver_id: waiver?.waiver_id ?? null };
  });
}
export function normalizeSelector(selector: string) {
  return selector.trim().replace(/\s+/g, ' ');
}
export function hasBlockingAxeFinding(findings: AxeFinding[]) {
  return findings.some(
    (finding) => !finding.waived && ['serious', 'critical'].includes(finding.impact ?? ''),
  );
}
