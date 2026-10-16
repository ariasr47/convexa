// Figures against the filing: the check tells a reader a note's figure matches or differs from what the
// company filed, and fails the author's research check on a difference nobody explained. A wrong
// tolerance, scale or period match would pass a wrong figure silently (or flag a right one), so each
// rule is pinned here against the saved SEC company-facts fixture the API's tests read.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  checkFigures,
  filingsFromCompanyFacts,
  formatFiled,
  parseConceptCell,
  parseFigure,
  parsePeriod,
} from './filing-check.mjs';
import { parseNote } from './notes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(
  here,
  '../../apps/api/tests/fixtures/public_data/sec_companyfacts_nvda.json',
);
const facts = JSON.parse(readFileSync(FIXTURE, 'utf8'));
// What the page reads (the API's two newest periodic filings), and a wider window for the rules that
// need an older filing (a 10-K year, a Q3).
const filings = filingsFromCompanyFacts(facts);
const wide = filingsFromCompanyFacts(facts, { keep: 4 });

const fig = (label, value, asOf, concept, why = null) => ({ label, value, asOf, concept, why });
const one = (f, list = filings) => checkFigures([f], list)[0];

test('a note figure reads as a number with its precision, scale and kind', () => {
  assert.deepEqual(parseFigure('$96.2B'), {
    value: 96.2e9,
    half: 0.05e9,
    step: 0.1e9,
    decimals: 1,
    scaleWord: 'B',
    kind: 'money',
  });
  const pct = parseFigure('66.2%');
  assert.equal(pct.kind, 'percent');
  assert.ok(Math.abs(pct.value - 0.662) < 1e-12 && Math.abs(pct.half - 0.0005) < 1e-12);
  assert.equal(parseFigure('$2.46').half.toFixed(3), '0.005');
  const shares = parseFigure('24,285M');
  assert.equal(shares.kind, 'count');
  assert.equal(shares.value, 24_285e6);
  assert.equal(shares.half, 0.5e6);
  assert.equal(parseFigure('−$0.5B').value, -0.5e9);
  assert.equal(parseFigure('($1.2B)').value, -1.2e9);
  for (const bad of ['14.2×', '$164.27–$243.37', 'about $5B', '5%B', '$5%'])
    assert.equal(parseFigure(bad), null, bad);
});

test('a period is the filer’s fiscal quarter or year, or the filing that ends on a date', () => {
  assert.deepEqual(parsePeriod('Q2 FY2027'), { fy: 2027, fp: 'Q2', label: 'Q2 FY2027' });
  assert.deepEqual(parsePeriod('Q2 FY27'), { fy: 2027, fp: 'Q2', label: 'Q2 FY2027' });
  assert.deepEqual(parsePeriod('Q2 2026'), { fy: 2026, fp: 'Q2', label: 'Q2 FY2026' });
  assert.deepEqual(parsePeriod('FY2026'), { fy: 2026, fp: 'FY', label: 'FY2026' });
  assert.deepEqual(parsePeriod('2026-07-26'), { date: '2026-07-26', label: '2026-07-26' });
  for (const bad of ['FY2026 guide', 'Q2 26', 'Q5 FY2027', 'mid-2028'])
    assert.equal(parsePeriod(bad), null, bad);
});

test('a concept cell names checked concepts, one operator at most, and an optional reason', () => {
  assert.deepEqual(parseConceptCell('us-gaap:GrossProfit ÷ us-gaap:Revenues; as in the 8-K'), {
    concept: 'us-gaap:GrossProfit / us-gaap:Revenues',
    terms: ['us-gaap:GrossProfit', 'us-gaap:Revenues'],
    op: '/',
    why: 'as in the 8-K',
  });
  assert.equal(parseConceptCell('none').concept, 'none');
  assert.match(parseConceptCell('Revenues').error, /taxonomy/);
  assert.match(parseConceptCell('us-gaap:Goodwill').error, /isn't one the site checks/);
  assert.match(
    parseConceptCell('us-gaap:Revenues / us-gaap:Assets / us-gaap:Liabilities').error,
    /two joined/,
  );
});

test('saved company facts become the filings the API sends: fiscal period and own-period values', () => {
  assert.equal(filings.length, 2, 'the page reads the two newest periodic filings');
  const [q2, q1] = filings;
  assert.equal(q2.accession, '0001045810-26-000073');
  assert.deepEqual(
    [q2.form, q2.fiscal_year, q2.fiscal_period, q2.period_end],
    ['10-Q', 2027, 'Q2', '2026-07-26'],
  );
  const value = (f, c) => f.tagged.find((t) => t.concept === c)?.value;
  // The same values apps/api filed_figures.rs pins for this fixture.
  assert.equal(value(q2, 'us-gaap:Revenues'), 46_700_000_000);
  assert.equal(value(q2, 'us-gaap:CashAndCashEquivalentsAtCarryingValue'), 11_600_000_000);
  assert.equal(value(q2, 'dei:EntityCommonStockSharesOutstanding'), 24_300_000_000);
  assert.equal(value(q2, 'us-gaap:OperatingIncomeLoss'), undefined);
  assert.equal(q2.tagged.length, 7);
  assert.deepEqual(
    [q1.fiscal_year, q1.fiscal_period, value(q1, 'us-gaap:Revenues')],
    [2027, 'Q1', 44_100_000_000],
  );
});

test('matches at the note’s precision, differs past it, with the gap in the note’s unit', () => {
  const rev = one(fig('Revenue', '$46.7B', 'Q2 FY2027', 'us-gaap:Revenues'));
  assert.equal(rev.status, 'matches');
  assert.equal(rev.filedText, '$46,700M');
  assert.equal(rev.accession, '0001045810-26-000073');
  const off = one(fig('Revenue', '$46.8B', 'Q2 FY27', 'us-gaap:Revenues'));
  assert.deepEqual([off.status, off.gap], ['differs', '$0.1B']);
  // A coarser figure still matches: $47B is 46.7 rounded to the note's precision.
  assert.equal(one(fig('Revenue', '$47B', 'Q2 FY2027', 'us-gaap:Revenues')).status, 'matches');
  assert.equal(one(fig('Revenue', '$46,700M', 'Q2 FY2027', 'us-gaap:Revenues')).status, 'matches');
  assert.equal(one(fig('Revenue', '$46,701M', 'Q2 FY2027', 'us-gaap:Revenues')).status, 'differs');
  // Per-share: a cent off differs, by a cent.
  assert.equal(
    one(fig('EPS', '$1.08', 'Q2 FY2027', 'us-gaap:EarningsPerShareDiluted')).status,
    'matches',
  );
  const eps = one(fig('EPS', '$1.09', 'Q2 FY2027', 'us-gaap:EarningsPerShareDiluted'));
  assert.deepEqual([eps.status, eps.gap, eps.filedText], ['differs', '$0.01', '$1.08']);
  // Exactly half a unit away still rounds to the note's figure.
  const half = [
    {
      ...filings[0],
      tagged: [
        {
          concept: 'us-gaap:Revenues',
          unit: 'USD',
          value: 46.75e9,
          start: null,
          end: '2026-07-26',
        },
      ],
    },
  ];
  assert.equal(
    one(fig('Revenue', '$46.7B', 'Q2 FY2027', 'us-gaap:Revenues'), half).status,
    'matches',
  );
});

test('a margin is a ratio of two concepts in points; a difference of two is computed', () => {
  // 33.0 / 46.7 = 70.66%.
  assert.equal(
    one(fig('Gross margin', '70.7%', 'Q2 FY2027', 'us-gaap:GrossProfit / us-gaap:Revenues')).status,
    'matches',
  );
  const m = one(
    fig('Gross margin', '70.6%', 'Q2 FY2027', 'us-gaap:GrossProfit / us-gaap:Revenues'),
  );
  assert.deepEqual([m.status, m.gap, m.filedText], ['differs', '0.1 pts', '70.66%']);
  const c = one(
    fig('Cost of revenue', '$13.7B', 'Q2 FY2027', 'us-gaap:Revenues - us-gaap:GrossProfit'),
  );
  assert.equal(c.status, 'computed');
  assert.equal(
    one(fig('Cost', '$13.9B', 'Q2 FY2027', 'us-gaap:Revenues - us-gaap:GrossProfit')).status,
    'differs',
  );
});

test('units must fit: a percentage of a dollar concept, or dollars of a share count, never match', () => {
  assert.equal(one(fig('Revenue', '46.7%', 'Q2 FY2027', 'us-gaap:Revenues')).status, 'unit');
  assert.equal(
    one(fig('Shares', '$24.3B', 'Q2 FY2027', 'dei:EntityCommonStockSharesOutstanding')).status,
    'unit',
  );
  assert.equal(
    one(fig('Shares', '24.3B', 'Q2 FY2027', 'dei:EntityCommonStockSharesOutstanding')).status,
    'matches',
  );
  assert.equal(one(fig('Revenue', '46.7B', 'Q2 FY2027', 'us-gaap:Revenues')).status, 'unit');
});

test('periods match by the filer’s tags or the period-end date, and say so when nothing covers them', () => {
  assert.equal(
    one(fig('Cash', '$11.6B', '2026-07-26', 'us-gaap:CashAndCashEquivalentsAtCarryingValue'))
      .status,
    'matches',
  );
  assert.equal(
    one(fig('Cash', '$10.2B', '2026-04-26', 'us-gaap:CashAndCashEquivalentsAtCarryingValue'))
      .status,
    'matches',
  );
  assert.equal(
    one(fig('Revenue', '$130.5B', 'FY2026', 'us-gaap:Revenues'), wide).status,
    'matches',
    'the 10-K year',
  );
  assert.equal(
    one(fig('Revenue', '$35.1B', 'Q3 FY2026', 'us-gaap:Revenues'), wide).status,
    'matches',
  );
  // The Q2 FY2026 10-Q is the fifth-newest filing: not read.
  assert.equal(
    one(fig('Revenue', '$30.0B', 'Q2 FY2026', 'us-gaap:Revenues'), wide).status,
    'not_found',
  );
  // The filing is read but doesn't tag the concept.
  const missing = one(fig('Operating income', '$30B', 'Q2 FY2027', 'us-gaap:OperatingIncomeLoss'));
  assert.equal(missing.status, 'missing');
  // A newer 10-Q on EDGAR without its facts yet: the next quarter's figure waits, it isn't "differs".
  const newer = {
    accession: 'X',
    form: '10-Q',
    filed: '2026-11-19',
    period_end: '2026-10-25',
    fiscal_year: null,
    fiscal_period: null,
    tagged: [],
  };
  assert.equal(
    one(fig('Revenue', '$50B', 'Q3 FY2027', 'us-gaap:Revenues'), [newer, ...filings]).status,
    'pending',
  );
  assert.equal(
    one(fig('Revenue', '$46.7B', 'Q2 FY2027', 'us-gaap:Revenues'), [newer, ...filings]).status,
    'matches',
  );
  assert.equal(one(fig('Guarantees', '$108.5B', 'Q2 FY2027', 'none')).status, 'not_tagged');
  assert.equal(one(fig('Price', '$226.32', '2026-10-12', 'us-gaap:Revenues')).status, 'not_found');
  assert.equal(one(fig('P/E', '14.2×', 'Q2 FY2027', 'us-gaap:Revenues')).status, 'invalid');
});

test('the research check lists every difference and fails only on one nobody explained', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'filing-check-'));
  try {
    const research = path.join(dir, 'research');
    mkdirSync(path.join(research, 'NVDA'), { recursive: true });
    mkdirSync(path.join(research, '_filings'));
    const note = (opMargin) =>
      [
        '---',
        'ticker: NVDA',
        'date: 2026-10-13',
        'title: Checked',
        '---',
        '',
        'Lead.',
        '',
        '```metrics',
        'Revenue | $46.7B @ Q2 FY2027 | | up | | us-gaap:Revenues',
        `Gross margin | 70.6% @ Q2 FY2027 | | up | | ${opMargin}`,
        'Guarantees | $108.5B @ 2026-07-26 | | flat | | none',
        '```',
        '',
      ].join('\n');
    const file = path.join(research, 'NVDA', '2026-10-13-initiation.md');
    const run = () =>
      spawnSync(process.execPath, [path.join(here, 'check-filings.mjs'), '--research', research], {
        encoding: 'utf8',
      });

    writeFileSync(file, note('us-gaap:GrossProfit / us-gaap:Revenues'));
    // The note itself is valid, and carries its figures.
    assert.equal(
      parseNote(readFileSync(file, 'utf8'), 'research/NVDA/x.md').errors?.length ?? 0,
      0,
    );
    let r = run();
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /3 figure\(s\) not checked: no saved company facts/);

    copyFileSync(FIXTURE, path.join(research, '_filings', 'NVDA.json'));
    r = run();
    assert.equal(r.status, 1, `${r.stdout}${r.stderr}`);
    assert.match(
      r.stderr,
      /Gross margin · Q2 FY2027: differs by 0\.1 pts\. The note says 70\.6%; the 10-Q tags 70\.66%/,
    );
    assert.match(r.stdout, /Revenue · Q2 FY2027: matches/);
    assert.match(r.stdout, /Guarantees · 2026-07-26: not tagged · cites the filing/);
    assert.match(r.stdout, /2 figure\(s\) checked, 0 not checked, 1 unexplained/);

    writeFileSync(file, note('us-gaap:GrossProfit / us-gaap:Revenues; as reported in the 8-K'));
    r = run();
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /differs by 0\.1 pts, explained: as reported in the 8-K/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a concept the saved facts predate is not checked; one saved but untagged is still missing', () => {
  // save-filings.mjs keeps only the concepts the note named when it ran, and lists them in
  // <TICKER>.source.json. A concept named later isn't in the slice: "the filing doesn't tag it" would
  // be false (NVDA's 10-Q tags basic EPS), so it reads not checked until the facts are saved again.
  const dir = mkdtempSync(path.join(os.tmpdir(), 'filing-check-'));
  try {
    const research = path.join(dir, 'research');
    const facts = path.join(research, '_filings');
    mkdirSync(path.join(research, 'NVDA'), { recursive: true });
    mkdirSync(facts);
    writeFileSync(
      path.join(research, 'NVDA', '2026-10-13-initiation.md'),
      [
        '---',
        'ticker: NVDA',
        'date: 2026-10-13',
        'title: Checked',
        '---',
        '',
        'Lead.',
        '',
        '```metrics',
        'Revenue | $46.7B @ Q2 FY2027 | | up | | us-gaap:Revenues',
        'EPS, GAAP basic | $1.08 @ Q2 FY2027 | | up | | us-gaap:EarningsPerShareBasic',
        '```',
        '',
      ].join('\n'),
    );
    // The fixture tags Revenues and not EarningsPerShareBasic, like a slice saved before EPS was named.
    copyFileSync(FIXTURE, path.join(facts, 'NVDA.json'));
    const saved = (concepts) =>
      writeFileSync(
        path.join(facts, 'NVDA.source.json'),
        JSON.stringify({ ticker: 'NVDA', fetched: '2026-10-16', concepts }),
      );
    const run = () =>
      spawnSync(process.execPath, [path.join(here, 'check-filings.mjs'), '--research', research], {
        encoding: 'utf8',
      });

    saved(['us-gaap:Revenues']);
    let r = run();
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /Revenue · Q2 FY2027: matches/);
    assert.match(
      r.stdout,
      /EPS, GAAP basic · Q2 FY2027: not checked: the saved facts predate this concept; run tools\/research-notes\/save-filings\.mjs/,
    );
    assert.match(r.stdout, /1 figure\(s\) checked, 1 not checked, 0 unexplained/);

    // Asked for at save time and still not in the facts: the filing really doesn't tag it.
    saved(['us-gaap:EarningsPerShareBasic', 'us-gaap:Revenues']);
    r = run();
    assert.equal(r.status, 1, `${r.stdout}${r.stderr}`);
    assert.match(
      r.stderr,
      /EPS, GAAP basic · Q2 FY2027: missing\. The 10-Q doesn't tag us-gaap:EarningsPerShareBasic/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- W1-32, W1-33, W1-35 --------------------------------------------------------------------------

/** A minimal company-facts answer: one concept, a point per [form, accn, filed, fy, fp, start, end, val]. */
const factsOf = (concept, unit, points) => {
  const [taxonomy, name] = concept.split(':');
  return {
    facts: {
      [taxonomy]: {
        [name]: {
          units: {
            [unit]: points.map(([form, accn, filed, fy, fp, start, end, val]) => ({
              form,
              accn,
              filed,
              fy,
              fp,
              start,
              end,
              val,
            })),
          },
        },
      },
    },
  };
};

/** One filing read, with the given tagged values. */
const filed = (tagged, over = {}) => ({
  accession: 'A',
  form: '10-Q',
  filed: '2026-08-01',
  period_end: '2026-06-30',
  fiscal_year: 2026,
  fiscal_period: 'Q2',
  tagged,
  ...over,
});
const fy25 = { form: '20-F', period_end: '2025-12-31', fiscal_year: 2025, fiscal_period: 'FY' };
const tag = (concept, unit, value) => ({ concept, unit, value, start: null, end: '2025-12-31' });

test('a dollar figure is checked against US dollars only, never another currency', () => {
  const twd = filed([tag('ifrs-full:Revenue', 'TWD', 3_809_054e6)], fy25);
  const r = one(fig('Revenue', '$118.6B', 'FY2025', 'ifrs-full:Revenue'), [twd]);
  assert.equal(r.status, 'unit');
  assert.equal(r.gap, null);
  assert.match(r.detail, /\(TWD\)/);
  // With the USD value tagged beside it, the dollar figure is compared with the dollars.
  const both = filed(
    [tag('ifrs-full:Revenue', 'TWD', 3_809_054e6), tag('ifrs-full:Revenue', 'USD', 118.6e9)],
    fy25,
  );
  const usd = one(fig('Revenue', '$118.6B', 'FY2025', 'ifrs-full:Revenue'), [both]);
  assert.equal(usd.status, 'matches');
  assert.equal(usd.filed, 118.6e9);
  // Per share: USD/shares fits, EUR/shares doesn't.
  const dil = fig('EPS', '$4.31', 'FY2025', 'ifrs-full:DilutedEarningsLossPerShare');
  const eps = (unit) => [filed([tag('ifrs-full:DilutedEarningsLossPerShare', unit, 4.31)], fy25)];
  assert.equal(one(dil, eps('USD/shares')).status, 'matches');
  assert.equal(one(dil, eps('EUR/shares')).status, 'unit');
});

test('the check reads the two newest periodic filings, exact forms, as the page does', () => {
  const c = 'us-gaap:Revenues';
  const read = filingsFromCompanyFacts(
    factsOf(c, 'USD', [
      ['10-K', 'K', '2026-02-05', 2025, 'FY', '2025-01-01', '2025-12-31', 700e9],
      ['10-Q', 'Q1', '2026-05-01', 2026, 'Q1', '2026-01-01', '2026-03-31', 180e9],
      ['10-Q', 'Q2', '2026-08-01', 2026, 'Q2', '2026-04-01', '2026-06-30', 200e9],
    ]),
  );
  assert.deepEqual(
    read.map((f) => f.accession),
    ['Q2', 'Q1'],
  );
  // The 10-K is the third-newest: the page shows "not in a filing read yet", so the check can't pass it.
  assert.equal(one(fig('Revenue', '$700B', 'FY2025', c), read).status, 'not_found');
  assert.equal(one(fig('Revenue', '$200B', 'Q2 2026', c), read).status, 'matches');
  // An amendment is not a periodic filing (edgar.rs PERIODIC_FORMS is matched exactly).
  const amended = filingsFromCompanyFacts(
    factsOf(c, 'USD', [
      ['10-Q', 'Q1', '2026-05-01', 2026, 'Q1', '2026-01-01', '2026-03-31', 180e9],
      ['10-Q', 'Q2', '2026-08-01', 2026, 'Q2', '2026-04-01', '2026-06-30', 200e9],
      ['10-Q/A', 'Q2A', '2026-09-01', 2026, 'Q2', '2026-04-01', '2026-06-30', 201e9],
    ]),
  );
  assert.deepEqual(
    amended.map((f) => [f.accession, f.form]),
    [
      ['Q2', '10-Q'],
      ['Q1', '10-Q'],
    ],
  );
});

test('a filed value prints one place finer than an M- or K-scale note, never whole millions', () => {
  const at = (note, value) => formatFiled(value, parseFigure(note));
  assert.equal(at('$512.3M', 512_460_000), '$512.46M');
  assert.equal(at('1.23M', 1_236_000), '1.236M');
  assert.equal(at('24,285M', 24_285_400_000), '24,285.4M');
  assert.equal(at('$950K', 949_700), '$949.7K');
  // B-scale notes keep whole millions, already finer than the note.
  assert.equal(at('$96.2B', 96_221e6), '$96,221M');
  assert.equal(at('$1.234B', 1_234_560_000), '$1,234.6M');
  const r = one(fig('Revenue', '$512.3M', 'Q2 2026', 'us-gaap:Revenues'), [
    filed([
      {
        concept: 'us-gaap:Revenues',
        unit: 'USD',
        value: 512_460_000,
        start: null,
        end: '2026-06-30',
      },
    ]),
  ]);
  assert.equal(r.status, 'differs');
  assert.equal(r.detail, 'The note says $512.3M; the 10-Q tags $512.46M.');
});
