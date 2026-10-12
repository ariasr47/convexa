```csv
path,area,cases,guards,floor_class,verdict,category,evidence,referenced_by,origin
"apps/dashboard/src/app/features/trading/TradeEntryDialog.risk.spec.tsx","A3b-trading-broker-orders-outcomes","18","A sim entry silently records the wrong mode, price, basis or quantity, or pre-types an AI-asserted stop/target/size, corrupting every position or order built from it.","money","KEEP","","TradeEntryDialog.risk.spec.tsx:1-442; TradeEntryDialog.tsx:1-20. Covers the confirm payload per mode, the blocking states, the order-variant byte-identity guard, the good-til helpers and AC-68/79/80 (ai-asserted-numbers-are-traceable).","none","05702e92 2026-07-16"
"apps/dashboard/src/app/features/trading/multiLegEntry.spec.tsx","A3b-trading-broker-orders-outcomes","17","A multi-leg sim entry saves the wrong legs, sides or multipliers, or shows a partial or sign-inverted net, so a credit reads as a debit.","money","TRIM","structure","multiLegEntry.spec.tsx:1-384. Keep the payload, net and refusal cases :142-176, :193-207, :218-234, :251-335, :359-383. Drop 8 cases (see NOTES).","none","ee6dc534 2026-07-28"
"apps/dashboard/src/app/features/trading/shared-entry.flow.spec.tsx","A3b-trading-broker-orders-outcomes","2","Positions or Ticker launches a forked entry dialog, or a resting limit fills off a non-live mark or at the wrong price.","invariant:single-shared-sim-entry-dialog","KEEP","","shared-entry.flow.spec.tsx:1-304. :255-274 is the only check that both pages mount the one dialog; :276-303 checks the limit fills only on a live cross, at the limit price.","none","ff6d9c0a 2026-07-14"
"apps/dashboard/src/app/features/trading/model/captureDigest.spec.ts","A3b-trading-broker-orders-outcomes","10","Entry-context capture throws into a trade write, fetches, dumps raw data, or records the account-size figure into the durable log.","data-write","KEEP","","captureDigest.spec.ts:1-211; captureDigest.ts:1-112 (best-effort, no fetch, labels only, presence flag only).","none","fe1cd21a 2026-07-16"
"apps/dashboard/src/app/features/trading/model/legMark.spec.ts","A3b-trading-broker-orders-outcomes","11","A leg is priced off another ticker's price or a 0/borrowed mark (R8), showing a confidently wrong P&L.","money","KEEP","","legMark.spec.ts:1-160 (R8 repro: a leg's own underlying or null).","none","29af79cc 2026-08-04"
"apps/dashboard/src/app/features/trading/model/mark.spec.ts","A3b-trading-broker-orders-outcomes","14","The mark ladder or P&L arithmetic silently yields a wrong or fabricated mark or P&L.","money","KEEP","","mark.spec.ts:1-135 (ladder precedence, pl() arithmetic, bsPrice put-call parity). No other spec tests computeMark/bsPrice directly.","none","05702e92 2026-07-16"
"apps/dashboard/src/app/features/trading/model/store.spec.ts","A3b-trading-broker-orders-outcomes","7","The retired ghost-trade blob gets rewritten, destroyed on corruption, or loses its legacy-brand copy, so trading history is lost.","invariant:loss-free-durable-migration","TRIM","duplicate","model/store.spec.ts:1-140; model/store.ts:1-95. The setItem scan at :75-77 duplicates positions/migration.spec.ts:213-217.","none","05702e92 2026-07-16"
"apps/dashboard/src/app/features/trading/model/useTickerSpots.spec.tsx","A3b-trading-broker-orders-outcomes","7","A foreign-ticker leg borrows the focused ticker's price, or a failed refresh blanks a spot that had loaded.","money","KEEP","","useTickerSpots.spec.tsx:1-128; useTickerSpots.ts:1-103.","none","29af79cc 2026-08-04"
"apps/dashboard/src/app/features/trading/orders/copy.spec.ts","A3b-trading-broker-orders-outcomes","2","The side-column orders widget title truncates. Visual only, no data involved.","","RETIRE","structure","orders/copy.spec.ts:1-24; orders/copy.ts:1-80. Pins a non-contract layout string; a truncation is visible on screen.","none","ff6d9c0a 2026-07-14"
"apps/dashboard/src/app/features/trading/orders/engine.spec.ts","A3b-trading-broker-orders-outcomes","17","A sim order triggers or fills off a non-live tick, fills at the wrong price, retro-fills after a stream drop, or applies a transition twice.","money","TRIM","duplicate","engine.spec.ts:1-217. 'placement-already-met' (:62-66) runs the same stateless evaluateOrder path as :57-60.","none","ff6d9c0a 2026-07-14"
"apps/dashboard/src/app/features/trading/orders/orders.risk.spec.tsx","A3b-trading-broker-orders-outcomes","9","A rec→Act order skips the mandatory confirm, reaches a real order path, fills wrong or twice, is stored despite a server 403, overwrites a corrupt store, or loses its scenario marker.","invariant:no-real-order-path","KEEP","","orders.risk.spec.tsx:1-820. All 9 cases are floor; per-case classes and the speed-up are in NOTES.","none","05702e92 2026-07-16"
"apps/dashboard/src/app/features/trading/orders/seed.spec.ts","A3b-trading-broker-orders-outcomes","7","A rec's prose trigger is mis-parsed into a guessed or wrong trigger level that gets pre-filled into an order.","parser","KEEP","","seed.spec.ts:1-57 (the D2 never-guess parser matrix).","none","ff6d9c0a 2026-07-14"
"apps/dashboard/src/app/features/trading/orders/store.spec.ts","A3b-trading-broker-orders-outcomes","9","Sim orders are overwritten or destroyed on a corrupt blob, lost on reload, or exported without their rec→order→position join.","data-write","TRIM","structure","orders/store.spec.ts:1-168; orders/store.ts:1-171. Drop 'exportFilename…' (:165-167): filename only, export content is covered by :128-163.","none","ff6d9c0a 2026-07-14"
"apps/dashboard/src/app/features/trading/orders/useOrderEngine.spec.tsx","A3b-trading-broker-orders-outcomes","2","One bad order, or one failed contract lookup, stops evaluation and fills for every other order.","invariant:best-effort-isolated-or-null","KEEP","","useOrderEngine.spec.tsx:1-253.","none","ff6d9c0a 2026-07-14"
"apps/dashboard/src/app/features/trading/broker/BrokerGroupHeader.spec.tsx","A3b-trading-broker-orders-outcomes","36","A broker group header on real holdings shows a wrong net or P/L, a wrong direction, or collapses 'not provided' into 'unavailable'.","money","TRIM","duplicate","BrokerGroupHeader.spec.tsx:1-384; BrokerGroupHeader.tsx:150-437. Row and card share NetEntry, GroupPl, CountClause and the panel; mobile parity is covered at grouping.integration.spec.tsx:537-567. 23 cases go (see NOTES).","none","fc0d2356 2026-08-06"
"apps/dashboard/src/app/features/trading/broker/BrokerTabPanel.spec.tsx","A3b-trading-broker-orders-outcomes","18","The broker tab claims an empty book when the read failed, shows a stale snapshot as fresh, blanks on SSE drop, or calls the broker while signed out.","invariant:absent-is-not-none","TRIM","duplicate","BrokerTabPanel.spec.tsx:1-382. Drop S1 (:146-159): copy and href only, and the deep link is driven at broker.integration.spec.tsx:258-266.","none","d7a28f9c 2026-08-02"
"apps/dashboard/src/app/features/trading/broker/broker.integration.spec.tsx","A3b-trading-broker-orders-outcomes","1","The connect→read→refresh→disconnect journey breaks, or the old book's data stays on screen after disconnect.","smoke","KEEP","","broker.integration.spec.tsx:1-323 (one 8-step journey through the real App and router).","none","f424321f 2026-08-02"
"apps/dashboard/src/app/features/trading/broker/broker.risk.spec.tsx","A3b-trading-broker-orders-outcomes","28","The broker surface gains an order affordance, a sim-dialog import, client-side persistence of broker data, or a 'live' freshness claim.","invariant:no-real-order-path","CONSOLIDATE","duplicate","broker.risk.spec.tsx:1-290. Fold the :242-254 arm sweep into the :185-204 sweep: same ALL_ARMS and same render, no assertion lost.","none","a271c2c1 2026-08-02"
"apps/dashboard/src/app/features/trading/broker/brokerCrossTicker.integration.spec.tsx","A3b-trading-broker-orders-outcomes","4","A broker row is priced off the focused ticker (R8 showed +$5200 instead of +$1000), or an offline cold start poisons the last-known value.","money","KEEP","","brokerCrossTicker.integration.spec.tsx:1-195 (R8 repro, broker half).","none","29af79cc 2026-08-04"
"apps/dashboard/src/app/features/trading/broker/brokerView.spec.ts","A3b-trading-broker-orders-outcomes","29","A real broker position is projected with the wrong side, size or multiplier, a fabricated $0 or partial P&L, or the wrong withheld literal.","money","TRIM","structure","brokerView.spec.ts:1-297. Drop :65-69 (determinism of a pure id helper) and :127-135 (sim-view origin/purity; git grep -w origin shows no consumer).","none","391ffa32 2026-08-02"
"apps/dashboard/src/app/features/trading/broker/fixtures.contract.spec.ts","A3b-trading-broker-orders-outcomes","14","A broker fixture drifts so the credit, withholding and leg-count tests pass vacuously off the captured book.","guard","KEEP","","fixtures.contract.spec.ts:1-178; fixtures.ts:1-60. This is the non-vacuity proof that the grouping and header money tests depend on.","none","674459d2 2026-08-06"
"apps/dashboard/src/app/features/trading/broker/genericOptionRow.spec.tsx","A3b-trading-broker-orders-outcomes","29","Partial Webull rows are blanked (the 9-of-14 repro), an unknown multiplier defaults to ×1 or ×100, or a broker row says 'not recorded' or 'unavailable' for a permanent gap.","money","TRIM","duplicate","genericOptionRow.spec.tsx:1-349. Drop :186-215 (duplicates positions.risk.spec.tsx:898-907) and :228-235 (duplicates :272-276).","none","0d474616 2026-08-04"
"apps/dashboard/src/app/features/trading/broker/grouping.integration.spec.tsx","A3b-trading-broker-orders-outcomes","23","The grouped broker tab shows a group net that disagrees with its members, drops a position, contradicts the members' P/L literal, renders Webull's P/L, or adds a fetch.","money","TRIM","duplicate","grouping.integration.spec.tsx:1-648. Drop 11 cases (see NOTES); keep AC-1/34/6x2/5/6c/8/11/28/29/35/31.","none","1605e204 2026-08-06"
"apps/dashboard/src/app/features/trading/broker/grouping.spec.ts","A3b-trading-broker-orders-outcomes","31","Group nets or P/L sums are wrong, partially summed or double-counted, or a group struct starts naming a structure.","money","TRIM","structure","grouping.spec.ts:1-532. Drop AC-33 ordering (:336-348): display order only, and a wrong order is visible.","apps/dashboard-e2e/playwright.config.ts:32 (substring hit on broker-grouping.spec.ts, not this file)","591e5835 2026-08-06"
"apps/dashboard/src/app/features/trading/broker/noNaming.render.spec.tsx","A3b-trading-broker-orders-outcomes","13","A broker group starts naming an option structure on its own the day the vendor feed carries strike, expiry and right.","invariant:structural-over-prose-enforcement","KEEP","","noNaming.render.spec.tsx:1-187 (layer-3 future-feed render plus 5 poisons). The invariant text in PROJECT_CONTEXT cites this three-layer stack.","none","4ebc9285 2026-08-06"
"apps/dashboard/src/app/features/trading/broker/noNaming.scan.spec.ts","A3b-trading-broker-orders-outcomes","12","A new broker module imports the structure-naming machine or hand-types a shape word, and nothing fails.","invariant:structural-over-prose-enforcement","KEEP","","noNaming.scan.spec.ts:1-127 (recursive scan, anti-vacuity, EXEMPT-path existence, mutation guards).","none","9966d96e 2026-08-06"
"apps/dashboard/src/app/features/trading/broker/predicates.spec.ts","A3b-trading-broker-orders-outcomes","8","A stale broker snapshot is shown as fresh, staleness is invented client-side, or 'degraded' fires with no snapshot.","contract","KEEP","","predicates.spec.ts:1-84 (server-declared threshold, strictly greater-than).","none","d9c144ce 2026-08-02"
"apps/dashboard/src/app/features/trading/broker/reassess.spec.tsx","A3b-trading-broker-orders-outcomes","5","A reassessment of a real holding drops its as-of basis or offers an accept or write affordance against real money.","invariant:no-real-order-path","KEEP","","reassess.spec.tsx:1-97.","none","88b4cbb6 2026-08-02"
"apps/dashboard/src/app/features/trading/broker/renderState.spec.ts","A3b-trading-broker-orders-outcomes","16","A failed or unknown broker read renders as 'confirmed empty', or a credential failure lands in the wrong state.","invariant:absent-is-not-none","TRIM","duplicate","renderState.spec.ts:1-259; renderState.ts:15,84 delegate to isStale. Drop :241-254 (duplicates predicates.spec.ts:36-39) and :256-258 (asserts a constant defined in the spec itself).","none","d9c144ce 2026-08-02"
"apps/dashboard/src/app/features/trading/broker/unrenderedBrokerPl.spec.tsx","A3b-trading-broker-orders-outcomes","17","Webull's own unrealized P&L, roughly 100× wrong by its own arithmetic, reaches the screen.","money","KEEP","","unrenderedBrokerPl.spec.tsx:1-219 (render sweep plus source scan with mutation guard).","none","5fd1853f 2026-08-04"
"apps/dashboard/src/app/features/trading/broker/useBrokerBook.spec.tsx","A3b-trading-broker-orders-outcomes","10","A throttled refresh is shown as fresh, a failed refresh blanks the book, or a signed-out user triggers broker requests.","contract","KEEP","","useBrokerBook.spec.tsx:1-172 (the C5 attempt semantics agreed with the server).","none","d9c144ce 2026-08-02"
"apps/dashboard/src/app/features/trading/outcomes/archive.spec.ts","A3b-trading-broker-orders-outcomes","24","Importing or exporting the trading archive deletes, overwrites or double-adds history, or a declined import touches the stores.","invariant:loss-free-durable-migration","TRIM","duplicate","archive.spec.ts:1-500. Drop :342-350: parseArchive is pure, and the version-99 decline is already at :238-241.","none","fe1cd21a 2026-07-16"
"apps/dashboard/src/app/features/trading/outcomes/boundaries.spec.ts","A3b-trading-broker-orders-outcomes","28","Outcome stats leak into the score or AI path, the ledger writes or calls the network, a new close path goes unseen, or the account size is persisted.","invariant:structural-over-prose-enforcement","TRIM","structure","boundaries.spec.ts:1-429. Drop AC-14 (:256-265): a styling scan, and a tint would be visible.","none","fe1cd21a 2026-07-16"
"apps/dashboard/src/app/features/trading/outcomes/copy.spec.ts","A3b-trading-broker-orders-outcomes","10","A hit rate renders without its range, N, mean and dispersion, a building cohort shows a rate, or an exclusion reason silently disappears.","invariant:model-read-carries-its-assumptions","TRIM","structure","outcomes/copy.spec.ts:1-119; copy.ts:142-155. Drop 'labels are distinct' (:115-118): copy wording only.","none","fe1cd21a 2026-07-16"
"apps/dashboard/src/app/features/trading/outcomes/ledger.spec.ts","A3b-trading-broker-orders-outcomes","43","The track record's hit rate or coverage counts records it must not (seeded, typed, scenario, open), double-counts, or fabricates exits.","money","TRIM","duplicate","ledger.spec.ts:1-850. Drop :374-380: same seed and assertion as 'case 7a' (:618-627).","none","fe1cd21a 2026-07-16"
"apps/dashboard/src/app/features/trading/outcomes/track-record.flow.spec.tsx","A3b-trading-broker-orders-outcomes","28","The rendered track record shows a premature or naked rate, calls an unreadable store empty, or a declined import writes anyway.","smoke","TRIM","duplicate","track-record.flow.spec.tsx:1-592. Drop 8 cases (see NOTES).","none","fe1cd21a 2026-07-16"
"apps/dashboard/src/app/features/trading/tradeEntry/submitGate.spec.tsx","A3b-trading-broker-orders-outcomes","6","Confirm enables when a rec left the strike, expiry or direction unstated, opening a position the AI never specified.","guard","KEEP","","submitGate.spec.tsx:1-121 (refusal arms plus non-vacuity arm 5).","none","934d8f1f 2026-08-14"
```

## NOTES

### TRIM and CONSOLIDATE case lists

**multiLegEntry.spec.tsx — TRIM 17→9 (structure)**

Remove these 8 cases:
- 'AC-8 — multi-leg happens INSIDE this dialog: one dialog element, no builder, no step flow' (:115-126)
- 'AC-9 — the trader prices PER LEG and NO field anywhere asks for a net' (:128-140)
- 'the confirm action`s name is unchanged in every case — one leg or six' (:178-185)
- 'AC-9 — the net is LABELLED as computed from the leg prices' (:209-216)
- 'the word `Cost` is retired from every net-bearing surface in this dialog' (:236-243)
- 'AC-6 — an UNNAMED leg set confirms with no error, no warning styling, no icon, no toast' (:283-298)
- 'AC-18 — changing a leg so the SHAPE changes updates the displayed name immediately' (:300-312)
- 'Market and Limit are single-leg option modes, refused VISIBLY once a second leg exists' (:343-357)

Each of these failures shows up in the dialog and changes no saved payload. The money half of the last case stays in :359-370.

**model/store.spec.ts — TRIM 7→6 (duplicate)**
- Remove 'the module contains no setItem call at all' (:75-77). It duplicates positions/migration.spec.ts:213-217.
- Coordinate with the A3a auditor so exactly one of the two survives.

**engine.spec.ts — TRIM 17→16 (duplicate)**
- Remove 'placement-already-met: the first payload after placement triggers (AC-9 semantics)' (:62-66). evaluateOrder is stateless, so this runs the same path as :57-60.

**orders/store.spec.ts — TRIM 9→8 (structure)**
- Remove 'exportFilename is convexa-orders-{YYYY-MM-DD}.json' (:165-167).

**BrokerGroupHeader.spec.tsx — TRIM 36→13 (mostly duplicate)**

Restructure the describe.each so only AC-18 runs per variant.

Remove from both variants (12 cases):
- 'AC-2 — carries the ticker, the count, …' (structure)
- 'AC-3 / AC-16b — no quantity figure, no percent' (structure)
- 'AC-6b — AAPL / META render `2 option legs`' (duplicates grouping.spec.ts:299-307 and fixtures.contract.spec.ts:42-55)
- 'AC-13 — the P/L is withheld with the net, the same literal' (duplicates the in-file AC-16a BOOK_CF_NO_COST row, :178-191)
- 'AC-30 / AC-32 — no reassess affordance, …' (structure; the order-verb and coming-soon sweep at broker.risk.spec.tsx:185-204 already renders a group)
- 'the count clause is a real tab stop, …' (duplicates noNaming.render.spec.tsx:122-143)

Remove from the row variant only (1 case):
- 'AC-16b — the identity cell spans both leading grid columns …' (layout)

Remove from the card variant only (10 cases):
- 'AC-6b — the noun and the number …'
- 'AC-9 — one figure …'
- 'AC-9c + P3 …'
- 'AC-16a …'
- 'AC-11 / [absent-is-not-none] …'
- 'AC-17a …'
- 'AC-19 …'
- 'AC-36 …'
- 'P1 …'
- 'the panel REPLACES the basis sentence with the withheld reason'

The card variant reuses the same sub-components (BrokerGroupHeader.tsx:296-437). Keep the card AC-18, because snapshot dimming wraps different boxes in each variant.

**BrokerTabPanel.spec.tsx — TRIM 18→17 (duplicate)**
- Remove 'S1 never-connected: heading, body, deep-link CTA to Settings #brokerage, sub-line' (:146-159).

**broker.risk.spec.tsx — CONSOLIDATE 28→17 (duplicate)**
- Merge '%s: the RENDERED text never claims `live` (testids/routes exempt by construction)' (:242-254, 11 cases) into '%s: no order/trade/close/modify affordance — not even disabled' (:185-204) by adding the liveViolations assertion there.
- Same arms, same render, half the renders, no coverage lost.

**brokerView.spec.ts — TRIM 29→27 (structure)**
- Remove 'leg ids are stable across rebuilds (the mark-cache/diffing key)' (:65-69).
- Remove 'sim regression: buildPositionView emits origin `sim` (the one additive field) and stays pure' (:127-135).

**genericOptionRow.spec.tsx — TRIM 29→27 (duplicate)**
- Remove 'the SIM book keeps `not recorded` — this substitution is broker-only' (:186-215). The A3a auditor must keep positions.risk.spec.tsx:898-907 for this to be safe.
- Remove 'the modeled-P/L withheld branch (BrokerPositionRow.tsx ModeledPl) renders `not provided`' (:228-235). It is the same fixture and assertion as :272-276.

**grouping.integration.spec.tsx — TRIM 23→12 (duplicate and structure)**

Remove these 11 cases:
- 'aria-expanded="false" and the panel is hidden, for every group' (:194-206, structure)
- AC-20 ×4: BOOK_NO_CREDENTIAL, bookUnknown(broker_unreachable), BOOK_EMPTY and 'cold skeleton…' (:370-390). Duplicates BrokerTabPanel.spec.tsx:188-212 and :244-251.
- AC-21 ×2: 'degraded…' and 'reauth with a snapshot…' (:392-402). The same fixtures render rows in BrokerTabPanel.spec.tsx:220-242.
- 'NVDA and PLTR: no button/aria-expanded/aria-controls/chevron/"netted by Convexa"' (:408-456). Its money half duplicates genericOptionRow.spec.tsx:69-80.
- 'stays expanded after a same-book refresh AND after the 30s tick fires' (:462-491, structure)
- 'Object.keys(localStorage) is identical before and after expand + collapse' (:493-506). Persisted expand state costs nothing; broker durable isolation stays covered at broker.risk.spec.tsx:97-101 and :262-289.
- 'two renders of the same book give the same group order' (:573-597, structure)

Keep AC-35 (:603-617). It is the only check on ProvenanceHeader and the tab chrome, which the component-level leak tests do not render.

**grouping.spec.ts — TRIM 31→30 (structure)**
- Remove 'groups ascending by key, members ascending by id, repeatable' (:336-348).

**renderState.spec.ts — TRIM 16→14 (duplicate)**
- Remove 'boundary: EXACTLY at stale_after_seconds ⇒ NOT stale (strictly greater-than)' (:241-254).
- Remove 'S6 is a MODIFIER, never a state: no member of the closed set names it' (:256-258). It asserts a literal defined in the spec; the BrokerRenderState type is the real guarantee.

**archive.spec.ts — TRIM 24→23 (duplicate)**
- Remove 'a FUTURE version is still declined, and nothing is written' (:342-350).

**boundaries.spec.ts — TRIM 28→27 (structure)**
- Remove 'AC-14 — no semantic tint on any rate: no success/error palette, …' (:256-265).

**outcomes/copy.spec.ts — TRIM 10→9 (structure)**
- Remove 'the labels are distinct — the two basis reasons do not collide on the word "modeled"' (:115-118).

**ledger.spec.ts — TRIM 43→42 (duplicate)**
- Remove 'an unresolvable join is excluded with its own reason — never guessed, never defaulted' (:374-380). Keep 'case 7a' (:618-627).

**track-record.flow.spec.tsx — TRIM 28→20 (duplicate and structure)**

Remove these 8 cases:
- 'keeps every empty-family explanation on the readable secondary theme slot' (:79-87, colour)
- 'AC-E4 — day one: …' (:91-99; same fixture as AC-E3 at :101-116)
- 'AC-E2 — 19 counted still shows only "19 of 20" …' (:118-126; duplicates ledger.spec.ts:85-93)
- '⚠ AC-14 — no rate is tinted …' (:160-178, styling)
- 'AC-E7/E8/E9 — typed, re-priced and scripted outcomes …' (:254-276; duplicates ledger.spec.ts:126-165)
- 'AC-24 — re-importing the SAME file …' (:433-452; duplicates archive.spec.ts:138-158)
- 'AC-E16 — a colliding, DIFFERING record …' (:514-541; duplicates archive.spec.ts:114-136, and the conflict line already renders at :427-429)
- 'renders byte-identically regardless of any stream state …' (:571-591; it mounts the same thing twice, and the real guard is boundaries.spec.ts:245-254)

Keep AC-E6 (:278-291). It removes close_time, a different malformed shape from ledger.spec, which removes realized_pl_pct.

### UNSURE
None.

### NEW-BEHAVIOR-TEST
None. The broker credential's write-only, never-echoed behaviour is covered on the frontend in features/auth/brokerageSection.spec.tsx:92-139, which is outside this area.

### SLOW (kept)

**orders.risk.spec.tsx — 23.2 s for 9 cases. All 9 are floor.**

| # | Case | Lines | Floor class |
|---|------|-------|-------------|
| 1 | Centerpiece: rec→Act→order→live cross→fill→position | :411-512 | smoke, mandatory confirm, no-real-order-path, fill price, decision log |
| 2 | Cancel is terminal | :520-542 | data-write |
| 3 | Clock expiry with no stream | :544-559 | data-write |
| 4 | Live-only evaluation, no retro-fill | :567-615 | live-vs-static-isolation |
| 5 | Limit order fills at the limit, sets position entry price | :617-640 | money |
| 6 | Nothing order-flavored on the wire | :648-714 | no-real-order-path |
| 7 | Server 403 stores zero orders | :722-737 | server-side-gate-enforcement |
| 8 | Corrupt store keeps its blob | :739-753 | loss-free-durable-migration |
| 9 | ai_scenario marker survives to the ledger join | :761-819 | track-record integrity |

Every case mounts the full `<App/>`: lazy route, bundle and AI-rec panel (renderAt :338-347, settleTicker :382-385). Cheapest safe speed-up (I did not measure it):
- **Narrow host for cases 2 and 5.** They seed orders and never touch the rec→Act chain. Mount them on OrdersWidget plus useOrderEngine fed by the same MockEventSource (pattern at useOrderEngine.spec.tsx:167-176). Case 1 already proves the engine is wired on the ticker page and case 3 proves it on /positions.
- **`userEvent.setup({ delay: null })` across the file.**
- Keep cases 1, 3, 4, 6, 7, 8 and 9 on `<App/>`.

**multiLegEntry.spec.tsx — 12.7 s for 17 cases.**
- The TRIM removes the two MUI Select round-trips in AC-18.
- Add `userEvent.setup({ delay: null })`.
- The remaining combobox popovers (setStrike :93-97, expiration :273-274) are the likely heavy steps; not measured.

**Moderate (kept as is):** TradeEntryDialog.risk 4.8 s, shared-entry.flow 4.9 s, broker.integration 4.2 s, grouping.integration 4.3 s. The grouping.integration TRIM removes 11 renders.

### FLAKY / timing
- **useBrokerBook.spec.tsx:110-114** — a real 10 ms setTimeout sleep before a negative 'no request' assertion. It can pass vacuously.
- **orders.risk.spec.tsx:570-592** — `useFakeTimers({ shouldAdvanceTime: true })` plus a 16 s watchdog advance, so real and fake time are mixed.
- **Retry loops that re-push ticks** — orders.risk.spec.tsx:453-456, :629-632 and :807-810, and useOrderEngine.spec.tsx:246-249, push SSE or rerender inside a waitFor retry loop.
- **grouping.integration.spec.tsx:464-489** — fake timers plus a 31 s tick. This case is in the TRIM list.
- **Real-clock freshness** — BrokerTabPanel.spec.tsx:329-331 and broker.integration.spec.tsx:140 derive freshness from the real clock. Low risk.
- **Fixed-depth settle()** — useTickerSpots.spec.tsx:43-48 and brokerCrossTicker.integration.spec.tsx:123-129 flush a fixed number of microtasks. Sibling positive assertions in the same files currently prove the depth is enough.

Totals for A3b-trading-broker-orders-outcomes: KEEP 19 · TRIM 16 · CONSOLIDATE 1 · RETIRE 1 · UNSURE 0 · NEW-BEHAVIOR-TEST 0 (565 → 487 cases, −78)
