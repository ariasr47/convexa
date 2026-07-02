/**
 * Display labels, microcopy, and formatters for the positions portfolio — verbatim from
 * UX_BLUEPRINT §2/§3/§4/§6. Pure strings + formatters; no side effects.
 */
import type { EntryMode, PositionStatus, EntryBasis } from './types';

export const money = (n: number) => `${n >= 0 ? '+' : '−'}$${Math.abs(n).toFixed(0)}`;
export const pct = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%`;

export const ENTRY_MODE_LABEL: Record<EntryMode, string> = {
  manual: 'Manual', market: 'Market', limit: 'Limit',
};

export const STATUS_LABEL: Record<PositionStatus, string> = {
  open: 'Open', pending: 'Pending', closed: 'Closed', cancelled: 'Cancelled',
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
export const SIMULATED_TIP = 'A paper trade — no broker, no real money, no real order is ever placed.';
export const PL_TIP = 'Running gain/loss = (current mark − entry mark) × 100 × qty. The 100× contract multiplier is included; fees and slippage are not. Green = gain, red = loss.';
export const DELTA_ENTRY_TIP = 'How far this position’s P/L has moved from your entry. Anchored to the entry price; it persists across reload and falls back to the last-known mark if the feed drops.';
export const SESSION_DELTA_TIP = 'Change in this position’s P/L just over this browser session. It re-anchors fresh each reload and freezes (⏸) while the feed is offline — a short-term read, not a durable one.';
export const TREND_TIP = 'A small recent-trend line of this position’s P/L this session. In-browser only — it clears on reload and shows a gap (broken line), never a zero, while the feed is offline.';
export const LIMIT_TIP = 'A resting buy order that fills only when the live option mark reaches your limit price — at the limit price. It stays Pending and cancellable until then, and never fills off a frozen/offline mark.';
export const SUBTOTAL_TIP = 'Sum of the $ P/L of this group’s positions. A position whose live P/L is unavailable is excluded and flagged — never counted as zero.';
export const GROUP_TIP = 'Group your book by ticker, strategy (long call vs long put), or expiry, each with a P/L subtotal.';
export const SAVED_VIEW_TIP = 'A named snapshot of your columns, sort, filter, grouping, layout, and density. Switch, rename, or delete views; the active one survives a reload.';
export const PENDING_PL_TIP = 'Fills at your limit; no P/L until it fills.';
export const ROW_UNAVAILABLE_TIP = "This position's contract couldn't be priced this cycle — it's safe; other positions are unaffected.";

export const DISCLAIMER =
  'Paper trade — no broker, no real money. Filled at the option mid; fees, slippage, taxes and ' +
  'assignment are not modeled.';

// ---- Empty / history copy (UX_BLUEPRINT §6) ----------------------------------------------------
export const EMPTY_NO_POSITIONS = 'No simulated positions yet. Open one to start your book.';
export const EMPTY_FILTERED = 'No positions match this filter.';
export const HISTORY_CAPTION = 'Closed and cancelled positions are kept here — never pruned.';
export const HISTORY_EMPTY = 'No closed or cancelled positions yet.';

// ---- Live tab (locked) copy (UX_BLUEPRINT §6 S10) ---------------------------------------------
export const LIVE_HEADING = 'Live positions — coming soon';
export const LIVE_BODY =
  "Connecting a real brokerage to track the risk you're actually carrying is on the roadmap. " +
  'For now, everything in Convexa is simulated (paper).';
export const LIVE_LOCK_CHIP = 'coming soon';

export function contractLine(p: { ticker: string; strike: number; right: 'call' | 'put'; expiration: string; qty: number }): string {
  return `${p.ticker} $${p.strike}${p.right === 'call' ? 'C' : 'P'} · exp ${p.expiration} · Long ×${p.qty}`;
}
