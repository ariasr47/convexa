/**
 * store.spec.ts — curvature-v2-surfaces FE-9 (SPEC §2.5; criteria 51 (SB), 52 (SB), 70 (SB), N-5).
 *
 * The live `[loss-free-durable-migration]` breach this task repairs: `readAlerts()`'s catch branch
 * degrades to `empty()` on a parse failure — correct so far, nothing written — but the NEXT
 * `upsertRule` / `pushEvent` / `setNotifyBrowser` called `persist()`, which unconditionally
 * `setItem`s the empty state over the SAME key the corrupt blob still occupies, destroying it. The
 * read-fault latch (`readFaulted`, module-level in `store.ts`) closes that loss path.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __resetAlertsMemory,
  alertsReadFaulted,
  listEvents,
  listRules,
  readAlerts,
  setNotifyBrowser,
  upsertRule,
} from './store';
import { ALERTS_KEY, type AlertEvent, type AlertRule, type AlertsState } from './types';

beforeEach(() => {
  localStorage.clear();
  __resetAlertsMemory();
});
afterEach(() => {
  localStorage.clear();
  __resetAlertsMemory();
});

const ruleA: AlertRule = {
  id: 'ar_pre1',
  kind: 'score_gate',
  symbol: 'SPY',
  enabled: true,
  createdAt: 1,
  scoreMin: 72,
};
const ruleB: AlertRule = {
  id: 'ar_pre2',
  kind: 'tier_change',
  symbol: 'TSLA',
  enabled: false, // deliberately disabled — proves `enabled` round-trips exactly as saved
  createdAt: 2,
};
const eventA: AlertEvent = {
  id: 'ev_pre1',
  ruleId: 'ar_pre1',
  kind: 'score_gate',
  symbol: 'SPY',
  message: 'SPY score ≥ 72 (now 80)',
  at: 3,
  read: true,
};
const eventB: AlertEvent = {
  id: 'ev_pre2',
  ruleId: 'ar_pre2',
  kind: 'tier_change',
  symbol: 'TSLA',
  message: 'TSLA tier watch → actionable',
  at: 4,
  read: false,
};

/** A blob captured BEFORE this phase — the shipped writer's own shape, `AlertsState` unchanged by
 *  this task (no key, no shape migration; criterion 51 is a no-op migration). */
function prePhaseBlob(): string {
  const state: AlertsState = {
    schema_version: 1,
    rules: [ruleA, ruleB],
    events: [eventB, eventA], // newest-first, matching `pushEvent`'s own ordering
    notifyBrowser: true,
  };
  return JSON.stringify(state);
}

describe('51/70 (SB) — every pre-phase rule and firing is present after this phase, enabled/read exactly as saved', () => {
  it('reads a pre-phase blob back byte-for-byte in shape, with `enabled` and `read` untouched', () => {
    localStorage.setItem(ALERTS_KEY, prePhaseBlob());
    const rules = listRules();
    const events = listEvents();
    expect(rules).toEqual([ruleA, ruleB]);
    expect(rules.find((r) => r.id === 'ar_pre2')?.enabled).toBe(false); // exactly as saved
    expect(events).toEqual([eventB, eventA]);
    expect(events.find((e) => e.id === 'ev_pre1')?.read).toBe(true);
    expect(events.find((e) => e.id === 'ev_pre2')?.read).toBe(false);
    expect(alertsReadFaulted()).toBe(false); // a healthy pre-phase blob never latches
  });
});

describe('52 (SB) — an unreadable blob degrades to empty WITHOUT overwriting the stored original', () => {
  it('a corrupt blob renders the empty state and never throws', () => {
    localStorage.setItem(ALERTS_KEY, '{not json');
    expect(() => readAlerts()).not.toThrow();
    const s = readAlerts();
    expect(s.rules).toEqual([]);
    expect(s.events).toEqual([]);
    expect(alertsReadFaulted()).toBe(true);
  });

  it('MUTATION PROOF N target — localStorage.getItem(ALERTS_KEY) is BYTE-IDENTICAL to the corrupt original after a subsequent upsertRule', () => {
    const corrupt = '{not json, and definitely not an AlertsState';
    localStorage.setItem(ALERTS_KEY, corrupt);
    readAlerts(); // faults, degrades to empty in memory — nothing written yet
    upsertRule({ ...ruleA, id: 'ar_after_fault' }); // the loss path: this used to overwrite the key
    // The RAW STORED STRING, not the parsed object — an assertion on the parsed value cannot see
    // the overwrite the mutation proof targets (per PLAN's own reviewer probe).
    expect(localStorage.getItem(ALERTS_KEY)).toBe(corrupt);
  });
});

describe('N-5 / case (c) — the latch is per-session and never auto-clears', () => {
  it('stays latched across repeated writes; none of them is ever persisted', () => {
    const corrupt = '{ broken';
    localStorage.setItem(ALERTS_KEY, corrupt);
    readAlerts();
    expect(alertsReadFaulted()).toBe(true);

    upsertRule({ ...ruleA, id: 'first-write' });
    expect(localStorage.getItem(ALERTS_KEY)).toBe(corrupt);
    expect(alertsReadFaulted()).toBe(true); // still latched — not a one-shot refusal

    setNotifyBrowser(true);
    expect(localStorage.getItem(ALERTS_KEY)).toBe(corrupt);
    expect(alertsReadFaulted()).toBe(true);

    // Even a call that LOOKS like a fresh read (readAlerts again) does not re-attempt the parse or
    // clear the latch — `memory` is already cached from the fault.
    readAlerts();
    expect(alertsReadFaulted()).toBe(true);
  });
});

describe('case (d) — anti-vacuity: the latch does not disable writing in the happy path', () => {
  it('a healthy read still persists normally', () => {
    localStorage.setItem(ALERTS_KEY, prePhaseBlob());
    readAlerts();
    expect(alertsReadFaulted()).toBe(false);

    upsertRule({ ...ruleA, scoreMin: 90 });
    const stored = JSON.parse(localStorage.getItem(ALERTS_KEY) ?? '{}') as AlertsState;
    expect(stored.rules.find((r) => r.id === 'ar_pre1')?.scoreMin).toBe(90);
  });

  it('a fresh (never-written) key is also healthy — no key at all is not a fault', () => {
    expect(alertsReadFaulted()).toBe(false);
    readAlerts();
    expect(alertsReadFaulted()).toBe(false);
    upsertRule(ruleA);
    expect(localStorage.getItem(ALERTS_KEY)).not.toBeNull();
  });
});

describe('the durable shape is untouched by this task (SPEC §2.5)', () => {
  it('`message` is never deleted from a stored event, even after other fields change', () => {
    localStorage.setItem(ALERTS_KEY, prePhaseBlob());
    readAlerts();
    upsertRule({ ...ruleA, scoreMin: 50 });
    const stored = JSON.parse(localStorage.getItem(ALERTS_KEY) ?? '{}') as AlertsState;
    expect(stored.events.map((e) => e.message)).toEqual([eventB.message, eventA.message]);
  });

  it('readAlerts never throws even given non-object JSON', () => {
    localStorage.setItem(ALERTS_KEY, '42');
    expect(() => readAlerts()).not.toThrow();
    // `42` parses fine (not a parse failure) but has no `.rules`/`.events` — the existing
    // Array.isArray guards degrade it to empty arrays without latching (only a PARSE failure
    // latches; a wrong-shaped-but-parseable value is read-new-else-old's job, unaffected here).
    expect(listRules()).toEqual([]);
    expect(listEvents()).toEqual([]);
  });
});
