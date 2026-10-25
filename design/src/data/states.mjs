// v4 data states — the provenance vocabulary and every widget family in every state, as data.
// Components render these (components/data-states.mjs); the library, the state matrix and the hybrid
// desk all read the same records. Sample values throughout; dates sit around 2026-10-10 (the hybrid
// site) and 2026-10-07 18:30 UTC (the demo scenario, libs/api/src/lib/demo/mode.ts:5-6).

/** The fourteen states, in matrix order. `kind` drives the tag's treatment; every kind pairs a word
 *  with a glyph so no state is carried by hue alone (DE4, DE12 colour-never-the-only-cue, rule 22). */
export const STATE_ROWS = [
  { key: 'current', name: 'Live', word: 'Updated', glyph: 'calendar', kind: 'solid', rule: 'Public data, current to its source. Word and date; no dot, because rule 22 reserves the dot for a stream.' },
  { key: 'delayed', name: 'Live but delayed', word: 'Delayed by source', glyph: 'clock', kind: 'solid', rule: 'The source itself publishes late. Say by how much, on the card.' },
  { key: 'stale', name: 'Stale · last good copy', word: 'Last good copy', glyph: 'warn', kind: 'warn', rule: 'This cycle failed; the earlier copy shows dimmed, with when it was fetched.' },
  // Loading and empty have no word in P-2's closed list (fidelity FND-11): a product frame in either state carries no
  // tag (chart frames: components/charts.mjs inState). The words below only label the state on design boards.
  { key: 'loading', name: 'Loading', word: 'Loading', glyph: '', kind: 'none', rule: 'Skeleton at the final size, the title naming the metric (P-10). No tag in the product. Never a page spinner.' },
  { key: 'empty', name: 'Empty', word: 'Nothing yet', glyph: '', kind: 'none', rule: 'Teaches: what would appear, and when. No tag in the product: the sentence says it.' },
  { key: 'error', name: 'Error · cause + retry', word: "Couldn't load", glyph: 'warn', kind: 'warn', rule: 'Our request failed. Name the cause; offer Try again.' },
  { key: 'unavailable', name: 'Unavailable', word: 'Source down', glyph: 'warn', kind: 'warn', rule: 'The source is down and nothing is retained. Unknown, not empty: say when Convexa asks again.' },
  { key: 'notConfigured', name: 'Not configured', word: 'Not set up', glyph: 'sliders', kind: 'quiet', rule: 'This site lacks a key or setting. Reader copy first; the operator hint folds away.' },
  { key: 'off', name: 'Off', word: 'Off', glyph: 'power', kind: 'quiet', rule: 'Switched off on purpose. No retry.' },
  { key: 'paused', name: 'Paused', word: 'Paused', glyph: 'pause', kind: 'quiet', rule: 'A feed exists and is paused. Last value dimmed (textDim) with the pause mark.' },
  { key: 'notLive', name: 'Not live · needs paid feed', word: 'Not live', glyph: 'notlive', kind: 'quiet', rule: 'What it would show, why it is off, and a way to see a sample. No value slot pretends.' },
  { key: 'sample', name: 'Sample · mock', word: 'Sample', glyph: 'sample', kind: 'dashed', rule: 'Dashed frame, hatch, Sample tag, scenario date. Never a dot, a flash or a clock time.' },
  { key: 'demo', name: 'Demo · whole site', word: 'Demo · sample data', glyph: 'sample', kind: 'dashed', rule: 'The demo bar is up; every source chip turns dashed and says "shaped like". No live signals.' },
  { key: 'locked', name: 'Signed out · locked', word: 'Sign in', glyph: 'lock', kind: 'quiet', rule: 'Say what is behind the wall and offer the one way in.' },
];

/** The genuine stream state stays separate: only the paid feed can produce it (rule 18 `live`). */
export const STREAM = { key: 'live', name: 'Live stream', word: 'Live', glyph: '', kind: 'stream', rule: 'Only while a genuine stream delivers (rules 18 and 22). The hybrid site never shows it.' };
/** A flavour of Live: Convexa computes the figure from public inputs (2s10s, breakeven, TA). */
export const COMPUTED = { key: 'computed', name: 'Computed live', word: 'Computed', glyph: 'sigma', kind: 'solid', rule: 'Convexa computes it from public inputs, and names them.' };
/** Live, but drawn by a third party from its own data: TradingView's chart (canon 2026-10-13
 *  "Third-party embeds"). Dotted, like the third-party provenance chip. */
export const THIRD = { key: 'thirdParty', name: 'Live · third party', word: 'Live · TradingView', glyph: 'external', kind: 'dotted', rule: 'A third party draws it from its own data; Convexa reads nothing from it. Dotted, like its provenance chip.' };
/** Works without any market data: stored in this browser or the account, or static copy. */
export const LOCAL = { key: 'local', name: 'Local · no market data', word: 'Stored here', glyph: 'check', kind: 'solid', rule: 'Kept in this browser or the account; needs no feed.' };

export const FAMILIES = [
  { key: 'kpi', name: 'KPI · figure cell', desc: 'A number with its label, comparison and source', react: 'FigureCell' },
  { key: 'chart', name: 'Chart panel', desc: 'Claim title, the mark, source and as-of', react: 'ChartPanel (Markets curve, TA, structure field)' },
  { key: 'table', name: 'Table', desc: 'Records in rows; sortable, keyboard-reachable', react: 'ScanTable · Filings feed table' },
  { key: 'feed', name: 'Feed · list', desc: 'Dated items arriving over time', react: 'NotePublicPanels "Filed since" · OffExchangeBlocks' },
  { key: 'ai', name: 'AI read', desc: 'Verdict-first brief (rule 16)', react: 'AiRecPanel' },
  { key: 'pos', name: 'Positioning card', desc: 'Who holds what, from a dated report', react: 'NotePublicPanels cards · FreshPositioning' },
  { key: 'tape', name: 'Desk tape', desc: 'Prices as they print', react: 'LiveTape · TapeTrailRow' },
  { key: 'form', name: 'Form · input', desc: 'Fields the reader fills', react: 'RiskInputsSection · AlertsPage composer · AiKeySection' },
  { key: 'dialog', name: 'Dialog', desc: 'A decision in an overlay', react: 'TradeEntryDialog (sheet under 600)' },
];

const W = (s, lead = 'Would show') => ['would', s, lead];
const O = (s) => ['off', s];
const OP = (s) => ['op', s];
const NEXT = ['next', 'Convexa asks again at 14:15 UTC'];
const RETRY = ['retry'];
const SIGNIN = ['btn', 'Sign in'];
const SAMPLE = ['prov', 'Sample · not market data', 'dashed'];
const DEMO = ['prov', 'Demo · sample data', 'dashed'];
const M = (s) => `<span class="mono" style="color: var(--phosphor);">${s}</span>`;

/** DATA_STATES[family][state] = { title, tag: [state, text] | null, blocks: [...], foot: [...], frame? }.
 *  Copy reuses shipped strings where they exist (cited in design/REVIEW-2026-10-13.md). */
export const DATA_STATES = {
  kpi: {
    current: { title: '10-year Treasury', tag: ['current', 'Updated · Oct 9'], blocks: [['value', '4.18%'], ['line', `${M('+0.06')} pts on the week · 3.86–4.79 this year`]], foot: [['prov', 'U.S. Treasury · par yield curve', 'solid']] },
    delayed: { title: 'Short interest · NVDA', tag: ['delayed', 'Delayed by source · 9 days'], blocks: [['value', '0.9%'], ['line', 'of float · settled Sep 30, published Oct 9. FINRA reports twice a month, about a week late.']], foot: [['prov', 'FINRA · settlement Sep 30', 'solid']] },
    stale: { title: '10-year Treasury', tag: ['stale', 'Last good copy'], blocks: [['value', '4.18%', { dim: true }], ['line', "The Treasury didn't answer at 14:05 UTC. Showing the copy fetched at 08:00 UTC."]], foot: [NEXT] },
    loading: { title: '10-year Treasury', tag: null, blocks: [['mark', 'skelKpi']], foot: [['skel', '56%']] },
    empty: { title: 'Short-sale volume · BRK.A', tag: null, blocks: [['nan', 'not provided'], ['line', "FINRA's Oct 12 daily file has no volume for this symbol. Thinly traded names are often absent; the next file lands tomorrow."]], foot: [['prov', 'FINRA Reg SHO · Oct 12', 'solid']] },
    error: { title: '10-year Treasury', tag: ['error'], blocks: [['strong', "Rates didn't load."], ['line', "Convexa's server didn't answer within 20 s. The notes don't depend on it."]], foot: [RETRY] },
    unavailable: { title: '10-year Treasury', tag: ['unavailable'], blocks: [['nan', 'unavailable'], ['line', "The U.S. Treasury didn't answer at 14:05 UTC and no earlier copy is cached."]], foot: [NEXT] },
    notConfigured: { title: 'Insider trades · 90 days', tag: ['notConfigured'], blocks: [['strong', "SEC filings aren't set up on this site yet."], ['line', 'Insider trades come from SEC Form 4, which needs a contact address before EDGAR answers.']], foot: [OP('Set SEC_USER_AGENT on the API')] },
    off: { title: '10-year Treasury', tag: ['off'], blocks: [['strong', 'Public data is switched off on this server.'], ['line', "Rates come from the U.S. Treasury through Convexa's API, which has them turned off."]], foot: [OP('PUBLIC_DATA=off')] },
    paused: { title: 'Net dealer gamma · SPY', tag: ['paused'], blocks: [['value', '+$1.94B', { dim: true }], ['pause', 'last value · Oct 8 close. The options feed is paused.']], foot: [['prov', 'Convexa · from the options chain', 'solid']] },
    notLive: { title: 'Net dealer gamma · SPY', tag: ['notLive'], blocks: [['nan', '—'], W('the dollar gamma dealers hold, and whether it damps or feeds moves.'), O("it needs a paid options feed this site doesn't run.")], foot: [['link', 'See it with sample data', '#sample']] },
    sample: { title: 'Net dealer gamma · SPY', tag: ['sample'], blocks: [['value', '+$1.94B'], ['line', 'Authored scenario, Oct 7, 2026. Not market data.']], foot: [SAMPLE], frame: 'sample' },
    demo: { title: 'Net dealer gamma · SPY', tag: null, blocks: [['value', '+$1.94B'], ['line', 'Scenario as of Oct 7, 2:30 PM ET']], foot: [DEMO] },
    locked: { title: 'Capital at risk', tag: ['locked'], blocks: [['strong', 'Sign in to see your book.'], ['line', 'Positions are private to your account. Nothing here is a real brokerage balance.']], foot: [SIGNIN] },
  },
  chart: {
    current: { title: 'Treasury curve', tag: ['current', 'Updated · Oct 9'], blocks: [['claim', 'The curve rose about 0.3 pts in a month.', 'Par yields, %, 3M to 30Y. Dashed: Sep 9.'], ['mark', 'curve']], foot: [['src', 'Source: U.S. Treasury · as of Oct 9']] },
    delayed: { title: 'Futures positioning', tag: ['delayed', 'Delayed by source · as of Tue, out Fri'], blocks: [['claim', "Asset managers' S&amp;P longs sit near the top of their 3-year range.", 'Net contracts. Reported Tuesday, published Friday.'], ['mark', 'range', { pos: 88 }]], foot: [['src', 'Source: CFTC Traders in Financial Futures · as of Oct 6']] },
    stale: { title: 'Treasury curve', tag: ['stale', 'Last good copy'], blocks: [['claim', 'The curve rose about 0.3 pts in a month.', 'Showing the copy fetched 08:00 UTC.'], ['mark', 'curve', { dim: true }]], foot: [['src', "Treasury didn't answer at 14:05 UTC · next attempt 14:15"]] },
    loading: { title: 'Treasury curve', tag: null, blocks: [['mark', 'skelChart']], foot: [['skel', '50%']] },
    empty: { title: '2s10s spread', tag: null, blocks: [['claim', 'Nothing to plot yet.', 'The 2-year series starts Oct 1 on this server.'], ['mark', 'emptyAxis'], ['line', 'The line draws itself as each business day arrives; the year view fills by next October.']], foot: [] },
    error: { title: 'Treasury curve', tag: ['error'], blocks: [['strong', "The curve didn't load."], ['line', "Convexa's server answered 502 at 14:05 UTC. Nothing is cached in this browser."]], foot: [RETRY] },
    unavailable: { title: 'Treasury curve', tag: ['unavailable'], blocks: [['strong', 'Rates are unavailable.'], ['line', "The Treasury's rate files didn't answer and no earlier copy is cached. This is an outage, not an empty curve."]], foot: [NEXT] },
    notConfigured: { title: 'Revenue, 8 quarters', tag: ['notConfigured'], blocks: [['strong', "Reported figures aren't set up on this site yet."], ['line', 'They come from SEC XBRL company facts, which need a contact address.']], foot: [OP('Set SEC_USER_AGENT on the API')] },
    off: { title: 'Treasury curve', tag: ['off'], blocks: [['strong', 'Switched off on this server.'], ['line', 'The curve comes from the U.S. Treasury through the API, which has public data off.']], foot: [] },
    paused: { title: 'Gamma by strike · SPY', tag: ['paused'], blocks: [['claim', 'Paused at the Oct 8 close.', 'Last snapshot, dimmed. Levels may have moved.'], ['mark', 'gex', { mode: 'dim' }]], foot: [['src', 'Options feed paused by the operator']] },
    notLive: { title: 'Gamma by strike · SPY', tag: ['notLive'], blocks: [['mark', 'gex', { mode: 'outline', h: 52 }], W('where dealer hedging pushes price toward or away from each strike.'), O('it needs a paid options feed.')], foot: [['link', 'Show a sample', '#sample']] },
    sample: { title: 'Gamma by strike · SPY', tag: ['sample'], blocks: [['claim', 'Dealers are long gamma above 570.', 'Sample scenario, Oct 7, 2026. Not market data.'], ['mark', 'gex', { mode: 'live' }]], foot: [SAMPLE], frame: 'sample' },
    demo: { title: 'Gamma by strike · SPY', tag: null, blocks: [['claim', 'Dealers are long gamma above 570.', 'Scenario as of Oct 7, 2:30 PM ET.'], ['mark', 'gex', { mode: 'live' }]], foot: [DEMO] },
    locked: { title: 'Your P&amp;L over time', tag: ['locked'], blocks: [['strong', 'Sign in to see your paper P&amp;L.'], ['line', 'It charts the simulated book you build on the desk. Nothing is a real account.']], foot: [SIGNIN] },
  },
  table: {
    current: { title: 'Filings · 90 days', tag: ['current', 'Updated · 14:00 UTC'], blocks: [['mark', 'filings']], foot: [['prov', 'SEC EDGAR · hourly', 'solid']] },
    delayed: { title: 'Short interest · your notes', tag: ['delayed', 'Delayed by source · settled Sep 30'], blocks: [['mark', 'shortTable']], foot: [['prov', 'FINRA · out Oct 9', 'solid']] },
    stale: { title: 'Filings · 90 days', tag: ['stale', 'Last good copy'], blocks: [['mark', 'filings', { dim: true, n: 3 }]], foot: [['src', "EDGAR didn't answer at 14:05 · showing the 13:00 check"]] },
    loading: { title: 'Filings · 90 days', tag: null, blocks: [['mark', 'skelRows', { n: 4 }]], foot: [['skel', '40%']] },
    empty: { title: 'Filings · 90 days', tag: null, blocks: [['strong', 'Nothing filed in the last 90 days.'], ['line', 'When a company you follow files with the SEC, it appears here within the hour. Results 8-Ks are due from Oct 21.']], foot: [] },
    error: { title: 'Filings · 90 days', tag: ['error'], blocks: [['strong', "Filings didn't load."], ['line', "Convexa's server didn't answer within 20 s. Notes keep their own dates, so nothing comes due late."]], foot: [RETRY] },
    unavailable: { title: 'Filings · 90 days', tag: ['unavailable'], blocks: [['strong', 'EDGAR is down.'], ['line', "SEC EDGAR didn't answer at 14:05 UTC and nothing is cached. An outage is not the same as nothing filed."]], foot: [NEXT] },
    notConfigured: { title: 'Filings · 90 days', tag: ['notConfigured'], blocks: [['strong', "SEC filings aren't set up on this site yet."], ['line', 'EDGAR asks every program that reads it to identify itself with a contact address.']], foot: [OP('Set SEC_USER_AGENT on the API')] },
    off: { title: 'Filings · 90 days', tag: ['off'], blocks: [['strong', 'Public data is switched off on this server.'], ['line', "Filings come from SEC EDGAR through Convexa's API, which has them turned off."]], foot: [] },
    paused: { title: 'Scanner · your view', tag: ['paused'], blocks: [['mark', 'scan', { dim: true }], ['line', 'Market data paused · showing the last board, from Oct 8']], foot: [] },
    notLive: { title: 'Scanner · your view', tag: ['notLive'], blocks: [W('names ranked by dealer structure, refreshed every 3 minutes.'), O('the score reads the options chain, a paid feed.')], foot: [['link', 'Open the sample scan', '#sample']] },
    sample: { title: 'Scanner · your view', tag: ['sample'], blocks: [['mark', 'scan'], ['line', 'Sample scenario, Oct 7, 2026']], foot: [SAMPLE], frame: 'sample' },
    demo: { title: 'Scanner · your view', tag: null, blocks: [['mark', 'scan']], foot: [DEMO] },
    locked: { title: 'Scanner', tag: ['locked'], blocks: [['strong', 'Sign in to open the scanner.'], ['line', 'It is in private testing. Ticker analysis stays free — open any symbol without an account.']], foot: [SIGNIN] },
  },
  feed: {
    current: { title: 'Filed since this note · NVDA', tag: ['current', 'Updated · 14:00 UTC'], blocks: [['mark', 'filings', { n: 2 }], ['line', 'The Oct 9 8-K is new since the note.']], foot: [['prov', 'SEC EDGAR', 'solid']] },
    delayed: { title: 'Insider trades · NVDA', tag: ['delayed', 'Delayed by source · filed within 2 days'], blocks: [['mark', 'insiders']], foot: [['prov', 'SEC Form 4', 'solid']] },
    stale: { title: 'Filed since this note', tag: ['stale', 'Last good copy'], blocks: [['mark', 'filings', { dim: true, n: 2 }]], foot: [['src', 'From the 13:00 check · EDGAR down at 14:05']] },
    loading: { title: 'Filed since this note', tag: null, blocks: [['mark', 'skelRows', { n: 3 }]], foot: [] },
    empty: { title: 'Filed since this note · NVDA', tag: null, blocks: [['strong', 'Nothing yet. The note was written Oct 13.'], ['line', 'Next expected: the Q3 results 8-K on Nov 19. When it lands, the note comes due and the filing is listed here.']], foot: [['link', 'How updates work', '#methodology']] },
    error: { title: 'Filed since this note', tag: ['error'], blocks: [['strong', "Positioning and filings didn't load."], ['line', "Convexa's server didn't answer. The note above doesn't depend on it."]], foot: [RETRY] },
    unavailable: { title: 'Filed since this note', tag: ['unavailable'], blocks: [['strong', "EDGAR didn't answer."], ['line', 'No copy is cached, so this list is unknown, not empty.']], foot: [NEXT] },
    notConfigured: { title: 'Filed since this note', tag: ['notConfigured'], blocks: [['strong', "SEC filings aren't set up on this site yet."], ['line', 'The note still lists the filings it cites.']], foot: [OP('Set SEC_USER_AGENT on the API')] },
    off: { title: 'Filed since this note', tag: ['off'], blocks: [['strong', 'Public data is off on this server.'], ['line', 'The note still lists the filings it cites.']], foot: [] },
    paused: { title: 'Off-exchange blocks · SPY', tag: ['paused'], blocks: [['mark', 'blocks', { dim: true }], ['line', 'Last prints before the Oct 8 close.']], foot: [] },
    notLive: { title: 'Off-exchange blocks · SPY', tag: ['notLive'], blocks: [W('large trades printed away from the exchanges, as they happen.'), O('it needs intraday trade prints, a paid feed.')], foot: [['link', 'Weekly off-exchange volume (FINRA)', '#otc']] },
    sample: { title: 'Off-exchange blocks · SPY', tag: ['sample'], blocks: [['mark', 'blocks'], ['line', 'Sample session, Oct 7, 2026']], foot: [SAMPLE], frame: 'sample' },
    demo: { title: 'Off-exchange blocks · SPY', tag: null, blocks: [['mark', 'blocks']], foot: [DEMO] },
    locked: { title: 'Your fired alerts', tag: ['locked'], blocks: [['strong', 'Sign in to keep alerts across devices.'], ['line', 'Signed out, alerts live in this browser only.']], foot: [SIGNIN] },
  },
  ai: {
    current: { title: 'AI read · SPY', tag: ['live', 'Read pinned 10:41'], blocks: [['verdict', 'Sit this one out'], ['line', 'No edge worth the debit: price sits between the walls.'], ['mark', 'risk']], foot: [['src', 'Only with the paid feed · on your own key']] },
    delayed: { title: 'AI read', tag: null, blocks: [['na', 'A read is pinned to one snapshot, so it is never delayed. A newer snapshot makes it Stale, below.']], foot: [] },
    stale: { title: 'AI read · SPY', tag: null, blocks: [['warn', 'A newer snapshot has arrived.', 'This read is from 10:41:52 ET. Refresh when you are ready.'], ['verdict', 'Sit this one out']], foot: [['btn', 'Refresh analysis']] },
    loading: { title: 'AI read · SPY', tag: null, blocks: [['progress', 'Thinking… a risk-first read on SPY, usually 5–15 s'], ['mark', 'skelAi']], foot: [['btn', 'Stop']] },
    empty: { title: 'AI read · SPY', tag: null, blocks: [['strong', 'Ready to read this snapshot.'], ['line', 'It reads the structure above, on your key, and answers verdict first.']], foot: [['primary', 'Analyze current snapshot']] },
    error: { title: 'AI read · SPY', tag: ['error'], blocks: [['strong', 'AI unavailable — try again'], ['line', "Couldn't get a read right now. This didn't affect the rest of the dashboard."]], foot: [RETRY] },
    unavailable: { title: 'AI read · SPY', tag: ['unavailable', 'Daily cap'], blocks: [['strong', 'Daily AI limit reached — resets 12:00 AM ET'], ['line', '10 of 10 reads used. The last read stays readable.']], foot: [] },
    notConfigured: { title: 'AI read · SPY', tag: ['notConfigured', 'Not set up · add a key'], blocks: [['strong', 'Your key, your cost.'], ['line', 'Reads run on your own provider key. Convexa never pays for or keeps the answer.']], foot: [['link', 'Open AI providers in Settings', '#settings']] },
    off: { title: 'AI read · SPY', tag: ['off'], blocks: [['strong', 'AI reads are off on this server.'], ['line', 'The desk still shows the structure a read would use.']], foot: [] },
    paused: { title: 'AI read · SPY', tag: ['paused'], blocks: [['strong', 'Market data is paused.'], ['line', "There's nothing to analyze right now — this isn't an AI or key problem. Your last read stays readable."], ['verdict', 'Sit this one out', { dim: true }]], foot: [] },
    notLive: { title: 'AI read · SPY', tag: ['notLive'], blocks: [W('a verdict-first brief on the dealer structure, risk before rationale.'), O('it reads the options structure, which needs a paid feed.')], foot: [['link', 'Read a sample brief', '#sample']] },
    sample: { title: 'Sample analysis · SPY', tag: ['sample', 'Sample read'], blocks: [['verdict', 'Sit this one out'], ['line', 'This is an authored example. No model was called.'], ['mark', 'risk']], foot: [SAMPLE], frame: 'sample' },
    demo: { title: 'Sample analysis · SPY', tag: null, blocks: [['verdict', 'Sit this one out'], ['line', 'Sample analysis · authored for this scenario'], ['mark', 'risk']], foot: [DEMO] },
    locked: { title: 'AI read · SPY', tag: ['locked'], blocks: [['strong', 'Sign in to ask the AI for a read.'], ['line', 'Reads need an account and your own provider key.']], foot: [['link', 'See what would be sent', '#whats-sent']] },
  },
  pos: {
    current: { title: 'Short-sale volume · NVDA', tag: ['current', 'Updated · Oct 9'], blocks: [['value', '41%', { size: 24 }], ['line', 'of volume, 20-day average 43%. Counts market makers hedging, so a high reading is normal.']], foot: [['prov', 'FINRA Reg SHO daily · Oct 12', 'solid']] },
    delayed: { title: 'Short interest · NVDA', tag: ['delayed', 'Delayed by source · 9 days'], blocks: [['value', '0.9%', { size: 24 }], ['mark', 'bars'], ['line', '12 reports · settled Sep 30, published Oct 9']], foot: [['prov', 'FINRA · settlement Sep 30', 'solid']] },
    stale: { title: 'Insider trades · 90 days', tag: ['stale', 'Last good copy'], blocks: [['value', '12 sales · 0 buys', { size: 20, dim: true }], ['line', "EDGAR didn't answer at 14:05; counts from the 13:00 check."]], foot: [] },
    loading: { title: 'Short interest · NVDA', tag: null, blocks: [['mark', 'skelPos']], foot: [['skel', '48%']] },
    empty: { title: 'Short interest · RKLB', tag: null, blocks: [['nan', 'not provided'], ['line', "FINRA's Sep 30 file has no report for this symbol. Newly listed names often start a cycle later."]], foot: [['prov', 'FINRA · settlement Sep 30', 'solid']] },
    error: { title: 'Who is positioned how', tag: ['error'], blocks: [['strong', "Positioning and filings didn't load."], ['line', "Convexa's server didn't answer. The note above doesn't depend on it."]], foot: [RETRY] },
    unavailable: { title: 'Short interest · NVDA', tag: ['unavailable'], blocks: [['nan', 'unavailable'], ['line', "FINRA didn't answer and no earlier report is cached. Unknown, not zero."]], foot: [NEXT] },
    notConfigured: { title: 'Insider trades · 90 days', tag: ['notConfigured'], blocks: [['strong', "Insider filings aren't set up on this site yet."], ['line', 'They come from SEC EDGAR, which needs a contact address.']], foot: [OP('Set SEC_USER_AGENT on the API')] },
    off: { title: 'Who is positioned how', tag: ['off'], blocks: [['strong', 'Public data is off on this server.'], ['line', 'Short data and insider trades come from FINRA and the SEC.']], foot: [] },
    paused: { title: 'Fresh positioning · SPY', tag: ['paused'], blocks: [['value', '0.61×', { size: 24, dim: true }], ['line', 'volume over open interest · last at the Oct 8 close']], foot: [] },
    notLive: { title: 'Fresh positioning · SPY', tag: ['notLive'], blocks: [W("where today's options volume outruns open interest: new positions opening."), O('it reads the options chain.')], foot: [['link', 'Show a sample', '#sample']] },
    sample: { title: 'Fresh positioning · SPY', tag: ['sample'], blocks: [['value', '0.61×', { size: 24 }], ['line', 'volume over open interest · sample, Oct 7']], foot: [SAMPLE], frame: 'sample' },
    demo: { title: 'Short interest · NVDA', tag: null, blocks: [['value', '0.9%', { size: 24 }], ['mark', 'bars']], foot: [['prov', 'Demo · shaped like FINRA', 'dashed']] },
    locked: { title: 'Positioning card', tag: null, blocks: [['na', 'Positioning comes from public records, so nothing here sits behind a sign-in.']], foot: [] },
  },
  tape: {
    current: { title: 'Live tape · SPY', tag: ['live', 'live · 573.12'], blocks: [['mark', 'prints']], foot: [['src', 'Only while the paid feed streams (rule 18 live)']] },
    delayed: { title: 'Daily chart · SPY', tag: ['delayed', 'Delayed by source · TradingView'], blocks: [['strong', 'Prices on this site are TradingView’s, delayed.'], ['line', 'Intraday prints are not live. The Technical tab embeds TradingView’s daily chart; Convexa reads nothing from it.']], foot: [['prov', 'Chart by TradingView · US prices delayed', 'dotted']] },
    stale: { title: 'Live tape · SPY', tag: ['stale', 'Live offline — reconnecting…'], blocks: [['mark', 'prints', { dim: true }], ['pause', 'last trade 573.10 · stream dropped 10:42:09']], foot: [] },
    loading: { title: 'Live tape · SPY', tag: null, blocks: [['mark', 'skelRows', { n: 3, plain: true }]], foot: [['src', 'Connecting to the stream…']] },
    empty: { title: 'Live tape · SPY', tag: ['paused', 'Paused · closed'], blocks: [['strong', 'No prints yet today.'], ['line', 'The session opens at 9:30 AM ET. The last close is 573.12.']], foot: [] },
    error: { title: 'Live tape · SPY', tag: ['error'], blocks: [['strong', "Couldn't connect to the stream."], ['line', 'The socket closed at 10:42 (code 1006). Desk prices stop until it reconnects.']], foot: [RETRY] },
    unavailable: { title: 'Live tape · SPY', tag: ['unavailable', 'Source down · no live ticks'], blocks: [['strong', 'The feed sent no ticks for 15 s.'], ['line', 'The stream is open but quiet; levels keep their last values.']], foot: [] },
    notConfigured: { title: 'Live tape · SPY', tag: ['notConfigured'], blocks: [['strong', 'No market-data key on this server.'], ['line', 'The tape streams from the paid feed when a key is set.']], foot: [OP('Set the market-data key on the API')] },
    off: { title: 'Live tape · SPY', tag: ['off'], blocks: [['strong', 'The tape is off on this server.']], foot: [] },
    paused: { title: 'Live tape · SPY', tag: ['paused'], blocks: [['mark', 'prints', { dim: true }], ['line', 'Paused since the Oct 8 close. Last trade 573.10.']], foot: [] },
    notLive: { title: 'Live tape · SPY', tag: ['notLive'], blocks: [W('every print as it happens, and the mid the levels are measured from.'), O('intraday prints are a paid feed. The close shown above is end of day.')], foot: [['link', 'Play a sample session', '#sample']] },
    sample: { title: 'Session tape · SPY', tag: ['sample', 'Sample replay'], blocks: [['mark', 'prints'], ['line', 'Replaying a sample session, Oct 7 · 1×']], foot: [SAMPLE], frame: 'sample' },
    demo: { title: 'Sample tape · SPY', tag: null, blocks: [['mark', 'prints'], ['line', 'Authored sample stream for this scenario. It is not a connected market feed.']], foot: [DEMO] },
    locked: { title: 'Desk tape', tag: null, blocks: [['na', 'The tape is public on every ticker desk; nothing locks it.']], foot: [] },
  },
  form: {
    current: { title: 'Risk inputs', tag: ['current', 'Updated · saved 2 min ago'], blocks: [['field', 'Account size', '$25,000'], ['field', 'Max risk per trade', '2 %']], foot: [['primary', 'Save risk inputs']] },
    delayed: { title: 'Alert rule · SPY', tag: null, blocks: [['field', 'Kind', 'Closes above a level'], ['line', 'Checks once a day against the close, so it fires the evening after the cross.']], foot: [['btn', 'Add rule']] },
    stale: { title: 'Risk inputs', tag: ['stale', 'Changed elsewhere'], blocks: [['warn', 'Saved in another tab at 10:40.', 'Reload to see them before you edit.'], ['field', 'Account size', '$25,000']], foot: [['btn', 'Reload']] },
    loading: { title: 'Risk inputs', tag: null, blocks: [['mark', 'skelForm']], foot: [] },
    empty: { title: 'Alerts', tag: null, blocks: [['strong', 'No rules yet.'], ['line', 'A rule watches one ticker for one condition, for example "SPY score at or above 70".']], foot: [['btn', 'Add the first rule', { icon: 'plus' }]] },
    error: { title: 'Risk inputs', tag: null, blocks: [['field', 'Max risk per trade', '120 %', { err: true, help: 'Enter a number between 0 and 100.' }]], foot: [['primary', 'Save risk inputs']] },
    unavailable: { title: 'Risk inputs', tag: ['unavailable', "Couldn't save"], blocks: [['warn', "The server didn't answer.", 'Your edits are kept on this page.'], ['field', 'Account size', '$30,000']], foot: [['btn', 'Save again', { icon: 'refresh' }]] },
    notConfigured: { title: 'AI provider · Anthropic', tag: ['notConfigured', 'Not set up · no key yet'], blocks: [['field', 'API key', 'not set', { help: 'Paste a key from your provider. It is stored encrypted and never shown again.' }]], foot: [['btn', 'Save key']] },
    off: { title: 'Brokerage', tag: ['off'], blocks: [['field', 'Webull', 'not connected', { disabled: true, help: 'Broker connections are off on this server. Paper trading works without one.' }]], foot: [] },
    paused: { title: 'Alert rule · SPY', tag: ['paused'], blocks: [['field', 'Kind', 'Score gate', { disabled: true, help: 'Live market data is off, so no rule can fire right now. Rules you add stay saved in this browser.' }]], foot: [['btn', 'Add rule', { disabled: true }]] },
    notLive: { title: 'Alert rule · SPY', tag: ['notLive'], blocks: [W('a level, a tier or a score while a desk is open.', 'Would watch'), O('all three kinds read dealer structure, which needs the paid feed.')], foot: [['link', 'Try a sample rule', '#sample']] },
    sample: { title: 'Alert rule · SPY', tag: ['sample', 'Sample rule'], blocks: [['field', 'Kind', 'Score gate · ≥ 70'], ['line', 'Fires against the sample scenario only. Nothing is saved.']], foot: [], frame: 'sample' },
    demo: { title: 'Risk inputs', tag: null, blocks: [['field', 'Account size', '$25,000'], ['line', "Saved in this browser's demo workspace. Reset Demo clears it."]], foot: [['btn', 'Save']] },
    locked: { title: 'Scan view', tag: ['locked'], blocks: [['strong', 'Saved views need a sign-in.'], ['line', 'Signed out, your view lasts for this browser session.']], foot: [SIGNIN] },
  },
  dialog: {
    current: { title: 'Open simulated position', tag: ['live', 'mid 2.10'], blocks: [['mark', 'legs'], ['line', 'Fill: mid 2.10. Nothing is saved until you confirm.']], foot: [['primary', 'Open simulated position']] },
    delayed: { title: 'Simulated trade', tag: null, blocks: [['na', 'No delayed options chain exists on this site, so there is no delayed fill. See Not live.']], foot: [] },
    stale: { title: 'Open simulated position', tag: null, blocks: [['warn', 'The mid moved to 2.24.', 'Re-price before you confirm.'], ['mark', 'legs', { dim: true }]], foot: [['btn', 'Re-price']] },
    loading: { title: 'Open simulated position', tag: null, blocks: [['mark', 'skelDialog']], foot: [] },
    empty: { title: 'Simulated trade · RKLB', tag: null, blocks: [['strong', 'No expiration inside your current window.'], ['line', 'Widen the expirations window to see longer-dated contracts.']], foot: [['btn', 'Use all expirations']] },
    error: { title: 'Simulated trade', tag: ['error'], blocks: [['strong', "Couldn't load the chain for entry — try again."], ['line', 'The server timed out after 20 s. Nothing was saved.']], foot: [RETRY] },
    unavailable: { title: 'Simulated trade · RKLB', tag: ['unavailable'], blocks: [['strong', 'No quote or theoretical mark available.'], ['line', 'Try Manual price: it opens at your own price, not a market quote.']], foot: [['btn', 'Use manual price']] },
    notConfigured: { title: 'Open simulated position', tag: null, blocks: [['mark', 'legs'], ['kv', 'Cap check', 'not set'], ['line', 'Set risk inputs to size against your cap.']], foot: [['link', 'Set risk inputs', '#settings']] },
    off: { title: 'Simulated trade', tag: ['off'], blocks: [['strong', 'Paper trading is off on this server.'], ['line', 'Your existing paper book stays readable.']], foot: [] },
    paused: { title: 'Open simulated position', tag: ['paused'], blocks: [['strong', 'Market and Limit fills are paused with market data.'], ['line', 'Manual price still works: it opens at your price, user-entered, not a market quote.']], foot: [['btn', 'Use manual price']] },
    notLive: { title: 'Open simulated position', tag: ['notLive'], blocks: [W('a paper trade at the live mid, sized to your cap.', 'Would let you'), O("Market and Limit fills read the options chain. Manual price works: it's your number, not a quote.")], foot: [['btn', 'Use manual price']] },
    sample: { title: 'Sample trade', tag: ['sample'], blocks: [['mark', 'legs'], ['line', 'Priced on the Oct 7 sample chain. Nothing is saved.']], foot: [['btn', 'Close']], frame: 'sample' },
    demo: { title: 'Open simulated position', tag: null, blocks: [['mark', 'legs'], ['line', 'Demo paper trade · stored in this browser.']], foot: [['primary', 'Open simulated position']] },
    locked: { title: 'Simulated trade', tag: ['locked'], blocks: [['strong', 'Sign in to open a paper position.'], ['line', 'No real order is ever sent.']], foot: [SIGNIN] },
  },
};
