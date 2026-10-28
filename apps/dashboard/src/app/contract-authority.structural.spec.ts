/**
 * The handwritten-wire boundary, applied to the dashboard's sources: no deep import of the generated
 * schema, no second copy of a generated wire type or object, and no unchecked cast of an HTTP body
 * to a generated type. The rules live in libs/api/src/lib/contract-authority.ts; libs/api's own
 * spec applies them to libs/api/src.
 *
 * This half runs under the dashboard's test, so its cache key and `npm run verify` follow the files
 * it reads: the dashboard sources (its own project) and the generated schema and rules (libs/api,
 * through ^production). As an @convexa/api test, it put @convexa/api in Nx's affected set for every
 * dashboard edit, and @convexa/api's test and typecheck run the uncached api:api-contract-check
 * (a cargo run), in verify and in the pre-push hook alike.
 */
import {
  authorityViolations,
  generatedComponentNames,
  isHandwrittenSource,
} from '@convexa/api/contract-authority';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
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

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

describe('generated contract authority: dashboard sources', () => {
  it('no dashboard source crosses the handwritten-wire boundary', () => {
    const generated = generatedComponentNames(
      readFileSync(resolve(ROOT, 'libs/api/src/generated/schema.ts'), 'utf8'),
    );
    const sources = files(resolve(ROOT, 'apps/dashboard/src'))
      .map((file) => relative(ROOT, file).replaceAll('\\', '/'))
      .filter(isHandwrittenSource);
    expect(generated.has('LiveUpdateBody')).toBe(true);
    expect(sources).toContain('apps/dashboard/src/main.tsx');
    const violations = sources.flatMap((file) =>
      authorityViolations(file, readFileSync(resolve(ROOT, file), 'utf8'), generated),
    );
    expect(violations).toEqual([]);
  });
});
