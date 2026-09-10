/**
 * `figureStateOf` — the ONE figure-state decision, extracted from `FigureCell.tsx:250-300`
 * (curvature-v2-surfaces SPEC §2.1; `council/decisions.md` §3 #0 + #16, the signature both lanes
 * signed).
 *
 * THE DECISION TRAVELS, NOT THE COMPONENT. `FigureCell` is a CARD — `CellCard`'s hover lift, its
 * label row and its `AccessibleHelp` button. Two shipped structures refuse that shape: `ScanCard`
 * makes the ENTIRE card one anchor (a focusable button inside it is interactive content nested in a
 * link) and in `ScanTable` the column header already IS the label row. So the nine-state decision
 * moves HERE, pure and JSX-free, and `FigureCell` becomes one of its callers rather than its home.
 *
 * A MOVE, NOT A COPY (§2.1's named risk). If this branch existed twice, the two copies would drift
 * and the phase would CREATE the inconsistency it exists to close. `FigureCell` therefore ends this
 * task with zero local state logic and zero local face literal, and every later surface consumes
 * this module rather than re-deriving it.
 *
 * PLACEMENT. `shared/`, not `pages/ticker/widgets/_kit/`: `features/trading/positions/` importing
 * from `pages/` inverts the repo's binding dependency direction, recorded twice in shipped code at
 * `shared/copy/notANumber.ts:18-23` and `shared/liveness/liveClaim.ts:9-14`.
 *
 * WHAT IS DELIBERATELY IN THE OUTPUT. `dim` (`FigureCell.tsx:266,275` before this change) and
 * `untraced` (`:294`) are part of the contract: without `dim` the scanner's retained arm has no
 * reduced-emphasis output at all, and `labels.ts:30-32`'s promise that "the figures stay, dimmed,
 * and say why" would have nothing behind it.
 *
 * WHAT IS DELIBERATELY *NOT*. No size, no chrome: the 20/17/15 ladder, the fixed literal size, the
 * card, the label row and the help host stay with `FigureCell` (§2.1 — "the ladder does not
 * travel"). This module never renders and never measures.
 */
import { isNotANumber, type NotANumber } from '@/shared/copy/notANumber';
import type { LiveClaim } from '@/shared/liveness/liveClaim';

/**
 * REQUIRED AT EVERY CALL SITE, NO DEFAULT (SPEC §2.6, criterion 2). Mono cannot be the fallback a
 * careless caller gets. It stays required — and IGNORED — when `value` is a `NotANumber` member:
 * the literal arm is always Sans whatever `register` says (AC-19).
 */
export type FigureRegister = 'traced' | 'asserted';

/** The nine shipped state names. `loading` is `StatSkeleton`'s (F2) and is never produced here. */
export type FigureStateName =
  | 'default'
  | 'loading'
  | 'live'
  | 'offline-retained'
  | 'offline-bare'
  | 'replay'
  | 'empty'
  | 'unavailable'
  | 'untraced';

export interface FigureStateInput {
  value: string | NotANumber;
  register: FigureRegister;
  /**
   * This FIGURE's own claim, never a widget- or page-scoped flag. Branded: only
   * `isDeliveringLive` / `andPresent` / `NOT_LIVE` can produce a `LiveClaim`, so the extraction is
   * not a back door around the one-mint rule — a scanner caller holds no `LiveUpdate` and can pass
   * only `NOT_LIVE`.
   */
  live?: LiveClaim;
  /**
   * `retained: true` is the ONLY thing that licenses the `· last known` clause — it is data-driven
   * (the displayed value came from the now-dead stream), never a fixed caption.
   * `null`/`undefined` → not offline at all.
   */
  offline?: { retained: boolean } | null;
  /** F6 — session replay: full strength, no dot, no pause mark. */
  replay?: boolean;
  /** The caller's own basis line. OVERRIDDEN by the offline and replay captions (see below). */
  caption?: string | null;
  /** Names the asserter for F9 (`register === 'asserted'` on a non-literal value). */
  assertedBy?: string;
}

export interface FigureStateOutput {
  figureState: FigureStateName;
  /** The value is a member of the closed nine — always Sans, never a figure, never stepped. */
  isLiteral: boolean;
  /** Paint the Mono (traced) face. `faceFor(mono)` turns this into an `sx` fragment. */
  mono: boolean;
  /** A REAL figure: it may step with its container. A closed-nine literal never does. */
  isFigure: boolean;
  /** Reduced emphasis — the offline arms only. Never re-minted per cell from a local `liveDim`. */
  dim: boolean;
  /** F9's dotted rule — asserted but untraced. */
  untraced: boolean;
  /** The label-row live dot. */
  showDot: boolean;
  /** The value-row stroke pause mark (`PauseMark`, F4/F5 only) — never the literal `⏸` glyph. */
  showPause: boolean;
  /** The resolved basis line, or `null`. Never `undefined`. */
  caption: string | null;
}

/**
 * The four captions below are the SHIPPED strings, byte-for-byte, not re-authored:
 * `offline · last known` (`FigureCell.tsx:262`), `offline` (`:271`), `session replay` (`:282`),
 * `${assertedBy} · untraced` with the `AI-stated · untraced` fallback (`:293`).
 *
 * Precedence is the shipped precedence (`:253,262,271`): a computed caption OVERRIDES the caller's.
 */
export function figureStateOf({
  value,
  register,
  live,
  offline,
  replay,
  caption,
  assertedBy,
}: FigureStateInput): FigureStateOutput {
  const isLiteral = isNotANumber(value);
  const base = {
    isLiteral,
    dim: false,
    untraced: false,
    showDot: false,
    showPause: false,
    caption: caption ?? null,
  };

  if (offline != null) {
    // F4 / F5 — offline. Register is not read here (§2.3): a dropped stream shows either a
    // retained TRACED figure or the bare literal, never an asserted one.
    return offline.retained
      ? {
          ...base,
          figureState: 'offline-retained',
          mono: !isLiteral,
          isFigure: !isLiteral,
          dim: true,
          showPause: true,
          caption: 'offline · last known',
        }
      : {
          ...base,
          figureState: 'offline-bare',
          mono: false,
          isFigure: false,
          dim: true,
          showPause: true,
          caption: 'offline',
        };
  }

  if (replay) {
    // F6 — no dot, no pause mark, no offline caption, full strength.
    return {
      ...base,
      figureState: 'replay',
      mono: !isLiteral,
      isFigure: !isLiteral,
      caption: 'session replay',
    };
  }

  if (isLiteral) {
    // F7 (the bare `—`) / F8 (every other member) — always Sans, register ignored (AC-19). NOT a
    // figure: fixed at the literal size, never steps with the container.
    return {
      ...base,
      figureState: value === '—' ? 'empty' : 'unavailable',
      mono: false,
      isFigure: false,
    };
  }

  if (register === 'asserted') {
    // F9 — untraced. Still A FIGURE (canon rule 23) — Sans register with the dotted rule, and it
    // steps with the container like any other figure.
    return {
      ...base,
      figureState: 'untraced',
      mono: false,
      isFigure: true,
      untraced: true,
      caption: assertedBy ? `${assertedBy} · untraced` : 'AI-stated · untraced',
    };
  }

  // F1 (default) / F3 (live) — the only arms that may show the label-row dot.
  return {
    ...base,
    figureState: live ? 'live' : 'default',
    mono: true,
    isFigure: true,
    showDot: Boolean(live),
  };
}
