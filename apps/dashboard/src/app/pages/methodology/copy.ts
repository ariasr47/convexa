/**
 * Product spine #7 — trust / methodology surface copy.
 * Honest product language: what we compute, on what basis, where it fails.
 * Never overclaims; structure is never "live"; no real-order path.
 */
export const METHOD_COPY = {
  title: 'How Convexa works',
  subhead:
    'What the numbers mean, how often they update, and where the read is weak. ' +
    'Not a pitch deck — the assumptions behind the desk.',
  disclaimer:
    'Convexa is an analysis tool. Simulated positions are paper. A connected brokerage is ' +
    'read-only — Convexa never places, changes, or cancels an order. Not investment advice.',

  sections: {
    structure: {
      h: 'Dealer structure — walls, flip, GEX',
      body: [
        'The core read is options dealer positioning: call and put walls, the gamma flip, and ' +
          'net GEX across strikes in your selected expiration window. Those levels come from the ' +
          'option chain snapshot, not from inventing direction on the FE.',
        'GEX and walls are computed at a GEX spot basis (often the cash/session close when the ' +
          'market is closed, live mid during regular hours for the engine’s phase rules). The ' +
          'ticker always labels that basis so a level is never confused with the live tape price.',
        'Raw dollar GEX sizes exposure for a fixed 1% spot shock. Vol-norm GEX divides that ' +
          'magnitude by ATM IV (or 30d HV if ATM IV is missing) so readings stay comparable when ' +
          'vol is high or low. Independent evidence favors the vol-normalized magnitude; walls ' +
          'and flip stay raw strike levels. Vol-norm GEX is not a scoring input.',
      ],
    },
    twoSpeed: {
      h: 'Two data speeds — do not mix them',
      body: [
        'Prices on the live tape can update from a stream. Structure — score, tier, flip, walls, ' +
          'GEX, setups — refreshes on a slower poll (about every few minutes, sooner for names ' +
          'that just moved). The scanner and ticker say “Structure as-of …” for that path.',
        'When the live stream drops, live tiles dim and say offline. Structure tiles stay ' +
          'readable at their last snapshot. A quiet tape is not a blank desk.',
      ],
    },
    score: {
      h: 'Score and tier',
      body: [
        'Opportunity score and tier arrive pre-computed from the server. The frontend maps them ' +
          'through closed labels (Prime, Actionable, Watch, Dormant) and never re-derives the ' +
          'score from scan rows alone.',
        'The score is a capped sum of plain components: proximity to walls/flip (up to 40), ' +
          '|IV/HV − 1| stretch (up to 25), active setups (up to 25), flip-transition bonus (10), ' +
          'and optional dark-pool confluence (up to 6). The scanner “why this row” tip surfaces ' +
          'the top components when the server sends score_drivers.',
      ],
    },
    fails: {
      h: 'Where the read is weak',
      body: [
        'Evidence is strongest on liquid index and megacap names. Thin single names can show ' +
          'structure that is noise — the ticker shows a single-name caveat when the symbol is ' +
          'outside the curated universe.',
        'Outside regular hours, structure still ages honestly, but spot basis and chain freshness ' +
          'matter more. Missing chain data, a failed symbol, or a building first pass shows as ' +
          'unavailable or building — never a fabricated zero.',
        'Sim P/L uses a mark ladder (snapshot → modeled → theoretical → last known). Last known ' +
          'is frozen when the stream is offline; it is never framed as live.',
      ],
    },
    never: {
      h: 'What Convexa never does',
      body: [
        'No real order path: nothing here places, changes, or cancels a broker order. Simulated ' +
          'trades and sim orders are paper for practice and the outcome ledger.',
        'No guarantee: structure is context for a plan, not a price forecast and not a trade ' +
          'command. AI recommendations are advisory and require an explicit accept into sim.',
      ],
    },
  },

  ctaScanner: 'Open Scanner',
  ctaTicker: 'Open free Ticker',
  ctaBack: 'Back to home',
} as const;
