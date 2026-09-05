# OVERNIGHT DECISIONS — 2026-09-05 (read this first)

**Status:** LIVE — appended as the session runs. Written because you went to sleep and authorised the
session to decide and log rather than block.

**How to read this.** Every row is a decision I made *for* you. The **Reverse it by** column is the
one-line undo. Nothing here is pushed; everything is on `spire/curvature-v2-foundations` in the working
tree or in commits on that branch. Nothing touched `main`, another repo, or production.

---

## 🔴 The two I most want your eye on

### D-1 — Canon rule 11 is stale, and I am treating it as stale

`DESIGN_SYSTEM.md` rule 11 says *"do not 'fix' the GEX chart back to horizontal (vertical diverging is
**owner-locked**)"*. That is **your** lock, so I did not overrule it lightly — I read the code:

- `widgets/gex-profile-chart/chart.tsx:4` — *"Replaces the former Recharts **vertical** bar chart"*.
- `shared/charts/structure-field/StructureFieldCanvas.tsx:217` — `xOf = (k) => … (k - minK) / (maxK - minK) * plotW`,
  i.e. **strike on the x-axis**. The shipped instrument is already horizontal.
- `design/src/lib.mjs:249` — the v2 design draws it the same way.

So the vertical Recharts chart your lock protected **no longer exists**; the rule now protects nothing and
mislabels the shipped code. Left in place it red-flags correct code at GATE Q and could push a build lane
to rotate a correct instrument.

**Decided:** phase 2 amends rule 11 to lock the *current* instrument (Canvas2D structure field, strike on
x, net GEX on y, diverging about zero) and records that the Recharts vertical bar chart is retired.
**Reverse it by:** saying so — the amendment is a canon edit at GATE S, not code, so it costs one line to
undo. If you actually want the hero rotated to vertical, say that instead and it becomes a spec change
before the build lane starts.

### D-2 — The `tooltip` z-rung: I am recommending **45**

Carried open from phase 1. Canon declares six rungs (nav 20 · sheetScrim 29 · sheet 30 · popover 35 ·
dialog 40 · toast 50); MUI defaults `tooltip` to **1500**, above all of them.

**Decided (recommendation, goes to the council as a bound constraint):** declare a **seventh rung
`tooltip: 45`** — above `dialog` 40 so a tooltip on a control *inside* a dialog is readable (this is why
MUI puts it above modal in the first place), below `toast` 50 so a toast is never covered by a hover
tooltip. Set MUI's `zIndex.tooltip` to it so nothing stays ad-hoc.

I considered `tooltip: 36` (just above popover, below dialog) and rejected it: it hides tooltips inside
dialogs, and the trade-entry dialog has ⓘ affordances. **Reverse it by:** naming a different number
before the build lane runs; it is a one-value change in the theme plus the canon's z-index row.

---

## 🟡 Scope calls inside phase 2

| # | Decision | Why | Reverse it by |
|---|---|---|---|
| D-3 | Feature named **`curvature-v2-desk-and-read`** | It is the exact name phase 1's own BRIEF recorded for the deferred phase-2 candidate, so the cull trail stays continuous | Rename the contracts dir; nothing else references it yet |
| D-4 | Phase 2 = masthead + hero panel + level ladder + read strip + AI read brief + the `LiveTape` retention latch | The four canon-bound surfaces share one grid, one liveness predicate and one figure vocabulary; splitting them turns each seam into a cross-phase negotiation | Cut any one surface out of the BRIEF before GATE C |
| D-5 | The eight quiet context widgets are **re-housed only** (placement + quiet chrome), internals untouched | They already consume `FigureCell` from phase 1, so re-housing is cheap; rebuilding eight widget internals in the same BRIEF gives GATE Q no per-surface verdict — the same failure the phase-1 cull rejected | Pull them into phase 2 in full, at roughly +1 build lane |
| D-6 | Their internal rebuild is attached to **phase 3**, which I widened from "scanner · positions · settings · alerts" to include the ticker context arm | Otherwise that work is orphaned — no phase owned it | Give it its own phase 5 instead |
| D-7 | Spacing-exemption burn-down is **partial** — only files phase 2 rewrites | Ruling 4 fenced the list with an expiry at "a named later phase"; phase 4's responsive sweep touches every screen anyway, so that is the honest home for the remainder | Demand the full burn-down here |
| D-8 | `verify-tokens.mjs` structured checks extended to the seven v2 additions, **in phase 2** | Verified at source: `verify-tokens.mjs:38` only *prints* the additions. Its exit 0 does not prove the mirror matches for `steel2` — a false green sitting under a ruling-7 token value | Defer it to phase 4 |
| D-9 | Two composition questions left **open for the council** rather than pre-decided | (a) hero = one container panel with four regions vs a panel wrapping four components; (b) the AI read's <768px bottom sheet = the same component in a sheet vs a second narrow rendering. Both are exactly what the three voices exist to argue | — (they are already open) |

---

## 🟠 Corrections to my own BRIEF (found by the council, verified by me)

### C-1 — the BRIEF was wrong about the 834 breakpoint

My BRIEF says the responsive sweep "adds 834 to the overflow suite" in **phase 4**. The architect
challenged it; I checked and it is **already shipped**:
`apps/dashboard-e2e/src/e2e/no-overflow.spec.ts:51` reads `{ label: 'tablet 834', width: 834, height: 1112 }`,
with a comment at `:48` saying `(v2) 834 ADDED (canon rule 17 ...)`. It landed in **phase 1**.

**Decided:** I am **not** editing `BRIEF.md` while R2 is in flight (changing a round's input mid-round is
worse than a stale sentence the round is already attacking). It gets corrected at R3 when I fold
conflicts, and recorded in `decisions.md`. Phase 4's scope shrinks by one item.

**Correction to this correction (found at R3, by pm).** I first wrote that canon rule 17 "carries the same
stale sentence" and needed the same fix. That overstated it. Rule 17 reads *"the suite … enforces **393**
(both schemes), **900** and **1280** today; **834** is added at build"* — which was **accurate when
written**, and phase 1 is the build that added it. The canon needs a **tense update**, not a correction of
fact. **The canon was right and my BRIEF was wrong**, which is the opposite of what I implied.

### C-2 — a real light-mode defect in the code the hero re-houses

The architect reported and I verified: `shared/charts/structure-field/StructureFieldCanvas.tsx:18`
hardcodes `const INK = '#0B0F17'`, its only hook is `useReducedMotion` (`:11`), and `:223` / `:434` fill
with `INK` **unconditionally**. There is no theme or colour-scheme input at all, so **the structure field
paints a dark rectangle in light mode**. Its header comment claims *"Theme literals match tokens.ts"* —
which is a prose exemption standing in for the structural rule `hex-discipline` is supposed to enforce.

This lands inside phase 2 whether or not anyone planned it: the hero is this canvas. **Decided:** it is
in scope, and the fix is a real theme input rather than a second set of literals. **Reverse it by** ruling
the hero dark-only in both schemes — which I do not recommend, since canon requires light/dark parity.

### C-3 - "both schemes" is wrong above 393px

I wrote that the overflow suite "stays green at **393 / 834 / 900 / 1280** in both schemes". It does not,
**by documented decision**: `no-overflow.spec.ts:43-45` says *"ONE SCHEME for the wider bands, deliberately:
horizontal overflow is box geometry and dark/light change no widths ... 393px keeps BOTH schemes because
that is where content is tightest."* The wide bands run dark only. **Canon rule 17 already says this
correctly** — *"enforces **393** (both schemes), **900** and **1280**"*. The wrong sentence is in **my
BRIEF and the phase-1 BRIEF**, not the canon, and it propagated into several of pm's acceptance rows.

**Decided:** the criteria say **393 in both schemes, 834 / 900 / 1280 in one** - matching the shipped
suite and its stated assumption. Corrected at R3. **Note the interaction with C-2:** because the wide
bands are dark-only *and* the structure field has no light rendering at all, **no existing test can catch
the dark-rectangle-in-light-mode defect**. That gap needs its own criterion, not a wider overflow sweep.

### C-4 - a trap the build lane will hit (not a correction, a warning)

`no-overflow.spec.ts:398` uses `getByText('Call wall').first()` as the **readiness anchor for every
`/ticker` route walk at every width** - and `Call wall` is a string rendered by `DealerPositioning`, the
component this phase deletes. The moment the ladder replaces those twelve tiles, every wide-band overflow
test hangs or fails on a missing anchor, and it will look like an overflow regression rather than a moved
string. The plan must re-anchor it. Recorded here so it is not rediscovered at GATE Q.

---

## ⚪ Boot + housekeeping (done before you slept, recorded for completeness)

| # | Decision | Why | Reverse it by |
|---|---|---|---|
| D-10 | Removed the `git checkout -- <file>` / `git restore` ask from `~/.claude/hooks/guard-bash.mjs` | You asked for it explicitly | `cp ~/.claude/hooks/guard-bash.mjs.bak-2026-09-05 ~/.claude/hooks/guard-bash.mjs` |
| D-11 | Reverted `apps/dashboard/src/app/batch-backtest-cli.structural.spec.ts` to the branch version after backing up three copies | It carried an `assume-unchanged` bit hiding uncommitted content from `git status`; the content was in no ref and not in the object DB, and sat between local `HEAD` and the branch version — almost certainly the draft of what later landed as `9fcb6588` | Copy `…scratchpad/batch-backtest-cli.structural.spec.ts.WORKTREE-BACKUP` back over it |
| D-12 | Cleared that file's `assume-unchanged` index bit | It made `git status` lie about a real divergence, which is how the file stayed invisible across sessions | `git update-index --assume-unchanged <path>` |
| D-13 | Left local `main` 56 commits behind `origin/main` and touched none of the 32 worktrees | Not this session's job, and other lanes may hold uncommitted work in them | — |

**Backups live at:**
`C:\Users\rodri\AppData\Local\Temp\claude\C--Dev-convexa\369082a0-b00c-48f6-a19b-7e6137f512c3\scratchpad\`
(three versions of the spec file: `.WORKTREE-BACKUP`, `.HEAD`, `.CURVATURE`) and
`~/.claude/hooks/guard-bash.mjs.bak-2026-09-05`.

---

## Boot verifications (both passed, as the handover asked)

- **Spire integrity:** `node .spire/bin/spire.mjs run tech --provider claude` → **exit 0** on this Windows
  checkout, run again *after* switching to the branch so it proves this tree, not `main`'s.
- **Line endings / NUL bytes:** the active curvature surfaces (`contracts/curvature-v2-desk-and-read`,
  `contracts/curvature-v2-foundations`, `state/spire-curvature-v2-foundations`, `.claude/`) are
  **0 CRLF, 0 NUL**. 351 files under `.spire/**/_archive`, `state/conformance` and `design-session`
  carry CRLF **inside their committed blobs** — pre-existing, consistent with the index, not a working-tree
  problem, and outside anything this phase touches. Not fixed; flagging it as a known cosmetic wart.
- **Working tree:** clean on `spire/curvature-v2-foundations` @ `6a3ef463`. The two deliberately-untracked
  files (`.claude/launch.json`, `convexa-api-contract-candidate-*.ok`) do not exist on this machine, which
  is expected on a fresh checkout, not a discrepancy.
- **Handover accuracy:** everything checked out. The only drift was the commit count — the RESUME names 7,
  you said 8, `git rev-list` says **9** ahead of `origin/main`; the extras are the two RESUME-snapshot
  commits and an inherited `IN_FLIGHT` refresh.
