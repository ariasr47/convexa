/**
 * Map a produced TRADE rec → the ghost-trade entry pre-fill (UX_BLUEPRINT §5, PM Decision 4).
 * Every produced field becomes an editable seed; nothing is tracked until the user confirms the
 * shipped `TradeEntryDialog`. A `no_trade` rec has no entry to pre-fill (Accept is absent, AC5).
 */
import type { OptionRight, RecStrategy } from '@org/api';

/** The extended ghost-trade prefill seam (was `{ expiration, strike, right }`). All fields editable.
 *  `provenance`/`sizingNote` mark an AI-sourced prefill so the dialog shows the source + sizing copy. */
export interface AiPrefill {
  expiration: string;
  strike: number;
  right: OptionRight;
  qty?: number;
  stop?: number | null;
  target?: number | null;
  provenance?: string; // `Pre-filled from AI read · {persona}`
  sizingNote?: string; // accept.sizing copy
}

/** Single-leg long ghost trade carries one `right`: derive it from structure first (the concrete
 *  call/put words), then bias as a fallback. Defaults to `call` when nothing is determinable. */
export function biasToRight(strategy: Pick<RecStrategy, 'structure' | 'bias'>): OptionRight {
  const s = (strategy.structure ?? '').toLowerCase();
  if (s.includes('put')) return 'put';
  if (s.includes('call')) return 'call';
  if (strategy.bias === 'short') return 'put';
  return 'call';
}

/** Parse the first positive integer out of `position_size` (a free-text suggestion, e.g.
 *  "2 contracts"); returns 1 when no count is present (a safe, editable default). */
export function parseQty(positionSize: string | null | undefined): number {
  if (!positionSize) return 1;
  const m = positionSize.match(/\d+/);
  const n = m ? parseInt(m[0], 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Build the editable entry pre-fill from a produced trade rec. Returns null for a non-trade rec
 *  (no entry to Accept). `strike` falls back to NaN-safe 0 only if the rec omits strikes entirely;
 *  the dialog snaps to the nearest available strike from there. */
export function recToPrefill(
  strategy: RecStrategy,
  personaName: string,
  sizingCopy: string,
): AiPrefill | null {
  if (strategy.decision !== 'trade') return null;
  return {
    expiration: strategy.expiration ?? '',
    strike: strategy.strikes.length ? strategy.strikes[0] : 0,
    right: biasToRight(strategy),
    qty: parseQty(strategy.position_size),
    stop: strategy.exit_plan?.stop ?? null,
    target: strategy.exit_plan?.target ?? null,
    provenance: `Pre-filled from AI read · ${personaName}`,
    sizingNote: sizingCopy,
  };
}
