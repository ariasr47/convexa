// Research notes are published on the public site as written, so the parser is a floor item: it must
// refuse unsafe links, malformed front matter, undated figures, unfilled blanks and unconfirmed
// carried sections (a bad note fails the build instead of deploying), keep the structure the
// dashboard renders, and refuse a judgment that moved between notes without a stated reason.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parseFilingCell } from './blocks.mjs';
import { loadNotes, parseNote, summarize } from './notes.mjs';

const front = (fields) => ['---', ...fields, '---', ''].join('\n');
const BASE = ['ticker: NVDA', 'date: 2026-10-12', 'title: Supply still short'];
const ok = front(BASE);
const withField = (line) => front([...BASE, line]);
const NVDA = 'research/NVDA/2026-10-12-supply.md';
const fence = (name, ...rows) => ['```' + name, ...rows, '```'].join('\n');
const VALUATION = [
  'method: Normalized DCF',
  'price: 100 @ 2026-10-12',
  'shares: 10 @ 2026-06-30',
  'net_cash: 0 @ 2026-06-30',
  'revenue: 100 @ FY2026',
  'margin_now: 10% @ FY2026',
  'tax: 20%',
  'terminal_growth: 2%',
  'terminal_wacc: 9%',
  'scenario | growth | margin_target | sales_to_capital | wacc | p_fail | distress | story',
  'bear | 0% | 8% | 1.5 | 10% | 0% | 0 | Slows.',
  'base | 5% | 10% | 1.5 | 10% | 0% | 0 | Holds.',
  'bull | 10% | 12% | 1.5 | 10% | 0% | 0 | Grows.',
];
const valuation = (replace = {}) =>
  fence(
    'valuation',
    ...VALUATION.map((l) => {
      const key = Object.keys(replace).find((k) => l.startsWith(k));
      return key === undefined ? l : replace[key];
    }).filter((l) => l !== null),
  );

test('each bad input is refused with a message naming the problem', () => {
  const cases = [
    ['no front matter', 'Just text.', /must start with front matter/],
    ['unclosed front matter', '---\nticker: NVDA\n', /never closed/],
    ['missing title', front(['ticker: NVDA', 'date: 2026-10-12']) + 'Body.', /"title"/],
    ['unknown field', withField('tikcer: X') + 'Body.', /Unknown field "tikcer"/],
    ['duplicate field', withField('title: Again') + 'Body.', /appears twice/],
    ['impossible date', ok.replace('2026-10-12', '2026-02-30') + 'Body.', /real date/],
    ['bad stance', withField('stance: moon') + 'Body.', /"stance" must be/],
    ['target without date', withField('target: 150') + 'Body.', /needs a "target_date"/],
    ['folder mismatch', ok + 'Body.', /doesn't match its folder/, 'research/AMD/x.md'],
    ['lowercase ticker', ok.replace('NVDA', 'nvda') + 'Body.', /uppercase symbol/],
    ['empty body', ok, /no body/],
    ['javascript: link', ok + '[x](javascript:alert(1))', /Links must start with/],
    ['data: link', ok + '[x](data:text/html,hi)', /Links must start with/],
    ['protocol-relative link', ok + '[x](//evil.example/a)', /Links must start with/],
    ['unclosed code block', ok + '```\ncode', /never closed/],
    ['blank left to fill', ok + 'Revenue was ___ last quarter.', /blank is still waiting/],
    [
      'carried section unconfirmed',
      ok + '## Moat | Holds\n<!-- re-confirm: carried from 2026-10-01 -->\nText.',
      /still flagged re-confirm/,
    ],
    ['stray comment', ok + '<!-- note to self -->', /only used to mark a carried section/],
    ['unknown block', ok + fence('metric', 'Revenue | $1B @ Q2 2026'), /Unknown block "metric"/],
    ['undated figure', ok + fence('metrics', 'Revenue | $1B | +5% | up'), /carries its date/],
    [
      'bad direction',
      ok + fence('metrics', 'Revenue | $1B @ Q2 2026 | +5% | sideways'),
      /direction is one of/,
    ],
    [
      'bad status word',
      ok + fence('scorecard', 'Pillar | Metric | Latest | fine | Kill'),
      /status is one of/,
    ],
    ['bridge off', ok + fence('bridge', 'Core | 10', 'Charge | -2', 'GAAP | 9'), /doesn't add up/],
    [
      'bar text too long for a phone',
      ok + '```chart bar "Revenue"\nQ1 | 10\nQ2 | 12 | guide | 12 (results Oct 21)\n```\n',
      /14 characters at most/,
    ],
    [
      'bad catalyst date',
      ok + fence('catalysts', 'soon | Results | Detail | expected'),
      /Write the date as/,
    ],
    ['reference without sources', ok + 'Revenue rose [3].', /no sources block/],
    [
      'reference not in sources',
      ok + 'Revenue rose [3].\n\n' + fence('sources', '1 | 10-Q | https://sec.gov/a'),
      /\[3\] has no row/,
    ],
    ['undated price', ok + valuation({ 'price:': 'price: 100' }), /"price" carries its date/],
    ['odds not in twentieths', ok + valuation({ 'tax:': 'tax: 20%\nodds: 5/5/5' }), /sum to 20/],
    [
      'terminal rate under growth',
      ok + valuation({ 'terminal_wacc:': 'terminal_wacc: 2%' }),
      /must be above "terminal_growth"/,
    ],
    ['missing scenario row', ok + valuation({ 'bull |': null }), /exactly one "bull" row/],
    [
      'rate without %',
      ok + valuation({ 'base |': 'base | 5 | 10% | 1.5 | 10% | 0% | 0 | Holds.' }),
      /growth must be a percentage/,
    ],
    ['implied without valuation', ok + fence('implied'), /this note has none/],
    [
      'bar filing with an unknown form',
      ok + fence('chart bar "Revenue"', 'Q1 | 10', 'Q2 | 12 | | | 10Q 2026-08-26'),
      /starts with its form/,
    ],
    [
      'bar filing with a form only',
      ok + fence('chart bar "Revenue"', 'Q1 | 10', 'Q2 | 12 | | | 10-Q'),
      /not just its form/,
    ],
    [
      'bar filing with a bad accession',
      ok + fence('chart bar "Revenue"', 'Q1 | 10', 'Q2 | 12 | | | 10-Q 1045810-26-75'),
      /accession number/,
    ],
    [
      'guidance bar with a filing',
      ok +
        fence(
          'chart bar "Revenue"',
          'Q1 | 10 | | | 10-Q 2026-05-20',
          'Q2 | 12 | guide | | 8-K 2026-08-26',
        ),
      /guidance bar has no filing/,
    ],
  ];
  for (const [name, source, pattern, file = NVDA] of cases) {
    const { note, errors } = parseNote(source, file);
    assert.equal(note, null, name);
    assert.ok(
      errors.some((e) => pattern.test(e.message)),
      `${name}: ${JSON.stringify(errors)}`,
    );
  }
});

test('a valid note keeps its fields, parts, numbered sections, blocks, sources and dates that age it', () => {
  const source = [
    front([
      'ticker: NVDA',
      'date: 2026-10-12',
      'updated: 2026-10-14',
      'title: "Supply still short"',
      'company: Nvidia',
      'stance: Bullish',
      'horizon: 2-6 weeks',
      'tags: [semis, "ai capex"]',
    ]),
    'Demand is **ahead** of supply per [the 10-Q](https://sec.gov/q.htm) [1].',
    '',
    fence('tldr', '3× | Lead times tripled [1].'),
    '',
    '# The verdict',
    '',
    '## Supply | Lead times still rise',
    '<!-- carried from 2026-09-01; re-confirmed 2026-10-12 -->',
    '- Lead times [up](https://a.example/x)',
    '  still rising',
    '  - nested *detail*.',
    '- snake_case_name stays literal',
    '',
    '| Metric | Value |',
    '|---|---:|',
    '| P/E | 35 |',
    '',
    '## Valuation',
    valuation(),
    '',
    '# The record',
    '',
    '## Catalysts',
    fence(
      'catalysts',
      '2026-11-05..2026-11-16 | Results | Guide $54B. | expected',
      '2026-10-01 | Launch | Shipped. | confirmed | It shipped.',
    ),
    fence('sources', '1 | 10-Q, Q2 2026 | https://www.sec.gov/q2'),
  ].join('\n');
  const { note, errors } = parseNote(source, NVDA);
  assert.deepEqual(errors, []);
  assert.equal(note.title, 'Supply still short');
  assert.equal(note.company, 'Nvidia');
  assert.equal(note.stance, 'bullish');
  assert.deepEqual(note.tags, ['semis', 'ai capex']);
  assert.equal(note.summary, 'Demand is ahead of supply per the 10-Q [1].');
  assert.deepEqual(
    note.lead.map((b) => b.type),
    ['paragraph', 'tldr'],
  );
  assert.deepEqual(
    note.parts.map((p) => [p.title, p.sections.map((s) => [s.n, s.label])]),
    [
      [
        'The verdict',
        [
          [1, 'Supply'],
          [2, 'Valuation'],
        ],
      ],
      ['The record', [[3, 'Catalysts']]],
    ],
  );
  const supply = note.parts[0].sections[0];
  assert.deepEqual(supply.title, [{ type: 'text', text: 'Lead times still rise' }]);
  assert.deepEqual(supply.carried, { from: '2026-09-01', reconfirmed: '2026-10-12' });
  assert.deepEqual(
    supply.blocks.map((b) => b.type),
    ['list', 'table'],
  );
  assert.equal(
    supply.blocks[0].items[0].list.items.length,
    1,
    'nested item attaches to its parent',
  );
  assert.deepEqual(supply.blocks[0].items[1].children, [
    { type: 'text', text: 'snake_case_name stays literal' },
  ]);
  // A sources block numbers the sources; the valuation is computed into the note.
  assert.deepEqual(note.sources, [
    { n: 1, href: 'https://www.sec.gov/q2', label: '10-Q, Q2 2026', host: 'sec.gov' },
  ]);
  const val = note.parts[0].sections[1].blocks[0];
  assert.equal(val.type, 'valuation');
  assert.ok(val.result.scenarios.base.value > 0);
  // The resolved catalyst no longer ages the note; the window counts from its end.
  assert.equal(note.aging.priceAsOf, '2026-10-12');
  assert.deepEqual(
    note.aging.events.map((e) => [e.label, e.when.end, e.resolved]),
    [
      ['Results', '2026-11-16', false],
      ['Launch', '2026-10-01', true],
    ],
  );
});

test('loadNotes reads only research/<TICKER>/*.md, sorts newest first, reports every problem, and refuses an unlogged move', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'research-notes-'));
  try {
    const dir = path.join(root, 'research');
    const write = (rel, text) => {
      mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      writeFileSync(path.join(dir, rel), text);
    };
    const note = (ticker, date, title, extra = []) =>
      front([`ticker: ${ticker}`, `date: ${date}`, `title: ${title}`, ...extra]) + 'Body.';
    write('README.md', 'not a note');
    write('_template.md', 'not a note');
    write('NVDA/_draft.md', 'ignored draft');
    write('NVDA/a.md', note('NVDA', '2026-09-01', 'Older', ['stance: watching']));
    write('NVDA/b.md', note('NVDA', '2026-10-01', 'Newer', ['stance: watching']));
    write('AMD/c.md', note('AMD', '2026-09-15', 'Middle'));

    const good = loadNotes(dir, root);
    assert.deepEqual(good.errors, []);
    assert.deepEqual(
      good.notes.map((n) => n.title),
      ['Newer', 'Middle', 'Older'],
    );
    assert.deepEqual(
      summarize(good.notes).map((s) => [s.ticker, s.count, s.latest.title]),
      [
        ['NVDA', 2, 'Newer'],
        ['AMD', 1, 'Middle'],
      ],
    );

    // The stance moved between notes: refused until a moves row names it.
    write('NVDA/b.md', note('NVDA', '2026-10-01', 'Newer', ['stance: bullish']));
    const moved = loadNotes(dir, root);
    assert.match(
      moved.errors.map((e) => e.message).join('\n'),
      /"stance" moved from watching to bullish/,
    );
    write(
      'NVDA/b.md',
      front(['ticker: NVDA', 'date: 2026-10-01', 'title: Newer', 'stance: bullish']) +
        fence('moves', 'stance | watching → bullish | Q3 results | Supply eased.'),
    );
    assert.deepEqual(loadNotes(dir, root).errors, []);

    write('nvda-lower/x.md', note('NVDA', '2026-10-01', 'Bad folder'));
    write('AMD/bad name.md', note('AMD', '2026-10-01', 'Bad file'));
    write('AMD/d.md', note('AMD', '2026-13-01', 'Bad date'));
    const bad = loadNotes(dir, root);
    assert.deepEqual(bad.errors.map((e) => e.path).sort(), [
      'research/AMD/bad name.md',
      'research/AMD/d.md',
      'research/nvda-lower',
    ]);
    assert.equal(bad.notes.length, 3, 'valid notes still load beside invalid ones');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a chart bar names the filing that reported it: form, accession, filed date', () => {
  assert.deepEqual(parseFilingCell('10-Q 0001045810-26-000075'), {
    form: '10-Q',
    accession: '0001045810-26-000075',
    filed: null,
  });
  assert.deepEqual(parseFilingCell(' 10-K  2026-02-25 0001045810-26-000021 '), {
    form: '10-K',
    accession: '0001045810-26-000021',
    filed: '2026-02-25',
  });
  assert.deepEqual(parseFilingCell('S-1/A 2026-05-11'), {
    form: 'S-1/A',
    accession: null,
    filed: '2026-05-11',
  });
  assert.equal(parseFilingCell(''), null);
  assert.match(parseFilingCell('10-Q 2026-02-30').error, /accession number/);
  assert.match(parseFilingCell('10-Q 2026-08-26 2026-08-27').error, /accession number/);
  const source = [
    ok,
    'Lead.',
    '',
    '# The evidence',
    '',
    '## Revenue',
    fence(
      'chart bar "Quarterly revenue, $M"',
      'Q1 FY27 | 81615 | | | 10-Q 0001045810-26-000052',
      'Q2 FY27 | 96221',
      'Q3 FY27 guide | 108000 | guide | 108,000 ± 2%',
    ),
  ].join('\n');
  const { note, errors } = parseNote(source, NVDA);
  assert.deepEqual(errors, []);
  const chart = note.parts[0].sections[0].blocks[0];
  assert.deepEqual(
    chart.bars.map((b) => b.filing),
    [{ form: '10-Q', accession: '0001045810-26-000052', filed: null }, null, null],
  );
  assert.equal(chart.latest, 1);
});
