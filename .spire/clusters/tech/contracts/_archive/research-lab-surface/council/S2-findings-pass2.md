# S2 — skeptic findings: research-lab-surface (pass 2)

Fresh adversarial re-pass after R4 repaired `S2-findings.md` (pass 1). Inputs: repaired `SPEC.md`, `INTERFACE_CONTRACT.md`, `BRIEF.md`, `council/conflicts.json` (13), `council/decisions.md`, R2-architect / R2-pm / R2-ux, and pass-1 `council/S2-findings.md` (Criticals re-checked against body text, not the repair note). Human ruling **A** still settled. Skill: `spire-tech-adversarial-spec-review`.

## Critical  (blocks — must loop back to R4)

- **Warm `5xx` → stale keep-last collapses classified research faults (not-storing / store-error / unreadable).** §2 Warm vs cold and AC-30 route any warm **network / unclassified TypeError / 5xx** (not family-404, not classified CORS) to **stale** keep-last. Not-storing, list store-error, and unreadable are also HTTP 500s with closed bodies (§5; `research_session_books` `session_archive_not_storing` / `session_archive_store_error`). AC-27 / AC-29 / §5 require those arms’ payload copy, not the stale chip. Coverage-unavailable **does** carve not-storing out of generic 5xx; the warm-refresh path does not — so a warm Retry that returns not-storing can legally paint either AC-27 or AC-30. That merges classes §8 `absent-is-not-none` forbids merging (`not-storing` ≠ `stale`). — evidence: `SPEC.md` §2 “Warm vs cold”; `SPEC.md` §3 AC-27 / AC-29 / AC-30; `SPEC.md` §2 Coverage-unavailable arm (carves not-storing); `SPEC.md` §5 Not-storing / List store-error / Unreadable / Warm 5xx rows; `SPEC.md` §8 `absent-is-not-none`

- **Warm stale keep-last after a chip-switch / chip-follow list failure keeps the previous symbol’s rows under the new chip.** §2 data flow and ship-blocking AC-52 require: after selecting another chip (including coverage `present` chip-follow), the books table shows **that** symbol’s list or its empty/in-flight standing — **not** the previous symbol’s rows under the new chip. The same §2 warm rule + AC-30 + §4 page offline/stale column say a warm list GET that fails as network/5xx **keeps the last list**. A failed SPY→QQQ list therefore keeps SPY rows while the QQQ chip is selected — direct AC-52 / data-flow breach. Cors-fault was repaired to hide the corpus; this sibling keep-last path was not narrowed to same-symbol Retry. — evidence: `SPEC.md` §2 Data flow (“must not keep another symbol’s rows”); `SPEC.md` §3 AC-52; `SPEC.md` §2 Warm vs cold; `SPEC.md` §3 AC-30; `SPEC.md` §4 page offline/stale column; `SPEC.md` §4 flow 7–8

### Pass-1 Criticals — resolved (do not re-block)

- **Warm classified CORS → stale** — gone. §2 Warm vs cold, AC-16, flow 5, §4 cors-fault, and §5 now send classified CORS (cold or warm) to cors-fault, hide the corpus, and forbid the stale chip; cors-fault ≠ stale is explicit.
- **AC-14 cookie-only unobservable under `credentials: 'omit'`** — gone. AC-14 is now a GATE Q **non-page** cookie-without-token 401 probe; page fetches stay omit; no distinct cookie-only Alert; INTERFACE Standing rule 4 matches.

## Important  (should fix)

- **Chip-switch in-flight standing still underspecified relative to AC-52.** AC-32’s loading copy is only for “no prior body.” §4 books-table loading says “No skeleton rows that look like missing” but does not require clearing the previous symbol’s rows while the new list GET is in flight. A warm chip switch can therefore show SPY rows under a selected QQQ chip during flight and still claim compliance with the matrix. AC-52’s “or its … in-flight standing” needs a concrete paint (hide table / symbol-scoped loading), not an open door to keep-last. — evidence: `SPEC.md` §3 AC-32 / AC-52; `SPEC.md` §4 books table loading column; `SPEC.md` §4 page loading column

- **Invariant-fault copy is book-load-shaped, but INTERFACE trips the arm on any 200 envelope.** INTERFACE Standing rule 7: list/load/coverage 200s with `vendor_called: true` or `authorizes` ≠ `nothing` are invariant-fault. §4 invariant-fault body is **`This stored book is not a legal research read…`** — wrong for a list or coverage envelope fault. §2 only narrates the arm under Book load digest. A list/coverage invariant can paint book copy or fall through to generic warning. — evidence: `INTERFACE_CONTRACT.md` Standing rule 7; `SPEC.md` §2 Book load digest; `SPEC.md` §4 invariant-fault row; `SPEC.md` §5 Invariant-fault

- **Page-level list store-error is still outside the AC-33 / §1 distinguishable inventory.** §5 has a List store-error (500) row with closed `session archive store error: <reason>`. §1 degraded list and AC-33 name **not-storing** but not store-error. A build can fold store-error into not-storing (or generic error) and still satisfy AC-33 as written — same class of gap pass 1 called on coverage withheld / invariant-fault before those were added. — evidence: `SPEC.md` §1 In-scope degraded states; `SPEC.md` §3 AC-33; `SPEC.md` §5 List store-error / Not-storing; `INTERFACE_CONTRACT.md` Closed wire vocabularies (`session_archive_store_error`)

## Minor / advisory

- **Orphan digest across chip switch is unspecified.** Opening a SPY digest then switching to QQQ does not say whether the SPY digest card clears, stays, or waits for a QQQ open. Stale keep-last keeps “last digest”; chip switch is not stale. Tighten one clause so a prior symbol’s digest cannot read as the new chip’s research read. — evidence: `SPEC.md` §2 Data flow; `SPEC.md` §4 Load digest; `SPEC.md` §4 flow 8

- **Deploy canon still names `ALLOWED_ORIGINS` while this slice keys `ALLOWED_BROWSER_ORIGINS`.** SPEC §2 already warns GATE Q / ops to verify the latter; residual doc drift only. — evidence: `SPEC.md` §2 CORS; `docs/DEPLOY_RUNBOOK.md` / `docs/CLOUDFLARE_PAGES_SETUP.md`

## Checked and clean

- **Dropped conflicts** — all 13 `conflicts.json` IDs remain folded in SPEC resolution markers / §9-folding JSON with body resolutions (ruling A coverage In; no export; page-memory only; origin-blocked on research base not `location.host`; runtime API origin; Verify-by dump/sibling `test`). Spot-checked R2-architect (4), R2-pm (5), R2-ux (4) against §1–§3 and `decisions.md`. §9 correctly empty.

- **Unobservable acceptance criteria** — pass-1 AC-14 Critical is repaired (non-page probe). Remaining ship-gate `test` rows name outside-the-code signals (titles/framing, network omission, columns, structural scans, GATE Q plants). AC-26 / present-click arms honestly allow UNVERIFIABLE when no dump-capable / no LiveMassive `present` exists without product backend change. Review rows stay copy/chrome. New Criticals above are contradictions, not unobservability.

- **Unspecified component states** — §4 matrix still covers default · loading · empty · error · offline/stale for page / gate / coverage / books / digest; gate arms and load-fault arms (including invariant-fault) have copy. Residual: chip-switch in-flight vs AC-52 (Important); orphan digest (Minor). Pass-1 gaps (invariant-fault copy; present→miss) are filled (AC-51, §4 invariant-fault row, §2 disagreement clause).

- **Interface mismatch** — conformance block still matches §2’s three existing GETs; coverage omits `et_date`; auth is metrics token not cookie `"auth": true`. Three GATE Q plants (fixture shape / dump-capable / coverage `present`) are now distinct and honest — pass-1 plant/dump Important is repaired. No new missing UI field on the wire. Invariant-fault envelope scope (Important) is copy/scope drift, not a missing conformance key.

- **Internal contradiction** — pass-1 warm-CORS Critical repaired. New contradictions: warm `5xx` stale vs classified 500 faults; warm keep-last vs AC-52 chip-follow (Criticals above). No clash found on ruling A vehicle set, 404 split (list empty 200 vs load JSON 404 vs Function plaintext 404), Books `source` vs coverage `present`, cors-fault ≠ stale, or NO_BACKEND_CHANGE / Pages 404.

- **Guardrail breach** — no requirement reopens `/lab`, AppShell wrap, TopNav operator entry, Pages `_research` proxy, export of load bodies, `present`/`kept` on the books table, minting coverage from list `source`, baking origin/token, or scoring from this surface. Warm-`5xx`→stale over-breadth is the live `absent-is-not-none` / AC-52 breach called Critical above; pass-1 cors-fault collapse is gone.
