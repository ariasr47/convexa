/**
 * `loss-free-durable-migration` (PROMOTED, severity path) — the migration MATRIX for the ~5
 * localStorage stores that hold the user's entire trading history with NO server backup. Drives the
 * four durable stores' read APIs across both brand prefixes + versions, mocking ONLY the storage
 * boundary (real jsdom localStorage). No live backend, no network.
 *
 * Risk-migrated 2026-07-16: the rebrand's per-key AC padding is consolidated into a parameterized
 * run over the 4 migrated keys (positions / ghost-trade / personas / uiprefs); every migration-LOGIC
 * guarantee is preserved verbatim:
 *   - read-new-else-old + promote-forward (new key populated, old key NEVER deleted — rollback-safe)
 *   - idempotent (a re-run/reload changes nothing: same data, byte-identical promoted blob)
 *   - never-throw on a corrupt old blob (degrade to empty; the original blob SURVIVES the read)
 *   - content FIDELITY per store (carried WHOLE: positions + customization + decisions; ghost trade
 *     + decisions; personas + active selection; theme + default ticker)
 *   - the positions v1→v2-ACROSS-BRANDS 4-case resolution chain (first hit wins, source intact)
 *   - absent-old → clean new user, writes land ONLY under convexa.*
 *   - both-present → new wins, old not merged, old still present
 *
 * NOTE: `convexa.ghost-trade.v1` (= positions' PORTFOLIO_V1_KEY) LOOKS legacy but is ACTIVELY
 * WRITTEN (documented store split) — never assert it dead here. The ghost-trade store's own
 * migration contract lives in `features/trading/model/store.spec.ts`; the pure resolver unit tests
 * live in `resolveDurable.spec.ts`. Brand-copy assertions (wordmarks, filenames) were dropped in
 * this migration — they are visible surfaces, not silent-loss risks.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { defaultCustomization } from '@/features/trading/positions/defaults';
import type { SimPosition } from '@/features/trading/positions/leg';
import { liftLegacyRecord } from '@/features/trading/positions/migrate';
import * as positions from '@/features/trading/positions/store';
import {
  PORTFOLIO_LEGACY_V1_KEY,
  PORTFOLIO_LEGACY_V2_KEY,
  PORTFOLIO_V1_KEY,
  PORTFOLIO_V2_KEY,
  PORTFOLIO_V3_KEY,
} from '@/features/trading/positions/store';
import type {
  CustomizationState,
  PersistShapeV2,
  Position,
} from '@/features/trading/positions/types';
import { PORTFOLIO_SCHEMA_VERSION } from '@/features/trading/positions/types';

import * as ghost from '@/features/trading/model/store';
import { GHOST_TRADE_KEY, GHOST_TRADE_LEGACY_KEY } from '@/features/trading/model/store';

import * as personas from '@/features/personas/store';
import { __resetPersonas, PERSONAS_KEY, PERSONAS_LEGACY_KEY } from '@/features/personas/store';

import {
  __resetLocalPrefs,
  loadLocalDefaultTicker,
  loadLocalTheme,
  saveLocalDefaultTicker,
  saveLocalTheme,
  UIPREFS_KEY,
  UIPREFS_LEGACY_KEY,
} from '@/features/auth/localPrefs';

// ---- fixtures ------------------------------------------------------------------------------------

function resetAll() {
  positions.__resetMemory();
  ghost.__resetMemory();
  __resetPersonas();
  __resetLocalPrefs();
}

beforeEach(() => {
  localStorage.clear();
  resetAll();
});

function aPosition(over: Partial<Position> = {}): Position {
  return {
    id: 'p1',
    ticker: 'TSLA',
    expiration: '2026-07-17',
    strike: 250,
    right: 'call',
    side: 'long',
    qty: 2,
    entry_mark: 5,
    entry_basis: 'user_entered',
    entry_time: '2026-06-20T10:00:00Z',
    stop: null,
    target: null,
    status: 'open',
    schema_version: PORTFOLIO_SCHEMA_VERSION,
    ...over,
  };
}

function aTrade(over: Record<string, unknown> = {}) {
  return {
    id: 'legacy',
    ticker: 'TSLA',
    expiration: '2026-07-17',
    strike: 250,
    right: 'call',
    side: 'long',
    qty: 2,
    entry_mark: 5,
    entry_basis: 'snapshot',
    entry_time: '2026-06-20T10:00:00Z',
    status: 'open',
    schema_version: 1,
    ...over,
  };
}

/** The ONE lift is how a legacy row becomes a durable record now — never a second hand conversion. */
const lifted = (raw: unknown) => liftLegacyRecord(raw) as SimPosition;

function v2Blob(over: Partial<PersistShapeV2> = {}): string {
  return JSON.stringify({
    schema_version: PORTFOLIO_SCHEMA_VERSION,
    positions: { p1: aPosition() },
    decisions: [],
    customization: defaultCustomization(),
    ...over,
  });
}

const ghostBlob = () =>
  JSON.stringify({ schema_version: 1, trades: { TSLA: aTrade({ id: 'g' }) }, decisions: [] });
const personasBlob = () =>
  JSON.stringify({
    schema_version: 1,
    customs: [{ id: 'cp', name: 'X', disposition: 'd', framing: 'f' }],
    active_persona_id: 'cp',
  });
const uiprefsBlob = () =>
  JSON.stringify({ schema_version: 1, theme: 'light', default_ticker: 'NVDA' });

// ---- the 4-store adapter table (drives the parameterized safety runs) -----------------------------

interface StoreCase {
  name: string;
  legacyKey: string;
  newKey: string;
  seedLegacy(): void;
  reset(): void;
  /** Triggers the migrate-on-read and returns the observable data (deep-comparable). */
  read(): unknown;
  /** Corrupt-blob degraded read: MUST not throw; MUST come back empty (never garbage). */
  expectEmpty(): void;
}

const STORES: StoreCase[] = [
  {
    name: 'positions',
    legacyKey: PORTFOLIO_LEGACY_V2_KEY,
    newKey: PORTFOLIO_V2_KEY,
    seedLegacy: () => localStorage.setItem(PORTFOLIO_LEGACY_V2_KEY, v2Blob()),
    reset: () => positions.__resetMemory(),
    read: () => positions.allPositions(),
    expectEmpty: () => expect(positions.allPositions()).toEqual([]),
  },
  {
    name: 'ghost-trade',
    legacyKey: GHOST_TRADE_LEGACY_KEY,
    newKey: GHOST_TRADE_KEY,
    seedLegacy: () => localStorage.setItem(GHOST_TRADE_LEGACY_KEY, ghostBlob()),
    reset: () => ghost.__resetMemory(),
    read: () => ghost.getTrade('TSLA'),
    expectEmpty: () => expect(ghost.getTrade('TSLA')).toBeNull(),
  },
  {
    name: 'personas',
    legacyKey: PERSONAS_LEGACY_KEY,
    newKey: PERSONAS_KEY,
    seedLegacy: () => localStorage.setItem(PERSONAS_LEGACY_KEY, personasBlob()),
    reset: () => __resetPersonas(),
    read: () => ({ customs: personas.loadCustoms(), active: personas.loadActiveId() }),
    expectEmpty: () => {
      expect(personas.loadCustoms()).toEqual([]);
      expect(personas.loadActiveId()).toBeNull();
    },
  },
  {
    name: 'uiprefs',
    legacyKey: UIPREFS_LEGACY_KEY,
    newKey: UIPREFS_KEY,
    seedLegacy: () => localStorage.setItem(UIPREFS_LEGACY_KEY, uiprefsBlob()),
    reset: () => __resetLocalPrefs(),
    read: () => ({ theme: loadLocalTheme(), ticker: loadLocalDefaultTicker() }),
    expectEmpty: () => expect(loadLocalDefaultTicker()).toBeNull(),
  },
];

// =================================================================================================
// Parameterized safety run — promote-forward / never-delete / idempotent / corrupt, all 4 keys
// =================================================================================================
describe.each(STORES)('$name — migrate-on-read safety', (store) => {
  it('promotes the legacy blob forward AND never deletes the old key (rollback-safe)', () => {
    store.seedLegacy();
    store.reset();
    store.read();
    expect(localStorage.getItem(store.newKey)).toBeTruthy(); // promoted forward
    expect(localStorage.getItem(store.legacyKey)).not.toBeNull(); // source intact
  });

  it('is idempotent: a reload/re-read yields identical data and a byte-identical promoted blob', () => {
    store.seedLegacy();
    store.reset();
    const first = store.read();
    const promoted = localStorage.getItem(store.newKey);

    store.reset(); // simulate a reload
    const second = store.read();
    expect(second).toEqual(first); // same data, no duplication/re-key
    expect(localStorage.getItem(store.newKey)).toBe(promoted); // blob unchanged
  });

  it('corrupt old blob → empty in-memory, NO throw, and the original blob SURVIVES the read', () => {
    localStorage.setItem(store.legacyKey, '{ corrupt');
    store.reset();
    expect(() => store.read()).not.toThrow();
    store.expectEmpty();
    expect(localStorage.getItem(store.legacyKey)).toBe('{ corrupt'); // never destroyed
  });
});

// =================================================================================================
// Content FIDELITY — each store's data carried WHOLE (the loss-free core, store-specific shapes)
// =================================================================================================
describe('legacy gammaflow.* data carried WHOLE into convexa.*', () => {
  it('positions: open + closed positions, realized P/L, decision history, customization + named views', () => {
    const custom: CustomizationState = {
      ...defaultCustomization(),
      views: [
        ...defaultCustomization().views,
        { id: 'v-named', name: 'My winners', config: defaultCustomization().working },
      ],
      activeViewId: 'v-named',
    };
    const decisions = [
      {
        event_type: 'close',
        clock_time: '2026-06-21T10:00:00Z',
        trade_id: 'c1',
        contract: { ticker: 'TSLA', expiration: '2026-07-17', strike: 250, right: 'call', qty: 2 },
        mark_price: 8,
        mark_basis: 'snapshot',
        underlying_spot: 255,
        pl_dollar: 600,
        pl_pct: 0.6,
      },
    ];
    localStorage.setItem(
      PORTFOLIO_LEGACY_V2_KEY,
      v2Blob({
        positions: {
          a: aPosition({ id: 'a', entry_mark: 7, qty: 3 }),
          c1: aPosition({ id: 'c1', status: 'closed', realized_pl_dollar: 600 }),
        },
        decisions: decisions as never,
        customization: custom,
      }),
    );
    positions.__resetMemory();

    expect(
      positions
        .allPositions()
        .map((p) => p.id)
        .sort(),
    ).toEqual(['a', 'c1']);
    const a = positions.getPosition('a');
    if (!a) throw new Error('position "a" missing after migration');
    expect(a.legs[0].entry_price).toBe(7);
    expect(a.legs[0].qty).toBe(3);
    expect(a.status).toBe('open');
    const c1 = positions.getPosition('c1');
    if (!c1) throw new Error('position "c1" missing after migration');
    expect(c1.status).toBe('closed');
    expect(c1.realized_pl_dollar).toBe(600);
    expect(positions.decisionsForPosition('c1')).toHaveLength(1);
    const c = positions.getCustomization();
    expect(c.activeViewId).toBe('v-named');
    expect(c.views.some((v) => v.id === 'v-named' && v.name === 'My winners')).toBe(true);
  });

  it('ghost-trade: open trade + decision records present, unchanged', () => {
    localStorage.setItem(
      GHOST_TRADE_LEGACY_KEY,
      JSON.stringify({
        schema_version: 1,
        trades: { TSLA: aTrade({ id: 'gt1', qty: 4 }) },
        decisions: [
          {
            event_type: 'open',
            clock_time: '2026-06-20T10:00:00Z',
            trade_id: 'gt1',
            contract: {
              ticker: 'TSLA',
              expiration: '2026-07-17',
              strike: 250,
              right: 'call',
              qty: 4,
            },
            mark_price: 5,
            mark_basis: 'snapshot',
            underlying_spot: 250,
            pl_dollar: 0,
            pl_pct: 0,
          },
        ],
      }),
    );
    ghost.__resetMemory();

    // `getTrade` returns OPAQUE material now: `GhostTrade` went out with the v1 writer, and nothing
    // interprets a legacy record but the ONE lift (`positions/migrate.liftLegacyRecord`), which is
    // total over arbitrary material. The claim under test is unchanged and still the right one —
    // the legacy blob's bytes SURVIVE the read — so it is asserted against the material itself
    // rather than through a type the store deliberately no longer promises. (`model/store.spec.ts`
    // narrows at its own call sites for the same reason.)
    expect(ghost.getTrade('TSLA')).toMatchObject({ id: 'gt1', qty: 4 });
    expect(ghost.decisionsForTrade('gt1')).toHaveLength(1);
  });

  it('personas: all customs present AND the active selection survives (not just the list)', () => {
    localStorage.setItem(
      PERSONAS_LEGACY_KEY,
      JSON.stringify({
        schema_version: 1,
        customs: [
          { id: 'cp1', name: 'Scalper', disposition: 'aggressive', framing: 'x' },
          { id: 'cp2', name: 'Theta', disposition: 'income', framing: 'y' },
        ],
        active_persona_id: 'income_keeper',
      }),
    );
    __resetPersonas();

    expect(
      personas
        .loadCustoms()
        .map((p) => p.id)
        .sort(),
    ).toEqual(['cp1', 'cp2']);
    expect(personas.loadActiveId()).toBe('income_keeper');
  });

  it('uiprefs: theme applied + default ticker in effect', () => {
    localStorage.setItem(UIPREFS_LEGACY_KEY, uiprefsBlob());
    __resetLocalPrefs();
    expect(loadLocalTheme()).toBe('light');
    expect(loadLocalDefaultTicker()).toBe('NVDA');
  });
});

// =================================================================================================
// positions 4-case resolution chain (brand × version), first hit wins, source intact
// =================================================================================================
describe('positions 4-case resolution (brand × version), first hit wins, source intact', () => {
  it('case 1: convexa.positions.v2 only → hydrate v2, no migration', () => {
    localStorage.setItem(PORTFOLIO_V2_KEY, v2Blob({ positions: { x: aPosition({ id: 'x' }) } }));
    positions.__resetMemory();
    expect(positions.allPositions().map((p) => p.id)).toEqual(['x']);
    // no legacy keys created.
    expect(localStorage.getItem(PORTFOLIO_LEGACY_V2_KEY)).toBeNull();
  });

  it('case 2: gammaflow.positions.v2 only → hydrate + promote to convexa.positions.v2', () => {
    localStorage.setItem(
      PORTFOLIO_LEGACY_V2_KEY,
      v2Blob({ positions: { y: aPosition({ id: 'y' }) } }),
    );
    positions.__resetMemory();
    expect(positions.allPositions().map((p) => p.id)).toEqual(['y']);
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBeTruthy(); // promoted
    expect(localStorage.getItem(PORTFOLIO_LEGACY_V2_KEY)).toBeTruthy(); // source intact
  });

  it('case 3: convexa.ghost-trade.v1 only → migrateV1 → convexa.positions.v2 (ghost source intact — it is ACTIVELY WRITTEN, never dead)', () => {
    localStorage.setItem(
      PORTFOLIO_V1_KEY,
      JSON.stringify({
        schema_version: 1,
        trades: { TSLA: aTrade({ id: 'g3' }) },
        decisions: [],
      }),
    );
    positions.__resetMemory();
    const all = positions.allPositions();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('g3');
    expect(localStorage.getItem(PORTFOLIO_V3_KEY)).toBeTruthy(); // unioned into the ONE book
    expect(localStorage.getItem(PORTFOLIO_V1_KEY)).toBeTruthy(); // source ghost-trade intact
  });

  it('case 4: gammaflow.ghost-trade.v1 ONLY → legacy trade whole in convexa.positions.v2 (version + brand hop in one read)', () => {
    localStorage.setItem(
      PORTFOLIO_LEGACY_V1_KEY,
      JSON.stringify({
        schema_version: 1,
        trades: { TSLA: aTrade({ id: 'legacy', qty: 2 }) },
        decisions: [],
      }),
    );
    positions.__resetMemory();

    const all = positions.allPositions();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('legacy'); // whole — legacy version + brand hop in one read
    expect(all[0].legs[0].qty).toBe(2);
    expect(all[0].status).toBe('open');
    expect(localStorage.getItem(PORTFOLIO_V3_KEY)).toBeTruthy(); // landed in the ONE book
    expect(localStorage.getItem(PORTFOLIO_LEGACY_V1_KEY)).toBeTruthy(); // gammaflow source intact (rollback-safe)
    // Per FRONTEND_EXECUTION_CONTRACT §A.3 the v1 resolve uses resolveDurable('convexa.ghost-trade.v1',
    // 'gammaflow.ghost-trade.v1'), so it ALSO promotes the ghost blob forward to convexa.ghost-trade.v1
    // (same value the ghost-trade store promotes independently — idempotent, non-conflicting).
    expect(localStorage.getItem(PORTFOLIO_V1_KEY)).toBe(
      localStorage.getItem(PORTFOLIO_LEGACY_V1_KEY),
    );
  });

  it('positions UNIONS v2 and v1 when both legacy versions exist — the else-chain WAS the bug', () => {
    localStorage.setItem(
      PORTFOLIO_LEGACY_V2_KEY,
      v2Blob({ positions: { fromv2: aPosition({ id: 'fromv2' }) } }),
    );
    localStorage.setItem(
      PORTFOLIO_LEGACY_V1_KEY,
      JSON.stringify({
        schema_version: 1,
        trades: { TSLA: aTrade({ id: 'fromv1' }) },
        decisions: [],
      }),
    );
    positions.__resetMemory();
    // The shipped read-new-else-old chain returned ONLY `fromv2` and silently dropped every
    // Ticker-page ghost trade for any user who had ever opened the Positions page. The v3 migration
    // is a UNION precisely so that loss cannot happen (SPEC §2.6) — v2 still takes PRECEDENCE on a
    // colliding id, but v1-only records are kept.
    expect(
      positions
        .allPositions()
        .map((p) => p.id)
        .sort(),
    ).toEqual(['fromv1', 'fromv2']);
  });
});

// =================================================================================================
// Absent-old → clean new user; writes land ONLY under convexa.* (never re-create the old key)
// =================================================================================================
describe('absent old data → clean new user; subsequent writes persist ONLY to the new keys', () => {
  it('positions / personas / uiprefs: clean empty, then a write survives a reload under convexa.*', () => {
    // positions
    positions.__resetMemory();
    expect(positions.allPositions()).toEqual([]);
    positions.putPosition(lifted(aPosition({ id: 'new' })));
    positions.__resetMemory(); // reload
    expect(positions.allPositions().map((p) => p.id)).toEqual(['new']);
    expect(localStorage.getItem(PORTFOLIO_V3_KEY)).toBeTruthy();
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBeNull(); // never wrote a superseded key
    expect(localStorage.getItem(PORTFOLIO_LEGACY_V2_KEY)).toBeNull(); // never wrote the old key

    // personas
    __resetPersonas();
    expect(personas.loadCustoms()).toEqual([]);
    personas.upsertCustom({ id: 'np', name: 'New', disposition: 'd', framing: 'f' } as never);
    __resetPersonas();
    expect(personas.loadCustoms().map((p) => p.id)).toEqual(['np']);
    expect(localStorage.getItem(PERSONAS_LEGACY_KEY)).toBeNull();

    // uiprefs
    __resetLocalPrefs();
    expect(loadLocalDefaultTicker()).toBeNull();
    saveLocalDefaultTicker('amd');
    saveLocalTheme('light');
    __resetLocalPrefs();
    expect(loadLocalDefaultTicker()).toBe('AMD');
    expect(loadLocalTheme()).toBe('light');
    expect(localStorage.getItem(UIPREFS_KEY)).toBeTruthy();
    expect(localStorage.getItem(UIPREFS_LEGACY_KEY)).toBeNull();
  });
});

// =================================================================================================
// Both new + leftover old → new wins, old NOT merged, old still present
// =================================================================================================
describe('both new + leftover old → new wins, old not merged, old still present', () => {
  it('positions / personas / uiprefs: the convexa data shows, the gammaflow leftover never bleeds in', () => {
    // positions
    localStorage.setItem(
      PORTFOLIO_V2_KEY,
      v2Blob({ positions: { newp: aPosition({ id: 'newp' }) } }),
    );
    localStorage.setItem(
      PORTFOLIO_LEGACY_V2_KEY,
      v2Blob({ positions: { oldp: aPosition({ id: 'oldp' }) } }),
    );
    positions.__resetMemory();
    const ids = positions.allPositions().map((p) => p.id);
    expect(ids).toEqual(['newp']); // new wins
    expect(ids).not.toContain('oldp'); // old not merged
    expect(localStorage.getItem(PORTFOLIO_LEGACY_V2_KEY)).toBeTruthy(); // old still present

    // personas
    localStorage.setItem(
      PERSONAS_KEY,
      JSON.stringify({ schema_version: 1, customs: [], active_persona_id: 'new_active' }),
    );
    localStorage.setItem(
      PERSONAS_LEGACY_KEY,
      JSON.stringify({
        schema_version: 1,
        customs: [{ id: 'old', name: 'O', disposition: 'd', framing: 'f' }],
        active_persona_id: 'old_active',
      }),
    );
    __resetPersonas();
    expect(personas.loadActiveId()).toBe('new_active');
    expect(personas.loadCustoms()).toEqual([]); // old customs not merged
    expect(localStorage.getItem(PERSONAS_LEGACY_KEY)).toBeTruthy();

    // uiprefs
    localStorage.setItem(
      UIPREFS_KEY,
      JSON.stringify({ schema_version: 1, theme: 'dark', default_ticker: 'NEW' }),
    );
    localStorage.setItem(
      UIPREFS_LEGACY_KEY,
      JSON.stringify({ schema_version: 1, theme: 'light', default_ticker: 'OLD' }),
    );
    __resetLocalPrefs();
    expect(loadLocalTheme()).toBe('dark');
    expect(loadLocalDefaultTicker()).toBe('NEW');
    expect(localStorage.getItem(UIPREFS_LEGACY_KEY)).toBeTruthy();
  });
});
