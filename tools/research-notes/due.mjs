#!/usr/bin/env node
// `npm run research:due`: each ticker's latest note, whether it is due for review, and the dates that
// will age it next. Run it by hand; it reads the clock, so it is never part of pre-push
// (docs/research-method/README.md).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays, formatDay } from './dates.mjs';
import { freshness, localToday, PRICE_STALE_DAYS } from './freshness.mjs';
import { formatErrors, loadNotes } from './notes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { notes, errors } = loadNotes(path.join(root, 'research'), root);
if (errors.length) {
  console.error(`research: ${errors.length} problem(s)\n${formatErrors(errors)}`);
  process.exit(1);
}
const today = localToday();
const latest = new Map();
for (const n of notes) if (!latest.has(n.ticker)) latest.set(n.ticker, n);

const due = [];
const ahead = [];
for (const note of latest.values()) {
  const f = freshness(note.aging, { today, notFollowingSince: note.notFollowingSince });
  if (f.state === 'archived') continue;
  if (f.state === 'due') due.push({ note, f });
  for (const e of note.aging.events)
    if (!e.resolved && e.when.end && e.when.end >= today)
      ahead.push({
        date: e.when.end,
        ticker: note.ticker,
        label: e.label,
        whenLabel: e.when.label,
      });
  if (note.aging.priceAsOf && !f.priceStale)
    ahead.push({
      date: addDays(note.aging.priceAsOf, PRICE_STALE_DAYS),
      ticker: note.ticker,
      label: `Price turns ${PRICE_STALE_DAYS} days old`,
      whenLabel: '',
    });
}

console.log(`As of ${formatDay(today)}`);
if (!due.length) console.log('Due now: none');
else {
  console.log('Due now:');
  for (const { note, f } of due)
    console.log(
      `  ${note.ticker.padEnd(6)} ${note.slug}.md, since ${formatDay(f.since)}: ` +
        f.passed.map((e) => e.label).join(' · '),
    );
}
ahead.sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker));
const all = process.argv.includes('--all');
const shown = all ? ahead : ahead.slice(0, 12);
if (shown.length) {
  console.log(`\nComing due${all ? '' : ' (next 12; --all for every date)'}`);
  for (const r of shown) {
    const window = r.whenLabel && r.whenLabel !== formatDay(r.date) ? ` (${r.whenLabel})` : '';
    console.log(`  ${formatDay(r.date).padEnd(13)} ${r.ticker.padEnd(6)} ${r.label}${window}`);
  }
}
