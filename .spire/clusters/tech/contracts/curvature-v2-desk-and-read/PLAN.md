# curvature-v2-desk-and-read — implementation plan

**Spec:** `.spire/clusters/tech/contracts/curvature-v2-desk-and-read/SPEC.md` (approved; **not editable here**)
**Interface:** `.spire/clusters/tech/contracts/curvature-v2-desk-and-read/INTERFACE_CONTRACT.md` (posture `NO_BACKEND_CHANGE`)
**Council:** `council/decisions.md` (32 conflicts, 16 technical settled voice-to-voice, 5 product DELEGATED) · `council/S2-findings.md` (both passes; every pass-1 finding CLOSED at pass 2)
**Phase-1 rulings that bind:** `contracts/curvature-v2-foundations/council/decisions.md` §5 rulings **1, 2, 3, 5, 6, 8** (owner)
**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (**Status: SET**)
**Baseline (conductor's own runs, `spire/curvature-v2-foundations` @ `6a3ef463`, exit codes checked):**
`npm run typecheck` **0** · `npx nx test @convexa/dashboard` **0** @ **215 files / 2376 tests** · `npm run lint` **0** ·
e2e **NOT RUN** at this baseline (phase 1 closed it at **75/75 against the production build**; re-running needs
`npx playwright install chromium`, a production build and `npm run ports:free`).

---

## STATUS OF THE SPEC — stated plainly, including one discrepancy this plan will not resolve

Seven calls in the spec were taken **by the conductor under a written delegation from the owner**, who was
asleep, and are tagged **DELEGATED** rather than RULED: the five product rulings **P1–P5**
(`council/decisions.md` §3), plus **D-14** (the level-absence literal, SPEC §4.3) and **D-15**
(`cooldown`/`daily_cap` over a pinned read render unchanged, SPEC §9 item 6). Each is restated with its
reversal in `state/spire-curvature-v2-foundations/OVERNIGHT_DECISIONS.md`.

**The two inputs disagree about whether the owner has since approved the spec, and this plan records both
rather than picking one:**

- `_MANIFEST.md:2,6-9` (dated **2026-09-05**) reads *"GATE C — **SPEC APPROVED BY OWNER 2026-09-05**; build
  authorized"* and *"SEVEN conductor calls under delegation … **ratified by the owner's spec approval
  2026-09-05**; they stay tagged so the provenance survives into GATE Q and the ledger."*
- The launch brief that opened this planning session states the owner is asleep and the spec is
  **awaiting owner approval**.
- `SPEC.md:5` still reads `**Status:** draft`.

**This plan is written to be correct either way**, because the marking costs nothing and the manifest itself
asks for it: every task that exists **only** because of a DELEGATED call carries a
`DELEGATED (Px / D-nn) — reversal cost:` line naming exactly what disappears or changes if the owner reverses
it. **Nothing here re-litigates any of the seven.** The discrepancy is carried to the conductor as an
unresolved item (U-1), not resolved by the planner.

---

## STOP — one GATE Z question. Criterion 16 is not satisfiable as written.

**Do not build criterion 16's third and fourth clauses, and do not weaken them into something that passes.**
Report this to the conductor/owner; FE-2 below owns the two clauses that *are* provable and explicitly
refuses to invent the rest.

**The row.** SPEC §3 row 16 (S8, `test`):

> After a symbol change or a replay arm, the latch is empty: every live-derived cell shows **the bare member
> with the pause mark**, and the connection chip is **simultaneously on its wordless placeholder**.

**Measured against the tree, in both branches:**

| branch | latch empty? | "bare member **with the pause mark**" | "chip on the **wordless placeholder**" |
|---|---|---|---|
| **symbol change** | yes | **no** — `useTickerStream.ts:34` publishes `{ live: null, streamOffline: false }` on every `[ticker, selected]` change, so `LiveTape.tsx:100`'s `tileOffline` is **false**; `FigureCell.tsx:255` only enters the pause-mark arms when `offline != null`. The cell renders F1 (`—`, no pause mark). | **yes** — `connectionStateFor` (`connectionState.ts:98-101`) returns `null` while `live == null`, and the caller renders the placeholder. |
| **replay arm** | yes | **no** — `sessionTapeOf(live)` truthy ⇒ `LiveTape.tsx:100` sets `tileOffline = false` and `:107` sets `replayFigure = true`, so the cell renders **F6**, which `FigureCell.tsx:277-281` defines as *"no dot, no pause mark, no offline caption, full strength"* — the arm phase-1 ruling 2 and `DESIGN_SYSTEM.md:168` mandate. | **no** — a replay arm does not clear `live` and does not re-open the stream (`useTickerStream.ts:32-54` re-runs only on `[ticker, selected]`), so `connectionStateFor` returns `{ kind: 'replay', … }`. `connectionState.ts:92-96` states the latch *"NEVER reverts within a mounted session"*. |

So the row asks for a pause mark in two states that are not drops (contradicting the F5/F6 split this same
spec relies on at rows 12–13 and 18), and for the chip to be on the placeholder in a state where phase-1
**owner ruling 1**'s irreversible latch guarantees it cannot be.

**A fixture that publishes `live: null` while separately toggling a replay-armed reset token would make the
row green against a state the app cannot produce** — the exact vacuity this phase's own §8
(`[structural-over-prose-enforcement]`) and row 57 exist to forbid. That is why this is reported, not routed
around.

**Three candidate resolutions, costs stated, none chosen here:**

1. **Split the row in two.** 16a: *after a symbol change the latch is empty, every live-derived cell renders
   the bare member (F1, no pause mark), and the chip is on the wordless placeholder*. 16b: *after a replay
   arm the latch is empty and every live-derived cell renders F6 — full strength, no dot, no pause mark, no
   offline caption*. Cost: one criterion becomes two; nothing else in the spec moves. **Cheapest, and it is
   what the underlying mechanism actually guarantees** (§2.2's reset token gives both clears).
2. **Keep one row, drop the two dressing clauses**, asserting only *the latch holds no value after either
   reset*. Cost: loses the observable and makes the row a white-box assertion on a hook.
3. **Change behaviour to match the row.** Cost: contradicts F6, `DESIGN_SYSTEM.md:168` and phase-1 ruling 1 —
   a canon reversal, i.e. a GATE Z of its own, for no product gain.

Until this is answered, **FE-2 writes 16a and 16b's substance as two tests and marks row 16 `BLOCKED —
GATE Z` in the build report.** The build lane must not merge them into one green row.

---

## Goal

Re-cut the ticker desk from a thirteen-widget bento into one instrument read top to bottom — **masthead →
structure-field hero → read strip → verdict-first AI read brief → quiet context band** — so a swing trader
finds the flip, the walls and the AI verdict without scanning thirteen cards, and can never mistake a
snapshot for live.

## Architecture shape

Everything ships inside `apps/dashboard` (React 19 + Vite + MUI v9/Emotion, Vitest + jsdom + Testing
Library) plus `apps/dashboard-e2e` (Playwright) and one Node script under `design/`. The hero is **one
`Widget`** with four pure-props children (`StructureFieldCanvas` · `LevelLadder` · tape-trail row ·
`StructurePathStrip`); **exactly one** component in the hero calls `useLiveTape()` and passes a **branded**
liveness claim and the mid down as props. The read strip is a rail whose **cells** are the container
context (each wrapped in the shipped `PanelContainer`; the strip itself never declares `containerName`).
The AI read is one component with a total `(requestState, resultState) → ReadLayout` mapping; under 768px
the same component becomes a bottom sheet that **re-declares** the `panel` container name at its own root
because MUI portals it to `document.body`. `apps/api` is byte-frozen.

## Tech stack this plan binds

`@mui/material ^9.2.0` (`theme.containerQueries('panel')`, `extrasFor(theme)`, portal-severed ancestry) ·
`react ^19.2.8` (`useSyncExternalStore` via `liveTapeStore`) · `vitest ~4.1.10` (jsdom; the `?raw`
`import.meta.glob` scan idiom; `@ts-expect-error` as a **compile-time** proof) ·
`@playwright/test ^1.62.1` (chromium; `testMatch` is an explicit allowlist — see FE-12) ·
`@convexa/api` generated wire types (`libs/api/src/generated/schema.ts`).

---

## Global constraints

1. **`NO_BACKEND_CHANGE`.** `git diff --name-only <merge-base>..HEAD -- apps/api` must return **zero lines**
   (criterion 55, `[additive-keeps-score-byte-identical]`). **No task below writes under `apps/api`.**
   `opportunity_score` / `opportunity_tier` / `state_fingerprint` stay byte-identical.
2. **Check EXIT CODES, never printed summaries.** PowerShell `$LASTEXITCODE`, Git Bash `echo $?` /
   `${PIPESTATUS[0]}`. A suite once printed `1004 passed` while exiting non-zero (CLAUDE.md).
3. **`nx test` green does NOT mean the types are sound.** Vitest transpiles without typechecking.
   `npm run typecheck` exit 0 is recorded **separately** at every claim of done (criterion 56). This is the
   only thing that sees the branded-boolean guarantee (invariant 1) and a wire-field rename.
4. **Never a bare `nx format:write`.** Always `npx nx format:write --files <a>,<b>` — one bare run once
   reformatted 92 unrelated files.
5. **Zero new `@keyframes` names** (`[single-motion-moment]`). The set-equality assertion in
   `single-motion-moment.spec.ts` is what proves it. **Adding a name to that allowlist closes nothing** —
   see FE-4 for the two holes and the mechanism that actually bites.
6. **Pins are re-pointed, never deleted**, and every list keeps its stale-entry (liveness) assertion.
7. **Mutation proofs are part of done** (criterion 57): poison the thing the rule forbids, the build goes
   red, **and the poison test is itself proven non-vacuous**. Phase 1 shipped two `expect(true).toBe(true)`
   bodies under a "MUTATION PROOF" heading — every proof step below states how the test *fails*.
8. **e2e runs against the production build, never the dev server**, after `npm run ports:free` (which sweeps
   IPv4 **and** IPv6 `[::1]`). `broker-grouping.spec.ts` fails ~74/75 on Vite dev and passes 75/75 on the
   production build.
9. **Stale `tsc --build` outputs produce phantom TS2353/TS6305.** If they appear: delete
   `apps/dashboard/dist`, `apps/dashboard/out-tsc`, `apps/dashboard-e2e/out-tsc` and every `*.tsbuildinfo`,
   then rebuild `tsconfig.app.json` **before** `tsconfig.spec.json`. (`apps/dashboard-e2e/out-tsc/` carries
   stale Cypress-era `.d.ts` today — it is a known source of this.)
10. **Never `git stash`.** Another lane may hold uncommitted work. Use a targeted `git checkout -- <file>`
    or a worktree.
11. **Conformance spec** — copied **verbatim** from `INTERFACE_CONTRACT.md` `## Conformance spec`. Both
    lanes inherit this shape:

> ## Conformance spec
>
> Machine-checkable. `interface_conformance.mjs` runs this against the live backend at G1. It pins the
> existing wire this frontend-only phase binds to, so a silent field rename or a nullability change is
> caught before GATE Q rather than as a blank ladder row on the desk.
>
> **Endpoint order is load-bearing, not cosmetic.** `/api/ticker/{ticker}` runs first because
> `/api/recommendation/status/{ticker}` is documented as *"always 200 when bundle exists"*
> (`apps/api/src/routes/recommendation.rs:638`) — a status call for a ticker that was never fetched can
> `404`, which would be a FAIL of a configuration, not of a contract. Do not reorder the array.
>
> ```json
> {
>   "endpoints": [
>     {
>       "method": "GET",
>       "path": "/api/ticker/{ticker}",
>       "path_params": { "ticker": "SPY" },
>       "query": {},
>       "required": {
>         "market_state": "object",
>         "market_state.price": "number|null?",
>         "market_state.gex_spot": "number|null?",
>         "market_state.call_wall": "number|null?",
>         "market_state.put_wall": "number|null?",
>         "market_state.gamma_flip": "number|null?",
>         "market_state.max_pain": "number|null?",
>         "market_state.net_gex": "number|null?",
>         "market_state.net_dex": "number|null?",
>         "market_state.iv_hv_ratio": "number|null?",
>         "market_state.chain_vol_oi_ratio": "number|null?",
>         "market_state.iv_rank": "object|null?",
>         "market_state.iv_skew": "object|null?",
>         "market_state.term_structure": "object|null?",
>         "market_state.off_exchange": "object|null?",
>         "market_state.market_phase": "string|null?",
>         "signals": "object",
>         "signals.opportunity_score": "number|null?",
>         "signals.opportunity_tier": "string|null?"
>       }
>     },
>     {
>       "method": "GET",
>       "path": "/api/recommendation/status/{ticker}",
>       "path_params": { "ticker": "SPY" },
>       "query": {},
>       "required": {
>         "gate": "object|null?",
>         "gate.state": "string?",
>         "gate.cooldown_remaining_seconds": "number?",
>         "cap": "object|null?",
>         "cap.over_limit": "boolean?",
>         "cap.remaining_today": "number?",
>         "cap.resets_at": "string?",
>         "availability": "object|null?",
>         "availability.in_app_enabled": "boolean?"
>       }
>     }
>   ]
> }
> ```
>
> **What this block buys, stated exactly, so no reader trusts it for more than it checks.**
>
> - **Checked outright:** that `/api/ticker/{ticker}` still returns a `market_state` **object** and a
>   `signals` **object**, and that `/api/recommendation/status/{ticker}` answers `200` for a fetched
>   ticker without a session. Those three are the structural spine the whole desk hangs on.
> - **Checked on presence:** every dotted field above is type-checked **when the key is present**. A
>   type change (`number` → `string`, an object flattened to a scalar) is a FAIL. This is the honest
>   limit of a wire whose level fields are genuinely `optional | null` — pinning them harder would FAIL
>   every run against a symbol whose chain legitimately carries no put wall, which is a false FAIL that
>   sends GATE Q to the backend lane to hunt a bug that does not exist.
> - **Not caught by these pins:** a **rename** of an optional field (it reads as absence, which is a
>   legal state). That residual is closed elsewhere rather than left open. First, `apps/api` is
>   byte-frozen for this phase (criterion 55, proved by an empty diff), so no rename can originate
>   here. Second, every field above is consumed through the generated wire types in
>   `libs/api/src/generated/schema.ts`, so a rename landing from a later backend phase is a **compile
>   error** caught by `npm run typecheck` — which criterion 56 already requires, with its exit code
>   recorded separately from `nx test`'s.
> - **Not checked at all, by design:** the SSE stream (the runner does not read event streams) and the
>   recommendation POST (session-bound, mutating, and it would spend a real AI request).
>
> No field above is new; nothing here authorises a backend edit. If the runner cannot reach a live
> backend, this is a `NO_BACKEND_CHANGE` feature and the exemption stands — record it as such rather
> than inventing a sample pass.

---

## Per-task cycle (every task below)

Write the failing test → run it, **watch it fail and record the failure text** → implement minimally → run
it, watch it pass and **record exit 0** → `npx nx format:write --files <changed>` → commit. Commit at every
green step, not once per task. Conventional commits with a scope (`feat(dashboard):`, `test(dashboard):`,
`refactor(dashboard):`). **If a step contradicts the tree, report the conflict; do not resolve it silently**
(`[cited-code-is-verified-not-assumed]`).

## The five traps that are already paid for — do not rediscover them

| # | Trap | Where it bites in this plan |
|---|---|---|
| T1 | `apps/dashboard-e2e/playwright.config.ts:30-37` is an explicit `testMatch` **allowlist** of six specs. A new spec file not added there **never runs and reports green**. | FE-12 step 1 — add the filename in the **same commit** that creates it, prove with `--list`. |
| T2 | `no-overflow.spec.ts:398` uses `page.getByText('Call wall').first()` as the readiness anchor for **every** `/ticker/TSLA` walk at every width — and `Call wall` is rendered today by `DealerPositioning.tsx:108`, which FE-8 deletes. | FE-5 keeps the exact words (criterion 2) **deliberately**; FE-12 step 2 re-anchors on the ladder's own testid anyway and proves both. A rename reds ~12 e2e cases for a reason nobody connects to a copy change. |
| T3 | Overflow widths are **393 in both schemes** and **834 / 900 / 1280 in one** (`no-overflow.spec.ts:43-45`, `:47-54`). **834 already ships** (`:51`, added in phase 1). | FE-12 — **do not add 834**; keep it green. Do not widen the wide bands to two schemes (SPEC §9 item 3: available to the owner, **not taken**). |
| T4 | `single-motion-moment.spec.ts:54-55` (`namedKeyframesIn`) matches only **literal** `@keyframes <name>` text, so a Canvas2D rAF loop is invisible to it; `:58`'s `declaresDynamicKeyframes` exempts `useFlashOnChange.ts`, which mints a **dynamic** name at `:71-74`. | FE-4 — the enforcement is the **extracted pure paint step** driven against a recording fake 2D context, plus a behavioural test on the hook. **Adding a name to the allowlist closes neither hole.** |
| T5 | `nx test` does not typecheck; a printed summary is not an exit code; e2e needs the production build + `ports:free` on both address families. | Global constraints 2, 3, 8 and the verification track. |

---

# Backend track

The backend lane implements **zero product code**. `NO_BACKEND_CHANGE` means its whole job is proving the
empty diff, proving score/tier/fingerprint identity, and producing the conformance receipt. This is stated
rather than padded with invented work — exactly as phase 1's plan had it.

## BE-1 — Empty-diff proof · score identity · conformance receipt (**backend closer**)

**Owns:** `.spire/clusters/tech/contracts/curvature-v2-desk-and-read/conformance-receipt.json`
**Depends on:** — · **Independent:** no (sole backend task; it is the closer)

**Step 1 — record the merge base once.**

```bash
cd /c/Dev/convexa
MB=$(git merge-base main HEAD); echo "merge-base=$MB"
```

**Step 2 — prove the empty diff (criterion 55, SB).** Report the observed file count, not just "empty":

```bash
git diff --name-only "$MB"..HEAD -- apps/api > /tmp/api-diff.txt
wc -l < /tmp/api-diff.txt
test "$(wc -l < /tmp/api-diff.txt)" -eq 0; echo "criterion-55 diff exit=$?"
```

Expected: `0` files, `exit=0`. **A non-zero count is a STOP** — report it; do not revert another lane's work.

**Step 3 — prove `opportunity_score` / `opportunity_tier` / `state_fingerprint` byte-identical.** Because
the `apps/api` diff is empty, the evidence is the diff itself **plus** one captured bundle read before FE-1
and one after FE-14, on the same ticker:

```bash
npm run ports:free
npx nx serve api &   # :8000
curl -s localhost:8000/api/ticker/SPY | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(JSON.stringify({score:j.signals.opportunity_score,tier:j.signals.opportunity_tier,fp:j.ai_eval.state_fingerprint}))})'
```

Record **both** lines verbatim in the build report. Identical strings = criterion 55 pass. Different strings
with an empty diff means the vendor snapshot moved between reads — re-run both within one 60s cache window
and say so, rather than reporting a false failure.

**Step 4 — conformance receipt.**

```bash
node .claude/tools/interface_conformance.mjs \
  --contract .spire/clusters/tech/contracts/curvature-v2-desk-and-read/INTERFACE_CONTRACT.md \
  --url http://localhost:8000 \
  --report .spire/clusters/tech/contracts/curvature-v2-desk-and-read/conformance-receipt.json
echo "conformance exit=$?"
```

Expected: `interface_conformance — 2 endpoint(s)`, exit **0**. **If the runner cannot reach a live backend,
this is a `NO_BACKEND_CHANGE` feature and the exemption stands** — record
`NOT RUN — no reachable backend, NO_BACKEND_CHANGE exemption` in the receipt and the report
(`[local-evidence-is-not-hosted-evidence]`). **Never invent a sample pass.**

**Step 5 — `npm run ports:free` before leaving.** Orphaned uvicorn children outlive a killed parent and a
survivor on :8000 serves stale code into the next lane's verification.

**Reviewer probe:** does the receipt's endpoint array match the Conformance spec above **in order**
(`/api/ticker/{ticker}` first — the order is load-bearing), and does every dotted level field still carry
its `number|null?` optional marker? An unmarked pin FAILs every run against a symbol with no put wall.

---

# Frontend track

Fourteen tasks, strictly ordered. **FE-1…FE-4** are the mechanisms (brand, latch, stroke table, paint step);
**FE-5…FE-8** are the hero and strip and the deletion they pay for; **FE-9…FE-10** are the AI read;
**FE-11** composes the desk; **FE-12** is the browser layer; **FE-13** is the design mirror; **FE-14** is the
closer.

---

## FE-1 — The one liveness *claim* predicate, made unrepresentable to violate

**Owns:** new `apps/dashboard/src/app/shared/liveness/liveClaim.ts` · new
`apps/dashboard/src/app/shared/liveness/liveClaim.spec.ts` · new
`apps/dashboard/src/app/shared/liveness/liveClaim.typeproof.spec.ts` ·
`apps/dashboard/src/app/pages/ticker/sessionTapeStanding.ts` ·
`apps/dashboard/src/app/pages/ticker/connection/connectionState.ts` ·
`apps/dashboard/src/app/shared/ui/Widget/Widget.tsx` ·
`apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.tsx` ·
`apps/dashboard/src/app/features/trading/orders/OrdersWidget.tsx`
**Depends on:** — · **Independent:** no
**Spec:** §2.1, §7 invariant 1 · **Criteria:** 8 (SB), 10 (SB)

**Why this is first, and why the module is `shared/liveness/`, not `sessionTapeStanding.ts`.** §2.1 names
`isDeliveringLive` (`sessionTapeStanding.ts:54-60`) as the canon predicate and requires the brand be
"produced only inside that module", and it requires **`Widget.live`** to carry the brand.
`sessionTapeStanding.ts` lives under `pages/ticker/`; `Widget.tsx` lives under `shared/ui/`, and
`OrdersWidget.tsx:144` (`features/trading/orders/`) also passes `live={watchingAny}`. A `shared/` → `pages/`
or `features/` → `pages/` import **inverts the repo's binding dependency direction**
(`pages`/`features` → `shared`, `apps/dashboard/src/app/README.md`). This is phase 1's U-3 shape and takes
phase 1's resolution: **the brand and the predicate move to `shared/liveness/liveClaim.ts` and
`sessionTapeStanding.ts` re-exports them**, so "produced only inside that module" stays literally true and
every existing importer keeps its import path. **No spec sentence is weakened** — §2.1 names the predicate
and the mechanism, never a module path for `Widget`'s consumption.

**Step 1 — the module.** Create `apps/dashboard/src/app/shared/liveness/liveClaim.ts`:

```ts
/**
 * `LiveClaim` — the ONE liveness *claim* predicate, made unrepresentable to violate (SPEC §2.1).
 *
 * WHY A BRAND. Phase 1 FAILed GATE Q with a fully green suite (ledger key `one-liveness-predicate`)
 * because two expressions answered "is this live?". Four answered it across the surfaces this phase
 * folds into one panel. A plain `boolean` prop cannot tell a caller's hand-written `&&` chain from
 * the canon predicate; a nominal type can, at COMPILE TIME, with no runtime cost and no `expect`.
 *
 * MODULE PLACEMENT (PLAN U-2). SPEC §2.1 names `isDeliveringLive` (`pages/ticker/sessionTapeStanding.ts`)
 * as the canon predicate AND requires `Widget.live` (`shared/ui/`) to carry the brand. A `shared/` →
 * `pages/` import inverts the repo's binding dependency direction, so the predicate and its brand live
 * HERE and `sessionTapeStanding.ts` re-exports them. "Produced only inside that module" is unchanged:
 * this file is that module.
 */
import type { LiveUpdate } from '@convexa/api';

declare const LIVE_CLAIM: unique symbol;

/**
 * A boolean that can ONLY be produced by `isDeliveringLive` / `andPresent` below. A raw `true`,
 * a `&&` chain, or a store flag will not type-check where this is expected.
 */
export type LiveClaim = boolean & { readonly [LIVE_CLAIM]: 'delivering-live' };

/** The only mint. Private — every export below routes through it. */
const claim = (v: boolean): LiveClaim => v as LiveClaim;

/** The NOT-live claim, for call sites that are structurally never live (a bundle-only figure). */
export const NOT_LIVE: LiveClaim = claim(false);

/** Session-tape occupancy, read without importing `pages/`. Mirrors `sessionTapeStanding.sessionTapeOf`. */
function hasSessionTape(live: LiveUpdate | null | undefined): boolean {
  if (!live) return false;
  return (live as LiveUpdate & { session_tape?: unknown }).session_tape != null;
}

/**
 * The canon predicate, moved verbatim from `sessionTapeStanding.ts:54-60` — behaviour byte-identical,
 * return type narrowed to the brand.
 *
 * Deliberately NOT `genuineIsLive`: that one does not check `market_session`, so it reads `true` while
 * the venue is closed and the wire's `live` flag is stale-but-true — a combination `apps/api/src/
 * routes/stream.rs` makes reachable from the real wire, not merely from a fixture. Deliberately NOT
 * `numbersActive`/`displayActive`: those answer "should figures show a moving number at all" (true
 * during session-tape replay, by design), which is strictly broader than "is this the live stream".
 */
export function isDeliveringLive(live: LiveUpdate | null, streamOffline: boolean): LiveClaim {
  if (hasSessionTape(live)) return NOT_LIVE;
  if (streamOffline) return NOT_LIVE;
  if (!live) return NOT_LIVE;
  if (live.market_session === 'closed') return NOT_LIVE;
  return claim(live.live === true);
}

/**
 * "Live AND this value is present", preserving the brand. THE REASON THIS EXISTS: hand-written
 * `&& value != null` chains at call sites are exactly how the extra expressions were born
 * (`LiveTape.tsx:161,173,189` each write one today). Composing here keeps one answer.
 */
export function andPresent(base: LiveClaim, value: unknown): LiveClaim {
  return claim(Boolean(base) && value != null);
}
```

**Step 2 — the runtime spec.** `apps/dashboard/src/app/shared/liveness/liveClaim.spec.ts` asserts
behaviour is byte-identical to the shipped `isDeliveringLive` across the six inputs
(`session_tape` present · `streamOffline` · `live === null` · `market_session === 'closed'` ·
`live.live === false` · the one true arm), and that `andPresent(x, null)` is `false` while
`andPresent(NOT_LIVE, 5)` is `false`. Run → **fails** (module does not exist). Implement step 1 → passes.

**Step 3 — the COMPILE-TIME proof (invariant 1).** Create
`apps/dashboard/src/app/shared/liveness/liveClaim.typeproof.spec.ts`. This is the mechanism, not the
`expect`: **TS2578 fires the day the brand is removed**, and `nx test` cannot see it — only
`npm run typecheck` can, which is why criterion 56 records its exit code separately.

```ts
/**
 * INVARIANT 1 (SPEC §7) — the brand is a COMPILE-TIME guarantee. There is no runtime `expect` that can
 * see it, so the proof is `@ts-expect-error`: if the brand is ever removed (or `LiveClaim` widened back
 * to `boolean`), these lines stop being errors and TypeScript raises **TS2578 "Unused
 * '@ts-expect-error' directive"** — `npm run typecheck` goes red. `nx test` stays green, which is
 * exactly why constraint 3 records the two exit codes separately.
 */
import { describe, expect, it } from 'vitest';
import { isDeliveringLive, NOT_LIVE, type LiveClaim } from './liveClaim';

function takesClaim(_c: LiveClaim): void {
  /* the shape every liveness prop now has */
}

describe('LiveClaim — nominal brand', () => {
  it('a raw boolean cannot inhabit a liveness prop', () => {
    // @ts-expect-error a hand-written `true` is not a claim produced by the canon predicate
    takesClaim(true);
    // @ts-expect-error a `&&` chain is not a claim — this is how the extra expressions were born
    takesClaim(Boolean(1) && 2 != null);
    // The two legal producers compile with no directive:
    takesClaim(NOT_LIVE);
    takesClaim(isDeliveringLive(null, false));
    expect(true).not.toBe(false); // keeps vitest from reporting an empty test body
  });
});
```

**MUTATION PROOF (non-vacuous).** Temporarily change `export type LiveClaim = boolean & …` to
`export type LiveClaim = boolean` and run `npm run typecheck`. It must fail with **TS2578** on the two
directives above. Record the exact error text in the build report; revert. If it does **not** fail, the
proof is vacuous and the task is not done.

**Step 4 — re-export from the canon site.** In `apps/dashboard/src/app/pages/ticker/sessionTapeStanding.ts`,
**delete** the local `isDeliveringLive` body (`:54-60`) and replace it with a re-export, keeping the
existing doc comment above it so the rationale survives:

```ts
// The predicate moved to `shared/liveness/liveClaim.ts` (PLAN U-2 — `Widget.tsx` and `OrdersWidget.tsx`
// consume the brand and cannot import from `pages/`). Behaviour is byte-identical; the return type is
// now the nominal `LiveClaim`. Re-exported here so every shipped importer keeps its path.
export { isDeliveringLive, NOT_LIVE, andPresent, type LiveClaim } from '@/shared/liveness/liveClaim';
```

`connectionState.ts:32` imports `isDeliveringLive` from `../sessionTapeStanding` and uses it in a boolean
`if` at `:86` — **no edit needed**, a branded boolean is still a boolean at a condition. Update the module
doc at `:8-13` to name the new home.

**Step 5 — re-type the claim props.**

- `apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.tsx:169` —
  `live?: boolean;` → `live?: LiveClaim;` (import the type from `@/shared/liveness/liveClaim`). The body
  at `:295-296` (`figureState = live ? 'live' : 'default'`, `showDot = Boolean(live)`) is unchanged.
- `apps/dashboard/src/app/shared/ui/Widget/Widget.tsx:58` — `live?: boolean;` → `live?: LiveClaim;`.

**Step 6 — `OrdersWidget.tsx:144` — the one call site that is NOT a liveness claim.** It passes
`live={watchingAny}`, a *watch* fact about open orders, not a delivering-stream fact. Laundering it through
the brand would be a fabrication — the exact thing the brand exists to stop. Give it its own prop instead;
**nothing renders differently**, because both props drive the same `widgetLivePulse` declaration that
already lives in `Widget.tsx` (`single-motion-moment.spec.ts:41`):

In `Widget.tsx`, beside `live`:

```ts
  /**
   * A WATCH pulse — orders watching for a live cross (`OrdersWidget.tsx:144`). Deliberately NOT
   * `live`: it is not a delivering-stream claim, and branding it would launder a different fact
   * through the one predicate (SPEC §2.1). Drives the same `widgetLivePulse` declaration, so this
   * split changes no pixel. Pre-existing rule-22 question (does a watch pulse need a live stream?)
   * is UNCHANGED by this phase and is recorded in the build report, not fixed here.
   */
  watch?: boolean;
```

and in `OrdersWidget.tsx:144`, `live={watchingAny}` → `watch={watchingAny}`.

**Step 7 — the source scan (invariant 1, second half).** Add to
`apps/dashboard/src/app/shared/liveness/liveClaim.spec.ts` a mutation-guarded `?raw` scan keeping
`genuineIsLive` and the store's `isLive` **out of presentational desk files**, so a *new* file cannot invent
a fifth expression. Follow the `arc.spec.ts` importer-set idiom:

```ts
const DESK_SOURCES = import.meta.glob(
  [
    '/src/app/pages/ticker/widgets/**/*.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** Presentational desk files may not name a second liveness expression. */
const BANNED = [/\bgenuineIsLive\b/, /\btape\s*\.\s*isLive\b/, /\bisLive\s*&&/];

/**
 * EXEMPT — the ONE host that reads the store, with its reason. Live-checked below: an entry whose
 * file no longer matches red-builds, so a stale exemption cannot quietly widen the fence.
 */
const EXEMPT: Record<string, string> = {
  'pages/ticker/widgets/structure-hero/StructureHeroPanel.tsx':
    'the single store read for the hero (SPEC §2.1) — it derives the claim and passes it down as props',
};
```

with (a) an anti-vacuity assertion (`Object.keys(DESK_SOURCES).length > 20` and the glob contains at least
one `live-tape/` and one `read-strip/` path), (b) a **mutation guard** proving a planted
`const x = tape.isLive && y;` string is caught and a clean source is not, and (c) the stale-entry liveness
assertion. **Note the sequencing:** the EXEMPT path is created by FE-6; until then seed it with the shipped
`pages/ticker/widgets/live-tape/LiveTape.tsx` and re-point it in FE-6 (**re-point, never delete**).

**Step 8 — run.** `cd apps/dashboard && npx vitest run src/app/shared/liveness` → exit 0.
`npm run typecheck` → exit 0. `npx nx test @convexa/dashboard` → exit 0 (this is where a stray
`live={true}` elsewhere surfaces). Commit.

**Reviewer probe:** does `grep -rn "live=\{" apps/dashboard/src/app --include=*.tsx` return **only** call
sites whose expression is `isDeliveringLive(...)`, `andPresent(...)` or `NOT_LIVE`? And does
`npm run typecheck` — not `nx test` — go red when the `& { readonly [LIVE_CLAIM]: … }` intersection is
deleted?

---

## FE-2 — The retention latch (owner ruling 2's debt): value **and** boolean

**Owns:** new `apps/dashboard/src/app/pages/ticker/widgets/_kit/useStreamLatch.ts` · new
`apps/dashboard/src/app/pages/ticker/widgets/_kit/useStreamLatch.spec.ts` ·
`apps/dashboard/src/app/pages/ticker/widgets/live-tape/LiveTape.tsx` ·
`apps/dashboard/src/app/pages/ticker/widgets/live-tape/LiveTape.spec.tsx` ·
`apps/dashboard/src/app/pages/ticker/widgets/_kit/copy.ts` ·
`apps/dashboard/src/app/pages/ticker/widgets/_kit/copy.spec.ts`
**Depends on:** FE-1 · **Independent:** no
**Spec:** §2.2, §4.6 · **Criteria:** 12 (SB), 13 (SB), 14 (SB), 15, 16 (**BLOCKED — GATE Z**, see the STOP
block), 17, 18

**The defect, measured.** `useFlashOnChange.ts:44` writes `prev.current = value` **before** the null guard
at `:46`, so a drop destroys the last non-null value; nothing holds it today. `LiveTape.tsx:96` composes
`flipValue = (numbersActive ? live?.gamma_flip : null) ?? m.gamma_flip` and `:190` passes
`offline={tileOffline ? { retained: flipValue != null } : null}` — its own comment at `:180-184` says so in
terms — so `FigureCell.tsx:258-266` prints `offline · last known` over a **structure** number that never
came off the stream. That is criterion 14's violation, shipped.

**Four things this task must not do** (each is a named non-goal, §2.2):

1. **Do not reorder `useFlashOnChange.ts:44`.** Moving that write after the guard makes `prev.current`
   survive a drop, so the first payload after a reconnect flashes against a pre-drop value — a fabricated
   tick on a figure whose whole purpose is honesty. The latch composes **beside** the flash hook.
   `LiveTape.tsx:93` already feeds the flash hook the **raw** stream value while `:96` composes a separate
   render value, so the "flash reads raw, render reads latched" split exists today.
2. **Do not fix only the boolean.** `FigureCell.tsx:267-275` (offline arm B) renders
   `<ValueGlyph value={value} … />` — it renders **whatever the caller passes**, in Sans at 15px. Fixing
   `:190` while `:96` and `:188` still read `?? m.gamma_flip` leaves arm B rendering the bundle flip as a
   15px Sans pseudo-literal under an `offline` caption on a cell labelled live. **Value and boolean both
   come from the latch; neither reads `m.gamma_flip`.**
3. **Do not swap the structure flip in under the live label** (ux's withdrawn R1 substitute). It is a third
   fabrication — the two flips are different measurements by construction (`PROJECT_CONTEXT.md` §3) — and it
   deletes ruling 2's arm A, which `DESIGN_SYSTEM.md:168` mandates.
4. **Do not key `retained` on the rendered value** (`LiveTape.tsx:190` today).

**Step 1 — the hook.** `apps/dashboard/src/app/pages/ticker/widgets/_kit/useStreamLatch.ts`:

```ts
/**
 * `useStreamLatch` — holds the last non-null value that arrived ON THE STREAM (SPEC §2.2, owner
 * ruling 2's debt to this phase). It owns BOTH the rendered value and the `retained` boolean, because
 * `FigureCell.tsx:267-275` renders whatever the caller passes: a `retained` fix without a value fix
 * leaves the REST bundle's number under an `offline · last known` caption (criterion 14).
 *
 * It composes BESIDE `useFlashOnChange`, never through it, and `useFlashOnChange.ts:44` is NOT
 * reordered (non-goal, SPEC §2.2): moving that write after the null guard would make the first payload
 * after a reconnect flash against a pre-drop value — a fabricated tick.
 *
 * RESET TOKEN. One token gives both clears ruling 2 requires: route symbol AND replay-armed state.
 * Compose it at the call site as `` `${routeSymbol}|${replayArmed ? 'replay' : 'live'}` ``.
 */
import { useRef } from 'react';

export interface StreamLatch {
  /** The last non-null STREAM value, or null when the latch is empty. Never a bundle value. */
  value: number | null;
  /** True iff the latch currently holds a value. The ONLY thing that licenses `· last known`. */
  retained: boolean;
}

/**
 * @param streamValue the value AS RECEIVED ON THE STREAM (`live?.gamma_flip`) — never a composed
 *   render value with a `?? bundle` fallback in it.
 * @param resetToken route symbol + replay-armed state; a change empties the latch.
 */
export function useStreamLatch(
  streamValue: number | null | undefined,
  resetToken: string,
): StreamLatch {
  const held = useRef<number | null>(null);
  const token = useRef(resetToken);

  if (token.current !== resetToken) {
    token.current = resetToken;
    held.current = null; // both clears ruling 2 requires, from one token
  }
  if (streamValue != null && Number.isFinite(streamValue)) {
    held.current = streamValue;
  }
  return { value: held.current, retained: held.current != null };
}
```

*(Ref writes during render are intentional and safe here: the value is derived from props, the hook is
idempotent for the same inputs, and a `useEffect` would render one frame of stale data on the drop —
exactly the frame the criterion is about. Note this in the reviewer probe.)*

**Step 2 — the failing hook spec.** `useStreamLatch.spec.ts`, with `renderHook`:

| case | assertion | criterion |
|---|---|---|
| first stream value `248` | `{ value: 248, retained: true }` | 12 |
| then `null` (drop) | still `{ value: 248, retained: true }` | 12 |
| never any value, then `null` | `{ value: null, retained: false }` | 13 |
| `resetToken` changes symbol | `{ value: null, retained: false }` | 16a |
| `resetToken` changes to replay-armed | `{ value: null, retained: false }` | 16b |
| `NaN` / `Infinity` in | ignored, latch unchanged | — |

Run → **fails**. Implement step 1 → passes. Commit.

**Step 3 — the third subtitle arm (criterion 15).** In `_kit/copy.ts`, beside `:531-533`, add the **new**
constant — the two shipped arms stay byte-identical:

```ts
/**
 * (v2) The NO-TICKS-RETAINED arm. `LiveTape.tsx:110` selects on the stream flag ALONE today, so the
 * retention claim in LIVE_TAPE_SUBTITLE_OFFLINE is made unconditionally on every drop — including the
 * drop where nothing was ever retained. Same two-arm discipline owner ruling 2 sets for values.
 */
export const LIVE_TAPE_SUBTITLE_OFFLINE_EMPTY =
  'Stream offline · no ticks retained · structure levels stay current';
```

Add a `copy.spec.ts` case pinning all three strings **verbatim** and asserting the three are pairwise
distinct.

**Step 4 — rewire `LiveTape.tsx`.** Exact edits:

- **`:96`** — replace the fallback composition. `flipValue` no longer reads `m.gamma_flip`:

```ts
  // The latch owns BOTH halves (SPEC §2.2). `live?.gamma_flip` is the RAW STREAM value — the same one
  // `:93` feeds the flash hook — never the `?? m.gamma_flip` composition that produced criterion 14's
  // violation. The bundle's structure flip is the LADDER's row (FE-5) and is not adopted here.
  const flipLatch = useStreamLatch(
    numbersActive ? (live?.gamma_flip ?? null) : null,
    `${m.ticker.toUpperCase()}|${st ? 'replay' : 'live'}`,
  );
  const flipValue = flipLatch.value;
```

- **`:116`** — the `(live)` suffix moves from the caption to the **label** (criterion 18). Delete
  `gammaLabel = isLive ? 'Gamma flip (live)' : 'Gamma flip'` and write:

```ts
  // (v2) The label names the DERIVATION, not the connection state (criterion 18). The old ternary
  // made the label byte-identical to the ladder's `Gamma flip` row on a drop, while the two cells
  // hold two different numbers — and the caption slot cannot carry the distinction, because
  // `FigureCell.tsx:251,260,269` OVERWRITES `effectiveCaption` to `offline · last known` / `offline`
  // in the offline arms, discarding sub-copy on exactly the drop where it is most needed.
  let gammaLabel = 'Gamma flip · live';
```

  and inside the `if (st)` block at `:121`, `gammaLabel = 'Gamma flip · session tape';`. **Both arms name a
  derivation and neither changes with connection state** — `· live` holds through live *and* drop; the only
  switch is live-stream vs session-tape derivation, which is what "derivation" means here (§4.6).

- **`:188-190`** — value and `retained` both from the latch:

```ts
          value={flipValue != null ? `$${flipValue}` : '—'}
          live={andPresent(isDeliveringLiveNow, live?.gamma_flip)}
          offline={tileOffline ? { retained: flipLatch.retained } : null}
```

- **`:110`** — the three-arm subtitle:

```ts
  let subtitle = numbersActive
    ? LIVE_TAPE_SUBTITLE_LIVE
    : anyLatchHeld
      ? LIVE_TAPE_SUBTITLE_OFFLINE
      : LIVE_TAPE_SUBTITLE_OFFLINE_EMPTY;
```

  where `anyLatchHeld` is the OR of every latch this widget owns (today: `flipLatch.retained`; net flow and
  spread gain their own latches in the same edit so criterion 12 covers them too — each is a
  `useStreamLatch` on its raw stream value with the same reset token).

- **`:161`, `:173`** — replace the hand-written `&&` chains with `andPresent(isDeliveringLiveNow, …)`
  (FE-1's composition helper; the chains are the fifth-expression risk §2.1 names).

**Step 5 — the component tests** in `LiveTape.spec.tsx`, each keyed on DOM facts, not the hook:

| # | fixture | assertion |
|---|---|---|
| 12 | stream delivers `gamma_flip: 248`, then `streamOffline: true` | the flip cell has `data-figure-state="offline-retained"`, renders `$248`, and its `[data-testid="stat-secondary"]` reads exactly `offline · last known` |
| 13 | stream never carried `gamma_flip`, then `streamOffline: true` | `data-figure-state="offline-bare"`, value `—`, caption exactly `offline`, and **`last known` appears nowhere** in the widget's `textContent` |
| 14 | as 13, with `m.gamma_flip = 250` in the bundle | `250` appears **nowhere** in the live-tape widget; `screen.getByTestId('live-tape').textContent` does not match `/last known/` |
| 15 | as 13 | widget subtitle is exactly `Stream offline · no ticks retained · structure levels stay current` |
| 15b | as 12 | widget subtitle is exactly `Stream offline · last known ticks · structure levels stay current` |
| 17 | value `248` delivered, then drop, then the same `248` restored | no flash class is applied on restore (the flash hook received `null` on the drop and the raw value on restore; `useFlashOnChange.ts:46` returns early on a null `before`) |
| 18 | live / drop / replay | label is `Gamma flip · live` in the first two and `Gamma flip · session tape` in the third, and is **never** the string `Gamma flip` (which is the ladder's row label — FE-5) |

**MUTATION PROOF (non-vacuous).** Poison `useStreamLatch` by restoring the old composition — change
`const flipValue = flipLatch.value;` back to `?? m.gamma_flip`. Criterion 14's test must go **red** naming
`250`. Then poison the boolean alone (`retained: flipValue != null`) and confirm criterion 13's test goes
red on the caption. Record both failure texts. If either passes under poison, the guard does not bite.

**Criterion 16 — BLOCKED.** Write the two provable rows as **16a** (symbol change: latch empty, cells render
the bare member with **no** pause mark because `tileOffline` is false, chip on the wordless placeholder) and
**16b** (replay arm: latch empty, cells render **F6** — full strength, no dot, no pause mark, no offline
caption). **Do not merge them into criterion 16's sentence and do not assert a pause mark in either.** Mark
row 16 `BLOCKED — GATE Z` in the build report with a pointer to this plan's STOP block.

**Reviewer probe:** does `LiveTape.tsx` still contain the substring `m.gamma_flip` anywhere? (It must not —
criterion 14.) And does the ref-write-during-render in `useStreamLatch` produce the latched value on the
**same** frame as the drop, rather than one frame later?

---

## FE-3 — The shared stroke table, the canvas's theme input, and the coupled exemption removal

**Owns:** new `apps/dashboard/src/app/shared/charts/structure-field/levelStrokes.ts` · new
`apps/dashboard/src/app/shared/charts/structure-field/levelStrokes.spec.ts` ·
`apps/dashboard/src/app/shared/charts/structure-field/StructureFieldCanvas.tsx` ·
`apps/dashboard/src/app/shared/charts/structure-field/structureFieldShared.ts` ·
`apps/dashboard/src/app/shared/charts/structure-field/types.ts` ·
`apps/dashboard/src/app/pages/ticker/widgets/gex-profile-chart/chart.tsx` ·
`apps/dashboard/src/app/shared/theme/hex-discipline.spec.ts`
**Depends on:** FE-1 · **Independent:** no
**Spec:** §2.7, §4.6 (P5), §9 item 5 · **Criteria:** 7, 52 (P5), 53 (P5)
**DELEGATED (P5) — reversal cost:** criteria 52 and 53 disappear and the canvas keeps its unconditional dark
fill. The stroke table itself is **not** P5 (it is canon 14 / criterion 7) and survives a reversal; only the
`palette` prop's second scheme and the light-mode review rows go.

**Measured today.** `StructureFieldCanvas.tsx:18-27` declares ten module-level hex literals; `:223`, `:237`
and `:434` fill with `INK` unconditionally; its only hook import is `useReducedMotion` (`:11`), so it has
**no theme input at all**. `structureFieldShared.ts:6-17` carries the same ten as `SF`. The header comment
at `:9` claims *"Theme literals match tokens.ts"* — prose standing in for a structural rule, the shape
`[structural-over-prose-enforcement]` exists to kill; it goes with the literals.

**The coupling is the point, not a surprise (§5, §9 item 5).** `hex-discipline.spec.ts:38-67` exempts
**three** files this phase de-hexes — `shared/charts/structure-field/StructureFieldCanvas.tsx`,
`shared/charts/structure-field/structureFieldShared.ts` and
`pages/ticker/widgets/chrome/TapePulseStrip.tsx` (the last one is FE-6's) — and `:110-118` asserts every
entry *"still exists AND still carries hex"*. **Deleting the literals while an entry stays FAILs that
liveness test.** Land the literals and the exemption entries in **one** commit.

**Step 1 — the table.** `levelStrokes.ts` exports **token keys, not colours**, keyed by ladder-row identity,
so ladder tick and field line cannot drift (criterion 7):

```ts
/**
 * The ONE stroke table (SPEC §2.7, canon 14). Keyed by LADDER-ROW IDENTITY and exporting TOKEN KEYS,
 * never colours: the React host resolves keys → colours via `useTheme()` / `extrasFor(theme)` and
 * passes a RESOLVED palette into the canvas as a prop. Drift becomes impossible because there is one
 * table — a second table for the ladder would make "one object" a coincidence that breaks on the first
 * token change (SPEC §2.7, rejected approaches).
 */
export type LadderRowId = 'callWall' | 'mid' | 'maxPain' | 'gammaFlip' | 'putWall';

/** A token KEY. The resolver below is the only place a key becomes a colour. */
export type StrokeTokenKey =
  | 'palette.success.main'
  | 'palette.error.main'
  | 'palette.text.secondary'
  | 'extras.gammaAmber'
  | 'extras.signal';

export const LEVEL_STROKES: Readonly<Record<LadderRowId, StrokeTokenKey>> = {
  callWall: 'palette.success.main',
  putWall: 'palette.error.main',
  gammaFlip: 'extras.gammaAmber',
  mid: 'extras.signal',
  maxPain: 'palette.text.secondary',
} as const;

/** The resolved palette handed to the canvas as a PROP — the canvas never reads a theme. */
export type LevelPalette = Readonly<Record<LadderRowId, string>>;
```

plus a `resolveLevelPalette(theme: Theme): LevelPalette` in the same module that switches exhaustively over
`StrokeTokenKey` with a `never` default arm.

**Step 2 — the failing spec.** `levelStrokes.spec.ts`:

- every `LadderRowId` has an entry (compile-enforced by `Record`, asserted at runtime for the reader);
- `resolveLevelPalette(theme)` and `resolveLevelPalette(lightTheme)` both return **five non-empty strings**
  and **differ in at least one member** (criterion 53's structural half — no scheme-invariant colour);
- **criterion 7's teeth:** a scan of `StructureFieldCanvas.tsx` and the ladder module finds **zero** hex
  literals outside the resolved-palette prop path, and the ladder's tick colours are read from the same
  `LevelPalette` object the canvas receives — asserted by identity, not by value equality;
- **mutation guard:** changing one key in `LEVEL_STROKES` changes both the resolved palette entry and the
  ladder tick in the same render — proven by rendering the ladder with a stub palette and asserting the tick
  carries the stub's string.

**Step 3 — the canvas gains a prop, not a hook.** In `types.ts`, extend `StructureFieldModel`'s host props
(not the model — the model is data): add to `StructureFieldCanvasProps` in `StructureFieldCanvas.tsx:29-38`:

```ts
  /**
   * The RESOLVED level palette (SPEC §2.7). The canvas paints to Canvas2D and cannot consume MUI `sx`,
   * so the host resolves token keys → colours with `useTheme()` / `extrasFor(theme)` and passes them
   * in. This is the theme input the file had none of (`:11` imported only `useReducedMotion`), and it
   * is what makes criterion 52 satisfiable — DELEGATED (P5).
   */
  palette: LevelPalette;
  /** The scheme's panel + body surfaces, same reason. Replaces the unconditional `INK`/`PANEL` fills. */
  surfaces: { ink: string; panel: string; raised: string; phosphor: string; steel: string };
```

Then, mechanically:

- delete `:18-27`'s ten `const` literals;
- replace every `INK` / `PANEL` / `RAISED` / `PHOSPHOR` / `STEEL` reference with `surfaces.*` — the
  unconditional fills at `:223`, `:237` and `:434` are the three criterion 52 turns on;
- replace `RED` / `GREEN` / `AMBER` / `SIGNAL` in the **level** paths (`:348-350`, `:358`, `:370-392`'s
  `markerDefs` colours) with `palette.putWall` / `palette.callWall` / `palette.gammaFlip` / `palette.mid`;
- the non-level decorative alphas (`:250-252` blooms, `:312-315` fill gradient, `:487-489` sweep,
  `:515` field lines, `:569-572` particles) take a **derived** alpha from the same palette entries via
  a local `withAlpha(hex, a)` helper in `levelStrokes.ts` — **not** a fresh literal;
- rewrite the header comment at `:9`: delete *"Theme literals match tokens.ts"* and state that the palette
  arrives as a prop.

Do the same to `structureFieldShared.ts`: `SF` is deleted and its consumers (`pages/lab/**`) take the
resolved palette. **`pages/lab/**` is out of this phase's product scope but is in the same importer graph** —
if a lab file cannot be converted cheaply, keep its `hex-discipline` exemption entry and say so in the build
report; **do not** delete an exemption whose file still carries hex.

**Step 4 — the host.** `chart.tsx`'s `GexProfileChart` (`:102-131`) already builds the model; add
`const theme = useTheme();` and pass `palette={resolveLevelPalette(theme)}` plus `surfaces={…}` to
`<StructureFieldCanvas>` at `:130`.

**Step 5 — the exemption removal, same commit.** In `hex-discipline.spec.ts:38-67` delete **only** the
entries whose files no longer carry hex. Run `npx vitest run src/app/shared/theme/hex-discipline.spec.ts`
**before** and **after**: before the deletion it fails with *"exempted but no longer carries hex"*, after it
passes. **Record both outputs** — that failure is the intended coupling (§5: *"Nothing is partially
applied"*), and showing it is how a reviewer knows the coupling is live.

**Reviewer probe:** does `rg -n '#[0-9A-Fa-f]{6}' apps/dashboard/src/app/shared/charts/structure-field`
return zero lines outside comments? And does `hex-discipline.spec.ts`'s EXEMPT list still carry an entry for
every file that *does* still hold hex (no stale entry, no missing entry)?

---

## FE-4 — The extracted pure paint step, the live gates, and the motion mechanism that actually bites

**Owns:** new `apps/dashboard/src/app/shared/charts/structure-field/paintStep.ts` · new
`apps/dashboard/src/app/shared/charts/structure-field/paintStep.spec.ts` · new
`apps/dashboard/src/app/shared/charts/structure-field/recordingContext.ts` ·
`apps/dashboard/src/app/shared/charts/structure-field/StructureFieldCanvas.tsx` ·
`apps/dashboard/src/app/shared/theme/single-motion-moment.spec.ts` ·
`apps/dashboard/src/app/shared/hooks/useFlashOnChange.spec.ts` (behavioural half)
**Depends on:** FE-3 · **Independent:** no
**Spec:** §2.1, §7 ("How the motion rule actually bites") · **Criteria:** 20, 22 (review), 57 (SB)
**This is the phase's largest single mechanical cost** — a ~460-line rAF closure (`:164-839`) holding
cross-frame mutable state (`particles`, `midTrail`, `spawnAcc`, `lastT`, `structureDirty`, `structureKey`)
must move into an explicit frame-state object.

**Two things a build lane will hit and must not re-derive.**

1. **The level strokes are painted into an OFFSCREEN buffer, not per frame.** `paintStructure` (`:206-423`)
   writes to `off`/`offCtx` and runs only when `structureDirty` (`:446-449`); the per-frame `paint` blits it
   at `:452-454`. So criterion 20's *"non-zero level strokes"* is **unobservable** on a recording context
   that only sees the frame path. **The extraction must expose both steps** and the test must drive both
   into one recorder:

   ```ts
   export function paintStructureStep(m: StructureFieldModel, ctx: Ctx2D, geom: Geometry, palette: LevelPalette, surfaces: Surfaces): void
   export function paintFrameStep(m: StructureFieldModel, ctx: Ctx2D, geom: Geometry, frame: FrameState, now: number, reduced: boolean, palette: LevelPalette, surfaces: Surfaces): void
   ```

   `FrameState` is the explicit object replacing the closure: `{ particles: Particle[]; midTrail: MidSample[]; spawnAcc: number; lastT: number }`.

2. **Three motions are gated on `!reduce` alone today and must gain the `m.live` gate**, or criterion 20 is
   unsatisfiable against a correct implementation:

   | motion | today | required |
   |---|---|---|
   | sweep gradient (`:484-492`) | `if (!reduce)` | `if (!reduce && m.live)` |
   | particles (`:522-577`) | `if (!reduce)` | `if (!reduce && m.live)` |
   | warped field-line drift (`:495-519`) | always runs; `reduce` only damps `amp` | skipped entirely when `!m.live`; static frame (`amp` at its `reduce` value) when `reduce` |
   | mid trail + beam (`:579-606`) | already `!reduce && m.live` | unchanged |

   The **level strokes, wall lines and flip line stay painted** (they are in `paintStructure`, which never
   consults `m.live`) — which is exactly what makes criterion 20's four-clause assertion the honest split of
   the withdrawn "byte-identical" sentence.

**Step 1 — the recording fake 2D context.** `recordingContext.ts`:

```ts
/**
 * A recording fake `CanvasRenderingContext2D` (SPEC §7). `single-motion-moment.spec.ts:54-55` matches
 * only LITERAL `@keyframes <name>` text, so a Canvas2D rAF loop declares nothing it can see — the
 * drift, sweep, particles and trail are invisible to the entire spec. THIS is the enforcement for
 * them: drive the pure paint step and count what was drawn.
 *
 * Records the calls criterion 20 is keyed on and nothing else — a recorder that captures everything
 * makes the assertions unreadable and the failures unattributable.
 */
export interface Recording {
  arcs: number;                 // particle draws
  gradientFills: number;        // sweep + well fills (createLinearGradient → fillStyle → fillRect)
  strokes: Array<{ style: string; from: [number, number]; to: [number, number] }>;
  trailPoints: number;          // lineTo calls inside the trail path
}
export function recordingContext(): { ctx: CanvasRenderingContext2D; rec: Recording };
```

**Step 2 — the failing spec.** `paintStep.spec.ts`, four assertions per criterion 20 plus the reduced-motion
twin (criterion 22's automatable half; the visual half stays `review`):

```ts
it('live: false — trail, particles and sweep STOP; level strokes still paint', () => {
  const { ctx, rec } = recordingContext();
  const frame = emptyFrameState();
  paintStructureStep(modelWith({ live: false }), ctx, GEOM, PALETTE, SURFACES);
  paintFrameStep(modelWith({ live: false }), ctx, GEOM, frame, 1000, false, PALETTE, SURFACES);

  expect(rec.trailPoints).toBe(0);
  expect(rec.arcs).toBe(0);
  expect(rec.gradientFills).toBe(0);
  // The four structure strokes still paint — put wall, call wall, spot, flip.
  expect(rec.strokes.filter((s) => s.style === PALETTE.putWall).length).toBeGreaterThan(0);
  expect(rec.strokes.filter((s) => s.style === PALETTE.callWall).length).toBeGreaterThan(0);
  expect(rec.strokes.filter((s) => s.style === PALETTE.gammaFlip).length).toBeGreaterThan(0);
});

it('ANTI-VACUITY: live: true produces every one of them', () => {
  // Without this, the row above passes against a paint step that draws NOTHING at all.
  const { ctx, rec } = recordingContext();
  const frame = emptyFrameState();
  const m = modelWith({ live: true, liveMid: 250 });
  paintStructureStep(m, ctx, GEOM, PALETTE, SURFACES);
  for (let t = 0; t < 6; t++) paintFrameStep(m, ctx, GEOM, frame, 1000 + t * 16, false, PALETTE, SURFACES);
  expect(rec.trailPoints).toBeGreaterThan(0);
  expect(rec.arcs).toBeGreaterThan(0);
  expect(rec.gradientFills).toBeGreaterThan(0);
});

it('reduced: true — same stop set as live: false, level strokes intact', () => { /* … */ });
```

**The anti-vacuity case is not optional.** A pure-zero assertion is satisfied by a no-op; phase 1 shipped two
`expect(true).toBe(true)` bodies under a "MUTATION PROOF" heading, and this is the shape that prevents the
repeat (criterion 57).

**MUTATION PROOF (non-vacuous).** Poison by deleting `&& m.live` from the sweep gate. The `live: false` case
must go red on `gradientFills`. Repeat for particles (`arcs`) and drift. Record all three failure texts.

**Step 3 — the extraction.** Move `paintStructure`'s body and `paint`'s body into `paintStep.ts` as pure
functions taking `(model, ctx, geom, frame, now, reduced, palette, surfaces)`; `StructureFieldCanvas.tsx`'s
`useEffect` keeps only: canvas/DPR/layout setup, the `FrameState` object, the `structureKey`/dirty check
(`:440-449`), the blit, the rAF scheduling and the listeners. **Behaviour must not change** — run
`npx vitest run src/app/shared/charts/structure-field` before and after and confirm
`StructureFieldCanvas.spec.tsx` and `markerLayout.spec.ts` stay green at the same counts.

**Step 4 — `single-motion-moment.spec.ts`, honestly.** Add **no** name to `KEPT_KEYFRAMES` (this phase adds
zero keyframes; the set-equality assertion is what proves it — global constraint 5). Instead:

- extend the file's doc comment to record **both** blind spots verbatim (a rAF loop declares no keyframe;
  `useFlashOnChange.ts:71-74` mints a dynamic name `:58` deliberately exempts) and to **point at**
  `paintStep.spec.ts` as the enforcement for the first;
- add the second half in `useFlashOnChange.spec.ts`: with `active: false` **or** `reduced`, the hook produces
  **no** flash state (`useFlashOnChange.ts:45`), and an in-flight flash is cleared when either flips
  (`:57-59`). Mutation-guard it by removing `!active` from `:45` and confirming red.

**Reviewer probe:** does `paintStep.spec.ts` contain the anti-vacuity `live: true` case, and does the
`live: false` case assert **non-zero** level strokes (not merely "some strokes")? A recorder that counts all
strokes together would pass with the walls deleted and the sweep left running.

---

## FE-5 — The level ladder: five rows, closed union, the anchor, and D-14's literal

**Owns:** new `apps/dashboard/src/app/pages/ticker/widgets/level-ladder/ladderModel.ts` · new
`ladderModel.spec.ts` · new `LevelLadder.tsx` · new `LevelLadder.spec.tsx` · new `LadderFoot.tsx` ·
new `index.ts` (all under `apps/dashboard/src/app/pages/ticker/widgets/level-ladder/`)
**Depends on:** FE-1, FE-3 · **Independent:** no
**Spec:** §2.3, §4.1, §4.3, §4.6 · **Criteria:** 1, 2, 3, 4 (review), 5 (D-14), 6 (review), 7, 8 (SB), 23 (P1)
**DELEGATED (D-14) — reversal cost:** criterion 5's literal. `ABSENT_LEVEL` below is **one constant**;
reversing D-14 to `not provided` changes that one line and criterion 5's wording. Nothing else moves.

**Step 1 — the model, closed by construction.** `ladderModel.ts`:

```ts
/**
 * The level-ladder model (SPEC §2.3). EXACTLY FIVE ROWS, a closed five-member union, so a sixth row
 * is a COMPILE ERROR — not a runtime length check that a careless `.push` slips past.
 *
 * ORDERED BY COMPUTED PRICE, not by a fixed list: the levels can cross, and a put wall above the mid
 * is a real market state.
 *
 * THE DISTANCE ANCHOR IS THE LEVELS SPOT, NOT THE MID. All three council voices read this
 * independently and converged: `_kit/distanceToLevel.ts:11-14` anchors on `levelSpot(m) = m.gex_spot
 * ?? m.price`; `dealer-positioning/DealerPositioning.tsx:61` passes exactly that; `ai-rec/copy.ts:318`
 * labels `gex_spot` "levels spot, // NOT `spot` — the levels anchor is not the live display price".
 * Anchoring on the mid would silently change every distance the trader has read for months AND make
 * all four structure rows recompute on every tick — five live rows, which canon 14 forbids in the same
 * sentence the criterion was drawn from.
 */
import { NOT_LIVE, type LiveClaim } from '@/shared/liveness/liveClaim';
import type { NotANumber } from '@/shared/copy/notANumber';
import type { LadderRowId } from '@/shared/charts/structure-field/levelStrokes';
import { distanceToLevel, levelSpot } from '../_kit/distanceToLevel';

/**
 * D-14 (DELEGATED). ONE member for all five level absences, chosen by a rule the frontend can
 * evaluate — "the level field is absent or null" — because the wire carries NO discriminator:
 * `libs/api/src/generated/schema.ts:1687,1703,1705,1716,1748` are all optional AND nullable with no
 * companion reason field, and the hand-written client disagrees with its own schema
 * (`convexa.ts:212-215` declares three non-nullable while `convexa.spec.ts:366-367` fixtures two null),
 * so the TYPE cannot be evidence either. `—` is the MINIMUM-CLAIM member (`FigureCell.tsx:285` names
 * its state `empty`): it asserts less than `unavailable` (a cycle ran and failed) and less than
 * `not provided` (the feed omitted it — true for a missing key, FALSE for a present null, which this
 * wire permits). The attempted-vs-failed discriminator is booked as debt with phase 4 attached.
 * REVERSING D-14 IS THIS ONE LINE.
 */
export const ABSENT_LEVEL: NotANumber = '—';

/** The mid row's distance, and a null level's distance. Never a computed zero, never blank. */
export const ABSENT_DISTANCE: NotANumber = '—';

export interface LadderRow {
  id: LadderRowId;
  /** The exact words, unchanged from the grid this replaces (criterion 2) — the e2e readiness
   *  anchor `no-overflow.spec.ts:398` keys on `Call wall`. */
  label: 'Call wall' | 'Mid' | 'Max pain' | 'Gamma flip' | 'Put wall';
  price: string | NotANumber;
  distance: string | NotANumber;
  /** True on the MID ROW ONLY. Branded (FE-1) so no row can invent a sixth expression. */
  live: LiveClaim;
  /** A token key, never a colour (SPEC §2.7). */
  stroke: LadderRowId;
}

export interface LadderInput {
  callWall: number | null | undefined;
  putWall: number | null | undefined;
  maxPain: number | null | undefined;
  /** The STRUCTURE flip (REST, dotless) — never the live recompute (SPEC §2.3, "two gamma sources"). */
  gammaFlip: number | null | undefined;
  /** The tape mid, and the only live row. */
  mid: number | null | undefined;
  midLive: LiveClaim;
  /** The anchor the distances are measured from: `gex_spot ?? price`. */
  anchor: number | null;
}

export function buildLadder(input: LadderInput): [LadderRow, LadderRow, LadderRow, LadderRow, LadderRow] {
  const price = (v: number | null | undefined): string | NotANumber =>
    v != null && Number.isFinite(v) ? `$${v}` : ABSENT_LEVEL;

  /**
   * A null level's distance is `—` for the same reason the mid row's is: the distance is undefined
   * BECAUSE THE LEVEL IS, a predicate the frontend can evaluate directly. `distanceToLevel.ts:24-25`
   * already returns `null` when either input is missing, so this is a CALLER choice, not a change to
   * the helper. An empty cell in a column is indistinguishable from a render bug —
   * `[absent-is-not-none]` in the column axis (SPEC §4.3).
   */
  const dist = (v: number | null | undefined): string | NotANumber =>
    distanceToLevel(v, input.anchor) ?? ABSENT_DISTANCE;

  const rows: LadderRow[] = [
    { id: 'callWall', label: 'Call wall', price: price(input.callWall), distance: dist(input.callWall), live: NOT_LIVE, stroke: 'callWall' },
    { id: 'maxPain',  label: 'Max pain',  price: price(input.maxPain),  distance: dist(input.maxPain),  live: NOT_LIVE, stroke: 'maxPain' },
    { id: 'gammaFlip',label: 'Gamma flip',price: price(input.gammaFlip),distance: dist(input.gammaFlip),live: NOT_LIVE, stroke: 'gammaFlip' },
    { id: 'putWall',  label: 'Put wall',  price: price(input.putWall),  distance: dist(input.putWall),  live: NOT_LIVE, stroke: 'putWall' },
    {
      id: 'mid',
      label: 'Mid',
      price: price(input.mid),
      /**
       * NEVER a computed zero. A zero would assert the mid EQUALS the structure anchor, which it
       * usually does not — and `distanceToLevel.spec.ts:8` pins `distanceToLevel(250, 250) === 'at
       * spot'`, so a computed mid distance is ANCHOR DRIFT wearing the column's label: a different
       * quantity, not merely a zero.
       */
      distance: ABSENT_DISTANCE,
      live: input.midLive,
      stroke: 'mid',
    },
  ];

  // Sorted by COMPUTED price; rows with no price sink to the bottom in declaration order, keeping
  // "sorted by price" a true reading of what is on screen (criterion 1: a null level NEVER removes
  // a row — dropping one changes the row count and silently breaks the sort as a reading).
  const numeric = (r: LadderRow) => (r.price === ABSENT_LEVEL ? Number.NEGATIVE_INFINITY : Number(String(r.price).slice(1)));
  rows.sort((a, b) => numeric(b) - numeric(a));
  return rows as [LadderRow, LadderRow, LadderRow, LadderRow, LadderRow];
}
```

`LevelLadder.tsx` renders the five rows through `FigureCell` (`register="traced"`), plus an **exhaustive
switch with a `never` default arm** over `LadderRowId` for the tick colour, so a sixth row is a compile
error at two places (invariant 4).

**Step 2 — the failing spec.** `ladderModel.spec.ts` + `LevelLadder.spec.tsx`:

| criterion | assertion |
|---|---|
| 1 | five rows at every data state (all present · all null · three null · levels crossing with the put wall above the mid); the DOM has exactly five `[data-figure-state]` nodes inside the ladder |
| 2 | `screen.getByText('Call wall')` and `getByText('Put wall')` resolve — **the e2e anchor** (T2) |
| 3 | every non-mid row's distance is `distanceToLevel(level, gex_spot)`; with `gex_spot` absent it falls back to `price`; the **mid row's distance cell renders `—`**, never `at spot`, never `+$0 · 0.0% above`, never empty |
| 5 | a null `call_wall` keeps its row and label, renders `—` in the value cell **and** `—` in the distance cell, is never `$—`, never `0`, never `unavailable`, and the value node is `data-figure-state="empty"` in 15px Sans (`FigureCell.tsx:282-286`) |
| 7 | each row's tick carries the colour `resolveLevelPalette(theme)[row.stroke]` — by identity against the same object the canvas receives |
| 8 | exactly **one** `[data-testid="figure-live-dot"]` in the ladder, on the mid row, at every connection kind; zero when `midLive` is `NOT_LIVE` |
| 23 (P1) | the five level values, the tape trail values and the mid are present as **text** in the DOM (the ladder is the field's text equivalent) |

**MUTATION PROOF.** Poison `ABSENT_DISTANCE` on the mid row with `distanceToLevel(mid, anchor)` — criterion
3's test must go red naming the computed string. Poison the sort by returning the rows in fixed order —
criterion 1's crossing case must go red. Record both.

**Step 3 — the ladder foot (criterion 6).** `LadderFoot.tsx` re-houses **Vol-norm GEX** and
**Raw GEX (1% shock)** with their shipped tooltips copied **byte-for-byte** from
`DealerPositioning.tsx:122-143` (including the `unavailable` arm at `:126-128` and the
input-dependency tooltip at `:133`, which is one of the two cases where the frontend genuinely *can*
observe the reason). Criterion 6 is `review`; the copy equality is what a reviewer checks.

**Step 4 — the anchor is named once (criterion 4, review).** The ladder header renders
`` `distance from levels @ ${anchorText}` `` where `anchorText` is `$<gex_spot>` or, when absent, `$<price>`
— **one** statement, in the header, not per row.

**Reviewer probe:** with `gex_spot` absent and `price` present, does the header name the price it actually
used? And does a level whose value is `0` render `$0`, not `—`? (`0` is a legal level; only `null`/absent
takes D-14's literal.)

---

## FE-6 — The structure-field hero: one `Widget`, four presentational children, one store read

**Owns:** new `apps/dashboard/src/app/pages/ticker/widgets/structure-hero/StructureHeroPanel.tsx` · new
`StructureHeroPanel.spec.tsx` · new `TapeTrailRow.tsx` · new `index.ts` (all under
`.../widgets/structure-hero/`) · `apps/dashboard/src/app/pages/ticker/widgets/chrome/TapePulseStrip.tsx` ·
`apps/dashboard/src/app/pages/ticker/widgets/chrome/TapePulseStrip.spec.tsx` ·
`apps/dashboard/src/app/pages/ticker/widgets/chrome/index.ts` ·
`apps/dashboard/src/app/pages/ticker/widgets/gex-profile-chart/GexStrikeProfile.tsx` ·
`apps/dashboard/src/app/pages/ticker/widgets/gex-profile-chart/chart.tsx` ·
`apps/dashboard/src/app/pages/ticker/widgets/dealer-positioning/WallMagnetView.tsx` (moved) ·
`apps/dashboard/src/app/shared/charts/structure-field/StructureFieldCanvas.tsx` (the a11y wrapper only)
**Depends on:** FE-2, FE-4, FE-5 · **Independent:** no
**Spec:** §2.1, §2.5, §4.2, §4.4, §4.6, §5 · **Criteria:** 9 (SB), 10 (SB), 11 (review), 19 (SB), 20, 21
(review), 22 (review), 23 (P1), 24 (P1), 52 (P5)
**DELEGATED (P1) — reversal cost:** criteria 23 and 24. Row 23 is nearly free (the ladder already puts the
levels in the DOM); row 24 is the canvas's `role="img"` + `aria-label` + summary + `aria-describedby`
pointer to the ladder. A P1 reversal deletes the wrapper in step 4 and both rows.

**Step 1 — the panel host.** One `Widget` with four pure-props children. **Four peer panels are rejected**
(§2.5): they would give four independent `panel` container contexts inside one visual frame, four expand
dialogs and four selection rings.

```tsx
/**
 * The hero (SPEC §2.5). ONE `Widget`, four PRESENTATIONAL children:
 *   StructureFieldCanvas · LevelLadder · TapeTrailRow · StructurePathStrip
 *
 * SINGLE STORE READ (SPEC §2.1): this is the ONLY component in the hero that calls `useLiveTape()`.
 * It derives the branded claim once and passes it and the mid DOWN AS PROPS. That is the structural
 * reason the four regions are presentational children — not the aesthetic one. This file is the one
 * EXEMPT entry in FE-1's source scan.
 *
 * INNER BOUNDARY (SPEC §5): the `ErrorBoundary` wraps the CANVAS REGION ONLY. One boundary around the
 * whole hero would let a canvas fault blank the ladder — and the ladder is REST-only, shares no
 * failure mode with the paint path, and carries the phase's most load-bearing readout. Cost: two
 * boundaries in one panel, bought deliberately.
 */
```

Structure:

```tsx
<Widget id="structure-hero" title={symbol} subtitle={HERO_BASIS} info={HERO_INFO} span={2} bodyPad="none">
  <ErrorBoundary variant="widget" label="Structure field">
    <StructureFieldCanvas model={model} palette={palette} surfaces={surfaces} height={300} variant="ticker" />
  </ErrorBoundary>
  <LevelLadder rows={rows} anchorText={anchorText} />
  <TapeTrailRow mid={displayMid} structureMid={structureMid} claim={claim} latch={midLatch} />
  <StructurePathStrip symbol={symbol} samples={pathSamples} loading={pathLoading} error={pathError} basis={pathBasis} />
</Widget>
```

**Step 2 — the basis line (criterion 11, review), stated once.** `HERO_BASIS` is exactly:

```
levels are REST structure (as-of {age}) · the mid is tape
```

**Step 3 — the tape trail row: `TapePulseStrip`'s two fixes and the deleted word.** `TapePulseStrip.tsx`
becomes `TapeTrailRow`'s paint child (keep the file where it is; re-point `chrome/index.ts` and update
`TapePulseStrip.spec.tsx`). Three edits, each with its own reason:

- **`:33` — `isLive` gains the `live.mid != null` requirement its own `liveMid` already has** (criterion 10,
  SB). Today `:31-32` makes `liveMid` require `tape.live?.mid != null` while `:33` requires only
  `tape.isLive && tape.live?.live && !tape.streamOffline`, and `:34` renders
  `displayMid = liveMid ?? structureMid` — so when the stream is up but carries **no mid**, `:199,:204`
  print **`Live $<structureMid>`**: the word "Live" over the REST structure mid. Replace with the branded
  claim from the host: `const claim = andPresent(props.claim, props.mid);`.
- **`:71` and `:73` — the same fallback in the paint loop.** `:71` recomputes
  `displayMid = liveMid ?? structureMid` and `:73` pushes a trail point **every rAF frame
  unconditionally**, so the drawn trail can be composed of structure-mid samples. The trail pushes only when
  the claim holds and the latched mid is non-null; the same latch (FE-2) feeds both.
- **`:199` — the `Live` / `Mid` word is DELETED, not demoted** (§4.2, criterion 9's second clause).
  Rule 13's provenance mark is a **dot plus a visually-hidden word** (`FigureCell.tsx:129-148`), not a
  visible one, so "demote to a per-figure mark" deletes the visible word either way; the datum is the mid,
  which already receives exactly one mark inside the same frame at the ladder's mid row. Phase 1 deleted the
  neighbouring `tape-stream-state` node at `:207-211` as *"a SECOND page-scope liveness authority"* and left
  `{isLive ? 'Live' : 'Mid'}` standing at `:199`. **Deleting it removes no information:** with `:71`'s
  fallback gone (canon rule 22), `Mid` denoted a **basis fallback** describing a state that stops existing.
  The label becomes `Mid` unconditionally — a label, not a claim — beside the existing
  `Structure ${structureMid}` readout at `:219-221`, **unchanged**.
- **P5, same edit:** `TapePulseStrip.tsx:13-15`'s `INK` / `PANEL` / `SIGNAL` literals take the resolved
  surfaces/palette props from the host (FE-3's mechanism), and its `hex-discipline.spec.ts` exemption entry
  is removed **in the same commit** (the coupling in FE-3 step 5 applies to this third entry too).

**Trail captions (§4.6), two arms, verbatim:** `tape paused · trail frozen` when the trail holds samples;
`tape paused` alone when it never drew. The second arm exists so the caption never asserts a frozen trail
that was never drawn — the same two-arm discipline owner ruling 2 sets for values.

**Step 4 — the canvas gets a name and a summary (criterion 24, P1).** The canvas element at
`StructureFieldCanvas.tsx:847-862` currently carries only `data-testid`. Add, on the `<canvas>`:

```tsx
        role="img"
        aria-label={`Net dealer gamma by strike for ${model.symbol}`}
        aria-describedby={summaryId}
```

and, beside it, a visually-hidden `<p id={summaryId}>` naming what it plots, the levels it marks, and
pointing at the ladder as its tabular equivalent. **The design source already does this** —
`design/src/lib.mjs:296` emits `role="img" aria-label="Net dealer gamma by strike"` (**correcting
`decisions.md`, which cites `:293`**) — and the shipped canvas does not. **This phase creates the exposure**
by promoting an unlabelled canvas from one of thirteen widgets to the desk's primary instrument, so scoping
it out would be a regression *by this phase's promotion*.

**Not in scope, named debt:** a point-by-point text equivalent of the net-GEX **curve** — phase 4 (P1
part 3), booked in `BUILD_REPORT.md` with `file:line`. A per-strike textual rendering of a continuous curve
over a spot ±20% grid is a new surface with its own copy, container steps and 44px questions.

**Step 5 — the Field/Magnet toggle moves with the field.** Move `WallMagnetView.tsx` from
`dealer-positioning/` into `structure-hero/` and mount the shipped `ToggleButtonGroup`
(`DealerPositioning.tsx:70-88`, testids `dealer-view-toggle` / `dealer-view-levels` / `dealer-view-magnet`
preserved so FE-12's e2e re-point is a rename, not a rewrite) on the hero. **The preference stays ephemeral
component state** — persisting it would engage `[loss-free-durable-migration]`, which SPEC §8 declares
**not engaged**, and would add a durable client key the phase forbids.

**Step 6 — criterion 19 (SB) and 9 (SB).**

- 19: on a drop, the strip's static cells, the ladder's four structure rows and every quiet-band card render
  **identical text content** to their pre-drop render and none is dimmed. Assert with a captured
  `textContent` snapshot of each region taken before and after `streamOffline: true`, plus
  `expect(node).not.toHaveStyle({ opacity: '0.5' })` on the four structure rows.
- 9: exactly one connection chip in the viewport at both scroll positions (e2e, FE-12) **and** no
  free-standing liveness **word** anywhere in the hero — assert in jsdom that
  `getByTestId('structure-hero').textContent` matches neither `/\bLive\b/` nor `/\bOffline\b/` as a
  standalone word outside a `FigureCell` caption.

**Reviewer probe:** does exactly **one** component in `structure-hero/` call `useLiveTape()`? And with the
stream up and `live.mid === null`, does the readout render `Mid $<structureMid>` with **no** dot anywhere on
that number (criterion 10)?

---

## FE-7 — The read strip: eight fixed slots, each cell its own container

**Owns:** new `apps/dashboard/src/app/pages/ticker/widgets/read-strip/ReadStrip.tsx` · new
`ReadStrip.spec.tsx` · new `readStripModel.ts` · new `readStripModel.spec.ts` · new `index.ts` ·
`apps/dashboard/src/app/pages/ticker/widgets/iv-rank/IvRank.tsx`
**Depends on:** FE-1 · **Independent:** no
**Spec:** §2.4, §2.5, §4.1, §4.6 · **Criteria:** 8 (SB), 19 (SB), 25 (SB), 26, 27, 28, 50 (SB), 60

**Step 1 — eight fixed slots, no reflow.** The slot list is a closed tuple type so a ninth is a compile
error:

```ts
export type ReadStripSlot =
  | 'opportunity' | 'netDex' | 'ivHv' | 'ivRank'
  | 'volOi' | 'ivSkew' | 'termStructure' | 'offExchange';
export const READ_STRIP_SLOTS = [
  'opportunity', 'netDex', 'ivHv', 'ivRank', 'volOi', 'ivSkew', 'termStructure', 'offExchange',
] as const satisfies readonly ReadStripSlot[];
```

**Why fixed, not 7-or-8** (§2.4): the architect withdrew its own R2 self-revision at R3 and conceded pm's
position — the 7-or-8 fix repaired a fabricated cause by recreating `[absent-is-not-none]` in the **scroll
axis**: at 393px an absent cell and a cell that scrolled off the rail are indistinguishable, and unlike the
fabricated-cause problem that has **no repair inside the closed vocabulary**. Fixed slots have a repair;
variable cardinality does not.

**Step 2 — the seven decomposed cells + IV rank.** Values and tooltips copy **byte-for-byte** from
`DealerPositioning.tsx` (`netDex` `:144-150`, `ivHv` `:162-168`, `volOi` `:169-177`, `ivSkew` `:178-188`,
`termStructure` `:189-205`, `offExchange` `:206-219`, `opportunity` `:220-229`); `ivRank` comes from
`IvRank.tsx`. **That accounting is what makes deleting `DealerPositioning` reviewable** — twelve shipped
cells decompose with **zero orphans**: 3 to ladder rows (call wall, put wall, max pain), 2 to the ladder
foot (Vol-norm GEX, Raw GEX 1% shock), 7 here, and IV rank is the eighth.

**Step 3 — the empty off-exchange slot (criterion 26).** Today the cell is **conditional**
(`DealerPositioning.tsx:206`: `offExchange?.ratio_pct != null && (…)`). It becomes a **fixed slot**
rendering `NOT_PROVIDED` (`shared/copy/notANumber.ts:48`, glossed at `:9` as *"the feed did not send it"*):

```ts
// True when INCLUDE_DARK_POOL=false suppressed the object AND true when the best-effort computation
// failed — the two causes `PROJECT_CONTEXT.md` §5 makes indistinguishable at the frontend with an empty
// `apps/api` diff. It asserts NEITHER. `unavailable` would assert a cycle that ran and produced
// nothing — a claim the app cannot observe. No tenth member; rule 24's closure at nine holds, and
// `notANumber.ts:14-16` records the precedent ("THE TYPE ENFORCES CLOSURE; THE CALLER PICKS THE
// MEMBER") that makes a per-surface choice legitimate rather than sloppy.
value: offExchange?.ratio_pct != null ? `${offExchange.ratio_pct}%` : NOT_PROVIDED,
```

Criterion 27: the cell renders neutrally, states it is context only with no side, and **never** in the
success/direction register (`[dark-pool-context-only]`). Assert the cell carries no
`success`/`error` palette class and that its info text contains the shipped
*"Side/intent unknown — context only, not a directional signal."*

**Step 4 — term structure keeps its shipped three-way render (criterion 60), and that is not a second
vocabulary.** Copy `DealerPositioning.tsx:189-205` exactly:

| wire state | literal | why it is legitimate here |
|---|---|---|
| object **absent** (`:194`) | `unavailable` | the *cycle produced nothing* case — and the shipped tooltip already says so in words (`:201-203`) |
| object present, `points.length < 2` (`:196`) | `—` | a present object with a thin array is an **observable fact**, so the minimum-claim member is honest about it |
| otherwise (`:197`) | `m.term_structure.state` | the wire's closed label through a closed lookup |

Here the two absences **are** distinguishable, which is exactly why off-exchange — which has no
discriminator — collapses to one member. Criterion 28 is untouched: `.state` is the wire's closed label,
never re-derived from the scalar (`[digested-labels-not-raw-dump]`).

**Step 5 — the container-query hazard (§2.5).** `FigureCell.tsx:216-217` queries
`theme.containerQueries('panel').down(360)` / `.down(280)`, and CSS resolves `@container panel` against the
**nearest** ancestor bearing that name. `Widget.tsx:163` and `PanelContainer.tsx:16-17` are the only two
declarations in the app. **Declaring the name at the strip** would make the nearest named ancestor of all
eight ~140px cells the ~1280px panel body, so every cell would render at the 20px base and never step to 17
or 15 — **at any viewport**. It looks fine at desktop and merely looks wrong at 393. So:

```tsx
{READ_STRIP_SLOTS.map((slot) => (
  // Each cell is its OWN container context (SPEC §2.5). The shipped `PanelContainer` declares the SAME
  // name, NESTED — the nearest-ancestor rule does the work. NO edit to `FigureCell`'s query and NONE to
  // `type-floor.spec.tsx`'s assertion. Declaring `containerName: 'panel'` on the RAIL is rejected.
  <PanelContainer key={slot} sx={{ flex: '0 0 auto', minWidth: 140 }}>
    <FigureCell {...cellFor(slot)} />
  </PanelContainer>
))}
```

`[lane-check]` **jsdom does not evaluate container queries.** A unit test may assert the **declaration**
only; the stepping *behaviour* is provable in the browser or by review. **No criterion claims a jsdom proof
of stepping** — do not write one.

**Step 6 — the strip is a rail; the page is not (criterion 50, SB).** The rail carries
`overflowX: 'auto'` with `minWidth: 0` on its parent track; the page never scrolls sideways. Assert the
declaration in jsdom; the behaviour is FE-12's browser row.

**Step 7 — all eight cells are dotless (criterion 8, SB).** None is live-derived today, so the strip's
honest liveness state is **eight dotless cells and any dot in it is a defect**. Pass `live={NOT_LIVE}` at
every slot — FE-1's brand makes a stray `live={true}` a compile error, which is the structural half; the
census test is the runtime half.

**MUTATION PROOF.** Poison one slot with `live={andPresent(someClaim, 1)}` under a live fixture — the census
must go red. Poison the off-exchange slot with `'unavailable'` — criterion 26 must go red. Record both.

**Reviewer probe:** with the bundle carrying **no** `off_exchange` object at all, does the strip still render
**eight** `[data-figure-state]` nodes, with the eighth reading `not provided` and its neighbours still
showing their values (criterion 25)?

---

## FE-8 — Delete `DealerPositioning`, re-point every pin, prove zero orphans

**Owns:** **deleted** `apps/dashboard/src/app/pages/ticker/widgets/dealer-positioning/DealerPositioning.tsx`
+ `DealerPositioning.spec.tsx` + `index.ts` · `apps/dashboard/src/app/pages/ticker/widgets/index.ts` ·
`apps/dashboard/src/app/pages/ticker/widgets/_kit/copy.ts` (the `dealerPositioningSubtitle` re-point) ·
`apps/dashboard/src/app/pages/ticker/widgets/market-context/MarketContext.tsx` ·
`apps/dashboard/src/app/pages/ticker/widgets/dealer-flow-projection/DealerFlowProjection.tsx` ·
`apps/dashboard/src/app/pages/ticker/live-dot-census.spec.tsx` ·
`apps/dashboard/src/app/pages/ticker/ticker.risk.spec.tsx` ·
`apps/dashboard/src/app/pages/ticker/pos-params.spec.tsx` ·
`apps/dashboard/src/app/pages/ticker/ticker-invariants.spec.tsx` ·
`apps/dashboard/src/app/pages/ticker/ticker-hierarchy.spec.tsx` ·
`apps/dashboard/src/app/pages/ticker/ticker-age-basis.spec.tsx` ·
`apps/dashboard/src/app/pages/ticker/single-name-caveat.spec.tsx` ·
`apps/dashboard/src/app/shared/theme/steel2-contrast.spec.ts` ·
`apps/dashboard/src/app/shared/theme/hex-discipline.spec.ts`
**Depends on:** FE-5, FE-6, FE-7 · **Independent:** no
**Spec:** §1, §2.3 · **Criteria:** 2, 6, 8 (SB), 25 (SB)

**No deprecation window, no coexistence.** A parallel window leaves the twelve-tile grid in the tree — the
exact outcome the BRIEF culled — and two figure anatomies on one screen make the per-screen sign-off
meaningless.

**Step 1 — enumerate before deleting.** Run exactly, and reconcile against this plan's own measurement
(**19 non-generated files**, excluding `apps/dashboard/sourcemaps-private/**` which is build output):

```bash
cd /c/Dev/convexa
rg -n --glob '!sourcemaps-private/**' -e 'DealerPositioning' -e 'dealer-positioning' -e 'dealer-view-' -e 'WallMagnetView' apps | tee /tmp/dp-sites.txt
wc -l < /tmp/dp-sites.txt
```

**If your count differs, report the delta before editing** — do not silently sweep a different set.

**Step 2 — the zero-orphan ledger.** Before the delete, write into the build report a row per shipped cell:

| shipped cell (`DealerPositioning.tsx`) | destination |
|---|---|
| Call wall `:106-113` · Put wall `:114-121` · Max pain `:154-161` | ladder rows (FE-5) |
| Vol-norm GEX `:122-136` · Raw GEX (1% shock) `:137-143` | ladder foot (FE-5 step 3) |
| Net DEX `:144-150` · IV/HV `:162-168` · Vol/OI `:169-177` · IV skew `:178-188` · Term structure `:189-205` · Off-exchange `:206-219` · Opportunity `:220-229` | read strip (FE-7) |
| Field/Magnet toggle `:70-88` + `WallMagnetView` | hero (FE-6 step 5) |

**Twelve cells, zero orphans.** A cell without a destination row is a STOP.

**Step 3 — re-point, never delete, every pin.** For each of the 19 files: re-point the assertion at its
successor (`level-ladder`, `read-strip`, `structure-hero`) and keep the assertion's *teeth*.
`live-dot-census.spec.tsx` is the most load-bearing — `:180-199` renders LiveTape **and**
DealerPositioning together and counts `figure-live-dot` page-wide, and it is the test that would have caught
phase 1's GATE Q FAIL. Re-point it to render **LiveTape + LevelLadder + ReadStrip** together and keep the
"every connection kind" matrix (`:181`, `:238`, `:244`) intact. **Do not reduce its coverage while
re-pointing it** — that is the shape this whole phase exists to prevent.

**Step 4 — `_kit/copy.ts`'s `dealerPositioningSubtitle`** is re-pointed (renamed to the hero/strip basis
helper), not deleted, so its `copy.spec.ts` assertions survive.

**Step 5 — delete and run.** `npx nx test @convexa/dashboard` → exit 0, **at or above** the 2376-test
baseline for the enforcement set. `npm run typecheck` → exit 0 (this is where a missed import surfaces).

**Reviewer probe:** does `rg 'DealerPositioning' apps --glob '!sourcemaps-private/**'` return **zero** lines?
And does the ledger in step 2 account for all twelve cells with a `file:line` per row?

---

## FE-9 — The AI read: one total `(request, result) → ReadLayout` mapping, and the A1c annex

**Owns:** new `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/readLayout.ts` · new
`readLayout.spec.ts` · new `readLayout.render.spec.tsx` ·
`apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AiRecPanel.tsx` ·
`apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AiRecPanelBlocks.tsx` ·
`apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.tsx` ·
`apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts` ·
`apps/dashboard/src/app/pages/ticker/widgets/ai-rec/fixtures.ts`
**Depends on:** FE-1 · **Independent:** no
**Spec:** §2.6, §4.5, §4.6, §5 · **Criteria:** 29 (SB), 30 (SB), 31 (SB), 32 (SB), 33 (SB), 34 (SB),
35 (SB), 36 (SB), 37 (SB), 38 (SB), 39 (SB), 40 (review), 41, 42, 43 (SB), 44, 47, 58 (SB), 59
**DELEGATED (P2, P4, D-15) — reversal cost:** P2 reversal rewrites criterion 30 (amber text → amber pixels,
which is unsatisfiable against canon rule 6 — see below). P4 reversal removes `request failure` (A10), the
composition clarification and the three dispositions, deleting criteria 32–36, 41–43, 58, 59 and collapsing
`no_edge` back to an idle-only arm — **which is the factual error S2 pass 1 filed as Critical**. D-15
reversal *adds* a cooldown/cap annex over a pinned read: one more row in §2.6's table plus one criterion; the
A1c mechanism this task builds already exists, so it is not a rebuild.

**The shipped shape, read at source and confirmed.** `presentationPolicy.ts:4-19` declares **fifteen**
request states and `:20-26` **six** result states, and `deriveAiRecPresentation` (`:106-181`) produces a
**pair**, not a single enum. `:115-126` assigns `requestState` from one `??` chain; `:128-136` assigns
`resultState` from `produced && rec.strategy` alone. **Nothing in the function makes the two mutually
exclusive**, so the space the mapping must cover is the whole **15 × 7** grid (six result states plus
`null`), not a list of fifteen alternatives.

**Step 1 — the total mapping.** `readLayout.ts`:

```ts
/**
 * The ONE total mapping (SPEC §2.6). Exhaustive switches with a `never` default arm on EACH axis, so a
 * sixteenth request state or a seventh result state is a COMPILE ERROR at the mapping, not a silent
 * fall-through to `idle`.
 *
 * `ReadLayout` is a BODY PLUS ITS ANNEXES, not one name — that shape is not invented here: *stale* and
 * the full-analysis drawer already COMPOSE OVER a produced read, and the shipped host already renders
 * the produced body independently of the request axis (`AiRecPanel.tsx:205` computes `producedRec`
 * from `rec.status`/`rec.strategy` alone and `:387-388` mounts `<DecisionCard>` on that alone).
 *
 * NO NINE-MEMBER STATE ENUM IS INTRODUCED. It would be worse than useless in exactly the way the
 * six-member `NotANumber` union was at owner ruling 3: the eight powering reasons would not become
 * type errors, they would become a lossy `string`.
 */
export type BodyCase =
  | 'A1a' | 'A1b' | 'A2' | 'A3' | 'A4' | 'A6a' | 'A6b' | 'A7' | 'A8' | 'A10';
export type Annex = 'A5' | 'A9' | 'A1c';
export interface ReadLayout { body: BodyCase; annexes: Annex[] }

export function readLayoutFor(
  requestState: AiRecRequestState,
  resultState: AiRecResultState | null,
): ReadLayout
```

**Which axis picks the body**, fixed so the `never` arm never has to invent behaviour:

- `loading` (`:116`) and `signed_out` (`:117`) are **body-replacing** — the host suppresses the produced
  body under both (`AiRecPanel.tsx:387`: `signedIn && producedRec && !loading`) — so those two pick the body
  for **all seven** result values.
- For the other thirteen request states: `resultState ≠ null` picks the body from the **result** axis;
  `resultState === null` picks it from the **request** axis.

**What the request axis contributes on top of a produced body** (SPEC §2.6's table, all fifteen accounted
for):

| request state(s) | reachable with `resultState ≠ null`? | contribution |
|---|---|---|
| `loading`, `signed_out` | yes | body-replacing |
| `unavailable` + the seven response-key states (`key_unusable`, `key_rejected`, `model_not_in_catalog`, `model_unset`, `oauth_expired`, `oauth_unlinked`, `subscription_unavailable`) | **no** — `responseKeyState` returns non-null only when `rec.status === 'unavailable'` (`:102`), which makes `produced` false at `:108`; and the host passes `poweringReason: null` whenever `rec.status === 'produced'` (`AiRecPanel.tsx:176-181`) | **A10 never composes** |
| `missing_key` | **yes**, by one route only — `!inAppEnabled && !scenarioSelected` (`:122`), which does not read `rec` | the shipped powering CTA renders beside the produced read (`AiRecPanel.tsx:373-375` and `:387-388` are independent branches); **unchanged this phase** |
| `daily_cap` (`:123`), `cooldown` (`:124`) | yes | **nothing — shipped rendering, unchanged. DELEGATED (D-15).** |
| `no_edge` (`:125`) | yes | **the quiet-gate annex, A1c** |
| `idle` (`:126`) | yes | nothing — the ordinary produced read |

**Step 2 — the two `no_edge` arms (rows 58–59, the Critical S2 pass 1 caught).** `no_edge` is a **request**
state, produced at `:125` from `readinessGateState === 'no_fresh_edge'` **regardless of `rec.status`**, while
`resultState` is assigned independently at `:128-136`. So `(no_edge, fresh_trade)` is reachable and
`resultState` is **not** `null` — a user holding a produced, pinned trade whose conditions have since
tightened is in that pair **today**, and the shipped host renders the produced card
(`AiRecPanel.tsx:205,387-388`) while the gate note's only home never mounts (`:423` gates `ActionRegion` on
`!producedRec`; the note is `AiRecPanelBlocks.tsx:205-224`). **There is currently no visible sign anywhere on
the desk that the guardrails see no fresh edge.**

- **(i) `resultState === null` → A1b** — the *idle · quiet gate* body arm: everything A1a renders **plus**
  `No fresh edge right now` + its caption (`ai-rec/copy.ts:60-64`), the Mono `no_trade` stance line
  (`AiRecPanelBlocks.tsx:209`) and the `Ask anyway` control (`:216-218`, tooltip `copy.ts:89`).
- **(ii) `resultState ≠ null` → A1c** — the same note, caption and `Ask anyway`, rendered **in body beneath
  the read**, beside a mounted verdict, **without** A1b's Mono `no_trade` line.

**A1c drops the Mono `no_trade` line by rule, not by taste** (criterion 59). That literal is the guardrails'
stance standing in for a verdict that does not exist; where a real verdict **is** mounted, printing Convexa's
machine `no_trade` beside the model's `Trade · {bias}` in Archivo display puts two competing stances at the
top of one panel — the register collision canon rule 23 and criterion 42 exist to prevent.

**A1b and A1c are told apart by CONJUNCTION, never by the note** (criterion 33's second clause): both render
`No fresh edge right now`, so neither may be keyed on that string alone.
**A1b** = *the note **and** the Mono `no_trade` stance line **and** no mounted verdict*.
**A1c** = *the note **and** a mounted verdict **and** no Mono stance line*.

**The re-ask control in this state is `Ask anyway`, not refresh and not retry.** `:177` requires
`requestState === 'idle'`; `:169` is `(degraded && requestState === 'idle') || unavailableRetryGate`, which
is **not** idle-only in general — but under `no_edge` **both resolve false by construction**: `requestState`
is not `'idle'`, and `unavailableRetryGate` needs `'unavailable'`, which the same `??` chain makes
unreachable here. `:168` already enables `askAnyway` on `requestState === 'no_edge'` alone. **No policy
change; one render change.**

**A1c cannot collide with A6a/A6b, A8, A10, A2 or A7:** `requestState` is a single assignment from one `??`
chain, and `daily_cap` (`:123`) and `cooldown` (`:124`) are evaluated **before** `no_edge` (`:125`), so a
capped or cooling-down user is never in `no_edge` at all. That is what makes criteria 33 and 36 checkable
rather than aspirational.

**Step 3 — the three other homeless states (P4).**

| shipped state | disposition | shipped evidence |
|---|---|---|
| `superseded_inputs` (`:25`) | **the named state *stale***, a third non-synonymous member of the same in-body degraded strip; renders `SUPERSEDED_STRIP` (`copy.ts:228-229`) and **never** `staleStrip`'s or `staleBornStrip`'s words | `DecisionCard.tsx:321-338` already renders all three through **one** `data-testid="decision-degraded"` alert with three different lines; `presentationPolicy.ts:138-142` groups them as `degraded` |
| `incomplete_trade` (`:26`) | **produced (trade)** — a produced trade read that is not actionable as given; renders `incompleteAction` (`copy.ts:429-430`) in-body, offers no simulated entry, and **never** *produced (no trade)*, **never** *request failure* | `:134` sets it only when `produced && decision === 'trade' && missingPositionFields.length > 0`; `:172` already suppresses `reviewTrade`; `DecisionCard.tsx:371-382` already renders its line inside the `isTrade` branch |
| `unavailable` (`:19`) | **A10, request failure** — the copy **already ships** (`copy.ts:51-52`) | `presentationPolicy.ts:19` carries it as a shipped request state |

**Step 4 — the exhaustiveness proof (invariant 5).** `readLayout.spec.ts`:

- a table-driven walk of **all 15 × 7 = 105 pairs**, asserting `readLayoutFor` returns a defined
  `ReadLayout` for each and that the body is drawn from the axis the table above names;
- a **compile-time** proof: add a sixteenth member to a local copy of `AiRecRequestState` in a
  `@ts-expect-error` block and confirm the `never` arm errors. Mutation-proof it by deleting the `never`
  arm and confirming `npm run typecheck` goes red;
- **the runtime companion, which is the point:** a fixture at `(no_edge, fresh_trade)` proving the produced
  read **and** the annex both render. *A compile-time `never` arm alone cannot catch a pair whose destination
  was written down wrongly, which is how the earlier `no_edge` disposition survived a whole council round.*

**Step 5 — the render tests** (`readLayout.render.spec.tsx`), keyed on the shipped constants:

| criterion | assertion |
|---|---|
| 29 (SB) | the verdict word is the **first content node** in the panel's reading order — assert on `panel.textContent.trimStart().startsWith(verdict)` and on DOM order, not on CSS |
| 30 (SB) | a **colour census** of the panel finds the verdict word as the only element spending amber **as text**, in **every** state; the only non-text amber is the authored `:focus-visible` ring and the in-flight progress indicator while a request is actually running |
| 31 (SB) | each of the four risk fields renders its grounding **before** any prose, declaring traced vs the model's own number **in the type register** — Mono for traced, Plex Sans with a dotted rule for the model's own — and **never in colour** |
| 32 (SB) | every named case A1a…A10 + A1b + A1c is reachable from ≥1 producible pair in `fixtures.ts` |
| 33 (SB) | no two non-synonymous cases render the same primary line; **no case is identified by a marker another reachable case also renders** |
| 34 (SB) | A10 renders `AI unavailable — try again` + its body and **never** as *idle* or as a *no trade* verdict; a previously pinned read stays pinned and readable |
| 35 (SB) | *stale* and the drawer **compose over** a produced read — the read stays present and readable beneath/behind them |
| 36 (SB) | a capped user is **never** shown a countdown and a cooling-down user is **never** shown a reset time: A6a keys on `cooldownLabel`/`cooldownCaption`/`retryInCooldown`, A6b on `capTitle`/`CAP_CAPTION`/`retryWhenReset` |
| 37 (SB) | the eight powering reasons each render their own sentence and CTA label; no two collapse into one string |
| 38/39 (SB) | *produced (no trade)* renders at the same typographic weight as a trade, no warning chrome/error tone/red, names the conditions that would change the read; and **every control the panel renders performs an action this build actually performs** — no disabled placeholder, no label naming a capability this build lacks |
| 41 | idle offers the ask control and states the snapshot's as-of and carries **no** gate note and **no** ask-anyway; the quiet-gate arm carries both **plus** everything idle renders |
| 42 | the quiet gate's `no_trade` renders in **Mono lowercase** and never in the verdict slot; the *no trade* verdict renders in **Archivo display** and never inside a note |
| 43 (SB) | a read pinned to an older snapshot renders an in-body **warning strip with the icon**, never a footnote, and the read stays legible beneath it |
| 44 | an SSE drop alone never marks the read stale — `presentationPolicy.ts:130` branches on `input.stale`, a **newer-REST-snapshot** fact; assert `streamOffline: true` with an unchanged snapshot yields `resultState !== 'stale_newer_snapshot'` |
| 58 (SB) | at `(no_edge, fresh_trade)`: the gate note and `Ask anyway` render **in body, beneath the read**; the read stays present and readable; the panel is **never** rendered as an ordinary fresh read |
| 59 | the composing arm renders **no** Mono `no_trade` line while a verdict is mounted; that literal renders only in the idle arm; **neither arm is identified by the shared gate-note string alone** |

**The amber criterion excludes the focus ring, and does not branch on a ruling.** Read as *"no other amber
pixel"*, rule 16 is **unsatisfiable against canon rule 6** (`DESIGN_SYSTEM.md:161`), which mandates an
authored `:focus-visible` ring in text-grade amber — and this panel is required to contain focusable
controls (the `AccessibleHelp` ⓘ per owner ruling 6, already mounted per cell at `FigureCell.tsx:305`, plus
the ask control, the drawer trigger and the review control). Criterion 30 is therefore **unconditional and
true in every state**: where there is no verdict word, the census of amber **text** in the panel is zero.

**Two `design/` regressions to fix out of the source, not by hand** (P2): the **header icon tint**
(`design/src/screens/ai-read.mjs:8`) and the **pinned-read provenance dot** (`:15`) are **defects**,
regenerated with `node design/src/build.mjs`; the dot becomes `signal`, which the palette already reserves
for links/info/live and explicitly describes as *"quieter than amber"*. `design/` is a drawing, not
authority.

**MUTATION PROOF.** (a) Delete the `never` arm on the result axis → `npm run typecheck` red. (b) Return
`{ body: 'A1a', annexes: [] }` for `(no_edge, fresh_trade)` → criterion 58 red. (c) Restore the Mono
`no_trade` line in A1c → criterion 59 red. (d) Key A1b's test on `No fresh edge right now` alone → the A1c
fixture must make it **ambiguous** and criterion 33 red. Record all four failure texts.

**Reviewer probe:** is any criterion or test in this task keyed on a **count** of states? It must not be —
the row that read *"all nine named states are independently reachable … and no two render the same primary
line"* was withdrawn by its own author as unsatisfiable against a **correct** implementation, because *stale*
composes **over** a produced read and the drawer opens **from** one, so a stale trade read and a fresh trade
read render the same verdict as their primary line, correctly. §4.5's own thirteen-case count is descriptive
prose and **no criterion is keyed on it**.

---

## FE-10 — The bottom sheet and its peek row (under 768px)

**Owns:** new `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ReadSheet.tsx` · new
`ReadSheet.spec.tsx` · `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AiRecPanel.tsx`
**Depends on:** FE-9 · **Independent:** no
**Spec:** §2.5, §4.1 · **Criteria:** 45 (SB), 46 (review)

**The AI read is one component; the sheet is a container, not a variant.** The entire wide/narrow difference
is CSS — the two-column body becomes one column and the same section becomes a fixed bottom sheet. **Exactly
one genuinely new subtree exists: the peek row under 768px, which carries the verdict.**

**Constraint (criterion 45, SB):** the peek row and the panel verdict are the **same value from the same
model field**, and **exactly one of the two is mounted at any width**. Assert: at 393 exactly one node
carries the verdict marker; at 1280 exactly one; and the two strings are `toBe`-equal, read from the same
`ReadLayout`-derived field.

**The container hazard, arriving by a different route (§2.5).** MUI portals the sheet to `document.body`,
**severing the ancestry** that `@container panel` resolves through — so the sheet **re-declares the name at
its own root**:

```tsx
// The sheet is portalled to document.body, so the nearest named ancestor is gone. Re-declare `panel`
// HERE (the shipped `panelContainerSx`, same name, no second name invented) or every figure inside the
// sheet renders at the 20px base at 393px — the same failure as declaring the name at the read strip,
// arriving by a different route.
<Box sx={[panelContainerSx, { position: 'fixed', bottom: 0, /* … */ }]}>
```

Criterion 46 is `review` (browser, 393): jsdom does not evaluate container queries, so the unit test asserts
the **declaration** and a reviewer confirms the stepping. Use `theme.zIndex.drawer` (30) for the sheet and
`extrasFor(theme).scrim` for the backdrop — both landed in phase 1.

**Reviewer probe:** at 393, is `panelContainerSx` present on the sheet's own root (not on an ancestor that
the portal severed)? And does a `getAllByTestId('read-verdict')` return **exactly one** node at each width —
not one visible and one hidden?

---

## FE-11 — Compose the desk, and burn down the spacing exemptions in the rewritten files only

**Owns:** `apps/dashboard/src/app/pages/ticker/TickerDashboard.tsx` ·
`apps/dashboard/src/app/pages/ticker/stage3-headings.spec.tsx` ·
`apps/dashboard/src/app/pages/ticker/ticker-semantics.spec.tsx` ·
`apps/dashboard/src/app/shared/theme/spacing-ladder.spec.ts` (the EXEMPT re-point only)
**Depends on:** FE-6, FE-7, FE-8, FE-9, FE-10 · **Independent:** no
**Spec:** §1, §4 · **Criteria:** 47, 48, 54

**Step 1 — the reading order.** Rewrite `TickerDashboard.tsx:503-669` from the thirteen-widget bento
(`data-testid="widget-bento"` at `:516`, three `BoardZoneLabel` zones at `:532`, `:582`, `:607`) into:

```
masthead (CommandDeck + TickerToolbar, unchanged)
  → structure-hero (FE-6)
  → read-strip (FE-7)
  → AiRecPanel wide beside LiveTape / PositionBrief / OrdersWidget (FE-9/FE-10)
  → quiet context band
```

**The quiet band is placement + chrome only.** The eight remaining context widgets
(`DealerFlowProjection`, `MarketContext`, `IvRank`, `StraddleMove`, `TermStructureCard`,
`FreshPositioning`, `OffExchangeBlocks`, `Setups`) keep their existing `WidgetChromeProvider value="quiet"`
wrapper (`:609`) and their internals **untouched** — their per-widget rebuild is phase 3, ticker arm.
Criterion 48: the band carries its own basis and as-of and **never** wears a live mark
(assert zero `figure-live-dot` and zero `data-figure-state="live"` inside the band, at every connection
kind — this is criterion 8's band half).

**Step 2 — criterion 47.** Signed out, without a key, cooling down, capped, or after a request failure: the
structure, the tape, the strip and the quiet band all render **unchanged**. Assert with a captured
`textContent` per region across the five AI states — AI-read failure is isolated (§5).

**Step 3 — criterion 54.** The masthead's one primary action and the brief's "Review simulated trade" both
open the **one shared** `features/trading/TradeEntryDialog` (via the shipped `useTickerTradeFlows`); assert
**no second entry component exists** with a `?raw` scan for a second dialog declaration, and that nothing
reaches a real order path (`[single-shared-sim-entry-dialog]`, `[no-real-order-path]`).

**Step 4 — the spacing burn-down, fenced.** Owner ruling 4's fence: burn down the spacing exemptions **only
in the files this phase rewrites**. In `spacing-ladder.spec.ts`, **remove** the EXEMPT entries whose files
this phase rewrote and now sit on the 4-pt ladder; **keep** every other entry. The spec's own liveness
assertion (*"every listed file still carries an off-ladder value"*) fails on a stale entry — that is the
mechanism, so run it and record the count removed. **Do not widen the fence** to files this phase does not
rewrite; those are phase 4.

**Reviewer probe:** does the desk still read top-to-bottom in the order §1 names, and is the `widget-bento`
testid either preserved or re-pointed everywhere it is asserted (`ticker-hierarchy.spec.tsx`,
`stage3-headings.spec.tsx`)? Zone labels must stay non-headings (`<p>`) so widget titles remain the only
`h2`s.

---

## FE-12 — The browser layer: re-anchor, re-point, register, prove execution

**Owns:** `apps/dashboard-e2e/playwright.config.ts` · `apps/dashboard-e2e/src/e2e/no-overflow.spec.ts` ·
`apps/dashboard-e2e/src/e2e/curvature-v2.spec.ts` · new
`apps/dashboard-e2e/src/e2e/desk-and-read.spec.ts` · `apps/dashboard-e2e/src/quality/manifest.ts` (if it
names deleted testids)
**Depends on:** FE-11 · **Independent:** no
**Spec:** §3 (overflow commentary), §7 ("Two execution traps") · **Criteria:** 45 (SB), 49 (SB), 50 (SB),
51 (review), 52 (P5, review)

**Step 1 — T1 first: register the new spec in the SAME commit that creates it.**
`playwright.config.ts:30-37` is an explicit `testMatch` allowlist of six filenames. Add
`'desk-and-read.spec.ts'` to the array. **Prove it with `--list`, never with a passing summary** — an
unregistered spec never runs and reports green.

**Step 2 — T2: re-anchor `no-overflow.spec.ts:398`.** It uses
`page.getByText('Call wall').first()` as the readiness anchor for `/ticker/TSLA` at **every** width, and
FE-8 deletes the component that renders that text today. The ladder keeps the exact words (criterion 2), so
the anchor **survives — deliberately, not by luck**; but do not rely on luck twice. Replace with a
testid the ladder owns, and keep a text assertion beside it so criterion 2 is still enforced from the
browser:

```ts
  {
    path: '/ticker/TSLA',
    ready: async (p) => {
      // (v2) Re-anchored: `Call wall` moved from the deleted twelve-tile grid to the level ladder.
      // The words are UNCHANGED by criterion 2 — this anchor is on the ladder's own testid so a future
      // copy change reds ONE assertion instead of ~12 e2e cases at every width.
      await expect(p.getByTestId('level-ladder')).toBeAttached();
      await expect(p.getByText('Call wall').first()).toBeAttached();
    },
  },
```

**Step 3 — T3: the widths are already right. Change nothing about them.** `no-overflow.spec.ts:33` is
`{ width: 393, height: 852 }` with **both** schemes; `:47-54` is `WIDE_VIEWPORTS` = **834 / 900 / 1280**
with **no scheme axis**, and `:43-45` records the decision in terms: *"ONE SCHEME for the wider bands,
deliberately: horizontal overflow is box geometry and dark/light change no widths … 393px keeps BOTH schemes
because that is where content is tightest."* **834 already ships** (`:51`, phase 1). Criterion 49 is written
to that shape. **Do not add 834. Do not widen the wide bands to two schemes** — that is SPEC §9 item 3,
available to the owner and **not taken**, with a runtime cost of three widths × the manifest's per-route
walk.

**Step 4 — criterion 50 (SB).** At those same width × scheme combinations, the read strip **scrolls sideways
when its cells do not fit and the page itself never scrolls sideways**. Assert
`stripEl.scrollWidth > stripEl.clientWidth` at 393 (the rail is doing its job — the anti-vacuity half) **and**
`document.documentElement.scrollWidth <= window.innerWidth` (the page is not). Both halves, or the row is
satisfied by a strip that simply fits.

**Step 5 — `desk-and-read.spec.ts`, four groups.**

- **Criterion 9 (SB)** — exactly one connection chip **in the viewport** at **both** scroll positions (hero
  visible; hero scrolled past). Use `toBeInViewport`, **not** `toBeVisible` and **not** an attached-node
  count: `CommandDeck.tsx:226` renders the condensed bar as `{condensed && (…)}` and when `condensed` is
  true the hero header is **still mounted and not `aria-hidden`**, merely scrolled out — and an
  out-of-viewport node passes `toBeVisible()` in both harnesses. **Both rejected counts red-build a correct
  implementation.** Also assert `tape-stream-state` has count 0 (phase 1 deleted it).
- **Criterion 45 (SB)** — exactly one verdict-marked node at 393 and exactly one at 1280, and the two carry
  the same string.
- **Criteria 20 / 22 evidence** — with the stream stopped, capture that the field's wall lines and flip line
  are still painted while the trail/drift/beam/sweep stop. This is the **browser** companion to FE-4's
  recording-context proof, and criteria 21 and 22 stay `review` (canvas opacity is a container-level style
  the fake context cannot see; a reduced-motion static frame is a visual judgement).
- **Criterion 52 (P5, review)** — at **393 and 1280 in light mode**, capture the hero and confirm the field
  renders on the **active scheme's panel surface** and that **no background fill is scheme-invariant**. Row
  52 is **not** covered by rows 49–50: a dark plate overflows nothing.

**Step 6 — criterion 51 (review): capture the EXECUTED case list before GATE Q.** A combination *claimed but
not executed* is a **FAIL of row 51**, not a PASS of the row that claimed it. Run, in this order, and record
every exit code:

```bash
cd /c/Dev/convexa
npm run ports:free                                   # IPv4 AND IPv6 [::1]
npx playwright install chromium
npm run build                                        # e2e runs against the PRODUCTION build, never dev
npx playwright test -c apps/dashboard-e2e/playwright.config.ts --list > /tmp/pw-list.txt; echo "list exit=$?"
grep -c 'desk-and-read' /tmp/pw-list.txt             # must be >= 1 — T1
npx nx e2e dashboard-e2e; echo "e2e exit=$?"
```

Paste `/tmp/pw-list.txt`'s `/ticker` rows into the build report as the executed case list. `broker-grouping.spec.ts`
fails ~74/75 on the Vite dev server and passes 75/75 on the production build — if you see ~74/75, you ran the
wrong target, not a regression.

**Reviewer probe:** does the `--list` output actually contain `desk-and-read.spec.ts`? Does the one-chip
assertion use `toBeInViewport`? And does the executed case list name **393 dark, 393 light, 834, 900, 1280**
— five rows, not eight?

---

## FE-13 — Extend `design/src/verify-tokens.mjs` to structurally check the seven v2 additions

**Owns:** `design/src/verify-tokens.mjs`
**Depends on:** — (may run any time after FE-1; sequenced here to keep the `apps/dashboard` lane linear)
**Independent:** no · **Spec:** §1, §7 invariant 8

**The gap, read at source.** `verify-tokens.mjs:21-28` structurally checks **20 shared v1 values** and exits
non-zero on a mismatch; `:37-38` merely **prints** `design.additions` (`ink2`, `raised2`, `line`, `line2`,
`steel2`, `scrim`, `glass`) under *"Additions (not in tokens.ts yet)"* — with **no check at all**. They are
in `tokens.ts` now (phase 1), so its exit 0 does **not** prove the mirror matches for `steel2` et al. This is
phase 1's owed item 2.

**Step 1 — set-equality on the `additions` block.** Parse the seven proposed names out of
`design/tokens/tokens.json`'s `additions` (skipping `$comment`), map each to its `tokens.ts` name
(`ink2`→`extras.well`, `raised2`→`extras.panelRaised2`, `line`→`palette.*.divider`,
`line2`→`extras.lineStrong`, `steel2`→`extras.textTertiary`, `scrim`→`extras.scrim`,
`glass`→`extras.glass`), and **fail** when the two name sets differ in either direction.

**Step 2 — per-value equality against `tokens.ts`, both schemes.** Extend the `checks` array at `:21-28`
with the fourteen (seven × two schemes) additions, reading the dark/light values out of
`design.color.dark` / `design.color.light` and the corresponding `extras` / `extrasLight` / `palette`
entries from `tokens.ts`. **Changing `steel2` on one side only must exit non-zero** — that sentence is the
acceptance test.

**Step 3 — run it both ways.**

```bash
cd /c/Dev/convexa
node design/src/verify-tokens.mjs; echo "verify-tokens exit=$?"      # expect 0
# MUTATION PROOF, non-vacuous: change design/tokens/tokens.json `steel2`'s light value by one digit
node design/src/verify-tokens.mjs; echo "poisoned exit=$?"           # expect NON-ZERO, and the ✗ line names steel2
git checkout -- design/tokens/tokens.json
```

Record both exit codes and the `✗` line. **A poison that exits 0 means the check is not wired.**

**Note the `steel2` history so the value is not "corrected" back:** `tokens.json:99` records it was
**darkened from `#61708A`** by owner ruling 7 (2026-09-03) because `#61708A` failed `panelRaised` at 4.23
against the 4.5 floor. Do not restore the lighter value to make a contrast row read nicer.

**Reviewer probe:** does the script now fail when a name is present in `additions` but absent from
`tokens.ts` (and vice versa), not only when a value differs?

---

## FE-14 — Frontend closer: verification run, build report, review captures, canon amendments

**Owns:** `.spire/clusters/tech/contracts/curvature-v2-desk-and-read/BUILD_REPORT.md` and the review captures
it references
**Depends on:** FE-1 … FE-13 · **Independent:** no · **This is the frontend closer.**
**Implements no worker paths** — if a suite is red, **report it**; do not re-implement FE-1…FE-13's files.

Run the whole verification track below and record **exit codes**, then write the build report carrying, at
minimum — these are deliverables, not nice-to-haves:

1. **The zero-orphan ledger** (FE-8 step 2): all twelve `DealerPositioning` cells with `file:line` →
   destination. A cell without a destination is a FAIL.
2. **Every mutation proof, with its recorded failure text** (criterion 57, SB), and for each, the
   **anti-vacuity** evidence that the poison test itself bites. Phase 1 shipped two `expect(true).toBe(true)`
   bodies under a "MUTATION PROOF" heading — a proof without its red output is not a proof.
3. **The executed e2e case list** (criterion 51) — `--list` output plus the run's exit code, naming
   **393 dark · 393 light · 834 · 900 · 1280**.
4. **Both `opportunity_score` / `opportunity_tier` / `state_fingerprint` captures** (before FE-1, after
   FE-13) and the empty-`apps/api`-diff line count (criterion 55, SB).
5. **`npm run typecheck` exit code, recorded SEPARATELY from `nx test`'s** (criterion 56, SB).
6. **The `review` rows, each with its capture:** 4 (the anchor named once) · 6 (the two GEX tooltips,
   byte-for-byte) · 11 (the basis line) · 21 (the field container un-dimmed on a drop, **browser, both
   stream states**) · 22 (reduce-motion static frames at every width, **browser, both settings**) · 40 (the
   `Re-engage when {conditions}` line carries the level as a **condition**, never as a control label) · 46
   (figures inside the sheet step with their container, **browser, 393**) · 51 · 52 (**browser, light mode,
   393 and 1280**) · 57.
7. **Named debt, each with `file:line` and a phase** (SPEC §1 Future): the curve's point-by-point text
   equivalent (**phase 4**, P1 part 3) · the wire-level attempted-versus-failed discriminator for the
   off-exchange object **and** the five levels (two gaps, one cause — the `apps/api` diff stays empty — one
   entry) · the eight context widgets' internal rebuild (**phase 3**) · an alert-on-level entry point from
   the desk (**phase 3, with alerts**) · the remaining spacing exemptions (**phase 4**) · the pre-existing
   `Widget.watch` rule-22 question from FE-1 step 6.
8. **The four canon amendments**, filed at close, none blocking:

| rule | amendment | product behaviour? |
|---|---|---|
| 11 | the "vertical diverging" lock names a chart `chart.tsx:4` records as already replaced; the second clause — *"do not collapse mid + last-trade into a single price without an amendment"* — is kept **VERBATIM**, because the masthead redraw is precisely when that collapse gets proposed for space | none |
| 14 | *"distance from **mid**"* → *"distance from the levels anchor (`gex_spot ?? price`), stated once in the ladder header"*; *"the mid is the **only** live row"* and the shared-stroke clause kept **VERBATIM** — **DELEGATED (P3)** | none |
| 16 | amber scope (P2) + `request failure`, the composition clarification (now including the quiet gate) and the three dispositions (P4) — **DELEGATED** | criteria 30, 32–36, 41–43, 58, 59 |
| 17 | tense only — 834 has landed | none |

**Four amendments is enough churn that the skeptic should check none of them widens beyond its stated
clause.** The `tooltip` z-rung is **not** amended here (SPEC §9 item 4: MUI defaults `Tooltip` to 1500, above
every declared v2 rung; this phase puts `AccessibleHelp` tooltips inside a sheet at rung 30 and a dialog at
40, where 1500 renders above both — the behaviour we want, so the gap is **benign here** and is not this
phase's blocker).

9. **Row 16's `BLOCKED — GATE Z` status** with a pointer to this plan's STOP block, and the two rows (16a,
   16b) that were written instead. **Do not report row 16 green.**

---

# Verification track

Exact commands, exact expectations. **Check EXIT CODES, not printed summaries.** Counts are verified directly
under vitest, never read off the Nx summary — an exit 0 with **zero tests collected** renders identically in
Nx's output. PowerShell: `$LASTEXITCODE`. Git Bash: `echo $?` / `${PIPESTATUS[0]}`.

| # | Command (cwd `C:\Dev\convexa` unless stated) | Expected | Criteria |
|---|---|---|---|
| V1 | `cd apps/dashboard && npx vitest run src/app/shared/liveness` | exit **0**; ≥ 3 files (`liveClaim.spec`, `liveClaim.typeproof.spec`, the source scan) | 8, 10 |
| V2 | `cd apps/dashboard && npx vitest run src/app/pages/ticker/widgets/_kit` | exit **0**; `useStreamLatch.spec.ts` present and green; `FigureCell.spec.tsx` / `type-floor.spec.tsx` **unamended** (`git diff --quiet -- apps/dashboard/src/app/pages/ticker/widgets/_kit/type-floor.spec.tsx`) | 12–15, 17, 18 |
| V3 | `cd apps/dashboard && npx vitest run src/app/shared/charts/structure-field` | exit **0**; `paintStep.spec.ts` includes the **anti-vacuity `live: true`** case; `levelStrokes.spec.ts` green | 7, 20, 22, 52, 53 |
| V4 | `cd apps/dashboard && npx vitest run src/app/pages/ticker/widgets/level-ladder src/app/pages/ticker/widgets/read-strip src/app/pages/ticker/widgets/structure-hero` | exit **0**; ≥ 6 files | 1–6, 9, 11, 19, 23–28, 60 |
| V5 | `cd apps/dashboard && npx vitest run src/app/pages/ticker/live-dot-census.spec.tsx` | exit **0**, **re-pointed not reduced** — the every-connection-kind matrix intact, now over LiveTape + LevelLadder + ReadStrip | 8 (SB) |
| V6 | `cd apps/dashboard && npx vitest run src/app/pages/ticker/widgets/ai-rec` | exit **0**; `readLayout.spec.ts` walks **all 105 pairs**; the `(no_edge, fresh_trade)` fixture renders body **and** annex | 29–44, 47, 58, 59 |
| V7 | `cd apps/dashboard && npx vitest run src/app/shared/theme` | exit **0**; `hex-discipline.spec.ts` carries **no stale exemption**; `single-motion-moment.spec.ts` inventory **set-equal** (zero new keyframes); `spacing-ladder.spec.ts` EXEMPT reduced by the rewritten files only | 53, §8 |
| V8 | `npx nx test @convexa/dashboard` | exit **0**, whole suite — **at or above** the 2026-09-05 baseline of **215 files / 2376 tests** | 56 |
| V9 | `npm run typecheck` | exit **0**, clean across every TS project. **Recorded separately** — Vitest transpiles without typechecking, and this is the ONLY thing that sees the `LiveClaim` brand (`@ts-expect-error`/TS2578) and the two `never` arms | 56 (SB) |
| V10 | `npm run lint` | exit **0** | house |
| V11 | `npm run format:check -- --files <changed>` | exit **0**. **Never a bare `nx format:write`** | house |
| V12 | `npm run ports:free && npx playwright install chromium && npm run build` | exit **0** each; the **production** build, both address families swept | 49–52 |
| V13 | `npx playwright test -c apps/dashboard-e2e/playwright.config.ts --list \| grep -c desk-and-read` | **≥ 1** — proves the new spec is collected by the `testMatch` allowlist (T1) | 51 |
| V14 | `npx nx e2e dashboard-e2e` | exit **0**; **at or above** phase 1's close-out of **75/75 against the production build**. ~74/75 means you ran the dev server | 9, 45, 49, 50, 52 |
| V15 | `node design/src/verify-tokens.mjs` | exit **0**; and the poisoned run exits **non-zero** naming `steel2` | §7 inv. 8 |
| V16 | `git diff --name-only $(git merge-base main HEAD)..HEAD -- apps/api \| wc -l` | **0**, and the observed file count reported | 55 (SB) |
| V17 | `node .claude/tools/interface_conformance.mjs --contract .spire/clusters/tech/contracts/curvature-v2-desk-and-read/INTERFACE_CONTRACT.md --url http://localhost:8000 --report .spire/clusters/tech/contracts/curvature-v2-desk-and-read/conformance-receipt.json` | exit **0**, `2 endpoint(s)`, `/api/ticker/{ticker}` **first**; **or** `NOT RUN — no reachable backend, NO_BACKEND_CHANGE exemption` recorded honestly | §6 |

**Mutation proofs, run and recorded** (`[structural-over-prose-enforcement]` — poison the thing the rule
forbids and the build must go red, **and each poison test proven non-vacuous**):

| Proof | Poison | Must |
|---|---|---|
| Invariant 1 | widen `LiveClaim` back to `boolean` | `npm run typecheck` fails **TS2578** on the `@ts-expect-error` directives (`nx test` stays green — that is the point) |
| Criterion 14 | restore `?? m.gamma_flip` in `LiveTape.tsx` | the retention test goes red naming the bundle number |
| Criterion 13 | key `retained` on the rendered value again | the empty-latch caption test goes red on `offline · last known` |
| Criterion 20 | delete `&& m.live` from the sweep / particle / drift gate (three separate poisons) | `paintStep.spec.ts`'s `live: false` case goes red on `gradientFills` / `arcs` / drift; **and** the `live: true` anti-vacuity case still passes |
| Criterion 26 | render `unavailable` in the empty off-exchange slot | the read-strip test goes red |
| Criterion 8 | pass a live claim to any read-strip cell or any quiet-band figure | the census goes red |
| Criterion 58 | map `(no_edge, fresh_trade)` to `{ body: 'A1a', annexes: [] }` | the annex test goes red |
| Criterion 59 | restore the Mono `no_trade` line in A1c | the register test goes red |
| Criterion 33 | key A1b's test on `No fresh edge right now` alone | the A1c fixture makes it ambiguous and the row goes red |
| Invariant 5 | delete either `never` arm in `readLayoutFor` | `npm run typecheck` red |
| Invariant 4 | add a sixth `LadderRowId` | `npm run typecheck` red at the exhaustive switch |
| Criterion 7 | change one `LEVEL_STROKES` key | the ladder tick and the field line move **together** (the test asserting they do stays green; a test asserting only one goes red) |
| §7 inv. 8 | change `steel2`'s light value in `tokens.json` only | `node design/src/verify-tokens.mjs` exits non-zero naming `steel2` |
| Criterion 53 | hardcode a hex in any surface this phase creates | `hex-discipline.spec.ts` red |
| T1 | remove `desk-and-read.spec.ts` from `testMatch` | `--list \| grep -c desk-and-read` returns **0** (and the suite would otherwise have "passed" by never running it) |

---

## Independence

Lane is `backend` or `frontend` only. **All rows `Independent: no`** — this is the honest **cannot split**
signal, not a missing table. Three grounds, all measured:

1. **PLAN_METHOD's frontend rule.** `yes` requires **SPEC §4** to name the files a task owns. §4's file
   citations are `FigureCell.tsx`, `TapePulseStrip.tsx`, `LiveTape.tsx`, `_kit/copy.ts`,
   `shared/copy/notANumber.ts`, `_kit/distanceToLevel.ts`, `dealer-positioning/DealerPositioning.tsx`,
   `generated/schema.ts`, `libs/api/src/lib/convexa.ts`, `convexa.spec.ts`, `presentationPolicy.ts`,
   `AiRecPanel.tsx`, `AiRecPanelBlocks.tsx`, `DecisionCard.tsx`, `ai-rec/copy.ts`, `chart.tsx`,
   `design/src/lib.mjs`, `design/src/screens/ai-read.mjs`. It does **not** name the new ladder, read-strip,
   hero, stroke-table, paint-step, latch, brand or sheet modules, `Widget.tsx`,
   `StructureFieldCanvas.tsx` (§1/§2 name it, §4 does not), `TickerDashboard.tsx`, `verify-tokens.mjs`, or
   any e2e file. Where §4 does not name the files, the row is `no`.
2. **Pervasive write-path overlap.** `StructureFieldCanvas.tsx` is written by FE-3, FE-4 **and** FE-6.
   `LiveTape.tsx` by FE-2 and FE-8. `_kit/copy.ts` by FE-2 and FE-8. `hex-discipline.spec.ts` by FE-3 and
   FE-6 and FE-8. `AiRecPanel.tsx` by FE-9 and FE-10. `FigureCell.tsx` by FE-1 while FE-5 and FE-7 both
   consume its props contract. `TickerDashboard.tsx` by FE-8 and FE-11.
3. **Hard mechanism prerequisites.** FE-1's brand is a compile-time prerequisite for every `live` prop below
   it; FE-3's palette is a prop prerequisite for FE-4 and FE-6; FE-5/FE-6/FE-7 must all land before FE-8 can
   delete the grid without leaving an orphan.

| Task | Lane | Paths | Depends on | Independent |
|---|---|---|---|---|
| BE-1 | backend | `.spire/clusters/tech/contracts/curvature-v2-desk-and-read/conformance-receipt.json` | — | no |
| FE-1 | frontend | `apps/dashboard/src/app/shared/liveness/**`, `apps/dashboard/src/app/pages/ticker/sessionTapeStanding.ts`, `apps/dashboard/src/app/pages/ticker/connection/connectionState.ts`, `apps/dashboard/src/app/shared/ui/Widget/Widget.tsx`, `apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.tsx`, `apps/dashboard/src/app/features/trading/orders/OrdersWidget.tsx` | — | no |
| FE-2 | frontend | `apps/dashboard/src/app/pages/ticker/widgets/_kit/useStreamLatch.ts`, `apps/dashboard/src/app/pages/ticker/widgets/_kit/useStreamLatch.spec.ts`, `apps/dashboard/src/app/pages/ticker/widgets/live-tape/**`, `apps/dashboard/src/app/pages/ticker/widgets/_kit/copy.ts`, `apps/dashboard/src/app/pages/ticker/widgets/_kit/copy.spec.ts` | FE-1 | no |
| FE-3 | frontend | `apps/dashboard/src/app/shared/charts/structure-field/levelStrokes.ts`, `apps/dashboard/src/app/shared/charts/structure-field/levelStrokes.spec.ts`, `apps/dashboard/src/app/shared/charts/structure-field/StructureFieldCanvas.tsx`, `apps/dashboard/src/app/shared/charts/structure-field/structureFieldShared.ts`, `apps/dashboard/src/app/shared/charts/structure-field/types.ts`, `apps/dashboard/src/app/pages/ticker/widgets/gex-profile-chart/chart.tsx`, `apps/dashboard/src/app/shared/theme/hex-discipline.spec.ts` | FE-1 | no |
| FE-4 | frontend | `apps/dashboard/src/app/shared/charts/structure-field/paintStep.ts`, `apps/dashboard/src/app/shared/charts/structure-field/paintStep.spec.ts`, `apps/dashboard/src/app/shared/charts/structure-field/recordingContext.ts`, `apps/dashboard/src/app/shared/charts/structure-field/StructureFieldCanvas.tsx`, `apps/dashboard/src/app/shared/theme/single-motion-moment.spec.ts`, `apps/dashboard/src/app/shared/hooks/useFlashOnChange.spec.ts` | FE-3 | no |
| FE-5 | frontend | `apps/dashboard/src/app/pages/ticker/widgets/level-ladder/**` | FE-1, FE-3 | no |
| FE-6 | frontend | `apps/dashboard/src/app/pages/ticker/widgets/structure-hero/**`, `apps/dashboard/src/app/pages/ticker/widgets/chrome/TapePulseStrip.tsx`, `apps/dashboard/src/app/pages/ticker/widgets/chrome/TapePulseStrip.spec.tsx`, `apps/dashboard/src/app/pages/ticker/widgets/chrome/index.ts`, `apps/dashboard/src/app/pages/ticker/widgets/gex-profile-chart/GexStrikeProfile.tsx`, `apps/dashboard/src/app/pages/ticker/widgets/gex-profile-chart/chart.tsx`, `apps/dashboard/src/app/pages/ticker/widgets/dealer-positioning/WallMagnetView.tsx`, `apps/dashboard/src/app/shared/charts/structure-field/StructureFieldCanvas.tsx` | FE-2, FE-4, FE-5 | no |
| FE-7 | frontend | `apps/dashboard/src/app/pages/ticker/widgets/read-strip/**`, `apps/dashboard/src/app/pages/ticker/widgets/iv-rank/IvRank.tsx` | FE-1 | no |
| FE-8 | frontend | `apps/dashboard/src/app/pages/ticker/widgets/dealer-positioning/**`, `apps/dashboard/src/app/pages/ticker/widgets/index.ts`, `apps/dashboard/src/app/pages/ticker/widgets/_kit/copy.ts`, `apps/dashboard/src/app/pages/ticker/widgets/market-context/MarketContext.tsx`, `apps/dashboard/src/app/pages/ticker/widgets/dealer-flow-projection/DealerFlowProjection.tsx`, `apps/dashboard/src/app/pages/ticker/live-dot-census.spec.tsx`, `apps/dashboard/src/app/pages/ticker/ticker.risk.spec.tsx`, `apps/dashboard/src/app/pages/ticker/pos-params.spec.tsx`, `apps/dashboard/src/app/pages/ticker/ticker-invariants.spec.tsx`, `apps/dashboard/src/app/pages/ticker/ticker-hierarchy.spec.tsx`, `apps/dashboard/src/app/pages/ticker/ticker-age-basis.spec.tsx`, `apps/dashboard/src/app/pages/ticker/single-name-caveat.spec.tsx`, `apps/dashboard/src/app/shared/theme/steel2-contrast.spec.ts`, `apps/dashboard/src/app/shared/theme/hex-discipline.spec.ts` | FE-5, FE-6, FE-7 | no |
| FE-9 | frontend | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/readLayout.ts`, `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/readLayout.spec.ts`, `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/readLayout.render.spec.tsx`, `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AiRecPanel.tsx`, `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AiRecPanelBlocks.tsx`, `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.tsx`, `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts`, `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/fixtures.ts` | FE-1 | no |
| FE-10 | frontend | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ReadSheet.tsx`, `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ReadSheet.spec.tsx`, `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AiRecPanel.tsx` | FE-9 | no |
| FE-11 | frontend | `apps/dashboard/src/app/pages/ticker/TickerDashboard.tsx`, `apps/dashboard/src/app/pages/ticker/stage3-headings.spec.tsx`, `apps/dashboard/src/app/pages/ticker/ticker-semantics.spec.tsx`, `apps/dashboard/src/app/shared/theme/spacing-ladder.spec.ts` | FE-6, FE-7, FE-8, FE-9, FE-10 | no |
| FE-12 | frontend | `apps/dashboard-e2e/**` | FE-11 | no |
| FE-13 | frontend | `design/src/verify-tokens.mjs` | FE-1 | no |
| FE-14 | frontend | `.spire/clusters/tech/contracts/curvature-v2-desk-and-read/BUILD_REPORT.md` | FE-1, FE-2, FE-3, FE-4, FE-5, FE-6, FE-7, FE-8, FE-9, FE-10, FE-11, FE-12, FE-13 | no |

**Closers.** Backend: **BE-1** (empty-diff proof, score identity and `conformance-receipt.json` only — it
re-implements no worker paths; there are none). Frontend: **FE-14** (leftover verification, the report and
the review/visual states only — it implements no worker paths).

`design/src/verify-tokens.mjs` is outside both `backend.dir` and `frontend.dir`; per PLAN_METHOD it goes on
**one** lane (frontend, FE-13) as `no`, never on both.

---

## Unresolved / flag at review

**U-1 — the spec's approval status is reported two different ways, and the planner did not pick one.**
`_MANIFEST.md:2,6-9` (dated 2026-09-05) says *SPEC APPROVED BY OWNER 2026-09-05; build authorized* and that
the seven DELEGATED calls were *ratified by the owner's spec approval*; the launch brief for this planning
session says the owner is asleep and the spec is awaiting approval; `SPEC.md:5` still reads
`**Status:** draft`. The plan is written to be correct either way and every DELEGATED-only task carries its
reversal cost, which is what the manifest itself asks for. **The conductor should reconcile the three before
the build lane starts** — if the spec really is approved, `SPEC.md:5` wants updating; if it is not, the
manifest's line 2 does.

**U-2 — the brand's module is `shared/liveness/`, not `sessionTapeStanding.ts`.** SPEC §2.1 names
`isDeliveringLive` (`pages/ticker/sessionTapeStanding.ts:54-60`) as the canon predicate **and** requires
`Widget.live` (`shared/ui/`) to carry the brand. A `shared/` → `pages/` import inverts the repo's binding
dependency direction (`apps/dashboard/src/app/README.md`), and `OrdersWidget.tsx:144`
(`features/trading/orders/`) is a second such consumer. Resolved exactly as phase 1's U-3 was: the predicate
and its brand live in `shared/liveness/liveClaim.ts` and `sessionTapeStanding.ts` **re-exports** them, so
"produced only inside that module" stays literally true and every shipped importer keeps its path. **No spec
sentence is weakened** — §2.1 names the mechanism, never a module path. Flagged so a reviewer sees the
reasoning rather than re-deriving it.

**U-3 — `OrdersWidget.tsx:144` passes a WATCH fact through the liveness prop.** `live={watchingAny}` is
about open orders watching for a live cross, not about a delivering stream. Branding it would launder a
different fact through the one predicate. FE-1 step 6 gives it its own `watch` prop driving the same shipped
`widgetLivePulse` declaration, so **nothing renders differently**. The pre-existing canon-rule-22 question
this exposes — *should a watch pulse run when no stream is delivering?* — is **unchanged by this phase** and
is recorded in the build report, not fixed here.

**U-4 — criterion 20's level strokes live in the OFFSCREEN buffer.** `paintStructure`
(`StructureFieldCanvas.tsx:206-423`) paints the walls, spot and flip into `off`/`offCtx` and runs only when
`structureDirty` (`:446-449`); the per-frame path blits it (`:452-454`). A recording context wired to the
frame path alone would see **zero** level strokes at any liveness. FE-4 therefore extracts **two** pure
steps and the test drives both into one recorder. Not a spec contradiction — a mechanical fact the spec's
§7 does not mention and a build lane would otherwise discover halfway through the extraction.

**U-5 — three motions must gain a `m.live` gate for criterion 20 to be satisfiable.** The sweep
(`:484-492`), the particles (`:522-577`) and the warped field-line drift (`:495-519`) are gated on `!reduce`
alone today. Criterion 20 requires them to **stop** at `live: false`. This is real implementation work the
criterion implies but does not name; FE-4 owns it. Recorded so GATE Q does not read it as scope creep.

**U-6 — `hex-discipline.spec.ts` exempts THREE files this phase de-hexes, not one.** SPEC §9 item 5 names
the canvas exemption; the shipped list (`:38-67`) also carries
`shared/charts/structure-field/structureFieldShared.ts` and
`pages/ticker/widgets/chrome/TapePulseStrip.tsx`, plus `pages/lab/demos/labTokens.ts` which this phase does
**not** rewrite. The coupling (`:110-118`: *"every entry still exists AND still carries hex"*) applies to
each. FE-3 and FE-6 remove exactly the entries whose files stop carrying hex and **keep** `labTokens.ts`'s.
Removing more than that reds the suite; removing fewer reds it too. Recorded because it is the most likely
place a partially-applied edit lands.

**U-7 — criterion 16 is BLOCKED at GATE Z.** See the STOP block at the top. Not planned around, not
weakened, not silently downgraded.
