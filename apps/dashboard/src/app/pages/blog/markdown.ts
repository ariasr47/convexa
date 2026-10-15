/**
 * The small Markdown subset the blog posts use, parsed into blocks the post page renders inside the
 * shell. The posts' one source is `docs/blog/<slug>.md`; `docs/blog/build_html.py` reads the same
 * file for the plain no-JavaScript copy, and this mirrors its `convert()` rules: `#`/`##`/`###`
 * headings, paragraphs, `-` and `1.` lists, `>` quotes, `|` tables (with `\|` for a literal pipe),
 * `---` rules and `![caption](img/<name>.svg)` figures; inline `code`, links, bold and italics.
 *
 * A parser that drops or merges text does so silently, so markdown.spec.ts pins it.
 */
export type Block =
  | { kind: 'h1' | 'h2' | 'h3'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'figure'; name: string; caption: string }
  | { kind: 'hr' };

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'em'; text: string }
  | { kind: 'link'; text: string; href: string };

/** Splits a table row on unescaped pipes; `\|` stays a literal pipe in the cell. */
function cells(row: string): string[] {
  const inner = row.trim().replace(/^\|/, '').replace(/\|$/, '');
  return inner.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

export function parseMarkdown(md: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  let quote: string[] = [];
  // A box, not a `let`: the closures below reassign it, which narrowing can't follow.
  const open: { list: { kind: 'ul' | 'ol'; items: string[][] } | null } = { list: null };
  let table: string[] = [];

  const flushPara = () => {
    if (para.length) out.push({ kind: 'p', text: para.join(' ').trim() });
    para = [];
  };
  const flushQuote = () => {
    if (quote.length) out.push({ kind: 'quote', text: quote.join(' ').trim() });
    quote = [];
  };
  const flushList = () => {
    const list = open.list;
    if (list) out.push({ kind: list.kind, items: list.items.map((it) => it.join(' ').trim()) });
    open.list = null;
  };
  const flushTable = () => {
    const rows = table.filter((r) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r)).map(cells);
    if (rows.length) out.push({ kind: 'table', head: rows[0], rows: rows.slice(1) });
    table = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
    flushTable();
  };
  const startList = (kind: 'ul' | 'ol', first: string) => {
    flushPara();
    flushQuote();
    flushTable();
    if (open.list && open.list.kind !== kind) flushList();
    open.list ??= { kind, items: [] };
    open.list.items.push([first]);
  };

  for (const raw of md.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const stripped = line.trim();
    if (stripped === '') {
      flushAll();
      continue;
    }
    if (stripped === '---') {
      flushAll();
      out.push({ kind: 'hr' });
      continue;
    }
    if (stripped.startsWith('|')) {
      flushPara();
      flushList();
      flushQuote();
      table.push(stripped);
      continue;
    }
    const figure = /^!\[(.*?)\]\((.*?)\)$/.exec(stripped);
    if (figure) {
      flushAll();
      const name = (figure[2].split('/').pop() ?? '').replace(/\.svg$/, '');
      out.push({ kind: 'figure', name, caption: figure[1] });
      continue;
    }
    const heading = /^(#{1,3}) (.*)$/.exec(line);
    if (heading) {
      flushAll();
      const kind = (['h1', 'h2', 'h3'] as const)[heading[1].length - 1];
      out.push({ kind, text: heading[2].trim() });
      continue;
    }
    if (line.startsWith('> ') || stripped === '>') {
      flushPara();
      flushList();
      flushTable();
      quote.push(stripped === '>' ? '' : line.slice(2).trim());
      continue;
    }
    const ordered = /^(\d+)\.\s+(.*)$/.exec(line);
    if (ordered) {
      startList('ol', ordered[2].trim());
      continue;
    }
    if (line.startsWith('- ')) {
      startList('ul', line.slice(2).trim());
      continue;
    }
    if (open.list && (raw.startsWith('  ') || raw.startsWith('\t'))) {
      open.list.items[open.list.items.length - 1].push(stripped);
      continue;
    }
    flushList();
    flushQuote();
    flushTable();
    para.push(stripped);
  }
  flushAll();
  return out;
}

const INLINE =
  /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|(?<![\w*])_([^_]+)_(?![\w*])|\*([^*]+)\*/g;

/** Inline marks, in the order build_html.py applies them. Marks don't nest. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let at = 0;
  for (const m of text.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > at) out.push({ kind: 'text', text: text.slice(at, i) });
    if (m[1] !== undefined) out.push({ kind: 'code', text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: 'link', text: m[2], href: m[3] });
    else if (m[4] !== undefined) out.push({ kind: 'strong', text: m[4] });
    else out.push({ kind: 'em', text: m[5] ?? m[6] });
    at = i + m[0].length;
  }
  if (at < text.length) out.push({ kind: 'text', text: text.slice(at) });
  return out;
}
