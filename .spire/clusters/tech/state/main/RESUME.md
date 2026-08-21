# RESUME — branch `main` — written 2026-08-14 (post-ship snapshot)

**Resume status:** CONSUMED (as of 2026-08-15)

Conductor snapshot at a clean gateway boundary: **`rec-absence-literals-hole` GATE S closed; GATE I
not yet run.** Overlay on the canon — reconcile against disk.

## Where we are

**Nothing is in flight.** `contracts/` holds only `_archive/` + `_discovery-pack.md`; `IN_FLIGHT.md`
has zero rows. `rec-absence-literals-hole` SHIPPED + ARCHIVED 2026-08-14 (commits `dda02c0`,
`3fae09f`, `c71dffd`, `ace2b6b` backend · `934d8f1` frontend · `35931d8` canon), **committed but
NOT PUSHED — the owner chose that deliberately** (option A: deploy stays their call; push to `main`
triggers Railway + Cloudflare Pages + all three workflows).

Full pipeline: GATE I → council (28 conflicts, 28/28 quotes machine-verified, 9 self-revisions,
13 technical settled in one exchange, 5 product ruled default-with-veto, 2 owner rulings) → S2 ×2 →
R4 ×3 → PLAN (33 tasks) → both lanes parallel → **GATE Q PASS 47/47, 0 FAIL, zero code defects.**
The single bounce was a DESIGN_SYSTEM Amendments row the *conductor* owed, not a lane.

**GATE S graduated `[ai-asserted-numbers-are-traceable]`** (2 binding) — logged at 0 instances
2026-07-16 as aspirational, it reached the bar on **ordinary recurrence**, so the severity-path
question queued in the previous resume **dissolved without needing an owner ruling.** Do not re-ask it.

## Next concrete step

**Either `push` (deploys) or run GATE I for the next feature.** Nothing blocks either.

## Findings this session that outlive the feature — act on these, do not re-derive

1. **`project-context-s2-is-python-era` (BACKLOG §B, NEW — Value H).** `PROJECT_CONTEXT.md` §2
   "Architecture" documents the **FastAPI/Python** backend (`main.py`, `src/core/*.py`) replaced by
   Axum/Tokio Rust and archived to `archive/api-python/`. **23 Python-era markers.** §2 carries
   **eleven of the most-used shard tags**, so `context_for` faithfully serves a deleted backend as
   ground truth to every backend feature. Plausible root cause of finding 2. **Fix before the next
   backend feature; give it its own reviewable diff.**
2. **New watch-list key `cited-code-is-verified-not-assumed`** (1 feature, 3 instances inside it).
   This council asserted three facts about existing code and **all three were false**: `Field` "already
   has test ids" (no `data-testid` prop at all), `LegDraft.right` widenable to `null` (non-nullable —
   would not compile), and the seam named `AiPrefill` when it is `EntryPrefill`. Two caught by the
   skeptic, one by a commissioned self-audit, **none by the authoring voice.** Countermeasure that
   worked: `[lane-check]` marks instead of assertions.
3. **A cached green is not an observation.** QA found `nx typecheck` returning a **cache hit (34 ms)**;
   even `--skip-nx-cache` did no work (245 ms). Only a forced `tsc --build --force` is evidence.
4. **`nx lint` is RED** at `stage3-headings.spec.tsx:278` ("Unexpected empty arrow function"),
   **proven pre-existing** — but a build lane reported "lint green" unverified. **`npm run ci` cannot
   be green today.** One-line fix; folded into `ci-standing-red`.
5. **`contract_lint` M3/M8 still deadlock a GATE-I folder on 3.13.0** — second observation, recorded
   in BACKLOG §E. Non-blocking; propose upstream in `KIT_BACKLOG.md`, never edit `contract_lint.mjs`.
6. **The discovery pack elides the discovery surface.** `context_for --discovery` dropped BACKLOG's
   **Pool (1123 lines)** and the **Ledger (575 lines)** as over-budget; both had to be read directly.
   The escape hatch worked as designed — this is the signal to fix the pack.

## Surviving seams on the shipped feature (OPEN_THREADS §7af has the full list)

- **§9.5 closes in HALF ONE ONLY.** Half two — the inference that *"no clause means checked"* —
  survives until the future-dated **section-level plan-row caption** ships. **Binding record rule:**
  no gate report, ledger row or BACKLOG line may record §9.5 as closed while half two stands.
- The unconditional DTE-window caption still asserts containment without checking it, and
  `{dteMin ?? '?'}` can render a literal `?` as a value.
- The two `quoteTextFor` em-dash sites ship as a **named enumerated exemption**, not a fix.
- `s.confidence` renders under two labels (`Confidence` / `conviction · {level}`).
- R-7's refusal copy is **plan-authored** (SPEC §4 constrains but never spelled it).

## Standing facts (verified this session — do not re-derive)

1. **Auto-deploy triggers on PUSH, not commit.** All three workflows (`ci.yml`, `conformance.yml`,
   `deploy-smoke.yml`) are `on: push: branches: [main]`; Railway and CF Pages build from the repo.
   A local commit deploys nothing.
2. **`struct Setup`** (`libs/quant-engine/src/signals.rs:66`) has non-optional `conviction`/`name`/
   `strategy`/`rationale` at all ten construction sites — so `recommendation.rs`'s three `unwrap_or`
   fallbacks (`:801/:806/:814`) are **dead code**, and those values are **rule-authored, not
   fabricated**. A citation that looks Python-era-stale may just be one crate over: **widen the search
   before convicting.**
3. **The keyless local-rules fixture is not free** — it needs configured key material and consumes a
   cap unit (`recommendation.rs:704`, `llm.rs:114-116`, `:742`); `AI_REC_LOCAL_ONLY=1` with an
   admin-resolved key gives a zero-LLM-cost path.
4. **Dashboard baseline: 1754–1755 passing + exactly 5 accepted pre-existing red files**
   (`readonly`, `positions.risk`, `grouping.integration`, `stage3-amber`, `orders.risk`). A 6th is a
   regression. `app.risk.spec.tsx` is a proven load-sensitive flake.
5. `cargo fmt --check` red on ~54 files (pre-existing) · serve the backend on **:8010+** (a :8000
   orphan may serve stale code) · `ports:free` is **IPv4-only** while Vite binds IPv6 · **exit codes,
   not printed summaries** · **never `git stash`** with parallel lanes.
6. **Artifact budgets were blown deliberately:** the shipped SPEC is 790 lines / ~76KB against a 40KB
   budget. Nothing binding was cut to hit a number, but every downstream reader re-attended it.
