# S2 — skeptic findings: chain-snapshot-capture

Reviewed: `SPEC.md`, `INTERFACE_CONTRACT.md`, `BRIEF.md`, `council/conflicts.json` (11/11 ids),
`council/decisions.md` (D1=A, D-ret, D-copy, T1–T3), `council/R2-{architect,pm,ux}.md`, prior
`S2-findings.md` (pass 1). Method: walked every `conflict_id` into SPEC **body text** (not only
fold stamps) first; then AC observability, §4 states, INTERFACE vs §2/§4, section-vs-section,
§8. Re-probed prior C1/C2 and the six Importants against the repaired text. Cross-checked cited
live seams: `market_data/live.rs`, `market_data/mod.rs` (`MarketDataSourceKind` snake_case),
`domain/market.rs` (`OptionsMarketState`, `MarketPhase` tokens), `analytics.rs`
(`compute_analytics` / `gex_cache` / `load_analytics` / `load_or_compute` / `refresh_analytics` /
`compute_analytics_from_vendor`), `warmer.rs`, `massive/rest.rs`, `pg_scan.rs` (`scan_bundles`
`ON CONFLICT (symbol)`; structure-history prune), `functions/api/[[path]].ts` (Pages `_metrics`
404; `_research` still absent — implementation debt, not a spec hole),
`libs/quant-engine/src/types.rs` (`Contract`).

Settled facts **not** treated as defects: D1=A (every paid fetch on an **in-scope** producer
appends, no thinning); D-ret dual 14d + 48/symbol; `NO_UI_CHANGE`; warmer / `refresh_analytics`
excluded this ship; miss string `no stored snapshot for <SYMBOL>`; AC-15 is `test`.

## §0

- **Produced:** `.spire/clusters/tech/contracts/chain-snapshot-capture/council/S2-findings.md`
- **Critical count:** 0
- **Important count:** 2
- **Prior C1 (live ban vs `source: live_massive`):** **closed**
- **Prior C2 (list-miss `detail` on empty list 200 + conformance):** **closed**

## Critical  (blocks — must loop back to R4)

- None. Both prior Criticals are closed in body text (not only fold stamps / HTML comments), and
  the six-check re-probe did not find a new unsatisfiable ship-gate. See Checked for what was
  re-opened.

## Important  (should fix)

- **§2.3’s capture data-flow still hooks the `VendorBundle` construction site inside `compute_analytics`, which is also the warmer path the same section excludes.** SPEC.md §2.3 diagram: “VendorBundle materialized (compute_analytics fresh path / live.rs resolve) → … → Capture leaf (parallel): clone VendorBundle.” Live construction is `VendorBundle { … as_of: Utc::now() … source: LiveMassive }` in `compute_analytics` (`apps/api/src/services/analytics.rs`); `refresh_analytics` calls that same function; `warmer.rs` calls `refresh_analytics` on the default-on ~25s loop. The exclusion says “Capture must not hook the warmer loop” and “a warmer paid fetch that writes nothing is **out of AC-28**.” A builder who implements the diagram (R1’s stated mechanism: hook where the bundle is built, before it drops) captures warmer, burns `CHAIN_SNAPSHOT_MAX_PER_SYMBOL=48` in minutes, and makes the 14-day age dial a dead letter on warm symbols — the failure the exclusion exists to prevent — and **no AC fails**, because AC-28 only covers scanner / serve-ticker. A builder who implements the exclusion must hook `load_or_compute` / `load_analytics` (or pass a flag) and **not** `compute_analytics`. Name the hook site as those two callers (or an explicit “not inside `compute_analytics`”) so the diagram and the exclusion describe one program — evidence: SPEC.md §2.3 data-flow + “In-scope producers” + “Explicitly excluded this round”; SPEC.md AC-28; `analytics.rs` `compute_analytics` / `refresh_analytics`; `warmer.rs` `refresh_analytics` + `WARM_ENABLED` default true / `WARM_INTERVAL_SECS` default 25.

- **List-miss still claims a stored load.** SPEC.md §4 Empty (miss): “**No** “STORED CHAIN SNAPSHOT” claim on an empty list.” SPEC.md §4 Miss: “print/return the closed `detail` only — do **not** emit line 1 `RESEARCH READ — STORED CHAIN SNAPSHOT` when no row exists.” INTERFACE_CONTRACT.md list 200 (and the ZZZZNOPE conformance required set) still mandates `provenance` as the constant `loaded from store · no vendor call` family on miss, plus `license`. “Loaded from store” is the approved **hit** “how obtained” line (SPEC.md §4 closed vocabulary; mandatory research-read order step 3, **hit only**). INTERFACE’s parenthetical “does not imply a row exists” does not make the string true on `count === 0`. Two builders will either omit `provenance` on miss (fails the required-key table) or emit a stored-load claim on an empty ticker (fails §4 Empty / miss). Framing was repaired (`RESEARCH READ — NO STORED SNAPSHOT`); provenance was not — evidence: SPEC.md §4 Empty + Miss + mandatory order “hit only”; INTERFACE_CONTRACT.md list 200 `provenance` / `license` + ZZZZNOPE `required.provenance`.

## Minor / advisory

- **`market.contracts[]` is still an untyped array on the load-hit table and in conformance, while bars/trades now name element fields.** AC-3 (`test`) needs a body that can feed `compute_analytics_from_vendor`; GEX reads `Contract` (`strike_price`, `contract_type`, `open_interest`, `expiration_date`, `implied_volatility`, optional `greeks` / `volume` / `bid` / `ask` in `libs/quant-engine/src/types.rs`). INTERFACE says “Full `OptionsMarketState` domain on the wire” but does not pin those keys the way it pins `DailyBarWire` / `IntradayBarWire` / `TradePrintWire`. A slim `contracts: [{}]` still type-passes — evidence: INTERFACE_CONTRACT.md load 200 `market.contracts` + conformance fourth endpoint; SPEC.md AC-3 / §2.1.

- **Optional `limit=0` (or any clamp to an empty page) makes `count === 0` / `store=miss` / miss `detail` a false miss while rows exist.** INTERFACE defines `count` as page length when `limit` is set. AC-1 already requires the default (no `limit`) list; say `limit` must be ≥ 1 or that `store`/`detail` follow the unclamped store, not the page — evidence: INTERFACE_CONTRACT.md list Query + `count` / `store` / `detail`.

- **AC-14 (“does not … delay the trader response”) still has no stall-injection hook or budget.** Observable in principle; two testers will pick two timeouts — evidence: SPEC.md AC-14; SPEC.md §2.3 spawn rule.

- **UX-10 (never label digested structure history or `scan_bundles` as a “stored chain snapshot”) still has no AC.** §4 closed vocabulary bans the rename; §7 does not automate it — evidence: `council/R1-ux.md` UX-10; SPEC.md §4 closed vocabulary; SPEC.md §3.

- **Conformance list-miss `detail` is type-only (`string`), not the locked value.** AC-9 (`test`) and the field table carry the exact string; GATE Q will still accept `none for this ticker`. Worth pinning if the runner ever grows value checks; not a missing transport — evidence: INTERFACE_CONTRACT.md ZZZZNOPE `required.detail`; SPEC.md AC-9; T2 / `8c938b8b…`.

- **Load-200 GATE Q seed is a 1 ns identity (`1970-01-01T00:00:00.000000001Z`) that a `timestamptz` column cannot store.** Spec requires nanos preserved and allows UNVERIFIABLE if the plant cannot run; store `as_of` as text / integer nanos, not PG timestamptz — evidence: INTERFACE_CONTRACT.md Hit-probe seeding + standing rule 8; SPEC.md §2.6 `as_of` precision.

## Checked and clean

- **1. Dropped conflicts — clean (done first).** Walked all eleven `conflicts.json` ids into SPEC body text, not only the footer receipt / HTML stamps:
  - `18414e85…` / `4f26c095…` / `5b58c363…` / `7a522d83…` (every paid fetch vs min-interval skip) → D1=A in §1 Out, §2.3 (in-scope producers + no skip class), §2.7, AC-4 policy caveat, AC-28. No “capture skipped — within min interval” token.
  - `ccc9fc0a…` / `0ff23844…` / `66ce89ed…` (dual retention; architect-named dials; no count-only) → §2.4 both bounds always apply; 14d + 48; GATE Z to change; AC-19/20 “active retention policy.”
  - `200df8d4…` (AC-15 verify-by) → AC-15 `test`; AC-23 stays `review` (T1; settled, not a defect).
  - `b9b5ba17…` (operator copy In) → §4 `NO_UI_CHANGE` + “wording under the closed vocabulary is In (**D-copy**).”
  - `8c938b8b…` (one miss string) → AC-9 / §4 Empty / INTERFACE miss `detail` bind `no stored snapshot for <SYMBOL>` on **both** list miss and load 404; competing “none for this ticker” banned.
  - `5e9322d5…` (who names transport) → §2.5 domain facts + §6 pointer; INTERFACE names GET paths, list/load bytes, conformance (T3).
  Footer receipt lists 11/11 `disposition: folded`. §9 holds **None** — no R2 conflict parked there.

- **Prior C1 — closed.** SPEC.md §4 Hard ban is now “Live badge/chip and any label that means ‘this quote is live’,” with an explicit carve-out that `source: live_massive|fixture` is required provenance and that a scan failing because `source` equals `live_massive` is a false failure. AC-25 and §7 match. INTERFACE standing rule 9 repeats the carve-out. Live serde remains `#[serde(rename_all = "snake_case")]` on `MarketDataSourceKind::LiveMassive` → `live_massive` (`market_data/mod.rs`). The ship-blocking pair is satisfiable.

- **Prior C2 — closed.** AC-9 now names research **list** (`count === 0` / `store=miss`) and locks wire `detail` to exactly `no stored snapshot for <SYMBOL>`. INTERFACE list 200 table requires that `detail` on miss (`null` on hit). Conformance second endpoint (`ZZZZNOPE`) requires `detail: string` on the 200 empty list. Closed vocabulary binds miss `detail` on **both** list miss and load 404; CLI is explicitly not a substitute. Load 404 remains the dated-identity miss (AC-10).

- **Prior Importants — disposition.** (1) Warmer unnamed — **folded as exclusion** (residual hook-site hole is Important above, not a reopened “is warmer in?” product call). (2) same-second `ON CONFLICT` vs D1 — **closed** (§2.6 fractional-second / nanos rule; INTERFACE standing rule 8; rewrite is same-identity only). (3) AC-1 +1 at cap + no completion signal — **closed** (AC-1 retention caveat; §2.6 poll / `chain snapshot appended` log / test barrier). (4) Pages `_research` 404 — **closed** (§2.5, AC-16, INTERFACE standing rule 4 + non-endpoints). (5) load-hit bytes / AC-3 `review` / no conformance hit — **closed** as the original hole (ATM/phase/timestamp, typed bar/trade fields, AC-3 now `test`, fourth conformance endpoint); contracts[] element schema left as Minor. (6) `capture not storing` + AC-26 unbound — **closed** (§4 Storage-not-configured state + closed vocab; INTERFACE 500 `detail`; AC-13/AC-26 name the strings).

- **2. Unobservable ACs — no remaining ship-gate.** Re-read AC-1–AC-21, AC-24–AC-28. Append completion is now an external poll/log/barrier (not trader 200). List-miss `detail` is on the HTTP envelope. AC-3 hit body is on the wire + conformance. AC-15/16/25/27 are structural or envelope checks. AC-14 still lacks a stall budget (Minor, not a missing outcome). AC-22/23 stay `review` as honesty checks.

- **3. Unspecified component states — clean for required states.** Trader S0 unchanged. Research S1 now has Default / Loading / Empty / Error / Capture write failure / Storage not configured, each with operator-visible copy and a forbidden column. R1-UX Stale/aged and prune-vs-never are correctly absent (no freshness dial; v1 single miss string; Future names the vouched distinction).

- **4. Interface mismatch — no remaining ship-gate.** List/load paths, `store`/`source`/`vendor_called`, miss `detail`, load-hit GEX fields, Pages 404, `as_of` fractional seconds, and conformance four-probe set now match §2.5 / §3 / T3. Residual mismatches (miss `provenance`, untyped `contracts[]`, `limit` vs `store=miss`) are Important/Minor above, not a field the UI consumes that the block does not promise (`NO_UI_CHANGE`).

- **5. Internal contradiction — no remaining unsatisfiable pair.** Re-probed live vs `live_massive` (carved out), D1 vs warmer (excluded, with hook-site leftover as Important), D1 vs same-second rewrite (nanos + same-identity only), AC-1 +1 vs 48-cap (caveat), empty-list framing vs “STORED CHAIN SNAPSHOT” (framing repaired; provenance leftover as Important). AC-8 empty count and AC-9 miss `detail` compose. Load 404 vs list 200 miss is intentional.

- **6. Guardrail breach — no SPEC-text violation of the named §8 list.** Checked: `[operator-vs-trader-path-separation]` (research prefix, Pages 404 like `_metrics`, no trader chrome, no vendor on read); `[best-effort-isolated-or-null]` (AC-12/13/14/27, spawn, write-fail log); `[additive-keeps-score-byte-identical]` (AC-17, one-way leaf); `[no-secrets-in-image]` (AC-21, serialize boundary, `rest.rs` `apiKey` must not cross); `[single-ticker-on-demand]` (AC-24, sweep-only multi-ticker); `[absent-is-not-none]` (closed miss vs empty book, now on list and load); `[single-motion-moment]` / `[theme-token-discipline]` (`NO_UI_CHANGE`); Massive license text present. `[cited-code-is-verified-not-assumed]`: `live.rs` / `compute_analytics` `Utc::now()` bundle build, `rest.rs` URL `apiKey`, `scan_bundles` `ON CONFLICT (symbol) DO UPDATE` in `pg_scan.rs`, `scan_structure_history` ring prune, `gex_cache` hit returning `AnalyticsSnapshot` without a bundle, `MarketPhase` wire tokens `rth` / `after_close` / `closed_pre`, `DailyBarWire` / `IntradayBarWire` / `TradePrintWire` fields — all match the tree; no Python `scanstore` citation.
