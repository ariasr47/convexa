/**
 * literals.ts — closed-lookup selectors for the rec-input surfaces (SPEC §4, PLAN F4). Every
 * function here renders exactly one member of a closed set by inspecting the WIRE TOKEN — never by
 * testing a null, never by re-deriving a label from a scalar (`[digested-labels-not-raw-dump]`,
 * `[absent-is-not-none]`). Pure; no React, no fetch.
 */
import type {
  CandidateContract,
  CandidateSetEnvelope,
  CapVerdict,
  CitedContract,
  FieldReason,
  RecDecision,
  RiskInputs,
} from '@convexa/api';
import {
  NONE_OMITTED,
  NO_TWO_SIDED_QUOTE_LITERAL,
  NUMBERS_SAID_EMPTY,
  NUMBERS_SAID_UNAVAILABLE,
} from './copy';

// ---- The four-field closed literal set (AC-69/70/71/72/72a) ------------------------------------

export type FieldLiteral =
  | { kind: 'value'; text: string }
  | { kind: 'dash' } // `—`          + `No entry, so there is nothing to size.`
  | { kind: 'not_set' } // `not set`    + `Set your risk inputs`
  | { kind: 'unavailable' } // `unavailable` + the missing input named
  | { kind: 'not_given' }; // `not given`

/** AC-69/70/71/72: exactly ONE member of the closed set. `null`/`undefined`/`NaN`/`0`/`''` never
 *  render as a value. `no_trade` is checked FIRST, before the value is even touched (AC-70). */
export function fieldLiteral(args: {
  decision: RecDecision;
  value: string | number | null | undefined;
  reason: FieldReason | null | undefined;
}): FieldLiteral {
  if (args.decision === 'no_trade') return { kind: 'dash' }; // first, always
  const v = args.value;
  if (typeof v === 'number' && Number.isFinite(v) && v !== 0)
    return { kind: 'value', text: String(v) };
  if (typeof v === 'string' && v.trim() !== '') return { kind: 'value', text: v };
  if (args.reason?.reason === 'not_given') return { kind: 'not_given' };
  if (args.reason?.missing_input === 'risk_block') return { kind: 'not_set' };
  return { kind: 'unavailable' };
}

// ---- The cap surface (AC-56/57/58/58a/63) -------------------------------------------------------

export type CapSurface =
  | { kind: 'none' } // no_trade: NOTHING renders
  | { kind: 'no_cap' } // an entry-stating verdict; no verdict rendered; the cap reads `not set`
  | { kind: 'not_checkable' }
  | { kind: 'comparison'; within: boolean };

/** Closed lookup on the wire token — never a null test (AC-58a is carried entirely by member 1). */
export function capSurface(verdict: CapVerdict | null | undefined): CapSurface {
  switch (verdict) {
    case 'not_applicable':
      return { kind: 'none' };
    case 'no_cap':
      return { kind: 'no_cap' };
    case 'within':
      return { kind: 'comparison', within: true };
    case 'above':
      return { kind: 'comparison', within: false };
    case 'not_checkable':
      return { kind: 'not_checkable' };
    default:
      return { kind: 'none' }; // an unknown token renders nothing, never a guess
  }
}

// ---- The cited-contract fact line (AC-73/74/75/76/77) -------------------------------------------

export type CitedLine =
  | { kind: 'cited'; strike: number; right: string; expiration: string; quoteText: string }
  | { kind: 'off_set' }
  | { kind: 'right_undetermined'; legs: CandidateContract[] }
  | { kind: 'none' };

function quoteTextFor(c: CandidateContract, asOf: string | null): string {
  if (c.quote_presence !== 'quoted') return NO_TWO_SIDED_QUOTE_LITERAL;
  const ivPct = c.iv != null ? `${Math.round(c.iv * 100)}%` : '—';
  const delta = c.greeks.delta != null ? c.greeks.delta : '—';
  // AC-8: the candidate set's as-of is INTERPOLATED here — never a bare literal — so a cited quote
  // always names the snapshot it came from.
  return `bid ${c.bid} / ask ${c.ask} · Δ ${delta} · IV ${ivPct} · from the ${asOf ?? 'unknown'} chain snapshot`;
}

/** Closed lookup on `cited_contract.state` — never a partial-key match assembled client-side
 *  (structurally impossible upstream; this function only RENDERS the server's verdict). `asOf` is
 *  the candidate set's own as-of (AC-8) — passed in, never derived. */
export function citedLine(
  cited: CitedContract | null | undefined,
  asOf: string | null = null,
): CitedLine {
  if (!cited) return { kind: 'none' };
  switch (cited.state) {
    case 'cited': {
      const c = cited.contract;
      if (!c) return { kind: 'none' };
      return {
        kind: 'cited',
        strike: c.strike,
        right: c.right,
        expiration: c.expiration,
        quoteText: quoteTextFor(c, asOf),
      };
    }
    case 'right_undetermined':
      return { kind: 'right_undetermined', legs: cited.legs };
    case 'off_set':
      return { kind: 'off_set' };
    case 'none':
    default:
      return { kind: 'none' };
  }
}

// ---- The digested `What the numbers said` liquidity line (AC-4/66) ------------------------------

const DROP_REASON_ORDER = [
  'outside_window',
  'outside_band',
  'no_interest',
  'expiration_cap',
  'strike_cap',
] as const;
const DROP_REASON_LABEL: Record<(typeof DROP_REASON_ORDER)[number], string> = {
  outside_window: 'outside window',
  outside_band: 'outside band',
  no_interest: 'no interest',
  expiration_cap: 'expiration cap',
  strike_cap: 'strike cap',
};

/** The first non-zero drop reason in the fixed evaluation order — the same order the wire's own
 *  drop ledger is built in, so the strip never disagrees with the drawer's own breakdown. */
function topOmittedReason(byReason: CandidateSetEnvelope['omitted']['by_reason']): string {
  for (const key of DROP_REASON_ORDER) {
    if (byReason[key] > 0) return DROP_REASON_LABEL[key];
  }
  return DROP_REASON_LABEL.outside_window;
}

/** The exact content of the digested `What the numbers said` liquidity line — the wire counts ONLY;
 *  the browser never subtracts two numbers to obtain an omitted figure (AC-4). Renders on EVERY
 *  verdict including `no_trade` (AC-66). */
export function liquidityLine(envelope: CandidateSetEnvelope | null | undefined): string {
  if (!envelope || envelope.state === 'unavailable') return NUMBERS_SAID_UNAVAILABLE;
  if (envelope.state === 'none_in_band' || envelope.included.contracts === 0)
    return NUMBERS_SAID_EMPTY;
  const omittedText =
    envelope.omitted.total === 0
      ? NONE_OMITTED
      : `${envelope.omitted.total} omitted (${topOmittedReason(envelope.omitted.by_reason)})`;
  const wide = envelope.liquidity.wide_quotes ? ' · wide quotes' : '';
  return (
    `${envelope.included.contracts} candidates across ${envelope.included.expiration_count} ` +
    `expirations · ATM spread ${envelope.liquidity.atm_relative_spread_band} · ${omittedText}${wide}`
  );
}

// ---- The candidate set's freshness — as-of + session basis (AC-8) -------------------------------

const SESSION_LABEL: Record<string, string> = {
  rth: 'live session',
  after_close: 'prior close',
  closed_pre: 'prior close',
};

/** `As of {as_of} · {live session|prior close}` — rendered, without hovering, on every surface that
 *  shows a candidate-derived number (AC-8). `null` when the set carries no as-of yet (e.g. still
 *  loading, or unavailable), so the caller can simply omit the line rather than print a lie. */
export function candidateFreshnessLine(
  envelope: CandidateSetEnvelope | null | undefined,
): string | null {
  if (!envelope || !envelope.as_of) return null;
  const label = envelope.session_basis
    ? (SESSION_LABEL[envelope.session_basis] ?? 'unknown session')
    : 'unknown session';
  return `Candidates as of ${envelope.as_of} · ${label}`;
}

// ---- The superseded-inputs change detector (AC-64, SPEC §2.4(a)) --------------------------------

/** A pure, LOCAL change-detector signature over the two owner-entered facts — never a raw-value
 *  comparison rendered anywhere, and never a network round-trip: it is computed identically over
 *  the as-sent block and the currently-stored block so the two can be compared for equality without
 *  either side needing to know the other's storage representation. */
export function riskInputsSignature(
  ri: Pick<RiskInputs, 'account_size' | 'per_trade_cap'> | null | undefined,
): string {
  if (!ri) return 'none';
  const cap = ri.per_trade_cap;
  return `${ri.account_size ?? 'null'}:${cap ? `${cap.value}${cap.unit}` : 'null'}`;
}

/** `true` iff BOTH blocks are known and their signatures differ — an unknown current block (still
 *  loading, or anonymous) never claims supersession it cannot support. */
export function riskInputsSuperseded(
  sent: Pick<RiskInputs, 'account_size' | 'per_trade_cap'> | null | undefined,
  current: Pick<RiskInputs, 'account_size' | 'per_trade_cap'> | null | undefined,
): boolean {
  if (!sent || !current) return false;
  return riskInputsSignature(sent) !== riskInputsSignature(current);
}
