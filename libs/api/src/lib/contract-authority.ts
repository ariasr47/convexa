// The handwritten-wire boundary: code outside the client facade reaches the API through
// `@convexa/api`, never through the generated schema, and declares no second copy of a generated
// wire type. Two specs apply these rules, each to its own project's sources, so each test's Nx cache
// key covers every file it reads:
//   libs/api/src/lib/contract-authority.spec.ts            libs/api/src
//   apps/dashboard/src/app/contract-authority.structural.spec.ts   apps/dashboard/src
// Test support only. No runtime code imports this module; the dashboard spec imports it as
// `@convexa/api/contract-authority` (libs/api/package.json exports).

/** The client facade: the only handwritten files that may import the generated schema. */
export const FACADE_FILES: ReadonlySet<string> = new Set([
  'libs/api/src/lib/client.ts',
  'libs/api/src/lib/convexa.ts',
  'libs/api/src/lib/broker.ts',
]);

/** The names libs/api/src/generated/schema.ts declares as objects at its second level. */
export function generatedComponentNames(schema: string): ReadonlySet<string> {
  return new Set(
    [...schema.matchAll(/^\s{4}([A-Za-z][A-Za-z0-9]*): \{/gm)].map(([, name]) => name),
  );
}

/** A source the boundary applies to: .ts or .tsx, not a declaration, spec, test or generated file. */
export function isHandwrittenSource(repoRelative: string): boolean {
  return (
    /\.(ts|tsx)$/.test(repoRelative) &&
    !repoRelative.endsWith('.d.ts') &&
    !/\.(spec|test)\.(ts|tsx)$/.test(repoRelative) &&
    !repoRelative.startsWith('libs/api/src/generated/')
  );
}

/** Each way `source`, at the workspace-relative path `repoRelative`, crosses the boundary. */
export function authorityViolations(
  repoRelative: string,
  source: string,
  generated: ReadonlySet<string>,
): string[] {
  const violations: string[] = [];
  if (
    !FACADE_FILES.has(repoRelative) &&
    /(?:from|import\s*\()\s*['"][^'"]*generated\/schema/.test(source)
  ) {
    violations.push(`${repoRelative}: generated deep import`);
  }
  for (const [, name] of source.matchAll(/^export interface (\w+)/gm)) {
    if (generated.has(name)) violations.push(`${repoRelative}: duplicate wire interface ${name}`);
  }
  for (const [, name] of source.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*\{/g)) {
    if (generated.has(name)) violations.push(`${repoRelative}: duplicate wire object ${name}`);
  }
  if (/body\s*:\s*[^\n]+\s+as\s+components\[/.test(source)) {
    violations.push(`${repoRelative}: unchecked generated HTTP body cast`);
  }
  return violations;
}
