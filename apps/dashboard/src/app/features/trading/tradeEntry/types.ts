/**
 * Trade entry types + date helpers + leg draft factory.
 * Public API re-exported from ../TradeEntryDialog.tsx for stable imports.
 */
import type { Trigger } from '@/features/trading/orders/types';
import type { InstrumentKind, LegSide } from '@/features/trading/positions/leg';
import type { LegInput } from '@/features/trading/positions/usePortfolio';
import type { OptionRight } from '@convexa/api';
import { appNowMs, dataMode } from '@convexa/api';

/** Fill mode — how the entry price is decided. Local dialog state only (no store / lifecycle). */
export type FillMode = 'manual' | 'market' | 'limit';

/** The two bases a MARKET fill can resolve to (`resolveMarketFill` returns nothing else). */
export type MarketFillBasis = 'snapshot' | 'theoretical';

/** The entry pre-fill seam. Originally `{ expiration, strike, right }`; extended (FE-execution lane,
 *  UX_BLUEPRINT §5) to also seed stop/target from an AI rec. Every seeded field stays editable.
 *  `provenance`/`sizingNote`/`sizeText` are set only for an AI-sourced prefill (render the source
 *  chip + sizing copy); a manual/Prime prefill leaves them undefined.
 *
 *  DELIBERATELY NO `qty` (tradeable-rec-inputs AC-79, ship-blocking): the quantity field is NEVER
 *  seeded from the model — it always opens at the dialog's own default. `sizeText` carries the rec's
 *  size prose for DISPLAY beside the field, never into it. */
export interface EntryPrefill {
  /** `null` = THE READ NAMED NO EXPIRATION (rec-absence-literals-hole §2.5). Distinct from `''`, which
   *  is the DRAFT's own sentinel. */
  expiration: string | null;
  /** `null` = the read named no strike. Never `0` — a zero strike is a real, submittable number. */
  strike: number | null;
  /** `null` = the read named no structure, so no direction is derivable. */
  right: OptionRight | null;
  stop?: number | null;
  target?: number | null;
  /** ai-rec-grounding AC-7/AC-68: the stop/target seed is GATED on the figure's grounding state. When
   *  a field is withheld it arrives `null` and carries this one-line reason, rendered verbatim beneath
   *  the input — a withheld field never comes up silently. One of THREE closed-set members (the AI's
   *  own number / Convexa couldn't check it / no check reached the browser). `undefined`/`null` ⇒
   *  nothing to explain. */
  stopWithheldReason?: string | null;
  targetWithheldReason?: string | null;
  /** rec-absence-literals-hole (AC-12a/b/c/d) — ONE line naming the contract fields the read did not
   *  give, built by the producer and rendered VERBATIM (the same seam `stopWithheldReason` uses; this
   *  file never re-spells the copy). `null`/`undefined` ⇒ nothing to explain. */
  contractWithheldReason?: string | null;
  provenance?: string;
  sizingNote?: string;
  sizeText?: string;
}

/** Common facts every confirm carries (the underlying + the risk plan). */
export interface SubmitBase {
  ticker: string;
  stop: number | null;
  target: number | null;
}

/** The single-contract facts the ORDER variant still carries flat — a sim order is one option. */
export interface OrderContract {
  expiration: string;
  strike: number;
  right: OptionRight;
  qty: number;
}

/**
 * The mode-tagged confirm payload. Structurally a `positions/usePortfolio.OpenPositionInput`, so the
 * Positions host passes it straight through; the Ticker host maps `legs[0]` onto a ghost-trade
 * `NewTradeForm` (manual/limit → the typed price with basis `manual`; market → the resolved fill).
 *
 * A SINGLE-LEG ENTRY IS A ONE-ELEMENT ARRAY — there is exactly one open path, never a single-leg
 * path plus a multi-leg path (SPEC §2.7 *Entry input shape*).
 */
export type TradeEntrySubmit =
  | (SubmitBase & { entryMode: 'manual'; legs: LegInput[] })
  | (SubmitBase & {
      entryMode: 'market';
      legs: LegInput[];
      resolvedMark: number;
      resolvedBasis: MarketFillBasis;
    })
  | (SubmitBase & { entryMode: 'limit'; legs: LegInput[]; limitPrice: number });

// ---- ai-rec-backtest-orders: the additive ORDER VARIANT seam (UX §3) ----------------------------
// Host-passed. ABSENT ⇒ the dialog is byte-identical to shipped (protects AC-47/48). Present ⇒ the
// order-creation confirm: trigger section + verbatim-words block, the 2-option entry-price control
// (Limit / Market on trigger), the never-blank good-til, the notice strips, the D8-1 disclosure,
// and the "Place simulated order" confirm. The dialog still performs NO write — the host owns the
// (server-gated) order store write.

/** What the Act flow seeds into the order variant (D2/D3 + the D7/D8 strips). */
export interface OrderPlan {
  /** D2 seed — null ⇒ the empty-seed state (nothing guessed, AC-6). */
  seededTrigger: Trigger | null;
  /** The rec's verbatim `entry_trigger` text — ALWAYS displayed (product constraint §7). */
  triggerSourceText: string | null;
  provenance: {
    source: 'ai_rec' | 'ai_scenario';
    personaName: string;
    asOf: string | null;
    scenarioName?: string;
  };
  /** Newer bundle since the rec's pin ⇒ the D8-5 strip (proceed allowed, AC-10). */
  stale: boolean;
  /** The CURRENT live underlying mid (null when not live) — drives the D8-2 already-met notice,
   *  re-evaluated LIVE as the user edits the trigger. */
  liveMid: number | null;
}

/** The order-variant confirm payload (the host persists it via the gated orders-store write). */
export interface OrderEntrySubmit extends SubmitBase, OrderContract {
  trigger: Trigger | null;
  /** null ⇒ market-on-trigger. */
  limitPrice: number | null;
  /** ISO instant of the good-til bound (end of the chosen day) — never blank (AC-8). */
  expiresAt: string;
  /** The good-til calendar date (YYYY-MM-DD) as chosen. */
  goodTilDate: string;
}

/** D3 default: min(now + 7 days, contract expiration), as a YYYY-MM-DD local date. */
export function defaultGoodTil(expiration: string, now: Date = new Date(appNowMs())): string {
  const y0 = dataMode === 'demo' ? now.getUTCFullYear() : now.getFullYear();
  const m0 = dataMode === 'demo' ? now.getUTCMonth() : now.getMonth();
  const d0 = dataMode === 'demo' ? now.getUTCDate() : now.getDate();
  const plus7 = dataMode === 'demo' ? new Date(Date.UTC(y0, m0, d0 + 7)) : new Date(y0, m0, d0 + 7);
  const y = dataMode === 'demo' ? plus7.getUTCFullYear() : plus7.getFullYear();
  const m = String((dataMode === 'demo' ? plus7.getUTCMonth() : plus7.getMonth()) + 1).padStart(
    2,
    '0',
  );
  const d = String(dataMode === 'demo' ? plus7.getUTCDate() : plus7.getDate()).padStart(2, '0');
  const iso = `${y}-${m}-${d}`;
  return expiration && iso > expiration ? expiration : iso;
}

/** Local YYYY-MM-DD for "today" (the good-til lower bound). */
export function todayIso(now: Date = new Date(appNowMs())): string {
  const y = dataMode === 'demo' ? now.getUTCFullYear() : now.getFullYear();
  const m = String((dataMode === 'demo' ? now.getUTCMonth() : now.getMonth()) + 1).padStart(2, '0');
  const d = String(dataMode === 'demo' ? now.getUTCDate() : now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** End-of-day ISO instant for a YYYY-MM-DD good-til date (the durable `expires_at`). */
export function goodTilToExpiresAt(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (dataMode === 'demo') {
    const target = Date.UTC(y, m - 1, d, 23, 59, 59, 999);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'shortOffset',
      hour: '2-digit',
    }).formatToParts(target);
    const raw = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT-5';
    const match = raw.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    const offset = match
      ? (match[1] === '+' ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3] ?? 0))
      : -300;
    return new Date(target - offset * 60_000).toISOString();
  }
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

/**
 * ONE drafted leg. Local dialog state only — nothing here is durable until the host writes.
 *
 * The three hard stands (SPEC §2.1) are enforced at the INPUT: `qty` is unsigned and the Buy/Sell
 * control carries direction (no field anywhere accepts a negative quantity, AC-11); `multiplier` is
 * decided from the instrument kind at CONSTRUCTION and stored, never re-derived downstream; `price`
 * is per-unit and non-negative — debit vs credit is a property of the composition.
 */
export interface LegDraft {
  /** Stable local key. Never durable — `openPosition` mints the real `LegId`. */
  key: string;
  kind: InstrumentKind;
  side: LegSide;
  qty: number;
  expiration: string;
  strike: number | '';
  /** `''` = the read named no structure, so no direction is typed yet (rec-absence-literals-hole
   *  §2.5). Deliberately the file's OWN falsy sentinel (see `strike` above and `price` below), NOT a
   *  nullable — the falsy handling this file already contains (`LegFields.tsx`'s ToggleButtonGroup,
   *  the `d.strike === '' ? null : ...` narrow, `!!d.expiration`) extends to `right` unchanged and no
   *  third nullability convention is introduced. `newDraft()` keeps its `'call'` default — a dialog
   *  opened directly (no rec prefill) is unaffected. */
  right: OptionRight | '';
  /** PER-UNIT. `''` = not typed yet, which is what makes the running net read INCOMPLETE. */
  price: number | '';
}

let draftSeq = 0;
export function newDraft(over: Partial<LegDraft> = {}): LegDraft {
  return {
    key: `leg-${++draftSeq}`,
    kind: 'option',
    side: 'long',
    qty: 1,
    expiration: '',
    strike: '',
    right: 'call',
    price: '',
    ...over,
  };
}
