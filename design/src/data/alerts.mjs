// Alerts on public data (Q-5, ruled "design it now" by the owner, 2026-10-13). Six kinds that work on the
// semi-live site, each naming its source, its delay, when Convexa checks, what it depends on and its state
// word from the closed vocabulary (P-2, approved). Kinds that read SEC EDGAR depend on SEC_USER_AGENT,
// which is set on production (2026-10-15); if it is unset they say "Not set up" and may still be saved.
// FINRA short interest is Off on production until FINRA's terms for showing its data are confirmed
// (owner, 2026-10-15, answer 4); staging keeps its sample. Values illustrative.
export const ALERT_KINDS = [
  { key: 'results', name: 'Results approaching', glyph: 'calendar', fires: 'A set number of days before a company’s expected results date', source: 'Your research notes’ catalysts, and the company’s filing cadence on SEC EDGAR', chip: 'Notes · EDGAR cadence', delay: 'An estimate until the company confirms the date (an 8-K or its investor-relations page); the alert re-dates itself when the date moves', check: 'Daily, 6:00 AM ET', needs: 'Works from notes alone; the cadence estimate needs SEC access', state: 'current', stateText: 'Updated', sec: 'partial' },
  { key: 'filing', name: 'New filing', glyph: 'doc', fires: 'A followed ticker files an 8-K, 10-Q or 10-K (8-K items optional)', source: 'SEC EDGAR', chip: 'SEC EDGAR', delay: 'EDGAR posts a filing minutes after acceptance; Convexa checks every hour', check: 'Hourly', needs: 'SEC access on this site (SEC_USER_AGENT)', state: 'current', stateText: 'Updated', sec: 'needs' },
  { key: 'cluster', name: 'Insider cluster', glyph: 'user', fires: 'Three or more insiders of a followed ticker buy on the open market within 10 days, outside pre-set plans (sales are never a cluster)', source: 'SEC EDGAR · Form 4', chip: 'SEC EDGAR · Form 4', delay: 'Insiders file within two business days of a trade; Convexa checks every hour', check: 'Hourly', needs: 'SEC access on this site (SEC_USER_AGENT)', state: 'current', stateText: 'Updated', sec: 'needs' },
  { key: 'cftc', name: 'Positioning extreme', glyph: 'layers', fires: 'A trader group’s net futures position reaches its 3-year high or low, or comes within 5% of it', source: 'CFTC · Traders in Financial Futures', chip: 'CFTC · TFF', delay: 'Positions as of Tuesday, published Friday at 3:30 PM ET', check: 'Fridays, 4:00 PM ET', needs: 'Nothing: live on this site', state: 'delayed', stateText: 'Delayed by source', sec: 'no' },
  { key: 'si', name: 'Short interest change', glyph: 'activity', fires: 'Shares sold short move past your threshold between two settlements, or days to cover crosses a level', source: 'FINRA · short interest', chip: 'FINRA · short interest', delay: 'Twice a month, published about a week after each settlement', check: 'On FINRA’s publication days', needs: 'FINRA, which is off on this site until its terms for showing its data are confirmed', state: 'off', stateText: 'Off', sec: 'no' },
  { key: 'note', name: 'Note coming due', glyph: 'book', fires: 'A note’s review date comes within your window, or a filing lands after the note’s price date', source: 'Convexa research notes', chip: 'Convexa notes', delay: 'None: Convexa holds the note', check: 'Daily, 6:00 AM ET', needs: 'Nothing', state: 'computed', stateText: 'Computed', sec: 'no' },
];
export const STRUCTURE_KINDS = [
  ['Score gate', 'needs the options feed'], ['Tier change', 'needs the options feed'], ['Level touch', 'needs the options feed'],
];
export const KIND = Object.fromEntries(ALERT_KINDS.map((k) => [k.key, k]));

// The rules on the page (a reader who follows NVDA, AMD and INTC and reads the 10-year positioning).
export const RULES = [
  { kind: 'results', subject: 'NVDA', what: '7 days before results · expected Nov 19 (note’s catalyst)', last: 'Checked 6:00 AM', state: 'current', stateText: 'Updated', on: true },
  { kind: 'filing', subject: 'NVDA', what: '8-K items 2.02 and 5.02 · 10-Q · 10-K', last: 'Checked 6:00 AM', state: 'current', stateText: 'Updated', on: true },
  { kind: 'cluster', subject: 'INTC', what: '3+ insiders buying, 10 days · plan trades not counted', last: 'Checked 6:00 AM', state: 'current', stateText: 'Updated', on: true },
  { kind: 'cftc', subject: '10-year T-note', what: 'Leveraged funds · 3-year low · or within 5%', last: 'Checked Fri Oct 9, 4:00 PM', state: 'delayed', stateText: 'As of Tue Oct 6', on: true },
  { kind: 'si', subject: 'AMD', what: 'Shares short ±15% between settlements', last: 'FINRA data is off on this site until its display terms are confirmed', state: 'off', stateText: 'Off', on: true },
  { kind: 'note', subject: 'NVDA', what: 'Review due within 7 days, or a filing after the price date', last: 'Checked 6:00 AM', state: 'computed', stateText: 'Computed', on: true },
  { kind: 'cftc', subject: 'E-mini S&P 500', what: 'Asset managers · 3-year high', last: 'Off since Oct 2', state: 'off', stateText: 'Off', on: false },
];
export const FIRED = [
  { date: 'Oct 9', kind: 'cftc', title: '10-year T-note: leveraged funds at a 3-year low', detail: '−1.04M contracts net, positions as of Tue Oct 6', chip: 'CFTC · TFF · Oct 9', link: ['Open Markets', '/research/markets'] },
  { date: 'Oct 9', kind: 'note', title: 'NVDA: a filing landed after the note’s price date', detail: '8-K Item 5.02 (officer change), Oct 9. The note’s figures predate it.', chip: 'Convexa notes', link: ['Open the note', '/ticker/NVDA/research'] },
  { date: 'Oct 6', kind: 'si', title: 'AMD: shares short up 18% between settlements', detail: '41.2M at Sep 30 from 34.9M at Sep 15; days to cover 1.4', chip: 'FINRA · Sep 30', link: ['Open AMD research', '/ticker/AMD/research'] },
];
