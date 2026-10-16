// Contract reading for SEC EDGAR's state. Each case here was once read wrong in a way nobody would
// notice: an outage tagged Computed, a heavy filer's coverage note tagged Last good copy, an unread
// year of Form 4s called empty, and companies EDGAR didn't answer for said to have filed nothing.
import type { PublicFilings } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { insiderFrame, notSecFiler, quietTickers, secStale } from './secState';

describe('secStale', () => {
  it('follows the API’s own word when it sends one', () => {
    expect(secStale('last_good', null)).toBe(true);
    expect(secStale('updated', 'SEC EDGAR did not answer for NVDA')).toBe(false);
    expect(secStale('source_down', null)).toBe(false);
  });

  it('reads an older API (no field) from its outage sentence', () => {
    expect(secStale(undefined, 'SEC EDGAR did not answer; showing filings fetched earlier.')).toBe(
      true,
    );
    expect(secStale(undefined, null)).toBe(false);
  });

  it('never calls a coverage note or a missing company stale', () => {
    expect(secStale(undefined, 'Counts cover the 30 newest of 47 Form 4 filings.')).toBe(false);
    expect(secStale(undefined, 'SEC EDGAR lists no company under VIX.')).toBe(false);
    expect(secStale('updated', 'Counts cover the 30 newest of 47 Form 4 filings.')).toBe(false);
  });
});

describe('notSecFiler', () => {
  it('is a live answer with no insiders part, not a setup fault', () => {
    expect(notSecFiler({ insiders: null, filings_state: 'live' })).toBe(true);
    expect(notSecFiler({ insiders: null, filings_state: 'not_configured' })).toBe(false);
    expect(notSecFiler({ insiders: null, filings_state: 'unavailable' })).toBe(false);
  });
});

describe('insiderFrame', () => {
  it('makes no claim against an API from before the timeline', () => {
    expect(insiderFrame({}).kind).toBe('olderServer');
  });

  it('calls 0 of 12 read unknown, not empty', () => {
    expect(
      insiderFrame({
        transactions: [],
        history_filings: 12,
        history_filings_read: 0,
        history_reaches_back_to: null,
      }),
    ).toEqual({ kind: 'unread', filings: 12 });
  });

  it('names the coverage when only the newest filings were read', () => {
    expect(
      insiderFrame({
        transactions: [],
        history_filings: 80,
        history_filings_read: 77,
        history_reaches_back_to: '2026-02-03',
      }),
    ).toEqual({ kind: 'emptyPartial', read: 77, filings: 80, backTo: '2026-02-03' });
    const tx = [{ insider: 0 }] as never;
    expect(
      insiderFrame({
        transactions: tx,
        history_filings: 80,
        history_filings_read: 77,
        history_reaches_back_to: '2026-02-03',
      }),
    ).toEqual({ kind: 'ready', partial: { read: 77, filings: 80, backTo: '2026-02-03' } });
  });

  it('states an empty year only when every filing was read', () => {
    expect(
      insiderFrame({
        transactions: [],
        history_filings: 9,
        history_filings_read: 9,
        history_reaches_back_to: null,
      }).kind,
    ).toBe('empty');
    expect(
      insiderFrame({
        transactions: [],
        history_filings: 0,
        history_filings_read: 0,
        history_reaches_back_to: null,
      }).kind,
    ).toBe('empty');
  });
});

describe('quietTickers', () => {
  const answer = (over: Partial<PublicFilings>): PublicFilings => ({
    state: 'live',
    detail: null,
    checked_at: null,
    filings: [{ ticker: 'NVDA' } as PublicFilings['filings'][number]],
    missing: ['SPY'],
    ...over,
  });
  const row = (state: NonNullable<PublicFilings['source_state']>) => ({
    id: 'sec',
    name: 'SEC EDGAR',
    state,
    as_of: null,
    checked_at: null,
    failed_at: null,
    detail: null,
  });
  const followed = ['NVDA', 'SPY', 'MU', 'INTC'];

  it('says filed nothing when EDGAR answered for every company', () => {
    expect(quietTickers(answer({ sources: [row('updated')] }), followed)).toEqual({
      tickers: ['MU', 'INTC'],
      known: true,
    });
  });

  it('calls them unknown after a partial failure (last good)', () => {
    const r = quietTickers(
      answer({
        sources: [row('last_good')],
        detail: 'SEC EDGAR did not answer for MU, INTC; no filings are shown for them.',
      }),
      followed,
    );
    expect(r.known).toBe(false);
  });

  it('calls them unknown when the answer is unavailable', () => {
    const r = quietTickers(
      answer({ state: 'unavailable', missing: [], filings: [], sources: [row('source_down')] }),
      followed,
    );
    expect(r).toEqual({ tickers: followed, known: false });
  });

  it('reads an API from before `sources` by its outage sentence', () => {
    expect(quietTickers(answer({}), followed).known).toBe(true);
    expect(
      quietTickers(answer({ detail: 'SEC EDGAR did not answer for MU.' }), followed).known,
    ).toBe(false);
  });
});
