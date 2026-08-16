import { expect, test, type Page } from '@playwright/test';

/**
 * NO-HORIZONTAL-OVERFLOW enforcement (redesign-stage-0 FRONTEND_EXECUTION_CONTRACT §8.1;
 * convexa-design skill rule 9 — `scrollWidth 580 vs 393` was the documented failure).
 * Silently-regressing: ANY future component can break it, so it is a re-runnable real-browser test,
 * not a one-off review.
 *
 * PORTED FROM `mobile-no-overflow.cy.ts` (2026-07-28), assertion-for-assertion. Renamed because the
 * suite stopped being mobile-only when md/lg were added — the old name had become a lie.
 *
 * On every trader route:
 *   `document.documentElement.scrollWidth <= window.innerWidth`
 * at 393×852 in BOTH colour schemes, and at md (900) + lg (1280) in one scheme (see WIDE_VIEWPORTS),
 * plus the mobile-nav presence check (the hamburger renders below md; the drawer carries the nav).
 *
 * The network boundary is stubbed so the ticker board actually renders content-full (an error/blank
 * page would make the check vacuous). SSE is left unstubbed — the static board renders from the REST
 * bundle regardless (`[live-vs-static-isolation]`).
 *
 * TRANSLATION NOTES, so a reader can audit the port rather than trust it:
 *  - `cy.intercept` → ONE `page.route('**\/api/**')` handler with explicit URL branching. Playwright
 *    resolves overlapping route patterns by registration order, and `/api/scan/universe` vs
 *    `/api/scan` overlap; a single handler removes the ordering subtlety entirely.
 *  - `cy.visit(path, { onBeforeLoad(win) { win.localStorage… } })` → `page.addInitScript`, which runs
 *    before any page script on every navigation — the same "seed before the app reads it" guarantee.
 *  - `.should('have.length', n)` → `toHaveCount(n)`; `.should('exist')` → `toBeAttached()`;
 *    `.should('not.exist')` → `toHaveCount(0)`; `.should('not.be.visible')` → `toBeHidden()`.
 *  - Cypress retried its assertions implicitly; Playwright's `expect` is web-first and auto-retries,
 *    so no explicit waits were added — and none should be.
 */

const VIEWPORT = { width: 393, height: 852 };

/**
 * THE WIDER BANDS (tech-debt #3). Until 2026-07-28 this suite asserted at 393px and NOTHING else,
 * which is why `/positions` overflowed at 900px unnoticed — found by hand, during an unrelated
 * feature, and recorded in a comment. A comment does not fail a build.
 *
 * `md` (900) and `lg` (1280) carry the app's densest surfaces — the multi-column positions table and
 * the 11-column scanner. Breakpoints are MUI defaults (sm 600 · md 900 · lg 1200 · xl 1536).
 *
 * ONE SCHEME for the wider bands, deliberately: horizontal overflow is box geometry and dark/light
 * change no widths — same fonts, padding, borders. 393px keeps BOTH schemes because that is where
 * content is tightest. If a scheme-dependent width ever appears, this is the assumption to revisit.
 */
const WIDE_VIEWPORTS = [
  { label: 'md 900', width: 900, height: 900 },
  { label: 'lg 1280', width: 1280, height: 900 },
] as const;

/** Interface-shaped bundle (enough for a content-full board). */
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

/** Interface-shaped scan payload — enough for a content-full table/card render. */
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

/**
 * tradeable-rec-inputs — a produced TRADE rec, deliberately OVER the cap (the longest cap-annotation
 * line) with a cited contract (the longest fact line) and a full risk block (the provenance chip),
 * so the 393px measurement below actually exercises this feature's densest new content.
 */
const producedRecFixture = {
  status: 'produced',
  persona: { id: null, name: 'Default (no persona)' },
  as_of: '2026-06-23T14:00:00Z',
  pinned_fingerprint: 'fp-e2e',
  stale_born: false,
  strategy: {
    decision: 'trade',
    bias: 'long',
    structure: 'long call',
    strikes: [260],
    expiration: '2026-07-18',
    entry_trigger: 'break and hold above the 260 call wall',
    invalidation_level: 242,
    max_risk: '$900 (roughly 1.5% of a $60,000 account, per the stated risk tolerance)',
    position_size: '2 contracts',
    exit_plan: { target: 12.5, stop: 6 },
    time_horizon: '5-10 trading days',
    confidence: 'medium',
    rationale: 'magnet at 255, flip at 248; IV/HV cheap.',
    right: 'call',
  },
  unavailable_reason: null,
  gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
  cap: { over_limit: false, remaining_today: 49, resets_at: '2026-06-24T04:00:00Z' },
  key_source: 'own_key',
  sent: {
    budget: 'prompt',
    candidates: {
      ticker: 'TSLA',
      state: 'ok',
      as_of: '2026-06-23T14:00:00Z',
      snapshot_age_seconds: 30,
      session_basis: 'after_close',
      quote_age: 'unknown',
      anchor_spot: 250,
      anchor_basis: 'gex_spot',
      band_pct: 15,
      budget: 'prompt',
      sent_to_model: true,
      caps: { tenors: 2, rights: 2, strikes_per_tenor_right: 5, max_records: 20, max_bytes: 8000 },
      included: { contracts: 4, expirations: ['2026-07-18'], expiration_count: 1 },
      omitted: {
        total: 3,
        expirations_omitted_by_cap: 0,
        by_reason: {
          outside_window: 0,
          outside_band: 3,
          no_interest: 0,
          expiration_cap: 0,
          strike_cap: 0,
        },
      },
      liquidity: {
        quoted: 4,
        no_two_sided_quote: 0,
        atm_relative_spread_band: 'moderate',
        wide_quotes: false,
        wide_quote_threshold_pct: 15,
      },
      contracts: [
        {
          expiration: '2026-07-18',
          dte: 25,
          strike: 260,
          right: 'call',
          distance_pct: 4,
          quote_presence: 'quoted',
          bid: 4.8,
          ask: 5.2,
          mid: 5,
          spread_abs: 0.4,
          spread_pct_of_mid: 8,
          open_interest: 500,
          volume: 120,
          iv_state: 'priced',
          iv: 0.32,
          greeks: { delta: 0.5, gamma: 0.02, theta: -0.05, vega: 0.12 },
        },
      ],
    },
    straddle_move_tenors: ['2026-07-18'],
    risk_inputs: {
      state: 'set',
      account_size: 60000,
      per_trade_cap: { value: 1.5, unit: 'percent' },
      effective_dollar_cap: {
        state: 'derived',
        value: 900,
        not_derivable_reason: null,
        derived_from: { account_size: 60000, cap_value: 1.5, cap_unit: 'percent' },
      },
      storage_available: true,
      updated_at: 1_700_000_000_000,
    },
    risk_inputs_digest: 'set:60000:1.5percent',
    open_positions: {
      source: 'simulated',
      state: 'none_open',
      this_underlying: null,
      portfolio: null,
    },
  },
  cap_check: {
    verdict: 'above',
    effective_dollar_cap: 900,
    cap_not_derivable_reason: null,
    parsed_risk_dollars: 950,
    model_max_risk_text: '$950 (a hair over the stated 1.5% cap)',
    risk_refusal: null,
  },
  field_reasons: {
    max_risk: null,
    position_size: null,
    exit_target: null,
    exit_stop: null,
    invalidation_level: null,
  },
  // ai-rec-grounding — the DENSEST shape (AC-60/F13): card `some_traced` (the longest card line),
  // stop `traced/near` on `vwap_lower_3` (the longest anchor label), target `traced/inside_range`
  // with a full date and two 3-digit endpoints, invalidation `not_checkable/no_named_level` (its only
  // legal reason).
  grounding: {
    card: 'some_traced',
    counts: { checked: 4, traced: 2, untraced: 0, not_checkable: 2 },
    tolerance_pct: 0.1,
    fields: {
      exit_stop: {
        state: 'traced',
        basis: 'near',
        anchor_kind: 'vwap_lower_3',
        anchor_value: 231.5,
        range_low: null,
        range_high: null,
        expiration: null,
        not_checkable_reason: null,
      },
      exit_target: {
        state: 'traced',
        basis: 'inside_range',
        anchor_kind: null,
        anchor_value: null,
        range_low: 240.0,
        range_high: 260.0,
        expiration: '2026-07-18',
        not_checkable_reason: null,
      },
      invalidation_level: {
        state: 'not_checkable',
        basis: null,
        anchor_kind: null,
        anchor_value: null,
        range_low: null,
        range_high: null,
        expiration: null,
        not_checkable_reason: 'no_named_level',
      },
      max_risk: {
        state: 'not_checkable',
        basis: null,
        anchor_kind: null,
        anchor_value: null,
        range_low: null,
        range_high: null,
        expiration: null,
        not_checkable_reason: 'structurally_unchecked',
      },
      position_size: {
        state: 'not_checkable',
        basis: null,
        anchor_kind: null,
        anchor_value: null,
        range_low: null,
        range_high: null,
        expiration: null,
        not_checkable_reason: 'structurally_unchecked',
      },
    },
  },
  cited_contract: {
    state: 'cited',
    contract: {
      expiration: '2026-07-18',
      dte: 25,
      strike: 260,
      right: 'call',
      distance_pct: 4,
      quote_presence: 'quoted',
      bid: 4.8,
      ask: 5.2,
      mid: 5,
      spread_abs: 0.4,
      spread_pct_of_mid: 8,
      open_interest: 500,
      volume: 120,
      iv_state: 'priced',
      iv: 0.32,
      greeks: { delta: 0.5, gamma: 0.02, theta: -0.05, vega: 0.12 },
    },
    legs: [],
  },
};

/** Route → a marker proving the destination page actually rendered before we measure. */
const ROUTES: Array<{ path: string; ready: (page: Page) => Promise<void> }> = [
  { path: '/', ready: async (p) => void (await expect(p.getByTestId('landing')).toBeAttached()) },
  {
    path: '/ticker/TSLA',
    ready: async (p) => void (await expect(p.getByText('Call wall').first()).toBeAttached()),
  },
  {
    path: '/positions',
    ready: async (p) => void (await expect(p.getByTestId('portfolio-panel')).toBeAttached()),
  },
  {
    path: '/scanner',
    ready: async (p) => void (await expect(p.getByTestId('scanner-page')).toBeAttached()),
  },
  {
    path: '/settings',
    ready: async (p) => void (await expect(p.getByTestId('settings-page')).toBeAttached()),
  },
];

// ---- A SEEDED positions book ---------------------------------------------------------------------
//
// Without this, `/positions` renders its EMPTY state and the overflow assertion is close to vacuous —
// it measures a page with no positions on it. These four records exercise the widest content the
// surface can carry from the durable store: the structure line, the five-item footer (Qty · Net
// debit/credit · Mark · expiry · the RISK SLOT), and the malformed-record row whose cells read
// `Custom` / `unavailable` / `not recorded` / `unnamed shape`.

/** A shipped v2 record. NOTE THE SHAPE: ONE contract per record. */
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

/**
 * Seed localStorage BEFORE any page script runs — the `onBeforeLoad` equivalent. `addInitScript`
 * re-applies on every navigation in the page's lifetime, which is what the seeded routes need.
 */
async function seed(
  page: Page,
  opts: { scheme: 'dark' | 'light'; positions?: 'none' | 'book' | 'book+condor' },
) {
  const positions =
    opts.positions === 'book'
      ? SEEDED_POSITIONS
      : opts.positions === 'book+condor'
        ? { ...SEEDED_POSITIONS, 'e2e-condor': CONDOR }
        : null;

  await page.addInitScript(
    ({ scheme, positions }) => {
      window.localStorage.setItem(
        'convexa.uiprefs.v1',
        JSON.stringify({ schema_version: 1, theme: scheme, default_ticker: null }),
      );
      if (positions) {
        window.localStorage.setItem(
          'convexa.positions.v2',
          // No `customization` — the store seeds its own defaults, which is what a real user has.
          JSON.stringify({ schema_version: 2, positions, decisions: [] }),
        );
      }
    },
    { scheme: opts.scheme, positions },
  );
}

/** ONE handler, explicit branching — see the translation note at the top of the file. */
async function stubNetwork(page: Page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.startsWith('/api/auth/session')) {
      // Owner lockdown (2026-08-06): /positions and /scanner sit behind RequireAuth, so these
      // layout/nav walks must be SIGNED IN — the wall is not what they are testing.
      return route.fulfill({
        json: {
          authenticated: true,
          user: {
            id: 'e2e',
            email: 'e2e@test.invalid',
            display_name: null,
            auth_methods: ['password'],
          },
          google_available: false,
          settings: { active_persona_id: null, default_ticker: null, theme: 'dark' },
        },
      });
    }
    if (path === '/api/book' && route.request().method() === 'GET') {
      return route.fulfill({ json: { blob: {}, updated_at: 0 } });
    }
    if (path === '/api/book' && route.request().method() === 'PUT') {
      return route.fulfill({ status: 204, body: '' });
    }
    if (path.startsWith('/api/ticker/')) return route.fulfill({ json: bundle });
    if (path === '/api/stream/TSLA' && route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' });
    }
    if (path.startsWith('/api/recommendation/status/')) {
      return route.fulfill({
        json: {
          availability: { in_app_enabled: true },
          gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
          cap: { over_limit: false, remaining_today: 50, resets_at: '2026-06-24T04:00:00Z' },
        },
      });
    }
    // tradeable-rec-inputs — a produced rec with the richest new content (over-cap annotation, a
    // cited contract with a long fact line, the provenance chip) so the 393px check is not vacuous
    // for the surfaces this feature added.
    if (path.startsWith('/api/recommendation/') && route.request().method() === 'POST') {
      return route.fulfill({ json: producedRecFixture });
    }
    if (path.startsWith('/api/personas')) {
      return route.fulfill({ json: [{ id: 'default', name: 'Default (no persona)' }] });
    }
    if (path.startsWith('/api/contract/')) return route.fulfill({ status: 404, body: '' });
    if (path.startsWith('/api/scan/universe')) {
      return route.fulfill({ json: { symbols: ['SPY', 'QQQ', 'NVDA'], universe_size: 3 } });
    }
    if (path.startsWith('/api/scan')) return route.fulfill({ json: scan });

    // Other API routes (including non-TSLA SSE) are left to the network, exactly as the Cypress
    // suite did; only the static TSLA board stream is explicitly fixture-owned here.
    return route.fallback();
  });
}

async function assertNoHorizontalOverflow(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    scrollWidth,
    `scrollWidth ${scrollWidth} must fit innerWidth ${innerWidth}`,
  ).toBeLessThanOrEqual(innerWidth);
}

// ---- AI recommendation decision card -----------------------------------------------------------
// These checks deliberately wait for the produced fixture and assert card/detail nodes before any
// geometry assertion; an error page or an empty Ticker cannot satisfy the group.
async function openProducedRecommendation(page: Page) {
  await page.goto('/ticker/TSLA');
  await expect(page.getByText('Call wall').first()).toBeAttached();
  await page.getByRole('button', { name: 'Analyze current snapshot' }).click();
  await expect(page.getByTestId('ai-rec-decision-card')).toBeAttached();
  await expect(page.getByTestId('decision-verdict')).toBeAttached();
  await expect(page.getByTestId('decision-grid')).toBeAttached();
}

test.describe('AI recommendation decision card', () => {
  for (const scheme of ['dark', 'light'] as const) {
    test(`393x852 ${scheme}: analysis is a single full-width sheet without page overflow`, async ({
      page,
    }) => {
      test.setTimeout(30_000);
      await page.setViewportSize({ width: 393, height: 852 });
      await stubNetwork(page);
      await seed(page, { scheme });
      await openProducedRecommendation(page);
      const opener = page.getByRole('button', { name: 'Full analysis & data' });
      await expect(opener).toBeVisible();
      await opener.click();
      const dialog = page.getByRole('dialog', { name: 'Full analysis & data · TSLA' });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole('heading', { name: 'Full analysis & data · TSLA' }),
      ).toHaveCount(1);
      await expect(dialog.getByRole('button', { name: 'Close analysis' })).toHaveCount(1);
      const content = dialog.getByTestId('analysis-content');
      await expect(content).toHaveCount(1);
      await expect(page.locator('.MuiDrawer-paper')).toHaveCSS('overflow', 'hidden');
      const scrollRegions = await dialog.locator('*').evaluateAll((nodes) =>
        nodes
          .filter((node) => {
            const style = getComputedStyle(node);
            return /auto|scroll/.test(style.overflowY);
          })
          .map((node) => (node as HTMLElement).dataset.testid ?? node.className)
          .filter(Boolean),
      );
      expect(scrollRegions).toEqual(['analysis-content']);
      const geometry = await page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        viewport: window.innerWidth,
      }));
      expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewport);
      expect(geometry.bodyWidth).toBeLessThanOrEqual(geometry.viewport);
      const sheetWidth = await dialog.evaluate(
        (node) => (node as HTMLElement).getBoundingClientRect().width,
      );
      expect(sheetWidth).toBeLessThanOrEqual(393.5);
      const scroll = await content.evaluate((node) => ({
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight,
      }));
      expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
      const cardMobile = await page.getByTestId('ai-rec-decision-card').evaluate((node) => ({
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
        right: (node as HTMLElement).getBoundingClientRect().right,
      }));
      expect(cardMobile.scrollWidth).toBeLessThanOrEqual(393);
      expect(cardMobile.clientWidth).toBeLessThanOrEqual(393);
      expect(cardMobile.right).toBeLessThanOrEqual(393);
    });
  }

  for (const scheme of ['dark', 'light'] as const) {
    test(`1440x900 ${scheme}: decision hierarchy is visible while ticker context remains visible`, async ({
      page,
    }) => {
      test.setTimeout(30_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      await stubNetwork(page);
      await seed(page, { scheme });
      await openProducedRecommendation(page);
      await expect(page.getByTestId('decision-verdict')).toBeVisible();
      await expect(page.getByTestId('decision-grid')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Review simulated trade' })).toBeVisible();
      const card = page.getByTestId('ai-rec-decision-card');
      await expect(card).toBeVisible();
      expect(await card.evaluate((node) => getComputedStyle(node).overflowY)).not.toMatch(
        /auto|scroll/,
      );
      const wideGeometry = await page.evaluate(() => ({
        html: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        viewport: window.innerWidth,
      }));
      expect(wideGeometry.html).toBeLessThanOrEqual(wideGeometry.viewport);
      expect(wideGeometry.body).toBeLessThanOrEqual(wideGeometry.viewport);
      const cardGeometry = await card.evaluate((node) => ({
        width: (node as HTMLElement).getBoundingClientRect().right,
        viewport: window.innerWidth,
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight,
      }));
      expect(cardGeometry.width).toBeLessThanOrEqual(cardGeometry.viewport);
      expect(cardGeometry.scrollHeight).toBe(cardGeometry.clientHeight);
      await page.getByRole('button', { name: 'Full analysis & data' }).click();
      const dialog = page.getByRole('dialog', { name: 'Full analysis & data · TSLA' });
      await expect(dialog).toBeVisible();
      const drawerWidth = await dialog.evaluate(
        (node) => (node as HTMLElement).getBoundingClientRect().width,
      );
      expect(drawerWidth).toBeLessThan(1440 * 0.6);
      await expect(page.getByText('Call wall').first()).toBeVisible();
    });
  }

  test('keyboard focus enters, contains, escapes, and returns to the analysis opener', async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await page.setViewportSize({ width: 393, height: 852 });
    await stubNetwork(page);
    await seed(page, { scheme: 'dark' });
    await openProducedRecommendation(page);
    const opener = page.getByRole('button', { name: 'Full analysis & data' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Full analysis & data · TSLA' });
    const close = dialog.getByRole('button', { name: 'Close analysis' });
    await expect(close).toBeFocused();
    const focusableCount = await dialog.evaluate(
      (node) =>
        node.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ).length,
    );
    expect(focusableCount).toBeGreaterThan(1);
    for (let index = 1; index < focusableCount; index += 1) await page.keyboard.press('Tab');
    const last = await dialog.evaluate(
      (node, count) =>
        node
          .querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          )
          .item(count - 1) === document.activeElement,
      focusableCount,
    );
    expect(last).toBe(true);
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    const wrappedLast = await dialog.evaluate(
      (node, count) =>
        node
          .querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          )
          .item(count - 1) === document.activeElement,
      focusableCount,
    );
    expect(wrappedLast).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
});

for (const scheme of ['dark', 'light'] as const) {
  test.describe(`393px no-overflow · ${scheme} scheme`, () => {
    test.use({ viewport: VIEWPORT });

    test.beforeEach(async ({ page }) => {
      await stubNetwork(page);
    });

    for (const r of ROUTES) {
      test(`${r.path} fits the viewport (scrollWidth <= innerWidth)`, async ({ page }) => {
        await seed(page, { scheme });
        await page.goto(r.path);
        await r.ready(page);
        await assertNoHorizontalOverflow(page);
      });
    }

    test('tradeable-rec-inputs — a produced, OVER-CAP rec with a cited contract fits at 393px', async ({
      page,
    }) => {
      await seed(page, { scheme });
      await page.goto('/ticker/TSLA');
      await expect(page.getByText('Call wall').first()).toBeAttached();
      await page.getByRole('button', { name: 'Analyze current snapshot' }).click();
      // VACUITY GUARD — the densest new content really did render before measuring.
      await expect(page.getByTestId('cap-annotation')).toBeAttached();
      await expect(page.getByTestId('ai-rec-provenance-chip')).toBeAttached();
      await page.getByRole('button', { name: 'Full analysis & data' }).click();
      await expect(page.getByTestId('cited-contract-line')).toBeAttached();
      await assertNoHorizontalOverflow(page);
    });

    test('ai-rec-grounding — the densest grounding card fits at 393px', async ({ page }) => {
      await seed(page, { scheme });
      await page.goto('/ticker/TSLA');
      await expect(page.getByText('Call wall').first()).toBeAttached();
      await page.getByRole('button', { name: 'Analyze current snapshot' }).click();
      // VACUITY GUARD — the new content really did render before measuring.
      await expect(page.getByTestId('grounding-card-line')).toBeAttached();
      await page.getByRole('button', { name: 'Full analysis & data' }).click();
      const analysis = page.getByRole('dialog', { name: 'Full analysis & data · TSLA' });
      await expect(analysis.getByTestId('clause-stop')).toHaveCount(1);
      await expect(analysis.getByTestId('clause-target')).toHaveCount(1);
      await assertNoHorizontalOverflow(page);
    });

    test('tradeable-rec-inputs — the Settings Risk inputs panel fits at 393px', async ({
      page,
    }) => {
      await seed(page, { scheme });
      await page.goto('/settings');
      await expect(page.getByTestId('settings-page')).toBeAttached();
      await expect(page.getByTestId('settings-risk-inputs-panel')).toBeAttached();
      await assertNoHorizontalOverflow(page);
    });

    test('/scanner collapses the dense table to cards below sm (no clipped columns at 393px)', async ({
      page,
    }) => {
      await seed(page, { scheme });
      await page.goto('/scanner');
      await expect(page.getByTestId('scanner-page')).toBeAttached();
      // The 11-column terminal table does not exist at phone width — cards do.
      await expect(page.getByTestId('scan-cards')).toBeAttached();
      await expect(page.getByTestId('scan-table')).toHaveCount(0);
      await expect(page.getByTestId('scan-card')).toHaveCount(3);
      // The whole card is the navigation target, and it goes to the Ticker page — nothing else.
      await expect(page.getByTestId('scan-card').first()).toHaveAttribute('href', '/ticker/SPY');
      await assertNoHorizontalOverflow(page);
    });

    test('/positions fits at 393px with a SEEDED book — cards, five-item footers, the risk slot', async ({
      page,
    }) => {
      await seed(page, { scheme, positions: 'book' });
      await page.goto('/positions');
      await expect(page.getByTestId('portfolio-panel')).toBeAttached();
      // VACUITY GUARDS — without these a selector that silently stops matching turns the overflow
      // check into a measurement of an empty page.
      await expect(page.getByTestId('position-card')).toHaveCount(4);
      // Qty · Net debit/credit · Mark · expiry · the risk slot
      await expect(page.getByTestId('card-footer').first().locator('> *')).toHaveCount(5);
      await expect(page.getByTestId('card-max-loss')).toHaveCount(4);
      // The malformed record renders its stated reason, not a blank and not a number.
      await expect(
        page.getByTestId('card-max-loss').filter({ hasText: 'unnamed shape' }).first(),
      ).toBeAttached();
      await assertNoHorizontalOverflow(page);
    });

    /**
     * THE 4-LEG-EXPANDED CASE — SPEC §7 invariant 11, AC-30. `aria-expanded="true"` is asserted
     * BEFORE measuring, because without it a selector that stops matching makes the overflow check
     * vacuous — the exact failure this case closes.
     */
    test('a 4-leg disclosure EXPANDED at 393px still does not overflow', async ({ page }) => {
      await seed(page, { scheme, positions: 'book+condor' });
      await page.goto('/positions');
      await expect(page.getByTestId('position-card')).toHaveCount(5);
      // VACUITY GUARD 1 — the multi-leg record really did survive the round-trip as four legs.
      await expect(page.getByTestId('leg-disclosure-toggle')).toHaveCount(1);
      await page.getByTestId('leg-disclosure-toggle').click();
      // VACUITY GUARD 2 — the expansion actually happened, and it really is four leg lines.
      await expect(page.locator('[aria-expanded="true"]').first()).toBeAttached();
      await expect(page.getByTestId('leg-line')).toHaveCount(4);
      await assertNoHorizontalOverflow(page);
    });

    test('below md the nav collapses: hamburger present, no inline nav row', async ({ page }) => {
      await seed(page, { scheme });
      await page.goto('/scanner');
      await expect(page.getByTestId('scanner-page')).toBeAttached();
      await expect(page.getByTestId('nav-menu-button')).toBeVisible();
      await expect(page.getByTestId('nav-ticker')).toBeHidden(); // inline nav hidden below md
      // The drawer carries ALL four entries (incl. Blog, which previously clipped off-screen).
      await page.getByTestId('nav-menu-button').click();
      for (const e of ['ticker', 'positions', 'scanner', 'blog']) {
        await expect(page.getByTestId(`nav-drawer-${e}`)).toBeVisible();
      }
    });
  });
}

// ---- THE WIDE BANDS — md and lg ------------------------------------------------------------------
//
// `/positions` is SEEDED here for the same reason it is seeded at 393px: at these widths it renders
// the multi-column TABLE, and an empty book would make the measurement close to vacuous — it is the
// content-full table that overflows, not the empty state.
//
// HISTORY worth keeping: /positions overflowed at 900px (documentElement scrollWidth 958 vs
// innerWidth 900) because `CustomizationToolbar`'s control row carried
// `flexWrap: { xs: 'wrap', sm: 'nowrap' }` — wrapping switched OFF at 600px while the row's content
// measures ~934px, so the ENTIRE 600–1199px band could not wrap and pushed the `open-entry` CTA
// off-screen. Fixed by wrapping until `lg`. These assertions are what stop it returning.
for (const vp of WIDE_VIEWPORTS) {
  test.describe(`${vp.label} no-overflow · dark scheme`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await stubNetwork(page);
    });

    for (const r of ROUTES) {
      test(`${r.path} fits ${vp.width}px (scrollWidth <= innerWidth)`, async ({ page }) => {
        await seed(page, {
          scheme: 'dark',
          positions: r.path === '/positions' ? 'book+condor' : 'none',
        });
        await page.goto(r.path);
        await r.ready(page);
        // VACUITY GUARD for the seeded route: prove the book actually rendered before measuring.
        if (r.path === '/positions') {
          await expect(page.getByTestId('portfolio-panel')).toBeAttached();
        }
        await assertNoHorizontalOverflow(page);
      });
    }
  });
}
