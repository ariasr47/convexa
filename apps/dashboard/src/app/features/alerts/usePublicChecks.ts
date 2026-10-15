/**
 * Checks the public-data alerts in this browser, when the Alerts page opens (and again when a rule is
 * added): one read of each source the enabled rules need, then `publicRules.ts` decides what fires.
 *
 * What this is not: a server-side schedule. Nothing checks a rule while no Alerts page is open, and the
 * page says so. The demo never checks: its firings are part of the Oct 7 scenario (the seed).
 *
 * Sources: `/api/public-data/markets` (CFTC), `/api/public-data/tickers/{t}` (FINRA),
 * `/api/public-data/filings` (SEC EDGAR, and whether SEC access is set up at all), and the research
 * notes compiled into the build (`virtual:convexa-research`).
 */
import { filedSince } from '@/pages/research/filings';
import {
  dataMode,
  getPublicFilings,
  getPublicMarkets,
  getPublicTicker,
  type PublicDataState,
  type PublicFilings,
  type PublicFutures,
  type PublicTicker,
} from '@convexa/api';
import { useEffect, useRef, useState } from 'react';
import { freshness, localToday, researchIndex } from 'virtual:convexa-research';
import { isPublicKind } from './kinds';
import {
  applyCheck,
  checkCluster,
  checkFiling,
  checkNoteDue,
  checkPositioning,
  checkResults,
  checkShortInterest,
  type CheckResult,
} from './publicRules';
import { readAlerts, recordChecks } from './store';
import type { AlertEvent, AlertRule } from './types';
import { deliverBrowser } from './useAlerts';

export interface PublicChecks {
  /** `demo`: the demo never checks. */
  phase: 'demo' | 'idle' | 'checking' | 'done';
  /** SEC EDGAR's state on this site; null until known, or when the read failed. */
  sec: PublicDataState | null;
  /** Whether the SEC read itself failed (unknown, not "not set up"). */
  secFailed: boolean;
}

/** Tickers with a research note: "followed", for the filing and insider kinds. */
export function followedTickers(): Set<string> {
  return new Set(researchIndex.map((t) => t.ticker.toUpperCase()));
}

const settled = <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

export function usePublicChecks(rules: AlertRule[]): PublicChecks {
  const demo = dataMode === 'demo';
  const [state, setState] = useState<PublicChecks>({
    phase: demo ? 'demo' : 'idle',
    sec: null,
    secFailed: false,
  });
  const enabled = rules.filter((r) => r.enabled && isPublicKind(r.kind));
  // Re-check when the set of enabled rules changes (a new rule checks at once); a check's own write
  // changes only the rules' memory, never this key, so it can't loop.
  const key = enabled
    .map((r) => r.id)
    .sort()
    .join(',');
  const run = useRef(0);

  useEffect(() => {
    if (demo) return;
    const id = ++run.current;
    setState((s) => ({ ...s, phase: 'checking' }));
    void (async () => {
      const current = readAlerts().rules.filter((r) => r.enabled && isPublicKind(r.kind));
      const of = (kind: string) => current.filter((r) => r.kind === kind);
      const noteTickers = [...of('filing'), ...of('note')].map((r) => r.symbol);
      const siTickers = [...new Set(of('si').map((r) => r.symbol))];
      const [filings, markets, ...tickers] = await Promise.all([
        // Always read: an empty list still answers whether SEC access is set up.
        settled(getPublicFilings([...new Set(noteTickers)].slice(0, 30))),
        of('cftc').length ? settled(getPublicMarkets()) : Promise.resolve(null),
        ...siTickers.map((t) => settled(getPublicTicker(t))),
      ]);
      if (id !== run.current) return;
      const byTicker = new Map<string, PublicTicker | null>(
        siTickers.map((t, i) => [t, (tickers[i] as PublicTicker | null) ?? null]),
      );
      const futures: PublicFutures | null = markets?.futures ?? null;
      const sec = (filings as PublicFilings | null)?.state ?? null;
      const today = localToday();
      const now = Date.now();
      const updated: AlertRule[] = [];
      const events: AlertEvent[] = [];
      for (const rule of current) {
        const result = checkOne(rule, {
          filings: filings as PublicFilings | null,
          futures,
          byTicker,
          today,
        });
        const out = applyCheck(rule, result, now);
        updated.push(out.rule);
        events.push(...out.events);
      }
      recordChecks(updated, events);
      const notifyAll = readAlerts().notifyBrowser;
      for (const e of events) {
        const rule = updated.find((r) => r.id === e.ruleId);
        if (rule?.notify ?? notifyAll) deliverBrowser(`Convexa · ${e.symbol}`, e.message);
      }
      setState({ phase: 'done', sec, secFailed: filings === null });
    })();
    // `key` stands for the enabled rules; the rules themselves are read fresh inside.
  }, [key, demo]);

  return state;
}

function checkOne(
  rule: AlertRule,
  src: {
    filings: PublicFilings | null;
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
      return checkShortInterest(rule, src.byTicker.get(rule.symbol) ?? null);
    case 'filing':
      return checkFiling(rule, src.filings);
    case 'cluster':
      return checkCluster(src.filings?.state ?? null);
    case 'results':
      return checkResults(rule, note ? note.aging.events : null, src.today);
    case 'note': {
      if (!note) return checkNoteDue(rule, null, src.today, false);
      const filings = src.filings?.state === 'live' ? src.filings : null;
      const filingsRead = filings !== null;
      const filed = filings
        ? filedSince(
            filings.filings.filter((f) => f.ticker === rule.symbol),
            { date: note.date, accessions: note.accessions },
          )
        : [];
      const fresh = freshness(note.aging, {
        today: src.today,
        notFollowingSince: note.notFollowingSince,
        filed,
      });
      return checkNoteDue(rule, fresh, src.today, filingsRead);
    }
    default:
      return { outcome: 'unchecked', firings: [] };
  }
}
