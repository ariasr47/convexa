/**
 * Sim-orders microcopy — the SINGLE source of user-facing strings, verbatim from the
 * ai-rec-backtest-orders UX_BLUEPRINT §2–§7. Do not improvise copy here: the six D8 disclosures
 * (SIMULATED confirm · already-met · not-evaluated · scripted-scenario marking · stale-rec ·
 * sign-in gate) are BINDING wording; `{braces}` are interpolation slots filled by the helpers.
 */

// ---- §2 — the Act affordance -------------------------------------------------------------------

export const ACT_LABEL = 'Act as sim order';
export const ACT_TOOLTIP =
  'Creates a simulated order encoding this plan — trigger, limit, stop, target — that watches ' +
  'live data and works the entry unattended. No real order, ever.';

/** D8-6 — the sign-in gate on Act (the app's standard gated-write prompt pattern). */
export const GATE_SIGN_IN = 'Sign in to place a simulated order.';

// ---- §3 — the order-creation confirm (order variant of the shared dialog) -----------------------

export const DIALOG_TITLE = 'Simulated order — act on this rec';

/** §3.1-3 provenance line variants. */
export const provenanceAiRead = (persona: string, asOf: string | null) =>
  `From AI read · ${persona} · as of ${asOf ?? 'unknown snapshot'}`;
export const provenanceScenario = (name: string) => `From scripted scenario · ${name}`;

/** §3.1-2 scenario notice strip (dialog variant of D8-4; warning-tinted, never red). */
export const dialogScenarioStrip = (name: string) =>
  `Scripted scenario — this plan came from the "${name}" scenario, not a real AI read.`;

export const TRIGGER_LABEL = 'ENTRY TRIGGER';
export const TRIGGER_SEED_CHIP = 'Derived from the rec';
export const TRIGGER_NO_SEED_HELPER =
  "The rec didn't state a numeric level, so nothing was pre-filled. Set a level, or leave the " +
  'trigger empty — the order then arms immediately as a plain limit / market order.';
export const TRIGGER_EMPTY_HELPER = 'No trigger — arms immediately and works the entry right away.';
export const REC_WORDS_LABEL = "THE REC'S OWN WORDS";
export const REC_NO_TRIGGER_TEXT = '— (the rec stated no entry trigger)';

export const ENTRY_PRICE_LIMIT = 'Limit';
export const ENTRY_PRICE_MARKET = 'Market on trigger';
export const LIMIT_HELPER =
  'After the trigger, rests at your limit and fills only on a live cross at that price. ' +
  'Fill price = the limit.';
export const MARKET_HELPER = 'After the trigger, fills at the first live-resolvable option mark.';

export const STOP_TARGET_HELPER =
  'Carried onto the position as plan data. Exits stay manual — nothing sells automatically.';

export const GOOD_TIL_LABEL = 'GOOD-TIL';
export const GOOD_TIL_HELPER =
  "Every order needs a bound. Defaults to 7 days, capped at the contract's expiration; the order " +
  "expires then if it hasn't filled.";
export const GOOD_TIL_VALIDATION =
  "Set a good-til date after now and no later than the contract's expiration.";

export const CONFIRM_LABEL = 'Place simulated order';

// ---- §3.3 — the six binding disclosures (D8, verbatim) -------------------------------------------

/** D8-1 — the mandatory SIMULATED confirm disclosure (always visible above the confirm). */
export const simulatedDisclosure = (ticker: string) =>
  `Simulated only — no real order is ever placed. Once confirmed, this order can trigger and ` +
  `fill unattended whenever a live stream for ${ticker} is open in this browser. Orders are ` +
  `stored in this browser — not synced to your account.`;

/** D8-2 — condition already met at placement. */
export const alreadyMetNotice = (ticker: string, direction: 'above' | 'below', level: number) =>
  `Condition already met — ${ticker} is already ${direction} ${level} on live data. This order ` +
  `will trigger on the first live update after you place it.`;

/** D8-3 — the honest coverage state (visible text + tooltip). NEVER hidden or suppressed on a
 *  non-terminal uncovered order. */
export const NOT_EVALUATED_TEXT = 'Waiting for live data — not currently evaluated';
export const notEvaluatedTip = (ticker: string) =>
  `No live stream for ${ticker} is open in this tab (or the session is closed), so this order ` +
  `cannot trigger or fill right now — and it will not catch up on moves it missed. Open ` +
  `${ticker}'s ticker page during live hours to watch it. It can still expire on the clock, and ` +
  `you can still cancel it.`;

/** D8-4 — scripted-scenario marking: the chip + the strip (panel/detail variant). */
export const SCRIPTED_CHIP = 'SCRIPTED SCENARIO';
export const scriptedStrip = (name: string) =>
  `Scripted scenario · ${name} — deterministic scripted output run through the real rec ` +
  `pipeline. Not a real AI read.`;

/** D8-5 — stale rec at Act. */
export const staleRecDisclosure = (asOf: string | null) =>
  `Newer data has arrived since this read was pinned (as of ${asOf ?? 'unknown snapshot'}). The ` +
  `plan below reflects that older snapshot; the trigger still evaluates against live data only.`;

// (D8-6 is GATE_SIGN_IN above.)

// ---- §4 — the Orders surfaces --------------------------------------------------------------------

export const WIDGET_TITLE = (ticker: string) => `Simulated orders · ${ticker}`;
export const PANEL_TITLE = 'Simulated orders';
export const PANEL_SUBTITLE =
  'Rec-driven entries watched against live data. Paper only — never a real order.';

export const WIDGET_EMPTY = (ticker: string) =>
  `No simulated orders for ${ticker}. Act on an AI read to create one — it watches the live ` +
  `tape for the entry.`;
export const PANEL_EMPTY_OPEN =
  'No simulated orders yet. On a ticker page, Act on a produced AI read to create one.';
export const PANEL_EMPTY_HISTORY = 'No completed orders yet.';

export const recentCompleted = (n: number) => `Recent ${n} completed`;

/** §4.6 — the orders-store fault block (AC-29, `[best-effort-isolated-or-null]`). */
export const STORE_FAULT_TITLE = 'Orders unavailable';
export const STORE_FAULT_BODY =
  "This browser's orders storage couldn't be read. Everything else keeps working — positions, " +
  'live data, and charts are unaffected, and previously saved orders were not overwritten.';

// §4.2 — lifecycle status chips + tooltips.
export const STATUS_CHIP: Record<string, string> = {
  waiting: 'Waiting',
  triggered: 'Triggered · working entry',
  filled: 'Filled',
  cancelled: 'Cancelled',
  expired: 'Expired',
};
export const waitingTip = (ticker: string) =>
  `Armed. Waits for ${ticker} to cross the trigger level on live data.`;
export const triggeredLimitTip = (limit: number) =>
  `Trigger crossed. Resting at the $${limit} limit — fills only on a live cross at that price.`;
export const TRIGGERED_MARKET_TIP =
  'Trigger crossed. Fills at the first live-resolvable option mark.';
export const FILLED_TIP = 'Entry filled — a simulated position was created. Open it from Details.';
export const CANCELLED_TIP = 'Cancelled by you. Terminal — recreate the order to change a plan.';
export const EXPIRED_TIP =
  "The good-til bound (or the contract's own expiration) passed before the entry completed.";

// §4.3 — evaluation reality.
export const WATCHING_CHIP = 'Watching live';
export const watchingTip = (ticker: string) =>
  `A live stream for ${ticker} is open in this tab — this order is evaluated in real time.`;

// §4.1 — row renderings.
export const triggerText = (t: { kind: string; level: number } | null): string =>
  t == null
    ? '— none (armed immediately)'
    : t.kind === 'underlying_above'
      ? `above ${t.level}`
      : `below ${t.level}`;
export const entryPriceText = (limit: number | null): string =>
  limit == null ? 'market on trigger' : `limit $${limit}`;
export const goodTilText = (date: string) => `Good-til ${date}`;
export const sourceAiRead = (persona: string) => `AI read · ${persona}`;
export const sourceScripted = (name: string) => `Scripted · ${name}`;

// §7 — actions.
export const ACTION_DETAILS = 'Details';
export const ACTION_CANCEL = 'Cancel order';
export const ACTION_CONFIRM_CANCEL = 'Confirm cancel';
export const ACTION_EXPORT = 'Export JSON';
export const ACTION_ALL_ORDERS = 'All orders →';
export const ACTION_VIEW_POSITION = 'View position →';
export const ACTION_VIEW_ORDER = 'view order →';
export const POSITION_FROM_ORDER = 'From sim order';

// §7 — glossary tooltips (jargon rule).
export const TRIGGER_GLOSSARY =
  "A condition on the UNDERLYING's live NBBO mid. When it crosses the level, the order starts " +
  'working the option entry.';
export const GOOD_TIL_GLOSSARY =
  "The order's expiry bound. If the entry hasn't completed by this date (or the contract itself " +
  'expires), the order expires — the only thing that can happen without live data.';

// §5 — order detail sections.
export const DETAIL_SOURCE = 'SOURCE';
export const DETAIL_PLAN = 'PLAN AS PLACED';
export const DETAIL_LIFECYCLE = 'LIFECYCLE';
export const detailScenarioSource = (name: string, id: string) =>
  `Scripted scenario · ${name} (${id})`;
export const detailPinned = (fingerprint: string, asOf: string | null) =>
  `Pinned to ${fingerprint} · as of ${asOf ?? 'unknown snapshot'}`;

// ---- §6 — the scenario picker (operator-only, flag-gated) ----------------------------------------

export const SCENARIO_LABEL = 'Scenario (operator)';
export const SCENARIO_NONE = 'Real AI read (no scenario)';
export const SCENARIO_CAPTION =
  'Operator harness — runs a scripted rec shape through the real pipeline: keyless, ' +
  'deterministic, consumes no cooldown or caps. Output is always marked as scripted.';
export const RUN_SCENARIO = 'Run scenario';
