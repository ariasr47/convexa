import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * curvature-v2-foundations — FE-10's own new spec (PLAN §"FE-10 — The browser layer"). Four groups,
 * each covering exactly one browser-only AC that jsdom cannot see:
 *
 *   - AC-1a — exactly one connection chip is ever IN THE VIEWPORT, never two, never zero, and the
 *     deleted `tape-stream-state` block never reappears anywhere on the page.
 *   - AC-34 — the coarse-pointer 44px effective hit area, MEASURED (not asserted) for every control
 *     ruling 5 names this phase created or touched.
 *   - AC-35 — the six converted hover-only info sites (ruling 6) have BOTH a tap and a keyboard-focus
 *     path, at 393/834/900/1280.
 *   - U-32 (curvature-v2-surfaces, OWNER D-C, added by FE-12) — a SECOND, frame-scoped site list:
 *     all SEVEN live `<Widget info=…>` sites (was eight — PASS 2 change 8 dropped `iv-rank`, which
 *     no longer mounts on `/ticker`), asserted at the frame root `widget-{id}` (hero and live tape
 *     included), on the frame's own HEADER ⓘ specifically — the shipped AC-35 list above and
 *     `ladder-foot` scope to widget/hero BODY testids one level inside the frame and cannot reach a
 *     frame header at all (`Widget.tsx` renders the header box before the body box).
 *   - AC-20b — the rendered container-query step. See the block comment above that test for why it
 *     is recorded as `review` evidence rather than asserted pass/fail (PLAN's own sanctioned
 *     "honest fallback": `LiveTape.tsx`/`StructureHeroPanel.tsx` (curvature-v2-desk-and-read FE-8:
 *     re-pointed from the deleted dealer positioning widget, its `span={2}` successor in that page
 *     slot) are BOTH `span={2}` — full bento width at every breakpoint — so this shipped page has no
 *     two-panel-on-one-screen pair to compare without re-laying out a surface, which is out of this
 *     phase's scope).
 *
 * NETWORK — a self-contained `stubNetwork`/`seed` pair, deliberately not imported from
 * `no-overflow.spec.ts` (that file does not export them, and widening its export surface for one
 * consumer is a bigger change than duplicating the minimal shape this file's own assertions need).
 * The one addition beyond that file's idiom: the SSE stub delivers a REAL `data: {...}\n\n` frame so
 * `live` genuinely latches (ruling 1) — AC-1a needs a resolved `connection-chip`, not the cold
 * placeholder, to mean anything.
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
    // Non-null (curvature-v2-surfaces FE-12): `TermStructure.tsx`'s `info` prop is CONDITIONAL on
    // this being present (`info={termStructure ? termTip(termStructure) : undefined}`) — the frame
    // ⓘ AC-35 now checks at `widget-term-structure` would never render against the prior `null`
    // fixture, which would make that one site's check vacuously skip rather than pass.
    term_structure: {
      points: [
        { dte: 7, expiration: '2026-06-26', atm_iv: 40 },
        { dte: 30, expiration: '2026-07-17', atm_iv: 45 },
      ],
      state: 'contango',
      near_iv: 40,
      far_iv: 45,
      slope: 5,
    },
    dealer_flow_projection: {
      spot_basis: 250,
      charm: {
        projected_delta: 4_200_000,
        per_day_base: 380_000,
        horizon_days: 11,
        opex_date: '2026-07-17',
      },
      vanna: {
        projected_delta: 1_850_000,
        move_iv_points: 1.0,
        illustrative_move_iv_points: 5.0,
        illustrative_projected_delta: 9_250_000,
        reference_direction: 'increase',
      },
    },
    // AC-35's four "look-alike" widgets — populated so their `AccessibleHelp` sites actually render
    // on every viewport (an empty/insufficient-data branch would make the hit-area/tap checks
    // vacuous for whichever site only appears in the happy path).
    iv_rank: {
      state: 'computed',
      rank: 82,
      rank_unavailable_reason: null,
      percentile: 74,
      band: 'premium_rich',
      current_iv: 41.2,
      window_sessions: 130,
      sample_count: 130,
      window_cap: 252,
      min_samples: 20,
      iv_basis: 'interpolated_30d',
      basis_dte: 30,
      window_descriptor: 'trailing sessions',
      basis_descriptor: '30d interpolated',
      advisory_note: 'context only, never a score input',
    },
    market_context: {
      trend_momentum: {
        as_of_session: '2026-06-23',
        direction: {
          label: 'uptrend',
          close: 250,
          ema20: 247,
          ema50: 240,
          window: '20/50d EMA',
          thresholds: 'close > ema20 > ema50',
        },
        strength: { label: 'strong', adx: 28.4, window: '14d ADX', thresholds: 'adx > 25' },
        momentum: { label: 'neutral', rsi: 51.2, window: '14d RSI', thresholds: '45-55' },
      },
      gex_profile_shape: {
        concentration: 0.41,
        concentration_label: 'concentrated',
        balance: 0.34,
        balance_label: 'above_skewed',
        center_of_mass_distance: 0.012,
        eligible_strikes: 23,
        spot_basis: 250,
        thresholds: 'concentration thresholds',
      },
      flow_vs_positioning: {
        flow_basis: 'session net flow',
        location: { label: 'rotating', distribution_shift: 0.42, thresholds: 'shift thresholds' },
        composition: {
          label: 'consistent',
          volume_pcr: 0.92,
          oi_pcr: 0.88,
          tilt_ratio: 1.05,
          thresholds: 'pcr thresholds',
        },
      },
      atr: {
        as_of_session: '2026-06-23',
        close_basis: 250,
        method: 'wilder',
        atr_5d: { value: 4.12, pct_of_close: 2.31, window_bars: 5 },
        atr_14d: { value: 3.87, pct_of_close: 2.17, window_bars: 14 },
        atr_30d: { value: 3.51, pct_of_close: 1.97, window_bars: 30 },
      },
    },
    straddle_move: {
      state: 'ok',
      as_of: '2026-06-23T14:00:00Z',
      session_basis: 'after_close',
      anchor_spot: 250,
      anchor_basis: 'gex_spot',
      anchor_label: 'gex_spot',
      primary_expiration: '2026-07-18',
      wide_quote_threshold_pct: 15,
      tenors: [
        {
          expiration: '2026-07-18',
          dte: 25,
          strike_used: 250,
          strike_distance_pct: 0,
          straddle_price: 12,
          move_dollars: 12,
          move_pct: 4.8,
          basis: 'atm_straddle_mid',
          quote_spread_pct_of_mid: 5,
          wide_quotes: false,
        },
      ],
    },
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
    state_fingerprint: 'fp-curvature-v2-e2e',
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
 * A single real SSE frame — `live: true`, no `session_tape` — so `resolveConnectionState`
 * (`connection/connectionState.ts:74-75`) latches `{ kind: 'live' }`, not the cold placeholder or
 * one of the replay standings. Delivered as a complete, already-terminated HTTP body; Chromium's
 * `EventSource` still parses and dispatches any complete `data:` frame present before a stream ends,
 * then auto-reconnects (`convexa.ts:1299`'s own documented behavviour) — one frame is enough to
 * latch a session-lifetime monotonic state (ruling 1), so a second delivery is not needed.
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

async function seed(page: Page, opts: { scheme: 'dark' | 'light' } = { scheme: 'dark' }) {
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

async function stubNetwork(page: Page) {
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
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: LIVE_SSE_FRAME,
      });
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

async function gotoReadyTicker(page: Page) {
  await stubNetwork(page);
  await seed(page);
  await page.goto('/ticker/TSLA');
  await expect(page.getByText('Call wall').first()).toBeAttached();
}

// =====================================================================================================
// AC-1a — exactly one connection chip in the viewport, at rest AND after scrolling the hero out of view
// =====================================================================================================

/**
 * Counts, of the (possibly several) DOM nodes matching `testid`, how many are actually inside the
 * viewport right now — using `toBeInViewport` per node (the reviewer probe named in PLAN.md: "does
 * the one-chip assertion use `toBeInViewport` rather than `toBeVisible`?"). A node that is mounted,
 * unhidden, and has a non-zero box (so `toBeVisible()` would pass) but is scrolled off-screen must
 * NOT count here — that is exactly the failure mode this AC exists to catch (`CommandDeck.tsx:225`'s
 * hero header stays mounted and `aria-hidden={false}` while merely scrolled out).
 */
async function countInViewport(page: Page, testid: string): Promise<number> {
  const locator = page.getByTestId(testid);
  const total = await locator.count();
  let inViewport = 0;
  for (let i = 0; i < total; i++) {
    try {
      await expect(locator.nth(i)).toBeInViewport({ timeout: 500 });
      inViewport++;
    } catch {
      // Attached but not intersecting the viewport — expected for the scrolled-out hero chip.
    }
  }
  return inViewport;
}

test.describe('AC-1a — one connection chip in the viewport, never two, never the deleted stream-state block', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('hero chip in view at rest; condensed chip replaces it in-viewport after scroll (hero node stays mounted, off-screen)', async ({
    page,
  }) => {
    await gotoReadyTicker(page);

    // FE-6 deleted the standalone block outright (`TapePulseStrip.tsx`'s `tape-stream-state`) —
    // it must never exist, at any scroll position, not just be non-visible.
    await expect(page.getByTestId('tape-stream-state')).toHaveCount(0);

    // AT REST: exactly one chip NODE exists (the condensed bar is not yet mounted —
    // `CommandDeck.tsx:238`'s `{condensed && (…)}`), and it is resolved (latched), not the cold
    // placeholder — the vacuity guard that the SSE stub actually took effect.
    await expect(page.getByTestId('connection-chip')).toHaveCount(1);
    await expect(page.getByTestId('connection-chip').first()).toHaveAttribute(
      'data-connection-state',
      'live',
    );
    expect(await countInViewport(page, 'connection-chip')).toBe(1);

    // Scroll the hero out of view — the sentinel below the deck (`CommandDeck.tsx:311`) reveals the
    // condensed bar, which mounts its OWN chip renderer alongside the (still-mounted) hero one.
    await page.evaluate(() => window.scrollBy(0, 3000));
    await expect(page.getByTestId('connection-chip')).toHaveCount(2); // vacuity guard: 2nd node mounted
    expect(await countInViewport(page, 'connection-chip')).toBe(1);

    await expect(page.getByTestId('tape-stream-state')).toHaveCount(0);
  });
});

// =====================================================================================================
// AC-34 — coarse-pointer 44px effective hit area at 393px, measured in both dimensions, every control
// ruling 5 names as "this phase creates or touches".
// =====================================================================================================

async function expectFloor(locator: Locator, label: string) {
  const box = await locator.boundingBox();
  expect(box, `${label} has a bounding box (is attached and rendered)`).toBeTruthy();
  expect(box!.width, `${label} effective width`).toBeGreaterThanOrEqual(44);
  expect(box!.height, `${label} effective height`).toBeGreaterThanOrEqual(44);
}

test.describe('AC-34 — coarse pointer at 393px: the effective hit area, measured, for every named control', () => {
  test.use({ viewport: { width: 393, height: 852 }, hasTouch: true });

  test('the palette trigger + its rows, the burger drawer + its four links, and FigureCell’s ⓘ all measure ≥44px in both dimensions', async ({
    page,
  }) => {
    await gotoReadyTicker(page);

    // -- "the palette dialog" (its opening trigger — the only tap target a container itself is not)
    // and its rows.
    await page.getByTestId('nav-search-icon').click();
    await expect(page.getByTestId('command-palette')).toBeAttached();
    await expectFloor(page.getByTestId('palette-command-surface-scanner'), 'palette row · Scanner');
    await expectFloor(page.getByTestId('palette-command-surface-ticker'), 'palette row · Ticker');
    await expectFloor(
      page.getByTestId('palette-command-surface-positions'),
      'palette row · Positions',
    );
    await expectFloor(page.getByTestId('palette-command-surface-alerts'), 'palette row · Alerts');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-palette')).toHaveCount(0);
    // The trigger itself — measured AFTER closing, since it also needs to regain focus/be present.
    await expectFloor(page.getByTestId('nav-search-icon'), 'palette trigger (nav-search-icon)');

    // -- the burger drawer (opener + its four links + its close affordance).
    await expectFloor(page.getByTestId('nav-menu-button'), 'burger drawer opener');
    await page.getByTestId('nav-menu-button').click();
    await expect(page.getByTestId('nav-drawer')).toBeVisible();
    for (const entry of ['scanner', 'ticker', 'positions', 'alerts']) {
      await expectFloor(page.getByTestId(`nav-drawer-${entry}`), `drawer link · ${entry}`);
    }
    await expectFloor(page.getByTestId('nav-drawer-close'), 'drawer close button');
    await page.getByTestId('nav-drawer-close').click();
    await expect(page.getByTestId('nav-drawer')).toBeHidden();

    // -- FigureCell's ℹ (the one AC-34 names by name — the affordance this phase turned into a
    // real focusable control). (v2, curvature-v2-desk-and-read FE-8) `dealer-positioning` is
    // deleted; `ladder-foot` (inside `StructureHeroPanel`, the successor mounted in that same
    // page slot) renders at 393px the same way and its Vol-norm GEX cell carries the SAME
    // FigureCell ℹ primitive (the ladder's own rows do not — `LevelLadder.tsx` never passes an
    // `info` prop — so the foot is the nearest equivalent site, not an arbitrary substitute).
    await expectFloor(
      page
        .getByTestId('ladder-foot')
        .getByRole('button', { name: /^About /i })
        .first(),
      "FigureCell's ℹ (ladder-foot)",
    );

    // -- the connection chip: ruling 5's floor applies to it ONLY "if it becomes interactive" — it
    // does not (no onClick, no role="button", not a `button`/`a`), so it is out of scope BY
    // CONSTRUCTION, verified rather than silently skipped.
    const chip = page.getByTestId('connection-chip').first();
    await expect(chip).toBeAttached();
    expect(await chip.evaluate((el) => el.tagName)).not.toBe('BUTTON');
    expect(await chip.getAttribute('role')).not.toBe('button');
  });
});

// =====================================================================================================
// AC-35 — hover-revealed controls have BOTH a tap path and a keyboard-focus path, at 393/834/900/1280
// =====================================================================================================

/** The four "look-alike" widgets ruling 6 names — each keeps its own layout; only the affordance
 *  changed, from a hover-only `Tooltip` wrapping a non-focusable icon to a real `AccessibleHelp`
 *  `button` (`ai-rec/AccessibleHelp.tsx:8-12`, reused verbatim per the ruling).
 *  PASS 2 change 8 (owner ruling `context-band-is-the-designs-card-list`, `/ticker` fidelity repair):
 *  `iv-rank` dropped — `IvRank` no longer mounts on `/ticker` (its card left the context band), so
 *  it is no longer on this page to reach by tap or keyboard. Ruling 6 still named it historically;
 *  the remaining three are still exercised below, plus the `ladder-foot` FigureCell site further
 *  down (the same shipped `AccessibleHelp` primitive/pattern). */
const HOVER_INFO_WIDGETS = ['market-context', 'straddle-move', 'dealer-flow-projection'] as const;

async function assertTapAndKeyboardReveal(page: Page, help: Locator, label: string) {
  await expect(help, `${label} is present`).toBeVisible();
  expect(await help.evaluate((el) => el.tagName), `${label} is a real <button>`).toBe('BUTTON');

  // Native touch checks actionability and scrolls the target into view. Synthetic dispatchEvent
  // could reach offscreen controls and hid the canceled touch-enter timer in AccessibleHelp.
  await help.tap();
  await expect(help, `${label}: tap associates its content`).toHaveAttribute(
    'aria-describedby',
    /\S+/,
  );
  const tooltipId = await help.getAttribute('aria-describedby');
  const tooltip = page.locator(`[role="tooltip"][id=${JSON.stringify(tooltipId)}]`);
  await expect(tooltip, `${label}: tap reveals content`).toBeVisible();
  // Touch activation must survive native compatibility mouse movement on hybrid devices. Use
  // trusted mouse input at the rendered button coordinates directly: locator.hover() waits for
  // layout stability and can outlast MUI's intentional 1500ms touch-dismiss timer on a moving page.
  // That would test natural expiry instead of whether pointer exit replaces it with an immediate
  // close. The tap above already scrolls the trigger into view.
  const bounds = await help.boundingBox();
  expect(bounds, `${label}: trigger remains rendered after tap`).toBeTruthy();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  expect(
    await help.evaluate((el) => el.matches(':hover')),
    `${label}: pointer reaches trigger`,
  ).toBe(true);
  await page.mouse.move(0, 0);
  await expect(help, `${label}: tap remains active after mouse exit`).toHaveAttribute(
    'aria-describedby',
    tooltipId!,
  );
  await expect(tooltip, `${label}: content remains visible after mouse exit`).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tooltip, `${label}: closes`).toBeHidden();
  // Escape closes the MUI Tooltip's `open` state but does not blur the trigger (correct — a real
  // Escape-to-dismiss never un-focuses the control that opened it). Explicitly blur here so the
  // KEYBOARD path below fires a GENUINELY NEW focus event — `.focus()` on an already-focused element
  // is a no-op (no new `focus` event), which would make that check pass or fail for the wrong reason.
  await help.blur();

  // Return through native Tab order so the preceding touch gesture cannot leave the browser in
  // pointer modality. The final focus comes from the keyboard, not a second pointer gesture.
  await help.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(help, `${label}: Tab reaches the trigger`).toBeFocused();
  await expect(tooltip, `${label}: keyboard focus reveals content`).toBeVisible();
  await help.blur();
  await expect(tooltip, `${label}: hides on blur`).toBeHidden();
}

test.describe('AC-35 — the six converted hover-only info sites', () => {
  // `hasTouch` — required for Playwright's native tap; also
  // makes `@media (pointer: coarse)` true, matching a real phone/tablet at every width checked here.
  test.use({ hasTouch: true });

  for (const vp of [
    { label: '393', width: 393, height: 852 },
    { label: '834', width: 834, height: 1112 },
    { label: '900', width: 900, height: 900 },
    { label: '1280', width: 1280, height: 900 },
  ] as const) {
    test(`have a tap AND a keyboard path at ${vp.label}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoReadyTicker(page);

      for (const widget of HOVER_INFO_WIDGETS) {
        const container = page.getByTestId(widget);
        await expect(container, `${widget} is on the page at ${vp.label}px`).toBeAttached();
        const help = container.getByRole('button', { name: /^About /i }).first();
        await assertTapAndKeyboardReveal(page, help, `${widget} @ ${vp.label}px`);
      }

      // The primitive itself (FigureCell's ℹ, shipped in `live-tape`/`ladder-foot` — v2,
      // curvature-v2-desk-and-read FE-8: `dealer-positioning` deleted, re-pointed to `ladder-foot`,
      // the nearest equivalent FigureCell-with-info site; see the AC-34 block above for why) — one
      // concrete site proves the same shipped pattern; the loop above covers three of ruling 6's six
      // (PASS 2 change 8 dropped `iv-rank` — no longer on `/ticker` to reach — leaving three of the
      // original four "look-alike" widgets, plus this one primitive site, still concretely tested).
      const figureHelp = page
        .getByTestId('ladder-foot')
        .getByRole('button', { name: /^About /i })
        .first();
      await assertTapAndKeyboardReveal(page, figureHelp, `FigureCell ℹ @ ${vp.label}px`);
    });
  }
});

// =====================================================================================================
// U-32 (curvature-v2-surfaces, OWNER D-C) — the `Widget` frame's ⓘ, at all SEVEN live `info=` sites
// (was eight — PASS 2 change 8 dropped `iv-rank`, owner ruling `context-band-is-the-designs-card-list`:
// `IvRank` no longer mounts on `/ticker`), scoped to the FRAME ROOT (`widget-{id}`), never a widget's
// own body testid
// =====================================================================================================
//
// This is a SECOND, frame-scoped site list — NOT interchangeable with `HOVER_INFO_WIDGETS` above.
// That list (and `ladder-foot`) proves ruling 6's BODY controls and the `FigureCell` primitive; not
// one of those four assertions can reach a `Widget` frame HEADER, because `Widget.tsx` renders the
// header box before the body box (`:452-453` in source) and every one of those four containers
// scopes to a widget's own BODY testid, one level inside the frame. `straddle-move` passes no `info`
// prop at all, so it has no frame ⓘ and is correctly absent from this list.
const FRAME_INFO_SITES = [
  'off-exchange-blocks',
  'fresh-positioning',
  'market-context',
  'dealer-flow-projection',
  'term-structure',
  'structure-hero',
  'live-tape',
] as const;

// =====================================================================================================
// criterion 66 (FE-13, GATE Z repair below) — the 44px effective hit area at 393px, coarse pointer,
// for the alerts write affordances this phase's SPEC §3 names alongside the seven frame ⓘs (U-32,
// above — was eight; PASS 2 change 8 dropped `iv-rank`) and the off-exchange proximity chip (its own
// dedicated describe block further down).
//
// `expectFloor` HARD-ASSERTS ≥44px on both dimensions. FE-13's own investigation measured two
// controls that did NOT comply (`AlertsPage.tsx:429`'s per-rule "Remove" button, an explicit
// `minHeight: 40` override that beat the shipped global coarse-pointer floor's lower CSS specificity
// — `sx` compiles to a class, `theme.ts:132-137`'s floor is a plain element selector, and a class
// always wins a specificity tie regardless of `@media` nesting; and `AlertsPage.tsx:399-402`'s
// per-rule enable/disable `Switch`, whose own `FormControlLabel` wrapper — the actual clickable
// region, not just the visible switch graphic — measured ~163×25px, well under the floor on the
// height axis). **GATE Z REPAIR (this pass):** both now carry a `'@media (pointer: coarse)'` rule
// nested in the SAME `sx` object (same specificity as the override, later in source order, so it
// wins only when the media condition matches — desktop/fine-pointer sizing is untouched). Both are
// now HARD-ASSERTED below, not merely measured.
test.describe('criterion 66 (FE-13) — the alerts write affordances at 393px, coarse pointer', () => {
  test.use({ viewport: { width: 393, height: 852 }, hasTouch: true });

  const SEEDED_ALERTS_RULE = {
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
    ],
    events: [],
    notifyBrowser: false,
  };

  test.beforeEach(async ({ page }) => {
    await stubNetwork(page);
    await seed(page);
    await page.addInitScript((alerts) => {
      window.localStorage.setItem('convexa.alerts.v1', JSON.stringify(alerts));
    }, SEEDED_ALERTS_RULE);
    await page.goto('/alerts');
    await expect(page.getByTestId('alerts-rule')).toHaveCount(1);
  });

  test('the composer\'s "Add rule" and "Enable browser notify" buttons meet the floor', async ({
    page,
  }) => {
    await expectFloor(page.getByTestId('alerts-add'), 'alerts-add');
    await expectFloor(page.getByTestId('alerts-notify'), 'alerts-notify');
  });

  test('GATE Z REPAIR — the per-rule Remove button and enable/disable switch now meet the floor', async ({
    page,
  }) => {
    const removeButton = page.getByRole('button', { name: 'Remove' }).first();
    const switchLabel = page.locator('.MuiFormControlLabel-root').first();
    const removeBox = await removeButton.boundingBox();
    const switchLabelBox = await switchLabel.boundingBox();
    console.log(
      `[criterion 66 evidence, post-fix] Remove button (AlertsPage.tsx:429) = ${JSON.stringify(removeBox)} · ` +
        `rule Switch's FormControlLabel (AlertsPage.tsx:399-402) = ${JSON.stringify(switchLabelBox)}`,
    );
    await expectFloor(removeButton, 'per-rule Remove button (coarse pointer)');
    await expectFloor(
      switchLabel,
      "per-rule enable/disable Switch's FormControlLabel (coarse pointer)",
    );
  });
});

// =====================================================================================================
// criterion 66 (GATE Z repair) — the off-exchange proximity chip's effective hit area at 393px,
// coarse pointer. FE-13 flagged this as the SAME under-floor mechanism (a focusable `<span>`, never a
// `button`/`role="button"`/`a`, so `theme.ts`'s coarse-pointer floor selector never matches) but could
// not reach a rendered instance in its own session (no off_exchange data in either file's shared
// `bundle` fixture — "Off-exchange data unavailable this cycle." renders instead, with no chip in the
// DOM at all). This block supplies a local `/api/ticker/**` override (own fixture, not the shared
// `bundle`, so no other test in this file is affected) carrying one real block print, making the chip
// reachable for the first time this phase.
test.describe('criterion 66 (GATE Z repair) — the off-exchange proximity chip at 393px, coarse pointer', () => {
  test.use({ viewport: { width: 393, height: 852 }, hasTouch: true });

  test('the proximity chip meets the 44px floor', async ({ page }) => {
    await stubNetwork(page);
    await page.route('**/api/ticker/**', (route) =>
      route.fulfill({
        json: {
          ...bundle,
          off_exchange: {
            block_min_shares: 10000,
            blocks: [
              {
                shares: 25000,
                price: 251.4,
                proximity_pct: 0.004,
                age_seconds: 120,
                notional: 6_285_000,
              },
            ],
            levels: [],
            note: 'e2e fixture',
            offex_shares: 25000,
            ratio_pct: 4.2,
            total_shares: 500000,
          },
        },
      }),
    );
    await seed(page);
    await page.goto('/ticker/TSLA');
    await expect(page.getByText('Call wall').first()).toBeAttached();

    const frame = page.getByTestId('widget-off-exchange-blocks');
    await expect(frame, 'off-exchange-blocks frame is on the page').toBeAttached();
    // VACUITY GUARD — the block print itself (not just the frame) actually rendered, so the chip
    // beside it is real, not measuring an empty/unavailable state.
    await expect(frame.getByText('25,000 sh @ $251.40')).toBeAttached();

    const chip = frame.locator('span[tabindex="0"]').first();
    const box = await chip.boundingBox();
    console.log(
      `[criterion 66 evidence] off-exchange proximity chip (OffExchangeBlocks.tsx:113-123) = ${JSON.stringify(box)}`,
    );
    await expectFloor(chip, 'off-exchange proximity chip (coarse pointer)');
  });
});

test.describe('U-32 (SB) — the Widget frame header ⓘ at all seven frame roots (hero + tape included)', () => {
  test.use({ hasTouch: true });

  for (const vp of [
    { label: '393', width: 393, height: 852 },
    { label: '834', width: 834, height: 1112 },
    { label: '900', width: 900, height: 900 },
    { label: '1280', width: 1280, height: 900 },
  ] as const) {
    test(`every frame's header ⓘ has a tap AND a keyboard path at ${vp.label}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoReadyTicker(page);

      for (const id of FRAME_INFO_SITES) {
        const frame = page.getByTestId(`widget-${id}`);
        await expect(frame, `widget-${id} is on the page at ${vp.label}px`).toBeAttached();
        // `.first()` resolves to the frame's OWN header control (not a body control one level
        // down) only because the header renders before the body AND carries the `About {title}`
        // prefix (SPEC §2.8) — the mechanical reason a rename or a dropped prefix must fail this.
        const help = frame.getByRole('button', { name: /^About /i }).first();
        await assertTapAndKeyboardReveal(page, help, `widget-${id} frame ⓘ @ ${vp.label}px`);
      }
    });
  }
});

// =====================================================================================================
// AC-20b — the rendered container-query step
// =====================================================================================================
//
// HONEST FALLBACK (PLAN's own sanctioned exit): "if two differently-sized panels cannot be produced
// without re-laying out a surface: drop to `review` with both measured sizes written into the build
// report — never to a jsdom row asserting style text."
//
// That was the case at phase 1 (LiveTape + the old dealer positioning widget). (v2,
// curvature-v2-desk-and-read FE-8: that widget is deleted, its walls-and-foot content re-pointed
// into `StructureHeroPanel`'s own `LevelLadder`, ALSO a `FigureCell` consumer.) `LiveTape` and
// `StructureHeroPanel` are BOTH mounted with `span={2}` (`LiveTape.tsx:133`, `StructureHeroPanel.
// tsx` — "Bento column span" `Widget.tsx:63`) — full bento width at every breakpoint the grid has
// (`md`+: `gridColumn: 'span 2'`; below `md`: the grid itself is one column, so still full width).
// Neither ever renders inside a narrower context (the widget "expand" dialog is `maxWidth="lg"` —
// WIDER, not narrower — `Widget.tsx:443`). Making a narrow pair requires giving one of them
// `span={1}` or inventing a new narrow slot — a real layout change this phase's own non-goals
// forbid (PLAN's scope discipline, same shape as ruling 5's).
//
// This test therefore does not assert AC-20b pass/fail. It captures REAL browser measurements (the
// declaration cannot be jsdom-verified as a rendered value — that is exactly why AC-20b exists) at
// the one viewport where the panel is narrowest (393px, single-column bento — the closest this page
// gets to the 360px step boundary), and reports them for `BUILD_REPORT.md`. AC-20a (the
// DECLARATION — `type-floor.spec.tsx`'s hardened reader) stays the enforced, green test; AC-20b is
// recorded evidence, not a gate.
test('AC-20b (review-only evidence) — rendered font-size of a traced FigureCell value, both panels, one viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await gotoReadyTicker(page);

  const liveTapeSize = await page
    .getByTestId('live-tape')
    .locator('[data-figure-register="mono"]')
    .first()
    .evaluate((el) => getComputedStyle(el).fontSize);
  // (v2, curvature-v2-desk-and-read FE-8) `dealer-positioning` deleted; `level-ladder` (inside the
  // SAME `span={2}` `StructureHeroPanel` that took its page slot) is the re-pointed second site —
  // its `FigureCell`s are ALSO `register="traced"` (mono), so this remains a like-for-like compare.
  const structureHeroSize = await page
    .getByTestId('level-ladder')
    .locator('[data-figure-register="mono"]')
    .first()
    .evaluate((el) => getComputedStyle(el).fontSize);

  console.log(
    `[AC-20b evidence] 393px viewport, single-column bento (both widgets span=2, so both panels ` +
      `are the SAME width by construction): live-tape=${liveTapeSize} level-ladder=${structureHeroSize}`,
  );

  // The only assertion made: BOTH values are real, valid computed sizes (the traced figures did
  // render, so the numbers going into the build report are not a measurement of a blank page).
  expect(liveTapeSize).toMatch(/^\d+(\.\d+)?px$/);
  expect(structureHeroSize).toMatch(/^\d+(\.\d+)?px$/);
});
