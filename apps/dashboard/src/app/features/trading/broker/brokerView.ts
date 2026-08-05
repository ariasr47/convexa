/**
 * brokerView — the broker→`PositionView` projection (the §7x seam; F3).
 *
 * Broker legs flow through the EXISTING mark ladder and P/L composition — the sim book's engine,
 * no new math (`buildPositionView` is CALLED, never reimplemented). What this module adds is the
 * honest mapping layer:
 *
 *  - signed wire `quantity` → `side` + absolute size (our model's checkable enum convention);
 *  - the explicit per-leg `multiplier` carried verbatim (never a hardcoded ×100);
 *  - `StructureKind` derived FE-SIDE by the existing recogniser over the mapped legs — there is
 *    no strategy field on the wire, and the adapter never composes; one authority;
 *  - tri-state broker facts carried to the render vocabulary: `not_supplied` → the NEW fifth
 *    literal `not provided` (a fact the FEED never carried) — a DIFFERENT truth from the shipped
 *    `not recorded` (a fact OUR record never held); `unparseable` → the shipped `unavailable`
 *    family. Never one literal for the other's meaning;
 *  - entry-derived reads (net entry, P/L vs entry) go to their WITHHELD states when any leg's
 *    cost basis is `not_supplied` — never 0, never a partial sum;
 *  - the dual-basis label input (`modeled_label`) derived from book-snapshot staleness so the
 *    panel renders `modeled now · on your book as of {time}` without re-deriving (AC-21).
 *
 * UNIT FACT (capture-confirmed, 2026-08-03 — was an assumption, is now evidence): `cost_basis` and
 * `broker_mark` are PER-UNIT dollar figures (per share / per contract-unit), matching
 * `entry_price`/mark in the existing ladder. Webull's `unit_cost` and `last_price` are per-unit;
 * its `total_cost` and `market_value` are POSITION-LEVEL aggregates — and on an OPTION row
 * `total_cost` includes the ×100 multiplier while `market_value` does NOT. That asymmetry is
 * precisely why Webull's own option P/L (`market_value − total_cost`, exactly, on every row) is
 * ~100× wrong. The adapter maps the per-unit fields, never the aggregates; a future mismatch is a
 * GATE Z clarification, not a silent FE re-scale.
 *
 * Hard constraints honored: `SimPosition` is NOT widened (the in-memory mapped value below is a
 * projection INPUT, never persisted); this module never imports `positions/store` and never
 * touches a `convexa.*` durable key.
 *
 * Pure module: no store access, no React, no fetch, no clock (`nowMs` is an input).
 */
import type { MarkResult } from '@/features/trading/model/mark';
import {
  SIM_POSITION_SCHEMA_VERSION,
  type Leg,
  type SimPosition,
} from '@/features/trading/positions/leg';
import {
  buildPositionView,
  NOT_RECORDED,
  type PositionView,
} from '@/features/trading/positions/view';
import type { BrokerBook, BrokerFact, BrokerLeg, BrokerPosition } from '@org/api';
import { isStale } from './predicates';

/**
 * The FIFTH not-a-number literal (SPEC §1/§4): a fact the broker's FEED never carried. Distinct
 * from `not recorded` (positions/view.ts NOT_RECORDED — our own saved records) — two different
 * truths, never one literal for the other.
 */
export const NOT_PROVIDED = 'not provided';

/** The shipped family for a fact the feed carried but Convexa could not parse. */
export const UNAVAILABLE = 'unavailable';

/**
 * G2 — the closed substitution. `positions/view.ts` emits `not recorded` ("our own saved record
 * never held it") for a leg with no strike/expiry. On a BROKER row that literal is simply false:
 * Convexa holds no record of this position at all — the fact is missing from Webull's FEED. Every
 * `not recorded` a broker projection would have rendered becomes `not provided`, and a spec asserts
 * the string `not recorded` appears in NO broker state.
 */
const asBrokerLiteral = (text: string): string => (text === NOT_RECORDED ? NOT_PROVIDED : text);

/** The same substitution INSIDE a composed line (the structure line embeds the literal per leg). */
const brokerLiteralsIn = (text: string): string => text.split(NOT_RECORDED).join(NOT_PROVIDED);

/** Stable per-leg id inside a broker projection — `positionId` is the broker's own stable id, so
 *  these are stable across refreshes (the mark cache + diffing key). */
export function brokerLegId(brokerPositionId: string, index: number): string {
  return `${brokerPositionId}::leg${index}`;
}

/**
 * Map wire legs into OUR leg shape (in-memory only). `entry_price` carries the supplied per-unit
 * cost basis; when the fact is not supplied the sentinel 0 is NEVER allowed to reach a render —
 * `entry_known` below withholds every entry-derived output instead.
 */
export function brokerLegsOf(bp: BrokerPosition): Leg[] {
  return bp.legs.map((l, i) => ({
    id: brokerLegId(bp.broker_position_id, i),
    kind: l.kind,
    ticker: l.underlying,
    side: l.quantity < 0 ? 'short' : 'long',
    qty: Math.abs(l.quantity),
    // Verbatim — the wire is explicit per-leg, never re-derived. When the wire OMITS it
    // (Amendment 1) this is `NaN`, deliberately: NOT 1, NOT 100. Every multiplier-dependent
    // output is force-withheld below, and `NaN` guarantees that any path which somehow escaped
    // that gate fails LOUDLY instead of quietly shipping a 100×-wrong dollar figure.
    multiplier: l.multiplier ?? Number.NaN,
    entry_price: l.cost_basis.state === 'supplied' ? Math.abs(l.cost_basis.value ?? 0) : 0,
    // Inert on this surface: broker components never render an entry-basis chip (the entry is a
    // broker fact, not a fill of ours). `snapshot` is the least-wrong resolved basis.
    entry_basis: 'snapshot',
    expiration: l.expiry ?? null,
    strike: l.strike ?? null,
    right: l.right ?? null,
  }));
}

/** Per-unit dollar text for a tri-state broker fact — the closed render mapping. */
export function brokerFactText(fact: BrokerFact): string {
  if (fact.state === 'supplied' && fact.value != null) return `$${fact.value.toFixed(2)}`;
  if (fact.state === 'unparseable') return UNAVAILABLE;
  return NOT_PROVIDED;
}

/** One leg's broker-supplied facts, pre-rendered (leg formatting never leaves the projection). */
export interface BrokerLegRead {
  leg_id: string;
  /**
   * The broker's own instrument symbol — provenance, rendered verbatim. NOT an OCC contract code:
   * on the real Webull feed an option row's `symbol` is the bare underlying ticker, identical to a
   * stock row's (capture-confirmed). Never parsed for contract detail.
   */
  symbol: string;
  cost_basis_text: string;
  broker_mark_text: string;
}

export interface BrokerPositionView extends PositionView {
  origin: 'broker';
  /** The wire record, carried through for provenance (id, fidelity) — never re-derived. */
  broker: BrokerPosition;
  fidelity: BrokerPosition['fidelity'];
  fidelity_notes: string[];
  /** Every leg's cost basis was supplied — the gate on ALL entry-derived reads. */
  entry_known: boolean;
  /**
   * G4 — every leg carried a multiplier (Amendment 1: it is omitted when the broker neither
   * supplies it nor lets it be reproduced under the guards). FALSE gates every multiplier-dependent
   * output to its withheld literal: `Net entry`, the modeled `$` P/L, the `%`, and the qty tip's
   * contract-size clause. Never defaulted to 1 or 100.
   */
  multiplier_known: boolean;
  /** What the net-entry slot renders: the figure, or the withheld literal. */
  net_entry_text: string;
  /** AC-21 dual-basis input: 'dual' iff the book snapshot is stale (the mark feed axis is the
   *  component's — `streamOffline` — never this module's). */
  modeled_label: 'single' | 'dual';
  leg_reads: BrokerLegRead[];
  /**
   * Webull's own unrealized P/L, CARRIED VERBATIM (tri-state) — never computed, never blended,
   * and **NOT RENDERED**.
   *
   * DECIDED, not pending (owner ruling Q2, 2026-08-03): the modeled figure only, for now. The
   * capture then independently vindicated it — Webull computes an option row's P/L as
   * `market_value − total_cost` while ×100'ing only the cost, so its own figure is ~100× wrong
   * (NVDA: it reports −7840.50 where the true economic figure is −3040). Rendering it beside the
   * modeled read would put a broken number under a Webull-branded basis label.
   *
   * It stays CARRIED because the tri-state pattern requires it and because reversing the ruling
   * must be a render change, not a plumbing change. A regression spec asserts the distinctive
   * captured values never reach rendered text, and a source scan asserts this file is the only
   * non-fixture module under `broker/` that names the field.
   */
  unrealized_pl: BrokerFact;
}

export interface BuildBrokerViewArgs {
  position: BrokerPosition;
  /** Keyed by `brokerLegId(position.broker_position_id, index)`. */
  legMarks: ReadonlyMap<string, MarkResult | null>;
  dte: number | null;
  nowMs: number;
  /** The envelope facts the staleness derivation needs; omit ⇒ `modeled_label: 'single'`. */
  book?: Pick<BrokerBook, 'state' | 'as_of' | 'stale_after_seconds'> | null;
}

export function buildBrokerPositionView(args: BuildBrokerViewArgs): BrokerPositionView {
  const { position: bp, legMarks, dte, nowMs, book } = args;

  const legs = brokerLegsOf(bp);
  // The in-memory projection INPUT. Never persisted, never written to any store — it exists so
  // the existing recogniser/ladder/composer run over broker legs UNCHANGED (same math, no new
  // math). `opened_time` stays '' (never fabricated — the broker feed carries no open time).
  const simShape: SimPosition = {
    id: bp.broker_position_id,
    legs,
    opened_time: '',
    status: 'open',
    entry_mode: 'manual',
    schema_version: SIM_POSITION_SCHEMA_VERSION,
  };

  const base = buildPositionView({ position: simShape, legMarks, dte });

  const entry_known = legs.length > 0 && bp.legs.every((l) => l.cost_basis.state === 'supplied');
  const anyUnparseableBasis = bp.legs.some((l) => l.cost_basis.state === 'unparseable');
  // G4 — Amendment 1's multiplier gate. Guard-only against the owner's real book (the backend
  // reconstructed ×100 for all 9 option rows under R2b's guards), but the withhold path is BUILT
  // and TESTED either way: a future account or a deep-OTM row that trips a guard must render
  // `not provided`, never a figure that is silently 100× wrong.
  const multiplier_known = legs.length > 0 && bp.legs.every((l) => l.multiplier != null);

  // Entry-derived reads are WITHHELD (never 0, never a partial figure) when any cost basis is
  // missing, when the multiplier is unknown (the figure would be a units claim we cannot make),
  // and for the zero-leg unrecognized entry (whose base P/L would otherwise sum to 0 — a
  // fabricated claim about real money).
  const withheldEntry = !entry_known || !multiplier_known;
  const pl_dollar = withheldEntry ? null : base.pl_dollar;
  const pl_pct = withheldEntry ? ({ kind: 'unavailable' } as const) : base.pl_pct;
  const net_entry_text = !multiplier_known
    ? NOT_PROVIDED // a units fact we do not hold — never `unavailable`, which implies "this cycle"
    : withheldEntry
      ? anyUnparseableBasis
        ? UNAVAILABLE
        : NOT_PROVIDED
      : `$${Math.abs(base.net_entry_cost).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} ${base.net_entry_basis === 'net_debit' ? 'debit' : 'credit'}`;

  // The composed net mark is a dollar figure — `mark × multiplier × qty`. With an unknown
  // multiplier it is `NaN` by construction (above), so it is nulled here rather than left to leak
  // into any future render. The per-leg marks themselves are untouched: per-leg truth stays visible.
  const mark = multiplier_known ? base.mark : { ...base.mark, net_mark: null };

  // The qty tip's contract-size clause ("— 100 shares each") is an assertion about the contract.
  // With no multiplier we do not make it; the count itself is still a broker-supplied fact.
  const qty_tip = multiplier_known
    ? base.qty_tip
    : `${base.qty} contract${base.qty === 1 ? '' : 's'}.`;

  const stale =
    book != null &&
    isStale(
      {
        state: book.state,
        as_of: book.as_of,
        stale_after_seconds: book.stale_after_seconds,
        positions: [],
      },
      nowMs,
    );

  return {
    ...base,
    origin: 'broker',
    pl_dollar,
    pl_pct,
    mark,
    qty_tip,
    // G2 — every rendered slot carries the FEED's literal, never our own-record one.
    legs: base.legs.map((l) => ({
      ...l,
      instrument_text: asBrokerLiteral(l.instrument_text),
      expiry_text: asBrokerLiteral(l.expiry_text),
    })),
    structure_line: brokerLiteralsIn(base.structure_line),
    structure_line_collapsed: brokerLiteralsIn(base.structure_line_collapsed),
    structure_line_full: brokerLiteralsIn(base.structure_line_full),
    broker: bp,
    fidelity: bp.fidelity,
    fidelity_notes: bp.fidelity_notes ?? [],
    entry_known,
    multiplier_known,
    net_entry_text,
    modeled_label: stale ? 'dual' : 'single',
    leg_reads: bp.legs.map((l: BrokerLeg, i) => ({
      leg_id: brokerLegId(bp.broker_position_id, i),
      symbol: l.symbol,
      cost_basis_text: brokerFactText(l.cost_basis),
      broker_mark_text: brokerFactText(l.broker_mark),
    })),
    unrealized_pl: bp.unrealized_pl,
  };
}
