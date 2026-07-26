# scanner — FRONTEND_EXECUTION_CONTRACT (Phase P4 — the `/scanner` page)

> **Scope: PHASE P4 ONLY** — the 4th and FINAL phase. Replaces the P3 `NO_UI_CHANGE` stub. Binds the
> **frontend lane**. P1 (store) · P2 (worker) · P3 (read API + gated view + warm-click) are all SHIPPED
> and GATE-Q-passed; P4 builds the first **visible** scanner surface on top of P3's wire.
>
> **This phase is FE-ONLY.** The `apps/api` diff MUST be **EMPTY** — that empty diff is the structural
> proof of `[additive-keeps-score-byte-identical]` for this phase.

---

## 1. Build authority + inbound contracts

- **Build authority:** `docs/superpowers/plans/2026-07-26-scanner-04-frontend.md` (Plan 4 — complete,
  no-placeholder, 8 tasks / 53 steps, 7 RED→GREEN disciplines). **Build it exactly as written**, task by
  task, via `superpowers:subagent-driven-development`.
- **Design authority:** `UX_BLUEPRINT.md` (locked at P3's GATE U·X; see the **conductor amendment** in §2
  — the "live" wording ruling below).
- **Wire (CONSUME exactly, invent nothing):** `INTERFACE_CONTRACT.md`.
- **ACs to close:** `PRODUCT_CONTRACT.md` §4 — P4 closes what P3's QA marked **DEFERRED-TO-P4**: **AC-11**
  (row-click → the correct Ticker page, no order/trade action) and the **visual halves** of AC-1, AC-7,
  AC-8, AC-9, AC-12.
- **Structure authority:** `apps/dashboard/src/app/README.md` — downward-only deps (`pages`/`features` →
  `shared`); **pages NEVER import sibling pages**; `shared/` populated on the **2nd consumer**;
  folder-per-widget.
- **Mandated skill stack (standing owner directive for every FE lane):** **`convexa-design`** (the
  rule-of-record — load FIRST), plus `react-best-practices`, `composition-patterns`,
  `web-design-guidelines`, `webapp-testing`.

## 2. Conductor rulings on Plan 4's three flags (DECIDED — implement as written, do not re-litigate)

1. **The "live" contradiction — RESOLVED, `UX_BLUEPRINT` amended in place (2026-07-26).** The blueprint
   forbade the word "live" on the table while its own reference copy used it twice. A negative-space rule
   its own copy violates is unenforceable. **The forbidden-word rule STANDS**; the two strings are
   reworded, meaning preserved: the header gloss ends **"not a real-time feed"** and the `error` tooltip
   reads **"the rest of the table is scored on the stated cadence."** Ship those. The **AC-9 `\blive\b`
   scan is therefore ABSOLUTE** — no sanctioned exception anywhere in scanner UI copy or DOM.
2. **Worker-down threshold — ACCEPTED as `SWEEP_DOWN_AFTER_S = 180`.** Nothing upstream pinned it. 180s ≈
   6 missed fast-lane ticks (the heartbeat is written **every tick**, not only on full-pass completion,
   so a healthy heartbeat age stays ~30s). Ship it as a **named, single-sourced constant** with a comment
   tying it to the D4 fast-lane cadence, so retuning cadence surfaces it.
3. **`sweep_last_completed: null`** — resolved inside the two pinned copy variants (falls to the
   "hasn't reported yet" wording). Accepted.

Also accepted from the plan: the correct Nx target is **`@org/dashboard`** (not `dashboard`) — use the
real project name in every command.

## 3. ⚠ The structural landmine — the `shared/` promotions (read before Task 2)

Plan 4 promotes **`TintChip` → `shared/ui/`** and **`useFlashOnChange` → `shared/hooks/`** on the
2nd-consumer rule. This is **forced and correct** (both live in `pages/ticker/widgets/_kit/`, and "pages
never import sibling pages" leaves no conforming alternative), and `_kit/index.ts` re-exports both so
ticker call sites stay byte-unchanged.

**But two shipped structural scans PIN those file paths** — `single-motion-moment.spec.ts`
(`FLASH_HOME`) and `stage3-amber.spec.ts` (`TEXT_AMBER_CONSUMERS`). **Binding discipline (the promoted
`stagger-guards-replaced-not-deleted` precedent, redesign-stage-3):** the pins are **UPDATED to the new
paths in the SAME commit as the move — never deleted, never weakened, never left failing.** Zero
spec-file deletions branch-wide. A guard that moves with the thing it guards stays a guard; a deleted
guard is a silently lost invariant.

## 4. Binding invariants (restate + honor)

- **`[additive-keeps-score-byte-identical]`** — FE-only: **`git diff` of `apps/api` MUST be EMPTY** (the
  structural proof; verify at the plan's two checkpoints). The scanner **consumes** score/tier off the
  wire and is never a scoring input.
- **`[theme-token-discipline]`** — token-only via the MUI theme / `tokens.ts`; mode-aware values through
  **`extrasFor(theme)`** inside sx callbacks (bare `extras.` is dark-only); **zero hardcoded hex**;
  dark/light parity is part of done. Pin with the project's **`?raw` source-scan idiom, MUTATION-TESTED
  so it provably bites**.
- **`[digested-labels-not-raw-dump]`** — status/tier/regime/vol-regime render via a **closed lookup**,
  **never re-derived** from a scalar; no raw series in a row; an unknown enum **fails honest** (never
  guessed).
- **`[model-read-carries-its-assumptions]`** — self-describing freshness: per-row as-of + status + the
  two-speed header. **THE SHARP EDGE:** a synthesized `building` row carries a **non-null `as_of` that is
  NOT a freshness claim** → the FE **MUST branch on `status === 'building'` BEFORE rendering "Updated"**
  (UX §2.2 / INTERFACE §3.1). Plan 4 tests this twice (unit + render) — keep both.
- **`[live-vs-static-isolation]`** — poll-based (`SCAN_POLL_MS = 30_000`); **no SSE, no per-row streams**;
  **never the word "live"** (ruling §2.1 — absolute); the price flash is the **only** motion cue and
  respects reduced-motion.
- **`[server-side-gate-enforcement]`** — the view save awaits the **server** (`saveScanView` IS the gate);
  a signed-out/403 path shows the sign-in prompt and **writes nothing locally** (the scanner writes
  **zero** localStorage — assert it). The FE check is UX only.
- **`[no-real-order-path]`** — display + navigation only; a row-click navigates to `/ticker/{SYM}` and
  does nothing else.
- **convexa-design:** **green/red for PRICE DIRECTION only** (`chg_pct`) — score, distances, walls and
  regime stay **neutral** (this is the exact proximity-chip regression class that was a real latent
  violation); **tier = `TintChip` emphasis = the row's single amber spend**; **add NO new keyframe
  family** — the app-wide motion inventory is **set-equality pinned** and a 6th family is build-breaking.

## 5. Testing (risk-based — NOT one-test-per-AC)

Per `.claude/agents/qa-verify.md` §4 (amended 2026-07-13) + UX_BLUEPRINT §6. **Test** the
invariants/negative-space + silently-regressing behavior: the closed-lookup mapping incl. the
**`building`-`as_of` trap**, the gated write refusing to write locally on 403, `null` → `—` never `0`,
className-identity proving score/distance/wall/regime are **untinted**, per-row `error` isolation,
unknown-status fail-honest, the mutation-guarded `?raw` scans (`\blive\b` / stream primitives / bare
`extras.`), a DOM `\blive\b` sweep with all four states on screen, skeleton≠building≠degrade, both
worker-down copy variants over intact rows, real `/ticker/{SYM}` hrefs, and AC-13's universe-only rule.
**Verify by review** (do NOT mirror into tests): exact copy/styling, tooltip wording, toolbar presence,
and AC-12's speed-only warmth (not machine-observable) — via the scripted eyes-on pass in Task 8.

**Gotchas:** `useMediaQuery` **STRING** form; **sx compiles to classes** — never assert
`getAttribute('style')` (the vacuous-assertion trap); `?raw` scans must be mutation-tested; 2 timing-flaky
specs exist (a clean rerun is the tiebreaker); 29 pre-existing lint warnings.

## 6. GATE Q surface

`npx nx test @org/dashboard` (baseline **73 files / 606** → expected **75 / 643**) · `npx nx lint
@org/dashboard` · `tsc -b apps/dashboard/tsconfig.app.json --force` · `npx nx run @org/dashboard:typecheck`
· `npx nx build @org/dashboard` · Cypress `npx nx e2e dashboard-e2e` with **`/scanner` joined to the 393px
no-overflow route set** · **empty `apps/api` diff** · a real-browser pass over the four states in **both
themes** · the deferred ACs (AC-11 + the visual halves of AC-1/7/8/9/12) closed.

## 7. Lane rules

- Frontend lane only: writes under `apps/dashboard/` + `libs/api/`. **Touch no `apps/api` file.**
- **Commit** per Plan 4's per-task steps (local, on `main`). **Do NOT push** — the conductor pushes after
  P4's GATE Q.
- The two pinned structural scans are updated **in the same commit** as the `shared/` promotion (§3).
- If Plan 4 proves wrong/under-specified, **STOP and report** the exact step + conflict (a GATE-Z
  candidate) rather than inventing around it — as the P2 lane correctly did.
