#!/usr/bin/env node
// Save the SEC company facts the filing check reads (check-filings.mjs): for each ticker whose latest
// note names XBRL concepts, read https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json, keep
// only the concepts the note names, and write
//   research/_filings/<TICKER>.json         the company-facts answer, sliced to those concepts
//   research/_filings/<TICKER>.source.json  where it came from: the URL, the day it was read, the concepts
//
//   SEC_USER_AGENT='<name> <email>' node tools/research-notes/save-filings.mjs [TICKER ...]
//
// SEC asks every program that reads EDGAR to name itself with a contact address
// (https://www.sec.gov/os/accessing-edgar-data), so this reads SEC_USER_AGENT from the environment and
// refuses without it; the value is never written anywhere. At most four requests a second (SEC allows
// ten). A slice is written only when the check reads it exactly as it reads the whole answer, so cutting
// the file never changes a result. Run it by hand after writing a note that names new concepts or
// periods; the check itself never fetches.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFigures, filingsFromCompanyFacts, parseConceptCell } from './filing-check.mjs';
import { localToday } from './freshness.mjs';
import { formatErrors, loadNotes, summarize } from './notes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const researchDir = path.join(root, 'research');
const factsDir = path.join(researchDir, '_filings');
const agent = process.env.SEC_USER_AGENT?.trim();
if (!agent) {
  console.error(
    'filings: set SEC_USER_AGENT to "<name> <email>" (SEC asks for a contact address).',
  );
  process.exit(1);
}

const { notes, errors } = loadNotes(researchDir, root);
if (errors.length) {
  console.error(`filings: the notes have ${errors.length} problem(s)\n${formatErrors(errors)}`);
  process.exit(1);
}
const only = process.argv.slice(2).map((t) => t.toUpperCase());
const wanted = summarize(notes)
  .filter(({ ticker, latest }) => latest.figures.length && (!only.length || only.includes(ticker)))
  .map(({ ticker, latest }) => {
    const concepts = new Set();
    for (const f of latest.figures) {
      const parsed = parseConceptCell(f.concept);
      if (!('error' in parsed)) for (const t of parsed.terms) concepts.add(t);
    }
    return { ticker, figures: latest.figures, concepts: [...concepts].sort() };
  })
  .filter((t) => t.concepts.length);
if (!wanted.length) {
  console.log('filings: no latest note names a concept; nothing to save');
  process.exit(0);
}

let last = 0;
async function secGet(url) {
  const wait = last + 250 - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  last = Date.now();
  const res = await fetch(url, { headers: { 'User-Agent': agent, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

const fetched = localToday();
const tickers = await secGet('https://www.sec.gov/files/company_tickers.json');
const cikOf = new Map(Object.values(tickers).map((r) => [String(r.ticker).toUpperCase(), r]));
mkdirSync(factsDir, { recursive: true });

let failed = 0;
for (const { ticker, figures, concepts } of wanted) {
  const row = cikOf.get(ticker);
  if (!row) {
    failed += 1;
    console.error(
      `${ticker}: not in SEC's ticker list (https://www.sec.gov/files/company_tickers.json)`,
    );
    continue;
  }
  const cik = String(row.cik_str).padStart(10, '0');
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
  let full;
  try {
    full = await secGet(url);
  } catch (error) {
    failed += 1;
    console.error(`${ticker}: ${error.message}`);
    continue;
  }
  /** @type {Record<string, Record<string, unknown>>} */
  const facts = {};
  const absent = [];
  for (const concept of concepts) {
    const [taxonomy, name] = concept.split(':');
    const body = full?.facts?.[taxonomy]?.[name];
    if (!body) {
      absent.push(concept);
      continue;
    }
    (facts[taxonomy] ??= {})[name] = body;
  }
  const slice = { cik: full.cik, entityName: full.entityName, facts };
  // The slice must give the check the same filings and the same answers as the whole file.
  const same =
    JSON.stringify(checkFigures(figures, filingsFromCompanyFacts(full))) ===
    JSON.stringify(checkFigures(figures, filingsFromCompanyFacts(slice)));
  if (!same) {
    failed += 1;
    console.error(`${ticker}: the slice reads differently from the whole answer; not saved`);
    continue;
  }
  const json = `${JSON.stringify(slice)}\n`;
  writeFileSync(path.join(factsDir, `${ticker}.json`), json);
  const source = { ticker, cik, entity: full.entityName, url, fetched, concepts };
  writeFileSync(
    path.join(factsDir, `${ticker}.source.json`),
    `${JSON.stringify(source, null, 2)}\n`,
  );
  console.log(
    `${ticker}: saved ${concepts.length} concept(s), ${(json.length / 1024).toFixed(0)} KB` +
      (absent.length ? `; not in the filing's facts: ${absent.join(', ')}` : ''),
  );
}
process.exit(failed ? 1 : 0);
