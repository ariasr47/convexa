// Research notes: the owner's ticker research, written as Markdown under research/<TICKER>/*.md and
// compiled into the dashboard at build time (tools/research-notes/vite-plugin.mjs). No backend is involved,
// so research keeps working while market data is paused.
//
// The format is a deliberate SUBSET of Markdown, parsed here into a small block/inline tree that the
// dashboard renders with React elements. No HTML is ever produced, so nothing in a note can inject
// markup, and a link may only point at http(s) or a same-site path: anything else (javascript:,
// data:, …) is a hard error, never a silently dropped link. Front matter is a strict `key: value`
// list; an unknown or missing key fails the build, so a typo can't publish a half-labelled note.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * @typedef {{ type: 'text', text: string }
 *   | { type: 'strong', children: Inline[] }
 *   | { type: 'em', children: Inline[] }
 *   | { type: 'code', text: string }
 *   | { type: 'link', href: string, children: Inline[] }} Inline
 * @typedef {{ children: Inline[], list?: ListBlock }} ListItem
 * @typedef {{ type: 'list', ordered: boolean, items: ListItem[] }} ListBlock
 * @typedef {{ type: 'heading', level: 2 | 3, children: Inline[] }
 *   | { type: 'paragraph', children: Inline[] }
 *   | ListBlock
 *   | { type: 'quote', children: Block[] }
 *   | { type: 'codeblock', text: string }
 *   | { type: 'table', header: Inline[][], rows: Inline[][][] }
 *   | { type: 'rule' }} Block
 * @typedef {'bullish' | 'bearish' | 'neutral' | 'watching'} Stance
 * @typedef {{
 *   ticker: string, date: string, title: string, slug: string, path: string,
 *   stance: Stance | null, horizon: string | null, updated: string | null,
 *   tags: string[], summary: string, blocks: Block[], sources: { href: string, label: string }[]
 * }} ResearchNote
 * @typedef {{ path: string, line: number, message: string }} NoteError
 */

export const TICKER_RE = /^[A-Z][A-Z0-9.-]{0,9}$/;
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.md$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const STANCES = ['bullish', 'bearish', 'neutral', 'watching'];
const KEYS = ['ticker', 'date', 'title', 'stance', 'horizon', 'tags', 'summary', 'updated'];
const REQUIRED = ['ticker', 'date', 'title'];
const SUMMARY_MAX = 240;

function isCalendarDate(value) {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

function unquote(value) {
  const v = value.trim();
  if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'")))
    return v.slice(1, -1);
  return v;
}

/** Split `---` front matter from the body. Returns null fields and an error when it is malformed. */
function splitFrontMatter(lines, fail) {
  if (lines[0]?.trim() !== '---') {
    fail(1, 'A note must start with front matter: a line with just "---".');
    return null;
  }
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end === -1) {
    fail(1, 'Front matter is never closed: add a line with just "---" after the last field.');
    return null;
  }
  /** @type {Record<string, { value: string, line: number }>} */
  const fields = {};
  for (let i = 1; i < end; i++) {
    const raw = lines[i];
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue;
    const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(raw);
    if (!m) {
      fail(i + 1, `Front matter lines are "key: value"; got ${JSON.stringify(raw.trim())}.`);
      continue;
    }
    const key = m[1];
    if (!KEYS.includes(key)) {
      fail(i + 1, `Unknown field "${key}". Allowed: ${KEYS.join(', ')}.`);
      continue;
    }
    if (key in fields) {
      fail(i + 1, `Field "${key}" appears twice.`);
      continue;
    }
    fields[key] = { value: unquote(m[2]), line: i + 1 };
  }
  return { fields, bodyStart: end + 1 };
}

// ---------------------------------------------------------------------------------------------
// Inline parsing

/** @returns {string | null} an error message, or null when the href is allowed. */
function checkHref(href) {
  if (/^https?:\/\/[^\s]+$/i.test(href)) return null;
  if (href.startsWith('/') && !href.startsWith('//')) return null;
  return `Links must start with https://, http:// or / (a page on this site); got ${JSON.stringify(href)}.`;
}

function findClosing(text, from, marker) {
  for (let i = from; i <= text.length - marker.length; i++) {
    if (text[i] === '\\') {
      i++;
      continue;
    }
    if (text.startsWith(marker, i)) return i;
  }
  return -1;
}

const PUNCT_OR_SPACE = /[\s.,;:!?()[\]{}"'—–-]/;
const AUTOLINK_RE = /^https?:\/\/[^\s<>()]+/i;

/**
 * @param {string} text
 * @param {(message: string) => void} fail
 * @param {boolean} [allowLinks] false inside a link label, so links never nest
 * @returns {Inline[]}
 */
export function parseInline(text, fail, allowLinks = true) {
  /** @type {Inline[]} */
  const out = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push({ type: 'text', text: buf });
    buf = '';
  };
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\' && i + 1 < text.length && /[\\`*_[\]()#>|!-]/.test(text[i + 1])) {
      buf += text[i + 1];
      i += 2;
      continue;
    }
    if (ch === '`') {
      const close = text.indexOf('`', i + 1);
      if (close > i + 1) {
        flush();
        out.push({ type: 'code', text: text.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
    }
    const isImage = ch === '!' && text[i + 1] === '[';
    if (allowLinks && (ch === '[' || isImage)) {
      const open = isImage ? i + 1 : i;
      const closeBracket = findClosing(text, open + 1, ']');
      if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          const href = text.slice(closeBracket + 2, closeParen).trim();
          const label = text.slice(open + 1, closeBracket);
          const problem = checkHref(href);
          if (problem) fail(problem);
          else {
            flush();
            out.push({
              type: 'link',
              href,
              children: label ? parseInline(label, fail, false) : [{ type: 'text', text: href }],
            });
          }
          i = closeParen + 1;
          continue;
        }
      }
    }
    if (allowLinks && ch === 'h' && (i === 0 || PUNCT_OR_SPACE.test(text[i - 1]))) {
      const m = AUTOLINK_RE.exec(text.slice(i));
      if (m) {
        const href = m[0].replace(/[.,;:!?'"]+$/, '');
        flush();
        out.push({ type: 'link', href, children: [{ type: 'text', text: href }] });
        i += href.length;
        continue;
      }
    }
    if (ch === '*' && text[i + 1] === '*') {
      const close = findClosing(text, i + 2, '**');
      if (close > i + 2) {
        flush();
        out.push({
          type: 'strong',
          children: parseInline(text.slice(i + 2, close), fail, allowLinks),
        });
        i = close + 2;
        continue;
      }
    }
    if (ch === '*' || ch === '_') {
      const opensWord = ch === '*' || i === 0 || PUNCT_OR_SPACE.test(text[i - 1]);
      if (opensWord && text[i + 1] && !/\s/.test(text[i + 1])) {
        let close = findClosing(text, i + 1, ch);
        // `_` closes only at a word end, so snake_case_names stay literal.
        while (
          ch === '_' &&
          close !== -1 &&
          close + 1 < text.length &&
          !PUNCT_OR_SPACE.test(text[close + 1])
        )
          close = findClosing(text, close + 1, ch);
        if (close > i + 1 && !/\s/.test(text[close - 1])) {
          flush();
          out.push({
            type: 'em',
            children: parseInline(text.slice(i + 1, close), fail, allowLinks),
          });
          i = close + 1;
          continue;
        }
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

// ---------------------------------------------------------------------------------------------
// Block parsing

const LIST_RE = /^( *)([-*+]|\d{1,3}[.)]) +(.*)$/;
const HEADING_RE = /^(#{1,6}) +(.*?)\s*#*\s*$/;
const RULE_RE = /^ {0,3}([-*_])( *\1){2,} *$/;
const TABLE_SEP_RE = /^ *\|? *:?-{3,}:? *(\| *:?-{3,}:? *)*\|? *$/;

function splitRow(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  const cells = [];
  let cell = '';
  for (let i = 0; i < row.length; i++) {
    if (row[i] === '\\' && row[i + 1] === '|') {
      cell += '|';
      i++;
    } else if (row[i] === '|') {
      cells.push(cell.trim());
      cell = '';
    } else cell += row[i];
  }
  cells.push(cell.trim());
  return cells;
}

function startsBlock(line, next) {
  return (
    line.trim() === '' ||
    HEADING_RE.test(line) ||
    RULE_RE.test(line) ||
    LIST_RE.test(line) ||
    line.trimStart().startsWith('>') ||
    line.trimStart().startsWith('```') ||
    (line.trimStart().startsWith('|') && next !== undefined && TABLE_SEP_RE.test(next))
  );
}

/**
 * @param {string[]} lines
 * @param {number} firstLine 1-based line number of lines[0], for error messages
 * @param {(line: number, message: string) => void} fail
 * @returns {Block[]}
 */
export function parseBlocks(lines, firstLine, fail) {
  /** @type {Block[]} */
  const blocks = [];
  let i = 0;
  const inline = (text, at) => parseInline(text, (message) => fail(firstLine + at, message));
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    const fence = /^ *```/.exec(line);
    if (fence) {
      const close = lines.findIndex((l, j) => j > i && /^ *```\s*$/.test(l));
      if (close === -1) {
        fail(firstLine + i, 'Code block is never closed: add a line with just ```.');
        break;
      }
      blocks.push({ type: 'codeblock', text: lines.slice(i + 1, close).join('\n') });
      i = close + 1;
      continue;
    }
    const heading = HEADING_RE.exec(line);
    if (heading) {
      if (heading[1].length === 1)
        fail(
          firstLine + i,
          'Use the "title" field for the note title; start sections at "##" headings.',
        );
      else
        blocks.push({
          type: 'heading',
          level: heading[1].length === 2 ? 2 : 3,
          children: inline(heading[2], i),
        });
      i++;
      continue;
    }
    if (RULE_RE.test(line)) {
      blocks.push({ type: 'rule' });
      i++;
      continue;
    }
    if (line.trimStart().startsWith('>')) {
      const inner = [];
      const start = i;
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        inner.push(lines[i].trimStart().replace(/^> ?/, ''));
        i++;
      }
      blocks.push({ type: 'quote', children: parseBlocks(inner, firstLine + start, fail) });
      continue;
    }
    if (line.trimStart().startsWith('|') && TABLE_SEP_RE.test(lines[i + 1] ?? '')) {
      const header = splitRow(line).map((c) => inline(c, i));
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trimStart().startsWith('|')) {
        const at = i;
        const cells = splitRow(lines[i]).map((c) => inline(c, at));
        while (cells.length < header.length) cells.push([]);
        rows.push(cells.slice(0, header.length));
        i++;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }
    if (LIST_RE.test(line)) {
      const parsed = parseList(lines, i, firstLine, fail);
      blocks.push(parsed.list);
      i = parsed.next;
      continue;
    }
    const para = [];
    const start = i;
    while (i < lines.length && (i === start || !startsBlock(lines[i], lines[i + 1]))) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: 'paragraph', children: inline(para.join(' '), start) });
  }
  return blocks;
}

/**
 * A list starting at lines[start]. Items at the first item's indent belong to it; a marker indented
 * deeper starts a nested list on the previous item; indented plain lines continue that item.
 */
function parseList(lines, start, firstLine, fail) {
  const first = LIST_RE.exec(lines[start]);
  const indent = first[1].length;
  const ordered = /\d/.test(first[2]);
  /** @type {ListBlock} */
  const list = { type: 'list', ordered, items: [] };
  /** @type {{ text: string, line: number, sub: string[], subStart: number } | null} */
  let cur = null;
  const close = () => {
    if (!cur) return;
    /** @type {ListItem} */
    const item = {
      children: parseInline(cur.text, (message) => fail(firstLine + cur.line, message)),
    };
    if (cur.sub.length) {
      const nested = parseBlocks(cur.sub, firstLine + cur.subStart, fail).find(
        (b) => b.type === 'list',
      );
      if (nested) item.list = nested;
    }
    list.items.push(item);
    cur = null;
  };
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      const next = lines[i + 1];
      const m = next !== undefined ? LIST_RE.exec(next) : null;
      if (m && m[1].length >= indent) {
        i++;
        continue;
      }
      break;
    }
    const m = LIST_RE.exec(line);
    const lead = line.length - line.trimStart().length;
    if (m && m[1].length === indent) {
      if (/\d/.test(m[2]) !== ordered) break;
      close();
      cur = { text: m[3].trim(), line: i, sub: [], subStart: i + 1 };
      i++;
      continue;
    }
    if (lead > indent && cur) {
      if (m || cur.sub.length) {
        if (!cur.sub.length) cur.subStart = i;
        cur.sub.push(line.slice(Math.min(lead, indent + 2)));
      } else cur.text += ` ${line.trim()}`;
      i++;
      continue;
    }
    break;
  }
  close();
  return { list, next: i };
}

// ---------------------------------------------------------------------------------------------
// Notes

function plainText(inlines) {
  return inlines
    .map((n) => (n.type === 'text' || n.type === 'code' ? n.text : plainText(n.children)))
    .join('');
}

function collectLinks(blocks, out) {
  const fromInlines = (inlines) => {
    for (const n of inlines) {
      if (n.type === 'link' && /^https?:/i.test(n.href)) {
        if (!out.some((s) => s.href === n.href)) {
          let label = plainText(n.children).trim();
          if (!label || label === n.href) {
            try {
              label = new URL(n.href).hostname.replace(/^www\./, '');
            } catch {
              label = n.href;
            }
          }
          out.push({ href: n.href, label });
        }
      }
      if (n.type === 'strong' || n.type === 'em' || n.type === 'link') fromInlines(n.children);
    }
  };
  const fromList = (list) => {
    for (const item of list.items) {
      fromInlines(item.children);
      if (item.list) fromList(item.list);
    }
  };
  for (const b of blocks) {
    if (b.type === 'heading' || b.type === 'paragraph') fromInlines(b.children);
    else if (b.type === 'list') fromList(b);
    else if (b.type === 'quote') collectLinks(b.children, out);
    else if (b.type === 'table') [b.header, ...b.rows].flat().forEach(fromInlines);
  }
  return out;
}

/**
 * Parse one note. `relPath` is its repo-relative path (research/NVDA/2026-10-12-x.md), used for the
 * folder/ticker check and in every error message.
 * @param {string} source
 * @param {string} relPath
 * @returns {{ note: ResearchNote | null, errors: NoteError[] }}
 */
export function parseNote(source, relPath) {
  /** @type {NoteError[]} */
  const errors = [];
  const fail = (line, message) => errors.push({ path: relPath, line, message });
  const lines = source.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const front = splitFrontMatter(lines, fail);
  if (!front) return { note: null, errors };
  const { fields, bodyStart } = front;

  for (const key of REQUIRED)
    if (!fields[key]?.value) fail(fields[key]?.line ?? 1, `Missing required field "${key}".`);

  const parts = relPath.split('/');
  const folder = parts.at(-2) ?? '';
  const file = parts.at(-1) ?? '';
  const ticker = fields.ticker?.value.toUpperCase() ?? '';
  if (fields.ticker?.value && !TICKER_RE.test(fields.ticker.value))
    fail(fields.ticker.line, `"ticker" must be an uppercase symbol like NVDA or BRK.B.`);
  else if (fields.ticker?.value && folder !== ticker)
    fail(fields.ticker.line, `"ticker: ${ticker}" doesn't match its folder research/${folder}/.`);
  for (const key of ['date', 'updated'])
    if (fields[key]?.value && !isCalendarDate(fields[key].value))
      fail(fields[key].line, `"${key}" must be a real date written YYYY-MM-DD.`);
  if (fields.updated?.value && fields.date?.value && fields.updated.value < fields.date.value)
    fail(fields.updated.line, `"updated" is earlier than "date".`);
  const stance = fields.stance?.value.toLowerCase() || null;
  if (stance && !STANCES.includes(stance))
    fail(fields.stance.line, `"stance" must be one of ${STANCES.join(', ')}.`);
  const tags = (fields.tags?.value ?? '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((t) => unquote(t).trim())
    .filter(Boolean);

  const blocks = parseBlocks(lines.slice(bodyStart), bodyStart + 1, fail);
  if (!blocks.length) fail(bodyStart, 'The note has no body.');

  const firstParagraph = blocks.find((b) => b.type === 'paragraph');
  let summary = fields.summary?.value || (firstParagraph ? plainText(firstParagraph.children) : '');
  if (summary.length > SUMMARY_MAX) summary = `${summary.slice(0, SUMMARY_MAX - 1).trimEnd()}…`;

  if (errors.length) return { note: null, errors };
  return {
    note: {
      ticker,
      date: fields.date.value,
      title: fields.title.value,
      slug: file.replace(/\.md$/, ''),
      path: relPath,
      stance: /** @type {Stance | null} */ (stance),
      horizon: fields.horizon?.value || null,
      updated: fields.updated?.value || null,
      tags,
      summary,
      blocks,
      sources: collectLinks(blocks, []),
    },
    errors,
  };
}

/** Newest first: by date, then updated, then slug. */
export function compareNotes(a, b) {
  return (
    b.date.localeCompare(a.date) ||
    (b.updated ?? '').localeCompare(a.updated ?? '') ||
    a.slug.localeCompare(b.slug)
  );
}

/**
 * Read every note under `researchDir`. Only research/<TICKER>/*.md files are notes; anything at the
 * top level (README.md, _template.md) and any file starting with "_" is ignored.
 * @param {string} researchDir absolute path to the research/ folder
 * @param {string} [repoRoot] used to make paths repo-relative in errors
 * @returns {{ notes: ResearchNote[], errors: NoteError[] }}
 */
export function loadNotes(researchDir, repoRoot = path.dirname(researchDir)) {
  /** @type {ResearchNote[]} */
  const notes = [];
  /** @type {NoteError[]} */
  const errors = [];
  let entries = [];
  try {
    entries = readdirSync(researchDir, { withFileTypes: true });
  } catch {
    return { notes, errors };
  }
  for (const dir of entries) {
    if (!dir.isDirectory() || dir.name.startsWith('_') || dir.name.startsWith('.')) continue;
    const rel = path.relative(repoRoot, path.join(researchDir, dir.name)).split(path.sep).join('/');
    if (!TICKER_RE.test(dir.name)) {
      errors.push({
        path: rel,
        line: 0,
        message: 'Ticker folders are uppercase symbols, like research/NVDA/.',
      });
      continue;
    }
    for (const file of readdirSync(path.join(researchDir, dir.name))) {
      if (file.startsWith('_') || file.startsWith('.')) continue;
      const full = path.join(researchDir, dir.name, file);
      if (!statSync(full).isFile()) continue;
      const relFile = `${rel}/${file}`;
      if (!file.endsWith('.md')) continue;
      if (!FILE_RE.test(file)) {
        errors.push({
          path: relFile,
          line: 0,
          message: 'File names use letters, digits, ".", "_" and "-" only, ending in .md.',
        });
        continue;
      }
      const result = parseNote(readFileSync(full, 'utf8'), relFile);
      errors.push(...result.errors);
      if (result.note) notes.push(result.note);
    }
  }
  notes.sort(compareNotes);
  return { notes, errors };
}

/**
 * The per-ticker summary list the /research index renders, newest ticker first.
 * @param {ResearchNote[]} notes sorted newest first
 */
export function summarize(notes) {
  /** @type {Map<string, ResearchNote[]>} */
  const byTicker = new Map();
  for (const n of notes) byTicker.set(n.ticker, [...(byTicker.get(n.ticker) ?? []), n]);
  return [...byTicker.entries()].map(([ticker, list]) => {
    const latest = list[0];
    return {
      ticker,
      count: list.length,
      latest: {
        slug: latest.slug,
        date: latest.date,
        updated: latest.updated,
        title: latest.title,
        stance: latest.stance,
        summary: latest.summary,
      },
    };
  });
}

/** @param {NoteError[]} errors */
export function formatErrors(errors) {
  return errors.map((e) => `${e.path}${e.line ? `:${e.line}` : ''}  ${e.message}`).join('\n');
}
