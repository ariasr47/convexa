import { expect, test, type Page } from '@playwright/test';

/**
 * curvature-v2-desk-and-read FE-12 — the browser layer's own new spec (PLAN.md's "FE-12 — The
 * browser layer: re-anchor, re-point, register, prove execution", Step 5).
 *
 * REGISTRATION (T1, SPEC row 51): this file must be added to `playwright.config.ts`'s `testMatch`
 * allowlist in the SAME commit that adds it — that file is an explicit array, not a glob, so an
 * unregistered spec never runs and reports green. Proved with `--list`, not a passing summary.
 *
 * PLAN's own Step 5 names FOUR groups. Only THREE are new here — criterion 9 (exactly one
 * connection chip in the viewport at both scroll positions; the deleted `tape-stream-state` block
 * never reappears) already has FULL, currently-green browser coverage in `curvature-v2.spec.ts`'s
 * `AC-1a` describe block (landed at FE-6/FE-8, re-verified this session, `toBeInViewport` per node —
 * the exact reviewer probe named in PLAN.md). Duplicating a passing browser assertion in a second
 * file buys nothing; this file covers the three groups that did NOT already have browser coverage:
 *
 *   - Criterion 45 (SB) — exactly one verdict-marked node at 393px and at 1280px, same string.
 *   - Criteria 20/22 evidence — the browser companion to FE-4's recording-2D-context proof: on a
 *     stream drop, capture that the field persists (attached, same geometry, connection now
 *     `offline`) rather than being torn down; under reduce-motion, capture a static render. Criteria
 *     21/22 stay `review` (canvas opacity is a container-level style the fake recording context
 *     cannot see; a reduced-motion static frame is a visual judgement) — criterion 20's own `test`
 *     mark is already satisfied at the unit tier (`paintStep.spec.ts`, against a recording fake 2D
 *     context, per SPEC §7). This file cannot read live canvas PIXEL content meaningfully (no
 *     harness draws a synthetic model here the way the unit recording context does), so it proves
 *     what the DOM can see (attachment + geometry + connection state) and attaches screenshots for a
 *     reviewer to judge the rest — the SAME "review evidence, not a vacuous pass/fail" idiom
 *     `curvature-v2.spec.ts`'s own AC-20b block already established.
 *   - Criterion 52 (P5, review) — in light mode at 393px and 1280px, a genuine automated proof (not
 *     merely a screenshot) that the field's own canvas fill is NOT scheme-invariant: read a pixel
 *     from the canvas's base `surfaces.ink` fill (`theme.palette.background.default`,
 *     `StructureHeroPanel.tsx`) in both colour schemes and assert they differ, plus attach
 *     screenshots so a reviewer can confirm the field genuinely repaints onto the light panel
 *     surface (not merely a different single pixel).
 *
 * NETWORK — a self-contained `stubNetwork`/`seed` pair, deliberately not imported from
 * `curvature-v2.spec.ts`/`no-overflow.spec.ts` (neither exports them; this file's own header follows
 * the SAME "duplicating the minimal shape this file's own assertions need" convention
 * `curvature-v2.spec.ts` already documents for itself).
 *
 * THE THEME TRAP (curvature-v2-desk-and-read FE-11's own documented finding, load-bearing for
 * criterion 52): `useSettings.ts`'s precedence rule (D7) is "signed in ⇒ the SERVER `settings` WIN".
 * A stub that hardcodes the mocked `/api/auth/session` response's `settings.theme` to `'dark'` (as
 * `curvature-v2.spec.ts`'s and `no-overflow.spec.ts`'s OWN stubs both do — harmless there because
 * neither ever exercises light mode with that hardcoded value) would silently render dark under
 * every "light scheme" label here, exactly the trap FE-11's session lost a screenshot cycle to
 * before fixing its OWN throwaway script. `stubNetwork` below drives `settings.theme` from the SAME
 * `scheme` parameter as the localStorage seed — never a second, disagreeing source.
 *
 * THE STREAM-DROP WATCHDOG — `useTickerStream.ts`'s `STREAM_OFFLINE_MS` is 15_000ms, flipped by a
 * real `setTimeout`. `page.clock.install()` before `page.goto`, deliver one live SSE frame, then
 * `page.clock.fastForward(14_000)` + `fastForward(1_000)` (split in two, matching the EXACT working
 * pattern this repo's own `quality/accessibility.spec.ts`/`compatibility.spec.ts`/`visual.spec.ts`
 * already use for the identical watchdog) reliably fires the drop without waiting 15 real seconds
 * and without giving the browser's native EventSource reconnect (a real-wall-clock-timed mechanism
 * `page.clock` does not virtualize) any real time to re-arm the gap timer.
 */

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
    iv_rank: null,
    market_context: null,
    straddle_move: null,
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
    state_fingerprint: 'fp-desk-and-read-e2e',
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

const scan = {
  view: {
    source: 'default',
    authenticated: false,
    name: null,
    symbols: ['TSLA'],
    sort: { key: 'score', dir: 'desc' },
    density: 'compact',
  },
  rows: [
    {
      symbol: 'TSLA',
      price: 250,
      chg_pct: 1.2,
      score: 82,
      tier: 'prime',
      regime: 'positive_gamma',
      vol_regime: 'iv_rich',
      flip: 248,
      dist_to_flip_pct: 0.8,
      call_wall: 260,
      put_wall: 240,
      dist_to_wall_pct: 1.9,
      as_of: Math.floor(Date.now() / 1000) - 30,
      status: 'ok',
    },
  ],
  sweep: {
    updated_at: Math.floor(Date.now() / 1000),
    sweep_last_completed: Math.floor(Date.now() / 1000) - 20,
    universe_size: 1,
  },
};

/**
 * A single real SSE frame — `live: true`, no `session_tape` — so `resolveConnectionState` latches
 * `{ kind: 'live' }`. One frame is enough (ruling 1: a session-lifetime monotonic latch); the
 * stream-drop groups below advance the fake clock past `STREAM_OFFLINE_MS` rather than waiting for a
 * second frame that is deliberately never sent.
 */
const LIVE_SSE_FRAME = `data: ${JSON.stringify({
  ticker: 'TSLA',
  live: true,
  market_session: 'regular',
  mid: 250.1,
  last_trade: 250.05,
  bid: 250.0,
  ask: 250.2,
  spread: 0.2,
  buy_vol: 1000,
  sell_vol: 900,
  net_flow: 100,
  flow_window_s: 300,
  gamma_flip: 248,
  spot_ts: 1,
  ts: 1,
  feed: 'e2e',
  tick_age_s: 0,
  session_tape: null,
})}\n\n`;

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
  sent: null,
  grounding: null,
};

/** Seed localStorage BEFORE any page script runs — re-applied on every navigation. */
async function seed(page: Page, opts: { scheme: 'dark' | 'light' }) {
  await page.addInitScript(
    ({ scheme }) => {
      window.localStorage.setItem(
        'convexa.uiprefs.v1',
        JSON.stringify({ schema_version: 1, theme: scheme, default_ticker: null }),
      );
    },
    { scheme: opts.scheme },
  );
}

/**
 * ONE handler, explicit branching. `settings.theme` is driven from the SAME `scheme` parameter as
 * `seed()`'s localStorage write — see this file's own header doc on the theme trap.
 */
async function stubNetwork(page: Page, opts: { scheme: 'dark' | 'light' }) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.startsWith('/api/auth/session')) {
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
          settings: { active_persona_id: null, default_ticker: null, theme: opts.scheme },
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
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: LIVE_SSE_FRAME });
    }
    if (path.startsWith('/api/recommendation/') && route.request().method() === 'POST') {
      return route.fulfill({ json: producedRecFixture });
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
    if (path.startsWith('/api/personas')) {
      return route.fulfill({ json: [{ id: 'default', name: 'Default (no persona)' }] });
    }
    if (path.startsWith('/api/contract/')) return route.fulfill({ status: 404, body: '' });
    if (path.startsWith('/api/scan/universe')) {
      return route.fulfill({ json: { symbols: ['TSLA'], universe_size: 1 } });
    }
    if (path.startsWith('/api/scan')) return route.fulfill({ json: scan });

    return route.fallback();
  });
}

async function gotoReadyTicker(page: Page, scheme: 'dark' | 'light' = 'dark') {
  await stubNetwork(page, { scheme });
  await seed(page, { scheme });
  await page.goto('/ticker/TSLA');
  await expect(page.getByTestId('level-ladder')).toBeAttached();
  await expect(page.getByText('Call wall').first()).toBeAttached();
}

// =====================================================================================================
// Criterion 45 (SB) — exactly one verdict-marked node at 393px and at 1280px, same string
// =====================================================================================================

test.describe('Criterion 45 (SB) — exactly one decision-verdict node at 393 and 1280, same string', () => {
  test('393px: opening the analysis mounts exactly one decision-verdict node (the bottom-sheet peek/body are mutually exclusive)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await gotoReadyTicker(page);
    await page.getByRole('button', { name: 'Analyze current snapshot' }).click();
    await expect(page.getByTestId('decision-verdict')).toHaveCount(1);
    await expect(page.getByTestId('decision-verdict-word')).not.toHaveText('');
  });

  test('resizing 393 -> 1280 in the SAME session keeps exactly one decision-verdict node, carrying the SAME string (proves the bottom sheet and the wide panel are one field, not two)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await gotoReadyTicker(page);
    await page.getByRole('button', { name: 'Analyze current snapshot' }).click();
    await expect(page.getByTestId('decision-verdict')).toHaveCount(1);
    const narrowText = await page.getByTestId('decision-verdict-word').textContent();
    expect(narrowText).toBeTruthy();

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId('decision-verdict')).toHaveCount(1);
    const wideText = await page.getByTestId('decision-verdict-word').textContent();
    expect(wideText).toBe(narrowText);
  });
});

// =====================================================================================================
// Criteria 20/22 evidence — the browser companion to FE-4's recording-context proof
// =====================================================================================================

test.describe('Criteria 20/22 evidence — a stream drop keeps the field attached and geometrically stable; reduce-motion renders without incident', () => {
  test('stream drop: connection flips to offline, the field canvas stays attached at unchanged geometry (browser companion — trail/drift/beam/sweep stopping is proven at the unit tier, paintStep.spec.ts)', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.clock.install();
    await stubNetwork(page, { scheme: 'dark' });
    await seed(page, { scheme: 'dark' });
    await page.goto('/ticker/TSLA');
    await expect(page.getByTestId('level-ladder')).toBeAttached();

    const chip = page.getByTestId('connection-chip').first();
    await expect(chip).toHaveAttribute('data-connection-state', 'live');

    const canvas = page.getByTestId('structure-field-canvas');
    await expect(canvas).toBeAttached();
    const before = await canvas.boundingBox();
    expect(before).not.toBeNull();

    await testInfo.attach('field-before-drop.png', {
      body: await page.getByTestId('widget-structure-hero').screenshot(),
      contentType: 'image/png',
    });

    // Advance past STREAM_OFFLINE_MS (15_000ms) without a second frame — split fastForward, the
    // exact pattern this repo's own quality accessibility/compatibility/visual specs already use
    // for the identical watchdog.
    await page.clock.fastForward(14_000);
    await page.clock.fastForward(1_000);

    await expect(chip).toHaveAttribute('data-connection-state', 'offline');
    // The field is NOT torn down on a drop — it stays attached at the SAME geometry (criterion 20's
    // "keeps its last computed geometry" half, as far as this harness can see without pixel access).
    await expect(canvas).toBeAttached();
    const after = await canvas.boundingBox();
    expect(after).not.toBeNull();
    expect(Math.round(after!.width)).toBe(Math.round(before!.width));
    expect(Math.round(after!.height)).toBe(Math.round(before!.height));

    await testInfo.attach('field-after-drop.png', {
      body: await page.getByTestId('widget-structure-hero').screenshot(),
      contentType: 'image/png',
    });
    // REVIEW EVIDENCE (criteria 21/22): the two attached screenshots let a reviewer confirm the wall
    // lines and flip line are still painted while the trail/drift/beam/sweep have stopped, and that
    // the container itself is not dimmed. This harness cannot assert canvas pixel content
    // meaningfully without re-deriving FE-4's own recording-context fixture inside a browser test —
    // that proof already exists, and is `test`-marked, at the unit tier.
  });

  test('reduce-motion: the ticker renders without incident and stays connected (criterion 22 static-frame review capture)', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoReadyTicker(page, 'dark');
    await expect(page.getByTestId('connection-chip').first()).toHaveAttribute(
      'data-connection-state',
      'live',
    );
    await expect(page.getByTestId('structure-field-canvas')).toBeAttached();

    await testInfo.attach('field-reduced-motion-1280.png', {
      body: await page.getByTestId('widget-structure-hero').screenshot(),
      contentType: 'image/png',
    });

    await page.setViewportSize({ width: 393, height: 852 });
    await testInfo.attach('field-reduced-motion-393.png', {
      body: await page.getByTestId('widget-structure-hero').screenshot(),
      contentType: 'image/png',
    });
    // REVIEW EVIDENCE (criterion 22): a reviewer inspects the two attached screenshots (1280 and
    // 393, reduce-motion on) to judge that drift/trail/beam render as static frames — a visual
    // judgement no DOM assertion can make.
  });
});

// =====================================================================================================
// Criterion 52 (P5, review) — light mode at 393 and 1280: the field paints the active scheme's
// surface, never a scheme-invariant fill
// =====================================================================================================

test.describe("Criterion 52 (P5, review) — the field's own canvas fill is not scheme-invariant", () => {
  /** Reads the canvas's base fill near the origin — outside the plot area's padded gradient
   *  overlays, so it reliably reads `surfaces.ink` (`StructureHeroPanel.tsx`'s
   *  `theme.palette.background.default`) regardless of model/connection state. */
  async function inkPixelAt(page: Page, scheme: 'dark' | 'light', width: number, height: number) {
    await page.setViewportSize({ width, height });
    await stubNetwork(page, { scheme });
    await seed(page, { scheme });
    await page.goto('/ticker/TSLA');
    await expect(page.getByTestId('level-ladder')).toBeAttached();
    const canvas = page.getByTestId('structure-field-canvas');
    await expect(canvas).toBeAttached();
    return canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('structure-field-canvas has no 2D context');
      const [r, g, b] = ctx.getImageData(2, 2, 1, 1).data;
      return `${r},${g},${b}`;
    });
  }

  for (const [width, height] of [
    [393, 852],
    [1280, 900],
  ] as const) {
    test(`${width}px: the canvas's own base fill differs between dark and light — not scheme-invariant`, async ({
      page,
      context,
    }, testInfo) => {
      const darkInk = await inkPixelAt(page, 'dark', width, height);
      await testInfo.attach(`field-${width}-dark.png`, {
        body: await page.getByTestId('widget-structure-hero').screenshot(),
        contentType: 'image/png',
      });

      // A FRESH page for the light render — `page.addInitScript` accumulates across navigations on
      // the same page, and a second `seed()` call on the SAME page would stack two scripts rather
      // than cleanly replacing the first.
      const lightPage = await context.newPage();
      const lightInk = await inkPixelAt(lightPage, 'light', width, height);
      await testInfo.attach(`field-${width}-light.png`, {
        body: await lightPage.getByTestId('widget-structure-hero').screenshot(),
        contentType: 'image/png',
      });
      await lightPage.close();

      // The AUTOMATED half: the field's own fill genuinely changes with the scheme.
      expect(lightInk).not.toBe(darkInk);
      // REVIEW half (criterion 52 is review-marked): the two attached screenshots let a reviewer
      // confirm the field repaints onto the light PANEL surface specifically (not just a different
      // single pixel) and that no background fill anywhere in the hero stays dark-plate.
    });
  }
});
