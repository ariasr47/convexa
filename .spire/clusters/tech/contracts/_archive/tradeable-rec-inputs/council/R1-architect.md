# R1 — architect position: tradeable-rec-inputs

## Position

### 0. Ground-truth correction the rest of this position stands on

The context pack's §2 describes a FastAPI/Python backend (`main.py`, `src/core/signals.py`,
`chain_store.py`, `ai_recommendation.py`). That tree is `archive/api-python/`. The serving backend is
Rust: `apps/api` (crate `api-rust`, Axum/Tokio) over `libs/quant-engine`. The BRIEF says this; I verified
it and I am designing against the Rust tree only. Three consequences are load-bearing:

- **The chain snapshot really does carry what item 1 needs.** `libs/quant-engine/src/types.rs::Contract`
  carries `strike_price`, `contract_type`, `expiration_date`, `open_interest`, `implied_volatility`,
  `greeks{delta,gamma,theta,vega}`, `volume`, `bid`, `ask`. The Massive REST mapper populates `bid`/`ask`
  for **every** contract on the full chain snapshot from the vendor `last_quote` block (filtered `> 0.0`),
  not only on the tracked-contract path. So "re-exposure at serialization, no new vendor fetch" is a claim
  I can defend, not a hope. Caveat in Risks §R2.
- **The full chain is already in memory and already withheld from the wire.**
  `apps/api/src/state.rs::AnalyticsSnapshot.contracts: Vec<Contract>` is `#[serde(skip)]` — held on the
  warm cache entry, never serialized. `GET /api/contract/{ticker}` is the existing precedent for a
  dedicated read off that field via `load_analytics(state, sym, None, None, false)`, which hits `gex_cache`
  or joins the `gex_flight` singleflight. Item 1 is the same motion at a larger, capped granularity.
- **Several "shipped" precedents the pack cites do not exist in the Rust backend.** `event_calendar` has
  **zero matches** in `apps/api/src`, and `build_bundle` emits a literal `"expirations": []`. The pack's
  claim that `bundle-events` "realizes the wire half of item 4" is true of the retired tree only. My three
  items do not depend on it, but nobody should plan around it.

### 1. Binding constraints, restated in the terms this feature will be judged on

- **`[additive-keeps-score-byte-identical]` (HARD).** Every datum here is AI-context/display. The
  mechanism is not discipline, it is the call graph: `generate_signals` consumes a `MarketState` built by
  `market_state_from_gex(...)`, a function with a **fixed positional argument list** (ticker, price,
  gex_spot, net_gex, walls, peak, flip, max_pain, iv_hv, vwap bands). A value that is not one of those
  arguments cannot reach the score, the gate, or `state_fingerprint`. Stronger still for the risk block:
  `quant-engine` is a **separate crate that does not depend on `api-rust`**, so account data physically
  cannot be linked into the scoring code. Proof obligation: byte-identical score/tier/fingerprint on both
  branches of `build_bundle` (the `dark_pool=true` cached-signals branch **and** the `dark_pool=false`
  re-score branch).
- **`[digested-labels-not-raw-dump]` — the real tension, and the ±15% band does not resolve it.** Do the
  arithmetic: SPY near $640 has $1 strikes, so a ±15% band is ~190 strikes × 2 rights ≈ **380 contracts per
  expiration**, and SPY lists ~5 expirations a week. "±15% band across expirations" is a **four-figure**
  record count. The band bounds nothing on a dense-strike name. What bounds it is a **hard cap** (§2.2).
  The recorded resolution (dedicated endpoint, not bundle) is necessary and **not sufficient**.
- **`[model-read-carries-its-assumptions]`.** Expected move ships with its tenor, DTE, the strike actually
  used and its distance from the anchor, the anchor spot and which spot that is, and its basis. Advisory,
  never a forecast.
- **`[best-effort-isolated-or-null]`.** Governs added **bundle** computations: expected move fails to
  null, bundle still 200. The dedicated endpoint gets the `/api/contract` carve-out shape instead (§4).
- **`[absent-is-not-none]`.** Three distinct not-a-number families here, and each must survive to the
  consumer as a closed state, never as `null` alone: no-NBBO-on-this-contract vs not-computed vs
  not-entered-by-the-owner; and for positions: no-open-positions vs client-sent-nothing vs
  broker-not-connected.
- **`[no-real-order-path]`.** The risk block produces numbers the rec may cite. It sizes nothing, submits
  nothing, and this feature adds **no write path** except the owner's own risk-block save.
- **`[server-side-gate-enforcement]`.** The risk block is per-user server-side state; its write resolves
  the session **before** applying the patch — the mechanism already used by `routes/auth.rs::put_settings`
  (`resolve_session` → `Some(user)` else auth error → `SettingsPatch`).
- **`[live-vs-static-isolation]`.** Every datum here is **STATIC** (chain-snapshot derived). None of it
  rides SSE; none of it degrades on a stream drop.
- **`[structural-over-prose-enforcement]`.** Poison-the-rule tests named in §4.

### 2. Component boundaries and data flow

Shape of the whole thing, in one line: **two pure selectors in `quant-engine`, one cached, one on-demand;
one owner-entered record in the existing auth store; one client-supplied digest that is never persisted;
and one prompt-assembly step that is the only place all four meet.**

#### 2.1 Item 3 — expected move: on the bundle, because it is the only one of the three that is digested

Compute: a pure function in `quant-engine` beside `compute_term_structure` — same inputs
(`&[Contract]`, spot, `as_of`), same nullable-Option return, same "sparse tenors omitted, never faked"
posture. Content per entry: the tenor (expiration + DTE), the strike used and its distance from the
anchor, the straddle price, expected move in dollars and as a fraction of the anchor spot, the anchor spot
value, and a **closed basis enum**.

Three content rulings I will defend:

- **Anchor on `gex_spot`, not the live price.** `gex_spot` is the levels anchor (§3 of the context: walls,
  flip, max pain, and the strike profile all hang off it). Anchoring expected move on the live display
  price makes the % read disagree with the level tiles beside it and makes two calls 20 seconds apart
  produce different numbers against the same pinned rec fingerprint. Cost of my choice: during a fast RTH
  move the move-% is computed off a slightly stale anchor. That is the cheaper error, and it is disclosed
  because the anchor rides the payload.
- **A missing NBBO leg is a different basis, never a silent substitute.** Exactly one fallback is allowed
  (an IV-derived estimate off the ATM tenor IV), and it must arrive under a **different value of the basis
  enum** so a consumer branching on the enum cannot conflate "the market is quoting this straddle at X"
  with "our model thinks X". Adjacent-strike substitution is allowed only within the same basis and only
  because the strike-used and its distance are both on the payload.
- **Up to 3 tenors, not 1.** "Expected move by Friday" and "by the September expiry" are different trades,
  and a rec that names an expiration needs the move for **that** expiration. Selection: the nearest tenor
  at or above a DTE floor, plus the tenor(s) bracketing the request's active DTE window. Cap 3.

Placement: an additive nullable member of `market_state`, attached the way `iv_rank` / `market_context` /
`dealer_flow_projection` already are — computed into `AnalyticsSnapshot` during `compute_analytics`,
emitted in `build_bundle`'s `market_state` object. **Why the bundle and not the new endpoint** (this is the
apparent inconsistency with item 1, and it is deliberate): the in-app rec prompt is assembled server-side
and forwards `market_state` **wholesale** (`services/llm.rs::build_rec_prompts` passes
`bundle.get("market_state")`). A read that is ~3 objects of ~8 scalars costs nothing there and reaches the
model for free. A read that is 380 records per expiration does not. The dividing line is **size and
digestion**, not tidiness — that is precisely the line `[digested-labels-not-raw-dump]` draws.

Cost check: this rides the snapshot, and `AnalyticsSnapshot` is **cloned on every cache set and every
cache hit** (`gex_cache.set(snap.clone())`). Three small structs per snapshot is a rounding error. Sixty-
four candidate records would not be — which is the mechanical reason for the next section's split.

#### 2.2 Item 1 — candidate contracts: off-bundle, on-demand, hard-capped by a constant

Compute: a second pure selector in `quant-engine` taking the chain, the anchor spot, a band, a DTE window
and the caps; returning a bounded, ranked candidate set. **Not stored on the snapshot** — it is
parameterized per request (band, DTE window, right) and would multiply the per-request clone cost above.
It is recomputed from `snap.contracts` at read time; that is an O(chain) scan of an in-memory vector,
microseconds, against a chain fetch of seconds.

**The cap is the feature.** My proposed constants, stated as numbers so R2 can attack them:

- ≤ **4 tenors** (nearest to, and inside, the caller's DTE window),
- × **2 rights**,
- × ≤ **8 strikes** per (tenor, right), nearest the anchor and inside the ±15% band,
- = **≤ 64 records** for the dedicated read. At ~200 bytes of JSON each that is ~13 KB.
- The **prompt** budget is tighter: ≤ **1 tenor × 2 rights × 6 strikes = 12 records** (~2.5 KB, roughly
  600–800 tokens), because the in-app rec is a single-turn call whose whole context is one string.

Enforcement must be structural, not a comment: the cap belongs in the **return type or the constructor**
of the candidate set (a total function that cannot emit more than N, e.g. a wrapper type whose only
constructor truncates), so an implementer who loops without a bound cannot compile a violation. The
poison test: raise the cap in a test build and assert the guard bites; and a source scan asserting the
candidates module is **not referenced** from the bundle path (`routes/market.rs`), mirroring the
`broker-option-grouping` import allow/deny stack and the `outcome-ledger` `?raw` scan.

Content per candidate: identity (expiration, strike, right); liquidity (open interest, session volume,
bid/ask when present, and the spread both absolute and relative to mid); greeks + IV as the vendor gave
them; DTE and distance-from-anchor; and a **quote-presence state** distinguishing "this contract carried no
NBBO in this snapshot" from "we did not look". Plus, at the set level: the anchor spot and its basis, the
snapshot age, and — this is the `absent-is-not-none` obligation people will skip — **how many contracts in
the band were dropped and under which reason**, over one closed vocabulary. A consumer must be able to
tell "the band held 380 and you are seeing the 64 most relevant" from "the band held 64". Without that
count, a capped set reads as an exhaustive one and the AI will claim the chain is thin when it is not.

Ranking (the thing that makes a cap defensible rather than arbitrary): nearest-to-anchor first, with
zero-OI-and-zero-volume contracts excluded from candidacy entirely and counted as dropped. Ranking by
liquidity instead would surface a far-OTM high-OI wall strike over the ATM contract the rec will actually
name; ranking by distance keeps the set *about the trade being considered*.

Source rule: **chain-snapshot NBBO only**, declared STATIC. Never the live NBBO stream, never a per-
contract live subscription. That keeps the vendor cost at zero and keeps the whole set consistent with one
`as_of`.

#### 2.3 Item 2 — the risk block and the open-positions digest are two different things and must not be one

**(a) The risk block** is owner-entered, per-user, server-side, and belongs on the existing per-user
settings record (`services/auth/store.rs::SettingsRecord` + `SettingsPatch`, both adapters: the disk-JSON
store and Postgres). Content: account equity, a per-trade risk cap, and an optional portfolio-level
concurrent-risk ceiling.

- **Store exactly one authoritative representation per fact.** The per-trade cap is a **fraction of
  equity** plus an optional **absolute dollar ceiling**; the effective dollar cap is *derived* as the min
  of the two whenever both inputs exist. Storing "1% and also $500" as two independent stored truths
  guarantees they diverge the first time equity changes.
- **`Option<T>` everywhere, and 0 is a legal value.** "Not entered" and "entered as zero" must be
  different; encoding unset as 0 is the exact failure `[absent-is-not-none]` names. The derived dollar cap
  is computed only when its inputs exist, and otherwise carries a stated not-entered state — never a 0 the
  AI can multiply.
- **Migration.** Both stores hold existing records without these fields. The disk-JSON adapter must read
  an old record without faulting (serde defaults on the new optional fields); Postgres needs a nullable
  column add. This is the server-side analogue of `[loss-free-durable-migration]`: a settings record that
  fails to parse must degrade to defaults **without overwriting the original blob**.
- Write gate: server-enforced by the existing session-resolve-then-patch mechanism. No new gate design.

**(b) Open-positions context.** Three sources exist and only one is right:

| Option | Mechanism | Verdict |
|---|---|---|
| A. Client sends a bounded digest with the rec request | FE derives from its own `convexa.positions.v3` store | **Chosen** |
| B. Server parses `/api/book` | The stored blob is **explicitly opaque** ("Blob is opaque to the API (v3 FE shape)"), latest-wins, Postgres-only, and migrates on the FE's schedule | **Rejected** |
| C. Server reads the broker book | Typed, server-side, real | **Additive when present, never the sole source** |

B is rejected on a named mechanism, not taste: making the backend parse `PersistShapeV3` couples the Rust
serving path to a client durable schema that has already migrated v1→v2→v3 and will migrate again, and
the blob only exists on Postgres builds for users who synced. C is genuinely useful but structurally
incomplete for exactly this feature's instrument class: Webull supplies **no option contract detail**, so
an option position arrives `partial` — you cannot compute exposure-in-this-underlying from it with any
honesty. So: A is primary, C rides alongside **labelled by source**, and neither is ever persisted
server-side (persisting a client-supplied digest would create a shadow book nobody reconciles).

Digest content — small, because `[digested-labels-not-raw-dump]` applies to the book as hard as to the
chain: (i) exposure in **this** underlying — a direction label, leg count, nearest-expiry DTE, and defined
max loss when the position is in the eligible closed set, else the stated ineligibility reason the FE
already computes; (ii) portfolio-level open count and total capital at risk; (iii) the source label and a
per-source state. Not the book. Not per-leg fills. Not P/L history.

The three states that must not collapse: **no open positions** / **the client sent no digest** (old
client, disabled, faulted store) / **broker not connected**. Collapse them and the app tells a trader with
a faulted store "you have no exposure" — a fabricated claim about their own money.

### 3. "A dedicated endpoint the AI pulls deliberately" — the mechanism, named

The recorded resolution says the AI *pulls*. In the current architecture the in-app AI **cannot pull
anything**: `services/recommendation.rs` builds one prompt and calls `complete_strategy` once —
single-turn, no tool use, no network egress from the model back to us (`max_tokens: 2048` is the output
cap). So the phrase resolves into two different mechanisms depending on which consumer you mean, and
conflating them is how this feature ships without item 1 ever reaching the rec:

1. **External / hand-off AI** (the copy-paste floor, and any agent the owner drives): the pull is literal.
   The dedicated endpoint is a URL it fetches on purpose. Nothing to build beyond the endpoint.
2. **In-app rec**: the pull is made **by the prompt assembler on the model's behalf** — a deliberate,
   separate, tighter-budgeted selection step inside `build_rec_prompts`, distinct from the wholesale
   `market_state` forward. It is still "deliberate, not bundle payload": the bundle never carries the band,
   the SSE never carries it, and a bundle consumer that does not ask never pays for it.

If the council wants the model to genuinely pull (tool-use / multi-turn), that is a **different feature**
with a different cost profile (an agentic loop, per-provider tool schemas across five providers, a
per-turn budget, and a new egress path) and I would defer it. I am asserting mechanism (2) and flagging
that it is an interpretation, not a reading, of the recorded resolution — R2 should attack it if PM meant
otherwise.

### 4. Isolation and error rules

- **The dedicated read never degrades the bundle or SSE.** Mechanically true: it is a separate route
  reading the same warm cache through `load_analytics`, sharing the singleflight rather than adding a
  fetch. Worst case on a cold miss is that it performs the chain fetch the bundle would have performed;
  concurrent callers coalesce.
- **Error class for the dedicated read follows the `/api/contract` carve-out, not the null rule.** A real
  not-found for "this ticker has no chain at all"; **everything else is a 200 with a stated state** —
  empty band, all-candidates-dropped, no-quotes-in-snapshot. `[best-effort-isolated-or-null]` governs
  *bundle* computations; a dedicated resource that cannot find its subject is allowed to say so, exactly as
  the tracked-contract lookup already does.
- **Expected move follows the null rule strictly:** any failure ⇒ that member is null, bundle still 200,
  `market_state`/`strike_profile`/SSE untouched.
- **The risk block keeps the auth carve-out:** auth-subsystem failures return real statuses on the auth
  routes; a risk block that cannot be read at rec time degrades the rec to the not-entered state and never
  fails the rec.
- **Poison tests that must go red** (`[structural-over-prose-enforcement]`, non-vacuity asserted):
  1. Feed the candidate selector a chain that would emit more than the cap ⇒ the guard truncates and the
     assertion fires; raise the cap in the fixture and prove the test can fail.
  2. Reference the candidates module from the bundle path ⇒ scan test red.
  3. Add expected move (or any risk-block value) to `market_state_from_gex`'s argument list ⇒
     fingerprint-identity test red.
  4. Encode "unset" as 0 anywhere in the risk block ⇒ a type that has no zero-means-unset inhabitant.

### 5. Explicit non-goals

- No new vendor call, endpoint, or entitlement. Zero incremental vendor spend is a **verified** property
  of the chain mapper, not an aspiration.
- No order, broker, or execution path. The risk block sizes nothing and submits nothing.
- No change to `opportunity_score`, `opportunity_tier`, the entry gate, or `state_fingerprint`; no new
  input to `signals`; `quant-engine` never learns what an account is.
- The candidate band never rides the bundle, the slices, or SSE.
- No persistence of candidates, expected move, or the positions digest. No new store; the `iv_store`
  accumulation precedent is deliberately **not** extended here.
- No live/streamed option quotes. Chain-snapshot NBBO only, declared static.
- No spread construction or spread pricing on the server. The server supplies candidates; composing legs
  is the model's job and the FE's existing multi-leg model's job.
- No prompt rewrite beyond inserting the named blocks. Grounding/citation enforcement is `ai-rec-grounding`,
  the named successor.
- Item 4 (event calendar) is **not** in scope, notwithstanding that the Rust backend lacks it.

## Risks I see

- **R1 — Planning on a stale map.** The context pack's architecture section describes a backend that no
  longer serves traffic. Anyone estimating against `main.py`/`chain_store.py`/`ai_recommendation.py` will
  mis-scope. Concrete casualty already visible: `event_calendar` is absent from `apps/api/src` while the
  pack lists it as shipped and as satisfying item 4.
- **R2 — NBBO coverage is `Option`, and I have not measured the fill rate.** `bid`/`ask` are filtered
  `> 0.0` and `GET /api/contract` documents an `option_quote: null` outcome. If the vendor tier populates
  `last_quote` for only a fraction of chain rows, item 1's liquidity story thins and item 3's straddle
  basis falls through to the IV estimate more often than expected. The feature stays *honest* either way —
  it degrades to stated states, not wrong numbers — but its **value** degrades. Falsifiable pre-commit
  check: count non-null quote pairs in one live SPY chain snapshot and one thin single-name.
- **R3 — The cap becomes a negotiation.** 64/12 are my numbers. If they drift upward during
  implementation, `[digested-labels-not-raw-dump]` fails quietly — nothing goes red, the AI just gets
  worse. This is why the cap must be a type-level constant with a poison test, not a config knob.
- **R4 — Prompt budget is unmeasured.** Adding candidates + risk block + positions digest to a single-turn
  prompt that today carries `market_state` + `signals` + `ai_eval` will materially change the input size.
  I have asserted ~600–800 tokens for the candidate block; nobody has measured the current prompt. If the
  total lands somewhere that degrades attention, the rec gets *worse* from better inputs — the exact
  inversion the BRIEF warns about.
- **R5 — Anchor divergence.** If any consumer computes expected-move % off the live price while the
  payload is anchored on `gex_spot`, two numbers for the same fact appear on one screen. Mitigation is the
  anchor riding the payload; the residual risk is a consumer ignoring it.
- **R6 — Snapshot clone cost** if anyone stores candidates on `AnalyticsSnapshot`. Every cache hit clones
  it. This is a quiet per-request regression that no test would catch.
- **R7 — Settings migration on two adapters.** Disk-JSON and Postgres both hold live records. A record
  that fails to parse must degrade to defaults **without** overwriting the original — the server-side echo
  of the client-side rule promoted at severity 1.
- **R8 — The digest is client-supplied and unverifiable.** Acceptable (it is context for the trader's own
  call), but it must never be echoed back as server-authoritative and never persisted. If either happens,
  it becomes a second book that disagrees with the first.
- **R9 — Byte-identity has two branches.** `build_bundle` re-scores when `dark_pool=false`. A proof run
  only on the default branch is not a proof.
- **R10 — Better inputs converting `no_trade` into trades.** Not a lane risk I can fix structurally, but I
  can supply the measurement surface: every number the rec cites here is bundle-traceable, so the outcome
  ledger can attribute. If the trade rate jumps at ship, that is the alarm the BRIEF asked for.

## Assumptions I'm making about the other two lanes

- **PM scopes Tier 1 as exactly items 1+2+3** and does **not** pull item 4 (event calendar) in on
  discovering that the Rust backend never received it — that is a separate re-port, not a Tier 1 item.
- **PM will not ask for a computed "recommended position size" as an output field.** I am building
  sizing **inputs** the model may cite. A server-computed size number is one product decision away from an
  instruction, and `[no-real-order-path]` is the reason I will resist it.
- **PM accepts that the risk block is signed-in-only** and that an anonymous user gets the rest of the
  feature with the risk block in an explicit not-entered state — not a blocked rec, not a zero.
- **PM/UX accept that the in-app model does not literally fetch the candidates endpoint** — the deliberate
  pull is a server-side assembly step. If PM's intent was a genuine agentic tool-use loop, my §3 is wrong
  and the effort estimate roughly doubles.
- **UX does not design an options-chain browser.** If the UI renders the candidate set as a scrollable
  chain table, the cap and the raw-dump invariant collide with a surface the trader will demand be
  complete. I am assuming the candidate set is primarily an **AI input**, with at most a small digested
  display.
- **UX places expected move in the static family** (beside IV skew / term structure / IV rank),
  un-dimmed on an SSE drop, with its tenor and basis visible without expanding — because the payload is
  self-describing and hiding the basis makes the honesty inert.
- **UX puts the risk block on the existing per-user settings surface**, not a ticker-page modal, so it
  reuses the already-gated write path rather than needing a second one.
- **UX will render three distinct not-a-number literals** for the positions digest (no open positions /
  not sent / broker not connected) and at least two for quotes (no NBBO on this contract / not computed).
  I am supplying the closed vocabulary; they own the words.
- **Neither lane expects any of this on SSE.** Nothing here is live-derived, and no live tile changes.
- **Neither lane needs candidates for a ticker the user is not currently viewing** — the read is
  single-ticker on demand, which keeps it inside the narrowed single-ticker request-path decision.
- **The frontend can compute and send a bounded open-positions digest from its own store** without a new
  durable key or a store migration, because `SimPosition`/`Leg`, `StructureKind` and the max-loss
  eligibility set already exist client-side. If that derivation turns out to need a store change, item 2's
  effort estimate moves.
