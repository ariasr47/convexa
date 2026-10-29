#!/usr/bin/env node
/**
 * The served heads and the edge routing (W1-22; site audit 2026-10-25, batch B5). Run after the
 * dashboard build (tools/build-dashboard.mjs), it writes into dist only, never into public/:
 *
 * - `dist/<route>.html` for each static route of the route table (STATIC_ROUTES), and
 *   `dist/blog/<slug>.html` for each post: a copy of the built `dist/index.html` (the same SPA
 *   shell, scripts and styles) whose <title>, description, canonical, og:* and twitter:* tags name
 *   that address instead of the home page (SEO-1/2). A post's copy also carries the post's article
 *   inside #root for readers and crawlers without JavaScript (SEO-6), a noscript link to its own
 *   plain copy (SEO-8) and an Article block of schema.org data (SEO-9).
 * - `dist/shell/...`: the same for the route table's dynamic paths, one page per desk of the tracked
 *   universe and per research note, and `shell/app.html`, the noindex shell every other dynamic path
 *   gets. `dist/_redirects` rewrites (200) those paths onto them.
 * - `dist/404.html`: the shell with noindex. With a top-level 404.html Pages stops treating every
 *   unknown path as the app, so an address outside the route table answers 404 (SEO-4).
 * - `dist/sitemap.xml` from the same tables and posts.json (SEO-5), on live builds.
 * - On demo builds (staging): every page noindex, no canonical, og:url on the staging host, a
 *   sample-data mark on its share title, no schema.org data, and `X-Robots-Tag: noindex` on every
 *   response through dist/_headers (SEO-7). Staging deploys no Functions, so this is static.
 *
 * Why copies of the shell, not pages of their own: every page renders inside the shell, and a share
 * preview or a crawler reads only the HTML the address serves. Pages serves `<route>.html` at
 * `/<route>`, and the SPA mounts over it exactly as it does over index.html. Why rewrites in
 * _redirects rather than a Function: Pages applies a _redirects rule before any static file, a
 * Function runs only on the paths `_routes.json` includes (live: /api/* only; demo: none), and a
 * root middleware would run in front of the /api proxy and on every asset it was not told to skip.
 *
 * Every tag this replaces must be present exactly once in index.html, and every post and route
 * must be well formed, or the build fails: a silent miss here is a page that shares as the home
 * page, or a route that answers 404.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** A symbol or note file name that is a safe path segment with no dot (Pages reads a dot as an
 *  extension). Anything else falls to the generic shell. */
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

export const STAGING_ORIGIN = 'https://staging.convexa.pages.dev';
export const STAGING_MARK = ' (demo, sample data)';

/**
 * The static routes of the route table (apps/dashboard/src/app/app.tsx), each served from
 * dist/<path>.html. Titles match what the page sets once it runs (useDocumentTitle); descriptions
 * are the page's own lead. `/` is index.html itself. build-dashboard.spec.mjs fails when a path in
 * app.tsx is neither here nor rewritten by DYNAMIC_RULES.
 */
export const STATIC_ROUTES = [
  {
    path: '/methodology',
    title: 'Methodology — Convexa',
    description:
      'What the numbers mean, how often they update, and where the read is weak. Not a pitch deck — the assumptions behind the desk.',
    sitemap: true,
  },
  {
    path: '/blog',
    title: 'Blog — Convexa',
    description:
      'Dealer structure, score honesty, and the two clocks on the desk: the longer form of the Methodology page.',
    sitemap: true,
  },
  {
    path: '/research',
    title: 'Research — Convexa',
    description:
      'Notes on the tickers being followed: what the price implies, the evidence, the debate, a valuation with its assumptions shown, and what comes next.',
    sitemap: true,
  },
  {
    path: '/research/markets',
    title: 'Markets — Convexa',
    description:
      'Rates, positioning and the money behind them, from public sources, refreshed each business day.',
    sitemap: true,
  },
  {
    path: '/research/filings',
    title: 'Filings — Convexa',
    description:
      "What the followed companies filed with the SEC, newest first. A results or quarterly filing the note hasn't read makes it due.",
    sitemap: true,
  },
  {
    path: '/research/scorecard',
    title: 'Scorecard — Convexa',
    description: 'How the calls in the notes turn out. A forecast is scored when its date passes.',
    sitemap: true,
  },
  {
    path: '/credits',
    title: 'Data sources and credits — Convexa',
    description:
      'Every figure on Convexa names its source. This page lists them all: who owns each source, what Convexa reads from it, how often and how late it publishes, and the terms it is shown under.',
    sitemap: true,
  },
  {
    path: '/privacy',
    title: 'Privacy — Convexa',
    description:
      'Convexa runs no ads, no analytics and no tracking scripts. If you don’t sign in, what you do here stays in this browser.',
    sitemap: true,
  },
  {
    path: '/terms',
    title: 'Terms and disclaimer — Convexa',
    description:
      'Convexa is an analysis tool. It shows dealer positioning and public market data and explains how it reads them. It doesn’t tell you what to trade.',
    sitemap: true,
  },
  // Tools and sign-in walls: their own address and title, the site's description, not in the sitemap.
  { path: '/scanner', title: 'Scanner — Convexa', sitemap: false },
  { path: '/positions', title: 'Positions — Convexa', sitemap: false },
  { path: '/alerts', title: 'Alerts — Convexa', sitemap: false },
  { path: '/settings', title: 'Settings — Convexa', sitemap: false },
];

/** Where the generic dynamic shell is served from (dist/shell/app.html). */
const GENERIC = '/shell/app';

/**
 * The route table's other paths, after the per-desk and per-note rules: each is rewritten onto the
 * generic shell (noindex, no canonical: one page cannot name every symbol's address). Placeholders
 * match one path segment. `/api/*` keeps the fallback it had before 404.html existed; on live builds
 * the API Function serves it and Pages applies no _redirects rule to it.
 */
export const DYNAMIC_RULES = [
  { from: '/ticker', to: GENERIC },
  { from: '/_ops/metrics', to: GENERIC },
  { from: '/_ops/research', to: GENERIC },
  { from: '/ticker/:symbol', to: GENERIC },
  { from: '/ticker/:symbol/technical-analysis', to: GENERIC },
  { from: '/ticker/:symbol/research', to: GENERIC },
  { from: '/ticker/:symbol/research/:slug', to: GENERIC },
  { from: '/api/*', to: '/' },
];

const escapeAttr = (s) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
const escapeText = (s) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
/** JSON inside <script type="application/ld+json">: no `<` can close the element early. */
const jsonLd = (data) =>
  `<script type="application/ld+json">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>`;

/** The published posts, checked: a slug that is a safe path segment, a title, a description and
 *  the day it was published. */
export function readPosts(json) {
  const list = JSON.parse(json);
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('[blog-heads] docs/blog/posts.json must be a non-empty array');
  }
  const seen = new Set();
  return list.map((post, i) => {
    const { slug, title, description, date } = post ?? {};
    if (typeof slug !== 'string' || !SLUG.test(slug)) {
      throw new Error(`[blog-heads] post ${i}: slug ${JSON.stringify(slug)} is not a-z0-9 words`);
    }
    if (seen.has(slug)) throw new Error(`[blog-heads] post ${i}: slug ${slug} is listed twice`);
    seen.add(slug);
    for (const [key, value] of Object.entries({ title, description })) {
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`[blog-heads] post ${slug}: ${key} is missing`);
      }
    }
    if (typeof date !== 'string' || !DAY.test(date) || Number.isNaN(Date.parse(date))) {
      throw new Error(`[blog-heads] post ${slug}: date ${JSON.stringify(date)} is not YYYY-MM-DD`);
    }
    return { slug, title, description, date };
  });
}

function count(html, re) {
  return (html.match(new RegExp(re.source, `${re.flags.replace('g', '')}g`)) ?? []).length;
}

/** Replace exactly one match of `re` in `html`, or throw naming `what`. */
function replaceOnce(html, re, replacement, what) {
  const n = count(html, re);
  if (n !== 1) throw new Error(`[blog-heads] index.html has ${n} ${what}; expected exactly 1`);
  // A function, so a `$` in a page's text is never read as a replacement pattern.
  return html.replace(re, () => replacement);
}

/** Remove exactly one match of `re`, with its indentation and line end. */
function removeOnce(html, re, what) {
  const line = new RegExp(`[ \\t]*${re.source}[ \\t]*\\n?`, re.flags);
  return replaceOnce(html, line, '', what);
}

const meta = (attr, name) =>
  new RegExp(`<meta\\s+${attr}="${name.replace(/[.:]/g, '\\$&')}"\\s+content="([^"]*)"\\s*/?>`);
const CANONICAL = /<link\s+rel="canonical"\s+href="([^"]*)"\s*\/?>/;
const TITLE = /<title>([^<]*)<\/title>/;
const JSON_LD = /[ \t]*<script type="application\/ld\+json">[\s\S]*?<\/script>[ \t]*\n?/g;
const NOSCRIPT_LINK = /<a href="\/blog\/plain\/[^"]*"\s*>[^<]*<\/a\s*>/;

function setMeta(html, attr, name, value) {
  return replaceOnce(
    html,
    meta(attr, name),
    `<meta ${attr}="${name}" content="${escapeAttr(value)}" />`,
    `${name} tags`,
  );
}

/** The site's origin, read from the built shell's own canonical, so the shell stays the one place
 *  that names it. */
export function siteOrigin(indexHtml) {
  const canonical = indexHtml.match(CANONICAL);
  if (!canonical) {
    throw new Error('[blog-heads] index.html has no canonical link (already processed? rebuild)');
  }
  return new URL('/', canonical[1]).href;
}

/**
 * The shell with one address's head. `url` null drops the canonical and og:url (a page served at
 * many addresses must not name one); `title` sets <title>, `shareTitle` (default: title) og:title and
 * twitter:title; `description` (optional) all three descriptions.
 */
export function setHead(indexHtml, { url, title, shareTitle = title, description, type, robots }) {
  let html = replaceOnce(indexHtml, TITLE, `<title>${escapeText(title)}</title>`, '<title>');
  html = setMeta(html, 'property', 'og:title', shareTitle);
  html = setMeta(html, 'name', 'twitter:title', shareTitle);
  if (description !== undefined) {
    html = setMeta(html, 'name', 'description', description);
    html = setMeta(html, 'property', 'og:description', description);
    html = setMeta(html, 'name', 'twitter:description', description);
  }
  if (type) html = setMeta(html, 'property', 'og:type', type);
  if (robots) html = setMeta(html, 'name', 'robots', robots);
  if (url === null) {
    html = removeOnce(html, CANONICAL, 'canonical links');
    html = removeOnce(html, meta('property', 'og:url'), 'og:url tags');
  } else {
    html = replaceOnce(
      html,
      CANONICAL,
      `<link rel="canonical" href="${escapeAttr(url)}" />`,
      'canonical links',
    );
    html = setMeta(html, 'property', 'og:url', url);
  }
  return html;
}

/** The plain copy's <article> (docs/blog/build_html.py), to sit inside #root until the app mounts. */
export function plainArticle(plainHtml, slug) {
  const found = plainHtml.match(/<article>[\s\S]*<\/article>/g) ?? [];
  if (found.length !== 1) {
    throw new Error(
      `[blog-heads] blog/plain/${slug}.html has ${found.length} <article>; expected 1`,
    );
  }
  return found[0];
}

/**
 * A post's page: the shell with the post's head; with `article` (its plain copy's <article>), that
 * article prerendered inside #root. createRoot clears #root when the app mounts, and the style hides
 * it while scripts load, so a reader with JavaScript sees no change; one without, or a crawler that
 * runs none, gets the post.
 */
export function blogHead(indexHtml, post, article) {
  const origin = siteOrigin(indexHtml);
  const url = new URL(`blog/${post.slug}`, origin).href;
  let html = setHead(indexHtml, {
    url,
    title: `${post.title} — Convexa`,
    shareTitle: post.title,
    description: post.description,
    type: 'article',
  });
  html = replaceOnce(
    html,
    NOSCRIPT_LINK,
    `<a href="/blog/plain/${post.slug}">${escapeText(post.title)} — a plain page that works without JavaScript.</a>`,
    'noscript links to a plain post',
  );
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    url,
    mainEntityOfPage: url,
    image: new URL('og-image.png', origin).href,
    inLanguage: 'en',
    author: { '@id': `${origin}#organization` },
    publisher: { '@id': `${origin}#organization` },
    isPartOf: { '@id': `${origin}#website` },
  };
  const extra = [jsonLd(data)];
  if (article) {
    extra.push(
      '<style>@media (scripting: enabled) { #root > .prerendered { display: none; } }</style>',
    );
    html = replaceOnce(
      html,
      /<div id="root"><\/div>/,
      `<div id="root">${article.replace('<article>', '<article class="prerendered">')}</div>`,
      'empty #root',
    );
  }
  return replaceOnce(html, /<\/head>/, `  ${extra.join('\n    ')}\n  </head>`, '</head>');
}

/** The staging form of any page (SEO-7): noindex, no canonical, og:url on the staging host, a
 *  sample-data mark on the share title, no schema.org data. Idempotent. */
export function stagingHead(html, pathname) {
  let out = setMeta(html, 'name', 'robots', 'noindex, nofollow');
  if (count(out, CANONICAL) === 1) out = removeOnce(out, CANONICAL, 'canonical links');
  if (count(out, meta('property', 'og:url')) === 1) {
    out = setMeta(out, 'property', 'og:url', new URL(pathname, STAGING_ORIGIN).href);
  }
  for (const [attr, name] of [
    ['property', 'og:title'],
    ['name', 'twitter:title'],
  ]) {
    const current = out.match(meta(attr, name));
    const text = current?.[1]
      .replaceAll('&quot;', '"')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&');
    if (text !== undefined && !text.endsWith(STAGING_MARK)) {
      out = setMeta(out, attr, name, `${text}${STAGING_MARK}`);
    }
  }
  return out.replace(JSON_LD, '');
}

/** The note's description: its summary (notes.mjs caps it at 240 characters). */
const noteTitle = (note) => `${note.ticker} · ${note.title}`;

/**
 * Every page this step writes, as { file (relative to dist), path (the address it answers),
 * html, listed (it names its own address), sitemap?, lastmod? }, plus the _redirects rules.
 * `notes` are tools/research-notes loadNotes() notes (newest first), `universe` the tracked symbols.
 */
export function planHeads({ indexHtml, posts, plain, notes, universe, mode }) {
  const pages = [];
  const rules = [];
  const origin = siteOrigin(indexHtml);
  const at = (p) => new URL(p.slice(1), origin).href;

  for (const route of STATIC_ROUTES) {
    pages.push({
      file: `${route.path.slice(1)}.html`,
      path: route.path,
      html: setHead(indexHtml, {
        url: at(route.path),
        title: route.title,
        description: route.description,
      }),
      listed: true,
      sitemap: route.sitemap,
    });
  }
  for (const post of posts) {
    const article = plain ? plainArticle(plain(post.slug), post.slug) : undefined;
    pages.push({
      file: `blog/${post.slug}.html`,
      path: `/blog/${post.slug}`,
      html: blogHead(indexHtml, post, article),
      listed: true,
      sitemap: true,
      lastmod: post.date,
    });
  }

  // One page per desk of the tracked universe (the addresses the site links), served through a
  // static rule: a _redirects rule beats a file, so the pages live under /shell/, off the path.
  for (const symbol of universe) {
    if (!SEGMENT.test(symbol) || symbol !== symbol.toUpperCase()) continue;
    const description =
      mode === 'demo'
        ? `The ${symbol} desk on the Convexa demo: dealer gamma structure on sample data.`
        : `The ${symbol} desk on Convexa: the daily chart and the public data for ${symbol}. Panels that need the options feed say what they would show.`;
    const p = `/ticker/${symbol}`;
    pages.push({
      file: `shell/ticker/${symbol}.html`,
      path: p,
      html: setHead(indexHtml, { url: at(p), title: `${symbol} — Convexa`, description }),
      listed: true,
      sitemap: false,
    });
    rules.push({ from: p, to: `/shell/ticker/${symbol}` });
  }
  // One page per ticker with notes (its newest note, as /ticker/<T>/research shows it) and one per note.
  const byTicker = new Map();
  for (const note of notes) {
    if (!SEGMENT.test(note.ticker) || !SEGMENT.test(note.slug)) continue;
    if (!byTicker.has(note.ticker)) byTicker.set(note.ticker, []);
    byTicker.get(note.ticker).push(note);
  }
  for (const [ticker, list] of byTicker) {
    const newest = list[0];
    const hub = `/ticker/${ticker}/research`;
    pages.push({
      file: `shell${hub}.html`,
      path: hub,
      html: setHead(indexHtml, {
        url: at(hub),
        title: `${noteTitle(newest)} — Convexa`,
        shareTitle: noteTitle(newest),
        description: newest.summary,
        type: 'article',
      }),
      listed: true,
      sitemap: true,
      lastmod: newest.updated ?? newest.date,
    });
    rules.push({ from: hub, to: `/shell${hub}` });
    for (const note of list) {
      const p = `${hub}/${note.slug}`;
      pages.push({
        file: `shell${p}.html`,
        path: p,
        html: setHead(indexHtml, {
          url: at(p),
          title: `${noteTitle(note)} — Convexa`,
          shareTitle: noteTitle(note),
          description: note.summary,
          type: 'article',
        }),
        listed: true,
        sitemap: true,
        lastmod: note.updated ?? note.date,
      });
      rules.push({ from: p, to: `/shell${p}` });
    }
  }

  pages.push({
    file: 'shell/app.html',
    path: null,
    html: setHead(indexHtml, { url: null, title: 'Convexa', robots: 'noindex' }),
    listed: false,
  });
  pages.push({
    file: '404.html',
    path: null,
    html: setHead(indexHtml, {
      url: null,
      title: 'Nothing at this address — Convexa',
      robots: 'noindex',
    }),
    listed: false,
  });
  rules.push(...DYNAMIC_RULES);
  return { pages, rules, origin };
}

/** dist/_redirects: static rules first, as Pages asks; the first rule that matches applies. */
export function redirectsFile(rules) {
  const width = Math.max(...rules.map((r) => r.from.length));
  return [
    '# Written by tools/write-blog-heads.mjs at build time; edit that file, not this one.',
    '# Pages applies the first matching rule before any static file, so no rule may match a file.',
    "# Static routes are files (dist/<route>.html) and need none; the route table's dynamic paths",
    '# are rewritten (200) onto their pages; any other path gets 404.html with status 404.',
    ...rules.map((r) => `${r.from.padEnd(width)}  ${r.to}  200`),
    '',
  ].join('\n');
}

export function sitemapXml(origin, pages) {
  const urls = [
    { loc: origin },
    ...pages
      .filter((p) => p.sitemap)
      .map((p) => ({ loc: new URL(p.path.slice(1), origin).href, lastmod: p.lastmod })),
  ];
  const body = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${escapeText(u.loc)}</loc>\n${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ''}  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/**
 * The guard (SEO-1/2): every listed page names its own address in its canonical and og:url, never
 * `/`, and has its own title; the unlisted ones (the generic shell, 404) are noindex and name no
 * address. On a demo build every page is noindex with no canonical (SEO-7). Throws listing each miss.
 */
export function checkHeads(pages, { origin, mode, homeTitle }) {
  const misses = [];
  for (const page of pages) {
    const { html } = page;
    const canonical = html.match(CANONICAL)?.[1] ?? null;
    const ogUrl = html.match(meta('property', 'og:url'))?.[1] ?? null;
    const robots = html.match(meta('name', 'robots'))?.[1] ?? '';
    const title = html.match(TITLE)?.[1] ?? '';
    const name = page.path ?? page.file;
    if (mode === 'demo') {
      if (canonical !== null) misses.push(`${name}: canonical ${canonical} on a demo build`);
      if (!robots.includes('noindex')) misses.push(`${name}: robots "${robots}" on a demo build`);
      if (ogUrl !== null && !ogUrl.startsWith(STAGING_ORIGIN))
        misses.push(`${name}: og:url ${ogUrl}`);
      continue;
    }
    if (!page.listed) {
      if (canonical !== null || ogUrl !== null) misses.push(`${name}: names ${canonical ?? ogUrl}`);
      if (!robots.includes('noindex')) misses.push(`${name}: robots "${robots}", not noindex`);
      continue;
    }
    const own = new URL(page.path.slice(1), origin).href;
    if (canonical !== own) misses.push(`${name}: canonical ${canonical}, expected ${own}`);
    if (ogUrl !== own) misses.push(`${name}: og:url ${ogUrl}, expected ${own}`);
    if (title === homeTitle) misses.push(`${name}: the home page's title`);
    if (robots.includes('noindex')) misses.push(`${name}: noindex`);
  }
  if (misses.length) {
    throw new Error(`[blog-heads] ${misses.length} head(s) wrong:\n  ${misses.join('\n  ')}`);
  }
}

const HEADERS_MARK =
  '# Staging (demo build): no page of it is for indexing. Added by tools/write-blog-heads.mjs.';

/**
 * Writes every page, dist/_redirects, dist/404.html, dist/sitemap.xml (live) and the staging rules
 * (demo); returns the paths written. Reads the shell from dist/index.html, which the Nx build leaves
 * as Vite wrote it (a cache hit restores it), and each post's plain copy from dist/blog/plain/.
 */
export function writeHeads(dist, { postsJson, notes = [], universe = [], mode }) {
  if (mode !== 'demo' && mode !== 'live') throw new Error(`[blog-heads] mode ${mode}`);
  const indexFile = path.join(dist, 'index.html');
  const indexHtml = readFileSync(indexFile, 'utf8');
  const posts = readPosts(postsJson);
  const plain = (slug) => readFileSync(path.join(dist, 'blog', 'plain', `${slug}.html`), 'utf8');
  const { pages, rules, origin } = planHeads({ indexHtml, posts, plain, notes, universe, mode });
  const homeTitle = indexHtml.match(TITLE)?.[1];
  const written = [];
  const put = (rel, text) => {
    const file = path.join(dist, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
    written.push(file);
  };

  if (mode === 'demo') {
    for (const page of pages) page.html = stagingHead(page.html, page.path ?? '/');
    const home = {
      file: 'index.html',
      path: '/',
      html: stagingHead(indexHtml, '/'),
      listed: false,
    };
    checkHeads([...pages, home], { origin, mode, homeTitle });
    // index.html changes after precompress-dashboard wrote its siblings: drop them, never stale.
    for (const ext of ['.br', '.gz']) rmSync(indexFile + ext, { force: true });
    put('index.html', home.html);
    const headersFile = path.join(dist, '_headers');
    const headers = existsSync(headersFile) ? readFileSync(headersFile, 'utf8') : '';
    if (!headers.includes(HEADERS_MARK)) {
      put(
        '_headers',
        `${headers.replace(/\n*$/, '\n')}\n${HEADERS_MARK}\n/*\n  X-Robots-Tag: noindex\n`,
      );
    }
  } else {
    checkHeads(pages, { origin, mode, homeTitle });
  }
  // Rules before 404.html: a build stopped between them leaves Pages' all-paths-are-the-app mode.
  put('_redirects', redirectsFile(rules));
  for (const page of pages.filter((p) => p.file !== '404.html')) put(page.file, page.html);
  for (const ext of ['', '.br', '.gz'])
    rmSync(path.join(dist, `sitemap.xml${ext}`), { force: true });
  if (mode === 'live') put('sitemap.xml', sitemapXml(origin, pages));
  put('404.html', pages.find((p) => p.file === '404.html').html);
  return written;
}

/** The inputs the build reads: posts.json, the tracked universe, the research notes. */
export async function readInputs(repoRoot = root) {
  const { loadNotes } = await import('./research-notes/notes.mjs');
  const postsJson = readFileSync(path.join(repoRoot, 'docs', 'blog', 'posts.json'), 'utf8');
  const universe = JSON.parse(
    readFileSync(path.join(repoRoot, 'apps', 'api', 'config', 'universe.json'), 'utf8'),
  ).universe;
  if (!Array.isArray(universe) || universe.length === 0) {
    throw new Error('[blog-heads] apps/api/config/universe.json has no universe list');
  }
  const { notes, errors } = loadNotes(path.join(repoRoot, 'research'), repoRoot);
  if (errors.length) throw new Error(`[blog-heads] research notes have ${errors.length} error(s)`);
  return { postsJson, universe, notes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = path.join(root, 'apps', 'dashboard', 'dist');
  const { mode } = JSON.parse(readFileSync(path.join(dist, 'demo-mode.json'), 'utf8'));
  const written = writeHeads(dist, { ...(await readInputs()), mode });
  console.log(`[blog-heads] wrote ${written.length} files (${mode})`);
}
