/**
 * outcome-ledger — EVERY user-facing string + every closed label lookup (the `_kit/copy.ts` idiom,
 * reimplemented locally: `features/` may not import `pages/`). Strings are verbatim from
 * UX_BLUEPRINT §5/§6.
 *
 * The one rule that shapes this file (UX §2.4 / AC-8 / AC-9): **the counted read is ONE STRING.**
 * `trCountedRead` emits the rate together with its range, its N, its mean per-trade return and its
 * dispersion — from ONE builder, rendered in ONE <Typography>. There is no code path that emits any
 * PART of it, so there is no `&&` anyone could add that would render a rate alone. A hit rate is
 * trivially gamed by many small wins and few large losses; a hit-rate-only read is a defect.
 *
 * Formatting locked by UX §5: rate + interval = integer percent · mean = one decimal, ALWAYS signed,
 * with a real minus (U+2212) · dispersion = integer points · dates = one shared formatter.
 * The strings `$` and `expectancy` appear NOWHERE in this file, by rule (AC-10 / AC-16).
 */
import type { Cohort, ExclusionReason, FamilyKey, Interval } from './types';

// ---- Header + frame (§5.1) ----------------------------------------------------------------------

export const TR_TITLE = 'Track record';
export const TR_SUBTITLE = 'How your own recorded simulated decisions actually closed.';
export const TR_BADGE = 'SIMULATED';

export const TR_ADVISORY =
  'Advisory context from your own recorded sim decisions. Not a guarantee, not a forecast, and not ' +
  'an input to the opportunity score.';

/** All six AC-4 sim facts: slippage · partial fills · queue position · assignment · commissions/fees
 *  · instant unlimited limit fills. BODY TEXT — not a footnote, not a tooltip, not a "learn more". */
export const TR_SIM_DISCLOSURE =
  'Simulated fills. The sim has no slippage, no partial fills, no queue position, no assignment and ' +
  'no commissions or fees, and a limit order fills instantly at any size on a live cross. Sim P&L ' +
  'is not what a broker would have given you.';

export const TR_STORAGE =
  'Stored in this browser only — not tied to your account. Export an archive to back it up.';

// "How to read this" — a VISIBLE block, never an accordion.
export const TR_HIT_DEF =
  'A hit is a closed sim position that realized more than zero. A zero result is not a hit — it ' +
  'stays in the denominator. Closing by rolling is closing: a position you closed by rolling ' +
  'counts like any other close, hit or miss.';

export const TR_RANGE_DEF =
  '“Plausibly X–Y%” is the 95% Wilson confidence interval around the rate — the band ' +
  "the true rate is most likely in, given how few trades it's built on. The narrower it gets, the " +
  'more the rate means.';

export const TR_RETURN_DEF =
  '“Avg per trade” is the plain average of each trade’s percent return — every trade ' +
  'counts once, regardless of size. It is not dollar expectancy, and it does not tell you what you ' +
  'made.';

export const TR_BASIS_DEF =
  '“Quoted fills only” means both ends of the trade were priced off a real market quote ' +
  '(or a live cross). Trades where a price was typed in, modeled between quotes, or read from a ' +
  'stale quote are not counted in any rate — they’re listed under “What wasn’t ' +
  'counted”.';

export const TR_OVERLAP =
  'One closed trade appears in every cell it qualifies for — its tier and its setups and its ' +
  'persona. Cell counts overlap, so they are never added up.';

/** Rendered iff NO cell anywhere in the readout is `computed` (covers empty, day one, and a partial
 *  that reached no floor). */
export const trLeadExplainer = (nMin: number): string =>
  `Once a cell reaches ${nMin} closed trades, it'll show how that cut of your decisions actually ` +
  `turned out — hit rate, its range, and your average return per trade. Nothing here shows a rate ` +
  `until then.`;

/** The LAST line of the frame, immediately above the families — read against the cells. */
export const TR_MULTIPLICITY =
  'Across this many cells and this few trades, some cell will look extreme by chance. Read the ' +
  'range, not the headline.';

// ---- Empty (§5.2) vs Unreadable (§5.3) — different facts, different copy -------------------------

export const TR_EMPTY_TITLE = 'Nothing has closed yet.';
export const trEmptyBody = (nMin: number): string =>
  `When your simulated positions start closing, this is where you'll see how they actually turned ` +
  `out — hit rate and average return by tier, AI rec, setup, IV-rank band and persona, each with ` +
  `its sample count and its range. A cell needs ${nMin} closed trades before it will show a rate.`;

/** ⚠ This state exists because telling a user with 400 trades "Nothing has closed yet" is a lie. */
export const TR_UNREADABLE_TITLE = 'We couldn’t read your stored history.';
export const TR_UNREADABLE_BODY =
  'None of your trade records could be read this time, so there’s nothing to count. Your ' +
  'stored data has not been changed or deleted — reload to try again. If you have an archive file ' +
  'you can import it; import only ever adds.';

// ---- Coverage (§5.4) ----------------------------------------------------------------------------

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

export const trCoverage = (counted: number, m: number, open: number, neverFilled: number): string =>
  `Counted ${counted} of ${m} recorded closed ${plural(m, 'position', 'positions')}. ` +
  `${open} still open — not yet counted. ` +
  `${neverFilled} ${plural(neverFilled, 'order', 'orders')} never filled.`;

export const TR_COVERAGE_PARTIAL_BANNER =
  'Partial read — some of your stored history couldn’t be read this time.';

/** ⚠ M is WITHHELD, not caveated: a caveated wrong denominator is still a wrong denominator. The
 *  open / never-filled counts are withheld too — they are read from the same understated indices. */
export const trCoveragePartial = (counted: number): string =>
  `Counted ${counted} outcomes from the records we could read. We can't say how many recorded ` +
  `closed positions you actually have, so we're not showing an “of M” — the number we ` +
  `could reach is not your whole history. Nothing was changed or deleted; reload to try again.`;

/** ⚠ The date is DERIVED FROM THE DATA. A hardcoded ship date here would misdate the user's own
 *  history (an archive import can carry records from a browser whose capture began earlier). */
export const trEpoch = (date: string): string =>
  `We started recording entry context on ${date}. Outcomes recorded before then still count for ` +
  `tier — they have no setup, persona, IV-band or score context.`;

export const TR_EPOCH_NONE =
  'We haven’t recorded entry context on any trade yet. Setup, AI-rec, IV-band and persona ' +
  'cells stay empty until new trades are recorded; tier still counts every outcome.';

// ---- The exclusion breakdown (§5.5) — the ONLY on-demand content --------------------------------

export const TR_BREAKDOWN_SUMMARY = 'What wasn’t counted — and why';

export const trBreakdownG1 = (m: number): string =>
  `Not counted (out of the ${m} recorded closed positions)`;

/**
 * EXHAUSTIVE by construction: `Record<ExclusionReason, string>` — a new reason without a label is a
 * type error, never a silently vanished count. Rows render in this (the precedence) order, so the
 * breakdown reads the way it was decided.
 *
 * ⚠ `no_decision_record` is a LIVE, GROWING, ORDINARY bucket — not a demo-seed curiosity. Its
 * ordinary member is a **rolled-into leg**: every replacement position a roll opens has only a `roll`
 * decision record, never an `open` one, so it lands here the day it closes, from ordinary user
 * activity. Do not treat it as near-always-zero and do not design it as an edge case.
 *
 * ⚠ The demo seed gets NO special case: `testSeed.ts`'s fabricated closed position lands here like
 * any other record with no ENTRY decision — it is ONE MEMBER of this bucket, not its archetype. The
 * words "seed"/"demo"/"test data"/"sample" appear nowhere in this surface, and no code branch
 * mentions it.
 */
export const TR_REASON_LABEL: Record<ExclusionReason, string> = {
  // ⚠ "No ENTRY decision recorded", not "no decision recorded": for a rolled-into leg a roll decision
  // WAS recorded — it simply is not an ENTRY. The old label claimed a total absence and was false for
  // that member. The tail is the WHY, not a consequence: the row is a category, not a defect report —
  // there is no recorded entry decision for this outcome to be evidence ABOUT.
  no_decision_record:
    'No entry decision recorded — it can’t tell us whether entering was a good call',
  unresolved_join: 'Couldn’t link to its decision — not counted',
  scenario_sourced: 'Scripted test scenario — not a real decision',
  // §2.9: the PM's phrasing collided the word "modeled" across two distinct reasons. These two name
  // their actual members instead; no fact dropped, the collision gone.
  unpriced_basis: 'Entry or exit price was typed, theoretical or stale — not a quote',
  modeled_basis: 'Re-priced between quotes — not a quote',
  malformed: 'Unreadable record — not counted',
};

export const TR_BREAKDOWN_NONE = 'Everything recorded was counted.';

/** Makes the identity `M == counted + Σ excluded` USER-CHECKABLE — the whole reason the roll-up
 *  exists. */
export const trBalance = (counted: number, excludedTotal: number, m: number): string =>
  `${counted} counted + ${excludedTotal} not counted = ${m} recorded closed positions.`;

export const TR_BREAKDOWN_G2 = 'Counted beside these, not inside';

/** §2.10 — ONE user-facing concept ("unreadable record"), TWO rows in two clearly-headed groups.
 *  The parenthetical is the same concept plus the plain reason it sits outside the total. The two
 *  counts are NEVER summed: summing across the balance boundary would break the visible identity. */
export const TR_ADJACENT_LABEL = {
  open_not_counted: 'Still open — no result yet',
  never_filled: 'Order never filled — no position, no result',
  unreadable_records: 'Unreadable record — not counted (couldn’t tell if it was closed)',
} as const;

export const trBreakdownG2Note = (m: number): string =>
  `These aren't recorded closed positions, so they're not part of the ${m} above — an open trade ` +
  `has no result yet, an order that never filled never became a position, and an unreadable record ` +
  `can't be checked either way.`;

// ---- The cells (§5.6, §5.7) ---------------------------------------------------------------------

/** ⚠ AC-E3, the 3-for-3 trap: a `building` cell renders THIS STRING AND NOTHING ELSE. No percentage,
 *  no "3 of 3 won", no "100%", no rate, no range, no mean, no window, no bar, no meter, no ✓/✗, no
 *  tint. The type has no rate field — do not compute one. Mirrors the iv-rank widget's floor wording:
 *  one floor concept, one mental model. It reads as counting UP, not as failing. */
export const trBuilding = (n: number, nMin: number): string =>
  `Building history — ${n} of ${nMin} closed ${plural(n, 'trade', 'trades')}. No hit rate yet: ` +
  `fewer than ${nMin} outcomes can't tell luck from edge.`;

/** One decimal, ALWAYS signed, with a real minus sign (U+2212 — the page already uses it). */
const signedPct = (v: number): string => {
  const rounded = Math.abs(v) < 0.05 ? 0 : v; // avoid a signed "−0.0"
  return `${rounded >= 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)}`;
};

/** One shared date formatter. The window is all-time and non-rolling — it will span years, so a
 *  year-less date would be ambiguous (§2.9). */
export const trDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * THE inseparable read — ONE string. Every fact AC-7/8/9 require arrives together or not at all:
 * the rate, its range, its N, its mean per-trade return and its dispersion.
 */
export const trCountedRead = (
  rate: number,
  interval: Interval,
  n: number,
  meanPct: number,
  stdevPct: number,
): string =>
  `${rate}% hit rate — plausibly ${interval.lo}–${interval.hi}% · ${n} closed ` +
  `${plural(n, 'trade', 'trades')} · avg ${signedPct(meanPct)}% per trade, ` +
  `±${Math.round(stdevPct)}pts trade to trade`;

export const TR_STILL_WIDE = 'still wide — not a conclusion yet';

/** The width test lives HERE, once, computed from the EMITTED interval — the UI does no arithmetic.
 *  Strictly `> 20`: exactly 20.0pp carries no qualifier. */
export const trIsStillWide = (interval: Interval): boolean => interval.hi - interval.lo > 20;

/** The basis line — the second half of the mandatory read. It has no conditional parts: `partial
 *  read` rides the already-mandatory basis sibling, so the partiality is inseparable from the number
 *  for free, exactly like the range and the N. */
export const trCountedBasis = (first: string, last: string, sourcesComplete: boolean): string =>
  `${trDate(first)} – ${trDate(last)} · quoted fills only` +
  (sourcesComplete ? '' : ' · partial read');

// ---- Families (§5.8) ----------------------------------------------------------------------------

export const TR_FAMILY_HEADING: Record<FamilyKey, string> = {
  tier: 'Tier',
  ai_rec: 'AI rec',
  setup: 'Setup',
  iv_band: 'IV-rank band',
  persona: 'Persona',
};

const FAMILY_NOUN: Record<FamilyKey, string> = {
  tier: 'tier',
  ai_rec: 'recorded AI rec',
  setup: 'recorded setup',
  iv_band: 'recorded IV-rank band',
  persona: 'recorded persona',
};

const joinClauses = (clauses: string[]): string => {
  if (clauses.length === 0) return '';
  if (clauses.length === 1) return clauses[0];
  return `${clauses.slice(0, -1).join(', ')} and ${clauses[clauses.length - 1]}`;
};

/**
 * The honest answer to "is this cut NEW, or STARVED?" — which a date alone cannot give.
 *
 * ⚠ Generic on purpose. Tier's `pre_capture` is structurally 0, but it must come out of the DATA
 * through this same builder: a hardcoded "tier is always complete" string would hide a real bug the
 * day it isn't. "predate capture" (AC-E13) and "had none available at entry" (AC-E14) are two
 * visibly distinct clauses from two distinct counts — and neither is ever a cell with a rate
 * ("unknown is never a cohort").
 */
export const trFamilyCoverage = (
  family: FamilyKey,
  countedTotal: number,
  attributed: number,
  preCapture: number,
  unavailableAtCapture: number,
  notAttributableByPath?: number,
): string => {
  const clauses: string[] = [];
  if (preCapture > 0) clauses.push(`${preCapture} predate capture`);
  if (unavailableAtCapture > 0) clauses.push(`${unavailableAtCapture} had none available at entry`);
  if (notAttributableByPath != null && notAttributableByPath > 0)
    clauses.push(
      `${notAttributableByPath} came in through a path that can't carry the rec identity`,
    );
  const shortfalls = clauses.length > 0 ? ` — ${joinClauses(clauses)}` : '';
  return (
    `Of your ${countedTotal} counted ${plural(countedTotal, 'outcome', 'outcomes')}, ` +
    `${attributed} carry a ${FAMILY_NOUN[family]}${shortfalls}.`
  );
};

/** Rendered IFF `not_attributable_by_path > 0` — it self-cancels off the count. One data-driven
 *  rule satisfies AC-E18 in BOTH directions: no build flag, no hand-toggle. */
export const TR_AIREC_PATH_NOTE =
  'Recs you took as a simulated order are attributed here. Recs you accepted straight into an entry ' +
  'aren’t — that path doesn’t carry the rec’s identity yet, so those outcomes are ' +
  'counted in your totals but not in any AI-rec cell.';

export const trFamilyEmpty = (family: FamilyKey): string =>
  `Nothing recorded yet for this cut. Cells appear as trades close with a ${FAMILY_NOUN[family]}.`;

// ---- Closed label lookups (§2.6) — `[digested-labels-not-raw-dump]` ------------------------------

/** The AI-rec family has exactly ONE cell: the captured rec identity is a per-rec FINGERPRINT, so
 *  fanning cells out by it would give N cells of N=1, permanently building, permanently useless.
 *  ⚠ There is deliberately NO "not from a rec" comparison cell — those outcomes have MISSING
 *  context, not a contrary context, and unknown is never a cohort. They are reported in the family's
 *  coverage line, which is where they belong. */
export const AI_REC_CELL_KEY = 'taken_from_ai_rec';
export const AI_REC_CELL_LABEL = 'Taken from an AI rec';

/**
 * The IV-rank band lookup, defined LOCALLY (an `outcomes → pages/ticker/widgets/_kit` import would
 * be an upward `features → pages` import — see the fence in UX §2.2). The wording is deliberately
 * IDENTICAL to the ticker's, so the future promotion to `shared/` is a delete, not a merge.
 * ⚠ NEVER derive the band from an IV rank scalar.
 */
export const IV_BAND_LABEL: Record<string, string> = {
  premium_rich: 'Premium rich',
  neutral: 'Neutral',
  premium_cheap: 'Premium cheap',
};
/** The scale: cheap → neutral → rich. Fixed; never data-dependent. */
export const IV_BAND_ORDER = ['premium_cheap', 'neutral', 'premium_rich'] as const;

/** A closed lookup for the setups this app names today. ⚠ An UNRECOGNIZED setup renders its
 *  recorded token VERBATIM, untransformed (fail-honest — never guess, never title-case a token into
 *  a claim). */
export const SETUP_LABEL: Record<string, string> = {
  pin_confluence: 'Pin confluence',
  gamma_squeeze: 'Gamma squeeze',
  wall_rejection: 'Wall rejection',
  flip_breakout: 'Flip breakout',
  vol_crush: 'Vol crush',
  vol_expansion: 'Vol expansion',
};
export const setupLabel = (name: string): string =>
  Object.prototype.hasOwnProperty.call(SETUP_LABEL, name) ? SETUP_LABEL[name] : name;

/** Never render a raw persona id. Two deleted custom personas render as two cells both labelled
 *  this — honest and rare; showing an internal id would be worse, and merging them would sum two
 *  cells' Ns (AC-16). */
export const PERSONA_UNKNOWN_LABEL = 'Persona no longer saved';

// ---- The archive (§5.9) -------------------------------------------------------------------------

/** The families row's label on the Positions page, where it stands apart from the readout's head
 *  (owner, NO-6 A, 2026-10-25: the head beside the orders panel, the families full width below). */
export const TR_FAMILIES_LABEL = 'Track record by family';

export const TR_ARCHIVE_HEADING = 'Archive';
export const TR_ARCHIVE_LEAD =
  'Your trading history lives in this browser only. There’s no server backup — if you clear ' +
  'this browser’s data, it’s gone. An archive is one file with all of it: every ' +
  'position, every order, every decision.';

export const TR_EXPORT_LABEL = 'Export archive';
export const TR_IMPORT_LABEL = 'Import archive';

export const trExportOk = (filename: string): string =>
  `Archive exported — ${filename}. This is your complete backup: every position, order and ` +
  `decision stored in this browser.`;
export const trExportEmpty = (filename: string): string =>
  `Archive exported — ${filename}. It's empty: there's no history stored in this browser yet. ` +
  `That's still a valid archive.`;

export const TR_IMPORT_CONFIRM_TITLE = 'Import archive?';
/** States, BEFORE any write, exactly what import does — and the whole of what it does. */
export const TR_IMPORT_CONFIRM_BODY =
  'Importing only adds. It never deletes, never overwrites and never replaces anything you already ' +
  'have. If a record in the file is already here, it’s skipped. If it collides with a ' +
  'different record, your existing record wins. Importing the same file twice changes nothing.';
export const trImportConfirmFile = (filename: string): string => `File: ${filename}`;
/** The confirm's callout (the Final board's `final-overlays-archive`, fidelity SITE-15): the one
 *  thing the body does not say, that pressing Import is the only step that reads the file in. */
export const TR_IMPORT_CONFIRM_NOTE =
  'Nothing is read into your history until you press Import. Your history lives in this browser ' +
  'only; the archive is its one backup.';
export const TR_IMPORT_CANCEL = 'Cancel';
export const TR_IMPORT_CONFIRM = 'Import';
/** The import dialog's close button: its accessible name (the board's head close, `.v4dlg .dh`). */
export const TR_DIALOG_CLOSE = 'Close';

export const TR_IMPORT_DONE_TITLE = 'Import complete';
export const trImportAdded = (n: number): string => `${n} ${plural(n, 'record', 'records')} added.`;
export const trImportSkipped = (n: number): string => `${n} already here — skipped.`;
export const trImportConflict = (n: number): string =>
  `${n} collided with a different record — your existing record was kept.`;
export const TR_IMPORT_FOOTER = 'Nothing was deleted or overwritten.';
export const TR_IMPORT_DONE = 'Done';

/**
 * The decline set is CLOSED, in TWO CLASSES (§5.9.1) — never a raw parser message, never a stack
 * trace. Two classes is not an open door: a new reason in either class needs a UX ruling.
 *
 *  - **Class A — the FILE is the problem.** "We looked at what you handed us and can't use it."
 *  - **Class B — YOUR STORED HISTORY is the problem, and we will not touch it.** "Your file is fine.
 *    We stopped because writing into a history we can't fully read could destroy records."
 */

// ---- Class A — the file is the problem. A `{reason}` fragment through the shared template. -------

export const TR_IMPORT_DECLINED_TITLE = 'Import declined';
export const trImportDeclinedBody = (reason: string): string =>
  `${reason} Nothing was imported. Your existing data was not changed.`;

export const TR_DECLINE_UNREADABLE = 'This file couldn’t be read.';
export const TR_DECLINE_NOT_OURS = 'This isn’t a Convexa archive file.';
export const TR_DECLINE_VERSION =
  'This archive was written by a version this app doesn’t understand.';

// ---- Class B — your stored history is the problem, and we will not touch it. ---------------------

/**
 * ⚠ SELF-CONTAINED: class B does NOT pass a `{reason}` through `trImportDeclinedBody`. That template
 * ends "Your existing data was not changed." — a reassurance beside the point in class A, where the
 * point was the file, but INVERTED here: **not touching your data IS the entire event**. Passing a
 * class-B reason through class A's sentence would rank the protection as a footnote to a failure.
 *
 * Every clause is load-bearing. The TITLE kills the only inference the user can otherwise draw ("my
 * file is bad") before they read a word of the body — the other three decline reasons are all about
 * the file, and the dialog is the same dialog. "we won't write over records we can't read" is the
 * protection, stated as a choice we made. "we stopped before touching anything" is what
 * `[loss-free-durable-migration]` guarantees. The triple negative names BOTH artifacts, because the
 * user has two things to worry about. "this time" + "Reload and try the same file again" is the same
 * transient framing §5.3/§5.4 give the same underlying fact, so a user who sees both surfaces sees
 * one story; the closing clause reuses `TR_IMPORT_CONFIRM_BODY`'s idempotency fact, so the retry is
 * known-safe rather than hoped-safe.
 *
 * ⚠ ONE string covers BOTH the partial store and the fully-unreadable store — "we couldn't read ALL
 * of your stored history" is true in both, and the app's answer is identical. Do NOT fork it.
 * ⚠ No Retry, no "Import anyway", no Repair, no Force, no "Clear and import": the refusal IS the
 * feature. No blame, no apology, no `severity="error"` — it is a normal, correct outcome of a safety
 * rule. The remedy is a reload, and the body says so.
 */
export const TR_IMPORT_DECLINED_STORE_TITLE = 'Import declined — your file is fine';
export const TR_IMPORT_DECLINED_STORE_BODY =
  'We couldn’t read all of your stored history this time. Importing adds to that history, and we ' +
  'won’t write over records we can’t read — so we stopped before touching anything. Nothing was ' +
  'imported, nothing was changed, nothing was deleted: your history and your file are exactly as ' +
  'they were. Reload and try the same file again — importing the same file twice changes nothing.';

// ---- Tooltips (§6) — a tooltip EXPLAINS; it never INFORMS ---------------------------------------
// No tooltip below carries a number, a rate, a count, or any fact an AC requires. Every one of them
// is removable without losing a fact.

export const TR_TIP_COVERAGE =
  'Your decisions are recorded in two places — the Ticker page and the Positions page. This read ' +
  'merges both and drops records that appear in both, so a trade is counted once. These counts are ' +
  'a read of your stored records, with the same caveats as the rates below.';

export const TR_TIP_EPOCH =
  'Before this date we recorded which tier you traded, but not the setups, persona, IV band or ' +
  'score behind it — so those cells can’t count older trades. We never guess a value we ' +
  'didn’t observe, and we never rewrite an old record.';

export const TR_TIP_FAMILY: Record<FamilyKey, string> = {
  tier:
    'The opportunity tier the app showed when you entered. Recorded on every trade, including ' +
    'trades from before entry-context capture started.',
  ai_rec: 'Outcomes you entered from an in-app AI recommendation.',
  setup:
    'The setups the app said were firing when you entered. A trade appears under every setup that ' +
    'fired for it, so these counts overlap.',
  iv_band:
    'Where the ticker’s implied volatility sat in its own recent range when you entered — ' +
    'premium rich, neutral, or premium cheap.',
  persona: 'The trader persona that was active when you entered.',
};

// ---- Cell rendering helper ----------------------------------------------------------------------

/** The two mandatory lines of a counted cell + the conditional qualifier, from ONE place. A
 *  `building` cohort yields ONE line and nothing numeric beside it. */
export function cellLines(
  cohort: Cohort,
  sourcesComplete: boolean,
): { read: string; qualifier: string | null; basis: string | null } {
  if (cohort.state === 'building') {
    return { read: trBuilding(cohort.n, cohort.n_min), qualifier: null, basis: null };
  }
  return {
    read: trCountedRead(
      cohort.hit_rate,
      cohort.interval,
      cohort.n,
      cohort.mean_pl_pct,
      cohort.stdev_pl_pct,
    ),
    qualifier: trIsStillWide(cohort.interval) ? TR_STILL_WIDE : null,
    basis: trCountedBasis(cohort.window.first, cohort.window.last, sourcesComplete),
  };
}
