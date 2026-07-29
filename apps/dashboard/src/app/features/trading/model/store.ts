/**
 * ⚠ **READ-ONLY LEGACY SOURCE.** This module used to be the ghost trade's durable store. As of the
 * v3 cutover it has **no write path at all** — the trade put, the trade clear and the second
 * decision append are DELETED, along with `useGhostTrade` itself, in the same release that made
 * `convexa.positions.v3` live. (Their names are absent even from this comment: the tests below grep
 * this file's own source for them, and a mention would be indistinguishable from a survivor.)
 *
 * That deletion is not tidying, it is the structural half of the migration's once-only guarantee:
 * the union runs exactly once, and the residual hole it cannot close on its own is **a stale tab
 * still running the pre-v3 build writing a NEW `convexa.ghost-trade.v1` record**. Removing the
 * writer removes the hole. `positions/migration.spec.ts` pins it BY CONSTRUCTION: it imports this
 * file's own source text and asserts it contains no localStorage-write call anywhere — which is why
 * the name of that call does not appear in this comment either.
 *
 * What survives, and only for this: the blob is a **migration source** for the v3 union and a
 * **harvest source** for the outcome ledger. It is never repaired, never pruned, never deleted —
 * the untouched v1 blob IS the rollback (`[loss-free-durable-migration]`).
 *
 * Reads stay guarded so a storage failure degrades to in-memory only and never throws into the UI.
 */
import { resolveDurable } from '@/shared/lib/durable/resolveDurable';
import { DecisionRecord, SCHEMA_VERSION } from './types';

const STORAGE_KEY = 'convexa.ghost-trade.v1';
const LEGACY_STORAGE_KEY = 'gammaflow.ghost-trade.v1';

interface PersistShape {
  schema_version: number;
  /** By ticker. Typed `unknown` because `GhostTrade` is gone — nothing interprets these but the
   *  ONE lift (`positions/migrate.liftLegacyRecord`), which is total over arbitrary material. */
  trades: Record<string, unknown>;
  decisions: DecisionRecord[]; // global, append-only
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

export function getTrade(ticker: string): unknown | null {
  return read().trades[ticker.toUpperCase()] ?? null;
}

/** Every trade in this store, by ticker (migration + archive read of this store). */
export function allTrades(): Record<string, unknown> {
  return read().trades;
}

/** The full append-only log in this store, oldest first (migration + archive read). */
export function allDecisions(): DecisionRecord[] {
  return read().decisions;
}

/** Records for one trade, newest first. */
export function decisionsForTrade(tradeId: string): DecisionRecord[] {
  return read()
    .decisions.filter((d) => d.trade_id === tradeId)
    .reverse();
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
  return crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Test/internal seam: reset the in-memory cache so the next read re-hydrates from localStorage. */
export function __resetMemory() {
  memory = null;
}

export const GHOST_TRADE_KEY = STORAGE_KEY;
export const GHOST_TRADE_LEGACY_KEY = LEGACY_STORAGE_KEY;
