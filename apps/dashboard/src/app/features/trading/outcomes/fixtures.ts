/**
 * outcome-ledger — TEST-ONLY fixture builders (not collected by the `*.spec.*` glob, not imported by
 * any app code). They seed the DURABLE STORES, which is the boundary this feature actually has:
 * it consumes NO endpoint and makes no network call of any kind, so there is no API client to mock.
 * The specs drive the real derivation over real localStorage blobs.
 */
import type { DecisionRecord, EntryContextDigest, GhostTrade } from '@/features/trading/model/types';
import { GHOST_TRADE_KEY } from '@/features/trading/model/store';
import { ORDERS_KEY } from '@/features/trading/orders/store';
import type { SimOrder } from '@/features/trading/orders/types';
import { PORTFOLIO_V2_KEY } from '@/features/trading/positions/store';
import type { Position } from '@/features/trading/positions/types';

export const digest = (over: Partial<EntryContextDigest> = {}): EntryContextDigest => ({
  opportunity_score: 71,
  setups: [{ name: 'pin_confluence', conviction: 'high' }],
  persona_id: 'default',
  iv_rank_band: 'premium_rich',
  gamma_regime: 'negative_gamma',
  vol_regime: 'iv_rich',
  state_fingerprint: 'fp-1',
  ai_rec_fingerprint: null,
  ...over,
});

export const decision = (over: Partial<DecisionRecord> = {}): DecisionRecord =>
  ({
    id: `d-${Math.random().toString(36).slice(2)}`,
    event_type: 'open',
    clock_time: '2026-03-04T14:00:00.000Z',
    trade_id: 'p-1',
    contract: { ticker: 'TSLA', expiration: '2026-04-17', strike: 300, right: 'call', qty: 1 },
    mark_price: 5,
    mark_basis: 'snapshot',
    underlying_spot: 300,
    pl_dollar: 0,
    pl_pct: 0,
    tier: 'prime',
    position_fingerprint: '',
    schema_version: 1,
    ...over,
  }) as DecisionRecord;

export const position = (over: Partial<Position> = {}): Position =>
  ({
    id: 'p-1',
    ticker: 'TSLA',
    expiration: '2026-04-17',
    strike: 300,
    right: 'call',
    side: 'long',
    qty: 1,
    entry_mark: 5,
    entry_basis: 'snapshot',
    entry_time: '2026-03-04T14:00:00.000Z',
    status: 'closed',
    realized_pl_dollar: 100,
    realized_pl_pct: 20,
    close_time: '2026-03-05T14:00:00.000Z',
    schema_version: 2,
    ...over,
  }) as Position;

export const ghostTrade = (over: Partial<GhostTrade> = {}): GhostTrade =>
  ({
    id: 'g-1',
    ticker: 'NVDA',
    expiration: '2026-04-17',
    strike: 900,
    right: 'call',
    side: 'long',
    qty: 1,
    entry_mark: 5,
    entry_basis: 'snapshot',
    entry_time: '2026-03-04T14:00:00.000Z',
    status: 'closed',
    realized_pl_dollar: 100,
    realized_pl_pct: 20,
    close_time: '2026-03-05T14:00:00.000Z',
    schema_version: 1,
    ...over,
  }) as GhostTrade;

export const order = (over: Partial<SimOrder> = {}): SimOrder =>
  ({
    id: 'o-1',
    created_time: '2026-03-04T13:00:00.000Z',
    schema_version: 1,
    ticker: 'TSLA',
    expiration: '2026-04-17',
    strike: 300,
    right: 'call',
    side: 'long',
    qty: 1,
    trigger: null,
    limit_price: null,
    stop: null,
    target: null,
    expires_at: '2026-03-11T23:59:59.999Z',
    provenance: { source: 'manual' },
    status: 'filled',
    ...over,
  }) as SimOrder;

/** One CLOSED, COUNTED outcome: a closed position + its `open` entry record + its close-bearing
 *  record (a plain `close` by default — `exitEvent`/`exitVerdict` express the other two producers of
 *  `closeTrade`'s `via`: the Exit-verdict accept and the roll close). */
export function closedOutcome(
  id: string,
  opts: {
    plPct?: number;
    plDollar?: number;
    tier?: string;
    entryBasis?: string;
    exitBasis?: string;
    closeTime?: string;
    entryDigest?: EntryContextDigest | null;
    originOrderId?: string;
    entryClock?: string;
    /** The close-bearing event's `event_type` — `closeTrade(via)`'s three producers are
     *  `close` (the default), `accept` (the Exit verdict) and `roll`. */
    exitEvent?: DecisionRecord['event_type'];
    /** The close-bearing event's `ai_verdict`. Required to be exactly `'Exit'` on an `accept`. */
    exitVerdict?: string;
  } = {},
): { position: Position; decisions: DecisionRecord[] } {
  const plPct = opts.plPct ?? 20;
  const plDollar = opts.plDollar ?? (plPct > 0 ? 100 : plPct === 0 ? 0 : -100);
  const closeTime = opts.closeTime ?? '2026-03-05T14:00:00.000Z';
  const entry = decision({
    trade_id: id,
    event_type: 'open',
    clock_time: opts.entryClock ?? '2026-03-04T14:00:00.000Z',
    tier: opts.tier ?? 'prime',
    ...(opts.entryDigest === null ? {} : { entry_context: opts.entryDigest ?? digest() }),
  });
  const exit = decision({
    trade_id: id,
    event_type: opts.exitEvent ?? 'close',
    clock_time: closeTime,
    mark_basis: (opts.exitBasis ?? 'snapshot') as DecisionRecord['mark_basis'],
    ...(opts.exitVerdict ? { ai_verdict: opts.exitVerdict } : {}),
  });
  return {
    position: position({
      id,
      status: 'closed',
      realized_pl_pct: plPct,
      realized_pl_dollar: plDollar,
      close_time: closeTime,
      entry_basis: (opts.entryBasis ?? 'snapshot') as Position['entry_basis'],
      ...(opts.originOrderId ? { origin_order_id: opts.originOrderId } : {}),
    }),
    decisions: [entry, exit],
  };
}

/** N counted outcomes in one cell (default: enough to clear the floor). */
export function outcomes(
  n: number,
  opts: Parameters<typeof closedOutcome>[1] & { winners?: number; prefix?: string } = {},
): { positions: Position[]; decisions: DecisionRecord[] } {
  const positions: Position[] = [];
  const decisions: DecisionRecord[] = [];
  const winners = opts.winners ?? n;
  for (let i = 0; i < n; i += 1) {
    const o = closedOutcome(`${opts.prefix ?? 'p'}-${i}`, {
      ...opts,
      plPct: i < winners ? (opts.plPct ?? 20) : -10,
      plDollar: i < winners ? 100 : -100,
    });
    positions.push(o.position);
    decisions.push(...o.decisions);
  }
  return { positions, decisions };
}

export interface SeedInput {
  ghostTrades?: GhostTrade[];
  ghostDecisions?: DecisionRecord[];
  positions?: Position[];
  positionDecisions?: DecisionRecord[];
  orders?: SimOrder[];
  /** Raw overrides — to seed a CORRUPT blob (the store must survive it byte-for-byte). */
  rawGhost?: string;
  rawPositions?: string;
  rawOrders?: string;
}

const byId = <T extends { id: string }>(xs: T[]): Record<string, T> =>
  Object.fromEntries(xs.map((x) => [x.id, x]));

/** Seed the three durable stores. This is the feature's real boundary. */
export function seedStores(input: SeedInput = {}) {
  localStorage.setItem(
    GHOST_TRADE_KEY,
    input.rawGhost ??
      JSON.stringify({
        schema_version: 1,
        trades: Object.fromEntries((input.ghostTrades ?? []).map((t) => [t.ticker, t])),
        decisions: input.ghostDecisions ?? [],
      }),
  );
  localStorage.setItem(
    PORTFOLIO_V2_KEY,
    input.rawPositions ??
      JSON.stringify({
        schema_version: 2,
        positions: byId(input.positions ?? []),
        decisions: input.positionDecisions ?? [],
        customization: null,
      }),
  );
  localStorage.setItem(
    ORDERS_KEY,
    input.rawOrders ?? JSON.stringify({ schema_version: 1, orders: byId(input.orders ?? []) }),
  );
}
