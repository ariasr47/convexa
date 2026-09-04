# curvature-v2-foundations — implementation plan

**Spec:** `.spire/clusters/tech/contracts/curvature-v2-foundations/SPEC.md` (approved; not editable here)
**Interface:** `.spire/clusters/tech/contracts/curvature-v2-foundations/INTERFACE_CONTRACT.md` (posture `NO_BACKEND_CHANGE`)
**Rulings:** `council/decisions.md` §5 rulings 1–6 — inputs to this breakdown, not suggestions
**Baseline:** `_baseline-2026-09-03.md` — 127 tests / 17 files green, `npm run typecheck` exit 0, e2e deliberately NOT run

## Goal

Land phase 1 of Curvature Terminal v2: the seven surface/line tokens in both schemes, the four
declared scales (spacing fenced · **radius migrated** · z-index · additive breakpoints), the
`FigureCell` primitive that deletes `StatTile`'s coloured accent edge at all 16 render sites, one
page-scoped six-state connection chip, the v2 four-link navigation with a ⌘K palette, and panels as
**named** container-query contexts. No screen is re-laid-out. The `apps/api` diff is empty.

## Architecture shape

Everything ships inside `apps/dashboard` (React 19 + Vite + MUI v9/Emotion, Vitest + jsdom +
Testing Library, Playwright e2e) plus `apps/dashboard-e2e`. Values land only in
`apps/dashboard/src/app/shared/theme/tokens.ts`; components bind MUI palette slots or
`extrasFor(theme)` inside `sx` callbacks. The connection resolver becomes its own ticker-local
module with a pinned two-file importer set; the palette is a hand-assembled MUI `Dialog` mounted
once in `AppShell` so it inherits the shipped `modalFocusHandoff` pair. Nothing in `apps/dashboard`
imports from `design/` — `design/tokens/tokens.json` is the value source **for this plan**, copied
into `tokens.ts` by hand, never read at runtime.

## Tech stack this plan binds

`@mui/material ^9.2.0` (`theme.containerQueries`, `createUnaryUnit` radius resolution,
`BreakpointOverrides` module augmentation) · `react ^19.2.8` · `vitest ~4.1.10` (jsdom, `?raw`
`import.meta.glob` scan idiom) · `@playwright/test ^1.62.1` (chromium; `testMatch` is an explicit
allowlist — see FE-10) · `@convexa/api` generated wire types.

## Global constraints

1. **`NO_BACKEND_CHANGE`.** `git diff --name-only <merge-base>..HEAD -- apps/api` must return zero
   lines (AC-51, `[additive-keeps-score-byte-identical]`). No task below writes under `apps/api`.
2. **Check exit codes, never printed summaries.** `echo $?` / `${PIPESTATUS[0]}` after every run
   (CLAUDE.md trap: a suite once printed `1004 passed` while exiting non-zero).
3. **`nx test` green does not mean the types are sound.** `npm run typecheck` exit 0 is recorded
   separately at every claim of done (AC-56, AC-41 — `extrasLight` parity is compile-enforced only).
4. **Never a bare `nx format:write`.** Always `npx nx format:write --files <a>,<b>`.
5. **Zero new keyframes** (`[single-motion-moment]`). If `liveDotPulse` moves, the **declaration
   moves, it is not copied**, and `single-motion-moment.spec.ts:29`'s `KEPT_KEYFRAMES` map is
   re-pointed in the same commit.
6. **Pins are re-pointed, never deleted** (AC-57), and every list keeps its stale-entry assertion.
7. **Mutation proofs are part of done** — poison the thing the rule forbids, the build goes red, and
   the poison test is itself proven non-vacuous (`[structural-over-prose-enforcement]`).
8. **Conformance spec** — copied verbatim from `INTERFACE_CONTRACT.md` `## Conformance spec`. Both
   lanes inherit this shape:

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/ticker/{ticker}",
      "path_params": { "ticker": "SPY" },
      "query": {},
      "required": {
        "market_state": "object",
        "market_state.price": "number|null?",
        "market_state.call_wall": "number|null?",
        "market_state.put_wall": "number|null?",
        "market_state.gamma_flip": "number|null?",
        "market_state.max_pain": "number|null?",
        "market_state.net_gex": "number|null?",
        "market_state.net_dex": "number|null?",
        "market_state.vwap": "number|null?",
        "market_state.market_phase": "string|null?",
        "signals": "object",
        "signals.opportunity_score": "number|null?",
        "signals.opportunity_tier": "string|null?"
      }
    },
    {
      "method": "GET",
      "path": "/api/scan",
      "query": {},
      "required": {
        "rows": "array",
        "rows[].symbol": "string",
        "rows[].status": "string",
        "rows[].tier": "string|null",
        "rows[].score": "number|null",
        "rows[].as_of": "number",
        "sweep": "object|null",
        "sweep.sweep_last_completed": "number|null?",
        "view": "object"
      }
    }
  ]
}
```

**What that block does and does not buy** (read `INTERFACE_CONTRACT.md` before relying on it at
GATE Q): AC-1c and AC-29 become checked outright; AC-29b is checked **asymmetrically** —
`rows[].as_of` outright, `sweep.sweep_last_completed` only on a run where a heartbeat exists. The
rename that pin cannot see is closed by `npm run typecheck` against the generated `SweepHeartbeat`
type, not by the runner.

## Per-task cycle (every task below)

Write the failing test → run it, watch it fail (record the failure text) → implement minimally →
run it, watch it pass (record exit 0) → `npx nx format:write --files <changed>` → commit. Commit at
every green step, not once per task. If a step contradicts the tree, **report the conflict; do not
resolve it silently.**

---

# Backend track

The backend lane implements **zero product code**. Its whole job is proving the empty diff and
producing the conformance receipt. This is stated rather than padded with invented work.

## BE-1 — Empty-diff proof + conformance receipt (backend closer)

**Owns:** `.spire/clusters/tech/contracts/curvature-v2-foundations/conformance-receipt.json`

1. Record the merge base once:

```bash
cd /Users/rodrigoarias/dev/convexa
MB=$(git merge-base main HEAD); echo "merge-base=$MB"
```

2. Prove the empty diff (AC-51). The observed file count is reported, not just "empty":

```bash
git diff --name-only "$MB"..HEAD -- apps/api | tee /tmp/api-diff.txt | wc -l
test "$(wc -l < /tmp/api-diff.txt)" -eq 0; echo "AC-51 exit=$?"
```

Expected: `0` files, `AC-51 exit=0`. A non-zero count is a **stop** — report it, do not revert
someone else's work.

3. Prove `opportunity_score` / `opportunity_tier` / `state_fingerprint` byte-identical on a fixed
   fixture (AC-52). Because the `apps/api` diff is empty, the evidence is the diff itself plus one
   captured bundle read before and after:

```bash
npm run ports:free
npx nx serve api &   # :8000
curl -s localhost:8000/api/ticker/SPY | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(JSON.stringify({score:j.signals.opportunity_score,tier:j.signals.opportunity_tier,fp:j.ai_eval.state_fingerprint}))})'
```

Capture the same three values before FE-1 and after FE-11 and record both lines in the build
report. Identical strings = AC-52 pass.

4. Run the conformance check against the live backend and write the receipt:

```bash
node .claude/tools/interface_conformance.mjs \
  --contract .spire/clusters/tech/contracts/curvature-v2-foundations/INTERFACE_CONTRACT.md \
  --url http://localhost:8000 \
  --report .spire/clusters/tech/contracts/curvature-v2-foundations/conformance-receipt.json
echo "conformance exit=$?"
```

Expected: `interface_conformance — 2 endpoint(s)`, exit 0. **If the runner cannot reach a live
backend, this is a `NO_BACKEND_CHANGE` feature and the exemption stands** — record it as
`NOT RUN — no reachable backend, NO_BACKEND_CHANGE exemption` in the receipt and the report
(`[local-evidence-is-not-hosted-evidence]`). Never invent a sample pass.

5. `npm run ports:free` before leaving. Orphaned uvicorn children outlive a killed parent.

**Reviewer probe:** does the receipt's endpoint list equal the two in the Conformance spec above,
and does `sweep.sweep_last_completed` carry its `number|null?` optional marker (an unmarked pin
would FAIL every cold-store run)?

---

# Frontend track

Eleven tasks, strictly ordered. FE-1 and FE-2 are theme prerequisites; FE-3 is the whole-tree radius
sweep; FE-4…FE-9 are the component work; FE-10 is the browser layer; FE-11 is the closer.

## FE-1 — The seven tokens, both schemes, plus the parity and banned-literals scans

**Owns:** `apps/dashboard/src/app/shared/theme/tokens.ts` ·
`apps/dashboard/src/app/shared/theme/theme.ts` (the `divider` + `MuiBackdrop` wiring only) ·
new `apps/dashboard/src/app/shared/theme/token-parity.spec.ts` ·
new `apps/dashboard/src/app/shared/theme/banned-literals.spec.ts`

**Values.** Copied by hand from the verified mirror `design/tokens/tokens.json` (`color.dark` /
`color.light` / `additions`), which the canon names as the read-from source until they land in
`tokens.ts` (`DESIGN_SYSTEM.md:95-96, :103`). Nothing imports from `design/` at runtime.

**Step 1 — the failing parity spec.** Create
`apps/dashboard/src/app/shared/theme/token-parity.spec.ts`:

```ts
/**
 * AC-41 — the seven v2 additions resolve in BOTH schemes and none falls back to its dark value.
 * Three assertions, because each is blind to what the others catch:
 *   (a) runtime key-set twin over extras/extrasLight — `extrasLight` is typed
 *       `Record<keyof typeof extras, string>` so this is compile-enforced, but `nx test` cannot
 *       see the type (SPEC §2.1);
 *   (b) set-equality over palette.dark / palette.light key sets — two independent object literals
 *       with NO shared key type (tokens.ts:59-80), so `divider` could otherwise land dark-only;
 *   (c) per-name value distinctness — a key-set twin is structurally blind to `extrasLight.glass`
 *       holding the SAME STRING as `extras.glass`, which is exactly the fallback AC-41 forbids.
 */
import { describe, expect, it } from 'vitest';
import { extras, extrasLight, palette } from './tokens';

/** The v2 additions that live on `extras`. `line` lives on the palette and is checked in (b). */
const V2_EXTRAS = ['well', 'panelRaised2', 'lineStrong', 'textTertiary', 'scrim', 'glass'] as const;

/**
 * SAME-IN-BOTH-SCHEMES exemptions (the `hex-discipline` EXEMPT idiom). Each entry carries a
 * one-line reason; adding a name here is a REVIEWED ACT, not a way to quiet a red build.
 * EMPTY as shipped: the verified mirror gives `scrim` two distinct values
 * (dark rgba(0,0,0,0.55) / light rgba(23,32,43,0.45)), so the member SPEC §2.1 seeded as
 * "plausible" is not needed. See PLAN "Unresolved" note U-1.
 */
const SAME_IN_BOTH_SCHEMES: Record<string, string> = {};

describe('AC-41 — v2 token parity across schemes', () => {
  it('(a) extras and extrasLight declare the identical key set', () => {
    expect(Object.keys(extras).sort()).toEqual(Object.keys(extrasLight).sort());
  });

  it('(a2) every v2 extras name is present in both maps', () => {
    for (const name of V2_EXTRAS) {
      expect(Object.keys(extras), `extras.${name}`).toContain(name);
      expect(Object.keys(extrasLight), `extrasLight.${name}`).toContain(name);
    }
  });

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

  it('(c2) every SAME_IN_BOTH_SCHEMES entry is LIVE — a listed name must still exist', () => {
    for (const name of Object.keys(SAME_IN_BOTH_SCHEMES)) {
      expect(Object.keys(extras), `${name} exempted but not a token — remove the entry`).toContain(
        name,
      );
    }
  });
});
```

Run `cd apps/dashboard && npx vitest run src/app/shared/theme/token-parity.spec.ts` → **fails**
(`well`, `divider` etc. do not exist).

**Step 2 — land the values.** Edit `apps/dashboard/src/app/shared/theme/tokens.ts`.

Add `divider` to both palette literals (inside the `palette` object at `tokens.ts:59-80`):

```ts
  dark: {
    // … existing keys unchanged …
    /** v2 `line` — the hairline divider. A real MUI slot every existing call site already binds,
     *  so landing it here changes the hairline app-wide with ZERO diff at those sites. */
    divider: 'rgba(138,155,180,0.16)',
  },
  light: {
    // … existing keys unchanged …
    divider: 'rgba(23,32,43,0.12)',
  },
```

Add the six extras (append inside `extras`, then mirror in `extrasLight`):

```ts
export const extras = {
  // … existing keys unchanged …
  /** v2 `ink2` — the WELL: the recessed body inside a panel. `Widget`'s `bodyVariant: 'inset'`
   *  fakes this today with `background.default`, which is `ink`, not `ink2`. One call site. */
  well: '#0D121B',
  /** v2 `raised2` — one elevation step above `panelRaised`; inherits its parity guarantee. */
  panelRaised2: '#223041',
  /** v2 `line2` — strong divider / control border. No second MUI divider slot exists, and a
   *  `palette.divider2` would emit a `--mui-palette-*` var no MUI component consumes. */
  lineStrong: 'rgba(138,155,180,0.30)',
  /** v2 `steel2` — TEXT TERTIARY. Explicitly NOT `palette.text.disabled`
   *  (`rgba(138,155,180,0.5)`), which MEANS disabled: two names, two meanings. Collapsing them
   *  would give a legible tertiary label disabled semantics for assistive tech. */
  textTertiary: 'rgba(138,155,180,0.85)',
  /** v2 `scrim` — sheet/dialog scrim. Consumed ONCE, via `MuiBackdrop.styleOverrides.root`. */
  scrim: 'rgba(0,0,0,0.55)',
  /** v2 `glass` — translucent nav background. Dark is exactly alpha(panel #131A24, 0.82), so the
   *  resting TopNav arm renders byte-identical. NAMED GAP: no token exists for the SCROLLED 0.9
   *  state; that one arm keeps its computed alpha until a token does. */
  glass: 'rgba(19,26,36,0.82)',
} as const;

export const extrasLight: Record<keyof typeof extras, string> = {
  // … existing keys unchanged …
  well: '#F1F1EC',
  panelRaised2: '#E3E3DD',
  lineStrong: 'rgba(23,32,43,0.22)',
  textTertiary: '#61708A',
  scrim: 'rgba(23,32,43,0.45)',
  glass: 'rgba(255,255,255,0.86)',
} as const;
```

**Step 3 — wire `divider` and `scrim` into the theme.** In
`apps/dashboard/src/app/shared/theme/theme.ts`, add `divider` to both `createTheme` palettes (it is
inert until passed):

```ts
// inside `theme`'s palette object, after `background`:
    divider: palette.dark.divider,
// inside `lightTheme`'s palette object, after `background`:
    divider: palette.light.divider,
```

and add the single scrim consumer to `COMMON.components` (beside `MuiSnackbarContent`):

```ts
    // A scrim is only correct if EVERY overlay gets it — so it binds once, at the theme layer,
    // rather than per-dialog. This is what lets `Widget.tsx:437`'s hardcoded rgba(0,0,0,0.6) go
    // (deleted in FE-6). Mode-aware via `extrasFor`.
    MuiBackdrop: {
      styleOverrides: {
        root: ({ theme }: { theme: Theme }) => ({
          backgroundColor: extrasFor(theme).scrim,
        }),
      },
    },
```

Run the parity spec → **passes**, exit 0. Commit.

**Step 4 — the banned-literals scan.** Create
`apps/dashboard/src/app/shared/theme/banned-literals.spec.ts`. This closes the hole the feature
opens: five of the seven dark values are `rgba(...)` strings and `hex-discipline.spec.ts`'s
`/#[0-9a-fA-F]{3,8}\b/` cannot see them. The mechanism is **not** a blanket `rgba(` ban —
`StatTile`/`Widget` legitimately use neutral overlay alphas.

```ts
/**
 * AC-44 — this phase introduces zero new hardcoded colour literals, HEX OR `rgba()`.
 * `hex-discipline.spec.ts` cannot see an rgba token, so this scan is seeded FROM `tokens.ts`
 * ITSELF: import the values, normalise whitespace, and assert none of those exact strings appears
 * in any component source outside `shared/theme`. Self-maintaining — a new token is covered the
 * day it lands — and mutation-tested.
 */
import { describe, expect, it } from 'vitest';
import { extras, extrasLight, palette } from './tokens';

const SOURCES = import.meta.glob(
  [
    '/src/app/pages/**/*.{ts,tsx}',
    '/src/app/features/**/*.{ts,tsx}',
    '/src/app/shell/**/*.{ts,tsx}',
    '/src/app/shared/**/*.{ts,tsx}',
    '!/src/app/shared/theme/**', // where colour BELONGS
    '!**/*.spec.{ts,tsx}',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const appPath = (k: string) => k.replace(/^\/src\/app\//, '');
const squash = (s: string) => s.replace(/\s+/g, '');

/** The seven v2 additions, both schemes — the exact strings no component may carry. */
const BANNED = [
  palette.dark.divider,
  palette.light.divider,
  ...(['well', 'panelRaised2', 'lineStrong', 'textTertiary', 'scrim', 'glass'] as const).flatMap(
    (k) => [extras[k], extrasLight[k]],
  ),
].map(squash);

/**
 * EXEMPT — each entry a real, pre-existing, NON-token use of a string that happens to equal a
 * token value, with its one-line reason. Stale-entry-checked below.
 */
const EXEMPT: Record<string, string> = {
  'shared/ui/Widget/Widget.tsx':
    "inset well shadow `inset 0 2px 10px -5px rgba(0,0,0,0.55)` — a neutral depth alpha that predates `scrim` and is not an overlay dim (Widget.tsx:137, dark arm only)",
};

/** Pure checker (drives the mutation guard). */
function bannedHits(files: Record<string, string>, banned: string[]): string[] {
  const out: string[] = [];
  for (const [key, src] of Object.entries(files)) {
    const file = appPath(key);
    if (file in EXEMPT) continue;
    const flat = squash(src);
    for (const b of banned) if (flat.includes(b)) out.push(`${file} → ${b}`);
  }
  return out;
}

describe('banned-literals — no component carries a v2 token value verbatim', () => {
  it('the ban list and the glob are both non-empty (anti-vacuity)', () => {
    expect(BANNED.length).toBe(14);
    expect(Object.keys(SOURCES).length).toBeGreaterThan(40);
    expect(Object.keys(SOURCES).map(appPath).some((k) => k.startsWith('pages/'))).toBe(true);
    expect(Object.keys(SOURCES).map(appPath).some((k) => k.startsWith('shell/'))).toBe(true);
    expect(Object.keys(SOURCES).map(appPath).every((k) => !k.startsWith('shared/theme/'))).toBe(
      true,
    );
  });

  it('MUTATION GUARD: a planted token literal is caught, a clean source is not', () => {
    expect(
      bannedHits({ '/src/app/pages/x.tsx': `sx={{ bgcolor: '${extras.glass}' }}` }, BANNED),
    ).toHaveLength(1);
    expect(
      bannedHits({ '/src/app/pages/x.tsx': `sx={{ bgcolor: 'background.paper' }}` }, BANNED),
    ).toHaveLength(0);
  });

  it('no component source outside shared/theme carries a v2 token value', () => {
    const hits = bannedHits(SOURCES, BANNED);
    expect(hits, `bind the token, do not paste its value:\n${hits.join('\n')}`).toEqual([]);
  });

  it('the EXEMPT list is LIVE — a listed file must still exist and still hit', () => {
    for (const file of Object.keys(EXEMPT)) {
      const entry = Object.entries(SOURCES).find(([k]) => appPath(k) === file);
      if (!entry) throw new Error(`${file} exempted but missing — remove the entry`);
      expect(
        bannedHits({ [`/src/app/${file}`]: entry[1] }, BANNED).length,
        `${file} exempted but carries no banned literal anymore — remove the entry`,
      ).toBeGreaterThan(0);
    }
  });
});
```

**Known collision, measured, not assumed.** `shared/ui/Widget/Widget.tsx:137` carries
`rgba(0,0,0,0.55)` inside an inset box-shadow — the exact `scrim` dark value. That is the single
pre-existing hit and it is what the EXEMPT entry above covers. **Near-miss recorded, not silently
passed:** three sources carry `rgba(138,155,180,0.3)`, numerically equal to `line2`'s
`rgba(138,155,180,0.30)` but not an exact string match after whitespace squashing —
`shared/charts/structure-field/StructureFieldCanvas.tsx:873`, `pages/lab/StructureFieldWebGL.tsx:1028`,
`pages/lab/demos/FlowRibbonsLab.tsx:73`. Report them in the build report as a stated blind spot of
the exact-string mechanism; do **not** widen the scan to numeric equality this phase (that is a
second mechanism with its own false positives).

Before committing, re-run the collision probe so a fourth hit is not a surprise at GATE Q:

```bash
cd /Users/rodrigoarias/dev/convexa
rg -n --glob '!*.spec.*' -e 'rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.55' -e '#0D121B' -e '#223041' \
   -e '#F1F1EC' -e '#E3E3DD' -e '#61708A' -e 'rgba\(\s*19\s*,\s*26\s*,\s*36\s*,\s*0\.82' \
   -e 'rgba\(\s*23\s*,\s*32\s*,\s*43' -e 'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.86' \
   apps/dashboard/src/app
```

Run `npx vitest run src/app/shared/theme` → all files exit 0. Run `npm run typecheck` → exit 0
(this is where a missing `extrasLight` key would surface). Commit.

**Reviewer probe:** are all seven names present in **both** maps, is `textTertiary` distinct from
`text.disabled` in both schemes, and does the EXEMPT list carry a reason per entry?

---

## FE-2 — Z-index ladder + additive breakpoint keys

**Owns:** `apps/dashboard/src/app/shared/theme/theme.ts` (zIndex + breakpoints only) ·
new `apps/dashboard/src/app/shared/theme/scales.spec.ts` ·
new `apps/dashboard/src/app/shared/theme/mui.d.ts`

Both axes are **purely additive**: no existing breakpoint value moves, and one app site reads
`theme.zIndex` at all (`AppShell.tsx:42`, `theme.zIndex.tooltip + 1` for the skip link), so the
blast radius is one file.

**Step 1 — the failing spec.** `apps/dashboard/src/app/shared/theme/scales.spec.ts`:

```ts
/**
 * AC-45b (partial) + SPEC §2.2 — the declared z-index ladder and the ADDITIVE breakpoint keys.
 * Redefining xs/sm/md/lg/xl is REJECTED: 57 `sx` sites across 26 files use them and four hooks
 * call down('sm'|'md') / up('lg'). Every existing key's value stays byte-identical, asserted here.
 */
import { describe, expect, it } from 'vitest';
import { lightTheme, theme } from './theme';

const APP_SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('z-index ladder (SPEC §2.2)', () => {
  for (const t of [theme, lightTheme]) {
    it(`${t.palette.mode}: every rung is declared and no MUI default floats above the ladder`, () => {
      expect(t.zIndex.appBar).toBe(20);
      expect(t.zIndex.drawer).toBe(30);
      expect(t.zIndex.modal).toBe(40);
      expect(t.zIndex.snackbar).toBe(50);
      expect(t.zIndex.tooltip).toBe(60);
      // These three have NO consumers, but left at MUI's 1000–1050 defaults they sit above every
      // v2 rung. Giving them values is the whole point.
      expect(t.zIndex.mobileStepper).toBeLessThan(20);
      expect(t.zIndex.fab).toBeLessThan(20);
      expect(t.zIndex.speedDial).toBeLessThan(20);
    });
  }
});

describe('breakpoints — additive keys only (SPEC §2.2)', () => {
  it('every shipped key keeps its exact value', () => {
    expect(theme.breakpoints.values.xs).toBe(0);
    expect(theme.breakpoints.values.sm).toBe(600);
    expect(theme.breakpoints.values.md).toBe(900);
    expect(theme.breakpoints.values.lg).toBe(1200);
    expect(theme.breakpoints.values.xl).toBe(1536);
  });

  it('the five v2 bands land alongside them, in ascending order', () => {
    const v = theme.breakpoints.values as Record<string, number>;
    expect(v.tablet).toBe(768);
    expect(v.smallLaptop).toBe(1000);
    expect(v.laptop).toBe(1100);
    expect(v.desktop).toBe(1300);
    expect(v.wide).toBe(1600);
    const ordered = theme.breakpoints.keys.map((k) => v[k]);
    expect([...ordered].sort((a, b) => a - b)).toEqual(ordered);
  });

  it('PIN: no app source calls breakpoints.only() or .not() — both derive from ADJACENT keys, so inserting a key changes their meaning', () => {
    const callers = Object.entries(APP_SOURCES)
      .filter(([, src]) => /breakpoints\s*\.\s*(only|not)\s*\(/.test(src))
      .map(([f]) => f);
    expect(callers, `breakpoints.only()/.not() would silently change meaning`).toEqual([]);
  });
});
```

Run → **fails**.

**Step 2 — the type augmentation.** `apps/dashboard/src/app/shared/theme/mui.d.ts`:

```ts
import '@mui/material/styles';

declare module '@mui/material/styles' {
  interface BreakpointOverrides {
    tablet: true;
    smallLaptop: true;
    laptop: true;
    desktop: true;
    wide: true;
  }
}
```

**Step 3 — the theme edit.** In `theme.ts`'s `COMMON` object, beside `shape`:

```ts
  // The declared v2 rungs. `sheetScrim` 29 and `popover` 35 are named in the canon for later
  // phases; MUI has no slot for either, so they are not invented here.
  // mobileStepper/fab/speedDial have NO consumers but MUST be given values — left at MUI's
  // 1000–1050 defaults they sit above every rung below.
  zIndex: {
    mobileStepper: 10,
    fab: 15,
    speedDial: 15,
    appBar: 20,
    drawer: 30,
    modal: 40,
    snackbar: 50,
    // The canon declares six rungs; MUI has eight slots. `tooltip` is UNDECLARED (SPEC §9-2, an
    // Amendments-shaped gap for the owner). This is the working mapping: above toast, and no
    // longer 1500. `AppShell.tsx:42` reads `theme.zIndex.tooltip + 1` for the skip link.
    tooltip: 60,
  },
  // ADDITIVE ONLY. Redefining xs/sm/md/lg/xl is rejected (SPEC §2.2).
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      tablet: 768,
      md: 900,
      smallLaptop: 1000,
      laptop: 1100,
      lg: 1200,
      desktop: 1300,
      xl: 1536,
      wide: 1600,
    },
  },
```

Run the spec → passes. Run `npm run typecheck` → exit 0 (the augmentation is what makes
`{ xs: 'none', laptop: 'flex' }` legal in FE-8). Then verify the one consumer still resolves:
`npx vitest run src/app/shell/AppShell.keyboard.spec.tsx` → exit 0. Commit.

**Reviewer probe:** does `AppShell.tsx:42`'s skip link still sit above every overlay at
`tooltip + 1 = 61`, and did any shipped breakpoint value move?

---

## FE-3 — The radius migration: `shape` 10 → 12, four declared roles, all 38 numeric sites

**Owns:** `apps/dashboard/src/app/shared/theme/tokens.ts` (the `shape` line) ·
`apps/dashboard/src/app/shared/theme/theme.ts` (role overrides) ·
new `apps/dashboard/src/app/shared/theme/radius-scale.spec.ts` ·
new `apps/dashboard/src/app/shared/theme/spacing-ladder.spec.ts` ·
**every file carrying a numeric `borderRadius`** (see the enumeration below)

**Why this is its own task and why it cannot run beside the component work.** MUI resolves
`borderRadius` through `createUnaryUnit(theme, 'shape.borderRadius', 4, 'borderRadius')`, so a
numeric `borderRadius: n` in `sx` means **n × shape.borderRadius**, not n pixels. Moving 10 → 12
scales every numeric site by **1.2× whether or not anyone looks** — so the `shape` flip and the
per-site reads must land in the **same commit**. The site set spans `pages/`, `features/`,
`shared/ui/`, `shared/charts/`, and includes `_kit/StatTile.tsx:47` (a file FE-4 deletes) and
`shared/ui/Widget/Widget.tsx` (a file FE-6 edits). Ruling 4: **silence is not an option at any of
them**, and no test can catch a wrong per-site judgement — hence the report requirement.

**Step 1 — enumerate, and reconcile with the council's measurement.** Run exactly:

```bash
cd /Users/rodrigoarias/dev/convexa
rg -n --glob '!*.spec.*' 'borderRadius:\s*[0-9]+(\.[0-9]+)?\s*[,}\n]' apps/dashboard/src \
  | tee .spire/clusters/tech/contracts/curvature-v2-foundations/_radius-sites.txt | wc -l
```

Expected **38 lines across 31 files**, matching ruling 4's 2026-09-03 measurement. **The plan
re-derived this and found one thing worth stating up front:** one of the 38 lines is
`apps/dashboard/src/app/shared/theme/tokens.ts:83` — the `shape` declaration itself, not an `sx`
site — so the sweep is **37 `sx`/`style` sites plus the `shape` value**. If your run returns a
different count, **report the delta before editing**; do not silently sweep a different set.

**Step 2 — the failing role spec.** `apps/dashboard/src/app/shared/theme/radius-scale.spec.ts`:

```ts
/**
 * AC-45b — the FOUR declared radius roles are landed: panels 12 · dialogs 16 · controls 8 ·
 * pills 999. One `shape.borderRadius` value cannot serve four roles, so the other three are theme
 * overrides. The per-site judgement across the 38 numeric sites is REVIEW (build report), because
 * no test can catch a wrong one — this spec pins the four role values and the exemption list.
 */
import { describe, expect, it } from 'vitest';
import { lightTheme, theme } from './theme';
import { shape } from './tokens';

const SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const appPath = (k: string) => k.replace(/^\/src\/app\//, '');
const NUMERIC_RADIUS = /borderRadius:\s*([0-9]+(?:\.[0-9]+)?)\s*[,}\n]/g;

/**
 * PILL sites — a local `999` is a DECLARED role, not a stray number, so it is exempted from the
 * "no bare multiplier" arm by name. Live-checked: a listed path that no longer carries a 999
 * radius red-builds (the arc importer-set idiom).
 */
const PILL_SITES = [
  'pages/landing/Landing.tsx',
  'shared/ui/ComingSoonCard.tsx',
  'features/auth/AccountControl.tsx',
  'features/trading/positions/CustomizationToolbar.tsx',
];

const overrideRoot = (t: typeof theme, key: string) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (t.components as any)?.[key]?.styleOverrides?.root;

describe('AC-45b — the four declared radius roles', () => {
  it('PANEL: shape.borderRadius is 12', () => {
    expect(shape.borderRadius).toBe(12);
    expect(theme.shape.borderRadius).toBe(12);
    expect(lightTheme.shape.borderRadius).toBe(12);
  });

  it('DIALOG: MuiDialog paper is 16', () => {
    for (const t of [theme, lightTheme]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((t.components as any)?.MuiDialog?.styleOverrides?.paper?.borderRadius).toBe(16);
    }
  });

  it('CONTROL: every control family is 8', () => {
    for (const t of [theme, lightTheme]) {
      for (const key of [
        'MuiButton',
        'MuiOutlinedInput',
        'MuiFilledInput',
        'MuiInputBase',
        'MuiToggleButton',
      ]) {
        expect(overrideRoot(t, key)?.borderRadius, `${key} control radius`).toBe(8);
      }
    }
  });

  it('PILL: every declared pill site still carries a 999 radius (LIVE list)', () => {
    for (const file of PILL_SITES) {
      const entry = Object.entries(SOURCES).find(([k]) => appPath(k) === file);
      if (!entry) throw new Error(`${file} listed as a pill site but missing — remove the entry`);
      expect(entry[1], `${file} no longer carries borderRadius: 999 — remove the entry`).toMatch(
        /borderRadius:\s*999/,
      );
    }
  });

  it('no source carries a numeric borderRadius above 3 except the declared pill 999', () => {
    // A bare `borderRadius: 12` now renders 144px. Anything above the small-multiplier band is a
    // px value pasted where a multiplier is read — the exact defect the 1.2x scaling produces.
    const bad: string[] = [];
    for (const [key, src] of Object.entries(SOURCES)) {
      const file = appPath(key);
      if (file.startsWith('shared/theme/')) continue;
      for (const m of src.matchAll(NUMERIC_RADIUS)) {
        const n = Number(m[1]);
        if (n > 3 && n !== 999) bad.push(`${file} → borderRadius: ${n}`);
      }
    }
    expect(bad, `numeric borderRadius is a MULTIPLIER (n x 12px):\n${bad.join('\n')}`).toEqual([]);
  });
});
```

**Step 3 — the theme role overrides.** In `theme.ts`'s `COMMON.components`:

```ts
    // CONTROL role = 8px. `shape.borderRadius` is the PANEL role (12) and cannot also be the
    // control role, so each control family binds 8 explicitly (SPEC §2.2, ruling 4).
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none' as const, borderRadius: 8 },
      },
    },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiFilledInput: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiInputBase: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiToggleButton: { styleOverrides: { root: { borderRadius: 8 } } },
    // DIALOG role = 16px.
    MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } },
```

(`MuiButton`'s existing `textTransform: 'none'` is preserved — do not drop it.)

**Step 4 — the per-site sweep.** For **each** of the enumerated sites, in one commit with the
`shape` flip:

- Read the site. Compute its **rendered** radius before (`n × 10`) and after (`n × 12`).
- Set it deliberately to one of:
  - a **declared role** — panel `theme.shape.borderRadius`, dialog `16`, control `8`, pill `999`;
  - or an **explicit px string** (`'8px'`, `'12px'`) chosen to survive the shape change — a string
    is not passed through `createUnaryUnit`, so it is immune.
- Record: `file:line · before → after · role or px · why`.

Known decisions this plan fixes so the implementer is not guessing:

| Site | Today | Set to | Why |
|---|---|---|---|
| `shared/theme/tokens.ts:83` | `shape = { borderRadius: 10 }` | `12` | The panel role. Flip in the same commit as the sweep. |
| `shared/ui/Widget/Widget.tsx:328, :378, :403` | `'12px'` literals | `theme.shape.borderRadius` | Panel role, theme-derived rather than literal (SPEC §2.2). FE-6 also edits this file — sequence FE-3 first. |
| `shared/ui/Widget/Widget.tsx:444` | `'16px'` | dialog role via the `MuiDialog` override (delete the local literal) | One dialog radius, declared once. |
| `pages/ticker/widgets/_kit/StatTile.tsx:47` | `borderRadius: 12` (→ 144px after the flip) | `theme.shape.borderRadius` on the successor | This file is **deleted** by FE-4; the value carries into `FigureCell.tsx`. Sequence FE-4 before this row or set it on `FigureCell`. |
| `pages/lab/**`, `shared/charts/**` `borderRadius: 12` / `: 8` | multipliers | explicit `'12px'` / `'8px'` strings | Canvas/WebGL surrounds whose geometry is LOCKED; a 1.2× drift there is a silent regression. |
| `borderRadius: 999` sites (4) | pills | unchanged `999` | Pills stay a local 999 (`999 × 12` still clamps to a pill). |

Everything else: read it, decide, record it. **A site left untouched is only correct if you wrote
down why** — silence is not an option (ruling 4).

**Step 5 — the spacing fence** (`spacing-ladder.spec.ts`, AC-45c). Spacing is **enforcement, not
migration** — MUI's 8px unit already expresses the ladder as `0.5 1 1.5 2 2.5 3 4 5`:

```ts
/**
 * AC-45c — the SPACING FENCE (ruling 4: radius In, spacing fenced). Off-ladder `sx` multipliers
 * are scanned, today's offenders ship as a LIVE-CHECKED exemption list, the occurrence count goes
 * in the build report, and a NAMED later phase burns it down. A stale list that silently stops
 * matching is worse than no list — that is what the liveness assertion is for.
 */
import { describe, expect, it } from 'vitest';

const SOURCES = import.meta.glob(
  ['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const appPath = (k: string) => k.replace(/^\/src\/app\//, '');

/** The declared 4-pt rhythm as MUI multipliers: 4 8 12 16 20 24 32 40 → 0.5 1 1.5 2 2.5 3 4 5. */
const LADDER = new Set([0, 0.25, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5]);
const SPACING_PROPS =
  /\b(p|m|px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr|gap|rowGap|columnGap|spacing):\s*([0-9]+(?:\.[0-9]+)?)/g;

/** THE BURN-DOWN PHASE. Not an open-ended grandfather — this name is the list's expiry. */
export const SPACING_DEBT_BURNDOWN_PHASE = 'curvature-v2 phase 4 (responsive sweep)';

/** Seeded with today's files. EVERY entry must still carry an off-ladder value (checked below). */
const EXEMPT: string[] = [
  /* FILLED AT BUILD from the scan output below — one path per offending file. */
];

function offLadder(files: Record<string, string>, exempt: string[]): string[] {
  const out: string[] = [];
  for (const [key, src] of Object.entries(files)) {
    const file = appPath(key);
    if (exempt.includes(file)) continue;
    for (const m of src.matchAll(SPACING_PROPS)) {
      if (!LADDER.has(Number(m[2]))) out.push(`${file} → ${m[1]}: ${m[2]}`);
    }
  }
  return out;
}

describe('spacing ladder — fenced, live-checked, with a named expiry', () => {
  it('the glob is not vacuous', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(40);
  });

  it('MUTATION GUARD: an off-ladder value is caught, an on-ladder one is not', () => {
    expect(offLadder({ '/src/app/pages/x.tsx': 'sx={{ p: 3.75 }}' }, [])).toHaveLength(1);
    expect(offLadder({ '/src/app/pages/x.tsx': 'sx={{ p: 2.5 }}' }, [])).toHaveLength(0);
  });

  it('no NEW off-ladder spacing outside the seeded exemption list', () => {
    const v = offLadder(SOURCES, EXEMPT);
    expect(v, `off the 4-pt ladder (burn-down: ${SPACING_DEBT_BURNDOWN_PHASE}):\n${v.join('\n')}`)
      .toEqual([]);
  });

  it('the exemption list is LIVE — every listed file still carries an off-ladder value', () => {
    for (const file of EXEMPT) {
      const entry = Object.entries(SOURCES).find(([k]) => appPath(k) === file);
      if (!entry) throw new Error(`${file} exempted but missing — remove the entry`);
      expect(
        offLadder({ [`/src/app/${file}`]: entry[1] }, []).length,
        `${file} is now on-ladder — remove the entry`,
      ).toBeGreaterThan(0);
    }
  });
});
```

Seed `EXEMPT` from the first run's own output (run with `EXEMPT` empty, paste the distinct file
list). Record the **occurrence count** in the build report. The architect's number was **86
occurrences across 35 files** — recorded as the architect's number, never independently verified;
report your measured count beside it and note any delta.

**Step 6.** `npx vitest run src/app/shared/theme` → exit 0. `npm run typecheck` → exit 0.
`npx nx test @convexa/dashboard` → exit 0 (the radius flip touches ~31 files; this is where a
snapshot or a computed-style assertion elsewhere would break). Commit.

**Reviewer probe:** does the build report name **every** site whose *rendered* radius changed
(before → after in px), and is every site that was left alone accompanied by a reason?

---

## FE-4 — `FigureCell`, the closed `NotANumber` union, and the 16-site swap

**Owns:** new `apps/dashboard/src/app/shared/copy/notANumber.ts` ·
new `apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.tsx` ·
new `apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.spec.tsx` ·
**deleted** `_kit/StatTile.tsx` + `_kit/StatTile.spec.tsx` · `_kit/index.ts` ·
`pages/ticker/widgets/live-tape/LiveTape.tsx` ·
`pages/ticker/widgets/dealer-positioning/DealerPositioning.tsx` ·
`shared/theme/stage3-amber.spec.ts` (the `HOVER_CENSUS_FILES` re-point) ·
`features/trading/positions/labels.ts` · `features/trading/positions/view.ts` ·
`features/trading/broker/brokerView.ts`

**No deprecation window, no coexistence.** A parallel window leaves the accent bar in the tree — the
exact outcome the BRIEF culled — and two figure anatomies on one screen make the per-screen sign-off
meaningless.

**Module placement, decided.** `FigureCell.tsx` goes in `_kit/` exactly as SPEC §2.3 says (promoted
to `shared/ui/` at its second consumer in phase 2). The **union does not**: `NO_BASIS_LABEL`
(`features/trading/positions/labels.ts:126`), `NOT_PROVIDED` (`features/trading/broker/brokerView.ts`)
and `NOT_RECORDED` (`features/trading/positions/view.ts`) re-point at it, and a `features/` module
importing from `pages/ticker/widgets/_kit/` inverts the repo's binding dependency direction
(`pages`/`features` → `shared`, `apps/dashboard/src/app/README.md`). The union has three existing
consumers on day one, so the repo's own "populate `shared/` on the 2nd consumer" rule puts it in
`shared/` immediately. It lands at `shared/copy/notANumber.ts`, beside the shipped
`shared/copy/disclaimer`. No spec sentence is weakened: §2.3 names the union's *shape*, never its
module.

**Step 1 — the union.** `apps/dashboard/src/app/shared/copy/notANumber.ts`:

```ts
/**
 * `NotANumber` — the ONE closed not-a-number vocabulary (`[absent-is-not-none]`, canon rule 24 as
 * amended by ruling 3 to the shipped NINE).
 *
 * Seeded from the SHIPPED DECLARATION SITES, not from a count: the canon's six plus three that are
 * spec-pinned as NON-SYNONYMOUS —
 *   `not recorded`  the saved record never held this fact (positions)
 *   `no basis`      the cost-basis denominator is absent while the dollar figure renders fine
 *   `not provided`  the feed did not send it (broker)
 * A six-member union would be worse than useless: a seventh literal is not a type error, it is a
 * plain `string` that falls into the MONO figure register — the exact inversion the register exists
 * to prevent.
 *
 * THE TYPE ENFORCES CLOSURE; THE CALLER PICKS THE MEMBER. Members never substitute for one another
 * — `brokerView.ts` substitutes NOT_RECORDED → NOT_PROVIDED per surface BY DESIGN, because a
 * broker's non-disclosure must not be reported as our record being empty.
 */
export const NOT_A_NUMBER = [
  '—',
  'unavailable',
  'not given',
  'not set',
  'size not suggested',
  'unrecognized',
  'not recorded',
  'no basis',
  'not provided',
] as const;

export type NotANumber = (typeof NOT_A_NUMBER)[number];

/** Runtime membership. A string that is not a member CANNOT reach the literal branch. */
export function isNotANumber(v: string): v is NotANumber {
  return (NOT_A_NUMBER as readonly string[]).includes(v);
}

/** The three re-pointed constants — one source of truth instead of four. */
export const NOT_RECORDED: NotANumber = 'not recorded';
export const NO_BASIS_LABEL: NotANumber = 'no basis';
export const NOT_PROVIDED: NotANumber = 'not provided';
```

Then re-point the three existing declarations to re-export from here (keep the existing exported
names so no call site churns) and run
`npx vitest run src/app/features/trading` → exit 0.

**Step 2 — the failing `FigureCell` spec.** `_kit/FigureCell.spec.tsx`. It is a **rewrite** of
`StatTile.spec.tsx`, not an edit; the old file is deleted. Cover, one `describe` each:

- **F1** default static: caps label · ⓘ · **no dot**; value in Mono. (AC-14 is `review`; the dot's
  absence is the test.)
- **F2** loading: `data-testid="cold-skeleton"` present, **no text at all** — no `Loading…`, no `—`.
  Preserve the testid: ~18 spec files key on it (AC-46).
- **F3** live: dot present **only** when `live` is true; the dot carries the visually-hidden word
  `live` and is never inside an `aria-live` region (AC-16, §4.1).
- **F4** offline **with** a retained value: dimmed Mono value, pause icon, caption
  `offline · last known` (AC-17a).
- **F5** offline **without** one: the bare absence literal in **Sans**, pause icon, caption
  `offline` — never `last known` (AC-17b). Assert F4 and F5 carry **distinct DOM markers**
  (`data-figure-state="offline-retained"` / `"offline-bare"`), not merely different text.
- **F6** replay: Mono at **full strength**, no dot, no pause mark, no `offline` caption (AC-6).
- **F7** empty `—` Sans secondary; **F8** `unavailable` Sans secondary — distinguishable in the DOM
  (AC-50b: assert four distinct markers across F2/F5/F7/F8).
- **F9** untraced: `register="asserted"` renders **Plex Sans at figure size with the dotted rule**
  and a caption naming the asserter — the **untraced arm must fire**; a mono-only assertion is not
  sufficient evidence (AC-15).
- **AC-19** vocabulary: every member renders as small Sans, never mono, never with a unit, and the
  cell **renders the member it was handed** — feed each of the nine and assert the same string out.
  Mutation proof: a non-member string does **not** classify as a literal (`isNotANumber('n/a')`
  false → it takes the figure branch).
- **AC-19b**: no rendered value contains a member together with any other character — assert `$—`
  never appears, and a null max-pain renders the bare `—`.
- **The ⓘ is a real focusable control**: `getByRole('button', { name: 'About Net flow' })`, opens on
  Enter and Space, closes on Escape.

Run → **fails** (no module).

**Step 3 — `FigureCell.tsx`.** Prop contract, exactly as §2.3 rules it:

```tsx
export interface FigureCellProps {
  label: string;
  /**
   * REQUIRED, NO DEFAULT. Mono cannot be the fallback a careless caller gets: a cell that cannot
   * say where its number came from must not compile. It stays required when `value` is a
   * `NotANumber` member but has NO EFFECT on that render — the literal branch is always Sans
   * (AC-19) whatever `register` says, and the cell neither validates it there nor reports the
   * mismatch. Required-and-ignored is DELIBERATE: a call site that later swaps a literal for a
   * real figure has already declared its register.
   */
  register: 'traced' | 'asserted';
  value: string | NotANumber;
  /**
   * The label-row dot ONLY. DERIVED FROM THE VALUE'S OWN EXPRESSION AT THE CALL SITE — never from
   * the widget-scoped `widgetLive` or `numbersActive`. Three scopes never merge: the CHIP is the
   * page claim, the Widget LIVEBAR is the widget claim, this DOT is the figure claim.
   */
  live?: boolean;
  /** Offline treatment. `retained: true` is the ONLY thing that licenses the `· last known`
   *  clause — it is data-driven, never a fixed caption (ruling 2). */
  offline?: { retained: boolean } | null;
  replay?: boolean;
  info?: string;
  caption?: string | null;
  /** Names the asserter. Required by the F9 render when `register === 'asserted'`. */
  assertedBy?: string;
  flash?: FlashState | null;
}
```

**No `accent`, no `accentColor`, no colour prop of any kind.** Deleting both props is what makes
canon rule 13 structural: a coloured edge becomes **unexpressible**, not discouraged. There is **no
replacement mark and no replacement colour** — the two wall cells' side is in the label words and
the signed figures' sign is in the value glyphs (pinned by `_kit/copy.spec.ts:54`, `−$` U+2212), so
no datum is lost at any of the 16 sites.

Carry forward byte-for-byte from `StatTile.tsx`: the `StatSkeleton` export and its
`data-testid="cold-skeleton"`, the `stat-secondary` testid on the caption, the mono family from
`typographyTokens.monoFontFamily`, and the panel radius (now `theme.shape.borderRadius` per FE-3).
**Do not** carry the `&::before` accent bar.

The ⓘ uses the shipped `AccessibleHelp` pattern (`pages/ticker/widgets/ai-rec/AccessibleHelp.tsx:8-12`)
with an accessible name of the form `About {label}`. **Do not invent a second focusable-help
pattern.** Today the whole tile is a hover `Tooltip` (`StatTile.tsx:180-183`) with a decorative
icon, so every glossary string in `_kit/copy.ts` is unreachable on touch — that is the defect being
closed.

**Step 4 — the 16 call sites, in one change.**

`LiveTape.tsx` (4 sites at `:138, :146, :154, :163`), with the `live` prop derived per §2.3 —
**this is the AC-1c contract, do not simplify it**:

| Cell | `live` | Source |
|---|---|---|
| Net flow | `netFlow != null` | `LiveTape.tsx:78` |
| Spread | `numbersActive && live?.spread != null` | `:148` |
| Gamma flip | `numbersActive && live?.gamma_flip != null` | **not** `flipValue != null` — `:87` falls back to the bundle's `m.gamma_flip`, so a dot keyed on the rendered value would claim the stream for a static number |
| VWAP | **always `false`** | `:165` reads the bundle's `m.vwap`; `market_state.vwap` is a bundle field on the wire |

All four pass `register="traced"`. Net flow and Spread take the **no-retained** arm on a drop
(`offline={{ retained: false }}`) — phase 1 does **not** add retention to `LiveTape` (ruling 2;
phase 2 owes the latch, because `useFlashOnChange.ts:44` writes `prev.current = value` *before* its
null guard at `:46`, so a drop destroys the last non-null value).

`DealerPositioning.tsx` (12 sites at `:102, :109, :116, :136, :142, :148, :155, :161, :169, :179,
:196, :208`): all `register="traced"`, all `live={false}`, no `offline`. The Opportunity cell at
`:208` **drops `accentColor={tierColor}`** — tier emphasis survives in **type and the single amber
word already inside the value string** (`${opportunityScore} · ${tierWord}`), never a replacement
colour and never a directional one (AC-13b). `Call wall` / `Put wall` labels stay **verbatim** and
are **not** re-hedged into `(resistance)` / `(support)` — the shipped ⓘ copy already hedges with
"*Tends* to act as resistance", and promoting that hedge into the label would drop the hedge
(AC-13c).

**Step 5 — the collateral, all verified at source.**

- `_kit/index.ts:11` — `export * from './StatTile'` → `export * from './FigureCell'`. This is what
  keeps `TickerDashboard`'s `StatSkeleton` import path stable.
- `shared/theme/stage3-amber.spec.ts:235` — `HOVER_CENSUS_FILES` names
  `/src/app/pages/ticker/widgets/_kit/StatTile.tsx` and **self-checks each entry exists**
  (`:298`), so it red-builds on the rename. **Re-point it to `FigureCell.tsx`, never delete it**
  (the `scanner` precedent, AC-57).
- The `⏸ offline` / `cold-skeleton` strings are asserted across ~18 spec files; the glyph swap to a
  stroke icon stays **inside `FigureCell` and the connection chip only**, so those stay green.
  `PositionRow`, `OrderRow` and `BrokerPositionRow` keep the literal `⏸` until their own phase — a
  global find-and-replace would silently rewrite wording on three screens this phase promised not to
  touch.

**Step 6 — the anti-copy-paste scan (AC-13a).** Add to `FigureCell.spec.tsx` a source scan in the
`arc.spec.ts` importer idiom asserting: no source declares or passes an `accent` / `accentColor`
prop, no source imports `StatTile`, and `_kit/StatTile.tsx` does not exist. Anti-vacuity: the glob
is non-empty. Mutation proof: re-adding either prop, or a `StatTile` import, red-builds.

**Step 7.** `npx vitest run src/app/pages/ticker` → exit 0. `npx vitest run src/app/shared/theme` →
exit 0 (the re-pointed census). `npm run typecheck` → exit 0. Commit.

**Reviewer probe:** does **any** of the 16 sites pass `register="asserted"`? (AC-15b requires zero.)
And does the VWAP cell carry `live={false}` rather than inheriting the widget's live state?

---

## FE-5 — One connection chip: resolver module, six-state union, page-scoped announcer

**Owns:** new `apps/dashboard/src/app/pages/ticker/connection/connectionState.ts` ·
new `.../connection/ConnectionChip.tsx` · new `.../connection/LivenessAnnouncer.tsx` ·
new `.../connection/connectionState.spec.ts` · new `.../connection/connectionChip.spec.tsx` ·
`pages/ticker/widgets/chrome/TickerHeader.tsx` · `pages/ticker/widgets/chrome/CommandDeck.tsx` ·
`pages/ticker/widgets/chrome/TapePulseStrip.tsx` ·
`pages/ticker/widgets/chrome/TapePulseStrip.spec.tsx` ·
`shared/theme/single-motion-moment.spec.ts` (the `KEPT_KEYFRAMES` re-point)

**Step 1 — the failing resolver spec.** `connectionState.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveConnection, type ConnectionState } from './connectionState';

const APP_SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** AC-7 — every input combination the app can produce yields one of exactly SIX kinds. */
describe('AC-7 — the six-kind closure', () => {
  it('the produced kind set equals the six, never a seventh', () => {
    const kinds = new Set<ConnectionState['kind']>();
    for (const session of ['regular', 'premarket', 'afterhours', 'overnight', 'closed'])
      for (const streamOffline of [false, true])
        for (const liveFlag of [false, true])
          for (const phase of [
            null, 'starting', 'playing', 'gap', 'ended', 'drop', 'fault',
          ] as const) {
            const s = resolveConnection(/* … built fixture … */);
            if (s) kinds.add(s.kind);
          }
    expect([...kinds].sort()).toEqual(
      ['closed', 'live', 'noTicks', 'offline', 'overnight', 'replay'].sort(),
    );
  });

  it('AC-10 — the resolver module has EXACTLY two importers, asserted as SET EQUALITY', () => {
    const importers = Object.entries(APP_SOURCES)
      .filter(([, src]) => /from\s+['"][^'"]*\/connection\/connectionState['"]/.test(src))
      .map(([f]) => f)
      .sort();
    expect(importers).toEqual([
      '/src/app/pages/ticker/widgets/chrome/CommandDeck.tsx',
      '/src/app/pages/ticker/widgets/chrome/TickerHeader.tsx',
    ]);
  });

  it('the resolver is NOT re-exported from the shared UI barrel — a re-export blinds this scan', () => {
    expect(APP_SOURCES['/src/app/shared/ui/index.ts']).not.toMatch(/connectionState/);
  });
});
```

**Step 2 — the module.** `pages/ticker/connection/connectionState.ts`:

```ts
export type ReplayStanding = Exclude<ConsumeStanding, { kind: 's0' }>;

export type ConnectionState =
  | { kind: 'live' }        // reachable ONLY when the delivering-stream predicate holds
  | { kind: 'closed' }
  | { kind: 'overnight' }
  | { kind: 'noTicks' }
  | { kind: 'offline' }
  | { kind: 'replay'; standing: ReplayStanding };
```

Binding details, all verified at source:

- `ReplayStanding` is **derived, not retyped** — `Exclude<ConsumeStanding, { kind: 's0' }>` over the
  shipped 8-member `ConsumeStanding` at `sessionTapeStanding.ts:46-54` (`s0` is the no-session-tape
  arm). An added standing is then a compile error at the switch without duplicating the list.
- Exhaustive `switch` with a `never` default arm, so a seventh `kind` is a **compile error**.
- `live` is **not constructible from static data**: the resolver is the only exported way to build a
  `ConnectionState`, it takes the live-tape shape as input, and the delivering-stream predicate
  already returns `false` whenever `session_tape` is present (`sessionTapeStanding.ts:29-32`, "poison
  `live:true` still false"). **Export no `ConnectionChip` that accepts a free `state` prop** — only
  the resolver and a renderer over the resolver's output type.
- Replay is **not one tone**: `gap` (`:159`) and `ended` (`:168`) are `tone: 'warning'` with
  `warnIcon: true`, and `drop` (`:177`) / `fault` (`:185`) are warning-toned too. The invariant that
  actually holds is the one the type system already enforces: **`SessionTapeChip.pulse` is the
  literal type `false` (`sessionTapeStanding.ts:112`)** and every arm's dot is `'○'` or absent, never
  `●`. "Outlined, one tone" is **false and must not be written**.
- `drop` and `fault` **drop the literal `⚠`** from the string (`sessionTapeStanding.ts:178, :186`)
  and set the stroke warn icon instead (AC-8, the canon's Icons row). Every other replay sentence is
  the **shipped one, verbatim**.
- Keep the app's strings over the design preview: keep the `$` on the mid, and **keep the mid on the
  overnight chip** — naming the number the page is showing is what stops the chip being a bare scold.

**Step 3 — the latch (ruling 1).** A wrapper around the resolver holds `hasLatched`. Before the
first stream fact, the chip **slot** renders the existing **wordless** `cold-skeleton` placeholder —
no text, no tone, no dot, no connection vocabulary, no "connecting…". `ConnectionState` has **no
placeholder member**, so re-entry means *discarding* a held state, which no arm of the exhaustive
switch can express. But the boundary — whether a state exists yet at all — is runtime logic a
`never` arm cannot see, so **AC-7b is its own test with its own inputs**: latch on a first fact,
then feed each of the three re-entry candidates (a payload gap, an undefined payload, an expired
watchdog) in turn, asserting per candidate that the placeholder is **absent** and a chip state is
**present**. AC-7's compile-time enumeration is **not evidence for this row**.

**Step 4 — the announcer.** `LivenessAnnouncer.tsx` mounts **once and always** in the ticker page
shell (`CommandDeck.tsx`, above both chip renderers), fed by the single resolver output. Neither
chip renderer carries `role="status"` and neither owns a region. Two structural reasons: while
`condensed` is true, `StickyCondensed` (`CommandDeck.tsx:227`, resolver call at `:96`) and the hero
`TickerHeader` (`:261`) are **both mounted and neither is `aria-hidden`**, so a chip-owned region
announces twice; and a region inserted *together with* its content does not reliably announce at
all, so a chip-owned region is silent on first mount and doubled while condensed.

It fires **only when the resolved class changes** — one of the six — never when the text changes,
because the resolver's `text` contains the mid (`TickerHeader.tsx:328-341`) and a text-keyed region
would announce on every tick. The six sentences are §4.2's, verbatim.

AC-12b test: exactly **one** `aria-live="polite"` node in the chip path; a class transition
announces once; a mid-only update announces **zero** times.

**Step 5 — fold the second page-scope claim.** `TapePulseStrip.tsx:207-216` renders
`⏸ Stream offline` / `Stream off` under `data-testid="tape-stream-state"` — a second page-scope
liveness authority beside the header chip, exactly what canon rule 18 exists to stop. Delete the
block; its text folds into the chip.

**The pin set is wider than the spec's example — re-point all of them in the same commit**
(AC-57's principle; measured by `rg -n 'tape-stream-state'`):

| Pin | Action |
|---|---|
| `apps/dashboard/src/app/pages/ticker/widgets/chrome/TapePulseStrip.spec.tsx:39` | re-point to the chip's offline assertion |
| `apps/dashboard-e2e/src/quality/compatibility.spec.ts:43, :45, :48` | the spec's named example |
| `apps/dashboard-e2e/src/quality/accessibility.spec.ts:202, :204, :206` | same testid, same fold |
| `apps/dashboard-e2e/src/quality/visual.spec.ts:52` | same |
| `apps/dashboard-e2e/src/quality/fixtures/scenarios.ts:513` | scenario selector/text pair |

**Step 6 — the keyframe home.** `@keyframes liveDotPulse` is declared inline in
`TickerHeader.tsx:102-105`, and `single-motion-moment.spec.ts:29` pins that file as its **single
home**. If the live dot moves into the chip module, **move the declaration, do not copy it**, and
re-point `KEPT_KEYFRAMES.liveDotPulse` to the new path in the same commit — otherwise set-equality
red-builds. **Zero new keyframes** this phase (AC-54).

**Step 7 — AC-11 / AC-12.** Every liveness motion (dot pulse, widget bar, tick flash) is gated on
the **same delivering-stream predicate the resolver uses**, so none can outlive the stream; test all
five non-live states. Under reduced motion the dot renders **static and fully opaque** and the chip
still states the state **in words**.

**Step 8.** `npx vitest run src/app/pages/ticker` → exit 0. `npx vitest run src/app/shared/theme` →
exit 0. `npm run typecheck` → exit 0. Commit.

**Reviewer probe:** plant a seventh `kind` in the union — does `npm run typecheck` fail at the
switch? And is there exactly one `aria-live` node on the page while `condensed` is true?

---

## FE-6 — Panels as **named** container contexts, the hardened type-floor reader, the container steps

**Owns:** `apps/dashboard/src/app/shared/ui/Widget/Widget.tsx` ·
new `apps/dashboard/src/app/shared/ui/PanelContainer.tsx` · `shared/ui/index.ts` ·
`pages/ticker/widgets/_kit/type-floor.spec.tsx` · `pages/ticker/widgets/_kit/FigureCell.tsx`
(the step rules only) · `pages/ticker/widgets/market-context/MarketContext.tsx` (comment only) ·
`pages/ticker/widgets/dealer-flow-projection/DealerFlowProjection.tsx` (comment only)

**Container-query support is not the risk; two shipped comments that assert the opposite are.**
`MarketContext.tsx:436-438` and `DealerFlowProjection.tsx:173-174` both claim this Emotion version
drops or warns on `@container`. Both are **false for the dependency state in this tree**, verified
three levels down: Emotion emits an object key with an object value verbatim and its kebab-case
warning fires only in the scalar-value branch for CSS *property* names; stylis 4.2.0 special-cases
`@c…n` into the nested-at-rule branch; MUI attaches `theme.containerQueries` and sorts container
queries on every `sx` result. **Correct both comments in this change**, or the next implementer
re-derives the wrong constraint from them.

**Step 1 — harden the reader FIRST.** `_kit/type-floor.spec.tsx:35-39` joins every `<style>`
element's text, strips whitespace, then does ``css.split(`.${cls}{`)[1]?.split('}')[0]`` — it
returns the **first** rule bearing the class and stops at the first `}`, so it is **structurally
blind to a hoisted `@container` block and would pass with those blocks deleted**. Replace the
helper's return with a global capture of **every** block bearing the class:

```tsx
    const css = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n')
      .replace(/\s+/g, '');
    // HARDENED (SPEC §2.5): the old `css.split(`.${cls}{`)[1].split('}')[0]` returned the FIRST
    // rule bearing the class and stopped at the first `}` — blind to a hoisted `@container` block,
    // and it would have PASSED with those blocks deleted. Capture EVERY block instead.
    const blocks = Array.from(
      css.matchAll(new RegExp(`\\.${emotionClass}\\{([^}]*)\\}`, 'g')),
      (m) => m[1],
    );
    return blocks;
```

Update the two existing `TintChip` assertions to `expect(chipRule('…').join(';')).toContain(
'font-size:11px')` so they keep passing on the same evidence. Add a mutation guard: a fixture whose
`@container` block is deleted must now **fail**. Run
`npx vitest run src/app/pages/ticker/widgets/_kit/type-floor.spec.tsx` → exit 0 with the guard red
before the fix, green after.

**Step 2 — name the container.** `Widget.tsx:157` sets `containerType: 'inline-size'` with **no
`containerName`** — the only container declaration in the app. Adding the name is a **required edit,
not an assumption**: an unnamed `@container` resolves against the *nearest* container ancestor, so
phase 2's rails would answer the panel's question.

```tsx
        // Container-query context for the body: each widget styles its internals by its OWN width.
        // NAMED (SPEC §2.5): an unnamed `@container` resolves against the NEAREST container
        // ancestor, so a future nested rail would answer the panel's question. `FigureCell` queries
        // `theme.containerQueries('panel')` and must NEVER query an unnamed container.
        { containerType: 'inline-size', containerName: 'panel' },
```

**Step 3 — `PanelContainer`.** One small wrapper (or one exported `sx` fragment) so non-`Widget`
panels declare the same named context:

```tsx
/** The one exported way for a non-`Widget` panel to declare the SAME named container context. */
export const panelContainerSx = { containerType: 'inline-size', containerName: 'panel' } as const;

export function PanelContainer({ children, sx }: PanelContainerProps) {
  return <Box sx={[panelContainerSx, ...(Array.isArray(sx) ? sx : [sx])]}>{children}</Box>;
}
```

Export it from `shared/ui/index.ts` (unlike `arc.ts`, it carries no importer-set pin, so the barrel
does not blind a scan).

**Step 4 — the steps in `FigureCell`.** Query the **named** container:

```tsx
  fontSize: 20,
  [theme.containerQueries('panel').down(360)]: { fontSize: 17 },
  [theme.containerQueries('panel').down(280)]: { fontSize: 15 },
```

The **caption stays at 11px at every step — the floor, not below**. An absence literal is Sans at
the literal size and does **not** step further at 280px; it is not a figure.

**Step 5 — the other two `Widget` edits this phase owns.**

- `Widget.tsx:437` — delete the hardcoded `backgroundColor: 'rgba(0,0,0,0.6)'` from the Dialog
  backdrop `slotProps`; the `MuiBackdrop` override from FE-1 now supplies `scrim` to **every**
  overlay. Keep `backdropFilter: 'blur(4px)'`.
- `Widget.tsx:134` — `bodyVariant: 'inset'` fakes the well with `theme.palette.background.default`,
  which is `ink`, **not** `ink2`. Rebind to `extrasFor(theme).well`. One call site.

**Step 6 — AC-20a, honestly.** With the reader hardened, assert the emitted CSS declares 17px at
`(max-width: 360px)` and 15px at `(max-width: 280px)` against the **named** container off a 20px
base, and that no rule inside either block declares a font size below 11px. **If the hardening does
not land, AC-20a is recorded UNVERIFIABLE and dropped to `review` — never marked green.** jsdom
performs no layout and evaluates no container query: every element has zero dimensions, so
`getComputedStyle(figure).fontSize` returns the base declaration whatever the panel width. jsdom can
honestly assert the **declaration** only; the **rendered** step is AC-20b, browser-only (FE-10).

**Step 7.** `npx vitest run src/app/pages/ticker/widgets/_kit` → exit 0.
`npx vitest run src/app/shared/ui` → exit 0. `npm run typecheck` → exit 0. Commit.

**Reviewer probe:** delete the `@container` blocks from `FigureCell` — does `type-floor.spec.tsx`
now go red? (Before the hardening it would not have.)

---

## FE-7 — The six hover-only ⓘ affordances → the shipped `AccessibleHelp`

**Owns:** `apps/dashboard/src/app/pages/ticker/widgets/iv-rank/IvRank.tsx` ·
`.../market-context/MarketContext.tsx` · `.../straddle-move/StraddleMove.tsx` ·
`.../dealer-flow-projection/DealerFlowProjection.tsx` · their four colocated `*.spec.tsx`

**This is ruling 6's deliberate, recorded exception to the phase's scope discipline. Do not widen
it.** These four widgets hand-roll their own label/value markup, so the `FigureCell` state matrix
does **not** reach them by a primitive swap — and they do not need it: all four are **declared
static** (`IvRank.tsx:66-69`, `MarketContext.tsx:9-10`, `StraddleMove.tsx:3`) and bind
`typographyTokens.monoFontFamily` by hand, so register and liveness are already visually correct.
**Do not "fix" their mono figures — a static figure's correct render is no dot.** The composition
does not change; only the affordance does.

**Step 1 — the failing test.** In each widget's spec, assert the help control is reachable by role
and by keyboard:

```tsx
  it('the ⓘ is a real focusable control, not a hover-only icon', async () => {
    render(/* … */);
    const help = screen.getByRole('button', { name: /^About / });
    await userEvent.tab();
    expect(help).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
  });
```

**Step 2 — the swap, at exactly six sites.** `IvRank.tsx:91`, `IvRank.tsx:120`, `IvRank.tsx:229`,
`MarketContext.tsx:141`, `StraddleMove.tsx:93`, `DealerFlowProjection.tsx:77`. Each is a
non-focusable `InfoOutlinedIcon` wrapped in a hover `Tooltip`. Replace each with:

```tsx
import { AccessibleHelp } from '../ai-rec/AccessibleHelp';
// …
<AccessibleHelp label="About IV rank" text={IV_RANK_TIP} />
```

`AccessibleHelp` stays where it is (`pages/ticker/widgets/ai-rec/AccessibleHelp.tsx`) — a
sibling-**widget** import inside one page, which the repo's rule (pages never import sibling
**pages**) permits. It now has five consumers, so promoting it to `_kit/` is a phase-2 candidate;
moving it now would churn the ai-rec import for no behavioural gain. **A second focusable-help
pattern anywhere is a defect** (AC-35).

**Step 3 — the exemption list (AC-22c).** Add to `FigureCell.spec.tsx` (or a colocated
`lookalikes.spec.tsx`) a **stale-entry-checked** list naming the four widgets as *not*
register-enforced and *not* container-stepped, so the enforcement scan is scoped to the converted
widgets and cannot pass vacuously:

```ts
/** The four hand-rolled StatTile-family widgets. They are register- and liveness-correct BY
 *  ABSENCE (all four declared static, all four bind mono by hand), but they are NOT
 *  register-ENFORCED and NOT container-stepped. Their rebuild is a later phase. A listed path that
 *  no longer exists RED-BUILDS. */
const NOT_REGISTER_ENFORCED = [
  'pages/ticker/widgets/iv-rank/IvRank.tsx',
  'pages/ticker/widgets/market-context/MarketContext.tsx',
  'pages/ticker/widgets/straddle-move/StraddleMove.tsx',
  'pages/ticker/widgets/dealer-flow-projection/DealerFlowProjection.tsx',
];
```

plus a render assertion that all four are mono and dotless.

**Step 4.** `npx vitest run src/app/pages/ticker/widgets` → exit 0. `npm run typecheck` → exit 0.
Commit.

**Reviewer probe:** are there exactly six converted sites, and does any of the four widgets' figure
markup change?

---

## FE-8 — The v2 navigation

**Owns:** `apps/dashboard/src/app/shell/TopNav.tsx` · `apps/dashboard/src/app/shell/Footer.tsx` ·
new `apps/dashboard/src/app/shell/TopNav.spec.tsx`

**Step 1 — the failing nav spec** (AC-23, AC-23b, AC-23c): exactly four product links present
(`Scanner · Ticker · Positions · Alerts`); `Lab` and `Blog` **absent from the bar and the drawer**
and reachable from the footer; no `/_ops` route in the nav, the drawer, the footer or the sources;
**no clock and no bell**, and no live-toned chip or pulsing dot anywhere, in **both** signed-in and
signed-out states.

**Step 2 — `TopNav.tsx`.** Cut `Lab` and `Blog` from `NAV` (`TopNav.tsx:60-87`), leaving the four.
Add to `Footer.tsx` a `/lab` link beside the shipped `/blog` one.

Add the states from §4.3:

| # | State | Binding |
|---|---|---|
| N2 | Active link | primary label + a 2px amber underline **and `aria-current="page"`** — colour alone is not the state. (`aria-current` already ships at `TopNav.tsx:161`; keep it.) |
| N3 | Hover / focus | hover → primary; focus → the **one authored theme ring** (`theme.ts:82-92`), never a bespoke one |
| N4 | **< 900px** | links collapse behind the labelled burger (`aria-label="Open navigation menu"`, already at `:193`) opening a drawer whose links **unmount when closed**; wordmark, search affordance and session control stay in the bar |
| N5 | **< 1100px** | the `Jump to a ticker…` field becomes a search **icon button** with an accessible name; the ⌘K hint drops with the field and **the shortcut still works** |
| N6 | Signed out | `Log in` (ghost) + `Sign up` (primary pill). No avatar, no claim about saved state |
| N7 | Session chip | amber avatar with the account initial, `aria-label="Account settings"`. It is a **link to settings, not a status** |
| N8 | Session loading | the shipped non-blocking read; the bar renders regardless, never a blocking spinner |

N4/N5 use the FE-2 keys: `sx={{ display: { xs: 'none', md: 'flex' } }}` for the links (md = 900,
unchanged) and `{ xs: 'none', laptop: 'flex' }` for the search field with
`{ xs: 'inline-flex', laptop: 'none' }` for its icon-button form.

**Removed on purpose:** the nav clock (`design/src/lib.mjs:211` draws a `live`-toned chip with a
pulsing dot reading `Open 10:42:07 ET`) and the bell. On the ticker page the clock is a **second
pulsing liveness claim**; on Scanner and Positions it wears a live tone over no stream at all; and
it would need a keyframe in a phase that declares zero. If it returns later it returns as a
**neutral** chip with **no dot**, labelled as a *venue* clock.

**Step 3.** `npx vitest run src/app/shell` → exit 0. `npm run typecheck` → exit 0. Commit.

**Reviewer probe:** signed out, does the bar render any avatar or any claim about saved state?

---

## FE-9 — The ⌘K command palette

**Owns:** new `apps/dashboard/src/app/shell/CommandPalette/CommandPalette.tsx` ·
new `.../CommandPalette/commandTable.ts` · new `.../CommandPalette/usePaletteScan.ts` ·
new `.../CommandPalette/CommandPalette.spec.tsx` ·
new `.../CommandPalette/palette.flow.spec.tsx` · `apps/dashboard/src/app/shell/AppShell.tsx`

**Built on the MUI `Dialog` + list already in the tree. No new dependency.** The decider is
accessibility, not bundle size: this repo owns a measured patch wrapping
`ModalManager.prototype.add/remove` so `aria-hidden` never lands on a focused subtree
(`shared/a11y/modalFocusHandoff.ts`), paired with theme-level
`MuiModal.defaultProps.disableRestoreFocus` (`theme.ts:129-131`), installed once at `main.tsx:10`,
with a spec asserting **both** halves. A non-MUI modal (`cmdk` or any second modal system) routes
around both halves and reintroduces the defect class in the newest, most-used surface in the app,
with no spec covering it. The shortcut listener, roving focus and `aria-activedescendant` are
written here — the document-level `keydown` precedent is `AuthDialog.tsx:97`.

**Mounted once in `AppShell`**, so "one keystroke anywhere" holds on settings and alerts too. **Not
on `/`** — landing sits outside `AppShell`, and canon rule 19 scopes the palette to the shell.

**Step 1 — the command table** (AC-23b). A **static closed list** of trader routes plus symbol
results. `/_ops/metrics` and `/_ops/research` are **absent by construction**, enforced by a
membership test over the table **plus** a source scan asserting no `/_ops` literal in shell or
palette sources.

**Step 2 — the data flow.** A **one-shot `getScan()` read on open**, cached for the dialog's
lifetime. `useScan` stays the `/scanner` page's one data owner and only fetcher; the palette adds
**no poll and no ambient traffic**, and a palette result is a snapshot by nature.

`usePaletteScan.ts` follows the shipped precedent rather than re-deriving it —
`pages/scanner/useScan.ts:76-78` declares `phase: 'loading' | 'ready'` where `loading` means "the
FIRST read is still in flight" and is "**Never re-entered after the first resolution**":

```ts
/**
 * The palette's ONE-SHOT ranked read. Shaped after `pages/scanner/useScan.ts:76-78` — `loading`
 * means the FIRST read is still in flight and is NEVER re-entered: a later failed read DEGRADES,
 * it does not re-skeleton. `getScan()` rejects only on a transport fault (the server is
 * best-effort always-200), so a rejection is the AC-30 unavailable arm.
 */
export interface PaletteScan {
  phase: 'loading' | 'ready';
  rows: ScanRow[];
  sweep: SweepHeartbeat | null;
  unavailable: boolean;
}
```

**Step 3 — the states** (§4.4), each its own test arm:

- **P2a — the open→resolved window is a named state, not a gap.** The tracked-universe rows are
  **skeleton rows in their final shape** — no tier, no score, no status word, never a `0` and never
  a blank where a score goes. This is the **LOADING class** (canon rule 3), visibly distinct from
  AC-30's unavailable copy and from an empty list. Throughout the window the dialog stays
  **usable** — the input takes text, the four surface commands navigate, a typed symbol opens —
  because none of that depends on the ranked read. AC-29c asserts skeleton rows **present** before
  resolution, **absent** after, a navigation arm exercised **mid-flight**, and a post-resolution
  failure arm proving the loading form **does not return**.
- **AC-29** — tier and score render from the wire's **own closed status vocabulary** through a
  closed lookup, **never re-derived from the score**: `ok` → the score · `stale` → the score with
  its sweep age beside it · `building` → `—` · `error` → `unavailable`. Never a blank where a score
  goes, never a `0`.
- **AC-29b** — a score is **never rendered bare**: `sweep.sweep_last_completed` plus each row's own
  `as_of` are on the wire and are consumed unchanged. `sweep` is `null` only when the worker has
  never written one; the palette treats that as the **unavailable arm, not as "fresh"**.
- **P3** — results filter as a **prefix-then-substring match on the symbol**; the first row is
  pre-selected and `aria-activedescendant` points at it.
- **P4 (AC-31)** — one line, not a blank list: **`No tracked symbol matches "{query}".`** plus a
  single action **`Open {QUERY} anyway →`** when the query is a plausible ticker. It says *tracked*
  because "no results" means "not in the scanner universe", **not** "this ticker does not exist" —
  and it must be **visibly distinct** from AC-30's unavailable copy.
- **AC-31b** — **symbols only**, no company name anywhere: `apps/api/config/universe.json` is a
  bare symbol array and no name field exists on the ranked row, so `NVIDIA` beside `NVDA` would be a
  label with no vouched source.
- **AC-33b** — the footer helper row advertises exactly `↑↓ move` · `↵ open ticker` · `esc close`,
  and **no shortcut is advertised that the palette does not perform**. Test the negative: every
  advertised binding resolves to a performed action.
- **Read-only in phase 1.** No write binding, **no recents**. (Recents are deferred on scope, not
  cost — `convexa.recent-tickers.v1` already ships at `pages/ticker/recentTickers/store.ts:9`, so
  `[loss-free-durable-migration]` never fires. The real later cost is **module placement**: the
  shell may not import a sibling page, so that store must be promoted, the same move `TintChip`
  made. Recorded so a later phase does not over-price it.)

**Step 4 — the keyboard flow test** (AC-24, AC-25, AC-26, AC-27, AC-28, AC-33), mocking only the
network boundary:

- ⌘K / Ctrl-K from anywhere in the shell opens it; all **four** product surfaces are reachable
  without a mouse.
- **Escape** closes and returns focus to the invoker; nothing behind it changed.
- **Scrim click** gets its **own arm, not a reuse of the Escape one** — §2.6 hand-assembles this
  palette on the MUI `Dialog` with a document-level `keydown` listener written for this feature, so
  Escape and backdrop dismissal **share no guaranteed implementation path** and one passing is no
  evidence for the other (AC-26).
- The skip link is **still the first thing Tab reaches** on every route (AC-27) — extend
  `AppShell.keyboard.spec.tsx` rather than writing a second keyboard-floor test.
- Signed out, choosing a gated surface lands on the **same visible sign-in wall the nav link
  produces**, with the same onward free path — never a blank page, never a silent redirect (AC-28).
- Opening and dismissing while a form field holds unsaved text leaves that text **intact** (AC-33).

**Step 5 — mount it.** In `AppShell.tsx`, render `<CommandPalette />` after `<TopNav />` and before
`<main>`. It must not change the skip link's position as the first tab stop.

**Step 6.** `npx vitest run src/app/shell` → exit 0. `npm run typecheck` → exit 0. Commit.

**Reviewer probe:** with the ranked read still in flight, does a surface command still navigate? And
after a resolved read followed by a failed one, does the skeleton form come back? (It must not.)

---

## FE-10 — The browser layer: overflow sweep, one-chip-in-viewport, touch targets, the rendered step

**Owns:** `apps/dashboard-e2e/src/e2e/no-overflow.spec.ts` ·
new `apps/dashboard-e2e/src/e2e/curvature-v2.spec.ts` ·
`apps/dashboard-e2e/playwright.config.ts` (the `testMatch` allowlist) ·
`apps/dashboard-e2e/src/quality/compatibility.spec.ts` ·
`apps/dashboard-e2e/src/quality/accessibility.spec.ts` ·
`apps/dashboard-e2e/src/quality/visual.spec.ts` ·
`apps/dashboard-e2e/src/quality/fixtures/scenarios.ts`

**Trap first: `playwright.config.ts:30-36` is an explicit `testMatch` allowlist.** A new spec file
that is not added to it **never runs and reports green**. Add `'curvature-v2.spec.ts'` to the array
in the same commit that creates the file, and prove it with `--list`.

**Step 1 — amend `no-overflow.spec.ts`** (AC-38, AC-39, AC-40, AC-57):

- `WIDE_VIEWPORTS` (`:47-50`) gains `{ label: 'tablet 834', width: 834, height: 1112 }`; **900 is
  kept** per canon rule 17.
- `ROUTES` (`:390-408`) gains `/alerts` with its own named content anchor:
  `{ path: '/alerts', ready: async (p) => void (await expect(p.getByTestId('alerts-page')).toBeAttached()) }`.
  Confirm the testid on `pages/alerts/AlertsPage.tsx` and use the real one.
- **Every added width carries a vacuity guard** — a marker asserted attached before measuring; the
  suite's own idiom (`:795`, `:848`, `:870`).
- The drawer link assertion at `:887` iterates `['ticker', 'positions', 'scanner', 'blog']`. Amend
  to `['scanner', 'ticker', 'positions', 'alerts']` and add a negative arm: `nav-drawer-lab` and
  `nav-drawer-blog` have count 0.
- Degraded surfaces at 393 (AC-40): the sign-in wall, the cold-start failure banner and the **open
  palette** each fit without overflow.
- **Runtime is unpriced.** If the matrix exceeds budget the binding cut rule is **fewer routes at
  the added width, never fewer schemes at the narrow width**.

**Step 2 — `curvature-v2.spec.ts`**, four groups:

- **AC-1a — one chip in the viewport.** `toBeInViewport` at **both** scroll positions (hero visible,
  hero scrolled past), and no other page-level statement of stream state anywhere on the page; a
  `tape-stream-state` node must be **absent**. **Not** an attached-node count and **not** a
  visible-node count: `CommandDeck.tsx:226` renders the condensed bar as `{condensed && (…)}`, and
  when `condensed` is true the hero header is **still mounted and not `aria-hidden`**, merely
  scrolled out — and an out-of-viewport node passes `toBeVisible()` in both harnesses. **Both
  rejected counts red-build a correct implementation.**
- **AC-34 — coarse pointer at 393px**, measuring the **effective hit area in both dimensions** for
  every control this phase creates or touches, **listing every measured selector**: the palette
  dialog and its rows, the burger drawer, the four nav links, the connection chip if it becomes
  interactive, and `FigureCell`'s ⓘ. Any control this phase creates that is **not** a `button`,
  `[role="button"]` or `a` falls outside the theme's `@media (pointer: coarse)` selector floor
  (`theme.ts:97-102`) and **must carry its own explicit sizing** — the selector list is the
  mechanism, so a new element type silently escapes it.
- **AC-35 — hover fallback** at 393, 834, 900 and 1280: enumerate the hover-revealed controls per
  surface and prove each has a tap **and** a keyboard-focus path, including the six converted sites.
- **AC-20b — the rendered container step.** At **one fixed viewport width**, measure the computed
  font size of the same figure in a wide panel and in a narrow panel **on the same screen**; the
  narrower panel shows the smaller step, so the step follows the **panel**, not the window. **Honest
  fallback if two differently-sized panels cannot be produced without re-laying out a surface: drop
  to `review` with both measured sizes written into the build report — never to a jsdom row
  asserting style text.**

**Step 3 — re-point the four quality files** listed in FE-5 step 5 (they run under their own
configs: `playwright.compat.config.ts`, `playwright.a11y.config.ts`, `playwright.visual.config.ts`).

**Step 4 — run.** `reuseExistingServer: false` and the config starts its own dev server on 4200, so
free the ports first (both address families — a stale Vite on `[::1]:4200` once certified a previous
session's build):

```bash
cd /Users/rodrigoarias/dev/convexa
npm run ports:free
npx playwright install chromium
npx nx e2e dashboard-e2e; echo "e2e exit=$?"
npx playwright test -c apps/dashboard-e2e/playwright.config.ts --list | tail -5   # proves the new file is collected
```

Commit.

**Reviewer probe:** does the `--list` output actually contain `curvature-v2.spec.ts`? And does the
one-chip assertion use `toBeInViewport` rather than `toBeVisible`?

---

## FE-11 — Frontend closer: verification run, the build report, the per-screen review notes

**Owns:** `.spire/clusters/tech/contracts/curvature-v2-foundations/BUILD_REPORT.md` and the review
captures it references. **Implements no worker paths** — if a suite is red, report it; do not
re-implement FE-1…FE-10's files.

Run the full verification track below and record **exit codes**. Then write the build report, which
must carry — these are ruled deliverables, not nice-to-haves:

1. **The radius per-site list** (ruling 4 / AC-45b): every one of the 38 sites, with `file:line ·
   before px → after px · role or explicit px · why`, and **every site whose rendered radius
   actually changed** called out, so GATE Q reviews a list rather than re-deriving one. No test can
   catch a wrong per-site judgement — this list is the evidence.
2. **The spacing occurrence count** (AC-45c) beside the architect's unverified 86-across-35, with
   the named burn-down phase.
3. **The 44px carried debt** (AC-34b): every interactive control **outside** the narrowed set that
   fails the floor, itemized **with `file:line`** and a phase attached. *A sentence acknowledging
   debt exists is not sufficient.*
4. **`steel2` contrast, both schemes** (AC-42): the measured numbers on the panel surface. The dark
   floor is asserted; **the light floor is not stated in the canon** (§9 D-1) and stays pending an
   owner/UX ruling — record the measurement, do not invent the floor.
5. **AC-20a's status**: green (reader hardened) or **UNVERIFIABLE, dropped to `review`** — never
   marked green by another route.
6. **The banned-literals near-miss note** from FE-1 (three `rgba(138,155,180,0.3)` sites the
   exact-string mechanism does not see).
7. **Review notes** (`review` rows, no visual-diff gate is claimed for this feature): AC-13b (the
   Opportunity cell in both schemes) · AC-13c (a **greyscale capture** of the dealer-positioning
   strip) · AC-14 · AC-22a (ticker × two schemes) · AC-22b (**five screens × two schemes**, each
   naming the screen and scheme) · AC-12c (the six announcement sentences quoted as rendered) ·
   AC-43 · AC-45 · AC-49 · AC-50 (**five greyscale captures on one surface**).
8. **The three canon Amendments this phase owes**, filed at close, none blocking: rule 24 amended to
   the shipped **nine**; the one-line clarification that rule 13's `· last known` clause is
   **conditional** on a retained value existing; and the recorded reading that rule 18 is
   **chip-scoped**, so a conforming figure cell's per-figure dot under rule 13 is not "a second
   liveness claim".

---

# Verification track

Exact commands, exact expectations. **Check exit codes, not printed summaries.** Counts are verified
directly under vitest, never read off the Nx summary — an exit 0 with zero tests collected renders
identically in Nx's output.

| # | Command (cwd) | Expected | AC |
|---|---|---|---|
| V1 | `cd apps/dashboard && npx vitest run src/app/shared/theme; echo $?` | exit **0**; **≥ 14 files** (baseline 10 + token-parity, banned-literals, scales, radius-scale, spacing-ladder) and **> 75 tests** | AC-41, AC-44, AC-45b, AC-45c, AC-54, AC-56 |
| V2 | `cd apps/dashboard && npx vitest run src/app/shared/ui/arc.spec.ts; echo $?` | exit **0**; **1 file / 9 tests**, **file unamended** (`git diff --quiet -- apps/dashboard/src/app/shared/ui/arc.spec.ts`) | AC-53 |
| V3 | `cd apps/dashboard && npx vitest run src/app/pages/ticker/widgets/_kit; echo $?` | exit **0**; **≥ 5 files / ≥ 30 tests** (`StatTile.spec.tsx` gone, `FigureCell.spec.tsx` in its place) | AC-13a, AC-15…AC-20a, AC-46, AC-50b |
| V4 | `cd apps/dashboard && npx vitest run src/app/features/trading/positions/tint.spec.tsx; echo $?` | exit **0**; **1 file / 13 tests** — ruling #18's scope is untouched | §8 |
| V5 | `cd apps/dashboard && npx vitest run src/app/pages/ticker/connection; echo $?` | exit **0**; the six-kind enumeration, the two-file importer set-equality, AC-7b's latch-retention arms | AC-1b…AC-12b |
| V6 | `cd apps/dashboard && npx vitest run src/app/shell; echo $?` | exit **0**; nav + palette + the extended keyboard floor | AC-23…AC-33b |
| V7 | `npx nx test @convexa/dashboard; echo $?` | exit **0**, whole suite — **at or above** the 2026-09-03 baseline of **127 tests / 17 files** for the enforcement set | AC-56 |
| V8 | `npm run typecheck; echo $?` | exit **0**, clean across every TS project. **Recorded separately** — Vitest transpiles without typechecking, and this is the only thing that sees the `extrasLight` parity guarantee and a `SweepHeartbeat` rename | AC-41, AC-56 |
| V9 | `npm run ports:free && npx playwright install chromium && npx nx e2e dashboard-e2e; echo $?` | exit **0**; **not run at baseline by design** (needs a served app) — this is its first run for the feature, and GATE Q re-runs it independently | AC-1a, AC-20b, AC-32, AC-34…AC-40 |
| V10 | `npx playwright test -c apps/dashboard-e2e/playwright.config.ts --list \| grep -c curvature-v2` | **≥ 1** — proves the new spec is actually collected by the `testMatch` allowlist | AC-1a |
| V11 | `git diff --name-only $(git merge-base main HEAD)..HEAD -- apps/api \| wc -l` | **0**, and the observed file count reported | AC-51 |
| V12 | `node .claude/tools/interface_conformance.mjs --contract .spire/.../INTERFACE_CONTRACT.md --url http://localhost:8000 --report .spire/.../conformance-receipt.json; echo $?` | exit **0**, `2 endpoint(s)`; **or** `NOT RUN — no reachable backend, NO_BACKEND_CHANGE exemption` recorded honestly | §6 |
| V13 | `npm run lint; echo $?` and `npm run format:check -- --files <changed>` | exit **0** both | house |

**Mutation proofs, run and recorded** (`[structural-over-prose-enforcement]` — poison the thing the
rule forbids and the build must go red, and each poison test proven non-vacuous):

| Proof | Poison | Must |
|---|---|---|
| AC-7 | add a seventh `kind` to `ConnectionState` | `npm run typecheck` fails at the exhaustive switch |
| AC-13a | re-add an `accent` prop, or a `StatTile` import | `FigureCell.spec.tsx` scan red |
| AC-19 | pass a non-member string to the literal branch | it does **not** classify as a literal |
| AC-44 | paste a token value into a component | `banned-literals.spec.ts` red |
| AC-54 | a second declaration site of `liveDotPulse`; a keyframe outside the class; a predicate violation (a data-signal keyframe that runs with no live stream, or that ignores `prefers-reduced-motion`) | `single-motion-moment.spec.ts` red |
| AC-20a | delete the `@container` blocks from `FigureCell` | hardened `type-floor.spec.tsx` red (the **old** reader would have passed) |
| AC-57 | remove `FigureCell.tsx` from `HOVER_CENSUS_FILES`' target, or leave a stale exemption path | the self-check red |

---

## Independence

Lane is `backend` or `frontend` only. All rows `Independent: no` — this is the honest **cannot
split** signal, not a missing table. Two independent grounds, both measured:

1. **Pervasive write-path overlap.** FE-3's radius sweep writes 31 files spanning `pages/`,
   `features/`, `shared/ui/`, `shared/charts/` and `shared/theme/` — including
   `_kit/StatTile.tsx:47` (deleted by FE-4) and `shared/ui/Widget/Widget.tsx` (edited by FE-6). FE-1
   is a hard prerequisite for every binding below it. Any two-way split that keeps FE-3 and FE-1 out
   of the parallel set still collides on `Widget.tsx`, `MarketContext.tsx` and
   `DealerFlowProjection.tsx` (FE-6 vs FE-7) and on `AppShell.tsx` (FE-8 vs FE-9).
2. **PLAN_METHOD's frontend rule.** `yes` requires SPEC **§4** to name the files a task owns. §4's
   only file citations are `StatTile.tsx:180-183`, `_kit/copy.ts`, `ai-rec/AccessibleHelp.tsx:8-12`,
   `_kit/copy.spec.ts:54`, `sessionTapeStanding.ts`, `design/src/lib.mjs:211`,
   `design/src/components/chip.mjs` and `apps/api/config/universe.json`. It does **not** name
   `tokens.ts`, `theme.ts`, the 38 radius sites, the new connection module, `TopNav.tsx`,
   `AppShell.tsx` or the palette's files. Where §4 does not name the files, the row is `no`.

| Task | Lane | Paths | Depends on | Independent |
|---|---|---|---|---|
| BE-1 | backend | `.spire/clusters/tech/contracts/curvature-v2-foundations/conformance-receipt.json` | — | no |
| FE-1 | frontend | `apps/dashboard/src/app/shared/theme/tokens.ts`, `apps/dashboard/src/app/shared/theme/theme.ts`, `apps/dashboard/src/app/shared/theme/token-parity.spec.ts`, `apps/dashboard/src/app/shared/theme/banned-literals.spec.ts` | — | no |
| FE-2 | frontend | `apps/dashboard/src/app/shared/theme/theme.ts`, `apps/dashboard/src/app/shared/theme/scales.spec.ts`, `apps/dashboard/src/app/shared/theme/mui.d.ts` | FE-1 | no |
| FE-3 | frontend | `apps/dashboard/src/app/shared/theme/tokens.ts`, `apps/dashboard/src/app/shared/theme/theme.ts`, `apps/dashboard/src/app/shared/theme/radius-scale.spec.ts`, `apps/dashboard/src/app/shared/theme/spacing-ladder.spec.ts`, `apps/dashboard/src/app/pages/**`, `apps/dashboard/src/app/features/**`, `apps/dashboard/src/app/shared/ui/**`, `apps/dashboard/src/app/shared/charts/**` | FE-2 | no |
| FE-4 | frontend | `apps/dashboard/src/app/shared/copy/notANumber.ts`, `apps/dashboard/src/app/pages/ticker/widgets/_kit/**`, `apps/dashboard/src/app/pages/ticker/widgets/live-tape/LiveTape.tsx`, `apps/dashboard/src/app/pages/ticker/widgets/dealer-positioning/DealerPositioning.tsx`, `apps/dashboard/src/app/shared/theme/stage3-amber.spec.ts`, `apps/dashboard/src/app/features/trading/positions/labels.ts`, `apps/dashboard/src/app/features/trading/positions/view.ts`, `apps/dashboard/src/app/features/trading/broker/brokerView.ts` | FE-3 | no |
| FE-5 | frontend | `apps/dashboard/src/app/pages/ticker/connection/**`, `apps/dashboard/src/app/pages/ticker/widgets/chrome/**`, `apps/dashboard/src/app/shared/theme/single-motion-moment.spec.ts` | FE-4 | no |
| FE-6 | frontend | `apps/dashboard/src/app/shared/ui/Widget/Widget.tsx`, `apps/dashboard/src/app/shared/ui/PanelContainer.tsx`, `apps/dashboard/src/app/shared/ui/index.ts`, `apps/dashboard/src/app/pages/ticker/widgets/_kit/type-floor.spec.tsx`, `apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.tsx`, `apps/dashboard/src/app/pages/ticker/widgets/market-context/MarketContext.tsx`, `apps/dashboard/src/app/pages/ticker/widgets/dealer-flow-projection/DealerFlowProjection.tsx` | FE-4 | no |
| FE-7 | frontend | `apps/dashboard/src/app/pages/ticker/widgets/iv-rank/**`, `apps/dashboard/src/app/pages/ticker/widgets/market-context/**`, `apps/dashboard/src/app/pages/ticker/widgets/straddle-move/**`, `apps/dashboard/src/app/pages/ticker/widgets/dealer-flow-projection/**` | FE-6 | no |
| FE-8 | frontend | `apps/dashboard/src/app/shell/TopNav.tsx`, `apps/dashboard/src/app/shell/TopNav.spec.tsx`, `apps/dashboard/src/app/shell/Footer.tsx` | FE-2 | no |
| FE-9 | frontend | `apps/dashboard/src/app/shell/CommandPalette/**`, `apps/dashboard/src/app/shell/AppShell.tsx`, `apps/dashboard/src/app/shell/AppShell.keyboard.spec.tsx` | FE-8 | no |
| FE-10 | frontend | `apps/dashboard-e2e/**` | FE-9 | no |
| FE-11 | frontend | `.spire/clusters/tech/contracts/curvature-v2-foundations/BUILD_REPORT.md` | FE-1, FE-2, FE-3, FE-4, FE-5, FE-6, FE-7, FE-8, FE-9, FE-10 | no |

**Closers.** Backend: **BE-1** (serve + `conformance-receipt.json` only; it re-implements no worker
paths — there are none). Frontend: **FE-11** (leftover verification, report and visual/review states
only; it implements no worker paths).

---

## Unresolved / flag at review

**U-1 — `scrim` is not same-in-both-schemes after all.** SPEC §2.1 seeds the
`SAME_IN_BOTH_SCHEMES` exemption list with `scrim`, reasoning that "an overlay dim is a neutral
black alpha … so one value is correct in both schemes and a *difference* there would be the
defect." The verified mirror the canon points at gives **two distinct values** —
`design/tokens/tokens.json` dark `rgba(0,0,0,0.55)` / light `rgba(23,32,43,0.45)`. Not a blocking
contradiction: §2.1 calls the seed "one plausible member" and makes adding to the list "a reviewed
act", and shipping the list **empty** satisfies AC-41 strictly more than shipping it seeded. The
plan lands the mirror's values with an empty list and a comment. **Flag for the owner** only if the
neutral-black reasoning is meant to override the mirror — in which case the mirror needs the
correction, not `tokens.ts`.

**U-2 — the `tape-stream-state` pin set is five files, not one.** SPEC §2.4 and AC-57 name
`compatibility.spec.ts:48`. The measured set is six assertions across five files (FE-5 step 5). The
plan re-points all of them, which is *more* work than the spec's example, not less — no requirement
is weakened. Recorded so GATE Q does not read the extra edits as scope creep.

**U-3 — `NotANumber`'s module.** §2.3 requires `NO_BASIS_LABEL` / `NOT_PROVIDED` / `NOT_RECORDED`
(all in `features/trading/`) to re-point at the union, while placing `FigureCell` in
`pages/ticker/widgets/_kit/`. A `features/` → `pages/` import inverts the repo's binding dependency
direction. Resolved without weakening the spec by putting the **union** (never named a module by
§2.3) in `shared/copy/notANumber.ts`, where its three day-one consumers already justify it under the
repo's own "populate `shared/` on the 2nd consumer" rule. Flagged so a reviewer sees the reasoning
rather than re-deriving it.

**U-4 — AC-42's light-mode contrast floor is still unruled** (§9 D-1). The plan measures and records
both schemes and asserts only the **dark** floor. This does not block the build; it blocks
*asserting* the light one.

**U-5 — the `tooltip` z-index rung is undeclared** (§9-2). FE-2 lands §2.2's working mapping
(`tooltip: 60`, above toast) so `mobileStepper`/`fab`/`speedDial` no longer float above the ladder.
The rung itself remains an **Amendments-shaped gap for the owner, not a build decision**.
