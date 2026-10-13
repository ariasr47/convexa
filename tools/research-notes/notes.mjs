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
import { BLOCK_NAMES, parseTypedBlock } from './blocks.mjs';
import { formatDay, isCalendarDate } from './dates.mjs';
import { parseNumber } from './valuation.mjs';

/**
 * @typedef {{ type: 'text', text: string }
 *   | { type: 'strong', children: Inline[] }
 *   | { type: 'em', children: Inline[] }
 *   | { type: 'code', text: string }
 *   | { type: 'link', href: string, children: Inline[] }} Inline
 * @typedef {{ children: Inline[], list?: ListBlock }} ListItem
 * @typedef {{ type: 'list', ordered: boolean, items: ListItem[] }} ListBlock
 * @typedef {{ type: 'heading', level: 3, children: Inline[] }
 *   | { type: 'paragraph', children: Inline[] }
 *   | ListBlock
 *   | { type: 'quote', children: Block[] }
 *   | { type: 'codeblock', text: string }
 *   | { type: 'table', header: Inline[][], rows: Inline[][][] }
 *   | { type: 'rule' }
 *   | { type: string, [key: string]: any }} Block  (the last: a named block, blocks.mjs)
 * @typedef {{ n: number, id: string, label: string, title: Inline[],
 *   carried: { from: string, reconfirmed: string } | null, blocks: Block[] }} Section
 * @typedef {{ title: string | null, intro: Block[], sections: Section[] }} Part
 * @typedef {'bullish' | 'bearish' | 'neutral' | 'watching'} Stance
 * @typedef {{
 *   ticker: string, date: string, title: string, slug: string, path: string,
 *   company: string | null, about: string | null, stance: Stance | null,
 *   target: number | null, targetDate: string | null, position: string | null,
 *   horizon: string | null, updated: string | null, notFollowingSince: string | null,
 *   tags: string[], summary: string, lead: Block[], parts: Part[],
 *   sources: { n: number | null, href: string, label: string, host: string }[],
 *   readMinutes: number, aging: Aging, judgments: Record<string, unknown>, moves: string[]
 * }} ResearchNote
 * @typedef {{ priceAsOf: string | null, events: { kind: 'catalyst' | 'kill' | 'forecast',
 *   label: string, when: import('./dates.mjs').When, resolved: boolean, status?: string }[] }} Aging
 * @typedef {{ path: string, line: number, message: string }} NoteError
 */

export const TICKER_RE = /^[A-Z][A-Z0-9.-]{0,9}$/;
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.md$/;
const STANCES = ['bullish', 'bearish', 'neutral', 'watching'];
const KEYS = [
  'ticker',
  'date',
  'title',
  'company',
  'about',
  'stance',
  'target',
  'target_date',
  'position',
  'horizon',
  'tags',
  'summary',
  'updated',
  'not_following_since',
];
const REQUIRED = ['ticker', 'date', 'title'];
const SUMMARY_MAX = 240;

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

const REF_RE = /\[(\d{1,3})\](?!\()/g;
const CARRIED_RE =
  /^<!--\s*carried from (\d{4}-\d{2}-\d{2})\s*;\s*re-confirmed (\d{4}-\d{2}-\d{2})\s*-->$/;

/**
 * @param {string[]} lines
 * @param {number} firstLine 1-based line number of lines[0], for error messages
 * @param {(line: number, message: string) => void} fail
 * @param {{ refs?: { n: number, line: number }[] }} [options] `refs` collects every `[n]` source reference
 * @returns {Block[]}
 */
export function parseBlocks(lines, firstLine, fail, options = {}) {
  /** @type {Block[]} */
  const blocks = [];
  let i = 0;
  const refs = options.refs ?? [];
  const inlineAt = (text, line) => {
    for (const m of text.matchAll(REF_RE)) refs.push({ n: Number(m[1]), line });
    return parseInline(text, (message) => fail(line, message));
  };
  const inline = (text, at) => inlineAt(text, firstLine + at);
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    const fence = /^ *```\s*(.*)$/.exec(line);
    if (fence) {
      const close = lines.findIndex((l, j) => j > i && /^ *```\s*$/.test(l));
      if (close === -1) {
        fail(firstLine + i, 'Code block is never closed: add a line with just ```.');
        break;
      }
      const info = fence[1].trim();
      const name = /^[a-z]+/.exec(info)?.[0] ?? '';
      if (!info) blocks.push({ type: 'codeblock', text: lines.slice(i + 1, close).join('\n') });
      else if (!BLOCK_NAMES.includes(name))
        fail(
          firstLine + i,
          `Unknown block "${info.split(/\s/)[0]}". Blocks: ${BLOCK_NAMES.join(', ')}; a plain code block has nothing after the backticks.`,
        );
      else {
        const inner = lines
          .slice(i + 1, close)
          .map((text, j) => ({ text, line: firstLine + i + 1 + j }));
        const block = parseTypedBlock(
          name,
          info.slice(name.length),
          inner,
          { fail, inline: inlineAt },
          firstLine + i,
        );
        if (block) blocks.push({ ...block, line: firstLine + i });
      }
      i = close + 1;
      continue;
    }
    if (line.trimStart().startsWith('<!--')) {
      const text = line.trim();
      const carried = CARRIED_RE.exec(text);
      if (/^<!--\s*re-confirm\b/i.test(text))
        fail(
          firstLine + i,
          'This section is still flagged re-confirm. Re-read it against the new filings, then write ' +
            '"<!-- carried from <date>; re-confirmed <today> -->", or rewrite the section and drop the flag.',
        );
      else if (carried && isCalendarDate(carried[1]) && isCalendarDate(carried[2]))
        blocks.push({
          type: 'carried',
          from: carried[1],
          reconfirmed: carried[2],
          line: firstLine + i,
        });
      else
        fail(
          firstLine + i,
          'Comments are only used to mark a carried section: "<!-- carried from 2026-10-12; re-confirmed 2026-11-18 -->".',
        );
      i++;
      continue;
    }
    const heading = HEADING_RE.exec(line);
    if (heading) {
      const level = heading[1].length;
      if (level === 1) blocks.push({ type: 'part', title: heading[2].trim(), line: firstLine + i });
      else if (level === 2) {
        const bar = heading[2].indexOf('|');
        const label = (bar === -1 ? heading[2] : heading[2].slice(0, bar)).trim();
        const takeaway = bar === -1 ? '' : heading[2].slice(bar + 1).trim();
        if (!label) fail(firstLine + i, 'A section heading needs a label before "|".');
        blocks.push({
          type: 'section',
          label: plainText(parseInline(label, () => {})),
          title: inline(takeaway || label, i),
          line: firstLine + i,
        });
      } else blocks.push({ type: 'heading', level: 3, children: inline(heading[2], i) });
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
      blocks.push({
        type: 'quote',
        children: parseBlocks(inner, firstLine + start, fail, { refs }),
      });
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
      const parsed = parseList(lines, i, firstLine, fail, refs);
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
function parseList(lines, start, firstLine, fail, refs) {
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
    const at = firstLine + cur.line;
    for (const m of cur.text.matchAll(REF_RE)) refs.push({ n: Number(m[1]), line: at });
    const item = {
      children: parseInline(cur.text, (message) => fail(at, message)),
    };
    if (cur.sub.length) {
      const nested = parseBlocks(cur.sub, firstLine + cur.subStart, fail, { refs }).find(
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

/** Every external link anywhere in the note, deduplicated, labelled by its text or its host. */
function collectLinks(value, out = []) {
  if (Array.isArray(value)) {
    for (const v of value) collectLinks(v, out);
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  if (value.type === 'link' && /^https?:/i.test(value.href)) {
    if (!out.some((s) => s.href === value.href)) {
      let host = value.href;
      try {
        host = new URL(value.href).hostname.replace(/^www\./, '');
      } catch {
        /* keep the href */
      }
      const text = plainText(value.children).trim();
      out.push({
        n: null,
        href: value.href,
        label: !text || text === value.href ? host : text,
        host,
      });
    }
  }
  for (const v of Object.values(value)) if (v && typeof v === 'object') collectLinks(v, out);
  return out;
}

const BLANK_RE = /_{3,}/;
const RULE_ONLY_RE = /^\s*_{3,}\s*$/;
const WORDS_PER_MINUTE = 230;
const PCT_JUDGMENT_RE = /(growth|margin_y1|margin_target|wacc|p_fail|terminal_roc)$/;

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

  const pathParts = relPath.split('/');
  const folder = pathParts.at(-2) ?? '';
  const file = pathParts.at(-1) ?? '';
  const ticker = fields.ticker?.value.toUpperCase() ?? '';
  if (fields.ticker?.value && !TICKER_RE.test(fields.ticker.value))
    fail(fields.ticker.line, `"ticker" must be an uppercase symbol like NVDA or BRK.B.`);
  else if (fields.ticker?.value && folder !== ticker)
    fail(fields.ticker.line, `"ticker: ${ticker}" doesn't match its folder research/${folder}/.`);
  for (const key of ['date', 'updated', 'target_date', 'not_following_since'])
    if (fields[key]?.value && !isCalendarDate(fields[key].value))
      fail(fields[key].line, `"${key}" must be a real date written YYYY-MM-DD.`);
  for (const key of ['updated', 'not_following_since'])
    if (fields[key]?.value && fields.date?.value && fields[key].value < fields.date.value)
      fail(fields[key].line, `"${key}" is earlier than "date".`);
  const stance = fields.stance?.value.toLowerCase() || null;
  if (stance && !STANCES.includes(stance))
    fail(fields.stance.line, `"stance" must be one of ${STANCES.join(', ')}.`);
  let target = null;
  if (fields.target?.value) {
    target = parseNumber(fields.target.value);
    if (target === null || target <= 0)
      fail(fields.target.line, `"target" is a price in dollars, like 150.`);
    if (!fields.target_date?.value)
      fail(fields.target.line, `A "target" needs a "target_date": when it applies.`);
  } else if (fields.target_date?.value)
    fail(fields.target_date.line, `"target_date" goes with a "target".`);
  const tags = (fields.tags?.value ?? '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((t) => unquote(t).trim())
    .filter(Boolean);

  lines.forEach((line, i) => {
    if (BLANK_RE.test(line) && !RULE_ONLY_RE.test(line))
      fail(i + 1, 'A "___" blank is still waiting to be filled.');
  });

  /** @type {{ n: number, line: number }[]} */
  const refs = [];
  const blocks = parseBlocks(lines.slice(bodyStart), bodyStart + 1, fail, { refs });
  if (!blocks.length) fail(bodyStart, 'The note has no body.');

  // Lead, then parts (# headings), each holding sections (## headings), numbered across the note.
  /** @type {Block[]} */
  const lead = [];
  /** @type {Part[]} */
  const parts = [];
  /** @type {Part | null} */
  let part = null;
  /** @type {Section | null} */
  let section = null;
  for (const b of blocks) {
    if (b.type === 'part') {
      part = { title: b.title, intro: [], sections: [] };
      parts.push(part);
      section = null;
      continue;
    }
    if (b.type === 'section') {
      if (!part) {
        part = { title: null, intro: [], sections: [] };
        parts.push(part);
      }
      const n = parts.reduce((sum, p) => sum + p.sections.length, 0) + 1;
      section = { n, id: `s${n}`, label: b.label, title: b.title, carried: null, blocks: [] };
      part.sections.push(section);
      continue;
    }
    if (b.type === 'carried') {
      if (!section || section.blocks.length)
        fail(b.line, 'A carried-section mark goes on the line right under its ## heading.');
      else section.carried = { from: b.from, reconfirmed: b.reconfirmed };
      continue;
    }
    (section ? section.blocks : part ? part.intro : lead).push(b);
  }

  const all = [
    ...lead,
    ...parts.flatMap((p) => [...p.intro, ...p.sections.flatMap((s) => s.blocks)]),
  ];
  const ofType = (type) => all.filter((b) => b.type === type);
  const valuations = ofType('valuation');
  if (valuations.length > 1) fail(valuations[1].line, 'A note has one valuation block.');
  const valuation = valuations[0] ?? null;
  for (const b of ofType('implied'))
    if (!valuation)
      fail(b.line, 'The implied block draws from a valuation block; this note has none.');
  const sourceBlocks = ofType('sources');
  if (sourceBlocks.length > 1) fail(sourceBlocks[1].line, 'A note has one sources block.');
  const numbered = new Set(sourceBlocks[0]?.items.map((s) => s.n) ?? []);
  const reported = new Set();
  for (const ref of refs) {
    const key = `${ref.line}:${ref.n}`;
    if (numbered.has(ref.n) || reported.has(key)) continue;
    reported.add(key);
    fail(
      ref.line,
      sourceBlocks.length
        ? `[${ref.n}] has no row in the sources block.`
        : `[${ref.n}] refers to a source, but the note has no sources block.`,
    );
  }

  const firstParagraph =
    lead.find((b) => b.type === 'paragraph') ?? all.find((b) => b.type === 'paragraph');
  let summary = fields.summary?.value || (firstParagraph ? plainText(firstParagraph.children) : '');
  if (summary.length > SUMMARY_MAX) summary = `${summary.slice(0, SUMMARY_MAX - 1).trimEnd()}…`;

  /** @type {Aging['events']} */
  const events = [];
  const clip = (text) => (text.length > 90 ? `${text.slice(0, 89).trimEnd()}…` : text);
  for (const b of all) {
    if (b.type === 'catalysts')
      for (const c of b.items)
        events.push({
          kind: 'catalyst',
          label: c.event,
          when: c.when,
          resolved: c.outcome !== null,
          status: c.status,
        });
    if (b.type === 'kill')
      for (const k of b.items)
        if (k.checkBy.kind !== 'ongoing')
          events.push({
            kind: 'kill',
            label: `Kill criterion ${k.n}: ${k.trigger}`,
            when: k.checkBy,
            resolved: k.outcome !== null,
          });
    if (b.type === 'forecasts')
      for (const f of b.items)
        events.push({
          kind: 'forecast',
          label: clip(`Forecast: ${plainText(f.claim)}`),
          when: f.resolveBy,
          resolved: f.outcome !== null,
        });
  }

  const judgments = { ...(valuation?.judgments ?? {}), stance, target };
  if (valuation) delete valuation.judgments;
  const moves = ofType('moves').flatMap((b) => b.items.map((m) => m.input));
  const words = lines
    .slice(bodyStart)
    .join(' ')
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length;

  if (errors.length) return { note: null, errors };
  const sources = sourceBlocks[0]
    ? sourceBlocks[0].items.map((s) => ({ n: s.n, href: s.url, label: s.title, host: s.host }))
    : collectLinks([lead, parts]);
  return {
    note: {
      ticker,
      date: fields.date.value,
      title: fields.title.value,
      slug: file.replace(/\.md$/, ''),
      path: relPath,
      company: fields.company?.value || null,
      about: fields.about?.value || null,
      stance: /** @type {Stance | null} */ (stance),
      target,
      targetDate: target ? fields.target_date.value : null,
      position: fields.position?.value || null,
      horizon: fields.horizon?.value || null,
      updated: fields.updated?.value || null,
      notFollowingSince: fields.not_following_since?.value || null,
      tags,
      summary,
      lead,
      parts,
      sources,
      readMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
      aging: { priceAsOf: valuation?.price.asOf ?? null, events },
      hasValuation: Boolean(valuation),
      judgments,
      moves,
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

const formatJudgment = (key, value) => {
  if (value === null || value === undefined) return 'unset';
  if (typeof value === 'number' && PCT_JUDGMENT_RE.test(key))
    return `${Math.round(value * 10000) / 100}%`;
  return String(value);
};

/**
 * A judgment (a scenario input, the terminal assumptions, odds, uncertainty, stance, target) that
 * differs from the ticker's previous note needs a `moves` row naming it, so a view can't drift
 * between notes without a stated trigger and reason (docs/research-method/README.md).
 * @param {ResearchNote[]} notes
 * @returns {NoteError[]}
 */
export function checkMoves(notes) {
  /** @type {NoteError[]} */
  const errors = [];
  /** @type {Map<string, ResearchNote[]>} */
  const byTicker = new Map();
  for (const n of notes) byTicker.set(n.ticker, [...(byTicker.get(n.ticker) ?? []), n]);
  for (const list of byTicker.values()) {
    const oldestFirst = [...list].sort(compareNotes).reverse();
    for (let i = 1; i < oldestFirst.length; i++) {
      const prev = oldestFirst[i - 1];
      const cur = oldestFirst[i];
      const keys = new Set(['stance', 'target']);
      if (prev.hasValuation && cur.hasValuation)
        for (const k of [...Object.keys(prev.judgments), ...Object.keys(cur.judgments)])
          keys.add(k);
      for (const k of keys) {
        const a = prev.judgments[k] ?? null;
        const b = cur.judgments[k] ?? null;
        if (JSON.stringify(a) === JSON.stringify(b) || cur.moves.includes(k)) continue;
        errors.push({
          path: cur.path,
          line: 0,
          message:
            `"${k}" moved from ${formatJudgment(k, a)} to ${formatJudgment(k, b)} since ` +
            `${prev.slug}.md with no moves row. Add one: ${k} | old → new | trigger | why.`,
        });
      }
    }
  }
  return errors;
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
  errors.push(...checkMoves(notes));
  return { notes, errors };
}

/** The note's blocks of one type, in reading order. */
function blocksOf(note, type) {
  return [
    ...note.lead,
    ...note.parts.flatMap((p) => [...p.intro, ...p.sections.flatMap((s) => s.blocks)]),
  ].filter((b) => b.type === type);
}

/**
 * The per-ticker list the /research index renders, newest ticker first: everything a card needs from
 * the latest note, so the index never fetches a note.
 * @param {ResearchNote[]} notes sorted newest first
 */
export function summarize(notes) {
  /** @type {Map<string, ResearchNote[]>} */
  const byTicker = new Map();
  for (const n of notes) byTicker.set(n.ticker, [...(byTicker.get(n.ticker) ?? []), n]);
  return [...byTicker.entries()].map(([ticker, list]) => {
    const latest = list[0];
    const valuation = blocksOf(latest, 'valuation')[0] ?? null;
    const chart = blocksOf(latest, 'chart')[0] ?? null;
    const metrics = blocksOf(latest, 'metrics')[0] ?? null;
    return {
      ticker,
      count: list.length,
      latest: {
        slug: latest.slug,
        date: latest.date,
        updated: latest.updated,
        title: latest.title,
        company: latest.company,
        about: latest.about,
        stance: latest.stance,
        summary: latest.summary,
        notFollowingSince: latest.notFollowingSince,
        readMinutes: latest.readMinutes,
        sourceCount: latest.sources.length,
        uncertainty: valuation?.uncertainty ?? null,
        chart: chart && { caption: chart.caption, bars: chart.bars, latest: chart.latest },
        metrics: (metrics?.items ?? []).slice(0, 3).map((m) => ({
          label: m.label,
          value: m.value,
          asOf: m.asOf,
          delta: m.delta,
          dir: m.dir,
        })),
        valuation: valuation && {
          price: valuation.price,
          values: Object.fromEntries(
            Object.entries(valuation.result.scenarios).map(([k, v]) => [k, v.value]),
          ),
          weighted: valuation.result.weighted?.value ?? null,
          baseVsPrice: valuation.result.scenarios.base.vsPrice,
        },
        aging: latest.aging,
      },
    };
  });
}

/** @param {NoteError[]} errors */
export function formatErrors(errors) {
  return errors.map((e) => `${e.path}${e.line ? `:${e.line}` : ''}  ${e.message}`).join('\n');
}

export { formatDay };
