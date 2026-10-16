#!/usr/bin/env node
// The research check's filing pass: every figure in a ticker's latest note that names an XBRL concept,
// against a SAVED SEC company-facts answer for that ticker. It never fetches: SEC asks every program
// that reads EDGAR for a contact address, so the facts are saved beside the notes by
// save-filings.mjs (run by hand with SEC_USER_AGENT set), and this check reads only those files.
// `npm run verify` runs it (tools/verify.mjs) when research/ or tools/ changed.
//
//   node tools/research-notes/check-filings.mjs [--facts research/_filings] [--research research]
//
// A saved answer is `<facts dir>/<TICKER>.json`, the body of
// https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json. It lists the same differences the
// note page shows and exits 1 on any it can't explain: a figure that differs from the filing, a concept
// the filing doesn't tag, units that don't fit, or a figure or period it can't read. Writing the reason
// after `;` in the figure's concept cell explains a difference ("as reported in the 8-K"). A ticker
// with no saved answer, and a period no saved filing covers, are listed as not checked, not failed.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UNEXPLAINED, checkFigures, filingsFromCompanyFacts } from './filing-check.mjs';
import { formatErrors, loadNotes, summarize } from './notes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : path.resolve(process.argv[at + 1] ?? fallback);
};
const researchDir = arg('--research', path.join(root, 'research'));
const factsDir = arg('--facts', path.join(researchDir, '_filings'));
const rel = (p) => path.relative(process.cwd(), p).split(path.sep).join('/') || '.';

const { notes, errors } = loadNotes(researchDir, path.dirname(researchDir));
if (errors.length) {
  console.error(`filings: the notes have ${errors.length} problem(s)\n${formatErrors(errors)}`);
  process.exit(1);
}

let failed = 0;
let checked = 0;
let unchecked = 0;
for (const { ticker, latest } of summarize(notes)) {
  const figures = latest.figures;
  if (!figures.length) continue;
  const note = notes.find((n) => n.ticker === ticker && n.slug === latest.slug);
  const where = note?.path ?? `research/${ticker}`;
  const file = path.join(factsDir, `${ticker}.json`);
  if (!existsSync(file)) {
    unchecked += figures.length;
    console.log(
      `${where}: ${figures.length} figure(s) not checked: no saved company facts at ${rel(file)}`,
    );
    continue;
  }
  let json;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    failed += 1;
    console.error(`${rel(file)}: not a company-facts answer (${error.message})`);
    continue;
  }
  const rows = checkFigures(figures, filingsFromCompanyFacts(json));
  for (const r of rows) {
    const head = `${where}  ${r.label} · ${r.asOf}`;
    if (r.status === 'matches' || r.status === 'computed') {
      checked += 1;
      console.log(
        `${head}: ${r.status === 'matches' ? 'matches' : 'computed, agrees'} (${r.note} · ${r.filedText} in the ${r.form})`,
      );
    } else if (r.status === 'not_tagged') {
      checked += 1;
      console.log(`${head}: not tagged · cites the filing`);
    } else if (r.status === 'pending' || r.status === 'not_found') {
      unchecked += 1;
      console.log(`${head}: not checked: ${r.detail}`);
    } else if (UNEXPLAINED.includes(r.status) && r.why) {
      checked += 1;
      console.log(
        `${head}: ${r.status}${r.gap ? ` by ${r.gap}` : ''}, explained: ${r.why}. ${r.detail}`,
      );
    } else {
      failed += 1;
      const fix =
        r.status === 'differs'
          ? `Fix it or explain it after ";" in its concept cell.`
          : `Fix the figure's concept, value or date.`;
      console.error(`${head}: ${r.status}${r.gap ? ` by ${r.gap}` : ''}. ${r.detail} ${fix}`);
    }
  }
}

console.log(
  `filings: ${checked} figure(s) checked, ${unchecked} not checked, ${failed} unexplained`,
);
process.exit(failed ? 1 : 0);
