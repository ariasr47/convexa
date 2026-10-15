/**
 * useAlerts — rules + events + evaluate-on-snap + optional browser notifications.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { evaluateRule, type EvalMemory, type StructureSnap } from './evaluate';
import { isStructureKind } from './kinds';
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
import type { AlertRule } from './types';

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

/**
 * Whether a firing of this rule becomes a browser notification (W1-14). The page-wide flag ("Turn
 * on" / "Turn off" on the Alerts page) is the master switch: off, nothing notifies, whatever a rule
 * says. On, a rule notifies unless its own switch is off; a rule saved before rules had a switch
 * (`notify` absent) follows the page.
 */
export function shouldNotify(
  rule: Pick<AlertRule, 'notify'> | undefined,
  pageOn: boolean,
): boolean {
  return pageOn && (rule?.notify ?? true);
}

/**
 * Some browsers expose `Notification` and grant permission but refuse the page-context constructor
 * (Chrome on Android: "Illegal constructor. Use ServiceWorkerRegistration.showNotification()"), and
 * this app registers no service worker. Once a construction throws that TypeError, notifications
 * are unavailable here for the session, and the controls say so instead of claiming "on" (W1-18).
 */
let notifyBroken = false;
const permissionListeners = new Set<() => void>();
function markNotifyBroken() {
  if (notifyBroken) return;
  notifyBroken = true;
  permissionListeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

export function currentNotifyPermission(): NotifyPermission {
  if (notifyBroken || typeof Notification === 'undefined') return 'unavailable';
  return Notification.permission;
}

/** Constructs one notification; false when this browser refuses the constructor. */
function construct(title: string, options: NotificationOptions): boolean {
  try {
    new Notification(title, options);
    return true;
  } catch (e) {
    if (e instanceof TypeError) markNotifyBroken();
    return false;
  }
}

/**
 * A browser notification, when the browser allows them; otherwise nothing (the page still lists it).
 * `tag` is the firing's own id, so two firings in one check don't replace each other (W1-51).
 */
export function deliverBrowser(title: string, body: string, tag: string) {
  if (currentNotifyPermission() !== 'granted') return;
  construct(title, { body, tag: `convexa-${tag}` });
}

/** Test seam: forget a refused constructor. */
export function __resetNotifyBroken() {
  notifyBroken = false;
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
      (r) =>
        r.enabled &&
        isStructureKind(r.kind) &&
        r.symbol.toUpperCase() === snap.symbol.toUpperCase(),
    );
    const pageOn = readAlerts().notifyBrowser;
    for (const rule of rules) {
      const mem = memByRule.get(rule.id) ?? {};
      const { event, memory } = evaluateRule(rule, snap, mem);
      memByRule.set(rule.id, memory);
      if (event) {
        pushEvent(event);
        if (shouldNotify(rule, pageOn))
          deliverBrowser(`Convexa · ${event.symbol}`, event.message, event.id);
      }
    }
  }, []);

  /** Save a new rule from the new-alert flow; the id, `enabled` and `createdAt` are set here. */
  const addRule = useCallback((partial: Omit<AlertRule, 'id' | 'enabled' | 'createdAt'>) => {
    const rule: AlertRule = {
      ...partial,
      id: newRuleId(),
      symbol: partial.symbol.toUpperCase(),
      enabled: true,
      createdAt: Date.now(),
    };
    return { rule, saved: upsertRule(rule) };
  }, []);

  /** Opens the browser's own prompt; callers show Convexa's ask first (NotifyAskDialog). Right
   *  after a grant, one confirming notification proves this browser can show them at all: where the
   *  constructor is refused, the control reads "not available here" instead of "on". */
  const requestBrowserPermission = useCallback(async () => {
    try {
      if (currentNotifyPermission() === 'unavailable') {
        setNotifyPermission('unavailable');
        return false;
      }
      const p = await Notification.requestPermission();
      const ok =
        p === 'granted' &&
        construct('Convexa', {
          body: 'Browser notifications are on. Fired alerts show like this.',
          tag: 'convexa-notify-on',
        });
      setNotifyPermission(currentNotifyPermission());
      setNotifyBrowser(ok);
      return ok;
    } catch {
      setNotifyBrowser(false);
      return false;
    }
  }, []);

  // Read the browser's answer on mount, and again when a notification turns out to be impossible
  // here. It never turns notifications on by itself: a trader who pressed "Turn off" stays off
  // across reloads even though the browser still grants permission.
  useEffect(() => {
    const sync = () => setNotifyPermission(currentNotifyPermission());
    sync();
    permissionListeners.add(sync);
    return () => {
      permissionListeners.delete(sync);
    };
  }, []);

  /** Turn notifications on. With permission already granted no browser prompt is needed; otherwise
   *  the caller has shown Convexa's own ask first, and this opens the browser's prompt. */
  const enableBrowserNotify = useCallback(async () => {
    if (currentNotifyPermission() === 'granted') {
      setNotifyPermission('granted');
      setNotifyBrowser(true);
      return true;
    }
    return requestBrowserPermission();
  }, [requestBrowserPermission]);

  /** "Turn off": stops every rule's notifications from Convexa (the page flag is the master
   *  switch), without touching the browser's own permission. */
  const turnOffBrowserNotify = useCallback(() => setNotifyBrowser(false), []);

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
    enableBrowserNotify,
    turnOffBrowserNotify,
  };
}
