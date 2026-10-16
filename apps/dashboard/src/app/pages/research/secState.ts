/**
 * Reading SEC EDGAR's state off the public-data answers. The API says what it knows in a few fields,
 * and each misreading is silent: an outage tagged Updated, a coverage note tagged Last good copy, a
 * company EDGAR doesn't list told to set an environment variable, or an unread year called empty.
 * Every new field is read defensively, because the site deploys before the API.
 */
import type { PublicFilings, PublicInsiders, PublicSourceState, PublicTicker } from '@convexa/api';

/**
 * The copy served is the last good one because this cycle's EDGAR fetch failed. The API's own word
 * (`last_good` on the sec row) decides; an API from before that field existed (`undefined`, during a
 * deploy) is read from its outage sentence instead. A coverage note ("Counts cover the 30 newest…")
 * or "EDGAR lists no company under X" is not an outage.
 */
export function secStale(
  sourceState: PublicSourceState | null | undefined,
  detail: string | null | undefined,
): boolean {
  if (sourceState != null) return sourceState === 'last_good';
  return /did not answer/i.test(detail ?? '');
}

/** The ticker answer's SEC part is a last good copy. */
export const tickerSecStale = (d: Pick<PublicTicker, 'filings_source_state' | 'filings_detail'>) =>
  secStale(d.filings_source_state, d.filings_detail);

/**
 * SEC is configured and answered, but EDGAR's ticker map has no company under this symbol (an index,
 * a fund, a fresh IPO): not an SEC filer, which is a fact, not a setup fault.
 */
export const notSecFiler = (d: Pick<PublicTicker, 'insiders' | 'filings_state'>) =>
  !d.insiders && d.filings_state === 'live';

/** What the twelve-month insider timeline may claim from what was read. */
export type InsiderFrame =
  /** An API from before the timeline: no claim about trades at all. */
  | { kind: 'olderServer' }
  /** Form 4s were filed in the period and none could be read: unknown, not empty. */
  | { kind: 'unread'; filings: number }
  /** Some were read and they hold no trade: the claim covers only what was read. */
  | { kind: 'emptyPartial'; read: number; filings: number; backTo: string | null }
  /** Every filing in the period was read and none is an open-market trade. */
  | { kind: 'empty' }
  /** Trades to draw; `partial` when only the newest filings were read. */
  | {
      kind: 'ready';
      partial: { read: number; filings: number; backTo: string | null } | null;
    };

export function insiderFrame(
  ins: Partial<
    Pick<
      PublicInsiders,
      'transactions' | 'history_filings' | 'history_filings_read' | 'history_reaches_back_to'
    >
  >,
): InsiderFrame {
  if (ins.transactions === undefined) return { kind: 'olderServer' };
  const filings = ins.history_filings ?? 0;
  const read = ins.history_filings_read ?? filings;
  const backTo = ins.history_reaches_back_to ?? null;
  const partial = read < filings ? { read, filings, backTo } : null;
  if (ins.transactions.length > 0) return { kind: 'ready', partial };
  if (filings > 0 && read === 0) return { kind: 'unread', filings };
  if (partial) return { kind: 'emptyPartial', ...partial };
  return { kind: 'empty' };
}

/**
 * The followed tickers with nothing in the 90-day feed, and whether that can be said as a fact. Only
 * a live answer whose EDGAR row is `updated` (every company's list fetched this cycle) makes "filed
 * nothing" true; after a partial or total failure a missing ticker may just not have answered. An API
 * from before `sources` existed is trusted only when it carried no outage sentence.
 */
export function quietTickers(
  data: Pick<PublicFilings, 'state' | 'detail' | 'filings' | 'missing'> &
    Partial<Pick<PublicFilings, 'sources' | 'source_state'>>,
  followed: string[],
): { tickers: string[]; known: boolean } {
  const filed = new Set(data.filings.map((f) => f.ticker));
  const tickers = followed.filter((t) => !data.missing.includes(t) && !filed.has(t));
  const row = data.sources?.find((s) => s.id === 'sec')?.state ?? data.source_state ?? undefined;
  const answered = row !== undefined ? row === 'updated' : !data.detail;
  return { tickers, known: data.state === 'live' && answered };
}
