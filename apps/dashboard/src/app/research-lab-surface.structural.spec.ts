/**
 * research-lab-surface structural enforcement — operator folder allowlist + trader silence.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isOperatorSessionArchiveSource } from '../testing/operatorSessionArchiveAllowlist';

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
  it('glob sees the operator folder', () => {
    expect(existsSync(ARCHIVE_DIR)).toBe(true);
    const keys = Object.keys(DASHBOARD_SOURCES).filter((k) => isOperatorSessionArchiveSource(k));
    expect(keys.length).toBeGreaterThan(0);
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
});
