/**
 * outcome-ledger — the HARVEST (ARCHITECTURE_CONTRACT §3.3, §4/B). Read-only, in-memory, never
 * persisted, ZERO write functions.
 *
 * ⚠ Why this reads the raw blobs instead of calling the stores' own read APIs:
 * the stores swallow a parse failure and degrade to an empty in-memory shape (correctly — that is
 * `[best-effort-isolated-or-null]`), which means they cannot tell this module the ONE thing §3.3
 * requires it to record: **whether each source actually read**. A ledger that cannot distinguish
 * "you have no history" from "we couldn't read your history" would tell a user with 400 trades that
 * nothing has closed yet. So the harvest reads each blob itself and reports per-source success —
 * strictly READ-ONLY:
 *   - no `setItem`, no promote, no repair, no rewrite, no delete (`[loss-free-durable-migration]`);
 *   - a corrupt blob is reported as unread and LEFT EXACTLY AS IT IS;
 *   - it never throws (a store fault degrades this read, never the page).
 * The legacy brand keys are read directly rather than through `resolveDurable`, because that helper
 * promotes-forward (a write). The app's own stores perform that promote on their own reads.
 *
 * ⚠ The decision log AND the position map are each SPLIT across two keys (a verified pre-existing
 * defect; this feature reads across the split, it does not fix it — §8 non-goal 3). Both indices are
 * the de-duped UNION of both sources. The counted numerator and the coverage denominator M come from
 * the SAME unioned index, or the coverage statement can report a numerator that exceeds its
 * denominator.
 */
import { GHOST_TRADE_KEY, GHOST_TRADE_LEGACY_KEY } from '@/features/trading/model/store';
import type { DecisionRecord } from '@/features/trading/model/types';
import { ORDERS_KEY } from '@/features/trading/orders/store';
import type { SimOrder } from '@/features/trading/orders/types';
import {
  PORTFOLIO_LEGACY_V2_KEY,
  PORTFOLIO_V2_KEY,
  PORTFOLIO_V3_KEY,
} from '@/features/trading/positions/store';
import type { Position } from '@/features/trading/positions/types';
import { demoStorageKey } from '@convexa/api';

/** The durable sources this read spans, in the order they are reported. */
export const SOURCE_LABELS = [
  'convexa.ghost-trade.v1',
  'convexa.positions.v2',
  'convexa.positions.v3',
  'convexa.orders.v1',
] as const;

/** The de-dupe identity rule, stated in the read's basis. */
export const IDENTITY_RULE = 'per-record id, else (trade_id, event_type, clock_time)';

export interface RawSources {
  ghost: { ok: boolean; trades: unknown; decisions: unknown };
  positions: { ok: boolean; positions: unknown; decisions: unknown };
  /**
   * `convexa.positions.v3` — THE ONE BOOK, once the cutover has run in this browser. When it is
   * present it is AUTHORITATIVE and the two legacy maps are NOT unioned in: they were already
   * unioned into it, and re-unioning them at the read layer is the same resurrection bug one floor
   * down. `present: false` means this browser has not loaded the new build yet, and the pre-v3
   * branch below still applies.
   */
  book: { ok: boolean; present: boolean; positions: unknown; decisions: unknown };
  orders: { ok: boolean; orders: unknown };
}

/** Read one key (new brand, else legacy) and parse it. NEVER writes, NEVER throws.
 *  `null` blob ⇒ `{ ok: true, value: null }` — an absent store is a COMPLETE read of nothing. */
function readBlob(key: string, legacyKey?: string): { ok: boolean; value: unknown } {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(demoStorageKey(key));
    if (raw == null && legacyKey) raw = localStorage.getItem(demoStorageKey(legacyKey));
  } catch {
    return { ok: false, value: null }; // storage unavailable ⇒ an INCOMPLETE read, not an empty one
  }
  if (raw == null) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, value: null }; // corrupt ⇒ unread. The blob is left exactly as it is.
  }
}

/** Read all three durable sources. Pure read: nothing is written, promoted, repaired or deleted. */
export function readSources(): RawSources {
  const ghost = readBlob(GHOST_TRADE_KEY, GHOST_TRADE_LEGACY_KEY);
  const positions = readBlob(PORTFOLIO_V2_KEY, PORTFOLIO_LEGACY_V2_KEY);
  const book = readBlob(PORTFOLIO_V3_KEY);
  const orders = readBlob(ORDERS_KEY);
  const g = (ghost.value ?? {}) as Record<string, unknown>;
  const p = (positions.value ?? {}) as Record<string, unknown>;
  const b = (book.value ?? {}) as Record<string, unknown>;
  const o = (orders.value ?? {}) as Record<string, unknown>;
  return {
    ghost: { ok: ghost.ok, trades: g.trades, decisions: g.decisions },
    positions: { ok: positions.ok, positions: p.positions, decisions: p.decisions },
    book: {
      ok: book.ok,
      present: book.value != null || !book.ok,
      positions: b.positions,
      decisions: b.decisions,
    },
    orders: { ok: orders.ok, orders: o.orders },
  };
}

// ---- Per-record validation (a bad record is SKIPPED and COUNTED, never thrown) -------------------

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A decision record we can read at all. Anything less is an unreadable record. */
export function isReadableDecision(v: unknown): v is DecisionRecord {
  return (
    isObj(v) &&
    typeof v.event_type === 'string' &&
    typeof v.trade_id === 'string' &&
    typeof v.clock_time === 'string'
  );
}

/** A position/ghost-trade we can read at all. Its closed-ness is only knowable if we can read it. */
export function isReadablePosition(v: unknown): v is Position {
  return isObj(v) && typeof v.id === 'string' && typeof v.status === 'string';
}

export function isReadableOrder(v: unknown): v is SimOrder {
  return isObj(v) && typeof v.id === 'string' && typeof v.status === 'string';
}

/** §3.2 — ONE identity function, three consumers (log union, archive import, idempotency). The
 *  per-record uuid when present; else the derived composite for every pre-existing record. */
export function decisionIdentity(d: DecisionRecord): string {
  if (typeof d.id === 'string' && d.id.length > 0) return `id:${d.id}`;
  return `k:${d.trade_id}\u0000${d.event_type}\u0000${d.clock_time}`;
}

export interface HarvestIndices {
  /** The de-duped union of BOTH decision logs. */
  decisions: DecisionRecord[];
  /** The de-duped union of the v2 positions map + the v1 `trades` map, keep-existing-on-conflict. */
  positions: Position[];
  orders: SimOrder[];
  /** Records that could not be read AT ALL — their closed-ness is unknowable, so they sit OUTSIDE
   *  the M balance (§3.4.2 / §6.1). */
  unreadableRecords: number;
  /** false ⇒ at least one source failed to read ⇒ the roll-up is PARTIAL. */
  sourcesComplete: boolean;
}

function valuesOf(map: unknown): unknown[] {
  return isObj(map) ? Object.values(map) : [];
}

function arrayOf(list: unknown): unknown[] {
  return Array.isArray(list) ? list : [];
}

/**
 * Build the three indices from the raw sources. One bad record must not cost the other 99:
 * every entry is validated individually, and a failure is COUNTED, never thrown.
 */
export function harvest(raw: RawSources = readSources()): HarvestIndices {
  let unreadableRecords = 0;

  // ONCE THE BOOK EXISTS IT IS AUTHORITATIVE. The two legacy maps were already unioned into it, so
  // re-unioning them here would resurrect at the READ layer exactly what the store's once-only rule
  // prevents at the write layer. Before the cutover has run in this browser, the pre-v3 union below
  // still applies unchanged.
  const book = raw.book.present && raw.book.ok;

  // --- Decision index: the logs, unioned, de-duped by the ONE identity function ---
  const decisions: DecisionRecord[] = [];
  const seen = new Set<string>();
  const decisionSources = book
    ? arrayOf(raw.book.decisions)
    : [...arrayOf(raw.ghost.decisions), ...arrayOf(raw.positions.decisions)];
  for (const entry of decisionSources) {
    if (!isReadableDecision(entry)) {
      unreadableRecords += 1;
      continue;
    }
    const key = decisionIdentity(entry);
    if (seen.has(key)) continue; // the v1→v2 migration copied records: the union CAN double-count
    seen.add(key);
    decisions.push(entry);
  }

  // --- Position index ---
  // ⚠ RESOLVED, recorded rather than deleted. This used to read *"the Ticker's `useGhostTrade` is
  // LIVE and still writes v1, and the v1→v2 migration runs only once — so v1-only positions exist
  // and are PERMANENT"*. That condition is gone: the v3 union merges both stores exactly once and
  // the v1 writer is deleted, so a v1-only position is no longer permanent — it is IN the book. The
  // pre-v3 branch is kept intact for a browser that has not loaded the new build yet, where the old
  // warning still holds word for word.
  const positions: Position[] = [];
  const byId = new Set<string>();
  const positionSources = book
    ? valuesOf(raw.book.positions)
    : [...valuesOf(raw.positions.positions), ...valuesOf(raw.ghost.trades)];
  for (const entry of positionSources) {
    if (!isReadablePosition(entry)) {
      unreadableRecords += 1;
      continue;
    }
    if (byId.has(entry.id)) continue; // keep-existing-on-conflict (v2 is read first)
    byId.add(entry.id);
    positions.push(entry as Position);
  }

  // --- Order index ---
  const orders: SimOrder[] = [];
  for (const entry of valuesOf(raw.orders.orders)) {
    if (!isReadableOrder(entry)) {
      unreadableRecords += 1;
      continue;
    }
    orders.push(entry);
  }

  return {
    decisions,
    positions,
    orders,
    unreadableRecords,
    sourcesComplete: raw.ghost.ok && raw.positions.ok && raw.book.ok && raw.orders.ok,
  };
}
