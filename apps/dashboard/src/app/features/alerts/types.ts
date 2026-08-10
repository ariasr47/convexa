/**
 * Alerts v1 — client rules for level-touch, tier-change, and score-gate.
 * Evaluation is local (ticker/scan snapshots); delivery is in-app + optional browser Notification.
 */

export type AlertKind = 'level_touch' | 'tier_change' | 'score_gate';

export type LevelRef = 'call_wall' | 'put_wall' | 'gamma_flip' | 'price';

export interface AlertRule {
  id: string;
  kind: AlertKind;
  /** Uppercase symbol. */
  symbol: string;
  enabled: boolean;
  createdAt: number;
  /** level_touch: which structure level (or raw price threshold). */
  level?: LevelRef;
  /** level_touch on raw price: absolute price threshold. */
  priceThreshold?: number;
  /** score_gate: fire when score crosses at/above this value. */
  scoreMin?: number;
  /** Optional human label. */
  note?: string;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  kind: AlertKind;
  symbol: string;
  message: string;
  at: number;
  /** Structure/score snapshot that triggered (honest context). */
  detail?: string;
  read: boolean;
}

export interface AlertsState {
  schema_version: 1;
  rules: AlertRule[];
  events: AlertEvent[];
  /** Browser Notification permission last known. */
  notifyBrowser: boolean;
}

export const ALERTS_KEY = 'convexa.alerts.v1';
export const ALERTS_MAX_EVENTS = 100;
