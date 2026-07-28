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

function seedPositions(win: Window) {
  win.localStorage.setItem(
    'convexa.positions.v2',
    JSON.stringify({
      schema_version: 2,
      positions: SEEDED_POSITIONS,
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

// PRE-EXISTING, OUT OF SCOPE (logged as a standing item, build phase 2; RE-MEASURED build phase 3):
// `/positions` overflows at 900px — documentElement scrollWidth 965 vs innerWidth 900 —
// BYTE-IDENTICALLY with and without the `max_loss` column, and byte-identically before and after
// the phase-3 render change. i.e. this feature neither causes nor worsens the PAGE overflow. The
// shipped e2e only ever asserted at 393px, which is why the md boundary went uncovered.
//
// Phase 3 additionally measured the TABLE inside its framed host at 900px, with an identical
// four-record seed on both builds:
//   before phase 3 : table scrollWidth  998 vs host clientWidth 835  (already over by 163px)
//   after  phase 3 : table scrollWidth 1027 vs host clientWidth 835  (over by 192px)
// So the md-band table overflow is ALSO pre-existing — phase 2's note that "without the column it
// fits" at 900px does not hold for a content-full book — and phase 3 adds 29px of it through the
// wider `Net entry` copy (`$1830 debit` vs `$8.40`). The `max_loss` column is NOT rendered at md.
//
// Do NOT add an assertion for either figure here: this row would then fail on a defect this feature
// did not introduce, and the failure would be misread as a regression from the leg refactor. The
// 393px guard below is the one that gates.
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
     * THE 4-LEG-EXPANDED CASE IS BLOCKED, AND THIS IS THE TRIPWIRE THAT SAYS SO.
     *
     * SPEC §7 invariant 11 requires the 393px guard to EXPAND A LEG BLOCK before asserting, because
     * the shipped guard only ever measured the cold render. That case cannot be built yet: the
     * durable store is still `convexa.positions.v2`, whose record shape is ONE CONTRACT
     * (`ticker/expiration/strike/right`), and the one lift function maps each record to exactly ONE
     * leg. A multi-leg position is therefore UNREPRESENTABLE in the seedable store until the
     * multi-leg entry path (F15) or the v3 cutover (F18) lands. The disclosure control only exists
     * for `legs.length > 1`, so there is nothing to click.
     *
     * This is written as a live TRIPWIRE rather than a `.skip` so the case cannot rot silently: the
     * moment the store can hold a multi-leg position, THIS TEST GOES RED and whoever lands that
     * change must replace it with the real assertion, which is:
     *
     *   cy.get('[data-testid="position-card"]').first().find('button[aria-expanded]').click();
     *   cy.get('[aria-expanded="true"]').should('exist');   // the expansion actually happened
     *   assertNoHorizontalOverflow();
     *
     * (The `aria-expanded="true"` assertion is not decoration — without it a selector that stops
     * matching makes the overflow check vacuous, which is the exact failure this extension closes.)
     */
    it('TRIPWIRE — a multi-leg position is not yet representable in the v2 store, so no disclosure exists', () => {
      cy.visit('/positions', {
        onBeforeLoad(win) {
          win.localStorage.setItem(
            'convexa.uiprefs.v1',
            JSON.stringify({ schema_version: 1, theme: scheme, default_ticker: null }),
          );
          seedPositions(win);
        },
      });
      cy.get('[data-testid="position-card"]').should('have.length', 4);
      // The v2 record shape itself: one contract, no `legs` array anywhere to seed.
      cy.window().then((win) => {
        const blob = JSON.parse(win.localStorage.getItem('convexa.positions.v2') as string);
        const records = Object.values(blob.positions) as Record<string, unknown>[];
        expect(records).to.have.length(4);
        for (const r of records) expect(r).to.not.have.property('legs');
      });
      // …and so the leg disclosure — the thing the expanded case needs — cannot appear.
      cy.get('[data-testid="leg-disclosure-toggle"]').should('not.exist');
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
