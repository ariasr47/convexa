/**
 * Client-local durable store for the positions portfolio (v2). Backed by localStorage, versioned,
 * exportable. The server stores none of this.
 *
 * GUARDED everywhere: a storage/parse/migration failure degrades to an empty in-memory portfolio
 * and NEVER throws into the UI (`[best-effort-isolated-or-null]`). A readable prior blob is NEVER
 * silently discarded — migration is read-time + idempotent.
 *
 * v1→v2 migration (ARCHITECTURE_CONTRACT §1.3): the v1 `trades: Record<ticker, GhostTrade>` map is
 * read from the OLD key and each existing trade is re-keyed by its own `id` into the flat
 * `positions: Record<PositionId, Position>` map (loss-free one-to-one; the ticker is on the record).
 * Decisions carry over verbatim (same `trade_id` join). New optional fields are left absent ⇒ a v1
 * record reads as a `manual` open position. The v1 blob is left intact (read old-if-new-absent).
 */
import type { GhostTrade } from '../ghost-trade/types';
import {
  PORTFOLIO_SCHEMA_VERSION, Position, PositionId, DecisionRecord, CustomizationState,
  PersistShapeV2, PersistShapeV1,
} from './types';
import { defaultCustomization } from './defaults';
import { resolveDurable } from '../durable/resolveDurable';

// Current-brand durable keys. The `.v1`/`.v2` segment + in-blob schema_version are UNCHANGED — only
// the brand prefix flipped (rebrand-convexa). The legacy `gammaflow.*` keys are retained ONLY as the
// migration source for `resolveDurable` (read-new-else-old, promote forward, never delete old).
const V1_KEY = 'convexa.ghost-trade.v1';
const V2_KEY = 'convexa.positions.v2';
const LEGACY_V1_KEY = 'gammaflow.ghost-trade.v1';
const LEGACY_V2_KEY = 'gammaflow.positions.v2';

function empty(): PersistShapeV2 {
  return {
    schema_version: PORTFOLIO_SCHEMA_VERSION,
    positions: {},
    decisions: [],
    customization: defaultCustomization(),
  };
}

let memory: PersistShapeV2 | null = null; // fallback / cache

/** Re-key one v1 trade into a v2 position. Additive fields absent ⇒ manual entry. */
function v1TradeToPosition(t: GhostTrade): Position {
  return {
    id: t.id,
    ticker: t.ticker,
    expiration: t.expiration,
    strike: t.strike,
    right: t.right,
    side: 'long',
    qty: t.qty,
    entry_mark: t.entry_mark,
    entry_basis: t.entry_basis,
    entry_time: t.entry_time,
    stop: t.stop ?? null,
    target: t.target ?? null,
    status: t.status, // 'open' | 'closed' — both valid PositionStatus
    realized_pl_dollar: t.realized_pl_dollar,
    realized_pl_pct: t.realized_pl_pct,
    close_time: t.close_time,
    schema_version: PORTFOLIO_SCHEMA_VERSION,
  };
}

/** Migrate a parsed v1 blob into a v2 shape (positions re-keyed by id, decisions verbatim). */
function migrateV1(v1: PersistShapeV1): PersistShapeV2 {
  const positions: Record<PositionId, Position> = {};
  for (const t of Object.values(v1.trades ?? {})) {
    if (t && typeof t.id === 'string') positions[t.id] = v1TradeToPosition(t);
  }
  return {
    schema_version: PORTFOLIO_SCHEMA_VERSION,
    positions,
    decisions: Array.isArray(v1.decisions) ? v1.decisions : [],
    customization: defaultCustomization(), // absent in v1 ⇒ defaults
  };
}

/** Normalize a parsed v2 blob, filling any absent top-level slices with defaults (never throws). */
function hydrateV2(raw: Partial<PersistShapeV2>): PersistShapeV2 {
  const base = empty();
  return {
    schema_version: PORTFOLIO_SCHEMA_VERSION,
    positions: raw.positions && typeof raw.positions === 'object' ? raw.positions : base.positions,
    decisions: Array.isArray(raw.decisions) ? raw.decisions : base.decisions,
    customization: hydrateCustomization(raw.customization),
  };
}

function hydrateCustomization(c: CustomizationState | undefined): CustomizationState {
  const d = defaultCustomization();
  if (!c || !Array.isArray(c.views) || c.views.length === 0 || !c.working) return d;
  // Ensure the seeded default view always exists (a corrupt list shouldn't lose the default).
  const hasDefault = c.views.some((v) => v.builtin);
  const views = hasDefault ? c.views : [d.views[0], ...c.views];
  const activeViewId = views.some((v) => v.id === c.activeViewId) ? c.activeViewId : d.activeViewId;
  return { views, activeViewId, working: c.working };
}

function read(): PersistShapeV2 {
  if (memory) return memory;
  try {
    // 4-case brand × version resolution (FRONTEND_EXECUTION_CONTRACT §A.3), first hit wins:
    //   (1) convexa.positions.v2  → hydrate
    //   (2) gammaflow.positions.v2 → hydrate + promote to convexa.positions.v2 (resolveDurable)
    //   (3) convexa.ghost-trade.v1 → migrateV1 → write convexa.positions.v2
    //   (4) gammaflow.ghost-trade.v1 → migrateV1 → write convexa.positions.v2 (legacy ver + brand hop)
    // The v2 read across both brands promotes the v2 blob forward; the v1 read across both brands is
    // the existing chain. Every SOURCE blob is left intact (resolveDurable never deletes the old key;
    // migrateV1 reads, never removes). The ghost-trade key promotes into convexa.positions.v2 here —
    // NOT into convexa.ghost-trade.v1 — so it never conflicts with the ghost-trade store's own promote.
    const rawV2 = resolveDurable(V2_KEY, LEGACY_V2_KEY);
    if (rawV2) {
      memory = hydrateV2(JSON.parse(rawV2) as Partial<PersistShapeV2>);
      return memory;
    }
    // No v2 blob under either brand — migrate from a readable v1 ghost-trade blob (either brand).
    const rawV1 = resolveDurable(V1_KEY, LEGACY_V1_KEY);
    if (rawV1) {
      const migrated = migrateV1(JSON.parse(rawV1) as PersistShapeV1);
      memory = migrated;
      write(migrated); // persist under convexa.positions.v2; leave every source blob intact
      return memory;
    }
    memory = empty();
  } catch {
    // Corrupt/unreadable store ⇒ empty in-memory portfolio, NEVER discard the readable prior blob.
    memory = empty();
  }
  return memory;
}

function write(s: PersistShapeV2) {
  memory = s;
  try { localStorage.setItem(V2_KEY, JSON.stringify(s)); } catch { /* in-memory only */ }
}

// ---- Positions ---------------------------------------------------------------------------------

export function allPositions(): Position[] {
  return Object.values(read().positions);
}

export function getPosition(id: PositionId): Position | null {
  return read().positions[id] ?? null;
}

export function putPosition(p: Position) {
  const s = read();
  write({ ...s, positions: { ...s.positions, [p.id]: p } });
}

export function removePosition(id: PositionId) {
  const s = read();
  const positions = { ...s.positions };
  delete positions[id];
  write({ ...s, positions });
}

// ---- Decisions ---------------------------------------------------------------------------------

export function appendDecision(rec: DecisionRecord) {
  const s = read();
  write({ ...s, decisions: [...s.decisions, rec] });
}

/** Records for one position, newest first. */
export function decisionsForPosition(id: PositionId): DecisionRecord[] {
  return read().decisions.filter((d) => d.trade_id === id).reverse();
}

/** The full append-only log, oldest first (ai-rec-backtest-orders: feeds the orders Export JSON —
 *  a read, never a new write path; the log stays single-sourced here). */
export function allDecisions(): DecisionRecord[] {
  return read().decisions;
}

// ---- Customization -----------------------------------------------------------------------------

export function getCustomization(): CustomizationState {
  return read().customization;
}

export function putCustomization(c: CustomizationState) {
  const s = read();
  write({ ...s, customization: c });
}

// ---- Misc --------------------------------------------------------------------------------------

export function newId(): string {
  return (crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

/** Test/internal seam: reset the in-memory cache so the next read re-hydrates from localStorage. */
export function __resetMemory() {
  memory = null;
}

export const PORTFOLIO_V1_KEY = V1_KEY;
export const PORTFOLIO_V2_KEY = V2_KEY;
export const PORTFOLIO_LEGACY_V1_KEY = LEGACY_V1_KEY;
export const PORTFOLIO_LEGACY_V2_KEY = LEGACY_V2_KEY;
