/**
 * Durable client store for alert rules + recent events (localStorage).
 * Server does not own alerts yet — multi-device sync is a later slice.
 */
import { demoStorageKey } from '@convexa/api';
import {
  ALERTS_KEY,
  ALERTS_MAX_EVENTS,
  FIRED_KEYS_MAX,
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

/** Another tab wrote the alerts: drop this tab's copy so the next read (and the next check's merge)
 *  starts from what is stored, not from a snapshot that predates the other tab's firings. A faulted
 *  read keeps its latch: nothing here re-enables writes over a blob this tab couldn't parse. */
export function onStorageEvent(e: Pick<StorageEvent, 'key'>): void {
  if (readFaulted) return;
  if (e.key !== null && e.key !== demoStorageKey(ALERTS_KEY)) return;
  memory = null;
  notify();
}
if (typeof window !== 'undefined') {
  try {
    window.addEventListener('storage', onStorageEvent);
  } catch {
    /* no window events: one tab only */
  }
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

/**
 * Record one round of public-data checks in a single write: each checked rule's new memory, and the
 * firings it produced (newest first). Returns the events actually recorded, the only ones to notify.
 *
 * The round ran on a snapshot taken before its reads, so it merges against the store as it is now:
 * - a rule removed meanwhile stays removed, and its firings are dropped;
 * - a rule edited meanwhile (its `rev` moved on) keeps its new settings AND its own memory: the
 *   round's `fired`, `inZone` and `check` describe the old settings;
 * - a firing whose key is already in the rule's `fired` (another round, a remount or a second tab,
 *   recorded it first) is dropped, so the same publication never lists or notifies twice.
 */
export function recordChecks(updated: AlertRule[], events: AlertEvent[]): AlertEvent[] {
  const s = readAlerts();
  const byId = new Map(updated.map((r) => [r.id, r]));
  const now = new Map(s.rules.map((r) => [r.id, r]));
  const kept = events.filter((e) => {
    const r = now.get(e.ruleId);
    const u = byId.get(e.ruleId);
    if (!r || !u || (r.rev ?? 0) !== (u.rev ?? 0)) return false;
    return !e.key || !(r.fired ?? []).includes(e.key);
  });
  const newKeys = new Map<string, string[]>();
  for (const e of kept) if (e.key) newKeys.set(e.ruleId, [...(newKeys.get(e.ruleId) ?? []), e.key]);
  const rules = s.rules.map((r) => {
    const u = byId.get(r.id);
    if (!u || (r.rev ?? 0) !== (u.rev ?? 0)) return r;
    // The reader may have switched it off meanwhile: keep their fields, take the memory.
    const fired = [...(r.fired ?? []), ...(newKeys.get(r.id) ?? [])].slice(-FIRED_KEYS_MAX);
    return { ...r, fired, inZone: u.inZone, check: u.check };
  });
  persist({ ...s, rules, events: [...kept, ...s.events].slice(0, ALERTS_MAX_EVENTS) });
  return kept;
}

/**
 * A rule after the reader edits it (W1-47, W1-48). The edit bumps `rev`, so a check already running
 * on the old settings can't write its memory over the new ones; the next check starts fresh (`check`
 * and `inZone` cleared). When what the rule watches changes (kind, ticker, forms or 8-K items), it
 * counts as a new rule: `createdAt` moves to now and `fired` empties, so the new ticker's past
 * filings don't all fire at once. Otherwise what already fired stays fired.
 */
export function applyEdit(existing: AlertRule, patch: Partial<AlertRule>, now: number): AlertRule {
  const next: AlertRule = {
    ...existing,
    ...patch,
    id: existing.id,
    rev: (existing.rev ?? 0) + 1,
    check: undefined,
    inZone: undefined,
  };
  const set = (xs?: string[]) => [...(xs ?? [])].sort().join(',');
  const watches =
    next.kind !== existing.kind ||
    next.symbol !== existing.symbol ||
    set(next.forms) !== set(existing.forms) ||
    set(next.items) !== set(existing.items);
  if (watches) {
    next.createdAt = now;
    next.fired = [];
  } else {
    next.createdAt = existing.createdAt;
    next.fired = existing.fired;
  }
  return next;
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
