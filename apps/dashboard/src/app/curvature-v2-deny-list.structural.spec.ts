/**
 * SPEC §2.1 — the four public-surface folders are barred from the transport. The ESLint rule is the
 * build-breaking half; this spec is the anti-vacuity half: it proves the rule EXISTS with the exact
 * specifier list, and that no shipped source under those folders already violates it.
 */
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
const ESLINT_CONFIG = readFileSync(resolve(ROOT, 'eslint.config.mjs'), 'utf8');

/** The specifiers the rule must name — alias AND relative form (the broker-option-grouping GATE Q
 *  finding: `patterns.group` entries are literal specifiers, not path-normalizing). */
const REQUIRED_SPECIFIERS = [
  '@convexa/api',
  '@/pages/*',
  '@/pages/*/**',
  '../*/**',
  '@/features/trading/*',
  '@/features/trading/*/**',
  '../../features/trading/*',
  '../../features/trading/*/**',
  '@/features/auth/AuthContext',
  '../../features/auth/AuthContext',
] as const;

const SURFACE_SOURCES = import.meta.glob(
  ['/src/app/pages/{landing,blog,methodology,not-found}/**/*.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

describe('SPEC §2.1 — the public-surface import deny-list', () => {
  it('the rule block names the four surface folders', () => {
    expect(ESLINT_CONFIG).toContain('pages/landing/**');
    expect(ESLINT_CONFIG).toContain('pages/blog/**');
    expect(ESLINT_CONFIG).toContain('pages/methodology/**');
    expect(ESLINT_CONFIG).toContain('pages/not-found/**');
  });

  it('every banned specifier — alias AND relative — is listed', () => {
    for (const s of REQUIRED_SPECIFIERS) {
      expect(ESLINT_CONFIG, `${s} missing from the deny-list`).toContain(`'${s}'`);
    }
  });

  it('the two ALLOWED auth modules are NOT banned (SPEC §2.1 — capability, not folder)', () => {
    expect(ESLINT_CONFIG).not.toContain("'@/features/auth/copy'");
    expect(ESLINT_CONFIG).not.toContain("'@/features/auth/AuthDialogProvider'");
    expect(ESLINT_CONFIG).not.toContain("'@/features/auth/*'");
  });

  it('the glob is not vacuous and no shipped surface source imports a banned specifier', () => {
    expect(Object.keys(SURFACE_SOURCES).length).toBeGreaterThanOrEqual(3);
    const violations = Object.entries(SURFACE_SOURCES).filter(([, src]) =>
      /from\s+['"](?:@convexa\/api|@\/pages\/|@\/features\/trading\/|@\/features\/auth\/AuthContext)/.test(
        src,
      ),
    );
    expect(violations.map(([f]) => f)).toEqual([]);
  });
});
