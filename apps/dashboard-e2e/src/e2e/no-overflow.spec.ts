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
  // (v2) 834 ADDED (canon rule 17 — the design renders the phone at 390, the narrower of 390/393
  // is the binding floor; 834 is the shipped `tablet`-band check). 900 is KEPT — the MUI `md` band
  // is still where the tables are densest (SPEC §2.2's declared bands do not remove any MUI key).
  { label: 'tablet 834', width: 834, height: 1112 },
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
    ready: async (p) => {
      // (v2, curvature-v2-desk-and-read FE-8) Re-anchored: `Call wall` moved from the deleted
      // twelve-tile grid (the old dealer positioning widget) to the level ladder. The words are
      // UNCHANGED by criterion 2 — this anchor is on the ladder's own testid so a future copy
      // change reds ONE assertion instead of ~12 e2e cases at every width.
      await expect(p.getByTestId('level-ladder')).toBeAttached();
      await expect(p.getByText('Call wall').first()).toBeAttached();
    },
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
    ready: async (p) => {
      await expect(p.getByTestId('settings-page')).toBeAttached();
      // (FE-13, criterion 37A — OWNER D-B) — all five sections reachable in the shipped single
      // 640px column at every checked width this ROUTES entry runs under (393 dark, 393 light,
      // and the wide bands below); no rail, no tabs (`council/decisions.md` D-B: OUT → phase 4).
      for (const testId of [
        'settings-account-panel',
        'settings-preferences-panel',
        'settings-risk-inputs-panel',
        'settings-ai-key-panel',
        'settings-brokerage-panel',
      ] as const) {
        await expect(p.getByTestId(testId)).toBeAttached();
      }
    },
  },
  {
    // (v2) `/alerts` joins the top-four nav this phase (SPEC §1) — AC-38 covers it at every width.
    path: '/alerts',
    ready: async (p) => void (await expect(p.getByTestId('alerts-page')).toBeAttached()),
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

// ---- A SEEDED alerts book (FE-13, criterion 62/T4) -----------------------------------------------
//
// Without this, `/alerts` renders its EMPTY state (`No rules yet…`, `No firings yet…`) and the
// overflow assertion measures a page with nothing on it. Matches `convexa.alerts.v1`'s exact shape
// (`features/alerts/types.ts` — `AlertsState`/`AlertRule`/`AlertEvent`), read at source before
// authoring this blob rather than guessed, per the launch dispatch's own warning: a malformed seed
// latches the store's read-fault guard (`features/alerts/store.ts`'s `readFaulted`) and silently
// renders an empty page that LOOKS seeded-and-empty rather than unseeded.
//
// Two rules of DIFFERENT kinds, one a raw price threshold (`level: 'price'`, the widest rule-summary
// text — a level name plus a dollar figure) and one a score gate; three events, one UNREAD (the
// `Unread` label + the primary-tinted left edge, the widest single event row).
const SEEDED_ALERTS = {
  schema_version: 1,
  rules: [
    {
      id: 'e2e-rule-price',
      kind: 'level_touch',
      symbol: 'TSLA',
      enabled: true,
      createdAt: 1_700_000_000_000,
      level: 'price',
      priceThreshold: 260,
    },
    {
      id: 'e2e-rule-score',
      kind: 'score_gate',
      symbol: 'SPY',
      enabled: true,
      createdAt: 1_700_000_100_000,
      scoreMin: 70,
    },
  ],
  events: [
    {
      id: 'e2e-event-1',
      ruleId: 'e2e-rule-price',
      kind: 'level_touch',
      symbol: 'TSLA',
      message: 'TSLA touched $260 (price threshold)',
      at: 1_700_000_200_000,
      detail: 'Snapshot at $260.12, call wall $260',
      read: true,
    },
    {
      id: 'e2e-event-2',
      ruleId: 'e2e-rule-score',
      kind: 'score_gate',
      symbol: 'SPY',
      message: 'SPY score crossed 70',
      at: 1_700_000_300_000,
      read: true,
    },
    {
      id: 'e2e-event-3',
      ruleId: 'e2e-rule-price',
      kind: 'level_touch',
      symbol: 'TSLA',
      message: 'TSLA touched $260 (price threshold)',
      at: 1_700_000_400_000,
      detail: 'Snapshot at $260.40, call wall $260',
      read: false,
    },
  ],
  notifyBrowser: false,
};

/**
 * Seed localStorage BEFORE any page script runs — the `onBeforeLoad` equivalent. `addInitScript`
 * re-applies on every navigation in the page's lifetime, which is what the seeded routes need.
 */
async function seed(
  page: Page,
  opts: {
    scheme: 'dark' | 'light';
    positions?: 'none' | 'book' | 'book+condor';
    /** (T4) A non-empty `convexa.alerts.v1` blob — see `SEEDED_ALERTS` above. */
    alerts?: 'seeded';
  },
) {
  const positions =
    opts.positions === 'book'
      ? SEEDED_POSITIONS
      : opts.positions === 'book+condor'
        ? { ...SEEDED_POSITIONS, 'e2e-condor': CONDOR }
        : null;
  const alerts = opts.alerts === 'seeded' ? SEEDED_ALERTS : null;

  await page.addInitScript(
    ({ scheme, positions, alerts }) => {
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
      if (alerts) {
        window.localStorage.setItem('convexa.alerts.v1', JSON.stringify(alerts));
      }
    },
    { scheme: opts.scheme, positions, alerts },
  );
}

/**
 * ONE handler, explicit branching — see the translation note at the top of the file.
 * `signedIn` defaults true (owner lockdown: /positions and /scanner sit behind RequireAuth, so
 * every layout/nav walk that is not SPECIFICALLY testing the wall must be signed in). AC-40's
 * degraded-surface arm passes `signedIn: false` to reach the wall itself at 393px.
 */
async function stubNetwork(
  page: Page,
  opts: { signedIn?: boolean; theme?: 'dark' | 'light' } = {},
) {
  const signedIn = opts.signedIn ?? true;
  // (FE-13) A REAL discrepancy this task found, not merely described: `useSettings.ts:63-69`
  // (`serverBacked = auth.authenticated && auth.settings != null`) makes an AUTHENTICATED session's
  // `settings.theme` win over `convexa.uiprefs.v1` entirely — `loadLocalTheme()` is read ONLY on
  // the anonymous branch. Every `signedIn: true` call here (the file's own default) used to hand
  // back a HARDCODED `theme: 'dark'` regardless of the caller's own `scheme`, so every "light
  // scheme" walk in this file was silently rendering DARK — passing only because dark/light share
  // identical box geometry, exactly the vacuity shape criterion 62 exists to close, one level
  // deeper. Caught by a real screenshot during this task's own visual-inspection pass (a
  // `/alerts` capture in "light" mode rendering pixel-identical to "dark"), confirmed at source,
  // fixed here — `theme` now threads through so a caller's `scheme` actually reaches the render.
  const theme = opts.theme ?? 'dark';
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.startsWith('/api/auth/session')) {
      if (!signedIn) {
        return route.fulfill({
          json: { authenticated: false, user: null, google_available: false, settings: null },
        });
      }
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
          settings: { active_persona_id: null, default_ticker: null, theme },
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

/**
 * Criterion 65 — no figure, chip or label on the four surfaces (or the eight widgets, reached via
 * `/ticker/TSLA` in `ROUTES`) renders below the 11px floor at any checked width. A REAL DOM walk
 * (every element carrying its own direct text) rather than a fixed list of testids — a fixed list
 * would go silently stale the moment a new label ships; this does not. Elements that are `display:
 * none`/`visibility: hidden` are excluded (never rendered, nothing to measure); the shipped
 * visually-hidden a11y idiom (`position:absolute; width:1px; height:1px; clip:rect(0 0 0 0)`,
 * `OffExchangeBlocks.tsx:27-35`) is NOT excluded on purpose — it clips its BOX, never its
 * `font-size`, so a real violation there would still be a real violation.
 */
async function assertNoTypeBelowFloor(page: Page, floorPx = 11) {
  const violations = await page.evaluate((floor) => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode() as Element | null;
    while (node) {
      const el = node as HTMLElement;
      const ownText = Array.from(el.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
      );
      if (ownText) {
        const style = getComputedStyle(el);
        const size = parseFloat(style.fontSize);
        if (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number.isFinite(size) &&
          size < floor
        ) {
          out.push(
            `${el.tagName.toLowerCase()}[data-testid=${el.dataset.testid ?? ''}] "${(el.textContent ?? '').trim().slice(0, 40)}" = ${style.fontSize}`,
          );
        }
      }
      node = walker.nextNode() as Element | null;
    }
    return out;
  }, floorPx);
  expect(
    violations,
    `element(s) rendering below the ${floorPx}px floor:\n${violations.join('\n')}`,
  ).toEqual([]);
}

/**
 * Criterion 50 (SB) — the read strip scrolls sideways when its cells do not fit, and the PAGE itself
 * never scrolls sideways. `requireRailOverflow` is `true` only at 393px (PLAN's own Step 4 wording:
 * "Assert `scrollWidth > clientWidth` AT 393 … both halves, or the row is satisfied by a strip that
 * simply fits") — at the wider bands the rail is allowed to simply fit; only the page-level half is
 * required there.
 */
async function assertReadStripDiscipline(page: Page, opts: { requireRailOverflow: boolean }) {
  const m = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="read-strip-rail"]') as HTMLElement | null;
    return {
      railScrollWidth: el ? el.scrollWidth : null,
      railClientWidth: el ? el.clientWidth : null,
      pageScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });
  expect(m.railScrollWidth, 'read-strip-rail must be attached to measure it').not.toBeNull();
  expect(
    m.pageScrollWidth,
    `page scrollWidth ${m.pageScrollWidth} must fit innerWidth ${m.innerWidth} even when the read-strip rail itself scrolls`,
  ).toBeLessThanOrEqual(m.innerWidth);
  if (opts.requireRailOverflow) {
    expect(
      m.railScrollWidth,
      `read-strip rail should scroll sideways (scrollWidth ${m.railScrollWidth} vs clientWidth ${m.railClientWidth})`,
    ).toBeGreaterThan(m.railClientWidth as number);
  }
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
      await stubNetwork(page, { theme: scheme });
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
      // (curvature-v2-desk-and-read FE-10) Re-anchored from the bare `.MuiDrawer-paper` class
      // locator to the ALREADY-DEFINED `dialog` locator above (the identical node — this IS the
      // analysis Drawer's own paper, `role="dialog"`): FE-10's bottom sheet is now a SECOND
      // `MuiDrawer-paper` on this page at 393px (it renders open-by-default once a read is
      // produced — see `ReadSheet.tsx`), so the class-only locator became ambiguous
      // ("strict mode violation: resolved to 2 elements") the moment that shipped. `dialog` was
      // always the intended target; nothing about this assertion's coverage changes.
      await expect(dialog).toHaveCSS('overflow', 'hidden');
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
      await stubNetwork(page, { theme: scheme });
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
      await stubNetwork(page, { theme: scheme });
    });

    for (const r of ROUTES) {
      test(`${r.path} fits the viewport (scrollWidth <= innerWidth)`, async ({ page }) => {
        // (FE-13, T4/criterion 62) `/alerts` is walked SEEDED, never empty — a zero-rule page would
        // make this walk vacuous for that surface. `/positions` and `/scanner` are seeded (book,
        // the shipped 3-row scan fixture) by their own DEDICATED tests below, which already carry
        // their own pre-measure count guards; duplicating that seeding here would just re-run the
        // same case twice under a different name.
        await seed(page, { scheme, alerts: r.path === '/alerts' ? 'seeded' : undefined });
        await page.goto(r.path);
        await r.ready(page);
        // VACUITY GUARD — the seeded rules actually rendered before we measure (criterion 62).
        if (r.path === '/alerts') {
          await expect(page.getByTestId('alerts-rule')).toHaveCount(2);
        }
        await assertNoHorizontalOverflow(page);
        await assertNoTypeBelowFloor(page); // criterion 65
      });
    }

    // -- AC-40 — degraded surfaces at 393px: the sign-in wall, the cold-start failure banner, and
    // the OPEN palette each fit without overflow (curvature-v2-foundations). Each names its own
    // content anchor BEFORE measuring (the suite's own vacuity-guard idiom) so a page that crashed
    // or rendered blank would fail there, not silently pass the overflow check on an empty page.
    test('AC-40 — the sign-in wall fits at 393px (signed out, a gated surface)', async ({
      page,
    }) => {
      await stubNetwork(page, { signedIn: false });
      await seed(page, { scheme });
      await page.goto('/positions');
      await expect(page.getByTestId('require-auth-wall')).toBeAttached();
      await assertNoHorizontalOverflow(page);
    });

    test('AC-40 — the cold-start failure banner fits at 393px', async ({ page }) => {
      // A MORE SPECIFIC, LATER-registered route wins (Playwright: last-registered runs first) —
      // this overrides `stubNetwork`'s /api/ticker/ 200 with a transport fault for THIS test only.
      await stubNetwork(page, { theme: scheme });
      await page.route('**/api/ticker/**', (route) => route.fulfill({ status: 500, body: '' }));
      await seed(page, { scheme });
      await page.goto('/ticker/TSLA');
      await expect(page.getByRole('button', { name: /retry/i })).toBeAttached();
      await assertNoHorizontalOverflow(page);
    });

    test('AC-40 — the open ⌘K palette fits at 393px', async ({ page }) => {
      await stubNetwork(page, { theme: scheme });
      await seed(page, { scheme });
      await page.goto('/ticker/TSLA');
      await expect(page.getByText('Call wall').first()).toBeAttached();
      // `Control+K` — the listener accepts EITHER `ctrlKey` or `metaKey`; Control is the reliable
      // choice under headless Chromium regardless of host OS (CI runs Linux).
      await page.keyboard.press('Control+K');
      await expect(page.getByTestId('command-palette')).toBeAttached();
      await expect(page.getByTestId('palette-listbox')).toBeAttached();
      await assertNoHorizontalOverflow(page);
    });

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
      // (v2) The drawer carries EXACTLY the four product links (canon rule 19, AC-23) — Lab and
      // Blog moved to the footer, off the bar AND the drawer.
      await page.getByTestId('nav-menu-button').click();
      for (const e of ['scanner', 'ticker', 'positions', 'alerts']) {
        await expect(page.getByTestId(`nav-drawer-${e}`)).toBeVisible();
      }
      await expect(page.getByTestId('nav-drawer-lab')).toHaveCount(0);
      await expect(page.getByTestId('nav-drawer-blog')).toHaveCount(0);
    });

    test('criterion 50 (SB) — the read strip scrolls sideways at 393px while the page itself never does', async ({
      page,
    }) => {
      await seed(page, { scheme });
      await page.goto('/ticker/TSLA');
      await expect(page.getByTestId('level-ladder')).toBeAttached();
      await assertReadStripDiscipline(page, { requireRailOverflow: true });
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
          // (FE-13, T4/criterion 62) seeded here too — at this band `/alerts` renders the SAME
          // single-column list the 393px walk does (no responsive collapse on this surface).
          alerts: r.path === '/alerts' ? 'seeded' : undefined,
        });
        await page.goto(r.path);
        await r.ready(page);
        // VACUITY GUARD for the seeded route: prove the book actually rendered before measuring.
        if (r.path === '/positions') {
          await expect(page.getByTestId('portfolio-panel')).toBeAttached();
        }
        // VACUITY GUARD (FE-13, T4/criterion 62/21) — at this band `/scanner` renders the DENSE
        // TABLE (`breakpoints.down('sm')`, i.e. <600px, is the card cutoff), so `scan-row` is the
        // right anchor here, not `scan-card` (393's own dedicated test already guards that one).
        // The shipped fixture (`stubNetwork`'s `scan` payload above) always returns 3 rows, but this
        // is exactly the "a wide-band walk over a zero-row table passes and proves nothing"
        // vacuity criterion 62 exists to close — asserted explicitly rather than assumed.
        if (r.path === '/scanner') {
          await expect(page.getByTestId('scan-row')).toHaveCount(3);
        }
        // VACUITY GUARD (FE-13, T4/criterion 62) — the seeded rules actually rendered.
        if (r.path === '/alerts') {
          await expect(page.getByTestId('alerts-rule')).toHaveCount(2);
        }
        await assertNoHorizontalOverflow(page);
        await assertNoTypeBelowFloor(page); // criterion 65
      });
    }

    test(`criterion 50 (SB) — the read strip never pushes the page wider at ${vp.width}px`, async ({
      page,
    }) => {
      await seed(page, { scheme: 'dark', positions: 'none' });
      await page.goto('/ticker/TSLA');
      await expect(page.getByTestId('level-ladder')).toBeAttached();
      // At the wider bands the rail is allowed to simply fit (PLAN's own Step 4 wording) — only the
      // page-level half is required unconditionally.
      await assertReadStripDiscipline(page, { requireRailOverflow: false });
    });
  });
}

// ---- CRITERION 64 — light mode at 1280 (T4/FE-13) ------------------------------------------------
//
// The wide-band loop above is deliberately dark-only (overflow is box geometry, unaffected by
// scheme). Criterion 64 is about COLOUR, not geometry, and SPEC names 1280 explicitly alongside 393
// (which the `393px no-overflow` describe blocks above already run in BOTH schemes for all four
// surfaces). This block closes the one width×scheme cell no other test in this file reaches: the
// four surfaces, seeded, actually RENDER in light mode at 1280 — the "light walk" PLAN's own FE-13
// text names, alongside the vitest-level `hex-discipline.spec.ts`/token-parity checks (out of this
// file's ownership; `apps/dashboard/src/app/shared/theme/`, not `apps/dashboard-e2e/`).
test.describe('lg 1280 no-overflow · light scheme (criterion 64)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await stubNetwork(page, { theme: 'light' });
  });

  for (const r of ROUTES) {
    test(`${r.path} fits 1280px in light mode (scrollWidth <= innerWidth)`, async ({ page }) => {
      await seed(page, {
        scheme: 'light',
        positions: r.path === '/positions' ? 'book+condor' : 'none',
        alerts: r.path === '/alerts' ? 'seeded' : undefined,
      });
      await page.goto(r.path);
      await r.ready(page);
      if (r.path === '/positions') {
        await expect(page.getByTestId('portfolio-panel')).toBeAttached();
      }
      if (r.path === '/scanner') {
        await expect(page.getByTestId('scan-row')).toHaveCount(3);
      }
      if (r.path === '/alerts') {
        await expect(page.getByTestId('alerts-rule')).toHaveCount(2);
      }
      await assertNoHorizontalOverflow(page);
      await assertNoTypeBelowFloor(page);
    });
  }
});

// ---- CRITERION 7a — the rendered container step (T4/FE-13) ---------------------------------------
//
// `PositionsPage.tsx:203-209`'s `positions-net-pl` `PanelContainer` is the ONE shipped stepped
// figure host on this surface (`FigureCell.tsx:184-189`: 20px base, steps to 17px under a 360px
// NAMED-container width, to 15px under 280px — SPEC §7 invariant 5, `@container` cannot be seen by
// jsdom). A REAL resolved mark is required to reach a stepping ("traced") figure at all — the
// shipped `stubNetwork`'s `/api/contract/` 404 (used by every other test in this file, deliberately,
// so the malformed/unresolved arms those tests cover stay reachable) would leave `netPlStateOf`
// at its F8 `unavailable` LITERAL arm here, which the closed-nine vocabulary fixes at the 15px
// "literal size" and never steps (`FigureCell.tsx:170-172`) — that would make this test vacuous for
// what it exists to prove. This test therefore registers its OWN, LATER, more specific
// `/api/contract/**` route on top of `stubNetwork`'s (last-registered wins, the same idiom AC-40's
// cold-start-banner test already uses), self-contained and scoped to this test only.
test.describe('criterion 7a — rendered container step on /positions', () => {
  const RESOLVABLE_POSITION = {
    'e2e-7a': {
      id: 'e2e-7a',
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
    },
  };

  async function stubResolvableContract(page: Page) {
    await stubNetwork(page);
    await page.route('**/api/contract/**', (route) =>
      route.fulfill({
        json: {
          ticker: 'TSLA',
          expiration: '2026-08-21',
          strike: 400,
          right: 'call',
          option_quote: { bid: 14.9, ask: 15.1, mid: 15 },
          greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
          iv: 0.45,
          dte: 24,
        },
      }),
    );
  }

  async function measureNetPl(page: Page, width: number) {
    await page.setViewportSize({ width, height: 900 });
    await stubResolvableContract(page);
    await page.addInitScript((positions) => {
      window.localStorage.setItem(
        'convexa.uiprefs.v1',
        JSON.stringify({ schema_version: 1, theme: 'dark', default_ticker: null }),
      );
      window.localStorage.setItem(
        'convexa.positions.v2',
        JSON.stringify({ schema_version: 2, positions, decisions: [] }),
      );
    }, RESOLVABLE_POSITION);
    await page.goto('/positions');
    await expect(page.getByTestId('portfolio-panel')).toBeAttached();
    const panel = page.getByTestId('positions-net-pl');
    const glyph = panel.locator('[data-figure-register]').first();
    // VACUITY GUARD — a real resolved, TRACED figure (never the closed-nine `unavailable` literal),
    // so this measurement actually reaches a stepping figure rather than the fixed-15px F8 arm.
    await expect(glyph).not.toHaveText('unavailable');
    const [containerBox, fontSize] = await Promise.all([
      panel.boundingBox(),
      glyph.evaluate((el) => getComputedStyle(el).fontSize),
    ]);
    return { containerWidth: containerBox?.width ?? null, fontSize };
  }

  test('AC-7a (review-only evidence) — 1280 vs 393, real resolved mark', async ({ page }) => {
    const wide = await measureNetPl(page, 1280);
    const narrow = await measureNetPl(page, 393);

    console.log(
      `[criterion 7a evidence] wide(1280): container=${wide.containerWidth}px font=${wide.fontSize} · ` +
        `narrow(393): container=${narrow.containerWidth}px font=${narrow.fontSize}`,
    );

    // The only PASS/FAIL assertion: both are real, valid computed sizes (the traced figure really
    // did render at both widths, so these are not a measurement of a blank/faulted page).
    expect(wide.fontSize).toMatch(/^\d+(\.\d+)?px$/);
    expect(narrow.fontSize).toMatch(/^\d+(\.\d+)?px$/);

    // NOT asserted as pass/fail (recorded as a GATE Z finding in BUILD_REPORT.md instead, per this
    // task's own explicit instruction: "if the measured values differ from 20/17, that is a
    // finding, not a number to adjust the assertion to"): `PositionsPage.tsx:203`'s
    // `minWidth: 200, flexShrink: 0` (added by FE-6 to fix a real zero-width collapse) floors this
    // PARTICULAR container's rendered width at 200px regardless of viewport — the flex item never
    // grows past its own content size because it carries no `flexGrow`, and its content (a short
    // label plus one currency figure) never reaches the 200px floor on its own. 200px sits UNDER
    // BOTH `@container` breakpoints (360 and 280), so this readout renders at the smallest, 15px
    // "literal size" step at every viewport this session measured — the 20px/17px states SPEC §7
    // invariant 5 describes are structurally unreachable for THIS panel as shipped, not merely
    // untested. Measured, not assumed: `narrow.containerWidth === wide.containerWidth === 200` and
    // `narrow.fontSize === wide.fontSize === '15px'` this run (both printed above, verbatim, for
    // the build report) even with a position sized to produce a much larger P/L figure — confirmed
    // by a throwaway measurement during this task's own investigation, not merely the two widths
    // above. This is `PositionsPage.tsx`'s file, owned by FE-6/positions, not this lane's to edit.
  });
});

// =====================================================================================================
// GATE Z, finding 3 (criterion 66, curvature-v2-surfaces GATE Z repair pass 2) — the 44px
// coarse-pointer floor now reaches raw `<input>`s and MUI `Select`'s visible `[role="combobox"]` box
// (`theme.ts`'s `'@media (pointer: coarse)'` rule), not just `button`/`[role="button"]`/`a`. QA
// measured `risk-inputs-account-size` and `risk-inputs-cap-value` at 160×37 / 120×37 — both edited
// this phase (`RiskInputsSection.tsx`) — plus `settings-ticker`/`settings-persona` (311×38.6) and the
// alerts composer's `TextField`/`Select` controls (361×38.6), all under the 44px floor and, before
// this fix, unreachable by the theme's own selector list.
// =====================================================================================================
async function expectFloor(locator: import('@playwright/test').Locator, label: string) {
  const box = await locator.boundingBox();
  expect(box, `${label} has a bounding box (is attached and rendered)`).toBeTruthy();
  expect(box!.width, `${label} effective width`).toBeGreaterThanOrEqual(44);
  expect(box!.height, `${label} effective height`).toBeGreaterThanOrEqual(44);
}

test.describe('GATE Z finding 3 (criterion 66) — inputs and selects at 393px, coarse pointer', () => {
  test.use({ viewport: { width: 393, height: 852 }, hasTouch: true });

  test('the Settings Risk-inputs account-size and cap-value fields meet the 44px floor', async ({
    page,
  }) => {
    await stubNetwork(page);
    await seed(page, { scheme: 'dark' });
    await page.goto('/settings');
    await expect(page.getByTestId('settings-page')).toBeAttached();
    const accountSize = page.getByTestId('risk-inputs-account-size');
    const capValue = page.getByTestId('risk-inputs-cap-value');
    const accountBox = await accountSize.boundingBox();
    const capBox = await capValue.boundingBox();
    console.log(
      `[criterion 66 evidence, GATE Z pass 2] risk-inputs-account-size (RiskInputsSection.tsx:150) = ` +
        `${JSON.stringify(accountBox)} · risk-inputs-cap-value (:195) = ${JSON.stringify(capBox)}`,
    );
    await expectFloor(accountSize, 'risk-inputs-account-size (coarse pointer)');
    await expectFloor(capValue, 'risk-inputs-cap-value (coarse pointer)');
  });

  test('the Settings default-ticker field and active-persona select meet the 44px floor', async ({
    page,
  }) => {
    await stubNetwork(page);
    await seed(page, { scheme: 'dark' });
    await page.goto('/settings');
    await expect(page.getByTestId('settings-page')).toBeAttached();
    const ticker = page.getByTestId('settings-ticker');
    // The visible tap target for a MUI `Select` is its `[role="combobox"]` display box, not the
    // `aria-hidden`/`pointer-events: none` native `<input>` `inputProps` lands on (SPEC §2.2's
    // theme-floor mechanism note) — assert the element a coarse pointer actually reaches.
    const persona = page.locator('#settings-persona-label').locator('..').getByRole('combobox');
    const tickerBox = await ticker.boundingBox();
    const personaBox = await persona.boundingBox();
    console.log(
      `[criterion 66 evidence, GATE Z pass 2] settings-ticker (SettingsPage.tsx:307) = ` +
        `${JSON.stringify(tickerBox)} · settings-persona combobox (:272-279) = ${JSON.stringify(personaBox)}`,
    );
    await expectFloor(ticker, 'settings-ticker (coarse pointer)');
    await expectFloor(persona, 'settings-persona combobox (coarse pointer)');
  });

  test('the alerts composer Symbol field and Kind select meet the 44px floor', async ({ page }) => {
    await stubNetwork(page);
    await seed(page, { scheme: 'dark' });
    await page.goto('/alerts');
    await expect(page.getByTestId('alerts-composer')).toBeAttached();
    const symbol = page.getByRole('textbox', { name: 'Alert symbol' });
    const kind = page.getByRole('combobox', { name: 'Kind' });
    const symbolBox = await symbol.boundingBox();
    const kindBox = await kind.boundingBox();
    console.log(
      `[criterion 66 evidence, GATE Z pass 2] alerts composer Symbol field = ${JSON.stringify(symbolBox)} · ` +
        `Kind select = ${JSON.stringify(kindBox)}`,
    );
    await expectFloor(symbol, 'alerts composer Symbol field (coarse pointer)');
    await expectFloor(kind, 'alerts composer Kind select (coarse pointer)');
  });
});
