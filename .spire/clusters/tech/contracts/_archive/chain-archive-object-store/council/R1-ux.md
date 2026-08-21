# R1 — ux position: chain-archive-object-store

## Position

### Product surface verdict

**`NO_UI_CHANGE`.** This ship moves **session-archive bodies** (and, if Architect names it,
ring-snapshot bodies) **off app-Postgres BYTEA / unbounded workspace JSON** into object storage
or a dedicated volume so paid books can accumulate without the OLTP disk becoming retention
policy. It does **not** add a route, component, token, motion, Settings row, Ask-AI line,
Ticker chip, Scanner badge, Positions affordance, or `/_ops` “storage health” chrome. Anyone
proposing trader UI that says books are “stored in S3,” “on the volume,” or “migrated off
Postgres” is **re-scoping**.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (`Status: SET` — The
Curvature Terminal). **Design direction:** does not apply — no trader presentation ships; no
`DESIGN_SYSTEM.md` amendment. SPEC §4 must carry **`NO_UI_CHANGE`** and must not restate the
token table.

Closed operator vocabulary is **already shipped** by `_archive/session-chain-archive/SPEC.md`
§4. This feature **reuses** that vocabulary; it does **not** invent a second deck, a fifth
absence class, or storage-backend product labels.

### Intended user / primary job (operator research only)

| Axis | Binding |
|---|---|
| **Intended user** | Research operator / owner verifying session books via `/api/_research/session-books/...` (Railway-direct). **Not** the signed-in trader on Landing / Ticker / Positions / Scanner / Settings / Ask-AI. |
| **Primary job** | After a session book is archived, research list/load still returns the body with mandatory `source_as_of` and `vendor_called=false`; when the body cannot be read, the operator sees an honest closed fault — never a silent Massive refill and never a storage-branded excuse string. |
| **Information structure** | Same HTTP wire as shipped session archive: hit envelope carries `framing`, `et_date`, `source_as_of`, `provenance`, `license`, `authorizes: nothing` (+ market body on load); miss/404 is closed `detail` only. Storage location is **not** a wire field the UI consumes and **not** operator chrome. |
| **User vocabulary** | Exact §4 strings from `session-chain-archive` (below). Ban: “stored in S3,” “object store miss,” “volume unavailable,” “BYTEA migrated,” “off Postgres,” or any synonym that renames a miss/unreadable into infrastructure marketing. |

### Component states

**Trader path (S0) — one required state: unchanged.**

Object-store put/get success, object missing behind a pointer, store misconfig, migration of
existing bodies, and (if named) ring-body relocation are **all invisible** on Landing / Ticker /
Settings / Ask-AI / Scanner / Positions / shell nav. Trader empty/error/offline/`unavailable this
cycle`/`—` copy does not change. No toast, badge, Settings “research corpus storage” section, or
Ask-AI “we kept Tuesday’s book on object storage” line.

**Operator research read (S1) — reuse shipped matrix; no new state names.**

| State | When (this feature) | What the operator sees | What must **not** happen |
|---|---|---|---|
| Default (session hit) | Identity `(symbol, et_date)` exists and body loads from the (relocated) store | Wire: `framing` = `RESEARCH READ — SESSION BOOK`, `et_date`, mandatory **`source_as_of`**, `provenance` = `loaded from session archive · no vendor call`, `license`, `authorizes: nothing` (+ market body on load) | Live badge; Massive on the read; surfacing bucket/volume/path; treating `source_as_of` as the identity key; claiming “fresh because off Postgres” |
| Loading | **N/A** (HTTP request/response) | No loading field / phase line | Inventing “fetching from S3…” / “reading object store…” chrome |
| Empty — no session book | No archive **identity** for that pair / empty list | **`no session book for <SYMBOL> on <ET_DATE>`** (dated load) / **`no session book for <SYMBOL>`** (list empty) | Ring miss string; trader `—` / `unavailable this cycle`; “not in object store”; fabricating an empty book |
| Empty — empty/pruned ring (distinct) | Operator queries the **ring** vehicle and ring count is zero | Live **`no stored snapshot for <SYMBOL>`** | Aliasing ring miss ↔ session miss; inventing `empty 48-ring…`; inventing ring “S3 miss” copy |
| Error — not storing | Archive disabled / unavailable | **`session archive not storing`** · `store=error` | Treating as miss; silent Massive recovery; “S3 not configured” as a new product string |
| Error — unreadable (load) | Identity / pointer present but **body** missing, corrupt, or unreadable (including missing object behind a thin index) | **`session book unreadable: <reason>`** · `store=error` · `vendor_called=false` | Treating as miss; treating as not-storing; list store-error alias; **silent Massive refill**; renaming to “object missing in S3” |
| Error — list store fault | List metadata I/O failure | **`session archive store error: <reason>`** · distinct error code | Aliasing to `session_book_unreadable`; inventing storage-branded list chrome |
| Same-day second capture | Later paid capture same ET day | Still **one** `(symbol, et_date)`; first body retained | “v2 session book”; duplicate ET-date rows; “re-uploaded to object store” chrome |
| Post-prune retention | Ring pruned; session identity remains | Session book **still loadable** (no required companion ring-status string on the session read) | Claiming the day’s research is gone because the ring pruned; claiming “only metadata left on Postgres” as trader/ops chrome |
| Archive write skipped | Write failed after paid path otherwise succeeded | Operator log only: `session archive write skipped — trader path unchanged` | Toast on Ticker; failing bundle/scan/SSE; “upload to S3 failed” trader copy |
| Stale / offline | N/A as trader SSE / freshness marketing | — | “Live offline” chip; “stale object”; inventing age labels beyond shipped `source_as_of` |

**Pointer + missing body is not a new class.** BRIEF decision impact: a missing object is honest
`session book unreadable` / `no session book` — mapped onto the **shipped** unreadable vs miss
rows above. Do **not** mint a fifth absence class for storage backend.

### Closed vocabulary (binding — reuse shipped §4; do not invent a second deck)

Reuse `_archive/session-chain-archive/SPEC.md` §4 exactly:

| Concept | Approved term / exact string | Banned (this ship) |
|---|---|---|
| Prune-proof day identity | **session book** / **session archive** / `(symbol, et_date)` | “live book”, “hist-chain product”, “raised 48-cap row”, “S3 book”, “object-store row” |
| Intraday dual-retention ring | **48-ring** / **ring snapshot** / **stored chain snapshot** | calling the ring a “session archive”; ring “S3 snapshot” chrome |
| When the session identity was taken | **`et_date`** (ET `YYYY-MM-DD`) · **`source_as_of`** (UTC) | “last updated”, “fresh”, “current book”, “now”, “uploaded at” |
| How obtained on read | **`loaded from session archive · no vendor call`** | “refreshed”, “fetched”, “synced from Massive”, “loaded from S3”, “streamed from volume” |
| Day with no capture | **`no session book for <SYMBOL> on <ET_DATE>`** (load) / **`no session book for <SYMBOL>`** (list empty) | ring miss string; `no options`; trader `—`; “not in object store” |
| Empty/pruned ring (ring vehicle) | Live **`no stored snapshot for <SYMBOL>`** | Inventing **`empty 48-ring for <SYMBOL>`**; using session miss strings |
| Store disabled | **`session archive not storing`** | treating as miss; treating as unreadable; “bucket disabled” as product copy |
| Identity present, body bad (load) | **`session book unreadable: <reason>`** | treating as miss; treating as not-storing; list I/O alias; “S3 NoSuchKey” / “object missing” as a **new** closed string |
| List metadata I/O fault | **`session archive store error: <reason>`** | aliasing to unreadable |
| Score posture (hit) | **`authorizes: nothing`** | implying live score uses archived books |
| License | **Our research · not redistributed on a trader route.** | “shareable feed”, “customer historical options API” |

Four mandatory-distinct operator outcomes — never interchangeable:
`no session book…` ≠ live ring `no stored snapshot…` ≠ `session archive not storing` ≠
`session book unreadable: <reason>`.

**Hard ban — live-as-market-feed:** on any research read of a session book, `live` / `LIVE` as a
badge or “this quote is live” label is forbidden. Closed lineage `source: live_massive` \|
`fixture` remains provenance only.

**Hard ban — storage-backend chrome:** operator/trader surfaces must not advertise the physical
store (S3-compatible, Railway volume, filesystem path, BYTEA, pointer). Backend location is an
Architect adapter fact, not user vocabulary. `<reason>` on unreadable may be an opaque store
fault string Architect already uses — it must not become a second closed taxonomy of
bucket/volume product phrases.

**v1 research-read surface = HTTP wire fields (binding, shipped):**

Successful **load** carries: `framing` (`RESEARCH READ — SESSION BOOK`), `et_date`,
`source_as_of` (**mandatory**), `source`, `provenance` (`loaded from session archive · no vendor
call`), `license`, `authorizes` (`nothing`), plus typed market body.

Successful **list** carries the same standing fields at the envelope plus `books[]` rows with
`et_date` / `source_as_of` / `source`.

Miss/404 returns closed `detail` only. List miss framing (if present) is
`RESEARCH READ — NO SESSION BOOK`. No required “is/is-not” prose block; no storage-location
field on the envelope.

### Flows (operator / research only)

1. Paid capture / ensure path archives a session identity; body lands in the object/volume store
   Architect names — **invisible** on the trader path; object I/O must not sit on the trader
   request path.
2. Operator lists session books via `GET /api/_research/session-books/{symbol}` — list metadata
   from thin index; **zero Massive**.
3. Operator loads one `(symbol, et_date)` → body with mandatory `source_as_of`;
   `vendor_called=false`.
4. After 48-ring prune, the same session identity still loads.
5. Missing identity → exact **`no session book…`**. Pointer/identity without readable body →
   exact **`session book unreadable: <reason>`** — never silent Massive refill.
6. (If Architect also moves ring bodies) ring list/load keeps live ring miss string
   **`no stored snapshot for <SYMBOL>`** — still distinct from session miss; no new ring
   object-store chrome.

### Acceptance criteria (UX-owned states + Verify by)

Actors: research operator / owner. Every user-visible / user-silence row maps to S0 or S1.
**(SB)** = ship-blocking for this feature’s honesty surface. (PM may renumber into SPEC §3; marks
travel with the rows.)

| # | Story | Acceptance criterion | State(s) | Verify by |
|---|---|---|---|---|
| AC-U1 **(SB)** | US-T: As the desk owner, I want zero trader chrome for the storage move. | `apps/dashboard` gains **no** new route, nav item, Settings copy, Ask-AI line, Ticker/Scanner/Positions affordance, tooltip, or `/_ops` chrome mentioning object storage / S3 / volume / BYTEA / “session bodies moved.” | S0 unchanged | test |
| AC-U2 **(SB)** | US-T | Trader empty / error / offline / `unavailable this cycle` / `—` copy is **byte-unchanged** by object-store put/get success, missing object, or store fault. | S0 unchanged | test |
| AC-U3 **(SB)** | US-O: As the research operator, I want load still honest after bodies leave Postgres. | Successful research **load** of an archived `(symbol, et_date)` is a **hit** with mandatory **`source_as_of`**, `framing` = `RESEARCH READ — SESSION BOOK`, `provenance` = `loaded from session archive · no vendor call`, `authorizes` = `nothing`, and **zero live Massive calls** (`vendor_called` false) — no Live badge. | S1 Default | test |
| AC-U4 **(SB)** | US-O | Successful **list** for a symbol completes with **zero live Massive calls** and hit rows still carry **`source_as_of`** per shipped list shape. | S1 Default | test |
| AC-U5 **(SB)** | US-O / honesty | When no session **identity** exists for `(symbol, et_date)`, dated load reports exactly **`no session book for <SYMBOL> on <ET_DATE>`** (list empty: **`no session book for <SYMBOL>`**) and does **not** call Massive to create one. | S1 Empty — no session book | test |
| AC-U6 **(SB)** | US-O / honesty | When identity/pointer exists but the body is missing/corrupt/unreadable (including missing object), research load reports **`session book unreadable: <reason>`** — distinct from miss and not-storing — with **zero Massive calls** (no silent refill). | S1 Error — unreadable | test |
| AC-U7 **(SB)** | US-O / honesty | Miss/unreadable/`detail` is **never** rewritten to “stored in S3,” “object store miss,” “volume unavailable,” “BYTEA migrated,” “off Postgres,” or any storage-backend synonym that renames the shipped classes. | S1 Empty / Error rows | test |
| AC-U8 **(SB)** | US-O / honesty | The four shipped absence classes remain distinguishable end-to-end: session miss ≠ ring `no stored snapshot…` ≠ `session archive not storing` ≠ `session book unreadable: <reason>`. No fifth storage class. | S1 Empty / Error rows | test |
| AC-U9 **(SB)** | US-O | A research miss does **not** silently substitute another date’s book; missing stays missing. | S1 Empty — no session book | test |
| AC-U10 **(SB)** | US-O | Same-ET-day second capture leaves **exactly one** session identity; no “v2” / “re-uploaded” labeling on the research read. | S1 Same-day second | test |
| AC-U11 **(SB)** | US-O | After 48-ring prune, a previously archived `(symbol, et_date)` remains loadable as a **session book** (framing does not claim the ring still holds it). | S1 Default + post-prune | test |
| AC-U12 **(SB)** | US-T / isolation | Archive / object write failure produces **no** trader-visible chrome and does not change trader degraded-state wording; operator log family remains `session archive write skipped — trader path unchanged`. | S0 + write skipped | test |
| AC-U13 **(SB)** | US-O | Hit research list/load that surfaces session books states **`authorizes: "nothing"`**; license posture remains research-not-redistributed. | S1 Default | test |
| AC-U14 **(SB)** | US-T | No new motion keyframes, arc spends, or hardcoded hex are introduced; no `DESIGN_SYSTEM.md` amendment. | N/A (no UI) | test |
| AC-U15 | US-scope | SPEC §4 carries **`NO_UI_CHANGE`**; no trader-facing storage status is required or proposed. | S0 / canon | review |
| AC-U16 | US-O | Operator verification remains available **without** the trader UI via `/api/_research/session-books/...`. | S1 Default / Empty / Error | review |
| AC-U17 | US-scope | Exact mandatory framing / provenance / closed miss strings match shipped `session-chain-archive` §4 wording (reuse, not rewrite). | S1 Default / Empty / Error | review |

**Method notes (risk-based):**

- **`test`** — silent regressions: trader chrome absence (structural empty-diff / affordance
  scan on `apps/dashboard`), hit + mandatory `source_as_of` + zero-vendor research read after
  body relocation, exact miss vs unreadable (including missing-object → unreadable, not Massive
  refill), four absence classes, ban on storage-backend rename strings, no date substitution,
  first-wins uniqueness, post-prune loadability, trader copy byte-identity on write fault,
  `authorizes: nothing`, no new motion/tokens.
- **`review`** — intentional non-surfaces (`NO_UI_CHANGE` in SPEC §4), positive operator path
  without trader UI, wording parity with shipped §4 copy table (visible/intentional).
- No DOM harness required for ship; trader silence is structural.
- Exact closed strings asserted by unit / GATE Q; do not invent parallel “S3” copy fixtures.

### Microcopy integrity (defining failure mode)

| Claim | Vouched by | Disposition |
|---|---|---|
| Hit shows a session book for `(symbol, et_date)` | Research list/load `store=hit` + identity | Allowed |
| Mandatory `source_as_of` on hit | Wire field present on successful list/load | Allowed — never optional |
| Provenance `loaded from session archive · no vendor call` | `vendor_called=false` on research read | Allowed |
| Miss means no archived identity | Exact `no session book…` detail | Allowed |
| Unreadable means identity/pointer without readable body | Exact `session book unreadable: <reason>` | Allowed — covers missing object |
| “Stored in S3” / “on the volume” / “off Postgres” | **No operator/trader field this ship owns** | **Withdrawn / banned** — renames location into product meaning |
| “Fresh / current / live book” because bodies moved | **No field** | Banned — `source_as_of` is provenance, not freshness marketing |
| Silent Massive refill when object missing | Would violate BRIEF + Massive license | Banned — unreadable/miss stays closed; `vendor_called=false` |
| Fifth absence class for object-store | Would break shipped quartet | Banned |

### Out of UX scope (hand to other lanes)

- Prod adapter choice (S3-compatible / Railway volume / env path) and whether the 48-ring also
  moves this ship (Architect).
- Pointer schema, migration of existing BYTEA rows, Path-B CLI open-the-same-store mechanics
  (Architect).
- Whether list metadata stays in Postgres vs a thin index elsewhere (Architect) — UX only requires
  list/load outcomes and closed strings stay shipped.
- Product sequencing vs corpus wait / AI-rec lab P4 / hist-chain / raise-48 (PM) — UX only requires
  research honesty under closed strings when the BRIEF’s decision-impact observation holds.

## Risks I see

1. **“Helpful” storage chrome.** Highest-probability product drift for this BRIEF: Settings,
   `/_ops`, or Ask-AI lines that say books are “now in S3 / on the volume.” That invents trader
   meaning the data does not need and violates `NO_UI_CHANGE` +
   `operator-vs-trader-path-separation`. AC-U1/AC-U7 exist so that impulse fails a test, not a
   debate.
2. **Fifth absence class.** Naming “object store miss” separately from `session book unreadable`
   / `no session book` collapses `[absent-is-not-none]` and reopens shipped vocabulary. AC-U6/U8.
3. **Silent Massive refill on missing object.** The BRIEF’s decision impact forbids it; operator
   copy that says “refreshing” or a read path that vendor-fills would be a license/honesty
   incident. AC-U3/U6.
4. **Collapsing miss and unreadable** after pointer migration (identity row without body treated
   as `no session book`). That fabricates “we never captured.” AC-U5 vs AC-U6 must stay distinct.
5. **Post-prune “corpus gone” copy** because someone equated Postgres emptiness with research
   absence while the object store still holds the body — or the reverse. AC-U11.
6. **Claiming DESIGN_SYSTEM work.** Restating tokens in SPEC §4 or inventing an amendment for a
   no-UI ship creates dual authority for nothing. AC-U14/U15.
7. **My own failure mode, named:** inventing adapter names, bucket URLs, retention GB figures, or
   “stored in S3” as operator vocabulary. Those are Architect/ops facts. If the synthesized SPEC
   contains session-book copy that asserts a storage brand I authored without a vouched
   operator-facing field, that is a defect — **withdraw it**.

## Assumptions I'm making about the other two lanes

- **Architect** relocates **bodies** behind the existing `SessionChainArchive` (and, if named,
  ring) seam so research list/load wire fields and closed miss/unreadable `detail` strings stay
  **byte-compatible** with shipped `session-chain-archive` — including mandatory `source_as_of` on
  hit — with **no** new miss enum member for “S3” / “volume” / “BYTEA.”
- **Architect** maps **missing object behind a present identity/pointer** to the shipped
  **`session book unreadable`** class (not miss, not a fifth class) and keeps research reads at
  **`vendor_called=false`** with **zero Massive**, including on miss and unreadable — so UX can
  ban silent refill without lying.
- **Architect** keeps object I/O **off the trader request path**, so S0 unchanged and desk
  latency/error chrome do not gain storage faults.
- **Architect** leaves list metadata sufficient for shipped list shape (`et_date` /
  `source_as_of` / `source` on rows) without requiring the UI to consume a storage-location field.
- **Architect** does not require Path-B / research CLIs to print new storage-backend chrome;
  opening the same store may change internals only.
- **PM** keeps acceptance language aligned with **reuse** of session-book vocabulary and the
  BRIEF’s observed outcomes (load still works; DB does not hold the BYTEA / holds pointer only;
  missing object is honest unreadable/miss) rather than introducing user-visible “S3 migration”
  product terms.
- **PM** will not require trader-facing confirmation that bodies moved (no Settings checklist, no
  Ask-AI disclosure, no `/_ops` storage browser) — decision impact stays operator list/load
  observation.
- **PM**’s AC set includes ship-blocking rows for: no trader UI; archive/object write failure does
  not fail bundle/scan/SSE; score/tier/fingerprint byte-identical; zero Massive on research
  list/load; prune cannot delete session identity; missing object ≠ silent Massive refill — so
  AC-U2/U3/U6/U11/U12 are backed by product criteria, not only UX prose.
- **Both lanes** accept `NO_UI_CHANGE` + **no** `DESIGN_SYSTEM` amendment as binding; any UI or
  canon amendment request (including “stored in S3” trader chrome) is a product conflict for R2,
  not a silent SPEC §4 fill.
- **Neither lane** reopens hist-chain purchase, raise-the-48-cap, AI-rec lab P4, or trader
  redistribution of stored books under this feature’s copy surface.
