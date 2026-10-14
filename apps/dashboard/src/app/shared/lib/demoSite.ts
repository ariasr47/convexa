/**
 * The hosted staging demo: the same app built in demo mode from the `staging` branch
 * (tools/build-dashboard.mjs), every feature running on sample data. Production links here while
 * live market data is off.
 */
export const STAGING_DEMO_URL = 'https://staging.convexa.pages.dev';

/**
 * Whether this is the demo build, read from the bootstrap global that index.html sets before the
 * bundle runs. Same answer as `dataMode === 'demo'`, without an edge to `@convexa/api`: the public
 * surfaces (landing, blog, methodology, 404) are a zero-edge tree and may not import the API client
 * (SPEC §2.1, eslint.config.mjs).
 */
export function isDemoBuild(): boolean {
  return typeof window !== 'undefined' && window.__CONVEXA_BOOT__?.mode === 'demo';
}
