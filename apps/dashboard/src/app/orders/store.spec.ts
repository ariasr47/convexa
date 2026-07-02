/**
 * Unit — the durable orders store (FRONTEND contract §7 "store.spec.ts"): the guarded read
 * (corrupt ⇒ empty fallback + fault flag, the prior blob NEVER overwritten), the versioned key
 * `convexa.orders.v1`, and the export shape (`{ orders, decisions }` joining the order chain).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ORDERS_KEY, allOrders, putOrder, ordersFaulted, buildOrdersExport, exportFilename,
  __resetOrdersMemory,
} from './store';
import { createOrder, applyOrderTransition } from './useOrders';
import { __resetMemory as __resetPositionsMemory, allDecisions } from '../positions/store';
import type { SimOrder } from './types';

const FUTURE = new Date(Date.now() + 5 * 86400000).toISOString();

function makeOrder(id: string, over: Partial<SimOrder> = {}): SimOrder {
  return {
    id, created_time: new Date().toISOString(), schema_version: 1,
    ticker: 'TSLA', expiration: '2099-12-19', strike: 250, right: 'call', side: 'long', qty: 1,
    trigger: null, limit_price: null, stop: null, target: null, expires_at: FUTURE,
    provenance: { source: 'ai_rec' }, status: 'triggered',
    ...over,
  };
}

beforeEach(() => {
  localStorage.clear();
  __resetOrdersMemory();
  __resetPositionsMemory();
});

describe('convexa.orders.v1 — versioned key + guarded read', () => {
  it('persists under the exact versioned key with a schema_version envelope', () => {
    expect(ORDERS_KEY).toBe('convexa.orders.v1');
    putOrder(makeOrder('o-1'));
    const raw = localStorage.getItem('convexa.orders.v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.schema_version).toBe(1);
    expect(parsed.orders['o-1'].ticker).toBe('TSLA');
  });

  it('a corrupt blob degrades to an EMPTY in-memory fallback + the fault flag, never a throw', () => {
    localStorage.setItem(ORDERS_KEY, '{not json');
    expect(() => allOrders()).not.toThrow();
    expect(allOrders()).toEqual([]);
    expect(ordersFaulted()).toBe(true);
  });

  it('a parseable-but-wrong-shape blob is ALSO treated as faulted (mangled by hand)', () => {
    localStorage.setItem(ORDERS_KEY, JSON.stringify({ nonsense: true }));
    expect(allOrders()).toEqual([]);
    expect(ordersFaulted()).toBe(true);
  });

  it('the faulted prior blob is NEVER deleted or overwritten; writes are refused', () => {
    localStorage.setItem(ORDERS_KEY, '{corrupt-but-precious');
    expect(putOrder(makeOrder('o-2'))).toBe(false); // refused, nothing partial
    expect(localStorage.getItem(ORDERS_KEY)).toBe('{corrupt-but-precious');
    expect(allOrders()).toEqual([]);
  });

  it('createOrder refuses a faulted store with the honest reason (AC-29 confirm-side)', () => {
    localStorage.setItem(ORDERS_KEY, '{corrupt');
    const res = createOrder({
      ticker: 'TSLA', expiration: '2099-12-19', strike: 250, right: 'call', qty: 1,
      trigger: null, limit_price: null, stop: null, target: null,
      expires_at: FUTURE, provenance: { source: 'ai_rec' },
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('Orders unavailable');
    expect(localStorage.getItem(ORDERS_KEY)).toBe('{corrupt');
  });

  it('a corrupt ORDERS store leaves the POSITIONS store untouched (isolation)', () => {
    localStorage.setItem('convexa.positions.v2', JSON.stringify({
      schema_version: 2, positions: {}, decisions: [], customization: undefined,
    }));
    localStorage.setItem(ORDERS_KEY, '{corrupt');
    allOrders();
    expect(localStorage.getItem('convexa.positions.v2')).toContain('"schema_version":2');
  });

  it('survives a simulated reload (memory reset re-hydrates from localStorage)', () => {
    putOrder(makeOrder('o-1', { status: 'triggered' }));
    __resetOrdersMemory();
    expect(allOrders().map((o) => o.id)).toEqual(['o-1']);
    expect(allOrders()[0].status).toBe('triggered');
  });
});

describe('export (UX §4.5 / AC-33)', () => {
  it('buildOrdersExport joins orders + the order-chain decision records (rec → order → position)', () => {
    const created = createOrder({
      ticker: 'TSLA', expiration: '2099-12-19', strike: 250, right: 'call', qty: 1,
      trigger: null, limit_price: null, stop: null, target: null,
      expires_at: FUTURE,
      provenance: { source: 'ai_rec', rec_fingerprint: 'fp-A', trigger_source_text: 'break above 252' },
    });
    const id = created.order?.id as string;
    applyOrderTransition(id, 'triggered', {
      to: 'filled', filled_time: new Date().toISOString(), fill_mark: 6.5, fill_basis: 'trigger_fill',
    });
    // Read the SAME append-only log the positions store owns.
    const payload = buildOrdersExport(allDecisions());
    expect(payload.orders).toHaveLength(1);
    expect(payload.orders[0].provenance.rec_fingerprint).toBe('fp-A'); // rec identity
    const events = payload.decisions.map((d) => d.event_type);
    expect(events).toContain('order_placed');
    expect(events).toContain('order_filled');
    expect(events).toContain('open'); // the created position's own event rides along
    const filled = payload.decisions.find((d) => d.event_type === 'order_filled');
    expect(filled?.position_id).toBe(payload.orders[0].position_id); // order → position join
  });

  it('exportFilename is convexa-orders-{YYYY-MM-DD}.json', () => {
    expect(exportFilename(new Date(2026, 6, 2))).toBe('convexa-orders-2026-07-02.json');
  });
});
