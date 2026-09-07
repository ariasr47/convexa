/**
 * curvature-v2-surfaces criterion 29 (SB) — "no `⏸` survives in any positions source string." This
 * scan is the ENFORCEMENT MECHANISM for that criterion (PLAN FE-5, Mutation Proof H) and is a new
 * deliverable of this task, not inherited from `shared/theme/fonts.spec.ts` — that file's scan
 * targets font-family bindings and closed-nine members, never this glyph.
 *
 * Scope, per SPEC §1/§3 C: the positions surface is the sim book (`features/trading/positions/**`),
 * the Broker tab (`features/trading/broker/**`) and the header readout (`pages/positions/**`).
 * `features/trading/orders/**` is OUT — `OrderRow.tsx:172` is Z-1, ruled carried debt at GATE PLAN,
 * because the same component mounts on the ticker desk and D-C forbids reopening it for this change.
 *
 * A glyph inside a CODE COMMENT does not offend — several doc-comments in this tree still narrate the
 * old treatment ("shows no ⏸") as history, and rewriting every prose mention is not what criterion 29
 * asks for. What must never survive is the glyph inside a RENDERED STRING: a quoted literal, a
 * template literal, or bare JSX text between tags.
 */
import { describe, expect, it } from 'vitest';

const GLYPH = '⏸';

/** A glyph inside a rendered string — quoted literal, backtick template, or bare JSX text — never a
 *  comment. Pure and mutation-tested on its own (§2.3: "each needle ships its own poison"). */
export function carriesGlyph(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.startsWith('*') || trimmed.startsWith('//')) return false;
  return (
    /'[^']*⏸[^']*'/.test(line) ||
    /"[^"]*⏸[^"]*"/.test(line) ||
    /`[^`]*⏸[^`]*`/.test(line) ||
    />[^<{]*⏸[^<}]*</.test(line)
  );
}

/** Windowless — the glyph's own line is either an offending render or it is not; unlike the fonts
 *  scan's needle 1, there is no adjacent-line ambiguity to resolve. Returns `line:excerpt`. */
export function pauseGlyphSites(src: string): string[] {
  const hits: string[] = [];
  src.split('\n').forEach((line, i) => {
    if (line.includes(GLYPH) && carriesGlyph(line)) hits.push(`${i + 1}:${line.trim()}`);
  });
  return hits;
}

const PAUSE_SOURCES = import.meta.glob(
  [
    '/src/app/features/trading/{positions,broker}/**/*.{ts,tsx}',
    '/src/app/pages/positions/**/*.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/**
 * EXEMPT — Broker's two sites, live-checked (both arms: the file must still exist AND still
 * violate). FE-7 removes both when it converts the Broker tab's figures (PLAN FE-7 step 1); a stale
 * entry here would red-build, exactly like `fonts.spec.ts`'s idiom.
 */
const EXEMPT: Record<string, string> = {
  'features/trading/broker/BrokerGroupHeader.tsx': 'FE-7 — Broker tab register conversion',
  'features/trading/broker/BrokerPositionRow.tsx': 'FE-7 — Broker tab register conversion',
};
const isExempt = (key: string) => Object.keys(EXEMPT).some((rel) => key === `/src/app/${rel}`);

describe('criterion 29 · the pause mark is the stroke icon, never a text character', () => {
  it('the scan is not vacuous (both positions and broker trees loaded)', () => {
    const keys = Object.keys(PAUSE_SOURCES);
    expect(keys.length).toBeGreaterThan(5);
    expect(keys.some((f) => f.startsWith('/src/app/features/trading/positions/'))).toBe(true);
    expect(keys.some((f) => f.startsWith('/src/app/features/trading/broker/'))).toBe(true);
    expect(keys.some((f) => f.startsWith('/src/app/pages/positions/'))).toBe(true);
    // orders/ is deliberately OUT of this glob (Z-1) — assert the exclusion is real, not accidental.
    expect(keys.some((f) => f.includes('/features/trading/orders/'))).toBe(false);
  });

  it('MUTATION GUARD (its own): a rendered glyph is caught; the same glyph in a comment is not', () => {
    expect(pauseGlyphSites("const OFFLINE = '⏸ offline';")).not.toEqual([]);
    expect(pauseGlyphSites('<span>⏸</span>')).not.toEqual([]);
    expect(pauseGlyphSites("{streamOffline ? '⏸' : DASH}")).not.toEqual([]);
    // prose cannot offend — several doc-comments narrate the old treatment as history.
    expect(pauseGlyphSites('// faulted dims nothing and shows no ⏸')).toEqual([]);
    expect(pauseGlyphSites(' * live cells dim + show `⏸ offline` on an SSE drop')).toEqual([]);
    // no glyph at all is clean, so the needle is not simply always-true.
    expect(pauseGlyphSites("const OFFLINE = 'offline';")).toEqual([]);
  });

  it('every EXEMPT entry still exists AND still violates (no stale exemption widens the fence)', () => {
    for (const [rel, owner] of Object.entries(EXEMPT)) {
      const src = PAUSE_SOURCES[`/src/app/${rel}`];
      expect(src, `EXEMPT entry ${rel} must still exist (${owner})`).toBeTruthy();
      expect(
        pauseGlyphSites(src).length > 0,
        `EXEMPT entry ${rel} no longer violates — DELETE the entry (${owner})`,
      ).toBe(true);
      expect(owner, `EXEMPT entry ${rel} must name the task that removes it`).toMatch(/FE-\d+/);
    }
  });

  it('no non-exempt source renders the `⏸` text character anywhere on the positions/broker surface', () => {
    const offenders = Object.entries(PAUSE_SOURCES)
      .filter(([file]) => !isExempt(file))
      .flatMap(([file, src]) => {
        const sites = pauseGlyphSites(src);
        return sites.length ? [`${file} → ${sites.join(', ')}`] : [];
      });
    expect(offenders, `criterion-29 violation:\n${offenders.join('\n')}`).toEqual([]);
  });
});
