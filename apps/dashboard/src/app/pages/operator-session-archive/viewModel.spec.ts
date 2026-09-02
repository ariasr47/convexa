import { describe, expect, it } from 'vitest';
import {
  initialArchiveState,
  reduceArchive,
  staleChip,
  type ArchiveState,
  type BookRow,
  type CoverageMatrix,
} from './viewModel';
import type { DigestProjection } from './digest';

const spyRows: BookRow[] = [
  {
    symbol: 'SPY',
    et_date: '2024-06-03',
    source: 'live_massive',
    source_as_of: '2024-06-03T20:00:00Z',
  },
];

const qqqRows: BookRow[] = [
  {
    symbol: 'QQQ',
    et_date: '2024-06-04',
    source: 'live_massive',
    source_as_of: '2024-06-04T20:00:00Z',
  },
];

const matrix: CoverageMatrix = {
  framing: 'RESEARCH READ — SESSION ARCHIVE COVERAGE',
  command: 'archive-coverage',
  evidence: 'this process',
  symbols: ['SPY', 'QQQ', 'IWM'],
  et_date: '2024-06-03',
  checkpoint: 'after 16:00 America/New_York',
  verdict: 'fail',
  expected_due: 3,
  present: 1,
  missing: 1,
  unreadable: 0,
  not_yet_due: 1,
  blocked_occupancy: 0,
  rows: [
    {
      symbol: 'SPY',
      et_date: '2024-06-03',
      cell: 'present',
      last_readable: 'SPY 2024-06-03',
    },
  ],
  holes: [],
};

const digest: DigestProjection = {
  symbol: 'SPY',
  et_date: '2024-06-03',
  source_as_of: '2024-06-03T20:00:00Z',
  source: 'live_massive',
  authorizes: 'nothing',
  framing: 'RESEARCH READ — SESSION BOOK',
  provenance: 'loaded from session archive · no vendor call',
  license: 'Our research · not redistributed on a trader route.',
  contractsCount: 2,
  dailyBarsCount: 1,
  minutesCount: 1,
  tradesCount: 1,
};

function unlockedWithSpyList(): ArchiveState {
  let s = initialArchiveState();
  s = reduceArchive(s, { type: 'UNLOCK_START' });
  s = reduceArchive(s, {
    type: 'LIST_RESULT',
    arm: { kind: 'Ready', json: {} },
    rows: spyRows,
    framing: 'RESEARCH READ — SESSION BOOK',
    authorizes: 'nothing',
  });
  s = reduceArchive(s, {
    type: 'COVERAGE_RESULT',
    arm: { kind: 'Ready', json: {} },
    matrix,
  });
  return s;
}

describe('viewModel class splits', () => {
  it('origin reject — no corpus', () => {
    const s = reduceArchive(initialArchiveState(), {
      type: 'ORIGIN_REJECTED',
      reason: 'pages',
    });
    expect(s.standing).toEqual({ kind: 'origin-rejected', reason: 'pages' });
    expect(s.books.kind).toBe('hidden');
    expect(s.coverage.kind).toBe('hidden');
  });

  it('401 — unauthorized hides corpus', () => {
    let s = reduceArchive(initialArchiveState(), { type: 'UNLOCK_START' });
    s = reduceArchive(s, {
      type: 'LIST_RESULT',
      arm: { kind: 'Unauthorized', detail: 'Set Authorization: Bearer …' },
    });
    expect(s.standing.kind).toBe('unauthorized');
    expect(s.books.kind).toBe('hidden');
    expect(s.coverage.kind).toBe('hidden');
  });

  it('family-404 — origin-blocked', () => {
    let s = reduceArchive(initialArchiveState(), { type: 'UNLOCK_START' });
    s = reduceArchive(s, {
      type: 'LIST_RESULT',
      arm: { kind: 'OriginPages404' },
    });
    expect(s.standing.kind).toBe('origin-blocked');
    expect(s.books.kind).toBe('hidden');
  });

  it('empty list', () => {
    let s = reduceArchive(initialArchiveState(), { type: 'UNLOCK_START' });
    s = reduceArchive(s, {
      type: 'LIST_RESULT',
      arm: {
        kind: 'EmptyList',
        detail: 'no session book for SPY',
        framing: 'RESEARCH READ — NO SESSION BOOK',
      },
    });
    expect(s.books.kind).toBe('empty');
    if (s.books.kind === 'empty') {
      expect(s.books.detail).toBe('no session book for SPY');
    }
  });

  it('warm classified CORS ≠ stale', () => {
    let s = unlockedWithSpyList();
    s = reduceArchive(s, {
      type: 'LIST_RESULT',
      arm: { kind: 'OriginCors' },
      sameChipRetry: true,
    });
    expect(s.standing.kind).toBe('cors-fault');
    expect(s.books.kind).toBe('hidden');
    expect(staleChip(s)).toBe(false);
  });

  it('cold list offline', () => {
    let s = reduceArchive(initialArchiveState(), { type: 'UNLOCK_START' });
    s = reduceArchive(s, {
      type: 'LIST_RESULT',
      arm: { kind: 'UnclassifiedTransport' },
    });
    expect(s.books.kind).toBe('offline');
    expect(staleChip(s)).toBe(false);
  });

  it('warm same-chip Retry unclassified → stale', () => {
    let s = unlockedWithSpyList();
    s = reduceArchive(s, {
      type: 'LIST_RESULT',
      arm: { kind: 'UnclassifiedTransport' },
      sameChipRetry: true,
    });
    expect(s.books.kind).toBe('stale');
    expect(staleChip(s)).toBe(true);
    if (s.books.kind === 'stale') {
      expect(s.books.rows).toEqual(spyRows);
    }
  });

  it('warm occupancy 500 exclusive standing — no digest, no coverage, no stale', () => {
    let s = unlockedWithSpyList();
    s = reduceArchive(s, {
      type: 'OPEN_START',
      identity: { symbol: 'SPY', et_date: '2024-06-03' },
    });
    s = reduceArchive(s, {
      type: 'LOAD_RESULT',
      arm: { kind: 'Ready', json: {} },
      digest,
      identity: { symbol: 'SPY', et_date: '2024-06-03' },
    });
    s = reduceArchive(s, {
      type: 'LIST_RESULT',
      arm: { kind: 'NotStoring', detail: 'session archive not storing' },
      sameChipRetry: true,
    });
    expect(s.standing.kind).toBe('not-storing');
    expect(s.books.kind).toBe('hidden');
    expect(s.coverage.kind).toBe('hidden');
    expect(s.digest.kind).toBe('hidden');
    expect(staleChip(s)).toBe(false);
  });

  it('chip-switch never keeps previous symbol rows via AC-30', () => {
    let s = unlockedWithSpyList();
    s = reduceArchive(s, { type: 'CHIP_SWITCH', symbol: 'QQQ' });
    expect(s.selected).toBe('QQQ');
    expect(s.books.kind).toBe('loading');
    expect(s.digest.kind).toBe('idle');
    s = reduceArchive(s, {
      type: 'LIST_RESULT',
      arm: { kind: 'UnclassifiedTransport' },
      sameChipRetry: false,
    });
    expect(s.books.kind).toBe('offline');
    expect(staleChip(s)).toBe(false);
    if (s.books.kind === 'offline') {
      // no SPY rows under QQQ
    }
  });

  it('chip-follow re-entry is not AC-30 restore', () => {
    let s = unlockedWithSpyList();
    s = reduceArchive(s, { type: 'CHIP_SWITCH', symbol: 'QQQ' });
    s = reduceArchive(s, {
      type: 'LIST_RESULT',
      arm: { kind: 'Ready', json: {} },
      rows: qqqRows,
    });
    s = reduceArchive(s, { type: 'CHIP_SWITCH', symbol: 'SPY' });
    expect(s.books.kind).toBe('loading');
    s = reduceArchive(s, {
      type: 'LIST_RESULT',
      arm: { kind: 'Unclassified5xx' },
      sameChipRetry: false,
    });
    expect(s.books.kind).toBe('offline');
    expect(staleChip(s)).toBe(false);
  });

  it('coverage unclassified always AC-38 — prior matrix not kept', () => {
    let s = unlockedWithSpyList();
    expect(s.coverage.kind).toBe('ready');
    s = reduceArchive(s, {
      type: 'COVERAGE_RESULT',
      arm: { kind: 'UnclassifiedTransport' },
    });
    expect(s.coverage.kind).toBe('unavailable');
    expect(s.coverageMemory).toBeNull();
    expect(s.books.kind).toBe('ready');
    expect(staleChip(s)).toBe(false);
  });

  it('load miss / unreadable / invariant are envelope-scoped digest arms', () => {
    let s = unlockedWithSpyList();
    s = reduceArchive(s, {
      type: 'LOAD_RESULT',
      arm: {
        kind: 'LoadMiss',
        detail: 'no session book for SPY on 2024-06-03',
      },
      identity: { symbol: 'SPY', et_date: '2024-06-03' },
    });
    expect(s.digest.kind).toBe('load-miss');

    s = unlockedWithSpyList();
    s = reduceArchive(s, {
      type: 'LOAD_RESULT',
      arm: { kind: 'Unreadable', detail: 'session book unreadable: x' },
      identity: { symbol: 'SPY', et_date: '2024-06-03' },
    });
    expect(s.digest.kind).toBe('unreadable');

    s = unlockedWithSpyList();
    s = reduceArchive(s, {
      type: 'LOAD_RESULT',
      arm: { kind: 'InvariantFault', envelope: 'load' },
      identity: { symbol: 'SPY', et_date: '2024-06-03' },
    });
    expect(s.digest.kind).toBe('invariant-fault');
  });

  it('AC-29: unreadable clears digestMemory but DIGEST_RETRY retains load identity', () => {
    let s = unlockedWithSpyList();
    s = reduceArchive(s, {
      type: 'LOAD_RESULT',
      arm: { kind: 'Ready', json: {} },
      digest,
      identity: { symbol: 'SPY', et_date: '2024-06-03' },
    });
    expect(s.digestMemory).toEqual(digest);

    s = reduceArchive(s, {
      type: 'LOAD_RESULT',
      arm: { kind: 'Unreadable', detail: 'session book unreadable: x' },
      identity: { symbol: 'SPY', et_date: '2024-06-03' },
    });
    expect(s.digest.kind).toBe('unreadable');
    expect(s.digestMemory).toBeNull();
    if (s.digest.kind === 'unreadable') {
      expect(s.digest.identity).toEqual({ symbol: 'SPY', et_date: '2024-06-03' });
    }

    s = reduceArchive(s, { type: 'DIGEST_RETRY' });
    expect(s.digest).toEqual({
      kind: 'loading',
      identity: { symbol: 'SPY', et_date: '2024-06-03' },
    });

    s = reduceArchive(s, {
      type: 'LOAD_RESULT',
      arm: { kind: 'Unreadable', detail: 'session book unreadable: x' },
      identity: { symbol: 'SPY', et_date: '2024-06-03' },
    });
    expect(s.digest.kind).toBe('unreadable');
    expect(s.digestMemory).toBeNull();
    expect(staleChip(s)).toBe(false);
  });

  it('AC-46: load invariant-fault DIGEST_RETRY retains load identity', () => {
    let s = unlockedWithSpyList();
    s = reduceArchive(s, {
      type: 'LOAD_RESULT',
      arm: { kind: 'InvariantFault', envelope: 'load' },
      identity: { symbol: 'QQQ', et_date: '2026-08-30' },
    });
    expect(s.digest.kind).toBe('invariant-fault');
    expect(s.digestMemory).toBeNull();
    if (s.digest.kind === 'invariant-fault') {
      expect(s.digest.identity).toEqual({ symbol: 'QQQ', et_date: '2026-08-30' });
    }

    s = reduceArchive(s, { type: 'DIGEST_RETRY' });
    expect(s.digest).toEqual({
      kind: 'loading',
      identity: { symbol: 'QQQ', et_date: '2026-08-30' },
    });
  });

  it('warm same-identity unclassified load = silent keep-last, no stale chip', () => {
    let s = unlockedWithSpyList();
    s = reduceArchive(s, {
      type: 'LOAD_RESULT',
      arm: { kind: 'Ready', json: {} },
      digest,
      identity: { symbol: 'SPY', et_date: '2024-06-03' },
    });
    s = reduceArchive(s, {
      type: 'LOAD_RESULT',
      arm: { kind: 'UnclassifiedTransport' },
      identity: { symbol: 'SPY', et_date: '2024-06-03' },
    });
    expect(s.digest.kind).toBe('ready');
    if (s.digest.kind === 'ready') expect(s.digest.digest).toEqual(digest);
    expect(staleChip(s)).toBe(false);
  });

  it('cold unclassified load → digest idle with no invented copy', () => {
    let s = unlockedWithSpyList();
    s = reduceArchive(s, {
      type: 'OPEN_START',
      identity: { symbol: 'SPY', et_date: '2024-06-03' },
    });
    s = reduceArchive(s, {
      type: 'LOAD_RESULT',
      arm: { kind: 'UnclassifiedTransport' },
      identity: { symbol: 'SPY', et_date: '2024-06-03' },
    });
    expect(s.digest.kind).toBe('idle');
    expect(staleChip(s)).toBe(false);
  });

  it('list store-error exclusive standing', () => {
    let s = unlockedWithSpyList();
    s = reduceArchive(s, {
      type: 'LIST_RESULT',
      arm: {
        kind: 'ListStoreError',
        detail: 'session archive store error: disk',
      },
      sameChipRetry: true,
    });
    expect(s.standing.kind).toBe('list-store-error');
    expect(s.books.kind).toBe('hidden');
    expect(s.coverage.kind).toBe('hidden');
    expect(s.digest.kind).toBe('hidden');
    expect(staleChip(s)).toBe(false);
  });

  it('coverage withheld ≠ unavailable; not three missing', () => {
    let s = unlockedWithSpyList();
    s = reduceArchive(s, {
      type: 'COVERAGE_RESULT',
      arm: { kind: 'NotStoring', detail: 'session archive not storing' },
    });
    expect(s.coverage.kind).toBe('withheld');
    expect(s.books.kind).toBe('ready');
    expect(staleChip(s)).toBe(false);
  });

  it('present-click chip-follow hides previous rows; list occupancy hides load', () => {
    let s = unlockedWithSpyList();
    s = reduceArchive(s, {
      type: 'PRESENT_CLICK',
      identity: { symbol: 'QQQ', et_date: '2024-06-04' },
    });
    expect(s.selected).toBe('QQQ');
    expect(s.books.kind).toBe('loading');
    expect(s.digest.kind).toBe('loading');
    // list occupancy wins exclusive standing over concurrent load success
    s = reduceArchive(s, {
      type: 'LOAD_RESULT',
      arm: { kind: 'Ready', json: {} },
      digest: { ...digest, symbol: 'QQQ', et_date: '2024-06-04' },
      identity: { symbol: 'QQQ', et_date: '2024-06-04' },
    });
    s = reduceArchive(s, {
      type: 'LIST_RESULT',
      arm: { kind: 'NotStoring', detail: 'session archive not storing' },
    });
    expect(s.standing.kind).toBe('not-storing');
    expect(s.digest.kind).toBe('hidden');
  });

  it('default selected is SPY', () => {
    expect(initialArchiveState().selected).toBe('SPY');
  });
});
