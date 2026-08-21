# liquid-names-session-capture — spec

**Source brief:** .spire/clusters/tech/contracts/liquid-names-session-capture/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md   (under council/)
**Status:** approved 2026-08-20 (owner A — plan and build)

## 1. Goal + scope

Guarantee a **session-archive book** for the closed liquid set **SPY, QQQ, and IWM** on each
America/New_York **weekday** `D` while the session-archive store is enabled — **even when
`gex_cache` stays warm all day**. Today `spawn_capture` / `archive_session_best_effort` only run on
cache-miss compute (`load_or_compute` / cold ticker compute); a warm hit never hands a
`VendorBundle` to capture, so lab names can finish the day with honest `no session book` (observed
for QQQ). This ship closes that hole with an off-path ensure. Research list/load stays zero-Massive.
No trader UI. Authorizes nothing on the live score. Does not absorb program #3–#7.

**In scope:**

- Closed-set off-path **ensure** for **SPY, QQQ, IWM only**: presence short-circuit → promote
  same-ET ring snapshot (zero Massive) → else bounded force-compute that **awaits archival**.
- Dedicated ensure worker; capture is **not** bolted onto `refresh_analytics`.
- Optional non-blocking wake from scanner/ticker warm traffic into that worker only — never
  request-scoped Massive / force-compute.
- Reuse of shipped session identity `(symbol, et_date)`, first-wins archive, and research
  list/load under `/api/_research/session-books/...` (zero Massive on read; mandatory
  `source_as_of` on hit).
- Same-day **spaced retries** after a failed Massive/force-compute while identity is still
  absent; at most one in-flight `(T, D)` singleflight; deadline = end of ET calendar day D.
- Checkable AC-1–3 eligibility: closed trio ∩ ET weekday ∩ archive store enabled (no invented
  Massive holiday calendar).
- Honest absence: ensure-off / never-paid / attempted-and-still-absent → `no session book`;
  store down → `session archive not storing`; four shipped classes only.
- Desk + score isolation; secret-free blobs; research-only Massive posture.

**Out of scope:**

- Raising the 48-per-symbol cap or stretching 14-day ring retention.
- Buying Massive hist-chain / PIT (P7).
- Force-capturing the whole paid-capture universe / expanding beyond SPY/QQQ/IWM.
- Program #3 `paid-book-join-smoke`, #4 weekly digest, #5 corpus wait, #6 AI-rec lab P4,
  #7 object-store migration.
- Any trader UI, trader route, nav, Settings, Ask-AI, Scanner, Positions chrome, or redistribution
  of stored books as a trader feed.
- Changing live score / tier / gate / fingerprint.
- Rewriting Path-B / `batch-backtest` / `replay-outcome-join` CLIs.
- Minting new miss taxonomy, ensure-pending chrome, or “not a lab name” copy.
- Putting extra Massive on the trader request path or on research list/load.
- Inventing a Massive / exchange holiday calendar as an AC excuse (live Rust has none —
  `MarketPhase::classify` is weekday + 09:30–16:00 ET only).

**Future (deliberately deferred):**

- Join-smoke on real Tuesday books once the three names reliably archive (program #3).
- Weekly score-lab ritual growth (program #4); multi-week corpus (program #5); AI-rec lab P4
  (program #6); object-store migration (program #7).
- Expanding ensure beyond SPY/QQQ/IWM (separate scope decision).
- Vendor hist-chain **if** later purchased (separate GATE I).

## 2. Architecture

### Problem (verified live Rust)

Session archive is fed only after a paid `VendorBundle` reaches `spawn_capture` → `capture_into` →
`archive_session_best_effort` (`apps/api/src/services/chain_snapshot/capture.rs`,
`apps/api/src/services/session_chain_archive/archive.rs`). That hand-off exists on cache-miss
compute in `load_analytics` / `load_or_compute` (`apps/api/src/services/analytics.rs`), but a warm
`gex_cache` hit in `load_or_compute` returns the snapshot and **never** calls `spawn_capture`. The
warmer path `refresh_analytics` intentionally drops `_vendor` and must not capture. Net: SPY /
QQQ / IWM stay hot via warmer + scanner warm hits and can miss Tuesday’s prune-proof book.

Sibling `session-chain-archive` identity, first-wins, prune isolation, and research list/load are
**shipped and not reopened**.

Live note (binding): `spawn_capture` is fire-and-forget (`tokio::spawn` of `capture_best_effort`);
`capture_best_effort` no-ops archival when the ring is Disabled. Ensure must **not** treat
`spawn_capture` as “archival completed.”

### Chosen mechanism: closed-set off-path ensure = promote-from-ring, else bounded force-compute

Introduce a **one-way leaf** ensure for the compile-time / config-fixed trio `{SPY, QQQ, IWM}`
only — structurally **not** `DEFAULT_LIQUID`’s ten names, not `warm_symbols` alone, and not
`universe.json` scanner membership. Trigger is a **dedicated off-path ensure worker**. Capture is
**not** bolted onto `refresh_analytics`.

**Ensure enable dial (distinct from store):** name
`LIQUID_SESSION_ENSURE_ENABLED` (default **true**; `0`/`false`/`no`/`off` skips the worker). This
is **disjoint** from `SESSION_CHAIN_ARCHIVE_ENABLED` (archive store). Ensure-off + store-on →
AC-10 `no session book`. Store-off → AC-13 regardless of the ensure dial.

For each name `T` ∈ `{SPY, QQQ, IWM}` and current America/New_York calendar date `D`
(`et_date_from_as_of` / clock → same New_York rule as the shipped archive):

1. **Presence short-circuit.**
   - `SessionChainArchive::load(T, D)` → `Ok(Some(_))` → **done**. No Massive. No further
     force-compute for that identity.
   - `Ok(None)` → continue ladder (true miss).
   - `Err` with store Disabled / `"session archive not storing"` → **AC-13 skip**: do **not**
     treat as miss, do **not** enter promote or paid force-compute. Desk unchanged.
2. **Promote existing ring snapshot (zero Massive).** On archive miss (`Ok(None)`): attempt
   `ChainSnapshotStore::list(T)`.
   - Ring **Disabled** / `list` `Err("capture not storing")` → treat as **no promotable row**;
     fall through to force-compute (do **not** warn+abort the ladder before force-compute when
     the session archive is enabled).
   - Otherwise filter rows where `et_date_from_as_of(as_of) == Some(D)`, pick the **earliest**
     `as_of` among matches, `load` body, `deserialize_capture` → wire, then call
     **`archive_session_best_effort(archive, &wire, &body)` directly**. **Do not** re-`append`
     to the ring.
   - If a same-D ring row exists but `load` returns `None` or `deserialize_capture` fails:
     **fall through to force-compute** (do not warn+return forever on a poison ring slot).
3. **Bounded off-path force-compute (when no successful promote).** Eligibility must hold
   (predicate below). Off-path singleflight `compute_analytics` (or equivalent that yields a live
   `VendorBundle`), then **await archival of that live bundle**:
   - If the ring store is **enabled**: **await** `capture_into(ring, archive, bundle, …)` (append
     → prune → `archive_session_best_effort`). Do **not** fire-and-forget `spawn_capture`.
   - If the ring store is **Disabled**: serialize the live bundle and call
     **`archive_session_best_effort` directly** (promote-shaped write). Ring-down must not abort
     the session-archive guarantee when `SESSION_CHAIN_ARCHIVE_ENABLED` is on.
   Extra Massive lives **only** on this arm, inside the ensure worker. Singleflight must not
   release until the archival await completes or the compute/archive attempt hard-fails.

### Ensure / AC-1–3 eligibility (concrete, checkable — no holiday calendar)

`(T, D)` is **in scope for the ship-blocking warm-cache guarantee** when **all** hold:

1. `T` ∈ closed ensure set `{SPY, QQQ, IWM}`.
2. `D` is a **Monday–Friday** America/New_York calendar date (same weekday rule
   `MarketPhase::classify` uses: `weekday().num_days_from_monday() < 5`). **Saturday/Sunday are
   N/A for AC-1–3** — not a silent pass and not a failed AC.
3. Session-archive store is **enabled** (`SESSION_CHAIN_ARCHIVE_ENABLED` / store not Disabled).
   If the store is disabled, **AC-13** applies — not AC-1–3.

There is **no** Massive holiday calendar in live Rust. Do **not** invent “outside Massive
coverage” / exchange-holiday membership as an AC excuse. If ensure retries through end of
weekday `D` and identity `(T, D)` is still absent, research reports honest **`no session book`**
(AC-11 / AC-12) and **AC-1–3 fail** for that name — prefer fail-honest miss over unfalsifiable
coverage.

`Config.liquid_symbols`, `WARM_SYMBOLS`, and `universe.json` are **not** the AC-1–3 membership
gate; the closed trio is structural.

### Same-day retry budget (owner ruling A, 2026-08-20)

<!-- spire:council-resolution:v1 aae649d8ebb830127ec74e7b94f750b71dcf92aaacfea70db4eb4aab7f165cc0 folded -->
<!-- spire:council-resolution:v1 e53e1d65647443155c6668273531e52dba51ae788f4f17befa8253adf3977038 folded -->

After a **failed** extra Massive / force-compute, the off-path worker **may retry later the same ET
day** while the session identity is still absent. Binding bounds:

- **At most one in-flight** fetch per `(T, D)` (singleflight) — no concurrent stampede.
- **Spaced retries:** minimum **300 seconds (5 minutes)** between Massive force-compute
  *attempts* for the same `(T, D)` after a hard failure. Worker wake / warmer-shaped cadence
  (live default `WARM_INTERVAL_SECS=25`) must **not** re-arm Massive every tick.
- **No Massive on the trader request path** (including fire-and-forget request-scoped tasks).
- Presence short-circuit: once `(T, D)` exists, later ensures spend **zero** Massive for that
  identity.
- Promote path remains zero Massive (already-paid material preferred — no unnecessary second
  invoice when a same-D ring row successfully promotes).
- A blip does not spend the day via unbounded sequential invoices. **New ET date = new identity.**
- **Ship-blocking deadline:** research list/load hit for `(SPY|QQQ|IWM, D)` is observable by
  **end of ET calendar day D** (America/New_York calendar roll) when eligibility holds. Retries
  stop when the date rolls. Not RTH-close-only.

### Wake from warm traffic

<!-- spire:council-resolution:v1 f23523af10bbd06b2082f83a74f397e5bf0dbe5d06e268c785b30d977bfe5678 folded -->

Warm scanner / ticker traffic for the closed trio may emit **at most a non-blocking wake signal**
into the dedicated ensure worker. Massive and force-compute run **only** inside that off-path
worker — never as request-scoped tasks from ticker/scanner handlers, even fire-and-forget. Trader
HTTP never awaits ensure Massive I/O. Wake does not bypass the 300s spacing gate.

### Component boundaries

| Component | Owns | Must not |
| --- | --- | --- |
| Ensure leaf (new; under/beside `session_chain_archive/`) | Closed-set membership, today’s `D`, presence → promote → force-compute ladder, `(T,D)` singleflight + spaced same-day retry-while-absent, best-effort warn | Import signals/score/tier/fingerprint/gate; raise 48/14d; hist-chain; object-store; UI; mint miss strings; invent holiday calendar |
| Dedicated ensure worker | Cadence + wake drain; runs Massive / force-compute off-path; enforces ≥300s spacing | Join trader HTTP await; run inside `refresh_analytics`; bill Massive every warmer tick |
| `archive_session_best_effort` (unchanged contract) | First-wins insert-if-absent | Become last-wins / RTH-gated |
| `capture_into` (awaited on force-compute when ring enabled) | Append+prune+archive for live force-compute bundle | Be replaced by fire-and-forget `spawn_capture` as ensure completion |
| Direct `archive_session_best_effort` on live bundle | Force-compute when ring Disabled but archive enabled; promote path | Re-append to a Disabled ring |
| `load_or_compute` / ticker await | Desk latency; optional non-blocking wake for closed set | Await ensure I/O or start request-scoped Massive |
| Research session-books list/load | Stored bytes only; zero Massive including miss | Trigger ensure or vendor fetch |
| Warmer `refresh_analytics` | Keep gex/price warm; **still drops vendor for capture** | Gain warm-loop capture |

### Failure modes + isolation

- Archive store Disabled / presence `load` `Err(not storing)` → ensure **skips** paid work
  (AC-13); desk unchanged.
- Ensure feature-off (`LIQUID_SESSION_ENSURE_ENABLED` off) → no force-compute; research
  `no session book` (AC-10); store may still be up.
- Promote load/deserialize failure on a same-D ring row → fall through to force-compute (not a
  permanent warn+return).
- Compute fail / archive insert fail → warn + return; desk bundle/SSE/scan HTTP unchanged
  (`best-effort-isolated-or-null`); spaced retry may continue while identity absent and D has not
  rolled.
- Still-absent after retries through end of weekday D → honest `no session book` (AC-11/12);
  AC-1–3 fail for that name (no coverage excuse).
- Score / tier / fingerprint / gate: ensure is a one-way leaf non-input
  (`additive-keeps-score-byte-identical`).
- Multi-name work only off-path (`single-ticker-on-demand` narrowed form).
- Operator research remains off trader routes (`operator-vs-trader-path-separation`); **`NO_UI_CHANGE`**.
- Blobs stay secret-free (`no-secrets-in-image`); Massive use is research-corpus fill only.

### Not buildable / rejected approaches

- **Capture inside `refresh_analytics`** — warmer exclusion stands; fights live comment; not a
  separate ensure.
- **Force-compute on every `load_or_compute` warm hit** — puts vendor work on the serve/scan hot
  path lifecycle even if fire-and-forget.
- **Fire-and-forget `spawn_capture` as ensure completion** — live spawn does not await archive;
  ring Disabled no-ops archival.
- **Day-scoped attempt-spent latch after first Massive (success or fail)** — rejected by owner
  ruling A; a transient blip must not spend the day.
- **Unbounded same-day Massive retries every warmer tick** — violates “a blip does not spend the
  day”; spacing ≥300s is mandatory.
- **Invented Massive/exchange holiday calendar as AC-1–3 non-failure** — unfalsifiable; banned.
- **Whole-universe force-capture / raising 48-cap / hist-chain / object-store / Path-B rewrite** —
  out of BRIEF.
- **Fifth absence class** (ensure-pending / ensure-failed / “not a lab name” / warm-cache excuse) —
  banned; reuse shipped four classes only.

## 3. Acceptance criteria (with user stories)

Actors: research operator / owner. **Not** the signed-in trader on Landing / Ticker / Positions /
Scanner / Settings / Ask-AI. Every row is observable without reading source (operator list/load,
vendor-call counters, desk still serving, structural trader silence). **(SB)** = ship-blocking.

**Eligibility for AC-1–3 (binding):** `T ∈ {SPY, QQQ, IWM}` ∧ `D` is Mon–Fri America/New_York ∧
session-archive store enabled. Weekend `D` → AC N/A. Store disabled → AC-13, not AC-1–3.
Deadline: by **end of ET calendar day D**.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 **(SB)** | US-1: As the research operator, I want SPY’s weekday book even when cache stayed warm. | Given ET **weekday** D (Mon–Fri America/New_York), session-archive store enabled, and SPY in the closed ensure set: **even when the live cache for SPY stayed warm all day**, by end of ET calendar day D research list/load for `(SPY, D)` is a **hit** — a loadable session-archive book exists. Weekend D is N/A (not a silent pass). If ensure attempted through end of weekday D and identity is still absent, research shows honest `no session book` and **this AC fails** (no holiday/coverage excuse). | test |
| AC-2 **(SB)** | US-1 | Same as AC-1 for **QQQ** on `(QQQ, D)`. | test |
| AC-3 **(SB)** | US-1 | Same as AC-1 for **IWM** on `(IWM, D)`. | test |
| AC-4 **(SB)** | US-2: As the research operator, I want zero-Massive research load with provenance. | A successful research **load** of `(SPY\|QQQ\|IWM, D)` completes with **zero live Massive calls** and surfaces mandatory **`source_as_of`**. | test |
| AC-5 **(SB)** | US-2 | Listing session-archive identities for SPY, QQQ, or IWM completes with **zero live Massive calls**. | test |
| AC-6 **(SB)** | US-4: As the research operator, I want already-paid ring material preferred. | Given a same-ET-date paid book already present in the intraday capture ring for **SPY, QQQ, or IWM** on D, and no session identity yet, ensuring the session archive for that name on D creates the session identity **without an additional Massive fetch**. | test |
| AC-7 **(SB)** | US-3: As the desk owner, I want paid fill off the trader await path. | When neither a session identity nor a successfully promotable same-day ring row exists for **SPY, QQQ, or IWM** on D, any paid fill required to create the session book runs **off the trader request path** (trader HTTP does not await that Massive I/O; Massive is not started as a request-scoped task) and **awaits** archival completion (`capture_into` or direct `archive_session_best_effort`) before releasing `(T, D)` singleflight. | test |
| AC-8 **(SB)** | US-3 | For **SPY, QQQ, or IWM** on ET date D with no session identity yet: at most **one in-flight** Massive/force-compute `(T, D)` at a time (singleflight); repeated ensure triggers do **not** stampede concurrent vendor fetches; after a **failed** attempt the off-path worker **may retry** later the same ET day while identity is still absent, with **≥ 300s** between Massive attempts for that `(T, D)`; retries **stop** when identity exists or ET date D rolls. | test |
| AC-9 **(SB)** | US-1 / US-3 | Given an existing session identity for `(SPY\|QQQ\|IWM, D)`, a later ensure the same ET day leaves **exactly one** session identity for that pair and does **not** spend another paid fetch for that identity. | test |
| AC-10 **(SB)** | US-5: As the research operator, I want ensure-off / never-paid to stay an honest miss. | When ensure is **skipped / `LIQUID_SESSION_ENSURE_ENABLED` off**, or we never obtained a paid book for `(SPY\|QQQ\|IWM, D)`, research reports honest **`no session book`** and does **not** fabricate an empty book or call Massive on the research read to create one. This class is **disjoint** from archive store unavailable (AC-13) — ensure-off must not reuse the archive-store dial alone. | test |
| AC-11 **(SB)** | US-5 / US-6 | If ensure / off-path paid fill / archive write **fails** after a warm weekday with no successful promote, trader-facing serve/scan/SSE still **succeeds**, and the session archive does **not** gain a fabricated successful identity from that failure (research may still show `no session book` until a later spaced same-day retry succeeds or the date rolls). Still-absent at end of weekday D remains honest `no session book` (and fails AC-1–3 for that name). | test |
| AC-12 **(SB)** | US-5 | A research miss for `(SPY\|QQQ\|IWM, D)` reports **`no session book`** and performs **zero Massive calls** on the read — miss does not silently fill from vendor. | test |
| AC-13 **(SB)** | US-5 | When the session-archive store is **disabled / not storing**, the operator observes **`session archive not storing`** — distinct from `no session book` and from unreadable — the trader desk remains available, and the ensure leaf **does not** spend Massive force-compute for that skip (presence `load` Err → AC-13 skip, not treat-as-miss). | test |
| AC-14 **(SB)** | US-5 | When a session identity exists but stored material is **unreadable**, the research read reports **`session book unreadable: <reason>`** — distinct from `no session book` and not-storing — with **zero Massive calls**. | test |
| AC-15 **(SB)** | US-5 | A research miss for `(name, D)` does **not** silently substitute another date’s session book without labeling the substitution (substitution is Out; missing stays missing). | test |
| AC-16 **(SB)** | US-6: As the desk owner, I want ensure invisible to desk latency. | Ensure work does not place Massive I/O or archive I/O on the trader request latency path in a way that makes an ensure stall fail or delay the trader response. | test |
| AC-17 **(SB)** | US-8: As the desk owner, I want score byte-identity. | For the same market inputs, opportunity score / tier / fingerprint are **byte-identical** with liquid-name ensure on vs off and with ensure succeeding vs failing; ensure/session blobs are not scoring inputs. | test |
| AC-18 **(SB)** | US-7: As the desk owner, I want zero trader chrome. | `apps/dashboard` gains **no** new route, nav item, Settings copy, Ask-AI line, Ticker/Scanner/Positions affordance, or tooltip mentioning SPY/QQQ/IWM session capture / “lab names” / warm-cache ensure; trader empty/error/offline/`unavailable this cycle`/`—` copy is byte-unchanged by ensure success or failure. | test |
| AC-19 **(SB)** | US-7 | No trader-facing product path redistributes session-archive books as a market-data feed to end traders (`/api/_research/*` stays off trader UI clients; Pages trader origin continues to **404** `/api/_research` the same way it 404s `/api/_metrics`). | test |
| AC-20 **(SB)** | US-1 | Stored session material written by this feature contains **no API keys or other secrets**. | test |
| AC-21 **(SB)** | US-9: As the owner, I want the 48-cap left alone. | This ship does **not** raise the existing 48-per-symbol cap or rewrite ring retention so that “keeping a day” is achieved by enlarging the intraday ring instead of ensuring the session archive. | review |
| AC-22 **(SB)** | US-9 | This ship’s ensure guarantee applies to the closed set **SPY, QQQ, IWM only** — it does **not** promise warm-cache session books for the rest of the paid-capture universe / `DEFAULT_LIQUID` / `universe.json`. | review |
| AC-23 | US-9 | This ship does **not** include program #3 join-smoke execution, #4 weekly ritual, #5 corpus wait, #6 AI-rec lab P4, #7 object-store migration, or hist-chain purchase. | review |
| AC-24 | US-7 | Operator verification of SPY/QQQ/IWM session-book presence / miss is available **without** using the trader UI (via `/api/_research/session-books/...`). | review |
| AC-25 **(SB)** | US-8 | Every research list/load response that surfaces a **hit** (`store=hit`) carries **`authorizes: "nothing"`**. List **miss** is HTTP **200** `store=miss` and still carries the shipped envelope fields including `authorizes` / `framing` / `license` / `provenance` (as live list already does). Load **404** miss envelopes are detail-only and are not required to repeat `authorizes`. | test |

<!-- spire:council-resolution:v1 76153abc199426b1330d01ef603aac1513868cade84e1fb88e4b130858c5c3cc folded -->
<!-- spire:council-resolution:v1 f78697428f4c0e2d75bae22c736470bb910672651184d3678bcf7291ff4a8324 folded -->

**Ship-blocking set:** AC-1–AC-22, AC-25. AC-23–AC-24 are required honesty / scope checks
(`review`).

**Method notes (risk-based):**

- **`test`** concentrates on silent money/correctness failures: warm-cache weekday still yields
  session books for each of the three names by end of ET day D (AC-1–3), zero-vendor research
  list/load with mandatory `source_as_of` (AC-4/5), promote-without-second-invoice (AC-6),
  off-path + awaited archival + singleflight + spaced same-day retry-while-absent (AC-7/8),
  same-day uniqueness without re-fetch (AC-9), honest ensure-off/miss/failure vs not-storing /
  unreadable (AC-10–15), desk isolation (AC-11/16), structural trader-chrome absence +
  `authorizes: nothing` (AC-18/25), no trader redistribution (AC-19), score byte-identity
  (AC-17), no secrets (AC-20).
- **`review`** owns not raising the 48 cap (AC-21), closed three-name scope (AC-22), program
  #3–#7 not absorbed (AC-23), and positive operator-path-without-trader-UI (AC-24).
- Prefer **one** high-level integration pass: warm-cache weekday for SPY/QQQ/IWM → assert three
  session identities by end of D → load each with vendor-call counter 0 + `source_as_of` present
  → ring-present promote path spends 0 Massive → ring-empty / ring-Disabled path awaits archival
  off trader await and may spaced-retry after fail → ensure-off dial and confirm honest
  `no session book` → force store-off and confirm `session archive not storing` with zero Massive
  → force ensure fail and confirm desk still OK — over per-AC micro-harnesses.
- No DOM harness is required for ship; trader silence is a structural empty-diff / affordance
  scan on `apps/dashboard`.
- Exact closed miss/framing/authorizes **string values** are asserted by unit / GATE Q tests; the
  interface conformance type block checks shape/presence. QQQ/IWM list probes may vacuously pass
  on empty `books[]` — they are **not** the warm-cache guarantee; AC-1–3 tests are.

## 4. UI + interaction

**`NO_UI_CHANGE`.** This ship adds **no** route, component, token, motion, Settings row, Ask-AI
line, Ticker chip, Scanner badge, Positions affordance, or `/_ops` health chrome. Anyone proposing
“we now capture SPY/QQQ/IWM” UI is **re-scoping**.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (`Status: SET` — The Curvature
Terminal). **Design direction:** does not apply — no trader presentation ships; no
`DESIGN_SYSTEM.md` amendment.

<!-- spire:council-resolution:v1 5fc040346c64c1a103aa4618de8ece8baf9e9fe33642a169802246dd1b166f04 folded -->
<!-- spire:council-resolution:v1 952603fd9fad0ffbba85dd67c8b48b3a5b2f6a167b7ebd1fae5b83d0dc58718f folded -->
<!-- spire:council-resolution:v1 e929c85f5014045d2312819a76d36c84adf310297d9519d8ec3e1e6f8b4a2983 folded -->

**Flows (operator / research only):**

1. Off-path ensure for SPY / QQQ / IWM when no session identity exists yet for ET weekday D
   (promote-then-force with awaited archival; invisible on trader path).
2. Operator lists `GET /api/_research/session-books/{symbol}` → hit rows include `source_as_of`.
3. Operator loads `(symbol, et_date)` → session book + mandatory `source_as_of`; `vendor_called`
   false.
4. After 48-ring prune, the same identity still loads.
5. If ensure never wrote (or read lands before ensure completes): dated load still returns exact
   **`no session book for <SYMBOL> on <ET_DATE>`** — never a fabricated empty book; **no** fifth
   pending/ensure-loading class.

**Component states — trader path (S0):** one required state — **unchanged**. Ensure success, skip,
failure, and off-path Massive are all invisible on Landing / Ticker / Settings / Ask-AI / Scanner /
Positions / shell nav.

**Component states — research read (S1):** reuse shipped `session-chain-archive` matrix; **no new
state names**.

| Component / surface | default | loading | empty | error | offline/stale |
|---|---|---|---|---|---|
| Trader routes (S0) | Unchanged | Unchanged | Unchanged | Unchanged | Unchanged |
| Research session list/load (S1) | Hit: `framing` = `RESEARCH READ — SESSION BOOK`, mandatory `source_as_of`, `provenance` = `loaded from session archive · no vendor call`, `license`, `authorizes: nothing` (+ body on load) | **N/A** (HTTP request/response; no ensure-progress field) | **`no session book for <SYMBOL> on <ET_DATE>`** (dated load) / **`no session book for <SYMBOL>`** (list empty) — covers ensure-off, never-captured, ensure failure, and ordinary miss alike | **`session archive not storing`** · **`session book unreadable: <reason>`** · list **`session archive store error: <reason>`** | N/A (research HTTP; miss stays miss) |
| Ring research vehicle (cite only) | Unchanged | N/A | Live **`no stored snapshot for <SYMBOL>`** | Unchanged | N/A |

**Copy (exact — reuse shipped; do not mint):**

| Concept | Approved term / exact string | Banned (this ship) |
|---|---|---|
| Prune-proof day identity | **session book** / **session archive** / `(symbol, et_date)` | “live book”, “lab book”, “raised 48-cap row” |
| When taken | **`et_date`** · **`source_as_of`** (mandatory on hit) | “last updated”, “fresh”, “current book”, “now”, “ensured at” |
| How obtained on read | **`loaded from session archive · no vendor call`** | “refreshed”, “force-captured for lab”, “synced from Massive” |
| Day with no identity (all no-identity causes) | **`no session book for <SYMBOL> on <ET_DATE>`** / **`no session book for <SYMBOL>`** | “not a lab name”; “SPY/QQQ/IWM not in ensure set”; warm-cache excuse; holiday/coverage excuse; ensure-pending; ring miss string; trader `—` / `unavailable this cycle` |
| Store disabled | **`session archive not storing`** | treating as miss; spending Massive on ensure while store-off |
| Unreadable | **`session book unreadable: <reason>`** | treating as miss |
| Score posture | **`authorizes: nothing`** | implying live score uses archived books |
| License | **Our research · not redistributed on a trader route.** | “shareable feed” |

Four mandatory-distinct outcomes stay closed:
`no session book…` ≠ `no stored snapshot…` ≠ `session archive not storing` ≠
`session book unreadable: <reason>`.

Disabled ensure, never-captured, ensure failure, and ordinary research miss are **not**
operator-distinguishable from each other — they all present as shipped `no session book…`. Closed
names SPY/QQQ/IWM are a **backend ensure scope**, not a user-facing taxonomy.

**Hard ban — live-as-market-feed** and **hard ban — lab-rename:** do not brand a miss as membership
in a “lab names” set.

## 5. Error handling

| Failure class | User / operator sees | Logged | Retries |
|---|---|---|---|
| Ensure feature off (`LIQUID_SESSION_ENSURE_ENABLED` off) / never paid | Research: `no session book…` (AC-10). No fabricated empty book. Zero Massive on research read. | Ensure-skipped / disabled warn | No force-compute while off |
| Archive store Disabled / presence `load` Err | Research: **`session archive not storing`** (AC-13). Ensure skips paid work. Desk up. | Store-disabled / unavailable | No Massive force-compute on this skip |
| Promote load/deserialize fail on same-D ring row | Desk unchanged; ensure continues to force-compute | Promote-fail warn | Fall through once into force-compute arm |
| Ensure / force-compute / archive write fails (store still up) | Desk: bundle/scan/SSE **succeed**. Research: still `no session book…` until a later spaced same-day retry succeeds or D rolls. No fabricated success identity. | Warn; trader path unchanged | Spaced (≥300s) off-path retries while identity absent (owner A); singleflight; stop at date roll |
| Still-absent at end of weekday D after attempts | Research: honest `no session book…`. AC-1–3 fail for that name. | Attempt/exhaust warn | Stop at date roll |
| Identity present, body unreadable | Research: **`session book unreadable: <reason>`** (AC-14). Zero Massive. | Unreadable warn | No live Massive recovery |
| List metadata I/O fault | Research: **`session archive store error: <reason>`** | Store error | No vendor fill-in |
| Load before ensure completes | Ordinary dated **`no session book for <SYMBOL> on <ET_DATE>`** — no fifth pending class | N/A | Ensure continues off-path |
| Weekend D / name outside closed trio | AC-1–3 N/A / no promise; honest miss if never archived | N/A | N/A |
| Score / desk under ensure fault | Score/tier/fingerprint byte-identical; no trader chrome | Isolation warn only | Desk wins |

Research list/load **never** calls Massive to create a missing book. Trader routes never toast
ensure progress.

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/liquid-names-session-capture/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** Ensure is an **off-path backend behavior** with **no new HTTP
endpoint** and **no trader endpoint**. Existing operator research GETs
`/api/_research/session-books/{symbol}` and `/api/_research/session-books/{symbol}/book` are
**reused unchanged** (fields + closed copy from `session-chain-archive`) and **re-pinned** in the
interface file as the machine-checkable surface so GATE Q can observe list/load hits for
SPY/QQQ/IWM. Not `NO_BACKEND_CHANGE` (ensure worker + promote/force-compute land in `api-rust`).
Authoritative field lists live in that file — this SPEC does not restate them.

## 7. Testing strategy

**Automate (`test`):**

- Warm-cache **weekday** → session identities for SPY, QQQ, IWM by end of ET day D (AC-1–3);
  still-absent at deadline fails those ACs honestly.
- Zero Massive on research list/load + mandatory `source_as_of` on hit (AC-4/5).
- Promote path: ring holds D → archive fill with Massive counter 0 (AC-6); poison
  load/deserialize falls through to force-compute.
- Force-compute arm: off trader await; **awaits** `capture_into` or direct
  `archive_session_best_effort`; ring Disabled does not abort when archive is on; `(T,D)`
  singleflight; spaced ≥300s retry-after-fail (AC-7/8/9).
- Absence honesty: ensure-off dial → `no session book`; store-off → `session archive not storing`
  with zero Massive; unreadable distinct; no date substitution (AC-10–15).
- Desk isolation + score byte-identity (AC-11/16/17).
- Structural trader-chrome empty-diff / affordance scan (AC-18); Pages `/api/_research` 404
  (AC-19); `authorizes: "nothing"` on hit + list-miss envelopes (AC-25); no secrets (AC-20).

**Review:**

- 48-cap / retention non-goal (AC-21), closed trio scope (AC-22), program #3–#7 not absorbed
  (AC-23), operator path without trader UI (AC-24).

**Invariants that must never silently regress:** warm-cache is not an excuse for
`(SPY|QQQ|IWM, weekday D)` miss while store is on; research read stays Massive-free; four absence
classes stay disjoint; ensure never joins trader await; score/tier/fingerprint stay non-inputs;
closed copy strings stay byte-compatible with shipped session-chain-archive; no holiday-calendar
excuse.

**FE tiers:** none — `NO_UI_CHANGE`. No DOM harness. Integration tests mock the network / vendor
boundary only where counters are asserted; prefer hermetic store + injected clock for ensure
ladder tests.

## 8. Guardrails this feature must not break

From BRIEF invariant watch (standing build invariants):

- **`operator-vs-trader-path-separation` (HARD)** — ensure/research stay off trader routes; no
  trader chrome; Pages `_research` stays 404.
- **`best-effort-isolated-or-null`** — ensure/archive failure never fails desk bundle/scan/SSE.
- **`additive-keeps-score-byte-identical`** — ensure/session blobs are non-inputs to score / tier /
  gate / fingerprint; `authorizes: nothing`.
- **`single-ticker-on-demand` (narrowed)** — request path stays one ticker; multi-name ensure only
  off-path.
- **`cited-code-is-verified-not-assumed`** — cite live `session_chain_archive/`,
  `chain_snapshot/capture.rs` (`spawn_capture` fire-and-forget vs awaited `capture_into`),
  `analytics.rs` `load_or_compute` cache-hit return, `refresh_analytics` warmer exclusion,
  `MarketPhase::classify` weekday rule — not Python-era paths and not an invented holiday calendar.
- **`absent-is-not-none`** — still-missing remains `no session book`, never a fabricated empty
  book; store-off stays its own class.
- **`no-secrets-in-image`** — stored material carries no API keys / secrets.
- **Massive license: research only** — no trader redistribution of stored books.

Also do not reopen shipped session-archive identity, first-wins, prune isolation, or absence
vocabulary; do not raise the 48-cap; do not absorb program #3–#7.

## 9. Open questions

None — owner ruling A (spaced same-day retries + end-of-ET-day-D deadline), AC-10/AC-13
disjointness (ensure dial ≠ store dial), wake = non-blocking signal only, four shipped absence
classes, AC-18/AC-25 Verify by test, reuse of session-archive HTTP fields/copy, and the checkable
AC-1–3 eligibility predicate (closed trio ∩ ET weekday ∩ store enabled) are settled.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"aae649d8ebb830127ec74e7b94f750b71dcf92aaacfea70db4eb4aab7f165cc0","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":1,"conflict_id":"76153abc199426b1330d01ef603aac1513868cade84e1fb88e4b130858c5c3cc","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":0,"conflict_id":"e53e1d65647443155c6668273531e52dba51ae788f4f17befa8253adf3977038","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":1,"conflict_id":"f23523af10bbd06b2082f83a74f397e5bf0dbe5d06e268c785b30d977bfe5678","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":2,"conflict_id":"952603fd9fad0ffbba85dd67c8b48b3a5b2f6a167b7ebd1fae5b83d0dc58718f","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":0,"conflict_id":"e929c85f5014045d2312819a76d36c84adf310297d9519d8ec3e1e6f8b4a2983","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":1,"conflict_id":"f78697428f4c0e2d75bae22c736470bb910672651184d3678bcf7291ff4a8324","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":2,"conflict_id":"5fc040346c64c1a103aa4618de8ece8baf9e9fe33642a169802246dd1b166f04","disposition":"folded","section":"§4"}]}
-->
