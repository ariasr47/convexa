```csv
path,area,cases,guards,floor_class,verdict,category,evidence,referenced_by,origin
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AiRecPanel.reasoning.spec.tsx","A1-ticker-ai-rec","10","The Levels-in-play chip shows bundle net GEX or IV/HV at the wrong size (e.g. 341.0K instead of 341.0M) and misleads the read.","parser","TRIM","structure","Read spec:1-141, reasoning.tsx:48-151. Keep :127 (LevelsStrip from bundle, fmtCompact). Retire 9: leadAndRest x3, deriveReasoning x2, ReasoningSection x3, :137 null bundle. These test how prose is split and toggled, and a failure is visible. 10->1.","none","7f1790f7 2026-07-14"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AiRecPanelBlocks.spec.tsx","A1-ticker-ai-rec","2","The idle snapshot hint shows the raw ISO timestamp instead of the ET clock form. Cosmetic, and the value is still correct.","","RETIRE","structure","Read spec:1-25. The formatter is already pinned at _kit/copy.spec.ts:193-215 (fmtAsOfEt). This file only proves SnapshotHint calls it. A failure shows a visible raw ISO, not wrong data.","none","f97e54d8 2026-09-10"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AnalysisSurface.spec.tsx","A1-ticker-ai-rec","21","The analysis drawer shows an absent figure as a dash or blank, drops the grounding clause on stop/target/invalidation, or changes the pinned read.","invariant:absent-is-not-none","TRIM","structure","Read spec:1-429, AnalysisSurface.tsx. Keep :73 :109 :128 :136 :275. Retire 16: section order/layout, MUI focus trap/Escape, call order, N5 date format (_kit/copy.spec.ts:193-241), N6 label count. 21->5.","none","c3f65d97 2026-08-15"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/DecisionCard.spec.tsx","A1-ticker-ai-rec","28","The card presents an untraced AI figure as Convexa's (mono font or a 'traces' clause), shows NaN/Infinity, loses the plan-scope caption, or misstates which key/model produced the read.","invariant:ai-asserted-numbers-are-traceable","TRIM","structure","Read spec:1-392, DecisionCard.tsx:1-539. Keep :112 :122 :133 :142 :201 :262 :306. Retire 21: DOM order, tab order, retired labels, tests that pass in the actions they then assert (:176 :231 :291), caption styling, N5 formatting. 28->7.","none","6172e58a 2026-08-15"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/FigureClause.spec.tsx","A1-ticker-ai-rec","1","The inside_range clause shows the raw YYYY-MM-DD expiration instead of 'Sep 18 (15 DTE)'. Cosmetic.","","RETIRE","structure","Read spec:1-60, FigureClause.tsx. The DTE arithmetic is pinned at _kit/copy.spec.ts:219-241 and clause selection at literals.spec.ts:431-454. A failure shows a visible raw date with the correct value.","none","a0e8cb97 2026-09-10"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/NumbersSaidStrip.spec.tsx","A1-ticker-ai-rec","9","The numbers-said strip shows another tenor's straddle move as the implied move for the cited expiration.","invariant:ai-asserted-numbers-are-traceable","TRIM","duplicate","Read spec:1-182, NumbersSaidStrip.tsx:23-67. Merge :97 :107 :115 (tenor pick) into 1 table. Retire :90 :122 :127 :135 (duplicate literals.spec.ts:220-367) and :157 :170 (formatting). 9->1.","none","47a8961f 2026-08-13"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ReadSheet.spec.tsx","A1-ticker-ai-rec","7","On a phone the bottom sheet mounts two verdict nodes or drops the container name. Visible layout, no data.","","RETIRE","structure","Read spec:1-154, ReadSheet.tsx:1-60. The verdict string is a prop built in AiRecPanel.tsx:220-226. The tests count mounts and read one CSS declaration; jsdom cannot evaluate the container query (the spec's own [lane-check]).","none","5e332efb 2026-09-05"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/StateExportDrawer.spec.tsx","A1-ticker-ai-rec","8","The export a user copies to an outside AI omits or mislabels what was or wasn't sent: a missing section instead of 'Not sent', as-next shown as as-sent, or wrong candidate counts.","invariant:absent-is-not-none","TRIM","structure","Read spec:1-209, StateExportDrawer.tsx:36-381. Keep :162 :171 :180 :200. Merge :108 :122 :152 (candidatesLine counts and cap clauses) into 1 table. Retire :116 (checks only that a title is present). 8->5.","none","47a8961f 2026-08-13"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ai-rec.absence.spec.tsx","A1-ticker-ai-rec","20","A trade card renders a plan field the AI never named as the reserved dash, a blank, null/NaN or the raw token. That is a fabricated 'not applicable'.","invariant:absent-is-not-none","TRIM","duplicate","Read spec:1-474. Keep the rule from :159/:229/:254 as ONE table, moved to a direct DecisionCard+AnalysisSurface render. The other 17 duplicate planLiterals.spec.ts:12-82, presentationPolicy.spec.ts:239-282 and DecisionCard.spec.tsx:262-306. 20->1.","none","934d8f1f 2026-08-14"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ai-rec.grounding.spec.tsx","A1-ticker-ai-rec","32","Accept pre-fills an untraced AI stop/target into the sim entry dialog, or a raw grounding token or Convexa's mono font leaks onto numbers in the AI's prose.","invariant:ai-asserted-numbers-are-traceable","TRIM","duplicate","Read spec:1-693. Keep :268 :413 :632 (move :268 and :632 to direct renders). Move :133 :142 :206 :227 into a cardGroundingLine table in literals.spec.ts. Retire 25 that duplicate literals.spec.ts:431-665, DecisionCard.spec.tsx:262 and TradeEntryDialog.risk.spec.tsx:217-322. 32->3.","none","efb6d586 2026-08-13"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ai-rec.risk.spec.tsx","A1-ticker-ai-rec","73","Confirming a sim trade or order writes 0 or 2 records, a signed-out user still sees the last read, an LLM call fires without a tap, or a failed key save echoes the raw key.","data-write","TRIM","duplicate","Read spec:1-1784. Keep 22: auth :616 :700; writes :874 :1324 :1343 :1363 :1383; no unrequested POST :941 :1130 :1281; plus :582 :956 :1583 :1693 :1753, the prefill block and 2 :747 rows. Retire 51 (mostly duplicates of presentationPolicy, literals and aiProviders.flow tests). Names in NOTES.","none","05702e92 2026-07-16"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/bannedWords.scan.spec.ts","A1-ticker-ai-rec","6","Ai-rec copy calls an unchecked AI figure 'verified' or 'confirmed', or shows a check glyph, overstating a fabricated number.","guard","TRIM","duplicate","Read spec:1-141. The scan and its mutation proofs stay (:78 :91 :103 :122 :132). Retire :110 'all three PREFILL_WITHHELD members pass the scan': :91 already scans copy.ts, where those strings live. 6->5.","none","efb6d586 2026-08-13"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.plan.spec.ts","A1-ticker-ai-rec","8","An absence word in a value slot reuses the reserved dash (which means not applicable), or the plan-scope caption stops naming every unchecked plan field.","invariant:absent-is-not-none","TRIM","structure","Read spec:1-101, copy.ts:412-470. Keep :23 :64 :80. Retire :37 (truthiness), :47 (DTE caption format), :52 (line text), :58 (tip wording), :74 (exact-string snapshot). 8->3.","none","934d8f1f 2026-08-14"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/decisionCard.structural.spec.ts","A1-ticker-ai-rec","8","The ai-rec module grows its own entry dialog or reads live-stream state, which would fork the one sim dialog or let an SSE drop change a pinned read.","invariant:single-shared-sim-entry-dialog","TRIM","duplicate","Read spec:1-123. Keep :71 :79 :102 :109. Retire :61 (duplicates shared/theme/hex-discipline.spec.ts over pages/**), :67 (duplicates single-motion-moment.spec.ts:135-152), :75 retired labels (structure), :83 fixed historical diff f41fe37..3b165c8 (risk-gone). 8->4.","none","87fe2580 2026-08-15"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/emDashCoalesce.scan.spec.ts","A1-ticker-ai-rec","4","A ?? '—' fallback quietly renders a missing value as the reserved not-applicable mark.","invariant:absent-is-not-none","KEEP","","Read spec:1-79. A mutation-proven pattern scan: :46 anti-vacuity, :54 the rule, :64 poison including escaped spellings, :75 the bound. Runs in 3 ms.","none","934d8f1f 2026-08-14"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/literals.spec.ts","A1-ticker-ai-rec","53","A wrong lookup branch pre-fills an untraced AI stop/target, shows a cap verdict on no_trade, or merges unavailable, not set and not given into one another.","invariant:ai-asserted-numbers-are-traceable","CONSOLIDATE","duplicate","Read spec:1-703, literals.ts:41-440. Merge fieldLiteral :41-:103 (8->1), capSurface :111-:126 (6->1), citedLine :151/:154/:157 (3->1), riskInputs :392/:395/:400 (3->1). Retire :131 :333 :677 :684 :688. Gains the cardGroundingLine table. 53->32.","none","47a8961f 2026-08-13"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planLiterals.spec.ts","A1-ticker-ai-rec","7","An off-scale or unnamed plan field renders the AI's raw string, 'unavailable' or 'not set' instead of its own absence word.","invariant:absent-is-not-none","TRIM","duplicate","Read spec:1-83, literals.ts:91-110. Retire :37 'unrecognized_value NEVER collapses into not_given'. It uses the same input as :27, whose toEqual(unrecognized) already rules out not_given. 7->6.","none","934d8f1f 2026-08-14"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planScopeCaption.render.spec.tsx","A1-ticker-ai-rec","6","The plan-scope caption disappears, is duplicated, or shows on local-rules or no_trade cards.","invariant:ai-asserted-numbers-are-traceable","RETIRE","duplicate","Read spec:1-136. The rule is covered by planScopeCaption.spec.ts:12-59, rendered presence and placement by DecisionCard.spec.tsx:306-317, and copy distinctness by copy.plan.spec.ts:80-100. :105 only tests React re-render determinism.","none","20053295 2026-08-17"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/planScopeCaption.spec.ts","A1-ticker-ai-rec","8","A trade card loses the caption saying plan fields aren't checked, so a reader treats those fields as checked.","invariant:ai-asserted-numbers-are-traceable","CONSOLIDATE","structure","Read spec:1-60, planScopeCaption.ts:8-11. Merge :12 :16 :25 :29 :33 :37 :47 (one input each, one rule) into 1 table. Retire :43, a check on source text; :16 already proves key_source is ignored by behavior. 8->1.","none","ef9ef4b6 2026-08-17"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/powering.banned.spec.ts","A1-ticker-ai-rec","1","Ask-AI powering copy promises 'free' or 'pool' usage while the user's own key is billed.","money","RETIRE","duplicate","Read spec:1-20. The same POWERING scan, plus the Settings copy, is at features/auth/aiProviders.flow.spec.tsx:293-301.","none","44ffa464 2026-08-20"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/prefill.absence.spec.ts","A1-ticker-ai-rec","6","Accept pre-fills a strike, expiration or call/put the AI never named (taken from the chain or guessed from bias), putting a fabricated contract one tap from a sim position.","invariant:ai-asserted-numbers-are-traceable","KEEP","","Read spec:1-70, prefill.ts:56-117. Pure, 2 ms. This is the natural home for the recToPrefill block now at ai-rec.risk.spec.tsx:1415-1531.","none","934d8f1f 2026-08-14"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/presentationPolicy.spec.ts","A1-ticker-ai-rec","32","A stale, superseded, incomplete, no_trade or signed-out read still offers Review or Create sim order, or Retry fires a paid LLM call through a cap or no-edge gate.","guard","CONSOLIDATE","duplicate","Read spec:1-348, presentationPolicy.ts:83-191. Merge the key-state cases :63 :74 :83 :92 :101 :118 :123 (reason -> requestState) into 1 table. That table is the frontend half that conformance/byo-ai-key.json hands to frontend tests. 32->26.","none","acfb3b23 2026-08-15"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/readLayout.render.spec.tsx","A1-ticker-ai-rec","36","The three reasons a read is degraded collapse into one message, or two different key failures show the same CTA, hiding which assumption failed.","invariant:model-read-carries-its-assumptions","TRIM","structure","Read spec:1-1002. Keep :575 and :669. Retire 34: amber color checks and other styling, 13 it.each rows asserting toBeTruthy on a typed field, mutation proofs against hand-built objects, and 2 full-App mounts (:947 :989). 36->2.","none","dd39e5ac 2026-09-05"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/readLayout.spec.ts","A1-ticker-ai-rec","113","No silent cost: a wrong body case in readLayoutFor. Production reads only the A1c note from it, and a missing quiet-gate note is visible.","","RETIRE","structure","Read spec:1-276, readLayout.ts:1-145. The only production use is AiRecPanel.tsx:191-192 (annexes.includes('A1c')); the body field is never read. The 105 it.each rows compare a pure function to a hand-written table; :209 is a TS type-level proof.","none","dd39e5ac 2026-09-05"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/reservedMark.render.spec.tsx","A1-ticker-ai-rec","5","A trade card shows the reserved dash in a plan or risk slot the AI left unnamed.","invariant:absent-is-not-none","RETIRE","duplicate","Read spec:1-184. The :165 rule is ai-rec.absence.spec.tsx:159 (kept and merged; add the risk labels from :116). :129 :143 :154 :176 count the harness itself or check for no grid (DecisionCard.spec.tsx:291). Unit cover: literals.spec.ts:41-107, emDashCoalesce.scan.spec.ts:54.","none","934d8f1f 2026-08-14"
"apps/dashboard/src/app/pages/ticker/widgets/ai-rec/useAiRecommendation.spec.ts","A1-ticker-ai-rec","3","A failed refresh silently replaces the user's pinned AI read, or a paused POST shows 'try again' and is rethrown.","repro","KEEP","","Read spec:1-126, useAiRecommendation.ts:60-200. Reproduces the shipped bug where the catch branch evicted the pinned read (spec header :4-11), with its contrast case and the GATE Z B2 paused amendment. 0.19 s; mocks only the network boundary.","none","5e332efb 2026-09-05"
```

**NOTES**

Line numbers are as of 8932fc11. Long names are cut with "…", and the line number identifies the case. A merged table counts as one test.

**The three slow files (152.3 s together)**

- **ai-rec.risk.spec.tsx: 73 → 22, 79.6 s, about 1.1 s per case. 57 of the 73 cases mount `<App/>`.**
  - Kept as floor:
    - :616 'logged out: the sign-in gate ONLY …' (auth)
    - :700 'produced retained read transitions from signed-in to signed-out …' (auth: a shared device shows the previous user's read, including account size)
    - :747 rows 'no power path → setup block (not model-missing)' and 'own key → produced rec + Using your Anthropic key, NO free-uses' (they prove the host wiring for conformance:byo-ai-key)
    - :874 'Ask-AI model select writes the standing preference' (a data write; the Settings-page version elsewhere is different code)
    - :941 'no-fresh-edge: … fires exactly one POST' (money: no LLM call without a tap)
    - :956 'transport fault: Retry is offered and the failure never escapes the panel …' (best-effort-isolated-or-null)
    - :1130 'SSE drop leaves the rec untouched; a newer bundle marks it stale WITHOUT … re-running' (live-vs-static-isolation, and no re-POST)
    - :1281 'next-read persona changes do not request or relabel the pinned read'
    - :1324, :1343, :1363, :1383 (review/order cancel writes nothing; confirm writes exactly one)
    - :582 bundle-sourced levels (ai-asserted-numbers-are-traceable)
    - recToPrefill cases :1420, :1439, :1465, :1522, plus the merged table below
    - :1583 'a save transport fault surfaces an error WITHOUT echoing the key' (no other test covers this)
    - :1693 provenance chip shows the account size verbatim
    - :1753 superseded-inputs strip. This is the only proof that AiRecPanel.tsx:119 gets `useSettings().riskInputs` from the session.
  - Merged: :1488, :1497, :1504, :1511 (the AC-7 traced/untraced/not_checkable/block-absent arms) become 1 table.
  - Removed as duplicates of cheaper checks in this area:
    - :747 rows 'key unusable…', 'key rejected…', 'saved model left catalog…', 'oauth expired…', 'oauth unlinked…', 'subscription unavailable…', 'subscription → produced rec…'. Covered by presentationPolicy.spec.ts:63-117, readLayout.render.spec.tsx:669 and DecisionCard.spec.tsx:122-141.
    - :824 'gated_off / no power path…' → presentationPolicy.spec.ts:118,132
    - :925 'daily cap…' → presentationPolicy.spec.ts:142. The cap is also enforced server-side.
    - :985, :1000, :1027, :1050, :1074 (the Retry-visibility cases, normal and scenario) → presentationPolicy.spec.ts:161-202,246-261
    - :1198 'retains only direct export while a refreshed recommendation is pending' → presentationPolicy.spec.ts:33
    - :1239 'cooldown disables…' → presentationPolicy.spec.ts:153
    - :1266 'a stale-born rec carries its at-birth warning…' → presentationPolicy.spec.ts:289 and readLayout.render.spec.tsx:575
    - :1304 'no_trade is a complete answer with NO Accept affordance' and :1644 'AC-69/70 — no_trade remains…' → presentationPolicy.spec.ts:303 and risk :1439
    - :1313 'Accept opens the shared entry dialog…' → risk :1324, which does everything it does
    - :1450 'derives the right from structure first…' and :1460 'AC-12c — an unnamed structure…' → prefill.absence.spec.ts:26-38
    - :1614 'renders NO cap-annotation DOM node…' → literals.spec.ts:111
    - :1657 'renders the warning cap annotation and Accept stays enabled' and :1668 'a figure exactly equal to the cap renders `within`' → literals.spec.ts:117-121. The frontend only maps the server's verdict; it does no comparison of its own.
    - :1679 'max_risk and position_size render `not set`…' → literals.spec.ts:81 and AnalysisSurface.spec.tsx:109
    - :1709 'the strip carries a freshness line…' and :1723 'the cited-contract line interpolates…' → literals.spec.ts:348-386
    - :1775 'renders nothing when the currently stored block still matches…' → literals.spec.ts:413-415
  - Removed as duplicates of tests in other areas: :1537 'add: the raw key rides ONLY the PUT body…' (aiProviders.flow.spec.tsx:134-162 and libs/api/src/lib/convexa.spec.ts:332-345), :1560 'replace then remove…' (:174-199), :1594 'storage unavailable…' (:274-291), :1602 'anonymous: the section offers sign-in…' (:53-65).
  - Removed as structure:
    - :649 'the manual export floor stays anonymous-usable…'. Its egress scan only reads the mock body the test itself wrote at :434-443, so it cannot catch a real leak.
    - :709 and :718 (sign-out transitions for the unavailable and loading states). Both failures are visible and harmless.
    - :851 'Ask-AI Settings CTA deep-links…'
    - :901, all 7 rows 'manual export remains reachable when powering is blocked by %s'. They re-check one boolean, presentationPolicy.ts:176.
    - :971 'a paused status read renders honest copy…'. Visible copy, and Retry is harmless.
    - :1096 'personas endpoint down…'
    - :1475 'AC-81 — a size string … carried verbatim'
    - :1739 'carries a tooltip on Max risk…'
  - Speed-up: after the trim, 14 `<App/>` mounts and 1 Settings mount remain, about 16-18 s at the measured average. That is an estimate; I did not run it.
    - Move :582 to a direct AnalysisSurface render (rec with 999 plus makeBundle) and :1693 to a direct ProvenanceChip render.
    - Move :1415-1531 to prefill.absence.spec.ts. It needs no App import and no useGate mock.
    - In :1383, drop `shouldAdvanceTime` and drive userEvent with `advanceTimers`.

- **ai-rec.grounding.spec.tsx: 32 → 3, 40.7 s, about 1.3 s per case. :476 mounts the app 3 times; :316 and :665 mount it twice.**
  - Floor cases kept:
    - :413 'AC-7 (SB) · untraced — Accept opens both price fields EMPTY…'. This is the only proof that useTickerTradeFlows.ts:67 passes `rec.grounding` through.
    - :268 'AC-32 (amended) — no grounding wire token…' (digested-labels-not-raw-dump). Render DecisionCard only: the analysis as-sent section intentionally prints raw tokens (AnalysisSurface.spec.tsx:153).
    - :632 'AC-34(a) — no number inside the reasoning prose…'. Use a direct AnalysisSurface render.
  - Moved to a cardGroundingLine table in literals.spec.ts: :133 'AC-15/AC-18…', :142 'AC-17…', :206 'AC-27 (SB)…', :227 'AC-20…'. Nothing covers these members at unit level today; literals.spec.ts:624 and :633 only cover poisoning and not_applicable.
  - Removed:
    - :157 and :168 → DecisionCard.spec.tsx:262-277 and AnalysisSurface.spec.tsx:128
    - :177 cannot happen by construction (DecisionCard.tsx:221-266)
    - :186 → literals.spec.ts:564
    - :195 → literals.spec.ts:111
    - :218 → literals.spec.ts:506
    - :239 → literals.spec.ts:633
    - :250 and :258 → presentationPolicy.spec.ts:203 and AnalysisSurface.spec.tsx:128
    - :316, :356, :370 → DecisionCard.spec.tsx:262 and literals.spec.ts:672,693
    - :381 → hex-discipline.spec.ts
    - :395, :431, :445, :463, :476 → TradeEntryDialog.risk.spec.tsx:217,265-322 and literals.spec.ts:646
    - :495 → ticker-desk-composition.spec.tsx:235-258, which scans the whole app
    - :523, :541, :553 → AnalysisSurface.spec.tsx:275, copy.plan.spec.ts:80 and bannedWords.scan.spec.ts:91
    - :573 is structure
    - :592 → AnalysisSurface.spec.tsx:321
    - :665 → literals.spec.ts:624. cardGroundingLine only accepts a Grounding object, so prose cannot reach it.
  - Speed-up: one App mount remains, about 1.5 s (estimate).

- **ai-rec.absence.spec.tsx: 20 → 1, 32.0 s, about 1.6 s per case. Seven cases mount the app 2-4 times.**
  - Floor: one rule, "an unnamed slot shows a closed absence word, never a dash, blank, null/NaN or raw token". :159, :229 and :254 are three single-input versions of it. Merge them into one table over recNoneNamed, recNoFieldReasonsBlock and recBlankValues. Render DecisionCard plus AnalysisSurface directly (the harness at planScopeCaption.render.spec.tsx:35-59) and add the four risk labels from reservedMark.render.spec.tsx:116.
  - The other 17 are duplicates:
    - :176 → planLiterals.spec.ts:18
    - :188 → planLiterals.spec.ts:18
    - :202 → copy.plan.spec.ts:64
    - :245 → planLiterals.spec.ts:55-63
    - :266 → planLiterals.spec.ts:27
    - :277 → planLiterals.spec.ts:47
    - :304 → planLiterals.spec.ts:72
    - :319 → DecisionCard.spec.tsx:201
    - :339 and :351 → DecisionCard.spec.tsx:291
    - :362 → risk :1130 and decisionCard.structural.spec.ts:71
    - :377, :396, :416, :429 → presentationPolicy.spec.ts:262
    - :439 → presentationPolicy.spec.ts:239
    - :452 cannot happen by construction
  - Speed-up: no App mounts remain, under 0.5 s (estimate).

**Other trims and merges (case counts before → after)**
- **AiRecPanel.reasoning (10→1):** remove :34, :37, :43, :49, :54, :62, :84, :98, :137.
- **AnalysisSurface (21→5):** remove :31 'orders summary…', :58, :66, :158, :179, :201, :234, :245, :321, :340, :371, :386, :393, :400, :413, :423.
- **DecisionCard (28→7):** remove :65, :84, :97, :152, :176, :189, :210, :227, :231, :240 (operator-only scenario label, behind a feature flag that is off), :247, :255, :291, :319, :328, :335, :344, :352, :371, :378, :385.
- **NumbersSaidStrip (9→1):** merge :97, :107, :115. Remove :90, :122, :127, :135, :157, :170.
- **StateExportDrawer (8→5):** merge :108, :122, :152. Remove :116.
- **bannedWords (6→5):** remove :110.
- **copy.plan (8→3):** remove :37, :47, :52, :58, :74.
- **decisionCard.structural (8→4):** remove :61, :67, :75, :83. Then drop 'Act as sim order' and '#fff' from the poison string at :103.
- **literals (53→32):**
  - Merge :41, :50, :57, :64, :71, :81, :91, :103 into 1 table.
  - Merge :111, :114, :117, :120, :123, :126 into 1 table.
  - Merge :151, :154, :157 into 1 table.
  - Merge :392, :395, :400 into 1 table.
  - Remove :131 (it tests fixture constants), :333 (liquidityLine takes no verdict, so this is trivially true), and :677, :684, :688 (all repeated by :693).
- **planLiterals (7→6):** remove :37.
- **planScopeCaption.spec (8→1):** merge :12, :16, :25, :29, :33, :37, :47. Remove :43.
- **presentationPolicy (32→26):** merge :63, :74, :83, :92, :101, :118, :123.
- **readLayout.render (36→2):** remove :226, :264, :289, :314, :424, :457, :492, the 13 rows at :532, :604, :618, :636, :681, :690, :718, :737, :762, :779, :815, :838, :947, :976, :989.

**UNSURE:** no file gets this verdict. One open question: CapAnnotation.tsx:52-65 prints `$${parsed_risk_dollars} is within your cap of $${effective_dollar_cap}` for a within/above verdict without a null check. Does the wire guarantee both values are non-null whenever the verdict is within or above? If not, a money line can read "$null". No test covers that text.

**NEW-BEHAVIOR-TEST** (the files themselves keep their verdicts above):
1. StateExportDrawer.spec.tsx needs the positive half of AC-95. With a rec on screen and `asSentCandidates` whose counts differ from the fetched export, the section must show the as-sent counts (StateExportDrawer.tsx:254-256), not the rebuilt set. Only the "cannot be recovered" case (:200) is tested today. The host wiring is at TickerDashboard.tsx:1312.
2. useAiRecommendation.spec.ts needs a request-body check: `open_positions` is left out when the host supplies none (never sent as a made-up `none_open`), and `snapshot_fingerprint` equals `bundle.ai_eval.state_fingerprint`. `requestSpy` already captures the body.
3. The cardGroundingLine table in literals.spec.ts (all_traced, some_traced 3/4, none_traced, could_not_check, local_rules, not_applicable, and a missing block) must land before grounding :133, :142, :206 and :227 are deleted.

**Flaky or timing-based**
- ai-rec.absence.spec.tsx:370-371 waits with a real `setTimeout(0)` for effects to settle (retired).
- ai-rec.absence.spec.tsx:299-300 reuses `user` from a mount that was already cleaned up (retired).
- ai-rec.risk.spec.tsx:1384 (kept) uses `useFakeTimers({shouldAdvanceTime:true})`, so real time leaks into the fake clock.
- ai-rec.risk.spec.tsx:1288 and :1296 (kept) branch on `options.length > 1`. If the preset list shrinks, the test passes without testing anything; assert the length instead.
- ai-rec.risk.spec.tsx:718-731 resolves its deferred promise only after the assertions, with no `finally` (retired).
- decisionCard.structural.spec.ts:83-100 shells out to git and needs historical commits, so it breaks on a shallow clone. ci.yml uses fetch-depth 0 (retired).
- readLayout.render.spec.tsx:673 (kept) finds titles by walking `previousElementSibling`. That is brittle, but if it breaks the test fails loudly.

**Other slow files:** reservedMark.render (4.6 s) is retired. readLayout.render (3.5 s) loses both of its App mounts; the two cases it keeps render components directly. DecisionCard.spec (2.0 s) and AnalysisSurface.spec (1.5 s) are fine as they are. The two app-wide guards cited above (hex-discipline.spec.ts and single-motion-moment.spec.ts:135-152) cover the ai-rec folder.

No file in this area is referenced by CI, project.json, vite.config, nx.json or tools, and none appears under docs/superpowers. All before/after timings are estimates from the given per-file wall times; I did not run any tests.

Totals for A1-ticker-ai-rec (26 files, 507 cases): KEEP 3 · RETIRE 7 · TRIM 13 · CONSOLIDATE 3 · UNSURE 0 · NEW-BEHAVIOR-TEST 0, with 2 new tests and 1 moved table listed in NOTES. That is 507 → about 137 cases, and the three slow files go from 152 s to an estimated ~20 s.
