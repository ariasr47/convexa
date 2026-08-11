# scanner — PRODUCT_CONTRACT (v1)

> GATE P·X deliverable (PM lane, after the ratified ARCHITECTURE_CONTRACT). Product layer ONLY:
> user stories, scope, product behavior, acceptance criteria observable WITHOUT reading code, and
> the four §10 product decisions. **NO UI/layout/columns, NO copy wording, NO endpoint/wire names,
> NO math/code.** Those are UX (GATE U·X) + the Interface Contract downstream (§Deferred). Stands
> alone against `PROJECT_CONTEXT.md` §5–§6 + `ARCHITECTURE_CONTRACT.md` + the owner-approved design
> (`docs/superpowers/specs/2026-07-23-scanner-v1-design.md`). Does not re-open the architecture.

---

## 1. Who this is for (user stories)

**Morning triage — "which ticker deserves the deep-dive right now?"**
As a swing trader opening the app before/around the bell, I want one dense, honestly-scored table of
the tickers I track, ranked so the best setups float up, so I can pick WHICH ticker to open the full
Ticker page on instead of guessing. I need to trust that a number on the table is the SAME number the
Ticker page will show, and that anything stale or broken is labeled as such rather than dressed up as
fresh.

**Ambient radar — "what just moved?"**
As a trader with the scanner open through the session, I want rows to refresh on their own on a stated
cadence and price changes to be visibly perceptible, and I want names that just moved to update sooner
than the rest, so the table works as a low-effort radar — without ever implying a per-row live feed it
doesn't have. When the background sweep falls behind or dies, I want the table to say so plainly and
keep showing the last known rows, not blank out or lie.

Both framings are served by the SAME single table + the SAME four honest states — triage is the
default-sort read, radar is the same surface left open. No separate mode.

---

## 2. Scope

### In (v1)
- One multi-ticker scan table over an **owner-curated tracked universe (50–100 symbols)** held on the
  server, refreshed by a background sweep with all tabs closed.
- **Anonymous, read-only access** to a **default view** (owner-curated; see D2).
- A **per-account view** for signed-in users: a chosen **subset of the universe** + ordering + an
  optional name + sort/density prefs. **Reads open to all; WRITES require sign-in, enforced
  server-side.**
- A **view editor** (search/toggle/reorder over the universe) — gated behind sign-in.
- **Warm row-click → the existing Ticker page** for that symbol (display navigation only).
- The **four honest states**: first-load skeleton · empty view · worker-down banner over intact stale
  rows · per-row degrade — driven by the closed status vocabulary `ok` / `stale` / `error` /
  `building`.
- Honest freshness surfacing: a per-row as-of + status, a stated two-speed cadence, and a
  "sweep last ran X ago" signal when the worker is behind/down.
- Untracked tickers stay fully usable via the existing single-ticker on-demand Ticker page (no scanner
  presence required for the long tail).

### Out (v1 — explicit non-goals, mirrored from ARCHITECTURE_CONTRACT §8 into product language)
- **No AI anywhere in the scanner UI** — no AI-seeded views, no batch/small-batch recommendations, no
  "ask AI" affordance on the table or its rows.
- **No alerts, thresholds, or notifications** of any kind.
- **No universe admin UI and no in-app "request tracking" flow** — the universe is owner-curated server
  config; a trader cannot add/remove universe symbols from the app.
- **No live/streaming table** — no per-row streams, no SSE on the scanner; the word "live" never
  appears on the table.
- **No order / broker / execution path** — the scanner is display + links only; a row-click only
  navigates.
- **No re-derivation of any market number** — score, tier, regime, vol-regime, flip, walls and their
  distances are shown exactly as the engine computed them; the scanner never recomputes or unifies
  them.

### Future (named seams, not built here)
- AI-seeded views + small-batch recommendations grounded in scan reads (v2).
- In-app "request tracking" flow + a universe admin UI.
- Alerts / thresholds / notifications.
- WS-based prices (only if poll cadence ever disappoints).
- Multiple named per-account views (v1 is a single view per account — see D1).

---

## 3. Product behavior

### 3.1 The scan table
- **Anonymous / signed-out:** shows the **default view** (D2), read-only, with a standard inline
  sign-in prompt for anyone who wants to customize. Refreshes on its own on the stated cadence.
- **Signed-in:** shows the user's **per-account view** if they have saved one; otherwise the default
  view (with the option to start customizing). The per-account view **persists across reload and across
  sessions/devices** (it is server-side state, not browser-local).
- **Row content that MUST be visible in v1** (the layout/columns/order/density are UX's — see
  Deferred Q6): symbol · price · % change · score · tier · regime · vol-regime · gamma flip +
  distance-to-flip · call/put walls + distance-to-nearer-wall · an as-of stamp · a per-row status.
  Any of the numeric fields may be absent for a given row (a partial/failed compute) and MUST render as
  honestly-missing, not as a zero or a fabricated value.
- **Default sort is by score, best-first** (the triage read). Sort is user-changeable and the choice
  persists in the per-account view.
- **The numbers are consumed, never re-derived.** The score, tier, regime, vol-regime, flip and walls
  shown for a symbol are the SAME values the Ticker page shows for that symbol from the same compute.
  The scanner is a projection of the engine's output; it introduces no new market math.

### 3.2 The view editor (gated write)
- Lets a signed-in user choose a **subset of the universe**, **reorder** it, optionally **name** the
  view, and set **sort + density** prefs.
- **Saving is a gated, state-bearing write.** A signed-out user who reaches a save/write is **refused
  at the server** (a real auth refusal, not a client-only guard) and shown the standard inline sign-in
  prompt; nothing is silently written client-side.
- The editor's symbol choices are constrained to the **current universe** (the read-only universe list
  the worker was configured with). It cannot invent, add, or request universe symbols in v1.

### 3.3 Warm row-click → Ticker page
- Clicking any row **navigates to the existing Ticker page for that symbol** and nothing else — no
  order, no trade, no broker action.
- For tracked symbols the landing is **warm** (the page fills faster) as a best-effort optimization; a
  miss/stale simply lands on the normal (cold) Ticker page. The warm path **changes nothing about what
  the Ticker page shows** — same page, same numbers — it only makes it faster when it can. A trader can
  never tell the difference except in speed.

### 3.4 The four honest states (closed status vocabulary)
The status shown per row and per page comes from a **closed set the FE renders via a fixed lookup and
never re-derives** — `ok` / `stale` / `error` / `building`:
- **`ok`** — a fresh full compute produced this row.
- **`stale`** — the last compute is older than the freshness budget (the sweep is behind or the worker
  is down). Prices freeze WITH their stamp; a stale value is never re-presented as fresh.
- **`error`** — this symbol failed its last compute; **only this row degrades**, the rest of the table
  stays alive.
- **`building`** — tracked but not computed even once yet (a fresh/growing universe). Shows the symbol
  present-but-not-yet-scored, honestly (the iv-rank "building history" shape) — never a fabricated
  score, never an error.

Page-level:
- **First-load skeleton** — distinct from `building` and from an offline/stale degrade.
- **Empty view** — a signed-in user whose view has no symbols sees a "pick tickers" affordance
  (intent; wording is UX's); an anonymous user with an empty configured default falls back per D2, not
  to a dead empty screen.
- **Worker-down banner** — when the sweep heartbeat is stale/absent, a banner states the sweep last ran
  X ago **over the intact last-known rows** (the rows persist; the page never 5xx's or blanks because
  the worker died).
- **Per-row degrade** — a single failed/stale row is visibly marked and the table lives on around it.

### 3.5 Freshness honesty (product requirement; exact words = UX)
The table must be **self-describing about its own freshness** so no number ever implies more currency
than it has:
- Each row carries its **own as-of + status** (§3.4).
- The page states its **two-speed basis** in plain language: prices refresh on a fast cadence, the
  full structure on a slower cadence, and names that just moved refresh sooner. The trader must be able
  to read the page and know how fresh each part is without being told elsewhere.
- Price cells may be **perceptibly emphasized on change** (the sanctioned data-signal treatment) — this
  is the ONLY "aliveness" cue; it must not read as, or be labeled, "live."
- When the sweep is behind/down, the "sweep last ran X ago" signal is surfaced (§3.4 banner).

---

## 4. Acceptance criteria (each observable WITHOUT reading code)

> Risk-based per `qa-verify §4` — verification METHOD is noted per AC and finalized at GATE Q; NOT one
> test per AC. `[test]` = a silent regression is plausible, so an automated/negative check is
> warranted. `[review]` = visible/intentional behavior, verified by a QA reviewer in the running app.

**Access & views**
- **AC-1 [review]** An anonymous (never-signed-in) visitor loads the scanner and sees a populated,
  read-only **default view** with a sign-in affordance — not a blank/empty screen, not an error.
- **AC-2 [test]** A signed-in user who saves a per-account view, then reloads (and re-opens in a fresh
  session/device), sees **the same saved view** — subset, order, name, sort, density preserved. It is
  server-side, not browser-local.
- **AC-3 [test]** A **signed-out** attempt to WRITE/save a view is **refused at the server** (a real
  auth refusal), even if a client guard is bypassed or absent; **nothing is persisted**. (This is the
  `server-side-gate-enforcement` catch — the user-accounts AC-E7 precedent.)
- **AC-4 [review]** Every scan/universe/view **READ** is available to anonymous users and never gates
  behind sign-in; reads are the anonymous-open, best-effort domain (only WRITES are gated).

**Honesty & degradation**
- **AC-5 [test]** When one universe symbol's compute fails, **only that row** shows `error`/`stale`;
  every other row still renders its data — the table does not blank, 5xx, or lose neighbors.
- **AC-6 [test]** When the sweep worker is down/behind (stale or absent heartbeat), the scanner still
  serves the **last-known rows** with a worker-down banner ("sweep last ran X ago") and returns a
  normal (non-5xx) page — a worker death cannot take the web page down.
- **AC-7 [review]** A stale row shows its **frozen price with its as-of stamp and a `stale` status** —
  never a fabricated or silently-refreshed "fresh" price.
- **AC-8 [review]** A universe symbol not yet computed shows as **`building`** (present, not-yet-scored,
  honest) — not as an error, not with a fabricated score, not hidden.
- **AC-9 [review]** The scanner table never uses the word **"live"** and presents no per-row stream; its
  only motion cue is the sanctioned price-change emphasis, and the page states its two-speed cadence
  basis plainly.

**Consumption fidelity & navigation**
- **AC-10 [test]** For any tracked symbol, the **score and tier shown on the scanner row match the score
  and tier the Ticker page shows** for that symbol from the same compute (the scanner consumes, never
  re-derives). The presence or absence of the scanner leaves the engine's score/tier/gate
  byte-identical.
- **AC-11 [review]** Clicking a row lands on **the correct Ticker page for that symbol** and performs no
  order/trade/broker action of any kind.
- **AC-12 [review]** The warm-click makes a tracked symbol's Ticker page fill faster when possible, and
  a cold/stale case lands on the normal Ticker page — with **identical page content** either way (warmth
  is a speed-only difference).

**Data integrity of the universe**
- **AC-13 [review]** The view editor can only select from the **current owner-curated universe**; there
  is no in-app path to add, request, or remove universe symbols in v1.

---

## 5. Product decisions made here (resolving ARCHITECTURE_CONTRACT §10)

**D1 — Per-account view storage locus (Q1): EXTEND the existing settings record (single view per
account in v1).**
v1 stores exactly **one view per account** as an additional field on the existing per-user settings
record, behind the existing auth-settings ports, server-gated on writes (honoring the architecture's
only mandate). Rationale: the view is small, score-neutral, per-account-isolated state of the same
character as the three existing light prefs (persona/ticker/theme); a dedicated new gated store leaf is
unwarranted complexity for a single view. **Seam:** if v1 grows to *multiple named* views (the positions
saved-views shape), a dedicated gated leaf becomes the right move — recorded as a future seam, not built
now. This stays a recommendation at the product/complexity layer; if the Architect judges the settings
record a poor fit, that is a §Deferred-to-Interface refinement within the same "behind the auth-settings
ports" mandate, not a scope change.

**D2 — Default-view definition (Q2): owner-curated explicit list PRIMARY; top-20-by-current-score
fallback when unset.**
The anonymous/new-user default view is an **owner-curated explicit symbol list** (part of the same
owner config as the universe — see D3). **When that list is unset, fall back to the top 20 universe
symbols by current score**, recomputed deterministically per request from the store (no per-user
state). **N = 20** for v1. **Honest empty/building behavior:** if the store holds no computed rows yet
(fresh universe), the default view shows its configured symbols (or, in fallback, the universe symbols)
in **`building`** state — never a dead empty screen and never a fabricated ranking. A signed-in user
with a deliberately-empty saved view is the only "empty view" case (the "pick tickers" affordance).

**D3 — Universe-config mechanism (Q4): a checked-in JSON config file in the repo; "edit + redeploy/restart
worker" is the v1 operational story; 50–100 confirmed as the v1 ceiling.**
The 50–100 tracked universe (and the D2 default-view list) live in an **owner-curated, checked-in JSON
config file**, read by the worker at start. Rationale: universe membership is **not a secret** (so
`[no-secrets-in-image]` is not engaged for it — real secrets stay runtime env-injected), it is a
deliberate curation act that benefits from **git review + provenance**, and a 50–100-symbol list is
unwieldy as env vars. **Operational story (owner):** edit the JSON, redeploy/restart the worker; the
change takes effect on the next worker start (no hot-reload in v1). **Ceiling: 50–100 confirmed for
v1** — a baseline full pass is ~2–3 min at N=100; materially exceeding 100 would degrade freshness and
requires re-evaluating the pass-time budget (a future decision, not a v1 knob).

**D4 — Move-detection threshold + cadences + promotion cap (Q5): configurable defaults.**
These are **operator-configurable defaults**, stated here as the v1 shipping values:
- **Move threshold X = 0.75%** (a symbol whose price moved > X since its last compute is promoted in
  the sweep queue).
- **Fast-lane poll ≈ 30s** (prices + move detection for the whole universe in one poll).
- **Slow-lane full pass ≈ 2–3 min at N=100** (the baseline structure cadence).
- **Promotion queue is capped with round-robin fairness** so a market-wide move degrades to the base
  cadence rather than a thundering herd; the cap is a configurable default sized to a small fraction of
  the universe per cycle (the exact number is an ops tunable, not a product commitment). The
  product-binding property is the **fairness guarantee**, not any specific cap value.

---

## 6. Deferred (with binding product constraints attached)

- **Q3 — Freshness / cadence copy → UX.** Product intent + honesty requirement fixed here (§3.5): the
  table must be **self-describing** per `[model-read-carries-its-assumptions]` — a per-row as-of +
  status, a plain-language two-speed basis (fast prices · slower structure · hot names sooner), and a
  "sweep last ran X ago" worker-down signal. **The exact words are UX's**; the constraint is that no
  wording may imply more freshness than exists and the word "live" is not used on the table.
- **Q6 — Column set / sort / density defaults / mobile card shape → UX.** The **content that must be
  visible** is fixed (§3.1) and default sort is by-score-best-first (§3.1); the **layout, column order,
  density, and the sub-`sm` card-collapse shape** are UX's (referencing the design system + the
  Positions card-collapse pattern). Constraint: nothing product-required (§3.1) may be dropped from the
  visible row, and the four honest states must all be expressible in whatever layout UX chooses.
- **Q7 — Endpoint shapes + wire field names + the conformance spec → the Interface Contract (GATE U·X).**
  Deferred entirely. Constraint: reads stay anonymous-open + best-effort (200 + status, never a 5xx for
  scan trouble); the view WRITE returns a real auth refusal when signed-out; the closed status
  vocabulary (`ok`/`stale`/`error`/`building`) and the other closed enums are authoritative on the wire
  and rendered via closed FE lookup, never re-derived.

---

## 7. Invariant restatement (only the invariants this product layer touches)

- **`[additive-keeps-score-byte-identical]`** — product-observable as **AC-10**: a scanner row's
  score/tier match the Ticker page's for the same symbol/compute, and the engine's score/tier/gate are
  identical whether the scanner exists or not. The scanner **consumes** these; they are **never** a
  scanner input.
- **`[best-effort-isolated-or-null]`** — a per-row failure degrades that row alone (AC-5); a
  store/worker outage yields an honest degraded page, never a 5xx (AC-6). **Carve-out: view WRITES are
  the one gated, state-bearing action and return a real auth refusal** (AC-3); every READ stays
  anonymous-open + best-effort (AC-4).
- **`[live-vs-static-isolation]`** — poll-based rows with a declared basis; **no SSE, no per-row
  streams, never "live" on the table** (AC-9).
- **`[server-side-gate-enforcement]`** — a view WRITE is refused at the server even if the client guard
  is bypassed/absent (AC-3); the FE check exists for UX only.
- **`[no-real-order-path]`** — the scanner is **display + links only**; a row-click navigates and does
  nothing else (AC-11). No broker/order/execution path anywhere.
- **`[model-read-carries-its-assumptions]` + `[digested-labels-not-raw-dump]`** — every row is
  self-describing (per-row as-of + status + the two-speed basis, §3.5); statuses/regimes/tiers are
  **closed labels rendered via a fixed lookup, never re-derived**, and no raw series ride a row
  (AC-7/AC-8/AC-9).

(Math/code-level invariants — the split gamma sources, the one-way-leaf import boundary, the worker's
config-via-env — are the Architect's/Interface's and are NOT restated here.)
