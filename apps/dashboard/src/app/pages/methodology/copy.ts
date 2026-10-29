/**
 * Product spine #7 — trust / methodology surface copy (SPEC.md §2.6, §4 "Methodology — one
 * copy source, four deltas"; PLAN.md F9).
 *
 * `METHOD_COPY.sections` is an ORDERED ARRAY of `MethodSection`, not an object plus a
 * hand-maintained order list — the on-this-page index and the body both generate from this one
 * list (F10), so they cannot diverge. Each section's `blocks` is a discriminated union at the
 * BLOCK level, not the section level (PLAN D1): two sections (`score-and-tier`, `vocabulary`)
 * carry prose *and* a table, and a section-level union cannot express that without producing an
 * eleventh or twelfth index row. A `{ kind: 'table' }` block can never render as prose.
 *
 * PROVENANCE (AC-C1a): every heading and every paragraph below is copied byte-for-byte from
 * `design/src/screens/methodology.mjs:29-58` — that file is the single source for this page, and
 * none of the retired v1 wording this module used to carry survives anywhere here. The one
 * exception is the illustrative panel inside "Two data speeds" (`methodology.mjs:32`, a
 * `chip live` + dot + `levels as-of 42s`) — it does not ship: both are banned on a page with no
 * stream (AC-L5), and the state matrix commissions no instrument on this page. One section has
 * another source for now: `fear-greed-gauge`, and the What's live rows that name the gauge, are
 * copied byte-for-byte from spec docs/product/specs/2026-10-21/07-stress-gauge.md (Copy ›
 * /methodology) until that spec's step 0 adds them to the design source.
 *
 * SIX NAMED DELTAS (quoted, so AC-C1 pins them — the quote governs where it deviates from the
 * source line named beside it):
 *   1. Score section's introducing clause — verbatim up to "never re-derives the score from scan
 *      rows alone."; the final clause is corrected to state the two-stage clamp (the five maxima
 *      sum to 106, not 100 — AC-M2a).
 *   2. AI section gains the `no trade`-is-a-complete-answer sentence (canon rule 16).
 *   3. "What leaves the machine" replaces the trailing clause of `methodology.mjs:51` with the
 *      reviewable-payload sentence, naming both drawer labels byte-exact including the apostrophe
 *      glyph each ships with (“What’s sent to the AI” U+2019 vs "View what's sent" U+0027) —
 *      renders as text, never a route link (there is no /whats-sent route).
 *   4. The vocabulary table carries every member of the shipped closed union (imported, never
 *      retyped, so a tenth member without a definition red-builds — §7 item 9's set-equality),
 *      each rendered Plex Sans, never mono, never a figure. No "this is a selection" clause.
 *   5. GATE Z amendment 1 (AC-M2b) — the score table's `Flip transition` row's "What it reads"
 *      cell is `the mid sits within 1% of the gamma flip`, replacing the design source's `the
 *      flip moved across the mid since the last snapshot`: the engine scores this component when
 *      `|gamma_flip_pct| <= FLIP_PROXIMITY_PCT` (`signals.rs:19,241`, one snapshot, no
 *      cross-snapshot comparison) — the design's wording describes a move the engine never
 *      computes.
 *   6. GATE Z amendment 2 (AC-M4a) — the Vocabulary section states, once, before its table:
 *      `This is the complete set: the product renders no other word in place of a number.` §4
 *      supplied no such sentence at synthesis; this one claims closure without a count, so it
 *      stays true as the imported union grows.
 *
 * Score table `Max` column (40 / 25 / 25 / 10 / 6): pinned to `libs/quant-engine/src/signals.rs`
 * by F13's structural spec (AC-M2, §7 item 10) — this module states the design source's own
 * numbers; it does not read the crate itself.
 *
 * `title`, `subhead`, `disclaimer`, `ctaScanner`, `ctaTicker`, `ctaBack` are byte-identical
 * between the design source (`methodology.mjs:24-25,62-63`) and this module and are unchanged.
 */
import { NOT_A_NUMBER, type NotANumber } from '@/shared/copy/notANumber';
import { FINRA_OFF_REASON } from '@/shared/dataState/finraSwitch';
import type { DataStateKey } from '@/shared/dataState/vocabulary';

export type MethodBlock =
  | { readonly kind: 'prose'; readonly body: readonly string[]; readonly muted?: boolean }
  | {
      readonly kind: 'table';
      readonly head: readonly string[];
      readonly rows: readonly (readonly string[])[];
    };

export interface MethodSection {
  /** The stable anchor a deep link resolves to (AC-M1). */
  readonly id: string;
  readonly h: string;
  readonly blocks: readonly MethodBlock[];
}

/** The one closed not-a-number vocabulary ([absent-is-not-none]) — imported, never retyped, so
 *  a tenth member added to the union without a definition here red-builds the page that
 *  documents it (§7 item 9 asserts set-equality in both directions). */
const VOCABULARY: Readonly<Record<NotANumber, string>> = {
  '—': 'no value on this snapshot — a plain dash, never a fake zero',
  unavailable: 'an input failed or is missing this cycle',
  'not given': 'the read did not answer this field',
  'not set':
    'you supplied no risk block — the one on this list you can clear yourself, by typing one',
  'size not suggested': 'the risk block is present; the model returned no size',
  unrecognized:
    'the read answered a conviction outside low / medium / high; Convexa will not repeat what it cannot place',
  'not recorded': 'the saved record never held this fact, so there is nothing to show',
  'not provided': 'the feed did not send this field — the source withheld it, not us',
  'no basis':
    'no cost basis is on file, so a cost-based figure cannot be derived; the dollar figure beside it is still real',
};
// Set-equality in BOTH directions is the point (§7 item 9): the union drives the rows.
const VOCAB_ROWS = NOT_A_NUMBER.map((lit) => [lit, VOCABULARY[lit]] as const);

const SECTIONS: readonly MethodSection[] = [
  {
    id: 'two-data-speeds',
    h: 'Two data speeds — do not mix them',
    blocks: [
      {
        kind: 'prose',
        body: [
          'Prices on the live tape update from a stream. Structure — score, tier, flip, walls, GEX, setups — refreshes on a slower poll (about a minute on a ticker desk, about every three minutes across the scanner, sooner for names that just moved). The scanner and ticker say “Structure as-of …” for that path.',
          'When the live stream drops, live cells dim and say offline. Structure stays readable at its last snapshot. A quiet tape is not a blank desk.',
        ],
      },
    ],
  },
  {
    id: 'dealer-structure',
    h: 'Dealer structure — walls, flip, GEX',
    blocks: [
      {
        kind: 'prose',
        body: [
          'The core read is options dealer positioning: call and put walls, the gamma flip, and net GEX across strikes in your selected expiration window. Those levels come from the option chain snapshot, not from inventing direction on the front end.',
          'GEX and walls are computed at a GEX spot basis (often the session close when the market is closed, the live mid during regular hours for the engine’s phase rules). The desk always labels that basis so a level is never confused with the live tape price.',
          'Raw dollar GEX sizes exposure for a fixed 1% spot shock. Vol-norm GEX divides that magnitude by ATM IV (or 30-day HV if ATM IV is missing) so readings stay comparable when vol is high or low. Independent evidence favours the vol-normalized magnitude; walls and the flip stay raw strike levels. Vol-norm GEX is not a scoring input.',
        ],
      },
    ],
  },
  {
    id: 'flip-vs-walls',
    h: 'Flip vs walls — different gamma bases',
    blocks: [
      {
        kind: 'prose',
        body: [
          'Call wall and put wall pick the strikes with the largest positive and negative dealer gamma using the vendor’s per-contract gamma and a dealer-sign open-interest convention (calls short, puts long as the default dealer book). That is a snapshot convention, not a measured inventory — real desks can and do differ.',
          'Gamma flip is not “the wall’s midpoint”. It is the zero-crossing of the analytic net-GEX curve across strikes, where hedging flips from dampening to amplifying. Walls can sit far from the flip when the gamma profile is skewed; treat them as related but not the same object.',
        ],
      },
      {
        kind: 'prose',
        muted: true,
        body: [
          'Limitations: vendor gamma can lag or gap on thin names; OI sign is an assumption; levels are only as good as the chain snapshot. When gamma or OI is missing the cell says unavailable — we do not invent a wall.',
        ],
      },
    ],
  },
  {
    id: 'score-and-tier',
    h: 'Score and tier',
    blocks: [
      {
        kind: 'prose',
        body: [
          'The score is a sum of plain components, capped twice. The four base components below are summed and capped at 100; the dark-pool confluence bonus is added after that cap and capped again, so it can only lift a score that is still under 100 and no score ever exceeds 100:',
        ],
      },
      {
        kind: 'table',
        head: ['Component', 'Max', 'What it reads'],
        rows: [
          ['Proximity to walls / flip', '40', 'how close the mid sits to a level that matters'],
          ['|IV/HV − 1| stretch', '25', 'how far implied vol sits from realised'],
          ['Active setups', '25', 'rule-based reads currently firing'],
          ['Flip transition', '10', 'the mid sits within 1% of the gamma flip'],
          ['Dark-pool confluence', '6', 'optional · off-exchange prints near a level'],
        ],
      },
      {
        kind: 'prose',
        muted: true,
        body: [
          'Honest scope: today’s score does not consume vol-normalized GEX or the IV-rank band. Those are advisory context on the desk only. Folding them into the score would be a deliberate product change with ledger evidence — not a quiet UI tweak.',
        ],
      },
    ],
  },
  {
    id: 'advisory-reads',
    h: 'Advisory reads',
    blocks: [
      {
        kind: 'prose',
        body: [
          'Projected dealer flow (charm, vanna), market context (trend, profile shape, flow vs positioning, ATR), IV rank, the straddle-implied move, fresh positioning and off-exchange blocks sit in the context band. They carry their own basis and as-of, they refresh with the data load, and none of them feeds the score.',
        ],
      },
    ],
  },
  {
    id: 'ai-read-and-grounding',
    h: 'AI read and grounding',
    blocks: [
      {
        kind: 'prose',
        body: [
          'A read runs on your own key, pinned to one snapshot, framed by your persona and capped by your risk inputs. It answers trade or no trade first, then max risk, invalidation, entry and target. Each cited figure is checked against the snapshot: figures that trace to Convexa render in mono; a figure the model asserted but that could not be traced renders in body type, so authorship is visible even in a black-and-white screenshot.',
          'A "no trade" read is a complete, correct answer — not an error and not a failed request.',
        ],
      },
      {
        kind: 'prose',
        muted: true,
        body: [
          "What leaves the machine, on demand, is the computed snapshot, the candidate contracts, your two risk numbers, the open-positions digest for the ticker, the persona prompt and the field glossary. You can read the exact payload before it is sent: open “What’s sent to the AI” from the full-analysis drawer on any ticker, or “View what's sent” in Settings → Risk inputs. No other ticker, no identity, no broker data and no key ever leave.",
        ],
      },
    ],
  },
  {
    id: 'simulation',
    h: 'Simulation',
    blocks: [
      {
        kind: 'prose',
        body: [
          'Simulated trades and orders are paper. Fills model at the mid with no slippage and no partial fills; a sim order triggers and fills only while a live stream for that ticker is open in your browser. Sim P/L uses a mark ladder (snapshot → modeled → theoretical → last known); last known is frozen when the stream is offline and never framed as live.',
        ],
      },
    ],
  },
  {
    id: 'fear-greed-gauge',
    h: 'Fear–greed gauge',
    blocks: [
      {
        kind: 'prose',
        body: [
          'The fear–greed gauge in the Stress section of Research → Markets is built only from inputs Convexa may show. The familiar fear gauges (Cboe’s VIX and put/call ratios, CNN’s Fear & Greed) need a licence to show, so none is used.',
          'Seven inputs: the five category series of the Office of Financial Research’s Financial Stress Index (volatility, credit, safe assets, equity valuation and funding) and two weekly CFTC series, leveraged funds’ net VIX futures and asset managers’ net E-mini S&P 500 futures, each as a share of open interest.',
          'Each input is ranked against its own last three years: its percentile is the share of those days or weeks it sits above. Inputs where a higher value means more fear are flipped, so for every input 0 is extreme fear and 100 extreme greed: high stress reads low. The gauge is the plain average of the unrounded scores of the inputs that are fresh: a daily input counts for 5 weekdays after its date, holidays included, a weekly one for 14 days. With fewer than 5 of 7 fresh, no reading is published.',
          'Bands are Convexa’s own: 0–24 Extreme Fear, 25–44 Fear, 45–55 Neutral, 56–75 Greed, 76–100 Extreme Greed. An edge belongs to the calmer band.',
        ],
      },
      {
        kind: 'prose',
        muted: true,
        body: [
          'The cost: five of the seven inputs come from one OFR file, so one method and one outage drive most of the gauge, and in practice it publishes exactly when that file is fresh. The OFR’s categories are blends of 33 market variables worldwide (OFR working paper 17-04), not raw prices, and the file runs about two business days behind, so each row shows its own date. The gauge is research, not a signal, and not investment advice.',
        ],
      },
    ],
  },
  {
    id: 'where-the-read-is-weak',
    h: 'Where the read is weak',
    blocks: [
      {
        kind: 'prose',
        body: [
          'Evidence is strongest on liquid index and megacap names. Thin single names can show structure that is noise — the desk shows a single-name caveat when the symbol is outside the curated universe. Outside regular hours structure still ages honestly, but spot basis and chain freshness matter more. Missing chain data, a failed symbol or a building first pass shows as unavailable or building — never a fabricated zero.',
        ],
      },
    ],
  },
  {
    id: 'what-convexa-never-does',
    h: 'What Convexa never does',
    blocks: [
      {
        kind: 'prose',
        body: [
          'No real order path: nothing here places, changes or cancels a broker order. No guarantee: structure is context for a plan, not a price forecast and not a trade command. AI reads are advisory and require an explicit accept into the sim book.',
        ],
      },
    ],
  },
  {
    id: 'vocabulary',
    h: 'Vocabulary',
    blocks: [
      {
        kind: 'prose',
        body: ['This is the complete set: the product renders no other word in place of a number.'],
      },
      {
        kind: 'table',
        head: ['Literal', 'Means'],
        rows: VOCAB_ROWS,
      },
    ],
  },
];

export const METHOD_COPY = {
  title: 'How Convexa works',
  subhead:
    'What the numbers mean, how often they update, and where the read is weak. ' +
    'Not a pitch deck — the assumptions behind the desk.',
  disclaimer:
    'Convexa is an analysis tool. Simulated positions are paper. A connected brokerage is ' +
    'read-only — Convexa never places, changes, or cancels an order. Not investment advice.',
  sections: SECTIONS,
  ctaTicker: 'Open free Ticker',
  ctaScanner: 'Open Scanner',
  ctaBack: 'Back to home',
} as const;

/**
 * “What’s live on this site” (#data), the section the production bar's “What’s live” opens. Static
 * copy chosen by build mode; it must agree with /api/health and the 2026-10-14 environments without
 * asking either (the page sends no request). Production today: no options vendor; public records
 * live, SEC EDGAR included (SEC_USER_AGENT is set, 2026-10-15); FINRA Off with its reason until the
 * owner confirms FINRA's terms (owner, 2026-10-15; shared/dataState/finraSwitch.ts).
 * Each row's source and cadence match /credits (pages/trust/sources.ts).
 * Design: design/src/screens/final/shell-site-docs.mjs (liveSection).
 */
export const WHATS_LIVE = {
  id: 'data',
  h: 'What’s live on this site',
  production: {
    /** Plain, bold, plain, bold, plain. */
    lead: [
      'This site runs without a paid options feed. ',
      'Public records are live',
      ', each with its source and its date, except FINRA’s short data, which is off for now. ',
      'Everything built from the options chain is not live',
      ': those panels say what they would show and why they are off, and link to the same screen on the demo, where every screen runs on sample data.',
    ],
    liveHead: 'Live here',
    live: [
      ['Treasury yield curves', 'U.S. Treasury', 'Every business day, after the close'],
      [
        'Net liquidity',
        'Federal Reserve H.4.1, Treasury Daily Treasury Statement, NY Fed reverse repo',
        'Weekly: as of Wednesday, out Thursday',
      ],
      [
        'Futures positioning',
        'CFTC Traders in Financial Futures',
        'Weekly: as of Tuesday, out Friday',
      ],
      [
        'Fear–greed gauge (Markets, Stress)',
        'Office of Financial Research; CFTC',
        'Daily, about two business days late; CFTC weekly',
      ],
      [
        'Release dates: FOMC, CPI, PPI, jobs, GDP, refunding',
        'Federal Reserve, BLS, BEA, U.S. Treasury',
        'Set months ahead; read twice a day',
      ],
      [
        'Filings, insider trades, reported figures',
        'SEC EDGAR',
        'As filed; filings checked every hour, company facts daily',
      ],
      ['Research notes', 'Convexa', 'As written, each with its review date'],
      [
        'Daily price chart',
        'TradingView (third party)',
        'TradingView’s own delay; Convexa reads nothing from it',
      ],
    ],
    switchedOffHead: 'Off here',
    switchedOffBody: FINRA_OFF_REASON,
    switchedOff: [
      ['Short interest', 'FINRA'],
      ['Short-sale volume', 'FINRA'],
    ],
    offHead: 'Not live here',
    offColumn: 'Needs the options feed',
    off: [
      ['Dealer gamma, the walls and the flip', '/ticker/SPY'],
      ['Flow, the tape and off-exchange blocks', '/ticker/SPY'],
      ['The scanner’s scores and tiers', '/scanner'],
      ['AI reads', '/ticker/SPY'],
      ['Option prices, greeks and implied volatility', '/ticker/SPY'],
    ],
    onDemo: 'On the demo →',
    wordsLead:
      'Each panel carries one of these words, with its glyph. Failures add burnt orange; none of them uses green or red.',
  },
  staging: {
    /** Bold, then plain. */
    lead: [
      'Nothing: this is the demo.',
      ' Every screen runs on an authored scenario dated October 7, 2026, and the site makes no calls to Convexa’s API or to any third party. You are signed in to the demo account; your changes stay in this browser until you reset them from the demo bar.',
    ],
    demoHead: 'In this demo',
    /** Each sample, worded as the demo's chips are: “Demo · shaped like …” (as on /credits). */
    demo: [
      ['Dealer structure, flow, scores, AI reads', 'shaped like the Massive options feed'],
      ['Rates, positioning, stress, short data', 'shaped like Treasury, OFR, CFTC and FINRA'],
      ['Filings and reported figures', 'shaped like SEC EDGAR'],
      ['Research notes', 'six authored sample notes'],
      ['Daily bars and indicators', 'computed from sample bars'],
    ],
    liveHead: 'The live site',
    liveBody:
      'The production site runs the public data live — Treasury, the Fed, CFTC, SEC EDGAR, the release schedules, research notes and TradingView’s daily chart — keeps FINRA’s short data off until its terms are confirmed, and shows Not live wherever the options feed would be needed.',
    liveLink: 'Open the live site',
  },
} as const;

/** One state word as this page lists it: the state, what it means, and the word when the page
 *  names it in context (P-15: the landing's “Illustrative sample”). */
export type StateWordRow = readonly [state: DataStateKey, means: string, word?: string];

/** The P-2 words a production panel can carry, each with what it means. */
export const STATE_WORDS: readonly StateWordRow[] = [
  ['updated', 'Current to its source, with the source’s date. Never a live dot.'],
  ['delayed', 'The source publishes late on a schedule; the tag says by how much.'],
  ['computed', 'Convexa computed it from public inputs it names.'],
  ['thirdParty', 'A third party draws it from its own data; Convexa reads nothing from it.'],
  ['notLive', 'Needs the paid options feed this site doesn’t run.'],
  ['lastGood', 'This cycle failed; the earlier copy shows dimmed, with when it was fetched.'],
  ['sourceDown', 'The source didn’t answer and nothing is kept: unknown, not empty.'],
  ['couldntLoad', 'Our request failed. The panel says why and offers Try again.'],
  ['notSetUp', 'This site lacks a setting the source needs; the panel says which.'],
  ['off', 'Switched off on purpose.'],
  ['signIn', 'Behind the private-testing wall; sign-ups are closed.'],
  [
    'local',
    'Your own settings and records, kept in this browser or your account. Needs no market data.',
  ],
  ['sample', 'Only on the landing page’s illustrations. Never market data.', 'Illustrative sample'],
];

/** The words the demo uses. */
export const STAGING_WORDS: readonly StateWordRow[] = [
  [
    'demo',
    'The bar on every page here. Every source chip is dashed and says what the sample is shaped like.',
  ],
  ['computed', 'Convexa computed it, here from sample inputs.'],
];
