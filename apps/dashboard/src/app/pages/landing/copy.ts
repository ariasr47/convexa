/**
 * pages/landing/copy.ts — the landing's pinned strings (SPEC §4; PLAN F7 step 1).
 *
 * Two provenances, and both are pins:
 *   - Every string this file exports that SPEC §4 QUOTES is pinned to those exact bytes (AC-C1).
 *     Apostrophes are U+2019 where the design source uses them (never a straight U+0027); the en
 *     dash in `7–45` and the em dashes in the body copy are the source's own glyphs, never
 *     retyped as a hyphen.
 *   - The three feature bodies, nine bullets and three trust-card bodies are copied byte-for-byte
 *     from `design/src/screens/landing.mjs:104,107-109,126-128` (AC-C1a; F13's item-16 spec
 *     proves it against the design source on disk) — with ONE deliberate, named exception: the
 *     field section's second bullet, marked AMENDED below (four words added, no new claim).
 *
 * The CTA band's two auth strings are IMPORTED from `@/features/auth/copy`, never retyped — the
 * deny-list allows that module because it is a pure string table with no transport (SPEC §2.1),
 * and importing (rather than duplicating) is what makes "reopen sign-ups" a one-string edit at
 * that one site instead of three surfaces quietly drifting apart (SPEC §8).
 *
 * Cut from the design source (SPEC §4's cut table): the three.js
 * caption, the `structure as-of 42s` chip + live dot, `rendered from the desk's own bundle`,
 * `7d → 90d tenors`, the CTA band's radial gradient wash, the whole "desk
 * right now" strip, and the brokerage-connect footnote. None of those strings live in this file.
 */
import { AUTH_COPY } from '@/features/auth/copy'; // ALLOWED by the deny-list: strings, no transport.

export const LANDING_COPY = {
  /**
   * Two actions on `/` share this accessible name (AC-L15): the hero primary and the CTA-band
   * primary both keep the arrow in their VISIBLE label (`Open the Ticker →`, the pinned bytes)
   * but are given `aria-label={openTickerName}` so assistive tech hears "Open the Ticker" once,
   * not the glyph. Same destination (`/ticker`) is what makes sharing the name correct.
   */
  openTickerName: 'Open the Ticker',

  hero: {
    chip: 'Dealer-gamma analytics · free ticker, no account',
    h1: 'See the dealer positioning behind the price.',
    sub: 'Convexa turns an option chain into dealer gamma structure — the call and put walls, the gamma flip, the magnet — then gives you a risk-first AI read on the setup. Practice the plan on a simulated book before you ever risk a dollar.',
    spine: 'Scan → Ticker → Plan → Track',
    primary: 'Open the Ticker →',
    secondary: 'How it’s built',
    footnote:
      'Built for 7–45 DTE swing trades with optional intraday timing. An analysis tool; every trade is simulated.',
    /** The hero panel's own eyebrow — text-grade amber (canon Amber budget, SPEC §4 Design
     *  direction: "the eyebrow caps use text-grade amber, never fill amber as small text"). */
    panelEyebrow: 'Dealer gamma surface · strike × tenor',
    /** The legend beside `GammaSurfaceHero` (AC-L4a): three named ridges, in the SVG's own
     *  ridge colours (flip = primary/amber, call wall = success, put wall = error). */
    legend: ['gamma flip', 'call wall', 'put wall'] as const,
  },

  field: {
    eyebrow: 'Where is price pulled?',
    h2: 'Walls, the flip, the magnet — drawn as a field, not a table.',
    body: 'Dealer hedging creates structure you can see: a call wall that caps, a put wall that catches, and a gamma flip where hedging turns from dampening to amplifying. The structure field plots net dealer gamma by strike and drops the live mid onto it, so you read where price is attracted or repelled at a glance.',
    bullets: [
      'Levels refresh about every minute on the desk and carry their as-of',
      // AMENDED (SPEC §4, GATE Z amendment 4): `landing.mjs:126`'s bullet reads "The mid is
      // tape — …", no trailing period. Four words ("On a ticker desk") are added so the subject
      // is named — sitting three inches from a frozen sample, the bare subject "the mid" would
      // read as THIS mid. No new claim. The quoted form governs the trailing byte too (AC-C1):
      // "four words added" counted words, not punctuation — the period is added, not inherited.
      'On a ticker desk the mid is tape — it pulses only while the stream is genuinely live.',
      'Magnet view shows the same levels as a pull, for the visual thinkers',
    ] as const,
  },

  score: {
    eyebrow: 'Is there an edge right now?',
    h2: 'A triage score that is honest about what it is.',
    body: 'Proximity to a wall or the flip, IV against realised vol, active setups, a flip transition and optional dark-pool confluence roll into a 0–100 score and a tier. It ranks names for a deeper look. It is not a trade signal, and it never uses the advisory reads.',
    bullets: [
      'Dormant → Watch → Actionable → Prime',
      'Every component of the score is inspectable in the Scanner',
      'Context reads (flow, vol, ATR) stay advisory — never score inputs',
    ] as const,
  },

  aiRead: {
    eyebrow: 'What would I risk?',
    h2: 'A risk-first read, on your own key, grounded in the structure.',
    body: 'Ask for a read and get the verdict first — trade or no trade — then max risk, invalidation, entry and target before a single paragraph of rationale. Figures that trace to Convexa render in mono; the model’s own numbers render in body type so you always know whose number you are looking at.',
    bullets: [
      'Pinned to a snapshot; a newer one is flagged, never silently swapped',
      'Your persona frames the read; your risk inputs cap the size',
      'Accept it into a simulated trade — nothing is saved until you confirm',
    ] as const,
  },

  register: {
    eyebrow: 'Honest by design',
    h2: 'Numbers say where they came from.',
    body: 'Every surface carries its basis. If you can’t tell whether a figure is live, a snapshot, or the model’s own guess, we have failed — so the type itself tells you.',
    /** The one-click proof path AC-L9 checks — NOT via the footer. */
    action: 'Read the methodology →',
    trustCards: [
      {
        title: 'Snapshot, never live',
        body: 'Structure — score, tier, walls, the flip — recomputes on a stated cadence: about a minute on a ticker desk, about three minutes across the scanner. Prices and the mid stream live and are labelled as tape. The two speeds never blur.',
      },
      {
        title: 'Simulated, always',
        body: 'The sim book is paper: no slippage, no partial fills, nothing sent to a broker. A connected brokerage is read-only. Convexa never places an order.',
      },
      {
        title: 'Advisory, never an order',
        body: 'The AI read runs on your own key, pins to a snapshot, and cites what it used. Figures it could not trace render in body type. You confirm every paper trade.',
      },
    ] as const,
  },

  cta: {
    heading: 'Open any ticker. No account, no card.',
    // `landing.mjs:117` MINUS "across 69 tracked names" (SPEC §4): the count is true today, but
    // the landing never reads `universe.json`, so one owner edit plus a restart would make the
    // page lie with no test to notice. The deviation IS the pin (AC-C1 governs over the source).
    body: 'The full structure desk is free. Sign up when you want the Scanner, a simulated book that persists, and AI reads on your own key.',
    primary: 'Open the Ticker →',
    // Imported, never retyped (SPEC §8: "reopening sign-ups is therefore a server change plus
    // exactly one frontend edit at that one string's site" — the landing must never hold its own
    // copy of either sentence, or the two surfaces can drift out of sync).
    secondary: AUTH_COPY.account.signIn,
    signupsClosed: AUTH_COPY.signup.signupsClosed,
  },

  /** The demo build is always signed in to its seed account (owner, 2026-10-14): no sign-in here. */
  ctaDemo: {
    heading: 'You’re signed in to the demo account.',
    body: 'Every screen is open, on sample data: the Scanner, a simulated book, alerts, and AI reads written for the scenario.',
    secondary: 'Open the demo book',
    note: 'Your changes stay in this browser. Reset them any time from the demo bar.',
  },
} as const;
