# massive-flat-file-keep — spec

**Source brief:** .spire/clusters/tech/contracts/massive-flat-file-keep/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md   (under council/)
**Status:** APPROVED 2026-08-30

## 1. Goal + scope

After Massive publishes next-day stocks SIP files (~11:00 America/New_York the following calendar day), an operator command keeps the entitled **trades** and **quotes** for the locked watchlist **SPY / QQQ / IWM** as a provenance-labeled **research corpus**. The buyer is the **research operator**, not the trader. A cancelled live feed then still has reconstructable **price/quote history** for days the same-day tape missed or never stored. Coverage `present` still means a loadable `LiveMassive` session book. Production `serve` without this construct still talks to Massive REST/WS. Score / tier / fingerprint stay byte-identical (`Authorizes: nothing`). Kept files are **our research**, never a live vendor feed, never `live_massive`.

Human product ruling **2026-08-30 aggregates — A.** This slice keeps stocks SIP **`trades_v1` + `quotes_v1` only**. Session-bar aggregates are a **closed product slot (Future)**: not fetched, not stored, not listed, not claimed. Standing and list **omit an aggregates column** — do not print `0 aggregates`. Occupancy for trades and quotes is independent. A later aggregates slice must not restate provenance as `LiveMassive` / coverage `present`. Derived OHLCV from the trades extract is **not** the aggregates class. Reasoning: reconstructable price/quote history is prints plus quotes; a third vendor object this slice would grow store and claim without keeping a tick the SIP trades file lacks, and printing a zero would claim a product we did not keep.

Human product ruling **2026-08-30 universe gzip retention — A.** The durable occupant is the locked-name **extract** per `(symbol, ET date, class)` for SPY/QQQ/IWM. Keep may stream the universe gzip through a temp file, extract the locked names, then **discard** the universe object (no durable full-market file this slice). After cancel, list/load of already-kept extracts is **zero vendor**. Rebuilding a fourth name from that day’s universe file is **Future** (would need re-GET or a later gzip-keep slice). Standing: **watchlist extract · not a full-universe redistribution · not a full open-to-close claim**. Research load returns **extract only**. No completeness percent. Reasoning: the operator may claim three names, not the US SIP day; retaining GB-class gzip would invite that completeness/redistribution claim and is not required to list/load extracts that already succeeded.

Human product ruling **2026-08-30 S2 pass-2 Critical — A.** Never persist `miss` for `(D, class)` if any locked-name extract already exists for that pair (kept or empty extract for any of SPY/QQQ/IWM). Never vouch “vendor file absent” beside a sibling keep from that universe file. Skip GET **per entitled class** when **any** locked name already has a content-hit occupant for `(D, class)`. **Content-hit = `kept` or `empty extract`** (a zero-row AC-18 extract is still a content-hit; it skips later GET for that class the same as `kept`). A later 404 in that situation is **download-failed / not-confirmed**, not miss. First-wins on existing kept/empty-extract occupants stands. Completing missing names from a discarded universe gzip is **Future**. Skip-GET and files-call counts are **per class**, not whole-command, unless **both** classes have a content-hit. Reasoning: a universe miss is one day-file fact; it cannot be true for QQQ while SPY already holds an extract of that same file.

<!-- spire:council-resolution:v1 502673893d816bd15e8c3efc5ba8267bd02ffae147202119c14eeb98048e06e8 folded -->
<!-- spire:council-resolution:v1 d8f79bcd7065acf4fefa0f2d6b399a4eb61e157c1798e1ba09f5c4a20fd840dc folded -->
<!-- spire:council-resolution:v1 6f4bbe4c7b45cb582a29b19ec817ff41dc585eba148c034f4e7601aa253996e2 folded -->

**In scope:**

- Operator-invoked keep for a named ET weekday date `D` (and a locked symbol or the closed trio) **after** the vendor publish clock. AC-1/AC-2 store extracts only when keep **successfully GETs that class** (no sibling content-hit for that class yet). When any locked name already has a content-hit (`kept` or `empty extract`) for `(D, class)`, **AC-54 wins for that class**: skip GET for that class; do not invent extracts for missing names of that class. The other entitled class with **no** content-hit still GETs.
- Entitled classes this slice: stocks SIP **trades** and stocks SIP **quotes**, independently occupied, independently fetched, and independently claimed. Mixed occupancy **across classes** (trades kept + quotes miss on different universe files) is a ship path; one HTTP load of `(S, D)` carries both class fields. Mixed occupancy of **`miss` beside a kept / empty-extract / unreadable sibling for the same `(D, class)`** across locked names is **forbidden**.
- Durable occupant: watchlist **extract** per `(symbol, D, class)` on a **dedicated** body root. Vendor objects are universe-per-day; keep streams each entitled gzip through temp, extracts locked names, discards the gzip. Crash temps are not occupants. Skip GET **per class** when any locked name already has a content-hit occupant for that `(D, class)`.
- Past due weekdays are keepable if the vendor still publishes the file. Operator names `D`. No automatic date-range backfill.
- Named clap `flat-files` (keep is the only files GET) and sibling `GET /api/_research/flat-files/*` list/load: token-gated like session-books, **zero vendor I/O on read**, Pages trader origin still 404s `_research` / `_metrics`.
- Distinct files Access Key + Secret; missing pair and live REST key in a files slot are two pre-GET refuses (zero files GET). Secrets never in list/load/CLI.
- Honest occupancy (operator print): kept · not-elapsed · miss · no stored extract · empty extract · unreadable · not-storing · download failed · missing-files-credentials · wrong-credential-class · ineligible-weekend · not-in-watchlist · refuse-to-mix · HTTP unauthorized. Never coverage `present` / `missing` / `not yet due` / `blocked occupancy`. Never session-day-tape literals. Never `Unattempted`, `Stored`, `live`, `LIVE`, `live_massive`, `Live tape`, `live-tape`, `live-paid-present` as this vehicle’s outcomes. CLI list prints a per-class occupancy token so miss and empty extract are not the same `0`.
- Isolation: fetch off the trader request path; download fault never 5xxs the desk; the live hub/SSE path still publishes ticks while keep runs or fails; trader chrome is `NO_UI_CHANGE`; score unchanged; coverage holes stay holes; tape occupancy unchanged.
- Production unset does not fetch files and still talks to Massive REST/WS. No serve poller this slice.
- Local CLI evidence labeled **local**, not hosted/CI/production keep.
- Mixed-class keep process exit: **non-zero** if any class this invocation is miss, download-failed, unreadable, unauthorized, not-storing, or refuse-to-mix. Exit **0** only when every class is skip-GET success or a successful GET that stored `kept` / `empty extract`.

**Out of scope:**

- Session-bar **aggregates** this slice (closed Future slot). Do not fetch, store, list, or claim them. Do not print `0 aggregates`. Do not derive bars from the trades extract and call that aggregates.
- Durable retain of the universe gzip / full-market CSV. Research load never returns the universe body.
- Completing missing locked names for `(D, class)` by re-GETting a universe file this slice already extracted from.
- Converting extracts into the session-day tape or walking them through the ticker replay player.
- Inserting extracts as `LiveMassive` / coverage `present`. Adding a `MarketDataSourceKind` variant.
- OPRA options files; indices (`I:VIX` / `I:SPX`); crypto; hist-chain; Plan History / chain greeks reconstruction.
- Expanding the watchlist beyond SPY / QQQ / IWM. Universe-wide redistribution as the product occupant.
- Trader UI, nav, Settings, ticker chrome, player controls, `/_ops` keep matrix (`NO_UI_CHANGE`).
- Changing live scoring, tier, entry gate, fingerprint, scanner, or live REST/WS behavior.
- Unattended production poller that fetches files from `serve` / the trader request path.
- Reusing `MASSIVE_API_KEY` as the files secret. AWS S3 / rusoto / smithy crates.
- Mixing this corpus into session-archive bodies, the day-tape root, or the 48/14-day ring.
- Parked harvest: Benzinga, news terminal, squeeze scanner, RL-on-score, public SaaS, research-lab UI, remote object store, telemetry SLOs.

**Future (deliberately deferred):**

- Session-bar aggregates as a third independent class (same occupancy rules; never satisfies trades or quotes; never `LiveMassive` / coverage `present`).
- Durable gzip-keep / fourth-name rebuild from that day’s universe file without re-GET.
- Completing QQQ/IWM extracts for a `(D, class)` that already has a SPY content-hit occupant (would need re-GET or gzip-keep).
- Convert a kept extract into session-day-tape occupancy so replay can walk a reconstructed day.
- Unattended scheduled keep after the D+1 11:00 ET checkpoint (still off the trader request path).
- OPRA / indices / crypto keep; watchlist expansion — only by explicit owner decision.
- Date-range keep; NYSE/exchange-holiday calendar; operator lab UI; remote object store for this corpus.

## 2. Architecture

This slice is a **provenance-labeled research corpus**, not a fourth market-data source and not a live paid book. It adds a files client, a dedicated extract store, an operator keep command, and sibling `_research` list/load. It does not become a `MarketDataPort` arm, a session-archive occupant, a day-tape Path-A container, or a ticker-page clock.

**Verified live seams (not briefing HTML, not Python):**

- `apps/api/src/infrastructure/massive/` is REST + WS + `market_phase` only. No files client. `MassiveRestClient` authenticates with `cfg.massive_api_key` as query `apiKey` against `api.massive.com`. `fetch_recent_trades` is lookback REST, not a daily S3 file.
- `MarketDataSourceKind` is exactly `{LiveMassive, Fixture, SessionTape}`. Coverage `present` is loadable `LiveMassive` only. **Do not** add a variant this slice. These bytes never become a `VendorBundle` and never reach `insert_if_absent`.
- Tape root `SESSION_DAY_TAPE_BODY_ROOT` collides with ring / archive index / archive body (`tape_root_conflicts` in `config.rs`). This store uses a **new** optional root and is **not** a new peer inside `tape_root_conflicts` (that `Err` path already refuses `serve` bind).
- Watchlists `TAPE_WATCHLIST` and `ENSURE_SYMBOLS` are both `["SPY","QQQ","IWM"]` and are **not aliases**. This leaf pins the same three names with its own table and poisons `ENSURE_SYMBOLS` by source scan.
- Pages Function `functions/api/[[path]].ts` 404s `/api/_metrics` and `/api/_research` by prefix. New paths stay under that prefix so Pages needs **no** edit.
- `apps/api/Cargo.toml` has reqwest, hmac, sha2, hex. **No** `aws-sdk-*`. Session HMAC stays in auth; files SigV4 does not use the cookie ring.

Vendor S3 facts (`https://files.massive.com`, bucket `flatfiles`, prefix `us_stocks_sip/{trades_v1|quotes_v1}/YYYY/MM/YYYY-MM-DD.csv.gz`, Access Key + Secret from the Massive dashboard) are **docs not in-repo**. Attackable: SigV4 region, path-style vs virtual-hosted, `UNSIGNED-PAYLOAD` vs empty-body hash, CSV ticker column name. Defaults to implement against: path-style `{endpoint}/{bucket}/{key}`, region `us-east-1`, empty-body SHA-256, header-driven ticker/symbol filter. A dialect miss is **download failed** (403 after GET), not miss. An unrecognized header is **unreadable**, not empty extract.

**New modules:**

- `apps/api/src/infrastructure/flatfiles/` — credentials (access-key + secret **only**; **no** `api_key` field), SigV4 GET, streaming body, URL sanitizer. Not under `infrastructure/massive/`. Source scan on this leaf that finds `MASSIVE_API_KEY` / `massive_api_key` fails the build.
- `apps/api/src/services/flat_file_keep/` — dedicated root, due-clock, extract, classify, clap, proved-absence sidecar. One-way leaf: `quant-engine`, `generate_signals`, fingerprint, ensure, coverage, day_tape writers, `session_chain_archive` do not import it. Files leaf source scan poisons `insert_if_absent`, `LiveMassive`, `spawn_capture`, `MarketDataPort`, `compute_analytics_from_vendor`.
- HTTP adapter beside `research_session_books.rs`: `GET /api/_research/flat-files/{symbol}` (list) and `GET /api/_research/flat-files/{symbol}/extract` (load). Register so Axum cannot bind `flat-files` as `session-books/{symbol}`.
- Optional clap `Commands::FlatFiles`, stdout title **`flat-files`**. Dispatched like tape/coverage so REST key is optional. **Not** an alias of `serve`, `session-day-tape`, `archive-coverage`, or `session-day-replay`.

**Config (runtime env, not image):**

- `MASSIVE_FLAT_FILES_BODY_ROOT` — optional dedicated path. No nested default under `data/`. Unset / empty / unwritable → **not-storing**.
- `MASSIVE_FILES_ACCESS_KEY` + `MASSIVE_FILES_SECRET` — files pair. Never `MASSIVE_API_KEY`. Empty allowed at `Config::from_env`. Required only when keep is armed.
- Production bootstrap gains **no** new `ViolationCategory`. Archive body remains the only production body-root prerequisite. Missing files pair does not refuse `serve` bind.

Enable reqwest **`stream`**. Add **`flate2`** and **`csv`** (object is `.csv.gz`; HTTP `Content-Encoding` is the wrong layer). **Forbidden:** `aws-sdk-*`; `Response::bytes()` on a universe object.

### 2.1 Identity, watchlist, due clock

**Watchlist.** Process-start closed set whose v1 members are exactly **SPY, QQQ, IWM**. Upper/trim-normalized. Not operator-editable this slice.

**Corpus grain (vendor object):** `(et_date, class)` with `et_date` America/New_York calendar `YYYY-MM-DD` and `class` ∈ `{trades, quotes}` mapping to vendor `trades_v1` / `quotes_v1`. Not a ticker key.

**Extract grain (durable occupant):** `(symbol, et_date, class)` with `symbol` in the locked watchlist.

**Due.** Session `D` is due when `now_et >= D + 1 calendar day at 11:00:00` America/New_York (`chrono_tz::America::New_York`). Friday `D` becomes due **Saturday 11:00 ET**, not Monday. Named ET date strictly after today ET is not-elapsed. Keep **does not sleep** until due. A keep armed before the line classifies **not-elapsed** and **must not GET** (a pre-due 404 would fabricate miss). Weekend Sat/Sun ET is **ineligible**; GET forbidden. Exchange-holiday weekdays stay eligible (no holiday table in-repo); a holiday 404 after due is miss **only if** no locked extract exists for that `(D, class)`; a published file with zero rows for S is empty extract.

### 2.2 Dedicated root and collision

New optional root. Conflict predicate (keep-only): candidate vs ring, archive index, archive body, **and** tape root, using existing `path_equals_or_nests` both directions. Evaluated **only** by the keep construct.

- `serve` opener: `Ok(NotStoring)` if unset/empty/unwritable; `Ok(RefuseToMix)` if the predicate is true; `Ok(Open)` if writable and disjoint. **Never** `AppError::Config`. AppState construction succeeds. REST/WS/workers start. Files client is **not** constructed on serve.
- Armed keep: predicate true → **refuse to mix** before any GET, no write, non-zero. Occupies none of those roots.
- `NotStoring` remains unset/empty/unwritable only. Collision is a distinct class. Operator line is **not** `flat files not storing`.
- Do **not** add this root as a peer inside `tape_root_conflicts` / `body_root_conflicts` (that would let a mis-set keep root refuse tape open, which already refuses serve).

<!-- spire:council-resolution:v1 428c3ad35c5216fd029b7130925412095e36a646b997ae790e2d1f15f7fce62f folded -->

### 2.3 Credentials and SigV4

Files client cannot be built from `Config.massive_api_key`. Keep classifies **before** `reqwest` send:

1. Access-key or secret unset/empty after trim → **missing-files-credentials**. Files GET count **0**.
2. This process has a non-empty live REST key (`MASSIVE_API_KEY` / Config field **before** empty-key blanking) **and** it equals the files access-key **or** the files secret → **wrong-credential-class**. Files GET count **0**. REST key is never copied into the files client and never used as SigV4 material. Keep does **not** require the REST key. Unset REST env → skip equality (paste unprovable this run); a later vendor 403 is download failed, not wrong-class.
3. Else SigV4 GET may run.

Keep CLI may construct a REST client with `massive_api_key: String::new()` so keep does not require REST. Do **not** `env::remove` `MASSIVE_API_KEY`. Classify reads the env the operator left.

SigV4: AWS4-HMAC-SHA256 for `GET`; signed headers `host`, `x-amz-date`, `x-amz-content-sha256`; payload hash = SHA-256 of the empty body. Separate `reqwest::Client` (no `apiKey` query, no 120s whole-request timeout). Stream `chunk()` bytes to a temp file on the dedicated root. URL sanitizer strips `Authorization` / `X-Amz-*` and never prints the secret (sibling of `safe_vendor_url`). Files GET counter increments only when send is invoked. Count files-call **per entitled class** (trades GET and quotes GET are separate counters). Whole-command files-call is 0 only when **neither** class issued a GET.

HTTP research token miss is the shipped operator-token gate (`metrics_token_ok` / `METRICS_SECRET_TOKEN`). Not a files occupancy cell. Trader session cookie is not this gate.

<!-- spire:council-resolution:v1 00824a5350f1e468620d1c66da614e54f66101de78047e13d754d1c5446b1b92 folded -->

### 2.4 Keep data flow (extract-only)

```
operator clap `flat-files keep` (off trader request path)
  → refuse-before-GET if NotElapsed / Ineligible / NotInWatchlist /
       NotStoring / MissingFilesCredentials / WrongCredentialClass / RefuseToMix
       (files-call count 0; none of these are miss; process exit per that refuse)
  → else, per entitled class {trades, quotes} for named D:
        if ANY locked name already has a content-hit occupant
           (kept or empty extract) for (D, class)
           → skip GET for THIS class (do not re-GET a universe file we already
              extracted from; completing missing names is Future)
              this class: files-call 0; missing names no stored extract;
              never miss; never download-failed (no GET issued for this class)
        else SigV4 GET of the universe key → stream to temp on dedicated root
           404 / NoSuchKey
              if ANY locked extract exists for (D, class)
                 (kept, empty extract, or unreadable promoted pointer)
                 → download failed / not-confirmed; do NOT persist miss;
                    do not print the miss literal
              else
                 → persist proved-absence record → miss (no gzip body)
           401 / 403 / timeout / 5xx / reset / no-rename → download failed;
              temp discarded; no partial rename; not miss
           2xx + fsync temp → flate2 + csv filter locked watchlist rows
              → atomic rename of **extract** per (symbol, D, class) for SPY, QQQ, IWM
              → discard temp universe gzip (no durable full-market file)
              zero rows for a locked name → empty extract (file obtained; content-hit)
              csv/header/ticker-column fault → unreadable
  → process exit AFTER both classes (mixed-class keep exit, §5):
        non-zero if ANY class this invocation is miss, download-failed,
           unreadable, unauthorized, not-storing, or refuse-to-mix
        0 only when EVERY class is skip-GET success or a successful GET
           that stored kept / empty extract
research list/load (clap inspect of a named D, or `_research` GET)
  → open dedicated root only; REST, WS, and files counters stay 0
  → classify ignores leftover keep temps (not occupants)
serve
  → does not construct the files client; does not poll; may open the store read-only
```

**Universe GET once per (D, class), and only when no content-hit occupant exists yet for that class.** Vendor files are universe-per-day. A successful GET extracts **all three** locked names for that class, then discards the gzip. A keep that names one locked symbol still fills sibling locked names from that same GET **when the GET runs**. After discard, completing a missing locked name for a `(D, class)` that already has a content-hit occupant is **Future** (would need re-GET). NVDA / off-list names do not GET. Trades skip does **not** skip quotes.

**Skip GET (per class).** Skip **this class** when **any** of SPY/QQQ/IWM already has `kept` or `empty extract` for that `(D, class)` — not only when the full trio is complete. First-wins on those occupants stands (do not overwrite SPY). Missing names stay **`no stored extract` only** until a successful keep that does not require claiming the universe file is absent. That class skip is a **successful skip for that class**, not a keep failure: files-call 0 **for that class**; never miss; never `[ERROR] download failed` for that class. AC-1/AC-2 do **not** require storing the missing name on this path. A class skip does **not** by itself set process exit 0 or whole-command `Vendor I/O: 0`. Whole-command files-call is 0 and keep CLI is the skip-GET `[OK]` exit 0 story **only when both** classes have a content-hit.

**Never persist miss beside a sibling extract.** Persist a proved-absence record for `(D, class)` **only if** no locked extract exists for that pair. If any locked extract exists (kept, empty extract, or unreadable promoted pointer), a 404 is **download-failed / not-confirmed**, not miss. Do not print `flat files miss: vendor file for {ET_DATE} due and absent` beside a sibling keep. Download-failed is CLI-keep-only for a GET that **ran**; skip-GET of that class does not print it.

**First-wins.** Successful stored extracts (`kept` or `empty extract`) are not overwritten by a later empty extract, unreadable blob, miss record, or unconfirmed fetch. Miss / download-failed may retry. Only a prior proved-absence record becoming a kept extract is “filling a miss.” A later successful GET after download-failed is **not** filling a hole that was never proved.

**Proved-absence record.** `(et_date, class)`, files status 404/NoSuchKey, observed-at UTC. No gzip body. Written only when the 404 ran and **zero** locked extracts exist for that `(D, class)`. List/load after cancel reads it with **zero vendor I/O**.

**Partial-trio crash.** Only a fully fsynced extract is renamed into the locator. Crash after SPY is promoted and before QQQ/IWM **for that class**: leftover temp is discarded/ignored; promoted SPY extract remains; QQQ/IWM stay **`no stored extract`**. A later keep **skips GET for that class** (SPY is a content-hit occupant). QQQ/IWM are not occupied as `miss`. Completing them is Future. The other class with no content-hit still GETs.

**Partial writes / crash-temp (no promoted extract).** Crash mid-stream leaves temp. Classify **discards or ignores** leftover temp: it is **not** a stored occupant, **not** kept, **not** unreadable, **not** a download-failed list row. Inspect or dated load of that `D` with no promoted extract and no proved-absence record is **`no stored extract`**. Download-failed is the keep-run CLI outcome only when a GET ran; it is not persisted.

<!-- spire:council-resolution:v1 0141cfb0acdb44e76235e1b95222ef014d9bad42f403715bc2d1aefaab6bacf7 folded -->
<!-- spire:council-resolution:v1 b0e9bbb0d25cc3d1e0c91d1db9703def555f17f30c11a699dc5b2cd5be6f6ec4 folded -->

### 2.5 Occupancy (type-level vs operator)

Closed type-level enum the caller cannot collapse to `Option` / boolean. `present` is **not a member**. Type names **do not print**. Operator success after a GET is an **extract** claim: corpus obtained. Occupancy is **`kept`** when the locked-name extract has **≥1** rows, or **`empty extract`** when it has **0** rows (AC-18). Both are content-hits.

| Type-level (implementer) | When | Operator fact / print |
| --- | --- | --- |
| `NotElapsed` | `now_et` before due line; GET forbidden | `not-elapsed` (dated inspect / load of named D) |
| `Ineligible` | ET Sat/Sun; GET forbidden | `ineligible weekend` (dated inspect / load) |
| `NotStoring` | root unset / empty / unwritable | `not-storing` (store-level; HTTP 500 for locked symbols) |
| `RefuseToMix` | keep root collides; desk up | `refuse to mix` (store-level; HTTP 500 for locked symbols) |
| `MissingFilesCredentials` | files pair absent; GET count 0 | `missing-files-credentials` (**CLI keep only**) |
| `WrongCredentialClass` | live REST key in a files slot; GET count 0 | `wrong-credential-class` (**CLI keep only**) |
| `NotInWatchlist` | name not in the locked trio; GET not implied | `not-in-watchlist` |
| GET-not-run, due, no occupant, no proved 404 | **inspect or load of a named D**; **do not call S3 to confirm**. **Not** the undated list. Includes missing names after skip-GET because a sibling already has a content-hit occupant. | `no stored extract` |
| `FetchFailed` / transport / 401/403 after GET / 404 while a locked extract already exists | GET **issued**; absence **not** a persistable miss; temp discarded | `download failed` (**CLI keep only** when a GET ran; not a list/load occupancy; **not** the skip-GET path for that class) |
| `Miss` | due **and** keep GET completed 404 / NoSuchKey **and** **zero** locked extracts exist for `(D, class)`; proved-absence persisted | `miss` |
| `Unreadable` | durable local **promoted** object/pointer exists; gzip/csv/header fails | `unreadable` |
| corpus obtained, locked name **≥1** extract rows | stored extract with rows | `kept` / `kept from Massive flat files` |
| corpus obtained, locked name **zero** rows | we got the file; the name is quiet; **content-hit** | `empty extract` |
| research GET without/wrong token when required | existing operator-token gate; no extract body | HTTP `unauthorized` (`metrics_unauthorized`) |

A **true** universe-file miss (404 with **zero** locked extracts for that class/day) is **one day-file fact** inherited by SPY / QQQ / IWM — not three independent per-ticker vendor-file misses. `empty extract` and `kept` row counts are **per symbol** after a file is present. Classes stay independent: a quotes miss does not rewrite trades kept (different universe files). **Same `(D, class)` never prints `miss` for one locked name while another locked name is `kept`, `empty extract`, or unreadable.**

**BRIEF “missing file after it is due is a miss”** means **proved vendor absence with no locked extract of that file**, not store-absent and not “QQQ has no extract while SPY does.” Inspect or dated load of a due date with no stored object and no proved 404 is **`no stored extract`**, not miss. **Undated list is not that class:** empty list is empty `extracts[]` with hit framing `RESEARCH READ — MASSIVE FLAT FILES`, not `no stored extract` and not miss.

Never print type names `Unattempted`, `Stored`, `ExtractEmpty`, `Miss`, `NotElapsed` as operator occupancy. Never print `present` as this vehicle’s success word.

<!-- spire:council-resolution:v1 b5664f98bdfe1f72d7ba66fffeb78da2b98db1585d8e999a9a3b869b33b9b1c5 folded -->

### 2.6 Research read and serve

List/load never call Massive REST/WS or files S3, never “refresh if missing,” never start ensure, never write tape/archive/ring. `vendor_called` is always `false` on successful handling. `authorizes` is exactly `nothing` on every 200 envelope. Load returns **extract CSV only**, never the universe gzip.

HTTP list has **no** `et_date` query. List is stored occupants only. `no stored extract` is **load** (`?et_date=`) or CLI inspect of a **named** D.

Axis A order (**load** / dated inspect): **NotInWatchlist before NotStoring / RefuseToMix**; **IneligibleWeekend before NotElapsed**; **NotElapsed before no-stored-extract**. A foreign symbol is 200 `not in flat-files watchlist:` even when the root is unset. List of a foreign symbol is the same Axis A 200; list of a locked symbol on an empty store is hit framing + empty `extracts[]`, not Axis A `no stored extract`.

Serve workers (warmer, ensure, scanner, stock hub) do not import the files leaf. Fetch is not an in-request market sweep.

### 2.7 Failure modes + isolation

- **Desk / trader HTTP:** files I/O is off the ticker/SSE/scanner/ensure path. Structural proof: request-path modules’ source scan has no files-client type. Download fault never 5xxs the desk (`best-effort-isolated-or-null`). While keep runs or fails, the live hub still publishes ticks / SSE still emits trade/quote events — the live path is not blanked. Trader chrome is `NO_UI_CHANGE` (empty-diff / copy-table / Pages 404).
- **Armed keep:** missing pair, wrong-credential-class, unwritable root, collision → refuse **before any GET**. 401/403 after GET → download failed, non-zero, no partial rename. 404 with zero locked extracts → persist proved-absence, non-zero. 404 with any locked extract already present → download failed, **no miss sidecar**. Skip-GET **for a class** (sibling content-hit for that class) → no GET **for that class**, missing names `no stored extract`, never miss / never download-failed for that class. Process exit follows mixed-class keep exit (§5): a trades skip does **not** force exit 0 while quotes miss or download-failed.
- **Research GET:** operator token when configured; store errors stay on the operator route. Pages trader origin never reaches it. Keep-only occupancy tokens (`download failed`, `missing-files-credentials`, `wrong-credential-class`) do **not** appear on list/load DTOs.
- **Secrets:** files pair + REST key never in list/load/CLI stdout, never in research JSON, never in image.
- **Score:** empty scoring-path diff. CLI/HTTP standing `Authorizes: nothing`.
- **License:** no trader route serves extracts as a market-data feed.

**Not buildable / rejected approaches:**

- Reuse `SESSION_DAY_TAPE_BODY_ROOT` (mixes gzip CSV with Path-A jsonl; occupancy lie).
- Convert CSV → Path-A / ticker replay this slice (vendor columns not in-repo; replay walks day_tape).
- `aws-sdk-s3` / smithy (supply-chain; GET of known keys only).
- Reuse `MASSIVE_API_KEY` as SigV4 secret (wrong protocol; BRIEF poison).
- `MarketDataSourceKind::FlatFile` (forces coverage matches to classify bytes that never enter the archive).
- Serve-time poller or in-request fetch.
- Process-start `Err` on keep-root collision (would take the desk down; withdrawn).
- Collapse occupancy to boolean `present`/`missing`.
- Classify vendor-down / inspect-empty as miss.
- Persist `miss` for `(D, class)` when any locked extract already exists for that pair.
- Skip GET only when the full trio is complete (partial-trio would re-GET and fabricate miss).
- Treat a single-class content-hit as whole-command skip (the other class with no content-hit must still GET).
- Exit 0 after a class skip while the other class is miss / download-failed / unreadable.
- Require whole-command `Vendor I/O: 0` on a trades-only content-hit plant.
- Require AC-1/AC-2 to store extracts on the skip-GET path for that class (AC-54 wins per class).
- Require AC-1/AC-2 success to be “reconstructable history” in a way that excludes AC-18 empty extract.
- Derive aggregates from the trades extract.
- Retain universe gzip as the operator-visible occupant this slice.
- Call S3 or REST lookback (`/v3/trades/{ticker}`) to “confirm” an inspect miss.
- Treat leftover keep temp as unreadable or as a download-failed list row.
- One envelope `detail` miss literal that denies a sibling **class** keep.
- HTTP 200 miss envelope when a sibling class is unreadable, or when **both** classes are unreadable (store fault wins).

## 3. Acceptance criteria (with user stories)

Stories: **S1** keep entitled trades and quotes for SPY/QQQ/IWM after the publish clock so cancel does not erase reconstructable price/quote history. **S3** list/load with zero vendor, including after cancel. **S4** occupancy classes stay distinct (`absent-is-not-none`). **S5** desk, live ticks, and score stay intact. **S6** operator-only surface, distinct files credentials, Pages 404. **S7** extracts cannot count as live paid present or as session-day tape. **S8** no convert, no OPRA, no poller, no parked harvest.

Miss is **not** automatic on every not-kept after due (PM AC-15 breadth retracted). Inspect or dated load of a due date with no stored object and no proved 404 is **`no stored extract`**, not miss. Undated list is not that class. Miss is never persisted beside a sibling keep for the same `(D, class)`. AC-1/AC-2 store extracts only on a successful GET **of that class**; skip-GET is AC-54 **per class**. Mixed-class keep process exit is §5 (not “exit 0 because trades skipped”).

<!-- spire:council-resolution:v1 b393fbb0e93db1d0463a306acdda69617a80dee8ef81c23f7a59666c55ae04ee folded -->
<!-- spire:council-resolution:v1 c74c9edd29ed09d48089ff7ee3ddfb94fcdcb8f7b2540d63db9262f733aa1e5c folded -->

`test` = silent honesty / money / license / desk risk. `review` = intentional copy or product non-choice. No DOM harness. Prefer one hermetic occupancy matrix over one named test per row. **(SB)** = ship-blocking.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 1 (SB) | S1 | Given weekday D is due (clock ≥ 11:00 ET on D+1), files credentials present, keep storing, **and no locked name already has a content-hit (`kept` or `empty extract`) for `(D, trades)`**, an operator keep that **successfully GETs** the trades universe file **stores a trades extract** for locked S on D. Occupancy is **`kept` (≥1 rows) or `empty extract` (0 rows, AC-18)** — both are successful stores of that GET. This row does **not** apply on the trades skip-GET path (AC-54 wins for that class; do not require a store for the missing name). | test |
| 2 (SB) | S1 | Under the same due/storing preconditions **and no locked name already has a content-hit for `(D, quotes)`**, the keep that **successfully GETs** the quotes universe file **stores a quotes extract** for locked S on D. Occupancy is **`kept` (≥1 rows) or `empty extract` (0 rows, AC-18)** — not trades-only. This row does **not** apply on the quotes skip-GET path (AC-54). | test |
| 3 (SB) | S1 | An operator keep of due D that **successfully GETs** a class leaves SPY, QQQ, and IWM each with independently observable occupancy **for that class**. One name’s empty extract does not blank the others. When both classes GET, both classes are independently observable. | test |
| 4 (SB) | S1 | Occupancy is **per class**. A kept trades extract does not classify quotes as kept; a kept quotes extract does not classify trades as kept. Load of `(S, D)` with trades **kept** and quotes **miss** (two universe files; quotes class has **zero** locked extracts) returns `framing: RESEARCH READ — MASSIVE FLAT FILES`, envelope `detail` **null**, `trades_occupancy: kept`, `quotes_occupancy: miss` — not the miss envelope (`RESEARCH READ — NO MASSIVE FLAT FILES` + miss literal) that would deny the sibling **class** keep. | test |
| 5 (SB) | S1 | A name that is not SPY, QQQ, or IWM is **not in flat-files watchlist**: no extract is stored, outcome is not a miss that implies we tried, files-call count 0 for that name. | test |
| 6 (SB) | S7 | Kept extracts are labeled research / not live Massive. Operator list/load never presents them as `live_massive`, `live`, `LIVE`, or coverage `present`. | test |
| 7 (SB) | S3 | Listing the corpus completes with **zero** Massive REST/WS calls and **zero** files S3 calls (kept rows, miss rows, empty-extract rows, unreadable pointers, empty `extracts[]`, not-in-watchlist). | test |
| 8 (SB) | S3 | Loading a stored `(S, D)` completes with **zero** vendor calls on every listed occupancy, including empty extract, miss, no stored extract, not-elapsed, weekend, and not-in-watchlist. | test |
| 9 (SB) | S3 | After a kept Tuesday exists, a subsequent vendor-unavailable / cancelled condition still lets the operator list and load that Tuesday’s **extracts** with zero vendor calls. | test |
| 10 (SB) | S4 | Given weekday D and clock **before** 11:00 ET on D+1, occupancy is **not-elapsed**; keep **does not fetch**; outcome is not miss, not empty extract, not no stored extract. | test |
| 11 (SB) | S4 | A named ET date strictly after today America/New_York is **not-elapsed** (no fetch), not miss. | test |
| 12 (SB) | S4 | Friday D is **due at Saturday 11:00 ET** (calendar D+1), not still not-elapsed until Monday 11:00 ET. | test |
| 13 (SB) | S4 | The keep command **does not sleep** until the due checkpoint; it reports not-elapsed and returns. | test |
| 14 (SB) | S4 | Given D is due, **zero** locked extracts exist for that `(D, class)`, and a keep proves the entitled vendor object absent (404 / NoSuchKey), occupancy is **miss** — not not-elapsed, not empty extract, not download failed, not no stored extract, not not-storing, not a credential refuse. That class’s keep verdict is miss. Keep process exit **non-zero** (mixed-class keep exit, §5). | test |
| 15 (SB) | S4 | Inspect or load of a **named** due weekday D (CLI inspect with `--et-date`, or `GET .../extract?et_date=`), no stored object, no proved 404: occupancy is **`no stored extract`**. Files-product call count is 0. Outcome is not miss, not empty extract, not not-elapsed, not download failed, not kept, not not-storing. Printed line does not say the vendor file is absent and is not the miss literal. CLI inspect exit 0 when **both** classes are `no stored extract` (and neither is unreadable). HTTP 200. **Undated list is not this row:** empty list is empty `extracts[]` with framing `RESEARCH READ — MASSIVE FLAT FILES` and `detail` null — not `no stored extract` and not miss. | test |
| 16 (SB) | S4 | Armed keep, D due, credentials present, store storing, files GET **runs for that class** but does not confirm absence (vendor down, transport, 401/403, non-404, **or 404 while a locked extract already exists for `(D, class)`**): CLI prints **download failed** for that class. Not miss, not kept, not empty extract, not no stored extract. Keep process exit **non-zero**. Desk does not 5xx. List/load DTOs do not carry `download failed`. This row is **not** the skip-GET path for that class (no GET issued for that class → AC-54, never download-failed for that class). A sibling class skip does **not** force process exit 0. | test |
| 17 (SB) | S4 | Inspect or dated load of a due identity that already reports miss from a prior proved keep 404 (zero locked extracts when persisted) still shows **miss** with files-product call count 0. Inspect does not re-GET to confirm. | test |
| 18 (SB) | S4 | Given the vendor day file is obtained and locked S has **zero rows** for that class, occupancy is **empty extract** — not miss, not no stored extract, not unreadable, not kept-with-history. That GET is a **content-hit**. Inspect exit 0. Keep of that class is a successful store (AC-1/AC-2 admit this occupancy). | test |
| 19 (SB) | S4 | Given a stored **promoted** artifact for `(S, D, class)` that cannot be loaded as a readable extract, occupancy is **unreadable** — not empty extract, not miss, not no stored extract, not not-storing, not kept. A leftover keep temp with no promoted extract is **not** this row (it is `no stored extract` on dated inspect/load). | test |
| 20 (SB) | S4 | When the keep store is disabled / unset / unwritable, occupancy is **not-storing** — not a grid of misses, not no stored extract, not empty extract, not kept. Desk still serves. | test |
| 21 (SB) | S6 | Armed keep with the **files credential pair absent** refuses, **does not fetch**, does not record kept, and prints missing-files-credentials **without** a REST-apiKey clause. Distinct from not-storing, miss, wrong-credential-class, and HTTP unauthorized. List/load DTOs do not carry this token. | test |
| 22 (SB) | S6 | Given the live REST/WS key value is supplied as the files access-key or secret, keep refuses as **wrong-credential-class**, **does not fetch**, and prints that **REST apiKey is not the files secret**. Distinct from missing pair. Files-call count 0. List/load DTOs do not carry this token. | test |
| 23 (SB) | S4 | An ET Saturday or Sunday named as session D is **ineligible weekend**: not miss, not empty extract, not not-elapsed, not not-storing. No fetch. CLI exit 0. | test |
| 24 (SB) | S4 | A holiday weekday remains eligible: a published file with no rows for S is **empty extract**, not ineligible weekend. | test |
| 25 (SB) | S4 | This vehicle’s keep/list/load print uses only the closed deck in §4. CLI list grid includes a **per-class occupancy token** (same listable deck as HTTP `extracts[].occupancy`): a miss sidecar prints occupancy `miss` and 0 rows; an empty extract prints occupancy `empty extract` and 0 rows — those two are not the same cell. Success word is **`kept`**, never `present`, never `Stored`. Poison: `Unattempted`, `present`, `Stored`, `live`, `LIVE`, `live_massive`, `Live tape`, `live-tape`, `live-paid-present`, coverage `missing` / `not yet due` / `blocked occupancy`, session-day-tape occupancy strings, **and miss occupancy/literal beside a sibling `kept` / `empty extract` / unreadable for the same `(D, class)`**. Those foreign classes are distinguished by **absence**. | test |
| 26 (SB) | S1 | A second keep of an already-kept **class** leaves that class **kept**, does not relabel provenance live Massive, does not write a session-day-tape occupant, and **does not GET that class** (any content-hit occupant skips GET **for that class**). If **both** classes already have a content-hit, whole-command files-call is 0 and keep CLI is the skip-GET `[OK]` exit 0 story (AC-54). If only one class has a content-hit, the other class still GETs (AC-1 / AC-2 / AC-3 / AC-14 / AC-16); process exit follows mixed-class keep exit (§5). | test |
| 27 (SB) | S4 | A due miss or download-failed may become **kept** on a later operator keep once the file is obtainable. An already-kept extract is **not overwritten** by a later empty extract or unreadable blob. | test |
| 28 (SB) | S5 | If keep fetch or write fails after due, bundle / scan / live stream / session-ensure still succeed; occupancy is not kept; no false stored success; the class follows AC-14 / AC-16 / AC-19, never automatic miss. | test |
| 29 (SB) | S5 | Keep / fetch runs **off the trader request path**. A ticker/bundle request does not download files. | test |
| 30 (SB) | S5 | While keep runs or fails, the live hub still publishes ticks / SSE still emits trade or quote events; keep fault never 5xxs bundle / scan / SSE / ensure and never blanks that live path. Trader chrome is **`NO_UI_CHANGE`** (empty-diff / copy-table / Pages 404). This row does **not** assert UI dimming. | test |
| 31 (SB) | S5 | For the same market inputs, opportunity score, tier, and state fingerprint are byte-identical with this construct present vs absent and with keep succeeding vs failing. | test |
| 32 (SB) | S5 | Production serve **without this construct** (files keep unset) **does not fetch files** and still talks to Massive REST/WS on the live path. | test |
| 33 (SB) | S5 | Armed keep with missing files credentials or unwritable root **refuses** (fail closed for keep). It does not fetch, does not record kept, and does not 5xx the desk. | test |
| 34 (SB) | S7 | If the configured keep path would collide with session-day tape, session-archive index/body, or the 48/14-day ring, armed keep **refuses to mix** rather than occupying those roots. `serve` still binds and talks to Massive REST/WS. Operator line is not `flat files not storing`. Tape/archive/ring contents unchanged. | test |
| 35 (SB) | S7 | Writing or loading an extract does **not** insert a session-archive identity and does **not** classify that identity as a live paid **present** book. | test |
| 36 (SB) | S7 | Given session-archive coverage for `(S, D)` is missing, keeping or loading extracts for `(S, D)` leaves that coverage cell **missing**. | test |
| 37 (SB) | S7 | A reconstructed / flat-file occupant is never accepted as a live paid session book; coverage/audit of session books does not exit as all-present on the strength of this corpus. | test |
| 38 (SB) | S7 | Session-day-tape occupancy for `(S, D)` is **unchanged** by keep/list/load of this corpus (missing tape stays missing tape; a taped day stays tape). Tape list/load framing is not overwritten. | test |
| 39 (SB) | S8 | This ship does **not** convert extracts into session-day-tape occupancy and does **not** play them into the ticker live path / replay player. | test |
| 40 (SB) | S8 | This ship does **not** download or keep OPRA options files, index files, or crypto files. | test |
| 41 (SB) | S8 | This ship does **not** start an unattended production poller that fetches files from serve. Serve may list/load already-kept extracts; it does not keep on a timer this slice. | test |
| 42 (SB) | S6 | `apps/dashboard` trader surfaces gain **no** new route, nav item, Settings copy, Ask-AI line, Ticker/LiveTape/Scanner/Positions/Landing affordance, tooltip, or toast mentioning flat-file keep, S3 files, next-day CSV, or reconstructed tape. | test |
| 43 (SB) | S6 | Trader empty / error / offline / `unavailable this cycle` / `—` / Live tape copy is **byte-unchanged** by keep success, keep refuse, list, load, miss, empty extract, no stored extract, unreadable, or not-storing. | test |
| 44 (SB) | S6 | Pages trader origin still **404s** `/api/_research` and `/api/_metrics` (and subpaths), including the flat-files sibling. Extracts are not proxied to the trader origin. | test |
| 45 (SB) | S6 | `/_ops/metrics` gains **no** keep matrix, keep chip, or stage named from this feature. Unknown JSON stays unrendered. | test |
| 46 (SB) | S6 | A trader origin cannot obtain a keep list or extract body (refused the same way existing operator/research diagnostics are refused on that origin). | test |
| 47 (SB) | S6 | When an operator token is required, a keep/corpus read without it is unauthorized (`metrics_unauthorized`) and returns no extract body. Trader session cookie is not the gate. | test |
| 48 (SB) | S6 | No trader-facing product path redistributes kept extracts as a market-data feed. | test |
| 49 (SB) | S6 | Canary secret values present in the environment (files credentials and REST key) do not appear in extract bodies or keep/list/load/CLI output. | test |
| 50 (SB) | S3 | CLI standing includes **Evidence: local** and closing that a local keep/list is **not** hosted/CI/production keep. A local receipt is not labeled hosted. | test |
| 51 (SB) | S1 | Operator standing, list, and load **omit** an aggregates kind/column entirely. They do not print `0 aggregates`, `session bars`, or an OHLC-that-proves-open-to-close claim. Trades and quotes print as two named classes when vouched. | test |
| 52 (SB) | S3 | After a successful keep, research load returns the **watchlist extract only** (not a universe CSV). There is no durable full-market occupant to list or load. A name outside the locked trio still cannot obtain an extract from that day’s discarded gzip. | test |
| 53 (SB) | S4 | A **true** universe-file miss (keep GET 404 with **zero** locked extracts for that class/day) is **one day-file fact** inherited by the locked names — not three independent per-ticker vendor-file misses. A no-stored-extract dated inspect/load of that object is the same inheritance. This row does **not** license miss occupancy on QQQ while SPY is kept for the same `(D, class)`. | test |
| 54 (SB) | S4 | Skip-GET and files-call counts are **per entitled class**, not whole-command unless **both** classes have a content-hit. Given SPY is already **`kept`** (or `empty extract`) for `(D, trades)` **only** and QQQ/IWM have no trades occupant: a later keep **skips GET for trades** (**trades** files-call 0). QQQ/IWM **trades** occupancy is **`no stored extract` only** — never `miss`, never `download failed` on list/load. SPY trades stays kept. Never print trades miss beside SPY keep. Quotes with **no** content-hit still GET (quotes files-call ≥1 unless quotes independently skip). Do **not** require whole-command `Vendor I/O: 0` or keep CLI exit 0 on this plant — quotes follow AC-1 / AC-2 / AC-3 / AC-14 / AC-16 independently (successful quotes GET stores `kept` / `empty extract`; quotes miss or download-failed is that class’s non-zero verdict). GATE Q twin: SPY already kept for `(D, trades)` + operator keep names QQQ → QQQ **trades** occupancy `no stored extract`; SPY trades stays kept; **trades** files-call 0; never print trades miss beside SPY keep; quotes class follows AC-1 / AC-2 / AC-3 / AC-14 / AC-16 independently. If **both** classes have a content-hit for any locked name, whole-command files-call is 0 and keep CLI is the skip-GET `[OK]` exit 0 story (SPEC §4): sibling `kept from Massive flat files` (or `empty extract`); named missing symbol `no stored extract`; `Vendor I/O: 0` files GET; **Not a miss.** Never `[ERROR] download failed`. Mixed-class keep process exit: **non-zero** if any class this invocation is miss, download-failed, unreadable, unauthorized, not-storing, or refuse-to-mix; **0** only when every class is skip-GET success or a successful GET that stored `kept` / `empty extract`. Poison: miss occupancy or miss literal + sibling `kept` / `empty extract` for the same `(D, class)`. Completing missing names is Future. | test |
| 55 (SB) | S4 | Load of `(S, D)` with trades **unreadable** (durable pointer) and quotes **miss** or **no stored extract** returns HTTP **500** `massive_flat_files_unreadable` — not 200 miss envelope. Reverse classes equally. **Both classes unreadable** is the same **500**. Content-hit + sibling unreadable stays **200** with per-class occupancy and the unreadable class’s extract body `""`. | test |
| 56 (SB) | S4 | CLI dated inspect of `(S, D)` prints **per-class occupancy lines** using the same precedence as HTTP load (§4 table). Exit **0** only when at least one class is `kept` or `empty extract` and neither is `unreadable`, **or** both classes are `no stored extract` / Axis A weekend / not-elapsed / not-in-watchlist. Either class `unreadable` (including both unreadable) → non-zero. Miss-only (both miss, or miss + no stored extract, no content hit) → non-zero (same family as keep miss). This row is **inspect**, not keep; keep process exit is AC-54 / §5. | test |
| 57 | S6 | SPEC §4 carries **`NO_UI_CHANGE`**; no `DESIGN_SYSTEM.md` amendment; no new named trader dashboard route. This row does not certify trader-chrome absence, Pages 404, or `/_ops/metrics` non-render (those are AC-42–45). | review |
| 58 | S8 | This ship does not add a research-lab UI, move session-archive bodies to a remote object store, expand the watchlist, ingest Benzinga, buy hist-chain, or stand up a public SaaS feed. | review |
| 59 | S3 | Operator can keep/list/load **without** the trader UI (CLI and/or Railway-direct operator research read). | review |
| 60 | S6 | License one-liner present on research read / CLI: kept files are **our research, not redistributed as a live vendor feed.** | review |
| 61 | S4 | Standing-block wording, is/is-not block, glossary sentences, load-envelope precedence table, CLI dated-inspect mixed table, CLI skip-GET keep lines (per-class vs both-classes), mixed-class keep exit, CLI list occupancy column, and banned-term table in §4 are the approved copy (intentional). | review |

**Method notes.** Automate occupancy splits (including mixed-class load twin AC-4, no-miss-beside-keep **per-class** skip-GET AC-54, AC-1/AC-2 GET-only carve + empty-extract occupancy, unreadable+miss / both-unreadable 500 AC-55, CLI mixed inspect AC-56, mixed-class keep exit, and CLI list miss vs empty extract AC-25), credential refuses, zero-vendor read, provenance bans, collision vs serve, tape/coverage non-regression, Pages 404, secret egress, score identity, hub/SSE still publishing during keep (AC-30), and aggregates-omission — a reviewer will not see a silent `miss` fabrication, a REST key reused as SigV4 material, or `0 aggregates`. Review standing prose, license presence, `NO_UI_CHANGE` as a product non-choice, and parked-harvest absence. GATE Q must show **both** a rejecting path (not-elapsed no fetch, wrong-credential refuse, dated inspect no stored extract ≠ miss, extract does not mint live paid present, tape occupancy unchanged, weekend is not miss, OPRA not stored, aggregates column absent, miss envelope not used when sibling **class** is kept, miss occupancy not used when sibling **name** is kept for the same class, unreadable+miss and both-unreadable are 500, whole-command `Vendor I/O: 0` / keep exit 0 **not** asserted on a trades-only content-hit plant, keep exit 0 **not** asserted when quotes miss after trades skip) **and** an accepting planted due keep of trades **and** quotes for the trio **when no sibling content-hit exists**. GATE Q twin: SPY already kept for `(D, trades)` + keep names QQQ → QQQ **trades** `no stored extract`, SPY trades kept, **trades** files-call 0, never trades miss beside SPY keep; quotes follow AC-1/AC-2/AC-3/AC-14/AC-16 independently (do **not** require whole-command files-call 0 or keep CLI exit 0 on that plant). GATE Q twin (both-classes content-hit): whole-command files-call 0, skip-GET `[OK]` exit 0. Hollow “renders without throw” does not satisfy `test` marks. No DOM harness; trader silence is structural (empty-diff / copy-table scan, Pages 404, OperatorMetrics closed stage set). AC-30 is hub/SSE isolation + that structural chrome check — not a dimming paint assert.

## 4. UI + interaction

**NO_UI_CHANGE.** This feature consumes no dashboard route, component, token, motion, chip, LiveTape mode, Settings control, or copy table. No `DESIGN_SYSTEM.md` amendment. Traders see nothing. Live tape remains the genuine-stream widget’s title; this corpus does not occupy it.

**Flows:**

1. Operator runs `flat-files keep` for a named due `D` (optional locked symbol; off-list names do not GET). Standing block prints first. Keep is the only files.massive.com I/O. Skip GET **per entitled class** when any locked name already has a content-hit occupant for that `(D, class)`. Whole-command files-call 0 and keep CLI **exit 0** only when every class this invocation is skip-GET success or a successful GET that stored `kept` / `empty extract` (§5). A trades-only content-hit still GETs quotes.
2. Operator inspects a **named** D via clap `--et-date` (read-only) or Railway-direct `GET /api/_research/flat-files/{symbol}/extract?et_date=`. Undated list is `GET /api/_research/flat-files/{symbol}`. Zero REST/WS and zero S3. HTTP evidence is `this process`; CLI evidence is `local`.
3. Trader path is unchanged through keep success, keep refuse, list, load, and every degraded occupancy (`NO_UI_CHANGE`).

**Component states** — every one specified:

| Component | default | loading | empty | error | offline/stale |
|---|---|---|---|---|---|
| Landing / Ticker (incl. Live tape) / Positions / Scanner / Settings / Ask-AI / shell | unchanged | unchanged | unchanged | unchanged | unchanged (`NO_UI_CHANGE`) |
| `/_ops/metrics` | existing latency tables | `Loading metrics…` | existing empty | `Metrics readout unavailable.` | N/A — this corpus adds no state |
| CLI `flat-files` | standing block then occupancy | `[RUNNING] flat-files — no verdict yet` (not a verdict) | occupancy literals below; list occupancy column required; dated inspect uses mixed table; both-classes skip-GET is `[OK]` exit 0; mixed-class keep exit follows §5 | `[ERROR]` lines below (not a class skip-GET) | N/A — a dated `et_date` is research, not stale-live |
| HTTP research list | 200 honest envelope | N/A (no loading field) | 200 empty `extracts[]` + hit framing + `detail` null | 401 / 400 / 500 closed codes | N/A |
| HTTP research load | 200 honest envelope per §4 precedence | N/A | 200 `no stored extract` on named due D | 401 / 422 / 500 closed codes (unreadable+miss and both-unreadable are 500) | N/A |

**Copy — standing block first** on CLI stdout and on any human-printed HTTP twin, before any count:

```
MASSIVE FLAT FILES — RESEARCH CORPUS · NOT A LIVE PAID SESSION BOOK · NOT A SESSION DAY TAPE · NOT A PLAYBACK
  Command:     flat-files
  Evidence:    local
  Watchlist:   SPY, QQQ, IWM
  Identity:    (symbol, et_date) America/New_York · vendor file is universe-per-day
  Payload:     stocks SIP trades · quotes · compressed CSV · not OPRA · not hist-chain
  Extract:     watchlist rows only · not a full-universe redistribution · not a full open-to-close claim
  Provenance:  reconstructed flat file · never live_massive · never coverage present · never session day tape
  Publish:     ~11:00 ET the next America/New_York day · before that a day is not-elapsed, not a miss
  Vendor I/O:  inspect = 0 REST/WS and 0 S3 · keep = files.massive.com (S3), not api.massive.com
  Authorizes:  nothing. No live score/tier/gate/fingerprint change, no trader UI,
               no ticker playback, no session-archive fill, no Path-A conversion this gate.
```

HTTP against a production process may say **Evidence: this process** (not “hosted verified”, not “CI”, not `Evidence: local` on a Railway-origin GET, not `Evidence: production` on a laptop CLI). Payload line names **trades** and **quotes** only — no `· aggregates`. Extract line does **not** assert “not a full-universe keep” as a store fact.

<!-- spire:council-resolution:v1 b0339d4f1517bdd80c0f4e860c30db12ad59cac731e39a72e17a3f85de0d553e folded -->
<!-- spire:council-resolution:v1 8b39d0dd2632cf1b74b147adcdf60afa374aec00dec6f45e402c84b5816a86cf folded -->

Closing line (CLI): `MASSIVE FLAT FILES — NOT A LIVE PAID SESSION BOOK · NOT A SESSION DAY TAPE · NOT A PLAYBACK · Authorizes: nothing · local audit is not production coverage`

HTTP closing: `MASSIVE FLAT FILES — NOT A LIVE PAID SESSION BOOK · NOT A SESSION DAY TAPE · NOT A PLAYBACK · Authorizes: nothing`

Inspect-hit / content-hit provenance: `loaded from Massive flat files · no REST/WS call` — only when at least one class (load) or at least one list row (list) is `kept` or `empty extract`. Miss-only, unreadable-only, empty list, and no-stored-extract load use provenance `no vendor call`.

License: `Our research · not redistributed as a live vendor feed.`

**Is / is not** (kept, empty extract, no stored extract inspect): **Is** a research corpus of entitled stocks SIP trades and quotes downloaded from files.massive.com as next-day compressed CSVs and extracted to locked watchlist SPY / QQQ / IWM. **Is not:** a live paid session book; not coverage `present`; not `live_massive`; not the session day tape; not Path-A / Path-B; not ticker playback; not OPRA; not S3 hist-chain we newly bought; not a scoring input; not a full-universe redistribution; not a full open-to-close session claim from a filtered extract. No stored extract does **not** add “vendor file due and absent.”

**Load envelope precedence** (one `GET .../extract?et_date=` of `(symbol, et_date)`; trades and quotes occupy independently; **no second HTTP round-trip**). Content hit = occupancy `kept` or `empty extract`. Evaluate Axis A first. Then **unreadable store-fault before miss envelope**.

| Condition | HTTP | envelope `detail` | Class fields |
|---|---|---|---|
| Axis A not-in-watchlist | 200 `RESEARCH READ — MASSIVE FLAT FILES NOT IN WATCHLIST` | `not in flat-files watchlist: {SYMBOL}` | both occupancies `not-in-watchlist` |
| Axis A ineligible weekend | 200 `RESEARCH READ — MASSIVE FLAT FILES INELIGIBLE WEEKEND` | `flat files ineligible weekend: {ET_DATE}` | both `ineligible weekend` |
| Axis A not-elapsed | 200 `RESEARCH READ — MASSIVE FLAT FILES NOT ELAPSED` | `flat files not elapsed: vendor file for {ET_DATE} not yet published` | both `not-elapsed` |
| **Either** class is a content hit (`kept` or `empty extract`) | 200 `RESEARCH READ — MASSIVE FLAT FILES` | **`null`** — never the miss literal | `trades_occupancy` / `quotes_occupancy` hold that class’s token (`kept` / `empty extract` / `miss` / `no stored extract` / `unreadable`). Unreadable sibling extract body is `""`. The miss class’s miss fact is the occupancy token `miss` on **that class field**, not envelope `detail`. Cross-class miss only (quotes file 404 with **zero** locked quotes extracts). |
| Neither class is a content hit and **at least one** class is **unreadable** (sibling miss, no stored extract, **or also unreadable**) | **500** `massive_flat_files_unreadable` | `flat files unreadable: {reason}` | not a 200 miss envelope. Both-unreadable is this 500. |
| Neither class is a content hit, neither is unreadable, and **at least one** is proved `miss` | 200 `RESEARCH READ — NO MASSIVE FLAT FILES` | `flat files miss: vendor file for {ET_DATE} due and absent` | miss class occupancy `miss`; sibling may be `miss` or `no stored extract` |
| Both classes `no stored extract` (due, no occupant, no proved 404) | 200 `RESEARCH READ — NO MASSIVE FLAT FILES` | `flat files no stored extract: {ET_DATE}` | both `no stored extract` |

**GATE Q mixed twins** (locked; reverse classes equally):

| Plant | status | `framing` / error | envelope `detail` | `trades_occupancy` | `quotes_occupancy` |
|---|---|---|---|---|---|
| trades kept, quotes miss (quotes class: zero locked extracts) | 200 | `RESEARCH READ — MASSIVE FLAT FILES` | `null` | `kept` | `miss` |
| trades empty extract, quotes miss | 200 | `RESEARCH READ — MASSIVE FLAT FILES` | `null` | `empty extract` | `miss` |
| trades kept, quotes no stored extract | 200 | `RESEARCH READ — MASSIVE FLAT FILES` | `null` | `kept` | `no stored extract` |
| trades kept, quotes unreadable | 200 | `RESEARCH READ — MASSIVE FLAT FILES` | `null` | `kept` | `unreadable` (`quotes_extract` `""`) |
| trades unreadable, quotes miss | **500** | `massive_flat_files_unreadable` | `flat files unreadable: {reason}` | (error body; not 200 miss envelope) | |
| trades unreadable, quotes no stored extract | **500** | `massive_flat_files_unreadable` | `flat files unreadable: {reason}` | | |
| both classes unreadable | **500** | `massive_flat_files_unreadable` | `flat files unreadable: {reason}` | (error body) | |
| trades miss, quotes miss | 200 | `RESEARCH READ — NO MASSIVE FLAT FILES` | miss literal | `miss` | `miss` |
| trades miss, quotes no stored extract | 200 | `RESEARCH READ — NO MASSIVE FLAT FILES` | miss literal | `miss` | `no stored extract` |
| both no stored extract | 200 | `RESEARCH READ — NO MASSIVE FLAT FILES` | no stored extract literal | `no stored extract` | `no stored extract` |

Store-level **500** (not-storing, refuse-to-mix) unchanged.

**CLI dated inspect mixed-class** (same precedence as HTTP load; per-class occupancy lines; `--et-date` required). Axis A weekend / not-elapsed / not-in-watchlist: exit 0, closed literals, both classes inherit.

| trades | quotes | CLI dated inspect exit | Print |
|---|---|---|---|
| `kept` or `empty extract` | `kept` / `empty extract` / `miss` / `no stored extract` | **0** | per-class occupancy lines; no envelope miss literal denying the content-hit class |
| `kept` or `empty extract` | `unreadable` | **non-zero** | unreadable `[ERROR]` on that class; content-hit class still named; unreadable extract not dumped |
| `unreadable` | `miss` or `no stored extract` | **non-zero** | unreadable `[ERROR]` — not the miss literal as the whole verdict |
| `unreadable` | `unreadable` | **non-zero** | unreadable `[ERROR]` (HTTP analog is 500) |
| `miss` | `miss` | **non-zero** | miss-only; keep CLI already non-zero for miss |
| `miss` | `no stored extract` | **non-zero** | miss-only |
| `no stored extract` | `no stored extract` | **0** | `flat files no stored extract: {ET_DATE}` · Not a miss |

**Keep CLI skip-GET (per class).** Skip GET **for a class** when any locked name already has `kept` or `empty extract` for `(D, class)` and the named missing symbol has no occupant. That class skip is a **successful skip for that class**, not a keep failure: never the miss literal for that class; never `[ERROR] download failed` for that class (no GET issued for that class). Durable `{NAMED}` state for that class is **`no stored extract` only**. Print per-class occupancy: sibling `kept from Massive flat files` (or `empty extract`); named missing symbol `no stored extract`; **Not a miss** (this class). Files-call 0 **for that class**.

**Whole-command skip-GET `[OK]` line** — **only when both** classes have a content-hit (whole-command files-call 0):

`[OK] flat-files — {SIBLING} kept from Massive flat files · {NAMED} no stored extract · Vendor I/O: 0 files GET`

When the sibling is empty extract, print `{SIBLING} empty extract` in place of `kept from Massive flat files`. Append **Not a miss.** Exit **0**. Never the miss literal. Never `[ERROR] download failed` (no GET issued).

**Mixed-class keep** (one class skips, the other GETs — the AC-54 plant): print per-class occupancy/verdict lines. The skip class uses the per-class skip print above (**trades** files-call 0 on that plant). The GET class follows AC-1 / AC-2 / AC-3 / AC-14 / AC-16 (quotes still GET). Do **not** print whole-command `Vendor I/O: 0 files GET`. Do **not** require keep CLI exit 0 on that plant. Process exit is mixed-class keep exit (§5). GATE Q twin: SPY already kept for `(D, trades)` + keep names QQQ → QQQ **trades** `no stored extract`; SPY trades stays kept; **trades** files-call 0; never trades miss beside SPY keep; quotes independent.

**Undated list** never uses `no stored extract`. Empty `extracts[]` + framing `RESEARCH READ — MASSIVE FLAT FILES` + `detail` null + provenance `no vendor call`. List miss rows exist only for a `(D, class)` with **zero** locked extracts.

Never send session-book, coverage, tape, or replay framing when the object is this corpus.

**Closed operator occupancy lines:**

| Occupancy | When (vouched) | Exact operator-facing line | CLI |
|---|---|---|---|
| `kept` | Readable extract; ≥1 row of that class | `kept from Massive flat files` | `[OK] flat-files — kept from Massive flat files · not a live paid session book · not a session day tape · local audit is not production coverage` · that class is a successful store; process exit follows mixed-class keep exit |
| `not-elapsed` | Publish clock not passed | `flat files not elapsed: vendor file for {ET_DATE} not yet published` | `[OK]` · **Not a miss.** · exit 0 |
| `miss` | **Keep** proved vendor 404 / NoSuchKey after due **and zero locked extracts** for that `(D, class)` (or dated inspect/load of that persisted record) | `flat files miss: vendor file for {ET_DATE} due and absent` | keep `[ERROR]` **non-zero** (that class is miss → process non-zero); dated inspect of miss-only **non-zero**. Never printed beside a sibling keep of the same class. |
| `no stored extract` | **Dated inspect or load** of due D; store has no occupant; 404 not proved; 0 S3. Also the durable state of a missing name after keep skip-GET. | `flat files no stored extract: {ET_DATE}` | inspect `[OK]` exit 0 when both classes are this (or Axis A). HTTP **200**. Keep skip-GET uses the skip-GET print above, not this inspect line alone. Not the undated list. |
| keep skip-GET (one class) | Any locked name already `kept` / `empty extract` for **this** `(D, class)`; named symbol has no occupant; **no GET for this class** | sibling `kept from Massive flat files` (or `empty extract`) · `{NAMED} no stored extract` · **this class** files GET: 0 | **Not a miss** (this class) · never `[ERROR] download failed` for this class · process exit follows mixed-class keep exit · **not** whole-command `Vendor I/O: 0` |
| keep skip-GET (both classes) | Both classes have a content-hit; named symbol has no occupant; **no GET** | `[OK] flat-files — {SIBLING} kept from Massive flat files · {NAMED} no stored extract · Vendor I/O: 0 files GET` | **exit 0** · **Not a miss.** · never `[ERROR] download failed` |
| `empty extract` | File present and readable; this watchlist symbol has 0 rows; **content-hit** | `flat files empty extract: {SYMBOL} on {ET_DATE}` | inspect exit 0; keep of that class is a successful store |
| `unreadable` | Promoted object/pointer exists; body not readable | `flat files unreadable: {reason}` | `[ERROR]` non-zero (that class unreadable → process non-zero) |
| `not-storing` | Dedicated root unset / empty / unwritable | `flat files not storing` | `[ERROR]` non-zero |
| refuse-to-mix | Keep root collides with tape / archive / ring | `flat files refuse to mix` | `[ERROR] flat-files — flat files refuse to mix. No keep recorded.` · never `flat files not storing` |
| `download failed` | Keep GET **ran** for that class; absence **not** confirmed (including 404 while a locked extract already exists) | `flat files download failed: vendor file for {ET_DATE} not confirmed` | `[ERROR]` non-zero · No keep recorded · **not** a list/load occupancy · **not** skip-GET of that class |
| missing-files-credentials | Armed keep; files pair absent; **zero** fetch | `flat files missing credentials` | `[ERROR] flat-files — flat files missing credentials. No keep recorded.` · **no** REST-apiKey clause · **not** a list/load occupancy |
| wrong-credential-class | Live REST key in a files slot; **zero** fetch | `flat files wrong credential class · REST apiKey is not the files secret` | `[ERROR] flat-files — flat files wrong credential class. REST apiKey is not the files secret. No keep recorded.` · **not** a list/load occupancy |
| `ineligible weekend` | Named D is ET Saturday or Sunday | `flat files ineligible weekend: {ET_DATE}` | `[OK]` exit 0 · not a miss |
| not-in-watchlist | Name not SPY / QQQ / IWM | `not in flat-files watchlist: {SYMBOL}` | `[OK]` exit 0 |
| HTTP unauthorized | Operator token missing/wrong when required | shipped **`metrics_unauthorized`** only | HTTP **401** · no extract body |

**CLI list layout** (HTTP twin is `extracts[]` per class — **omit aggregates**). Each listable row carries an occupancy token from the same closed deck as HTTP `extracts[].occupancy` (`kept` · `empty extract` · `miss` · `unreadable`):

```
  ET date      Symbol  class    occupancy       rows
  {YYYY-MM-DD}  SPY     trades   kept            {n}
  {YYYY-MM-DD}  SPY     quotes   miss            0
  {YYYY-MM-DD}  QQQ     quotes   empty extract   0
```

Watchlist order **SPY, QQQ, IWM**; within a date, `trades` before `quotes`. A miss sidecar prints occupancy **`miss`** and **0** rows **only** for a `(D, class)` with zero locked extracts (the SPY quotes miss line is a **different class** from SPY trades kept). An empty extract prints occupancy **`empty extract`** and **0** rows. Those two are **not** the same cell — do not print a bare `0` without the occupancy token. Do **not** list QQQ trades as `miss` while SPY trades is `kept`. Kind omitted when not a product this slice — **do not print `0 aggregates`**. Counts are `{SYMBOL} {kind}: {n} rows` when vouched on inspect, never a completeness percent, never “full open-to-close session.” Undated list does not invent `no stored extract` rows.

<!-- spire:council-resolution:v1 75e926882b411ac1f1eb9cda762cecb2f42ef7cc501fb341990e40bf3223d4bd folded -->
<!-- spire:council-resolution:v1 f91d4ee8cf3b127bf4be3334f199d5e70f2ccde39a4e50c0039de3263beca1ba folded -->
<!-- spire:council-resolution:v1 5d8eda773b99e715220d521d0e159d0e572edf8d009320ee783aeda08a7a6b4c folded -->
<!-- spire:council-resolution:v1 dadbf06b4da5165103f2011d694bb4f241259f51e94820a7e2ad075e2c4042a3 folded -->

**Poison on this vehicle (GATE Q fails if they appear as this occupancy):** `Unattempted`, `present`, `Stored`, `missing`, `not yet due`, `blocked occupancy`, `live`, `LIVE`, `live_massive`, `Live tape`, `live-tape`, `live-paid-present`, `no session day tape…`, `session day tape not storing`, Path-A/Path-B literals, a completeness `%`, “full open-to-close session”, `$199+$199`, **miss occupancy or miss literal beside a sibling `kept` / `empty extract` / unreadable for the same `(D, class)`**.

**Glossary (operator only):**

| Term | Sentence |
|---|---|
| Massive flat files | Next-day stocks SIP compressed CSVs from files.massive.com, kept as our research corpus for SPY / QQQ / IWM. Not a live paid session book. Not the session day tape. Not ticker playback. |
| kept | That extract is stored and readable with ≥1 rows. Not coverage `present`. Not live Massive. Not `Stored`. Content-hit. |
| not-elapsed | The vendor file for that ET date is not yet published (~11:00 ET the next day). Not a miss. |
| miss | Keep proved the vendor file due and absent (404 / no-such-key) with **zero** locked extracts for that class/day. Distinct from empty extract, not-elapsed, download failed, and no stored extract. Never printed beside a sibling keep of the same class. On mixed **class** load, lives on the class occupancy field when the sibling class is a content hit. |
| no stored extract | Dated inspect or load of a named D found no occupant. Zero S3. Does not prove the vendor file is absent. Distinct from miss, empty extract, not-elapsed, download failed, and from an empty undated list. Missing QQQ after skip-GET (SPY already kept **for that class**) is this class — the only durable occupancy for that name. |
| empty extract | The file is present; this watchlist symbol has zero rows. Distinct from miss and from no stored extract. **Content-hit** — skips later GET for that class the same as `kept`. CLI list prints this occupancy next to 0 rows. |
| unreadable | A promoted object exists but could not be read. Distinct from miss, empty extract, and leftover keep temp. On a 200 content-hit sibling, the unreadable class’s extract body is `""`. Both-unreadable load is HTTP 500. |
| not-storing | The dedicated flat-files store is disabled or unavailable. Not a list of empty symbols. Not refuse-to-mix. |
| download failed | Keep GET **ran** for that class; vendor absence was not confirmed. Includes 404 while a locked extract already exists for that `(D, class)`. Not a miss. Not a list/load occupancy. Not the skip-GET path for that class (no GET). |
| missing-files-credentials | Armed keep; files Access Key + Secret absent. Zero fetch. The REST apiKey clause is not printed (no substitution was observed). Not a list/load occupancy. |
| wrong-credential-class | Live REST key value was in a files slot. Zero fetch. REST apiKey is not the files secret. Not a list/load occupancy. |
| live tape | **Not a flat-files word.** Session day tape / ticker Live tape only. |
| present | **Not a flat-files word.** On coverage, a loadable live paid session book. |
| local | This CLI classified this process’s corpus. It is not production/hosted coverage. |
| watchlist extract | Rows for SPY / QQQ / IWM taken from a universe-per-day file. Not a claim that we redistribute the whole SIP session. |

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (Status: SET — The Curvature Terminal). This feature is **NO_UI_CHANGE**.

**Design direction:** does not apply dashboard components, tokens, or motion. Enforcement is an empty `apps/dashboard` diff and no canon amendment. Green/red remain direction, not “gzip health.”

## 5. Error handling

| Failure class | Operator sees | Logs | Desk |
|---|---|---|---|
| Not-elapsed | `flat files not elapsed: vendor file for {ET_DATE} not yet published` · CLI exit 0 · Not a miss | none as keep outage | unchanged |
| Ineligible weekend | `flat files ineligible weekend: {ET_DATE}` · exit 0 | none as keep outage | unchanged |
| Not in watchlist | `not in flat-files watchlist: {SYMBOL}` · exit 0 · no skip line | none | unchanged |
| Miss (proved 404, **zero** locked extracts) | `flat files miss: vendor file for {ET_DATE} due and absent` · that class is miss · keep process **non-zero**; mixed **class** load uses class occupancy when sibling class is a content hit | proved-absence sidecar | unchanged |
| 404 while a locked extract already exists (GET **ran** for that class) | `flat files download failed: vendor file for {ET_DATE} not confirmed` · **no** miss sidecar · sibling keep stands · process **non-zero** | not-confirmed | unchanged |
| Skip GET (this class, sibling content-hit) | sibling kept/empty extract · named missing `no stored extract` · **this class** files GET: 0 · **Not a miss** (this class) · never `[ERROR] download failed` for this class | no files GET for this class | unchanged |
| Skip GET (both classes content-hit) | `[OK]` · sibling kept/empty extract · named missing `no stored extract` · `Vendor I/O: 0` files GET · **Not a miss.** · **exit 0** · never `[ERROR] download failed` | no files GET | unchanged |
| Mixed-class keep process exit | Process exit **non-zero** if **any** class this invocation is miss, download-failed, unreadable, unauthorized, not-storing, or refuse-to-mix. Process exit **0** only when **every** class is skip-GET success or a successful GET that stored `kept` / `empty extract`. A trades skip does **not** force exit 0 while quotes miss or download-failed. Do **not** print whole-command `Vendor I/O: 0` unless both classes skipped. | per-class verdict | unchanged |
| No stored extract | `flat files no stored extract: {ET_DATE}` · dated inspect exit 0 when both classes are this · HTTP load 200 | none as vendor hole | unchanged |
| Download failed | `flat files download failed: vendor file for {ET_DATE} not confirmed` · keep process **non-zero** · GET ran for that class | skip; temp discarded | unchanged — never 5xx |
| Crash leftover temp (no promoted extract) | dated inspect/load: **`no stored extract`** (temp ignored; not unreadable; not a download-failed list row) | temp leftover, not classified as occupant | unchanged |
| Partial-trio crash (SPY promoted for a class) | SPY stays kept for that class; QQQ/IWM `no stored extract` for that class; later keep skips GET **for that class**; never miss for that class; the other class with no content-hit still GETs; process exit follows mixed-class keep exit | temp discarded | unchanged |
| Unreadable | `flat files unreadable: {reason}` · HTTP **500** when neither class is a content hit (including sibling miss / no stored extract / **both unreadable**) · CLI non-zero (that class unreadable → process non-zero) | store error | unchanged |
| Not-storing | `flat files not storing` · HTTP 500 `massive_flat_files_not_storing` · CLI non-zero | not-storing | still serves |
| Refuse to mix | `flat files refuse to mix` · HTTP 500 `massive_flat_files_refuse_to_mix` · CLI non-zero | mix refused; wrote nothing on tape/archive/ring | **`serve` still binds**; live REST/WS unchanged |
| Missing files pair | `flat files missing credentials` · no REST clause · GET count 0 | refuse-before-GET | unchanged |
| Wrong credential class | `flat files wrong credential class · REST apiKey is not the files secret` · GET count 0 | refuse-before-GET | unchanged |
| HTTP token miss | 401 `metrics_unauthorized` · shipped detail `Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token` · no extract body | none as skip | unchanged |
| Unparseable `et_date` | HTTP 422 `et_date_unparseable` · `et_date must be YYYY-MM-DD` · `vendor_called: false` | none as skip | unchanged |
| Invalid `limit` | HTTP 400 `invalid_limit` · `limit must be >= 1` · `vendor_called: false` | none as skip | unchanged |
| Inspect would call REST/WS or S3 | `[ERROR] flat-files — inspect must not call REST/WS or S3. No load recorded.` | error; no complete-looking dump | unchanged |
| Production unset | serve log `flat files not fetching — production unset` — **not** a CLI `[OK]` keep | no files client | still talks to Massive REST/WS |
| Keep skipped (desk intact) | `flat files keep skipped — trader path unchanged` (or the closed refuse) | skip | bundle / scan / SSE / ensure intact; hub still publishes |
| Coverage hole for `(S, D)` | stays missing on the coverage vehicle | none as flat-files present | unchanged |
| Secrets in env | **never** listed, loaded, logged, or printed | sanitizer on error URLs | unchanged |

**Mixed-class keep process exit (CLI paragraph).** After the per-class loop: if **any** class this invocation is miss, download-failed, unreadable, unauthorized, not-storing, or refuse-to-mix, the process exits **non-zero**. The process exits **0** only when **every** class this invocation is either skip-GET success or a successful GET that stored `kept` / `empty extract`. Pre-GET whole-command refuses (not-elapsed, ineligible, not-in-watchlist, not-storing, refuse-to-mix, missing-files-credentials, wrong-credential-class) still apply before the per-class loop. A trades-only content-hit plant that then misses or download-fails quotes exits **non-zero**. A trades-only content-hit plant whose quotes GET stores `kept` or `empty extract` exits **0**. Both-classes content-hit is the skip-GET `[OK]` exit 0 story.

Retries: miss and download-failed may be retried by a later armed keep. Inspect never retries via S3. Unreadable requires a **promoted** durable pointer. Leftover crash temp is ignored by classify; dated inspect/load of that D with no promoted extract is **`no stored extract`**, not unreadable and not a download-failed grid. Partial-trio: promoted extract remains; missing names stay `no stored extract`; skip GET **for that class**; the other class still GETs if it has no content-hit; process exit follows mixed-class keep exit.

Missing pair ≠ wrong-credential-class ≠ HTTP unauthorized ≠ 401/403 after GET. The REST-apiKey clause prints only on wrong-credential-class.

<!-- spire:council-resolution:v1 67b8aeeb3adf2341cca0750594adbf8c2e1e30bd7d49c58f2b72c3b121f943b7 folded -->

## 6. Interface — pointer  ← THE LOAD-BEARING LINK

**Interface:** `.spire/clusters/tech/contracts/massive-flat-file-keep/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** This ship **adds** operator/research `GET /api/_research/flat-files/{symbol}` (list) and `GET /api/_research/flat-files/{symbol}/extract` (load, required `et_date`). It is **not** `NO_BACKEND_CHANGE`. It does **not** nest on `GET /api/_metrics`. Existing `GET /api/_research/session-books/{symbol}` list/load envelopes are re-pinned so this ship cannot reshape coverage `present` / session-book framing. Existing `GET /api/_research/session-day-tape/{symbol}` list is re-pinned so this vehicle cannot overwrite tape framing. Auth is the metrics/research token (`metrics_token_ok`), not a trader session cookie — `"auth": true` is wrong. Optional clap `flat-files` is not executed by the conformance runner. Field lists live in the interface file. No playback endpoints. Combined trades+quotes envelope with **load-envelope precedence** in §4; no aggregates field. Keep write (CLI) skips GET **per entitled class** when any locked name already has a content-hit occupant for `(D, class)` (AC-1/AC-2 do not apply on that class’s skip path). Whole-command files-call 0 and keep CLI exit 0 only when every class is skip-GET success or a successful GET that stored `kept` / `empty extract`. A trades-only content-hit still GETs quotes.

## 7. Testing strategy

**Hermetic unit (injected America/New_York clock + fixture extract store + stub files client):** due keep of planted trades+quotes for SPY/QQQ/IWM **when no sibling content-hit exists** → two classes stored as `kept` or `empty extract` and independently loadable (AC-1/AC-2); mixed trades-kept + quotes-miss load twin (AC-4; quotes class has zero locked extracts); SPY trades kept + operator keep names QQQ → skip GET **for trades**, QQQ **trades** `no stored extract`, SPY trades kept, **trades** files-call 0, never trades miss, never download-failed **for trades**; quotes still GET and follow AC-1/AC-2/AC-3/AC-14/AC-16 (do **not** assert whole-command files-call 0 or keep CLI exit 0 on that plant) (AC-54); both-classes content-hit → whole-command files-call 0, skip-GET `[OK]` exit 0; trades skip + quotes miss/download-failed → process **non-zero**; trades skip + quotes GET stored `kept`/`empty extract` → process **0**; planted 404 after a GET ran while sibling extract exists → download-failed CLI, no miss sidecar, missing name still `no stored extract` on load; NVDA not-in-watchlist and files-call 0; clock 10:59 ET D+1 not-elapsed and no GET, 11:00 due; Friday→Saturday calendar D+1; keep does not sleep; keep 404/NoSuchKey with zero locked extracts → miss + proved-absence sidecar + process non-zero; dated inspect of empty due store → no stored extract, 0 S3, not the miss literal; undated empty list → empty `extracts[]` + hit framing, not no stored extract; inspect of persisted miss → miss, 0 S3; CLI list occupancy `miss` vs `empty extract` both with 0 rows; CLI dated inspect mixed table (AC-56); transport/401/403 → download failed on keep CLI, not on list/load DTO; leftover crash temp ignored → dated inspect `no stored extract`; partial-trio crash → SPY kept **for that class**, QQQ `no stored extract`, skip GET **for that class**, other class still GETs if no content-hit; planted universe with zero IWM rows → empty extract (content-hit; AC-1/AC-2 pass); planted corrupt QQQ quotes + SPY quotes kept → 200 unreadable sibling, `quotes_extract` `""`; planted unreadable trades + quotes miss → HTTP 500 (AC-55); both classes unreadable → HTTP 500; already-kept not overwritten; live REST key in files slot refuses with 0 GET and REST clause; missing pair distinct refuse with no REST clause; unset root not-storing, desk up; collision refuse-to-mix, serve would still bind, not not-storing; coverage missing stays missing; tape occupancy unchanged; load with vendor stub down still loads extracts; gzip temp discarded — load body is extract CSV only; no aggregates column / `0 aggregates`; score triple identical; hub/SSE still emit during keep success and keep fault; canary secrets absent; Evidence: local; poison tokens absent including miss-beside-keep.

**Structural scans:** files leaf has no `MASSIVE_API_KEY` / `insert_if_absent` / `LiveMassive` / `MarketDataPort`; scoring/engine crates do not import the files leaf; `Cargo.toml` has no `aws-sdk`; trader dashboard empty-diff / copy-table; OperatorMetrics closed stage set; Pages 404 prefix including `/api/_research/flat-files`; session-book / coverage / tape framing strings unchanged; request-path modules have no files-client type; no serve poller / interval fetch; no `MarketDataSourceKind` fourth variant.

**HTTP:** token 401 `metrics_unauthorized`; 422 bad `et_date`; 200 not-in-watchlist (does not require planted root); 200 not-elapsed / no stored extract / weekend when storing; 500 not-storing / unreadable (no content-hit sibling, including unreadable+miss and both-unreadable) / refuse-to-mix; mixed-class 200 twin; `vendor_called: false`; `authorizes: nothing`; no `live_massive` on the envelope. Live `interface_conformance.mjs` checks the interface JSON block (shape/types). Exact `vendor_called === false` and closed literals are unit/GATE Q.

**Isolation:** bundle/scan/SSE/ensure still succeed when keep fails or the store is not-storing / refuse-to-mix; live hub/SSE still publish ticks; score/tier/fingerprint byte-identical on vs off and succeed vs fail.

**Not required:** DOM harness; merge CI against production files disks; one named test per AC; a VERIFY_MATRIX.md; hosted “we kept every Tuesday”; playback REST; a live 401 probe in `interface_conformance.mjs` (token unset locally is open — GATE Q owns the gate); a paint/dimming assert for AC-30.

Invariants that must not silently regress: trades+quotes independent; skip-GET and files-call **per class**; AC-1/AC-2 do not store on skip-GET of that class and admit `empty extract` as a successful GET store; mixed load does not use miss envelope `detail` when a sibling **class** is kept; same `(D, class)` never miss beside a sibling keep; skip GET when any content-hit occupant exists **for that class**; whole-command `Vendor I/O: 0` / keep CLI exit 0 only when both classes skip or every class is skip-success / GET stored `kept`/`empty extract`; mixed-class keep exit non-zero if any class is miss / download-failed / unreadable / unauthorized / not-storing / refuse-to-mix; dated inspect no stored extract ≠ miss ≠ empty undated list; CLI list miss ≠ empty extract at 0 rows; download failed ≠ miss and not on research-read DTOs and not on skip-GET of that class; crash temp ≠ unreadable; unreadable+miss and both-unreadable are 500; gzip not retained as occupant; aggregates omitted; collision does not refuse `serve`; REST key in files slot is 0 GET; extracts never `LiveMassive` / coverage `present`; Pages 404; local ≠ hosted.

## 8. Guardrails this feature must not break

- **`present-is-live-paid-only` (HARD)** — reconstructed S3/flat-file occupants never insert as `LiveMassive` / coverage `present`.
- **`operator-vs-trader-path-separation`** — CLI + `_research`; Pages still 404; no ticker player chrome; fetch off the trader request path.
- **`additive-keeps-score-byte-identical`** — keep is never a scoring input. **Authorizes: nothing.**
- **`absent-is-not-none`** — not-elapsed ≠ miss ≠ no stored extract ≠ empty extract ≠ unreadable ≠ not-storing ≠ download failed ≠ missing-files-credentials ≠ wrong-credential-class ≠ ineligible-weekend ≠ not-in-watchlist ≠ refuse-to-mix ≠ HTTP unauthorized ≠ kept. CLI list occupancy token distinguishes miss from empty extract at 0 rows. Mixed-class load does not let envelope miss `detail` deny a sibling **class** keep. Same `(D, class)` does not print miss beside a sibling **name** keep. Skip-GET missing names are `no stored extract`, not download-failed occupancy. Skip-GET and files-call are **per class**. Live tape and live paid present are distinguished by **absence** on this vehicle.
- **`production-fails-closed`** — armed keep with missing files credentials, unwritable root, or mix-collision refuses; production unset does not fetch files; keep root is **not** a production serve prerequisite.
- **`best-effort-isolated-or-null`** — download/keep fault never 5xxs the desk.
- **`single-ticker-on-demand`** — fetch is off the trader request path.
- **`live-vs-static-isolation`** — keep never blanks the live path (hub/SSE still publish). Trader chrome is `NO_UI_CHANGE`.
- **`no-secrets-in-image`** — S3 access/secret + REST key never in list/load/CLI; runtime env only.
- **`structural-over-prose-enforcement`** — poison `insert_if_absent` as LiveMassive, REST key as files secret succeeding, not-elapsed as miss, dated-inspect-empty as miss, aggregates-kept as quotes-kept, `0 aggregates`, mix into tape root, `Unattempted`/`present`/`Stored`/`Live tape` as this occupancy, miss envelope `detail` over a sibling class keep, **miss occupancy beside a sibling keep for the same `(D, class)`**, AC-1/AC-2 storing QQQ on skip-GET of that class, AC-1/AC-2 excluding AC-18 empty extract, unreadable+miss or both-unreadable as 200 miss envelope, whole-command `Vendor I/O: 0` / keep exit 0 on a trades-only content-hit plant, keep exit 0 after trades skip while quotes miss → gate red. Poison tests must be non-vacuous.
- **`cited-code-is-verified-not-assumed`** — cite live Rust REST/WS + tape root + source kind above, not Python, not briefing HTML as an oracle.
- **`local-evidence-is-not-hosted-evidence`** — a local planted-keep receipt is not production “we kept every Tuesday after cancel.”
- **Massive license:** kept files are our research, never redistributed as a live vendor feed.

## 9. Open questions

None. Human rulings 2026-08-30 closed aggregates (Out this slice; omit column), universe gzip retention (extract-only; stream-through-temp; discard), and S2 pass-2 Critical (never persist miss beside a sibling keep for the same `(D, class)`; skip GET when any content-hit occupant exists **for that class**). Skip-GET and files-call counts are per entitled class; whole-command `Vendor I/O: 0` / keep CLI exit 0 only when both classes have a content-hit (or every class is skip-success / GET stored `kept`/`empty extract`). AC-1/AC-2 apply only when keep successfully GETs **that class** and occupancy is `kept` or `empty extract`. Mixed-class keep process exit is §5. R3 technical exchanges closed miss vs not-confirmed vs inspect `no stored extract`, collision vs `serve` bind, credential three-way split, Stored→kept mapping, Unattempted/present/Stored print bans, and standing “watchlist extract · not a full-universe redistribution · not a full open-to-close claim.” Convert-into-tape, gzip-keep / completing missing names after skip-GET, aggregates as a third class, OPRA, watchlist expansion, unattended poller, and lab UI remain **Future**, not deferred decisions.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"conflict_id":"502673893d816bd15e8c3efc5ba8267bd02ffae147202119c14eeb98048e06e8","disposition":"folded","index":0,"section":"§1","source":"R2-architect.md"},{"conflict_id":"0141cfb0acdb44e76235e1b95222ef014d9bad42f403715bc2d1aefaab6bacf7","disposition":"folded","index":1,"section":"§2","source":"R2-architect.md"},{"conflict_id":"b5664f98bdfe1f72d7ba66fffeb78da2b98db1585d8e999a9a3b869b33b9b1c5","disposition":"folded","index":2,"section":"§2","source":"R2-architect.md"},{"conflict_id":"d8f79bcd7065acf4fefa0f2d6b399a4eb61e157c1798e1ba09f5c4a20fd840dc","disposition":"folded","index":0,"section":"§1","source":"R2-pm.md"},{"conflict_id":"b0e9bbb0d25cc3d1e0c91d1db9703def555f17f30c11a699dc5b2cd5be6f6ec4","disposition":"folded","index":1,"section":"§2","source":"R2-pm.md"},{"conflict_id":"b393fbb0e93db1d0463a306acdda69617a80dee8ef81c23f7a59666c55ae04ee","disposition":"folded","index":2,"section":"§3","source":"R2-pm.md"},{"conflict_id":"c74c9edd29ed09d48089ff7ee3ddfb94fcdcb8f7b2540d63db9262f733aa1e5c","disposition":"folded","index":3,"section":"§3","source":"R2-pm.md"},{"conflict_id":"6f4bbe4c7b45cb582a29b19ec817ff41dc585eba148c034f4e7601aa253996e2","disposition":"folded","index":0,"section":"§1","source":"R2-ux.md"},{"conflict_id":"b0339d4f1517bdd80c0f4e860c30db12ad59cac731e39a72e17a3f85de0d553e","disposition":"folded","index":1,"section":"§4","source":"R2-ux.md"},{"conflict_id":"75e926882b411ac1f1eb9cda762cecb2f42ef7cc501fb341990e40bf3223d4bd","disposition":"folded","index":2,"section":"§4","source":"R2-ux.md"},{"conflict_id":"f91d4ee8cf3b127bf4be3334f199d5e70f2ccde39a4e50c0039de3263beca1ba","disposition":"folded","index":3,"section":"§4","source":"R2-ux.md"},{"conflict_id":"5d8eda773b99e715220d521d0e159d0e572edf8d009320ee783aeda08a7a6b4c","disposition":"folded","index":4,"section":"§4","source":"R2-ux.md"},{"conflict_id":"428c3ad35c5216fd029b7130925412095e36a646b997ae790e2d1f15f7fce62f","disposition":"folded","index":5,"section":"§2","source":"R2-ux.md"},{"conflict_id":"00824a5350f1e468620d1c66da614e54f66101de78047e13d754d1c5446b1b92","disposition":"folded","index":6,"section":"§2","source":"R2-ux.md"},{"conflict_id":"dadbf06b4da5165103f2011d694bb4f241259f51e94820a7e2ad075e2c4042a3","disposition":"folded","index":7,"section":"§4","source":"R2-ux.md"},{"conflict_id":"67b8aeeb3adf2341cca0750594adbf8c2e1e30bd7d49c58f2b72c3b121f943b7","disposition":"folded","index":8,"section":"§5","source":"R2-ux.md"},{"conflict_id":"8b39d0dd2632cf1b74b147adcdf60afa374aec00dec6f45e402c84b5816a86cf","disposition":"folded","index":9,"section":"§4","source":"R2-ux.md"}]}
-->
