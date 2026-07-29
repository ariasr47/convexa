/**
 * The tier WORD map — kernel vocabulary, not a widget.
 *
 * `opportunity_tier` is a closed, SERVER-EMITTED enum, and this is the single source of its display
 * label. It stays in the trading kernel for exactly the reason `MarkBasis` and `DecisionRecord` do:
 * more than one domain reads it. `pages/ticker` renders it in the Opportunity tile and the Prime
 * banner; `features/trading/outcomes` prints it in the track record's tier cells.
 *
 * DELIBERATELY NOT `tierMeta`: that returns a palette colour, and a RATE must never be tinted
 * (outcome-ledger AC-14). The colour-bearing helper and the banner are page chrome and live in
 * `pages/ticker/widgets/opportunity-tier/`; only this closed lookup is shared.
 *
 * ⚠ SPLIT ON PURPOSE (F17). `model/OpportunityTier.tsx` moved out of the kernel to a ticker widget,
 * but the plan recorded it as having "one consumer" and it had three — one of them
 * `outcomes/ledger.ts`, which is in `features/`. Moving the whole module would have created a
 * `features/ -> pages/` import and inverted the downward-only dependency direction that SPEC §2.7
 * binds. The widget moved; this six-line lookup stayed.
 */
import type { OpportunityTier } from '@org/api';

export const WORD: Record<OpportunityTier, string> = {
  dormant: 'Dormant',
  watch: 'Watch',
  actionable: 'Actionable',
  prime: 'Prime',
};
