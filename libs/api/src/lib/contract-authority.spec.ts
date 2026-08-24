import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const GENERATED_COMPONENTS = new Set(
  [
    ...readFileSync(resolve(import.meta.dirname, '../generated/schema.ts'), 'utf8').matchAll(
      /^\s{4}([A-Za-z][A-Za-z0-9]*): \{/gm,
    ),
  ].map(([, name]) => name),
);

const FACADE_FILES = new Set([
  'libs/api/src/lib/client.ts',
  'libs/api/src/lib/convexa.ts',
  'libs/api/src/lib/broker.ts',
]);

function authorityViolations(repoRelative: string, source: string): string[] {
  const violations: string[] = [];
  if (
    !FACADE_FILES.has(repoRelative) &&
    /(?:from|import\s*\()\s*['"][^'"]*generated\/schema/.test(source)
  ) {
    violations.push(`${repoRelative}: generated deep import`);
  }
  for (const [, name] of source.matchAll(/^export interface (\w+)/gm)) {
    if (GENERATED_COMPONENTS.has(name))
      violations.push(`${repoRelative}: duplicate wire interface ${name}`);
  }
  for (const [, name] of source.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*\{/g)) {
    if (GENERATED_COMPONENTS.has(name))
      violations.push(`${repoRelative}: duplicate wire object ${name}`);
  }
  if (/body\s*:\s*[^\n]+\s+as\s+components\[/.test(source)) {
    violations.push(`${repoRelative}: unchecked generated HTTP body cast`);
  }
  return violations;
}

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : [];
  });
}

describe('generated contract authority', () => {
  it('keeps generated imports behind the shared facade', () => {
    const root = resolve(import.meta.dirname, '..');
    const files = ['lib/client.ts', 'lib/convexa.ts', 'lib/broker.ts'];
    for (const file of files) {
      const source = readFileSync(resolve(root, file), 'utf8');
      expect(source).not.toMatch(
        /from ['"][^'"]*apps\/api|from ['"][^'"]*generated\/schema\.ts['"]/,
      );
    }
    const index = readFileSync(resolve(root, 'index.ts'), 'utf8');
    expect(index).not.toContain('/generated/');
  });

  it('allows semantic facade classes and indexed generated component consumption', () => {
    const source = readFileSync(resolve(import.meta.dirname, 'convexa.ts'), 'utf8');
    expect(source).toContain("components['schemas']");
    expect(source).toContain('class ApiError');
    expect(source).toContain('class AuthError');
  });

  it('does not add a second ordinary HTTP transport', () => {
    const source = readFileSync(resolve(import.meta.dirname, 'convexa.ts'), 'utf8');
    const broker = readFileSync(resolve(import.meta.dirname, 'broker.ts'), 'utf8');
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(broker).not.toMatch(/\bfetch\s*\(/);
  });

  it('retains the native EventSource boundary for SSE lifecycle semantics', () => {
    const source = readFileSync(resolve(import.meta.dirname, 'convexa.ts'), 'utf8');
    expect(source).toContain('new EventSource');
    expect(source).toContain('new EventSource(`/api/stream/');
  });

  it('rejects parallel wire interfaces after indexed migration', () => {
    const source = readFileSync(resolve(import.meta.dirname, 'convexa.ts'), 'utf8');
    const migrated = [
      'IvSkew',
      'TermStructure',
      'DealerFlowProjection',
      'MarketState',
      'TickerBundle',
      'CandidateSetEnvelope',
      'TrackedContract',
      'BookEnvelope',
      'MetricsAggregate',
      'RecResponse',
      'RecExport',
      'RecStatus',
      'Signals',
      'PositionEval',
      'AiEval',
      'ScanResponse',
      'ScanView',
      'ScanRow',
      'ScanViewSort',
      'SweepHeartbeat',
    ];
    for (const name of migrated) {
      expect(source).not.toMatch(new RegExp(`export interface ${name}\\b`));
      expect(source).toMatch(new RegExp(`export type ${name} =`));
    }
    // PersonaDefinition is intentionally a FE semantic projection: the generated PersonaWire
    // supplies transport fields, while this facade adds presentation-only framing copy and the
    // parsed DTE preference used by the persona composer. It is not a second HTTP wire authority.
    expect(source).toContain('FE semantic persona projection');
  });

  it('keeps generated consumption centralized to the facade lanes', () => {
    const root = resolve(import.meta.dirname, '..');
    const sourceFiles = ['lib/client.ts', 'lib/convexa.ts', 'lib/broker.ts'];
    for (const file of sourceFiles) {
      const source = readFileSync(resolve(root, file), 'utf8');
      expect(
        source.match(/from ['"][^'"]*generated\/schema['"]/g)?.length ?? 0,
      ).toBeLessThanOrEqual(1);
    }
  });

  it('enforces the handwritten-wire boundary and rejects every poison mutation', () => {
    const workspace = resolve(import.meta.dirname, '../../../..');
    const generated = resolve(workspace, 'libs/api/src/generated');
    const handwritten = [
      ...sourceFiles(resolve(workspace, 'libs/api/src')),
      ...sourceFiles(resolve(workspace, 'apps/dashboard/src')),
    ]
      .filter((file) => !file.includes(generated) && !/\.(spec|test)\.(ts|tsx)$/.test(file))
      .map(
        (file) =>
          [relative(workspace, file).replaceAll('\\', '/'), readFileSync(file, 'utf8')] as const,
      );
    const baseline = handwritten.flatMap(([file, source]) => authorityViolations(file, source));
    expect(baseline).toEqual([]);

    const duplicate = authorityViolations(
      'lib/poison.ts',
      'export interface LiveUpdateBody { mid: number }',
    );
    const duplicateObject = authorityViolations(
      'lib/poison.ts',
      'const LiveUpdateBody = { mid: 1 };',
    );
    const deepImport = authorityViolations(
      'apps/dashboard/src/poison.ts',
      "import type { paths } from '../../../libs/api/src/generated/schema';",
    );
    const uncheckedCast = authorityViolations(
      'lib/poison.ts',
      "http.POST(\"/x\", { body: value as components['schemas']['LoginBody'] });",
    );
    expect(duplicate).toEqual(['lib/poison.ts: duplicate wire interface LiveUpdateBody']);
    expect(duplicateObject).toEqual(['lib/poison.ts: duplicate wire object LiveUpdateBody']);
    expect(deepImport).toEqual(['apps/dashboard/src/poison.ts: generated deep import']);
    expect(uncheckedCast).toEqual(['lib/poison.ts: unchecked generated HTTP body cast']);
  });
});
