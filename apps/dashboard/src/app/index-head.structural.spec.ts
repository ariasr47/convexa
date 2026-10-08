/**
 * AC-L10 / AC-L11 / AC-L11a — §7 item 8. Positive AND negative, so neither half can pass vacuously.
 * The three v1 strings are DIFFERENT strings at different sites: an absence check written against
 * the share hook alone was always green on <title>, which never contained it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const INDEX_RAW = import.meta.glob(['/index.html'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const html = INDEX_RAW['/index.html'];

const TITLE = 'Convexa — See the dealer positioning behind the price.';
const DESCRIPTION =
  'Convexa turns an option chain into dealer gamma structure — the call and put walls, the gamma flip, the magnet — then gives you a risk-first AI read on the setup.';
const V1_TITLE = 'Convexa — AI dealer-gamma analytics for options traders';
const V1_SHARE_HOOK = 'Convexa — See the AI read on your real positioning';
const V1_LIVE_CLAIM = 'live order flow';

function workspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'nx.json'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('nx workspace root not found from ' + process.cwd());
}
const ARTICLE = resolve(
  workspaceRoot(),
  'apps/dashboard/public/blog/how-we-read-dealer-structure.html',
);

describe('AC-L10 — the served head reads the v2 promise', () => {
  it('the glob is not vacuous', () => {
    expect(html).toContain('<html lang="en">');
  });

  it('<title>, og:title and twitter:title EQUAL the hero sentence', () => {
    expect(html.match(/<title>([^<]*)<\/title>/)?.[1]).toBe(TITLE);
    expect(html.match(/<meta property="og:title" content="([^"]*)"/)?.[1]).toBe(TITLE);
    expect(html.match(/<meta name="twitter:title" content="([^"]*)"/)?.[1]).toBe(TITLE);
  });

  it('description, og:description and twitter:description EQUAL the hero summary sentence', () => {
    const descs = [...html.matchAll(/content="([^"]*)"\s*\/?>/g)].map((m) => m[1]);
    expect(descs.filter((d) => d === DESCRIPTION)).toHaveLength(3);
  });

  it('all three v1 strings are gone', () => {
    expect(html).not.toContain(V1_TITLE);
    expect(html).not.toContain(V1_SHARE_HOOK);
    expect(html).not.toContain(V1_LIVE_CLAIM);
  });
});

describe('AC-L11 / AC-L11a — the no-JavaScript path', () => {
  it('a <noscript> exists, names Convexa, and anchors at the standalone article', () => {
    const block = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1];
    expect(block, 'index.html must carry a <noscript> block').toBeTruthy();
    expect(block).toContain('Convexa');
    expect(block).toContain('/blog/how-we-read-dealer-structure.html');
    expect(block).toContain(
      'How We Read Dealer Structure — a plain page that works without JavaScript.',
    );
  });

  it('the <noscript> carries no hardcoded hex (`[theme-token-discipline]`)', () => {
    const block = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] ?? '';
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('the target document exists on disk and needs no JavaScript', () => {
    expect(existsSync(ARTICLE)).toBe(true);
    const article = readFileSync(ARTICLE, 'utf8');
    expect(article).not.toContain('<script type="module">');
    expect(article).toContain('How We Read Dealer Structure');
  });
});
