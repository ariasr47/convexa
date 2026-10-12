export type DataMode = 'demo' | 'live';
export type SupportedDemoSymbol = 'SPY' | 'QQQ' | 'AAPL' | 'MSFT' | 'NVDA' | 'TSLA';
export interface ScenarioProvenance {
  kind: 'synthetic_scenario';
  scenarioId: 'portfolio-2026-10-07-v1';
  asOf: '2026-10-07T18:30:00Z';
  label: 'Demo · sample data';
}
export interface BuildBootstrap {
  mode: DataMode;
  key(logicalKey: string): string;
}
// Extend the DOM Window rather than redeclaring `window` or `ImportMeta`: a redeclaration
// collides with the DOM and Vite types whenever a consumer compiles this source.
declare global {
  interface Window {
    __CONVEXA_BOOT__?: BuildBootstrap;
  }
}

/** Vite's build mode, read without assuming Vite's ImportMeta typings are loaded here. */
function buildMode(): string | undefined {
  return (import.meta as ImportMeta & { env?: { MODE?: string } }).env?.MODE;
}

function resolveMode(): DataMode {
  if (typeof window !== 'undefined' && window.__CONVEXA_BOOT__) {
    const mode = window.__CONVEXA_BOOT__.mode;
    if (mode === 'demo' || mode === 'live') return mode;
    throw new Error('Invalid Convexa build bootstrap mode');
  }
  if (buildMode() === 'test') return 'live';
  throw new Error('Missing Convexa build bootstrap; refusing network or storage access');
}

export const dataMode: DataMode = resolveMode();
export function scenarioProvenance(): ScenarioProvenance | null {
  return dataMode === 'demo'
    ? {
        kind: 'synthetic_scenario',
        scenarioId: 'portfolio-2026-10-07-v1',
        asOf: '2026-10-07T18:30:00Z',
        label: 'Demo · sample data',
      }
    : null;
}
export function demoStorageKey(logicalKey: string): string {
  const bootstrap = typeof window !== 'undefined' ? window.__CONVEXA_BOOT__ : undefined;
  if (bootstrap) return bootstrap.key(logicalKey);
  if (buildMode() === 'test') return logicalKey;
  throw new Error('Missing Convexa build bootstrap; refusing storage access');
}
