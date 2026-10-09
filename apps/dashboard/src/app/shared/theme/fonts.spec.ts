import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------------------------
// criterion N-1 (curvature-v2-surfaces SPEC §2.3, FE-1 step 6) — ONE register decision, enforced
// as negative space over three trees. TWO needles, each with its OWN poison.
//
// WHY EACH NEEDLE HAS ITS OWN GUARD. A scan whose poison proof lives in a different scan is the
// vacuous mutation proof `[structural-over-prose-enforcement]` exists to catch, so each needle here
// ships its own red-going guard against its own planted fixtures.
//
// ENFORCING FROM THE FIRST COMMIT, behind a live-checked `EXEMPT` map. The fourteen files that
// bind a face locally today are named below WITH the task that removes each one; FE-14 asserts the
// map empty. The live check means a stale exemption cannot quietly widen the fence: an entry whose
// file has vanished, or which no longer violates either needle, red-builds.
// ---------------------------------------------------------------------------------------------

/** Criterion N-1's three trees. Sources only — a spec may of course name a face in a fixture. */
const N1_SOURCES = import.meta.glob(
  [
    '/src/app/features/trading/**/*.{ts,tsx}',
    '/src/app/pages/positions/**/*.{ts,tsx}',
    '/src/app/pages/scanner/**/*.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** The closed nine (`shared/copy/notANumber.ts:26-36`), inlined so the scan is a pure text check. */
const NINE = [
  '—',
  'unavailable',
  'not given',
  'not set',
  'size not suggested',
  'unrecognized',
  'not recorded',
  'no basis',
  'not provided',
];

/**
 * NEEDLE 1 — a mono-bound line. Detected by NAME rather than by binding syntax: PLAN's illustrative
 * `/\.\.\.\s*MONO\b|MONO_FACE|monoFontFamily|fontFamily\s*:\s*MONO\b/` cannot match its own required
 * fixture (`<Box sx={MONO}>` carries neither a spread nor a `fontFamily:` prefix), and `sx={MONO}`
 * is exactly how the shipped atoms bind it. This form is a strict SUPERSET of all four listed
 * shapes — `...MONO`, `MONO_FACE`, `monoFontFamily`, `fontFamily: MONO` — plus the two local
 * spellings the tree actually carries (`monoSx`, `sx={MONO}`).
 */
const MONO_BOUND = /\bMONO(_FACE)?\b|\bmonoSx\b|\bmonoFontFamily\b/;

/** A closed-nine member as a rendered value: a quoted literal or a bare JSX text node. */
const carriesMember = (line: string, member: string): boolean =>
  line.includes(`'${member}'`) ||
  line.includes(`"${member}"`) ||
  line.includes(`\`${member}\``) ||
  line.includes(`>${member}<`);

/**
 * Needle 1, windowed: a closed-nine member rendered inside a mono-bound run. The window is
 * −6/+12 lines around the mono binding — a `const MONO = {…}` sits above its uses, an `sx` spread
 * sits above the value it wraps. Returns `line:member` so a red names the site, not just the file.
 */
export function memberInMonoRun(src: string): string[] {
  const lines = src.split('\n');
  const hits = new Set<string>();
  lines.forEach((line, i) => {
    if (!MONO_BOUND.test(line)) return;
    const from = Math.max(0, i - 6);
    const to = Math.min(lines.length - 1, i + 12);
    for (let j = from; j <= to; j++) {
      for (const member of NINE) {
        if (carriesMember(lines[j], member)) hits.add(`${j + 1}:${member}`);
      }
    }
  });
  return [...hits];
}

/** NEEDLE 2 — a face literal, or a face binding, outside the two homes. */
const FACE_LITERAL = /fontFamily\s*:\s*['"`]/;
const FACE_BINDING = /typographyTokens\s*\.\s*(mono|display)?[Ff]ontFamily|\bfontFamily\s*:/;

/**
 * The two homes are `shared/theme/tokens.ts` (the tokens) and `shared/figure/` (the one binding);
 * neither is inside this scan's three trees, so no allowlist is needed — a source in scope may not
 * name a font family AT ALL. It spreads `...faceFor(mono)` / `...MONO_FACE` instead, which is why
 * the third fixture below must read clean.
 */
export const bindsFaceLocally = (src: string): boolean =>
  FACE_LITERAL.test(src) || FACE_BINDING.test(src);

/**
 * EXEMPT — the fourteen files that bind a face locally today, each with the task that removes it.
 * Measured at FE-1 (the site list is in the build report). Live-checked below on BOTH arms: the
 * file must still exist in the scan, and it must still violate. FE-14 asserts this map is empty.
 */
const EXEMPT: Record<string, string> = {};

const isExempt = (key: string) => Object.keys(EXEMPT).some((rel) => key === `/src/app/${rel}`);

describe('N-1 · one register decision — no closed-nine member in a mono run, no local face binding', () => {
  it('the scan is not vacuous (all three trees actually loaded)', () => {
    const keys = Object.keys(N1_SOURCES);
    expect(keys.length).toBeGreaterThan(10);
    expect(keys.some((f) => f.startsWith('/src/app/pages/scanner/'))).toBe(true);
    expect(keys.some((f) => f.startsWith('/src/app/features/trading/positions/'))).toBe(true);
    expect(keys.some((f) => f.startsWith('/src/app/pages/positions/'))).toBe(true);
  });

  it('MUTATION GUARD, NEEDLE 1 (its own): a member inside a mono run is caught; the same markup in Sans is not', () => {
    expect(
      memberInMonoRun("const MONO={fontFamily:x};\n<Box sx={MONO}>{'not recorded'}</Box>"),
    ).not.toEqual([]);
    expect(
      memberInMonoRun("const SANS={fontFamily:x};\n<Box sx={SANS}>{'not recorded'}</Box>"),
    ).toEqual([]);
    // it reports WHERE, and it reads a bare JSX text node as well as a quoted literal
    expect(memberInMonoRun('<Box sx={{ ...MONO }}>—</Box>')).toEqual(['1:—']);
    // …and a mono run with no member in it is clean, so the needle is not simply always-true
    expect(memberInMonoRun('<Box sx={{ ...MONO }}>{price}</Box>')).toEqual([]);
  });

  it('MUTATION GUARD, NEEDLE 2 (its own): a face literal and a face binding are caught; the module route is not', () => {
    expect(bindsFaceLocally(`fontFamily: 'IBM Plex Mono'`)).toBe(true);
    expect(bindsFaceLocally('fontFamily: typographyTokens.monoFontFamily')).toBe(true);
    expect(bindsFaceLocally('const monoSx = typographyTokens.monoFontFamily;')).toBe(true);
    expect(bindsFaceLocally('fontFamily: MONO.fontFamily')).toBe(true);
    expect(bindsFaceLocally('...faceFor(true)')).toBe(false);
    expect(bindsFaceLocally('sx={{ ...MONO_FACE, fontSize: 12 }}')).toBe(false);
  });

  it('every EXEMPT entry still exists AND still violates (no stale exemption widens the fence)', () => {
    for (const [rel, owner] of Object.entries(EXEMPT)) {
      const src = N1_SOURCES[`/src/app/${rel}`];
      expect(src, `EXEMPT entry ${rel} must still exist (${owner})`).toBeTruthy();
      const stillViolates = bindsFaceLocally(src) || memberInMonoRun(src).length > 0;
      expect(
        stillViolates,
        `EXEMPT entry ${rel} no longer violates — DELETE the entry (${owner})`,
      ).toBe(true);
      expect(owner, `EXEMPT entry ${rel} must name the task that removes it`).toMatch(/FE-\d+/);
    }
  });

  it('no non-exempt source in the three trees binds a face locally or renders a member in a mono run', () => {
    const offenders = Object.entries(N1_SOURCES)
      .filter(([file]) => !isExempt(file))
      .flatMap(([file, src]) => {
        const out: string[] = [];
        if (bindsFaceLocally(src)) out.push(`${file} → binds a font face locally (needle 2)`);
        const members = memberInMonoRun(src);
        if (members.length) {
          out.push(`${file} → closed-nine member in a mono run (needle 1): ${members.join(', ')}`);
        }
        return out;
      });
    expect(offenders, `N-1 violation:\n${offenders.join('\n')}`).toEqual([]);
  });
});
