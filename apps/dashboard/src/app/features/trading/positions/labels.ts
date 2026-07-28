/**
 * Display labels, microcopy, and formatters for the positions portfolio — verbatim from
 * UX_BLUEPRINT §2/§3/§4/§6. Pure strings + formatters; no side effects.
 */
import type { MaxLossWithheldReason } from './maxLoss';
import type { EntryBasis, EntryMode, PositionStatus } from './types';

export const money = (n: number) => `${n >= 0 ? '+' : '−'}$${Math.abs(n).toFixed(0)}`;
export const pct = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%`;

export const ENTRY_MODE_LABEL: Record<EntryMode, string> = {
  manual: 'Manual',
  market: 'Market',
  limit: 'Limit',
};

export const STATUS_LABEL: Record<PositionStatus, string> = {
  open: 'Open',
  pending: 'Pending',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

/** Entry-basis chip label + tip (UX_BLUEPRINT §3). Falls back to the existing mark-basis copy. */
export const ENTRY_BASIS_META: Partial<Record<EntryBasis, { label: string; tip: string }>> = {
  user_entered: {
    label: 'user-entered price',
    tip: 'You typed this entry price — it is not a market quote. P/L is measured from it honestly, but it was not a fill the chain confirmed.',
  },
  limit_fill: {
    label: 'filled at limit',
    tip: 'Filled at your limit price when the live option mark reached it. The sim never fills better than your limit, and never off a frozen/offline mark.',
  },
  // ai-rec-backtest-orders (UX_BLUEPRINT §5) — a sim-order market-on-trigger fill.
  trigger_fill: {
    label: 'trigger fill',
    tip: 'Filled at the first live option mark after the trigger crossed — recorded at fill time, never backfilled.',
  },
};

// ---- Tooltips / glossary (UX_BLUEPRINT §4) -----------------------------------------------------
export const SIMULATED_TIP =
  'A paper trade — no broker, no real money, no real order is ever placed.';
/**
 * REWRITTEN — the shipped string hardcoded the universal ×100 claim this feature exists to fix. A
 * 100-share leg has a multiplier of 1, so the old sentence was false for every equity position the
 * new shape can hold.
 */
export const PL_TIP =
  'Running gain/loss across every leg of this position, measured from your net entry. Each leg ' +
  'uses its own multiplier — ×100 for an option contract, ×1 for shares. Fees, slippage, ' +
  'assignment and taxes are not modeled. Green = gain, red = loss.';
export const DELTA_ENTRY_TIP =
  'How far this position’s P/L has moved from your entry. Anchored to the entry price; it persists across reload and falls back to the last-known mark if the feed drops.';
export const SESSION_DELTA_TIP =
  'Change in this position’s P/L just over this browser session. It re-anchors fresh each reload and freezes (⏸) while the feed is offline — a short-term read, not a durable one.';
export const TREND_TIP =
  'A small recent-trend line of this position’s P/L this session. In-browser only — it clears on reload and shows a gap (broken line), never a zero, while the feed is offline.';
export const LIMIT_TIP =
  'A resting buy order that fills only when the live option mark reaches your limit price — at the limit price. It stays Pending and cancellable until then, and never fills off a frozen/offline mark.';
export const SAVED_VIEW_TIP =
  'A named snapshot of your columns, sort, filter, grouping, layout, and density. Switch, rename, or delete views; the active one survives a reload.';
export const PENDING_PL_TIP = 'Fills at your limit; no P/L until it fills.';
export const ROW_UNAVAILABLE_TIP =
  "This position's contract couldn't be priced this cycle — it's safe; other positions are unaffected.";

// ---- The three `—` tips (SPEC §4 *The four not-a-number literals*) ------------------------------
//
// `—` is NOT-APPLICABLE: the field does not apply to this instrument, or the answer lives one level
// down. It keeps its shipped `text.disabled` treatment and stays untestidded; only its TIP says
// which of the two it is, so it can never be read as `unavailable` or as `not recorded`.

export const SHARES_FIELD_TIP =
  'Not applicable — this position holds shares, which have no strike or expiry.';

export const MULTI_LEG_STRIKE_TIP = 'Multiple legs — expand the position to see each strike.';

// ---- Mark provenance on a STRUCTURE (SPEC §4) ---------------------------------------------------

/** Replaces the generic unavailable tip when SOME legs priced and some did not. */
export function partialMarkTip(resolvedLegs: number, totalLegs: number): string {
  return (
    `${totalLegs - resolvedLegs} of ${totalLegs} legs couldn't be priced this cycle. A partial ` +
    'spread price would be wrong, not just incomplete — so no P/L is shown. Your other positions ' +
    'are unaffected.'
  );
}

/** Appended when the legs did not all price on the same rung of the ladder. */
export const WEAKEST_BASIS_TIP =
  'Legs priced on different bases — this net uses the weakest (theoretical). Expand the position ' +
  'to see each leg.';

/** AC-27 — each row's P/L% tip names THAT ROW's basis. No new column; the tip carries it. */
export function plPctBasisTip(basis: 'net_debit' | 'net_credit'): string {
  return basis === 'net_debit'
    ? 'Measured against your net debit — the money you paid to open this position.'
    : 'Measured against your net credit — the money you received to open this position. A gain ' +
        'here means the structure is worth less than you sold it for.';
}

// ---- positions-legs — the structure/leg/net-entry glossary (SPEC §4 *Copy — exact strings*) -----

export const NET_ENTRY_TIP =
  'What this position cost or paid you to open, netted across every leg. A net debit is money you ' +
  'paid. A net credit is money you received — your risk is what you can still lose, not what you ' +
  'paid.';

export const STRUCTURE_TIP =
  'The shape Convexa reads from your legs — it is derived from the position, not something you ' +
  'chose or something we store.';

export const LEGS_TIP =
  'The individual contracts (and shares) that make up this position. Each is priced on its own; ' +
  "the position's P/L is the net of all of them.";

export const SHORT_LEG_TIP =
  'A leg you sold. Assignment, early exercise and margin are not modeled — this is paper.';

export const NOT_RECORDED_TIP =
  'This position was saved before Convexa recorded this detail, or the saved record is damaged. ' +
  "Convexa won't guess it. Nothing was deleted — the record is intact and still counted in your " +
  'history.';

/** The `pl_pct` cell literal for `pl_pct_state.no_basis` — testid `cell-no-basis`. */
export const NO_BASIS_LABEL = 'no basis';

export const NO_BASIS_TIP =
  'This position opened at about no net debit or credit, so a percentage has nothing to measure ' +
  "against and Convexa won't invent one. The dollar P/L beside it is unaffected — only the " +
  'percentage is missing.';

/** PERMANENT, not this-cycle — chosen over `ROW_UNAVAILABLE_TIP` when the record is unpriceable. */
export const UNPRICEABLE_RECORD_TIP =
  "Convexa can't price this position: its saved record is missing contract details it needs. " +
  "That won't change on the next update. Nothing was deleted, and your other positions are " +
  'unaffected.';

export const WRITE_REFUSED_TIP =
  "Paused — Convexa couldn't read your saved data and won't save anything new until that's " +
  'sorted. Your existing positions are untouched.';

export const EMPTY_FAULTED =
  "Convexa couldn't read your saved positions, so none are shown here. Nothing was deleted — " +
  'your records are still in this browser, exactly as they were.';

export const TR_ARCHIVE_PARTIAL_NOTE =
  "Some saved data in this browser couldn't be read, so this archive holds only the records that " +
  'loaded. It is not a complete backup.';

// ---- The risk slot ------------------------------------------------------------------------------

/** The risk slot's label, in all three of its homes — bound into the COLUMN_LABELS pair. */
export const MAX_LOSS_LABEL = 'Max loss';

/** The leg-disclosure line under a labelled figure. */
export const MAX_LOSS_ASSUMPTION =
  'Max loss assumes every leg held to expiration. Fees, slippage, assignment and taxes are not ' +
  'modeled.';

/**
 * The risk slot's tooltip. Its TAIL IS `MAX_LOSS_ASSUMPTION` verbatim — COMPOSED, never retyped, so
 * the tooltip and the disclosure line cannot drift apart.
 */
export const MAX_LOSS_TIP =
  'The most this position can lose, read from its own legs — not a quote, not a broker figure. ' +
  "It is static: it doesn't move with the market, so it never dims when the feed drops. " +
  MAX_LOSS_ASSUMPTION;

/**
 * EXHAUSTIVE over `MaxLossWithheldReason`, matching the shipped `MARK_BASIS_META` / `ENTRY_BASIS_META`
 * shape in the very files that render this row — so a NEW reason fails the build instead of
 * vanishing. `label` is the one stated reason in the risk slot; `tip` has TWO HOMES, ONE STRING (the
 * slot's tooltip and the leg-disclosure line), so they cannot drift.
 *
 * `Unlimited` was rejected as a bare label: alone in a mono figure slot under a `Max loss` header it
 * reads as a value the app computed, which gives the slot two grammars and destroys the glanceable
 * figure-or-reason distinction the single slot exists to carry.
 */
export const MAX_LOSS_WITHHELD_META: Record<MaxLossWithheldReason, { label: string; tip: string }> =
  {
    unbounded: {
      label: 'unlimited risk',
      tip:
        'There is no worst case to compute here: this position keeps losing as long as the ' +
        "underlying keeps moving against it. Convexa won't print a figure it can't bound.",
    },
    multi_expiration: {
      label: 'mixed expiries',
      tip:
        "This position's legs don't expire together, so there is no single expiration to measure a " +
        "worst case at. Convexa won't pick one expiry and call it the answer.",
    },
    unnamed_shape: {
      label: 'unnamed shape',
      tip:
        "Convexa doesn't have a name for this leg shape, so it has no payoff to compute a worst case " +
        'from. Nothing is wrong with the position — it is held, priced and counted exactly like any ' +
        'other.',
    },
  };

// ---- The merge notice (AC-51) -------------------------------------------------------------------

/**
 * States NO counts, deliberately. Id collisions between the two stores are the EXPECTED case, so the
 * `read` and `contributed` numbers legitimately differ for exactly the trader this notice is written
 * for — quoting either hands them arithmetic that looks like a SHORTFALL about a migration that lost
 * nothing. The counts stay in `provenance`, inspectable for support, and out of the trader's read.
 */
export const MERGE_NOTICE =
  'Trades you tracked on a ticker page and the positions you opened here are now one book — ' +
  'everything from both is in the list below. Nothing was deleted: your old records are still in ' +
  'this browser, exactly as they were.';

/** The export pointer. Does NOT rename the shipped `Export archive` action or duplicate its button. */
export const MERGE_NOTICE_EXPORT = 'Export an archive';

// ---- The stale-saved-view notice (AC-54) --------------------------------------------------------

/**
 * `info`-class, one line, dismissible — no burnt orange and no warning icon: nothing broke and no
 * data was lost, and dressing it as a warning would be dishonest in the other direction.
 * TYPOGRAPHIC quotes around the view name, per the shipped `trCoveragePartial` precedent.
 */
export function staleViewNotice(viewName: string): string {
  return (
    `“${viewName}” filtered on a structure Convexa no longer has. That filter is off — ` +
    'everything else in the view is unchanged. Save the view to keep it this way.'
  );
}

// ---- The faulted banner (SPEC §4, owner ruling #8: STRICT) --------------------------------------

export const FAULTED_BANNER_HEADING = "Recording paused — Convexa couldn't read your saved data";

export const FAULTED_BANNER_BODY =
  'Rather than overwrite it, Convexa left it exactly as it is. Nothing was deleted. The positions ' +
  'below are the ones that loaded and their numbers are correct; anything in the part it ' +
  "couldn't read isn't shown. Opening, closing and cancelling positions will not be saved while " +
  'this lasts.';

/** Moves focus to the existing Archive block; does NOT duplicate or rename `Export archive`. */
export const FAULTED_BANNER_ACTION_EXPORT = 'Export an archive of what loaded';
/** The only in-app step that can clear a transient read failure. There is no Repair and no Reset. */
export const FAULTED_BANNER_ACTION_RELOAD = 'Reload the page';

export const FAULTED_BANNER_CLOSING =
  'If it comes back after a reload, the saved data in this browser needs attention. Convexa will ' +
  'keep it untouched either way.';

/** The Ticker-page door — the faulted state follows the STORE, not the route. */
export const TICKER_FAULTED_NOTICE =
  "Recording paused — Convexa couldn't read your saved data, so new positions won't be saved. " +
  'Open Positions to export an archive of what loaded.';

// ---- FUTURE copy — retained, NOT SHIPPED in v1 (SPEC §4 *Future copy*) --------------------------
//
// `position_eval` is suppressed for multi-leg (owner ruling #9) and for a ticker holding more than
// one open position (2026-07-28 ruling), and `useGhostTrade`'s `alerts` has NO component consumer.
// These five strings are kept PENDING A CONSUMER and must not be wired to anything in this release:
// both suppressions are RENDER decisions and are fully observable without them (AC-74, AC-83). The
// copy is what a future alert surface will say, not what makes the suppression true.
//
// `POSITION_EVAL_NONE_SHORT` is unreachable even once a consumer exists (the short-leg fallback in
// §2.8 means a short-only position still gets a subject); it is retained because the selection rule
// is owner-revisitable.

export function POSITION_EVAL_LEG_QUALIFIER(legLabel: string, legCount: number): string {
  return (
    `Read on the ${legLabel} — one leg of your ${legCount}-leg position. Convexa evaluates one ` +
    'leg, not the whole structure.'
  );
}

export const POSITION_EVAL_TIP =
  "Convexa's position-context read looks at ONE option leg of your position — the largest long " +
  "option leg. On a spread or a condor that's a read on part of the position, not the whole thing: " +
  "offsetting legs and the structure's net exposure aren't in it.";

export const POSITION_EVAL_NONE_EQUITY =
  'No position-context read — this position holds shares, and Convexa’s position reads are ' +
  "built on option contracts (strike, expiry, gamma). Silence here doesn't mean nothing changed.";

export const POSITION_EVAL_NONE_SHORT =
  "No position-context read — Convexa's read is built on a long option leg, and this position " +
  "doesn't have one. Silence here doesn't mean nothing changed.";

export const POSITION_EVAL_NONE_MULTI_POSITION =
  "No position-context read — you're holding more than one position on this ticker, and Convexa " +
  "won't pick one and call it yours. Silence here doesn't mean nothing changed.";

export const DISCLAIMER =
  'Paper trade — no broker, no real money. Filled at the option mid; fees, slippage, taxes and ' +
  'assignment are not modeled.';

// ---- Empty / history copy (UX_BLUEPRINT §6) ----------------------------------------------------
export const EMPTY_NO_POSITIONS = 'No simulated positions yet. Open one to start your book.';
export const EMPTY_FILTERED = 'No positions match this filter.';
export const HISTORY_CAPTION = 'Closed and cancelled positions are kept here — never pruned.';

// ---- Live tab (locked) copy (UX_BLUEPRINT §6 S10) ---------------------------------------------
export const LIVE_HEADING = 'Live positions — coming soon';
export const LIVE_BODY =
  "Connecting a real brokerage to track the risk you're actually carrying is on the roadmap. " +
  'For now, everything in Convexa is simulated (paper).';
export const LIVE_LOCK_CHIP = 'coming soon';
