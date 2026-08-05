/**
 * broker-connect trader-visible copy — EVERY string on the Broker surface, verbatim from SPEC §4
 * (binding intent; wordsmithing open ONLY where §4 left it open). Single source: components never
 * inline a broker string, so the F7 forbidden-word scan has one place to look.
 *
 * The label ruling (decisions.md): the word `live` appears in trader-visible broker copy ONLY
 * inside the negation phrase `a snapshot, never live` — never as a freshness claim or descriptor.
 * Internal names/routes/testids keep `live` where continuity wants it; this file is about what
 * the trader READS.
 *
 * Pure strings + tiny pure formatters. No React, no side effects.
 */

/** `14:59:00` — local wall-clock stamp for `as of {time}` slots. Seconds kept: this stamp is the
 *  surface's honesty mechanism, and a truncated stamp reads fresher than it is. */
export function stampTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** `45s` · `12m` · `2h 05m` — the age clause for the S6 stamp. */
export function ageText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}

export const BROKER_COPY = {
  /** The provenance header — the surface's signature ledger stamp. */
  header: {
    chip: 'Webull · read-only',
    asOf: (time: string) => `as of ${time}`,
    onDemand: 'read on demand — a snapshot, never live.',
    stampTip:
      'Your Webull positions are read when you open or refresh this tab, not streamed. This is ' +
      'the book as Webull reported it at this time — prices can have moved since.',
  },

  /** Signed-out (the auth carve-out row — shown BEFORE any broker state is reachable). */
  gate: 'Sign in to read your Webull positions.',

  s1: {
    heading: 'Connect your brokerage',
    body:
      'Convexa can read your Webull positions with your own API keys — so decisions run against ' +
      'the book you actually hold, not a hand-copied one. Read-only, absolutely: Convexa never ' +
      'places, changes, or cancels an order.',
    cta: 'Connect Webull',
    subline: 'Keys are saved encrypted and never shown again. You can disconnect any time.',
  },

  s2: 'Reading your Webull book for the first time…',

  s4: {
    heading: 'Webull reports no open positions.',
    checked: (time: string) => `Checked at ${time}. This is a confirmed read — not a guess.`,
  },

  s5: {
    body:
      "Convexa hasn't been able to read your Webull book yet. It won't show you an empty book " +
      "it hasn't confirmed.",
    cta: 'Try again',
  },

  /** S6 — appended stamp clause (book-snapshot axis only). */
  s6: (time: string, age: string) => `as of ${time} · ${age} old — refresh for a current read.`,

  s7: (time: string) =>
    `Couldn't reach Webull just now — showing your book as of ${time}. Everything else in ` +
    'Convexa is unaffected.',

  s8: {
    banner:
      'Webull stopped accepting the saved key. Reconnect in Settings to resume reading your book',
    lastKnown: (time: string) => ` — your last confirmed book (as of ${time}) stays below.`,
    cta: 'Reconnect in Settings',
  },

  /** Server-side decrypt-fail — OUR fault, never presented as a Webull rejection (AC-13). */
  unreadable: {
    banner:
      "Convexa couldn't read your saved keys — a fault on our side, not Webull's. Replace them " +
      'in Settings to resume.',
    cta: 'Replace keys in Settings',
  },

  refresh: {
    action: 'Refresh',
    /** Throttled / cache-served — the honest "unchanged and why" note (AC-8, C4). */
    unchanged: (time: string) =>
      `Unchanged — still your book as of ${time}. Webull wasn't asked again just now ` +
      '(protecting your rate limits).',
    /** A real attempt happened and failed; the S7/S8 banner carries the cause — this note keeps
     *  the gesture itself honest (never a silent no-op). Wordsmithing open per SPEC §4. */
    failed: (time: string | null) =>
      time != null
        ? `Couldn't get a fresh read — still your book as of ${time}.`
        : "Couldn't get a fresh read.",
    /** The refresh REQUEST didn't complete (our transport) — still never a silent no-op. */
    incomplete: (time: string | null) =>
      time != null
        ? `Couldn't complete the refresh — still your book as of ${time}.`
        : "Couldn't complete the refresh.",
  },

  /** `Custom` structure tip on a broker row — no confidence measures, no "probably a condor". */
  customTip:
    "Convexa doesn't have a name for this leg shape, so it shows the legs as Webull holds them. " +
    'Nothing is wrong with the position — a name is a convenience, not a verdict.',

  /** The fifth not-a-number literal's tip (`not provided` — the feed, not the account). */
  notProvidedTip:
    "Webull's data for this position doesn't include this detail. Convexa won't guess it — " +
    'nothing is missing from your account, only from the feed.',

  modeled: {
    label: 'Convexa-modeled',
    tip: "our model's current read on this position — recomputed as prices move; not a Webull figure",
    /** Snapshot stale + mark feed up (C-1 ruling): the figure keeps updating, the label names BOTH bases. */
    dualLabel: (time: string) => `modeled now · on your book as of ${time}`,
    dualTipAppend: (time: string) =>
      `Prices are current; the position list is as Webull reported it at ${time}. Refresh for a ` +
      'current read of the book.',
    /** For the broker-reported reference IF the owner rules it in (SPEC §9.3 — carried, unrendered). */
    brokerReportedTip: "Webull's own unrealized P/L, as of the stamp above.",
    /**
     * G3 — the PERMANENT withhold. `unavailable` frames a gap as "this cycle"; a contract Convexa
     * cannot identify will not become priceable on the next refresh, so the figure renders `not
     * provided` and this tip says why. (Wordsmithing open — GATE Q review, not an amendment.)
     */
    unpriceableTip:
      "Convexa's model won't value a contract it can't identify. Webull's feed carries no strike, " +
      'expiry, or call/put for this holding, so there is nothing to price it against — refreshing ' +
      "won't change that. Your quantity and cost are still shown exactly as Webull reported them.",
  },

  /** The explicit cannot-fully-display entry (fidelity partial/unrecognized — AC-14). */
  cannotFullyDisplay:
    "Convexa can't fully display this position — showing what Webull reported, nothing invented.",

  /** The count line — never understates the broker's book (unrecognized entries count). */
  positionsCount: (n: number) => `${n} position${n === 1 ? '' : 's'}`,
} as const;
