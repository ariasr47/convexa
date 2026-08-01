# Tech debt register — Convexa

> Audited 2026-07-28, against `main` @ `529d7b7`. Scored `(Impact + Risk) × (6 − Effort)`, each 1–5.
>
> **Evidence policy.** Items marked **[measured]** were verified in this repo during the audit — a
> command was run and its output read. Items marked **[carried]** come from `OPEN_THREADS.md` /
> `SECURITY_REVIEW.md` and were **not** re-verified. Don't treat the two as equally fresh.

## Headline

The codebase is in better shape than the register's length suggests. **Zero `TODO`/`FIXME`/`HACK`
markers** in application source, **zero skipped tests**, no committed build output, 1087 frontend tests
green, and CI runs lint + test + build + typecheck + e2e on every push and PR. Most of what follows is
**config and process debt, not code rot.**

The two most valuable items are also among the cheapest: a source file that **git renders as binary, so
changes to it cannot be code-reviewed**, and completely unpinned Python dependencies.

**Re-ranked 2026-07-28.** The `sources.ts` item was first filed as a grep nuisance scoring 30. On closer
inspection the grep half was overstated and the `git diff` half was missed entirely — it is now #1 at 40.
The register's own numbering below (`### 1`, `### 2`, …) follows the table.

---

## Ranked

| # | Item | Type | I | R | E | Score |
|---|---|---|---|---|---|---|
| ~~1~~ | ~~`outcomes/sources.ts` **reads as a binary file**~~ — ✅ **FIXED `98c29ae`** | Code | 3 | 5 | 1 | ~~40~~ |
| ~~2~~ | ~~Python dependencies are **completely unpinned**~~ — ✅ **FIXED `65526ee`** | Dependency | 3 | 5 | 2 | ~~32~~ |
| ~~3~~ | ~~e2e asserts no-overflow at **one breakpoint only**~~ — ✅ **FIXED `bb821d6`** (md+lg gated; the md overflow fixed with it) | Test | 2 | 3 | 1 | ~~25~~ |
| ~~4~~ | ~~Canon says "CI not wired" — **it is**~~ — ✅ **FIXED `6fda9b7`** | Docs | 2 | 3 | 1 | ~~25~~ |
| 5 | No CD: live site is **29 days behind `main`** | Infra | 4 | 4 | 3 | **24** |
| ~~6~~ | ~~6 security fast-follows~~ — ✅ **ALL 6 RESOLVED** — `b136a77` (CORS/docs/wildcards) + `86adf3b` (S5c ceilings) + `41a4c96` (a HIGH bypass this work surfaced) | Security | 2 | 4 | 2 | ~~24~~ |
| 7 | Conformance check is **not in CI** | Infra | 2 | 3 | 2 | **20** |
| ~~8~~ | ~~`nx format:write` repo-wide hazard undocumented~~ — ✅ **FIXED `e66e7ff`** (CLAUDE.md "Traps" + eslint worktree ignore) | Docs | 2 | 2 | 1 | ~~20~~ |
| ~~9~~ | ~~**Backend has zero automated tests**~~ — ✅ **FIXED `f7f6996`** (27 characterization tests pinning the scoring path; mutation-checked 3 ways) | Test | 4 | 5 | 4 | ~~18~~ |
| 10 | npm dependency drift | Dependency | 2 | 2 | 2 | 16 |
| 11 | 2 timing-flaky specs on cold runs | Test | 2 | 2 | 2 | 16 |
| 12 | Conformance runner is cookieless | Security | 2 | 3 | 3 | 15 |
| 13 | Orphaned dev servers hold ports | Infra | 2 | 1 | 1 | 15 |
| 14 | No auth schema-migration path | Architecture | 3 | 4 | 4 | 14 |
| 15 | 27 accepted lint warnings | Code | 1 | 2 | 2 | 12 |
| 16 | >500kB JS chunk, no code splitting | Code | 2 | 2 | 3 | 12 |
| 17 | AI metering counters are process-local | Architecture | 1 | 3 | 3 | 12 |
| 18 | Four modules over 1200 LOC | Code | 3 | 2 | 4 | 10 |
| 19 | Stale brand refs in `apps/api/README.md` | Docs | 1 | 1 | 1 | 10 |
| 20 | Five copy constants defined but unwired | Code | 1 | 1 | 2 | 8 |
| 21 | Durable stores are browser-local only | Architecture | 3 | 4 | 5 | 7 |

⚠ ~~**#9 is mis-ranked by the formula**~~ — it was, and it was done anyway (`f7f6996`), ahead of higher-scoring items, precisely because the formula under-ranked it.

---

## The items that matter

### 1. `outcomes/sources.ts` reads as a BINARY file — score 40 — ✅ **FIXED 2026-07-28 (`98c29ae`)**

**Corrected 2026-07-28 after looking harder.** My first write-up said grep "skips" the file. That
overstated one half and missed the more serious half. What is actually true, all verified:

Two **literal NUL bytes** sit at offsets 6347 and 6363 — line 130, inside `decisionIdentity`'s composite
key: `` `k:${d.trade_id}<NUL>${d.event_type}<NUL>${d.clock_time}` ``. Pre-existing (`git show HEAD`
confirms). Every tool that auto-detects binary content mis-classifies this 223-line TypeScript file:

| Tool | Behaviour |
|---|---|
| `grep -rn` (the usual sweep form) | **Matches, but refuses to print the lines** — `Binary file … matches`, no line number, no content |
| `grep -c` / `grep -l` | Work normally |
| `grep -a` | Works fully — but only if someone thought to pass it |
| ripgrep-backed agent search | Returns `binary file matches (found NUL byte around offset 6347)` — a hit with **no content** |
| **`git diff`** | **`Binary files a/… and b/… differ`** — **no line diff at all** |

**The `git diff` row is the real cost, and it is not hypothetical.** Commit `6260d92` — the
`positions-legs` **cutover**, the highest-risk change in that feature — modified this file, and that
modification is **unreviewable**: the diff renders as "binary files differ". The same will apply to every
future PR touching it on GitHub. A module that reads the user's durable blobs and reports per-source
success is precisely the one you most want a line diff for.

**The grep half is real but milder than I first claimed.** You do get a signal (`Binary file … matches`),
so a sweep is not silently empty. The genuine hazards are (a) losing line numbers and content, so a sweep
cannot say *where*; (b) tooling that parses grep output positionally — `| cut -d: -f1`, a script pulling
line numbers — silently drops the non-conforming binary notice; (c) an agent-driven audit gets a match
with no content and may reason on it as though empty.

**Fix:** replace the two raw NULs with a printable delimiter, or with the two-character escape `\` + `0`
so the source stays text. **Effort: minutes.** Verify by confirming `git diff` renders a normal line diff
afterwards — that is the acceptance test, not the grep behaviour.

### 2. Python dependencies are completely unpinned — score 32 — ✅ **FIXED 2026-07-28 (`65526ee`)**

**All 15** entries in `apps/api/requirements.txt` carry **no version constraint whatsoever** — `numpy`,
`scipy`, `fastapi`, `uvicorn`, `pydantic`, `anthropic`, `psycopg`, `cryptography`, `argon2-cffi`,
`authlib`, `massive`, and the rest.

**Why it matters commercially.** `apps/api/Dockerfile` installs from this file, and Railway builds that
image. So **your production build is not reproducible**: two deploys of the same commit can install
different library versions, and a breaking major release lands in production silently, at whatever
moment you next deploy. Pydantic and FastAPI in particular have shipped breaking majors. You would find
out from a failed boot or, worse, from changed numbers.

**Fix:** `pip freeze` the working venv into pinned versions, keep the human-readable file as
`requirements.in` if you want the comments. **Effort: under an hour.** This is the single best
risk-per-minute item in the register.

### 3. e2e asserts no-overflow at one breakpoint only — score 25 — ✅ **FIXED 2026-07-28 (`bb821d6`)**

The shipped no-overflow suite checks **393px and nothing else**. Consequence, observed twice during
`positions-legs`: the `/positions` page has been overflowing at 900px for an unknown length of time
without anyone noticing, and the new max-loss column had to bounce **twice** because layout headroom
was never under test.

**Fix:** ✅ **DONE.** Root cause was ONE element — `CustomizationToolbar`'s control row had
`flexWrap: { xs: 'wrap', sm: 'nowrap' }`, so wrapping switched off at **600px** while the row needs
~934px: the whole **600–1199px band** could not wrap and pushed the entry CTA off-screen. Now wraps
until `lg`. e2e gained md (900) + lg (1280) across all five routes with `/positions` seeded —
**29/29, up from 19.**

### 4. The canon states something false about CI — score 25 — ✅ **FIXED 2026-07-28 (`6fda9b7`)**

`OPEN_THREADS.md` §8 says *"CI/CD not wired: push ≠ deploy… A GitHub Actions workflow is the standing
follow-on."* **`.github/workflows/ci.yml` has existed since 2026-07-22** and runs, on every push to
`main` and every PR: `format:check`, then `lint test build typecheck` across all projects, then the
Cypress e2e suite.

**Why it matters more than a typo.** This project's own rule is that memory must track truth, not just
recurrence — a promoted rule contradicted by reality gets demoted, not left standing. A canon entry
that under-describes your safety net invites someone to rebuild it. Note also that **CI runs
`typecheck`**, so the type error that failed GATE Q this week would have been caught on push anyway.

**Fix:** ✅ **DONE 2026-07-28** — §8 rewritten to say CI exists and to name what is genuinely missing:
**conformance-in-CI** (#7) and **CD** (#5).

### 5. No CD — the live site is 29 days behind — score 24 **[measured]**

`convexa.pages.dev` serves the 2026-06-29 build. `main` is at 2026-07-28 and now carries the scanner,
both event features, the whole Curvature Terminal redesign, and multi-leg positions — **including two
data-loss repairs that users of the live build do not have.**

**Why it matters.** Every day of drift makes the eventual deploy bigger and scarier, which makes you
defer it again. That is the loop that turns a deploy into an event.

**Fix:** extend `ci.yml` with a deploy job gated on the existing green checks, or commit to running
`docs/DEPLOY_RUNBOOK.md` on a fixed cadence. **Effort: half a day for automation.** The runbook is
current and was exercised for real in June.

### 9. The backend has zero automated tests — score 18 — ✅ **FIXED 2026-07-28 (`f7f6996`)**

`apps/api` has **52 source files and 0 test files**. `CLAUDE.md` states this openly: verification is
by app-run plus `interface_conformance.py`.

**Read this one past its score.** The effort multiplier drags it to 9th, but by impact and risk it is
arguably #1: the scoring engine is the thing every single feature must keep byte-identical, and that
property is currently proven **ad hoc, per feature**, by whoever happens to be building — a live A/B
here, a git-worktree A/B there. It has held so far because the discipline around it is unusually good.
It is one distracted session away from not holding.

**Fix, incrementally:** you do not need broad coverage. You need a **characterization test** that pins
`opportunity_score` / `state_fingerprint` for a handful of recorded bundle fixtures, so byte-identity is
asserted by `pytest` on every push instead of re-proved by hand each time. **Effort: 1–2 days for the
harness plus fixtures**, and it retires a recurring per-feature cost.

---

## Everything else, briefly

**Security [carried, not re-verified]** — 3 MED + 3 LOW from `_archive/deploy/SECURITY_REVIEW.md`:
CORS defaulting to localhost in prod, `AUTH_COOKIE_SECURE` misconfiguration risk, no SSE connection
ceiling, public OpenAPI docs, broad CORS methods/headers, Google OAuth state cleanup. None was a
go-live blocker; all become more relevant the moment the site gets real traffic. Related: the
conformance runner is **cookieless**, so auth-gated endpoints are verified by runtime and FE tests
rather than by the sweep.

**Dependencies [measured]** — npm drift is healthy, not rot: patch/minor across Nx 23.0→23.1,
React 19.0→19.2.8, MUI 9.1.1→9.2.0, Vitest, Cypress, Prettier. One major waiting: `@babel/core` 7→8.

**Code [measured]** — four modules over 1200 LOC (`TradeEntryDialog.tsx` 1370, `convexa.ts` 1276,
`AiRecPanel.tsx` 1248, `ai_recommendation.py` 922). None is *incoherent* — they are large because they
are complete — so this is watch-don't-act until one of them resists a change. 27 accepted lint warnings,
almost all non-null assertions. Five `POSITION_EVAL_NONE_*` constants are deliberately unwired pending
the alert surface — **not** dead code, but they will read as dead to a future reader if that surface
never lands.

**Architecture [carried]** — no schema-migration path for the auth Postgres tables (bootstrap is
`CREATE TABLE IF NOT EXISTS`, so a column change has no story); per-admin AI metering counters are
process-local and wrong across replicas; the heavy durable stores live in one browser, unsynced and
untied to the account — that last one is the real product limit, and it is a feature, not a cleanup.

---

## Phased plan

Sized to run **alongside** feature work, not instead of it.

### Phase 0 — ✅ COMPLETE 2026-07-28

_Was: one sitting, roughly half a day._
Items **1, 2, 4, 8** (now: de-binary , pin the Python deps, and the two doc fixes). Pin the Python deps, de-binary `sources.ts`, correct the CI claim in §8, and write
the `format:write` hazard into `CLAUDE.md`. All four are config or prose, none touches application
logic, and together they close the highest-scoring risks in the register.

### Phase 1 — fold into the next feature's verification pass
~~Items **3, 7, 11**~~ — **#3 DONE 2026-07-28 (`bb821d6`)**. Remaining: **7** (conformance in CI) and
**11** (the two cold-run flaky specs). Originally items **3, 7, 11**. Extend the no-overflow e2e to `md`/`lg`, add the conformance sweep to `ci.yml`, and
chase the two cold-run flaky specs. These are natural companions to any FE feature's QA gate — do them
when a lane is already in the test harness.

### Phase 2 — one deliberate slice, own branch
Items **5, 9**. CD automation and the backend characterization harness. These deserve their own
attention and their own verification; they are not "while you're in there" work. **Do #9 before the
next feature that touches scoring** — it is the one that stops a recurring manual cost.

### Phase 3 — pull, don't push
Items **10, 12, 14, 16, 17, 18, 21**. Do these when something concrete asks for them: bump npm when a
CVE or a needed feature lands; add auth migrations when the schema first has to change; split the big
modules when one actually resists a change; make the stores account-scoped when multi-device becomes a
real requirement rather than a nice idea.

---

## What this register is not

It is a **snapshot**, not a monitor. Nothing here re-checks itself. If it is still being cited in three
months without a re-audit, treat every **[carried]** line as suspect and re-run the **[measured]** ones —
the CI entry in this very document is an example of how fast a confident statement about tooling goes
stale.
