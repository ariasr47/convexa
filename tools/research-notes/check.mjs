#!/usr/bin/env node
// `npm run research:check`: parse every note under research/ and list each problem with its file and
// line. Exit 1 on any problem. The pre-push hook runs it, so a malformed note is caught before the
// Cloudflare build would fail on it.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatErrors, loadNotes } from './notes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { notes, errors } = loadNotes(path.join(root, 'research'), root);
if (errors.length) {
  console.error(`research: ${errors.length} problem(s)\n${formatErrors(errors)}`);
  process.exit(1);
}
const tickers = new Set(notes.map((n) => n.ticker)).size;
console.log(`research: ${notes.length} note(s) across ${tickers} ticker(s), all valid`);
