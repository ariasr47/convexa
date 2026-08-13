# tradeable-rec-inputs — spec

**Source brief:** .spire/clusters/tech/contracts/tradeable-rec-inputs/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md   (under council/)
**Status:** draft — S2 skeptic passes 1–2 folded (R4 pass 2 + one amendment)

## 1. Goal + scope

The AI recommendation is asked to return `max_risk`, `position_size`, `exit_plan.target` and
`exit_plan.stop`, and today the app hands it nothing that can produce those as numbers — all four
render one em-dash that means four different things. This feature closes that gap for the
owner-operator swing trader on `/ticker/:symbol` by supplying three inputs the chain snapshot
already holds or the owner already knows: a **bounded candidate contract set** the model is handed
deliberately, the owner's **own risk numbers**, and the **straddle-implied move**. It does not make
the model smarter. It makes the model **answerable** and — the other half, equally load-bearing —
**checkable**, because the moment a dollar figure appears next to the word "risk" the owner will
believe it. The binding framing carried from the source analysis governs every ranking, hierarchy
and copy call below: better inputs should mostly make `no_trade` **better-argued**, not convert it
to trades.

**In scope:**

- A **candidate contract set** for the viewed ticker — contracts inside a ±15% strike band,
  restricted to expirations in the active DTE/expiration window, hard-capped by tenor and by strike,
  carrying the quote / greeks / IV / OI the snapshot already holds. Assembled only on a deliberate
  pull (a rec request, or opening the hand-off export), never on the polled bundle, never on SSE.
- A **dedicated candidates endpoint** so an external / hand-off AI can pull the set on purpose.
- **Traceability of the rec's named contract**: for a single-leg trade rec, that exact contract's
  quote and greeks, or an honest literal saying why they are absent.
- An owner-entered **risk block** (account size + one per-trade cap stored as `{value, unit}`),
  per-user, server-side, behind a server-enforced write gate, clearable, and disclosed before the
  first save because these figures ride to the AI provider.
- The **effective dollar cap**, derived exactly once server-side, with closed not-derivable states.
- The **cap check** — a stated, non-blocking comparison of the rec's dollar risk figure against that
  cap **on verdicts that state an entry**, with an explicit could-not-check state, and **no cap
  surface at all on `no_trade`**, where there is no entry and therefore nothing to size.
- **Simulated open-positions exposure** for the ticker as sizing context, labelled simulated at
  every surface including inside the AI context.
- The **straddle-implied move**, self-describing (expiration, DTE, strike used, anchor spot and
  which spot it is, quote basis, wide-quote marker) and framed as advisory.
- A **digested candidate-liquidity line** on the rec panel's `What the numbers said` strip, rendered
  on **every** verdict including `no_trade` (owner ruling, 2026-08-12).
- **Loop closure**: the rec's stated size is displayed verbatim beside the simulated-entry quantity
  field — never into it — and the decision record additively captures whether a risk block was
  present at entry.
- A **degraded state for every one of the above**, each independently distinguishable.
- A recorded **before/after verdict comparison** produced as a ship condition (AC-89).

**Out of scope:**

- Any change to `opportunity_score`, `opportunity_tier`, the entry gate, `state_fingerprint`, the AI
  cooldown or the daily cap. Every datum here is AI-context/display.
- A **liquidity hard filter** (program item 5). Removing trades from consideration is a behaviour
  change with its own before/after burden, not an input. Next in this program's order, as its own
  feature.
- **Real broker positions as sizing context.** Ruled out of v1 on a named mechanism, not taste:
  Webull supplies no option contract detail, so a broker option position arrives `partial` and
  cannot answer "exposure in THIS underlying" at all; routing it here would also falsify the shipped
  egress promise that no broker/order data leaves the machine, and would replace the three-state
  positions matrix with a per-source matrix nobody specified.
  <!-- spire:council-resolution:v1 5a6006c462db03f35eb1db56698c0dc1539596234ea428b3549327cc0ff2a3ba folded -->
  <!-- spire:council-resolution:v1 e053ee0a1ae3a0bd27698e5a980387cbdcb6d321c34db60c25ae716ba934fe9e folded -->
- Any order, execution, broker-sizing or buying-power surface.
- A **numeric size pre-fill**. The quantity field is never populated from the model.
- The app computing multi-leg net debit/credit itself, or constructing/pricing spreads server-side.
- A full chain browser, a strike screener, per-contract sorting/filtering UI, or any standing chain
  table on the bento.
- **Per-leg contract identity for spreads** (a `legs[]` array with a right per leg). v1 buys the
  single-leg guard only.
- A sizing calculator ("you can afford N contracts"), a contract-count stepper, or any enforcement.
- Accumulating expected-move history or measuring implied-vs-realised accuracy.
- Feeding outcome-ledger base rates into the prompt (program item 23).
- Item 4 (event calendar). Note for planners: `event_calendar` has **zero matches** in
  `apps/api/src` — the shipped-in-Python calendar was never ported to the Rust tree. That re-port is
  its own feature and nothing here depends on it.
- Any new vendor call, endpoint or entitlement. Zero incremental vendor spend is a verified property
  of the chain mapper, not an aspiration.

**Future (deliberately deferred), each with its trigger:**

- **Broker-book exposure as sizing context** — after the shipped broker book has been owner-verified
  in daily use for one full week, as its own feature carrying its own `partial` literal, its own
  egress enumeration and its own before/after burden.
- **A typed machine-readable size field on the rec schema** — after the owner has used the
  displayed-beside form for a month and asked for it. Explicitly barred from riding this feature's
  schema change: a typed size recreates the pre-fill temptation, and that is a product decision, not
  a free rider.
- **Per-quote quote age** — only if the pre-commit raw-row inspection confirms the vendor sends a
  timestamp on chain-snapshot rows, and then only as a like-for-like substitution in the slot
  `quote age: unknown` already occupies (same surface, same state, no new literal, no new AC).
  Anything larger is its own additive follow-up.
- **Per-leg identity for spreads** (`legs[]` with a right per leg).
- **Fraction-of-equity plus an absolute ceiling with min-of-two derivation** — under the richer
  risk-model trigger (after the owner has lived with one account size and one cap for a month).
- **Expected-move accuracy tracking** — once ≥20 closed outcomes carry a move stamp.
- **Ledger breakdown by "sized under a risk block"** — at the ledger's existing 20-outcome floor;
  the capture ships now (AC-82) precisely so the breakdown needs no backfill.

## 2. Architecture

The whole thing in one line: **two pure selectors in `quant-engine`, one attached to the snapshot
and one computed on demand; one owner-entered record on the existing per-user settings store; one
client-supplied digest that is never persisted; and one prompt-assembly step that is the only place
all four meet.**

Ground truth the design stands on: the serving backend is **Rust** — `apps/api` (crate `api-rust`,
Axum/Tokio) over `libs/quant-engine`. Any `.py` path in older notes is the retired tree
(`archive/api-python/`). `libs/quant-engine/src/types.rs::Contract` already carries `strike_price`,
`contract_type`, `expiration_date`, `open_interest`, `implied_volatility`,
`greeks{delta,gamma,theta,vega}`, `volume`, `bid`, `ask`, and the Massive REST mapper populates
bid/ask for every contract on the full chain snapshot, not only on the tracked-contract path. The
full chain is already in memory and already withheld from the wire:
`apps/api/src/state.rs::AnalyticsSnapshot.contracts` is `#[serde(skip)]`.
`GET /api/contract/{ticker}` is the shipped precedent for a dedicated read off that field.

### 2.1 The straddle-implied move — on the bundle, because it is the only one of the three that is digested

A pure function in `quant-engine` beside `compute_term_structure`: same inputs (`&[Contract]`, spot,
`as_of`), same "sparse tenors omitted, never faked" posture. Computed into `AnalyticsSnapshot`
during `compute_analytics` and emitted as an additive member of `market_state` in `build_bundle`,
the way `iv_rank` / `market_context` / `vol_normalized_gex` already are.

**Why the bundle and not the dedicated endpoint** — and this is the deliberate half of the apparent
inconsistency with the candidate set: the in-app rec prompt is assembled server-side and forwards
`market_state`. A read that is ~3 objects of ~8 scalars costs nothing there and reaches the model
for free. A read that is hundreds of records per expiration does not. The dividing line is **size
and digestion**, not tidiness — which is exactly the line `[digested-labels-not-raw-dump]` draws.

Content rulings:

- **Anchored on `gex_spot`, not the live display price.** `gex_spot` is the levels anchor — walls,
  flip, max pain and the strike profile all hang off it. Anchoring the move on the live price makes
  the percentage disagree with the level tiles beside it and makes two calls twenty seconds apart
  produce different numbers against the same pinned rec fingerprint. The cost — during a fast RTH
  move the percentage is computed off a slightly stale anchor — is the cheaper error, and it is
  disclosed, because the anchor value and which spot it is both ride the payload and both render in
  the basis line (§4).
- **A missing NBBO leg is a different basis, never a silent substitute.** Exactly one fallback is
  allowed (an IV-derived estimate off the ATM tenor IV) and it arrives under a **different value of
  the closed basis enum**, so a consumer branching on the enum cannot conflate "the market is
  quoting this straddle at X" with "our model thinks X". Adjacent-strike substitution is allowed
  only within the same basis, and only because the strike used and its distance from the anchor are
  both on the payload.
- **Up to 3 tenors on the wire; the payload names its own primary.** The nearest tenor at or above a
  DTE floor plus the tenor(s) bracketing the active DTE window, cap 3. The member carries an
  explicit designation of which tenor is the default render, chosen server-side by the same
  nearest-in-window rule that selects candidate tenors — the client never picks by array order and
  never re-derives "nearest" by comparing DTEs. The primary tenor is **always** present in the
  candidate block, because both are selected by that one rule, so the rendered reading and the
  contracts the model was sent can never disagree.
  <!-- spire:council-resolution:v1 5e7c21d3edfabd6f42aefe8892af6bd402f3447ef417005fd8a58f96b3fdb098 folded -->
- **Sparse tenors are omitted, never emitted null.** A tenor that cannot be computed is absent from
  the list; the reason lives once at set level. There is therefore no per-tenor null-cause matrix to
  design, because there are no per-tenor nulls.
- **The member is always an object, never a bare null.** `[best-effort-isolated-or-null]`'s
  obligation is that a failure never becomes an HTTP error and never disturbs
  `market_state`/`strike_profile`/SSE — it is satisfied here by a **closed `state` member**
  (`ok` · `no_quote` · `not_computed` · `no_expiration_in_window`) with an empty tenor list, not by
  a bare null, because a null cannot carry a reason and the FE is forbidden from inferring one from
  a null (§4, AC-46). The constructor is total: every branch, including its own error branch,
  returns the object with a state. This is the same shape the shipped event-calendar work used — a
  closed state enum as the sole disambiguator.

Cost check: this rides the snapshot, and `AnalyticsSnapshot` is cloned on every cache set and every
cache hit. Three small structs per snapshot is a rounding error. Sixty-four candidate records would
not be — which is the mechanical reason for the next section's split.

### 2.2 The candidate set — off-bundle, on-demand, hard-capped by a type

A second pure selector in `quant-engine` taking the chain, the anchor spot, the band, the DTE window
and the caps, returning a bounded, ranked candidate set. **Not stored on the snapshot** — it is
parameterised per request and would multiply the per-request clone cost above. It is recomputed from
`snap.contracts` at read time: an O(chain) scan of an in-memory vector, microseconds, against a
chain fetch of seconds.

**The cap is the feature, and the band is not a bound.** Do the arithmetic: SPY near $640 has $1
strikes, so ±15% is ~190 strikes × 2 rights ≈ 380 contracts *per expiration*, and SPY lists several
expirations a week. "±15% across expirations" is a four-figure record count. The recorded resolution
(a dedicated endpoint, not bundle payload) is necessary and **not sufficient**. Two ceilings, and
whichever binds first wins:

| Consumer | Tenors | Rights | Strikes per (tenor, right) | Record ceiling | Byte ceiling |
|---|---|---|---|---|---|
| Dedicated read / hand-off export | ≤ 4 | 2 | ≤ 8 | ≤ 64 | yes |
| In-app single-turn prompt | ≤ 2 | 2 | ≤ 5 | ≤ 20 | yes |

A record cap alone is not a bound on prompt size once per-record content is negotiable, hence the
serialized-byte ceiling beside it. Both ceilings live in the candidate-set **constructor** — a total
function whose only constructor truncates — so an implementer who loops without a bound cannot
compile a violation (`[structural-over-prose-enforcement]`).

**Two budgets, one assembler.** Collapsing the hand-off export to the prompt budget damages the path
where the constraint does not exist (a human pasting into a full-window chat has no single-turn
budget, and the hand-off is the owner's highest-leverage use of this feature); collapsing the prompt
to 64 records is infeasible. So the budgets differ and the **assembly rule does not**: same band,
same active-window rule, same tenor and strike caps, same drop accounting. Every assembled artifact
records which budget produced it and whether it was **sent to the model** or **computed for display
only** — without that flag the drawer's "what actually left the machine" claim becomes false the
first time the two budgets differ, which is now, by design.

**Prompt-block consistency invariant (load-bearing).** In any artifact carrying both blocks,
`tenors(move block) ⊆ tenors(candidate block)`. The model is never handed a move for an expiration
it was handed no contracts for. Vacuously true on the bundle, which carries no candidate block.
Enforced by **one shared restriction function** used by all assembly points, never by three local
filters. Named mechanism, because this is the part that would otherwise be hand-waved:
`apps/api/src/services/llm.rs:137` today forwards `market_state` **wholesale**; since the move rides
`market_state`, the assembler must forward a **pruned clone** with the move member restricted to the
candidate tenors. That is a context-assembly filter, not an instruction rewrite, and it is the one
amendment to the "no prompt rewrite" non-goal (§2.7).
<!-- spire:council-resolution:v1 3f64a61d809e5b1144f5b6c65636998d8b62a543b59bbc42d573b2ec9634789f folded -->

**Ranking** — the thing that makes a cap defensible rather than arbitrary: nearest-to-anchor first,
with zero-OI-and-zero-volume contracts excluded from candidacy entirely and counted as dropped.
Ranking by liquidity instead would surface a far-OTM high-OI wall strike over the ATM contract the
rec will actually name; ranking by distance keeps the set *about the trade being considered*.

**Drop accounting** — five closed reasons, one per excluded contract, evaluated in fixed order
`outside window → outside band → no interest → expiration cap → strike cap`, each contract counted
**exactly once** under the first reason that applies. Without a fixed order the counts double-count
and nothing the browser renders reconciles. "No interest" deliberately precedes the caps so a junk
contract is never attributed to the cap, which would make the cap look more aggressive than it is.
**Sum invariant, asserted in a test: included + Σ dropped = rows scanned.** A consumer must be able
to tell "the band held 380 and you are seeing the 64 most relevant" from "the band held 64";
without that count a capped set reads as an exhaustive one and the model will call the chain thin
when it is not. **A contract with no NBBO is NOT dropped** — it is included carrying its presence
state, because a no-quote at-the-money contract is a liquidity fact worth sending. There is no sixth
drop reason for it and nobody should add one.

**Two wire coercion traps are binding implementation constraints, both code-verified:**

- `normalize_contract` filters `bid`/`ask` with `> 0.0` (`apps/api/src/infrastructure/massive/rest.rs:823-824`),
  so a legitimate zero bid is **indistinguishable from vendor-absent**. The per-contract presence
  vocabulary is therefore `quoted in this snapshot` / **`no two-sided quote in this snapshot`** — it
  never asserts "no quote existed". The same bias must be corrected for in the fill-rate measurement
  (§7), which counts vendor-null separately from filtered-zero off the raw rows, not off `Contract`.
- IV is coerced to `0.0` when greeks are absent (`rest.rs:813-817`), so `implied_volatility == 0.0`
  is an **unpriced sentinel, not an IV**. A candidate record carries an `unpriced` state and
  **never ships `0.0` as an IV or a greek**. This is `[absent-is-not-none]` applied to a coercion
  that already exists upstream of us.

**Basis is set-level, presence is per-contract.** `Contract` carries only `bid`/`ask`, and the
vendor mapper's `RawLastQuote` (`rest.rs:737-747`) deserializes only bid/ask/p/P and reads **no
timestamp**. The serving path therefore knows the snapshot's `as_of` and the snapshot's session and
knows nothing about when any individual contract's NBBO was struck. So: **one `as_of` and one
session token for the whole set**, per contract **presence only**, and **`quote age: unknown`
carried once at set level**. A per-quote session label derived from the snapshot `as_of` is
**forbidden** — it would label a contract last quoted three sessions ago as live because the
snapshot happened to be taken at 10:30, which is exactly the fabrication `[absent-is-not-none]`
exists to stop, and it is loudest in the owner's dominant evening usage.
<!-- spire:council-resolution:v1 90073ec39f8ff5d1358eca708ff5e2b61287fd49bf4f6c1df0a7b5c249ce56eb folded -->

**The session token** comes from `MarketPhase::classify` (`apps/api/src/domain/market.rs:20-47`), a
closed three-member enum already used to choose the GEX spot — so the token is consistent with how
the anchor itself was chosen. It classifies the **snapshot's `as_of`, not `now`**, so it describes
the data rather than the request, and it ships beside the snapshot age. The differently-membered
`market_session()` at `routes/stream.rs:61-80` is live-lane SSE metadata and must **not** be
conflated with it. Known imprecision, stated rather than papered over: `MarketPhase::classify` has
no holiday calendar (weekends only), so a weekday-hours snapshot on a market holiday classifies as
`rth`; the snapshot age riding beside it is what lets a reader catch that. A holiday calendar is out
of scope.

**Source rule:** chain-snapshot NBBO only, declared STATIC. Never the live NBBO stream, never a
per-contract live subscription. That keeps vendor cost at zero and keeps the whole set consistent
with one `as_of`.

**Vendor cost, stated precisely.** Candidate assembly **never issues a vendor request** — the
selector takes a `&[Contract]` and has no access to the provider port at all, and the dedicated
route never forces a refresh. Obtaining the snapshot is the pre-existing anonymous read that
`GET /api/ticker/{ticker}` and `GET /api/contract/{ticker}` already perform today through the warm
cache and the `gex_flight` singleflight; on a cold cache the dedicated read pays that same fetch,
coalesced with any concurrent caller. So the candidate band **adds zero vendor requests to whatever
the caller's snapshot read already costs, and opens no anonymous spend surface that does not already
ship**. That fact is what keeps AC-97 (the anonymous hand-off export) in scope, and it is stated in
`INTERFACE_CONTRACT.md` as required.

### 2.3 "A dedicated endpoint the AI pulls deliberately" — the mechanism, named

The phrase resolves into two different mechanisms depending on which consumer is meant, and
conflating them is how this feature ships without the candidate set ever reaching the rec:

1. **External / hand-off AI** (the copy-paste floor, and any agent the owner drives): the pull is
   literal — a URL it fetches on purpose. That is `GET /api/candidates/{ticker}`.
2. **In-app rec**: the pull is made **by the prompt assembler on the model's behalf** — a
   deliberate, separately-budgeted selection step inside `build_rec_prompts`, distinct from the
   wholesale `market_state` forward. `services/recommendation.rs` builds one prompt and calls
   `complete_strategy` once: single-turn, no tool use, no egress from the model back to us. It is
   still "deliberate, not bundle payload": the bundle never carries the band, SSE never carries it,
   and a bundle consumer that does not ask never pays for it.

A genuine agentic tool-use loop is **not** this feature — it is a different cost profile (per-turn
budget, per-provider tool schemas across five providers, a new egress path) and it is not proposed.
Both lanes confirmed mechanism (2) is what was meant.

### 2.4 The risk block and the open-positions digest are two different things

**(a) The risk block** is owner-entered, per-user, server-side, and lives on the existing per-user
settings record (`apps/api/src/services/auth/store.rs::SettingsRecord` + `SettingsPatch`, both
adapters — disk-JSON and Postgres). Content: **account size** and **one per-trade cap stored as
`{value, unit}`** where unit is dollars or percent.

- **One cap, not two.** The min-of-two model (fraction of equity plus an absolute ceiling) adds a
  third control the owner must learn for a benefit one owner with one account cannot use yet, and it
  puts a number on screen the trader never typed. Deferred under the richer-risk-model trigger.
  <!-- spire:council-resolution:v1 3458de7fd48baa4f9ca15897987077ad1b9579315bb9003ee7c10959358dfb56 folded -->
- **The effective dollar cap is derived exactly once, server-side**, at the same place the risk
  block is read for prompt assembly, and shipped as its own field carrying its unit, the inputs it
  was derived from, and **closed not-derivable states** (percent-with-no-account-size; nothing
  entered) — never a silent zero the model can multiply. This is what makes the cap check
  implementable for a percent cap while leaving "the client performs no arithmetic on the owner's
  entered values" exactly as written: the FE performs no multiplication because the server already
  did. The FE renders entered values verbatim in the provenance chip and the derived figure only
  where it is labelled *derived from your inputs* — never *validated*, *checked* or *enforced*.
  <!-- spire:council-resolution:v1 7ab2bb4fd7f5d498d0328da747e2a7b56ad368891405b75956929727ae93d33d folded -->
  <!-- spire:council-resolution:v1 0e325aa0552e122a06ff5e3b8f260f423b0e121b16c46ffee7e739ee4ce85263 folded -->
- **`Option<T>` everywhere and 0 is a legal entry, never an encoding of "unset".** Encoding unset as
  0 is precisely the failure `[absent-is-not-none]` names; the type has no zero-means-unset
  inhabitant.
- **Migration.** Both adapters hold live records without these fields: the disk-JSON adapter reads
  an old record without faulting (serde defaults on the new optional fields) and Postgres takes a
  nullable column add. A settings record that fails to parse degrades to defaults **without
  overwriting the stored original** — the server-side analogue of `[loss-free-durable-migration]`.
- **Write gate:** server-enforced by the existing resolve-session-then-patch mechanism
  (`routes/auth.rs::put_settings` — `resolve_session` → `Some(user)` else auth error → `SettingsPatch`).
  No new gate design, no new auth surface, no new login state.
- **Pinned to the rec artifact.** The rec response already pins `as_of` and `pinned_fingerprint`
  (`apps/api/src/services/recommendation.rs:436-437`); the **as-sent risk block and cap verdict ride
  the same envelope at the same moment the block is read for assembly**. Response-only, never
  persisted server-side. Because the verdict is pinned, **no consumer ever recomputes it** — that is
  what makes "computed once, passed down as a rendered result" true across a later re-render, not
  just at first paint. The superseded-inputs strip fires by comparing the pinned **digest** against
  the currently stored block, so it needs no raw values to detect a change. Account equity is echoed
  on the response but **this spec forbids it from being written into any persisted rec artifact**:
  if the client stores the rec in the outcome ledger it stores the digest, the cap as entered and
  the effective cap — never the account size. The reason is a path this feature does not control:
  the ledger is client-local and **exportable**, so an equity figure inside it would leave the
  machine through the ledger's own export rather than through the rec's, and the egress note this
  feature amends (`apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts:66-73`) governs only
  the rec/hand-off path. The rule is enforced at a named subject, not by prose — see §2.6's
  outcome-ledger row and AC-29a.

**(b) The open-positions digest** is client-supplied, bounded, and **never persisted server-side**.
Three sources were considered and exactly one ships:

| Option | Mechanism | Verdict |
|---|---|---|
| A. Client sends a bounded digest with the rec request | FE derives from its own durable positions store | **Chosen** |
| B. Server parses `/api/book` | The stored blob is explicitly opaque to the API (v3 FE shape), latest-wins, Postgres-only, migrates on the FE's schedule | **Rejected** |
| C. Server reads the broker book | Typed and real, but `partial` for options | **Out of v1** (§1 Future) |

B is rejected on a named mechanism: making the Rust serving path parse a client durable schema that
has already migrated v1→v2→v3 couples the server to the browser's release schedule, and the blob
only exists on Postgres builds for users who synced. C is out per §1.
<!-- spire:council-resolution:v1 f1259f15e95ad46cd2b061e4f16dceff9102837bf4364c66a78d50d3d0429327 folded -->

Digest content — small, because `[digested-labels-not-raw-dump]` applies to the book as hard as to
the chain: (i) exposure in **this** underlying — a direction label, leg count, nearest-expiry DTE,
and defined max loss when the position is in the eligible closed set, else the stated ineligibility
reason the FE already computes; (ii) portfolio-level open count and total capital at risk; (iii) the
source label. **Not** the book, not per-leg fills, not P/L history.

**The state vocabulary, reconciled.** Two three-member lists were proposed and they are not the same
three. The one that ships is the UX matrix ruled to stand: **`none_open`** (checked, empty) ·
**`not_sent`** (old client, disabled, faulted-to-absent — the state that otherwise silently tells a
trader they have no exposure) · **`unavailable`** (the store faulted this cycle). The architect's
third member, *broker not connected*, does **not** ship as a state, because in v1 no code path can
emit it and a state nothing can produce is a state nobody tests; the fact it was carrying — that the
picture is simulated-only — ships instead as the **`source` enum with exactly one inhabitant
(`simulated`)** plus standing copy naming the limitation on every surface (AC-40). The one-inhabitant
enum is what makes the future broker source an additive variant rather than a shape change, and it
makes an unlabelled digest unconstructable.

### 2.5 The rec response schema gains exactly one field

The rec path is **not** a forced-tool-use contract: `build_rec_prompts`
(`apps/api/src/services/llm.rs:120-147`) states the schema as prose inside the system prompt, and
`parse_strategy_json` (`llm.rs:341-390`) is a tolerant whitelist re-projection that copies the named
keys and silently drops everything else. Any field added is therefore **best-effort** — the model
may omit it and the parser hands us `null`. Every rule below is written for the null-dominant case.

The schema carries `strikes: number[]` and `expiration: string|null` and **no right token** — the
call/put side is inferable only from the free-text `structure` and the `bias` enum. Without a right,
a cited $640 strike can align with the PUT row when the rec meant the CALL, and the cited-contract
fact line — the feature's highest-value fabrication guard — would print a real quote for the wrong
contract. That is worse than the em-dash it replaces, because it is confidently wrong. So:

- **A right token is added to the rec response schema** — members `call` / `put` / **absent**. Cost,
  named exactly: one clause in the schema string (`llm.rs:124-131`) and one coerced projection in
  `parse_strategy_json` (`llm.rs:372-389`), modelled on the existing `bias` coercion at
  `llm.rs:364-371` **with one deliberate difference: it has NO default.** `bias` defaults to
  `neutral`; an unrecognised or absent right stays absent. A defaulted right is exactly the
  confidently-wrong match this exists to prevent.
- **This is a schema field, not grounding enforcement.** Nothing verifies the named contract is
  good; we only make it *identifiable*. `ai-rec-grounding` stays the named successor.
- **Partial-key matching is structurally impossible.** A cited contract exists only when the parsed
  rec yields **exactly one** `(expiration, strike, right)` triple — `strikes` length 1 **and**
  expiration present **and** right present. The match function takes a key type with no constructor
  from a partial input. There is no "match on strike + expiration and pick a side".
- **The other cases are three distinct closed states, not one bucket.** (i) **Right absent** while
  strike and expiration *are* in the set ⇒ `right_undetermined` — its own state with its own copy
  (both legs shown, or no quote shown). It must **never** fall through to the off-set literal: the
  strike and expiration *were* sent, so `Not in the candidate set Convexa sent` would rename "we
  can't tell which leg you mean" as "we didn't send it", which is the exact fabrication class this
  line exists to prevent. (ii) **Strike or expiration absent from the set** ⇒ `off_set`, which keeps
  its original narrower meaning. (iii) **Multi-strike structure, or no identity at all** ⇒ `none` —
  no cited contract and no per-contract quote line. Copy for all three is in §4.
- **The local rule-based fallback never produces a cited contract** — `local_strategy_from_bundle`
  (`recommendation.rs:524-541, 561-578`) emits `strikes: []` and `expiration: null` on both
  branches, so the offline/CI path cannot fabricate a quote by construction.
<!-- spire:council-resolution:v1 7d61862856b7b0a66f0c6d435617e8650fc7ab722baa379310d663ebfc76402c folded -->
<!-- spire:council-resolution:v1 b3fb59df24b90ea686bb718de6e1587b3628400902f71f0e66776a52b0595228 folded -->

**No typed size field, and no parse of `position_size` anywhere.** `position_size` is `string|null`
(`llm.rs:127`) and the local fallback returns the literal prose `"small (rule-based local rec; not
LLM)"` (`recommendation.rs:570`). Parsing free-form model prose into a contract quantity would
invent a number the model never stated and print it into the one dialog that creates a position, and
it would put that parse on the FE where it can drift from whatever the cap check parses server-side.
So v1 parses **exactly one field — `max_risk` — in exactly one place, server-side, for exactly one
consumer, the cap check**, through one function with a closed output (parsed-dollars /
not-parseable). `position_size` is **never parsed by any lane**; the rec's size text is displayed
verbatim beside the quantity field and never into it.
<!-- spire:council-resolution:v1 54314ed90b9802c7e2fac751ad1ee87a1efd169a1e51693b14686073117a2632 folded -->

**Per-field reason tokens are computed server-side, never asked of the model.** Asking a model why
it left a field blank is self-report on an unenforced schema, and the tolerant parser would hand us
a default for it. Instead the assembler knows exactly which blocks it inserted, so the input
dependency of each field is fixed at design time in one place, **in a declared priority order**:

| Field | Depends on — evaluated in this order; `missing_input` names the FIRST absent dependency |
|---|---|
| `max_risk` | the risk block (effective dollar cap / account size) |
| `position_size` | **1.** the risk block · **2.** candidate quotes |
| `exit_plan.target` | the straddle-implied move |
| `exit_plan.stop` | market-state levels only, which are always present |

Then per field: value present ⇒ no reason; null with every required input present ⇒ **`not_given`**
(the model declined); null with at least one required input in an absent/not-set/not-derivable state
⇒ **`unavailable`, with the missing input named**. Deterministic, testable, no model cooperation.

`position_size` is the only field with two dependencies and therefore the only one that needs a
tie-break — and both being absent at once is ordinary, not contrived (a first-time owner with no
risk block, on a ticker whose band came back empty after hours). **When both are absent the token is
`risk_block`**, because that is the input the owner can fix and the one the `Set your risk inputs`
action clears; an empty candidate set is a market fact this cycle and naming it first would hand the
reader no remedy. The wire field carries one token, so the order is what keeps two implementations
from disagreeing — the same discipline as the drop-reason ledger's fixed evaluation order.

**The limitation UX's wording must survive, stated plainly:** this is a claim about *what Convexa
supplied*, not about the model's reasoning, and it can be wrong in exactly one direction — the model
may have had everything and still declined while an unrelated required input was missing. The
literal therefore reads as a statement about our inputs, never about the model's capability (§4).

**The cap verdict** is computed in the rec assembly path
(`apps/api/src/services/recommendation.rs`) at the same point the risk block is read, emitted on the
envelope beside `pinned_fingerprint`, and pinned there. Never in the FE, never inside
`TradeEntryDialog` — the dialog receives the verdict token and the two numbers as already-rendered
props. Five members, **evaluated in one fixed order, first match wins**, so two implementations
cannot disagree:

| Order | Verdict | Trigger |
|---|---|---|
| 1 | `not_applicable` | the rec states **no entry** (`no_trade`), so it asserts no risk figure to audit. There is nothing to check — this is not a failure to check |
| 2 | `no_cap` | no effective dollar cap: nothing entered, **or** percent-with-no-account-size. Both collapse to this one verdict; the reason is read off the cap field's own not-derivable state, never off a further verdict member |
| 3 | `not_checkable` | an effective dollar cap exists but the risk figure could not be read as an unambiguous dollar amount. **Includes the null case on an entry-stating verdict.** Never a pass by default |
| 4 | `within` | a dollar figure was read unambiguously and is **≤** the effective dollar cap. **Equality is `within`** |
| 5 | `above` | read unambiguously and **strictly greater** than the effective dollar cap |

**Why `not_applicable` exists, and why it is not a reopening of the settled vocabulary.** Every
`no_trade` response carries no risk figure — both fallback branches emit none
(`recommendation.rs:524-534` and `:561-571`), and §4's four-field rule renders `—` on all four for
that verdict. Without member 1, `no_trade` + a cap set lands in `not_checkable` **every time**, and
the surface prints *Couldn't check against your cap* in `warning.*` + icon on effectively every
no-trade card — a caveat that reads as Convexa having tried and failed, attached to the one verdict
class the owner ruled must read as a **result, never an empty or degraded state**. The check's
premise is *absent*, not *unreadable*, and those are different facts. The R3 ruling that forbade a
fifth member forbade **splitting the two no-cap reasons** into separate verdicts — those still
collapse into `no_cap` with the reason read off the cap field. Everything else in that ruling stands
verbatim: computed once, server-side, at the same point the risk block is read, pinned on the
envelope, never recomputed by any consumer, equality is `within`, one parse in one place. The
verdict is still computed unconditionally; what member 1 changes is **what it says**, and therefore
what the UI renders — nothing at all (§4).

Copy attribution is unambiguous and both halves are on the payload: **Convexa performed the
comparison**, on a figure **the AI asserted** — the model's raw prose *and* the parsed dollar value
both ride the envelope so the sentence can attribute each half correctly.

### 2.6 Where state lives, and what is touched

| Layer | Path | Change |
|---|---|---|
| Selectors | `libs/quant-engine/` | two new pure functions (straddle move; candidate set) + the capped candidate-set type |
| Snapshot | `apps/api/src/state.rs` (`AnalyticsSnapshot`) | one additive member (straddle move). Candidates are **not** stored here |
| Bundle | `apps/api/src/routes/market.rs` (`build_bundle`) | one additive `market_state` member, attached after scoring |
| Dedicated read | `apps/api/src/routes/` (new module) + `services/analytics.rs::load_analytics` | new route, warm-cache/singleflight read, never `refresh` |
| Rec assembly | `apps/api/src/services/recommendation.rs`, `services/llm.rs` | candidate block, risk block, positions digest, pruned `market_state` clone, right token, cap verdict, field reasons, as-sent echo |
| Export | `apps/api/src/services/recommendation.rs::build_export` | candidate section, risk-inputs section, positions section, amended egress note + categories |
| Settings | `apps/api/src/services/auth/store.rs`, `routes/auth.rs` | additive optional fields on `SettingsRecord`/`SettingsPatch`, both adapters |
| FE — Settings | `apps/dashboard/src/app/features/auth/` (`SettingsPage`, `useSettings`, `validation`, `copy`) | new `Risk inputs` panel |
| FE — rec | `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/` (`AiRecPanel`, `copy.ts`, `StateExportDrawer`) | four-field literal set, provenance chip, cap annotation, cited-contract line, `What the numbers said` line, drawer sections, egress note |
| FE — move | `pages/ticker/widgets/` (market-context sub-card, else a compact widget after `iv-rank`) | the static read |
| FE — entry | `features/trading/TradeEntryDialog.tsx`, `features/trading/model/` | size text displayed beside the quantity field; cap annotation rendered from props; decision record gains the risk-block-present flag |
| FE — outcome ledger | `features/trading/outcomes/` — the record shape in `types.ts` and the existing mutation-guarded `?raw` source scan in `boundaries.spec.ts` (which already globs `features/trading/**`) | **the named subject of the account-size exclusion.** No production module changes and the ledger record type gains no account-size field; the scan gains one assertion that no module writes an account-size value into a ledger or decision record (AC-29a). There is no `captureDigest.ts` in this tree — this row exists so the exclusion has an enforceable subject instead of a promise |

**Failure modes + isolation:**

- **The dedicated read never degrades the bundle or SSE.** It is a separate route reading the same
  warm cache through the same singleflight rather than adding a fetch; concurrent callers coalesce.
- **Error class for the dedicated read follows the `/api/contract` carve-out, not the null rule.** A
  real not-found for a ticker with no chain at all; **everything else is a 200 with a stated
  state** — empty band, all candidates dropped, no quotes in snapshot.
  `[best-effort-isolated-or-null]` governs *bundle* computations; a dedicated resource that cannot
  find its subject is allowed to say so, exactly as the tracked-contract lookup already does.
- **The straddle move follows the null rule strictly at the bundle boundary:** any failure leaves
  the bundle 200 with `market_state`/`strike_profile`/SSE untouched, carrying its closed state
  (§2.1). It is never an HTTP error and never a partial bundle.
- **The risk block keeps the auth carve-out:** auth-subsystem failures return real statuses on the
  auth routes; a risk block that cannot be **read** at rec time degrades the rec to the `not set`
  state and never fails the rec.
- **The positions digest is unverifiable by construction** (it is the client's own book). It is
  never echoed back as server-authoritative and never persisted; if either happened it would become
  a second book nobody reconciles.
- **Nothing here is live-derived.** Every datum is STATIC (chain-snapshot derived); none of it rides
  SSE and none of it degrades on a stream drop.
- **Must never be partially applied:** the settings migration (a half-migrated record must degrade
  to defaults without overwriting the original) and the cap verdict (one computation, pinned; two
  computations of one verdict will disagree the first time the parse changes).

**Not buildable / rejected approaches:**

- **Server-side parsing of `/api/book`** to learn open positions — couples the Rust serving path to
  an explicitly opaque client durable schema on the browser's migration schedule.
- **The broker book as a v1 sizing source** — `partial` for options by the vendor's own limits;
  see §1.
- **A genuine agentic tool-use loop** for the "pull" — a different feature with a different cost
  profile; §2.3.
- **Storing candidates or the digest on `AnalyticsSnapshot`** — it is cloned on every cache hit and
  every cache set; this would be a quiet per-request regression no test would catch.
- **Storing "1% and also $500" as two independent stored truths** — they diverge the first time
  equity changes.
- **Deriving a per-quote session/freshness label from the snapshot `as_of`** — fabrication; §2.2.
- **A client-side multiplication of the owner's entered values** — §2.4(a).
- **Any parse of `position_size`** — §2.5.
- **An anonymous client-local risk block** — self-reported financial figures in localStorage with no
  account attached, feeding a surface that is auth-gated anyway.
- **Widening the ±15% band, or exposing it as a query knob** — the band is a payload-stated
  constant, not a caller-tunable parameter, precisely so it cannot erode.
- **A cap caveat on a `no_trade` card** — §2.5, member 1.

## 3. Acceptance criteria (with user stories)

Every row is observable without reading source. `Verify by` is risk-based, not one-test-per-row:
`test` where a silent regression under an unrelated change is plausible (a literal collapsing to
`—`, a static read starting to dim, a cap creeping up, two copies of one claim drifting apart, a
partial-key match reintroduced by a refactor), `review` where the behaviour is visible, intentional
and a human notices it on a normal pass (wording, presence, ordering).

**User stories**

- **S1 — Tradeable strikes.** As the owner, when the rec names a strike and expiration, I want to
  see the actual bid/ask/mid and greeks of *that* contract, so I know it exists and what it costs
  before I act on it.
- **S2 — My own risk numbers.** As the owner, I want to tell the app my account size and per-trade
  cap once, so the rec's sizing is expressed in *my* dollars instead of generic percentages.
- **S3 — What I already hold.** As the owner, I want the rec to know I already have open exposure in
  this underlying, so it does not size a second position as though the first did not exist.
- **S4 — What the market thinks is possible.** As the owner, I want the move implied by the ATM
  straddle for the expiration under discussion, so a target and a stop are arguable rather than
  invented.
- **S5 — Audit the AI.** As the owner, I want the app to tell me when the rec's dollar risk exceeds
  the cap I set, so I catch the one case where following the rec would hurt me most.
- **S6 — A better no-trade.** As the owner, when the verdict is no-trade, I want the liquidity and
  expected-move facts still in front of me, so "no trade" reads as an argued conclusion rather than
  a dead end.
- **S7 — Nothing moves real money.** As the owner, I want every one of these numbers to remain
  advisory sizing context that can only ever reach a simulated position behind a confirm.
- **S8 — What leaves the machine.** As the owner, I want the export surface to enumerate exactly
  what left and to state what did not, so the one screen whose purpose is being true stays true.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 | S1 | Loading and polling the ticker page with no deliberate action renders no candidate contract rows and issues no candidate assembly; the set is assembled only when a rec is requested or the hand-off export is opened. | test |
| AC-2 | S1 | No expiration outside the active DTE/expiration window appears in the candidate set at any window setting, and narrowing the window never adds an expiration to the set. | test |
| AC-3 | S1 | When the active window holds more expirations than the tenor cap, the surface names how many expirations were included and how many were omitted by the cap, and the same disclosure names how many strikes were dropped and why. | test |
| AC-4 | S1 | Every omitted-contract count arrives on the wire under one of five closed drop reasons (outside window, outside band, no interest, expiration cap, strike cap); no surface derives an omitted count by subtracting two numbers, and zero omissions render `none omitted` rather than an absent clause. | test |
| AC-5 | S1 | Included contracts plus the sum of all drop-reason counts equals the number of chain rows scanned. | test |
| AC-6 | S1 | The dedicated/hand-off set never exceeds 4 expirations x 2 rights x 8 strikes (64 records) and the prompt block never exceeds 2 x 2 x 5 (20 records); both also honour a serialized-byte ceiling and whichever ceiling binds first wins. Raising a ceiling in a test build makes the guard test fail. | test |
| AC-7 | S1 | A ticker whose chain holds no contracts inside the band reports *none in band* (checked, empty); an assembly failure reports *unavailable this cycle*. The two are distinguishable, neither produces an error page, and the rest of the ticker page keeps rendering. **(ship-blocking)** | test |
| AC-8 | S1 | Any surface rendering a candidate-derived number displays, without hovering or expanding anything, the candidate set's as-of and whether the set is live-session or prior-close. | test |
| AC-9 | S1 | A cited contract's quote presence renders from a stated state — *quoted in this snapshot* or *no two-sided quote in this snapshot* — and never leaves the reader to infer it from a blank field. | test |
| AC-10 | S1 | Outside market hours, no individual candidate quote carries a live-session label, a per-quote timestamp or a per-quote age anywhere in v1; the only freshness claim on any surface is the set-level one. | review |
| AC-11 | S1 | A contract with no two-sided quote is included in the set carrying that presence state rather than dropped, and no surface or payload asserts that no quote ever existed for it. | test |
| AC-12 | S1 | No candidate ever ships or renders `0.0` as an implied volatility or as a greek; a contract whose greeks were absent carries the unpriced state instead. | test |
| AC-13 | S1 | Assembling the candidate set issues no vendor request on any path, and the dedicated read never forces a snapshot refresh. | test |
| AC-14 | S1 | No candidate datum appears on the polled bundle or on the SSE payload, and referencing the candidates module from the bundle path makes the source scan fail. | test |
| AC-15 | S2 | A signed-in owner enters an account size and a per-trade cap, saves, reloads the app, and sees the same two values with the same unit. **(ship-blocking)** | test |
| AC-16 | S2 | The `Risk inputs` panel renders a section helper above both inputs in DOM order whose first sentence states the figures are sent to the AI provider with each recommendation request, and which names *not verified*, *not enforced* and *never used to score anything*; both field helpers render as written. | test |
| AC-17 | S2 | The section helper carries a `View what's sent` link to the default ticker's AI recommendation panel, present in the anonymous state as well. | review |
| AC-18 | S2 | A zero, negative or non-numeric entry is refused locally with a message naming the problem, no network write occurs, and reloading shows the previous values. | test |
| AC-19 | S2 | A cap entered in dollars that exceeds the entered account size is refused with a message naming the problem, and reloading shows the previous values. | test |
| AC-20 | S2 | A cap entered as a percent that is not greater than 0 and at most 100 is refused with a message naming the problem. | test |
| AC-21 | S2 | A cap entered as a percent is never refused on account-size grounds at any account size, including none entered, and no refusal message mentions the account size. | test |
| AC-22 | S2 | A cap entered in dollars with no account size entered saves, and the effective dollar cap shown equals the figure entered. | test |
| AC-23 | S2 | A cap entered as a percent with no account size entered shows the effective dollar cap as not derivable and names why — *Account size: not set* — never $0, never blank, and never a cap verdict. | test |
| AC-24 | S2 | A save attempted without a valid session is refused by the server and nothing is stored, even when the client-side check is bypassed. **(ship-blocking)** | test |
| AC-25 | S2 | Signing in as a second account shows that account's risk block or an empty one, never the first account's values. | test |
| AC-26 | S2 | Clearing the risk block succeeds, and the next rec produced afterwards reports *account size: not set* and shows no dollar sizing derived from an account size. | test |
| AC-27 | S2 | A signed-in owner who never entered a risk block still gets a rec; its risk figures carry no account-derived dollar amount and the absence renders as *not set* rather than a dash. **(ship-blocking)** | test |
| AC-28 | S2 | Across the rec panel, the Settings surface, the cap readout and the export drawer, the owner-supplied-nothing state renders the identical literal *not set* — no surface uses a synonym, a dash or an empty string. | review |
| AC-29 | S2 | The account size and per-trade cap appear on no operator/diagnostic route and in no export the app offers other than the owner's own settings, rec and hand-off surfaces. (The persisted-artifact half of this rule is AC-29a.) | review |
| AC-29a | S2 | No account size reaches a persisted client artifact: a rec produced under a risk block, accepted into a position and closed into the outcome ledger yields a ledger export containing no account-size value anywhere, and a source scan over `features/trading/` fails if any module writes an account-size value into a ledger or decision record. **(ship-blocking)** | test |
| AC-30 | S2 | The anonymous Settings panel renders the section with `aria-disabled` and still-focusable controls (never the HTML `disabled` attribute) plus the sign-in line, and writes no risk value to any durable client store. | test |
| AC-31 | S2 | The per-trade cap carries an explicit unit on the control, and every later display of that value carries its unit; a bare number with an inferred unit never renders anywhere. | test |
| AC-32 | S2 | A failed save keeps the typed values in the fields, shows the shipped `settings.saveError` copy verbatim, and never shows `Saved`. | test |
| AC-33 | S2 | When server-side storage is unavailable the panel says so in the shipped storage-unavailable shape and claims no value as saved. | review |
| AC-34 | S2 | A never-set risk block shows its consequence line styled as a blank form field — not as an error and not as a warning. | review |
| AC-35 | S2 | A settings record written before this feature loads without faulting and keeps its existing values; a record that fails to parse degrades to defaults without overwriting the stored original. | test |
| AC-36 | S2 | No stored or wire representation of the risk block can express "unset" as `0`: a zero entry is refused (AC-18) and an absent value is a distinct state everywhere it is read. | test |
| AC-37 | S3 | With open simulated positions in the ticker, the rec context includes that exposure and the app names how many open positions were counted. | test |
| AC-38 | S3 | With no open simulated positions in the ticker, the context reports *none open* (checked, empty) — the fact is stated, not omitted. **(ship-blocking)** | test |
| AC-39 | S3 | With the simulated positions store in its faulted state the context reports *positions unavailable*; with no digest sent at all it reports *not sent*; neither ever reports *none open*, and all three are distinguishable. | test |
| AC-40 | S3 | Wherever the exposure summary appears, including inside the AI context, it is labelled simulated and names that broker positions are not counted. | review |
| AC-41 | S3 | The positions digest is never persisted server-side: after a rec, restarting the server and re-reading every server surface shows no stored digest. | test |
| AC-42 | S3 | The digest's source label is a closed enum with exactly one inhabitant (`simulated`), and an unlabelled digest cannot be constructed. | test |
| AC-43 | S4 | With a quotable ATM straddle in the nearest in-window expiration, the app shows the move as a plus/minus dollar amount and as a percentage of the anchor spot. | test |
| AC-44 | S4 | The read is titled `Straddle-implied move`; the string `Expected move` appears only inside its explanatory tooltip, never as a label, heading or chip. | review |
| AC-45 | S4 | The basis line is visible without hovering or expanding and names the expiration, the DTE, that the price is mid quotes, the anchor spot value and which spot it is; the advisory line states that it is not a forecast, not a probability and not a scored signal. **(ship-blocking)** | review |
| AC-46 | S4 | The two unavailable causes render two distinct literals selected by closed lookup on a wire reason token; no surface picks the literal by inspecting a null. | test |
| AC-47 | S4 | With either ATM leg lacking a two-sided quote, the read shows no number and states the no-quote reason; a market-quote basis is never computed from theoretical prices. | test |
| AC-48 | S4 | With no expiration inside the active window, the read states that reason, distinct from AC-47's reason. | test |
| AC-49 | S4 | A straddle whose quoted spread exceeds the wide-quote threshold carries the wide-quotes marker and displays the threshold applied. **(ship-blocking)** | test |
| AC-50 | S4 | On a live-stream drop the read keeps rendering un-dimmed with no offline marker while live-derived tiles degrade. | test |
| AC-51 | S4 | Cold load shows the shipped per-source skeleton, visually distinct from both unavailable literals. | test |
| AC-52 | S4 | No expected-move band, shaded region or reference line is added to the GEX profile chart. | test |
| AC-53 | S4 | The ticker widget renders exactly one tenor — the one the payload designates as primary — and no surface selects a tenor by array order or by comparing DTEs in the browser. | test |
| AC-54 | S4 | The rec strip renders the move for the expiration the rec cites, selected by exact expiration match; with no matching tenor it says so for that expiry and never relabels another tenor's number. | test |
| AC-55 | S4 | In any artifact carrying both blocks, every expiration in the move block is also present in the candidate block; widening that restriction in a test build makes the assertion fail. | test |
| AC-56 | S5 | On a verdict that states an entry, with a risk figure readable as an unambiguous dollar amount and an effective dollar cap present, the surface states whether the figure is within or above the cap and shows both numbers. | test |
| AC-57 | S5 | On a verdict that states an entry, with a risk figure that cannot be read as an unambiguous dollar amount — including when it is absent — the surface states that it could not check against the cap, never a pass by default. | test |
| AC-58 | S5 | On a verdict that states an entry, with no effective dollar cap, the surface shows no cap verdict at all (neither pass nor fail) and names the cap as *not set*. | test |
| AC-58a | S5 | On a `no_trade` verdict the cap surface renders **nothing at all** — no comparison, no *couldn't check* caveat, no cap readout and no *not set* cap literal — and this holds both with a cap set and with no cap set. The card's only not-applicable statement is the `—` on the four fields with its `No entry, so there is nothing to size.` tip. **(ship-blocking)** | test |
| AC-59 | S5 | An over-cap rec is still actionable: the entry flow opens, the annotation is present at the confirm step, and the action is not disabled. | test |
| AC-60 | S5 | Where the cap annotation renders, it uses `warning.*` plus an icon — never brand amber, and never a green or red direction slot. | test |
| AC-61 | S5 | The provenance chip renders the owner's entered values verbatim, and no client code multiplies, divides or otherwise derives a figure from them. | test |
| AC-62 | S5 | The max-risk tip states that the figure is the AI's and not Convexa's arithmetic. | review |
| AC-63 | S5 | The verdict and the effective cap are computed once server-side and pinned to the rec envelope; the five verdict triggers are evaluated in one fixed order with *not applicable* (the rec states no entry) resolved before *no cap* and *couldn't check*; the entry dialog renders received values and contains no cap computation; a risk figure exactly equal to the cap renders *within*. | test |
| AC-64 | S5 | Editing the risk block after a rec was produced shows the superseded-inputs strip in the shipped stale-strip treatment (not `warning.*` plus icon) with the existing `Get a fresh recommendation` action. | test |
| AC-65 | S5 | With a rec on screen the drawer's risk section renders the as-sent values under a label naming them as sent; with no rec on screen it renders the currently stored values under a label naming them as what the next request will send. Never both, never an unlabelled set. | test |
| AC-66 | S6 | On every verdict including `no_trade`, the `What the numbers said` strip carries one digested candidate-liquidity line — candidate count across expiration count, the ATM relative-spread band label, the wide-quotes marker when it fires, and the omitted count with its reason — and the straddle-implied move renders exactly as it does on a trade verdict. No per-contract rows, no strike axis, no sorting, no expansion. **(ship-blocking)** | test |
| AC-67 | S6 | A `no_trade` card renders the same `Why` and `Levels in play` sections a trade verdict renders. | test |
| AC-68 | S6 | No verdict state applies a success or error palette slot to the verdict hero, and no copy, count or badge frames `no_trade` as an empty or zero-result state. | test |
| AC-69 | S6 | `max_risk`, `position_size`, `exit_plan.target` and `exit_plan.stop` each render exactly one member of the closed set {value, `—`, `not set`, `unavailable`, `not given`}; `null`, `undefined`, `NaN`, `0` and an empty cell never render. | test |
| AC-70 | S6 | A `no_trade` verdict renders `—` on all four fields with the not-applicable tip — never `not set`, never `unavailable`. | test |
| AC-71 | S6 | A trade verdict with an empty risk block renders `not set` on `max_risk` and `position_size` with a `Set your risk inputs` action that navigates to the Settings panel. | test |
| AC-72 | S6 | The `unavailable` / `not given` split is decided server-side from which blocks the assembler actually inserted, `unavailable` names the missing input, and no surface asks the model why it left a field blank. | test |
| AC-72a | S6 | When both of `position_size`'s dependencies are absent on the same request — no risk block set **and** no candidate quotes — the named missing input is the risk block, deterministically, on every run. | test |
| AC-73 | S6 | A per-contract quote renders only when strike, expiration and right together resolve to exactly one contract in the candidate set. | test |
| AC-74 | S6 | When the rec states no right, the fact line renders either both legs labelled call and put, or the no-quote-shown literal; exactly one right is never chosen for the reader. | test |
| AC-75 | S6 | A cited contract whose strike or expiration is absent from the candidate set renders `Not in the candidate set Convexa sent` with no quote figure, and that literal never renders for the undetermined-right case. | test |
| AC-76 | S6 | No code path renders a per-contract quote from a match key that does not carry a right. | test |
| AC-77 | S6 | An absent or unrecognised right token stays absent and never defaults to a side. | test |
| AC-78 | S6 | The local rule-based fallback rec produces no cited contract and no per-contract quote. | test |
| AC-79 | S6 | Opening the simulated-entry dialog from a rec leaves the quantity field at the same default it shows today, in every case; the rec's size text appears beside the field, quoted and attributed to the AI. | test |
| AC-80 | S6 | A rec that states no size at all shows *size not suggested* — a distinct literal from *not set* — and still opens the quantity field at today's default. | test |
| AC-81 | S6 | A rec whose size text names no whole number of contracts is displayed verbatim, and no quantity anywhere in the app is derived from it. | test |
| AC-82 | S6 | A position entered from a rec records whether a risk block was present at entry; positions entered before this feature remain readable and are neither altered nor destroyed. | test |
| AC-83 | S7 | The opportunity score, tier and state fingerprint for a ticker are byte-identical with and without a risk block entered, with and without candidates, and with and without the straddle move — asserted on **both** bundle branches (`dark_pool=true` cached-signals and `dark_pool=false` re-score). **(ship-blocking)** | test |
| AC-84 | S7 | Adding any datum from this feature to the scoring input list makes the fingerprint-identity test fail, and that poison test is proven non-vacuous. | test |
| AC-85 | S7 | The AI cooldown and daily-cap counters advance for a rec request exactly as they did before this feature, and a gate-not-ready ticker is still gate-not-ready. | test |
| AC-86 | S7 | Acting on a rec creates only a SIMULATED position behind the existing mandatory confirm; no order, broker or execution surface is added anywhere in this feature. | test |
| AC-87 | S7 | No value added by this feature renders in a success or error colour; all figures use the mono, tabular treatment; there is zero hardcoded hex and no new keyframe family. | test |
| AC-88 | S7 | The rec panel, the Settings `Risk inputs` panel and the export drawer produce no horizontal overflow at 393px. | test |
| AC-89 | S7 | A recorded before/after comparison of rec verdicts exists across at least five named tickers including one after-hours run; every `no_trade` to trade flip is listed with the input the rec cited for the change; the owner reviews it as a ship condition. **(ship-blocking)** | review |
| AC-90 | S8 | The egress note enumerates every category actually sent and no longer claims *no account or identity*; the server-supplied note and the frontend fallback copy assert the same thing. **(ship-blocking)** | test |
| AC-91 | S8 | The export drawer renders a `Candidate contracts` section carrying `{N} contracts across {M} expirations · {K} omitted ({REASON})` and a `Your risk inputs` section carrying the values it names. | review |
| AC-92 | S8 | A category that was not sent renders an explicit `Not sent` line rather than an omitted section. | test |
| AC-93 | S8 | `View what's sent` is reachable in every rec-panel state, including `not set` and `no_trade`. | test |
| AC-94 | S8 | The drawer names, in the surface itself, which consumer it is showing (the in-app recommendation request or the hand-off export) and how many contracts across how many expirations that consumer carried. | test |
| AC-95 | S8 | On the in-app view the contracts listed are the ones the displayed rec was produced with; opening the drawer after the snapshot has advanced never shows a set the rec did not receive, and if the as-sent set cannot be recovered the drawer states that instead of listing a re-assembled one. | test |
| AC-96 | S8 | Both consumers' sets obey the same band, active-window and expiration-cap rules, and each states the count omitted by the cap with its reason. | review |
| AC-97 | S8 | The anonymous hand-off export includes the candidate set and the straddle-implied move and reports the risk block as *not set* with the section present rather than omitted; its egress note enumerates only what an anonymous export actually carries. | test |

**Ship-blocking rows:** AC-7, AC-15, AC-24, AC-27, AC-29a, AC-38, AC-45, AC-49, AC-58a, AC-66,
AC-83, AC-89, AC-90.

**Provenance of merged, added and renumbered rows** (so nothing reads as dropped):

- AC-2/AC-3 replace the withdrawn strictly-fewer-expirations criterion; AC-8/AC-9/AC-10 replace the
  withdrawn per-quote-basis criterion; AC-19..AC-23 replace the single
  cap-larger-than-account-size criterion; AC-73..AC-76 replace the single cited-contract criterion;
  AC-79..AC-81 replace the single size-pre-fill criterion; AC-66 folds the no-trade liquidity and
  move criteria into the one owner-ruled surface.
  <!-- spire:council-resolution:v1 16511e5bc2aa39b00e1d13cd8d3be8f22d7fb6a1f94fc103290ffcda2a81c30b folded -->
  <!-- spire:council-resolution:v1 6b77b44f891147b191ff2ba6f22f9d1cc9c365ab8de7ab1c94ad1c7d3b3ab8b0 folded -->
- **Added at the S2 fix pass (R4 pass 2), suffixed rather than renumbered so every existing
  reference stays valid:** **AC-58a** closes the skeptic's Critical — the cap surface had no defined
  behaviour on a `no_trade` verdict, and AC-57 + AC-70 + §2.5 composed into a *couldn't check*
  caveat on effectively every no-trade card. **AC-72a** closes the skeptic's Important — the
  `missing_input` tie-break when both of `position_size`'s dependencies are absent. AC-56, AC-57,
  AC-58, AC-60 and AC-63 were amended in place for the same fold (entry-stating scope, fixed
  evaluation order).
- **Added at the S2 pass-2 amendment:** **AC-29a** splits the account-size exclusion out of AC-29
  and gives it a `test` verify-by, because it is silent-regression class rather than
  noticed-on-a-pass class — the sibling honesty claim (AC-90) is already a ship-blocking `test`, and
  a leak of the owner's most personal figure through the ledger's own export path is at least that
  severe. AC-29 keeps `review` for the half a human genuinely does notice (which surfaces show the
  figures). The enforcement subject is named in §2.6's outcome-ledger row.
- **Upstream cross-reference note (not a SPEC defect):** `BRIEF.md` cites "(AC-92)" for the
  before/after verdict comparison ship condition. That number predates the R2/R3 AC fold; in this
  document that ship condition is **AC-89**, and **AC-92** is an unrelated export-drawer row. The
  BRIEF is an upstream input to this synthesis and is not edited here; the SPEC's own ship-blocking
  list above is authoritative.

## 4. UI + interaction

**Flows:**

1. **Set it once.** Settings → `Risk inputs` (a new panel directly under Preferences, above AI key —
   it is a trader input, not a credential; grouping it with keys would frame self-reported numbers
   as secrets). Enter account size and one per-trade cap with an explicit unit. Save. The egress fact
   is read *before* the first field.
2. **Read the market's number.** Ticker page → `Straddle-implied move`, a STATIC read beside the
   other static family members.
3. **Ask for a rec.** Rec panel → verdict → the four risk fields now carry real values or a
   *reason*, the cited contract carries a real quote or a *reason*, the cap comparison states
   itself on a verdict that names an entry, and the `What the numbers said` strip carries the
   digested liquidity line on every verdict.
4. **Check what left.** `View what's sent` → drawer sections enumerate the candidate set, the risk
   inputs and the positions digest, each either with values or with an explicit `Not sent` line.
5. **Act.** The existing shared sim entry dialog opens with the quantity at today's default, the
   rec's size text quoted beside it, and the cap annotation carried through to the confirm step.

**Component states** — every one specified:

| Component | default | loading | empty | error | offline/stale |
|---|---|---|---|---|---|
| Settings `Risk inputs` | values + `Saved to your account.`; unit visible on the cap control | existing Settings load treatment; inputs never pre-populate with `0` | blank inputs + placeholders + one consequence line: `Not set — AI recommendations will show "not set" where a risk figure would go.` Styled as a blank form field, never as an error or warning | `Couldn't save that setting. Please try again.` verbatim; typed values stay in the fields; never shows `Saved`; never claims a partial save. Invalid input is refused locally before any network write (`Enter a number greater than zero.` / `Enter a percentage between 0 and 100.`). Storage unavailable: `Risk inputs can't be saved on this deployment right now. Nothing was stored.` | none — STATIC. Anonymous: section renders with `aria-disabled` **and still focusable** controls (never the HTML `disabled` attribute, which swallows pointer events and makes the reason unreachable) plus `Sign in to save your risk inputs — they're stored with your account, never in this browser.` |
| `Straddle-implied move` | headline `± $X.XX  (± Y.Z%)` (mono, tabular, never a heading element) + basis line + advisory line | shipped per-source skeleton, visually distinct from both unavailable literals | `No ATM straddle quote this cycle.` (no two-sided quote on an ATM leg) | `Straddle-implied move unavailable this cycle.` (compute faulted or no ATM strike resolvable); `No expiration inside your current window.` (no in-window tenor) | inherits the bundle freshness line only; on an SSE drop it is **un-dimmed with no offline chip** and keeps rendering the last bundle |
| Rec four-field row | the value | inherits the rec panel's existing pending treatment | `not set` (owner supplied no risk block) with action `Set your risk inputs` | `unavailable` (an input this needed was missing this cycle) | n/a — STATIC artifact pinned to its snapshot; `—` when the verdict is `no_trade`; `not given` when the model returned a trade and left the field blank |
| Cited-contract fact line | `{STRIKE} {C/P} {EXPIRY} · bid {b} / ask {a} · Δ {d} · IV {iv}% · from the {as_of} chain snapshot` | inherits the panel | `Not in the candidate set Convexa sent` (strike or expiration absent from the set) | `no two-sided quote in this snapshot` for a matched contract the snapshot did not quote | n/a — STATIC |
| Cap annotation | on a verdict that names an entry: `warning.*` + icon stating the comparison and both numbers | n/a | **`no_trade`: nothing renders at all** — no comparison, no caveat, no cap readout, no `not set` cap literal (the four-field `—` and its tip are the card's only not-applicable statement). On an entry-stating verdict with no effective cap: no verdict rendered, and the cap reads `not set` | `Couldn't check against your cap.` — **only on an entry-stating verdict** whose figure is not parseable | superseded-inputs strip in the shipped **stale-strip** treatment (a truth marker, not a warning) |
| `What the numbers said` liquidity line | `{N} candidates across {M} expirations · ATM spread {BAND} · {K} omitted ({REASON})` (+ wide-quotes marker when it fires) | inherits the panel | `No candidates in band this cycle.` | `Candidate set unavailable this cycle.` | n/a — STATIC |
| Export drawer sections | `Candidate contracts` (count + omitted-with-reason) · `Your risk inputs` (labelled as-sent or as-next) · `Open positions` (simulated, labelled) | inherits the drawer | each unsent category renders `Not sent — you haven't set this.` rather than an absent section | drawer states an unrecoverable as-sent set rather than listing a re-assembled one | n/a |

**Copy** (exact strings; copy is design material, not filler):

- Settings section helper, visible above **both** inputs, never a tooltip, egress sentence **first**:
  > These figures are sent to your AI provider with each recommendation request. Convexa never
  > checks them against a broker, never enforces them, and never uses them to score anything.
  > **View what's sent →**
  <!-- spire:council-resolution:v1 56b47beb884caf75c2a2c245c9e005f1bd1dc3e5af8748b6efb3932d46b6e146 folded -->
  Followed by its own line: `Open positions included: your simulated positions in this browser.`
- Field helpers, unchanged and not repeating the egress fact:
  `Account size` → `The account value you want sizing based on. You type it; Convexa never checks it against a broker.`
  `Max risk per trade` → `The most you're willing to lose on one trade. The AI is told this figure and asked to size within it. Nothing in Convexa enforces it.`
- Straddle basis line (visible, never tooltip-only):
  `From the {EXPIRATION} ATM straddle · {N} DTE · mid quotes · % of the {ANCHOR_LABEL} spot ${ANCHOR}`
  — anchor value and which spot both rendered **from the payload**, never derived client-side.
  <!-- spire:council-resolution:v1 e42c4455a4b53d3babf31616597ca9bb660061bef4c26331f88ce34f88d85691 folded -->
- Straddle advisory line: `What options are priced for — not a forecast, not a probability, not a scored signal.`
- Straddle tooltip (the only place the industry term appears, where it is defined and disarmed):
  > The at-the-money call plus put, priced together. Traders call this the "expected move" — it is
  > what the options market charges for the move, not a prediction and not a confidence interval.
  > Convexa shows it because it makes a target or a stop defensible, not because it is likely to be
  > right. The tooltip also names the other expirations carried in this read.
- Four-field literals and their tips: `—` → `No entry, so there is nothing to size.` · `not set` →
  `Convexa didn't send a risk figure, so the AI had nothing to size against.` + action
  `Set your risk inputs` · `unavailable` → `An input this needed was missing this cycle. Your other
  reads are unaffected.` · `not given` → `The AI produced a trade read but didn't fill this in.
  Nothing failed — it declined to answer.`
- Provenance chip: `Sized against your inputs · Account $50,000 · Max 1%/trade`, tip:
  > The AI was given these figures. This number is the AI's, not Convexa's arithmetic — check it
  > against your own before you act.
- Superseded strip: `Your risk inputs changed after this read. The sizing below is based on the
  earlier values.` + the existing `Get a fresh recommendation` action. In the drawer the same fact
  reads `Your risk inputs changed after this read. The values below are the ones sent.`
- Undetermined right: `The read doesn't say call or put — both legs shown.` /
  `The read doesn't say call or put — no quote shown.`, tip
  `Convexa only draws a quote when it can match the exact contract — strike, expiration and call/put.`
  The off-set literal `Not in the candidate set Convexa sent` must **not** be reused here: in the
  undetermined-right case the strike and expiration *are* in the set, so it would rename "we can't
  tell which leg you mean" as "we didn't send it" — the exact fabrication class this line exists to
  prevent.
- `no_trade` copy stays verbatim: `No trade — sit this one out` /
  `No entry to Accept — a 'no trade' read is a complete, correct answer.`
- Drawer labels: `Your risk inputs (as sent with this recommendation)` /
  `Your risk inputs (what the next request will send)`; unsent category:
  `Not sent — you haven't set this.`; zero omissions: `none omitted`.
- **No cap string exists for `no_trade`, deliberately.** There is no "not applicable" cap literal to
  write, because the surface renders nothing at all there.
- Egress note (server-composed from the closed category list, with the frontend fallback asserting
  the same thing; the enumeration follows what actually shipped):
  > This is the complete, reviewable list of what leaves the machine for {TICKER}, on demand: the
  > computed snapshot, the candidate contracts, your risk inputs, your open simulated positions,
  > your persona's prompt, and the field glossary. No other ticker, no name, email or login, no
  > broker credentials, and no API key ever leave. Nothing is ever placed as an order.

**One state, one word.** `not set` is the single literal for the owner-supplied-nothing state on
every surface — the rec panel, Settings, the cap readout and the drawer — because it is the only
member of this vocabulary the trader can act on and the panel's action reads `Set your risk inputs`.
Where a surface must name which field is missing it reads `Account size: not set` /
`Per-trade cap: not set` — the same literal, field-scoped. **`size not suggested` is a different
state, not a synonym**, and keeps its own literal: `not set` means the owner supplied no risk block;
`size not suggested` means the risk block is present and the model returned no size. They can be
true at the same time on the same screen and they are cleared by different people — one by the owner
typing, one by the model answering.
<!-- spire:council-resolution:v1 cb992bd15ab1a27527da44654357bf6d72d2a959a973ea652984c738804d7a96 folded -->

**Placement rulings.** The straddle read is a fifth sub-card inside the existing `market-context`
widget if the backend nests it there, otherwise a compact widget immediately after `iv-rank` — **no
twelfth bento widget for one scalar**; the board is at eleven and hierarchy is the page's scarcest
resource. The ticker widget renders **exactly one tenor** (the payload's designated primary,
matching AC-43); the additional tenors are reachable in the export drawer and named in the tooltip,
and a rec citing a different expiration is verified on the rec panel's own strip (AC-54) rather than
by a per-tenor table nobody scoped.

**No chain table in v1.** The candidate set surfaces in exactly three places: the cited-contract
fact line, the export drawer, and the one digested `What the numbers said` line the owner ruled in.
A ±15% band across expirations rendered on the bento *is* the raw dump the invariant forbids, it
duplicates a surface every broker does better, and it answers a question the trader did not ask
here. A chain browser, a strike screener or per-contract sorting/filtering is its own feature with
its own brief.

**The `no_trade` verdict is a result, never an empty state.** Once `max_risk` prints a real dollar
figure a trade verdict acquires visual weight the model never gave it, and that reproduces the exact
drift the brief warns about — through hierarchy rather than through the model. So the `no_trade`
card renders the same `Why` and `Levels in play` sections a trade card renders, gains the digested
liquidity line and the straddle move on the same strip, and no verdict state takes a success or
error palette slot, a count, a badge or an empty-state illustration. **And the cap surface renders
nothing on a `no_trade` card** — not the comparison, not a caveat, not a cap readout, not a `not
set` cap literal. A *couldn't check* line there would read as Convexa having tried and failed to
audit something, on the one verdict the app itself calls a complete, correct answer; the rec asserts
no risk figure, so there is nothing to audit, and the four fields' `—` already says so once. The
wire carries that as a verdict token (§2.5, `not_applicable`) so the frontend renders by lookup and
never by testing a null.
<!-- spire:council-resolution:v1 c134ba40fb367ac00f8eca10acc9ec51acbc5b2160998d4bc517c2ec4434725b folded -->
<!-- spire:council-resolution:v1 ff3e6c92ebf684b20d6810026ef8945e42c845e6d7b6bd5e54d86f69832a344f folded -->

**Convexa states the comparison; it never blocks and never refuses.** The disagreement was never
enforcement versus non-enforcement — both lanes agreed the action stays enabled. It was whether the
app is allowed to say out loud that 900 is larger than 400 on the one screen where being wrong costs
the owner real money. It is: on a verdict that states an entry, the comparison is stated once,
non-blocking, in `warning.*` + icon per the design canon's warning rule, and the **same annotation
persists at the sim-entry confirm step**. The comparison is computed once server-side and passed
down as a rendered result — the shared `TradeEntryDialog` receives the verdict token and the two
numbers as props and **never recomputes them**, because two computations of one verdict will
disagree the first time the parse changes. The client still performs no arithmetic on the owner's
entered values, and there is no sizing calculator, no affordable-contract count and no
contract-count stepper anywhere.
<!-- spire:council-resolution:v1 c5fe2f827c09f8ee3f393564faa7c18d37214864e9cc00c09e6da418037b8ac5 folded -->
<!-- spire:council-resolution:v1 7f314ca008e6543f26b0ce1e83713569dc248d283e143e01ed68ce1251e1abf1 folded -->
<!-- spire:council-resolution:v1 6232972a62c830f14013823ae476812f3500f2efe496c3015359e37138a28a7a folded -->

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (**Status: SET** — The
Curvature Terminal). This section adheres to it and restates none of its token table.

**Design direction — how this feature applies the canon:** honesty copy carries window/basis/anchor
**in body**, never tooltip-only (canon rule 4); the cap annotation uses `warning.*` **plus icon**,
never brand amber (rule 5); green and red stay reserved for direction, so nothing added here takes a
success or error slot; every figure is IBM Plex Mono, tabular, and no stat value is a heading
element; static reads never fake live and never dim on a stream drop (rule 3); the sim entry stays
the one shared `TradeEntryDialog` (rule 10); no new keyframes and no fourth convex-arc spend; zero
hardcoded hex, mode-aware values through `extrasFor(theme)` only; ≥44px targets and no 393px
overflow. **Two extensions are Amendments to the design canon, recorded in its Amendments log at
build time — not a second system invented here:** (1) a **unit-bearing numeric input** (money /
percent with an explicit unit control), because Settings has no money input today and global
form-control radius is a declared undeclared axis; (2) two named members of the app's closed
not-a-number vocabulary — **`not set`** (the only member the trader can fix) and **`size not
suggested`** (the model returned no size) — each with the one-sentence test above for telling them
apart.

## 5. Error handling

| Failure class | What the user sees | What is logged / retried |
|---|---|---|
| Chain snapshot unavailable for the ticker (dedicated read) | `404` from the dedicated endpoint; the ticker page is unaffected because nothing on it calls that route | the existing analytics error path; no retry storm, singleflight coalesces concurrent callers |
| Candidate assembly faults after a snapshot was obtained | `200` with `state: unavailable`; the strip reads `Candidate set unavailable this cycle.`; the drawer's section says the same; the rec still produces and its `position_size`/`max_risk` carry `unavailable` with the missing input named | warn-level with the ticker and the reason; no retry |
| Band holds nothing | `200` with `state: none_in_band`; the strip reads `No candidates in band this cycle.` — visibly a *checked, empty* answer, not a failure | none |
| Straddle move cannot be computed | bundle still `200`; the member carries its closed state; the widget renders `Straddle-implied move unavailable this cycle.` or `No ATM straddle quote this cycle.` or `No expiration inside your current window.` — three causes, three literals, chosen by wire token | warn-level once per compute |
| ATM leg has no two-sided quote | the market-quote basis is not used; either the read states the no-quote reason, or an IV-derived estimate renders **under a different basis value** that the copy names | none |
| Risk block unreadable at rec time | the rec still produces; every risk figure renders `not set`; the cap verdict is `no_cap`; no rec fails because of a settings read | warn-level; the auth carve-out keeps auth errors as real statuses on the auth routes only |
| Risk-block save without a session | server rejects with the shipped auth status; the panel shows the sign-in line; nothing is stored | the existing auth path |
| Risk-block save while storage is unavailable | `Risk inputs can't be saved on this deployment right now. Nothing was stored.`; no value is claimed as saved | existing storage-availability path |
| Settings record fails to parse | the owner sees defaults; the stored original blob is **not** overwritten | error-level with the user id, never the values |
| Client positions store faulted | context reports `positions unavailable`, never `none open`; the rec still produces | client-side only |
| No positions digest sent (old client, disabled) | context reports `not sent`, distinct from `none open` | none |
| Model omits the right token, or returns multiple strikes | no cited contract; the undetermined-right or off-set literal renders per §4; no quote figure | none — this is a designed state, not a fault |
| Verdict is `no_trade` | **no cap surface at all** — no comparison, no caveat, no cap readout. `cap_check.verdict = not_applicable` still rides the envelope, so the drawer and any later reader can see that no audit was owed rather than that one silently vanished | none — a designed state, not a fault |
| `max_risk` not parseable as dollars **on an entry-stating verdict** | `not_checkable` verdict, `Couldn't check against your cap.`; never a pass by default | none |
| Both of `position_size`'s inputs absent on one request | one `unavailable` literal naming the risk block (the fixable input); never two reasons, never an unnamed one | none |
| Prompt assembly exceeds the byte ceiling | the constructor truncates by the documented ladder (strikes per tenor/right first) and the artifact states the counts it actually carried | warn-level with the byte count |
| SSE drop | nothing in this feature changes: every datum here is STATIC and keeps rendering the last bundle un-dimmed | existing stream-isolation path |

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/tradeable-rec-inputs/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** one **new** endpoint (`GET /api/candidates/{ticker}`, the
deliberate pull) and four **existing** endpoints extended additively —
`GET /api/ticker/{ticker}` (one new `market_state` member), `GET /api/auth/settings` +
`PUT /api/auth/settings` (the risk block), `POST /api/recommendation/{ticker}` (as-sent echo, cap
verdict, field reasons, cited contract, right token) and
`GET /api/recommendation/export/{ticker}` (candidate, risk-input and positions sections plus the
amended egress note). Nothing is removed and nothing changes shape for an existing consumer. This is
**not** `NO_BACKEND_CHANGE`. The authoritative field list, presence vocabulary and the
machine-checkable conformance block live in that file and are never restated here.

## 7. Testing strategy

**Risk-based, not one test per row.** Automate what regresses **silently** under an unrelated
change; review what a human notices on a normal pass.

**Automated (`test`) — the silent-regression surface:**

- **Byte-identity of score / tier / `state_fingerprint`** with and without each of the three new
  input families, **on both `build_bundle` branches** (`dark_pool=true` cached-signals and
  `dark_pool=false` re-score). A proof run on the default branch only is not a proof. Backed by the
  poison test: adding any new datum to the scoring input list must turn it red, and the poison test
  itself must be shown to bite.
- **The caps.** Feed the selector a chain that would emit more than the ceiling; assert truncation
  and assert the guard bites when the ceiling is raised in a test build. Both the record ceiling and
  the byte ceiling.
- **The dump line.** A source scan asserting the candidates module is not referenced from the bundle
  path, mutation-tested for non-vacuity, mirroring the shipped import allow/deny stack.
- **The tenor intersection.** Construct a move with three tenors and candidates with two; assert the
  assembled prompt carries exactly two moves; widen the restriction and prove the assertion can
  fail.
- **The drop ledger.** included + Σ dropped = rows scanned, with the fixed reason order asserted.
- **The cap verdict's fixed order.** A `no_trade` fixture with a cap set must yield
  `not_applicable` and render no cap surface; the same fixture with no cap set must yield the same
  thing (not `no_cap`); an entry-stating fixture with a null risk figure must still yield
  `not_checkable`. These three together are what stop the Critical from being reintroduced by a
  later refactor of the verdict switch.
- **The account-size exclusion (AC-29a).** Two arms, in the outcome-ledger module's existing
  boundary spec: a behavioural arm (a rec produced under a risk block, entered and closed, yields a
  ledger export whose serialized form contains no account-size value) and a source arm added to the
  shipped mutation-guarded `?raw` scan over `features/trading/**`, asserting no module writes an
  account-size value into a ledger or decision record. The source arm carries the same anti-vacuity
  assertion the existing scan uses, so a guard that cannot bite fails on its own terms.
- **Presence vocabulary and coercion traps.** A zero-bid row and a greeks-absent row in a fixture:
  assert the former never yields "no quote existed" and the latter never yields `0.0` as an IV or a
  greek.
- **The `missing_input` tie-break.** A fixture with no risk block **and** no candidate quotes must
  name the risk block, on every run.
- **Match-key totality.** A compile-level assertion that the match key cannot be constructed without
  a right, plus a test that a multi-strike or right-absent rec renders no per-contract quote, and
  that the undetermined-right case never renders the off-set literal.
- **No parse of `position_size`.** A source scan proving no parse function is reachable from that
  field on either side of the wire.
- **Settings migration.** An old record and a corrupt record: defaults, no fault, original blob
  intact.
- **Server-side gate.** Both sides proven — a bypassed client is refused and a valid session
  succeeds.
- **Copy parity.** The server egress note and the frontend fallback assert the same thing; a copy
  edit that drops the egress sentence from the Settings section helper, or a layout refactor that
  reorders it below the first input, must fail (presence **and** DOM order).
- **Literal integrity.** Each of the four rec fields renders exactly one member of the closed set;
  `null`/`undefined`/`NaN`/`0`/empty never render.
- **Static-family behaviour.** The move stays un-dimmed with no offline marker on a simulated SSE
  drop.
- **Design enforcement.** The shipped hex-discipline, warning-icon, motion-inventory and 393px
  no-overflow suites cover the new surfaces; no new keyframe family is introduced.

**FE test tiers.** Unit for the pure helpers (literal selection by wire token, closed-lookup
rendering, digest derivation from the positions store). Component for each state table row in §4
(default / loading / empty / error / anonymous / superseded / `no_trade`). Integration for the
flows — Settings save, rec render, drawer enumeration, entry-from-rec — mocking **the network
boundary only**; no component-level mocks of app internals, and no mock of the closed vocabularies
themselves.

**Reviewed (`review`):** wording, ordering and intentional presence — the tooltip's exclusive
ownership of the term "expected move", the never-set consequence line's non-error styling, the
storage-unavailable copy, the single-literal sweep, the operator-route and export absence of account
size, the simulated labelling, the drawer's two sections, the same-rule assertion across both
budgets, and the before/after verdict comparison the owner signs off.

**Invariants that must never silently regress:** score/tier/`state_fingerprint` byte-identity on
both branches · the record **and** byte ceilings · candidates absent from bundle and SSE · the
tenor-intersection restriction · the drop-count sum · `0.0` never shipping as an IV or a greek ·
no per-quote freshness claim · the match key's mandatory right · one server-side parse of `max_risk`
and none of `position_size` · one cap computation, pinned, with `not_applicable` resolved first ·
no cap surface on a `no_trade` card · no account size in a persisted client artifact · no client
arithmetic on entered values · the egress note's truth.

**Named pre-commit measurement, before or at the build's first verification pass** (it could not be
run inside the council — no shell and no vendor key in the authoring seat, and asserting otherwise
would have been the exact failure that seat is warned about):

1. **Quote-fill.** One **evening** snapshot (post-16:00 ET, ideally 20:00–23:00 ET) and one RTH
   snapshot for contrast, on SPY and on one thin single-name from `apps/api/config/universe.json`.
   For each count: total rows; rows with both sides present; rows with exactly one side; the same
   three restricted to the ±15% band ∩ the active DTE window; and the same three restricted to the
   64-record candidate set. **The candidate-set fill rate is the number that decides anything** —
   ranking by nearness to the anchor concentrates the set on the liquid part of the chain, so a
   whole-chain fill rate understates it. Count vendor-null separately from filtered-zero **off the
   raw rows**, not off `Contract`, or the `> 0.0` filter biases the result toward "no quote".
2. **Vendor quote timestamp.** In the same pass, inspect one raw vendor chain row for a quote
   timestamp. This decides whether quote age is a per-contract or a set-level fact.
3. **Prompt size.** Measure the current assembled prompt plus 20 candidate records plus the risk
   block plus the positions digest.

**Pre-committed responses, so the design does not wait on the numbers:** candidate-set fill healthy
at night ⇒ ship as designed. Near-zero at night and healthy in RTH ⇒ the straddle basis falls to the
IV-derived enum after hours and most candidate rows carry the no-two-sided-quote state; the design
is unchanged and honest, the AC set gains an evening fixture, and the scope fact is recorded (at
night the candidate set is a *stated-empty liquidity picture*, not a liquidity picture). Near-zero in
RTH too ⇒ the liquidity half of the candidate set is not deliverable on this vendor tier and that is
a scope escalation (§9). If the measured prompt total exceeds budget, cut **strikes per (tenor,
right)** first — 2 × 2 × 4, then 2 × 2 × 3 — and escalate to the owner only if 2 × 2 × 3 still does
not fit. **Do not fall back to one tenor:** the intersection invariant is what keeps the
off-set literal a real fabrication guard instead of a routine false positive, and one tenor makes
the model's honest answer look like a fabrication.

## 8. Guardrails this feature must not break

- **`[additive-keeps-score-byte-identical]` (HARD).** Every field here is AI-context/display and is
  **never** an input to `signals`, scoring, the entry gate or `state_fingerprint`. The enforcement
  is the call graph, not discipline: `generate_signals` consumes a `MarketState` built by
  `market_state_from_gex(...)`, a function with a **fixed positional argument list**; a value that
  is not one of those arguments cannot reach the score. Stronger still for the risk block —
  `quant-engine` is a separate crate that does not depend on `api-rust`, so account data physically
  cannot be linked into the scoring code. Proof obligation is AC-83 on **both** bundle branches.
- **`[best-effort-isolated-or-null]`.** Every added bundle computation is best-effort: a failure
  yields a stated state and never an HTTP error, leaving `market_state`, `strike_profile` and the
  SSE path intact. The dedicated read takes the `/api/contract` carve-out instead (a real not-found
  for a subject that does not exist; everything else a 200 with a state).
- **`[digested-labels-not-raw-dump]`.** In direct tension with the candidate set, and the line is
  held three ways: the set never rides the bundle or SSE, it is hard-capped by a type at both a
  record and a byte ceiling, and the only trader-facing surfaces are one fact line, one digested
  strip line and the export drawer. The wire enum/token is authoritative everywhere; the frontend
  renders by closed lookup and never re-derives a label from an underlying scalar. If a passive page
  load ever carries a chain table, the resolution has been abandoned.
- **`[model-read-carries-its-assumptions]`.** The straddle move carries its tenor, DTE, the strike
  actually used and its distance from the anchor, the anchor spot and which spot that is, its quote
  basis, the wide-quote threshold and its marker — advisory context, never a forecast, a probability
  or a scored signal.
- **`[no-real-order-path]`.** The risk block sizes nothing and submits nothing. This feature adds no
  write path except the owner's own risk-block save; acting on a rec reaches only a SIMULATED
  position behind the existing mandatory confirm; no broker, order or execution surface appears
  anywhere; no sizing calculator and no contract-count stepper.
- **`[absent-is-not-none]`.** Five distinct not-a-number families survive to the consumer as closed
  states, never as a bare null: per-contract quote presence (quoted / no two-sided quote) · straddle
  cause (no quote / not computed / no expiration in window) · risk-block absence (`not set`, and
  `size not suggested` as the separate model-side absence) · positions (`none_open` / `not_sent` /
  `unavailable`) · cap audit (`not_applicable` — nothing to check — kept distinct from
  `not_checkable`, which means we tried and could not read the figure). Enforced in the type and the
  closed vocabulary, not in prose.
- **`[live-vs-static-isolation]`.** Every datum here declares **STATIC**. Nothing rides SSE, nothing
  dims on a stream drop, nothing gains an offline marker.
- **`[server-side-gate-enforcement]`.** The risk block is per-user server-side state; its write
  resolves the session **before** applying the patch, by the mechanism already used for settings. A
  bypassed or absent client check is still refused at the server (AC-24). The frontend check exists
  for UX, not enforcement.
- **`[structural-over-prose-enforcement]`.** Five poison-class guards, each proven non-vacuous:
  raise a cap and the guard must bite; reference the candidates module from the bundle path and the
  scan must go red; add any new datum to the scoring input list and the fingerprint-identity test
  must go red; widen the tenor restriction and the intersection assertion must fail; write an
  account-size value into a ledger or decision record and the outcome-ledger source scan must go red
  (AC-29a). The cap lives in the return type, the match key cannot be constructed without a right,
  and no risk-block type has a zero-means-unset inhabitant.
- **`[single-shared-sim-entry-dialog]`.** The rec's entry path launches the one shared
  `TradeEntryDialog`; the cap annotation is an additive prop, never a forked second dialog, and
  never a real-money surface.
- **`[loss-free-durable-migration]`** (server-side analogue). A settings record that fails to parse
  degrades to defaults **without destroying the original**; existing records read forward.
- **`[theme-token-discipline]` / `[single-motion-moment]`.** Mode-aware values through
  `extrasFor(theme)` only, zero hardcoded hex, no new keyframe family, no fourth convex-arc spend.

## 9. Open questions

Every R2 conflict is resolved in the text above, and the S2 skeptic's Critical and Important
findings are folded into §2.5, §3 (AC-58a, AC-72a), §4 and §5. What follows is **deferred to a named
measurement**, with the response to each outcome already pre-committed in §7 — listed here because
each could still change scope after approval and none of them can be settled by argument:

1. **Evening candidate-set quote fill.** If the measurement (§7.1) shows near-zero two-sided quotes
   in the candidate set *in RTH as well as at night*, the liquidity half of the candidate set is not
   deliverable on this vendor tier and that is a **scope escalation to the owner before the build's
   first verification pass**, not a defect. The night-only case ships as designed with an evening
   fixture added.
2. **Whether the vendor sends a per-row quote timestamp** (§7.2). If it does, per-quote age becomes
   a like-for-like substitution in the slot `quote age: unknown` already occupies. Anything larger
   than that substitution is a separate additive follow-up, deliberately not this feature.
3. **The measured prompt budget** (§7.3). The cut ladder is pre-committed (strikes per tenor/right
   first: 2 × 2 × 4, then 2 × 2 × 3); the owner is consulted only if 2 × 2 × 3 still does not fit,
   and the choice put to them is "one expiration covered deeply versus two covered thinly" — never a
   silent drop to one tenor.
4. **The acceptable regression in rec round-trip time.** No measured baseline exists today, so no
   threshold is invented here. The proposal on the table is "no more than ~1s above today's measured
   baseline", to be confirmed against the measurement in §7.3 rather than asserted.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"90073ec39f8ff5d1358eca708ff5e2b61287fd49bf4f6c1df0a7b5c249ce56eb","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":1,"conflict_id":"16511e5bc2aa39b00e1d13cd8d3be8f22d7fb6a1f94fc103290ffcda2a81c30b","disposition":"folded","section":"§3"},{"source":"R2-architect.md","index":2,"conflict_id":"7ab2bb4fd7f5d498d0328da747e2a7b56ad368891405b75956929727ae93d33d","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":3,"conflict_id":"54314ed90b9802c7e2fac751ad1ee87a1efd169a1e51693b14686073117a2632","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":4,"conflict_id":"b3fb59df24b90ea686bb718de6e1587b3628400902f71f0e66776a52b0595228","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":5,"conflict_id":"ff3e6c92ebf684b20d6810026ef8945e42c845e6d7b6bd5e54d86f69832a344f","disposition":"folded","section":"§4"},{"source":"R2-architect.md","index":6,"conflict_id":"7f314ca008e6543f26b0ce1e83713569dc248d283e143e01ed68ce1251e1abf1","disposition":"folded","section":"§4"},{"source":"R2-architect.md","index":7,"conflict_id":"f1259f15e95ad46cd2b061e4f16dceff9102837bf4364c66a78d50d3d0429327","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":0,"conflict_id":"5a6006c462db03f35eb1db56698c0dc1539596234ea428b3549327cc0ff2a3ba","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":1,"conflict_id":"6232972a62c830f14013823ae476812f3500f2efe496c3015359e37138a28a7a","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":2,"conflict_id":"0e325aa0552e122a06ff5e3b8f260f423b0e121b16c46ffee7e739ee4ce85263","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":3,"conflict_id":"3f64a61d809e5b1144f5b6c65636998d8b62a543b59bbc42d573b2ec9634789f","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":4,"conflict_id":"c134ba40fb367ac00f8eca10acc9ec51acbc5b2160998d4bc517c2ec4434725b","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":5,"conflict_id":"6b77b44f891147b191ff2ba6f22f9d1cc9c365ab8de7ab1c94ad1c7d3b3ab8b0","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":6,"conflict_id":"56b47beb884caf75c2a2c245c9e005f1bd1dc3e5af8748b6efb3932d46b6e146","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":0,"conflict_id":"e053ee0a1ae3a0bd27698e5a980387cbdcb6d321c34db60c25ae716ba934fe9e","disposition":"folded","section":"§1"},{"source":"R2-ux.md","index":1,"conflict_id":"5e7c21d3edfabd6f42aefe8892af6bd402f3447ef417005fd8a58f96b3fdb098","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":2,"conflict_id":"3458de7fd48baa4f9ca15897987077ad1b9579315bb9003ee7c10959358dfb56","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":3,"conflict_id":"cb992bd15ab1a27527da44654357bf6d72d2a959a973ea652984c738804d7a96","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":4,"conflict_id":"7d61862856b7b0a66f0c6d435617e8650fc7ab722baa379310d663ebfc76402c","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":5,"conflict_id":"c5fe2f827c09f8ee3f393564faa7c18d37214864e9cc00c09e6da418037b8ac5","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":6,"conflict_id":"e42c4455a4b53d3babf31616597ca9bb660061bef4c26331f88ce34f88d85691","disposition":"folded","section":"§4"}]}
-->
