/**
 * Shared fixtures. Every fixture the suite has today is a LONG SINGLE LEG, so the suite is
 * structurally blind to exactly what this feature adds (SPEC §7). These are the shapes that blind
 * spot covers: a short vertical, a covered call, 100 shares, a calendar, a zero-cost collar, a
 * colliding-id pair across the two source stores, an unparseable blob, a malformed legacy record,
 * and a saved view whose filter references a value that no longer exists.
 *
 * Test-only data. Nothing here is imported by application code.
 */
import { defaultConfig, defaultView } from './defaults';
import type { Leg, SimPosition } from './leg';
import { SIM_POSITION_SCHEMA_VERSION } from './leg';
import type { CustomizationState } from './types';

let seq = 0;
const legId = () => `fx-leg-${++seq}`;

export function mkLeg(over: Partial<Leg> = {}): Leg {
  return {
    id: legId(),
    kind: 'option',
    ticker: 'TSLA',
    side: 'long',
    qty: 1,
    multiplier: 100,
    entry_price: 10,
    entry_basis: 'snapshot',
    expiration: '2026-08-21',
    strike: 400,
    right: 'call',
    ...over,
  };
}

export function mkPosition(legs: Leg[], over: Partial<SimPosition> = {}): SimPosition {
  return {
    id: `fx-pos-${++seq}`,
    legs,
    opened_time: '2026-07-01T14:00:00Z',
    status: 'open',
    entry_mode: 'manual',
    schema_version: SIM_POSITION_SCHEMA_VERSION,
    ...over,
  };
}

// ---- Internal leg builders (one expiration, one ticker, unless the fixture's point is otherwise) --

/** The near expiration every fixture uses unless mixed expiries are the whole point. */
const EXP = '2026-08-21';
/** The far expiration, for the calendar/diagonal pair only. */
const FAR = '2026-09-18';

const longCall = (strike: number, entry_price: number, over: Partial<Leg> = {}) =>
  mkLeg({ side: 'long', right: 'call', strike, entry_price, ...over });
const shortCall = (strike: number, entry_price: number, over: Partial<Leg> = {}) =>
  mkLeg({ side: 'short', right: 'call', strike, entry_price, ...over });
const longPut = (strike: number, entry_price: number, over: Partial<Leg> = {}) =>
  mkLeg({ side: 'long', right: 'put', strike, entry_price, ...over });
const shortPut = (strike: number, entry_price: number, over: Partial<Leg> = {}) =>
  mkLeg({ side: 'short', right: 'put', strike, entry_price, ...over });

/** Equity: multiplier 1 and NO option facts at all — never `0`, never a placeholder strike. */
const shares = (side: 'long' | 'short', qty: number, entry_price: number) =>
  mkLeg({
    kind: 'equity',
    side,
    qty,
    multiplier: 1,
    entry_price,
    expiration: null,
    strike: null,
    right: null,
  });

// ---- Single leg ---------------------------------------------------------------------------------

export const FX_LONG_CALL = mkPosition([longCall(400, 12.4)]);
export const FX_LONG_PUT = mkPosition([longPut(380, 9.1)]);
export const FX_SHORT_PUT = mkPosition([shortPut(380, 9.1)]);
export const FX_SHORT_CALL = mkPosition([shortCall(420, 6.1)]);

// ---- Equity ------------------------------------------------------------------------------------

export const FX_SHARES_LONG = mkPosition([shares('long', 100, 250)]);
export const FX_SHARES_SHORT = mkPosition([shares('short', 100, 250)]);

// ---- Verticals ---------------------------------------------------------------------------------

export const FX_CALL_DEBIT_SPREAD = mkPosition([longCall(400, 12.4), shortCall(420, 6.1)]);
/** A CALL CREDIT SPREAD — the short vertical §7 names. Nets negative (a credit received). */
export const FX_SHORT_VERTICAL = mkPosition([shortCall(400, 12.4), longCall(420, 6.1)]);
export const FX_PUT_CREDIT_SPREAD = mkPosition([shortPut(380, 9.1), longPut(360, 4.2)]);
export const FX_PUT_DEBIT_SPREAD = mkPosition([longPut(400, 11.9), shortPut(380, 5.6)]);

// ---- Equity + option ---------------------------------------------------------------------------

export const FX_COVERED_CALL = mkPosition([shares('long', 100, 250), shortCall(420, 6.1)]);
export const FX_PROTECTIVE_PUT = mkPosition([shares('long', 100, 250), longPut(240, 5)]);
/**
 * The equity price is zeroed deliberately so the NET is under NET_BASIS_EPS — this fixture exists to
 * exercise `no_basis`, not to model a real cost basis.
 */
export const FX_ZERO_COST_COLLAR = mkPosition([
  shares('long', 100, 0),
  longPut(240, 5),
  shortCall(260, 5),
]);

// ---- Straddle / strangle -----------------------------------------------------------------------

export const FX_LONG_STRADDLE = mkPosition([longCall(400, 12.4), longPut(400, 11.9)]);
export const FX_SHORT_STRANGLE = mkPosition([shortCall(420, 6.1), shortPut(380, 5.6)]);

// ---- Four-leg ----------------------------------------------------------------------------------

export const FX_IRON_CONDOR = mkPosition([
  longPut(380, 2.1),
  shortPut(400, 4.6),
  shortCall(440, 4.4),
  longCall(460, 1.9),
]);

export const FX_IRON_BUTTERFLY = mkPosition([
  longPut(380, 2.1),
  shortPut(420, 9),
  shortCall(420, 8.6),
  longCall(460, 1.9),
]);

// ---- Mixed expirations -------------------------------------------------------------------------

export const FX_CALENDAR = mkPosition([
  longCall(400, 15, { expiration: FAR }),
  shortCall(400, 12.4, { expiration: EXP }),
]);

export const FX_DIAGONAL = mkPosition([
  longCall(400, 15, { expiration: FAR }),
  shortCall(420, 6.1, { expiration: EXP }),
]);

// ---- Residue cases (`custom`) ------------------------------------------------------------------

/** A 1×2 ratio — an unequal-qty leg pair, so no vertical matches. */
export const FX_RATIO_1X2 = mkPosition([longCall(400, 12.4), shortCall(420, 6.1, { qty: 2 })]);

/**
 * Six legs (AC-13): the iron-condor shape plus a further call spread. Rebuilt rather than reusing
 * `FX_IRON_CONDOR.legs`, so no two fixtures ever share a `LegId` — a shared id would silently alias
 * entries in any mark map keyed across fixtures.
 */
export const FX_SIX_LEG = mkPosition([
  longPut(380, 2.1),
  shortPut(400, 4.6),
  shortCall(440, 4.4),
  longCall(460, 1.9),
  longCall(480, 0.9),
  shortCall(500, 0.4),
]);

/**
 * Every position fixture, by name — so a guard can sweep all of them and a later suite can iterate
 * the whole named set without re-listing it.
 */
export const ALL_FIXTURES: Readonly<Record<string, SimPosition>> = {
  FX_LONG_CALL,
  FX_LONG_PUT,
  FX_SHORT_PUT,
  FX_SHORT_CALL,
  FX_SHARES_LONG,
  FX_SHARES_SHORT,
  FX_CALL_DEBIT_SPREAD,
  FX_SHORT_VERTICAL,
  FX_PUT_CREDIT_SPREAD,
  FX_PUT_DEBIT_SPREAD,
  FX_COVERED_CALL,
  FX_PROTECTIVE_PUT,
  FX_ZERO_COST_COLLAR,
  FX_LONG_STRADDLE,
  FX_SHORT_STRANGLE,
  FX_IRON_CONDOR,
  FX_IRON_BUTTERFLY,
  FX_CALENDAR,
  FX_DIAGONAL,
  FX_RATIO_1X2,
  FX_SIX_LEG,
};

// ---- Durable-source fixtures -------------------------------------------------------------------

/** A shipped v2 record, in the OLD shape — this is what `migrate.ts` must lift. */
export const LEGACY_V2_RECORD = {
  id: 'shared-1',
  ticker: 'TSLA',
  expiration: '2026-08-21',
  strike: 400,
  right: 'call',
  side: 'long',
  qty: 2,
  entry_mark: 12.4,
  entry_basis: 'snapshot',
  entry_time: '2026-06-12T15:32:00Z',
  stop: 8,
  target: 22,
  status: 'open',
  entry_mode: 'manual',
  schema_version: 2,
};

/** A shipped v1 ghost trade, in the OLD shape, keyed by TICKER in its blob. */
export const LEGACY_V1_RECORD = {
  id: 'ghost-only-1',
  ticker: 'NVDA',
  expiration: '2026-09-18',
  strike: 170,
  right: 'put',
  side: 'long',
  qty: 1,
  entry_mark: 7.85,
  entry_basis: 'snapshot',
  entry_time: '2026-06-18T14:05:00Z',
  status: 'open',
  schema_version: 1,
};

/**
 * Id collisions between the two stores are the EXPECTED case, not an edge case
 * (`positions/store.ts:49` carries `id: t.id` forward verbatim). This pair is the trader the
 * union exists for: the SAME id under both keys, forked, with the v1 copy CLOSED.
 */
export const COLLIDING_ID_PAIR = {
  v2Record: { ...LEGACY_V2_RECORD, id: 'shared-1', stop: 8, target: 22, status: 'open' },
  v1Record: {
    ...LEGACY_V2_RECORD,
    id: 'shared-1',
    status: 'closed',
    close_time: '2026-06-30T19:55:00Z',
    realized_pl_dollar: 196,
    realized_pl_pct: 48.4,
    stop: null as number | null,
    target: null as number | null,
  },
};

/** Missing `right` — the lift is FORBIDDEN from fabricating one (SPEC §2.6). */
export const MALFORMED_LEGACY_RECORD = {
  id: 'malformed-1',
  ticker: 'TSLA',
  expiration: '2026-08-21',
  strike: 400,
  side: 'long',
  qty: 1,
  entry_mark: 3.2,
  entry_basis: 'snapshot',
  entry_time: '2026-06-01T14:00:00Z',
  status: 'open',
  schema_version: 2,
} as Record<string, unknown>;

export const UNPARSEABLE_BLOB = '{"schema_version":2,"positions":{ THIS IS NOT JSON';

export const LEGACY_V2_BLOB = JSON.stringify({
  schema_version: 2,
  positions: { [LEGACY_V2_RECORD.id]: LEGACY_V2_RECORD },
  decisions: [
    { id: 'd-v2-1', event_type: 'open', clock_time: '2026-06-12T15:32:00Z', trade_id: 'shared-1' },
  ],
  customization: undefined,
});

/**
 * `d-v2-1` appears in BOTH blobs deliberately: the v1→v2 migration copied decision records forward,
 * so the union must de-dupe by `decisionIdentity()` and produce it ONCE (AC-49).
 */
export const LEGACY_V1_BLOB = JSON.stringify({
  schema_version: 1,
  trades: { NVDA: LEGACY_V1_RECORD, TSLA: COLLIDING_ID_PAIR.v1Record },
  decisions: [
    { id: 'd-v2-1', event_type: 'open', clock_time: '2026-06-12T15:32:00Z', trade_id: 'shared-1' },
    {
      id: 'd-v1-1',
      event_type: 'open',
      clock_time: '2026-06-18T14:05:00Z',
      trade_id: 'ghost-only-1',
    },
  ],
});

/**
 * A saved view whose filter references a value that no longer exists (AC-54). That state only exists
 * for a user with pre-existing durable state, which a fresh browser cannot reproduce — without this
 * fixture the stale-view AC is unverifiable at GATE Q.
 */
export const STALE_SAVED_VIEW_CUSTOMIZATION: CustomizationState = {
  views: [
    defaultView(),
    {
      id: 'view-tech-swings',
      name: 'Tech swings',
      config: {
        ...defaultConfig(),
        group: 'strategy',
        filter: { ticker: null, status: ['open'], strategy: 'long_call', expiry: null },
      },
    },
  ],
  activeViewId: 'view-tech-swings',
  working: {
    ...defaultConfig(),
    group: 'strategy',
    filter: { ticker: null, status: ['open'], strategy: 'long_call', expiry: null },
  },
};
