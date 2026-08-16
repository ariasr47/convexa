/**
 * literals.ts — closed-lookup selectors for the rec-input surfaces (SPEC §4, PLAN F4). Every
 * function here renders exactly one member of a closed set by inspecting the WIRE TOKEN — never by
 * testing a null, never by re-deriving a label from a scalar (`[digested-labels-not-raw-dump]`,
 * `[absent-is-not-none]`). Pure; no React, no fetch.
 */
import { typographyTokens } from '@/shared/theme/tokens';
import type {
  AnchorKind,
  CandidateContract,
  CandidateSetEnvelope,
  CapVerdict,
  CitedContract,
  FieldReason,
  Grounding,
  GroundingField,
  GroundingState,
  RecDecision,
  RiskInputs,
  RiskRefusal,
} from '@convexa/api';
import {
  ANCHOR_LABEL,
  ANCHOR_LABEL_FALLBACK,
  CAP_COULD_NOT_CHECK,
  CAP_REFUSAL_SENTENCE,
  GROUNDING_BLOCK_ABSENT,
  GROUNDING_CARD,
  groundingDefinitionTip,
  MISSING_INPUT_CLAUSE,
  NO_TWO_SIDED_QUOTE_LITERAL,
  NONE_OMITTED,
  NUMBERS_SAID_EMPTY,
  NUMBERS_SAID_UNAVAILABLE,
  PREFILL_WITHHELD,
  someTracedLine,
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

// ---- rec-absence-literals-hole: the six plan/conviction fields' sibling selector ----------------

/**
 * The SIBLING of `FieldLiteral` for the six plan/conviction fields. A PROPER SUPERSET, not a disjoint
 * union: TS structural typing then makes it impossible to hand a `PlanFieldLiteral` to a parameter
 * typed `FieldLiteral` without an explicit unsafe cast, so the one new word cannot leak into a shipped
 * consumer. The shipped union gains no member.
 */
export type PlanFieldLiteral = FieldLiteral | { kind: 'unrecognized' };

/**
 * The sibling selector. Shares the shipped value arms and the `no_trade`-first short-circuit, and
 * differs in exactly two ways: an EXPLICIT `unrecognized_value` arm, and a fallthrough of `not_given`
 * rather than `unavailable`.
 *
 * ARM ORDER IS LOAD-BEARING (plan R-2): the `unrecognized_value` arm sits AHEAD of the value arms,
 * because an off-scale conviction arrives as a non-empty string and the shipped value arm would paint
 * it (AC-24 forbids the raw string reaching the DOM). Everything after it is the shipped value test,
 * then a CLOSED LOOKUP ON THE WIRE TOKEN ALONE — no null test, no sibling-field inference, no
 * re-derivation (`[digested-labels-not-raw-dump]`, `[absent-is-not-none]`).
 *
 * `unavailable` requires BOTH tokens (plan R-3): the reason AND `missing_input: 'candidate_set'`, the
 * only missing input any of the six can declare. `not_set` is unreachable here by construction — none
 * of the six depends on owner input (AC-23).
 */
export function planFieldLiteral(args: {
  decision: RecDecision;
  value: string | number | null | undefined;
  reason: FieldReason | null | undefined;
}): PlanFieldLiteral {
  if (args.decision === 'no_trade') return { kind: 'dash' }; // first, always
  if (args.reason?.reason === 'unrecognized_value') return { kind: 'unrecognized' };
  const v = args.value;
  if (typeof v === 'number' && Number.isFinite(v) && v !== 0)
    return { kind: 'value', text: String(v) };
  if (typeof v === 'string' && v.trim() !== '') return { kind: 'value', text: v };
  if (args.reason?.reason === 'unavailable' && args.reason.missing_input === 'candidate_set')
    return { kind: 'unavailable' };
  return { kind: 'not_given' };
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

// ---- ai-rec-grounding: closed lookups (SPEC §4, INTERFACE_CONTRACT rule 1) ----------------------

export type FigureClause =
  | { kind: 'none' }
  | { kind: 'exact'; anchor: string; value: number }
  | { kind: 'near'; anchor: string; value: number }
  | { kind: 'inside_range'; expiration: string; low: number; high: number }
  | { kind: 'untraced' }
  | { kind: 'not_checkable'; clause: string };

/** Total over the eleven-member closed set; an unrecognized token renders the level-class fallback,
 *  never a raw wire string and never a badge. */
export function anchorLabel(kind: AnchorKind | null | undefined): string {
  if (!kind) return ANCHOR_LABEL_FALLBACK;
  return ANCHOR_LABEL[kind] ?? ANCHOR_LABEL_FALLBACK;
}

/** Switch on `state`, then `basis`, then `not_checkable_reason` — NEVER on which keys are non-null, and
 *  never by comparing two figures (AC-3, ship-blocking). */
export function figureClause(f: GroundingField | null | undefined): FigureClause {
  if (!f) return { kind: 'none' };
  switch (f.state) {
    case 'traced':
      switch (f.basis) {
        case 'exact':
          return f.anchor_value == null
            ? { kind: 'none' } // a traced clause naming a source with no number renders NOWHERE (AC-2)
            : { kind: 'exact', anchor: anchorLabel(f.anchor_kind), value: f.anchor_value };
        case 'near':
          return f.anchor_value == null
            ? { kind: 'none' }
            : { kind: 'near', anchor: anchorLabel(f.anchor_kind), value: f.anchor_value };
        case 'inside_range':
          return f.range_low == null || f.range_high == null || f.expiration == null
            ? { kind: 'none' }
            : {
                kind: 'inside_range',
                expiration: f.expiration,
                low: f.range_low,
                high: f.range_high,
              };
        default:
          return { kind: 'none' };
      }
    case 'untraced':
      return { kind: 'untraced' };
    case 'not_checkable': {
      const r = f.not_checkable_reason;
      if (!r || r === 'structurally_unchecked') return { kind: 'none' };
      const clause = MISSING_INPUT_CLAUSE[r];
      return clause ? { kind: 'not_checkable', clause } : { kind: 'none' };
    }
    case 'not_applicable':
    default:
      return { kind: 'none' };
  }
}

export type CardLine =
  | { kind: 'none' }
  | { kind: 'quiet'; text: string; tip: string | null }
  | { kind: 'warning'; text: string; tip: string | null };

/** The ONE client-selected branch is `grounding` ABSENT — a lookup on PRESENCE, never a re-derivation
 *  from figures. The browser never counts, compares or folds. */
export function cardGroundingLine(g: Grounding | null | undefined): CardLine {
  if (!g) return { kind: 'warning', text: GROUNDING_BLOCK_ABSENT, tip: null };
  const tip = groundingDefinitionTip(g.tolerance_pct ?? null);
  switch (g.card) {
    case 'all_traced':
      return { kind: 'quiet', text: GROUNDING_CARD.all_traced, tip };
    case 'some_traced':
      return { kind: 'quiet', text: someTracedLine(g.counts.traced, g.counts.checked), tip };
    case 'local_rules':
      return { kind: 'quiet', text: GROUNDING_CARD.local_rules, tip };
    case 'none_traced':
      return { kind: 'warning', text: GROUNDING_CARD.none_traced, tip };
    case 'could_not_check':
      return { kind: 'warning', text: GROUNDING_CARD.could_not_check, tip };
    case 'not_applicable':
      return { kind: 'quiet', text: GROUNDING_CARD.not_applicable, tip };
    default:
      return { kind: 'none' };
  }
}

/**
 * AC-7 (SB) / AC-68 — the simulated entry dialog's prefill gate. A CLOSED LOOKUP on the wire state.
 *
 *   traced          → seeds exactly as on `main`
 *   untraced        → withheld, with its own reason
 *   not_checkable   → withheld, with its own reason
 *   not_applicable  → the rec stated no figure: nothing to seed, nothing to explain (unchanged)
 *   NO BLOCK (D8)   → withheld, with its OWN THIRD reason — never the `not_checkable` one, which
 *                     would collapse "we could not check this figure" into "no check reached this
 *                     browser at all" (`absent-is-not-none`) at the one boundary where a number stops
 *                     being a display and becomes an input.
 *
 * **A missing check is NEVER a licence to pre-fill. D8 added an explanation, never a seed.**
 *
 * An unrecognized token is unreachable from a conformant server (the wire enum is closed). It is
 * treated as not-seeded with no reason, following the discipline this module already applies three
 * times (`capSurface`, `figureClause`, `cardGroundingLine`): unknown renders nothing, never a guess.
 */
export function prefillGate(f: GroundingField | null | undefined): {
  seed: boolean;
  reason: string | null;
} {
  if (f == null) return { seed: false, reason: PREFILL_WITHHELD.block_absent }; // D8 — checked FIRST
  switch (f.state) {
    case 'traced':
      return { seed: true, reason: null };
    case 'untraced':
      return { seed: false, reason: PREFILL_WITHHELD.untraced };
    case 'not_checkable':
      return { seed: false, reason: PREFILL_WITHHELD.not_checkable };
    case 'not_applicable':
    default:
      return { seed: false, reason: null };
  }
}

/** The shipped `CAP_COULD_NOT_CHECK` literal plus the refusal reason. Absent/unrecognized ⇒ the shipped
 *  literal ALONE, never a guess. Nothing renders off `cap_not_derivable_reason`. */
export function capRefusalLine(
  verdict: CapVerdict | null | undefined,
  refusal: RiskRefusal | null | undefined,
): string {
  if (verdict !== 'not_checkable') return CAP_COULD_NOT_CHECK;
  return (refusal && CAP_REFUSAL_SENTENCE[refusal]) || CAP_COULD_NOT_CHECK;
}

// ---- F12 — the type register carries authorship (DESIGN_SYSTEM Amendment 2026-08-13, D3) --------

/**
 * AC-9 — the register is set by GROUNDING STATE (Convexa-computed vs model-asserted), never by which
 * field it is, and it NEVER carries the state on its own: the value's clause (`figureClause`) is
 * always in visible text too, so the distinction survives a screen reader, a monochrome screenshot
 * and a coarse pointer. The two are complementary, not alternatives (D3).
 *
 * The Amendment's rule, restated as an EXHAUSTIVE, no-wildcard switch (the house discipline this
 * whole feature holds everywhere else): mono means **this figure is Convexa's** — `traced` (a value
 * we computed, or a model-asserted value that traces to one). Every other state is **a figure the app
 * asserts but could not trace** and renders in the body register:
 *   - `untraced`      — checked, and it matches nothing Convexa computed.
 *   - `not_checkable` — a value exists; there was nothing to check it against. **Still not traced** —
 *     "we do not know" is not "we know it traces". Named as its OWN arm, never folded into `untraced`
 *     nor left to a wildcard that would silently inherit `traced`'s mono register.
 *   - `not_applicable` — the field carries no value; this arm never actually renders (a `Field` in
 *     the `value` member never co-occurs with `not_applicable`), so its body-register return is
 *     vacuous — named explicitly rather than omitted, so a future caller cannot read a missing arm as
 *     "falls through to mono".
 *
 * `null`/`undefined` (no grounding data reached this value at all) get the same body-register
 * treatment as "asserted but could not trace" — the safe default: an unproven figure is never
 * defaulted into Convexa's mono register.
 */
export function registerSx(state: GroundingState | null | undefined): { fontFamily: string } {
  switch (state) {
    case 'traced':
      return { fontFamily: typographyTokens.monoFontFamily };
    case 'untraced':
      return { fontFamily: typographyTokens.fontFamily };
    case 'not_checkable':
      return { fontFamily: typographyTokens.fontFamily };
    case 'not_applicable':
      return { fontFamily: typographyTokens.fontFamily };
    default:
      return { fontFamily: typographyTokens.fontFamily };
  }
}
