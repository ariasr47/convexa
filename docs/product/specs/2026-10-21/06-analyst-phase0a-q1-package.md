# AI analyst Phase 0, first slice: a reproducible, cutoff-bound Q1 context package from SEC data (no model)

_Proposal, 2026-10-21; revised 2026-10-22 after a skeptic pass. Kind: analyst-slice. Size: L.
Depends on: none. The build needs the owner's go-ahead on Phase 0 (DESIGN.md §8.1) or on this slice
alone. It brings Phase 1's Q1 package builder forward (open question 1)._

Checked against `main@791ebd88` on 2026-10-22, then re-checked at `main@e1bdc487`. No file this spec
cites changed between the two: the three commits in between touched `routes/`, `error.rs`,
`chain_snapshot/` and the dashboard. No file this spec cites had uncommitted edits.

## Why

DESIGN.md §7 lists seven Phase 0 pieces and three exit gates (DESIGN.md:507). This slice is the
smallest piece that passes one of those gates on its own: "The builder, re-run on stored inputs and
cutoff, reproduces the same `package_id` (test)."

That gate needs a builder, but DESIGN lists "The Q1 package builder" under Phase 1 (DESIGN.md:508).
Phase 0 lists only acceptance-time parsing and cutoff-relative windows. This slice therefore brings
the Q1 builder forward without the seven cutoff-bound tools, the model or truncation. The gate can't
be tested without a builder.

Every later analyst phase depends on facts placed at a point in time: the eval items at frozen
cutoffs (DESIGN.md:308-309), replays (:195-196), the paper record (:365-376) and the deterministic
baseline (:386). Today's SEC code can't produce such facts, for six reasons.

1. **No acceptance time is read anywhere.** `acceptanceDateTime` appears 0 times in `apps/api/src`
   and `libs/api/src` (grep, 2026-10-22). The submissions parser reads only `filingDate`
   (`edgar.rs:94-110`, the column at `:98-99`), and its row type holds a date (`edgar.rs:74-82`).
   The 13F manager index works the same way (`edgar_13f.rs:152-162`, `:156-157`; `ThirteenF` at
   `:110-115`). A company-facts point carries `filed` as a date only (`edgar.rs:389-395`). Yet EDGAR
   sends the time: both checked-in submissions answers have the column (`sec_submissions_nvda.json`,
   16 rows; `sec_real_submissions_nvda.json`, 1,000 rows).
2. **Insider trades are placed by trade date** (`insider_trades.rs:5`, filter at `:331`). On
   production, 129 of NVDA's 194 timeline trades were filed 1 to 5 days after the trade (65 on the
   same day, 17 one day later, 86 two, 6 three, 15 four, 5 five). If a cutoff falls in that gap, a
   package built by trade date would hold a trade nobody had seen yet.
3. **Every window is measured from today.** The window functions already take a date: `in_window`
   (`edgar.rs:190-192`), `recent_filings` (`:195-200`), `form4_rows` (`:230`), `history` and
   `history_rows` (`insider_trades.rs:317`, `:411`), and `quarters` (`edgar_13f.rs:96`). But both
   callers pass today: `mod.rs:570` passes the Eastern date and `mod.rs:1025` the UTC date. The 13F
   quarter is chosen from that same today (`mod.rs:1094`, then `edgar_13f.rs:891`).
4. **The figures reader isn't cutoff-aware.** `parse_filed_facts` keeps the latest four periodic
   filings in today's file (`filed_figures.rs:260-275`, `KEEP_FILINGS = 4` at `:69`). For a cutoff
   a year back, every filing it keeps would be newer than the cutoff.
5. **No canonical form covers numbers.** `serde_json` is built with `preserve_order`
   (`apps/api/Cargo.toml:43`), so a `Value` serialises in insertion order.
   - `bin/export_openapi.rs:9-23` already sorts keys recursively on that ordered `Map`. But it lives
     in a binary the lib can't import, and it leaves numbers to `serde_json`, which writes an
     integral `f64` as `46700000000.0`.
   - The lib's one helper named `canonical` is a plain `to_vec` (`capacity/identity.rs:123-125`).

   The key sort follows the exporter. What is new here is the number rule.
6. **The ticker map can resolve a ticker differently from run to run.** `parse_company_tickers`
   reads `company_tickers.json` into a std `HashMap`, walks `map.values()` and keeps the first CIK it
   meets for each ticker (`edgar.rs:51-55`, `:65`). The comment at `:65` expects tickers listed
   twice. For such a ticker, the winning row depends on the map's random seed. Two builds on the same
   saved inputs could resolve different CIKs and give different `package_id`s.

**What the wire carries today.** A read-only probe on 2026-10-22 at 07:29 UTC
(`tmp/ux-audit/spec-analyst-phase0a-q1-package/probe.mjs`) made two public GETs on production:

- `/api/public-data/filings?tickers=NVDA` returned 6 filings with `filed` dates from 2026-08-14 to
  2026-09-03. No key contains "accept".
- `/api/public-data/tickers/NVDA` returned a 90-day insider card covering 16 Form 4s. The 365-day
  timeline had 83 Form 4s, 80 of them read, reaching back to 2025-10-31, with 194 trades. 25 sales
  came from 6 Form 4s filed in the last 90 days. The holders were for the quarter to 2026-06-30
  against 2026-03-31, state `delayed`. 12 of 12 managers were read and 12 hold NVDA, but only 8 are
  shown. `total_pct` (33.15) and `total_change_pts` (1.70) are computed over every holding manager
  before the list is cut to 8 (`edgar_13f.rs:737-745`).

These answers are saved as `probe.json`, `prod-filings-nvda.json` and `prod-ticker-nvda.json` in
the same scratch folder, which isn't committed. There are no screenshots because no page changes.

**The timezone of `acceptanceDateTime` is unsettled, and it moves every cutoff boundary by 4 to 5
hours.** EDGAR writes the value with a `Z`. The checked-in real answer
(`sec_real_submissions_nvda.json`: 1,000 rows, fetched 2026-10-15, "no value edited" per commit
`8720d03a`) fits neither plain reading. A scratch script checked each row against EDGAR's filing
hours (06:00 to 22:00 Eastern) and against the rule that a filing is accepted on or before its
`filingDate`:

| How the value is read | Rows inside 06:00–22:00 ET | Rows accepted on or before `filingDate` |
|---|---|---|
| As a true UTC instant | 677 | 885 |
| As Eastern wall time with a wrong `Z` | 69 | 73 |
| As the true instant moved later by New York's UTC offset (4 h in summer, 5 h in winter) | 999 | 999 |

The one row the third reading misses is an SEC-generated EFFECT notice at 00:15 ET. The third reading
also puts 24 of NVIDIA's 25 results 8-Ks (Item 2.02) between 16:20 and 16:52 ET, summer and winter
alike, which is the usual after-the-close release time. The 25th, 2022-08-08, lands at 09:16 ET.

Example: in the real index, `0001045810-26-000073` has the value `2026-08-27T00:21:19Z`. The third
reading makes it 16:21:19 EDT on 2026-08-26.

So the parser rule is the first build step, checked against EDGAR's own filing header, and it is not
assumed here (Build plan, step 0). Every wrong reading lands later than the third one. A wrong rule
therefore never leaks the future, but it would drop real filings near an event, such as the results
8-K in an eval item cut at 17:00 ET on earnings day.

**Corrections to the inputs this spec was given:**

- `edgar.rs:191` is the body of `in_window`, not a test. The window test is `edgar.rs:767-828`, with
  its assertion message at `:786`.
- The windows already take a date argument (point 3). "Count back from a cutoff that defaults to now"
  therefore needs no new parameter. The package passes the cutoff, and the public callers keep
  passing today, so the public paths need no signature change.
- `vocabulary.ts` has no `StateWord` type. The closed set is `DataStateKey` (`vocabulary.ts:11-26`),
  which has 15 keys. DESIGN's `StateWord` (DESIGN.md:149) is a 10-word subset of it, without
  `couldntLoad`, `demo`, `signIn`, `thirdParty` and `local`.
- The XBRL join on `accn` can't live in `filed_figures.rs`, because that reader isn't cutoff-aware
  (point 4). The package joins on the company-facts points in `edgar.rs` instead: `parse_company_facts`
  keeps every point of its 14 concepts (`edgar.rs:486-553`). `filed_figures.rs` is untouched.
- `RawRecent` spans `edgar.rs:94-110`. Line 90 is `RawFilings`.

**Why now:** the slice is free and reads only SEC data. It changes one thing a visitor could notice:
a ticker that EDGAR lists twice now resolves to SEC's first row every time (point 6). It closes one
named Phase 0 exit gate with offline tests, which makes it the smallest step from the design to
working code.

**Alignment with spec 05.** This spec follows spec 05, so the server package and the browser read
share one set of line kinds. Spec 05 maps its kinds onto this package's four sections (spec 05,
Why › What the audit changed in the idea, item 7):

| Spec 05 kind | Section here |
|---|---|
| `filing` | `filings` |
| `insider` | `insider_trades` |
| `holders` | `holders` |
| `figures` | `fundamentals` |

Spec 05 also has two kinds with no section here:
- **`shortInterest`:** FINRA is Off in production, and FINRA is not in Q1's Phase 1 package.
- **`calendar`:** this is not SEC data; DESIGN §7 adds it in Phase 2.

The two specs differ in one place. Spec 05 folds the periodic report's accession into its `figures`
line (spec 05, Behaviour › Line kinds, the `filing` row). This package keeps that filing in
`filings` as well, so a reader that wants spec 05's view removes it by accession. Spec 05's window
note already expects this package's `S < accepted ≤ C` (spec 05, Behaviour › The window, "How this
differs from spec 6").

Spec 05's open question 1, "The 13F zero-prior rows" (spec 05, Open questions for the owner; README
D3), is about 13F managers that show zero shares in the prior quarter. It also governs this
package's holders change facts. Until the owner answers it, the package follows spec 05's
recommendation (here: Behaviour › Sections, the `holders` row).

## Who and when

- **The owner, on their own machine (never production).** "Before I trust any analyst answer about
  NVDA, I want to rebuild the exact facts it would have seen at 16:00 ET on 16 October, from saved
  SEC responses, and get the same id every time. A Form 4 filed the next morning must not be in it."
- **A recruiter or reviewer, in the repo.** Staging shows nothing new; the evidence is in the
  repo. They run the CLI twice on the checked-in fixture and see the same id. Stderr tells them the
  fixture is illustrative. They read a test in which a filing accepted one second after the cutoff
  is left out, and one accepted exactly at the cutoff is kept. Once spec 05 ("what changed since")
  ships, its staging section can name the package it mirrors.

## Scope and non-goals

**In scope:**

1. **Acceptance time.**
   - Parse `acceptanceDateTime` beside `filingDate`: an `accepted: Option<DateTime<Utc>>` on
     `SubmissionRow` and on `ThirteenF`, read with the rule step 0 settles.
   - The time carries through to filings, 13F reports, Form 4s (through their submissions row) and
     XBRL points (through a join on the accession).
   - Rows whose acceptance time is missing or unparseable keep `accepted: None`. The public answers
     ignore the field.
   - A pure reader of a submissions page's reach: its oldest `filingDate`, and whether
     `filings.files` lists older pages.
2. **Cutoff windows.** The package filters by exact instants:
   - `since < accepted <= cutoff` for filings and Form 4s;
   - `accepted <= cutoff` for 13F reports and XBRL points.

   The existing date-window functions are reused only where they take the cutoff's Eastern date
   (`quarters`, `history`). The public callers are unchanged.
3. **A stable ticker map.** `parse_company_tickers` walks its entries in the numeric order of their
   keys (`"0"`, `"1"`, …), which is SEC's own order, before "first wins". The public site gets the
   same fix.
4. **Source-aware pure readers.** These are behaviour-preserving refactors in `edgar.rs` and
   `edgar_13f.rs`. Each new function returns the `FactPoint`s it chose, with their accessions. The
   existing function becomes a thin wrapper over it, so the public answers are unchanged by
   construction, and test (iv) checks it.
   - `fact_point_for` under `fact_for`;
   - `periodic_rows` under `periodic_filings`;
   - `shares_outstanding_point` under `shares_outstanding`;
   - `shares_outstanding_near_point` under `shares_outstanding_near`;
   - `holder_rows` under `holders_for`. It gives every holding manager before truncation, or the
     reason there is no match.
5. **The package builder.** A new module, `apps/api/src/services/analyst/`:
   - `package.rs`: the types and a pure `build`;
   - `canonical.rs`: the canonical serialiser and the id;
   - `inputs.rs`: saved inputs, plus the live fetch loop.

   It builds DESIGN §3's `Fact` and `ContextPackage` for Q1 from SEC data only. Each section adds a
   `coverage` record (open question 6).
6. **The CLI.**
   `api-rust package q1 <TICKER> --cutoff <RFC3339> [--save-inputs <dir>] [--inputs <dir>] [--out <file>]`.
7. **Tests** that guard the data contract, run offline from a small checked-in fixture.

**Not in scope:**

- **Phase 1's other pieces:** the seven cutoff-bound tools, any model, and truncation to the token
  budget (it needs persona weights, DESIGN.md:285).
- **Later Phase 0 slices:**
  - 0b: the owner role and gate, and the `context_packages` and `analyst_answers` tables;
  - 0c: the persona config sent in full;
  - 0d: the per-user AI cap;
  - 0e: the notes read API at a commit;
  - 0f: the scorer's price key (DESIGN §8.2).
- **Anything that could reach a user:** a model call, an HTTP route or any UI.
- **Changes to how the site works**, beyond the ticker-map order:
  - 13F-HR/A and Form 4/A amendments (the site doesn't read them either: `edgar_13f.rs:126-137`,
    `edgar.rs:233`, `insider_trades.rs:415`);
  - reading the older submissions pages listed under `filings.files`. A page that doesn't reach far
    enough is refused or recorded (Behaviour, "Page reach");
  - peers (frames are not point-in-time, DESIGN.md:185).
- **A known mismatch, left as it is.** The ticker card counts its 90 days from the UTC date
  (`mod.rs:1025`), while the filings list counts from the Eastern date (`mod.rs:570`). This slice
  doesn't change either; the package uses exact instants.

## Behaviour

**The command.** `api-rust package q1 NVDA --cutoff 2026-10-16T20:00:00Z [--save-inputs D | --inputs D] [--out F]`
is a clap subcommand beside `JoinOutcomes` (`main.rs:50`, `:121-137`; dispatch at `:732-740`).

- **Live mode** (no `--inputs`):
  - checks the cutoff against the clock first, and only then reads `SEC_USER_AGENT`, so a bad
    cutoff fails before any client exists;
  - fetches through a `SecGate` with the existing 200 ms spacing (`fetch.rs:141-161`, `mod.rs:53`),
    using the existing size caps;
  - `--save-inputs D` writes every response to `D` as it arrives.
- **Replay mode** (`--inputs D`) reads only `D`. It reads the manifest, checks the cutoff against
  it, and builds. It builds no HTTP client and never reads `SEC_USER_AGENT`.
- **The package command opens no database.** It needs no `DATABASE_URL`.
- `--inputs` together with `--save-inputs` is a usage error.
- `--out` defaults to `data/research/analyst/q1_<TICKER>_<YYYYMMDDTHHMMSSZ>.json`. `/data/` is
  gitignored (`.gitignore:105`), as `join-outcomes` output already is (`main.rs:131`).

**One pure builder, two ways to feed it.**
- `build(request, inputs) -> Result<ContextPackage, Need>` reads responses by URL and never does
  I/O. When a response it needs is absent, it returns `Need::Fetch(urls)`.
- **Live mode** loops: build, fetch what's missing through the gate, build again. That takes at
  most 4 rounds:
  1. the ticker map;
  2. the submissions index, the company facts and the 12 manager indexes;
  3. Form 4 documents and the 13F filing indexes for both quarters;
  4. information tables.
- **Replay mode** calls `build` once. A `Need` there is an error.

Live and replay therefore run the same function on the same bytes.

**Saved inputs format.**
- `D/manifest.json` holds `{"format":1,"entries":[{url, status, fetched_at, sha256, bytes}]}`,
  sorted by URL.
  - A hand-built fixture adds `"illustrative": true` at the top level. `--save-inputs` never
    writes it.
  - Replay of such inputs prints the "illustrative" line (Copy).
- `D/blobs/<sha256>` holds each body as received after gzip decoding.
- A 404 is recorded with `status: 404` and no blob.
- **No request header is stored:** the User-Agent holds the owner's email.
- **Replay** checks that each blob it uses exists and matches its sha256.
- `--save-inputs` refuses a directory that already has a `manifest.json`.
- The output file is written to a temporary path and renamed, so a failed run writes nothing.

**What a 404 means, by URL kind.** `Http::get` returns `Ok(None)` for a status listed as absent and
an error for any other non-200 status (`fetch.rs:59-72`, `:104`). The builder lists 404 as absent
for the kinds below. A 404 is either fatal or recorded in the section's `coverage`:

| URL | A 404 is | Where it shows |
|---|---|---|
| The ticker map | fatal | "SEC EDGAR did not answer" |
| The issuer's submissions index | fatal | "SEC EDGAR did not answer" |
| The issuer's company facts | recorded: the issuer files no XBRL | `fundamentals.coverage.company_facts: "absent"`; `holders.coverage.match: "no_company_facts"` |
| A Form 4 document | recorded as unread | `insider_trades.coverage.unread` |
| A manager's submissions index | recorded as unread | `holders.coverage.unread`, why `index_absent` |
| A 13F filing index | recorded as unread | why `filing_index_absent` (or `no_table_listed` when it names no information table) |
| An information table | recorded as unread | why `table_absent` |

Any other failure is fatal for every kind and writes nothing: another non-200 status, a timeout, or
a size cap.

**Page reach.** EDGAR's `filings.recent` holds at most 1,000 rows. Older rows sit in the pages
listed under `filings.files`, which this slice doesn't read.
- **The issuer's index** must reach the window. If `filings.files` is non-empty and the oldest row's
  `filingDate` is on or after `since`'s Eastern date, the build fails with the "reaches back only"
  line.
  - The real NVDA page reaches back to 2020-09-17.
  - Otherwise `fundamentals.coverage.index_from` records the oldest date on the page, because older
    XBRL priors may sit beyond it. When there are no older pages, it is `null`.
- **A manager's index** must reach the quarter it is read for. A 13F-HR for a quarter is filed after
  the quarter ends. So a page whose oldest row is dated on or before the quarter's end holds every
  such report.
  - If `filings.files` is non-empty and the oldest row is later than that, the manager is recorded
    as unread for that quarter, with why `index_short`.

**Time rules.**
- `cutoff` is RFC 3339 in whole seconds, stored as UTC with a `Z` (`2026-10-16T20:00:00Z`, always 20
  bytes).
- **A cutoff in the future is refused.**
- **A cutoff must be at least one hour before the inputs were read:** before now in live mode, and
  before the earliest `fetched_at` in replay.
  - EDGAR's JSON shows a filing after it is disseminated and processed, not at the instant of
    acceptance. A read made just after the cutoff could miss a filing accepted just before it.
  - The hour is a margin chosen here, not a measured delay. The margin keeps the read time out of
    the package, so criterion 2 still holds.
- `since` is the cutoff minus 90 × 24 hours, as DESIGN.md:218 says: "90 days back from the cutoff".
  - DESIGN's other default, the previous answer's cutoff for the ticker, needs a stored answer. So
    does the stored "since I last looked" stamp, which is set when an answer is opened
    (DESIGN.md:216-218). This slice adds no table and serves no answer (Scope and non-goals, Not in
    scope), so here `since` is always the cutoff minus 90 days.
- Every `as_of` and `checked_at` uses the same 20-byte format.

**Timezone guard (live mode).** After parsing the submissions index, the CLI counts rows whose
acceptance time falls outside 06:00–22:00 Eastern or after their `filingDate`. Above 1% it aborts.
Otherwise it prints the count (Copy).
- The fixture measurements above put a right rule at 0.1% and the wrong ones at 32% or more.
- The guard is the standing check that the step 0 rule still holds.

**Sections.**

All four sections share these rules:
- every raw fact has `source: { id: "sec_edgar", url, licence: "reuse_permitted" }`;
- computed facts have no url;
- the `state` words come from `vocabulary.ts:33-35` (`updated`, `delayed`, `computed`);
- **a count cites one fact per thing it counts, and a total cites every term it sums.** So the
  package emits a fact for every Form 4 read and every 13F-HR read. It also emits every holding
  manager's shares, not only the 8 the site shows;
- each section has a `coverage` record of what it couldn't read or place (below).

| Section | What it holds (cutoff C, since S) | `state` |
|---|---|---|
| `filings` | One fact per submissions row with S < accepted ≤ C, insider forms excluded as on the site (`edgar.rs:163-166`). Value: the form (`"8-K"`). Label: the form, any items and the kind from `classify` (`edgar.rs:168-188`). URL: the primary document (`edgar.rs:36-43`). | `updated` |
| `insider_trades` | **Per Form 4:** each Form 4 (form `"4"`) with S < accepted ≤ C is fetched. A read document that names this issuer (`own_issuer`, `insider_trades.rs:95-97`) gives one `form4` fact (value `"4"`), whatever its transaction codes. A document for another issuer is counted in `coverage`. **Per trade:** each P or S trade in a read own-issuer document gives a shares fact and, when priced, a price fact (`parse_form4_doc`, `:101-152`). Roles and their numbering come from `history` (`:317-408`), called with C's Eastern date. **Computed:** purchases and shares bought, sales and shares sold, and trades under a 10b5-1 plan, each citing its trades. Form 4 filings read cites the `form4` facts. Buying clusters and sale windows (`windows`, `:242`) each cite the trades in their windows. Display elsewhere stays by trade date (DB-08, `design/src/screens/final/planned-spec.mjs:156`). | `updated`; aggregates `computed` |
| `holders` | **The read:** `quarters(C's Eastern date)` gives the quarter Q and the prior quarter P (`edgar_13f.rs:96-104`). For each of the 12 managers (`:37-50`), the builder takes the latest original 13F-HR for Q, and the one for P, with accepted ≤ C. That is `report()`'s rule (`:128-137`) plus the cutoff. The builder assembles the `Dataset` itself in pure form, following `read_quarter`'s loop (`:803-862`) without its cache. It keeps each report's acceptance time beside the `Dataset`, so `ManagerReport` is unchanged. `holder_rows` runs on it. **Per report read for Q:** a `13f.report` fact. **Per holding manager (every one):** shares at Q. At P, either shares, or a `13f.prior_absent` fact (`true`) when P's report was read but doesn't list the security. **Computed per manager:** % of shares outstanding; the change in basis points only when the manager held the security in both quarters. A zero-prior manager gets no change fact. That follows the recommended answer to spec 05's open question 1, "The 13F zero-prior rows", since such a row may be a missed read, not a purchase (`edgar_13f.rs:707-713`). **Totals:** managers read, managers holding, total %, total change. A total exists only when it has a term, and it sums only the facts emitted. So while a zero-prior manager exists, the total change differs from the site's `total_change_pts`. On production NVDA, the site's 1.70 points include Norges Bank's 1.35 from a zero prior, which the package's total leaves out. The probe can't show whether any of the 4 managers the site doesn't show is also zero-prior. **Shares outstanding:** the cutoff-filtered points nearest Q and P (`shares_outstanding_near_point`). They are emitted once, in `fundamentals`, and cited from here. **Receipts (ADRs):** shares facts carry no unit and say "depositary receipts"; no % or change facts (`:695-701`). | `delayed` (as the site says, `edgar_13f.rs:652`); derived values `computed` |
| `fundamentals` | **Filter first:** company-facts points whose accession is in the submissions index with accepted ≤ C. A point that can't be joined is left out and counted in `coverage`. **Then:** `periodic_rows` picks the latest two 10-Q/10-K/20-F/40-F among rows accepted ≤ C. That is the selection `periodic_filings` makes (`edgar.rs:683-719`). For each `FACT_GROUPS` group (`:574-624`), `fact_point_for` gives the value point and the prior point with their accessions, as `fact_for` chooses them (`:635-679`). **Each XBRL point is one fact,** emitted once even when it is one filing's value and another's prior. Each value with a prior gets a computed % change citing both. **Shares outstanding:** the latest point (`shares_outstanding_point`), plus the points `holders` cites. | `updated`; changes `computed` |

**Coverage.** Each section carries a `coverage` object beside `facts` and `tokens`. It is part of
the canonical JSON, so it enters `package_id`.
- It states what the section couldn't read or place. A gap is part of the package, never only a
  stderr line.
- Gaps are not facts, because some have no acceptance time to stamp, such as a manager index that
  returns 404.
- Every key is always present, and lists are sorted.

| Section | `coverage` keys |
|---|---|
| `filings` | `no_acceptance_time`: rows dated within the window's Eastern dates that have no acceptance time and are left out. |
| `insider_trades` | `form4_listed`, `form4_read`, `other_issuer`; `unread`: the accessions of Form 4 documents that returned 404. |
| `holders` | `managers_listed` (12); `match`: one of `found`, `ambiguous`, `not_held`, `no_company_name` or `no_company_facts`; `ambiguous_titles`; `units`: `shares`, `receipts` or `null`; `not_filed`: CIKs with no 13F-HR for Q by the cutoff; `unread`: one `{cik, quarter, why}` entry per manager and quarter that couldn't be read. The `match` values carry the cases the site turns into its detail text (`edgar_13f.rs:678-692`; `holders_part`, `:876-889`). |
| `fundamentals` | `company_facts`: `read` or `absent`; `points_unjoined`: a count; `index_from` (Page reach). |

**Fact rules.**

- **`id`** is `${source}:${series}:${key}:${as_of}`. No series or key contains `:`, so the id splits
  on its first three colons.

  | Fact | `series` | `key` |
  |---|---|---|
  | A filing | `filing` | its accession |
  | A Form 4 read | `form4` | its accession |
  | A trade's shares and price | `form4.shares`, `form4.price` | `accession.n`, where n counts the P/S trades in document order |
  | Insider aggregates | `insider.purchases`, `insider.shares_bought`, `insider.sales`, `insider.shares_sold`, `insider.plan_trades`, `insider.form4_read`, `insider.clusters`, `insider.sale_windows` | `TICKER.<since compact>` |
  | A 13F-HR read | `13f.report` | `managerCIK.quarterEnd` |
  | 13F shares, or a prior position absent | `13f.shares`, `13f.prior_absent` | `managerCIK.quarterEnd` (P's end for prior-quarter facts) |
  | Per-manager % and change | `13f.pct`, `13f.change_bp` | `managerCIK.quarterEnd` (Q's end) |
  | 13F totals | `13f.managers_read`, `13f.managers_holding`, `13f.total_pct`, `13f.total_change_bp` | `TICKER.quarterEnd` |
  | An XBRL point | `xbrl.{taxonomy}.{Concept}.{unit}`, such as `xbrl.us-gaap.Revenues.USD` or `xbrl.dei.EntityCommonStockSharesOutstanding.shares` | `accession.periodEnd.{span}`, with span `q` (quarter), `y` (year) or `i` (instant) |
  | An XBRL change | `xbrl.{group}.change_pct`, such as `xbrl.Revenue.change_pct` | the value point's key |

  - `<since compact>` is `since` written `YYYYMMDDTHHMMSSZ`, such as `20260715T000000Z`.
  - `quarterEnd` and `periodEnd` are `YYYY-MM-DD`.
  - The XBRL series names the concept and unit, and the key names the span. Two different points
    therefore never share an id. For example, a 10-K can tag a quarter and a year that end on the
    same day.
- **One fact per id.** Reaching the same id twice with the same value and unit keeps one fact. The
  same id with a different value or unit fails the build.
  - In the fixture, 000073's Revenue prior is 000052's own Revenue value point. That point is one
    fact, cited by both filings' change facts.
- **`as_of`**:
  - **a raw fact:** the acceptance instant of the filing it was read from. For an XBRL point, that
    is the accession that reported the point, not the filing whose prior it serves as.
  - **a computed fact:** the latest `as_of` among its `derived_from`, or the cutoff when it has none
    (a count of zero).

  Every `as_of` is at or before the cutoff by construction, and the builder asserts it.
- **`checked_at`** is the `fetched_at` of the response the fact came from. A computed fact takes the
  latest among the responses it read.
- **`derived_from`** is present on every computed fact. It lists ids that exist in the package, in
  any section. It is empty only for a count of zero.
- **`unit`** comes from DESIGN's set:
  - XBRL `USD` and `USD/shares` become `USD`, and the label says "per share";
  - `shares` stays `shares`;
  - another currency gets no `unit`, and its code goes in the label;
  - 13F holdings in depositary receipts get no `unit`, and the label says so;
  - `%` for `13f.pct`, `13f.total_pct` and every `xbrl.*.change_pct`;
  - `bp` for `13f.change_bp` and `13f.total_change_bp`, because DESIGN's set has no "points" (open
    question 4);
  - counts and booleans have no `unit`.
- **Numbers:**
  - An integral value below 2^53 is written as an integer.
  - Any other finite value is written in Rust's shortest round-trip form.
  - Computed values are rounded to 4 decimal places first, so no value needs an exponent.
  - `-0` is written as `0`.
  - The builder refuses a value that isn't finite.
- **Order:** facts within a section are sorted by `as_of` (newest first), then `id`; `omitted` is
  sorted by section.

**The package.**
- `schema_version: 1`, `question: "Q1"`, the ticker as typed and uppercased, `since` and `cutoff`.
- `persona: null` until 0c sends the persona in full (open question 3).
- `omitted: [{ "section": "research_note", "reason": "not_built" }]`, because the note can't be read
  before 0e (open question 2).
- **Sections:** each holds `facts`, `coverage` and `tokens`, with no `truncated` key in this slice.
- **Tokens:** a section's `tokens` is ceil(bytes of the section's canonical JSON without its
  `tokens` key ÷ 4), an estimate with no token-count call. Because `checked_at` is always 20 bytes,
  changing it can't change `tokens`.
- **Budget:** `budget.max_tokens` is 8000 (DESIGN.md:221). `budget.used` is the sum of the
  sections' `tokens`.

**Canonical JSON and the id.**
- **Canonical JSON:**
  - object keys sorted by byte order (every key is ASCII), the same sort as
    `bin/export_openapi.rs:9-23`;
  - no whitespace;
  - `serde_json`'s string escaping;
  - the number rule above.
- `canonical.rs` writes the bytes itself, because the number rule can't go through `serde_json`'s
  float printer. The exporter stays as it is, because `api:contract:check` pins its output.
- **The id:** `package_id` is the lowercase hex sha256 of the canonical JSON with `package_id` and
  every `checked_at` removed.
- **The file:** the canonical JSON of the full package, including `package_id` and the
  `checked_at` values, with no trailing newline.
- **Independent check:** `jq` 1.7.1 keeps number literals as written, so it can recompute the id
  outside Rust.

**Example fact.** It comes from the hand-built fixture, and `as_of` waits on step 0's rule.

```json
{"as_of":"<acceptance instant>","checked_at":"2026-10-15T00:00:00Z","id":"sec_edgar:filing:0001045810-26-000084:<acceptance instant>","label":"8-K, items 1.01, 2.03, 9.01 (financing)","source":{"id":"sec_edgar","licence":"reuse_permitted","url":"https://www.sec.gov/Archives/edgar/data/1045810/000104581026000084/nvda-20260912.htm"},"state":"updated","value":"8-K"}
```

The hand-built fixture's accession numbers and values are illustrative and don't match real filings.
- `0001045810-26-000084` doesn't exist.
- `0001045810-26-000073` is a 10-Q in the hand-built index. In the real index it is NVIDIA's
  2026-08-26 results 8-K.
- Criterion 13 uses the real index.

**States of the CLI:**

- **Loading:** one stderr line per live round.
- **Empty:**
  - `filings` and `fundamentals` hold `facts: []`;
  - `insider_trades` and `holders` hold only their zero counts, with empty `derived_from` and the
    cutoff as `as_of`;
  - `coverage` says what was looked at;
  - `omitted` is only for sections that aren't built.
- **TSM:** the Q1 caveat (DESIGN.md:77-79) applies, and criterion 15 checks it:
  - no Form 4s;
  - 13F rows in receipts, so no % or change facts (`edgar_13f.rs:695-701`);
  - IFRS figures in TWD, with no `unit`.
- **Error:** exit 1 with one stderr line, and nothing written. The cases:
  - no `SEC_USER_AGENT` in live mode;
  - an unknown ticker;
  - a cutoff in the future, or less than an hour before the inputs were read;
  - a saved input that is missing, whose blob is missing, or whose blob has changed;
  - an issuer index that doesn't reach back to `since`;
  - two facts with one id and different values;
  - an SEC fetch failure (see "What a 404 means");
  - the timezone guard tripping.

  A package is either complete or says in `coverage` exactly what it lacks. There is no last good
  copy, which keeps `state` a pure function of the inputs.
- **Usage error:** exit 2 (clap). That covers a bad `--cutoff`, or `--inputs` with
  `--save-inputs`.
- **Sample (staging), Not live (production), signed out, phone width:** not applicable. There is
  no route and no UI.
- **Every route and every public API answer is unchanged, with one exception.** A ticker listed
  twice in EDGAR's map now always resolves to SEC's first row. No wire type gains a field;
  acceptance stays on the internal row types.

## Copy

**stdout:** the 64-character `package_id`, then a newline. Nothing else, so scripts can capture it.

**stderr, on success:**

- `These inputs are illustrative: hand-built SEC answers whose accession numbers and values don't match real filings.` (only when the manifest says `illustrative`)
- `SEC EDGAR, round {r}: {n} requests.` (live only)
- `Acceptance times: {n} of {m} rows outside EDGAR's hours or after their filing date.` (live only)
- `Q1 package for {TICKER}. Cutoff {cutoff}, since {since}.`
- `Facts: filings {n}, insider_trades {n}, holders {n}, fundamentals {n}. Omitted: research_note (not built until slice 0e).`
- `Gaps: {a} Form 4s unread, {b} managers unread, {c} company-facts points unjoined, {d} filings without an acceptance time.` (only when any is above 0)
- `Tokens: {used} of 8000 (estimate: canonical bytes / 4).`
- `Over the core budget. This slice cuts nothing; Phase 1 decides what goes.` (only when used > 8000)
- `Written to {path}.`
- `Inputs saved to {dir}: {count} responses, {MB} MB.` (live with `--save-inputs`)

**stderr, on error** (exit 1). These lines are printed through `main.rs:430-437`, which adds the
`error: ` prefix.

- `SEC_USER_AGENT is not set. A live read needs it, because sec.gov asks every client to identify itself. A replay with --inputs does not.` (also when it is set but empty)
- `SEC_USER_AGENT is set but is not a valid HTTP header value.` (existing string, `edgar.rs:14-15`)
- `SEC EDGAR lists no company under {TICKER}.` (existing wording, `mod.rs:1005`)
- `The cutoff {cutoff} is in the future. A package can only hold facts accepted by then.`
- `The cutoff {cutoff} is less than an hour before these inputs were read ({fetched_at}). A filing accepted just before it may not have reached EDGAR's JSON yet.`
- `The saved inputs have no response for {url}. Run live with --save-inputs to capture it.`
- `The manifest lists {url}, but its saved body blobs/{sha256} is missing.`
- `The saved response for {url} has changed on disk (its sha256 differs from the manifest).`
- `The submissions index for {TICKER} reaches back only to {date}, and the window opens {since}. Older pages aren't read in this slice. Nothing was written.`
- `Two facts share the id {id} with different values. Nothing was written.`
- `SEC EDGAR did not answer {url}: {kind}. Nothing was written.`
- `Acceptance times don't fit EDGAR's hours: {n} of {m} rows fall outside 06:00–22:00 Eastern or after their filing date. The timezone rule needs checking. Nothing was written.`

**Usage** (exit 2): `--cutoff must be an RFC 3339 time in whole seconds, such as 2026-10-16T20:00:00Z.`

**Fact labels** contain digits only in four places: dates, form names, item numbers and the rule name
`10b5-1`. Counts are spelled out, and role ordinals are letters.
- The first three are on the citation check's allowlist (DESIGN.md:358-359).
- The rule name joins the allowlist in the DESIGN amendment (step 8). It names a rule and carries no
  value.

So a number in an answer can only match a fact's `value`.

| Fact | Label template |
|---|---|
| A filing | `{form}, items {a, b} ({kind})`, with kind one of `results`, `financing`, `periodic report`, `ownership`, `other` |
| A Form 4 read | `Form 4 read, accepted {YYYY-MM-DD}` |
| A trade's shares | `{Sale or Open-market purchase} by {role}, traded {YYYY-MM-DD}`, plus `, under a 10b5-1 plan` when flagged |
| A trade's price | `Price per share, {sale or purchase} by {role}, traded {YYYY-MM-DD}` |
| Insider aggregates | `Open-market purchases`, `Shares bought on the open market`, `Sales`, `Shares sold`, `Trades under a 10b5-1 plan`, `Form 4 filings read in the window`, `Buying clusters (three or more insiders within ten days, none under a plan)`, `Sale windows (three or more insiders within ten days)` |
| 13F | `{Manager} 13F-HR read, quarter to {Mon D, YYYY}`; `{Manager} shares held, quarter to {…}` (or `depositary receipts held`); `{Manager} shows no position in the prior quarter's 13F read, quarter to {…}`; `{Manager} % of shares outstanding, quarter to {…}`; `{Manager} change since the quarter to {…}, basis points of shares outstanding`; `Managers read`; `Managers holding`; `All managers holding, % of shares outstanding`; `All managers held in both quarters, change in basis points` |
| XBRL | A point: `{Group label}, {quarter or year} to {YYYY-MM-DD}, as reported in the {form} accepted {YYYY-MM-DD}`, or for a balance-sheet instant `{Group label} at {YYYY-MM-DD}, as reported in …`. A change: `{Group label}, change from the {quarter or year} to {YYYY-MM-DD} to the {quarter or year} to {YYYY-MM-DD}`. Shares outstanding: `Shares outstanding (cover page, {YYYY-MM-DD}), as reported in the {form} accepted {YYYY-MM-DD}`. A non-USD value ends `, in {CODE}` (`, in TWD`; per share: `, TWD per share`). |

**Roles.** `history` numbers a role that several insiders share (`insider_trades.rs:349-364`). On
production NVDA that gives "Director 1" to "Director 6". The package writes the ordinal as a letter
(1 → A, …, 26 → Z, 27 → AA), so "Director 3" becomes "Director C". The site's chart keeps its
numbers.

**Manager names.** No digit appears in the 12 managers' EDGAR names, as the probe and
`edgar_13f.rs:37-50` give them on 2026-10-22.

**State words:**
- The package uses three of the closed set: `updated`, `delayed` and `computed`.
- A later browser read renders them as `Updated`, `Delayed by source` and `Computed`
  (`vocabulary.ts:33-35`) without any mapping.
- No new word is added.

## Design

There is no UI, so no token, component or layout changes, and nothing from DESIGN_SYSTEM.md's Banned
list (`:211-233`) is involved.

The one design-system tie is the state vocabulary. The Rust type has only the three words the
package emits. A Rust test reads `vocabulary.ts` and asserts that each of the three is a
`DataStateKey`, in the way `filed_figures.rs:803-811` already reads `filing-check.mjs`.

The `coverage` key, the `not_built` reason and the `10b5-1` allowlist entry change DESIGN's own
types and rules, not the site's canon. They go into the appended DESIGN amendment (step 8; open
questions 2 and 6).

## Data and licence

- **Source:** SEC EDGAR, through four endpoints: the submissions index, Form 4 documents, 13F filing
  indexes with their information tables, and company facts. The ticker map is read as well. Step 0
  reads three filing headers once.
- **Cost:** $0.
- **Fair access:** 10 requests a second with an identifying User-Agent (SOURCES.md:88). The gate's
  200 ms spacing holds the CLI to half of that (`fetch.rs:141-142`).
- **Display licence:** reuse is permitted, and credit is requested. Filings are company works, not
  public domain (SOURCES.md:88, DESIGN.md:95). This slice displays nothing.
- **AI licence:** not addressed in SEC's terms (SOURCES.md:88). No model call happens in this slice.
  The owner gate becomes mandatory at 0b, before any model call or Massive data (DESIGN.md:440-444,
  SOURCES.md §1).
- **Licence field:** every fact carries `licence: "reuse_permitted"`. There is no licensed,
  owner-only or FINRA data.
- **The User-Agent.** Owner ruling (1) of 2026-10-15 lets build lanes use the production
  `SEC_USER_AGENT` locally, only for sec.gov, "to save real SEC responses as fixtures"
  (DESIGN_SYSTEM.md:285). The ruling names the features those fixtures serve, and two of this
  slice's requests fall outside it:
  - Step 0's three header GETs are not for a named feature, so the spec asks for them by name (open
    question 5). Their slices are committed as fixtures.
  - Criterion 14's live run (about 80 requests saved under the gitignored `/data/`) produces no
    fixture. It is a verification run under the owner's identity, so the owner makes it, not a
    lane.

  A build lane makes no other request to sec.gov.
- **Where responses are stored:**
  - Raw responses from the owner's run stay under `/data/`, which is gitignored.
  - The manifest never stores the User-Agent.
  - The SEC bytes committed are the small fixture: hand-built answers plus slices of real ones, as
    commit `8720d03a` already did.
  - Also committed: the first lines of three filing headers, up to and including
    `ACCEPTANCE-DATETIME`, with no filer or reporting-owner block.
- **Volume of a live NVDA run, estimated:**
  - Requests:
    - 1 ticker map, 1 submissions index and 1 company-facts answer;
    - about 16 Form 4s (the probe's 90-day count);
    - 12 manager indexes;
    - up to 24 filing indexes and 24 information tables (12 managers, two quarters).

    That comes to about 80 requests, which takes 16 s or more at 200 ms each.
  - Bytes: State Street's Q2 table is 2,305,887 bytes (`sec_real_13f_index_statestreet.json`).
    The other managers' tables weren't measured. Each table is capped at 64 MiB
    (`edgar_13f.rs:57`).

  The owner's run records the real totals.

## Acceptance criteria

The fixture is `apps/api/tests/fixtures/analyst/q1/` (Build plan step 6). It serves NVDA and TSM.

- `R` stands for `cargo run -q -p api-rust -- package q1 NVDA`.
- `B` stands for the built binary, `target/debug/api-rust package q1 NVDA`, after
  `cargo build -p api-rust`.
- `NONET` stands for `sandbox-exec -p '(version 1)(allow default)(deny network*)'`.
  - On this machine, on 2026-10-22, a connect to `127.0.0.1:9` under it failed with "Operation not
    permitted". Without it, the same connect failed with "Connection refused".

1. **The same id twice.**
   - **Check:** run `R --cutoff 2026-10-13T00:00:00Z --inputs <fixture> --out tmp/a.json` and the
     same command with `--out tmp/b.json`.
   - **Expect:** both exit 0, both print the same 64-character hex id, and `cmp tmp/a.json tmp/b.json`
     exits 0.
2. **`checked_at` doesn't move the id, and the content does.**
   - **Check:** copy the fixture and rewrite every `fetched_at` in its manifest to
     `2026-10-20T00:00:00Z`, then replay.
   - **Check, separately:** in another copy, change one value in a blob. Rename the blob to its new
     sha256, and update that entry's `sha256` and `bytes` in the manifest. Then replay.
   - **Expect:** the rewritten copy prints the same id as criterion 1, while every `checked_at` in
     its output differs. The changed blob prints a different id.
3. **Independent recompute.**
   - **Check:** run
     `jq -jcS 'del(.package_id) | walk(if type=="object" then del(.checked_at) else . end)' tmp/a.json | shasum -a 256`.
   - **Expect:** the first field equals the printed id.
4. **The cutoff is inclusive, to the second.**
   - **Check:** read the `as_of` of the filing fact for `0001045810-26-000084` in `tmp/a.json` (call
     it `T`). Run with `--cutoff T`, then with `--cutoff T-1s`.
   - **Expect:** with `--cutoff T`, `jq '.sections.filings.facts[].id'` lists that accession. With
     `--cutoff T-1s`, it doesn't.
5. **Placed by disclosure, not by trade date.**
   - **Check:** run with `--cutoff 2026-10-05T00:00:00Z`, then with `--cutoff 2026-10-08T00:00:00Z`.
   - **Expect:** at Oct 5, no fact id contains `0001045810-26-000089`, although its trades are dated
     2026-10-03. At Oct 8, its `form4` fact appears, and so do its two sales, each as a shares fact
     and a price fact.
6. **Every fact obeys the contract.** A `jq` pass over a package finds:
   - every `licence` is `reuse_permitted`;
   - every `state` is one of `updated`, `delayed` or `computed`;
   - every `as_of` is at or before `cutoff`, and every filings or insider fact's `as_of` is after
     `since`;
   - ids are unique;
   - every `derived_from` id exists in the package;
   - every computed fact with an empty `derived_from` has the value 0;
   - `insider.form4_read` equals the number of `form4` facts;
   - `13f.managers_holding` equals the number of `13f.shares` facts at Q;
   - every `13f.pct` fact is cited by `13f.total_pct`.

   It runs on `tmp/a.json` and on the owner's live package (criterion 14).
7. **The package shape.**
   - `schema_version` is 1 and `question` is `"Q1"`.
   - `since` equals the cutoff minus 90 days.
   - `persona` is null, and `omitted` is `[{"reason":"not_built","section":"research_note"}]`.
   - Each of the four sections has exactly the keys `coverage`, `facts` and `tokens`.
   - `budget.max_tokens` is 8000, and `budget.used` equals the sum of the four sections' `tokens`.
8. **XBRL points are emitted once and joined on the accession.** At the fixture cutoff:
   - The Revenue point `0001045810-26-000052.2026-04-26.q` is exactly one fact, with the `as_of` of
     000052. Both change facts cite it: 000073's as its prior, and 000052's as its value.
   - 000052's change fact also cites the quarter-to-2025-07-27 point read from
     `0001045810-26-000073`, which has the `as_of` of 000073.
   - The public answer uses the quarter to 2025-10-26 instead (`edgar.rs:922`). That point's filing,
     `0001045810-25-000230`, isn't in the fixture's index, so the package leaves it out.
     `fundamentals.coverage.points_unjoined` is 2 (the 000230 and 000180 Revenue points).
   - The change fact's label names both periods, so the skipped quarter is visible rather than
     silent.
9. **Replay needs no network and no User-Agent.**
   - **Check:** `SEC_USER_AGENT= NONET B --cutoff 2026-10-13T00:00:00Z --inputs <fixture>`.
   - **Expect:** exit 0 and the id from criterion 1.
   - **Why an empty value, not an unset one:** `main()` loads `apps/api/.env` for every command
     (`main.rs:344-376`, `:391`), and that file exists. `dotenvy` doesn't override a variable that
     is already set, even to an empty value.
10. **Incomplete inputs fail loudly.**
    - **Check:** in one copy of the fixture, delete one blob and keep its manifest entry. In another,
      remove one manifest entry. Replay each.
    - **Expect:** both exit 1 and write no output file. The first prints the "blob is missing" line,
      and the second the "no response" line. Each names the URL.
11. **Bad cutoffs are refused.**
    - Live, with `SEC_USER_AGENT=` and under `NONET`: `B --cutoff 2030-01-01T00:00:00Z` exits 1 with
      the future-cutoff line. Neither the User-Agent line nor a "did not answer" line appears, so no
      client was built and no request was tried.
    - The fixture was "read" at 2026-10-15T00:00:00Z. Against it, `--cutoff 2026-10-14T23:00:00Z`
      exits 0, and `--cutoff 2026-10-14T23:00:01Z` exits 1 with the one-hour line.
    - `--cutoff 2026-10-13T00:00:00.5Z` exits 2.
12. **The site is unchanged.**
    - `npx nx test api` exits 0. The diff in the existing `public_data` tests is only the added
      `accepted: None` lines in the 8 test `SubmissionRow` literals (`edgar.rs:941`, `:970`;
      `insider_trades.rs:593`; `filed_figures.rs:651`, `:706`; `calendar.rs:653`, `:729`;
      `mod.rs:1495`).
    - `npm run api:contract:check` exits 0, and `git diff --stat libs/api/src/generated` is empty.
13. **The timezone rule is settled and recorded.**
    - The PR lists three filings, giving each one's EDGAR header acceptance time (Eastern) beside the
      parsed instant. All three are equal:
      - `0001045810-26-000073` (8-K, summer, in the real index);
      - `0001045810-26-000019` (8-K, winter);
      - `0001197647-26-000011` (Form 4).
    - The three header slices are committed, and test (v) reads them.
    - In the owner's run (criterion 14), the `Acceptance times:` line reports at most 1% of rows.
14. **A live run reproduces (the owner runs it).**
    - **Check:** with `SEC_USER_AGENT` set, the owner runs
      `R --cutoff 2026-10-16T20:00:00Z --save-inputs data/research/analyst/inputs/nvda-20261016T200000Z`,
      then `R --cutoff 2026-10-16T20:00:00Z --inputs` on the same directory.
    - **Expect:** both exit 0 and print the same id. Criterion 6's pass holds on the package. That
      includes a `13f.shares` fact at Q for every holding manager: the probe found 12, and the site
      shows 8.
    - **Report:** the request count, the bytes saved, the token estimate, and both sections'
      `coverage.unread`.
15. **TSM replays with its caveats.**
    - **Check:** `cargo run -q -p api-rust -- package q1 TSM --cutoff 2026-10-13T00:00:00Z --inputs <fixture>`.
    - **Expect:**
      - exit 0;
      - `filings.facts` is `[]`;
      - `insider_trades` holds only zero counts, and its `coverage.form4_listed` is 0;
      - `holders.coverage.units` is `receipts`. No fact in the package has unit `%` or `bp` except
        `xbrl.*.change_pct`. State Street's `13f.shares` facts have no `unit`, and their labels say
        "depositary receipts";
      - every fundamentals fact read from a TWD point has no `unit`, and its label contains `TWD`;
      - criterion 6's pass holds.
16. **13F change facts are built.** At the fixture cutoff, `holders` has:
    - State Street's `13f.shares` at 2026-06-30 and at 2026-03-31;
    - its `13f.pct` and `13f.change_bp`, each citing both quarters' shares and the shares-outstanding
      points in `fundamentals`;
    - `13f.total_change_bp`, citing that change fact.

    `holders.coverage.unread` has 22 entries: each of the 11 other managers for both quarters, with
    why `index_absent`.

## Verification

**Tests owed under the risk rule.** These guard a parser and a data contract. A wrong `as_of` or a
drifting id is a silent failure that would quietly corrupt every eval item and replay built on it.
Each new test must be shown failing once, with the change that broke it named in the PR.

Unit tests in `services/analyst/`, `public_data/edgar.rs` and `public_data/edgar_13f.rs`:

- **(i) Reproducible id.**
  - Build three times from the fixture. Each `HashMap` gets its own random seed, but that only tests
    something where the fixture holds an order to get wrong. The fixture's ticker map therefore lists
    NVDA twice: SEC's row under key `"0"`, and a second row with a CIK the fixture has no answers
    for. A wrong pick fails with "no response".
  - Then build with every `fetched_at` changed: the id is equal and the `checked_at` values differ.
  - With one blob's value changed, the id differs.
- **(ii) Cutoff boundary.** For the parsed acceptance instant A of `0001045810-26-000084`, a cutoff
  of A includes it and A − 1 s excludes it. The test is stated in parsed instants, so it holds
  whatever rule step 0 sets.
- **(iii) Disclosure time.** At cutoff `2026-10-05T00:00:00Z`, Form 4 `0001045810-26-000089` is
  excluded (trades dated 2026-10-03). At `2026-10-08T00:00:00Z` it is included.
- **(iv) The public output is unchanged.**
  - All existing `public_data` tests pass with no assertion edits. `edgar.rs:768-828` still lists the
    same six filings and three Form 4s.
  - A new assertion checks that `parse_submissions` gives `accepted` on 16 of 16 hand-built rows and
    1,000 of 1,000 real ones.
  - `parse_company_tickers` on a map whose file order differs from its key order resolves a
    duplicate ticker to the row under the lower key.
- **(v) The timezone rule is pinned.**
  - The three committed header slices give the instants that `accepted_at` produces for those rows.
  - Run the guard over the real fixture: the chosen rule passes (at most 1%), and a deliberately
    wrong rule trips it.
- **(vi) The canonical serialiser.** A golden string pins it:
  - keys out of insertion order;
  - nested objects;
  - `0`, `-0`, `0.0001`, `1.08`, `178.2`, `46700000000` and `24300000000`;
  - a refused `NaN`.
- **(vii) The vocabulary contract.** The three state words the package emits are `DataStateKey`
  members in `vocabulary.ts`.
- **(viii) Source-aware readers agree with the public ones.**
  - On the hand-built and real NVDA company facts and the real TSM ones, for both periodic filings,
    `fact_point_for` gives the value, prior value and period ends that `fact_for` gives.
  - On a synthetic `Dataset` of nine holding managers, `holder_rows` returns nine rows. One of the
    managers holds the security at Q, and its P report was read without it. The package then emits:
    - nine `13f.shares` facts at Q;
    - a `13f.prior_absent` fact and no change fact for that manager;
    - totals whose `derived_from` lists every term.
- **(ix) Coverage is recorded.**
  - At the fixture cutoff, `insider_trades.coverage.unread` is `["0001045810-26-000077"]`.
  - In a fixture copy whose State Street index lists older pages and starts after Q, State Street is
    `unread` with why `index_short`.
  - The same edit to the issuer's index fails with the "reaches back only" line.

**Commands, each checked by exit code:**

- `npx nx test api` runs `cargo test -p api-rust -p quant-engine` (`apps/api/project.json`).
  - Expect exit 0.
  - The suite printing a pass count is not enough, because CLAUDE.md records a suite that printed
    "1004 passed" and exited non-zero.
- `npm run api:contract:check`, expect exit 0.
- `npm run verify`, expect exit 0. It runs gitleaks (`brew install gitleaks`) and, because a Rust
  path changed, the `api` project.
- The two fixture replays and the `cmp` from criterion 1, then the `jq` recompute from criterion 3.
- The network-denied replay from criterion 9, and the TSM replay from criterion 15.
- A byte scan of every new source and fixture file for NUL. Expect 0 in each, checked with
  `python3 -c "import io;print(io.open('FILE','rb').read().count(bytes([0])))"`.
- The owner's live NVDA run and its replay (criterion 14). A lane doesn't run it.

**Performance:**

- **A fixture replay** finishes in under 1 s wall time, measured with `time` after a warm build.
- **A live NVDA run** finishes in under 5 minutes. Its floor is about 80 requests at 200 ms. Its
  real cost is the information tables, so record the bytes.

**What gets no test:** CLI wording, progress lines and the default output path.

**No CI.** Actions is off; everything above runs locally.

## Build plan

0. **Settle the timezone (XS), after the owner's yes to open question 5.**
   - **Fetch** the EDGAR header (`<accession>.hdr.sgml`) for the three anchor filings in criterion
     13: three GETs through the gate, using the owner ruling's User-Agent.
   - **Commit** each header's first lines, up to and including `ACCEPTANCE-DATETIME`, as
     `apps/api/tests/fixtures/public_data/sec_real_header_<accession>.txt`. They have no filer or
     reporting-owner block.
   - **Cross-check** against NVIDIA's results release at about 16:20 ET.
   - **Write the rule** as one function, `accepted_at(raw) -> Option<DateTime<Utc>>`, with the
     evidence in its doc comment. The fixture predicts this rule: the true instant is the UTC
     instant with the same digits as the value's New York wall time. If the headers disagree, the
     headers win.
   - **Record the outcome** in the PR and in the DESIGN amendment (step 8).
1. **Acceptance parsing and the ticker order (S).** Steps 1 and 2 change no public answer and can
   merge on their own.
   - `edgar.rs`:
     - the `acceptanceDateTime` column on `RawRecent` (`#[serde(default)]`);
     - `SubmissionRow.accepted` and `accepted_at`;
     - the hours guard as a pure function;
     - the page-reach reader;
     - `parse_company_tickers` in key order;
     - `is_insider_form` made `pub(crate)`.
   - `edgar_13f.rs`: the same column, `ThirteenF.accepted`, and
     `ManagerIndex::report_accepted_by(period, cutoff)`.
   - Add `accepted: None` to the 8 test literals listed in criterion 12.
   - Tests (iv) and (v).
2. **Source-aware readers (S).**
   - `edgar.rs`:
     - `fact_point_for`, with `fact_for` mapping its result into `Fact`;
     - `periodic_rows`, used by `periodic_filings`;
     - `shares_outstanding_point`, wrapped by `shares_outstanding`.
   - `edgar_13f.rs`:
     - `shares_outstanding_near_point`, wrapped by `shares_outstanding_near`;
     - `holder_rows`. `holders_for` calls it, then builds its detail strings and totals and
       truncates to 8, as it does now.
   - `types.rs` is unchanged: `Fact` and `DatedValue` keep their fields, and the new functions
     return `&FactPoint`, which already carries `accession` (`edgar.rs:389-395`).
   - The first half of test (viii).
3. **Types and the canonical form (S).** `services/analyst/{mod.rs, package.rs, canonical.rs}`:
   - `Fact`, `ContextPackage`, the per-section `Coverage`, and a `StateWord` with only `updated`,
     `delayed` and `computed`;
   - the serialiser and `package_id`, using `sha2` and `hex`, which are already dependencies
     (`apps/api/Cargo.toml:44`, `:33`);
   - `services/mod.rs` gains `pub mod analyst`;
   - tests (vi) and (vii).
4. **The builder (M).** `build(request, inputs) -> Result<ContextPackage, Need>`, the four sections
   with their coverage, and the pure 13F `Dataset` assembly. It reuses:
   - `classify` and `document_url` from `edgar.rs`;
   - `parse_form4_doc`, `own_issuer`, `history` and `windows` from `insider_trades.rs`;
   - `parse_manager_index`, `info_table_name`, `parse_info_table`, `quarters` and `holder_rows` from
     `edgar_13f.rs`;
   - `parse_company_tickers`, `parse_company_facts`, `periodic_rows`, `fact_point_for`,
     `shares_outstanding_point` and `shares_outstanding_near_point`.
5. **Inputs and the CLI (S).**
   - `inputs.rs`: manifest read and write, the blob and sha checks, and the live loop on its own
     `Http` plus a `SecGate`. It never prints the User-Agent; `SecUserAgent`'s `Debug` already
     redacts it (`config.rs:177-179`).
   - `main.rs`: `Package { #[command(subcommand)] q: PackageQuestion }` with
     `PackageQuestion::Q1 { ticker, cutoff, save_inputs, inputs, out }`.
     - It conflicts on `--inputs`/`--save-inputs` and uses an RFC 3339 whole-second value parser.
     - It checks the cutoff before reading the User-Agent.
     - It calls a `pub` entry in `api_rust::services::analyst`. Errors map to exit 1 through
       `main.rs:430-437`.
6. **The fixture and the contract tests (S).** `apps/api/tests/fixtures/analyst/q1/`, written in
   the `--save-inputs` format, about 95 KB. The manifest says `"illustrative": true`, and every
   `fetched_at` is `2026-10-15T00:00:00Z`.
   - **Copied blobs:**
     - the hand-built ticker map, with two rows added: a second NVDA row under a higher key with a
       CIK the fixture has no answers for, and TSM (CIK 1046179);
     - the hand-built NVDA submissions index and NVDA company facts;
     - Form 4 `…-000089` → `sec_form4_planned_sale.xml`;
     - Form 4 `…-000081` → `sec_form4_buy.xml`;
     - State Street's real filing index and sliced information table for 2026-06-30;
     - the real TSM company facts (`sec_real_companyfacts_tsm.json`).
   - **404 entries:**
     - Form 4s `…-000077` and `…-000066`, which exercise an unread document. `…-000066` (accepted
       2026-07-10) falls inside the 90-day window of every cutoff that criteria 4 and 5 use, so
       without its entry those replays would stop with "no response".
     - The other 11 managers' indexes.
   - **New and hand-built, all illustrative:**
     - one small State Street manager index, with 13F-HR rows for the periods to 2026-06-30
       (accession `0000093751-26-000507`) and to 2026-03-31;
     - a filing index and an information table for 2026-03-31. The table is a copy of the slice
       with NVDA's shares changed. It keeps the TSM receipts row;
     - a TSM submissions index with one row for each of the 10 accessions that the real TSM company
       facts cite, with their forms and `filed` dates, and with illustrative acceptance times.
   - Tests (i) to (iii), the second half of (viii), and (ix).
7. **Verify (XS).** Run every command in Verification in order, recording each exit code. The owner
   then makes the live NVDA run and its replay (criterion 14).
8. **Record (XS).** After the owner answers the open questions:
   - append an "Amendments" section to `docs/product/ai-analyst/DESIGN.md` (supersede, don't
     rewrite §3). It covers the timezone rule, `persona: null`, the `not_built` reason, `coverage`,
     the bp unit, the zero-prior rule and the `10b5-1` allowlist entry;
   - add a row to `.spire/clusters/tech/context/DECISION_LEDGER.md` for the §8.1 answer.

   No test is retired.

**Visibility changes, all `pub(crate)`:**
- `is_insider_form` (`edgar.rs:163`) and `SEC_SPACING` (`mod.rs:53`);
- the new functions `accepted_at`, the hours guard, the page-reach reader, `fact_point_for`,
  `periodic_rows`, `shares_outstanding_point`, `shares_outstanding_near_point`, `holder_rows` and
  `ManagerIndex::report_accepted_by`.

Nothing else changes visibility. `span_of` and `newest` stay private and are used only inside
`edgar.rs`.

**Files likely touched:**
- `apps/api/src/services/public_data/{edgar.rs, edgar_13f.rs, mod.rs, calendar.rs, filed_figures.rs, insider_trades.rs}`.
  The last three change in tests only. `mod.rs` changes for `SEC_SPACING` and one test literal.
  `types.rs` is not touched;
- `apps/api/src/services/{mod.rs, analyst/*}`;
- `apps/api/src/main.rs`;
- `apps/api/tests/fixtures/analyst/q1/*` and three `apps/api/tests/fixtures/public_data/sec_real_header_*.txt`;
- `docs/product/ai-analyst/DESIGN.md`, appended only, and one row in `DECISION_LEDGER.md`.

## Open questions for the owner

1. **Approve Phase 0, or this slice alone (DESIGN §8.1)?**
   - **Recommended:** approve 0a alone now.
   - **What it brings forward:** DESIGN's Phase 1 builder, "The Q1 package builder" (DESIGN.md:508),
     moves into Phase 0. It comes without the seven tools, the model or truncation, because Phase
     0's exit gate re-runs a builder.
   - **Why that is safe:** it adds no model call, no key, no table, no route and no licensed data.
     The one change a visitor could notice is that a ticker EDGAR lists twice resolves to the same
     company every time.
   - **What stays gated:** 0b to 0f still wait for the Phase 0 answer.
2. **How should `omitted` say "not built yet"?** `omitted.reason` is DESIGN's own enum:
   `not_licensed`, `stale`, `off` and `budget` (DESIGN.md:172). It is separate from the site's state
   vocabulary, so a new value needs only the DESIGN amendment that step 8 writes anyway.
   - **Recommended:** add `not_built`, used for the research note until 0e.
   - **Rejected:** `off`. On the site, Off means deliberately switched off: kind `quiet`,
     "deliberately absent" (`vocabulary.ts:28`, `:40`). The note isn't switched off; it isn't built
     yet.
3. **What about `persona`?** DESIGN types it as a `PersonaConfig` (DESIGN.md:170), but the server
   has no persona to send until 0c (DESIGN.md:295-296).
   - **Recommended:** `persona: null` until 0c, recorded as `PersonaConfig | null` in the amendment.
   - **Consequence:** ids change once 0c fills it in, which is correct, because a persona changes
     retrieval.
4. **Three deviations from DESIGN's point-in-time table (DESIGN.md:183):**
   - (a) 13F-HR/A and Form 4/A amendments aren't read, matching the site.
   - (b) The 13F change is expressed in basis points, because DESIGN's unit set has no "points".
   - (c) A manager whose prior 13F was read without the security gets a `13f.prior_absent` fact
     and no change fact. The total change counts only managers held in both quarters, so it differs
     from the site's total. This follows the recommended answer to spec 05's open question 1, "The
     13F zero-prior rows" (README D3), and it changes with that answer.
   - **Recommended:** accept all three for 0a. Revisit (a) only if a Phase 1 eval item hits an
     amended 13F.
5. **Which live SEC requests may this slice make, and who makes them?** Ruling (1) lets lanes save
   real SEC responses as fixtures for the features it names (DESIGN_SYSTEM.md:285). Timezone headers
   aren't among those features, and a verification run saved under `/data/` isn't a fixture.
   - **Recommended:**
     - **Yes** to step 0's three header GETs with the production `SEC_USER_AGENT`, committed as
       sliced fixtures.
     - Criterion 14's live run (about 80 requests) is yours to make, not a lane's.
     - No lane runs the CLI live.
6. **May each section carry a `coverage` record?** DESIGN's section type is
   `{ facts, tokens, truncated? }` (DESIGN.md:171).
   - **Recommended:** yes, recorded in the amendment.
   - **Why:** gaps such as a manager index that returns 404 have no acceptance time, so they can't
     be facts. A gap that reaches only stderr leaves a package that looks complete when it isn't.
