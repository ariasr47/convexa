# R3 — ux ↔ architect

One exchange. Four technical items. I do not invent endpoints, clap flags, or payload keys. I do not settle session-bar aggregates In/Out or universe gzip retention (human). Type names stay Architect; printed occupancy stays this lane.

## Converged

### 1. Collision vs serve — YES (`428c3ad3…`)

Quoted architect R1: “Mechanism: new optional root; conflict predicate is bidirectional nest against ring, archive index, archive body, **and** the tape root; collision refuses process start (same as tape collision → `Err`, not disabled).”

Settlement:

- Bidirectional nest against ring, archive index, archive body, and the tape root — accept. Collision occupies none of those roots.
- Refuse is **Err, not disabled** — accept, on the **armed keep** construct. That is already architect isolation: “production-fails-closed on the armed construct, not on `serve`.”
- `serve` still binds and talks to Massive REST/WS. A colliding keep root does not fail desk bind, 5xx bundle / scan / SSE / ensure, or dim live ticks (`NO_UI_CHANGE`, `best-effort-isolated-or-null`, `live-vs-static-isolation`).
- Research open of a colliding root does not dump a date as `miss`, `not-storing`, or tape occupancy.
- Operator line is **not** `flat files not storing`. That class is root unset / empty / unwritable only.

### 2. Credential refuse with zero GET — YES (`00824a53…`)

Quoted architect R1: “Mechanism: files client type **has no `api_key` field**; it takes an access-key + secret pair loaded from env **other than** `MASSIVE_API_KEY`.”

Settlement:

- Type isolation (no `api_key` field) and files-leaf source scan stay. They poison the **name**. They do not detect the live REST/WS **value** pasted into the files slot. SigV4-then-403 is a fetch; I will not print “does not fetch” for that path.
- Armed keep refuses **before any files GET** in two operator-visible classes (PM AC-19 / AC-20). Architect names the pre-GET classification. I do not name env spellings or the comparison algorithm.
- Missing pair: zero files GET; not miss; not not-storing; not wrong-credential-class.
- Live REST key in the files slot: zero files GET; not miss; not missing-pair; not a 403-after-GET story.
- A 403/401 after a GET is a fetch: `download failed`, not the zero-GET wrong-credential-class line, not miss.
- Honor `67b8aeeb…`: missing pair does not print the REST-apiKey clause (that clause asserts a substitution this run did not perform).

### 3. Stored → kept mapping facts — YES (`5d8eda77…`)

Quoted architect R1: “**Interface / PM** will not collapse occupancy into a boolean `present`/`missing` on the wire; the closed states (`NotElapsed` / `Miss` / `ExtractEmpty` / `Unreadable` / `NotStoring` / …) must remain distinct through to the operator consumer (`absent-is-not-none`).”

Settlement:

- Type-level distinctness survives through to the operator consumer. The **printed** tokens are the operator deck, not the type names.
- Architect ask confirmed: operator success remains **`kept` / `kept from Massive flat files`** even if corpus-level state is Stored (gzip magic + digest). `present` stays banned on this vehicle.
- `kept` is an **extract** claim: readable extract for `(symbol, D, class)` with **≥1** rows. Corpus Stored alone is not `kept` — that would label a zero-row symbol as success.
- `ExtractEmpty` prints `empty extract`, never `kept`, never `Stored`.
- Honor `8b39d0dd…`: I do not print “not a full-universe keep” as a store fact. Whether the universe gzip is retained is human. Standing occupant remains the watchlist extract · not a full-universe redistribution · not a full open-to-close claim.

### 4. Never print Unattempted / present / Stored — YES (`f91d4ee8…`)

Quoted architect R1: “Auth 403/401 → `Unattempted` (credential), non-zero exit, no partial rename.”

Settlement:

- Type-level `Unattempted` / `Stored` may exist. Operator stdout / stderr / research human print **never** contains `Unattempted`, `present`, or `Stored`.
- 403/401 after GET: non-zero, no partial rename (architect) — operator print is `flat files download failed: vendor file for {ET_DATE} not confirmed`. Not miss. Not missing-files-credentials. Not wrong-credential-class (those two are zero GET).
- Confirmed due 404 / no-such-key on keep → `miss`.
- I withdraw, **in this pair**, the R2 parenthetical that inspect GET-not-run on a named due D is `miss`. Inspect store-absence is the pm ↔ ux pair.
- Poison on this vehicle: `Unattempted`, `present`, `Stored`, `live`, `LIVE`, `live_massive`, `Live tape`.

## What I withdraw

- **`67b8aeeb…` (honor):** one `flat files unauthorized` line plus REST-apiKey clause on a mere missing pair. Missing pair ≠ wrong-credential-class ≠ HTTP unauthorized. Missing pair prints no REST clause.
- **`8b39d0dd…` (honor):** standing “not a full-universe keep” as a storage assertion. Still-defensible: no full-universe redistribution; no open-to-close completeness from a filtered extract. Gzip keep/drop is human.
- R1 assumption that tape-root collision is a **`not-storing`** operator error. Collision is refuse-to-mix. Not-storing remains unset / empty / unwritable.
- Any demand that architect delete type-level `Unattempted` or `Stored`. I own print; they own types.
- R2 claim, in this pair, that inspect of a due date with no stored object prints `miss`. Not settled here.
- Any settlement of aggregates In/Out or universe gzip retention.
- Inventing the credential-comparison algorithm or any endpoint / payload key.

## Operator literals I will print

Closed operator deck for keep / list / load. Architect names the facts; I print these. Never the type names `Stored`, `Unattempted`, `ExtractEmpty`, `NotElapsed`, `Miss`.

| When (fact, not wire) | State | Exact operator line |
|---|---|---|
| Extract readable, ≥1 rows for that identity | `kept` | `kept from Massive flat files` · CLI `[OK] flat-files — kept from Massive flat files · not a live paid session book · not a session day tape · local audit is not production coverage` |
| File/object present, this watchlist symbol 0 rows | `empty extract` | `flat files empty extract: {SYMBOL} on {ET_DATE}` |
| Publish clock not passed | `not-elapsed` | `flat files not elapsed: vendor file for {ET_DATE} not yet published` |
| Due and vendor 404 / no-such-key proved on keep | `miss` | `flat files miss: vendor file for {ET_DATE} due and absent` |
| Object/pointer exists, body bad | `unreadable` | `flat files unreadable: {reason}` |
| Root unset / empty / unwritable | `not-storing` | `flat files not storing` |
| Keep root collides with tape / archive / ring | refuse-to-mix (armed keep / research open; `serve` still binds) | `flat files refuse to mix` · CLI `[ERROR] flat-files — flat files refuse to mix. No keep recorded.` · never `flat files not storing` |
| Files pair absent, keep armed (zero GET) | missing-files-credentials | `flat files missing credentials` · CLI `[ERROR] flat-files — flat files missing credentials. No keep recorded.` · no REST-apiKey clause |
| Live REST/WS key value in the files slot, keep armed (zero GET) | wrong-credential-class | `flat files wrong credential class · REST apiKey is not the files secret` · CLI `[ERROR] flat-files — flat files wrong credential class. REST apiKey is not the files secret. No keep recorded.` |
| Keep GET ran; transport / 403 / 401 without 404 | download-failed | `flat files download failed: vendor file for {ET_DATE} not confirmed` · CLI `[ERROR] flat-files — flat files download failed: vendor file for {ET_DATE} not confirmed. No keep recorded.` |
| Operator HTTP token miss | HTTP unauthorized | shipped `metrics_unauthorized` only |
| Weekend session date | `ineligible weekend` | `flat files ineligible weekend: {ET_DATE}` |
| Symbol not SPY / QQQ / IWM | not-in-watchlist | `not in flat-files watchlist: {SYMBOL}` |

**Never print on this vehicle:** `Unattempted` · `present` · `Stored` · `missing` · `not yet due` · `blocked occupancy` · `live` · `LIVE` · `live_massive` · `Live tape`.

**Standing Extract line (after `8b39d0dd…`):**

```
Extract:     watchlist rows only · not a full-universe redistribution · not a full open-to-close claim
```

`serve` with a colliding keep root: no trader caption, no `flat files not storing` on the desk path, live REST/WS unchanged.

No endpoints, clap argv, or JSON keys in this file.
