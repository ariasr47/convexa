# DECISION LEDGER — compounding memory (standing reference)

> How the system gets wiser per feature. The conveyor between a one-off decision and the shared
> rulebook, triggered by **recurrence**.
>
> **CAPTURE** — at every gateway the Orchestrator appends each *binding* decision it locked as a row
> below (stable `key` · feature · gate · statement · binding). **DETECT** — at **GATE S** it tallies
> the rows. **GRADUATE** — any key crossing the threshold is promoted into the canonical rulebook.
> **REUSE** — a feature's `BRIEF.md` cites promoted keys in "Invariant watch"; each role restates the
> ones it touches; ORCHESTRATOR §6 forbids reopening them. So each ship can only *add* to the
> constraint envelope the next feature inherits.

## Promotion rule
- **Threshold (recurrence path):** a key present in **≥3 distinct shipped features**, OR **≥2 if every
  instance is `binding:yes`**, graduates at the next GATE S.
- **Threshold (SEVERITY path — added 2026-07-16, owner canon review):** a key whose violation is
  **catastrophic AND irreversible** (silent, unrecoverable loss of user data; a real-money or
  security boundary breached) graduates on **1 instance** — or on **0**, by explicit owner decision at a
  canon review — **without waiting for recurrence**.
  **Why this exists (the flaw it fixes):** recurrence is a *proxy* for importance, and it was mis-ranking.
  It had promoted `single-shared-sim-entry-dialog` — a **dialog** — to constitutional law at 2 instances,
  while `loss-free-durable-migration` sat at 1 on the watch list, guarding ~5 durable localStorage stores
  that hold the user's **entire trading history with no server backup** — where a single migration bug is a
  silent, total, unrecoverable loss. **When the importance is already known, do not wait for the proxy.**
  Recurrence still governs the ordinary case; severity is the override, and the promoting session must
  **write down the catastrophic+irreversible justification** (the bar — not merely "important").
- **Binding-only intake:** only a decision a *future feature could violate* enters the ledger (same
  bar as the GATE I decision-impact cull). Incidental implementation choices are not logged.
- **Owner canon review is a legitimate source of canon** (2026-07-16): a rule may also be promoted or
  narrowed by explicit owner decision at a review, recorded with its rationale in the `earned by` column —
  distinct from, and not a substitute for, recurrence-graduation at GATE S.
- **⚠ Kit divergence (logged, not resolved):** the framework's `ORCHESTRATOR.md` §3a/§6 still states the
  recurrence-only rule. `ORCHESTRATOR.md` is a **delivery-kit framework file** (byte-identical across
  consumers — system-13), so this project must NOT edit it in place; the severity path is a framework
  improvement that flows back via `KIT_BACKLOG.md` + `extract.mjs`. Until then the ledger (project-owned)
  is ahead of the framework prose. See BACKLOG §E system-13.
- **Single-source:** a promoted rule's **prose lives once** in `PROJECT_CONTEXT.md` §5 (+ a locked
  pointer in `OPEN_THREADS.md` §9). This ledger only **indexes** it — never a second copy (drift risk).
- **Contestable:** a promoted rule is a default, not a cage — reopen via **GATE Z**; the Orchestrator
  then updates/demotes it here and in the canon. Provenance (the earning rows) is retained.

## Promoted canon (key index → where the rule lives)
| key | rule (one line) | lives in | promoted | earned by |
|-----|-----------------|----------|----------|-----------|
| `best-effort-isolated-or-null` | an optional/added computation fails to a null/omitted field, **never an HTTP error**; `market_state`/`strike_profile` + SSE stay intact | CONTEXT §5 · THREADS §9 | 2026-06-22 | dark-pool, dex-voloi-skew-term, trade-tracker-sim, backend-observability, trader-personas (5) |
| `additive-keeps-score-byte-identical` | an additive feature leaves gate / `opportunity_score` / `opportunity_tier` / `state_fingerprint` **byte-identical**; never a scoring input | CONTEXT §5 · THREADS §9 | 2026-06-22 | dex-voloi-skew-term, trade-tracker-sim, backend-observability, trader-personas (4) |
| `live-vs-static-isolation` | every datum declares live-derived vs static; live UI degrades on SSE drop (dim+offline, never blank) while static reads keep rendering | CONTEXT §5 · THREADS §9 | 2026-06-22 | dark-pool, dex-voloi-skew-term, trade-tracker-sim, trader-personas (4) |
| `operator-vs-trader-path-separation` | an operator/diagnostic surface stays off every trader/bundle route + unlinked from the trader UI; read-only + side-effect-free (no vendor fetch / recompute / cache mutation / trader-route call); trader path + SSE untouched | CONTEXT §5 · THREADS §9 | 2026-06-23 | backend-observability, latency-visualizer (2 binding) |
| `no-real-order-path` | "action" never reaches a real broker/order path: a simulated feature stays `SIMULATED` (paper) + mandatory-confirm; a not-yet-built real surface (e.g. a "Live" tab) ships as a **non-functional placeholder** with no broker, no order/execution path, no real-position data source | CONTEXT §5 · THREADS §9 | 2026-06-24 | ai-recommendations, positions-portfolio (2 binding) |
| `server-side-gate-enforcement` | an access gate on a state/cost-bearing action is enforced **server-side** (the server is the boundary of record), never FE-only; the FE check is for UX, not enforcement — a bypassed client check must still be rejected by the server | CONTEXT §5 · THREADS §9 | 2026-06-29 | user-accounts (AC-E7 catch), byo-ai-key (2 binding) |
| `secret-encrypted-at-rest` | a stored recoverable secret (a user/third-party API key, broker token, etc.) is **ENCRYPTED at rest** (symmetric, server-side key — NOT hashed), and **never logged / returned in a response / sent to the browser**; write-only from the client (masked hint only) + rotate/delete; persisted as **ciphertext only** (the crypto boundary sits before the store); a decrypt-fail is treated as no-usable-secret, never a leak | CONTEXT §5 · THREADS §9 | 2026-06-29 | byo-ai-key, persistent-db (2 binding) |
| `no-secrets-in-image` | a build/deploy artifact (container image, pushed repo) carries **NO secret**: `.dockerignore` excludes `.env*`/`.venv`/credential files, no `COPY .env`, no secret literal, no hardcoded backend URL; ALL config + secrets injected at **runtime via env** (host Variables / Pages env), values owner-entered; images run **non-root** | CONTEXT §5 · THREADS §9 | 2026-06-29 | containerize-apps, persistent-db, deploy (3 binding) |
| `production-fails-closed` | a production process proves every required durable/configuration prerequisite before workers or a listener start; missing, stale, divergent, unavailable, or unverifiable state is a startup refusal, never a development fallback | CONTEXT §5 · THREADS §9 | **2026-08-22** | production-runtime-guardrails, postgres-release-safety (2 binding). Graduated by `ledger_tally` at `postgres-release-safety` GATE S |
| `single-shared-sim-entry-dialog` | **SIM-ONLY (narrowed 2026-07-16).** Every **simulated** entry flow (ghost trade, positions, act-on-rec/orders) launches THE one shared `app/features/trading/TradeEntryDialog`; a new **sim** entry shape is an additive VARIANT of it (props/modes), never a forked second dialog; dead forks are deleted with zero-importer proof. **A REAL-money entry surface is explicitly OUT of scope and MUST be a separate component** — see the narrowing note under the table | CONTEXT §5 · THREADS §9 | 2026-07-02 · narrowed 2026-07-16 | sim-entry-unification, ai-rec-backtest-orders (2 binding); narrowed by owner canon review |
| `loss-free-durable-migration` | when a durable client store's key/shape changes, existing user data is carried forward **loss-free** — read-new-else-old, promote-forward, **never-delete**, idempotent, never-throw — composing with any prior version chain; a corrupt/unreadable blob degrades to empty **without destroying the original** | CONTEXT §5 · THREADS §9 | **2026-07-16 (SEVERITY path, 1 instance)** | rebrand-convexa (the `resolveDurable` helper + the positions v1→v2 chain). Promoted by owner canon review on severity, not recurrence: ~5 durable localStorage stores hold the user's entire trading history with **no server backup**; violation = silent, total, irreversible loss. |
| `score-change-is-deliberate-and-measured` | the `opportunity_score`/`tier`/gate **MAY** evolve — but **only deliberately**: via an explicit score-changing feature that states its rationale, records a **before/after on real tickers**, and **version-bumps** the fingerprint basis. A score change is **never** a side effect of an additive feature (that is `additive-keeps-score-byte-identical`), and never lands unmeasured | CONTEXT §5 · THREADS §9 | **2026-07-16 (owner canon review)** | The counterpart `additive-keeps-score-byte-identical` lacked: 8 enrichment features shipped (dex-voloi-skew-term, dealer-flow-projection, ai-context-pack, iv-rank, …) and **none could reach the score**, which went unchanged for 210 commits. Fills the gap; does not weaken the additive rule. |
| `theme-token-discipline` | a new or re-skinned FE component binds to the MUI theme / `tokens.ts` — mode-aware values via `extrasFor(theme)` inside sx callbacks — **never hardcoded hex**; dark/light parity verified | CONTEXT §5 · THREADS §9 | 2026-07-02 | convexa-redesign, ticker-ux-polish, light-mode-parity + sim-entry-unification, ai-rec-backtest-orders (4 programs) |
| `model-read-carries-its-assumptions` | a forward-looking / model-dependent read (a projection, a model-derived level, a threshold-bucketed regime label/scalar) is surfaced **self-describing** — it carries its own horizon / window / assumption / basis / threshold — and is framed as **advisory context, never a guarantee / price forecast / scored signal** | CONTEXT §5 · THREADS §9 | 2026-07-06 | dealer-flow-projection, ai-context-pack, iv-rank (3) |
| `digested-labels-not-raw-dump` | a derived-signal set fed to the downstream AI (and displayed) is a **SMALL orthogonal set pre-digested into regime/band LABELS**, not a raw indicator/OHLC/series dump; the **wire enum/token is authoritative** (FE renders via a closed lookup, **never re-derives** a label from the scalar); no raw series on the wire or in the UI | CONTEXT §5 · THREADS §9 | 2026-07-07 | ai-context-pack, iv-rank (2 binding) |
| `absent-is-not-none` | a surface that can be **uncurated, unattempted or inapplicable** distinguishes **"we do not know"** from **"we checked and there is nothing"**, and carries that distinction **to the consumer** rather than collapsing it at a boundary; enforced in the **type or the closed vocabulary**, never in prose. Prevents a **fabricated claim**, not merely a gap | CONTEXT §5 · THREADS §9 | **2026-07-28** | bundle-events, expiration-events, positions-legs (3 binding). Held at 2 on 2026-07-27 because both instances came from **the same feature family on the same day**; the watch-list entry said *"re-assess when an unrelated feature needs it."* `positions-legs` is that feature — the rule carried out of backend wire-config into the **client render** with four independently-assertable not-a-number literals. Generality demonstrated, not assumed |

| `structural-over-prose-enforcement` | an invariant is enforced by **construction** — type, module boundary, empty diff, mutation-tested scan, build-breaking lint — not by **prose an implementer must remember**; where both exist, prefer the shape that makes the violation **impossible or build-breaking**. **The bar: poison what the rule forbids and the build must go red, and the poison test must itself be proven non-vacuous** | CONTEXT §5 · THREADS §9 | **2026-08-06** | outcome-ledger, scanner, positions-legs, broker-option-grouping (4 features). **Held back THREE times** on the stated objection that it was "a design heuristic without a crisp violation test" — the entry each time said volume was not the missing piece, a statable bar was. `broker-option-grouping` supplied it, and supplied the argument for why prose could never have sufficed: `structure.ts:153` falls back to `custom` **only** because a vendor field is null today, so the forbidden name would appear **by itself, with nobody deciding it**, the day the field arrives. Promoted on the bar, not on the count |
| `single-motion-moment` | the app has **ONE orchestrated motion moment**; the app-wide keyframe inventory is **set-equality pinned** so a new family is **build-breaking**; surviving motion is that moment or a **data signal** by recorded decision, never decoration; all of it respects a shared `useReducedMotion` | CONTEXT §5 · THREADS §9 | **2026-08-06** | redesign-stage-2, redesign-stage-3 (2 binding). **Crossed the threshold at redesign-stage-3 on 2026-07-22 and was MISSED at that GATE S** — surfaced by `ledger_tally` at the `broker-option-grouping` ship and graduated then. Exactly the miss the mechanical tally exists to prevent; the counting was already code, but the tally was not run at that ship |
| `dark-pool-context-only` | off-exchange / dark-pool is **context only** — capped confluence, toggleable, never a directional smart-money signal; block prints display-only and unscored; no-side chips must not render success green | CONTEXT §5 · THREADS §9 | **2026-08-11** | dark-pool-stream-isolation, redesign-stage-3 (2 binding). Long-standing prose in §5/§9; formal key graduation via `ledger_tally` at `distance-to-level-tiles` GATE S (the prior "pre-existing canon" note was not in this table, so the tally kept marking GRADUATES) |
| `ai-asserted-numbers-are-traceable` | every number or field the in-app AI **asserts** is traceable to a computed bundle field, and every field it **omits** says so in a **closed vocabulary** rather than a mark meaning something else; an untraceable figure is never rendered as fact, an absent one never as a **reserved literal of another state** and never **pre-typed into a tradeable input** by default, inference or chain-derived fallback | CONTEXT §5 · THREADS §9 | **2026-08-14** | ai-rec-grounding (per-figure grounding; **44.4% of asserted numbers measured untraceable**), rec-absence-literals-hole (the absence half — six fields, one new vocabulary member, the Accept seam) — **2 binding**. Logged at **0 instances** 2026-07-16 as explicitly aspirational ("an aspirational rule is not canon"); the queued severity-path question dissolved when the 2nd instance arrived, so it graduated on **ordinary recurrence** exactly as the rule intends |
| `cited-code-is-verified-not-assumed` | a design or plan artifact must not assert a fact about **existing code** it will reuse unless that fact was **read at source**; unverifiable claims carry a `[lane-check]` mark instead of being asserted | CONTEXT §5 · THREADS §9 | **2026-08-17** | rec-absence-literals-hole (1st instance — 3 false citations inside one council), rec-plan-scope-caption (2nd — PLAN locked attachment against live `DecisionCard.tsx`, not Python-era `AiRecPanel`) — **2 binding**. Graduated by `ledger_tally` at this GATE S |

| `local-evidence-is-not-hosted-evidence` | a local or quality-gate result is never labeled hosted/CI unless that run happened there; a CI load is never soak evidence; ambient `CI=true` is not merge-job evidence | CONTEXT §5 · THREADS §9 | **2026-08-29** | browser-quality-gates (hosted browser `NOT RUN`), capacity-baseline (load vs soak vs local vs ci; D4 release CI) — **2 binding**. Graduated by `ledger_tally` at `capacity-baseline` GATE S |
| `present-is-live-paid-only` | a session-archive `present` / live paid book is a loadable `LiveMassive` body; fixture, reconstructed, flat-file, tape, seed, and replay occupancy never insert as `LiveMassive` | CONTEXT §5 · THREADS §9 | **2026-08-30** | archive-coverage-guardrails (blocked occupancy), session-day-tape-capture (Path-B drops source kind; operator never `live_massive`) — **2 binding**. Graduated by `ledger_tally` at `session-day-tape-capture` GATE S. 3rd instance: `day-replay-mock-adapter` (armed walk never LiveMassive). 4th: `massive-flat-file-keep` (extracts never LiveMassive / `kept` ≠ `present`). 5th: `research-lab-surface`. 6th: `exchange-holiday-calendar` (holiday weekday never `present`) |
| `single-ticker-on-demand` | the trading/serve REQUEST PATH computes exactly the one ticker asked for; multi-ticker work is a bounded off-request-path worker | CONTEXT §5 · THREADS §9 | **2026-08-30** | liquid-names-session-capture (ensure off-path), session-day-tape-capture (tape sidecar off request path) — **2 binding**. Long-standing narrowed prose in §5; formal key graduation via `ledger_tally` at this GATE S |
| `route-growth-repins-api-artifact-oracle` | a change that grows or alters the API surface regenerates the OpenAPI artifacts through the repository pipeline (never by hand) and re-pins the artifact-oracle hashes in the SAME commit, with a dated comment saying why; the oracle checks pairing and drift, never a frozen count | CONTEXT §5 · THREADS §9 | **2026-09-24** | mainline-integration-2026-09 (52→57 identity re-pin), no-vendor-production-posture (`9a5748e2`, `117b7c72`) — **2 binding**; graduated by `ledger_tally` at its GATE S |
| `a11y-gate-scans-both-schemes-and-overlays` | the accessibility gate scans every shipped surface and every new user-facing state in BOTH colour schemes, including the overlays and gated states the surface can present (wall, degraded wall, dialog, paused panel); a finding the widened matrix exposes is fixed, never waived | CONTEXT §5 · THREADS §9 | **2026-09-24** | curvature-v2-landing-and-site (28/56 light-scheme failures found; 12→24 scans), no-vendor-production-posture (paused-desk scans A11Y-25..28; light top-nav 3.23:1 fixed) — **2 binding**; graduated by `ledger_tally` at its GATE S |

> Pre-existing canon (recorded by the ledger, already a rule before it existed — not re-promoted):
> `gamma-sourcing-split` (CONTEXT §3 / THREADS §9).
> (`ai-external-no-llm` was here until **2026-06-23** — now **DEMOTED / narrowed** by `ai-recommendations`;
> see the Demoted table.)

### Narrowing note — `single-shared-sim-entry-dialog` (2026-07-16, owner canon review)
**Narrowed in place, NOT demoted** (precedent: the `live-spot=NBBO-mid` narrowing — the rule still fully
holds for everything it was earned on; only its *scope* is made explicit before it is misapplied).
**Why:** the key was promoted on 2 instances of what is really a good local refactor, and — uniquely among
the promoted set — it names a **file** rather than stating a **principle**. Left un-narrowed it was on a
collision course with `no-real-order-path`: `apps/dashboard/src/app/README.md` already described
`TradeEntryDialog` as *"the ONE shared **sim/live** entry surface"*, so at `broker-connect` the rule would
have pushed **real-money entry into the same component as paper trades, as an "additive variant."** That is
backwards. The one place a fork is a **feature, not a smell**, is the boundary between "this is pretend" and
"this moves real money" — a shared component there invites the single most expensive confusion the app can
produce, and `no-real-order-path` exists precisely to keep that boundary hard.
**The narrowed rule:** sim-entry flows share the ONE dialog (unchanged). **A real-money/broker entry surface
MUST be a structurally separate component** — never a mode, prop, or variant of the sim dialog. Deciding
otherwise is a deliberate GATE-Z reversal, not a default.
**Follow-through:** the README line was corrected 2026-07-16. No code change — `broker-connect` is unbuilt,
which is exactly why this was cheap to fix now.

## Demoted (contradicted by reality — system-7)
> The inverse of graduation: memory must track **truth**, not just recurrence. A promoted invariant that
> reality contradicts — an **accepted GATE Z amendment**, or a **GATE Q QA/conformance FAIL** proving it
> false or over-general — is demoted: its prose is **removed (or narrowed)** in `PROJECT_CONTEXT.md` §5
> + `OPEN_THREADS.md` §9, its key moves out of "Promoted canon" into the table below, and its earning
> rows stay in the Ledger as provenance. **Bar (mirrors promotion):** demote only when the *rule itself*
> is shown wrong/over-general — a single feature's legitimate carve-out is an **exception** noted on that
> feature, NOT a demotion. (`contract_lint.py`'s canon check follows automatically — a demoted key leaves
> the Promoted-canon table, so it is no longer expected in canon prose.)

| key | demoted | contradicting evidence (feature · gate) | disposition |
|-----|---------|------------------------------------------|-------------|
| `ai-external-no-llm` | 2026-06-23 | `ai-recommendations` · GATE S — owner decision (2026-06-23): GammaFlow now CALLS an LLM in-app for a risk-first entry rec. Contradicts the absolute "does not call an LLM." | **NARROWED, not erased.** New rule: GammaFlow MAY call an LLM **only** as a best-effort, isolated, gated, **advisory consumer** of already-computed state (never a scoring/gate/fingerprint input, no recompute, off the SSE path, server-side key, no auto-act, no real order); the AI is otherwise external + the manual hand-off remains valid. Prose narrowed in CONTEXT §8. Earning rows (trade-tracker-sim, trader-personas — "no LLM call") retained as provenance: they still comply (they made no call). |

### Candidate — `vendor-contract-verified-not-faked` (broker-connect, 2026-08-05; SEVERITY path argued)
**The rule:** where our code meets a THIRD-PARTY SDK's return contract, at least one test must
exercise that contract with a **vendor-shaped object**, not a hand-made fake. A fake transport that
returns tidy dicts tests our mapping and nothing else — it structurally cannot see what the vendor
actually hands back.
**Earned the hard way, twice in one feature, both live-only failures behind a fully green suite:**
1. **S-1 (Critical).** `_shim_sdk_compat()` restored `six`/`cgi` but not the vendored `ssl` names
   Python ≥3.12 removed, so the shipped adapter **could not complete a single HTTPS request** —
   surfaced as a generic `adapter_fault`, indistinguishable from a broker outage. The *capture tool*
   had the shim; the product's copy had silently diverged. A third casualty (`HAS_SNI`) would have
   produced SNI-less TLS — intermittent, and worse than the total failure.
2. **The Response-object bug.** `ApiClient.get_response()` returns the transport OBJECT, not parsed
   JSON. The adapter passed it to the mappers, which correctly answered "nothing here" — so a
   healthy 13-position book read as `adapter_fault` + "no account id". **The identical defect had
   already been found and fixed in the capture tool** (`3416ef3`); the product carried its own copy.
**Both were product/tool divergences of code that was supposed to be one implementation** — which is
why the fix in both cases was to make it literally one (`_shim_sdk_compat` now lives in the product
and the tools import it; `_parsed` is the single decode point). The R8 cross-ticker bug the same week
was a THIRD instance of the same shape: two "deliberate mirrors" that drifted, fixed by extracting a
shared resolver.
**Severity argument:** the failure mode is a feature that is 100% dead in production while every
gate reports green, and it degrades into a *plausible* error state rather than a loud one — the
operator cannot tell "broken build" from "broker is down". Not yet promoted: it has 1 shipped
feature (3 instances within it). **Re-assess at the next vendor-SDK integration** — SnapTrade would
be exactly it.

## Watch list (keys logged, not yet at threshold)
- `demo-live-boundaries-are-disjoint`: 1 binding decision (`portfolio-demo-platform`, active VERIFY).
  Demo composition, transports and browser keys stay isolated; unsupported operations refuse locally.
- `public-demo-is-authored-synthetic`: 1 binding decision (`portfolio-demo-platform`, active VERIFY).
  Public samples are authored independently of owner records; display and exports retain sample provenance.
- `static-preview-does-not-migrate-backend`: 1 binding decision (`portfolio-demo-platform`, active VERIFY).
  Static Pages preview scope excludes Railway migration and production data; no backend execution is implied.
- _(`route-growth-repins-api-artifact-oracle` and `a11y-gate-scans-both-schemes-and-overlays` GRADUATED
  2026-09-24, each with 2 binding features. See Promoted canon above.)_
- `vendor-absence-is-a-named-state`: 1 binding (no-vendor-production-posture, 2026-09-24). A data source
  absent by decision is a named state with a typed code, zero contact and calm non-retrying UI; it is
  never a transient-failure message.
- _(`single-shared-sim-entry-dialog` GRADUATED 2026-07-02 — 2 binding (sim-entry-unification created
  the single dialog + deleted the forks; ai-rec-backtest-orders honored it via the additive order
  variant, contract-mandated "do not fork"). Now in Promoted canon above.)_
- _(`theme-token-discipline` GRADUATED 2026-07-02 — held across convexa-redesign (logged), the
  ticker-ux-polish program ("held again"), light-mode-parity/sim-entry-unification (the `extrasFor`
  mechanism itself), and ai-rec-backtest-orders (token-only orders module). ≥3 shipped features →
  Promoted canon above.)_
- _(`model-read-carries-its-assumptions` GRADUATED 2026-07-06 — 2 binding (dealer-flow-projection — the
  assumption-explicit charm/vanna projection; ai-context-pack — every trend/shape/flow/ATR read carries its
  window+threshold+basis + the "not a forecast, not a scored signal" framing). Crossed the "≥2 if binding"
  threshold → Promoted canon above (CONTEXT §5 + THREADS §9); removed from the watch list.)_
- _(`digested-labels-not-raw-dump` GRADUATED 2026-07-07 — 2 binding (ai-context-pack — the TI regime labels
  off ADX/RSI/EMA, no raw indicator series; iv-rank — the rich/cheap `band` [premium_rich|neutral|premium_cheap]
  cut server-side from the rank, no raw IV history on the wire or in the UI). Crossed the "≥2 if binding"
  threshold → Promoted canon above (CONTEXT §5 + THREADS §9); removed from the watch list. Future indicator
  bundles — volume-profile/CVD, the news/sentiment classifier — will reaffirm it.)_
- _(**`loss-free-durable-migration`** GRADUATED **2026-07-16** via the new **SEVERITY path** at 1 instance
  (rebrand-convexa) — owner canon review. Violation = silent, total, irreversible loss of the user's entire
  trading history (~5 durable localStorage stores, **no server backup**). Recurrence would have kept it
  waiting behind a dialog; severity does not wait. Now in Promoted canon above.)_
- **`structural-over-prose-enforcement`** (**3 instances — outcome-ledger 2026-07-16 + scanner 2026-07-26 +
  positions-legs 2026-07-28; STILL NOT promoted**) — the 3rd instance is the strongest evidence yet
  (max-loss eligibility as **membership in a closed set** rather than a detection heuristic, so an
  under-detected unbounded shape is ineligible *by construction*; the recogniser's no-confidence-measure
  rule; a branded `NetLimitDollars` no numeric literal can inhabit, pinned by a `@ts-expect-error` that
  fails typecheck if the brand weakens) — **and the judgement is still unchanged.** Three instances now say
  the same thing two did: volume is not the missing piece, a **statable violation test** is. Compare
  `absent-is-not-none`, which graduated the same day on *fewer* instances because its third one proved
  **generality** rather than repeating the evidence. Original entry: (2 instances) — see the scanner ledger row for that ship's evidence (leaf boundary · empty
  `apps/api` diff · pure-logic-with-injected-clock · mutation-guarded scans · pins re-pointed not deleted).
  **The judgment is unchanged by the second instance:** volume of evidence is not the missing piece — a
  *statable violation test* is. It stays a design heuristic until someone can write the bar that makes
  "enforced by prose" mechanically detectable. Recorded here so a later canon review can weigh it with the
  full provenance rather than re-deriving it. Original entry: — an
  invariant a feature must hold is enforced by **construction** (a type, a module boundary, an empty diff, a
  mutation-tested source-scan) rather than by **prose an implementer must remember**. Where the two are
  available, prefer the shape that makes the violation **impossible or build-breaking**. *Evidence in this
  one ship:* no-auto-tuning = a literally **empty `apps/api` diff** (a statistic that never leaves the
  browser cannot reach `signals.py`) · the coverage roll-up is **integers-only**, so the demo seed's
  fabricated `realized_pl_dollar: 196` is **unreachable by construction** · the counted read is **ONE string
  in ONE `<Typography>`**, so "no hero number" is unbreakable **in the DOM** rather than in the type spec ·
  the decline class-A map is `Record<Exclude<DeclineReason,'store_unreadable'>,…>`, so re-composing class B
  through class A's inverted template is a **TYPE ERROR** · the `?raw` source-scan **provably bites**
  (mutation-tested: renaming a `via` literal FAILED with a message naming §2/Q3.5). *Kin already in the
  project:* `contract_lint.py`, `path_guard.js`, `kit_lint.mjs`, `interface_conformance.py` — all the same
  move ("mechanize the trusted invariant"). **Deliberately NOT promoted at 1 instance:** it is closer to a
  *design heuristic* than a rule with a crisp violation test, and the severity path does not apply (relying
  on prose is not catastrophic-and-irreversible). Log recurrence; promote only if it earns a statable bar.
  *binding:yes (weakly — a future feature could violate it by shipping a rule enforced only by a comment).*
- _(**`absent-is-not-none`** **GRADUATED 2026-07-28** at `positions-legs` — 3 binding, and the 3rd instance
  is the one this entry was explicitly waiting for: an **unrelated feature family**, carrying the rule out
  of backend wire-config and into the **client render** (four independently-assertable not-a-number
  literals: `—` / `unavailable` / `not recorded` / `no basis`; `undefined`/`null`/`NaN` banned outright).
  The "specialisation of `model-read-carries-its-assumptions`?" doubt below is answered by that instance —
  a self-describing *model read* has nothing to say about a **saved record that never held a fact**, which
  is a different failure with a different fix. Now in Promoted canon above.)_ Original entry, kept for
  provenance: (**2 instances — bundle-events + expiration-events, both 2026-07-27; NOT promoted at the
  time**) — the 2nd instance carried the rule **down a level** (an empty `expirations` array under
  `state: unknown` must not read as "no expiry is affected"), which is genuine reinforcement but from the
  *same feature family on the same day* — weak evidence of generality, not the ≥2-distinct-features the
  binding threshold intends. Re-assess when an unrelated feature needs it. Original entry: — a store or config
  that can be *uncurated* must distinguish **"we do not know"** from **"we checked and there is nothing"**,
  and must carry that distinction to the wire rather than collapsing it at a boundary. *Evidence:* the
  events loader returns `None` (unknown) vs `[]` (verified none) so the **type signature** stops a caller
  from conflating them, and the wire's closed `state` enum is the sole disambiguator because both states
  carry an empty list. *Kin already shipped:* the scanner's `building` vs `error`, iv-rank's "building
  history — N of 20", the outcome-ledger's `building` cells that render **nothing numeric**. **Not promoted
  at 1 instance:** the severity path does not obviously apply (it produces a wrong *claim*, not
  irreversible data loss), and the kin above suggest this may be a **specialisation of
  `model-read-carries-its-assumptions`** rather than a separate rule — the honest read is that a
  self-describing read already implies "say when you don't know." Log recurrence; promote only if it earns
  a bar distinct from its parent. *binding:yes.*
- _(**`ai-asserted-numbers-are-traceable`** **GRADUATED 2026-08-14** — 2 binding (ai-rec-grounding, rec-absence-literals-hole);
  now in Promoted canon above. It reached the bar on **ordinary recurrence**, which is why the queued
  severity-path question was never put to the owner. Original entry retained below for provenance.)_
  (**0 instances at proposal — 2026-07-16, owner canon review; NOT promoted then**) — every number the in-app AI **asserts** (strike, stop, target, level, price) must be
  **traceable to a computed bundle field**; an untraceable number is not rendered as fact. Rationale:
  `best-effort-isolated-or-null` covers the AI **failing**, nothing covers it **fabricating** —
  `model-read-carries-its-assumptions` disciplines *our* model reads, not the LLM's output. The
  ai-rec-backtest-orders "levels in play" being **bundle-sourced** is the partial precedent that shows the
  instinct was already there. Given the BACKLOG §C securities-counsel item, an ungrounded number is a
  **liability** question, not only a bug. **Logged at 0 instances deliberately** — an aspirational rule is
  not canon; it applies to the next AI-touching feature and promotes on its first real instance (or on the
  severity path if a fabrication is ever observed live). *binding:yes.* Build item → BACKLOG §B.
- _(`no-secrets-in-image` GRADUATED 2026-06-29 at `deploy` — 3 binding (containerize-apps, persistent-db,
  deploy); the held-until-published rule fired when the image is pushed to Railway for real. Now in Promoted
  canon above.)_
- _(`server-side-gate-enforcement` GRADUATED 2026-06-29 — 2 binding (user-accounts AC-E7, byo-ai-key).)_
- _(`secret-encrypted-at-rest` GRADUATED 2026-06-29 — reached 2 binding instances (byo-ai-key, persistent-db);
  now in Promoted canon above.)_
- _(`no-real-order-path` graduated 2026-06-24; reaffirmed again by user-accounts → 3 binding instances,
  already in Promoted canon.)_
- **`engine-claim-matches-executable-engines`** (1 instance — `browser-quality-gates` 2026-08-28; binding) —
  the supported-browser promise names only engines this repository's locked Playwright release can
  actually run (Chromium full suite; Firefox/WebKit five compatibility journeys). Browserslist, if
  present, is emitted-code intent, not journey evidence. No branded-browser, all-version, OS/device,
  or assistive-technology certification claim. A future quality/browser feature violates it by
  advertising an engine or branded browser it cannot execute. *Not promoted at 1 instance.*
- **`visual-baseline-requires-human-authority`** (1 instance — `browser-quality-gates` 2026-08-28; binding) —
  visual candidate write and merge eligibility require two-stage human authorization then acceptance
  receipts; a worker or command must never author or alter those files. Missing authority is a
  visible stop, not self-approval. *Not promoted at 1 instance.*
- _(`local-evidence-is-not-hosted-evidence` GRADUATED **2026-08-29** at `capacity-baseline` — 2 binding
  (browser-quality-gates hosted `NOT RUN`; capacity-baseline load≠soak and local≠ci). Now in Promoted
  canon above.)_
- **`harness-p95-is-not-slo`** (1 instance — `capacity-baseline` 2026-08-29; binding) —
  a load/soak/quality harness p95 is a mocked-path regression gate, never a production SLO, never
  permission to raise live ceilings, and never labeled as vendor/Massive p95. Future `telemetry-slos`
  must not treat these numbers as live-site objectives. *Not promoted at 1 instance.*
- _(`present-is-live-paid-only` GRADUATED **2026-08-30** at `session-day-tape-capture` — 2 binding
  (archive-coverage-guardrails blocked occupancy; session-day-tape-capture never LiveMassive).
  3rd instance: `day-replay-mock-adapter` GATE S 2026-08-30 (replay occupancy never LiveMassive).
  4th instance: `massive-flat-file-keep` GATE S 2026-08-31 (extracts never LiveMassive / coverage present).
  Now in Promoted canon above.)_
- **`credential-class-isolation`** (1 instance — `massive-flat-file-keep` 2026-08-31; binding) —
  a files/S3 secret is never the live REST apiKey; classify credential class before GET; missing
  pair and wrong-class stay distinct (REST clause only on wrong-class). A future files/object
  client violates it by reusing `MASSIVE_API_KEY` as SigV4 material. *Not promoted at 1 instance.*

## Ledger (append-only — one row per binding decision instance)
| key | feature | gate | statement (as locked) | binding |
|-----|---------|------|-----------------------|---------|
| `best-effort-isolated-or-null` | dark-pool-stream-isolation | S | any off-exchange failure → `off_exchange=None` (object omitted, not an HTTP error); bundle + SSE intact | yes |
| `live-vs-static-isolation` | dark-pool-stream-isolation | S | live tiles dim + `⏸ offline` on payload-gap watchdog; GEX chart/stats/blocks persist from last bundle | yes |
| `dark-pool-context-only` | dark-pool-stream-isolation | S | block prints display-only, unscored, no side (already canon THREADS §9) | yes |
| `additive-keeps-score-byte-identical` | dex-voloi-skew-term | S | `signals.py` untouched; score + `state_fingerprint` byte-identical with/without the four metrics | yes |
| `best-effort-isolated-or-null` | dex-voloi-skew-term | S | the four metrics each independently nullable → own "unavailable this cycle" | yes |
| `live-vs-static-isolation` | dex-voloi-skew-term | S | the four are static reads — excluded from the live-offline treatment (stay un-dimmed on SSE drop) | yes |
| `additive-keeps-score-byte-identical` | trade-tracker-sim | S | entry gate + `opportunity_score` + `state_fingerprint` byte-identical to pre-feature | yes |
| `best-effort-isolated-or-null` | trade-tracker-sim | S | all ghost-trade backend surface best-effort/isolated; missing→404, no-NBBO→null, never breaks bundle | yes |
| `ai-external-no-llm` | trade-tracker-sim | S | stateless server, no order path, **no LLM call** (already canon CONTEXT §8) | yes |
| `live-vs-static-isolation` | trade-tracker-sim | S | SSE drop degrades only P/L + current mark (⏸ last known); record/stats/history persist | yes |
| `additive-keeps-score-byte-identical` | backend-observability | S | `OBSERVABILITY_ENABLED` OFF ⇒ byte-identical bundle; computed values frozen; trader path unchanged | yes |
| `best-effort-isolated-or-null` | backend-observability | S | instrumentation best-effort — a forced span exception still yields 200 + identical values (never a non-200) | yes |
| `operator-vs-trader-path-separation` | backend-observability | S | metrics readout off the trader routes; SSE uninstrumented; trader dashboard ignores `trace_id`/`timings` | yes |
| `additive-keeps-score-byte-identical` | trader-personas | S | persona = A vs B vs none → byte-identical `market_state`/`signals`/`ai_eval`; persona never a scoring input | yes |
| `best-effort-isolated-or-null` | trader-personas | S | persona assembly failure → default one-size prompt, never an HTTP error, never blocks bundle/gate/hand-off | yes |
| `ai-external-no-llm` | trader-personas | S | persona assembles text only; AI external, **no LLM call** (already canon CONTEXT §8) | yes |
| `live-vs-static-isolation` | trader-personas | S | persona is presentation-only — fully usable from last bundle, never marked offline | yes |
| `operator-vs-trader-path-separation` | latency-visualizer | S | trend on `/_ops/metrics` only, never linked from a trader route; the page's sole network call stays `GET /api/_metrics`; no control triggers a vendor fetch / recompute / cache mutation / trader-route call | yes |
| `best-effort-isolated-or-null` | latency-visualizer | S | a failed poll keeps the last series behind a soft notice + self-heals (no retry storm, no error page); never affects the page, snapshot tables, or any other surface; the in-browser series is ephemeral (only Export persists, to the operator's machine) | yes |
| `additive-keeps-score-byte-identical` | ai-recommendations | S | the in-app LLM rec is a pure CONSUMER in a one-way-leaf module `signals`/`engine`/`live`/`darkpool` do NOT import; `opportunity_score`/`opportunity_tier`/`state_fingerprint` byte-identical with vs without a rec (verified live + via the E3 test) | yes |
| `best-effort-isolated-or-null` | ai-recommendations | S | LLM timeout/error/over-cap/no-key → HTTP 200 + a `status` field (never 5xx); the rec surface degrades ALONE; bundle/SSE/chart/tiles/tracker intact; manual export floor always works | yes |
| `live-vs-static-isolation` | ai-recommendations | S | a rec is a static artifact pinned to its snapshot — stale on a newer bundle, UNTOUCHED on an SSE drop, never silently refreshes/re-runs | yes |
| `no-real-order-path` | ai-recommendations | S | "action" = Accept into the paper-sim ghost-trade tracker + mandatory confirm; `SIMULATED`; advisory; no broker/order path (watch-list key) | yes |
| `ai-external-no-llm` | ai-recommendations | S | **DEMOTION trigger** — GammaFlow now CALLS an LLM (isolated/gated/advisory consumer); narrows the rule, see Demoted table | yes |
| `no-real-order-path` | positions-portfolio | S | multi-position sim portfolio: every entry `SIMULATED` (manual/market/limit are sim bookkeeping vs the existing mark stream); the **Live tab is a zero-import lock** — no broker, no order/execution path, no real position; no real order anywhere | yes |
| `additive-keeps-score-byte-identical` | positions-portfolio | S | the portfolio issues NO `/api/ticker` call + never feeds `signals`/`opportunity_score`/`opportunity_tier`/`state_fingerprint`; the tier read is display-only; AC-41 asserts byte-identical with/without the portfolio | yes |
| `best-effort-isolated-or-null` | positions-portfolio | S | a per-row mark/contract-lookup failure degrades only that row (excluded+flagged from the subtotal, never zeroed); a corrupt store degrades to an empty portfolio without throwing, leaving the readable v1 blob intact | yes |
| `live-vs-static-isolation` | positions-portfolio | S | on an SSE drop live cells dim + `⏸` last-known (never blank/0), the P/L trend = a broken line; position records / history / customization / saved views persist from the durable store | yes |
| `additive-keeps-score-byte-identical` | app-shell-landing | S | multi-page restructure (router + AppShell + Convexa landing); `apps/api` diff empty, the relocated Ticker renders the bundle score verbatim — score/tier/`state_fingerprint` untouched | yes |
| `best-effort-isolated-or-null` | app-shell-landing | S | relocated features keep best-effort degradation; standalone `/positions` per-row mark failure (404/null/refresh-fail) degrades that cell to last-known, never blanks/drops the row | yes |
| `live-vs-static-isolation` | app-shell-landing | S | Ticker live-degrade survives the route move (⏸ offline, static persists); live SSE is **page-scoped** — opens on `/ticker`, closes on nav-away, reopens on return, never double-subscribes | yes |
| `operator-vs-trader-path-separation` | app-shell-landing | S | `/_ops/metrics` stays OFF the new nav shell and unlinked from the trader UI (verified) | yes |
| `no-real-order-path` | app-shell-landing | S | all SIMULATED; positions "Live" tab stays the zero-import LOCKED placeholder; the landing's brokerage block is an honest non-navigating "coming soon" (no order/broker path) | yes |
| `additive-keeps-score-byte-identical` | ticker-load-experience | S | pre-warm/concurrency/coalescing change only WHEN/HOW inputs are obtained — same `market_data` in → byte-identical bundle out; `opportunity_score`/`tier`/`state_fingerprint` identical cold==warm (QA re-proven: score 44, fp `b5c70f93c2d5`) | yes |
| `best-effort-isolated-or-null` | ticker-load-experience | S | chain pre-warm + 3-fetch concurrency are best-effort: any miss/stale/malformed/fetch-exception falls back to a normal vendor fetch with no new error surface; `last_trade` nullable between prints/overnight | yes |
| `live-vs-static-isolation` | ticker-load-experience | S | SSE `last_trade` is live-derived (dims with mid/spread/flow on a stream drop); cold-load skeleton is a DISTINCT state from offline-degrade and from "unavailable this cycle" | yes |
| `live-spot=NBBO-mid` | ticker-load-experience | S | **NARROWING (system-7)** — `last_trade` ADDED as a display-only SSE readout; the NBBO mid stays the anchor for headline/levels/flip (`_levels_for_filter` keeps `self.mid`). Narrows THREADS §9 "do not add last-trade." | yes |
| `additive-keeps-score-byte-identical` | user-accounts | S | auth/sessions/settings = a one-way leaf the scoring path never imports (0/12 modules); anonymous vs signed-in bundle byte-identical (score 24, fp `79373ef9194e`); no user setting is a scoring input; bundle/SSE gained NO required header/query param | yes |
| `best-effort-isolated-or-null` | user-accounts | S | **CARVE-OUT (the auth error class):** auth endpoints return real HTTP statuses by design (401 non-enumerating bad-creds / 403 gated / 409 dup email) — the null-not-error rule governs added BUNDLE computations, NOT the auth surface; an auth-subsystem failure still degrades the trader path to anonymous (bundle/SSE intact) | yes |
| `no-real-order-path` | user-accounts | S | gating the Positions sim-trade WRITE actions + the "ask AI" call behind a session is ACCESS CONTROL; Positions stays `SIMULATED` (client-local localStorage); no broker/order/execution path; the "Live" tab stays zero-import LOCKED | yes |
| `additive-keeps-score-byte-identical` | rebrand-convexa | S | full GammaFlow→Convexa rename is cosmetic to the engine — logger/title/identifier/key renames only; `opportunity_score`/`tier`/`state_fingerprint` byte-identical (score 2, fp `8fa0e1e62a11`), conformance 8/8, no interface/wire change | yes |
| `best-effort-isolated-or-null` | rebrand-convexa | S | the migrate-on-read helper never throws — a corrupt/absent legacy blob degrades to empty in-memory with the source blob preserved (rollback-safe); a failed promote-write is swallowed and the value still surfaces | yes |
| `loss-free-durable-migration` | rebrand-convexa | S | renaming a durable localStorage key carries existing data forward LOSS-FREE: read-new-else-old, promote-forward-once (idempotent), never delete the old key, never throw; composes with the existing positions v1→v2 chain so every legacy user lands whole | yes |
| `additive-keeps-score-byte-identical` | byo-ai-key | S | per-user key resolution / credential store / crypto / metering / admin allowlist stay OUT of scoring; score 24 / tier actionable / fp `79373ef9194e` byte-identical across all 6 key states (anon/regular-no-key/admin-allowance/exhausted/shared-unconfigured/own-key); 0/5 scoring modules import the credential store or crypto leaf | yes |
| `best-effort-isolated-or-null` | byo-ai-key | S | key lookup / decrypt-fail / LLM error / over-limit / missing-encryption-secret all degrade the rec surface ALONE to a `status` (no_key/over_limit/shared_key_unconfigured/unavailable), always-200 never 5xx; bundle/SSE/chart/tracker + the keyless export floor intact | yes |
| `server-side-gate-enforcement` | byo-ai-key | S | the credential endpoints (`/api/auth/ai-key`) + the AI-rec call are gated SERVER-SIDE (403 anonymous; key resolution + the admin-allowance decision are server-authoritative); the FE only renders the server's resolved state — not an FE-only gate | yes |
| `secret-encrypted-at-rest` | byo-ai-key | S | a stored third-party secret (the user's Anthropic key) is ENCRYPTED (Fernet, server-side `AI_KEY_ENCRYPTION_KEY`), NOT hashed (must be recoverable to call); never logged / returned / sent to the browser; write-only + masked last4 + rotate/delete; decrypt-fail ⇒ treated as no usable key (no leak) | yes |
| `additive-keeps-score-byte-identical` | persistent-db | S | storage-backend swap only — the auth stores stay a one-way leaf the scoring path never imports (AST 0/5); trading/bundle/SSE path is stateless + untouched; score/tier/`state_fingerprint` byte-identical (in-memory default path conformance PASS, no regression) | yes |
| `best-effort-isolated-or-null` | persistent-db | S | a Postgres outage degrades the AUTH subsystem only — the adapter raises (never false-success) → existing machinery yields 503 `auth_unavailable` / treat-as-anonymous; the anonymous bundle/SSE/trader path never touches the DB and stays fully up. Auth fails CLOSED | yes |
| `secret-encrypted-at-rest` | persistent-db | S | the per-user AI key moves into Postgres as **ciphertext ONLY** (+ masked last4); the adapter never imports `crypto`, never reads `AI_KEY_ENCRYPTION_KEY`, never en/decrypts — the encryption boundary (crypto leaf, before the store) is preserved across the new store | yes |
| `no-secrets-in-image` | persistent-db | S | `DATABASE_URL` / DB credentials injected at RUNTIME via env, never committed/baked; `.dockerignore` already excludes `.env*` so the new config holds the image-hygiene line | yes |
| `no-secrets-in-image` | deploy | S | the image is **pushed to a registry for real** (Railway) — every secret (`DATABASE_URL`, `API_ORIGIN`, `MASSIVE/ANTHROPIC` keys, `AI_KEY_ENCRYPTION_KEY`/`AUTH_SESSION_SIGNING_KEY`, `METRICS_SECRET_TOKEN`) lives only in Railway Variables / Pages env, never in the repo/image; the Pages Function reads `API_ORIGIN` from env (no hardcoded URL); secret-scan clean. **3rd instance → GRADUATES** | yes |
| `additive-keeps-score-byte-identical` | deploy | S | deploy config + the 3 HIGH security guards (metrics token-gate, the fail-open public rate-limit leaf, the startup stable-key warning) change no scoring/engine/`state_fingerprint`; the limiter is a leaf outside the scoring path; in-memory conformance PASS, no regression | yes |
| `single-shared-sim-entry-dialog` | sim-entry-unification | S | ONE shared `app/trading/TradeEntryDialog` on both pages; ghost-trade + positions dialogs AND GhostTradePanel deleted with zero-importer proof; durable stores untouched | yes |
| `theme-token-discipline` | light-mode-parity | S | mode-aware `extras` via `extrasFor(theme)` (bare `extras.` = dark-only); ONE shared hatch; dark byte-identical; zero hardcoded hex | yes |
| `additive-keeps-score-byte-identical` | ai-rec-backtest-orders | S | scenario machinery confined to the ai-rec leaf (`ai_scenarios` imported only by `ai_recommendation`; AST: 0 scoring modules); orders are FE-local + add no request param (AC-44 structural test); score 78 / tier prime / fp `86bcafd6bc22` byte-identical flag ON==OFF; served triple identical before/after a scenario POST | yes |
| `best-effort-isolated-or-null` | ai-rec-backtest-orders | S | every scenario fault a contained 200 `status` (`scenario_unavailable`/`scenario_error`/`timeout`/`llm_error`), never 5xx; an orders-store fault degrades to an honest unavailable block without touching positions/bundle/SSE; per-order lookup failures + per-tick throws isolated | yes |
| `live-vs-static-isolation` | ai-rec-backtest-orders | S | triggers evaluate ONLY the live NBBO mid (`last_trade` structurally excluded from `tickFromLive`); fills only on live-resolvable marks (never frozen/stale/last_known); no transition while offline; no retro-fill on reconnect; clock expiry the only off-stream transition; live order cells dim + last-known on an SSE drop while durable rows persist | yes |
| `no-real-order-path` | ai-rec-backtest-orders | S | `SimOrder` = client-local paper bookkeeping behind a mandatory confirm; NO order endpoint / broker / execution path (orders never ride the wire); the Live tab stays zero-import LOCKED; scenario output is always marked SCRIPTED end-to-end (rec → order → export) | yes |
| `server-side-gate-enforcement` | ai-rec-backtest-orders | S | order creation awaits `POST /api/positions/sim-trade/gate` BEFORE any local write (403 ⇒ abort, zero order — proven even when the FE believed it was signed in); the rec POST keeps auth outermost in scenario mode (anonymous ⇒ 403 before any scenario logic) | yes |
| `single-shared-sim-entry-dialog` | ai-rec-backtest-orders | S | Act = an additive ORDER VARIANT (`orderPlan`/`onConfirmOrder` props) of the shared dialog — contract-mandated "do not fork"; the dialog renders byte-identically without the seam (guarded test) | yes |
| `theme-token-discipline` | ai-rec-backtest-orders | S | the entire `orders/` module + panel additions token-only + `extrasFor(theme)`; zero new hex (lint + conductor review) | yes |
| `additive-keeps-score-byte-identical` | dealer-flow-projection | S | the projection rides `market_state` as AI-context/display; `signals.py` 0 changes (grep-verified: reads no charm/vanna/dealer_flow_projection); score/tier/`state_fingerprint` byte-identical with-vs-without AND before-vs-after the `math.fsum` determinism fix (QA independently re-derived — field present/absent/garbage-mutated never moved the triple) | yes |
| `best-effort-isolated-or-null` | dealer-flow-projection | S | per-limb + whole-object null → null field, never a 5xx / fabricated 0 / fabricated date; a forced internal exception → `dealer_flow_projection: null` with the bundle still 200; a naturally-occurring whole-null case found in the wild (`min_dte=500`); the two limbs independently nullable | yes |
| `live-vs-static-isolation` | dealer-flow-projection | S | declared STATIC (`spot_basis = gex_spot`, never the live spot; never on SSE); on a stream drop the widget stays visible + un-dimmed + no `⏸` chip (FE contrast test vs a dimming LiveTape tile); excluded from the live-offline treatment like the four positioning tiles | yes |
| `theme-token-discipline` | dealer-flow-projection | S | the new `DealerFlowProjection` widget + copy are token-only via the MUI theme; dark/light parity render-verified; zero hardcoded hex | yes |
| `additive-keeps-score-byte-identical` | ai-context-pack | S | new one-way leaf `context_pack.py` (`signals`/`engine`/`live`/`darkpool` don't import it); attached AFTER `generate_signals` returns; `signals.py` **0 diff**; score/tier/`state_fingerprint` byte-identical (SPY 87/prime/`bb82718bcf1e`) with/without/forced-fault AND before/after the 60→400d daily-bar fetch extension (QA independently re-derived; HV unaffected — fixed 31-close tail) | yes |
| `best-effort-isolated-or-null` | ai-context-pack | S | four reads each INDEPENDENTLY nullable (per-label / per-horizon / per-sub-component / per-read); whole-pack null only when all four unavailable or the wrapper raised; a forced whole-pack fault → `market_context: null` with the bundle still 200; the `market_context` KEY is always emitted (`object|null`) | yes |
| `live-vs-static-isolation` | ai-context-pack | S | all four reads declared STATIC (bar/profile-derived; flow basis = the chain snapshot's cumulative volume, NEVER the SSE net flow); nothing rides SSE; the widget stays visible + UN-DIMMED on a stream drop (contrast with the dimming LiveTape) | yes |
| `theme-token-discipline` | ai-context-pack | S | the `MarketContext` widget + copy are token-only via the MUI theme; dark/light parity verified; zero hardcoded hex (structural source-scan test) | yes |
| `model-read-carries-its-assumptions` | ai-context-pack | S | every trend/shape/flow/ATR label + scalar carries its window / threshold / basis descriptor in-payload (self-describing export); the UI frames the pack "advisory context — not a forecast, not a scored signal, not a guarantee"; **2nd binding instance → GRADUATES** | yes |
| `digested-labels-not-raw-dump` | ai-context-pack | S | the TI read is a SMALL orthogonal set pre-digested into regime LABELS (direction/strength/momentum/concentration/balance/location/composition enums), not raw indicator values; the wire enum is authoritative (FE never re-derives a label from the scalar); no raw indicator/OHLC series in the UI (watch-list key) | yes |
| `additive-keeps-score-byte-identical` | iv-rank | S | new one-way leaf `apps/api/src/marketdata/` (`signals`/`engine`/`live`/`darkpool`/`chain_store` 0 diff + import none of it — grep/AST verified); `market_state.iv_rank` attached AFTER `generate_signals`; score/tier/`state_fingerprint` byte-identical (SPY served 83 / prime / `0e8884cc0a03`) with iv_rank present/null/absent — QA independently re-derived incl. a forced whole-store outage | yes |
| `best-effort-isolated-or-null` | iv-rank | S | store outage / insufficient history / write failure / no-current-IV → `iv_rank: null` or the honest `building` state, never a 5xx; the KEY always emitted (`object|null`); the write-through is best-effort (swallowed, never perturbs the bundle/cache/SSE); forced `IV_STORE=postgres`→unreachable-DB served 200 + null, `strike_profile` intact, boot survived (defer-fault-to-first-use) | yes |
| `live-vs-static-isolation` | iv-rank | S | STATIC daily read — nothing rides SSE (the SSE payload gains no field); the widget stays visible + UN-DIMMED on a stream drop (deterministic flow-spec contrast vs a dimming LiveTape) | yes |
| `model-read-carries-its-assumptions` | iv-rank | S | the rank read is self-describing — carries its window (sessions used) + total sample-count + IV-basis (`interpolated_30d`/`nearest_tenor` + `basis_dte`) in-payload + the advisory framing; never a bare number (FE guards it); the honest "building history — N of 20" state before the floor; degenerate-flat → `rank:null`+`flat_window`, never a fabricated "50"; **3rd instance** | yes |
| `digested-labels-not-raw-dump` | iv-rank | S | the rich/cheap `band` (`premium_rich`≥70 / `neutral` / `premium_cheap`<30) is a single digested closed-enum token cut server-side from the rank; the FE renders it via a closed lookup, never re-derives it from the scalar; NO raw IV history series on the wire or in the UI; **2nd binding instance → GRADUATES** | yes |
| `theme-token-discipline` | iv-rank | S | the `IvRank` widget + copy are token-only via the MUI theme; dark/light parity render-verified; zero hardcoded hex (structural `?raw` source-scan test) | yes |
| `additive-keeps-score-byte-identical` | outcome-ledger | S | the track record READS outcomes and is **never** a scoring input; enforced STRUCTURALLY, not by prose — 4 boundaries: **zero backend surface** (`apps/api` diff empty, conductor- + QA-verified: a statistic that never leaves the browser cannot reach `signals.py`) · the outcomes module is a **one-way leaf** with an enumerated forbidden-importer list, pinned by a `?raw` source-scan that **provably bites** (mutation-tested) · the ledger has **zero write functions** · its output is kept off the AI export/prompt in v1 | yes |
| `score-change-is-deliberate-and-measured` | outcome-ledger | S | **1st instance — as the rule's ENABLER, never its exerciser.** The feature measures whether the score is any good (the only honest input to a deliberate score change) and is **structurally incapable of making one**: no auto-tuning, no feedback loop, zero write functions. Promoted 2026-07-16 by owner canon review; this ship is what makes it actionable | yes |
| `loss-free-durable-migration` | outcome-ledger | S | **2nd instance** (1st = rebrand-convexa) — the archive import is **merge-only, idempotent, never-destructive**; a corrupt/unreadable blob degrades to empty **WITHOUT destroying the original**; and the feature **REFUSES to import into a store it cannot fully read** rather than let the store APIs rewrite (destroy) that blob — the refusal IS the invariant, surfaced as UX §5.9's class-B decline ("your existing data is the problem, and we will not touch it"). Promoted 2026-07-16 via the SEVERITY path at 1 instance; recurrence has now caught up to severity | yes |
| `best-effort-isolated-or-null` | outcome-ledger | S | a failed store read ⇒ `sources_complete:false` ⇒ a **partial** roll-up that says so — never a throw, never a silently-smaller M. The balance identities (`M == counted + Σ excluded_by_reason`) are **CI assertions, never runtime throws**. A corrupt blob ⇒ empty readout, never an error; bundle/SSE untouched | yes |
| `model-read-carries-its-assumptions` | outcome-ledger | S | **4th instance.** Every rate carries its sample count + basis + `N_min=20` floor + a **Wilson 95% interval**, cells never pooled, all-time non-rolling window (a selector would let the trader **shop for the flattering window** — the exact meta-decision failure the feature exists to fix); `building` shows a count and **nothing numeric** (AC-E3: a 3-for-3 cell must never render "100%"); a hit rate may **never** appear without its mean per-trade return + dispersion. The coverage counts are themselves a model read and carry their own basis (stores spanned, de-dupe identity, `sources_complete`, **derived** epoch) | yes |
| `digested-labels-not-raw-dump` | outcome-ledger | S | **3rd instance.** The capture digest is a **small closed set** (score · setups name+conviction capped 5 · persona · IV-rank **band** · regime · vol-regime · fingerprint) — **ATR excluded by decision** (a raw scalar with no digested band; this rule is what stops that slide). Wire labels render via a **closed lookup**, never re-derived from a scalar | yes |
| `no-real-order-path` | outcome-ledger | S | SIMULATED outcomes only; the read carries the **six named sim facts** (no slippage / partial fills / queue / assignment / fees; instant unlimited limit fills) **as part of the read, not a footnote** — sim P&L is not real fills, and the copy does not let the reader forget it | yes |
| `single-shared-sim-entry-dialog` | outcome-ledger | S | **HONORED (sim-only, as narrowed 2026-07-16).** The AI-rec attribution seam was threaded via **the host remembering what it prefilled** — the shared `TradeEntryDialog` is **untouched and unforked**; no second dialog, no variant added | yes |
| `server-side-gate-enforcement` | outcome-ledger | S | **HONORED by NOT building a gate.** With no server surface, an FE-only gate on the archive import would be **decorative** — enforcement theatre, which this rule forbids — so the import is deliberately **ungated** (AC-25) rather than wearing a check that enforces nothing | yes |
| `operator-vs-trader-path-separation` | outcome-ledger | S | **HONORED.** The track record is a **TRADER** surface (it informs trading decisions) and lives on `/positions` as its own in-page view — explicitly **NOT** `/_ops/metrics`. The rule keeps operator surfaces off trader routes; it does not make an analytics-shaped read operator-facing | yes |
| `live-vs-static-isolation` | outcome-ledger | S | the track record is a **STATIC historical** read: closed-only, so it does **NOT** dim on `streamOffline` (static reads keep rendering). The closed-only honesty rule and the isolation rule are **the same decision**. Verified non-vacuously — the live Net P/L's class flips on a real stream drop while the track record's `innerHTML` stays byte-identical | yes |
| `theme-token-discipline` | outcome-ledger | S | token-only via the MUI theme; zero hardcoded hex; **no semantic tint on any rate** (AC-14) — green/red on a hit rate manufactures a verdict the sample cannot support. Verified non-vacuously: a 90% cell and a 10% cell assert **identical `className`** (MUI `sx` compiles to classes, so `getAttribute('style')` is always empty — the vacuous-assertion trap the lane caught in its own tests) | yes |
| `theme-token-discipline` | redesign-stage-0 | S | every floor fix binds to CURRENT tokens (Stage 0 = correctness, not identity — zero new hex, QA diff-audited); the focus ring + 44px coarse-pointer floor land at the THEME layer (one authored rule), never per-component | yes |
| `additive-keeps-score-byte-identical` | redesign-stage-0 | S | FE-only; `git diff main -- apps/api` AND `-- libs/api` both EMPTY (QA re-verified) — the structural proof; score/tier/`state_fingerprint` unreachable by construction | yes |
| `live-vs-static-isolation` | redesign-stage-0 | S | the 3 distinct degraded states SURVIVED the mobile relayout — verified on a REAL stream kill at 393px ("⚠ Live offline — reconnecting…", live tiles → "⏸ offline", static chart + 19 stat reads persist un-blanked, scrollWidth 378 held while degraded); zero degraded-spec deletions/weakenings | yes |
| `single-shared-sim-entry-dialog` | redesign-stage-0 | S | mobile full-screen = 5 lines of breakpoint props on THE shared `TradeEntryDialog` — restyled, NOT forked (QA diff-audited) | yes |
| `no-real-order-path` | redesign-stage-0 | S | the landing hero reframed HONEST ("See the dealer positioning behind the price.") — no longer sells the unbuilt brokerage connect; coming-soon blocks stay non-navigating | yes |
| `theme-token-discipline` | redesign-stage-1 | S | **the rule's biggest exercise to date** — the ENTIRE identity swapped at `tokens.ts`/`theme.ts` with component edits confined to a closed 6-site rebind list; the mechanism IS what made it safe (QA: all 32 changed files in the permitted set, zero scope creep); the retired hexes (GitHub neutrals, old blues, violet, blog cream, old ink) added to a mutation-guarded BAN-LIST scan spanning app + index.html + blog OUTPUT — the banned tells are now build-breaking, not prose | yes |
| `additive-keeps-score-byte-identical` | redesign-stage-1 | S | FE-only; empty `apps/api` + `libs/api` diffs (QA re-verified); P/L success/error hexes BYTE-LOCKED by pin test — the identity swap structurally cannot touch direction semantics or scoring | yes |
| `live-vs-static-isolation` | redesign-stage-1 | S | degraded-state semantics survived the re-tint — true-drop walk on the NEW palette in LIGHT mode (complements Stage 0's dark walk): "⚠ Live offline" in the new icon-paired warning `#A65526`, ⏸ markers legible, static reads persist, 378px held | yes |
| `model-read-carries-its-assumptions` | redesign-stage-1 | S | **5th instance, applied to the DESIGN process itself** — every light-mode color pairing shipped with a MEASURED WCAG ratio (19 pairings recorded; QA independently recomputed all 19); the one failing §3 value was bounced minimally (`#C9821A`→`#C57F19`) and recorded in 3 places, never silently shipped or silently obeyed | yes |
| `theme-token-discipline` | redesign-stage-2 | S | mark/curve/dividers token-bound (currentColor/primary/divider slots); favicon hexes test-pinned == tokens.ts; zero new hex; ban-list suites untouched green | yes |
| `additive-keeps-score-byte-identical` | redesign-stage-2 | S | FE-only; empty apps/api + libs/api diffs (QA re-verified); zero new deps (package.json diff empty) | yes |
| `single-motion-moment` | redesign-stage-2 | S | the hero curve-draw BECOMES the one orchestrated moment (convexa-design skill rule 5): dash-offset/opacity-only keyframes (property-set pin test), one-shot, shared useReducedMotion -> static frame; the generic radial blob + ValueCard light-bleed DELETED (zero-reference proven); live draw observed FINISHED via the Web Animations API | yes |
| `arc-in-exactly-3-places` | redesign-stage-2 | S | the signature primitive has EXACTLY {ConvexaMark, HeroCurve, ArcDivider} as importers — SET-EQUALITY test, mutation-guarded (a 4th importer fails); the cut 4th idea (chart-frame arc) stays cut | yes |
| `single-motion-moment` | redesign-stage-3 | S | **2nd instance — the consolidation itself**: 5 motion families dispositioned (stagger + GEX bar-grow RETIRED, flash-on-tick + live pulses KEPT as DATA SIGNALS by recorded decision, hover/conic TAMED); the app-wide keyframe inventory is now SET-EQUALITY pinned to {liveDotPulse, widgetLivePulse, ordersWatchPulse} + the hero draw + flash — a 6th family is build-breaking; live-browser inventory verified = exactly the KEEP set | yes |
| `theme-token-discipline` | redesign-stage-3 | S | 20 closed amber-census edits, all slot-level; brandGradient token DELETED (pin flipped ABSENT); textAmber added under a measured gate; blog SVGs bound to a token-allowlist scan | yes |
| `additive-keeps-score-byte-identical` | redesign-stage-3 | S | FE-only finale; empty apps/api + libs/api diffs (QA re-verified); the LiveTabPanel zero-import DATA lock intact (allowlist gained only the ruled static tokens module) | yes |
| `dark-pool-context-only` | redesign-stage-3 | S | LATENT VIOLATION FIXED: off-exchange proximity chips rendered `success` GREEN on a no-side datum — corrected to neutral (UX lane caught it during the amber census; green/red stay reserved for direction) | yes |
| `stagger-guards-replaced-not-deleted` | redesign-stage-3 | S | the §6a-2 pre-approved supersession executed EXACTLY: retirement + replacement guards in the SAME commit (3464a0a — QA audited via git show); zero spec-file deletions branch-wide (--diff-filter=D empty) | yes |
| `additive-keeps-score-byte-identical` | scanner | S | the scanner CONSUMES score/tier and can never feed them — enforced structurally at every phase: the `scanstore`/`scanner` one-way leaf (no scoring module imports it, AST-verified), `compute_ticker` UNCHANGED as the sole transform (worker, serve, and warm-click all call the same one), the warm-click changing only where the INPUT came from (`chain_store` precedent), and an **EMPTY `apps/api` diff** in P4. Proven LIVE, not argued: SPY served `59`/`actionable`/`4df5c37bd833` byte-identical worker-absent vs worker-present on a fresh non-cached compute | yes |
| `best-effort-isolated-or-null` | scanner | S | degradation is per-row and per-subsystem at every layer: a failed ticker degrades **that row alone** (`error`/`stale`) and the sweep continues; a failed snapshot poll **freezes prices WITH their stamps** (never fabricates); a store outage makes the worker skip writes and keeps the loop alive; every scan READ is best-effort **200 + status, never a 5xx** (verified under a forced store outage); the warm-click adds **no new failure surface** (a miss falls straight through to the vendor). **Auth carve-out: WRITES only** — the view PUT returns a real 401/403 | yes |
| `live-vs-static-isolation` | scanner | S | the scan surface is **poll-based** (`SCAN_POLL_MS=30_000` + hidden-tab auto-pause) with a declared two-speed basis — **no SSE, no per-row streams**, structurally distinct from the Ticker page's SSE path; the price flash is the ONLY aliveness cue (reduced-motion respected, no new keyframe family — the set-equality pin holds). **The word "live" is absolutely forbidden on the table**, enforced by a mutation-guarded `?raw` source scan AND a rendered-DOM sweep with all four states on screen | yes |
| `server-side-gate-enforcement` | scanner | S | the per-account view WRITE is gated **server-side** (`_gate_or_response` outermost, before validation) — a cookieless PUT gets a real 403 and **persists nothing**, proven three ways (unit: 0 PUTs + 0 localStorage; live cookieless curl → 403; real browser signed-out save → prompt, 0 PUTs). The independent QA RED was the sharpest evidence: with the gate removed a cookieless off-universe PUT reached **validation** (422), demonstrating the gate must sit outermost. Reads stay anonymous-open | yes |
| `model-read-carries-its-assumptions` | scanner | S | **6th instance.** Every row is self-describing — its own `as_of` + closed `status`, over a stated two-speed cadence header; a `stale` row keeps its **frozen** price WITH its stamp (never silently refreshed); a worker-down banner states "sweep last ran X ago" **over intact last-known rows**. **The sharp edge:** a synthesized `building` row carries a non-null `as_of` that is **NOT a freshness claim**, so the FE branches on `status === 'building'` BEFORE rendering "Updated" — guarded twice (unit + render) and independently RED'd at GATE Q | yes |
| `digested-labels-not-raw-dump` | scanner | S | **4th instance.** status / tier / regime / vol-regime ride the wire as closed enums cut server-side and are rendered via a **closed FE lookup, never re-derived** from a scalar; an unknown enum **fails honest** rather than guessing; no raw series rides a row | yes |
| `theme-token-discipline` | scanner | S | the whole `pages/scanner/` surface is token-only via the MUI theme with `extrasFor(theme)`, **zero hardcoded hex**, dark/light parity verified in a real browser; pinned by a mutation-tested `?raw` scan. **convexa-design colour rule held structurally:** green/red is reserved for **price direction only** — score, distances, walls and regime assert **className-identity** across opposite-signed values (the exact proximity-chip regression class), and tier is the row's single amber spend | yes |
| `no-real-order-path` | scanner | S | the scanner is **display + navigation only** — a row is a real `<a href="/ticker/{SYMBOL}">` and there is no order/trade/broker affordance anywhere on the surface (AC-11); no broker, no execution path | yes |
| `no-secrets-in-image` | scanner | S | all worker config (cadences, thresholds, store/vendor connection strings) is **runtime env only**; the tracked-universe JSON is **not a secret** and is deliberately checked in (git-reviewable curation provenance); `.env.example`/`Dockerfile` additions are value-less docs | yes |
| `additive-keeps-score-byte-identical` | bundle-events | S | the calendar is attached to `market_state` **after `generate_signals` returns** and is never a scoring input; `signals.py`/`engine.py`/`live.py`/`darkpool.py` **0 diff**, 0 imports of the events leaf. QA proved byte-identity **three independent ways**, incl. a **live A/B** (real instance with the block vs an isolated instance with `SCAN_EVENTS_PATH` missing): NVDA `opportunity_score` 79/79, tier prime/prime, `state_fingerprint` `984e75f48e50` both sides during live tape, while price/setups naturally drifted — the drift is what makes the identical triple meaningful | yes |
| `best-effort-isolated-or-null` | bundle-events | S | a missing OR corrupt calendar config yields `event_calendar: null` with the bundle still **200** and `market_state`/`strike_profile` intact (both live-tested); the attach is wrapped so a raise inside the projection cannot escape into the response path — the loader's own non-raising behaviour is defence-in-depth, not the sole guard | yes |
| `model-read-carries-its-assumptions` | bundle-events | S | **7th instance.** The block is self-describing — it carries the CONFIG's own `as_of` / `horizon_end` / `covers` / `expired`, because a date is only as trustworthy as the file's freshness. **An expired horizon FORCES `state: unknown`** rather than serving dead dates. Per-event `confirmed` + `source` + `note` reach the wire, so a cadence projection is visibly not a company announcement and a recorded source disagreement (e.g. MRVL's 7-day split) survives to the consumer instead of being flattened into a bare date | yes |
| `digested-labels-not-raw-dump` | bundle-events | S | **5th instance.** The closed `state` token (`unknown`/`none`/`scheduled`) is **authoritative on the wire** and the consumer renders it via closed lookup, **never re-deriving from `events.length`** — which it structurally cannot, since `unknown` and `none` BOTH carry `events: []`. The list is bounded + upcoming-only; `avg_abs_move_pct` stays loader-internal because the interface pins exactly 7 wire fields | yes |
| `live-vs-static-isolation` | bundle-events | S | declared STATIC — the **SSE payload gains no field** (verified by sampling 11 live payloads; `live.py` 0 diff). The calendar changes only on bundle recompute or a config edit + restart; nothing streams | yes |
| `additive-keeps-score-byte-identical` | expiration-events | S | **the trap was named in advance and avoided:** the obvious implementation decorates `compute_term_structure` where the tenor curve is built — that is `engine.py`, a scoring-path module. Instead the curve is **read off the computed bundle after scoring**. `engine.py` md5 identical to the pre-change commit (so `compute_term_structure` is provably untouched); `signals.py`/`live.py`/`darkpool.py` 0 diff. QA independently re-proved score/tier/`state_fingerprint` identity by standing up a **git worktree at the pre-change commit** and A/B-ing it live — the correct method, since two live bundles drift mid-session and cannot prove identity at all | yes |
| `absent-is-not-none` | expiration-events | S | **2nd instance — carried DOWN a level.** `expirations` is `[]` for BOTH `none` and `unknown`, so the array cannot self-disambiguate and the parent `state` remains the sole authority; the contract says so explicitly (§3) rather than leaving it to be inferred. A per-expiration "unknown" token was deliberately NOT invented — that would have created a second, competing vocabulary for the same distinction. The failure this prevents is a consumer reading an empty list as "no expiry is affected" on a ticker nobody ever curated | yes |
| `model-read-carries-its-assumptions` | expiration-events | S | **8th instance.** The containment rule is a **modelling choice with a real edge**, so it is stated exactly rather than implied: an `amc` event ON the expiration is NOT contained (the contract dies at the close, before the report), while `session: null` ON the expiration IS (an unknown session must not be silently assumed to fall after the close — the conservative direction is to flag). Both cases are unreachable from the shipped config and exist only as fixtures, mutation-tested in both directions | yes |
| `digested-labels-not-raw-dump` | expiration-events | S | **6th instance.** Each tenor carries a **summary** — count + de-duped sorted type tokens + first date — never a repeat of the event objects, which live once in `events`. The `MAX_WIRE_EVENTS` cap propagates by construction (counts derive from the already-capped list), so a per-expiration count can never exceed what the consumer can actually see | yes |
| `absent-is-not-none` | bundle-events | S | **NEW KEY (watch list, 1 instance).** A store/config that can be *uncurated* must distinguish **"we do not know"** from **"we checked and there is nothing"** — and must carry that distinction all the way to the wire, not collapse it at a boundary. Enforced by construction: the loader's `events_for()` returns `None` vs `[]` (a caller cannot treat unknown as empty without handling `None`), and the wire's closed `state` enum is the only disambiguator since both states carry an empty list. Kin to the scanner's `building` vs `error` and iv-rank's "building history". Violating it lets the app assert "no earnings scheduled" for a ticker nobody ever checked — a fabrication, not a gap | yes |
| `structural-over-prose-enforcement` | scanner | S | **2nd instance — STAYS on the watch list, deliberately NOT promoted.** Rich evidence this ship: the leaf-import boundary (not a comment) makes a scan row unable to reach `signals.py`; P4's **empty `apps/api` diff** IS the byte-identity proof; the tiering anti-herd guarantee is a **pure function with an injected clock** unit-tested without vendor or store; the `\blive\b` rule is a mutation-guarded source scan *and* a DOM sweep; the moved `shared/` primitives had their path pins **re-pointed in the same commit** rather than deleted. **Why still not canon:** the original objection is untouched by volume — it remains a *design heuristic* without a crisp violation test, and the severity path does not apply. Promote only if it earns a statable bar | yes (weakly) |
| `absent-is-not-none` | positions-legs | S | **3rd instance — GRADUATES. The first from an UNRELATED feature family, which is exactly the evidence the watch-list entry said it was waiting for.** Carried out of backend wire-config and into the **client render**: **four** not-a-number literals, each independently assertable and never rendered for another's meaning — `—` (not applicable) · `unavailable` (failed this cycle) · `not recorded` (the saved record never held this fact) · `no basis` (the denominator is about zero, while the dollar figure beside it renders fine). The literals `undefined`/`null`/`NaN` are **banned**: a cell reading `undefined` is indistinguishable from a React interpolation bug in a screenshot, and it collides with the test oracle. The failure prevented is the same one in a new costume — a migrated record with a missing `right` rendering `—` would tell the trader *"not applicable"* about a fact that **is** applicable and was simply never recorded | yes |
| `loss-free-durable-migration` | positions-legs | S | **3rd instance — and the first to REPAIR a live violation rather than merely honour the rule.** `positions/store.ts` ships today with **no fault latch**: `read()` catches an unparseable blob to `memory = empty()` and the next `putPosition` → `write()` **destroys it** — a half-violation of the key's own "degrades to empty WITHOUT destroying the original" in **shipped code**, found by the council and pulled in-scope (AC-56; `orders/store.ts` is the correct precedent copied). The design also locks: the `positions.v2` + `ghost-trade.v1` → `convexa.positions.v3` promote is a **UNION executed ONCE** (a re-run resurrects deleted records), the v1 writer dies in the same release, and the promote **ABORTS ENTIRELY if any source is unreadable** rather than freezing a partial history behind a key that claims completeness; `provenance{migrated_at,source_counts,merge_notice_dismissed}` rides the single promote-write and **corrupt or absent provenance must NEVER re-arm the migration** (non-load-bearing by construction — it can cost at most one notice, never a record) | yes |
| `additive-keeps-score-byte-identical` | positions-legs | S | `apps/api` diff is **EMPTY** — positions are client-local and never a scoring input. The sharp edge is the owner ruling that `position_eval` is **suppressed for multi-leg**: suppression is a **RENDER decision only**, the `pos_*` request stays unconditional and byte-identical, and AC-74 was reworded at S2's insistence to say so — because as first written a builder could have "satisfied" it by branching the fetch on leg count, and a QA reviewer reading it literally would have failed a correctly built feature | yes |
| `digested-labels-not-raw-dump` | positions-legs | S | **3rd instance.** `StructureKind` (22 members) is **DERIVED from leg shape and never stored** — zero durable bytes — and rendered through a **closed label lookup**. The recogniser is a **total exact-match function with no confidence measure and must never acquire one**: any leg set that is not an exact match renders `Custom`, which is *the residue of an exact match, never a judgement*. `structureKindOf` **never reads `entry_price`** (debit/credit comes from strike geometry), so a mistyped price cannot flip a label | yes |
| `model-read-carries-its-assumptions` | positions-legs | S | **9th instance.** Max loss carries its **at-expiration assumption** (`MAX_LOSS_ASSUMPTION`, fees/slippage/assignment/taxes not modeled); a withheld figure carries **its reason** (exhaustively three: `unlimited risk` · `mixed expiries` · `unnamed shape`); the percentage carries its **basis** via a discriminated `pl_pct_state` whose value branch requires `basis`. UX **rejected `Unlimited`** as the unbounded string — bare under a `Max loss` header it reads as a computed value, giving one slot two grammars | yes |
| `structural-over-prose-enforcement` | positions-legs | S | **3rd instance — still NOT promoted** (the original objection stands: a design heuristic without a crisp violation test). Strong evidence anyway: max-loss eligibility is **membership in a closed 15-member set, NOT a detection heuristic**, so an under-detected naked short is ineligible *by construction* rather than by a check that could miss — the owner's stated danger is eliminated structurally, not guarded against. Same shape as the recogniser's no-confidence-measure rule and the fault latch | yes (weakly) |
| `single-shared-sim-entry-dialog` | positions-legs | S | Multi-leg entry is an **additive SIM variant** of the ONE shared `TradeEntryDialog` — `OpenPositionInput { legs: LegInput[] }` — never a forked second dialog, and never a mode that could later carry a real-money path (the SIM-ONLY narrowing holds) | yes |
| `no-real-order-path` | positions-legs | S | Everything stays `SIMULATED`; the Live tab stays a **zero-import locked placeholder**; `BrokerPosition`, the broker adapter and the Webull connection are explicitly OUT — sequenced *ahead* of the importer deliberately, so the importer is never built against a model that cannot represent what it imports | yes |
| `live-vs-static-isolation` | positions-legs | S | The SSE-drop P/L degrade must **survive the refactor**. Reinforced by the locked **all-or-nothing partial marks** rule: one unresolved leg ⇒ **no P/L at all**, because dropping a short leg renders a loser as a winner | yes |
| `best-effort-isolated-or-null` | positions-legs | S | A leg-lookup failure, a recogniser miss or a store fault **degrades** (`Custom`, a withheld reason, a refused write) and never throws. The faulted store is a **first-class product state**, determined **synchronously at store init** so no frame paints enabled affordances, scoped to the **store not the route** (the Ticker page opens the same dialog), with refusals as `aria-disabled` **and still focusable** — a `disabled` MUI button swallows pointer events, making the tooltip explaining the refusal unreachable, which is exactly the failure the state exists to prevent | yes |
| `theme-token-discipline` | positions-legs | S | Token-only with dark/light parity, zero hardcoded hex. Locked here: **position + P&L surfaces tint by signed-P&L direction ONLY** — never call-vs-put, never position side — because *a short call is bearish*, so tinting green for containing a call tells the trader the opposite of the truth. Gamma/GEX surfaces keep call-vs-put. Canon amended in `docs/design/DESIGN_SYSTEM.md` L42–43 to state the scope | yes |
| `structural-over-prose-enforcement` | broker-option-grouping | S | **4th instance — and the one that finally supplies the statable violation test the three prior entries said was missing.** "Never name the structure" is enforced by an import **allow/deny-list** (ESLint, build-breaking, probed live with `eslint --stdin`), a **recursive two-arm source scan** (B1 whole `STRUCTURE_LABELS` values, B2 a 13-regex bare-word denylist) carrying an anti-vacuity assertion, an every-EXEMPT-path-still-exists assertion, and **four mutation guards including one proving B2 fires while B1 stays silent** — i.e. each predicate is proven independently non-vacuous — plus a **render regression under a future-feed fixture** that fails on the day Webull starts supplying contract detail. The violation test is statable in one sentence: *poison a channel and the build must go red.* Discovered mechanically, not by review: `structure.ts:153` returns `custom` ONLY because strike/expiry/right are null today, so the forbidden name would appear **by itself, with nobody deciding it** | yes |
| `absent-is-not-none` | broker-option-grouping | S | A group is a **count + a net, never an unearned label**, and the five not-a-number literals survive the netting layer distinct. Locked at GATE Q the hard way: the group P/L hardcoded `unavailable` while its own legs said `not provided` — on the real feed `unpriceable` is true for EVERY broker option leg, so **every group header would have promised a refresh that cannot help**. Fixed by deriving the literal from the ONE shared permanence-first cascade. The rule now has a second edge: an aggregate's literal must be **derived from its members', never chosen beside them** | yes |
| `additive-keeps-score-byte-identical` | broker-option-grouping | S | FE-only presentation; `git diff d53199e -- apps/api` **0 lines / 0 files**, verified against the pre-feature commit rather than against `main` (which would be trivially empty). Score invariance closed **structurally** — an empty backend diff means the FE cannot reach `signals.py` — not by a runtime A/B | yes |
| `model-read-carries-its-assumptions` | broker-option-grouping | S | The netted cost rests on a **reconstructed ×100 multiplier**, so it carries its basis label (`netted by Convexa`) and a provenance clause **gated on a derived boolean** off `_NOTE_MULTIPLIER_RECONSTRUCTED` — never hardcoded prose, which would go silently false on a zero-line diff the day a feed supplies `contract_multiplier`. Disclosure quantifies only as a **proportion** ("1 of these 2 legs"), never a dollar figure | yes |
| `live-vs-static-isolation` | broker-option-grouping | S | Classified **per datum**: the netted entry is static and keeps rendering undimmed through a stream drop; the combined P/L is live-derived and dims. A stream drop must still leave a collapsed group answering *"what did this cost me"* | yes |
| `theme-token-discipline` | broker-option-grouping | S | Zero hardcoded hex; dark/light parity verified in a real browser in **both** modes (focus ring dark `#F2A93B` / light `#8F5C0F`, both resolved from the same authored token). No new tokens, no new signature — the arc stays set-pinned to three places so the chevron could not become a fourth | yes |
| `theme-token-discipline` | distance-to-level-tiles | S | secondary caption uses theme text.secondary + mono only; no hex; no success/error tint on distance | yes |
| `additive-keeps-score-byte-identical` | distance-to-level-tiles | S | NO_BACKEND_CHANGE; pure client distance string; empty apps/api on 74df555 | yes |
| `absent-is-not-none` | distance-to-level-tiles | S | missing gex_spot+price omits secondary — never fabricates at-spot or a gap | yes |
| `theme-token-discipline` | recent-ticker-chips | S | QUICK chips theme tokens only; selected via primary/divider; no hex; no success/error tint | yes |
| `additive-keeps-score-byte-identical` | recent-ticker-chips | S | NO_BACKEND_CHANGE; nav chrome only; empty apps/api | yes |
| `absent-is-not-none` | recent-ticker-chips | S | empty/corrupt recents still show closed pins — never blank Quick row | yes |

> Note (GATE S, iv-rank, 2026-07-07): the THIRD item of the owner "enrich the downstream-AI's inputs" GATE I
> (owner pick 2026-07-06 (b); the 2026-07-02 runner-up, chosen after market-backdrop's index feed verified
> NOT_AUTHORIZED). IV Rank / IV Percentile — where a ticker's current IV sits within its own recent history
> (option premium rich vs cheap) — surfaced as the additive nested nullable `market_state.iv_rank`, AI-context
> + a Ticker static-family widget, NEVER a scoring input. **The crux:** the vendor has no historical IV → the
> feature accumulates its own, establishing the project's **FIRST persistent market-data store** — a new
> one-way leaf `apps/api/src/marketdata/` (port + `IvSample` record + on-disk-SQLite default [`IV_STORE=disk`,
> under `DATA_DIR`, survives restart] + a Postgres prod adapter behind the same port [runtime-env only,
> defer-fault-to-first-use; live-verify deferred like persistent-db — no local Postgres]), a best-effort
> write-through-on-serve accumulation (idempotent once-per-(ticker, UTC-day), no backfill) attached AFTER
> scoring, and the CM30 (~30d interpolated ATM IV off the already-computed term structure, no new vendor call)
> rank/percentile compute (≤252-session window, `N_min=20` floor, degenerate-flat handled honestly). Full
> pipeline (architect → PM → UX split → both lanes → GATE Q). **GRADUATION:** `digested-labels-not-raw-dump`
> reached its **2nd binding instance** (ai-context-pack + iv-rank's rich/cheap band) → promoted into CONTEXT §5
> + THREADS §9; removed from the watch list. `model-read-carries-its-assumptions` gained a 3rd instance; the
> four other touched keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`,
> `live-vs-static-isolation`, `theme-token-discipline`) each gained an instance — no other graduation.
> **QA (GATE Q)** fresh de-correlated **Sonnet**: **PASS 19/19** (0 FAIL / 0 UNVERIFIABLE; conformance new
> standalone spec `iv_rank.json` PASS live [warmed URL] + offline [null-fault `--sample`]; byte-identity
> independently re-derived three ways incl. a forced whole-store outage; the computed + degenerate-flat states
> force-observed by seeding the disk store directly; AC↔test traceability non-vacuous; `nx test dashboard`
> 685/685 [+27] + `@convexa/api` 13/13, `tsc -b --force` clean, `nx build` green). **No FAIL → no GATE Z bounce**
> (both lanes' first-pass builds held under independent verification — a clean run, unlike the recent
> lane-interruption ships). **New descriptive property:** the "trading/bundle path stays stateless" narrowing
> now explicitly extends to a **market-data side-store** (the `chain_store` best-effort precedent made
> persistent) — the compute reads nothing from it; an empty/wiped store degrades to "building history," never
> an error. No demotion.

> Note (GATE S, ai-context-pack, 2026-07-06): the SECOND item of the owner "enrich the downstream-AI's
> inputs" GATE I (owner pick 2026-07-06) — **bundled** the two parked scored items (AI context-scalars pack
> + TI regime bundle) into one feature: the additive nested nullable `market_state.market_context` with four
> independently-nullable STATIC children (trend/momentum digested LABELS off Wilder ADX-14/RSI-14 + EMA
> stack; GEX-profile shape scalars off the already-computed profile; flow-vs-positioning divergence off
> today's UNSIGNED cumulative volume vs OI; multi-horizon ATR). New one-way leaf `context_pack.py`, attached
> AFTER scoring; daily-bars fetch 60→400d (no new env) + additive `UnderlyingBar` high/low/session; AI-context
> (rides the unchanged wholesale `serialize_context`) + a Ticker "Market context" widget; NEVER a scoring
> input. Full pipeline (architect → PM → UX split → both lanes → GATE Q). **GRADUATION:**
> `model-read-carries-its-assumptions` reached its **2nd binding instance** (dealer-flow-projection +
> ai-context-pack) → promoted into CONTEXT §5 + THREADS §9; removed from the watch list. New watch-list key
> `digested-labels-not-raw-dump` (1 instance — the TI-labels-not-raw-values design rule the 2026-07-02 GATE I
> named). The four already-canon keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`,
> `live-vs-static-isolation`, `theme-token-discipline`) each gained an instance — no other graduation.
> **QA (GATE Q)** fresh de-correlated **Sonnet**: **PASS 26/26** (0 FAIL / 0 UNVERIFIABLE; conformance new
> standalone spec `ai_context_pack.json` + 8-spec no-regression sweep; byte-identity independently re-derived
> against the live feed; AC↔test traceability non-vacuous; `nx test dashboard` 658/658 + `@convexa/api` 13/13,
> `tsc -b` clean, `nx build` green). **Lane-interruption methodology note (system-10 kin):** BOTH executioner
> lanes were cut off by an API session limit **before self-reporting** — the "completed" notifications
> carried a session-limit banner, not a build report. The conductor treated them as UNVERIFIED and re-ran
> every gate, catching **3 FE test-ONLY defects** the cut-off lanes never ran into (component code correct):
> (1) two structural source-scans used `fileURLToPath(new URL(..., import.meta.url))` which throws in this
> Vitest env → Vite-native `?raw` import; (2) `toHaveLength(20)` vs the genuine **23** pinned enum values
> (7 label families, not 6); (3) an over-broad negative auth regex `/session/i` collided with the feature's
> own copy ("today's **session** cumulative option volume") + `queryByText` throwing on a legitimate multiple
> → narrowed to auth-CTA phrases + `queryAllByText`. Also a **stale `libs/api/dist`** (pre-rebrand
> `gammaflow.d.ts`) produced FALSE `@convexa/api` type errors under `tsc -p tsconfig.app.json` — cleaned +
> regenerated. **Lessons:** (a) a subagent "completed" whose result is a limit/quota banner is UNVERIFIED —
> re-run the gates, never trust it; (b) `tsc -b --force` (build-mode, regenerates referenced lib decls) is
> the reliable typecheck when `libs/api/dist` is stale — a bare `tsc -p tsconfig.app.json` resolves `@convexa/api`
> through the stale built `.d.ts`. **Latent finding logged (NOT this feature's regression):**
> `off_exchange.blocks[].age_seconds` drifts ~1s between identical-input runs (a pre-existing WALL-CLOCK
> display field, display-only + unscored → never touches score/tier/`state_fingerprint`); it only trips the
> byte-identity proof's stronger-than-needed "entire-bundle-identical" control, not the binding invariant.

> Note (GATE S, dealer-flow-projection, 2026-07-02): the first item of the owner "enrich the
> downstream-AI's inputs" GATE I — a projected dealer-hedging-flow read (charm limb = net_charm·days-to-
> next-monthly-OPEX; vanna limb = net_vanna at +1 and pre-scaled +5 IV-pt) built over the ALREADY-computed
> window-scoped higher-order greeks, surfaced as an additive nested nullable `market_state.dealer_flow_
> projection` — AI-context + a static-family ticker widget, NEVER a scoring input. Full pipeline
> (architect → PM → UX split → both lanes). Folded in the BACKLOG §B higher-order-greek **determinism fix**
> (`math.fsum` over charm/vanna/volga, scoped away from every scoring sum) — the pull that finally retired
> that latent item. **No new graduation** — the four touched keys are all already Promoted canon and each
> gained an instance: `additive-keeps-score-byte-identical` (signals.py 0 changes; byte-identity re-proven
> with/without AND before/after the fix), `best-effort-isolated-or-null` (per-limb + whole-object null,
> forced-exception → null, wild whole-null case), `live-vs-static-isolation` (STATIC, gex_spot basis, no
> `⏸` on SSE drop — FE contrast test), `theme-token-discipline` (token-only widget). QA (GATE Q) fresh
> de-correlated **Sonnet**: **PASS 17/17** (0 FAIL / 0 UNVERIFIABLE; conformance new standalone spec +
> 5-spec sweep; AC↔test traceability non-vacuous; AC-11/12/16/15 correctly BE-verified per the contracts,
> independently re-confirmed). **One post-QA conductor render-pass catch** (jsdom can't evaluate it, so the
> green suite couldn't): the two-limb grid wrote a container query as a responsive-VALUE key
> (`gridTemplateColumns: { xs, '@container (min-width:440px)': ... }`) — this Emotion version doesn't pass
> `@container` through, so it warned 12× AND never applied the 2-col layout. Fixed inline to the
> `repeat(auto-fit, minmax(210px,1fr))` idiom the sibling `DealerPositioning` already uses (render-verified
> two-column + console clean; suite held 617/617). **Lesson (methodology): a container-query / layout CSS
> path is invisible to jsdom — the real-browser render pass is the only gate that catches it** (kin to the
> system-10 mock-default lesson: the green suite vouches only for what the test environment can execute).
> New watch-list candidate `model-read-carries-its-assumptions` logged.

> Note (GATE S, owner 5-item program items 1–4: light-mode-parity + sim-entry-unification +
> ai-rec-backtest-orders, 2026-07-02): items shipped `8abae03` / `d704193` / `5391517` (all pushed to
> `main`); folders archived. **TWO GRADUATIONS:** `single-shared-sim-entry-dialog` (2 binding — the
> unification created it, the order variant honored it) and `theme-token-discipline` (≥3 features
> since watch-listed at convexa-redesign) → both promoted into CONTEXT §5 + THREADS §9.
> The five already-canon keys each gained an ai-rec-backtest-orders instance — no other graduation.
> ai-rec-backtest-orders: QA (GATE Q) fresh de-correlated Sonnet — **PASS 48/48** (0 FAIL, 0
> UNVERIFIABLE; conformance new standalone spec + 5-spec no-regression sweep; AC↔test traceability
> non-vacuous; all 5 invariants verified live + at source). GATE Z ×2 accepted (FE-flagged):
> `provenance.scenario_name` added to arch §2; `RecStatus.scenarios` optional-typing resilience
> noted on the interface. **One post-QA conductor render-pass catch (system-10 recurrence):** the
> AiRecPanel `!inAppEnabled` branch lacked the `!scenarioSelected` exemption — on a keyless
> deployment (the harness's PRIMARY environment) "Run scenario" was disabled; the mocked test
> boundary hardcoded `in_app_enabled:true`, so a green 594-test suite hid it. Conductor inline fix
> (mirrors the cap/cooldown bypass; precedent: the 7m stagger catch) + a harness override + named
> test `run_scenario_not_blocked_by_no_key_availability` → 595/595; the fixed path then
> render-proven live end-to-end (9-entry picker → real gate honored via Ask-anyway → scripted rec →
> Act → Waiting order watching live → Positions panel → two-step cancel → History; light theme via
> server-wins flip). **Lesson (system-10, again):** a hardcoded mock default is an untested
> integration STATE — when a wire field gains semantics, the test harness must expose it as a
> configurable axis, or the green suite silently vouches for one world only.
> already-merged ticker FE branches (`ticker-microinteractions` 418315a, `ticker-widgets` 9c66d2e→75b967e,
> `ticker-command-deck` c481c38) **plus** the post-merge external-pipeline commit `c93dddc` (ai-rec
> structured recommendation display + gated dev demo-account seed). The consolidation QA the prior session
> named as the pre-merge gate had been skipped (the stack fast-forwarded to `main`); this pass ran it
> retroactively on a **fresh de-correlated qa-verify (Sonnet)**. **No new graduation** — every touched key is
> already Promoted canon and gained an instance: `additive-keeps-score-byte-identical` (the ticker stack is
> `apps/api`-diff-empty; `c93dddc`'s backend delta never touches the scoring modules — AST 0/4, live cold==warm
> byte-identity re-proven), `best-effort-isolated-or-null` (the gated `SEED_TEST_ACCOUNT` dev seed is
> off-by-default + refuses postgres + never crashes boot; the additive AI-rec `summary`/`key_points`/
> `reengage_when` fields are bounded/nullable), `live-vs-static-isolation` (the new live motion/flash freezes
> on an SSE drop; reduced-motion honored), `no-real-order-path` (widget grip/⋮/add are affordance-only
> coming-soon; the dev seed's positions are client-local sim), `operator-vs-trader-path-separation` (untouched).
> Runtime interface conformance **11/11** across 4 specs; the `personas.assemble()` `sections`→`widgets` rename
> confirmed **dead-key/cosmetic** (no endpoint returns it, no FE consumer reads it); `demo_seed` additive +
> null-safe. **The one QA FAIL was a real regression, not a doc nit:** FRONTEND_EXECUTION_CONTRACT §3's
> staggered section reveal shipped in 418315a and was **silently dropped by 9c66d2e** when the sections were
> restructured into the bento/`Widget` grid — with **zero test covering the stagger**, so it regressed through
> a green suite. Bounced (GATE Z) + fixed inline by the conductor (`revealIndex` → inline `--widget-reveal-delay`
> → `widgetRise` delay; removed the displacing scroll-timeline override; 4 new guarding tests) → **GATE Q
> RE-RUN PASS 16/16** (nx test dashboard 486/486, tsc/lint/build green, render pass confirms the 0→385ms
> cascade in Chromium, commit `11e8ec3` pushed to `main`). **Lesson reinforced (system-10, AC↔test
> traceability):** a motion/visual AC with no named test is exactly where a later refactor silently regresses
> — the render pass caught it, and the fix adds the missing test. `theme-token-discipline` (watch list) held
> again (zero hardcoded hex across the changed ticker scope).

> Note (GATE S, redesign-stage-3, 2026-07-22): THE PROGRAM COMPLETES — the surface sweep. Motion
> consolidated around the hero moment (disposition table: 2 RETIRE / 2 KEEP-as-data-signal / 2 TAME;
> the Stage-0 stagger guards REPLACED in the same commit per the §6a-2 pre-approval — QA audited the
> commit itself); per-surface amber census (Ticker 8 / Positions 7 / Settings 3 / Scanner 2 / shell 0
> edits — spent, not sprinkled; links to signal, washes to neutral); brandGradient DELETED; textAmber
> shipped under the measured gate (light #8F5C0F, 5.23/5.67 on paper/white); TintChip gained an
> emphasis tone AND the census caught a LATENT canon violation (proximity chips green on a no-side
> datum -> neutral); ArcDivider deepened 4->8 (render-judged); the 7 blog SVGs recomposed on-system
> (the Stage-1 residual CLOSED — QA re-ran the generator to prove output provenance, zero diff); 7
> heading repairs; the closing quality-floor re-audit caught B2 (light focus ring 2.76 on panelRaised)
> -> GATE Z bounce -> fixed same-lane (light ring = textAmber, 4.78+ everywhere, dark byte-identical)
> -> QA re-verified with independent ratio recomputation. QA (GATE Q) fresh de-correlated Sonnet:
> **PASS 36/36** (battery re-run twice, e2e 13/13, guard-replacement discipline audited, zero
> UNVERIFIABLE). Suite **73/606**. Live-browser animation inventory = exactly the KEEP set.
> **Program tally: 4 stages, 4 QA PASSes (one first-pass bounce each at stages 0-conductor-catch and
> 3-B2 — both caught by the system's own checks), 0 regressions shipped, score/tier/fingerprint
> byte-identical throughout, suite 467->606.** Post-deploy eyeballs remaining: real-tab favicon,
> OS-level reduced-motion, coarse-pointer 44px. SEO-prerender UNBLOCKED. Deploy = owner runbook.

> Note (GATE S, redesign-stage-2, 2026-07-22): THE SIGNATURE ships — the mark (CONVEXA in Archivo
> Expanded caps w/ real wdth-axis font-stretch, the X cut from two convex arcs, NO gradient —
> scan-enforced), the favicon set (16/32 ico byte-parsed + svg + apple-touch 180) + og-image 1200x630
> (ruling #3 upgrade — generated by a zero-dep tool importing the SAME arc/token constants), the hero
> payoff-curve draw-in (~900ms dash-offset, settles into a full-bleed baseline; ConvexityMotif glow blob
> DELETED zero-importer; geometry latitude used: a two-segment tangent-continuous chain keeps the curve
> out of the CTA copy at 1440 — recorded, QA-judged within grant), ArcDivider at the ONLY 2 real
> straight-rule seams found (Footer, TrackRecordSection — honest counting beat decorating), landing
> <main> + h1->h2->h3 walk + the ValueCard radial light-bleed cut. QA (GATE Q) fresh de-correlated
> Sonnet: PASS — battery re-run (69/563), diff confinement 24/24 files, mutation guards proven, hero
> copy byte-identical, brandGradient survivors verified (2 consumers -> Stage 3). **QA correctly
> flagged the CONDUCTOR'S render pass as under-spec** (missing routes, a mis-named screenshot citation,
> the draw accepted structurally) -> conductor closed it post-QA: live draw proven via the Web
> Animations API (playState finished, 1328px dash traversed to 0), /ticker + /positions + landing-light
> shot, the correction recorded in RENDER_PASS.md Supplement. Lesson: GATE Q guarding the RENDER PASS
> too is the system working — the verifier verified the verifier. FE flag "pre-existing 393 landing
> overflow" NOT REPRODUCED in the real browser (378 vs 393, zero offenders) — recorded as a
> headless-capture artifact. Stage 3 accumulator: brandGradient disposition, TintChip conviction tone,
> ArcDivider depth latitude, light-amber body-text, blog SVG artwork.

> Note (GATE S, redesign-stage-1, 2026-07-22): Stage 1 — the Curvature Terminal lands at the token layer.
> Ink `#0B0F17`/panel/phosphor/steel, **gammaAmber `#F2A93B` dominant** (ink contrastText), signal-blue
> links (slot-level `MuiLink` default), warnings → burnt orange + icon-always; Archivo (real wdth-axis
> `font-stretch`, no faux) + IBM Plex Sans/Mono self-hosted (OFL verified, swap, preloads, zero external
> URL); light parity DERIVED under a **measured 19-pairing contrast gate** — one pre-authorized bounce
> (`#C9821A` 2.90:1 FAIL → `#C57F19` 3.02/3.27 PASS, recorded ×3); theme-audit gaps closed (explicit
> secondary kills the MUI purple leak, contrastText, light text.primary, dark shadows ladder); blog
> re-skinned VIA THE GENERATOR (both outputs regenerated); `sync-figma-tokens.mjs` **DELETED** (conductor
> override of §10-9 — inverted authority post-§6a-3); the old one-amber-three-meanings trap resolved by a
> CLOSED forced-rebind list (flip→amber the one amber line, spot→steel, live→signal — computed strokes
> verified). **No graduation** — 4 keys, all canon, each gained an instance (rows above; note
> `model-read-carries-its-assumptions` now applied to the design process itself). QA (GATE Q) fresh
> de-correlated **Sonnet: PASS** — battery re-run, all 19 ratios INDEPENDENTLY recomputed (matched incl.
> the bounce), 5 new specs read+run+mutation-verified (30/30), diff confinement 32/32 files in the
> permitted set, §10 rulings 9/9 honored; caught 1 of 29 lint warnings as NEW-not-pre-existing (under the
> 0-errors bar; honest). Suite 63/523. Conductor render pass: computed identity values + chart strokes +
> both-mode theme-color + the light-mode true-drop degrade walk. **Named residual (accepted, not hidden):**
> the blog articles' inline SVG ILLUSTRATIONS still carry cream/terracotta artwork styling (out of
> template-only scope) → follow-up "regenerate blog artwork onto the system" (§7u seam). Twice-evidenced
> methodology gotcha now standing: uvicorn survives a PID kill (respawn/wrapper) — kill by IMAGE and
> `curl`-confirm dead before trusting any degrade observation.
> **⚠ CORRECTED 2026-07-26 (scanner worker restart) — DO NOT "kill by IMAGE".** The observation above is
> real (a naive single-PID kill can be undone by the reloader/wrapper), but the prescribed *remedy* is
> unsafe and was nearly executed as written: `taskkill` over `IMAGENAME eq python.exe` kills **every**
> python process on the box, and on this machine two of the five were **Claude's own Windows-MCP extension**
> (`ant.dir.cursortouch.windows-mcp`) — i.e. the documented shortcut would have killed the operator's
> tooling to restart a dev server. **The correct procedure:** (1) find the real owner of the port —
> `Get-NetTCPConnection -LocalPort 8000 -State Listen | Select OwningProcess`; (2) inspect command lines
> before killing anything — `Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Select ProcessId,
> CommandLine` — and identify the app's processes (`main.py` / `worker.py`) plus any `multiprocessing.spawn`
> **children whose `parent_pid` is the server** (killing the child first stops the respawn that motivated
> the original gotcha); (3) `taskkill //PID <pid> //F` each of those, **and nothing else**; (4)
> `curl`-confirm the port is dead before trusting any offline/degrade observation. Same rigor, no collateral.
> *Generic lesson worth flowing back to the kit: a remedy written as a blunt wildcard (`*`, "all processes",
> "delete the folder") should name its blast radius — the shortcut that is convenient on a clean CI box is
> destructive on a developer's machine.*
>
> **⚠ AMENDED 2026-07-27 (second occurrence — the procedure above is necessary but NOT sufficient).**
> Killing every visible `main.py`/`worker.py` left `:8000` still returning **200 and serving real data**.
> Two wrinkles the correction missed, both now evidenced:
> 1. **The OS can report a STALE owner for a listening socket.** `Get-NetTCPConnection -LocalPort 8000`
>    named a PID that `tasklist //FI "PID eq <pid>"` said did not exist. Never conclude "already dead"
>    from the owning-PID lookup alone.
> 2. **An orphaned `multiprocessing.spawn` child outlives its parent and keeps the socket.** The real
>    holder was a child whose `ParentProcessId` pointed at the already-dead server. It hides from a naive
>    filter because **multiprocessing spawns through the BASE interpreter, not the project venv** — so it
>    reads as an unrelated system-Python process (here: indistinguishable at a glance from the operator's
>    own `server.py`). Kill-by-venv-path would have missed it; kill-by-image would have hit the operator's.
>
> **The reliable test is WHAT THE PORT SERVES, not what owns it.** `curl` the endpoint and read the
> **body** — if it returns the app's own data (the tracked universe, a bundle), something of ours is still
> up no matter what the process table claims. Then find it by
> `Get-CimInstance Win32_Process | Where-Object ParentProcessId -eq <the dead server's PID>`.
> **Close the loop the same way:** after killing, re-`curl` and require a *connection failure*. A `200` means
> you are not finished — and a status-code-only check that never reads the body can still mislead you.

> Note (GATE S, redesign-stage-0, 2026-07-22): Stage 0 of the Q4(a) "Curvature Terminal" program — the
> quality-floor repair (correctness, not identity): 393px overflow killed (580→378, root causes the bento
> track `1fr`→`minmax(0,1fr)` + toolbar wrap + an sr-only `width:1`=100% MUI bug), hamburger/drawer nav
> (folded the parked `feat/responsive-layout`, one mechanical conflict — `app.spec.tsx` deleted on main by
> the test migration, intent re-expressed in `app.risk.spec.tsx`), theme-layer `:focus-visible` rings,
> semantic repair (29 `<h6>` stat values → 0 + `<main>`), 11px/44px floors (+5 sub-floor rem sites swept
> beyond the contract's enumeration), honest copy (hero/settings/"last last" — the typo was the FE
> double-prefixing a wire field), theme-color-follows-mode. **NO new graduation** — the five touched keys
> all already canon, each gained an instance (rows above). GATE V fast-path (UX → FE), first program run
> under the `convexa-design` skill as rule-of-record + the v0.6.1 FE identity opener. QA (GATE Q) fresh
> de-correlated **Sonnet: PASS 6/6 scope items · 15/15 §8 matrix** (battery independently re-run; Cypress
> 12/12 mobile enforcement — the §8.1 first run FAILED and caught 3 real offenders before passing; §10's 5
> pre-ruled questions honored 5/5; conformance n/a-and-correctly-absent). Conductor render pass (Playwright)
> incl. a TRUE-drop offline walk at 393 — first probe showed no degradation because **3 orphan uvicorn
> processes were still serving :8000** (the Windows orphan-server gotcha; methodology note in
> RENDER_PASS.md), a clean kill fired the watchdog exactly to spec. Post-merge battery re-run green
> (58/493 — main had just received the LatencyTrend spin-off PR #1). Two recorded judgment calls:
> Cypress-for-Playwright substitution (repo's e2e runner — enforcement intent met) and the
> `pointer: coarse`-gated touch floor. Stages 1–3 pending, each its own folder.

> Note (GATE S, convexa-redesign, 2026-06-30): the full **presentation-only** FE re-skin to the Figma DS
> (all surfaces + theme/token bridge + app-wide contained-button treatment), merged to `main`. **No new
> graduation** — it is FE-only (`apps/api` diff vs main EMPTY), so `additive-keeps-score-byte-identical` is
> structural (score/tier/`state_fingerprint` byte-identical, verified by the passing byte-identity test +
> the empty backend diff); `no-real-order-path` reaffirmed (sim dialogs + locked Live tab, no order path);
> `live-vs-static-isolation` preserved through the re-lay-out. All three are already Promoted canon → each
> gained an instance, no new promotion. **Token discipline** ("reskinned components bind to the MUI
> theme/`tokens.ts`, never hardcoded hex") recurred hard across this program (drawer rebind + button
> treatment + dialog) — logged to the watch list as `theme-token-discipline` (candidate; FE-redesign-class,
> judge on cohesion not trading edge). QA (GATE Q) fresh de-correlated: PASS (425/425, `nx build` green,
> tsc clean). A pre-existing TS17001 build blocker (duplicate `sx`, `SettingsPage.tsx`) was caught by the
> pre-merge typecheck/build gate that Vitest doesn't run — reinforces "run `tsc`/`nx build` at GATE Q, not
> just the test suite." Owner-dropped the `/auth` full-page route (feature scope, not a canon change).

> Note (GATE S, deploy, 2026-06-29): step 3 of the infra program — the deploy ARTIFACTS + security
> hardening (the live deploy itself is the owner applying the runbook). Railway (backend container +
> Postgres) + Cloudflare Pages (frontend) wired via a streaming Pages Function proxy (`/api/*`→Railway,
> SSE-safe; client uses relative `/api`, so zero client change). Repo changes R1–R4: `$PORT`-honoring CMD,
> env-gated CORS (`ALLOWED_ORIGINS`), the Pages Function, edge-block of `/api/_metrics`. **system-6
> Security/red-team ACTIVATED for the first time** (the deferred role, triggered by going public; run on a
> different model) → verdict **GO-WITH-REQUIRED-FIXES**: 3 HIGH closed before ship — HIGH-1 token-gate
> `/api/_metrics` (`METRICS_SECRET_TOKEN`), HIGH-2 per-IP rate-limit on the anon cost-bearing
> `/api/ticker`+`/api/stream` (`PUBLIC_RATE_LIMIT_PER_MIN`, owner-chosen; fail-open leaf, 429-before-vendor),
> HIGH-3 startup WARNING when `ACCOUNT_STORE=postgres` + a stable key is missing; +3 MED/+3 LOW logged as
> fast-follows (SECURITY_REVIEW.md). **GRADUATION:** `no-secrets-in-image` hit its 3rd binding instance
> (real registry push) → promoted into CONTEXT §5 + THREADS §9. `additive-keeps-score-byte-identical` gained
> an instance (already canon). **Pending owner action:** apply the runbook (create the Railway service +
> Postgres, set the env/secrets incl. the new `METRICS_SECRET_TOKEN`/`PUBLIC_RATE_LIMIT_PER_MIN` + stable
> keys, set the Cloudflare build + `API_ORIGIN`) → then the live smoke test. Not yet live.

> Note (GATE S, persistent-db, 2026-06-29): the in-memory→Postgres persistence swap (psycopg3 sync raw-SQL
> adapter behind the existing 4 auth ports; `ACCOUNT_STORE=postgres`+`DATABASE_URL`; in-memory stays default;
> DB-outage fail-closed for auth / trader path stays up). Infra fast-path (architect → backend build →
> conductor static review; PM/UX skipped). **Live-Postgres verify DEFERRED** (no Postgres in the dev box) —
> verified by the in-memory-default conformance (no regression) + statement-level SQL parity review + the
> ciphertext-only/leaf-boundary AST checks. **GRADUATION:** `secret-encrypted-at-rest` reached its 2nd
> binding instance (byo-ai-key → persistent-db held the ciphertext-only boundary across a NEW store) →
> promoted into CONTEXT §5 + THREADS §9. `additive-keeps-score-byte-identical` + `best-effort-isolated-or-null`
> each gained an instance (already canon). `no-secrets-in-image` hit 2 instances but is **deliberately held**
> to the `deploy` feature (it governs *published* artifacts; nothing's been pushed yet). **Deferred seam
> named:** the per-admin AI metering counters are process-local (NOT behind the stores) → not shared across
> replicas; centralizing them is a future item, out of scope here. system-6 (adversarial review of the
> persistence/deploy + credential surface) still lands at go-live.

> Note (GATE S, byo-ai-key, 2026-06-29): the hybrid bring-your-own AI-key feature — per-user encrypted
> Anthropic keys (own-key-first), admin-only free allowance (default 3/day) on the shared key, the 5-state
> resolution incl. `shared_key_unconfigured`. **GRADUATION:** `server-side-gate-enforcement` reached its
> **2nd binding instance** (user-accounts AC-E7 catch → byo-ai-key's server-authoritative credential/rec
> gating) → promoted into CONTEXT §5 + THREADS §9 (Promoted canon above); removed from the watch list. A
> satisfying loop closure: a key the QA role *surfaced from a failure* (AC-E7) recurred and graduated. The
> two already-canon keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`) each gained
> an instance — no new graduation from them. New watch-list key `secret-encrypted-at-rest` (1 instance;
> will recur on broker-connect). QA (GATE Q) on Sonnet, de-correlated: initial FAIL on AC-19 (uncovered by a
> named test though the behavior worked) → bounced → FE added the test → **RE-RUN PASS 26/26**, security
> floor + score byte-identity + conformance all clean. `system-6` (Security/red-team) stays DEFERRED
> (encrypt+hygiene floor enforced) — but credential custody (encrypted user keys) makes byo-ai-key its
> eventual first client at the go-live trigger.

> Note (GATE S, rebrand-convexa, 2026-06-28): the GammaFlow→Convexa rebrand was **completed** — extended
> from UI-only to the whole codebase (134 refs / 51 files): identifiers, the `gammaflow.ts`→`convexa.ts`
> client, logger/title/ContextVar, docs/README/CLAUDE.md, `project.json` `project_name`, and a **loss-free
> migration of the 4 durable localStorage keys** `gammaflow.*`→`convexa.*`. **REVERSES the earlier
> "Convexa = UI-only / don't rename code/keys" decision** (app-shell-landing GATE-S note above; CONTEXT
> §1/§6, THREADS §7d) by deliberate owner choice (2026-06-28). It was a **feature decision, not a
> Promoted-canon key**, so it is **updated in place** (CONTEXT §1 brand line + the feature-state UI-only
> notes annotated "superseded"; THREADS §7d/§7g) — **NOT** moved to the Demoted table. New watch-list key
> `loss-free-durable-migration`. The three logged keys (`additive-keeps-score-byte-identical`,
> `best-effort-isolated-or-null`, + the new migration key) — the two canon keys gained an instance, no new
> graduation. QA (GATE Q) on Sonnet, de-correlated: **23/23 ACs PASS**, conformance unchanged, dashboard
> 283/283 + @convexa/api 7/7. STAYS unrenamed (non-goals): `@org/*` scope, `DATA_DIR`, the local working
> folder, and archived-contract/ledger history (provenance).

> Note (GATE S, user-accounts, 2026-06-25): the project's **first stateful backend surface + first
> credential store** (email/username+password auth, server-side sessions, per-user light prefs, Google
> OAuth wired-but-config-gated-OFF, in-memory SQLite behind a swap seam; hybrid access — anonymous
> browsing open, the sim Positions write actions + the "ask AI" call require a session). The three touched
> promoted keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`,
> `no-real-order-path`) each gained an instance → **no new graduation** (all already canon);
> `no-real-order-path` is now at **3 binding instances**. The `best-effort-isolated-or-null` instance
> carries an explicit **CARVE-OUT** (auth endpoints legitimately return real HTTP statuses — a NEW class,
> not the bundle null-rule), documented in CONTEXT §5 and the row above; this refines the rule's scope
> without demoting it (the trading-path guarantee is untouched and reaffirmed). **Descriptive-property
> narrowing (NOT a promoted-canon demotion):** the informal "stateless server" property is narrowed in
> CONTEXT §2/§5 to "the **trading/bundle path** stays stateless; auth introduces a contained, swappable
> state store outside that path." It was never a Promoted-canon key (no Demoted-table move). New watch-list
> key `server-side-gate-enforcement` logged (the AC-E7 GATE Q catch). QA (GATE Q) on Sonnet, de-correlated:
> initial FAIL on AC-E7 (FE-only gate) → bounced (GATE Z) → FE wired the server gate → **GATE Q RE-RUN
> PASS** 30/30, conformance 2/2, `dashboard` 246/246 + `@convexa/api` 7/7.

> Note (GATE S, ticker-load-experience, 2026-06-25): perf + UX refinement of the ticker page (chain
> pre-warm 7.8s→1.2s, fetch concurrency, request-coalescing, skeleton-first load, live last-trade). The
> three already-canon keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`,
> `live-vs-static-isolation`) each gained an instance → **no new graduation**. The notable decision is a
> **system-7 NARROWING** of the THREADS §9 resolved decision "Live spot = NBBO mid — do not add
> last-trade": by explicit owner decision (2026-06-25) the rule is narrowed to "the **mid stays the
> anchor** for headline/levels/flip; a **display-only last-trade readout MAY be added** beside it." Not a
> promoted-canon key (it lived in THREADS §9 "Resolved", not the Promoted table), so it is narrowed in
> place in THREADS §9 + PROJECT_CONTEXT §5 rather than moved to the Demoted table; the anchor decision
> itself stands. Letting last-trade drive the anchor/levels/flip remains a GATE-Z reversal.

> Note (GATE S, app-shell-landing, 2026-06-24): pure FE restructure + rebrand (Convexa, **UI-only** — no
> code/package/store-key rename). The five binding keys above each gained an instance but are all already
> canon → **no new graduation**. `operator-vs-trader-path-separation` is now at 3 instances
> (backend-observability, latency-visualizer, app-shell-landing).

> Note (GATE S, positions-portfolio, 2026-06-24): `no-real-order-path` reached **2 binding:yes instances**
> (ai-recommendations, positions-portfolio) → crossed the "≥2 if all binding" threshold → **GRADUATED** by
> the Orchestrator into CONTEXT §5 + THREADS §9 (Promoted canon above); removed from the watch list. The
> three already-canon keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`,
> `live-vs-static-isolation`) each gained an instance but are already canon → no new graduation this ship.

> Note (GATE S, latency-visualizer): `operator-vs-trader-path-separation` reached **2 binding:yes
> instances** (backend-observability, latency-visualizer) → crossed the "≥2 if all binding" threshold.
> **RESOLVED — GRADUATED by the Orchestrator 2026-06-23** into CONTEXT §5 + THREADS §9 (see Promoted
> canon above). The executioner detected/flagged; the Orchestrator held the promotion pen.

> Note (GATE S, ai-recommendations, 2026-06-23): first **DEMOTION** (system-7). `ai-external-no-llm`
> ("GammaFlow does not call an LLM") is contradicted by `ai-recommendations` — by explicit owner decision,
> GammaFlow now calls an LLM as an isolated/gated/advisory consumer. The rule is **NARROWED** (not erased)
> in CONTEXT §8 and moved to the Demoted table; provenance rows retained. DETECT tally: the three
> promoted keys (`additive-keeps-score-byte-identical`, `best-effort-isolated-or-null`,
> `live-vs-static-isolation`) each gained an instance but are already canon → **no new graduations** this
> ship; `no-real-order-path` logged to the watch list (1 instance).

> **GATE S tally — outcome-ledger (2026-07-16).** **NO new graduations:** all 12 keys this feature logged
> are **already promoted canon**. Instance counts moved: **`loss-free-durable-migration` 1 → 2** ·
> **`model-read-carries-its-assumptions` 3 → 4** · **`digested-labels-not-raw-dump` 2 → 3** ·
> **`score-change-is-deliberate-and-measured` 0 → 1** (its first instance — as the rule's *enabler*, never
> its exerciser). New watch-list key: **`structural-over-prose-enforcement`** (1 instance, not promoted).
> **Worth recording — the severity path validated itself:** `loss-free-durable-migration` was promoted
> **2026-07-16 at 1 instance on SEVERITY**, over the objection that recurrence had not been met. The very
> next feature became its **2nd binding instance** — and did so in the sharpest possible way: it had to
> **REFUSE an import** rather than let the store APIs rewrite an unreadable blob. Under the old
> recurrence-only rule the key would still have been on the watch list **while the feature that needed it
> was being built**. Recurrence has now caught up to severity; the call did not depend on that, and would
> have been right regardless.
> **Also of note:** this ship exercised the amendment loop **four times** (A1, A2, A3, PM §11.6) plus two UX
> copy rulings — every one of them raised by a *downstream* lane refusing to decide out of its own lane, and
> every one of them a real defect. See `OPEN_THREADS.md` §7t.

> Seeded retroactively 2026-06-22 from the five archived features (`OPEN_THREADS.md` §3–§7). Going
> forward, the Orchestrator appends a row per binding decision at each gateway (ORCHESTRATOR §0 step 7).
| `absent-is-not-none` | score-lab-signal-comparison | C | a below-floor value is rendered WITH its marker in one literal, never suppressed — suppressing it collapses "thin" into "uncomputable", the same failure at the opposite end of the axis; the artifact always carries the value plus `n_eligible`/`floor_in_force`/`under_powered` (owner ruling C-2) | yes |
| `absent-is-not-none` | score-lab-signal-comparison | C | one closed vocabulary over every not-a-number cause, at three layers (`Ineligible` row → `CellState` cell → exactly one rendering literal per key), plus a `MetricState` layer for metric-level absence inside a computed cell; two vocabularies over the same cells is itself the defect | yes |
| `structural-over-prose-enforcement` | score-lab-signal-comparison | C | metrics live INSIDE `Computed { metrics, power }`, so a thin cell structurally cannot lack its numbers — the show-don't-suppress rule is enforced by the type, not by prose an implementer must remember | yes |
| `structural-over-prose-enforcement` | score-lab-signal-comparison | C | definitional coupling is detected from **declared derivation provenance over a closed `DerivationKey` enum**, never from field-name intersection; `derived_from` is the TRANSITIVE determinant set and is required + non-empty, so an undeclared candidate/label is a build-time omission rather than a silent pass | yes |
| `operator-vs-trader-path-separation` | score-lab-signal-comparison | C | the research CLI loads via a STRICT read with no fallback (hard error before any metric or artifact); the trader-serving `GET /api/scan/{symbol}/history` keeps its degrading fallback — one shared reader, two deliberately different failure policies | yes |
| `score-change-is-deliberate-and-measured` | score-lab-signal-comparison | C | the lab MEASURES only — no weight, constant, gate threshold or fingerprint basis changes, and no lab result authorizes a score change on its own; deconfounding (partial correlation, residualized candidates, "score minus its proximity term") is explicitly out of scope as a modelling change | yes |
| `model-read-carries-its-assumptions` | score-lab-signal-comparison | C | the report emits an `Evidence:` block of FACTS ONLY (session count, span, sample counts) and never a pass/fail verdict against the multi-week bar; the bar's text prints beside the run's values, the comparison's outcome is never emitted | yes |
| `dark-pool-context-only` | score-lab-signal-comparison | C | restated, not changed: the composite score already carries a capped, toggleable off-exchange bonus (`OffExchange`/`PeakGex` are declared determinants); the feature adds no dark-pool read, changes no cap, and never presents confluence as directional | yes |
| `absent-is-not-none` | score-lab-signal-comparison | Q | the invariant was found **BREACHED in the shipped artifact** at GATE Q pass 1 and closed by pass 3: `comparison.rs` had hard-coded `auc 0.5 / lift 1.0 / precision 0 / recall 0` onto candidate-scope records and `retention[]` entries — carriers that have no label and therefore no such statistic — so the permanent research record asserted a chance-level score about rows with nothing to score. Fixed as `MetricValue::Absent(MetricState::UndefinedOnThisData{..})` naming the failed precondition. **Source review passed it; only reading the EMITTED artifact caught it** — verify absence-vocabulary invariants on the emitted bytes, never on the source | yes |
| `structural-over-prose-enforcement` | score-lab-signal-comparison | Q | **a guard that satisfies a required NAME without the required BEHAVIOUR is worse than no guard** — `no_retention_literal_appears_in_emitted_strings_or_source` scanned `include_str!("artifact.rs")` (one module's own source), so a hardcoded span typed into `render.rs`, where the copy is actually assembled, left it green. The key's own bar settles it: poison the thing the rule forbids and the build must go red. QA poison-proved all three of this feature's new guards RED against product source, then restored byte-identically | yes |
| `structural-over-prose-enforcement` | score-lab-signal-comparison | Q | a literal-level test is not a cell-level test: `vocabulary.rs:521` asserted the ten rendering literals **in isolation**, so appending a caveat to a cell could break the cell's closing shape with nothing going red (AC-37 shipped broken on 6 of 75 cells, introduced by the AC-15 fix). Assert the invariant at the scope the user reads it at — the rendered cell — not at the scope it is authored at | yes |
| `additive-keeps-score-byte-identical` | tradeable-rec-inputs | C | candidates / straddle-implied move / risk block / cap verdict are AI-context + display only — none reaches signals, `opportunity_score`, tier, gate, or `state_fingerprint`; the prompt assembler forwards a PRUNED CLONE of `market_state`, never mutates it | yes |
| `digested-labels-not-raw-dump` | tradeable-rec-inputs | C | candidate quotes ride a dedicated type-capped read, NEVER the bundle payload; the owner-ruled (A) no_trade liquidity line is a set-level digested read — closed labels (count-across-expirations, spread band, wide-quotes marker), no per-contract rows, no strike axis | yes |
| `no-real-order-path` | tradeable-rec-inputs | C | the risk block is sizing CONTEXT only: the numeric pre-fill left v1, `position_size` is never parsed by any lane, `max_risk` is parsed once server-side solely for the stated NON-BLOCKING cap comparison — never blocks, never refuses, no order surface | yes |
| `absent-is-not-none` | tradeable-rec-inputs | C | closed vocabularies at every layer: 5-member cap verdict with `not_applicable` resolved FIRST (a no_trade asserts no risk figure — the premise is absent, not unreadable; S2's Critical made unreachable by construction); `not set` the single absent-risk-block literal; the zero-bid filter and the IV `0.0` unpriced sentinel must surface as no-two-sided-quote / unpriced, never as data | yes |
| `model-read-carries-its-assumptions` | tradeable-rec-inputs | C | the chain-derived move is labeled `Straddle-implied move` (a straddle price, not a probability) and its basis line visibly carries expiration · DTE · mid-quote basis · %-of-anchor-spot (`gex_spot`, named), never tooltip-only | yes |
| `egress-copy-tracks-payload` | tradeable-rec-inputs | C | NEW KEY (1st instance): when a feature widens what leaves the machine, every shipped egress claim is amended in the SAME feature (stale promise = ship blocker, not polish), and the disclosure lands ABOVE the first input that feeds it — visible before first save, DOM-ordering test-verified | yes |
| `absent-is-not-none` | tradeable-rec-inputs | Q | a measurement that cannot run records its unavailability as a FINDING, never a synthesized result: the V10 before/after artifact's first attempt hit no-LLM-key on both arms and wrote "unavailable — no key" per ticker (refusing `AI_REC_LOCAL_ONLY` as a stand-in that would have manufactured 0-flips); the honest attempt is preserved as history in the final artifact | yes |
| `structural-over-prose-enforcement` | tradeable-rec-inputs | Q | a guard must assert the POSITIVE at the rendered scope, not only the negatives — the no_trade four-field-row guard passed over a fully EMPTY card because it only asserted two absent literals; rewritten to require the row + all four `—` present, then poison-proved (blank the row → red → byte-identical restore) | yes |
| `structural-over-prose-enforcement` | ai-rec-grounding | I | the `max_risk` parser's two-different-figures ambiguity rule (`max_risk.rs` → `NotParseable`) is **NOT reopened**: it is correct by design and the measured `cap_check: not_checkable` on 4/4 after-arm trades is a PROMPT defect. The remedy is prompt wording (state one figure), never a parser loosening — a looser parse would silently pick one of two figures the model meant differently, converting a visible "couldn't check" into an invisible wrong check. Folded into this feature rather than scheduled separately so the surface is touched once | yes |
| `ai-asserted-numbers-are-traceable` | ai-rec-grounding | C | **FIRST INSTANCE of a key parked at 0 since 2026-07-16 as aspirational.** A number the model asserts is `Traced` ONLY against a Convexa-computed value under a closed wire vocabulary; the cap-anchored shortcut was withdrawn at R3 because a fabricated $480 under a $500 cap would have rendered traced, and the app must never say `traces to Convexa's risk cap (500)` about a figure the OWNER typed — unrenderable by construction (anchor names are a total lookup on a closed `anchor_kind` set with no cap member). Honest shortfall stated in SPEC §1 rather than papered over: `max_risk` + `position_size` are STRUCTURALLY not-checkable in v1 | yes |
| `absent-is-not-none` | ai-rec-grounding | C | four wire states, not a boolean — `not_applicable` / `not_checkable` / `traced` / `untraced` — carried intact to the client render; collapsing "the source was unavailable" into "we checked and it matches nothing" is the fabricated-claim failure one level in. `NotCheckable` further carries its own reason (`StructurallyUnchecked`), and `RiskRefusal { NoText \| NoDollarFigure \| MultipleDifferentFigures }` distinguishes three causes the single `NotParseable` had collapsed | yes |
| `structural-over-prose-enforcement` | ai-rec-grounding | C | **S2 caught a ship-blocking AC whose enforcement was PROSE** — AC-50 mapped to none of §2.6's seven guards while every other ship-blocking structural AC mapped cleanly. Closed with guard 8 (resolution-boundary pin) asserted through `envelope_extras`, the real serialization path, NOT the leaf's internal function — the `score-lab-signal-comparison` sibling-file shape. Non-vacuity rests on two properties: edge values are LITERAL numbers never derived from `GROUNDING_TOL_PCT` (a fixture computing its edges from the constant it pins moves with it and proves nothing), and the set asserts its own discrimination (every checked field needs ≥1 traced AND ≥1 untraced arm). Four poison arms must each go red. §2.6 now opens with a guard→criterion mapping table so the same gap is visible by inspection | yes |
| `digested-labels-not-raw-dump` | ai-rec-grounding | C | the wire token is authoritative and the card-level verdict is SERVER-FOLDED — six members in a pinned order plus four server-supplied integers; the browser never folds field tokens into a verdict and never counts. Exactly ONE branch is client-selected (block absence). `basis` is three-membered on the wire (`exact \| near \| inside_range`) rather than letting the client choose between "traces to" and "near", which would be the client-side comparison this rule forbids | yes |
| `no-real-order-path` | ai-rec-grounding | C | nothing untraced ever seeds, pre-fills, defaults or is arithmetically derived into any quantity, price or limit anywhere, INCLUDING the simulated entry dialog — unconditional, and the one rule both PM and UX held through the whole render disagreement | yes |
| `additive-keeps-score-byte-identical` | ai-rec-grounding | C | grounding is a one-way leaf that cannot reach `signals` / `opportunity_score` / `opportunity_tier` / `state_fingerprint`; enforced two-armed at guard 6 — the pin's assertions green AND the pin file's OWN diff empty (`git diff --stat -- apps/api/tests/score_identity.rs` in the build receipt), so a green run bought by editing the goldens is visible. The `outcome-ledger` empty-diff precedent | yes |
| `model-read-carries-its-assumptions` | ai-rec-grounding | C | no percentage appears in any per-figure clause: `GROUNDING_TOL_PCT = 0.1` applied as `max(0.01, anchor × TOL/100)` is stated ONCE on the payload and surfaced once in the tooltip, while the three traced literals show both real numbers (`traces to Convexa's put wall (412)` exact · `near Convexa's put wall (412)` inside tolerance · `inside Convexa's implied move for {expiration} ({low}–{high})` containment). The word "verified", any check glyph, and the accusatory register are BANNED — traceable is not the same claim as correct | yes |
| `ai-asserted-numbers-are-traceable` | ai-rec-grounding | Q | **VERIFIED AT GATE Q, not merely specified.** QA poison-proved all nine structural guards itself (16 mutations, every one RED, all restored byte-identically) and ran layer 2 for real — one live `POST /api/recommendation/SPY`, 36/36 required paths, 35 nullability biconditionals, and it recomputed a resolution by hand (stop 781.0 → `near vwap_upper_3 (780.69)`, abs delta 0.31 <= window 0.781). The measured reality the feature exists for: **44.4% of asserted numbers do not trace** — every one of which rendered as fact before this ship | yes |
| `structural-over-prose-enforcement` | ai-rec-grounding | Q | **a guard the builder itself could not catch:** during the poison drill the backend lane found guard 8c ("swap `pruned_move` for `raw_move`") had NO in-process test that could fail — the fixtures call `envelope_extras` directly with a self-built move, bypassing `generate_recommendation`'s own `base`-closure wiring. Discovered only by attempting the poison, never by reading the guard. Closed with a wiring pin, then re-poison-proved by QA independently. **Corollary recorded the same ship:** the pin matched a literal `\n`, so under `core.autocrlf` it failed on any Windows clone — and the tempting fix (weaken the assertion) would have satisfied the guard's NAME while destroying its BEHAVIOUR. Fixed by normalizing line endings with the assertion byte-identical, re-proved RED under BOTH LF and CRLF | yes |
| `absent-is-not-none` | ai-rec-grounding | Q | the three prefill literals share a `Not pre-filled — ` stem with fully distinct tails, and **block-absent got its own third literal (D8) rather than reusing `not_checkable`** — reuse would have collapsed "we could not check this figure" into "no check reached this browser at all" at the ONE boundary where an untraced number stops being a display and becomes an input. Enforced by the `f == null` check running BEFORE the switch, so block-absent and `not_applicable` cannot share an arm | yes |
| `measurement-states-its-own-provenance` | ai-rec-grounding | S | **NEW KEY (1st instance).** An artifact whose purpose is to prove a measurement was honest must state **what is corroborated and what is not**, and must name its own weakest link rather than leave it for a reader to find. Here: the D7 ladder's pre-commitment IS corroborated (SPEC §7, on disk 01:55:18Z, read independently by QA hours before any call; the single prompt revision strictly between passes at 04:14:50Z; four source files md5-identical to QA's pass-1 bytes, proving no tolerance widening or scope cut) — but the **≥50% bar is not in SPEC §7, exists only in the artifact, and sits exactly between the two measured rates (57.1% / 44.4%)**. The artifact now says so itself. A provenance claim that cannot be corroborated is stated as what happened, never as what a timestamp proves, and no supporting evidence is manufactured | yes |
| `absent-is-not-none` | rec-absence-literals-hole | I | **the feature exists to close a violation of this key, and the cull was decided on it.** Six fields on the AI rec (`Structure`, `Strike(s)`, `Expiration`, `Entry trigger`, `Time horizon`, `confidence`) render a bare `?? '—'` in the TRADE branch, while `—` is defined in the `no_trade` branch as *"No entry, so there is nothing to size."* So a card headed `Trade · long` can print `Strike(s): —` — the reserved no-entry literal on a card that just told you to enter, making "the model never named a strike" indistinguishable from "no strikes apply." The fix is the closed `FieldLiteral` union already shipped in the same file (`literals.ts:50`), i.e. enforcement in the vocabulary rather than in prose | yes |
| `ai-asserted-numbers-are-traceable` | rec-absence-literals-hole | I | **2nd instance of a watch-list key parked at 0 since 2026-07-16 and moved to 1 by `ai-rec-grounding`.** Grounding covered the numbers the AI **asserts**; this covers the ones it **omits** — the other half of the same hole, and the residual `ai-rec-grounding` named in its own SPEC §9.5. Recorded at GATE I so the recurrence is auditable at GATE S; the promotion judgement (recurrence at 2-binding vs the queued severity-path question) stays with the owner | yes |
| `structural-over-prose-enforcement` | rec-absence-literals-hole | I | the GATE-I feasibility read set the enforcement bar before the council opens: closing this by *editing six call sites* is prose enforcement (the seventh bare `?? '—'` re-opens it silently). The statable violation test is **poison it — reintroduce a bare `?? '—'` on a rec field and a scan must go red — and that scan must itself be proven non-vacuous.** Recorded as a binding constraint on the design, not left for a lane to remember | yes |
| `absent-is-not-none` | rec-absence-literals-hole | C | the six plan/context fields render exactly one member of a closed vocabulary selected by **wire token**, never by testing a null. `—` stays reserved to the `no_trade` risk block; an absent `field_reasons` block defaults to `not_given` (never `unavailable`, whose shipped copy asserts an input failed — false on both reachable paths); an off-scale confidence emits `ReasonKind::UnrecognizedValue` from exactly ONE expression rather than collapsing into "declined to answer". `PlanFieldLiteral = FieldLiteral \| {kind:'unrecognized'}` keeps the shipped union at five so `literals.spec.ts` and every shipped consumer stay unedited | yes |
| `structural-over-prose-enforcement` | rec-absence-literals-hole | C | four enforcement layers, each with a stated poison AND a stated non-vacuity proof. **The bar was raised by this council:** a character-level em-dash scan was rejected after measurement (`copy.ts` 50 + `AiRecPanel.tsx` 57 + `literals.ts` 28 ≈ 135 legitimate punctuation sites) — a guard red on day one against shipped unrelated code is `ci-standing-red` in miniature, not enforcement. Re-homed to a slot-scoped render guard whose non-vacuity arm asserts **an exact count** of resolved label anchors, so tagging five of six reds where a bare "non-empty" assertion would have passed | yes |
| `single-shared-sim-entry-dialog` | rec-absence-literals-hole | C | **honored, not narrowed** — the Accept fix changes the ONE shared sim dialog's *seeding*, never forks it. Uniform rule across all three seeded fields: **the seam carries `null`, the draft carries `''`, mapped at one boundary line.** `LegDraft.right` becomes `OptionRight \| ''` following the file's own established sentinel (`strike: number \| ''`, `price: number \| ''` — "not typed yet") rather than introducing a nullable into a third file. Branching on **prefill presence, not field value**, is what carries the distinction, because `??` fires identically on `null` and `undefined` | yes |
| `cited-code-is-verified-not-assumed` | rec-absence-literals-hole | C | **NEW KEY (1st instance — 3 occurrences inside one feature, the `vendor-contract-verified-not-faked` shape).** A design artifact must not assert a fact about EXISTING code it plans to reuse unless that fact was read at source. This council asserted three and all three were false: `Field` "already has the test ids the shipped specs use" (it has no `data-testid` prop at all, `reasoning.tsx:22-53`) · `LegDraft.right` was assumed widenable to `null` (non-nullable `OptionRight`, `types.ts:152` — would not compile) · the prefill seam was named `AiPrefill` when the dialog's prop and `openEntry` both take `EntryPrefill` (`types.ts:24-40`) — a **second** compile failure, found only by an explicitly-commissioned self-audit after the first two. Two were caught by the adversarial reviewer, one by the audit, **none by the authoring voice's own confidence.** Countermeasure adopted here: unverifiable claims carry a `[lane-check]` mark (6 in the shipped SPEC) instead of being asserted, and the plan schedules each as an owned verification step. *binding:yes — a future feature violates it by spec'ing a mechanism against remembered code.* | yes |
| `structural-over-prose-enforcement` | ticker-visual-collisions | S | Quick separator width and GEX marker-label bounds/collisions are rejecting tests (`QuickSymbols.spec.tsx`, `markerLayout.spec.ts`, `StructureFieldCanvas.spec.tsx`); a future marker that paints its own `measureText` + clamp path is the live/mid defect this feature already bounced once | yes |
| `theme-token-discipline` | ticker-visual-collisions | S | repair uses existing divider/text/directional chart tokens only — no new hex, palette role, or motion family | yes |
| `live-vs-static-isolation` | ticker-visual-collisions | S | `live` vs `mid` wording and offline/static treatment stay; only placement changed | yes |
| `single-motion-moment` | ticker-visual-collisions | S | no new animation or keyframe family | yes |
| `additive-keeps-score-byte-identical` | ticker-visual-collisions | S | `NO_BACKEND_CHANGE`; empty `apps/api` feature diff | yes |
| `structural-over-prose-enforcement` | ai-rec-decision-card | S | result buttons consume `deriveAiRecPresentation`; they do not each re-derive freshness, completeness, auth, cap, cooldown, or risk-input changes. A new action that bypasses the policy is the violation | yes |
| `single-shared-sim-entry-dialog` | ai-rec-decision-card | S | Review and Create-sim-order stay on the one shared `TradeEntryDialog`; this feature adds no forked entry surface | yes |
| `no-real-order-path` | ai-rec-decision-card | S | card actions are simulated only; no broker or live-order path | yes |
| `ai-asserted-numbers-are-traceable` | ai-rec-decision-card | S | the card does not invent evidence, recompute counts, or pre-type a field the read did not name; analysis is a non-mutating view of the pinned `RecResponse` | yes |
| `absent-is-not-none` | ai-rec-decision-card | S | missing, unavailable, unrecognized, and not-applicable stay distinct closed-vocabulary members on the recomposed card | yes |
| `live-vs-static-isolation` | ai-rec-decision-card | S | live-tape/SSE status stays isolated from the static pinned read; analysis open/close sends no request and recomputes nothing | yes |
| `theme-token-discipline` | ai-rec-decision-card | S | Curvature Terminal tokens via `extrasFor(theme)`; no new palette role, font, or hex | yes |
| `single-motion-moment` | ai-rec-decision-card | S | no new orchestrated motion or keyframe family | yes |
| `additive-keeps-score-byte-identical` | ai-rec-decision-card | S | `NO_BACKEND_CHANGE`; no score, tier, gate, or fingerprint input | yes |
| `cited-code-is-verified-not-assumed` | rec-plan-scope-caption | PLAN | 2nd feature for the watch-list key. PLAN locked attachment against live `DecisionCard.tsx`: `DecisionMetadata` is a row `Stack` (`direction="row"`, `flexWrap: 'wrap'`, `data-testid="decision-metadata"`). Caption is a **sibling after** that node, never a child of the wrap flex (a `display:block` inside it becomes a seventh item). Placement asserts document order, not `within(decision-metadata)`. Cite `DecisionCard.tsx` / `copy.ts` / `AnalysisSurface.tsx`, not Python-era `AiRecPanel` line numbers | yes |
| `ai-asserted-numbers-are-traceable` | rec-plan-scope-caption | S | **3rd instance — the inference/halo half.** Plan fields stay outside the grounded set; a reader must not infer “checked” from a missing clause. Closed by one section-level caption on the pinned DecisionCard plan row (`PLAN_FIELDS_NOT_CHECKED`), not by extending `counts.checked` or adding per-field marks. Already canon; this instance completes the key’s three-part cover (asserted · omitted · inferred) | yes |
| `absent-is-not-none` | rec-plan-scope-caption | S | the caption is a scope-boundary constant, never a reserved absence literal (`—` / `not given` / `unavailable` / `unrecognized`). Field literals and the caption stay disjoint closed sets | yes |
| `digested-labels-not-raw-dump` | rec-plan-scope-caption | S | one section caption; no per-field marker/tint/clause; no browser re-label from scalars; plan labels continue from closed `PLAN_FIELD_LABEL` only | yes |
| `additive-keeps-score-byte-identical` | rec-plan-scope-caption | S | `NO_BACKEND_CHANGE`; empty `apps/api` and `libs/api` feature diffs vs `593f601`; score / tier / fingerprint cannot observe this caption | yes |
| `live-vs-static-isolation` | rec-plan-scope-caption | S | caption is static presentation of the pinned rec; SSE drop does not dim, blank, or remove it | yes |
| `theme-token-discipline` | rec-plan-scope-caption | S | quiet `text.secondary` caption; zero hex; no new palette role | yes |
| `single-motion-moment` | rec-plan-scope-caption | S | no new animation, keyframe, or motion prop | yes |
| `cited-code-is-verified-not-assumed` | rec-plan-scope-caption | S | ship confirms the PLAN lock: attachment was implemented against live `DecisionCard.tsx` (sibling after the row Stack), not against remembered `AiRecPanel` line numbers | yes |
| `secret-encrypted-at-rest` | ai-providers | C | BYO keys stay write-only / ciphertext-only; Grok OAuth spends the **user's subscription**, never a Convexa shared pool secret in the browser (D7) | yes |
| `server-side-gate-enforcement` | ai-providers | C | Ask-AI and key/OAuth/preference writes stay server-gated; no admin/shared free-uses path (D5) | yes |
| `secret-encrypted-at-rest` | ai-providers | S | QA live: four-slot BYO add/replace/remove never echoed the raw key; encrypt-before-store; decrypt-fail is `key_unusable`, not a leak | yes |
| `server-side-gate-enforcement` | ai-providers | S | Ask-AI / key / preference writes stay server-gated; `resolve_llm_key` never falls through to env/`shared_admin`; `ai_model:null` → 422 | yes |
| `additive-keeps-score-byte-identical` | ai-providers | S | QA live: score/tier/fingerprint `77\|actionable\|b799cc7aca96` identical across preference change; provider/model never scoring inputs | yes |
| `best-effort-isolated-or-null` | ai-providers | S | LLM/key/OAuth faults isolate to Ask-AI; bundle + SSE + score tiles intact; incomplete GET ai-key degrades Settings quietly | yes |
| `no-real-order-path` | ai-providers | S | powering is credential + model choice only; no broker or live-order path | yes |
| `theme-token-discipline` | ai-providers | S | Settings/Ask-AI chrome tokens only; warnings `warning.*`; zero new hex | yes |
| `single-motion-moment` | ai-providers | S | no new orchestrated motion or keyframe family | yes |
| `digested-labels-not-raw-dump` | ai-providers | S | closed BYO labels + `your Grok subscription`; FE never infers a provider from the pasted key string | yes |
| `absent-is-not-none` | ai-providers | S | `no_key` / `key_unusable` / `key_rejected` / `model_not_in_catalog` stay distinct; oauth/subscription reasons stay open/blocked-on, not collapsed into no-key | yes |
| `ai-asserted-numbers-are-traceable` | ai-providers | S | provenance names path/provider/model from the resolved call; omitted fields omit the chip (never invent `default`); does not claim a check the rec did not run | yes |
| `cited-code-is-verified-not-assumed` | ai-providers | S | BRIEF/SPEC cited live `llm.rs` / `auth.rs` / `recommendation.rs` / `AiKeySection.tsx`, not Python `ai_recommendation.py`; OAuth arm present-but-unavailable rather than invented endpoints | yes |
| `user-subscription-not-operator-pool` | ai-providers | S | **NEW KEY (1st instance — D7).** A trader-facing subscription/OAuth arm spends the **user's own** vendor subscription (here SuperGrok / Grok). Never a Convexa-billed shared pool, never env `XAI_API_KEY` as product spend, never copy "Convexa Grok pool" / free / unvouched cheaper / included. BYO `xai` key stays a distinct path. *binding:yes — a future "sign in with vendor X" feature violates it by metering Convexa's key as the product.* | yes |
| `operator-vs-trader-path-separation` | chain-snapshot-capture | I | paid-feed capture is research/operator; never a trader-route surface; a stored-blob read must not trigger a vendor fetch | yes |
| `cited-code-is-verified-not-assumed` | chain-snapshot-capture | I | live `scan_bundles` is latest-wins `ON CONFLICT (symbol)` — not a history; do not treat it as already this feature. Cite `live.rs` / `massive/rest.rs` / `scan_structure_history`, not Python `scanstore` | yes |
| `operator-vs-trader-path-separation` | chain-snapshot-capture | S | QA: `/api/_research/*` 404 on trader origin like `_metrics`; no trader chrome; list/load `vendor_called=false`; stored books never a trader feed | yes |
| `cited-code-is-verified-not-assumed` | chain-snapshot-capture | S | hooks only `load_or_compute` + `load_analytics`; `compute_analytics` / warmer excluded; new `ChainSnapshotStore` not `scan_bundles`; `as_of` TEXT not timestamptz | yes |
| `best-effort-isolated-or-null` | chain-snapshot-capture | S | capture write failure leaves desk up; no invented row; storage-not-configured is `capture not storing` | yes |
| `additive-keeps-score-byte-identical` | chain-snapshot-capture | S | blobs never a scoring input; QA score/tier/fingerprint identity holds capture on vs fail | yes |
| `no-secrets-in-image` | chain-snapshot-capture | S | stored snapshot material contains no API keys; serialize boundary before persist | yes |
| `absent-is-not-none` | chain-snapshot-capture | S | list miss `detail` is exact `no stored snapshot for <SYMBOL>`; not an empty chain book; not a vendor fill-in | yes |
| `score-change-is-deliberate-and-measured` | batch-backtest-cli | I | a replay report does not authorize a live score/weight/gate change; measurement only | yes |
| `operator-vs-trader-path-separation` | batch-backtest-cli | I | P3 is research CLI; zero Massive on replay; never a trader route or live-score write | yes |
| `score-change-is-deliberate-and-measured` | batch-backtest-cli | S | QA: report standing block **Authorizes: nothing**; replay does not write live score/tier/fingerprint | yes |
| `operator-vs-trader-path-separation` | batch-backtest-cli | S | CLI-only; structural dashboard scan 12/12; zero Massive on replay; no trader route | yes |
| `additive-keeps-score-byte-identical` | batch-backtest-cli | S | measurement-only; live scoring path untouched | yes |
| `absent-is-not-none` | batch-backtest-cli | S | empty_corpus ≠ miss ≠ empty_book ≠ unreadable; no quotable artifact on empty corpus | yes |
| `cited-code-is-verified-not-assumed` | batch-backtest-cli | S | opens json/pg for read; never `Disabled` / serve opener; Path-B via `compute_analytics_from_vendor` | yes |
| `score-change-is-deliberate-and-measured` | replay-outcome-join | I | joining labels to replayed scores is measurement only; does not authorize a live score change | yes |
| `operator-vs-trader-path-separation` | replay-outcome-join | I | research CLI/report only; Options snapshot API must stay at zero; no trader UI | yes |
| `score-change-is-deliberate-and-measured` | replay-outcome-join | S | QA: standing Authorizes: nothing; join report does not write live score/tier/fingerprint | yes |
| `operator-vs-trader-path-separation` | replay-outcome-join | S | CLI-only; F1 14/14; Options API 0; no trader route or `_research` join HTTP | yes |
| `additive-keeps-score-byte-identical` | replay-outcome-join | S | measurement-only; live scoring path untouched after a successful join | yes |
| `absent-is-not-none` | replay-outcome-join | S | no_snapshot ≠ empty_book ≠ no_label ≠ no_p0 ≠ unreadable ≠ compute_failed; missing `display_spot` is first-class `no_p0` | yes |
| `best-effort-isolated-or-null` | replay-outcome-join | S | degraded rows isolate; run continues; Stocks-fill fail stays no_label, never Options fallback | yes |
| `cited-code-is-verified-not-assumed` | replay-outcome-join | S | live Rust: `cmd_join_outcomes` / `cmd_batch_backtest` / `cmd_score_lab` / `ReplayedMeasurement`; `--replay` is the producer wrapper `rows[]` | yes |
| `model-read-carries-its-assumptions` | replay-outcome-join | S | every printed rate carries horizon, `n_paired`, `n_sessions`, window, label rule/`label_version`, locked `p0` = capture-time underlying | yes |
| `structural-over-prose-enforcement` | replay-outcome-join | S | F1 mutation-tested scan (poison then restore); CLI disposition enum not prose | yes |
| `operator-vs-trader-path-separation` | session-chain-archive | I | session archive is research; prune-proof copy must not sit on the trader request path or trigger a vendor fetch on read | yes |
| `cited-code-is-verified-not-assumed` | session-chain-archive | I | cite live `chain_snapshot/{capture,store,pg_chain_snapshot}.rs` + `config.rs` 48/14d defaults; do not treat `scan_bundles` or Python `scanstore` as this store | yes |
| `operator-vs-trader-path-separation` | session-chain-archive | S | QA: `/api/_research/session-books` 404 on Pages trader origin; no trader chrome; list/load `vendor_called=false`; `authorizes: nothing` | yes |
| `cited-code-is-verified-not-assumed` | session-chain-archive | S | sibling `session_chain_archive/` not a ring flag; ET `et_date` not UTC `session_date_from_ns`; ring miss string stays live `no stored snapshot for <SYMBOL>` | yes |
| `best-effort-isolated-or-null` | session-chain-archive | S | archive write failure leaves desk up; disabled is `session archive not storing`, not a trader error | yes |
| `additive-keeps-score-byte-identical` | session-chain-archive | S | blobs never a scoring input; QA score/tier/fingerprint identity holds archive on vs fail | yes |
| `no-secrets-in-image` | session-chain-archive | S | stored session material contains no API keys | yes |
| `absent-is-not-none` | session-chain-archive | S | `no session book` ≠ ring miss ≠ not-storing ≠ unreadable; QQQ miss stayed honest | yes |
| `structural-over-prose-enforcement` | session-chain-archive | S | poison 48-ring prune still loads session identity; AC-15 dashboard structural empty-diff | yes |

> **GATE S tally — session-chain-archive (2026-08-20).** **NO new graduations.** Honored already-promoted
> keys (`operator-vs-trader-path-separation` · `cited-code-is-verified-not-assumed` ·
> `best-effort-isolated-or-null` · `additive-keeps-score-byte-identical` · `no-secrets-in-image` ·
> `absent-is-not-none` · `structural-over-prose-enforcement`). Conformance JSON promoted to
> `state/conformance/session-chain-archive.json`. Program `keep-paid-books` #2 unblocked.
| `operator-vs-trader-path-separation` | liquid-names-session-capture | I | ensure-session for SPY/QQQ/IWM is off the trader request path; research reads stay zero-Massive | yes |
| `cited-code-is-verified-not-assumed` | liquid-names-session-capture | I | cite live `analytics.rs` cache-hit skip of `spawn_capture` and `session_chain_archive/`; warmer stays excluded | yes |
| `operator-vs-trader-path-separation` | liquid-names-session-capture | S | QA: ensure off trader request path; research list/load `vendor_called=false`; Pages `_research` 404; no trader chrome | yes |
| `cited-code-is-verified-not-assumed` | liquid-names-session-capture | S | live hole remains `load_or_compute` cache-hit; ensure leaf awaits `capture_into`; warmer still drops `_vendor` | yes |
| `best-effort-isolated-or-null` | liquid-names-session-capture | S | desk ticker 200 while ensure is off-path; store-off is `session archive not storing` | yes |
| `additive-keeps-score-byte-identical` | liquid-names-session-capture | S | isolation pin; blobs never scoring inputs | yes |
| `absent-is-not-none` | liquid-names-session-capture | S | miss stays `no session book`; four classes; no fifth pending class | yes |
| `single-ticker-on-demand` | liquid-names-session-capture | S | request path still one ticker; multi-name ensure is off-path worker | yes |

> **GATE S tally — liquid-names-session-capture (2026-08-20).** **NO new graduations.** Honored already-promoted keys. Conformance re-pin `state/conformance/liquid-names-session-capture.json`. Program #3 join-smoke unblocked.
| `operator-vs-trader-path-separation` | chain-archive-object-store | S | research list/load zero Massive; BODY_ROOT I/O off trader path; Pages `_research` 404 | yes |
| `absent-is-not-none` | chain-archive-object-store | S | missing object = `session book unreadable`; unset BODY_ROOT = `session archive not storing` | yes |
| `no-secrets-in-image` | chain-archive-object-store | S | body files contain no API keys; dial is env path | yes |
| `cited-code-is-verified-not-assumed` | chain-archive-object-store | S | unique-per-put locator; v12 drops BYTEA; ring store Non-move | yes |
| `production-fails-closed` | production-runtime-guardrails | I | **NEW KEY (1st instance).** `APP_ENV=prod` is a hard runtime profile: missing durable persistence, stable cryptographic keys, protected operator metrics, explicit origin policy, or secure cookie settings prevents readiness; development/test fallbacks remain explicit non-production behavior. | yes |
| `secret-encrypted-at-rest` | production-runtime-guardrails | I | stored AI credentials must survive planned encryption-key rotation without plaintext persistence or browser exposure | yes |
| `structural-over-prose-enforcement` | production-runtime-guardrails | I | unsafe production configuration is rejected by typed startup validation and tests, not deployment documentation alone | yes |
| `production-fails-closed` | production-runtime-guardrails | C | production validation is a typed pre-bind boundary; explicit mode, Postgres/current schema, archive-root probe, metrics token, exact HTTPS origins, first-party cookies, and stable key rings are readiness prerequisites | yes |
| `secret-encrypted-at-rest` | production-runtime-guardrails | C | versioned AES-GCM envelopes write with one active key and read only the addressed retired/legacy key; missing historical material degrades to no usable credential without overwriting ciphertext | yes |
| `no-secrets-in-image` | production-runtime-guardrails | C | key rings, database URL, origin policy, and metrics token remain runtime-injected; diagnostics and receipts carry names/ids/classes only, never configured values | yes |
| `operator-vs-trader-path-separation` | production-runtime-guardrails | C | startup validation and authenticated metrics remain outside trader routes; no dashboard surface, vendor fetch, bundle/SSE mutation, or scoring input is introduced | yes |
| `production-fails-closed` | postgres-release-safety | I | release migration ownership is explicit; production startup may verify an already-current PostgreSQL schema but may not mutate it or bind while it is absent, behind, divergent, future, unusable, or unverifiable | yes |
| `no-secrets-in-image` | postgres-release-safety | I | the migration command ships in the existing image but receives DATABASE_URL only at runtime and may emit only allowlisted, secret-free operational evidence | yes |
| `cited-code-is-verified-not-assumed` | postgres-release-safety | I | live migrations.rs, Pg::connect_strict, server startup order, CI Postgres service, and railway.json were read at source; unverified Railway pre-start semantics remain a lane-check | yes |
| `structural-over-prose-enforcement` | postgres-release-safety | C | a dedicated writer module and mutation-tested dependency guard exclude migration writes from server/state/worker construction; one transaction makes each version's DDL and ledger row atomic | yes |
| `production-fails-closed` | postgres-release-safety | C | production serve performs only bounded read-only history/probe verification and exits before listener/workers for every non-current or unverifiable schema state | yes |
| `no-secrets-in-image` | postgres-release-safety | C | command stdout is a closed JSONL schema and receipts reject secret-shaped fields; raw SQL, driver text, URLs, credentials, bound values, and arbitrary environment values are forbidden | yes |
| `cited-code-is-verified-not-assumed` | postgres-release-safety | C | the contract names verified Rust and CI paths while requiring current host authority before asserting any Railway migration-before-start mechanism | yes |
| `production-fails-closed` | postgres-release-safety | S | QA proved production refuses missing, partial, future, divergent, unreachable, and unverifiable PostgreSQL schemas before workers/listener; the live Railway release ran the serialized migration command first, then bound one healthy replica | yes |
| `structural-over-prose-enforcement` | postgres-release-safety | S | mutation-tested module/dependency guards keep migration writes out of serve/state/worker construction; the canonical image path and standard Nx serve target are build-breaking structural oracles | yes |
| `no-secrets-in-image` | postgres-release-safety | S | the non-root image carries one executable and no database credential; Railway injects DATABASE_URL at runtime, while closed logs and receipts reject secret-shaped fields and values | yes |
| `cited-code-is-verified-not-assumed` | postgres-release-safety | S | GATE S directly observed Railway deployment 377e7c0f-9b99-4dc9-ae01-0fc36610644a at exact SHA 4267be12a609a94c95a9760c51f443389abacd32, config attribution, terminal equality, SUCCESS, and health 200 | yes |

> **GATE S tally — postgres-release-safety (2026-08-22).** `production-fails-closed`
> **GRADUATED** at 2 binding features (`production-runtime-guardrails` +
> `postgres-release-safety`). Its single-source prose is now in PROJECT_CONTEXT §5 with the locked
> OPEN_THREADS §9 pointer. All other keys logged by this feature were already promoted canon.
> Conformance JSON promoted to `state/conformance/postgres-release-safety.json`.

| `production-fails-closed` | chain-snapshot-local-store | I | production snapshot capture selects the filesystem explicitly, requires exact `/data/chain_snapshots`, and proves write/sync/readback durability before workers or listener; no Postgres or ephemeral fallback | yes |
| `best-effort-isolated-or-null` | chain-snapshot-local-store | I | runtime filesystem capture/prune failure remains outside trader/scanner response paths and cannot change score, tier, fingerprint, or SSE behavior | yes |
| `no-secrets-in-image` | chain-snapshot-local-store | I | backend and root are runtime configuration; files, diagnostics, and export receipts exclude credentials, database URLs, API keys, and captured bodies | yes |
| `operator-vs-trader-path-separation` | chain-snapshot-local-store | I | filesystem list/load preserves the existing operator research routes, makes zero vendor calls, and adds no trader surface | yes |
| `structural-over-prose-enforcement` | chain-snapshot-local-store | I | a closed backend enum, production startup validation, immutable publish rules, and read-only export tests enforce the cutover mechanically | yes |
| `production-fails-closed` | chain-snapshot-local-store | S | hosted startup refused a root-owned snapshot directory before listener/workers; after UID 10001 ownership and a real flush/readback probe, the same pinned image started with exact `/data/chain_snapshots` | yes |
| `best-effort-isolated-or-null` | chain-snapshot-local-store | S | QA forced append/prune faults without changing bundle success, scanner continuation, SSE, score, tier, or fingerprint; hosted capture remained isolated on the filesystem | yes |
| `no-secrets-in-image` | chain-snapshot-local-store | S | the non-root pinned image received selector/path/database credentials only at runtime; receipts and diagnostics retained only closed counts, timestamps, ids, and result classes | yes |
| `operator-vs-trader-path-separation` | chain-snapshot-local-store | S | independent conformance passed all four research list/load arms with zero Massive calls and no dashboard/runtime interface change | yes |
| `structural-over-prose-enforcement` | chain-snapshot-local-store | S | closed selector, exact-path validation, no-clobber immutable publish, mutation-tested read-only export, and pre-bind durability probe made the unsafe transition fail visibly | yes |

> **GATE S tally — chain-snapshot-local-store (2026-08-24).** **NO new graduations.** All five
> binding keys were already promoted canon. Conformance JSON promoted to
> `state/conformance/chain-snapshot-local-store.json`. Hosted QA passed 14/14 after filesystem growth
> and a fixed Postgres watermark were observed independently; legacy rows remain intact pending a
> separately authorized reclamation.

> **GATE S tally — chain-archive-object-store (2026-08-20).** **NO new graduations.** Conformance
> `state/conformance/chain-archive-object-store.json`. Keep-paid-books builds complete; #5 clock running.

> **GATE S tally — batch-backtest-cli (2026-08-18).** **NO new graduations.** Honored already-promoted
> keys (`score-change-is-deliberate-and-measured` · `operator-vs-trader-path-separation` ·
> `additive-keeps-score-byte-identical` · `absent-is-not-none` · `cited-code-is-verified-not-assumed`).
> Conformance re-pin promoted to `state/conformance/batch-backtest-cli.json`.

> **GATE S tally — chain-snapshot-capture (2026-08-18).** **NO new graduations.** Honored keys already
> promoted (`operator-vs-trader-path-separation` · `cited-code-is-verified-not-assumed` ·
> `best-effort-isolated-or-null` · `additive-keeps-score-byte-identical` · `no-secrets-in-image` ·
> `absent-is-not-none`). Conformance JSON promoted to `state/conformance/chain-snapshot-capture.json`.
> P3 batch-backtest CLI is now unblocked (was blocked-on durable capture).

| `structural-over-prose-enforcement` | openapi-router-dependency-replacement | S | one repository-owned graph pairs runtime handlers with utoipa metadata; 52/181/87 mutations and forbidden-package reintroduction fail the normal gate | yes |
| `cited-code-is-verified-not-assumed` | openapi-router-dependency-replacement | S | pre-edit source/artifact hashes and the compiled 52-route receipt bind replacement claims to observed repository bytes | yes |
| `absent-is-not-none` | openapi-router-dependency-replacement | S | generated-client compatibility preserves missing/null/empty/zero/false distinctions without changing dashboard runtime source | yes |

> **GATE S tally — openapi-router-dependency-replacement (2026-08-23).** **NO new graduations.**
> Honored already-promoted keys (`structural-over-prose-enforcement` ·
> `cited-code-is-verified-not-assumed` · `absent-is-not-none`). Conformance JSON promoted to
> `state/conformance/openapi-router-dependency-replacement.json`.

| `structural-over-prose-enforcement` | browser-quality-gates | S | inventory equality, exact-file D7/D8 isolation (no directory prefix), mutation/poison probes, and receipt-bound visual authority make the quality promise build-breaking rather than documented | yes |
| `theme-token-discipline` | browser-quality-gates | S | D7/D8 contrast repairs consume existing local theme slots; no hardcoded hex, no token-table or global-palette amendment; baselines are not a second token authority | yes |
| `cited-code-is-verified-not-assumed` | browser-quality-gates | S | D7/D8 selectors, oracles, and cold-error copy were locked against live rendered nodes; a selector drift is GATE Z, not permission to weaken the matrix | yes |
| `single-motion-moment` | browser-quality-gates | S | quality gates and D7/D8 repairs add no animation family; visual baselines cannot introduce or amend motion; reduced-motion remains the existing shared path | yes |
| `absent-is-not-none` | browser-quality-gates | S | hosted-runner browser evidence is the closed `NOT RUN` line, never collapsed into local PASS; axe moderate/minor stays in the summary without pretending to be a clean audit | yes |
| `engine-claim-matches-executable-engines` | browser-quality-gates | S | **NEW KEY (1st instance).** Supported-browser promise = locked Playwright Chromium (52) + Firefox/WebKit (5 journeys). Browserslist is emitted-code intent. No branded-browser / all-version / OS / AT certification | yes |
| `visual-baseline-requires-human-authority` | browser-quality-gates | S | **NEW KEY (1st instance).** Visual update cannot write candidates without a valid authorization receipt; merge requires a separate acceptance receipt; workers never author either | yes |
| `local-evidence-is-not-hosted-evidence` | browser-quality-gates | S | **NEW KEY (1st instance).** While hosted runners/billing are unavailable, completion copy is the exact §4 `NOT RUN` hosted line; local results do not count as hosted evidence | yes |

> **GATE S tally — browser-quality-gates (2026-08-28).** **NO new graduations.** Mechanical
> `ledger_tally`: three new keys stay at 1 binding (`engine-claim-matches-executable-engines` ·
> `visual-baseline-requires-human-authority` · `local-evidence-is-not-hosted-evidence`). Already-
> promoted keys gained instances (`structural-over-prose-enforcement` · `theme-token-discipline` ·
> `cited-code-is-verified-not-assumed` · `single-motion-moment` · `absent-is-not-none`).
> `NO_BACKEND_CHANGE` — no conformance JSON promoted.

| `additive-keeps-score-byte-identical` | capacity-baseline | S | after successful load and soak, score/tier/fingerprint match the Path-B oracle on the golden book; skip is a fail; the triple is not a p95 lock | yes |
| `operator-vs-trader-path-separation` | capacity-baseline | S | harness is CLI-only; no trader route, nav, Settings, or `/_ops` capacity surface; receipts are not trader-visible | yes |
| `structural-over-prose-enforcement` | capacity-baseline | S | isolation poisons (debug CI load, missing APP_ENV, HubCmd queue growth, empty corpus, identity skip) fail the suite rather than relying on a comment | yes |
| `cited-code-is-verified-not-assumed` | capacity-baseline | S | LiveCapacity `>= max`, production subscribe enqueue, `for_tests` wrong constructor, gex_SPY contract_count 14218 were read at source | yes |
| `production-fails-closed` | capacity-baseline | S | APP_ENV=prod + fixture Some refuses; missing APP_ENV on a production construct refuses; harness does not fall back to paid Massive | yes |
| `no-secrets-in-image` | capacity-baseline | S | dummy key only; receipts/logs scanned so MASSIVE_API_KEY values and apikey= fragments cannot appear | yes |
| `local-evidence-is-not-hosted-evidence` | capacity-baseline | S | **2nd instance.** Evidence `local` vs `ci` are separate axes; load `[NOT RUN] soak`; a ci load is not soak evidence; debug local is not merge-CI evidence | yes |
| `harness-p95-is-not-slo` | capacity-baseline | S | **NEW KEY (1st instance).** D1 150/4000/200/500 ms are mocked-path regression gates, not production SLOs, not permission to raise 500/50/120 | yes |

> **GATE S tally — capacity-baseline (2026-08-29).** **`local-evidence-is-not-hosted-evidence` GRADUATES**
> (2 features, all binding — mechanical `ledger_tally`). New watch-list key `harness-p95-is-not-slo`
> (1 binding). Already-promoted keys gained instances (`additive-keeps-score-byte-identical` ·
> `operator-vs-trader-path-separation` · `structural-over-prose-enforcement` ·
> `cited-code-is-verified-not-assumed` · `production-fails-closed` · `no-secrets-in-image`).
> `NO_BACKEND_CHANGE` of production HTTP — no conformance JSON promoted.

| `operator-vs-trader-path-separation` | archive-coverage-guardrails | I | coverage is operator/research; unlinked from trader UI; zero Massive on a coverage read; Pages `_research` 404 | yes |
| `cited-code-is-verified-not-assumed` | archive-coverage-guardrails | I | cite live `session_chain_archive/{store,ensure}.rs`, `research_session_books.rs`, `ENSURE_SYMBOLS`; not Python and not the 26 Aug audit prose as an oracle | yes |
| `operator-vs-trader-path-separation` | archive-coverage-guardrails | S | QA: sibling `_research` coverage; Pages `_research`/`_metrics` 404; no trader chrome; `vendor_called=false`; never writes/ensure | yes |
| `cited-code-is-verified-not-assumed` | archive-coverage-guardrails | S | derive leaf `coverage.rs` + `Commands::ArchiveCoverage`; list/load + `deserialize_capture`; exhaustive `MarketDataSourceKind`; seed excluded | yes |
| `best-effort-isolated-or-null` | archive-coverage-guardrails | S | coverage/warning/audit failure leaves bundle, scan, SSE, and ensure succeeding | yes |
| `additive-keeps-score-byte-identical` | archive-coverage-guardrails | S | coverage never a scoring input; score/tier/fingerprint identity holds derive success vs fail | yes |
| `absent-is-not-none` | archive-coverage-guardrails | S | `present` ≠ `missing` ≠ `unreadable` ≠ `not yet due` ≠ `blocked occupancy` ≠ store-disabled ERROR ≠ weekend `[NOT DUE]` | yes |
| `structural-over-prose-enforcement` | archive-coverage-guardrails | S | planted missing/unreadable/fixture occupant fail the audit by construction; exhaustive source match so a new kind cannot silently become Present | yes |
| `local-evidence-is-not-hosted-evidence` | archive-coverage-guardrails | S | CLI standing `Evidence: local` and `local audit is not production coverage`; a local receipt is not hosted/CI | yes |
| `no-secrets-in-image` | archive-coverage-guardrails | S | canary secret values do not appear in matrix, warning, or audit output | yes |
| `present-is-live-paid-only` | archive-coverage-guardrails | S | **NEW KEY (1st instance).** `present` = loadable `LiveMassive` body; fixture/reconstructed/flat-file/seed never present and never inserted as LiveMassive; occupant is `blocked occupancy` | yes |

> **GATE S tally — archive-coverage-guardrails (2026-08-29).** **NO new graduations.** Mechanical
> `ledger_tally`: new watch-list key `present-is-live-paid-only` (1 binding). Already-promoted keys
> gained instances (`operator-vs-trader-path-separation` · `cited-code-is-verified-not-assumed` ·
> `best-effort-isolated-or-null` · `additive-keeps-score-byte-identical` · `absent-is-not-none` ·
> `structural-over-prose-enforcement` · `local-evidence-is-not-hosted-evidence` ·
> `no-secrets-in-image`). Conformance JSON promoted to
> `state/conformance/archive-coverage-guardrails.json`.

| `operator-vs-trader-path-separation` | session-day-tape-capture | I | tape is research; trader SSE unchanged; a tape read must not trigger a vendor fetch or rewrite live price cache | yes |
| `cited-code-is-verified-not-assumed` | session-day-tape-capture | I | cite live `StockStreamHub` / `price_stream.rs` / `refresh_analytics` drop `_vendor` / `spawn_capture` hooks / `ENSURE_SYMBOLS`; do not treat session archive or Fixture as already this tape | yes |
| `present-is-live-paid-only` | session-day-tape-capture | I | tape snapshots never insert as `LiveMassive` session books; occupancy stays a distinct class | yes |
| `operator-vs-trader-path-separation` | session-day-tape-capture | S | QA: sibling `_research` tape list/load; Pages `_research` 404; no trader chrome; `vendor_called=false`; recv never awaits disk | yes |
| `cited-code-is-verified-not-assumed` | session-day-tape-capture | S | live `StockStreamHub.subscribe_events`, `refresh_analytics` keep `_vendor` for tape only, no `spawn_capture` on warmer | yes |
| `best-effort-isolated-or-null` | session-day-tape-capture | S | missing tape root and persist fault leave bundle, scan, SSE, and ensure succeeding | yes |
| `additive-keeps-score-byte-identical` | session-day-tape-capture | S | tape never a scoring input; score/tier/fingerprint identity holds tape on vs fail | yes |
| `live-vs-static-isolation` | session-day-tape-capture | S | Path-A sidecar never dims or blanks live ticks; overflow is a gap record, not a stalled SSE | yes |
| `absent-is-not-none` | session-day-tape-capture | S | no-ticks ≠ not-storing ≠ unreadable ≠ coverage missing ≠ not-elapsed; GATE Z residual: no pre-store class | yes |
| `structural-over-prose-enforcement` | session-day-tape-capture | S | poison: warmer still no `spawn_capture`; tape never `insert_if_absent` as LiveMassive; no watermark plant | yes |
| `local-evidence-is-not-hosted-evidence` | session-day-tape-capture | S | CLI `Evidence: local`; local audit is not production coverage | yes |
| `no-secrets-in-image` | session-day-tape-capture | S | canary secret values do not appear in tape list/load or CLI | yes |
| `present-is-live-paid-only` | session-day-tape-capture | S | **2nd instance.** Path-B persist drops `MarketDataSourceKind`; operator print never `live_massive`; tape never occupies session archive as present | yes |
| `single-ticker-on-demand` | session-day-tape-capture | S | capture is off the trader request path; request path still one ticker | yes |

> **GATE S tally — session-day-tape-capture (2026-08-30).** **`present-is-live-paid-only` GRADUATES**
> (2 features, all binding — mechanical `ledger_tally`; pre-indexed in Promoted canon this ship).
> **`single-ticker-on-demand` GRADUATES** (2 features, all binding — liquid-names-session-capture +
> this tape; long-standing §5 narrowing, formal key this ship). Already-promoted keys gained
> instances (`operator-vs-trader-path-separation` · `cited-code-is-verified-not-assumed` ·
> `best-effort-isolated-or-null` · `additive-keeps-score-byte-identical` ·
> `live-vs-static-isolation` · `absent-is-not-none` · `structural-over-prose-enforcement` ·
> `local-evidence-is-not-hosted-evidence` · `no-secrets-in-image`). Conformance JSON promoted to
> `state/conformance/session-day-tape-capture.json`. GATE Z AC-32 residual: no pre-store class.

| `present-is-live-paid-only` | day-replay-mock-adapter | I | replayed tape is never a `LiveMassive` session book and never labeled live Massive | yes |
| `cited-code-is-verified-not-assumed` | day-replay-mock-adapter | I | cite live tape list/load, `MarketDataPort::Fixture` (frozen as_of, not a clock), `StockStreamHub` publish_event; do not treat Fixture or batch-backtest as already this replay | yes |
| `production-fails-closed` | day-replay-mock-adapter | I | production construct does not silently become replay when the replay arm is unset | yes |
| `present-is-live-paid-only` | day-replay-mock-adapter | S | **3rd instance.** Armed walk never inserts session-archive as LiveMassive; occupancy `live: false`; coverage cell stays missing | yes |
| `cited-code-is-verified-not-assumed` | day-replay-mock-adapter | S | live tape list/load, Fixture frozen as_of not a clock, hub `publish_event`, `ReplayHold` before cache; not batch-backtest | yes |
| `production-fails-closed` | day-replay-mock-adapter | S | `APP_ENV=prod` + replay arm refuses before bind; unset production still Live Massive | yes |
| `operator-vs-trader-path-separation` | day-replay-mock-adapter | S | existing ticker SSE with honest not-live occupancy; Pages `_research` 404; no `/_ops/replay`; arming not trader cookie | yes |
| `live-vs-static-isolation` | day-replay-mock-adapter | S | drop/end/fault distinguishable from live-offline; last tape values kept; drop chip not reconnect | yes |
| `best-effort-isolated-or-null` | day-replay-mock-adapter | S | clock/tape-read fault leaves bundle/scan/unrelated succeeding; standing replay-fault | yes |
| `additive-keeps-score-byte-identical` | day-replay-mock-adapter | S | score/tier/fingerprint byte-identical replay vs live formula; unset arm identity with pre-feature; Authorizes: nothing | yes |
| `absent-is-not-none` | day-replay-mock-adapter | S | missing ≠ empty ≠ unreadable ≠ not-storing ≠ ended ≠ drop ≠ fault ≠ live-offline; miss refuses before bind | yes |
| `structural-over-prose-enforcement` | day-replay-mock-adapter | S | poison: session-tape + live:true live chrome; insert_if_absent LiveMassive; production Live when unset | yes |
| `local-evidence-is-not-hosted-evidence` | day-replay-mock-adapter | S | GATE Q `NOTE: VISUAL_EVIDENCE_UNAVAILABLE`; local receipts are not hosted/CI | yes |
| `no-secrets-in-image` | day-replay-mock-adapter | S | canary secret values do not appear in walk output or ticker SSE payloads | yes |
| `single-ticker-on-demand` | day-replay-mock-adapter | S | armed process one ticker; other route symbols do not start Massive or a second tape | yes |

> **GATE S tally — day-replay-mock-adapter (2026-08-30).** **NO new graduations.** Mechanical
> `ledger_tally`: 9 unpromoted watch keys remain at 1 feature each. Already-promoted keys gained
> instances (`present-is-live-paid-only` 3rd · `cited-code-is-verified-not-assumed` ·
> `production-fails-closed` · `operator-vs-trader-path-separation` · `live-vs-static-isolation` ·
> `best-effort-isolated-or-null` · `additive-keeps-score-byte-identical` · `absent-is-not-none` ·
> `structural-over-prose-enforcement` · `local-evidence-is-not-hosted-evidence` ·
> `no-secrets-in-image` · `single-ticker-on-demand`). Conformance JSON promoted to
> `state/conformance/day-replay-mock-adapter.json`.

| `present-is-live-paid-only` | massive-flat-file-keep | I | reconstructed S3 files never insert as `LiveMassive` / coverage `present` | yes |
| `cited-code-is-verified-not-assumed` | massive-flat-file-keep | I | cite live `infrastructure/massive/{rest,ws}.rs` (no files client), `MASSIVE_API_KEY` + REST base, `fetch_recent_trades` `/v3/trades`, `MarketDataSourceKind` {LiveMassive, Fixture, SessionTape}, `tape_root_conflicts`, `TAPE_WATCHLIST`/`ENSURE_SYMBOLS`; vendor files endpoint `files.massive.com` is docs not in-repo; do not treat REST trades or day_tape as already this keep | yes |
| `production-fails-closed` | massive-flat-file-keep | I | armed download with missing S3 keys or unwritable root refuses; production unset does not fetch files | yes |
| `operator-vs-trader-path-separation` | massive-flat-file-keep | I | CLI + `_research`; Pages still 404; no ticker player chrome | yes |
| `present-is-live-paid-only` | massive-flat-file-keep | S | **4th instance.** Extract corpus never `insert_if_absent` / never `LiveMassive` / never coverage `present`; occupancy word is `kept` | yes |
| `cited-code-is-verified-not-assumed` | massive-flat-file-keep | S | files client is sibling of REST (SigV4 + files pair), not `fetch_recent_trades`; `MarketDataSourceKind` stays three arms | yes |
| `production-fails-closed` | massive-flat-file-keep | S | armed keep with missing files pair or unwritable root refuses; production unset does not fetch files; keep root is **not** a serve-bind prerequisite | yes |
| `operator-vs-trader-path-separation` | massive-flat-file-keep | S | clap `flat-files` + `_research/flat-files`; Pages still 404; `NO_UI_CHANGE`; token is metrics token not trader cookie | yes |
| `additive-keeps-score-byte-identical` | massive-flat-file-keep | S | `authorizes: nothing`; score/tier/fingerprint byte-identical construct on vs off and succeed vs fail | yes |
| `best-effort-isolated-or-null` | massive-flat-file-keep | S | keep fault never 5xxs bundle / scan / SSE / ensure; serve still binds on not-storing / refuse-to-mix | yes |
| `absent-is-not-none` | massive-flat-file-keep | S | miss ≠ empty extract ≠ no stored extract ≠ not-elapsed ≠ unreadable ≠ not-storing; never miss beside a sibling keep for the same `(D, class)` | yes |
| `structural-over-prose-enforcement` | massive-flat-file-keep | S | isolation poison: no `aws-sdk`, no `MASSIVE_API_KEY` on files client, no `insert_if_absent`, miss-beside-keep, dashboard needles | yes |
| `local-evidence-is-not-hosted-evidence` | massive-flat-file-keep | S | CLI `Evidence: local`; GATE Q `NOTE: VISUAL_EVIDENCE_UNAVAILABLE`; local keep is not hosted coverage | yes |
| `no-secrets-in-image` | massive-flat-file-keep | S | files pair is env-only; canary REST/files values absent from list/load/CLI | yes |
| `credential-class-isolation` | massive-flat-file-keep | S | **NEW KEY (1st instance).** Files access/secret is never the live REST apiKey; classify before GET; wrong-class prints REST clause, missing pair does not | yes |
| `operator-vs-trader-path-separation` | research-lab-surface | I | operator corpus browser is URL-only off-shell unlinked; not `/lab` instrument demos; Pages `_research` 404 stands; metrics token not trader cookie | yes |
| `present-is-live-paid-only` | research-lab-surface | I | UI must not label extracts / tape / fixtures as live paid `present` | yes |
| `cited-code-is-verified-not-assumed` | research-lab-surface | I | cite live `app.tsx` `/_ops/metrics`, `LabIndex.tsx` instrument demos, `functions/api/[[path]].ts` 404, existing `research_session_books.rs` et al.; do not treat `/lab` as this surface | yes |
| `server-side-gate-enforcement` | research-lab-surface | I | research list/load stays token-gated; trader session cookie is not the gate | yes |
| `operator-vs-trader-path-separation` | research-lab-surface | C | v1 is `/_ops/research` off-shell unlinked not `/lab`; sitting research base rejects `*.pages.dev`; Pages `_research` 404 stands | yes |
| `present-is-live-paid-only` | research-lab-surface | C | coverage `present` = loadable LiveMassive only; books table never `present`/`kept`; do not mint coverage from list `source` | yes |
| `server-side-gate-enforcement` | research-lab-surface | C | metrics token is the gate; page fetches `credentials:'omit'`; cookie-only 401 is a non-page GATE Q probe | yes |
| `absent-is-not-none` | research-lab-surface | C | cors-fault ≠ classified occupancy-500 ≠ coverage-unavailable ≠ list stale keep-last; occupancy-500 hides concurrent load digest | yes |
| `no-secrets-in-image` | research-lab-surface | C | sitting origin + metrics token in tab memory only; never sessionStorage / localStorage / query | yes |
| `structural-over-prose-enforcement` | research-lab-surface | C | empty `apps/api` product diff; path-scan allowlist + anti-vacuity; no relative `/api/_research` | yes |
| `additive-keeps-score-byte-identical` | research-lab-surface | C | successful envelopes `authorizes: nothing`; `vendor_called` true or other authorizes → invariant-fault | yes |
| `local-evidence-is-not-hosted-evidence` | research-lab-surface | C | coverage card `Evidence: this process`; local matrix is not hosted/CI | yes |
| `operator-vs-trader-path-separation` | research-lab-surface | S | `/_ops/research` off-shell unlinked; not `/lab`; Pages `_research` 404; metrics token not trader cookie | yes |
| `present-is-live-paid-only` | research-lab-surface | S | **5th instance.** Coverage `present` = loadable LiveMassive only; books table never `present`/`kept`; no mint from list `source` | yes |
| `cited-code-is-verified-not-assumed` | research-lab-surface | S | live `app.tsx` first-group `/_ops/metrics`, `LabIndex` demos, Pages Function 404, existing books/coverage GETs | yes |
| `server-side-gate-enforcement` | research-lab-surface | S | metrics token gate; page `credentials:'omit'`; cookie-only 401 is non-page GATE Q | yes |
| `absent-is-not-none` | research-lab-surface | S | cors-fault ≠ occupancy-500 ≠ coverage-unavailable ≠ list stale; occupancy-500 hides concurrent load digest | yes |
| `no-secrets-in-image` | research-lab-surface | S | sitting origin + token tab memory only; never sessionStorage / localStorage / query | yes |
| `structural-over-prose-enforcement` | research-lab-surface | S | empty `apps/api` product diff; path-scan allowlist + anti-vacuity; no relative `/api/_research` | yes |
| `additive-keeps-score-byte-identical` | research-lab-surface | S | envelopes `authorizes: nothing`; score/tier/fingerprint unused vs used | yes |
| `local-evidence-is-not-hosted-evidence` | research-lab-surface | S | coverage `Evidence: this process`; local matrix is not hosted/CI | yes |
| `theme-token-discipline` | research-lab-surface | S | operator chrome binds theme tokens; no new hex table; dark/light parity | yes |
| `single-motion-moment` | research-lab-surface | S | no new orchestrated motion family | yes |
| `digested-labels-not-raw-dump` | research-lab-surface | S | load digest is counts only; no contract/OHLC/tape dump tables | yes |
| `absent-is-not-none` | exchange-holiday-calendar | I | NYSE full-day holiday is not miss / empty extract / coverage missing | yes |
| `present-is-live-paid-only` | exchange-holiday-calendar | I | a holiday weekday is never a loadable LiveMassive `present` | yes |
| `cited-code-is-verified-not-assumed` | exchange-holiday-calendar | I | cite weekend-only clocks in coverage/ensure/tape/keep/`MarketPhase`; no holiday table in-tree today | yes |
| `structural-over-prose-enforcement` | exchange-holiday-calendar | I | poison a holiday weekday as weekend-ineligible; anti-vacuity | yes |
| `absent-is-not-none` | exchange-holiday-calendar | C | holiday ineligible ≠ weekend ineligible ≠ miss ≠ empty extract ≠ coverage missing | yes |
| `present-is-live-paid-only` | exchange-holiday-calendar | C | holiday weekday never coverage `present` / never LiveMassive | yes |
| `additive-keeps-score-byte-identical` | exchange-holiday-calendar | C | empty `quant-engine` diff; calendar not a scoring input; Authorizes: nothing | yes |
| `structural-over-prose-enforcement` | exchange-holiday-calendar | C | generated/pin-tested scanner replica of the same set; poison holiday-as-weekend | yes |
| `absent-is-not-none` | exchange-holiday-calendar | S | holiday ineligible ≠ weekend ≠ miss ≠ empty extract ≠ coverage missing | yes |
| `present-is-live-paid-only` | exchange-holiday-calendar | S | **6th instance.** Holiday weekday never `present` / never LiveMassive | yes |
| `cited-code-is-verified-not-assumed` | exchange-holiday-calendar | S | weekend-only clocks cited then consumed; table is new domain module | yes |
| `structural-over-prose-enforcement` | exchange-holiday-calendar | S | generated/pin-tested scanner replica; poison holiday-as-weekend; Juneteenth 2022+ | yes |
| `additive-keeps-score-byte-identical` | exchange-holiday-calendar | S | empty `quant-engine` this lane; Authorizes: nothing | yes |
| `single-ticker-on-demand` | exchange-holiday-calendar | S | ensure/scanner stay off the ticker request path; holiday skip is off-path | yes |

> **GATE S tally — exchange-holiday-calendar (2026-08-31).** **NO new graduations.** Mechanical
> `ledger_tally`: 10 unpromoted watch keys remain at 1 feature each (still includes
> `credential-class-isolation`). Already-promoted keys gained instances
> (`present-is-live-paid-only` 6th · `absent-is-not-none` ·
> `cited-code-is-verified-not-assumed` · `structural-over-prose-enforcement` ·
> `additive-keeps-score-byte-identical` · `single-ticker-on-demand`).
> Conformance JSON promoted to `state/conformance/exchange-holiday-calendar.json`.
> No `GET /api/holidays`. Empty `quant-engine` this lane.

> **GATE S tally — research-lab-surface (2026-08-31).** **NO new graduations.** Mechanical
> `ledger_tally`: 10 unpromoted watch keys remain at 1 feature each (still includes
> `credential-class-isolation`). Already-promoted keys gained instances
> (`present-is-live-paid-only` 5th · `operator-vs-trader-path-separation` ·
> `cited-code-is-verified-not-assumed` · `server-side-gate-enforcement` ·
> `absent-is-not-none` · `no-secrets-in-image` · `structural-over-prose-enforcement` ·
> `additive-keeps-score-byte-identical` · `local-evidence-is-not-hosted-evidence` ·
> `theme-token-discipline` · `single-motion-moment` · `digested-labels-not-raw-dump`).
> Re-pin JSON promoted to `state/conformance/research-lab-surface.json`. Empty `apps/api`
> product diff. Pages `_research` 404 stands.

> **GATE S tally — massive-flat-file-keep (2026-08-31).** **NO new graduations.** Mechanical
> `ledger_tally`: 10 unpromoted watch keys remain at 1 feature each (new:
> `credential-class-isolation`). Already-promoted keys gained instances
> (`present-is-live-paid-only` 4th · `cited-code-is-verified-not-assumed` ·
> `production-fails-closed` · `operator-vs-trader-path-separation` ·
> `additive-keeps-score-byte-identical` · `best-effort-isolated-or-null` ·
> `absent-is-not-none` · `structural-over-prose-enforcement` ·
> `local-evidence-is-not-hosted-evidence` · `no-secrets-in-image`). Conformance JSON promoted to
> `state/conformance/massive-flat-file-keep.json`. Completing missing names after skip-GET is Future.

> **GATE S tally — ai-providers (2026-08-18).** **NO new graduations.** All honored keys are already
> promoted canon. New watch-list key `user-subscription-not-operator-pool` (1 feature, binding).
> Conformance JSON promoted to `state/conformance/ai-providers.json`. AC-9/10/14/15 stay
> open/blocked-on until xAI user-OAuth docs verify (AC-27).

> **GATE S tally — ticker-visual-collisions + ai-rec-decision-card (2026-08-17).** **NO new graduations.**
> All keys these two logged are already promoted canon except watch-list leftovers from earlier
> features (`cited-code-is-verified-not-assumed` still 1 feature). Owner-directed archive of two
> FE-only folders already on `main`; `NO_BACKEND_CHANGE` so no conformance JSON promoted.

> **GATE S tally — rec-plan-scope-caption (2026-08-17).** **`cited-code-is-verified-not-assumed`
> GRADUATES** (2 features, all binding — mechanical `ledger_tally`). Already-promoted keys gained
> instances (`ai-asserted-numbers-are-traceable` now covers asserted · omitted · inferred;
> `absent-is-not-none` · `digested-labels-not-raw-dump` · `additive-keeps-score-byte-identical` ·
> `live-vs-static-isolation` · `theme-token-discipline` · `single-motion-moment`).
> `NO_BACKEND_CHANGE` — no conformance JSON promoted. **`ai-rec-grounding` SPEC §9.5 recorded closed.**

| `structural-over-prose-enforcement` | browser-quality-gates | S | closed inventories/readiness, mutation-tested failure controls, hashed artifacts, and aggregate settlement make missing, skipped, flaky, unsafe, or silently updated browser evidence fail | yes |
| `cited-code-is-verified-not-assumed` | browser-quality-gates | S | engine/project/runtime identities and local evidence are recorded exactly; unavailable hosted Ubuntu execution remains NOT RUN rather than inferred from local success | yes |
| `theme-token-discipline` | browser-quality-gates | S | D7/D8 accessibility repairs use existing mode-aware theme slots; no global token/palette or unrelated presentation amendment was authorized | yes |

| `operator-vs-trader-path-separation` | archive-coverage-guardrails | C | protected metrics projects only an immutable in-memory coverage snapshot; request-time archive I/O, vendor fetch, repair, recompute, mutation, trader routes, SSE, and UI are excluded | yes |
| `production-fails-closed` | archive-coverage-guardrails | C | invalid production coverage policy, unsupported calendar domain, or unusable required archive location refuses before bind; a later corpus gap remains an operator incident and never takes trading down | yes |
| `structural-over-prose-enforcement` | archive-coverage-guardrails | C | one shared evaluator, read-only capabilities, closed states, source-boundary guards, and mutation-proved forbidden imports/writes make detector/audit drift or remediation access build-breaking | yes |
| `cited-code-is-verified-not-assumed` | archive-coverage-guardrails | C | design claims bind to inspected Rust metrics/archive/ensure/CLI/startup seams; implementation divergence requires GATE Z rather than silent adaptation | yes |
| `shared-session-eligibility-calendar` | archive-coverage-guardrails | C | session producer and coverage detector consume one checked-in, versioned, zero-vendor XNYS full-day eligibility calendar so closed markets cannot become false missing-book incidents | yes |
| `reconstruction-never-satisfies-live-coverage` | archive-coverage-guardrails | C | fixtures and partial reconstructions live behind separate adapters/namespaces and can never turn a missing original production session book into readable-live coverage | yes |

> **GATE S tally — browser-quality-gates (2026-08-24).** **NO new graduations.** All three
> binding keys were already promoted canon. `NO_BACKEND_CHANGE`, so no conformance JSON was promoted.
> Fresh independent QA passed 45/0/0; hosted Ubuntu evidence remains honestly NOT RUN until GitHub
> runner access returns.

| `integrate-parallel-lines-by-verified-merge` | mainline-integration-2026-09 | PLAN | when two lines both hold QA-passed builds of the same feature, main lands them by ONE verified merge (fresh QA + hosted CI), never by cherry-picking records without their code and never by resetting main; both records are kept verbatim under distinct archive names | yes |
| `duplicate-implementations-coexist-until-ruled` | mainline-integration-2026-09 | PLAN | an accidental parallel implementation (capacity v1/v2, coverage main/research-read) stays in code until the owner rules which retires; the integration lane may not delete a side to resolve a conflict | no |

> **Owner rulings 2026-09-01.** D1 = **A** (integrate by merge). D2 and D3 queued: keep both capacity
> harnesses and both coverage builds during integration (default-with-veto, reversible); history-secret
> ruling for `supply-chain-automation` asked at the next gateway close.

| `calendar-truth-is-shared-xnys-json` | mainline-integration-2026-09 | Z | NYSE full-day closures come from the shared XNYS calendar JSON; a Saturday New Year's Day does not close the preceding Friday (NYSE Rule 7.2 year-end exception; 2010-12-31 and 2021-12-31 precedent); any second encoding (Rust table, dashboard list) exists only under a checked-in parity test against the JSON | yes |
| `route-growth-repins-api-artifact-oracle` | mainline-integration-2026-09 | Z | a shipped feature that adds API operations re-pins the capacity byte-identity artifact **hashes** in the same change (precedent bcb3d29d); the score/tier/fingerprint decision fixtures never move. **NARROWED 2026-09-02 (GATE Q run 4 finding):** this row originally said "hashes and operation count", which put it in direct conflict with `oracles-derive-totals-never-pin-them` promoted by the same gate. The count half is withdrawn: the artifact sha256 gate already determines the operation array byte-for-byte, so a count literal was unreachable as well as brittle. Hashes are the oracle; counts derive from them. Re-adding a count pin is a GATE-Z reversal. | yes |
| `structural-scanners-reconcile-by-allowlist` | mainline-integration-2026-09 | Z | when a later approved feature legitimately needs a phrase or path an earlier negative-space scanner forbids, the scanner gains an explicit, file-exact, mutation-tested allowlist; trader poison is never deleted and URL/identifier needles stay global | yes |
| `oracles-derive-totals-never-pin-them` | mainline-integration-2026-09 | Z | an oracle that guards a countable surface (API operations, response conversions, direct-HTTP cases, migrations, route inventories) derives its total from the manifest or route table at run time and detects change by comparing an id-set hash; a frozen literal count is a bug, not a guardrail — it turns every legitimate additive feature into a failure and was contradicted three times in one merge (52→57 operations, 181/87→201/100, migration 12→13) | yes |
| `test-oracles-never-pin-their-environment` | mainline-integration-2026-09 | Z | a test may not assert a value derived from the machine it runs on (CI-vs-local evidence labels, host OS, platform stack size) unless it derives that value from the same classifier the code uses; such an assertion passes only where it was written and silently never runs anywhere else — `capacity_load.rs` pinned `"local"` and so could only pass off CI, and AC-14 pinned a Windows-only stack overflow it could never reproduce elsewhere | yes |
| `design-source-mirrors-tokens-ts` | design-rebaseline-2026-09 | canon-review | the design source under `design/` (canvas, library, `tokens/tokens.json`) is a verified mirror of `tokens.ts`, never read at runtime and never a second rules authority; binding rules live only in `DESIGN_SYSTEM.md` (Status SET — Curvature Terminal v2, 2026-09-03); `node design/src/verify-tokens.mjs` must pass before any token change ships | yes |
| `data-signal-motion-class` | design-rebaseline-2026-09 | canon-review | the hero curve-draw stays the one orchestrated moment; data-signal keyframes (flash, pulse, drift, trail, beam, shimmer, sheet) are exempt as a class only while a genuine live stream delivers and under prefers-reduced-motion off; `single-motion-moment.spec.ts` encodes the class, not an enumerated list, once the v2 build lands | yes |
| `one-liveness-predicate` | curvature-v2-foundations | Q | Exactly ONE predicate answers "is this stream delivering?" — `isDeliveringLive` (`pages/ticker/sessionTapeStanding.ts`) — and both the connection chip (`connection/connectionState.ts`) and every per-figure live marker (`LiveTape.tsx`) call it. A second derivation is the defect, not a style choice: GATE Q found the chip consulting `market_session` while the tape did not, so with the market CLOSED three figures still wore live dots and the widget pulse still ran. Enforced by `live-dot-census.spec.tsx` (13 tests over every chip state and all seven replay standings), which fails 7/13 against the pre-fix code | yes |
| `absent-timestamp-is-not-an-age` | curvature-v2-foundations | Q | A wire sentinel is never rendered as a computed figure. `as_of: 0` is an ABSENT timestamp — the scanner's own `project_error` emits it — so it renders a closed-vocabulary member, never an age. Shipped as `unavailable · as of 496824h ago` until GATE Q observed it; `relAge` now returns null for `epochS <= 0`. This is `[absent-is-not-none]` applied to time | yes |
| `a-proof-must-be-able-to-fail` | curvature-v2-foundations | Q | A test labelled as a mutation proof must be shown to fail against the mutation it claims to catch. Two shipped with `expect(true).toBe(true)` bodies; GATE Q refused them as proof and mutated the real source itself. Where the guard is compile-time, the proof is a type-level assertion the suite evaluates (`@ts-expect-error`, which fails typecheck as TS2578 if the error stops occurring) — never a runtime `expect` that cannot observe it. A vacuous proof is worse than none: it reads as coverage | yes |
| `context-band-is-the-designs-card-list` | ticker-fidelity-repair | owner | The `/ticker` context band renders exactly the design's card list (`design/src/screens/desk.mjs:395-421`): a widget outside that list is not placed in the band without an owner ruling. Ruled 2026-09-08 ("Do all four"): the `IvRank` card leaves the band — it repeats the read strip's IV-rank cell (one fact, one place) and the design never had it there; the component stays for its own consumers. Cause: the band was 1,052 px against the design's 673 at 1280 after the fidelity repair, and IvRank's presence pushed every later card a slot (`TICKER_FIDELITY_REPAIR_REPORT.md`, change 2) | yes |
| `conductor-signs-both-visual-receipts-on-owner-ruling` | visual-baseline-receipts-2026-09 | owner | Ruled 2026-09-08 (verbatim: "the Windows session may sign both, proceed on Windows"): for the Curvature Terminal v2 baseline regeneration on `spire/curvature-v2-foundations`, the Claude session on the owner's Windows box, acting as conductor, may author BOTH the authorization receipt (as `workspace-owner`, after inspecting every actual/diff against the design) and the acceptance receipt (as `workspace-code-reviewer`, after inspecting every candidate PNG and the binary patch). This is the delegation `_archive/browser-quality-gates/PLAN.md:86` already describes ("the conductor supplies an owner/design-review authorization … and a code-review acceptance"); it does not touch `visual-baseline-requires-human-authority` — the update command still creates neither receipt, and build lanes still author neither. Scope: this branch, this regeneration; a later flow needs its own ruling | yes |
| `canvas-draw-sets-its-own-state` | curvature-v2-foundations | Q | A canvas `draw` sets every context state it depends on (`lineWidth`, `strokeStyle`, `fillStyle`, the dash) and never inherits it from an earlier draw; a layout that resets `canvas.width` repaints synchronously in the same task, never on a deferred frame. Earned 2026-09-08 (F-D): the tape-trail baseline inherited `lineWidth` 1.75 from the trail stroke and a resize cleared the bitmap with the repaint left to a frame the visual gate's frozen clock never ran — two intensities, a race, a flaky baseline on both platforms. Fixed `6fa9419b` + `40ec63fc`; guarded by `TapePulseStrip.spec.tsx` (three cases, each RED before its fix). | yes |
| `advisory-red-merge-is-an-owner-ruling` | curvature-v2-foundations | S | Ruled 2026-09-10: a PR whose only red is the supply-chain policy job on an advisory with no fixed upstream (`js-yaml` 4 under `@redocly/openapi-core` 1.x via `openapi-typescript`) may merge on an explicit owner ruling recorded in BACKLOG (F-J), never by loosening the policy — `validateExceptions` keeps returning `security-exception-prohibited` for advisory rule ids and the 30-day cap stands. PR #46 → `3f9d941e` merged this way | yes |
| `leaked-secret-is-rotated-not-rewritten` | curvature-v2-foundations | owner | Rotated 2026-09-10: the `MASSIVE_API_KEY` committed in `1aac13ec` (removed `fc9c8d28`) was still accepted by the vendor and was the key Railway production ran on; the owner revoked it at the vendor (old key → 401), set the replacement in the Mac `apps/api/.env` and on Railway `api-rust` (verified by hash, never by value; new key → 200). No history rewrite (worktrees on three machines). A secret found in history is closed by rotation + a dated ledger row, and the rotation is verified by a status-code probe of the OLD key, not by trusting the dashboard | yes |
| `hero-3d-is-a-static-isometric-projection` | curvature-v2-landing-and-site | C | Owner ruling D-B = (A) 2026-09-10: the landing hero instrument renders the dealer-gamma surface as a static inline SVG isometric projection exactly as the approved artboard draws it — no WebGL / three.js, no new dependency, deterministic pixels for the visual gate; canon Amendments row dated 2026-09-10 records the reading. D-A stands at (A): the blog index ships with the one published read and no draft slots | yes |
| `gate-server-mirrors-production-routing` | curvature-v2-landing-and-site | Z | The browser gates serve the production build with production's routing rules: Cloudflare Pages plus `apps/dashboard/public/_redirects`, where an existing static FILE wins and everything else gets `/index.html` with 200. That includes a directory with no index.html. `http-server` 302'd `/blog` to a directory listing (the static article folder `public/blog/`) while production served the SPA shell with a 200, measured 2026-09-22. A gate that routes differently from production reports false reds or hides real ones. Now `apps/dashboard-e2e/tools/serve-dist.mjs` (F15b, `55394a49`) | yes |
| `a11y-gate-scans-both-schemes-and-overlays` | curvature-v2-landing-and-site | Q | The accessibility gate scans every shipped surface in BOTH colour schemes, plus the overlays and gated states the surface can show: the sign-in wall, the degraded wall and the dialog. GATE Q found serious light-scheme contrast failures in 28 of 56 scans across four surfaces that the dark-only scan matrix could not see (the same class F7c had fixed on the landing alone). SPEC GATE Z amendment 5 names the matrix; the frozen inventory went from 12 to 24 scans with zero waivers (`52d79ea0`) | yes |
| `cited-code-is-verified-not-assumed` | curvature-v2-landing-and-site | Q | Instance: user-facing explanatory copy is a claim about code too. The methodology's `Flip transition` row, carried verbatim from the design source, said the flip "moved across the mid since the last snapshot". The engine scores `transition = 10` when price sits within `FLIP_PROXIMITY_PCT` (1%) of the flip (`libs/quant-engine/src/signals.rs:19,241`, `opportunity_score_parts`), and computes no move across snapshots. Corrected against the source (SPEC GATE Z amendment 1, `eb7e3fd5`) | yes |
| `vendor-absence-is-a-named-state` | no-vendor-production-posture | C | A data source that is absent by decision, such as a cancelled vendor, is a NAMED state and not a fault. The process makes zero contact with it (`MARKET_DATA_MODE=paused`: no warmer, sweep, socket or REST; boot needs no key). Every consumer gets one typed reply (`503` with `code: "market_data_paused"`), and the UI names it calmly ("Market data is paused.", info tone). There is never a transient-failure message, a Retry, or a retry loop. Owner plan A 2026-09-23; `llm_error` for this case was a GATE Q FAIL (AC-3) | yes |
| `route-growth-repins-api-artifact-oracle` | no-vendor-production-posture | B | Instance: B5's `AppErrorBody.code` plus the scan and health fields, and amendment 1's POST summary, each regenerated the OpenAPI artifacts through `npm run api:contract:generate`. Each re-pinned the capacity artifact-oracle hashes (`apps/api/src/capacity/identity.rs` and the fixture manifest) in the same commit, with a dated comment (`9a5748e2`, `117b7c72`) | yes |
| `a11y-gate-scans-both-schemes-and-overlays` | no-vendor-production-posture | Q | Instance: the new paused-desk state got its own a11y scans in both schemes at 393 and 1280 (A11Y-25..28, 24 → 28 scans, zero waivers). The new light 1280 `/ticker` scan found a pre-existing failure, the light top-nav active link at 3.23:1, which was fixed in `6b60407a` rather than waived | yes |

| `demo-live-boundaries-are-disjoint` | portfolio-demo-platform | C | Public demo selection occurs before network/store/first-paint composition; every transport and current/legacy browser key is isolated, and an unsupported operation refuses locally without paid fallback. | yes |
| `public-demo-is-authored-synthetic` | portfolio-demo-platform | C | Public sample fixtures have independent synthetic provenance; captured owner broker/account fixtures never enter a demo build, synthetic frames never claim genuine live delivery, and exports retain scenario origin. | yes |
| `static-preview-does-not-migrate-backend` | portfolio-demo-platform | C | This feature deploys only its static Pages preview; the existing Railway migration hook and production data remain outside authorization. A preview/local result is not evidence of backend runtime execution. | yes |
| `analyst-phase0-approved-by-slice` | ai-analyst-phase0a-q1-package | owner | DESIGN §8.1 answered 2026-10-25 (owner took every recommended answer, S6-Q1): Phase 0 slice 0a alone is approved, a reproducible cutoff-bound Q1 context package from SEC data with no model, route, table or UI; slices 0b-0f (owner role and gate, `context_packages`/`analyst_answers`, persona config in full, per-user AI cap, notes read API, scorer price key) stay gated on the Phase 0 answer. Recorded in DESIGN.md Amendments (2026-10-25). | yes |
| `server-side-gate-enforcement` | site-audit-2026-10-25 (SEC-1) | audit | Instance, 2026-10-26: `GET /api/scan`, `GET /api/scan/all` and `GET /api/scan/{symbol}/history` carry the flip, the walls and net GEX, derived from the licensed options feed, which reach the owner's signed-in account only (owner rule 2026-10-18). The server refuses a signed-out or forged-cookie read with 403 `auth_required` (the `AuthUser` extractor, before path and query are read) and the contract documents all three `session`; `GET /api/scan/universe` (ticker names) and `GET /api/scan/view` (the caller's saved layout) stay open. Supersedes the scanner row's anonymous-open `GET /api/scan` (D2). Proven by `api_contract_runtime_auth_research.rs::scan_reads_with_dealer_levels_refuse_a_signed_out_caller`, which also sorts every `GET /api/scan*` in the contract into gated or open, so a new scan read cannot ship unclassified | yes |
| `owner-gate-for-licence-derived-data` | owner-gate (analyst slice 0b, the gate only) | owner | 2026-10-26: licence-derived data reaches the owner's account alone; "signed in" is not "owner" (DESIGN §6, owner rule 2026-10-18). `OWNER_EMAILS` (`config.rs`) is the owner allowlist: trimmed, case-insensitive against the stored email. Unset or empty means no owner, so every owner-only route refuses everyone (fail closed). It is never logged except as a count, and it never refuses boot. `OwnerUser` (`routes/auth.rs`) answers 403 `auth_required` when signed out and 403 `owner_only` when signed in as anyone else, before path, query or handler. It guards the 14 operations in `routes::OWNER_ONLY_OPERATIONS`: scan, scan/all, scan history, the ticker bundle and progressive stream, market-data, signals, strike-profile, contract, candidates, the ticker stream, and the recommendation post, export and status. The contract marks them `session` + `x-convexa-access: owner`. A new route that serves options-derived data joins that list; a test fails any operation declaring a level field that is neither owner-only nor operator-token. Supersedes, in part, the SEC-1 `server-side-gate-enforcement` instance above: its three scan reads moved from signed in to owner only. Proven by `api_contract_runtime_auth_research.rs::owner_only_routes_answer_the_owner_alone`, `::owner_only_routes_fail_closed_without_owner_emails` and `::every_operation_that_declares_a_dealer_level_is_owner_only_or_operator`. Recorded in DESIGN.md Amendments (2026-10-26) | yes |
| `owner-match-uses-account-store-key` | owner-gate (review fix-up) | review | 2026-10-26: the owner check matches `OWNER_EMAILS` against the stored email with the account store's own key (trim, then ASCII lowercase, the `email_lower` of `services/auth/store.rs` and `db/pg_auth.rs`), never Unicode `to_lowercase`. Unicode lowercasing folds KELVIN SIGN (U+212A) to `k` and a non-ASCII capital to its small letter, while the store registers those spellings as separate accounts, so with sign-ups open a lookalike account passed as an already-registered owner and read the levels (reproduced by two reviewers; production keeps sign-ups closed, so it was not exposed). Any future identity comparison (owner, operator, allowlist) uses the store's key, so it names exactly the accounts the store keeps apart. Narrows the `owner-gate-for-licence-derived-data` row's "case-insensitive" to ASCII case. Proven by `config.rs::owner_emails_trim_ignore_case_fail_closed_and_never_print_an_address` and `api_contract_runtime_auth_research.rs::owner_only_routes_answer_the_owner_alone` (Kelvin-sign lookalike gets 403 `owner_only`); both exit 101 under the old `to_lowercase`. Recorded in DESIGN.md Amendments (2026-10-26, amends item 1) | yes |
