/**
 * AI-recommendation microcopy — the SINGLE source of user-facing strings, verbatim from
 * UX_BLUEPRINT §7 (microcopy index) + §3/§4/§5. Do not improvise copy here; the binding framing
 * (advisory-behind-Accept, risk-first, no_trade-first-class, honest as-of/stale, egress honesty) is
 * carried entirely by these strings.
 */

export const COPY = {
  // Advisory intro under the card title (Figma `AI Recommendation`, node 149:621).
  intro:
    'Risk-first read on the current snapshot, framed by your persona. Advisory — you confirm every paper trade.',
  action: {
    get: 'Analyze current snapshot',
    askAnyway: 'Ask anyway',
    retry: 'Retry',
    accept: 'Review simulated trade',
    analyze: 'Analyze current snapshot',
    reviewTrade: 'Review simulated trade',
    createOrder: 'Create sim order',
    analysis: 'Full analysis & data',
    requestExport: 'What’s sent to the AI',
    refresh: 'Refresh analysis',
    viewExport: "View what's sent",
    freshRec: 'Refresh analysis',
    dismiss: 'Dismiss',
  },
  loading: {
    title: 'Thinking…',
  },
  risk: {
    maxRisk: 'Max risk',
    invalidation: 'Invalidation',
  },
  noTrade: {
    title: 'No trade — sit this one out',
    caption: "No simulated entry — a 'no trade' read is a complete, correct answer.",
  },
  // Structured-reasoning section labels (the redesigned read: scannable verdict + why + re-engage,
  // full prose behind a toggle). Sentence-case, verbatim.
  reasoning: {
    keyPoints: 'Why',
    reengage: 'Re-engage when',
    manage: 'Manage the trade',
    levels: 'Levels in play',
    fullRead: 'Analyst read',
    rationale: 'Rationale',
    showMore: 'Full analysis & data',
    showLess: 'Show less',
  },
  unavailable: {
    title: 'AI unavailable — try again',
    body: "Couldn't get a read right now. This didn't affect the rest of the dashboard.",
  },
  noKey: {
    chip: 'In-app AI not configured',
    caption:
      "The in-app AI read isn't available on this deployment. The manual copy-paste hand-off and " +
      'the structured export below still work.',
  },
  noEdge: {
    title: 'No fresh edge right now',
    caption:
      "The guardrails don't see a fresh, actionable edge. You can still ask if you want a read — " +
      'it counts against your cooldown and daily limit.',
  },
  stale: {
    chip: 'Stale · based on older data',
  },
  provenance: {
    sim: 'SIMULATED / advisory',
  },
  export: {
    egress:
      'This is the complete, reviewable list of what leaves the machine for {TICKER}, on demand: the ' +
      "computed snapshot, your persona's prompt, and the field glossary. No other ticker, no account " +
      'or identity, no broker/order data, and no API key ever leave.',
    copyAll: 'Copy all',
    copied: 'Export copied.',
  },
  accept: {
    sizing: 'Suggested size from the AI read — change it to fit your risk. Sizing is your call.',
  },
  tooltip: {
    advisory:
      'A read, not an order. Nothing is saved until you review and confirm a simulated trade.',
    get:
      'Ask the AI for a risk-first entry read on {TICKER}, framed by your active persona and the ' +
      "current snapshot. Advisory only — you'll review and explicitly confirm before anything is saved.",
    askAnyway: 'Override the quiet gate and request a read anyway. Still rate-limited.',
    persona:
      'This read was produced by the {name} persona. A different persona may read the same snapshot ' +
      'differently.',
    asOf:
      "Pinned to the snapshot it was generated from. It won't refresh itself — request a fresh read " +
      'when you want one.',
  },
} as const;

// ---- ai-providers powering copy (SPEC §4). Closed reasons stay distinct. Never free / pool /
// cheaper / included. Subscription label ≠ BYO "Grok".
export const POWERING = {
  noKey: {
    title: 'Add an API key to power recommendations',
    body:
      'Add an API key for Anthropic, OpenAI, Gemini, or Grok to power recommendations. Your key, your cost. ' +
      'The manual export below always works without a key.',
    cta: 'Open AI providers in Settings',
  },
  keyUnusable: {
    title: "Your saved key can't be used",
    body: "Your saved key can't be used. Replace it in Settings.",
    cta: 'Replace key in Settings',
  },
  keyRejected: {
    title: 'The provider rejected your key',
    body: 'The provider rejected your key. Replace it in Settings.',
    cta: 'Replace key in Settings',
  },
  modelMissing: {
    title: 'Choose another model',
    body: "The selected model isn't in the current catalog. Choose another model before asking.",
    cta: 'Choose a model',
  },
  modelUnset: {
    title: 'Choose a model',
    body: 'Choose a model from the catalog before asking.',
    cta: 'Choose a model',
  },
  oauthExpired: {
    title: 'Your Grok connection expired',
    body: 'Your Grok connection expired. Reconnect to use your subscription, or use your own key.',
    cta: 'Open AI providers in Settings',
  },
  oauthUnlinked: {
    title: 'Connect Grok or add your key',
    body: 'Connect Grok to use your Grok subscription, or use your own API key.',
    cta: 'Open AI providers in Settings',
  },
  subscriptionUnavailable: {
    title: "Your Grok subscription isn't available",
    body: "Your Grok subscription isn't available for Ask-AI right now. You can still add your own API key below.",
    cta: 'Open AI providers in Settings',
  },
  ownKey: {
    tooltip: 'This recommendation ran on your own API key — your cost. Manage keys in Settings.',
  },
  subscription: {
    tooltip:
      'This recommendation ran on your Grok subscription. Manage the connection in Settings.',
  },
} as const;

/** @deprecated Use POWERING.noKey — kept so existing heading-scan imports resolve. */
export const BYO_KEY = {
  noKey: POWERING.noKey,
  ownKey: { chip: 'Using your key', tooltip: POWERING.ownKey.tooltip },
} as const;

/** Own-key honesty chip (generic floor). Prefer `ownKeyChip(provider)` when provider is named. */
export const OWN_KEY_CHIP = BYO_KEY.ownKey.chip;

/** `Persona · {name}` provenance chip. */
export const personaChip = (name: string) => `Persona · ${name}`;
/** `As of {snapshot}` provenance chip. The pinned snapshot identity is shown verbatim (honest). */
export const asOfChip = (asOf: string | null) => `As of ${asOf ?? 'unknown snapshot'}`;
/** `Cooling down · {remaining}s` disabled-action label. */
export const cooldownLabel = (remaining: number) => `Cooling down · ${remaining}s`;
/** `Daily AI limit reached — resets {when}` calm cap state. */
export const capTitle = (when: string) => `Daily AI limit reached — resets ${when}`;
export const CAP_CAPTION =
  "You've used today's AI recommendations. The manual export below still works and costs nothing.";
/** Cooldown caption (the data refreshes about every 60s). */
export const cooldownCaption = (remaining: number) =>
  'A fresh entry read rarely changes inside a minute, and the data refreshes about every 60 seconds. ' +
  `Available again in ${remaining}s.`;
/** Stale strip — a newer snapshot has arrived; the read is from {as_of}. */
export const staleStrip = (asOf: string | null) =>
  `A newer snapshot has arrived. This read is from ${asOf ?? 'an earlier snapshot'}. ` +
  'Refresh analysis when you’re ready.';
/** Stale-born strip — generated off an already-stale bundle ({data_age}). */
export const staleBornStrip = (dataAge: string) =>
  `This read was generated from a snapshot already marked stale (${dataAge}). ` +
  'Treat the levels with caution.';
export const EXPORT_HEADER = (ticker: string) => `What's sent to the AI · ${ticker}`;
/** Retry-under-gate sub-captions (E6). */
export const retryInCooldown = (remaining: number) => `Retry available in ${remaining}s`;
export const retryWhenReset = (when: string) =>
  `Retry available when the daily limit resets ${when}`;

// ---- tradeable-rec-inputs (SPEC §4; verbatim) --------------------------------------------------
// The four-field closed literal set, the cap annotation, the cited-contract line, the provenance
// chip, and the `What the numbers said` strip. Every string here is rendered by CLOSED LOOKUP on a
// wire token — never re-derived from a null or a scalar (`literals.ts` is the lookup; this module is
// only the vocabulary).

/** `not set` is the SINGLE literal for the owner-supplied-nothing state on every surface. Distinct
 *  from `size not suggested` (the risk block IS present; the model returned no size). */
export const NOT_SET = 'not set';
export const SIZE_NOT_SUGGESTED = 'size not suggested';

export const RISK_FIELD_COPY = {
  dash: { text: '—', tip: 'No entry, so there is nothing to size.' },
  notSet: {
    text: NOT_SET,
    tip: "Convexa didn't send a risk figure, so the AI had nothing to size against.",
    action: 'Set your risk inputs',
  },
  unavailable: {
    text: 'unavailable',
    tip: 'An input this needed was missing this cycle. Your other reads are unaffected.',
  },
  notGiven: {
    text: 'not given',
    tip: "The AI produced a trade read but didn't fill this in. Nothing failed — it declined to answer.",
  },
  sizeNotSuggested: { text: SIZE_NOT_SUGGESTED },
} as const;

export const PROVENANCE_CHIP_TIP =
  "The AI was given these figures. This number is the AI's, not Convexa's arithmetic — check it " +
  'against your own before you act.';
export const provenanceChip = (accountSize: number, capText: string) =>
  `Sized against your inputs · Account $${accountSize.toLocaleString()} · ${capText}`;

export const CAP_COULD_NOT_CHECK = "Couldn't check against your cap.";
export const MAX_RISK_TIP = "This is the AI's figure — Convexa did not compute it.";

export const SUPERSEDED_STRIP =
  'Your risk inputs changed after this read. The sizing below is based on the earlier values.';
export const SUPERSEDED_STRIP_DRAWER =
  'Your risk inputs changed after this read. The values below are the ones sent.';

export const UNDETERMINED_RIGHT_BOTH_LEGS = "The read doesn't say call or put — both legs shown.";
export const UNDETERMINED_RIGHT_NO_QUOTE = "The read doesn't say call or put — no quote shown.";
export const UNDETERMINED_RIGHT_TIP =
  'Convexa only draws a quote when it can match the exact contract — strike, expiration and call/put.';
export const OFF_SET_LITERAL = 'Not in the candidate set Convexa sent';
export const NO_TWO_SIDED_QUOTE_LITERAL = 'no two-sided quote in this snapshot';

export const DRAWER_RISK_AS_SENT = 'Your risk inputs (as sent with this recommendation)';
export const DRAWER_RISK_AS_NEXT = 'Your risk inputs (what the next request will send)';
export const DRAWER_NOT_SENT = "Not sent — you haven't set this.";
export const NONE_OMITTED = 'none omitted';

export const NUMBERS_SAID_EMPTY = 'No candidates in band this cycle.';
export const NUMBERS_SAID_UNAVAILABLE = 'Candidate set unavailable this cycle.';

/** The amended export egress note (server-composed; this fallback asserts the same thing — AC-90). */
export const EXPORT_EGRESS_FALLBACK = (ticker: string) =>
  `This is the complete, reviewable list of what leaves the machine for ${ticker}, on demand: the ` +
  'computed snapshot, the candidate contracts, your risk inputs, your open simulated positions, ' +
  "your persona's prompt, and the field glossary. No other ticker, no name, email or login, no " +
  'broker credentials, and no API key ever leave. Nothing is ever placed as an order.';

/** Friendly local time for a cap `resets_at` ISO instant; falls back to the raw value. */
export function friendlyResetTime(iso: string | null | undefined): string {
  if (!iso) return 'soon';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// ---- ai-rec-grounding (SPEC §4; verbatim) ------------------------------------------------------
// Every string below is produced by a CLOSED LOOKUP on a wire token in `literals.ts`, never by testing
// a null and never by comparing two figures in the browser.

/** Card level — exactly one, on a produced trade verdict only. */
export const GROUNDING_CARD = {
  all_traced: 'Every checked figure traces to a Convexa number.',
  none_traced: 'No figure here traces to a Convexa number.',
  could_not_check: "Convexa couldn't check these figures this cycle.",
  local_rules: "No AI read here — these figures come from Convexa's own rules.",
  not_applicable: 'No figures were provided for checking in this read.',
} as const;

/** `some_traced` interpolates the SERVER's integers — the browser never counts. */
export const someTracedLine = (traced: number, checked: number) =>
  `${traced} of ${checked} checked figures trace to a Convexa number — each exception says so below.`;

/** The ONE client-selected branch: `grounding` absent. Distinct from `could_not_check` — "the check
 *  ran and could not conclude" vs "no check reached the browser". Never synonyms. */
export const GROUNDING_BLOCK_ABSENT = "This read wasn't checked against Convexa's numbers.";

/** Per figure — on the exit stop, the exit target and the invalidation level only. */
export const tracesToLine = (anchor: string, value: number) =>
  `traces to Convexa's ${anchor} (${value})`;
export const nearLine = (anchor: string, value: number) => `near Convexa's ${anchor} (${value})`;
export const insideRangeLine = (expiration: string, low: number, high: number) =>
  `inside Convexa's implied move for ${expiration} (${low}–${high})`;
export const UNTRACED_LINE = "the AI's own number";
export const UNTRACED_TIP =
  'Convexa compared this against the levels and quotes it computed and didn’t find it. That doesn’t ' +
  'make it wrong — it means Convexa can’t vouch for it.';
export const COULD_NOT_CHECK_LINE = "couldn't check this";
export const couldNotCheckTip = (clause: string) =>
  `${clause}. The figure above is the AI's, unchanged.`;

/**
 * The withheld-prefill literals (SPEC §4 "The simulated entry dialog"; GATE Z Z1 + D8 / AC-68).
 * THREE members of the SAME closed set, each echoing the card's own words so the reader connects the
 * two surfaces. The third exists because reusing `not_checkable` for a response that carried NO block
 * would be the `absent-is-not-none` collapse the card's `couldn't check` vs `wasn't checked` split
 * exists to prevent — and the dialog is the worst place in the feature to blur them.
 *
 * Rendered VERBATIM by the shared dialog from the prefill input — the same seam `provenance` and
 * `sizingNote` already use (`TradeEntryDialogView.tsx`), so the dialog imports nothing from `pages/`
 * (dependency direction is downward only).
 */
export const PREFILL_WITHHELD = {
  untraced: "Not pre-filled — this was the AI's own number.",
  not_checkable: "Not pre-filled — Convexa couldn't check this figure.",
  block_absent: "Not pre-filled — this read wasn't checked against Convexa's numbers.",
} as const;

/** The total label lookup over the closed anchor token. Five reuse the words `Levels in play` already
 *  prints; the fallback is honest and still carries the number. */
export const ANCHOR_LABEL = {
  gex_spot: 'levels spot', // NOT `spot` — the levels anchor is not the live display price
  call_wall: 'call wall',
  put_wall: 'put wall',
  peak_gex_strike: 'peak gamma strike',
  gamma_flip: 'gamma flip',
  max_pain: 'max pain',
  vwap: 'VWAP',
  vwap_upper_2: 'VWAP +2σ',
  vwap_upper_3: 'VWAP +3σ',
  vwap_lower_2: 'VWAP −2σ',
  vwap_lower_3: 'VWAP −3σ',
} as const;
export const ANCHOR_LABEL_FALLBACK = 'a Convexa level';

/** Missing-input clauses — three members are emittable in v1; the lookup carries NO arm for a state the
 *  server cannot produce (`structurally_unchecked` renders nothing at all). */
export const MISSING_INPUT_CLAUSE = {
  no_named_level: 'Convexa had no named levels for this snapshot',
  straddle_move_unavailable: 'Convexa had no implied move for that expiration',
  no_cited_expiration: "The read didn't name an expiration to measure against",
} as const;

/** The definition tooltip — on the card-level line, once. `{tolerance}` comes off the payload; if the
 *  constant is absent the parenthesis is omitted entirely and nothing is hardcoded. */
export const groundingDefinitionTip = (tolerance: number | null) =>
  'Traced means the figure lines up with a number Convexa computed from the option chain — not a ' +
  'judgement that the trade is good. Convexa checks the stop, the target and the invalidation level. ' +
  "It doesn't check the suggested size; the contract named and your risk cap each have their own " +
  'line. Near means the figure sits inside Convexa’s match window for that level' +
  (tolerance == null ? '' : ` (${tolerance}% of the level, never less than a cent)`) +
  '. The implied-move range is measured from the snapshot’s spot at that expiration.';

/** The cap surface — the shipped literal plus the refusal reason. Absent/unrecognized ⇒ the shipped
 *  literal ALONE, never a guess. */
export const CAP_REFUSAL_SENTENCE = {
  no_text: `${CAP_COULD_NOT_CHECK} The read gave no risk figure.`,
  no_dollar_figure: `${CAP_COULD_NOT_CHECK} Convexa couldn't read a dollar amount in the risk figure.`,
  multiple_different_figures: `${CAP_COULD_NOT_CHECK} The read named more than one dollar amount.`,
} as const;

/**
 * AC-33 (GATE Z Z-F1) — one statement, placed WITH the reasoning (never with the fields), saying
 * numbers written out in the AI's free prose are not checked. Without it a reader has no reason to
 * NOT generalize the per-field clauses to the prose, which would imply coverage this feature does not
 * have (SPEC §9 item 5's halo residual). Caption idiom, no banned word, not an accusation, and
 * DISJOINT from every other closed-set literal — deliberately not reusing `GROUNDING_BLOCK_ABSENT`'s
 * "wasn't checked" phrasing, since that names a missing SERVER check and this names a permanent,
 * by-design scope boundary (SPEC §1 "No prose-number extraction").
 */
export const REASONING_PROSE_NOT_CHECKED =
  "Numbers written out in this reasoning aren't checked — only the stop, target and invalidation " +
  'level above are.';

/**
 * rec-plan-scope-caption — section-level scope boundary for the six plan fields.
 * Permanent: none of the six enters figure-grounding clauses / counts.checked.
 * Sibling of REASONING_PROSE_NOT_CHECKED; never merged into grounding / absence / not-actionable.
 */
export const PLAN_FIELDS_NOT_CHECKED =
  "Structure, Strike(s), Expiration, Entry trigger, Time horizon and Confidence aren't checked — only the stop, target and invalidation level are.";

// ---- rec-absence-literals-hole: the six plan/conviction slots -----------------------------------

/** The five plan-row labels, hoisted out of `AiRecPanel.tsx`'s inline literals so the renderer, the
 *  standing line and the Layer-2 guard read ONE constant. CARD ORDER — the standing line joins the
 *  first four in this order. */
export const PLAN_FIELD_LABEL = {
  structure: 'Structure',
  strikes: 'Strike(s)',
  expiration: 'Expiration',
  entryTrigger: 'Entry trigger',
  timeHorizon: 'Time horizon',
  confidence: 'Confidence',
} as const;

/** The POSITION-DEFINING four, in card order (AC-10a). Time horizon and Confidence are excluded on
 *  purpose: their absence is not what makes a rec unactionable (AC-11). */
export const POSITION_DEFINING_LABELS = [
  PLAN_FIELD_LABEL.structure,
  PLAN_FIELD_LABEL.strikes,
  PLAN_FIELD_LABEL.expiration,
  PLAN_FIELD_LABEL.entryTrigger,
] as const;

/** The six take the SHIPPED words with a PRODUCER-NEUTRAL tip on their own sibling entry. The shipped
 *  `not_given` tip names a producer ("The AI produced a trade read but…") and would contradict the
 *  local-rules line on the same card; the WORD holds in every state, the shipped TIP does not. */
export const PLAN_FIELD_COPY = {
  notGiven: {
    text: RISK_FIELD_COPY.notGiven.text,
    tip: 'Nothing stated a value for this. Nothing failed; it was simply never filled in.',
  },
  unavailable: {
    text: RISK_FIELD_COPY.unavailable.text,
    tip: RISK_FIELD_COPY.unavailable.tip,
  },
  dash: { text: RISK_FIELD_COPY.dash.text, tip: RISK_FIELD_COPY.dash.tip },
  /** The ONE new member of the closed not-a-number vocabulary (decisions.md §C #21). One emit site. */
  unrecognized: {
    text: 'unrecognized',
    tip:
      "The read named a conviction outside Convexa's scale. Convexa shows low, medium or high only; " +
      "it won't repeat an answer it can't place.",
  },
} as const;

/** The card-level standing statement (AC-10a/c). NOT an absence word — a standing statement — so the
 *  one-new-word rule is not engaged. Producer-neutral; no icon, no tint, plain body text. */
export const notActionableLine = (labels: readonly string[]) =>
  `Not actionable as given. Never named: ${labels.join(', ')}.`;

export const incompleteAction = (labels: readonly string[]) =>
  `${notActionableLine(labels)} Nothing is saved until you review and confirm.`;

/** The DTE caption, reworded: a property of the REQUEST (vouched by the owner's own filter), never a
 *  containment claim about the value. Renders on the `value` member only, and never if either bound is
 *  unknown — a literal `?` must not reach the DOM (AC-26/27). The dash is U+2013 (en dash), matching
 *  the shipped caption; it is NOT the U+2014 the §7 guards target. */
export const dteWindowCaption = (min: number, max: number) => ` · your DTE window: ${min}–${max}`;

/** The entry-surface reason for a contract field the read never named (AC-12a/b/c/d). Follows the
 *  shipped `PREFILL_WITHHELD` idiom, names NO cause, and is built in `prefill.ts` and carried verbatim
 *  — the dialog never re-spells it. */
export const prefillUnnamedReason = (labels: readonly string[]) =>
  `Not pre-filled — the read named no ${labels.join(', ')}.`;

/** ONE mapping from a `PlanFieldLiteral` kind to (text, tip). `confidence` renders as a `Chip`, not a
 *  `Field`, so a second RENDERER is unavoidable — this keeps it from becoming a second COPY TABLE. */
export function literalCopy(
  kind: 'value' | 'dash' | 'not_set' | 'unavailable' | 'not_given' | 'unrecognized',
): { text: string; tip: string } {
  switch (kind) {
    case 'dash':
      return PLAN_FIELD_COPY.dash;
    case 'unavailable':
      return PLAN_FIELD_COPY.unavailable;
    case 'unrecognized':
      return PLAN_FIELD_COPY.unrecognized;
    case 'not_set':
      // Unreachable on the six (AC-23); named explicitly so a future caller cannot read a missing arm
      // as "falls through to not_given".
      return { text: RISK_FIELD_COPY.notSet.text, tip: RISK_FIELD_COPY.notSet.tip };
    case 'value':
    case 'not_given':
    default:
      return PLAN_FIELD_COPY.notGiven;
  }
}
