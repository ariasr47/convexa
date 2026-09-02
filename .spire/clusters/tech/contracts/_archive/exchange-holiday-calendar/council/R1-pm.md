# R1 — pm position: exchange-holiday-calendar

## Position

### Who this is for, and what job it does

The buyer is **the operator who already trusts weekend occupancy, and the desk that already
trusts session standing**, not a new persona. Convexa already treats **Saturday and Sunday** in
America/New_York as **not due / ineligible**: coverage does not demand three paid books, tape and
keep do not treat a quiet weekend as a hole or as a successful empty extract, liquid-name ensure
does not wake SPY/QQQ/IWM, the scanner market-hours gate idles without looking dead, and live
session standing is not regular trading hours. What it does **not** do is apply that same honesty
to a **weekday NYSE is fully closed** (Thanksgiving, a weekday Christmas, an observed Independence
Day, …). Today those closed weekdays are still “session days”: coverage can print **missing**,
keep can print **empty extract**, tape can print **empty stored day**, ensure can pay for a book,
the scanner can sweep as if the floor is open, and at 10:00 ET the desk can look like a live
regular session.

The job: **make NYSE full-day holidays a first-class not-due / ineligible occupancy the same
family as Sat/Sun**, so a closed weekday is not a missing paid book, not an empty extract, not a
coverage hole, not an ensure wake, and not a live regular session. Decision impact is whether the
operator **and** the desk **trust occupancy on a market holiday**. A normal weekday stays due /
eligible. Sat/Sun behavior is unchanged. `Authorizes: nothing`.

This is **occupancy honesty on an already-shipped weekend path**. It is not a vendor holiday API,
not a holiday-admin UI, not a score change, not early-close hours, not a new trader surface, not
`/lab`, and not a lift of the Pages trader-origin refusal of the research family.

### Locked product rules (this slice)

| Lock | Product rule |
|---|---|
| **What a holiday weekday is** | An **America/New_York civil date** that is **Monday–Friday** and on which **NYSE is fully closed all day** (including a **weekday observance** when the named calendar holiday falls on a weekend). That date is **not a session day**. |
| **What it is not** | **Saturday or Sunday** (those stay **weekend**). A **half-day / early-close** weekday (the floor is open, then stops early). A weekday **the closed set does not name**. A bond-only closure while NYSE is open. Crypto / other-venue calendars. |
| **Family** | Same occupancy **family** as weekend: **not due / ineligible**, empty expected, **not a pass**, **not a miss**, **not an empty-extract success**, **not a live paid present**. |
| **Print** | **Holiday is not weekend.** Thanksgiving must not read as Saturday. Saturday must not read as a holiday weekday. Same family, **distinct reason**. Poisoning a holiday weekday as Sat/Sun-ineligible must go red. |
| **One answer** | **One** America/New_York full-day-holiday answer. Coverage, tape, keep, liquid-name ensure, scanner market-hours, and live session standing **must not disagree** about whether ET date D is a NYSE full-day holiday. |
| **Source of the answer** | A **finite in-process NYSE full-day set**. **No vendor fetch** to classify a date. Dates **in** the set are holiday weekdays. Dates **not** in the set are **not** holidays — including a Thursday a human remembers as closed. There is **no** “holiday unknown” class that hides a hole. |
| **Vehicles that consume it** | Every vehicle that **already** has a weekend gate: **coverage**, **session-day tape**, **flat-file keep**, **liquid-name ensure**, **scanner market-hours idle**, **live session standing**. No new corpus. No new operator URL. |
| **Coverage window** | On holiday weekday D the expected set is **empty** (weekend-class empty expected): **not** three missing cells, **not** three ineligible cells, **not** a coverage pass. Hole warnings do not fire. Audit / coverage standing is **not due**, never **pass n/n present**. |
| **Today-before-checkpoint** | If **today** ET is a holiday weekday, that is **empty expected / not due**, **not** “not yet due until 16:00” (that standing means a session is still in progress). 16:00 ET remains the due clock **only** for session weekdays. |
| **Tape** | Holiday weekday D is **ineligible**: no expected tape. Not empty-while-storing, not a no-tape hole, not a coverage miss word. |
| **Keep** | Holiday weekday D is **ineligible**: **no fetch**. Not miss, **not empty extract**. This **inverts** the shipped keep claim that a holiday weekday with zero rows is empty extract. CLI / inspect of that date is **not** a keep outage. |
| **Ensure** | Does **not** wake SPY/QQQ/IWM for holiday weekday D. Does **not** insert or promote a live paid session book for that identity. |
| **Session standing** | At **10:00 America/New_York** on holiday weekday D, live session standing is **not regular trading hours**. It is the **closed** family, **not** “in a covered session but ticks are not arriving / feed-lag (or maybe a holiday).” Holiday-closed and feed-lag must not be the same standing. |
| **Scanner** | The **existing** market-hours gate treats a holiday weekday like a weekend: **idle the sweep**, **keep the heartbeat** so idle ≠ worker-dead. No separate holiday kill-switch. Gate off ⇒ holiday sweeps the same way weekend would. |
| **Fail toward a session** | A date the set does **not** name, or a holiday answer that **cannot be evaluated**, is **not** classified as a known full-day holiday. Coverage compute failure stays **coverage failed**, not empty-expected holiday. Scanner lookup failure **fails open** (existing: keep sweeping), never silent-stop. |
| **Audience / chrome** | Occupancy words stay on **existing** operator prints (coverage, tape, keep) and **existing** trader session standing. **No new trader nav. No new operator URL. `/lab` still demos. Pages trader origin still refuses the research family.** This is **not** `NO_UI_CHANGE`: lying session standing is in the observed-by. It **is** no new surface. |
| **Names** | Liquid occupancy remains **SPY, QQQ, IWM** where those vehicles already lock the trio. Scanner idle applies to the **existing** sweep, not a new universe. |
| **Score / license** | **Authorizes: nothing.** Holiday is never `present` / never a fabricated live paid day. Local holiday classification is **not** hosted/CI/production coverage. |

**Half-days are Future, not In.** An early-close weekday still has a morning session: a book is
due, tape/keep are expected, ensure may wake, session standing may be regular hours while the
floor is open. Folding early close into full-day ineligible would **fabricate not-due** for a
session that exists. That is a worse lie than today’s residual (scanner may keep sweeping until
the usual end of the window). I will not silently narrow “holiday” to include half-days to make
the set look complete.

### User stories

- **S1** — As the archive operator, I want a known NYSE full-day holiday ET date to be **not
  due** for SPY/QQQ/IWM coverage — **empty expected**, not three missing cells, not a coverage
  pass — so Thanksgiving does not look like we lost three paid books.
- **S2** — As the tape operator, I want that same date to print **ineligible** (holiday, not
  weekend), not empty-while-storing and not a no-tape hole, so a closed weekday is not a failed
  capture day.
- **S3** — As the keep operator, I want that same date to be **ineligible** with **no fetch** —
  not miss, **not empty extract**, not weekend — so a published file with zero rows (or a 404)
  cannot certify a holiday as a successful empty session.
- **S4** — As the desk owner, I want liquid-name ensure to **stay asleep** on that date and to
  **create no live paid book** for it, so we do not pay for a session NYSE did not hold
  (`present-is-live-paid-only`, `single-ticker-on-demand`).
- **S5** — As a trader on the ticker, I want **10:00 ET on that weekday** to be **not regular
  trading hours**, and **not** the in-session feed-lag standing, so a closed market is not
  presented as a live regular session.
- **S6** — As the scanner operator, I want the **existing** market-hours gate to **idle** that
  weekday the way it already idles a weekend, with heartbeat still proving the worker is alive,
  so we do not sweep a closed floor and do not look dead.
- **S7** — As the operator, I want **holiday ≠ weekend ≠ miss ≠ empty extract ≠ empty stored
  tape ≠ not-yet-due session weekday ≠ not-storing ≠ unreadable ≠ early-close ≠ unlisted
  weekday**, so I never treat a closed Thursday as Saturday, and never hide a real Tuesday hole
  behind “maybe holiday” (`absent-is-not-none`).
- **S8** — As the desk owner, I want this change **off the ticker request path**, **zero vendor
  holiday fetch**, **Pages research refusal intact**, **`/lab` still demos**, **no new trader
  nav**, and **score / tier / fingerprint byte-identical**, so occupancy honesty cannot bill
  Massive, cannot become a public calendar API, and cannot retune the score
  (`operator-vs-trader-path-separation`, `additive-keeps-score-byte-identical`,
  `single-ticker-on-demand`).
- **S9** — As a reviewer, I want **half-days out**, **Sat/Sun unchanged**, **one shared holiday
  answer**, and a **poisoned holiday-as-weekend (and holiday-as-miss / empty-extract / regular
  hours)** to go red, so this ship cannot absorb early-close hours or a vendor calendar
  (`structural-over-prose-enforcement`).

### Scope

#### In

- NYSE **full-day** closures on **ET weekdays**, including **observed weekdays** when the named
  holiday falls on a weekend.
- **One** in-process full-day-holiday answer, **no vendor fetch**, consumed by vehicles that
  **already** weekend-gate: coverage, session-day tape, flat-file keep, liquid-name ensure,
  scanner market-hours idle, live session standing.
- Coverage: holiday weekday = **empty expected / not due**; not three missing cells; not a
  coverage pass; no hole warning for those identities; existing operator coverage standing
  (including the research-URL coverage read) **must not re-derive “Thursday ⇒ three due cells.”**
- Tape: holiday weekday = **ineligible** (holiday reason, not weekend); not empty-while-storing;
  not a no-tape hole.
- Keep: holiday weekday = **ineligible**, **no fetch**; not miss; **not empty extract**; not
  weekend. Shipped keep claim that a holiday weekday with zero rows is empty extract **is
  withdrawn and inverted**.
- Ensure: **no wake / no paid fetch / no live-paid insert or promote** for holiday weekday
  identities of SPY, QQQ, IWM.
- Live session standing: **not regular trading hours** at 10:00 ET on a holiday weekday; **not**
  in-session feed-lag. Existing trader session honesty only — no new ticker widget, no new nav.
- Scanner: existing market-hours gate **idles** as on weekend; **heartbeat continues**; gate-off
  behavior matches weekend.
- Distinctions in S7, including **Sat/Sun unchanged** and **unlisted weekday remains a session
  weekday**.
- **Half-day weekdays remain eligible** this slice (the Future lock is an observable: they must
  not become full-day ineligible).
- Score / tier / fingerprint byte-identical; desk still serves; research family still refused on
  the Pages trader origin; `/lab` still demos; no new operator URL; no new trader route.
- Hermetic GATE Q on an **injected** America/New_York clock: planted holiday weekday, weekend,
  normal weekday, unlisted weekday, and a non-member early-close weekday (or any weekday the
  full-day set does not name).

#### Out

- **Half-days / early close** as ineligible or as a new occupancy class this slice.
- A **vendor holiday fetch** (Massive or otherwise) to classify D.
- A **holiday-admin UI**, Settings calendar, or operator editor for the set.
- **New** trader nav, ticker widget, scanner chrome, or operator URL.
- Occupying **`/lab`**. Lifting **Pages trader-origin refusal** of the research family.
- Retuning **opportunity score / tier / entry gate / fingerprint**. Authorizing a score change.
- Treating a leftover live paid book, tape, or extract on a holiday date as coverage **present**
  or as a successful session keep.
- Replay-player chrome; converting holiday leftovers into a playable live day.
- Other venues (NASDAQ-only, CME, bond, crypto) as a second calendar. NYSE full-day is the claim.
- Expanding liquid occupancy names beyond SPY/QQQ/IWM where those vehicles already lock the trio.
- Watchlist expansion; OPRA; hist-chain; Benzinga; morning note; remote body store;
  `supply-chain-automation`; `tape-store-start-watermark`; score-lab HTTP.

#### Future-dated

- **Early-close / half-day** as its **own** class (short session, still due in the morning —
  never aliased to full-day ineligible).
- Refreshing the closed set from an entitled vendor calendar **without** collapsing unlisted
  dates into “unknown holiday.”
- Multi-year set maintenance if named dates outside the finite set become noisy false holes.
- Other-venue calendars, only if occupancy names stop being NYSE-session liquid ETFs.
- Scanner/ensure cost instrumentation of holiday idle (nice; not required to trust occupancy).

### Product behavior

**Actors:** operator at existing coverage / tape / keep / ensure standing; trader at **existing**
session standing; scanner operator at the **existing** idle-vs-dead honesty. **Not** a `/lab`
visitor. **Not** a new settings user.

**Happy path**

| Situation | What must be true |
|---|---|
| Known NYSE full-day holiday ET weekday D (e.g. Thanksgiving Thursday, weekday Christmas, observed Independence Day Friday) | D is **not a session day** for coverage, tape, keep, ensure, scanner market-hours, and live session standing. |
| Coverage of SPY/QQQ/IWM for that D (D past, or today after what would have been 16:00 ET) | **Not due**, **empty expected set**. Not three missing cells. Not a coverage pass. No hole warning for those identities. Reason is **holiday**, not weekend. |
| Tape inspect of `(SPY\|QQQ\|IWM, D)` | **Ineligible (holiday)**. Not empty-while-storing. Not a no-tape hole. Not a coverage miss word. |
| Keep inspect / keep attempt of D after the usual next-day publish clock | **Ineligible (holiday)**. **No fetch**. Not miss. Not empty extract. Not a keep outage. |
| Ensure on D | **Does not wake** the trio. **Does not** write a live paid book for `(S, D)`. |
| Trader at 10:00 ET on D | Session standing is **not regular trading hours**. Last completed session may still display as last-completed. Standing is **not** feed-lag. |
| Scanner market-hours gate on, during what would have been RTH on D | Sweep **idles** as on weekend. Heartbeat **continues**. Page must not treat the worker as dead solely because it is idle. |
| Normal ET weekday N not in the full-day set, after 16:00 ET | Coverage **due**. Missing books still missing. Ensure still responsible. Tape/keep still eligible. 10:00 ET **may** be regular hours. Scanner does **not** idle as holiday. |
| ET Saturday or Sunday S | **Weekend** ineligible / not due, **unchanged**. Not printed as holiday weekday. If the named calendar holiday falls on S, S is still **weekend**. |
| Trader using the app as usual on a session weekday | Landing / Ticker / Positions / Scanner / TopNav: **no new nav, no new widget**. Score / tier / fingerprint unchanged. |

**Degraded / edge states (each its own outcome — not footnotes on the happy path)**

| Situation | Observable outcome |
|---|---|
| Today ET is holiday weekday D, clock **before** 16:00 ET | Coverage is **empty expected / not due**, **not** “not yet due until 16:00” (that means a session is still underway). |
| Named **future** holiday weekday | Empty expected / not due as **holiday ineligible**, not a future **session** weekday waiting to become due. |
| Named **past** holiday weekday with no books / no tape / no extract | **Not missing**, **not** empty extract, **not** empty-while-storing, **not** a no-tape hole. Ineligible / not due. |
| Holiday weekday leftover live paid book already in the archive | Coverage window is still **not due / empty expected** — leftover does **not** mint a coverage pass or `present` for a session that did not exist. Ensure must not add another. |
| Holiday weekday leftover tape or extract | Inspecting D is still **ineligible**. Leftover is **not** empty-extract success, **not** kept-session success, **not** coverage present. |
| ET Saturday that is also a named calendar holiday (e.g. Independence Day on Saturday) | **Weekend** ineligible. Not holiday-weekday occupancy. |
| Weekday **observance** in the full-day set (NYSE closed Friday because Saturday is the named day) | That **Friday** is holiday weekday ineligible. The Saturday remains weekend. |
| Weekday **not in the full-day set** | **Session weekday.** Coverage can be due. Tape/keep eligible. Zero keep rows = **empty extract**, not ineligible. Tape with no prints = **empty-while-storing**, not ineligible. |
| Known **early-close** weekday (half-day) | **Session weekday this slice** — eligible / due like a normal session day. **Not** full-day ineligible. **Not** a new half-day class yet. |
| Holiday answer **cannot be evaluated** (clock / zone / set unreadable) | **Must not** claim a known full-day holiday. Coverage: **coverage failed**, not empty-expected holiday, not three missing as the only signal. Scanner: **fail open** (keep sweeping), heartbeat continues — not worker-dead, not fabricated holiday idle. |
| Session archive **not storing** on a holiday | **Not storing** still wins as the store-level standing where those vehicles already put it first. Holiday does not launder not-storing into a pass. |
| Coverage / tape / keep **unauthorized** | **Refused**, no corpus body. Holiday does not become an unauthenticated empty-success. |
| Pages trader origin hits the research family | **Still refused** (same 404-class refusal already shipped). Not a holiday calendar feed. |
| `/lab` | Still **instrument demos**. No holiday occupancy matrix there. |
| TopNav / trader routes | **No new operator or holiday entry.** |
| Scanner market-hours gate **off** | Holiday is **not** specially idled; behavior matches weekend-with-gate-off (sweep continues). |
| Ticker request for SPY on holiday D | **No vendor holiday fetch** on that path. Session standing may already be closed; the request must not become a market sweep or a calendar API call. |
| Score path on holiday vs session weekday | Opportunity score / tier / fingerprint **byte-identical** for the same market inputs; holiday is not a scoring input. |
| Local GATE Q / laptop classification of Thanksgiving | **Local evidence**, not hosted/CI/production coverage of NYSE. |

**Closed product rules (binding)**

1. **Full-day NYSE weekday closures only.** Half-days are Future.
2. **Same family as weekend, distinct print from weekend.**
3. **One holiday answer** across coverage, tape, keep, ensure, scanner market-hours, session standing.
4. **Finite in-process set. No vendor fetch. Unlisted ≠ holiday.**
5. **Empty expected coverage window** — not three cells, not a pass.
6. **Today-holiday is not “not yet due until 16:00.”**
7. **Keep holiday-as-empty-extract is inverted.** Tape holiday-as-empty-stored is inverted.
8. **Ensure does not wake and does not mint live paid present.**
9. **10:00 ET is not regular hours; it is not feed-lag.**
10. **Scanner idles like weekend; heartbeat continues; fail-open on lookup failure is inherited.**
11. **Sat/Sun unchanged.** Weekend-falling named holidays stay weekend.
12. **No new surfaces. `/lab` untouched. Pages research refusal stands. Authorizes: nothing.**
13. **Poison holiday-as-weekend, holiday-as-miss, holiday-as-empty-extract, holiday-as-regular-hours — build/gate red.** Anti-vacuity: the poison must bite on a real holiday weekday fixture.

### Acceptance criteria

Observable from **operator coverage / tape / keep standing, ensure wake/vendor-call absence,
live session standing, scanner idle-vs-dead, desk still serving, and score identity**. No source
reading required. `Verify by` is risk-based: `test` where silent regression is plausible;
`review` where the behavior is visible/intentional. Never one-test-per-AC. **(SB)** = ship-blocking.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-1 (SB)** | S1 | Given a known NYSE full-day holiday ET weekday D that is past, or today ET at/after 16:00, coverage of SPY, QQQ, and IWM for D has an **empty expected set** — not three due cells. | test |
| **AC-2 (SB)** | S1 | Under AC-1’s preconditions, coverage standing for D is **not due** and is **not** a coverage pass (not pass n/n present). | test |
| **AC-3 (SB)** | S1 | Under AC-1’s preconditions, none of SPY/QQQ/IWM for D is classified **missing**. | test |
| **AC-4 (SB)** | S1 | Under AC-1’s preconditions, coverage’s operator-visible reason is **holiday**, not weekend. | test |
| **AC-5 (SB)** | S1 | Given today ET is holiday weekday D and the clock is **before** 16:00 America/New_York, coverage for D is **empty expected / not due**, not “not yet due until 16:00.” | test |
| **AC-6 (SB)** | S1 | A named **future** holiday weekday is empty expected / not due as holiday ineligible, not framed as a future **session** weekday waiting to become due. | test |
| **AC-7 (SB)** | S1 | After the usual coverage checkpoint, holiday weekday identities emit **no** hole warning. | test |
| **AC-8 (SB)** | S1 | Coverage audit / process standing for a holiday weekday window exits as **not due / success-without-pass**, never as a coverage pass of present books. | test |
| **AC-9 (SB)** | S1 | A leftover loadable live paid book for `(S, D)` on holiday weekday D does **not** make coverage a pass and does **not** classify that identity **present** as a session day. | test |
| **AC-10 (SB)** | S1 | On the existing operator research coverage read, holiday weekday D does **not** display three missing paid books. The client must not re-derive “weekday ⇒ three due cells” over a not-due holiday. | test |
| **AC-11 (SB)** | S2 | Given holiday weekday D, tape occupancy for each locked name is **ineligible** — not empty-while-storing. | test |
| **AC-12 (SB)** | S2 | Under AC-11, tape occupancy is **not** a no-tape hole (the “we never taped that eligible day” class). | test |
| **AC-13 (SB)** | S2 | Under AC-11, tape’s operator-visible reason is **holiday**, not weekend, and coverage miss words do not appear as tape occupancy. | test |
| **AC-14 (SB)** | S3 | Given holiday weekday D, keep occupancy is **ineligible** and keep **does not fetch**. | test |
| **AC-15 (SB)** | S3 | Under AC-14, occupancy is **not miss** and **not empty extract**, including when a published file would contain zero rows for S. | test |
| **AC-16 (SB)** | S3 | Under AC-14, keep’s operator-visible reason is **holiday**, not weekend. | test |
| **AC-17 (SB)** | S3 | Keep inspect of holiday weekday D is **not** a keep outage (exit/standing in the same family as weekend ineligible: not a failed keep). | test |
| **AC-18 (SB)** | S3 | A leftover stored extract for holiday weekday D does **not** read as kept-session success or empty-extract success of a session day. Inspecting D remains ineligible. | test |
| **AC-19 (SB)** | S4 | Given holiday weekday D and ensure on, ensure **does not wake** SPY, QQQ, or IWM for D (no paid fetch for those identities on D). | test |
| **AC-20 (SB)** | S4 | Under AC-19, ensure **does not insert or promote** a live paid session book for `(SPY\|QQQ\|IWM, D)`. | test |
| **AC-21 (SB)** | S5 | At 10:00 America/New_York on holiday weekday D, live session standing is **not regular trading hours**. | test |
| **AC-22 (SB)** | S5 | Under AC-21, session standing is **not** the in-session feed-lag family (not “covered session, ticks not arriving / feed lag / maybe a holiday”). | test |
| **AC-23 (SB)** | S6 | Given the scanner market-hours gate is on, during what would have been regular hours on holiday weekday D the sweep is **idle** as on a weekend. | test |
| **AC-24 (SB)** | S6 | Under AC-23, the worker heartbeat **continues** so idle is distinguishable from worker-dead. | test |
| **AC-25 (SB)** | S6 | Given the scanner market-hours gate is **off**, holiday weekday D is **not** specially idled — behavior matches weekend with that gate off. | test |
| **AC-26 (SB)** | S7 | Holiday ineligible, weekend ineligible, miss, empty extract, empty-while-storing, not-yet-due session weekday, not-storing, unreadable, and unauthorized are **mutually distinguishable** in operator standing without reading source. | test |
| **AC-27 (SB)** | S7 | An ET Saturday or Sunday is **weekend** ineligible / not due, **not** holiday-weekday occupancy, including when the named calendar holiday falls on that weekend date. | test |
| **AC-28 (SB)** | S7 | A normal ET weekday **not** in the full-day set, at/after 16:00 ET, remains **due** for coverage: a missing book is still missing. | test |
| **AC-29 (SB)** | S7 | On that same normal weekday, keep of a published file with zero rows for S is **empty extract**, not ineligible. | test |
| **AC-30 (SB)** | S7 | On that same normal weekday, tape with no prints while storing is **empty-while-storing**, not ineligible. | test |
| **AC-31 (SB)** | S7 | At 10:00 ET on that same normal weekday, session standing **may be regular trading hours** (holiday-closed must not leak onto a session Tuesday). | test |
| **AC-32 (SB)** | S7 | A weekday the full-day set does **not** name — including a known **early-close** session day — remains **eligible / due** as a session weekday this slice: not full-day ineligible, not empty-expected holiday. | test |
| **AC-33 (SB)** | S7 | When the holiday answer cannot be evaluated, coverage does **not** print empty-expected holiday; the operator sees **coverage failed / unavailable**, distinct from not-due holiday and from three missing cells as the only signal. | test |
| **AC-34 (SB)** | S7 | When the holiday answer cannot be evaluated, the scanner market-hours gate **does not** silent-stop the worker and **does not** claim known holiday idle; it **fails open** (keeps sweeping) with heartbeat alive. | test |
| **AC-35 (SB)** | S8 | Classifying D as holiday / weekend / session weekday completes with **zero vendor holiday fetches** on coverage, tape inspect, keep inspect, ensure-skip, session standing, and scanner idle paths. | test |
| **AC-36 (SB)** | S8 | A ticker/bundle request does **not** fetch a vendor holiday calendar and does **not** become a market sweep (`single-ticker-on-demand`). | test |
| **AC-37 (SB)** | S8 | For the same market inputs, opportunity score, tier, and state fingerprint are **byte-identical** with this construct present vs absent and with D a holiday vs a session weekday that happens to carry the same inputs. | test |
| **AC-38 (SB)** | S8 | If holiday classification, ensure-skip, or scanner idle fails, trader bundle / scan read / live stream still succeed. | test |
| **AC-39 (SB)** | S8 | Pages trader origin still **refuses** the research family (same refusal already shipped), including on a holiday date. | test |
| **AC-40 (SB)** | S8 | `/lab` still presents instrument demos and does **not** gain a holiday occupancy matrix. | test |
| **AC-41 (SB)** | S8 | Trader TopNav still has **no** new control for holidays, coverage, tape, keep, or operator research. | test |
| **AC-42 (SB)** | S8 | Local holiday classification / audit standing cannot be read as hosted/CI/production coverage of NYSE. | test |
| **AC-43 (SB)** | S9 | Poisoning a holiday weekday as **weekend-ineligible** (Thursday printed only as Saturday) makes verification **go red**. The poison is non-vacuous: a real holiday weekday fixture is required. | test |
| **AC-44 (SB)** | S9 | Poisoning a holiday weekday as **coverage missing**, as **empty extract**, as **empty-while-storing**, or as **regular trading hours at 10:00 ET** makes verification **go red**. | test |
| **AC-45 (SB)** | S9 | Coverage, tape, keep, ensure, scanner market-hours, and session standing **agree** on a planted holiday weekday D: none of them still treats D as a session weekday. | test |
| **AC-46** | S8 | This ship adds **no** new trader route, **no** new operator URL, **no** holiday-admin UI, and **no** Settings calendar. Existing session standing and existing operator prints are the surfaces. | review |
| **AC-47** | S5 | Closed-session copy may name **holiday**; **feed-lag** copy must **not** use holiday as its explanation once the date is a known full-day holiday. Exact wording is UX-owned; the standing split is AC-21/22. | review |
| **AC-48** | S9 | This ship does not add a vendor holiday API, half-day occupancy class, `/lab` occupation, Pages research proxy, score retune, replay chrome, or parked harvest (Benzinga, hist-chain, remote body store, supply-chain-automation). | review |

**Method notes (risk-based).**

- **`test` owns silent occupancy / money / standing failures:** empty-expected vs three missing
  vs pass (AC-1–3, AC-8–10), today-before-16:00 vs not-yet-due-session (AC-5), future/past
  holiday (AC-6), no hole warning (AC-7), leftover present/extract/tape (AC-9, AC-18), tape and
  keep class inversion (AC-11–17), ensure no-wake / no live-paid mint (AC-19–20), 10:00 ET not
  RTH and not feed-lag (AC-21–22), scanner idle vs dead vs gate-off (AC-23–25), the S7 split
  matrix including weekend-unchanged, unlisted weekday, early-close still eligible, and
  fail-open (AC-26–34), zero vendor holiday fetch and off-request-path (AC-35–36), score identity
  and desk isolation (AC-37–38), Pages / `/lab` / TopNav (AC-39–41), local≠hosted (AC-42),
  poison + cross-vehicle agreement (AC-43–45). A reviewer will not notice Thanksgiving
  classified as missing, keep still storing empty extract, or 10:00 ET still reading as a live
  regular session, while demos on a Tuesday stay green.
- **`review` owns** absence of new surfaces (AC-46), intentional closed-vs-feed-lag copy
  wording once standing is split (AC-47), and non-absorption of half-day class / vendor API /
  parked harvest (AC-48). AC-32 already **tests** that an early-close weekday stays eligible —
  AC-48 is the scope-honesty wrap, not a substitute.
- Prefer **one** hermetic injected America/New_York pass: plant Thanksgiving-class Thursday D →
  coverage empty expected / not due / holiday reason / no warnings / not pass → tape ineligible
  holiday → keep ineligible, fetch count 0, not empty extract → ensure wake count 0, no live-paid
  insert → 10:00 ET standing not regular hours and not feed-lag → scanner idle + heartbeat →
  plant Saturday (including a Saturday that is a named calendar holiday) → weekend, not holiday
  weekday → plant normal Tuesday → due / empty extract / empty-while-storing / 10:00 may be RTH
  → plant a weekday the full-day set does not name (early-close or unlisted Thursday) → still
  session weekday → plant leftover live paid book on D → still not a coverage pass → plant
  unreadable set / failed holiday answer → coverage failed, scanner still sweeping → vendor
  holiday-fetch counter 0 on every arm → score triple identical → Pages research refused →
  poison holiday-as-weekend and holiday-as-empty-extract go red. **Not** a named micro-harness
  per row.
- GATE Q must show **both** rejecting paths (holiday-as-missing, holiday-as-empty-extract,
  holiday-as-RTH, holiday-as-weekend, early-close-as-full-day-ineligible) **and** an accepting
  holiday weekday that is empty-expected / ineligible / not-RTH / ensure-asleep / scanner-idle.
  A suite that only proves Saturday is still weekend has not proved this feature.
- **H3:** this repo has a dashboard unit harness and Playwright. Load-bearing classification
  stays `test` on a pure clock (no live Thanksgiving required). Paint-only tip wording is
  `review` (AC-47). Do not demand an e2e that waits for a real exchange holiday.
- Do not re-impose one-test-per-AC. One injected-clock matrix can cover AC-1–AC-45.

**Ship-blocking set:** AC-1–AC-45. AC-46–AC-48 are required scope / copy-honesty checks
(`review`).

### Product decisions locked in this position

1. **Audience = operator occupancy + existing trader session standing.** No new surfaces.
2. **Full-day NYSE weekday closures only.** Half-days are Future — and that Future is enforced
   by AC-32, not by prose.
3. **Family = weekend not-due / ineligible. Print ≠ weekend.**
4. **One in-process answer. No vendor fetch. Unlisted weekday remains a session day.**
5. **Vehicles = existing weekend gates only** (coverage, tape, keep, ensure, scanner
   market-hours, session standing).
6. **Coverage = empty expected window**, not three holiday cells. Today-holiday ≠ not-yet-due
   session.
7. **Keep’s shipped holiday-as-empty-extract claim is inverted.** Tape’s holiday-as-empty-stored
   claim is inverted.
8. **Ensure does not wake and does not mint present.**
9. **10:00 ET is not regular hours and not feed-lag.** This is why the slice is **not**
   `NO_UI_CHANGE`.
10. **Scanner idle reuses the existing market-hours gate** (heartbeat, fail-open, gate-off
    parity with weekend).
11. **Sat/Sun unchanged.** Weekend-falling named holidays stay weekend; observed weekdays in the
    set are the holiday weekdays.
12. **Authorizes: nothing.** Pages research refusal stands. `/lab` untouched.
13. Architect names the module boundary vs per-leaf copies. Product binds: **one answer**,
    **distinct print**, **empty expected coverage**, **inverted keep/tape**, **not-RTH session
    standing**, **half-days out**.
14. UX owns exact operator/trader strings. Product owns distinguishability of holiday vs
    weekend vs feed-lag vs miss vs empty extract.

If architecture cannot give one holiday answer to every weekend-gated vehicle without a vendor
fetch, or cannot stop 10:00 ET on Thanksgiving reading as regular hours, that is an **R2
conflict** — I will not silently drop session standing or drop keep/tape to “coverage only.”

### Binding constraints restated

- **`absent-is-not-none` (HARD):** holiday ineligible ≠ weekend ineligible ≠ miss ≠ empty
  extract ≠ empty-while-storing ≠ not-yet-due session weekday ≠ not-storing ≠ unreadable ≠
  coverage failed ≠ unlisted weekday.
- **`present-is-live-paid-only`:** a holiday weekday is never coverage present and never a
  fabricated live paid day. Leftover books do not mint a pass.
- **`structural-over-prose-enforcement`:** poison holiday-as-weekend, holiday-as-miss,
  holiday-as-empty-extract, holiday-as-RTH; anti-vacuity required.
- **`cited-code-is-verified-not-assumed`:** this position does not assert reusable source
  locations. Mechanism reuse is an architecture assumption below. The brief’s weekend-only
  clocks are the observed problem, not a claimed table in-tree.
- **`additive-keeps-score-byte-identical` / Authorizes: nothing:** holiday is scheduling /
  occupancy, never a scoring input.
- **`operator-vs-trader-path-separation`:** no new trader nav; occupancy words on existing
  operator prints; Pages research refusal stands; `/lab` not occupied.
- **`single-ticker-on-demand`:** ensure/scanner stay off the ticker request path; no vendor
  holiday fetch on a ticker request.
- **`local-evidence-is-not-hosted-evidence`:** a local holiday fixture is not hosted NYSE
  coverage.
- **`best-effort-isolated-or-null`:** holiday-path failure does not take down bundle / scan /
  SSE.
- Scanner lookup failure **fails open** (inherited cost-safety); occupancy vehicles must not
  invent a holiday to hide a hole.

## Risks I see

- **Holiday collapsed into weekend print.** Thanksgiving coverage that says “weekend” is a
  fabricated calendar claim. AC-4/13/16/27/43.
- **Holiday collapsed into miss / empty extract / empty tape.** That is today’s lie, and keep
  already **asserts** the empty-extract form — if that test is not inverted, GATE Q will certify
  the hole. AC-3/11/15/44.
- **Empty expected window printed as a coverage pass.** Vacuous n/n present on a closed
  Thursday trains the operator to trust a pass that inspected nothing. AC-2/8.
- **Today-holiday left as not-yet-due-until-16:00.** Implies a session in progress. AC-5.
- **Three ineligible cells instead of empty expected.** Coverage already rejected three weekend
  cells; holiday must not reintroduce them. AC-1.
- **Client re-derives weekday on the research coverage read.** Server can be honest and the card
  still show three missing Thursdays. AC-10.
- **10:00 ET still regular hours**, with feed-lag copy blaming “maybe a holiday.” That is the
  desk-trust half of decision impact. AC-21/22/47.
- **`NO_UI_CHANGE` as a silent narrowing** that leaves trader standing lying. Locked: no new
  surface, but session standing must change. AC-21/46.
- **Ensure still wakes** and mints a live paid Thanksgiving book the coverage window then has to
  ignore. AC-19/20/9.
- **Scanner looks dead** because idle dropped the heartbeat, or **still sweeps** because holiday
  never joined the existing gate. AC-23–25.
- **Fail-closed on lookup failure** (worker stops, or coverage pretends empty-expected holiday)
  hides Tuesday holes and pages the desk. AC-33/34.
- **Unlisted Thursday treated as holiday** to “be safe.” That hides a real missing book.
  AC-28–32.
- **Half-days folded into the full-day set** so the calendar looks complete. Fabricates not-due
  for a morning session. AC-32/48.
- **Per-leaf copies drift** (coverage holiday, keep still empty extract). AC-45.
- **Vendor fetch** “just for holidays” on the ticker path or on coverage. Bills, fails
  `single-ticker-on-demand`, and couples occupancy to Massive. AC-35/36.
- **Score side-effect** from session-standing changes leaking into signals. AC-37.
- **Saturday Independence Day classified as holiday weekday**, breaking Sat/Sun unchanged.
  AC-27.
- **Local fixture quoted as hosted NYSE truth.** AC-42.
- **Scope absorption:** early-close class, holiday admin UI, `/lab`, Pages proxy, replay chrome.
  AC-40/41/46/48.

## Assumptions I'm making about the other two lanes

- **Architect** will attach holiday to the **existing weekend gates** (coverage expected-set,
  tape ineligible, keep ineligible, ensure weekday skip, scanner market-hours idle, live session
  classifier) rather than inventing a seventh occupancy vehicle.
- **Architect** will ship **one** shared America/New_York full-day-holiday answer and **not**
  per-leaf copies that can classify Thanksgiving as not-due in coverage and empty extract in
  keep on the same D.
- **Architect** will implement that answer as a **finite in-process NYSE full-day set with zero
  vendor fetches**, including on ticker/bundle, coverage, tape, keep, ensure, and scanner paths.
- **Architect** will make holiday a **distinct ineligible/not-due reason from weekend**, not
  reuse the weekend token as the only print (Thanksgiving will not classify as Saturday).
- **Architect** will **invert** the shipped keep assertion that a holiday weekday with zero rows
  is empty extract, and the tape residual that a holiday weekday with no prints is
  empty-while-storing — not delete those tests into vacuity.
- **Architect** will keep **Saturday/Sunday on the weekend path unchanged**, including when a
  named calendar holiday falls on a weekend date; observed **weekdays** in the set are the
  holiday weekdays.
- **Architect** will **exclude half-days / early closes** from the full-day set this slice, so a
  non-member weekday remains a session day under AC-32.
- **Architect** will treat **unlisted weekdays and failed holiday evaluation as not-holiday**
  (coverage failed ≠ empty-expected holiday; scanner fail-open inherited).
- **Architect** will expose an **injectable America/New_York clock** so GATE Q can plant
  Thanksgiving-class Thursday, weekend, normal weekday, and a non-member weekday without waiting
  for a live exchange holiday.
- **Architect** will keep holiday work **off the ticker request path** (no market sweep, no
  vendor calendar call from a single-ticker fetch) while still letting **existing** session
  standing read the shared answer.
- **Architect** will **not** require a new HTTP family or new operator URL for these outcomes;
  existing coverage / tape / keep / session standing are enough. If they are not, that is an R2
  conflict, not a quiet “coverage-only” shrink.
- **UX** will **not** add a holiday-admin page, Settings calendar, new trader nav item, new
  scanner chrome, or a `/lab` occupancy matrix.
- **UX** will treat **existing trader session standing** as the desk surface: 10:00 ET on a
  holiday weekday reads as **closed / not regular hours**, and they will **split feed-lag copy
  off of holiday** so “maybe a holiday” is no longer the in-session explanation.
- **UX** will keep **holiday vs weekend distinguishable** in operator-facing standing (coverage,
  tape, keep) without inventing a third family that looks like a hole.
- **UX** will **not** re-derive “ET Thursday ⇒ three due coverage cells” on the existing
  research coverage read; that card will consume the not-due empty-expected window.
- **UX** will **not** lock `NO_UI_CHANGE` in a way that preserves lying 10:00 ET regular-hours
  standing; they may still ship **no new chrome**.
- **UX** will not retitle occupancy so that leftover extracts/books on a holiday date can be
  read as a successful live session or as coverage present.
- **UX** will leave scanner trader chrome unchanged if idle-with-heartbeat already matches
  weekend; they will not add a holiday banner that collides with worker-dead.
