import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  authorityViolations,
  generatedComponentNames,
  isHandwrittenSource,
} from './contract-authority';

// The boundary's rules, applied here to libs/api/src. The dashboard's sources get the same rules in
// apps/dashboard/src/app/contract-authority.structural.spec.ts, under the dashboard's own test.
const GENERATED_COMPONENTS = generatedComponentNames(
  readFileSync(resolve(import.meta.dirname, '../generated/schema.ts'), 'utf8'),
);

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

describe('generated contract authority', () => {
  it('does not add a second ordinary HTTP transport', () => {
    const source = readFileSync(resolve(import.meta.dirname, 'convexa.ts'), 'utf8');
    const broker = readFileSync(resolve(import.meta.dirname, 'broker.ts'), 'utf8');
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(broker).not.toMatch(/\bfetch\s*\(/);
  });

  it('enforces the handwritten-wire boundary and rejects every poison mutation', () => {
    const workspace = resolve(import.meta.dirname, '../../../..');
    const handwritten = sourceFiles(resolve(workspace, 'libs/api/src'))
      .map((file) => relative(workspace, file).replaceAll('\\', '/'))
      .filter(isHandwrittenSource);
    expect(handwritten).toContain('libs/api/src/lib/convexa.ts');
    const baseline = handwritten.flatMap((file) =>
      authorityViolations(
        file,
        readFileSync(resolve(workspace, file), 'utf8'),
        GENERATED_COMPONENTS,
      ),
    );
    expect(baseline).toEqual([]);

    const check = (file: string, source: string) =>
      authorityViolations(file, source, GENERATED_COMPONENTS);
    const duplicate = check('lib/poison.ts', 'export interface LiveUpdateBody { mid: number }');
    const duplicateObject = check('lib/poison.ts', 'const LiveUpdateBody = { mid: 1 };');
    const deepImport = check(
      'apps/dashboard/src/poison.ts',
      "import type { paths } from '../../../libs/api/src/generated/schema';",
    );
    const uncheckedCast = check(
      'lib/poison.ts',
      "http.POST(\"/x\", { body: value as components['schemas']['LoginBody'] });",
    );
    expect(duplicate).toEqual(['lib/poison.ts: duplicate wire interface LiveUpdateBody']);
    expect(duplicateObject).toEqual(['lib/poison.ts: duplicate wire object LiveUpdateBody']);
    expect(deepImport).toEqual(['apps/dashboard/src/poison.ts: generated deep import']);
    expect(uncheckedCast).toEqual(['lib/poison.ts: unchecked generated HTTP body cast']);
  });
});
