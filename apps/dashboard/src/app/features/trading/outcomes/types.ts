/**
 * outcome-ledger — the derived read's type (ARCHITECTURE_CONTRACT §3.4).
 *
 * Two structural tricks live in this file, and both are load-bearing:
 *
 *  1. **A cohort is a DISCRIMINATED UNION.** The `building` variant HAS NO RATE FIELD — a UI cannot
 *     render a rate below the floor because the type does not offer one (AC-E2/AC-E3). In the
 *     `computed` variant the rate, its interval, its `n`, its mean, its dispersion, its window and
 *     its basis are NON-OPTIONAL SIBLINGS — there is no rate-without-envelope value to construct
 *     (`[model-read-carries-its-assumptions]`, AC-8/AC-9).
 *  2. **The read's root has THREE non-optional siblings** — cohorts, coverage, basis. A consumer
 *     cannot obtain the cells while omitting the coverage statement, because the type offers no
 *     cells-only value (§3.4.0). The same trick, one level up.
 *
 * There is deliberately NO include/exclude flag, no override, no filter predicate and no link from
 * an excluded record to a cohort member anywhere in this file (§8 non-goal 15).
 */

/** The counted-outcome floor per cell (§2/Q3.7 — the iv-rank precedent, applied verbatim). */
export const N_MIN = 20;

/** The five cell families, in their fixed AC-15 order. Order is a property of this constant, never
 *  of the data — sorting families or cells by rate would build a leaderboard the sample cannot
 *  support. */
export type FamilyKey = 'tier' | 'ai_rec' | 'setup' | 'iv_band' | 'persona';
export const FAMILY_ORDER: readonly FamilyKey[] = ['tier', 'ai_rec', 'setup', 'iv_band', 'persona'];

/** The ONLY fill-quality class that reaches a rate (§2/Q3.4). */
export type BasisClass = 'quoted';

export interface Interval {
  /** Integer percentage points. Rounded HERE, once, so the rendered range and the ">20pp" width
   *  test can never disagree. */
  lo: number;
  hi: number;
}

export interface CohortWindow {
  /** ISO instants of the first + last counted close (all-time, non-rolling — §4.11). */
  first: string;
  last: string;
}

/**
 * One cell's read. `building` carries a count and NOTHING a reader could take for a result —
 * emphatically no rate: a 3-for-3 cell is `building` and the type has nowhere to put "100%".
 */
export type Cohort =
  | { state: 'building'; n: number; n_min: number }
  | {
      state: 'computed';
      /** Integer percent. */
      hit_rate: number;
      /** The Wilson 95% score interval — valid at N≈20 and near 0/1, unlike the normal approx. */
      interval: Interval;
      n: number;
      /** The size-UNWEIGHTED mean of each trade's percent return. NOT dollar expectancy (AC-10). */
      mean_pl_pct: number;
      /** Sample standard deviation of the same percent returns — the dispersion, never a lone mean. */
      stdev_pl_pct: number;
      window: CohortWindow;
      basis_class: BasisClass;
    };

export interface Cell {
  /** The recorded token (a tier / setup name / band / persona id / the AI-rec class). */
  key: string;
  /** The display label, from a CLOSED lookup — never re-derived from a scalar. */
  label: string;
  cohort: Cohort;
}

/** Per-family coverage over the COUNTED population (§3.4.4). Binding identity, per family:
 *    counted_total == attributed + unavailable_at_capture + pre_capture
 *                  (+ not_attributable_by_path, AI-rec only) */
export interface FamilyCoverage {
  counted_total: number;
  pre_capture: number;
  unavailable_at_capture: number;
  attributed: number;
  /** AI-rec ONLY. The rec WAS there; the plumbing could not carry it. Collapsing this into
   *  `unavailable_at_capture` would make "had none available at entry" a lie about the product. */
  not_attributable_by_path?: number;
}

export interface CellFamily {
  key: FamilyKey;
  cells: Cell[];
  coverage: FamilyCoverage;
}

/** Every reason a RECORDED CLOSED position was not counted. Each P1 record gets EXACTLY ONE, by the
 *  precedence order in `EXCLUSION_PRECEDENCE`. */
export type ExclusionReason =
  | 'no_decision_record'
  | 'unresolved_join'
  | 'scenario_sourced'
  | 'unpriced_basis'
  | 'modeled_basis'
  | 'malformed';

/**
 * FIRST MATCH, then STOP (§3.4.3). The order is itself a decision: `scenario_sourced` is evaluated
 * BEFORE the basis reasons because "not a real decision" is a more fundamental disqualification than
 * "priced badly" — a scripted trade filed under a pricing bucket would hide the harness.
 * Without a stated order, two implementers produce two different breakdowns that BOTH balance.
 */
export const EXCLUSION_PRECEDENCE: readonly ExclusionReason[] = [
  'malformed',
  'no_decision_record',
  'unresolved_join',
  'scenario_sourced',
  'unpriced_basis',
  'modeled_basis',
];

/**
 * The readout-level coverage roll-up (§3.4.3). INTEGERS ONLY — there is no `realized_pl_*`, no
 * hit/miss, no record id and no record list here, so no rate can be computed from it and the demo
 * seed's fabricated winner is unreachable from it BY CONSTRUCTION (§3.4.5 lock 1).
 */
export interface Coverage {
  /** |P3| — the counted outcomes. */
  counted: number;
  /** M = |P1| — readable, closed, recorded positions, from the UNION of BOTH position sources. */
  recorded_closed: number;
  excluded_by_reason: Record<ExclusionReason, number>;
  /** P2 — reported BESIDE M, never inside it: an open position is not a *recorded closed* position,
   *  a never-filled order is not a position at all, and an unreadable record's closed-ness is
   *  unknowable. Nothing here participates in the balance identity. */
  adjacent: {
    open_not_counted: number;
    never_filled: number;
    unreadable_records: number;
  };
}

/** The read's own basis — the coverage counts ARE a model read and carry their assumptions too
 *  (§3.4.6). */
export interface ReadBasis {
  /** The durable sources this read spanned (the de-duped union). */
  sources: string[];
  /** The identity rule used to de-dupe the decision index. */
  identity_rule: string;
  /** false ⇒ a source failed to read ⇒ the roll-up is PARTIAL and M understates the population. */
  sources_complete: boolean;
  /** The capture epoch — the earliest `clock_time` among digest-carrying decision records, DERIVED
   *  FROM THE DATA. `null` ⇒ no record carries a digest (day one). NEVER a hardcoded ship date: an
   *  archive import can carry records from a browser whose capture began earlier. */
  capture_epoch: string | null;
}

/** The whole read. Three non-optional siblings — cells are unobtainable without coverage + basis. */
export interface LedgerRead {
  families: CellFamily[];
  coverage: Coverage;
  basis: ReadBasis;
}
