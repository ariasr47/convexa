/**
 * broker-connect typed client (INTERFACE_CONTRACT.md §§2–6, verbatim).
 *
 * Five NEW endpoints, all signed-in + server-gated. The wire truths that shape every consumer:
 *  - `BrokerBook.state` (`ok | empty | unknown`) is the SOLE unknown-vs-empty disambiguator — both
 *    `empty` and `unknown` carry `positions: []`, so no consumer may branch on `positions.length`
 *    (`[absent-is-not-none]`).
 *  - ONE closed failure-cause set feeds both `reason` and `last_attempt_outcome` (§3) — they can
 *    never drift, and the FE renders them via closed lookup, never re-deriving.
 *  - Optional fields are typed `?` because the wire OMITS them (presence rules §2) — absent means
 *    absent, never null-padded.
 *  - Broker-side trouble is NEVER a 5xx: it is a typed `unknown` state or a `last_attempt_*`
 *    failure inside a 200. Real 401/403 mean the AUTH GATE refused (the auth carve-out) — those
 *    reject with `AuthError` exactly like the other gated client functions.
 *
 * Write-only credential grammar (§5): no response ever carries the key, the secret, or ciphertext —
 * only the masked last-4 hint of the App Key.
 */
import type { components } from '../generated/schema';
import { http } from './client';
import { ApiError, AuthError, isAuthErrorCode, type AuthErrorCode } from './convexa';

// ---- Closed vocabularies (§3) -------------------------------------------------------------------

/** The ONE shared failure-cause set (feeds both `reason` and `last_attempt_outcome`). */
export type BrokerFailureCause =
  | 'broker_unreachable'
  | 'rate_limited'
  | 'credential_rejected'
  | 'credential_unreadable'
  | 'adapter_fault';

/** `reason` — present iff `state: unknown`. Six values, closed, never free prose. */
export type BrokerReason = 'no_credential_stored' | BrokerFailureCause;

/** `last_attempt_outcome` — present iff `last_attempt_at` is. */
export type BrokerAttemptOutcome = 'ok' | BrokerFailureCause;

export type BrokerBookState = 'ok' | 'empty' | 'unknown';
export type BrokerBookBasis = 'fresh' | 'cache';

type BrokerBookWire = components['schemas']['BrokerBookBody'];
type BrokerFactWire = components['schemas']['BrokerFactBody'];
type BrokerLegWire = components['schemas']['BrokerLegBody'];
type BrokerPositionWire = components['schemas']['BrokerPositionBody'];

function brokerFactFromWire(value: BrokerFactWire): BrokerFact {
  if (value.state !== 'supplied' && value.state !== 'not_supplied' && value.state !== 'unparseable')
    throw new ApiError('Malformed broker book payload', 200);
  return value.value == null ? { state: value.state } : { state: value.state, value: value.value };
}

function brokerLegFromWire(value: BrokerLegWire): BrokerLeg {
  if (value.kind !== 'equity' && value.kind !== 'option')
    throw new ApiError('Malformed broker book payload', 200);
  if (value.right != null && value.right !== 'call' && value.right !== 'put')
    throw new ApiError('Malformed broker book payload', 200);
  return {
    kind: value.kind,
    symbol: value.symbol,
    underlying: value.underlying,
    ...(value.expiry == null ? {} : { expiry: value.expiry }),
    ...(value.strike == null ? {} : { strike: value.strike }),
    ...(value.right == null ? {} : { right: value.right }),
    quantity: value.quantity,
    ...(value.multiplier == null ? {} : { multiplier: value.multiplier }),
    cost_basis: brokerFactFromWire(value.cost_basis),
    broker_mark: brokerFactFromWire(value.broker_mark),
  };
}

function brokerPositionFromWire(value: BrokerPositionWire): BrokerPosition {
  if (
    value.fidelity !== 'exact' &&
    value.fidelity !== 'partial' &&
    value.fidelity !== 'unrecognized'
  )
    throw new ApiError('Malformed broker book payload', 200);
  return {
    broker_position_id: value.broker_position_id,
    fidelity: value.fidelity,
    ...(value.fidelity_notes == null ? {} : { fidelity_notes: value.fidelity_notes }),
    legs: value.legs.map(brokerLegFromWire),
    unrealized_pl: brokerFactFromWire(value.unrealized_pl),
  };
}

function brokerBookFromWire(value: BrokerBookWire): BrokerBook {
  if (value.state !== 'ok' && value.state !== 'empty' && value.state !== 'unknown')
    throw new ApiError('Malformed broker book payload', 200);
  if (value.basis != null && value.basis !== 'fresh' && value.basis !== 'cache')
    throw new ApiError('Malformed broker book payload', 200);
  const reason = value.reason;
  const validReason =
    reason === undefined ||
    reason === null ||
    reason === 'no_credential_stored' ||
    reason === 'broker_unreachable' ||
    reason === 'rate_limited' ||
    reason === 'credential_rejected' ||
    reason === 'credential_unreadable' ||
    reason === 'adapter_fault';
  if (!validReason) throw new ApiError('Malformed broker book payload', 200);
  const outcome = value.last_attempt_outcome;
  const validOutcome =
    outcome === undefined ||
    outcome === null ||
    outcome === 'ok' ||
    outcome === 'broker_unreachable' ||
    outcome === 'rate_limited' ||
    outcome === 'credential_rejected' ||
    outcome === 'credential_unreadable' ||
    outcome === 'adapter_fault';
  if (!validOutcome) throw new ApiError('Malformed broker book payload', 200);
  return {
    state: value.state,
    ...(reason == null ? {} : { reason }),
    ...(value.as_of == null ? {} : { as_of: value.as_of }),
    ...(value.basis == null ? {} : { basis: value.basis }),
    ...(value.stale_after_seconds == null
      ? {}
      : { stale_after_seconds: value.stale_after_seconds }),
    ...(value.account_ref == null ? {} : { account_ref: value.account_ref }),
    positions: value.positions.map(brokerPositionFromWire),
    ...(value.last_attempt_at == null ? {} : { last_attempt_at: value.last_attempt_at }),
    ...(outcome == null ? {} : { last_attempt_outcome: outcome }),
  };
}

// ---- Record shapes (§4) ---------------------------------------------------------------------------

/** Tri-state broker-supplied fact — never a bare null that collapses "Webull doesn't send this"
 *  into "zero". `value` present iff `state: supplied`. FE render mapping: `not_supplied` → the
 *  `not provided` literal · `unparseable` → the shipped `unavailable` family. */
export interface BrokerFact {
  state: 'supplied' | 'not_supplied' | 'unparseable';
  value?: number;
}

export type BrokerLegKind = 'equity' | 'option';
export type BrokerOptionRight = 'call' | 'put';

export interface BrokerLeg {
  kind: BrokerLegKind;
  /**
   * The broker's own instrument symbol, VERBATIM. Not an OCC contract code: the real Webull
   * positions feed returns the bare underlying ticker on option rows exactly as on stock rows
   * (capture-confirmed, `CAPTURE_FINDINGS.md`), so two option positions on one underlying carry
   * the same `symbol`. Never parsed, never synthesized into a contract code.
   */
  symbol: string;
  underlying: string;
  /** iff `kind: option` AND the broker supplies it — `YYYY-MM-DD`. Amendment 1: omitted otherwise,
   *  never null-padded; every omission is named in `fidelity_notes`. */
  expiry?: string;
  /** iff `kind: option` AND the broker supplies it — see Amendment 1. */
  strike?: number;
  /** iff `kind: option` AND the broker supplies it — see Amendment 1. */
  right?: BrokerOptionRight;
  /** SIGNED — short = negative (one convention, stated in the contract once). */
  quantity: number;
  /**
   * Explicit per-leg multiplier — never hardcoded ×100. **Always when KNOWN** (Amendment 1):
   * supplied by the broker, or reproduced exactly from broker-supplied aggregates under the
   * guards. OMITTED when neither holds — and then every multiplier-dependent output is WITHHELD
   * (`not provided`). A consumer must never coerce an absent multiplier to 1 or to 100: that is
   * the exact hardcode the positions-legs work exists to have killed.
   */
  multiplier?: number;
  cost_basis: BrokerFact;
  broker_mark: BrokerFact;
}

export type BrokerFidelity = 'exact' | 'partial' | 'unrecognized';

export interface BrokerPosition {
  /** Broker's own opaque identifier; stable across refreshes (the diffing key). */
  broker_position_id: string;
  fidelity: BrokerFidelity;
  /** iff `fidelity ≠ exact` — each dropped/unmapped fact named; never raw payload content. */
  fidelity_notes?: string[];
  /** `[]` permitted only under `fidelity: unrecognized` (surfaced, never silently omitted). */
  legs: BrokerLeg[];
  /** Webull's own unrealized P/L, carried VERBATIM by the adapter — never computed, never blended.
   *  The Convexa-modeled P/L is NOT a wire field (computed FE-side via the mark ladder). */
  unrealized_pl: BrokerFact;
}

// ---- The envelope (§2) ----------------------------------------------------------------------------

export interface BrokerBook {
  state: BrokerBookState;
  /** iff `state: unknown`. */
  reason?: BrokerReason;
  /** iff `state ∈ {ok, empty}` — UTC time of the successful fetch backing this snapshot. */
  as_of?: string;
  /** iff `state ∈ {ok, empty}`. */
  basis?: BrokerBookBasis;
  /** iff `state ∈ {ok, empty}` — server-owned staleness trip point (never an FE-invented one). */
  stale_after_seconds?: number;
  /** Opaque server-derived handle — NEVER the raw broker account number. No render consumes it in v1. */
  account_ref?: string;
  /** Always present; `[]` under BOTH `empty` and `unknown` — meaning comes from `state` only. */
  positions: BrokerPosition[];
  /** iff ≥1 attempt has occurred this process. Moves ONLY on real attempts (C5) — a cache serve or
   *  throttle is NOT an attempt, which is how "server chose not to ask" is distinguished from
   *  "server asked and failed". */
  last_attempt_at?: string;
  /** iff `last_attempt_at` present. */
  last_attempt_outcome?: BrokerAttemptOutcome;
}

// ---- Credential endpoints (§5) ---------------------------------------------------------------------

/** Masked-hint read — the ONLY credential datum the FE ever receives. `last4` = last 4 of the
 *  App Key (the secret is never hinted); `null` when not set. */
export type BrokerCredentialHint = components['schemas']['BrokerCredentialHintBody'];

/** Non-2xx on a broker surface is the AUTH GATE (401/403) or a validation refusal (422) — never a
 *  broker fault (those are typed states inside a 200). Mapped to `AuthError` so callers share the
 *  existing auth-class handling; the body is never echoed (it can carry no secret, but the grammar
 *  stays write-only regardless). */
function toBrokerGateError(result: { response: Response; error?: unknown }): AuthError {
  const res = result.response;
  let code: AuthErrorCode = 'auth_unavailable';
  if (res.status === 401 || res.status === 403) code = 'auth_required';
  else if (res.status === 422) code = 'validation';
  let message = 'Something went wrong. Please try again.';
  try {
    const body = result.error && typeof result.error === 'object' ? result.error : {};
    const fields = body as Record<string, unknown>;
    if (typeof fields.error === 'string' && isAuthErrorCode(fields.error)) code = fields.error;
    if (typeof fields.message === 'string') message = fields.message;
  } catch {
    /* keep the status-derived code */
  }
  return new AuthError(code, message, res.status);
}

/** GET /api/broker/credential — masked-hint read (S2's "credential stored" client knowledge). */
export async function fetchBrokerCredential(): Promise<BrokerCredentialHint> {
  const result = await http.GET('/api/broker/credential');
  if (!result.response.ok) throw toBrokerGateError(result);
  if (result.data === undefined) throw toBrokerGateError(result);
  return result.data;
}

/** PUT /api/broker/credential — set/replace (rotate = overwrite, no history). BOTH halves or a
 *  422 (`AuthError('validation')`) — the App Key + App Secret are ONE logical record. Success is
 *  200 `{set:true,…}`; storage-unavailable is ALSO 200 (`{set:false, storage_available:false}`). */
export async function putBrokerCredential(body: {
  app_key: string;
  app_secret: string;
}): Promise<BrokerCredentialHint> {
  const result = await http.PUT('/api/broker/credential', {
    body,
  });
  if (!result.response.ok) throw toBrokerGateError(result);
  if (result.data === undefined) throw toBrokerGateError(result);
  return result.data;
}

/** DELETE /api/broker/credential — idempotent. Also invalidates the server-side book cache (a
 *  deleted credential never leaves a ghost book — AC-3). */
export async function deleteBrokerCredential(): Promise<BrokerCredentialHint> {
  const result = await http.DELETE('/api/broker/credential');
  if (!result.response.ok) throw toBrokerGateError(result);
  if (result.data === undefined) throw toBrokerGateError(result);
  return result.data;
}

// ---- Book endpoints (§6) ----------------------------------------------------------------------------

/** GET /api/broker/book — serves the TTL cache when fresh enough (`basis: cache`), else fetches.
 *  No credential ⇒ `state: unknown`, `reason: no_credential_stored` — a 200 product state.
 *  A transport/non-2xx failure REJECTS (`ApiError`/`AuthError`); the caller degrades honestly. */
export async function fetchBrokerBook(): Promise<BrokerBook> {
  const result = await http.GET('/api/broker/book');
  if (!result.response.ok) {
    if ([401, 403, 422].includes(result.response.status)) throw toBrokerGateError(result);
    throw new ApiError(
      `Broker book read failed (${result.response.status})`,
      result.response.status,
    );
  }
  if (result.data === undefined)
    throw new ApiError('Broker book read failed (empty response)', 200);
  return brokerBookFromWire(result.data);
}

/** POST /api/broker/book/refresh — FORCE-FETCH semantics (C4): always REQUESTS a fresh broker
 *  read; the server may throttle (server-authoritative — not the client's to bypass; there is no
 *  retry parameter). All outcomes are 200 + envelope; the FE distinguishes fresh / throttled /
 *  failed from `basis` + `last_attempt_*` movement (see `useBrokerBook`). */
export async function refreshBrokerBook(): Promise<BrokerBook> {
  const result = await http.POST('/api/broker/book/refresh');
  if (!result.response.ok) {
    if ([401, 403, 422].includes(result.response.status)) throw toBrokerGateError(result);
    throw new ApiError(`Broker refresh failed (${result.response.status})`, result.response.status);
  }
  if (result.data === undefined) throw new ApiError('Broker refresh failed (empty response)', 200);
  return brokerBookFromWire(result.data);
}
