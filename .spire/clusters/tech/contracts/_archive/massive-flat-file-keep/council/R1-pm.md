# R1 — pm position: massive-flat-file-keep

## Position

### Who this is for, and what job it does

The buyer is the **research operator / owner**, not the trader on Landing / Ticker / Positions /
Scanner. Convexa already keeps (a) same-day Path-A session-day tape for **SPY / QQQ / IWM** when
the live stocks path is up, (b) first-wins paid session books (greeks/IV/OI, start-of-day, not
open-to-close prints), and (c) a clock that can walk a **captured** tape on the existing ticker.
What it does **not** keep is the **entitled next-day stocks files** the $199+$199 plan already
includes. Cancel Massive after a day we never taped — or taped with gaps — and there is no
reconstructable **price/quote history** for that Tuesday unless we downloaded the files the plan
already entitled.

The job: **after the vendor publishes (~11:00 America/New_York the next calendar day), an
operator command stores the entitled stocks SIP trades, quotes, and session-bar aggregates for
the locked trio as a provenance-labeled research corpus**, extracted to those three names, so a
cancelled feed does not leave untaped or incompletely taped days without reconstructable
price/quote history. Coverage `present` still means a loadable live paid book. Production serve
without this construct still talks to Massive REST/WS. Score / tier / fingerprint stay
byte-identical (`Authorizes: nothing`). Kept files are **our research**, never a live vendor
feed, never `live_massive`.

This is a **next-day entitled-file keep**. It is not same-day tape, not ticker replay, not
greeks reconstruction, not OPRA, not trader chrome, and not a score change.

### Locked product rules (this slice)

| Lock | Product rule |
|---|---|
| **What the operator may claim they kept** | **Stocks SIP trades and stocks SIP quotes** for SPY / QQQ / IWM — that is the reconstructable **price/quote history** the brief names (prints **and** the quote/mid history the live desk anchors on). **Session-bar aggregates are also In**, as a **third entitled class**, because they are already paid for and they reconstruct the session’s price path at bar grain when a tick file is a miss or an empty extract. Aggregates **do not** count as trades or as quotes. The operator may claim “we kept trades / quotes / session-bar aggregates for (S, D)” only for the classes that actually occupy **kept**. They may **not** claim a live paid book, a same-day tape, OPRA, greeks/IV/OI, or a playable ticker day. |
| **OPRA / indices / crypto** | **Out this gate.** OPRA is options tape, not underlying price/quote history, and would invite “we kept the chain” while Plan History remains not applicable. Indices (`I:VIX` / `I:SPX`) and crypto are parked harvest, not the locked trio. I am **not** arguing them In. |
| **Store / occupancy class** | A **dedicated research corpus**, distinct from the session-day tape, session-archive bodies, 48/14-day ring, fixture, and replay occupancy. Mixing into the live session-day tape would make a next-day reconstruct look like a same-day capture and would let replay walk files this slice forbids converting. Occupancy classes stay distinct. |
| **Raw keep vs convert** | **Keep the watchlist extract. Do not convert into the session-day tape or the ticker replay player this slice.** Replay already walks the day-tape store. Conversion is a later product (it would change what “a taped Tuesday” means). Vendor day files are universe-per-day; the **durable occupant** is the **locked-name extract** per `(symbol, ET date, file class)`, not a promise to retain the entire US universe file forever. |
| **Credentials** | **Files-product access is a different credential class from the live REST/WS key.** The operator must provision the vendor’s file-access pair from the vendor dashboard. Reusing the live-feed key as the files secret is a **refuse**, not a fallback: a REST-only box is not keeping files, even when the live feed is healthy. Secrets never appear in list/load/CLI. Production without files credentials **does not fetch files**. Armed keep with missing files credentials **refuses**. |
| **Who sees it** | **Operator-only:** named keep/list command **and** a sibling `_research` list/load (token-gated, zero vendor on read). Pages trader origin still 404s the research family. **No trader chrome, no ticker player, no `/_ops` matrix, no Settings toggle.** Traders see nothing. `NO_UI_CHANGE`. |
| **When a day is due** | Session identity D is an **America/New_York calendar date**. Eligible session dates are **ET weekdays**. Vendor publish clock is **~11:00 ET the next calendar day** (D+1), including when D+1 is a weekend: **Friday D becomes due Saturday 11:00 ET**, not Monday. **Before** that checkpoint: **not-elapsed** — no fetch, not a miss. **At or after** that checkpoint, an entitled class not obtained: **miss**, not empty extract, not not-elapsed, not an empty live tape. Command does **not** sleep until due. |
| **Who invokes keep** | **Operator command** for a **named** locked symbol (or the closed trio) and a **named** completed ET session date D. **No unattended production poller** this slice. Serve without this construct does not fetch files. List/load of already-kept extracts may ride serve; **fetch does not**. |
| **Score / coverage / license** | **Authorizes: nothing.** Reconstructed files never insert as `LiveMassive` / coverage `present`. Kept files stay our research; never redistributed as a live vendor feed. |

Exchange-holiday weekdays stay **eligible** (same ET-weekday rule as tape and coverage). A
holiday with a published file that contains no rows for S is **empty extract**, not ineligible.
A holiday calendar is Future-dated.

### User stories

- **S1** — As the research operator, I want to **keep the entitled stocks SIP trades and quotes
  for SPY, QQQ, and IWM** for a named completed ET session date after the vendor publish clock,
  so that cancelling Massive does not leave days we never taped (or taped incompletely) without
  reconstructable **price/quote history**.
- **S2** — As the research operator, I want to **also keep entitled session-bar aggregates** for
  those same names as a **distinct class**, so a tick-file miss or empty extract still leaves
  reconstructable session **price** history at bar grain — without letting bars stand in for
  trades or quotes.
- **S3** — As the research operator, I want to **list and load** what was kept with **zero vendor
  calls**, including after the vendor is cancelled, so inspection does not re-bill and does not
  depend on a live subscription to remember Tuesday.
- **S4** — As the research operator, I want **not-elapsed ≠ miss ≠ empty extract ≠ unreadable ≠
  not-storing ≠ missing-files-credentials ≠ wrong-credential-class ≠ ineligible-weekend ≠
  not-in-watchlist ≠ live tape ≠ live paid present ≠ unauthorized**, so I never treat a clock as
  a hole, a quiet symbol as a missing file, or a reconstructed extract as a live book or a
  same-day tape.
- **S5** — As the desk owner, I want keep **fetch failure, store-down, missing files credentials,
  and production-unset** to leave bundle / scan / live stream / session-ensure intact, live
  ticks neither dimmed nor blanked, production still talking to Massive REST/WS, and score /
  tier / fingerprint **byte-identical**, so file keep cannot take down the desk or drift the
  score (`best-effort-isolated-or-null`, `production-fails-closed`,
  `additive-keeps-score-byte-identical`, `single-ticker-on-demand`).
- **S6** — As the desk owner, I want this corpus **off every trader path**, refused on the trader
  origin the same way existing research diagnostics already are, with **no extra vendor fetch on
  a research read**, and I want **file-access credentials to be a different secret from the live
  REST key**, so kept files stay **our research** and a REST-only deployment cannot pretend it is
  keeping files (`operator-vs-trader-path-separation`; `no-secrets-in-image`; Massive license).
- **S7** — As the archive/tape owner, I want a kept flat-file extract to be **unable to count as
  a live paid session book**, **unable to fill a coverage hole**, and **unable to occupy the
  session-day tape or the replay player**, so a next-day reconstruct cannot launder provenance
  into `present` or into “we taped Tuesday live.”
- **S8** — As a reviewer, I want **no convert-into-tape-player this gate**, **no OPRA / indices /
  crypto**, **no trader chrome**, and **no parked harvest** (Benzinga, hist-chain, public SaaS),
  so this ship cannot absorb the next cluster.

### Scope

#### In

- Operator-invoked keep for **named** `(SPY|QQQ|IWM, ET weekday date D)` or the **closed trio**
  for that D, **after** the vendor publish clock.
- Entitled **stocks SIP trades**, **stocks SIP quotes**, and **session-bar aggregates** as
  **three independent classes**. Durable occupant = **watchlist extract** per
  `(symbol, D, class)` with provenance **not** live Massive.
- Past due weekdays are keepable if the vendor still publishes the file (reconstruct is the
  point). No automatic date-range backfill this slice — operator names D.
- Dedicated research corpus / occupancy class, not mixed with session-day tape, session archive,
  ring, fixture, or replay.
- Honest occupancy including degraded states listed in S4; per-class independence (quotes miss
  does not rewrite trades kept).
- Named operator command to keep and to report occupancy; sibling `_research` list/load,
  operator-token gated, **zero vendor I/O on read**, Pages trader origin still 404s that family.
- Distinct files-product credentials; missing pair or live-feed key in the files slot **refuses
  keep** and does not fetch. Secrets never in list/load/CLI. Production unset does not fetch
  files. Armed keep with missing credentials or unwritable root **refuses**.
- Isolation: fetch/keep is **off the trader request path**; download fault never 5xxs the desk;
  live ticks not dimmed/blanked because keep ran or failed.
- Score / tier / fingerprint byte-identical; keep is never a scoring input.
- Keep must not write, promote, or occupy a session-archive identity as a live paid book;
  coverage holes stay holes; session-day-tape occupancy for `(S, D)` stays whatever the tape
  already was.
- Store path that would mix with tape / archive / ring **refuses** rather than mixing occupancy.
- Secret hygiene; local CLI evidence labeled **local**, not hosted/CI/production keep.
- Hermetic GATE Q: planted due extracts keep and load; not-elapsed does not fetch; miss / empty
  extract / unreadable / not-storing / credential refuses split; no live-paid insert; tape
  occupancy unchanged; score identity; trader-origin / token refuse; production-unset does not
  fetch.

#### Out

- Converting kept files into the **session-day tape** or walking them through the **ticker
  replay player** this gate.
- Inserting extracts as **`LiveMassive` / coverage `present`**.
- **OPRA** options trade/quote files; **indices** (`I:VIX` / `I:SPX`); **crypto** files.
- Expanding the watchlist beyond SPY / QQQ / IWM; universe-wide durable keep as the product
  occupant.
- Trader UI, nav, Settings, ticker chrome, player controls, `/_ops` keep matrix (`NO_UI_CHANGE`).
- Changing live scoring, tier, entry gate, fingerprint, scanner, or live REST/WS behavior.
- Reconstructing chain **greeks / IV / OI**; hist-chain; claiming Plan History applies.
- Unattended **production poller** that fetches files from serve / the trader request path.
- Redistributing kept files as a live vendor feed on any trader route.
- Mixing the corpus into session-archive bodies, the day-tape root, or the 48/14-day ring.
- Reusing the live REST/WS key as the files credential.
- Parked harvest: Benzinga earnings, news terminal, squeeze scanner, RL-on-score, public SaaS.
- `research-lab-surface`, `grounded-morning-snapshot`, `remote-archive-body-store`, telemetry
  SLOs, Kubernetes/Kafka.
- Declaring the session-corpus wait complete or authorizing a score change.

#### Future-dated

- Convert a kept extract into session-day-tape occupancy so replay can walk a reconstructed day.
- Unattended scheduled keep after the D+1 11:00 ET checkpoint (still off the trader request
  path; still not a live feed).
- OPRA / indices / crypto keep — only by explicit owner decision, never as a silent widening.
- Watchlist expansion beyond SPY / QQQ / IWM by explicit owner decision.
- Optional durable retain of the full-universe day file (this slice keeps the watchlist extract).
- Date-range keep (last N due weekdays in one invocation).
- NYSE/exchange-holiday calendar.
- Operator lab UI to browse the corpus (`research-lab-surface`).
- Daily-only aggregate rollup as an extra class (session-bar grain is the In aggregates claim).
- Remote object store for this corpus (production-maturity #6 is a different program).

### Product behavior

**Actors:** operator / maintainer at a keep command or research list/load. **Not** the trader.
**Not** the hosted production desk as a file CDN.

**Happy path**

| Situation | What must be true |
|---|---|
| ET weekday D, clock at or after 11:00 ET on D+1, files credentials present, keep store storing, operator names locked S (or the trio) | Keep obtains the entitled stocks SIP **trades**, **quotes**, and **session-bar aggregates** and stores a **watchlist extract** for each targeted name and class. Provenance is research / not live Massive. Operator can load reconstructable history for those classes. |
| Same keep, all three classes succeed for S | Occupancy is **kept** per class. The operator may claim all three. List/load shows three classes, not one blended “tape.” |
| Operator lists the corpus | Sees which locked names, dates, and classes are kept (and which are miss / empty extract / …) without trader UI and with **zero vendor calls**. |
| Operator loads a kept `(S, D, class)` (vendor still up **or** cancelled) | Extract loads with **zero vendor calls**. No live tick is synthesized. No session-day tape is written. |
| Second keep of an already-kept class | Occupancy stays **kept**. Provenance does not become live Massive. The extract is not copied into the session-day tape. |
| Production serve, this construct **unset** | Desk still talks to **Massive REST/WS**. **No files fetch.** Traders see nothing from this feature. |
| Trader desk during an operator keep | Bundle / scan / live stream / session-ensure unchanged. Live ticks still arrive. No keep chrome. Score / tier / fingerprint unchanged. |

**Degraded / edge states (each its own outcome — not footnotes on the happy path)**

| Situation | Observable outcome |
|---|---|
| Clock **before** 11:00 ET on D+1 for weekday D (including “today” before tomorrow 11:00) | **Not-elapsed.** Keep **does not fetch**. Not a miss. Not empty extract. Command does not wait until due. |
| Named ET date **strictly after** today ET | **Not-elapsed.** No fetch. Not a miss. |
| Clock at/after 11:00 ET on D+1, entitled class **not obtained** | **Miss.** Not not-elapsed, not empty extract, not unreadable, not an empty live tape. Operator may retry after due. |
| Vendor day file obtained, locked symbol has **zero rows** for that class | **Empty extract.** Not miss (we got the file), not unreadable, not kept-with-history. |
| Stored artifact exists but **cannot be loaded** as reconstructable history | **Unreadable.** Not empty extract, not miss, not not-storing. |
| Keep store disabled / root unset / unwritable | **Not-storing.** Desk still serves. No false kept success. Distinct from miss and from missing credentials. |
| Operator asks to keep, **files credentials absent** | **Refuse.** No files fetch. Distinct from not-storing and from miss. Armed keep does not pretend it stored. |
| Live REST/WS key offered as the **files** credential | **Wrong credential class — refuse.** No files fetch. Distinct from missing credentials. A healthy live feed does not imply files are being kept. |
| Trades kept, quotes **miss** (or any mixed pair, including aggregates vs ticks) | Classes stay **independent**. A kept aggregates extract does **not** rewrite quotes to kept. A kept trades extract does **not** imply quotes. |
| Already-kept class, later run would store empty or unreadable | **Already-kept wins.** Do not overwrite a reconstructable extract with a worse occupant. |
| ET Saturday or Sunday named as session D | **Ineligible weekend.** No expected keep. Not miss, not empty extract, not not-elapsed. |
| Friday D, Saturday 11:00 ET has arrived | Friday is **due**. Not still not-elapsed until Monday. |
| Name **not** SPY, QQQ, or IWM | **Not in keep watchlist.** No extract, no miss that implies we tried. |
| Keep / fetch **faults** after due (vendor down, truncated unusable file, write fail) | Desk **does not 5xx**. Occupancy is **miss** or **unreadable** as appropriate — not kept. No fabricated extract. |
| Networked research read without the operator token when a token is required | **Unauthorized.** Refused. No extract body. Trader session cookie is not the gate. |
| Trader origin / trader UI | **No** keep surface. Existing trader-origin 404/refusal of `_research` remains. Extracts are not redistributed as a market-data feed. |
| Research list/load asked to “just fetch it” or “just play it into the ticker” | **Does not.** Zero vendor I/O on read. No convert-into-tape. No replay this slice. |
| Session-archive coverage for `(S, D)` is missing | **Stays a hole.** Keeping or loading an extract does **not** insert a live paid book and does **not** flip coverage to present. |
| Session-day tape for `(S, D)` is missing / gapped / present | **Unchanged** by this keep. Extract occupancy is a different class. Replay still walks tape, not this corpus. |
| Production-profile or any profile, files construct **unset** | **Does not fetch files.** Live path still Massive. Not a silent miss grid for every historical weekday. |
| Armed keep, unwritable root or missing files credentials | **Refuses** (fail closed for the keep). Desk still up if serve is already running. |
| Configured keep path would **collide** with tape / archive / ring | **Refuse to mix.** Do not start a keep that would occupy those roots. |
| Holiday weekday, vendor file has no rows for S | **Empty extract** (eligible), not ineligible weekend. |
| Secrets in the environment | List/load/keep output contains **no** secret values. |
| Local CLI receipt | **Evidence: local.** Not labeled hosted / CI / production keep. |

**Closed product rules (binding)**

1. **Operator feature, not a trader feature.** No in-app trader surface this round.
2. **Closed trio only.** SPY, QQQ, IWM.
3. **Three entitled stocks SIP classes, independently claimed:** trades, quotes, session-bar
   aggregates. Aggregates never satisfy a trades or quotes claim. OPRA/indices/crypto never
   silently join the keep-set.
4. **Due = 11:00 America/New_York on calendar D+1.** Not-elapsed before; miss after if not
   obtained. Weekend session dates ineligible; Friday-due-Saturday is the calendar rule.
5. **Durable occupant = watchlist extract** in a **dedicated** occupancy class. Not live tape,
   not live paid present, not replay.
6. **Keep raw extracts; do not convert into the tape player this slice.**
7. **Files credentials ≠ live REST key.** Wrong class and missing pair refuse; production unset
   does not fetch.
8. **Operator-invoked keep. Zero vendor on read.** No unattended production poller this slice.
9. **Desk wins under failure.** Fetch stays off the trader request path.
10. **Authorizes: nothing** on live score.
11. **Massive license:** kept extracts remain our research, never a trader feed.
12. **Do not absorb** replay conversion, OPRA, lab UI, object store, hist-chain, or watchlist
    expansion.

### Acceptance criteria

Observable from **operator keep/list/load occupancy per `(symbol, ET date, file class)`, vendor-
call count, desk still serving, live ticks still flowing, coverage class unchanged, session-day
tape occupancy unchanged, production-unset not fetching, and score identity**. No source reading
required. `Verify by` is risk-based: `test` where silent regression is plausible; `review` where
the behavior is visible/intentional. Never one-test-per-AC. **(SB)** = ship-blocking.

| # | Story | Given / observable outcome | Verify by | Evidence |
|---|---|---|---|---|
| **AC-1 (SB)** | S1 | Given weekday D is due (clock ≥ 11:00 ET on D+1), files credentials present, and keep storing, an operator keep of locked S stores a **trades** extract for `(S, D)` that loads as reconstructable trade history for S on D. | test | Hermetic planted due trades file → loadable kept trades extract for S; rejecting: no plant → not kept. |
| **AC-2 (SB)** | S1 | Under the same due/storing preconditions, the keep stores a **quotes** extract for `(S, D)` that loads as reconstructable quote history for S on D — not trades-only. | test | Planted due quotes file → loadable kept quotes extract; trades-only plant does not mark quotes kept. |
| **AC-3 (SB)** | S2 | Under the same due/storing preconditions, the keep stores a **session-bar aggregates** extract for `(S, D)` as its own class that loads as reconstructable session-bar price history for S on D. | test | Planted due session-bar aggregates file → loadable kept aggregates extract; distinct class token from trades and quotes. |
| **AC-4 (SB)** | S1 | An operator keep targeting the closed trio for due D leaves SPY, QQQ, and IWM each with independently observable occupancy for each In class. | test | Trio plant: three names × three classes addressable; one name’s miss does not blank the others. |
| **AC-5 (SB)** | S2 | Occupancy is **per class**. A kept aggregates extract does not classify trades or quotes as kept; a kept trades extract does not classify quotes as kept. | test | Mixed fixture (aggregates kept, quotes absent after due) → aggregates kept, quotes miss — not one blended kept. |
| **AC-6 (SB)** | S1 | A name that is not SPY, QQQ, or IWM is **not in keep watchlist**: no extract is stored and the outcome is not a miss that implies we tried. | test | NVDA (or other off-list) keep → not-in-watchlist; no occupant; vendor-call count 0 for that name. |
| **AC-7 (SB)** | S7 | Kept extracts are labeled **research / not live Massive**. Operator list/load never presents them as `live_massive` / live paid. | test | Kept plant’s provenance/standing excludes live-paid literals; poison live-paid label on this corpus fails the gate. |
| **AC-8 (SB)** | S3 | Listing the corpus completes with **zero vendor calls** (files product and REST/WS). | test | List with vendor stub down / call counter 0 on kept, miss, empty extract, unreadable, not-elapsed, weekend, not-in-watchlist. |
| **AC-9 (SB)** | S3 | Loading a stored `(S, D, class)` completes with **zero vendor calls**, including on empty extract, miss, unreadable, not-elapsed, weekend, and not-in-watchlist paths. | test | Load matrix with vendor stub down; call counter 0 on every listed class. |
| **AC-10 (SB)** | S3 | After a kept Tuesday exists, a subsequent vendor-unavailable / cancelled condition still lets the operator list and load that Tuesday’s extracts with zero vendor calls. | test | Keep, then disable vendor → same extracts still load; no new files/REST call. |
| **AC-11 (SB)** | S4 | Given weekday D and clock **before** 11:00 ET on D+1, occupancy is **not-elapsed**; keep **does not fetch**; outcome is not miss, not empty extract, not unreadable. | test | Injected clock 10:59 ET D+1 → not-elapsed, files-call count 0; 11:00 ET D+1 is due. |
| **AC-12 (SB)** | S4 | A named ET date strictly after today America/New_York is **not-elapsed** (no fetch), not miss. | test | Future ET date plant → not-elapsed; call count 0. |
| **AC-13 (SB)** | S4 | Friday D is **due at Saturday 11:00 ET** (calendar D+1), not still not-elapsed until Monday 11:00 ET. | test | Injected Saturday 11:00 ET → Friday due; Saturday 10:59 → Friday not-elapsed; Monday clock is not required. |
| **AC-14 (SB)** | S4 | The keep command **does not sleep** until the due checkpoint; it reports not-elapsed and returns. | test | Before-due invocation returns without waiting for wall 11:00; still not-elapsed. |
| **AC-15 (SB)** | S4 | Given D is due and the entitled class is not obtained, occupancy is **miss** — not not-elapsed, not empty extract, not an empty session-day tape, not not-storing. | test | Due + vendor absent / no file → miss; clock rewind still not-elapsed on the same identity. |
| **AC-16 (SB)** | S4 | Given the vendor day file is obtained and locked S has **zero rows** for that class, occupancy is **empty extract** — not miss, not unreadable, not kept-with-history. | test | Planted universe file with no S rows → empty extract; load does not invent prints/quotes/bars. |
| **AC-17 (SB)** | S4 | Given a stored artifact for `(S, D, class)` that cannot be loaded as reconstructable history, occupancy is **unreadable** — not empty extract, not miss, not not-storing, not kept. | test | Planted corrupt occupant → unreadable; sibling class may remain kept. |
| **AC-18 (SB)** | S4 | When the keep store is disabled / unset / unwritable, occupancy is **not-storing** — not a grid of misses, not empty extract, not kept. Desk still serves. | test | Unwritable/unset root → not-storing; bundle/scan/SSE still succeed. |
| **AC-19 (SB)** | S6 | Given the operator asks to keep and the **files credential pair is absent**, keep **refuses**, **does not fetch**, and does not record kept. Distinct from not-storing and from miss. | test | Armed keep, files credentials unset → refuse, files-call count 0; not miss; not kept. |
| **AC-20 (SB)** | S6 | Given the live REST/WS key is supplied as the **files** credential, keep **refuses** as **wrong credential class**, **does not fetch**, and does not record kept. Distinct from missing credentials. | test | Live-feed secret in files slot → refuse; files-call count 0; missing-pair fixture still a different class. |
| **AC-21 (SB)** | S4 | An ET Saturday or Sunday named as session D is **ineligible weekend**: not miss, not empty extract, not not-elapsed, not not-storing. | test | Saturday D plant → ineligible; no fetch. |
| **AC-22 (SB)** | S4 | A holiday weekday remains eligible: a published file with no rows for S is **empty extract**, not ineligible weekend. | test | Weekday plant with zero rows → empty extract, not weekend class. |
| **AC-23 (SB)** | S4 | Not-elapsed, miss, empty extract, unreadable, not-storing, missing-files-credentials, wrong-credential-class, ineligible-weekend, not-in-watchlist, unauthorized, kept, live-tape, and live-paid-present outcomes are distinguishable in operator keep/list/load without reading source. Coverage `present` / `missing` / `not yet due` / `blocked occupancy` never appear as this corpus’s occupancy. Session-day-tape literals never appear as this corpus’s occupancy. | test | One fixture matrix: each class prints a distinct operator outcome; banned coverage/tape literals absent on this vehicle. |
| **AC-24 (SB)** | S1 | A second keep of an already-kept class leaves occupancy **kept**, does not relabel provenance live Massive, and does not write a session-day-tape occupant. | test | Keep twice → still one kept research occupant; tape store for `(S, D)` unchanged; no live-paid insert. |
| **AC-25 (SB)** | S4 | A due **miss** may become **kept** on a later operator keep after due once the file is obtainable; an already-kept extract is **not overwritten** by a later empty extract or unreadable blob. | test | Miss then plant file → kept; kept then plant empty/corrupt → still kept reconstructable. |
| **AC-26 (SB)** | S5 | If keep fetch or write fails after due, bundle / scan / live stream / session-ensure still succeed; occupancy is not kept; no false stored success. | test | Forced fetch/write fault → desk 200/SSE intact; occupancy miss or unreadable; skip/refuse visible to operator. |
| **AC-27 (SB)** | S5 | Keep / fetch runs **off the trader request path**. A ticker/bundle request does not download files. | test | Ticker/bundle exercise during/after keep → files-call count on that path is 0; keep remains operator-invoked. |
| **AC-28 (SB)** | S5 | While keep runs or fails, live ticks for the desk continue to arrive; they are not blanked, and live-derived trader UI is not dimmed **because keep is running or failed**. | test | Keep success and keep fault fixtures: live stream still delivers; no keep-caused offline/dim. |
| **AC-29 (SB)** | S5 | For the same market inputs, opportunity score, tier, and state fingerprint are byte-identical with this construct present vs absent and with keep succeeding vs failing. | test | Same-input triple identical across keep on/off and success/fail; scoring-path isolation. |
| **AC-30 (SB)** | S5 | Production serve **without this construct** (files keep unset) **does not fetch files** and still talks to Massive REST/WS on the live path. | test | Unset-construct serve → files-call count 0; live REST/WS still used for the desk. |
| **AC-31 (SB)** | S5 | Armed keep with missing files credentials or unwritable root **refuses** (fail closed for keep). It does not fetch, does not record kept, and does not 5xx the desk. | test | Armed missing-keys and unwritable-root plants each refuse; call count 0; desk up. |
| **AC-32 (SB)** | S7 | If the configured keep path would collide with session-day tape, session-archive index/body, or the 48/14-day ring, keep **refuses to mix** rather than occupying those roots. | test | Collision plant → refuse; tape/archive/ring contents unchanged. |
| **AC-33 (SB)** | S7 | Writing or loading an extract does **not** insert a session-archive identity and does **not** classify that identity as a live paid **present** book. | test | Keep/load plant → coverage `present` count unchanged; no new live-paid occupant. |
| **AC-34 (SB)** | S7 | Given session-archive coverage for `(S, D)` is missing, keeping or loading extracts for `(S, D)` leaves that coverage cell **missing**. | test | Coverage-missing fixture survives keep; cell still missing, not blocked occupancy from this extract. |
| **AC-35 (SB)** | S7 | A reconstructed / flat-file occupant is never accepted as a live paid session book; coverage/audit of session books does not exit as all-present on the strength of this corpus. | test | Extract occupant offered as live paid → rejected; coverage audit not all-present. |
| **AC-36 (SB)** | S7 | Session-day-tape occupancy for `(S, D)` is **unchanged** by keep/list/load of this corpus (missing tape stays missing tape; a taped day stays tape, not replaced by extracts). | test | Tape-missing and tape-present fixtures survive keep; tape list/load literals unchanged. |
| **AC-37 (SB)** | S8 | This ship does **not** convert extracts into session-day-tape occupancy and does **not** play them into the ticker live path / replay player. | test | After keep, replay/tape walk still has no new tape occupant from extracts; ticker live path receives no extract ticks. |
| **AC-38 (SB)** | S8 | This ship does **not** download or keep OPRA options files, index files, or crypto files. | test | OPRA/index/crypto plant or request → refused / not stored; stocks SIP classes unaffected. |
| **AC-39 (SB)** | S8 | This ship does **not** start an unattended production poller that fetches files from serve. Serve may list/load already-kept extracts; it does not keep on a timer this slice. | test | Serve process with construct configured for read → files-fetch count 0 until operator keep; no interval fetch. |
| **AC-40 (SB)** | S6 | `apps/dashboard` trader surfaces gain **no** new route, nav item, Settings copy, Ask-AI line, Ticker/LiveTape/Scanner/Positions/Landing affordance, tooltip, or toast mentioning flat-file keep, S3 files, next-day CSV, or reconstructed tape. | test | Structural empty-diff / copy-table scan of trader surfaces. |
| **AC-41 (SB)** | S6 | Trader empty / error / offline / `unavailable this cycle` / `—` / LiveTape copy is **byte-unchanged** by keep success, keep refuse, list, load, miss, empty extract, unreadable, or not-storing. | test | Trader copy snapshot identical across keep fixtures. |
| **AC-42 (SB)** | S6 | Pages trader origin still **404s** `/api/_research` and `/api/_metrics` (and subpaths), including any keep sibling under those prefixes. Extracts are not proxied to the trader origin. | test | Pages origin 404 on research/metrics family including keep sibling. |
| **AC-43 (SB)** | S6 | `/_ops/metrics` gains **no** keep matrix, keep chip, or stage named from this feature. Unknown JSON stays unrendered. | test | Operator-metrics closed stage set; keep JSON not rendered as p50/p95/`—`. |
| **AC-44 (SB)** | S6 | A trader origin cannot obtain a keep list or extract body (refused the same way existing operator/research diagnostics are refused on that origin). | test | Trader-origin keep read → refuse, no body. |
| **AC-45 (SB)** | S6 | When an operator token is required, a keep/corpus read without it is unauthorized and returns no extract body. Trader session cookie is not the gate. | test | Missing token → 401-class unauthorized, empty body; session cookie does not pass. |
| **AC-46 (SB)** | S6 | No trader-facing product path redistributes kept extracts as a market-data feed. | test | Trader ticker/scan/SSE/bundle do not carry extract bodies or a live-feed framing of this corpus. |
| **AC-47 (SB)** | S6 | Canary secret values present in the environment (files credentials and REST key) do not appear in extract bodies or keep/list/load/CLI output. | test | Canary secrets absent from operator output and stored extract payload. |
| **AC-48 (SB)** | S3 | CLI standing includes **Evidence: local** and closing that a local keep/list is **not** hosted/CI/production keep. Deleting surrounding prose cannot remove that standing from the emitted result. A local receipt is not labeled hosted. | test | CLI emission contains the local-evidence standing; hosted/CI/production-verified labels absent. |
| **AC-49 (SB)** | S6 | No new named trader dashboard route or screen was chosen. Product carries `NO_UI_CHANGE`; no `DESIGN_SYSTEM.md` amendment. **This row does not certify** trader-chrome absence, Pages 404, or `/_ops/metrics` non-render (those are AC-40–43). | review | SPEC/product `NO_UI_CHANGE`; no design-system amendment; QA records the non-choice. |
| **AC-50** | S8 | This ship does not add a research-lab UI, move session-archive bodies to a remote object store, expand the watchlist, ingest Benzinga, buy hist-chain, or stand up a public SaaS feed. | review | Diff/scope review: those parked items absent. |
| **AC-51** | S3 | Operator can keep/list/load **without** the trader UI (CLI and/or Railway-direct operator research read). | review | QA exercises CLI and/or operator research read with trader UI unused. |
| **AC-52** | S3 | License one-liner present on research read / CLI: kept files are **our research, not redistributed on a trader route.** | review | License sentence present on operator read; not on trader chrome (there is none). |
| **AC-53** | S4 | Standing-block wording, is/is-not block, glossary sentences, and banned-term table (no `live` badge, no “complete tape,” no coverage `present` on this corpus, no “bars = quotes”) are the approved copy. | review | UX-owned copy in SPEC §4 matches these distinctions; QA reads the standing block. |

**Method notes (risk-based).**

- **`test` owns silent honesty / money / license / desk failures:** trades+quotes+aggregates as
  independent classes (AC-1–5), closed watchlist (AC-6), provenance not live paid (AC-7,
  AC-33–35), zero vendor on list/load and after cancel (AC-8–10), due clock including
  Friday→Saturday calendar D+1 and no-sleep (AC-11–14), absence splits (AC-15–23, AC-25),
  credential class split (AC-19–20), idempotent kept vs overwrite (AC-24–25), desk isolation
  and off-request fetch (AC-26–28), score identity (AC-29), production-unset and armed refuse
  (AC-30–31), store collision (AC-32), tape occupancy unchanged and no convert/replay
  (AC-36–37), no OPRA/poller (AC-38–39), trader-origin / Pages / token / copy silence
  (AC-40–46), secret egress (AC-47), local-vs-hosted evidence (AC-48). These can die under a
  “helpful” REST-key reuse, a bars-only keep labeled as quotes, a Monday due clock that hides
  Friday misses, a mix into the day-tape root, a serve poller, or a coverage green on a
  reconstructed occupant.
- **`review` owns** product non-choice of a dashboard route (AC-49 — does **not** replace
  AC-40–43), non-absorption of parked harvest (AC-50), operator-without-UI exercise (AC-51),
  license presence (AC-52), and intentional standing/glossary copy (AC-53).
- Prefer **one** hermetic pass: inject ET clock → before D+1 11:00 not-elapsed and no files
  call → at 11:00 due → plant trades+quotes+session-bar files for SPY/QQQ/IWM → three classes
  kept and independently loadable → NVDA not-in-watchlist → plant quotes absent after due →
  quotes miss while trades kept → plant universe with zero IWM rows → IWM empty extract →
  plant corrupt QQQ aggregates → unreadable, not empty → Friday/Saturday clock due rule →
  live-feed key in files slot refuses with zero files calls → missing files credentials
  distinct refuse → unset root not-storing, desk up → collision with tape root refuses →
  coverage missing stays missing, tape occupancy unchanged, no ticker ticks from extracts →
  load with vendor stub down still loads → score triple identical → unauthorized / Pages 404
  / canary secrets absent / Evidence: local. Not a named micro-harness per row.
- GATE Q must show **both** a rejecting path (not-elapsed no fetch, wrong credential refuse,
  miss ≠ empty extract, extract does not mint live paid present, tape occupancy unchanged,
  weekend is not miss, OPRA not stored) **and** an accepting planted due keep of all three
  classes for the trio. A suite that only ever lists a happy kept trades file has not proved
  the gate.
- No DOM harness. Observability is operator keep/list/load, vendor-call count, desk + live
  ticks + score identity, coverage class unchanged, tape occupancy unchanged. Trader silence
  is structural (empty-diff / copy-table scan, Pages 404, OperatorMetrics closed stage set).
- Convert-into-player, OPRA, and unattended poller are Out: AC-37–39 fail if any lands in this
  ship, even as a “small hook.”

**Ship-blocking set:** AC-1–AC-49. AC-50–AC-53 are required scope-honesty / copy checks
(`review`).

### Product decisions locked in this position

1. **Audience = research operator.** Trader UI is out (`NO_UI_CHANGE`).
2. **Watchlist = SPY, QQQ, IWM.** Same liquid corpus as session books, coverage, tape, and
   replay. Expansion is Future + owner.
3. **Keep-set = stocks SIP trades + quotes + session-bar aggregates**, independently occupied
   and independently claimed. I am **arguing aggregates In** (already entitled; bar-grain
   insurance; must not satisfy a quotes claim). I am **not** arguing OPRA/indices/crypto In.
4. **Due clock = 11:00 America/New_York on calendar D+1**, including Friday→Saturday. Not-elapsed
   before; miss after if not obtained. No holiday calendar this slice.
5. **Durable occupant = watchlist extract** in a **dedicated store/occupancy class**. Full
   universe file is not the product occupant. Session-day tape is not the product occupant.
6. **No convert into tape/replay this slice.** Keep is not playback.
7. **Files credentials are a new class.** Live REST key must not open this door. Production
   unset does not fetch. Armed missing keys refuse.
8. **Operator-invoked keep.** Unattended serve poller is Out. Research read is zero-vendor,
   token-gated, trader-origin-refused.
9. **Historical due days are in:** operator may name a past weekday. Vendor gone → miss. This
   is not tape’s forward-only capture.
10. **Desk wins; live ticks stay live; score unchanged; coverage holes stay holes; tape stays
    tape.**
11. Architect names files-client mechanism and extract mechanics. Product binds: three classes,
    dedicated occupancy, credential split, due clock, no mix with tape, no live-paid insert.
12. UX owns exact operator wording for the occupancy classes. Product owns that those classes
    exist, are mutually distinguishable, and that bars cannot read as quotes / extracts cannot
    read as live tape or live paid present.

### Binding constraints restated

- **`present-is-live-paid-only` (HARD):** reconstructed S3/flat-file occupants never insert as
  `LiveMassive` / coverage `present`.
- **`additive-keeps-score-byte-identical` / Authorizes: nothing:** keep is never a scoring
  input. Formula, tier, gate, fingerprint basis unchanged.
- **`absent-is-not-none`:** not-elapsed ≠ miss ≠ empty extract ≠ unreadable ≠ not-storing ≠
  missing-files-credentials ≠ wrong-credential-class ≠ ineligible-weekend ≠ not-in-watchlist ≠
  live tape ≠ live paid present ≠ unauthorized.
- **`operator-vs-trader-path-separation`:** CLI + `_research`; Pages still 404; no ticker player
  chrome; fetch off the trader request path.
- **`local-evidence-is-not-hosted-evidence`:** a local planted-keep receipt is not production
  “we kept every Tuesday after cancel.”
- **`production-fails-closed`:** armed keep with missing files credentials or unwritable root
  refuses; production unset does not fetch files.
- **`best-effort-isolated-or-null`:** download/keep fault never 5xxs the desk.
- **`single-ticker-on-demand`:** fetch is off the trader request path.
- **`no-secrets-in-image`:** files access/secret and REST key never in list/load/CLI.
- **`structural-over-prose-enforcement`:** poison a live-paid insert from extracts → gate red;
  poison REST key as files secret succeeding → red; poison not-elapsed as miss → red; poison
  aggregates-kept as quotes-kept → red; poison mix into tape root → red. Poison tests must be
  non-vacuous.
- **`cited-code-is-verified-not-assumed`:** this position does not assert reusable source
  locations. Mechanism reuse is an architecture assumption below.
- **Massive license:** kept files are our research, never redistributed as a live vendor feed.
- **Do not reopen** parked harvest (Benzinga, hist-chain, indices, public SaaS).

## Risks I see

- **Quotes dropped “because trades reconstruct price.”** The live desk anchors on mid. A
  trades-only keep fails the price/**quote** history promise. AC-2, AC-5.
- **Aggregates standing in for ticks.** Operator reports “we kept the tape” when they only have
  bars. AC-3, AC-5, AC-53.
- **Aggregates quietly Out to save work** without an R2 fight. I will not pre-concede S2. If
  architecture cannot keep session-bar aggregates without a new vendor SKU, that is an R2
  conflict — not a silent trades+quotes narrowing.
- **Due clock uses next weekday** so Friday stays not-elapsed through the weekend and Monday
  looks like the first chance to notice a miss. AC-13.
- **Not-elapsed collapsed into miss** (or the reverse): operator treats a clock as a hole or
  ignores a real unpublished file. AC-11, AC-15, AC-23.
- **Empty extract collapsed into miss:** “the vendor failed” when the name simply had no rows.
  AC-16.
- **REST live key reused as files secret** and a green path that never actually kept a file —
  or worse, a path that sends the live key to the files product. AC-19–20.
- **Mix into session-day tape** so replay walks reconstructed files and coverage/tape honesty
  dies. AC-32, AC-36–37.
- **Extract counted as live paid present** so coverage greens a hole. The failure coverage
  shipped to stop. AC-33–35.
- **Convert-into-player absorbed** because replay just shipped and “the files are right there.”
  AC-37. That is a different product (what “taped Tuesday” means).
- **Unattended serve poller** that fetches on production, 5xxs the desk, or turns the hosted
  origin into a files CDN. AC-30, AC-39, AC-46.
- **Universe-wide durable keep** labeled as SPY/QQQ/IWM keep — license/redistribution and
  storage pretending three names were the occupant. Durable occupant is the extract (In).
- **OPRA/indices sneak In** as “the $199 options plan includes files too.” Different claim.
  AC-38.
- **Read path fetches the vendor** “to refresh” — cancel then breaks the thing we kept.
  AC-8–10.
- **Trader-path creep** (a “history” widget, reconstructed-tape hook, research prefix opened on
  Pages). AC-40–46.
- **Local receipt labeled hosted/production keep.** AC-48.
- **Partial overwrite:** a later empty vendor file destroys a good extract. AC-25.
- **Unobservable criteria.** If synthesis rewrites rows into “files work” intentions that
  require reading source, those rows should be cut or restated — not kept for theater.

## Assumptions I'm making about the other two lanes

- The architecture lane can authenticate to the vendor **files product** with a **distinct
  credential pair** (dashboard file-access key + secret) and can **refuse** when that pair is
  missing or when the live REST/WS key is placed in the files slot, with **zero files fetch** on
  those refuses (AC-19, AC-20). If the only implementable door is “reuse the REST key,” that
  contradicts the credential lock and must be an R2 conflict — I will not silently allow REST
  reuse.
- The architecture lane can, after due, obtain entitled **stocks SIP trades, quotes, and
  session-bar aggregates** day files and persist a **watchlist extract** for exactly SPY/QQQ/IWM
  without making the full-universe day file the durable product occupant (AC-1–4). If session-bar
  aggregates require a new paid SKU we do not have, architecture must contradict AC-3 at R2 — I
  will not drop S2 to avoid that fight.
- The architecture lane can keep those three classes as **independently occupied artifacts**
  whose operator-visible occupancy cannot collapse (AC-5, AC-23). If the store can only hold one
  blob per `(S, D)`, that is an R2 conflict against per-class claims — I will not accept
  bars-only as “the keep.”
- The architecture lane can name a **dedicated corpus root** that is structurally not the
  session-day tape root, not the session-archive body/index, and not the 48/14-day ring, and can
  **refuse on collision** (AC-32, AC-36). If the only cheap store is the tape root, that
  contradicts the occupancy lock and is an R2 conflict — I will not let extracts occupy live
  tape.
- The architecture lane can inject an **America/New_York clock** so not-elapsed vs due, Friday
  D due Saturday 11:00 ET (calendar D+1, not next weekday), future dates, and weekend
  ineligibility are testable without waiting for wall time (AC-11–14, AC-21).
- The architecture lane can prove **zero vendor calls on list/load** (files product and REST/WS)
  with hermetic fixtures and a vendor stub down, including after a simulated cancel (AC-8–10),
  and can prove **production-unset does not fetch files** while live REST/WS still serves the
  desk (AC-30).
- The architecture lane can keep fetch **off** the trader request path and **isolated** from
  bundle / scan / live stream / session-ensure, including on fetch/write failure and store-down
  (AC-26–28). If keep cannot be isolated, that is an R2 conflict — I will not drop desk
  isolation to ship the corpus.
- The architecture lane will **not** convert extracts into session-day-tape occupancy or emit
  them on the ticker live/replay path this slice (AC-37). If architecture “hooks replay because
  the files are there,” that contradicts S8 and is an R2 conflict — I will not silently narrow
  “no convert” into “small player hook.”
- The architecture lane will verify **live Rust** REST/WS + tape root + source-kind surfaces
  cited in the brief — not Python-era paths, not briefing HTML as an oracle
  (`cited-code-is-verified-not-assumed`). This position does not assume filenames, types, SDK
  choice, or route spellings.
- The architecture lane can prove score / tier / fingerprint byte-identity and no live-paid
  insert without Massive credentials in the build environment (AC-29, AC-33–35).
- The architecture lane can name **one** operator-token, zero-vendor, trader-origin-refused
  transport for list/load in the existing `_research` / operator diagnostic family. I am **not**
  picking the path spelling. If the only way to see a kept day is a trader-linked surface, that
  is an R2 conflict, not a quiet CLI-only narrowing of S3/S6.
- The UX / tech-writer lane will design **no trader UI and no ticker/replay chrome**. If UX
  proposes a dashboard, nav item, ticker “history from files” widget, reconstructed-tape
  scrubber, or in-app lab browser, that contradicts this Out list and
  `operator-vs-trader-path-separation`, and I will raise it as a conflict at R2.
- The UX / tech-writer lane owns exact operator wording for: kept · not-elapsed · miss · empty
  extract · unreadable · not-storing · missing-files-credentials · wrong-credential-class ·
  ineligible-weekend · not-in-watchlist · unauthorized · “research extract, not a live paid
  session book, not session-day tape.” I own only that those distinctions exist, are mutually
  distinguishable as words, that **aggregates cannot read as quotes or trades**, and that
  extracts/fixtures/reconstructions cannot read as live paid present or as live tape.
- The UX / tech-writer lane can keep keep/list/load copy from implying a hosted production pass,
  a score-change authorization, a trader-facing “history” product, that bars equal the tick
  tape, or that a session-archive hole / tape gap was filled.
- The UX / tech-writer lane will not specify layout, motion, or ticker placement, because there
  is no trader presentation this slice; operator-facing research copy, occupancy vocabulary,
  license one-liner, and local-evidence standing are the UX surface.
