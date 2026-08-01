/**
 * Stage 0 item 1 — the 393px NO-HORIZONTAL-OVERFLOW enforcement row (redesign-stage-0
 * FRONTEND_EXECUTION_CONTRACT §8.1; convexa-design skill rule 9 — `scrollWidth 580 vs 393` was the
 * documented failure). Silently-regressing: ANY future component can break it, so it is a
 * re-runnable real-browser test, not a one-off review.
 *
 * NOTE: the contract names Playwright for this row; this repo's e2e runner is CYPRESS (it replaced
 * the prior Playwright setup — see cypress.config.ts). Same enforcement, project-native tool.
 *
 * At 393×852, on every trader route, in BOTH color schemes:
 *   `document.documentElement.scrollWidth <= window.innerWidth`
 * plus the mobile-nav presence check (the hamburger renders below md; the drawer carries the nav).
 *
 * The network boundary is stubbed (`cy.intercept`) with an interface-shaped bundle so the ticker
 * board actually renders content-full (an error/blank page would make the check vacuous). SSE is
 * left unstubbed — the static board renders from the REST bundle regardless
 * (`[live-vs-static-isolation]`).
 */

const VIEWPORT = { width: 393, height: 852 };

/**
 * THE WIDER BANDS (added 2026-07-28, tech-debt #3).
 *
 * Until now this suite asserted at 393px and NOTHING else — one `cy.viewport` call in the whole e2e
 * project. That is why `/positions` overflowed at 900px for an unknown length of time without any
 * test noticing: it was found by hand, during an unrelated feature, and recorded in a comment. A
 * comment does not fail a build.
 *
 * `md` (900) and `lg` (1280) are the two bands that were unguarded and that carry the app's densest
 * surfaces — the multi-column positions table and the 11-column scanner. Breakpoints are MUI
 * defaults (sm 600 · md 900 · lg 1200 · xl 1536).
 *
 * ONE SCHEME for the wider bands, deliberately: horizontal overflow is a box-geometry property and
 * dark/light change no widths — same fonts, same padding, same borders. 393px keeps BOTH schemes
 * because that is the band where content is tightest and the existing coverage is worth keeping. If
 * a scheme-dependent width ever appears, this is the assumption to revisit.
 */
const WIDE_VIEWPORTS = [
  { label: 'md 900', width: 900, height: 900 },
  { label: 'lg 1280', width: 1280, height: 900 },
] as const;

/** Interface-shaped bundle (mirrors the suite's shared fixture; enough for a content-full board). */
const bundle = {
  market_state: {
    ticker: 'TSLA',
    price: 250,
    gex_spot: 250,
    timestamp: 1,
    timestamp_iso: '2026-06-23T14:00:00Z',
    call_wall: 260,
    put_wall: 240,
    peak_gex_strike: 255,
    gamma_flip: 248,
    max_pain: 250,
    max_pain_expiration: '2026-06-26',
    net_gex: 1,
    call_gex: 1,
    put_gex: -1,
    total_gex: 1,
    net_dex: 1,
    call_dex: 1,
    put_dex: -1,
    net_vanna: null,
    net_charm: null,
    net_volga: null,
    vwap: 249,
    vwap_upper_2: null,
    vwap_upper_3: null,
    vwap_lower_2: null,
    vwap_lower_3: null,
    dte_min: 7,
    dte_max: 45,
    atm_iv: 45,
    hv_30d: 40,
    iv_hv_ratio: 1.1,
    net_flow: null,
    put_call_ratio: 0.8,
    chain_vol_oi_ratio: 0.5,
    total_volume: 100000,
    vol_oi_unusual_threshold: 1,
    iv_skew: null,
    term_structure: null,
    dealer_flow_projection: null,
  },
  signals: {
    ticker: 'TSLA',
    regime: 'positive_gamma',
    regime_note: null,
    vol_regime: 'neutral',
    distances: {},
    setups: [],
    opportunity_score: 42,
    opportunity_tier: 'watch',
    prime_prompt_eligible: false,
  },
  strike_profile: {
    ticker: 'TSLA',
    spot: 250,
    strikes: [245, 250, 255].map((strike) => ({
      strike,
      net_gex: strike === 250 ? 2 : -1,
      call_gex: 1,
      put_gex: -1,
      call_oi: 10,
      put_oi: 10,
      total_oi: 20,
      net_dex: 0,
      call_dex: 0,
      put_dex: 0,
      volume: 5,
      vol_oi_ratio: 0.25,
    })),
  },
  expirations: [
    { date: '2026-07-17', dte: 24 },
    { date: '2026-08-21', dte: 59 },
  ],
  ai_eval: {
    ready: true,
    reasons: [],
    changed: true,
    state_fingerprint: 'fp-e2e',
    score_threshold: 50,
  },
  meta: {
    served_at: '2026-06-23T14:00:00Z',
    cache: { hit: false, age_seconds: 0, ttl_seconds: 60 },
    freshness: {
      snapshot_iso: '2026-06-23T14:00:00Z',
      data_age_seconds: 10,
      stale: false,
      stale_after_seconds: 600,
    },
  },
  position_eval: null,
};

/** Interface-shaped scan payload — enough for a content-full table/card render at 393px. An error
 *  or blank page would make the overflow assertion vacuous. */
const scan = {
  view: {
    source: 'default',
    authenticated: false,
    name: null,
    symbols: ['SPY', 'QQQ', 'NVDA'],
    sort: { key: 'score', dir: 'desc' },
    density: 'compact',
  },
  rows: ['SPY', 'QQQ', 'NVDA'].map((symbol, i) => ({
    symbol,
    price: 500.25 + i,
    chg_pct: i === 1 ? -1.42 : 1.24,
    score: 82 - i,
    tier: 'prime',
    regime: 'positive_gamma',
    vol_regime: 'iv_rich',
    flip: 495.5,
    dist_to_flip_pct: 1.01,
    call_wall: 510,
    put_wall: 490,
    dist_to_wall_pct: 1.94,
    as_of: Math.floor(Date.now() / 1000) - 42,
    status: 'ok',
  })),
  sweep: {
    updated_at: Math.floor(Date.now() / 1000),
    sweep_last_completed: Math.floor(Date.now() / 1000) - 30,
    universe_size: 3,
  },
};

/** Route → a marker proving the destination page actually rendered before we measure. */
const ROUTES: Array<{ path: string; ready: () => Cypress.Chainable }> = [
  { path: '/', ready: () => cy.get('[data-testid="landing"]') },
  { path: '/ticker/TSLA', ready: () => cy.contains('Call wall') },
  { path: '/positions', ready: () => cy.get('[data-testid="portfolio-panel"]') },
  { path: '/scanner', ready: () => cy.get('[data-testid="scanner-page"]') },
  { path: '/settings', ready: () => cy.get('[data-testid="settings-page"]') },
];

// ---- A SEEDED positions book ---------------------------------------------------------------------
//
// Without this, `/positions` renders its EMPTY state at 393px and the overflow assertion above is
// close to vacuous — it measures a page with no position cards on it. These four records exercise
// the widest content the surface can carry from the durable store: the structure line, the five-item
// footer (Qty · Net debit/credit · Mark · expiry · the RISK SLOT), and the malformed-record row
// whose cells read `Custom` / `unavailable` / `not recorded` / `unnamed shape`.

/** A shipped v2 record. NOTE THE SHAPE: ONE contract per record — see the TRIPWIRE case below. */
function v2Position(over: Record<string, unknown>) {
  return {
    ticker: 'TSLA',
    expiration: '2026-08-21',
    strike: 400,
    right: 'call',
    side: 'long',
    qty: 2,
    entry_mark: 12.4,
    entry_basis: 'user_entered',
    entry_mode: 'manual',
    entry_time: '2026-06-12T15:32:00Z',
    status: 'open',
    schema_version: 2,
    ...over,
  };
}

const SEEDED_POSITIONS = {
  'e2e-1': v2Position({ id: 'e2e-1' }),
  'e2e-2': v2Position({ id: 'e2e-2', ticker: 'NVDA', strike: 170, right: 'put', qty: 1 }),
  'e2e-3': v2Position({ id: 'e2e-3', ticker: 'SPY', strike: 560, qty: 3, entry_mark: 6.1 }),
  // A MALFORMED migrated record — no `right`, no `expiration`. The lift is forbidden from
  // fabricating either, so this row carries the longest withheld/not-recorded copy on the surface.
  'e2e-4': {
    id: 'e2e-4',
    ticker: 'AMD',
    strike: 160,
    side: 'long',
    qty: 2,
    entry_mark: 5.2,
    entry_basis: 'user_entered',
    entry_time: '2026-06-26T15:10:00Z',
    status: 'open',
    schema_version: 2,
  },
};

/**
 * A FOUR-LEG iron condor, written exactly the way the multi-leg entry path writes one (F15): the
 * additive optional `legs` array is authoritative and the flat contract fields beside it are the
 * lossy first-leg summary an older reader would fall back to.
 */
function condorLeg(over: Record<string, unknown>) {
  return {
    kind: 'option',
    ticker: 'META',
    side: 'long',
    qty: 1,
    multiplier: 100,
    entry_price: 12.4,
    entry_basis: 'user_entered',
    expiration: '2026-08-21',
    strike: 400,
    right: 'call',
    ...over,
  };
}

const CONDOR = {
  id: 'e2e-condor',
  ticker: 'META',
  expiration: '2026-08-21',
  strike: 440,
  right: 'call',
  side: 'long',
  qty: 1,
  entry_mark: 12.4,
  entry_basis: 'user_entered',
  entry_mode: 'manual',
  entry_time: '2026-06-12T15:32:00Z',
  status: 'open',
  schema_version: 2,
  legs: [
    condorLeg({ id: 'e2e-condor-l0', strike: 440 }),
    condorLeg({ id: 'e2e-condor-l1', strike: 420, side: 'short', entry_price: 6.1 }),
    condorLeg({ id: 'e2e-condor-l2', strike: 380, right: 'put', side: 'short', entry_price: 5 }),
    condorLeg({ id: 'e2e-condor-l3', strike: 360, right: 'put', entry_price: 2.5 }),
  ],
};

function seedPositions(win: Window, opts: { withCondor?: boolean } = {}) {
  win.localStorage.setItem(
    'convexa.positions.v2',
    JSON.stringify({
      schema_version: 2,
      positions: opts.withCondor ? { ...SEEDED_POSITIONS, 'e2e-condor': CONDOR } : SEEDED_POSITIONS,
      decisions: [],
      // No `customization` — the store seeds its own defaults, which is what a real user has.
    }),
  );
}

function stubNetwork() {
  cy.intercept('GET', '/api/auth/session*', {
    body: { authenticated: false, user: null, google_available: false, settings: null },
  });
  cy.intercept('GET', '/api/ticker/**', { body: bundle });
  cy.intercept('GET', '/api/recommendation/status/**', {
    body: {
      availability: { in_app_enabled: true },
      gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
      cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-24T04:00:00Z' },
    },
  });
  cy.intercept('GET', '/api/personas*', {
    body: [{ id: 'default', name: 'Default (no persona)' }],
  });
  cy.intercept('GET', '/api/contract/**', { statusCode: 404, body: null });
  // scanner: the more specific universe path FIRST, then the poll read.
  cy.intercept('GET', '/api/scan/universe*', {
    body: { symbols: ['SPY', 'QQQ', 'NVDA'], universe_size: 3 },
  });
  cy.intercept('GET', '/api/scan*', { body: scan });
}

// ---- THE md OVERFLOW: FIXED 2026-07-28, AND NOW GATED ------------------------------------------
//
// HISTORY (kept, because the diagnosis is the useful part). `/positions` overflowed at 900px —
// documentElement scrollWidth 958 vs innerWidth 900 — and it did so BYTE-IDENTICALLY with and
// without `positions-legs`' `max_loss` column, so that feature neither caused nor worsened it.
// Phase 3 also measured the TABLE inside its framed host at 900px on an identical four-record seed:
// 998 vs 835 before that feature, 1027 after. Both pre-existing. At the time this comment said "do
// NOT assert either figure here", because the row would have failed on a defect that feature did
// not introduce and the failure would have been misread as a regression from the leg refactor.
//
// ROOT CAUSE, found 2026-07-28 by walking the DOM rather than guessing: a SINGLE element was past
// the edge — `open-entry`, the `+ Open simulated position` CTA, right edge 958 in a 900 viewport.
// Every other element the sweep flagged was an ancestor merely relaying that child's overflow.
// `CustomizationToolbar`'s control row carried `flexWrap: { xs: 'wrap', sm: 'nowrap' }`, so wrapping
// switched OFF at 600px while the row's content measures ~934px — meaning the entire 600–1199px
// band could not wrap and pushed the CTA off-screen. Now `{ xs: 'wrap', lg: 'nowrap' }`: `lg` is the
// first breakpoint whose content box (~1137px) actually fits the row. At 900px the five control
// groups sit on one line and the CTA wraps beneath them, left-aligned; at 1280px it is one row again.
//
// The `md`/`lg` assertions below are what stop this returning. The comment above them was true for
// six days and enforced nothing.
function assertNoHorizontalOverflow() {
  cy.window().then((win) => {
    const doc = win.document.documentElement;
    expect(
      doc.scrollWidth,
      `scrollWidth ${doc.scrollWidth} must fit innerWidth ${win.innerWidth}`,
    ).to.be.at.most(win.innerWidth);
  });
}

for (const scheme of ['dark', 'light'] as const) {
  describe(`393px no-overflow · ${scheme} scheme`, () => {
    beforeEach(() => {
      cy.viewport(VIEWPORT.width, VIEWPORT.height);
      stubNetwork();
    });

    for (const r of ROUTES) {
      it(`${r.path} fits the viewport (scrollWidth <= innerWidth)`, () => {
        cy.visit(r.path, {
          onBeforeLoad(win) {
            // Anonymous client-local theme pref — drives the resolved scheme for the whole app.
            win.localStorage.setItem(
              'convexa.uiprefs.v1',
              JSON.stringify({ schema_version: 1, theme: scheme, default_ticker: null }),
            );
          },
        });
        r.ready();
        assertNoHorizontalOverflow();
      });
    }

    it('/scanner collapses the dense table to cards below sm (no clipped columns at 393px)', () => {
      cy.visit('/scanner', {
        onBeforeLoad(win) {
          win.localStorage.setItem(
            'convexa.uiprefs.v1',
            JSON.stringify({ schema_version: 1, theme: scheme, default_ticker: null }),
          );
        },
      });
      cy.get('[data-testid="scanner-page"]');
      // The 11-column terminal table does not exist at phone width — cards do.
      cy.get('[data-testid="scan-cards"]').should('exist');
      cy.get('[data-testid="scan-table"]').should('not.exist');
      cy.get('[data-testid="scan-card"]').should('have.length', 3);
      // The whole card is the navigation target, and it goes to the Ticker page — nothing else.
      cy.get('[data-testid="scan-card"]').first().should('have.attr', 'href', '/ticker/SPY');
      assertNoHorizontalOverflow();
    });

    // ---- positions-legs V3: the guard must measure a CONTENT-FULL book, not an empty state ------

    it('/positions fits at 393px with a SEEDED book — cards, five-item footers, the risk slot', () => {
      cy.visit('/positions', {
        onBeforeLoad(win) {
          win.localStorage.setItem(
            'convexa.uiprefs.v1',
            JSON.stringify({ schema_version: 1, theme: scheme, default_ticker: null }),
          );
          seedPositions(win);
        },
      });
      cy.get('[data-testid="portfolio-panel"]');
      // VACUITY GUARDS — without these a selector that silently stops matching turns the overflow
      // check into a measurement of an empty page.
      cy.get('[data-testid="position-card"]').should('have.length', 4);
      cy.get('[data-testid="card-footer"]').first().children().should('have.length', 5); // Qty · Net debit/credit · Mark · expiry · the risk slot
      cy.get('[data-testid="card-max-loss"]').should('have.length', 4);
      // The malformed record renders its stated reason, not a blank and not a number.
      cy.contains('[data-testid="card-max-loss"]', 'unnamed shape').should('exist');
      assertNoHorizontalOverflow();
    });

    /**
     * THE 4-LEG-EXPANDED CASE — SPEC §7 invariant 11, AC-30.
     *
     * THIS REPLACES THE V3 TRIPWIRE, WHICH F15 RETIRED BY DOING ITS JOB. That tripwire asserted the
     * v2 record shape (one contract, no `legs`) made a multi-leg position UNREPRESENTABLE in the
     * seedable store, and said in as many words that whoever made it representable must replace it
     * with the real assertion. F15 added the additive optional `legs` array to the durable record —
     * the multi-leg entry path ships before the v3 cutover, and flattening a spread into the flat
     * contract fields would destroy three of its four legs — so the store can now hold one and the
     * case below is buildable. The tripwire's own replacement text is carried out verbatim:
     * `aria-expanded="true"` is asserted BEFORE measuring, because without it a selector that stops
     * matching makes the overflow check vacuous, which is the exact failure this case closes.
     *
     * The seeded record is a real four-leg iron condor, written the way the entry path writes one.
     */
    it('a 4-leg disclosure EXPANDED at 393px still does not overflow', () => {
      cy.visit('/positions', {
        onBeforeLoad(win) {
          win.localStorage.setItem(
            'convexa.uiprefs.v1',
            JSON.stringify({ schema_version: 1, theme: scheme, default_ticker: null }),
          );
          seedPositions(win, { withCondor: true });
        },
      });
      cy.get('[data-testid="position-card"]').should('have.length', 5);
      // VACUITY GUARD 1 — the multi-leg record really did survive the round-trip as four legs.
      cy.get('[data-testid="leg-disclosure-toggle"]').should('have.length', 1);
      cy.get('[data-testid="leg-disclosure-toggle"]').click();
      // VACUITY GUARD 2 — the expansion actually happened, and it really is four leg lines.
      cy.get('[aria-expanded="true"]').should('exist');
      cy.get('[data-testid="leg-line"]').should('have.length', 4);
      assertNoHorizontalOverflow();
    });

    it('below md the nav collapses: hamburger present, no inline nav row', () => {
      cy.visit('/scanner', {
        onBeforeLoad(win) {
          win.localStorage.setItem(
            'convexa.uiprefs.v1',
            JSON.stringify({ schema_version: 1, theme: scheme, default_ticker: null }),
          );
        },
      });
      cy.get('[data-testid="scanner-page"]');
      cy.get('[data-testid="nav-menu-button"]').should('be.visible');
      cy.get('[data-testid="nav-ticker"]').should('not.be.visible'); // inline nav hidden below md
      // The drawer carries ALL four entries (incl. Blog, which previously clipped off-screen).
      cy.get('[data-testid="nav-menu-button"]').click();
      for (const e of ['ticker', 'positions', 'scanner', 'blog']) {
        cy.get(`[data-testid="nav-drawer-${e}"]`).should('be.visible');
      }
    });
  });
}

// ---- THE WIDE BANDS — md and lg (tech-debt #3) ---------------------------------------------------
//
// The same `scrollWidth <= innerWidth` gate as above, at the two widths that were previously
// unguarded. `/positions` is SEEDED here for the same reason it is seeded at 393px: at these widths
// it renders the multi-column TABLE, and an empty book would make the measurement close to vacuous —
// it is the content-full table that overflows, not the empty state.
for (const vp of WIDE_VIEWPORTS) {
  describe(`${vp.label} no-overflow · dark scheme`, () => {
    beforeEach(() => {
      cy.viewport(vp.width, vp.height);
      stubNetwork();
    });

    for (const r of ROUTES) {
      it(`${r.path} fits ${vp.width}px (scrollWidth <= innerWidth)`, () => {
        cy.visit(r.path, {
          onBeforeLoad(win) {
            win.localStorage.setItem(
              'convexa.uiprefs.v1',
              JSON.stringify({ schema_version: 1, theme: 'dark', default_ticker: null }),
            );
            if (r.path === '/positions') seedPositions(win, { withCondor: true });
          },
        });
        r.ready();
        // VACUITY GUARD for the seeded route: prove the book actually rendered before measuring.
        if (r.path === '/positions') cy.get('[data-testid="portfolio-panel"]').should('exist');
        assertNoHorizontalOverflow();
      });
    }
  });
}
