/**
 * outcome-ledger — the ARCHIVE's durability rules (`[loss-free-durable-migration]`). Every case here
 * is an invariant a refactor could silently break: only-adds, idempotency, keep-existing-on-conflict,
 * never-throw, and — the sharpest one — that a DECLINED import leaves the stores byte-untouched.
 */
import { GHOST_TRADE_KEY, __resetMemory as resetGhost } from '@/features/trading/model/store';
import { __resetOrdersMemory, ORDERS_KEY } from '@/features/trading/orders/store';
import {
  allPositions,
  PORTFOLIO_V2_KEY,
  PORTFOLIO_V3_KEY,
  __resetMemory as resetPositions,
} from '@/features/trading/positions/store';
import { beforeEach, describe, expect, it } from 'vitest';
import * as archiveModule from './archive';
import {
  archiveFilename,
  buildArchive,
  importArchive,
  isArchiveEmpty,
  parseArchive,
} from './archive';
import { closedOutcome, ghostTrade, order, outcomes, position, seedStores } from './fixtures';
import { computeLedgerRead } from './ledger';

const reset = () => {
  localStorage.clear();
  resetGhost();
  resetPositions();
  __resetOrdersMemory();
};

const roundTrip = (env: unknown) => {
  const parsed = parseArchive(JSON.stringify(env));
  if (!parsed.ok) throw new Error(`expected a parseable archive, got ${parsed.reason}`);
  return parsed.envelope;
};

beforeEach(reset);

describe('export (AC-20, AC-21)', () => {
  it('AC-20 — ONE file spans ALL THREE stores, and the filename stem is `convexa-archive-{YYYY-MM-DD}`', () => {
    const o = closedOutcome('p-1', {});
    seedStores({
      ghostTrades: [ghostTrade({ id: 'g-1', ticker: 'NVDA' })],
      ghostDecisions: [o.decisions[0]],
      positions: [o.position],
      positionDecisions: o.decisions,
      orders: [order({ id: 'o-1' })],
    });
    const env = buildArchive(new Date('2026-07-16T12:00:00.000Z'));
    expect(env.stores.ghost_trade.trades.NVDA.id).toBe('g-1');
    expect(env.stores.ghost_trade.decisions).toHaveLength(1);
    expect(env.stores.positions.positions['p-1']).toBeTruthy();
    expect(env.stores.positions.decisions).toHaveLength(2);
    expect(env.stores.orders.orders['o-1']).toBeTruthy();
    expect(archiveFilename(new Date('2026-07-16T12:00:00.000Z'))).toBe(
      'convexa-archive-2026-07-16.json',
    );
  });

  it('AC-21 — export with ZERO history succeeds, and the archive reports itself as empty', () => {
    seedStores({});
    const env = buildArchive();
    expect(isArchiveEmpty(env)).toBe(true);
    expect(env.schema).toBe('convexa.archive'); // an empty archive is still a VALID archive
  });

  it('the export format IS the import format — round-trippable by construction', () => {
    const o = closedOutcome('p-1', {});
    seedStores({ positions: [o.position], positionDecisions: o.decisions, orders: [order()] });
    const env = buildArchive();
    expect(roundTrip(env).stores.positions.positions['p-1']).toEqual(
      env.stores.positions.positions['p-1'],
    );
  });
});

describe('import merges — it ONLY EVER ADDS (AC-22, AC-23, AC-E16)', () => {
  it('adds records that are not here, reports all three counts, and never deletes what was already stored', () => {
    const a = closedOutcome('p-a', {});
    seedStores({ positions: [a.position], positionDecisions: a.decisions });
    const b = closedOutcome('p-b', {});
    const incoming = roundTrip({
      schema: 'convexa.archive',
      version: 1,
      exported_at: '',
      stores: {
        ghost_trade: { trades: {}, decisions: [] },
        positions: { positions: { 'p-b': b.position }, decisions: b.decisions },
        orders: { orders: {} },
      },
    });
    const result = importArchive(incoming);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.added).toBe(3); // 1 position + its 2 decisions
    expect(result.skipped).toBe(0);
    expect(result.conflicts).toBe(0);
    // The pre-existing record is still there — import never deletes.
    const read = computeLedgerRead();
    expect(read.coverage.recorded_closed).toBe(2);
  });

  it('AC-E16 — a colliding but DIFFERING record does not overwrite: the existing record wins and the conflict is counted', () => {
    const mine = position({ id: 'p-1', realized_pl_pct: 20 });
    seedStores({ positions: [mine] });
    const theirs = position({ id: 'p-1', realized_pl_pct: 999 });
    const result = importArchive(
      roundTrip({
        schema: 'convexa.archive',
        version: 1,
        exported_at: '',
        stores: {
          ghost_trade: { trades: {}, decisions: [] },
          positions: { positions: { 'p-1': theirs }, decisions: [] },
          orders: { orders: {} },
        },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.conflicts).toBe(1);
    expect(result.added).toBe(0);
    const stored = JSON.parse(localStorage.getItem(PORTFOLIO_V3_KEY) ?? '{}');
    expect(stored.positions['p-1'].realized_pl_pct).toBe(20); // MINE survived
  });

  it('AC-24 — IDEMPOTENCY: re-importing the same file adds 0, and the counted N, the rates AND the coverage statement are identical before/after', () => {
    const { positions, decisions } = outcomes(20, { winners: 12 });
    seedStores({ positions, positionDecisions: decisions, orders: [order()] });
    const file = JSON.stringify(buildArchive());
    const before = computeLedgerRead();

    const first = importArchive(roundTrip(JSON.parse(file)));
    expect(first.ok && first.added).toBe(0); // everything in the file is already here
    expect(first.ok && first.skipped).toBeGreaterThan(0);

    const second = importArchive(roundTrip(JSON.parse(file)));
    expect(second.ok && second.added).toBe(0);

    // The read is RECOMPUTED from the (unchanged) stores, never patched — so it cannot drift.
    resetPositions();
    resetGhost();
    __resetOrdersMemory();
    const after = computeLedgerRead();
    expect(after.coverage).toEqual(before.coverage);
    expect(after.families).toEqual(before.families);
  });

  it('a v1 envelope`s ghost trades import into the ONE book BY RECORD ID, never by ticker (AC-46)', () => {
    // The ghost-trade store is keyed by TICKER and has no writer any more, so a v1 envelope's
    // trades merge into the positions book like everything else — keyed by their own id. Two
    // records of the same contract with different ids therefore stay TWO positions: nothing is
    // merged, averaged or deduped by ticker (AC-46). That is the point, not a side effect.
    seedStores({ ghostTrades: [ghostTrade({ id: 'g-old', ticker: 'NVDA' })] });
    const result = importArchive(
      roundTrip({
        schema: 'convexa.archive',
        version: 1,
        exported_at: '',
        stores: {
          ghost_trade: {
            trades: { NVDA: ghostTrade({ id: 'g-new', ticker: 'NVDA' }) },
            decisions: [],
          },
          positions: { positions: {}, decisions: [] },
          orders: { orders: {} },
        },
      }),
    );
    expect(result.ok && result.added).toBe(1);
    expect(result.ok && result.conflicts).toBe(0);
    expect(
      allPositions()
        .map((p) => p.id)
        .sort(),
    ).toEqual(['g-new', 'g-old']);
    // The legacy blob is a SOURCE and is never written by the import — never rewritten, never pruned.
    const stored = JSON.parse(localStorage.getItem(GHOST_TRADE_KEY) ?? '{}');
    expect(stored.trades.NVDA.id).toBe('g-old');
  });

  it('the SAME ghost trade re-imported is skipped — merge-only and idempotent by record id', () => {
    seedStores({ ghostTrades: [ghostTrade({ id: 'g-1', ticker: 'NVDA' })] });
    const env = roundTrip({
      schema: 'convexa.archive',
      version: 1,
      exported_at: '',
      stores: {
        ghost_trade: { trades: { NVDA: ghostTrade({ id: 'g-1', ticker: 'NVDA' }) }, decisions: [] },
        positions: { positions: {}, decisions: [] },
        orders: { orders: {} },
      },
    });
    importArchive(env); // the union already lifted it into the book
    const second = importArchive(env);
    expect(second.ok && second.added).toBe(0);
    expect(allPositions().filter((p) => p.id === 'g-1')).toHaveLength(1);
  });

  it('orders merge through the store API, and an identical order re-imports as skipped', () => {
    seedStores({ orders: [order({ id: 'o-1' })] });
    const env = roundTrip({
      schema: 'convexa.archive',
      version: 1,
      exported_at: '',
      stores: {
        ghost_trade: { trades: {}, decisions: [] },
        positions: { positions: {}, decisions: [] },
        orders: { orders: { 'o-1': order({ id: 'o-1' }), 'o-2': order({ id: 'o-2' }) } },
      },
    });
    const result = importArchive(env);
    expect(result.ok && result.added).toBe(1);
    expect(result.ok && result.skipped).toBe(1);
    expect(JSON.parse(localStorage.getItem(ORDERS_KEY) ?? '{}').orders['o-2']).toBeTruthy();
  });
});

describe('AC-E15 — a declined file is NOT imported, and the stores are left byte-untouched', () => {
  it('declines a corrupt / foreign / future file with a reason from the CLOSED set, never a parser message', () => {
    expect(parseArchive('{ not json')).toEqual({ ok: false, reason: 'unreadable' });
    expect(parseArchive('[]')).toEqual({ ok: false, reason: 'unreadable' });
    expect(parseArchive(JSON.stringify({ schema: 'something.else' }))).toEqual({
      ok: false,
      reason: 'not_ours',
    });
    expect(parseArchive(JSON.stringify({ schema: 'convexa.archive', version: 99 }))).toEqual({
      ok: false,
      reason: 'version',
    });
  });

  it('the counted N, the rates and the coverage statement are IDENTICAL before/after a declined import', () => {
    const { positions, decisions } = outcomes(20, { winners: 12 });
    seedStores({ positions, positionDecisions: decisions });
    const before = computeLedgerRead();
    const beforeBlob = localStorage.getItem(PORTFOLIO_V2_KEY);

    expect(parseArchive('}}}garbage').ok).toBe(false); // parsing writes NOTHING

    resetPositions();
    const after = computeLedgerRead();
    expect(after.coverage).toEqual(before.coverage);
    expect(after.families).toEqual(before.families);
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBe(beforeBlob); // byte-untouched
  });

  it('⚠ a target store that cannot be READ ⇒ the import declines and writes nothing: the store APIs would rewrite the unreadable blob, and a corrupt blob must survive', () => {
    const corrupt = '{ this is not json';
    seedStores({ rawPositions: corrupt });
    const env = roundTrip({
      schema: 'convexa.archive',
      version: 1,
      exported_at: '',
      stores: {
        ghost_trade: { trades: {}, decisions: [] },
        positions: { positions: { 'p-1': position({ id: 'p-1' }) }, decisions: [] },
        orders: { orders: {} },
      },
    });
    const result = importArchive(env);
    expect(result).toEqual({ ok: false, reason: 'store_unreadable' });
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBe(corrupt); // NOT destroyed
  });

  it('never throws on a hostile envelope — a bad shape degrades, it does not break the page', () => {
    seedStores({});
    expect(() =>
      importArchive(
        roundTrip({
          schema: 'convexa.archive',
          version: 1,
          exported_at: '',
          stores: { ghost_trade: 'nope', positions: 42, orders: null },
        }),
      ),
    ).not.toThrow();
  });
});

describe('the archive ONLY adds (`[loss-free-durable-migration]`)', () => {
  it('exposes no restore / replace / overwrite / clear / reset function — not one', () => {
    // A destructive restore is the ONE operation this invariant exists to forbid. It is absent from
    // the module's surface, not merely unused by the UI.
    const surface = Object.keys(archiveModule).join(' ').toLowerCase();
    expect(surface).not.toMatch(/restore|replace|overwrite|clear|reset|delete|prune/);
  });
});
