import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { blogHead, readPosts, writeBlogHeads } from './write-blog-heads.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The shell's real head: the built dist/index.html keeps these tags as written here.
const shell = readFileSync(path.join(root, 'apps', 'dashboard', 'index.html'), 'utf8');
const postsJson = readFileSync(path.join(root, 'docs', 'blog', 'posts.json'), 'utf8');

const attr = (html, re) => html.match(re)?.[1];
const head = (html) => ({
  title: attr(html, /<title>([^<]*)<\/title>/),
  canonical: attr(html, /<link\s+rel="canonical"\s+href="([^"]*)"/),
  description: attr(html, /<meta\s+name="description"\s+content="([^"]*)"/),
  ogType: attr(html, /<meta\s+property="og:type"\s+content="([^"]*)"/),
  ogTitle: attr(html, /<meta\s+property="og:title"\s+content="([^"]*)"/),
  ogDescription: attr(html, /<meta\s+property="og:description"\s+content="([^"]*)"/),
  ogUrl: attr(html, /<meta\s+property="og:url"\s+content="([^"]*)"/),
  twitterTitle: attr(html, /<meta\s+name="twitter:title"\s+content="([^"]*)"/),
  twitterDescription: attr(html, /<meta\s+name="twitter:description"\s+content="([^"]*)"/),
});

test('W1-22: a post address serves the post’s title, canonical and share tags, not the home page’s', () => {
  const [post] = readPosts(postsJson);
  const html = blogHead(shell, post);
  assert.deepEqual(head(html), {
    title: `${post.title} — Convexa`,
    canonical: `https://convexa.pages.dev/blog/${post.slug}`,
    description: post.description,
    ogType: 'article',
    ogTitle: post.title,
    ogDescription: post.description,
    ogUrl: `https://convexa.pages.dev/blog/${post.slug}`,
    twitterTitle: post.title,
    twitterDescription: post.description,
  });
  // Nothing of the home page's head is left to contradict it.
  assert.ok(!html.includes('See the dealer positioning behind the price.'));
  assert.ok(!/content="https:\/\/convexa\.pages\.dev\/"/.test(html));
  assert.ok(!/href="https:\/\/convexa\.pages\.dev\/"/.test(html));
  // The rest of the shell is untouched: same body, same scripts.
  assert.equal(html.slice(html.indexOf('</head>')), shell.slice(shell.indexOf('</head>')));
});

test('post text is escaped for HTML, and a $ in it is kept literally', () => {
  const html = blogHead(shell, {
    slug: 'a-post',
    title: 'Walls & "flips" <in> $412B',
    description: "It's $& and $1 — not patterns",
  });
  assert.equal(head(html).ogTitle, 'Walls &amp; &quot;flips&quot; &lt;in&gt; $412B');
  assert.equal(head(html).title, 'Walls &amp; "flips" &lt;in&gt; $412B — Convexa');
  assert.equal(head(html).description, "It's $&amp; and $1 — not patterns");
});

test('a head tag the shell no longer carries fails the build rather than sharing as the home page', () => {
  const [post] = readPosts(postsJson);
  for (const drop of [
    /<meta\s+property="og:url"[^>]*>/,
    /<title>[^<]*<\/title>/,
    /<link\s+rel="canonical"[^>]*>/,
  ]) {
    assert.throws(() => blogHead(shell.replace(drop, ''), post), /blog-heads/);
  }
  const twice = shell.replace('</head>', '<meta property="og:title" content="x" />\n</head>');
  assert.throws(() => blogHead(twice, post), /og:title tags; expected exactly 1/);
});

test('the post list is checked: a slug must be a plain path segment, listed once, with its text', () => {
  const ok = { slug: 'a-post', title: 'T', description: 'D' };
  assert.deepEqual(readPosts(JSON.stringify([ok])), [ok]);
  for (const bad of [
    [],
    {},
    [{ ...ok, slug: '../escape' }],
    [{ ...ok, slug: 'a/b' }],
    [{ ...ok, slug: 'A-Post' }],
    [{ ...ok, title: ' ' }],
    [{ ...ok, description: null }],
    [ok, ok],
  ]) {
    assert.throws(() => readPosts(JSON.stringify(bad)), /blog-heads/, JSON.stringify(bad));
  }
});

test('writes dist/blog/<slug>.html for every published post', () => {
  const dist = mkdtempSync(path.join(os.tmpdir(), 'convexa-blog-heads-'));
  try {
    writeFileSync(path.join(dist, 'index.html'), shell);
    const written = writeBlogHeads(dist, postsJson);
    const slugs = readPosts(postsJson).map((p) => p.slug);
    assert.deepEqual(
      written.map((f) => path.relative(dist, f)),
      slugs.map((s) => path.join('blog', `${s}.html`)),
    );
    for (const file of written)
      assert.match(readFileSync(file, 'utf8'), /og:type" content="article"/);
  } finally {
    const resolved = path.resolve(dist);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
    rmSync(resolved, { recursive: true, force: true });
  }
});
