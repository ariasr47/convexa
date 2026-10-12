/** Task 5 source boundaries. Production inventory is recursive and intentionally mutation-tested. */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const featureDir = resolve(process.cwd(), 'src/app/pages/ticker/widgets/ai-rec');

const isExcluded = (file: string) =>
  /\.spec\.(?:ts|tsx)$|\.test\.(?:ts|tsx)$|(?:^|[\\/])(?:fixtures?|__fixtures__)(?:[\\/]|\.)/i.test(
    file,
  );
function productionFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return productionFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) && !isExcluded(path) ? [path] : [];
  });
}
const files = productionFiles(featureDir);
const entries = files.map((file) => [file, readFileSync(file, 'utf8')] as const);
// Comments may quote retired copy or dialog provenance; guards inspect executable/source text only.
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
const source = entries.map(([, text]) => stripComments(text)).join('\n');
const has = (re: RegExp, text = source) => re.test(text);
/** Detects a dialog component boundary, while deliberately permitting MUI Drawer/role=dialog. */
const dialogBoundary = (text: string): string[] => {
  const runtime = text
    .replace(/\bimport\s+type[\s\S]*?from\s+['"][^'"]+['"];?/g, '')
    .replace(/\btype\s+\w+/g, '');
  const matches: string[] = [];
  for (const match of runtime.matchAll(/\bimport\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const [, clause, module] = match;
    if (/\b\w*Dialog\b/.test(clause) || /(?:^|[\\/])\w*Dialog(?:\.[^\\/]*)?$/.test(module))
      matches.push(match[0]);
  }
  matches.push(
    ...[...runtime.matchAll(/\b(?:function|class|const)\s+\w*Dialog\b/g)].map((match) => match[0]),
  );
  matches.push(...[...runtime.matchAll(/<\s*\w*Dialog\b/g)].map((match) => match[0]));
  return matches;
};

describe('AI recommendation decision-card structural boundaries', () => {
  it('keeps static recommendation presentation isolated from live-stream state', () => {
    expect(files.length).toBeGreaterThan(3);
    expect(has(/\b(?:LiveUpdate|streamOffline|EventSource|SSE)\b/)).toBe(false);
  });

  it('does not import or define an alternate simulated-entry dialog', () => {
    expect(dialogBoundary(source)).toEqual([]);
  });

  it('the guards catch an omitted/new production module poison', () => {
    const poison = stripComments("export const poison = 'streamOffline';");
    expect(has(/\bstreamOffline\b/, poison)).toBe(true);
  });

  it('dialog guard is non-vacuous for common alternate entry names but permits MUI modal semantics', () => {
    for (const poison of [
      "import SimulatedOrderDialog from './SimulatedOrderDialog';",
      "import { PositionEntryDialog as Entry } from './entries';",
      '<AiRecEntryDialog open />',
    ])
      expect(dialogBoundary(poison).length).toBeGreaterThan(0);
    expect(dialogBoundary('<Drawer role="dialog" />')).toEqual([]);
    expect(dialogBoundary('type DialogCallback = () => void;')).toEqual([]);
    expect(
      dialogBoundary("import type { DialogCallback, AnalysisDialogState } from './types';"),
    ).toEqual([]);
    expect(dialogBoundary("import { type DialogCallback, Drawer } from './types';")).toEqual([]);
  });
});
