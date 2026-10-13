// Research notes are published on the public site as written, so the parser is a floor item: it must
// refuse unsafe links and malformed front matter (a bad note fails the build instead of deploying)
// and keep the structure the dashboard renders.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { loadNotes, parseNote, summarize } from './notes.mjs';

const front = (fields) => ['---', ...fields, '---', ''].join('\n');
const BASE = ['ticker: NVDA', 'date: 2026-10-12', 'title: Supply still short'];
const ok = front(BASE);
const withField = (line) => front([...BASE, line]);
const NVDA = 'research/NVDA/2026-10-12-supply.md';

test('front matter and links: each bad input is refused with a message naming the problem', () => {
  const cases = [
    ['no front matter', 'Just text.', /must start with front matter/],
    ['unclosed front matter', '---\nticker: NVDA\n', /never closed/],
    ['missing title', front(['ticker: NVDA', 'date: 2026-10-12']) + 'Body.', /"title"/],
    ['unknown field', withField('tikcer: X') + 'Body.', /Unknown field "tikcer"/],
    ['duplicate field', withField('title: Again') + 'Body.', /appears twice/],
    ['impossible date', ok.replace('2026-10-12', '2026-02-30') + 'Body.', /real date/],
    ['bad stance', withField('stance: moon') + 'Body.', /"stance" must be/],
    ['folder mismatch', ok + 'Body.', /doesn't match its folder/, 'research/AMD/x.md'],
    ['lowercase ticker', ok.replace('NVDA', 'nvda') + 'Body.', /uppercase symbol/],
    ['empty body', ok, /no body/],
    ['h1 in body', ok + '# Title again', /Use the "title" field/],
    ['javascript: link', ok + '[x](javascript:alert(1))', /Links must start with/],
    ['data: link', ok + '[x](data:text/html,hi)', /Links must start with/],
    ['protocol-relative link', ok + '[x](//evil.example/a)', /Links must start with/],
    ['unclosed code block', ok + '```\ncode', /never closed/],
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

test('a valid note keeps its fields, structure, sources and a plain-text summary', () => {
  const source = [
    front([
      'ticker: NVDA',
      'date: 2026-10-12',
      'updated: 2026-10-14',
      'title: "Supply still short"',
      'stance: Bullish',
      'horizon: 2-6 weeks',
      'tags: [semis, "ai capex"]',
    ]),
    'Demand is **ahead** of supply per [the 10-Q](https://sec.gov/q.htm); see /ticker/NVDA.',
    '',
    '## Evidence',
    '- Lead times [up](https://a.example/x)',
    '  still rising',
    '  - nested *detail* and https://b.example/y.',
    '- snake_case_name stays literal',
    '',
    '| Metric | Value |',
    '|---|---:|',
    '| P/E | 35 |',
    '',
    '> Quoted [same](https://a.example/x)',
  ].join('\n');
  const { note, errors } = parseNote(source, NVDA);
  assert.deepEqual(errors, []);
  assert.equal(note.ticker, 'NVDA');
  assert.equal(note.title, 'Supply still short');
  assert.equal(note.stance, 'bullish');
  assert.deepEqual(note.tags, ['semis', 'ai capex']);
  assert.equal(note.slug, '2026-10-12-supply');
  assert.equal(note.summary, 'Demand is ahead of supply per the 10-Q; see /ticker/NVDA.');
  assert.deepEqual(
    note.blocks.map((b) => b.type),
    ['paragraph', 'heading', 'list', 'table', 'quote'],
  );
  const list = note.blocks[2];
  assert.equal(list.items.length, 2);
  assert.equal(list.items[0].list.items.length, 1, 'nested item attaches to its parent');
  assert.match(JSON.stringify(list.items[0].children), /still rising/);
  assert.deepEqual(list.items[1].children, [
    { type: 'text', text: 'snake_case_name stays literal' },
  ]);
  assert.deepEqual(note.blocks[3].rows, [
    [[{ type: 'text', text: 'P/E' }], [{ type: 'text', text: '35' }]],
  ]);
  // Sources: external links only, deduplicated, labelled by text or host; trailing "." trimmed.
  assert.deepEqual(note.sources, [
    { href: 'https://sec.gov/q.htm', label: 'the 10-Q' },
    { href: 'https://a.example/x', label: 'up' },
    { href: 'https://b.example/y', label: 'b.example' },
  ]);
});

test('loadNotes reads only research/<TICKER>/*.md, sorts newest first, and reports every problem', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'research-notes-'));
  try {
    const dir = path.join(root, 'research');
    const write = (rel, text) => {
      mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      writeFileSync(path.join(dir, rel), text);
    };
    const note = (ticker, date, title) =>
      front([`ticker: ${ticker}`, `date: ${date}`, `title: ${title}`]) + 'Body.';
    write('README.md', 'not a note');
    write('_template.md', 'not a note');
    write('NVDA/_draft.md', 'ignored draft');
    write('NVDA/a.md', note('NVDA', '2026-09-01', 'Older'));
    write('NVDA/b.md', note('NVDA', '2026-10-01', 'Newer'));
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
