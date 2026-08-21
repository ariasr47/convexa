# R1 — architect position: session-chain-archive

## Position

### Goal restated (technical shape)

Keep **one paid options book per symbol per ET calendar trading date** in a **sibling archive** that the existing `ChainSnapshotStore` dual retention (`chain_snapshot_max_per_symbol` default **48** and `chain_snapshot_max_age_secs` default **1_209_600** / 14d in live `apps/api/src/config.rs`) **cannot delete**. The archive is fed by **copying already-serialized capture bytes** off the trader path. Reads load stored bodies with **zero Massive I/O**. Blobs never enter scoring.

### Binding constraints restated

- **`operator-vs-trader-path-separation`** — archive write and research list/load stay off the trader request path; no vendor fetch on a stored-blob read; no trader UI surface.
- **`best-effort-isolated-or-null`** — archive write failure never fails bundle / scan / SSE / ring capture success; desk stays up.
- **`additive-keeps-score-byte-identical`** — session bodies are never a scoring / tier / fingerprint input (module boundary: signals/score never import the archive).
- **`no-secrets-in-image`** — reuse the existing serialize-then-persist boundary (`capture.rs` `debug_assert_no_secrets` on ring bytes); archive stores the same body bytes, never env keys.
- **`absent-is-not-none`** — three closed absence classes must remain distinguishable in types / store outcomes all the way to the research consumer: **`no session book`** (never archived for that identity) ≠ **empty / pruned intraday ring** ≠ **archive store disabled or unreadable**.
- **`cited-code-is-verified-not-assumed`** — this position cites live Rust `chain_snapshot/{capture,store}.rs`, `db/pg_chain_snapshot.rs`, `config.rs` retention defaults, `analytics.rs` `spawn_capture` hooks, and `services/research/outcomes.rs` `session_date_et` — not Python `scanstore`, not `scan_bundles`.
- **`structural-over-prose-enforcement`** — prune isolation is a **separate store** with **no call from ring `prune_symbol`**; proved by a poison test that fills/force-prunes the 48-ring and still loads the session identity.
- **Massive license** — stored snapshots remain **our research**, never redistributed on a trader route (same posture as shipped `research_chain_snapshots`).

### Non-goals (explicit)

- Do **not** raise the 48-per-symbol ring cap or stretch 14-day age to “keep a day.”
- Do **not** buy vendor hist-chain / P7.
- Do **not** force-capture SPY/QQQ/IWM when gex-cache is warm (program `keep-paid-books` #2).
- Do **not** move bodies to object storage (program #7); local/Postgres BYTEA sibling is v1.
- Do **not** change live scoring, tier, or fingerprint.
- Do **not** add trader UI.
- Do **not** add vendor fetches on archive or research read.
- Do **not** put session rows in `chain_snapshots` behind a “skip me” flag — that is prose retention, not structural isolation.

### Session identity (data-structure content)

| Field (content, not wire name) | Meaning | Mechanism |
| --- | --- | --- |
| **symbol** | Uppercased ticker | Same normalize as ring store (`trim` + ASCII uppercase). |
| **et_date** | America/New_York **calendar date** `YYYY-MM-DD` of the captured book’s `as_of` | Derive with the same ET wall-clock date rule already live in `services/research/outcomes.rs` `session_date_et` (UTC → `chrono_tz::America::New_York` → date). **Do not** reuse `quant_engine::session_date_from_ns` — that helper is **UTC** day and would mis-bucket late ET evenings. |
| **body** | Serialized paid capture blob | **Byte-copy** of the ring append payload (`serialize_capture` output already written by `capture_into`). No re-fetch, no re-serialize from vendor. |
| **source_as_of** | Provenance: which ring identity was copied | The ring’s `as_of` timestamp for the copied row — so first-wins is auditable when a later same-day capture is ignored. |
| **source kind** | live_massive / fixture | Copied from the wire row, same vocabulary as `SnapshotMeta`. |

**Primary key:** `(symbol, et_date)` — exactly one session identity per symbol per ET date.

**Eligibility:** any successful paid ring append whose `as_of` yields an `et_date` is a candidate. v1 does **not** gate on `MarketPhase::Rth` only — pre/post RTH captures still preserve a paid book for that ET calendar date. (Attackable if product insists on RTH-only; see assumptions.)

### Conflict policy + when the copy is taken

**Decision: promote on every successful ring append; first-wins on `(symbol, et_date)`.**

- **When:** immediately after a successful `ChainSnapshotStore::append` inside the existing off-path `capture_into` / `spawn_capture` pipeline (`analytics.rs` already hooks scanner + cold compute; warmer remains excluded). Mechanism: after ring append Ok, call a separate best-effort `archive_session` with the **same** `(wire, body)` already in hand — no second vendor round-trip.
- **Conflict:** **first-wins** — insert-if-absent (`ON CONFLICT DO NOTHING` / in-memory `contains_key` skip), mirroring ring idempotency and `IvStore::upsert_if_absent`. A second capture the same ET day does **not** create a second session identity and does **not** overwrite the first body.
- **Rejected for v1 — last-wins / last-RTH / explicit close job:** higher complexity (clock window, missed-close holes, UPDATE races) for a BRIEF that only requires one surviving book per day. Decisive axes: **complexity** and **team familiarity** (first-wins already shipped in IV + ring conflict). Last-RTH selection can later overwrite by policy without changing the `(symbol, et_date)` key if product demands it — provenance `source_as_of` keeps the change measurable.

### Archive backend (component boundary)

Introduce a **sibling store** — conceptually `SessionChainArchive` — parallel to `ChainSnapshotStore`, **not** a mode of it.

| Backend | Role | Prune relationship |
| --- | --- | --- |
| Disabled | Archive off → research reads report store-disabled / not-storing class | N/A |
| Memory | Hermetic tests | No shared map with ring memory |
| Json | Sibling directory (config path distinct from `chain_snapshot_store_path`) | Ring `persist_symbol` / `prune_symbol` never open this dir |
| Postgres | Sibling table (e.g. PK `(symbol, et_date TEXT)`, body BYTEA + provenance columns) | Ring `DELETE FROM chain_snapshots …` cannot name this table |

**Structural prune isolation:** `capture_into` continues to call `store.prune_symbol` **only** on the ring store. The session archive exposes **no prune API in v1** (or a stub never called from capture). Growth until program #7 is accepted; unbounded delete of session rows is out of scope.

**Poison test (required by BRIEF invariant watch):** plant a session identity; append >48 ring rows (or call ring prune with tiny caps); assert session load by `(symbol, et_date)` still returns the body. A guard that only comments “do not delete session rows” inside ring prune is **not** enforcement.

### Data flow

```
paid VendorBundle (already fetched)
  → spawn_capture (tokio task; trader path already returned / scan continues)
    → capture_into:
         serialize_capture → ring.append → ring.prune_symbol (48 + 14d)
         on append success → archive_session_best_effort(copy body under et_date)
              insert-if-absent (first-wins)
              on archive err → warn + return Ok to caller of capture (desk unchanged)
  → research list/load by (symbol, et_date) → stored bytes only → vendor_called stays false
```

Path-B / `batch-backtest` / `replay-outcome-join` consumers stay on **stored blobs**; session archive is an additional durable grain they can be pointed at later. v1 does **not** require rewriting those CLIs — only that the session identity remains loadable after ring prune.

### Isolation / error rules

| Failure | Mechanism | Observable outcome |
| --- | --- | --- |
| Archive store disabled / failed open | Separate enabled flag or Disabled variant | Research absence class = store not storing; ring capture may still run |
| Archive insert I/O error | Best-effort warn; never bubble to bundle/SSE | No new session identity; ring row may still exist until pruned |
| Ring prune failure | Existing warn in `capture_into`; independent of archive | Session row unaffected |
| Corrupt / unreadable session body | Load returns unreadable class — not empty book, not “no session book” | Consumer must handle distinctly (`absent-is-not-none`) |
| Day with no successful capture | No insert attempted | Honest **`no session book`** for that `(symbol, et_date)` — including SPY/QQQ/IWM when never captured (#2 not in scope) |

Archive work must not sit on the ticker request latency path: keep using `spawn_capture`’s fire-and-forget task (or an equivalent post-return task). An archive stall must not delay or fail the trader response.

### Component boundaries

- **Owns:** session identity content, first-wins insert, sibling store backends, ET date derivation, prune isolation, absence classes, best-effort error isolation, non-goals above.
- **Touches lightly:** one call site after successful ring append inside the capture leaf; config for sibling path / enable.
- **Must not import into:** signals, opportunity score, tier, fingerprint, gate, engine scoring path.
- **Does not own:** research HTTP path shapes, JSON field names, operator copy, UI/layout (none for trader; operator presentation is other lanes + synthesizer).

### Option comparison (archive placement)

| Option | Complexity | Cost | Scalability (BRIEF load) | Familiarity | Verdict |
| --- | --- | --- | --- | --- | --- |
| A. Sibling store/table/dir (chosen) | Low–med | One new module + backends | One row/symbol/day; fine until #7 | High (mirrors `ChainSnapshotStore`) | **Win — structural prune isolation** |
| B. Flag on `chain_snapshots` + prune skip | Low code, high hazard | Touches prune SQL | Same | Med | Reject — prose retention; poison test fights the same DELETE |
| C. Raise 48 / 14d | Trivial | Storage explosion | Fails BRIEF (“reprints this afternoon”) | High | Reject — explicit non-goal |
| D. Object store now (#7) | High | Ops + new dependency | Better long-term | Low here | Reject — queued program item |

Decisive axis for A over B: **structural-over-prose-enforcement** (BRIEF-binding), not elegance.

## Risks I see

1. **UTC vs ET bucketing** — accidentally using `session_date_from_ns` (UTC) would put 20:00–23:59 ET captures on the next UTC date; mechanism must pin New_York via `session_date_et`-class logic and unit-test a late-ET `as_of`.
2. **First-wins morning book** — corpus quality may be weaker than a close book; product may later demand last-RTH. Mitigate with stored `source_as_of` so a policy flip is a deliberate overwrite, not a key change.
3. **Shared-directory footgun** — defaulting the Json archive path under the ring directory invites a future “clean data/chain_snapshots” script to delete session files; sibling path must be config-distinct and documented in ops terms (not UI).
4. **Dual enable flags** — ring enabled / archive disabled (or the reverse) must map to distinct absence classes; collapsing them fabricates “no session book” when the store is actually off.
5. **Postgres migration coupling** — a careless migration that FKs or ON DELETE CASCADE from `chain_snapshots` would re-break prune isolation; session table must be free of cascade from the ring table.
6. **Growth without #7** — one full book/symbol/day is much smaller than 48×/day but still accumulates; v1 accepts no session prune — call that out so #7 stays honest backlog, not surprise disk pressure.

## Assumptions I'm making about the other two lanes

- **PM** will accept **first-wins** (first successful paid capture of the ET date) as the v1 conflict policy rather than last-wins or mandatory last-RTH close selection; if PM requires close-only, my promotion trigger and eligibility claims need a GATE-visible revision.
- **PM** will treat a day with **no capture** (including liquid names never forced this feature) as success-criteria **`no session book`**, not as a defect of this ship — program #2 stays out of acceptance for #1.
- **PM** will require the prune-poison scenario (ring wiped, session identity still loadable) as a must-pass acceptance row, matching `structural-over-prose-enforcement`.
- **UX** will not invent a trader-facing surface for session books; any operator presentation stays on the research/operator path family already used for stored chain snapshots (unlinked from trader chrome).
- **UX** will preserve three distinct absence presentations for **no session book** vs **empty/pruned ring** vs **archive store disabled/unreadable**, and will not collapse them into one empty-state glyph.
- **UX / interface (via synthesizer later)** will key session list/load on **`(symbol, et_date)`**, not on ring `as_of` alone — provenance `source_as_of` may be shown but is not the session identity.
- **Neither lane** will propose raising the 48 cap, buying hist-chain, force-capturing SPY/QQQ/IWM, or moving bodies to object storage inside this feature’s scope.
- **PM** owns whether Path-B CLIs must **consume** the session archive in this same ship or only that the archive **exists and loads**; I assume **existence + loadability after prune** is the decision impact, with CLI re-point optional follow-on unless PM hard-requires it.
)
