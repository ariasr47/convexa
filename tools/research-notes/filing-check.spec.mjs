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
const filings = filingsFromCompanyFacts(facts);

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
    one(fig('Revenue', '$130.5B', 'FY2026', 'us-gaap:Revenues')).status,
    'matches',
    'the 10-K year',
  );
  assert.equal(one(fig('Revenue', '$35.1B', 'Q3 FY2026', 'us-gaap:Revenues')).status, 'matches');
  // The Q2 FY2026 10-Q is the fifth-newest filing: not read.
  assert.equal(one(fig('Revenue', '$30.0B', 'Q2 FY2026', 'us-gaap:Revenues')).status, 'not_found');
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
