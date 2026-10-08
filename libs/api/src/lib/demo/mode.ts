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
declare global {
  interface DemoStorage {
    length: number;
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    key(index: number): string | null;
  }
  const window: {
    __CONVEXA_BOOT__?: BuildBootstrap;
    localStorage: DemoStorage;
    location: { reload(): void };
  };
  interface ImportMeta {
    env: { MODE: string };
  }
}

function resolveMode(): DataMode {
  if (typeof window !== 'undefined' && window.__CONVEXA_BOOT__) {
    const mode = window.__CONVEXA_BOOT__.mode;
    if (mode === 'demo' || mode === 'live') return mode;
    throw new Error('Invalid Convexa build bootstrap mode');
  }
  if (import.meta.env.MODE === 'test') return 'live';
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
  if (import.meta.env.MODE === 'test') return logicalKey;
  throw new Error('Missing Convexa build bootstrap; refusing storage access');
}
