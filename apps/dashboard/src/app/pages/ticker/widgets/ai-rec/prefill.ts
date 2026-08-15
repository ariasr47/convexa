/**
 * Map a produced TRADE rec → the ghost-trade entry pre-fill (UX_BLUEPRINT §5, PM Decision 4;
 * tradeable-rec-inputs AC-79/80/81). Every produced field becomes an editable seed; nothing is
 * tracked until the user confirms the shipped `TradeEntryDialog`. A `no_trade` rec has no entry to
 * pre-fill (Accept is absent, AC5).
 *
 * AC-79 (ship-blocking): the quantity field is NEVER seeded from the model — it always opens at the
 * dialog's own default. `position_size` is **never parsed** by any lane, ever: `parseQty` is DELETED
 * (it is not merely unused — its deletion is the enforceable subject of a source scan, F12/AC-29a's
 * sibling discipline). The rec's size text is displayed VERBATIM beside the quantity field via
 * `sizeText`, quoted and attributed to the AI — never fed into the field itself.
 */
import type { Grounding, OptionRight, RecStrategy } from '@convexa/api';
import { PLAN_FIELD_LABEL, prefillUnnamedReason, SIZE_NOT_SUGGESTED } from './copy';
import { prefillGate } from './literals';

/** The extended ghost-trade prefill seam (was `{ expiration, strike, right }`). All fields editable.
 *  `provenance`/`sizingNote` mark an AI-sourced prefill so the dialog shows the source + sizing copy.
 *  `sizeText` is the rec's size PROSE, rendered verbatim beside the quantity field — never into it.
 *
 *  rec-absence-literals-hole §2.5 — `expiration`/`strike`/`right` are widened to admit `null`, meaning
 *  "the read named no value for this" — distinct from the DRAFT's own `''` sentinel; the mapping
 *  happens at the ONE boundary line the dialog reads the prefill (`TradeEntryDialogView.tsx`). */
export interface AiPrefill {
  expiration: string | null;
  strike: number | null;
  right: OptionRight | null;
  stop?: number | null;
  target?: number | null;
  /** ai-rec-grounding AC-7/AC-68 — the one-line reason a withheld price field shows, or `null` when
   *  the field seeded (or when there was nothing to seed). A CLOSED-SET string chosen by
   *  `prefillGate` (three withheld members after D8), carried verbatim the same way `provenance` /
   *  `sizingNote` already are — the shared dialog imports nothing from `pages/` (dependency direction
   *  is downward only). */
  stopWithheldReason?: string | null;
  targetWithheldReason?: string | null;
  /** rec-absence-literals-hole (AC-12a/b/c/d) — ONE line naming the contract fields the read never
   *  named. `null` ⇒ nothing to explain (every contract field was named). */
  contractWithheldReason?: string | null;
  provenance?: string; // `Pre-filled from AI read · {persona}`
  sizingNote?: string; // accept.sizing copy
  sizeText: string; // the rec's own words, or `size not suggested` (AC-80)
}

/**
 * Single-leg long ghost trade carries one `right`: derive it from structure first (the concrete
 * call/put words), then bias as a fallback.
 *
 * rec-absence-literals-hole (AC-12c) — **a NEVER-NAMED structure derives NOTHING.** The presence check
 * sits AHEAD of the lowercasing collapse: the bias fallback below fires regardless of whether structure
 * was named, so checking presence only at the final `:45`-equivalent line would still hand back a
 * submittable direction for a structure nobody stated. When structure IS present but names neither
 * word, the bias derivation stands EXACTLY as today — a parse that found no keyword is a different fact
 * from an unnamed structure, and is out of scope here.
 */
export function biasToRight(strategy: Pick<RecStrategy, 'structure' | 'bias'>): OptionRight | null {
  if (strategy.structure == null || strategy.structure.trim() === '') return null;
  const s = strategy.structure.toLowerCase();
  if (s.includes('put')) return 'put';
  if (s.includes('call')) return 'call';
  if (strategy.bias === 'short') return 'put';
  return 'call';
}

/**
 * Build the editable entry pre-fill from a produced trade rec. Returns null for a non-trade rec (no
 * entry to Accept).
 *
 * ai-rec-grounding AC-7 (SB) — the stop/target seed is GATED on the figure's grounding state (SPEC
 * §4, GATE Z Z1 + D8): `traced` seeds exactly as on `main`; `untraced` / `not_checkable` withholds and
 * states why; `not_applicable` had nothing to seed; **a response with NO grounding block withholds
 * too, with its own third reason — a missing check is never a licence to pre-fill.** `position_size`
 * is still never parsed by any lane (AC-79).
 *
 * rec-absence-literals-hole (AC-12a/b/c/e) — strike/expiration/right arrive `null`, never a
 * chain-derived strike, never the first chain expiration, never a guessed direction, when the read
 * never named them. **The refusal keys on the VALUE being absent — no reason token is read here, by
 * construction** (this function takes no `field_reasons` argument), so a degraded or pre-feature
 * response still refuses to seed and never becomes a blocked Accept.
 */
export function recToPrefill(
  strategy: RecStrategy,
  personaName: string,
  sizingCopy: string,
  grounding?: Grounding | null,
): AiPrefill | null {
  if (strategy.decision !== 'trade') return null;
  // `grounding?.fields.exit_stop` evaluates to `undefined` when the block is absent, which is exactly
  // the input `prefillGate`'s D8 arm keys on — one expression covers both the missing-block and the
  // missing-field cases, and both withhold.
  const stopGate = prefillGate(grounding?.fields.exit_stop);
  const targetGate = prefillGate(grounding?.fields.exit_target);
  const strike = strategy.strikes.find((x) => Number.isFinite(x)) ?? null;
  const expiration = strategy.expiration?.trim() ? strategy.expiration : null;
  const right = biasToRight(strategy);
  const unnamed = [
    right === null ? PLAN_FIELD_LABEL.structure : null,
    strike === null ? PLAN_FIELD_LABEL.strikes : null,
    expiration === null ? PLAN_FIELD_LABEL.expiration : null,
  ].filter((x): x is Exclude<typeof x, null> => x !== null);
  return {
    expiration,
    strike,
    right,
    stop: stopGate.seed ? (strategy.exit_plan?.stop ?? null) : null,
    target: targetGate.seed ? (strategy.exit_plan?.target ?? null) : null,
    stopWithheldReason: stopGate.reason,
    targetWithheldReason: targetGate.reason,
    contractWithheldReason: unnamed.length ? prefillUnnamedReason(unnamed) : null,
    provenance: `Pre-filled from AI read · ${personaName}`,
    sizingNote: sizingCopy,
    sizeText:
      strategy.position_size && strategy.position_size.trim()
        ? strategy.position_size
        : SIZE_NOT_SUGGESTED,
  };
}
