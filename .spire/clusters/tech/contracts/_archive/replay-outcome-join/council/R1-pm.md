# R1 — pm position: replay-outcome-join

## Position

### Who this is for, and what job it does

One user: the research operator / owner. He already pays for Options books and Stocks bars. He can
**replay** stored paid books (`batch-backtest`) and he can **join next-session stock-bar labels**
(`join-outcomes`), but those two tools do not meet: replay reprints Path-B numbers with
**Authorizes: nothing** and no forward label; the digested-diary lab (`score-lab`) ranks samples that
never reloaded a stored chain. The 2026-08-11 score-lab slice (AUC 0.467 on digested samples) asked
whether the composite ranked large next-day moves — and failed that KPI — but it asked on the
**wrong corpus shape** for the paid-book question.

The job: **pair each replayed score from a stored paid options book with the next-session stock-bar
label we already pay for**, so one research run answers: *did the score computed on the exact book
we kept rank the next day's move?* The surface is a **research report** (console + dated artifact).
There is **no trader UI**. A report **measures**; it does **not** authorize a live score / weight /
gate / fingerprint change. Beating 0.467 is **not** a ship target — that figure is context about why
measurement matters, not a bar this join must clear.

---

### User stories

- **S1** — As the research operator, I want one research run to produce a dated report of **paired
  (replayed score, forward label)** rows drawn from stored paid books, **so that** I can measure
  whether the score on those books ranked next-session moves without hand-joining files.
- **S2** — As the research operator, I want every ranking / rate figure in that report to carry its
  **horizon, sample count (n), and window / corpus identity**, **so that** I cannot quote a number
  without its assumptions (`model-read-carries-its-assumptions`).
- **S3** — As the research operator, I want a **second run over the same corpus and the same labels**
  to be **byte-identical** in substantive report body (timestamp / output path may differ), **so
  that** the measurement is deterministic research, not a drifting live path.
- **S4** — As the research operator, I want **no snapshot**, **empty book**, and **no label** to be
  **textually distinct** outcomes — never collapsed into one “missing” bucket and never silently
  repaired by a live Options fetch — **so that** I never fabricate a claim about a book or day we
  did not actually measure (`absent-is-not-none`).
- **S5** — As the research operator, I want the join path to make **zero Options API calls**, and to
  touch Stocks aggs **only when a needed label is missing**, **so that** replayed books stay offline
  and label fetch is honest and bounded.
- **S6** — As the research operator, I want every run to state that the report **authorizes nothing**
  on the live score path, **so that** a good (or bad) ranking number cannot be mistaken for
  permission to change live scoring (`score-change-is-deliberate-and-measured`).
- **S7** — As the desk owner, I want this feature to stay **off every trader route and trader UI**,
  and to leave live score / tier / fingerprint **byte-identical**, **so that** research measurement
  cannot drift the desk (`operator-vs-trader-path-separation`, `additive-keeps-score-byte-identical`).
- **S8** — As the research operator, I want this join to **sit beside** `batch-backtest` and
  `score-lab` as the missing measurement bridge — **not** silently replace either tool, and **not**
  treat the 2026-08-11 digested AUC as a target this ship must beat.

---

### Scope

**In**

1. A **research join** that attaches **already-paid next-session stock-bar labels** (session-count
   horizons **1d** and **5d**) to **replayed scores** from **stored paid options books**.
2. One research run that emits a **dated report** (console + saved artifact) with paired
   (replayed score, label) rows and the ranking / rate figures derived from those pairs.
3. **Per-figure provenance** on every rate: horizon, n, window / corpus identity, and that the
   figures are advisory measurement — not a forecast and not a live score change.
4. **Deterministic re-run** — same corpus + same labels → byte-identical substantive report body.
5. **Honest degraded row states** as first-class outcomes: **no snapshot** ≠ **empty book** ≠
   **no label** (and distinct from a successful paired row). Never a silent live Options fetch to
   fill a gap.
6. **Vendor discipline** — zero Options API calls on the join/measure path; Stocks aggs only when a
   needed label is missing (labels already present are reused, not re-fetched for theater).
7. **Measurement-only guardrails** — every run states the report authorizes **no** live score /
   tier / gate / fingerprint / weight change; the run performs **no** such write.
8. **Coexistence** with shipped `batch-backtest` (replay without labels) and `score-lab` (digested
   diary ranking) — this feature is the join, not a silent rename of either.
9. **Hermetic verifiability** from CLI/report output, artifact files, and vendor-call counters —
   without a trader UI.

**Out (this feature)**

- Any change to live **opportunity score / tier / entry gate / fingerprint basis / weights**.
- Treating a report result as an **adoption decision**, “winner,” or authorization to change live
  scoring — measurement only.
- Any **trader UI**, trader route, nav item, badge, or alert derived from join results.
- Buying vendor **hist-chain** / historical Options products (P7) — different spend.
- Synthesizing or inventing forward outcomes that were never joined from stock bars
  (`score-lab-b0b-outcomes` stays blocked-on; do not smuggle synthesis here).
- Replacing, deleting, or silently subsuming `batch-backtest` or `score-lab`.
- A requirement that joined ranking **beat** the 2026-08-11 digested AUC **0.467** — that number is
  context, not a ship KPI.
- P4 AI lab / multi-model offline eval; weekly docs-only runbook as a substitute for this build.
- Pixel layout, theme, motion, or any dashboard chrome.

**Future-dated (named, not built)**

- Multi-week roll-up across saved join artifacts (the shape a deliberate score-change feature would
  cite under `score-change-is-deliberate-and-measured`).
- Regime / session splits of the joined corpus once routine measurement exists.
- Optional operator dashboard for join health (only under operator-vs-trader separation; not required
  to ship).
- Vendor hist-chain **if** later purchased (separate GATE I).

---

### Product behavior

**Actors:** research operator / owner at a terminal. **Not** the signed-in trader on Landing /
Ticker / Positions / Scanner.

**Happy path (observable without reading source):**

| Situation | What must be true |
|---|---|
| **Corpus with stored books + available 1d/5d labels** | Operator runs the research join; each eligible book contributes a paired (replayed score, forward label) row; a dated report is emitted (console + artifact). |
| **Ranking / rates present** | Report shows whether replayed scores ranked the labeled moves for the stated horizons; every rate carries horizon, n, and window / corpus identity. |
| **Options isolation** | The run performs **zero Options API calls**. |
| **Label reuse** | When labels for the needed identities already exist, the run does **not** re-fetch Stocks aggs for those identities. |
| **Second identical run** | Same corpus + same labels → **byte-identical** substantive report (figures and state markers match; only run timestamp / output path may differ). |
| **Desk unchanged** | After the run, live score / tier / fingerprint for the same market inputs are unchanged; no trader surface appeared. |
| **Beside existing tools** | `batch-backtest` still replays without requiring this join; `score-lab` still ranks the digested diary; this report is clearly a **paid-book + forward-label join**, not a silent substitute for either. |

**Degraded / edge states (each its own outcome — not footnotes on the happy path):**

| Situation | Observable outcome |
|---|---|
| **No snapshot** for a requested identity / symbol | Reported as **no snapshot** — distinct from empty book and from no label; **no** Options fetch to create one. |
| **Snapshot present but empty / unusable book** | Reported as **empty book** — distinct from no snapshot and from no label; not scored as a successful paired row with fabricated zeros. |
| **Book replayable but forward label absent** | Reported as **no label** for that horizon/identity — distinct from no snapshot and empty book; that row is not silently treated as a labeled non-move. |
| **Labels missing and Stocks aggs available** | Stocks aggs may be fetched **only for the missing labels**; Options APIs still stay at zero; newly obtained labels are usable on the next identical corpus run. |
| **Labels missing and Stocks aggs unavailable / fail** | Those rows stay **no label** (honest); the run does **not** invent labels and does **not** fall back to Options. |
| **Empty corpus / nothing to join** | Honest empty — **no** success-looking measurement artifact that could later be read as “ran and found no edge.” |
| **Partial corpus** (some rows pair, some degrade) | Paired rows measure; degraded rows keep their distinct state with counts; the run does not invent books or labels for the gaps. |
| **Live desk during/after run** | Trader routes untouched; join results are not redistributed as a trader feed. |

**Closed product rules (binding):**

1. **Join is measurement on paid books + paid labels** — never a trader feed, never a hist-chain
   purchase in disguise.
2. **Zero Options API calls** on this path; miss/empty/no-label stay miss/empty/no-label.
3. **No snapshot ≠ empty book ≠ no label** — three distinct operator-visible states
   (`absent-is-not-none`).
4. **A report does not authorize a live score change** — measurement only; **Authorizes: nothing**
   (or equivalent plain language that survives deleting surrounding prose).
5. **0.467 is context, not a target** — the ship succeeds by producing honest paired measurement,
   not by clearing a digested-lab AUC.
6. **Does not silently replace** `batch-backtest` or `score-lab` — three tools, three jobs.
7. **Determinism is part of the product** — second run byte-identical on the same corpus + labels.
8. **Every rate carries its assumptions** — horizon, n, window / corpus identity on the report
   itself.

---

### Acceptance criteria

Observable from **CLI/report output and artifact files** (plus vendor-call counters / live score
identity checks). No source reading required. `Verify by` is risk-based: `test` where silent
regression is plausible; `review` where the behavior is visible/intentional. Never one-test-per-AC
theater. **(SB)** = ship-blocking.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-1 (SB)** | S1 | Given a fixture corpus of stored paid books with available forward labels, one research run emits a dated report that contains paired (replayed score, forward label) rows — not merely a list of book filenames and not merely unlabeled replay figures. | test |
| **AC-2 (SB)** | S1 | The report includes ranking / rate figures derived from those pairs for the **1d** horizon, and those figures are readable from the artifact alone. | test |
| **AC-3 (SB)** | S1 | The report includes ranking / rate figures (or an explicit not-computable state with reason) for the **5d** horizon on the same paired corpus — 5d is not silently omitted when 1d is present. | test |
| **AC-4 (SB)** | S1 | The saved artifact alone contains every measurement figure and every row-state marker shown in the console for that run — nothing quoted on screen is missing from the file. | test |
| **AC-5 (SB)** | S2 | Any single ranking / rate figure in the report can be read together with its **horizon**, **n**, and **window / corpus identity**, without opening another file or reading source. | review |
| **AC-6 (SB)** | S2 | Two differently labeled horizons (1d vs 5d) never share a single undifferentiated number — each printed rate names which horizon it belongs to. | test |
| **AC-7 (SB)** | S3 | Two consecutive runs over the identical corpus and identical labels produce **byte-identical** substantive report bodies (all figures and state markers match); only run timestamp and output path may differ. | test |
| **AC-8 (SB)** | S4 | A requested identity with **no stored snapshot** is reported as **no snapshot**, textually distinct from empty-book and from no-label, and does **not** trigger an Options API call. | test |
| **AC-9 (SB)** | S4 | A stored identity that loads but yields an **empty / unusable book** is reported as **empty book**, textually distinct from no-snapshot and from no-label, and is not counted as a successful paired measurement row. | test |
| **AC-10 (SB)** | S4 | A replayable book whose forward label is absent for a requested horizon is reported as **no label** for that row/horizon — textually distinct from no-snapshot and empty-book — and is not silently treated as a labeled zero-move. | test |
| **AC-11 (SB)** | S4 | In a mixed fixture (some rows paired, some no-snapshot, some empty-book, some no-label), the report’s counts reconcile: paired + each degraded class = rows attempted, and the three degraded classes remain distinguishable by reading the output alone. | test |
| **AC-12 (SB)** | S4 | On an empty corpus (nothing to join), the run reports honest empty, performs no Options call, and leaves **no** success-looking measurement artifact that could later be read as a run with findings. | test |
| **AC-13 (SB)** | S5 | A full successful join/measure run over a stored corpus completes with **zero Options API calls** (Options vendor-call counter for the run stays at 0). | test |
| **AC-14 (SB)** | S5 | When all needed labels are already present, the run completes **without** issuing Stocks aggs fetches for those identities (no re-fetch theater). | test |
| **AC-15 (SB)** | S5 | When a needed label is missing and Stocks aggs can supply it, the run may fetch Stocks aggs for that gap only; Options API calls remain at 0; the resulting row becomes a paired row (or stays no-label if the fetch yields nothing usable). | test |
| **AC-16 (SB)** | S5 | When a needed label is missing and Stocks aggs are unavailable or fail, the row remains **no label**; the run does not invent a label and does not call Options as a fallback. | test |
| **AC-17 (SB)** | S6 | Every successful measurement run — console and artifact — carries an explicit statement that the report **authorizes nothing** on live score / tier / gate / fingerprint / weight. Deleting surrounding prose cannot remove that statement from the artifact. | test |
| **AC-18 (SB)** | S6 | The report contains no adoption/verdict language that would read as permission to change live scoring (no “adopt,” “ship this weight,” “update the live score,” “winner ready for production,” “beats 0.467 — change the score,” or equivalent). Enforced by a scan over the run’s own emitted strings, not by reviewer memory. | test |
| **AC-19 (SB)** | S7 | After a successful join run, live opportunity score / tier / state fingerprint for the same market inputs are **byte-identical** to before the run — the join wrote no live score path. | test |
| **AC-20 (SB)** | S7 | No trader UI route, nav item, or trader-facing screen exposes the join report, paired ranking results, or stored-book browse for traders. | review |
| **AC-21 (SB)** | S7 | No trader-facing product path serves join artifacts or stored snapshots as a live/historical trader feed. | test |
| **AC-22 (SB)** | S8 | After this feature ships, `batch-backtest` remains separately invocable as unlabeled stored-chain replay, and `score-lab` remains separately invocable as digested-diary ranking — this join does not delete or silently replace either. | review |
| **AC-23 (SB)** | S8 | A join report is labeled as **paid-book replay + forward-label measurement** (or equivalent plain language) so a reader cannot mistake it for a digested-diary `score-lab` report or an unlabeled `batch-backtest` reprint. | review |
| **AC-24 (SB)** | S8 | Ship criteria and report copy do **not** require the joined ranking to beat the 2026-08-11 digested AUC **0.467**; that figure may appear only as historical context, never as a pass/fail bar for this run. | review |
| **AC-25** | S1 | A constructed fixture in which higher replayed scores perfectly align with large labeled moves produces a ranking figure distinguishable from a fixture in which scores are unrelated to labels — pairing is not cosmetic attachment of unused columns. | test |
| **AC-26** | S2 | The report states the label definition in force (session-count forward horizons on stock bars) beside the rates, so a reader cannot confuse the label with broker P&L or synthesized outcomes. | review |

**Method notes (risk-based).**

- **`test` concentrates on silent correctness / money / mandate failures:** actual pairing vs
  list-only (AC-1/25), horizon coverage (AC-2/3/6), artifact completeness (AC-4), byte-identical
  second run (AC-7), the three-way absence vocabulary + reconciliation (AC-8–12), Options = 0 and
  bounded Stocks fetch (AC-13–16), Authorizes-nothing + anti-adoption scan (AC-17/18), live score
  identity (AC-19), no trader redistribution (AC-21). These can die under a refactor while “a report
  file appeared” still looks fine.
- **`review` owns intentional framing and surface boundaries:** assumption readability (AC-5/26),
  no trader UI (AC-20), coexistence with existing labs (AC-22), genre labeling (AC-23), and the
  explicit non-target status of 0.467 (AC-24).
- Prefer **one** hermetic integration pass: fixture corpus + labels → run → assert zero Options
  calls + paired rows + second-run byte identity + forced no-snapshot / empty-book / no-label
  fixtures — over per-AC micro-harnesses.
- No DOM harness is required; observability is CLI / artifact / vendor counter / live score
  identity.

**Ship-blocking set:** AC-1–AC-24. AC-25/26 are required honesty checks (pairing is real; label
definition is readable).

---

### Product decisions locked in this position

1. **Research join only** — no trader UI; operator-vs-trader separation is HARD.
2. **Consume shipped replay + shipped label join capabilities** — do not redesign capture, and do
   not invent outcomes.
3. **Paired (replayed score, forward label) measurement** is the defining job; unlabeled replay or
   diary-only ranking alone is not enough.
4. **Horizons in scope: 1d and 5d** (session-count), both first-class in the report.
5. **Zero Options API calls**; Stocks aggs only for missing labels.
6. **No snapshot ≠ empty book ≠ no label.**
7. **Second run byte-identical** on the same corpus + labels.
8. **Report ≠ permission to change live score**; Authorizes-nothing statement is mandatory.
9. **0.467 is context, not a ship target.**
10. **Does not silently replace** `batch-backtest` or `score-lab`.
11. Architect names whether this extends an existing CLI, adds a third CLI, or composes artifacts —
    product binds the outcomes above, not command shape.

### Open product decisions for the human (do not let a lane invent quietly)

1. **Primary headline KPI for the paired report** — e.g. ranking metric family already used by
   score-lab (AUC / lift@top / precision@top) vs a smaller printed set. Product requires **some**
   ranking/rate figures with horizon+n+window (AC-2/3/5); the exact metric roster is an
   owner/architect call so we do not silently invent a new KPI vocabulary.
2. **Whether a run with zero paired rows (all degraded) is a soft empty success or a loud
   non-measurement exit** — I default to **no success-looking measurement artifact** (AC-12) while
   still printing the degraded counts; owner confirms the exit tone.
3. **Default horizons when the operator does not name one** — I default to **both 1d and 5d** in
   one run (AC-2/3), with each rate labeled; owner may prefer 1d-default + opt-in 5d once corpus
   depth is thin.

---

## Risks I see

1. **Mandate risk.** A clean paired report over paid books will feel like proof the live score
   should change — especially if a number looks better or worse than 0.467. AC-17/18/19/24 exist so
   measurement cannot launder into authorization
   (`score-change-is-deliberate-and-measured`).
2. **Absence-vocabulary collapse.** If “no snapshot,” “empty book,” and “no label” share one
   literal, later research will fabricate claims about books or days we never measured. AC-8–11
   (`absent-is-not-none`).
3. **Silent Options fill-in.** A “helpful” miss→live-options path would re-bill and erase the point
   of stored-book measurement. AC-8/13/16.
4. **Label theater.** Re-fetching Stocks aggs when labels already exist, or inventing labels when
   aggs fail, both poison trust. AC-14–16.
5. **Cosmetic pairing.** Attaching unused label columns while ranking still runs on something else
   (or on nothing) would fail the BRIEF’s decision impact. AC-1/25.
6. **Horizon smuggling.** Printing one undifferentiated AUC while claiming 1d/5d coverage.
   AC-3/6.
7. **Non-determinism.** If a second run drifts (clock inside figures, unordered membership, live
   fallback), the measurement is untrustworthy. AC-7.
8. **Quietly replacing adjacent tools.** Folding this join over `batch-backtest` or `score-lab`
   entry points would destroy existing rituals. AC-22/23.
9. **Target creep on 0.467.** Treating the digested-lab miss as a bar this ship must beat turns a
   measurement build into an unearned score-change mandate. AC-24.
10. **My criteria going unobservable.** If synthesis rewrites rows into “join is correct”
    intentions that require reading source, those rows should be cut or restated — not kept for
    coverage theater.

---

## Assumptions I'm making about the other two lanes

- **Architecture:** shipped `batch-backtest` can supply **replayed scores from stored paid books**
  (or equivalent offline replay artifacts) without Options API calls, so AC-1/13 are implementable
  without buying hist-chain or redesigning capture.
- **Architecture:** shipped `join-outcomes` (or equivalent) can attach **session-count 1d/5d stock-bar
  labels** and can fetch Stocks aggs **only when labels are missing**, so AC-14–16 are not
  aspirational.
- **Architecture:** the three degraded states — **no snapshot**, **empty book**, **no label** —
  are **distinguishable at the research boundary** and can be carried into the artifact as distinct
  states; if a composition collapses any pair, that is an R2 conflict, not a quiet AC rewrite.
- **Architecture:** two runs over a fixed fixture corpus + fixed labels can be made
  **byte-identical** in substantive output (ordering stabilized; no live clock inside figures), so
  AC-7 is implementable.
- **Architecture:** hermetic tests can assert Options vendor-call count = 0 and live score
  byte-identity without needing Options credentials in the build environment.
- **Architecture:** citations for reuse will name **live Rust** `cmd_join_outcomes`,
  `cmd_batch_backtest`, `cmd_score_lab`, and `chain_snapshot/` paths — not Python-era assumptions
  (`cited-code-is-verified-not-assumed`).
- **Architecture:** whether this is an extension of an existing CLI or a third consumer is an
  architect call; product only requires the observable join outcomes above. If the technical shape
  cannot produce paired rows without a live Options fetch or a live score write, that must surface
  as an R2 conflict rather than a silent scope cut.
- **UX/Tech-writer:** there is **no web/trader surface** to design; if UX proposes a dashboard,
  route, badge, or trader chrome for join results, that conflicts with my Out list and
  `operator-vs-trader-path-separation`, and I will raise it as a conflict at R2.
- **UX/Tech-writer:** they own the exact wording of **no snapshot / empty book / no label**, the
  Authorizes-nothing statement, the genre label (“paid-book + forward-label measurement”), and any
  historical mention of 0.467 as **context not target**; I own only that those distinctions exist
  in both console and artifact, are mutually distinguishable as words (not colour-only), and that
  adoption / beat-0.467 verdict language is absent (AC-17/18/24 scan the emitted text).
- **UX/Tech-writer:** terminal/artifact readability is the whole presentation job — stable section
  ordering, plain-language state names, horizon+n+window beside every rate, and a report a weekly
  note can quote without opening source.
