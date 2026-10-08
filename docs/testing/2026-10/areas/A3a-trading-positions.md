```csv
path,area,cases,guards,floor_class,verdict,category,evidence,referenced_by,origin
"apps/dashboard/src/app/features/trading/positions/PlSparkline.spec.ts","A3a-trading-positions","3","A P/L sparkline is drawn through a feed gap or from fewer than two points. It is a cosmetic trend line, with no stored or money figure.","","RETIRE","structure","PlSparkline.spec.ts:7-28 asserts SVG path strings (M/L) from sparklinePathD. The data-level rule (a null break that is never stitched) stays pinned at useTrends.spec.ts:35-48. A wrong path is visible and changes no figure.","none","de056833 2026-08-10"
"apps/dashboard/src/app/features/trading/positions/PositionRow.a11y.spec.tsx","A3a-trading-positions","1","The trend-help tooltip's hidden description escapes its cell and widens the page at 900px, or its icon is announced twice.","","RETIRE","structure","PositionRow.a11y.spec.tsx:10-58 asserts computed position:relative, svg aria-hidden/focusable and aria-describedby. The overflow symptom is measured in a real browser by e2e no-overflow.spec.ts:36-41,408 (/positions at md).","apps/dashboard-e2e/tools/isolation.mjs:53","1685edd8 2026-08-23"
"apps/dashboard/src/app/features/trading/positions/bannerRegion.spec.tsx","A3a-trading-positions","9","A faulted store shows a merge or stale-view notice that makes a false claim, the stale-P/L offline banner is hidden while faulted, or dismissing a stale-view notice writes to storage.","invariant:absent-is-not-none","TRIM","structure","Keep :87-92 (AC-65), :94-98 (AC-66) and :100-108 (dismiss writes nothing). Remove 6 copy/order/mock-callback cases (listed in NOTES). Read :1-128.","none","fe005fb7 2026-07-28"
"apps/dashboard/src/app/features/trading/positions/composeMark.spec.ts","A3a-trading-positions","25","A multi-leg position shows a partial, sign-inverted net mark when a leg is unpriced, a weaker or frozen leg basis is hidden, or a resting limit fills off a stale leg or a per-unit-vs-dollar units mix-up.","money","KEEP","","composeMark.spec.ts:30-139 all-or-nothing, weakest-link basis, frozen OR. :187-239 AC-44 fill refusals. :248-320 units defect plus the @ts-expect-error brand guard. composeMark.ts:38-171 read.","none","c93fe31c 2026-07-28"
"apps/dashboard/src/app/features/trading/positions/crossTicker.integration.spec.tsx","A3a-trading-positions","6","A foreign-ticker position on a multi-ticker page shows P/L priced off the focused ticker's spot (the reproduced $25200 / +$5200 fabrication) and keeps serving it as last-known.","repro","KEEP","","crossTicker.integration.spec.tsx:1-14 bug narrative. :148-230 own-spot pricing, withhold rather than borrow, offline last-known stays its own. Real store and real usePortfolio, network mocked only.","none","29af79cc 2026-08-04"
"apps/dashboard/src/app/features/trading/positions/defaults.spec.ts","A3a-trading-positions","21","A saved view is rewritten or throws on read (strategy-to-structure rename, stale filter, retired expiry axis), a column key is orphaned, or the unsaved-changes dot misreports.","invariant:loss-free-durable-migration","TRIM","structure","Keep partition :24-29, seed :33-38, configEqual :42-55, AC-82 :90-99 and normalizeViewConfig :118-184. Remove 8 copy/layout/duplicate max_loss and label cases at :59-88 and :103-114 (NOTES).","none","ff6d9c0a 2026-07-14"
"apps/dashboard/src/app/features/trading/positions/derive.spec.ts","A3a-trading-positions","19","A subtotal counts a withheld or closed row's P/L as zero or as running P/L, or a filter or structure sort silently drops or misorders positions.","money","TRIM","duplicate","Keep :53-203 and :220-254. Remove :205-208 (duplicate of defaults.spec.ts:139-141), :210-217 (retired expiry axis, unreachable) and :256-260 (duplicate of structure.spec.ts:46-70).","none","ff6d9c0a 2026-07-14"
"apps/dashboard/src/app/features/trading/positions/digest.spec.ts","A3a-trading-positions","8","The open-positions digest sent with an AI rec tells the model the trader has no exposure when the store faulted, or invents a max-loss figure for an unbounded structure.","invariant:absent-is-not-none","KEEP","","digest.spec.ts:40-126: faulted gives unavailable, never none_open; ineligible reason stated; open positions only; simulated source. This is the FE half of the tradeable-rec-inputs open_positions contract. capital_at_risk is a gap (NOTES).","none","47a8961f 2026-08-13"
"apps/dashboard/src/app/features/trading/positions/entry.spec.ts","A3a-trading-positions","8","A sim entry fills at the wrong price or basis, or a resting limit fills off a non-live mark or on the wrong side of the cross.","money","KEEP","","entry.spec.ts:22-64 manual/market/theoretical fill, null when there is no quote and no IV, limitWouldFill live-only at or below the limit. All three functions have production callers (usePortfolio.ts, TradeEntryDialogView.tsx, orders/engine.ts).","none","ff6d9c0a 2026-07-14"
"apps/dashboard/src/app/features/trading/positions/evalSubject.spec.ts","A3a-trading-positions","11","The position-context read (pos_* params) switches to a different leg after a reload because the leg.id tiebreak is missing, or a short put loses its subject.","contract","TRIM","structure","Keep :20-37 and :42-129 (selection, tiebreak, short fallback, no mutation). Remove :38-40 'carries NO primary_leg_label': the EvalSubject type at evalSubject.ts:33-36 already forbids that field.","none","8af2bdb1 2026-07-28"
"apps/dashboard/src/app/features/trading/positions/faulted.a11y.spec.tsx","A3a-trading-positions","24","A refused control on a faulted store still fires its write handler, or the faulted banner offers a repair/reset/delete path over the user's unreadable book.","invariant:loss-free-durable-migration","TRIM","structure","Keep :87-106 (activation is a no-op) and :190-196 (no repair/reset/clear). Remove 22: a11y attributes, focus, tooltip, disabled-token styling, 44px/11px/heading checks, focus pointer, and the :303-315 hex checks (duplicate of shared/theme/hex-discipline.spec.ts:19-30).","none","4859ffe9 2026-07-28"
"apps/dashboard/src/app/features/trading/positions/faulted.spec.tsx","A3a-trading-positions","17","A corrupt positions store is overwritten by the next open/close/save from the UI, an enabled entry control paints before the fault is known, or the faulted empty state claims 'no positions'.","data-write","TRIM","structure","Keep :213-225, :254-270, :309-322, :385-390 and :400-428. Remove 9: aria/focus, styling, the vacuous localStorage-only check :324-331, banner order, visible read-side, :361-383 (duplicate of faulted.a11y :190-196), :392-396 (duplicate of bannerRegion :94-98).","none","a4bc36fc 2026-07-28"
"apps/dashboard/src/app/features/trading/positions/fixtures.spec.ts","A3a-trading-positions","10","A shared test fixture stops being the shape its name says. This is test tooling, with no user data.","","RETIRE","risk-gone","fixtures.spec.ts:22-99 asserts facts about fixtures.ts only. Consumers go red on drift: migrate.spec.ts:140-151 (colliding ids), structure.spec.ts:46-70 and maxLoss.spec.ts:126-128 (shapes), migration.spec.ts:223-238 (unparseable blob).","none","69d914ae 2026-07-28"
"apps/dashboard/src/app/features/trading/positions/future-copy.spec.ts","A3a-trading-positions","3","Deferred alert copy constants get deleted, or get wired into a surface before the alert feature lands.","","RETIRE","structure","future-copy.spec.ts:39-73 is a ?raw source-text scan for five label names (TECH_DEBT #20). Wiring or deleting copy shows in the diff and the UI and touches no data, money or contract.","none","01831365 2026-08-01"
"apps/dashboard/src/app/features/trading/positions/leg.spec.ts","A3a-trading-positions","16","Leg cost or P/L arithmetic drifts: 100 shares up $1 reads $10,000, a short leg's sign flips, a credit's P/L% inverts or divides by ~0, or single-leg P/L diverges from the shipped formula.","money","KEEP","","leg.spec.ts:49-163 arithmetic, all-or-nothing and pl% states. :170-196 byte-identity against model/mark.ts pl (it.each with 5 rows, already table-driven). leg.ts:70-136 read.","none","e06a282f 2026-07-28"
"apps/dashboard/src/app/features/trading/positions/legDisclosure.spec.tsx","A3a-trading-positions","14","Expanding the legs writes view state to storage or refetches, an unpriced leg's 'unavailable' or the max-loss assumption/reason disappears, or the disclosure gains decorative motion.","data-write","TRIM","structure","Keep :123-138, :173-187, :200-215 (model-read-carries-its-assumptions) and :217-228 (single-motion-moment). Remove 10 a11y/layout/copy/scroll cases (NOTES). :189-198 is implied by the no-write case :173-187.","apps/dashboard-e2e/tools/isolation.mjs:55","8ce8b34d 2026-07-28"
"apps/dashboard/src/app/features/trading/positions/maxLoss.spec.ts","A3a-trading-positions","27","A position shows a confident max-loss figure for an unbounded, multi-expiry or unnamed shape, or the dollar figure for one of the 15 eligible structures is wrong.","money","TRIM","duplicate","Keep 24. Remove :75-78 (size 15, covered by the name-for-name check :85-105), :107-119 (covered by :85-105 and the partition :130-150), :189-193 (condor >0; the exact figure is at :195-205). maxLoss.ts:21-128 read.","none","6be74306 2026-07-28"
"apps/dashboard/src/app/features/trading/positions/maxLossCell.spec.tsx","A3a-trading-positions","7","The max-loss table cell prints a signed, zero, 'Unlimited' or bare-dash value instead of one unsigned figure or one stated reason.","money","TRIM","structure","Keep :47-84 and :94-99. Remove :86-92 AC-78 no-tint (styling; the direction-only rule is kept by the tint.spec.tsx:363-384 source scan).","none","5de8118c 2026-07-28"
"apps/dashboard/src/app/features/trading/positions/migrate.spec.ts","A3a-trading-positions","34","The one legacy lift and union lose, duplicate, invent or bring back deleted positions and decisions when the v1/v2 stores merge into v3. That loss is silent, total and irreversible.","invariant:loss-free-durable-migration","KEEP","","migrate.spec.ts:38-137 lift (idempotent, no fabrication, never throws). :139-360 union (distinct ids, abort entirely, a brand pair is one source, decisions once). :362-395 merge. migrate.ts read.","none","362e2501 2026-07-28"
"apps/dashboard/src/app/features/trading/positions/migration.spec.ts","A3a-trading-positions","28","The real store cutover over real localStorage re-runs the union, deletes or rewrites a source blob, half-promotes on an unreadable source, or flattens a multi-leg v2 record.","invariant:loss-free-durable-migration","KEEP","","migration.spec.ts:73-153 union, :157-218 once-only and no resurrection, :222-271 abort entirely, :275-300 logical source, :304-385 legs survive, :389-418 durable notice, :423-441 v3 latch.","none","6260d92b 2026-07-28"
"apps/dashboard/src/app/features/trading/positions/offlineLayout.spec.tsx","A3a-trading-positions","1","The offline caption fails to wrap, or the sticky Close column escapes the table frame.","","RETIRE","structure","offlineLayout.spec.tsx:49-72 asserts computed flexWrap, flexBasis, overflowX and position:sticky. Pause icon and caption presence stay pinned at positions.risk.spec.tsx:917-937. Overflow is measured by e2e no-overflow.spec.ts:408.","none","631fd190 2026-08-15"
"apps/dashboard/src/app/features/trading/positions/pauseGlyph.spec.ts","A3a-trading-positions","4","A text pause glyph renders instead of the stroke pause icon on the positions/broker surface.","","RETIRE","structure","pauseGlyph.spec.ts:64-106 is a ?raw scan for one glyph character (criterion 29). It concerns only the icon's form, which is visible on screen, with no data or money.","none","bdc992d8 2026-09-07"
"apps/dashboard/src/app/features/trading/positions/positionCard.spec.tsx","A3a-trading-positions","11","The mobile card shows a signed or second risk figure, labels a credit as a debit, renders undefined/NaN for a shares expiry, or dims a static slot when offline.","money","TRIM","structure","Keep :80-87, :108-125, :145-150 and :172-193. Remove 6 layout/a11y cases :70-78, :89-106, :127-135, :137-143, :152-170 and :195-200 (NOTES).","apps/dashboard-e2e/tools/isolation.mjs:54","5c6143a8 2026-07-28"
"apps/dashboard/src/app/features/trading/positions/positions-stage0.spec.tsx","A3a-trading-positions","7","A Close or Cancel control becomes a non-native clickable div, or the mobile card loses pending/closed parity or the forced card layout.","","RETIRE","structure","positions-stage0.spec.tsx:95-167 keyboard and tagName a11y checks with single-row mocks. :172-194 and :215-234 layout. :196-210 offline dim duplicates positionCard.spec.tsx:172-193.","none","357b07d6 2026-07-22 superpowers-plan"
"apps/dashboard/src/app/features/trading/positions/positions.risk.spec.tsx","A3a-trading-positions","32","End-to-end sim book: lots merge or get averaged, a limit fills off-cross or better than its price, an SSE drop blanks P/L, the four not-a-number literals collapse, a scoring request is issued, or a saved view is rewritten.","smoke","TRIM","structure","Keep 21: centerpiece :369-432, grouping, durability, isolation, PAPER, additive, the literals, offline 27a/27b/28, static-survives and AC-82. Remove 11 (NOTES): risk-slot duplicates of maxLossCell.spec.tsx, breakpoint layout, glyph, a11y, and a test of a spec-local helper.","apps/dashboard-e2e/tools/isolation.mjs:56","05702e92 2026-07-16"
"apps/dashboard/src/app/features/trading/positions/readonly.spec.tsx","A3a-trading-positions","7","Grouping, filtering or switching views refetches, touches the book or rewrites a saved view, or the portfolio calls anything other than the contract lookup.","data-write","TRIM","duplicate","Keep :270-334 and :347-365. Remove :218-255 (duplicate of legDisclosure.spec.tsx:173-187), :257-264 (config-key shape) and :340-345 (tests the spec-local isBookSyncException).","none","29e01b13 2026-07-28"
"apps/dashboard/src/app/features/trading/positions/store.spec.ts","A3a-trading-positions","20","The durable positions store loses a v1 or legacy-brand trade, discards a source blob, overwrites a corrupt blob on the next write, or throws on quota or corruption.","invariant:loss-free-durable-migration","KEEP","","store.spec.ts:86-173 v1 carry-over, :175-227 brand hop that never deletes, :229-254 degrade without throwing, :256-289 CRUD, :297-381 fault latch leaving storage byte-identical.","none","ff6d9c0a 2026-07-14"
"apps/dashboard/src/app/features/trading/positions/structure.spec.ts","A3a-trading-positions","42","A leg set is mis-named (for example a short call named as a long call), which flips max-loss eligibility and the structure shown, or an unrecognised shape is named instead of custom.","money","TRIM","structure","Keep the 21-row it.each, the residue cases, AC-19, AC-17 order and no-mutation, the 22-member check and the ordinal check. Remove 5: :72-75 (duplicate of :193-196), :185-189 (duplicate of :174-177), :198-202 and :217-221 (label copy), :223-235 (return type guarantees it).","none","1fc7a962 2026-07-28"
"apps/dashboard/src/app/features/trading/positions/testSeed.spec.ts","A3a-trading-positions","6","The demo-account seed writes fake positions into a real user's book, clobbers existing positions, or re-seeds after the user deleted the seeded rows.","data-write","KEEP","","testSeed.spec.ts:39-94: seeds only for the test email, one-time marker, non-destructive over existing rows, never throws. testSeed.ts:135 is called from AuthContext.tsx.","none","ff6d9c0a 2026-07-14"
"apps/dashboard/src/app/features/trading/positions/tint.spec.tsx","A3a-trading-positions","13","A position cell is tinted green or red by call/put, side or credit instead of by signed P/L direction, telling a trader a short call is bullish.","","TRIM","structure","Keep :363-384, a source scan with no render: success/error are chosen only by a sign comparison (canon DESIGN_SYSTEM.md:69,257). Remove 11 render className cases at :131-330 and the :340-347 hex scan (duplicate of shared/theme/hex-discipline.spec.ts:19-30).","none","d6fa515f 2026-07-28"
"apps/dashboard/src/app/features/trading/positions/usePortfolio.views.spec.tsx","A3a-trading-positions","16","The hook flattens a multi-leg open to its first leg, writes on render, mis-isolates a 404, blanks P/L on an SSE drop, or fills a limit off a stale, wrong-side or multi-leg mark.","data-write","TRIM","duplicate","Keep 15. Remove :210-226, the excluded-and-counted subtotal (the rule is at derive.spec.ts:164-169; the null emission at :193-206). closePosition's realized P/L is untested (NOTES).","none","0100348a 2026-07-28"
"apps/dashboard/src/app/features/trading/positions/useTrends.spec.ts","A3a-trading-positions","6","The session P/L change (session delta) anchors to something other than the first observed P/L, series bleed across positions, or a feed drop is stitched over.","money","TRIM","structure","Keep :24-48 and :64-80. Remove :9-22 (series growth, covered by the :35-48 series assertion) and :50-62 (consecutive-break collapse, a sparkline rendering detail).","none","ff6d9c0a 2026-07-14"
"apps/dashboard/src/app/features/trading/positions/view.spec.ts","A3a-trading-positions","30","The row projection shows a partial P/L or mark when a leg is unpriced, mixes unpriceable with unavailable, renders undefined/NaN, changes a static field offline, or shows the wrong strikes in the structure line.","money","CONSOLIDATE","structure","Merge 12 structure-line string cases (:73-107, :115-175, :395-418) into one table over the fixtures. Drop :352-363 frozen OR (duplicate of composeMark.spec.ts:94-104). 30 to 18. Keep AC-22/32/39, live-vs-static and pl_pct.","none","3312aefc 2026-07-28"
```

**NOTES**

**TRIM and CONSOLIDATE case lists** (before → after)

- **bannerRegion.spec.tsx** (9 → 3). Remove:
  - 'renders nothing at all when nothing is wrong'
  - 'the shipped offline banner is BYTE-IDENTICAL and non-dismissible'
  - 'shows AT MOST ONE dismissible notice — the merge notice wins while it is pending'
  - 'the stale-view notice appears only AFTER the merge notice is gone'
  - 'the merge notice states NO counts and points at export without renaming the action'
  - 'dismissing the merge notice is DURABLE — it delegates to the host, never to local state'. The durable flag itself is tested at migration.spec.ts:404-418.
- **defaults.spec.ts** (21 → 13). Remove:
  - 'is labelled — the label map is the key universe, so an unlabelled key fails the build'
  - 'is in DEFAULT_COLUMNS and NOT in OPTIONAL_COLUMNS — the partition has no duplicate'
  - 'sits between trend and expiry, matching the left-to-right scan order'
  - 'has no TABLE_HEADER_LABELS override — the header copy and the menu copy are the same two words'
  - 'is in FIGMA_COLUMNS — the fit was measured and RULED at `lg` and above (AC-82)'
  - 'FIGMA_COLUMNS and DEFAULT_COLUMNS now agree EXACTLY — no pending key remains'
  - 'renames the column, sort and group keys'
  - 'AC-34 — the entry column header reads Net entry and the word Cost is gone'
- **derive.spec.ts** (19 → 16). Remove:
  - 'the group axis offers exactly None · Ticker · Structure — Expiry does not return'
  - 'the `expiry` axis remains reachable in derive.ts so restoring it costs zero schema'
  - 'long put and long call project to different structures'
- **evalSubject.spec.ts** (11 → 10). Remove 'carries NO primary_leg_label — that field is deferred with the copy'.
- **faulted.a11y.spec.tsx** (24 → 2). Keep 'the HTML `disabled` attribute is NEVER applied, and activation does nothing' and 'offers NO repair / reset / clear path — the store never repairs and never deletes'. Remove the other 22:
  - 'TAB reaches the refused control and the reason enters the accessibility tree'
  - '…and by hover as well, so neither input modality is a dead end'
  - 'the banner is the `aria-describedby` TARGET, and that target actually exists'
  - 'the Ticker-page notice carries the SAME id, so the door explains itself too'
  - '`when=false` is a pass-through: no aria, no tooltip, no wrapper, no cost'
  - 'is `role="status"` — a standing condition, not an alert that interrupts'
  - 'both of its actions are real buttons with accessible names'
  - 'the warning ICON is decorative — the heading beside it already carries the meaning'
  - 'the leg disclosure keeps aria-expanded / aria-controls correct while faulted'
  - 'leg text holds the 11px floor and leg side is a WORD, never a coloured glyph'
  - 'the mobile disclosure hit target is at least 44px'
  - 'STAT VALUES ARE NEVER HEADINGS — not on the card, not while faulted'
  - '{dark,light}: the banner renders with an icon and both actions, and adds no hardcoded hex' (2 cases)
  - '{dark,light}: the refused CTA wears the theme's disabled tokens and the enabled one does not' (2 cases)
  - '{dark,light}: hover shifts neither colour nor elevation on a refused control' (2 cases)
  - 'a REFUSED control is still a first-class tab stop — the treatment is additive, never `disabled`'
  - 'the treatment MERGES with the control’s own sx — it never discards it'
  - '`when={false}` adds NO style at all — a healthy surface is byte-identical to shipped'
  - 'moves focus to the Archive block instead of duplicating or renaming its action'
- **faulted.spec.tsx** (17 → 8). Remove:
  - 'every mutating control is aria-disabled AND STILL FOCUSABLE — never HTML `disabled`'
  - 'EVERY refused control goes through the ONE primitive — none is hand-rolled'
  - 'the entry CTA is a visibly QUIETER control while faulted than while healthy'
  - 'the latch is PER-STORE — a faulted positions store leaves the orders store usable'. This one is vacuous: it only writes and reads `convexa.unrelated.v1` through jsdom localStorage and never calls app code.
  - 'both banners render, faulted FIRST; faulted dims nothing and shows no ⏸'
  - 'offline alone disables no control — the two states never borrow each other`s treatment'
  - 'AC-62 — the banner is non-dismissible, carries an icon, and both actions are operable'
  - 'AC-66 — while faulted NO dismissible notice renders: not merge, not stale-view'. Near-vacuous here, because the corrupt store has no provenance or saved views to trigger either notice.
  - 'grouping, density and the status filter all still work — a fault refuses WRITES, not reads'
- **legDisclosure.spec.tsx** (14 → 4). Remove:
  - 'AC-35 — appears ONLY when a position has more than one leg'
  - 'AC-35 — one line per leg, with side as a WORD, size, instrument, expiry and that leg`s own mark'
  - 'AC-12 — legs carry NO actions: no button, no link, no per-leg Close or Cancel'
  - 'carries NO per-leg P/L — it would invite the partial-sum reading the all-or-nothing rule bans'
  - 'AC-79 — the control is a real <button> with aria-expanded and a RESOLVING aria-controls'
  - 'AC-79 — keyboard-operable: Enter AND Space both toggle it, and it takes focus'
  - 'AC-36 — the state is EPHEMERAL: a re-mount comes back collapsed'
  - 'the table expansion is a REAL sibling <tr> spanning every column (a real table structure)'
  - 'leg text sits above the 11px floor (AC-79)'
  - 'AC-45 uses the visual viewport minimum delta and never layout scrolling'
- **maxLoss.spec.ts** (27 → 24). Remove:
  - 'has exactly 15 members and every member is a real StructureKind'
  - 'excludes every structurally unbounded shape and every multi-expiration shape'
  - 'an iron condor loses at most the WIDER wing minus the credit'
- **maxLossCell.spec.tsx** (7 → 6). Remove 'AC-78 — the risk slot carries NO tint: neither the figure nor the reason is success/error'.
- **positionCard.spec.tsx** (11 → 5). Remove:
  - 'the footer has EXACTLY five items for both a 1-leg and a 4-leg position'
  - 'AC-30 — leg count changes ONE label and nothing else in the COLLAPSED card'
  - 'the structure line gets minWidth 0 + ellipsis while the chip never shrinks'
  - 'multi-expiry shows the NEAREST expiry with a `+1 more` suffix — never two dates in one slot'. It checks only the format, not which date.
  - 'AC-79 — the disclosure button is ≥44px tall and its expansion stacks one line per leg'
  - 'stat values are never headings (the 29-<h6> regression cannot return)'
- **positions.risk.spec.tsx** (32 → 21). Remove:
  - 'AC-43/45 keeps disclosure contrast and uses visual-viewport minimum deltas'
  - 'admits only exact GET/PUT book sync requests'. It tests the spec's own helper at :205-207.
  - '29 — the pause marker is the declared stroke icon on every live-derived cell, never a text glyph'
  - 'cell-unavailable / cell-not-recorded / cell-no-basis are focusable and self-describe via aria-describedby, wording unchanged (U-15)'
  - "dashCell's untestidded `—` stays hover-only, unchanged — no assertion may assume a DOM hook for it"
  - 'AC-28 — the risk slot renders an UNSIGNED figure, never +$ or −$' (duplicate of maxLossCell.spec.tsx:47-58)
  - 'AC-29 — an ineligible structure renders a reason, never a bare —, never 0, never a number' (duplicate of maxLossCell :60-67)
  - 'AC-29 — `unlimited risk` and `unnamed shape` stay distinguishable, never clipped to a prefix' (duplicate of maxLossCell :69-84)
  - 'renders the column at `lg` and above' (duplicate of defaults.spec.ts:90-99)
  - 'OMITS the column at `md` — the ruled band, asserted rather than re-measured'
  - 'below `md` the figure is NOT lost — the card footer carries it (no band loses it silently)' (duplicate of positionCard.spec.tsx:80-87)

  I kept the grouping no-fetch case at :453-474 on purpose. Its readonly counterpart counts only `/api/contract/` calls, so it would not catch a scoring fetch triggered by grouping.
- **readonly.spec.tsx** (7 → 4). Remove:
  - 'expanding and collapsing a leg block issues ZERO fetches and leaves storage byte-identical'
  - 'AC-36 — the expansion state is absent from the persisted view config, so a reload forgets it'
  - 'admits only exact GET/PUT book sync requests'
- **structure.spec.ts** (42 → 37). Remove:
  - 'covers all 21 named members — the recogniser has no unreachable name'
  - 'is stable across repeated calls'
  - 'labels every member exactly once, with no label reused'
  - 'AC-16 — no label implies collateral, cash set aside or buying power'
  - 'every recognised kind is a declared member (the function cannot invent a name)'
- **tint.spec.tsx** (13 → 1). Keep only 'success/error are selected ONLY by a sign comparison — never by a leg or structure attribute'.
  - I kept it because DESIGN_SYSTEM.md:69 (Banned table) and :257 cite this file as the enforcement of "green/red for signed direction only". That table is design canon, not a promoted invariant. If you don't treat it as floor, this last case can go too.
- **usePortfolio.views.spec.tsx** (16 → 15). Remove 'AC-39/AC-40 — a withheld row is EXCLUDED from the subtotal and COUNTED, never summed as zero'.
- **useTrends.spec.ts** (6 → 4). Remove 'grows the series as P/L samples arrive (AC-9)' and 'collapses consecutive breaks into one gap marker'.
- **view.spec.ts** (30 → 18), CONSOLIDATE. Merge these 12 into one table-driven test over {fixture → structure_line, structure_line_collapsed, structure_line_full}:
  - 'the single-leg structure line is BYTE-IDENTICAL to the shipped descriptor'
  - 'AC-37 — an over-long strike list collapses in the STRING, first-and-last, with the leg count'
  - 'AC-37 — a short strike list does NOT collapse: every strike stays in the cell form'
  - 'a vertical reads the leg facts alone — the noun lives on the chip and in the tooltip'
  - 'a condor carries strikes and a leg count, never the word `condor`'
  - 'a calendar keeps its two expiries — the EXPIRIES are facts, only the noun goes'
  - 'single-leg, covered call and shares-only cells are BYTE-IDENTICAL to shipped'
  - 'a vertical names its two strikes, its right and the word vertical'
  - 'a covered call reads shares-plus-the-option, not a strike list'
  - 'a shares-only position reads in shares'
  - 'an unrecognised shape reads as a plain leg count — no diagnosis, no warning register'
  - 'an iron condor lists its four strikes with the noun'

  The table should keep these rows: single leg, vertical (2 strikes, no collapse), condor (the collapse boundary at STRUCTURE_LINE_MAX_STRIKES=3, with ellipsis and leg count), covered call, shares, custom, and calendar (expiry arrow). Also drop 'frozen ORs up from the legs onto the view' (duplicate of composeMark.spec.ts:94-104).

**UNSURE questions** (no file verdict is UNSURE; these concern untested floor behaviour):

1. digest.ts:118-124 sums only eligible max-loss figures into `capital_at_risk`, so an open unbounded short call adds $0. That figure is sent to the AI and rendered as "Capital at risk: X" (AnalysisSurface.tsx:228). digest.spec.ts:70 asserts only `expect.any(Number)`. Is understating capital at risk when an ineligible position is open intended?
2. usePortfolio.ts:516-537 (`closePosition`): when any leg is unresolved, the realized P/L falls back to `plAtUniformMark` (one per-unit price applied to every leg, then the entry price, then `?? 0`), and that figure is written durably. For a multi-leg close, that is the uniform-price fabrication composeMark.spec.ts:289-297 bans for limits. Is that intended?

**NEW-BEHAVIOR-TEST**

- `closePosition` realized P/L write, in usePortfolio.views.spec.tsx. A single-leg close should persist `realized_pl_dollar` equal to the row's `pl_dollar`. A multi-leg close with an unresolved leg should not persist a uniform-mark or $0 figure (the expected behaviour depends on UNSURE #2). No spec in this area drives `closePosition` and asserts the figure it writes.
- `capital_at_risk` when an ineligible open position is present, in digest.spec.ts (depends on UNSURE #1).
- Outside this area, related to the retired a11y unit coverage: the a11y gate covers the faulted positions state only as an alternate selector in dark scheme (apps/dashboard-e2e/src/quality/fixtures/scenarios.ts:487-501, A11Y-5). `[a11y-gate-scans-both-schemes-and-overlays]` names gated states in both schemes.

**FLAKY or timing-based**

- positions.risk.spec.tsx:438-447 `fetchSettled()` polls `waitFor` until the fetch count is stable across two polls (~50ms). It is a timing heuristic, and its own comment documents the race it papers over.
- usePortfolio.views.spec.tsx:107-114 `mount()` (2 microtask turns) and crossTicker.integration.spec.tsx:127-133 `settle()` (3 turns) assume lookups land within a fixed number of microtasks. If the hook gains one extra `await`, the null-expecting cases pass without having tested anything (crossTicker :175-189 and :219-230, usePortfolio :269-279). The fix is to `waitFor` the spy to resolve rather than count ticks.
- positions.risk.spec.tsx has 20000ms per-case timeouts (:432, :474, :509, :572, :615, :655, :673, :778, :1119), which signals heavy flows.

**SLOW** (area wall time ≈26.2s; positions.risk is 57% of it)

- **positions.risk.spec.tsx (15.0s).** The cheapest safe speed-up is `userEvent.setup({ delay: null })`, and seeding positions with `putPosition` (as readonly.spec.tsx does) instead of typing through TradeEntryDialog. That applies wherever entry is not what the case tests: grouping :453, durability view :481, isolation :579, PAPER :687, additive :757. Keep the dialog only in the centerpiece and the market-no-price case. The 11 removals also cut renders.
- **faulted.spec.tsx (2.7s).** Each case mounts AuthProvider plus PortfolioPanel. After the trim, 8 cases remain; adding `delay: null` helps.
- **readonly 1.6s, legDisclosure 1.3s, tint 1.3s, faulted.a11y 1.2s.** These mostly go away with the trims.

**Housekeeping if applied**

- apps/dashboard-e2e/tools/isolation.mjs:53-56 lists PositionRow.a11y, positionCard, legDisclosure and positions.risk in `D8_TEST_ALLOWLIST`, and d8-boundary.spec.mjs:12 pins that list's length at 10. Retiring PositionRow.a11y.spec.tsx means either updating that pin or leaving the stale entry, which does no harm.
- docs/superpowers/plans/2026-07-26-scanner-04-frontend.md:29,3955 cite positions-stage0.spec.tsx as the matchMedia-stub idiom. That pointer goes stale on retirement.

Totals: KEEP 9 · TRIM 16 · CONSOLIDATE 1 · RETIRE 7 (structure 6, risk-gone 1) · UNSURE 0 · NEW-BEHAVIOR-TEST 0 file verdicts (2 behaviours flagged above). Cases 486 → 342 (−144: 29 from retired files, 115 from trims and consolidation).
