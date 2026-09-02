# S2 — skeptic findings: session-day-tape-capture

## Critical  (blocks — must loop back to R4)

- None. Pass-1 Critical (recv never-awaits-disk vs writing a gap on writer-channel `Full`) is actually repaired, not papered: §2.2 now names recv-only `try_send` + `dropped`/`gap_pending` latch + writer `select!` on event recv **and** `Notify`/`watch`, with the writer appending **one** coalesced Path-A gap JSONL (and explicitly forbids `try_send`ing a gap into the already-`Full` event channel or awaiting disk from recv). AC-7 remains observable as that writer-flushed occupant (`path-a gap: hub or writer…`, optional ` · {n} dropped`). Poison 9 / §8 `[live-vs-static-isolation]` match. — evidence: `SPEC.md` §2.2 (“Recv loop — never I/O” / “Writer task — the only Path-A disk waiter”); `SPEC.md` §3 AC-7; `SPEC.md` §2.8 poison 9; pass-1 `council/S2-findings.md` Critical

## Important  (should fix)

- Ship-blocking AC-32 / Axis A `NotExpectedPreStore` still has no recorded fact that makes “before this environment was storing” decidable. The type, closed literal, framing, glossary, and AC exist, but §2.4–§2.5 never name a store-start watermark (marker file under the tape root, config et_date, first-arm day, etc.). Without that, every past weekday with no day container collapses to `NoIdentity` / `no session day tape…` — the exact pre-store vs missing-row collapse forward-only was meant to prevent. §9 still claims “None.” — evidence: `SPEC.md` §2.4 `NotExpectedPreStore`; `SPEC.md` §3 AC-32; `SPEC.md` §2.5 enablement table (root only; no start watermark); `SPEC.md` §9 “None.”; `BRIEF.md` / R1-pm forward-only

- AC-7 hard-requires a list/load Path-A gap occupant on **persist fault**, but §2.2 only says the writer “**may** append a gap for that fault” and §5 says list/load “**may** show Path-A gap.” When the fault is the disk (event append fails and the follow-on gap append also fails), AC-38’s S2 skip line fires and the tape gains nothing — so AC-7’s persist-fault arm is not satisfiable. Full / Lagged / Closed are covered by the latch; persist-fault should either be carved out of AC-7’s hard “shows,” or the SPEC must name a non-disk occupant (contradicting “Occupant is the writer’s coalesced gap record”). — evidence: `SPEC.md` §3 AC-7 (“or persist fault … list/load shows”); `SPEC.md` §2.2 (“may append a gap for that fault”); `SPEC.md` §5 Path-A persist fail (“may show Path-A gap”); `SPEC.md` §3 AC-38

## Minor / advisory

- AC-41 “does not delay the trader request path” still has no observable delay bound; method notes correctly treat “does not delay” as off-request isolation, not a latency SLO — keep the soft wording from becoming a fake GATE Q oracle. — evidence: `SPEC.md` §3 AC-41; method notes under §3

- List `days[].clock` still advertises `ineligible weekend` and `not expected before storing` while list is “stored tape days” (those classes are load/gate absences without a stored row). Dead list-clock vocabulary; not-elapsed is correctly load-only. — evidence: `INTERFACE_CONTRACT.md` list `days[].clock`; `SPEC.md` §4 list clock cell; `SPEC.md` §2.7 / INTERFACE “List stored tape days”

- Axis B `EmptyWhileStoring` is “stored record count of that path is 0,” while `PathAHubGap` occupants are first-class JSONL records that “coexist with empty … ticks.” Say trade/quote count (or exclude gap kinds) so gap-only days cannot be mis-read as EmptyWhileStoring. AC-27 already requires no gap records for the empty literal — align the Axis B sentence. — evidence: `SPEC.md` §2.4 Axis B `EmptyWhileStoring` / `PathAHubGap`; `SPEC.md` §3 AC-27

- Occupied × PathAHubGap needs both AC-23’s exact counts line and AC-7’s gap literal; HTTP `path_a_detail` is a single string while counts also live in numeric fields and gaps in `path_a_gaps[]` (elements carry only `dropped`, not the closed literal). Name how the dual print lands on the envelope/CLI section. — evidence: `SPEC.md` §3 AC-7 / AC-23; `INTERFACE_CONTRACT.md` `path_a_detail` / `path_a_gaps[].dropped`

## Checked and clean

- **Dropped conflicts:** All 22 `conflicts.json` `conflict_id`s remain in the SPEC folding footer with `disposition: folded`. Re-checked substantive carry after R4: D1 every Trade+Quote + recv never awaits disk + 1s sample out (`daf84924…`, `f99f5708…`, `60d2ff54…` → §1/§2.2/AC-3/AC-4/poison 7); D2 04:00–20:00 keep / overnight not empty / completeness 09:30–16:00 (`10068494…`, `f4beceac…`, `e855c3b9…` → §1/§2.1/AC-9/AC-10); D3 missing root → bind + not-storing / collide → refuse (`53b87f1e…`, `dd04f673…` → §1/§2.5/AC-39/AC-40); Path-B clock-aligned marks (`cc911052…`, `2b74bb89…`, `0d046c32…`); no coverage cells / no `complete_rth` success (`17adc319…`, `2551a5c7…`, `446e10df…`, `948460c9…`, `3548cc1b…`, `8c345e93…`); locked trio not cap-8 (`34c34be2…`, `1dea2545…`); verify-by trader chrome test vs review (`5380f8da…` → AC-44–48 test, AC-57 review); inner `LiveMassive` drop (`7da8e836…`). No dropped conflict id.

- **Pass-1 Important fold verification:** `NotElapsed` now has closed literal, framing, glossary, AC-37 inventory, AC-66, INTERFACE standing/detail/NotElapsed 200 — fixed. `path_a_ticks[]` now promises `price`/`size`/`bid`/`ask`/`bid_size`/`ask_size` in field list + conformance (matches `StreamEvent` in `apps/api/src/domain/price.rs`) — fixed. Path-B mark-gap **read-time derive** locked in §2.3 (fill window, silent vs gap, through-window all-missed ⇒ per-mark gaps not `no path-b snapshots…`) — fixed. Path-only framing tokens moved to **banned** (combined envelope only) — fixed. Load `detail` is `null` on `StoringReady` content hits; gate literals stay in `detail` — fixed.

- **Unobservable ACs:** Walked AC-1–66. Ship-blocking rows name list/load literals, vendor-call counter, structural scans, Pages 404, or score identity. No new Critical unobservable ship-gate. Residuals: AC-32 watermark (Important above); AC-41 delay (Minor); AC-7 persist-fault overclaim (Important).

- **Component states:** §4 table covers trader UI (unchanged), `/_ops/metrics` (no tape state), HTTP tape (200 honest envelope / 401 / 422 / 500), optional CLI. NotElapsed and not-in-watchlist now have framing + literals. No blank required state column.

- **Interface mismatch:** Conformance NVDA list/load + 422 + session-books re-pin match §2.7 (`vendor_called: false`, `authorizes: nothing`, metrics token not `"auth": true`, NotInWatchlist-before-NotStoring). Path-A tick fields and load `detail` null lock align with §2/§4. Residuals are Minor list-clock / `path_a_detail` composition above — not a conformance vs §2 data-flow break.

- **Internal contradiction:** D1/D2/D3, Path-B `[16:00,16:05)` fill vs `AfterClose`, quiet-day mint vs `NoIdentity`, AC-35 in-progress clock omission, and the Full latch vs writer gap path are consistent. Residual filed Important (AC-7 persist-fault “shows” vs §2.2/§5 “may”). Pass-1 Full Critical is gone.

- **Guardrail breach:** Spec text upholds operator/trader separation, score `Authorizes: nothing`, no `LiveMassive`/`present` on tape, Pages 404, zero vendor on read, collision-only start refusal under D3, and recv-never-awaits-disk under `[live-vs-static-isolation]`. No §8 rule affirmatively waived. Persist-fault gap honesty is an AC consistency issue (Important), not a waived isolation guardrail.
