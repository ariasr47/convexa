# positions-legs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a Convexa position from "one long option contract" into "an id + a list of legs + a lifecycle", collapse the two competing durable position stores into one book both pages read, and land the whole rename in one loss-free union migration to `convexa.positions.v3`.

**Architecture:** A `SimPosition` owns a `Leg[]`; the ×100 multiplier moves onto the leg; `StructureKind` becomes a derived, never-persisted name over a canonical leg signature; a `PositionView` per-cycle projection feeds every presentational component so they never touch the store, the recogniser or leg arithmetic. The durable floor (fault latch, the one lift function, the union promote) is built and unit-proven **before** any consumer writes through the new shape; the render path is moved onto `PositionView` while the store is still v2-backed; the store cutover and the death of the v1 writer land together, last.

**Tech Stack:** React 19 · TypeScript · MUI · Vite · Vitest + Testing Library (`npx nx test @org/dashboard`) · Cypress (`apps/dashboard-e2e`) · `localStorage` durable stores · FastAPI backend that this feature **does not touch**.

---

## Global Constraints

Every task's requirements implicitly include this section.

**Posture: `NO_BACKEND_CHANGE`.** `git diff` over `apps/api/` must be **EMPTY**. There is no backend track in this plan. If any task appears to need a backend field, that is a **GATE Z amendment** against `INTERFACE_CONTRACT.md` — stop and bounce to the conductor, do not add it.

**Spec of record:** `.claude/contracts/positions-legs/SPEC.md` (`APPROVED 2026-07-28`, **83** acceptance criteria, §9 `None.`, `contract_lint` 0/0). Every task below references it by section and AC number and never restates the design. **Read the referenced spec sections before starting a task.** Where this plan and the spec appear to differ, the spec wins and the divergence is a bounce.

**Nx project name is `@org/dashboard`, not `dashboard`.**
- Full suite: `npx nx test @org/dashboard`
- One file: `npx nx test @org/dashboard -- src/app/features/trading/positions/leg.spec.ts`
  (if the passthrough form is rejected by this workspace, run `npx vitest run src/app/features/trading/positions/leg.spec.ts` from `apps/dashboard`)
- e2e: `npx nx e2e dashboard-e2e`

**Test baseline to protect: 645 passing / 75 files; e2e 15/15.** Any drop below that count is a regression to fix, never a rewrite of the assertion. Record the number at the end of every task.

**Binding invariants** (spec §8): `loss-free-durable-migration` (HARD, severity-promoted) · `additive-keeps-score-byte-identical` · `no-real-order-path` · `single-shared-sim-entry-dialog` · `digested-labels-not-raw-dump` · `theme-token-discipline` · `live-vs-static-isolation` · `best-effort-isolated-or-null` · `model-read-carries-its-assumptions`.

**Testing is risk-based** (`agents/qa-verify.md` §4, spec §7): automate invariants, negative space and silently-regressing behaviour; verify visible/intentional things (copy, presence, ordering) by review. **Not one test per AC.** Spec §3's `Verify by` column already assigns this per AC — respect its assignment, do not re-derive it.

**Zero new token values.** No hardcoded hex. Every colour resolves through the theme / `extrasFor(theme)`. Dark/light parity (spec §4 Design direction ¶3).

**Never render the literal `undefined` / `null` / `NaN` in a cell** (spec §2.2, AC-26).

**The `max_loss` column must FIT — a squeeze is a bounce.** If `max_loss` cannot sit inside the existing framed-table treatment at **both** shipped densities (`comfortable`, `compact`) and **every** shipped breakpoint above `md` without shrinking another column below its design width, without horizontal scroll on desktop, without truncating `unlimited risk` / `unnamed shape` into a shared prefix or an ellipsis that reads as data, and without dropping any text below the 11px floor — **STOP and raise a GATE Z bounce to the conductor.** Do not silently squeeze, do not unilaterally re-lay-out the table, do not shorten the withheld-reason labels. This is an escalation instruction, not a footnote (spec §4 *The risk slot*, `_MANIFEST.md` Lane instruction).

### Conformance spec

Copied **verbatim** from `.claude/contracts/positions-legs/INTERFACE_CONTRACT.md`:

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/contract/{ticker}",
      "path_params": { "ticker": "TSLA" },
      "query": { "expiration": "2026-08-21", "strike": 400, "right": "call" },
      "required": {
        "ticker": "string",
        "expiration": "string",
        "strike": "number",
        "right": "string",
        "option_quote": "object|null",
        "option_quote.bid": "number?",
        "option_quote.ask": "number?",
        "option_quote.mid": "number?",
        "greeks": "object",
        "greeks.delta": "number|null",
        "greeks.gamma": "number|null",
        "greeks.theta": "number|null",
        "greeks.vega": "number|null",
        "iv": "number|null",
        "dte": "number"
      }
    }
  ]
}
```

Run it with:

```
<project.json backend.python> .claude/tools/interface_conformance.py \
  --contract .claude/contracts/positions-legs/INTERFACE_CONTRACT.md \
  --url http://127.0.0.1:<project.json backend.port>
```

`path_params` + `query` are a **fixture, not part of the contract** — a 404 means the fixture is stale (expirations roll), not that the interface broke. Substitute a `(ticker, expiration, strike, right)` triple that exists in the current snapshot and re-run. Never "fix" a stale fixture by loosening a required field.

---

## Settled — do not re-litigate

**B1 (RULED) — which position supplies the Ticker page's `pos_*` params after the merge: SUPPRESS `position_eval` WHEN THE FOCUSED TICKER HOLDS MORE THAN ONE OPEN POSITION.**

*The question.* Shipped `model/store.ts` holds **exactly one** ghost trade per ticker (`getTrade(ticker)` keys the map by ticker), so `gt.positionQuery` (`useGhostTrade.ts:528`) is unambiguous today. After the merge a trader may hold N positions on the focused ticker, and spec §2.8 defines leg selection *within* a position but never defined position selection *within* a ticker.

*The ruling.* Three-way, by open-position count on the focused ticker:

| Open positions on the focused ticker | Behaviour |
|---|---|
| 0 | as today |
| exactly 1 | today's behaviour, **byte-identical** |
| more than 1 | **suppressed**, surfaced through `eval_subject` `{ kind: 'none'; reason: 'multiple_positions' }` (`SPEC.md` §2.8) |

*The reasoning, carried so nobody re-proposes the rejected option.* The earlier proposal — most recently opened `open` position, then its `eval_subject` leg — is **REJECTED**. It is deterministic, but it makes the app quietly assert *"this is your NVDA position"* when it is one of three. This ruling is **owner ruling #9 applied one level up**: #9 established that the app does not evaluate a subject it cannot faithfully represent, and picking one of N positions is the same approximation the owner rejected for legs, with **less** visibility. **There is no regression by construction** — a ticker with 2+ positions cannot exist under the shipped one-ghost-trade-per-ticker store, so no existing user's behaviour changes.

*Still a render decision.* Suppression changes **nothing** on the wire. `SPEC.md` §2.8's closing paragraph now states the plan-wide rule at the source: *"No wire change, at either level … it does not branch on leg count and it does not branch on position count."* The `pos_*` request stays **unconditional and byte-identical** (AC-74, which this ruling does not weaken) — **no task in this plan may branch the fetch on position count.** V4 asserts the request shape is unchanged for the N-position case as well as the single-leg and multi-leg cases.

*Where it is written, and the names to use.* `SPEC.md` is **`APPROVED 2026-07-28`, 83 ACs, §9 `None.`, lint 0/0**, with the amendment folded:

- **§2.8** is retitled *"`eval_subject` and the suppression of `position_eval`"* and states suppression at **two levels** — level 1 position selection on the focused ticker, level 2 leg selection within it. The level-1 table is the table above, verbatim.
- **`EvalNoneReason`** is the `none` branch's reason type: a **closed vocabulary** (snake_case, exhaustive, no free text) with exactly two members — **`no_option_leg`** (shares-only) and **`multiple_positions`** (>1 open position on the ticker). Within a position, `none` is reachable only when there is no option leg at all; `multiple_positions` is decided one level up.
- **AC-83** (section H, `test`) is the three-way position-count criterion. It repeats AC-74's clause that a `pos_*` request still appearing for a 3-position ticker is **correct, not a defect**.
- **`POSITION_EVAL_NONE_MULTI_POSITION`** is the user-facing string, marked **`[FUTURE — pending a consumer]`** beside its siblings. **No task in this plan renders it** — `alerts` still has no component consumer, and the suppression is observable without it. Do not wire it, exactly as with the other four `POSITION_EVAL_*` strings (F6 Step 5 greps to prove none of the five is referenced).

---

## Blockers named for the conductor

**None.** B1 is ruled (above). B2 was never a design gap — the `max_loss` column fit is an execution risk with a mandated escalation, stated in Global Constraints and carried as a hard checkpoint in **F11 Step 6**: if it cannot fit, bounce to GATE Z rather than squeeze.

---

## File structure

**New**, all under `apps/dashboard/src/app/features/trading/positions/`:

| File | Responsibility |
|---|---|
| `leg.ts` | `Leg`, `SimPosition`, the sign/value/cost primitives, `pl_pct_state`. No imports from the store, no React. |
| `structure.ts` | The 22-member `StructureKind`, the total exact-match recogniser, the closed label lookup, the declared sort ordinal. Pure. |
| `maxLoss.ts` | The closed 15-member eligible set, the per-member arithmetic, the three withheld reasons. Pure. |
| `composeMark.ts` | `composePositionMark` (all-or-nothing, weakest basis, frozen OR) + the per-leg contract identity used for resolver de-duplication. Pure. |
| `evalSubject.ts` | `evalSubjectOf` — primary-leg selection and its tiebreaks. Pure. |
| `migrate.ts` | **The ONE lift function** and the union, shared by the store migration and the archive import. Pure — takes parsed blobs, touches no storage. |
| `view.ts` | The `PositionView` projection and `buildPositionView`. The only place components get numbers and strings from. |
| `fixtures.ts` | The shared fixture library §7 demands (short vertical, covered call, shares, calendar, zero-cost collar, colliding-id pair, unparseable blob, malformed legacy record, stale saved view). Test-only data. |

**Modified:** `positions/types.ts` · `positions/store.ts` · `positions/derive.ts` · `positions/labels.ts` · `positions/defaults.ts` · `positions/usePortfolio.ts` · `positions/PositionRow.tsx` · `positions/PositionCard.tsx` · `positions/PositionsView.tsx` · `positions/CustomizationToolbar.tsx` · `positions/PortfolioPanel.tsx` · `positions/PositionsPanel.tsx` · `trading/TradeEntryDialog.tsx` · `outcomes/archive.ts` · `outcomes/sources.ts` · `pages/ticker/TickerDashboard.tsx` · `pages/positions/PositionsPage.tsx` · `model/types.ts` · `model/mark.ts`.

**Deleted:** `model/useGhostTrade.ts` · `model/store.ts` write paths (`putTrade`, `clearTrade`, the second `appendDecision`) · `model/types.ts` `GhostTrade` · `positions/types.ts` `Strategy` / `strategyOf`. **Moved:** `model/OpportunityTier.tsx` → `pages/ticker/widgets/`.

---

## Track and task index

**Track R — Reconciliation (1 task)** · **Track F — Frontend (19 tasks)** · **Track V — Verification (8 tasks)**

Execution order is the numeric order below, with the Track V tasks interleaved at the sequence points named in each one.

| # | Task | Sequence point |
|---|---|---|
| R1 | Working-tree reconciliation + baseline capture | first, before any edit |
| F1 | Fault latch on the shipped positions store (AC-56) | after R1 |
| F2 | `leg.ts` — the leg shape and its arithmetic | after F1 |
| V1 | Shared fixture library | after F2 |
| F3 | `structure.ts` — the recogniser | after V1 |
| F4 | `maxLoss.ts` — the closed eligible set | after F3 |
| F5 | `composeMark.ts` — the structure mark | after F4 |
| F6 | `evalSubject.ts` — primary-leg selection | after F5 |
| F7 | `migrate.ts` — the ONE lift + the union | after F6 |
| F8 | `view.ts` — the `PositionView` projection | after F7 |
| F9 | Copy + column/axis wiring (`labels.ts`, `defaults.ts`, `types.ts`) | after F8 |
| F10 | `usePortfolio` emits `views` (still v2-backed) | after F9 |
| F11 | `PositionRow` on `PositionView` + the `max_loss` column | after F10 |
| F12 | The leg disclosure | after F11 |
| F13 | `PositionCard` — five-item footer + risk slot | after F12 |
| V2 | Tint-discipline / className-identity guard | after F13 |
| V3 | 393px no-overflow e2e, with a 4-leg disclosure expanded | after V2 |
| F14 | `derive.ts` on the structure axis + the stale-view notice | after V3 |
| V5 | Ephemerality — no fetch, no store write on a read | after F14 |
| F15 | `TradeEntryDialog` — the SIM multi-leg variant | after V5 |
| F16 | The faulted store, on screen | after F15 |
| V6 | Faulted-state a11y suite | after F16 |
| F17 | Relocate `OpportunityTier` (kernel narrowing) | after V6 |
| F18 | **THE CUTOVER** — v3 store live, v1 writer dead, one book | after F17 |
| V4 | `additive-keeps-score-byte-identical` | after F18 |
| F19 | `outcomes/` — ledger sources + archive envelope v2 | after V4 |
| V7 | Full-page integration over a seeded durable store | after F19 |
| V8 | Gate pack — conformance, baseline, review checklist | last |

---

# Track R — Reconciliation

### Task R1: Working-tree reconciliation and baseline capture

A parallel session was active in `apps/dashboard/src/app/` on 2026-07-27 (`_MANIFEST.md` Notes, spec §7 Coordination note). This refactor touches the whole trading domain and pins copy constants in `labels.ts` / `defaults.ts` — both collision candidates. **A merge conflict inside a durable-migration change is the worst possible place to have one.** Nothing else in this plan starts until this task is green.

**Files:** none modified — this task reads and reports.

**Interfaces:**
- Consumes: nothing.
- Produces: a recorded baseline (`git` HEAD, test counts) that every later task compares against.

- [ ] **Step 1: Establish the branch and working-tree state**

```bash
git status --porcelain
git branch --show-current
git log --oneline -5
git stash list
git worktree list
```

Expected at plan authoring time: branch `main`, HEAD `ead53df`, the only untracked entry `.claude/RESUME.md` (uncommitted by owner preference — leave it alone).

- [ ] **Step 2: Detect any drift in the collision-candidate files**

```bash
git log --oneline -10 -- apps/dashboard/src/app/features/trading/
git diff --stat HEAD -- apps/dashboard/src/app/
```

**STOP and report to the conductor** if either of these is true: the working tree has uncommitted modifications under `apps/dashboard/src/app/`, or a commit touching `features/trading/positions/labels.ts` or `features/trading/positions/defaults.ts` landed after `ead53df` that is not in this plan. Do not merge, rebase or stash on your own initiative.

- [ ] **Step 3: Create the feature branch**

```bash
git checkout -b feat/positions-legs
```

- [ ] **Step 4: Capture the test baseline**

```bash
npx nx test @org/dashboard
```

Expected: **645 passed**, **75 files**. Record the exact numbers. If they differ from 645/75, report the delta before starting F1 — the baseline moved and every later regression check must be measured against the new number, not against 645.

- [ ] **Step 5: Capture the e2e baseline**

```bash
npx nx e2e dashboard-e2e
```

Expected: 15/15 passing.

- [ ] **Step 6: Confirm the backend is untouched and stays that way**

```bash
git diff --stat HEAD -- apps/api/
```

Expected: empty output. This command is re-run at the end of every Track F task and at V4.

---

# Track F — Frontend

### Task F1: Fault latch on the shipped positions store (AC-56)

**This repairs a live data-loss defect and it lands first, before any shape change.** `positions/store.ts` `read()` catches to `memory = empty()` (line 131) and the very next `putPosition` calls `write()` → `localStorage.setItem(V2_KEY, …)` (line 141), destroying an unparseable-but-possibly-recoverable blob. `orders/store.ts` already guards correctly (`if (ordersFaulted()) return false; // NEVER overwrite a readable-but-unparseable prior blob`, line 83) and is the pattern to copy. Spec §2.10, §2.9; AC-56, AC-61.

The shape change this feature makes parse failures **more** likely, not less — which is exactly why the latch goes in before the shape moves.

**Files:**
- Modify: `apps/dashboard/src/app/features/trading/positions/store.ts:105-145` (`read`, `write`) and every mutator (`putPosition:157`, `removePosition:162`, `appendDecision:171`, `putCustomization:195`)
- Test: `apps/dashboard/src/app/features/trading/positions/store.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `positionsFaulted(): boolean`, and every mutator returns `boolean` (`false` = refused, nothing written). F18 replaces the internals of this module but keeps both of these signatures.

- [ ] **Step 1: Write the failing test**

Append to `apps/dashboard/src/app/features/trading/positions/store.spec.ts`:

```ts
describe('fault latch (AC-56) — an unparseable blob is never overwritten', () => {
  const CORRUPT = '{"schema_version":2,"positions":{ THIS IS NOT JSON';

  beforeEach(() => {
    localStorage.clear();
    __resetMemory();
  });

  it('refuses every mutator and leaves the damaged blob byte-identical', () => {
    localStorage.setItem(PORTFOLIO_V2_KEY, CORRUPT);
    __resetMemory();

    expect(positionsFaulted()).toBe(true);

    expect(putPosition(mkPosition({ id: 'p-new' }))).toBe(false);
    expect(removePosition('p-new')).toBe(false);
    expect(appendDecision({ trade_id: 'p-new' } as unknown as DecisionRecord)).toBe(false);
    expect(putCustomization(getCustomization())).toBe(false);

    expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBe(CORRUPT);
  });

  it('is not faulted for an absent blob, and mutators still work', () => {
    __resetMemory();
    expect(positionsFaulted()).toBe(false);
    expect(putPosition(mkPosition({ id: 'p-ok' }))).toBe(true);
    expect(allPositions().map((p) => p.id)).toContain('p-ok');
  });

  it('determines fault synchronously at initialisation, not on the first write', () => {
    localStorage.setItem(PORTFOLIO_V2_KEY, CORRUPT);
    __resetMemory();
    // No mutator has been called yet.
    expect(positionsFaulted()).toBe(true);
  });
});
```

Add `positionsFaulted` to the import list at the top of the file.

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/store.spec.ts`
Expected: FAIL — `positionsFaulted is not a function`. This test **must** fail against today's store; if it passes, the test is not exercising the defect and proves nothing (spec §7 invariant 2).

- [ ] **Step 3: Implement the latch**

In `positions/store.ts`, add the module flag beside `let memory` (line 45):

```ts
let memory: PersistShapeV2 | null = null; // fallback / cache
let faulted = false; // set SYNCHRONOUSLY by read(); no frame ever paints on a stale value
```

In `read()`, set it on both paths — success clears it, the catch sets it:

```ts
    memory = empty();
    faulted = false;
  } catch {
    // Corrupt/unreadable store ⇒ empty in-memory portfolio. The prior blob is left INTACT:
    // the latch below refuses every write until it is repaired or cleared outside the app.
    memory = empty();
    faulted = true;
  }
  return memory;
```

Also set `faulted = false` immediately before each of the two early `return memory` statements inside the `try` (the v2-hit path at line 120 and the v1-migrated path at line 128).

Change `write` and every mutator to return `boolean`:

```ts
function write(s: PersistShapeV2): boolean {
  if (positionsFaulted()) return false; // NEVER overwrite a readable-but-unparseable prior blob
  memory = s;
  try {
    localStorage.setItem(V2_KEY, JSON.stringify(s));
  } catch {
    /* quota/private mode — keep the in-memory copy this session */
  }
  return true;
}

/** Is the durable store faulted? Reading forces hydration so the answer is always current. */
export function positionsFaulted(): boolean {
  read();
  return faulted;
}

export function putPosition(p: Position): boolean {
  const s = read();
  if (faulted) return false;
  return write({ ...s, positions: { ...s.positions, [p.id]: p } });
}

export function removePosition(id: PositionId): boolean {
  const s = read();
  if (faulted) return false;
  const positions = { ...s.positions };
  delete positions[id];
  return write({ ...s, positions });
}

export function appendDecision(rec: DecisionRecord): boolean {
  const s = read();
  if (faulted) return false;
  return write({ ...s, decisions: [...s.decisions, rec] });
}

export function putCustomization(c: CustomizationState): boolean {
  const s = read();
  if (faulted) return false;
  return write({ ...s, customization: c });
}
```

Also reset the flag in the test seam:

```ts
export function __resetMemory() {
  memory = null;
  faulted = false;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/store.spec.ts`
Expected: PASS.

Then the full suite: `npx nx test @org/dashboard`
Expected: ≥ 645 passing, 75 files. The v1→v2 migration write inside `read()` (line 127) now goes through `write()` — confirm the existing migration tests still pass; if one fails because `write` returned `false`, the `faulted = false` assignments in Step 3 were placed after the early returns instead of before them.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/app/features/trading/positions/store.ts apps/dashboard/src/app/features/trading/positions/store.spec.ts
git commit -m "fix(positions): add the fault latch — an unparseable blob is never overwritten (AC-56)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task F2: `leg.ts` — the leg shape and its arithmetic

Spec §2.1 (durable shape, the three hard stands), §2.2 (P/L composition and `pl_pct_state`). AC-23, AC-24, AC-25, AC-26.

The three hard stands are load-bearing and each has a rejected alternative in spec §2 *Not buildable*: **`qty` is unsigned and `side` carries direction**; **`multiplier` is stored on the leg, never derived from `kind`**; **`entry_price` is per-unit and always positive**. Do not "simplify" any of them.

**Files:**
- Create: `apps/dashboard/src/app/features/trading/positions/leg.ts`
- Test: `apps/dashboard/src/app/features/trading/positions/leg.spec.ts`

**Interfaces:**
- Consumes: `EntryBasis`, `EntryMode`, `PositionStatus`, `PositionId` from `./types`; `OptionRight` from `@org/api`.
- Produces, relied on by F3–F8, F10, F18:
  - `type LegId = string` · `type InstrumentKind = 'option' | 'equity'` · `type LegSide = 'long' | 'short'`
  - `interface Leg` · `interface SimPosition`
  - `sideSign(l: Leg): 1 | -1` · `legCost(l: Leg): number` · `legValue(l: Leg, mark: number): number` · `legPl(l: Leg, mark: number): number`
  - `netEntryCost(p: SimPosition): number` · `positionPl(p: SimPosition, marks: ReadonlyMap<LegId, number | null>): number | null`
  - `type PlPctState` · `plPctStateOf(args): PlPctState` · `const NET_BASIS_EPS = 0.5`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/app/features/trading/positions/leg.spec.ts`:

```ts
/**
 * Unit — leg arithmetic. Risk-based (spec §7 invariant 4): byte-identity for a pre-existing
 * single-leg position, the 100-share $1 move, the credit-structure sign, and the near-zero
 * denominator. These regress silently and are invisible to review.
 */
import { describe, expect, it } from 'vitest';
import {
  Leg,
  NET_BASIS_EPS,
  legCost,
  legPl,
  netEntryCost,
  plPctStateOf,
  positionPl,
  SimPosition,
} from './leg';

function optLeg(over: Partial<Leg> = {}): Leg {
  return {
    id: 'l-1',
    kind: 'option',
    ticker: 'TSLA',
    side: 'long',
    qty: 1,
    multiplier: 100,
    entry_price: 12.4,
    entry_basis: 'snapshot',
    expiration: '2026-08-21',
    strike: 400,
    right: 'call',
    ...over,
  };
}

function pos(legs: Leg[], over: Partial<SimPosition> = {}): SimPosition {
  return {
    id: 'p-1',
    legs,
    opened_time: '2026-07-01T14:00:00Z',
    status: 'open',
    entry_mode: 'manual',
    schema_version: 3,
    ...over,
  };
}

describe('leg arithmetic', () => {
  it('AC-25 — a long single option is the exact (mark - entry) * 100 * qty special case', () => {
    const l = optLeg({ entry_price: 5, qty: 2 });
    expect(legPl(l, 7)).toBe((7 - 5) * 100 * 2);
    expect(legCost(l)).toBe(5 * 100 * 2);
  });

  it('AC-24 — 100 shares up $1 is $100, not $10,000', () => {
    const shares = optLeg({
      kind: 'equity',
      qty: 100,
      multiplier: 1,
      entry_price: 250,
      expiration: null,
      strike: null,
      right: null,
    });
    expect(legPl(shares, 251)).toBe(100);
  });

  it('a short leg inverts both cost and P/L', () => {
    const short = optLeg({ side: 'short', entry_price: 6.1 });
    expect(legCost(short)).toBe(-610);
    expect(legPl(short, 4.1)).toBe(200); // sold at 6.10, now worth 4.10 → +$200
  });

  it('netEntryCost is positive for a debit and negative for a credit', () => {
    const debit = pos([optLeg({ id: 'a', strike: 400, entry_price: 12.4 }), optLeg({ id: 'b', side: 'short', strike: 420, entry_price: 6.1 })]);
    expect(netEntryCost(debit)).toBeCloseTo(630, 6);
    const credit = pos([optLeg({ id: 'a', side: 'short', strike: 400, entry_price: 12.4 }), optLeg({ id: 'b', strike: 420, entry_price: 6.1 })]);
    expect(netEntryCost(credit)).toBeCloseTo(-630, 6);
  });

  it('ALL-OR-NOTHING — one null leg mark withholds the whole position P/L, never a partial sum', () => {
    const p = pos([optLeg({ id: 'a' }), optLeg({ id: 'b', side: 'short', strike: 420, entry_price: 6.1 })]);
    const partial = new Map<string, number | null>([['a', 14], ['b', null]]);
    expect(positionPl(p, partial)).toBeNull();
    const full = new Map<string, number | null>([['a', 14], ['b', 7]]);
    expect(positionPl(p, full)).toBeCloseTo((14 - 12.4) * 100 - (7 - 6.1) * 100, 6);
  });

  it('AC-26 — a winning credit structure reports a POSITIVE percentage', () => {
    const st = plPctStateOf({ plDollar: 200, netEntryCost: -630, status: 'open', anyLegUnresolved: false });
    expect(st).toEqual({ kind: 'value', value: expect.closeTo((200 / 630) * 100, 6), basis: 'net_credit' });
  });

  it('AC-26 — a near-zero net cost yields no_basis, never Infinity/0/blank', () => {
    const st = plPctStateOf({ plDollar: 40, netEntryCost: 0, status: 'open', anyLegUnresolved: false });
    expect(st).toEqual({ kind: 'no_basis' });
    expect(NET_BASIS_EPS).toBeGreaterThan(0);
  });

  it('an unresolved leg beats no_basis: unavailable wins', () => {
    expect(plPctStateOf({ plDollar: null, netEntryCost: 0, status: 'open', anyLegUnresolved: true })).toEqual({
      kind: 'unavailable',
    });
  });

  it('a pending limit is not_applicable, not unavailable and not no_basis', () => {
    expect(plPctStateOf({ plDollar: null, netEntryCost: 630, status: 'pending', anyLegUnresolved: false })).toEqual({
      kind: 'not_applicable',
    });
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/leg.spec.ts`
Expected: FAIL — `Failed to resolve import "./leg"`.

- [ ] **Step 3: Write the implementation**

Create `apps/dashboard/src/app/features/trading/positions/leg.ts`:

```ts
/**
 * The leg — the unit a position is made of, and the unit the mark ladder resolves.
 *
 * Three hard stands (SPEC §2.1), each with a rejected alternative:
 *  - `qty` is UNSIGNED; `side` carries direction. A sign convention is not checkable; an enum is.
 *  - `multiplier` is STORED on the leg, never derived from `kind`. Adjusted options are real, and
 *    `kind === 'option' ? 100 : 1` reintroduces the exact hardcode this feature exists to kill.
 *  - `entry_price` is PER-UNIT and always POSITIVE. Debit vs credit is a property of the
 *    composition; the sign enters through `side` at composition time and nowhere else.
 *
 * Pure module: no store access, no React, no fetch.
 */
import type { OptionRight } from '@org/api';
import type { EntryBasis, EntryMode, PositionId, PositionStatus } from './types';

export type LegId = string;
export type InstrumentKind = 'option' | 'equity';
export type LegSide = 'long' | 'short';

export interface Leg {
  /** Stable uuid, minted at creation, never reused. */
  id: LegId;
  /** The projection exposes this as `instrument_kind`. */
  kind: InstrumentKind;
  /** ON THE LEG — a broker import produces leg-shaped rows each carrying their own symbol. */
  ticker: string;
  side: LegSide;
  /** POSITIVE integer, always. */
  qty: number;
  /** STORED. 100 for a standard option contract, 1 for equity. Never derived from `kind`. */
  multiplier: number;
  /** Per-unit, always POSITIVE. */
  entry_price: number;
  entry_basis: EntryBasis;
  /** Option-only; `null` on an equity leg or an unrecorded legacy fact. */
  expiration: string | null;
  strike: number | null;
  right: OptionRight | null;
}

export interface SimPosition {
  id: PositionId;
  /** length >= 1. Single-underlying is enforced at CONSTRUCTION, not by the type. */
  legs: Leg[];
  /** The legacy `entry_time`, carried verbatim — `''` on a pending limit, NEVER backfilled. */
  opened_time: string;
  status: PositionStatus;
  entry_mode: EntryMode;
  limit_price?: number | null;
  placed_time?: string;
  /** Plan data — POSITION-level, never leg-level. */
  stop?: number | null;
  target?: number | null;
  realized_pl_dollar?: number;
  realized_pl_pct?: number;
  close_time?: string;
  origin_order_id?: string;
  schema_version: number;
}

export const SIM_POSITION_SCHEMA_VERSION = 3;

/**
 * The net-entry magnitude below which a percentage has no meaningful denominator, in DOLLARS.
 * A true zero-cost collar computes to exactly 0; float noise on a real net is orders of magnitude
 * under 50 cents, and no real structure is opened for a net of less than half a dollar.
 */
export const NET_BASIS_EPS = 0.5;

export function sideSign(l: Leg): 1 | -1 {
  return l.side === 'long' ? 1 : -1;
}

export function legCost(l: Leg): number {
  return sideSign(l) * l.entry_price * l.multiplier * l.qty;
}

export function legValue(l: Leg, mark: number): number {
  return sideSign(l) * mark * l.multiplier * l.qty;
}

export function legPl(l: Leg, mark: number): number {
  return sideSign(l) * (mark - l.entry_price) * l.multiplier * l.qty;
}

/** > 0 debit (money paid), < 0 credit (money received). */
export function netEntryCost(p: SimPosition): number {
  return p.legs.reduce((sum, l) => sum + legCost(l), 0);
}

/**
 * ALL-OR-NOTHING. If ANY leg's mark is null the position's P/L is null — never a partial sum.
 * The reason is not incompleteness, it is SIGN INVERSION: drop the short leg from a credit spread
 * and a losing position renders as a winner. Do not relax this into "a partial sum with an
 * asterisk" (SPEC §2.5). Per-leg truth is fully visible in the leg disclosure.
 */
export function positionPl(
  p: SimPosition,
  marks: ReadonlyMap<LegId, number | null>,
): number | null {
  let total = 0;
  for (const l of p.legs) {
    const mark = marks.get(l.id);
    if (mark == null) return null;
    total += legPl(l, mark);
  }
  return total;
}

/**
 * The percentage breaks twice in shipped code and both are fixed here: a credit structure divides a
 * correctly-signed numerator by a NEGATIVE denominator (flipping the sign), and a near-costless
 * structure divides by ~0 (yielding +/-Infinity). The denominator becomes a MAGNITUDE, and `basis`
 * is REQUIRED on the value branch so it is impossible to hold the figure without holding its basis.
 */
export type PlPctState =
  | { kind: 'value'; value: number; basis: 'net_debit' | 'net_credit' }
  | { kind: 'no_basis' }
  | { kind: 'unavailable' }
  | { kind: 'not_applicable' };

export function plPctStateOf(args: {
  plDollar: number | null;
  netEntryCost: number;
  status: PositionStatus;
  anyLegUnresolved: boolean;
}): PlPctState {
  if (args.status === 'pending') return { kind: 'not_applicable' };
  if (args.anyLegUnresolved || args.plDollar == null) return { kind: 'unavailable' };
  if (Math.abs(args.netEntryCost) < NET_BASIS_EPS) return { kind: 'no_basis' };
  return {
    kind: 'value',
    value: (args.plDollar / Math.abs(args.netEntryCost)) * 100,
    basis: args.netEntryCost > 0 ? 'net_debit' : 'net_credit',
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/leg.spec.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Verify the byte-identity claim by hand once**

For a shipped single-leg long option (`side: 'long'`, `multiplier: 100`): `legPl` reduces to `(mark − entry) × 100 × qty`, which is `model/mark.ts:122` character for character; and `plPctStateOf` reduces to `((mark − entry) × 100 × qty) / (entry × 100 × qty) × 100` = `((mark − entry) / entry) × 100`, which is `model/mark.ts:123`. Record this identity in the commit body — AC-25 rests on it.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/app/features/trading/positions/leg.ts apps/dashboard/src/app/features/trading/positions/leg.spec.ts
git commit -m "feat(positions): add the Leg/SimPosition shape and its arithmetic

Single-leg long options reduce to the shipped (mark-entry)*100*qty and
((mark-entry)/entry)*100 exactly, which is what AC-25 rests on.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task V1: Shared fixture library

**Sequence point: after F2, before F3.** Spec §7 names this explicitly: *"Fixtures the suite does not have today and must gain, because every existing fixture is a long single leg and the suite is therefore structurally blind to exactly what this feature adds."* Building them once, here, keeps every later task from inventing its own near-duplicate.

**Files:**
- Create: `apps/dashboard/src/app/features/trading/positions/fixtures.ts`
- Test: `apps/dashboard/src/app/features/trading/positions/fixtures.spec.ts`

**Interfaces:**
- Consumes: `Leg`, `SimPosition`, `SIM_POSITION_SCHEMA_VERSION` from `./leg`.
- Produces, used by F3–F8, F10–F19, V2–V7:
  `mkLeg(over?): Leg` · `mkPosition(legs, over?): SimPosition` ·
  `FX_LONG_CALL` · `FX_LONG_PUT` · `FX_SHORT_PUT` · `FX_SHARES_LONG` · `FX_SHARES_SHORT` ·
  `FX_CALL_DEBIT_SPREAD` · `FX_PUT_CREDIT_SPREAD` · `FX_SHORT_VERTICAL` (= a call credit spread) ·
  `FX_COVERED_CALL` · `FX_PROTECTIVE_PUT` · `FX_ZERO_COST_COLLAR` · `FX_LONG_STRADDLE` ·
  `FX_SHORT_STRANGLE` · `FX_IRON_CONDOR` · `FX_IRON_BUTTERFLY` · `FX_CALENDAR` · `FX_DIAGONAL` ·
  `FX_RATIO_1X2` (a `custom` residue case) · `FX_SIX_LEG` (AC-13) ·
  `LEGACY_V2_BLOB` · `LEGACY_V1_BLOB` · `COLLIDING_ID_PAIR` · `MALFORMED_LEGACY_RECORD` ·
  `UNPARSEABLE_BLOB` · `STALE_SAVED_VIEW_CUSTOMIZATION`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/app/features/trading/positions/fixtures.spec.ts`:

```ts
/**
 * Guard on the fixture library itself. A fixture that silently stops being what its name says
 * turns every suite built on it into a green lie — so the SHAPE facts each fixture exists to carry
 * are asserted here, once, in the cheapest possible place.
 */
import { describe, expect, it } from 'vitest';
import {
  COLLIDING_ID_PAIR,
  FX_CALENDAR,
  FX_COVERED_CALL,
  FX_IRON_CONDOR,
  FX_SHARES_LONG,
  FX_SHORT_VERTICAL,
  FX_SIX_LEG,
  FX_ZERO_COST_COLLAR,
  MALFORMED_LEGACY_RECORD,
  UNPARSEABLE_BLOB,
} from './fixtures';
import { netEntryCost, NET_BASIS_EPS } from './leg';

describe('fixture library', () => {
  it('the short vertical is a two-leg credit', () => {
    expect(FX_SHORT_VERTICAL.legs).toHaveLength(2);
    expect(netEntryCost(FX_SHORT_VERTICAL)).toBeLessThan(0);
  });

  it('the covered call is 100 shares + 1 short call', () => {
    const equity = FX_COVERED_CALL.legs.filter((l) => l.kind === 'equity');
    const options = FX_COVERED_CALL.legs.filter((l) => l.kind === 'option');
    expect(equity).toHaveLength(1);
    expect(equity[0].qty).toBe(100);
    expect(equity[0].multiplier).toBe(1);
    expect(options).toHaveLength(1);
    expect(options[0].side).toBe('short');
    expect(options[0].right).toBe('call');
  });

  it('the shares fixture has no option facts at all', () => {
    const l = FX_SHARES_LONG.legs[0];
    expect(l.kind).toBe('equity');
    expect(l.strike).toBeNull();
    expect(l.right).toBeNull();
    expect(l.expiration).toBeNull();
  });

  it('the calendar really has two distinct expirations', () => {
    const exps = new Set(FX_CALENDAR.legs.map((l) => l.expiration));
    expect(exps.size).toBe(2);
  });

  it('the zero-cost collar nets under the no-basis epsilon', () => {
    expect(Math.abs(netEntryCost(FX_ZERO_COST_COLLAR))).toBeLessThan(NET_BASIS_EPS);
  });

  it('the iron condor has four legs on one expiration', () => {
    expect(FX_IRON_CONDOR.legs).toHaveLength(4);
    expect(new Set(FX_IRON_CONDOR.legs.map((l) => l.expiration)).size).toBe(1);
  });

  it('the six-leg fixture exercises the no-leg-cap rule (AC-13)', () => {
    expect(FX_SIX_LEG.legs).toHaveLength(6);
  });

  it('the colliding pair carries the SAME id under both source keys', () => {
    expect(COLLIDING_ID_PAIR.v2Record.id).toBe(COLLIDING_ID_PAIR.v1Record.id);
  });

  it('the malformed legacy record is missing `right` and the unparseable blob does not parse', () => {
    expect(MALFORMED_LEGACY_RECORD.right).toBeUndefined();
    expect(() => JSON.parse(UNPARSEABLE_BLOB)).toThrow();
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/fixtures.spec.ts`
Expected: FAIL — `Failed to resolve import "./fixtures"`.

- [ ] **Step 3: Write the fixture library**

Create `apps/dashboard/src/app/features/trading/positions/fixtures.ts`. Build every option leg on **one** expiration `'2026-08-21'` unless the fixture's whole point is mixed expiries, and on **one** ticker `'TSLA'` unless stated. Every `SimPosition` gets `schema_version: SIM_POSITION_SCHEMA_VERSION`, `status: 'open'`, `entry_mode: 'manual'`, `opened_time: '2026-07-01T14:00:00Z'` unless overridden.

```ts
/**
 * Shared fixtures. Every fixture the suite has today is a LONG SINGLE LEG, so the suite is
 * structurally blind to exactly what this feature adds (SPEC §7). These are the shapes that blind
 * spot covers: a short vertical, a covered call, 100 shares, a calendar, a zero-cost collar, a
 * colliding-id pair across the two source stores, an unparseable blob, a malformed legacy record,
 * and a saved view whose filter references a value that no longer exists.
 *
 * Test-only data. Nothing here is imported by application code.
 */
import type { Leg, SimPosition } from './leg';
import { SIM_POSITION_SCHEMA_VERSION } from './leg';

let seq = 0;
const legId = () => `fx-leg-${++seq}`;

export function mkLeg(over: Partial<Leg> = {}): Leg {
  return {
    id: legId(),
    kind: 'option',
    ticker: 'TSLA',
    side: 'long',
    qty: 1,
    multiplier: 100,
    entry_price: 10,
    entry_basis: 'snapshot',
    expiration: '2026-08-21',
    strike: 400,
    right: 'call',
    ...over,
  };
}

export function mkPosition(legs: Leg[], over: Partial<SimPosition> = {}): SimPosition {
  return {
    id: `fx-pos-${++seq}`,
    legs,
    opened_time: '2026-07-01T14:00:00Z',
    status: 'open',
    entry_mode: 'manual',
    schema_version: SIM_POSITION_SCHEMA_VERSION,
    ...over,
  };
}
```

Then define each fixture. The exact leg sets:

| Fixture | Legs |
|---|---|
| `FX_LONG_CALL` | 1× long call $400 @ 12.40 |
| `FX_LONG_PUT` | 1× long put $380 @ 9.10 |
| `FX_SHORT_PUT` | 1× short put $380 @ 9.10 |
| `FX_SHARES_LONG` | equity long qty 100, multiplier 1, entry 250, `expiration/strike/right` all `null` |
| `FX_SHARES_SHORT` | equity short qty 100, multiplier 1, entry 250, all option facts `null` |
| `FX_CALL_DEBIT_SPREAD` | long call $400 @ 12.40 + short call $420 @ 6.10 |
| `FX_SHORT_VERTICAL` | short call $400 @ 12.40 + long call $420 @ 6.10 (a **call credit spread**) |
| `FX_PUT_CREDIT_SPREAD` | short put $380 @ 9.10 + long put $360 @ 4.20 |
| `FX_COVERED_CALL` | equity long qty 100 mult 1 @ 250 + short call $420 qty 1 @ 6.10 |
| `FX_PROTECTIVE_PUT` | equity long qty 100 mult 1 @ 250 + long put $240 qty 1 @ 5.00 |
| `FX_ZERO_COST_COLLAR` | equity long qty 100 mult 1 @ **0.00** + long put $240 qty 1 @ 5.00 + short call $260 qty 1 @ 5.00 — the equity entry is set to 0 so the whole position nets exactly 0; add the comment *"the equity price is zeroed deliberately so the NET is under NET_BASIS_EPS — this fixture exists to exercise `no_basis`, not to model a real cost basis"* |
| `FX_LONG_STRADDLE` | long call $400 @ 12.40 + long put $400 @ 11.90 |
| `FX_SHORT_STRANGLE` | short call $420 @ 6.10 + short put $380 @ 5.60 |
| `FX_IRON_CONDOR` | long put $380 @ 2.10 + short put $400 @ 4.60 + short call $440 @ 4.40 + long call $460 @ 1.90 |
| `FX_IRON_BUTTERFLY` | long put $380 @ 2.10 + short put $420 @ 9.00 + short call $420 @ 8.60 + long call $460 @ 1.90 |
| `FX_CALENDAR` | long call $400 exp `'2026-09-18'` @ 15.00 + short call $400 exp `'2026-08-21'` @ 12.40 |
| `FX_DIAGONAL` | long call $400 exp `'2026-09-18'` @ 15.00 + short call $420 exp `'2026-08-21'` @ 6.10 |
| `FX_RATIO_1X2` | long call $400 qty 1 @ 12.40 + short call $420 qty 2 @ 6.10 |
| `FX_SIX_LEG` | the four `FX_IRON_CONDOR` legs plus a long call $480 @ 0.90 and a short call $500 @ 0.40 |

And the durable-source fixtures:

```ts
/** A shipped v2 record, in the OLD shape — this is what `migrate.ts` must lift. */
export const LEGACY_V2_RECORD = {
  id: 'shared-1',
  ticker: 'TSLA',
  expiration: '2026-08-21',
  strike: 400,
  right: 'call',
  side: 'long',
  qty: 2,
  entry_mark: 12.4,
  entry_basis: 'snapshot',
  entry_time: '2026-06-12T15:32:00Z',
  stop: 8,
  target: 22,
  status: 'open',
  entry_mode: 'manual',
  schema_version: 2,
};

/** A shipped v1 ghost trade, in the OLD shape, keyed by TICKER in its blob. */
export const LEGACY_V1_RECORD = {
  id: 'ghost-only-1',
  ticker: 'NVDA',
  expiration: '2026-09-18',
  strike: 170,
  right: 'put',
  side: 'long',
  qty: 1,
  entry_mark: 7.85,
  entry_basis: 'snapshot',
  entry_time: '2026-06-18T14:05:00Z',
  status: 'open',
  schema_version: 1,
};

/**
 * Id collisions between the two stores are the EXPECTED case, not an edge case
 * (`positions/store.ts:49` carries `id: t.id` forward verbatim). This pair is the trader the
 * union exists for: the SAME id under both keys, forked, with the v1 copy CLOSED.
 */
export const COLLIDING_ID_PAIR = {
  v2Record: { ...LEGACY_V2_RECORD, id: 'shared-1', stop: 8, target: 22, status: 'open' },
  v1Record: {
    ...LEGACY_V2_RECORD,
    id: 'shared-1',
    status: 'closed',
    close_time: '2026-06-30T19:55:00Z',
    realized_pl_dollar: 196,
    realized_pl_pct: 48.4,
    stop: null,
    target: null,
  },
};

/** Missing `right` — the lift is FORBIDDEN from fabricating one (SPEC §2.6). */
export const MALFORMED_LEGACY_RECORD = {
  id: 'malformed-1',
  ticker: 'TSLA',
  expiration: '2026-08-21',
  strike: 400,
  side: 'long',
  qty: 1,
  entry_mark: 3.2,
  entry_basis: 'snapshot',
  entry_time: '2026-06-01T14:00:00Z',
  status: 'open',
  schema_version: 2,
} as Record<string, unknown>;

export const UNPARSEABLE_BLOB = '{"schema_version":2,"positions":{ THIS IS NOT JSON';

export const LEGACY_V2_BLOB = JSON.stringify({
  schema_version: 2,
  positions: { [LEGACY_V2_RECORD.id]: LEGACY_V2_RECORD },
  decisions: [
    { id: 'd-v2-1', event_type: 'open', clock_time: '2026-06-12T15:32:00Z', trade_id: 'shared-1' },
  ],
  customization: undefined,
});

export const LEGACY_V1_BLOB = JSON.stringify({
  schema_version: 1,
  trades: { NVDA: LEGACY_V1_RECORD, TSLA: COLLIDING_ID_PAIR.v1Record },
  decisions: [
    { id: 'd-v2-1', event_type: 'open', clock_time: '2026-06-12T15:32:00Z', trade_id: 'shared-1' },
    { id: 'd-v1-1', event_type: 'open', clock_time: '2026-06-18T14:05:00Z', trade_id: 'ghost-only-1' },
  ],
});
```

`d-v2-1` appearing in **both** blobs is deliberate: the v1→v2 migration copied decision records forward, so the union must de-dupe by `decisionIdentity()` and produce it **once** (AC-49).

Finally, `STALE_SAVED_VIEW_CUSTOMIZATION` — a `CustomizationState`-shaped object with two views: the seeded builtin, plus `{ id: 'view-tech-swings', name: 'Tech swings', config: { ...defaultConfig(), group: 'strategy', filter: { ticker: null, status: ['open'], strategy: 'long_call', expiry: null } } }`. AC-54's state only exists for a user with pre-existing durable state, which a fresh browser cannot reproduce — without this fixture that AC is unverifiable at GATE Q.

- [ ] **Step 4: Run the tests**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/fixtures.spec.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/app/features/trading/positions/fixtures.ts apps/dashboard/src/app/features/trading/positions/fixtures.spec.ts
git commit -m "test(positions): add the shared fixture library the suite is structurally missing

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task F3: `structure.ts` — the recogniser

Spec §2.3 in full. AC-14 through AC-21. Read §2.3 before writing a line: it names the recogniser rules for every contested member, it forbids a confidence measure, and it forbids reading `entry_price`.

**The governance line, to quote when in doubt:** *PM owns which shapes are named. UX owns the label text. The architect owns the recogniser and one structural requirement — the enum ↔ label map must be total and 1:1.*

**Files:**
- Create: `apps/dashboard/src/app/features/trading/positions/structure.ts`
- Test: `apps/dashboard/src/app/features/trading/positions/structure.spec.ts`

**Interfaces:**
- Consumes: `Leg`, `SimPosition` from `./leg`; the fixtures from `./fixtures` (tests only).
- Produces, relied on by F4, F8, F9, F11, F14:
  - `type StructureKind` — 22 members
  - `const STRUCTURE_KINDS: readonly StructureKind[]` — the 22, in **declared complexity order**
  - `function structureKindOf(p: SimPosition): StructureKind`
  - `const STRUCTURE_LABELS: Record<StructureKind, string>` — total, compile-time-checked
  - `const STRUCTURE_ORDINAL: Record<StructureKind, number>` — total, drives sort-by-structure

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/app/features/trading/positions/structure.spec.ts`:

```ts
/**
 * Unit — the recogniser. It is a TOTAL EXACT-MATCH function with no confidence measure: any leg
 * set that is not an exact match for a v1 named structure is `custom`, with no judgement involved.
 * That property is what makes a recogniser bug cosmetic by construction, so the residue cases below
 * are as load-bearing as the positive ones.
 */
import { describe, expect, it } from 'vitest';
import {
  FX_CALENDAR, FX_CALL_DEBIT_SPREAD, FX_COVERED_CALL, FX_DIAGONAL, FX_IRON_BUTTERFLY,
  FX_IRON_CONDOR, FX_LONG_CALL, FX_LONG_PUT, FX_LONG_STRADDLE, FX_PROTECTIVE_PUT,
  FX_PUT_CREDIT_SPREAD, FX_RATIO_1X2, FX_SHARES_LONG, FX_SHARES_SHORT, FX_SHORT_PUT,
  FX_SHORT_STRANGLE, FX_SHORT_VERTICAL, FX_SIX_LEG, FX_ZERO_COST_COLLAR, mkLeg, mkPosition,
} from './fixtures';
import { STRUCTURE_KINDS, STRUCTURE_LABELS, STRUCTURE_ORDINAL, structureKindOf } from './structure';

describe('structureKindOf — the named set', () => {
  it.each([
    ['shares_long', FX_SHARES_LONG],
    ['shares_short', FX_SHARES_SHORT],
    ['long_call', FX_LONG_CALL],
    ['long_put', FX_LONG_PUT],
    ['short_put', FX_SHORT_PUT],
    ['call_debit_spread', FX_CALL_DEBIT_SPREAD],
    ['call_credit_spread', FX_SHORT_VERTICAL],
    ['put_credit_spread', FX_PUT_CREDIT_SPREAD],
    ['covered_call', FX_COVERED_CALL],
    ['protective_put', FX_PROTECTIVE_PUT],
    ['collar', FX_ZERO_COST_COLLAR],
    ['long_straddle', FX_LONG_STRADDLE],
    ['short_strangle', FX_SHORT_STRANGLE],
    ['iron_condor', FX_IRON_CONDOR],
    ['iron_butterfly', FX_IRON_BUTTERFLY],
    ['calendar', FX_CALENDAR],
    ['diagonal', FX_DIAGONAL],
  ])('recognises %s', (kind, p) => {
    expect(structureKindOf(p)).toBe(kind);
  });
});

describe('the residue rule — `custom` is the residue of an exact match, never a judgement', () => {
  it.each([
    ['a 1x2 ratio', FX_RATIO_1X2],
    ['a >4-leg exotic', FX_SIX_LEG],
  ])('renders custom for %s', (_name, p) => {
    expect(structureKindOf(p)).toBe('custom');
  });

  it('AC-21 — a non-iron butterfly is custom in v1', () => {
    const p = mkPosition([
      mkLeg({ strike: 380, entry_price: 22 }),
      mkLeg({ strike: 400, side: 'short', qty: 2, entry_price: 12 }),
      mkLeg({ strike: 420, entry_price: 6 }),
    ]);
    expect(structureKindOf(p)).toBe('custom');
  });

  it('AC-21 — a non-iron condor is custom in v1', () => {
    const p = mkPosition([
      mkLeg({ strike: 380, entry_price: 22 }),
      mkLeg({ strike: 400, side: 'short', entry_price: 12 }),
      mkLeg({ strike: 440, side: 'short', entry_price: 6 }),
      mkLeg({ strike: 460, entry_price: 2 }),
    ]);
    expect(structureKindOf(p)).toBe('custom');
  });

  it('a malformed record with null strike/right is custom, not a crash', () => {
    const p = mkPosition([mkLeg({ strike: null, right: null })]);
    expect(structureKindOf(p)).toBe('custom');
  });
});

describe('AC-19 — the name never moves on an entry price', () => {
  it('debit vs credit comes from strike geometry, never from entry_price', () => {
    const before = structureKindOf(FX_CALL_DEBIT_SPREAD);
    const corrupted = {
      ...FX_CALL_DEBIT_SPREAD,
      legs: FX_CALL_DEBIT_SPREAD.legs.map((l) => ({ ...l, entry_price: 999 })),
    };
    expect(structureKindOf(corrupted)).toBe(before);
    expect(before).toBe('call_debit_spread');
  });
});

describe('AC-17 — determinism', () => {
  it('is insensitive to leg array order', () => {
    const reversed = { ...FX_IRON_CONDOR, legs: [...FX_IRON_CONDOR.legs].reverse() };
    expect(structureKindOf(reversed)).toBe(structureKindOf(FX_IRON_CONDOR));
  });
});

describe('AC-20 — the map is total and 1:1', () => {
  it('has exactly 22 members', () => {
    expect(STRUCTURE_KINDS).toHaveLength(22);
    expect(new Set(STRUCTURE_KINDS).size).toBe(22);
  });

  it('labels every member exactly once, with no label reused', () => {
    const labels = STRUCTURE_KINDS.map((k) => STRUCTURE_LABELS[k]);
    expect(labels.every((l) => typeof l === 'string' && l.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(22);
  });

  it('orders every member with a distinct declared ordinal — never alphabetical', () => {
    const ords = STRUCTURE_KINDS.map((k) => STRUCTURE_ORDINAL[k]);
    expect(new Set(ords).size).toBe(22);
    const byOrdinal = [...STRUCTURE_KINDS].sort((a, b) => STRUCTURE_ORDINAL[a] - STRUCTURE_ORDINAL[b]);
    const byLabel = [...STRUCTURE_KINDS].sort((a, b) =>
      STRUCTURE_LABELS[a].localeCompare(STRUCTURE_LABELS[b]),
    );
    expect(byOrdinal).not.toEqual(byLabel);
    expect(STRUCTURE_ORDINAL.custom).toBe(Math.max(...ords));
  });

  it('AC-16 — no label implies collateral, cash set aside or buying power', () => {
    const forbidden = /collateral|cash|secured|buying power|margin/i;
    for (const k of STRUCTURE_KINDS) expect(STRUCTURE_LABELS[k]).not.toMatch(forbidden);
    expect(STRUCTURE_KINDS).not.toContain('cash_secured_put');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/structure.spec.ts`
Expected: FAIL — `Failed to resolve import "./structure"`.

- [ ] **Step 3: Write the implementation**

Create `apps/dashboard/src/app/features/trading/positions/structure.ts`. The essential shape:

```ts
/**
 * StructureKind — DERIVED, TOTAL, NEVER STORED (SPEC §2.3, [digested-labels-not-raw-dump]).
 *
 * The recogniser is a total EXACT-MATCH function with no confidence measure, and must never
 * acquire one. Any leg set that is not an exact match for a structure in the v1 named set renders
 * `custom`, with its leg count. `custom` is the RESIDUE of an exact match, never a judgement — a
 * certainty framing invites a heuristic scorer, which makes the label non-deterministic across
 * renders and destroys the property that carries the whole design: that a recogniser bug is
 * COSMETIC BY CONSTRUCTION, because the label never feeds P/L, fills, persistence or any fetch.
 *
 * `structureKindOf` NEVER reads `entry_price`. The name is a property of what the trader holds,
 * not of what they paid. Debit vs credit comes from STRIKE GEOMETRY.
 *
 * Zero durable bytes: the kind is computed on every render and never written, which is why adding
 * a name later needs no migration.
 */
export type StructureKind =
  | 'shares_long' | 'shares_short'
  | 'long_call' | 'long_put' | 'short_call' | 'short_put'
  | 'call_debit_spread' | 'call_credit_spread' | 'put_debit_spread' | 'put_credit_spread'
  | 'covered_call' | 'protective_put' | 'collar'
  | 'long_straddle' | 'short_straddle' | 'long_strangle' | 'short_strangle'
  | 'iron_condor' | 'iron_butterfly'
  | 'calendar' | 'diagonal'
  | 'custom';

/**
 * The DECLARED COMPLEXITY ORDER (SPEC §4 Flows 5): shares -> single leg -> vertical ->
 * straddle/strangle -> covered/protective/collar -> iron condor/butterfly -> calendar/diagonal ->
 * custom. Sort-by-structure follows THIS, never alphabetical and never declaration accident.
 */
export const STRUCTURE_KINDS = [
  'shares_long', 'shares_short',
  'long_call', 'long_put', 'short_call', 'short_put',
  'call_debit_spread', 'call_credit_spread', 'put_debit_spread', 'put_credit_spread',
  'long_straddle', 'short_straddle', 'long_strangle', 'short_strangle',
  'covered_call', 'protective_put', 'collar',
  'iron_condor', 'iron_butterfly',
  'calendar', 'diagonal',
  'custom',
] as const satisfies readonly StructureKind[];

/** CLOSED, EXHAUSTIVE, COMPILE-TIME-CHECKED. A new member fails the build until it has a label. */
export const STRUCTURE_LABELS: Record<StructureKind, string> = {
  shares_long: 'Shares',
  shares_short: 'Short shares',
  long_call: 'Long call',
  long_put: 'Long put',
  short_call: 'Short call',
  short_put: 'Short put',
  call_debit_spread: 'Call debit spread',
  call_credit_spread: 'Call credit spread',
  put_debit_spread: 'Put debit spread',
  put_credit_spread: 'Put credit spread',
  long_straddle: 'Long straddle',
  short_straddle: 'Short straddle',
  long_strangle: 'Long strangle',
  short_strangle: 'Short strangle',
  covered_call: 'Covered call',
  protective_put: 'Protective put',
  collar: 'Collar',
  iron_condor: 'Iron condor',
  iron_butterfly: 'Iron butterfly',
  calendar: 'Calendar',
  diagonal: 'Diagonal',
  custom: 'Custom',
};

export const STRUCTURE_ORDINAL: Record<StructureKind, number> = Object.fromEntries(
  STRUCTURE_KINDS.map((k, i) => [k, i]),
) as Record<StructureKind, number>;
```

Then `structureKindOf`, built over a **canonical leg signature** — legs sorted by `kind`, `expiration`, `strike`, `right`, `side`, reduced to a shape tuple (leg count · distinct expirations · distinct rights · distinct strikes · the long/short pattern · the qty ratio). Implement the matchers in this order, returning `'custom'` if none matches:

1. **Guard:** any leg with `kind === 'option'` and a `null` `strike`, `right` or `expiration` ⇒ `'custom'` immediately (a malformed migrated record). More than one distinct `ticker` ⇒ `'custom'`.
2. **Equity only, 1 leg:** `side === 'long'` ⇒ `shares_long`, else `shares_short`.
3. **Option only, 1 leg:** `long`+`call` ⇒ `long_call`; `long`+`put` ⇒ `long_put`; `short`+`call` ⇒ `short_call`; `short`+`put` ⇒ `short_put`.
4. **Verticals** — *two option legs, same underlying, same expiration, same `right`, equal `qty`, one long one short, distinct strikes.* For a call pair: long strike < short strike ⇒ `call_debit_spread`, else `call_credit_spread`. For a put pair: long strike > short strike ⇒ `put_debit_spread`, else `put_credit_spread`.
5. **Straddle / strangle** — *two option legs, same underlying, same expiration, one call one put, equal `qty`, **same side***; equal strikes ⇒ straddle, distinct ⇒ strangle; the side gives long/short.
6. **Calendar / diagonal** — two option legs, same right, one long one short, equal qty, **distinct expirations**; equal strikes ⇒ `calendar`, distinct ⇒ `diagonal`.
7. **Covered call** — long equity `qty = 100 × N` plus a short call `qty = N`.
   **Protective put** — long equity plus a long put, same ratio.
   **Collar** — long equity plus long put plus short call, same ratio.
8. **Iron condor / iron butterfly** — four option legs, one expiration, two calls + two puts, equal qty across all four, each right pair being one long one short with the long strike further from the middle. Equal short strikes ⇒ `iron_butterfly`; distinct short strikes ⇒ `iron_condor`.

Add this comment above the matcher chain, verbatim:

```ts
// `butterfly` and non-iron `condor` are NOT members in v1 — they fall to `custom`, as do ratios,
// backspreads, boxes and jade lizards. Those are ILLUSTRATIVE CONSEQUENCES OF THE RESIDUE RULE,
// not a second list to maintain. Do not add a `cash_secured_put` member: a cash-secured put and a
// naked short put have byte-identical leg sets, and the distinguishing fact is collateral — which
// is not a leg. If the thing that makes a name true is a leg, it can be named; if it is a fact
// about the account, it cannot.
```

- [ ] **Step 4: Run the tests**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/structure.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite and commit**

```bash
npx nx test @org/dashboard
git add apps/dashboard/src/app/features/trading/positions/structure.ts apps/dashboard/src/app/features/trading/positions/structure.spec.ts
git commit -m "feat(positions): derive StructureKind from the leg shape (22 members, total, never stored)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task F4: `maxLoss.ts` — the closed eligible set

Spec §2.4 in full, plus §4 *The risk slot*. AC-28, AC-29.

**Eligibility is membership in a closed set of 15, not a detection heuristic.** There is **no generic max-loss function over an arbitrary leg set** — an unrecognised shape is ineligible *by construction*, which is what eliminates the owner's stated danger (under-detected unbounded risk) without trusting any heuristic anywhere. Breakeven and max gain are Future; do not compute them.

**Files:**
- Create: `apps/dashboard/src/app/features/trading/positions/maxLoss.ts`
- Test: `apps/dashboard/src/app/features/trading/positions/maxLoss.spec.ts`

**Interfaces:**
- Consumes: `Leg`, `SimPosition`, `netEntryCost` from `./leg`; `StructureKind` from `./structure`.
- Produces, relied on by F8, F9, F11, F13:
  - `type MaxLossWithheldReason = 'unbounded' | 'multi_expiration' | 'unnamed_shape'`
  - `type MaxLossResult = { kind: 'figure'; dollars: number } | { kind: 'withheld'; reason: MaxLossWithheldReason }`
  - `const MAX_LOSS_ELIGIBLE: ReadonlySet<StructureKind>` — the 15
  - `function maxLossOf(p: SimPosition, kind: StructureKind): MaxLossResult`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/app/features/trading/positions/maxLoss.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  FX_CALENDAR, FX_CALL_DEBIT_SPREAD, FX_COVERED_CALL, FX_DIAGONAL, FX_IRON_CONDOR,
  FX_LONG_CALL, FX_PUT_CREDIT_SPREAD, FX_RATIO_1X2, FX_SHARES_LONG, FX_SHARES_SHORT,
  FX_SHORT_PUT, FX_SHORT_STRANGLE, FX_SHORT_VERTICAL,
} from './fixtures';
import { netEntryCost } from './leg';
import { MAX_LOSS_ELIGIBLE, maxLossOf } from './maxLoss';
import { STRUCTURE_KINDS, structureKindOf } from './structure';

const of = (p: Parameters<typeof maxLossOf>[0]) => maxLossOf(p, structureKindOf(p));

describe('the eligible set is CLOSED, not detected', () => {
  it('has exactly 15 members and every member is a real StructureKind', () => {
    expect(MAX_LOSS_ELIGIBLE.size).toBe(15);
    for (const k of MAX_LOSS_ELIGIBLE) expect(STRUCTURE_KINDS).toContain(k);
  });

  it('excludes every structurally unbounded shape and every multi-expiration shape', () => {
    for (const k of ['short_call', 'short_straddle', 'short_strangle', 'shares_short', 'calendar', 'diagonal', 'custom'] as const) {
      expect(MAX_LOSS_ELIGIBLE.has(k)).toBe(false);
    }
  });
});

describe('AC-28 — the figure, for the single-leg members too', () => {
  it('a long call loses at most the debit paid', () => {
    expect(of(FX_LONG_CALL)).toEqual({ kind: 'figure', dollars: netEntryCost(FX_LONG_CALL) });
  });

  it('100 long shares lose at most entry x qty', () => {
    expect(of(FX_SHARES_LONG)).toEqual({ kind: 'figure', dollars: 25000 });
  });

  it('a short put loses at most (strike - credit) x multiplier x qty', () => {
    // strike 380, 1 contract, credit 9.10 -> 38000 - 910
    expect(of(FX_SHORT_PUT)).toEqual({ kind: 'figure', dollars: 38000 - 910 });
  });

  it('a debit vertical loses at most the net debit', () => {
    expect(of(FX_CALL_DEBIT_SPREAD)).toEqual({ kind: 'figure', dollars: 630 });
  });

  it('a credit vertical loses at most width x multiplier x qty minus the credit', () => {
    // $400/$420 call credit spread, credit 630 -> 2000 - 630
    expect(of(FX_SHORT_VERTICAL)).toEqual({ kind: 'figure', dollars: 2000 - 630 });
    expect(of(FX_PUT_CREDIT_SPREAD)).toEqual({ kind: 'figure', dollars: 2000 - 490 });
  });

  it('an iron condor loses at most the WIDER wing minus the credit', () => {
    const r = of(FX_IRON_CONDOR);
    expect(r.kind).toBe('figure');
    if (r.kind === 'figure') expect(r.dollars).toBeGreaterThan(0);
  });

  it('a covered call loses at most its net cost', () => {
    expect(of(FX_COVERED_CALL)).toEqual({ kind: 'figure', dollars: netEntryCost(FX_COVERED_CALL) });
  });

  it('every figure is a finite non-negative number — an UNSIGNED magnitude', () => {
    for (const p of [FX_LONG_CALL, FX_SHARES_LONG, FX_SHORT_PUT, FX_CALL_DEBIT_SPREAD, FX_SHORT_VERTICAL, FX_IRON_CONDOR, FX_COVERED_CALL]) {
      const r = of(p);
      expect(r.kind).toBe('figure');
      if (r.kind === 'figure') {
        expect(Number.isFinite(r.dollars)).toBe(true);
        expect(r.dollars).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('AC-29 — no figure and one stated reason, exhaustively three', () => {
  it.each([
    ['unbounded', FX_SHORT_STRANGLE],
    ['unbounded', FX_SHARES_SHORT],
    ['multi_expiration', FX_CALENDAR],
    ['multi_expiration', FX_DIAGONAL],
    ['unnamed_shape', FX_RATIO_1X2],
  ])('withholds with reason %s', (reason, p) => {
    expect(of(p)).toEqual({ kind: 'withheld', reason });
  });

  it('never returns 0, null, NaN or Infinity in place of a withheld reason', () => {
    const r = of(FX_SHORT_STRANGLE);
    expect(r).not.toHaveProperty('dollars');
    expect(r.kind).toBe('withheld');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/maxLoss.spec.ts`
Expected: FAIL — `Failed to resolve import "./maxLoss"`.

- [ ] **Step 3: Write the implementation**

Create `apps/dashboard/src/app/features/trading/positions/maxLoss.ts`:

```ts
/**
 * Max loss — a CLOSED ELIGIBLE SET, not a detection heuristic (SPEC §2.4, owner ruling #1-6-11).
 *
 * Eligibility is membership in a set of 15, so an under-detected naked short cannot produce a
 * confident finite number: an unrecognised shape is INELIGIBLE BY CONSTRUCTION. There is no
 * generic max-loss function over an arbitrary leg set, and there must never be one.
 *
 * The figure is STATIC — it is not live-derived, so it never dims and never degrades on an SSE
 * drop — and it renders UNSIGNED. Breakeven and max gain are Future (zero migration cost to add).
 */
export type MaxLossWithheldReason = 'unbounded' | 'multi_expiration' | 'unnamed_shape';

export type MaxLossResult =
  | { kind: 'figure'; dollars: number }
  | { kind: 'withheld'; reason: MaxLossWithheldReason };

/** The 15. Adding a member later costs ZERO schema and ZERO migration. */
export const MAX_LOSS_ELIGIBLE: ReadonlySet<StructureKind> = new Set([
  'long_call', 'long_put', 'short_put', 'shares_long',
  'long_straddle', 'long_strangle',
  'call_debit_spread', 'call_credit_spread', 'put_debit_spread', 'put_credit_spread',
  'covered_call', 'protective_put', 'collar',
  'iron_condor', 'iron_butterfly',
] as const);

/** The three ineligible classes, in the order the reason is chosen. */
const UNBOUNDED: ReadonlySet<StructureKind> = new Set([
  'short_call', 'short_straddle', 'short_strangle', 'shares_short',
] as const);
const MULTI_EXPIRATION: ReadonlySet<StructureKind> = new Set(['calendar', 'diagonal'] as const);
```

`maxLossOf(p, kind)`:

```ts
export function maxLossOf(p: SimPosition, kind: StructureKind): MaxLossResult {
  if (!MAX_LOSS_ELIGIBLE.has(kind)) {
    if (UNBOUNDED.has(kind)) return { kind: 'withheld', reason: 'unbounded' };
    if (MULTI_EXPIRATION.has(kind)) return { kind: 'withheld', reason: 'multi_expiration' };
    return { kind: 'withheld', reason: 'unnamed_shape' };
  }
  const net = netEntryCost(p); // > 0 debit, < 0 credit
  // ... per-member arithmetic, below
}
```

The per-member arithmetic, each a line of arithmetic on the leg set and never a judgement:

| Members | Figure |
|---|---|
| `long_call`, `long_put`, `long_straddle`, `long_strangle`, `call_debit_spread`, `put_debit_spread`, `shares_long`, `covered_call` | `net` — the debit paid (positive by construction for each of these) |
| `short_put` | `strike × multiplier × qty − |net|` |
| `call_credit_spread`, `put_credit_spread` | `|strikeA − strikeB| × multiplier × qty − |net|` |
| `iron_condor`, `iron_butterfly` | `max(callWingWidth, putWingWidth) × multiplier × qty − |net|` |
| `protective_put`, `collar` | `net − (putStrike × putMultiplier × putQty)` |

Clamp the result with `Math.max(0, …)` and add the comment: *"a negative worst case would mean the structure cannot lose; the eligible set contains no such shape, so a negative here is an arithmetic bug and clamping it to 0 is strictly safer than printing a negative under a `Max loss` header."*

- [ ] **Step 4: Run the tests**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/maxLoss.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx nx test @org/dashboard
git add apps/dashboard/src/app/features/trading/positions/maxLoss.ts apps/dashboard/src/app/features/trading/positions/maxLoss.spec.ts
git commit -m "feat(positions): max loss over a closed 15-member eligible set, three withheld reasons

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task F5: `composeMark.ts` — the structure mark

Spec §2.5 in full. AC-38, AC-39, AC-41, AC-43, AC-44.

**`computeMark` in `model/mark.ts` stays exactly as it is — per-contract, untouched. Do not generalize it to be leg-aware.** It is the proven honesty ladder; making it leg-aware would fuse "what is this contract worth" with "what is this structure worth", two different questions with different failure modes. A new pure composer sits **above** it.

**Files:**
- Create: `apps/dashboard/src/app/features/trading/positions/composeMark.ts`
- Test: `apps/dashboard/src/app/features/trading/positions/composeMark.spec.ts`

**Interfaces:**
- Consumes: `Leg`, `LegId`, `SimPosition`, `legValue` from `./leg`; `MarkResult` from `@/features/trading/model/mark`; `MarkBasis` from `@/features/trading/model/types`.
- Produces, relied on by F8, F10:
  - `interface PositionMark { net_mark: number | null; basis: MarkBasis; frozen: boolean; unavailable: boolean; resolved_legs: number; total_legs: number }`
  - `const BASIS_WEAKNESS: Record<MarkBasis, number>`
  - `function composePositionMark(legMarks: ReadonlyMap<LegId, MarkResult | null>, p: SimPosition): PositionMark`
  - `function legContractKey(l: Leg): string | null` — the resolver de-duplication key; `null` for an equity leg
  - `function compositeLimitWouldFill(legMarks: ReadonlyMap<LegId, MarkResult | null>, p: SimPosition, limit: number): boolean`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/app/features/trading/positions/composeMark.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { MarkResult } from '@/features/trading/model/mark';
import { FX_CALL_DEBIT_SPREAD, FX_COVERED_CALL, FX_SHARES_LONG, mkLeg, mkPosition } from './fixtures';
import { BASIS_WEAKNESS, compositeLimitWouldFill, composePositionMark, legContractKey } from './composeMark';

const mr = (mark: number | null, basis: MarkResult['basis'] = 'snapshot', frozen = false): MarkResult => ({ mark, basis, frozen });

describe('composePositionMark', () => {
  it('nets a DOLLAR figure across legs, not a per-unit price', () => {
    const [a, b] = FX_CALL_DEBIT_SPREAD.legs;
    const r = composePositionMark(new Map([[a.id, mr(14)], [b.id, mr(7)]]), FX_CALL_DEBIT_SPREAD);
    expect(r.net_mark).toBeCloseTo(14 * 100 - 7 * 100, 6);
    expect(r.unavailable).toBe(false);
    expect(r.resolved_legs).toBe(2);
    expect(r.total_legs).toBe(2);
  });

  it('ALL-OR-NOTHING — one null leg withholds net_mark entirely, never a partial sum', () => {
    const [a, b] = FX_CALL_DEBIT_SPREAD.legs;
    const r = composePositionMark(new Map([[a.id, mr(14)], [b.id, null]]), FX_CALL_DEBIT_SPREAD);
    expect(r.net_mark).toBeNull();
    expect(r.unavailable).toBe(true);
    expect(r.resolved_legs).toBe(1);
    expect(r.total_legs).toBe(2);
  });

  it('a missing map entry counts as unresolved, not as zero', () => {
    const [a] = FX_CALL_DEBIT_SPREAD.legs;
    const r = composePositionMark(new Map([[a.id, mr(14)]]), FX_CALL_DEBIT_SPREAD);
    expect(r.net_mark).toBeNull();
    expect(r.unavailable).toBe(true);
  });

  it('basis is the WEAKEST link — a structure containing a theoretical leg is theoretical', () => {
    const [a, b] = FX_CALL_DEBIT_SPREAD.legs;
    const r = composePositionMark(new Map([[a.id, mr(14, 'snapshot')], [b.id, mr(7, 'theoretical')]]), FX_CALL_DEBIT_SPREAD);
    expect(r.basis).toBe('theoretical');
  });

  it('frozen is an OR across legs — one frozen leg freezes the structure', () => {
    const [a, b] = FX_CALL_DEBIT_SPREAD.legs;
    const r = composePositionMark(new Map([[a.id, mr(14, 'snapshot', false)], [b.id, mr(7, 'snapshot', true)]]), FX_CALL_DEBIT_SPREAD);
    expect(r.frozen).toBe(true);
  });

  it('offline and partial-unavailable do NOT collapse: all-last_known still yields a number', () => {
    const [a, b] = FX_CALL_DEBIT_SPREAD.legs;
    const offline = composePositionMark(new Map([[a.id, mr(14, 'last_known')], [b.id, mr(7, 'last_known')]]), FX_CALL_DEBIT_SPREAD);
    expect(offline.net_mark).not.toBeNull();
    expect(offline.unavailable).toBe(false);
    expect(offline.basis).toBe('last_known');
  });

  it('the weakness ladder is snapshot > modeled > theoretical > last_known', () => {
    expect(BASIS_WEAKNESS.snapshot).toBeLessThan(BASIS_WEAKNESS.modeled);
    expect(BASIS_WEAKNESS.modeled).toBeLessThan(BASIS_WEAKNESS.theoretical);
    expect(BASIS_WEAKNESS.theoretical).toBeLessThan(BASIS_WEAKNESS.last_known);
  });
});

describe('legContractKey — resolver de-duplication', () => {
  it('is null for an equity leg (it never issues a contract lookup)', () => {
    expect(legContractKey(FX_SHARES_LONG.legs[0])).toBeNull();
  });

  it('is identical for the same (ticker, expiration, strike, right) across different positions', () => {
    const a = mkLeg({ id: 'x', ticker: 'TSLA', expiration: '2026-08-21', strike: 440, right: 'call' });
    const b = mkLeg({ id: 'y', ticker: 'TSLA', expiration: '2026-08-21', strike: 440, right: 'call', side: 'short', qty: 3 });
    expect(legContractKey(a)).toBe(legContractKey(b));
  });

  it('distinguishes right and expiration', () => {
    const call = mkLeg({ right: 'call' });
    const put = mkLeg({ right: 'put' });
    expect(legContractKey(call)).not.toBe(legContractKey(put));
  });

  it('a covered call issues exactly ONE contract lookup key', () => {
    const keys = FX_COVERED_CALL.legs.map(legContractKey).filter((k): k is string => k != null);
    expect(keys).toHaveLength(1);
  });
});

describe('AC-44 — a composite limit never fills off a stale leg', () => {
  const p = mkPosition([mkLeg({ id: 'a', entry_price: 10 }), mkLeg({ id: 'b', side: 'short', strike: 420, entry_price: 4 })], { status: 'pending', limit_price: 600 });

  it('fills when EVERY leg is live, non-frozen and non-last_known and the net crosses', () => {
    const marks = new Map([['a', mr(9, 'snapshot')], ['b', mr(3, 'modeled')]]);
    expect(compositeLimitWouldFill(marks, p, 600)).toBe(true);
  });

  it('refuses when ANY leg is last_known', () => {
    const marks = new Map([['a', mr(9, 'snapshot')], ['b', mr(3, 'last_known')]]);
    expect(compositeLimitWouldFill(marks, p, 600)).toBe(false);
  });

  it('refuses when ANY leg is frozen', () => {
    const marks = new Map([['a', mr(9, 'snapshot', true)], ['b', mr(3, 'modeled')]]);
    expect(compositeLimitWouldFill(marks, p, 600)).toBe(false);
  });

  it('refuses when ANY leg is unresolved', () => {
    const marks = new Map([['a', mr(9, 'snapshot')], ['b', null]]);
    expect(compositeLimitWouldFill(marks, p, 600)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/composeMark.spec.ts`
Expected: FAIL — `Failed to resolve import "./composeMark"`.

- [ ] **Step 3: Write the implementation**

Create `apps/dashboard/src/app/features/trading/positions/composeMark.ts`:

```ts
/**
 * The mark ladder for a STRUCTURE. `computeMark` (model/mark.ts) stays exactly as it is —
 * per-contract, untouched, NOT generalized to be leg-aware (SPEC §2.5). This composer sits above it.
 *
 * ALL-OR-NOTHING is the hardest rule here: if ANY leg's mark is null, `net_mark` and P/L are null.
 * NEVER a partial sum. The reason is not incompleteness, it is SIGN INVERSION — drop the short leg
 * from a credit spread and a losing position renders as a winner. At the leg level, zeroing a
 * missing member does not shrink the number, it INVERTS it. All three council voices converged on
 * this independently; the pressure to relax it into "a partial sum with an asterisk" must be
 * refused. The mitigation is the leg disclosure: per-leg truth is fully visible; only the
 * AGGREGATE is withheld.
 *
 * Offline and partial-unavailable cannot collapse into one state STRUCTURALLY, not by convention:
 * an SSE drop resolves EVERY leg to `last_known` (a resolved but weak basis — a dimmed number still
 * exists), while a failed leg lookup yields `null` (so the aggregate is withheld).
 */
import type { MarkResult } from '@/features/trading/model/mark';
import type { MarkBasis } from '@/features/trading/model/types';
import { legValue, type Leg, type LegId, type SimPosition } from './leg';

export interface PositionMark {
  /** SUM s * mark * multiplier * qty — a DOLLAR net, not a per-unit price. */
  net_mark: number | null;
  /** The WEAKEST leg basis. */
  basis: MarkBasis;
  /** OR across legs. */
  frozen: boolean;
  /** OR across legs — true when at least one leg is unresolved. */
  unavailable: boolean;
  resolved_legs: number;
  total_legs: number;
}

/** snapshot > modeled > theoretical > last_known. `manual` sits at the end: a user-typed price is
 *  not a market read at all, so it can never be the strongest basis in a mixed structure. */
export const BASIS_WEAKNESS: Record<MarkBasis, number> = {
  snapshot: 0,
  modeled: 1,
  theoretical: 2,
  last_known: 3,
  manual: 4,
};

export function composePositionMark(
  legMarks: ReadonlyMap<LegId, MarkResult | null>,
  p: SimPosition,
): PositionMark {
  let net = 0;
  let resolved = 0;
  let frozen = false;
  let weakest: MarkBasis = 'snapshot';
  let anyUnresolved = false;

  for (const l of p.legs) {
    const res = legMarks.get(l.id) ?? null;
    if (res == null || res.mark == null) {
      anyUnresolved = true;
      continue;
    }
    resolved += 1;
    net += legValue(l, res.mark);
    frozen = frozen || res.frozen;
    if (BASIS_WEAKNESS[res.basis] > BASIS_WEAKNESS[weakest]) weakest = res.basis;
  }

  return {
    net_mark: anyUnresolved ? null : net,
    basis: weakest,
    frozen,
    unavailable: anyUnresolved,
    resolved_legs: resolved,
    total_legs: p.legs.length,
  };
}

/**
 * The de-duplication key for the resolver fan-out: distinct `(ticker, expiration, strike, right)`
 * across the WHOLE portfolio, so a condor plus a covered call on the same underlying does not issue
 * duplicate lookups. `null` for an equity leg — an equity leg bypasses the ladder entirely and
 * never issues a contract lookup.
 */
export function legContractKey(l: Leg): string | null {
  if (l.kind !== 'option') return null;
  if (l.expiration == null || l.strike == null || l.right == null) return null;
  return `${l.ticker.toUpperCase()}|${l.expiration}|${l.strike}|${l.right}`;
}

/**
 * The composite of `limitWouldFill` (positions/entry.ts): today it requires a live, non-frozen,
 * non-`last_known` mark; the composite version requires that of EVERY leg, so a structure with one
 * stale leg never fills.
 */
export function compositeLimitWouldFill(
  legMarks: ReadonlyMap<LegId, MarkResult | null>,
  p: SimPosition,
  limit: number,
): boolean {
  for (const l of p.legs) {
    const res = legMarks.get(l.id) ?? null;
    if (res == null || res.mark == null) return false;
    if (res.frozen || res.basis === 'last_known') return false;
  }
  const composed = composePositionMark(legMarks, p);
  return composed.net_mark != null && composed.net_mark <= limit;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/composeMark.spec.ts`
Expected: PASS.

- [ ] **Step 5: Confirm `model/mark.ts` is untouched, then commit**

```bash
git diff --stat HEAD -- apps/dashboard/src/app/features/trading/model/mark.ts
```
Expected: empty output. `computeMark` must not have changed.

```bash
npx nx test @org/dashboard
git add apps/dashboard/src/app/features/trading/positions/composeMark.ts apps/dashboard/src/app/features/trading/positions/composeMark.spec.ts
git commit -m "feat(positions): compose a structure mark above the untouched per-contract ladder

All-or-nothing on a null leg; weakest-link basis; frozen ORs across legs;
composite limits never fill off a stale leg.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task F6: `evalSubject.ts` — primary-leg selection

Spec §2.8. AC-73, AC-74, AC-75.

Owner ruling #9: **`position_eval` is SUPPRESSED for multi-leg.** Two fixes are kept anyway because they cost nothing and repair real bugs: the **`leg.id` final tiebreak** (without it two identical legs make the choice depend on array order, so the alert subject could change on reload with no user action) and the **short-leg fallback** (the original long-only rule silently killed the alert for every short put — the most common short structure there is).

**`primary_leg_label` is DEFERRED with the copy.** Under suppression v1 needs only `leg_id` + `of_legs`. Do **not** build a dead field, and do **not** wire any of the four `POSITION_EVAL_*` strings in spec §4 *Future copy* — they are retained pending a consumer and must not be referenced by any component in this release.

**Files:**
- Create: `apps/dashboard/src/app/features/trading/positions/evalSubject.ts`
- Test: `apps/dashboard/src/app/features/trading/positions/evalSubject.spec.ts`

**Interfaces:**
- Consumes: `Leg`, `LegId`, `SimPosition` from `./leg`.
- Produces, relied on by F8, F10, F18:
  - `type EvalSubject = { kind: 'whole_position'; leg_id: LegId } | { kind: 'primary_leg'; leg_id: LegId; of_legs: number } | { kind: 'none'; reason: 'no_option_leg' }`
  - `function evalSubjectOf(p: SimPosition): EvalSubject`
  - **Forward note (B1 ruling):** `SPEC.md` §2.8 names the `none` branch's reason type **`EvalNoneReason`** — a closed vocabulary with two members, `no_option_leg` and `multiple_positions`. **Declare it here as a named union type carrying only `'no_option_leg'`**, not as a bare inline string literal, so that **F18 Step 5** adds `'multiple_positions'` in one line and the compiler propagates it to every exhaustive switch. Do **not** add the second member here: `multiple_positions` is a **ticker-level** fact (>1 open position on the focused ticker) and `evalSubjectOf` is **position-level** — within a position, `none` is reachable only when there is no option leg at all.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/app/features/trading/positions/evalSubject.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FX_IRON_CONDOR, FX_LONG_CALL, FX_SHARES_LONG, FX_SHORT_PUT, mkLeg, mkPosition } from './fixtures';
import { evalSubjectOf } from './evalSubject';

describe('evalSubjectOf', () => {
  it('a single option leg IS the position', () => {
    expect(evalSubjectOf(FX_LONG_CALL)).toEqual({ kind: 'whole_position', leg_id: FX_LONG_CALL.legs[0].id });
  });

  it('a shares-only position produces `none` with an explicit reason, not an ambiguous null', () => {
    expect(evalSubjectOf(FX_SHARES_LONG)).toEqual({ kind: 'none', reason: 'no_option_leg' });
  });

  it('multi-leg selects a primary leg and reports of_legs', () => {
    const s = evalSubjectOf(FX_IRON_CONDOR);
    expect(s.kind).toBe('primary_leg');
    if (s.kind === 'primary_leg') expect(s.of_legs).toBe(4);
  });

  it('carries NO primary_leg_label — that field is deferred with the copy', () => {
    expect(evalSubjectOf(FX_IRON_CONDOR)).not.toHaveProperty('primary_leg_label');
  });

  it('prefers the LONG option leg with the largest |qty x multiplier|', () => {
    const p = mkPosition([
      mkLeg({ id: 'small-long', side: 'long', qty: 1, strike: 400 }),
      mkLeg({ id: 'big-long', side: 'long', qty: 5, strike: 420 }),
      mkLeg({ id: 'huge-short', side: 'short', qty: 9, strike: 440 }),
    ]);
    const s = evalSubjectOf(p);
    expect(s.kind === 'primary_leg' && s.leg_id).toBe('big-long');
  });

  it('SHORT-LEG FALLBACK — with no long option leg it still selects, still primary_leg', () => {
    const s = evalSubjectOf(FX_SHORT_PUT);
    // one leg only, so it is the whole position
    expect(s).toEqual({ kind: 'whole_position', leg_id: FX_SHORT_PUT.legs[0].id });

    const twoShorts = mkPosition([
      mkLeg({ id: 's1', side: 'short', qty: 1, strike: 420, right: 'call' }),
      mkLeg({ id: 's2', side: 'short', qty: 4, strike: 380, right: 'put' }),
    ]);
    const t = evalSubjectOf(twoShorts);
    expect(t).toEqual({ kind: 'primary_leg', leg_id: 's2', of_legs: 2 });
  });

  it('ignores equity legs when selecting, but counts them in of_legs', () => {
    const s = evalSubjectOf(mkPosition([
      mkLeg({ id: 'eq', kind: 'equity', qty: 100, multiplier: 1, strike: null, right: null, expiration: null }),
      mkLeg({ id: 'opt', side: 'short', qty: 1, strike: 420 }),
    ]));
    expect(s).toEqual({ kind: 'primary_leg', leg_id: 'opt', of_legs: 2 });
  });

  it('breaks ties by nearest expiration, then lowest strike, then leg.id — DETERMINISTIC', () => {
    const legs = [
      mkLeg({ id: 'zzz', qty: 2, expiration: '2026-08-21', strike: 400 }),
      mkLeg({ id: 'aaa', qty: 2, expiration: '2026-08-21', strike: 400 }),
      mkLeg({ id: 'far', qty: 2, expiration: '2026-09-18', strike: 100 }),
      mkLeg({ id: 'high', qty: 2, expiration: '2026-08-21', strike: 999 }),
    ];
    const forward = evalSubjectOf(mkPosition(legs));
    const reversed = evalSubjectOf(mkPosition([...legs].reverse()));
    expect(forward).toEqual(reversed);
    expect(forward.kind === 'primary_leg' && forward.leg_id).toBe('aaa');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/evalSubject.spec.ts`
Expected: FAIL — `Failed to resolve import "./evalSubject"`.

- [ ] **Step 3: Write the implementation**

Create `apps/dashboard/src/app/features/trading/positions/evalSubject.ts`:

```ts
/**
 * `eval_subject` — which leg the position-context read is ABOUT (SPEC §2.8, owner ruling #9).
 *
 * v1 SUPPRESSES the evaluation for multi-leg positions. Suppression is a RENDER decision only: the
 * `pos_*` request stays unconditional and its shape never branches, so it remains byte-identical
 * and a multi-leg `pos_*` request in the network tab is CORRECT, not a defect (AC-74).
 *
 * Two fixes are kept anyway because they cost nothing and repair real bugs:
 *  - the `leg.id` FINAL TIEBREAK: without it two identical legs make the choice depend on array
 *    order, so the alert subject could change on reload with no user action;
 *  - the SHORT-LEG FALLBACK: the original long-only rule silently killed the alert for every short
 *    put, the most common short structure there is.
 *
 * There is deliberately NO `primary_leg_label` — that field is deferred with its copy, and the FE
 * lane must not build a dead field.
 */
import type { Leg, LegId, SimPosition } from './leg';

export type EvalSubject =
  | { kind: 'whole_position'; leg_id: LegId }
  | { kind: 'primary_leg'; leg_id: LegId; of_legs: number }
  | { kind: 'none'; reason: 'no_option_leg' };

const notional = (l: Leg) => Math.abs(l.qty * l.multiplier);

/** Largest notional, then nearest expiration, then lowest strike, then leg.id lexicographic. */
function pick(candidates: Leg[]): Leg {
  return [...candidates].sort((a, b) => {
    const n = notional(b) - notional(a);
    if (n !== 0) return n;
    const ea = a.expiration ?? '9999-12-31';
    const eb = b.expiration ?? '9999-12-31';
    if (ea !== eb) return ea < eb ? -1 : 1;
    const sa = a.strike ?? Number.POSITIVE_INFINITY;
    const sb = b.strike ?? Number.POSITIVE_INFINITY;
    if (sa !== sb) return sa - sb;
    return a.id.localeCompare(b.id);
  })[0];
}

export function evalSubjectOf(p: SimPosition): EvalSubject {
  const options = p.legs.filter((l) => l.kind === 'option');
  if (options.length === 0) return { kind: 'none', reason: 'no_option_leg' };

  const longs = options.filter((l) => l.side === 'long');
  const chosen = pick(longs.length > 0 ? longs : options);

  // Exactly one option leg AND no other leg at all ⇒ the position IS the leg.
  if (p.legs.length === 1) return { kind: 'whole_position', leg_id: chosen.id };
  return { kind: 'primary_leg', leg_id: chosen.id, of_legs: p.legs.length };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/evalSubject.spec.ts`
Expected: PASS.

- [ ] **Step 5: Verify the Future copy is unwired**

```bash
grep -rn "POSITION_EVAL_LEG_QUALIFIER\|POSITION_EVAL_TIP\|POSITION_EVAL_NONE_EQUITY\|POSITION_EVAL_NONE_SHORT\|POSITION_EVAL_NONE_MULTI_POSITION" apps/dashboard/src
```
Expected: no matches. Those **five** strings are Future copy pending a consumer (spec §4) and must not appear in code in this release — including `POSITION_EVAL_NONE_MULTI_POSITION`, whose *behaviour* F18 ships while its *string* stays unwired.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/app/features/trading/positions/evalSubject.ts apps/dashboard/src/app/features/trading/positions/evalSubject.spec.ts
git commit -m "feat(positions): eval_subject selection with the leg.id tiebreak and short-leg fallback

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task F7: `migrate.ts` — the ONE lift and the union

Spec §2.6 in full, plus the *Failure modes + isolation* table. AC-45 through AC-49, AC-52, AC-55, AC-57, AC-60.

**This is the single most important decision in the feature: the v3 migration is a UNION, not an else-chain.** A read-new-else-old chain would silently drop every Ticker-page ghost trade belonging to any trader who has ever opened `/positions` — `outcomes/sources.ts:160` already documents the consequence in shipped code (*"v1-only positions exist and are PERMANENT"*). That is the silent / total / irreversible loss that got `loss-free-durable-migration` promoted on severity. Not negotiable.

This task is **pure**: it takes already-parsed source material and returns a result. It touches no storage and is wired to nothing yet. F18 wires it into the store; F19 wires the *same function* into the archive import — **one migrate function, two callers**. If they diverge, importing your own backup produces different records than the migration did, a discrepancy nobody would notice until it mattered.

**Files:**
- Create: `apps/dashboard/src/app/features/trading/positions/migrate.ts`
- Test: `apps/dashboard/src/app/features/trading/positions/migrate.spec.ts`

**Interfaces:**
- Consumes: `Leg`, `SimPosition`, `SIM_POSITION_SCHEMA_VERSION` from `./leg`; `DecisionRecord` from `./types`; `decisionIdentity` from `@/features/trading/outcomes/sources`.
- Produces, relied on by F10, F18, F19:
  - `interface ParsedSource { key: string; ok: boolean; records: unknown[]; decisions: unknown[] }`
  - `interface UnionResult { positions: Record<string, SimPosition>; decisions: DecisionRecord[]; source_counts: Record<string, { read: number; contributed: number }>; unread_sources: string[]; aborted: boolean }`
  - `function liftLegacyRecord(raw: unknown): SimPosition | null` — **the ONE lift function**
  - `function unionSources(sources: ParsedSource[]): UnionResult`
  - `function mergeCollidingRecords(first: SimPosition, second: SimPosition): SimPosition`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/app/features/trading/positions/migrate.spec.ts`:

```ts
/**
 * Unit — the ONE lift function and the union. Spec §7 invariant 1: union-once, distinct-id count,
 * abort-entirely on any unreadable source, no fabrication in the lift, and one lift shared by the
 * store and the archive import.
 */
import { describe, expect, it } from 'vitest';
import { COLLIDING_ID_PAIR, LEGACY_V1_RECORD, LEGACY_V2_RECORD, MALFORMED_LEGACY_RECORD } from './fixtures';
import { liftLegacyRecord, mergeCollidingRecords, unionSources, type ParsedSource } from './migrate';

const src = (key: string, records: unknown[], decisions: unknown[] = [], ok = true): ParsedSource => ({ key, ok, records, decisions });

describe('liftLegacyRecord — the ONE lift', () => {
  it('AC-48 — keeps ticker, quantity, entry price, entry time and open/closed state', () => {
    const p = liftLegacyRecord(LEGACY_V2_RECORD);
    expect(p).not.toBeNull();
    expect(p!.legs).toHaveLength(1);
    expect(p!.legs[0].ticker).toBe('TSLA');
    expect(p!.legs[0].qty).toBe(2);
    expect(p!.legs[0].entry_price).toBe(12.4);
    expect(p!.opened_time).toBe('2026-06-12T15:32:00Z');
    expect(p!.status).toBe('open');
    expect(p!.stop).toBe(8);
    expect(p!.target).toBe(22);
  });

  it('sets instrument_kind option and multiplier 100 on every migrated leg', () => {
    const p = liftLegacyRecord(LEGACY_V1_RECORD)!;
    expect(p.legs[0].kind).toBe('option');
    expect(p.legs[0].multiplier).toBe(100);
  });

  it('AC-48 — a pending limit`s EMPTY entry time is carried through, never backfilled', () => {
    const p = liftLegacyRecord({ ...LEGACY_V2_RECORD, status: 'pending', entry_time: '', limit_price: 9 })!;
    expect(p.opened_time).toBe('');
    expect(p.status).toBe('pending');
    expect(p.limit_price).toBe(9);
  });

  it('is FORBIDDEN from fabricating a right, a strike or an entry time', () => {
    const p = liftLegacyRecord(MALFORMED_LEGACY_RECORD)!;
    expect(p.legs[0].right).toBeNull();
    expect(p.legs).toHaveLength(1);
  });

  it('does NOT carry the old Strategy value forward', () => {
    const p = liftLegacyRecord({ ...LEGACY_V2_RECORD, strategy: 'long_call' }) as unknown as Record<string, unknown>;
    expect(p.strategy).toBeUndefined();
  });

  it('returns null for a record with no usable id', () => {
    expect(liftLegacyRecord({ ticker: 'TSLA' })).toBeNull();
    expect(liftLegacyRecord(null)).toBeNull();
    expect(liftLegacyRecord('nope')).toBeNull();
  });

  it('never throws on arbitrary garbage', () => {
    for (const junk of [undefined, 0, [], { legs: 'no' }, { id: 5 }]) {
      expect(() => liftLegacyRecord(junk)).not.toThrow();
    }
  });
});

describe('unionSources', () => {
  it('AC-45/46 — unions both surfaces and counts DISTINCT IDS, not the arithmetic sum', () => {
    const r = unionSources([
      src('convexa.positions.v2', [COLLIDING_ID_PAIR.v2Record]),
      src('convexa.ghost-trade.v1', [COLLIDING_ID_PAIR.v1Record, LEGACY_V1_RECORD]),
    ]);
    expect(r.aborted).toBe(false);
    expect(Object.keys(r.positions).sort()).toEqual(['ghost-only-1', 'shared-1']);
    expect(r.source_counts['convexa.positions.v2']).toEqual({ read: 1, contributed: 1 });
    expect(r.source_counts['convexa.ghost-trade.v1']).toEqual({ read: 2, contributed: 1 });
  });

  it('AC-46 — two records of the same CONTRACT with different ids remain TWO positions', () => {
    const r = unionSources([
      src('convexa.positions.v2', [
        { ...LEGACY_V2_RECORD, id: 'lot-a' },
        { ...LEGACY_V2_RECORD, id: 'lot-b' },
      ]),
    ]);
    expect(Object.keys(r.positions)).toHaveLength(2);
  });

  it('keep-first is v2-before-v1, EXCEPT that closed in either source is closed', () => {
    const r = unionSources([
      src('convexa.positions.v2', [COLLIDING_ID_PAIR.v2Record]),
      src('convexa.ghost-trade.v1', [COLLIDING_ID_PAIR.v1Record]),
    ]);
    const merged = r.positions['shared-1'];
    expect(merged.status).toBe('closed');
    expect(merged.close_time).toBe('2026-06-30T19:55:00Z');
    expect(merged.realized_pl_dollar).toBe(196);
    // plan fields take the v2 copy
    expect(merged.stop).toBe(8);
    expect(merged.target).toBe(22);
  });

  it('AC-49 — unions decisions by identity, ONCE EACH, with no renumbering', () => {
    const shared = { id: 'd-1', event_type: 'open', clock_time: '2026-06-12T15:32:00Z', trade_id: 'shared-1' };
    const onlyV1 = { id: 'd-2', event_type: 'open', clock_time: '2026-06-18T14:05:00Z', trade_id: 'ghost-only-1' };
    const r = unionSources([
      src('convexa.positions.v2', [], [shared]),
      src('convexa.ghost-trade.v1', [], [shared, onlyV1]),
    ]);
    expect(r.decisions).toHaveLength(2);
    expect(r.decisions.map((d) => d.id)).toEqual(['d-1', 'd-2']);
  });

  it('AC-57 — ABORTS ENTIRELY if ANY source is unread; no partial result is offered', () => {
    const r = unionSources([
      src('convexa.positions.v2', [LEGACY_V2_RECORD]),
      src('convexa.ghost-trade.v1', [], [], false),
    ]);
    expect(r.aborted).toBe(true);
    expect(r.unread_sources).toEqual(['convexa.ghost-trade.v1']);
  });

  it('an unread source contributes ZERO records but the readable ones are still available in memory', () => {
    const r = unionSources([
      src('convexa.positions.v2', [LEGACY_V2_RECORD]),
      src('convexa.ghost-trade.v1', [], [], false),
    ]);
    expect(Object.keys(r.positions)).toEqual(['shared-1']);
  });

  it('AC-52 — no sources at all is a clean empty result, not an error and not an abort', () => {
    const r = unionSources([src('convexa.positions.v2', []), src('convexa.ghost-trade.v1', [])]);
    expect(r.aborted).toBe(false);
    expect(r.positions).toEqual({});
    expect(r.decisions).toEqual([]);
    expect(r.source_counts['convexa.positions.v2']).toEqual({ read: 0, contributed: 0 });
  });

  it('is deterministic — the same input yields the same output', () => {
    const input = () => [src('convexa.positions.v2', [COLLIDING_ID_PAIR.v2Record]), src('convexa.ghost-trade.v1', [COLLIDING_ID_PAIR.v1Record])];
    expect(unionSources(input())).toEqual(unionSources(input()));
  });
});

describe('mergeCollidingRecords', () => {
  it('re-opening a closed trade is impossible — the asymmetry is deliberate', () => {
    const open = liftLegacyRecord(COLLIDING_ID_PAIR.v2Record)!;
    const closed = liftLegacyRecord(COLLIDING_ID_PAIR.v1Record)!;
    expect(mergeCollidingRecords(open, closed).status).toBe('closed');
    expect(mergeCollidingRecords(closed, open).status).toBe('closed');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/migrate.spec.ts`
Expected: FAIL — `Failed to resolve import "./migrate"`.

- [ ] **Step 3: Write the implementation**

Create `apps/dashboard/src/app/features/trading/positions/migrate.ts`. Structure:

```ts
/**
 * The v3 migration: `positions.v2` + `ghost-trade.v1` -> ONE `SimPosition` collection, as a UNION.
 *
 * WHY A UNION AND NOT THE SHIPPED READ-NEW-ELSE-OLD CHAIN: `useGhostTrade` is LIVE and has been
 * writing `convexa.ghost-trade.v1` continuously, while `positions/store.ts` consults v1 ONLY when no
 * v2 blob exists. `outcomes/sources.ts:160` documents the consequence in shipped code — "v1-only
 * positions exist and are PERMANENT". An else-chain v3 migration would therefore SILENTLY DROP every
 * Ticker-page ghost trade for any user who has ever opened the Positions page.
 *
 * ID COLLISIONS BETWEEN THE TWO SOURCES ARE THE EXPECTED CASE, not an edge case:
 * `positions/store.ts:49` (`v1TradeToPosition`) carries `id: t.id` forward verbatim. Consequence:
 * the count-after criterion is a DISTINCT-ID count, never the arithmetic sum (AC-46).
 *
 * THIS MODULE IS PURE. It takes parsed source material and returns a result; it never reads or
 * writes storage. `liftLegacyRecord` has exactly TWO production callers — the store migration and
 * the archive import — and they must never diverge (SPEC §2.6): if they do, importing your own
 * backup produces different records than the migration did.
 */
```

`liftLegacyRecord(raw: unknown): SimPosition | null`:
- Reject non-objects and anything without a non-empty string `id` ⇒ `null`.
- Build **exactly one** leg: `{ id: <derived>, kind: 'option', ticker: String(r.ticker ?? '').toUpperCase(), side: 'long', qty: <number or 0>, multiplier: 100, entry_price: <number or 0>, entry_basis: <string or 'manual'>, expiration: <string or null>, strike: <number or null>, right: <'call'|'put' or null> }`.
  - `kind: 'option'` is **a fact about the source key** (both legacy stores are option-only by construction), not a guess about the record — so a leg whose instrument kind is itself unknown is unreachable and no fourth cell literal is needed.
  - Mint the leg id deterministically as `` `${r.id}-l0` `` so a repeated lift of the same record produces the same leg id (the archive import and the store migration must agree).
  - **Forbidden:** fabricating a `right`, a `strike` or an `entry_time`. A malformed record lifts to a leg with `null`s, renders `Custom`, and shows `not recorded` in the cells whose facts were never held.
- Carry `opened_time` from `entry_time` **verbatim, including `''`**.
- Carry `status`, `entry_mode` (default `'manual'`), `limit_price`, `placed_time`, `stop`, `target`, `realized_pl_dollar`, `realized_pl_pct`, `close_time`, `origin_order_id`.
- Set `schema_version: SIM_POSITION_SCHEMA_VERSION`.
- **Never** carry a `strategy` value forward — the recogniser derives the kind from the leg, and that is what makes future recogniser changes migration-free.
- Wrap the whole body in `try { … } catch { return null; }`.

`mergeCollidingRecords(first, second)`:

```ts
/**
 * Keep-first, v2-before-v1, with ONE monotone exception: for a colliding id the two copies are the
 * same trade, forked, with no reliable clock to order them. The v2 copy generally wins (it is the
 * one edited on the Positions page), EXCEPT that a record closed in EITHER source is closed, taking
 * that source's close_time / realized figures. Re-opening a closed trade fabricates an exposure the
 * trader does not have; the reverse error is not symmetric. Plan fields take the v2 (first) copy.
 */
export function mergeCollidingRecords(first: SimPosition, second: SimPosition): SimPosition {
  const terminal = (s: SimPosition) => s.status === 'closed' || s.status === 'cancelled';
  if (terminal(first) || !terminal(second)) return first;
  return {
    ...first,
    status: second.status,
    close_time: second.close_time,
    realized_pl_dollar: second.realized_pl_dollar,
    realized_pl_pct: second.realized_pl_pct,
  };
}
```

`unionSources(sources)`:
- Walk `sources` **in the given order** — the caller passes v2 first, v1 second (source precedence).
- For each source: if `!ok`, push its key onto `unread_sources`, record `{ read: 0, contributed: 0 }`, and contribute nothing.
- For a readable source: `read` counts the entries offered; lift each; on an id already present call `mergeCollidingRecords(existing, lifted)` and do **not** increment `contributed`; on a new id insert it and increment `contributed`.
- Decisions: union across all readable sources by `decisionIdentity(d)` (the existing helper — per-record uuid, else the composite key), **preserving first-seen order**. No renumbering, no timestamp rewriting.
- `aborted: unread_sources.length > 0`. **The caller must not write a v3 blob when `aborted` is true** — that rule lives in the store (F18), and this function's job is to report it truthfully while still returning whatever parsed so the store can run in memory.

- [ ] **Step 4: Run the tests**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/migrate.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx nx test @org/dashboard
git add apps/dashboard/src/app/features/trading/positions/migrate.ts apps/dashboard/src/app/features/trading/positions/migrate.spec.ts
git commit -m "feat(positions): the ONE lift function and the v2+v1 union (pure, not yet wired)

A union, not an else-chain: an else-chain would silently drop every Ticker-page
ghost trade for a trader who has opened /positions (sources.ts:160).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task F8: `view.ts` — the `PositionView` projection

Spec §2.7 (`PositionView` paragraph), §4 *The `contract` cell*, §4 *The leg disclosure*. AC-22, AC-32, AC-33, AC-37.

**`PositionView` is a per-cycle DERIVED, NEVER-PERSISTED projection** (the existing `DerivedRow` / `OrderEvalState` precedent). **Presentational components consume a `PositionView` and never import the store, never call the recogniser, and never perform leg arithmetic or leg formatting.** If a component needs a number that is not on the projection, that is a change to `view.ts`, not a component reaching past the boundary. That projection boundary is what lets the same components serve sim-now and broker-later without a fork.

The structure line's collapsed form is **authored in the string**, never delegated to CSS overflow (AC-37).

**Files:**
- Create: `apps/dashboard/src/app/features/trading/positions/view.ts`
- Test: `apps/dashboard/src/app/features/trading/positions/view.spec.ts`

**Interfaces:**
- Consumes: everything from `./leg`, `./structure`, `./maxLoss`, `./composeMark`, `./evalSubject`; `MarkResult` from `@/features/trading/model/mark`.
- Produces, relied on by F10–F16:
  - `interface LegDisplayRow { leg_id: LegId; side_word: 'Long' | 'Short'; size_text: string; instrument_text: string; instrument_kind: InstrumentKind; mark: number | null; basis: MarkBasis | null; unavailable: boolean }`
  - `interface PositionView { … }` (fields below)
  - `function buildPositionView(args: { position: SimPosition; legMarks: ReadonlyMap<LegId, MarkResult | null>; dte: number | null }): PositionView`
  - `const STRUCTURE_LINE_MAX_STRIKES = 3`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/app/features/trading/positions/view.spec.ts`. Assert the invariants, not every string (structure-label wording is review-class per spec §7):

```ts
import { describe, expect, it } from 'vitest';
import type { MarkResult } from '@/features/trading/model/mark';
import {
  FX_CALENDAR, FX_IRON_CONDOR, FX_LONG_CALL, FX_SHARES_LONG, FX_SHORT_VERTICAL, mkLeg, mkPosition,
} from './fixtures';
import { buildPositionView } from './view';

const mr = (mark: number | null, basis: MarkResult['basis'] = 'snapshot', frozen = false): MarkResult => ({ mark, basis, frozen });
const allMarks = (p: Parameters<typeof buildPositionView>[0]['position'], v: number) =>
  new Map(p.legs.map((l) => [l.id, mr(v)]));

describe('buildPositionView', () => {
  it('AC-22 — carries ONE net entry figure with a debit/credit basis derived from the SIGN', () => {
    const debit = buildPositionView({ position: FX_LONG_CALL, legMarks: allMarks(FX_LONG_CALL, 14), dte: 30 });
    expect(debit.net_entry_basis).toBe('net_debit');
    expect(debit.net_entry_cost).toBeGreaterThan(0);

    const credit = buildPositionView({ position: FX_SHORT_VERTICAL, legMarks: allMarks(FX_SHORT_VERTICAL, 5), dte: 30 });
    expect(credit.net_entry_basis).toBe('net_credit');
  });

  it('AC-39 — one unresolved leg withholds pl, pl_pct AND mark together', () => {
    const [a, b] = FX_SHORT_VERTICAL.legs;
    const v = buildPositionView({
      position: FX_SHORT_VERTICAL,
      legMarks: new Map([[a.id, mr(5)], [b.id, null]]),
      dte: 30,
    });
    expect(v.mark.net_mark).toBeNull();
    expect(v.pl_dollar).toBeNull();
    expect(v.pl_pct).toEqual({ kind: 'unavailable' });
    expect(v.unavailable).toBe(true);
  });

  it('the single-leg structure line is BYTE-IDENTICAL to the shipped descriptor', () => {
    const v = buildPositionView({ position: FX_LONG_CALL, legMarks: allMarks(FX_LONG_CALL, 14), dte: 30 });
    expect(v.structure_line).toBe('$400 Call');
  });

  it('AC-37 — an over-long strike list collapses in the STRING, first-and-last, with the leg count', () => {
    const v = buildPositionView({ position: FX_IRON_CONDOR, legMarks: allMarks(FX_IRON_CONDOR, 3), dte: 30 });
    expect(v.structure_line_collapsed).toMatch(/\$380…\$460/);
    expect(v.structure_line_collapsed).toContain('(4 legs)');
    expect(v.structure_line_collapsed).not.toContain('...');
  });

  it('a multi-expiry structure carries its expiries in the line and reports the NEAREST separately', () => {
    const v = buildPositionView({ position: FX_CALENDAR, legMarks: allMarks(FX_CALENDAR, 13), dte: 30 });
    expect(v.multi_expiration).toBe(true);
    expect(v.nearest_expiration).toBe('2026-08-21');
    expect(v.structure_line).toContain('→');
  });

  it('AC-33 — a shares position exposes null option facts so the cell can render `—`, never a fake value', () => {
    const v = buildPositionView({ position: FX_SHARES_LONG, legMarks: new Map(), dte: null });
    expect(v.structure).toBe('shares_long');
    expect(v.legs[0].instrument_kind).toBe('equity');
    expect(v.legs[0].size_text).toBe('100 sh');
    expect(v.multi_expiration).toBe(false);
    expect(v.nearest_expiration).toBeNull();
  });

  it('leg rows carry the side as a WORD and each leg`s own mark + basis', () => {
    const [a, b] = FX_SHORT_VERTICAL.legs;
    const v = buildPositionView({
      position: FX_SHORT_VERTICAL,
      legMarks: new Map([[a.id, mr(11, 'snapshot')], [b.id, mr(5, 'theoretical')]]),
      dte: 30,
    });
    expect(v.legs.map((l) => l.side_word)).toEqual(['Short', 'Long']);
    expect(v.legs[1].basis).toBe('theoretical');
    expect(v.legs.map((l) => l.side_word)).not.toContain('+');
  });

  it('an unresolved leg row is flagged individually while resolved rows keep their marks', () => {
    const [a, b] = FX_SHORT_VERTICAL.legs;
    const v = buildPositionView({ position: FX_SHORT_VERTICAL, legMarks: new Map([[a.id, mr(11)], [b.id, null]]), dte: 30 });
    expect(v.legs[0].unavailable).toBe(false);
    expect(v.legs[0].mark).toBe(11);
    expect(v.legs[1].unavailable).toBe(true);
    expect(v.legs[1].mark).toBeNull();
  });

  it('AC-32 — a record that can never be priced is flagged `unpriceable`, separately from `unavailable`', () => {
    const broken = mkPosition([mkLeg({ strike: null, right: null })]);
    const v = buildPositionView({ position: broken, legMarks: new Map(), dte: null });
    expect(v.unpriceable).toBe(true);
    expect(v.unavailable).toBe(true);
    expect(v.structure).toBe('custom');
  });

  it('NEVER emits undefined, null or NaN where a rendered string is expected', () => {
    const v = buildPositionView({ position: FX_IRON_CONDOR, legMarks: new Map(), dte: null });
    for (const s of [v.structure_label, v.structure_line, v.structure_line_collapsed]) {
      expect(typeof s).toBe('string');
      expect(s).not.toMatch(/undefined|null|NaN/);
    }
  });

  it('is a PURE projection — building it twice from the same inputs yields deep-equal output', () => {
    const a = buildPositionView({ position: FX_IRON_CONDOR, legMarks: allMarks(FX_IRON_CONDOR, 3), dte: 30 });
    const b = buildPositionView({ position: FX_IRON_CONDOR, legMarks: allMarks(FX_IRON_CONDOR, 3), dte: 30 });
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/view.spec.ts`
Expected: FAIL — `Failed to resolve import "./view"`.

- [ ] **Step 3: Write the implementation**

Create `apps/dashboard/src/app/features/trading/positions/view.ts` with this exact `PositionView`:

```ts
/**
 * `PositionView` — a per-cycle DERIVED, NEVER-PERSISTED projection (the existing DerivedRow /
 * OrderEvalState precedent).
 *
 * Presentational components consume a PositionView and NEVER import the store, NEVER call the
 * recogniser, and NEVER perform leg arithmetic or leg formatting. If a component needs a number
 * that is not on this projection, that is a change to THIS FILE, not a component reaching past the
 * boundary. That boundary is what lets the same components serve sim-now and broker-later without a
 * fork — and it is the seam `BrokerPosition` plugs into later without touching a durable key.
 */
export interface PositionView {
  position: SimPosition;
  structure: StructureKind;
  structure_label: string;
  /** Pre-formatted, single line, never wrapping. */
  structure_line: string;
  /** The first-and-last collapsed variant — AUTHORED IN THE STRING, never a CSS ellipsis. */
  structure_line_collapsed: string;
  /** The full strike list, for the tooltip. */
  structure_line_full: string;
  net_entry_cost: number;
  net_entry_basis: 'net_debit' | 'net_credit';
  mark: PositionMark;
  pl_dollar: number | null;
  pl_pct: PlPctState;
  max_loss: MaxLossResult;
  legs: LegDisplayRow[];
  eval_subject: EvalSubject;
  /** Structure-level qty text — `2 ×` for options, `100 sh` for equity, `1 ×` for a covered call. */
  qty_text: string;
  unavailable: boolean;
  frozen: boolean;
  /** True when the saved record can NEVER be priced (a missing strike/right), not just this cycle. */
  unpriceable: boolean;
  dte: number | null;
  nearest_expiration: string | null;
  multi_expiration: boolean;
}
```

`buildPositionView` composes, in order: `structureKindOf` → `STRUCTURE_LABELS` → `composePositionMark` → `positionPl` → `netEntryCost` → `plPctStateOf` → `maxLossOf` → `evalSubjectOf` → the leg display rows → the structure line.

Structure-line authoring, per spec §4's table — implement one small pure helper per case and dispatch on `StructureKind`:

| Structure | `structure_line` |
|---|---|
| single-leg option | `` `$${strike} ${Right}` `` — **byte-identical to shipped**; verify against `PositionRow.tsx:97-118` before changing anything |
| vertical | `` `$${lo}/$${hi} ${Right} vertical` `` |
| calendar / diagonal | `` `$${strike} ${Right} ${kindWord} · ${nearMon} → ${farMon}` `` |
| iron condor / butterfly | `` `$${s1}/$${s2}/$${s3}/$${s4} condor` `` (butterfly reads `butterfly`) |
| covered call | `` `${shares} sh + $${strike} ${Right}` `` |
| shares only | `` `${qty} shares` `` |
| unrecognised | `` `${n} legs` `` |

`structure_line_collapsed`: when the line lists more than `STRUCTURE_LINE_MAX_STRIKES` strikes, emit `` `$${first}…$${last} ${noun} (${n} legs)` `` using the **U+2026 HORIZONTAL ELLIPSIS character**, never three periods and never a CSS ellipsis mid-number. `structure_line_full` always carries the complete list for the tooltip and the disclosure.

`unpriceable`: true when **any** option leg has a `null` `strike`, `right` or `expiration` — the fact was never recorded, so no future cycle can fix it. This is what selects `UNPRICEABLE_RECORD_TIP` over `ROW_UNAVAILABLE_TIP` at render time (AC-32).

`qty_text`: options ⇒ `` `${qty} ×` ``; equity-only ⇒ `` `${qty} sh` ``; mixed ⇒ the **structure-level** unit `` `${n} ×` `` (spec §4 *Qty, unit-aware*).

- [ ] **Step 4: Run the tests**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/view.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx nx test @org/dashboard
git add apps/dashboard/src/app/features/trading/positions/view.ts apps/dashboard/src/app/features/trading/positions/view.spec.ts
git commit -m "feat(positions): add the PositionView projection — the components' only source of truth

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task F9: Copy, the `max_loss` column, and the structure axis

Spec §4 *Copy — exact strings*, §4 *The risk slot* (the column, specified against the shipped machinery), §4 Flows 5. AC-27, AC-34, AC-82.

Copy is **review-class** (spec §7) — this task's automated budget goes on the *structural* facts: the label map is the key universe, the partition has no gap and no duplicate, and no saved view is rewritten.

**Files:**
- Modify: `apps/dashboard/src/app/features/trading/positions/labels.ts`
- Modify: `apps/dashboard/src/app/features/trading/positions/defaults.ts:11-122`
- Modify: `apps/dashboard/src/app/features/trading/positions/types.ts:79-137` (`GroupAxis`, `SortKey`, `ColumnKey`, `FilterState`)
- Test: `apps/dashboard/src/app/features/trading/positions/defaults.spec.ts`

**Interfaces:**
- Consumes: `StructureKind` from `./structure`, `MaxLossWithheldReason` from `./maxLoss`.
- Produces, relied on by F11–F16:
  - `ColumnKey` gains `'max_loss'` and renames `'strategy'` → `'structure'`
  - `GroupAxis = 'none' | 'ticker' | 'structure'` · `SortKey` renames `'strategy'` → `'structure'`
  - `FilterState.structure: StructureKind | null` (was `strategy: Strategy | null`)
  - `normalizeViewConfig(raw: unknown): { config: ViewConfig; adjusted: boolean; staleFilterValue: string | null }` in `defaults.ts`
  - Every copy constant listed in spec §4, plus `MAX_LOSS_WITHHELD_META`

- [ ] **Step 1: Write the failing test**

Extend `apps/dashboard/src/app/features/trading/positions/defaults.spec.ts` (it already asserts *"the label map IS the key universe"* at lines 20-25 — keep those assertions, they now cover the new key for free):

```ts
describe('the max_loss column (AC-82, Q6 ruling)', () => {
  it('is labelled — the label map is the key universe, so an unlabelled key fails the build', () => {
    expect(COLUMN_LABELS.max_loss).toBe('Max loss');
  });

  it('is in DEFAULT_COLUMNS and NOT in OPTIONAL_COLUMNS — the partition has no duplicate', () => {
    expect(DEFAULT_COLUMNS).toContain('max_loss');
    expect(OPTIONAL_COLUMNS).not.toContain('max_loss');
  });

  it('sits between trend and expiry, matching the left-to-right scan order', () => {
    const i = DEFAULT_COLUMNS.indexOf('max_loss');
    expect(DEFAULT_COLUMNS[i - 1]).toBe('trend');
    expect(DEFAULT_COLUMNS[i + 1]).toBe('expiry');
  });

  it('has no TABLE_HEADER_LABELS override — the header copy and the menu copy are the same two words', () => {
    expect(TABLE_HEADER_LABELS.max_loss).toBeUndefined();
  });
});

describe('the structure axis replaces the strategy axis', () => {
  it('renames the column, sort and group keys', () => {
    expect(COLUMN_LABELS.structure).toBe('Structure');
    expect(COLUMN_LABELS).not.toHaveProperty('strategy');
    expect(defaultConfig().filter).toHaveProperty('structure');
  });

  it('AC-34 — the entry column header reads Net entry and the word Cost is gone', () => {
    expect(TABLE_HEADER_LABELS.entry).toBe('Net entry');
    expect(Object.values(COLUMN_LABELS).join(' ')).not.toMatch(/\bCost\b/);
  });
});

describe('normalizeViewConfig — read-time only, NEVER a write (AC-53, AC-54, AC-82)', () => {
  it('AC-53 — a view that grouped by strategy still groups, with long calls still together', () => {
    const { config, adjusted } = normalizeViewConfig({
      ...defaultConfig(),
      group: 'strategy',
      filter: { ticker: null, status: ['open'], strategy: 'long_call', expiry: null },
    });
    expect(config.group).toBe('structure');
    expect(config.filter.structure).toBe('long_call');
    expect(adjusted).toBe(false);
  });

  it('AC-54 — a filter on a value that no longer exists degrades to no filter and is FLAGGED', () => {
    const { config, adjusted, staleFilterValue } = normalizeViewConfig({
      ...defaultConfig(),
      filter: { ticker: null, status: ['open'], strategy: 'long_butterfly', expiry: null },
    });
    expect(config.filter.structure).toBeNull();
    expect(adjusted).toBe(true);
    expect(staleFilterValue).toBe('long_butterfly');
  });

  it('drops the retired `expiry` group axis to `none` rather than throwing (ruling #10)', () => {
    expect(normalizeViewConfig({ ...defaultConfig(), group: 'expiry' }).config.group).toBe('none');
  });

  it('never mutates its input', () => {
    const raw = { ...defaultConfig(), group: 'strategy' };
    const snapshot = JSON.stringify(raw);
    normalizeViewConfig(raw);
    expect(JSON.stringify(raw)).toBe(snapshot);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/defaults.spec.ts`
Expected: FAIL — `COLUMN_LABELS.max_loss` is `undefined`, `normalizeViewConfig` is not exported.

- [ ] **Step 3: Wire the column and the axis**

In `types.ts`: rename the `ColumnKey` member `'strategy'` → `'structure'`, add `'max_loss'`; rename the `SortKey` member `'strategy'` → `'structure'`; `GroupAxis = 'none' | 'ticker' | 'structure'` (**`expiry` does not return** — ruling #10, and the `expiry` axis stays reachable in `derive.ts` so restoring it later costs zero schema); `FilterState.strategy: Strategy | null` becomes `structure: StructureKind | null`. Delete `Strategy` and `strategyOf` (lines 69-73).

In `defaults.ts`:
- `DEFAULT_COLUMNS`: replace `'strategy'` with `'structure'`, insert `'max_loss'` between `'trend'` and `'expiry'`.
- `COLUMN_LABELS`: `structure: 'Structure'`, `max_loss: 'Max loss'`, `entry: 'Net entry'`.
- `TABLE_HEADER_LABELS`: `entry: 'Net entry'` (keep `delta_entry: 'Δ entry'`). **No `max_loss` override.**
- `defaultConfig().filter`: `{ ticker: null, status: ['open'], structure: null, expiry: null }`.
- Add `normalizeViewConfig`, pure, read-time only, with this comment:

```ts
/**
 * Read-time normalization of a stored ViewConfig. This function NEVER writes and its caller must
 * never write on its behalf: reading a view never mutates it (AC-54), and AC-82 asserts against
 * STORAGE that no pre-existing saved view is rewritten by this release. A view whose filter names a
 * structure that no longer exists OPENS, shows rows, never throws, and is visibly flagged
 * `adjusted` — the store is written only when the user chooses to save.
 */
```

It maps legacy `group: 'strategy'` → `'structure'`, legacy `group: 'expiry'` → `'none'`, legacy `filter.strategy` → `filter.structure` when the value is a member of `STRUCTURE_KINDS` (`'long_call'` and `'long_put'` are members, so AC-53 holds by identity), and otherwise nulls the filter and reports `adjusted: true` with the original value in `staleFilterValue`. It also normalizes a stored `columns` array containing `'strategy'` to `'structure'` **in memory only**, so `configEqual` does not report a phantom unsaved change.

- [ ] **Step 4: Add the copy constants to `labels.ts`**

Add, **verbatim from spec §4** (do not paraphrase, do not re-wrap the sentences differently — this is the review-class surface):
`NET_ENTRY_TIP` · `STRUCTURE_TIP` · `LEGS_TIP` · `SHORT_LEG_TIP` · `NOT_RECORDED_TIP` · `NO_BASIS_LABEL` · `NO_BASIS_TIP` · `UNPRICEABLE_RECORD_TIP` · `WRITE_REFUSED_TIP` · `EMPTY_FAULTED` · `TR_ARCHIVE_PARTIAL_NOTE` · `MAX_LOSS_LABEL` · `MAX_LOSS_ASSUMPTION` · `MAX_LOSS_TIP` · `MERGE_NOTICE` · `MERGE_NOTICE_EXPORT` · `staleViewNotice(viewName: string)` · `FAULTED_BANNER_*` (heading, body, actions, closing line) · `TICKER_FAULTED_NOTICE`.

**Rewrite** `PL_TIP` (line 43-44) — the shipped string hardcodes the ×100 claim this feature exists to fix. Use the §4 replacement verbatim.

`MAX_LOSS_TIP` **composes** `MAX_LOSS_ASSUMPTION` — its tail *is* that constant, so write it as a template that interpolates the constant rather than retyping the sentence. Retyping it lets the tooltip and the disclosure line drift.

`MAX_LOSS_WITHHELD_META` goes here too, beside `ENTRY_BASIS_META`, as an **exhaustive** `Record<MaxLossWithheldReason, { label: string; tip: string }>` — exactly three members (`unbounded` → `unlimited risk`, `multi_expiration` → `mixed expiries`, `unnamed_shape` → `unnamed shape`) with the §4 tips verbatim. Exhaustiveness means a new reason **fails the build instead of vanishing**.

`staleViewNotice` takes **typographic quotes** around the view name (the shipped `trCoveragePartial` precedent), not straight quotes.

- [ ] **Step 5: Run the tests and fix the fallout**

Run: `npx nx test @org/dashboard`

The `Strategy` deletion will break `derive.ts`, `usePortfolio.ts`, `PositionRow.tsx`, `PositionCard.tsx`, `CustomizationToolbar.tsx` and their specs. **Fix compile errors only** — swap `strategyOf(p)` for `structureKindOf(p)` and `strategyLabel(s)` for `STRUCTURE_LABELS[s]` at each site, and change `GROUP_AXES` (`CustomizationToolbar.tsx:43-47`) to `[{ key: 'none', label: 'None' }, { key: 'ticker', label: 'Ticker' }, { key: 'structure', label: 'Structure' }]`. Do **not** start the render redesign here; that is F11.

Expected: back to ≥ 645 passing.

- [ ] **Step 6: Prove no saved view was rewritten**

Add to `defaults.spec.ts`:

```ts
it('AC-82 — normalization is in-memory: a stored blob is byte-identical after a read', () => {
  const blob = JSON.stringify({ group: 'strategy', columns: ['contract', 'strategy'] });
  localStorage.setItem('probe', blob);
  normalizeViewConfig(JSON.parse(localStorage.getItem('probe')!));
  expect(localStorage.getItem('probe')).toBe(blob);
});
```

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/app/features/trading/positions/
git commit -m "feat(positions): retire Cost, add the max_loss column, rename the strategy axis to structure

The max_loss ColumnKey knowingly amends the REVISION-2 (2026-06-29) fixed-Figma
column decision, per the 2026-07-28 Q6 ruling. ONE column, not the return of
column-customization — the picker stays unbuilt.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task F10: `usePortfolio` emits `views` — the render path moves before the store does

Spec §2.5 (resolver fan-out), §2.7. AC-38, AC-39, AC-40, AC-42, AC-43.

**This is the sequencing hinge.** The hook starts producing `PositionView[]` while the store is still the proven v2 store: legacy `Position` records are lifted **in memory** through the *same* `liftLegacyRecord` the real migration uses, so the whole render path gets exercised against the new shape before a single byte is written in it. Nothing durable changes in this task. `rows: DerivedRow[]` stays alongside `views` and is deleted in F18.

**Files:**
- Modify: `apps/dashboard/src/app/features/trading/positions/usePortfolio.ts`
- Test: `apps/dashboard/src/app/features/trading/positions/usePortfolio.views.spec.tsx` (new)

**Interfaces:**
- Consumes: `liftLegacyRecord` (F7), `buildPositionView` (F8), `legContractKey`/`compositeLimitWouldFill` (F5), `computeMark` from `model/mark` (unchanged).
- Produces, relied on by F11–F16, F18:
  - `usePortfolio(...)` return gains `views: PositionView[]` and `health: StoreHealth`
  - `interface StoreHealth { faulted: boolean; unread_sources: string[] }` — declare it in `positions/types.ts` now so F16 and F18 share one definition

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/app/features/trading/positions/usePortfolio.views.spec.tsx`. Render the hook through a probe component, mock **only** the network boundary (`fetchTrackedContract` via `vi.mock('@org/api', …)` following the pattern already used in `positions.risk.spec.tsx`), and assert:

```ts
it('emits one PositionView per position, with the structure derived from the legs', …)
it('fans out the contract lookup per LEG, de-duplicated by (ticker, expiration, strike, right) across the WHOLE portfolio', …)
  // two positions sharing a contract => ONE fetch for that contract
it('never issues a contract lookup for an equity leg', …)
it('AC-40 — a withheld row is excluded from the subtotal AND counted, never summed as zero', …)
it('AC-38 — an SSE drop leaves a last-known number present, dimmed, never blanked', …)
it('one leg`s 404 marks only the legs referencing that contract; every other row keeps rendering', …)
it('exposes health.faulted from the store synchronously on the first render', …)
```

For the de-duplication assertion, seed two positions on `TSLA 2026-08-21 $440 call` (a condor leg and a covered call's short call) and assert `fetchTrackedContract` was called **once** with that triple.

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/usePortfolio.views.spec.tsx`
Expected: FAIL — `pf.views` is `undefined`.

- [ ] **Step 3: Implement**

In `usePortfolio.ts`:

1. Derive `simPositions` from the v2 `positions` state:

```ts
// TRANSITIONAL (removed in the cutover): legacy v2 records are lifted IN MEMORY through the SAME
// lift the real migration uses, so the whole render path is exercised against the new shape before
// a single byte is written in it. Nothing durable changes here.
const simPositions = useMemo(
  () => positions.map((p) => liftLegacyRecord(p)).filter((p): p is SimPosition => p != null),
  [positions],
);
```

2. Replace the per-row fetch effect (lines 111-134) with a **per-contract** effect keyed on the sorted distinct `legContractKey` values across every `open`/`pending` position:

```ts
const contractKeys = useMemo(() => {
  const keys = new Map<string, { ticker: string; expiration: string; strike: number; right: OptionRight }>();
  for (const p of simPositions) {
    if (p.status !== 'open' && p.status !== 'pending') continue;
    for (const l of p.legs) {
      const key = legContractKey(l);
      if (key && !keys.has(key)) {
        keys.set(key, { ticker: l.ticker, expiration: l.expiration!, strike: l.strike!, right: l.right! });
      }
    }
  }
  return keys;
}, [simPositions]);
```

The effect fetches each distinct key **once**, storing results in `contractLive: Record<string, { tracked; unavailable }>`. **Per-contract isolation is preserved: one contract's 404 marks only the legs referencing it and every other row keeps rendering.** Resolution is per-leg at the fetch layer even though display is all-or-nothing, so a row can render while its slowest leg is still in flight rather than blocking the table.

3. `legMarksFor(p)` builds a `Map<LegId, MarkResult | null>`:
   - **Equity leg:** bypasses the ladder entirely — its mark is the live underlying mid (`live?.mid`), or the bundle `price` (`m.price`) when not live; `basis` mirrors the underlying's liveness; it **never** issues a contract lookup. This branch lives here in the resolver, **not** inside `computeMark`.
   - **Option leg:** `computeMark({ tracked, strike: l.strike!, right: l.right!, anchorSpot: m.price, liveUnderlying: live?.mid ?? null, isLive, marketSession: session, streamOffline, lastMark: lastMarkRef.current.get(l.id) ?? null })` — note `lastMarkRef` is now keyed by **`LegId`**, not `PositionId`.
   - A leg whose contract key is `null` (a malformed record) resolves to `null`.

4. `views = useMemo(() => simPositions.map((p) => buildPositionView({ position: p, legMarks: legMarksFor(p), dte: dteFor(p) })), […])`.

5. Replace the resting-limit effect's `limitWouldFill(liveMark, p.limit_price, true)` with `compositeLimitWouldFill(legMarksFor(p), p, p.limit_price)`.

6. Add `health: { faulted: positionsFaulted(), unread_sources: [] }` to the return object, computed **synchronously** on every render (localStorage is synchronous, so this is free, and it guarantees no frame ever paints enabled affordances on a faulted store).

Leave `rows`, `markFor` and every mutator exactly as they are — they still serve the un-migrated components until F18.

- [ ] **Step 4: Run the tests**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/usePortfolio.views.spec.tsx`
Expected: PASS.

Run: `npx nx test @org/dashboard`
Expected: ≥ 645 passing. The existing `positions.risk.spec.tsx` flow must be untouched — if the resting-limit or SSE-drop cases now fail, the composite fill rule or the equity branch is wrong, not the test.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/app/features/trading/positions/usePortfolio.ts apps/dashboard/src/app/features/trading/positions/usePortfolio.views.spec.tsx apps/dashboard/src/app/features/trading/positions/types.ts
git commit -m "feat(positions): usePortfolio emits PositionViews over a de-duplicated per-leg fan-out

Transitional: v2 records are lifted in memory through the real migration's lift,
so the render path is proven on the new shape before anything writes in it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task F11: `PositionRow` on `PositionView`, and the `max_loss` column

Spec §4 *The `contract` cell*, *The risk slot*, *Component states*, *The four not-a-number literals*, *Design direction*. AC-1, AC-22, AC-23, AC-26, AC-28, AC-29, AC-31, AC-32, AC-33, AC-34, AC-41, AC-42, AC-78, AC-82.

**⚠ CARRY THE GATE Z BOUNCE.** This is the task that adds `max_loss` to the table. Re-read the Global Constraints escalation instruction before you start laying the column out. If it cannot fit at both densities and every breakpoint above `md` within the stated limits, **stop and bounce to the conductor** — this is not a judgement call you get to make.

**Files:**
- Modify: `apps/dashboard/src/app/features/trading/positions/PositionRow.tsx` (`RowContext:62-72`, `cellContent:78-394`, `PositionRow:472-537`)
- Modify: `apps/dashboard/src/app/features/trading/positions/PositionsView.tsx:31-42` (`FIGMA_COLUMNS`), `:152-162` (`ctxFor`), `:207-253` (`TableLayout`)
- Modify: `apps/dashboard/src/app/features/trading/positions/PositionsPanel.tsx:86-101` (feed `views`)
- Test: `apps/dashboard/src/app/features/trading/positions/positions.risk.spec.tsx` (extend)

**Interfaces:**
- Consumes: `PositionView` (F8), the copy constants and `MAX_LOSS_WITHHELD_META` (F9), `pf.views` (F10).
- Produces: `RowContext` gains `view: PositionView` and **loses** `row: DerivedRow`; `cellContent(col: ColumnKey, ctx: RowContext)` gains a `'max_loss'` arm and a `'structure'` arm.

- [ ] **Step 1: Write the failing test**

Extend `positions.risk.spec.tsx` with a `describe('the four not-a-number literals (AC-31)')` block and a `describe('the risk slot (AC-28/29)')` block. Risk-based: assert the **distinctions**, not the wording.

```ts
it('renders four DISTINCT literals, each independently assertable, none for another`s meaning', async () => {
  // a shares row (—), an unresolvable-leg row (unavailable), a malformed record (not recorded),
  // and a zero-cost collar (no basis) rendered together in one table
  expect(screen.getByTestId('cell-unavailable')).toBeInTheDocument();
  expect(screen.getByTestId('cell-not-recorded')).toBeInTheDocument();
  expect(screen.getByTestId('cell-no-basis')).toBeInTheDocument();
  expect(screen.getByTestId('cell-no-basis').textContent).not.toBe(
    screen.getByTestId('cell-unavailable').textContent,
  );
});

it('AC-26 — the literal text undefined, null and NaN never appear in any cell', async () => {
  expect(screen.getByTestId('positions-table').textContent).not.toMatch(/undefined|null|NaN/);
});

it('AC-31 — `no basis` is a CELL-level state: the dollar P/L beside it still renders a real figure', async () => {
  const row = screen.getByTestId('position-row');
  expect(within(row).getByTestId('cell-no-basis')).toBeInTheDocument();
  expect(within(row).getByTestId('cell-pl').textContent).toMatch(/[+−]\$\d/);
});

it('AC-28 — the risk slot renders an UNSIGNED figure, never +$ or −$', async () => {
  expect(screen.getByTestId('cell-max-loss').textContent).toMatch(/^\$\d/);
  expect(screen.getByTestId('cell-max-loss').textContent).not.toMatch(/^[+−]/);
});

it('AC-29 — an ineligible structure renders a reason, never a bare —, never 0, never a number', async () => {
  const cell = screen.getByTestId('cell-max-loss');
  expect(cell.textContent).toBe('unlimited risk');
  expect(cell.textContent).not.toMatch(/\d/);
  expect(cell.textContent).not.toBe('—');
});

it('AC-29 — `unlimited risk` and `unnamed shape` stay distinguishable, never clipped to a shared prefix', async () => {
  const texts = screen.getAllByTestId('cell-max-loss').map((n) => n.textContent);
  expect(new Set(texts).size).toBe(texts.length);
  for (const t of texts) expect(t).not.toMatch(/…|\.\.\./);
});

it('AC-42/AC-29 — the risk slot NEVER dims: it is static, not live-derived', async () => {
  // assert className identity between the max_loss cell offline and online
});

it('AC-82 — no saved view is rewritten in storage by rendering the new column', async () => {
  const before = localStorage.getItem(PORTFOLIO_V2_KEY);
  // render, group, sort, switch views
  expect(localStorage.getItem(PORTFOLIO_V2_KEY)).toBe(before);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/positions.risk.spec.tsx`
Expected: FAIL — `cell-max-loss`, `cell-not-recorded` and `cell-no-basis` do not exist.

- [ ] **Step 3: Move `RowContext` onto the projection**

```ts
export interface RowContext {
  view: PositionView;
  trend: PlSample[];
  streamOffline: boolean;
  onClose: (id: string) => void;
  onCancel: (id: string) => void;
  onViewOrder?: (orderId: string) => void;
}
```

`markRes` leaves `RowContext` entirely — `ctx.view.mark` is a `PositionMark` and carries strictly more. Update `PositionsView.ctxFor` (`:152-162`) and drop the `markResFor` prop from `ViewProps`; `PositionsPanel` feeds `pf.views` instead of building `markResFor`.

- [ ] **Step 4: Rewrite the affected `cellContent` arms**

- `'contract'` (`:97`): the ticker stays **bold mono**, the descriptor stays `text.secondary` at `0.8rem`. Render `ctx.view.structure_line_collapsed`, with `title={ctx.view.structure_line_full}`. **Multi-leg must not promote the descriptor.** Keep `whiteSpace: nowrap`; never more than one line, never wrapping.
- `'structure'` (the renamed `'strategy'` arm at `:368`): the outlined neutral chip — `divider` border, `text.secondary` ink, **no colour**, not amber. `STRUCTURE_LABELS[ctx.view.structure]`, tip `STRUCTURE_TIP`. `Custom` renders in the **same neutral visual register as every other name** — no error styling, no alert colour, no icon.
- `'entry'` (`:325`): `` `${money(|net|)} ${basis === 'net_debit' ? 'debit' : 'credit'}` ``, tip `NET_ENTRY_TIP`. The qualifier is derived from the **sign**, never from the structure name — a vertical can be either. No abbreviation (`Dr`/`Cr`/`db`).
- `'pl'` (`:190`): `ctx.view.pl_dollar`; `null` ⇒ `cell-unavailable` with `ROW_UNAVAILABLE_TIP`, or `UNPRICEABLE_RECORD_TIP` when `ctx.view.unpriceable`.
- `'pl_pct'` (`:232`): switch on `ctx.view.pl_pct.kind` — `value` ⇒ the bare number with a row tip naming **that row's** basis; `no_basis` ⇒ `NO_BASIS_LABEL` under `data-testid="cell-no-basis"` with `NO_BASIS_TIP`; `unavailable` ⇒ `cell-unavailable`; `not_applicable` ⇒ `—` with `PENDING_PL_TIP`.
- `'mark'` (`:143`): `ctx.view.mark`. Basis chip shows the **weakest** basis; when `resolved_legs < total_legs` use the partial-mark tip naming *N of M legs*; when the bases differ, append the weakest-basis tip.
- `'strike'` / `'right'` / `'expiry'` / `'dte'` (`:353-380`): three-way. Not applicable to the instrument ⇒ `—`; the fact was never recorded ⇒ `not recorded` under `data-testid="cell-not-recorded"` with `NOT_RECORDED_TIP`; multi-leg ⇒ `—` with the *"Multiple legs — expand the position to see each strike"* tip. `—` keeps its shipped treatment and stays untestidded.
- `'qty'` (`:347`): `ctx.view.qty_text` with the unit-aware tip.
- **New `'max_loss'` arm:** right-aligned mono `tabular-nums`, **untinted**, `data-testid="cell-max-loss"`. `figure` ⇒ the unsigned `$N`, tip `MAX_LOSS_TIP`. `withheld` ⇒ `MAX_LOSS_WITHHELD_META[reason].label`, tip `MAX_LOSS_WITHHELD_META[reason].tip`. Never both, never blank, never `0`, never a bare `—`, never the word `Unlimited` standing alone.

All four literals share **identical treatment** — MUI `variant="body2"`, `color: 'text.disabled'`, the same `Tooltip arrow` — and differ **by text and testid only**.

- [ ] **Step 5: Add the column to the table**

`PositionsView.tsx:31-42` — insert `'max_loss'` into `FIGMA_COLUMNS` between `'trend'` and `'expiry'`, and rename `'strategy'` to `'structure'`. `FIGMA_COLUMNS` must keep mirroring `DEFAULT_COLUMNS` exactly; add an assertion to `defaults.spec.ts` that the two arrays are deep-equal so they cannot drift again.

- [ ] **Step 6: Verify the fit — this is the GATE Z checkpoint**

```bash
npx nx serve dashboard
```

At `md`, `lg` and `xl`, in **both** `comfortable` and `compact` density, confirm: no horizontal scroll on desktop; no other column shrunk below its design width; `unlimited risk` and `unnamed shape` both fully legible and distinguishable at a glance; no text below 11px. Capture a screenshot of each density for the review record.

**If any of those fails: STOP. Do not squeeze. Do not shorten the labels. Do not re-lay-out the table. Raise a GATE Z bounce to the conductor with the screenshots and the specific constraint that could not be met.**

- [ ] **Step 7: Run the tests and commit**

```bash
npx nx test @org/dashboard
git add apps/dashboard/src/app/features/trading/positions/
git commit -m "feat(positions): render rows from PositionView; add the Max loss column and the four literals

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task F12: The leg disclosure

Spec §4 *The leg disclosure*, *Design direction* ¶2 and ¶3 (the signature). AC-12, AC-35, AC-36, AC-37, AC-79, AC-80.

**The signature of this feature is the leg block's left rule** — a 1px `divider` vertical rule indenting the legs beneath their parent position, so a spread reads as *one object with parts* rather than four loose rows. It is the only new visual idea and it costs zero colour. **Deliberately not an arc** — the arc is set-pinned to exactly three places and a fourth use is a violation.

**Motion: none added.** The disclosure is instant — **no keyframe, no accordion** (the single-motion-moment set-equality guard).

**Files:**
- Create: `apps/dashboard/src/app/features/trading/positions/LegDisclosure.tsx`
- Modify: `PositionRow.tsx` (the `'contract'` cell gains the `⌄` control; `PositionRow` renders the sibling `<tr colSpan>`)
- Test: `apps/dashboard/src/app/features/trading/positions/legDisclosure.spec.tsx` (new)

**Interfaces:**
- Consumes: `PositionView.legs`, `PositionView.max_loss`, `MAX_LOSS_ASSUMPTION`, `MAX_LOSS_WITHHELD_META`, `LEGS_TIP`, `SHORT_LEG_TIP`.
- Produces: `<LegDisclosure view={…} expanded={…} id={…} />`; `PositionRow` owns the ephemeral `expanded` state.

- [ ] **Step 1: Write the failing test**

```ts
it('AC-35 — appears ONLY when a position has more than one leg', …)
it('AC-35 — shows one line per leg with side as a WORD, size, instrument, and that leg`s own mark + basis', …)
it('renders `Long`/`Short` as words, never + or −, and never coloured', …)
it('AC-12 — legs carry NO actions: no per-leg Close, no per-leg Cancel, no button inside a leg line', …)
it('carries no per-leg P/L column — it would invite the partial-sum reading the all-or-nothing rule bans', …)
it('AC-79 — the control is a <button> with aria-expanded and aria-controls pointing at the panel', …)
it('AC-79 — keyboard-operable: Enter and Space toggle it, and it has a visible authored :focus-visible ring', …)
it('AC-36 — state is EPHEMERAL: expanding writes nothing to the store and is absent from the saved view config', …)
it('renders the max-loss assumption sentence when a figure exists, and the reason`s tip when one does not', …)
it('is instant — no CSS animation or transition property is applied to the expansion', …)
```

The ephemerality assertion must read `localStorage` before and after expanding and assert byte-identity, and assert `JSON.stringify(pf.working)` contains no expansion key.

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/legDisclosure.spec.tsx`
Expected: FAIL — `Failed to resolve import "./LegDisclosure"`.

- [ ] **Step 3: Implement**

The control lives at the **right edge of the `contract` cell**, present only when `view.legs.length > 1`. It is a real `<button aria-expanded={expanded} aria-controls={panelId}>` with a `⌄` glyph in `text.secondary` — **the disclosure chevron does not earn amber.** Hit target ≥ 44px on mobile.

The panel is a **sibling `<tr>` with `<td colSpan={columns.length + 1}>`** (a real table structure, per Design direction ¶2), containing one indented line per leg behind the 1px `divider` left rule. Leg text at `0.8rem` IBM Plex Mono `tabular-nums` — above the 11px floor. **Stat values are never headings** (the 29-`<h6>` ticker page is the documented failure).

Each leg line: `Long` / `Short` (word, `text.secondary`, untinted) · size · instrument · that leg's own mark + basis chip, or `unavailable` on its own line when that leg failed. On mobile the same rows stack vertically inside the card — **never a horizontal mini-table inside a 393px card**.

Below the leg lines: when `view.max_loss.kind === 'figure'`, render `MAX_LOSS_ASSUMPTION` as its own line; when `withheld`, render `MAX_LOSS_WITHHELD_META[reason].tip`. The disclosure is the designed home for per-position detail and has vertical room for a sentence.

State: `const [expanded, setExpanded] = useState(false)` inside `PositionRow`. **Never persisted, never in `ViewConfig`, gone after reload.**

- [ ] **Step 4: Run the tests and commit**

```bash
npx nx test @org/dashboard
git add apps/dashboard/src/app/features/trading/positions/
git commit -m "feat(positions): add the leg disclosure — instant, ephemeral, keyboard-operable, left-ruled

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task F13: `PositionCard` — the five-item footer and the risk slot

Spec §4 *The mobile card at 393px*, *Component states*. AC-30, AC-33, AC-34, AC-79.

**A card's COLLAPSED height is identical for a 1-leg and a 4-leg position** — leg count changes one label and nothing else. The footer carries **exactly five items**: `Qty` · `Net debit`/`Net credit` · `Mark` · expiry · **the risk slot**. The risk slot carries **either** the max-loss figure **or** its one stated reason, **never both, never three figures**.

**Files:**
- Modify: `apps/dashboard/src/app/features/trading/positions/PositionCard.tsx` (whole file — it currently hand-rolls markup off `DerivedRow`)
- Test: `apps/dashboard/src/app/features/trading/positions/positions.risk.spec.tsx` (extend the card block)

**Interfaces:**
- Consumes: `PositionView`, `RowContext` (F11), `LegDisclosure` (F12).
- Produces: `PositionCardProps { view: PositionView; ctx: RowContext; streamOffline: boolean; onClose: (id: string) => void }`.

- [ ] **Step 1: Write the failing test**

```ts
it('AC-30 — the collapsed card carries AT MOST ONE risk figure or reason, never three', …)
it('the footer has EXACTLY five items for both a 1-leg and a 4-leg position', …)
it('AC-30 — a 1-leg card and a 4-leg card have the same collapsed height', …)
it('AC-33 — a shares card reads `100 sh`, carries the Shares chip, and shows — for strike/expiry', …)
it('the structure line gets minWidth 0 + ellipsis while the chip never shrinks', …)
it('multi-expiry shows the NEAREST expiry with a `+1 more` suffix — never two dates in one slot', …)
it('AC-79 — the disclosure button is ≥44px and leg text is ≥11px', …)
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/positions.risk.spec.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the six slots**

1. **Header** — `TSLA` (mono 700, 1rem) + `view.structure_line_collapsed` (`text.secondary`, 0.85rem) · structure chip right-aligned. **The structure line gets `minWidth: 0` + `textOverflow: 'ellipsis'`; the chip never shrinks.** *A flex child without `minWidth: 0` is the classic 393px offender.*
2. **Live block** — big mono P/L + P/L% (left) · sparkline (right); dims to `0.5` + the offline treatment, unchanged from shipped.
3. **Footer** — exactly five items, `Entry` **relabelled** to `Net debit`/`Net credit`, not joined by a new item.
4. **Disclosure** — `4 legs ⌄`, full-width-left button, ≥44px hit target, `text.secondary`. Absent for a 1-leg position.
5. **Expansion** — one line per leg, **stacked vertically** (`Long · 1 × · $400 Call · Jul 18 · $12.40`).
6. **Actions** — Close / pending affordance / closed summary, unchanged.

Delete the local `strategyName` (`:56`) and use `STRUCTURE_LABELS[view.structure]`; delete the duplicated `rowActionSx` (`:29-39`) and import the one from `PositionRow`. Below `md` the table is already forced to cards (`PositionsView.tsx:97-98`) — **multi-leg does not move that breakpoint.**

- [ ] **Step 4: Run the tests and commit**

```bash
npx nx test @org/dashboard
git add apps/dashboard/src/app/features/trading/positions/PositionCard.tsx apps/dashboard/src/app/features/trading/positions/positions.risk.spec.tsx
git commit -m "feat(positions): rebuild the mobile card on PositionView with a five-item footer

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task V2: Tint-discipline / className-identity guard

**Sequence point: after F13.** Spec §4 *Call/put tint* and the table of banned tints; §7 invariant 6. AC-78.

This is a **`test`-class case that is invisible to review and regresses silently**: MUI `sx` compiles to classes, so the assertion is **className identity**, never `getAttribute('style')`.

The decisive argument, for the record: **a short call is bearish**, so tinting a position green because it contains a call tells the trader the opposite of the truth — the same error class as the off-exchange proximity chips rendering green on a no-side datum, but on the trader's own money.

**Files:**
- Create: `apps/dashboard/src/app/features/trading/positions/tint.spec.tsx`

- [ ] **Step 1: Write the test**

```ts
/**
 * Tint discipline (AC-78, ruling #18). `success.main`/`error.main` appear on this surface in
 * exactly FIVE places, all of them signed dollar direction: the `pl` cell, the `pl_pct` cell, the
 * group subtotal, the sparkline stroke, and the ClosedSummary realized figure.
 *
 * MUI `sx` compiles to classes, so these assert className IDENTITY — never getAttribute('style').
 */
it('a Short leg label and a Long leg label are className-identical', () => {
  const [long, short] = screen.getAllByTestId('leg-side');
  expect(short.className).toBe(long.className);
});

it('a credit entry cell and a debit entry cell are className-identical', () => {
  // two rows: FX_CALL_DEBIT_SPREAD and FX_SHORT_VERTICAL
  expect(creditCell.className).toBe(debitCell.className);
});

it('the structure chip is className-identical for Iron condor, Shares and Custom', () => { … });

it('the risk slot is className-identical for a figure and for a withheld reason', () => { … });

it('`Call` and `Put` in the leg list are className-identical', () => { … });

it('the four not-a-number literals and the offline tag are className-identical', () => { … });

it('the P/L cell IS tinted, and differently for a gain and a loss — the guard is not vacuous', () => {
  expect(gainCell.className).not.toBe(lossCell.className);
});
```

That last case is load-bearing: without it a bug that removes *all* tint would pass every other assertion.

- [ ] **Step 2: Run it**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/tint.spec.tsx`
Expected: PASS. A failure here means a tint leaked onto a non-directional datum — fix the component, never the assertion.

- [ ] **Step 3: Confirm the token discipline (AC-81)**

```bash
grep -rnE "#[0-9a-fA-F]{3,8}\b" apps/dashboard/src/app/features/trading/positions/
git diff HEAD --stat -- apps/dashboard/src/app/theme/
```
Expected: no hex matches in the feature's files; **zero** values added to `tokens.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/app/features/trading/positions/tint.spec.tsx
git commit -m "test(positions): guard tint discipline by className identity (AC-78)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task V3: 393px no-overflow, with a leg block expanded

**Sequence point: after V2.** Spec §7 invariant 11. AC-30.

**The shipped guard is not sufficient and the spec says why:** `apps/dashboard-e2e/src/e2e/mobile-no-overflow.cy.ts` visits `/positions` and asserts `scrollWidth` on the **cold render only**, so a 4-leg expansion could overflow with the guard staying green. **The case must expand a leg block before asserting.**

**Files:**
- Modify: `apps/dashboard-e2e/src/e2e/mobile-no-overflow.cy.ts`

- [ ] **Step 1: Extend the spec**

Seed a durable `convexa.positions.v2` blob (via `cy.window().then(w => w.localStorage.setItem(...))` before `cy.visit`) containing a 4-leg iron condor, in **both** colour schemes, at 393×852. Then:

```ts
cy.get('[data-testid="position-card"]').first().find('button[aria-expanded]').click();
cy.get('[aria-expanded="true"]').should('exist'); // the expansion actually happened
cy.document().then((doc) => {
  expect(doc.documentElement.scrollWidth).to.be.at.most(doc.defaultView!.innerWidth);
});
```

The `aria-expanded="true"` assertion is not decoration — without it a selector that silently stops matching turns the overflow check vacuous, which is the exact failure mode the extension exists to close.

- [ ] **Step 2: Run it**

Run: `npx nx e2e dashboard-e2e`
Expected: 15/15 + the new case. If the expansion overflows, fix the card (slot 5 stacks vertically; never a horizontal mini-table inside a 393px card) — never widen the assertion.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard-e2e/src/e2e/mobile-no-overflow.cy.ts
git commit -m "test(e2e): assert 393px no-overflow with a 4-leg disclosure EXPANDED, both schemes

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task F14: `derive.ts` on the structure axis, and the stale-view notice

Spec §4 Flows 5, *Banner region*, *Stale-saved-view notice*. AC-40, AC-53, AC-54.

**Reading a view never mutates it.** The store is **not** written until the user chooses to save — that is `loss-free-durable-migration` expressed at the UI layer, and it is why the notice says *"Save the view to keep it this way"* rather than *"We fixed your view."*

**Files:**
- Modify: `apps/dashboard/src/app/features/trading/positions/derive.ts` (whole file — it is typed on `DerivedRow`)
- Modify: `apps/dashboard/src/app/features/trading/positions/CustomizationToolbar.tsx:392-401` (the banner region)
- Test: `apps/dashboard/src/app/features/trading/positions/derive.spec.ts` (extend)

**Interfaces:**
- Consumes: `PositionView`, `STRUCTURE_ORDINAL`, `STRUCTURE_LABELS`, `normalizeViewConfig`, `staleViewNotice`.
- Produces: `DerivedGroup { key; label; views: PositionView[]; subtotal; excludedCount }`; `deriveGroups(views: PositionView[], opts)`.

- [ ] **Step 1: Write the failing test**

```ts
it('AC-40 — a withheld row is EXCLUDED from the subtotal and COUNTED, never summed as zero', …)
it('sorts by structure using the DECLARED COMPLEXITY ORDER, never alphabetically by label', …)
  // seed Shares / Long call / Iron condor / Custom and assert the emitted order is the ordinal order
it('AC-53 — grouping by structure keeps every long call in one group', …)
it('the group axis offers exactly None · Ticker · Structure — Expiry does not return', …)
it('the `expiry` axis remains reachable in derive.ts so restoring it costs zero schema', …)
it('AC-54 — a view with a stale filter OPENS, shows rows, never throws, and writes nothing', …)
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/derive.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`derive.ts`: replace `DerivedRow` with `PositionView` throughout. `applyFilter` filters on `view.structure` rather than `strategyOf`. `sortValue`'s `'structure'` case returns `STRUCTURE_ORDINAL[view.structure]` — **never** the label, so sorting is by declared complexity, not alphabet. `groupKeyAndLabel`'s `'structure'` case returns `{ key: view.structure, label: STRUCTURE_LABELS[view.structure] }`. **Keep the `'expiry'` case** — the axis stays in the model and in `derive.ts`; only the UI option is absent, so restoring it later costs zero schema and zero migration. `subtotalOf` reads `view.pl_dollar` and counts `null` as excluded, unchanged in behaviour.

`CustomizationToolbar.tsx`: replace the single `streamOffline` conditional at `:392-401` with the **banner region** in fixed priority, top to bottom:
1. `store-faulted` — non-dismissible (new; wired in F16)
2. live-offline — non-dismissible (shipped, unchanged, byte-identical copy)
3. **at most ONE** dismissible notice — the merge notice first if pending, otherwise the stale-saved-view notice; the second appears only after the first is dismissed.

The stale-view notice is **`info`-class** (`info.main` link colour, **no burnt orange, no warning icon** — nothing broke and no data was lost; dressing it as a warning would be dishonest in the other direction), one line, dismissible, `staleViewNotice(activeView.name)`.

Add the props `faulted?: boolean`, `mergeNoticePending?: boolean`, `staleViewName?: string | null`, `onDismissMerge?: () => void` to `ToolbarProps` (`:49-62`).

- [ ] **Step 4: Run the tests and commit**

```bash
npx nx test @org/dashboard
git add apps/dashboard/src/app/features/trading/positions/
git commit -m "feat(positions): derive on the structure axis; add the non-writing stale-view notice

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task V5: Ephemerality — no fetch, no store write on a read

**Sequence point: after F14.** Spec §7 invariant 9. AC-36, AC-80.

**Files:**
- Create: `apps/dashboard/src/app/features/trading/positions/readonly.spec.tsx`

- [ ] **Step 1: Write the test**

```ts
/**
 * AC-80: expanding, collapsing, grouping, sorting and switching views trigger NO fetch and NO
 * store write. The whole surface is a read; nothing on it can reach a real order path.
 */
it('expanding and collapsing a leg block issues zero fetches and leaves storage byte-identical', …)
it('grouping and sorting are a pure re-derivation — zero fetches, zero writes', …)
it('switching between existing saved views issues zero fetches', …)
it('AC-36 — the expansion state is absent from the persisted view config after a reload', …)
it('the portfolio never issues a bundle/scoring request', …)
```

Assert fetches by counting calls on the mocked `fetchTrackedContract` and the global `fetch` spy; assert writes by snapshotting **every** `convexa.*` key before and after and comparing byte-for-byte.

- [ ] **Step 2: Run it, then commit**

```bash
npx nx test @org/dashboard -- src/app/features/trading/positions/readonly.spec.tsx
git add apps/dashboard/src/app/features/trading/positions/readonly.spec.tsx
git commit -m "test(positions): reading is free of side effects — no fetch, no write (AC-80)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task F15: `TradeEntryDialog` — the SIM multi-leg variant

Spec §4 Flows 1, §2.7 *Entry input shape*, §4 *Copy* (the dialog rows). AC-4 through AC-13, AC-18, AC-22.

**`single-shared-sim-entry-dialog` is binding: multi-leg is a SIM *variant* of the ONE shared dialog, never a fork.** There is **no second entry dialog and no separate spread builder**. Leg rows are added and removed **inside the existing dialog** — no wizard, no step flow. **The single-leg path gains ZERO steps** and the confirm action's name is unchanged (`Open simulated position`) — an action's name never changes per case.

**Per-leg entry prices are typed; the net is computed and disclosed as computed.** The app never asks for a net and splits it across legs. There is **no back-solved, allocated or apportioned per-leg price anywhere in v1** — that would fabricate an instrument fact in the same audit spine where the lift refuses to backfill an invented `entry_time`, and the same lift is reused by the archive import, so a fabrication would silently rewrite imported backups too.

**Files:**
- Modify: `apps/dashboard/src/app/features/trading/TradeEntryDialog.tsx` (props `:184-203`, form state `:242-263`, derived costs `:332-338`, `canConfirm:360-370`, `handleConfirm:380-415`, the fill-preview block `:815-915`)
- Modify: `apps/dashboard/src/app/features/trading/positions/usePortfolio.ts` (`OpenPositionInput:51-66`, `openPosition:263-330`)
- Modify: `PortfolioPanel.tsx:68-83` (`handleConfirm`)
- Test: `apps/dashboard/src/app/features/trading/TradeEntryDialog.risk.spec.tsx` (extend), `shared-entry.flow.spec.tsx` (extend)

**Interfaces:**
- Produces:
  - `interface LegInput { kind: InstrumentKind; ticker: string; side: LegSide; qty: number; multiplier: number; price: number | null; expiration: string | null; strike: number | null; right: OptionRight | null }`
  - `OpenPositionInput { legs: LegInput[]; entryMode: EntryMode; limitPrice?: number; stop?: number | null; target?: number | null }` — **a single-leg entry is a one-element array, so there is exactly ONE open path.**

- [ ] **Step 1: Write the failing test**

```ts
it('AC-8 — multi-leg entry happens in the SAME dialog; there is no second dialog and no spread builder', …)
it('AC-7 — a plain single long option takes the same number of steps as it does today', …)
it('AC-11 — direction is a Buy/Sell control; NO form field accepts a negative quantity', …)
it('AC-9 — the trader enters a price PER LEG and no field anywhere asks for a net', …)
it('AC-10 — until every leg has a price the running net reads INCOMPLETE, never a partial sum', …)
it('AC-9 — the running net is labelled as COMPUTED from the leg prices', …)
it('AC-22 — a credit structure reads `Net credit`, a debit reads `Net debit`, derived from the sign', …)
it('AC-4 — a naked short is accepted and saved: one option leg, sold to open, no offsetting leg', …)
it('AC-5 — legs with different expirations are accepted and saved', …)
it('AC-6 — an unnamed leg set is accepted with NO error, NO warning styling, NO icon, NO blocked confirm, NO toast', …)
it('AC-13 — a 6-leg position is accepted with no cap enforced or messaged', …)
it('AC-18 — changing a leg so the shape changes updates the displayed name immediately, no reload', …)
it('multi-underlying is REJECTED at construction — a second ticker cannot be committed', …)
it('the confirm button label is unchanged in every case', …)
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx nx test @org/dashboard -- src/app/features/trading/TradeEntryDialog.risk.spec.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Replace the flat `expiration`/`strike`/`right`/`qty`/`manualPrice` state (`:244-251`) with `legs: LegDraft[]`, seeded to **one** row so the single-leg path is unchanged. Each leg row carries a Buy/Sell (Long/Short) `ToggleButtonGroup`, size, instrument fields and a per-leg price input with `min={1}` / `min={0}` — **no field accepts a negative quantity**; the sign lives in the Buy/Sell control and nowhere else.

Add/remove leg controls inside the existing `DialogContent`. When `legs.length === 1` the layout must be visually and interaction-identical to shipped.

The running net replaces `manualCost`/`marketCost`/`limitCost` (`:332-338`) with `netEntryCost` over the drafted legs. Until **every** leg has a price it reads **incomplete** — never a partial sum. The copy rows come verbatim from spec §4's table (`Opens at your price $8.40 · Net debit $840 — user-entered, not a market quote.` · `Net debit $840 · computed from your leg prices` · `Fill: mid $8.40 · Net debit $840 (mid × 100 × qty)` · `Fills at your limit $8.40 · Net debit $840`). **The word `Cost` is retired from every surface that can show a credit.**

`multiplier` is set to `100` for an option row and `1` for an equity row **at construction, and stored** — it is never re-derived downstream.

Single-underlying is enforced **at construction**, not by the type: an assert at open time rejects a second distinct ticker. Schema permissive, construction narrow.

`openPosition` mints a `LegId` per leg via `newId()`, builds the `SimPosition`, and keeps exactly one code path for one leg and for six.

An **order trigger still creates a single-option position, exactly as today** — multi-leg simulated orders are out of scope; do not touch `useOrderEngine`.

- [ ] **Step 4: Run the tests and commit**

```bash
npx nx test @org/dashboard
git add apps/dashboard/src/app/features/trading/ apps/dashboard/src/app/features/trading/positions/
git commit -m "feat(trading): multi-leg entry as a SIM variant of the ONE shared dialog

Per-leg prices only; the net is computed and disclosed as computed. No net field,
no back-solved per-leg price, no second dialog, no spread builder.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task F16: The faulted store, on screen

Spec §2.9, §4 *Banner region*, *Component states*, *The faulted banner*, *Refused controls*, *The Ticker-page door*. AC-61 through AC-69.

Owner ruling #4 is **STRICT**: every durable write is refused. The state is scoped to the **store, not the route** — the Ticker page opens the same shared dialog against the same store, so the banner and the refusal **follow the store**.

**The HTML `disabled` attribute is banned on refused controls.** A `disabled` MUI button drops out of the tab order and swallows pointer events, so its tooltip never opens and the reason for the refusal becomes unreachable by both keyboard and hover — precisely the failure this state exists to prevent. Use `aria-disabled="true"` + **still focusable** + `aria-describedby` the banner + activation is a no-op.

**No in-app repair, reset or "clear and start over" path** — that is a delete path, and this feature adds none. The only in-app step offered is `Reload the page`.

**Files:**
- Create: `apps/dashboard/src/app/features/trading/positions/FaultedBanner.tsx`
- Modify: `CustomizationToolbar.tsx` (banner region), `PositionsView.tsx:100-145` (empty states), `PositionsPanel.tsx`, `PortfolioPanel.tsx`, `outcomes/ArchiveBlock.tsx:137-151` + `:255-262` (the partial-archive note)
- Test: `apps/dashboard/src/app/features/trading/positions/faulted.spec.tsx` (new)

- [ ] **Step 1: Write the failing test** — the full AC-61..AC-69 set

```ts
it('AC-64 — NO frame ever paints an enabled entry/close/cancel/save affordance on a faulted store', …)
  // assert on the FIRST render pass, before any effect flushes
it('AC-63 — every mutating control is aria-disabled, FOCUSABLE, and tooltip-reachable by keyboard', …)
it('AC-63 — the HTML `disabled` attribute is never used on a refused control', …)
it('AC-63 — the entry dialog never opens', …)
it('AC-61 — attempting to open, close, cancel or save a view leaves storage BYTE-IDENTICAL', …)
it('AC-62 — the banner is non-dismissible, carries a warning ICON, and both actions are operable', …)
it('AC-65 — faulted dims nothing and shows no ⏸; offline disables no control; both banners render in priority order', …)
it('AC-66 — while faulted NO dismissible notice renders: not the merge notice, not the stale-view notice', …)
it('AC-67 — faulted with zero rows renders EMPTY_FAULTED, never the normal "no positions yet" copy', …)
it('AC-68 — the Archive block and the export snack carry the partial-archive note; export still works', …)
it('AC-69 — the Ticker page CTA carries the same refused treatment and its own one-line notice', …)
it('the latch is PER-STORE — a faulted positions store leaves orders and the track record usable', …)
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/faulted.spec.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`FaultedBanner.tsx` — `role="status"` (a standing condition, not an interruption), warning icon, non-dismissible, `id="store-faulted-banner"`. Four blocks of copy **verbatim** from spec §4. *"Export an archive of what loaded"* moves focus to the existing Archive block (`data-testid="tr-archive"`) — it does **not** duplicate the export button and does **not** rename the shipped `Export archive` action. *"Reload the page"* is a button. Closing line `text.secondary`, `0.78rem`. **No apology, no "oops", no "something went wrong", no error code.** What happened, what was protected, what is refused, what to do.

**Refused controls:** the `+ Open simulated position` CTA · every row's `Close` · every pending order's `Cancel` · the saved-view `Save`, `Save as`, `Delete`. Each gets `aria-disabled="true"`, keeps its `tabIndex`, gets `aria-describedby="store-faulted-banner"`, shows `WRITE_REFUSED_TIP`, and no-ops on activation.

**Not affected, all still fully usable:** sort, group, filter, density, layout, switching between existing saved views, expanding legs, the Track record read, and **Export archive**.

The refusal is driven **from `health.faulted`**, not from trying and failing. Thread `pf.health` from `PositionsPage` → `PortfolioPanel` → `PositionsPanel` → `CustomizationToolbar` / `PositionsView`.

`PositionsView` empty state: `health.faulted && groups have zero rows` ⇒ `EMPTY_FAULTED`; the normal `EMPTY_NO_POSITIONS` is never shown in this state.

`ArchiveBlock`: while faulted, the lead and the post-export snack carry `TR_ARCHIVE_PARTIAL_NOTE`. The `Export archive` label is **unchanged** and export still works.

The faulted state deliberately spends vertical space and may push the first row below the fold at 393px: **that is the correct trade exactly once**, because a trader who does not read this banner will lose a trade.

- [ ] **Step 4: Run the tests and commit**

```bash
npx nx test @org/dashboard
git add apps/dashboard/src/app/features/trading/
git commit -m "feat(positions): make store-faulted a first-class product state (STRICT, ruling #4)

aria-disabled and still focusable — never the HTML disabled attribute, which
would put the reason for the refusal out of reach of keyboard and hover.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task V6: Faulted-state a11y suite

**Sequence point: after F16.** Spec §7 invariant 7. AC-63, AC-64, AC-79.

**Files:**
- Create: `apps/dashboard/src/app/features/trading/positions/faulted.a11y.spec.tsx`

- [ ] **Step 1: Write the test**

Beyond F16's behavioural cases, assert the **a11y floor** that F16's tests do not: every refused control reaches its tooltip by **keyboard** (`userEvent.tab()` then assert the tooltip is in the accessibility tree, not just on hover); the banner is the `aria-describedby` target of every refused control; the leg disclosure keeps `aria-expanded`/`aria-controls` correct while faulted (it is a read and stays fully usable); leg text is ≥ 11px; mobile hit targets are ≥ 44px; **stat values are never headings**.

- [ ] **Step 2: Run it, then commit**

```bash
npx nx test @org/dashboard -- src/app/features/trading/positions/faulted.a11y.spec.tsx
git add apps/dashboard/src/app/features/trading/positions/faulted.a11y.spec.tsx
git commit -m "test(positions): a11y floor for the faulted state — reason reachable by keyboard

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task F17: Relocate `OpportunityTier` — narrowing the kernel

Spec §2.7 (the module-boundary table). No AC — this is the housekeeping that lets F18 delete `model/useGhostTrade.ts` without dragging an unrelated widget with it.

`model/OpportunityTier.tsx` has **one consumer** and is already a named deferral. It moves to `pages/ticker/widgets/`; `model/` narrows to the trading kernel (`DecisionRecord`, `DecisionEvent`, `MarkBasis`, `EntryContextDigest`, `CapturedSetup`, `TradeAlert`, `computeMark`, `bsPrice`, `captureDigest`) and no further.

**Files:**
- Move: `apps/dashboard/src/app/features/trading/model/OpportunityTier.tsx` → `apps/dashboard/src/app/pages/ticker/widgets/opportunity-tier/OpportunityTier.tsx` (+ an `index.ts` barrel matching the sibling widgets)
- Modify: every importer

- [ ] **Step 1: Find every importer**

```bash
grep -rn "OpportunityTier" apps/dashboard/src
```

- [ ] **Step 2: Move it and rewrite the imports**

```bash
git mv apps/dashboard/src/app/features/trading/model/OpportunityTier.tsx apps/dashboard/src/app/pages/ticker/widgets/opportunity-tier/OpportunityTier.tsx
```

Add `apps/dashboard/src/app/pages/ticker/widgets/opportunity-tier/index.ts` re-exporting it, matching `widgets/iv-rank/index.ts`. Update `pages/ticker/widgets/index.ts` and every import site.

- [ ] **Step 3: Verify the lane boundary still holds**

```bash
npx nx lint @org/dashboard
```
Expected: clean. `@nx/enforce-module-boundaries` must not report a new violation — dependency direction stays downward-only (`pages/ticker` → `features/trading` → the kernel → `shared/`).

- [ ] **Step 4: Run the tests and commit**

```bash
npx nx test @org/dashboard
git add -A apps/dashboard/src/app
git commit -m "refactor(trading): move OpportunityTier to a ticker widget; narrow model/ to the kernel

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task F18: THE CUTOVER — v3 live, v1 writer dead, one book

Spec §2.6, §2.9, §2.7 (the module-boundary table), §2.8. AC-45 through AC-59, AC-61, AC-70, AC-71, AC-72, AC-73, AC-74, AC-75.

**This task is deliberately large because it is ATOMIC.** A reviewer cannot approve "the v3 promote is live" while rejecting "the v1 writer is dead": the residual hole the spec closes structurally — *a stale tab still running the pre-v3 build writing a new v1 record* — is exactly what opens if these ship apart. **`useGhostTrade`'s durable write path is DELETED in this same release.** Do not split this task.

Everything it depends on is already unit-proven: the fault latch (F1), the lift and the union (F7), the projection (F8), the render path (F10–F16). This task moves the key and deletes the old writer, nothing more.

**The migration runs EXACTLY ONCE.** Once v3 exists, sources are never re-read. A repeatedly-applied union is a resurrection machine — a record the trader closed or removed in v3 would come back from a source blob. **Delete nothing, ever:** the untouched v2/v1 blobs *are* the rollback. There is no delete path, no prune, no compaction, no "clean up the old keys" step.

**Files:**
- Modify: `positions/store.ts` (whole file), `positions/types.ts`, `positions/usePortfolio.ts`
- Modify: `pages/ticker/TickerDashboard.tsx:101`, `:142`, `:152`, `:213`, `:598-632`
- Delete: `features/trading/model/useGhostTrade.ts`
- Modify: `features/trading/model/store.ts` (delete `putTrade:47`, `clearTrade:52`, `appendDecision:59`; keep the read-only accessors as migration + harvest sources), `features/trading/model/types.ts` (delete `GhostTrade:13-33`)
- Test: `positions/store.spec.ts`, `positions/migration.spec.ts` (new), `pages/ticker/ticker.risk.spec.tsx`

**Interfaces:**
- Produces:
  - `PORTFOLIO_V3_KEY = 'convexa.positions.v3'`
  - `positionsHealth(): StoreHealth` · `allPositions(): SimPosition[]` · `putPosition(p: SimPosition): boolean` · `removePosition(id): boolean` · `appendDecision(rec): boolean` · `putCustomization(c): boolean`
  - `getProvenance(): Provenance | null` · `shouldShowMergeNotice(): boolean` · `dismissMergeNotice(): boolean`
  - `interface Provenance { migrated_at: string; source_counts: Record<string, { read: number; contributed: number }>; merge_notice_dismissed: boolean }`

- [ ] **Step 1: Write the failing migration suite**

Create `apps/dashboard/src/app/features/trading/positions/migration.spec.ts` — the storage-level proof, on top of F7's pure-function proof:

```ts
it('AC-45 — a trader with items on BOTH surfaces sees ONE list containing every item from both', …)
it('AC-46 — the count is the number of DISTINCT record ids, not the arithmetic sum', …)
it('AC-47 — reloading repeatedly does not change the count, duplicate anything, or drop anything', …)
it('the promote is a SINGLE setItem — either the whole v3 blob lands or none of it does', …)
it('AC-57 — with ANY source unreadable, NO v3 blob is written at all and every source is byte-identical', …)
it('AC-58 — after the promote no source blob is ever read again: a record removed in v3 never returns', …)
it('AC-58 — no code path writes convexa.ghost-trade.v1 after this release', …)
it('AC-59 — a corrupt provenance block still reads: records render, the migration is NOT re-armed, the notice is suppressed', …)
it('the promote runs on first load even with NO sources, so the union path is never left armed', …)
it('AC-55 — closed and cancelled positions survive with their close data', …)
it('AC-52 — a trader with no saved data gets a normal empty portfolio, no notice, no error', …)
it('AC-51 — the merge notice appears ONLY for a trader who had items in BOTH places, survives reload, never returns after dismissal', …)
it('AC-56/61 — starting from an unparseable v3 blob, every mutator leaves storage byte-identical', …)
```

For AC-58's second case, assert by **construction**, following the `?raw` import-allowlist idiom already used for `LiveTabPanel` in `positions.risk.spec.tsx`:

```ts
import modelStoreSource from '@/features/trading/model/store?raw';
it('AC-58 — the ghost-trade module contains no setItem call at all', () => {
  expect(modelStoreSource).not.toMatch(/setItem/);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx nx test @org/dashboard -- src/app/features/trading/positions/migration.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Rewrite `positions/store.ts` on v3**

```ts
const V3_KEY = 'convexa.positions.v3';
const V2_KEY = 'convexa.positions.v2';
const V1_KEY = 'convexa.ghost-trade.v1';
const LEGACY_V2_KEY = 'gammaflow.positions.v2';
const LEGACY_V1_KEY = 'gammaflow.ghost-trade.v1';
```

`read()` implements exactly the spec §2.6 pseudocode:

```
if convexa.positions.v3 exists            -> it alone is authoritative; NO source is consulted. Done.
else, read ALL of: v2/legacy-v2, v1/legacy-v1
  -> lift each record to SimPosition, union by record id, keep-first in source precedence (v2 before v1)
  -> union decisions by decisionIdentity()
  -> write ONE convexa.positions.v3 blob, carrying provenance, in a SINGLE setItem
  -> delete nothing, ever
```

- Use `resolveDurable(V2_KEY, LEGACY_V2_KEY)` and `resolveDurable(V1_KEY, LEGACY_V1_KEY)` **per source key** to resolve the brand hop — that helper is right for a *rename* and is exactly what this uses it for. It is the **wrong shape for a merge of two live stores**, so the union sits **above** it.
- A source that throws on parse ⇒ `ok: false` for that source. `unionSources` reports `aborted`.
- **`aborted === true` ⇒ the promote-write is ABORTED ENTIRELY**, `faulted = true`, the store runs in memory from whatever parsed. **No partial v3 blob is ever written** — writing v3 permanently stops the read path from consulting sources, and a partial v3 would freeze a truncated history behind a key that claims completeness. A migration that half-succeeds is worse than one that does not run.
- The v3 blob itself failing to parse ⇒ `faulted = true`, sources are **not** consulted (v3 exists), nothing is written.
- **The promote-write runs on first load of the new build even when there are no sources** (all counts zero). Deferring it leaves the union path armed indefinitely, so a source blob appearing later — a stale tab, a restored profile — would be unioned in at an unpredictable moment.
- `provenance` rides the **same single `setItem`**. Corrupt or absent provenance on an otherwise readable v3 blob: records are authoritative, provenance is treated as absent, it **NEVER re-arms the migration**, never triggers a re-union, never fails the read, and the merge notice is **suppressed** (fail-closed — showing a merge notice to a trader whose merge state is unknown is a false claim; suppressing it costs one informational message).
- `provenance` is **non-load-bearing by construction**: never an input to P/L, grouping, the recogniser, the outcome ledger or the archive's record set. It can cost at most one notice, never a record.
- `shouldShowMergeNotice()` is `provenance != null && !provenance.merge_notice_dismissed && at least two source keys have contributed > 0` — it appears **only** for a trader who actually had items in both places. **The notice states NO counts at all** (spec §4 ruling 2); the counts stay in `provenance`, inspectable for support, out of the trader's read.
- Bump `PORTFOLIO_SCHEMA_VERSION` to `3`. Keep the exported key constants and add `PORTFOLIO_V3_KEY`.
- Keep the F1 fault latch verbatim on top of all of it.

- [ ] **Step 4: Point `usePortfolio` at v3**

Delete the transitional in-memory lift from F10 — `allPositions()` now returns `SimPosition[]` directly. `openPosition`, `closePosition`, `cancelLimit`, `fillLimit` write `SimPosition`. Every mutator checks `health.faulted` first and returns `{ ok: false }` rather than attempting a write. Delete `rows: DerivedRow[]`, `markFor`, and `DerivedRow`/`RowMetrics` from `derive.ts` — every consumer moved to `views` in F10–F14.

`recordDecision` keeps writing to the **one** log via the positions store's `appendDecision`. That is DECISION_QUEUE **Q2 resolved** — the two competing `appendDecision` definitions collapse to one.

**`outcomes/` keeps its zero-write boundary, and counts a multi-leg position as exactly ONE ledger record** — a per-leg harvest would multiply `N` and invalidate every Wilson interval the track record prints.

- [ ] **Step 5: Merge the Ticker page onto the one book**

In `TickerDashboard.tsx`:
- Delete the `useGhostTrade` import (`:30`) and the `gt` instantiation (`:101`).
- `const pf = usePortfolio(ticker, data, live, isLive, streamOffline);`
- `gt.positionQuery` (`:142`, `:152`) → a `positionQuery` derived from `pf`, implementing the **B1 ruling** (see *Settled — do not re-litigate* at the top of this plan). Count the `open` positions on the focused ticker and branch **the render, never the fetch**:

  | Open positions on the focused ticker | Behaviour |
  |---|---|
  | **0** | as today |
  | **exactly 1** | today's behaviour, **byte-identical** — derive `pos_*` from that position's `eval_subject` leg exactly as the shipped ghost trade did |
  | **more than 1** | **suppressed** — the projection carries `{ kind: 'none'; reason: 'multiple_positions' }` and no evaluation is surfaced on any surface |

  Write it as a small named helper (`tickerEvalSubject(views, ticker)`) so the rule lives in one place and reads as the ruling reads.

  **Why the rejected alternative is rejected**, in a comment beside the helper so a later reader does not re-propose it: picking one of N positions (e.g. the most recently opened) is deterministic but makes the app quietly assert *"this is your NVDA position"* when it is one of three. This is **owner ruling #9 applied one level up** — #9 established that the app does not evaluate a subject it cannot faithfully represent, and picking one of N is the same approximation the owner rejected for legs, with **less** visibility. There is **no regression by construction**: a ticker with 2+ positions cannot exist under the shipped one-ghost-trade-per-ticker store.

  **The reason token is `multiple_positions`, the second member of the closed `EvalNoneReason` vocabulary in `SPEC.md` §2.8.** Extending that vocabulary is part of *this* task, in `positions/evalSubject.ts` (F6):

```ts
/** Closed vocabulary — snake_case, exhaustive, no free text (SPEC §2.8). */
export type EvalNoneReason = 'no_option_leg' | 'multiple_positions';
```

  F6 already declares `reason` as a union type rather than a bare literal precisely so this is a one-line change. Add `'multiple_positions'`, then let the compiler find every exhaustive switch that must now handle it. `no_option_leg` stays position-level (`evalSubjectOf` — reachable only when a position has no option leg at all); `multiple_positions` is decided one level up, in `tickerEvalSubject`.

  The user-facing string is `POSITION_EVAL_NONE_MULTI_POSITION` (`SPEC.md` §4), marked **`[FUTURE — pending a consumer]`**. **Do not wire it in this release** — `alerts` still has no component consumer, and the suppression is observable without it. F6 Step 5's grep must keep returning no matches, now including this fifth name.

  **Suppression is a RENDER decision only.** The `pos_*` params are unchanged, and **the fetch stays unconditional and its shape never branches — not on leg count, and not on position count.** A `pos_*` request appearing in the network tab for a ticker holding three positions is **CORRECT, not a defect** (AC-74, AC-77). Do not add a position-count guard around the request in `load` (`:134-152`).
- `tradeOpen` (`:213`) → derived from `pf.views` for the focused ticker.
- The ghost dialog (`:598-632`) `onConfirm` → `pf.openPosition(...)` with the `OpenPositionInput { legs }` shape from F15. The order-variant dialog (`:638-659`) is untouched.
- The Ticker page's entry CTA carries the F16 refused treatment plus its own one-line notice while faulted (AC-69) — **the state follows the store, not the route.**
- **AC-72: the Ticker page no longer offers a position concept separate from the portfolio.** A trader cannot produce two competing records of one trade.
- **AC-70/71:** a position opened on the Ticker page appears in the Positions portfolio, and a close on the Positions page is reflected on the Ticker page, **without a reload**. `model/store.ts` has no subscription seam; the positions store must expose one (copy `subscribeOrders`/`getOrdersVersion`/`notify` from `orders/store.ts:29-52`) and both pages subscribe.

- [ ] **Step 6: Delete the v1 writer**

```bash
git rm apps/dashboard/src/app/features/trading/model/useGhostTrade.ts
```

In `model/store.ts` delete `putTrade` (`:47`), `clearTrade` (`:52`) and `appendDecision` (`:59`). **Keep** `getTrade`, `allTrades`, `allDecisions`, `decisionsForTrade`, `exportLog`, `newId` and the key constants — they survive **only** as migration + outcome-ledger harvest sources. In `model/types.ts` delete `GhostTrade` (`:13-33`). Keep `DecisionRecord`, `DecisionEvent`, `MarkBasis`, `EntryContextDigest`, `CapturedSetup`, `TradeAlert` — three domains import them.

- [ ] **Step 7: Prove the writer is gone**

```bash
grep -rn "putTrade\|clearTrade\|useGhostTrade\|GhostTrade" apps/dashboard/src
```
Expected: matches **only** in `migrate.ts` comments and the `?raw` construction test. No live import, no call site.

- [ ] **Step 8: Run everything**

```bash
npx nx lint @org/dashboard
npx nx test @org/dashboard
npx nx e2e dashboard-e2e
git diff --stat HEAD -- apps/api/
```
Expected: lint clean; tests ≥ the R1 baseline; e2e green; **`apps/api` diff empty**.

- [ ] **Step 9: Commit**

```bash
git add -A apps/dashboard/src/app
git commit -m "feat(positions): cut over to convexa.positions.v3 and kill the v1 writer

The v3 migration is a UNION executed exactly once, aborting entirely if any
source is unreadable, deleting nothing. useGhostTrade's durable write path dies
in the same commit — shipping these apart reopens the resurrection hole the
union closes structurally. Resolves DECISION_QUEUE Q2: one decision log.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task V4: `additive-keeps-score-byte-identical`

**Sequence point: after F18.** Spec §7 invariant 10, `INTERFACE_CONTRACT.md`. AC-77.

**Files:**
- Create: `apps/dashboard/src/app/pages/ticker/pos-params.spec.tsx`

- [ ] **Step 1: Assert the empty backend diff**

```bash
git diff --stat main -- apps/api/
git diff --stat main -- libs/api/
```
`apps/api/` **must** be empty — that is the reviewable claim at GATE Q. `libs/api/` should also be empty; if it is not, inspect the change and confirm it adds no field and changes no name, otherwise it is a GATE Z amendment.

- [ ] **Step 2: Write the request-shape test**

```ts
/**
 * AC-74/AC-77: the pos_* request is UNCONDITIONAL and its shape NEVER branches. A multi-leg pos_*
 * request appearing in the network tab is CORRECT, not a defect — suppression is a RENDER decision
 * only, so the request stays byte-identical and the owner can revisit the suppression after ship
 * without re-architecture.
 */
it('issues the same pos_* param set for a single-leg and a multi-leg position', …)
  // capture the request URL for a long call and for an iron condor; assert the param KEYS are equal
it('B1 — issues the SAME pos_* param set when the focused ticker holds THREE open positions', …)
  // the request is unconditional: it must not disappear, shrink or gain a param when N > 1
it('B1 — the request is issued even while the evaluation is SUPPRESSED — suppression is render-only', …)
it('never adds a new query parameter to the bundle request', …)
it('opportunity score and tier are unchanged by any position activity', …)
it('AC-74 — no position-context evaluation is SURFACED for a multi-leg position on any surface', …)
it('AC-73 — a single-option position`s rendered position-context read is unchanged from shipped', …)
it('AC-75 — a shares-only position carries an explicit reason, not an ambiguous null', …)
```

Add a **three-way render** block for **AC-83** (the B1 ruling):

```ts
it('0 open positions on the focused ticker — behaves as today', …)
it('exactly 1 — behaves as today, BYTE-IDENTICALLY', …)
it('more than 1 — no evaluation is surfaced, and the projection carries EvalNoneReason.multiple_positions', …)
```

- [ ] **Step 3: Run it, then commit**

```bash
npx nx test @org/dashboard -- src/app/pages/ticker/pos-params.spec.tsx
git add apps/dashboard/src/app/pages/ticker/pos-params.spec.tsx
git commit -m "test(ticker): pos_* request shape is byte-identical; suppression is render-only (AC-74/77)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task F19: `outcomes/` — ledger sources and archive envelope v2

Spec §2.6 (the archive paragraph), §2.7. AC-50, AC-60, AC-68.

**The archive envelope moves through the SAME function.** `outcomes/archive.ts` v1 envelopes carry `stores.ghost_trade` + `stores.positions` in the old shapes. Export bumps to `version: 2` (one merged `positions` store + orders). Import must still accept v1 files and run their `ghost_trade` + `positions` maps through the **identical `liftLegacyRecord`** the store migration uses. **One migrate function, two callers** — if they diverge, importing your own backup produces different records than the migration did, a discrepancy nobody would notice until it mattered.

The archive's **merge-only / keep-existing-on-conflict / never-throw** rules are unchanged and remain binding. The import **never adopts a `provenance` block from a file** — an imported provenance would claim a migration that did not happen on this device. **A destructive "restore replaces my data" flow is out of scope**; the module is merge-only by invariant.

`outcomes/sources.ts` must also move: after the cutover, positions closed in v3 live under the new key, and `harvest()` currently reads v2 + the ghost `trades` map (`sources.ts:157-172`). Left alone, **AC-50 fails silently** — the track record would keep reading pre-migration blobs and never see anything closed afterwards.

**Files:**
- Modify: `outcomes/sources.ts:35` (`SOURCE_LABELS`), `:69-81` (`readSources`), `:140-190` (`harvest`)
- Modify: `outcomes/archive.ts:45-61` (`ARCHIVE_VERSION`, `ArchiveEnvelope`), `:72-88` (`buildArchive`), `:141-180` (`parseArchive`), `:219-283` (`importArchive`)
- Modify: `outcomes/ledger.ts` where it reads `Position` fields that are now leg facts
- Test: `outcomes/archive.spec.ts`, `outcomes/ledger.spec.ts`, `outcomes/boundaries.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('AC-60 — exporting an archive and re-importing it produces the SAME records the migration produced', …)
it('AC-60 — a v1 envelope still imports, through the IDENTICAL lift the store migration uses', …)
  // assert the SAME function, not two look-alikes: import liftLegacyRecord in the test and assert
  // the imported record deep-equals liftLegacyRecord(rawLegacyRecord)
it('AC-60 — import is merge-only and NEVER adopts a provenance block from the file', …)
it('AC-50 — hit rate, N and mean return per cell read the same immediately before and after the update', …)
it('AC-50 — a multi-leg position counts as exactly ONE ledger record', …)
it('the ledger harvests from v3 after the cutover, and stops double-counting the legacy blobs', …)
it('outcomes keeps its ZERO-WRITE boundary: computing the track record writes nothing', …)
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx nx test @org/dashboard -- src/app/features/trading/outcomes/`
Expected: FAIL.

- [ ] **Step 3: Implement**

`sources.ts`: add `convexa.positions.v3` to `SOURCE_LABELS` and to `readSources()`. In `harvest()`, when a readable v3 blob exists it is the **authoritative** position source and the legacy maps are **not** unioned in (they were already unioned into v3 — re-unioning them here is the same resurrection bug at the read layer). Only when v3 is absent does the existing v2 + ghost union apply. Replace the `sources.ts:158-161` warning comment with a note recording that the v1-only-positions-are-PERMANENT condition is now resolved by the v3 union, and keep the pre-v3 branch intact for a browser that has not loaded the new build yet.

`archive.ts`: `ARCHIVE_VERSION = 2`; `ArchiveEnvelope.stores` becomes `{ positions: { positions: Record<string, SimPosition>; decisions: DecisionRecord[] }; orders: { orders: Record<string, SimOrder> } }`. `parseArchive` keeps declining only **future** versions (`o.version > ARCHIVE_VERSION`), so a v1 file still parses. `importArchive` routes a v1 envelope's `stores.ghost_trade.trades` and `stores.positions.positions` through `liftLegacyRecord` before the existing `tally` conflict policy — **existing wins**, byte-identical records are `skipped`, differing records are `conflicts` and **nothing is written**. Strip any `provenance` key present on an imported file before merging.

`ledger.ts`: `computeLedgerRead` counts one `Outcome` per `SimPosition`, unchanged in structure. Where it read `p.entry_basis` (`:468-472`), read the **entry leg's** `entry_basis` via the position's primary leg; where it read contract facts for the decision join, read them from the leg. **Do not** fan out per leg — a per-leg harvest would multiply `N` and invalidate every Wilson interval.

- [ ] **Step 4: Run the tests and commit**

```bash
npx nx test @org/dashboard
git add apps/dashboard/src/app/features/trading/outcomes/
git commit -m "feat(outcomes): archive envelope v2 and the ledger on v3, through the ONE shared lift

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task V7: Full-page integration over a seeded durable store

**Sequence point: after F19.** Spec §7 *Test tiers (FE)* — *Integration*.

**Mock the network boundary ONLY** (`GET /api/contract`, the SSE stream). **Never the store, never the derivation** — mocking either is what makes an integration test agree with a broken implementation.

**Files:**
- Create: `apps/dashboard/src/app/pages/positions/positions.integration.spec.tsx`

- [ ] **Step 1: Write the suite**

Seed the durable store from `positions/fixtures.ts` before each case and drive the real page:

```ts
it('AC-1 — a two-leg vertical appears as ONE row, not two', …)
it('AC-2/AC-3 — a shares-only position and a covered call each appear as one row', …)
it('AC-23 — every position shows one net P/L figure covering all of its legs', …)
it('AC-39/AC-40 — a partially-unresolvable spread withholds pl, pl_pct and mark, is excluded from the subtotal AND counted, and every other row keeps rendering', …)
it('AC-38/AC-42/AC-43 — an SSE drop degrades exactly as shipped; static cells never dim; the four degraded states never render alike', …)
it('AC-53/AC-54 — the seeded stale saved view opens, shows rows, is flagged adjusted, and writes nothing', …)
it('AC-51 — the merge notice appears once for a both-surfaces trader and never returns after dismissal', …)
it('AC-76 — every position surface stays labelled SIMULATED; the paper badge and disclosure survive verbatim', …)
it('AC-70/AC-71 — a position opened on the Ticker page appears in the portfolio, and a close propagates back, without a reload', …)
```

The stale-saved-view case **requires** `STALE_SAVED_VIEW_CUSTOMIZATION` from V1 — that state only exists for a user with pre-existing durable state, which a fresh browser cannot reproduce, so without the fixture the AC is unverifiable at GATE Q.

- [ ] **Step 2: Run it, then commit**

```bash
npx nx test @org/dashboard -- src/app/pages/positions/positions.integration.spec.tsx
git add apps/dashboard/src/app/pages/positions/positions.integration.spec.tsx
git commit -m "test(positions): full-page integration over a seeded store, network boundary mocked only

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task V8: Gate pack — conformance, baseline, review checklist

**Sequence point: last.** This is what GATE Q consumes.

- [ ] **Step 1: Run the interface conformance check**

Start the backend, then run the command from **Global Constraints → Conformance spec** exactly as written. A **404 means the fixture is stale**, not that the interface broke — substitute a `(ticker, expiration, strike, right)` triple that exists in the current snapshot and re-run. **Never loosen a required field to make a stale fixture pass.**

If no live snapshot is available, use the deterministic path:
```
interface_conformance.py --contract .claude/contracts/positions-legs/INTERFACE_CONTRACT.md \
  --sample resp.json --endpoint /api/contract/{ticker}
```

- [ ] **Step 2: Confirm the backend diff is still empty**

```bash
git diff --stat main -- apps/api/
```
Expected: empty. This is the reviewable `NO_BACKEND_CHANGE` claim.

- [ ] **Step 3: Confirm the test baseline**

```bash
npx nx lint @org/dashboard
npx nx test @org/dashboard
npx nx e2e dashboard-e2e
```
Expected: lint clean; unit tests **at or above** the R1 baseline (645/75) — a drop is a regression to fix, never an assertion to rewrite; e2e at or above 15/15 plus the V3 case.

- [ ] **Step 4: Walk the review-class checklist**

Spec §7 marks these **`review`, not `test`** — verify each by inspection and record the evidence (a screenshot or a quoted string) for GATE Q:

- [ ] Every structure label string (AC-14), and the `Custom` neutral register — no error styling, no alert colour, no icon (AC-15)
- [ ] No name, chip, sub-label or tooltip anywhere implies collateral, cash set aside or buying-power state (AC-16)
- [ ] One name per shape: the four verticals, long/short straddle, long/short strangle, long/short shares each distinct (AC-20); `Custom` for a non-iron butterfly, a non-iron condor, a 1×2 ratio and a >4-leg exotic (AC-21)
- [ ] The faulted banner copy, **verbatim**, all four blocks (AC-62)
- [ ] The net debit/credit copy table, every row (AC-34), and the `Cost`-retirement sweep:
      `grep -rn "\bCost\b" apps/dashboard/src/app/features/trading/` — expect no user-facing match
- [ ] The five-item card footer (AC-30) and the collapsed-height equality
- [ ] The group-axis contents (`None · Ticker · Structure`) and the declared sort order (AC-53, §4 Flows 5)
- [ ] The max-loss assumption sentence, and **the three withheld-reason labels and their tips** — `unlimited risk` · `mixed expiries` · `unnamed shape` (AC-28, AC-29)
- [ ] The merge-notice presence and wording, and that it states **no counts at all** (AC-51)
- [ ] `SIMULATED` labelling, the paper badge and the positions disclosure survive verbatim; no broker, no order path, no real-money entry anywhere (AC-76)
- [ ] The `Δ since entry` / trend / sparkline treatments are unchanged from shipped
- [ ] `max_loss` fits at both densities and every breakpoint above `md` — attach the screenshots from F11 Step 6

- [ ] **Step 5: Confirm the B1 three-way position-count behaviour**

Verify **AC-83** (`SPEC.md` §3 section H, `test`) — the B1 ruling, implemented in F18 Step 5 and asserted in V4. GATE Q must confirm all three arms against the running app, on the focused ticker:

- [ ] **0 open positions** — no evaluation, as today
- [ ] **exactly 1 open position** — today's behaviour, **byte-identical**, then the multi-leg rule applies within it; this is the arm AC-73 rests on, and AC-73 survives verbatim because it was only ever well-defined for this case
- [ ] **more than 1 open position** — evaluation **suppressed** on every surface, the projection carrying `EvalNoneReason.multiple_positions` rather than an unexplained silence
- [ ] the `pos_*` request is **present and byte-identical** in all three arms — a request still appearing for a 3-position ticker is **correct, not a defect** (AC-83 repeats AC-74's clause)
- [ ] `POSITION_EVAL_NONE_MULTI_POSITION` is **not rendered** anywhere — it is `[FUTURE — pending a consumer]` and this release ships no consumer

- [ ] **Step 6: Report**

Hand the conductor: the conformance result, the empty `apps/api` diff, the final test/e2e counts against the R1 baseline, the review-checklist evidence, and the Step 5 three-way confirmation (including whether the `SPEC.md` §2.8 reason token and its AC had landed by the time the lane needed them).

---

## Spec coverage map

Every spec section and every AC, against the task that carries it.

| Spec | Task |
|---|---|
| §1 scope / out-of-scope / future | the whole plan; the out-of-scope list is enforced by the *do not build* notes in F6, F15, F19 |
| §2.1 durable shape, the three hard stands | F2 |
| §2.2 P/L composition, `pl_pct_state` | F2 |
| §2.3 `StructureKind` | F3 |
| §2.4 max loss, the closed 15 | F4 |
| §2.5 the mark ladder for a structure | F5, F10 |
| §2.6 the union migration | F7 (pure), F18 (live), F19 (archive) |
| §2.7 module boundaries, `PositionView`, entry input shape | F8, F15, F17, F18 |
| §2.8 `eval_subject`, multi-leg suppression | F6, F18, V4 |
| §2.9 the faulted store, architecture | F1, F16, F18 |
| §2.10 the live defect | F1 |
| §2 failure modes + isolation | F5, F7, F16, F18 |
| §3 AC-1..13 | F15, V7 |
| §3 AC-14..21 | F3, F11, V8 |
| §3 AC-22..37 | F8, F11, F12, F13, V7 |
| §3 AC-38..44 | F5, F10, F11, V7 |
| §3 AC-45..60 | F7, F18, F19 |
| §3 AC-61..69 | F1, F16, V6 |
| §3 AC-70..72 | F18, V7 |
| §3 AC-73..75 | F6, F18, V4 |
| §3 AC-76..82 | F9, F11, V2, V3, V4, V8 |
| §3 AC-83 (the B1 ruling, three-way position count) | F18 Step 5, V4, V8 Step 5 |
| §4 UI + interaction, copy | F9, F11, F12, F13, F14, F15, F16 |
| §5 error handling | F5, F7, F11, F14, F16, F18 |
| §6 interface pointer | Global Constraints, V8 |
| §7 testing strategy | V1–V8, and the TDD steps inside every F task |
| §8 guardrails | Global Constraints; V2 (`theme-token-discipline`), V3, V4, V5 |
| §9 open questions | **empty** — nothing carried into the plan |

---

## Execution handoff

Plan complete and saved to `.claude/contracts/positions-legs/PLAN.md`. Two execution options:

**1. Subagent-Driven (recommended)** — a fresh subagent per task, reviewed between tasks, fast iteration. Given that F18 is an atomic cutover of the whole trading domain, the between-task review is where the sequencing guarantee actually gets enforced.

**2. Inline Execution** — execute tasks in one session using `superpowers:executing-plans`, batch execution with checkpoints for review.

Either way the lane is **frontend only** — there is no backend track, and the `apps/api` diff must be empty at GATE Q.
