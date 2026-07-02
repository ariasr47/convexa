/**
 * Client-local durable store for sim orders — key **`convexa.orders.v1`** (versioned, exportable).
 * Positions-store discipline, NEW key, NO migration (arch §4): deliberately NOT folded into the
 * positions v2 blob, so an orders-store fault can never corrupt or blank positions.
 *
 * Guarded read (`[best-effort-isolated-or-null]`): a corrupt/unreadable blob degrades to an empty
 * in-memory fallback + a surfaced FAULT flag (the UX §4.6 "Orders unavailable" state) and NEVER
 * throws into the UI. While faulted, writes are REFUSED — the readable-but-unparseable prior blob
 * is never deleted or overwritten (AC-29), and Create surfaces an inline error instead of a
 * partial write. Single-writer-tab semantics, as shipped for positions (arch §11.9).
 *
 * A tiny external-store subscription (version counter + listeners) keeps every mounted surface
 * (Orders widget, Orders panel, the evaluation engine) consistent off ONE truth without prop
 * drilling — mutations bump the version and notify.
 */
import type { DecisionRecord } from '../ghost-trade/types';
import { ORDERS_SCHEMA_VERSION, SimOrder } from './types';

export const ORDERS_KEY = 'convexa.orders.v1';

interface PersistShape {
  schema_version: number;
  orders: Record<string, SimOrder>;
}

let memory: Record<string, SimOrder> | null = null;
let faulted = false;

// ---- External-store subscription (useSyncExternalStore-compatible) ------------------------------

let version = 0;
const listeners = new Set<() => void>();

export function subscribeOrders(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOrdersVersion(): number {
  return version;
}

function notify() {
  version += 1;
  listeners.forEach((l) => {
    try { l(); } catch { /* a bad listener never breaks the store */ }
  });
}

// ---- Guarded read / write ------------------------------------------------------------------------

function read(): Record<string, SimOrder> {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (raw == null) {
      memory = {};
      faulted = false;
      return memory;
    }
    const parsed = JSON.parse(raw) as Partial<PersistShape> | null;
    const orders = parsed && typeof parsed === 'object' && parsed.orders && typeof parsed.orders === 'object'
      ? parsed.orders
      : null;
    if (!orders) throw new Error('malformed orders blob');
    memory = orders;
    faulted = false;
  } catch {
    // Corrupt/unreadable ⇒ empty in-memory fallback; the prior blob is left INTACT (never deleted,
    // never overwritten — the faulted flag blocks every write until the blob is repaired/cleared).
    memory = {};
    faulted = true;
  }
  return memory;
}

function write(orders: Record<string, SimOrder>): boolean {
  if (ordersFaulted()) return false; // NEVER overwrite a readable-but-unparseable prior blob
  memory = orders;
  try {
    const shape: PersistShape = { schema_version: ORDERS_SCHEMA_VERSION, orders };
    localStorage.setItem(ORDERS_KEY, JSON.stringify(shape));
  } catch {
    /* quota/private mode — keep the in-memory copy this session */
  }
  return true;
}

/** Is the durable store faulted (corrupt/unreadable blob)? Drives the UX §4.6 block + the
 *  create-refusal. Reading forces hydration so the answer is always current. */
export function ordersFaulted(): boolean {
  read();
  return faulted;
}

// ---- Reads ---------------------------------------------------------------------------------------

/** Every order, newest-created first (stable for both surfaces). */
export function allOrders(): SimOrder[] {
  return Object.values(read()).sort((a, b) => (a.created_time < b.created_time ? 1 : -1));
}

export function getOrder(id: string): SimOrder | null {
  return read()[id] ?? null;
}

// ---- Writes (all refuse while faulted) ------------------------------------------------------------

/** Persist one order (insert or replace). Returns false when the store is faulted (nothing
 *  written, nothing partial). */
export function putOrder(order: SimOrder): boolean {
  const s = read();
  if (faulted) return false;
  return write({ ...s, [order.id]: order });
}

// ---- Export (UX §4.5 — the AC-33 audit floor) ------------------------------------------------------

export interface OrdersExport {
  orders: SimOrder[];
  decisions: DecisionRecord[];
}

/**
 * Build the export payload: every order + the decision records that belong to the order chain —
 * the `order_*` lifecycle events, any record keyed to an order id, and the position `open` events
 * of positions the fills created (so the export joins rec identity → order → position, AC-33).
 * `decisions` is the SAME append-only log the positions store owns (passed in by the caller so
 * this module stays import-light; useOrders supplies it).
 */
export function buildOrdersExport(decisions: DecisionRecord[]): OrdersExport {
  const orders = allOrders();
  const orderIds = new Set(orders.map((o) => o.id));
  const positionIds = new Set(orders.map((o) => o.position_id).filter(Boolean) as string[]);
  const related = decisions.filter(
    (d) => d.event_type.startsWith('order_') || orderIds.has(d.trade_id) || positionIds.has(d.trade_id),
  );
  return { orders, decisions: related };
}

/** `convexa-orders-{YYYY-MM-DD}.json` (UX §4.5). */
export function exportFilename(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `convexa-orders-${y}-${m}-${d}.json`;
}

// ---- Misc ----------------------------------------------------------------------------------------

export function newOrderId(): string {
  return crypto?.randomUUID?.() ?? `ord-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Test/internal seam: reset the in-memory cache so the next read re-hydrates from localStorage
 *  (simulates a reload). Does NOT touch localStorage. */
export function __resetOrdersMemory() {
  memory = null;
  faulted = false;
}

/** Internal seam for useOrders: bump + notify after a mutation batch. */
export function __notifyOrdersChanged() {
  notify();
}
