/**
 * Unit — the pure transition engine (FRONTEND contract §7 "engine.spec.ts"): transition purity +
 * idempotence (unexpected current status ⇒ no-op), trigger fires on the first satisfying payload
 * incl. placement-already-met, `last_trade` never an input, trigger+fill collapse records both
 * facts, per-tick throw caught (hook level), clock expiry off-stream.
 */
import { describe, expect, it } from 'vitest';
import type { LiveUpdate } from '@org/api';
import { evaluateOrder, tickFromLive, triggerMet, isClockExpired, EngineTick } from './engine';
import { applyOrderTransition, createOrder } from './useOrders';
import { getOrder, __resetOrdersMemory } from './store';
import type { SimOrder } from './types';
import { beforeEach } from 'vitest';

const NOW = Date.parse('2026-07-02T15:00:00Z');
const FUTURE = new Date(NOW + 5 * 86400000).toISOString();
const FUTURE_EXP = '2099-12-19';

function order(over: Partial<SimOrder> = {}): SimOrder {
  return {
    id: 'o-1', created_time: new Date(NOW - 60000).toISOString(), schema_version: 1,
    ticker: 'TSLA', expiration: FUTURE_EXP, strike: 250, right: 'call', side: 'long', qty: 1,
    trigger: { kind: 'underlying_above', level: 252 }, limit_price: null,
    stop: null, target: null, expires_at: FUTURE,
    provenance: { source: 'ai_rec' }, status: 'waiting',
    ...over,
  };
}

function tick(over: Partial<EngineTick> = {}): EngineTick {
  return { mid: 250, isLive: true, streamOffline: false, optionMark: null, now: NOW, ...over };
}

describe('triggerMet — the instantaneous level test (strict above/below)', () => {
  it('underlying_above: strictly above the level', () => {
    expect(triggerMet({ kind: 'underlying_above', level: 252 }, 252.01)).toBe(true);
    expect(triggerMet({ kind: 'underlying_above', level: 252 }, 252)).toBe(false);
    expect(triggerMet({ kind: 'underlying_above', level: 252 }, 251)).toBe(false);
  });
  it('underlying_below: strictly below the level', () => {
    expect(triggerMet({ kind: 'underlying_below', level: 240 }, 239.9)).toBe(true);
    expect(triggerMet({ kind: 'underlying_below', level: 240 }, 240)).toBe(false);
  });
});

describe('evaluateOrder — live-cross-only transitions', () => {
  it('fires on the FIRST live payload satisfying the comparator (waiting → triggered)', () => {
    const t = evaluateOrder(order({ limit_price: 1 }), tick({ mid: 253 }));
    expect(t).toMatchObject({ to: 'triggered' });
  });

  it('placement-already-met: the first payload after placement triggers (AC-9 semantics)', () => {
    // The level was already crossed at placement — the very first evaluated payload fires.
    const t = evaluateOrder(order({ limit_price: 1 }), tick({ mid: 260 }));
    expect(t).toMatchObject({ to: 'triggered' });
  });

  it('non-satisfying mid ⇒ no transition', () => {
    expect(evaluateOrder(order(), tick({ mid: 251 }))).toBeNull();
  });

  it('a non-live payload (frozen/stale/closed) NEVER triggers (AC-28)', () => {
    expect(evaluateOrder(order(), tick({ mid: 300, isLive: false }))).toBeNull();
  });

  it('an offline stream NEVER triggers or fills (AC-26)', () => {
    expect(evaluateOrder(order(), tick({ mid: 300, streamOffline: true, isLive: false }))).toBeNull();
    expect(
      evaluateOrder(order({ status: 'triggered', limit_price: 5 }), tick({ streamOffline: true, isLive: false, optionMark: 1 })),
    ).toBeNull();
  });

  it('last_trade is NEVER an engine input — tickFromLive structurally drops it', () => {
    // A payload whose last_trade crossed but whose mid did not: the engine cannot see last_trade.
    const live = { mid: 251, live: true, last_trade: 999 } as Pick<LiveUpdate, 'mid' | 'live'> & { last_trade: number };
    const t = tickFromLive(live, false, null, NOW);
    expect('last_trade' in t).toBe(false);
    expect(evaluateOrder(order(), t)).toBeNull(); // mid 251 < 252 — no trigger, whatever last_trade did
  });

  it('limit fill: only on a live cross at the limit; fill price = the limit (AC-16)', () => {
    const o = order({ status: 'triggered', limit_price: 4 });
    expect(evaluateOrder(o, tick({ optionMark: 5 }))).toBeNull(); // above the limit — rests
    const t = evaluateOrder(o, tick({ optionMark: 3.5 }));
    expect(t).toMatchObject({ to: 'filled', fill_mark: 4, fill_basis: 'limit_fill' });
  });

  it('market-on-trigger: fills at the FIRST live-resolvable mark (AC-17)', () => {
    const o = order({ status: 'triggered', limit_price: null });
    expect(evaluateOrder(o, tick({ optionMark: null }))).toBeNull(); // no resolvable mark yet
    const t = evaluateOrder(o, tick({ optionMark: 6.55 }));
    expect(t).toMatchObject({ to: 'filled', fill_mark: 6.55, fill_basis: 'trigger_fill' });
  });

  it('trigger + fill collapse in ONE tick records BOTH facts', () => {
    const o = order({ trigger: { kind: 'underlying_above', level: 252 }, limit_price: null });
    const t = evaluateOrder(o, tick({ mid: 253, optionMark: 6.55 }));
    expect(t).toMatchObject({ to: 'filled', fill_mark: 6.55, fill_basis: 'trigger_fill' });
    expect((t as { triggered_time?: string }).triggered_time).toBeTruthy();
    expect((t as { filled_time?: string }).filled_time).toBeTruthy();
  });

  it('terminal orders never transition (AC-24)', () => {
    for (const status of ['filled', 'cancelled', 'expired'] as const) {
      expect(evaluateOrder(order({ status }), tick({ mid: 300, optionMark: 1 }))).toBeNull();
    }
  });

  it('clock expiry applies even OFF-stream (the only off-stream transition, AC-21)', () => {
    const o = order({ expires_at: new Date(NOW - 1000).toISOString() });
    const t = evaluateOrder(o, tick({ isLive: false, streamOffline: true, mid: null }));
    expect(t).toMatchObject({ to: 'expired' });
  });

  it('contract-expiration passing also expires the order', () => {
    const o = order({ expiration: '2026-06-01', expires_at: FUTURE });
    expect(isClockExpired(o, NOW)).toBe(true);
    expect(evaluateOrder(o, tick())).toMatchObject({ to: 'expired' });
  });
});

describe('applyOrderTransition — read-modify-write idempotence (AC-18)', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetOrdersMemory();
  });

  it('an unexpected current durable status is a NO-OP (multiple hooks cannot double-apply)', () => {
    const res = createOrder({
      ticker: 'TSLA', expiration: FUTURE_EXP, strike: 250, right: 'call', qty: 1,
      trigger: { kind: 'underlying_above', level: 252 }, limit_price: null,
      stop: null, target: null, expires_at: FUTURE, provenance: { source: 'ai_rec' },
    });
    const id = res.order?.id as string;
    // First application: waiting → triggered.
    applyOrderTransition(id, 'waiting', { to: 'triggered', triggered_time: new Date(NOW).toISOString() });
    expect(getOrder(id)?.status).toBe('triggered');
    const t1 = getOrder(id)?.triggered_time;
    // A second hook applying the SAME transition against the stale expected status: no-op.
    applyOrderTransition(id, 'waiting', { to: 'triggered', triggered_time: new Date(NOW + 9999).toISOString() });
    expect(getOrder(id)?.status).toBe('triggered');
    expect(getOrder(id)?.triggered_time).toBe(t1);
  });

  it('a terminal order never re-transitions (AC-24)', () => {
    const res = createOrder({
      ticker: 'TSLA', expiration: FUTURE_EXP, strike: 250, right: 'call', qty: 1,
      trigger: null, limit_price: 4, stop: null, target: null,
      expires_at: FUTURE, provenance: { source: 'ai_rec' },
    });
    const id = res.order?.id as string;
    applyOrderTransition(id, 'triggered', {
      to: 'filled', filled_time: new Date(NOW).toISOString(), fill_mark: 4, fill_basis: 'limit_fill',
    });
    expect(getOrder(id)?.status).toBe('filled');
    applyOrderTransition(id, 'filled', { to: 'expired', close_time: new Date(NOW).toISOString() });
    expect(getOrder(id)?.status).toBe('filled');
  });
});
