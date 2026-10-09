/**
 * AC-41 — the seven v2 additions resolve in BOTH schemes and none falls back to its dark value.
 * The extras/extrasLight key-set twin is compile-enforced — `extrasLight` is typed
 * `Record<keyof typeof extras, string>` (tokens.ts), so `nx typecheck` carries it. Two runtime
 * assertions remain, because each is blind to what the other catches:
 *   (b) set-equality over palette.dark / palette.light key sets — two independent object literals
 *       with NO shared key type (tokens.ts:59-80), so `divider` could otherwise land dark-only;
 *   (c) per-name value distinctness — a key-set twin is structurally blind to `extrasLight.glass`
 *       holding the SAME STRING as `extras.glass`, which is exactly the fallback AC-41 forbids.
 */
import { describe, expect, it } from 'vitest';
import { extras, extrasLight, palette } from './tokens';

/** The v2 additions that live on `extras`. `line` lives on the palette and is checked in (b). */
const V2_EXTRAS = [
  'well',
  'panelRaised2',
  'lineStrong',
  'textTertiary',
  'scrim',
  'glass',
  'textDim',
  'textInfo',
] as const;

/**
 * SAME-IN-BOTH-SCHEMES exemptions (the `hex-discipline` EXEMPT idiom). Each entry carries a
 * one-line reason; adding a name here is a REVIEWED ACT, not a way to quiet a red build.
 * EMPTY as shipped: the verified mirror gives `scrim` two distinct values
 * (dark rgba(0,0,0,0.55) / light rgba(23,32,43,0.45)), so the member SPEC §2.1 seeded as
 * "plausible" is not needed. See PLAN "Unresolved" note U-1.
 */
const SAME_IN_BOTH_SCHEMES: Record<string, string> = {};

describe('AC-41 — v2 token parity across schemes', () => {
  it('(b) palette.dark and palette.light declare the identical key set (covers `divider`)', () => {
    expect(Object.keys(palette.dark).sort()).toEqual(Object.keys(palette.light).sort());
    expect(Object.keys(palette.dark)).toContain('divider');
  });

  it('(c) no v2 name falls back to its dark value in light mode', () => {
    const e = extras as unknown as Record<string, string>;
    const l = extrasLight as unknown as Record<string, string>;
    for (const name of V2_EXTRAS) {
      if (name in SAME_IN_BOTH_SCHEMES) continue;
      expect(l[name], `extrasLight.${name} must not be the dark value`).not.toBe(e[name]);
    }
    expect(palette.light.divider).not.toBe(palette.dark.divider);
  });
});
