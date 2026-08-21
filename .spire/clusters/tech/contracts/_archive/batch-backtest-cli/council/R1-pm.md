# R1 — pm position: batch-backtest-cli

## Position

### Who this is for, and what job it does

One user: the research operator / owner. He already pays ~$199 Stocks + ~$199 Options per month,
and as of `chain-snapshot-capture` those paid books are kept as dated research snapshots. Today
`score-lab` (P2) can rank the **digested** structure diary against joined daily bars — it never
reloads a stored chain. What he still cannot do is **replay our own compute over the exact paid
books we kept**, offline, and get a dated research report he can re-run.

The job: **turn saved paid books into a measurement** — list/load dated snapshots with zero live
Massive calls, run our offline analytics compute on each selected book, support multi-symbol and
time-based splits, and emit an artifact report. The surface is a **research CLI** (console output +
saved artifact). There is no trader-facing surface. A report **measures**; it does **not** authorize
a live score / weight / gate / fingerprint change.

---

### User stories

- **S1** — As the research operator, I want to **replay our offline compute over stored dated
  snapshots** for one or more symbols, **so that** the $398/mo spend produces a measurement of
  score / structure / GEX on the exact books we already paid for — not only a live desk.
- **S2** — As the research operator, I want a run to complete with **zero live Massive calls**,
  **so that** replay never re-bills, never depends on vendor availability, and never silently
  "fills in" a missing book from the live feed.
- **S3** — As the research operator, I want a **second run over the same corpus** to produce a
  **byte-identical** report (aside from run timestamp / output path), **so that** I can trust the
  measurement is deterministic research, not a drifting live path.
- **S4** — As the research operator, I want **multi-symbol** selection and a **time-based split**
  named in the report, **so that** I can measure across the books I kept and separate earlier books
  from later books without hand-splitting files.
- **S5** — As the research operator, I want **honest empty / missing / unreadable / partial**
  outcomes that are textually distinct, **so that** "no snapshot stored," "empty book," and
  "replay failed" can never be mistaken for each other or silently repaired by a live fetch.
- **S6** — As the research operator, I want a **dated artifact report** that carries the run's
  corpus identity, split, per-book outcomes, and an explicit **measurement-only** statement,
  **so that** quoting the report later cannot be mistaken for permission to change the live score.
- **S7** — As the desk owner, I want this CLI to stay **off every trader route and trader UI**, and
  to **leave live score / tier / fingerprint untouched**, **so that** research measurement cannot
  drift the desk (`operator-vs-trader-path-separation`, `additive-keeps-score-byte-identical`,
  `score-change-is-deliberate-and-measured`).
- **S8** — As the research operator, I want this feature to **sit beside `score-lab`, not silently
  replace it**, **so that** digested-diary ranking (P2) and stored-chain replay (P3) remain two
  named tools with two jobs.

---

### Scope

**In**

1. A **research CLI** that lists and loads **already-captured dated snapshots** and runs our
   **offline analytics compute** on each selected book.
2. **Zero live Massive calls** on list, load, replay, and report paths for a corpus drawn from the
   store.
3. **Multi-symbol** corpus selection from what the store actually holds (not a hardcoded universe
   pretending to be inventory).
4. A **time-based split** of the selected corpus, with the split rule and membership **printed in
   the report** so earlier vs later books are not inferred by the reader.
5. A **dated artifact report** (console + saved file) summarizing what was replayed: corpus
   identity, symbols, as-of range, split membership, per-book / aggregated measurement outcomes,
   and counts of skipped / failed / empty / missing items.
6. **Deterministic re-run** — same corpus + same split inputs → byte-identical figures and
   substantive report body (timestamp / output path may differ).
7. **Honest degraded states** as first-class outcomes (empty store, no snapshots for a symbol,
   missing as-of, unreadable book, per-book compute failure, partial multi-symbol corpus) —
   never a silent live fetch, never a fabricated chain.
8. **Measurement-only guardrails** — every run states that the report authorizes **no** live score /
   tier / gate / fingerprint / weight change; the run performs **no** such write.
9. **Coexistence with `score-lab`** — P3 does not delete, rename-away, or silently subsume the
   digested-diary lab; both remain invocable research tools.
10. **Hermetic verifiability** — the behaviors above are checkable from CLI output / artifact files
    and vendor-call counters, without a trader UI and without live Massive credentials.

**Out (this feature)**

- Buying vendor **hist-chain** / historical IV / indices products (P7 and kin) — different spend.
- Any **trader UI**, trader route, nav item, or redistribution of stored books as a trader feed.
- Any change to live **opportunity score / tier / entry gate / fingerprint basis / weights**.
- Treating a report result as an **adoption decision**, "winner," or authorization to change live
  scoring — measurement only.
- Replacing or deleting **`score-lab`** / the digested-diary weekly loop.
- New capture / retention policy work (already shipped by `chain-snapshot-capture`); this feature
  **consumes** the store, it does not redesign it.
- Outcome synthesis, broker P&L labels, or inventing forward outcomes that are not already
  available to research (blocked-on elsewhere; do not smuggle in).
- AI lab / multi-model offline eval (P4) — blocked-on this, not absorbed here.
- Pixel layout, theme, motion, or any dashboard chrome.

**Future-dated (named, not built)**

- Joining replayed chain compute to richer outcome ledgers / multi-week roll-ups across saved
  artifacts (the shape a deliberate score-change feature would cite).
- Vendor point-in-time hist-chain **if** later purchased (separate GATE I).
- P4 AI lab offline eval over replayed books.
- Optional operator dashboard for replay health (only under the same operator-vs-trader separation;
  not required to ship).
- Regime splits beyond the time-based split required here.

---

### Product behavior

**Actors:** research operator / owner at a terminal. **Not** the signed-in trader on Landing /
Ticker / Positions / Scanner.

**Happy path (observable without reading source):**

| Situation | What must be true |
|---|---|
| **Corpus with stored dated snapshots for ≥1 symbol** | Operator runs the research CLI; each selected book is loaded from the store and passed through our offline analytics compute; a dated report is emitted (console + artifact file). |
| **Multi-symbol run** | Report names every included symbol and reconciles how many books were selected / replayed / skipped per symbol. |
| **Time-based split** | Report states the split rule in force and which books landed in which split bucket; split membership is readable without opening source. |
| **Vendor isolation** | The entire run performs **zero live Massive calls** (vendor-call counter stays at 0). |
| **Second identical run** | Re-running over the same corpus + same split inputs yields a **byte-identical** substantive report (figures and state markers match; only run timestamp / output path may differ). |
| **Desk unchanged** | After the run, live score / tier / fingerprint for the same market inputs are unchanged; no trader surface appeared. |
| **Beside score-lab** | The existing digested-diary lab remains separately invocable; this run's report is clearly a **stored-chain replay** report, not a silent substitute ranking of diary samples. |

**Degraded / edge states (each its own outcome — not footnotes on the happy path):**

| Situation | Observable outcome |
|---|---|
| **Empty store** (nothing captured / capture off / fresh install) | Run reports **empty store / zero snapshots** honestly; writes **no** result artifact that could later be read as "ran and found nothing interesting"; **no** Massive call. |
| **Requested symbol has no stored snapshots** | Report / console names that symbol as **no snapshots stored** — distinct from "empty options book" and from "replay error"; **no** Massive fill-in. |
| **Requested as-of / identity missing or pruned** | That identity is reported **missing / not found**; the run does **not** silently substitute another date's book without labeling the substitution (silent substitution is Out; missing stays missing). |
| **Stored book loads but is empty / unusable as a chain** | Reported as **empty / unusable book**, not as "no snapshot" and not as a successful measurement with zeros pretending to be compute. |
| **Per-book compute / replay failure** | That book is reported as **replay error** with enough identity to find it again; other books in the corpus may still complete; failure is not collapsed into "empty store." |
| **Partial multi-symbol corpus** (some symbols present, some absent) | Present symbols replay; absent symbols are counted under the **no snapshots** state; the run does not invent books for the gaps and does not abort into a blank success. |
| **Store not configured / unreadable store** | Loud, named failure (or honest empty if that is the configured truth); **no** live Massive fallback; **no** artifact that looks like a successful measurement run. |
| **Capture disabled going forward** | Replay still works over **already stored** books; it never starts calling Massive because capture is off. |
| **Live desk during/after run** | Trader routes untouched; no research blob redistributed as a trader feed. |

**Closed product rules (binding):**

1. **Replay is research on our stored books** — never a trader feed, never a hist-chain purchase
   in disguise.
2. **Zero Massive on replay** — miss/empty/error stay miss/empty/error.
3. **Absent ≠ empty book ≠ replay error** — three distinct operator-visible states
   (`absent-is-not-none`).
4. **A report does not authorize a live score change** — measurement only
   (`score-change-is-deliberate-and-measured`).
5. **P3 does not silently replace P2** — score-lab remains the digested-diary tool; this CLI is
   the stored-chain replay tool.
6. **Determinism is part of the product** — second run byte-identical on the same corpus.

---

### Acceptance criteria

Observable from **CLI output and artifact files** (plus vendor-call counters / live score identity
checks). No source reading required. `Verify by` is risk-based: `test` where silent regression is
plausible; `review` where the behavior is visible/intentional. Never one-test-per-AC theater.
**(SB)** = ship-blocking.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-1 (SB)** | S1 | Given a store containing dated snapshots for at least one symbol, one research CLI run loads those selected books and emits a dated report that shows offline analytics compute was produced per successfully replayed book (not merely a list of filenames). | test |
| **AC-2 (SB)** | S1 | The saved artifact alone contains every measurement figure and every state marker shown in the console for that run — nothing quoted on screen is missing from the file. | test |
| **AC-3 (SB)** | S4 | A multi-symbol run names each included symbol in the report and reconciles selected / replayed / skipped counts so the arithmetic is checkable from the output. | test |
| **AC-4 (SB)** | S4 | A time-based split is applied when the operator requests a split run; the report prints the split rule in force and the membership of each split bucket (which books/as-ofs landed where). | test |
| **AC-5 (SB)** | S4 | Two different time-based split cuts over the same corpus produce differently labeled membership in the report (the split is not cosmetic labeling on an unsplit run). | test |
| **AC-6 (SB)** | S2 | A full successful replay run over a stored corpus completes with **zero live Massive calls** (vendor-call counter for the run stays at 0). | test |
| **AC-7 (SB)** | S2 | List/discovery of candidate snapshots for the run also completes with **zero live Massive calls**. | test |
| **AC-8 (SB)** | S3 | Two consecutive runs over the identical corpus and identical split inputs produce **byte-identical** substantive report bodies (all figures and state markers match); only run timestamp and output path may differ. | test |
| **AC-9 (SB)** | S5 | On an empty store, the CLI reports an **honest empty** (zero snapshots / nothing to replay), performs **no** Massive call, and leaves **no** success-looking measurement artifact that could later be read as a run with findings. | test |
| **AC-10 (SB)** | S5 | Requesting a symbol with no stored snapshots reports **no snapshots stored** for that symbol — textually distinct from empty-book and from replay-error — and does **not** call Massive to create one. | test |
| **AC-11 (SB)** | S5 | Requesting a specific dated identity that is missing or pruned reports **missing / not found** for that identity and does **not** silently substitute another book's as-of without labeling the substitution. | test |
| **AC-12 (SB)** | S5 | A stored identity that loads but yields an empty/unusable chain is reported as **empty / unusable book**, not as "no snapshots stored" and not as a successful numeric measurement for that book. | test |
| **AC-13 (SB)** | S5 | A per-book replay/compute failure is reported as **replay error** naming the book identity; it is not collapsed into empty-store or no-snapshots; sibling books in the same corpus may still appear as completed. | test |
| **AC-14 (SB)** | S5 | In a partial multi-symbol corpus (some symbols present, some absent), present symbols are replayed and absent symbols appear under the no-snapshots state with counts — the run does not invent books for gaps. | test |
| **AC-15 (SB)** | S5 | When the snapshot store is not configured or is unreadable as a store, the CLI fails loudly naming that condition (or reports honest empty if that is the configured truth), performs no Massive fallback, and writes no success-looking measurement artifact. | test |
| **AC-16 (SB)** | S6 | Every run — console and artifact — carries an explicit statement that the report **authorizes no live score / tier / gate / fingerprint / weight change**. Deleting surrounding prose cannot remove that statement from the artifact. | test |
| **AC-17 (SB)** | S6 | The report contains no adoption/verdict language that would read as permission to change live scoring (no "adopt," "ship this weight," "update the live score," "winner ready for production," or equivalent). Enforced by a scan over the run's own emitted strings, not by reviewer memory. | test |
| **AC-18 (SB)** | S7 | After a successful replay run, live opportunity score / tier / state fingerprint for the same market inputs are **byte-identical** to before the run — the CLI wrote no live score path. | test |
| **AC-19 (SB)** | S7 | No trader UI route, nav item, or trader-facing screen exposes batch replay, stored-chain browse for traders, or stored-blob redistribution as a market-data feed. | review |
| **AC-20 (SB)** | S7 | No trader-facing product path serves stored snapshots as a live/historical trader feed. | test |
| **AC-21 (SB)** | S8 | After this feature ships, the existing `score-lab` digested-diary research invocation still exists as a separate tool; batch replay does not silently replace or delete it. | review |
| **AC-22 (SB)** | S8 | A batch-replay report is labeled as **stored-chain replay / capture-corpus measurement** (or equivalent plain language) so a reader cannot mistake it for a `score-lab` digested-diary ranking report. | review |
| **AC-23** | S1 | With capture turned off going forward, replay over **already stored** books still completes with zero Massive calls (capture-off does not reintroduce live fetch on research read). | test |
| **AC-24** | S6 | The report carries enough corpus identity (symbols, as-of range or dated identities, split rule, run date) that two different corpora cannot be confused when artifacts are compared later. | review |

**Method notes (risk-based).**

- **`test` concentrates on silent money/correctness failures:** actual replay vs list-only (AC-1),
  artifact completeness (AC-2), multi-symbol reconciliation (AC-3), real time-split membership
  (AC-4/5), zero Massive (AC-6/7/23), byte-identical second run (AC-8), empty/missing/empty-book/
  replay-error/partial distinctions (AC-9–15), measurement-only statement + anti-adoption scan
  (AC-16/17), live score identity (AC-18), no trader redistribution (AC-20). These can die under a
  refactor while "a report file appeared" still looks fine.
- **`review` owns intentional surface boundaries:** no trader UI (AC-19), coexistence with
  score-lab (AC-21), report genre labeling (AC-22), corpus-identity readability (AC-24).
- Prefer **one** hermetic integration pass: fixture corpus → run → assert zero vendor calls +
  report markers + second-run byte identity + force empty/missing/error fixtures for the three-way
  absence vocabulary — over per-AC micro-harnesses.
- No DOM harness is required; observability is CLI / artifact / vendor counter / live score
  identity.

**Ship-blocking set:** AC-1–AC-22. AC-23/24 are required honesty checks; AC-23 is `test`, AC-24 is
`review`.

---

### Product decisions locked in this position

1. **Research CLI only** — no trader UI; operator-vs-trader separation is HARD.
2. **Consume the shipped capture store** — do not redesign capture/retention here.
3. **Offline compute over stored books** is the defining job; listing alone is not enough.
4. **Multi-symbol + time-based splits** are in-scope observables, printed in the report.
5. **Zero Massive on replay**; missing stays missing.
6. **Absent ≠ empty book ≠ replay error.**
7. **Second run byte-identical** on the same corpus.
8. **Report ≠ permission to change live score**; measurement-only statement is mandatory.
9. **Does not silently replace `score-lab`** — two tools, two jobs (digested diary vs stored chain).
10. Architect names CLI shape, exact split rule mechanics, and how the two labs relate in the
    command surface — product binds the outcomes above, not flag names.

### Open product decisions for the human (do not let a lane invent quietly)

1. **Default split policy when the operator asks for a split** — e.g. chronological half,
   calendar cut, or operator-supplied cut date. Product requires a **named, printed** rule and
   real membership differences (AC-4/5); the exact default cut is an owner/architect call.
2. **Minimum books before a split is offered vs hard-error** — a one-book corpus cannot form a
   meaningful time split. Recommend: refuse split mode with an honest message rather than
   fabricating empty buckets; owner confirms.
3. **Whether a no-split "replay all" mode is the default** — I default to **yes** (split is
   requested, not forced), so an operator can measure the full kept corpus first. Owner confirms.

---

## Risks I see

1. **Mandate risk.** A clean report over paid books will feel like proof the live score should
   change. AC-16/17/18 exist so measurement cannot launder into authorization
   (`score-change-is-deliberate-and-measured`).
2. **Silent Massive fill-in.** A "helpful" miss→fetch path would re-bill and erase the whole point
   of capture. AC-6/7/9–11/23.
3. **List-only theater.** Shipping a CLI that lists snapshots without running offline compute
   would fail the BRIEF's decision impact. AC-1.
4. **Absent/empty/error collapse.** If "no snapshot," "empty book," and "replay failed" share one
   literal, later research will fabricate claims. AC-9–13 (`absent-is-not-none`).
5. **Non-determinism.** If a second run drifts (clock baked into figures, unordered maps, live
   fallback), the measurement is untrustworthy. AC-8.
6. **Quietly replacing score-lab.** Folding P3 over P2's invocation or deleting the diary lab
   would destroy an existing weekly ritual. AC-21/22.
7. **Cosmetic splits.** Labeling "train/test" without actually partitioning membership. AC-4/5.
8. **Trader-path creep.** A convenient "historical chain" trader endpoint or UI would violate
   license intent and operator separation. AC-19/20.
9. **Scope absorption.** Hist-chain purchase, AI lab, or outcome synthesis sneaking in under
   "while we replay." Out list + Future-dated section.
10. **My criteria going unobservable.** If synthesis rewrites rows into "compute is correct"
    intentions that require reading source, those rows should be cut or restated — not kept for
    coverage theater.

---

## Assumptions I'm making about the other two lanes

- **Architecture:** the shipped `ChainSnapshotStore` research list/load path can feed this CLI
  with **hard zero vendor I/O**, including on miss — miss returns empty/not-found, never
  fetch-fill — so AC-6/7/9–11/23 are implementable without a new capture feature.
- **Architecture:** offline analytics compute over a loaded stored book is already reachable for
  research (BRIEF feasibility: existing offline compute + fixture port) without sitting on the
  trader request path and without writing live score / tier / fingerprint.
- **Architecture:** a **time-based split** can be defined as a pure function of dated snapshot
  identity (as-of ordering / operator cut) and printed as membership — not as a hidden random
  partition — so AC-4/5 are falsifiable from the artifact alone.
- **Architecture:** two runs over a fixed fixture corpus can be made **byte-identical** in
  substantive output (ordering stabilized; no live clock inside figures), so AC-8 is not aspirational.
- **Architecture:** empty store, no-snapshots-for-symbol, missing as-of, empty/unusable book, and
  per-book replay error are **distinguishable at the CLI boundary** and can be carried into the
  artifact as distinct states (`absent-is-not-none`) — if storage collapses any pair, that is an
  R2 conflict, not a quiet AC rewrite.
- **Architecture:** this CLI will be shaped to **coexist with `score-lab`** (separate invocation
  or clearly separated mode) rather than silently replacing the digested-diary tool; if the
  technical plan deletes or overwrites score-lab's entry point, that contradicts S8/AC-21 and must
  be raised at R2.
- **Architecture:** citations for reuse will name **live Rust** capture/list/load and offline
  compute paths — not Python-era assumptions (`cited-code-is-verified-not-assumed`).
- **Architecture:** hermetic tests can assert vendor-call count = 0 and live score byte-identity
  without needing Massive credentials in the build environment.
- **UX/Tech-writer:** there is **no web/trader surface** to design; if UX proposes a dashboard,
  route, or trader chrome for replay results, that conflicts with my Out list and
  `operator-vs-trader-path-separation`, and I will raise it as a conflict at R2.
- **UX/Tech-writer:** they own the exact wording of empty / missing / empty-book / replay-error
  states, the measurement-only statement, and the "stored-chain replay" genre label; I own only
  that those distinctions exist in both console and artifact, are mutually distinguishable as
  words (not colour-only), and that adoption language is absent (AC-16/17 scan the emitted text).
- **UX/Tech-writer:** terminal/artifact readability is the whole presentation job — stable
  section ordering, plain-language state names, and a report a weekly note can quote without
  opening source.
