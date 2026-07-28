/**
 * THE CUTOVER, at the STORAGE level — on top of `migrate.spec.ts`'s pure-function proof.
 *
 * Risk-based (SPEC §7 invariant 1). Four things must not go wrong, and each has a case here that
 * goes RED if it does:
 *
 *  1. the union runs ONCE and is never re-armed        -> "reloading repeatedly", "a removed record
 *                                                          never returns", "corrupt provenance"
 *  2. the promote ABORTS ENTIRELY on any unread source -> "no v3 blob is written at all"
 *  3. a LOGICAL source is ONE source                   -> "an unparseable gammaflow.positions.v2"
 *  4. `legs` on a v2 record survives with ALL legs     -> "a v2 record carrying legs"
 *
 * Every case drives the REAL store over REAL localStorage. Nothing here mocks the store — mocking it
 * is what makes a migration test agree with a broken migration.
 */
import modelStoreSource from '@/features/trading/model/store?raw';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  COLLIDING_ID_PAIR,
  LEGACY_V1_BLOB,
  LEGACY_V1_RECORD,
  LEGACY_V2_BLOB,
  LEGACY_V2_RECORD,
  STALE_SAVED_VIEW_CUSTOMIZATION,
  UNPARSEABLE_BLOB,
} from './fixtures';
import {
  __resetMemory,
  allDecisions,
  allPositions,
  appendDecision,
  dismissMergeNotice,
  getCustomization,
  getProvenance,
  PORTFOLIO_LEGACY_V1_KEY,
  PORTFOLIO_LEGACY_V2_KEY,
  PORTFOLIO_V1_KEY,
  PORTFOLIO_V2_KEY,
  PORTFOLIO_V3_KEY,
  positionsHealth,
  putCustomization,
  putPosition,
  removePosition,
  shouldShowMergeNotice,
} from './store';
import { structureKindOf } from './structure';
import type { DecisionRecord } from './types';

/**
 * A page load: drop the in-memory cache AND hydrate, exactly as the app does on its first read.
 * Hydration must be forced here — `read()` is lazy, and a test that inspects storage without
 * triggering it would be asserting against a migration that has not run yet.
 */
const reload = () => {
  __resetMemory();
  allPositions();
};

const idsAfterReload = () => {
  reload();
  return allPositions()
    .map((p) => p.id)
    .sort();
};

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
});

// ---- AC-45 / AC-46 / AC-47 / AC-48 / AC-49 / AC-55 — the union ----------------------------------

describe('the union: one book from both surfaces', () => {
  beforeEach(() => {
    localStorage.setItem(PORTFOLIO_V2_KEY, LEGACY_V2_BLOB);
    localStorage.setItem(PORTFOLIO_V1_KEY, LEGACY_V1_BLOB);
    reload();
  });

  it('AC-45 — a trader with items on BOTH surfaces sees ONE list containing every item from both', () => {
    const ids = allPositions().map((p) => p.id);
    expect(ids).toContain(LEGACY_V2_RECORD.id); // the Positions-page record
    expect(ids).toContain(LEGACY_V1_RECORD.id); // the Ticker-page ghost trade
  });

  it('AC-46 — the count is the number of DISTINCT record ids, not the arithmetic sum', () => {
    // v2 offers 1 row, v1 offers 2 — and one of v1's collides with v2's id. 1 + 2 = 3; distinct = 2.
    expect(allPositions()).toHaveLength(2);
    const counts = getProvenance()?.source_counts ?? {};
    expect(counts[PORTFOLIO_V2_KEY]).toEqual({ read: 1, contributed: 1 });
    expect(counts[PORTFOLIO_V1_KEY]).toEqual({ read: 2, contributed: 1 });
  });

  it('AC-47 — reloading repeatedly does not change the count, duplicate anything, or drop anything', () => {
    const first = idsAfterReload();
    expect(idsAfterReload()).toEqual(first);
    expect(idsAfterReload()).toEqual(first);
    expect(allDecisions()).toHaveLength(2);
  });

  it('AC-48 — every migrated position keeps its facts, and a pending limit`s empty time is verbatim', () => {
    const p = allPositions().find((x) => x.id === LEGACY_V1_RECORD.id);
    expect(p?.legs[0].ticker).toBe('NVDA');
    expect(p?.legs[0].qty).toBe(1);
    expect(p?.legs[0].entry_price).toBe(7.85);
    expect(p?.opened_time).toBe(LEGACY_V1_RECORD.entry_time);
  });

  it('AC-49 — the history contains every entry from both prior logs, ONCE each', () => {
    // `d-v2-1` is deliberately present in BOTH blobs (the v1->v2 migration copied it forward).
    const ids = allDecisions().map((d) => d.id);
    expect(ids).toEqual(['d-v2-1', 'd-v1-1']);
  });

  it('AC-55 — a record closed in EITHER source is closed, with that source`s close data', () => {
    const merged = allPositions().find((p) => p.id === COLLIDING_ID_PAIR.v2Record.id);
    expect(merged?.status).toBe('closed');
    expect(merged?.close_time).toBe(COLLIDING_ID_PAIR.v1Record.close_time);
    expect(merged?.realized_pl_dollar).toBe(196);
    // Plan fields take the v2 (first) copy — re-opening a closed trade fabricates an exposure.
    expect(merged?.stop).toBe(8);
  });

  it('the promote is a SINGLE setItem: either the whole v3 blob lands or none of it does', () => {
    const blob = localStorage.getItem(PORTFOLIO_V3_KEY);
    expect(blob).not.toBeNull();
    const parsed = JSON.parse(blob as string);
    expect(Object.keys(parsed.positions)).toHaveLength(2);
    expect(parsed.decisions).toHaveLength(2);
    expect(parsed.provenance.migrated_at).toEqual(expect.any(String));
  });

  it('DELETE NOTHING, EVER — both source blobs are byte-identical after the promote', () => {
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBe(LEGACY_V2_BLOB);
    expect(localStorage.getItem(PORTFOLIO_V1_KEY)).toBe(LEGACY_V1_BLOB);
  });

  it('carries the v2 blob`s saved views forward — a saved view is not lost by the cutover (AC-53)', () => {
    localStorage.clear();
    __resetMemory();
    localStorage.setItem(
      PORTFOLIO_V2_KEY,
      JSON.stringify({
        schema_version: 2,
        positions: {},
        decisions: [],
        customization: STALE_SAVED_VIEW_CUSTOMIZATION,
      }),
    );
    reload();
    expect(getCustomization().views.map((v) => v.name)).toContain('Tech swings');
  });
});

// ---- AC-58 — once-only, and no resurrection ------------------------------------------------------

describe('AC-58 — the union runs EXACTLY once', () => {
  beforeEach(() => {
    localStorage.setItem(PORTFOLIO_V2_KEY, LEGACY_V2_BLOB);
    localStorage.setItem(PORTFOLIO_V1_KEY, LEGACY_V1_BLOB);
    reload();
    expect(allPositions()).toHaveLength(2); // the promote ran
  });

  it('a record REMOVED in v3 never comes back out of a source blob', () => {
    expect(removePosition(LEGACY_V1_RECORD.id)).toBe(true);
    expect(idsAfterReload()).not.toContain(LEGACY_V1_RECORD.id);
    // …and again, because a resurrection machine usually needs two turns of the handle.
    expect(idsAfterReload()).not.toContain(LEGACY_V1_RECORD.id);
    // The source blob is UNTOUCHED — it is the rollback, not garbage to collect.
    expect(localStorage.getItem(PORTFOLIO_V1_KEY)).toBe(LEGACY_V1_BLOB);
  });

  it('a source blob that APPEARS after the promote is never unioned in', () => {
    localStorage.setItem(
      PORTFOLIO_V1_KEY,
      JSON.stringify({
        schema_version: 1,
        trades: { AAPL: { ...LEGACY_V1_RECORD, id: 'appeared-later', ticker: 'AAPL' } },
        decisions: [],
      }),
    );
    expect(idsAfterReload()).not.toContain('appeared-later');
  });

  it('AC-59 — corrupt provenance still reads, does NOT re-arm the migration, and suppresses the notice', () => {
    const blob = JSON.parse(localStorage.getItem(PORTFOLIO_V3_KEY) as string);
    removePosition(LEGACY_V1_RECORD.id);
    const afterRemoval = JSON.parse(localStorage.getItem(PORTFOLIO_V3_KEY) as string);
    localStorage.setItem(
      PORTFOLIO_V3_KEY,
      JSON.stringify({ ...afterRemoval, provenance: 'THIS IS NOT A PROVENANCE BLOCK' }),
    );
    reload();

    expect(positionsHealth().faulted).toBe(false); // it never fails the read
    expect(allPositions().map((p) => p.id)).not.toContain(LEGACY_V1_RECORD.id); // not re-armed
    expect(allPositions()).toHaveLength(Object.keys(blob.positions).length - 1); // no re-union
    expect(getProvenance()).toBeNull();
    expect(shouldShowMergeNotice()).toBe(false); // fail-closed
  });

  it('MISSING provenance behaves identically to corrupt provenance', () => {
    const blob = JSON.parse(localStorage.getItem(PORTFOLIO_V3_KEY) as string);
    delete blob.provenance;
    localStorage.setItem(PORTFOLIO_V3_KEY, JSON.stringify(blob));
    reload();
    expect(positionsHealth().faulted).toBe(false);
    expect(allPositions()).toHaveLength(2);
    expect(shouldShowMergeNotice()).toBe(false);
  });

  it('AC-58 — no code path writes convexa.ghost-trade.v1 after this release', () => {
    // By CONSTRUCTION, following the `?raw` import-allowlist idiom.
    expect(modelStoreSource).not.toMatch(/setItem/);
    expect(modelStoreSource).not.toMatch(/\bputTrade\b|\bclearTrade\b/);
  });
});

// ---- AC-57 — abort entirely ---------------------------------------------------------------------

describe('AC-57 — ANY unreadable source aborts the promote ENTIRELY', () => {
  it('writes NO v3 blob at all and leaves every source byte-identical', () => {
    localStorage.setItem(PORTFOLIO_V2_KEY, LEGACY_V2_BLOB);
    localStorage.setItem(PORTFOLIO_V1_KEY, UNPARSEABLE_BLOB);
    reload();

    expect(localStorage.getItem(PORTFOLIO_V3_KEY)).toBeNull(); // NO PARTIAL PROMOTE
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBe(LEGACY_V2_BLOB);
    expect(localStorage.getItem(PORTFOLIO_V1_KEY)).toBe(UNPARSEABLE_BLOB);

    const health = positionsHealth();
    expect(health.faulted).toBe(true);
    expect(health.unread_sources).toEqual([PORTFOLIO_V1_KEY]);
    // It still runs IN MEMORY from whatever parsed — best-effort, isolated.
    expect(allPositions().map((p) => p.id)).toEqual([LEGACY_V2_RECORD.id]);
    expect(getProvenance()).toBeNull();
  });

  it('and every mutator refuses, so nothing is half-written on top of the abort (AC-61)', () => {
    localStorage.setItem(PORTFOLIO_V2_KEY, UNPARSEABLE_BLOB);
    reload();
    const snapshot = JSON.stringify(localStorage);

    expect(putPosition(allPositions()[0] ?? ({ id: 'x', legs: [] } as never))).toBe(false);
    expect(removePosition('anything')).toBe(false);
    expect(appendDecision({ trade_id: 'x' } as unknown as DecisionRecord)).toBe(false);
    expect(putCustomization(getCustomization())).toBe(false);
    expect(dismissMergeNotice()).toBe(false);

    expect(JSON.stringify(localStorage)).toBe(snapshot);
  });

  it('an ABSENT source is a COMPLETE read of nothing — it must not abort the promote', () => {
    localStorage.setItem(PORTFOLIO_V2_KEY, LEGACY_V2_BLOB);
    reload();
    expect(positionsHealth().faulted).toBe(false);
    expect(localStorage.getItem(PORTFOLIO_V3_KEY)).not.toBeNull();
  });

  it('the promote runs on first load with NO sources at all, so the union is never left armed', () => {
    reload();
    expect(allPositions()).toEqual([]);
    const blob = localStorage.getItem(PORTFOLIO_V3_KEY);
    expect(blob).not.toBeNull();
    expect(JSON.parse(blob as string).provenance.source_counts).toEqual({
      [PORTFOLIO_V2_KEY]: { read: 0, contributed: 0 },
      [PORTFOLIO_V1_KEY]: { read: 0, contributed: 0 },
    });
  });
});

// ---- ONE LOGICAL SOURCE = ONE SOURCE ------------------------------------------------------------

describe('a logical source is ONE source, even under two brand keys', () => {
  it('an unparseable gammaflow.positions.v2 reports ONE unread source, not the promoted brand pair', () => {
    // Seed ONLY the legacy key. `resolveDurable` promotes those bytes to the convexa key BEFORE
    // anything parses them, so BOTH keys now hold the same corrupt blob.
    localStorage.setItem(PORTFOLIO_LEGACY_V2_KEY, UNPARSEABLE_BLOB);
    reload();

    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBe(UNPARSEABLE_BLOB); // the promote happened
    const health = positionsHealth();
    expect(health.unread_sources).toHaveLength(1); // ← one blob, one failure
    expect(health.unread_sources).toEqual([PORTFOLIO_V2_KEY]); // reported by LOGICAL key
    expect(localStorage.getItem(PORTFOLIO_V3_KEY)).toBeNull(); // the promote aborted
    expect(getProvenance()).toBeNull();
  });

  it('a readable legacy-brand pair contributes ONCE, not twice', () => {
    localStorage.setItem(PORTFOLIO_LEGACY_V2_KEY, LEGACY_V2_BLOB);
    localStorage.setItem(PORTFOLIO_LEGACY_V1_KEY, LEGACY_V1_BLOB);
    reload();
    expect(allPositions()).toHaveLength(2);
    expect(Object.keys(getProvenance()?.source_counts ?? {})).toEqual([
      PORTFOLIO_V2_KEY,
      PORTFOLIO_V1_KEY,
    ]);
  });
});

// ---- Step 3b — `legs` on a v2 record survives the union with ALL legs ----------------------------

describe('a v2 record carrying `legs` — loss-free-durable-migration territory', () => {
  const condorLeg = (over: Record<string, unknown>) => ({
    kind: 'option',
    ticker: 'META',
    side: 'long',
    qty: 1,
    multiplier: 100,
    entry_price: 12.4,
    entry_basis: 'user_entered',
    expiration: '2026-08-21',
    strike: 400,
    right: 'call',
    ...over,
  });

  /** The flat contract fields describe ONLY leg 0 — that is exactly the trap. */
  const V2_CONDOR = {
    id: 'v2-condor',
    ticker: 'META',
    expiration: '2026-08-21',
    strike: 440,
    right: 'call',
    side: 'long',
    qty: 1,
    entry_mark: 12.4,
    entry_basis: 'user_entered',
    entry_mode: 'manual',
    entry_time: '2026-06-12T15:32:00Z',
    status: 'open',
    schema_version: 2,
    legs: [
      condorLeg({ id: 'c-l0', strike: 440 }),
      condorLeg({ id: 'c-l1', strike: 420, side: 'short', entry_price: 6.1 }),
      condorLeg({ id: 'c-l2', strike: 380, right: 'put', side: 'short', entry_price: 5 }),
      condorLeg({ id: 'c-l3', strike: 360, right: 'put', entry_price: 2.5 }),
    ],
  };

  function seedV2(positions: Record<string, unknown>) {
    localStorage.setItem(
      PORTFOLIO_V2_KEY,
      JSON.stringify({ schema_version: 2, positions, decisions: [] }),
    );
    reload();
  }

  it('migrates to v3 with ALL FOUR legs intact, not its first-leg summary', () => {
    seedV2({ [V2_CONDOR.id]: V2_CONDOR });
    const [migrated] = allPositions().filter((p) => p.id === 'v2-condor');
    expect(migrated).toBeDefined();
    expect(migrated.legs).toHaveLength(4);
    expect(migrated.legs.map((l) => l.strike).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([
      360, 380, 420, 440,
    ]);
    // The consequence a trader would actually see: it is still a condor, NOT a single long call.
    expect(structureKindOf(migrated)).toBe('iron_condor');
  });

  it('survives a reload out of the v3 blob, still as four legs', () => {
    seedV2({ [V2_CONDOR.id]: V2_CONDOR });
    reload();
    expect(allPositions().find((p) => p.id === 'v2-condor')?.legs).toHaveLength(4);
  });

  it('a v2 record with NO `legs` still lifts through the flat summary, unchanged', () => {
    seedV2({ [LEGACY_V2_RECORD.id]: LEGACY_V2_RECORD });
    const p = allPositions()[0];
    expect(p.legs).toHaveLength(1);
    expect(p.legs[0].strike).toBe(LEGACY_V2_RECORD.strike);
    expect(p.legs[0].right).toBe(LEGACY_V2_RECORD.right);
    expect(p.legs[0].entry_price).toBe(LEGACY_V2_RECORD.entry_mark);
  });

  it('the flat summary is NEVER merged with `legs` — no leg is duplicated or invented', () => {
    seedV2({ [V2_CONDOR.id]: V2_CONDOR });
    const legs = allPositions()[0].legs;
    expect(legs).toHaveLength(4);
    expect(new Set(legs.map((l) => l.id)).size).toBe(4);
    // The flat summary's strike (440) appears EXACTLY once — as leg 0, not as a fifth leg.
    expect(legs.filter((l) => l.strike === 440)).toHaveLength(1);
  });
});

// ---- AC-52 / AC-51 — the notice ------------------------------------------------------------------

describe('the merge notice', () => {
  it('AC-52 — a trader with no saved data gets a normal empty portfolio, no notice, no error', () => {
    reload();
    expect(allPositions()).toEqual([]);
    expect(positionsHealth().faulted).toBe(false);
    expect(shouldShowMergeNotice()).toBe(false);
  });

  it('AC-52 — a Positions-page-only trader sees no notice', () => {
    localStorage.setItem(PORTFOLIO_V2_KEY, LEGACY_V2_BLOB);
    reload();
    expect(allPositions()).toHaveLength(1);
    expect(shouldShowMergeNotice()).toBe(false);
  });

  it('AC-51 — it appears for a BOTH-surfaces trader, survives reload, and never returns once dismissed', () => {
    localStorage.setItem(PORTFOLIO_V2_KEY, LEGACY_V2_BLOB);
    localStorage.setItem(PORTFOLIO_V1_KEY, LEGACY_V1_BLOB);
    reload();
    expect(shouldShowMergeNotice()).toBe(true);
    reload();
    expect(shouldShowMergeNotice()).toBe(true); // survives reload until dismissed

    expect(dismissMergeNotice()).toBe(true);
    expect(shouldShowMergeNotice()).toBe(false);
    reload();
    expect(shouldShowMergeNotice()).toBe(false); // durable — never reappears
    // Dismissing a notice must not touch a single record.
    expect(allPositions()).toHaveLength(2);
  });
});

// ---- AC-56 / AC-61 — the fault latch, now on the v3 key ------------------------------------------

describe('AC-56/61 — starting from an unparseable v3 blob', () => {
  it('every mutator leaves storage byte-identical, and sources are NOT consulted', () => {
    localStorage.setItem(PORTFOLIO_V2_KEY, LEGACY_V2_BLOB);
    localStorage.setItem(PORTFOLIO_V3_KEY, UNPARSEABLE_BLOB);
    reload();

    expect(positionsHealth().faulted).toBe(true);
    expect(positionsHealth().unread_sources).toEqual([PORTFOLIO_V3_KEY]);
    // v3 EXISTS, so no source is consulted — consulting them here would be the resurrection.
    expect(allPositions()).toEqual([]);

    const snapshot = JSON.stringify(localStorage);
    putPosition({ id: 'p-new', legs: [], opened_time: '', status: 'open' } as never);
    removePosition('p-new');
    appendDecision({ trade_id: 'p-new' } as unknown as DecisionRecord);
    putCustomization(getCustomization());
    expect(JSON.stringify(localStorage)).toBe(snapshot);
    expect(localStorage.getItem(PORTFOLIO_V3_KEY)).toBe(UNPARSEABLE_BLOB);
  });
});
