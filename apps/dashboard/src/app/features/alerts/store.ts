/**
 * Durable client store for alert rules + recent events (localStorage).
 * Server does not own alerts yet — multi-device sync is a later slice.
 */
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

function persist(state: AlertsState) {
  memory = state;
  try {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode — keep memory only */
  }
  notify();
}

export function readAlerts(): AlertsState {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(ALERTS_KEY);
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

export function upsertRule(rule: AlertRule): void {
  const s = readAlerts();
  const i = s.rules.findIndex((r) => r.id === rule.id);
  const rules = [...s.rules];
  if (i >= 0) rules[i] = rule;
  else rules.push(rule);
  persist({ ...s, rules });
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
