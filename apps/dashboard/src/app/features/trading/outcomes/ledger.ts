/**
 * outcome-ledger — the READ: harvest → join → classify → aggregate → account.
 *
 * ⚠ THIS MODULE HAS ZERO WRITE FUNCTIONS, and that is a structural guarantee, not a convention
 * (ARCHITECTURE_CONTRACT §5.1 boundary 3). It is a pure derived read over durable stores that
 * already exist: it introduces no durable key, no store, no wire field and no server surface.
 * A statistic that never leaves the browser cannot reach `signals.py` — this module is
 * `[score-change-is-deliberate-and-measured]`'s ENABLER, never its exerciser.
 *
 * The honest definition of an outcome (§2/Q3.3) is the whole feature:
 *   **The DecisionRecord is the SPINE. A realized result with no recorded decision is NOT an
 *   outcome.** That rule — not a special case — is what keeps the dev seed's fabricated closed
 *   position (`realized_pl_dollar: 196`, written by `putPosition` with no `appendDecision`) out of
 *   every rate. DO NOT RELAX THAT ANCHOR.
 *
 * The accounting (§4/C step 5) is a SECOND PASS over the populations the join already produced —
 * never a second, independent read of the stores. Two independent reads is how a numerator and a
 * denominator drift apart.
 */
import { WORD as TIER_WORD } from '@/features/trading/model/tier';
import type { DecisionRecord, EntryContextDigest } from '@/features/trading/model/types';
import type { SimOrder } from '@/features/trading/orders/types';
import type { Position } from '@/features/trading/positions/types';
import {
  AI_REC_CELL_KEY,
  AI_REC_CELL_LABEL,
  IV_BAND_LABEL,
  IV_BAND_ORDER,
  PERSONA_UNKNOWN_LABEL,
  setupLabel,
} from './copy';
import { harvest, HarvestIndices, IDENTITY_RULE, SOURCE_LABELS } from './sources';
import {
  Cell,
  CellFamily,
  Cohort,
  Coverage,
  ExclusionReason,
  FAMILY_ORDER,
  FamilyCoverage,
  FamilyKey,
  Interval,
  LedgerRead,
  N_MIN,
} from './types';

// ---- Fill-quality classes (§2/Q3.4) -------------------------------------------------------------

/** A real market quote or a live-crossed price — the ONLY class that reaches a rate. */
const QUOTED_LEGS = new Set(['snapshot', 'limit_fill', 'trigger_fill']);
/** A model price, a stale price, or a number the user typed. A typed price is not a fill. */
const UNPRICED_LEGS = new Set(['theoretical', 'last_known', 'manual', 'user_entered']);
/** Quote-anchored but re-priced off the live underlying × cached greeks. */
const MODELED_LEG = 'modeled';

/** Classify an outcome by the WORSE of its two priced legs. An UNRECOGNIZED basis is treated as
 *  unpriced — fail-honest: an unknown basis is not a quote. */
function basisReason(entryLeg: string, exitLeg: string): ExclusionReason | null {
  const legs = [entryLeg, exitLeg];
  if (legs.some((l) => UNPRICED_LEGS.has(l))) return 'unpriced_basis';
  if (legs.some((l) => l === MODELED_LEG)) return 'modeled_basis';
  if (legs.every((l) => QUOTED_LEGS.has(l))) return null; // quoted
  return 'unpriced_basis';
}

/**
 * The position's ENTRY basis, from wherever the durable record holds it.
 *
 * Post-cutover the record is a `SimPosition` and the basis is a LEG fact — read off the primary
 * option leg (the same leg the row's entry figure is anchored to). A pre-cutover harvested record
 * still carries the flat `entry_basis`, and this reads it unchanged. NO FAN-OUT PER LEG: a multi-leg
 * position is exactly ONE ledger record, or every Wilson interval the track record prints is wrong.
 * An absent basis falls through to `basisReason`'s fail-honest unrecognised branch.
 */
function entryBasisOf(p: Position): unknown {
  const legs = (p as { legs?: { kind?: string; entry_basis?: unknown }[] }).legs;
  if (Array.isArray(legs) && legs.length > 0) {
    const head = legs.find((l) => l.kind === 'option') ?? legs[0];
    return head?.entry_basis;
  }
  return p.entry_basis;
}

/** The §2/Q3.4 ladder as a rank: `unpriced` (2) > `modeled` (1) > `quoted` (0). An unrecognized
 *  basis ranks WORST, the same fail-honest direction `basisReason` takes. Used only by the exact-
 *  `clock_time` tie-break, which can therefore only ever move an outcome OUT of the headline. */
function basisRank(leg: string): number {
  if (UNPRICED_LEGS.has(leg)) return 2;
  if (leg === MODELED_LEG) return 1;
  if (QUOTED_LEGS.has(leg)) return 0;
  return 2;
}

// ---- Statistics (the only math this feature adds) -----------------------------------------------

const Z_95 = 1.959963984540054;

/**
 * The Wilson score interval at 95%, in INTEGER percentage points. Chosen over the normal
 * approximation because it stays valid at N≈20 and at rates near 0 or 1 — exactly where this
 * feature lives. The floor refuses to fabricate; the interval shows the reader how wide the answer
 * still is. Rounded HERE so the rendered range and the ">20pp" width test can never disagree.
 */
export function wilsonInterval(hits: number, n: number): Interval {
  if (n <= 0) return { lo: 0, hi: 0 };
  const p = hits / n;
  const z2 = Z_95 * Z_95;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (Z_95 / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    lo: Math.round(Math.max(0, center - half) * 100),
    hi: Math.round(Math.min(1, center + half) * 100),
  };
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Sample standard deviation — the dispersion that must never leave the mean's side. */
function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) * (x - m), 0) / (xs.length - 1));
}

// ---- The join ------------------------------------------------------------------------------------

/** A counted outcome (P3) — the evidence. */
interface Outcome {
  /** The entry decision record the join FIXED. The digest is read from THIS record and no other. */
  entry: DecisionRecord;
  digest: EntryContextDigest | undefined;
  order: SimOrder | null;
  plPct: number;
  hit: boolean;
  closeTime: string;
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** The entry decision record for a position: `open` (or `order_filled`) with `trade_id === id`,
 *  earliest by clock time. */
function entryRecordFor(byTrade: Map<string, DecisionRecord[]>, id: string): DecisionRecord | null {
  const recs = (byTrade.get(id) ?? []).filter(
    (d) => d.event_type === 'open' || d.event_type === 'order_filled',
  );
  if (recs.length === 0) return null;
  return recs.reduce((a, b) => (a.clock_time <= b.clock_time ? a : b));
}

/**
 * ⚠⚠ CLOSE-BEARING — the closed, exhaustive predicate of ARCHITECTURE_CONTRACT §2/Q3.5. Exported and
 * named because it IS the rule the contract pins: it must be assertable on a single record, without
 * building a whole read.
 *
 * `close` is NOT the only close-bearing event. `closeTrade(via)` is parameterized on its call site,
 * and has exactly three producers: the default (⇒ `close`), the Exit-verdict accept (⇒ `accept`) and
 * the roll close (⇒ `roll`). The event name is an accident of the call site — which is why the
 * source-scan guard in `boundaries.spec.ts` pins the set rather than trusting it.
 *
 * ⚠ THREE TRAPS, each a verified code fact, each got wrong by a plausible reading:
 *
 *  1. **`accept` is AMBIGUOUS — it is not always a close.** `useGhostTrade.acceptVerdict` writes an
 *     `accept` record on TWO paths: the Exit branch (which CLOSES, via `closeTrade`) and the
 *     Hold/Trim/Add path (which only adjusts qty and closes NOTHING). A rule of the form
 *     "`close` | `accept` | `roll`" would take that mid-life record's `mark_basis` as an EXIT basis
 *     for a position that closed elsewhere — fabricating an exit, in the arbitrary-or-flattering
 *     direction. That is WORSE than the under-count this predicate fixes. The `ai_verdict === 'Exit'`
 *     conjunct is not decoration; it is the whole discriminator.
 *  2. **`accept` + `ai_verdict === 'Roll'` is NOT a close.** The closing roll branch is gated on
 *     `rec.replacement_contract`; a Roll verdict arriving WITHOUT one falls through to the
 *     Hold/Trim/Add write and records `accept` + `ai_verdict: 'Roll'` without closing anything. So
 *     the "symmetric" guess — `ai_verdict ∈ {Exit, Roll}` — fabricates an exit for a LIVE position.
 *     Only `event_type === 'roll'` is a roll close.
 *  3. **`ai_verdict` is OVERLOADED.** On an `alert` record it carries the alert message PROSE, not a
 *     verdict. **`event_type` is the gate; `ai_verdict` only ever refines the `accept` case.**
 *
 * The `ai_verdict === 'Exit'` conjunct is SOUND despite `ai_verdict` being free text, and the
 * argument is a biconditional, not a hope: on an `accept` record `ai_verdict` comes only from
 * `rec.verdict`; `ingestVerdict` rejects anything outside `['Hold','Trim','Add','Exit','Roll']`
 * before the record can exist; and `acceptVerdict` RETURNS on the Exit branch, so the non-closing
 * `accept` write can never carry `ai_verdict: 'Exit'`.
 *
 * The set is CLOSED and FAIL-HONEST: an event this contract does not name is NOT a close. A future
 * unknown event produces an under-count that is REPORTED (`unresolved_join`), never a guessed basis.
 */
export function isCloseBearing(d: DecisionRecord): boolean {
  if (d.event_type === 'close') return true;
  if (d.event_type === 'roll') return true;
  if (d.event_type === 'accept') return d.ai_verdict === 'Exit'; // exact, case-sensitive
  return false;
}

/**
 * The exit basis: the `mark_basis` of the LATEST-by-`clock_time` CLOSE-BEARING record for the
 * position, over the de-duped UNION of both decision logs. No candidate ⇒ the join does not resolve
 * ⇒ `unresolved_join`. Never guessed, never defaulted.
 *
 * ⚠ The position record CANNOT anchor this. It anchors THAT the position closed (that is the P1
 * definition); it cannot anchor WHICH record carries the basis, because its only link to a record is
 * time and the time does not link: `close_time` and `clock_time` come from two separate
 * `new Date()` calls with a durable write between them, so `clock_time >= close_time` and is not
 * equal by construction. `clock_time === close_time` would match NOTHING; "latest at-or-before
 * `close_time`" is worse — it skips the real close record and silently selects the one BEFORE it (an
 * `alert`, or the `open` record), assigning an entry-time mark as the exit basis on every trade; and
 * "nearest to `close_time`" is heuristic time matching, banned outright (§8 non-goal 16). Do not
 * reintroduce any of the three.
 *
 * TOTALITY — the tie-break. One `trade_id` can carry TWO close-bearing records with different event
 * names from different stores (§2/Q3.1 consequence 7). Latest-by-`clock_time` resolves it; on an
 * EXACT `clock_time` tie, the WORST `mark_basis` wins. Deterministic, total, and it can only ever
 * move an outcome OUT of the headline, never into it.
 *
 * ⚠ NOT generalized to "worst basis among ALL close-bearing records": that would fold a rolled-into
 * leg's roll-ENTRY basis into its EXIT leg, double-charging the entry and excluding outcomes for
 * something untrue of their exits. Latest first; worst only among exact ties.
 */
function exitRecordFor(byTrade: Map<string, DecisionRecord[]>, id: string): DecisionRecord | null {
  const recs = (byTrade.get(id) ?? []).filter(isCloseBearing);
  if (recs.length === 0) return null;
  const latest = recs.reduce((a, b) => (a.clock_time >= b.clock_time ? a : b)).clock_time;
  return recs
    .filter((d) => d.clock_time === latest)
    .reduce((a, b) => (basisRank(String(b.mark_basis)) > basisRank(String(a.mark_basis)) ? b : a));
}

// ---- Cell families -------------------------------------------------------------------------------

interface FamilySpec {
  key: FamilyKey;
  /**
   * Where this family's context lives.
   *  - `digest` ⇒ an ABSENT digest means the record PREDATES capture.
   *  - `record` ⇒ the field is top-level on the DecisionRecord and is present on pre-capture records
   *    (tier). Tier's `pre_capture` is therefore structurally 0 — and it falls out of THE DATA
   *    through this same generic builder, not out of a tier-specific branch. A hardcoded "tier is
   *    always complete" would hide a real bug the day it isn't.
   */
  source: 'digest' | 'record';
  /** The cell keys this outcome attributes to. `null`/empty ⇒ not attributed. The SETUP family fans
   *  out (one outcome, several setups); every other family assigns at most one cell. */
  keysFor: (o: Outcome) => string[];
  label: (key: string) => string;
  /** Fixed cell order. Never data-dependent: sorting by rate builds a leaderboard the sample cannot
   *  support. */
  order: (a: Cell, b: Cell) => number;
}

/** Order by a fixed ladder; anything unrecognized sorts after it, alphabetically (fail-honest). */
function byFixedOrder(ladder: readonly string[]) {
  return (a: Cell, b: Cell): number => {
    const ia = ladder.indexOf(a.key);
    const ib = ladder.indexOf(b.key);
    if (ia === -1 && ib === -1) return a.label.localeCompare(b.label);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  };
}

const byLabel = (a: Cell, b: Cell): number => a.label.localeCompare(b.label);

const TIER_LADDER = ['dormant', 'watch', 'actionable', 'prime'] as const;

/** The rec identity for an outcome: the digest's (threaded through the entry path), else the order
 *  path's durable provenance. A scripted-scenario order never reaches here — it is excluded. */
function recIdentity(o: Outcome): string | null {
  const fromDigest = o.digest?.ai_rec_fingerprint;
  if (typeof fromDigest === 'string' && fromDigest.length > 0) return fromDigest;
  const prov = o.order?.provenance;
  if (prov?.source === 'ai_rec' && prov.rec_fingerprint) return prov.rec_fingerprint;
  return null;
}

/**
 * Can this outcome's entry path carry a rec identity at all?
 *
 * The digest key `ai_rec_fingerprint` present (even as null) ⇒ yes: capture ran on a path that
 * threads the identity, and null honestly means "no rec was involved". The key ABSENT ⇒ no: the
 * plumbing could not carry it. That is NOT `unavailable_at_capture` — the rec may well have been
 * there; collapsing the two would make "had none available at entry" a lie about the product, and
 * would let a wiring gap masquerade as market-data absence. (Every path this app writes today
 * threads it; the absent case survives for records imported from a browser that predates that.)
 */
function recPathCanCarry(o: Outcome): boolean {
  if (o.digest == null) return false; // pre-capture — decided before this question is asked
  if (Object.prototype.hasOwnProperty.call(o.digest, 'ai_rec_fingerprint')) return true;
  return o.order?.provenance?.source === 'ai_rec'; // the order path carries it durably regardless
}

function familySpecs(personaLabel?: (id: string) => string | null): FamilySpec[] {
  return [
    {
      key: 'tier',
      source: 'record',
      // ⚠ NEVER derive the tier from `opportunity_score` — that is exactly the re-derivation
      // `[digested-labels-not-raw-dump]` bans. The recorded tier, or nothing.
      keysFor: (o) => (typeof o.entry.tier === 'string' && o.entry.tier ? [o.entry.tier] : []),
      label: (key) => TIER_WORD[key as keyof typeof TIER_WORD] ?? key,
      order: byFixedOrder(TIER_LADDER),
    },
    {
      key: 'ai_rec',
      source: 'digest',
      keysFor: (o) => (recIdentity(o) != null ? [AI_REC_CELL_KEY] : []),
      label: () => AI_REC_CELL_LABEL,
      order: () => 0,
    },
    {
      key: 'setup',
      source: 'digest',
      keysFor: (o) => (o.digest?.setups ?? []).map((s) => s.name).filter(Boolean),
      label: setupLabel,
      order: byLabel,
    },
    {
      key: 'iv_band',
      source: 'digest',
      // ⚠ NEVER derive the band from an IV rank scalar — the captured wire label, or nothing.
      keysFor: (o) => (o.digest?.iv_rank_band ? [o.digest.iv_rank_band] : []),
      label: (key) => IV_BAND_LABEL[key] ?? key,
      order: byFixedOrder(IV_BAND_ORDER),
    },
    {
      key: 'persona',
      source: 'digest',
      keysFor: (o) => (o.digest?.persona_id ? [o.digest.persona_id] : []),
      label: (key) => personaLabel?.(key) ?? PERSONA_UNKNOWN_LABEL,
      order: byLabel,
    },
  ];
}

function cohortFor(outcomes: Outcome[]): Cohort {
  const n = outcomes.length;
  if (n < N_MIN) return { state: 'building', n, n_min: N_MIN };
  const pcts = outcomes.map((o) => o.plPct);
  const hits = outcomes.filter((o) => o.hit).length;
  const times = outcomes.map((o) => o.closeTime).toSorted();
  return {
    state: 'computed',
    hit_rate: Math.round((hits / n) * 100),
    interval: wilsonInterval(hits, n),
    n,
    mean_pl_pct: mean(pcts),
    stdev_pl_pct: stdev(pcts),
    window: { first: times[0], last: times[times.length - 1] },
    basis_class: 'quoted',
  };
}

function buildFamily(spec: FamilySpec, counted: Outcome[]): CellFamily {
  const buckets = new Map<string, Outcome[]>();
  const coverage: FamilyCoverage = {
    counted_total: counted.length,
    pre_capture: 0,
    unavailable_at_capture: 0,
    attributed: 0,
  };
  if (spec.key === 'ai_rec') coverage.not_attributable_by_path = 0;

  for (const o of counted) {
    const keys = spec.keysFor(o);
    if (keys.length > 0) {
      // ⚠ `attributed` is derived from the OUTCOME population, NEVER by summing cell Ns. The setup
      // family FANS OUT — one outcome firing three setups is ONE attributed outcome in three cells.
      // Summing cell Ns would overstate coverage, and would do it only for setup.
      coverage.attributed += 1;
      for (const key of new Set(keys)) {
        const list = buckets.get(key) ?? [];
        list.push(o);
        buckets.set(key, list);
      }
      continue;
    }
    if (spec.source === 'digest' && o.digest == null) {
      coverage.pre_capture += 1; // digest ABSENT = predates capture (the epoch marker)
    } else if (spec.key === 'ai_rec' && !recPathCanCarry(o)) {
      coverage.not_attributable_by_path = (coverage.not_attributable_by_path ?? 0) + 1;
    } else {
      coverage.unavailable_at_capture += 1; // capture ran; the source was genuinely absent
    }
  }

  const cells: Cell[] = [...buckets.entries()]
    .map(([key, list]) => ({ key, label: spec.label(key), cohort: cohortFor(list) }))
    .toSorted(spec.order);

  return { key: spec.key, cells, coverage };
}

// ---- The read ------------------------------------------------------------------------------------

export interface LedgerOptions {
  /** Injected by the page shell: `features/trading/outcomes` may not import `features/personas`.
   *  Unknown / deleted ⇒ null ⇒ the honest "Persona no longer saved" label, never a raw id. */
  personaLabel?: (id: string) => string | null;
}

const emptyReasons = (): Record<ExclusionReason, number> => ({
  no_decision_record: 0,
  unresolved_join: 0,
  scenario_sourced: 0,
  unpriced_basis: 0,
  modeled_basis: 0,
  malformed: 0,
});

/**
 * Compute the whole read. Synchronous and pure — the UI calls it in a `useMemo` on mount, never in
 * a `useEffect`: a one-frame flash of "Nothing has closed yet" to a user with 400 trades is a lie.
 *
 * It NEVER throws. A malformed record is skipped and COUNTED; a store that failed to read yields
 * `sources_complete: false` and a PARTIAL roll-up that says so. One bad record must not cost the
 * other 99, and a failure to balance is a defect to catch in CI — never an exception thrown into a
 * reader's readout (`[best-effort-isolated-or-null]`).
 */
export function computeLedgerRead(
  options: LedgerOptions = {},
  indices: HarvestIndices = harvest(),
): LedgerRead {
  const { decisions, positions, orders, unreadableRecords, sourcesComplete } = indices;

  const byTrade = new Map<string, DecisionRecord[]>();
  for (const d of decisions) {
    const list = byTrade.get(d.trade_id) ?? [];
    list.push(d);
    byTrade.set(d.trade_id, list);
  }
  const orderById = new Map(orders.map((o) => [o.id, o]));

  // --- The three populations (§3.4.2). P1 and P2 are DISJOINT; no record is in both. ---
  const p1: Position[] = positions.filter((p) => p.status === 'closed');
  const openNotCounted = positions.filter((p) => p.status !== 'closed').length;
  // A never-filled order is not a position AT ALL — it lives in a different index and never enters
  // the position population. It is reported BESIDE M, never inside it.
  const neverFilled = orders.filter((o) => o.status !== 'filled').length;

  const excluded = emptyReasons();
  const counted: Outcome[] = [];

  for (const p of p1) {
    // FIRST MATCH, then STOP — the stated precedence order. Without it, two implementers produce two
    // different breakdowns that BOTH balance, and the breakdown stops being a fact about the data.
    // 1. malformed — readable + closed, but missing a field an outcome requires.
    if (!isNum(p.realized_pl_dollar) || !isNum(p.realized_pl_pct) || !p.close_time) {
      excluded.malformed += 1;
      continue;
    }
    // 2. no_decision_record — THE SPINE RULE. This is where the dev seed's fabricated closed
    //    position lands, like any other record with no decision. No special case, no special copy.
    const entry = entryRecordFor(byTrade, p.id);
    if (!entry) {
      excluded.no_decision_record += 1;
      continue;
    }
    // 3. unresolved_join — the entry exists but a required join does not resolve. Never guessed,
    //    never defaulted: no nearest-open-record-by-time, no ticker/strike inference, no tolerance
    //    window on close_time (§8 non-goal 16).
    //    ⚠ This branch is LIVE and must not silently become dead. Its two reachable shapes (§2/Q3.5):
    //      (1) a closed position with a valid entry record and NO close-bearing record — the stores
    //          degrade to in-memory on a storage fault, so a position write can survive while its
    //          close `appendDecision` does not; also a close record dropped by per-record validation,
    //          and an import that carried the position but not its log;
    //      (2) a set `origin_order_id` with no `SimOrder` in the order index.
    //    Both are fixtured. If a future change makes both unreachable, the contract must say so and
    //    retire the reason — a reason that can never fire is a lie with a label.
    const exit = exitRecordFor(byTrade, p.id);
    const order = p.origin_order_id ? (orderById.get(p.origin_order_id) ?? null) : null;
    if (!exit || (p.origin_order_id && !order)) {
      excluded.unresolved_join += 1;
      continue;
    }
    // 4. scenario_sourced — evaluated BEFORE the basis reasons: "not a real decision" is a more
    //    fundamental disqualification than "priced badly", and a scripted trade filed under a
    //    pricing bucket would hide the harness.
    if (order?.provenance?.source === 'ai_scenario') {
      excluded.scenario_sourced += 1;
      continue;
    }
    // 5/6. the basis reasons.
    const reason = basisReason(String(entryBasisOf(p)), String(exit.mark_basis));
    if (reason) {
      excluded[reason] += 1;
      continue;
    }
    counted.push({
      entry,
      // ⚠ The digest is read from the SAME entry record the join fixed — NEVER borrowed from
      // another record with the same `trade_id`. An `accept` record may carry a digest the `open`
      // record lacks; reading across would fabricate context the entry did not observe and would
      // under-count pre-capture.
      digest: entry.entry_context,
      order,
      plPct: p.realized_pl_pct,
      // Hit = realized more than zero, STRICTLY. A zero result is not a hit and stays in the
      // denominator — a scratch is not a win.
      hit: p.realized_pl_dollar > 0,
      closeTime: p.close_time,
    });
  }

  const coverage: Coverage = {
    counted: counted.length,
    recorded_closed: p1.length,
    excluded_by_reason: excluded,
    adjacent: {
      open_not_counted: openNotCounted,
      never_filled: neverFilled,
      unreadable_records: unreadableRecords,
    },
  };

  const specs = familySpecs(options.personaLabel);
  const families = FAMILY_ORDER.map((key) => {
    const spec = specs.find((s) => s.key === key);
    if (!spec) throw new Error(`unreachable: no spec for ${key}`);
    return buildFamily(spec, counted);
  });

  // The capture epoch — DERIVED FROM THE DATA, over the UNIONED decision index: the earliest
  // clock_time among records carrying a digest. Never a build constant, never a hardcoded ship date
  // (an archive import can carry records from a browser whose capture began earlier — a hardcoded
  // date would misdate the user's own history).
  const digestTimes = decisions
    .filter((d) => d.entry_context != null)
    .map((d) => d.clock_time)
    .toSorted();
  const captureEpoch = digestTimes.length > 0 ? digestTimes[0] : null;

  return {
    families,
    coverage,
    basis: {
      sources: [...SOURCE_LABELS],
      identity_rule: IDENTITY_RULE,
      sources_complete: sourcesComplete,
      capture_epoch: captureEpoch,
    },
  };
}
