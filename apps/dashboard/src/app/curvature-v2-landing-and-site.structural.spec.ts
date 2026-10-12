/**
 * curvature-v2-landing-and-site — the methodology score table's provenance pin (PLAN.md F13;
 * SPEC.md §7 item 10, AC-M2).
 *
 * Homed OUTSIDE `pages/**` because it reads `libs/quant-engine/src/signals.rs` from disk, which a
 * `pages/**`-scoped spec could not reach. Reading a frozen crate's source is not importing it, and
 * the five score caps live in `libs/quant-engine`, not in the frozen `apps/api` — both stay at zero
 * diff (INTERFACE_CONTRACT.md: NO_BACKEND_CHANGE).
 *
 * Arm B — the public score table's five caps (40 / 25 / 25 / 10 / 6) are pinned to the engine
 * constants by line, so a cap that changes or moves makes the public table's claim fail here.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { METHOD_COPY, type MethodBlock } from '@/pages/methodology/copy';

function workspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'nx.json'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('nx workspace root not found from ' + process.cwd());
}
const ROOT = workspaceRoot();

const SIGNALS_RS_PATH = resolve(ROOT, 'libs', 'quant-engine', 'src', 'signals.rs');

const SIGNALS_RS = readFileSync(SIGNALS_RS_PATH, 'utf8');

/** 1-indexed line `lineNo` of `src` contains `needle`. */
function lineContains(src: string, lineNo: number, needle: string): boolean {
  const lines = src.split('\n');
  return (lines[lineNo - 1] ?? '').includes(needle);
}

// ---------------------------------------------------------------------------
// Arm B — engine constants: the score table's five caps (AC-M2, §7 item 10)
// ---------------------------------------------------------------------------

describe("Arm B · the score table's five caps are pinned to libs/quant-engine/src/signals.rs (AC-M2, §7 item 10)", () => {
  it('DARK_POOL_BONUS_CAP: i32 = 6 at :24, applied at :541', () => {
    expect(lineContains(SIGNALS_RS, 24, 'DARK_POOL_BONUS_CAP: i32 = 6')).toBe(true);
    expect(lineContains(SIGNALS_RS, 541, 'DARK_POOL_BONUS_CAP')).toBe(true);
  });

  it('proximity cap 40 at :482, vol-stretch cap 25 at :487, active-setups cap 25 at :488, flip-transition 10 at :489', () => {
    expect(lineContains(SIGNALS_RS, 482, '40.0')).toBe(true);
    expect(lineContains(SIGNALS_RS, 487, '.min(25.0)')).toBe(true);
    expect(lineContains(SIGNALS_RS, 488, '.min(25.0)')).toBe(true);
    expect(lineContains(SIGNALS_RS, 489, '10.0')).toBe(true);
  });

  it('the score table’s Max column matches 40 / 25 / 25 / 10 / 6, in the design source’s row order', () => {
    const [table] = METHOD_COPY.sections
      .find((s) => s.id === 'score-and-tier')!
      .blocks.filter((b): b is Extract<MethodBlock, { kind: 'table' }> => b.kind === 'table');
    expect(table.rows.map((r) => r[1])).toEqual(['40', '25', '25', '10', '6']);
  });
});
