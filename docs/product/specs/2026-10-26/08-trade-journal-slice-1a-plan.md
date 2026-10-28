# Trade journal, slice 1a: the build plan

_Plan for spec 08's slice 1a ("The notebook"), written 2026-10-28 by the plan lane, read-only on
code. The owner approved slices 1a to 3 with no model (spec 08, Owner answers, 13). The build
starts after the design boards land (another workflow is drawing them now; nothing under
`design/` is cited here as built). This plan changes no code; the build works from it._

**Sources.** The spec is `docs/product/specs/2026-10-26/08-trade-journal.md` at `52339683`.
Code citations are `file:line` at `adda4054` (HEAD while this was written). While it was written,
the other lanes of this workflow held uncommitted edits in `libs/api/src/lib/convexa.ts`,
`apps/dashboard/src/app/app.tsx`, `features/auth/{AuthContext,RequireAuth,SignInPrompt,copy,useGate}`,
`pages/positions/PositionsPage.tsx`, an untracked `features/auth/ownerGate.ts`, the OpenAPI
artifacts, `routes/contract.rs`, `routes/market.rs` and `tests/api_contract_runtime_auth_research.rs`.
Lines in those files will move; every other cited file was clean against `adda4054`.

**How to use it.** Section 1 says what 1a is. Sections 2 to 4 are the contract the build must
meet: the wire, the storage and the facts. Section 5 is the ordered steps, each with its files,
anchors, size and check. Section 6 is the tests owed and the observation probes. Section 7 is every
open choice with one recommendation, and every place the code contradicts the spec. Section 8 is
the landing order and the lane fences. Section 9 lists what only the owner can do.

---

## 1. Scope

### What 1a ships (the spec's words)

From the build plan's row 1a (spec, Build plan):

> **The notebook.** Migration `journal_core`. Owner-only routes (with the `PUT`/`DELETE` arms, the
> widened contract probe and the amended gate comments), the journal ring (`from_env_prefixed`, no
> ephemeral key) with row-bound AAD and the seal tag, and the JSON dev store on the same
> three-writer trait. The composer (text, kinds, About with `as_of`, margin-call mode, money in or
> out with its time, snapshot with carry-forward, source, sanity questions, the 9-digit warning,
> Keep out of AI reads). Seal, later notes, corrections, withdraw. The timeline (Written/About, ET
> dates, derived recalled), the entry page, the computed facts with their edge cases, the shared
> TypeScript facts module and its parity test, and the rail's account frame (value and figure
> strip). The first run with "What do you think your downfalls are?" saving to
> `journal_suspicions` through `GET/PUT /api/journal/suspicions` (G5). `SectionTabs` with Book ·
> Journal, the routes and walls, sign-out with an unsent entry. The demo transport with slice 1a's
> part of the seed. The /privacy rows and key, and the backup-retention check for the delete copy.
> Owed tests: money, parity, recalled and dates, boundary, writes.

From "What each slice shows", the 1a column:

| Surface | In 1a |
|---|---|
| Tab band | Book · Journal |
| Rail: account frame | value and figure strip |
| Rail: this week's focus, Rulebook mini, Review mini | not drawn |
| First run | "Write about an earlier day" · "What do you think your downfalls are?" |
| Composer kind chips | all but Plan a trade |
| Sale row, decision label | not drawn |
| Entry page panels | Snapshot (figures, correct a figure) |
| Rulebook tab, Review page, Settings › Journal, Tidy, Import | not drawn |
| Demo seed | entries, snapshots, money, notes, correction |

The 1a acceptance criteria are 1, 2, 3, 4, 6 (account facts), 7, 8, 9, 18, 19, 21, 22 (entries;
reviews in 3), 24, 25, 26, 27 and 34 (suspicions; the rule in 2).

The API is the 1a row of "API (by slice)": `GET/POST /api/journal/entries` ·
`GET /api/journal/entries/{id}` · `POST /api/journal/entries/{id}/notes` ·
`POST /api/journal/entries/{id}/corrections` · `DELETE /api/journal/entries/{id}` ·
`GET/PUT /api/journal/suspicions`. Eight operations.

### What 1a leaves to later slices

- **1b:** the account path (three multiples, event rail, twin, drawer), `RealPositionRows` and typed
  positions, leverage and loan to position value, position P/L, the sale row and R, his decision
  label, "Revisit due", export, restore, Delete journal, Settings › Journal, the ⌘K Write group, and
  the seed's trims, R and label. The `journal_details` table exists from 1a; 1b first writes it.
- **2:** the rulebook, Plan a trade (kind `plan` becomes writable), the projection, "One rule from
  today", the 409 `rule_limit` and the 422 `reason_required`.
- **3:** the parser, Tidy (with `recalled_span` corrections), detectors, the review's computed
  sections, focus, suspicions mapped to rows and edited in Settings, and "Reviews test these first."
- **4 and 5** (not approved for now): every model call, What's sent, reading on save, import.

---

## 2. The wire

### 2.1 Conventions (all eight operations)

| Thing | Rule |
|---|---|
| Owner gate | Every operation takes `OwnerUser` (`routes/auth.rs:1133-1141`) as its first extractor after `State`, before `Path` and the body, so a refused caller gets 403 before anything is parsed (the pattern at `routes/contract.rs:156-161`). Signed out or a forged cookie: 403 `auth_required`. Any other account, or `OWNER_EMAILS` unset: 403 `owner_only` (`config.rs:71-83`, `:226-229`). |
| OpenAPI | Each is listed in `OWNER_ONLY_OPERATIONS` (`routes/mod.rs:2275-2290`), so it is documented `session` with `x-convexa-access: owner` (`:2245-2263`). The 403 response carries the description used at `routes/contract.rs:58-62`. |
| Ids | `id` and `client_id` are lowercase hyphenated UUID v4 strings. The server mints `id`; the client mints `client_id` (`crypto.randomUUID()`). A `client_id` that is not lowercase v4 is 422. An `{id}` that is not a UUID answers 404, the same as an unknown id or another user's. The id's text is bound into the AAD, so it is canonical everywhere. |
| Instants | RFC 3339 UTC with exactly six fractional digits and `Z` (`2026-09-29T18:14:00.000000Z`), so string order is time order in both languages. `written_at` is truncated to whole microseconds before it is stored, sealed or returned (Postgres `timestamptz` holds microseconds). |
| ET | Dates are `YYYY-MM-DD` in America/New_York. Typed date-times travel as ET wall time, `YYYY-MM-DDTHH:MM` (what `<input type="datetime-local">` gives). The server converts them once, in the store, with `chrono_tz::America::New_York` (already used at `server.rs:166`). A wall time in the spring-forward gap is 422; one in the fall-back overlap takes the earlier instant. Responses carry the instant and its `*_et` wall time, so the browser never converts zones on input. |
| Money | Integer cents (`i64` / `number`), `0 ≤ cents ≤ 10^13`. Unsigned, because money inputs take plain decimals only (owner, 2026-10-16). |
| Ratios | Unrounded `f64` (JSON number). The browser rounds for display with the shared rule (section 4.3). |
| Facts | `{ state, cents }` or `{ state, ratio }`, where `state` is `value`, `not_recorded` or `dash` (`—`) and the number is null unless `state` is `value`. |
| Errors | The existing `WireError` `{ error, message }` (`openapi.rs:72-75`). `message` is a plain sentence that never echoes what he wrote. A body that fails to parse is 422 `validation` in JSON, through a `JournalJson<T>` extractor that wraps axum's rejection (axum's own is `text/plain`). |
| Idempotency | Create, notes and corrections carry `client_id`. A repeat returns **200** with what is already stored and writes nothing; a first write is **201**. The first write wins, whatever the repeat's payload. |

Closed error codes for the journal routes:

| Status | `error` | When |
|---|---|---|
| 403 | `auth_required`, `owner_only` | the owner gate |
| 404 | `not_found` | unknown id, malformed id, or another user's id |
| 409 | `entry_deleted` | a note or correction on a tombstone |
| 422 | `validation` | any rule in 2.4; the message names the field |
| 500 | `journal_unreadable` | a stored ciphertext fails to decrypt or authenticate |
| 503 | `storage_not_set_up` | no journal ring (writes, the single-entry read) |
| 503 | `store_unavailable` | Postgres or the dev file failed |

### 2.2 Operations

| # | Method and path | Request | Success | Errors | Rust handler (`routes/journal.rs`) |
|---|---|---|---|---|---|
| 1 | `GET /api/journal/entries` | none | 200 `JournalListBody` | 403, 500, 503 | `list_entries` |
| 2 | `POST /api/journal/entries` | `JournalEntryCreateBody` | 201 `JournalEntryBody` (new), 200 (repeat) | 403, 422, 500, 503 | `create_entry` |
| 3 | `GET /api/journal/entries/{id}` | none | 200 `JournalEntryBody` | 403, 404, 500, 503 | `get_entry` |
| 4 | `POST /api/journal/entries/{id}/notes` | `JournalNoteCreateBody` | 201 `JournalEntryBody` (the entry, with its new note), 200 (repeat) | 403, 404, 409, 422, 500, 503 | `add_note` |
| 5 | `POST /api/journal/entries/{id}/corrections` | `JournalCorrectionCreateBody` | 201 `JournalEntryBody` (facts recomputed), 200 (repeat) | 403, 404, 409, 422, 500, 503 | `add_correction` |
| 6 | `DELETE /api/journal/entries/{id}` | none | 200 `JournalEntryBody` (the tombstone; a repeat returns it again) | 403, 404, 503 | `withdraw_entry` |
| 7 | `GET /api/journal/suspicions` | none | 200 `JournalSuspicionsBody` | 403, 500, 503 | `get_suspicions` |
| 8 | `PUT /api/journal/suspicions` | `JournalSuspicionsPutBody` | 200 `JournalSuspicionsBody` | 403, 422, 500, 503 | `put_suspicions` |

`GET /api/journal/entries` with no ring answers **200** `{ storage: "not_set_up", entries: [] }`,
so the timeline can draw "Storage not set up"; `GET /api/journal/suspicions` likewise. Every write,
and the single-entry read, answers 503 `storage_not_set_up` and writes nothing.

Response enums (`IntoResponses`, one per row; rows 4 and 5 share one):
`JournalListResponse`, `JournalCreateResponse`, `JournalEntryResponse`, `JournalAppendResponse`,
`JournalDeleteResponse`, `JournalSuspicionsResponse`, `JournalSuspicionsWriteResponse`. As declared
above they are 44 status-and-media boundaries (4 + 6 + 5 + 8 + 8 + 4 + 4 + 5), all
`application/json`, all `session`.

### 2.3 Response bodies

`JournalListBody`
- `storage`: `JournalStorage` = `ready` | `not_set_up`
- `entries`: `JournalEntryBody[]`, ordered by `written_at` descending, then `id` descending. The
  browser re-sorts for About order.

`JournalEntryBody`
- `id`: string · `client_id`: string
- `kind`: `JournalKind` = `entered` | `added` | `trimmed` | `closed` | `margin_call` | `money` |
  `plan` | `thinking` | `imported` | `deleted` (the read enum is complete from 1a, because the 1a
  seed has 2 plan cards and 3 imported entries)
- `source`: `JournalEntrySource` = `typed` | `paste` | `split`, or null on a tombstone
- `written_at`: instant · `written_on`: ET date of `written_at`
- `about_date`: ET date or null, as written
- `effective_about_date`: ET date: the latest `about_date` correction, else `about_date`, else
  `written_on`
- `recalled`: boolean, derived on read (section 3.5)
- `body`: string, or null only on a tombstone · `body_chars`: integer (Unicode scalar values)
- `ai_excluded`: boolean · `confidence`: integer 0–100 or null · `wrong_if`: string or null
- `exit_price_cents`: integer or null · `no_exit_set`: boolean
- `closed_by`: `JournalClosedBy` = `me` | `broker_liquidation` | `expiry` | `assignment`, or null
- `revisit_on`: ET date or null · `deleted_at`: instant or null
- `snapshot`: `JournalSnapshotBody` or null · `money`: `JournalMoneyBody` or null
- `notes`: `JournalNoteBody[]` (by `written_at`) · `corrections`: `JournalCorrectionBody[]` (by
  `written_at`)

A tombstone is `kind: "deleted"` with `id`, `client_id`, `written_at`, `written_on` and
`deleted_at`; every other field is null, false, 0 or empty. (`client_id` stays so a late retry of
the same save finds the tombstone and writes nothing.)

`JournalSnapshotBody`
- `id`: string · `as_of`: instant (effective: the latest `as_of` correction, else as stored) ·
  `as_of_et`: ET wall time · `as_of_original`: instant, or null when never corrected
- `source`: `JournalSnapshotSource` = `broker_screen` | `statement` | `memory` | `import`
- `figures`: `JournalFiguresBody` with `account_value`, `cash`, `margin_loan`,
  `maintenance_requirement`, `buying_power`, `call_amount` (each `JournalFigureBody`) and `due_by`
  (`JournalDueByBody`)
- `facts`: `JournalAccountFactsBody` (section 4)

`JournalFigureBody`: `cents` (effective, after corrections; null when not recorded) ·
`provenance`: `JournalProvenance` = `typed` | `carried` | `not_recorded` · `carried_from`: snapshot
id or null · `original_cents`: the value before any correction.
`JournalDueByBody`: the same with `at` (instant) and `at_et` in place of `cents`, and `original_at`.

`JournalAccountFactsBody` (at this snapshot, over the whole corrected series)
- `in_chain`: boolean (false when this snapshot has no account value and is skipped)
- `margin_used`: ratio fact · `excess_liquidity`: cents fact
- `change`: `{ since_snapshot_id: string | null, cents: cents fact, ratio: ratio fact }`
- `index`: ratio fact (`I₀ = 1`) · `below_high`: ratio fact · `account_value_alone`: ratio fact
- `lost_since_high`: cents fact · `recorded_high_snapshot_id`: string or null
- `chain_break_snapshot_id`: the first snapshot at or before this one whose account value was
  $0 or below, or null

`JournalMoneyBody`: `id` · `direction`: `in` | `out` · `amount_cents` · `occurred_at` (instant) ·
`occurred_at_et`.

`JournalNoteBody`: `id` · `client_id` · `body` · `written_at` · `ai_context`: boolean.

`JournalCorrectionBody`: `id` · `client_id` · `target`: `{ kind: "snapshot_field" | "snapshot_as_of"
| "about_date", field: JournalSnapshotField | null }` · `value`: `{ cents: integer | null, at:
instant | null, at_et: string | null, date: string | null }` (exactly one set, by target) · `reason`
· `written_at` · `supersedes_id`: string or null. `JournalSnapshotField` = `account_value` | `cash`
| `margin_loan` | `maintenance_requirement` | `buying_power` | `call_amount` | `due_by`.

`JournalSuspicionsBody`: `storage` · `suspicions`: `{ id, text, created_at }[]` (active ones, in
the order he wrote them).

### 2.4 Request bodies and their 422 rules

`JournalEntryCreateBody`
- `client_id` (required, lowercase UUID v4)
- `kind`: `JournalWriteKind` = `entered` | `added` | `trimmed` | `closed` | `margin_call` | `money` |
  `thinking`. `plan` is refused until slice 2; `imported` and `deleted` are never written here.
- `body`: string, may be empty, at most 50,000 characters. The margin-call page's optional "One
  thing you want to remember from today" is appended to `body` by the composer, after a blank line
  (section 7, D24).
- `about_date`: ET date or null. Null means "Today": the server takes `written_on`, so an entry
  queued offline and sent after midnight is never marked recalled. A date after `written_on` is 422.
- `ai_excluded`: boolean, default false.
- `confidence`: integer 0–100 or null; only on `entered` and `added`.
- `wrong_if`: string or null, at most 2,000 characters · `exit_price_cents`: cents or null ·
  `no_exit_set`: boolean. An exit price with `no_exit_set: true` is 422. Not on `margin_call`.
- `closed_by`: `JournalClosedBy` or null; only on `trimmed` and `closed`.
- `revisit_on`: ET date or null; not before `written_on`.
- `snapshot`: `JournalSnapshotInputBody` or null.
- `money`: `JournalMoneyInputBody` or null; required on `money`, allowed on any kind (one per entry).
- An entry with a blank body, no snapshot and no money is 422.

`JournalSnapshotInputBody`
- `as_of_et`: ET wall time or null. Null takes the default: `written_at` when About is today, else
  4:00 PM ET on `about_date` (the composer shows it as "As of Aug 14, 4:00 PM · Change"). An
  `as_of` after `written_at` is 422.
- `source`: `broker_screen` | `statement` | `memory` (`import` arrives with slice 5).
- Six `JournalFigureInputBody` fields and `due_by`: each `{ provenance, cents | at_et,
  carried_from }`. `typed` needs a value; `carried` needs `carried_from` and no value; `not_recorded`
  needs neither.
- A `carried` figure names one of his snapshots, not deleted, whose effective `as_of` is at or
  before this one. The server copies that snapshot's effective value for the field at save time and
  seals the copy (section 7, D8). Anything else is 422.

`JournalMoneyInputBody`: `direction` · `amount_cents` (> 0) · `occurred_at_et` (null means
`written_at`; after `written_at` is 422).

`JournalNoteCreateBody`: `client_id` · `body` (not blank, at most 20,000 characters) ·
`ai_context`: boolean.

`JournalCorrectionCreateBody`: `client_id` · `target` · `value` · `reason` (not blank, at most
1,000 characters).
- A field target needs the entry to have a snapshot and a value of the field's kind (`cents` ≥ 0,
  or `at_et` for `due_by`). A `not recorded` figure can be corrected to a value.
- `snapshot_as_of` needs `at_et`, at or before the entry's `written_at`.
- `about_date` needs `date`, at or before the entry's `written_on`.
- The server sets `supersedes_id` to the previous correction of the same target. The effective
  value is the latest correction (by `written_at`, then `id`), else the original.

`JournalSuspicionsPutBody`: `lines`: string[], at most 5; each trimmed, not empty, at most 280
characters. It replaces the active set: current rows get `retired_at`, the new lines are inserted.
The same lines in the same order write nothing.

### 2.5 Rust and TypeScript types

Rust DTOs live in `apps/api/src/routes/journal.rs`, as `routes/broker.rs:16-79` keeps its own,
with `#[derive(Serialize|Deserialize, ToSchema)]` and `#[serde(rename_all = "snake_case")]` on the
enums; each is registered with `schema!` in `register_route_schemas` (`routes/mod.rs:1807-2076`;
the broker block at `:1849-1856` is the pattern). No property may be named `flip`, `gamma_flip`,
`call_wall`, `put_wall` or `net_gex` (the level walk at
`tests/api_contract_runtime_auth_research.rs:2098-2173` would then demand the owner tag for the
wrong reason).

TypeScript types come only from the generated `schema.ts`. The facade
`libs/api/src/lib/journal/api.ts` aliases them (`export type JournalEntry =
components['schemas']['JournalEntryBody']`) and imports `components` from `../convexa` (re-exported
at `convexa.ts:10`) and `http` from `../client`. That keeps it off both generated-import allowlists
(`tools/api-contract.mjs:45-49`, `libs/api/src/lib/contract-authority.spec.ts:13-17`), as the demo
transport already does (`demo/transport.ts:1-10`). It never calls `fetch` and never declares an
`interface` or `const` named after a generated component (`api-contract.mjs:1966-1972`).

Facade functions: `listJournal()`, `createJournalEntry(body)` → `{ entry, replayed }`,
`getJournalEntry(id)`, `addJournalNote(id, body)`, `addJournalCorrection(id, body)`,
`withdrawJournalEntry(id)`, `getJournalSuspicions()`, `putJournalSuspicions(lines)`. A 403 throws
the owner-gate `AuthError`; every other failure throws `ApiError` whose `code` is the journal's
`error` (read from `error`, because `codeOf` reads `code`, `convexa.ts:603-609`). `client.ts:22-28`
gains `path.startsWith('/api/journal')` in `requiresCredentials`.

### 2.6 The owner gate's changes

- `OWNER_ONLY_OPERATIONS` (`routes/mod.rs:2275-2290`) gains the eight rows.
- The tagging loop matches only `"GET"` and `"POST"` and panics on anything else
  (`routes/mod.rs:2253-2258`). It gains `"PUT" => item.put.as_mut()` and
  `"DELETE" => item.delete.as_mut()`. The security setter already handles both (`:2112-2122`).
- The doc comments on `OWNER_ONLY_OPERATIONS` (`routes/mod.rs:2266-2274`) and `OWNER_EMAILS`
  (`config.rs:71-82`) each gain one sentence: the gate also guards owner-personal data (the
  journal), which reaches the owner's account alone because it is his. Neither comment may lose
  what it says now. `docs/product/ai-analyst/DESIGN.md` is not touched (section 7, C2).
- The hermetic probe: `tools/api-contract.mjs:213` expects the owner 403 only for a `GET`, and every
  other owner-only write falls to the 422 rule at `:235`. It becomes "owner access → 403, any
  method", with one named exception, `POST /api/recommendation/{ticker}`, which parses its body
  before `require_owner` and keeps its 422. The Rust source-owned catalog repeats the GET-only rule
  (`tests/api_contract_parity.rs:702-707`) and takes the same change.

---

## 3. Storage

### 3.1 The `journal_core` migration

Appended to `MIGRATIONS_RAW` (`apps/api/src/db/migrations.rs:11-329`; the last entry is 13,
`session_day_tape`, at `:310-328`) as the next free version at build time: 14 at `adda4054`
(section 7, D2). `postgres-migrate` applies it before deploy (`railway.json` `preDeployCommand`);
`serve` never migrates (`migrations.rs:3`). Every table is keyed by `user_id`, which references
`users(id)` (TEXT, `migrations.rs:16-25`).

```sql
-- journal_core (spec 08, slice 1a). Every *_ct column holds an AES-256-GCM envelope whose AAD names
-- the user, the table, the row and the column (services/journal/crypto.rs). The plaintext columns are
-- ids, kinds, dates, flags and counts (spec 08, Data and privacy → Tables).
CREATE TABLE IF NOT EXISTS journal_entries (
    id                UUID PRIMARY KEY,
    user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id         UUID NOT NULL,
    kind              TEXT NOT NULL CHECK (kind IN ('entered','added','trimmed','closed',
                          'margin_call','money','plan','thinking','imported','deleted')),
    source            TEXT CHECK (source IN ('typed','paste','split')),
    body_ct           TEXT,
    body_chars        INTEGER NOT NULL DEFAULT 0 CHECK (body_chars >= 0),
    written_at        TIMESTAMPTZ NOT NULL,
    about_date        DATE,
    confidence_ct     TEXT,
    wrong_if_ct       TEXT,
    exit_price_ct     TEXT,
    no_exit_set       BOOLEAN NOT NULL DEFAULT FALSE,
    closed_by_ct      TEXT,
    revisit_on        DATE,
    decision_label_ct TEXT,
    ai_excluded       BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMPTZ,
    seal_tag          TEXT,
    schema_version    INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT journal_entries_client UNIQUE (user_id, client_id),
    CONSTRAINT journal_entries_deleted_iff CHECK ((kind = 'deleted') = (deleted_at IS NOT NULL)),
    CONSTRAINT journal_entries_live_sealed CHECK (kind = 'deleted'
        OR (body_ct IS NOT NULL AND seal_tag IS NOT NULL AND source IS NOT NULL)),
    CONSTRAINT journal_entries_tombstone_empty CHECK (kind <> 'deleted' OR (
        body_ct IS NULL AND confidence_ct IS NULL AND wrong_if_ct IS NULL AND exit_price_ct IS NULL
        AND closed_by_ct IS NULL AND decision_label_ct IS NULL AND seal_tag IS NULL
        AND source IS NULL AND about_date IS NULL AND revisit_on IS NULL AND body_chars = 0))
);
CREATE INDEX IF NOT EXISTS journal_entries_user_written_idx
    ON journal_entries (user_id, written_at DESC);

-- The seal in the database itself: only a tombstone may change a row, once.
CREATE OR REPLACE FUNCTION journal_entries_sealed() RETURNS trigger LANGUAGE plpgsql AS $seal$
BEGIN
    IF OLD.kind = 'deleted' OR NEW.kind <> 'deleted'
       OR NEW.id <> OLD.id OR NEW.user_id <> OLD.user_id OR NEW.client_id <> OLD.client_id
       OR NEW.written_at <> OLD.written_at THEN
        RAISE EXCEPTION 'journal_entries is sealed: only a tombstone may change a row';
    END IF;
    RETURN NEW;
END
$seal$;
DROP TRIGGER IF EXISTS journal_entries_sealed ON journal_entries;
CREATE TRIGGER journal_entries_sealed BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION journal_entries_sealed();

CREATE TABLE IF NOT EXISTS journal_snapshots (
    id         UUID PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entry_id   UUID NOT NULL UNIQUE REFERENCES journal_entries(id) ON DELETE CASCADE,
    as_of      TIMESTAMPTZ NOT NULL,
    source     TEXT NOT NULL CHECK (source IN ('statement','broker_screen','memory','import')),
    figures_ct TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS journal_snapshots_user_as_of_idx ON journal_snapshots (user_id, as_of);

CREATE TABLE IF NOT EXISTS journal_money (
    id          UUID PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entry_id    UUID NOT NULL UNIQUE REFERENCES journal_entries(id) ON DELETE CASCADE,
    direction   TEXT NOT NULL CHECK (direction IN ('in','out')),
    amount_ct   TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS journal_money_user_occurred_idx ON journal_money (user_id, occurred_at);

CREATE TABLE IF NOT EXISTS journal_later_notes (
    id         UUID PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entry_id   UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    client_id  UUID NOT NULL,
    body_ct    TEXT NOT NULL,
    written_at TIMESTAMPTZ NOT NULL,
    ai_context BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT journal_later_notes_client UNIQUE (user_id, client_id)
);
CREATE INDEX IF NOT EXISTS journal_later_notes_entry_idx ON journal_later_notes (entry_id);

CREATE TABLE IF NOT EXISTS journal_corrections (
    id            UUID PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entry_id      UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    client_id     UUID NOT NULL,
    target        TEXT NOT NULL CHECK (target IN ('snapshot.account_value','snapshot.cash',
                      'snapshot.margin_loan','snapshot.maintenance_requirement',
                      'snapshot.buying_power','snapshot.call_amount','snapshot.due_by',
                      'snapshot.as_of','about_date','recalled_span')),
    span_start    INTEGER,
    span_end      INTEGER,
    value_ct      TEXT,
    reason_ct     TEXT NOT NULL,
    written_at    TIMESTAMPTZ NOT NULL,
    supersedes_id UUID REFERENCES journal_corrections(id),
    CONSTRAINT journal_corrections_client UNIQUE (user_id, client_id),
    CONSTRAINT journal_corrections_span CHECK ((target = 'recalled_span')
        = (span_start IS NOT NULL AND span_end IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS journal_corrections_entry_idx ON journal_corrections (entry_id);

-- Created in 1a, first written in 1b (the typed sale), by the parser in 3 and the AI in 4.
CREATE TABLE IF NOT EXISTS journal_details (
    id            UUID PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entry_id      UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    field         TEXT NOT NULL,
    value_ct      TEXT NOT NULL,
    span_start    INTEGER,
    span_end      INTEGER,
    origin        TEXT NOT NULL CHECK (origin IN ('parser','ai','typed')),
    run_id        UUID,
    status        TEXT NOT NULL CHECK (status IN ('proposed','kept','fixed','rejected')),
    decided_at    TIMESTAMPTZ,
    supersedes_id UUID REFERENCES journal_details(id)
);
CREATE INDEX IF NOT EXISTS journal_details_entry_idx ON journal_details (entry_id);

CREATE TABLE IF NOT EXISTS journal_suspicions (
    id           UUID PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text_ct      TEXT NOT NULL,
    detector_key TEXT,
    created_at   TIMESTAMPTZ NOT NULL,
    retired_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS journal_suspicions_active_idx
    ON journal_suspicions (user_id) WHERE retired_at IS NULL;
```

Notes on the DDL:
- `figures_ct` holds the JSON `{ "figures": {...}, "positions": [] }` with `schema_version` 1.
  1a always writes `positions: []`; 1b fills it with `RealLeg[]`, so no data migration follows.
- The splitter keeps `$seal$` bodies whole (`migrations.rs:677-699` tests `$body$`). This is the
  schema's first plpgsql function.
- `schema_verifier.rs:65-81` gains one `LIMIT 0` probe per table (the spec does not mention the
  verifier; section 7, C6).
- A version pin test in the file's own pattern (`migrations.rs:709-808`) asserts the name, the
  version, `UNIQUE (user_id, client_id)` and the trigger.
- `journal_rules`, `journal_review` and `journal_ai` come with slices 2, 3 and 4. `journal_review`
  adds `prompt` and `rule_check_id` to `journal_later_notes`.

### 3.2 The store: exactly insert, append and tombstone

`apps/api/src/services/journal/store.rs` defines the trait. The store never sees plaintext: the
service seals every `_ct` value before it calls a writer, and opens it after a reader returns.

```rust
/// The journal's sealed store (spec 08, Tables: "Sealed, with one permitted mutation"). These three
/// are its only writers; nothing else writes `journal_entries`.
pub trait JournalStore {
    fn insert(&self, row: SealedEntryRow) -> impl Future<Output = Result<Inserted, StoreError>> + Send;
    fn append(&self, row: AppendRow) -> impl Future<Output = Result<Appended, StoreError>> + Send;
    fn tombstone(&self, user_id: &str, id: &JournalId)
        -> impl Future<Output = Result<Tombstoned, StoreError>> + Send;
    fn list(&self, user_id: &str) -> impl Future<Output = Result<Vec<StoredEntry>, StoreError>> + Send;
    fn get(&self, user_id: &str, id: &JournalId)
        -> impl Future<Output = Result<Option<StoredEntry>, StoreError>> + Send;
}
pub enum AppendRow { Note(SealedNoteRow), Correction(SealedCorrectionRow) } // later slices add rows
pub enum Inserted { New(StoredEntry), Replayed(StoredEntry) }
```

- **`insert`** writes the entry, its snapshot and its money in one transaction.
  `ON CONFLICT (user_id, client_id) DO NOTHING`, then it reads the stored row back as `Replayed`. It
  can never change an existing row.
- **`append`** writes a child row of an entry that is not a tombstone (409 `entry_deleted`
  otherwise), with the same `client_id` replay rule. It never writes `journal_entries`.
- **`tombstone`** takes only the user and the id, so no body can pass through it. In one
  transaction it deletes the entry's snapshot, money, notes, corrections and details, then sets
  `kind = 'deleted'`, `deleted_at = now`, every `_ct` column, `seal_tag`, `source`, `about_date` and
  `revisit_on` to null, and `body_chars` to 0. The row keeps `id`, `user_id`, `client_id`,
  `written_at`, `deleted_at` and `kind` (spec: "keeps only id, written_at, deleted_at and kind
  deleted"; `user_id` and `client_id` are keys, not content). A second call returns the same
  tombstone and writes nothing.
- **Suspicions** go through a second trait, `SuspicionStore` (`active`, `replace_active`), so
  `JournalStore` keeps exactly three writers. That is the reading of criterion 2 this plan
  recommends (section 7, D4). The rule binds `journal_entries`; `journal_suspicions.retired_at` is
  not on a sealed table.

Implementations, behind an enum like `AuthStore` (`services/auth/store.rs:590-611`):
- **`JsonJournalStore`** in `store.rs`: a `Mutex` over a serde struct, written to
  `data/journal.json` with the temp-file-and-rename of `JsonAuthStore::persist_locked`
  (`store.rs:172-186`), except that a failed write returns `StoreError::Unavailable` and restores the
  in-memory state. The auth store swallows that error; the journal must not lose an entry silently.
  It holds the same envelopes Postgres holds. `open_memory()` serves the hermetic tests.
- **`PgJournalStore`** in `apps/api/src/db/pg_journal.rs` (`#[cfg(feature = "postgres")]`), the
  placement of `db/pg_auth.rs`. Async sqlx calls, no `block_in_place` (`pg_auth.rs:21-29` uses it,
  and it panics on the current-thread runtime of `#[tokio::test]`). UUIDs bind as text with
  `$n::uuid` and read as `id::text` (no sqlx `uuid` feature, `Cargo.toml:48`).
- **Selection** in `AppState::construct` follows the auth store (`state.rs:537-544`): Postgres when
  the pool is up, else the JSON file at the new `Config::journal_store_path` (env
  `JOURNAL_STORE_PATH`, default `data/journal.json`, the pattern of `config.rs:473-475`).
  `AppState` (`state.rs:266-315`) gains `journal: JournalService`, and all four constructors set it
  (`state.rs:413`, `:758`, `:833`, `:946`). The test constructors give it a memory store and no ring;
  a test that needs writes injects a ring.

### 3.3 Encryption, the seal and the ring

**The ring.** `services/auth/crypto.rs` gains:
- `EncryptionKeyRing::from_values(active: Option<&str>, keys_json: Option<&str>) -> Option<Self>`:
  the pure parse `from_env` does today (`crypto.rs:94-109`), with `legacy: None`.
- `from_env_prefixed(prefix)`: reads only `{prefix}_ACTIVE_KEY_ID` and `{prefix}_KEYS_JSON` and calls
  `from_values`. It returns `None` when either is missing or malformed, and has no legacy key and
  no ephemeral fallback.
- `from_env()` becomes `from_env_prefixed("AI_KEY_ENCRYPTION")` plus its legacy key
  (`crypto.rs:110-117`), unchanged in behaviour. The existing tests (`crypto.rs:251-319`) and the
  rewrap tests (`services/auth/service.rs:1434-1540`) must still pass unchanged.
- `encrypt_with_aad(&self, plaintext, context)` and `decrypt_with_aad(&self, envelope, context)`.
  The envelope stays `v1.{key_id}.{nonce}.{ct}` (`:143-148`); the AAD is `{context}|{key_id}`, with
  the key id taken from the envelope on decrypt. `decrypt_with_aad` accepts only the four-part `v1`
  form and has no legacy branch (`:185-198` stays on `decrypt` only).

The journal's ring is `JOURNAL_ENCRYPTION_ACTIVE_KEY_ID` and `JOURNAL_ENCRYPTION_KEYS_JSON`: a JSON
object of key id → 32-byte URL-safe base64 without padding (`URL_SAFE_NO_PAD`, `crypto.rs:103-106`).
The spec's dev key, `openssl rand -base64 32 | tr '+/' '-_' | tr -d '='`, makes exactly that.

**`JournalCrypto`** (`apps/api/src/services/journal/crypto.rs`) owns the ring:
- `from_env()` = `from_env_prefixed("JOURNAL_ENCRYPTION")`, and refuses (None) a ring whose active
  id is missing from its own map, or that shares a key with the AI-key ring. `from_env` returns a
  ring in the first case today and only fails on each encrypt (`crypto.rs:118-122`, `:126-129`); the
  journal must say "Not set up" at boot instead. The second is the spec's reason for a separate
  ring, enforced.
- At boot it logs one line: `journal storage: ready (n keys)` or `journal storage: not set up
  (reason)`, never key material. The journal ring is not added to the production startup
  guardrails (`server.rs:174-196`), so a missing journal key can never stop the site; the journal
  fails closed on its own.
- **AAD context:** `journal.v1|{user_id}|{table}|{row_id}|{column}`. The ring appends `|{key_id}`,
  which gives the spec's `journal.v1|{user_id}|{table}|{row_id}|{column}|{key_id}`. User ids are
  32 hex characters (`store.rs:214-219`), row ids canonical UUIDs, and tables and columns
  compile-time constants, so no part can hold a `|`; a debug assertion pins it.
- **The seal tag** (`journal_entries.seal_tag`): `v1.{key_id}.{base64url(HMAC-SHA256(seal_key,
  message))}`, where `seal_key = HMAC-SHA256(ring.keys[key_id], "convexa.journal.seal.v1")` and
  `message` is the canonical JSON array `["journal.seal.v1", user_id, id, written_at, kind,
  about_date, sha256_hex(body), sha256_hex(sealed snapshot and money JSON, or "")]`. HMAC uses
  `hmac 0.13` and `sha2 0.11`, already direct dependencies (`Cargo.toml:34`, `:44`), as
  `services/auth/cookies.rs:5`, `:32` does. The tag names its key, so a restore in 1b verifies it
  after a rotation. `about_date` and the snapshot hash extend the spec's list (section 7, D9).
- The journal never calls the module-level `encrypt` and `decrypt` (`crypto.rs:202-249`), which fall
  back to an ephemeral per-process key.

**No key, no writes.** With no ring, every write answers 503 `storage_not_set_up` and nothing is
written; the list answers `storage: "not_set_up"`. The journal never writes plaintext, and never
writes under a key that dies with the process.

**Key rotation.** Add a key id to `JOURNAL_ENCRYPTION_KEYS_JSON` and point
`JOURNAL_ENCRYPTION_ACTIVE_KEY_ID` at it. New rows use it; old rows still decrypt under the key
their envelope names. A retired key stays in the map for as long as any row uses it; removing it
makes those rows unreadable (500 `journal_unreadable`, "Couldn't load"). Unlike the AI-key ring,
the journal never re-encrypts on read: that rewrap writes ciphertext back
(`services/auth/service.rs:300`), and a sealed row has no writer for it. Re-encrypting old rows
after a compromised key would need a tool of its own, outside the three writers (section 7, C4).

**Unreadable rows.** If any stored envelope fails to decrypt or authenticate, the read answers 500
`journal_unreadable` and logs `journal.decrypt_failed` with the table, row, column and failure kind
(`CryptoFailure::as_str`, `crypto.rs:72-82`), never content. `DELETE` still works, because a
tombstone needs no decryption.

**Logs.** `journal.*` lines carry ids, sizes and timings only, and no handler logs a request body.

### 3.4 What stays plaintext

As the Tables section draws it: ids, `user_id`, `client_id`, `kind`, `source`, `written_at`,
`about_date`, `revisit_on`, `body_chars`, `no_exit_set`, `ai_excluded`, `deleted_at`,
`schema_version`; a snapshot's `as_of` and `source`; money's `direction` and `occurred_at`; a
correction's `target` and spans; a detail's `field`, spans, `origin`, `status` and dates; and the
suspicion dates. Everything else is a `_ct` envelope: the body, the figures, the amounts, the
confidence, the exit price, "Closed by", the decision label, his reasons, notes and suspicions
(section 7, C8).

### 3.5 Dates and recalled, derived in the store

Pure functions in `store.rs`, where the spec puts them ("one function in
`services/journal/store.rs` decides it on every read"):
- `et_date(instant)` and `et_wall(instant)`; `parse_et_wall(text)` (gap → error, overlap → earlier).
- `default_as_of(written_at, about_date)`: `written_at` when About is today, else 4:00 PM ET on the
  date.
- `effective_about_date(about_date, corrections, written_on)`.
- `is_recalled(kind, written_on, effective_about_date)`: true when the kind is `imported`, or the
  effective About date is before `written_on`. Saved at 9:30 PM ET on Sep 29 (01:30Z on Sep 30)
  about Sep 29 is at the time; 12:30 AM ET on Sep 30 about Sep 29 is recalled (criterion 27).
- An About-date correction never moves a snapshot's `as_of`; only an `as_of` correction does.

---

## 4. Computed facts in 1a

1a computes the account-level facts only. Leg facts (position value and share, leverage, loan to
position value, P/L), R, where the money went and the computed rule checks come with 1b and 3.

### 4.1 Inputs and order

- **Snapshots:** every non-deleted entry's snapshot, with corrections applied: the effective
  `as_of`, account value, margin loan and maintenance requirement, in integer cents.
- **Order:** by effective `as_of`, then the entry's `written_at`, then the snapshot id. So a
  statement for Aug 4 written on Aug 21 sorts at Aug 4.
- **Flows:** every non-deleted entry's money, `+amount` in and `−amount` out, at `occurred_at`.
- **Valued snapshots** are those with an account value. The others are skipped by the index, the
  high and the change, and their facts read `not recorded`.
- **Step flows:** `Fₖ` is the sum of the flows with `occurred_at` after the previous valued
  snapshot's `as_of` and at or before this one's. Flows at or before the first valued snapshot
  precede `I₀` and are not counted. Flows after the latest snapshot wait for the next one. So money
  across a skipped snapshot lands in the next valued step, as the spec's bridging rule says.

### 4.2 Each fact

| Fact | Formula (cents in, f64 out) | `not recorded` | `—` (dash) |
|---|---|---|---|
| Margin used | `loan ÷ V` | loan or V missing | V ≤ 0, or past a chain break |
| Excess liquidity | `V − maint` (cents) | V or maintenance missing | never; dollars carry on past a break |
| Change, dollars | `Vₖ − Vₖ₋₁ − Fₖ` | first valued snapshot, or V missing | never |
| Change, percent | `(Vₖ − Fₖ) ÷ Vₖ₋₁ − 1` | as dollars | `Vₖ₋₁ ≤ 0`, or past a break |
| Chain-linked index | `I₀ = 1`; `Iₖ = Iₖ₋₁ × stepₖ` | V missing | at and past a break |
| Recorded high | the valued snapshot with the highest index so far; a tie keeps the earlier | none yet | — |
| Below the high | `Iₖ ÷ I_high − 1` | V missing | at and past a break |
| Account value alone | `Vₖ ÷ V_high − 1` | V missing | at and past a break |
| Lost since the high | `V_high − Vₖ + Σ flows in (high.as_of, this.as_of]` (cents) | V missing | never |

Evaluation order, the same in both copies, so the two produce identical `f64` bits: subtract in
integers first, convert once, divide once, multiply once. That is
`step = ((V − F) as f64) / (V_prev as f64)` and then `I = I_prev * step`. The spec's
`Iₖ₋₁ × (Vₖ − Fₖ) ÷ Vₖ₋₁`, read left to right, would round differently. Cents stay exact in
`f64` up to 2⁵³.

**The chain break.** From the first valued snapshot whose account value is $0 or below, every
percent fact reads `—` (margin used, the change percent, the index, below the high, account value
alone), and `chain_break_snapshot_id` names it, so the page can say "Account value reached $0 or
below on {date}, so a percent can't be chained past it. The dollars still add up." Dollar facts
carry on. As written, the spec puts margin used on a later positive snapshot under the break too;
this plan follows the spec. Typed figures are unsigned, so only $0 reaches this branch by typing
(section 7, C12).

### 4.3 Display rounding

Half away from zero, with a guard for decimal halves that binary floats store just under:

```
round_half_away(x, d) = sign(x) × floor(|x| × 10^d + 0.5 + 1e-9) ÷ 10^d
```

Whole percent for margin used; one decimal for below the high, account value alone and the change
percent. Edges: −24.85 → −24.9, −42.6056 → −42.6, −0.25 → −0.3 (R's edge in 1b), 0.5 → 1,
−0.5 → −1, and 14.96 at two decimals stays 14.96. Without the guard, −24.85 rounds to −24.8,
because `−24.85 × 10` is −248.49999999999997 in binary. Rust holds the function for its tests and
for slice 4's number check; the browser rounds every displayed fact with the TypeScript copy.

### 4.4 Rust first: `apps/api/src/services/journal/facts.rs`

```rust
pub struct FactSnapshot { pub id: String, pub as_of: DateTime<Utc>, pub written_at: DateTime<Utc>,
    pub account_value: Option<i64>, pub margin_loan: Option<i64>, pub maintenance: Option<i64> }
pub struct FactFlow { pub occurred_at: DateTime<Utc>, pub net_cents: i64 }
pub fn account_facts(snapshots: &[FactSnapshot], flows: &[FactFlow]) -> BTreeMap<String, SnapshotFacts>;
pub fn round_half_away(x: f64, decimals: u32) -> f64;
```

Pure, with no I/O and no clock. The service builds the inputs from decrypted, corrected rows and
maps `SnapshotFacts` onto `JournalAccountFactsBody`.

### 4.5 The pinned TypeScript copy: `libs/api/src/lib/journal/facts.ts`

The same two functions with the same inputs. Instants compare as their canonical strings, so the
TypeScript copy does no time-zone work. It adds two browser-only helpers the server never needs:
- `sanityMove(prevCents, nextCents)`: `{ direction, ratio }` when `|next − prev| ÷ prev > 0.40`
  ("This is {90}% below your {Sep 25} snapshot ({$36,146}). Keep it?"), else null. No question when
  the previous value is missing or 0.
- `crossCheck(callCents, excessLiquidity)`: `match` when `|excess + call| ≤ 100` cents ("…That
  matches the call."), `mismatch` otherwise, null when either is missing.

The projection belongs to Plan a trade and comes with slice 2 (section 7, D26).

**The shared fixture.** `apps/api/tests/fixtures/journal/worked-example.json`, synthetic and
flagged `"illustrative": true`, holds named cases:
- `worked_example`: the spec's 12 snapshots, with the Sep 29 snapshot at 2:14 PM ET, the Sep 30
  snapshot at 3:40 PM ET, the $2,500 in at 10:05 AM ET on Sep 30, the others at 4:00 PM ET, and the
  Aug 4 statement written on Aug 21.
- Edge cases: `missing_value_bridged`, `zero_value_breaks_chain`, `deposit_last_step_before`,
  `deposit_last_step_after_previous`, `no_deposit_baseline` (criterion 7), `recalled_high` and
  `high_tie`.
- `rounding_edges`.
- Per case, `expect_display` holds the spec's own figures ("23%", "−42.6%", $22,142, −$2,750,
  +$1,121), and `expect_exact` holds the unrounded values.

The Rust test asserts that `facts.rs` reproduces both. When a formula changes on purpose, its
output becomes the new `expect_exact`. The TypeScript test, `libs/api/src/lib/journal/facts.spec.ts`,
asserts the same two blocks with `===`. Both copies are pinned to one fixture, so neither can drift
unnoticed. JSON numbers written by `serde_json` (shortest round-trip) parse back to the same `f64`
in JavaScript.

### 4.6 Checked by script before writing this plan

`tmp/parallel-2026-10-28/plan/facts_check.py` (scratch, gitignored) recomputed the worked example
with the formulas, order and rounding above. It exited 0: all 12 snapshots match the spec's margin
used and below the high, and every account-value-alone cell the spec fills; lost since the high at
Oct 6 is $22,142; excess liquidity is −$2,750 on Sep 29 and +$1,121 on Sep 30; the Oct 6 unrounded
series is −42.6056%; the rail's "Since Oct 2: −$2,994 (−8.7%)" and the composer's "Since Sep 25
−$2,099 (−5.8%)" both reproduce. A mutant that leaves the deposit in the step
(`step = V ÷ V_prev`) fails the Sep 30, Oct 2 and Oct 6 rows and shows −38.3% for −42.6% (exit 1).
The one mismatch is in the spec itself: its Aug 4 "Account value alone" cell reads "—", while the
formula gives 0.0% (section 7, C9).

---

## 5. Steps

Backend first. Every step names its files, the anchor it follows, its size and its check. Checks
read exit codes. `NX_DAEMON=false` on every Nx command, and one heavy command (cargo, Nx, the
contract tool) at a time. `npx nx test @convexa/api` and `npx nx typecheck @convexa/api` run the
uncached contract check first (`libs/api/package.json` `dependsOn`), which runs cargo.

### Backend

**B1. The ring's prefixed constructor and the AAD functions.** S.
- Files: `apps/api/src/services/auth/crypto.rs`.
- Follows `from_env` and `encrypt`/`decrypt` (`crypto.rs:93-199`).
- Tests (T12): `from_values` and `from_env_prefixed` return None when either variable is missing,
  on malformed JSON and on a 31-byte key, and never pick up a legacy or ephemeral key; an AAD
  round trip; and a wrong context fails with `Authentication`.
- Env tests use a unique prefix per test, so tests running in parallel never race on the process
  environment.
- Check: `cargo test -p api-rust --lib services::auth::crypto` exits 0, and so do the rewrap tests
  in `services::auth::service`. Mutation: make `from_env_prefixed` fall back to the module's
  ephemeral key, and one test goes red.

**B2. Migration `journal_core` and the verifier probes.** S.
- Files: `apps/api/src/db/migrations.rs` (the entry and a pin test), `apps/api/src/db/schema_verifier.rs`.
- Follows `migrations.rs:310-328` and its pin tests (`:709-808`).
- Check: `cargo test -p api-rust --lib db::migrations` exits 0. Then create a disposable database
  under `TEST_DATABASE_URL` and run the real `postgres-migrate` on it twice: both exit 0, the second
  is a no-op, and `psql -c '\d journal_entries'` shows the trigger and the constraints (the pattern
  of `tests/chain_snapshot_export_postgres.rs:15-60`). Postgres listens on `:5432` locally; never
  point it at a shared database.

**B3. The journal service: facts, crypto, store and the Postgres store.** L. Two commits are fine;
no route exists yet, so the contract does not move.
- Files (new): `apps/api/src/services/journal/{mod,facts,crypto,store}.rs`,
  `apps/api/src/db/pg_journal.rs`, `apps/api/tests/fixtures/journal/worked-example.json`,
  `apps/api/tests/journal_store_postgres.rs`.
- Files (edited): `apps/api/src/services/mod.rs` (`pub mod journal;`), `apps/api/src/db/mod.rs`
  (the module, beside `pg_auth` at `:22-23`), `apps/api/src/config.rs` (`journal_store_path`),
  `apps/api/src/state.rs` (the `journal` field and its four constructors).
- `mod.rs` holds `JournalService`. It validates (2.4), resolves carried figures, mints ids and
  `written_at` from an injectable clock, seals, calls the store, opens, derives recalled and the
  facts, and returns domain values for the routes.
- Follows `services/auth/store.rs:590-611` (enum dispatch), `:136-186` (the JSON file), and
  `db/pg_auth.rs` (placement), without its `block_in_place`.
- Tests: T1 to T11, T13 to T16.
- Check: `cargo test -p api-rust --lib services::journal` exits 0. Then
  `TEST_DATABASE_URL=… cargo test -p api-rust --features postgres --test journal_store_postgres`
  exits 0; that test never skips (the house rule at
  `tests/postgres_release_safety_postgres.rs:3`, `:20-21`). Each owed test is broken once on
  purpose and seen red (section 6).

**B4. The routes and the contract, in one commit.** L. Routes without regenerated artifacts would
fail the contract check, and PROJECT_CONTEXT's `[route-growth-repins-api-artifact-oracle]`
(`PROJECT_CONTEXT.md:538-545`) wants the re-pin in the same commit.
1. `apps/api/src/routes/journal.rs` (new): DTOs, the response enums and their `IntoResponse`, the
   `JournalJson<T>` extractor, the eight handlers with `#[utoipa::path(...)]` and
   `operation_id = "journal_*"`, and `contract_representative_response(boundary_id)` covering all
   44 boundaries. The 403 representative uses `contract_owner_refusal()` (`routes/auth.rs:1123-1126`,
   as `routes/candidates.rs:152`). Follows `routes/broker.rs:82-201`.
2. `apps/api/src/routes/mod.rs`:
   - `mod journal;` beside the others (`:6-26`);
   - eight `add!(journal::…, journal::__path_…)` (`:49-59`; the book pair at `:109-110` and the
     broker credential trio at `:159-161` are the pattern);
   - the `/api/journal` arm in `response_conversion_registry` (`:254-346`) and in
     `response_conversion_registry_source_target` (`:370-430`);
   - 44 rows in `RESPONSE_CONVERSION_SOURCES` (`:434-1787`; the broker rows at `:964-1017` are the
     shape);
   - the `schema!` rows (`:1817-2067`);
   - `OWNER_ONLY_OPERATIONS`, its doc comment and the `PUT` and `DELETE` arms (2.6).
3. `apps/api/src/config.rs:71-82`: the `OWNER_EMAILS` doc sentence.
4. `tools/api-contract.mjs`:
   - the owner probe rule at `:213` (2.6);
   - the baseline count `60` at `:571-572` becomes 68;
   - `validateRegistrationPairs(…, expectedCount = 60)` at `:2055` becomes 68;
   - `sourceRegistryTarget` (`:1322-1365`, which returns `null` for an unknown path) gains
     `/api/journal` → `apps/api/src/routes/journal.rs::contract_representative_response`;
   - the two never-called tables `routeSourceModule` and `routeResponseType` (`:1249-1321`) gain
     their rows for consistency, as `3d6a9c80` did.
5. `apps/api/openapi/precutover-operation-baseline.json`: the eight operations hand-appended and
   `capture.operation_count` set to 68, "as 52 → 57 → 60 was" (`3d6a9c80`). `candidate()` refuses
   any operation set that differs from this file (`api-contract.mjs:1984-1992`).
6. Tests, edited:
   - `tests/api_contract_parity.rs`: `concrete_path` (`:20-24`) replaces `{id}` with
     `00000000-0000-4000-8000-000000000000`; the owner rule at `:702-707`; `227` at `:429` becomes
     227 plus the new boundaries (271 if the declared responses are exactly 2.2's); evidence tests
     `boundary_evidence_227…` after `:685`; `observed == 60` at `:1026` becomes 68.
   - `tests/api_contract_router.rs:32`, `:64-65`: 60/60/61 become 68/68/69.
   - `tests/api_contract_runtime_auth_research.rs`: `owner_gate_requests()` (`:1664-1728`) gains
     the eight operations with per-request bodies, an expected owner status (201 for a new create,
     200 otherwise) and the seeded entry's id. `owner_gate_call` (`:1739-1823`) sends the given body
     for POST and PUT, instead of the fixed one at `:1750-1755`. `owner_gate_router` (`:1591-1661`)
     injects a journal ring. The owner's entry is seeded after the owner signs up, and DELETE runs
     last.
   - `tests/journal_routes.rs` (new, T17).
7. Run `npm run api:contract:generate`. It rewrites the OpenAPI document, the parity coverage, the
   artifact manifest, `tests/fixtures/api_contract/boundary-evidence.json` and
   `libs/api/src/generated/schema.ts`. Never edit these by hand.
8. Re-pin the oracle: the five hashes in `apps/api/src/capacity/identity.rs:102-123` and the
   `api_contract_artifacts` rows of `apps/api/tests/fixtures/capacity-baseline/v1/identity/manifest.json`,
   with a dated comment (the pattern at `identity.rs:80-101`). At `adda4054` four of the five pins
   already differ from the committed artifacts (measured; section 7, R1). Re-pin from the artifacts
   this commit produces, and confirm all five match with a `shasum -a 256` comparison. Do not run
   the `byte-identity` self-test for this: it writes a receipt.
9. `.spire/clusters/tech/state/conformance/owner-gated.json`: two envelope rows,
   `GET /api/journal/entries` (`storage` string, `entries` array) and `GET /api/journal/suspicions`,
   as `3d6a9c80` added conformance rows for its routes.

- Check, in this order:
  1. `npm run api:contract:check` exits 0.
  2. `cargo test -p api-rust --test api_contract_parity --test api_contract_router --test api_contract_runtime_auth_research --test journal_routes --test capacity_identity`
     exits 0.
  3. `NX_DAEMON=false npx nx test api` exits 0.
  4. `npm run verify` exits 0 (needs `gitleaks`).
  5. Mutations: put the probe rule back to GET-only and regenerate, and
     `http_parity_harness_observes_all_operations` goes red (it observes 403 where the catalog says
     422); drop the `"DELETE"` arm, and building the OpenAPI document panics (`mod.rs:2258`).
- The `.env.example` lines are not in this commit; they go to the owner (section 9).

**B5. Local observation of the API.** S, no commit. Evidence goes under
`tmp/parallel-<date>/backend/`.
- Criterion 1: three `curl` calls against a local API (signed out → 403 `auth_required`; another
  account → 403 `owner_only`; `OWNER_EMAILS` unset → refused), with the HTTP status read from
  `curl -w '%{http_code}'`.
- Criterion 24: without `DATABASE_URL`, with the ring set in `apps/api/.env` (`main.rs:378-387`
  loads it): save, restart, `GET`, and the entry is back. Without the ring: the write is 503
  `storage_not_set_up` and `data/journal.json` gains nothing.
- Criterion 3: with Postgres, save an entry holding a sentinel word, then
  `pg_dump "$DATABASE_URL" | grep -c SENTINEL` prints 0, with both exit codes read from
  `$pipestatus` (zsh).
- Criterion 22: `DELETE`, then read the row with `psql`: every `_ct` column is null, `written_at` is
  unchanged, and the children are gone.
- Check `lsof -nP -iTCP:<port> -sTCP:LISTEN` before starting a server (port 8001 belongs to another
  project), and stop every server started.

### Frontend

The boards are the source for every visual step (BOARD BRIEF; rows by key). They draw the whole
journal; 1a builds the 1a subset named under each step. Read the landed `design/site` pages before
building F4 to F8; never edit `design/`.

**F1. The client facade and the facts module.** M. After B4.
- Files: `libs/api/src/lib/journal/{api,facts,et}.ts`, `facts.spec.ts`, `libs/api/src/index.ts`
  (exports), `libs/api/src/lib/client.ts:22-28`.
- `et.ts` holds `Intl`-based formatters (`timeZone: 'America/New_York'`) and, for the demo only, a
  wall-time-to-instant helper.
- Follows the facade pattern of `convexa.ts:2076-2094` (`getBook`/`putBook`) and the error handling
  of 2.5. If the FE lane's in-flight owner-gate helpers land first (`AccessRefusal`,
  `accessRefusalOf`, `ownerDataOf`, uncommitted in `convexa.ts` while this was written), the facade
  uses `ownerDataOf` for the 403s. If not, the facade reads `error` itself and throws
  `AuthError('owner_only' | 'auth_required')`, which needs `owner_only` in `AuthErrorCode`
  (`convexa.ts:558-583`; the note at `:2101-2102` says it is missing).
- Tests: T20.
- Check: `NX_DAEMON=false npx nx test @convexa/api` exits 0, then `npx nx typecheck @convexa/api`
  exits 0. Mutation: change the step's evaluation order in `facts.ts` and the exact block goes red.

**F2. The demo transport and the 1a seed.** M.
- Files: `libs/api/src/lib/demo/journal.ts` (new: the seed and the handlers),
  `libs/api/src/lib/demo/transport.ts`, `libs/api/src/lib/demo/workspace.ts`.
- `transport.ts` changes:
  - eight regexes in `supportedPath` (`:725-756`);
  - dispatch to `demoJournal()` before the `demo_unavailable` fall-through (`:1702`);
  - the journal key in `validStoredValue` (`:95-134`), beside the book key (`:129-130`).
- `workspace.ts`: `initializeDemoWorkspace` (`:202-575`) writes `convexa.demo.journal.v1` when it is
  missing, in both the new-browser branch and the returning-browser branch (`:208-223`, the alerts
  precedent), with a `DEMO_JOURNAL_SEED_VERSION`. Later slices merge their parts in by id.
  `resetDemoWorkspace` (`:576-588`) already clears it: demo keys carry the `convexa.demo.v1.` prefix
  (`apps/dashboard/vite.config.mts:24`, `demo/mode.ts:49-54`).
- The seed (spec, Staging, 1a row):
  - 34 entries: 26 written at the time, 5 recalled, 3 imported; the 2 plan entries are cards only;
  - 12 snapshots with their typed positions;
  - 1 money-in entry;
  - 5 later notes;
  - the Aug 22 correction (margin loan $11,890 → $11,980, "the statement says 11,980").
  - Account facts come from `facts.ts`, never authored. Leg facts wait for 1b's seed row (section 7,
    C11).
  - Sample strings are copied from the boards' `design/src/data/journal-sample.mjs` once it lands,
    never imported: `libs/api` cannot depend on `design/`.
  - Visitor writes land in demo storage, with written times from the demo clock (`appNowMs`).
- Check:
  - criterion 26's scratch script over `demo/journal.ts` and the catalog seeds
    (`demo/catalog/shared.ts:205-230` closes, `:6` `EXPIRIES`) exits 0. It checks that each
    snapshot's Σ(qty × mark × multiplier) + cash − loan equals its account value to the cent, that
    every stock mark equals the catalog close, that every option mark is at or above intrinsic, and
    that no option expiry is in `EXPIRIES`;
  - `npx nx test @convexa/api` exits 0;
  - with the demo build, all eight routes answer and none answers `demo_unavailable`.

**F3. The pure browser modules.** S. Independent of the contract; can land before F1.
- Files: `apps/dashboard/src/app/shared/lib/plainDecimal.ts` (new),
  `apps/dashboard/src/app/features/auth/riskInputs.ts`,
  `apps/dashboard/src/app/features/journal/{money,accountNumberScan,outbox}.ts` and their specs.
- `plainDecimal.ts` takes `GROUPED`, `PLAIN_DECIMAL` and `amountText` (`riskInputs.ts:24-44`)
  moved verbatim, and `riskInputs.ts` imports them. That is the spec's "reused, not rewritten", and
  `riskInputs.spec.tsx` proves it by staying green.
- `money.ts`: `parseCents(text)` on top of `amountText`: at most two decimals, converted to integer
  cents as a string, never through float multiplication.
- `outbox.ts`: drafts and unsent entries under the one key the spec names,
  `convexa.journal.drafts.v1`: `{ schema_version: 1, user_id, draft, unsent: [{ client_id,
  request, queued_at, last_error }] }`. Every read and write is wrapped in try/catch. An unsent entry
  leaves only on a 200 or 201; a retry reuses its `client_id`; another user's entries are never
  sent.
- Tests: T21 to T24.
- Check: `NX_DAEMON=false npx nx test @convexa/dashboard` exits 0 (the inferred `@nx/vitest`
  target; this plan does not assume it forwards a file filter), and the four specs above are in its
  output. Criterion 19's `git grep` still prints nothing and exits 1 (it did at `adda4054`). The
  moved code adds no "journal" text to `riskInputs.ts`.

**F4. Section tabs and the routes.** M. After the boards land.
- Files:
  - `apps/dashboard/src/app/shared/ui/SectionTabs.tsx` (new), generalised from
    `pages/research/ResearchTabs.tsx:25-115`, and `ResearchTabs` rebuilt on it;
  - `pages/positions/PositionsTabs.tsx` (new): Book `/positions`, current only on exactly
    `/positions`; Journal `/positions/journal`, current on any `/positions/journal` path;
  - `pages/positions/PositionsPage.tsx`: the band above its column (`:347-350`), as the Research
    pages place theirs (`pages/research/MarketsPage.tsx:110-113`);
  - `apps/dashboard/src/app/app.tsx`: three `routeLoaders` rows (`:68-94`), three `lazy` pages
    (`:104-165`), and three routes before the catch-all (`:359`): `/positions/journal`,
    `/positions/journal/new` and `/positions/journal/:entryId`. Each sits in
    `RequireAuth surface="your journal" demoPath="/positions/journal" docTitle="Journal — Convexa"`
    around `lazyRoute(...)`, like `/positions` (`:321-329`).
- The 403 `owner_only` wall reuses the owner-gate wall if the FE lane's in-flight
  `OwnerGateBoundary` lands (`RequireAuth.tsx`, uncommitted while this was written). Its `wallCopy`
  gains a journal branch whose owner sentence is the spec's own, "This journal is private to the
  account that owns this Convexa.", with no tag. If it does not land, F5 draws that wall in the
  page.
- `TopNav` needs no change (`shell/TopNav.tsx:96-100` already lights Positions for
  `/positions/*`).
- Boards: the tab band on row `journal-timeline` (every board), and the canon's section-tabs row
  (`DESIGN_SYSTEM.md:273`).
- Check: `npx nx typecheck @convexa/dashboard` exits 0 (`route-boundaries.structural.spec.ts`
  passes, every route bounded). By observation: the Research tabs look as they did, at 1440 and
  390, and Positions shows Book · Journal.

**F5. The timeline.** L.
- Files:
  - `pages/positions/journal/JournalTimelinePage.tsx` and its parts: `QuickCapture`, `DayGroups`,
    `EntryCard`, `AccountFrame`, `JournalFilters`, `FirstRun`, `JournalPhoneBar`;
  - `features/journal/{useJournal,copy,format}.ts`;
  - `shared/ui/PenIcon.tsx` (new).
- `PenIcon` copies the geometry of the `edit` icon that step 0 adds to `design/src/lib.mjs`
  (`currentColor`, stroke-width 1.75, round caps and joins, `aria-hidden`). The app has no
  stroke-icon set, only MUI icons and one-off SVGs such as `shell/ConvexaMark.tsx`
  (`DESIGN_SYSTEM.md:294`).
- Uses `pageColumnSx` (`shared/ui/PageColumn.tsx:11`), `PanelContainer`
  (`shared/ui/PanelContainer.tsx:24`), `FigureCell` (`pages/ticker/widgets/_kit/FigureCell.tsx:211`),
  `DataStateTag` and `DATA_STATES` (`shared/dataState/vocabulary.ts:32-50`; `local` is "Stored here"),
  `ChartFrame` for the account frame with the figure strip as its children and no plot
  (`shared/charts/frame/ChartFrame.tsx:98-145`), `AccessibleHelp` for the below-the-high ⓘ
  (`shared/ui/AccessibleHelp.tsx:51`), the bottom-sheet styles for filters
  (`shared/ui/bottomSheet.ts:25`, `:52`), `formatShortDate` (`pages/research/format.ts:13`, which
  takes the ET dates the server sends) and the Markdown subset for bodies
  (`pages/blog/markdown.ts:32`, `:139`).
- The 1a subset:
  - the header with the one amber "Write entry";
  - quick capture (text, kind chips, the numbers line, an outlined Save, "Open full editor");
  - "Order by: Written · About", with day groups by `written_on` or `effective_about_date`;
  - cards: time, kind pill, body, and the footer's recalled dates, note count and "Corrected {date}";
  - the rail's account frame and the filters (search, kind, written from memory, kept out of AI
    reads, has later notes);
  - the first run with "Write about an earlier day" and "What do you think your downfalls are?";
  - the phone bar (amber "Write entry" and an outlined 44px "Margin call").
- Not drawn in 1a: ticker chips and the ticker filter (no symbols before 1b and 3), the AI status,
  this week's focus, the Rulebook and Review minis, plan answers, and R and the label on trims.
- Boards (row `journal-timeline`): "Staging · demo account", "Production · first run",
  "Production · signed out", "Production · illustrative", "Phone · staging", "Light · staging" and
  "States". Of the States board's seven, 1a draws them all: loading skeletons, Couldn't load, Not
  on your account yet, sign-out with an unsent entry, Storage not set up, Not the owner, and the
  staging marking.
- Check: section 6's probes for this route.

**F6. The composer and margin-call mode.** L.
- Files: `pages/positions/journal/JournalComposerPage.tsx` and its parts: `SnapshotColumn`,
  `MoneyFields`, `MarginCallRow`, `ComputedBox`, `UpdateNumbersSheet`.
- Query parameters `?kind=` (all but `plan`) and `?about=`.
- Drafts autosave through `outbox.ts`. The 9-digit warning comes from `accountNumberScan.ts`, inline
  and never blocking. The Computed box, the sanity question and the cross-check come from `facts.ts`
  over the server's snapshots plus the draft.
- Carried figures are sent as `carried` with `carried_from`; "Update numbers" sends `typed`.
- Due by is one native `datetime-local`, sent as `at_et`. "One thing you want to remember from
  today" is appended to the body.
- Save goes through the outbox, so a failed or offline save stays queued with its `client_id`. The
  composer shows the spec's "Couldn't save to your account. Your text is kept in this browser until
  it goes through." with "Try again", inline and never as a toast, and the timeline's card carries
  "Not on your account yet…" until it lands.
- Saved: back to the timeline with the card focused and "Saved · {date, time}".
- Margin-call mode: the reduced page, Call amount autofocused, the info strip, "More numbers" (loan
  and maintenance carried), the two neutral cross-check lines and the after-save line. No decision
  label in any slice.
- Boards (row `journal-compose`): "Staging · normal day" (without the sale row and the label, which
  are 1b), "Margin call mode", "Phone · margin call", "Light · staging" and "States". 1a draws 12
  of the 15 states: Blank, Draft restored, No earlier snapshot, Carried and old, Validating, Sanity
  question, Account-number warning, Saving, Save failed, Offline, Cross-check mismatch and Money
  timing. "Plan a trade", "Phone · plan a trade", and the Stale snapshot strip, No rules and Reason
  missing states are slice 2.
- Check: the probes, plus criterion 4's interaction count (at most 6) and criterion 25's walk.

**F7. The entry page.** M.
- Files: `pages/positions/journal/JournalEntryPage.tsx` and its parts: `SnapshotPanel`,
  `CorrectFigureForm`, `LaterNotes`, `DeleteEntry`.
- Meta, the recalled strip, the body, later notes with "Add a later note" and its "Context for the
  AI" mark (stored as `ai_context`; like the composer's keep-out box, it is set before any read
  exists), the snapshot panel with Stored here and Computed lines, and "Correct a figure" (field,
  value, reason; As of is correctable the same way).
- The foot's "Delete entry…" with its inline confirm, and the tombstone page state.
- Boards (row `journal-entry`): "Staging · recalled entry" (the strip, the Statement snapshot, the
  Aug 22 correction), "Staging · the Sep 29 call" (body, later note, snapshot with call and Computed
  lines, foot; not Details found, the AI read or Rules), "Phone · staging" (the Numbers accordion,
  without the What's sent sheet) and "States": Deleted tombstone, Loading, Couldn't load and the
  delete inline confirm. The board's "Light · staging" draws the 1b Result panel; use the recalled
  board in light instead.
- Before the delete copy ships, the owner reads Railway's backup setting, and its true sentence
  goes into the confirm (spec, Export and delete; section 9).
- Check: the probes, and criterion 22's database read (B5).

**F8. Sign-out with an unsent entry, and /privacy.** S.
- Files: `features/auth/AuthContext.tsx` (`signOut` at `:189-200` checks the outbox first, as it
  pushes the book first; it clears the draft on every sign-out and the unsent queue only with
  consent), `features/auth/SettingsPage.tsx` (the inline stop beside the sign-out button at `:432`,
  with "Try sending now", "Sign out and delete it" and "Stay signed in") and
  `pages/trust/PrivacyPage.tsx`.
- `/privacy` gains:
  - the "Journal drafts and unsent entries" row in `KEYS` (`:44`);
  - the "Journal" row in `SERVER_ROWS` (`:91`);
  - `convexa.demo.journal.v1` in `DEMO_KEYS` (`:84`);
  - the journal tables and `convexa.journal.drafts.v1` in the header's list of shipped stores
    (`:5-9`).
- The egress row waits for slice 4, which ships its triggers.
- Boards: row `journal-timeline` → "States" → "Sign-out with an unsent entry"; the trust page's
  privacy row (`design/src/screens/final/trust.mjs`).
- Check: a walk that queues an entry offline, then signs out and meets the inline stop; and a text
  read of `/privacy`.

**F9. The verification pass.** M, no commit. Section 6's probes on every shipped journal route, on
the local live build signed in as the owner and on the demo build
(`VITE_DATA_MODE=demo npm run serve:dashboard`), recorded under `tmp/parallel-<date>/frontend/`.
Then `NX_DAEMON=false npx nx typecheck @convexa/dashboard` and `npm run verify` exit 0.

---

## 6. Tests owed, and what is checked by observation

CLAUDE.md's rule: a test only where logic can fail silently and cost something. Each owed test is
seen red once on purpose (the mutation column), at the cheapest layer that proves it.

| # | Test (file) | Risk | Proves | Fails if (the mutation) |
|---|---|---|---|---|
| T1 | `worked_example_matches_the_spec` (`services/journal/facts.rs`) | money | the 12 snapshots' account facts, $22,142, −$2,750, +$1,121 | the deposit is left in the step (seen: −38.3% for −42.6%) |
| T2 | `missing_account_value_is_bridged` | money | a skipped snapshot reads `not recorded`, and money across it lands in the next step | missing is treated as 0, or its flow is dropped |
| T3 | `zero_account_value_breaks_the_chain` | money | percents read `—` from the break; dollars carry on | a division by ≤ 0, or dollars blanked too |
| T4 | `a_deposit_cannot_hide_a_loss` (criterion 7) | money | equal drawdown with a $D deposit and an end value +$D, the deposit on the last snapshot's day before it and on the previous snapshot's day after it | flows assigned by date rather than instant |
| T5 | `snapshots_order_by_as_of_then_written_at` (criterion 27) | money, dates | the Aug 4 statement written Aug 21 sorts at Aug 4 | order by `written_at` |
| T6 | `recorded_high_with_a_recalled_point_and_ties` | money | a recalled point can be the high; a tie keeps the earlier | `>=` in place of `>` |
| T7 | `display_rounding_is_half_away_from_zero` (both languages) | money | −24.85 → −24.9, −42.6056 → −42.6, ±0.5 | the guard removed (−24.85 → −24.8) |
| T8 | `fixture_exact_values_are_facts_rs_output` | parity | `expect_exact` is the Rust output | any formula change without regenerating the fixture |
| T9 | `et_dates_at_both_sides_of_utc_midnight` (`store.rs`, criterion 27) | dates | 9:30 PM ET is the same day; 12:30 AM ET is recalled | the UTC date used for `written_on` |
| T10 | `about_date_correction_flips_recalled_never_moves_as_of` | dates, writes | a correction flips recalled, a later one flips it back, and `as_of` stays | an About correction moves `as_of` |
| T11 | `default_as_of_and_et_wall_times` | parsers | today → `written_at`; earlier → 4:00 PM ET (EDT and EST); gap → error; overlap → earlier | a fixed −4h offset |
| T12 | `from_env_prefixed_*`, `aad_round_trip` (`services/auth/crypto.rs`) | encryption | None without either variable or on a bad key; no legacy or ephemeral key; a wrong context fails | an ephemeral fallback, or the AAD dropped |
| T13 | `aad_binds_user_table_row_and_column` (`services/journal/crypto.rs`, criterion 3) | encryption | a body envelope moved to another row, another column or another user fails to open | the AAD reverts to `v1.{kid}` (`crypto.rs:133`) |
| T14 | `seal_tag_verifies_and_detects_each_edit` | writes | the tag verifies, and fails after any change to body, `written_at`, kind, About or figures | a field left out of the message |
| T15 | `store_contract_on_the_json_store` (`store.rs`, criterion 2) | writes | see the list below this table | a fourth writer; an upsert on conflict; a swallowed write error |
| T16 | `journal_store_postgres.rs` (`--features postgres`, `TEST_DATABASE_URL`) | writes, auth | T15's suite on Postgres, plus the trigger, the cross-user query and the probes | the trigger dropped; a query without `user_id` |
| T17 | `journal_routes.rs` (hermetic, memory store) | writes, auth | see the list below this table | each rule removed in turn |
| T18 | `owner_only_routes_answer_the_owner_alone`, `owner_only_routes_fail_closed_without_owner_emails` (extended) and the owner marking test (`api_contract_parity.rs:1325-1341`) | auth | criterion 1 for all eight operations, the KELVIN SIGN lookalike included | a journal row missing from `OWNER_ONLY_OPERATIONS`; `AuthUser` in place of `OwnerUser` |
| T19 | `npm run api:contract:check` and the parity and router tests | contract | representatives for every boundary; the widened probe | the probe back to GET-only (the harness goes red) |
| T20 | `facts.spec.ts` (`libs/api`) | parity, money | `facts.ts` equals both fixture blocks with `===`, plus `sanityMove` at 40% and `crossCheck` at $1 | a reordered evaluation; `> 0.4` written as `>=` |
| T21 | `money.spec.ts` (`features/journal`) | parsers | "41,210.50" → 4121050, "$41,210.50", "41210" and "4.35" → 435; refused: "1,50", "0,500", "12.345", "1e3", "0x10", ".5", "", "-5" | float conversion with truncation ("4.35" → 434), or three decimals allowed |
| T22 | `accountNumberScan.spec.ts` | parsers | "Acct 123456789" and "1234567890" warn; "$41,210.50", "123456789.50" and "12,345,678,901" don't | the decimal exclusion dropped |
| T23 | `outbox.spec.ts` (added by this plan) | writes | an unsent entry survives a network error, 422, 403 and 503, leaves only on 200 or 201, keeps its `client_id`, and another user's entries are never sent | removal on any error |
| T24 | the existing `riskInputs.spec.tsx`, unchanged | parsers | the moved grammar behaves as before | the move changes a regex |

T15 and T16 check, on each store:
- the trait's writers are exactly `insert`, `append` and `tombstone`: a source scan of the trait
  block, and of every SQL write naming `journal_entries`;
- after a tombstone every `_ct` column is null, `written_at` is unchanged and the children are gone;
- a repeated `client_id` returns the stored row and never changes its body;
- `append` never touches the entry row;
- reopening the file returns the same entries;
- a failed write reports an error and leaves the state as it was.

T16 adds:
- a raw `UPDATE … SET body_ct = …` is refused by the trigger;
- one user's rows are invisible to another's queries (the owner list can hold two emails);
- the verifier's probes pass on a migrated database.

T17 checks through the routes:
- an idempotent create (201, then 200), and the same for notes and corrections;
- a correction supersedes and keeps the original;
- the tombstone keeps only its keys and dates (3.2);
- 409 `entry_deleted` on a tombstone;
- with no ring: 503 on every write with nothing written, and a 200 `not_set_up` list;
- each 422 rule in 2.4;
- another owner's id is 404;
- a tampered envelope is 500 `journal_unreadable`.

T23 is beyond the spec's list. It is owed by the same risk rule: a dropped queue entry is lost text
from his worst day.

**Checked by observation** (scratch probes under `tmp/parallel-<date>/<lane>/`, run on the local
live build and the demo build, recorded with the slice, never committed; every screenshot read):

| Criterion | Probe |
|---|---|
| UI, every 1a route | Playwright screenshots at 1440 and 390, dark and light, and again with `document.documentElement.style.fontSize = '20px'` (the owner's browser runs larger text) |
| 4 | a Playwright walk at 390 with a coarse pointer, counting taps and field typings from "Margin call" to the saved card: at most 6 |
| 8 | `getComputedStyle(el).fontFamily` over the timeline, entry and composer at 1440: figures in the Mono token, value gaps in Sans |
| 9 | a computed-style scan: no success or error fills; `textUp`/`textDown` only on text with a sign |
| 18 | demo build: every journal route answers from the transport; one "Demo · sample data"; each frame has `data-provenance="sample"` and one "Sample" mark. On staging after deploy, read-only |
| 19 | the `git grep` prints nothing and exits 1 |
| 21 | at 390 and 393, both schemes: `scrollWidth == clientWidth`, and no interactive element under 44px with a coarse pointer |
| 25 | "Acct 123456789" warns before save and saves with "Keep it"; "$41,210.50" doesn't warn |
| 26 | the seed script (F2) |
| 34 | an empty local journal: the downfalls prompt saves up to 5 lines and the `GET` returns them; Skip leaves writing alone; the prompt sits under the only card, goes when a second saves, and never follows a margin-call entry |
| 1, 3, 22, 24 | B5's `curl`, `pg_dump` and `psql` reads |

---

## 7. Risks and decisions

### Decisions, each with one recommendation

- **D1. Crypto crates.** Use `aes-gcm 0.10`, already a direct dependency (`apps/api/Cargo.toml:23`),
  through `EncryptionKeyRing`, and HMAC-SHA256 from `hmac 0.13` and `sha2 0.11` (`:34`, `:44`).
  Derive the seal key with HMAC, not `hkdf`: `hkdf 0.12.4` is in `Cargo.lock` only transitively, on
  the older `hmac 0.12` and `sha2 0.10` line. No new crate.
- **D2. Migration number.** `journal_core` takes the next free version at build time (14 at
  `adda4054`). Re-check `compiled_migrations().last()` just before the commit, and never renumber a
  migration that has shipped. The release-safety tests derive their target from the manifest
  (`tests/postgres_release_safety_postgres.rs:261-306`), so no pin there moves.
- **D3. The JSON dev store** lives at `data/journal.json` under the workspace root, ignored by
  `.gitignore:105` (checked: `git check-ignore` matches it), through `Config::journal_store_path`.
  Unlike `JsonAuthStore` (`store.rs:172-186`), a failed write is an error, never silent.
- **D4. One trait with exactly three writers**, an async `JournalStore`. The JSON and Postgres
  stores implement it, an enum dispatches as `AuthStore` does, and there is no `dyn`, no
  `async_trait` crate and no `block_in_place`. Suspicions get a separate `SuspicionStore`. The
  spec's file list (`services/journal/{mod,store,facts,crypto}.rs`) has no Postgres file; put it at
  `db/pg_journal.rs` with the other Postgres stores.
- **D5. The seal in the database too.** A `BEFORE UPDATE` trigger plus CHECK constraints refuse any
  update but the tombstone. The cost is about 15 lines of plpgsql, the schema's first. The gain is
  that the seal holds against any later code path or hand-written SQL.
- **D6. UUID columns, bound as text.** sqlx has no `uuid` feature here (`Cargo.toml:48`) and
  `Cargo.lock` has no `uuid` crate. Ids are minted from `rand`, canonical lowercase, because the AAD
  binds their text.
- **D7. `written_at` is truncated to microseconds**, so the JSON store, Postgres and the seal agree
  to the byte.
- **D8. Carried figures are copied at save.** The server copies the source's effective value and
  seals it with provenance `carried(from)`. Each entry stays self-contained, so withdrawing an old
  entry can't erase later snapshots' numbers. The tradeoff: a later correction of the source doesn't
  move the copy; he corrects the copy too if he wants it changed.
- **D9. The seal covers more than the spec lists.** Add `about_date` and a hash of the sealed
  snapshot and money to the spec's user, id, `written_at`, kind and body hash. Otherwise an edited
  export (plaintext, slice 1b) could restore changed figures, or move a recalled entry's About date,
  and keep "written at the time". The tag is fixed at insert and can't be widened later without a
  fourth writer, so this needs the owner's yes before B3 lands. If he says no, seal exactly the
  spec's list.
- **D10. Key rotation is add-only**, with no rewrap on read (3.3).
- **D11. Ring checks.** `from_env_prefixed` parses exactly as `from_env` does. The journal also
  refuses a ring whose active id is missing from its map, or that shares a key with the AI-key ring,
  and logs its presence at boot. It is not a production startup requirement.
- **D12. An unreadable row fails the read** (500, "Couldn't load") rather than hiding the entry and
  computing facts without it. `DELETE` still works.
- **D13. No ring:** the list is 200 `not_set_up`, and writes are 503.
- **D14. Errors** use the existing `WireError` and the closed codes of 2.1. A `JournalJson<T>`
  extractor makes body rejections JSON.
- **D15. Notes and corrections carry `client_id`** (columns the spec does not list). An append-only
  row can't be removed except by withdrawing the whole entry, so a retried save must not land twice.
- **D16. Typed date-times travel as ET wall time**, and the server converts them. That is the spec's
  "converts once, in the store", and it keeps zone arithmetic out of the browser.
- **D17. The 1a wire is additive-ready.** It has no plan write, positions, sale or label. Those come
  as optional fields with their slices, each regenerating the contract.
- **D18. The plain-decimal grammar moves verbatim** to `shared/lib/plainDecimal.ts`, and
  `riskInputs.ts` imports it.
- **D19. A separate journal facade** importing through `../convexa` and `../client`, so neither
  allowlist changes.
- **D20. One browser key**, `convexa.journal.drafts.v1`, for drafts and unsent entries, tagged with
  the user id.
- **D21. The demo seed** is written by `initializeDemoWorkspace` in both branches, with a seed
  version.
- **D22. Copy held back.** Two 1a strings name surfaces that don't exist yet. Hold back
  "What was already sent to your AI provider is under its terms." (Delete entry) until slice 4, and
  "When you're ready, a review can look at the weeks before this call. Nothing runs until you ask."
  (after a margin call) until slice 3, by the spec's own rule ("Copy that names a later surface is
  held back with it"). Keep the first run's "Nothing is sent to an AI until you turn AI reads on.":
  it is true from 1a, and the slice table draws the first run in 1a.
- **D23. The entry page's "Keep this entry out of AI reads" toggle moves to slice 4**, built as an
  append (a correction with target `ai_excluded`), never an `UPDATE`. 1a ships the composer's
  checkbox, which is set at insert. Nothing reads entries before slice 4.
- **D24.** "One thing you want to remember from today" is appended to the body after a blank line,
  so it is sealed and quotable like the rest of what he wrote. The spec doesn't say where it goes.
- **D25. Size limits:** body 50,000 characters, "I'm wrong if" 2,000, a note 20,000, a reason 1,000,
  and suspicions 5 lines of 280. The spec sets none; these keep one request bounded.
- **D26. The projection waits for slice 2** with Plan a trade, the only screen that shows it.
- **D27. Rounding** is 4.3's rule, in both languages.
- **D28. A tie for the recorded high keeps the earlier snapshot.** The spec doesn't say.
- **D29. Contract pins move from 60 to 68 operations**, and from 227 to 271 boundaries if the
  declared responses are exactly 2.2's. The regenerated `parity-coverage.json` is the authority.
- **D30. Two conformance rows** are added to `owner-gated.json` (B4.9).
- **D31. The tombstone nulls plaintext content too** (About date, revisit date, body length), per
  "keeps only id, written_at, deleted_at and kind".

### Where the code contradicts the spec (both cited)

- **C1.** The spec takes the account store as "the precedent for a JSON dev store and a Postgres
  store behind one trait", and criterion 2 tests "the store trait". The account store is an enum
  with inherent methods and no trait (`services/auth/store.rs:590-611`), and its JSON store
  swallows write errors (`:172-186`). Resolved by D4 and D3.
- **C2.** The build plan's 1a row lists `docs/product/ai-analyst/DESIGN.md` ("an appended
  owner-gate amendment"). `DESIGN.md:836-840` (the 2026-10-28 correction, item 2) withdrew it, and
  the spec's own Owner gate section agrees. 1a does not touch DESIGN.md.
- **C3.** The spec says `from_env()` "falls back to an ephemeral per-process key (`crypto.rs:3`,
  `:215`)". The ring returns None when unset (`crypto.rs:94-96`); the ephemeral key belongs to the
  module-level `encrypt` and `decrypt` (`:202-249`). Also, `from_env` returns a ring even when its
  active id isn't in the map (`:118-122`), and encrypt then fails with `UnknownKey` (`:126-129`).
  Resolved by 3.3 and D11.
- **C4.** "Keys rotate the same way": the AI-key ring rotates by rewrapping on read, a write
  (`services/auth/service.rs:300`), which the journal's seal forbids. Resolved by D10.
- **C5.** The spec names `tools/api-contract.mjs:213` and the doc comments, but not the rest of
  what new owner routes trip:
  - the Rust catalog's GET-only owner rule (`tests/api_contract_parity.rs:702-707`);
  - `concrete_path` (`:20-24`);
  - the owner test's fixed POST body and owner-200 assertion
    (`tests/api_contract_runtime_auth_research.rs:1750-1755`, `:1907-1913`) and its list equality
    (`:1841-1854`);
  - the immutable baseline (`api-contract.mjs:1984-1992`);
  - six count pins (`api-contract.mjs:571-572`, `:2055`; `api_contract_parity.rs:429`, `:1026`;
    `api_contract_router.rs:32`, `:64-65`);
  - `sourceRegistryTarget`'s `null` (`:1365`).
  B4 lists all of them.
- **C6.** The spec's Store section doesn't mention the schema verifier, which probes every migrated
  table (`db/schema_verifier.rs:65-81`). B2 adds the probes.
- **C7.** `journal_corrections` lists no `entry_id`, `user_id` or `client_id`, though "Tables (all
  keyed by `user_id`)" and a figure correction must name its snapshot. The DDL adds them.
- **C8.** "Plaintext metadata … Everything else is encrypted" leaves out columns the Tables draw
  plaintext: a snapshot's `as_of` and `source`, money's `direction` and `occurred_at`, a
  correction's `target`. This plan follows the Tables, the more specific statement. They reveal
  timing, not amounts or words.
- **C9.** The worked example's Aug 4 "Account value alone" reads "—", but `V₀ ÷ V_high − 1` is
  0.0%: Aug 4 is its own high at that point, and the Aug 21 row shows 0.0% for the same situation.
  The fixture records 0.0%, and the spec's cell should be corrected by an appended note
  (supersede, don't rewrite).
- **C10.** The Tables give `ai_excluded` as a column and the Entry screen draws a toggle for it,
  but "the store's only writers … are insert and tombstone", so a toggle after save would be an
  `UPDATE`. Resolved by D23.
- **C11.** The 1a seed row says "12 snapshots with their leg facts precomputed", but "no slice
  ships data that no screen shows", and leverage first shows in 1b. Seed the positions (criterion
  26 needs them for its sum) and defer the leg facts to 1b's seed row.
- **C12.** "An account value at or below $0" is unreachable below $0 by typing: money inputs take
  unsigned plain decimals (owner, 2026-10-16). The facts still handle ≤ 0 for restore and import.
- **C13.** The Delete entry copy and the after-call line name later surfaces, against the hold-back
  rule. Resolved by D22.
- **C14.** At `adda4054`, `owner_only` is not an `AuthErrorCode` (`libs/api/src/lib/convexa.ts:558-583`,
  noted at `:2101-2102`), so `authResultError` folds it into `auth_required`, and the journal could
  not tell "signed out" from "not the owner". The FE lane has the fix in flight. F1 names the
  fallback.
- **C15.** The other session's uncommitted `apps/api/.env.example` edit describes `OWNER_EMAILS` as
  guarding the options-derived routes only. After 1a it also guards the journal; the owner's edit
  can say so (section 9).

### Risks

- **R1. The artifact oracle was already stale at `adda4054`.** That commit regenerated the OpenAPI
  artifacts, but four of the five pins in `identity.rs:102-123` no longer match them (measured with
  `shasum -a 256` against `git show HEAD:<file>`; only the baseline matches). No `nx test` catches
  this, because `tests/capacity_identity.rs` checks only the manifest against the constants, and the
  current-hash comparison (`identity.rs:411`) runs only from the `capacity-baseline self-test` CLI.
  B4 re-pins from the artifacts it produces. Whoever lands next before it should re-pin too.
- **R2. The shared tree moves.** The FE lane's owner-gate work touches files F1, F4 and F8 edit
  (`convexa.ts`, `RequireAuth.tsx`, `AuthContext.tsx`, `app.tsx`, `PositionsPage.tsx`). Build on it
  once it is committed, never on top of uncommitted edits. If it is abandoned, F1 and F4 take their
  fallbacks.
- **R3. Contract churn.** Any operation another lane adds before B4 lands moves the counts. Re-read
  the five pins from the tree at build time; never copy this plan's 60 and 227 blindly.
- **R4. Memory.** The contract tool, cargo and Nx each load the workspace, and Nx once ran out of
  memory. One at a time, `NX_DAEMON=false`.
- **R5. Seal coverage (D9) is the one decision that can't be undone** once the first owner entry is
  written. Settle it before B3.

---

## 8. Landing order and lane fences

| Order | Step | Commit | Waits for |
|---|---|---|---|
| 1 | B1 ring and AAD | own commit | — |
| 2 | B2 migration and probes | own commit | B1 |
| 3 | B3 service, stores, facts, fixture | one or two commits | B2; the owner's answer on D9 |
| 4 | B4 routes and the regenerated contract | **one commit** | B3 |
| 5 | B5 local observation | none (evidence) | B4 |
| 6 | F3 pure browser modules | own commit | — (may go first) |
| 7 | F1 facade and facts parity | own commit | B4 (the types and the fixture) |
| 8 | F2 demo transport and seed | own commit | F1; the boards' sample data |
| 9 | F4 tabs and routes | own commit | the boards; the FE lane's owner-gate work committed or abandoned |
| 10 | F5, F6, F7, F8 | one commit each | F4 |
| 11 | F9 verification | none (evidence) | F8 |

Every commit is path-limited, with the author `Rodrigo Arias <rodrigoarias4@gmail.com>`, and
`gitleaks git --log-opts="-1" --no-banner --redact .` runs after it with its exit code read.

**Backend lane may touch:** `apps/api/**` except `apps/api/.env.example`;
`apps/api/openapi/**`; `libs/api/src/generated/schema.ts` (through `api:contract:generate` only);
`tools/api-contract.mjs`; `.spire/clusters/tech/state/conformance/owner-gated.json`.
**It must not touch:** `libs/api/src/lib/**`, `apps/dashboard/**`, `design/**`, any `.env*`, or
`docs/product/ai-analyst/DESIGN.md`.

**Frontend lane may touch:** `libs/api/src/lib/**`, `libs/api/src/index.ts`, and
`apps/dashboard/src/**` except `apps/dashboard/src/app/features/trading/**`.
**It must not touch:** `apps/api/**`, `libs/api/src/generated/schema.ts` (regenerated by the
backend), `tools/api-contract.mjs`, `design/**`, or any `.env*`. Nothing in the journal imports from
`features/trading/tradeEntry` (rule 10, `DESIGN_SYSTEM.md:165`). No journal code writes the word
"journal" into criterion 19's files.

**Neither lane:** `design/**` and `tmp/journal-boards/**` (the boards workflow);
`apps/api/.env.example` (the owner's); `eslint.config.mjs`, `nx.json`, `package.json` (no 1a need).

---

## 9. What only the owner can do

1. **Answer D9** (seal coverage) before B3 lands.
2. **Commit the `.env.example` lines**, after or with the other session's pending edit:
   `JOURNAL_ENCRYPTION_ACTIVE_KEY_ID=` and `JOURNAL_ENCRYPTION_KEYS_JSON=` with empty values, the
   one-line dev-key recipe, and a word in its `OWNER_EMAILS` comment that the gate also guards the
   journal. An agent never commits a `.env*` file.
3. **Set the ring on Railway's production service**: an active key id and the keys JSON, from a key
   made the same way. Staging is the browser demo and calls no API, so it needs none. Until then
   production shows "Journal storage isn't set up on this server" and writes nothing.
4. **Read Railway's database backup setting** and give the true sentence for the delete copy (F7).
5. **Time one real margin-call capture** at 390 (criterion 4: under 60 s).
6. **Deploy.** After it, criterion 18 is read on staging, and production is checked only for the
   signed-out wall and a signed-in empty first run; no script writes a real entry.
