# R1 — architect position: massive-flat-file-keep

## Position

This slice is a **provenance-labeled research corpus**, not a fourth market-data source and not a live paid book. After vendor files publish (~11:00 ET the next day; **vendor docs, not in-repo**), an operator command fetches the entitled **US stocks SIP** daily objects, writes them under a **dedicated body root**, and derives a **locked-watchlist extract** for SPY / QQQ / IWM. Production `serve` without this construct still talks to Massive REST/WS. Coverage `present` still means a loadable `LiveMassive` session book. Score / tier / fingerprint stay byte-identical (`Authorizes: nothing`).

Verified live seams this position attaches to (not briefing HTML, not Python):

- `apps/api/src/infrastructure/massive/` is `mod.rs` + `rest.rs` + `ws.rs` + `market_phase.rs` only. `mod.rs` re-exports REST + WS + `resolve_gex_spot`. There is no files client and no `files.massive.com` string in that tree.
- `MassiveRestClient` (`rest.rs`) authenticates REST with `cfg.massive_api_key` as a query `apiKey` against `cfg.rest_base` (env `MASSIVE_REST_BASE`, default `https://api.massive.com` in `config.rs`). `fetch_recent_trades` is `GET /v3/trades/{ticker}` over a trailing lookback, newest-first, capped 120k — **not** a daily S3 file.
- `StockStreamHub` (`ws.rs`) is the stocks WebSocket (one connection, many symbols) using the same REST api key. Not a files client.
- `MarketDataSourceKind` (`services/market_data/mod.rs`) is exactly `{LiveMassive, Fixture, SessionTape}`. Coverage `present` is `LiveMassive` only (`session_chain_archive/coverage.rs` `classify_loaded` / `cell_literal`). `SessionTape` and `Fixture` are `blocked occupancy`, never `present`.
- `SessionChainArchive::insert_if_absent` (`session_chain_archive/store.rs`) is the first-wins paid-book insert. Path-B tape persist already poisons that name (`day_tape/path_b.rs`). This slice must too.
- Tape root `SESSION_DAY_TAPE_BODY_ROOT` is optional, no nested default; `tape_root_conflicts` (`config.rs`) refuses equality/nesting against ring, archive index, and archive body. `open_session_day_tape` (`state.rs`) does **not** add a production tape-root prerequisite.
- Watchlists: `TAPE_WATCHLIST` (`day_tape/watchlist.rs`) and `ENSURE_SYMBOLS` (`session_chain_archive/ensure.rs`) are both `["SPY","QQQ","IWM"]` and are **not aliases** (tape watchlist poisons `ENSURE_SYMBOLS` by source scan).
- Tape CLI standing (`day_tape/cli.rs`): not OPRA options-quote flat files; not S3 hist-chain; Authorizes: nothing; Evidence: local.
- Pages Function (`functions/api/[[path]].ts`) 404s `/api/_metrics` and `/api/_research` by **prefix** before proxy.
- `apps/api/Cargo.toml`: `reqwest` (json + rustls-tls), `hmac`, `sha2`, `hex`. **No** `aws-sdk-*`, **no** gzip/flate2, **no** csv crate. Session HMAC already exists (`services/auth/cookies.rs` `HmacSha256`).
- Production bootstrap (`runtime_guardrails/config.rs`) requires archive **body** root in prod; it does **not** require the tape root. Replay refuses `APP_ENV=prod` (`day_tape/construct.rs`).

Vendor S3 facts used below (`https://files.massive.com`, bucket `flatfiles`, prefix `us_stocks_sip/{trades_v1|quotes_v1}/YYYY/MM/YYYY-MM-DD.csv.gz`, Access Key + Secret from the Massive dashboard) are **docs not in-repo** (BRIEF cites `massive.com/docs/flat-files/quickstart`, 2026-08-30). They are attackable assumptions, not verified code.

### Council locks (technical pick, axes named)

**1. Stocks SIP trades + quotes only. Not aggregates this slice. Not OPRA.**

| Option | Complexity | Cost | Scalability | Familiarity |
| --- | --- | --- | --- | --- |
| A. SIP `trades_v1` + `quotes_v1` | two product keys, two extracts | two universe objects/day | two stream-to-disk GETs | same CSV-gz shape |
| B. A + aggregates | third product, third extract, no tick reconstruct | extra GB/day | extra GET | same |
| C. OPRA options files | new prefix/schema, greeks still absent | large + license-adjacent | out of BRIEF | none in-repo |

Pick **A**. Decisive axes: **BRIEF scope + complexity**. The reconstructable **price/quote history** is trades and quotes. Aggregates are derived OHLCV; they do not add a tick the SIP trades file lacks. OPRA is already a tape-CLI non-goal and does not reconstruct underlying prints. Layout leaves a closed product slot so aggregates can be added later without restating provenance.

**2. Dedicated body root. Never `SESSION_DAY_TAPE_BODY_ROOT`.**

| Option | Complexity | Cost | Scalability | Familiarity |
| --- | --- | --- | --- | --- |
| A. New optional path env, no nested default | one more `Option<PathBuf>` + conflict fn | operator volume | universe gzip can be GB-class | copy tape-root pattern |
| B. Reuse tape root | zero new env | **mixes gzip CSV with Path-A jsonl** | replay/coverage poison | false familiarity |

Pick **A**. Decisive axis: **invariants over cost**. `tape_root_conflicts` exists because mixing stores is a silent occupancy lie. Reusing the tape root would put vendor gzip next to `path_a.jsonl` / Path-B snapshots (`day_tape/fs.rs` layout). Mechanism: new optional root; conflict predicate is bidirectional nest against ring, archive index, archive body, **and** the tape root; collision refuses process start (same as tape collision → `Err`, not disabled). Unset/empty/unwritable → **not-storing**, not a silent default. **Do not** add a `ViolationCategory` for this root: production `serve` must still bind and talk to Massive REST/WS when the construct is absent (BRIEF). Archive body remains the only production body-root prerequisite.

**3. Raw gzip corpus + watchlist extract. Do not convert into Path-A this slice.**

| Option | Complexity | Cost | Scalability | Familiarity |
| --- | --- | --- | --- | --- |
| A. Persist vendor gzip + filtered extract; no domain remap | stream + CSV filter | disk for universe objects | extract is small; gzip may be large | FS body store |
| B. Convert CSV → Path-A `Trade`/`Quote` records this slice | schema map + tape writer + replay coupling | cheaper disk, huge build | would load the player | false: tape schema is WS ticks |

Pick **A**. Decisive axes: **BRIEF non-goal + complexity**. Conversion is a second feature: vendor CSV columns are **not in-repo**, Path-A records are WS-shaped (`day_tape`), and replay walks the **day_tape store**, not gzip CSV. Mechanism: stream GET to temp on the dedicated root → fsync → rename into a corpus locator; stream-decompress and keep only watchlist rows into a sibling extract locator; **do not** call `SessionDayTape` writers, **do not** emit `PathAKind`. Extract preserves vendor **row bytes** for matching tickers (filtered CSV.gz), not `TradePrint` / tape JSONL.

Retain **both** corpus gzip and extract because a cancelled plan cannot re-GET (the feature’s reason to exist). First-wins on a successful corpus object: if the gzip is already stored and has a valid gzip magic + recorded digest, skip GET; extract may be rebuilt from local corpus without network. **No prune this slice** (non-goal). Disk growth is an operator-volume problem named under Risks, not a silent truncate.

**4. Distinct S3 Access Key + Secret. Never `MASSIVE_API_KEY`.**

| Option | Complexity | Cost | Scalability | Familiarity |
| --- | --- | --- | --- | --- |
| A. Two new runtime env bindings | one credentials struct | dashboard mint | n/a | env injection already |
| B. Reuse `MASSIVE_API_KEY` as S3 secret | zero env | **wrong protocol, poison** | n/a | dangerously familiar |

Pick **A**. Decisive axis: **vendor contract + structural poison**. REST auth is query `apiKey` on `api.massive.com` (`rest.rs`). Files auth is SigV4 on `files.massive.com` (**docs not in-repo**). BRIEF poison: “REST apiKey as S3 secret”. Mechanism: files client type **has no `api_key` field**; it takes an access-key + secret pair loaded from env **other than** `MASSIVE_API_KEY`. A source scan on the files leaf that finds `MASSIVE_API_KEY` or `massive_api_key` fails the build. Fetch CLI uses the score-lab / tape empty-key pattern (`main.rs` `massive_api_key: String::new()`) so a keep command does **not** require the REST key. Serve does **not** construct the files client and does **not** require the S3 pair.

**5. SigV4 via existing reqwest + hmac + sha2 + hex. Do not add an AWS S3 crate.**

| Option | Complexity | Cost | Scalability | Familiarity |
| --- | --- | --- | --- | --- |
| A. Hand-roll SigV4 GET (empty payload) + reqwest stream | ~one signing module + fixture vectors | no new SDK | one GET/object | `HmacSha256` already in `cookies.rs`; reqwest already |
| B. `aws-sdk-s3` (or smithy) | huge API + runtime | supply-chain + compile | overkill for GET | **zero** in `Cargo.toml` |

Pick **A**. Decisive axes: **team familiarity + supply-chain + complexity**. `Cargo.toml` already has the primitives; OPEN_THREADS still carries a blocked supply-chain item. Scope is **GET of known keys**, not ListBuckets/multipart/complete S3. Mechanism:

- Separate `reqwest::Client` from `MassiveRestClient` (no `apiKey` query, no 120s whole-request timeout).
- Enable reqwest **`stream`** feature; write `chunk()` bytes to a temp file. **Forbidden:** `Response::bytes()` on a universe object (would RAM-buffer GB).
- SigV4 AWS4-HMAC-SHA256 for `GET`, signed headers `host`, `x-amz-date`, `x-amz-content-sha256`; payload hash = SHA-256 of the **empty** body (GET has no payload). HMAC key derivation uses the S3 secret, **never** the session cookie ring (`cookies.rs` keys stay in auth).
- URL sanitizer sibling of `safe_vendor_url` (`rest.rs`) strips `Authorization`, `X-Amz-*`, and never prints the secret. Errors `Display` through that sanitizer so reqwest transport errors cannot leak credentials (same reason `safe_http_failure` exists).
- Add **`flate2`** (decode corpus gzip on disk) and **`csv`** (header-driven ticker filter). Those are small decode crates, not an AWS SDK. Justify them: there is **zero** gzip/csv support in the crate today (verified grep). HTTP `Content-Encoding: gzip` is the wrong layer — the **object** is `.csv.gz`.

**Attackable:** region string, path-style vs virtual-hosted URL, and whether the endpoint wants `UNSIGNED-PAYLOAD` instead of the empty-body hash. I assume path-style `{endpoint}/{bucket}/{key}` and region `us-east-1` because that is the common S3-compatible GET; if Massive’s (not in-repo) quickstart disagrees, the signing module’s constants change, not the store.

**6. Operator CLI + `_research` read. No trader chrome. Shape only.**

| Option | Complexity | Cost | Scalability | Familiarity |
| --- | --- | --- | --- | --- |
| A. Clap keep/list + optional operator research GET under existing `_research` prefix | copy tape/coverage | none on trader request path | fetch is on-demand, one date | `session-day-tape` / `archive-coverage` |
| B. Trader ticker chrome / second live path | FE surface + occupancy lie | product confusion | would hit request path | forbidden by BRIEF |

Pick **A**. Decisive axis: **`operator-vs-trader-path-separation` + `single-ticker-on-demand`**. Mechanism: clap subcommand sibling of `session-day-tape`, dispatched before live `Config::from_env` so REST key is optional; standing block `Authorizes: nothing` / `Evidence: local` / not a live paid book. Any HTTP read reuses the **existing** operator-token gate (`metrics_secret_token` / `metrics_token_ok` as in `research_session_day_tape.rs`) and lives under the **existing** `/api/_research` **prefix** so `functions/api/[[path]].ts` 404s it without a Pages edit. **No** serve-time worker, **no** AppShell link, **no** ticker player, **no** `/_ops/` replay. I do not name the clap argv, the HTTP path tail, or wire field names — those are other lanes — but the **prefix and token-gate reuse** are load-bearing fences I own.

### Data-structure content

Closed watchlist in **this leaf**, values pinned `["SPY","QQQ","IWM"]`, not an import of `ENSURE_SYMBOLS`. Equality test in-module; source scan poisons `ENSURE_SYMBOLS` the way `day_tape/watchlist.rs` already does. May *assert equal to* `TAPE_WATCHLIST` in a test without using it as the production table (tape’s comment: sibling of ENSURE/WARM, not an alias).

**Corpus identity:** `(et_date, product)` where `et_date` is an America/New_York calendar date and `product` is a closed enum `{TradesV1, QuotesV1}`. Not a ticker key — vendor objects are **universe-per-day** (docs not in-repo; BRIEF).

**Extract identity:** `(symbol, et_date, product)` with `symbol` in the locked watchlist.

**Provenance:** a **local** closed enum on this store (vendor-flat-file corpus vs research extract). **Do not** add a `MarketDataSourceKind` variant this slice. Mechanism: these bytes never become a `VendorBundle` and never reach `insert_if_absent`. Adding a fourth kind would force exhaustive matches in coverage/PG/wire **without** those modules ever loading a gzip — coupling without occupancy. Poison: files leaf `include_str` scan must not contain `insert_if_absent`, `LiveMassive`, `spawn_capture`, `MarketDataPort`, or `compute_analytics_from_vendor`.

**Occupancy (type-level, `absent-is-not-none`):** a closed enum the caller cannot collapse to `Option` / empty-vec:

| State | Means | Not |
| --- | --- | --- |
| `NotElapsed` | `now_et < (D + 1 day) 11:00 America/New_York` | miss |
| `Ineligible` | weekend (Sat/Sun in ET); no SIP session | miss |
| `NotStoring` | root unset / empty / unwritable | empty extract |
| `Unattempted` | due, but GET not run or transport/auth failed | miss (file not proven absent) |
| `Miss` | due **and** vendor 404 / no-such-key after the due line | empty extract |
| `Stored` | corpus gzip on disk, gzip-magic + digest ok | `present` (that word is archive-only) |
| `ExtractEmpty` | corpus stored, watchlist symbol has **zero** rows | miss, and not “none because we didn’t look” |
| `Unreadable` | gzip/csv/header fault | empty extract |

`present` is **not a member**. Live tape / session book / replay occupancy are **other stores**. A consumer that wants a boolean must match and drop states explicitly.

Sidecar (operator meta, not a scoring input): vendor object key, byte length, SHA-256 of the gzip, fetched-at UTC. Digest is computed while streaming to disk so we do not re-read GB to hash.

### Data flow

```
operator CLI (off trader request path)
  → due-clock (America/New_York; 11:00 next calendar day)
  → if NotElapsed / Ineligible / NotStoring: no network
  → if Stored (first-wins): skip GET; optionally rebuild extract locally
  → else SigV4 GET → stream chunks → temp file on dedicated root → fsync → rename
  → stream flate2 + csv → watchlist rows → extract object (atomic rename)
  → classify; print standing; exit non-zero on Miss/Unreadable/Unattempted/NotStoring when a keep was armed
research read (CLI list or `_research` GET)
  → open dedicated root only; vendor counter stays 0 (REST, WS, and S3)
serve
  → does not construct the files client
  → may open the store read-only if root is set (for research GET), else not-storing
  → missing S3 keys do not refuse bind
```

Due-clock mechanism: `chrono_tz::America::New_York`. Session date `D` is due when `now_et >= D + 1 day at 11:00:00`. A keep armed before that line classifies `NotElapsed` and **must not GET** (a pre-due 404 would fabricate `Miss`). Weekday ET holiday with a real 404 after due classifies `Miss` — we have **no** SIP holiday calendar in-repo; inventing one is out of scope.

Idempotency mechanism: first-wins on **successful** corpus bytes. `Miss` / `Unattempted` may retry. Extract rebuild from local corpus does not require S3 keys.

### Component boundaries

```
infrastructure/flatfiles/     # NEW leaf. Not massive/rest.rs.
  credentials, SigV4 sign, streaming GET, URL sanitizer
infrastructure/massive/       # UNCHANGED role: REST + WS + market_phase
services/flat_file_keep/      # NEW leaf: store, due-clock, extract, classify, CLI
services/session_chain_archive/  # zero imports from this slice
services/day_tape/            # zero writers called; conflict fn may be generalized in config.rs
services/market_data/         # MarketDataSourceKind unchanged
quant-engine                  # zero imports (already has no HTTP/Massive)
runtime_guardrails            # no new ViolationCategory
functions/api/[[path]].ts     # prefix 404 unchanged
```

`infrastructure/massive/` stays the REST+WS adapter. A files module dropped into that folder would share a crate path with `MassiveRestClient` and invite `cfg.massive_api_key` reuse — the isolation I want is a **sibling leaf** whose credentials type cannot be built from `Config.massive_api_key`.

`config.rs` gains: optional dedicated root; optional S3 access-key + secret (empty allowed at `from_env`; required only when a keep is armed). Generalized conflict helper: candidate root vs ring + archive index + archive body + tape root.

Serve workers (warmer, ensure, scanner, stock hub) do not import the files leaf. Fetch is **not** an in-request market sweep (`single-ticker-on-demand`).

### Isolation / error rules

- **Desk / trader HTTP:** download faults never 5xx the ticker/SSE/scanner path because those handlers **do not call** the files client (`best-effort-isolated-or-null` as applied to added bundle work; this work is not on the bundle). Structural proof: request-path modules’ source scan has no files-client type.
- **Armed keep (CLI):** missing S3 pair, unwritable root, or root collision → **refuse before any GET** (`production-fails-closed` on the armed construct, not on `serve`). Auth 403/401 → `Unattempted` (credential), non-zero exit, no partial rename.
- **Partial writes:** only a fully fsynced object is renamed into the locator. Crash mid-stream leaves temp; classify does not treat temp as `Stored`.
- **Research GET:** operator token when `METRICS_SECRET_TOKEN` is set; zero vendor I/O; store errors stay on the operator route. Pages trader origin never reaches it (prefix 404).
- **Secrets:** S3 pair + REST key never in list/load/CLI stdout, never in research JSON, never in image (`.dockerignore` already excludes `.env*`; runtime env injection). Digest sidecar is content hash, not a credential.
- **License:** artifacts are **our research**. No trader route serves the gzip; no `MarketDataPort` adapter; standing forbids advertising them as a live vendor feed. Redistribution as a feed is a non-goal enforced by path isolation, not a ToS parser.

### Binding constraints (restated with how)

- **`present-is-live-paid-only` (HARD).** Mechanism: files leaf never calls `insert_if_absent`; never constructs `VendorBundle { source: LiveMassive }`; occupancy enum has no `present`. Coverage classifier stays exhaustive on the existing three `MarketDataSourceKind`s. Poison test: injecting an insert of these bytes as `LiveMassive` is out of this module; a source scan makes the insert **unrepresentable here**. Replay/tape already set the pattern (`path_b.rs` persist test).
- **`operator-vs-trader-path-separation`.** Mechanism: clap + `_research` prefix + Pages 404 + operator token. No trader route, no AppShell, no player chrome. Fetch is a CLI side effect, not a trader GET.
- **`additive-keeps-score-byte-identical`.** Mechanism: `quant-engine` / `generate_signals` / fingerprint modules do not import the files leaf. Scoring path diff is empty. CLI standing `Authorizes: nothing`. Same structural story as tape/coverage/score-lab.
- **`production-fails-closed`.** Mechanism split (do not conflate): (1) **`serve` + `APP_ENV=prod`** does **not** require this root or S3 keys — production without the construct still talks to Massive; do not add `ViolationCategory`. (2) **Armed keep** with missing keys or unwritable/colliding root refuses **before bind-of-GET**. (3) Root **collision** with tape/archive/ring refuses **process start** (cannot mix bytes). Unset root on serve → not-storing, desk up.
- **`absent-is-not-none`.** Mechanism: closed occupancy enum above; `ExtractEmpty` ≠ `Miss` ≠ `NotElapsed` ≠ `Unreadable` ≠ `NotStoring` ≠ live tape. Weekend is `Ineligible`, not miss.
- **`no-secrets-in-image`.** Mechanism: keys only via runtime env; `.dockerignore` `**/.env*`; sanitizer on error URLs; CLI/research omit secret material; image non-root unchanged.
- **`cited-code-is-verified-not-assumed`.** Mechanism: every in-repo fact above was read at source. Vendor endpoint/bucket/prefix/credential-kind marked **docs not in-repo**. Unverifiable: CSV column name for ticker, SigV4 region, path-style, exact object size, holiday calendar.
- **`structural-over-prose-enforcement`.** Mechanism: poison tests — `insert_if_absent` / `LiveMassive` / `MASSIVE_API_KEY` / `SESSION_DAY_TAPE_BODY_ROOT` as this store’s root / `aws-sdk` in `Cargo.toml` / `MarketDataSourceKind` new variant. Conflict function makes reuse of tape root a startup `Err`. Occupancy is an enum, not a boolean.
- **`local-evidence-is-not-hosted-evidence`.** Mechanism: CLI standing `Evidence: local`; this is not production coverage and not `[PASS] n/n`. A keep on a laptop is not hosted proof the Railway volume holds the gzip.
- **`best-effort-isolated-or-null`.** Mechanism: files I/O is off the trader request path; bundle/SSE cannot 5xx because of a files fault. Operator CLI/research may non-zero / operator-status; that is not a desk 5xx.
- **`single-ticker-on-demand`.** Mechanism: no fetch from `load_or_compute`, warmer, ensure worker, scanner request, or SSE. Multi-object GET (two products × one date) happens only in the operator command, off-path, bounded to the locked watchlist extract.
- **Massive license (research keep, not redistribution).** Mechanism: operator-only surfaces; no public Pages path; no live-feed adapter; standing names research; extract is for our reconstructable history of SPY/QQQ/IWM, not a resold SIP.

### Explicit non-goals

- Reconstruct chain greeks / Plan History (still live snapshots only).
- Insert as `LiveMassive` or count as coverage `present`.
- Convert gzip CSV into session-day-tape Path-A / replay input this slice.
- OPRA, indices (`I:VIX`/`I:SPX`), crypto, aggregates files this slice.
- Serve-time background downloader / in-request fetch.
- AWS SDK / rusoto / smithy crates.
- New production bootstrap category for this root.
- Prune / remote object store (`remote-archive-body-store` remains parked — **our** S3, not `files.massive.com`).
- Trader UI, ticker player chrome, second live path, copy.
- Holiday calendar; treating weekday vendor 404 after due as anything but `Miss`.
- Changing `fetch_recent_trades` into a file reader.

## Risks I see

1. **Universe object size.** SIP trades/quotes gzip for the whole tape can be GB-class. Streaming to disk is the mechanism; a too-small volume still fills. First-wins does not prune. If the operator root shares a small Railway volume with archive bodies, archive writes lose. Dedicated root is necessary but not sufficient — it must be a volume sized for gzip retention. I am **not** defaulting under `data/` (tape’s “no nested default”).
2. **Publish clock is approximate (`~11:00 ET`).** A due line of 11:00 exactly will `Miss` a late publish. Retry is allowed; a dashboard that treats one `Miss` as permanent would lie. Classification must stay recompute-from-store + optional re-GET.
3. **CSV schema is not in-repo.** If the ticker column is not a header we recognize, extract is `Unreadable` for all three names even when corpus `Stored`. That is honest; it is also a ship-blocker until a fixture from a real (redacted) header is captured. I assume a header row with a ticker/symbol field; if the file is headerless, unreadable, not empty.
4. **SigV4 dialect.** S3 clones disagree on region, path-style, and `UNSIGNED-PAYLOAD`. Wrong guess → 403 `Unattempted`, not `Miss`. Fixture vectors against a recorded canonical request are the test; a live 403 is not a coverage miss.
5. **Holiday 404 → `Miss`.** Without a SIP calendar, Labor Day looks like a vanished file. Prefer a visible miss over a fabricated “not a session”.
6. **Temptation to reuse `MassiveRestClient`.** It would put `apiKey=` on an S3 URL and inherit a 120s timeout. Boundary is a different type; poison the import.
7. **Temptation to add `MarketDataSourceKind::FlatFile`.** Exhaustive coverage matches would then have to classify bytes that never enter the archive. Do not.
8. **License / redistribution.** An unauthenticated research GET or a Pages proxy hole would ship entitled SIP as a public feed. Prefix 404 + token gate are the fence; a new public path would break it.

## Assumptions I'm making about the other two lanes

- **PM** will treat SIP trades + quotes (no aggregates, no OPRA) as sufficient for “reconstructable price/quote history” this slice; if they require aggregates or options files in v1, lock 1 is false and the product set grows.
- **PM** will accept a **dedicated operator volume/root** (unset = not-storing; not a production bind prerequisite) rather than “just write next to the tape”; if they require reuse of `SESSION_DAY_TAPE_BODY_ROOT`, lock 2 is false and I withdraw the mix-prevention claim.
- **PM** will keep **Authorizes: nothing** / not a score-change feature, so an empty scoring-path diff is the acceptance shape, not a fingerprint bump.
- **UX** will not add ticker-player chrome, AppShell nav, or a second live path this slice; operator-facing copy lives on CLI standing + research read, not trader widgets.
- **UX / interface** will place any HTTP read under the existing `/api/_research` prefix (token-gated like session-day-tape) so `functions/api/[[path]].ts` continues to 404 the public origin **without** a Pages change; a new public `/api/...` path would falsify the Pages-fence mechanism.
- **Interface / PM** will not collapse occupancy into a boolean `present`/`missing` on the wire; the closed states (`NotElapsed` / `Miss` / `ExtractEmpty` / `Unreadable` / `NotStoring` / …) must remain distinct through to the operator consumer (`absent-is-not-none`).
- **PM** will accept **retain vendor gzip + extract** (disk) rather than extract-only, because post-cancel re-GET is impossible; if they cap disk to extract-only, I retract universe retention and keep the sidecar digest as the only proof we fetched the entitled object.
- **UX** will not ask replay/session-day-tape to consume these files this slice; conversion remains a later feature with its own BRIEF.
