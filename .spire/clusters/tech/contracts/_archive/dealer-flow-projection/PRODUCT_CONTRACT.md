# PRODUCT CONTRACT — Dealer-Flow Projection

> Producer: Product Manager (this session). Consumer: UX/Tech-Writer (next role).
> Reader has ONLY `.spire/clusters/tech/context/PROJECT_CONTEXT.md` + this file. No chat history.
> Input: the locked `ARCHITECTURE_CONTRACT.md` (the technical shape is GIVEN — the goal is DERIVED
> from it, not re-scoped). Lane: user stories, feature scope (In / Out / Future), dashboard behavior,
> acceptance criteria (each = a required behavioral test), and resolution of the Architect's 8 open
> questions. **NO UI layout, NO endpoints, NO payload/JSON field names, NO copy, NO math derivations,
> NO thresholds-as-code** — those are the UX / Interface / Executioner lanes.

---

## 1. Feature & user value (goal, derived from the ARCHITECTURE_CONTRACT)

A swing trader watching a single ticker today sees where dealer **gamma** structure pulls price
(GEX walls, flip, magnet) and a static positioning/vol picture (DEX, Vol/OI, skew, term). What is
missing is **when and why dealers will be pushed to hedge** — the forward-looking flow the option
structure already implies but that we currently compute and throw away.

This feature turns the already-computed net charm + net vanna into a single **projected
dealer-hedging-flow read** with two limbs, surfaced with its assumptions visible:

1. **Charm limb** — the delta dealers must buy/sell as **time passes** toward the next monthly OPEX,
   holding spot and vol constant. The "time-decay drift into OPEX" read.
2. **Vanna limb** — the delta dealers must buy/sell **if implied vol moves** a stated amount. The
   "what a vol move does to dealer hedging" read.

Net value: it is the **"when/why dealers push"** — distinct from the static GEX levels' **"where
price is pulled."** It is an **additive, advisory CONTEXT read**: it enriches the state export the
downstream AI consumes (improving the AI's TIMING + conviction around dealer-flow catalysts) and it
is displayed to the trader on the ticker page. It **never** touches `opportunity_score` /
`opportunity_tier` / the entry gate / `state_fingerprint`. It is a **projection under STATED
assumptions**, surfaced with those assumptions VISIBLE and framed as **dealer-hedging-flow context —
not a price forecast, not a scored signal, not a guarantee** — exactly the honesty posture the
analytic gamma flip is surfaced with.

---

## 2. User stories

**The two anchor stories (what the trader sees / what the AI gets):**

- **(Trader sees)** As a swing trader, I want a **projected dealer-flow read on the ticker page** —
  the delta drift dealers must hedge into the next monthly OPEX (charm) and the delta shift if vol
  moves (vanna) — so I can time entries/exits around dealer-flow catalysts I couldn't see before,
  **with the assumptions it was projected under stated right there** so I never mistake it for a
  price call.
- **(AI gets)** As a trader relying on the in-app / hand-off AI recommendation, I want this projected
  flow to **travel in the same state the AI reads** so its rationale can cite the read (e.g. "charm
  flow supports upward drift into Friday's OPEX") to sharpen TIMING and conviction — **without it
  ever changing my opportunity score or gate.**

**Supporting stories:**

- As a swing trader, I want the charm limb to tell me the **cumulative expected delta drift to the
  next monthly OPEX** and to show me **how many days that is and the exact OPEX date**, so I know
  what horizon the number is projected to.
- As a swing trader, I want the vanna limb quoted **per a stated vol move** (the base being a +1
  IV-point move) so I can read the magnitude and direction of the dealer-flow that a vol move would
  trigger, and scale it in my head to a bigger move.
- As a swing trader, I want the read to **carry its own assumptions** — that charm is projected
  linearly holding spot & vol, that vanna is quoted for a vol increase and is scalable/negatable, and
  that the whole thing is a dealer-flow projection and **not** a guarantee — so I can never consume
  the number without its frame.
- As a swing trader, I want each limb to **degrade independently and quietly** — if only charm can be
  computed I still get charm, if only vanna I still get vanna, and if neither is available the read
  says so plainly rather than showing a fabricated zero — and I want the rest of the dashboard
  unaffected either way.
- As a swing trader, I want this read to be **stable while I analyze** — a snapshot read that changes
  only when a new bundle loads, that **does not flicker off the live stream** and **does not go
  offline/dimmed** when the live feed drops (unlike the price/flow tiles).
- As a swing trader, I want the read to be **honest when the window I selected doesn't reach the
  monthly OPEX** — it still targets the monthly OPEX and shows me the horizon and target date, so a
  window/horizon mismatch is visible to me, not hidden.
- As the trader consuming the AI (in-app or via the manual copy-paste hand-off), I want a
  **glossary entry** the AI can rely on that defines this read, its units, its assumptions, and its
  caveats, so the AI reads it correctly and never treats it as a scored or guaranteed signal.

---

## 3. Scope

**In:**

- A **single projected dealer-flow read** riding the existing cached bundle's market-state, with two
  independently-nullable limbs:
  - **Charm limb** — the projected cumulative delta drift to the next monthly OPEX, plus the
    per-day charm base it is built from.
  - **Vanna limb** — the projected delta change for a stated vol move (base = +1 IV point).
- The read is **self-describing**: it carries the horizon (**how many days** and the **target monthly
  OPEX date**), the vanna vol-move assumption (**the assumed move size** and its **reference
  direction** = a vol increase), the spot basis it was computed at, and — via UX copy/glossary — its
  linear/first-order nature and its "not a guarantee / not a price forecast" framing.
- The read is **window-scoped** — it moves with the trader's selected DTE/expiration window (the same
  window the gamma structure / DEX use), not the full chain.
- The read is a **STATIC bundle read**, refreshed only on the ~60s REST poll, behind the existing
  freshness/`stale` signaling.
- The read is added to the **downstream-AI state export** with **no serializer change** (it rides the
  same market-state the export already forwards wholesale) — it enriches both the in-app AI rec and
  the manual copy-paste hand-off.
- A **downstream-AI glossary entry** (`market_state_glossary.md`) is an **explicit deliverable** —
  field-level reference: what each limb measures, its units, its assumptions, and its caveats.
- **Best-effort + independent per-limb degradation:** any failure yields an "unavailable" state, not
  an error; the two limbs degrade independently; the rest of the dashboard is unaffected.
- The **higher-order-greek float-determinism fix** is folded in (an engine-internal, math-invariant
  change to how the higher-order-greek aggregates are summed) — a build obligation with a
  **byte-identity re-proof** requirement on the score outputs (see §5, §6 open-question 8, and the
  ACs).

**Out (v1 non-goals — do not silently narrow, do not add):**

- **Any scoring / gate / setup / tier / fingerprint effect.** The read never feeds
  `opportunity_score`, `opportunity_tier`, the entry gate, or `state_fingerprint`; no confluence
  bonus, no setup, no tier nudge. Display + AI-context only. (HARD invariant — see §7.)
- **Any price-direction claim or "trade this" instruction.** It is dealer-hedging-flow context, never
  a forecast, a verdict, or a guarantee.
- **Any live-derived behavior.** No live-vol or live-spot fold-in, no SSE path, no `⏸ offline`/dimmed
  state. It is declared **static**.
- **Path-accurate charm re-integration.** The charm limb is the linear, first-order projection; a
  path-accurate integral across a time grid is a named future seam, not this feature.
- **Elevating the volga (vol-convexity) aggregate.** Volga stays display-only; it is touched by the
  determinism fix only because it shares the same summation loop, and gains **no projection** in v1.
- **Any change to gamma sourcing, the walls/profile, the gamma flip, or any scored aggregate.** No
  third gamma source, no re-unification of the vendor-vs-analytic split; the determinism fix is
  confined to the charm/vanna/volga aggregation.
- **Any new vendor dependency or network I/O, any new endpoint.** It reuses aggregates already
  computed + the monthly-OPEX date already derived; it rides the existing bundle's market-state.
- UI layout, component states/naming, endpoint/payload shapes, copy, and math — downstream lanes.

**Future-dated (named seams, explicitly deferred — not this feature):**

- **Path-accurate charm re-integration** (re-pricing the chain across a time grid).
- **A vol-convexity / IV-of-IV read off the volga aggregate** (volga's own projection).
- **A vanna-limb second horizon or multi-scenario surface** beyond the illustrative larger move
  decided in §6 Q3 (e.g. a full user-adjustable vol-move slider).
- **A live/real-time projection variant** that folds in live vol/spot (explicitly rejected for v1 as
  it would break the snapshot-pinned honesty posture — a deliberate owner decision if ever revisited).

---

## 4. Product decisions made here (resolving the Architect's 8 open questions, in order)

1. **Wire/JSON field names + nesting name** — **NOT decided here** (interface-split lane, per the
   Architect). This contract fixes the product concepts and their meaning, not the payload keys. I
   name the product concepts: the **projected dealer-flow read**, its **charm limb** and **vanna
   limb**, the **horizon** (days + monthly-OPEX target date), the **per-day charm base**, the
   **assumed vol move** (size + reference direction), and the **spot basis**. Interface owns the keys.

2. **Transport & endpoint shape — CONFIRMED: no new endpoint.** Product scope is that the read rides
   the **existing cached bundle's market-state** and flows into the AI state export / manual hand-off
   with no serializer change, exactly as the Architect scoped. **No new endpoint, no new fetch, no new
   request flag** is wanted. It is always-on (like the four positioning metrics), not toggled.

3. **Vanna-limb vol-move magnitude(s) surfaced — DECIDED: base +1 IV point AND one illustrative
   larger move.** The base, primary quote is the **+1 IV-point** move (the natural unit). The product
   **also surfaces one illustrative larger move so the trader can see the scale of a realistic vol
   spike without doing the arithmetic** — a **+5 IV-point** illustrative figure (a meaningful
   vol-shock magnitude for the swing horizon). This is **pure linear scaling of the same value — no
   new computation.** Rationale: a lone "+1 pt" number under-communicates the real-world flow a vol
   event drives; one clearly-labeled larger figure makes the magnitude legible while keeping the
   surface simple. **Constraint for UX:** both figures must be **unmistakably labeled with the move
   they correspond to** (+1 pt vs +5 pt) — the trader must never be unsure which magnitude a number is
   quoted at. (A full user-adjustable vol-move control is Future-dated, §3.)

4. **Vol-DECREASE read alongside the base vol-increase quote — DECIDED: state the direction and the
   negation, do not add a separate decrease figure.** The base read is quoted for a vol **increase**
   (+Δσ). The product requirement is that the read **states its reference direction (a vol increase)
   and communicates that a vol decrease is the negation** (same magnitude, opposite sign), so the
   trader/AI is never guessing the sign. We **do not** surface a second, separately-computed
   decrease figure — it is exactly the negation and a redundant number adds clutter. Rationale: the
   honesty requirement is that the direction is legible, not that both directions are printed;
   labeling "+ = vol up; a vol drop flips the sign" satisfies it without noise. (This is a copy/UX
   requirement; the words are UX's, the intent is binding.)

5. **Display placement, tile/section shape, chart-vs-numeric, chip labels, and all copy — UX lane.**
   I do not set layout. Product intent (binding on UX): the read lives on the **ticker viewer page**
   alongside the other dealer-positioning/static reads (it is a static positioning read of the same
   family as DEX/GEX, not a live tile). It must communicate, at minimum: the **two limbs** (charm =
   drift-into-OPEX, vanna = per-vol-move), each limb's **magnitude and direction/sign**, the
   **horizon** (days + OPEX date) for charm, the **assumed vol move(s)** for vanna (+1 pt and the +5
   pt illustrative, §Q3), and the **assumptions frame** (linear/first-order; vol-increase reference
   with decrease = negation; "dealer-flow context, not a forecast, not a guarantee"). It must be
   visually of the **static-read family** (never styled/placed as a live tile). Copy is UX's.

6. **Acceptance criteria** — authored in full in §6 below, covering: score byte-identity (with the §5
   determinism fix), per-limb null states, whole-read-null state, the static/no-offline behavior on an
   SSE drop, the horizon = monthly-OPEX derivation (incl. the window-excludes-OPEX case), and the
   assumptions-visible requirement.

7. **Glossary entry for the downstream-AI `market_state_glossary.md` — SCOPED as an explicit
   deliverable (owned by UX/Tech-Writer).** One entry defining the projected dealer-flow read: what
   each limb measures, its **units** (dollar-delta; per-day for the charm base, per-IV-point for the
   vanna base), its **assumptions** (charm linear/first-order holding spot & vol to the monthly OPEX;
   vanna per a stated vol move, vol-increase reference, negatable/scalable), and its **caveats**
   (advisory context, **not** a scored input, **not** a price forecast, **not** a guarantee; its
   reliability tier stated alongside the existing reads). This entry is **mandatory** and is traced by
   AC-15.

8. **Determinism-fix regression scope — SCOPED as an explicit, HARD AC.** The fix that makes the
   higher-order-greek aggregates order-independent lives in the engine that feeds `signals`, so the
   product requirement is a **re-proof** that `opportunity_score`, `opportunity_tier`, the gate
   decision, and `state_fingerprint` are **byte-identical after the fix** — for the same input
   snapshot, both (a) with-vs-without the projection object present and (b) before-vs-after the
   determinism change. Traced by AC-11 (additive byte-identity) and AC-12 (post-determinism-fix
   byte-identity re-proof).

---

## 5. Behavior rules

### Charm limb (expected delta drift into the next monthly OPEX)
- Shows the **projected cumulative delta drift** dealers must hedge from time-decay alone **to the
  next monthly OPEX**, holding spot and vol constant, plus the **per-day charm base** it is built
  from.
- Carries its **horizon**: the number of **calendar days** to the next monthly OPEX (≥ 1) **and the
  exact target OPEX date**. The horizon and target date are **always shown with the charm limb** so
  the projection is inspectable.
- Is **window-scoped** — built from the charm aggregate over the trader's **currently selected
  DTE/expiration window** (moves with the window, like GEX/DEX).
- **Window-excludes-OPEX case (binding):** if the selected DTE window does **not** reach the next
  monthly OPEX, the charm limb **still targets the monthly OPEX** and **still surfaces the horizon +
  target date**, so the window/horizon mismatch is **legible, never silent**. It is intentionally
  "the flow the currently-selected window will generate by that date."
- **Sign/direction** follows the existing signed dealer-book convention (no new sign math). Direction
  must be legible (which way the drift leans), framed as flow context, not a price call.
- **Best-effort:** if the charm aggregate is unavailable OR the horizon can't be determined (no
  future monthly OPEX in the chain), the charm limb shows **"unavailable this cycle"** — never a
  fabricated 0 — while the vanna limb and the rest of the dashboard are unaffected.

### Vanna limb (expected delta change per vol move)
- Shows the **projected delta change** dealers must hedge **if implied vol moves**, quoted at the
  **base +1 IV-point** move (the primary figure) **and** the **+5 IV-point** illustrative move (§Q3),
  each **unmistakably labeled with its move size**.
- Carries its **reference direction**: quoted for a vol **increase**; a vol **decrease is the
  negation** (same magnitude, opposite sign). The direction and the negation rule must be legible so
  the sign is never guessed (§Q4).
- Is **instantaneous** — it has no time horizon; its assumption is the vol-move magnitude, not a date.
- Is **window-scoped** like the charm limb (same DTE/expiration window).
- **Sign/direction** follows the existing signed dealer-book convention (no new sign math).
- **Best-effort:** if the vanna aggregate is unavailable, the vanna limb shows **"unavailable this
  cycle"** — never a fabricated 0 — while the charm limb and the rest of the dashboard are unaffected.

### The whole read
- **Independent per-limb nullability:** charm-present/vanna-null and vanna-present/charm-null are both
  valid partial states. The **whole read is "unavailable this cycle"** only when **both** limbs are
  unavailable (or the computation raises) — and even then it shows a **plain "unavailable this
  cycle"** state, **never a fabricated 0 and never an error screen**.
- **Assumptions travel with the read (binding):** the read is self-describing — the horizon (days +
  OPEX date), the vanna move size(s) + reference direction, the spot basis, the linear/first-order
  nature, and the "dealer-flow context, not a guarantee, not a forecast" framing are **present with
  the read**, not buried elsewhere. A consumer (trader or AI) must not be able to read the number
  without its frame.
- **STATIC — excluded from the live-offline treatment (binding):** it is derived entirely from the
  cached snapshot (close-anchored spot, no live vol/spot). On an **SSE drop it keeps rendering the
  last bundle, un-dimmed, with NO `⏸ offline` chip and NO staleness/offline marking** — exactly like
  the four positioning metrics and Net GEX, and **unlike** the live price/flow/spread/flip tiles. It
  refreshes **only** on the ~60s REST poll and behind the existing freshness/`stale` signaling.
- **AI-context + display only:** it rides the state export the AI reads (no serializer change) and is
  displayed to the trader. It **never** feeds `signals`/score/tier/gate/`state_fingerprint`, **never**
  triggers a recompute or vendor fetch, **never** rides the SSE path, **never** auto-acts.
- **Determinism fix (build obligation, product-visible only as stability):** the higher-order-greek
  aggregates become order-independent (byte-stable across identical inputs) so the manual hand-off,
  the in-app export, and cold==warm agree exactly. This is a determinism fix, **not** a value change:
  the surfaced (rounded) numbers are unchanged in every realistic case. It must **re-prove** the score
  byte-identity (AC-12).

---

## 6. Acceptance criteria (each = a required behavioral test; observable WITHOUT reading code)

Presence / display:
- [ ] **AC-1** The ticker viewer shows a **projected dealer-flow read** with a **charm limb** and a
      **vanna limb** that was not present before this feature, in the static-read family (not a live
      tile).
- [ ] **AC-2** The **charm limb** shows a **projected delta drift to the next monthly OPEX** AND its
      **horizon in days** AND the **exact target OPEX date** — all three visible together.
- [ ] **AC-3** The **charm limb per-day base** is shown alongside the projected drift (the trader can
      see what the projection is built from).
- [ ] **AC-4** The **vanna limb** shows the projected delta change at the **+1 IV-point** move AND a
      **+5 IV-point** illustrative figure, **each unmistakably labeled with its move size** (the
      trader is never unsure which magnitude a number is quoted at).
- [ ] **AC-5** The vanna limb **states its reference direction (a vol increase)** and communicates
      that a **vol decrease is the negation** (opposite sign) — the sign is never left to guess; **no
      separate decrease figure is required** to satisfy this.

Assumptions visible:
- [ ] **AC-6** The read is **self-describing**: the **assumptions travel with it** — the horizon (days
      + OPEX date), the vanna move size(s) + reference direction, the **linear/first-order** nature of
      the charm projection, the **spot basis**, and the **"dealer-flow context — not a price forecast,
      not a scored signal, not a guarantee"** framing are present with the read, not buried elsewhere.

Window / horizon:
- [ ] **AC-7** Both limbs are **window-scoped** — they change when the DTE/expiration window changes
      (in step with GEX/DEX), and are **not** full-chain.
- [ ] **AC-8** **Window-excludes-OPEX case:** when the selected DTE window **does not reach** the next
      monthly OPEX, the charm limb **still targets the monthly OPEX** and **still surfaces the horizon
      + target date**, so the mismatch is **legible** (the read does not silently retarget to the
      window edge or hide the horizon).

Per-limb + whole-read degradation (edge cases — each its own AC):
- [ ] **AC-9** **Charm present, vanna null:** when the vanna aggregate is unavailable but charm is
      available, the **charm limb populates** and the **vanna limb shows "unavailable this cycle"** (no
      fabricated 0); the rest of the dashboard is unaffected.
- [ ] **AC-10** **Vanna present, charm null:** when the charm aggregate is unavailable (or the horizon
      can't be determined) but vanna is available, the **vanna limb populates** and the **charm limb
      shows "unavailable this cycle"** (no fabricated 0); the rest of the dashboard is unaffected.
- [ ] **AC-10b** **Whole read null (both aggregates unavailable / computation raises):** the read
      shows a single **"unavailable this cycle"** state — **never a fabricated 0, never an error
      screen** — and the GEX chart, the positioning metrics, and every other stat render normally, SSE
      path intact.

Score isolation (HARD invariant — both required):
- [ ] **AC-11** **Additive byte-identity:** for the same input snapshot, the **opportunity score, the
      opportunity tier, the gate decision, and the state fingerprint are byte-identical with vs
      without the projected dealer-flow read present** (adding the read changes no scoring output).
- [ ] **AC-12** **Post-determinism-fix byte-identity re-proof:** after the higher-order-greek
      summation is made order-independent, the **opportunity score, tier, gate decision, and state
      fingerprint remain byte-identical** to before the fix, for the same input snapshot (the
      determinism fix touches only fields `signals` does not read).

Static / no-offline behavior on an SSE drop (its own AC):
- [ ] **AC-13** **Static on SSE drop:** on a **live-stream drop**, the projected dealer-flow read
      **keeps rendering the last bundle, un-dimmed**, with **NO `⏸ offline` chip and NO offline/stale
      marking** — unlike the live price/flow/spread/flip tiles which dim and show offline. The read
      updates **only when a new bundle loads**, never per-tick.

AI-context enrichment:
- [ ] **AC-14** The projected dealer-flow read is **present in the state the downstream AI consumes**
      (the in-app AI-rec state export AND the manual copy-paste hand-off export both carry it) so the
      AI can cite it — verifiable by inspecting the exported state, **without** any change to score,
      tier, gate, or fingerprint (ties to AC-11).

Glossary deliverable:
- [ ] **AC-15** The downstream-AI **`market_state_glossary.md` has an entry** for the projected
      dealer-flow read defining **what each limb measures, its units, its assumptions, and its caveats**
      (advisory context; not a scored input; not a price forecast; not a guarantee; reliability tier
      stated).

Determinism (product-visible stability):
- [ ] **AC-16** For an **identical input snapshot**, the surfaced projected-flow numbers (and the
      underlying higher-order-greek aggregates) are **byte-stable across repeated computation /
      cold==warm** (no sub-visible ordering jitter) — the manual hand-off, the in-app export, and the
      display agree.

---

## 7. Constraints the next role (UX/Tech-Writer) must not violate (restated binding constraints)

Promoted-canon keys this feature touches (inherited from the BRIEF's Invariant watch — the next role
must honor them without re-reading the ledger):

- **`[additive-keeps-score-byte-identical]`** (HARD) — the read is **AI-context/display ONLY**;
  `opportunity_score`, `opportunity_tier`, the entry gate, and `state_fingerprint` stay
  **byte-identical** with/without it, and re-proven after the determinism fix. UX must **never** imply
  in copy, color, or placement that the read feeds the score, the gate, a setup, or a tier. No
  "edge"/"buy"/"sell"/"bullish"/"bearish" framing.
- **`[best-effort-isolated-or-null]`** — any failure is a **null/"unavailable this cycle" state, never
  an error**; the two limbs degrade **independently**; a fabricated **0 is forbidden** for a missing
  value; the whole-read-null state is a plain "unavailable this cycle," never an error screen.
- **`[live-vs-static-isolation]`** — the read is **STATIC**: on an SSE drop it keeps rendering the
  last bundle **un-dimmed, with no `⏸ offline` chip and no stale/offline marking**. UX must place/style
  it in the **static-read family**, **never** as a live tile, and must not wire it to the live
  watchdog.
- **`gamma-sourcing-split`** — NOT reopened. This is a derived read over the analytic greeks already
  computed; UX copy must not imply a new gamma source or a change to the walls/flip.
- **Honesty posture (binding product requirement)** — the read is **model-dependent and
  forward-looking**: assumptions must be **visible**, the read is framed as **dealer-hedging-flow
  context, never a guarantee, never a price forecast, never a scored signal** — mirroring the analytic
  flip's "immaterial divergence, state-the-model" posture. Copy is UX's; the frame is binding.

Additional product constraints for UX:

- **No new toggle, no request flag** — always-on, rides the bundle (Q2/Q7).
- **Both vanna figures must be labeled with their move size** (+1 pt vs +5 pt); the vanna reference
  direction (vol increase) + the negation rule must be legible (Q3/Q4).
- **Charm horizon (days + OPEX date) is always shown with the charm limb**, including the
  window-excludes-OPEX case (Q6 / AC-8).
- **Glossary entry is mandatory** (Q7 / AC-15).
- **No UI layout / component naming / payload keys / copy locking in this contract** — those are the
  UX + Interface lanes; this contract sets the product rules they must encode.

---

## 8. Amendments bounced to Architect

**None.** Every product outcome required here is buildable under the locked technical shape:
- The +5 IV-point illustrative vanna figure (§Q3) is **pure linear scaling of the same vanna
  aggregate**, which the Architect explicitly scoped as "no new computation" (ARCHITECTURE_CONTRACT
  §2.3).
- The vol-decrease-as-negation framing (§Q4) is the linear negation the Architect already resolved as
  the sign convention (§2.3).
- Every other decision confirms the Architect's stated view (no new endpoint; static; window-scoped;
  determinism fix folded in; glossary deliverable) or lives strictly in the UX/Interface lane.
