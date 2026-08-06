# RESUME — session handover (2026-08-06, GATE R after GATE S)

> For a fresh session (normal chat OR `/conductor`). **Overlay on canon — this file WINS on
> current status.** Written at a clean boundary: `broker-option-grouping` SHIPPED + ARCHIVED,
> **pipeline DRAINED**, no lane running, no question outstanding. Stays UNCOMMITTED by owner
> preference. **Supersedes the earlier 2026-08-06 RESUME** (which said the build was about to
> start). Verified against disk, not remembered.

---

## ⏭ THE ENTRY POINT — pipeline is DRAINED; queue says `vol-normalized-gex` (X2)

`.claude/contracts/` holds only `_archive/`. Nothing is half-built. The roadmap
(`docs/ROADMAP_2026-08.md`, the standing order) puts **`vol-normalized-gex` (X2)** next: vol-normalize
the GEX read, intraday-recompute where the data allows, plus a public-ready "how we compute this and
where it fails" methodology note. **GATE-M-shaped** (math, BE-heavy) — the first backend-touching
feature in a while, and the first that will engage
`[score-change-is-deliberate-and-measured]` if it reaches the score.

Evidence for it: the independent backtest found **raw GEX had no predictive power while
vol-normalized did**. It is the strongest decision-impact item in the pool.

**Runner-up if a small win is wanted instead:** the §B **distance-to-spot level tiles**
(Value H · Effort S — call wall / put wall / gamma flip / max pain each showing how far price sits
from them). Also newly logged and cheap: **`ports-free-is-ipv4-only`** (§B) — see below, it is a
verification-integrity fix, not a feature.

Start either with GATE I (`go`) or jump straight to `/council {feature}` after writing its BRIEF.

---

## 🔒 LOCKDOWN IS ON (owner-directed 2026-08-06, pipeline waived) — read before touching auth

New sign-ups are **CLOSED and fail closed** (`SIGNUPS_ENABLED` unset ⇒ off), on **both** doors —
`/api/auth/signup` and the Google create-a-new-user step — from one predicate in
`apps/api/src/auth/policy.py`. Scanner API + FE `/scanner` + `/positions` are session-gated;
**Landing, `/ticker/*`, `/blog`, `/settings` stay public.** Owner account is seeded at startup from
`OWNER_EMAIL`/`OWNER_PASSWORD`. Full detail + how to reopen: `OPEN_THREADS.md` **§7ac**.

⚠ **Set `SIGNUPS_ENABLED=1` in your LOCAL `apps/api/.env`** — the test suite and
`interface_conformance.mjs --auth-signup` both register, and will fail without it. Leave it unset
in production. ⚠ **This protects nothing until N1 deploy runs.**

## ✅ WHAT SHIPPED THIS SESSION

### `broker-option-grouping` — a count and a net, never a name (SHIPPED + ARCHIVED)
A ticker's broker option legs collapse into ONE expandable row with a **leg count** and a **netted
entry cost**; expanding shows the per-leg rows unchanged. A lone leg reads
`1 option leg · as Webull reports it`. Equities never group. **FE-only**, empty `apps/api` diff.
Full thread: `OPEN_THREADS.md` **§7ab**. Capability: `PROJECT_CONTEXT.md` §6. Do not restate those.

Three things a future session must not re-litigate:
- **The group is NEVER named a structure** — not "vertical", not "spread", **not even `Custom`**. This
  is enforced by machinery, not prose: an import allow/deny-list, a recursive two-arm mutation-guarded
  source scan, and a **render regression under a simulated future feed**. That third layer exists
  because `positions/structure.ts:153` returns `custom` ONLY while strike/expiry/right are null — the
  day a vendor supplies them, the forbidden name would appear **by itself, with nobody deciding it**.
- **Withheld figures use ONE shared permanence-first cascade at both group and leg level.** A group's
  literal is **derived from its members', never chosen beside them.** This was the GATE Q failure.
- **The netted cost is Convexa's own composition**, not Webull's `total_cost`. Those differ, and the
  difference is the reconstructed ×100 multiplier — which is the thing the feature must be honest about.

**Pipeline shape:** GATE I → C (R1–R3: 25 conflicts, 25/25 quotes verified, 0 technical unresolved,
2 owner rulings; R4 ×3, S2 ×2) → PLAN → FE ×3 phases → **Q FAIL → Z → Q PASS**.
Final **49 PASS / 0 FAIL / 1 UNVERIFIABLE**; conformance backend PASS · QA PASS agreeing.

---

## 🎓 GATE S GRADUATED TWO KEYS (canon changed — read `PROJECT_CONTEXT.md` §5)

1. **`structural-over-prose-enforcement`** (4 features) — enforce an invariant by **construction**, not
   by prose someone must remember. **Held back three times** on the stated objection that it lacked a
   crisp violation test; this ship supplied one: *poison what the rule forbids and the build must go
   red — and the poison test must itself be proven non-vacuous.*
2. **`single-motion-moment`** (2 binding) — ONE orchestrated motion moment; the keyframe inventory is
   set-equality pinned so a new family is build-breaking. **It crossed at `redesign-stage-3` on
   2026-07-22 and was MISSED at that GATE S** — surfaced now by `ledger_tally`. Worth knowing as a
   process fact: the counting was already code, but the tally was not run at that ship.

`dark-pool-context-only` still shows `GRADUATES` in the tally — that is **bookkeeping, not a miss**:
it is explicitly recorded as pre-existing canon (`PROJECT_CONTEXT.md` §5, ledger's "Pre-existing canon"
note). Do not re-promote it.

---

## ⚠ TWO CANON ERRORS CORRECTED THIS SESSION — do not reintroduce

Both were inherited from the previous session's record; both were caught by council voices, not by me.

1. **Book composition.** Not "13 positions / 4 apparent verticals + 1 lone NVDA call". **Measured**
   from `apps/api/tests/fixtures/broker/positions_raw.json`: **14 holdings = 5 equity + 9 option
   legs**, TSLA·3 · AAPL·2 · META·2 · NVDA·1 · PLTR·1 ⇒ **3 groups + 2 lone legs**. TSLA is
   **+10 / −4 / +4** — mismatched, so the rejected qty-pairing heuristic mis-pairs the owner's real
   book **today**. Corrected in BRIEF, §7z, and here.
2. **Group net figures.** What Convexa renders: AAPL **3,850.00** · META **3,805.00** ·
   TSLA **13,760.00** · NVDA **7,890.00** · PLTR **4,990.00**, all debits. **Never assert 3,802.00 or
   7,889.00** — those are Webull's raw `total_cost` sums, which the app never displays. NVDA 7,890.00
   is pinned by a shipped test (`broker/genericOptionRow.spec.tsx:77,264`).

---

## 🔴 STILL NEEDS THE OWNER (not the assistant)

1. **DEPLOY.** `convexa.pages.dev` is still the 2026-06-29 build. Roadmap N1, highest-value open item,
   unchanged for weeks — and this session added a full feature it does not have.
   `docs/DEPLOY_RUNBOOK.md`. ⚠ `ALLOWED_ORIGINS` unset now means **deny-all** (fails closed) — correct
   behind the Pages proxy; the runbook's step 4/15 wording is stale.
2. **Nothing is pushed.** `main` is **~11 commits ahead of `origin/main`**, all of this feature. The
   `.claude/` planning writes (contracts, BACKLOG, OPEN_THREADS, PROJECT_CONTEXT, DECISION_LEDGER,
   this file) are **uncommitted**.
3. **Flow the conformance auth fix back to the kit** (`C:\Dev\delivery-kit` → `KIT_BACKLOG.md`). It
   lives only in convexa **again**; the next kit install reverts it a third time.
4. **N2 mirror every real trade** — the outcome ledger is still empty and the edge test cannot start
   without data. **N4 social posting DEFERRED by owner** until personal testing is done.

---

## 🧭 KNOWN-OPEN, NON-BLOCKING (all detailed in §7ab / §7z)

**From this ship (R-1..R-5):** the P/L cascade call zeroes the three net-axis buckets so the transient
default lives in a call-site `??` — one rule, not a complete delegation · **R-2 a genuine spec tension**
between AC-13's "same reason" arm and §2.6's permanence-first rule, diverging on `BOOK_CF_UNPARSEABLE`
(CF-only, unreachable on the real feed) · Layer 1 does not bite the relative import form on the two
presentational modules (Layer 2 covers them) · the group literal drops the leg row's `unpriceableTip` ·
**R-5 → BACKLOG §B `ports-free-is-ipv4-only`.**

**From broker-connect (§7z), still open:** M-2 (SDK's vendored 2018 CA bundle) + M-5 · the AC-3
GET-vs-DELETE in-flight race · `Build reassessment` on `partial` option rows carrying `position: null`
— **owner has still not ruled** · the owner's real book is committed in `positions_raw.json` (repo
verified PRIVATE; revisit before any open-source) · two clean worktrees under `.claude/worktrees/`
safe to prune.

---

## ⚠ BASELINES + TRAPS

**New baselines (beat, don't match):** dashboard **122 files / 1439 tests** · e2e **41** ·
api **272** · lint 0/0 · typecheck 0.

- **⚠ `npm run ports:free` IS NOT TRUSTWORTHY** — it is **IPv4-only** and will report "all clear" while
  IPv6 orphans serve stale code (QA measured three live on `[::1]:4200/4300/4301`, one answering 200).
  Until `ports-free-is-ipv4-only` is fixed, **verify by hand** before any run-the-app pass. Vite binds
  IPv6 here, so this is the common case, not an edge case.
- **`nx typecheck` before ANY green claim** — a green `nx test` does not mean the types are sound;
  bitten three times. If typecheck fails oddly: `rm -rf apps/dashboard/dist`, delete `*.tsbuildinfo`.
- **Check EXIT CODES, not printed summaries** — and not through a pipe (`| tail` masks them; use
  `PIPESTATUS`).
- **NEVER a bare `nx format:write`** — repo-wide; once reformatted 92 unrelated files. Always `--files=`.
- **`nx run-many -t lint` FAILS LOCALLY** — walks gitignored `.claude/worktrees/**`, ~157 phantom
  errors. Use scoped `nx lint @org/dashboard`. CI is unaffected.
- **The Bash tool's `cd` persists between calls.** A `cd` into a subdirectory silently breaks the next
  call's relative paths — prefer absolute paths (bit me this session).
- **e2e is Playwright**; needs `npx playwright install chromium`.
- The owner also runs a **`pdf-translator`** project (port 8001). Never kill its processes.

---

## 🧠 LEDGER CANDIDATE STILL ON WATCH

**`vendor-contract-verified-not-faked`** (1 shipped feature, 3 instances; severity path argued, NOT
promoted) — where our code meets a third-party SDK's return contract, at least one test must exercise
it with a **vendor-shaped object**, not a hand-made fake. **Re-assess at the next vendor-SDK
integration — SnapTrade is exactly it.** Note `broker-option-grouping` did **not** add an instance: it
touched no vendor SDK.

---

## 🗂 REPO STATE

`main`, **~11 commits ahead of `origin/main`**, nothing pushed. Working tree: modified
`.claude/BACKLOG.md`, `.claude/OPEN_THREADS.md`, `.claude/PROJECT_CONTEXT.md`,
`.claude/DECISION_LEDGER.md`; untracked `.claude/RESUME.md`,
`.claude/contracts/_archive/broker-option-grouping/`, and
`.claude/tools/conformance/broker-option-grouping.json` (the promoted spec — **13 specs now**; it
outlives the archived contract as a standing regression).
`origin/feat/responsive-layout` @ `a7b92eb` exists and is identical to local.
