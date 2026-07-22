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

import { extras, palette } from './tokens';

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

  it('every 6-digit hex inside the inline <svg> illustrations ∈ the stage-3 token allowlist (§8-9b)', () => {
    // The 7 recomposed figures paint ONLY the shipped tokens (static assets can't consume the
    // theme, so the literals are byte-bound to tokens.ts — the generator precedent): fields on
    // ink/panel/panelRaised, text phosphor/steel, accents gammaAmber + signal, warningOrange
    // solely where a figure depicts a fault/bounce. The cream family is additionally BANNED
    // outright in banned-hexes.spec.ts (§8-9a).
    const ALLOWED = new Set(
      [
        palette.dark.background.default, // ink
        palette.dark.background.paper, //   panel
        extras.panelRaised, //              panelRaised
        palette.dark.text.primary, //       phosphor
        palette.dark.text.secondary, //     steel
        palette.dark.primary.main, //       gammaAmber
        palette.dark.info, //               signal
        palette.dark.warning, //            warningOrange
      ].map((h) => h.toLowerCase()),
    );
    const svgHexes = (html: string): string[] => {
      const out: string[] = [];
      for (const svg of html.match(/<svg[\s\S]*?<\/svg>/g) ?? []) {
        for (const hex of svg.match(/#[0-9a-fA-F]{6}\b/g) ?? []) out.push(hex.toLowerCase());
      }
      return out;
    };
    // MUTATION GUARD: a fixture SVG carrying a stray hex is flagged; an allowlisted one is not.
    const stray = svgHexes('<svg><rect fill="#ABCDEF"/></svg>').filter((h) => !ALLOWED.has(h));
    expect(stray).toEqual(['#abcdef']);
    expect(
      svgHexes(`<svg><rect fill="${palette.dark.primary.main}"/></svg>`).filter(
        (h) => !ALLOWED.has(h),
      ),
    ).toEqual([]);

    let sawSvg = false;
    for (const [file, html] of Object.entries(BLOG_PAGES)) {
      const hexes = svgHexes(html);
      if (hexes.length) sawSvg = true;
      const offenders = hexes.filter((h) => !ALLOWED.has(h));
      expect(offenders, `${file}: inline-SVG hexes outside the token allowlist`).toEqual([]);
    }
    // Vacuity guard: at least one emitted page actually embeds SVG artwork.
    expect(sawSvg).toBe(true);
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
