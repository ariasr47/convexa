/**
 * redesign-stage-1 §8-9 — warning-always-has-icon, the STRUCTURAL half of the §3b rule:
 * warnings are burnt orange AND always pair with a non-color signifier — hue alone never
 * carries "warning". MUI's warning Alert ships its icon built-in, so the structural rule is:
 * no `severity="warning"` Alert anywhere under src/app may set `icon={false}`.
 * (The non-Alert warning sites' glyphs — ⚠/⏸ chips, captions — are review row 14.)
 * MUTATION-GUARDED per the house rule.
 */
import { describe, expect, it } from 'vitest';

const APP_SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** End index of the JSX opening tag starting at `start` ('>' that is not part of '=>'). */
function tagEnd(src: string, start: number): number {
  for (let i = start; i < src.length; i++) {
    if (src[i] === '>' && src[i - 1] !== '=') return i;
  }
  return src.length;
}

/** Pure checker (mutation-tested): warning Alerts that suppress their icon. */
function warningAlertsWithoutIcon(files: Record<string, string>): string[] {
  const violations: string[] = [];
  for (const [file, src] of Object.entries(files)) {
    let idx = src.indexOf('<Alert');
    while (idx !== -1) {
      const tag = src.slice(idx, tagEnd(src, idx) + 1).replace(/\s+/g, ' ');
      if (tag.includes('severity="warning"') && tag.includes('icon={false}')) {
        violations.push(`${file} @ ${idx}`);
      }
      idx = src.indexOf('<Alert', idx + 1);
    }
  }
  return violations;
}

describe('§8-9 · a warning Alert never suppresses its icon', () => {
  it('the glob is not vacuous and actually contains warning Alerts to guard', () => {
    expect(Object.keys(APP_SOURCES).length).toBeGreaterThan(40);
    const warningAlertCount = Object.values(APP_SOURCES).filter((s) =>
      s.includes('severity="warning"'),
    ).length;
    expect(warningAlertCount).toBeGreaterThanOrEqual(5); // the §3b icon-rule inventory exists
  });

  it('MUTATION GUARD: the checker fails on a warning Alert with icon={false} (attributes in either order, multiline too)', () => {
    expect(
      warningAlertsWithoutIcon({ 'bad.tsx': `<Alert severity="warning" icon={false}>x</Alert>` }),
    ).toHaveLength(1);
    expect(
      warningAlertsWithoutIcon({
        'bad2.tsx': `<Alert icon={false}\n  severity="warning"\n>x</Alert>`,
      }),
    ).toHaveLength(1);
    expect(
      warningAlertsWithoutIcon({
        'ok.tsx': `<Alert severity="warning" sx={(t) => ({ color: t.palette.warning.main })}>x</Alert>`,
      }),
    ).toEqual([]);
    expect(
      warningAlertsWithoutIcon({ 'ok2.tsx': `<Alert severity="info" icon={false}>x</Alert>` }),
    ).toEqual([]);
  });

  it('no warning Alert under src/app sets icon={false}', () => {
    expect(warningAlertsWithoutIcon(APP_SOURCES)).toEqual([]);
  });
});
