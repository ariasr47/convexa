/**
 * redesign-stage-1 §8-7 — the blog GENERATOR output is token-compliant and drift-proof:
 *   - the emitted pages carry the REAL token values (imported from tokens.ts — change a token
 *     and this spec forces a `py docs/blog/build_html.py` regeneration);
 *   - they carry NONE of the retired hexes (cream especially — banned-hexes.spec.ts also scans
 *     them; the body-background assertion here is the positive half);
 *   - no external font URL (the same-origin discipline, shared with fonts.spec.ts's checker);
 *   - `docs/blog/<slug>.html` ≡ `public/blog/<slug>.html` BYTE-IDENTICAL where both are
 *     committed — the script IS the sync step, hand-edited drift fails here.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { palette } from './tokens';

const BLOG_PAGES = import.meta.glob(['/public/blog/*.html'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Repo root, resolved by walking up from the test cwd to the Nx workspace root. */
function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'nx.json'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('nx workspace root not found from ' + process.cwd());
}
const REPO_ROOT = repoRoot();

describe('§8-7 · blog generator output token-compliant', () => {
  it('the glob is not vacuous', () => {
    expect(Object.keys(BLOG_PAGES).length).toBeGreaterThanOrEqual(2);
  });

  it('every page joins the terminal identity — body on ink, phosphor text, tokens present', () => {
    for (const [file, html] of Object.entries(BLOG_PAGES)) {
      // The template carries the token literals with tokens.ts named as source; these
      // assertions BIND them to the real tokens so template drift fails the suite.
      expect(html, `${file}: body background = ink`).toContain(
        `background:${palette.dark.background.default}`,
      );
      expect(html, `${file}: body color = phosphor`).toContain(`color:${palette.dark.text.primary}`);
      expect(html, `${file}: code/th surface = panel`).toContain(palette.dark.background.paper);
      expect(html, `${file}: links = signal`).toContain(`a { color:${palette.dark.info}`);
      expect(html, `${file}: blockquote rule = gammaAmber`).toContain(palette.dark.primary.main);
      expect(html, `${file}: figcaption/blockquote text = steel`).toContain(
        palette.dark.text.secondary,
      );
      expect(html, `${file}: dark color-scheme`).toContain('color-scheme: dark');
    }
  });

  it('docs/blog and public/blog copies are byte-identical (the script is the sync step)', () => {
    const slugs = Object.keys(BLOG_PAGES).map((k) => k.replace('/public/blog/', ''));
    expect(slugs.length).toBeGreaterThanOrEqual(2);
    for (const slug of slugs) {
      const docsPath = resolve(REPO_ROOT, 'docs', 'blog', slug);
      const publicPath = resolve(REPO_ROOT, 'apps', 'dashboard', 'public', 'blog', slug);
      if (!existsSync(docsPath)) continue; // only committed pairs are compared
      const docs = readFileSync(docsPath, 'utf-8');
      const pub = readFileSync(publicPath, 'utf-8');
      expect(docs === pub, `${slug}: docs/blog and public/blog must be byte-identical`).toBe(true);
    }
  });
});
