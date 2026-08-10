/**
 * grouping — the ONE place group arithmetic lives (SPEC §2.1). Pure, total, clock-injected, never
 * throws; the same shape as `positions/derive.ts` and `renderState.ts`. Called by `BrokerTabPanel`
 * immediately after the existing `views` memo, before render.
 *
 * COMPOSITION, NOT RE-PROJECTION (§2.2). This module composes `BrokerPositionView[]` that are already
 * built. It never merges legs into a synthetic position and never re-runs the projection: doing so
 * would manufacture a name, a max loss, a scalar quantity and an evaluation subject for holdings
 * nobody has proven are one trade. Composition yields exactly the contract: a count and a net.
 *
 * IMPORT ALLOW-LIST, enforced by `eslint.config.mjs` (Layer 1) and by a source scan (Layer 2):
 * `./brokerView`, `./predicates`, and `@convexa/api` TYPES ONLY. Nothing from `positions/*` — all four
 * entry points to the naming machine take a position record, so importing none of them closes all four
 * at once, including against the future. Two consequences fall out for free: no percentage is
 * computable here, and the epsilon/label/kind vocabulary is out of reach.
 *
 * NO LEG ARRAY IS EVER MATERIALISED AT GROUP LEVEL as a projection input; the wire legs are read only
 * to COUNT and to gate.
 */
import type { BrokerBook } from '@convexa/api';
import {
  NOT_PROVIDED,
  UNAVAILABLE,
  netEntryFigureText,
  withheldLiteralOf,
  type BrokerPositionView,
} from './brokerView';
import { isStale } from './predicates';

/** The uppercased underlying ticker — a FACT. The React key AND the sort key. */
export type GroupKey = string;

/** Which cause the rendered literal names — the closed vocabulary the copy layer maps. */
export type WithheldCause = 'cost_missing' | 'size_missing' | 'both_permanent' | 'unreadable';

/**
 * A discriminated union, not a nullable number: a caller cannot obtain the dollars without going
 * through `kind === 'value'`, so a withheld group cannot be summed, formatted or compared by accident.
 * That is `[absent-is-not-none]` enforced in the type.
 */
export type BrokerGroupNet =
  | { kind: 'value'; dollars: number; basis: 'net_debit' | 'net_credit' }
  | { kind: 'withheld'; literal: typeof NOT_PROVIDED | typeof UNAVAILABLE };

export interface BrokerGroup {
  key: GroupKey;
  /** === key. The header names a fact. */
  ticker: string;
  /** Sorted by `broker_position_id` ascending (the wire guarantees it is stable across refreshes). */
  members: BrokerPositionView[];
  position_count: number;
  /**
   * Σ member.broker.legs.length — the RAW WIRE legs. Carried alongside `position_count` even though
   * they are equal today: under the Webull adapter every option row maps to exactly one leg, and a
   * future adapter diverges. Two integers on a derived, never-persisted struct cost nothing and
   * prevent a silent semantic change to a number a trader is reading.
   */
  leg_count: number;
  /** THE GATE — evaluated BEFORE any sum, AND over members. */
  entry_known: boolean;
  multiplier_known: boolean;
  /** STRING INPUTS ONLY — these may never gate a computation. */
  legs_basis_not_supplied: number;
  legs_basis_unparseable: number;
  legs_multiplier_unknown: number;
  /**
   * Σ legs of members whose CONTRACT Convexa can never identify (`unpriceable` —
   * `positions/view.ts:413`; no strike/expiry/right on this feed, SPEC §1). PERMANENT for the
   * modeled-P/L axis ONLY — net entry needs no live price, so this never gates it. The same fact
   * that already selects `not provided` at leg level (`BrokerPositionRow.tsx:135`), carried here
   * so `plWithheldLiteralOf` renders the SAME permanence-first precedence rather than a hardcoded
   * literal (AC-11 bounce).
   */
  legs_unpriceable: number;
  /** The UNION cardinality. Summing the cause counts double-counts a doubly-broken leg. */
  legs_withholding_permanent: number;
  legs_withholding_transient: number;
  net_rests_on_derived_size: boolean;
  net_entry: BrokerGroupNet;
  /** The figure (shared formatter, plus the group-only zero rule), or EXACTLY one existing literal. */
  net_entry_text: string;
  /** ALL-OR-NOTHING over members. */
  pl_dollar: number | null;
  unavailable: boolean;
  frozen: boolean;
  modeled_label: 'single' | 'dual';
}

export interface GroupedBook {
  groups: BrokerGroup[];
  ungrouped: BrokerPositionView[];
}

/**
 * The group-level net-entry text. The shared figure grammar, plus the ONE group-level addition: when
 * the formatted magnitude is `0.00`, render `$0.00` with no direction word — the direction of a zero
 * net is not a fact. This keys on the FORMATTED MAGNITUDE under ordinary 2-decimal currency rounding
 * and on nothing else (`0.004` drops the word; `0.006` formats to `0.01` and keeps it). It is NOT an
 * epsilon, and the percent-denominator constant in `positions/*` is neither this threshold nor
 * reachable from here. Child rows are untouched by this rule.
 */
export function groupNetEntryText(dollars: number, basis: 'net_debit' | 'net_credit'): string {
  const magnitude = Math.abs(dollars).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return magnitude === '0.00' ? '$0.00' : netEntryFigureText(dollars, basis);
}

/** The count that belongs to the literal actually shown — never the other, never their sum. */
export function withheldCountOf(group: BrokerGroup): number | null {
  if (group.net_entry.kind !== 'withheld') return null;
  return group.net_entry.literal === NOT_PROVIDED
    ? group.legs_withholding_permanent
    : group.legs_withholding_transient;
}

/**
 * The literal the group's MODELED-P/L slot renders when `pl_dollar` is `null` — SAME precedence
 * as the net (SPEC §4's component-state table: "withheld literal + label, same precedence as the
 * net"), derived through the ONE shared cascade (`withheldLiteralOf`, §2.6) rather than a
 * hardcoded literal or a second copy of the rule (AC-11 bounce, GATE Q FAIL B1):
 *
 *  - when the NET is itself withheld, the P/L is withheld WITH it, for the SAME reason (AC-13) —
 *    the net's own literal, verbatim, never re-derived;
 *  - when the NET is a FIGURE (every cost/multiplier fact is known — `entry_known` and
 *    `multiplier_known` both true, so NEITHER of the net axis's own causes apply) but
 *    `pl_dollar` is STILL null, the remaining candidate cause is P/L-SPECIFIC: a contract
 *    Convexa can never price (`legs_unpriceable` — PERMANENT, the exact leg-level predicate
 *    `BrokerPositionRow.tsx:135` applies: `!entry_known || unpriceable`) beats a genuinely
 *    THIS-CYCLE mark failure (`unavailable`, the default fallback). Fed through the shared
 *    cascade's `legs_unpriceable` bucket — never through `legs_multiplier_unknown`, which stays
 *    reserved for the net axis's own fact.
 *
 * Returns `null` when `pl_dollar` is a figure (nothing to render here).
 */
export function plWithheldLiteralOf(
  group: BrokerGroup,
): typeof NOT_PROVIDED | typeof UNAVAILABLE | null {
  if (group.pl_dollar != null) return null;
  if (group.net_entry.kind === 'withheld') return group.net_entry.literal;
  return (
    withheldLiteralOf({
      contributing_legs: group.leg_count,
      legs_multiplier_unknown: 0,
      legs_basis_not_supplied: 0,
      legs_basis_unparseable: 0,
      legs_unpriceable: group.legs_unpriceable,
    }) ?? UNAVAILABLE
  );
}

/** Which cause the rendered literal names (drives the one tooltip and the one reason line). */
export function withheldCauseOf(group: BrokerGroup): WithheldCause | null {
  if (group.net_entry.kind !== 'withheld') return null;
  if (group.net_entry.literal === UNAVAILABLE) return 'unreadable';
  const noCost = group.legs_basis_not_supplied > 0;
  const noSize = group.legs_multiplier_unknown > 0;
  if (noCost && noSize) return 'both_permanent';
  if (noSize) return 'size_missing';
  return 'cost_missing';
}

/**
 * Group-eligible iff EVERY leg is an option AND the resolved underlying is one non-empty string.
 * Everything else routes to `ungrouped` and renders exactly as it renders today:
 *  - zero mapped legs (the `unrecognized` entry) is unkeyable — surfaced, never grouped, never counted;
 *  - ANY equity leg — netting share cost into an option group produces a dollar figure with no product
 *    meaning, and is the first step toward naming a shape;
 *  - a blank underlying, mixed underlyings, or a PRESENT-but-non-finite multiplier or quantity, which
 *    is malformedness. An ABSENT multiplier is NOT malformedness: it is a permanent withholding cause
 *    and the position stays a member (AC-12).
 */
function groupKeyOf(view: BrokerPositionView): GroupKey | null {
  const legs = view.broker.legs;
  if (legs.length === 0) return null;
  if (!legs.every((l) => l.kind === 'option')) return null;
  for (const l of legs) {
    if (l.multiplier != null && !Number.isFinite(l.multiplier)) return null;
    if (!Number.isFinite(l.quantity)) return null;
  }
  const raw = legs[0].underlying;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  if (!legs.every((l) => l.underlying === raw)) return null;
  return raw.toUpperCase();
}

function buildGroup(
  key: GroupKey,
  unsorted: readonly BrokerPositionView[],
  modeled_label: 'single' | 'dual',
): BrokerGroup {
  const members = [...unsorted].sort((a, b) =>
    a.broker.broker_position_id < b.broker.broker_position_id
      ? -1
      : a.broker.broker_position_id > b.broker.broker_position_id
        ? 1
        : 0,
  );

  const wireLegs = members.flatMap((m) => m.broker.legs);
  const leg_count = wireLegs.length;

  let legs_basis_not_supplied = 0;
  let legs_basis_unparseable = 0;
  let legs_multiplier_unknown = 0;
  let legs_withholding_permanent = 0;
  let legs_withholding_transient = 0;

  for (const l of wireLegs) {
    const noCost = l.cost_basis.state === 'not_supplied';
    const unreadable = l.cost_basis.state === 'unparseable';
    const noSize = l.multiplier == null;
    if (noCost) legs_basis_not_supplied += 1;
    if (unreadable) legs_basis_unparseable += 1;
    if (noSize) legs_multiplier_unknown += 1;
    // THE UNION: a doubly-broken leg is ONE permanent leg, never two. Summing the cause counts would
    // state "2 of 2 legs" for a 2-leg group in which one leg is entirely fine.
    if (noCost || noSize) legs_withholding_permanent += 1;
    else if (unreadable) legs_withholding_transient += 1;
  }

  // P/L-AXIS-ONLY permanent cause (§ plWithheldLiteralOf doc): `unpriceable` is a per-MEMBER fact
  // (positions/view.ts:413 — no strike/expiry/right), so its leg contribution is counted per
  // member, not per wire leg's own state.
  const legs_unpriceable = members.reduce(
    (acc, m) => (m.unpriceable ? acc + m.broker.legs.length : acc),
    0,
  );

  // THE GATE, evaluated BEFORE any sum, AND over members.
  const entry_known = leg_count > 0 && members.every((m) => m.entry_known);
  const multiplier_known = leg_count > 0 && members.every((m) => m.multiplier_known);

  const literal = withheldLiteralOf({
    contributing_legs: leg_count,
    legs_multiplier_unknown,
    legs_basis_not_supplied,
    legs_basis_unparseable,
  });

  let net_entry: BrokerGroupNet;
  if (literal != null || !entry_known || !multiplier_known) {
    net_entry = { kind: 'withheld', literal: literal ?? NOT_PROVIDED };
  } else {
    // Σ member.net_entry_cost — the signed number already on the projection, i.e. the same arithmetic
    // each member row renders in its own Net entry cell. Finiteness-checked AFTER the sum (belt and
    // braces: the multiplier gate above already ran BEFORE it).
    const dollars = members.reduce((acc, m) => acc + m.net_entry_cost, 0);
    net_entry = Number.isFinite(dollars)
      ? { kind: 'value', dollars, basis: dollars > 0 ? 'net_debit' : 'net_credit' }
      : { kind: 'withheld', literal: NOT_PROVIDED };
  }

  // ALL-OR-NOTHING. `Σ (member.pl_dollar ?? 0)` is a NAMED FORBIDDEN implementation: the reason is
  // SIGN INVERSION, not incompleteness — drop the short member of an apparent two-leg holding and a
  // losing group renders as a winner. This is equal-or-stricter than a leg-level fold, because a
  // member's `pl_dollar` is already nulled when its own entry is withheld.
  const everyPl = members.every((m) => m.pl_dollar != null);
  const summedPl = everyPl ? members.reduce((acc, m) => acc + (m.pl_dollar as number), 0) : null;

  return {
    key,
    ticker: key,
    members,
    position_count: members.length,
    leg_count,
    entry_known,
    multiplier_known,
    legs_basis_not_supplied,
    legs_basis_unparseable,
    legs_multiplier_unknown,
    legs_unpriceable,
    legs_withholding_permanent,
    legs_withholding_transient,
    net_rests_on_derived_size: members.some((m) => m.net_rests_on_derived_size),
    net_entry,
    net_entry_text:
      net_entry.kind === 'withheld'
        ? net_entry.literal
        : groupNetEntryText(net_entry.dollars, net_entry.basis),
    pl_dollar: summedPl != null && Number.isFinite(summedPl) ? summedPl : null,
    unavailable: members.some((m) => m.unavailable),
    frozen: members.some((m) => m.frozen),
    modeled_label,
  };
}

/**
 * Total: every eligible position lands in a group (N ≥ 1), everything else in `ungrouped`. Groups sort
 * by key ascending, members by broker id ascending — both FACTS. Sorting by a derived number (P/L, net
 * entry) is explicitly rejected: the mark ladder re-resolves on every live tick, so rows would jump
 * under the trader's cursor.
 *
 * `modeled_label` is derived HERE from the book, never read off `members[0]`, which would break
 * silently if a member were ever filtered.
 */
export function groupBook(
  views: readonly BrokerPositionView[],
  book: BrokerBook | null,
  nowMs: number,
): GroupedBook {
  const modeled_label: 'single' | 'dual' = isStale(book, nowMs) ? 'dual' : 'single';

  const buckets = new Map<GroupKey, BrokerPositionView[]>();
  const ungrouped: BrokerPositionView[] = [];

  for (const view of views) {
    const key = groupKeyOf(view);
    if (key == null) {
      ungrouped.push(view);
      continue;
    }
    const bucket = buckets.get(key);
    if (bucket == null) buckets.set(key, [view]);
    else bucket.push(view);
  }

  const groups = [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, members]) => buildGroup(key, members, modeled_label));

  return { groups, ungrouped };
}
