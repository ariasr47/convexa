/**
 * Client-local durable store for the ghost trade + append-only decision history.
 * Backed by localStorage, versioned, and exportable. The server stores none of this (v1).
 * All access is guarded so a storage failure (private mode, quota) degrades to in-memory only
 * and never throws into the UI.
 */
import { SCHEMA_VERSION, GhostTrade, DecisionRecord } from './types';
import { resolveDurable } from '../durable/resolveDurable';

const STORAGE_KEY = 'convexa.ghost-trade.v1';
const LEGACY_STORAGE_KEY = 'gammaflow.ghost-trade.v1';

interface PersistShape {
  schema_version: number;
  trades: Record<string, GhostTrade>; // by ticker — the current open or just-closed trade
  decisions: DecisionRecord[];         // global, append-only
}

const empty = (): PersistShape => ({ schema_version: SCHEMA_VERSION, trades: {}, decisions: [] });

let memory: PersistShape | null = null; // fallback when localStorage is unavailable

function read(): PersistShape {
  if (memory) return memory;
  try {
    const raw = resolveDurable(STORAGE_KEY, LEGACY_STORAGE_KEY);
    memory = raw ? { ...empty(), ...(JSON.parse(raw) as PersistShape) } : empty();
  } catch {
    memory = empty();
  }
  return memory;
}

function write(s: PersistShape) {
  memory = s;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* in-memory only */ }
}

export function getTrade(ticker: string): GhostTrade | null {
  return read().trades[ticker.toUpperCase()] ?? null;
}

export function putTrade(trade: GhostTrade) {
  const s = read();
  write({ ...s, trades: { ...s.trades, [trade.ticker.toUpperCase()]: trade } });
}

export function clearTrade(ticker: string) {
  const s = read();
  const trades = { ...s.trades };
  delete trades[ticker.toUpperCase()];
  write({ ...s, trades });
}

export function appendDecision(rec: DecisionRecord) {
  const s = read();
  write({ ...s, decisions: [...s.decisions, rec] });
}

/** Records for one trade, newest first. */
export function decisionsForTrade(tradeId: string): DecisionRecord[] {
  return read().decisions.filter((d) => d.trade_id === tradeId).reverse();
}

/** Download the FULL versioned log (all trades + all decisions) as machine-readable JSON. */
export function exportLog() {
  const s = read();
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `convexa-decision-history-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function newId(): string {
  return (crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

/** Test/internal seam: reset the in-memory cache so the next read re-hydrates from localStorage. */
export function __resetMemory() {
  memory = null;
}

export const GHOST_TRADE_KEY = STORAGE_KEY;
export const GHOST_TRADE_LEGACY_KEY = LEGACY_STORAGE_KEY;
