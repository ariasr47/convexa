/**
 * The level-ladder model (SPEC §2.3). EXACTLY FIVE ROWS, a closed five-member union, so a sixth row
 * is a COMPILE ERROR — not a runtime length check that a careless `.push` slips past.
 *
 * ORDERED BY COMPUTED PRICE, not by a fixed list: the levels can cross, and a put wall above the mid
 * is a real market state.
 *
 * THE DISTANCE ANCHOR IS THE LEVELS SPOT, NOT THE MID. All three council voices read this
 * independently and converged: `_kit/distanceToLevel.ts:11-14` anchors on `levelSpot(m) = m.gex_spot
 * ?? m.price`; the old dealer-positioning widget's `:61` (deleted at FE-8) passed exactly that;
 * `ai-rec/copy.ts:318`
 * labels `gex_spot` "levels spot, // NOT `spot` — the levels anchor is not the live display price".
 * Anchoring on the mid would silently change every distance the trader has read for months AND make
 * all four structure rows recompute on every tick — five live rows, which canon 14 forbids in the same
 * sentence the criterion was drawn from.
 */
import type { LadderRowId } from '@/shared/charts/structure-field/levelStrokes';
import type { NotANumber } from '@/shared/copy/notANumber';
import { NOT_LIVE, type LiveClaim } from '@/shared/liveness/liveClaim';
import { distancePercentOnly, distanceToLevel } from '../_kit/distanceToLevel';

/**
 * D-14 (DELEGATED). ONE member for all five level absences, chosen by a rule the frontend can
 * evaluate — "the level field is absent or null" — because the wire carries NO discriminator:
 * `libs/api/src/generated/schema.ts:1687,1703,1705,1716,1748` are all optional AND nullable with no
 * companion reason field, and the hand-written client disagrees with its own schema
 * (`convexa.ts:212-215` declares three non-nullable while `convexa.spec.ts:366-367` fixtures two null),
 * so the TYPE cannot be evidence either. `—` is the MINIMUM-CLAIM member (`FigureCell.tsx:285` names
 * its state `empty`): it asserts less than `unavailable` (a cycle ran and failed) and less than
 * `not provided` (the feed omitted it — true for a missing key, FALSE for a present null, which this
 * wire permits). The attempted-vs-failed discriminator is booked as debt with phase 4 attached.
 * REVERSING D-14 IS THIS ONE LINE.
 */
export const ABSENT_LEVEL: NotANumber = '—';

/** The mid row's distance, and a null level's distance. Never a computed zero, never blank. */
export const ABSENT_DISTANCE: NotANumber = '—';

export interface LadderRow {
  id: LadderRowId;
  /** The exact words, unchanged from the grid this replaces (criterion 2) — the e2e readiness
   *  anchor in `curvature-v2.spec.ts` keys on `Call wall`. */
  label: 'Call wall' | 'Mid' | 'Max pain' | 'Gamma flip' | 'Put wall';
  price: string | NotANumber;
  /**
   * Ticker fidelity repair, change 6 (F10 hero residual) — the design's bare column
   * (`design/src/screens/desk.mjs:320`'s `dist: '−0.81%'`): signed percentage ONLY
   * (`distancePercentOnly`), never the dollar delta — that moved to `distanceTitle` (a hover title,
   * never a second visible line) so the 300px ladder column's tick/label/value/distance line no
   * longer wraps on a real (often-long) distance the way it used to
   * (`STRUCTURE_HERO_REVIEW.md`'s F10, "the column content is 263 px against the design's bare
   * `−0.81%`").
   */
  distance: string | NotANumber;
  /**
   * The FULL `distanceToLevel` line (`+$10 · 4.0% above`) for a hover/title affordance — `undefined`
   * for the mid row (whose `distance` is always `ABSENT_DISTANCE`, nothing to elaborate) and for a
   * null level (nothing computed). Never a SECOND visible line — `FigureRow`'s `captionTitle`.
   */
  distanceTitle?: string;
  /** True on the MID ROW ONLY. Branded (FE-1) so no row can invent a sixth expression. */
  live: LiveClaim;
  /** A token key, never a colour (SPEC §2.7). */
  stroke: LadderRowId;
  /**
   * MID ROW ONLY (SPEC §4.1, "offline/stale" column, GATE Z / FE-11: "four structure rows
   * byte-identical and un-dimmed; only the mid row dims, with the pause mark"). `null` for the four
   * structure rows — they never receive offline dimming, in every standing including a drop. Same
   * `{retained}` shape `FigureCell`/`LiveTape.tsx` already use — never a second offline vocabulary.
   */
  offline: { retained: boolean } | null;
  /**
   * MID ROW ONLY — F6, session replay (criterion 16b: "a replay standing renders F6 with no pause
   * mark"). `offline` and `replay` are MUTUALLY EXCLUSIVE by construction at the caller (a replay
   * standing is never `tileOffline` — `live-tape/LiveTape.tsx`'s own `st ? false : streamOffline`
   * discipline), never by an `!isLive` branch here — that is the shape criterion 16b forbids.
   */
  replay: boolean;
}

export interface LadderInput {
  callWall: number | null | undefined;
  putWall: number | null | undefined;
  maxPain: number | null | undefined;
  /** The STRUCTURE flip (REST, dotless) — never the live recompute (SPEC §2.3, "two gamma sources"). */
  gammaFlip: number | null | undefined;
  /** The tape mid, and the only live row. */
  mid: number | null | undefined;
  midLive: LiveClaim;
  /**
   * MID ROW ONLY (SPEC §4.1, GATE Z / FE-11). The SAME `tileOffline`/`{retained}` discipline
   * `live-tape/LiveTape.tsx` already established, branched on the STANDING union at the caller
   * (`StructureHeroPanel`'s single store read) — `null`/`undefined` when not offline. A replay
   * standing must never reach this field (criterion 16b).
   */
  midOffline?: { retained: boolean } | null;
  /** MID ROW ONLY — F6, session replay. `undefined`/`false` when not replaying. */
  midReplay?: boolean;
  /** The anchor the distances are measured from: `gex_spot ?? price`. */
  anchor: number | null;
}

const price = (v: number | null | undefined): string | NotANumber =>
  v != null && Number.isFinite(v) ? `$${v}` : ABSENT_LEVEL;

/**
 * A null level's distance is `—` for the same reason the mid row's is: the distance is undefined
 * BECAUSE THE LEVEL IS, a predicate the frontend can evaluate directly. `distanceToLevel.ts:24-25`
 * already returns `null` when either input is missing, so this is a CALLER choice, not a change to
 * the helper. An empty cell in a column is indistinguishable from a render bug —
 * `[absent-is-not-none]` in the column axis (SPEC §4.3).
 */
const dist = (v: number | null | undefined, anchor: number | null): string | NotANumber =>
  distancePercentOnly(v, anchor) ?? ABSENT_DISTANCE;

/** The full line, for the row's hover title — `undefined` (no `title` attribute) when there is
 *  nothing to elaborate beyond the short form already shown (`at spot`, or an absent level/anchor). */
const distTitle = (v: number | null | undefined, anchor: number | null): string | undefined => {
  const full = distanceToLevel(v, anchor);
  return full == null || full === 'at spot' ? undefined : full;
};

/** The header's one anchor statement (criterion 4, review): `$<gex_spot>` or, when absent, `$<price>`. */
export function formatAnchorText(anchor: number | null): string | NotANumber {
  return price(anchor);
}

/**
 * The closed five-tuple `LevelLadder` renders (SPEC §2.3 invariant). Named so the SINGLE-STORE-READ
 * host (FE-6's `StructureHeroPanel`) can compute it once, alongside `formatAnchorText`, and hand both
 * DOWN as props to the presentational `LevelLadder` — never re-derived inside a child component.
 */
export type LadderRows = [LadderRow, LadderRow, LadderRow, LadderRow, LadderRow];

export function buildLadder(input: LadderInput): LadderRows {
  const rows: LadderRow[] = [
    {
      id: 'callWall',
      label: 'Call wall',
      price: price(input.callWall),
      distance: dist(input.callWall, input.anchor),
      distanceTitle: distTitle(input.callWall, input.anchor),
      live: NOT_LIVE,
      stroke: 'callWall',
      offline: null,
      replay: false,
    },
    {
      id: 'maxPain',
      label: 'Max pain',
      price: price(input.maxPain),
      distance: dist(input.maxPain, input.anchor),
      distanceTitle: distTitle(input.maxPain, input.anchor),
      live: NOT_LIVE,
      stroke: 'maxPain',
      offline: null,
      replay: false,
    },
    {
      id: 'gammaFlip',
      label: 'Gamma flip',
      price: price(input.gammaFlip),
      distance: dist(input.gammaFlip, input.anchor),
      distanceTitle: distTitle(input.gammaFlip, input.anchor),
      live: NOT_LIVE,
      stroke: 'gammaFlip',
      offline: null,
      replay: false,
    },
    {
      id: 'putWall',
      label: 'Put wall',
      price: price(input.putWall),
      distance: dist(input.putWall, input.anchor),
      distanceTitle: distTitle(input.putWall, input.anchor),
      live: NOT_LIVE,
      stroke: 'putWall',
      offline: null,
      replay: false,
    },
    {
      id: 'mid',
      label: 'Mid',
      price: price(input.mid),
      /**
       * NEVER a computed zero. A zero would assert the mid EQUALS the structure anchor, which it
       * usually does not — and `distanceToLevel.spec.ts:8` pins `distanceToLevel(250, 250) === 'at
       * spot'`, so a computed mid distance is ANCHOR DRIFT wearing the column's label: a different
       * quantity, not merely a zero.
       */
      distance: ABSENT_DISTANCE,
      live: input.midLive,
      stroke: 'mid',
      offline: input.midOffline ?? null,
      replay: Boolean(input.midReplay),
    },
  ];

  // Sorted by COMPUTED price; rows with no price sink to the bottom in declaration order, keeping
  // "sorted by price" a true reading of what is on screen (criterion 1: a null level NEVER removes
  // a row — dropping one changes the row count and silently breaks the sort as a reading).
  const numeric = (r: LadderRow) =>
    r.price === ABSENT_LEVEL ? Number.NEGATIVE_INFINITY : Number(String(r.price).slice(1));
  rows.sort((a, b) => numeric(b) - numeric(a));
  return rows as LadderRows;
}
