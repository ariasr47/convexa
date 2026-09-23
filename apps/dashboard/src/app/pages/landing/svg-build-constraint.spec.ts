/**
 * GATE Z I-4 (SPEC §7 item 3) — the hero SVG build constraint's remaining two mechanisms, each
 * FIXTURE-PROBED (a scan that cannot fail is prose wearing a test's clothes, SPEC §7 preamble):
 *
 *   1. An ESLint `no-restricted-imports` ban on `three`, `@react-three/*`, `regl` and `pixi.js`
 *      on the public surfaces (`eslint.config.mjs`'s existing SPEC §2.1 deny-list block — the ban
 *      lives in that SAME `patterns` array, not a second override object, because ESLint flat
 *      config does not merge rule VALUES across two configs matching the same file: a second
 *      `no-restricted-imports` block scoped to `pages/landing/**` would SILENTLY REPLACE, not
 *      extend, the four bans already there). Proven here by actually RUNNING ESLint's Node API
 *      against an in-memory fixture — the same mechanism QA's own `eslint --stdin` probe used,
 *      automated instead of manual.
 *   2. No new dependency in `package.json` that would make (1) moot at the source.
 *
 * The THIRD mechanism SPEC §7 item 3 names — "a `?raw` assertion that `GammaSurfaceHero.tsx`
 * contains no `getContext(`, no `requestAnimationFrame` and no `useEffect`" — is
 * `GammaSurfaceHero.spec.tsx`'s own test, unchanged; the folder-wide `<canvas>`/WebGL negative
 * space is `landing-structure.spec.tsx`'s (GATE Z I-4 addition, same commit as this file). "The
 * SVG present at first paint under the strict fetch harness" is `landing.spec.tsx`'s existing
 * render (the hero has no async work — SPEC §2.1 — so it paints unconditionally).
 */
import { ESLint } from 'eslint';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function workspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'nx.json'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('nx workspace root not found from ' + process.cwd());
}
const ROOT = workspaceRoot();
// ONE instance, reused across every probe below — flat-config resolution (parser + every plugin
// this workspace's `eslint.config.mjs` wires) is the expensive part; re-instantiating per probe
// would pay that cost eight times over for no reason.
const eslint = new ESLint({ cwd: ROOT });

async function lint(relativeFilePath: string, source: string) {
  const [result] = await eslint.lintText(source, {
    filePath: resolve(ROOT, relativeFilePath),
  });
  return result;
}

const BANNED_IMPORT_FIXTURES: Record<string, string> = {
  three: `import * as THREE from 'three';\nexport const x = THREE;\n`,
  '@react-three/fiber': `import { Canvas } from '@react-three/fiber';\nexport const x = Canvas;\n`,
  regl: `import createRegl from 'regl';\nexport const x = createRegl;\n`,
  'pixi.js': `import * as PIXI from 'pixi.js';\nexport const x = PIXI;\n`,
};

describe('GATE Z I-4 (§7 item 3, mechanism 2) — the ESLint ban, fixture-probed for real (not read as config text)', () => {
  it.each(Object.entries(BANNED_IMPORT_FIXTURES))(
    'a landing file importing %s is a no-restricted-imports ERROR',
    async (specifier, source) => {
      const result = await lint('apps/dashboard/src/app/pages/landing/QaProbe.tsx', source);
      const hit = result.messages.find((m) => m.ruleId === 'no-restricted-imports');
      expect(
        hit,
        `no-restricted-imports did not fire for '${specifier}' on pages/landing/**`,
      ).toBeTruthy();
      expect(result.errorCount).toBeGreaterThanOrEqual(1);
    },
    15_000,
  );

  it('the same ban bites on the other three public surfaces (blog, methodology, not-found)', async () => {
    for (const surface of ['blog', 'methodology', 'not-found']) {
      const result = await lint(
        `apps/dashboard/src/app/pages/${surface}/QaProbe.tsx`,
        BANNED_IMPORT_FIXTURES['three'],
      );
      const hit = result.messages.find((m) => m.ruleId === 'no-restricted-imports');
      expect(hit, `no-restricted-imports did not fire on pages/${surface}/**`).toBeTruthy();
    }
  }, 15_000);

  it('MUTATION GUARD (negative control): the SAME import is clean outside the four public-surface folders', async () => {
    const result = await lint(
      'apps/dashboard/src/app/pages/ticker/QaProbe.tsx',
      BANNED_IMPORT_FIXTURES['three'],
    );
    const hit = result.messages.find((m) => m.ruleId === 'no-restricted-imports');
    expect(hit, 'the ban must be SCOPED to the public surfaces, not global').toBeUndefined();
  }, 15_000);

  it('MUTATION GUARD (negative control): an unrelated, allowed import on a landing file stays clean', async () => {
    const result = await lint(
      'apps/dashboard/src/app/pages/landing/QaProbe.tsx',
      `import Box from '@mui/material/Box';\nexport const x = Box;\n`,
    );
    expect(result.errorCount).toBe(0);
  }, 15_000);

  it('the four pre-existing deny-list bans (SPEC §2.1) still bite on pages/landing/** — the new ban did not silently replace them', async () => {
    const result = await lint(
      'apps/dashboard/src/app/pages/landing/QaProbe.tsx',
      `import { getScan } from '@convexa/api';\nexport const x = getScan;\n`,
    );
    const hit = result.messages.find((m) => m.ruleId === 'no-restricted-imports');
    expect(hit?.message).toMatch(/zero-edge tree/);
  }, 15_000);
});

describe('GATE Z I-4 (§7 item 3, "no new dependency") — package.json', () => {
  const BANNED_PACKAGES = ['three', '@react-three/fiber', '@react-three/drei', 'regl', 'pixi.js'];

  it('none of three/@react-three/*/regl/pixi.js is a declared dependency', () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]);
    for (const banned of BANNED_PACKAGES) {
      expect(declared.has(banned), `${banned} must not be a dependency (SPEC §2.3)`).toBe(false);
    }
  });
});
