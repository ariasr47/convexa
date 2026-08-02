/**
 * Typed-envelope fixtures — one per wire arm of the locked `BrokerBook` shape (INTERFACE_CONTRACT
 * §§2–4). These are what the S1–S9 component states build and test against; they are TYPED against
 * `@org/api`, so a contract drift fails the build, not the trader.
 *
 * Time is FIXED (`FIXED_NOW_MS`) so staleness derivations are deterministic. Both the multi-leg
 * (grouping-identity) and flat (per-contract) payload arms exist because the envelope supports
 * both regardless of what the capture shows (SPEC AC-6b) — post-capture arms extend this file,
 * never rework it.
 *
 * Test-support data. Nothing here is imported by application render code.
 */
import type {
  BrokerBook,
  BrokerFact,
  BrokerFailureCause,
  BrokerLeg,
  BrokerPosition,
} from '@org/api';

/** 2026-08-01T15:00:00Z — every derivation in the specs anchors here. */
export const FIXED_NOW_MS = Date.parse('2026-08-01T15:00:00Z');

/** Server-declared staleness trip point used across fixtures (envelope-carried, server-owned). */
export const STALE_AFTER_SECONDS = 300;

/** A fresh as_of: 60s old at FIXED_NOW (< the 300s threshold). */
export const AS_OF_FRESH = '2026-08-01T14:59:00Z';
/** A stale as_of: 20 minutes old at FIXED_NOW (> the 300s threshold). */
export const AS_OF_STALE = '2026-08-01T14:40:00Z';
/** EXACTLY at the threshold (300s old) — the not-yet-stale boundary case. */
export const AS_OF_AT_THRESHOLD = '2026-08-01T14:55:00Z';

export const supplied = (value: number): BrokerFact => ({ state: 'supplied', value });
export const notSupplied = (): BrokerFact => ({ state: 'not_supplied' });
export const unparseable = (): BrokerFact => ({ state: 'unparseable' });

// ---- Legs ----------------------------------------------------------------------------------------

export function equityLeg(over: Partial<BrokerLeg> = {}): BrokerLeg {
  return {
    kind: 'equity',
    symbol: 'TSLA',
    underlying: 'TSLA',
    quantity: 100, // signed; long
    multiplier: 1,
    cost_basis: supplied(242.1),
    broker_mark: supplied(250.4),
    ...over,
  };
}

export function optionLeg(over: Partial<BrokerLeg> = {}): BrokerLeg {
  return {
    kind: 'option',
    symbol: 'TSLA260821C00250000',
    underlying: 'TSLA',
    expiry: '2026-08-21',
    strike: 250,
    right: 'call',
    quantity: 1, // signed; long
    multiplier: 100,
    cost_basis: supplied(4.2),
    broker_mark: supplied(5.1),
    ...over,
  };
}

// ---- Positions -----------------------------------------------------------------------------------

/** One long equity position, everything supplied. */
export const POS_EQUITY: BrokerPosition = {
  broker_position_id: 'bp-equity-1',
  fidelity: 'exact',
  legs: [equityLeg()],
  unrealized_pl: supplied(830),
};

/** The MULTI-LEG arm: a two-leg call debit spread under ONE grouping identity (AC-6b grouped). */
export const POS_SPREAD: BrokerPosition = {
  broker_position_id: 'bp-spread-1',
  fidelity: 'exact',
  legs: [
    optionLeg({ symbol: 'TSLA260821C00250000', strike: 250, quantity: 1, cost_basis: supplied(4.2) }),
    optionLeg({
      symbol: 'TSLA260821C00260000',
      strike: 260,
      quantity: -1, // signed short
      cost_basis: supplied(1.9),
    }),
  ],
  unrealized_pl: notSupplied(),
};

/** The FLAT arm: two per-contract single-leg positions (no grouping identity — never composed). */
export const POS_FLAT_A: BrokerPosition = {
  broker_position_id: 'bp-flat-a',
  fidelity: 'exact',
  legs: [optionLeg({ symbol: 'TSLA260821C00250000', strike: 250, quantity: 1 })],
  unrealized_pl: supplied(90),
};
export const POS_FLAT_B: BrokerPosition = {
  broker_position_id: 'bp-flat-b',
  fidelity: 'exact',
  legs: [
    optionLeg({
      symbol: 'TSLA260821P00240000',
      strike: 240,
      right: 'put',
      quantity: -2,
      cost_basis: supplied(3.05),
    }),
  ],
  unrealized_pl: unparseable(),
};

/** A short put whose cost basis Webull did not send — entry-derived reads must go to `not provided`. */
export const POS_NO_COST_BASIS: BrokerPosition = {
  broker_position_id: 'bp-nocost-1',
  fidelity: 'exact',
  legs: [
    optionLeg({
      symbol: 'SPY261218P00500000',
      underlying: 'SPY',
      expiry: '2026-12-18',
      strike: 500,
      right: 'put',
      quantity: -1,
      cost_basis: notSupplied(),
      broker_mark: notSupplied(),
    }),
  ],
  unrealized_pl: notSupplied(),
};

/** Partial fidelity: mapped legs plus named dropped facts. */
export const POS_PARTIAL: BrokerPosition = {
  broker_position_id: 'bp-partial-1',
  fidelity: 'partial',
  fidelity_notes: ['dividend_accrual not mapped'],
  legs: [equityLeg({ symbol: 'BRK.B', underlying: 'BRK.B', quantity: 10 })],
  unrealized_pl: notSupplied(),
};

/** Unrecognized: the flagged opaque entry — surfaced with zero legs, never silently dropped. */
export const POS_UNRECOGNIZED: BrokerPosition = {
  broker_position_id: 'bp-unrec-1',
  fidelity: 'unrecognized',
  fidelity_notes: ['instrument class not representable'],
  legs: [],
  unrealized_pl: notSupplied(),
};

// ---- Envelopes — one per arm -----------------------------------------------------------------------

function servedBook(over: Partial<BrokerBook> = {}): BrokerBook {
  return {
    state: 'ok',
    as_of: AS_OF_FRESH,
    basis: 'fresh',
    stale_after_seconds: STALE_AFTER_SECONDS,
    account_ref: 'acctref0123456789',
    positions: [POS_EQUITY, POS_SPREAD],
    last_attempt_at: AS_OF_FRESH,
    last_attempt_outcome: 'ok',
    ...over,
  };
}

/** S1 — never connected. NO as_of/basis/stale_after_seconds/account_ref/last_attempt_* (presence rules). */
export const BOOK_NO_CREDENTIAL: BrokerBook = {
  state: 'unknown',
  reason: 'no_credential_stored',
  positions: [],
};

/** S5 — unknown, per failure cause (no snapshot to serve; attempt recorded). */
export function bookUnknown(cause: BrokerFailureCause): BrokerBook {
  return {
    state: 'unknown',
    reason: cause,
    positions: [],
    last_attempt_at: AS_OF_FRESH,
    last_attempt_outcome: cause,
  };
}

/** S3 — ok, fresh fetch. */
export const BOOK_OK_FRESH: BrokerBook = servedBook();

/** S3 — ok, cache-served (TTL serve; `last_attempt_at` is the fetch that built the cache). */
export const BOOK_OK_CACHE: BrokerBook = servedBook({ basis: 'cache' });

/** S4 — confirmed empty. `positions: []` with `state: empty` — meaning comes from `state` only. */
export const BOOK_EMPTY: BrokerBook = servedBook({ state: 'empty', positions: [] });

/** S3+S6 — ok but the snapshot has aged past the server threshold. */
export const BOOK_OK_STALE: BrokerBook = servedBook({
  as_of: AS_OF_STALE,
  basis: 'cache',
  last_attempt_at: AS_OF_STALE,
});

/** Boundary: EXACTLY stale_after_seconds old — not yet stale. */
export const BOOK_OK_AT_THRESHOLD: BrokerBook = servedBook({
  as_of: AS_OF_AT_THRESHOLD,
  basis: 'cache',
  last_attempt_at: AS_OF_AT_THRESHOLD,
});

/** S7 — degraded: last attempt failed, last good book still served with its TRUE (old) as_of. */
export function bookDegraded(cause: BrokerFailureCause): BrokerBook {
  return servedBook({
    as_of: AS_OF_STALE,
    basis: 'cache',
    last_attempt_at: '2026-08-01T14:58:00Z', // the attempt moved; the snapshot did not
    last_attempt_outcome: cause,
  });
}

/** S8 with a served snapshot — reauth banner + last-known book below. */
export const BOOK_REAUTH_WITH_SNAPSHOT: BrokerBook = bookDegraded('credential_rejected');

/** S8 with NO snapshot (e.g. post-restart) — banner only; no last-known clause. */
export const BOOK_REAUTH_NO_SNAPSHOT: BrokerBook = bookUnknown('credential_rejected');

/** `credential_unreadable` (our fault, not Webull's) — with and without a served snapshot. */
export const BOOK_UNREADABLE_WITH_SNAPSHOT: BrokerBook = bookDegraded('credential_unreadable');
export const BOOK_UNREADABLE_NO_SNAPSHOT: BrokerBook = bookUnknown('credential_unreadable');

/** An adversarial NON-empty positions array under `state: unknown` — no branch may read length,
 *  so this must STILL render S5 (AC-10's no-length-branch proof fixture). */
export const BOOK_UNKNOWN_WITH_CONTRIVED_POSITIONS: BrokerBook = {
  state: 'unknown',
  reason: 'broker_unreachable',
  positions: [POS_EQUITY],
  last_attempt_at: AS_OF_FRESH,
  last_attempt_outcome: 'broker_unreachable',
};

/** A refresh THROTTLE response relative to `BOOK_OK_CACHE`: cache basis, `last_attempt_at` UNMOVED. */
export const BOOK_REFRESH_THROTTLED: BrokerBook = servedBook({ basis: 'cache' });

/** A refresh FRESH response: basis fresh, as_of + last_attempt_at advanced. */
export const BOOK_REFRESH_ADVANCED: BrokerBook = servedBook({
  as_of: '2026-08-01T15:00:30Z',
  basis: 'fresh',
  last_attempt_at: '2026-08-01T15:00:30Z',
});

/** A refresh FAILED response: attempt moved + failure cause; old snapshot kept with true as_of. */
export const BOOK_REFRESH_FAILED: BrokerBook = servedBook({
  as_of: AS_OF_FRESH,
  basis: 'cache',
  last_attempt_at: '2026-08-01T15:00:30Z',
  last_attempt_outcome: 'broker_unreachable',
});
