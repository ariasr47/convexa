# Review of Wave 1 · confirmed findings (2026-10-15)

Adversarial review of `bb49675f..6974f816` (10 areas, two finder rounds; each finding upheld by its skeptics). 115 judged, 101 survived, merged into 71 items.

## W1-01 · high · blocks push
**Non-USD filers' revenue and reported figures are labelled as US dollars (TSM shows NT$ as $, about 30x too high), and the revenue axis draws 65 overlapping ticks**

Files: apps/dashboard/src/app/pages/research/FiledFigures.tsx, apps/dashboard/src/app/pages/research/FilingsPage.tsx

Merges #47, #92, #58 and the chart half of #10. In FiledFigures.tsx, RevenueAsFiled and RevenueBars never read PublicAnnualRevenue.unit: billions() hard-codes `$` (:33-34), the sub says '$ billions' (:492), the column is 'Revenue, $B' (:511) and the bar labels are `$${b}B` (:590). The axis step tops out at 60 (:535-539). FilingsPage.tsx figure() (:822-831) adds `$` to every unit except '/shares' and is used in the ReportedFigures title and table (:852, :987, :996). The API passes IFRS revenue through in the filer's own currency (filed_figures.rs:61-67, :285-291, :445; edgar.rs fact_for). The repo's own test models TSMC in TWD (edgar.rs:868-889). TSM is a followed note.

Failure: Production after the API deploy (SEC live). /ticker/TSM/research renders 'Revenue as filed' with FY2024 at '$2,894.3B' under '$ billions'. That is NT$ shown as US$, about 33x the real $88.3B. The provenance is primary and the tag reads 'Updated · on filing'. With maxB around 3809, step=60 gives 65 tick labels 2.3px apart in the 150px plot. On /research/filings, a TSM 20-F inside the 90-day window shows 'Revenue $3,800B' and TWD EPS as '$xx.xx'. Reproduced with the commit's code against TSMC's real companyfacts. Over 6 runs, 4 picked TWD.

Fix: Add one money formatter driven by the wire unit, exported from FiledFigures.tsx and used by FilingsPage.tsx. Behaviour: 'USD' renders `$…B`. Any other ISO code renders with the code, e.g. 'TWD 2,894.3B'. 'X/shares' renders per-share in that currency. Build the sub-line, the table column header and the bar and axis labels from the series unit. If the years in annual_revenue do not share one unit, keep only the years in the majority unit, or skip the chart. Replace the hard-coded step ladder with a nice-number step (1/2/5×10^n, at most about 6 ticks) so any magnitude draws a readable axis. Pin it with a small spec on the pure formatter and tick helper: TWD 2.894e12 must render 'TWD 2,894.3B', never '$', and maxB 3809 must give 8 ticks or fewer. A wrong currency on a money figure fails silently, so this test is warranted. Run `npx nx typecheck @convexa/dashboard`.

## W1-02 · medium · blocks push
**Cold GET /api/public-data/tickers/{t} now makes up to about 83 serial SEC requests behind one 200 ms global gate, with no deadline, and the FINRA tiles and Alerts SI checks wait for it**

Files: apps/api/src/services/public_data/mod.rs, apps/api/src/services/public_data/insider_trades.rs

Merges #2, #8, #17 and #84. sec_part awaits insider_history inline (mod.rs:985), and that reads up to HISTORY_READ_LIMIT=80 Form 4s one at a time (insider_trades.rs:26, :386-398). Every read passes the process-wide SecGate, one request per 200 ms with the lock held across the sleep (fetch.rs:157-164, mod.rs:49). The newest 30 are cache hits from the 90-day loop, so a cold busy filer costs about 83 gated requests: at least 16.6 s, against about 4.7-6.6 s at bb49675. ticker() joins the FINRA parts with sec_part (mod.rs:619), so the short-interest and short-volume tiles wait too. Nothing bounds the total time: each document has its own 20 s timeout, and an SEC hang costs about 80 × 20 s. The form4 cache lives in memory, so every Railway deploy starts cold. usePublicChecks.ts:85 fans out getPublicTicker per SI rule in parallel.

Failure: After the next API deploy, a reader opens the NVDA note (84 Form 4s in 365 days). The mock-upstream repro with the commit's code measured 16.67 s and 83 SEC requests, against 4.72 s before. The short-interest tiles show skeletons the whole time. Six cold busy SI tickers on /alerts finished at 98.8-99.8 s in the repro, at Cloudflare's 100 s proxy limit, after which settled() turns a 524 into 'FINRA didn't answer'. Other visitors' /filings and ticker reads queue behind the same gate.

Fix: Bound the history read per request. In insider_trades.rs, give insider_history a budget: read at most the already-cached documents plus a small number of new ones (about 10), or stop at a tokio::time::Instant deadline of about 4 s. Return what was read; history_filings_read < history_filings already tells the frame about the shortfall (W1-09 makes the frame honest about it). Spawn the rest as a background tokio::spawn warm-up through the same SecGate so the next request has more of it cached. Keep the 90-day card reads as they are. Put the same deadline around the whole sec_part future in ticker() (mod.rs:619) so FINRA parts are never held past it. Pin the budget logic with a cargo unit test: a fake form4 source with 80 uncached rows returns within budget with filings_read < filings and no more than the cap of new fetches. Run `cargo test -p api-rust --locked insider`.

## W1-03 · medium · blocks push
**Every schedule, Treasury refunding included, is fetched with the URL-bearing BLS User-Agent, which Treasury slows to 8-10 s, so /markets stalls on each cold or 12-hourly refresh**

Files: apps/api/src/services/public_data/mod.rs

#0. One schedule_http client is built with SCHEDULE_USER_AGENT '…(+https://convexa.pages.dev/credits)' (mod.rs:148, calendar.rs:46-47). schedule_lookup sends fed, bls, bea and treasury-qr through it (mod.rs:351-372). home.treasury.gov answers that User-Agent in 8.1-10.2 s and PUBLIC_USER_AGENT in 0.09-0.38 s. This was measured by curl and by a reqwest probe with the same client configuration. markets() tokio::joins self.schedules() (mod.rs:211-216). TtlCache has no stale-while-revalidate and holds the key lock across the fetch, so every concurrent /markets caller waits. Only BLS needs the URL form.

Failure: After each Railway deploy, and twice a day when the treasury-qr entry expires, GET /api/public-data/markets takes about 9-10 s. Markets, Coming up, Credits and the Alerts CFTC checks all wait. Delays near the 20 s REQUEST_TIMEOUT would flip the card to Source down, with a 10-minute retry that charges the full wait again.

Fix: In schedule_lookup, choose the client per schedule id. Use schedule_http (SCHEDULE_USER_AGENT) only for 'bls'. Send 'fed', 'bea' and 'treasury-qr' through the existing public client built with PUBLIC_USER_AGENT. Pull the choice into a small fn (id -> which user agent) and pin it with a cargo unit test asserting bls→URL agent and treasury-qr/fed/bea→public agent, so a refactor can't silently put it back. Leave calendar.rs untouched so this does not collide with the calendar batch.

## W1-04 · medium · blocks push
**After a ticker switch, the previous ticker's public data (filings, insiders, short interest, note freshness) is shown under the new ticker until the new read lands**

Files: apps/dashboard/src/app/pages/research/publicData.ts, apps/dashboard/src/app/pages/research/publicData.spec.ts

Merges #56, #94 and #100. useRead (publicData.ts:22-52) sets loading=true and error=null on a key change but never clears `data`. The consumers do not remount. FilingsPage Detail has no key (:306). NotesView reuses its route element (app.tsx ResearchRoute). PublicDesk is the same instance for each /ticker/:ticker (app.tsx:179/273). The `read.loading && !read.data` skeleton guards (FilingsPage:857, NotePublicPanels:47, PublicDesk:285) are therefore false, and the old answer renders. NoteCard and NotesView compute the new note's freshness with filedSince(oldTicker.filings) (PublicDesk:408, NotesView:244). On a failed new read, the old data stays for good. W1-02's cold path stretches the window to seconds or tens of seconds.

Failure: On /ticker/NVDA, the visitor clicks AAPL in QuickSymbols. While /tickers/AAPL loads, the AAPL desk lists NVDA's filings under 'Recent filings', NVDA's insider counts and NVDA's short interest, with no loading state. AAPL's note freshness says a 10-Q was 'filed since this note' because of NVDA's filing. On /research/filings, pressing j from an AMZN 10-Q to an NVDA 10-Q shows 'aren't available yet' or 'Couldn't load' with AMZN's filings_detail.

Fix: In useRead's effect, call setData(null) before starting a load whenever the key changed. Keep the existing alive flag so a late answer for the old key is dropped. That one change restores the skeleton paths in all three consumers. Add publicData.spec.ts using renderHook with a deferred fetcher: after a rerender to a new key, data is null while the request is pending, and an old-key resolution arriving late is ignored. A wrong-ticker contract like this fails silently, so the test is warranted.

## W1-05 · medium · blocks push
**Against the pre-deploy API, the insider-trades frame says 'No open-market Form 4 trades by NVDA insiders in NaN months', tagged Computed**

Files: apps/dashboard/src/app/pages/research/InsiderClusters.tsx

Merges #53, #70 and #88. The old InsidersWire (bb49675 routes/public_data.rs:419-433) has no transactions or history_days. InsiderClusters.tsx:154 defaults transactions to [], and :156-162 renders the empty 'computed' claim with period(ins.history_days) and no `?? 365` fallback (lines 92/110/117 have one). period(undefined) gives 'NaN months'. The generated schema marks the new fields required, so tsc cannot catch it. The live production API (bb49675) already answers insiders.state 'live' with SEC on, e.g. NVDA sales 25, as the trace verified with a read-only GET.

Failure: On the next push, Cloudflare serves the new frontend about 5 minutes before Railway finishes the new API. Every production note page then shows 'No open-market Form 4 trades by NVDA insiders in NaN months.' under Computed. The 90-day InsidersCard on the same page shows '25 sales'. The same happens again on any API rollback.

Fix: At :160 use `period(ins.history_days ?? 365)`. Before the empty branch, treat `ins.transactions === undefined` as an older server, not an empty year. Render a quiet message with no Computed tag ('The 12-month timeline arrives with the next server update') and make no claim about trades. Read the other new fields (roles, clusters, sale_windows, history_filings*) with `?? ` defaults. Run `npx nx typecheck @convexa/dashboard`. No UI test is needed under the repo's test policy.

## W1-06 · medium · blocks push
**The blog post's public address /blog/how-we-read-dealer-structure (no .html) now renders the 404**

Files: apps/dashboard/src/app/pages/blog/BlogPostPage.tsx, apps/dashboard/src/app/pages/blog/blog.spec.tsx

#71. Production today 308-redirects the .html address to the bare one and serves the static file there. That redirect has no cache-control, so Chromium may cache it. This change moves the file to public/blog/plain/, so both addresses fall through to the SPA. BlogPostPage.tsx:172 accepts only `file` ending in .html; anything else is slug=null and :185 returns notFound. blog.spec.tsx:102-107 pins the 404 for the bare slug. Every bookmark, share and address-bar copy of the post uses the bare URL.

Failure: After the deploy, opening https://convexa.pages.dev/blog/how-we-read-dealer-structure from a bookmark or shared link shows 'Nothing at this address'. A returning Chrome visitor who loads the .html address follows the cached 308 to the bare address and also gets the 404.

Fix: In BlogPostPage.tsx, accept the bare slug as well. Strip an optional '.html' and look the article up by slug. Optionally `navigate(postPath(slug), {replace:true})` only when the address bar should normalize; avoid a redirect loop with cached 308s by not redirecting bare→.html at the server. Update blog.spec.tsx so the bare slug renders the post and a genuinely unknown slug still 404s. Do not add a _redirects bare→.html rule: it loops for clients holding the cached 308.

## W1-07 · medium · blocks push
**'What's live', the staging pointer, the bar sentence and the Scanner Filings card still say SEC is not set up, which is false since SEC_USER_AGENT was set on 2026-10-15**

Files: apps/dashboard/src/app/pages/methodology/copy.ts, apps/dashboard/src/app/shared/dataState/marketData.ts, apps/dashboard/src/app/pages/scanner/ScannerNotLive.tsx

Merges #59, #73, #40 and #67. methodology/copy.ts:279 (production lead), :301 (SEC row 'Shows Not set up until the operator sets SEC_USER_AGENT'), :339 (staging: 'SEC EDGAR once its contact line is set') and the :268 comment all describe SEC as unconfigured. WhatsLive.tsx renders them statically on /methodology#data, the page the production bar's 'What's live' link opens. The marketData.ts:14-17 bar sentence leaves filings out of the live list for the same stale reason. ScannerNotLive.tsx:104-113 hard-codes 'SEC EDGAR; starts once SEC access is set up on this site.' beside a computed tag that now reads Updated. The design card shell-site-docs.mjs:28/31 lists SEC EDGAR as live, with no SEC clause in the production lead.

Failure: After the API deploy, a production visitor sees Research Filings and the /credits SEC card tagged Updated, clicks 'What's live' and reads that SEC filings show Not set up until the operator acts. The signed-in owner's /scanner Filings card shows 'Updated' beside 'starts once SEC access is set up'.

Fix: copy.ts: remove the 'SEC filings show Not set up…' clause from the production lead and match the card (shell-site-docs.mjs:31). Reword the SEC row to 'As filed; live' (or 'Not set up when SEC_USER_AGENT is absent' as a conditional), and make the staging liveBody list SEC EDGAR as live. marketData.ts: add filings to the production live sentence and fix the comment. ScannerNotLive.tsx: choose the Filings body by filings_state. Use 'SEC EDGAR filings, read hourly' when live/unavailable/last_good, and the current sentence only for 'not_configured'. Copy only, so no test; check visually.

## W1-08 · medium
**The API picks a filer's revenue and fact unit nondeterministically or TWD-first when a year is tagged in two currencies**

Files: apps/api/src/services/public_data/filed_figures.rs, apps/api/src/services/public_data/edgar.rs

From #10, #47 and #92. RawConcept.units is a HashMap (filed_figures.rs:140-143, iterated :226). annual_revenue picks each year with min_by on filed date and concept rank only (:422-429), so TSMC's same-filing TWD and USD points tie and the HashMap order decides. A real-data repro picked TWD in 4 of 6 runs. edgar.rs fact_for sorts units alphabetically (:480), so TWD always comes before USD for ReportedFigures. Once W1-01 lands, the labels are correct, but the same page still flips between currencies across processes.

Failure: The TSM note's revenue chart shows TWD on one Railway process and USD on another. ReportedFigures always picks TWD even though the 20-F carries a USD convenience translation.

Fix: Choose units deterministically in both places. Prefer 'USD' (or 'USD/shares') when the filing tags it. Otherwise take the filer's single reporting currency. In annual_revenue, keep one unit for the whole series (the unit covering the most years, USD on ties) and drop years in other units, rather than mixing them. Make the tie-break explicit, not iteration order. Pin it with a cargo test: a facts fixture with TWD and USD points for the same year, in both insertion orders, yields USD with unit 'USD'. Run `cargo test -p api-rust --locked filed_figures`.

## W1-09 · medium
**The insider timeline states 'no open-market trades in 12 months' (Computed) when it read none or only part of the year's Form 4s**

Files: apps/dashboard/src/app/pages/research/InsiderClusters.tsx

Merges #9 and #93. history() always sends days=365 (insider_trades.rs:343). Failed documents are dropped silently (:389-397), and reaches_back_to is None when nothing was read (:350-352). insiders.state looks only at the 90-day reads (mod.rs:970-975). The frame's empty branch (InsiderClusters.tsx:156-162) checks only tx.length and states a computed empty year. The coverage sentence exists only on the ready path (:165-168), and the P-10 title and the 365-day axis always say 12 months (:50, :71, :240).

Failure: Take a small cap with no Form 4 in 90 days and 12 in the year, opened while EDGAR document fetches 403 or time out. The wire carries transactions=[], history_filings=12, history_filings_read=0. The note shows 'No open-market Form 4 trades by X insiders in 12 months.' tagged Computed: an unknown shown as empty. NVDA (more than 80 a year) gets a 'No buying cluster in 12 months: N insiders sold M times' title whose counts cover only the months read.

Fix: Extract a pure helper that decides the frame state from (transactions, history_filings, history_filings_read, history_reaches_back_to). If filings>0 and read==0, return sourceDown with 'EDGAR didn't answer for this year's Form 4s; unknown, not empty'. If read<filings and tx is empty, return a quiet message that names the coverage ('none among the K newest read, back to <date>'), not a 12-month claim. When truncated, build the title period and axis start from history_reaches_back_to. Pin the helper with a spec covering 0 of 12 read → unknown, 77 of 80 read → coverage named, and full read and empty → computed. Silent honesty logic like this is worth a test.

## W1-10 · medium
**'Last good copy' heuristics are wrong both ways: the insider and filed-figures frames can never show it, and the InsidersCard and desk FilingsCard show it when nothing failed**

Files: apps/dashboard/src/app/pages/research/InsiderClusters.tsx, apps/dashboard/src/app/pages/research/FiledFigures.tsx, apps/dashboard/src/app/pages/research/NotePublicPanels.tsx, apps/dashboard/src/app/pages/ticker/public-desk/PublicDesk.tsx

Merges #52, #63, #86, #66 and the frontend half of #87. The API puts the EDGAR outage sentence in filings_detail and sends `filings_source_state:'last_good'` (routes/public_data.rs:846-856). insiders.detail only ever holds 'Counts cover the 30 newest of N…' or '…could not be read' (mod.rs:957-976). Four places get this wrong. InsiderClusters.tsx:163 tests /did not answer/ on ins.detail, so it is never stale. FiledFigures.tsx:231-237 and :494 never consider staleness (RevenueAsFiled hard-codes 'Updated · on filing'). NotePublicPanels.tsx:775 marks any ins.detail as lastGood, so heavy filers with more than 30 Form 4s in 90 days read Last good copy on a fresh read. PublicDesk.tsx:481 treats any filings_detail on a live answer as stale. No dashboard code reads filings_source_state.

Failure: An EDGAR refresh fails for NVDA while a cached copy exists. The timeline shows 'Computed · from Form 4' and the revenue chart 'Updated'. On a normal day, /ticker/NVDA's InsidersCard shows the warn-tone 'Last good copy' because the API added 'Counts cover the 30 newest of 47 Form 4 filings.'

Fix: Add pages/research/secState.ts with a secStale(d) helper: `d.filings_source_state === 'last_good'`, falling back to /did not answer/ on d.filings_detail only when the field is absent (old API during deploy). Use it for the InsiderClusters tag, both FiledFigures tags (CheckFrame and RevenueAsFiled), the InsidersCard tag and the PublicDesk FilingsCard. Render ins.detail in InsidersCard as a coverage note, not as a staleness signal. Pin secStale with a spec covering the new field, the old-API fallback, and that a count note or a 'lists no company' detail is not stale. This is contract reading, so the test is warranted.

## W1-11 · medium
**A ticker EDGAR doesn't list reads 'SEC isn't set up' with an operator note to set SEC_USER_AGENT, and its filings read 'Last good copy'**

Files: apps/dashboard/src/app/pages/research/InsiderClusters.tsx, apps/dashboard/src/app/pages/research/NotePublicPanels.tsx, apps/dashboard/src/app/pages/ticker/public-desk/PublicDesk.tsx

Merges #50, #61 and #91. With SEC configured and no CIK for the symbol, the API returns filings_state 'live', filings_detail 'SEC EDGAR lists no company under X.' and insiders: null (mod.rs:895-904). InsiderClusters.tsx:138 maps `!ins` to notSetUp with NOT_SET_UP_CAUSE and the 'Set SEC_USER_AGENT on the API' OperatorNote. InsidersCard does the same (NotePublicPanels.tsx:754-760: 'isn't set up on this server yet'). The PublicDesk FilingsCard stale rule (:481) tags the explanation 'Last good copy' over 'No filings in the last 90 days.' The design's state for this case is 'Not an SEC filer' (shell-landing.mjs:116), which FilingsPage already uses.

Failure: In production, any visitor opening /ticker/VIX or /ticker/SPX, or a fresh IPO before EDGAR maps it, sees Insider trades 'Not set up' telling the operator to set a variable that is already set, and Recent filings 'Last good copy · No filings in the last 90 days.'

Fix: Treat `!d.insiders && d.filings_state === 'live'` as 'Not an SEC filer'. Use quiet copy that cites filings_detail, with no OperatorNote. Keep notSetUp and the operator note only for `insiders?.state === 'not_configured'` or `filings_state === 'not_configured'`. In the desk FilingsCard, base staleness on secStale (W1-10), not on any filings_detail. Same batch as W1-10. Copy and state mapping only, verified by typecheck.

## W1-12 · medium
**Form 4s a company files as reporting owner of another issuer appear as its own insider trades (BRK: 58 of 64 timeline trades were Lennar, DaVita and Liberty)**

Files: apps/api/src/services/public_data/insider_trades.rs, apps/api/src/services/public_data/mod.rs

#16. history_rows keeps every submissions row with form=='4' (insider_trades.rs:357-372), and parse_form4_doc never reads <issuer><issuerCik> (:83-128). Only test fixtures contain issuerCik. A holding company's submissions index lists the Form 4s it files as a 10% owner of other issuers. Those are read, placed on its timeline with the other issuer's shares and prices, and use up the 80-document budget. The 90-day card count (mod.rs:941-955) has the same pre-existing blind spot.

Failure: Run against BRK's live submissions with the commit's parsers: 25 Form 4s read, 64 trades, of which 58 are Berkshire buying LEN and selling DVA and LLYV as '10% owner'. Production with SEC live shows them as BRK insider trades with an EDGAR link.

Fix: Parse issuerCik in parse_form4_doc into Form4Doc. In insider_history and the 90-day loop, drop any document whose issuerCik (leading zeros stripped) differs from the ticker's CIK, and exclude it from the trade counts. Pin with a cargo test: sec_form4_buy.xml with a mismatched issuerCik is excluded, and with a matching one it is kept. Run `cargo test -p api-rust --locked insider_trades`.

## W1-13 · medium
**Filings page says followed companies 'filed nothing in the last 90 days' when EDGAR failed for them**

Files: apps/dashboard/src/app/pages/research/FilingsPage.tsx

Merges #48 and #85. Unlisted (FilingsPage.tsx:776-815, new) names every followed ticker that is neither in `missing` nor in `filings` as having filed nothing. The API leaves a failed ticker out of both and keeps state 'live' (mod.rs:522-553, :577-582). A ticker-map failure returns 'unavailable' with missing [] (:509-511), which also reaches the Unlisted branch (:249, :310). In the partial case the API marks the sec source row LastGood; in the total case it marks it SourceDown.

Failure: After an API restart, EDGAR times out for MU and INTC. The StaleNote says EDGAR did not answer for them, and the bottom of the page says 'INTC and MU filed nothing in the last 90 days'. If the ticker map fails, all 14 followed tickers are listed as having filed nothing (render repro, exit 0).

Fix: Render the quiet 'filed nothing' sentence only when `state==='live'` and the sec source row in read.data.sources is 'updated'. Fall back to `!read.data.detail` when sources are absent (old API). Otherwise replace it with 'EDGAR didn't answer for every company this cycle; filings for some are unknown.' For state 'unavailable', title the SourceProblem 'Source down: unknown, not empty' instead of 'Nothing filed in the last 90 days.' Extract the quiet-ticker decision into a small pure function and pin it with a spec covering live+updated, live+last_good and unavailable.

## W1-14 · medium
**Browser-notification controls contradict each other: 'Turn off' doesn't stop rules saved with the switch on, and the dialog switch skips Convexa's ask and silently turns on the page-wide flag**

Files: apps/dashboard/src/app/features/alerts/useAlerts.ts, apps/dashboard/src/app/features/alerts/usePublicChecks.ts, apps/dashboard/src/app/pages/alerts/NewAlertDialog.tsx, apps/dashboard/src/app/pages/alerts/AlertsPage.tsx, apps/dashboard/src/app/features/alerts/BrowserNotifyControl.tsx

Merges #21 and #22. Delivery uses `rule.notify ?? notifyBrowser` (usePublicChecks.ts:109-112, useAlerts.ts:72). turnOffBrowserNotify only clears the page flag (useAlerts.ts:124), so a rule with notify:true keeps notifying while the control reads off. New rules default to notify:false, so they never notify while the page says on. Suggestion rules have no notify and follow the page flag, although Review says 'On the Alerts page.' (NewAlertDialog.tsx:1245). The dialog switch calls Notification.requestPermission directly (NewAlertDialog.tsx:951-955 → useAlerts.ts:89-99), skipping the ask the spec says ships (deep.mjs:102). It also writes notifyBrowser=true, which turns on every rule without a notify field. Reproduced in vitest: after Turn off and a reload, 'Convexa · AMD' still showed.

Failure: Production, permission granted. The owner saves an AMD short-interest rule with the switch on, presses 'Turn off' and reloads; the control reads off. The next check fires an OS notification anyway.

Fix: Make the page flag the master switch. Add `shouldNotify(rule, pageFlag) = pageFlag && (rule.notify ?? true)` in useAlerts.ts and use it in both delivery paths, so Turn off stops everything (matches deep.mjs:95/102). When permission is 'default', the dialog switch opens BrowserNotifyControl's ask dialog (Continue → requestBrowserPermission) instead of the browser prompt. Build the Review 'Tells you' line from the effective value. Pin shouldNotify with a spec covering page off with rule true (none), page on with rule false (none), and page on with rule undefined (notify).

## W1-15 · medium
**'Results approaching' can never fire on TSM: the label check rejects '3Q26 results', and the row says the note has no results date**

Files: apps/dashboard/src/app/features/alerts/publicRules.ts, apps/dashboard/src/app/features/alerts/publicRules.spec.ts

#23. isOwnResults requires `^(F?Q[1-4]|H[12]|FY\d{0,4})\b` (publicRules.ts:285-287). TSM's catalysts are '3Q26 results and 4Q26 guide' (confirmed, 2026-10-15) and '4Q26 results; …' (research/TSM/2026-10-13-initiation.md:267, :272). Both are filtered out (:297), so the check returns quiet with 'No upcoming results date in the note'. validateRule accepts TSM because it is followed.

Failure: The owner creates 'Results approaching' on TSM, 7 days, on 2026-10-12. The check stays quiet with a false sentence and never fires for Oct 15 or January. The commit's code reproduced this.

Fix: Extend the regex to accept the nQyy form, e.g. `/^([1-4]Q\d{2}|F?Q[1-4]|H[12]|FY\d{0,4})\b/i`. Add spec cases '3Q26 results and 4Q26 guide' → own results and '4Q26 results; 2027 growth…' → own results, plus a checkResults case firing 'TSM: … in 3 days' on 2026-10-12.

## W1-16 · medium
**Results alerts invent a day-1 date for month or window catalysts ('Expected Sun Nov 1') and say 'due now' all month**

Files: apps/dashboard/src/app/features/alerts/publicRules.ts, apps/dashboard/src/app/features/alerts/publicRules.spec.ts

#32. checkResults takes e.when.start as the expected day (publicRules.ts:299). It renders 'Expected <fmtDay(start)>' (:308, :315), counts inDays to it, and says 'due now' once inDays ≤ 0 while end ≥ today (:302, :310-314). parseWhen sets start to the 1st of a month, quarter or year. CBRS '2026-11 | Q3 2026 results | Date not announced', the NVDA/AMD/GOOGL/HOOD/CRWV '2027-02' entries and the MSFT month entries all hit this. dates.mjs:1-4 says approximate dates count from the END of their window.

Failure: A CBRS 7-day rule fires on 2026-10-25: 'CBRS: Q3 2026 results in 7 days · Expected Sun Nov 1'. From Nov 1 to 30 it says 'due now' although results haven't come out. Reproduced against the real notes.

Fix: When e.when.kind !== 'day', never name a day. Use 'Expected <when.label>' (e.g. 'Nov 2026'). Fire once when today ≥ start − rule.days with 'CBRS: Q3 2026 results expected in Nov 2026 (date not announced)', keyed `results:SYM:<label>`. Never say 'due now' before the window's end. Keep the current behaviour for day-precision dates. Add spec cases for month and window forms.

## W1-17 · medium
**With SEC live, Alerts says SEC is 'Not set up' (kind tag, dialog strip, Review line, save toast) while the check is pending, failed or EDGAR is down**

Files: apps/dashboard/src/app/pages/alerts/alertsUi.tsx, apps/dashboard/src/app/pages/alerts/NewAlertDialog.tsx, apps/dashboard/src/app/pages/alerts/AlertsPage.tsx, apps/dashboard/src/app/features/alerts/usePublicChecks.ts

Merges #26 and #60. ctx.sec = checks.sec (AlertsPage.tsx:289) is null while checking or after a failed read, or 'unavailable' or 'off'. kindState (alertsUi.tsx:62), SecStrip (NewAlertDialog.tsx:916, 'isn't set up… Set SEC_USER_AGENT'), the Review Checks line (:1189, :1238) and the save toast (AlertsPage.tsx:348-349) all test `!== 'live'`. secFailed is computed (usePublicChecks.ts:114) and read nowhere. The page's own strip correctly checks 'not_configured' (:475). ruleState maps every 'unchecked' to Not set up, including source off (alertsUi.tsx:109).

Failure: On every production /alerts load with filing rules, New filing and Insider cluster read 'Not set up · Checking…' until EDGAR answers. During an EDGAR outage the dialog tells the operator to set SEC_USER_AGENT, and the toast says 'It checks EDGAR once SEC access is set up.' The rule rows on the same page say Source down. Render repro, exit 0.

Fix: Map SEC state explicitly in one helper: 'not_configured' → notSetUp (strip, Review line and toast as now); null while phase!=='done' → loading word 'Checking…'; null with secFailed, or 'unavailable' → sourceDown with 'SEC EDGAR didn't answer'; 'off' → off; 'live' → as now. Use the helper in kindState, SecStrip gating, secWait and the toast. In ruleState, map 'unchecked' from an off source to Off. Pin the helper with a spec over the five inputs.

## W1-18 · medium
**On Android Chrome the control says 'Browser notifications on', but no notification ever appears: `new Notification()` throws and the error is swallowed**

Files: apps/dashboard/src/app/features/alerts/useAlerts.ts, apps/dashboard/src/app/features/alerts/BrowserNotifyControl.tsx

#34. deliverBrowser constructs a page-context Notification in try/catch with an empty catch (useAlerts.ts:39-47). Chrome on Android exposes permission and requestPermission, but the constructor throws 'Illegal constructor. Use ServiceWorkerRegistration.showNotification()'. The app registers no service worker. The new ask flow reaches 'on' (BrowserNotifyControl.tsx:119-124), and the ask copy promises a notification (:31-32).

Failure: An Android Chrome reader taps Turn on, Continue, Allow, and the tag reads 'Browser notifications on'. Every firing throws silently, so no notification is ever shown.

Fix: Detect the unsupported constructor and say so instead of claiming 'on'. In deliverBrowser, on a TypeError from the constructor, record a module-level `notifyBroken=true` and notify subscribers. currentNotifyPermission then returns 'unavailable', so the control shows its existing unavailable copy and the per-rule switch disables. Optionally probe once right after a grant with a silent constructor call. A service-worker path is not worth it for a portfolio site.

## W1-19 · medium
**Source chips inside the New alert dialog's choice buttons are links: clicking one jumps to /credits and loses the draft, and an <a> nested in a <button> is invalid**

Files: apps/dashboard/src/app/pages/research/publicUi.tsx, apps/dashboard/src/app/pages/alerts/NewAlertDialog.tsx

#75. publicUi.tsx:40-44 wraps every ProvenanceChip in CreditsLink, a RouterLink when the text names a source. NewAlertDialog's Tile is a `<Box component="button">` (:329-334) holding a ProvenanceChip (:418-421). Five of the six kind chips match an anchor (SEC EDGAR, Form 4, CFTC, FINRA, EDGAR cadence), and the demo 'Sample · shaped like…' text matches too. A click navigates away and unmounts the dialog state. The ReviewStep chip (:1203-1209) loses a filled draft the same way.

Failure: On /alerts, the user taps the 'Insider cluster' tile on its 'SEC EDGAR · Form 4' chip and lands on /credits#sec with the dialog gone. Render repro, exit 0. Screen readers meet a link inside a button.

Fix: Give ProvenanceChip a `link?: boolean` prop (default true) that skips CreditsLink when false. Pass `link={false}` from the Tile chips and the ReviewStep chip in NewAlertDialog. Verified by typecheck and a manual click. No test needed.

## W1-20 · medium
**The TradingView frame header always says 'Live · TradingView', also while loading and after a block or timeout, and the desk legend counts it**

Files: apps/dashboard/src/app/pages/ticker/technical-analysis/TradingViewDaily.tsx, apps/dashboard/src/app/pages/ticker/technical-analysis/TechnicalAnalysisLive.tsx

#97. TradingViewDaily.tsx:73-74 renders `<DataStateTag state="thirdParty"/>` unconditionally. The load phase lives in the child Frame (:127, the 12 s timeout at :132-139, the failed Alert at :171-195). PublicDesk's useStateCounts counts [data-state] (PublicDesk.tsx:180-205). The spec board gives 'Blocked or timed out' no tag and Loading the loading tag (ticker-tech.mjs:130). TechnicalAnalysisLive has the same header.

Failure: A visitor with a content blocker opens /ticker/NVDA. The body says 'TradingView's chart didn't load' while the header says 'Live · TradingView' and the legend lists 'Live · TradingView 1'.

Fix: Lift phase into TradingViewDaily: Frame reports it through an onPhase callback, or lift the useState. The header tag becomes 'loading' while loading, thirdParty when ready, and no tag when failed. Apply the same in TechnicalAnalysisLive. Typecheck only.

## W1-21 · medium
**Scanner Not live cards say Updated or Delayed by source while the API serves a last good copy**

Files: apps/dashboard/src/app/pages/scanner/ScannerNotLive.tsx

#36. partTag (ScannerNotLive.tsx:40-44) uses only the answer-level state and whether the part is present. The four cards (:64-71, :77-84, :95-101, :112) never read rates.source_state, futures.source_state, short_interest_source_state or filings_source_state, which the API sets to 'last_good' (public_data.rs:440-449, :854-856). MarketsPage already uses servingLastGood (marketsMath.ts:94-101).

Failure: The Treasury fetch fails this cycle while a cached copy exists. The signed-in owner's /scanner shows 'Updated · Oct 14' and the legend counts it as Updated, while /research/markets says 'Last good copy'. Render repro, exit 0.

Fix: In each card's tag, return {state:'lastGood'} when the section's *_source_state === 'last_good'. Reuse servingLastGood from marketsMath.ts for markets parts and secStale-style logic for filings, read defensively since the fields are absent on the old API. Keep the current fallback otherwise. Same batch as W1-07.

## W1-22 · medium
**The blog post's address now serves the home page's canonical and OG tags, and its only other copy is noindex, so share previews and search lose the post**

Files: tools/build-dashboard.mjs, apps/dashboard/index.html

#72. The static post was moved to public/blog/plain/ (noindex, canonical → the .html SPA address). The SPA shell's head says canonical https://convexa.pages.dev/ with the home og:title and og:url (index.html:16, :21, :26). BlogPostPage only sets document.title. sitemap.xml:20 lists the .html address. At bb49675 the static file carried its own og:title and og:url.

Failure: Sharing /blog/how-we-read-dealer-structure.html on Slack, X or LinkedIn previews 'Convexa — See the dealer positioning behind the price.' with og:url of the home page. Crawlers see the post's sitemap URL declare the home page canonical.

Fix: Add a post-build step in tools/build-dashboard.mjs. Write dist/blog/<slug>.html as a copy of dist/index.html with <title>, description, og:title, og:description, og:url and canonical replaced from posts.ts metadata. Cloudflare then serves that asset for the post (its .html→bare 308 lands on the bare path, which W1-06 makes render the post), and the SPA hydrates over it. This writes only into dist, not public/blog/<slug>.html, so it respects docs/blog/build_html.py's rule. Check with `curl -s …/blog/how-we-read-dealer-structure | grep og:title` after a build.

## W1-23 · low
**The ticker's SEC source row (and filings_source_state, and the /credits SEC card) says Updated when company facts or Form 4 reads failed**

Files: apps/api/src/services/public_data/mod.rs

Merges #1, #18 and the backend half of #87. sec_row is built from map.failed_at().max(submissions.failed_at()) (mod.rs:901/912-932) before company_facts is fetched (:988). The facts Stale or Failed state reaches only notes and the top-level detail (:1006-1009). Unread Form 4s affect only insiders.detail. The row is named 'SEC EDGAR filings and company facts' (sources.rs:19), and the wire doc claims filings_source_state covers periodic (routes/public_data.rs:846). A cargo repro with seeded caches gave state=Updated and failed_at=None with facts Failed or Stale.

Failure: SPY's or NVDA's companyfacts refresh times out while submissions answer. The SEC row and filings_source_state say 'updated', and /credits shows the SEC card Updated with 'checks … company facts every 24 hours', while tagged figures come from a kept copy or are missing.

Fix: In sec_part, fetch company_facts before building sec_row. Set sec_failed_at = max(map, submissions, facts).failed_at(), and join facts.note into the row detail. Facts Failed with nothing cached and submissions fine → LastGood is wrong; use a detail-bearing Updated row plus the existing note, or SourceDown for the facts part. Simplest honest choice: any failed_at → LastGood with the facts note. Fix the route doc to match. Pin with the cargo test shape the repro used: seeded fresh map and submissions with failed facts → row failed_at set. W1-10 makes the frontend read it.

## W1-24 · low
**Results-window projection assumes consecutive quarters, so annual 20-F/40-F bases (TSM, BABA) and skipped quarters produce windows that span years or start in the past**

Files: apps/api/src/services/public_data/calendar.rs

Merges #6 and #14. results_window projects basis[i] by 91×(i+1) days (calendar.rs:428-432) and rejects only end<today (:435-437). The periodic fallback includes 20-F and 40-F (edgar.rs:173). TSM's 638 6-Ks are all described '6-K', so its basis is four yearly 20-Fs. For about 91 days after each 20-F, the window runs about 2 years, e.g. 2025-04-17→2027-07-15, and comingUp labels it 'from its 10-Q and 10-K dates'. It is dormant today (2026-10-15) and returns around April 2027.

Failure: In April–July 2027, Coming up draws 'TSM results · Estimated from filing history' across all six weeks. A US filer missing a Q4 8-K 2.02 gets a window that started two months ago.

Fix: Keep only basis dates whose gaps are quarterly (about 70–110 days) when projecting by quarter. If the basis is annual (20-F/40-F, gaps around 365), project only latest+365±15 or return None. Drop projections whose start is more than a week before today. Pin with cargo tests using the reproduced inputs: TSM 20-F dates on 2027-05-01 → not a multi-year window; 8-K dates 2026-07-30, 04-30, 2025-10-30 on 2026-10-01 → no past-starting window. Run `cargo test -p api-rust --locked results_window`.

## W1-25 · low
**When BEA moves its joint GDP + PCE release, only GDP gets 'moved from'**

Files: apps/api/src/services/public_data/calendar.rs

#5. mark_moves tracks used dropped dates as a bare Vec<NaiveDate> (calendar.rs:342, :356, :361). GDP and 'PCE prices' share 24 BEA dates, so whichever is processed second loses its own dropped date and gets moved_from None forever (:344-349). Reproduced with the commit's function.

Failure: BEA moves the 2026-10-29 joint release to 11-05. GDP shows 'moved from Oct 29', and PCE prices shows Nov 5 with no move mark.

Fix: Key `used` by (source, name, date), or remove the matched row from `dropped`. Add a cargo test with GDP and PCE both moving from 10-29 to 11-05, asserting both have moved_from 2026-10-29.

## W1-26 · low · needs owner
**'Moved from' marks live only in process memory, so every Railway deploy erases them, and moves across a restart or of more than 35 days are never marked**

Files: apps/api/src/services/public_data/mod.rs

#3. Inner.marked is an in-memory HashMap that starts empty (mod.rs:127, :158). mark_moves runs only when a previous copy exists in this process (:337-345), compares against that single copy, and uses MOVE_MAX_DAYS=35 (calendar.rs:54). The CALENDAR_SPEC card marks 'a release that moves carries the date it moved from' as shipped. The date shown is always right; only the annotation is lost.

Failure: BLS moves CPI from Oct 14 to Oct 15, and the API marks it. A push redeploys the API an hour later, and Coming up drops 'moved from Oct 14' while the release is still ahead.

Fix: Recommended (cheap): amend the CALENDAR_SPEC built line and the copy to say the mark covers moves seen since the server last started. Alternative: persist the last served copy per schedule in the production Postgres and seed `marked` from it at startup. That is more code for a rare annotation.

Owner question: Should the 'moved from' mark survive API deploys (persist the last schedule copy in Postgres), or is it acceptable that a deploy clears it, with the spec card amended to say so?

## W1-27 · low
**The calendar carries no per-agency horizon, so weeks past BLS's published schedule would read 'Nothing scheduled'**

Files: apps/api/src/services/public_data/mod.rs, apps/api/src/services/public_data/types.rs, apps/api/src/routes/public_data.rs, libs/api/src/generated/schema.ts

#4, upheld 2 of 3. Calendar{from,to,releases} has no per-source last-published date (mod.rs:245-268, types.rs:172-176). Today's BLS ICS ends 2026-12-30. The repro skeptic showed that the BLS ICS added the next year by about Nov 21-23 in 2024 and 2025, and the 6-week grid first reaches Jan 4-8 on Nov 30. The risk is conditional on BLS lagging.

Failure: If BLS has not added 2027 to the ICS by 2026-11-30, the week of Jan 4-8 reads 'Nothing scheduled' although the December jobs report is due that Friday.

Fix: Add `horizon: Option<NaiveDate>` per schedule (the max date in each cached copy) to the calendar wire as an optional field with serde default, and regenerate schema.ts. A follow-up in the coming-up batch, after this lands, shows weeks beyond an agency's horizon as 'not published yet' for that agency. Low priority; re-check on Nov 23.

## W1-28 · low
**Results windows are checked against the UTC date, so a window drops out from 7-8 PM ET on its last day**

Files: apps/api/src/services/public_data/mod.rs

#7. filings() passes Utc::now().date_naive() (mod.rs:514) to calendar::results_window (:536), which returns None when end<today (calendar.rs:435). The calendar path uses today_eastern() (mod.rs:1082-1086).

Failure: At 2026-11-26 21:00 ET, NVDA's window ending 2026-11-26 is missing from /filings, so Coming up loses its estimated row for US-evening viewers.

Fix: Pass today_eastern() to results_window. A one-line change; no test needed.

## W1-29 · low
**Form 4 text is not XML-unescaped, so officer titles render as 'EVP &amp; CFO'**

Files: apps/api/src/services/public_data/insider_trades.rs

#11. text() (insider_trades.rs:74-79) returns the raw slice from edgar::elements (edgar.rs:283-285). Nothing decodes entities, and valid XML must escape '&'. roles render in the SVG labels, the table and the aria text (InsiderClusters.tsx:218, :380, :419).

Failure: <officerTitle>Chair, President &amp; CEO</officerTitle> is shown literally as 'Chair, President &amp; CEO'.

Fix: Decode &amp; &lt; &gt; &quot; &apos; &#N; &#xN; (and unwrap CDATA) in text(). Add a cargo unit test for that title.

## W1-30 · low
**Placeholder officer titles ('See Remarks', '*') become the insider's role label, e.g. 'See Remarks 1', 'See Remarks 2'**

Files: apps/api/src/services/public_data/insider_trades.rs

#20, upheld 2 of 3; the canon skeptic called it intended 'as filed'. role_of uses officerTitle verbatim (:98, :132-138) and numbers duplicates (:295-311). <remarks> is never read. Roles are the only identity the chart shows.

Failure: Two officers who filed 'See Remarks' appear as 'See Remarks 1' and 'See Remarks 2' in rows, the table and aria text.

Fix: Treat placeholder titles (case-insensitive 'see remarks…', '*', '-', 'n/a') as missing so they fall back to 'Officer' and get the existing numbering. Add a cargo test.

## W1-31 · low · needs owner
**One purchase reported in separate Form 4s by related owners counts as several insiders toward a 'buying cluster'**

Files: apps/api/src/services/public_data/insider_trades.rs

#15, upheld 2 of 3. Insiders are keyed by the first reportingOwner CIK (insider_trades.rs:271-275), and there is no dedupe on (date, shares, price) across filings. windows() counts distinct keys against CLUSTER_MIN_INSIDERS=3 (:228). The canon skeptic argued that counting distinct Section 16 filers matches the spec card's definition.

Failure: A fund (10% owner), its GP and its appointed director each file a Form 4 for the same 500,000-share purchase. The title reads 'Three insiders bought … a buying cluster'.

Fix: If the owner wants purchases counted: before windows(), collapse code-P trades with the same date, shares and price from different owners into one insider. Otherwise leave as is and note it on the spec card.

Owner question: Should a buying cluster count distinct reporting owners (the current, filings-literal rule) or distinct purchases, merging identical same-day trades reported by related filers?

## W1-32 · low
**filing-check treats any 3-letter currency as '$', so a note's dollar figure is checked against TWD or EUR values**

Files: tools/research-notes/filing-check.mjs

The filing-check half of #10. fits('money', unit) accepts any /^[A-Z]{3}$/ unit (filing-check.mjs:150-168), and formatFiled and formatGap print '$'. Latent: no note cites an ifrs-full concept yet (planned-spec.mjs:230).

Failure: A TSM note row citing ifrs-full:Revenue '$118.6B @ FY2025' returns 'differs', gap '$3,690.5B', 'the 20-F tags $3,809,054M'.

Fix: A '$' note figure fits only 'USD' (and 'USD/shares' for per-share). Other currencies return 'units differ'. Add a case to the tools test.

## W1-33 · low
**check-filings reads 4 filings including amendments, while the page gets the latest 2 without amendments, so the author's check and the page disagree**

Files: tools/research-notes/filing-check.mjs, tools/research-notes/check-filings.mjs

#12, upheld 2 of 3; the canon skeptic noted the tool isn't wired into verify. filingsFromCompanyFacts defaults keep=4 and folds /A forms into the base form (filing-check.mjs:382, :401-408). The API's periodic list is exact-form .take(2) (edgar.rs:623, :632). check-filings.mjs claims to list 'the same differences the note page shows'.

Failure: An FY figure from the 10-K, now the third-newest filing, passes the author check ('matches') while the page shows 'not in a filing read yet'.

Fix: Default keep=2 and match PERIODIC_FORMS exactly (no /A), mirroring edgar.rs periodic_filings. Add a tools test with a 10-K plus two 10-Qs → the FY figure is not_found.

## W1-34 · low
**The README's 'date it as the year to date' workaround for quarterly cash flow cannot work and yields a false 'doesn't tag' detail**

Files: research/README.md

#13. README.md:186-187 is new advice. Neither attach keeps 182- or 273-day spans (filed_figures.rs:310-314, :368; filing-check.mjs:368-372, :433-437), so a Q2 or Q3 YTD figure gets 'missing' with 'The 10-Q doesn't tag … for this period' and the check exits 1.

Failure: An author follows the README, check-filings exits 1, and the page says the 10-Q doesn't tag OCF.

Fix: Edit the README: for Q2 and Q3 cash-flow figures, cite the filing with `none`. YTD equals the quarter only for Q1. Docs only.

## W1-35 · low
**Filed values at or above 1e6 print as whole millions, coarser than the note, so 'differs' shows a misleading filed number**

Files: tools/research-notes/filing-check.mjs

#19. formatFiled (filing-check.mjs:170-180) promises 'a digit finer than the note' but :178 prints grouped(v/1e6, 0)+'M' whatever note.decimals is. Latent until a note links an M-scale concept.

Failure: '$512.3M' against a filed 512,460,000 gives 'The note says $512.3M; the 10-Q tags $512M', which suggests the filing is lower when it is higher.

Fix: For M-scale notes, print v/1e6 with note.decimals+1 places. Add test cases for $512.3M→$512.46M and 1.23M→1.236M.

## W1-36 · low
**Coming up counts a company whose results date passed earlier this week as reporting 'in the next six weeks' (TSM, Oct 16-18)**

Files: apps/dashboard/src/app/pages/research/comingUp.ts, apps/dashboard/src/app/pages/research/comingUp.spec.ts

Merges #55, #69 and #95. Note results are filtered only by inRange from Monday (comingUp.ts:79-81, :103). Estimates drop w.end<today (:119) and the FOMC uses e.date>=today (:155). reporting counts every ticker event (:152-154), and ComingUpSection.tsx:134 states it in the P-10 title. TSM's unresolved 2026-10-15 catalyst reproduces it from 2026-10-16.

Failure: On Fri Oct 16 the title counts TSM among the companies that 'report in the next six weeks', although it reported Thursday.

Fix: Build `reporting` only from events dated on or after today. The past event may still sit in this week's column as 'Makes due'. Add a comingUp.spec case with today 2026-10-16 and TSM on 10-15 → not in reporting.

## W1-37 · low
**Coming up states unknowns as facts: 'Nothing scheduled' when every schedule failed, and a confident company count when SEC estimates failed**

Files: apps/dashboard/src/app/pages/research/ComingUpSection.tsx

Merges #54, #62, #89 and #96. With calendar===null and nothing else in range, status falls through to the quiet 'Nothing scheduled in the next six weeks.' (:121-128). The StaleNote is a child and is hidden when not ready (ChartFrame.tsx:164-167). windows = filings.data?.results (:79) silently becomes [] on filings.error, state 'unavailable' or a source_down/last_good sec row; only not_configured is explained (:98-100). The tag comes from schedule rows only (:136-142), so the count undercounts under 'Updated'.

Failure: EDGAR is down: '9 of the 14 followed companies report…' under 'Updated', with AMZN and CRWV silently missing. All schedules down after a restart: 'Nothing scheduled' under a Source down tag.

Fix: When calendar===null, make the status a sourceDown message ('The agencies' schedules didn't answer; dates are unknown'), not the empty message. When filings.error is set, filings.data.state is 'unavailable', or the sec row isn't updated, show a line 'Results estimates from SEC filings are missing this cycle' (same slot as secNotSet) and qualify the finding ('at least N of …'). Same batch as W1-36.

## W1-38 · low
**Coming up drops results the notes give as a date range, and a note date just past the grid doesn't override the estimate**

Files: apps/dashboard/src/app/pages/research/ComingUpSection.tsx, apps/dashboard/src/app/pages/research/comingUp.ts

#49. fromNotes keeps only when.kind==='day' (ComingUpSection.tsx:47), so AMZN 10-27..30, CRWV 11-05..16, SPCX 11-03..17 and CBRS 2026-11 are ignored. SPCX (listed 2026) likely gets no EDGAR window (calendar.rs basis<2), so it vanishes. `dated` is filled only for in-range note dates (comingUp.ts:103-104), so an estimate wins when the note date sits just after the grid. The spec card says rows fall back to the notes' dates.

Failure: Without SEC estimates (old API during deploy, or SEC down), the title reads 9 of 14 when the notes put 13 in the grid. SPCX is missing even in steady state.

Fix: Pass window-kind note results through as range events drawn 'from the note'. Add the ticker to `dated` for any note results date at or after today, in range or not, so a note always beats an estimate. Add comingUp.spec cases for a window note and an out-of-range note date.

## W1-39 · low
**Coming up tags 'Source down' when public data is switched off**

Files: apps/dashboard/src/app/pages/research/ComingUpSection.tsx

#90. With PUBLIC_DATA=off the API sends calendar:null with every row 'off'. The tag checks calendar===null first (:136-142), so the frame shows 'Public data is switched off on this server.' beside 'Source down'. ChartFrame renders the tag for message states.

Failure: The operator sets PUBLIC_DATA=off, and the Coming up frame shows two contradictory state words.

Fix: Check markets.state==='off' first and return {state:'off'}, then calendar===null. One line.

## W1-40 · low
**Reported figures says 'not available yet' and blames the SEC when Convexa's company-facts fetch failed**

Files: apps/dashboard/src/app/pages/research/FilingsPage.tsx

#51. `failed` checks only read.error and filings_state (FilingsPage.tsx:847). When company facts fail with nothing cached, the API keeps filings_state live and lists the filings with empty facts, putting 'SEC EDGAR company facts did not answer…' in the top-level detail. ReportedFigures shows the quiet 'aren't available yet … The SEC adds them…' (:866-873) with no tag and no Try again. The spec requires 'Couldn't load' (research-spec.mjs).

Failure: After a restart, NVDA's companyfacts times out, and the selected 10-Q says the SEC hasn't added the figures yet.

Fix: If facts are empty and read.data.detail matches /company facts/ (or, after W1-23, the sec row isn't updated), render Couldn't load with that detail and a Try again calling read.retry. Same batch as W1-01, W1-13.

## W1-41 · low
**The insider-trades title names the cluster's month without a year, so an 11-month-old cluster reads as this month**

Files: apps/dashboard/src/app/pages/research/InsiderClusters.tsx

#57. clustersFinding uses MONTHS[last.to month] only (:46-52), the history covers 365 days, and the month ticks have no year (:329-339).

Failure: On 2026-10-15 a 2025-10-20..28 cluster titles as '…within 9 days in Oct: a buying cluster'.

Fix: Add the year when the cluster's month/year differs from today's ('in Oct 2025'). Label the first tick of each year with the year.

## W1-42 · low
**The public desk's dense grid moves the tape and flow panels above the AI read on screen while focus order keeps them below**

Files: apps/dashboard/src/app/pages/ticker/public-desk/PublicDesk.tsx

#99. FeedZone uses gridAutoFlow 'row dense' (PublicDesk.tsx:687-694) with the full-width AI read (AiReadNotLive.tsx:263). At 3 columns, tape and flow back-fill row 2 while the DOM order is score, ai, tape, flow (WCAG 2.4.3/1.3.2).

Failure: A keyboard user tabs from Score (row 2) to the AI read (row 3), back up to Tape and Flow (row 2), then down to Term.

Fix: Remove 'dense' and accept the empty cells, or move the ai entry in FEED_PANELS after flow so the DOM matches the 3-column layout. Removing dense is the simplest correct choice.

## W1-43 · low
**The 'What a read sends' drawer says 'Not live · Nothing sent' even when the feed is paused**

Files: apps/dashboard/src/app/pages/ticker/public-desk/AiReadNotLive.tsx

#98. WhatAReadSends takes no feed prop and hard-codes notLive (:137-145, :183, :185-188), while the panel switches to paused (:279). Latent: production reports not_live.

Failure: A live build with an operator-paused feed shows the panel as 'Paused' and its drawer as 'Not live'.

Fix: Pass feed to WhatAReadSends and WhatAReadSendsLink (default 'not_live'). Tag paused, and use 'while the options feed is paused' copy when paused.

## W1-44 · low
**The Alerts 'Fired' tag shows the render time as the check time and says Updated even when every source failed**

Files: apps/dashboard/src/app/pages/alerts/AlertsPage.tsx, apps/dashboard/src/app/features/alerts/usePublicChecks.ts

Merges #25, #65 and #68. AlertsPage.tsx:551-555 builds `checked ${new Date()…}` in render. usePublicChecks stores no check time (:40-47, :114) and always ends phase 'done' after settled() nulls every failure (:54).

Failure: The check completes at 9:00. At 11:30, opening and closing New alert restamps the tag to 'checked 11:30 AM'. A 502 on every read still shows 'Updated' over 'Nothing has fired yet.' while the rows say Source down.

Fix: Store checkedAt and the number of reads answered or failed in PublicChecks at 'done'. The tag shows the stored time. 'updated' only if every read answered; 'sourceDown' if none did; otherwise the worst state word for a partial result (e.g. 'lastGood'/'delayed' per P-2 closed list).

## W1-45 · low
**'Note coming due' fires twice from an SEC outage and never fires for a filing that lands after the note is already due**

Files: apps/dashboard/src/app/features/alerts/publicRules.ts, apps/dashboard/src/app/features/alerts/publicRules.spec.ts

#24. The due key is `note:SYM:due:${fresh.since}` (publicRules.ts:348), and since is the earliest passed event. Filings drop out when SEC fails or after the 90-day window (edgar.rs:22), which shifts since and creates a new key. Once due, since stays pinned, so later filings are swallowed. This breaks the module header (:5-12) and the sentence '…or a filing lands after it' (:481).

Failure: Oct 5 fires due:09-15. Oct 6 with SEC down fires again with due:10-01. Oct 20 with a new results 8-K stays quiet.

Fix: Fire the due alert once per note version (`note:SYM:due:<note date>`), and fire separately per filing accession that lands after the note (`note:SYM:filing:<accession>`) only when filings were read. Spec cases for the outage and the later filing.

## W1-46 · low
**Alert checks treat per-ticker SEC failures, `missing` tickers and tickers past the 30-ticker slice as a healthy quiet check**

Files: apps/dashboard/src/app/features/alerts/publicRules.ts, apps/dashboard/src/app/features/alerts/usePublicChecks.ts

#27. checkFiling reads only filings.state (publicRules.ts:237-258). A partial EDGAR failure answers 'live' and omits the ticker, so the rule records quiet and ruleState shows 'Updated · Checked'. filingsRead=true for the note rule (usePublicChecks.ts:145-146). Only the first 30 tickers are requested (:83).

Failure: NVDA's submissions fail while AMD succeeds, and the NVDA filing rule reads 'Updated · Checked 2:30 PM'.

Fix: If the rule's ticker is in `missing`, absent from the request, or the sec row isn't 'updated' and no filings for that ticker were returned, return unavailable for that rule. Chunk tickers in 30s instead of slicing. Spec cases.

## W1-47 · low
**Editing a filing rule's ticker keeps the old createdAt, so up to 90 days of the new ticker's filings fire at once**

Files: apps/dashboard/src/app/pages/alerts/AlertsPage.tsx

#28. The edit save spreads `{...existing, ...draft}` and keeps createdAt (AlertsPage.tsx:327-333). checkFiling uses filed >= localDay(createdAt) (publicRules.ts:235-246). The symbol stays editable.

Failure: An NVDA rule from Aug 1, edited to AMD on Oct 15, fires every AMD 8-K, 10-Q and 10-K since Aug 1, with notifications.

Fix: On edit, when symbol, forms or kind change, set createdAt to now and clear fired.

## W1-48 · low
**An edit saved while a check is in flight gets the old settings' fired, inZone and check merged onto it**

Files: apps/dashboard/src/app/features/alerts/store.ts, apps/dashboard/src/app/features/alerts/usePublicChecks.ts

#29, the race half; the no-re-check-after-edit half is by design. recordChecks merges the snapshot's memory by id (store.ts:140-144). A stale inZone suppresses the new group's entering-zone firing (publicRules.ts:146, :189).

Failure: Switching a Positioning rule from leveraged funds to asset managers during the opening check inherits inZone=true, so the asset managers' extreme never fires.

Fix: Add a version (or updatedAt) bumped on edit. recordChecks applies memory only when the stored version equals the snapshot's.

## W1-49 · low
**The notify copy promises notifications 'pop while a desk is open', which never happens in production**

Files: apps/dashboard/src/app/features/alerts/BrowserNotifyControl.tsx

#30, narrowed to the notify row. BrowserNotifyControl.tsx:115-117 is not environment-gated. In production the structure kinds are Not live, and public kinds check only when /alerts opens (usePublicChecks.ts:5).

Failure: A reader keeps a desk open all day expecting pops, and none arrive.

Fix: Show the desk sentence only when structureLive. Otherwise say 'while the Alerts page is open'.

## W1-50 · low
**Two checks can run on the same stale memory (a remount mid-check, or a second tab), so the same filing fires twice**

Files: apps/dashboard/src/app/features/alerts/usePublicChecks.ts, apps/dashboard/src/app/features/alerts/store.ts

#33. The check effect has no cleanup, `run` is per instance (:70, :87), the snapshot is taken before the awaits (:77), store memory never re-reads localStorage (store.ts:84-85), and nothing listens for 'storage' events.

Failure: Leaving /alerts and returning during the first SEC read gives two 'NVDA filed a 8-K' rows. Vitest repro.

Fix: Return a cleanup that marks the run cancelled (skip recordChecks and delivery). In recordChecks, merge against the current memory and drop events whose fired key is already present. Add a 'storage' listener that clears memory.

## W1-51 · low
**Firings for one symbol in one check replace each other's notification (the tag is per symbol)**

Files: apps/dashboard/src/app/features/alerts/useAlerts.ts

#35, upheld 2 of 3. tag `convexa-${title}` with title 'Convexa · SYM' (useAlerts.ts:43) and per-event delivery (usePublicChecks.ts:110-112). The page still lists every event.

Failure: A 10-Q and an 8-K for NVDA in one check leave only the 8-K notification visible.

Fix: Tag each notification by event key (`convexa-${eventKey}`).

## W1-52 · low
**Demo alerts validate against production's note tickers and refuse the demo's own sample symbols**

Files: apps/dashboard/src/app/features/alerts/usePublicChecks.ts

#64. followedTickers() returns the production researchIndex in both builds (usePublicChecks.ts:50-52). validateRule refuses non-followed tickers (publicRules.ts:510-513). The demo's notes are STAGING_DEMO_SYMBOLS (demoSite.ts:23).

Failure: On staging, New filing on AAPL is refused ('isn't followed'), while AMD is accepted with 'you have notes on AMD'.

Fix: When dataMode==='demo', return new Set(STAGING_DEMO_SYMBOLS).

## W1-53 · low · needs owner
**The new demo alerts seed never reaches staging browsers that already initialized the demo workspace**

Files: libs/api/src/lib/demo/workspace.ts

#31, upheld 2 of 3; the canon skeptic called it the intended persistence contract. initializeDemoWorkspace returns on the unchanged sentinel (workspace.ts:200-202), and seed keys write only when null (:528-537). Returning visitors see only the old SPY rule until Reset demo data.

Failure: A visitor from last week sees none of the six public-kind sample rules or the T-note sample firing.

Fix: If yes: a versioned migration that adds seed rules and events missing by id into an existing convexa.alerts.v1 blob, without touching existing rules, and records a seed version key.

Owner question: Should returning staging browsers get newly added sample alert rules merged in (by id, leaving their own edits alone), or only see them after Reset demo data?

## W1-54 · low
**/positions with no feed still requests /api/contract from the order engine and the Broker tab (all 503)**

Files: apps/dashboard/src/app/features/trading/orders/useOrderEngine.ts, apps/dashboard/src/app/features/trading/broker/useBrokerMarks.ts, apps/dashboard/src/app/pages/positions/PositionsPage.tsx

#37. useOrderEngine.ts:101-118 skips only in demo, and useBrokerMarks.ts:86-108 never skips. analytics.rs:33-35 returns 503 market_data_paused. PositionsPage.tsx:302-305 claims contract routes are never asked. The UI result is identical either way.

Failure: Two waiting TSLA orders produce two GET /api/contract/TSLA → 503 per /positions visit, plus one per broker option contract.

Fix: Read useMarkFeed() in both hooks and return early when 'notLive', as useContractLive does.

## W1-55 · low
**With no feed, P/L, P/L % and Net P/L read 'unavailable … this cycle' instead of the not-live dash**

Files: apps/dashboard/src/app/features/trading/positions/PositionRow.tsx, apps/dashboard/src/app/pages/positions/netPl.ts

#38. Only the mark cell got NoMarkCell (PositionRow.tsx:230-247). P/L (:490-491) and P/L % (:547) still use unavailableCell with ROW_UNAVAILABLE_TIP 'this cycle' (labels.ts:65-66). netPl F8 returns 'unavailable · 0 of N open marked'. P-2 says a not-live slot shows an em dash.

Failure: The owner's NVDA 200C row reads Mark '— Mark not live' beside P/L 'unavailable' with the tip 'couldn't be priced this cycle'.

Fix: When feed==='notLive' and there is no value, render the em dash (with MarkNotLiveTag or a tip 'needs the options feed') in the P/L and P/L % cells. In netPl, return a not-live caption when the feed is notLive.

## W1-56 · low
**Closed and cancelled position cards say 'Mark not live'**

Files: apps/dashboard/src/app/features/trading/positions/PositionCard.tsx

#39. markNotLive is computed for terminal records (PositionCard.tsx:84, :91). The row shows the terminal dash (PositionRow.tsx:424).

Failure: In History with Cards layout, a position closed Oct 7 shows 'Mark — Mark not live'.

Fix: Gate markNotLive on !isTerminal and render the row's terminal dash for terminal records.

## W1-57 · low
**The not-evaluated tooltip tells the trader to open the ticker page, which can't help with no feed**

Files: apps/dashboard/src/app/features/trading/orders/OrderRow.tsx, apps/dashboard/src/app/features/trading/orders/copy.ts

#41. feedOff switches the tag (OrderRow.tsx:182-199) but the tooltip is always notEvaluatedTip (copy.ts:74-78). The no-feed desk mounts PublicDesk with no stream (app.tsx:178).

Failure: Hovering 'Not evaluated' says to open TSLA's ticker page during live hours, which never evaluates the order.

Fix: When feedOff, use DLG-02 copy: 'Can't trigger without the live tape; the plan stays as placed and can still expire or be cancelled.'

## W1-58 · low
**Reassessment 'Copy request' says 'Copied' even when the clipboard write fails**

Files: apps/dashboard/src/app/features/trading/broker/reassess.tsx

#42, upheld 2 of 3. `void navigator.clipboard?.writeText?.(json); setCopied(true)` (reassess.tsx:205-216). FilingsPage and ScorecardPage await the write and catch failures.

Failure: Clipboard-write is denied, and the button still announces 'Copied' through aria-live.

Fix: Await writeText. Set copied only on success; on failure show 'Couldn't copy'.

## W1-59 · low
**The Positions lead claims a running options feed when /api/health failed**

Files: apps/dashboard/src/app/pages/positions/PositionsPage.tsx

#43. Every answer except 'not_live' maps to markFeed 'live' (PositionsPage.tsx:309-310), 'unknown' included. That answer is cached for the page load (useMarketDataMode.ts:5,12). The 'live' lead says 'Marks follow the options feed…' (:76), contradicting UNKNOWN_COPY.

Failure: A transient health 502 makes /positions claim a feed for the session while every mark reads unavailable and the bar says it couldn't check.

Fix: Map 'unknown' to a neutral lead that claims nothing ('Couldn't check whether marks are live'). Map 'paused' to the not-live treatment with paused wording.

## W1-60 · low
**The demo reassessment request exports modeled_pl_dollar: null for a holding the row shows as +$625**

Files: apps/dashboard/src/app/features/trading/broker/BrokerTabPanel.tsx, apps/dashboard/src/app/features/trading/broker/reassess.spec.tsx

#44. useBrokerMarks receives `book?.positions ?? []` (BrokerTabPanel.tsx:97). book is null in the demo, so legMarksOf(sampleBook position) is empty, pl_dollar is null, and the request's modeled_pl_dollar is null (reassess.tsx:112). The board specifies 625 (deep-overlays.mjs:62). Staging only.

Failure: Staging, Broker tab, AAPL sample, Build reassessment: the row reads ▲ +$625 and the JSON reads null. Full-app demo repro.

Fix: Feed `dataMode==='demo' ? sampleBook?.positions ?? [] : book?.positions ?? []` into useBrokerMarks. Assert modeled_pl_dollar 625 in the reassess spec's demo case. It is a money figure, so it is worth pinning.

## W1-61 · low
**At 6974f816 production /positions cannot open an option position with no chain; already fixed by 8258689b**

Files: apps/dashboard/src/app/features/trading/positions/PositionsPanel.tsx

#45, upheld 2 of 3; the canon skeptic refuted it as not shipping. notLive skips the bundle, so data is null. canOpenEntry={!!data} disables the toolbar, and the empty-state dialog has no expirations or strikes. Commit 8258689b (typed-contract entry, canOpenEntry={!!data || chainless}) is an ancestor of main HEAD and of origin/backup/2026-10-15.

Failure: Only if 6974f816 alone were deployed: the owner can't open an option position at a manual price.

Fix: No code change. Push main HEAD (or the backup branch), which contains 8258689b, not 6974f816 by itself. manualContract.spec.tsx passes 6 of 6 at HEAD.

## W1-62 · low
**The P/L sparkline text twin calls a pre-drop value 'now' after the stream drops**

Files: apps/dashboard/src/app/features/trading/positions/PlSparkline.tsx

#46, narrowed to the stale 'now'; the rounding half matches house format. plSparkText filters the null break and calls the last finite value 'now' (PlSparkline.tsx:112-117). The aria-label (:140) never mentions offline. Reachable in staging, where the demo stream emits offline.

Failure: After an SSE drop a screen reader hears 'Up $412 now' while the visible cell shows last known.

Fix: If the last sample is a null break (or offline is set), word it 'last known $X before the feed dropped'.

## W1-63 · low
**⌘K says 'No ticker or note matches' while it also says the ticker list failed to load**

Files: apps/dashboard/src/app/shell/CommandPalette/CommandPalette.tsx, apps/dashboard/src/app/shell/CommandPalette/CommandPalette.spec.tsx

#74. settled counts 'failed' as answered (CommandPalette.tsx:116-118). The comment on :115 and the spec board (shell-site-kit.mjs:145) say otherwise.

Failure: /api/scan/universe 502s, and typing IWM shows 'Couldn't search tickers right now.' and 'No ticker or note matches “IWM”.'

Fix: Show the no-match line only when tickers.phase==='ready'. In the failed case, say nothing beyond the existing warning. Add the missing `palette-empty` absence assertion to the existing failed-read spec.

## W1-64 · low
**Single-key shortcuts fire while an MUI Select or Menu list has focus**

Files: apps/dashboard/src/app/shell/shortcuts.ts

#76. isTypingTarget lists input, textarea, select, contenteditable, textbox, combobox, dialog and alertdialog only (shortcuts.ts:26-31). Focused options sit in role=listbox or menu under role=presentation. MenuList prevents only matching type-ahead keys.

Failure: In the open Settings persona Select, typing 'g s' navigates to /scanner, and '?' opens the sheet over the list.

Fix: Add [role=listbox], [role=menu], [role=option] and [role=menuitem] to the closest() selector.

## W1-65 · low
**Links at the end of the in-shell blog post open the next page part-way down**

Files: apps/dashboard/src/app/shell/AppShell.tsx

#77. The post's links are now RouterLinks (BlogPostPage.tsx:59-62). BrowserRouter has no scroll reset (mountApp.tsx:13), and MethodologyPage scrolls only on a hash. Browser repro: scrollY 5689 → 5680 on /methodology.

Failure: Clicking 'How Convexa works' at the end of the post lands mid-page on /methodology.

Fix: In AppShell, add a useEffect on location.pathname that calls window.scrollTo(0,0) when there is no hash.

## W1-66 · low
**The ⌘K hint on the 404 and in the shortcuts sheet puts aria-label on a generic span or kbd, so screen readers announce just 'K'**

Files: apps/dashboard/src/app/pages/not-found/NotFound.tsx, apps/dashboard/src/app/shell/ShortcutsSheet.tsx

#78. NotFound.tsx:47-54 and ShortcutsSheet.tsx:17-22, :54-56 use aria-label on role-less elements with an aria-hidden ⌘. axe flags aria-prohibited-attr.

Failure: A VoiceOver user hears 'or press K to jump to a ticker or note'.

Fix: Put role="img" on the labelled wrapper, or replace aria-label with visually hidden text 'Command '.

## W1-67 · low
**The hero's pixel-ratio ladder counts pointer pauses as dropped frames, so ordinary drags drop a Retina hero to DPR 1 for the visit**

Files: apps/dashboard/src/app/pages/landing/heroGl.ts

#79. While dragging, frames are drawn only on pointermove (heroGl.ts:568-574). The ladder measures ts−last between those draws (:468-488), keeping gaps under 100 ms, and win is never reset on pointerdown (:559-567). Steps are permanent. GPU repro on an idle M1 Pro: DPR 2 → 1.5 → 1 after two human-paced drags.

Failure: A MacBook visitor turns the hero twice, and the surface renders soft at DPR 1 for the rest of the visit.

Fix: Measure frame pacing only from a continuous rAF loop: run request() every frame while dragging and sample only consecutive rAF frames. Also clear win and last on pointerdown.

## W1-68 · low
**A devicePixelRatio change is never picked up, so the hero stays at the old resolution after moving to a Retina screen**

Files: apps/dashboard/src/app/pages/landing/heroGl.ts

#80. setSize reads devicePixelRatio only in resize() (:548-556), and resize() is wired only to a ResizeObserver (CSS px) or window resize (:649-651). There is no resolution media query listener. Repro: canvas stays 600 at DPR 2.

Failure: Dragging the window from a 1x monitor to the Retina display leaves the surface blurry.

Fix: Add a matchMedia(`(resolution: ${devicePixelRatio}dppx)`) change listener that calls resize() and re-arms on each change. Remove it in dispose.

## W1-69 · low
**The hero stage's accessible name promises Shift+arrow turning in static-projection mode, where it does nothing**

Files: apps/dashboard/src/app/pages/landing/GammaSurfaceHero.tsx, apps/dashboard/src/app/pages/landing/copy.ts

#81. aria-label is always surfaceName + surfaceKeys (GammaSurfaceHero.tsx:345, copy.ts:49), but fallback and poster modes have no turning (:279, heroGl absent or context lost). The spec's static markup says only 'Arrow keys move the probe.'

Failure: Without WebGL2, a screen-reader user hears 'Shift and arrows turn the surface', and pressing them does nothing.

Fix: Build the label from mode: in webgl, surfaceKeys; otherwise a new surfaceKeysStatic 'Arrow keys move the probe.'

## W1-70 · low
**The wire pass blends alpha non-premultiplied, so light-theme wires render pale instead of dark**

Files: apps/dashboard/src/app/pages/landing/heroGl.ts

#82. The context is premultiplied by default (:388), and blendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA) also blends alpha (:509-511, steel at :514). Wire pixels store a≈0.75, and the light well #F1F1EC shows through. Before and after renders confirm it.

Failure: In light theme the hero's wireframe draws pale grey-green over the surface, unlike the dark hairlines of the static projection.

Fix: g.blendFuncSeparate(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA, g.ONE, g.ONE_MINUS_SRC_ALPHA).

## W1-71 · low
**touch-action: pan-y on the hero stage blocks pinch-zoom, even in static mode where nothing can be dragged**

Files: apps/dashboard/src/app/pages/landing/GammaSurfaceHero.tsx

#83, upheld 2 of 3. GammaSurfaceHero.tsx:356 (stage) and :399 (canvas) set 'pan-y'. A Chromium Android repro shows a pinch starting on the stage keeps scale at 1, while 'pan-y pinch-zoom' allows 2.0.

Failure: A phone user pinches on the hero to read the 11px labels, and nothing zooms.

Fix: Use 'pan-y pinch-zoom' on the canvas, and on the stage only in webgl mode ('auto' otherwise).

## Fix batches (disjoint files)
- **api-public-data**: W1-02, W1-03, W1-08, W1-12, W1-23, W1-26, W1-27, W1-28, W1-29, W1-30, W1-31 — apps/api/src/services/public_data/mod.rs, apps/api/src/services/public_data/insider_trades.rs, apps/api/src/services/public_data/edgar.rs, apps/api/src/services/public_data/filed_figures.rs, apps/api/src/services/public_data/types.rs, apps/api/src/routes/public_data.rs
- **api-calendar**: W1-24, W1-25 — apps/api/src/services/public_data/calendar.rs
- **research-sec-frames**: W1-01, W1-05, W1-09, W1-10, W1-11, W1-13, W1-40, W1-41, W1-42 — apps/dashboard/src/app/pages/research/FiledFigures.tsx, apps/dashboard/src/app/pages/research/FilingsPage.tsx, apps/dashboard/src/app/pages/research/InsiderClusters.tsx, apps/dashboard/src/app/pages/research/NotePublicPanels.tsx, apps/dashboard/src/app/pages/ticker/public-desk/PublicDesk.tsx, apps/dashboard/src/app/pages/research/secState.ts
- **public-read-hook**: W1-04 — apps/dashboard/src/app/pages/research/publicData.ts, apps/dashboard/src/app/pages/research/publicData.spec.ts
- **coming-up**: W1-36, W1-37, W1-38, W1-39 — apps/dashboard/src/app/pages/research/ComingUpSection.tsx, apps/dashboard/src/app/pages/research/comingUp.ts, apps/dashboard/src/app/pages/research/comingUp.spec.ts
- **scanner-whats-live**: W1-07, W1-21 — apps/dashboard/src/app/pages/methodology/copy.ts, apps/dashboard/src/app/shared/dataState/marketData.ts, apps/dashboard/src/app/pages/scanner/ScannerNotLive.tsx
- **blog-shell**: W1-06, W1-22, W1-63, W1-64, W1-65, W1-66 — apps/dashboard/src/app/pages/blog/BlogPostPage.tsx, apps/dashboard/src/app/pages/blog/blog.spec.tsx, tools/build-dashboard.mjs, apps/dashboard/index.html, apps/dashboard/src/app/shell/CommandPalette/CommandPalette.tsx, apps/dashboard/src/app/shell/CommandPalette/CommandPalette.spec.tsx
- **alerts**: W1-14, W1-15, W1-16, W1-17, W1-18, W1-19, W1-44, W1-45, W1-46, W1-47, W1-48, W1-49, W1-50, W1-51, W1-52, W1-53 — apps/dashboard/src/app/features/alerts/useAlerts.ts, apps/dashboard/src/app/features/alerts/usePublicChecks.ts, apps/dashboard/src/app/features/alerts/publicRules.ts, apps/dashboard/src/app/features/alerts/publicRules.spec.ts, apps/dashboard/src/app/features/alerts/store.ts, apps/dashboard/src/app/features/alerts/BrowserNotifyControl.tsx
- **ticker-desk-panels**: W1-20, W1-43 — apps/dashboard/src/app/pages/ticker/technical-analysis/TradingViewDaily.tsx, apps/dashboard/src/app/pages/ticker/technical-analysis/TechnicalAnalysisLive.tsx, apps/dashboard/src/app/pages/ticker/public-desk/AiReadNotLive.tsx
- **trading**: W1-54, W1-55, W1-56, W1-57, W1-58, W1-59, W1-60, W1-61, W1-62 — apps/dashboard/src/app/features/trading/orders/useOrderEngine.ts, apps/dashboard/src/app/features/trading/broker/useBrokerMarks.ts, apps/dashboard/src/app/pages/positions/PositionsPage.tsx, apps/dashboard/src/app/features/trading/positions/PositionRow.tsx, apps/dashboard/src/app/pages/positions/netPl.ts, apps/dashboard/src/app/features/trading/positions/PositionCard.tsx
- **research-tools**: W1-32, W1-33, W1-34, W1-35 — tools/research-notes/filing-check.mjs, tools/research-notes/check-filings.mjs, research/README.md
- **landing-hero**: W1-67, W1-68, W1-69, W1-70, W1-71 — apps/dashboard/src/app/pages/landing/heroGl.ts, apps/dashboard/src/app/pages/landing/GammaSurfaceHero.tsx, apps/dashboard/src/app/pages/landing/copy.ts