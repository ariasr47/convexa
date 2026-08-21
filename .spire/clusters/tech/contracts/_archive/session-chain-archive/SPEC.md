# session-chain-archive — spec

**Source brief:** .spire/clusters/tech/contracts/session-chain-archive/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md   (under council/)
**Status:** approved 2026-08-19 (owner A — write the plan)

## 1. Goal + scope

Keep **one paid options book per symbol per ET trading session** in a sibling archive the existing
48-slot / 14-day `chain_snapshots` prune **cannot delete**, so research can still load Tuesday’s
paid book next week after the intraday ring has rolled. The archive is fed by copying bytes already
captured on the paid path. It authorizes **nothing** on the live score, adds **no trader UI**, and
never buys a new Massive product.

**In scope:**

- Sibling prune-proof session archive beside `ChainSnapshotStore` (not a flag on `chain_snapshots`).
- Session identity **`(symbol, et_date)`** where `et_date` is America/New_York calendar date
  `YYYY-MM-DD` of the captured book’s `as_of` (same New_York calendar rule as live
  `services/research/outcomes.rs` `session_date_et` — **not** UTC `session_date_from_ns`).
- **First-wins** insert-if-absent on that identity; promote after every successful ring append;
  pre/post-RTH paid captures remain eligible (not RTH-gated).
- Mandatory provenance **`source_as_of`** (ring capture UTC) on every successful operator
  session-book read — identity stays `(symbol, et_date)` and is **not** that timestamp (owner
  ruling A, 2026-08-19).
- Prune isolation proved structurally (poison 48-ring prune; session identity still loads).
- Dedicated research **list/load** under `/api/_research/session-books/...` (extend the live
  `research_chain_snapshots` / `/api/_research/chain-snapshots/...` pattern) with **zero Massive
  calls**, including on miss/fault.
- Four distinguishable research outcomes end-to-end (product classes):
  `no session book` ≠ empty/pruned intraday ring ≠ `session archive not storing` ≠
  `session book unreadable` — with exact ring-vehicle miss copy cited from live code (see §2.5).
- Best-effort archive writes (desk wins); score / tier / fingerprint byte-identical; no secrets in
  blobs; research-only license posture.

**Out of scope:**

- Raising the 48-per-symbol cap or stretching 14-day age to “keep a day.”
- Buying Massive hist-chain / PIT history (program P7).
- Force-capturing SPY/QQQ/IWM when cache-warm (`liquid-names-session-capture`, program #2).
- Object-store / dedicated volume migration (program #7).
- Rewriting Path-B / `batch-backtest` / `replay-outcome-join` CLIs onto the session archive this
  ship — **existence + loadability after prune + dedicated research list/load** is enough.
- Rewriting the ring research vehicle or its closed miss `detail` (`chain-snapshot-capture`).
- Any trader UI, trader route, nav item, Settings control, Ask-AI disclosure, or redistribution of
  stored books as a trader feed.
- Changing live score / tier / gate / fingerprint.
- Replacing or deleting the existing 48 / 14-day intraday ring.

**Future (deliberately deferred):**

- Last-RTH / explicit-close selection policy (first-wins + visible `source_as_of` stand for v1).
- Liquid-name force-capture (program #2), object-store (program #7), join-smoke / weekly digest /
  AI-lab corpus work, optional unlinked operator dashboard for archive health.
- Optional human-print is/is-not block layered over HTTP (not on the v1 wire).

## 2. Architecture

### 2.1 Session identity

| Field (content) | Meaning | Mechanism |
| --- | --- | --- |
| **symbol** | Uppercased ticker | Same normalize as ring store (`trim` + ASCII uppercase). |
| **et_date** | America/New_York calendar date `YYYY-MM-DD` of the copied book’s `as_of` | From ring `as_of: DateTime<Utc>`, apply the same New_York calendar-date rule as live `session_date_et` (UTC → `chrono_tz::America::New_York` → date) **directly on the `DateTime`** — do not round-trip through `f64` when `DateTime` is already in hand. **Do not** use `quant_engine::session_date_from_ns` (UTC day — mis-buckets late ET evenings). If a bridge to the `f64` API is ever needed, `timestamp() <= 0` is **not** an archival candidate (`session_date_et` returns `None` for `as_of_secs <= 0.0`). |
| **body** | Serialized paid capture blob | **Byte-copy** of the ring append payload (`serialize_capture` output). No re-fetch, no re-serialize from vendor. |
| **source_as_of** | Provenance: which ring capture was copied | The ring’s `as_of` (RFC 3339 UTC with fractional seconds). **Required on every successful operator read**; never the session identity key. |
| **source kind** | `live_massive` / `fixture` | Copied from the ring wire row (`SnapshotMeta` vocabulary). |

**Primary key:** `(symbol, et_date)` — exactly one session identity per symbol per ET date.

**Eligibility:** any successful paid ring append whose `as_of` yields an `et_date` under the rule
above is a candidate. Captures whose whole-second UTC timestamp is `<= 0` are skipped (no session
row) — they are not archival candidates under the cited `session_date_et` precondition. v1 does
**not** gate on RTH-only — pre/post-RTH captures remain eligible. Owner declined RTH-only (ruling A
companion; first-wins + visible capture time stand).

**Late-ET bucketing:** an `as_of` whose America/New_York wall clock is **20:00–23:59** on calendar
date D must archive under `et_date = D`, even when the UTC calendar date has already rolled to
D+1. This is the load-bearing reason the New_York rule is mandatory.

### 2.2 Conflict policy + when the copy is taken

**Promote on every successful ring append; first-wins on `(symbol, et_date)`.**

- **When:** inside the existing off-path `capture_into` / `spawn_capture` pipeline (`analytics.rs`
  hooks scanner + cold compute; warmer remains excluded), after a successful
  `ChainSnapshotStore::append`, with the **same** `(wire, body)` already in hand — no second vendor
  round-trip.
- **Order inside the capture task:** `append` → `ring.prune_symbol` → `archive_session_best_effort`.
  Archive I/O must not delay ring prune; archive failure never fails append/prune; the whole task
  remains off the trader HTTP await path.
- **Conflict:** insert-if-absent (`ON CONFLICT DO NOTHING` / in-memory skip). A second capture the
  same ET day does **not** create a second session identity and does **not** overwrite the first
  body.
- **Rejected for v1:** last-wins / last-RTH / explicit close job (higher complexity; product kept
  first-wins with mandatory visible `source_as_of` instead of changing selection).

### 2.3 Sibling archive backend

Introduce a **sibling store** — conceptually `SessionChainArchive` — parallel to
`ChainSnapshotStore`, **not** a mode of it.

| Backend | Role | Prune relationship |
| --- | --- | --- |
| Disabled | Archive off → research reads report `session archive not storing` | N/A |
| Memory | Hermetic tests | No shared map with ring memory |
| Failing | Test double: archive insert always fails; list/load stay empty/miss for hermetic AC-10 | No shared map with ring |
| Json | Sibling directory | Ring `persist_symbol` / `prune_symbol` never open this dir |
| Postgres | Sibling table (PK `(symbol, et_date TEXT)`, body BYTEA + provenance) | Ring `DELETE FROM chain_snapshots …` cannot name this table; **no** FK / ON DELETE CASCADE from the ring table |

**Config (named):**

| Dial | Env | Default |
| --- | --- | --- |
| Enable | `SESSION_CHAIN_ARCHIVE_ENABLED` | **true** (mirror `CHAIN_SNAPSHOT_ENABLED`; set `0`/`false`/`no`/`off` to disable) |
| Json path | `SESSION_CHAIN_ARCHIVE_STORE_PATH` | **`data/session_chain_archive`** — sibling of `data/chain_snapshots`, **never** equal to `chain_snapshot_store_path` and **never** a subdirectory of it |

Opening with a path that equals or nests under the ring store path is a **config error** (fail open
to Disabled / refuse start of the Json backend) — structural, not a prose comment.

**Structural prune isolation:** `capture_into` continues to call `store.prune_symbol` **only** on
the ring store. The session archive exposes **no prune API in v1** (or a stub never called from
capture). Growth until program #7 is accepted.

**Poison test (required):** plant a session identity; append >48 ring rows (or force-prune with
tiny caps); assert session load by `(symbol, et_date)` still returns the body. A comment inside
ring prune is **not** enforcement (`structural-over-prose-enforcement`).

### 2.4 Data flow

```
paid VendorBundle (already fetched)
  → spawn_capture (tokio task; trader path already returned / scan continues)
    → capture_into:
         serialize_capture → ring.append → ring.prune_symbol (48 + 14d)
         on append success → archive_session_best_effort(copy body under et_date)
              insert-if-absent (first-wins)
              on archive err → warn + return Ok to capture caller (desk unchanged)
  → research list/load by (symbol, et_date) under /api/_research/session-books/...
       → stored bytes only → vendor_called stays false
```

Path-B / `batch-backtest` / `replay-outcome-join` stay on stored blobs; they are **not** rewired
onto the session archive in this ship.

**Research vehicle (named):** extend the existing live `_research` chain-snapshot pattern —
operator HTTP list/load in a sibling module mounted beside
`apps/api/src/routes/research_chain_snapshots.rs` under `/api/_research/session-books/...`
(Railway-direct; same metrics-token gate family as `_metrics` / chain-snapshots). Pages trader
origin must **404** `/api/_research/*` the same way it 404s `_metrics`. No operator CLI ships in
this feature; CLI wrappers, if added later, are not a second conformance surface and are not
required to satisfy framing ACs.

**GATE Q / conformance seed (dedicated archive plant — not the ring seed):** plant a
fixture-source session-archive row directly at identity **`(SPY, 2020-01-02)`** with
`source_as_of = 2020-01-02T17:00:00.000000001Z` (America/New_York calendar date of that instant is
`2020-01-02`). Do **not** derive the session identity from ring `CONFORMANCE_SEED_AS_OF`
(`1970-01-01T00:00:00.000000001Z`): that `as_of` has `timestamp() == 0` / floors to a non-positive
`session_date_et` input or else buckets to **1969-12-31** ET — it cannot produce `et_date=1970-01-01`
under the cited rule.

### 2.5 Absence classes (typed, end-to-end)

Four closed research outcomes — never collapsed. Exact operator strings:

| Outcome (product class) | When | Exact operator / wire signal |
| --- | --- | --- |
| **`no session book`** | Session identity never archived (or dated load miss) | Session list empty: `no session book for <SYMBOL>`. Dated load miss: `no session book for <SYMBOL> on <ET_DATE>`. |
| **Empty / pruned intraday ring** | Operator is querying the **ring** vehicle and ring count for the symbol is zero | Live ring research list miss `detail` from `research_chain_snapshots.rs` `miss_detail`: exactly **`no stored snapshot for <SYMBOL>`** (dated load: `… at <as_of>`). **Do not invent** a new ring phrase such as `empty 48-ring for <SYMBOL>` — that would regress shipped `chain-snapshot-capture`. Distinctness vs session miss still holds: `no stored snapshot…` ≠ `no session book…`. |
| **`session archive not storing`** | Archive store disabled / not configured / unavailable | `store=error` + detail exactly `session archive not storing` — not a miss |
| **`session book unreadable`** | **Load** path: identity exists but body cannot be read | `session book unreadable: <reason>` — not a miss, not “not storing”, not a list metadata I/O fault |

**List metadata / I/O faults** (cannot list; not “disabled”, not “identity present body bad”) use a
**distinct** class: `error: session_archive_store_error`, detail
`session archive store error: <reason>` — never aliased to `session_book_unreadable`.

<!-- spire:council-resolution:v1 e5519825d15bddd5fb17aa43ab9d78315ac2a2ba20481500e467a6c2c6934754 folded -->

### 2.6 Failure modes + isolation

| Failure | Mechanism | Observable outcome |
| --- | --- | --- |
| Archive store disabled / failed open | `SESSION_CHAIN_ARCHIVE_ENABLED=false` or Disabled / refused bad path | `session archive not storing`; ring capture may still run |
| Archive insert I/O error | Best-effort warn; never bubble to bundle/SSE | No new session identity; ring row may still exist until pruned |
| Ring prune failure | Existing warn in `capture_into`; independent of archive | Session row unaffected |
| Corrupt / unreadable session body on **load** | Load returns unreadable class | Distinct from miss, not-storing, and list store-error |
| List metadata I/O error | List returns store-error class | Distinct from unreadable |
| Day with no successful capture / non-positive `as_of` skip | No insert attempted | Honest `no session book` (including SPY/QQQ/IWM when never captured) |
| Archive stall | Off-path capture task only; after ring prune | Must not delay or fail the trader HTTP response |

Module boundary: session archive is a **one-way leaf** — signals / score / tier / fingerprint / gate
never import it. Blobs are never scoring inputs (`additive-keeps-score-byte-identical`).

### 2.7 Not buildable / rejected approaches

- Flag on `chain_snapshots` + prune-skip (“prose retention”).
- Raising 48 / 14d to fake multi-day retention.
- Object-store as v1.
- Vendor hist-chain / PIT endpoints.
- Trader-route redistribution or trader UI chrome.
- Putting archive work on the ticker request latency path.
- Collapsing disabled, unreadable, and list store-error into one absence class.
- Treating `source_as_of` as optional on successful operator reads.
- Rewriting Path-B CLIs as a requirement of this ship.
- Rewriting ring research miss copy to invent `empty 48-ring for <SYMBOL>`.
- Defaulting Json archive path under / equal to the ring directory.
- Deriving GATE Q session identity from ring `CONFORMANCE_SEED_AS_OF`.

## 3. Acceptance criteria (with user stories)

Actors: research operator / owner. **Not** the signed-in trader on Landing / Ticker / Positions /
Scanner / Settings / Ask-AI. Every row is observable without reading source (operator list/load,
presence after prune, vendor-call counters, desk still serving, structural trader silence).
**(SB)** = ship-blocking.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 **(SB)** | US-1: As the research operator, I want one paid book kept per symbol per ET session so overnight prune cannot delete Tuesday’s research identity. | After symbol T is successfully captured during ET trading date D (via the existing paid capture path) and archival completes (observe via research list poll until the identity appears, or an archive-append log / test barrier — not the trader 200 alone), the session archive shows a **session identity** for `(T, D)`. | test |
| AC-2 **(SB)** | US-1 | Given a session identity for `(T, D)`, after the existing 48-slot / 14-day prune removes that day’s intraday ring copies for T (or the ring is force-pruned in verification), the session identity for `(T, D)` **still exists and remains loadable**. | test |
| AC-3 **(SB)** | US-1 | A verification that **poisons / forces the 48-ring prune** and then loads `(T, D)` still succeeds for the session identity — prune of the ring cannot delete the session book. | test |
| AC-4 **(SB)** | US-2: As the research operator, I want to load a session identity with zero live Massive calls after ring copies are gone. | Loading session identity `(T, D)` completes with **zero live Massive calls** (`vendor_called` false / vendor-call counter for that load stays at 0), including when no intraday ring copy for that day remains. | test |
| AC-5 **(SB)** | US-2 | Listing session-archive identities for a symbol completes with **zero live Massive calls**. | test |
| AC-6 **(SB)** | US-3: As the research operator, I want a second same-ET-day capture to leave exactly one session identity. | Given an existing session identity for `(T, D)`, after a later successful capture of T still on ET date D, the session archive still shows **exactly one** session identity for `(T, D)` — no second session identity is created (first-wins; body unchanged). | test |
| AC-7 **(SB)** | US-4: As the research operator, I want honest distinct absences so I never mistake miss for empty ring or store fault. | Requesting session identity `(T, D)` when no book was archived for that pair reports **`no session book for <SYMBOL> on <ET_DATE>`** (honest miss) and does **not** call Massive to create one. | test |
| AC-8 **(SB)** | US-4 | An **empty intraday ring** for T (ring research list `count === 0` / `store=miss`) surfaces the **live** ring miss detail **`no stored snapshot for <SYMBOL>`** and is **not** presented as `no session book…`; a session miss is **not** presented with the ring miss string. | test |
| AC-9 **(SB)** | US-4 | When the session-archive store is **disabled / not configured / unavailable**, the trader desk remains available; archival does **not** report a false stored success; the operator observes **`session archive not storing`** (distinct from `no session book` and from unreadable). | test |
| AC-10 **(SB)** | US-4 / US-5 | If the archive write fails after a paid book was available to archive, trader-facing scan/serve/SSE still **succeeds**, and the session archive does **not** gain a new successful identity from that failed write. | test |
| AC-11 **(SB)** | US-4 | When a session identity exists but the stored material is **unreadable / corrupt** on **load**, the research read reports **`session book unreadable: <reason>`** (distinct from `no session book`, not-storing, and list store-error) and performs **zero Massive calls**. | test |
| AC-12 **(SB)** | US-4 | A research miss for `(T, D)` does **not** silently substitute another date’s session book without labeling the substitution (substitution is Out; missing stays missing). | test |
| AC-13 **(SB)** | US-1 | Archival itself performs **no additional Massive fetches** beyond the paid capture the existing path already made (write-path vendor counter for the archive leaf stays at 0). | test |
| AC-14 **(SB)** | US-5: As the desk owner, I want archive failures best-effort and isolated. | Enabling the session archive does not place archive work on the trader request latency path in a way that makes an archive stall fail or delay the trader response — archival remains side/best-effort relative to the desk (trader HTTP does not await archive I/O). | test |
| AC-15 **(SB)** | US-6: As the desk owner, I want the archive off every trader route and trader UI. | No trader UI route, nav item, or trader-facing screen exposes session-archive browse, historical chain replay, or stored-blob download — structural `apps/dashboard` empty-diff / no new trader route affordance (no DOM harness required). | test |
| AC-16 **(SB)** | US-6 | No trader-facing product path redistributes session-archive books as a market-data feed: `/api/_research/*` stays absent from trader UI clients, and the Pages trader origin returns **404** for `/api/_research` (and subpaths) the same way it 404s `/api/_metrics`. | test |
| AC-17 **(SB)** | US-7: As the desk owner, I want session blobs to be non-inputs to scoring. | For the same market inputs, opportunity score / tier / fingerprint are **byte-identical** with session archive on vs off and with archive write succeeding vs failing. | test |
| AC-18 **(SB)** | US-1 | Stored session material contains **no API keys or other secrets**. | test |
| AC-19 **(SB)** | US-1 | Archival does **not** raise the existing 48-per-symbol cap or rewrite retention so that “keeping a day” is achieved by enlarging the intraday ring instead of a session archive. | review |
| AC-20 | US-8: As the owner, I want this ship to keep the invoice without absorbing program #2–#7. | This ship does **not** include force-capture of SPY/QQQ/IWM when cache-warm (program #2); absence of those names when never captured remains honest `no session book`. | review |
| AC-21 | US-8 | This ship does **not** include object-store migration (program #7), hist-chain purchase, Path-B CLI rewrite onto the session archive, join-smoke chore execution, or AI-lab work. | review |
| AC-22 | US-6 | Operator verification of the session archive (list / load / presence after prune) is available **without** using the trader UI (via `/api/_research/session-books/...`). | review |
| AC-23 **(SB)** | US-7 | Every **successful** research list/load (`store=hit`) that surfaces session books states that this archive **authorizes nothing** on the live score (`authorizes: "nothing"`). Miss/404 envelopes are detail-only and are not required to repeat `authorizes`. | review |
| AC-24 **(SB)** | US-4 / owner ruling A | A successful research **load** (`200` / `store=hit`) returns wire fields **`framing`** = `RESEARCH READ — SESSION BOOK`, **`et_date`** (session date ET), mandatory **`source_as_of`** (RFC 3339 UTC), **`provenance`** = `loaded from session archive · no vendor call`, **`license`**, **`authorizes`** = `nothing`, plus the typed market body — with **no** Live badge or “this quote is live” label. Closed wire lineage `source: live_massive` \| `fixture` is allowed provenance, not a live-market claim. | test |
| AC-25 **(SB)** | US-4 / UX honesty | On session-book list/load responses, `framing` and `provenance` never claim “fetching/refreshing from Massive” or “loading 48-ring” (HTTP has no separate loading phase — N/A). | test |
| AC-26 **(SB)** | US-5 / UX silence | Archive write failure produces **no** trader-visible chrome and does not change trader error/empty/offline copy. | test |
| AC-27 **(SB)** | US-1 / late-ET | A paid capture whose `as_of` America/New_York wall clock is in **20:00–23:59** on calendar date D archives under session identity `et_date = D` (not the next UTC calendar date). | test |

<!-- spire:council-resolution:v1 9f0471e32115187274f678d8fbaa65e57caac45691aff63b2defac20605d08ae folded -->

**Ship-blocking set:** AC-1–AC-19, AC-23–AC-27. AC-20–AC-22 are required honesty / scope checks
(`review`).

**Method notes (risk-based):**

- **`test`** concentrates on silent money/correctness failures: session identity creation, prune
  isolation (including poison-prune), zero-vendor list/load, first-wins uniqueness, four absence
  classes (session miss vs live ring miss string vs not-storing vs unreadable), no extra vendor
  fetch, desk isolation, no trader redistribution / Pages `_research` 404 / structural trader-chrome
  absence (AC-15), score byte-identity, no secrets, mandatory `source_as_of` + wire framing fields
  on hit, late-ET bucketing (AC-27).
- **`review`** owns not raising the 48 cap (AC-19), program #2–#7 / Path-B rewrite not absorbed
  (AC-20/21), positive operator path without trader UI (AC-22), and `authorizes: nothing` on hit
  envelopes (AC-23).
- Prefer **one** high-level integration pass: capture during D → assert session identity → force
  48-ring prune → load `(T, D)` with vendor-call counter 0 + `source_as_of` present → second
  same-day capture still one identity → force archive write fail and confirm desk still OK.
- No DOM harness is required for ship; trader-chrome absence is a structural empty-diff /
  affordance scan on `apps/dashboard`.
- Exact closed miss/framing/authorizes **string values** are asserted by unit / GATE Q tests; the
  interface conformance type block checks shape/presence (runner does not enum-lock string tokens).

## 4. UI + interaction

**`NO_UI_CHANGE`.** This feature touches **no** dashboard surface — no route, no component, no token,
no new motion, and no `DESIGN_SYSTEM.md` amendment. Anyone proposing a Ticker chip, Settings
research toggle, Ask-AI “we kept Tuesday’s book” line, or a trader-linked `/_ops` session browser is
**re-scoping**.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (`Status: SET` — The Curvature
Terminal). **Design direction:** does not apply — no trader presentation ships.

**Flows (operator / research only):**

1. Paid capture on an in-scope producer appends to the 48-ring → best-effort first-wins session
   archive copy (invisible on trader path).
2. Operator lists session books for a symbol via `GET /api/_research/session-books/{symbol}`.
3. Operator loads one `(symbol, et_date)` → stored book with mandatory `source_as_of`; zero Massive
   calls.
4. After 48-ring prune, the same session identity still loads.

**Component states — trader path (S0):** one required state — **unchanged**. Archive write success
and failure are both invisible on Landing / Ticker / Settings / Ask-AI / Scanner / Positions / shell
nav.

**Component states — research read (S1):**

| State | When | What the operator sees | What must **not** happen |
|---|---|---|---|
| Default (session hit) | Identity `(symbol, et_date)` exists and loads | Wire: `framing`, `et_date`, `source_as_of`, `provenance`, `license`, `authorizes: nothing` (+ market body on load) | Live badge; Massive network call; treating provenance as the identity key |
| Loading | **N/A** for HTTP request/response | No attach point on the v1 vehicle — no loading field or phase line ships | Inventing a loading surface or reviewing copy nothing renders |
| Empty — no session book | No archive row for that identity / empty list | Exact session miss strings below | Ring miss string `no stored snapshot…`, `no options`, `market closed`, trader `—`, `unavailable this cycle` |
| Empty — empty/pruned ring (distinct) | Operator is querying the **ring** vehicle, and ring count is zero | Live ring detail **`no stored snapshot for <SYMBOL>`** (unchanged `chain-snapshot-capture` / `miss_detail`) | Inventing `empty 48-ring for <SYMBOL>`; using session miss strings on the ring vehicle |
| Error — not storing | Archive disabled / unavailable | **`session archive not storing`** · `store=error` | Treating as miss; silent Massive recovery |
| Error — unreadable (load) | Identity present but body corrupt/unreadable | **`session book unreadable: <reason>`** · `store=error` | Treating as miss, not-storing, or list store-error |
| Error — list store fault | List metadata I/O failure | **`session archive store error: <reason>`** · distinct error code | Aliasing to `session_book_unreadable` |
| Same-day second capture | Later paid capture same ET day | Still **one** `(symbol, et_date)`; first body retained | “v2 session book”, duplicate ET-date rows |
| Post-prune retention | Ring pruned; session identity remains | Session book **still loadable** (no required companion ring-status string on the session read) | Claiming the day’s research is gone because the ring pruned; coupling session read to a ring query for optional chrome |
| Archive write skipped | Write failed after paid path otherwise succeeded | Operator log only: `session archive write skipped — trader path unchanged` | Toast on Ticker; failing bundle/scan/SSE |

**Closed vocabulary (operator-visible):**

| Concept | Approved term / exact string | Banned |
|---|---|---|
| Prune-proof day identity | **session book** / **session archive** / `(symbol, et_date)` | “live book”, “hist-chain product”, “raised 48-cap row” |
| Intraday dual-retention ring | **48-ring** / **ring snapshot** / **stored chain snapshot** | calling the ring a “session archive” |
| When the session identity was taken | **`et_date`** (ET `YYYY-MM-DD`) · **`source_as_of`** (UTC) | “last updated”, “fresh”, “current book”, “now” |
| How obtained on read | **`loaded from session archive · no vendor call`** | “refreshed”, “fetched”, “synced from Massive” |
| Day with no capture | **`no session book for <SYMBOL> on <ET_DATE>`** (load) / **`no session book for <SYMBOL>`** (list empty) | ring miss string; `no options`; trader `—` |
| Empty/pruned ring (ring vehicle) | Live **`no stored snapshot for <SYMBOL>`** (`research_chain_snapshots.rs` `miss_detail`) | Inventing **`empty 48-ring for <SYMBOL>`**; using session miss strings |
| Store disabled | **`session archive not storing`** | treating as miss; treating as unreadable |
| Identity present, body bad (load) | **`session book unreadable: <reason>`** | treating as miss; treating as not-storing; list I/O alias |
| List metadata I/O fault | **`session archive store error: <reason>`** | aliasing to unreadable |
| Score posture (hit) | **`authorizes: nothing`** | implying live score uses archived books |
| License | **Our research · not redistributed on a trader route.** | “shareable feed”, “customer historical options API” |

Four mandatory-distinct operator outcomes — never interchangeable:
`no session book…` ≠ live ring `no stored snapshot…` ≠ `session archive not storing` ≠
`session book unreadable: <reason>`.
<!-- spire:council-resolution:v1 82f779ef57014910fbd1a93cfeadd06d0bbcf7aa2e4903a182a894953441a998 folded -->

**Hard ban — live-as-market-feed:** on any research read of a session book, `live` / `LIVE` as a
badge or “this quote is live” label is forbidden. Closed lineage `source: live_massive` \| `fixture`
remains provenance only.

**v1 research-read surface = HTTP wire fields (binding):**

Successful **load** carries: `framing` (`RESEARCH READ — SESSION BOOK`), `et_date`, `source_as_of`
(**mandatory**), `source`, `provenance` (`loaded from session archive · no vendor call`), `license`,
`authorizes` (`nothing`), plus typed `market` / bars / trades body.

Successful **list** carries the same standing fields at the envelope (`framing`, `provenance`,
`license`, `authorizes`) plus `books[]` rows with `et_date` / `source_as_of` / `source`.

There is **no** required is/is-not prose block or payload-confirmation line on the HTTP envelope —
those are Future print-layer concerns, not v1 wire members. Miss/404 returns closed `detail` only
(no `RESEARCH READ — SESSION BOOK` claim when no row exists). List miss framing (if present) is
`RESEARCH READ — NO SESSION BOOK`.
<!-- spire:council-resolution:v1 d7d6144728016ee7b77ea219a89ad64553321ef38d89d019db664c19eed65a61 folded -->

## 5. Error handling

| Class | Operator / research sees | Trader sees | Log / retry |
|---|---|---|---|
| Archive serialize/write fail | No new session identity; operator log `session archive write skipped — trader path unchanged` | Nothing new | Log + drop; no retry storm on the request path |
| Archive not configured / disabled | **`session archive not storing`** · no false stored success · `store=error` | Desk up | Honest operator signal |
| Research miss (list empty or load 404) | Closed `no session book…` · `store=miss` · `vendor_called=false` | N/A | No vendor retry; no date substitution |
| Research unreadable (load) | **`session book unreadable: <reason>`** · `store=error` · `vendor_called=false` | N/A | No Massive fallback |
| List store fault | **`session archive store error: <reason>`** · distinct from unreadable | N/A | No Massive fallback |
| Empty/pruned ring (ring query) | Live **`no stored snapshot for <SYMBOL>`** on the ring vehicle | N/A | Must not be aliased to session miss; must not invent a new ring string |
| Bad / missing `et_date` | **422** (same family as ring `as_of` required/unparseable) | N/A | No vendor fetch |
| Ring prune | Session identity unaffected | Unchanged | Prune failure does not fail archive |
| Same-day second capture | First-wins no-op; still one identity | Unchanged | No overwrite |

Research-read error is **not** a license to hit Massive. Missing stays missing.

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/session-chain-archive/INTERFACE_CONTRACT.md`

**Summary:** This feature **adds** backend surface — a sibling session archive side-store (write is
off-path, not a trader route) plus operator/research **list** and **load** under
`/api/_research/session-books/...` (Railway-direct; Pages trader origin 404s the `_research`
prefix). It is **not** `NO_BACKEND_CHANGE`. No Massive hist-chain endpoints. No session archive on
trader routes. Transport/bytes are authoritative in the interface file; this section does not
restate field lists.

## 7. Testing strategy

**Automate (silent-regression class):**

- Capture during ET date D → session identity `(T, D)` exists; `source_as_of` present on load.
- Late-ET `as_of` (20:00–23:59 America/New_York) → `et_date` stays that ET calendar date (AC-27).
- Force / poison 48-ring prune → session identity still loadable; vendor-call counter 0.
- Second same-day capture → still exactly one `(T, D)` (first body retained).
- List + load with `vendor_called` stuck at false (including miss).
- Miss: closed `no session book…` detail; no date substitution.
- Ring empty vs session miss: live `no stored snapshot for <SYMBOL>` ≠ `no session book…`.
- Disabled archive: `session archive not storing`; desk still up; no false stored success.
- Unreadable body on load: `session book unreadable: …`; list I/O uses distinct store-error class.
- Archive write failure (Failing double) → desk still 200 / scan ok; no new session identity; no
  trader chrome.
- Score / tier / fingerprint byte-identity with archive on/off and write ok/fail.
- Secrets scan of serialized session blobs.
- Structural absence of session-archive chrome on trader routes (`apps/dashboard` empty-diff /
  affordance scan) — AC-15.
- Pages edge: `/api/_research` (and subpaths) 404 on the trader origin, matching `_metrics`.
- Research-read framing: no Live badge; closed `source: live_massive|fixture` carved out;
  mandatory `source_as_of` on hit; wire `framing` / `provenance` / `authorizes` present.
- Dedicated archive conformance seed `(SPY, 2020-01-02)` — not ring `CONFORMANCE_SEED_AS_OF`.
- Json path reject when equal/nested under ring path; default `data/session_chain_archive`.

**Review:**

- 48-cap not raised; program #2–#7 / Path-B rewrite not absorbed; operator path exists without
  trader UI; `authorizes: nothing` on hit envelopes.

**Integration shape:** one harness covering capture → await archive completion (list poll / barrier)
→ poison prune → load hit with `source_as_of` → second same-day capture still one identity → force
archive write fail → desk still OK.

## 8. Guardrails this feature must not break

From BRIEF Invariant watch (restated as binding for implementers):

- **`operator-vs-trader-path-separation`** — archive write and research list/load stay off the trader
  request path; unlinked from trader UI; no vendor fetch on a stored-blob read; no trader
  redistribution of stored books.
- **`best-effort-isolated-or-null`** — archive write failure never fails bundle / scan / SSE / ring
  capture success.
- **`additive-keeps-score-byte-identical`** — session bodies are never a scoring / tier / fingerprint
  input; authorizes **nothing** on the live score.
- **`no-secrets-in-image`** — reuse the serialize-then-persist boundary (`debug_assert_no_secrets`);
  archive stores the same body bytes, never env keys.
- **`absent-is-not-none`** — four closed outcomes remain distinguishable all the way to the research
  consumer (see §2.5 / §4); ring empty uses the **live** miss string, not an invented synonym.
- **`cited-code-is-verified-not-assumed`** — cite live Rust `chain_snapshot/{capture,store,wire}.rs`,
  `db/pg_chain_snapshot.rs`, `config.rs` retention defaults, `analytics.rs` `spawn_capture`,
  `routes/research_chain_snapshots.rs` (`miss_detail` → `no stored snapshot for {symbol}`), and
  `services/research/outcomes.rs` `session_date_et` — not Python; do not invent ring copy.
- **`structural-over-prose-enforcement`** — prune isolation is a separate store with no call from
  ring `prune_symbol`; proved by poison test; Json path collision rejected structurally.
- **Massive license** — stored snapshots remain **our research**, never redistributed on a trader
  route (same posture as shipped research chain snapshots).

## 9. Open questions

None that reopen owner rulings. Residual runner limit: interface conformance types check
shape/presence; exact closed string tokens for miss/framing/authorizes are owned by unit / GATE Q
assertions (noted in §3 method notes). Deferred print-layer is/is-not prose lives under §1 Future.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"e5519825d15bddd5fb17aa43ab9d78315ac2a2ba20481500e467a6c2c6934754","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":0,"conflict_id":"82f779ef57014910fbd1a93cfeadd06d0bbcf7aa2e4903a182a894953441a998","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":0,"conflict_id":"9f0471e32115187274f678d8fbaa65e57caac45691aff63b2defac20605d08ae","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":1,"conflict_id":"d7d6144728016ee7b77ea219a89ad64553321ef38d89d019db664c19eed65a61","disposition":"folded","section":"§4"}]}
-->
