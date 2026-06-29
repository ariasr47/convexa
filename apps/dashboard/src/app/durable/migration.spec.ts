/**
 * rebrand-convexa — the loss-free migration MATRIX (FRONTEND_EXECUTION_CONTRACT §D.1–D.3, the QA
 * centerpiece). Drives the four durable stores' read APIs across both brand prefixes + versions,
 * mocking ONLY the storage boundary (real jsdom localStorage). Every AC-A* case maps to a named test
 * here. No live backend, no network.
 *
 * Verifies for EACH store: legacy `gammaflow.*` data carried WHOLE under `convexa.*`, the positions
 * v1→v2-across-brands 4-case chain, idempotency, never-delete/rollback-safe, corrupt-old → no throw /
 * no wipe, absent-old → clean new user, new-wins-when-both.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import * as positions from '../positions/store';
import {
  PORTFOLIO_V1_KEY, PORTFOLIO_V2_KEY, PORTFOLIO_LEGACY_V1_KEY, PORTFOLIO_LEGACY_V2_KEY,
} from '../positions/store';
import { PORTFOLIO_SCHEMA_VERSION } from '../positions/types';
import type { Position, PersistShapeV2, CustomizationState } from '../positions/types';
import { defaultCustomization } from '../positions/defaults';

import * as ghost from '../ghost-trade/store';
import { GHOST_TRADE_KEY, GHOST_TRADE_LEGACY_KEY } from '../ghost-trade/store';
import type { GhostTrade } from '../ghost-trade/types';

import * as personas from '../personas/store';
import { PERSONAS_KEY, PERSONAS_LEGACY_KEY, __resetPersonas } from '../personas/store';

import {
  loadLocalTheme, loadLocalDefaultTicker, saveLocalTheme, saveLocalDefaultTicker,
  __resetLocalPrefs, UIPREFS_KEY, UIPREFS_LEGACY_KEY,
} from '../auth/localPrefs';

// ---- helpers -----------------------------------------------------------------------------------

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
    id: 'p1', ticker: 'TSLA', expiration: '2026-07-17', strike: 250, right: 'call', side: 'long',
    qty: 2, entry_mark: 5, entry_basis: 'user_entered', entry_time: '2026-06-20T10:00:00Z',
    stop: null, target: null, status: 'open', schema_version: PORTFOLIO_SCHEMA_VERSION, ...over,
  };
}

function aTrade(over: Partial<GhostTrade> = {}): GhostTrade {
  return {
    id: 'legacy', ticker: 'TSLA', expiration: '2026-07-17', strike: 250, right: 'call', side: 'long',
    qty: 2, entry_mark: 5, entry_basis: 'snapshot', entry_time: '2026-06-20T10:00:00Z',
    status: 'open', schema_version: 1, ...over,
  };
}

function v2Blob(over: Partial<PersistShapeV2> = {}): string {
  return JSON.stringify({
    schema_version: PORTFOLIO_SCHEMA_VERSION,
    positions: { p1: aPosition() },
    decisions: [],
    customization: defaultCustomization(),
    ...over,
  });
}

// =================================================================================================
// Group A — each store carried WHOLE from the legacy gammaflow.* key (AC-A1..A7)
// =================================================================================================
describe('Group A — legacy gammaflow.* data carried whole into convexa.* (migrate-on-read)', () => {
  it('AC-A1 positions carried whole — same set / entry / status; new key now exists', () => {
    localStorage.setItem(PORTFOLIO_LEGACY_V2_KEY, v2Blob({
      positions: { a: aPosition({ id: 'a', entry_mark: 7, qty: 3 }), b: aPosition({ id: 'b', ticker: 'AAPL' }) },
    }));
    positions.__resetMemory();

    const all = positions.allPositions();
    expect(all.map((p) => p.id).sort()).toEqual(['a', 'b']);
    const a = positions.getPosition('a')!;
    expect(a.entry_mark).toBe(7);
    expect(a.qty).toBe(3);
    expect(a.status).toBe('open');
    // promoted forward — new key now populated.
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBeTruthy();
  });

  it('AC-A2 customization + saved named views restore exactly', () => {
    const custom: CustomizationState = {
      ...defaultCustomization(),
      views: [
        ...defaultCustomization().views,
        { id: 'v-named', name: 'My winners', config: defaultCustomization().working },
      ],
      activeViewId: 'v-named',
    };
    localStorage.setItem(PORTFOLIO_LEGACY_V2_KEY, v2Blob({ customization: custom }));
    positions.__resetMemory();

    const c = positions.getCustomization();
    expect(c.activeViewId).toBe('v-named');
    expect(c.views.some((v) => v.id === 'v-named' && v.name === 'My winners')).toBe(true);
  });

  it('AC-A3 closed positions + decision history fully present, unchanged', () => {
    const decisions = [{
      event_type: 'close', clock_time: '2026-06-21T10:00:00Z', trade_id: 'c1',
      contract: { ticker: 'TSLA', expiration: '2026-07-17', strike: 250, right: 'call', qty: 2 },
      mark_price: 8, mark_basis: 'snapshot', underlying_spot: 255, pl_dollar: 600, pl_pct: 0.6,
    }];
    localStorage.setItem(PORTFOLIO_LEGACY_V2_KEY, v2Blob({
      positions: { c1: aPosition({ id: 'c1', status: 'closed', realized_pl_dollar: 600 }) },
      decisions: decisions as never,
    }));
    positions.__resetMemory();

    expect(positions.getPosition('c1')!.status).toBe('closed');
    expect(positions.getPosition('c1')!.realized_pl_dollar).toBe(600);
    expect(positions.decisionsForPosition('c1')).toHaveLength(1);
  });

  it('AC-A4 ghost-trade open trade + decision records present, unchanged', () => {
    localStorage.setItem(GHOST_TRADE_LEGACY_KEY, JSON.stringify({
      schema_version: 1,
      trades: { TSLA: aTrade({ id: 'gt1', qty: 4 }) },
      decisions: [{
        event_type: 'open', clock_time: '2026-06-20T10:00:00Z', trade_id: 'gt1',
        contract: { ticker: 'TSLA', expiration: '2026-07-17', strike: 250, right: 'call', qty: 4 },
        mark_price: 5, mark_basis: 'snapshot', underlying_spot: 250, pl_dollar: 0, pl_pct: 0,
      }],
    }));
    ghost.__resetMemory();

    const t = ghost.getTrade('TSLA')!;
    expect(t.id).toBe('gt1');
    expect(t.qty).toBe(4);
    expect(ghost.decisionsForTrade('gt1')).toHaveLength(1);
    expect(localStorage.getItem(GHOST_TRADE_KEY)).toBeTruthy(); // promoted
  });

  it('AC-A5 custom personas all present', () => {
    localStorage.setItem(PERSONAS_LEGACY_KEY, JSON.stringify({
      schema_version: 1,
      customs: [
        { id: 'cp1', name: 'Scalper', disposition: 'aggressive', framing: 'x' },
        { id: 'cp2', name: 'Theta', disposition: 'income', framing: 'y' },
      ],
      active_persona_id: null,
    }));
    __resetPersonas();

    const list = personas.loadCustoms();
    expect(list.map((p) => p.id).sort()).toEqual(['cp1', 'cp2']);
    expect(localStorage.getItem(PERSONAS_KEY)).toBeTruthy();
  });

  it('AC-A6 active_persona_id selection still active (selection survives, not just the list)', () => {
    localStorage.setItem(PERSONAS_LEGACY_KEY, JSON.stringify({
      schema_version: 1,
      customs: [{ id: 'cp1', name: 'Scalper', disposition: 'aggressive', framing: 'x' }],
      active_persona_id: 'income_keeper',
    }));
    __resetPersonas();
    expect(personas.loadActiveId()).toBe('income_keeper');
  });

  it('AC-A7 theme applied + default ticker in effect', () => {
    localStorage.setItem(UIPREFS_LEGACY_KEY, JSON.stringify({
      schema_version: 1, theme: 'light', default_ticker: 'NVDA',
    }));
    __resetLocalPrefs();
    expect(loadLocalTheme()).toBe('light');
    expect(loadLocalDefaultTicker()).toBe('NVDA');
    expect(localStorage.getItem(UIPREFS_KEY)).toBeTruthy();
  });
});

// =================================================================================================
// Group A — positions resolution-order / chain cases (ARCHITECTURE §2.3) — each its own test
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
    localStorage.setItem(PORTFOLIO_LEGACY_V2_KEY, v2Blob({ positions: { y: aPosition({ id: 'y' }) } }));
    positions.__resetMemory();
    expect(positions.allPositions().map((p) => p.id)).toEqual(['y']);
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBeTruthy();        // promoted
    expect(localStorage.getItem(PORTFOLIO_LEGACY_V2_KEY)).toBeTruthy(); // source intact
  });

  it('case 3: convexa.ghost-trade.v1 only → migrateV1 → convexa.positions.v2', () => {
    localStorage.setItem(PORTFOLIO_V1_KEY, JSON.stringify({
      schema_version: 1, trades: { TSLA: aTrade({ id: 'g3' }) }, decisions: [],
    }));
    positions.__resetMemory();
    const all = positions.allPositions();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('g3');
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBeTruthy();   // migrated into v2
    expect(localStorage.getItem(PORTFOLIO_V1_KEY)).toBeTruthy();   // source ghost-trade intact
  });

  it('AC-A8 case 4: gammaflow.ghost-trade.v1 ONLY → legacy trade whole in convexa.positions.v2', () => {
    localStorage.setItem(PORTFOLIO_LEGACY_V1_KEY, JSON.stringify({
      schema_version: 1, trades: { TSLA: aTrade({ id: 'legacy', qty: 2 }) }, decisions: [],
    }));
    positions.__resetMemory();

    const all = positions.allPositions();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('legacy'); // whole — legacy version + brand hop in one read
    expect(all[0].qty).toBe(2);
    expect(all[0].status).toBe('open');
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBeTruthy();        // migrated trade landed in convexa v2
    expect(localStorage.getItem(PORTFOLIO_LEGACY_V1_KEY)).toBeTruthy(); // gammaflow source intact (rollback-safe)
    // Per FRONTEND_EXECUTION_CONTRACT §A.3 the v1 resolve uses resolveDurable('convexa.ghost-trade.v1',
    // 'gammaflow.ghost-trade.v1'), so it ALSO promotes the ghost blob forward to convexa.ghost-trade.v1
    // (same value the ghost-trade store promotes independently — idempotent, non-conflicting).
    expect(localStorage.getItem(PORTFOLIO_V1_KEY)).toBe(localStorage.getItem(PORTFOLIO_LEGACY_V1_KEY));
  });

  it('positions read prefers v2 over v1 when both legacy versions exist', () => {
    localStorage.setItem(PORTFOLIO_LEGACY_V2_KEY, v2Blob({ positions: { fromv2: aPosition({ id: 'fromv2' }) } }));
    localStorage.setItem(PORTFOLIO_LEGACY_V1_KEY, JSON.stringify({
      schema_version: 1, trades: { TSLA: aTrade({ id: 'fromv1' }) }, decisions: [],
    }));
    positions.__resetMemory();
    expect(positions.allPositions().map((p) => p.id)).toEqual(['fromv2']);
  });
});

// =================================================================================================
// Group A-Edge — idempotency / safety / degradation (AC-A9..A13) — for each store
// =================================================================================================
describe('AC-A9 idempotent — run twice = no-op, no duplicate/re-key/wipe', () => {
  it('positions: second read short-circuits at the new key', () => {
    localStorage.setItem(PORTFOLIO_LEGACY_V1_KEY, JSON.stringify({
      schema_version: 1, trades: { TSLA: aTrade({ id: 'legacy' }) }, decisions: [],
    }));
    positions.__resetMemory();
    const first = positions.allPositions();
    const promoted = localStorage.getItem(PORTFOLIO_V2_KEY);

    positions.__resetMemory(); // simulate a reload
    const second = positions.allPositions();
    expect(second.map((p) => p.id)).toEqual(first.map((p) => p.id));
    expect(second).toHaveLength(1); // no duplication
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBe(promoted); // unchanged blob
  });

  it('ghost-trade / personas / uiprefs: re-read identical, no dup', () => {
    localStorage.setItem(GHOST_TRADE_LEGACY_KEY, JSON.stringify({
      schema_version: 1, trades: { TSLA: aTrade({ id: 'g' }) }, decisions: [],
    }));
    localStorage.setItem(PERSONAS_LEGACY_KEY, JSON.stringify({
      schema_version: 1, customs: [{ id: 'cp', name: 'X', disposition: 'd', framing: 'f' }], active_persona_id: 'cp',
    }));
    localStorage.setItem(UIPREFS_LEGACY_KEY, JSON.stringify({ schema_version: 1, theme: 'light', default_ticker: 'NVDA' }));
    ghost.__resetMemory(); __resetPersonas(); __resetLocalPrefs();

    ghost.getTrade('TSLA'); personas.loadCustoms(); loadLocalTheme();
    const gNew = localStorage.getItem(GHOST_TRADE_KEY);
    const pNew = localStorage.getItem(PERSONAS_KEY);
    const uNew = localStorage.getItem(UIPREFS_KEY);

    ghost.__resetMemory(); __resetPersonas(); __resetLocalPrefs();
    expect(ghost.getTrade('TSLA')!.id).toBe('g');
    expect(personas.loadCustoms()).toHaveLength(1);
    expect(personas.loadActiveId()).toBe('cp');
    expect(loadLocalTheme()).toBe('light');
    // blobs unchanged on the second pass.
    expect(localStorage.getItem(GHOST_TRADE_KEY)).toBe(gNew);
    expect(localStorage.getItem(PERSONAS_KEY)).toBe(pNew);
    expect(localStorage.getItem(UIPREFS_KEY)).toBe(uNew);
  });
});

describe('AC-A10 old key never deleted (rollback-safe) — every store', () => {
  it('all four stores leave the gammaflow.* source intact after migrate', () => {
    localStorage.setItem(PORTFOLIO_LEGACY_V2_KEY, v2Blob());
    localStorage.setItem(GHOST_TRADE_LEGACY_KEY, JSON.stringify({ schema_version: 1, trades: { TSLA: aTrade() }, decisions: [] }));
    localStorage.setItem(PERSONAS_LEGACY_KEY, JSON.stringify({ schema_version: 1, customs: [], active_persona_id: 'x' }));
    localStorage.setItem(UIPREFS_LEGACY_KEY, JSON.stringify({ schema_version: 1, theme: 'light', default_ticker: 'NVDA' }));
    resetAll();

    positions.allPositions();
    ghost.getTrade('TSLA');
    personas.loadActiveId();
    loadLocalTheme();

    expect(localStorage.getItem(PORTFOLIO_LEGACY_V2_KEY)).not.toBeNull();
    expect(localStorage.getItem(GHOST_TRADE_LEGACY_KEY)).not.toBeNull();
    expect(localStorage.getItem(PERSONAS_LEGACY_KEY)).not.toBeNull();
    expect(localStorage.getItem(UIPREFS_LEGACY_KEY)).not.toBeNull();
  });
});

describe('AC-A11 corrupt old blob → empty in-memory, NO throw, blob NOT destroyed', () => {
  it('positions corrupt legacy v2', () => {
    localStorage.setItem(PORTFOLIO_LEGACY_V2_KEY, '{ corrupt');
    positions.__resetMemory();
    expect(() => positions.allPositions()).not.toThrow();
    expect(positions.allPositions()).toEqual([]);
    expect(localStorage.getItem(PORTFOLIO_LEGACY_V2_KEY)).toBe('{ corrupt'); // intact
  });

  it('ghost-trade corrupt legacy', () => {
    localStorage.setItem(GHOST_TRADE_LEGACY_KEY, '{ corrupt');
    ghost.__resetMemory();
    expect(() => ghost.getTrade('TSLA')).not.toThrow();
    expect(ghost.getTrade('TSLA')).toBeNull();
    expect(localStorage.getItem(GHOST_TRADE_LEGACY_KEY)).toBe('{ corrupt');
  });

  it('personas corrupt legacy', () => {
    localStorage.setItem(PERSONAS_LEGACY_KEY, '{ corrupt');
    __resetPersonas();
    expect(() => personas.loadCustoms()).not.toThrow();
    expect(personas.loadCustoms()).toEqual([]);
    expect(personas.loadActiveId()).toBeNull();
    expect(localStorage.getItem(PERSONAS_LEGACY_KEY)).toBe('{ corrupt');
  });

  it('uiprefs corrupt legacy', () => {
    localStorage.setItem(UIPREFS_LEGACY_KEY, '{ corrupt');
    __resetLocalPrefs();
    expect(() => loadLocalTheme()).not.toThrow();
    expect(loadLocalDefaultTicker()).toBeNull();
    expect(localStorage.getItem(UIPREFS_LEGACY_KEY)).toBe('{ corrupt');
  });
});

describe('AC-A12 absent old data → clean new user; subsequent writes persist to the new key', () => {
  it('positions: clean empty then a created position persists under convexa key', () => {
    positions.__resetMemory();
    expect(positions.allPositions()).toEqual([]);
    positions.putPosition(aPosition({ id: 'new' }));
    positions.__resetMemory(); // reload
    expect(positions.allPositions().map((p) => p.id)).toEqual(['new']);
    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBeTruthy();
    expect(localStorage.getItem(PORTFOLIO_LEGACY_V2_KEY)).toBeNull(); // never wrote the old key
  });

  it('uiprefs: clean defaults then a saved pref persists under convexa key', () => {
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

  it('personas: clean default then an upserted custom persists', () => {
    __resetPersonas();
    expect(personas.loadCustoms()).toEqual([]);
    personas.upsertCustom({ id: 'np', name: 'New', disposition: 'd', framing: 'f' } as never);
    __resetPersonas();
    expect(personas.loadCustoms().map((p) => p.id)).toEqual(['np']);
    expect(localStorage.getItem(PERSONAS_LEGACY_KEY)).toBeNull();
  });
});

describe('AC-A13 both new + leftover old → new wins, old not merged, old still present', () => {
  it('positions: shows convexa data, never the gammaflow leftover', () => {
    localStorage.setItem(PORTFOLIO_V2_KEY, v2Blob({ positions: { newp: aPosition({ id: 'newp' }) } }));
    localStorage.setItem(PORTFOLIO_LEGACY_V2_KEY, v2Blob({ positions: { oldp: aPosition({ id: 'oldp' }) } }));
    positions.__resetMemory();
    const ids = positions.allPositions().map((p) => p.id);
    expect(ids).toEqual(['newp']);      // new wins
    expect(ids).not.toContain('oldp');  // old not merged
    expect(localStorage.getItem(PORTFOLIO_LEGACY_V2_KEY)).toBeTruthy(); // old still present
  });

  it('personas: convexa active id wins over gammaflow leftover', () => {
    localStorage.setItem(PERSONAS_KEY, JSON.stringify({ schema_version: 1, customs: [], active_persona_id: 'new_active' }));
    localStorage.setItem(PERSONAS_LEGACY_KEY, JSON.stringify({ schema_version: 1, customs: [{ id: 'old', name: 'O', disposition: 'd', framing: 'f' }], active_persona_id: 'old_active' }));
    __resetPersonas();
    expect(personas.loadActiveId()).toBe('new_active');
    expect(personas.loadCustoms()).toEqual([]); // old customs not merged
    expect(localStorage.getItem(PERSONAS_LEGACY_KEY)).toBeTruthy();
  });

  it('uiprefs: convexa theme wins over gammaflow leftover', () => {
    localStorage.setItem(UIPREFS_KEY, JSON.stringify({ schema_version: 1, theme: 'dark', default_ticker: 'NEW' }));
    localStorage.setItem(UIPREFS_LEGACY_KEY, JSON.stringify({ schema_version: 1, theme: 'light', default_ticker: 'OLD' }));
    __resetLocalPrefs();
    expect(loadLocalTheme()).toBe('dark');
    expect(loadLocalDefaultTicker()).toBe('NEW');
    expect(localStorage.getItem(UIPREFS_LEGACY_KEY)).toBeTruthy();
  });
});
