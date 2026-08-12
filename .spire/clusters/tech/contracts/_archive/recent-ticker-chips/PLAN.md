# recent-ticker-chips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/ticker/*`, under the Command Deck control strip, render a quiet **QUICK** chip row
(closed pins SPY · QQQ · NVDA + durable client-local recents ≤8) so operators jump symbols without
retyping — same navigation as submitting the ticker field.

**Architecture:** Pure client-local store (`pages/ticker/recentTickers/store.ts`) owns pins + recents
(localStorage key `convexa.recent-tickers.v1`). Presentational `QuickSymbols` mounts **inside**
`CommandDeck` under `TickerToolbar`. `TickerDashboard` records visits on route-param change and
handles chip → `setSymbol` + `navigate`. Sticky condensed bar, TopNav, widgets, and `apps/api` are
untouched.

**Tech Stack:** React 19 · MUI v9 · TypeScript · Vitest 4 + Testing Library · Nx 23.
`apps/dashboard` only (`NO_BACKEND_CHANGE`).

---

## Track map

| Track | Tasks |
|---|---|
| **Backend** (`apps/api`) | **none — empty by design** (B1 proof only) |
| **Frontend** (`apps/dashboard`) | F1 → F2 → F3 → F4 → F5 (strict order; store before UI) |
| **Verification** | V1 … V4 after F5 |

**Parallelism:** Backend track is a no-op (proof command only) and may run anytime. Frontend is
strictly ordered. Verification runs after frontend lands.

---

## Global Constraints

Every task's requirements implicitly include this section.

**Standing project constraints (`Claude.md` / `Agents.md` — each has bitten this repo before):**

- **`nx typecheck` is mandatory before any green claim.** A green `nx test` does **not** mean the types
  are sound (Vitest transpiles without typechecking). Bitten three times.
- **Check EXIT CODES, not printed summaries**, and never through a pipe that masks them.
  PowerShell: `$LASTEXITCODE` after every gate command.
- **`nx format:write` must ALWAYS be scoped with `--files=`.** One bare run reformatted 92 unrelated
  files. Prefer Prettier scoped to the files you touched.
- **Never write a literal NUL byte** (makes a file binary to git and grep).
- **Do not touch** `apps/api/**`, TopNav, sticky condensed bar contents, widgets, scoring paths.

**Baselines (FE-only; do not regress feature-scoped suite):**

| Suite | Expectation |
|---|---|
| Feature-scoped Vitest (commands in V1) | all named files exit 0 |
| `npx nx typecheck @convexa/dashboard` | exit 0 |
| `git diff -- apps/api` (vs branch base / empty tree of api changes) | **empty** |
| Hex discipline (`hex-discipline.spec.ts` + `banned-hexes.spec.ts`) | exit 0 |

**Feature-specific hard rules (SPEC AC-1…AC-8 + WIREFRAME APPROVED 2026-08-11):**

- **Pins closed and fixed order:** `SPY`, `QQQ`, `NVDA` — always render; never driven by recents emptiness.
- **Recents:** durable client-local; de-duped against pins; **cap ≤8** beyond pins; most-recent-first.
- **Durable key:** `convexa.recent-tickers.v1` (new key — **no** brand migration / no `resolveDurable`
  required). Corrupt/unreadable blob → empty in-memory recents **without** deleting the original key
  until a successful write of a valid shape (same degrade pattern as personas/`localPrefs`).
- **Placement:** Quick row **inside** `CommandDeck` card, **below** TickerToolbar. **Not** on sticky
  condensed bar. **Not** in TopNav.
- **Copy:** micro-label `QUICK` (same caption pattern as toolbar segment labels).
- **Selected chip** = current **route** symbol (not the uncommitted input field); theme tokens only —
  prefer `primary` / `divider` / `action.selected` outline/fill; **no** success/error green/red; **zero**
  hardcoded hex.
- **`[absent-is-not-none]`:** empty/corrupt recents still show pins — never a blank Quick row, never an
  error claiming “no symbols.”
- **`recordVisit`** on successful navigation to a ticker symbol (route param change on `/ticker/*`).
- **`[additive-keeps-score-byte-identical]`** by construction (nav chrome only).

**Interface contract posture — copied from `INTERFACE_CONTRACT.md` (no `## Conformance spec` JSON
block exists for this feature; both lanes inherit this binding shape):**

```
## Posture: `NO_BACKEND_CHANGE` — the `apps/api` diff must be EMPTY

This feature is **frontend navigation chrome only**. It introduces **no new endpoint, no new
payload field, no changed field name, no changed presence semantics, and no new query parameter.**

The FE uses only surfaces that already exist:
- Client routing to `/ticker/:symbol` (same as submitting the ticker input).
- Optional durable **client-local** recents list (`localStorage` via `resolveDurable`) — never a
  server preference and never a scoring input.

`additive-keeps-score-byte-identical` holds by construction: chips cannot reach `signals` / score /
tier / `state_fingerprint`, and the backend cannot observe this feature shipped.
```

> Note for implementers: the contract text mentions `resolveDurable` as the durable pattern family.
> This feature introduces a **new** key only; call `localStorage` directly under
> `convexa.recent-tickers.v1`. If a future rename lands, wrap with `resolveDurable(new, old)` then.

---

## Backend track

### B1 — No backend tasks (proof only)

**Files:** none under `apps/api/`.

- [ ] **Step 1: Confirm empty tree intent**

No endpoint, no payload field, no query param, no scoring touch. Do not open or edit any file under
`apps/api/`.

- [ ] **Step 2: Proof command (run at end of FE work and at verification)**

```powershell
git status --short apps/api
git diff --stat apps/api
git diff --name-only HEAD -- apps/api
```

**Expected:** empty output for all three (no staged/unstaged/committed-on-branch api files from this
feature). If any path appears, STOP and revert — do not ship.

**Commit:** none for backend.

---

## Frontend track

### F1 — Recents store (pure unit, TDD)

**Files:**
- Create: `apps/dashboard/src/app/pages/ticker/recentTickers/store.ts`
- Create: `apps/dashboard/src/app/pages/ticker/recentTickers/store.spec.ts`

**Why this location:** single-page consumer (ticker only) → stays under `pages/ticker/` per
`apps/dashboard/src/app/README.md` (do **not** pre-populate `shared/` or invent `features/recentTickers`).

- [ ] **Step 1: Write the failing store tests**

Create `store.spec.ts`:

```ts
/**
 * recentTickers store — pure unit (AC-2, AC-5, AC-6).
 * Durable key: convexa.recent-tickers.v1. Pins closed. Recents ≤8, de-duped vs pins.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PINNED_TICKERS,
  MAX_RECENTS,
  RECENT_TICKERS_KEY,
  listRecents,
  recordVisit,
  __resetRecentTickers,
} from './store';

beforeEach(() => {
  localStorage.clear();
  __resetRecentTickers();
});
afterEach(() => {
  localStorage.clear();
  __resetRecentTickers();
});

describe('recentTickers store', () => {
  it('pins are closed SPY · QQQ · NVDA in fixed order', () => {
    expect(PINNED_TICKERS).toEqual(['SPY', 'QQQ', 'NVDA']);
  });

  it('empty storage → listRecents() is [] (pins still exist separately)', () => {
    expect(listRecents()).toEqual([]);
  });

  it('recordVisit uppercases, MRU-front, de-dupes self', () => {
    recordVisit('aapl');
    recordVisit('meta');
    recordVisit('aapl');
    expect(listRecents()).toEqual(['AAPL', 'META']);
  });

  it('recordVisit of a pin does NOT appear in recents', () => {
    recordVisit('SPY');
    recordVisit('qqq');
    recordVisit('IWM');
    expect(listRecents()).toEqual(['IWM']);
  });

  it('caps recents at MAX_RECENTS (8) beyond pins', () => {
    expect(MAX_RECENTS).toBe(8);
    const syms = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'];
    for (const s of syms) recordVisit(s);
    const r = listRecents();
    expect(r).toHaveLength(8);
    expect(r[0]).toBe('A9'); // most recent first
    expect(r).not.toContain('A1'); // oldest dropped
  });

  it('survives reload (re-hydrate from localStorage)', () => {
    recordVisit('IWM');
    recordVisit('AMD');
    __resetRecentTickers(); // drop memory; force re-read
    expect(listRecents()).toEqual(['AMD', 'IWM']);
    expect(localStorage.getItem(RECENT_TICKERS_KEY)).toBeTruthy();
  });

  it('corrupt blob → empty recents, does not throw, leaves original key intact until write', () => {
    localStorage.setItem(RECENT_TICKERS_KEY, '{not-json');
    __resetRecentTickers();
    expect(() => listRecents()).not.toThrow();
    expect(listRecents()).toEqual([]);
    // original corrupt blob still present (absent-is-not-none / loss-free degrade)
    expect(localStorage.getItem(RECENT_TICKERS_KEY)).toBe('{not-json');
  });

  it('ignores blank / whitespace visits', () => {
    recordVisit('  ');
    recordVisit('');
    expect(listRecents()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```powershell
npx nx test @convexa/dashboard -- --run src/app/pages/ticker/recentTickers/store.spec.ts
```

**Expected:** fail (module not found / missing exports). Exit non-zero. `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Implement the store minimally**

Create `store.ts`:

```ts
/**
 * Client-local recent tickers for the Command Deck Quick row (recent-ticker-chips).
 *
 * Durable key: `convexa.recent-tickers.v1` (new — no brand migration).
 * Pins are a closed code constant (not stored). Recents are MRU, de-duped vs pins, capped at 8.
 * Corrupt/unreadable → empty in-memory; original blob left intact until a successful write.
 * Never throws into the UI. Never a scoring input.
 */
const KEY = 'convexa.recent-tickers.v1';
const SCHEMA_VERSION = 1;
export const MAX_RECENTS = 8;
export const PINNED_TICKERS = ['SPY', 'QQQ', 'NVDA'] as const;
export type PinnedTicker = (typeof PINNED_TICKERS)[number];

interface PersistShape {
  schema_version: number;
  /** Uppercase symbols, most-recent-first, never includes a pin. */
  symbols: string[];
}

const empty = (): PersistShape => ({
  schema_version: SCHEMA_VERSION,
  symbols: [],
});

const PIN_SET = new Set<string>(PINNED_TICKERS);

let memory: PersistShape | null = null;

function normalize(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function read(): PersistShape {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      memory = empty();
      return memory;
    }
    const parsed = JSON.parse(raw) as Partial<PersistShape>;
    const symbols = Array.isArray(parsed.symbols)
      ? parsed.symbols
          .filter((s): s is string => typeof s === 'string')
          .map(normalize)
          .filter((s) => s && !PIN_SET.has(s))
      : [];
    // de-dupe preserving order
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const s of symbols) {
      if (seen.has(s)) continue;
      seen.add(s);
      deduped.push(s);
    }
    memory = {
      schema_version: SCHEMA_VERSION,
      symbols: deduped.slice(0, MAX_RECENTS),
    };
  } catch {
    // Corrupt → empty in memory; do NOT removeItem (leave original blob).
    memory = empty();
  }
  return memory;
}

function write(s: PersistShape) {
  memory = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* in-memory only (quota / private mode) */
  }
}

/** Recents only (no pins). Most-recent-first. */
export function listRecents(): string[] {
  return [...read().symbols];
}

/**
 * Record a successful navigation to `symbol`. Pins are never stored in recents.
 * Blank → no-op. Self-de-dupes to front. Caps at MAX_RECENTS.
 */
export function recordVisit(symbol: string): void {
  const s = normalize(symbol);
  if (!s || PIN_SET.has(s)) return;
  const prev = read().symbols.filter((x) => x !== s);
  write({
    schema_version: SCHEMA_VERSION,
    symbols: [s, ...prev].slice(0, MAX_RECENTS),
  });
}

/** Test seam — drop in-memory cache so the next read re-hydrates from localStorage. */
export function __resetRecentTickers(): void {
  memory = null;
}

export const RECENT_TICKERS_KEY = KEY;
```

- [ ] **Step 4: Run tests — expect PASS**

```powershell
npx nx test @convexa/dashboard -- --run src/app/pages/ticker/recentTickers/store.spec.ts
```

**Expected:** all tests pass, exit 0.

- [ ] **Step 5: Commit**

```powershell
git add apps/dashboard/src/app/pages/ticker/recentTickers/store.ts apps/dashboard/src/app/pages/ticker/recentTickers/store.spec.ts
git commit -m "feat(dashboard): recent-tickers durable store (pins + capped recents)"
```

**Reviewer probe:** corrupt blob must not call `removeItem`; pin visits must never enter `symbols`.

---

### F2 — `QuickSymbols` presentational row (TDD)

**Files:**
- Create: `apps/dashboard/src/app/pages/ticker/widgets/chrome/QuickSymbols.tsx`
- Create: `apps/dashboard/src/app/pages/ticker/widgets/chrome/QuickSymbols.spec.tsx`

- [ ] **Step 1: Write the failing widget tests**

```tsx
/**
 * QuickSymbols — Command Deck Quick row (AC-1, AC-2, AC-4, AC-6, AC-8).
 */
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetRecentTickers, recordVisit } from '../../recentTickers/store';
import { QuickSymbols } from './QuickSymbols';

function renderQuick(props: Partial<React.ComponentProps<typeof QuickSymbols>> = {}) {
  const onSelect = props.onSelect ?? vi.fn();
  return {
    onSelect,
    ...render(
      <ThemeProvider theme={theme}>
        <QuickSymbols currentSymbol={props.currentSymbol ?? 'TSLA'} onSelect={onSelect} />
      </ThemeProvider>,
    ),
  };
}

beforeEach(() => {
  localStorage.clear();
  __resetRecentTickers();
});

describe('QuickSymbols', () => {
  it('renders QUICK label + closed pins SPY QQQ NVDA even when recents empty (AC-1, AC-2, AC-6)', () => {
    renderQuick();
    const row = screen.getByTestId('quick-symbols');
    expect(within(row).getByText('QUICK')).toBeInTheDocument();
    // pins in order
    const chips = within(row).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['SPY', 'QQQ', 'NVDA']);
    // never an error / "no symbols" claim
    expect(row.textContent).not.toMatch(/no symbols/i);
  });

  it('appends recents after pins, de-duped (AC-5)', () => {
    recordVisit('IWM');
    recordVisit('AMD');
    renderQuick();
    const chips = within(screen.getByTestId('quick-symbols')).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['SPY', 'QQQ', 'NVDA', 'AMD', 'IWM']);
  });

  it('marks the current route symbol selected (AC-4)', () => {
    renderQuick({ currentSymbol: 'qqq' });
    const qqq = screen.getByRole('button', { name: 'QQQ' });
    expect(qqq).toHaveAttribute('aria-pressed', 'true');
    const spy = screen.getByRole('button', { name: 'SPY' });
    expect(spy).toHaveAttribute('aria-pressed', 'false');
  });

  it('click calls onSelect with uppercase symbol (AC-3)', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderQuick();
    await user.click(screen.getByRole('button', { name: 'SPY' }));
    expect(onSelect).toHaveBeenCalledWith('SPY');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```powershell
npx nx test @convexa/dashboard -- --run src/app/pages/ticker/widgets/chrome/QuickSymbols.spec.tsx
```

- [ ] **Step 3: Implement `QuickSymbols.tsx`**

```tsx
/**
 * QuickSymbols — quiet chip row under the Command Deck control strip (recent-ticker-chips).
 *
 * Layout (owner-approved wireframe): micro-label QUICK + pins (always) + optional recents.
 * Selected = current **route** symbol. Theme tokens only — no hex, no P/L green/red.
 */
import { typographyTokens } from '@/shared/theme/tokens';
import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { listRecents, PINNED_TICKERS } from '../../recentTickers/store';

const MONO = typographyTokens.monoFontFamily;

export interface QuickSymbolsProps {
  /** Route symbol (not the uncommitted input). Compared case-insensitively. */
  currentSymbol: string;
  onSelect: (symbol: string) => void;
}

export function QuickSymbols({ currentSymbol, onSelect }: QuickSymbolsProps) {
  const current = currentSymbol.trim().toUpperCase();
  const recents = listRecents();
  const pins = [...PINNED_TICKERS];

  return (
    <Box
      data-testid="quick-symbols"
      sx={(t) => ({
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.25,
        pt: 1.25,
        mt: 0.25,
        borderTop: `1px solid ${t.palette.divider}`,
        minWidth: 0,
      })}
    >
      <Typography
        component="span"
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          pt: 0.75,
          flexShrink: 0,
        }}
      >
        QUICK
      </Typography>

      <Stack
        direction="row"
        useFlexGap
        spacing={0.75}
        sx={{
          flexWrap: 'wrap',
          minWidth: 0,
          // Narrow widths: wrap (wireframe). Horizontal scroll is acceptable if wrap is awkward —
          // prefer wrap first.
          rowGap: 0.75,
        }}
      >
        {pins.map((sym) => (
          <QuickChip
            key={`pin-${sym}`}
            symbol={sym}
            selected={sym === current}
            onSelect={onSelect}
          />
        ))}

        {recents.length > 0 && (
          <Box
            aria-hidden
            sx={(t) => ({
              alignSelf: 'center',
              width: 1,
              height: 16,
              bgcolor: t.palette.divider,
              mx: 0.25,
              flexShrink: 0,
            })}
          />
        )}

        {recents.map((sym) => (
          <QuickChip
            key={`recent-${sym}`}
            symbol={sym}
            selected={sym === current}
            onSelect={onSelect}
          />
        ))}
      </Stack>
    </Box>
  );
}

function QuickChip({
  symbol,
  selected,
  onSelect,
}: {
  symbol: string;
  selected: boolean;
  onSelect: (s: string) => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={selected}
      aria-label={symbol}
      onClick={() => onSelect(symbol)}
      sx={(t) => ({
        appearance: 'none',
        cursor: 'pointer',
        m: 0,
        px: 1.25,
        py: 0.5,
        borderRadius: '999px',
        border: `1px solid ${selected ? t.palette.primary.main : t.palette.divider}`,
        // Quiet selected surface via primary alpha — never success/error green/red.
        bgcolor: selected ? alpha(t.palette.primary.main, 0.14) : 'transparent',
        color: selected ? t.palette.primary.main : t.palette.text.primary,
        fontFamily: MONO,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.04em',
        lineHeight: 1.2,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        '&:hover': selected
          ? undefined
          : {
              bgcolor: alpha(t.palette.action.selected, 0.5),
              borderColor: t.palette.text.secondary,
            },
      })}
    >
      {symbol}
    </Box>
  );
}

export default QuickSymbols;
```

No `#…` literals. Selected uses `primary` + `divider` only.

- [ ] **Step 4: Run — expect PASS**

```powershell
npx nx test @convexa/dashboard -- --run src/app/pages/ticker/widgets/chrome/QuickSymbols.spec.tsx src/app/pages/ticker/recentTickers/store.spec.ts
```

- [ ] **Step 5: Commit**

```powershell
git add apps/dashboard/src/app/pages/ticker/widgets/chrome/QuickSymbols.tsx apps/dashboard/src/app/pages/ticker/widgets/chrome/QuickSymbols.spec.tsx
git commit -m "feat(dashboard): QuickSymbols chip row (pins + recents)"
```

**Reviewer probe:** selected uses `primary` / `divider` only; no `success.` / `error.`; no hex.

---

### F3 — Mount Quick row in `CommandDeck` (not sticky)

**Files:**
- Modify: `apps/dashboard/src/app/pages/ticker/widgets/chrome/CommandDeck.tsx`
- Modify: `apps/dashboard/src/app/pages/ticker/widgets/chrome/index.ts` (export if useful)
- Create or extend: `apps/dashboard/src/app/pages/ticker/widgets/chrome/CommandDeck.spec.tsx`
  (additive describe only — do not weaken existing sticky / connectionChip tests)

- [ ] **Step 1: Failing deck integration assertions**

Append to `CommandDeck.spec.tsx` (or a sibling `CommandDeck.quick.spec.tsx` that reuses the same
Harness pattern from the existing file):

```tsx
describe('CommandDeck — Quick symbols row (recent-ticker-chips)', () => {
  it('renders quick-symbols BELOW the toolbar inside command-deck (AC-1)', () => {
    installIntersectionObserver(); // if using sticky helpers; else omit
    renderDeck({ symbol: 'TSLA' });
    const deck = screen.getByTestId('command-deck');
    const quick = within(deck).getByTestId('quick-symbols');
    const toolbar = within(deck).getByTestId('ticker-toolbar');
    // DOM order: toolbar then quick
    expect(
      toolbar.compareDocumentPosition(quick) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('sticky condensed bar has NO quick chips (AC-7)', () => {
    installIntersectionObserver();
    renderDeck({ live: liveUpdate({ live: true, mid: 416.5 }), isLive: true });
    setDeckVisible(false);
    const sticky = screen.getByTestId('deck-sticky');
    expect(within(sticky).queryByTestId('quick-symbols')).toBeNull();
    expect(within(sticky).queryByText('QUICK')).toBeNull();
  });
});
```

Wire the new props into the existing `Harness` `base` object (see Step 3):
`routeSymbol: 'TSLA'`, `onSelectQuickSymbol: vi.fn()`.

- [ ] **Step 2: Run — expect FAIL** (quick-symbols missing)

```powershell
npx nx test @convexa/dashboard -- --run src/app/pages/ticker/widgets/chrome/CommandDeck.spec.tsx
```

(If you split into `CommandDeck.quick.spec.tsx`, run that file instead; keep existing CommandDeck
spec green too.)

- [ ] **Step 3: Patch `CommandDeck.tsx`**

1. Import:

```ts
import { QuickSymbols } from './QuickSymbols';
```

2. Extend `CommandDeckProps`:

```ts
  /**
   * Route ticker (URL param) — drives Quick chip selected state (AC-4).
   * Distinct from `symbol` (the uncommitted input field).
   */
  routeSymbol: string;
  /** Chip click — parent navigates + syncs input (same path as submit). */
  onSelectQuickSymbol: (symbol: string) => void;
```

3. Destructure `routeSymbol`, `onSelectQuickSymbol` in `CommandDeck`.

4. Inside the deck `Stack`, **after** `<TickerToolbar … />`, add:

```tsx
          <QuickSymbols currentSymbol={routeSymbol} onSelect={onSelectQuickSymbol} />
```

5. **Do not** put `QuickSymbols` inside `StickyCondensed`.

6. Update every `CommandDeck` call site / test Harness with the two new props (F4 covers the
   production call site; tests need stubs now).

Update Harness `base` in `CommandDeck.spec.tsx`:

```ts
    routeSymbol: props.routeSymbol ?? 'TSLA',
    onSelectQuickSymbol: props.onSelectQuickSymbol ?? vi.fn(),
```

Also update any other CommandDeck mounts in specs that typecheck against `CommandDeckProps`
(`stage3-headings.spec.tsx`, etc.) — pass:

```ts
routeSymbol="TSLA"
onSelectQuickSymbol={() => {}}
```

Find them:

```powershell
rg -n "CommandDeck" apps/dashboard/src --glob "*.tsx"
```

- [ ] **Step 4: Export (optional)**

In `index.ts`:

```ts
export * from './QuickSymbols';
```

- [ ] **Step 5: Run deck specs — expect PASS**

```powershell
npx nx test @convexa/dashboard -- --run src/app/pages/ticker/widgets/chrome/CommandDeck.spec.tsx src/app/pages/ticker/widgets/chrome/QuickSymbols.spec.tsx
```

- [ ] **Step 6: Commit**

```powershell
git add apps/dashboard/src/app/pages/ticker/widgets/chrome/CommandDeck.tsx apps/dashboard/src/app/pages/ticker/widgets/chrome/CommandDeck.spec.tsx apps/dashboard/src/app/pages/ticker/widgets/chrome/QuickSymbols.tsx apps/dashboard/src/app/pages/ticker/widgets/chrome/index.ts
# plus any other specs you patched for the new props
git commit -m "feat(dashboard): mount QuickSymbols under CommandDeck toolbar"
```

**Reviewer probe:** sticky bar DOM must not contain `quick-symbols`; full deck must.

---

### F4 — Wire `TickerDashboard`: recordVisit + chip navigation + input sync

**Files:**
- Modify: `apps/dashboard/src/app/pages/ticker/TickerDashboard.tsx`
- Create: `apps/dashboard/src/app/pages/ticker/recentTickers/selectTickerSymbol.ts`
- Create: `apps/dashboard/src/app/pages/ticker/recentTickers/navigation.spec.ts`

**Facts about the tree (do not “fix” unrelated bugs unless required for AC-3):**

- Route param is `:ticker` (`app.tsx` → `path="/ticker/:ticker"`).
- `const { ticker = 'SPY' } = useParams();`
- Input state: `const [symbol, setSymbol] = useState(ticker);` — **does not re-sync** when the param
  changes today. Chip navigation **must** update the input (AC-3).
- `onSubmitSymbol` already does `navigate(\`/ticker/${symbol}\`)`.

**Binding choice — single source for `recordVisit`:**

| Concern | Owner |
|---------|--------|
| Durable visit recording | `useEffect` on `[ticker]` in `TickerDashboard` only |
| Chip / programmatic nav | `selectTickerSymbol` → uppercase + `setSymbol` + `navigate` (no `recordVisit`) |
| Typed Enter submit | existing `onSubmitSymbol` → `navigate`; route effect records |

This covers chip clicks, typed submit, scanner deep-links, and first mount. `recordVisit` is
idempotent if the effect re-fires on the same symbol.

- [ ] **Step 1: Write failing navigation helper tests**

Create `navigation.spec.ts`:

```ts
/**
 * Chip navigation glue (AC-3). Visit recording is the route-effect's job (see F4 binding choice).
 */
import { describe, expect, it, vi } from 'vitest';
import { selectTickerSymbol } from './selectTickerSymbol';

describe('selectTickerSymbol', () => {
  it('uppercases, syncs input, navigates to /ticker/SYMBOL', () => {
    const navigate = vi.fn();
    const setSymbol = vi.fn();
    selectTickerSymbol({ symbol: 'iwm', navigate, setSymbol });
    expect(setSymbol).toHaveBeenCalledWith('IWM');
    expect(navigate).toHaveBeenCalledWith('/ticker/IWM');
  });

  it('no-ops on blank', () => {
    const navigate = vi.fn();
    const setSymbol = vi.fn();
    selectTickerSymbol({ symbol: '  ', navigate, setSymbol });
    expect(navigate).not.toHaveBeenCalled();
    expect(setSymbol).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement `selectTickerSymbol.ts`**

```ts
/**
 * Chip navigation glue: uppercase → sync input → client route.
 * Same destination as submitting the ticker field (`/ticker/:ticker`).
 * Durable recents are recorded by TickerDashboard's route-param effect, not here.
 */
export function selectTickerSymbol(args: {
  symbol: string;
  navigate: (to: string) => void;
  setSymbol: (s: string) => void;
}): void {
  const s = args.symbol.trim().toUpperCase();
  if (!s) return;
  args.setSymbol(s);
  args.navigate(`/ticker/${s}`);
}
```

- [ ] **Step 3: Patch `TickerDashboard.tsx`**

1. Imports:

```ts
import { recordVisit } from './recentTickers/store';
import { selectTickerSymbol } from './recentTickers/selectTickerSymbol';
```

2. After `const [symbol, setSymbol] = useState(ticker);` add:

```ts
  // Keep input + durable recents aligned with the route param (chip / submit / deep link).
  // While the trader types an uncommitted symbol, `ticker` is unchanged so this does not stomp.
  useEffect(() => {
    const s = (ticker ?? 'SPY').toUpperCase();
    setSymbol(s);
    recordVisit(s);
  }, [ticker]);
```

3. Near `onSubmitSymbol`, add chip handler (mirror DTE prefill one-shot):

```ts
  const onSelectQuickSymbol = useCallback(
    (s: string) => {
      if (dtePrefill) pendingPrefill.current = { min: dtePrefill.min, max: dtePrefill.max };
      selectTickerSymbol({ symbol: s, navigate, setSymbol });
    },
    [dtePrefill, navigate],
  );
```

4. Pass into `<CommandDeck …>`:

```tsx
              routeSymbol={ticker}
              onSelectQuickSymbol={onSelectQuickSymbol}
```

5. **Do not** mount `QuickSymbols` on the standalone cold-load `TickerToolbar` branch — AC-1 places
   the row inside the Command Deck card only.

- [ ] **Step 4: Run**

```powershell
npx nx test @convexa/dashboard -- --run `
  src/app/pages/ticker/recentTickers/store.spec.ts `
  src/app/pages/ticker/recentTickers/navigation.spec.ts `
  src/app/pages/ticker/widgets/chrome/QuickSymbols.spec.tsx `
  src/app/pages/ticker/widgets/chrome/CommandDeck.spec.tsx
```

**Expected:** all pass, exit 0.

- [ ] **Step 5: Commit**

```powershell
git add apps/dashboard/src/app/pages/ticker/TickerDashboard.tsx `
  apps/dashboard/src/app/pages/ticker/recentTickers/
git commit -m "feat(dashboard): wire Quick chips navigation + recordVisit on route"
```

**Reviewer probe:** after chip click, route is `/ticker/SYMBOL`, input shows SYMBOL, selected chip
moves. Visiting SPY does not grow recents. Typed Enter still navigates; effect records non-pins.

---

### F5 — Theme / hex hygiene + non-touch review

**Files:** none new if F2 stayed token-only. Re-run structural suites.

- [ ] **Step 1: Hex discipline**

```powershell
npx nx test @convexa/dashboard -- --run `
  src/app/shared/theme/hex-discipline.spec.ts `
  src/app/shared/theme/banned-hexes.spec.ts
```

**Expected:** exit 0. If a new file appears on the exemption list, STOP — remove the hex instead.

- [ ] **Step 2: Typecheck**

```powershell
npx nx typecheck @convexa/dashboard
```

**Expected:** exit 0.

- [ ] **Step 3: Manual review checklist (author fills, QA re-checks)**

| Check | Pass? |
|-------|-------|
| Quick row only under CommandDeck toolbar | |
| Sticky bar unchanged (no chips) | |
| TopNav unchanged | |
| Zero new hex in touched files | |
| Selected chip not green/red | |
| Empty recents → pins only | |

- [ ] **Step 4: Commit** only if Step 1–2 forced a tiny fix; otherwise skip.

---

## Verification track

Run after F5. Feature is not done until V1–V4 exit as specified.

### V1 — Feature-scoped Vitest

```powershell
npx nx test @convexa/dashboard -- --run `
  src/app/pages/ticker/recentTickers/store.spec.ts `
  src/app/pages/ticker/recentTickers/navigation.spec.ts `
  src/app/pages/ticker/widgets/chrome/QuickSymbols.spec.tsx `
  src/app/pages/ticker/widgets/chrome/CommandDeck.spec.tsx `
  src/app/shared/theme/hex-discipline.spec.ts `
  src/app/shared/theme/banned-hexes.spec.ts
```

**Expected:**
- All listed files pass.
- Exit code **0** (`$LASTEXITCODE` → `0`).
- Store cases cover empty/corrupt/cap/pin-dedupe/reload (AC-2, AC-5, AC-6).
- QuickSymbols + CommandDeck cover placement, pins, selected, sticky exclusion (AC-1, AC-2, AC-4, AC-7).

### V2 — Typecheck

```powershell
npx nx typecheck @convexa/dashboard
```

**Expected:** exit 0. (A green V1 alone is insufficient.)

### V3 — Empty `apps/api` diff (AC-7 / interface posture)

```powershell
git diff --name-only HEAD -- apps/api
git status --short apps/api
```

**Expected:** empty. If the feature branch already diverged for other reasons, compare against the
merge-base with main **restricted to this feature's commits**, or `git log --name-only -- apps/api`
for the feature commits — **must be none**.

### V4 — AC traceability matrix (author self-check before GATE Q)

| AC | Evidence |
|----|----------|
| AC-1 | CommandDeck spec: `quick-symbols` inside `command-deck` below toolbar |
| AC-2 | store pin constant + QuickSymbols pins-only empty case |
| AC-3 | `selectTickerSymbol` navigates `/ticker/SYMBOL`; route effect syncs input |
| AC-4 | QuickSymbols `aria-pressed` on route symbol |
| AC-5 | store reload + cap + de-dupe tests; route `recordVisit` |
| AC-6 | empty/corrupt → pins still render; no “no symbols” copy |
| AC-7 | sticky bar assertion + empty api diff + TopNav not in change list |
| AC-8 | hex-discipline + banned-hexes green; selected via primary/divider |

---

## File inventory (complete)

| Path | Action |
|------|--------|
| `apps/dashboard/src/app/pages/ticker/recentTickers/store.ts` | **Create** |
| `apps/dashboard/src/app/pages/ticker/recentTickers/store.spec.ts` | **Create** |
| `apps/dashboard/src/app/pages/ticker/recentTickers/selectTickerSymbol.ts` | **Create** |
| `apps/dashboard/src/app/pages/ticker/recentTickers/navigation.spec.ts` | **Create** |
| `apps/dashboard/src/app/pages/ticker/widgets/chrome/QuickSymbols.tsx` | **Create** |
| `apps/dashboard/src/app/pages/ticker/widgets/chrome/QuickSymbols.spec.tsx` | **Create** |
| `apps/dashboard/src/app/pages/ticker/widgets/chrome/CommandDeck.tsx` | **Modify** (mount row + 2 props) |
| `apps/dashboard/src/app/pages/ticker/widgets/chrome/CommandDeck.spec.tsx` | **Modify** (Harness props + AC tests) |
| `apps/dashboard/src/app/pages/ticker/widgets/chrome/index.ts` | **Modify** (export) |
| `apps/dashboard/src/app/pages/ticker/TickerDashboard.tsx` | **Modify** (effect + handler + props) |
| Other `CommandDeck` test mounts | **Modify** (new required props) |
| `apps/api/**` | **No changes** |

---

## Out of scope (do not implement)

- Sticky condensed header chips
- TopNav recents
- Server-synced recents / settings API
- Expanding pin set via UI
- Ticker `/` focus ergonomics
- Backend / scoring / alerts / vol-norm

---

## Sequencing diagram

```
B1 (api empty proof) ─────────────────────────────┐
                                                  │
F1 store ─► F2 QuickSymbols ─► F3 CommandDeck ─► F4 TickerDashboard ─► F5 hex/typecheck
                                                  │
                                                  └─► V1 → V2 → V3 → V4
```
