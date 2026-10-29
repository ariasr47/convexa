/**
 * Turn the generated atlas into the page body a claude.ai artifact publishes. The artifact's publish
 * step wraps a page in its own document (doctype, head, charset, viewport), so this keeps the rest of
 * the head, title first, and the body, without the document's own wrappers. Nothing else changes.
 *
 *   node tools/atlas/artifact.mjs [--in docs/atlas/index.html] --out <file>
 *
 * docs/atlas/README.md ("The published copy") says where the result goes.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 1 ? process.argv[i + 1] : fallback;
};
const input = arg('--in', 'docs/atlas/index.html');
const out = arg('--out');
if (!out) {
  console.error('usage: node tools/atlas/artifact.mjs [--in <page>] --out <file>');
  process.exit(2);
}

const html = readFileSync(input, 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/);
const body = html.match(/<body>([\s\S]*)<\/body>/);
const title = head?.[1].match(/<title>[^<]*<\/title>/);
if (!head || !body || !title) {
  console.error(`${input}: expected a <head> with a <title>, and a <body>`);
  process.exit(1);
}

const rest = head[1]
  .replace(title[0], '')
  .replace(/<meta charset="[^"]*">\n?/, '')
  .replace(/<meta name="viewport"[^>]*>\n?/, '')
  .trim();
const page = `${title[0]}\n${rest}\n${body[1].trim()}\n`;
writeFileSync(out, page);
console.log(`${out}: ${page.length} bytes, ${title[0]}`);
