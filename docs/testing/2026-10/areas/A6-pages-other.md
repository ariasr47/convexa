```csv
path,area,cases,guards,floor_class,verdict,category,evidence,referenced_by,origin
"apps/dashboard/src/app/pages/alerts/alerts.risk.spec.tsx","A6-pages-other",23,"A trader's alerts page shows a made-up default for an unset threshold, reads 'nothing evaluated yet' as 'nothing fired', or shows browser notifications as on after the permission was revoked.","invariant:absent-is-not-none","TRIM","structure","Read :1-409. Keep 46/47 'not set', 47d 'not recorded', the two 48 empties, the three 50 cases, N-5 add refused, zone name. Remove 7 structure cases and merge the 45 pair (23->15). Corrupt-blob latch is covered at features/alerts/store.spec.ts:91-158.","none","81f77222 2026-09-07"
"apps/dashboard/src/app/pages/blog/blog.spec.tsx","A6-pages-other",6,"A visitor clicks the only blog card and lands on a 404, or the public blog page starts calling trader/vendor endpoints for every anonymous visitor.","contract","TRIM","structure","Read :1-138. Keep :95 zero data edge, :114 href /blog/<slug>.html as a full-document anchor, :126 target file exists on disk. Remove :101 card count, :107 no-draft label, :134 h1 pin (6->3).","none","a8c98a9b 2026-07-16"
"apps/dashboard/src/app/pages/lab/structureFieldDemo.spec.ts","A6-pages-other",4,"Nothing a user relies on: it tests the unlinked /lab demo field builder and a lab-only re-export of GEX label helpers.","","RETIRE","structure","Read :1-54. structureFieldDemo/structureFieldShared are consumed only by pages/lab/StructureFieldLab.tsx and StructureFieldWebGL.tsx. The desk canvas uses paintStep.ts's own fmtM/gexAt (paintStep.ts:173,246), which no spec tests (see NOTES, NEW-BEHAVIOR-TEST).","none","59f8553f 2026-08-10"
"apps/dashboard/src/app/pages/methodology/copy.spec.ts","A6-pages-other",26,"The methodology page's vocabulary table drifts from the closed not-a-number literals, so users are told the wrong meaning of 'not recorded' / 'unavailable'.","invariant:absent-is-not-none","TRIM","structure","Read :1-229. Keep vocabulary set-equality with NOT_A_NUMBER, the three closest pairs, and AC-M5b no operator screen (26->3). Remove 23. The nine retired-fragment cases duplicate curvature-v2-landing-and-site.structural.spec.ts:249; the score Max column duplicates :263-286.","none","98f9028e 2026-09-10"
"apps/dashboard/src/app/pages/methodology/methodology.spec.tsx","A6-pages-other",8,"Methodology table-of-contents links jump to the landing page instead of the section, links 404, or the public page starts hitting trader APIs.","contract","TRIM","structure","Read :1-199. Keep :119 ids resolve, :126 TOC absolute-path hrefs (the base-href trap), :145 vocab rows equal NOT_A_NUMBER in Plex Sans, :161 no dead anchors, :194 zero data edge. Remove :112 order, :136 clamp copy, :188 (duplicate of copy.spec AC-M5b). 8->5.","none","06bfbe5f 2026-08-09"
"apps/dashboard/src/app/pages/not-found/not-found.spec.tsx","A6-pages-other",4,"An unknown or retired URL shows a blank page or silently redirects instead of the 404 inside the app shell.","contract","TRIM","structure","Read :1-74. Keep :39 404 renders inside shell and footer (smoke) and :70 AC-N5 retired address is a 404, never a redirect. Remove :53 h1 (axe A11Y-12 scans the 404, scenarios.ts:552) and :61 hrefs. 4->2.","none","c9d5a704 2026-09-10"
"apps/dashboard/src/app/pages/operator-metrics/useLatencyTrend.spec.tsx","A6-pages-other",1,"The operator latency chart gets duplicate React keys when dev StrictMode fires two polls in the same millisecond (a dev console warning on an operator tool; no stored data).","","RETIRE","structure","Read :1-117. Failure is dev-only and visible, with no data or money cost. An 80-line fixture backs one assertion on a de-dupe detail. Path appears only as a poison-fixture string in isolation.spec.mjs.","apps/dashboard-e2e/tools/isolation.spec.mjs:22","6893d88f 2026-07-22"
"apps/dashboard/src/app/pages/landing/GammaSurfaceHero.spec.tsx","A6-pages-other",10,"The landing hero SVG paints invisible strokes or a black spot (cosmetic, visible on the page).","","RETIRE","structure","Read :1-136. SVG node counts, ?raw scans (no canvas/rAF/useEffect), and injected-CSS stroke colours test how, not what. An invisible hero is caught by the visual baseline gate. The radial-gradient and canvas scans are duplicated in landing-structure.spec.tsx.","none","6e63ce6a 2026-09-10"
"apps/dashboard/src/app/pages/landing/HeroCurve.spec.tsx","A6-pages-other",8,"The landing hero curve animates for users who asked for reduced motion, or its keyframes start animating layout properties.","invariant:single-motion-moment","TRIM","structure","Read :1-154. Keep :63,:75,:84 reduced-motion trio, :103 mutation guard, :110 keyframe property-set pin (named in the ledger). Remove :93 overlay CSS, :119 no fill/radial-gradient, :126 one-shot re-render (8->5). Keyframe inventory pin is shared/theme/single-motion-moment.spec.ts:135.","none","50d648f8 2026-07-22"
"apps/dashboard/src/app/pages/landing/StructureFieldSample.spec.tsx","A6-pages-other",1,"The landing sample field is mounted with live/real-time flags, so a prospect sees fabricated data presented as live.","invariant:live-vs-static-isolation","KEEP","","Read :1-58. The only mount-level pin of variant=ticker and {live:false, liveMid:null, source:demo, asOfSec:null}. The paint-layer m.live gate is in paintStep.spec.ts.","none","b11be193 2026-09-23"
"apps/dashboard/src/app/pages/landing/cta-contrast.spec.tsx","A6-pages-other",7,"Landing call-to-action labels fall below WCAG 4.5:1 contrast in the light scheme.","","RETIRE","duplicate","Read :1-220. Token math is covered by shared/theme/stage3-amber.spec.ts:91-106. The rendered half is covered by axe A11Y-1/A11Y-2 on / in dark and light (scenarios.ts:467,472), run in CI (ci.yml:94) and blocking serious findings (a11y.ts:69).","none","591e2654 2026-09-10"
"apps/dashboard/src/app/pages/landing/display-face.spec.tsx","A6-pages-other",5,"Landing headings render in the body font instead of the display font (cosmetic).","","RETIRE","structure","Read :1-103. Asserts computed font-family on h1/h2 over 2 themes x 2 widths. Styling only; the file header says the visual baseline originally caught the defect.","none","3e281aed 2026-09-23"
"apps/dashboard/src/app/pages/landing/landing-samples.spec.tsx","A6-pages-other",11,"A frozen landing sample panel shows a live dot, as-of stamp or pause mark, presenting fabricated data as live.","invariant:live-vs-static-isolation","TRIM","structure","Read :1-118. Keep :107 no live chip/as-of/pause mark. Remove 10: :15 (duplicate of StructureFieldSample.spec.tsx), :33 (duplicate of curvature-v2-landing-samples.structural.spec.ts:24-33), :23 constant echo, :39,:48,:55,:63,:69,:74,:86 copy/structure. 11->1.","none","3e34b9bb 2026-09-10"
"apps/dashboard/src/app/pages/landing/landing-structure.spec.tsx","A6-pages-other",13,"Landing layout rules (one hero instrument, no canvas, heading outline, no radial blob) regress.","","RETIRE","structure","Read :1-240. viewBox set-equality, canvas scan, radial-gradient scan and ConvexityMotif zero-reference (file deleted, so any import already fails tsc) test source text. Heading outline is non-contract a11y (axe blocks only serious/critical). Cut phrases duplicate curvature-v2-landing-and-site.structural.spec.ts:344.","none","828a3916 2026-07-22"
"apps/dashboard/src/app/pages/landing/landing.spec.tsx","A6-pages-other",8,"Anonymous landing visitors trigger trader/vendor API calls, or the main call-to-action drops a prospect on a sign-in wall instead of the free Ticker.","smoke","TRIM","structure","Read :1-214. Keep :153 zero data edge (strict fetch plus EventSource count) and :182 primary CTA reaches the public Ticker with no wall (real router). Remove :109,:121,:129,:164,:172,:209 (section inventory, copy, hrefs). 8->2.","none","ad26412d 2026-07-14"
"apps/dashboard/src/app/pages/landing/svg-build-constraint.spec.ts","A6-pages-other",9,"A 3D/WebGL dependency or a trader-API import slips onto the public landing surfaces.","","RETIRE","duplicate","Read :1-124. ESLint live-fire probes plus a package.json dependency scan. Covered by lint in CI (ci.yml:59-60), curvature-v2-deny-list.structural.spec.ts:67-76 (source scan), the bundle gate (ci.yml:88) and the strict-fetch mock at landing.spec.tsx:153. Costs 1.4 s for an ESLint instance.","none","b11be193 2026-09-23"
"apps/dashboard/src/app/pages/operator-session-archive/OperatorSessionArchive.spec.tsx","A6-pages-other",7,"The operator metrics token is shown in clear text, leaks into the alert/title/URL/storage, or is sent to a rejected (Pages) origin.","auth","TRIM","duplicate","Read :1-94. Keep :14 locked form (token type=password, no GET), :44 pages.dev refused with no GET, :72 secrets absent. Remove :33,:55 (duplicates of sittingBase.spec.ts and useSessionArchive.spec.tsx:11), :65 helper copy, :90 (zero assertions). 7->3.","none","3b9567e9 2026-09-01"
"apps/dashboard/src/app/pages/operator-session-archive/OperatorSessionArchive.states.spec.tsx","A6-pages-other",12,"An operator reads a holiday or not-yet-due coverage card, or a non-live book, as a paid-live 'present', or sees pass/fail on a day with nothing expected.","invariant:present-is-live-paid-only","TRIM","duplicate","Read :1-402. Keep :149 ready list (no present/kept column, present only from coverage), :331 holiday empty-expected, :354 not-yet-due pin (emptyExpected logic at OperatorSessionArchive.tsx:~236). Remove 9 duplicates of viewModel.spec.ts/classify.spec.ts (12->3). SLOW, see NOTES.","none","3b9567e9 2026-09-01"
"apps/dashboard/src/app/pages/operator-session-archive/classify.spec.ts","A6-pages-other",11,"The operator console shows an origin/CORS/auth fault as an empty archive, or accepts a body claiming vendor_called or authorizes!=nothing as a legal research read.","invariant:operator-vs-trader-path-separation","KEEP","","Read :1-245. The InvariantFault arm (:167-206) is the refusing guard. 404/401/5xx splits keep wrong-origin, wrong-token and empty-corpus apart.","none","3b9567e9 2026-09-01"
"apps/dashboard/src/app/pages/operator-session-archive/copy.spec.ts","A6-pages-other",6,"The origin-blocked message uses the words 'blocked occupancy', confusing a wrong-origin fault with a blocked-occupancy coverage cell.","invariant:present-is-live-paid-only","TRIM","structure","Read :1-46. Keep :24. Remove :5,:11,:18,:29,:41 exact-copy echoes (6->1). BANNED_ON_SCREEN is never enforced against rendered text (OperatorSessionArchive.tsx:30 does void BANNED_ON_SCREEN).","none","3b9567e9 2026-09-01"
"apps/dashboard/src/app/pages/operator-session-archive/digest.spec.ts","A6-pages-other",2,"The operator digest dumps raw licensed contract/bar/trade arrays on screen instead of counts.","guard","TRIM","structure","Read :1-90. Keep :5 projection returns counts only and drops market/daily_bars/minutes/trades. Remove :53 (test-local dumpCapable boolean over empty-array counts). 2->1.","none","3b9567e9 2026-09-01"
"apps/dashboard/src/app/pages/operator-session-archive/occupancy.spec.ts","A6-pages-other",6,"A fixture, flat-file, replay or unknown source token is shown as a loadable paid-live 'present' book.","invariant:present-is-live-paid-only","TRIM","duplicate","Read :1-65. Keep :11,:19,:32,:39,:52 (closed vocab, never yields present). Remove :62, a constant echo duplicating copy.spec.ts:24-26. 6->5.","none","3b9567e9 2026-09-01"
"apps/dashboard/src/app/pages/operator-session-archive/researchClient.spec.ts","A6-pages-other",6,"The operator metrics token leaks via cookies or browser storage, is sent to a relative URL, or a stale book response overwrites a newer selection.","auth","TRIM","duplicate","Read :1-128. Keep :12,:26,:39 (credentials omit; both headers; empty token omits both), :84 abort previous load, :117 no storage writes. Remove :76 (duplicate of :26; discarded ?raw import). 6->5.","none","3b9567e9 2026-09-01"
"apps/dashboard/src/app/pages/operator-session-archive/schedule.spec.ts","A6-pages-other",6,"Operator Retry, chip or present clicks issue extra or missing read-only archive GETs, so the wrong book or date is shown.","invariant:operator-vs-trader-path-separation","TRIM","structure","Read :1-44. Cheapest layer for the fan-out table. Keep :16-:35 (5). Remove :12 TRIO constant echo. 6->5.","none","3b9567e9 2026-09-01"
"apps/dashboard/src/app/pages/operator-session-archive/sittingBase.spec.ts","A6-pages-other",10,"The operator token is sent over plain http to a non-loopback host, to a Pages static host, or to a URL with userinfo/query/path.","auth","KEEP","","Read :1-115. Origin allow-list parser; each arm is a distinct refusal (empty, pages.dev, relative, userinfo/query/fragment/path, non-loopback http) plus canonical-form accepts.","none","3b9567e9 2026-09-01"
"apps/dashboard/src/app/pages/operator-session-archive/useSessionArchive.spec.tsx","A6-pages-other",5,"Operator Unlock or Retry sends GETs to a bad origin, or digest Retry re-fetches the wrong identity or coverage.","guard","TRIM","duplicate","Read :1-273. Keep :11 parse-before-fetch, :22 unlock fires list+coverage, :97 AC-29/46 digest and page retry end to end. Remove :69 (duplicates schedule.spec.ts:16,:31) and :191 (duplicates :97 and viewModel.spec.ts:312). 5->3.","none","3b9567e9 2026-09-01"
"apps/dashboard/src/app/pages/operator-session-archive/viewModel.spec.ts","A6-pages-other",20,"The operator view shows a previous symbol's rows under the new chip, keeps a stale coverage matrix as current, or reads an outage as an empty archive.","invariant:absent-is-not-none","TRIM","duplicate","Read :1-420. Keep 18. Remove :214 'chip-follow re-entry' (duplicate of :196) and :417 'default selected is SPY' (constant echo). 20->18. :196 ends in an empty if-block, so 'no SPY rows under QQQ' is never asserted.","none","3b9567e9 2026-09-01"
"apps/dashboard/src/app/pages/scanner/deskParams.spec.ts","A6-pages-other",5,"A shared scanner URL with junk or unknown values invents a filter or sort, so the trader sees a subset believing it is the whole universe.","parser","KEEP","","Read :1-65. Closed-vocabulary URL parser and builder with default omission and round-trip.","none","2d6ecc11 2026-08-10"
"apps/dashboard/src/app/pages/scanner/format.spec.ts","A6-pages-other",30,"The scanner shows a null score as 0, floats nulls to the top of the ranking, shows a holiday as open, shows a 'building' row as fresh, or sorts/filters rows wrongly.","invariant:absent-is-not-none","TRIM","duplicate","Read :1-433. Keep 27. Remove 3 duplicates: 'ordinary Monday 10:00 ET remains RTH' and 'Saturday remains Closed' (duplicate 'classifies RTH / pre / after / closed'), 'fresh heartbeat does not engage scan-worker-down' (duplicates the sweepBanner case). 30->27.","none","ad405d9d 2026-07-26 superpowers-plan"
"apps/dashboard/src/app/pages/scanner/nyseFullDayHolidays.spec.ts","A6-pages-other",3,"The scanner session badge shows RTH on an NYSE full-day holiday, or Closed on a trading day.","contract","KEEP","","Read :1-150. Generator-oracle equality for the committed holiday set, pins matching the Rust B.domain list, and the Rule 7.2 Saturday New Year exception.","none","3b9567e9 2026-09-01"
"apps/dashboard/src/app/pages/scanner/scanner.register.spec.tsx","A6-pages-other",53,"The scanner table and mobile card show different prices or states for one symbol, a never-ticked price is labelled 'last known' after a stream drop, a lookup miss reads as 'nothing', or a price flashes while the stream is down.","invariant:live-vs-static-isolation","TRIM","duplicate","Read :1-890. Line 43 imports from ./scanner.risk.spec, which re-runs all 33 risk cases here (53 = 20 own + 33 imported). Keep 10 own (:101,:121,:163,:173,:195,:336,:473,:605,:710,:732). Remove 10 own (see NOTES). 53->10.","none","d905d26a 2026-09-07"
"apps/dashboard/src/app/pages/scanner/scanner.risk.spec.tsx","A6-pages-other",33,"The scanner shows a stale/building/error row as fresh or zero, ranks the default view wrongly, offers an order action, loses a saved view's exact symbol order, or dark-locks a themed value.","invariant:absent-is-not-none","TRIM","structure","Read :1-926. Keep 20 (honest row states, link-only rows, sort keys, exact saved draft, page states, lead-group ranking, theme-token scan, offline header). Remove 13 (names in NOTES). 33->20. Exports makeRow/fakeGate, which register.spec imports.","apps/dashboard-e2e/tools/isolation.mjs:49","6d157f05 2026-07-26 superpowers-plan"
"apps/dashboard/src/app/pages/scanner/useScan.spec.tsx","A6-pages-other",8,"A signed-out or stale-cookie scan-view save is treated as persisted or cached locally, the scanner polls a hidden tab or opens a stream and bursts the backend, or one failed poll blanks the table.","invariant:server-side-gate-enforcement","KEEP","","Read :1-259. Server-gated PUT (signed-out issues no PUT and writes nothing locally; 403 aborts; 422 surfaces detail), one read per interval, hidden-tab pause, degraded keeps rows.","none","bd84b067 2026-07-26 superpowers-plan"
"apps/dashboard/src/app/pages/positions/capitalAtRisk.spec.ts","A6-pages-other",7,"The positions mast shows a computed-looking Capital at risk ($0 or a partial sum) for a book with nothing to sum, or counts an unbounded short as a number.","money","KEEP","","Read :1-74. Arms for empty, none eligible, partial with coverage caption, all eligible, unsigned. The summed dollar value of 2+ eligible rows is never asserted (NOTES, NEW-BEHAVIOR-TEST).","none","debbd55f 2026-09-08"
"apps/dashboard/src/app/pages/positions/netPl.spec.ts","A6-pages-other",10,"Net P/L (open) shows a green +$0 for an empty or unmarked book, a number while the stream is down, or a partial sum without its coverage caption.","money","KEEP","","Read :1-133. Five arms plus sign format. Sums are checked only by regex (/^\+\$/); the exact netted total of 2+ marked rows is not asserted (NOTES, NEW-BEHAVIOR-TEST).","none","5e1fa577 2026-09-07"
"apps/dashboard/src/app/pages/positions/positions-page.spec.tsx","A6-pages-other",17,"A trader's saved views or Net P/L silently vanish or misstate across navigation and reload, the live header and the static track record both dim on a stream drop, or the Broker tab gains an order path.","invariant:no-real-order-path","TRIM","duplicate","Read :1-674. Keep 5 (:360 views persist, :456 +$200 sum, :525 AC-E17, :600 paused stops polling, :623 Broker tab). Remove 12 (names in NOTES) as duplicates of integration/netPl specs or structure. 17->5. Fake-timer leak at :601.","none","ff6d9c0a 2026-07-14 superpowers-plan"
"apps/dashboard/src/app/pages/positions/positions.integration.spec.tsx","A6-pages-other",15,"A trader's multi-leg position is read back as a single long call after migration or reload, a withheld unpriceable leg is summed as zero, a stale saved view is rewritten, or the book diverges between Ticker and Positions.","invariant:loss-free-durable-migration","TRIM","structure","Read :1-683. Keep 12 (condor migration and reload, withheld-position isolation, SSE drop, stale view not rewritten, merge notice, one book across pages, close, AC-76). Remove :368 AC-2/AC-3, :382 AC-23, :621 AC-52. 15->12.","none","e39c84bc 2026-07-28"
```

## NOTES

Nothing was run. Counts and times are from the TSV and from reading the files. Speed-up estimates are arithmetic from keystroke counts, not measurements.

### TRIM and CONSOLIDATE: exact cases removed

- **alerts.risk.spec.tsx (23 to 15)**
  - Remove 7:
    - 44 'an unread firing carries the "Unread" word and heavier weight…'
    - 44 'MUTATION PROOF P target…'
    - 47d 'tier_change renders "any tier transition", byte-identical'
    - 48 'no rules: the shipped byte-identical sentence'
    - 48 'none of the three empties renders with an error colour/role'
    - N-5 'a banner explains it; every write affordance is refused but focusable…' (data-refused census)
    - U-23a 'the Recent list renders stored message verbatim…'
  - CONSOLIDATE 2 into 1: the two 45 cases ('a score_gate rule label reads "Score gate"…' and 'a level_touch rule…LEVELS label') become one table-driven closed-lookup test.
- **blog.spec.tsx (6 to 3)**
  - Remove 'renders exactly one card…(AC-B1)', 'shows no card labelled as a draft…', 'the page <h1> is the pinned heading…'.
- **methodology/copy.spec.ts (26 to 3)**
  - Keep:
    - 'carries exactly the NOT_A_NUMBER members — none missing, none extra'
    - 'separates the three closest pairs…'
    - 'names no persona, flows or operator screen (AC-M5b)'
  - Remove the other 23:
    - the 4 ordered-array cases
    - the 3 score-table cases
    - 'gives every literal its own, non-interchangeable definition'
    - 'carries no "this is a selection" disclaimer…'
    - the 4 delta cases (no-trade sentence, itemised payload, amendment 1, amendment 2)
    - 9 x 'does not contain %j anywhere in the module'
    - 'title, subhead, disclaimer and the three CTAs…'. The disclaimer is already pinned by shared/copy/disclaimer.spec.tsx:33 and shell/AppShell.footer.spec.tsx:73.
- **methodology.spec.tsx (8 to 5)**
  - Remove '1. renders all ten sections…', '4. the score section states the two-stage clamp…', '7. names no persona, flows or operator screen'.
- **not-found.spec.tsx (4 to 2)**
  - Remove 'the headline is the page h1…' and 'both actions resolve: primary → /ticker, secondary → /'.
- **HeroCurve.spec.tsx (8 to 5)**
  - Remove '(a) the wrapper is an absolute inset-0…', 'no fill, no glow, no radial-gradient…', 'a re-render keeps the same curve node…'.
- **landing-samples.spec.tsx (11 to 1)**
  - Keep only 'no as-of, no live chip, no pause mark on any sample panel'.
  - The other 10 are the field-model flags, NOT_LIVE echo, derived flip distance, tier row, shared sample mark, AI-read non-controls, SIMULATED caption, own sample literal, field calm/embedded and aria-describedby.
- **landing.spec.tsx (8 to 2)**
  - Keep 'issues no trader/bundle fetch and opens no SSE on mount' and 'the primary CTA resolves into the public Ticker viewer, not a wall (real router)'.
  - Remove 'exactly six sections…', 'the three trust promises…', 'the retired v1 surface is gone…', 'both `Open the Ticker` actions share a name AND a destination', 'the CTA band declares the closure…', 'AC-L9 — the honesty section reaches methodology in ONE click'.
- **OperatorSessionArchive.spec.tsx (7 to 3)**
  - Remove 'origin-rejected empty — no GET; title origin-rejected', 'origin-rejected relative — no GET', 'Pages document helper does not flip origin-blocked', 'Alert severity warning without icon={false}'.
  - The last one has zero assertions.
- **OperatorSessionArchive.states.spec.tsx (12 to 3)**
  - Remove:
    - 'unauthorized paints metrics_unauthorized, not origin-blocked'
    - 'family 404 paints origin-blocked'
    - 'cors-fault title present; stale chip absent'
    - 'empty list framing; books columns…'
    - 'chip-switch hides previous dates'
    - 'coverage unclassified fail → Coverage readout unavailable; no stale chip'
    - 'warm coverage unclassified after prior matrix → AC-38…'
    - 'not-storing exclusive standing — no books table'
    - 'AC-29: digest Retry after unreadable re-issues that identity load GET only'
  - Each is covered cheaper by viewModel.spec.ts:99/110/120/136/196/233/172, classify.spec.ts, and useSessionArchive.spec.tsx:97.
- **operator copy.spec.ts (6 to 1)**
  - Remove 'AppBar / title / chip', 'gate labels and unlock', 'three origin-rejected bodies', 'banned on-screen strings', 'coverage standing / unavailable'.
- **digest.spec.ts (2 to 1)**
  - Remove 'fixture-empty arrays count 0 and cannot prove dump-capable'.
- **occupancy.spec.ts (6 to 5)**
  - Remove 'ORIGIN_BLOCKED_MUST_NOT_CONTAIN is blocked occupancy'.
- **researchClient.spec.ts (6 to 5)**
  - Remove 'source must not match fetch relative /api/_research'.
- **schedule.spec.ts (6 to 5)**
  - Remove 'TRIO is SPY QQQ IWM'.
- **useSessionArchive.spec.tsx (5 to 3)**
  - Remove 'page Retry never issues load; chip tap issues list only' (its body never exercises page Retry) and 'AC-46: digest Retry after load invariant-fault issues exactly one load GET'.
- **viewModel.spec.ts (20 to 18)**
  - Remove 'chip-follow re-entry is not AC-30 restore' and 'default selected is SPY'.
- **format.spec.ts (30 to 27)**
  - Remove 'ordinary Monday 10:00 ET remains RTH', 'Saturday remains Closed', 'fresh heartbeat does not engage scan-worker-down (holiday idle ≠ worker-down)'.
- **scanner.register.spec.tsx (own 20 to 10)**
  - Remove:
    - 'the table and the card never render the live-dot mark'
    - 'the card stays a single anchor with no focusable control nested inside it' (duplicate of risk spec 'table rows and mobile cards expose a real /ticker/{SYMBOL} link…')
    - 'an unauthenticated visitor sees `require-auth-wall`…' and 'an authenticated visitor is NOT walled…' (both duplicate app.risk.spec.tsx route table, :180-244)
    - 'MUTATION PROOF F (criterion 12, SB)…' (subset of the preceding QQQ assertions)
    - 'the Scanner page itself gates the flash off the SAME `live.offline` flag…' (asserts only the header text)
    - 'a stale sweep raises the banner over intact rows; every figure keeps its stated register' (duplicate of risk spec 'a behind or absent sweep raises the banner OVER intact rows')
    - 3 x CF-1 (a frozen snapshot of ~30 copy strings)
- **scanner.risk.spec.tsx (33 to 20)**
  - Remove 13:
    - 'chg_pct differs by sign while score / distances / regime stay className-identical'
    - 'mobile cards are consecutive link stops…'
    - 'the density control emits only the closed values…'
    - 'an anonymous visitor gets the standing sign-in prompt…' (duplicate of 'the anonymous default view is POPULATED…')
    - 'offers ONLY universe symbols…' (UX only; the server returns 422)
    - 'a default view with NO lead member degrades to the flat table' (duplicate of format.spec partitionLeadGroup degenerate case)
    - 'seeds tier filter from ?tier=prime…' (duplicate of deskParams.spec parse)
    - 'sort headers are real buttons…'
    - 'score cell is keyboard-focusable…'
    - 'surfaces a session badge + structure as-of strip…'
    - 'client filters narrow the table without a refetch…' (duplicate of format.spec filterRows)
    - 'score cell exposes a why-this-row tip…' (duplicate of format.spec whyThisRow)
    - 'T5 / D-A, ONLINE arm — …the word "live" never reaches the page text'
  - The ONLINE-arm case enforces a rule the file's own retirement note (about :845) says no longer applies, since prices are live.
- **positions-page.spec.tsx (17 to 5)**
  - Remove:
    - 'position survives navigation' (the customization case also navigates away and back)
    - 'position survives reload…' (duplicate of integration :426)
    - 'marks populate from GET /api/contract'
    - 'refresh failure → last known, never blanked'
    - '404 → tracking unavailable, row kept' (duplicate of integration AC-39/40, which uses a 404)
    - 'null quote → no live quote fallback'
    - '35b (SB)…unavailable' and '35a (SB)…—' (duplicates of netPl.spec.ts; netPl.ts says the page adds no branch)
    - both 'AC-1 …' track-record placement cases
    - 'everything stays SIMULATED' (duplicate of integration AC-76, a superset)
    - 'brand swap is UI-only…' (one-off rebrand check, risk-gone)
  - Several of these assert only that a row is present.
- **positions.integration.spec.tsx (15 to 12)**
  - Remove 'AC-2/AC-3…', 'AC-23…', 'AC-52…'.

### UNSURE

None.

### NEW-BEHAVIOR-TEST

1. **netPl.spec.ts: exact netted sum.** Add one case with a gaining and a losing marked open row.
   - Assert `value === formatNetPl(g.pl_dollar + l.pl_dollar)` and the tint from the sign of the sum.
   - Today only the regex `/^\+\$/` is asserted, and positions-page `+$200` covers a single row. A reduce that sums only the first row would pass.
2. **capitalAtRisk.spec.ts: exact summed total.** Assert two eligible rows sum to twice one row's max loss (`formatCapitalAtRisk(2 x max_loss)`). Today only `/^\$/` is asserted.
3. **shared/charts/structure-field/paintStep.spec.ts.** Add direct tests for paintStep.ts `fmtM` (:173) and `gexAt` (:246).
   - These feed the net-GEX hover label and heat interpolation on the desk, and nothing tests them.
   - The retired lab spec tested a different copy, structureFieldShared.ts, which only the lab consumes.
   - Re-point its 'formats magnitudes and interpolates GEX' assertions (2.5e9 -> '2.50B', -1.2e6 -> '-1.2M', interpolation 50) at paintStep's exports.
4. **(low) Operator BANNED_ON_SCREEN.** The constant is never checked against rendered text (OperatorSessionArchive.tsx:30 voids it). Either delete it or assert the kept 'ready list' case's text excludes it.

### Flaky or timing-based

- **researchClient.spec.ts:94.** A real `setTimeout(…, 50)` inside the abort fetch double. Benign, but it is a real timer.
- **positions-page.spec.tsx:601 (leak).** The 'paused anchor' test calls `vi.useFakeTimers` with no `useRealTimers`; afterEach does not restore timers. The `invariants (positions)` cases at :623, :645 and :657 therefore run on fake timers.
  - Fix: add `vi.useRealTimers()` to afterEach.
- **positions.integration.spec.tsx:475-507 and :511-526.** `useRealTimers` is called at the end of the test body, not in `finally`, so a mid-test failure leaks fake timers. The AC-23 case (:382) carries a comment recording a ~50% red rate on loaded CI.
- **useScan.spec.tsx:156,167,188.** Fake timers with `shouldAdvanceTime` mixed with `waitFor`. Moderate sensitivity.
- **scanner.risk.spec.tsx.** Several cases derive `as_of` from `Date.now()` (the sweep-banner case at :609 and the 'BOTH data ages' case). The session-badge case (:761) is time-dependent but only checks set membership.
- **OperatorSessionArchive.states.spec.tsx.** Vitest's default 5 s test timeout against about 1.4 s average per case leaves less headroom under the CI worker cap. The speed-up below removes that risk.

### Slow kept tests: cheapest safe speed-up

- **OperatorSessionArchive.states.spec.tsx, 16.3 s for 12 cases.**
  - What is floor: only the 3 kept cases (ready list, holiday empty-expected, not-yet-due pin). The coverage-card branch `emptyExpected` at OperatorSessionArchive.tsx:~236 has no other test.
  - Cause: `unlockUsable` (:70-77) uses `user.type` for 21 + 3 characters into controlled MUI TextFields. Each keystroke re-renders the whole page, so 12 x 24 = 288 renders at about 47 ms each, about 13 s.
  - Cross-check: OperatorSessionArchive.spec.tsx types about 64 characters and takes 3.0 s.
  - Fix: replace the two `user.type` calls with `fireEvent.change(input, { target: { value } })` (or `user.click` then `user.paste`) and keep `user.click` for Unlock. Apply the same change in OperatorSessionArchive.spec.tsx.
  - Expected: after trimming to 3 cases, about 4 s before the fix and under 1 s after. Not measured.
- **scanner.register.spec.tsx, 3.2 s.**
  - Line 43 `import { makeRow } from './scanner.risk.spec'` registers all 33 risk cases a second time inside this file (runner count 53 = 20 + 33). That is about 2.1 s of waste.
  - Fix: move `makeRow` and `fakeGate` into a non-spec `scanner.testkit.ts` imported by both. No behavior change.
- **positions-page.spec.tsx, 9.7 s, and positions.integration.spec.tsx, 7.7 s.** Every case mounts the full `<App/>` with a lazy PositionsPage.
  - No safe micro-fix without measuring. Trimming 12 + 3 cases is the cheapest cut, roughly 6.9 s + 1.5 s by proportion.
- **landing.spec.tsx, 2.1 s.** About 1.5 s of it is the kept journey case, which mounts the full App and a ticker bundle. It is floor smoke, so leave it.
- Retiring display-face (1.08 s), svg-build-constraint (1.41 s), landing-structure (0.88 s) and cta-contrast (0.43 s) removes about 3.8 s of jsdom/ESLint time with no loss.

### Other findings

- **Vacuous assertions.**
  - OperatorSessionArchive.spec.tsx:90 has zero assertions.
  - OperatorSessionArchive.spec.tsx:72-88: `expect(alert.textContent).not.toContain(origin)` can never fail, because that origin is never typed (the origin field gets whitespace).
  - viewModel.spec.ts:196: the empty `if (s.books.kind === 'offline') { // no SPY rows under QQQ }` block means AC-30 is not asserted for the offline arm.
  - researchClient.spec.ts:76: dead `?raw` import (`void src`).
- **referenced_by hits are path strings only.** apps/dashboard-e2e/tools/isolation.mjs:49 is an allowlist entry for scanner.risk.spec.tsx, and isolation.spec.mjs:22 is a poison fixture for useLatencyTrend.spec.tsx. Neither executes the spec. Neither tool reads the files, so deleting or trimming them does not break the isolation tooling.
- **Optional cross-file CONSOLIDATE (not counted in totals).** Four near-identical strict-fetch plus EventSource 'public surface makes no trader call' harnesses (landing.spec.tsx:153, blog.spec.tsx:95, methodology.spec.tsx:194, not-found's strict fetch mock) could become one table-driven test.
- **Axe gate scope.** The a11y gate blocks only serious/critical impacts (a11y.ts:69), so heading-outline and landmark checks are not axe-duplicated. They were retired as non-contract structure, not as duplicates.

Per-verdict totals for A6-pages-other (37 files): KEEP 8, RETIRE 7, TRIM 22, CONSOLIDATE 0 as a file verdict (one inside the alerts TRIM), UNSURE 0, NEW-BEHAVIOR-TEST 0 as a file verdict (4 gaps in NOTES). Cases go from 416 to about 209 (-207, of which 33 are the double-run risk imports), a file wall sum of about 52.5 s.
