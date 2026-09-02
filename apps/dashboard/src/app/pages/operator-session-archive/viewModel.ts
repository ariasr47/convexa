import type { ClassifiedArm } from './classify';
import type { DigestProjection } from './digest';
import type { TrioSymbol } from './schedule';
import { TRIO } from './schedule';

export type BookRow = {
  symbol: string;
  et_date: string;
  source: string;
  source_as_of: string;
};

export type CoverageRow = {
  symbol: string;
  et_date: string;
  cell: string;
  last_readable: string;
};

export type CoverageMatrix = {
  framing: string;
  command: string;
  evidence: string;
  symbols: string[];
  et_date: string;
  checkpoint: string;
  verdict: string;
  expected_due: number;
  present: number;
  missing: number;
  unreadable: number;
  not_yet_due: number;
  blocked_occupancy: number;
  rows: CoverageRow[];
  holes: Array<{ symbol: string; et_date: string; class: string }>;
  provenance?: string;
  license?: string;
  authorizes?: string;
};

export type BooksRegion =
  | { kind: 'hidden' }
  | { kind: 'loading' }
  | { kind: 'ready'; rows: BookRow[]; framing?: string; authorizes?: string }
  | { kind: 'empty'; detail?: string; framing?: string }
  | { kind: 'offline' }
  | { kind: 'stale'; rows: BookRow[]; framing?: string; authorizes?: string };

export type CoverageRegion =
  | { kind: 'hidden' }
  | { kind: 'loading' }
  | { kind: 'ready'; matrix: CoverageMatrix }
  | { kind: 'unavailable' }
  | { kind: 'withheld'; detail?: string; error: 'not-storing' | 'store-error' }
  | { kind: 'invariant-fault' };

export type DigestRegion =
  | { kind: 'idle' }
  | { kind: 'hidden' }
  | { kind: 'loading'; identity: { symbol: string; et_date: string } }
  | { kind: 'ready'; digest: DigestProjection }
  | { kind: 'load-miss'; detail?: string }
  /** identity retained for digest-region Retry (AC-29 / AC-46); success digestMemory stays null */
  | { kind: 'unreadable'; detail?: string; identity: { symbol: string; et_date: string } }
  | { kind: 'unparseable'; detail?: string }
  | { kind: 'invariant-fault'; identity: { symbol: string; et_date: string } };

export type PageStanding =
  | { kind: 'locked' }
  | { kind: 'origin-rejected'; reason: 'empty' | 'pages' | 'unusable' }
  | { kind: 'origin-blocked' }
  | { kind: 'unauthorized'; detail?: string }
  | { kind: 'cors-fault' }
  | { kind: 'not-storing'; detail?: string }
  | { kind: 'list-store-error'; detail?: string }
  | { kind: 'list-invariant-fault' }
  | { kind: 'open' };

export type ArchiveState = {
  selected: TrioSymbol;
  standing: PageStanding;
  books: BooksRegion;
  coverage: CoverageRegion;
  digest: DigestRegion;
  /** Last successful list rows by symbol (warm-by-key memory; not always showing). */
  listMemory: Partial<Record<TrioSymbol, BookRow[]>>;
  coverageMemory: CoverageMatrix | null;
  digestMemory: DigestProjection | null;
  gateCollapsed: boolean;
};

export function initialArchiveState(): ArchiveState {
  return {
    selected: 'SPY',
    standing: { kind: 'locked' },
    books: { kind: 'hidden' },
    coverage: { kind: 'hidden' },
    digest: { kind: 'idle' },
    listMemory: {},
    coverageMemory: null,
    digestMemory: null,
    gateCollapsed: false,
  };
}

export function staleChip(state: ArchiveState): boolean {
  return state.books.kind === 'stale';
}

export type ArchiveEvent =
  | { type: 'ORIGIN_REJECTED'; reason: 'empty' | 'pages' | 'unusable' }
  | { type: 'UNLOCK_START'; selected?: TrioSymbol }
  | { type: 'CHIP_SWITCH'; symbol: TrioSymbol }
  | { type: 'PAGE_RETRY' }
  | { type: 'DIGEST_RETRY' }
  | { type: 'OPEN_START'; identity: { symbol: string; et_date: string } }
  | { type: 'PRESENT_CLICK'; identity: { symbol: string; et_date: string } }
  | {
      type: 'LIST_RESULT';
      arm: ClassifiedArm;
      rows?: BookRow[];
      framing?: string;
      authorizes?: string;
      /** Same-chip Retry while rows still showing. */
      sameChipRetry?: boolean;
    }
  | {
      type: 'COVERAGE_RESULT';
      arm: ClassifiedArm;
      matrix?: CoverageMatrix;
    }
  | {
      type: 'LOAD_RESULT';
      arm: ClassifiedArm;
      digest?: DigestProjection;
      identity: { symbol: string; et_date: string };
    }
  | { type: 'REOPEN_GATE' };

function hideCorpus(state: ArchiveState): ArchiveState {
  return {
    ...state,
    books: { kind: 'hidden' },
    coverage: { kind: 'hidden' },
    digest: { kind: 'hidden' },
  };
}

function isTrio(symbol: string): symbol is TrioSymbol {
  return (TRIO as readonly string[]).includes(symbol);
}

/** List occupancy 500 → exclusive standing (no books, no coverage success, no digest). */
function listOccupancyExclusive(
  state: ArchiveState,
  standing: Extract<PageStanding, { kind: 'not-storing' | 'list-store-error' }>,
): ArchiveState {
  return {
    ...state,
    standing,
    books: { kind: 'hidden' },
    coverage: { kind: 'hidden' },
    digest: { kind: 'hidden' },
    gateCollapsed: false,
  };
}

export function reduceArchive(state: ArchiveState, event: ArchiveEvent): ArchiveState {
  switch (event.type) {
    case 'ORIGIN_REJECTED':
      return {
        ...initialArchiveState(),
        standing: { kind: 'origin-rejected', reason: event.reason },
      };

    case 'UNLOCK_START': {
      const selected = event.selected ?? state.selected;
      return {
        ...state,
        selected,
        standing: { kind: 'open' },
        books: { kind: 'loading' },
        coverage: { kind: 'loading' },
        digest: { kind: 'idle' },
        gateCollapsed: false,
      };
    }

    case 'CHIP_SWITCH': {
      // Immediately hide previous symbol rows + digest; never AC-30.
      return {
        ...state,
        selected: event.symbol,
        standing:
          state.standing.kind === 'not-storing' || state.standing.kind === 'list-store-error'
            ? { kind: 'open' }
            : state.standing.kind === 'cors-fault' ||
                state.standing.kind === 'origin-blocked' ||
                state.standing.kind === 'unauthorized'
              ? state.standing
              : { kind: 'open' },
        books: { kind: 'loading' },
        digest: { kind: 'idle' },
        // coverage stays if already ready
      };
    }

    case 'PAGE_RETRY': {
      if (
        state.standing.kind === 'cors-fault' ||
        state.standing.kind === 'not-storing' ||
        state.standing.kind === 'list-store-error' ||
        state.standing.kind === 'list-invariant-fault'
      ) {
        return {
          ...state,
          standing: { kind: 'open' },
          books: { kind: 'loading' },
          coverage: { kind: 'loading' },
          digest: { kind: 'idle' },
        };
      }
      // Same-chip stale keeps showing rows while retry flies; coverage always reloads (AC-38).
      const keepBooks =
        state.books.kind === 'ready' || state.books.kind === 'stale'
          ? state.books
          : ({ kind: 'loading' } as BooksRegion);
      return {
        ...state,
        standing: { kind: 'open' },
        books: keepBooks,
        coverage: { kind: 'loading' },
      };
    }

    case 'DIGEST_RETRY': {
      if (state.digest.kind === 'unreadable' || state.digest.kind === 'invariant-fault') {
        return {
          ...state,
          digest: { kind: 'loading', identity: state.digest.identity },
        };
      }
      return state;
    }

    case 'OPEN_START':
      return {
        ...state,
        digest: { kind: 'loading', identity: event.identity },
      };

    case 'PRESENT_CLICK': {
      const follow = event.identity.symbol !== state.selected;
      const nextSelected = isTrio(event.identity.symbol) ? event.identity.symbol : state.selected;
      return {
        ...state,
        selected: follow ? nextSelected : state.selected,
        books: follow ? { kind: 'loading' } : state.books,
        digest: { kind: 'loading', identity: event.identity },
        standing: { kind: 'open' },
      };
    }

    case 'REOPEN_GATE':
      return { ...state, gateCollapsed: false };

    case 'LIST_RESULT':
      return reduceListResult(state, event);

    case 'COVERAGE_RESULT':
      return reduceCoverageResult(state, event);

    case 'LOAD_RESULT':
      return reduceLoadResult(state, event);

    default:
      return state;
  }
}

function reduceListResult(
  state: ArchiveState,
  event: Extract<ArchiveEvent, { type: 'LIST_RESULT' }>,
): ArchiveState {
  const arm = event.arm;

  if (arm.kind === 'OriginCors') {
    return { ...hideCorpus(state), standing: { kind: 'cors-fault' }, gateCollapsed: true };
  }
  if (arm.kind === 'Unauthorized') {
    return {
      ...hideCorpus(state),
      standing: { kind: 'unauthorized', detail: arm.detail },
      gateCollapsed: false,
    };
  }
  if (arm.kind === 'OriginPages404' || arm.kind === 'OriginRelative404') {
    return {
      ...hideCorpus(state),
      standing: { kind: 'origin-blocked' },
      gateCollapsed: false,
    };
  }
  if (arm.kind === 'NotStoring') {
    return listOccupancyExclusive(state, {
      kind: 'not-storing',
      detail: arm.detail,
    });
  }
  if (arm.kind === 'ListStoreError') {
    return listOccupancyExclusive(state, {
      kind: 'list-store-error',
      detail: arm.detail,
    });
  }
  if (arm.kind === 'InvariantFault') {
    return {
      ...state,
      standing: { kind: 'list-invariant-fault' },
      books: { kind: 'hidden' },
      digest: { kind: 'hidden' },
      // coverage may remain if legal — nested only when coverage itself faults
    };
  }
  if (arm.kind === 'EmptyList') {
    return {
      ...state,
      standing: { kind: 'open' },
      books: { kind: 'empty', detail: arm.detail, framing: arm.framing },
      listMemory: { ...state.listMemory, [state.selected]: [] },
      gateCollapsed: true,
    };
  }
  if (arm.kind === 'Ready') {
    const rows = event.rows ?? [];
    return {
      ...state,
      standing: { kind: 'open' },
      books: {
        kind: 'ready',
        rows,
        framing: event.framing,
        authorizes: event.authorizes,
      },
      listMemory: { ...state.listMemory, [state.selected]: rows },
      gateCollapsed: true,
    };
  }

  // Unclassified transport / 5xx
  if (arm.kind === 'UnclassifiedTransport' || arm.kind === 'Unclassified5xx') {
    const showing =
      state.books.kind === 'ready' || state.books.kind === 'stale' ? state.books.rows : null;
    if (event.sameChipRetry && showing) {
      return {
        ...state,
        standing: { kind: 'open' },
        books: {
          kind: 'stale',
          rows: showing,
          framing:
            state.books.kind === 'ready' || state.books.kind === 'stale'
              ? state.books.framing
              : undefined,
          authorizes:
            state.books.kind === 'ready' || state.books.kind === 'stale'
              ? state.books.authorizes
              : undefined,
        },
      };
    }
    // Chip-switch / cold / no showing rows → offline (never restore hidden list via AC-30)
    return {
      ...state,
      standing: { kind: 'open' },
      books: { kind: 'offline' },
    };
  }

  return state;
}

function reduceCoverageResult(
  state: ArchiveState,
  event: Extract<ArchiveEvent, { type: 'COVERAGE_RESULT' }>,
): ArchiveState {
  // Page-level list occupancy exclusive — ignore concurrent coverage success.
  if (
    state.standing.kind === 'not-storing' ||
    state.standing.kind === 'list-store-error' ||
    state.standing.kind === 'cors-fault' ||
    state.standing.kind === 'origin-blocked' ||
    state.standing.kind === 'unauthorized'
  ) {
    return state;
  }

  const arm = event.arm;

  if (arm.kind === 'OriginCors') {
    return { ...hideCorpus(state), standing: { kind: 'cors-fault' } };
  }
  if (arm.kind === 'Unauthorized') {
    return {
      ...hideCorpus(state),
      standing: { kind: 'unauthorized', detail: arm.detail },
    };
  }
  if (arm.kind === 'OriginPages404' || arm.kind === 'OriginRelative404') {
    return { ...hideCorpus(state), standing: { kind: 'origin-blocked' } };
  }
  if (arm.kind === 'NotStoring') {
    return {
      ...state,
      coverage: { kind: 'withheld', error: 'not-storing', detail: arm.detail },
      coverageMemory: null,
    };
  }
  if (arm.kind === 'ListStoreError') {
    return {
      ...state,
      coverage: { kind: 'withheld', error: 'store-error', detail: arm.detail },
      coverageMemory: null,
    };
  }
  if (arm.kind === 'InvariantFault') {
    return {
      ...state,
      coverage: { kind: 'invariant-fault' },
      coverageMemory: null,
    };
  }
  if (arm.kind === 'Ready' && event.matrix) {
    return {
      ...state,
      coverage: { kind: 'ready', matrix: event.matrix },
      coverageMemory: event.matrix,
      gateCollapsed: true,
    };
  }
  if (arm.kind === 'UnclassifiedTransport' || arm.kind === 'Unclassified5xx') {
    // AC-38 always — prior matrix not kept; never stale chip for coverage
    return {
      ...state,
      coverage: { kind: 'unavailable' },
      coverageMemory: null,
    };
  }
  return state;
}

function reduceLoadResult(
  state: ArchiveState,
  event: Extract<ArchiveEvent, { type: 'LOAD_RESULT' }>,
): ArchiveState {
  // List-occupancy exclusive standing hides concurrent load outcomes.
  if (
    state.standing.kind === 'not-storing' ||
    state.standing.kind === 'list-store-error' ||
    state.standing.kind === 'cors-fault' ||
    state.standing.kind === 'origin-blocked' ||
    state.standing.kind === 'unauthorized'
  ) {
    return { ...state, digest: { kind: 'hidden' } };
  }

  const arm = event.arm;

  if (arm.kind === 'Aborted') {
    return state;
  }
  if (arm.kind === 'OriginCors') {
    return { ...hideCorpus(state), standing: { kind: 'cors-fault' } };
  }
  if (arm.kind === 'LoadMiss') {
    return {
      ...state,
      digest: { kind: 'load-miss', detail: arm.detail },
      digestMemory: null,
    };
  }
  if (arm.kind === 'Unreadable') {
    return {
      ...state,
      digest: {
        kind: 'unreadable',
        detail: arm.detail,
        identity: event.identity,
      },
      digestMemory: null,
    };
  }
  if (arm.kind === 'UnparseableDate') {
    return {
      ...state,
      digest: { kind: 'unparseable', detail: arm.detail },
      digestMemory: null,
    };
  }
  if (arm.kind === 'InvariantFault') {
    return {
      ...state,
      digest: { kind: 'invariant-fault', identity: event.identity },
      digestMemory: null,
    };
  }
  if (arm.kind === 'NotStoring') {
    return {
      ...state,
      digest: { kind: 'hidden' },
      standing: { kind: 'not-storing', detail: arm.detail },
      books: { kind: 'hidden' },
      coverage: { kind: 'hidden' },
      digestMemory: null,
    };
  }
  if (arm.kind === 'Ready' && event.digest) {
    return {
      ...state,
      digest: { kind: 'ready', digest: event.digest },
      digestMemory: event.digest,
    };
  }
  if (arm.kind === 'UnclassifiedTransport' || arm.kind === 'Unclassified5xx') {
    // Warm same-identity: silent keep-last, no stale chip.
    if (
      state.digestMemory &&
      state.digestMemory.symbol === event.identity.symbol &&
      state.digestMemory.et_date === event.identity.et_date
    ) {
      return {
        ...state,
        digest: { kind: 'ready', digest: state.digestMemory },
      };
    }
    // Cold first-open: idle/empty after in-flight — no invented copy.
    return { ...state, digest: { kind: 'idle' } };
  }
  return state;
}
