/**
 * exchange-holiday-calendar structural — no new surfaces, Pages 404, /lab demos, TopNav silence,
 * no /api/holidays product path, replica wired into scanner format only (not ticker).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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

describe('exchange-holiday-calendar structural', () => {
  it('Pages Function 404 for /api/_research unchanged', () => {
    const src = readFileSync(PAGES_FN, 'utf8');
    expect(src).toMatch(/pathname\s*===\s*['"]\/api\/_research['"]/);
    expect(src).toMatch(/pathname\.startsWith\(\s*['"]\/api\/_research\/['"]\s*\)/);
  });

  it('TopNav has no operator / holiday / coverage / tape / keep href', () => {
    const navKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/shell/TopNav.tsx'));
    expect(navKey).toBeTruthy();
    const navSrc = DASHBOARD_SOURCES[navKey as string];
    expect(navSrc).not.toMatch(/to:\s*['"]\/_ops\/research['"]/);
    expect(navSrc).not.toMatch(/to:\s*['"]\/_ops\/metrics['"]/);
    expect(navSrc.toLowerCase()).not.toMatch(/to:\s*['"][^'"]*holiday/);
    expect(navSrc.toLowerCase()).not.toMatch(/to:\s*['"][^'"]*coverage/);
    expect(navSrc.toLowerCase()).not.toMatch(/to:\s*['"][^'"]*tape/);
    expect(navSrc.toLowerCase()).not.toMatch(/to:\s*['"][^'"]*keep/);
  });

  it('/lab still mounts LabIndex demos; lab-index testid present', () => {
    const appKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/app.tsx'));
    expect(appKey).toBeTruthy();
    const appSrc = DASHBOARD_SOURCES[appKey as string];
    expect(appSrc).toMatch(/path=["']\/lab["']/);
    expect(appSrc).toMatch(/LabIndex/);

    const labKey = Object.keys(DASHBOARD_SOURCES).find((k) =>
      k.endsWith('/pages/lab/LabIndex.tsx'),
    );
    expect(labKey).toBeTruthy();
    const labSrc = DASHBOARD_SOURCES[labKey as string];
    expect(labSrc).toContain('data-testid="lab-index"');
    expect(labSrc.toLowerCase()).not.toMatch(/ineligible holiday|archive-coverage|nyse.?full.?day/);
  });

  it('no product string /api/holidays in dashboard src', () => {
    const offenders: string[] = [];
    for (const [path, src] of Object.entries(DASHBOARD_SOURCES)) {
      if (src.includes("'/api/holidays'") || src.includes('"/api/holidays"')) {
        offenders.push(path);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('replica is imported from scanner format.ts and not from TickerHeader', () => {
    const formatKey = Object.keys(DASHBOARD_SOURCES).find((k) =>
      k.endsWith('/pages/scanner/format.ts'),
    );
    expect(formatKey).toBeTruthy();
    expect(DASHBOARD_SOURCES[formatKey as string]).toMatch(/nyseFullDayHolidays/);

    const headerKey = Object.keys(DASHBOARD_SOURCES).find((k) =>
      k.endsWith('/widgets/chrome/TickerHeader.tsx'),
    );
    expect(headerKey).toBeTruthy();
    expect(DASHBOARD_SOURCES[headerKey as string]).not.toMatch(/nyseFullDayHolidays/);
  });

  it('anti-vacuity — dashboard sources glob is non-empty', () => {
    expect(Object.keys(DASHBOARD_SOURCES).length).toBeGreaterThan(20);
  });
});
