import assert from 'node:assert/strict';
import test from 'node:test';
import { applyWaivers, hasBlockingAxeFinding, validateWaivers } from './lib/a11y.mjs';

test('empty waiver inventory is valid and serious findings block', () => {
  assert.deepEqual(validateWaivers([]), []);
  const finding = {
    scan_id: 'A11Y-1',
    route: '/',
    state: 'dark',
    rule_id: 'x',
    impact: 'serious',
    help_url: 'https://deque.invalid/x',
    target_selector: '#x',
    waived: false,
    waiver_id: null,
  };
  assert.equal(hasBlockingAxeFinding([finding]), true);
});
test('moderate findings remain non-blocking and exact waivers apply', () => {
  const finding = {
    scan_id: 'A11Y-1',
    route: '/',
    state: 'dark',
    rule_id: 'x',
    impact: 'moderate',
    help_url: 'https://deque.invalid/x',
    target_selector: '#x',
    waived: false,
    waiver_id: null,
  };
  const waiver = {
    waiver_id: 'w1',
    type: 'axe_false_positive',
    scan_id: 'A11Y-1',
    rule_id: 'x',
    target_selector: '#x',
    evidence: 'fixture evidence',
    rationale: 'fixture reason',
    owner: 'qa',
    removal_condition: 'fixed',
    expires_at: '2099-01-01T00:00:00Z',
  };
  const output = applyWaivers([finding], validateWaivers([waiver]));
  assert.equal(output[0].waived, true);
  assert.equal(hasBlockingAxeFinding(output), false);
});
test('waivers reject broad or expired records', () => {
  assert.throws(() =>
    validateWaivers([
      {
        waiver_id: 'w1',
        type: 'axe_false_positive',
        scan_id: 'A11Y-1',
        rule_id: 'x',
        target_selector: '*',
        evidence: 'x',
        rationale: 'x',
        owner: 'qa',
        removal_condition: 'x',
        expires_at: '2000-01-01T00:00:00Z',
      },
    ]),
  );
});

test('waivers reject every missing required evidence field', () => {
  const waiver = {
    waiver_id: 'w1',
    type: 'axe_false_positive',
    scan_id: 'A11Y-1',
    rule_id: 'x',
    target_selector: '#x',
    evidence: 'fixture evidence',
    rationale: 'fixture reason',
    owner: 'qa',
    removal_condition: 'fixed',
    expires_at: '2099-01-01T00:00:00Z',
  };
  for (const field of Object.keys(waiver)) {
    const poisoned = { ...waiver, [field]: undefined };
    assert.throws(() => validateWaivers([poisoned]));
  }
});
