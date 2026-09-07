/**
 * redesign-stage-1 §8-3 — fonts are SELF-HOSTED, same-origin only (deploy CSP / no-external-host
 * discipline):
 *   - zero external font URLs in index.html, src/styles.css, or the generated blog output
 *     (no fonts.googleapis / fonts.gstatic / use.typekit / any http(s) host / any CDN);
 *   - `font-display: swap` on EVERY declared face;
 *   - the first-paint preloads (Plex Sans 400 + Plex Mono 400) exist with `crossorigin`;
 *   - the shipped woff2 assets AND their OFL.txt license files exist on disk beside each face;
 *   - (skill enforcement rider, Stage 1 "face allowlist") no component names a retired-identity
 *     face literal — components bind `typographyTokens`, never a face string.
 * Source scans are MUTATION-GUARDED per the house rule (a scan that can't fail is worthless).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Root-anchored raw GLOB (not a static import — keeps @nx/enforce-module-boundaries happy).
const INDEX_RAW = import.meta.glob(['/index.html'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const indexHtml = Object.values(INDEX_RAW)[0] ?? '';

const BLOG_PAGES = import.meta.glob(['/public/blog/*.html'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const APP_SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** apps/dashboard root, resolved by walking up from the test cwd to the Nx workspace root. */
function dashboardRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'nx.json'))) return resolve(dir, 'apps', 'dashboard');
    dir = resolve(dir, '..');
  }
  throw new Error('nx workspace root not found from ' + process.cwd());
}
const DASHBOARD_ROOT = dashboardRoot();

// NOTE: a `?raw` import of CSS yields '' under Vitest's css pipeline (caught by the vacuity
// guard below) — the stylesheet is read from disk instead.
const stylesCss = readFileSync(resolve(DASHBOARD_ROOT, 'src', 'styles.css'), 'utf-8');

/** Pure checker (mutation-tested): external/CDN font-host references in a text. */
function externalFontHosts(text: string): string[] {
  const tells = [
    'fonts.googleapis',
    'fonts.gstatic',
    'use.typekit',
    'fontawesome',
    'cdn.jsdelivr',
    'unpkg.com',
  ];
  const hits = tells.filter((t) => text.includes(t));
  // Any absolute http(s) URL inside a @font-face src or a font preload is also a violation.
  const fontUrl =
    /(?:@font-face[^}]*src\s*:[^};]*url\(\s*['"]?(https?:\/\/[^'")]+))|(?:<link[^>]*as="font"[^>]*href="(https?:\/\/[^"]+))/gi;
  for (const m of text.matchAll(fontUrl)) hits.push(m[1] ?? m[2]);
  return hits;
}

/** Pure checker (mutation-tested): @font-face blocks missing `font-display: swap`. */
function facesMissingSwap(text: string): string[] {
  const blocks = text.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  return blocks.filter((b) => !/font-display\s*:\s*swap/.test(b));
}

describe('§8-3 · fonts self-hosted, same-origin only', () => {
  it('globs/raws are not vacuous', () => {
    expect(indexHtml.length).toBeGreaterThan(100);
    expect(stylesCss).toContain('@font-face');
    expect(Object.keys(BLOG_PAGES).length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(APP_SOURCES).length).toBeGreaterThan(40);
  });

  it('MUTATION GUARD: the external-host checker fails on a Google-Fonts fixture', () => {
    expect(
      externalFontHosts(
        `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">`,
      ),
    ).toContain('fonts.googleapis');
    expect(
      externalFontHosts(`@font-face { src: url('https://evil.example/f.woff2') format('woff2'); }`),
    ).toContain('https://evil.example/f.woff2');
    expect(externalFontHosts(`@font-face { src: url('/fonts/x/y.woff2'); }`)).toEqual([]);
  });

  it('MUTATION GUARD: the swap checker fails on a face without font-display: swap', () => {
    expect(facesMissingSwap(`@font-face { font-family: 'X'; src: url('/f.woff2'); }`)).toHaveLength(
      1,
    );
    expect(
      facesMissingSwap(
        `@font-face { font-family: 'X'; font-display: swap; src: url('/f.woff2'); }`,
      ),
    ).toEqual([]);
  });

  it('index.html + styles.css + blog output carry ZERO external font hosts', () => {
    expect(externalFontHosts(indexHtml)).toEqual([]);
    expect(externalFontHosts(stylesCss)).toEqual([]);
    for (const [file, html] of Object.entries(BLOG_PAGES)) {
      expect(externalFontHosts(html), file).toEqual([]);
    }
  });

  it('every declared face carries font-display: swap (app css + blog template output)', () => {
    expect(facesMissingSwap(stylesCss)).toEqual([]);
    for (const [file, html] of Object.entries(BLOG_PAGES)) {
      expect(facesMissingSwap(html), file).toEqual([]);
      expect(html, `${file} must declare its faces`).toContain('@font-face');
    }
  });

  it('the first-paint preloads exist with crossorigin (Plex Sans 400 + Plex Mono 400)', () => {
    const preloads = indexHtml.match(/<link[^>]*rel="preload"[^>]*as="font"[^>]*>/g) ?? [];
    const sans = preloads.find((l) => l.includes('ibm-plex-sans-latin-400-normal.woff2'));
    const mono = preloads.find((l) => l.includes('ibm-plex-mono-latin-400-normal.woff2'));
    expect(sans, 'Plex Sans 400 preload').toBeTruthy();
    expect(mono, 'Plex Mono 400 preload').toBeTruthy();
    expect(sans).toContain('crossorigin');
    expect(mono).toContain('crossorigin');
    expect(sans).toContain('type="font/woff2"');
  });

  it('the shipped assets + OFL license files exist beside each face', () => {
    const files = [
      'public/fonts/archivo/archivo-latin-standard-normal.woff2',
      'public/fonts/archivo/OFL.txt',
      'public/fonts/ibm-plex-sans/ibm-plex-sans-latin-400-normal.woff2',
      'public/fonts/ibm-plex-sans/ibm-plex-sans-latin-500-normal.woff2',
      'public/fonts/ibm-plex-sans/ibm-plex-sans-latin-600-normal.woff2',
      'public/fonts/ibm-plex-sans/ibm-plex-sans-latin-700-normal.woff2',
      'public/fonts/ibm-plex-sans/OFL.txt',
      'public/fonts/ibm-plex-mono/ibm-plex-mono-latin-400-normal.woff2',
      'public/fonts/ibm-plex-mono/ibm-plex-mono-latin-500-normal.woff2',
      'public/fonts/ibm-plex-mono/ibm-plex-mono-latin-600-normal.woff2',
      'public/fonts/ibm-plex-mono/OFL.txt',
    ];
    for (const f of files) {
      expect(existsSync(resolve(DASHBOARD_ROOT, f)), `${f} must be shipped`).toBe(true);
    }
  });
});

describe('face allowlist rider · no retired-identity face literal in components', () => {
  const RETIRED_FACES = /['"](Inter|Roboto Mono|Cascadia Code)['"]/;

  it('MUTATION GUARD: the face scan fails on an Inter literal', () => {
    expect(RETIRED_FACES.test(`fontFamily: 'Inter, sans-serif'`)).toBe(false); // stack strings differ
    expect(RETIRED_FACES.test(`fontFamily: 'Inter'`)).toBe(true);
    expect(RETIRED_FACES.test(`fontFamily: "Roboto Mono"`)).toBe(true);
  });

  it('no component source names a retired face (components bind typographyTokens)', () => {
    const violations = Object.keys(APP_SOURCES).filter((f) => RETIRED_FACES.test(APP_SOURCES[f]));
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// criterion N-1 (curvature-v2-surfaces SPEC §2.3, FE-1 step 6) — ONE register decision, enforced
// as negative space over three trees. TWO needles, each with its OWN poison.
//
// WHY THIS IS NOT INHERITED FROM THE BLOCK ABOVE. That block's mutation guard (`:157-161`) proves
// exactly one thing: that `RETIRED_FACES` catches a retired FACE LITERAL (`Inter`). It exercises
// NEITHER needle below. A scan whose poison proof lives in a different scan is the vacuous
// mutation proof `[structural-over-prose-enforcement]` exists to catch, so each needle here ships
// its own red-going guard against its own planted fixtures.
//
// ENFORCING FROM THE FIRST COMMIT, behind a live-checked `EXEMPT` map. The fourteen files that
// bind a face locally today are named below WITH the task that removes each one; FE-14 asserts the
// map empty. The live check means a stale exemption cannot quietly widen the fence: an entry whose
// file has vanished, or which no longer violates either needle, red-builds.
// ---------------------------------------------------------------------------------------------

/** Criterion N-1's three trees. Sources only — a spec may of course name a face in a fixture. */
const N1_SOURCES = import.meta.glob(
  [
    '/src/app/features/trading/**/*.{ts,tsx}',
    '/src/app/pages/positions/**/*.{ts,tsx}',
    '/src/app/pages/scanner/**/*.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** The closed nine (`shared/copy/notANumber.ts:26-36`), inlined so the scan is a pure text check. */
const NINE = [
  '—',
  'unavailable',
  'not given',
  'not set',
  'size not suggested',
  'unrecognized',
  'not recorded',
  'no basis',
  'not provided',
];

/**
 * NEEDLE 1 — a mono-bound line. Detected by NAME rather than by binding syntax: PLAN's illustrative
 * `/\.\.\.\s*MONO\b|MONO_FACE|monoFontFamily|fontFamily\s*:\s*MONO\b/` cannot match its own required
 * fixture (`<Box sx={MONO}>` carries neither a spread nor a `fontFamily:` prefix), and `sx={MONO}`
 * is exactly how the shipped atoms bind it. This form is a strict SUPERSET of all four listed
 * shapes — `...MONO`, `MONO_FACE`, `monoFontFamily`, `fontFamily: MONO` — plus the two local
 * spellings the tree actually carries (`monoSx`, `sx={MONO}`).
 */
const MONO_BOUND = /\bMONO(_FACE)?\b|\bmonoSx\b|\bmonoFontFamily\b/;

/** A closed-nine member as a rendered value: a quoted literal or a bare JSX text node. */
const carriesMember = (line: string, member: string): boolean =>
  line.includes(`'${member}'`) ||
  line.includes(`"${member}"`) ||
  line.includes(`\`${member}\``) ||
  line.includes(`>${member}<`);

/**
 * Needle 1, windowed: a closed-nine member rendered inside a mono-bound run. The window is
 * −6/+12 lines around the mono binding — a `const MONO = {…}` sits above its uses, an `sx` spread
 * sits above the value it wraps. Returns `line:member` so a red names the site, not just the file.
 */
export function memberInMonoRun(src: string): string[] {
  const lines = src.split('\n');
  const hits = new Set<string>();
  lines.forEach((line, i) => {
    if (!MONO_BOUND.test(line)) return;
    const from = Math.max(0, i - 6);
    const to = Math.min(lines.length - 1, i + 12);
    for (let j = from; j <= to; j++) {
      for (const member of NINE) {
        if (carriesMember(lines[j], member)) hits.add(`${j + 1}:${member}`);
      }
    }
  });
  return [...hits];
}

/** NEEDLE 2 — a face literal, or a face binding, outside the two homes. */
const FACE_LITERAL = /fontFamily\s*:\s*['"`]/;
const FACE_BINDING = /typographyTokens\s*\.\s*(mono|display)?[Ff]ontFamily|\bfontFamily\s*:/;

/**
 * The two homes are `shared/theme/tokens.ts` (the tokens) and `shared/figure/` (the one binding);
 * neither is inside this scan's three trees, so no allowlist is needed — a source in scope may not
 * name a font family AT ALL. It spreads `...faceFor(mono)` / `...MONO_FACE` instead, which is why
 * the third fixture below must read clean.
 */
export const bindsFaceLocally = (src: string): boolean =>
  FACE_LITERAL.test(src) || FACE_BINDING.test(src);

/**
 * EXEMPT — the fourteen files that bind a face locally today, each with the task that removes it.
 * Measured at FE-1 (the site list is in the build report). Live-checked below on BOTH arms: the
 * file must still exist in the scan, and it must still violate. FE-14 asserts this map is empty.
 */
const EXEMPT: Record<string, string> = {
  'pages/scanner/ScanCells.tsx': 'FE-3 — the atoms consume the module; local `MONO` deleted',
  'pages/scanner/ViewEditorDialog.tsx': 'FE-3 — `MONO.fontFamily` becomes `...MONO_FACE`',
  'features/trading/positions/PositionRow.tsx': 'FE-5 — six live-derived cells take the module',
  'features/trading/positions/PositionCard.tsx': 'FE-5 — the card takes the module route too',
  'features/trading/positions/LegDisclosure.tsx': 'FE-5 — face re-point',
  'features/trading/outcomes/TrackRecordSection.tsx': 'FE-5 — face re-point',
  'features/trading/orders/OrderRow.tsx': 'FE-5 — face re-point only (the `⏸` at :172 is Z-1 debt)',
  'features/trading/orders/OrderDetailDialog.tsx': 'FE-5 — face re-point only',
  'features/trading/broker/BrokerPositionRow.tsx': 'FE-7 — Broker tab register conversion',
  'features/trading/broker/BrokerPositionCard.tsx': 'FE-7 — Broker tab register conversion',
  'features/trading/broker/BrokerGroupHeader.tsx': 'FE-7 — Broker tab register conversion',
  'features/trading/broker/ProvenanceHeader.tsx': 'FE-7 — Broker tab register conversion',
  'features/trading/broker/reassess.tsx': 'FE-7 — Broker tab register conversion',
  'pages/positions/PositionsPage.tsx': 'FE-6 — the header readout converts to `FigureCell`',
};

const isExempt = (key: string) => Object.keys(EXEMPT).some((rel) => key === `/src/app/${rel}`);

describe('N-1 · one register decision — no closed-nine member in a mono run, no local face binding', () => {
  it('the scan is not vacuous (all three trees actually loaded)', () => {
    const keys = Object.keys(N1_SOURCES);
    expect(keys.length).toBeGreaterThan(10);
    expect(keys.some((f) => f.startsWith('/src/app/pages/scanner/'))).toBe(true);
    expect(keys.some((f) => f.startsWith('/src/app/features/trading/positions/'))).toBe(true);
    expect(keys.some((f) => f.startsWith('/src/app/pages/positions/'))).toBe(true);
  });

  it('MUTATION GUARD, NEEDLE 1 (its own): a member inside a mono run is caught; the same markup in Sans is not', () => {
    expect(
      memberInMonoRun("const MONO={fontFamily:x};\n<Box sx={MONO}>{'not recorded'}</Box>"),
    ).not.toEqual([]);
    expect(
      memberInMonoRun("const SANS={fontFamily:x};\n<Box sx={SANS}>{'not recorded'}</Box>"),
    ).toEqual([]);
    // it reports WHERE, and it reads a bare JSX text node as well as a quoted literal
    expect(memberInMonoRun('<Box sx={{ ...MONO }}>—</Box>')).toEqual(['1:—']);
    // …and a mono run with no member in it is clean, so the needle is not simply always-true
    expect(memberInMonoRun('<Box sx={{ ...MONO }}>{price}</Box>')).toEqual([]);
  });

  it('MUTATION GUARD, NEEDLE 2 (its own): a face literal and a face binding are caught; the module route is not', () => {
    expect(bindsFaceLocally(`fontFamily: 'IBM Plex Mono'`)).toBe(true);
    expect(bindsFaceLocally('fontFamily: typographyTokens.monoFontFamily')).toBe(true);
    expect(bindsFaceLocally('const monoSx = typographyTokens.monoFontFamily;')).toBe(true);
    expect(bindsFaceLocally('fontFamily: MONO.fontFamily')).toBe(true);
    expect(bindsFaceLocally('...faceFor(true)')).toBe(false);
    expect(bindsFaceLocally('sx={{ ...MONO_FACE, fontSize: 12 }}')).toBe(false);
  });

  it('every EXEMPT entry still exists AND still violates (no stale exemption widens the fence)', () => {
    for (const [rel, owner] of Object.entries(EXEMPT)) {
      const src = N1_SOURCES[`/src/app/${rel}`];
      expect(src, `EXEMPT entry ${rel} must still exist (${owner})`).toBeTruthy();
      const stillViolates = bindsFaceLocally(src) || memberInMonoRun(src).length > 0;
      expect(
        stillViolates,
        `EXEMPT entry ${rel} no longer violates — DELETE the entry (${owner})`,
      ).toBe(true);
      expect(owner, `EXEMPT entry ${rel} must name the task that removes it`).toMatch(/FE-\d+/);
    }
  });

  it('no non-exempt source in the three trees binds a face locally or renders a member in a mono run', () => {
    const offenders = Object.entries(N1_SOURCES)
      .filter(([file]) => !isExempt(file))
      .flatMap(([file, src]) => {
        const out: string[] = [];
        if (bindsFaceLocally(src)) out.push(`${file} → binds a font face locally (needle 2)`);
        const members = memberInMonoRun(src);
        if (members.length) {
          out.push(`${file} → closed-nine member in a mono run (needle 1): ${members.join(', ')}`);
        }
        return out;
      });
    expect(offenders, `N-1 violation:\n${offenders.join('\n')}`).toEqual([]);
  });
});
