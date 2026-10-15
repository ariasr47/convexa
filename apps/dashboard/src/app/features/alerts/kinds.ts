/**
 * The six public-data alert kinds (Q-5, ruled "design it now" by the owner, 2026-10-13), each naming
 * its source and how late that source is. Design source: design/src/data/alerts.mjs ALERT_KINDS.
 *
 * One deliberate difference from the boards: they say when a server checks ("Daily, 6:00 AM ET",
 * "Hourly"). No server checks alerts yet; this browser checks when the Alerts page opens. `check`
 * says that, so no rule claims a schedule nothing runs.
 */
import type { PublicKind, StructureKind, TraderGroup } from './types';

export interface PublicKindInfo {
  key: PublicKind;
  name: string;
  /** Fires when … (a sentence, no full stop). */
  fires: string;
  /** The source chip ("SEC EDGAR · Form 4"). */
  chip: string;
  /** How late the source is (a sentence, no full stop). */
  delay: string;
  /** Whether it reads SEC EDGAR: `needs` can't check at all without SEC_USER_AGENT; `partial`
   *  checks part of its rule without it. */
  sec: 'no' | 'partial' | 'needs';
}

export const CHECKS_HERE = 'When you open Alerts, in this browser';

export const PUBLIC_KINDS: PublicKindInfo[] = [
  {
    key: 'results',
    name: 'Results approaching',
    fires: 'A set number of days before a company’s expected results date',
    chip: 'Notes · EDGAR cadence',
    delay:
      'An estimate until the company confirms the date; the alert re-dates itself when the note’s date moves',
    sec: 'partial',
  },
  {
    key: 'filing',
    name: 'New filing',
    fires: 'A followed ticker files an 8-K, 10-Q or 10-K (8-K items optional)',
    chip: 'SEC EDGAR',
    delay: 'EDGAR posts a filing minutes after acceptance',
    sec: 'needs',
  },
  {
    key: 'cluster',
    name: 'Insider cluster',
    fires:
      'Three or more insiders of a followed ticker file Form 4s in the same direction within 10 days',
    chip: 'SEC EDGAR · Form 4',
    delay: 'Insiders file within two business days of a trade',
    sec: 'needs',
  },
  {
    key: 'cftc',
    name: 'Positioning extreme',
    fires:
      'A trader group’s net futures position reaches its 3-year high or low, or comes within 5% of it',
    chip: 'CFTC · TFF',
    delay: 'Positions as of Tuesday, published Friday at 3:30 PM ET',
    sec: 'no',
  },
  {
    key: 'si',
    name: 'Short interest change',
    fires:
      'Shares sold short move past your threshold between two settlements, or days to cover reaches a level',
    chip: 'FINRA · short interest',
    delay: 'Twice a month, published about a week after each settlement',
    sec: 'no',
  },
  {
    key: 'note',
    name: 'Note coming due',
    fires: 'A note’s review date comes within your window, or a filing lands after the note’s date',
    chip: 'Convexa notes',
    delay: 'None: Convexa holds the note',
    sec: 'partial',
  },
];

export const PUBLIC_KIND: Record<PublicKind, PublicKindInfo> = Object.fromEntries(
  PUBLIC_KINDS.map((k) => [k.key, k]),
) as Record<PublicKind, PublicKindInfo>;

export const PUBLIC_KIND_KEYS = new Set<string>(PUBLIC_KINDS.map((k) => k.key));
export const STRUCTURE_KIND_KEYS = new Set<string>(['level_touch', 'tier_change', 'score_gate']);

export function isPublicKind(kind: string): kind is PublicKind {
  return PUBLIC_KIND_KEYS.has(kind);
}
export function isStructureKind(kind: string): kind is StructureKind {
  return STRUCTURE_KIND_KEYS.has(kind);
}

export const GROUP_LABEL: Record<TraderGroup, string> = {
  asset_managers: 'Asset managers',
  leveraged_funds: 'Leveraged funds',
  dealers: 'Dealers',
  other_reportables: 'Other',
};

export const FILING_ITEMS: { value: string; label: string }[] = [
  { value: '2.02', label: '2.02 Results' },
  { value: '5.02', label: '5.02 Officers' },
  { value: '1.01', label: '1.01 Agreements' },
  { value: '8.01', label: '8.01 Other events' },
];
