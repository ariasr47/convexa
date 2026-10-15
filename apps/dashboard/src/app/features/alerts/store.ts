/**
 * Durable client store for alert rules + recent events (localStorage).
 * Server does not own alerts yet — multi-device sync is a later slice.
 */
import { demoStorageKey } from '@convexa/api';
import {
  ALERTS_KEY,
  ALERTS_MAX_EVENTS,
  type AlertEvent,
  type AlertRule,
  type AlertsState,
} from './types';

function empty(): AlertsState {
  return { schema_version: 1, rules: [], events: [], notifyBrowser: false };
}

let memory: AlertsState | null = null;
let version = 0;
const listeners = new Set<() => void>();

/**
 * The read-fault latch (curvature-v2-surfaces SPEC §2.5, criteria 51/52/70/N-5).
 *
 * `readAlerts()`'s catch branch below sets this true the moment `JSON.parse` throws — correct so
 * far, nothing has been written yet. But the SHIPPED defect was the next write: `upsertRule` /
 * `pushEvent` / `setNotifyBrowser` all call `persist()`, which unconditionally `setItem`s the
 * degraded-to-empty in-memory state over the SAME key the corrupt blob still occupies, destroying
 * it. This latch closes that loss path: once a read has faulted, `persist()` keeps updating
 * `memory` (so the session still functions) and still calls `notify()` (so subscribers still
 * re-render), but skips `localStorage.setItem` entirely for the rest of the session. It is a
 * READ-PATH guarantee, not a key or shape change — `ALERTS_KEY`, `AlertsState` and `AlertEvent`
 * are untouched, which is why criterion 51 is a no-op migration rather than a version chain.
 *
 * Per-session, never auto-clears (case c of `store.spec.ts`): there is no code path that sets this
 * back to `false`. A reload is the only way to re-attempt the read.
 */
let readFaulted = false;

/** Exported for the UI (`/alerts`, PLAN N-5) — the SAME shape as positions' `faulted` posture. */
export function alertsReadFaulted(): boolean {
  return readFaulted;
}

function notify() {
  version += 1;
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeAlerts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAlertsVersion(): number {
  return version;
}

/** Returns whether the write reached localStorage (false: faulted read, quota or private mode). */
function persist(state: AlertsState): boolean {
  memory = state;
  let written = false;
  // While the read is faulted, the durable key is left EXACTLY as the corrupt blob left it — never
  // overwritten by the degraded-to-empty in-memory state (criterion 52's loss-free guarantee). The
  // in-memory update and the notify() below still happen, so the current session is not wedged.
  if (!readFaulted) {
    try {
      localStorage.setItem(demoStorageKey(ALERTS_KEY), JSON.stringify(state));
      written = true;
    } catch {
      /* quota / private mode — keep memory only */
    }
  }
  notify();
  return written;
}

export function readAlerts(): AlertsState {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(demoStorageKey(ALERTS_KEY));
    if (!raw) {
      memory = empty();
      return memory;
    }
    const parsed = JSON.parse(raw) as Partial<AlertsState>;
    memory = {
      schema_version: 1,
      rules: Array.isArray(parsed.rules) ? (parsed.rules as AlertRule[]) : [],
      events: Array.isArray(parsed.events) ? (parsed.events as AlertEvent[]) : [],
      notifyBrowser: parsed.notifyBrowser === true,
    };
  } catch {
    readFaulted = true;
    memory = empty();
  }
  return memory;
}

export function listRules(): AlertRule[] {
  return readAlerts().rules;
}

export function listEvents(): AlertEvent[] {
  return readAlerts().events;
}

/** Returns whether the rule was written to this browser's storage. */
export function upsertRule(rule: AlertRule): boolean {
  const s = readAlerts();
  const i = s.rules.findIndex((r) => r.id === rule.id);
  const rules = [...s.rules];
  if (i >= 0) rules[i] = rule;
  else rules.push(rule);
  return persist({ ...s, rules });
}

export function removeRule(id: string): void {
  const s = readAlerts();
  persist({ ...s, rules: s.rules.filter((r) => r.id !== id) });
}

export function pushEvent(ev: AlertEvent): void {
  const s = readAlerts();
  const events = [ev, ...s.events].slice(0, ALERTS_MAX_EVENTS);
  persist({ ...s, events });
}

/** Record one round of public-data checks in a single write: each checked rule's new memory, and
 *  the firings it produced (newest first). A rule removed while the checks ran stays removed. */
export function recordChecks(updated: AlertRule[], events: AlertEvent[]): void {
  const s = readAlerts();
  const byId = new Map(updated.map((r) => [r.id, r]));
  const rules = s.rules.map((r) => {
    const u = byId.get(r.id);
    // The reader may have switched it off or edited it meanwhile: keep their fields, take the memory.
    return u ? { ...r, fired: u.fired, inZone: u.inZone, check: u.check } : r;
  });
  const live = new Set(rules.map((r) => r.id));
  const kept = events.filter((e) => live.has(e.ruleId));
  persist({ ...s, rules, events: [...kept, ...s.events].slice(0, ALERTS_MAX_EVENTS) });
}

export function markAllEventsRead(): void {
  const s = readAlerts();
  persist({ ...s, events: s.events.map((e) => ({ ...e, read: true })) });
}

export function setNotifyBrowser(on: boolean): void {
  const s = readAlerts();
  persist({ ...s, notifyBrowser: on });
}

export function newRuleId(): string {
  return `ar_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Test/internal seam: reset the in-memory cache AND the latch, mirroring
 *  `features/trading/positions/store.ts`'s `__resetMemory` idiom. */
export function __resetAlertsMemory() {
  memory = null;
  readFaulted = false;
}
