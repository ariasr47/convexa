import type { SupportedDemoSymbol } from '../mode';
import type { ScenarioSymbol } from './shared';
import { makeScenario } from './shared';

export interface ScenarioSeed { symbol: SupportedDemoSymbol; base: number; step: number; phase: number }
export type ScenarioSeedAssets = Partial<Record<SupportedDemoSymbol, string>>;
export type ScenarioSeedFetcher = (assetUrl: string) => Promise<unknown>;

function parseScenarioSeed(expected: SupportedDemoSymbol, value: unknown): ScenarioSeed {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${expected} scenario seed.`);
  const seed = value as Record<string, unknown>;
  if (seed.symbol !== expected || !Number.isFinite(seed.base) || !Number.isFinite(seed.step) || !Number.isFinite(seed.phase)) {
    throw new Error(`Invalid ${expected} scenario seed.`);
  }
  return { symbol: expected, base: seed.base as number, step: seed.step as number, phase: seed.phase as number };
}

export function createScenarioLoader(assets: ScenarioSeedAssets, fetchSeed: ScenarioSeedFetcher): (symbol: string) => Promise<ScenarioSymbol | null> {
  const ready = new Map<SupportedDemoSymbol, ScenarioSymbol>();
  const pending = new Map<SupportedDemoSymbol, Promise<ScenarioSymbol>>();

  return async (symbol: string) => {
    const normalized = symbol.toUpperCase() as SupportedDemoSymbol;
    const assetUrl = assets[normalized];
    if (!assetUrl) return null;
    const cached = ready.get(normalized);
    if (cached) return cached;
    const inFlight = pending.get(normalized);
    if (inFlight) return inFlight;

    const load = (async () => {
      const seed = parseScenarioSeed(normalized, await fetchSeed(assetUrl));
      const scenario = makeScenario(seed.symbol, seed.base, seed.step, seed.phase);
      ready.set(normalized, scenario);
      return scenario;
    })();
    pending.set(normalized, load);
    try { return await load; }
    finally { if (pending.get(normalized) === load) pending.delete(normalized); }
  };
}
