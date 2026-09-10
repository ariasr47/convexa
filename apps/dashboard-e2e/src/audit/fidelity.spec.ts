import { test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  accessibilityScenarios,
  visualScenarios,
  type Scenario,
} from '../quality/fixtures/scenarios';
import { installScenario } from '../quality/fixtures/strict-fixture';
import { assertReady } from '../quality/readiness';
import { installVisualFrameController } from '../quality/visual-frame';

/**
 * Design-fidelity survey — see `playwright.audit.config.ts` for what this is and is not.
 *
 * Every capture writes `<side>/<id>.png` (full page, DPR 1) and `<side>/<id>.json` with the page
 * height, horizontal-overflow flag, console errors, a census of the page's regions (app: every
 * `data-testid` element of meaningful size; design: every `.panel` / `.wrap` / nav) and a handful
 * of computed-style probes (fonts, panel radius, panel colours). The report is written by hand from
 * those numbers; this file only observes.
 */

const OUT: string = (() => {
  const out = process.env.AUDIT_OUT;
  if (!out) throw new Error('AUDIT_OUT must name the evidence folder');
  return out;
})();
const DESIGN = 'http://localhost:4310';
const LIVE = process.env.AUDIT_LIVE === '1';
const FONT_ROOT = path.resolve(__dirname, '../../../dashboard/public/fonts');

type Scheme = 'dark' | 'light';
type Width = 1440 | 1280 | 834 | 390;
type Region = { key: string; x: number; y: number; w: number; h: number; text: string };
type Capture = {
  id: string;
  side: 'app' | 'design';
  surface: string;
  state: string;
  width: Width;
  scheme: Scheme;
  url: string;
  pageHeight: number;
  /** Real content bottom: max(region.y + region.h). `pageHeight` is `scrollHeight`, which reads
   *  the grown 1800 px viewport (not the content) when `settle()` enlarged it for a page that fit —
   *  Alerts and Scanner do after the surfaces repair. Compare THIS across app|design. */
  contentBottom: number;
  overflowX: boolean;
  scrollWidth: number;
  consoleErrors: string[];
  regions: Region[];
  probes: Record<string, string | number | boolean | null>;
  panels: { key: string; radius: string; background: string; border: string; shadow: string }[];
  png: string;
};

const byId = (list: readonly Scenario[], id: string) => {
  const found = list.find((s) => s.id === id);
  if (!found) throw new Error(`scenario ${id} is not registered`);
  return found;
};

/** Clone a registered scenario at another width / scheme / route without touching its REST map. */
function variant(
  source: Scenario,
  opts: {
    id: string;
    width: Width;
    scheme: Scheme;
    route?: string;
    ready: Scenario['ready'];
    seed?: Record<string, unknown>;
    /** replaces every `GET /api/ticker/SPY*` body — a full MarketWire bundle */
    bundle?: unknown;
  },
): Scenario {
  const sessionKey = 'GET /api/auth/session';
  const sessionResponse = source.rest[sessionKey];
  if (!sessionResponse) throw new Error(`${source.id} has no session response to patch`);
  const session = JSON.parse(sessionResponse.body) as {
    settings: null | { theme: string };
  };
  // Signed-in: the session's `settings.theme` wins over the local pref (see no-overflow.spec.ts),
  // so a light capture of an authenticated route has to patch the session body too.
  const rest: Scenario['rest'] = {
    ...source.rest,
    [sessionKey]: {
      ...sessionResponse,
      body: JSON.stringify({
        ...session,
        settings: session.settings ? { ...session.settings, theme: opts.scheme } : null,
      }),
    },
  };
  if (opts.bundle !== undefined) {
    for (const key of Object.keys(rest)) {
      if (key.startsWith('GET /api/ticker/SPY'))
        rest[key] = { ...rest[key], body: JSON.stringify(opts.bundle) };
    }
  }
  return {
    ...source,
    id: opts.id,
    route: opts.route ?? source.route,
    viewport: { width: opts.width, height: 900 },
    colorScheme: opts.scheme,
    durableSeed: {
      ...source.durableSeed,
      'convexa.uiprefs.v1': { schema_version: 1, theme: opts.scheme },
      ...(opts.seed ?? {}),
    },
    rest,
    ready: opts.ready,
  };
}

// A populated alerts book, mirroring no-overflow.spec.ts's SEEDED_ALERTS (shape read from
// features/alerts/types.ts there; a malformed seed latches the store's read-fault guard).
const SEEDED_ALERTS = {
  schema_version: 1,
  rules: [
    {
      id: 'audit-rule-price',
      kind: 'level_touch',
      symbol: 'TSLA',
      enabled: true,
      createdAt: 1_700_000_000_000,
      level: 'price',
      priceThreshold: 260,
    },
    {
      id: 'audit-rule-score',
      kind: 'score_gate',
      symbol: 'SPY',
      enabled: true,
      createdAt: 1_700_000_100_000,
      scoreMin: 70,
    },
  ],
  events: [
    {
      id: 'audit-event-1',
      ruleId: 'audit-rule-price',
      kind: 'level_touch',
      symbol: 'TSLA',
      message: 'TSLA touched $260 (price threshold)',
      at: 1_700_000_200_000,
      detail: 'Snapshot at $260.12, call wall $260',
      read: true,
    },
    {
      id: 'audit-event-2',
      ruleId: 'audit-rule-score',
      kind: 'score_gate',
      symbol: 'SPY',
      message: 'SPY score crossed 70',
      at: 1_700_000_300_000,
      read: true,
    },
    {
      id: 'audit-event-3',
      ruleId: 'audit-rule-price',
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

// Page-root testids that exist at every width (the registered scenarios' own `ready` selectors are
// width-specific — `scan-table` is `scan-cards` under 1000px).
const READY: Record<'desk' | 'scanner' | 'positions' | 'alerts' | 'settings', Scenario['ready']> = {
  desk: [{ selector: '[data-testid="widget-bento"]' }],
  scanner: [{ selector: '[data-testid="scanner-page"]' }],
  positions: [{ selector: '[data-testid="portfolio-panel"]' }],
  alerts: [{ selector: '[data-testid="alerts-page"]' }],
  settings: [{ selector: '[data-testid="settings-page"]' }],
};

const aiRec = byId(visualScenarios, 'ai-recommendation'); // authenticated, in-app AI enabled
const tickerAnon = byId(visualScenarios, 'ticker-desktop'); // anonymous desk (phase-2 QA baseline)
const scannerDense = byId(visualScenarios, 'scanner-dense');
const positionsDense = byId(visualScenarios, 'positions-dense');
const settingsA11y = byId(accessibilityScenarios, 'A11Y-4');

// ---- the matrix -----------------------------------------------------------------------------------
type Plan = {
  surface: string;
  state: string;
  width: Width;
  scheme: Scheme;
  app: Scenario;
  /** run after readiness, before the freeze (e.g. click Analyze) */
  appAct?: (page: Page) => Promise<void>;
  designPath: string;
  designState?: (page: Page) => Promise<void>;
  /** no fixture: real backend through the dev-server proxy (anonymous surfaces only) */
  live?: true;
  /** replace the fixture's thin SSE event with a contract-complete LiveUpdateBody */
  stream?: { mid: number; gammaFlip: number | null };
};

/**
 * The strict fixture's stream event is `{ticker, mid, last_trade, net_flow, live}` — it omits
 * `market_session`, which the schema requires, so the connection chip renders `live · undefined`
 * (`connection/copy.ts:112` falls through to the raw field). Page routes win over context routes,
 * so this replaces just that one endpoint with a complete body at the bundle's own mid.
 */
async function mockStream(
  page: Page,
  stream: { mid: number; gammaFlip: number | null },
  now: string,
) {
  const body = {
    ticker: 'SPY',
    mid: stream.mid,
    last_trade: stream.mid,
    bid: Math.round((stream.mid - 0.01) * 100) / 100,
    ask: Math.round((stream.mid + 0.01) * 100) / 100,
    net_flow: 1250,
    buy_vol: 4200,
    sell_vol: 2950,
    feed: 'audit-fixture',
    flow_window_s: 300,
    gamma_flip: stream.gammaFlip,
    live: true,
    market_session: 'regular',
    spot_ts: Math.floor(Date.parse(now) / 1000),
  };
  await page.route('**/api/stream/SPY', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: `data: ${JSON.stringify(body)}\n\n`,
    }),
  );
}

const plans: Plan[] = [];
const deskDesign = (readState: string, width: Width) => async (page: Page) => {
  await page.evaluate(
    ({ readState, sheet }) => {
      const w = window as unknown as { deskSetProps?: (p: Record<string, unknown>) => void };
      w.deskSetProps?.({ readState, live: true, sheet });
    },
    { readState, sheet: width === 390 ? 'peek' : 'open' },
  );
};
const analyze = async (page: Page) => {
  await page.getByRole('button', { name: 'Analyze current snapshot' }).click();
  await page.getByTestId('ai-rec-decision-card').waitFor({ state: 'visible' });
};

if (!LIVE) {
  for (const width of [1440, 1280, 834, 390] as Width[]) {
    for (const state of ['idle', 'trade'] as const) {
      plans.push({
        surface: 'desk',
        state,
        width,
        scheme: 'dark',
        app: variant(aiRec, {
          id: `desk-${state}-${width}-dark`,
          width,
          scheme: 'dark',
          ready: READY.desk,
        }),
        appAct: state === 'trade' ? analyze : undefined,
        designPath: '/desk.html',
        designState: deskDesign(state, width),
      });
    }
  }
  plans.push({
    surface: 'desk',
    state: 'trade',
    width: 1280,
    scheme: 'light',
    app: variant(aiRec, {
      id: 'desk-trade-1280-light',
      width: 1280,
      scheme: 'light',
      ready: READY.desk,
    }),
    appAct: analyze,
    designPath: '/desk.html',
    designState: deskDesign('trade', 1280),
  });
  plans.push({
    surface: 'desk',
    state: 'signed-out',
    width: 1280,
    scheme: 'dark',
    app: variant(tickerAnon, {
      id: 'desk-signed-out-1280-dark',
      width: 1280,
      scheme: 'dark',
      ready: READY.desk,
    }),
    designPath: '/desk.html',
    designState: deskDesign('signed_out', 1280),
  });
  for (const width of [1440, 1280, 834, 390] as Width[]) {
    plans.push({
      surface: 'scanner',
      state: 'dense',
      width,
      scheme: 'dark',
      app: variant(scannerDense, {
        id: `scanner-dense-${width}-dark`,
        width,
        scheme: 'dark',
        ready: READY.scanner,
      }),
      designPath: '/scanner.html',
    });
  }
  plans.push({
    surface: 'scanner',
    state: 'dense',
    width: 1280,
    scheme: 'light',
    app: variant(scannerDense, {
      id: 'scanner-dense-1280-light',
      width: 1280,
      scheme: 'light',
      ready: READY.scanner,
    }),
    designPath: '/scanner.html',
  });
} else {
  // Live mode: the anonymous desk and scanner against the real API. The AI read is therefore in its
  // signed-out state (design `signed_out`), and the market phase is whatever the clock says.
  for (const width of [1440, 1280, 834, 390] as Width[]) {
    plans.push({
      surface: 'desk',
      state: 'live-anon',
      width,
      scheme: 'dark',
      live: true,
      app: variant(tickerAnon, {
        id: `desk-live-anon-${width}-dark`,
        width,
        scheme: 'dark',
        ready: READY.desk,
      }),
      designPath: '/desk.html',
      designState: deskDesign('signed_out', width),
    });
    plans.push({
      surface: 'scanner',
      state: 'live-anon',
      width,
      scheme: 'dark',
      live: true,
      app: variant(scannerDense, {
        id: `scanner-live-anon-${width}-dark`,
        width,
        scheme: 'dark',
        ready: READY.scanner,
      }),
      designPath: '/scanner.html',
    });
  }
  plans.push({
    surface: 'desk',
    state: 'live-anon',
    width: 1280,
    scheme: 'light',
    live: true,
    app: variant(tickerAnon, {
      id: 'desk-live-anon-1280-light',
      width: 1280,
      scheme: 'light',
      ready: READY.desk,
    }),
    designPath: '/desk.html',
    designState: deskDesign('signed_out', 1280),
  });
}
// The real SPY bundle the local API served on 2026-09-08 10:59 UTC (pre-market): 483 strikes, walls
// 760 / 780, flip 771.3, max pain 755, and `market_state` carries term structure, IV rank, straddle
// move, dealer-flow projection and market context — so the desk renders populated, deterministically,
// without the vendor feed (which was flapping when this ran). Setups / dark pool / expirations are
// null in it, so those arms render their honest empty states.
const REAL_BUNDLE_PATH = path.join(OUT, '_tools', 'spy-bundle-2026-09-08T1059Z.json');
const realBundle = fs.existsSync(REAL_BUNDLE_PATH)
  ? (JSON.parse(fs.readFileSync(REAL_BUNDLE_PATH, 'utf8')) as {
      market_state: { price: number; gamma_flip: number | null };
    })
  : null;
if (realBundle && !LIVE) {
  const stream = {
    mid: realBundle.market_state.price,
    gammaFlip: realBundle.market_state.gamma_flip ?? null,
  };
  for (const width of [1440, 1280, 834, 390] as Width[]) {
    plans.push({
      surface: 'desk',
      state: 'real',
      width,
      scheme: 'dark',
      stream,
      app: variant(aiRec, {
        id: `desk-real-${width}-dark`,
        width,
        scheme: 'dark',
        ready: READY.desk,
        bundle: realBundle,
      }),
      designPath: '/desk.html',
      designState: deskDesign('idle', width),
    });
  }
  plans.push({
    surface: 'desk',
    state: 'real',
    width: 1280,
    scheme: 'light',
    stream,
    app: variant(aiRec, {
      id: 'desk-real-1280-light',
      width: 1280,
      scheme: 'light',
      ready: READY.desk,
      bundle: realBundle,
    }),
    designPath: '/desk.html',
    designState: deskDesign('idle', 1280),
  });
}

for (const width of [1440, 1280, 390] as Width[]) {
  plans.push({
    surface: 'positions',
    state: 'dense',
    width,
    scheme: 'dark',
    app: variant(positionsDense, {
      id: `positions-dense-${width}-dark`,
      width,
      scheme: 'dark',
      ready: READY.positions,
    }),
    designPath: '/positions.html',
  });
  plans.push({
    surface: 'alerts',
    state: 'seeded',
    width,
    scheme: 'dark',
    app: variant(positionsDense, {
      id: `alerts-seeded-${width}-dark`,
      width,
      scheme: 'dark',
      route: '/alerts',
      ready: READY.alerts,
      seed: { 'convexa.alerts.v1': SEEDED_ALERTS },
    }),
    designPath: '/alerts.html',
  });
  plans.push({
    surface: 'settings',
    state: 'signed-in',
    width,
    scheme: 'dark',
    app: variant(settingsA11y, {
      id: `settings-${width}-dark`,
      width,
      scheme: 'dark',
      ready: READY.settings,
    }),
    designPath: '/settings.html',
  });
}

/** Live mode: no fixture — just the viewport, the scheme and the local theme pref. */
async function liveSetup(page: Page, scenario: Scenario) {
  await page.setViewportSize(scenario.viewport);
  await page.emulateMedia({ colorScheme: scenario.colorScheme, reducedMotion: 'reduce' });
  await page.addInitScript(
    ({ theme }) => {
      localStorage.setItem('convexa.uiprefs.v1', JSON.stringify({ schema_version: 1, theme }));
    },
    { theme: scenario.colorScheme },
  );
}

/**
 * Mount everything and hold the LIVE state before capturing. Three things the quality gate's
 * `freezeVisualFrame` does are wrong for a survey: its +30 s clock jump trips the stream watchdog
 * (captures read "Live offline" instead of live), the context-band widgets mount on intersection so
 * an unscrolled full-page shot leaves them empty, and freezing rAF before first paint leaves the
 * structure-field canvas blank. So: scroll through, let fonts and skeletons settle, wait for the
 * connection chip to say live (when the page has one), THEN freeze rAF so canvases hold still.
 */
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = Math.max(400, innerHeight - 100);
    for (let y = 0; y < document.documentElement.scrollHeight + step; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
  });
}

async function settle(page: Page) {
  await scrollThrough(page);
  // `Widget.tsx:362` sets `content-visibility: auto` + `contain-intrinsic-size: 480px 320px`: a
  // full-page shot paints off-screen widgets as blank 116 px frames at their placeholder height, and
  // the census measures the placeholder. Force paint for the capture, then re-walk so it lays out.
  await page.addStyleTag({
    content:
      '[data-testid^="widget-"]{content-visibility:visible !important;contain-intrinsic-size:auto !important}',
  });
  await scrollThrough(page);
  // A page whose only scroller is internal (`ScanTable.tsx:302` overflowY auto) is exactly one
  // viewport tall, so give it room and let the pane grow before measuring.
  const fits = await page.evaluate(
    () => document.documentElement.scrollHeight <= document.documentElement.clientHeight + 4,
  );
  if (fits) {
    const width = page.viewportSize()?.width ?? 1280;
    await page.setViewportSize({ width, height: 1800 });
    await page.waitForTimeout(300);
    await scrollThrough(page);
  }
  await page.evaluate(() => document.fonts.ready);
  if ((await page.locator('[data-testid="connection-chip"]').count()) > 0) {
    await page
      .locator('[data-testid="connection-chip"][data-connection-state="live"]')
      .first()
      .waitFor({ state: 'attached', timeout: 5_000 })
      .catch(() => undefined);
  }
  await page
    .waitForFunction(() => document.querySelectorAll('.MuiSkeleton-root').length === 0, undefined, {
      timeout: 8_000,
    })
    .catch(() => undefined);
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const w = window as unknown as { __qualityFreezeVisualFrame?: () => void };
    w.__qualityFreezeVisualFrame?.();
  });
}

// ---- observation helpers --------------------------------------------------------------------------
async function census(page: Page, side: 'app' | 'design'): Promise<Region[]> {
  return page.evaluate((side) => {
    const out: { key: string; x: number; y: number; w: number; h: number; text: string }[] = [];
    const push = (el: Element, key: string) => {
      const r = el.getBoundingClientRect();
      if (r.width < 120 || r.height < 24) return;
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
      out.push({
        key,
        x: Math.round(r.x + scrollX),
        y: Math.round(r.y + scrollY),
        w: Math.round(r.width),
        h: Math.round(r.height),
        text,
      });
    };
    if (side === 'app') {
      document
        .querySelectorAll<HTMLElement>('[data-testid]')
        .forEach((el) => push(el, el.dataset.testid ?? ''));
    } else {
      document.querySelectorAll('header.nav-bar').forEach((el) => push(el, 'nav-bar'));
      document
        .querySelectorAll('section.wrap, div.wrap')
        .forEach((el, i) => push(el, `wrap:${i}:${String(el.className).replace(/\s+/g, '.')}`));
      document.querySelectorAll('.panel').forEach((el, i) => {
        const head = el.querySelector('.caps, .display, h1, h2, h3, .head, .title');
        push(
          el,
          `panel:${i}:${String(el.className).replace(/\s+/g, '.')}${head ? ':' + (head.textContent ?? '').trim().slice(0, 32) : ''}`,
        );
      });
      document
        .querySelectorAll(
          '.ctx-grid, .work, .side, .strip, .field-grid, .scan-table, .pos-table, .rail',
        )
        .forEach((el) => push(el, `block:${String(el.className).replace(/\s+/g, '.')}`));
    }
    return out;
  }, side);
}

/** The first eight panel frames' chrome — radius, fill, hairline, elevation — for the token audit. */
async function panelStyles(page: Page, side: 'app' | 'design') {
  return page.evaluate((side) => {
    const sel =
      side === 'app'
        ? '[data-testid^="widget-"], [data-testid$="-panel"], [data-testid="command-deck"]'
        : '.panel';
    const out: {
      key: string;
      radius: string;
      background: string;
      border: string;
      shadow: string;
    }[] = [];
    document.querySelectorAll(sel).forEach((el, i) => {
      if (i >= 8) return;
      const c = getComputedStyle(el);
      out.push({
        key:
          el.getAttribute('data-testid') ??
          `${el.tagName.toLowerCase()}.${String(el.className).split(/\s+/).slice(0, 3).join('.')}`,
        radius: c.borderRadius,
        background: c.backgroundColor,
        border: `${c.borderTopWidth} ${c.borderTopStyle} ${c.borderTopColor}`,
        shadow: c.boxShadow.slice(0, 80),
      });
    });
    return out;
  }, side);
}

async function probes(page: Page, side: 'app' | 'design') {
  return page.evaluate((side) => {
    const cs = (el: Element | null) => (el ? getComputedStyle(el) : null);
    const html = cs(document.documentElement);
    const body = cs(document.body);
    const panel = document.querySelector(
      side === 'app'
        ? '[data-testid^="widget-"], [data-testid$="-panel"], .MuiPaper-root'
        : '.panel',
    );
    const p = cs(panel);
    const mono = document.querySelector(
      side === 'app'
        ? '[data-figure-state] [class*="value"], [data-testid="figure-value"], .mono'
        : '.mono',
    );
    const m = cs(mono);
    const bg = (s: CSSStyleDeclaration | null) => (s ? s.backgroundColor : null);
    return {
      connectionState:
        document
          .querySelector('[data-testid="connection-chip"]')
          ?.getAttribute('data-connection-state') ?? null,
      skeletons: document.querySelectorAll('.MuiSkeleton-root').length,
      // Type register (canon 13): how many text-bearing elements resolve to each family.
      ...(() => {
        const counts = {
          monoElements: 0,
          sansElements: 0,
          archivoElements: 0,
          otherFontElements: 0,
        };
        document.querySelectorAll('body *').forEach((el) => {
          const hasText = Array.from(el.childNodes).some(
            (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
          );
          if (!hasText) return;
          const ff = getComputedStyle(el).fontFamily.toLowerCase();
          if (ff.includes('plex mono')) counts.monoElements += 1;
          else if (ff.includes('archivo')) counts.archivoElements += 1;
          else if (ff.includes('plex sans')) counts.sansElements += 1;
          else counts.otherFontElements += 1;
        });
        return counts;
      })(),
      htmlBackground: bg(html),
      bodyBackground: bg(body),
      bodyFont: body?.fontFamily ?? null,
      bodyFontSize: body?.fontSize ?? null,
      panelSelector: panel
        ? (panel.getAttribute('data-testid') ?? panel.className.toString().slice(0, 60))
        : null,
      panelRadius: p?.borderRadius ?? null,
      panelBackground: bg(p),
      panelBorder: p ? `${p.borderTopWidth} ${p.borderTopStyle} ${p.borderTopColor}` : null,
      monoFont: m?.fontFamily ?? null,
      fontsLoaded: document.fonts.status,
      archivoLoaded: document.fonts.check('700 40px Archivo'),
      plexMonoLoaded: document.fonts.check('500 14px "IBM Plex Mono"'),
      plexSansLoaded: document.fonts.check('400 13px "IBM Plex Sans"'),
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  }, side);
}

async function record(
  page: Page,
  capture: Omit<
    Capture,
    | 'pageHeight'
    | 'contentBottom'
    | 'overflowX'
    | 'scrollWidth'
    | 'consoleErrors'
    | 'regions'
    | 'probes'
    | 'panels'
    | 'png'
  >,
  errors: string[],
) {
  const pr = await probes(page, capture.side);
  const regions = await census(page, capture.side);
  const panels = await panelStyles(page, capture.side);
  const png = `${capture.side}/${capture.id}.png`;
  await page.screenshot({
    path: path.join(OUT, png),
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  });
  const full: Capture = {
    ...capture,
    pageHeight: pr.scrollHeight,
    contentBottom: regions.reduce((m, r) => Math.max(m, r.y + r.h), 0),
    overflowX: pr.scrollWidth > pr.clientWidth,
    scrollWidth: pr.scrollWidth,
    consoleErrors: errors,
    regions,
    probes: pr,
    panels,
    png,
  };
  fs.writeFileSync(
    path.join(OUT, `${capture.side}/${capture.id}.json`),
    JSON.stringify(full, null, 2) + '\n',
  );
  return full;
}

/** Serve the design site's Google Fonts request from the app's self-hosted files (same faces). */
async function localFonts(context: BrowserContext) {
  const faces = [
    [
      'Archivo',
      '100 900',
      'archivo/archivo-latin-standard-normal.woff2',
      'woff2-variations',
      '62% 125%',
    ],
    ['IBM Plex Sans', '400', 'ibm-plex-sans/ibm-plex-sans-latin-400-normal.woff2', 'woff2', ''],
    ['IBM Plex Sans', '500', 'ibm-plex-sans/ibm-plex-sans-latin-500-normal.woff2', 'woff2', ''],
    ['IBM Plex Sans', '600', 'ibm-plex-sans/ibm-plex-sans-latin-600-normal.woff2', 'woff2', ''],
    ['IBM Plex Sans', '700', 'ibm-plex-sans/ibm-plex-sans-latin-700-normal.woff2', 'woff2', ''],
    ['IBM Plex Mono', '400', 'ibm-plex-mono/ibm-plex-mono-latin-400-normal.woff2', 'woff2', ''],
    ['IBM Plex Mono', '500', 'ibm-plex-mono/ibm-plex-mono-latin-500-normal.woff2', 'woff2', ''],
    ['IBM Plex Mono', '600', 'ibm-plex-mono/ibm-plex-mono-latin-600-normal.woff2', 'woff2', ''],
  ] as const;
  const css = faces
    .map(
      ([family, weight, file, fmt, stretch]) =>
        `@font-face{font-family:'${family}';font-style:normal;font-display:block;font-weight:${weight};${stretch ? `font-stretch:${stretch};` : ''}src:url('https://fonts.gstatic.com/convexa/${file}') format('${fmt}');}`,
    )
    .join('\n');
  await context.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: css }),
  );
  await context.route('https://fonts.gstatic.com/convexa/**', (route) => {
    const rel = new URL(route.request().url()).pathname.replace('/convexa/', '');
    return route.fulfill({
      status: 200,
      contentType: 'font/woff2',
      body: fs.readFileSync(path.join(FONT_ROOT, rel)),
    });
  });
}

// ---- the survey -----------------------------------------------------------------------------------
for (const plan of plans) {
  const id = `${plan.surface}-${plan.state}-${plan.width}-${plan.scheme}`;

  test(`app · ${id}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text().slice(0, 200));
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
    await installVisualFrameController(page);
    const scenario = plan.app;
    const traffic = plan.live ? null : await installScenario(page, scenario);
    if (plan.live) await liveSetup(page, scenario);
    if (plan.stream) await mockStream(page, plan.stream, scenario.now);
    await page.goto(scenario.route);
    await assertReady(page, scenario);
    if (plan.appAct) await plan.appAct(page);
    await settle(page);
    await record(
      page,
      {
        id,
        side: 'app',
        surface: plan.surface,
        state: plan.state,
        width: plan.width,
        scheme: plan.scheme,
        url: scenario.route,
      },
      errors,
    );
    if (traffic && traffic.unexpected.length)
      fs.appendFileSync(
        path.join(OUT, 'app', `${id}.unexpected.txt`),
        traffic.unexpected.join('\n') + '\n',
      );
  });

  test(`design · ${id}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: plan.width, height: 900 },
      colorScheme: plan.scheme,
      reducedMotion: 'reduce',
      deviceScaleFactor: 1,
      locale: 'en-US',
      timezoneId: 'UTC',
    });
    await localFonts(context);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text().slice(0, 200));
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
    await page.goto(`${DESIGN}${plan.designPath}`);
    await page.addStyleTag({ content: '.site-bar{display:none !important}' });
    await page.evaluate((scheme) => {
      document.documentElement.setAttribute('data-scheme', scheme);
      const w = window as unknown as { deskSetProps?: (p: Record<string, unknown>) => void };
      w.deskSetProps?.({ scheme });
    }, plan.scheme);
    if (plan.designState) await plan.designState(page);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, 0));
    await record(
      page,
      {
        id,
        side: 'design',
        surface: plan.surface,
        state: plan.state,
        width: plan.width,
        scheme: plan.scheme,
        url: plan.designPath,
      },
      errors,
    );
    await context.close();
  });
}

// ---- element crops at 1280 dark (the headline comparison) ---------------------------------------
async function cropBoth(page: Page, browser: Browser, tag: string, designReadState: string) {
  const appCrops: Record<string, string> = {
    nav: '[data-testid="top-nav"]',
    hero: '[data-testid="widget-structure-hero"]',
    'read-strip': '[data-testid="widget-read-strip"]',
    'ai-read': '[data-testid="widget-ai-rec"]',
    'live-tape': '[data-testid="widget-live-tape"]',
    masthead: '[data-testid="command-deck"]',
    'dealer-flow': '[data-testid="widget-dealer-flow-projection"]',
    'market-context': '[data-testid="widget-market-context"]',
  };
  const sizes: Record<string, { w: number; h: number } | null> = {};
  for (const [name, sel] of Object.entries(appCrops)) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) === 0) {
      sizes[`app:${name}`] = null;
      continue;
    }
    if (name !== 'nav')
      await page.addStyleTag({
        content: '[data-testid="top-nav"]{visibility:hidden !important}',
      });
    await loc.scrollIntoViewIfNeeded();
    const box = await loc.boundingBox();
    sizes[`app:${name}`] = box ? { w: Math.round(box.width), h: Math.round(box.height) } : null;
    await loc.screenshot({
      path: path.join(OUT, 'crops', `app-${name}-${tag}.png`),
      animations: 'disabled',
    });
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  });
  await localFonts(context);
  const d = await context.newPage();
  await d.goto(`${DESIGN}/desk.html`);
  await d.addStyleTag({ content: '.site-bar{display:none !important}' });
  await deskDesign(designReadState, 1280)(d);
  await d.evaluate(() => document.fonts.ready);
  await d.waitForTimeout(400);
  // Document order of the desk's `section.wrap` blocks: mast · hero · strip · work · context.
  const wraps = d.locator('section.wrap');
  const designCrops: Record<string, ReturnType<typeof d.locator>> = {
    nav: d.locator('header.nav-bar').first(),
    masthead: wraps.nth(0),
    hero: wraps.nth(1).locator('.panel').first(),
    'read-strip': wraps.nth(2).locator('.panel.strip').first(),
    'ai-read': wraps.nth(3).locator('.panel.ai').first(),
    'live-tape': wraps.nth(3).locator('.side > .panel').first(),
    'dealer-flow': wraps.nth(4).locator('.ctx-grid > section').nth(0),
    'market-context': wraps.nth(4).locator('.ctx-grid > section').nth(1),
  };
  for (const [name, loc] of Object.entries(designCrops)) {
    if ((await loc.count()) === 0) {
      sizes[`design:${name}`] = null;
      continue;
    }
    if (name !== 'nav')
      await d.addStyleTag({ content: 'header.nav-bar{visibility:hidden !important}' });
    await loc.scrollIntoViewIfNeeded();
    const box = await loc.boundingBox();
    sizes[`design:${name}`] = box ? { w: Math.round(box.width), h: Math.round(box.height) } : null;
    await loc.screenshot({
      path: path.join(OUT, 'crops', `design-${name}-${tag}.png`),
      animations: 'disabled',
    });
  }
  fs.writeFileSync(
    path.join(OUT, 'crops', `sizes-${tag}.json`),
    JSON.stringify(sizes, null, 2) + '\n',
  );
  await context.close();
}

if (LIVE) {
  test('crops · desk-live-anon-1280-dark', async ({ page, browser }) => {
    const plan = plans.find((p) => p.surface === 'desk' && p.width === 1280 && p.scheme === 'dark');
    if (!plan) throw new Error('the live desk plan is missing');
    await installVisualFrameController(page);
    await liveSetup(page, plan.app);
    await page.goto(plan.app.route);
    await assertReady(page, plan.app);
    await settle(page);
    await cropBoth(page, browser, 'live-anon-1280-dark', 'signed_out');
  });
} else {
  test('crops · desk-real-1280-dark', async ({ page, browser }) => {
    const plan = plans.find((p) => p.state === 'real' && p.width === 1280 && p.scheme === 'dark');
    if (!plan) throw new Error('the desk-real-1280-dark plan is missing (no saved bundle?)');
    await installVisualFrameController(page);
    await installScenario(page, plan.app);
    if (plan.stream) await mockStream(page, plan.stream, plan.app.now);
    await page.goto(plan.app.route);
    await assertReady(page, plan.app);
    await settle(page);
    await cropBoth(page, browser, 'real-1280-dark', 'idle');
  });
  test('crops · desk-trade-1280-dark', async ({ page, browser }) => {
    const plan = plans.find(
      (p) => p.surface === 'desk' && p.state === 'trade' && p.width === 1280 && p.scheme === 'dark',
    );
    if (!plan) throw new Error('the desk-trade-1280-dark plan is missing');
    await installVisualFrameController(page);
    await installScenario(page, plan.app);
    await page.goto(plan.app.route);
    await assertReady(page, plan.app);
    await analyze(page);
    await settle(page);
    await cropBoth(page, browser, 'trade-1280-dark', 'trade');
  });
}
