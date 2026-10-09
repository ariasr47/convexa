import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * curvature-v2-foundations — FE-10's own new spec (PLAN §"FE-10 — The browser layer"). Two groups,
 * each covering a browser-only AC that jsdom cannot see:
 *
 *   - AC-35 — the six converted hover-only info sites (ruling 6) have BOTH a tap and a keyboard-focus
 *     path, at 393/834/900/1280.
 *   - U-32 (curvature-v2-surfaces, OWNER D-C, added by FE-12) — a SECOND, frame-scoped site list:
 *     all SEVEN live `<Widget info=…>` sites (was eight — PASS 2 change 8 dropped `iv-rank`, which
 *     no longer mounts on `/ticker`), asserted at the frame root `widget-{id}` (hero and live tape
 *     included), on the frame's own HEADER ⓘ specifically — the shipped AC-35 list above and
 *     `ladder-foot` scope to widget/hero BODY testids one level inside the frame and cannot reach a
 *     frame header at all (`Widget.tsx` renders the header box before the body box).
 *
 * The AC-1a, AC-34, criterion 66 and AC-20b groups were retired in lean-tests batch 81. The eight
 * AC-35/U-32 cases stay separate until the AC-35 tap-race fix (PR #76) lands.
 *
 * NETWORK — a self-contained `stubNetwork`/`seed` pair, deliberately not imported from the
 * overflow spec, since retired (that file did not export them, and widening its export surface
 * for one consumer is a bigger change than duplicating the minimal shape this file's own
 * assertions need).
 * The one addition beyond that file's idiom: the SSE stub delivers a REAL `data: {...}\n\n` frame so
 * `live` genuinely latches (ruling 1).
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

/**
 * A REAL touch tap — `touchstart` then a brief hold then `touchend` — not Playwright's `.tap()`
 * convenience method, which dispatches `touchstart`/`touchend` back-to-back with no gap at all.
 * That atomic pairing is faster than any human finger (a real tap always has *some* contact
 * duration) and, measured live, is fast enough to race MUI's own `setTimeout`-scheduled tooltip
 * "enter" callback even at `enterTouchDelay={0}` (`AccessibleHelp.tsx`) — a 0ms delay still yields
 * to the next tick, and `.tap()`'s `touchend` can land in the SAME tick as its `touchstart`. A 40ms
 * hold is comfortably past that, and comfortably under what a user would perceive as a long press.
 */
async function realisticTap(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('realisticTap: target has no bounding box');
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await locator.dispatchEvent('touchstart', {
    touches: [{ identifier: 0, clientX: point.x, clientY: point.y }],
    changedTouches: [{ identifier: 0, clientX: point.x, clientY: point.y }],
  });
  await new Promise((resolve) => setTimeout(resolve, 40));
  await locator.dispatchEvent('touchend', { touches: [], changedTouches: [] });
}

async function assertTapAndKeyboardReveal(page: Page, help: Locator, label: string) {
  await expect(help, `${label} is present`).toBeVisible();
  expect(await help.evaluate((el) => el.tagName), `${label} is a real <button>`).toBe('BUTTON');

  // TAP path — a genuine touch tap (see `realisticTap` above) reveals the info content. This is
  // the code path AC-35/ruling 6 actually names ("reachable by tap") and the one a mouse `.click()`
  // never exercises at all: MUI `Tooltip`'s touch handling is entirely separate from its
  // hover/focus handling (`enterTouchDelay`, `AccessibleHelp.tsx`).
  await realisticTap(help);
  await expect(page.locator('[role="tooltip"]'), `${label}: tap reveals content`).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="tooltip"]'), `${label}: closes`).toBeHidden();
  // Escape closes the MUI Tooltip's `open` state but does not blur the trigger (correct — a real
  // Escape-to-dismiss never un-focuses the control that opened it). Explicitly blur here so the
  // KEYBOARD path below fires a GENUINELY NEW focus event — `.focus()` on an already-focused element
  // is a no-op (no new `focus` event), which would make that check pass or fail for the wrong reason.
  await help.blur();

  // KEYBOARD path — focus alone (no pointer at all) reveals the SAME content, because it is a real
  // `<button>` (native tab order) wrapped by a `Tooltip` that opens `onFocus`, not a hover-only one.
  await help.focus();
  await expect(
    page.locator('[role="tooltip"]'),
    `${label}: keyboard focus reveals content`,
  ).toBeVisible();
  await help.blur();
  await expect(page.locator('[role="tooltip"]'), `${label}: hides on blur`).toBeHidden();
}

test.describe('AC-35 — the six converted hover-only info sites', () => {
  // `hasTouch` — required for `realisticTap`'s manual touch-event dispatch to mean anything; also
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
