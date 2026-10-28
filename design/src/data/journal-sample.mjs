// Spec 08 · the Sample journal, as data (design step 0, 2026-10-28).
//
// A fictional trader's journal on the demo catalog, exactly as docs/product/specs/2026-10-26/08-trade-journal.md
// gives it: "Computed facts" → "Worked example: the staging sample, checked by script", the Screens and Copy
// that quote it, "The rulebook" → "The sample's rulebook", the fixed detector table, the tone guide's sample
// sentences, and "Staging (the demo transport)". It is not the owner's data: no figure here comes from
// anywhere but the spec's sample, and nothing here quotes the owner's request.
//
// Typed inputs only: trades, marks, snapshots, money, the call, entries, notes, the correction, rules and
// plan answers. Every derived figure is computed below from them, in integer cents and exact fractions
// (BigInt), and display rounds half away from zero, as the spec binds. tmp/journal-boards/check-sample.mjs
// asserts every figure the spec prints for the sample.
//
// Where the spec prints a count without listing its members (34 entries, 5 later notes, row 9's 3 figures,
// 4 stated confidences, 14 details waiting in Tidy), the members it describes are listed in full and the
// rest are carried as undescribed placeholders, so counts reconcile and boards never invent them. GAPS (at
// the end) lists every such hole and one inconsistency in the spec's own figures.

// ---- exact fractions --------------------------------------------------------------------------------
const gcd = (a, b) => {
  if (a < 0n) a = -a;
  if (b < 0n) b = -b;
  while (b) [a, b] = [b, a % b];
  return a;
};
/** An exact fraction over BigInt. Money is integer cents; averages and ratios stay exact until display. */
export class Q {
  constructor(n, d = 1n) {
    n = BigInt(n);
    d = BigInt(d);
    if (d === 0n) throw new Error('Q: division by zero');
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d) || 1n;
    this.n = n / g;
    this.d = d / g;
  }
  static of(x) {
    if (x instanceof Q) return x;
    if (typeof x === 'bigint') return new Q(x);
    if (Number.isInteger(x)) return new Q(BigInt(x));
    throw new Error(`Q.of: ${x} is not an integer (pass cents, or build a Q)`);
  }
  add(o) { o = Q.of(o); return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = Q.of(o); return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = Q.of(o); return new Q(this.n * o.n, this.d * o.d); }
  div(o) {
    o = Q.of(o);
    if (o.n === 0n) throw new Error('Q: division by zero');
    return new Q(this.n * o.d, this.d * o.n);
  }
  neg() { return new Q(-this.n, this.d); }
  abs() { return this.n < 0n ? this.neg() : this; }
  cmp(o) { o = Q.of(o); const l = this.n * o.d, r = o.n * this.d; return l < r ? -1 : l > r ? 1 : 0; }
  sign() { return this.n < 0n ? -1 : this.n > 0n ? 1 : 0; }
  /** Rounded half away from zero to `dp` decimals, as a scaled BigInt (the spec's display rounding). */
  scaled(dp) {
    const s = 10n ** BigInt(dp);
    const x = (this.n < 0n ? -this.n : this.n) * s;
    const r = (2n * x + this.d) / (2n * this.d);
    return this.n < 0n ? -r : r;
  }
  /** A float, for chart geometry only; never for a printed figure. */
  get value() { return Number((this.n * 10n ** 15n) / this.d) / 1e15; }
}
const q = (n, d = 1) => new Q(BigInt(n), BigInt(d));
const ZERO = q(0);
const sum = (xs) => xs.reduce((a, x) => a.add(x), ZERO);

// ---- display (U+2212 minus, half away from zero, en-US grouping) ----------------------------------------
export const MINUS = '−';
const groupInt = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
function fixed(x, dp, group = true) {
  const v = Q.of(x).scaled(dp);
  const neg = v < 0n;
  const a = neg ? -v : v;
  const s = 10n ** BigInt(dp);
  const ip = (a / s).toString();
  const fp = dp ? '.' + (a % s).toString().padStart(dp, '0') : '';
  return { neg, zero: a === 0n, text: (group ? groupInt(ip) : ip) + fp };
}
const lead = (f, sign) => (f.neg ? MINUS : sign && !f.zero ? '+' : '');
/** Money from cents (a number of cents, or a Q of cents): usd(-275000) → "−$2,750"; dp 2 → "−$2,750.00";
 *  sign: true puts "+" on a gain ("+$867"). abs: true drops the sign ("lost $22,142"). */
export function usd(cents, { dp = 0, sign = false, abs = false } = {}) {
  let c = Q.of(cents);
  if (abs) c = c.abs();
  const f = fixed(c.div(100), dp);
  return `${lead(f, sign)}$${f.text}`;
}
/** A fraction as a percent: pct(q(-426056, 1000000)) → "−42.6%". dp 0 for margin used (whole percent). */
export function pct(frac, dp = 1, { sign = false, abs = false } = {}) {
  let x = Q.of(frac).mul(100);
  if (abs) x = x.abs();
  const f = fixed(x, dp);
  return `${lead(f, sign)}${f.text}%`;
}
/** A plain decimal: num(q(2606, 100), 2) → "26.06". */
export function num(x, dp = 2, { sign = false } = {}) {
  const f = fixed(x, dp);
  return `${lead(f, sign)}${f.text}`;
}
/** Result against planned risk, one decimal, signed, never tinted: "−0.5R". */
export const rMultiple = (x) => `${num(x, 1, { sign: true })}R`;
/** Leverage: "1.92×". */
export const times = (x, dp = 2) => `${num(x, dp)}×`;
/** Signed money as the spec writes it beside a sign: "−$2,994", "+$1,121". */
export const signedUsd = (cents, dp = 0) => usd(cents, { dp, sign: true });

// ---- dates (America/New_York; ISO instants in this file carry the ET offset) ---------------------------
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ET_PARTS = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23', weekday: 'short' });
/** Calendar parts in ET from 'YYYY-MM-DD' (a date, no time) or an ISO instant. */
export function etParts(x) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(x)) {
    const [y, m, d] = x.split('-').map(Number);
    return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), h: null, min: null };
  }
  const p = Object.fromEntries(ET_PARTS.formatToParts(new Date(x)).map((o) => [o.type, o.value]));
  return { y: +p.year, m: +p.month, d: +p.day, dow: DOW.indexOf(p.weekday), h: +p.hour, min: +p.minute };
}
const pad2 = (n) => String(n).padStart(2, '0');
/** The ET calendar date of a date or an instant, 'YYYY-MM-DD'. */
export const etDate = (x) => { const p = etParts(x); return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`; };
/** "Sep 29" */
export const fmtDate = (x) => { const p = etParts(x); return `${MON[p.m - 1]} ${p.d}`; };
/** "Tue Sep 29" (a day group's header) */
export const fmtDay = (x) => { const p = etParts(x); return `${DOW[p.dow]} ${MON[p.m - 1]} ${p.d}`; };
/** "Sep 29, 2026" */
export const fmtDateYear = (x) => { const p = etParts(x); return `${MON[p.m - 1]} ${p.d}, ${p.y}`; };
/** "2:14 PM" */
export const fmtTime = (iso) => {
  const p = etParts(iso);
  if (p.h == null) return '';
  return `${p.h % 12 || 12}:${pad2(p.min)} ${p.h < 12 ? 'AM' : 'PM'}`;
};
/** "Oct 7, 7:02 AM" */
export const fmtDateTime = (iso) => `${fmtDate(iso)}, ${fmtTime(iso)}`;
/** "Tue Sep 29, 2026 · 2:14 PM" (the entry page's meta) */
export const fmtLong = (iso) => { const p = etParts(iso); return `${DOW[p.dow]} ${MON[p.m - 1]} ${p.d}, ${p.y}${p.h == null ? '' : ` · ${fmtTime(iso)}`}`; };
const dayNo = (x) => { const p = etParts(x); return Date.UTC(p.y, p.m - 1, p.d) / 864e5; };
/** Calendar days from a to b in ET ("Carried from Sep 30 · 2 days old"). */
export const daysBetween = (a, b) => dayNo(b) - dayNo(a);
/** ET weekdays after a, up to and including b (the stale-snapshot rule counts weekdays). */
export function weekdaysBetween(a, b) {
  let n = 0;
  for (let d = dayNo(a) + 1; d <= dayNo(b); d++) { const w = new Date(d * 864e5).getUTCDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}

// =========================================================================================================
// Typed inputs
// =========================================================================================================

/** The scenario the staging demo pins: the bar reads "Demo · sample data · Oct 7, 2026". */
export const SCENARIO = { date: '2026-10-07', label: 'Oct 7, 2026', review: '2026-10-07T07:02:00-04:00' };

/** The sample's instruments. Options expire Dec 18 ’26, which the demo's chain doesn't list, so no demo page
 *  shows a second price for them. Names use the typographic apostrophe, as the spec's copy does. */
export const INSTRUMENTS = {
  NVDA: { id: 'NVDA', kind: 'stock', symbol: 'NVDA', mult: 1, name: 'NVDA', short: 'NVDA', unit: 'sh' },
  MSFT: { id: 'MSFT', kind: 'stock', symbol: 'MSFT', mult: 1, name: 'MSFT', short: 'MSFT', unit: 'sh' },
  TSLA_P440: { id: 'TSLA_P440', kind: 'option', right: 'put', symbol: 'TSLA', strike: 440, expiry: '2026-12-18', mult: 100, name: 'TSLA Dec 18 ’26 440 P', short: 'TSLA puts' },
  QQQ_P600: { id: 'QQQ_P600', kind: 'option', right: 'put', symbol: 'QQQ', strike: 600, expiry: '2026-12-18', mult: 100, name: 'QQQ Dec 18 ’26 600 P', short: 'QQQ puts' },
  SPY_P640: { id: 'SPY_P640', kind: 'option', right: 'put', symbol: 'SPY', strike: 640, expiry: '2026-12-18', mult: 100, name: 'SPY Dec 18 ’26 640 P', short: 'SPY puts', planOnly: true },
};
const HELD = ['NVDA', 'MSFT', 'TSLA_P440', 'QQQ_P600'];

/** Marks in cents. Stock marks are the demo catalog's closes for the date (libs/api/src/lib/demo/catalog/
 *  shared.ts makeScenario over nvda.seed.json and msft.seed.json; NVDA $195.20 on Aug 21 and $199.21 on Oct 6).
 *  Option marks are the spec's, authored at or above intrinsic ($0: both strikes sit below spot throughout). */
export const MARKS = Object.fromEntries([
  ['2026-08-04', 19174, 51342, 2820, null],
  ['2026-08-21', 19520, 52042, 2740, null],
  ['2026-08-28', 19550, 52103, 2690, 1320],
  ['2026-09-04', 19538, 51989, 2560, 1290],
  ['2026-09-08', 19550, 51970, 2470, 1270],
  ['2026-09-15', 19658, 52126, 2160, 1190],
  ['2026-09-18', 19758, 52336, 1980, 1080],
  ['2026-09-25', 19895, 52665, 1540, 870],
  ['2026-09-29', 19920, 52728, 1420, 790],
  ['2026-09-30', 19926, 52741, 1390, 770],
  ['2026-10-02', 19928, 52733, 1310, 720],
  ['2026-10-06', 19921, 52692, 1040, 660],
].map(([d, nvda, msft, tsla, qqq]) => [d, { NVDA: nvda, MSFT: msft, TSLA_P440: tsla, QQQ_P600: qqq }]));

/** Every trade, as a kept detail (price in cents per share or per contract). `origin`: 'import' for the three
 *  imported positions bought before the catalog's history begins; 'kept' for a detail kept from an entry's
 *  prose (the spec doesn't print whether the parser or the AI found it); 'typed' for the sale row he types
 *  on a trim (slice 1b, G6). Same-day trades precede that day's snapshot. */
export const TRADES = [
  { id: 't-nvda-imp', entry: 'e-imp-nvda', date: '2026-07-02', side: 'buy', inst: 'NVDA', qty: 160, price: 21400, origin: 'import' },
  { id: 't-msft-imp', entry: 'e-imp-msft', date: '2026-07-09', side: 'buy', inst: 'MSFT', qty: 30, price: 49800, origin: 'import' },
  { id: 't-tsla-imp', entry: 'e-imp-tsla', date: '2026-07-14', side: 'buy', inst: 'TSLA_P440', qty: 6, price: 3100, origin: 'import' },
  { id: 't-qqq-enter', entry: 'e-aug26', date: '2026-08-26', side: 'buy', inst: 'QQQ_P600', qty: 4, price: 1360, origin: 'kept' },
  { id: 't-nvda-add', entry: 'e-aug28', date: '2026-08-28', side: 'buy', inst: 'NVDA', qty: 60, price: 19550, origin: 'kept' },
  { id: 't-tsla-add1', entry: 'e-sep04', date: '2026-09-04', side: 'buy', inst: 'TSLA_P440', qty: 3, price: 2560, origin: 'kept' },
  { id: 't-tsla-add2', entry: 'e-sep11', date: '2026-09-11', side: 'buy', inst: 'TSLA_P440', qty: 3, price: 2290, origin: 'kept' },
  { id: 't-tsla-add3', entry: 'e-sep18', date: '2026-09-18', side: 'buy', inst: 'TSLA_P440', qty: 3, price: 1980, origin: 'kept' },
  { id: 't-nvda-trim', entry: 'e-sep30-trim', date: '2026-09-30', side: 'sell', inst: 'NVDA', qty: 60, price: 19926, origin: 'typed' },
  { id: 't-tsla-trim', entry: 'e-oct02', date: '2026-10-02', side: 'sell', inst: 'TSLA_P440', qty: 5, price: 1310, origin: 'typed' },
];

/** Only the QQQ entry names an exit ("I’m wrong if…", in the instrument's own price: a put's premium). No entry
 *  names one for NVDA, MSFT or the TSLA puts, and none ticks "No exit set". */
export const EXITS = [{ entry: 'e-aug26', inst: 'QQQ_P600', price: 800 }];

/** "How sure are you this works out?" The spec prints one value (QQQ, 70, resolved 0 on Sep 29) and says the
 *  other three stated confidences are open because a trim isn't a close in full; it prints neither their
 *  values nor their entries, so they are counted, never drawn. */
export const CONFIDENCES = {
  printed: [{ entry: 'e-aug26', inst: 'QQQ_P600', value: 70 }],
  unprinted: 3,
  note: 'Three more on Entered or Added entries whose positions were trimmed, never closed in full; values and entries not printed.',
};

/** Snapshots as typed. Account value, margin loan and maintenance requirement in cents (null = `not recorded`);
 *  cash is $0 throughout (the loan absorbs it). `asOfTime` is ET; null where the spec prints none (the
 *  snapshot then sorts at 4:00 PM ET, which moves nothing: no money falls on those days). The Aug 4
 *  statement's loan was typed $11,890 and corrected on Aug 22 (CORRECTIONS); `marginLoan` is the typed value. */
const SNAPSHOT_INPUTS = [
  { id: 's-aug04', entry: 'e-aug04', asOf: '2026-08-04', asOfTime: '16:00', source: 'statement', accountValue: 5102100, marginLoan: 1189000, maint: null },
  { id: 's-aug21', entry: 'e-aug21', asOf: '2026-08-21', asOfTime: null, source: 'broker', accountValue: 5125100, marginLoan: 1203360, maint: null },
  { id: 's-aug28', entry: 'e-aug28', asOf: '2026-08-28', asOfTime: null, source: 'broker', accountValue: 5083500, marginLoan: 2922590, maint: null },
  { id: 's-sep04', entry: 'e-sep04', asOf: '2026-09-04', asOfTime: null, source: 'broker', accountValue: 4982100, marginLoan: 3695930, maint: null },
  { id: 's-sep08', entry: 'e-sep08', asOf: '2026-09-08', asOfTime: null, source: 'broker', accountValue: 4891300, marginLoan: 3699800, maint: null },
  { id: 's-sep15', entry: 'e-sep15', asOf: '2026-09-15', asOfTime: null, source: 'broker', accountValue: 4562900, marginLoan: 4393640, maint: null },
  { id: 's-sep18', entry: 'e-sep18', asOf: '2026-09-18', asOfTime: null, source: 'broker', accountValue: 4327700, marginLoan: 4991140, maint: null },
  { id: 's-sep25', entry: 'e-sep25', asOf: '2026-09-25', asOfTime: null, source: 'broker', accountValue: 3614600, marginLoan: 5000250, maint: null },
  { id: 's-sep29', entry: 'e-sep29', asOf: '2026-09-29', asOfTime: '14:14', source: 'broker', accountValue: 3404700, marginLoan: 5005540, maint: 3679700 },
  { id: 's-sep30', entry: 'e-sep30-trim', asOf: '2026-09-30', asOfTime: '15:40', source: 'broker', accountValue: 3602100, marginLoan: 3561290, maint: 3490000 },
  { id: 's-oct02', entry: 'e-oct02', asOf: '2026-10-02', asOfTime: null, source: 'broker', accountValue: 3460300, marginLoan: 2908170, maint: null },
  { id: 's-oct06', entry: 'e-oct06', asOf: '2026-10-06', asOfTime: null, source: 'broker', accountValue: 3160900, marginLoan: 2911220, maint: null },
];
/** The source segment's words. */
export const SOURCE_WORD = { broker: 'Broker screen', statement: 'Statement', memory: 'Memory' };

/** The one money-in entry: $2,500 at 10:05 AM on Sep 30, before that day's 3:40 PM snapshot. */
export const MONEY = [{ id: 'm-sep30', entry: 'e-sep30-money', dir: 'in', amount: 250000, at: '2026-09-30T10:05:00-04:00' }];

/** The margin call, typed on the Sep 29 entry: $2,750, due Oct 1, 4:00 PM. */
export const CALL = { entry: 'e-sep29', snapshot: 's-sep29', amount: 275000, dueBy: '2026-10-01T16:00:00-04:00' };

/** The one correction: the recalled Aug 4 statement's loan, corrected on Aug 22 (the corrected figure is the one
 *  that makes positions × marks − loan equal the typed account value). */
export const CORRECTIONS = [{ id: 'c-aug22', snapshot: 's-aug04', field: 'marginLoan', label: 'Margin loan', from: 1189000, to: 1198000, on: '2026-08-22', reason: 'the statement says 11,980' }];

// ---- entries ----------------------------------------------------------------------------------------------
/** The kind chips' words; `null` is an entry with no kind (kinds are optional). */
export const KIND_WORD = { entered: 'Entered', added: 'Added', trimmed: 'Trimmed', closed: 'Closed', margin_call: 'Margin call', money: 'Money in or out', plan: 'Plan a trade', thinking: 'Just thinking', imported: 'Imported' };
export const ANSWER_WORD = { yes: 'Yes', no: 'No', doesnt_apply: 'Doesn’t apply', not_answered: 'Not answered' };
export const LABEL_WORD = { sound: 'Sound', mixed: 'Mixed', poor: 'Poor' };
export const CLOSED_BY_WORD = { me: 'Me', broker: 'Broker (liquidation)', expiry: 'Expiry', assignment: 'Assignment' };

const E = (id, o) => ({ id, described: true, kind: null, about: null, writtenAt: null, cls: 'at_time', source: 'typed', tickers: [], body: null, spans: [], snapshot: null, trade: null, ...o });
/** The 34 entries (26 written at the time, 5 recalled, 3 imported). `described`: true when the spec describes the
 *  entry; 'snapshot' when only its snapshot is known (a Broker-screen snapshot is typed on an entry written that
 *  day, about today); false for the members of the spec's counts it never describes. `body` is his whole text
 *  where the spec quotes it whole; `spans` are exact substrings it quotes from a body it doesn't print;
 *  `versionOf` is wording the spec says the body carries "a version of" (never quote it as his exact words). */
export const ENTRIES = [
  // ---- imported (3): bought before the catalog's history begins (Jul 16); written date not printed
  E('e-imp-nvda', { cls: 'imported', kind: 'imported', source: 'paste', about: '2026-07-02', tickers: ['NVDA'], trade: 't-nvda-imp' }),
  E('e-imp-msft', { cls: 'imported', kind: 'imported', source: 'paste', about: '2026-07-09', tickers: ['MSFT'], trade: 't-msft-imp' }),
  E('e-imp-tsla', { cls: 'imported', kind: 'imported', source: 'paste', about: '2026-07-14', tickers: ['TSLA'], trade: 't-tsla-imp' }),
  // ---- recalled (1 of 5 described): the Aug 4 statement, written Aug 21
  E('e-aug04', { cls: 'recalled', writtenAt: '2026-08-21', about: '2026-08-04', snapshot: 's-aug04', corrected: 'c-aug22' }),
  // ---- written at the time (16 of 26 described)
  E('e-aug21', { described: 'snapshot', writtenAt: '2026-08-21', about: '2026-08-21', snapshot: 's-aug21', firstRun: true }),
  E('e-aug26', { kind: 'entered', writtenAt: '2026-08-26', about: '2026-08-26', tickers: ['QQQ'], trade: 't-qqq-enter', exit: 800, confidence: 70, revisitDue: true }),
  E('e-aug28', { kind: 'added', writtenAt: '2026-08-28', about: '2026-08-28', tickers: ['NVDA'], trade: 't-nvda-add', snapshot: 's-aug28' }),
  E('e-sep04', { kind: 'added', writtenAt: '2026-09-04', about: '2026-09-04', tickers: ['TSLA'], trade: 't-tsla-add1', snapshot: 's-sep04', versionOf: ['it has to roll over'] }),
  E('e-sep08', { described: 'snapshot', writtenAt: '2026-09-08', about: '2026-09-08', snapshot: 's-sep08' }),
  E('e-sep11', { kind: 'added', writtenAt: '2026-09-11', about: '2026-09-11', tickers: ['TSLA'], trade: 't-tsla-add2', versionOf: ['it has to roll over'] }),
  E('e-sep15', { described: 'snapshot', writtenAt: '2026-09-15', about: '2026-09-15', snapshot: 's-sep15' }),
  E('e-sep18', { kind: 'added', writtenAt: '2026-09-18', about: '2026-09-18', tickers: ['TSLA'], trade: 't-tsla-add3', snapshot: 's-sep18', spans: ['added 3 more TSLA 440 puts at 19.80', 'around 55%'], versionOf: ['it has to roll over'] }),
  E('e-sep25', { described: 'snapshot', writtenAt: '2026-09-25', about: '2026-09-25', snapshot: 's-sep25' }),
  E('e-sep29', { kind: 'margin_call', writtenAt: '2026-09-29T14:14:00-04:00', about: '2026-09-29', tickers: ['NVDA'], snapshot: 's-sep29', body: 'Broker raised the NVDA requirement before earnings. I don’t want to sell NVDA below what I paid.' }),
  // The money's time defaults to the save time, so the entry was saved at 10:05 AM (Composer → Money in or out).
  E('e-sep30-money', { kind: 'money', writtenAt: '2026-09-30T10:05:00-04:00', about: '2026-09-30', money: 'm-sep30' }),
  // Its snapshot is the 3:40 PM numbers; the call is open until Oct 1, 4:00 PM, so no decision label is asked.
  E('e-sep30-trim', { kind: 'trimmed', writtenAt: '2026-09-30T15:40:00-04:00', about: '2026-09-30', tickers: ['NVDA'], trade: 't-nvda-trim', snapshot: 's-sep30', closedBy: 'me', label: null, body: 'Sold 60 NVDA at 199.26 to meet the call' }),
  E('e-oct01-plan', { kind: 'plan', writtenAt: '2026-10-01', about: '2026-10-01', tickers: ['TSLA'], plan: 'p-oct01', namedPrice: 1310 }),
  E('e-oct02', { kind: 'trimmed', writtenAt: '2026-10-02', about: '2026-10-02', tickers: ['TSLA'], trade: 't-tsla-trim', snapshot: 's-oct02', closedBy: 'me', label: 'sound', carriedFrom: 's-sep30', body: 'Sold 5 of the TSLA puts at 13.10. Felt relief more than conviction.' }),
  E('e-oct05-plan', { kind: 'plan', writtenAt: '2026-10-05', about: '2026-10-05', tickers: ['SPY'], plan: 'p-oct05', body: 'Buying 2 SPY Dec 18 ’26 640 P at 6.40 as a hedge. I’m wrong if SPY closes above 705.' }),
  E('e-oct06', { described: 'snapshot', writtenAt: '2026-10-06', about: '2026-10-06', snapshot: 's-oct06' }),
  // ---- undescribed members of the spec's counts: 10 at the time (one written in the Oct 7 review's window),
  // 4 recalled. Kinds outside every counted row (no Entered, Added, Trimmed, Closed, plan, call or money).
  ...Array.from({ length: 14 }, (_, i) => E(`u${String(i + 1).padStart(2, '0')}`, { described: false, cls: i < 10 ? 'at_time' : 'recalled', window: i === 0 ? 'review' : 'older' })),
];
export const ENTRY = Object.fromEntries(ENTRIES.map((e) => [e.id, e]));

/** Later notes: 5 in the seed. Two are described: his note on the call, and the note "It’s missing context"
 *  opened on Oct 6 (What’s sent: "Later notes marked as context: 1"; the finding drawer: "You marked this
 *  “missing context” on Oct 6."), whose entry and words the spec doesn't print. */
export const LATER_NOTES = [
  { id: 'n-sep30', entry: 'e-sep29', at: '2026-09-30T18:40:00-04:00', body: 'Met on Sep 30: sold 60 NVDA, put in $2,500.', context: false, described: true },
  { id: 'n-oct06', entry: null, at: '2026-10-06', body: null, context: true, described: 'partly' },
  { id: 'n-u1', described: false }, { id: 'n-u2', described: false }, { id: 'n-u3', described: false },
];

/** His suspicions (slice 3 seed), each mapped to its detector row. */
export const SUSPICIONS = [
  { text: 'I add to losers', row: 1 },
  { text: 'Too much margin', row: 7 },
  { text: 'I don’t sell when I said I would', row: 3 },
];

// ---- rules ------------------------------------------------------------------------------------------------
/** The sample's rulebook. Numbers follow the order rules became active. */
export const RULES = [
  {
    id: 'R1', number: 1, status: 'retired', origin: 'written by you', firstRun: true,
    versions: [{ v: 1, from: '2026-08-21', wording: 'Before I add to a position, I write why in the journal first.', check: 'Did I write why first?', limit: null }],
    why: 'So I can see later what I was thinking.',
    retired: { on: '2026-09-24', reason: 'I add from my phone and can’t always write first.' },
  },
  {
    id: 'R2', number: 2, status: 'active', origin: 'drafted by the Sep 28 review', originFinding: 'Added 15% or more below your average cost', originReview: 'sep28',
    versions: [
      { v: 1, from: '2026-09-30', wording: 'When a position is 15% or more below my average cost, I don’t add to it.', note: 'v1 adopted Sep 30: drafted by the Sep 28 review from the finding “Added 15% or more below your average cost”; the draft read “…I don’t add to it.”' },
      { v: 2, from: '2026-10-03', wording: 'When a position is 15% or more below my average cost, I don’t add to it the same day.', note: 'v2 Oct 3: you added “the same day”.' },
    ],
    check: 'Is this position less than 15% below my average cost?',
    limit: { metric: 'position % below average cost', cmp: 'at or above', value: 15, unit: '', source: 'threshold', note: 'Convexa’s pattern threshold, not from your entries', row: 1 },
    why: 'Three TSLA put adds, each lower.',
  },
  {
    id: 'R3', number: 3, status: 'active', origin: 'written by you', writtenAfter: 'the call',
    versions: [{ v: 1, from: '2026-09-30', wording: 'When margin used is above 50% of account value, I don’t open or add to a position.' }],
    check: 'Is margin used at or below 50% of account value?',
    limit: { metric: 'margin used', cmp: 'above', value: 50, unit: '%', source: 'his', note: 'his figure' },
    why: '147% turned a bad month into a margin call.',
  },
];
export const RULE = Object.fromEntries(RULES.map((r) => [r.id, r]));
/** The two drafts from the Oct 7 review: unnumbered, limit `not set`, no Check by asking and no why yet. */
export const DRAFTS = [
  { id: 'd-exit', review: 'oct7', finding: 'f-row2', wording: 'Every Entered or Added entry gets an “I’m wrong if…” line before I place it.', check: null, limit: null },
  { id: 'd-earnings', review: 'oct7', finding: 'f-row7', wording: 'Before an earnings date for a position I hold on margin, I check my broker’s margin requirement for it.', check: null, limit: null, drawnFrom: 'e-sep29' },
];

/** Plan answers. Oct 5: R3 No with his reason, R2 Doesn’t apply. Oct 1 (the TSLA trim at $13.10): R3 Doesn’t apply,
 *  so R3 reads "Asked in 2 plans · Yes 0 · No 1 · Doesn’t apply 1 · Not answered 0". The spec doesn't print R2's
 *  Oct 1 answer; Doesn’t apply is the only one consistent with "1 rule answered No" that is also true (the puts were
 *  46.7% below his average cost, so Yes would be false and No would make two), so it is marked derived. */
export const PLANS = [
  {
    id: 'p-oct01', entry: 'e-oct01-plan', at: '2026-10-01', inst: 'TSLA_P440', action: 'sell', qty: 5, price: 1310,
    answers: [{ rule: 'R2', v: 1, answer: 'doesnt_apply', derived: true }, { rule: 'R3', v: 1, answer: 'doesnt_apply' }],
  },
  {
    id: 'p-oct05', entry: 'e-oct05-plan', at: '2026-10-05', inst: 'SPY_P640', action: 'buy', qty: 2, price: 640,
    answers: [{ rule: 'R2', v: 2, answer: 'doesnt_apply' }, { rule: 'R3', v: 1, answer: 'no', reason: 'It’s a hedge; it should lower the risk.', worthIt: null }],
  },
];
export const PLAN = Object.fromEntries(PLANS.map((p) => [p.id, p]));

// =========================================================================================================
// Computed facts
// =========================================================================================================
const isoOf = (date, time) => `${date}T${time ?? '16:00'}:00-04:00`;
const corrected = (s) => CORRECTIONS.filter((c) => c.snapshot === s.id).reduce((v, c) => ({ ...v, [c.field]: c.to }), {});

/** Position state replayed from the trades up to (and including) a date: quantity, average cost (Q cents per
 *  unit), realised P/L against average cost (Q cents). Sales leave the average unchanged. */
export function positionAt(inst, date, { before = false } = {}) {
  let qty = 0, cost = ZERO, realised = ZERO;
  const mult = INSTRUMENTS[inst].mult;
  for (const t of TRADES) {
    if (t.inst !== inst) continue;
    if (before ? t.date >= date : t.date > date) continue;
    if (t.side === 'buy') {
      cost = cost.add(t.qty * t.price);
      qty += t.qty;
    } else {
      const avg = cost.div(qty);
      realised = realised.add(q(t.price).sub(avg).mul(t.qty * mult));
      cost = cost.sub(avg.mul(t.qty));
      qty -= t.qty;
    }
  }
  return { inst, qty, avg: qty ? cost.div(qty) : null, realised };
}
/** The average cost just before a trade (row 1's "average cost just before it"). */
export const avgBefore = (t) => positionAt(t.inst, t.date, { before: true }).avg;

// ---- snapshots, in the spec's order (as_of, then written_at) ----------------------------------------------
const writtenOf = (s) => ENTRY[s.entry].writtenAt;
const ordered = [...SNAPSHOT_INPUTS].sort((a, b) => isoOf(a.asOf, a.asOfTime).localeCompare(isoOf(b.asOf, b.asOfTime)) || String(writtenOf(a)).localeCompare(String(writtenOf(b))));
const moneyBetween = (afterIso, uptoIso) => sum(MONEY.filter((m) => (afterIso == null || m.at > afterIso) && m.at <= uptoIso).map((m) => (m.dir === 'in' ? m.amount : -m.amount)));

/** Each snapshot with its facts. Values are cents (numbers as typed, Q where computed); fractions are Q.
 *  `index`, `below`, `alone` follow the chain; `alone` is null at the chain's first snapshot, as the worked
 *  example prints "—" there. */
export const SNAPSHOTS = (() => {
  const out = [];
  let prev = null, idx = q(1), high = null;
  for (const [k, s] of ordered.entries()) {
    const fix = corrected(s);
    const loan = fix.marginLoan ?? s.marginLoan;
    const at = isoOf(s.asOf, s.asOfTime);
    const marks = MARKS[s.asOf];
    const positions = HELD.map((inst) => ({ inst, qty: positionAt(inst, s.asOf).qty, mark: marks[inst] })).filter((p) => p.qty > 0);
    const posValue = sum(positions.map((p) => q(p.qty * p.mark * INSTRUMENTS[p.inst].mult)));
    const V = q(s.accountValue);
    const F = prev ? moneyBetween(prev.at, at) : ZERO;
    if (prev) idx = idx.mul(V.sub(F)).div(prev.accountValue);
    if (!high || idx.cmp(high.index) > 0) high = { k, id: s.id, index: idx, accountValue: s.accountValue, asOf: s.asOf, at };
    const row = {
      ...s, k, at, writtenAt: writtenOf(s), recalled: ENTRY[s.entry].cls !== 'at_time',
      cash: 0, marginLoanTyped: s.marginLoan, marginLoan: loan, corrected: fix.marginLoan != null,
      positions: positions.map((p) => ({ ...p, value: q(p.qty * p.mark * INSTRUMENTS[p.inst].mult), avg: positionAt(p.inst, s.asOf).avg })),
      positionValue: posValue,
      equityCheck: posValue.sub(loan).cmp(V) === 0,
      marginUsed: q(loan).div(V),
      excessLiquidity: s.maint == null ? null : q(s.accountValue - s.maint),
      leverage: posValue.div(V),
      loanToPositionValue: q(loan).div(posValue),
      shares: Object.fromEntries(positions.map((p) => [p.inst, q(p.qty * p.mark * INSTRUMENTS[p.inst].mult).div(posValue)])),
      moneyIn: F,
      change: prev ? { usd: V.sub(prev.accountValue).sub(F), pct: idx.div(prev.index).sub(1) } : null,
      index: idx,
      high: high.id,
      below: idx.div(high.index).sub(1),
      alone: k === 0 ? null : V.div(high.accountValue).sub(1),
      lostSinceHigh: q(high.accountValue).sub(V).add(moneyBetween(high.at, at)),
    };
    out.push(row);
    prev = row;
  }
  return out;
})();
export const SNAPSHOT = Object.fromEntries(SNAPSHOTS.map((s) => [s.id, s]));
export const LATEST = SNAPSHOTS[SNAPSHOTS.length - 1];
/** The recorded high: "$51,251 · Aug 21 · written at the time". */
export const HIGH = SNAPSHOT[LATEST.high];
/** The latest snapshot whose as_of is strictly before an instant (what a plan, a check or a review reads). */
export const snapshotBefore = (iso) => [...SNAPSHOTS].reverse().find((s) => s.at < iso) ?? null;
/** The latest snapshot on or before an instant. */
export const snapshotAt = (iso) => [...SNAPSHOTS].reverse().find((s) => s.at <= iso) ?? null;

// ---- trims: P/L against average cost and R (G6) ---------------------------------------------------------------
/** Planned risk: a long option's premium paid for the quantity at the average cost; a stock's loss if its named
 *  exit is hit (no stock exit is named in the sample, so a stock reads `not set`). */
function plannedRisk(inst, qty, avg) {
  const I = INSTRUMENTS[inst];
  if (I.kind === 'option' && I.right) return avg.mul(qty * I.mult);
  const exit = EXITS.find((x) => x.inst === inst);
  if (!exit) return null;
  return avg.sub(exit.price).mul(qty * I.mult);
}
/** Each typed sale, with its P/L against average cost and R (all or nothing). */
export const TRIMS = TRADES.filter((t) => t.side === 'sell').map((t) => {
  const avg = avgBefore(t);
  const I = INSTRUMENTS[t.inst];
  const pl = q(t.price).sub(avg).mul(t.qty * I.mult);
  const risk = plannedRisk(t.inst, t.qty, avg);
  const R = risk == null ? { state: 'not set' } : risk.sign() <= 0 ? { state: '—' } : { state: 'value', value: pl.div(risk) };
  const e = ENTRY[t.entry];
  return { trade: t.id, entry: t.entry, inst: t.inst, qty: t.qty, price: t.price, avg, pl, plannedRisk: risk, R, label: e.label ?? null, closedBy: e.closedBy };
});
export const TRIM = Object.fromEntries(TRIMS.map((t) => [t.entry, t]));

/** P/L against average cost at a snapshot, realised plus open, all or nothing (the sign a finding's label follows). */
export function resultAt(inst, snapshotId = LATEST.id) {
  const s = SNAPSHOT[snapshotId];
  const p = positionAt(inst, s.asOf);
  const mark = MARKS[s.asOf][inst];
  const open = p.qty ? q(mark).sub(p.avg).mul(p.qty * INSTRUMENTS[inst].mult) : ZERO;
  return { inst, realised: p.realised, open, total: p.realised.add(open) };
}

// ---- where the money went since the high -----------------------------------------------------------------------
/** Per position since the recorded high: value now + proceeds of sales − cost of buys − value at the high; the
 *  remainder (interest, fees, untyped trades) is "Not explained by your typed marks". Shares are of the dollars
 *  lost; a gain's share is `—`. */
export function moneyWent(snapshotId = LATEST.id) {
  const now = SNAPSHOT[snapshotId], hi = SNAPSHOT[now.high];
  const valueOf = (s, inst) => { const p = s.positions.find((x) => x.inst === inst); return p ? p.value : ZERO; };
  const rows = HELD.map((inst) => {
    const ts = TRADES.filter((t) => t.inst === inst && t.date > hi.asOf && t.date <= now.asOf);
    const flow = sum(ts.map((t) => q(t.qty * t.price * INSTRUMENTS[inst].mult * (t.side === 'sell' ? 1 : -1))));
    return { inst, label: INSTRUMENTS[inst].short, usd: valueOf(now, inst).add(flow).sub(valueOf(hi, inst)) };
  }).filter((r) => r.usd.sign() !== 0 || valueOf(now, r.inst).sign() !== 0);
  const lost = now.lostSinceHigh;
  const total = lost.neg();
  const remainder = total.sub(sum(rows.map((r) => r.usd)));
  const share = (x) => (x.sign() < 0 && lost.sign() > 0 ? x.neg().div(lost) : null);
  return {
    since: hi.asOf, at: now.asOf, lost, total,
    // losses first, largest first; then gains, largest first (TSLA puts · QQQ puts · NVDA · MSFT)
    rows: rows.sort((a, b) => (a.usd.sign() < 0) !== (b.usd.sign() < 0) ? (a.usd.sign() < 0 ? -1 : 1) : a.usd.sign() < 0 ? a.usd.cmp(b.usd) : b.usd.cmp(a.usd)).map((r) => ({ ...r, share: share(r.usd) })),
    remainder: { label: 'Not explained by your typed marks', usd: remainder, share: share(remainder) },
  };
}
export const MONEY_WENT = moneyWent();

// ---- the one event: the margin call ------------------------------------------------------------------------------
/** From the last snapshot before the call's day to the first snapshot after the call with excess liquidity at or
 *  above $0 (the call met): dollars net of money in, the chained percent, and its share of the dollars lost. */
export const EVENT = (() => {
  const callAt = ENTRY[CALL.entry].writtenAt;
  const before = [...SNAPSHOTS].reverse().find((s) => s.asOf < etDate(callAt));
  const after = SNAPSHOTS.find((s) => s.at > callAt && s.excessLiquidity != null && s.excessLiquidity.sign() >= 0);
  const usdQ = q(after.accountValue).sub(before.accountValue).sub(moneyBetween(before.at, after.at));
  return { kind: 'margin_call', call: CALL.amount, callDate: etDate(callAt), from: before.id, to: after.id, moneyIn: moneyBetween(before.at, after.at), usd: usdQ, pct: after.index.div(before.index).sub(1), share: usdQ.neg().div(LATEST.lostSinceHigh) };
})();

// ---- the Path (three small multiples on one date axis, with the event rail) ----------------------------------------
/** One row per snapshot, for the chart and its table twin (date · source · account value · margin loan · margin used
 *  · below the high · money in or out · event). Floats are for geometry; print from the Q fields. */
export const PATH = SNAPSHOTS.map((s) => ({
  id: s.id, date: s.asOf, label: fmtDate(s.asOf), source: SOURCE_WORD[s.source], hollow: s.recalled,
  accountValue: s.accountValue, marginLoan: s.marginLoan, marginUsed: s.marginUsed, below: s.below, alone: s.alone,
  moneyIn: s.moneyIn, v: { accountValue: s.accountValue / 100, marginUsed: s.marginUsed.value * 100, below: s.below.value * 100 },
}));
/** The event rail: the call (warning glyph, "Call $2,750"), money ("+$2,500"), trims and closes (a tick with the
 *  kind's initial), and a notes lane of entry ticks (every described entry with a written date). */
export const RAIL = [
  { date: EVENT.callDate, kind: 'call', text: `Call ${usd(CALL.amount)}` },
  ...MONEY.map((m) => ({ date: etDate(m.at), kind: 'money', text: `${m.dir === 'in' ? '+' : MINUS}${usd(m.amount)}` })),
  ...TRIMS.map((t) => ({ date: TRADES.find((x) => x.id === t.trade).date, kind: 'trim', text: 'T', entry: t.entry })),
  ...ENTRIES.filter((e) => e.described && e.writtenAt && e.cls === 'at_time').map((e) => ({ date: etDate(e.writtenAt), kind: 'note', entry: e.id })),
];

// ---- rule readings and checks ---------------------------------------------------------------------------------------
/** A limit's reading against a snapshot: { value: Q (a fraction for %), cmp, limit, above: bool }. R3 reads margin
 *  used; R2's metric needs an add's price and has no reading at plan time. */
export function reading(ruleId, snapshotId) {
  const r = RULE[ruleId];
  if (!r.limit || r.limit.metric !== 'margin used') return null;
  const s = SNAPSHOT[snapshotId];
  const above = s.marginUsed.cmp(q(r.limit.value, 100)) > 0;
  return { rule: ruleId, metric: 'Margin used', value: s.marginUsed, limit: r.limit.value, above, snapshot: s.id, asOf: s.asOf };
}
/** Plan-time readings and projections: the snapshot before the plan, its age, and "If the $1,280 is borrowed:
 *  margin used 84% → 88%" (no maintenance-rate assumption: value unchanged, the loan grows by the cost). */
export const PLAN_READINGS = Object.fromEntries(PLANS.map((p) => {
  const s = snapshotBefore(isoOf(p.at, '09:30'));
  const cost = p.qty * p.price * INSTRUMENTS[p.inst].mult;
  const borrow = p.action === 'buy' ? { usd: cost, before: s.marginUsed, after: q(s.marginLoan + cost).div(s.accountValue) } : null;
  return [p.id, { snapshot: s.id, ageDays: daysBetween(s.asOf, p.at), weekdays: weekdaysBetween(s.asOf, p.at), r3: reading('R3', s.id), borrow }];
}));
/** His answers per rule, counted (answered by you); computed checks are apart and, in the sample, none yet: no
 *  Entered or Added entry follows Sep 30, when R2 and R3 became active. */
export const RULE_COUNTS = Object.fromEntries(RULES.map((r) => {
  const as = PLANS.flatMap((p) => p.answers.filter((a) => a.rule === r.id));
  const c = (w) => as.filter((a) => a.answer === w).length;
  return [r.id, { asked: as.length, yes: c('yes'), no: c('no'), doesnt_apply: c('doesnt_apply'), not_answered: c('not_answered'), computed: null, afterYes: c('yes'), afterNo: c('no') }];
}));

// ---- the fixed detector table ---------------------------------------------------------------------------------------
export const DETECTOR_ROWS = [
  { row: 1, key: 'add_below_cost', about: 'decided', title: 'Added 15% or more below your average cost', over: '“Added” entries written at the time, with a kept price and a cost basis', counted: 'the add’s price is 15% or more below the position’s average cost just before it' },
  { row: 2, key: 'no_exit', about: 'decided', title: 'Entered or added with no exit named', over: '“Entered” and “Added” entries written at the time', counted: 'no kept exit price and “No exit set” not ticked either' },
  { row: 3, key: 'exit_passed', about: 'decided', title: 'Exit named, then passed while still held', over: 'positions with a kept exit price', counted: 'a later snapshot, with the position still held, shows a mark at or below that exit' },
  { row: 4, key: 'no_then_done', about: 'decided', title: 'Plan answered No on a rule, then carried out', over: 'plans with a No answer', counted: 'a kept link from a later Entered, Added, Trimmed or Closed entry to that plan' },
  { row: 5, key: 'new_after_loss', about: 'decided', title: 'New position the same day as a losing close', over: 'losing closes', counted: 'an Entered entry written the same ET day' },
  { row: 6, key: 'larger_after_win', about: 'decided', title: 'Larger than your usual entry within 5 weekdays of a winning close', over: 'winning closes', counted: 'an Entered or Added entry within 5 weekdays after it, larger than usual' },
  { row: 7, key: 'margin_high', about: 'happened', title: 'Margin used at a new high', over: 'steps between snapshots that both have margin used', counted: 'the later snapshot’s margin used is above every earlier one' },
  { row: 8, key: 'concentration', about: 'happened', title: 'One position over 40% of position value', over: 'snapshots with every position marked', counted: 'one position’s share is above 40%' },
  { row: 9, key: 'words_vs_numbers', about: 'decided', title: 'A figure in your words differs from the computed one by more than 1 point', over: 'figures you wrote that match a computed fact by name', counted: 'the difference is more than 1 point' },
  { row: 10, key: 'brier', about: 'decided', title: 'Your stated confidence against what happened (Brier score)', over: 'stated confidences that have resolved', counted: '— (a score, from 20 resolved)' },
];
export const MEMORY_ROW = { row: null, key: 'from_memory', about: null, title: 'Written from memory (not a pattern)', over: 'all entries', counted: 'recalled' };
/** Row 9 is printed, not derivable: the spec names one of its three figures (Sep 18, "around 55%"). */
const ROW9 = { oct7: { k: 1, n: 3 }, cases: [{ entry: 'e-sep18', words: 'around 55%', computed: ['margin used 115%', 'loan to position value 53.6%'] }] };

/** Code's counts at a review's cutoff, from the described entries (row 9 as printed at Oct 7; null where the spec
 *  gives no way to count). Each row: { k, n, text, building, cases, uncounted }. */
export function detectors(cutoffIso) {
  const at = ENTRIES.filter((e) => e.described && e.cls === 'at_time' && e.writtenAt && isoOf(etDate(e.writtenAt), e.writtenAt.length > 10 ? e.writtenAt.slice(11, 16) : '12:00') < cutoffIso);
  const snaps = SNAPSHOTS.filter((s) => s.at < cutoffIso);
  const tradeOf = (e) => TRADES.find((t) => t.id === e.trade);
  const rows = {};
  // 1
  const adds = at.filter((e) => e.kind === 'added' && tradeOf(e) && avgBefore(tradeOf(e)));
  const addCase = (e) => { const t = tradeOf(e); const avg = avgBefore(t); return { entry: e.id, inst: t.inst, date: t.date, price: t.price, avg, below: avg.sub(t.price).div(avg) }; };
  const r1 = adds.map(addCase);
  rows[1] = { cases: r1.filter((c) => c.below.cmp(q(15, 100)) >= 0), uncounted: r1.filter((c) => c.below.cmp(q(15, 100)) < 0) };
  // 2
  const r2 = at.filter((e) => ['entered', 'added'].includes(e.kind));
  rows[2] = { cases: r2.filter((e) => e.exit == null && !e.noExit).map((e) => ({ entry: e.id, inst: tradeOf(e).inst, date: etDate(e.writtenAt) })), uncounted: r2.filter((e) => e.exit != null || e.noExit).map((e) => ({ entry: e.id, inst: tradeOf(e).inst, date: etDate(e.writtenAt) })) };
  // 3
  const r3 = at.filter((e) => e.exit != null).map((e) => {
    const t = tradeOf(e);
    const pass = snaps.find((s) => s.asOf > etDate(e.writtenAt) && positionAt(t.inst, s.asOf).qty > 0 && MARKS[s.asOf][t.inst] != null && MARKS[s.asOf][t.inst] <= e.exit);
    return { entry: e.id, inst: t.inst, exit: e.exit, pass: pass ? { snapshot: pass.id, date: pass.asOf, mark: MARKS[pass.asOf][t.inst] } : null };
  });
  rows[3] = { cases: r3.filter((c) => c.pass), uncounted: r3.filter((c) => !c.pass) };
  // 4
  const plansNo = PLANS.filter((p) => at.some((e) => e.plan === p.id) && p.answers.some((a) => a.answer === 'no'));
  rows[4] = { cases: plansNo.filter((p) => p.carriedOut), uncounted: plansNo.filter((p) => !p.carriedOut).map((p) => ({ plan: p.id, entry: p.entry })) };
  // 5 and 6
  const closes = at.filter((e) => ['trimmed', 'closed'].includes(e.kind) && TRIM[e.id]).map((e) => ({ entry: e.id, date: etDate(e.writtenAt), pl: TRIM[e.id].pl }));
  const losing = closes.filter((c) => c.pl.sign() < 0), winning = closes.filter((c) => c.pl.sign() > 0);
  rows[5] = { cases: losing.filter((c) => at.some((e) => e.kind === 'entered' && etDate(e.writtenAt) === c.date)), uncounted: losing.filter((c) => !at.some((e) => e.kind === 'entered' && etDate(e.writtenAt) === c.date)) };
  rows[6] = { cases: [], uncounted: [], none: winning.length === 0 };
  // 7
  const steps = snaps.slice(1).map((s, i) => ({ snapshot: s.id, from: snaps[i].id, newHigh: snaps.slice(0, i + 1).every((p) => s.marginUsed.cmp(p.marginUsed) > 0) }));
  rows[7] = { cases: steps.filter((x) => x.newHigh), uncounted: steps.filter((x) => !x.newHigh) };
  // 8
  const conc = snaps.map((s) => { const top = Object.entries(s.shares).sort((a, b) => b[1].cmp(a[1]))[0]; return { snapshot: s.id, inst: top[0], share: top[1], over: top[1].cmp(q(40, 100)) > 0 }; });
  rows[8] = { cases: conc.filter((c) => c.over), uncounted: conc.filter((c) => !c.over) };
  // 9 (printed at Oct 7 only)
  rows[9] = cutoffIso === SCENARIO.review ? { k: ROW9.oct7.k, n: ROW9.oct7.n, cases: ROW9.cases, uncounted: [], printed: true } : { k: null, n: null, cases: [], uncounted: [], unknown: true };
  // 10: a stated confidence resolves 1 on a close in full at a gain, 0 on one at a loss or when row 3's pass is seen.
  const resolved = CONFIDENCES.printed.filter((c) => r3.some((x) => x.entry === c.entry && x.pass)).map((c) => ({ ...c, outcome: 0, on: r3.find((x) => x.entry === c.entry).pass.date }));
  rows[10] = { resolved, resolvedCount: resolved.length, open: CONFIDENCES.printed.length - resolved.length + CONFIDENCES.unprinted };
  // memory (not a pattern): every entry written before the cutoff; unknown when an undescribed entry's side of
  // the cutoff is unknown
  const sides = ENTRIES.map((e) => [e, writtenBefore(e, cutoffIso)]);
  const memory = sides.some(([, b]) => b == null) ? null : (() => { const before = sides.filter(([, b]) => b).map(([e]) => e); return { k: before.filter((e) => e.cls !== 'at_time').length, n: before.length }; })();

  return DETECTOR_ROWS.map((d) => {
    const r = rows[d.row];
    if (d.row === 6) return { ...d, ...r, k: 0, n: 0, text: r.none ? 'no winning closes yet' : null, building: null };
    if (d.row === 10) return { ...d, ...r, k: r.resolvedCount, n: null, text: `${r.resolvedCount} resolved`, building: `${r.resolvedCount} resolved; a score starts at 20` };
    if (r.unknown) return { ...d, ...r, k: null, n: null, text: null, building: null };
    const k = r.k ?? r.cases.length, n = r.n ?? r.cases.length + r.uncounted.length;
    return { ...d, ...r, k, n, text: `${k} of ${n}`, building: `${n} counted; rates start at 20` };
  }).concat([{ ...MEMORY_ROW, k: memory?.k ?? null, n: memory?.n ?? null, text: memory ? `${memory.k} of ${memory.n}` : null, building: null }]);
}
/** Whether an entry was written before a cutoff; undescribed entries answer by their window (the Oct 7 review's
 *  Sep 28 – Oct 6, or older), and an imported entry with no printed date is older than every review. */
function writtenBefore(e, cutoffIso) {
  if (e.writtenAt) return (e.writtenAt.length > 10 ? e.writtenAt : isoOf(e.writtenAt, '12:00')) < cutoffIso;
  if (e.cls === 'imported') return true;
  if (e.window === 'review') return cutoffIso >= SCENARIO.review;
  if (e.window === 'older') return cutoffIso >= REVIEW_CUTOFF.sep28 ? true : null;
  return null;
}

// ---- reviews ---------------------------------------------------------------------------------------------------------
/** Review cutoffs. Oct 7, 7:02 AM is printed; Sep 21 and Sep 28 print no time (start of the day here). */
export const REVIEW_CUTOFF = { sep21: '2026-09-21T07:00:00-04:00', sep28: '2026-09-28T07:00:00-04:00', oct7: SCENARIO.review };
/** A review's "This week in numbers": from the last snapshot before the window to the last one in it. `entries`
 *  is null when an undescribed entry might fall in the window (the spec counts only the Oct 7 window's). */
function weekStrip(fromIso, toIso) {
  const start = snapshotBefore(fromIso), end = snapshotAt(toIso);
  const side = (e) => { const a = writtenBefore(e, toIso), b = writtenBefore(e, fromIso); return a == null || b == null ? null : a && !b; };
  const sides = ENTRIES.map((e) => [e, side(e)]);
  const known = !sides.some(([, s]) => s == null);
  const entries = sides.filter(([, s]) => s).map(([e]) => e);
  const plans = entries.filter((e) => e.kind === 'plan');
  const no = plans.flatMap((e) => PLAN[e.plan].answers.filter((a) => a.answer === 'no'));
  return { from: start.id, to: end.id, moneyIn: moneyBetween(start.at, end.at), usd: q(end.accountValue).sub(start.accountValue).sub(moneyBetween(start.at, end.at)), pct: end.index.div(start.index).sub(1), entries: known ? entries.length : null, plans: plans.length, answeredNo: no.length };
}
const OCT7 = (() => {
  const strip = weekStrip(REVIEW_CUTOFF.sep28, REVIEW_CUTOFF.oct7);
  return {
    id: 'oct7', at: REVIEW_CUTOFF.oct7, window: ['2026-09-28', '2026-10-06'],
    head: { newEntries: strip.entries, inAll: ENTRIES.length, model: 'Opus 5.5' },
    strip, detectors: detectors(REVIEW_CUTOFF.oct7), moneyWent: MONEY_WENT, event: EVENT,
    rulesThisReview: ['R2', 'R3'].map((id) => ({ rule: id, ...RULE_COUNTS[id] })),
    wentAheadAgainst: PLANS.flatMap((p) => p.answers.filter((a) => a.answer === 'no').map((a) => ({ rule: a.rule, plan: p.id, entry: p.entry, date: p.at, what: INSTRUMENTS[p.inst].short, reason: a.reason, worthIt: a.worthIt }))),
    focus: { text: 'Name an exit before I place a trade.', kind: 'own' },
  };
})();
export const REVIEWS = {
  sep21: { id: 'sep21', at: REVIEW_CUTOFF.sep21, detectors: detectors(REVIEW_CUTOFF.sep21), moneyWent: moneyWent(snapshotBefore(REVIEW_CUTOFF.sep21).id), ai: 'seeded in slice 4; not printed' },
  sep28: { id: 'sep28', at: REVIEW_CUTOFF.sep28, strip: weekStrip(REVIEW_CUTOFF.sep21, REVIEW_CUTOFF.sep28), detectors: detectors(REVIEW_CUTOFF.sep28), moneyWent: moneyWent(snapshotBefore(REVIEW_CUTOFF.sep28).id), findings: ['f-sep28-row1'], drafts: ['R2 v1'], feedback: [{ finding: 'f-sep28-row1', choice: 'missing_context', on: '2026-10-06' }] },
  oct7: OCT7,
};

// ---- the Oct 7 review's AI parts (slice 4 seed) ------------------------------------------------------------------------
/** Four findings, each tied to one detector row, each linked to losses (point 9: every case is a loss). F1 and F2
 *  are the spec's own sentences (the tone guide); the spec prints no wording for the other two, so theirs is
 *  composed from computed facts the spec states ("Only the QQQ entry names an exit…"; "the QQQ puts’ $8.00 exit
 *  is passed at the Sep 29 snapshot ($7.90), while still held"). `wording`: 'spec' or 'composed'. */
export const FINDINGS = [
  {
    id: 'f-row1', row: 1, about: 'decided', side: 'losses', wording: 'spec', suspicion: 'I add to losers',
    claim: 'In 3 of the 4 adds you wrote at the time, the price was 15% or more below your average cost: the TSLA puts on Sep 4 (17.4%), Sep 11 (21.6%) and Sep 18 (28.3%). The NVDA add on Aug 28 was 8.6% below.',
    evidence: 'In 3 of 4 “Added” entries · cites 4', count: '4 counted; rates start at 20.', cut: 'Cut the other way: 1 (NVDA, Aug 28)',
    cites: ['e-sep04', 'e-sep11', 'e-sep18', 'e-aug28'], draft: 'R2 (drafted by the Sep 28 review; adopted Sep 30)',
  },
  {
    id: 'f-row7', row: 7, about: 'happened', side: 'losses', wording: 'spec', suspicion: 'Too much margin',
    claim: 'Margin used set a new high at 7 of the 11 steps between your snapshots, from 57% on Aug 28 to 147% on Sep 29. No rule about margin existed before R3 on Sep 30.',
    evidence: 'At 7 of 11 steps between snapshots · cites 7', count: '11 counted; rates start at 20.', cut: 'Cut the other way: 4 (Aug 21, Sep 30, Oct 2, Oct 6)',
    cites: ['e-aug28', 'e-sep04', 'e-sep08', 'e-sep15', 'e-sep18', 'e-sep25', 'e-sep29'], draft: 'd-earnings',
  },
  {
    id: 'f-row2', row: 2, about: 'decided', side: 'losses', wording: 'composed', suspicion: null,
    claim: 'In 4 of the 5 “Entered” and “Added” entries you wrote at the time, no exit was named: the NVDA add on Aug 28 and the TSLA put adds on Sep 4, Sep 11 and Sep 18. The QQQ puts on Aug 26 named $8.00.',
    evidence: 'In 4 of 5 “Entered” and “Added” entries · cites 5', count: '5 counted; rates start at 20.', cut: 'Cut the other way: 1 (QQQ puts, Aug 26)',
    cites: ['e-aug28', 'e-sep04', 'e-sep11', 'e-sep18', 'e-aug26'], draft: 'd-exit',
  },
  {
    id: 'f-row3', row: 3, about: 'decided', side: 'losses', wording: 'composed', suspicion: 'I don’t sell when I said I would',
    claim: 'Your Aug 26 entry named an exit of $8.00 on the QQQ puts. Your Sep 29 snapshot shows them at $7.90, still held.',
    evidence: 'In 1 of 1 named exits · cites 2', count: '1 counted; rates start at 20.', cut: 'Cut the other way: 0', seenAt: 'Seen at your snapshots only',
    cites: ['e-aug26', 'e-sep29'], draft: null,
  },
];
/** Three questions back: all three are the spec's own sentences. */
export const QUESTIONS = [
  { id: 'q-roll', text: 'Your Sep 4, Sep 11 and Sep 18 adds are 3 of the 4 that pattern 1 counted, and each says a version of “it has to roll over”. What would have told you it wasn’t going to?' },
  { id: 'q-plan', text: 'Your Oct 1 plan named a price, $13.10, and the Oct 2 trim of the TSLA puts was made at it. What was different about writing that one?' },
  { id: 'q-margin', text: 'On Sep 18 you wrote that margin was “around 55%”. Your Sep 18 snapshot computes 115% of account value ($49,911.40 borrowed on $43,277), or 53.6% of position value. Which number were you looking at?' },
];
/** The event, as the review phrases it (the spec's sentence; its figures are EVENT's). */
export const EVENT_TEXT = 'The Sep 29 margin call. From Sep 25 to Sep 30, account value went from $36,146 to $36,021, with $2,500 put in on Sep 30: −$2,625, 11.9% of the $22,142 lost since the Aug 21 high. It’s one event, so it isn’t counted as a pattern.';

/** AI-run figures the spec authors (cost model, What's sent, Settings), printed as given. */
export const AI = {
  entryRead: { at: '2026-10-07T06:58:00-04:00', model: 'Sonnet 5.5', head: 'AI · read Oct 7, 6:58 AM · Sonnet 5.5 on your key' },
  howThisRan: ['Read 8 entries · Sonnet 5.5 · $0.09', 'Findings · Opus 5.5 · 17,400 in · 6,900 out · $0.21', 'Number check passed · 31 figures'],
  packageId: 'sha256:9f3c…',
  estimate: '≈ $0.31 · estimate · up to $0.76',
  ready: '8 new entries since Sep 28 · ≈ $0.31',
  month: 'This month: $0.31 of $5.00 · 1 review · 8 entry reads',
  caps: { month: '$5.00', run: '$1.00', perDay: '3 reviews and 60 entry reads' },
  models: { entry: 'Sonnet 5.5', review: 'Opus 5.5' },
  bulk: { entries: 34, text: '34 entries haven’t been read. Read them now · ≈ $0.18' },
  whatsSent: [
    'Text of entries written since the last review: 8 entries, 2,090 words',
    'Short summaries of older entries: 26',
    'Later notes marked as context: 1',
    'Snapshots: 12 (account value, cash, margin loan, maintenance requirement, margin call and due date, money in or out, positions and marks)',
    'Computed figures: 31',
    'The 10-pattern table and your suspicions',
    'Active rules: 2, with your plan answers and reasons',
    'Your corrections: 1',
  ],
  keptOut: 2,
};
/** Tidy's count, as printed ("14 details in 6 entries"; the Review rail's "Tidy up · 14 details waiting"). */
export const TIDY = { details: 14, entries: 6 };

/** An illustrative rate for the n ≥ 20 states (never the sample): "63% (Wilson 95%: 43–79%, n = 24)" is k = 15. */
export const ILLUSTRATIVE_RATE = { k: 15, n: 24 };
/** Wilson 95% interval (z = 1.96) for k of n, as fractions. */
export function wilson(k, n, z = 1.96) {
  const p = k / n, z2 = z * z;
  const c = (p + z2 / (2 * n)) / (1 + z2 / n);
  const h = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return { p, lo: c - h, hi: c + h };
}

// ---- headline facts, gathered for boards ----------------------------------------------------------------------------
const S = SNAPSHOT;
export const FACTS = {
  latest: LATEST.id, high: HIGH.id,
  accountValue: LATEST.accountValue, marginUsed: LATEST.marginUsed, leverage: LATEST.leverage, below: LATEST.below, alone: LATEST.alone,
  lostSinceHigh: LATEST.lostSinceHigh, sinceOct2: LATEST.change,
  leverageAt: { aug21: S['s-aug21'].leverage, sep29: S['s-sep29'].leverage, oct6: S['s-oct06'].leverage },
  excess: { sep29: S['s-sep29'].excessLiquidity, sep30: S['s-sep30'].excessLiquidity },
  sep18: { marginUsed: S['s-sep18'].marginUsed, loanToPositionValue: S['s-sep18'].loanToPositionValue },
  results: Object.fromEntries(['NVDA', 'TSLA_P440', 'QQQ_P600'].map((i) => [i, resultAt(i)])),
};

// ---- strings the boards print, built from the facts (so a board never retypes a figure) ------------------------------
const mu = (s) => pct(s.marginUsed, 0);
/** A day group's snapshot line: "Account value $34,047 · margin used 147% · call $2,750". */
export const dayLine = (snapshotId) => { const s = S[snapshotId]; return `Account value ${usd(s.accountValue)} · margin used ${mu(s)}${s.id === CALL.snapshot ? ` · call ${usd(CALL.amount)}` : ''}`; };
/** A trim card's footer: "−0.5R against planned risk · Your label: Sound"; a stock with no exit reads `not set`. */
export function rFooter(entryId) {
  const t = TRIM[entryId];
  if (!t) return null;
  const r = t.R.state === 'value' ? rMultiple(t.R.value) : t.R.state;
  return { r, gap: t.R.state !== 'value', label: t.label ? LABEL_WORD[t.label] : null, text: `${r} against planned risk${t.label ? ` · Your label: ${LABEL_WORD[t.label]}` : ''}` };
}
/** "Written Aug 21 · about Aug 4" on a recalled card. */
export const recalledLine = (entryId) => { const e = ENTRY[entryId]; return e.cls === 'at_time' || !e.writtenAt ? null : `Written ${fmtDate(e.writtenAt)} · about ${fmtDate(e.about)}`; };
export const STRINGS = {
  railFinding: `Account value ${usd(LATEST.accountValue)}, ${pct(LATEST.below, 1, { abs: true })} below its recorded high`,
  pathTitle: `Account value fell ${pct(LATEST.below, 1, { abs: true })} from its ${fmtDate(HIGH.asOf)} high, with money in and out taken out`,
  highLabel: `${usd(HIGH.accountValue)} · recorded high · ${fmtDate(HIGH.asOf)}`,
  highWritten: `${usd(HIGH.accountValue)} · ${fmtDate(HIGH.asOf)} · written at the time`,
  belowEnd: pct(LATEST.below, 1),
  belowInfo: `Each deposit or withdrawal is taken out on its day, so money you put in can’t hide a loss and money you take out isn’t counted as one. Account value alone is ${pct(LATEST.alone, 1, { abs: true })} below its recorded high.`,
  marginInfo: (snapshotId = LATEST.id) => `Margin loan as a share of account value. 100% means you’ve borrowed as much as the account is worth. As a share of your positions’ value it is ${pct(S[snapshotId].loanToPositionValue, 1)}.`,
  peek: `Account value ${usd(LATEST.accountValue)} · margin used ${mu(LATEST)} · ${fmtDate(LATEST.asOf)} ›`,
  sinceOct2: `Since ${fmtDate(S['s-oct02'].asOf)}: ${signedUsd(LATEST.change.usd)} (${pct(LATEST.change.pct, 1, { sign: true })})`,
  focus: 'This week’s focus: Name an exit before I place a trade. · your Oct 7 review',
  r3Now: `Margin used now ${mu(LATEST)} · R3 limit 50%`,
  rulebookR3: `Margin used now ${mu(LATEST)} · limit 50%`,
  revisit: 'Revisit due: your Aug 26 entry (QQQ puts) · Open',
  quickNumbers: `Numbers: carried from ${fmtDate(LATEST.asOf)} (${daysBetween(LATEST.asOf, SCENARIO.date)} day) · Update`,
  reviewHead: `Review of Sep 28 – Oct 6 · as of ${fmtDateTime(SCENARIO.review)} · ${OCT7.strip.entries} new entries (${ENTRIES.length} in all)`,
  weekValue: `Account value ${usd(S[OCT7.strip.from].accountValue)} (${fmtDate(S[OCT7.strip.from].asOf)}) → ${usd(S[OCT7.strip.to].accountValue)} (${fmtDate(S[OCT7.strip.to].asOf)})`,
  weekNet: `${signedUsd(OCT7.strip.usd)} net of the ${usd(OCT7.strip.moneyIn)} in`,
  weekPct: `${pct(OCT7.strip.pct, 1, { sign: true })} with money in and out taken out`,
  weekCounts: `${OCT7.strip.entries} entries · ${OCT7.strip.plans} plans · ${OCT7.strip.answeredNo} rule answered No`,
  moneyWentCaption: `The ${INSTRUMENTS.TSLA_P440.short} are ${pct(MONEY_WENT.rows[0].share, 1)} of the fall. That’s one position, not a pattern.`,
  moneyWentRest: `Not explained by your typed marks: ${signedUsd(MONEY_WENT.remainder.usd)} (interest, fees or trades you didn’t type)`,
  wentAhead: 'R3 · Oct 5 plan (SPY puts) · “It’s a hedge; it should lower the risk.”',
  r2Touch: `R2 may apply: “added 3 more TSLA 440 puts at 19.80”; the TSLA puts were ${pct(avgBefore(TRADES.find((t) => t.id === 't-tsla-add3')).sub(1980).div(avgBefore(TRADES.find((t) => t.id === 't-tsla-add3'))), 1)} below your average cost.`,
  computedNone: 'Computed at kept entries: none yet',
  rulesCount: `${RULES.filter((r) => r.status === 'active').length} active · 7 at most`,
  correction: `Margin loan ${usd(1189000)} → corrected to ${usd(1198000)} on Aug 22: “the statement says 11,980”`,
  callCross: [`Your broker’s call: ${usd(CALL.amount)}`, `Your numbers compute excess liquidity of ${signedUsd(S['s-sep29'].excessLiquidity)}. That matches the call.`],
};
/** Rule asks as printed: "Asked in 2 plans · Yes 0 · No 1 · Doesn’t apply 1 · Not answered 0". */
export const asksLine = (ruleId, { short = false } = {}) => { const c = RULE_COUNTS[ruleId]; return `${short ? `asked ${c.asked}` : `Asked in ${c.asked} plans`} · Yes ${c.yes} · No ${c.no} · Doesn’t apply ${c.doesnt_apply} · Not answered ${c.not_answered}`; };
/** "Account change after Yes vs after No: too few to judge (0 and 1 counted; rates start at 20)". */
export const afterLine = (ruleId) => { const c = RULE_COUNTS[ruleId]; return `Account change after Yes vs after No: too few to judge (${c.afterYes} and ${c.afterNo} counted; rates start at 20)`; };

// ---- counts the spec prints, from the lists above --------------------------------------------------------------------
export const COUNTS = {
  entries: ENTRIES.length,
  atTime: ENTRIES.filter((e) => e.cls === 'at_time').length,
  recalled: ENTRIES.filter((e) => e.cls === 'recalled').length,
  imported: ENTRIES.filter((e) => e.cls === 'imported').length,
  described: ENTRIES.filter((e) => e.described).length,
  snapshots: SNAPSHOTS.length,
  money: MONEY.length,
  laterNotes: LATER_NOTES.length,
  corrections: CORRECTIONS.length,
  plans: PLANS.length,
  rulesActive: RULES.filter((r) => r.status === 'active').length,
};

/** Holes and one inconsistency in the spec's sample, recorded so no board papers over them. */
export const GAPS = [
  'Entries: the spec describes 20 of its 34 (16 at the time, of which 5 only by their snapshot; 1 recalled; 3 imported); 14 are undescribed members of its counts (10 at the time, one of them in the Oct 7 window; 4 recalled). Imported entries print no written date.',
  'Bodies: printed whole for the Sep 29 call, the Sep 30 NVDA trim, the Oct 2 TSLA trim and the Oct 5 plan; Sep 18 has two exact spans; Sep 4, 11 and 18 carry “a version of” “it has to roll over” (not exact words); every other body is unprinted.',
  'Later notes: 5 in the seed; 1 printed whole (Sep 30, 6:40 PM), 1 known only as the Oct 6 context note; 3 undescribed.',
  'Row 9 (1 of 3) is printed, not derivable: the spec names one of the three figures (Sep 18, “around 55%”). Row 10: one confidence printed (70); three more are unprinted and open.',
  'R2’s answer on the Oct 1 plan is unprinted; Doesn’t apply is derived (the only answer consistent with “1 rule answered No” that is also true).',
  'The Sep 21 and Sep 28 reviews print no time; their cutoffs here are 7:00 AM on the day. Their row 9 is unknown, and the Sep 21 memory row too.',
  'Findings 3 and 4 (rows 2 and 3) have no printed wording; theirs is composed from facts the spec states. The spec prints no 60-word digest for any entry.',
  'Inconsistency: What’s sent counts 8 new entries and 26 older summaries (34, every entry) yet also says “the 2 entries you kept out” are never sent; the sample can’t have both. Recorded as printed (AI.keptOut = 2); which entries are kept out is unprinted.',
  'Tidy’s “14 details in 6 entries” is printed; the details themselves are not.',
];
