#!/usr/bin/env node
// `npm run research:new <TICKER>` writes the next note from the latest one, under the update rules
// (docs/research-method/README.md): the old note is the starting view and the checklist, never the
// draft. Facts are blanked to `___` (look them up again), every section is flagged re-confirm, judgments
// keep their old values (move them with a `moves` row), and a `since` block lists the old calls to
// score first. `research:check` refuses the note until every blank and flag is dealt with.
//
// `--fresh` starts from research/_template.md instead: a new ticker, or a thesis that broke.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localToday } from './freshness.mjs';
import { loadNotes, TICKER_RE } from './notes.mjs';
import { splitCells } from './valuation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const researchDir = path.join(root, 'research');
const args = process.argv.slice(2);
const fresh = args.includes('--fresh');
const ticker = (args.find((a) => !a.startsWith('--')) ?? '').toUpperCase();
if (!TICKER_RE.test(ticker)) {
  console.error('usage: npm run research:new <TICKER> [-- --fresh]');
  process.exit(1);
}
const today = localToday();
const { notes, errors } = loadNotes(researchDir, root);
const latest = notes.find((n) => n.ticker === ticker);
if (!fresh && errors.some((e) => e.path.startsWith(`research/${ticker}/`))) {
  console.error(`research: fix ${ticker}'s notes first (npm run research:check).`);
  process.exit(1);
}
if (!fresh && !latest) {
  console.error(
    `research: ${ticker} has no notes yet. Start one with: npm run research:new ${ticker} -- --fresh`,
  );
  process.exit(1);
}

const name = `${today}-${fresh ? (latest ? 'fresh' : 'initiation') : 'update'}.md`;
const out = path.join(researchDir, ticker, name);
if (existsSync(out)) {
  console.error(`research: research/${ticker}/${name} already exists.`);
  process.exit(1);
}

let text;
if (fresh) {
  text = readFileSync(path.join(researchDir, '_template.md'), 'utf8')
    .replace(/^ticker: .*$/m, `ticker: ${ticker}`)
    .replace(/^date: .*$/m, `date: ${today}`);
} else text = scaffold(readFileSync(path.join(root, latest.path), 'utf8'), latest);

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, text);
console.log(`Wrote research/${ticker}/${name}${latest ? `\nfrom  ${latest.path}` : ''}`);
console.log(
  'Fill every ___ and clear every re-confirm flag; npm run research:check lists what is left.',
);

/** The update scaffold: line by line, aware of which fenced block each line sits in. */
function scaffold(source, prev) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const outLines = [];
  const blank = (cells) => cells.join(' | ');
  let block = null;
  let inFront = false;
  let frontDone = false;
  let sinceWritten = false;
  const since = sinceRows(prev);
  for (const line of lines) {
    if (!frontDone) {
      if (line.trim() === '---') {
        if (inFront) frontDone = true;
        inFront = true;
        outLines.push(line);
        continue;
      }
      if (/^date:/.test(line)) outLines.push(`date: ${today}`);
      else if (/^title:/.test(line)) outLines.push('title: ___');
      else if (/^(updated|summary|not_following_since):/.test(line)) continue;
      else outLines.push(line);
      continue;
    }
    const fence = /^ *```\s*([a-z]*)/.exec(line);
    if (fence) {
      if (block === null) block = fence[1] || 'code';
      else if (/^ *```\s*$/.test(line)) {
        if (block === 'changelog') outLines.push(`${today} | update | ___`);
        block = null;
      }
      outLines.push(line);
      continue;
    }
    if (block === null) {
      // The lead is a summary of the old facts: it gets rewritten, not carried.
      if (!sinceWritten && line.trim() && !/^#/.test(line) && !/^<!--/.test(line)) {
        outLines.push(`___ ${line.trim()}`);
        continue;
      }
      if (/^# /.test(line) && !sinceWritten) {
        outLines.push(
          '# Since the last note',
          '',
          `## The old calls | ___`,
          '',
          '```since',
          ...since,
          '```',
          '',
        );
        sinceWritten = true;
      }
      if (/^<!--\s*carried from/.test(line)) continue;
      outLines.push(line);
      if (/^## /.test(line)) outLines.push(`<!-- re-confirm: carried from ${prev.date} -->`);
      continue;
    }
    if (!line.trim()) {
      outLines.push(line);
      continue;
    }
    const cells = splitCells(line);
    switch (block) {
      case 'strip':
        outLines.push(blank([cells[0], '___ @ ___', '___']));
        break;
      case 'metrics':
        outLines.push(blank([cells[0], '___ @ ___', '___', cells[3] || 'flat', '___']));
        break;
      case 'tldr':
        outLines.push(blank(['___', '___']));
        break;
      case 'scorecard':
        outLines.push(blank([cells[0], cells[1], '___', cells[3], cells[4]]));
        break;
      case 'valuation': {
        const m = /^(price|shares|net_cash|revenue|margin_now|nol):/.exec(line.trim());
        if (m) outLines.push(`${m[1]}: ___ @ ___`);
        else if (/^(traded|third_party):/.test(line.trim()))
          outLines.push(`${line.trim().split(':')[0]}: ___`);
        else outLines.push(line);
        break;
      }
      default:
        outLines.push(line);
    }
  }
  return outLines.join('\n');
}

/** The old note's calls, each waiting for what happened. */
function sinceRows(prev) {
  const rows = [];
  const all = [
    ...prev.lead,
    ...prev.parts.flatMap((p) => [...p.intro, ...p.sections.flatMap((s) => s.blocks)]),
  ];
  const plain = (inlines) =>
    inlines
      .map((n) => n.text ?? plain(n.children ?? []))
      .join('')
      .replace(/\|/g, '\\|');
  for (const b of all) {
    if (b.type === 'catalysts')
      for (const c of b.items)
        if (!c.outcome) rows.push(`catalyst | ${c.when.text} ${c.event} | ___`);
    if (b.type === 'forecasts')
      for (const f of b.items) if (!f.outcome) rows.push(`forecast | ${plain(f.claim)} | ___`);
    if (b.type === 'kill')
      for (const k of b.items)
        if (!k.outcome) rows.push(`kill | ${k.n} ${k.trigger.replace(/\|/g, '\\|')} | ___`);
    if (b.type === 'scorecard') for (const s of b.items) rows.push(`pillar | ${s.pillar} | ___`);
  }
  return rows.length ? rows : ['catalyst | ___ | ___'];
}
