/**
 * day-replay-mock-adapter — structural absence (AC-37).
 * No `/_ops/replay`, no ticker player chrome, OperatorMetrics STAGES unchanged.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STAGES } from './pages/operator-metrics/useLatencyTrend';

const APP_ROOT = join(__dirname);

function walkSources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'out-tsc') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      walkSources(p, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    if (/\.spec\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) continue;
    out.push(p);
  }
  return out;
}

describe('day-replay-mock-adapter · structural absence', () => {
  it('trader product sources have no /_ops/replay and no player chrome', () => {
    const files = walkSources(APP_ROOT);
    const hits: string[] = [];
    const FORBIDDEN = ['/_ops/replay', 'replay Start', 'in-page date picker'] as const;
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const token of FORBIDDEN) {
        if (src.includes(token)) {
          hits.push(`${relative(APP_ROOT, file)}: ${token}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('app.tsx routes have no /_ops/replay', () => {
    const app = readFileSync(join(APP_ROOT, 'app.tsx'), 'utf8');
    expect(app).not.toContain('/_ops/replay');
    expect(app).toContain('/_ops/metrics');
  });

  it('OperatorMetrics STAGES set-equality unchanged', () => {
    expect([...STAGES].sort()).toEqual(
      [
        'vendor_fetch',
        'engine_build',
        'off_exchange',
        'signals',
        'persist',
        'serialize_wrap',
      ].sort(),
    );
  });

  it('session-tape standing forces pulse false (no liveDotPulse while armed)', () => {
    // Product helper: sessionTapeChip always returns pulse: false.
    const src = readFileSync(join(APP_ROOT, 'pages/ticker/sessionTapeStanding.ts'), 'utf8');
    expect(src).toMatch(/pulse:\s*false/);
    expect(src).not.toMatch(/pulse:\s*true/);
  });
});
