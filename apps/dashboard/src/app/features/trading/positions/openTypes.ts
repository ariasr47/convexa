/**
 * Shared sim-entry input types + refusal copy.
 * Lives next to `usePortfolio` so the dialog and hook share ONE shape without a second open path.
 */
import type { OptionRight } from '@convexa/api';
import type { InstrumentKind, LegSide, SimPosition } from './leg';
import type { EntryBasis, EntryMode } from './types';

/**
 * ONE drafted leg, as the shared entry dialog emits it. `price` is PER-UNIT and POSITIVE — direction
 * lives in `side` and nowhere else (SPEC §2.1's hard stands), and `multiplier` is set at
 * CONSTRUCTION (100 for a contract, 1 for equity) and stored, never re-derived downstream.
 *
 * `price: null` means the trader has not typed one yet. The dialog will not confirm in that state —
 * a partial net is never shown and never saved.
 */
export interface LegInput {
  kind: InstrumentKind;
  ticker: string;
  side: LegSide;
  qty: number;
  multiplier: number;
  price: number | null;
  expiration: string | null;
  strike: number | null;
  right: OptionRight | null;
}

/**
 * A SINGLE-LEG ENTRY IS A ONE-ELEMENT ARRAY, so there is exactly ONE open path — never a single-leg
 * path plus a multi-leg path (SPEC §2.7 *Entry input shape*). That is what keeps
 * `single-shared-sim-entry-dialog` a variant rather than a fork at the data boundary.
 */
export interface OpenPositionInput {
  legs: LegInput[];
  entryMode: EntryMode;
  /** limit: the PER-UNIT limit price. Single-leg only — see `composeMark.netLimitDollarsFor`. */
  limitPrice?: number;
  /** Pre-resolved fill (market mode, single leg) so the dialog's own fetch isn't repeated. */
  resolvedMark?: number;
  resolvedBasis?: EntryBasis;
  stop?: number | null;
  target?: number | null;
  /**
   * outcome-ledger (AC-E18): the AI-rec identity this entry was seeded from, carried onto the `open`
   * decision record so a direct Accept stays attributable and `not_attributable_by_path` stays 0.
   * Absent / null on a manual open — never a stale claim.
   */
  aiRecFingerprint?: string | null;
  /**
   * tradeable-rec-inputs (AC-82): whether a risk block was present AT ENTRY — the presence flag
   * ONLY, never an account-size value (AC-29a). Absent/null when the host could not resolve it this
   * cycle (anonymous / a faulted settings read) — never a fabricated `false`.
   */
  riskBlockPresent?: boolean | null;
}

/** Refusals `openPosition` can return. Each is SHOWN to the trader; none is ever swallowed. */
export const OPEN_REFUSED_MULTI_UNDERLYING =
  'Every leg of a position must be on the same underlying — no position was opened.';
export const OPEN_REFUSED_NO_LEGS = 'No legs to open — no position was opened.';
export const OPEN_REFUSED_NO_MARKET_FILL = "Couldn't fill at market — no position was opened.";
export const OPEN_REFUSED_STORE_FAULTED =
  "Convexa couldn't read your saved data and won't save anything new until that's sorted — no position was opened.";

export interface OpenResult {
  ok: boolean;
  reason?: string;
  position?: SimPosition;
}
