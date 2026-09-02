# R3 — architect ↔ ux

Pair: architect ↔ ux. Conflicts: `428c3ad3…` (collision vs serve), `00824a53…` (REST key in files slot), `5d8eda77…` (Stored vs kept), `f91d4ee8…` (Unattempted print). Honor, do not re-fight: `67b8aeeb…` (missing pair ≠ wrong-credential-class ≠ HTTP unauthorized), `8b39d0dd…` (no “full-universe keep” store assertion until the occupant lock). Product locks (aggregates; universe gzip retention) are not this pair.

## Converged

1. **Keep-root collision with tape / archive / ring does not refuse `serve` bind.** Only the keep construct refuse-to-mix. Tape, archive, and ring openers stay on their current predicates. The desk still talks to Massive REST/WS. Collision is not `NotStoring`.

2. **Missing files pair and live REST key pasted into a files slot are distinct pre-GET refuses, each with zero files GET.** Env-name isolation is necessary and not sufficient. Honor `67b8aeeb…`: missing pair ≠ wrong-credential-class ≠ operator-token HTTP unauthorized. A later vendor 401/403 after GET is none of those three.

3. **Type-level names are implementer states, not print tokens.** Distinctness survives to the operator consumer (`absent-is-not-none`). `present` is not a member and is banned on this vehicle. `Stored` is corpus-on-disk (gzip magic + digest), not operator success. Operator-visible success fact is: corpus `Stored` **and** the locked-name extract for `(symbol, D, class)` has ≥1 rows. `ExtractEmpty` is: corpus `Stored` **and** that locked name has zero rows — not miss, not not-storing, not success. UX owns literals and binds the closed print deck to these facts. I do not lock print strings.

4. **401/403 after a files GET is not `Miss`.** `Miss` is due **and** vendor 404 / no-such-key. 401/403 after GET is a fetch without absence proof (`FetchFailed`). No partial rename.

Inspect of a due date with no local object and no GET this run is **not** classified as type-level `Miss` here (no 404 proved). Whether inspect **prints** miss is the pending pm ↔ ux / architect ↔ pm thread — not locked by this pair.

## What I withdraw

- **Process-start refuse for keep-root collision.** Exact sentence I can no longer defend (R1 lock 2 / `428c3ad3…` quote): “collision refuses process start (same as tape collision → `Err`, not disabled).” That copies `open_session_day_tape` (`state.rs`: collision → `AppError::Config`) onto an optional construct and would take the desk down. It also contradicts my own armed-keep split (`production-fails-closed` on the armed construct, not on `serve`; no new `ViolationCategory`; missing S3 keys do not refuse bind).
- **`Unattempted` as one type-level bucket** that collapsed GET-not-run, missing pair, wrong-credential-class, transport failure, and 401/403 after GET. Exact sentence withdrawn (`f91d4ee8…` quote): “Auth 403/401 → `Unattempted` (credential), non-zero exit, no partial rename.” Non-zero + no partial rename stay; the class does not.
- **`Unattempted` as an operator-visible occupancy word.** Type names do not print (`5d8eda77…`).
- **`Stored` as a value that may appear as operator success.** Corpus `Stored` with zero extract rows is `ExtractEmpty`, not kept (`5d8eda77…`).
- **“Env other than `MASSIVE_API_KEY`” as the whole wrong-class fence.** Exact sentence withdrawn (`00824a53…` quote): “Mechanism: files client type **has no `api_key` field**; it takes an access-key + secret pair loaded from env **other than** `MASSIVE_API_KEY`.” The type and the env-name rule stay; they do not detect paste.

Not withdrawn: dedicated keep root; bidirectional nest predicate; files client still has no `api_key` field; source scan on the files leaf; `Miss` = due ∧ 404/no-such-key; `present` banned; serve does not construct the files client.

## Named mechanism

### 1. Collision — refuse-to-mix, desk up

Verified live seam: `tape_root_conflicts` (`config.rs`) is tape vs ring + archive index + archive body. `open_session_day_tape` (`state.rs`) returns `Err` on true → **serve does not bind**. Unset/empty/unwritable tape → `Ok(disabled)` (not-storing). Archive `body_root_conflicts` is unchanged and fail-open for archive callers.

Keep must **not** copy that `Err` path and must **not** become a new peer inside `tape_root_conflicts` / `body_root_conflicts`. Adding keep as a tape/archive peer would let a mis-set keep root refuse tape open, which already refuses serve.

Mechanism:

- New keep-only predicate: candidate keep root vs ring, archive index, archive body, **and** tape root, using existing `path_equals_or_nests` both directions (equality or nest either way). Evaluated **only** by the keep construct.
- `serve` opener for keep: `Ok(NotStoring)` if root unset/empty/unwritable; `Ok(RefuseToMix)` if the predicate is true; `Ok(Open)` if the dedicated root is writable and disjoint. **Never** `AppError::Config`. AppState construction succeeds. REST/WS/workers start. Files client is still not constructed on serve.
- Armed keep CLI: predicate true → refuse **before any GET**, no write, non-zero. Occupies none of those roots (no gzip, no extract, no sidecar under tape/archive/ring).
- Research list/load on `RefuseToMix`: operator route only; zero vendor I/O; reports the refuse-to-mix fact. Not a trader 5xx (`best-effort-isolated-or-null`).
- `NotStoring` remains unset/empty/unwritable only. Collision is a distinct type-level state.

Occupancy fact UX must consume: **mix refused; keep wrote nothing on tape/archive/ring; desk is up.** Not the not-storing fact. UX owns the line.

`production-fails-closed` restated: armed keep fails closed on collision / missing pair / unwritable root. Keep root is **not** a production serve prerequisite. Archive body remains the only production body-root prerequisite.

### 2. Credentials — classify before send, zero files GET

Honor `67b8aeeb…`. Three already-distinct classes, plus a fourth after GET:

| Type-level | When | Files GET count | Not |
| --- | --- | --- | --- |
| `MissingFilesCredentials` | access-key or secret unset/empty after trim | 0 | wrong-class, HTTP token miss, Miss, FetchFailed |
| `WrongCredentialClass` | this process has a non-empty live REST key **and** it equals the files access-key **or** the files secret | 0 | missing pair, HTTP token miss, Miss, FetchFailed |
| operator-token HTTP unauthorized | research GET without/wrong `METRICS_SECRET_TOKEN` when configured | 0 (no files client) | the two files-cred classes; vendor 401/403 |
| `FetchFailed` | files GET invoked: transport, timeout, 5xx, **401/403 after GET**, reset; no 404 | ≥1 (or bind-of-GET then transport fail) | Miss; the two pre-GET classes |

Mechanism:

- `infrastructure/flatfiles` credentials type is access-key + secret only. It cannot be built from `Config.massive_api_key`. Source scan on that leaf: identifiers `MASSIVE_API_KEY` / `massive_api_key` fail the build.
- Classification lives in the keep **service** leaf, **before** `reqwest` send:
  1. Empty pair → `MissingFilesCredentials`. Stop.
  2. Read live REST key from process env `MASSIVE_API_KEY` (or the Config field **before** any empty-key blanking) **for equality only**. Keep does **not** require it. Unset/empty REST env → skip equality (cannot prove substitution this run).
  3. Non-empty REST key equal to access-key or secret → `WrongCredentialClass`. Stop. REST key is never copied into the files client and never used as SigV4 material.
  4. Else SigV4 GET may run.
- Keep CLI empty-key pattern (score-lab / tape): REST **client** may be constructed with `massive_api_key: String::new()` so keep does not require REST. Do **not** `env::remove` `MASSIVE_API_KEY`. Classify reads the env the operator left. Attackable: if this process has no REST key in env, paste is unprovable and a later vendor 403 is `FetchFailed`, not wrong-class — honest, because we did not observe the REST key.
- Files GET counter increments only when the files client actually invokes send. Classify returns are 0.
- Research HTTP token miss stays the shipped operator-token gate. Not a files occupancy cell.

Occupancy facts UX must consume: **pair absent, zero files GET** vs **REST key observed in a files slot, zero files GET** vs **operator token miss on research HTTP**. UX owns literals. Do not print secrets. Do not print the REST-apiKey clause on a mere missing pair (`67b8aeeb…`).

### 3. Type-level → operator-visible facts (`present` banned)

Closed type-level occupancy (implementer enum; not stdout). Callers cannot collapse to `Option` / boolean. `present` is not a member.

Corpus grain `(et_date, class)`:

- `NotElapsed` — `now_et` before due line; no GET
- `Ineligible` — Sat/Sun ET; no GET
- `NotStoring` — root unset/empty/unwritable
- `RefuseToMix` — keep root collides; desk up
- `MissingFilesCredentials` / `WrongCredentialClass` — §2
- `FetchFailed` — GET without absence proof (includes 401/403 after GET)
- `Miss` — due ∧ 404 / no-such-key
- `Stored` — gzip on the dedicated root, magic + digest ok
- `Unreadable` — pointer/object exists; gzip/csv/header fails

Extract grain `(symbol, et_date, class)` given `Stored`:

- `ExtractRows` — ≥1 watchlist rows for that locked name
- `ExtractEmpty` — zero rows for that locked name

Facts UX must consume (not print tokens):

| Type-level | Fact |
| --- | --- |
| `Stored` ∧ `ExtractRows` | reconstructable extract exists for `(symbol, D, class)` |
| `ExtractEmpty` | vendor object obtained; this locked name has zero rows |
| `NotElapsed` | publish clock not reached |
| `Miss` | due and vendor absence confirmed |
| `Unreadable` | object/pointer exists; body not usable |
| `NotStoring` | dedicated root unset/empty/unwritable |
| `RefuseToMix` | mix refused; desk up |
| `MissingFilesCredentials` | files pair absent; zero files GET |
| `WrongCredentialClass` | live REST key in a files slot; zero files GET |
| `FetchFailed` | fetch unconfirmed; not a hole |
| `Ineligible` | weekend ET; no SIP session |

Banned on this vehicle as occupancy/success: `present`, `Stored` (the type name), `Unattempted` (the type name), `live`, `live_massive`, `Live tape`. Coverage `present` remains loadable `LiveMassive` on the other store.

`Stored` alone must not be treated as success: a zero-row symbol on a good gzip is `ExtractEmpty`. First-wins stays on successful **corpus** bytes; extract may rebuild locally from that corpus without network. Whether the universe gzip is retained is the pending product occupant lock (`8b39d0dd…` honored: I do not vouch a “full-universe keep” store fact here). Operator-visible occupant remains the locked-name extract.

### 4. 401/403 after GET is not Miss

Mechanism: classify the files HTTP outcome **after** send, on the dedicated client (no `apiKey` query):

- 404 or S3 no-such-key, and D is due → `Miss`
- 401 or 403 → `FetchFailed` (vendor rejected the request; object not proved absent)
- timeout / reset / 5xx / other non-404 without a fsynced rename → `FetchFailed`
- only a fully fsynced object is renamed into the locator; crash/403/truncation leaves temp, which classify does not treat as `Stored`

`FetchFailed` and `Miss` may retry. A later successful GET after `FetchFailed` is not filling a hole that was never a hole. A later successful GET after `Miss` is filling a proved absence.

Armed keep: `FetchFailed` / `Miss` / `Unreadable` / `NotStoring` / `RefuseToMix` / both pre-GET credential refuses → non-zero. No partial rename on any of them.

---

Out of this pair (named, not locked): inspect print of due + no local object + no GET; aggregates In/Out; universe gzip retention; whether research load ever returns a universe body (UX ask — occupant lock).
