# R1 — ux position: massive-flat-file-keep

## Position

### 0. What the surface actually is (and what it is not)

There is **no trader screen here.** The BRIEF is a **provenance-labeled research corpus**: next-day Massive S3 flat files the $199+$199 plan already entitles (`https://files.massive.com`, bucket `flatfiles`, stocks SIP compressed CSVs), kept for the locked watchlist **SPY / QQQ / IWM**, so a cancelled live feed does not leave days we never taped (or taped incompletely) without reconstructable **price/quote history**. It does **not** reconstruct chain greeks, insert as `LiveMassive`, change live scoring, add a second live UI path, download OPRA / indices / crypto, convert files into the session-day-tape player, or retitle the ticker **Live tape** widget.

`[operator-vs-trader-path-separation]` is HARD. This corpus is research. Trader SSE is unchanged. Pages trader origin already 404s `/api/_research` and `/api/_metrics` (`functions/api/[[path]].ts`, verified). Flat-file list/load stays on that side of the fence. Keep/download is an **operator command**, not a ticker action.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` is **Status: SET** (The Curvature Terminal). This feature consumes **no** dashboard route, component, token, motion, chip, LiveTape mode, Settings control, or copy table. SPEC §4 must carry **`NO_UI_CHANGE`** and must **not** restate the token table. I request **no amendment** to `DESIGN_SYSTEM.md`. Anyone proposing a Ticker “S3 recovered Tuesday” chip, a Settings replay / flat-file toggle, an Ask-AI “we kept the gzip” line, a Scanner badge, player chrome, or a **new `/_ops` flat-files panel** is **re-scoping** — raise as an R2 `product` conflict; do not fold it in.

The existing unlinked `/_ops/metrics` page is **latency / cache / vendor-headroom chrome**. Flat-file row counts, occupancy classes, and “Tuesday’s gzip kept?” are **different data**. Collapsing them into p50/p95, “Instrumentation: ON”, a success chip, or a coverage-style **`present`** cell is this feature’s defining integrity failure on that page. If Architect rides corpus JSON on `GET /api/_metrics`, that is a **curl/ops wire vehicle**, not permission to render a second matrix in the dashboard. Unknown JSON must remain **unrendered** there.

**This is not session-archive coverage.** Coverage cells `present` | `missing` | `unreadable` | `not yet due` | `blocked occupancy` classify **expected live-paid session books** (`present-is-live-paid-only`). A kept gzip / watchlist extract is **never** `present` and is **never** inserted as `LiveMassive`. Coverage holes stay holes.

**This is not the session day tape.** Tape Path-A is same-day stocks-WS ticks this process already received; tape Path-B is timed options-structure snapshots. Tape standing already says it is **not OPRA options-quote flat files; not S3 hist-chain**. This slice **is** the S3 stocks SIP files. Do **not** reuse tape occupancy (`no session day tape…` / `no path-a ticks…` / `session day tape not storing` / `through-window`) or the ticker title **`Live tape`**. A kept file is **not** a Path-A container and is **not** playback.

**This is not ticker playback** (`day-replay-mock-adapter`). Replay walks the **day_tape store**. This slice **stores a different corpus**. Load copy says **not a playback**. No player chrome. No Settings replay.

**This is not hist-chain we newly bought.** Massive Plan History / options hist-chain remains out. Copy must not say we purchased a new product. These are **stocks SIP trades and quotes** (aggregates are a council lock — see §11) the existing plan already includes.

**This is not a live paid session book** and **not** Massive REST/WS (`api.massive.com` + `MASSIVE_API_KEY`). Files use **Access Key + Secret from the Massive dashboard** — a different credential. Copy that treats the REST apiKey as the S3 secret is a fabricated auth claim.

The user-facing surface I own is five coupled artifacts plus hard negative space:

| # | Surface | Who reads it | My ownership |
|---|---------|--------------|--------------|
| S0 | **Trader UI silence** — Landing, Ticker (including **Live tape**), Positions, Scanner, Settings, Ask-AI, shell nav; Pages trader origin | every trader | what must **never** appear: no flat-file badge, replay control, “S3 recovered”, corpus count, gzip caption, Settings replay, or Ask-AI grounding on reconstructed prints |
| S1 | **Named keep + inspect CLI** — stdout title `flat-files` | research operator / owner | standing block, occupancy literals, keep vs inspect verdicts, Evidence: local, banned terms |
| S2 | **Research list/load** — operator HTTP under `/api/_research` (Architect names the suffix) + any human-printed twin | research operator / owner | same occupancy literals as S1; provenance that is **not** `live_massive`; token gate; Pages still 404 |
| S3 | **Keep refuse / skip logs** | operator logs / Railway logs | exact refuse lines; ban on trader toasts; ban on failing bundle / scan / SSE / ensure |
| S4 | **Negative space** — `/_ops/metrics` + coverage + session-day-tape + replay + session-book + 48-ring + score-lab + Settings | anyone on those vehicles | this corpus must **never** appear as coverage `present`, session day tape, **Live tape**, Path-A ticks, hist-chain, or a latency stage |

**Explicit trader-product statement (carry into SPEC §4):** the trader UI does **not** gain chrome, routes, badges, toasts, Settings controls, Ask-AI disclosures, player chrome, or a ticker playback surface for this corpus. That is not a deferral — it is the product shape of this BRIEF. **`NO_UI_CHANGE`.**

### 1. Intended user, primary job, information structure, vocabulary

- **Intended user:** the research operator / owner who, after Massive is cancelled, still needs reconstructable **price/quote history** for locked-watchlist days the live tape missed or never stored — via a named CLI and token-gated research list/load. **Not** the anonymous or signed-in trader.
- **Primary job:** *For locked watchlist symbol S on completed ET session date D, after the vendor file is published (~11:00 ET the next day), keep the entitled stocks trades and quotes as artifacts whose provenance is not live Massive — and later inspect that corpus without being told it is a live paid session book, coverage `present`, the session day tape, ticker playback, or hist-chain we newly bought.*
- **Failure I am designing against:** one “no data” / “Tuesday saved” / “LIVE tape” / coverage-`present` / “full open-to-close session” / completeness-% string that collapses **not-elapsed ≠ miss ≠ empty extract ≠ unreadable ≠ not-storing ≠ unauthorized ≠ live tape**, or a local receipt quoted as **production coverage**, or a reconstructed gzip labeled `live` / `live_massive` / `present`.

**Information structure (S1/S2), always in this order, before any row dump:**

1. **Standing / framing block first** (what this is — before any count).
2. **Scope:** locked watchlist printed · identity · evidence class · payload kinds actually kept · vendor plane (files.massive.com, not REST/WS).
3. **Occupancy** — one closed class per identity / per day-file, never a synonym.
4. **Extract section** — per watchlist symbol, per stored kind, **row counts only when vouched**; else the empty-extract literal. Never a completeness percent.
5. **What this is / is not** (one block).
6. **License one-liner.**
7. **Closing line:** authorizes nothing; not a live paid session book; not a session day tape; not a playback; local is not hosted/production evidence (CLI).

Do **not** lead with raw CSV a skimming operator can paste into a trader, tape, or coverage context without the hedge. Do **not** print a bare percent “session completeness” score. Do **not** claim “full open-to-close session” from a gzip we **filtered** to three symbols.

**User vocabulary — closed term set. These are the only words S1–S3 may use for these things.** Reuse shipped coverage / tape / session-book strings **only on those vehicles**. Do **not** invent a second deck for those objects, and do **not** borrow their occupancy cells for this corpus.

| Concept | Approved term / exact string | **Banned** (asserts a meaning the data cannot carry) |
|---|---|---|
| This store | **Massive flat files** · **flat files** · **research corpus** · identity **`(symbol, et_date)`** America/New_York plus the **vendor file date** | “live book”, “session book”, “session day tape”, “Path-A”, “hist-chain”, “production coverage”, “ticker replay feed”, “Live tape” |
| Vendor plane | **files.massive.com** · **S3-compatible flat files** · **stocks SIP** | “Massive REST”, “live WS”, “api.massive.com”, treating `MASSIVE_API_KEY` as the files credential |
| Payload | **stocks trades** and **stocks quotes** (aggregates **only if PM locks them**, named **aggregates**, never “bars that complete the session”) | “OPRA”, “options quotes”, “greeks”, “OI tape”, “live tape”, “NBBO live” |
| Names in scope | **locked watchlist SPY, QQQ, IWM** | scanner universe, `WARM_SYMBOLS`, “all SIP symbols”, claiming the universe gzip is what we redistribute |
| How the vendor publishes | **universe-per-day compressed CSV** · **watchlist extract** | “per-ticker vendor file”; “we kept the whole SIP day” as a completeness claim |
| Success occupancy | **`kept`** · **`kept from Massive flat files`** | `present`; `live`; `live_massive`; `loaded from session day tape`; “recovered Tuesday”; “backfilled live” |
| Not yet published | **`not-elapsed`** · exact **`flat files not elapsed: vendor file for {ET_DATE} not yet published`** | `miss`; coverage `not yet due`; tape `session day tape not elapsed`; “vendor is late” before the publish clock |
| Due and absent | **`miss`** · exact **`flat files miss: vendor file for {ET_DATE} due and absent`** | `empty extract`; `not-elapsed`; coverage `missing`; tape `no session day tape…`; “empty tape” |
| File present, watchlist symbol has zero rows | **`empty extract`** · exact **`flat files empty extract: {SYMBOL} on {ET_DATE}`** | `miss`; `not-storing`; “full session with 0 prints”; “market closed” without a vouched clock |
| Identity/pointer, body bad | **`unreadable`** · exact **`flat files unreadable: {reason}`** | treating as miss; treating as empty extract; treating as not-storing |
| Store disabled / root unset or unwritable | **`not-storing`** · exact **`flat files not storing`** | N miss cells; coverage all-missing; tape `session day tape not storing` |
| Credentials | **`unauthorized`** — S3 keep: **`flat files unauthorized`**; HTTP: shipped **`metrics_unauthorized`** | printing key material; “reuse REST apiKey”; 200 empty corpus as the auth miss |
| Foreign object: session day tape / ticker Live tape | **not this corpus** · **never `Live tape`** · **never Path-A / Path-B** | labeling a gzip as session day tape; replay chrome; Settings replay |
| Coverage occupancy (other object) | **`present`** = loadable **live paid** session book only | using `present` / `missing` / `not yet due` / `blocked occupancy` as **flat-file** cells |
| How obtained on inspect | **loaded from Massive flat files · no REST/WS call** | “refreshed from Massive”; “filled”; “synced live”; “played into ticker”; “converted to Path-A” |
| Keep path vendor I/O | **files.massive.com (S3)** — distinct from REST/WS | “0 Massive calls” on a keep that just fetched a gzip (that lie is banned); “live fetch” |
| Inspect path vendor I/O | **0 Massive REST/WS calls** and **0 S3 calls** on list/load of an already-kept corpus | burning S3 to “confirm” an inspect miss; REST lookback `/v3/trades/{ticker}` as a substitute file |
| The whole activity | **research keep** / **flat-files read** | “market view”, “ticker reload”, “day replay”, “LIVE”, “playback”, “hist-chain buy” |
| Evidence class | **`local`** on CLI unless the run actually is another class | local pass labeled production / Railway / hosted / CI-verified-on-runners |
| Counts | **`{SYMBOL} {kind}: {n} rows`** against vouched extract counts | bare “complete day”; “100% open-to-close”; “78% of SIP”; mixing kinds into one unnamed completeness % |
| Score / fill / playback posture | **Authorizes: nothing** | “fetch the hole”; “fill session archive”; “score used this gzip”; “replayed on ticker”; “verified complete” |
| License | **Our research · not redistributed as a live vendor feed.** | “customer historical API”; “OPRA flat files”; trader-route export; “live vendor feed” |
| Operator HTTP auth miss | reuse shipped **`metrics_unauthorized`** / `Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token` | “flat-files unauthorized” as a second **HTTP** auth dialect (S3 unauthorized is a **different** class — see occupancy) |
| Pages trader origin | existing **404 `Not Found`** on `/api/_research` and `/api/_metrics` prefixes | proxying this corpus to the trader origin; a trader-readable “gzip kept” banner |
| S3 secrets | **never listed, loaded, logged, or printed** | last-4 of the secret; env dump; “signed with REST apiKey” |

**Hard ban — silent rename of occupancy.** not-elapsed ≠ miss ≠ empty extract ≠ unreadable ≠ not-storing ≠ unauthorized ≠ live tape. That collapse is `[absent-is-not-none]`. **live tape** is a **foreign** class (session-day-tape / ticker LiveTape vehicles); it must not appear as a flat-file cell.

**Hard ban — `present` and `missing` and `not yet due` and `blocked occupancy` on this vehicle.** Those words mean session-archive coverage occupancy (`present-is-live-paid-only`). Flat-file hits say **`kept from Massive flat files`**. Flat-file absences use **this** deck. A kept gzip is **never** a coverage `present` live paid book.

**Hard ban — `live` / `LIVE` / `live_massive` as a market-feed or occupancy claim on this corpus.** Closed lineage `live_massive` remains **session-book provenance only**. Reconstructed / flat-file occupants are never `present` `LiveMassive` session books. The ticker widget title **`Live tape`** is **not** this corpus’s name.

**Hard ban — playback / player chrome / Settings replay.** Load is inspect. Strings `replay`, `playback`, `play into ticker`, `mock adapter`, `LIVE tape`, Settings “replay”, a scrubber, or `/_ops/replay` controls for **this gzip** are **forbidden** on this slice’s output. Replay already walks **day_tape**, not gzip CSV.

**Hard ban — hist-chain / OPRA / newly bought product.** Culled or other-program names. This is entitled stocks SIP files we already pay for and do not keep today.

**Hard ban — percent-as-health and open-to-close from a filter.** `{n} rows` is a count of the **watchlist extract**. `78% of the session captured` or **“full open-to-close session”** as a headline from a universe gzip we filtered to SPY/QQQ/IWM is a renamed count with a completeness connotation the data does not carry.

**Hard ban — Path-A conversion this gate.** BRIEF: this slice does **not** convert files into the session-day-tape player. Copy must not say the gzip **is** Path-A, was **appended** to the day tape, or **will play** on `/ticker/:symbol`.

**Hard ban — REST apiKey as S3 secret.** Files credentials are Access Key + Secret. `MASSIVE_API_KEY` is the REST/WS key. Copy, logs, and CLI must not claim they are the same, and must not print either.

### 2. Binding framing (must ship on every human print, including empty / error)

`(a)` **Standing block is first** on CLI stdout and on any human-printed HTTP twin, before any count:

```
MASSIVE FLAT FILES — RESEARCH CORPUS · NOT A LIVE PAID SESSION BOOK · NOT A SESSION DAY TAPE · NOT A PLAYBACK
  Command:     flat-files
  Evidence:    local
  Watchlist:   SPY, QQQ, IWM
  Identity:    (symbol, et_date) America/New_York · vendor file is universe-per-day
  Payload:     stocks SIP trades · quotes · compressed CSV · not OPRA · not hist-chain
  Extract:     watchlist rows only · not a full-universe keep · not a full open-to-close claim
  Provenance:  reconstructed flat file · never live_massive · never coverage present · never session day tape
  Publish:     ~11:00 ET the next America/New_York day · before that a day is not-elapsed, not a miss
  Vendor I/O:  inspect = 0 REST/WS and 0 S3 · keep = files.massive.com (S3), not api.massive.com
  Authorizes:  nothing. No live score/tier/gate/fingerprint change, no trader UI,
               no ticker playback, no session-archive fill, no Path-A conversion this gate.
```

**Evidence: local** is on the CLI even when the operator wishes it were production. `{Publish}` is the BRIEF-stated vendor publish clock, not a certified SLA to the millisecond — print **`~11:00 ET`**, not `11:00:00.000`. If Architect/PM lock a different due instant, standing prints **that** lock; a missing lock is a **blocked run**, not a pretty empty success.

If the vehicle is HTTP against a production process, the standing block may say **Evidence: this process** (not “hosted verified”, not “CI”). Still **not a playback**. Still **Authorizes: nothing**. Do not print `Evidence: local` on a Railway-origin GET, and do not print `Evidence: production` on a laptop CLI.

**Payload line:** print **trades** and **quotes** as BRIEF-entitled. **Aggregates stay off the standing payload line unless PM locks them.** If locked, append `· aggregates` as a third named kind — never “session bars” / “OHLC that proves open-to-close”.

HTTP envelope framing (concept names only — **no invented payload keys**):

| Situation | Framing line (exact) |
|---|---|
| Inspect hit (`kept`, with or without empty-extract siblings) | `RESEARCH READ — MASSIVE FLAT FILES` |
| No kept file for that date, store is storing, day is due | `RESEARCH READ — NO MASSIVE FLAT FILES` |
| Not-elapsed | `RESEARCH READ — MASSIVE FLAT FILES NOT ELAPSED` |
| Weekend / not in watchlist — still this family | never `RESEARCH READ — SESSION DAY TAPE` / `… SESSION BOOK` / `… SESSION ARCHIVE COVERAGE` / `RESEARCH REPLAY — NOT LIVE` |

**Do not** send session-book, coverage, tape, replay, or batch-backtest framing when the object is this corpus.

`(b)` **Vendor I/O line is not decorative.**

- **Inspect / list / load:** print `0 REST/WS` and `0 S3` only when the **read** can vouch it. If it cannot, the verdict is **ERROR / BLOCKED**, never a dump that looks complete. Do **not** call S3 to confirm an inspect miss.
- **Keep / download:** print that the call is **files.massive.com (S3)**, never “0 Massive calls” and never “live REST”. Capture-time REST/WS (the live feed) is **not** this keep.

`(c)` Repeat one closing line at the bottom of stdout:

`MASSIVE FLAT FILES — NOT A LIVE PAID SESSION BOOK · NOT A SESSION DAY TAPE · NOT A PLAYBACK · Authorizes: nothing · local audit is not production coverage`

HTTP closing (this-process): `MASSIVE FLAT FILES — NOT A LIVE PAID SESSION BOOK · NOT A SESSION DAY TAPE · NOT A PLAYBACK · Authorizes: nothing`

`(d)` Human print, any JSON twin, extract counts, and occupancy literals **must agree**. A success-sounding line over an unreadable body (or the reverse) is a copy bug. CLI exit code must agree with the verdict line.

`(e)` **Is / is not block** on every successful, empty-extract, or empty-but-storing inspect, and on a successful keep:

- **Is:** research corpus of entitled stocks SIP trades and quotes downloaded from files.massive.com as next-day compressed CSVs and extracted to locked watchlist SPY / QQQ / IWM.
- **Is not:** a live paid session book; not coverage `present`; not `live_massive`; not the session day tape; not Path-A / Path-B; not ticker playback; not OPRA; not S3 hist-chain we newly bought; not a scoring input; not a full-universe redistribution; not a full open-to-close session claim from a filtered gzip.

### 3. Where each datum surfaces

| Datum | Surfaces on | Does **not** surface on |
|---|---|---|
| Occupancy class (`kept` / `not-elapsed` / `miss` / `empty extract` / `unreadable`) | S1; S2 same literals | Ticker LiveTape; SSE; coverage matrix; session-day-tape CLI; `/_ops/metrics` stages |
| Extract row counts per `{SYMBOL}` × `{kind}` | S1/S2 extract section when vouched | a completeness %; trader tiles; Path-A tick counts |
| `flat files not storing` / `flat files unauthorized` / `flat files unreadable:` | S1/S2 error | nine coverage `missing` cells; trader offline chip; tape not-storing string |
| `not in flat-files watchlist:` | S1/S2 | coverage `missing`; empty extract (implies we extracted) |
| Keep refuse / S3 unauthorized | S3 operator log + CLI `[ERROR]` | trader toast; SSE; bundle error chrome |
| `authorizes: nothing` / license | standing + hit/empty envelope | implying kept rows are a trader feed |
| Pages 404 | trader origin on `_research` / `_metrics` prefixes | Railway-direct operator GET (token-gated) |
| Live NBBO / last-trade on Ticker | **unchanged existing LiveTape / SSE** | must **not** dim, blank, or grow a “flat files” caption because keep succeeded or failed (`[live-vs-static-isolation]`) |
| Session-archive coverage cells | existing coverage vehicle only | flat-files list/load |
| Session day tape occupancy | existing `session-day-tape` vehicle only | this CLI/HTTP |
| S3 access key / secret / REST apiKey | **nowhere on S1–S3** | list, load, CLI stdout/stderr, HTTP body, trader UI |

I do **not** name new JSON fields or routes. Architect/synthesizer own keys and paths. I own the **literals and labels** the operator reads, and the fields the surface **consumes** as concepts: `symbol`, `et_date`, occupancy class, kind (`trades` / `quotes`, `aggregates` only if locked), vouched extract row counts, provenance token ≠ `live_massive`, `vendor_called` plane (inspect vs keep), store class (storing / not-storing), S3-auth class, watchlist membership, publish-due clock.

### 4. States (complete matrix)

Trader path (S0) has **one** required state: **unchanged**. Browser default / loading / empty / error / offline / stale on Landing / Ticker / Positions / Scanner / Settings / Ask-AI / shell are **N/A** (`NO_UI_CHANGE`). Keep success, keep refuse, list, load, not-storing, unauthorized, and unreadable are **all invisible** there. Live ticks must **not** dim or blank because a gzip was kept (`[live-vs-static-isolation]`). **Live tape** title stays the genuine-stream widget’s title on S0; this corpus does not occupy it.

`/_ops/metrics` (S4) stays on its **existing** closed states (`Loading metrics…` / `Metrics readout unavailable.` / rolling latency tables). Flat files do **not** add a state to that page.

Session-archive coverage, session-day-tape list/load, session-book list/load, replay occupancy, and 48-ring list/load keep **their** shipped framing. This corpus does not overwrite them.

S1/S2 operator-visible states. Occupancy classes must stay **visibly distinct** (`[absent-is-not-none]`). Progress copy is not a verdict. **Stale in the trader-SSE sense is N/A** — a dated D gzip is **dated**, not stale-live. **Offline in the trader-SSE sense is N/A** — operator curl failure is a **client** error, not a corpus class.

**Occupancy classes (closed; this vehicle only):**

| Class | When | Operator sees | Must **not** happen |
|---|---|---|---|
| **`kept` (default success)** | Vendor file for D is stored; watchlist symbol has ≥1 extracted row of a stored kind; body readable | Standing → `RESEARCH READ — MASSIVE FLAT FILES` / CLI `[OK]` → `{SYMBOL} {kind}: {n} rows` → is/is-not → license → close | `present`; `live`; `live_massive`; `Live tape`; session-day-tape framing; “full open-to-close session”; a completeness % |
| **`not-elapsed`** | Session D’s vendor file is not yet due (~11:00 ET **next** America/New_York day) | **`flat files not elapsed: vendor file for {ET_DATE} not yet published`** · CLI **`[OK]`** · **exit 0** · “Not a miss.” | `miss`; three per-symbol misses before the file can exist; coverage `not yet due`; tape `session day tape not elapsed`; keep that claims success |
| **`miss`** | File is **due** and **absent** (no stored object; vendor 404 after due on keep) | **`flat files miss: vendor file for {ET_DATE} due and absent`** · keep CLI **non-zero** `[ERROR]` | `empty extract`; `not-elapsed`; coverage `missing`; `no session day tape…`; fabricating three independent ticker misses when one universe file is absent |
| **`empty extract`** | File/object is present and readable; this watchlist symbol has **zero** rows | **`flat files empty extract: {SYMBOL} on {ET_DATE}`** · inspect **exit 0** · keep of the file may still be `[OK]` at **file** level with this **symbol** literal | `miss`; `not-storing`; “complete session, 0 prints”; hiding the file’s existence; calling it a live-tape gap |
| **`unreadable`** | Pointer/object exists; body cannot be read or parsed | **`flat files unreadable: {reason}`** · CLI **non-zero** `[ERROR]` | Treating as miss; treating as empty extract; treating as not-storing; dumping partial CSV as `kept` |
| **`not-storing`** | Dedicated root unset / unwritable / disabled (inspect or keep) | **`flat files not storing`** · no fabricated row cells · CLI **non-zero** `[ERROR]` | N miss rows; tape’s `session day tape not storing`; silent Massive REST recovery |
| **`unauthorized`** | **Keep:** S3 access/secret missing or not usable when keep is armed. **HTTP inspect:** operator token missing/wrong when configured | Keep: **`flat files unauthorized`** · **never** print secrets · **never** say the REST apiKey is the S3 secret · CLI **non-zero**. HTTP: shipped **401** `metrics_unauthorized` | 200 empty corpus; trader-session cookie as the gate; collapsing into miss; logging the secret |
| **`live tape` (foreign — not a cell)** | Any attempt to show this corpus as session day tape, Path-A, ticker **Live tape**, or replay occupancy | Do **not** print tape-hit framing. Prefer error/blocked: this is **not** the session day tape and **not** Live tape. | “LIVE tape”; Path-A conversion; Settings replay; player chrome; `session_tape` provenance on a gzip |

**Supporting gates (not occupancy cells, still distinct):**

| State | When | Operator sees | Must **not** happen |
|---|---|---|---|
| **loading (CLI)** | Keep or inspect in flight | `[RUNNING] flat-files — no verdict yet` | “fetching live from Massive…”; “loading session day tape”; a partial file titled as a finished receipt |
| **loading (HTTP)** | **N/A** | No loading field | OperatorMetrics spinner reused as flat-files |
| **empty — not in watchlist** | Requested symbol is outside SPY / QQQ / IWM | **`not in flat-files watchlist: {SYMBOL}`** · no fabricated row counts | `empty extract` (implies extract ran); adding NVDA in copy as if kept |
| **empty — ineligible weekend** | Date is not an ET weekday | **`flat files ineligible weekend: {ET_DATE}`** · **exit 0** · not a miss | Saturday as `miss`; `[PASS]` completeness; coverage weekend-as-missing |
| **error — download failed (keep)** | Armed keep, due, credentials present, vendor/network error that does **not** confirm absence (not 404, not 403) | **`flat files download failed: vendor file for {ET_DATE} not confirmed`** · **non-zero** · **not** a miss | Collapsing unknown fetch failure into `miss`; retry via REST `/v3/trades` |
| **error — vendor plane on inspect** | Inspect would call REST/WS or S3, or cannot vouch 0 | `[ERROR] flat-files — inspect must not call REST/WS or S3. No load recorded.` | A dump anyway; lookback trades API as a substitute file |
| **error — lock missing** | Watchlist or publish clock not locked and the print would have to invent them | `[ERROR] flat-files — watchlist or publish clock not locked. No load recorded.` | Printing scanner universe / “sometime next morning” as if locked |
| **blocked — reconstructed as present / live_massive** | A kept gzip would be classified coverage `present` or inserted as `LiveMassive` | Do **not** print `present` / `live_massive`. This vehicle says **`kept`**. Coverage must still see a hole or blocked occupancy on **its** vehicle — not our cell. | “recovered Tuesday”; filling the session-archive hole in copy |
| **blocked — Path-A conversion / playback** | Copy or chrome would treat the gzip as day_tape / ticker replay | Refuse that framing. Inspect remains **not a playback**. | Player chrome; Settings replay; `Live tape` title on this corpus |
| **keep skipped / refuse (S3)** | Armed keep cannot proceed (keys, root, production-fails-closed) | Exact refuse line (§5). Desk / bundle / scan / SSE / ensure intact | Trader toast; dimmed LiveTape; failing SSE; 5xx on trader routes |
| **production unset (serve)** | Production serve without this construct | **Does not fetch files.** Existing Massive REST/WS talk is unchanged. No trader caption. | Silent S3 fetch from `serve`; “live files sync” |
| **stale (trader SSE sense)** | N/A | Dated `et_date` remains **research** | `⏸ offline` / “Live offline” / `unavailable this cycle` on the corpus read |
| **offline (trader SSE sense)** | N/A | Operator curl failure is a **client** error | Inventing an offline cell |
| **HTTP success with empty extract / miss inspect** | Operator GET on a storing process | **200 + honest occupancy literal** (corpus absence must not fail the desk) | HTTP 5xx because Tuesday’s extract had 0 SPY rows; empty 200 that looks like a live book |
| **trader product (negative)** | Always | Unchanged Ticker/SSE/Settings/Ask-AI/`/_ops/metrics` copy; **Live tape** still means the genuine stream | New route, nav, chip, toast, playback, Settings replay, or Pages-proxied corpus |

**Closed occupancy / absence literals (exact; never synonyms):**

| Literal | Means |
|---|---|
| `kept from Massive flat files` | Stored reconstructed extract for that identity; **not** coverage `present`; **not** live Massive |
| `flat files not elapsed: vendor file for {ET_DATE} not yet published` | Publish clock (~11:00 ET next day) has not passed; **not** a miss |
| `flat files miss: vendor file for {ET_DATE} due and absent` | Due, and the vendor/universe file is not stored; **not** empty extract |
| `flat files empty extract: {SYMBOL} on {ET_DATE}` | File present; this watchlist symbol has zero rows |
| `flat files unreadable: {reason}` | Object/pointer exists; body not readable |
| `flat files not storing` | Dedicated store disabled / unavailable — **not** a per-symbol empty |
| `flat files unauthorized` | S3 credentials missing or not usable on **armed keep** — **not** HTTP auth |
| `flat files download failed: vendor file for {ET_DATE} not confirmed` | Keep attempted; absence not confirmed |
| `flat files ineligible weekend: {ET_DATE}` | Not an ET weekday; **not** a miss |
| `not in flat-files watchlist: {SYMBOL}` | Symbol is outside SPY / QQQ / IWM |

Banned competing empties on this vehicle: `present`, `missing`, `not yet due`, `blocked occupancy`, `n/a`, blank, trader `—`, `unavailable this cycle`, `/_ops` `unknown`, `no session day tape…`, `no path-a ticks…`, `session day tape not storing`, `no session book…`, `ok`, `fail`, `live`, `LIVE`, `live_massive`, `Live tape`.

Shipped session-book / ring / coverage / tape / replay strings remain on **those** vehicles only.

**Universe-file vs symbol-row rule (honesty):** the vendor object is **universe-per-day**. A **miss** / **not-elapsed** / **unreadable** / **download failed** of that object is **one day-file fact**, then inherited by SPY / QQQ / IWM — do **not** print three independent “ticker file 404” stories. **`empty extract`** and **`kept` row counts** are **per symbol** after a file is present.

### 5. Exact warning / skip / verdict wording

Placeholders in braces are filled from **this run’s** vouched identities. Do not hard-code counts. Do not assert dollar loss (`$199+$199`) — that is briefing/BRIEF motive, not a runtime-vouched field. Do not print S3 keys, REST apiKeys, filesystem roots, or bucket ARNs in the **closed** line.

**S3 — keep refuse (operator log + CLI; never trader toast):**

| Class | Exact operator-facing line |
|---|---|
| Root unset / unwritable | `flat files not storing` |
| S3 keys missing/unusable when armed | `flat files unauthorized · REST apiKey is not the S3 secret` |
| Production unset does not fetch | `flat files not fetching — production unset` (serve log only; **not** a CLI `[OK]` keep) |
| Keep skipped, desk intact | `flat files keep skipped — trader path unchanged` |

Rules:

- Do **not** fail bundle / scan / SSE / ensure because keep skipped (`[best-effort-isolated-or-null]`). Download fault **never 5xx the desk**.
- Do **not** put secrets, filesystem paths, or bucket names in the **closed** line. A backend `error=` field may exist for diagnosis; it is **not** a second product class.
- Do **not** fire a keep-skipped line when the symbol is not in the locked watchlist (that is out of scope, not a failed keep).
- Color may supplement; **plain text carries the whole meaning**.

**S1 — CLI lines (stdout title remains `flat-files` even if clap is renamed):**

| Verdict | Exit | Exact operator-facing line |
|---|---|---|
| Running | pending | `[RUNNING] flat-files — no verdict yet` |
| Keep/inspect ok (`kept`) | 0 | `[OK] flat-files — kept from Massive flat files · not a live paid session book · not a session day tape · local audit is not production coverage` |
| Not-elapsed | 0 | `[OK] flat-files — flat files not elapsed: vendor file for {ET_DATE} not yet published. Not a miss.` |
| Empty extract (inspect) | 0 | `[OK] flat-files — flat files empty extract: {SYMBOL} on {ET_DATE}. Not a miss.` |
| Weekend | 0 | `[OK] flat-files — flat files ineligible weekend: {ET_DATE}. Not a miss.` |
| Not in watchlist | 0 | `[OK] flat-files — not in flat-files watchlist: {SYMBOL}` |
| Miss (due, absent) | non-zero | `[ERROR] flat-files — flat files miss: vendor file for {ET_DATE} due and absent.` |
| Not storing | non-zero | `[ERROR] flat-files — flat files not storing. No load recorded.` |
| Unreadable | non-zero | `[ERROR] flat-files — flat files unreadable. No load recorded.` |
| S3 unauthorized (keep) | non-zero | `[ERROR] flat-files — flat files unauthorized. REST apiKey is not the S3 secret. No keep recorded.` |
| Download failed | non-zero | `[ERROR] flat-files — flat files download failed: vendor file for {ET_DATE} not confirmed. No keep recorded.` |
| Inspect vendor I/O | non-zero | `[ERROR] flat-files — inspect must not call REST/WS or S3. No load recorded.` |
| Missing lock | non-zero | `[ERROR] flat-files — watchlist or publish clock not locked. No load recorded.` |

Do **not** use `[PASS] n/n present`, “SLO miss”, “production down”, “verified”, “certified”, “healthy”, “Live”, “hist-chain”, “full open-to-close”, or a completeness percent in any generated line. Empty extract is **not** a coverage `[FAIL]`. Not-elapsed is **not** a miss.

**S2 HTTP:** no process exit. Empty extract / not-elapsed / miss-on-inspect are still a successful **read** (200 + honest literal). Do not translate those into trader 5xx. Unauthorized HTTP remains shipped `metrics_unauthorized`.

**Provenance line on inspect hit:** `loaded from Massive flat files · no REST/WS call`

**License (every human print):** `Our research · not redistributed as a live vendor feed.`

### 6. List / load / keep layout (operator-visible)

**List** — one row per stored vendor **date** (universe file), then per watchlist symbol. Two (or three, iff aggregates locked) count columns, never one unnamed total, never a percent:

```
  ET date      Symbol  trades rows  quotes rows
  {YYYY-MM-DD}  SPY     {n}          {n}
  {YYYY-MM-DD}  QQQ     {n}          {n}
  {YYYY-MM-DD}  IWM     {n}          {n}
```

A zero on a **present file** is **`empty extract`**, not the word `miss`. If a kind is **not stored** (aggregates unlocked), **omit the column** — do not print `0 aggregates` as if we kept them.

Watchlist order **SPY, QQQ, IWM** (BRIEF lock).

**Load** — standing block, then occupancy class, then per-kind extract counts or the empty-extract literal. Do not omit an empty symbol; omission is a silent “complete watchlist day” claim.

Human summary may name fields the CSV already carries (exchange timestamp, price, size, bid, ask as present on the row). It must **not** relabel last-trade as the structure anchor, or quotes as trades, or extracted rows as Path-A ticks.

**Keep** — standing block first even on refuse. Success names **`kept from Massive flat files`**. It does **not** name Path-A, playback, or coverage `present`.

**CLI and HTTP print the same occupancy literals** for the same identity. Standing evidence class may differ (`local` vs `this process`).

### 7. Glossary / tooltip text (operator only)

No trader glossary. No new `/_ops` tooltips. If a human print layer annotates headers, these are the **only** explanations — they explain; they do not invent metrics:

| Term | Glossary sentence |
|---|---|
| Massive flat files | Next-day stocks SIP compressed CSVs from files.massive.com, kept as our research corpus for SPY / QQQ / IWM. Not a live paid session book. Not the session day tape. Not ticker playback. |
| kept | That extract is stored and readable. Not coverage `present`. Not live Massive. |
| not-elapsed | The vendor file for that ET date is not yet published (~11:00 ET the next day). Not a miss. |
| miss | The vendor file is due and absent. Distinct from empty extract, not-elapsed, and not-storing. |
| empty extract | The file is present; this watchlist symbol has zero rows. Distinct from miss. |
| unreadable | An object exists but could not be read. Distinct from miss and empty extract. |
| not-storing | The dedicated flat-files store is disabled or unavailable. Not a list of empty symbols. |
| unauthorized | On keep: S3 Access Key + Secret missing or not usable. The REST apiKey is not that secret. On HTTP inspect: shipped metrics token miss. |
| live tape | **Not a flat-files word.** Session day tape / ticker Live tape vehicles only. This corpus must not print it. |
| present | **Not a flat-files word.** On coverage, a loadable live paid session book. Flat files must not print it. |
| live_massive | **Not a flat-files provenance token.** Session-book paid-live source only. |
| local | This CLI classified **this process’s** corpus. It is not production/hosted coverage. |
| watchlist extract | Rows for SPY / QQQ / IWM taken from a universe-per-day file. Not a claim that we kept the whole SIP session. |

### 8. Design-system / interaction (why NO_UI_CHANGE still binds)

Canon Status **SET**. No new tokens, components, patterns, arc spends, or motion. No hardcoded hex. Green/red remain **direction**, not “gzip health”. Warnings in any future UI would need `warning.*` + icon — **not requested**; S3 is a log line.

Keyboard/focus/a11y: N/A for trader UI. CLI meaning must survive **plain text / CI logs** (no ANSI-only). HTTP is curl/ops JSON + optional human print; not a dashboard table widget, not LiveTape, not a research-lab canvas (`research-lab-surface` was culled this gate).

`[single-motion-moment]` / `[theme-token-discipline]`: empty dashboard diff is the enforcement. Do not “just add” a muted caption on Ticker. Do not retitle **Live tape**. Do not add Settings replay.

### 9. Acceptance criteria (UX-owned states + Verify by)

Actors: research operator / owner; trader (silence). Every user-visible or user-silence row maps to S0–S4. **(SB)** = ship-blocking for this feature’s honesty surface. PM may renumber into SPEC §3; marks travel with the rows. I do not invent payload keys or routes in these rows.

| # | Story | Acceptance criterion | State(s) | Verify by |
|---|---|---|---|---|
| AC-U1 **(SB)** | US-T: As the desk owner, I want zero trader chrome for this corpus. | `apps/dashboard` trader surfaces gain **no** new route, nav item, Settings copy (including replay), Ask-AI line, Ticker/LiveTape/Scanner/Positions/Landing affordance, tooltip, or toast mentioning flat files, S3 gzip, “recovered Tuesday”, hist-chain, or playback of this corpus. | S0 unchanged | test |
| AC-U2 **(SB)** | US-T | Trader empty / error / offline / `unavailable this cycle` / `—` / **Live tape** copy is **byte-unchanged** by keep success, keep refuse, list, load, not-storing, unauthorized, miss, empty extract, or unreadable. Live ticks do not dim or blank because a gzip was kept or skipped. | S0 unchanged + live isolation | test |
| AC-U3 **(SB)** | US-T / Pages | Pages trader origin still **404s** `/api/_research` and `/api/_metrics` (and subpaths), including any flat-files sibling under those prefixes. This corpus is not proxied to the trader origin. | S0 + S4 negative | test |
| AC-U4 **(SB)** | US-T / `/_ops` | `/_ops/metrics` gains **no** flat-files matrix, gzip chip, or stage named from this feature. If corpus JSON rides `_metrics`, the existing page does **not** render it as p50/p95/headroom/`—`. | S4 unchanged | test |
| AC-U5 **(SB)** | US-T / replay | No player chrome, no Settings replay, and no **`Live tape`** title/subtitle/tooltip applied to this corpus. Replay continues to walk session day tape, not gzip CSV. | S0 + blocked playback | test |
| AC-U6 **(SB)** | US-O / honesty | `not-elapsed` ≠ `miss` ≠ `empty extract` ≠ `unreadable` ≠ `not-storing` ≠ `unauthorized` ≠ live-tape-foreign end-to-end. No single “no data” collapse. | all S1/S2 degraded | test |
| AC-U7 **(SB)** | US-O / honesty | Operator copy never labels this corpus a session book, session day tape, Path-A/Path-B, coverage `present`, hist-chain, or OPRA. | default + S4 negative | test |
| AC-U8 **(SB)** | US-O / honesty | Flat-files list/load/keep **never** prints coverage cells `present` \| `missing` \| `not yet due` \| `blocked occupancy` as this corpus’s occupancy. Success occupancy is **`kept`**, never `present`. | default / empty | test |
| AC-U9 **(SB)** | US-O / `present-is-live-paid-only` | A flat-file occupant is **never** labeled `live` / `LIVE` / `live_massive` and is **never** inserted or described as a `present` LiveMassive session book. | blocked reconstructed | test |
| AC-U10 **(SB)** | US-O | Coverage holes stay holes: keeping or listing a flat-file identity does **not** change session-archive coverage classification for that `(symbol, et_date)` to `present`. | S4 vs coverage | test |
| AC-U11 **(SB)** | US-O | Successful inspect framing includes **Massive flat files** and **loaded from Massive flat files · no REST/WS call**, and includes **no** `live` badge, **Live tape** label, or playback label. | `kept` | test |
| AC-U12 **(SB)** | US-O | Inspect / list / load makes **zero** Massive REST/WS calls and **zero** S3 calls (including on empty extract / miss / not-storing / not-in-watchlist / not-elapsed). A vouched call is `[ERROR]`, not a filled dump. | default / error inspect vendor | test |
| AC-U13 **(SB)** | US-O | Store disabled yields `flat files not storing`, **no** all-miss matrix pretending to be a classified day, CLI **non-zero** `[ERROR]`. | `not-storing` | test |
| AC-U14 **(SB)** | US-O | Unreadable identity yields `flat files unreadable: <reason>` and is not the miss or empty-extract literal. | `unreadable` | test |
| AC-U15 **(SB)** | US-O | Symbol outside SPY / QQQ / IWM yields `not in flat-files watchlist: {SYMBOL}` and no fabricated row counts. | not in watchlist | test |
| AC-U16 **(SB)** | US-O / clock | Before ~11:00 ET the next day (or the locked publish clock), D is **`not-elapsed`**, **not** a miss, CLI **exit 0**, copy includes **Not a miss.** | `not-elapsed` | test |
| AC-U17 **(SB)** | US-O | After the publish clock, a due absent vendor file is **`miss`**, not empty extract, not not-elapsed. Keep CLI **non-zero**. | `miss` | test |
| AC-U18 **(SB)** | US-O | File present with zero rows for a watchlist symbol is **`empty extract`**, not miss, not not-storing. Inspect **exit 0**. | `empty extract` | test |
| AC-U19 **(SB)** | US-O | Armed keep with missing/unusable S3 keys yields **`flat files unauthorized`** and the clause **REST apiKey is not the S3 secret**. No secret material in stdout/stderr/HTTP. CLI **non-zero**. Production unset **does not fetch**. | `unauthorized` + production unset | test |
| AC-U20 **(SB)** | US-O | Keep skip / download fault logs `flat files keep skipped — trader path unchanged` (or the closed unauthorized/not-storing refuse) and does **not** 5xx bundle / scan / SSE / ensure. | keep skipped + S0 | test |
| AC-U21 **(SB)** | US-O | Keep / inspect / skip **never** changes score / tier / gate / fingerprint (`Authorizes: nothing`). | S0 + isolation | test |
| AC-U22 **(SB)** | US-O | Operator HTTP (if any) is token-gated like `_metrics` / `_research` (not trader session cookie). Bad token → shipped `metrics_unauthorized` copy, not a fake empty corpus. | HTTP unauthorized | test |
| AC-U23 **(SB)** | US-O / kinds | When the store vouches trades and quotes row counts, they print as **two** numbers with those words; a quote is never labeled a trade. Aggregates appear **only** if locked; an unlocked kind is **omitted**, not printed as `0`. | `kept` extract | test |
| AC-U24 **(SB)** | US-O | CLI standing block includes **Command: flat-files**, **Evidence: local**, watchlist **SPY, QQQ, IWM**, provenance **never live_massive · never coverage present · never session day tape**, and closing **local audit is not production coverage**. | S1 standing | test |
| AC-U25 **(SB)** | US-O | Counts print as per-symbol per-kind **row counts**, not a bare completeness percent, and copy never claims **full open-to-close session** from a filtered gzip. | `kept` / empty extract | test |
| AC-U26 **(SB)** | US-O | A miss of the universe file is **one day-file fact** inherited by the watchlist — not three independent per-ticker vendor-file misses. | `miss` / `not-elapsed` | test |
| AC-U27 **(SB)** | US-isolation | Existing session-book / ring / coverage / session-day-tape / replay closed strings remain on **those** vehicles and are not overwritten by flat-files framing. | S2 vs other research | test |
| AC-U28 **(SB)** | US-T / client | Trader-consumed `@convexa/api` / dashboard code does **not** grow a flat-files list/load/keep operation used by Landing/Ticker/Positions/Scanner/Settings/Ask-AI. OpenAPI churn, if any, stays unconsumed on the trader path. | S0 | test |
| AC-U29 | US-scope | SPEC §4 carries **`NO_UI_CHANGE`**; no `DESIGN_SYSTEM.md` amendment; no new tokens/components/patterns/motion. | S0 / canon | review |
| AC-U30 | US-scope | Standing-block wording, is/is-not block, glossary sentences, and banned-term table in §1 are the approved copy (intentional). | default | review |
| AC-U31 | US-O | Operator can keep/list/load this corpus **without** the trader UI (CLI and/or Railway-direct operator GET). | S1 / S2 | review |
| AC-U32 | US-O | Skip / empty / miss copy do not assert dollar loss, Massive recoverability, open-to-close completeness, or that we newly bought hist-chain — those are not vouched fields on this surface. | S3 / empty | review |
| AC-U33 | US-O | License one-liner present on research read: research use, not redistribution as a live vendor feed. | default | review |
| AC-U34 | US-O | Loading copy (CLI) names a **flat-files** keep or read, never “fetching/refreshing from live Massive”, “loading session day tape”, or “loading session book”. | loading | review |

**Method notes (risk-based):**

- **`test`** — silent regressions: trader chrome absence (structural scan / empty-diff on `apps/dashboard`), Pages 404, `/_ops/metrics` closed stage set, seven occupancy distinctions plus foreign live-tape, no `present`/`live`/`live_massive` on this corpus, coverage holes unchanged, inspect zero REST/WS/S3, keep unauthorized ≠ miss, secrets absent from output, score byte-identity, live ticks not dimmed, no Live tape / Settings replay / player chrome, token gate, kind split, universe-file miss not tripled, other research framing not overwritten, no trader client consumption, no completeness % / open-to-close claim in generated lines.
- **`review`** — intentional copy (standing-block prose, glossary, is/is-not), SPEC §4 `NO_UI_CHANGE`, skip/empty not claiming `$199+$199`, operator path exists without trader UI, license presence, loading phrasing.
- No DOM harness required for ship; trader silence is structural. CLI/HTTP literals asserted by unit / GATE Q. Do not invent parallel copy fixtures or a VERIFY_MATRIX.md.
- Hollow “renders without throw” does **not** satisfy the `test` marks on occupancy classes, LiveMassive ban, or trader negative space.
- Poison cases that must go red: `insert_if_absent` as LiveMassive; reuse tape occupancy strings on this vehicle; REST apiKey described as the S3 secret; stdout containing `present` / `live_massive` / `Live tape` / a completeness `%` / “full open-to-close session” for this corpus.

### 10. Microcopy integrity (defining failure mode)

| Claim | Vouched by | Disposition |
|---|---|---|
| `{SYMBOL} {kind}: {n} rows` | Extracted row count for that watchlist symbol and stored kind | Allowed when vouched; kind omitted when not stored |
| `kept from Massive flat files` | Stored readable extract; provenance ≠ `live_massive` | Allowed — **not** a rename of coverage `present` |
| `loaded from Massive flat files · no REST/WS call` | Inspect path vendor counters | Allowed only if vouched |
| `flat files not elapsed: vendor file for D not yet published` | Publish clock not passed | Allowed — **not** a miss |
| `flat files miss: vendor file for D due and absent` | Due; object absent | Allowed — **not** empty extract |
| `flat files empty extract: S on D` | File present; symbol row count 0 | Allowed — **not** a miss |
| `flat files not storing` | Dedicated store disabled/unavailable | Allowed — dump withheld |
| `flat files unauthorized` | Armed keep; S3 creds missing/unusable | Allowed — **not** HTTP `metrics_unauthorized` |
| `Evidence: local` | This CLI process | Allowed on CLI; **banned** as a production label |
| Watchlist printed SPY, QQQ, IWM | BRIEF lock | Allowed |
| This corpus as coverage `present` / `live_massive` / `live` | Would falsify `present-is-live-paid-only` | **Banned** |
| “Live tape” / ticker playback / Settings replay | No playback of this gzip in this BRIEF | **Banned** |
| “hist-chain” / “OPRA” / “newly bought” | Other / culled product | **Banned** |
| “full open-to-close session” / completeness % | Filter of a universe gzip; no completeness field | **Banned** |
| `$199+$199` on skip/empty | BRIEF motive, not a runtime field | **Banned** on S1–S3 |
| This corpus as live score input | Score path must stay byte-identical | **Banned** |
| Gzip labeled Path-A / session day tape | Different object; conversion out this gate | **Banned** |
| Quote labeled trade | Row kind | **Banned** |
| REST apiKey as S3 secret; secrets in list/load/CLI | `[no-secrets-in-image]` + BRIEF credential split | **Banned** |
| Inspect “0 Massive calls” on a keep that fetched S3 | Wrong vendor plane | **Banned** |

### 11. Out of UX scope (hand to other lanes)

- Stocks SIP trades/quotes vs also **aggregates** vs OPRA (PM council lock). I own that standing copy prints trades and quotes; aggregates appear **only** if locked, named **aggregates**; OPRA never.
- Dedicated body root vs tape root (Architect). I own that copy **never** calls this store the session day tape, and that tape-root collision is a **not-storing / blocked** operator error, not a silent alias.
- Raw gzip corpus vs convert into Path-A (PM/Architect). BRIEF says this gate does **not** convert into the player; I own that copy. A later conversion is a new feature, not a synonym.
- S3 keys env vs reuse REST key; SigV4/reqwest vs new crate (Architect). I own that operator copy distinguishes files.massive.com credentials from `MASSIVE_API_KEY` and never prints them.
- Clap binary name if renamed; I own stdout title **`flat-files`** remaining grep-able and not an alias of `serve` / `session-day-tape` / `archive-coverage` / `score-lab`.
- Exact `/api/_research/...` suffix (Architect). Prefix stays `_research` (and/or `_metrics` if they insist); Pages still 404s both; I own framing **`RESEARCH READ — MASSIVE FLAT FILES`**.
- Whether keep is CLI-only or also HTTP (Architect). HTTP keep, if any, is operator-token, not trader, and must not 5xx the desk.
- Provenance enum variant name (Architect). I own that it is **never** `live_massive`, never coverage `present`, never `SessionTape` as if this gzip were day_tape. `MarketDataSourceKind` today is `{LiveMassive, Fixture, SessionTape}` — a new kind is Architect’s; UX forbids stuffing this corpus into those three names on the operator print.
- Holiday calendars beyond ET weekday. Weekend is ineligible; US holidays may appear as due misses if no file exists.
- Payload field names and endpoint signatures (Architect / synthesizer).
- Research-lab UI, remote archive-body store, hist-chain buy (explicitly out).

## Risks I see

1. **Helpful Ticker playback of the gzip.** Highest-probability product drift after a keep ships: a LiveTape “replay the S3 day” toggle, Settings replay, or Ask-AI citing reconstructed prints as live grounding. The BRIEF forbids it. AC-U1/U2/U5/U28 exist so that impulse fails a test, not a debate.
2. **Reusing coverage `present` on a reconstructed file.** After `archive-coverage-guardrails` and `present-is-live-paid-only`, `present` means a loadable `LiveMassive` book. Calling a gzip `present` is the invariant’s third obvious violator. Success occupancy is **`kept`**. AC-U8/U9/U10.
3. **One “no data” string for seven occupancy classes.** Operators will then “fix” not-elapsed by hammering S3, or ignore unauthorized because it looks like a miss, or treat empty extract as “the vendor failed us.” AC-U6/U16/U17/U18/U19.
4. **Session day tape vocabulary leak.** Tape standing already disclaims S3 flat files. If this CLI prints `no path-a ticks` / `session day tape not storing` / **Live tape**, P3 replay and coverage will attach to the wrong object. AC-U7/U27.
5. **`live` / `live_massive` provenance leak.** Bytes came from a paid Massive product. Storing them as `LiveMassive` makes the next ensure/coverage pass treat a next-day gzip as the day’s live paid book. AC-U9.
6. **Completeness % and “full open-to-close session.”** Universe CSV + watchlist filter cannot vouch a full SIP session. A dashboard or log aggregator will invent `78%`. AC-U25.
7. **Local CLI quoted as production coverage.** `[local-evidence-is-not-hosted-evidence]`. Standing **Evidence: local** is load-bearing. AC-U24.
8. **REST apiKey used as S3 secret, then printed.** Credential-plane mixup plus a log line is both a security and a copy failure. AC-U19.
9. **`/_ops/metrics` or Settings helpfulness.** Corpus JSON on `_metrics` plus “just one card”, or a Settings replay switch, re-scopes into a UI-touching spec without a design-system amendment. I refuse that in R1. AC-U4/U5/U29.
10. **Tripled miss copy.** One universe object becomes “SPY miss, QQQ miss, IWM miss” as if three vendor files 404’d. AC-U26.
11. **Inspect that quietly calls S3 or REST lookback.** `fetch_recent_trades` is not a daily file. A “confirm the miss” REST call burns quota and lies about vendor I/O. AC-U12.
12. **My own failure mode, named:** inventing endpoint paths, clap flags, aggregate inclusion, completeness percents, or a coverage-style `[PASS]/[FAIL]` that treats empty extract as a hole. If the synthesized SPEC contains flat-file copy that asserts `present`, `live_massive`, **Live tape**, or “full open-to-close session,” that is a defect — withdraw the claim.

## Assumptions I'm making about the other two lanes

- **Architect** will persist this corpus on a **dedicated body root that is not** `SESSION_DAY_TAPE_BODY_ROOT`, not the 48/14d ring, and not `SESSION_CHAIN_ARCHIVE_BODY_ROOT`, and will refuse (not silently alias) a colliding root — operator copy then sees `flat files not storing` or a blocked keep, never tape occupancy strings.
- **Architect** will **not** `insert_if_absent` these artifacts as `MarketDataSourceKind::LiveMassive`, will **not** mark them `SessionTape`, and will **not** let coverage classify them `present`; a new source kind if added still prints as **reconstructed flat file / `kept`**, never `live_massive`.
- **Architect** will expose operator **keep** (S3 to files.massive.com with Access Key + Secret, not `MASSIVE_API_KEY`) and **list/load** of kept identities on a token-gated path under existing `/api/_research` (and/or `_metrics` JSON only), **not** on a trader route, **not** on SSE, **not** as Settings, **not** as `/_ops/replay` for this gzip.
- **Architect**’s **inspect/list/load** path makes **zero** REST/WS and **zero** S3 calls on hit, miss, empty extract, not-storing, unreadable, not-elapsed, and not-in-watchlist; a vendor call on that path is a defect, not a fallback. Keep is the only files.massive.com I/O.
- **Architect** will **not** convert the gzip into Path-A / day_tape this gate, and will **not** extend `OperatorMetrics`, LiveTape, or trader-consumed `@convexa/api` types so `/_ops/metrics` or Ticker renders this corpus (`NO_UI_CHANGE`).
- **Architect** isolates keep/download failure from bundle / scan / SSE / ensure (`[best-effort-isolated-or-null]` — never 5xx the desk) and keeps keep I/O from dimming live ticks (`[live-vs-static-isolation]`). Production unset does not fetch files; armed keep with missing S3 keys or unwritable root **refuses** (`[production-fails-closed]`).
- **Architect**, if adding clap, will keep stdout titled **`flat-files`** (rename allowed) and will **not** alias `session-day-tape`, `archive-coverage`, `stream-prices`, or `serve` as this keep/read.
- **Architect** will surface occupancy so an operator can distinguish the seven classes **without reading source**: not-elapsed, miss, empty extract, unreadable, not-storing, unauthorized, and foreign live-tape — including that a universe-file miss is one day-file fact, not three ticker files.
- **PM** will lock **aggregates in or out**. Until that lock, standing copy names **trades and quotes only**; I will contest copy that prints aggregates as stored or that calls them “the open-to-close bars.”
- **PM** will **not** add trader UI, ticker playback of this gzip, Settings replay, a `/_ops` flat-files widget, research-lab chrome, OPRA/hist-chain purchase, or a coverage-style matrix that reuses `present`/`missing` this ship; SPEC §4 will carry `NO_UI_CHANGE`.
- **PM** accepts **`kept`** (not `present`) as the success occupancy required by `[present-is-live-paid-only]`, and accepts the seven occupancy classes as product states required by `[absent-is-not-none]`, including that empty extract is **not** a miss and not-elapsed is **exit 0**.
- **PM** accepts that a kept gzip does **not** fill session-archive coverage holes and does **not** become session day tape / Path-A this gate.
- **PM** will fold these AC-U rows into SPEC §3 with the `Verify by` marks intact, and will not replace `test` on trader negative space, occupancy classes, `live_massive`/`present`/`Live tape` bans, Pages 404, secret absence, or keep-skip isolation with `review`.
- **PM** will not ask skip/empty/load copy to assert `$199+$199`, open-to-close completeness, a completeness percent, or Massive recoverability — those stay in research prose, not runtime copy.
- **PM** will not require a holiday calendar beyond ET weekday; weekend is ineligible, not a miss.
