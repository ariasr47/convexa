# broker-option-grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Broker tab, collapse a ticker's option legs into one expandable group row carrying a
leg count and a netted entry cost — and make the app **structurally incapable** of naming the shape.

**Architecture:** A new pure module `broker/grouping.ts` composes the already-built
`BrokerPositionView[]` (never merging legs into a `SimPosition`, never re-running `buildPositionView`);
one shared presentational unit `broker/BrokerGroupHeader.tsx` renders the group on both form factors;
every string this feature authors lives in `broker/groupCopy.ts`. The no-naming rule is enforced by
three layers — an ESLint import allow-list/deny-list, a recursive two-arm source scan, and a render
regression under a **future-feed** fixture — each with mutation guards proven to bite.

**Tech Stack:** React 19 · MUI v9 · TypeScript 5.9 · Vitest 4 + Testing Library · Playwright · Nx 23.
`apps/dashboard` only.

---

## Track map

| Track | Tasks |
|---|---|
| **Backend** (`apps/api`) | **none — empty by design** (see "Backend track") |
| **Frontend** (`apps/dashboard`) | F1 … F11, strictly ordered |
| **Verification** | V1 … V5, after F11 (V4/V5 setup is independent) |

**Sequencing — not negotiable.** The three enforcement layers reference all three authored files by
exact path, and Layer 2's anti-vacuity assertion **fails** unless `./grouping.ts`,
`./BrokerGroupHeader.tsx` and `./groupCopy.ts` are all present in its scanned remainder. So:
fixtures (F1) → shared `brokerView` seam (F2) → copy (F3) → arithmetic (F4) → header (F5) → **then**
Layer 1 (F6), Layer 2 (F7), Layer 3 (F8) → wiring (F9) → named defect repair (F10) → viewport/e2e
(F11). A layer is never written against a file that does not exist yet.

---

## Global Constraints

Every task's requirements implicitly include this section.

**Standing project constraints (`CLAUDE.md` — each has bitten this repo before):**

- **`nx typecheck` is mandatory before any green claim.** A green `nx test` does **not** mean the types
  are sound (Vitest transpiles without typechecking). Bitten three times.
- **Check EXIT CODES, not printed summaries**, and never through a pipe that masks them. A suite once
  printed `1004 passed` while exiting non-zero. `echo $?` / `$LASTEXITCODE` after every gate command.
- **`nx format:write` must ALWAYS be scoped with `--files=`.** One bare run reformatted 92 unrelated
  files. `format:check` takes the same flag.
- **e2e is Playwright** and needs `npx playwright install chromium`.
- **`npm run ports:free` before any run-the-app verification** (orphaned uvicorn children and lingering
  Vite hold :8000/:4200/:4300 and serve STALE code).
- **Never write a literal NUL byte** (it makes a file binary to git and grep). This plan's separators
  are printable.

**Baselines to beat, not merely match:**

| Suite | Baseline | After |
|---|---|---|
| `npx nx test api` | **272** | **272, unchanged** (empty `apps/api` diff) |
| `npx nx test @org/dashboard` | **1291 tests / 116 files** | **> 1291 / > 116** |
| e2e (Playwright) | **37** | **> 37** |
| `npx nx run-many -t lint` | **0 errors / 0 warnings** | **0 / 0** |
| `npx nx typecheck @org/dashboard` | **0** | **0** |

**Feature-specific hard rules (SPEC §§2–8):**

- **`apps/api` diff MUST be empty** — ship-blocking (AC-31), not a stylistic preference.
- **No file under `features/trading/positions/` is modified**; `broker/copy.ts` is untouched; no shipped
  string moves.
- **The group is NEVER named a structure — including `Custom`.** No `structure`, `structure_label`,
  `structure_line`, `max_loss`, `qty`, `eval_subject` or `pl_pct` on the group struct. Absence is the
  enforcement.
- **The three authored files (`grouping.ts`, `groupCopy.ts`, `BrokerGroupHeader.tsx`) may not contain,
  as typed text anywhere — code, comment or string — a `STRUCTURE_LABELS` value (B1) or any B2 term:**
  `/\bverticals?\b/i` `/\bspreads?\b/i` `/\bcondors?\b/i` `/\bbutterfl(?:y|ies)\b/i`
  `/\bstraddles?\b/i` `/\bstrangles?\b/i` `/\bcollars?\b/i` `/\biron\b/i` `/\bcalendars?\b/i`
  `/\bdiagonals?\b/i` `/\bcovered\b/i` `/\bprotective\b/i` `/\bcustom\b/i`.
  **On a B2 hit: reword — never drop the `\b` anchors, never delete the term.** Write "forward the
  remaining props" not "spread the…"; "carried by the test" not "covered by the test". Do not use MUI
  `<Divider orientation="vertical">` or `verticalAlign` in these files (the allow-pattern exists, but
  not needing it is cheaper).
- **Zero hardcoded hex**; mode-aware values via `extrasFor(theme)` **inside** an sx callback. Four token
  values only: `divider`, `text.primary`, `text.secondary`, `success.main`/`error.main` (P/L direction
  ONLY). **`text.disabled` is banned here** (2.54:1 dark / 2.65:1 light, under the 4.5:1 floor) — reuse
  the shipped `FactText`, never re-author it.
- **`Σ (member.pl_dollar ?? 0)` is a NAMED FORBIDDEN implementation.** Group P/L is all-or-nothing.
- **`NET_BASIS_EPS` is NOT the zero threshold** — it is a percent-denominator constant, off the
  allow-list. The `$0.00` rule keys on the **formatted magnitude under ordinary 2-decimal currency
  rounding** and nothing else (`0.004` → `$0.00` bare; `0.006` → `$0.01` **with** its word).
- **No new durable storage key.** Expand state is component-local React state keyed on the stable
  `GroupKey`. `[loss-free-durable-migration]` is deliberately NON-BINDING; introducing a durable
  UI-pref key makes it bind and is a **scope change**, not an implementation detail.
- **No new `fetch`.** `useBrokerMarks.ts` / `useBrokerBook.ts` untouched.
- **Five not-a-number literals stay five** (`—` · `unavailable` · `not recorded` · `no basis` ·
  `not provided`). No sixth. `not recorded` renders nowhere on any broker surface. Never emit
  `undefined`/`null`/`NaN`/`0` into a rendered slot.
- **`positions.length` is never a disambiguator** — none of `position_count`, `leg_count`,
  `groups.length` may decide a render state.
- **`[CF]` discipline.** A `[CF]`-tagged criterion is unreachable on the captured book and must be
  verified on a **constructed** fixture. A `[CF]` row reported green off the captured-book arm is a
  **GATE Q failure**.

**Interface contract: `NO_BACKEND_CHANGE`.** The block below is copied **verbatim** from
`INTERFACE_CONTRACT.md`. Both lanes inherit this binding shape; it re-pins the one
environment-independent read arm this feature consumes so `interface_conformance.mjs` has something
executable to run at the verification gate.

## Conformance spec

Environment-independent arm only, and **only** the read this feature consumes. Run with
`--auth-signup`: a fresh throwaway account deterministically has **no** stored credential, so
`GET /api/broker/book` returns the `unknown` / `no_credential_stored` arm — which still exercises
every envelope field this feature depends on for its no-book render states.

The credential-dependent arms (`state: ok|empty`, `positions[]` / leg / tri-state shapes,
`last_attempt_*` under a real fetch) are verified by the backend's adapter characterization tests
over captured payload fixtures plus the FE's own fixture-driven suite — not by this block.
`POST /api/broker/book/refresh` is **deliberately excluded**: a conformance sweep must not force-fetch
against the owner's real Webull rate limits. **Never run this block with `--auth-cookie` against a
credentialed session.**

```json
{
  "comment": "NO_BACKEND_CHANGE. Re-pin of the fresh-session (no-credential) read arm of the endpoint this FE-only feature consumes. Authoritative field list: .claude/contracts/_archive/broker-connect/INTERFACE_CONTRACT.md (+ Amendment 1). No field is added or changed by broker-option-grouping.",
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/broker/book",
      "auth": true,
      "query": {},
      "required": {
        "state": "string",
        "reason": "string",
        "positions": "array",
        "as_of": "string?",
        "basis": "string?",
        "stale_after_seconds": "number?",
        "account_ref": "string?",
        "last_attempt_at": "string?",
        "last_attempt_outcome": "string?"
      }
    }
  ]
}
```

---

## File structure

**Created:** `broker/grouping.ts` (pure arithmetic — where a name could be **computed**, so it carries
the import **allow-list**) · `broker/groupCopy.ts` (every authored string — where a name would be
**typed**) · `broker/BrokerGroupHeader.tsx` (the ONE shared header + panel shell — where a name would be
**rendered**) · `apps/dashboard/src/testing/noNamingVocabulary.ts` (test-support: B1 values + B2 regex
sources + allow-patterns + `AC4_WORDS`; **outside `broker/`** because it necessarily contains the banned
words and must stay invisible to Layer 2's own glob).

All paths below are under `apps/dashboard/src/app/features/trading/` unless stated.

**Modified:** `broker/brokerView.ts` (shared cascade + shared formatter + provenance constant/boolean) ·
`broker/BrokerTabPanel.tsx` (one memo, the expand map, the partition — **authors no string**) ·
`broker/BrokerPositionCard.tsx` (defect repair #2 + nested chrome) · `broker/BrokerPositionRow.tsx`
(nested chrome prop only) · `broker/fixtures.ts` (**additive**; stays on Layer 2's EXEMPT list) ·
`broker/unrenderedBrokerPl.spec.tsx` (extend to the group surface) · `eslint.config.mjs` (Layer 1) ·
`apps/dashboard/tsconfig.spec.json` (one include entry, mirroring the shipped `src/test-setup.ts`
precedent).

**New specs:** `broker/fixtures.contract.spec.ts` · `broker/grouping.spec.ts` ·
`broker/BrokerGroupHeader.spec.tsx` · `broker/noNaming.scan.spec.ts` (Layer 2) ·
`broker/noNaming.render.spec.tsx` (Layer 3) · `broker/grouping.integration.spec.tsx` (the centrepiece) ·
`apps/dashboard-e2e/src/e2e/broker-grouping.spec.ts`.

---

## Backend track — EMPTY BY DESIGN

**There are no backend tasks. This is not a small track; it is a zero-task track, and that is the
design.** `INTERFACE_CONTRACT.md` is `NO_BACKEND_CHANGE`: grouping is a pure presentation layer over an
already-served payload. `GET /api/broker/book` and `POST /api/broker/book/refresh` are consumed exactly
as `broker-connect` shipped them — no endpoint, field, query parameter, header or envelope change. A
`multiplier_source` wire flag **was considered and rejected**: provenance already reaches the FE as the
position-level `fidelity_notes` entry, and the field would break the empty diff for information the FE
can already derive.

The one obligation, negative and ship-blocking:

- [ ] **`git diff --stat -- apps/api` prints nothing** at the end of the work (verified in **V4**).

Do not invent work here. If a task appears to need a backend change, that is a **GATE Z question**.

---

## Frontend track

### Task F1: Fixtures — the captured book complete, plus every `[CF]` constructed arm

**Its own task with its own DoD because the captured book exercises none of the interesting cases**
(SPEC §1: all six withholding counts 0, all 9 legs take the ×100 reconstruction fallback so the
provenance boolean's false branch is unreachable, every group a net debit, 1:1 position→leg). A large
share of the verification track is gated here, and a fixture that silently stops exercising its case is
how a `[CF]` row gets falsely reported green — hence the contract spec, which asserts each fixture's
defining property **directly over the wire shape**, independent of `groupBook`.

**Files:** Modify `broker/fixtures.ts` (append only — its header says "post-capture arms extend this
file, never rework it") · Test `broker/fixtures.contract.spec.ts` (new).

**Interfaces — Consumes:** `@org/api` types; the shipped `supplied()`/`notSupplied()`/`unparseable()`/
`equityLeg()`/`genericOptionLeg()` helpers, `NOTE_NO_CONTRACT_DETAIL`/`NOTE_MULTIPLIER_RECONSTRUCTED`/
`NOTE_MULTIPLIER_WITHHELD`, `POS_CAPTURE_AMD_STOCK`/`POS_CAPTURE_NVDA_OPTION`/
`POS_CAPTURE_SHORT_OPTION`/`POS_UNRECOGNIZED`, `AS_OF_FRESH`/`STALE_AFTER_SECONDS`.
**Produces (exact names later tasks use):** `BOOK_CAPTURED_COMPLETE`, `POS_CB_*` (14),
`BOOK_CF_CREDIT`, `BOOK_CF_ZERO_NET`, `BOOK_CF_NO_COST`, `BOOK_CF_NO_SIZE`, `BOOK_CF_UNPARSEABLE`,
`BOOK_CF_MIXED_CAUSE`, `BOOK_CF_DOUBLY_BROKEN`, `BOOK_CF_TWO_LEG_MEMBER`, `BOOK_CF_FUTURE_FEED`,
`BOOK_CF_NO_RECON_NOTE`, `BOOK_CF_UNREALIZED_LEAK` (all `BrokerBook`), and
`SINGLE_LEG_CASCADE_ARMS: ReadonlyArray<[string, BrokerPosition, string]>`.

**Ground truth to reproduce exactly (SPEC §1's left-hand column — what Convexa renders; NEVER Webull's
raw `total_cost`, which this app never displays). Each figure is `unit_cost × 100 × signed qty`:**

| ticker | Convexa renders | legs (signed qty @ per-unit cost) |
|---|---|---|
| AAPL | **$3,850.00 debit** | +10 @ 6.92 · −10 @ 3.07 |
| META | **$3,805.00 debit** | +5 @ 9.76 · −5 @ 2.15 |
| TSLA | **$13,760.00 debit** | +10 @ 10.62 · −4 @ 8.49 · +4 @ 16.34 (10,620 − 3,396 + 6,536) |
| NVDA | **$7,890.00 debit** | +10 @ 7.89 |
| PLTR | **$4,990.00 debit** | +10 @ 4.99 |

NVDA's figure and AAPL's `−10 @ 3.07` are anchored to the repo (shipped passing
`genericOptionRow.spec.tsx:77`, `:264`; `POS_CAPTURE_SHORT_OPTION`). The other per-unit costs exist
only to reproduce the pinned ticker nets.

**Two traps:** (1) the captured TSLA `−4` leg **carries `multiplier: 100` and the reconstructed note** —
do NOT reuse `POS_CAPTURE_NO_MULTIPLIER` (the guard-refused arm), or the captured book gains a
withholding count and AC-1/AC-8 break; (2) the five equity rows carry no spec-pinned figures, but
**AAPL's equity row must exist** — it is the live instance for the equities-excluded rule (AC-22).

- [ ] **Step 1: Write the failing contract spec** — `broker/fixtures.contract.spec.ts`:

```ts
/**
 * FIXTURE CONTRACT — each constructed fixture asserts the property it exists to provide.
 * SPEC §1: the captured book exercises NONE of the withholding / credit / zero-net / mixed-cause /
 * doubly-broken / two-legs-in-one-position / future-feed / provenance-false cases. Those are the
 * `[CF]` criteria in SPEC §3, and a `[CF]` row reported green off the captured arm is a GATE Q
 * failure. Asserted here over the RAW WIRE SHAPE, independent of any implementation.
 */
import type { BrokerBook, BrokerLeg, BrokerPosition } from '@org/api';
import { describe, expect, it } from 'vitest';
import {
  BOOK_CAPTURED_COMPLETE, BOOK_CF_CREDIT, BOOK_CF_DOUBLY_BROKEN, BOOK_CF_FUTURE_FEED,
  BOOK_CF_MIXED_CAUSE, BOOK_CF_NO_COST, BOOK_CF_NO_RECON_NOTE, BOOK_CF_NO_SIZE,
  BOOK_CF_TWO_LEG_MEMBER, BOOK_CF_UNPARSEABLE, BOOK_CF_ZERO_NET,
  NOTE_MULTIPLIER_RECONSTRUCTED, SINGLE_LEG_CASCADE_ARMS,
} from './fixtures';

/** The figure Convexa renders for one leg: per-unit cost × contract size × SIGNED quantity. */
const composed = (l: BrokerLeg): number =>
  (l.cost_basis.state === 'supplied' ? Math.abs(l.cost_basis.value ?? 0) : Number.NaN) *
  (l.multiplier ?? Number.NaN) *
  l.quantity;

const optionPositions = (b: BrokerBook): BrokerPosition[] =>
  b.positions.filter((p) => p.legs.length > 0 && p.legs.every((l) => l.kind === 'option'));
const optionLegs = (b: BrokerBook): BrokerLeg[] => optionPositions(b).flatMap((p) => p.legs);
const byTicker = (b: BrokerBook): Map<string, BrokerLeg[]> => {
  const m = new Map<string, BrokerLeg[]>();
  for (const l of optionLegs(b)) m.set(l.underlying, [...(m.get(l.underlying) ?? []), l]);
  return m;
};

describe('the CAPTURED book is complete and reproduces SPEC §1 exactly', () => {
  it('14 holdings = 5 equity + 9 option legs, split TSLA 3 · AAPL 2 · META 2 · NVDA 1 · PLTR 1', () => {
    const book = BOOK_CAPTURED_COMPLETE;
    expect(book.positions).toHaveLength(14);
    const equity = book.positions.filter((p) => p.legs.some((l) => l.kind === 'equity'));
    expect(equity).toHaveLength(5);
    expect(equity.some((p) => p.legs[0].underlying === 'AAPL')).toBe(true); // AC-22's live instance
    const t = byTicker(book);
    expect([...t.keys()].sort()).toEqual(['AAPL', 'META', 'NVDA', 'PLTR', 'TSLA']);
    expect([t.get('TSLA'), t.get('AAPL'), t.get('META'), t.get('NVDA'), t.get('PLTR')].map((x) => x?.length))
      .toEqual([3, 2, 2, 1, 1]);
  });

  it('the five ticker nets are SPEC §1 left-hand column, to the cent', () => {
    const t = byTicker(BOOK_CAPTURED_COMPLETE);
    const net = (k: string) => Math.round((t.get(k) ?? []).reduce((a, l) => a + composed(l), 0) * 100) / 100;
    expect([net('AAPL'), net('META'), net('TSLA'), net('NVDA'), net('PLTR')])
      .toEqual([3850, 3805, 13760, 7890, 4990]);
  });

  it('exercises NONE of the [CF] cases (this is what makes a false [CF] claim impossible)', () => {
    const legs = BOOK_CAPTURED_COMPLETE.positions.flatMap((p) => p.legs);
    expect(legs.filter((l) => l.cost_basis.state === 'not_supplied')).toHaveLength(0);
    expect(legs.filter((l) => l.cost_basis.state === 'unparseable')).toHaveLength(0);
    expect(legs.filter((l) => l.multiplier == null)).toHaveLength(0);
    for (const p of optionPositions(BOOK_CAPTURED_COMPLETE)) {
      expect(p.fidelity_notes ?? []).toContain(NOTE_MULTIPLIER_RECONSTRUCTED); // false branch unreachable
      expect(p.legs).toHaveLength(1); // 1:1 — a leg-counting bug passes here by COINCIDENCE
    }
    for (const [, ls] of byTicker(BOOK_CAPTURED_COMPLETE)) {
      expect(ls.reduce((a, l) => a + composed(l), 0)).toBeGreaterThan(0); // every net a DEBIT
    }
  });
});

describe('every [CF] fixture exercises the case it exists for', () => {
  it('CREDIT — signed net strictly NEGATIVE, nothing withheld (AC-9b)', () => {
    expect(optionPositions(BOOK_CF_CREDIT).length).toBeGreaterThanOrEqual(2);
    expect(optionLegs(BOOK_CF_CREDIT).reduce((a, l) => a + composed(l), 0)).toBeLessThan(0);
    expect(optionLegs(BOOK_CF_CREDIT).every((l) => l.cost_basis.state === 'supplied' && l.multiplier != null)).toBe(true);
  });

  it('ZERO NET — the legs cancel EXACTLY, reconstruction note present (AC-9c, P3)', () => {
    expect(optionLegs(BOOK_CF_ZERO_NET).reduce((a, l) => a + composed(l), 0)).toBe(0);
    for (const p of optionPositions(BOOK_CF_ZERO_NET)) {
      expect(p.fidelity_notes ?? []).toContain(NOTE_MULTIPLIER_RECONSTRUCTED);
    }
  });

  it('NO COST — exactly one leg `not_supplied`, every multiplier present (AC-12)', () => {
    const legs = optionLegs(BOOK_CF_NO_COST);
    expect(legs.filter((l) => l.cost_basis.state === 'not_supplied')).toHaveLength(1);
    expect(legs.filter((l) => l.multiplier == null)).toHaveLength(0);
    expect(legs.length).toBeGreaterThanOrEqual(2);
  });

  it('NO SIZE — exactly one leg with `multiplier` ABSENT (not null-padded), every cost supplied', () => {
    const legs = optionLegs(BOOK_CF_NO_SIZE);
    expect(legs.filter((l) => l.multiplier == null)).toHaveLength(1);
    expect(legs.every((l) => l.cost_basis.state === 'supplied')).toBe(true);
    const broken = legs.find((l) => l.multiplier == null) as BrokerLeg;
    expect(Object.prototype.hasOwnProperty.call(broken, 'multiplier')).toBe(false);
  });

  it('UNPARSEABLE — one transient leg and NOTHING permanent (AC-14)', () => {
    const legs = optionLegs(BOOK_CF_UNPARSEABLE);
    expect(legs.filter((l) => l.cost_basis.state === 'unparseable')).toHaveLength(1);
    expect(legs.filter((l) => l.cost_basis.state === 'not_supplied' || l.multiplier == null)).toHaveLength(0);
  });

  it('MIXED CAUSE — one permanent and one transient, on DIFFERENT legs (AC-15)', () => {
    const legs = optionLegs(BOOK_CF_MIXED_CAUSE);
    const perm = legs.filter((l) => l.cost_basis.state === 'not_supplied' || l.multiplier == null);
    const tran = legs.filter((l) => l.cost_basis.state === 'unparseable' && l.multiplier != null);
    expect(perm).toHaveLength(1);
    expect(tran).toHaveLength(1);
    expect(perm[0]).not.toBe(tran[0]);
  });

  it('DOUBLY BROKEN — ONE leg missing BOTH facts beside one healthy leg (AC-17b: "1 of 2")', () => {
    const legs = optionLegs(BOOK_CF_DOUBLY_BROKEN);
    expect(legs).toHaveLength(2);
    expect(legs.filter((l) => l.cost_basis.state === 'not_supplied' && l.multiplier == null)).toHaveLength(1);
    // The naive SUM of cause counts is 2 — which is why the union cardinality is load-bearing.
    expect(
      legs.filter((l) => l.cost_basis.state === 'not_supplied').length +
        legs.filter((l) => l.multiplier == null).length,
    ).toBe(2);
  });

  it('TWO-LEG MEMBER — one POSITION carries two option legs, so leg_count ≠ position_count (AC-6, 6c)', () => {
    const ps = optionPositions(BOOK_CF_TWO_LEG_MEMBER);
    expect(ps.some((p) => p.legs.length === 2)).toBe(true);
    expect(ps.reduce((a, p) => a + p.legs.length, 0)).not.toBe(ps.length);
  });

  it('FUTURE FEED — two legs WITH strike/expiry/right, on a ticker that is not a B2 term', () => {
    const legs = optionLegs(BOOK_CF_FUTURE_FEED);
    expect(legs).toHaveLength(2);
    for (const l of legs) {
      expect(typeof l.strike).toBe('number');
      expect(typeof l.expiry).toBe('string');
      expect(l.right === 'call' || l.right === 'put').toBe(true);
      expect(l.underlying).toBe('TSLA'); // SPEC §2.3 / §9 item 5
    }
  });

  it('NO RECONSTRUCTION NOTE — the provenance FALSE branch is reachable, with a real figure (P1)', () => {
    for (const p of optionPositions(BOOK_CF_NO_RECON_NOTE)) {
      expect(p.fidelity_notes ?? []).not.toContain(NOTE_MULTIPLIER_RECONSTRUCTED);
      expect(p.legs.every((l) => l.multiplier != null && l.cost_basis.state === 'supplied')).toBe(true);
    }
  });

  it('SINGLE-LEG CASCADE ARMS cover all three N=1 outcomes (AC-15b)', () => {
    expect(SINGLE_LEG_CASCADE_ARMS.length).toBeGreaterThanOrEqual(6);
    for (const [label, pos, expected] of SINGLE_LEG_CASCADE_ARMS) {
      expect(pos.legs.length, label).toBeLessThanOrEqual(1);
      expect(['not provided', 'unavailable', 'FIGURE']).toContain(expected);
    }
    expect(new Set(SINGLE_LEG_CASCADE_ARMS.map(([, , e]) => e)).size).toBe(3);
  });
});
```

- [ ] **Step 2: Run it, watch it fail for the right reason**

```
npx nx test @org/dashboard -- fixtures.contract
```
Expected: FAIL with module-resolution errors (the symbols do not exist yet), **not** assertion failures.

- [ ] **Step 3: Append the fixtures** to `broker/fixtures.ts` (nothing above is edited):

```ts
// =================================================================================================
// broker-option-grouping — the CAPTURE-COMPLETE book (SPEC §1) + the [CF] constructed arms. ADDITIVE.
// The composed figure this app renders is `unit_cost × contract size × SIGNED quantity`, summed —
// never Webull's raw `total_cost`, which this app never displays. Per-unit costs reproduce SPEC §1's
// pinned ticker nets to the cent; NVDA @7.89 and AAPL −10 @3.07 are anchored to shipped passing
// assertions. This file stays on Layer 2's EXEMPT list, which is why the arms live here.
// =================================================================================================

/** Every captured option leg took the ×100 reconstruction fallback, so every one carries BOTH notes. */
const CAPTURED_OPTION_NOTES = [NOTE_NO_CONTRACT_DETAIL, NOTE_MULTIPLIER_RECONSTRUCTED];

function capturedOption(
  id: string, underlying: string, quantity: number, unitCost: number, mark: number,
  unrealized: BrokerFact = notSupplied(),
): BrokerPosition {
  return {
    broker_position_id: id,
    fidelity: 'partial',
    fidelity_notes: CAPTURED_OPTION_NOTES,
    legs: [genericOptionLeg({
      symbol: underlying, underlying, quantity, multiplier: 100,
      cost_basis: supplied(unitCost), broker_mark: supplied(mark),
    })],
    unrealized_pl: unrealized,
  };
}

function capturedEquity(
  id: string, underlying: string, quantity: number, unitCost: number, mark: number,
): BrokerPosition {
  return {
    broker_position_id: id,
    fidelity: 'exact',
    legs: [equityLeg({
      symbol: underlying, underlying, quantity,
      cost_basis: supplied(unitCost), broker_mark: supplied(mark),
    })],
    unrealized_pl: notSupplied(),
  };
}

// 5 equity rows (AAPL's is AC-22's live instance).
export const POS_CB_EQ_AMD = POS_CAPTURE_AMD_STOCK;
export const POS_CB_EQ_AAPL = capturedEquity('913256135', 'AAPL', 50, 188.42, 201.1);
export const POS_CB_EQ_INTC = capturedEquity('913255417', 'INTC', 200, 31.18, 34.02);
export const POS_CB_EQ_MU = capturedEquity('913255902', 'MU', 40, 96.55, 104.7);
export const POS_CB_EQ_SPCX = capturedEquity('913257741', 'SPCX', 300, 9.42, 8.88);

// 9 option legs, in SPEC §1's fixture order.
export const POS_CB_NVDA = POS_CAPTURE_NVDA_OPTION;              // +10 @ 7.89  → $7,890.00 debit
export const POS_CB_PLTR = capturedOption('1058096512', 'PLTR', 10, 4.99, 3.4);
export const POS_CB_TSLA_P10 = capturedOption('1061810101', 'TSLA', 10, 10.62, 9.1);
export const POS_CB_AAPL_P10 = capturedOption('1061810120', 'AAPL', 10, 6.92, 7.4);
export const POS_CB_AAPL_M10 = POS_CAPTURE_SHORT_OPTION;         // −10 @ 3.07 → $3,070.00 credit
/** NOT `POS_CAPTURE_NO_MULTIPLIER`: that is the guard-REFUSED arm. All 9 captured legs reconstructed. */
export const POS_CB_TSLA_M4 = capturedOption('1062038045', 'TSLA', -4, 8.49, 0.02);
export const POS_CB_TSLA_P4 = capturedOption('1062038112', 'TSLA', 4, 16.34, 15.2);
export const POS_CB_META_M5 = capturedOption('1062038210', 'META', -5, 2.15, 1.8);
export const POS_CB_META_P5 = capturedOption('1062038307', 'META', 5, 9.76, 10.3);

/** 14 holdings ⇒ 3 groups (TSLA 3 · AAPL 2 · META 2) + 2 lone legs + 5 equity rows = 10 entries (AC-1). */
export const BOOK_CAPTURED_COMPLETE: BrokerBook = {
  state: 'ok', as_of: AS_OF_FRESH, basis: 'fresh', stale_after_seconds: STALE_AFTER_SECONDS,
  account_ref: 'acctref0123456789',
  positions: [
    POS_CB_EQ_AMD, POS_CB_EQ_AAPL, POS_CB_EQ_INTC, POS_CB_EQ_MU, POS_CB_EQ_SPCX,
    POS_CB_NVDA, POS_CB_PLTR, POS_CB_TSLA_P10, POS_CB_AAPL_P10, POS_CB_AAPL_M10,
    POS_CB_TSLA_M4, POS_CB_TSLA_P4, POS_CB_META_M5, POS_CB_META_P5,
  ],
  last_attempt_at: AS_OF_FRESH, last_attempt_outcome: 'ok',
};

// ---- [CF] arms — the captured book exercises NONE of these ---------------------------------------

function cfBook(positions: BrokerPosition[], over: Partial<BrokerBook> = {}): BrokerBook {
  return {
    state: 'ok', as_of: AS_OF_FRESH, basis: 'fresh', stale_after_seconds: STALE_AFTER_SECONDS,
    account_ref: 'acctref0123456789', positions,
    last_attempt_at: AS_OF_FRESH, last_attempt_outcome: 'ok', ...over,
  };
}

/** One constructed option position; `legs` explicit so a two-leg member is expressible. */
function cfOption(id: string, legs: BrokerLeg[], notes = CAPTURED_OPTION_NOTES): BrokerPosition {
  return { broker_position_id: id, fidelity: 'partial', fidelity_notes: notes, legs, unrealized_pl: notSupplied() };
}

const cfLeg = (over: Partial<BrokerLeg>): BrokerLeg =>
  genericOptionLeg({ symbol: 'TSLA', underlying: 'TSLA', multiplier: 100, ...over });

/** A leg with `multiplier` genuinely ABSENT (never null-padded, never defaulted). */
const cfLegNoSize = (over: Partial<BrokerLeg>): BrokerLeg => ({
  kind: 'option', symbol: 'TSLA', underlying: 'TSLA', quantity: -3,
  cost_basis: supplied(8.1), broker_mark: supplied(0.03), ...over,
});

/** AC-9b — signed net is a CREDIT: +2 @ 1.00 (200 debit) vs −6 @ 3.00 (1,800 credit). */
export const BOOK_CF_CREDIT: BrokerBook = cfBook([
  cfOption('cf-credit-1', [cfLeg({ quantity: 2, cost_basis: supplied(1), broker_mark: supplied(1.2) })]),
  cfOption('cf-credit-2', [cfLeg({ quantity: -6, cost_basis: supplied(3), broker_mark: supplied(2.4) })]),
]);

/** AC-9c + P3 — the legs cancel exactly: +10 @ 5.00 vs −10 @ 5.00 ⇒ `$0.00`, no direction word. */
export const BOOK_CF_ZERO_NET: BrokerBook = cfBook([
  cfOption('cf-zero-1', [cfLeg({ quantity: 10, cost_basis: supplied(5), broker_mark: supplied(5.5) })]),
  cfOption('cf-zero-2', [cfLeg({ quantity: -10, cost_basis: supplied(5), broker_mark: supplied(4.8) })]),
]);

/** AC-12 — one leg's cost was NEVER supplied (permanent). */
export const BOOK_CF_NO_COST: BrokerBook = cfBook([
  cfOption('cf-nocost-1', [cfLeg({ quantity: 3, cost_basis: supplied(4), broker_mark: supplied(4.4) })]),
  cfOption('cf-nocost-2', [cfLeg({ quantity: -3, cost_basis: notSupplied(), broker_mark: notSupplied() })]),
]);

/** AC-12 — one leg's contract size could not be reconstructed. */
export const BOOK_CF_NO_SIZE: BrokerBook = cfBook([
  cfOption('cf-nosize-1', [cfLeg({ quantity: 3, cost_basis: supplied(4), broker_mark: supplied(4.4) })]),
  cfOption('cf-nosize-2', [cfLegNoSize({})], [NOTE_NO_CONTRACT_DETAIL, NOTE_MULTIPLIER_WITHHELD]),
]);

/** AC-14 — carried but unreadable this cycle (transient), nothing permanent. */
export const BOOK_CF_UNPARSEABLE: BrokerBook = cfBook([
  cfOption('cf-unparse-1', [cfLeg({ quantity: 3, cost_basis: supplied(4), broker_mark: supplied(4.4) })]),
  cfOption('cf-unparse-2', [cfLeg({ quantity: -3, cost_basis: unparseable(), broker_mark: supplied(3.9) })]),
]);

/** AC-15 — a permanent and a transient cause on different legs. `not provided` must win. */
export const BOOK_CF_MIXED_CAUSE: BrokerBook = cfBook([
  cfOption('cf-mixed-1', [cfLeg({ quantity: 3, cost_basis: notSupplied(), broker_mark: notSupplied() })]),
  cfOption('cf-mixed-2', [cfLeg({ quantity: -3, cost_basis: unparseable(), broker_mark: supplied(3.9) })]),
]);

/** AC-17b — ONE doubly-broken leg beside one healthy leg: the union count is 1, never 2. */
export const BOOK_CF_DOUBLY_BROKEN: BrokerBook = cfBook([
  cfOption('cf-double-1', [cfLeg({ quantity: 3, cost_basis: supplied(4), broker_mark: supplied(4.4) })]),
  cfOption(
    'cf-double-2',
    [cfLegNoSize({ cost_basis: notSupplied(), broker_mark: notSupplied() })],
    [NOTE_NO_CONTRACT_DETAIL, NOTE_MULTIPLIER_WITHHELD],
  ),
]);

/**
 * AC-6 / AC-6c — the ANTI-COINCIDENCE book: one member position carries TWO option legs, so
 * leg_count (3) ≠ position_count (2) and a leg-counting implementation FAILS instead of passing.
 */
export const BOOK_CF_TWO_LEG_MEMBER: BrokerBook = cfBook([
  cfOption('cf-2leg-1', [
    cfLeg({ quantity: 2, cost_basis: supplied(6), broker_mark: supplied(6.5) }),
    cfLeg({ quantity: -2, cost_basis: supplied(2), broker_mark: supplied(1.8) }),
  ]),
  cfOption('cf-2leg-2', [cfLeg({ quantity: 1, cost_basis: supplied(9), broker_mark: supplied(9.4) })]),
]);

/**
 * AC-4b / Layer 3 — the FUTURE FEED: two option legs on one ticker WITH strike, expiry and right.
 * The post-`/trade/instrument` world, simulable today; the fixture that fails on the day
 * `positions/structure.ts:153`'s guard stops firing. TSLA deliberately: a neutral underlying that is
 * not itself a B2 term (SPEC §2.3, §9 item 5).
 */
export const BOOK_CF_FUTURE_FEED: BrokerBook = cfBook([
  cfOption('cf-future-1', [{
    kind: 'option', symbol: 'TSLA260821C00250000', underlying: 'TSLA', expiry: '2026-08-21',
    strike: 250, right: 'call', quantity: 1, multiplier: 100,
    cost_basis: supplied(4.2), broker_mark: supplied(5.1),
  }], [NOTE_MULTIPLIER_RECONSTRUCTED]),
  cfOption('cf-future-2', [{
    kind: 'option', symbol: 'TSLA260821C00260000', underlying: 'TSLA', expiry: '2026-08-21',
    strike: 260, right: 'call', quantity: -1, multiplier: 100,
    cost_basis: supplied(1.9), broker_mark: supplied(2.2),
  }], [NOTE_MULTIPLIER_RECONSTRUCTED]),
]);

/** P1 — the provenance FALSE branch: a real figure renders, with no derived-size clause anywhere. */
export const BOOK_CF_NO_RECON_NOTE: BrokerBook = cfBook([
  cfOption('cf-norecon-1', [cfLeg({ quantity: 2, cost_basis: supplied(3), broker_mark: supplied(3.3) })], [NOTE_NO_CONTRACT_DETAIL]),
  cfOption('cf-norecon-2', [cfLeg({ quantity: 2, cost_basis: supplied(4), broker_mark: supplied(4.1) })], [NOTE_NO_CONTRACT_DETAIL]),
]);

/** SPEC §2.11 — the shipped `unrealized_pl` render regression, extended to the GROUP surface. */
export const BOOK_CF_UNREALIZED_LEAK: BrokerBook = cfBook([
  { ...cfOption('cf-leak-1', [genericOptionLeg({ symbol: 'NVDA', underlying: 'NVDA', quantity: 10, cost_basis: supplied(7.89), broker_mark: supplied(4.85) })]),
    unrealized_pl: supplied(-7840.5) },
  { ...cfOption('cf-leak-2', [genericOptionLeg({ symbol: 'NVDA', underlying: 'NVDA', quantity: 5, cost_basis: supplied(6.1), broker_mark: supplied(5.2) })]),
    unrealized_pl: supplied(267.63) },
]);

/**
 * AC-15b — the SINGLE-LEG cascade arms. The third element is what the SHIPPED `brokerView.ts`
 * renders today (`FIGURE` = a dollar figure, not a literal). The byte-identity test asserts the
 * CORRECTED shared cascade produces exactly the same thing for every arm.
 */
export const SINGLE_LEG_CASCADE_ARMS: ReadonlyArray<[string, BrokerPosition, string]> = [
  ['all supplied', cfOption('sl-ok', [cfLeg({ quantity: 1, cost_basis: supplied(4), broker_mark: supplied(4.2) })]), 'FIGURE'],
  ['cost not supplied', cfOption('sl-nocost', [cfLeg({ quantity: 1, cost_basis: notSupplied(), broker_mark: notSupplied() })]), 'not provided'],
  ['cost unparseable', cfOption('sl-unparse', [cfLeg({ quantity: 1, cost_basis: unparseable(), broker_mark: supplied(4.2) })]), 'unavailable'],
  ['size absent, cost supplied', cfOption('sl-nosize', [cfLegNoSize({ quantity: 1, cost_basis: supplied(4), broker_mark: supplied(4.2) })]), 'not provided'],
  ['size absent AND cost not supplied', cfOption('sl-double', [cfLegNoSize({ quantity: 1, cost_basis: notSupplied(), broker_mark: notSupplied() })]), 'not provided'],
  ['size absent AND cost unparseable (permanence wins)', cfOption('sl-both', [cfLegNoSize({ quantity: 1, cost_basis: unparseable(), broker_mark: supplied(4.2) })]), 'not provided'],
  ['zero legs (unrecognized)', POS_UNRECOGNIZED, 'not provided'],
];
```

- [ ] **Step 4: Run until green** — `npx nx test @org/dashboard -- fixtures.contract` → PASS (12 tests),
  `echo $?` → `0`. If a captured-net assertion fails, **fix the per-unit costs, never the expected
  figures**: 3,850 / 3,805 / 13,760 / 7,890 / 4,990 are SPEC §1 ground truth and 7,890 is additionally
  pinned by a shipped passing test.

- [ ] **Step 5: Typecheck, scoped format, commit**

```
npx nx typecheck @org/dashboard
npx nx format:write --files=apps/dashboard/src/app/features/trading/broker/fixtures.ts,apps/dashboard/src/app/features/trading/broker/fixtures.contract.spec.ts
git add apps/dashboard/src/app/features/trading/broker/fixtures.ts apps/dashboard/src/app/features/trading/broker/fixtures.contract.spec.ts
git commit -m "test(broker): capture-complete book + every [CF] fixture, each asserting its own case"
```

**DoD for F1** — all five, or the verification track is built on sand:
1. `BOOK_CAPTURED_COMPLETE` holds 14 holdings and reproduces SPEC §1's five nets **to the cent**.
2. The captured book is **asserted** to exercise none of the `[CF]` cases.
3. Every `[CF]` fixture has an assertion naming the property it exists to provide.
4. `BOOK_CF_NO_SIZE` / `BOOK_CF_DOUBLY_BROKEN` prove `multiplier` is **absent**, not `null`.
5. `BOOK_CF_FUTURE_FEED`'s ticker is verified not to be a B2 term.

---

### Task F2: `brokerView.ts` — the shared cascade (defect repair #1), shared formatter, provenance boolean

**This repairs a shipped bug and proves the repair is a no-op where it must be.**
`brokerView.ts:207-216` currently returns `unavailable` on a **mixed** input (one leg's basis never
supplied, another's unparseable) — **transient beats permanent**, the opposite of what all three council
lanes independently ruled. It has never mattered because every Webull position maps to exactly one leg,
so the mixed case is unreachable inside a position. **A group of ≥2 legs reaches it for the first
time**, and there `unavailable` sells the trader a refresh that cannot work. The corrected cascade is
claimed byte-identical at leg level, and that claim is the entire justification for one shared
precedence function at both levels — **so this task VERIFIES the no-op, it does not assume it.**

**Files:** Modify `broker/brokerView.ts` (add exports after `:58`; replace the cascade at `:207-216`;
add one view field) · Test: extend `broker/brokerView.spec.ts`.

**Interfaces — Consumes:** `SINGLE_LEG_CASCADE_ARMS`, `NOTE_MULTIPLIER_RECONSTRUCTED`,
`BOOK_CF_NO_RECON_NOTE` (F1). **Produces** (the exact surface `grouping.ts`'s allow-list depends on):
`withheldLiteralOf(input: WithholdingInput): 'not provided' | 'unavailable' | null` ·
`interface WithholdingInput { contributing_legs: number; legs_multiplier_unknown: number;
legs_basis_not_supplied: number; legs_basis_unparseable: number }` ·
`netEntryFigureText(dollars: number, basis: 'net_debit' | 'net_credit'): string` ·
`NOTE_MULTIPLIER_RECONSTRUCTED: string` · `restsOnDerivedSize(notes: readonly string[]): boolean` ·
new field `BrokerPositionView.net_rests_on_derived_size: boolean`.

- [ ] **Step 1: Write the failing tests** — append to `broker/brokerView.spec.ts` (add the imports
  `withheldLiteralOf`, `netEntryFigureText`, `restsOnDerivedSize`, `NOTE_MULTIPLIER_RECONSTRUCTED`
  from `./brokerView`, and `SINGLE_LEG_CASCADE_ARMS`, `BOOK_CF_NO_RECON_NOTE`,
  `NOTE_MULTIPLIER_RECONSTRUCTED as FIXTURE_NOTE` from `./fixtures`):

```ts
describe('the corrected four-step cascade (SPEC §2.6)', () => {
  const cascade = (o: Partial<Parameters<typeof withheldLiteralOf>[0]>) =>
    withheldLiteralOf({
      contributing_legs: 2, legs_multiplier_unknown: 0,
      legs_basis_not_supplied: 0, legs_basis_unparseable: 0, ...o,
    });

  it('step 1 — a missing contract size is PERMANENT and outranks everything', () => {
    expect(cascade({ legs_multiplier_unknown: 1, legs_basis_unparseable: 1 })).toBe(NOT_PROVIDED);
  });

  it('step 2 beats step 3 — PERMANENCE FIRST. This is the shipped bug, corrected', () => {
    expect(cascade({ legs_basis_not_supplied: 1, legs_basis_unparseable: 1 })).toBe(NOT_PROVIDED);
  });

  it('step 3 — a transient cause alone is `unavailable`', () => {
    expect(cascade({ legs_basis_unparseable: 2 })).toBe(UNAVAILABLE);
  });

  it('step 4 — nothing withheld means the FIGURE renders (null, never a sixth literal)', () => {
    expect(cascade({})).toBeNull();
  });

  it('a zero-leg subject nets nothing — `not provided`, never a figure', () => {
    expect(cascade({ contributing_legs: 0 })).toBe(NOT_PROVIDED);
  });
});

describe('AC-15b — the correction is a BYTE-IDENTICAL no-op at leg level', () => {
  it.each(SINGLE_LEG_CASCADE_ARMS)('single-leg literal unchanged: %s', (_l, position, expected) => {
    const v = buildBrokerPositionView({ position, legMarks: new Map(), dte: null, nowMs: FIXED_NOW_MS, book: null });
    if (expected === 'FIGURE') expect(v.net_entry_text).toMatch(/^\$[\d,]+\.\d{2} (debit|credit)$/);
    else expect(v.net_entry_text).toBe(expected);
  });
});

describe('the shared net-entry figure formatter', () => {
  it('is the shipped grammar, to the character', () => {
    expect(netEntryFigureText(13760, 'net_debit')).toBe('$13,760.00 debit');
    expect(netEntryFigureText(-1250, 'net_credit')).toBe('$1,250.00 credit');
  });
  it('renders a POSITIVE magnitude with a direction WORD — never a minus sign', () => {
    expect(netEntryFigureText(-1250, 'net_credit')).not.toMatch(/[-−]/);
  });
});

describe('P2 — the provenance boolean comes from ONE exported production constant', () => {
  const viewOf = (p: BrokerPosition) =>
    buildBrokerPositionView({ position: p, legMarks: new Map(), dte: null, nowMs: FIXED_NOW_MS, book: null });

  it('the constant equals the fixtures note verbatim (the FE/BE prose seam)', () => {
    expect(NOTE_MULTIPLIER_RECONSTRUCTED).toBe(FIXTURE_NOTE);
  });
  it('TRUE on a captured option position, FALSE with the note absent', () => {
    expect(viewOf(POS_CAPTURE_NVDA_OPTION).net_rests_on_derived_size).toBe(true);
    expect(viewOf(BOOK_CF_NO_RECON_NOTE.positions[0]).net_rests_on_derived_size).toBe(false);
  });
  it('MUTATION GUARD: exact-string membership, not a substring sniff', () => {
    expect(restsOnDerivedSize([NOTE_MULTIPLIER_RECONSTRUCTED])).toBe(true);
    expect(restsOnDerivedSize([`${NOTE_MULTIPLIER_RECONSTRUCTED} (edited)`])).toBe(false);
    expect(restsOnDerivedSize([])).toBe(false);
  });
});
```

- [ ] **Step 2: Run and watch it fail** — `npx nx test @org/dashboard -- brokerView`. Expected: FAIL,
  the four symbols are not exported and `net_rests_on_derived_size` does not exist.

- [ ] **Step 3: Implement.** Insert after `brokerView.ts:58` (the `UNAVAILABLE` export):

```ts
/**
 * The adapter's reconstructed-multiplier note, verbatim (`webull_adapter.py`'s
 * `_NOTE_MULTIPLIER_RECONSTRUCTED`, appended ONLY on the fallback branch at `:231-232`).
 *
 * ONE production constant, matched against nothing else — never against `fixtures.ts`, which is
 * test-support imported by no render code (P2). The residual is a prose-string match across the FE/BE
 * seam and it fails SAFE: a backend copy edit flips the boolean false, the composition-only copy
 * renders, and member rows still carry the backend's own note verbatim on expand (SPEC §2.7).
 */
export const NOTE_MULTIPLIER_RECONSTRUCTED =
  "contract multiplier not supplied — reproduced exactly from Webull's own total_cost";

/** True iff this position's own notes say the contract size was worked out rather than supplied. */
export function restsOnDerivedSize(notes: readonly string[]): boolean {
  return notes.includes(NOTE_MULTIPLIER_RECONSTRUCTED);
}

/** Cause counts over the legs CONTRIBUTING to one netted figure — a position's, or a group's. */
export interface WithholdingInput {
  /** `0` ⇒ there is nothing to net (the zero-leg unrecognized entry). */
  contributing_legs: number;
  legs_multiplier_unknown: number;
  legs_basis_not_supplied: number;
  legs_basis_unparseable: number;
}

/**
 * The withheld-literal cascade — ONE function, called at BOTH levels (SPEC §2.6). Returns the literal
 * to render, or `null` when the figure itself renders.
 *
 *   1. any contributing leg's multiplier absent → `not provided`  (a units fact we do not hold)
 *   2. else any cost basis `not_supplied`       → `not provided`  (PERMANENT)
 *   3. else any cost basis `unparseable`        → `unavailable`   (transient — a refresh may fix it)
 *   4. else                                     → null (the figure)
 *
 * PERMANENCE FIRST. The shipped leg-level expression had steps 2 and 3 inverted — unreachable at N=1
 * (they cannot both fire) and reachable the moment a group of ≥2 legs exists, where `unavailable`
 * would sell the trader a refresh that cannot work. Applied at leg level this is BYTE-IDENTICAL to the
 * shipped output (pinned by AC-15b over `SINGLE_LEG_CASCADE_ARMS`), which is what makes one shared
 * function safe at both levels rather than a risky unification.
 *
 * The literal is chosen from per-leg CAUSE STATES, never by inspecting a number: `brokerLegsOf` writes
 * `entry_price: 0` for a non-supplied basis and `multiplier: NaN` for an omitted one, so a degraded sum
 * is a plausible-looking `0` or a `NaN` — and a `$0.00`/`$NaN` in the Net entry cell is the precise
 * failure this feature exists to prevent.
 */
export function withheldLiteralOf(
  input: WithholdingInput,
): typeof NOT_PROVIDED | typeof UNAVAILABLE | null {
  if (input.contributing_legs === 0) return NOT_PROVIDED;
  if (input.legs_multiplier_unknown > 0) return NOT_PROVIDED;
  if (input.legs_basis_not_supplied > 0) return NOT_PROVIDED;
  if (input.legs_basis_unparseable > 0) return UNAVAILABLE;
  return null;
}

/**
 * The net-entry figure grammar, extracted so a group and its children can never render two grammars in
 * one column (SPEC §2.2). A POSITIVE magnitude plus the direction WORD — never a minus sign, and never
 * a colour (green/red is reserved for P/L direction).
 */
export function netEntryFigureText(dollars: number, basis: 'net_debit' | 'net_credit'): string {
  const magnitude = Math.abs(dollars).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${magnitude} ${basis === 'net_debit' ? 'debit' : 'credit'}`;
}
```

Replace the inline cascade at `:207-216` with:

```ts
  const net_entry_text =
    withheldLiteralOf({
      contributing_legs: bp.legs.length,
      legs_multiplier_unknown: bp.legs.filter((l) => l.multiplier == null).length,
      legs_basis_not_supplied: bp.legs.filter((l) => l.cost_basis.state === 'not_supplied').length,
      legs_basis_unparseable: bp.legs.filter((l) => l.cost_basis.state === 'unparseable').length,
    }) ?? netEntryFigureText(base.net_entry_cost, base.net_entry_basis);
```

Add to the `BrokerPositionView` interface beside `multiplier_known`:

```ts
  /**
   * SPEC §2.7 — derived HERE and nowhere else: true iff this position's `fidelity_notes` carry the
   * reconstructed-multiplier note. The group ORs it across members. A hardcoded group-level sentence
   * would keep asserting reconstruction after the feed changed, on a zero-line diff; a derived one
   * disappears on that same diff.
   */
  net_rests_on_derived_size: boolean;
```

…and to the returned object beside `multiplier_known`:

```ts
    net_rests_on_derived_size: restsOnDerivedSize(bp.fidelity_notes ?? []),
```

- [ ] **Step 4: Prove nothing else moved**

```
npx nx test @org/dashboard
```
Expected: PASS with **every shipped broker assertion unchanged** — in particular
`genericOptionRow.spec.tsx:77` (`$7,890.00 debit`) and `:264`. Check the exit code.

**If a shipped assertion moved, the extraction is wrong — do not update the assertion.** The one
sanctioned behaviour change: a multi-leg *position* mixing causes now renders `not provided` where it
previously rendered `unavailable`. Same correction, intentional, and no position on the real feed
reaches it. **Record it for GATE Q.**

- [ ] **Step 5: Typecheck, scoped format, commit**

```
npx nx typecheck @org/dashboard
npx nx format:write --files=apps/dashboard/src/app/features/trading/broker/brokerView.ts,apps/dashboard/src/app/features/trading/broker/brokerView.spec.ts
git add apps/dashboard/src/app/features/trading/broker/brokerView.ts apps/dashboard/src/app/features/trading/broker/brokerView.spec.ts
git commit -m "fix(broker): permanence-first withheld cascade, shared at both levels — a proven no-op at leg level"
```

---

### Task F3: `groupCopy.ts` — every string this feature authors

**Why its own module rather than joining `copy.ts`:** `copy.ts` already holds `customTip` for the
shipped per-position chip, and its own comment at `:116` contains a banned word — so that file can never
be subjected to a literal structure-name scan without being exempted from it, and copy is precisely
where a name leaks. A new module can be scanned. **Shipped strings do not move; nothing in `copy.ts`
changes.**

**Files:** Create `broker/groupCopy.ts`. Test: covered by F5's component spec, F7 (scan) and F8 (render).

**Interfaces — Produces:** `GROUP_COPY` with exactly these members (F5 and F9 call them by name):
`countClause(legCount)` · `countTip` · `showLegs(ticker, legCount)` · `hideLegs(ticker, legCount)` ·
`loneLegClause` · `loneLegTip` · `nettedBy` · `nettedTip(restsOnDerivedSize)` ·
`expandedBasis(restsOnDerivedSize)` · `withheldTip(cause, n, m)` · `withheldReason(cause, n, m)` ·
`withheldCount(n, m)`. **Consumes:** `type WithheldCause` from `./grouping` (type-only; F4 defines it —
write the local `import type` line and let F4 satisfy it, or write F3 and F4 in one sitting and commit
F4 first if the type import blocks typecheck).

**Every string below was checked against BOTH predicate-set-B arms and collides with neither** (SPEC
§2.3's false-positive audit: `calendar`, `diagonal` and `covered` were given an explicit second look;
none appears). `call/put` appears deliberately — those two words are excluded from B2 precisely because
this copy needs them.

- [ ] **Step 1: Write the module** — `broker/groupCopy.ts`:

```ts
/**
 * Every trader-visible string this feature authors (SPEC §4, verbatim). NOT appended to `copy.ts`:
 * that file already carries the shipped per-position chip's tip and cannot be subjected to a literal
 * structure-name scan (SPEC §2.3). This module IS scanned — both arms of predicate set B run over it,
 * and Layer 3 asserts the outcome on every channel AC-4 names.
 *
 * RULE FOR ANY FUTURE EDIT: a shape word standing on its own here turns a test red. The fix is to
 * REWORD, never to weaken the predicate or delete a term (SPEC §9 item 5).
 *
 * Pure strings + tiny pure formatters. No React, no side effects, no imports but one type.
 */
import type { WithheldCause } from './grouping';

const legs = (n: number) => `${n} option leg${n === 1 ? '' : 's'}`;

export const GROUP_COPY = {
  /** `3 option legs · grouped by underlying` — part of the count element, not a sixth header item. */
  countClause: (legCount: number) => `${legs(legCount)} · grouped by underlying`,

  /** Keyboard-reachable tooltip on the count clause — never hover-only. */
  countTip:
    'Webull reports these as separate holdings on one underlying and sends no strike, expiry, or ' +
    'call/put. Grouping them by underlying is a fact; naming the shape would be a guess, so ' +
    "Convexa doesn't.",

  /** The disclosure button's accessible name. The chevron stays `aria-hidden`. */
  showLegs: (ticker: string, legCount: number) => `Show ${ticker}'s ${legs(legCount)}`,
  hideLegs: (ticker: string, legCount: number) => `Hide ${ticker}'s ${legs(legCount)}`,

  /**
   * AC-23 — the lone option leg (live twice on the captured book: NVDA, PLTR). PLAIN TEXT: no button,
   * no chevron, never a ghost one, no `netted by Convexa`. `as Webull reports it` names the count's
   * SOURCE; `not grouped` / `nothing to group` / `the only one on this ticker` were rejected because
   * they assert an ABSENCE OF SIBLINGS, which is the banned reading in other words.
   */
  loneLegClause: '1 option leg · as Webull reports it',
  loneLegTip:
    'Webull reports one option leg on this ticker — and sends no strike, expiry, or call/put with ' +
    "it. With one leg there's nothing to group and nothing to net, so this row shows that leg's own " +
    'figures, unchanged.',

  /** The basis label under the netted figure, so the figure never renders unlabeled. */
  nettedBy: 'netted by Convexa',

  /**
   * The basis-label tooltip. TRUE inserts ONE sentence before the existing tail; nothing else is
   * altered, so the clause is one auditable insertion rather than a rewrite. Absent from both: any
   * tolerance figure and any dollar difference (AC-10) — the FE cannot vouch the backend's 0.5%
   * round-trip bound, and the gap against Webull's own total is a number this app never displays.
   */
  nettedTip: (restsOnDerivedSize: boolean) =>
    restsOnDerivedSize
      ? 'Convexa added these legs up: for each one, per-contract cost × contract size × number of ' +
        'contracts, with money received counted against money paid. Webull doesn’t publish a ' +
        'combined cost for legs it reports separately, so this is Convexa’s arithmetic, not a ' +
        'Webull figure. For at least one of these legs Webull doesn’t state the contract size ' +
        'either, so Convexa worked that size out from the leg’s own Webull totals — expand the ' +
        'group for each leg’s own numbers and notes.'
      : 'Convexa added these legs up: for each one, per-contract cost × contract size × number of ' +
        'contracts, with money received counted against money paid. Webull doesn’t publish a ' +
        'combined cost for legs it reports separately, so this is Convexa’s arithmetic, not a ' +
        'Webull figure — expand the group for each leg’s own numbers and notes.',

  /** The sentence in the expanded panel (the shipped `leg-max-loss-note` slot's grammar). */
  expandedBasis: (restsOnDerivedSize: boolean) =>
    restsOnDerivedSize
      ? "Net entry is Convexa's arithmetic over the legs below, not a figure Webull sent — and for " +
        'at least one leg Convexa also worked out the contract size it used, because Webull ' +
        "didn't state one. The legs it applies to say so on their own rows. Advisory context, not " +
        'a broker figure.'
      : "Net entry is Convexa's arithmetic over the legs below, not a figure Webull sent. Advisory " +
        'context, not a broker figure.',

  /**
   * The withheld tooltip. `{n}` is the count for the cause THE RENDERED LITERAL NAMES (the union
   * cardinality); `{m}` is `leg_count`. Never a leg's identity — "the short leg" would be a guess.
   * A group is ≥2 legs by definition, so `{m} legs` is always plural.
   */
  withheldTip: (cause: WithheldCause, n: number, m: number): string => {
    const have = n === 1 ? 'has' : 'have';
    switch (cause) {
      case 'cost_missing':
        return `Webull's feed doesn't carry a cost for ${n} of these ${m} legs. Convexa won't show a partial total — each leg's own cost is below.`;
      case 'size_missing':
        return `Convexa doesn't have a contract size for ${n} of these ${m} legs, so it can't turn their per-contract costs into dollars — and it won't guess one.`;
      case 'both_permanent':
        return `For ${n} of these ${m} legs Convexa is missing either the cost Webull sent or the contract size to turn it into dollars — so it won't net them, and it won't guess. Each leg's own figures are below.`;
      case 'unreadable':
        return `Convexa couldn't read the cost Webull sent for ${n} of these ${m} legs, so it won't net them this cycle. Refresh for another read — each leg's own cost is shown below.`;
      default:
        return `${n} of these ${m} legs ${have} no usable figure.`;
    }
  },

  /** The visible reason line inside the expanded panel — ONE line, for the cause actually shown. */
  withheldReason: (cause: WithheldCause, n: number, m: number): string => {
    const head = `Net entry needs all ${m} legs.`;
    const have = n === 1 ? 'has' : 'have';
    const be = n === 1 ? 'is' : 'are';
    switch (cause) {
      case 'cost_missing':
        return `${head} ${n} ${have} no cost in Webull's feed.`;
      case 'size_missing':
        return `${head} ${n} ${have} no contract size.`;
      case 'both_permanent':
        return `${head} ${n} ${be} missing a cost or a contract size.`;
      case 'unreadable':
        return `${head} ${n} couldn't be read this cycle.`;
      default:
        return head;
    }
  },

  /**
   * The visible count beside a withheld literal (AC-17a). ALWAYS the count for the cause the rendered
   * literal names, out of `leg_count`. Never the other cause's count, never their sum, never
   * `leg_count − supplied`, and never a second count.
   */
  withheldCount: (n: number, m: number) => `${n} of these ${m} legs`,
} as const;
```

- [ ] **Step 2: Prove the copy passes both B arms before anything renders it.** A three-line temporary
  check is not enough; instead run F7's scan as soon as it exists. For now, run the vocabulary by hand:

```
node -e "const s=require('fs').readFileSync('apps/dashboard/src/app/features/trading/broker/groupCopy.ts','utf8');const B=[/\bverticals?\b/i,/\bspreads?\b/i,/\bcondors?\b/i,/\bbutterfl(?:y|ies)\b/i,/\bstraddles?\b/i,/\bstrangles?\b/i,/\bcollars?\b/i,/\biron\b/i,/\bcalendars?\b/i,/\bdiagonals?\b/i,/\bcovered\b/i,/\bprotective\b/i,/\bcustom\b/i];const hits=B.filter(r=>r.test(s)).map(String);console.log(hits.length?'B2 HITS: '+hits.join(' '):'clean');process.exit(hits.length?1:0)"
```
Expected: `clean`, exit `0`. **On a hit, reword the copy** — never touch the regex.

- [ ] **Step 3: Typecheck, scoped format, commit** (do this after F4 lands if the `WithheldCause`
  type-only import blocks typecheck — the two tasks may be committed in either order, F4 first)

```
npx nx typecheck @org/dashboard
npx nx format:write --files=apps/dashboard/src/app/features/trading/broker/groupCopy.ts
git add apps/dashboard/src/app/features/trading/broker/groupCopy.ts
git commit -m "feat(broker): groupCopy — every string this feature authors, in a scannable module"
```

---

### Task F4: `grouping.ts` — the pure, total, clock-injected group arithmetic

**Composition, not re-projection — the load-bearing decision.** The group composes
`BrokerPositionView[]` that are already built. It does **not** merge legs into a synthetic
`SimPosition` and re-run `buildPositionView`: re-projecting would silently manufacture, for holdings we
have not proven are one trade, a `structure` + `structure_label` + three `structure_line` variants
(**a NAME**), a `max_loss` (a claim about a shape), a scalar `qty` ("1 long + 2 short is not 3
contracts") and an `eval_subject` (one leg elected to speak for the group). **All four entry points to
the naming machine take a `SimPosition`, so "this module constructs no `SimPosition`" closes all four at
once — including against the future**, when `positions/structure.ts:153`'s guard stops firing and a
merged two-leg set would return a name with nobody deciding it.

**Files:** Create `broker/grouping.ts` · Test `broker/grouping.spec.ts`.

**Interfaces — Consumes:** `BrokerPositionView`, `NOT_PROVIDED`, `UNAVAILABLE`, `netEntryFigureText`,
`withheldLiteralOf` (F2, via `./brokerView`); `isStale` (via `./predicates`); `BrokerBook` type (via
`@org/api`). **Nothing from `positions/*`** — an allow-list closes paths that do not exist yet, and two
consequences fall out for free: the group **cannot** compute a percentage (`plPctStateOf` lives in
`positions/leg.ts`) and **cannot** reach `NET_BASIS_EPS`, `STRUCTURE_LABELS` or `StructureKind`.
**Produces:** `groupBook`, `groupNetEntryText`, `withheldCountOf`, `withheldCauseOf`, and the types
`GroupKey`, `BrokerGroup`, `BrokerGroupNet`, `GroupedBook`, `WithheldCause`.

**Three planning-level reconciliations recorded here so no implementer improvises under a red test:**

1. **`§2.5`'s "non-finite multiplier routes to ungrouped" vs AC-12's "a missing contract size withholds
   the net".** Read together, the only coherent split is: `multiplier` **absent** (`== null`) is a
   legitimate permanent withholding cause and the position **is** a member; a `multiplier` that is
   **present but non-finite** (only reachable from a malformed payload) is malformedness and routes to
   `ungrouped`. Same for a non-finite `quantity`.
2. **A multi-underlying option position** is not addressed by the spec; it is ambiguous by construction,
   so it routes to `ungrouped` under §2.5's malformed-member rule.
3. **Singleton agreement vs the `$0.00` rule.** §2.2 requires `group.net_entry_text ===
   member.net_entry_text` byte-identical at `position_count === 1`; §2.2's zero rule renders `$0.00`
   bare at group level while child rows keep their word. These conjoin inconsistently for exactly one
   input — a single-leg position whose supplied cost basis rounds to zero — and that group **never
   renders as a group** (§2.5). The plan implements both rules as written, tests singleton agreement on
   the captured book's two lone legs (both non-zero), and **pins the divergence explicitly** so it is
   deliberate rather than accidental. Flagged for GATE Q as an observation, not a blocker.

- [ ] **Step 1: Write the failing unit spec** — `broker/grouping.spec.ts`. Build views with
  `buildBrokerPositionView` over the F1 books, then assert:

```ts
const groupsOf = (book: BrokerBook) =>
  groupBook(
    book.positions.map((position) =>
      buildBrokerPositionView({ position, legMarks: new Map(), dte: null, nowMs: FIXED_NOW_MS, book }),
    ),
    book,
    FIXED_NOW_MS,
  );
```

| Test name | Assertion |
|---|---|
| `AC-1 — the captured book yields 3 groups + 2 lone entries + 5 equity rows` | `groups.filter(g => g.leg_count > 1)` keys are `['AAPL','META','TSLA']`; `groups.filter(g => g.leg_count === 1)` keys are `['NVDA','PLTR']`; `ungrouped` has 5 (all equity) |
| `AC-8 — a group's net equals the signed sum of its members' rendered figures` | AAPL `3850` / META `3805` / TSLA `13760`, and `net_entry_text` is `$13,760.00 debit` etc.; **also** assert the sum equals the sum of `members.map(m => m.net_entry_cost)` |
| `AC-9b — a credit group renders the word, positive magnitude, no minus` | on `BOOK_CF_CREDIT`: `basis === 'net_credit'`, text matches `/^\$1,600\.00 credit$/` |
| `AC-9c — a group netting to 0.00 renders `$0.00` with NO direction word` | on `BOOK_CF_ZERO_NET`: `net_entry_text === '$0.00'`; and `groupNetEntryText(0.004,'net_debit') === '$0.00'`, `groupNetEntryText(0.006,'net_debit') === '$0.01 debit'` |
| `AC-12 — a missing cost or contract size withholds the net entirely` | on `BOOK_CF_NO_COST` and `BOOK_CF_NO_SIZE`: `net_entry.kind === 'withheld'`, literal `not provided`, and `net_entry_text` is never `'$0.00'`/`'$NaN'` |
| `AC-13 — a withheld net withholds the P/L with it` | same books: `pl_dollar === null` |
| `AC-13 — FORBIDDEN IMPLEMENTATION: a partial P/L sum` | a group with one `pl_dollar: null` member and one non-null ⇒ `pl_dollar === null`, and explicitly `not toBe(theNonNullMemberValue)` |
| `AC-14 — a transient cause is `unavailable`, textually distinct` | `BOOK_CF_UNPARSEABLE` ⇒ `'unavailable'`; and neither literal is producible by the other's condition |
| `AC-15 — mixed causes: `not provided` wins, deterministically` | `BOOK_CF_MIXED_CAUSE` ⇒ `'not provided'` |
| `AC-17b — the union count: a doubly-broken leg is counted ONCE` | `BOOK_CF_DOUBLY_BROKEN` ⇒ `legs_withholding_permanent === 1`, `leg_count === 2`, `withheldCountOf(g) === 1`, and `legs_basis_not_supplied + legs_multiplier_unknown === 2` (the number NOT rendered) |
| `AC-6 / AC-6c — leg_count comes from the wire legs, not the position count` | `BOOK_CF_TWO_LEG_MEMBER` ⇒ `leg_count === 3`, `position_count === 2` |
| `AC-22 — an equity leg is never a member and never a contributor` | AAPL's group has 2 members, both option-only; the equity row is in `ungrouped` |
| `AC-24a — an `unrecognized` entry is never grouped or counted` | `POS_UNRECOGNIZED` in the book ⇒ present in `ungrouped`, absent from every group, `Σ leg_count` unchanged |
| `AC-33 — ordering is deterministic and stable` | `groups.map(g => g.key)` is ascending; `members.map(m => m.broker.broker_position_id)` is ascending; two calls on the same book deep-equal |
| `totality — never throws, and a malformed member routes to ungrouped` | empty array; a view whose legs are `[]`; a blank `underlying`; a mixed-underlying position; a present-but-`NaN` multiplier ⇒ all in `ungrouped`, no throw |
| `the invariants in §2.6 hold on every fixture book` | `legs_basis_not_supplied + legs_basis_unparseable <= leg_count` and `legs_withholding_permanent + legs_withholding_transient <= leg_count` |
| `modeled_label is derived at the GROUP from isStale, never read off members[0]` | with `BOOK_CAPTURED_COMPLETE` at a stale `as_of` ⇒ every group `'dual'`; fresh ⇒ `'single'` |
| `P1/P3 — provenance ORs across members; absent when withheld, present on $0.00` | `BOOK_CAPTURED_COMPLETE` ⇒ `true`; `BOOK_CF_NO_RECON_NOTE` ⇒ `false`; `BOOK_CF_ZERO_NET` ⇒ `true` with `kind === 'value'` |
| `singleton agreement on the captured lone legs` | for NVDA and PLTR: `g.net_entry_text === g.members[0].net_entry_text` |
| `the deliberate zero-net singleton divergence is PINNED, not accidental` | a one-position group with a supplied basis of `0` ⇒ group `'$0.00'`, member `'$0.00 debit'` (documented, never rendered as a group) |
| `no group field can name a shape` | `Object.keys(group)` contains none of `structure`, `structure_label`, `structure_line`, `max_loss`, `qty`, `eval_subject`, `pl_pct` |

- [ ] **Step 2: Run and watch it fail** — `npx nx test @org/dashboard -- grouping`. Expected: FAIL,
  `./grouping` does not exist.

- [ ] **Step 3: Write the module** — `broker/grouping.ts`:

```ts
/**
 * grouping — the ONE place group arithmetic lives (SPEC §2.1). Pure, total, clock-injected, never
 * throws; the same shape as `positions/derive.ts` and `renderState.ts`. Called by `BrokerTabPanel`
 * immediately after the existing `views` memo, before render.
 *
 * COMPOSITION, NOT RE-PROJECTION (§2.2). This module composes `BrokerPositionView[]` that are already
 * built. It never merges legs into a synthetic position and never re-runs the projection: doing so
 * would manufacture a name, a max loss, a scalar quantity and an evaluation subject for holdings
 * nobody has proven are one trade. Composition yields exactly the contract: a count and a net.
 *
 * IMPORT ALLOW-LIST, enforced by `eslint.config.mjs` (Layer 1) and by a source scan (Layer 2):
 * `./brokerView`, `./predicates`, and `@org/api` TYPES ONLY. Nothing from `positions/*` — all four
 * entry points to the naming machine take a position record, so importing none of them closes all four
 * at once, including against the future. Two consequences fall out for free: no percentage is
 * computable here, and the epsilon/label/kind vocabulary is out of reach.
 *
 * NO LEG ARRAY IS EVER MATERIALISED AT GROUP LEVEL as a projection input; the wire legs are read only
 * to COUNT and to gate.
 */
import type { BrokerBook } from '@org/api';
import {
  NOT_PROVIDED,
  UNAVAILABLE,
  netEntryFigureText,
  withheldLiteralOf,
  type BrokerPositionView,
} from './brokerView';
import { isStale } from './predicates';

/** The uppercased underlying ticker — a FACT. The React key AND the sort key. */
export type GroupKey = string;

/** Which cause the rendered literal names — the closed vocabulary the copy layer maps. */
export type WithheldCause = 'cost_missing' | 'size_missing' | 'both_permanent' | 'unreadable';

/**
 * A discriminated union, not a nullable number: a caller cannot obtain the dollars without going
 * through `kind === 'value'`, so a withheld group cannot be summed, formatted or compared by accident.
 * That is `[absent-is-not-none]` enforced in the type.
 */
export type BrokerGroupNet =
  | { kind: 'value'; dollars: number; basis: 'net_debit' | 'net_credit' }
  | { kind: 'withheld'; literal: typeof NOT_PROVIDED | typeof UNAVAILABLE };

export interface BrokerGroup {
  key: GroupKey;
  /** === key. The header names a fact. */
  ticker: string;
  /** Sorted by `broker_position_id` ascending (the wire guarantees it is stable across refreshes). */
  members: BrokerPositionView[];
  position_count: number;
  /**
   * Σ member.broker.legs.length — the RAW WIRE legs. Carried alongside `position_count` even though
   * they are equal today: under the Webull adapter every option row maps to exactly one leg, and a
   * future adapter diverges. Two integers on a derived, never-persisted struct cost nothing and
   * prevent a silent semantic change to a number a trader is reading.
   */
  leg_count: number;
  /** THE GATE — evaluated BEFORE any sum, AND over members. */
  entry_known: boolean;
  multiplier_known: boolean;
  /** STRING INPUTS ONLY — these may never gate a computation. */
  legs_basis_not_supplied: number;
  legs_basis_unparseable: number;
  legs_multiplier_unknown: number;
  /** The UNION cardinality. Summing the cause counts double-counts a doubly-broken leg. */
  legs_withholding_permanent: number;
  legs_withholding_transient: number;
  net_rests_on_derived_size: boolean;
  net_entry: BrokerGroupNet;
  /** The figure (shared formatter, plus the group-only zero rule), or EXACTLY one existing literal. */
  net_entry_text: string;
  /** ALL-OR-NOTHING over members. */
  pl_dollar: number | null;
  unavailable: boolean;
  frozen: boolean;
  modeled_label: 'single' | 'dual';
}

export interface GroupedBook {
  groups: BrokerGroup[];
  ungrouped: BrokerPositionView[];
}

/**
 * The group-level net-entry text. The shared figure grammar, plus the ONE group-level addition: when
 * the formatted magnitude is `0.00`, render `$0.00` with no direction word — the direction of a zero
 * net is not a fact. This keys on the FORMATTED MAGNITUDE under ordinary 2-decimal currency rounding
 * and on nothing else (`0.004` drops the word; `0.006` formats to `0.01` and keeps it). It is NOT an
 * epsilon, and the percent-denominator constant in `positions/*` is neither this threshold nor
 * reachable from here. Child rows are untouched by this rule.
 */
export function groupNetEntryText(dollars: number, basis: 'net_debit' | 'net_credit'): string {
  const magnitude = Math.abs(dollars).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return magnitude === '0.00' ? '$0.00' : netEntryFigureText(dollars, basis);
}

/** The count that belongs to the literal actually shown — never the other, never their sum. */
export function withheldCountOf(group: BrokerGroup): number | null {
  if (group.net_entry.kind !== 'withheld') return null;
  return group.net_entry.literal === NOT_PROVIDED
    ? group.legs_withholding_permanent
    : group.legs_withholding_transient;
}

/** Which cause the rendered literal names (drives the one tooltip and the one reason line). */
export function withheldCauseOf(group: BrokerGroup): WithheldCause | null {
  if (group.net_entry.kind !== 'withheld') return null;
  if (group.net_entry.literal === UNAVAILABLE) return 'unreadable';
  const noCost = group.legs_basis_not_supplied > 0;
  const noSize = group.legs_multiplier_unknown > 0;
  if (noCost && noSize) return 'both_permanent';
  if (noSize) return 'size_missing';
  return 'cost_missing';
}

/**
 * Group-eligible iff EVERY leg is an option AND the resolved underlying is one non-empty string.
 * Everything else routes to `ungrouped` and renders exactly as it renders today:
 *  - zero mapped legs (the `unrecognized` entry) is unkeyable — surfaced, never grouped, never counted;
 *  - ANY equity leg — netting share cost into an option group produces a dollar figure with no product
 *    meaning, and is the first step toward naming a shape;
 *  - a blank underlying, mixed underlyings, or a PRESENT-but-non-finite multiplier or quantity, which
 *    is malformedness. An ABSENT multiplier is NOT malformedness: it is a permanent withholding cause
 *    and the position stays a member (AC-12).
 */
function groupKeyOf(view: BrokerPositionView): GroupKey | null {
  const legs = view.broker.legs;
  if (legs.length === 0) return null;
  if (!legs.every((l) => l.kind === 'option')) return null;
  for (const l of legs) {
    if (l.multiplier != null && !Number.isFinite(l.multiplier)) return null;
    if (!Number.isFinite(l.quantity)) return null;
  }
  const raw = legs[0].underlying;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  if (!legs.every((l) => l.underlying === raw)) return null;
  return raw.toUpperCase();
}

function buildGroup(
  key: GroupKey,
  unsorted: readonly BrokerPositionView[],
  modeled_label: 'single' | 'dual',
): BrokerGroup {
  const members = [...unsorted].sort((a, b) =>
    a.broker.broker_position_id < b.broker.broker_position_id
      ? -1
      : a.broker.broker_position_id > b.broker.broker_position_id
        ? 1
        : 0,
  );

  const wireLegs = members.flatMap((m) => m.broker.legs);
  const leg_count = wireLegs.length;

  let legs_basis_not_supplied = 0;
  let legs_basis_unparseable = 0;
  let legs_multiplier_unknown = 0;
  let legs_withholding_permanent = 0;
  let legs_withholding_transient = 0;

  for (const l of wireLegs) {
    const noCost = l.cost_basis.state === 'not_supplied';
    const unreadable = l.cost_basis.state === 'unparseable';
    const noSize = l.multiplier == null;
    if (noCost) legs_basis_not_supplied += 1;
    if (unreadable) legs_basis_unparseable += 1;
    if (noSize) legs_multiplier_unknown += 1;
    // THE UNION: a doubly-broken leg is ONE permanent leg, never two. Summing the cause counts would
    // state "2 of 2 legs" for a 2-leg group in which one leg is entirely fine.
    if (noCost || noSize) legs_withholding_permanent += 1;
    else if (unreadable) legs_withholding_transient += 1;
  }

  // THE GATE, evaluated BEFORE any sum, AND over members.
  const entry_known = leg_count > 0 && members.every((m) => m.entry_known);
  const multiplier_known = leg_count > 0 && members.every((m) => m.multiplier_known);

  const literal = withheldLiteralOf({
    contributing_legs: leg_count,
    legs_multiplier_unknown,
    legs_basis_not_supplied,
    legs_basis_unparseable,
  });

  let net_entry: BrokerGroupNet;
  if (literal != null || !entry_known || !multiplier_known) {
    net_entry = { kind: 'withheld', literal: literal ?? NOT_PROVIDED };
  } else {
    // Σ member.net_entry_cost — the signed number already on the projection, i.e. the same arithmetic
    // each member row renders in its own Net entry cell. Finiteness-checked AFTER the sum (belt and
    // braces: the multiplier gate above already ran BEFORE it).
    const dollars = members.reduce((acc, m) => acc + m.net_entry_cost, 0);
    net_entry = Number.isFinite(dollars)
      ? { kind: 'value', dollars, basis: dollars > 0 ? 'net_debit' : 'net_credit' }
      : { kind: 'withheld', literal: NOT_PROVIDED };
  }

  // ALL-OR-NOTHING. `Σ (member.pl_dollar ?? 0)` is a NAMED FORBIDDEN implementation: the reason is
  // SIGN INVERSION, not incompleteness — drop the short member of an apparent two-leg holding and a
  // losing group renders as a winner. This is equal-or-stricter than a leg-level fold, because a
  // member's `pl_dollar` is already nulled when its own entry is withheld.
  const everyPl = members.every((m) => m.pl_dollar != null);
  const summedPl = everyPl ? members.reduce((acc, m) => acc + (m.pl_dollar as number), 0) : null;

  return {
    key,
    ticker: key,
    members,
    position_count: members.length,
    leg_count,
    entry_known,
    multiplier_known,
    legs_basis_not_supplied,
    legs_basis_unparseable,
    legs_multiplier_unknown,
    legs_withholding_permanent,
    legs_withholding_transient,
    net_rests_on_derived_size: members.some((m) => m.net_rests_on_derived_size),
    net_entry,
    net_entry_text:
      net_entry.kind === 'withheld'
        ? net_entry.literal
        : groupNetEntryText(net_entry.dollars, net_entry.basis),
    pl_dollar: summedPl != null && Number.isFinite(summedPl) ? summedPl : null,
    unavailable: members.some((m) => m.unavailable),
    frozen: members.some((m) => m.frozen),
    modeled_label,
  };
}

/**
 * Total: every eligible position lands in a group (N ≥ 1), everything else in `ungrouped`. Groups sort
 * by key ascending, members by broker id ascending — both FACTS. Sorting by a derived number (P/L, net
 * entry) is explicitly rejected: the mark ladder re-resolves on every live tick, so rows would jump
 * under the trader's cursor.
 *
 * `modeled_label` is derived HERE from the book, never read off `members[0]`, which would break
 * silently if a member were ever filtered.
 */
export function groupBook(
  views: readonly BrokerPositionView[],
  book: BrokerBook | null,
  nowMs: number,
): GroupedBook {
  const modeled_label: 'single' | 'dual' = isStale(book, nowMs) ? 'dual' : 'single';

  const buckets = new Map<GroupKey, BrokerPositionView[]>();
  const ungrouped: BrokerPositionView[] = [];

  for (const view of views) {
    const key = groupKeyOf(view);
    if (key == null) {
      ungrouped.push(view);
      continue;
    }
    const bucket = buckets.get(key);
    if (bucket == null) buckets.set(key, [view]);
    else bucket.push(view);
  }

  const groups = [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, members]) => buildGroup(key, members, modeled_label));

  return { groups, ungrouped };
}
```

- [ ] **Step 4: Run until green**

```
npx nx test @org/dashboard -- grouping
npx nx test @org/dashboard
```
Expected: PASS; the whole suite still green. Check exit codes.

- [ ] **Step 5: Typecheck, scoped format, commit**

```
npx nx typecheck @org/dashboard
npx nx format:write --files=apps/dashboard/src/app/features/trading/broker/grouping.ts,apps/dashboard/src/app/features/trading/broker/grouping.spec.ts
git add apps/dashboard/src/app/features/trading/broker/grouping.ts apps/dashboard/src/app/features/trading/broker/grouping.spec.ts
git commit -m "feat(broker): groupBook — a count and a net, composed and never re-projected"
```

---

### Task F5: `BrokerGroupHeader.tsx` — the ONE shared presentational unit (+ the panel shell)

**A group header authored twice diverges twice.** One shared unit consumed by desktop and mobile alike
is the shipped pattern (`FactText`, `ModeledPl`, `LegLines`, `StructureChip`, `FidelityNotes` are all
shared today) and the direct mitigation of the recorded desktop/mobile divergence this feature also
repairs (F10). This module also exports the **panel shell**, so every group-rendering JSX string lives
inside the scanned file and `BrokerTabPanel.tsx` authors none.

**Files:** Create `broker/BrokerGroupHeader.tsx` · Test `broker/BrokerGroupHeader.spec.tsx` · Modify
`broker/unrenderedBrokerPl.spec.tsx` (extend the shipped regression to the group surface).

**Interfaces — Consumes:** `BrokerGroup`, `withheldCountOf`, `withheldCauseOf` (F4); `GROUP_COPY` (F3);
`FactText`, `STALE_SNAPSHOT_SX` from `./BrokerPositionRow`; `BROKER_COPY`, `stampTime` from `./copy`;
`money` from `positions/labels` (NOT on the deny-list, which names only `structure`, `view`, `leg`);
`typographyTokens`. **Produces:** `BrokerGroupHeader(props)` and `BrokerGroupPanel(props)`.

```ts
export interface BrokerGroupHeaderProps {
  group: BrokerGroup;
  /** `row` = the desktop grid line. `card` = the mobile full-width disclosure at ≥44px. */
  variant: 'row' | 'card';
  expanded: boolean;
  onToggle: () => void;
  /** `aria-controls` target — the panel is ALWAYS rendered, so this never dangles. */
  panelId: string;
  streamOffline: boolean;
  isStale: boolean;
  asOf: string | null;
}
export interface BrokerGroupPanelProps {
  group: BrokerGroup;
  id: string;
  expanded: boolean;
  /** The member rows/cards, supplied by the parent. */
  children: ReactNode;
}
```

**Structure, binding (SPEC §4):**

- **Desktop:** the header is a row in **the same 4-column grid as its legs** —
  `minmax(220px, 1.6fr) minmax(120px, 1fr) minmax(110px, 1fr) auto` — so every column lines up. The
  identity cell **spans columns 1–2** (`gridColumn: '1 / span 2'`), so **no quantity cell exists at
  group level** (AC-16b: never a blank cell). Column 3 = the netted figure or its literal **plus its
  basis label**. Column 4 = the combined P/L **and nothing else** (no reassessment slot, AC-30).
- **Mobile:** the entire header line is the full-width disclosure button at **≥44px**; net entry + P/L
  sit in the meta row; **the quantity slot is omitted entirely.**
- **Semantics:** the header is **not** a heading (no `<h*>`; stat values are not headings). Group + legs
  are `ul`/`li`, matching the shipped `LegDisclosurePanel`. The chevron is `aria-hidden` and **must not
  be an arc** (the convex arc is set-pinned to three places). The button's accessible name comes from
  `GROUP_COPY.showLegs`/`hideLegs`. **The header must NOT sit inside a container that draws its own
  outline** — `BrokerPositionRow` draws `&:focus-within { outline: 2px solid primary.main }`, which
  would stack with the theme's single authored `*:focus-visible` amber ring. Exactly one indicator
  renders (AC-36).
- **No motion:** no MUI `<Accordion>`, no transition, no keyframe. Nothing to gate behind
  reduced-motion because nothing animates.
- **Panel:** always rendered, `hidden` when collapsed; the shipped disclosure grammar — a 1px left
  `divider` rule and an indent. The panel carries `GROUP_COPY.expandedBasis(...)` when the net is a
  figure, and `GROUP_COPY.withheldReason(...)` **replacing** it whenever the figure is withheld — one
  line, for the cause the rendered literal names. **No group-level fidelity-note line.**
- **Degradation:** the snapshot family (identity, count, clause, net entry, basis label) takes
  `STALE_SNAPSHOT_SX` (0.62) when `isStale`; the P/L takes `⏸ ` + `opacity: 0.5` when `streamOffline`
  and **never blanks**; the netted entry keeps rendering **undimmed** on a mark-feed drop (it is
  static). The **control never dims and never disables** on either axis.
- **Tooltips must be keyboard-reachable, never hover-only** — the count clause and the basis label each
  wrap a `tabIndex={0}` span inside a MUI `Tooltip`.
- **The provenance clause renders only where the FIGURE renders** — absent on every withheld state
  (nothing to qualify), **present** on the `$0.00` case (still a figure), and a mixed group says "at
  least one" and never a count (the note is position-granular, the withholding counts are leg-granular).
- **Testids** (F8/F9/F11 select on these): `broker-group-header` · `broker-group-toggle` ·
  `broker-group-count` · `broker-group-net` · `broker-group-net-label` · `broker-group-withheld-count` ·
  `broker-group-pl` · `broker-group-pl-label` · `broker-group-panel` · `broker-group-note`.

- [ ] **Step 1: Write the failing component spec** — `broker/BrokerGroupHeader.spec.tsx`, run over
  **both variants** via `describe.each(['row','card'] as const)`:

| Test | Assertion |
|---|---|
| AC-2 — the header carries exactly five things | ticker · `broker-group-count` (with its clause) · `broker-group-net` + `broker-group-net-label` · `broker-group-pl` + label · `broker-group-toggle`; and the right rail contains the P/L and nothing else |
| AC-3 / AC-16b — no quantity figure, no percent | header text has no `×`, no `%`; `queryByTestId('broker-qty')` is null; on `row` the identity cell's computed `gridColumn` spans 2 |
| AC-6b — the noun and the number | count text is `3 option legs · grouped by underlying` on the captured TSLA group; `2 option legs` on AAPL/META; the words `positions`/`rows`/`holdings`/`contracts`/`trades` appear nowhere |
| AC-9 — one figure with the shipped direction word + a named basis | `$13,760.00 debit` and the label `netted by Convexa`; a figure never renders without the label |
| AC-9c + P3 — `$0.00` bare, clause still present | on `BOOK_CF_ZERO_NET`: net text `$0.00`, no `debit`/`credit`, and the derived-size tooltip variant renders |
| AC-16a — only two literals can appear in the two slots | on every `[CF]` withheld book: net and P/L text ∈ {`not provided`,`unavailable`}; `not recorded` and `no basis` appear nowhere |
| AC-17a — the count beside the literal | `broker-group-withheld-count` reads `1 of these 2 legs` on `BOOK_CF_DOUBLY_BROKEN`; exactly ONE count element renders |
| AC-13 — the P/L is withheld with the net, same literal | on `BOOK_CF_NO_COST`: both slots read `not provided` |
| AC-18 — snapshot stale | with `isStale`, the snapshot family carries opacity 0.62 and the P/L label is the dual `modeled now · on your book as of …` |
| AC-19 — mark feed down | with `streamOffline`, `broker-group-pl` starts `⏸ `, opacity 0.5, and is non-empty; `broker-group-net` has **no** reduced opacity |
| AC-30 / AC-32 — no reassess, no write affordance | the only `button` in the header is `broker-group-toggle`; no `Build reassessment`, no disabled variant, no `coming soon` |
| AC-36 — the disclosure is real and resolves | `<button type="button">` with an accessible name, `aria-expanded` flipping, and `aria-controls` resolving to a rendered element in **both** states; Enter and Space both toggle |
| P1 — the clause is absent when the boolean is false | `BOOK_CF_NO_RECON_NOTE`: neither tooltip nor panel sentence asserts a contract-size origin |
| the panel replaces the basis sentence when withheld | `broker-group-note` reads `Net entry needs all 2 legs. 1 is missing a cost or a contract size.` on the doubly-broken book, and the basis sentence is absent |

Tooltip pattern (the repo's proven idiom — `faulted.a11y.spec.tsx:62-71`): `await user.tab()` until the
target has focus, then `await screen.findByRole('tooltip')`.

- [ ] **Step 2: Run and watch it fail** (module does not exist).

- [ ] **Step 3: Implement `BrokerGroupHeader.tsx`.** Build it to the structure above. Non-negotiable
  implementation notes:
  - The count clause and basis label are `Tooltip`-wrapped `tabIndex={0}` spans.
  - The P/L block reuses `FactText` for the withheld case and `money()` for the figure; when withheld it
    renders **the net's own literal** (`group.net_entry.kind === 'withheld' ? group.net_entry.literal :
    UNAVAILABLE`) so the precedence can never diverge from the net's.
  - The label strings are `BROKER_COPY.modeled.label` / `dualLabel(stampTime(asOf))` — reused verbatim,
    never re-authored.
  - Type/token discipline: `typographyTokens.monoFontFamily` + `tabular-nums` for the count and every
    figure; ticker 0.95rem/700; count 0.8rem mono; basis clause 0.75rem; `netted by Convexa` 0.6875rem
    (= 11px, the shipped floor, matching `broker-pl-label`). No zebra/raised background behind group
    rows — a collapsed group is a **peer** of an ungrouped row.
  - **No `Divider`, no `verticalAlign`, no B2 word in any comment.**

- [ ] **Step 4: Extend the shipped `unrealized_pl` regression to the group** (SPEC §2.11). In
  `broker/unrenderedBrokerPl.spec.tsx`, add one arm that renders `BrokerGroupHeader` (both variants,
  both axes) for the group built from `BOOK_CF_UNREALIZED_LEAK` and asserts no form of `-7840.5` /
  `267.63` reaches `container.textContent`. Reuse the file's existing `renderedForms` helper unchanged.

- [ ] **Step 5: Run, typecheck, format, commit**

```
npx nx test @org/dashboard
npx nx typecheck @org/dashboard
npx nx format:write --files=apps/dashboard/src/app/features/trading/broker/BrokerGroupHeader.tsx,apps/dashboard/src/app/features/trading/broker/BrokerGroupHeader.spec.tsx,apps/dashboard/src/app/features/trading/broker/unrenderedBrokerPl.spec.tsx
git add apps/dashboard/src/app/features/trading/broker/BrokerGroupHeader.tsx apps/dashboard/src/app/features/trading/broker/BrokerGroupHeader.spec.tsx apps/dashboard/src/app/features/trading/broker/unrenderedBrokerPl.spec.tsx
git commit -m "feat(broker): one shared group header + panel shell, desktop and mobile"
```

---

### Task F6: Layer 1 — the ESLint import allow-list / deny-list, proven to bite

**Build-breaking on `nx lint`, which CI gates.** `grouping.ts` gets the **allow-list** form — an
allow-list closes paths that do not exist yet, where a deny-list naming `structure.ts` is evadable
through a re-export. The two presentational modules get the **deny-list** form, and **that asymmetry is
deliberate**: they must import `react`, `@mui/material` and shared primitives, so an allow-list is not
expressible there. Layers 2 and 3 — textual and outcome-based rather than path-based — are what actually
carry the presentation layer.

**Accepted limitation, named rather than implied:** the delegation holds against **accidental** leaks
(a banned identifier still has to appear as literal text to be used, and Layer 2's set A catches it
regardless of import path). It does **not** hold against **deliberate** evasion —
`import { structureKindOf as x }` erases the identifier from the file's own source text. That residual
is **accepted, not closed**; Layer 3 still fails on the outcome. Written down so a later reader does not
mistake the delegation for a proof against an adversary.

**Files:** Modify `eslint.config.mjs` (append two override objects before the closing `]`).

- [ ] **Step 1: Add the allow-list override for `grouping.ts`**

```js
  // ---- broker-option-grouping · Layer 1 of the no-naming machinery (SPEC §2.3) -------------------
  // File-NAMED deliberately: a directory-wide override would have to re-exempt every shipped module in
  // broker/. That means an implementer CAN forget to add a fourth file here — which is why Layer 2's
  // file set is defined by EXCLUSION and its glob shaped so that forgetting is VISIBLE, not silent.
  {
    files: ['**/features/trading/broker/grouping.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**', '!./brokerView', '!./predicates', '!@org/api'],
              message:
                'grouping.ts carries an ALLOW-LIST (SPEC §2.3): ./brokerView, ./predicates and @org/api types ONLY. Nothing from positions/* — that is where a structure name is computed.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/features/trading/broker/BrokerGroupHeader.tsx',
      '**/features/trading/broker/groupCopy.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/features/trading/positions/structure',
                '**/features/trading/positions/view',
                '**/features/trading/positions/leg',
              ],
              message:
                'A group-rendering or group-copy module may not import positions/{structure,view,leg}: those three specifiers hold all four entry points to the naming machine plus the label dictionary (SPEC §2.3). Any further module this feature adds joins this override.',
            },
          ],
        },
      ],
    },
  },
```

- [ ] **Step 2: Prove the allow-list bites — TWICE, because a passing lint proves nothing**

Temporarily add to `grouping.ts`:
```ts
import { structureKindOf } from '@/features/trading/positions/structure';
```
Run `npx nx lint @org/dashboard`. **Expected: FAIL** on that line. Revert it.

Then temporarily add:
```ts
import { Box } from '@mui/material';
```
Run `npx nx lint @org/dashboard`. **Expected: FAIL** — this is what distinguishes the allow-list from a
deny-list. Revert it.

**If the second run PASSES, the negation glob is not honoured by this ESLint version.** Then, per SPEC
§2.3, replace the `group` array on the `grouping.ts` override with the guaranteed fallback — the same
three-specifier deny-list used for the presentational modules — and **record the substitution in the
GATE Q notes.** Never leave an allow-list that has not been proven to bite.

- [ ] **Step 3: Prove the deny-list bites** — temporarily add the `positions/structure` import to
  `BrokerGroupHeader.tsx`, run `npx nx lint @org/dashboard`, expect FAIL, revert.

- [ ] **Step 4: Clean lint, format, commit**

```
npx nx run-many -t lint
npx nx format:write --files=eslint.config.mjs
git add eslint.config.mjs
git commit -m "build(lint): layer 1 of the no-naming machinery — allow-list on grouping, deny-list on the render/copy modules"
```
Expected: **0 errors / 0 warnings**, exit `0`.

---

### Task F7: Layer 2 — the recursive two-arm source scan (four mutation guards)

**A scan that cannot prove it bit is not enforcement.** Copied from
`unrenderedBrokerPl.spec.tsx:133-164` — copied, not paraphrased — **including BOTH of its self-checks**
(the anti-vacuity `it('scans a REAL, non-empty file set')` at `:147`, without which a rename makes the
scan vacuously green, and the mutation guard at `:161`).

**Files:** Create `apps/dashboard/src/testing/noNamingVocabulary.ts` · Create
`broker/noNaming.scan.spec.ts` · Modify `apps/dashboard/tsconfig.spec.json` (one include entry).

**Why the vocabulary module lives outside `broker/`:** it necessarily contains every banned word, so it
must stay invisible to the scan's own glob. It is test-support, imported by specs only; Layer 2 asserts
no non-spec module under `broker/` imports it. Add `"src/testing/noNamingVocabulary.ts"` to
`tsconfig.spec.json`'s `include` — mirroring the shipped `src/test-setup.ts` precedent, which is
likewise listed there while also matching the app project's `src/**/*.ts`.

- [ ] **Step 1: Write the vocabulary module** — `apps/dashboard/src/testing/noNamingVocabulary.ts`:

```ts
/**
 * TEST-SUPPORT ONLY (imported by specs, never by render code). The structure-name vocabulary both
 * enforcement layers share, so a DOM assertion and a source scan can never drift apart.
 *
 * This file lives OUTSIDE `features/trading/broker/` on purpose: it necessarily contains every banned
 * word, and Layer 2's glob is rooted at `broker/`, so keeping it here is what lets the scan stay
 * honest. Layer 2 additionally asserts that no non-spec module under `broker/` imports it.
 */
import { STRUCTURE_LABELS } from '@/features/trading/positions/structure';

/**
 * B1 — the whole label values. Imported from the real dictionary so the vocabulary cannot drift: a
 * spec may forbid production code an import and still require the TEST to make it. That is the point.
 */
export const STRUCTURE_LABEL_VALUES: readonly string[] = Object.values(STRUCTURE_LABELS);

/**
 * B2 — the bare-word denylist, given as regex SOURCES (SPEC §2.3, verbatim). Word-boundary-anchored,
 * NOT substring: a substring form would fire on `environment`, `irony`, `spreadsheet`, `collarbone`,
 * `customer`. So when B2 reports a hit, the correct reading is "a shape word is standing on its own
 * here" — and the fix is NEVER to drop the anchors and NEVER to delete the term.
 *
 * Derivation (auditable, not taste): every shape-naming word in any structure kind or label value,
 * UNION AC-4's eight enumerated words, MINUS a reasoned exclusion set. `calendar`/`diagonal` are kinds
 * whose labels are bare words. `covered`/`protective` are the ONLY handle on those two shapes, because
 * `call`/`put` are excluded — they collide with load-bearing shipped copy ("sends no strike, expiry, or
 * call/put") and are ordinary English in code. `long`/`short` are side words. `debit`/`credit` are the
 * feature's OWN settled rendered vocabulary. `shares` is already covered by B1's substring form.
 * Plurals are enumerated BECAUSE the terms are anchored.
 */
export const B2_TERMS: readonly RegExp[] = [
  /\bverticals?\b/i, /\bspreads?\b/i, /\bcondors?\b/i, /\bbutterfl(?:y|ies)\b/i,
  /\bstraddles?\b/i, /\bstrangles?\b/i, /\bcollars?\b/i, /\biron\b/i,
  /\bcalendars?\b/i, /\bdiagonals?\b/i, /\bcovered\b/i, /\bprotective\b/i,
  /\bcustom\b/i,
];

/**
 * The ONE narrow exception: framework/CSS API tokens no trader ever reads. Matched PER OCCURRENCE,
 * never per word — a bare shape word elsewhere in the same file still fires. Three binding rules:
 * (i) an allow-pattern may only ever be a framework or CSS API token, cited to its API, never authored
 * prose; (ii) it exempts the OCCURRENCE; (iii) adding one is a SPEC EDIT, not a test edit.
 */
export const B2_ALLOW_OCCURRENCES: readonly string[] = [
  'orientation="vertical"',
  "orientation={'vertical'}",
  'verticalAlign',
  'vertical-align',
];

/** AC-4's own eight words, inline — the anti-drift anchor. Trimming B2 turns that assertion red. */
export const AC4_WORDS: readonly string[] = [
  'vertical', 'spread', 'condor', 'butterfly', 'straddle', 'strangle', 'collar', 'iron',
];

/** Strip the allow-listed OCCURRENCES, then test the remainder. Never weakens a term. */
export function b2HitsIn(text: string): string[] {
  let remainder = text;
  for (const allowed of B2_ALLOW_OCCURRENCES) remainder = remainder.split(allowed).join(' ');
  return B2_TERMS.filter((re) => re.test(remainder)).map(String);
}

/** B1 is a case-insensitive WHOLE-VALUE substring test (`Call debit spread` inside any text). */
export function b1HitsIn(text: string): string[] {
  const haystack = text.toLowerCase();
  return STRUCTURE_LABEL_VALUES.filter((v) => haystack.includes(v.toLowerCase()));
}
```

- [ ] **Step 2: Write the scan spec** — `broker/noNaming.scan.spec.ts`:

```ts
/**
 * LAYER 2 of the no-naming machinery (SPEC §2.3) — the SOURCE scan. Copied from
 * `unrenderedBrokerPl.spec.tsx:133-164` INCLUDING both self-checks, because a scan that cannot prove
 * it bit is not enforcement.
 */
import { describe, expect, it } from 'vitest';
import { AC4_WORDS, B2_TERMS, b1HitsIn, b2HitsIn } from '../../../../testing/noNamingVocabulary';

/**
 * RECURSIVE, unlike the shipped single-level pattern: a module placed in a subdirectory
 * (`broker/group/helpers.ts`) would otherwise be invisible here while Layer 1's file-named overrides
 * missed it too, so nothing would carry it. `broker/` is flat today, so this returns the identical set
 * now and costs nothing — it only removes a future blind spot.
 */
const RAW_SOURCES = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * The twelve non-spec modules that shipped BEFORE this feature. Defining the set by EXCLUSION rather
 * than by an include list means every NEW module under `broker/` is scanned by default — including one
 * a later session adds without reading the spec.
 */
const EXEMPT = [
  './brokerView.ts', './copy.ts', './fixtures.ts', './BrokerPositionRow.tsx',
  './BrokerPositionCard.tsx', './reassess.tsx', './BrokerTabPanel.tsx', './ProvenanceHeader.tsx',
  './predicates.ts', './renderState.ts', './useBrokerBook.ts', './useBrokerMarks.ts',
];

const appFiles = () => Object.keys(RAW_SOURCES).filter((p) => !p.includes('.spec.'));
const scanned = () =>
  Object.entries(RAW_SOURCES).filter(([p]) => !p.includes('.spec.') && !EXEMPT.includes(p));

/** Predicate set A — the naming MACHINE. */
const SET_A: readonly RegExp[] = [
  /from\s+['"][^'"]*positions\/(structure|view|leg)['"]/,
  /\bSimPosition\b/, /\bbuildPositionView\b/, /\bstructureKindOf\b/,
  /\bStructureKind\b/, /\bSTRUCTURE_LABELS\b/, /\bplPctStateOf\b/, /\bNET_BASIS_EPS\b/,
];

describe('Layer 2 · anti-vacuity — the scan is looking at something real', () => {
  it('scans a REAL, non-empty file set', () => {
    expect(appFiles().length).toBeGreaterThanOrEqual(10);
  });

  it('every EXEMPT path still exists in the glob (a rename turns this red, not silently green)', () => {
    for (const p of EXEMPT) expect(appFiles(), `${p} vanished`).toContain(p);
  });

  it('the scanned remainder contains all three files this feature authors', () => {
    const paths = scanned().map(([p]) => p);
    expect(paths).toContain('./grouping.ts');
    expect(paths).toContain('./BrokerGroupHeader.tsx');
    expect(paths).toContain('./groupCopy.ts');
  });
});

describe('Layer 2 · the scan', () => {
  it('set A — no scanned module reaches the naming machine', () => {
    const offenders = scanned()
      .filter(([, src]) => SET_A.some((re) => re.test(src)))
      .map(([p]) => p);
    expect(offenders).toEqual([]);
  });

  it('B1 — no scanned module contains a whole STRUCTURE_LABELS value as typed text', () => {
    for (const [p, src] of scanned()) expect(b1HitsIn(src), p).toEqual([]);
  });

  it('B2 — no scanned module contains a bare shape word as typed text', () => {
    for (const [p, src] of scanned()) expect(b2HitsIn(src), p).toEqual([]);
  });

  it('no scanned module imports the TEST vocabulary (it holds every banned word by design)', () => {
    const offenders = scanned()
      .filter(([, src]) => /testing\/noNamingVocabulary/.test(src))
      .map(([p]) => p);
    expect(offenders).toEqual([]);
  });
});

describe('Layer 2 · MUTATION GUARDS — one per predicate, or the predicate is unproven', () => {
  it('1. set A fires on a real reference', () => {
    expect(SET_A.some((re) => re.test('const p: SimPosition = x;'))).toBe(true);
  });

  it('2. B1 fires on a hand-typed compound label', () => {
    expect(b1HitsIn("const t = 'Call debit spread';").length).toBeGreaterThan(0);
  });

  it('3. B2 catches what NO pre-existing predicate could — and B1 stays silent on it', () => {
    const poison = "const t = 'these legs may form a spread';";
    expect(b2HitsIn(poison).length).toBeGreaterThan(0);
    expect(b1HitsIn(poison)).toEqual([]); // the whole point: a new arm, not B1 under a new name
    expect(SET_A.some((re) => re.test(poison))).toBe(false);
  });

  it('4. the allow-pattern exempts the OCCURRENCE, not the word', () => {
    expect(b2HitsIn('<Divider orientation="vertical" />')).toEqual([]);
    expect(b2HitsIn('// lay the legs out as a vertical').length).toBeGreaterThan(0);
  });

  it('ANTI-DRIFT — every one of AC-4’s eight words is matched by at least one B2 term', () => {
    for (const w of AC4_WORDS) {
      expect(B2_TERMS.some((re) => re.test(w)), w).toBe(true);
    }
  });
});
```

- [ ] **Step 3: Add the tsconfig include entry** — in `apps/dashboard/tsconfig.spec.json`, add
  `"src/testing/noNamingVocabulary.ts"` to `include` (beside `"src/test-setup.ts"`).

- [ ] **Step 4: Run, and fix any hit by REWORDING**

```
npx nx test @org/dashboard -- noNaming.scan
```
Expected: PASS, all 12 tests. **A B1/B2 hit inside one of the three authored files is fixed by rewording
that file** — never by adding a term to `B2_ALLOW_OCCURRENCES` (which may only ever cite a framework or
CSS API and is a spec edit), and never by deleting a term.

- [ ] **Step 5: Typecheck, format, commit**

```
npx nx typecheck @org/dashboard
npx nx format:write --files=apps/dashboard/src/testing/noNamingVocabulary.ts,apps/dashboard/src/app/features/trading/broker/noNaming.scan.spec.ts,apps/dashboard/tsconfig.spec.json
git add apps/dashboard/src/testing/noNamingVocabulary.ts apps/dashboard/src/app/features/trading/broker/noNaming.scan.spec.ts apps/dashboard/tsconfig.spec.json
git commit -m "test(broker): layer 2 — recursive two-arm source scan with a guard per predicate"
```

---

### Task F8: Layer 3 — the render regression against the FUTURE feed (five poisons)

**This is the layer that survives a refactor of layers 1 and 2, and the one that fails on the day
`positions/structure.ts:153`'s guard stops firing.** Today that guard returns `custom` only because the
legs carry no strike/expiry/right; the day `/trade/instrument` lands it stops firing and a merged
two-leg set returns a name **by itself, with nobody deciding it**. `BOOK_CF_FUTURE_FEED` simulates that
world today.

**Files:** Create `broker/noNaming.render.spec.tsx`.

**Four DOM channels, and the asymmetry between the arms is deliberate:**

1. **B1 over the header's `innerHTML`** — one string that covers `textContent`, `aria-label`, any
   in-subtree `aria-labelledby` target, and `title`. **Asserting `textContent` alone was a pass-1 gap:
   an `aria-label` is not text content.**
2. **B2 over an explicitly assembled NAMING SURFACE** — `textContent` + every `aria-label`/`title`/
   `alt`/`placeholder` value + every `aria-labelledby` target's text + every opened tooltip's text.
   **Deliberately excluded: `class`/`className`, `id`, `data-testid`** — AC-4 bans a *trader-visible*
   string, and MUI emits class names like `MuiDivider-vertical` that `/\bvertical\b/i` would hit on a
   **correct** render. A compound label cannot hide inside a framework class name; a single word can.
3. **The computed accessible name of every control** — `queryByRole('button', { name: <regex> })`
   returns `null` for each B1 value and each B2 term. For B2 the regex is the `\b`-anchored source, not
   a bare word, or a control named "…environment…" would fail a correct render.
4. **Every keyboard-reachable tooltip opened from the header** — MUI renders tooltips into a **portal**,
   so their content is *not* in the trigger's subtree and channel 1 cannot see it. Focus the count
   clause, then the basis label, and assert on `getByRole('tooltip')` against **both** arms.

**Scope, stated so a correct implementation is not failed by this test:** the subject is the **group
header and the portals it opens** — never the expanded member rows. A member row is a single-leg
position and legitimately renders its own shipped chip, which under the future feed reads a real name
and which AC-5 requires **unchanged**. **The fixture is rendered COLLAPSED**; expanding it is AC-5's
test, not this one.

- [ ] **Step 1: Write the spec** — `broker/noNaming.render.spec.tsx`:

```tsx
/**
 * LAYER 3 — the OUTCOME. Layers 1 and 2 pin the mechanism; this pins what reaches the trader.
 * Rendered from a fixture whose legs DO carry strike, expiry and right (the post-contract-detail
 * world, simulable today), COLLAPSED, on both form factors.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/react';
import {
  B2_TERMS, STRUCTURE_LABEL_VALUES, b1HitsIn, b2HitsIn,
} from '../../../../testing/noNamingVocabulary';

/** The trader-visible naming surface. Class names, ids and testids are deliberately EXCLUDED. */
function namingSurfaceOf(root: HTMLElement, extraTexts: readonly string[] = []): string {
  const parts: string[] = [root.textContent ?? ''];
  const push = (v: string | null) => { if (v != null) parts.push(v); };
  push(root.getAttribute('aria-label'));
  push(root.getAttribute('title'));
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[aria-label],[title],[alt],[placeholder]'))) {
    for (const a of ['aria-label', 'title', 'alt', 'placeholder']) push(el.getAttribute(a));
  }
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[aria-labelledby]'))) {
    for (const id of (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean)) {
      push(document.getElementById(id)?.textContent ?? '');
    }
  }
  parts.push(...extraTexts);
  return parts.join(' | ');
}

const escapeForRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

afterEach(() => cleanup());

describe.each(['row', 'card'] as const)(
  'AC-4b · a COLLAPSED group under the FUTURE feed names no shape (%s)',
  (variant) => {
    // Render BrokerGroupHeader for the single group of BOOK_CF_FUTURE_FEED, expanded={false}.

    it('channel 1 — B1: no label value in the header subtree’s innerHTML', () => {
      const header = screen.getByTestId('broker-group-header');
      expect(b1HitsIn(header.innerHTML)).toEqual([]);
    });

    it('channel 2 — B2: no bare shape word on the assembled naming surface', () => {
      const header = screen.getByTestId('broker-group-header');
      expect(b2HitsIn(namingSurfaceOf(header))).toEqual([]);
    });

    it('channel 3 — no control’s COMPUTED accessible name names a shape', () => {
      const header = screen.getByTestId('broker-group-header');
      for (const v of STRUCTURE_LABEL_VALUES) {
        expect(
          within(header).queryByRole('button', { name: new RegExp(escapeForRegExp(v), 'i') }),
          v,
        ).toBeNull();
      }
      for (const re of B2_TERMS) {
        expect(within(header).queryByRole('button', { name: re }), String(re)).toBeNull();
      }
    });

    it('channel 4 — every keyboard-reachable tooltip is clean on BOTH arms', async () => {
      const user = userEvent.setup();
      for (const testid of ['broker-group-count', 'broker-group-net-label']) {
        const trigger = screen.getByTestId(testid);
        let guard = 0;
        while (document.activeElement !== trigger && guard++ < 20) await user.tab();
        const tip = await screen.findByRole('tooltip');
        const text = tip.textContent ?? '';
        expect(b1HitsIn(text), testid).toEqual([]);
        expect(b2HitsIn(text), testid).toEqual([]);
      }
    });
  },
);

describe('Layer 3 · MUTATION GUARDS — five poisons, because one poison proves one assertion', () => {
  it('1. a label value in the RENDERED TEXT fails the B1 channel', () => {
    const el = document.createElement('div');
    el.innerHTML = '<span>TSLA</span><span>Call debit spread</span>';
    expect(b1HitsIn(el.innerHTML).length).toBeGreaterThan(0);
  });

  it('2. a label value in an ARIA-LABEL fails the B1 channel (an aria-label is not text content)', () => {
    const el = document.createElement('div');
    el.innerHTML = '<button aria-label="Show the Iron condor">x</button>';
    expect(el.textContent).not.toContain('Iron condor'); // the pass-1 gap, demonstrated
    expect(b1HitsIn(el.innerHTML).length).toBeGreaterThan(0);
  });

  it('3. a label value in a TOOLTIP fails the B1 channel', () => {
    expect(b1HitsIn('This reads as a Long straddle.').length).toBeGreaterThan(0);
  });

  it('4. B2 poison in the count clause — and B1 does NOT catch it', () => {
    const poison = '3 option legs · may form a spread';
    expect(b2HitsIn(poison).length).toBeGreaterThan(0);
    expect(b1HitsIn(poison)).toEqual([]);
  });

  it('5. B2 poison in a tooltip — and B1 does NOT catch it', () => {
    const poison = 'reads like an iron play';
    expect(b2HitsIn(poison).length).toBeGreaterThan(0);
    expect(b1HitsIn(poison)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** — `npx nx test @org/dashboard -- noNaming.render`. Expected: PASS (8 + 5 tests).

- [ ] **Step 3: Prove the assembled surface would catch a real leak.** Temporarily give the header's
  count element `title="Iron condor"`; re-run; expect channels 1, 2 **and** 4 red. Revert.

- [ ] **Step 4: Typecheck, format, commit**

```
npx nx typecheck @org/dashboard
npx nx format:write --files=apps/dashboard/src/app/features/trading/broker/noNaming.render.spec.tsx
git add apps/dashboard/src/app/features/trading/broker/noNaming.render.spec.tsx
git commit -m "test(broker): layer 3 — collapsed-header render regression under the future feed, five poisons"
```

---

### Task F9: Wire it into `BrokerTabPanel` — both form factors, ephemeral expand state

**Files:** Modify `broker/BrokerTabPanel.tsx`, `broker/BrokerPositionRow.tsx`,
`broker/BrokerPositionCard.tsx` (the `nested` chrome prop only) · Test
`broker/grouping.integration.spec.tsx` (the **centrepiece**: drives the real user flow end-to-end through
every edge case and **mocks only the network boundary**, never a live backend).

**The render branch is `leg_count === 1`, not `position_count === 1` — a named reconciliation.** §2.5
words the lone-leg branch as `position_count === 1`; AC-6c requires the noun to track the number, and
AC-23 fixes the lone clause at the literal `1 option leg`. A single member position carrying two option
legs (`BOOK_CF_TWO_LEG_MEMBER`) would then read "1 option leg" above a header that counted two — AC-6c
red on a correct implementation. `leg_count === 1` agrees with §2.5 on every input where
`position_count === 1 ⟺ leg_count === 1` (i.e. all of today's feed) and is the only reading consistent
with AC-6c and with §2.6's "a group is ≥2 by definition". **Recorded for GATE Q.**

**Order:** groups (key ascending) first, then `ungrouped` in the book's own order. AC-33 requires
stability, not a specific interleave; this is deterministic and stated.

- [ ] **Step 1: Write the failing integration spec** — `broker/grouping.integration.spec.tsx`:

| Test | Assertion |
|---|---|
| AC-1 | `BOOK_CAPTURED_COMPLETE` ⇒ 3 `broker-group-header` + 2 lone rows + 5 equity rows = 10 top-level entries |
| AC-5 | expanding TSLA reveals 3 member rows whose fields, literals, **fidelity notes** and figures are byte-identical to the same views rendered standalone (compare `textContent` of `broker-snapshot-fields`, `broker-net-entry`, `broker-pl`, and the `broker-fidelity-note` list) |
| AC-6 | with every group collapsed, `Σ group.position_count + ungrouped.length` equals the book's position count on **both** the captured book and `BOOK_CF_TWO_LEG_MEMBER` |
| AC-6c | expanding ⇒ `getAllByTestId('broker-leg-line')` count equals the header's stated leg count, on `BOOK_CF_TWO_LEG_MEMBER` (3) |
| AC-7 | on first render every group is collapsed (`aria-expanded="false"`, panel `hidden`) |
| AC-8 | the rendered `broker-group-net` equals the signed sum of the expanded rows' `broker-net-entry` texts, parsed back from the DOM |
| AC-20 | for `BOOK_NO_CREDENTIAL`, `bookUnknown('broker_unreachable')`, `BOOK_EMPTY`, and the cold-skeleton state: **zero** `broker-group-header`, zero leg counts, zero expanders, and each state's shipped copy unchanged |
| AC-21 | `bookDegraded(...)` and `BOOK_REAUTH_WITH_SNAPSHOT` still render grouped beneath the banner |
| AC-23 | NVDA and PLTR render today's row plus exactly one clause; **no** button, `aria-expanded`, `aria-controls`, chevron, ghost chevron, group styling or `netted by Convexa`; qty and entry figures unchanged from a standalone render |
| AC-25 | a refresh returning the same book leaves an expanded group expanded; advancing the fake clock past the 30s tick does not collapse it |
| AC-27 | `Object.keys(localStorage)` is identical before and after expand+collapse |
| AC-28 | a second book without a previously-expanded ticker renders with no error and no stray empty group |
| AC-29 | mobile (`<sm`) renders the same groups, leg counts, net figure, basis label and withheld literal as desktop |
| AC-33 | two renders of the same book give the same group order; members in `broker_position_id` order |
| AC-34 | `broker-count` still reads `14 positions` — never a group count, no `· 5 groups` clause |
| AC-35 | no captured `unrealized_pl` value reaches rendered text on any group surface |
| AC-31 (FE half) | no `fetch` call is added: the network stub records exactly the shipped call pattern, and `useBrokerMarks.ts` is byte-unchanged in the diff |

- [ ] **Step 2: Implement the wiring** in `BrokerTabPanel.tsx`:

```tsx
  const grouped = useMemo(() => groupBook(views, book, nowMs), [views, book, nowMs]);
  // EPHEMERAL, React-local, keyed on the stable GroupKey — so the 30s tick and every refresh rebuild
  // the derived data WITHOUT remounting the group, and expand state survives them. No durable key:
  // this module never touches a `convexa.*` key, and a map of real holdings' tickers in localStorage
  // would be a new data-at-rest surface on a read-only feature for a preference whose loss costs one
  // click (SPEC §2.10).
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string) =>
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
```

Then, inside `servedBody`'s rows block, replace the flat `views.map(...)` with: for each
`grouped.groups`, if `g.leg_count === 1` render the single member through today's
`BrokerPositionRow`/`BrokerPositionCard` **plus** the `GROUP_COPY.loneLegClause` secondary clause
(supplied as a new optional `secondaryClause?: ReactNode` prop that may change **only** chrome/secondary
text — never a field, a literal or a figure); else render `<BrokerGroupHeader …>` followed by
`<BrokerGroupPanel …>` containing the member rows with `nested` set. Then render `grouped.ungrouped`
exactly as today. `BROKER_COPY.positionsCount(views.length)` is **unchanged**.

The `nested` prop on row/card drops the child's own border and outer padding (chrome supplied by the
parent) — that is the concrete 393px-overflow mechanism, and nesting must never double the frame.

- [ ] **Step 3: Run, typecheck, format, commit**

```
npx nx test @org/dashboard
npx nx typecheck @org/dashboard
npx nx run-many -t lint
npx nx format:write --files=apps/dashboard/src/app/features/trading/broker/BrokerTabPanel.tsx,apps/dashboard/src/app/features/trading/broker/BrokerPositionRow.tsx,apps/dashboard/src/app/features/trading/broker/BrokerPositionCard.tsx,apps/dashboard/src/app/features/trading/broker/grouping.integration.spec.tsx
git commit -am "feat(broker): render groups on both form factors, expand state ephemeral and key-stable"
```

---

### Task F10: Defect repair #2 — the mobile/desktop `ModeledPl` parity split on `unrecognized`

**Owner-ruled IN scope (Q1 = A) and it is NOT grouping behaviour.** `BrokerPositionRow.tsx:325` renders
`<ModeledPl>` **outside** the `unfaithful` branch, so a desktop `unrecognized` row shows the withheld
modeled-P/L literal with its label. `BrokerPositionCard.tsx:75` renders it **inside** the non-unfaithful
branch only, so the mobile card **omits the slot entirely** — and an omitted slot is precisely the shape
`[absent-is-not-none]` forbids: the mobile reader cannot distinguish "no answer" from "nothing to say".

**This must be verified on BOTH form factors and may not ride on a group-row-only parity assertion**
(AC-24 clause (b); AC-29 extends the parity claim to **ungrouped** entries).

**Files:** Modify `broker/BrokerPositionCard.tsx` · Test: extend `broker/genericOptionRow.spec.tsx` (or
add to the F9 integration spec — but the assertion must name both form factors explicitly).

- [ ] **Step 1: Write the failing test**

```tsx
it('AC-24b — an `unrecognized` entry renders the withheld modeled P/L with its label on BOTH form factors', () => {
  const view = viewOf(POS_UNRECOGNIZED);
  const shared = { view, streamOffline: false, isStale: false, asOf: null };
  const desktop = render(<BrokerPositionRow {...shared} />);
  const desktopPl = desktop.getByTestId('broker-pl').textContent;
  const desktopLabel = desktop.getByTestId('broker-pl-label').textContent;
  desktop.unmount();

  const mobile = render(<BrokerPositionCard {...shared} />);
  expect(mobile.getByTestId('broker-pl').textContent).toBe(desktopPl);
  expect(mobile.getByTestId('broker-pl-label').textContent).toBe(desktopLabel);
  expect(desktopPl).toBe('not provided'); // the literal, not a blank and not a number
});
```

- [ ] **Step 2: Run** — expect FAIL: `broker-pl` is not in the mobile card's `unrecognized` output.

- [ ] **Step 3: Repair the card.** In `BrokerPositionCard.tsx`, change the `unfaithful` branch to render
  the bare entry **and** `<ModeledPl view={view} streamOffline={streamOffline} asOf={asOf} />` side by
  side (`display: flex`, `justifyContent: 'space-between'`, `gap: '10px'`) — matching the desktop row's
  own layout, where the P/L block sits in the right rail regardless of fidelity.

- [ ] **Step 4: Run, typecheck, format, commit**

```
npx nx test @org/dashboard
npx nx typecheck @org/dashboard
npx nx format:write --files=apps/dashboard/src/app/features/trading/broker/BrokerPositionCard.tsx,apps/dashboard/src/app/features/trading/broker/genericOptionRow.spec.tsx
git commit -am "fix(broker): the mobile card omitted the withheld modeled P/L on an unrecognized entry"
```

**GATE Q note that must ride along:** the mobile card's changed `unrecognized` output is a **named
pre-existing-defect repair**, not a grouping regression.

---

### Task F11: 393px, focus and the e2e arm

**Files:** Create `apps/dashboard-e2e/src/e2e/broker-grouping.spec.ts`.

- [ ] **Step 1: `npx playwright install chromium`** (the suite fails without the binary).
- [ ] **Step 2: Write the spec**, copying the shipped `broker.spec.ts` network-stub idiom
  (`page.route('**/api/**')` with explicit path branching; `/api/contract/` → 404 so the mark path needs
  no live backend) and serving a grouped book shaped like `BOOK_CAPTURED_COMPLETE`:

| Test | Assertion |
|---|---|
| AC-37 — 393px, a group EXPANDED, no horizontal overflow | at `{width: 393, height: 852}`: vacuity guards first (`broker-group-header` count > 0; after clicking one toggle, `[aria-expanded="true"]` is attached **and** `broker-leg-line` count > 0), then `document.documentElement.scrollWidth <= window.innerWidth`. Joins the existing 393px viewport set. |
| AC-36 — exactly one focus indicator | tab to `broker-group-toggle`; assert the toggle is `document.activeElement`, and that no ancestor of it has a computed `outline-style !== 'none'` (the shipped `:focus-within` rule must not be inherited by the group control) |
| AC-4 (real browser) | the populated tab's `innerText` matches none of the B2 terms and none of the label values |
| AC-7 / AC-26 — collapsed on load and after reload | every `[aria-expanded]` reads `false`; expand one, `page.reload()`, assert `false` again |

- [ ] **Step 3: Run** — `npm run ports:free` then `npx nx e2e dashboard-e2e`. Expected: **> 37** tests
  passing; exit `0`.
- [ ] **Step 4: Format + commit**

```
npx nx format:write --files=apps/dashboard-e2e/src/e2e/broker-grouping.spec.ts
git add apps/dashboard-e2e/src/e2e/broker-grouping.spec.ts
git commit -m "test(e2e): grouped Broker tab — 393px expanded, one focus ring, collapsed after reload"
```

---

## Verification track

### V1 — the local gate sweep (exit codes, not summaries)

- [ ] Run each, recording the **exit code** after each (never through a pipe that masks it):

```
npm run ports:free
npx nx typecheck @org/dashboard
npx nx run-many -t lint
npx nx test @org/dashboard
npx nx test api
npx nx e2e dashboard-e2e
npx nx format:check --files=<the exact comma-separated list of files this feature touched>
```

- [ ] Record against the baselines table in Global Constraints. **dashboard > 1291 / > 116 · e2e > 37 ·
  lint 0/0 · typecheck 0 · api exactly 272.** A dashboard count that went *down* is a deleted test, not
  a rounding — find it.

### V2 — the `[CF]` matrix (the row a reviewer reads instead of trusting a claim)

- [ ] Produce this table in the QA report, filling the test name actually asserting each row. **Every
  fixture column must name a `BOOK_CF_*` book. A captured-book entry in this table is a GATE Q failure.**

| `[CF]` AC | Constructed fixture | Where verified |
|---|---|---|
| 4b | `BOOK_CF_FUTURE_FEED` | F8 `noNaming.render.spec.tsx` |
| 6, 6c | `BOOK_CF_TWO_LEG_MEMBER` | F4 `grouping.spec.ts`, F9 integration |
| 9b | `BOOK_CF_CREDIT` | F4, F5 |
| 9c | `BOOK_CF_ZERO_NET` | F4, F5 |
| 12 | `BOOK_CF_NO_COST`, `BOOK_CF_NO_SIZE` | F4, F5 |
| 13 | `BOOK_CF_NO_COST` | F4, F5 |
| 14 | `BOOK_CF_UNPARSEABLE` | F4, F5 |
| 15 | `BOOK_CF_MIXED_CAUSE` | F4 |
| 15b | `SINGLE_LEG_CASCADE_ARMS` | F2 `brokerView.spec.ts` |
| 17a, 17b | `BOOK_CF_DOUBLY_BROKEN`, `BOOK_CF_MIXED_CAUSE` | F4, F5 |
| P1 | `BOOK_CF_NO_RECON_NOTE` | F2, F4, F5 |
| P3 | `BOOK_CF_NO_COST` + `BOOK_CF_ZERO_NET` | F4, F5 |

### V3 — the empty-diff and score-invariance proof (AC-31)

- [ ] `git diff --stat main -- apps/api` → **prints nothing.** Any output fails AC-31.
- [ ] `npx nx test api` → **272**, exit `0`.
- [ ] With the app running (`npm run ports:free` first), confirm the Simulated tab, the outcome ledger
  and the Ticker page are unchanged, and that a served bundle's `opportunity_score` /
  `opportunity_tier` / `state_fingerprint` are identical before and after (the FE cannot reach them —
  the import allow-list is the structural argument, and this is the observation that confirms it).
- [ ] Confirm the `apps/dashboard` diff introduces **no `fetch`** and leaves `useBrokerMarks.ts`
  byte-unchanged.

### V4 — conformance re-pin

- [ ] `npm run ports:free`, serve the API, then:

```
node .claude/tools/interface_conformance.mjs --contract .claude/contracts/broker-option-grouping/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --auth-signup --report .claude/contracts/broker-option-grouping/conformance-receipt.json
```
Expected: the single `GET /api/broker/book` endpoint PASSES on the
`unknown` / `no_credential_stored` arm, exit `0`. **Never run this with `--auth-cookie` against a
credentialed session**, and note that `POST /api/broker/book/refresh` is deliberately excluded so the
sweep cannot force-fetch against the owner's real Webull rate limits.

### V5 — the review-marked criteria (with the owner, app running)

- [ ] `npm run ports:free`; serve both apps; check **dark and light**, desktop and 393px.
- [ ] **AC-1b (one-time, with the owner):** against the owner's **live** book, every ticker on the
  Broker tab shows the same option-leg count the Webull app shows, and no option leg the Webull app
  shows is missing. **This arm asserts no absolute position count** — a live book changes daily.
- [ ] AC-2 (five header elements; right rail carries the P/L and nothing else) · AC-6b (the noun and the
  three counts 3/2/2) · AC-7 (collapsed on load) · AC-9 (one figure, one direction word, a named basis
  whose tooltip names the composition) · AC-10 / AC-10b (the disclosure states a **mechanism, never a
  number**; if it quantifies at all it does so as a **proportion**) · AC-17a (the count beside a withheld
  literal) · AC-26 (collapsed after reload) · AC-30 (`Build reassessment` on an expanded leg row only —
  no affordance, no disabled variant, no placeholder, no tooltip stub on the group) · AC-33 (order
  polish) · AC-36's **single focus ring** in both modes · `[theme-token-discipline]` dark/light parity.
- [ ] **Two GATE Q notes that must ride along:** (1) the two lone rows were the only entries expected to
  be byte-for-byte identical to the row the owner live-verified on 2026-08-05; this design adds
  **exactly one secondary-text clause** to them — record it as intentional or a reviewer will file it as
  a grouping regression on an ungrouped row. (2) The mobile card's changed `unrecognized` output is a
  **named defect repair**.

---

## Self-review

**Spec coverage.** §1 scope → F1/F9 · §2.1 → F4 · §2.2 → F2 (shared formatter), F4 (sum, gate, basis
sign, zero rule) · §2.3 → F6/F7/F8 (all three layers, all four DOM channels, nine mutation guards) ·
§2.4 → F4 (the struct, the union counts, the discriminated union) · §2.5 → F4 (membership, ordering,
totality) · §2.6 → F2 (the shared cascade + the no-op proof) · §2.7 → F2 (constant + boolean), F4 (the
OR), F5 (render only where the figure renders) · §2.8 → F5, F9, F10 · §2.9 → V3 (no new fetch) · §2.10 →
F9 (ephemeral, key-stable) · §2.11 → F4 (all-or-nothing, finiteness), F5 (both axes), F5 (the
`unrealized_pl` extension) · §3 all 43 rows → mapped in the task tables and V2/V5 · §4 → F3 (copy), F5
(structure, states, tokens, type) · §5 → F4/F5 · §6 → Global Constraints (the verbatim block) · §7 →
F1–F11 + V1–V5 · §8 → Global Constraints · §9 → the three named reconciliations plus V5's notes.

**Three items a reviewer should know were decided at plan level, not in the spec:** the group-eligibility
reading of "non-finite multiplier" (F4 note 1), the multi-underlying position routing (F4 note 2), the
singleton-agreement/`$0.00` overlap (F4 note 3), and the lone-leg render branch keyed on `leg_count`
rather than `position_count` (F9). Each is recorded inline where an implementer meets it.

**Type consistency.** `withheldLiteralOf` / `WithholdingInput` / `netEntryFigureText` /
`NOTE_MULTIPLIER_RECONSTRUCTED` / `restsOnDerivedSize` / `net_rests_on_derived_size` (F2) are the exact
names F4 imports. `groupBook` / `groupNetEntryText` / `withheldCountOf` / `withheldCauseOf` /
`BrokerGroup` / `BrokerGroupNet` / `GroupedBook` / `GroupKey` / `WithheldCause` (F4) are the exact names
F3, F5 and F9 import. `GROUP_COPY`'s twelve members (F3) are the exact names F5 and F9 call.
`b1HitsIn` / `b2HitsIn` / `B2_TERMS` / `B2_ALLOW_OCCURRENCES` / `STRUCTURE_LABEL_VALUES` / `AC4_WORDS`
(F7) are the exact names F8 imports.
