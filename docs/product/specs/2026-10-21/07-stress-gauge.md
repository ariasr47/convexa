# Stress on Markets: a fear–greed gauge built only from public-domain inputs

_Proposal, 2026-10-21 (revised 2026-10-22 after review, for the roadmap's cross-spec fixes 2
and 3, and again after the spec set was cross-checked). Kind: new-tool. Size: L, shipped as two
changes: the API (build steps 1–4), then the frontend (steps 5–7). Depends on: spec 2
(`02-a11y-touch-floor.md`, the 44px touch floor and the twin's link cell; build after it).
Criterion 5's missing head tag also expects spec 1's (`01-demo-first-screen.md`) ChartFrame opt-in
on `/research/markets` (spec 1, Build plan › step 5, which waits on owner decision D1). Nothing
depends on spec 4: the withheld state draws its own quiet line, not spec 4's `LoadFailure`._

Code citations are `file:line` at commit `8ef735c4` (2026-10-22). Another workflow is editing
`apps/`, `libs/` and `tools/` while this was written, so lines may move. The brief cited
`MarketsPage.tsx:267-270` for the section list; at `8ef735c4` that list is `MarketsPage.tsx:262-267`.

## Why

Q5 of the analyst design asks "Is fear elevated? What's the market regime?"
(`docs/product/ai-analyst/DESIGN.md:66`). Nothing on the site answers it today.

- Every familiar fear index needs a licence to show. Cboe's VIX and put/call need written consent;
  CNN's Fear & Greed has no feed and no permission (`docs/product/ai-analyst/SOURCES.md:151-152`).
- The only fear/greed words in the app are the ticker desk's IV-skew phrase
  (`apps/dashboard/src/app/pages/ticker/widgets/_kit/copy.ts:77-86`). It reads the options chain, so
  it is Not live on production.
- The design already specifies the replacement: five OFR Financial Stress Index categories and two
  CFTC TFF series, as 3-year percentiles, flipped so 100 = greed, published only when 5 of 7 are
  fresh (`SOURCES.md:172-204`, `DESIGN.md:125-137`). None of it is built: the API reads no OFR data,
  and `cftc.rs:15-19` lists the 10-year T-note, E-mini S&P 500 and E-mini Nasdaq-100, not VIX futures.

Measured on 2026-10-22 (scripts and screenshots under `tmp/ux-audit/spec-stress-gauge/`, scratch,
not committed):

- `/research/markets`, 8 loads (staging and production × 390 and 1440 × dark and light): four
  sections (`rates`, `positioning`, `liquidity`, `coming-up`), 8 chart frames each, and **0**
  occurrences of "fear", "greed", "stress", "VIX" or "OFR" in the page text (`markets.json`).
  Screenshots: `shots/{staging,production}_{desk,phone}_{dark,light}.png`, and the boundary where
  the section would sit: `shots/production_desk_dark_boundary.png`,
  `shots/staging_phone_dark_boundary.png`.
- No horizontal overflow: `scrollWidth == clientWidth` at 390 and 1440 on both builds, both schemes.
- Touch: at 390 with a coarse pointer, 15 interactive elements in `main` are under 44px tall: the
  jump-rail links (32px), every "Show the numbers" summary (24px), source chips (about 25px) and
  inline links (15px). Spec 2 owns that floor. This section brings three targets of those kinds
  (its rail link, its source chip and its "Show the numbers"), so **until spec 2 lands it adds
  three sub-44px targets** to the list. Build it after spec 2; if it ships first, that is the
  known gap in criterion 10.
- Production `GET /api/public-data/markets`: 94,865 bytes decoded (gzip), 59 ms warm. `futures`
  holds 3 markets (043602, 13874A, 209742), 156 weekly reports each; the `sources` list has no `ofr`
  row (`apisize.mjs`, `markets.json`).
- OFR `fsi.csv` (fetched 2026-10-22, `data/fsi.csv`): 516,648 bytes, 6,783 rows, 2000-01-03 to
  2026-10-19, `Last-Modified` 2026-10-21 14:00 UTC, so a two-business-day lag. Header:
  `Date,OFR FSI,Credit,Equity valuation,Safe assets,Funding,Volatility,United States,Other advanced economies,Emerging markets`.
  No blank cells, no weekend rows. Since 2022 a row nearly every weekday, U.S. holidays included
  (260 rows in 2023, 261 in 2024 and 2025; 2025-12-25 has a row). It is not every weekday: 208
  weekdays are missing in all, 204 of them from 2000 to 2021 (about 9 a year; 109 of the 208 are
  Mondays, so the file has 1,290 Monday rows against 1,384 Tuesday rows), and 4 since: 2022-01-17,
  2022-02-21, 2022-02-25 and
  2024-02-14 (`tmp/ux-audit/review-stress-gauge/gaps.py`). The method is unaffected, because every
  window is defined by date, not by row count.
- CFTC TFF (`data/tff.json`): code `1170E1` is "VIX FUTURES - CBOE FUTURES EXCHANGE" on the same
  Socrata dataset `cftc.rs:11` already reads, and `open_interest_all` is present on all 318 rows
  fetched for 1170E1 and 13874A (2023-10-03 to 2026-10-13).

**Input claims corrected while checking** (each is dropped or reworded below):

1. "Reuse the 3-year `position_in_range` ranking." That figure is a min-max position,
   `(net − min) / (max − min)` (`cftc.rs:125-129`, documented at `routes/public_data.rs:208`), over
   net contracts. SOURCES.md asks for a percentile of net ÷ open interest. One extreme week moves a
   min-max position; it does not move a percentile much. The gauge reuses the CFTC fetch, its cache
   and its 3-year window, not the statistic. The CFTC query also does not select open interest today
   (`cftc.rs:31-34`).
2. "756 trading days." The OFR file writes a row nearly every weekday, holidays included, so 756
   rows cover about 2.9 years
   (2023-11-24 to 2026-10-19 in today's file). This spec defines every window by date instead: the 3
   calendar years ending at that input's own as-of date (781 OFR rows and 157 CFTC reports on
   2026-10-22).
3. "Fewer than 3 years of history" is not hypothetical. The API fetches CFTC reports from
   `today − 1,096 days` (`mod.rs:520`). Counted day by day over a year (`cftc_window_count.py`), that
   rule holds 156 to 157 reports with a Friday release and 155 to 156 when a holiday pushes the
   release to Monday. The fetch must reach further back.
4. "Every row is dashed and tagged Sample." On staging every Markets frame is already dashed with
   the hatch stripe and tagged "Demo · sample data" (8 of 8, measured; the shell sets it,
   `AppShell.tsx:222`, `ChartFrame.tsx:91-94`). /methodology defines "Sample" as the landing's
   illustrations only (`pages/methodology/copy.ts:379`). The Stress frame follows the page as spec 1
   leaves it: spec 1 drops the forced tag on `/research/markets`, so the frame is dashed with the
   hatch, its source chip is its one mark, and the rows carry no tag of their own.
5. "Two rows carry older as-of dates." In the sample, the CFTC report is Oct 6
   (`libs/api/src/lib/demo/public-data.ts:286`) and OFR's two-business-day lag from the Oct 7
   scenario gives Oct 5. The CFTC rows must match the sample's own Positioning section, so they carry
   a different, newer date. Per-row dating still shows. See open question 3.
6. "OFR subindices." They are the five category contributions to a **global** index: on every row of
   the file the five categories sum to the headline FSI within 0.002. The copy says "worldwide".
7. "The Convexa Stress Gauge" as the reading's name on the page (`SOURCES.md:174`). The scale runs
   0 = extreme fear to 100 = extreme greed, so a high number means *low* stress. "Stress sits in
   Greed (70)" or "Stress gauge 80" reads as high stress to most people, and each row would put a
   stress-direction raw value ("higher than 79%") beside a greed-direction score (21). On the page
   the reading is named by its poles, the **fear–greed gauge**; "Stress" stays the section's name
   (its topic: market stress), and every score carries its band word. The design documents keep
   their name; nothing there is rewritten.

## Who and when

- **The owner, on production.** Researching Q5, "is fear elevated?", the owner opens Research →
  Markets and reads one line: where the gauge sits between fear and greed, which inputs drive it,
  and how old each input is. The row for each input says what was measured and when, so a
  two-day-old OFR value is never mistaken for today's. It is research, not a signal: the OFR itself
  says its index is not for financial decisions (Data and licence).
- **A recruiter or reviewer, on staging.** They scroll the demo's Markets page and find a fear–greed gauge
  that says, row by row, where each input comes from and that every one of them may be shown. It is
  the visible proof that Convexa reads licences before it draws.

## Scope and non-goals

**In scope**

- A Stress section on `/research/markets`, on both builds, between Positioning and Liquidity. A
  component table with one gauge row on top, not a dial.
- API: OFR ingestion (`ofr.rs`), VIX futures and open interest in the CFTC read, the scoring
  (`stress.rs`), `stress` on `GET /api/public-data/markets`, and an `ofr` sources row.
- Frontend: the section, its loading, withheld and failure states, its table twin, the jump-rail
  entry, the page disclaimer, a /credits OFR card, a /methodology entry and the What's live row.
- An authored sample on the staging demo transport.

**Not in scope**

- **No analyst tool and no model input.** `get_stress_gauge` stays in analyst Phase 2
  (`DESIGN.md:252`). Note what `DESIGN.md:509` actually says: Phase 2's "What ships" lists **the
  Stress Gauge itself** (OFR plus CFTC, with VIX futures `1170E1` added to `cftc.rs`), gated on the
  Q5 eval, and the roadmap rule reads "New sources come only after that" (`DESIGN.md:501`). So
  building the public gauge and the OFR source now is ahead of that roadmap. The same row lists the
  Treasury curve and the calendar, which already ship publicly (Rates; Coming up, `calendar.rs`,
  `DESIGN.md:99`), so there is precedent for building the public part first and keeping the model
  part behind the eval. That sequencing is the owner's call: open question 4. Nothing in this spec
  reaches a model. OFR and CFTC are on the owner's list of public-domain sources that public pages
  may show. Phase 2 still owes the Q5 eval before any model reads the gauge.
- No alert kind. "Stress band changed" would be a seventh public kind
  (`features/alerts/kinds.ts:37-92` has six). Later.
- No VIX index level, put/call ratio, CNN index or credit spread from FRED/ICE. Not displayed, not
  fetched.
- No history chart of the gauge. Today's reading and its inputs only.
- No change to the Positioning section: it keeps its three markets and its figures (open question 1).
- No FINRA input. SOURCES.md's later eighth input waits for the FINRA credential.
- No spec 4 `LoadFailure` in the Stress frame. The withheld state draws its own quiet line
  (Behaviour), so this spec needs nothing from spec 4.

## Behaviour

### The method (binding; the API computes it, the page only displays it)

Components, in this order everywhere (rows, wire, table twin):

| # | Component | Raw input | Higher raw value means | Cadence |
|---|---|---|---|---|
| 1 | Volatility | OFR FSI `Volatility` | Fear | Daily, T-2 |
| 2 | Credit | OFR FSI `Credit` | Fear | Daily, T-2 |
| 3 | Safe haven | OFR FSI `Safe assets` | Fear | Daily, T-2 |
| 4 | Equity stress | OFR FSI `Equity valuation` | Fear | Daily, T-2 |
| 5 | Funding | OFR FSI `Funding` | Fear | Daily, T-2 |
| 6 | Vol positioning | CFTC TFF `1170E1`, leveraged funds (long − short) ÷ open interest | Fear | Weekly |
| 7 | Equity positioning | CFTC TFF `13874A`, asset managers (long − short) ÷ open interest | Greed | Weekly |

1. **Window.** For each component, its as-of date is its newest observation. The window is every
   observation dated after (as-of − 3 calendar years) up to the as-of date, inclusive. On Feb 29 the
   cut is Feb 28.
2. **Percentile.** With `v` the as-of value and the other `n − 1` window values,
   `p = 100 × (count below v + ½ × count equal to v) / (n − 1)`. Ties count half, so flipping is
   exact (`100 − p`). **`p` and the score stay unrounded through every later step** (flip, mean,
   rounding, band). Only display rounds: the wire's `percentile` and `score` and the page show them
   rounded half up to one decimal.
3. **Short history.** If the series starts after the 3-year cut, the window is what exists. It is
   scored when it reaches back at least 1 year (as-of − 1 year or earlier). Otherwise the component
   is not counted, with the note "less than a year of history".
4. **Flip.** Score = `100 − p` where a higher raw value means fear (components 1 to 6); score = `p`
   for component 7. For every component, 0 is extreme fear and 100 extreme greed.
5. **Freshness** is judged on the API's Eastern date (`today_eastern()`, `mod.rs:1288-1292`).
   - Daily (OFR): age = weekdays after the as-of date up to and including today. Fresh while
     age ≤ 5. U.S. holidays count as weekdays, which is the cautious side; the copy therefore says
     "weekdays", never "business days", for this limit. Example: as of Mon Oct 19 is fresh through
     Mon Oct 26 and stale from Tue Oct 27.
   - Weekly (CFTC): age = calendar days from the report's Tuesday to today. Fresh while age ≤ 14.
     Example: the Oct 13 report is fresh through Oct 27 and stale from Oct 28.
   - A value served from a last good copy is still fresh if its date passes this test. Freshness is
     about the data's date, not the fetch.
6. **Gauge.** The plain mean of the **unrounded** scores of the fresh, scored components. Published
   only when at least 5 of 7 count. Rounded half up to an integer from that unrounded mean. The
   mean of the one-decimal scores a reader sees can differ from it by up to 0.05, and within 0.05
   of an x.5 edge it can round the other way; so the wire also carries the unrounded `mean`, and
   the table twin shows it (Copy).
7. **Bands**, decided on the published integer, each edge belonging to the calmer band:
   0–24 Extreme Fear · 25–44 Fear · 45–55 Neutral · 56–75 Greed · 76–100 Extreme Greed.
   So 25 is Fear, 45 and 55 are Neutral, 75 is Greed. Why: the bands then mirror exactly around 50
   (g and 100 − g always get mirror bands), a reading must cross an edge to be called more extreme,
   and the number and band on screen can never disagree, because both come from the same integer.
8. **What 5 of 7 means in practice.** The five OFR inputs come from one file, so they are almost
   always fresh together or stale together. (Not always: a column whose newest cells fail to parse
   takes its newest parsed day as its as-of, so it can lag the others; each component is judged on
   its own as-of.) The gauge publishes, in practice, exactly when the OFR file is fresh. The CFTC
   rows can drop out without stopping it. That is the stated tradeoff, shown on the page.
9. **The gauge's as-of** (`stress.as_of`) is the **oldest** as-of among the counted OFR components
   (on a normal day all five share one date); `null` when no OFR component counts. The gauge never
   claims a newer date than its oldest counted OFR input.

**Worked example on real files** (computed 2026-10-22 by
`tmp/ux-audit/spec-stress-gauge/worked_example_v2.py` from `data/fsi.csv` and `data/tff.json`; a
reference for checking the build, not product copy):

| Component | As of | Raw | Window | Percentile | Score |
|---|---|---|---|---|---|
| Volatility | 2026-10-19 | −0.007 | 781 | 78.5 | 21.5 |
| Credit | 2026-10-19 | −0.947 | 781 | 50.5 | 49.5 |
| Safe haven | 2026-10-19 | −0.294 | 781 | 36.6 | 63.4 |
| Equity stress | 2026-10-19 | −0.503 | 781 | 19.9 | 80.1 |
| Funding | 2026-10-19 | −0.142 | 781 | 41.5 | 58.5 |
| Vol positioning | 2026-10-13 | +0.25% of OI | 157 | 91.0 | 9.0 |
| Equity positioning | 2026-10-13 | +47.41% of OI | 157 | 69.2 | 69.2 |
| **Gauge** | | | | | **mean 50.1557 → 50, Neutral** |

The table shows one-decimal values. The gauge comes from the unrounded scores, whose mean is
50.1557; the one-decimal scores shown average 50.1714 (recomputed by the review,
`tmp/ux-audit/review-stress-gauge/recompute.py`). Both give 50 here; near an x.5 edge they need
not, which is why rules 2 and 6 fix the unrounded reading.

### API (`apps/api`)

- **OFR read** (`services/public_data/ofr.rs`, modelled on `treasury.rs`). GET
  `https://www.financialresearch.gov/financial-stress-index/data/fsi.csv` with the public user agent
  (`fetch.rs:9`), `MAX_BYTES` 2 MiB (as `treasury.rs:15`; the file is 0.5 MiB and grows about 20 KB a
  year). Columns are found by header name, as `treasury.rs:83-89` does, so a reordered file still
  parses. Required: `Date`, `Credit`, `Equity valuation`, `Safe assets`, `Funding`, `Volatility`.
  Dates are `YYYY-MM-DD`. A cell that does not parse is missing for that column on that day only;
  that column's as-of is then its newest parsed day. A body without those headers (an HTML error
  page) is a parse failure. Keep rows from (latest − 3 years − 31 days) on.
- **Cache.** `ofr: TtlCache<(), OfrSeries>` with a 6-hour TTL and `RETRY_AFTER_FAILURE`
  (`mod.rs:52`), like `rates` (`mod.rs:172`). The file changes once a day.
- **CFTC** (`cftc.rs`). Today one constant, `MARKETS` (`cftc.rs:15-19`, three entries), feeds both
  `query()` (`:23`) and `build()` (`:148`). Split it, so that adding VIX futures to the request
  cannot add a market to Positioning:
  - `POSITIONING_MARKETS`: today's three entries, unchanged, used only by `build()`.
  - `FETCH_CODES`: those three codes plus `1170E1` ("VIX FUTURES - CBOE FUTURES EXCHANGE"), used
    only by `query()`, so one Socrata request serves both uses.
  - The `$select` adds `open_interest_all`. It is optional when parsed, like the dealer columns
    (`cftc.rs:90-93`): a report without it still counts for Positioning, and the gauge skips that
    week.
  - **One clock.** The fetch closure (`mod.rs:515-530`) takes `fetched_on = Utc::now().date_naive()`
    once, exactly the date the old `since` used (`mod.rs:520`). The request reaches back
    `fetched_on − 1,117 days` (3 years + 3 weeks) instead of `− 1,096`. `build()` receives
    `fetched_on` and keeps for Positioning only reports on or after `fetched_on − 1,096 days`, the
    old `since` to the day. It never uses `today_eastern()`, so the boundary report cannot shift
    between 20:00 and 24:00 ET, and `/api/public-data/markets` `futures` is unchanged (criterion 7).
  - The cached value also carries two weekly ratio series for the gauge, oldest first: 1170E1
    leveraged funds and 13874A asset managers, (long − short) ÷ open interest. Their windows follow
    the method (by each series' own as-of date), not `fetched_on`.
- **Scoring** (`services/public_data/stress.rs`, pure functions, no I/O). It holds the window,
  percentile, short-history, flip, freshness, publish and band rules above, and
  `build(ofr, cftc, today) -> Stress`.
- **Markets** (`types.rs:211-220`) gains `stress: Option<Stress>`. `markets()` (`mod.rs:223`) joins
  the OFR lookup into its `tokio::join!`, builds `stress` from whatever is cached, adds the OFR stale
  note to `notes` (`mod.rs:316`) and pushes an `ofr` source row after `cftc`. `stress` is `None` only
  when public data is off (the off branch at `mod.rs:236` also lists `ofr` as Off).
- **Sources** (`sources.rs`): `OFR = ("ofr", "OFR Financial Stress Index")`, read with
  `from_lookup(.., delayed = true, as_of = newest OFR date, ..)`. The OFR publishes two business
  days late by design, so a fresh read is "Delayed by source", as CFTC's is (`mod.rs:261-267`).
- **Wire** (`routes/public_data.rs`). `PublicMarketsWire` (`:288`) gains
  `#[serde(default)] stress: Option<StressWire>`, documented "Absent from servers before
  <ship date>", as `calendar` is (`:298-301`). Binding fields (Rust/TS names are the builder's):

  ```text
  stress: {
    published: bool,             // true when ≥ 5 of 7 count
    gauge: int | null,           // 0–100, null unless published
    mean: number | null,         // the unrounded mean the gauge rounds (rule 6), null unless published
    band: "extreme_fear" | "fear" | "neutral" | "greed" | "extreme_greed" | null,
    as_of: "YYYY-MM-DD" | null,  // the oldest as-of of the counted OFR inputs (rule 9)
    counted: int,                // 0–7
    judged_on: "YYYY-MM-DD",     // the Eastern date freshness was judged on
    components: [                // always 7, in table order
      { id: "volatility" | "credit" | "safe_assets" | "equity_valuation" | "funding"
            | "vol_positioning" | "equity_positioning",
        source: "ofr" | "cftc",  // its sources-row id and /credits anchor
        cadence: "daily" | "weekly",
        raw: number | null,      // OFR index units; CFTC a fraction of open interest
        as_of: "YYYY-MM-DD" | null,
        window: int,             // observations in the window, as-of included
        window_from: "YYYY-MM-DD" | null,
        percentile: number | null,   // 0–100, display value rounded to one decimal, raw direction
        higher_means: "fear" | "greed",
        score: number | null,        // 0–100, display value rounded to one decimal, 100 = greed
        counted: bool,
        reason: "stale" | "no_data" | "short_history" | null,
        age: int | null }            // weekdays (daily) or days (weekly)
    ]
  }
  ```

  **Components carry no state of their own.** A row's data-state (its "Last good copy" tag), the
  withheld cause word, and the `{time}` in the withheld lines come from joining
  `component.source` to the answer's `sources` row with that `id` (`routes/public_data.rs:78-93`:
  `state`, `as_of`, `checked_at`, `failed_at`), the way `state_of` (`:459`) does for the other
  sections (`:465-467`). `checked_at` is when the served copy was fetched, so it is the "{time}" in
  "hasn’t answered since {time}". No per-component state field is added.

  `representative_markets()` (`:1348`) gets a representative `stress`, and the old-answer test
  (`:1708`) also reads an answer without `stress`. Then `npm run api:contract:generate` regenerates
  the contract artefacts (`tools/api-contract.mjs:36-44`, its `mutable` list):
  `apps/api/openapi/convexa.openapi.json`, `apps/api/openapi/parity-coverage.json`,
  `libs/api/src/generated/schema.ts`, `apps/api/openapi/generated-artifacts.manifest.json` and
  `apps/api/tests/fixtures/api_contract/boundary-evidence.json`. `libs/api/src/lib/convexa.ts`
  gains `PublicStress` and `PublicStressComponent` aliases beside `PublicMarkets`
  (`convexa.ts:2179`).

### Page (`/research/markets`)

Order: Rates · Positioning · **Stress** · Liquidity · Coming up. `JUMPS` (`MarketsPage.tsx:262-267`)
gains `{ id: 'stress', name: 'Stress' }` after Positioning. `JumpRail` (`:270`) shows it while
loading or when `data.stress !== undefined`, as it gates Liquidity. The section renders between the
Positioning section (`:206`) and the Liquidity block (`:229`), as a `MarketsSection` with a lead.

| State | What shows |
|---|---|
| **Loading** (cold read takes seconds) | `MarketsLoading` (`:1900`) gains the Stress section: one `ChartFrame` with `status: loading`, its metric as title (P-10) and its sub, at the final body height measured at 1440. The section sits below the fold at both widths (Positioning already starts at y ≈ 2,018 at 1440 on production and y ≈ 3,573 at 390 on staging), so the frame's growth at 390 shifts nothing on screen. |
| **Ready, published** | `ChartFrame` `status: { kind: 'ready' }`. Title = the finding (below). Gauge row: figure "Fear–greed 50", band word, "7 of 7 inputs counted · as of Oct 19". Axis with band names once. Seven rows. Note with the tradeoff. Foot: source chip and as-of line. "Show the numbers". Frame tag: Computed, or Last good copy when the `ofr` sources row is `last_good` (Copy → Tag). |
| **Ready, 5 or 6 counted** | As published. The uncounted rows show their value and date dimmed (`textDim`), score "—", and a "Not counted" line saying why. The gauge row says "6 of 7 inputs counted" (or 5). |
| **Withheld (fewer than 5 counted)** | **Still `status: { kind: 'ready' }`**, because `ChartFrame` draws its children, note and table twin only when ready (`ChartFrame.tsx:173`, `:178`, `:207`); a `message` status would replace the rows and the twin with `StateBody`. So: `finding` = the metric, "Fear–greed gauge" (no finding is claimed); frame tag = the cause's P-2 word; the **first child** is the failure line (copy below), with Try again where a fetch failed. **Every cause uses one quiet form**: its `DataStateTag` word, the line in `text.secondary`, and Try again as a 44px outlined neutral button, inside a `role="status"` box. It does not use spec 4's `LoadFailure`, which takes only Couldn’t load and Source down, leaves Last good copy out on purpose, and has no compact form. No gauge number, band or finding in the title, gauge row or table twin. The rows still render with their own dates and "Not counted" lines, so the reader sees what is missing. `ChartFrame` itself is not changed. |
| **One row with no data** (its source failed with nothing cached) | Raw shows `unavailable` (closed not-a-number vocabulary, Sans, never mono), score "—", no bar, and the reason. In the table twin that row's Raw is `unavailable` as a Sans text cell (Copy → Table twin). A CFTC outage leaves the gauge published on the five OFR rows. |
| **Last good copy** | A row whose source's `sources` row (joined by `component.source`) is `last_good` carries the tag "Last good copy" beside its date. It counts if its date is fresh. When that source is the OFR, the frame tag is Last good copy too (Liquidity's precedent, `LiquiditySection.tsx:125-129`); a CFTC last good copy changes only its two rows. The page's existing stale note (`MarketsPage.tsx:191`) carries the OFR line from `detail`. |
| **Off** (`PUBLIC_DATA=off`) | Unchanged page behaviour: the whole page shows the existing Off message (`MarketsPage.tsx:184-188`), no Stress section, no rail entry. |
| **Our request failed** | Unchanged: the page-level failure (`MarketsPage.tsx:178-183`): today's `SourceProblem`, and spec 4's `LoadFailure` once spec 4 lands. Nothing in this spec depends on which. |
| **Older API** (`stress` absent) | No Stress section and no rail entry, as Liquidity does (`MarketsPage.tsx:228`). |
| **Empty** | Does not occur. A source that answers always has rows; a source that does not is a failure state above. |
| **Not live** (production) | Does not apply. No input needs the options feed. |
| **Signed out / signed in** | Identical. The page and `/api/public-data/markets` are public, and nothing here is licensed data, so nothing is owner-gated. |
| **Staging (sample)** | The authored sample through the demo transport. The frame takes the board's provenance (dashed with the hatch stripe, `ChartFrame.tsx:91-94`). Spec 1's opt-in on `/research/markets` drops the forced "Demo · sample data" tag, so the source chip is the frame's one mark. The finding is prefixed "In the sample," as `ComingUpSection.tsx:134` does. The source chip reads the demo wording. The foot says "Scenario · Oct 7, 2026". No live dot, no clock time (P-3). |
| **Phone (< 768)** | Rows stack (sketch below). The axis keeps only its two ends, "Fear" and "Greed", and drops band ticks rather than shrinking them (P-13). The table twin scrolls inside its own region (`ChartFrame.tsx:334`). No horizontal page overflow. |

**The finding (P-10)**, worked out from the counted components, deterministic:

- Leads: in Fear or Extreme Fear, the two counted components with the lowest scores, lowest named
  first; in Greed or Extreme Greed, the two with the highest, highest named first. Ties go to the
  earlier row.
- Neutral: name the lowest-scoring component if it is under 45 and the highest-scoring if it is over
  55; if neither is, say no input is far from the middle.
- Positioning clause: only when both CFTC rows count and neither is already named. Both 45–55:
  "positioning is neutral". Both under 45: "positioning leans fear". Both over 55: "positioning
  leans greed". Otherwise: "positioning is split".

Real files on 2026-10-22 give: "The fear–greed gauge reads Neutral (50): vol positioning pulls
toward fear, equity stress toward greed". The sample gives: "In the sample, the fear–greed gauge
reads Fear (38): credit and volatility lead, positioning is neutral".

### Other routes

- `/credits`: a new OFR card after the CFTC card, `id: 'ofr'` (anchor `/credits#ofr`). The CFTC card
  names VIX futures. The OFR card's state comes from the `ofr` sources row: `FROM_MARKETS`
  (`CreditsPage.tsx:56`) gains `'ofr'`. The legacy record (`:117`) gets an older-server fallback,
  "Not set up", with the note below.
  `cardState.ts` `answered()` (`pages/trust/cardState.ts:85-127`) gains `case 'ofr'`; without it
  the default branch gives the detail "read {date}", not the "as of" the card needs. It returns
  `{ detail: 'as of {Oct 19}', note: 'Values as of {October 19, 2026}. The OFR publishes each
  day’s index about two business days later.' }` (no `as_of`: `Answered{checked}.`). A fresh OFR
  row is `delayed`, which reaches `answered()` through `fromRow`'s default branch (`:148-149`), so
  the card reads "Delayed by source · as of Oct 19".
- `/methodology`: a new section `#fear-greed-gauge` before "Where the read is weak"
  (`copy.ts:211`). What's live on production (`copy.ts:288-316`) gains a fear–greed gauge row. The
  staging list (`copy.ts:344-350`) names stress and OFR.
- `shared/credits/anchor.ts`: `CreditsAnchor` gains `'ofr'`, and a rule
  `/\bOFR\b|Financial Stress Index|Office of Financial Research/i → 'ofr'` placed **third, right
  after the TradingView and Massive rules** (`anchor.ts:24-25`) and so above the CFTC rule
  (`anchor.ts:30`) as well as the Treasury rule (`:35`). "First match wins" (`:22`), and both chip
  texts also name the CFTC. Resolutions, each checked in criterion 8 and in `anchor.spec.ts`:
  - `OFR Financial Stress Index · CFTC TFF` (production chip) → `ofr` (placed after the CFTC rule,
    it would go to `cftc`);
  - `Demo · shaped like OFR and CFTC data` (staging chip) → `ofr`;
  - `Office of Financial Research, U.S. Department of the Treasury` → `ofr`, not `treasury`;
  - every existing chip text resolves as before: no chip on the site names OFR today (`git grep`
    for "OFR", "Financial Stress" and "Office of Financial Research" in `apps/dashboard/src` and
    `libs/api/src` at `8ef735c4`: no matches).
- No other route changes. Positioning, Alerts and the Scanner's not-live panel read `futures`, which
  is unchanged.

## Copy

Voice: plain, short, claims only what the data shows (DESIGN_SYSTEM rule 4). State words come only
from the closed P-2 set (`shared/dataState/vocabulary.ts:32-51`); value gaps only from the closed
not-a-number set (rule 24). Band names are proper names, capitalised as SOURCES.md writes them.

**Section**

- Jump rail: `Stress`
- Heading: `Stress`
- Lead: `A fear–greed gauge built only from data Convexa may show: five parts of the Office of Financial Research’s stress index and two CFTC positioning series, each ranked against its own last three years. 0 is extreme fear and 100 extreme greed, so high stress reads low. The familiar fear gauges need a licence to show, so none is used here.`

**Naming.** The reading is named by its poles, the fear–greed gauge, never "stress gauge" or
"stress sits in" (Why, correction 7). "Stress" appears only as the section's name and inside the
OFR inputs' own names and sentences, which do measure stress. Every score on the page carries its
band word, so a stress-direction sentence never stands beside an unlabelled greed-direction number.

**Frame**

- Metric (title in the loading and withheld states; loading `aria-label` "Loading Fear–greed gauge"): `Fear–greed gauge`
- Sub: `Seven public inputs · each a percentile of its own last 3 years · 0 = extreme fear, 100 = extreme greed · equal weights · published only when 5 of 7 are fresh`
- Finding templates (`{g}` integer, `{Band}` band name, `{a}`, `{b}` short names below):
  - Fear or Greed bands: `The fear–greed gauge reads {Band} ({g}): {a} and {b} lead` + optional positioning clause
  - Neutral, straddling: `The fear–greed gauge reads Neutral ({g}): {fearmost} pulls toward fear, {greedmost} toward greed` + optional clause
  - Neutral, calm: `The fear–greed gauge reads Neutral ({g}): no input is far from the middle` + optional clause
  - Positioning clause: `, positioning is neutral` · `, positioning leans fear` · `, positioning leans greed` · `, positioning is split`
  - Staging prefix: `In the sample, ` (and "The" becomes "the")
  - Short names: `volatility`, `credit`, `safe havens`, `equity stress`, `funding`, `vol positioning`, `equity positioning`
- Tag, production, from the `ofr` sources row (joined as in API → Wire):
  - published → `Computed` with detail `as of {OFR date, e.g. Oct 19}`; when that row is `last_good`, `Last good copy` with the same detail;
  - withheld → the cause's word: row `source_down` → `Source down`; `last_good` → `Last good copy`; `delayed` or `updated` (answered, but its newest day is too old) → `Delayed by source`.
  - Staging: no head tag. Spec 1's opt-in drops the forced `Demo · sample data` on `/research/markets`, and a passed `Computed` never shows on a sample board. The source chip is the frame's one mark.
- Gauge row: label `Fear–greed`; value `{g}`; then `{Band} · {n} of 7 inputs counted · as of {date}`. Withheld: value `—` (Sans, rule 24), then `{n} of 7 inputs counted, 5 needed`.
- Axis (≥ 768px): `Extreme Fear`, `Fear`, `Neutral`, `Greed`, `Extreme Greed`; ticks `0 25 45 55 75 100`. Phone: `Fear` … `Greed`, ticks `0` and `100`.
- Score column header (≥ 768px, once, above the scores): `Score · 0 fear – 100 greed`. Phone: no header; each score carries its band word (Rows).
- Note (ready): `Five of the seven inputs come from one OFR file: one method and one outage drive most of this gauge, and without a fresh file it publishes nothing. The OFR’s categories are blends of 33 market variables worldwide, not raw prices. The percentiles are Convexa’s own arithmetic. Research, not a signal.`
- Source chip, production: `OFR Financial Stress Index · CFTC TFF`, href `https://www.financialresearch.gov/financial-stress-index/`. The chip resolves to `/credits#ofr` through `creditsAnchor` (`ChartFrame.tsx:317`), as Liquidity's combined chip does (`LiquiditySection.tsx:134`), only because the OFR rule sits above the CFTC rule (Other routes).
- Source chip, staging: `Demo · shaped like OFR and CFTC data` (also resolves to `/credits#ofr`). It is the staging frame's one mark.
- As-of line, production: `OFR as of {Oct 19} · CFTC positions {Oct 13}`. Staging: `Scenario · Oct 7, 2026`.

**Rows** (name · what it is · raw format · sentence subject; credit lines below)

| Name | What it is | Raw format | Sentence subject |
|---|---|---|---|
| `Volatility` | `OFR FSI · Volatility` | `−0.007 · 0 = average stress` | `Volatility stress` |
| `Credit` | `OFR FSI · Credit` | `−0.947 · 0 = average stress` | `Credit stress` |
| `Safe haven` | `OFR FSI · Safe assets` | `−0.294 · 0 = average stress` | `Safe-haven stress` |
| `Equity stress` | `OFR FSI · Equity valuation` | `−0.503 · 0 = average stress` | `Equity valuation stress` |
| `Funding` | `OFR FSI · Funding` | `−0.142 · 0 = average stress` | `Funding stress` |
| `Vol positioning` | `CFTC TFF · VIX futures, leveraged funds` | `+0.2% of open interest, net long` | `Leveraged funds’ net VIX position` |
| `Equity positioning` | `CFTC TFF · E-mini S&P 500, asset managers` | `+47.4% of open interest, net long` | `Asset managers’ net E-mini S&P position` |

(Raw values above are the real 2026-10-19/13 values, as format examples. OFR raws use 3 decimals
with a true minus sign. CFTC raws use 1 decimal, with "net long" or "net short" in words so the sign
never rests on the glyph alone, P-11.)

- As-of: `as of {Oct 19}` (Mono 11px)
- Percentile sentence: p ≥ 50 → `{Subject} is higher than {round(p)}% of the last 3 years.`; p < 50 → `{Subject} is lower than {round(100 − p)}% of the last 3 years.` Rounding is half up, so 78.5 reads 79.
- Short window: `the last 3 years` becomes `the weeks since {Mon YYYY}` or `the days since {Mon YYYY}`.
- Score: `{round(score)}` (Mono) followed by its band word (Sans), the gauge's band function applied to the row's score rounded half up: `21 Extreme Fear`, `49 Neutral`, `69 Greed`. Accessible name `score 21 of 100, Extreme Fear`. Uncounted: `—` (Sans), no band word.
- Credit lines, **production**, exactly: rows 1–5 `Source: Office of Financial Research, OFR Financial Stress Index`; rows 6–7 `Source: CFTC Commitments of Traders (TFF)`.
- Credit lines, **staging**, exactly: rows 1–5 `Shaped like OFR Financial Stress Index data`; rows 6–7 `Shaped like CFTC TFF data`. The demo never credits a federal agency for authored values. The rows drop "Demo · " because the frame's source chip already says it, once. So this spec puts two forms on staging Markets: the frames' source chips, this one's included, read "Demo · shaped like …" (`MarketsPage.tsx:70`), and these credit lines read "Shaped like …". "Shaped like …" is the form spec 1 recommends for every demo label, and Markets mixes the two until that follow-up lands (spec 1, Open questions › Q4; README S1-Q4).
- Not counted:
  - `Not counted: {n} weekdays old, past the 5-weekday limit.`
  - `Not counted: {n} days old, past the 14-day limit.`
  - `Not counted: {OFR|the CFTC} didn’t answer and no earlier copy is kept.` (raw `unavailable`)
  - `Not counted: less than a year of history.`

**Withheld** (frame tag = the word; the first child = the word and the line, in the quiet form in Behaviour → Withheld; Try again only where a fetch failed; `{time}` is the `ofr` row's `checked_at`)

- `Source down` · `No reading today. The OFR didn’t answer and there is no earlier copy, so only {n} of the 7 inputs are fresh; the gauge needs 5.` + Try again
- `Last good copy` · `No reading today. The OFR hasn’t answered since {time}; its last copy ends {date}, too old to count, so only {n} of 7 inputs are fresh.` + Try again
- `Delayed by source` · `No reading today. The OFR’s file ends {date}, more than 5 weekdays ago, so only {n} of 7 inputs are fresh.` (open question 2)

**Table twin** ("Show the numbers", existing `TableTwin`)

- Caption: `Fear–greed gauge inputs: raw value, 3-year percentile and the 0–100 score averaged into the gauge (one decimal shown; the gauge averages the unrounded scores)`
- Columns: `Input`, `Source`, `As of`, `Raw`, `Window`, `Percentile`, `Higher means`, `Score`, `Band`, `Counted`
- **Cell register.** `TableTwin` renders every cell after the first as a Mono figure
  (`ChartFrame.tsx:385`), which would put `unavailable`, `—` and words like `OFR`, `fear` or `yes`
  in the figure register, against rule 24 (a not-a-number member renders as Sans, never as a figure)
  and rule 23 (Mono means a figure is Convexa's). `TableTwinData.rows` (`ChartFrame.tsx:36-41`)
  gains an additive text cell, `{ text: string }`, rendered in the body Sans without tabular
  figures; existing callers are unaffected. Spec 2 adds a link cell to the same row type,
  `{ text, href, label }`, rendered with `standaloneLinkSx` (spec 2, Behaviour › (d) Keyboard and
  focus, "The twin carries the per-trade detail"; its build step 5a). This spec builds after spec 2
  and defines its cell against that union: a cell is a string or number (a figure, Mono, as
  today), a link cell (it has `href`; spec 2's rendering, unchanged) or a text cell (no `href`;
  Sans). The renderer tells the two object cells apart by `href` alone. In this twin, dates and
  figures (As of, Raw, Window, Percentile, Score, the gauge row's `{n} of 7`) are plain cells (Mono). Source, Higher means, Band,
  the component rows' Counted (`yes` / `no`) and every `unavailable` or `—` are text cells (Sans).
  Other twins that already put `—` in Mono (for example `ComingUpSection.tsx:183`) are out of scope;
  they can adopt the text cell later.
- A no-data row: Raw `unavailable`, and `—` in As of, Window, Percentile, Score and Band, all text
  cells.
- Percentile and score show one decimal, rounded for display. Last row:
  `Gauge` · `Convexa` · `{OFR date}` · `—` · `—` · `—` · `—` · `{mean} → {g}` · `{Band}` · `{n} of 7`,
  where `{mean}` is the wire's unrounded `mean` shown to two decimals, **truncated**, not rounded
  (`50.15 → 50` on 2026-10-22), so a mean just under an edge never displays as the edge. The
  displayed one-decimal scores can average up to 0.05 away from it (method rule 6).
  When withheld, the gauge row reads `—` in Score and Band with `{n} of 7`.

**Page disclaimer** (`MarketsPage.tsx:249-252`)

- Production, inserted after the Liquidity sentence: `Stress: Office of Financial Research, OFR Financial Stress Index, and CFTC Commitments of Traders (TFF); the percentiles and the gauge are Convexa’s arithmetic.`
- Staging: `Sample data shaped like the Federal Reserve’s, the Treasury’s, the OFR’s, the CFTC’s, the BLS’s and the BEA’s files; nothing on this page is a real observation. Research and tools, not investment advice.`
  Today's line opens "Demo · sample data" (`MarketsPage.tsx:251`). Both D1 drafts make the demo bar the page's one "Demo · sample data" (spec 1, Open questions › Q1; spec 3, Open questions › Q2), so the rewrite drops "Demo · " and keeps "Sample"; that holds under either draft. The opening words are settled together with D1 and S1-Q4 (spec 1, Open questions › Q4): if the owner instead exempts the page-foot disclaimer from the one-bar rule, the line keeps "Demo · sample data". The rest of the sentence does not change either way.

**/credits OFR card** (`pages/trust/sources.ts`, after `cftc`)

- toc `OFR` · name `OFR Financial Stress Index` · owner `Office of Financial Research, U.S. Department of the Treasury`
- reads: `The index’s five category series (credit, equity valuation, safe assets, funding and volatility), every business day since 2000, from the OFR’s fsi.csv download. Convexa ranks each against its own last three years.`
- cadence: `Daily, about two business days late. Convexa checks every 6 hours.`
- terms: `Work of a U.S. federal agency: no copyright, and the OFR asks for credit. Convexa credits it on every row that uses it. The OFR presents the index for information only, not for financial decisions and not as investment or financial advice.`
- where: `Research → Markets, Stress (the fear–greed gauge).` · link `['OFR Financial Stress Index', 'https://www.financialresearch.gov/financial-stress-index/']` · shaped `the OFR’s daily stress index`
- State line on production (from `cardState.ts`'s new `case 'ofr'`, Other routes): `Delayed by source · as of {Oct 19}`.
- Older-server note: `This site’s server doesn’t read the OFR index yet.`
- CFTC card (`sources.ts:65-66`) reads: `Net positions of asset managers and leveraged funds in 10-year T-note, E-mini S&P 500 and E-mini Nasdaq-100 futures, and leveraged funds’ net position in VIX futures.` Its where: `Research → Markets (Positioning and Stress), and the positioning card under each ticker’s note.`

**/methodology `#fear-greed-gauge`**: heading `Fear–greed gauge`, prose:

1. `The fear–greed gauge in the Stress section of Research → Markets is built only from inputs Convexa may show. The familiar fear gauges (Cboe’s VIX and put/call ratios, CNN’s Fear & Greed) need a licence to show, so none is used.`
2. `Seven inputs: the five category series of the Office of Financial Research’s Financial Stress Index (volatility, credit, safe assets, equity valuation and funding) and two weekly CFTC series, leveraged funds’ net VIX futures and asset managers’ net E-mini S&P 500 futures, each as a share of open interest.`
3. `Each input is ranked against its own last three years: its percentile is the share of those days or weeks it sits above. Inputs where a higher value means more fear are flipped, so for every input 0 is extreme fear and 100 extreme greed: high stress reads low. The gauge is the plain average of the unrounded scores of the inputs that are fresh: a daily input counts for 5 weekdays after its date, holidays included, a weekly one for 14 days. With fewer than 5 of 7 fresh, no reading is published.`
4. `Bands are Convexa’s own: 0–24 Extreme Fear, 25–44 Fear, 45–55 Neutral, 56–75 Greed, 76–100 Extreme Greed. An edge belongs to the calmer band.`
5. `The cost: five of the seven inputs come from one OFR file, so one method and one outage drive most of the gauge, and in practice it publishes exactly when that file is fresh. The OFR’s categories are blends of 33 market variables worldwide (OFR working paper 17-04), not raw prices, and the file runs about two business days behind, so each row shows its own date. The gauge is research, not a signal, and not investment advice.`

What's live, production row: `['Fear–greed gauge (Markets, Stress)', 'Office of Financial Research; CFTC', 'Daily, about two business days late; CFTC weekly']`.
Staging row: `['Rates, positioning, stress, short data', 'shaped like Treasury, OFR, CFTC and FINRA']`.

## Design

Canon used: P-8 (border = provenance), P-9 (neutral, ordinal chart roles), P-10 (finding only over
data), P-11 (no sign by hue alone), P-13 (11px floor in chart text), rule 7 (44px touch floor),
rule 13 (figure cells, mono figures), rule 17 (no overflow at 390), rule 23 (type register), rule 24
(not-a-number set). Use
`ChartFrame` (`shared/charts/frame/ChartFrame.tsx:50`) with no `provenance` prop, so it takes the
board's (`ChartFrame.tsx:91-94`). Use `chartRoles` (`frame/roles.ts`): marker `emph`, track `band`
wash for the Neutral span, band edges `edge` hairlines, uncounted rows' marker `ctx2` plus their
"Not counted" line (never hue alone), axis `axis`.

- The gauge value is a figure cell (Mono, Convexa's computed number), never a heading. Its label is
  "Fear–greed", and every score (the gauge's and each row's) sits beside its band word, so the
  direction of the number is always said in words.
- Rows are an `<ol aria-label="The seven inputs">` in table order. They are never re-sorted by
  score, so day-to-day reading is stable.
- Bars are `aria-hidden`; the row's text carries everything. The bar is a 0–100 track with one
  marker and its score at the end.
- **Nothing green or red.** Fear and greed are carried by position and words. Amber is not spent
  here (rule 16 keeps it for the one primary action and the focus ring).
- The only interactive elements are of the existing kinds: the rail link, the source chip and
  "Show the numbers" (plus Try again in the withheld state, 44px). Credit lines are text, not links.
  Today those three kinds measure 32px, about 25px and 24px on a coarse pointer at 390, so **until
  spec 2 lands this section adds three sub-44px targets**; once it lands, each measures ≥ 44px.
  Build order: spec 2 first.
- No motion. No live dot. Not a dial (no semicircle, no needle).

Desktop (≥ 1000px; content is at most 1,240px wide, `NotesView.tsx:38`):

```text
Stress
A fear–greed gauge built only from data Convexa may show: …
┌ figure: solid on production · dashed + hatch on staging ───────────────────────────────────┐
│ The fear–greed gauge reads Neutral (50): vol positioning pulls      [Σ Computed · as of Oct 19]│
│ toward fear, equity stress toward greed                                                     │
│ Seven public inputs · each a percentile of its own last 3 years · 0 = extreme fear, …       │
│                                                                                             │
│ FEAR–GREED  50   Neutral · 7 of 7 inputs counted · as of Oct 19                             │
│                 Extreme Fear   Fear       Neutral  Greed        Extreme Greed   Score · 0 fear – 100 greed │
│                 0        25           45 ░░ 55          75                 100              │
│ Volatility       −0.007 · 0 = average  as of Oct 19 │──●───────┊──░░──┊─────────│ 21 Extreme Fear  Volatility stress is higher than 79% of the last 3 years. │
│ OFR FSI · Vol…   Source: Office of Financial Research, OFR Financial Stress Index           │
│ …five more rows…                                                                            │
│ Equity position. +47.4% of OI, net long as of Oct 13 │─────────┊──░░──┊──●──────│ 69 Greed  Asset managers’ net E-mini S&P position is higher than 69% … │
│ CFTC TFF · E-mini… Source: CFTC Commitments of Traders (TFF)                                │
│                                                                                             │
│ Five of the seven inputs come from one OFR file: … Research, not a signal.                  │
│ (OFR Financial Stress Index · CFTC TFF)   OFR as of Oct 19 · CFTC positions Oct 13          │
│ ▸ Show the numbers                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

Phone (390):

```text
┌───────────────────────────────────┐
│ The fear–greed gauge reads        │
│ Neutral (50): …                   │
│ [Σ Computed · as of Oct 19]       │
│ FEAR–GREED 50                     │
│ Neutral · 7 of 7 counted · Oct 19 │
│ Fear                        Greed │
│ Volatility       21 Extreme Fear  │
│ −0.007 · 0 = average · as of Oct 19│
│ [──●────────┊─░░─┊──────────────] │
│ Volatility stress is higher than  │
│ 79% of the last 3 years.          │
│ Source: Office of Financial       │
│ Research, OFR Financial Stress …  │
│ …six more rows…                   │
└───────────────────────────────────┘
```

The design source comes first: add the Stress board to `design/src/screens/final/planned.mjs`,
modelled on the Liquidity board (`planned.mjs:28`) through `marketsHost`
(`design/src/screens/final/planned-kit.mjs:139-141`, whose jump list gains `stress`). Add the OFR
card to `design/src/screens/final/trust-pages.mjs` SOURCES (`:82`) and the methodology section to
`design/src/screens/methodology.mjs`. Regenerate with `node design/src/build.mjs`. Never hand-edit
`design/canvas` or `design/site`.

## Data and licence

| | OFR Financial Stress Index | CFTC Traders in Financial Futures |
|---|---|---|
| Raw | `fsi.csv`: five category series used (of 9 columns); every business day from 2000-01-03 (nearly every weekday since 2022, holidays included); about two business days late | Socrata `gpe5-46if` (already read, `cftc.rs:11`): `1170E1` leveraged funds and `13874A` asset managers, long, short and `open_interest_all`; Tuesday data, out Friday 3:30 p.m. ET |
| Cost | $0 | $0 |
| Show it publicly | **Yes.** "No copyright may be claimed for any work … created by a federal employee"; credit requested (OFR legal notices, re-read 2026-10-22; `SOURCES.md:144`) | **Yes.** Public domain, acknowledgement requested (`SOURCES.md:145`) |
| Send it to a model | Not addressed (public domain). **Not done by this spec.** | Not addressed. **Not done by this spec.** |
| Source's own disclaimer | The FSI page's "General Disclaimer" (fetched 2026-10-22): the monitor is for information only, not to be relied on for financial decisions, and not investment or financial advice. Carried on the /credits card's terms. | Not re-read for this spec; the existing CFTC card is unchanged on this point |
| Credit line, production | `Source: Office of Financial Research, OFR Financial Stress Index` | `Source: CFTC Commitments of Traders (TFF)` |
| Credit line, staging | `Shaped like OFR Financial Stress Index data` (the values are authored, so no agency is credited for them) | `Shaped like CFTC TFF data` |

- The percentiles, scores, gauge and band are Convexa's own arithmetic on those inputs.
- Excluded, and never fetched: Cboe VIX and put/call (`SOURCES.md:151`), CNN Fear & Greed
  (`SOURCES.md:152`), ICE BofA spreads via FRED (`SOURCES.md:153-154`).
- Public pages show only public-domain or reuse-permitted data. Both inputs qualify, and both are on
  the owner's list of sources public pages may show. No licensed data (Massive, news) is involved,
  so nothing needs the owner's signed-in account.
- Residual note: the OFR builds its index from 33 market variables, some from commercial vendors.
  What Convexa shows is the OFR's published index, an OFR work, not those vendor series. The OFR
  publishes the file for download with only a credit request.

## Acceptance criteria

1. **The published number reproduces from the public files.** On production, the gauge integer, its
   band, the twin's unrounded mean (to 0.01) and each row's percentile (one decimal in "Show the
   numbers", within 0.1 points) equal an independent recomputation (the scratch script
   `tmp/ux-audit/spec-stress-gauge/worked_example_v2.py`, or any re-implementation of the method
   above). _Check:_ download `fsi.csv` and the CFTC rows, **cut them off at the as-of dates the page
   shows** (drop OFR rows after the page's OFR date and CFTC reports after its CFTC date), judge
   freshness on the page's `judged_on`, recompute, and compare with the table twin. The cut makes
   the check independent of the API's caches (OFR 6 hours, CFTC 12 hours, `mod.rs:179`), and it is
   sound because past values hold: an archived OFR file of 2026-03-30 has 0 changed cells against
   the 2026-10-22 file over 6,636 shared rows (measured by the review,
   `tmp/ux-audit/review-stress-gauge/vintage.py`).
2. **No number when fewer than 5 count.** In two served cases, (a) the OFR answered but is too old
   (`ofr` sources row `delayed`, its `as_of` 8 weekdays before `judged_on`, the five OFR
   components `reason: "stale"`) and (b) the OFR is down with no copy (`ofr` row `source_down`, the
   five OFR components `reason: "no_data"`), each with 2 of 7 counted: the title reads exactly
   "Fear–greed gauge"; the gauge row's value is "—" and no band word appears in the title, the gauge
   row or the twin's gauge row; the frame tag and the body's first element read "Delayed by source"
   (a) or "Source down" (b), followed by that cause's line from Copy → Withheld; a Try again button
   is present in (b) and absent in (a); `#stress ol > li` is still 7. This checks text and
   structure only, of the quiet form in Behaviour → Withheld; no `LoadFailure` renders. _Check:_
   Playwright `page.route` serves the local API's answer edited to each case; read the section's
   text and count the buttons.
3. **Placement.** On both builds the `h2` order is Rates, Positioning, Stress, Liquidity, Coming up.
   The rail reads `Rates · Positioning · Stress · Liquidity · Coming up`, and `#stress` scrolls into
   view from it. _Check:_ Playwright reads the `section[id]` order and the rail text.
4. **Seven rows, each dated and credited.** On both builds `#stress ol > li` count is 7, in table
   order, and each shows a raw value, its own `as of` date, a score with its band word and a
   percentile sentence. **On production** rows 1–5 contain exactly "Source: Office of Financial
   Research, OFR Financial Stress Index" and rows 6–7 exactly "Source: CFTC Commitments of Traders
   (TFF)"; the OFR rows' date equals the `as_of` of the answer's `ofr` sources row, which is the
   newest date in `fsi.csv` as the API last fetched it, and is at most 5 weekdays before the load
   date (Eastern); the CFTC rows' date is a Tuesday. (Not "two or three weekdays": a late or skipped
   OFR update legitimately makes it 4 or 5.) _Check:_ Playwright text read; read the `ofr` row's
   `as_of` and `checked_at`, then download `fsi.csv`: when its `Last-Modified` is earlier than
   `checked_at`, its newest date must equal `as_of`; otherwise the API has not re-read the newer
   file yet, and only the 5-weekday bound applies. Staging's exact strings are in criterion 5.
5. **Staging sample.** The title reads exactly "In the sample, the fear–greed gauge reads Fear (38):
   credit and volatility lead, positioning is neutral". The frame has `data-provenance="sample"`, a
   dashed border and no head tag: its one mark is the source chip, "Demo · shaped like OFR and CFTC
   data", and "Demo · sample data" appears nowhere in `#stress`. The five OFR rows read "as of
   Oct 5" and contain exactly "Shaped like OFR Financial Stress Index data"; the two CFTC rows read
   "as of Oct 6" and contain exactly "Shaped like CFTC TFF data". No row contains "Demo ·",
   "Source: Office of Financial Research" or "Source: CFTC". The missing tag comes from spec 1's
   ChartFrame opt-in (spec 1, Build plan › step 5), which waits on owner decision D1; if this ships
   before that step, the forced tag still shows in the head. It holds under either D1 draft. Spec
   1's (spec 1, Open questions › Q1) leaves a frame with a source line only that line. Spec 3's
   (spec 3, Open questions › Q2) has a frame name the sample exactly once, and a source chip that
   begins "Demo" counts as that mark in the foot, where `ChartFrame` draws this one
   (`ChartFrame.tsx:199`). The title begins "In the sample,", not "Sample", so it is no
   second mark. The row scores read 18 Extreme Fear, 12 Extreme Fear, 41 Fear, 44 Fear, 47 Neutral,
   53 Neutral, 51 Neutral. The table twin's seven scores average to
   38 (one decimal shown) and its gauge row reads "38.00 → 38". _Check:_ Playwright on
   `https://staging.convexa.pages.dev/research/markets` and a local `VITE_DATA_MODE=demo` serve.
6. **Only permitted inputs.** On production, the Stress section's text contains no "Cboe", "put/call",
   "CNN" or VIX index level. The only external hosts the API contacts for it are
   `www.financialresearch.gov` and `publicreporting.cftc.gov`. _Check:_ page text search; API logs
   during a cold `GET /api/public-data/markets`.
7. **Positioning is unchanged.** After the change, `futures` in the markets answer equals the answer
   from the previous build on the same day, apart from `fetched_at`: three markets, the same `weeks`,
   min, max, median and percentiles. _Check:_ diff the two JSON answers locally (old binary vs new,
   same hour, same UTC date).
8. **Credits and methodology.** The production chip ("OFR Financial Stress Index · CFTC TFF") and
   the staging chip ("Demo · shaped like OFR and CFTC data") both open `/credits#ofr`, not
   `/credits#cftc`. The OFR card is listed after CFTC with the state "Delayed by source · as of {OFR
   date}" on production. `/methodology#fear-greed-gauge` exists and states the 5-of-7 OFR
   concentration and the 33-variable blend. What's live lists "Fear–greed gauge". _Check:_ click
   both chips; the `anchor.spec.ts` cases (Verification); read both pages on both builds.
9. **Not sent to a model.** On staging, the SPY desk's "What's sent to the AI" drawer shows no field
   or line naming stress, the fear–greed gauge or the OFR (the staging demo makes no network calls,
   so there is no request body to inspect). And
   `git grep -n -i -e stress -e ofr -e "fear.greed" -- apps/dashboard/src/app/pages/ticker/widgets/ai-rec apps/api/src/services/recommendation.rs apps/api/src/routes/recommendation.rs`
   prints nothing and exits 1: neither the export drawer (`StateExportDrawer.tsx`) and its
   components nor the API's recommendation builder reads `stress`. At `8ef735c4` the same grep exits
   1. _Check:_ open the drawer and read it; run the grep and check its exit code.
10. **Phone, themes and touch.** At 390 and 1440, dark and light, on both builds:
    `documentElement.scrollWidth == clientWidth`; no text in `#stress` under 11px; with a coarse
    pointer at 390, after spec 2, zero interactive elements in `#stress` or the "Stress" rail link
    under 44px tall. If this ships before spec 2, exactly three are under 44px (the rail link, the
    source chip and "Show the numbers") and no others. _Check:_ extend
    `tmp/ux-audit/spec-stress-gauge/markets.mjs` with a `#stress` scope.
11. **No hue-only meaning.** No element in `#stress` uses the theme's success or error colour, and
    every uncounted row says "Not counted" in text. _Check:_ computed-style scan in the same script.
12. **Loading names its metric.** On a throttled cold load (Playwright, 3 s delay on the markets
    request), the Stress frame shows the title "Fear–greed gauge" over a skeleton, never a bare grey
    block. _Check:_ screenshot at 500 ms.
13. **Older API.** Against an answer without `stress`, the page shows no Stress section and no
    "Stress" rail link, and nothing errors in the console. _Check:_ `page.route` removes the field.
14. **Budgets.** The markets answer grows by at most 3 KB decoded (94,865 bytes on 2026-10-22).
    The local warm p95 of `GET /api/public-data/markets` over 20 requests stays within 10 ms of the
    previous build. The OFR file is fetched at most once per 6 hours while it answers (count the
    fetch log lines over a 7-hour local run, or reason from the TTL plus one test request). _Check:_
    `curl -w` timings and `--compressed` sizes, before and after.
15. **The partial states and the twin's register.** With the local answer edited by `page.route`:
    (a) **6 counted**: component `vol_positioning` `counted: false, reason: "stale", age: 15` → the
    gauge number shows, the gauge row reads "6 of 7 inputs counted", row 6's score is "—" and it
    reads "Not counted: 15 days old, past the 14-day limit."; (b) **CFTC row with no data**: both
    CFTC components `raw: null, as_of: null, reason: "no_data"` and the `cftc` sources row
    `source_down` → rows 6–7 show `unavailable` whose computed `font-family` is the Sans stack, not
    the Mono token, those rows have no bar element, each reads "Not counted: the CFTC didn’t answer
    and no earlier copy is kept.", and the gauge publishes on "5 of 7"; (c) **OFR on a last good
    copy**: the `ofr` sources row `last_good` with a fresh `as_of` → rows 1–5 show "Last good copy"
    beside their date and still count, and the frame tag reads "Last good copy"; (d) **twin
    register**: in "Show the numbers", every `unavailable`, `—`, `OFR`, `CFTC`, `fear`, `greed`,
    `yes`, `no` and band-word cell is Sans, and the Raw, Percentile and Score figures are Mono.
    _Check:_ Playwright text read and `getComputedStyle(el).fontFamily`.

## Verification

Risk-based, per CLAUDE.md. The scoring is logic that can fail silently and mislead on a public page:
a flipped sign, a stale input counted, or a number published from three inputs looks just as
plausible as the right answer. The OFR and CFTC readers are parsers. Those get tests. One frontend
case is added to an existing spec because it routes attribution on a public page and has already
been got wrong once in review: the credits anchor. Nothing else gets a test.

**Owed tests** (beside the code; mutation-check each by breaking the rule once and seeing it go red):

- `stress.rs`
  - Percentile over the trailing window: a dated series where the as-of value has a known rank;
    values dated before the 3-year cut are excluded; ties count half; `100 − p` equals the flipped
    score exactly.
  - Fewer than 3 years of history: a 2-year series is scored over what exists and reports
    `window_from`; an 11-month series is not counted, with reason `short_history`.
  - Flip direction per component: a table of all seven `higher_means`; with the as-of value the
    window's maximum, components 1–6 score 0 and component 7 scores 100.
  - Staleness: daily, as-of Mon, fresh on the next Mon (age 5), stale on Tue (age 6), with a weekend
    in between; weekly, fresh at 14 days, stale at 15.
  - Publish rule: 5 counted gives the mean of those 5 (the uncounted two excluded); 4 counted gives
    `published = false`, `gauge = null`, `mean = null`, `band = null`.
  - Band edges and rounding: 0, 24, 25, 44, 45, 55, 56, 75, 76, 100 map to the documented bands;
    a mean of 44.5 rounds to 45, Neutral; 55.49 rounds to 55, Neutral.
  - **Unrounded mean, not displayed values** (rule 6): five OFR series of 781 observations whose
    as-of value sits above exactly 433 of the other 780 (p = 55.5128, score 44.4872, displayed
    44.5) and the two CFTC components not counted. The gauge is 44, Fear, and `mean` is 44.4872;
    averaging the one-decimal scores would give 44.5 → 45, Neutral. The test fails if any step
    rounds before the mean.
  - `stress.as_of` (rule 9): with the OFR columns' as-of dates differing (one column's newest
    cell unparseable), it is the oldest counted OFR as-of.
- `ofr.rs` parser: columns found by name in a shuffled header; a blank cell is missing for that
  column only; an HTML body is an error; rows come out oldest first.
- `cftc.rs`: `open_interest_all` is parsed, and a row without it still counts for Positioning; with
  1170E1 rows present, `build()` still returns exactly the three `POSITIONING_MARKETS` (extend
  `cftc_rows_reduce_to_net_week_change_and_three_year_range`, `cftc.rs:200`); a report dated
  `fetched_on − 1,097 days` is absent from Positioning and present in the ratio series, and one
  dated `fetched_on − 1,096 days` is in both.
- `apps/dashboard/src/app/shared/credits/anchor.spec.ts` (existing): the three texts in Other
  routes resolve to `ofr`; mutation check: move the OFR rule below the CFTC rule and see the
  production chip case go red.
- The wire contract: `npm run api:contract:check` (the representative `stress` and the old-answer
  read).

No tests for the headline wording, the layout, the copy or the demo sample (CLAUDE.md: no UI, copy
or snapshot tests). Acceptance criteria 2–5, 10–13 and 15 check them by observation.

**Commands** (check exit codes, not summaries; the shell is zsh, so use `$pipestatus` or no pipe):

1. `npx nx test api` → exit 0 (runs `cargo test -p api-rust -p quant-engine` after
   `api-contract-check`, `apps/api/project.json:42-48`; through Nx, per CLAUDE.md)
2. `npx nx test @convexa/dashboard` and `npx nx typecheck @convexa/dashboard` → exit 0 (Vitest
   does not typecheck)
3. `npm run api:contract:check` → exit 0
4. `npm run verify` → exit 0 (needs `gitleaks`)
5. `npm run ports:free`, then `npm run serve:api` and `npm run serve:dashboard`; load
   `http://localhost:4200/research/markets` at 390 and 1440, dark and light. Then
   `VITE_DATA_MODE=demo npm run serve:dashboard` for the sample. Run the acceptance script on both.
6. After deploy: the same script against staging and production (read-only on production: no
   sign-in, no form).

## Build plan

Overall size **L**: a new reader and cache, a CFTC change, the scoring with its tests, the wire and
contract regeneration, a section with nine states, credits, methodology, the demo sample and the
design boards. It ships as **two changes**: the API (steps 1–4), then the frontend (steps 5–7),
after spec 2.

| # | Step | Files likely touched | Size |
|---|---|---|---|
| 0 | Design board, credits card and methodology section in the design source; regenerate | `design/src/screens/final/planned.mjs`, `planned-kit.mjs`, `trust-pages.mjs`, `design/src/screens/methodology.mjs` | S |
| 1 | CFTC: split `MARKETS` into `FETCH_CODES` (four) and `POSITIONING_MARKETS` (three); `open_interest_all`; the 1,117-day fetch and the Positioning filter on one `fetched_on`; ratio series; tests | `services/public_data/cftc.rs`, `mod.rs` (`futures_lookup`, `:515-530`), `types.rs`, `tests/fixtures/public_data/cftc_tff.json` (a copy with OI) | S |
| 2 | OFR reader, cache, `ofr` source row, off branch, stale note; parser test with a small fixture cut from the real file | `services/public_data/ofr.rs` (new), `mod.rs`, `sources.rs`, `fetch.rs` (the user-agent comment at `:8` names its sources; add the OFR), `tests/fixtures/public_data/ofr_fsi.csv` (new) | S |
| 3 | Scoring, pure, with the owed tests | `services/public_data/stress.rs` (new), `types.rs` | M |
| 4 | `stress` (with `mean`) on the markets answer and wire; representative; contract regenerate | `types.rs:211`, `mod.rs:223-350`, `routes/public_data.rs`; regenerated by `npm run api:contract:generate`: `apps/api/openapi/convexa.openapi.json`, `apps/api/openapi/parity-coverage.json`, `libs/api/src/generated/schema.ts`, `apps/api/openapi/generated-artifacts.manifest.json`, `apps/api/tests/fixtures/api_contract/boundary-evidence.json`; by hand: `libs/api/src/lib/convexa.ts` | S |
| 5 | Authored sample: scores 18, 12, 41, 44, 47 (OFR, as of Oct 5) and 53, 51 (CFTC, as of Oct 6); sum 266, `mean` 38.0, gauge 38, Fear; raws consistent in sign with each percentile | `libs/api/src/lib/demo/public-data.ts` (`demoPublicMarkets`, `:269`) | S |
| 6 | Section, rows, finding, states (the withheld frame as `ready`, with its own quiet line, no `LoadFailure`), loading frame, rail, disclaimer; the additive Sans text cell in `TableTwinData`, beside spec 2's link cell | `pages/research/StressSection.tsx` (new), `pages/research/stressRead.ts` (new, wording), `MarketsPage.tsx`, `shared/charts/frame/ChartFrame.tsx` (`TableTwinData`, `TableTwin`) | M |
| 7 | Credits card, anchor (rule placed third) and its spec cases, credits state (`case 'ofr'`), methodology section and What's live rows | `pages/trust/sources.ts`, `pages/trust/CreditsPage.tsx`, `pages/trust/cardState.ts`, `shared/credits/anchor.ts`, `shared/credits/anchor.spec.ts`, `pages/methodology/copy.ts` | S |
| 8 | Verification: the commands above, the acceptance script, screenshots in both schemes and widths | `tmp/ux-audit/…` (scratch) | S |

Step 6 needs step 4's generated types. Ship the API change first. An older dashboard ignores
`stress` (the wire is additive), and the new dashboard against an older API draws nothing
(criterion 13). `ChartFrame.tsx` is shared by every chart, and specs 1, 2 and 4 also edit it:
spec 1's opt-in (spec 1, Build plan › step 5), spec 2's summary floor, list of twins, link cell and
rows built on open (spec 2, Build plan › steps 3 and 5a), spec 4's warn head tag and
`LoadFailure` body (spec 4, Build plan › A1), and C2's move of the sample treatment into
`sampleFrameSx` (spec 4, Build plan › C2). Spec 2's link cell and this spec's text cell change
the same `TableTwinData` type and cell renderer; the other edits are separate hunks. The text cell
is additive, so whichever spec lands later rebases on the earlier ones; spec 2's comes first,
because this spec builds after it.

## Open questions for the owner

1. **Should VIX futures also get a fourth card in the Positioning section?** The data is fetched
   anyway. Showing it changes an approved section's layout and can change its finding.
   _Recommended: not in this change._ Row 6 states the raw ratio and its date; revisit once the
   gauge has run for a few weeks.
2. **Which word when the OFR answers but its newest day is too old** (for example, if the OFR
   stops publishing)? P-2 has no "stale" word. _Recommended: keep the closed set and use "Delayed by
   source" with the reason line,_ which names the date. A new word would need a canon amendment for
   one rare state.
3. **The sample's CFTC report is anachronistic.** Its report date, Oct 6
   (`demo/public-data.ts:286`), would be published Oct 9, two days after the Oct 7 scenario. Keeping
   it makes the sample's CFTC rows newer than its OFR rows, the reverse of most real days.
   _Recommended: keep Oct 6 now for consistency with the sample's Positioning section._ If you want
   it fixed, move the demo's CFTC report to Sep 29 across Positioning, the sample alerts
   (`libs/api/src/lib/demo/alerts.ts:57-65`) and Stress in one separate change.
4. **Build the public gauge and the OFR source ahead of analyst Phase 2?** `DESIGN.md:509` lists
   the Stress Gauge itself (OFR plus CFTC, VIX futures `1170E1`) as a Phase 2 deliverable, gated on
   the Q5 eval, and `DESIGN.md:501` says new sources come only after that eval passes. The same
   Phase 2 row lists the Treasury curve and the calendar, which already ship publicly (Rates; Coming
   up, `calendar.rs`, `DESIGN.md:99`) with no model reading them. _Recommended: yes, on that
   precedent._ The public section and the OFR reader ship now; `get_stress_gauge` and the Q5 eval
   stay in Phase 2, and no model reads the gauge until the eval passes. If approved, append one
   line under `DESIGN.md` §7 (supersede, never rewrite) recording that sequencing, so no reader
   takes this spec as skipping the eval gate. If not, this spec waits for Phase 2.
