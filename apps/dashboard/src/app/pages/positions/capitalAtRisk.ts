/**
 * `capitalAtRiskStateOf` — the mast's "Capital at risk" figure cell (surfaces fidelity repair,
 * change 1 · `design/src/screens/positions.mjs:63`). Sibling to `netPl.ts`: pure, no JSX, so the
 * arms are testable without mounting the page. `PositionsPage.tsx` renders whatever this returns
 * through the SAME `FigureCell` primitive the Net P/L readout already uses and adds no branch.
 *
 * "Capital at risk" is the OPEN book's max-loss sum — `maxLossOf` (`features/trading/positions/
 * maxLoss.ts`), traced (a Convexa computation over the position's own recorded legs). A structure
 * outside the 15-member eligible set (unbounded risk, multi-expiration, an unrecognised shape)
 * WITHHOLDS rather than fabricating a number — max loss is a closed eligible set, not a heuristic,
 * so the sum below walks the SAME per-row `view.max_loss.kind === 'figure'` test the row/card
 * cells already use, never a second definition of "has a max loss".
 *
 * UNLIKE Net P/L, this figure is STATIC (`maxLoss.ts`'s own header: "not live-derived ... never
 * dims and never degrades on an SSE drop"), so there is no offline arm here, by construction — the
 * caller never passes a `streamOffline`/`retainedTotal` input.
 */
import type { PositionView } from '@/features/trading/positions/view';
import type { NotANumber } from '@/shared/copy/notANumber';
import type { FigureRegister } from '@/shared/figure';

export interface CapitalAtRiskInputs {
  views: PositionView[];
}

export interface CapitalAtRiskState {
  value: string | NotANumber;
  register: FigureRegister;
  caption: string | null;
}

/** `$${abs.toLocaleString()}` — unsigned: a max loss carries no direction to sign. */
export function formatCapitalAtRisk(v: number): string {
  return `$${Math.round(v).toLocaleString()}`;
}

export function capitalAtRiskStateOf({ views }: CapitalAtRiskInputs): CapitalAtRiskState {
  const open = views.filter((v) => v.position.status === 'open');
  const m = open.length;
  if (m === 0) {
    // No open rows at all — no number, no computed-looking `$0` for a book with nothing to sum.
    return { value: '—', register: 'traced', caption: null };
  }

  let n = 0;
  let sum = 0;
  for (const v of open) {
    if (v.max_loss.kind === 'figure') {
      n += 1;
      sum += v.max_loss.dollars;
    }
  }

  if (n === 0) {
    // Open rows exist, none has a computed max-loss figure (every one withheld) — never a zero.
    return {
      value: 'unavailable',
      register: 'traced',
      caption: `0 of ${m} open have a max-loss figure`,
    };
  }

  return {
    value: formatCapitalAtRisk(sum),
    register: 'traced',
    caption: n < m ? `${n} of ${m} open have a max-loss figure` : `${m} open`,
  };
}
