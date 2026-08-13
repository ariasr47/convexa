# R3 — decisions: tradeable-rec-inputs

> Controller record of every conflict outcome. Ids are the first 8 chars of `conflicts.json`
> `conflict_id`. Binding on R4 synthesis.

## Self-revisions folded (a voice retracting its own R1 — no exchange)

- **f1259f15 (architect withdraws "C rides alongside"):** v1 open-positions source = the
  client-supplied **SIMULATED digest only** (source A). The wire carries a source label as a
  **closed enum with exactly one inhabitant today (`simulated`)** so a future broker source is an
  additive variant, not a shape change. Nothing is persisted server-side.
- **6b77b44f (pm withdraws AC-4 "strictly fewer expirations"):** replaced by two observables —
  (a) window-subset invariant: no expiration outside the active DTE/expiration window ever appears
  in the candidate set, and narrowing the window never ADDS an expiration; (b) cap disclosure: when
  the window holds more expirations than the cap, the surface names how many were included and that
  others were omitted by the cap — extended to strikes dropped + reason.
- **c5fe2f82 (ux withdraws the "warns on" clause):** the cap comparison is a **stated, non-blocking
  comparison** — `warning.*` + icon treatment per the design system (never brand amber, never the
  green/red direction slots); the same annotation **persists at the sim-entry confirm step**
  (AC-31); Convexa still never blocks and never refuses. The comparison reaches the UI as a
  **closed verdict token + the effective cap it used**; the client performs no arithmetic on the
  owner's entered values.
- **e42c4455 (ux withdraws its basis line as incomplete):** basis line becomes
  `From the {EXPIRATION} ATM straddle · {N} DTE · mid quotes · % of the {ANCHOR_LABEL} spot ${ANCHOR}`
  — anchor value and which-spot rendered from the payload, never derived client-side; tooltip
  explains why the gamma anchor rather than the live tape.

## Converged without an exchange (controller-folded)

- **7ab2bb4f + 0e325aa0 (percent cap vs "FE performs no multiplication"):** the two raisers
  independently proposed the SAME fix — the **effective dollar cap is derived exactly once,
  server-side**, at the same place the risk block is read for prompt assembly, shipped as its own
  wire field carrying its unit + the inputs it was derived from + **closed not-derivable states**
  (percent-with-no-account-size; nothing entered — never a silent zero). The FE renders received
  numbers verbatim: entered values verbatim in the provenance chip, the derived figure labelled
  "derived from your inputs", never "validated/checked/enforced". U-17 stands; AC-28 becomes
  implementable for percent caps.
- **Product 7f314ca0 + 6232972a (enforcement cluster):** mooted by c5fe2f82. Resolution as recorded
  there; additionally (architect's condition, accepted): the comparison is **computed once
  server-side and passed down as a rendered result** — never recomputed inside `TradeEntryDialog`.
- **Product 5a6006c4 + e053ee0a (broker book in v1):** mooted by f1259f15. Broker-book exposure is
  **OUT of v1**, future-dated behind PM's named trigger (one full week of owner-verified daily use,
  as its own feature). UX's three-state positions matrix and copy stand; the egress-copy amendment
  scopes to the simulated digest only.
- **16511e5b (AC-4 falsified on SPY):** mooted by 6b77b44f — same AC withdrawn by its author.

## Owner rulings (R3 product calls)

- **c134ba40 + ff3e6c92 — RULED A by the owner (2026-08-12): the no_trade liquidity read ships.**
  A third candidate-bearing surface is ruled IN, digested rather than tabular: **one line inside
  the existing "What the numbers said" strip, rendered on EVERY verdict including `no_trade`**,
  carrying set-level facts about what the model was actually sent — candidate count across
  expiration count, an ATM relative-spread band label, and the wide-quotes marker when it fires —
  computed **server-side** from the candidate set (architect's digested set-level summary is the
  content definition), never per-contract rows, no strike axis, no sorting, no expansion. UX §6's
  "no chain table / grid / browser" line still stands for anything beyond this line; AC-32 is
  satisfiable as written; `[digested-labels-not-raw-dump]` honored (closed labels on the wire,
  FE renders by lookup).

## R3 exchange outcomes (ONE exchange — every item ACCEPT, zero holdouts)

Full responses in `R3-response-{pm,architect,ux}.md` — those files are binding on R4; this is the
index:

- **90073ec3 ACCEPT (pm):** set-level basis only — one `as_of` + one session classification for the
  whole candidate set; per-contract presence stays a closed state (quoted-in-snapshot /
  no-NBBO-in-snapshot / quote-age-unknown default). No per-quote live/prior-close claim. Per-quote
  age is future-dated behind the vendor-timestamp pre-commit check.
- **54314ed9 ACCEPT (pm, option b):** the numeric pre-fill LEAVES v1 — `position_size` renders as
  the prose it is and is **never parsed by any lane**; `max_risk` is parsed **once, server-side,
  for the cap check only**. AC-37 widens to no-PARSEABLE-size. A typed size field is future-dated
  and explicitly barred from riding the 7d618628 schema change.
- **3458de7f ACCEPT (pm):** ONE cap stored as `{value, unit ($|%)}`; local refusals for
  nonsense values; AC-12 restated against the dollar-entered case; effective dollar cap arrives
  derived server-side (per the 7ab2bb4f fold).
- **cb992bd1 ACCEPT (pm):** **`not set`** is the single literal for an absent risk block across
  every surface; `size not suggested` stays a distinct state (absent MODEL OUTPUT, not absent
  input).
- **3f64a61d ACCEPT (architect):** candidate block carries **two tenors** (nearest in-window +
  the tenor bracketing the far end of the window); the expected-move block sent to the model is
  **intersected with the tenors that have candidates** — the model is never handed a move for an
  expiration it cannot price. Counts actually sent are stated on the payload + enumerated in the
  export drawer. Named cost accepted: the assembler forwards a **pruned clone** of `market_state`
  (`llm.rs:137` currently forwards it wholesale) — the "no prompt rewrite" non-goal is amended to
  permit exactly that prune.
- **7d618628 ACCEPT (architect):** the rec schema gains an explicit **right token** (call/put) —
  one clause in the schema string + one coercion in `parse_strategy_json` modelled on the `bias`
  coercion **but with NO default**; machine identity = strike + expiration + right.
- **5e7c21d3 ACCEPT (architect):** up to three move tenors on the wire for the model; the UI
  renders exactly ONE (nearest in-window); additional tenors reachable in the export drawer +
  named in the tooltip.
- **b3fb59df ACCEPT (ux, one correction):** match on the FULL identity or refuse — the match-key
  type is unconstructable without a right; when the right is undetermined the fact line renders the
  undetermined-right degradation (NOT the off-set literal, which would assert a falsehood).
  U-20 splits into U-20a..d, all `test`.
- **56b47beb ACCEPT (ux):** the egress sentence moves into the section helper ABOVE both risk
  inputs (visible before first save); field helpers unchanged; U-1 escalates review → test
  (presence + DOM ordering); new U-1b for the `View what's sent` link.

## Cross-response reconciliations (controller-folded after the exchange)

- **PM's AC-39 dependency (a):** stands — UX code-verified anonymous reachability
  (`recommendation.rs:42`, `AiRecPanel.tsx:126`), and the export path keeps the shipped **no-LLM,
  no-fetch floor** (404-if-unfetched); the interface contract must state that an anonymous
  candidate pull **never triggers a vendor fetch** — if synthesis cannot honor that, AC-39 is
  withdrawn per PM's condition.
- **PM's dependency (b):** satisfied — the rec envelope already pins `as_of` +
  `pinned_fingerprint` (`recommendation.rs:436-437`); the **as-sent risk block + cap verdict ride
  the same envelope**, so the export drawer shows as-sent values (UX: as-sent is authoritative;
  superseded strip compares against current store).
- **Drop-count surface:** with the owner's A ruling, the drop-count-with-reason joins the digested
  strip line (its content definition already includes it); the export drawer keeps the full
  enumeration.
- **Two wire coercion traps are BINDING implementation constraints** (architect, code-verified):
  `bid`/`ask` are filtered `> 0.0` at `rest.rs:823-824` (a legitimate zero bid is
  indistinguishable from absent — the fill-rate measurement and the presence vocabulary must say
  "no two-sided quote", never assert "no quote existed"); IV is coerced to `0.0` when greeks are
  absent (`rest.rs:813-817`) — `0.0` is an **unpriced sentinel that must never ship as an IV**.
- **Session-basis token:** set-level, from `MarketPhase::classify` (`domain/market.rs:20-47`) —
  the differently-membered classifier at `routes/stream.rs:61-80` must NOT be conflated with it.
- **PM's pre-commit quote-fill check:** could not be run in-council (no key/Bash in the author
  seat); the architect supplied the procedure + pre-committed design responses per outcome. It
  lands as a **named plan/verification step** (evening SPY + thin single-name fill-rate
  measurement) before or at the build's first verification pass, per PM's ask.
