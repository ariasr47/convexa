/**
 * Alerts — client rules, kept in this browser (localStorage `convexa.alerts.v1`).
 *
 * Two families share one store:
 * - structure kinds (level touch, tier change, score gate) evaluate against the options feed's
 *   structure snapshots while a ticker desk is open (`evaluate.ts`);
 * - public-data kinds (Q-5: results approaching, new filing, insider cluster, positioning extreme,
 *   short interest change, note coming due) evaluate against `/api/public-data/*` and the research
 *   notes when the Alerts page opens (`publicRules.ts`, `usePublicChecks.ts`).
 *
 * Every field added for the public kinds is optional, so a blob written before them reads back
 * unchanged (store.spec.ts, criterion 51).
 */

export type StructureKind = 'level_touch' | 'tier_change' | 'score_gate';
export type PublicKind = 'results' | 'filing' | 'cluster' | 'cftc' | 'si' | 'note';
export type AlertKind = StructureKind | PublicKind;

export type LevelRef = 'call_wall' | 'put_wall' | 'gamma_flip' | 'price';

/** The 10-K/10-Q/8-K forms a new-filing rule can follow. */
export type FilingForm = '8-K' | '10-Q' | '10-K';

/** CFTC Traders in Financial Futures groups, as the API names them. */
export type TraderGroup = 'asset_managers' | 'leveraged_funds' | 'dealers' | 'other_reportables';

/** What a check last found for a rule: shown on its row, never used to decide a firing. */
export interface RuleCheck {
  /** When this browser ran the check (epoch ms). */
  at: number;
  /** What the check concluded. `unchecked`: the kind can't be checked here (SEC not set up, or
   *  the data it needs isn't served). `unavailable`: the source didn't answer. */
  outcome: 'quiet' | 'fired' | 'unchecked' | 'unavailable';
  /** The date the source's figures are as of (YYYY-MM-DD), when there is one. */
  asOf?: string;
  /** One short line on the row: why it couldn't check, or what it read. */
  note?: string;
}

export interface AlertRule {
  id: string;
  kind: AlertKind;
  /** Uppercase symbol; for a positioning rule, the CFTC contract code. */
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

  // ---- public-data kinds (all optional) ----
  /** results: days before the expected date. note: the review window, in days. */
  days?: number;
  /** filing: the forms followed. */
  forms?: FilingForm[];
  /** filing: 8-K items followed ("2.02"); empty or absent means any item. */
  items?: string[];
  /** cftc: the contract's display name ("10-year T-note"). */
  marketName?: string;
  /** cftc: the trader group watched. */
  group?: TraderGroup;
  /** cftc: which end of the three-year range. */
  extreme?: 'high' | 'low' | 'either';
  /** cftc: at the extreme itself, or within 5% of the range from it. */
  closeness?: 'at' | 'within5';
  /** si: what moves. */
  siMode?: 'change' | 'dtc';
  /** si change: percent move between two settlements, either direction (5–100). */
  changePct?: number;
  /** si dtc: the days-to-cover level. */
  dtcLevel?: number;
  /** Browser notification for this rule (absent on rules saved before: the page-wide flag rules). */
  notify?: boolean;

  // ---- check memory (written by the checks, never by the reader) ----
  /** Keys of what this rule already fired on (an accession, a settlement, a report date), newest
   *  last, at most 50: the same publication never fires twice. */
  fired?: string[];
  /** Zone kinds (positioning extreme, days to cover): true while the last check was inside the
   *  zone, so the rule fires on entering it and re-arms only after leaving. */
  inZone?: boolean;
  /** The last check's result. */
  check?: RuleCheck;
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
  /** Public kinds: the source, as its chip reads ("CFTC · TFF · Oct 9"). */
  source?: string;
  /** Where to read more. */
  link?: { label: string; href: string };
  /** The demo scenario's authored firing: dashed and marked Sample. */
  sample?: boolean;
  /** The firing's own date (YYYY-MM-DD) when it is a publication's, not the check's. */
  date?: string;
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
export const FIRED_KEYS_MAX = 50;
