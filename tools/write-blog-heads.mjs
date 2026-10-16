#!/usr/bin/env node
/**
 * Gives each blog post's address its own head (W1-22). Run after the dashboard build
 * (tools/build-dashboard.mjs), it writes `dist/blog/<slug>.html`: a copy of the built
 * `dist/index.html` — the same SPA shell, scripts and styles — whose <title>, description,
 * canonical, og:* and twitter:* tags name the post instead of the home page.
 *
 * Why a copy of the shell, not a page of its own: the post renders inside the shell
 * (apps/dashboard/src/app/pages/blog/BlogPostPage.tsx), and a share preview or a crawler reads only
 * the HTML the address serves. Cloudflare Pages serves `blog/<slug>.html` at `/blog/<slug>` (and
 * 308-redirects the `.html` address there), ahead of the `/* /index.html 200` fallback, so the
 * post's canonical address carries the post's tags while the SPA hydrates over it exactly as it
 * does over index.html. Written into dist only, never into public/blog/: a page there is source,
 * and docs/blog/build_html.py's rule keeps public/blog/<slug>.html empty.
 *
 * The post list is docs/blog/posts.json, the one the site and build_html.py read. Every tag this
 * replaces must be present exactly once in index.html, and every post must be well formed, or the
 * build fails: a silent miss here is a post that shares as the home page.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const escapeAttr = (s) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
const escapeText = (s) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** The published posts, checked: a slug that is a safe path segment, a title and a description. */
export function readPosts(json) {
  const list = JSON.parse(json);
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('[blog-heads] docs/blog/posts.json must be a non-empty array');
  }
  const seen = new Set();
  return list.map((post, i) => {
    const { slug, title, description } = post ?? {};
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
    return { slug, title, description };
  });
}

/** Replace exactly one match of `re` in `html`, or throw naming `what`. */
function replaceOnce(html, re, replacement, what) {
  const matches = html.match(new RegExp(re.source, `${re.flags.replace('g', '')}g`));
  if (!matches || matches.length !== 1) {
    throw new Error(
      `[blog-heads] index.html has ${matches ? matches.length : 0} ${what}; expected exactly 1`,
    );
  }
  // A function, so a `$` in a post's text is never read as a replacement pattern.
  return html.replace(re, () => replacement);
}

const meta = (attr, name) =>
  new RegExp(`<meta\\s+${attr}="${name.replace(/[.:]/g, '\\$&')}"\\s+content="[^"]*"\\s*/?>`);

/**
 * The built shell with the post's head. `indexHtml` is dist/index.html; the site's origin is read
 * from its own canonical link, so the shell stays the one place that names it.
 */
export function blogHead(indexHtml, post) {
  const canonical = indexHtml.match(/<link\s+rel="canonical"\s+href="([^"]+)"\s*\/?>/);
  if (!canonical) throw new Error('[blog-heads] index.html has no canonical link');
  const url = new URL(`blog/${post.slug}`, canonical[1]).href;
  const title = `${post.title} — Convexa`;
  let html = indexHtml;
  html = replaceOnce(
    html,
    /<title>[^<]*<\/title>/,
    `<title>${escapeText(title)}</title>`,
    '<title>',
  );
  html = replaceOnce(
    html,
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${escapeAttr(url)}" />`,
    'canonical links',
  );
  const tags = [
    ['name', 'description', post.description],
    ['property', 'og:type', 'article'],
    ['property', 'og:title', post.title],
    ['property', 'og:description', post.description],
    ['property', 'og:url', url],
    ['name', 'twitter:title', post.title],
    ['name', 'twitter:description', post.description],
  ];
  for (const [attr, name, value] of tags) {
    html = replaceOnce(
      html,
      meta(attr, name),
      `<meta ${attr}="${name}" content="${escapeAttr(value)}" />`,
      `${name} tags`,
    );
  }
  return html;
}

/** Writes dist/blog/<slug>.html for every published post; returns the paths written. */
export function writeBlogHeads(dist, postsJson) {
  const indexHtml = readFileSync(path.join(dist, 'index.html'), 'utf8');
  const posts = readPosts(postsJson);
  mkdirSync(path.join(dist, 'blog'), { recursive: true });
  return posts.map((post) => {
    const file = path.join(dist, 'blog', `${post.slug}.html`);
    writeFileSync(file, blogHead(indexHtml, post));
    return file;
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = path.join(root, 'apps', 'dashboard', 'dist');
  const postsJson = readFileSync(path.join(root, 'docs', 'blog', 'posts.json'), 'utf8');
  for (const file of writeBlogHeads(dist, postsJson)) {
    console.log(`[blog-heads] wrote ${path.relative(root, file)}`);
  }
}
