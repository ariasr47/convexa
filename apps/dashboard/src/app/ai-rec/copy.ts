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
    get: 'Get AI recommendation',
    askAnyway: 'Ask anyway',
    retry: 'Retry',
    accept: 'Accept into ghost trade',
    viewExport: "View what's sent",
    freshRec: 'Get a fresh recommendation',
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
    caption: "No entry to Accept — a 'no trade' read is a complete, correct answer.",
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
      'A read, not an order. Nothing is tracked until you Accept and confirm a paper (simulated) trade.',
    get:
      'Ask the AI for a risk-first entry read on {TICKER}, framed by your active persona and the ' +
      "current snapshot. Advisory only — you'll review and explicitly Accept before anything is tracked.",
    askAnyway: 'Override the quiet gate and request a read anyway. Still rate-limited.',
    persona:
      'This read was produced by the {name} persona. A different persona may read the same snapshot ' +
      'differently.',
    asOf:
      "Pinned to the snapshot it was generated from. It won't refresh itself — request a fresh read " +
      'when you want one.',
  },
} as const;

// ---- byo-ai-key (UX_BLUEPRINT §5; verbatim) --------------------------------------------------
// The five key-resolution states layered on top of the shipped gate/cooldown/cap. Honest, not a free
// trial: states (a)/(e) frame BYO as a setup step; (c) frames the allowance as renewing daily.
export const BYO_KEY = {
  noKey: {
    title: 'Add your Anthropic key to get AI recommendations',
    body:
      'AI recommendations run on your own Anthropic API key — your key, your cost. Add it once in ' +
      'Settings and this unlocks. The manual export below always works without a key.',
    cta: 'Add your key in Settings',
  },
  adminExhausted: {
    body:
      'Your free allowance on the shared key is used up for today. Add your own Anthropic key in ' +
      'Settings to keep getting recommendations — your free uses come back tomorrow.',
    cta: 'Add your key in Settings',
  },
  sharedUnconfigured: {
    title: "The shared AI key isn't set up",
    body:
      "There's no shared key configured for free admin recommendations right now. Add your own " +
      'Anthropic key in Settings to use recommendations — your key, your cost. The manual export ' +
      'below still works without a key.',
    cta: 'Add your key in Settings',
  },
  freeUses: {
    tooltip:
      "Free recommendations on the shared key, for admins. Used today's allowance? Add your own " +
      'Anthropic key in Settings to keep going. The count resets daily.',
  },
  ownKey: {
    chip: 'Using your key',
    tooltip:
      'This recommendation ran on your own Anthropic key — your cost, no shared limit. It doesn\'t ' +
      'use the free admin allowance. Manage your key in Settings.',
  },
} as const;

/** `You've used today's {total} free recommendations` — state (c) exhausted title. */
export const adminExhaustedTitle = (total: number) =>
  `You've used today's ${total} free recommendations`;
/** `{remaining} of {total} free uses left today` — state (b) subordinate chip. */
export const freeUsesChip = (remaining: number, total: number) =>
  `${remaining} of ${total} free uses left today`;
/** `Using your key` — state (d) subordinate chip. */
export const OWN_KEY_CHIP = BYO_KEY.ownKey.chip;
/** The default allowance display constant when `free_uses_total` is absent (UX §6). */
export const FREE_USES_TOTAL_FALLBACK = 3;

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
  'Get a fresh recommendation when you’re ready.';
/** Stale-born strip — generated off an already-stale bundle ({data_age}). */
export const staleBornStrip = (dataAge: string) =>
  `This read was generated from a snapshot already marked stale (${dataAge}). ` +
  'Treat the levels with caution.';
/** `Pre-filled from AI read · {persona}` chip seeded into the entry dialog. */
export const prefillChip = (persona: string) => `Pre-filled from AI read · ${persona}`;
export const EXPORT_HEADER = (ticker: string) => `What's sent to the AI · ${ticker}`;
/** Retry-under-gate sub-captions (E6). */
export const retryInCooldown = (remaining: number) => `Retry available in ${remaining}s`;
export const retryWhenReset = (when: string) => `Retry available when the daily limit resets ${when}`;

/** Friendly local time for a cap `resets_at` ISO instant; falls back to the raw value. */
export function friendlyResetTime(iso: string | null | undefined): string {
  if (!iso) return 'soon';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
