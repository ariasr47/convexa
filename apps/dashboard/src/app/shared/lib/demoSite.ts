/**
 * The hosted staging demo: the same app built in demo mode from the `staging` branch
 * (tools/build-dashboard.mjs), every feature running on sample data. Production links here while
 * live market data is off.
 */
export const STAGING_DEMO_URL = 'https://staging.convexa.pages.dev';

/** The live production site, which the demo links back to. */
export const LIVE_SITE_URL = 'https://convexa.pages.dev';

/**
 * Whether this is the demo build, read from the bootstrap global that index.html sets before the
 * bundle runs. Same answer as `dataMode === 'demo'`, without an edge to `@convexa/api`: the public
 * surfaces (landing, blog, methodology, 404) are a zero-edge tree and may not import the API client
 * (SPEC §2.1, eslint.config.mjs).
 */
export function isDemoBuild(): boolean {
  return typeof window !== 'undefined' && window.__CONVEXA_BOOT__?.mode === 'demo';
}

/** The symbols the demo scenario covers (libs/api/src/lib/demo/catalog, pinned by catalog.spec.ts).
 *  Kept here rather than imported so the live build never bundles the demo's seed data. */
export const STAGING_DEMO_SYMBOLS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA'] as const;

/** The demo's six symbols by name (the scenario carries tickers only), for the ⌘K rows and the
 *  sample research cards. One list, so the two can't drift; a symbol missing here renders without
 *  a name, never a guessed one. Carried over unchanged from the two copies it replaces
 *  (CommandPalette/usePaletteData.ts DEMO_NAMES, research/ResearchIndexPage.tsx SAMPLE_NAMES). */
export const STAGING_DEMO_NAMES: Readonly<Record<string, string>> = {
  AAPL: 'Apple',
  MSFT: 'Microsoft',
  NVDA: 'NVIDIA',
  QQQ: 'Invesco QQQ Trust',
  SPY: 'SPDR S&P 500 ETF',
  TSLA: 'Tesla',
};

/** The same ticker desk on the demo, or SPY's when the demo doesn't cover this symbol. */
export function demoDeskUrl(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  const covered = (STAGING_DEMO_SYMBOLS as readonly string[]).includes(t);
  return `${STAGING_DEMO_URL}/ticker/${encodeURIComponent(covered ? t : 'SPY')}`;
}
