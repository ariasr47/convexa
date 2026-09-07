/**
 * `netPlStateOf` — the Net P/L (open) header readout's own state function (curvature-v2-surfaces
 * SPEC §2.2 end, §4.3; PLAN FE-6). Pure, no JSX, so the five arms are testable without mounting the
 * page: `PositionsPage.tsx` renders whatever this returns through `FigureCell` and adds no branch of
 * its own.
 *
 * "MARKED" is the same fact `plFigure` (`features/trading/positions/PositionRow.tsx`) already tests
 * for a single row — `view.pl_dollar != null` — walked over the SAME set the header sum already
 * walked before this conversion (`PositionsPage.tsx:147-154` pre-FE-6): every OPEN position.
 *
 * CLOSES A SHIPPED DEFECT (SPEC §4.3, `council/decisions.md` §3 #23). With no open rows at all, the
 * pre-conversion render showed a green `+$0` — a computed-looking number and a direction colour for a
 * book that has nothing to compute. The F7 arm below renders the closed-nine `—` instead, Sans, with
 * no tint.
 *
 * THE OFFLINE ARMS TAKE `retainedTotal` AS AN INPUT, DELIBERATELY, rather than re-deriving it from
 * `views`. Two reasons: (1) it keeps the offline arms directly testable with a bare number, no
 * `PositionView` fixtures required; (2) `usePortfolio`'s own mark ladder already keeps a marked
 * position's `pl_dollar` at its last-good value while the stream is down (`legMark.ts`'s "last-good
 * mark kept for offline"), so the caller's own marked-sum IS the retained total — this function does
 * not invent a second definition of "retained".
 *
 * THE OFFLINE-CAPTION PRECEDENCE (35e) IS NOT THIS FUNCTION'S JOB. `figureStateOf` already overrides
 * the caller's `caption` the moment `offline` is non-null (`FigureCell.tsx:253,262,271`) — the same
 * shipped precedence every other offline arm in this phase rides. This function therefore returns
 * `caption: null` on both offline arms: whatever it returned there would be discarded by the
 * primitive anyway, and returning `null` keeps that fact honest rather than papering over it with a
 * caption that would never render.
 */
import type { PositionView } from '@/features/trading/positions/view';
import type { NotANumber } from '@/shared/copy/notANumber';
import type { FigureRegister } from '@/shared/figure';

/** Direction is permitted only where the value is a REAL computed sum over marked rows (SPEC §4.3
 *  table) — never on `—`/`unavailable`, never during a drop. */
export type NetPlTint = 'positive' | 'negative' | null;

export interface NetPlInputs {
  views: PositionView[];
  streamOffline: boolean;
  /** The sum over currently-marked OPEN rows, or `null` when none are marked. See the file header
   *  for why this is an input rather than re-derived here. */
  retainedTotal: number | null;
}

export interface NetPlState {
  value: string | NotANumber;
  register: FigureRegister;
  caption: string | null;
  tint: NetPlTint;
  offline: { retained: boolean } | null;
}

/** `(+$|−$){abs.toLocaleString()}` — the shipped format, carried over byte-for-byte. */
export function formatNetPl(v: number): string {
  return `${v >= 0 ? '+$' : '−$'}${Math.abs(Math.round(v)).toLocaleString()}`;
}

export function netPlStateOf({ views, streamOffline, retainedTotal }: NetPlInputs): NetPlState {
  if (streamOffline) {
    // F4 (retained) / F5 (bare) — see the file header on why `caption` is `null` here.
    return retainedTotal != null
      ? {
          value: formatNetPl(retainedTotal),
          register: 'traced',
          caption: null,
          tint: null,
          offline: { retained: true },
        }
      : {
          value: 'unavailable',
          register: 'traced',
          caption: null,
          tint: null,
          offline: { retained: false },
        };
  }

  const open = views.filter((v) => v.position.status === 'open');
  const marked = open.filter((v) => v.pl_dollar != null);
  const m = open.length;
  const n = marked.length;

  if (m === 0) {
    // F7 — no open rows at all. No number, no tint (closes the shipped `+$0` green defect).
    return { value: '—', register: 'traced', caption: null, tint: null, offline: null };
  }
  if (n === 0) {
    // F8 — open rows exist, none marked. Never a number, never a zero, never a tint.
    return {
      value: 'unavailable',
      register: 'traced',
      caption: `0 of ${m} open marked`,
      tint: null,
      offline: null,
    };
  }

  const sum = marked.reduce((s, v) => s + (v.pl_dollar as number), 0);
  return {
    value: formatNetPl(sum),
    register: 'traced',
    // Mandatory whenever SOME but not all are marked (35c); none at all once every open row is (35d).
    caption: n < m ? `${n} of ${m} open marked` : null,
    tint: sum >= 0 ? 'positive' : 'negative',
    offline: null,
  };
}
