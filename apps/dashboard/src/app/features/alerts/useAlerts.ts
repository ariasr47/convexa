/**
 * useAlerts — rules + events + evaluate-on-snap + optional browser notifications.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { evaluateRule, type EvalMemory, type StructureSnap } from './evaluate';
import {
  getAlertsVersion,
  listRules,
  markAllEventsRead,
  newRuleId,
  pushEvent,
  readAlerts,
  removeRule,
  setNotifyBrowser,
  subscribeAlerts,
  upsertRule,
} from './store';
import type { AlertKind, AlertRule, LevelRef } from './types';

const memByRule = new Map<string, EvalMemory>();

/**
 * Criterion 48 — the third empty ("nothing evaluated yet") needs an EPHEMERAL, per-session marker
 * distinct from "rules armed, nothing fired". In-memory only — no new durable key (constraint 14).
 */
let evaluatedThisSession = false;

/** Criterion 50: the page must be able to say WHY notify reads as off — denied, or the API is
 *  simply unavailable in this browser (jsdom, older browsers, some in-app webviews) — never just
 *  a silent "off" indistinguishable from "never asked". */
export type NotifyPermission = NotificationPermission | 'unavailable';

function currentNotifyPermission(): NotifyPermission {
  return typeof Notification === 'undefined' ? 'unavailable' : Notification.permission;
}

function deliverBrowser(title: string, body: string) {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    new Notification(title, { body, tag: `convexa-${title}` });
  } catch {
    /* ignore */
  }
}

export function useAlerts() {
  const version = useSyncExternalStore(subscribeAlerts, getAlertsVersion, () => 0);
  // version bumps re-read
  void version;
  const state = readAlerts();
  const [notifyPermission, setNotifyPermission] =
    useState<NotifyPermission>(currentNotifyPermission);

  const evaluateSnap = useCallback((snap: StructureSnap) => {
    evaluatedThisSession = true;
    const rules = listRules().filter(
      (r) => r.enabled && r.symbol.toUpperCase() === snap.symbol.toUpperCase(),
    );
    const notify = readAlerts().notifyBrowser;
    for (const rule of rules) {
      const mem = memByRule.get(rule.id) ?? {};
      const { event, memory } = evaluateRule(rule, snap, mem);
      memByRule.set(rule.id, memory);
      if (event) {
        pushEvent(event);
        if (notify) deliverBrowser(`Convexa · ${event.symbol}`, event.message);
      }
    }
  }, []);

  const addRule = useCallback(
    (partial: {
      kind: AlertKind;
      symbol: string;
      level?: LevelRef;
      priceThreshold?: number;
      scoreMin?: number;
      note?: string;
    }) => {
      const rule: AlertRule = {
        id: newRuleId(),
        kind: partial.kind,
        symbol: partial.symbol.toUpperCase(),
        enabled: true,
        createdAt: Date.now(),
        level: partial.level,
        priceThreshold: partial.priceThreshold,
        scoreMin: partial.scoreMin,
        note: partial.note,
      };
      upsertRule(rule);
      return rule;
    },
    [],
  );

  const requestBrowserPermission = useCallback(async () => {
    try {
      if (typeof Notification === 'undefined') {
        setNotifyPermission('unavailable');
        return false;
      }
      const p = await Notification.requestPermission();
      setNotifyPermission(p);
      const ok = p === 'granted';
      setNotifyBrowser(ok);
      return ok;
    } catch {
      setNotifyBrowser(false);
      return false;
    }
  }, []);

  useEffect(() => {
    const p = currentNotifyPermission();
    setNotifyPermission(p);
    if (p === 'granted') setNotifyBrowser(true);
  }, []);

  // Criterion 50: the control never reads as "on" for a permission the browser did not grant —
  // computed from the ACTUAL permission, not trusted blindly from the durable flag (which could
  // read stale-`true` if the trader revoked the browser permission after granting it once; this
  // app has no event to observe that revocation, so the display must not take the flag's word for
  // it — only `Notification.permission === 'granted'` can).
  const notifyOn = notifyPermission === 'granted' && state.notifyBrowser;

  return {
    rules: state.rules,
    events: state.events,
    unread: state.events.filter((e) => !e.read).length,
    notifyBrowser: notifyOn,
    notifyPermission,
    hasEvaluated: evaluatedThisSession,
    addRule,
    removeRule,
    upsertRule,
    markAllEventsRead,
    evaluateSnap,
    requestBrowserPermission,
  };
}
