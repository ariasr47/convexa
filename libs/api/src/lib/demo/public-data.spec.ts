import { describe, expect, it } from 'vitest';
import { demoNoteFilings, demoPublicFilings, demoPublicTicker } from './public-data';

// The staging Filings feed against its board (Final · Research · Filings, staging): nine sample
// filings for MSFT, NVDA and TSLA; the sample notes cite all but TSLA's shareholder-vote 8-K. What
// goes wrong silently: a citation whose accession doesn't match its filing turns every row "not
// cited", and a sample for AAPL puts filings on the feed the board says it hasn't got.
describe('demo filings and the sample notes that cite them', () => {
  const symbols = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA'];
  const feed = demoPublicFilings(symbols);

  it('answers nine filings for MSFT, NVDA and TSLA, and names the funds as missing', () => {
    expect(feed.filings).toHaveLength(9);
    expect([...new Set(feed.filings.map((f) => f.ticker))].sort()).toEqual([
      'MSFT',
      'NVDA',
      'TSLA',
    ]);
    expect(feed.missing).toEqual(['SPY', 'QQQ']);
  });

  it('cites every sample filing but TSLA’s shareholder vote', () => {
    const uncited = feed.filings.filter(
      (f) => !demoNoteFilings(f.ticker)?.accessions.includes(f.accession),
    );
    expect(uncited.map((f) => [f.ticker, f.form, f.items])).toEqual([['TSLA', '8-K', ['5.07']]]);
    // Dated after every filing: a filing is cited or not, never new since the note.
    expect(feed.filings.every((f) => f.filed <= demoNoteFilings(f.ticker)!.date)).toBe(true);
  });

  it('gives AAPL no filing list, quarterly report or annual revenue, and keeps its Form 4 sample', () => {
    const aapl = demoPublicTicker('AAPL');
    expect(aapl.filings).toEqual([]);
    expect(aapl.periodic).toEqual([]);
    expect(aapl.annual_revenue).toEqual([]);
    expect(aapl.insiders?.transactions?.length).toBeGreaterThan(0);
  });

  it('keeps each 10-Q in the filing list and the periodic reports on one accession', () => {
    const nvda = demoPublicTicker('NVDA');
    const q = nvda.filings.find((f) => f.form === '10-Q');
    expect(nvda.periodic[0].accession).toBe(q?.accession);
  });
});
