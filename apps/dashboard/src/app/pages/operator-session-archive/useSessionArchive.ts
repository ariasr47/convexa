import { useCallback, useReducer, useRef } from 'react';
import { classifyResearchOutcome, type ClassifiedArm } from './classify';
import { projectDigest } from './digest';
import {
  COVERAGE_TAIL,
  fetchResearch,
  listTail,
  loadTail,
} from './researchClient';
import {
  chipTapGets,
  digestRetryGets,
  pageRetryGets,
  presentClickGets,
  unlockGets,
  type TrioSymbol,
} from './schedule';
import { documentHostIsPages, parseSittingResearchBase } from './sittingBase';
import {
  initialArchiveState,
  reduceArchive,
  staleChip,
  type ArchiveState,
  type BookRow,
  type CoverageMatrix,
} from './viewModel';

export type SessionArchiveApi = {
  state: ArchiveState;
  stale: boolean;
  originDraft: string;
  tokenDraft: string;
  setOriginDraft: (v: string) => void;
  setTokenDraft: (v: string) => void;
  documentIsPages: boolean;
  unlock: () => void;
  pageRetry: () => void;
  digestRetry: () => void;
  selectChip: (symbol: TrioSymbol) => void;
  openBook: (identity: { symbol: string; et_date: string }) => void;
  presentClick: (identity: { symbol: string; et_date: string }) => void;
  reopenGate: () => void;
};

export type UseSessionArchiveOptions = {
  /** Injected CORS classifier (test double). Default: never classify. */
  corsSignal?: (err: unknown) => boolean;
  /** Override fetch for tests. */
  fetchImpl?: typeof fetchResearch;
  /** Override document host for Pages helper. */
  documentHost?: string;
};

function rowsFromListJson(json: Record<string, unknown>): BookRow[] {
  const books = Array.isArray(json.books) ? json.books : [];
  return books
    .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
    .map((b) => ({
      symbol: String(b.symbol ?? ''),
      et_date: String(b.et_date ?? ''),
      source: String(b.source ?? ''),
      source_as_of: String(b.source_as_of ?? ''),
    }));
}

function matrixFromJson(json: Record<string, unknown>): CoverageMatrix {
  const rowsRaw = Array.isArray(json.rows) ? json.rows : [];
  const holesRaw = Array.isArray(json.holes) ? json.holes : [];
  return {
    framing: String(json.framing ?? ''),
    command: String(json.command ?? ''),
    evidence: String(json.evidence ?? ''),
    symbols: Array.isArray(json.symbols) ? json.symbols.map(String) : [],
    et_date: String(json.et_date ?? ''),
    checkpoint: String(json.checkpoint ?? ''),
    verdict: String(json.verdict ?? ''),
    expected_due: Number(json.expected_due ?? 0),
    present: Number(json.present ?? 0),
    missing: Number(json.missing ?? 0),
    unreadable: Number(json.unreadable ?? 0),
    not_yet_due: Number(json.not_yet_due ?? 0),
    blocked_occupancy: Number(json.blocked_occupancy ?? 0),
    rows: rowsRaw
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
      .map((r) => ({
        symbol: String(r.symbol ?? ''),
        et_date: String(r.et_date ?? ''),
        cell: String(r.cell ?? ''),
        last_readable: String(r.last_readable ?? ''),
      })),
    holes: holesRaw
      .filter((h): h is Record<string, unknown> => !!h && typeof h === 'object')
      .map((h) => ({
        symbol: String(h.symbol ?? ''),
        et_date: String(h.et_date ?? ''),
        class: String(h.class ?? ''),
      })),
    provenance: typeof json.provenance === 'string' ? json.provenance : undefined,
    license: typeof json.license === 'string' ? json.license : undefined,
    authorizes: typeof json.authorizes === 'string' ? json.authorizes : undefined,
  };
}

export function useSessionArchive(opts: UseSessionArchiveOptions = {}): SessionArchiveApi {
  const [state, dispatch] = useReducer(reduceArchive, undefined, initialArchiveState);
  const originRef = useRef('');
  const tokenRef = useRef('');
  const [originDraft, setOriginDraftState] = useReducer(
    (_: string, v: string) => v,
    '',
  );
  const [tokenDraft, setTokenDraftState] = useReducer((_: string, v: string) => v, '');

  const committedBase = useRef<string | null>(null);
  const committedToken = useRef('');
  const booksShowingRef = useRef(false);

  const corsSignal = opts.corsSignal ?? (() => false);
  const doFetch = opts.fetchImpl ?? fetchResearch;
  const documentIsPages = documentHostIsPages(
    opts.documentHost ?? (typeof window !== 'undefined' ? window.location.host : ''),
  );

  const setOriginDraft = useCallback((v: string) => {
    setOriginDraftState(v);
    originRef.current = v;
  }, []);
  const setTokenDraft = useCallback((v: string) => {
    setTokenDraftState(v);
    tokenRef.current = v;
  }, []);

  const runGets = useCallback(
    async (
      gets: ReturnType<typeof pageRetryGets>,
      meta: { sameChipRetry?: boolean } = {},
    ) => {
      const base = committedBase.current;
      if (!base) return;
      const token = committedToken.current;

      await Promise.all(
        gets.map(async (g) => {
          try {
            if (g.kind === 'list') {
              const res = await doFetch({ base, tail: listTail(g.symbol), token });
              const arm = classifyResearchOutcome({
                status: res.status,
                json: res.json,
                bodyText: res.bodyText,
                envelope: 'list',
              });
              dispatch({
                type: 'LIST_RESULT',
                arm,
                rows: arm.kind === 'Ready' && res.json ? rowsFromListJson(res.json) : undefined,
                framing:
                  arm.kind === 'Ready' && typeof res.json?.framing === 'string'
                    ? res.json.framing
                    : undefined,
                authorizes:
                  arm.kind === 'Ready' && typeof res.json?.authorizes === 'string'
                    ? res.json.authorizes
                    : undefined,
                sameChipRetry: meta.sameChipRetry,
              });
              booksShowingRef.current =
                arm.kind === 'Ready' || arm.kind === 'EmptyList';
            } else if (g.kind === 'coverage') {
              const res = await doFetch({ base, tail: COVERAGE_TAIL, token });
              const arm = classifyResearchOutcome({
                status: res.status,
                json: res.json,
                bodyText: res.bodyText,
                envelope: 'coverage',
              });
              dispatch({
                type: 'COVERAGE_RESULT',
                arm,
                matrix:
                  arm.kind === 'Ready' && res.json ? matrixFromJson(res.json) : undefined,
              });
            } else if (g.kind === 'load') {
              try {
                const res = await doFetch({
                  base,
                  tail: loadTail(g.symbol, g.et_date),
                  token,
                  abortPreviousLoad: true,
                });
                const arm = classifyResearchOutcome({
                  status: res.status,
                  json: res.json,
                  bodyText: res.bodyText,
                  envelope: 'load',
                });
                dispatch({
                  type: 'LOAD_RESULT',
                  arm,
                  digest:
                    arm.kind === 'Ready' && res.json
                      ? projectDigest(
                          res.json as Parameters<typeof projectDigest>[0],
                        )
                      : undefined,
                  identity: { symbol: g.symbol, et_date: g.et_date },
                });
              } catch (err) {
                if (
                  err &&
                  typeof err === 'object' &&
                  'name' in err &&
                  (err as { name?: string }).name === 'AbortError'
                ) {
                  dispatch({
                    type: 'LOAD_RESULT',
                    arm: { kind: 'Aborted' },
                    identity: { symbol: g.symbol, et_date: g.et_date },
                  });
                  return;
                }
                const arm: ClassifiedArm = classifyResearchOutcome({
                  transportError: err,
                  corsClassified: corsSignal(err),
                  envelope: 'load',
                });
                dispatch({
                  type: 'LOAD_RESULT',
                  arm,
                  identity: { symbol: g.symbol, et_date: g.et_date },
                });
              }
            }
          } catch (err) {
            if (
              err &&
              typeof err === 'object' &&
              'name' in err &&
              (err as { name?: string }).name === 'AbortError'
            ) {
              return;
            }
            const envelope =
              g.kind === 'list' ? 'list' : g.kind === 'coverage' ? 'coverage' : 'load';
            const arm = classifyResearchOutcome({
              transportError: err,
              corsClassified: corsSignal(err),
              envelope,
            });
            if (g.kind === 'list') {
              dispatch({
                type: 'LIST_RESULT',
                arm,
                sameChipRetry: meta.sameChipRetry,
              });
            } else if (g.kind === 'coverage') {
              dispatch({ type: 'COVERAGE_RESULT', arm });
            } else {
              dispatch({
                type: 'LOAD_RESULT',
                arm,
                identity: { symbol: g.symbol, et_date: g.et_date },
              });
            }
          }
        }),
      );
    },
    [corsSignal, doFetch],
  );

  const unlock = useCallback(() => {
    const parsed = parseSittingResearchBase(originRef.current);
    if (parsed.kind !== 'usable') {
      const reason =
        parsed.kind === 'OriginEmpty'
          ? 'empty'
          : parsed.kind === 'OriginPagesHost'
            ? 'pages'
            : 'unusable';
      dispatch({ type: 'ORIGIN_REJECTED', reason });
      return;
    }
    committedBase.current = parsed.base;
    committedToken.current = tokenRef.current;
    booksShowingRef.current = false;
    dispatch({ type: 'UNLOCK_START' });
    void runGets(unlockGets('SPY'));
  }, [runGets]);

  const pageRetry = useCallback(() => {
    const showing =
      state.books.kind === 'ready' || state.books.kind === 'stale';
    dispatch({ type: 'PAGE_RETRY' });
    void runGets(pageRetryGets(state.selected), { sameChipRetry: showing });
  }, [runGets, state.books.kind, state.selected]);

  const digestRetry = useCallback(() => {
    if (state.digest.kind !== 'unreadable' && state.digest.kind !== 'invariant-fault') {
      return;
    }
    const id = state.digest.identity;
    dispatch({ type: 'DIGEST_RETRY' });
    void runGets(digestRetryGets(id));
  }, [runGets, state.digest]);

  const selectChip = useCallback(
    (symbol: TrioSymbol) => {
      booksShowingRef.current = false;
      dispatch({ type: 'CHIP_SWITCH', symbol });
      void runGets(chipTapGets(symbol), { sameChipRetry: false });
    },
    [runGets],
  );

  const openBook = useCallback(
    (identity: { symbol: string; et_date: string }) => {
      dispatch({ type: 'OPEN_START', identity });
      void runGets([{ kind: 'load', symbol: identity.symbol, et_date: identity.et_date }]);
    },
    [runGets],
  );

  const presentClick = useCallback(
    (identity: { symbol: string; et_date: string }) => {
      const gets = presentClickGets(state.selected, identity);
      booksShowingRef.current = false;
      dispatch({ type: 'PRESENT_CLICK', identity });
      void runGets(gets, { sameChipRetry: false });
    },
    [runGets, state.selected],
  );

  const reopenGate = useCallback(() => {
    dispatch({ type: 'REOPEN_GATE' });
  }, []);

  return {
    state,
    stale: staleChip(state),
    originDraft,
    tokenDraft,
    setOriginDraft,
    setTokenDraft,
    documentIsPages,
    unlock,
    pageRetry,
    digestRetry,
    selectChip,
    openBook,
    presentClick,
    reopenGate,
  };
}
