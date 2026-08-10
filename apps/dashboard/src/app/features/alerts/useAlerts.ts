/**
 * useAlerts — rules + events + evaluate-on-snap + optional browser notifications.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
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

function deliverBrowser(title: string, body: string) {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    // eslint-disable-next-line no-new
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

  const evaluateSnap = useCallback((snap: StructureSnap) => {
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
      if (typeof Notification === 'undefined') return false;
      const p = await Notification.requestPermission();
      const ok = p === 'granted';
      setNotifyBrowser(ok);
      return ok;
    } catch {
      setNotifyBrowser(false);
      return false;
    }
  }, []);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      setNotifyBrowser(true);
    }
  }, []);

  return {
    rules: state.rules,
    events: state.events,
    unread: state.events.filter((e) => !e.read).length,
    notifyBrowser: state.notifyBrowser,
    addRule,
    removeRule,
    upsertRule,
    markAllEventsRead,
    evaluateSnap,
    requestBrowserPermission,
  };
}
