/**
 * research-lab-surface structural enforcement — operator folder allowlist + trader silence.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  folderNameAvoidsPathScanNeedles,
  isOperatorSessionArchiveSource,
} from '../testing/operatorSessionArchiveAllowlist';

const DASHBOARD_SOURCES = import.meta.glob(
  ['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}', '!**/*.test.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

function workspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'nx.json'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('nx workspace root not found from ' + process.cwd());
}

const ROOT = workspaceRoot();
const PAGES_FN = resolve(ROOT, 'functions', 'api', '[[path]].ts');
const CONVEXA_CLIENT = resolve(ROOT, 'libs', 'api', 'src', 'lib', 'convexa.ts');
const ARCHIVE_DIR = resolve(
  ROOT,
  'apps',
  'dashboard',
  'src',
  'app',
  'pages',
  'operator-session-archive',
);

const OPERATOR_POISON = [
  'getTicker',
  'streamTicker',
  'fetchMetrics',
  'operator-metrics',
  "from '@/pages/operator-metrics",
  "from '@/pages/lab",
  "fetch('/api/_research",
  'fetch("/api/_research',
  'VITE_',
  'up.railway.app',
  'sessionStorage',
  'localStorage',
  '@keyframes',
] as const;

describe('research-lab-surface structural', () => {
  it('Pages Function 404 for /api/_research unchanged', () => {
    const src = readFileSync(PAGES_FN, 'utf8');
    expect(src).toMatch(/pathname\s*===\s*['"]\/api\/_research['"]/);
    expect(src).toMatch(/pathname\.startsWith\(\s*['"]\/api\/_research\/['"]\s*\)/);
  });

  it('TopNav has no /_ops/research to: href', () => {
    const navKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/shell/TopNav.tsx'));
    expect(navKey).toBeTruthy();
    const navSrc = DASHBOARD_SOURCES[navKey as string];
    expect(navSrc).not.toMatch(/to:\s*['"]\/_ops\/research['"]/);
    expect(navSrc).not.toMatch(/to:\s*['"]\/_ops\/metrics['"]/);
  });

  it('/lab still lab-index in app routes', () => {
    const appKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/app.tsx'));
    expect(appKey).toBeTruthy();
    const appSrc = DASHBOARD_SOURCES[appKey as string];
    expect(appSrc).toMatch(/path=["']\/lab["']/);
    expect(appSrc).toMatch(/LabIndex/);
    expect(appSrc).toMatch(/path=["']\/_ops\/research["']/);
    expect(appSrc).toMatch(/OperatorSessionArchive/);
  });

  it('convexa.ts has no research helper', () => {
    const src = readFileSync(CONVEXA_CLIENT, 'utf8');
    expect(src).not.toContain('/api/_research');
    expect(src).not.toContain('session-books');
  });

  it('glob sees the operator folder; folder name avoids path-scan needles', () => {
    expect(existsSync(ARCHIVE_DIR)).toBe(true);
    expect(folderNameAvoidsPathScanNeedles('operator-session-archive')).toBe(true);
    const keys = Object.keys(DASHBOARD_SOURCES).filter((k) =>
      isOperatorSessionArchiveSource(k),
    );
    expect(keys.length).toBeGreaterThan(0);
  });

  it('allowlist skip is not vacuous — trader TopNav is still scanned', () => {
    const navKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/shell/TopNav.tsx'));
    expect(navKey).toBeTruthy();
    expect(isOperatorSessionArchiveSource(navKey as string)).toBe(false);
  });

  it('operator folder refuses trader imports / relative research fetch / storage / keyframes', () => {
    const offenders: string[] = [];
    for (const [path, src] of Object.entries(DASHBOARD_SOURCES)) {
      if (!isOperatorSessionArchiveSource(path)) continue;
      for (const n of OPERATOR_POISON) {
        if (src.includes(n)) offenders.push(`${path} → ${n}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('researchClient uses credentials omit and absolute URLs', () => {
    const clientKey = Object.keys(DASHBOARD_SOURCES).find((k) =>
      k.endsWith('/operator-session-archive/researchClient.ts'),
    );
    expect(clientKey).toBeTruthy();
    const src = DASHBOARD_SOURCES[clientKey as string];
    expect(src).toContain("credentials: 'omit'");
    expect(src).not.toMatch(/fetch\(\s*['"]\/api\/_research/);
  });

  it('mutation — poisoning allowlisted folder with getTicker would fail the scan', () => {
    const poison = "import { getTicker } from '@/shared/lib/http';";
    expect(OPERATOR_POISON.some((n) => poison.includes(n))).toBe(true);
  });

  it('anti-vacuity — operator folder sources exist on disk', () => {
    const files = readdirSync(ARCHIVE_DIR).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
    expect(files.length).toBeGreaterThan(5);
  });
});
