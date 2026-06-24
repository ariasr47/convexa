# PRODUCT CONTRACT — AI Recommendations (in-app risk-first ENTRY rec)

> Producer: Product Manager (architect-first entry, ROLE_LAUNCH_PROMPTS §2 — runs SECOND, after the
> Architect). Consumer: UX/Tech-Writer (next), then Interface/Backend/Frontend.
> Input: GAMMAFLOW_CONTEXT.md + ARCHITECTURE_CONTRACT.md + BRIEF.md + OPEN_THREADS.md. No chat history.
> Lane: user value, scope, dashboard behavior, acceptance criteria. **No code, math, data structures,
> endpoints, payload/field names, or UI layout** — those are downstream (UX → Interface → Eng).
> The goal is DERIVED from the ARCHITECTURE_CONTRACT (the technical shape is locked); the PM does not
> re-scope it. Anything un-buildable under that shape is BOUNCED, not silently narrowed (see last section).

## Feature & user value
Today GammaFlow tells a swing trader *where the edge is* (GEX structure, vol context, an opportunity
score/tier, an external-AI gate) and lets them **copy-paste** a persona-framed hand-off to an external
AI to get a trade read. That copy-paste path is manual, lossy (no structured state), and lives outside
the dashboard. This feature brings the AI read **in-app**: from the dashboard, the trader can **ask the
downstream AI (latest Claude) for a risk-first ENTRY recommendation on the current ticker**, framed by
the **active persona**, fed a **complete structured snapshot of the already-computed state**, and get
back a **structured risk-first recommendation** (decision / bias / structure / strike / expiry / entry
trigger / invalidation / sizing / exit / horizon / confidence / rationale). The trader can **Accept** a
recommendation, which pre-fills the **existing ghost-trade tracker** (paper-sim, advisory) for a final
confirm — or ignore it. The manual copy-paste hand-off **stays** and is **augmented by the same
structured export**, so the external path gains the structured context it lacks today.

Net value: a faster, persona-aware, structured *should-I-enter-and-how* read **in the dashboard**,
disciplined by the same over-trading guardrails as the rest of the product, **advisory-only** (the user
explicitly Accepts; nothing auto-acts), and **honest** (the rec is pinned to the snapshot it was born
from and visibly goes stale; the AI is never presented as gospel).

This is GammaFlow's **first in-app LLM call**. It is a **best-effort, isolated, gated, advisory
CONSUMER** of already-computed state — it never feeds scoring, never recomputes, never auto-acts, and
its failure is contained to its own surface.

## User stories
**Getting a recommendation**
- As a swing trader, I want a **"Get AI recommendation"** action on the dashboard so I can ask the AI
  for a risk-first entry read on the current ticker **without leaving the app**.
- As a swing trader, I want the recommendation **framed by my active persona** (e.g. conservative vs
  aggressive), so the read matches how I trade — without changing any of the numbers on the dashboard.
- As a swing trader, I want the rec fed the **full computed picture** (GEX structure, the four neutral
  positioning reads, vol/anchors, higher-order greeks, dark-pool context, signals/tier/gate, the DTE
  window) so the AI reasons over what I'm actually looking at, not a thin slice.
- As a swing trader, I want the recommendation rendered as a **clear, risk-first structure** — leading
  with max risk and invalidation, with a concrete strike, expiry, sizing, stop and target — so I can
  judge it as a trade plan, not a vibe.
- As a swing trader, I want a returned **"no trade"** read to be presented as a **legitimate, common,
  correct answer** (with its reasoning), not as an error or a failure.

**Honest staleness & attribution**
- As a swing trader, I want each recommendation to clearly show **which persona produced it** and the
  **snapshot it was generated from**, so I know its provenance.
- As a swing trader, I want a recommendation to **go visibly stale** when a newer bundle arrives, and to
  **never silently refresh or re-run itself** on a live-feed drop or a new poll — a rec is a frozen
  artifact of one moment, and I decide when to ask again.

**Acting on it (advisory)**
- As a swing trader, I want to **Accept** a recommendation to **pre-fill the existing ghost-trade
  tracker** (strike/expiry/side/size/stop/target) so I don't retype the plan — but I want a **final
  confirm** so nothing is tracked until I say so.
- As a swing trader, I never want a recommendation **auto-executed or auto-tracked** — the AI suggests,
  the ghost trade is **simulated**, and I explicitly confirm.

**Discipline & cost**
- As a swing trader prone to over-trading, I want the rec action **gated by the same guardrails** as the
  rest of the product — quiet / "no fresh edge" when there's nothing actionable or nothing has changed —
  and **rate-limited** so I can't spam it into a firehose.
- As the single operator paying for the API, I want a **usage cap** so a runaway loop can't rack up cost,
  and I want the UI to tell me clearly when I've hit it.

**Resilience & the manual floor**
- As a swing trader, I want an AI **error, timeout, or outage** to degrade **only the rec surface** —
  the GEX chart, tiles, ghost-trade tracker, and live stream keep working.
- As a swing trader on a deployment where the AI key isn't configured, I want the **in-app call to be
  cleanly unavailable** while the **manual copy-paste hand-off (now with the structured export) still
  works** — the manual path is the always-available floor.

## Scope
**In (this phase):**
- A single **"Get AI recommendation"** action on the dashboard for the **current ticker only**,
  on-demand, user-initiated.
- The recommendation is **framed by the active persona** (canonical persona, sourced as the
  ARCHITECTURE_CONTRACT specifies) and fed a **complete structured snapshot** of the already-computed
  state for that ticker (no recompute, no new fetch).
- The returned **risk-first ENTRY recommendation** rendered readably: decision (trade / no-trade), bias,
  structure, concrete strike(s), expiration within the requested DTE window, entry trigger, invalidation
  level, max-risk sizing, exit (target + stop), time horizon, confidence, and a rationale citing the
  specific GammaFlow levels.
- A **"no trade"** result rendered as a legitimate outcome with its rationale.
- **Provenance + staleness** on every rec: which persona produced it, the snapshot it is pinned to, and
  an honest **stale** marker once a newer bundle has arrived.
- **Gating** of the action by the existing over-trading guardrails (a "no fresh edge" de-emphasis when
  the guardrails say there's nothing actionable/changed) **plus a cooldown + a usage cap**, with clear
  UI for each blocked state.
- **Accept → pre-fill the existing ghost-trade tracker entry** with a **final confirm step**; the
  resulting trade is the same **simulated** ghost trade as a manual one.
- The **manual copy-paste hand-off retained and augmented** by the same structured export; the export is
  **manually surfaceable** (the user can view/copy exactly what would be / was sent).
- **Best-effort isolation**: AI error / timeout / over-cap / no-key degrade the rec surface alone; the
  rest of the dashboard renders normally.

**Out (this phase):**
- **Reassessment of an OPEN position via in-app LLM.** Entry only. The existing operator-mediated
  reassessment path (paste-verdict) stays the separate boundary and is **not** in-app-LLM-ified here.
- **Auto-execution / auto-tracking** of a recommendation (always an explicit Accept + confirm).
- **Any real-broker / real-order path.** The Accept target is the **paper-sim** ghost-trade tracker
  only; `SIMULATED` everywhere; no path to a real order.
- **The AI as a scoring input.** The LLM never feeds signals / opportunity_score / opportunity_tier /
  the entry gate / ai_eval / the state fingerprint; the score is byte-identical with and without the
  feature, and whether or not a rec was ever requested.
- **Recompute / new vendor fetch / new math.** The rec reads the already-computed cached state; no new
  gamma source, no greek repricing, no DTE-scope change.
- **Multi-ticker / watchlist** AI reads; **batch / scheduled / background** recommendations (on-demand,
  current ticker only).
- **BYO-key / per-user / multi-tenant** key handling (single server-side key today; the seam is
  designed-for, not built).
- **Persona editing/creation as part of this feature** (personas already ship; this feature only
  *selects* which one frames the query).
- Data structures, endpoints, payload shapes, math, the rate-cap mechanism, the exact gating math, and
  UI layout (Architect / Interface / UX / Eng own these).

**Future-dated (named, explicitly deferred):**
- **In-app LLM reassessment of an open position** (the position-aware sibling of this entry rec) — a
  later slice; the design here should not preclude reusing the same in-app call surface for it.
- **BYO-key / multi-tenant credentials** — a per-user key behind the same server-side seam, built only
  when multi-tenancy is real.
- **Streaming token-by-token rendering** if the whole-rec render proves too slow in practice (see
  Decision 7 — deferred as a UX-latency optimization, not a v1 requirement).
- **Acceptance / outcome analytics** (did AI-recommended ghost trades beat manual ones) — leverages the
  ghost-trade decision history; not built here.
- **A vendor/model swap** (a different LLM behind the same provider-port-like seam) — designed-for, not
  exercised; latest Claude is the only model today.

## Product decisions made here (resolving the Architect's 9 open questions, in order)

**(1) Rec UI scope — where/how the rec lives.**
The recommendation lives on the **trader dashboard** as a **dedicated, on-demand rec surface** triggered
by a single explicit **"Get AI recommendation"** action, scoped to the **current ticker**. It is its own
**independently-nullable** surface (its failure never blanks the chart/tiles/tracker). The exact
placement, layout, and copy are the **UX/Tech-Writer's** call; this contract fixes only that the surface
exists, is on-demand, is for the current ticker, is independently nullable, and renders the risk-first
fields legibly with risk/invalidation foremost. **Constraint for UX:** the rec must **never** read as an
auto-executed instruction — it is rendered as advice behind an explicit Accept.

**(2) Gating / cooldown as a product rule.**
The action is **gated by the existing over-trading guardrails**, surfaced as three observable states:
- **Available** — the guardrails indicate a fresh, actionable edge: the action is fully enabled.
- **No fresh edge** — the guardrails indicate nothing actionable, or nothing has changed since the last
  evaluation: the action is **visibly de-emphasized** and accompanied by an honest **"no fresh edge"**
  message. It is **not hard-disabled** — the trader may still **override and query** (an explicit
  one-tap override), because a thoughtful trader may want a read even when the gate is quiet; but the
  *default* presentation discourages it. (The override still counts against the cooldown + cap below.)
- **Cooling down** — within the cooldown window after a query, the action is **temporarily disabled**
  with a visible **time-remaining** indication; it re-enables when the cooldown elapses.
This honors the binding over-trading guard (de-emphasis + cooldown) while keeping the trader in control.
The **exact gating signal** (which guardrail fields mean "no fresh edge") is the Interface's to wire to
the existing `ai_eval` machinery; the **product rule** is the three states above.

**(3) Rate cap (concrete numbers) + over-limit behavior.**
Two limits, both observable, both **operator-configurable** (these are product *defaults*, not magic
constants baked in code — the operator can tune them):
- **Cooldown between queries: 60 seconds** (default). Back-to-back queries are blocked during the
  cooldown (the "Cooling down" state in Decision 2). Rationale stated to the trader: a fresh entry read
  rarely changes meaningfully inside a minute, and the bundle itself refreshes on a ~60s cadence.
- **Daily usage cap: 50 recommendations per day** (default), counted per deployment (single user
  today). On hitting the cap, the action is **disabled** for the remainder of the day with a clear
  **"Daily AI limit reached — resets {when}"** message; the **manual export path stays available** (it
  costs nothing), so the trader is never fully cut off. Hitting either limit is **never an error
  state** — it is a calm, explained, expected blocked state. The *enforcement mechanism* (server-side
  cap, exact reset boundary) is the Architect/Interface's; the **numbers, the per-day semantics, and the
  over-limit UX** are fixed here.

**(4) What Accept pre-fills vs leaves user-editable + the confirm step.**
**Accept pre-fills the ghost-trade entry from the recommendation** — and the trade is **never tracked
until the user confirms**. Pre-fill mapping:
- **Pre-filled (editable) from the rec:** the **structure/side** (call vs put / long), the **strike**,
  the **expiration** (within the requested DTE window), the **stop** (from the invalidation level), the
  **target** (from the exit plan), and a **suggested position size** (from the rec's risk-first sizing).
- **Always user-editable before confirm:** **every** pre-filled field is editable — the trader can
  override strike, expiry, size, stop, or target. **Quantity/size** in particular is presented as a
  **suggestion the user must accept or change**, because position sizing is the trader's risk decision.
- **Confirm step is mandatory:** Accept opens the **existing ghost-trade entry dialog pre-filled**;
  **no ghost trade exists until the user confirms** in that dialog. Cancelling the dialog leaves no
  trade. This reuses the shipped tracker entry path — it is an integration, not a new entry system.
- If the rec is **"no trade"**, there is **nothing to Accept** (no entry to pre-fill) — Accept is absent
  / disabled for a no-trade rec.
- **Add-cap discipline:** since this is an **entry** (a new position), the existing tracker's
  "one open ghost trade per ticker" rule applies — Accept pre-fills an entry; if a ghost trade is
  already open for the ticker, the entry follows the tracker's existing rule (the tracker owns that
  behavior; this feature does not change it).

**(5) Error / no_trade / over-cap / no-key UX.**
Each is a **distinct, observable, non-alarming** rec-surface state — all contained to the rec surface,
none of them breaking the bundle/SSE/page:
- **AI error or timeout** → an **"AI unavailable — try again"** state (the rec surface shows it failed,
  offers a retry; the retry still respects the cooldown + cap). Not an error banner over the dashboard.
- **`no_trade` result** → a **legitimate rendered outcome** ("No trade — {rationale}"), visually
  distinct from an error. It is a *successful* recommendation that happens to advise sitting out.
- **Over-cap (cooldown or daily limit)** → the calm explained blocked states from Decision 3 (time
  remaining / resets-when), **never** an error.
- **Key-not-configured (or feature off)** → the in-app action is **cleanly unavailable** (visibly
  inert, with a short "in-app AI not configured" explanation) and the **manual export / copy-paste
  hand-off remains fully functional** — the always-available floor. The dashboard is otherwise
  untouched.

**(6) Manual-export surfacing.**
The **structured state export is independently surfaceable** — the trader can **view and copy exactly
what would be (or was) sent to the AI** as part of the manual copy-paste hand-off, **without** triggering
an in-app call. This is the augmented version of today's hand-off: the **same** export feeds both the
in-app call and the manual path. It is available **even when the in-app call is unavailable** (no key,
over-cap, error) — the export costs nothing and is the floor. The export's surfacing must make plain
that it is the **complete, auditable list of what leaves the machine** for the current ticker (the
security note in the ARCHITECTURE_CONTRACT calls this a reviewable surface). Exact placement/copy is UX.

**(7) Token streaming — choice.**
**Default to whole-rec rendering** (the recommendation appears complete, with an honest **loading /
"thinking" state** while the multi-second call is in flight). Streaming token-by-token is **NOT a v1
requirement** — it is **future-dated** as a latency optimization (above) if the wait proves too long in
practice. Rationale fixed here: a risk-first trade plan should be **judged whole** (a partially-streamed
plan invites acting on half a recommendation), and the loading state already keeps the surface honest.
The architecture allows either; the **product choice is whole-rec + a clear loading state**.

**(8) Attribution / staleness presentation.**
Every rendered recommendation carries, observably:
- **Persona attribution** — which persona produced this rec (so two recs from different personas are
  distinguishable).
- **Snapshot pin / as-of** — the rec is **pinned** to the bundle snapshot it was generated from, shown
  as an **"as of {that snapshot}"** marker.
- **Stale marker** — once a **newer bundle** has arrived (a newer poll), the rec is marked **stale**
  ("based on older data — get a fresh recommendation"); it does **not** silently refresh, mutate, or
  re-run. An **SSE/live-feed drop does NOT stale or refresh the rec** (the rec is a static artifact, not
  a live-derived tile) — it simply persists, pinned. The trader explicitly requests a fresh rec.
The exact visual treatment is UX; the **data carried + the rules** (pin, stale-on-newer-bundle,
never-auto-refresh, SSE-drop-does-not-touch-it) are fixed here.

**(9) Persona selection at query time.**
The query is framed by the **active persona by default** (the persona already selected in the persona
surface). The trader **may** pick a **different persona for a given query** at query time (a per-query
override) **without changing the globally-active persona** — so a trader can ask "what would the
conservative persona say here?" as a one-off. Switching persona for a query is **pure presentation /
prompt-framing**: it **never recomputes** anything and **never changes** signals / score / tier / gate /
fingerprint (persona is a non-input to scoring — canon). Whether the per-query picker is a prominent
control or tucked into the action is UX; the **product rule** is: default = active persona, per-query
override allowed, override is non-scoring and does not mutate the active selection.

## Behavior rules (cross-cutting)

### The recommendation is advisory and honest
- **Never presented as gospel.** The risk-first framing (risk + invalidation foremost) and the explicit
  Accept gate are the discipline against hallucination. The UI must not phrase a rec as a command.
- **Pinned + static.** A rec is generated **once** from one snapshot and frozen. Newer bundle → stale
  marker. SSE drop → untouched. No silent refresh, no auto-re-run, ever.
- **`no_trade` is a first-class outcome**, not a degraded one.

### Gating, cooldown, cost (the over-trading + cost guard)
- The action honors the existing guardrails (Available / No-fresh-edge / Cooling-down) **plus** the
  cooldown (60s default) **plus** the daily cap (50/day default).
- Blocked states (no-fresh-edge override aside) are **calm and explained**, never errors.
- The **override** on "no fresh edge" is allowed but de-emphasized, and still costs against cooldown+cap.

### Accept → ghost-trade (advisory, simulated, confirmed)
- Accept **pre-fills** the existing ghost-trade entry dialog; **nothing is tracked until the user
  confirms**; every pre-filled field is **editable**; size is a **suggestion**.
- The resulting trade is the same **`SIMULATED`** ghost trade as a manual one — no new store, no order
  path, no auto-fill without the user's act. This is an **integration with the shipped tracker**, not a
  new order system.

### Isolation & the manual floor
- The rec surface is **best-effort and independently nullable**: any AI error/timeout/over-cap/no-key
  degrades **only** the rec surface. The GEX chart, the four neutral tiles, off-exchange blocks, the
  ghost-trade tracker, and the live stream all keep rendering.
- The **manual copy-paste hand-off + structured export is the always-available floor** — it works even
  when the in-app call doesn't.

### Egress honesty (product-visible)
- The structured export is the **complete, reviewable list of what leaves the machine** for the current
  ticker on demand: the computed context + the persona prompt + the glossary. **No** other ticker, **no**
  user identity, **no** vendor credentials, **no** order/broker data leave. The trader can view it.

## Binding constraints from GAMMAFLOW_CONTEXT + ARCHITECTURE_CONTRACT (restated for UX — must not be violated)
These are inherited as GIVEN (locked by the Architect / the standing ledger); UX must not reopen them.
- **The relaxed `ai-external-no-llm` boundary** — GammaFlow MAY now call an LLM, but **only** as a
  best-effort, isolated, gated, **advisory CONSUMER** of already-computed state. The LLM never feeds
  scoring, never recomputes, never rides the SSE path, never sees the key in the browser. The manual
  hand-off remains valid and is augmented, not replaced.
- **`[additive-keeps-score-byte-identical]`** — the AI call is a pure consumer; signals /
  opportunity_score / opportunity_tier / the entry gate / ai_eval / state_fingerprint are
  **byte-identical** with and without the feature, and whether or not a rec was ever requested. The rec
  is **never** a scoring input. (Persona framing is likewise non-scoring.)
- **`[best-effort-isolated-or-null]`** — any LLM error / timeout / rate-limit / over-cap / no-key yields
  a graceful, contained "unavailable" rec state — **never** an HTTP error that breaks the bundle/SSE/page.
  The rec surface degrades **alone**.
- **`[live-vs-static-isolation]`** — a rec is a **static artifact pinned to its snapshot**: a newer
  bundle makes it **stale** (honest as-of), an SSE drop leaves it untouched; it **never** silently
  refreshes, mutates, or re-runs. (Contrast: it is NOT a live-derived tile.)
- **`[no-real-order-path]`** — "action" = Accept into the **paper-sim ghost-trade tracker** only;
  `SIMULATED` everywhere; advisory; explicit user confirm; **no broker order, ever.**
- **Over-trading gate is binding** — querying honors the existing `ai_eval` guardrails + a rate cap; the
  risk-first output contract (lead with risk; `no_trade` is valid+common) survives intact and is never
  softened.
- **Persona single-sourcing + non-scoring** — the persona that frames the query is the canonical persona
  (per the Architect); persona changes only the AI briefing, never the dashboard numbers.
- **No recompute / no new fetch / no new math** — the export reads computed state; gamma sourcing,
  rates/greeks, and DTE/expiration-filter scope are all unchanged.
- **Single-ticker, on-demand** — the rec is for the current ticker only; no watchlist/scan/background.
- **Server-side key only** — the API key never reaches the browser; all calls route through the backend.
- **Honest live-vs-stale** — never present a stale snapshot as fresh; the rec inherits the bundle's
  freshness/`stale` flag at generation time.

## Acceptance criteria (each = a required FE behavioral test, observable WITHOUT reading code, traced at GATE Q)

**Producing & rendering a recommendation**
- [ ] AC1 — From the dashboard, the trader can trigger **"Get AI recommendation"** for the current
      ticker and, after a visible **loading/"thinking"** state, a **risk-first recommendation** is
      rendered (leading with max risk + invalidation, with structure, a concrete strike, an expiration
      within the requested DTE window, entry trigger, sizing, target, stop, horizon, confidence, and a
      rationale citing GammaFlow levels).
- [ ] AC2 — The rendered recommendation is **whole** (it appears complete, not partially streamed); the
      loading state precedes it and is replaced by the full rec.
- [ ] AC3 — Each rendered recommendation shows its **persona attribution** (which persona produced it).
- [ ] AC4 — Each rendered recommendation shows the **snapshot it is pinned to** ("as of {snapshot}").

**`no_trade` result**
- [ ] AC5 — When the AI returns **`no_trade`**, the surface renders it as a **legitimate outcome** with
      its rationale (visually distinct from an error), and there is **no Accept entry to pre-fill**
      (Accept is absent/disabled for a no-trade rec).

**Staleness (static-artifact behavior)**
- [ ] AC6 — After a **newer bundle (a newer poll) arrives**, the existing recommendation is marked
      **stale** (an "older data — get a fresh recommendation" indication) and is **not** silently
      refreshed, mutated, or re-run.
- [ ] AC7 — On a **live-feed (SSE) drop**, the recommendation is **untouched** (not staled, not
      refreshed, not blanked) — it persists pinned to its snapshot.

**Gating / cooldown / cost (over-trading + cost guard)**
- [ ] AC8 — When the guardrails indicate **no fresh edge**, the action is **visibly de-emphasized** with
      a **"no fresh edge"** message, yet the trader can **explicitly override and still query**.
- [ ] AC9 — Immediately **after a query**, the action is **disabled with a visible cooldown** (time
      remaining) and **re-enables** when the cooldown elapses.
- [ ] AC10 — When the **daily usage cap is reached**, the action is **disabled** with a clear
      **"daily AI limit reached — resets {when}"** message (a calm blocked state, not an error), while
      the manual export path stays available.

**Unavailable / error / no-key (best-effort isolation)**
- [ ] AC11 — On an AI **error or timeout**, the rec surface shows an **"AI unavailable — try again"**
      state (with a retry that respects cooldown + cap), and the **GEX chart, neutral tiles,
      off-exchange blocks, ghost-trade tracker, and live stream keep rendering normally** (the rec
      surface degrades alone — no error banner over the dashboard, no blank page).
- [ ] AC12 — When **no AI key is configured (or the feature is off)**, the in-app action is **cleanly
      unavailable** (visibly inert with a short explanation) **and the manual copy-paste hand-off /
      structured export still works** (the always-available floor), with the rest of the dashboard
      untouched.

**Accept → ghost-trade pre-fill + confirm (advisory, simulated)**
- [ ] AC13 — For a **trade** recommendation, **Accept pre-fills the existing ghost-trade entry dialog**
      with the rec's **structure/side, strike, expiry, stop (from invalidation), target (from exit), and
      a suggested size**, all shown as **editable** fields.
- [ ] AC14 — **No ghost trade is created until the user confirms** in the entry dialog; **cancelling**
      the dialog leaves **no** tracked trade.
- [ ] AC15 — A confirmed Accept produces a trade that is unmistakably **`SIMULATED`** (identical in kind
      to a manually-entered ghost trade); **nothing is auto-executed or auto-tracked**, and there is
      **no path to a real broker order**.

**Persona at query time**
- [ ] AC16 — A query uses the **active persona by default**; the trader can choose a **different persona
      for a single query** (a per-query override) and the resulting rec is attributed to **that**
      persona, **without changing the globally-active persona** and **without recomputing** any
      dashboard number (signals / score / tier / gate unchanged).

**Manual export (the floor + egress honesty)**
- [ ] AC17 — The trader can **view and copy the structured export** (exactly what would be / was sent to
      the AI for the current ticker) as part of the manual hand-off, **without** triggering an in-app
      call, and this export is available **even when the in-app call is unavailable** (no-key /
      over-cap / error).

**Score invariance (the standing build invariant — observable)**
- [ ] AC18 — Requesting (or never requesting) a recommendation, and switching the per-query persona,
      leave the dashboard's **opportunity score, opportunity tier, gate state, and the live tiles
      byte-for-observable-identical** — the rec never changes any computed number on the page.

## Amendments bounced to the Architect
**None.** Every product outcome required above is buildable under the locked technical shape: the rec is
a read-and-serialize of cached state, gated + capped + isolated, with Accept reusing the shipped
ghost-trade entry path and the manual export as the floor. No outcome here required reopening the
constraint envelope or the non-goals. (Two product *defaults* that the Architect/Interface must surface
as operator-configurable knobs — the **60s cooldown** and the **50/day cap** of Decision 3 — are
flagged as configuration the enforcement layer owns, not as amendments.)
