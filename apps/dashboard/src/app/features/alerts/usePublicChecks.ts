/**
 * Checks the public-data alerts in this browser, when the Alerts page opens (and again when a rule is
 * added): one read of each source the enabled rules need, then `publicRules.ts` decides what fires.
 *
 * What this is not: a server-side schedule. Nothing checks a rule while no Alerts page is open, and the
 * page says so (owner ruling, 2026-10-15, answer 5). The demo never checks: its firings are part of the
 * Oct 7 scenario (the seed).
 *
 * Sources: `/api/public-data/filings` (SEC EDGAR filings and results windows, and whether SEC access
 * is set up at all; tickers in chunks of 30, the route's limit), `/api/public-data/markets` (CFTC),
 * `/api/public-data/tickers/{t}` (Form 4 insider clusters; FINRA short interest only while FINRA's
 * production switch is on), and the research notes compiled into the build (`virtual:convexa-research`).
 */
import { filedSince } from '@/pages/research/filings';
import { STAGING_DEMO_SYMBOLS } from '@/shared/lib/demoSite';
import {
  dataMode,
  getPublicFilings,
  getPublicMarkets,
  getPublicTicker,
  type PublicDataState,
  type PublicFilings,
  type PublicFutures,
  type PublicMarkets,
  type PublicSourceState,
  type PublicTicker,
} from '@convexa/api';
import { useEffect, useState } from 'react';
import { freshness, localToday, researchIndex } from 'virtual:convexa-research';
import { FINRA_OFF_REASON, FINRA_ON_PRODUCTION, isPublicKind } from './kinds';
import {
  applyCheck,
  checkCluster,
  checkFiling,
  checkNoteDue,
  checkPositioning,
  checkResults,
  checkShortInterest,
  filingsGap,
  type CheckResult,
  type NoteFiling,
  type ResultsCadence,
} from './publicRules';
import { readAlerts, recordChecks } from './store';
import type { AlertEvent, AlertRule } from './types';
import { deliverBrowser, shouldNotify } from './useAlerts';

export interface PublicChecks {
  /** `demo`: the demo never checks. */
  phase: 'demo' | 'idle' | 'checking' | 'done';
  /** SEC EDGAR's state on this site; null until known, or when the read failed. */
  sec: PublicDataState | null;
  /** Whether the SEC read itself failed (unknown, not "not set up"). */
  secFailed: boolean;
  /** When the last check finished (epoch ms): the Fired tag shows this, not the render time. */
  checkedAt: number | null;
  /** How many reads the last check made, and how many of them failed. */
  reads: number;
  failed: number;
}

/** Tickers with a research note: "followed", for the filing and insider kinds. The demo's notes
 *  are its six sample names, not production's research index. */
export function followedTickers(): Set<string> {
  if (dataMode === 'demo') return new Set<string>(STAGING_DEMO_SYMBOLS);
  return new Set(researchIndex.map((t) => t.ticker.toUpperCase()));
}

/** The route takes at most 30 tickers; more are asked for in further reads, never dropped. */
export const FILINGS_CHUNK = 30;

const settled = <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

const SOURCE_RANK: Record<PublicSourceState, number> = {
  updated: 0,
  delayed: 1,
  last_good: 2,
  source_down: 3,
  not_set_up: 4,
  off: 5,
};

/**
 * One answer from several chunked filings reads. `asked` holds the tickers whose read answered live;
 * a ticker in a chunk that failed is left out, so its rule reads unavailable rather than quiet. The
 * SEC row takes the worst state any chunk reported.
 */
export function mergeFilings(
  chunks: string[][],
  answers: (PublicFilings | null)[],
): { filings: PublicFilings | null; asked: Set<string> } {
  const asked = new Set<string>();
  const got = answers.flatMap((a, i) => (a ? [{ a, tickers: chunks[i] ?? [] }] : []));
  if (!got.length) return { filings: null, asked };
  const first = got[0].a;
  if (first.state === 'not_configured' || first.state === 'off') return { filings: first, asked };
  const live = got.filter((g) => g.a.state === 'live');
  for (const g of live) for (const t of g.tickers) asked.add(t);
  const rows = got.flatMap((g) => g.a.sources ?? []).filter((r) => r.id === 'sec');
  const worst = rows.reduce<(typeof rows)[number] | null>(
    (w, r) =>
      !w || (SOURCE_RANK[r.state as PublicSourceState] ?? 9) > (SOURCE_RANK[w.state] ?? 9) ? r : w,
    null,
  );
  const partial = got.length < answers.length;
  const checked = got
    .map((g) => g.a.checked_at)
    .filter((c): c is string => !!c)
    .sort()[0];
  return {
    filings: {
      state: live.length ? 'live' : 'unavailable',
      detail: got.map((g) => g.a.detail).find(Boolean) ?? null,
      checked_at: checked ?? null,
      filings: got.flatMap((g) => g.a.filings),
      missing: got.flatMap((g) => g.a.missing ?? []),
      results: got.some((g) => Array.isArray(g.a.results))
        ? got.flatMap((g) => g.a.results ?? [])
        : undefined,
      sources: worst
        ? [{ ...worst, state: partial && worst.state === 'updated' ? 'last_good' : worst.state }]
        : undefined,
    },
    asked,
  };
}

export function usePublicChecks(rules: AlertRule[]): PublicChecks {
  const demo = dataMode === 'demo';
  const [state, setState] = useState<PublicChecks>({
    phase: demo ? 'demo' : 'idle',
    sec: null,
    secFailed: false,
    checkedAt: null,
    reads: 0,
    failed: 0,
  });
  const enabled = rules.filter((r) => r.enabled && isPublicKind(r.kind));
  // Re-check when the set of enabled rules changes (a new rule checks at once); a check's own write
  // changes only the rules' memory, never this key, so it can't loop.
  const key = enabled
    .map((r) => r.id)
    .sort()
    .join(',');

  useEffect(() => {
    if (demo) return;
    // A remount or a newer check makes this one stale: it records nothing and notifies nothing.
    let cancelled = false;
    setState((s) => ({ ...s, phase: 'checking' }));
    void (async () => {
      const current = readAlerts().rules.filter((r) => r.enabled && isPublicKind(r.kind));
      const of = (kind: string) => current.filter((r) => r.kind === kind);
      const uniq = (rs: AlertRule[]) => [...new Set(rs.map((r) => r.symbol))];
      const secTickers = uniq([...of('filing'), ...of('note'), ...of('results')]);
      const tickerReads = uniq([...(FINRA_ON_PRODUCTION ? of('si') : []), ...of('cluster')]);
      // Always one filings read: an empty list still answers whether SEC access is set up.
      const chunks: string[][] = [];
      for (let i = 0; i < secTickers.length; i += FILINGS_CHUNK)
        chunks.push(secTickers.slice(i, i + FILINGS_CHUNK));
      if (!chunks.length) chunks.push([]);
      const [answers, markets, tickers] = await Promise.all([
        Promise.all(chunks.map((c) => settled(getPublicFilings(c)))),
        of('cftc').length ? settled(getPublicMarkets()) : Promise.resolve(undefined),
        Promise.all(tickerReads.map((t) => settled(getPublicTicker(t)))),
      ]);
      if (cancelled) return;
      const { filings, asked } = mergeFilings(chunks, answers);
      const byTicker = new Map<string, PublicTicker | null>(
        tickerReads.map((t, i) => [t, tickers[i] ?? null]),
      );
      const futures: PublicFutures | null = (markets as PublicMarkets | null)?.futures ?? null;
      const today = localToday();
      const now = Date.now();
      const updated: AlertRule[] = [];
      const events: AlertEvent[] = [];
      for (const rule of current) {
        const out = applyCheck(
          rule,
          checkOne(rule, { filings, asked, futures, byTicker, today }),
          now,
        );
        updated.push(out.rule);
        events.push(...out.events);
      }
      const recorded = recordChecks(updated, events);
      const pageOn = readAlerts().notifyBrowser;
      for (const e of recorded) {
        const rule = updated.find((r) => r.id === e.ruleId);
        if (shouldNotify(rule, pageOn)) deliverBrowser(`Convexa · ${e.symbol}`, e.message, e.id);
      }
      const reads = answers.length + (markets === undefined ? 0 : 1) + tickers.length;
      const failed =
        answers.filter((a) => a === null || a.state === 'unavailable').length +
        (markets === undefined ? 0 : futures === null ? 1 : 0) +
        tickers.filter((t) => t === null).length;
      setState({
        phase: 'done',
        sec: filings?.state ?? null,
        secFailed: filings === null,
        checkedAt: now,
        reads,
        failed,
      });
    })();
    return () => {
      cancelled = true;
    };
    // `key` stands for the enabled rules; the rules themselves are read fresh inside.
  }, [key, demo]);

  return state;
}

/** What EDGAR's filings answer says about a results rule's ticker. */
function cadenceFor(
  symbol: string,
  filings: PublicFilings | null,
  asked: ReadonlySet<string>,
): ResultsCadence | undefined {
  if (!filings) return { state: 'down', window: null };
  if (filings.state === 'not_configured') return { state: 'notSetUp', window: null };
  if (filings.state === 'off') return { state: 'off', window: null };
  if (filings.state === 'unavailable' || filingsGap(filings, symbol, asked))
    return { state: 'down', window: null };
  // Servers before 2026-10-15 send no results windows: only the note's half is checked.
  if (!Array.isArray(filings.results)) return undefined;
  return { state: 'read', window: filings.results.find((w) => w.ticker === symbol) ?? null };
}

function checkOne(
  rule: AlertRule,
  src: {
    filings: PublicFilings | null;
    asked: ReadonlySet<string>;
    futures: PublicFutures | null;
    byTicker: Map<string, PublicTicker | null>;
    today: string;
  },
): CheckResult {
  const note = researchIndex.find((t) => t.ticker.toUpperCase() === rule.symbol)?.latest ?? null;
  switch (rule.kind) {
    case 'cftc':
      return checkPositioning(rule, src.futures);
    case 'si':
      if (!FINRA_ON_PRODUCTION) return { outcome: 'off', note: FINRA_OFF_REASON, firings: [] };
      return checkShortInterest(rule, src.byTicker.get(rule.symbol) ?? null);
    case 'filing':
      return checkFiling(rule, src.filings, src.asked);
    case 'cluster':
      return checkCluster(rule, src.byTicker.get(rule.symbol) ?? null);
    case 'results':
      return checkResults(
        rule,
        note ? note.aging.events : null,
        src.today,
        cadenceFor(rule.symbol, src.filings, src.asked),
      );
    case 'note': {
      if (!note) return checkNoteDue(rule, null, src.today, null, '');
      const f = src.filings;
      const read = f?.state === 'live' && !filingsGap(f, rule.symbol, src.asked) ? f : null;
      const cites = { date: note.date, accessions: note.accessions };
      const landed: NoteFiling[] | null = read
        ? read.filings
            .filter((x) => x.ticker === rule.symbol)
            .flatMap((x) => filedSince([x], cites).map((e) => ({ accession: x.accession, ...e })))
        : null;
      const fresh = freshness(note.aging, {
        today: src.today,
        notFollowingSince: note.notFollowingSince,
        filed: landed ?? [],
      });
      return checkNoteDue(rule, fresh, src.today, landed, note.date);
    }
    default:
      return { outcome: 'unchecked', firings: [] };
  }
}
