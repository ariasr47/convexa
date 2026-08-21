# liquid-names-session-capture — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. Execute from the workspace root. Keep this plan at
> `.spire/clusters/tech/contracts/liquid-names-session-capture/PLAN.md`.

**Goal:** Guarantee a prune-proof **session-archive book** for the closed set **SPY, QQQ, IWM** on
each America/New_York **weekday** `D` while the session-archive store is enabled — **even when
`gex_cache` stayed warm all day** — via an off-path ensure worker (presence → promote ring →
bounded force-compute with **awaited** archival). Research list/load stays zero-Massive. No trader
UI. Score untouched.

**Architecture:** One-way leaf under `session_chain_archive/` (ensure ladder + dedicated worker).
Live hole (verified): `load_or_compute` cache-hit returns without `spawn_capture`
(`apps/api/src/services/analytics.rs`); `refresh_analytics` intentionally drops `_vendor`;
`spawn_capture` is fire-and-forget and `capture_best_effort` no-ops archival when the ring is
Disabled (`apps/api/src/services/chain_snapshot/capture.rs`). Ensure must **not** treat
`spawn_capture` as “archival completed.” Reuse shipped `(symbol, et_date)` first-wins
`archive_session_best_effort` and research GETs under `/api/_research/session-books/...`.

**Tech stack:** Rust Axum (`apps/api`, crate `api-rust`); Cloudflare Pages Function
`functions/api/[[path]].ts`. Tests: `npx nx test api` / `cargo test -p api-rust`; FE structural
Vitest only. **`NO_UI_CHANGE`** for `apps/dashboard` (AC-18/25 structural).

**Spec:** `.spire/clusters/tech/contracts/liquid-names-session-capture/SPEC.md` (APPROVED)
**Interface:** `.spire/clusters/tech/contracts/liquid-names-session-capture/INTERFACE_CONTRACT.md`

---

## Track map

| Track | Tasks | Ownership |
|---|---:|---|
| **Backend** (`apps/api`) | **B1 → B8** (strict order inside the track) | Ensure leaf + worker + wake + harness |
| **Frontend / infra** | **F1 → F2** | Pages 404 non-regression + trader-chrome absence (AC-18/25) |
| **Verification** | **V1 → V6** after B8 + F2 | Read-only gates |

**Parallelism:** Backend and Frontend tracks are independently executable. Verification runs after
both land.

---

## Global Constraints

Every task's requirements implicitly include this section.

**Standing project constraints (each has bitten this repo):**

- **`nx typecheck` is mandatory before any green claim on TS.** Vitest / cargo green ≠ FE types sound.
- **Check EXIT CODES, not printed summaries.** PowerShell: `$LASTEXITCODE` after every gate command.
- **`nx format:write` must ALWAYS be scoped with `--files=`.** Never bare.
- **Never write a literal NUL byte.**
- **Cite live Rust only** — `services/session_chain_archive/{archive,store,et_date}.rs`,
  `services/chain_snapshot/capture.rs` (`spawn_capture` fire-and-forget vs awaited `capture_into`),
  `services/analytics.rs` `load_or_compute` cache-hit return + `refresh_analytics` warmer exclusion,
  `domain/market.rs` `MarketPhase::classify` weekday rule
  (`weekday().num_days_from_monday() < 5`), `services/warmer.rs`, `server.rs` spawn sites,
  `routes/research_session_books.rs`, `functions/api/[[path]].ts` — **not** Python, **not** an
  invented Massive/exchange holiday calendar.
- **Do not edit** `SPEC.md`, `INTERFACE_CONTRACT.md`, or other feature folders.

**Feature hard rules (settled — do not re-open):**

- **Closed ensure set = `{SPY, QQQ, IWM}` only** (compile-time / config-fixed). Not
  `DEFAULT_LIQUID`’s ten names, not `warm_symbols` alone, not `universe.json` (AC-22).
- **Dedicated off-path ensure worker.** Capture is **not** bolted onto `refresh_analytics`.
  Massive / force-compute run **only** inside that worker — never request-scoped from
  ticker/scanner handlers (even fire-and-forget).
- **Ensure dial ≠ store dial:** `LIQUID_SESSION_ENSURE_ENABLED` (default **true**;
  `0`/`false`/`no`/`off` skips worker) is **disjoint** from `SESSION_CHAIN_ARCHIVE_ENABLED`.
  Ensure-off + store-on → AC-10 `no session book`. Store-off → AC-13 regardless of ensure dial.
- **Ladder (per `(T, D)`):** presence `SessionChainArchive::load` → promote earliest same-ET ring
  row via **direct** `archive_session_best_effort` (no ring re-append) → else bounded force-compute
  that **awaits** archival (`capture_into` when ring enabled; direct `archive_session_best_effort`
  when ring Disabled but archive enabled). **Never** `spawn_capture` as ensure completion.
- **AC-1–3 eligibility:** `T ∈ {SPY,QQQ,IWM}` ∧ `D` Mon–Fri America/New_York
  (`num_days_from_monday() < 5`, same rule as `MarketPhase::classify`) ∧ session-archive store
  enabled. Weekend `D` → AC N/A (skip force-compute; not a silent pass). No holiday calendar.
- **Same-day retry (owner A):** ≥ **300s** between Massive force-compute *attempts* for the same
  `(T, D)` after hard failure; **at most one in-flight** `(T, D)` (singleflight held until
  archival await completes or hard-fails); stop when identity exists or ET date rolls.
- **Wake = optional non-blocking signal only** into the ensure worker; does not bypass the 300s
  spacing gate; trader HTTP never awaits ensure Massive I/O.
- **Four shipped absence classes only** — do not mint ensure-pending / lab-name / warm-cache /
  holiday-excuse copy. Research list/load **never** triggers ensure or Massive.
- **Do not raise** `chain_snapshot_max_per_symbol` (48) or `chain_snapshot_max_age_secs`
  (`1_209_600`) (AC-21). Do not absorb program #3–#7 / hist-chain / Path-B rewires (AC-23).
- **Score byte-identity:** ensure is a one-way leaf; signals / score / tier / fingerprint / gate
  never import it (AC-17). Hit + list-miss envelopes keep `authorizes: "nothing"` (AC-25).
- **Secrets:** reuse serialize-then-persist + `debug_assert_no_secrets` boundary (AC-20).
- **`NO_UI_CHANGE`:** Frontend track is Pages 404 + structural affordance scan only (AC-18/19/25).

**License one-liner (wire `license` — unchanged):**
`Our research · not redistributed on a trader route.`

### Conformance spec

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": { "symbol": "SPY" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "books[].symbol": "string",
        "books[].et_date": "string",
        "books[].source_as_of": "string",
        "books[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": { "symbol": "QQQ" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "books[].symbol": "string",
        "books[].et_date": "string",
        "books[].source_as_of": "string",
        "books[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": { "symbol": "IWM" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "books[].symbol": "string",
        "books[].et_date": "string",
        "books[].source_as_of": "string",
        "books[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": { "symbol": "ZZZZNOPE" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "store": "string",
        "detail": "string",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}/book",
      "path_params": { "symbol": "ZZZZNOPE" },
      "query": { "et_date": "2000-01-01" },
      "expect_status": 404,
      "required": {
        "error": "string",
        "detail": "string",
        "symbol": "string",
        "et_date": "string",
        "store": "string",
        "vendor_called": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}/book",
      "path_params": { "symbol": "SPY" },
      "query": { "et_date": "2020-01-02" },
      "expect_status": 200,
      "required": {
        "symbol": "string",
        "et_date": "string",
        "source_as_of": "string",
        "source": "string",
        "store": "string",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "market": "object",
        "market.ticker": "string",
        "market.synchronized_spot": "number",
        "market.current_spot": "number",
        "market.timestamp": "number",
        "market.atm_iv": "number",
        "market.atm_iv_expiration": "string|null",
        "market.atm_iv_dte": "number|null",
        "market.market_phase": "string",
        "market.contracts": "array",
        "daily_bars": "array",
        "minutes": "array",
        "trades": "array"
      }
    }
  ]
}
```

**Baselines:**

| Check | Expectation |
|---|---|
| `npx nx test api` / `cargo test -p api-rust -p quant-engine` | exit 0 |
| Feature tests named in B*/V* | exit 0; named ACs covered |
| `npx nx typecheck @convexa/dashboard` | exit 0 (FE track / V*) |
| Pages `/api/_research` 404 | status 404 (same as `_metrics`) — already in `functions/api/[[path]].ts` |
| `interface_conformance` against Global Constraints block | PASS (or UNVERIFIABLE only on hit-probe seed failure) |
| `git diff --name-only -- apps/dashboard` | empty **or** only structural-test file(s) — **no** product UI |
| Ring retention dials | still `48` / `1_209_600` — unchanged |

---

## File ownership

| Path | Change |
|---|---|
| `apps/api/src/services/session_chain_archive/ensure.rs` | **Create** — closed set, eligibility, ladder, `(T,D)` singleflight + 300s spacing |
| `apps/api/src/services/session_chain_archive/ensure_worker.rs` | **Create** — dedicated worker spawn, cadence, wake drain |
| `apps/api/src/services/session_chain_archive/mod.rs` | Export ensure / worker / wake handle; keep one-way leaf comment |
| `apps/api/src/config.rs` | `liquid_session_ensure_enabled` via `LIQUID_SESSION_ENSURE_ENABLED` (`env_flag_default_true`) |
| `apps/api/src/state.rs` | Hold `EnsureWake` (Notify); wire dial; extend `for_tests` / stub configs |
| `apps/api/src/server.rs` | `ensure_worker::spawn(state.clone())` beside `warmer::spawn` |
| `apps/api/src/services/analytics.rs` | Optional non-blocking wake on closed-trio warm traffic; **do not** await ensure; **do not** capture on warmer |
| `apps/api/src/services/scanner/loop.rs` | Optional non-blocking wake after closed-trio `load_or_compute` (signal only) |
| `apps/api/src/main.rs` + other `Config { … }` literals | Add `liquid_session_ensure_enabled: …` field |
| `apps/api/tests/liquid_names_session_capture.rs` | **Create** — hermetic integration harness (AC-1–16 core) |
| `apps/api/tests/liquid_names_session_capture_isolation.rs` | **Create** — leaf / score / retention / closed-trio / secrets |
| `functions/api/[[path]].ts` | **Verify only** — already 404s `/api/_research/*` |
| `apps/dashboard/src/app/liquid-names-session-capture.structural.spec.ts` | **Create** — AC-18/25 structural + AC-19 Pages |
| `apps/dashboard/**` (product) | **No product UI** |

**Do not touch:** ring retention defaults, research session-books envelopes/copy, score/tier/
fingerprint math, `refresh_analytics` capture exclusion, trader routes, Path-B /
`batch-backtest` / `replay-outcome-join`, `DESIGN_SYSTEM.md`, dashboard pages/components/nav.

**Reviewer probes (every task):** if live tree contradicts a cited signature or behavior, STOP and
report — do not silently “fix” the plan.

---

## Backend track

### B1 — Config dial + closed-set + eligibility predicate

**Files:** `apps/api/src/config.rs`; `apps/api/src/services/session_chain_archive/ensure.rs`
(**create**); `apps/api/src/services/session_chain_archive/mod.rs`; every `Config { … }` literal
(`state.rs` stub configs, `main.rs`, `batch_backtest.rs`, `tests/batch_backtest_cli.rs`).

**Why:** SPEC §2 ensure dial + AC-1–3 eligibility. Closed trio is structural — not
`DEFAULT_LIQUID`.

- [ ] **Step 1: failing tests** in `ensure.rs` `#[cfg(test)]`:

```rust
use chrono::{TimeZone, Utc};
use chrono_tz::America::New_York;

#[test]
fn closed_set_is_exactly_spy_qqq_iwm() {
    assert_eq!(ENSURE_SYMBOLS, &["SPY", "QQQ", "IWM"]);
    assert!(is_ensure_symbol("spy"));
    assert!(is_ensure_symbol("QQQ"));
    assert!(!is_ensure_symbol("TSLA"));
    assert!(!is_ensure_symbol("DIA"));
}

#[test]
fn weekday_et_is_eligible_weekend_is_not() {
    // 2026-08-10 Monday 14:00 UTC = 10:00 ET
    let mon = Utc.with_ymd_and_hms(2026, 8, 10, 14, 0, 0).unwrap();
    assert!(is_et_weekday(mon));
    // 2026-08-08 Saturday
    let sat = Utc.with_ymd_and_hms(2026, 8, 8, 15, 0, 0).unwrap();
    assert!(!is_et_weekday(sat));
}

#[test]
fn eligibility_requires_trio_weekday_and_archive_enabled() {
    let mon = Utc.with_ymd_and_hms(2026, 8, 10, 14, 0, 0).unwrap();
    assert!(ensure_eligible("SPY", mon, true /* archive on */));
    assert!(!ensure_eligible("SPY", mon, false));
    assert!(!ensure_eligible("TSLA", mon, true));
    let sat = Utc.with_ymd_and_hms(2026, 8, 8, 15, 0, 0).unwrap();
    assert!(!ensure_eligible("SPY", sat, true));
}
```

- [ ] **Step 2: run** `cargo test -p api-rust ensure::tests -- --nocapture` → FAIL (module missing).

- [ ] **Step 3: implement minimally**

In `ensure.rs`:

```rust
//! Closed-set off-path ensure leaf. One-way: never imported by signals/score/gate.

use chrono::{DateTime, Datelike, Utc};
use chrono_tz::America::New_York;

pub const ENSURE_SYMBOLS: &[&str] = &["SPY", "QQQ", "IWM"];
pub const MASSIVE_RETRY_SPACING_SECS: u64 = 300;

pub fn is_ensure_symbol(sym: &str) -> bool {
    let u = sym.trim().to_ascii_uppercase();
    ENSURE_SYMBOLS.iter().any(|s| *s == u)
}

/// Same weekday rule as `MarketPhase::classify` (Mon=0…Sun=6; weekend ≥ 5).
pub fn is_et_weekday(now: DateTime<Utc>) -> bool {
    let et = now.with_timezone(&New_York);
    et.weekday().num_days_from_monday() < 5
}

pub fn today_et_date(now: DateTime<Utc>) -> String {
    let et = now.with_timezone(&New_York);
    format!("{:04}-{:02}-{:02}", et.year(), et.month(), et.day())
}

pub fn ensure_eligible(symbol: &str, now: DateTime<Utc>, archive_enabled: bool) -> bool {
    is_ensure_symbol(symbol) && is_et_weekday(now) && archive_enabled
}
```

In `config.rs` add field + parse beside session-archive dials:

```rust
/// False → skip liquid-name ensure worker (disjoint from SESSION_CHAIN_ARCHIVE_ENABLED).
pub liquid_session_ensure_enabled: bool,
// …
let liquid_session_ensure_enabled =
    env_flag_default_true("LIQUID_SESSION_ENSURE_ENABLED");
```

Update **every** `Config { … }` literal with `liquid_session_ensure_enabled: true` (or `false` in
hermetic stubs that must not spawn workers — match surrounding `warm_enabled: false` posture).

In `mod.rs`:

```rust
mod ensure;
pub(crate) mod ensure_worker; // added in B5; can stub empty mod for now if needed
pub use ensure::{
    ensure_eligible, is_ensure_symbol, is_et_weekday, today_et_date, ENSURE_SYMBOLS,
    MASSIVE_RETRY_SPACING_SECS,
};
```

- [ ] **Step 4: run** tests → PASS. Also `cargo test -p api-rust --lib config::` → exit 0.

- [ ] **Step 5: commit** `feat(api): liquid ensure dial + SPY/QQQ/IWM eligibility`

**Reviewer probe:** eligibility must not consult `warm_symbols` / `liquid_symbols` /
`universe.json`. Weekday rule must match `MarketPhase::classify`, not invent holidays.

---

### B2 — Presence short-circuit + AC-13 store-off skip

**Files:** `apps/api/src/services/session_chain_archive/ensure.rs`

**Why:** Ladder step 1. Presence `Ok(Some)` → done (zero Massive). `Err(not storing)` → AC-13 skip
(not a miss). `Ok(None)` → continue.

- [ ] **Step 1: failing tests**

```rust
#[tokio::test]
async fn presence_hit_is_done_without_promote_or_force() {
    let archive = SessionChainArchive::memory();
    let ring = ChainSnapshotStore::memory();
    let as_of = New_York.with_ymd_and_hms(2024, 6, 3, 14, 0, 0).single().unwrap().with_timezone(&Utc);
    let et = et_date_from_as_of(as_of).unwrap();
    let body = serialize_capture(&to_wire(&fixture_probe_bundle("SPY", as_of))).unwrap();
    archive.insert_if_absent("SPY", &et, as_of, MarketDataSourceKind::Fixture, &body).await.unwrap();

    let mut force_calls = 0u32;
    let outcome = ensure_one(
        &archive,
        &ring,
        "SPY",
        &et,
        /* archive_enabled */ true,
        /* ring_enabled */ true,
        |_sym| async {
            force_calls += 1;
            unreachable!("force must not run on presence hit")
        },
    ).await;
    assert!(matches!(outcome, EnsureOutcome::Present));
    assert_eq!(force_calls, 0);
}

#[tokio::test]
async fn store_disabled_skips_without_force_compute() {
    let archive = SessionChainArchive::disabled();
    let ring = ChainSnapshotStore::memory();
    let mut force_calls = 0u32;
    let outcome = ensure_one(
        &archive,
        &ring,
        "QQQ",
        "2024-06-03",
        false,
        true,
        |_sym| async {
            force_calls += 1;
            Err(EnsureForceError::Compute("nope".into()))
        },
    ).await;
    assert!(matches!(outcome, EnsureOutcome::StoreDisabled));
    assert_eq!(force_calls, 0);
}
```

- [ ] **Step 2: run** → FAIL.

- [ ] **Step 3: implement** `EnsureOutcome` + `ensure_one` presence arm only (promote/force can
  `todo!` temporarily **only if** tests above do not reach them — prefer stubbing promote/force as
  `EnsureOutcome::MissContinue` placeholders that the next tasks replace). Minimal shape:

```rust
pub enum EnsureOutcome {
    Present,
    StoreDisabled,
    Promoted,
    ForceArchived,
    SkippedIneligible,
    AttemptFailed,
}

pub async fn ensure_one<F, Fut>(
    archive: &SessionChainArchive,
    ring: &ChainSnapshotStore,
    symbol: &str,
    et_date: &str,
    archive_enabled: bool,
    ring_enabled: bool,
    force_compute: F,
) -> EnsureOutcome
where
    F: FnOnce(String) -> Fut,
    Fut: std::future::Future<Output = Result<crate::services::market_data::VendorBundle, EnsureForceError>>,
{
    if !archive_enabled {
        return EnsureOutcome::StoreDisabled;
    }
    match archive.load(symbol, et_date).await {
        Ok(Some(_)) => return EnsureOutcome::Present,
        Err(e) if e.to_string().contains("session archive not storing") => {
            return EnsureOutcome::StoreDisabled;
        }
        Err(e) => {
            tracing::warn!(error = %e, symbol = %symbol, "ensure presence load failed");
            return EnsureOutcome::AttemptFailed;
        }
        Ok(None) => { /* fall through */ }
    }
    // B3/B4 fill promote + force
    let _ = (ring, ring_enabled, force_compute);
    EnsureOutcome::AttemptFailed
}
```

- [ ] **Step 4: run** → PASS for presence + store-off.

- [ ] **Step 5: commit** `feat(api): ensure presence short-circuit + store-off skip`

**Reviewer probe:** store-off must not be treated as `Ok(None)` miss (that would spend Massive).

---

### B3 — Promote-from-ring (zero Massive)

**Files:** `ensure.rs` (promote arm); uses live
`ChainSnapshotStore::list(symbol, limit)`, `load(symbol, as_of)`,
`deserialize_capture`, `archive_session_best_effort`.

**Why:** SPEC §2 step 2 / AC-6. Prefer already-paid same-`D` ring material. Ring Disabled /
`capture not storing` → no promotable row → fall through (do **not** abort ladder). Poison
load/deserialize → fall through to force-compute.

- [ ] **Step 1: failing tests**

```rust
#[tokio::test]
async fn promote_uses_earliest_same_et_ring_row_with_zero_force() {
    let archive = SessionChainArchive::memory();
    let ring = ChainSnapshotStore::memory();
    let early = New_York.with_ymd_and_hms(2024, 6, 3, 10, 0, 0).single().unwrap().with_timezone(&Utc);
    let late = New_York.with_ymd_and_hms(2024, 6, 3, 15, 0, 0).single().unwrap().with_timezone(&Utc);
    let et = et_date_from_as_of(early).unwrap();
    // Append two same-D rows via capture_into (also archives — wipe archive after to isolate promote)
    capture_into(&ring, &SessionChainArchive::disabled(), fixture_probe_bundle("IWM", early),
        Duration::from_secs(1_209_600), 48).await.unwrap();
    capture_into(&ring, &SessionChainArchive::disabled(), fixture_probe_bundle("IWM", late),
        Duration::from_secs(1_209_600), 48).await.unwrap();
    assert!(archive.load("IWM", &et).await.unwrap().is_none());

    let mut force_calls = 0u32;
    let outcome = ensure_one(&archive, &ring, "IWM", &et, true, true, |_| async {
        force_calls += 1;
        unreachable!("promote must not force")
    }).await;
    assert!(matches!(outcome, EnsureOutcome::Promoted));
    assert_eq!(force_calls, 0);
    let loaded = archive.load("IWM", &et).await.unwrap().unwrap();
    assert_eq!(loaded.meta.source_as_of, early); // earliest as_of
}

#[tokio::test]
async fn ring_disabled_falls_through_to_force_when_archive_on() {
    let archive = SessionChainArchive::memory();
    let ring = ChainSnapshotStore::disabled();
    let et = "2024-06-03";
    let as_of = New_York.with_ymd_and_hms(2024, 6, 3, 14, 0, 0).single().unwrap().with_timezone(&Utc);
    let mut force_calls = 0u32;
    let outcome = ensure_one(&archive, &ring, "SPY", et, true, false, |_| async {
        force_calls += 1;
        Ok(fixture_probe_bundle("SPY", as_of))
    }).await;
    // B3 alone may still AttemptFailed until B4 wires force archival — assert fall-through
    // reached force (force_calls == 1) once B4 lands; here assert promote did not claim success.
    assert!(!matches!(outcome, EnsureOutcome::Promoted | EnsureOutcome::Present));
}

#[tokio::test]
async fn poison_ring_slot_falls_through() {
    // Plant meta-reachable but body missing / undecodeable: use Failing ring load path or
    // append then manually only if test double allows. Prefer: Memory ring with valid meta is
    // hard to poison — use a serialize-ok body then overwrite is not exposed; instead call
    // promote helper with a mock OR document: deserialize failure path unit-tested via a
    // private `try_promote` that accepts preloaded bytes.
    let archive = SessionChainArchive::memory();
    let got = try_promote_bytes(&archive, "SPY", "2024-06-03", b"not-json").await;
    assert!(got.is_none());
}
```

- [ ] **Step 2: run** → FAIL.

- [ ] **Step 3: implement promote**

```rust
async fn try_promote(
    archive: &SessionChainArchive,
    ring: &ChainSnapshotStore,
    symbol: &str,
    et_date: &str,
) -> bool {
    let listed = match ring.list(symbol, None).await {
        Ok(v) => v,
        Err(e) => {
            // live Disabled → Err("capture not storing") — treat as no promotable row
            tracing::debug!(error = %e, symbol = %symbol, "ensure: no promotable ring list");
            return false;
        }
    };
    let mut same_day: Vec<_> = listed
        .into_iter()
        .filter(|m| et_date_from_as_of(m.as_of).as_deref() == Some(et_date))
        .collect();
    if same_day.is_empty() {
        return false;
    }
    same_day.sort_by_key(|m| m.as_of);
    let meta = &same_day[0];
    let Some(body) = (match ring.load(symbol, meta.as_of).await {
        Ok(b) => b,
        Err(e) => {
            tracing::warn!(error = %e, "ensure promote ring load err — fall through");
            return false;
        }
    }) else {
        tracing::warn!("ensure promote ring load None — fall through");
        return false;
    };
    try_promote_bytes(archive, symbol, et_date, &body).await.is_some()
}

async fn try_promote_bytes(
    archive: &SessionChainArchive,
    _symbol: &str,
    _et_date: &str,
    body: &[u8],
) -> Option<()> {
    let wire = match crate::services::chain_snapshot::wire::deserialize_capture(body) {
        Ok(w) => w,
        Err(e) => {
            tracing::warn!(error = %e, "ensure promote deserialize failed — fall through");
            return None;
        }
    };
    archive_session_best_effort(archive, &wire, body).await;
    Some(())
}
```

Wire into `ensure_one` after presence miss: if `try_promote` → `EnsureOutcome::Promoted`.

**Do not** call `ring.append` on the promote path.

- [ ] **Step 4: run** → PASS.

- [ ] **Step 5: commit** `feat(api): ensure promote-from-ring zero Massive`

**Reviewer probe:** earliest `as_of` among same-`D` rows; promote failure must fall through, not
permanent warn+return.

---

### B4 — Force-compute with awaited archival + `(T,D)` singleflight + 300s spacing

**Files:** `ensure.rs` (force arm + `EnsureFlight` state); optionally thin
`pub(crate)` helper in `analytics.rs` for production Massive fetch that yields `VendorBundle`
**without** calling `spawn_capture`.

**Why:** SPEC §2 step 3 / AC-7/8/9. Live `spawn_capture` is fire-and-forget; ring Disabled no-ops
archival inside `capture_best_effort`. Ensure must **await** `capture_into` (ring on) or direct
`archive_session_best_effort` (ring off, archive on). Singleflight must not release until archival
await completes.

- [ ] **Step 1: failing tests**

```rust
#[tokio::test]
async fn force_awaits_capture_into_when_ring_enabled() {
    let archive = SessionChainArchive::memory();
    let ring = ChainSnapshotStore::memory();
    let as_of = New_York.with_ymd_and_hms(2024, 6, 3, 14, 0, 0).single().unwrap().with_timezone(&Utc);
    let et = et_date_from_as_of(as_of).unwrap();
    let mut force_calls = 0u32;
    let outcome = ensure_one(&archive, &ring, "SPY", &et, true, true, |_| async {
        force_calls += 1;
        Ok(fixture_probe_bundle("SPY", as_of))
    }).await;
    assert!(matches!(outcome, EnsureOutcome::ForceArchived));
    assert_eq!(force_calls, 1);
    assert!(archive.load("SPY", &et).await.unwrap().is_some());
    // Ring also received append (capture_into path)
    assert!(!ring.list("SPY", None).await.unwrap().is_empty());
}

#[tokio::test]
async fn force_direct_archives_when_ring_disabled() {
    let archive = SessionChainArchive::memory();
    let ring = ChainSnapshotStore::disabled();
    let as_of = New_York.with_ymd_and_hms(2024, 6, 3, 14, 0, 0).single().unwrap().with_timezone(&Utc);
    let et = et_date_from_as_of(as_of).unwrap();
    let outcome = ensure_one(&archive, &ring, "QQQ", &et, true, false, |_| async {
        Ok(fixture_probe_bundle("QQQ", as_of))
    }).await;
    assert!(matches!(outcome, EnsureOutcome::ForceArchived));
    assert!(archive.load("QQQ", &et).await.unwrap().is_some());
}

#[tokio::test]
async fn singleflight_prevents_concurrent_force_for_same_td() {
    let gate = EnsureGate::new();
    // spawn two ensure_with_gate calls; force fn blocks until both entered; assert force_calls == 1
    // (implement with tokio::sync::Barrier + AtomicU32 — full code in test file)
}

#[tokio::test]
async fn spacing_blocks_second_massive_within_300s_after_failure() {
    let gate = EnsureGate::new();
    let clock = AtomicU64::new(1_000);
    // first force fails → record attempt at t=1000
    // second at t=1299 → skipped (spacing)
    // third at t=1300 → allowed
}
```

- [ ] **Step 2: run** → FAIL.

- [ ] **Step 3: implement**

Force arm inside `ensure_one` after promote miss:

```rust
// force_compute yields live VendorBundle (caller owns Massive)
let bundle = match force_compute(symbol.to_string()).await {
    Ok(b) => b,
    Err(e) => {
        tracing::warn!(error = %e, symbol = %symbol, "ensure force-compute failed");
        return EnsureOutcome::AttemptFailed;
    }
};
if ring_enabled {
    if let Some(store) = ring.as_enabled() {
        if let Err(e) = capture_into(
            store,
            archive,
            bundle,
            Duration::from_secs(1_209_600),
            48,
        ).await {
            tracing::warn!(error = %e, "ensure capture_into failed");
            return EnsureOutcome::AttemptFailed;
        }
        return EnsureOutcome::ForceArchived;
    }
}
// Ring disabled (or as_enabled None) but archive enabled — direct archive
let wire = to_wire(&bundle);
let bytes = match serialize_capture(&wire) {
    Ok(b) => b,
    Err(e) => {
        tracing::warn!(error = %e, "ensure serialize failed");
        return EnsureOutcome::AttemptFailed;
    }
};
debug_assert_no_secrets_local(&bytes);
archive_session_best_effort(archive, &wire, &bytes).await;
EnsureOutcome::ForceArchived
```

`EnsureGate` (process-local, shared with worker):

```rust
pub struct EnsureGate {
    inflight: Mutex<HashSet<String>>, // key = "SPY|2024-06-03"
    last_force_attempt: Mutex<HashMap<String, Instant>>, // or injected Instant-like
}

impl EnsureGate {
    pub async fn run_spaced<F, Fut>(&self, symbol: &str, et_date: &str, min_spacing: Duration, now: Instant, body: F) -> Option<EnsureOutcome>
    where F: FnOnce() -> Fut, Fut: Future<Output = EnsureOutcome> {
        let key = format!("{symbol}|{et_date}");
        {
            let mut g = self.inflight.lock().await;
            if !g.insert(key.clone()) {
                return None; // already in-flight — joiners may await a broadcast; minimal: skip
            }
        }
        // spacing check against last_force_attempt (only applies to force arm — presence/promote bypass)
        let result = body().await;
        self.inflight.lock().await.remove(&key);
        // on AttemptFailed from force, record last_force_attempt = now
        Some(result)
    }
}
```

**Production Massive path:** add in `analytics.rs`:

```rust
/// Off-path ensure only: fetch a live VendorBundle. Does **not** spawn_capture.
pub(crate) async fn fetch_vendor_bundle_for_ensure(
    state: &AppState,
    sym: &str,
) -> Result<crate::services::market_data::VendorBundle, AppError> {
    let (_snap, vendor) = compute_analytics(state, sym, None, None).await?;
    Ok(vendor)
}
```

Do **not** put archival inside this helper — ensure awaits archival separately.

**Retention constants in `capture_into` call:** pass `state.config.chain_snapshot_max_age_secs` /
`max_per_symbol` from the worker (not hardcoded in production). Tests may use `1_209_600` / `48`.

- [ ] **Step 4: run** → PASS.

- [ ] **Step 5: commit** `feat(api): ensure force-compute awaits archival + singleflight spacing`

**Reviewer probe:** prove tests never call `spawn_capture`. Spacing must not block presence or
promote. Singleflight key is `(T,D)`, not ticker alone.

---

### B5 — Dedicated ensure worker + server spawn

**Files:** `ensure_worker.rs` (**create**); `mod.rs`; `server.rs`; `state.rs` (`EnsureWake`).

**Why:** SPEC §2 dedicated worker. Cadence + wake drain. Skips entirely when
`liquid_session_ensure_enabled` is false (AC-10).

- [ ] **Step 1: failing test** (unit on worker tick with injected clock + fake force):

```rust
#[tokio::test]
async fn worker_tick_ensures_all_three_on_weekday_when_missing() {
    // Build memory archive/ring, EnsureGate, clock fixed to Mon 2026-08-10,
    // force fn returns fixture per symbol; run run_ensure_pass once; assert three identities.
}
#[tokio::test]
async fn worker_noop_when_ensure_dial_off() { /* force_calls == 0 */ }
#[tokio::test]
async fn worker_skips_weekend_force() { /* clock = Saturday; force_calls == 0 */ }
```

- [ ] **Step 2: implement**

```rust
//! Dedicated off-path liquid-name session ensure worker.

use super::ensure::{/* … */};
use crate::state::AppState;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Notify;
use tracing::info;

#[derive(Clone, Default)]
pub struct EnsureWake {
    inner: Arc<Notify>,
}

impl EnsureWake {
    pub fn notify(&self) {
        self.inner.notify_one();
    }
    pub fn notified(&self) -> tokio::sync::futures::Notified<'_> {
        self.inner.notified()
    }
}

pub fn spawn(state: AppState) {
    if !state.config.liquid_session_ensure_enabled {
        info!("liquid session ensure disabled (LIQUID_SESSION_ENSURE_ENABLED=0)");
        return;
    }
    if !state.session_archive.is_enabled() {
        info!("liquid session ensure: archive store disabled — worker not started");
        return;
    }
    let wake = state.ensure_wake.clone();
    tokio::spawn(async move {
        // Initial pass + interval (default 60s is fine; Massive gated by 300s spacing).
        run_ensure_pass(&state).await;
        let mut ticker = tokio::time::interval(Duration::from_secs(60));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        ticker.tick().await;
        loop {
            tokio::select! {
                _ = ticker.tick() => {}
                _ = wake.inner.notified() => {}
            }
            run_ensure_pass(&state).await;
        }
    });
}
```

`run_ensure_pass`: for each `ENSURE_SYMBOLS`, compute `D = today_et_date(Utc::now())`; if
`!ensure_eligible` → continue; else `EnsureGate::run_spaced` → `ensure_one` with production
`fetch_vendor_bundle_for_ensure` closure. Presence/promote paths do not record Massive attempt
timestamps; only force-compute attempts do.

Wire `ensure_wake: EnsureWake` on `AppState` (cloneable). Update `AppState::new` / `for_tests`.

In `server.rs` after `warmer::spawn`:

```rust
crate::services::session_chain_archive::ensure_worker::spawn(state.clone());
```

- [ ] **Step 3: run** worker unit tests → PASS. Boot compile: `cargo build -p api-rust`.

- [ ] **Step 4: commit** `feat(api): spawn liquid session ensure worker`

**Reviewer probe:** worker must not start when ensure dial off **or** archive Disabled. Warmer
must still drop vendor (no capture bolted onto `refresh_analytics`).

---

### B6 — Optional non-blocking wake from warm traffic

**Files:** `analytics.rs` (`load_or_compute`, `load_analytics` cache-hit arms); optionally
`scanner/loop.rs` after closed-trio `load_or_compute`.

**Why:** SPEC §2 wake. Signal only — never request-scoped Massive / force-compute / await ensure.

- [ ] **Step 1: failing test** (unit with a mock Notify counter if extracted; else integration in
  B7 asserting wake does not increment force counter by itself when spacing blocks).

Minimal structural test:

```rust
#[test]
fn wake_helper_only_for_closed_set() {
    assert!(should_wake_ensure("SPY"));
    assert!(!should_wake_ensure("TSLA"));
}
```

- [ ] **Step 2: implement**

```rust
// ensure.rs
pub fn maybe_wake(wake: &EnsureWake, sym: &str) {
    if is_ensure_symbol(sym) {
        wake.notify();
    }
}
```

In `load_or_compute` cache-hit **before** `return Ok(hit)`:

```rust
crate::services::session_chain_archive::ensure::maybe_wake(&state.ensure_wake, sym);
```

Same on `load_analytics` early cache-hit return. **Do not** `.await` any ensure future on these
paths. **Do not** call `fetch_vendor_bundle_for_ensure` here.

- [ ] **Step 3: run** → PASS. Grep proof:

```text
rg -n "fetch_vendor_bundle_for_ensure|ensure_one|run_ensure_pass" apps/api/src/services/analytics.rs apps/api/src/routes
```

Expect **zero** matches in routes/; only wake helper in analytics.rs.

- [ ] **Step 4: commit** `feat(api): non-blocking ensure wake from closed-trio warm hits`

**Reviewer probe:** trader HTTP await stack must not include ensure Massive I/O (AC-7/16).

---

### B7 — Integration harness (ship-blocking AC core)

**Files:** `apps/api/tests/liquid_names_session_capture.rs` (**create**)

**Why:** SPEC §7 prefers one high-level hermetic pass covering AC-1–16 family.

- [ ] **Step 1: write harness** (complete; adjust imports to match B1–B4 exports):

```rust
//! liquid-names-session-capture integration harness (SPEC §7).

use api_rust::services::chain_snapshot::wire::{fixture_probe_bundle, /* … */};
use api_rust::services::chain_snapshot::{capture_into, ChainSnapshotStore};
use api_rust::services::session_chain_archive::{
    ensure_one, et_date_from_as_of, EnsureOutcome, SessionChainArchive, ENSURE_SYMBOLS,
};
use chrono::{TimeZone, Utc};
use chrono_tz::America::New_York;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::Duration;

#[tokio::test]
async fn harness_warm_weekday_promote_force_off_store_desk() {
    let weekday = New_York
        .with_ymd_and_hms(2024, 6, 3, 14, 0, 0) // Monday
        .single()
        .unwrap()
        .with_timezone(&Utc);
    let et = et_date_from_as_of(weekday).unwrap();
    let force = AtomicU32::new(0);

    // --- AC-6 promote path (QQQ): ring holds D, archive empty, force stays 0
    {
        let ring = ChainSnapshotStore::memory();
        let archive = SessionChainArchive::memory();
        capture_into(
            &ring,
            &SessionChainArchive::disabled(),
            fixture_probe_bundle("QQQ", weekday),
            Duration::from_secs(1_209_600),
            48,
        )
        .await
        .unwrap();
        let outcome = ensure_one(&archive, &ring, "QQQ", &et, true, true, |_| async {
            force.fetch_add(1, Ordering::SeqCst);
            unreachable!("promote")
        })
        .await;
        assert!(matches!(outcome, EnsureOutcome::Promoted));
        assert_eq!(force.load(Ordering::SeqCst), 0);
        assert!(archive.load("QQQ", &et).await.unwrap().is_some());
    }

    // --- AC-1/2/3 force path for SPY+IWM with ring empty (awaited archival)
    for sym in ["SPY", "IWM"] {
        let ring = ChainSnapshotStore::memory();
        let archive = SessionChainArchive::memory();
        let outcome = ensure_one(&archive, &ring, sym, &et, true, true, |s| async move {
            force.fetch_add(1, Ordering::SeqCst);
            Ok(fixture_probe_bundle(&s, weekday))
        })
        .await;
        assert!(matches!(outcome, EnsureOutcome::ForceArchived));
        assert!(archive.load(sym, &et).await.unwrap().is_some());
    }

    // --- AC-9 presence short-circuit: second ensure spends 0 force
    {
        let ring = ChainSnapshotStore::memory();
        let archive = SessionChainArchive::memory();
        let _ = ensure_one(&archive, &ring, "SPY", &et, true, true, |_| async {
            force.fetch_add(1, Ordering::SeqCst);
            Ok(fixture_probe_bundle("SPY", weekday))
        })
        .await;
        let before = force.load(Ordering::SeqCst);
        let outcome = ensure_one(&archive, &ring, "SPY", &et, true, true, |_| async {
            force.fetch_add(1, Ordering::SeqCst);
            unreachable!("presence")
        })
        .await;
        assert!(matches!(outcome, EnsureOutcome::Present));
        assert_eq!(force.load(Ordering::SeqCst), before);
    }

    // --- AC-10 ensure-off posture is a research miss class (worker not started) —
    // exercised as: no ensure_one call ⇒ archive empty ⇒ research would say no session book.
    // Pin: dial-off does not fabricate a book:
    {
        let archive = SessionChainArchive::memory();
        assert!(archive.load("SPY", &et).await.unwrap().is_none());
    }

    // --- AC-13 store-off
    {
        let archive = SessionChainArchive::disabled();
        let ring = ChainSnapshotStore::memory();
        let before = force.load(Ordering::SeqCst);
        let outcome = ensure_one(&archive, &ring, "SPY", &et, false, true, |_| async {
            force.fetch_add(1, Ordering::SeqCst);
            unreachable!("store-off")
        })
        .await;
        assert!(matches!(outcome, EnsureOutcome::StoreDisabled));
        assert_eq!(force.load(Ordering::SeqCst), before);
    }

    // --- AC-11/16 desk isolation: force failure does not panic; archive stays miss
    {
        let archive = SessionChainArchive::memory();
        let ring = ChainSnapshotStore::memory();
        let outcome = ensure_one(&archive, &ring, "SPY", &et, true, true, |_| async {
            force.fetch_add(1, Ordering::SeqCst);
            Err(api_rust::services::session_chain_archive::EnsureForceError::Compute(
                "blip".into(),
            ))
        })
        .await;
        assert!(matches!(outcome, EnsureOutcome::AttemptFailed));
        assert!(archive.load("SPY", &et).await.unwrap().is_none());
    }

    let _ = ENSURE_SYMBOLS;
}
```

Add companion cases in the same file (or sub-tests) for:

- AC-4/5/12/14/15: call research handlers via `AppState::for_tests` + existing
  `research_session_books` unit patterns — `vendor_called == false`, closed miss strings, no date
  substitution, unreadable class, `authorizes == "nothing"` on hit + list-miss (AC-25).
- AC-8 spacing + singleflight (use `EnsureGate` with injected clock).
- Ring-disabled force still archives (AC-7).

- [ ] **Step 2:** `cargo test -p api-rust --test liquid_names_session_capture` → exit 0.

- [ ] **Step 3: commit** `test(api): liquid-names-session-capture harness`

---

### B8 — Isolation / score / retention / closed-scope / secrets

**Files:** `apps/api/tests/liquid_names_session_capture_isolation.rs` (**create**)

- [ ] **Step 1: tests**

```rust
#[test]
fn ensure_module_does_not_import_signals_score_gate() {
    let src = std::fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/src/services/session_chain_archive/ensure.rs"
    )).unwrap();
    for forbid in ["generate_signals", "opportunity_score", "state_fingerprint", "evaluate_gate"] {
        assert!(!src.contains(forbid), "ensure leaf imported {forbid}");
    }
}

#[test]
fn retention_dials_unchanged() {
    // pin config defaults 48 / 1_209_600 (read config.rs source or call existing unit)
    let cfg = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/config.rs")).unwrap();
    assert!(cfg.contains("env_u64(\"CHAIN_SNAPSHOT_MAX_PER_SYMBOL\", 48)"));
    assert!(cfg.contains("env_u64(\"CHAIN_SNAPSHOT_MAX_AGE_SECS\", 1_209_600)"));
}

#[test]
fn closed_trio_only_in_ensure_symbols() {
    assert_eq!(ENSURE_SYMBOLS.len(), 3);
}

#[tokio::test]
async fn score_identity_unaffected_fixture_pin() {
    // Reuse score_identity / session_chain_archive harness triple — assert pinned score still holds
    // OR call existing tests indirectly by documenting V1 runs score_identity.rs green.
}
```

Secrets: after force archival, scan body bytes for `apikey` / `api_key` (same as capture
`debug_assert_no_secrets`).

- [ ] **Step 2:** `cargo test -p api-rust --test liquid_names_session_capture_isolation` → exit 0.

- [ ] **Step 3: commit** `test(api): liquid ensure isolation + retention pins`

---

## Frontend track

> **`NO_UI_CHANGE`.** No routes, components, Settings copy, Ask-AI lines, Scanner/Positions/
> Ticker chrome, or tooltips. Frontend work is structural enforcement of AC-18/25 + AC-19 Pages
> non-regression only.

### F1 — Pages `/api/_research` 404 non-regression (AC-19)

**Files:** `functions/api/[[path]].ts` (**verify only**); covered by F2 structural spec.

- [ ] **Step 1:** Confirm live Pages catch-all still 404s `_research` beside `_metrics` (same as
  session-chain-archive F1). **No product change expected.**

- [ ] **Step 2:** If somehow missing, restore the exact `_metrics` + `_research` 404 branch — do
  not invent a narrower allow-list; do **not** proxy `_research` to Railway.

- [ ] **Step 3:** Commit only if a restore was required:
  `fix(pages): restore /api/_research 404 like /api/_metrics`.

### F2 — Trader chrome absence + authorizes posture scan (AC-18, AC-25)

**Files:** `apps/dashboard/src/app/liquid-names-session-capture.structural.spec.ts` (**create**)

**Why:** SPEC §4 / §7 — no DOM harness; structural empty-diff + mutation-tested affordance scan.
Mirror [`session-chain-archive.structural.spec.ts`](../../../apps/dashboard/src/app/session-chain-archive.structural.spec.ts).

- [ ] **Step 1: write the structural spec**

```ts
/**
 * liquid-names-session-capture F1+F2 — NO_UI_CHANGE (AC-18, AC-19, AC-25).
 *
 * F1: Pages trader origin 404s `/api/_research` like `/api/_metrics`.
 * F2: no lab-name / session-capture / warm-cache-ensure chrome on trader sources;
 *     libs/api gains no `/api/_research/session-books` helper; no authorizes/session-book
 *     redistribution affordance on trader UI.
 *
 * Mutation-tested (`[structural-over-prose-enforcement]`).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DASHBOARD_SOURCES = import.meta.glob(
  ['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}', '!**/*.test.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** AC-18 closed needles — ensure / lab-name / session-capture must not leak to trader UI. */
const TRADER_FORBIDDEN = [
  '/api/_research',
  'session-books',
  'liquid-names-session-capture',
  'liquid_session_ensure',
  'LIQUID_SESSION_ENSURE',
  'lab names',
  'warm-cache ensure',
  'session capture',
  'RESEARCH READ — SESSION BOOK',
  'no session book for',
  'authorizes: "nothing"',
  "authorizes: 'nothing'",
] as const;

const CLIENT_FORBIDDEN = ['/api/_research', 'session-books', 'liquid_session_ensure'] as const;

// Copy workspaceRoot / pagesSourceBlocksResearch / isBlockedOnTraderOrigin / collectTsFiles /
// hitsIn helpers verbatim from session-chain-archive.structural.spec.ts (same Pages extractor).

describe('F1 · Pages 404 /api/_research (AC-19)', () => {
  it('anti-vacuity — Pages catch-all exists and 404s _metrics', () => {
    expect(existsSync(PAGES_FN), PAGES_FN).toBe(true);
    const src = readFileSync(PAGES_FN, 'utf8');
    expect(extractOperator404Condition(src)).toContain('/api/_metrics');
  });

  it('same 404 branch covers /api/_research and session-books subpaths', () => {
    const src = readFileSync(PAGES_FN, 'utf8');
    expect(pagesSourceBlocksResearch(src)).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/session-books/SPY')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/session-books/QQQ/book')).toBe(true);
    expect(isBlockedOnTraderOrigin('/api/_research/session-books/IWM')).toBe(true);
  });
});

describe('F2 · no liquid-ensure trader chrome (AC-18 / AC-25)', () => {
  it('anti-vacuity — glob sees pages/features/shell', () => {
    const keys = Object.keys(DASHBOARD_SOURCES);
    expect(keys.length).toBeGreaterThan(40);
    expect(keys.some((k) => k.includes('/pages/'))).toBe(true);
    expect(keys.some((k) => k.includes('/features/'))).toBe(true);
    expect(keys.some((k) => k.includes('/shell/'))).toBe(true);
  });

  it('dashboard production sources carry none of the ensure / lab-name needles', () => {
    const offenders: string[] = [];
    for (const [path, src] of Object.entries(DASHBOARD_SOURCES)) {
      const hits = hitsIn(src);
      if (hits.length) offenders.push(`${path} → ${hits.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('no new trader page/route for session capture or lab names', () => {
    const leakPaths = Object.keys(DASHBOARD_SOURCES).filter((k) =>
      /liquid-names|session-capture|lab-names|session-books|_research/.test(k),
    );
    expect(leakPaths).toEqual([]);
    expect(existsSync(resolve(DASHBOARD_APP, 'pages', 'liquid-names'))).toBe(false);
    expect(existsSync(resolve(DASHBOARD_APP, 'pages', 'session-books'))).toBe(false);
  });

  it('route table and nav stay free of ensure / research-browse paths', () => {
    const appKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/app.tsx'));
    const navKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/shell/TopNav.tsx'));
    expect(appKey && navKey).toBeTruthy();
    expect(hitsIn(DASHBOARD_SOURCES[appKey as string])).toEqual([]);
    expect(hitsIn(DASHBOARD_SOURCES[navKey as string])).toEqual([]);
  });

  it('libs/api has no session-books / ensure research helper', () => {
    const src = readFileSync(CONVEXA_CLIENT, 'utf8');
    expect(hitsIn(src, CLIENT_FORBIDDEN)).toEqual([]);
  });

  it('mutation — scanner fires on poisoned trader source', () => {
    const poison = [
      "fetch('/api/_research/session-books/SPY')",
      '// lab names',
      '// warm-cache ensure',
      '// RESEARCH READ — SESSION BOOK',
      'authorizes: "nothing"',
    ].join('\n');
    expect(hitsIn(poison).length).toBeGreaterThan(3);
  });

  it('carve-out — ordinary SPY/QQQ/IWM ticker mentions are not ensure chrome', () => {
    expect(hitsIn('getTicker("SPY"); streamTicker("QQQ"); IWM')).toEqual([]);
  });
});
```

Fill helper functions by copying from
`apps/dashboard/src/app/session-chain-archive.structural.spec.ts` (do not import across specs —
keep self-contained).

- [ ] **Step 2:**

```text
npx nx test @convexa/dashboard --testFile=liquid-names-session-capture.structural.spec.ts
npx nx typecheck @convexa/dashboard
```

Expect both exit 0 (`$LASTEXITCODE -eq 0`). **Do not** add UI.

- [ ] **Step 3: commit** `test(dashboard): no liquid-ensure trader chrome`

**Parallel with backend:** F1/F2 do not wait on B*.

---

## Verification track

Run after Backend B8 + Frontend F2.

### V1 — Backend suite

- [ ] `npm run ports:free` (if orphan servers)
- [ ] `npx nx test api`
  - Expect: exit 0 (`$LASTEXITCODE -eq 0`)
  - Includes: `liquid_names_session_capture*` + existing `session_chain_archive*` +
    `chain_snapshot_*` + `score_identity` still green

### V2 — Pages `_research` 404 proof

- [ ] `rg -n "api/_research" functions/api/[[path]].ts` shows 404 branch beside `_metrics`
- [ ] F2 structural Pages cases green

### V3 — Interface conformance (re-pin)

- [ ] Start API: `npx nx serve api` (port 8000) — archive store enabled; dedicated seed
  `(SPY, 2020-01-02)` planted (existing boot plant) or plant manually
- [ ] Run:

```text
node .grok/tools/interface_conformance.mjs --contract .spire/clusters/tech/contracts/liquid-names-session-capture/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --report .spire/clusters/tech/contracts/liquid-names-session-capture/conformance-receipt.json
```

  Expect PASS on list SPY/QQQ/IWM shapes, list ZZZZNOPE miss keys (incl. `authorizes`), load miss
  404, load hit 200 when seeded. QQQ/IWM **list** may vacuously pass on empty `books[]` — that is
  **not** AC-1–3 evidence (harness owns warm-cache guarantee).

- [ ] Manually assert closed tokens: list miss `detail`, hit `authorizes === "nothing"`,
  `vendor_called === false`, `source_as_of` present on hit.

### V4 — Dashboard typecheck + chrome absence

- [ ] `npx nx typecheck @convexa/dashboard` → exit 0
- [ ] `npx nx test @convexa/dashboard --testFile=liquid-names-session-capture.structural.spec.ts`
  → exit 0
- [ ] `git diff --name-only -- apps/dashboard` → no product UI files (structural spec only)

### V5 — Review ACs

- [ ] **AC-21:** `CHAIN_SNAPSHOT_MAX_PER_SYMBOL` still 48; age still `1_209_600`
- [ ] **AC-22:** ensure symbols == SPY/QQQ/IWM only — no whole-universe promise
- [ ] **AC-23:** no program #3–#7 / hist-chain / Path-B rewrite in diff
- [ ] **AC-24:** operator path remains `/api/_research/session-books/...` without trader UI

### V6 — AC traceability checklist (ship-blocking)

| AC | Track evidence |
|---|---|
| AC-1, AC-2, AC-3 | B7 harness force/promote → identities for trio on weekday |
| AC-4, AC-5 | B7 research list/load `vendor_called` false + `source_as_of` |
| AC-6 | B3/B7 promote zero force |
| AC-7 | B4/B7 await `capture_into` / direct archive; wake-only on request path (B6) |
| AC-8 | B4/B7 singleflight + ≥300s spacing |
| AC-9 | B2/B7 presence short-circuit |
| AC-10 | B5 dial-off + B7 empty archive honesty |
| AC-11, AC-16 | B7 force fail → desk/archive miss; B6 no await on trader path |
| AC-12, AC-15 | B7 research miss closed string; no date substitution |
| AC-13 | B2/B7 store-off skip zero Massive |
| AC-14 | B7 unreadable class (reuse session-books handler tests) |
| AC-17 | B8 leaf import scan + `score_identity` green (V1) |
| AC-18, AC-25 | F2 structural + B7 `authorizes` pin + V3 |
| AC-19 | F1/F2 Pages 404 + V2 |
| AC-20 | B8 secrets scan on archived body |
| AC-21, AC-22 | B8 pins + V5 |
| AC-23, AC-24 | V5 review |

Overall Verification PASS requires V1–V5 exit/review green and every `test`-marked AC mapped above.

---

## Planning fills (not product re-opens)

1. **Live hole cited:** `load_or_compute` cache-hit (`analytics.rs`) returns without
   `spawn_capture`; `refresh_analytics` drops `_vendor`; `spawn_capture` is `tokio::spawn` of
   `capture_best_effort`, which no-ops archival when ring Disabled.
2. **Module home:** ensure leaf + worker live **under** `session_chain_archive/` (one-way leaf
   stays intact; signals never import it).
3. **Force-compute helper:** `pub(crate) fetch_vendor_bundle_for_ensure` wraps private
   `compute_analytics` and returns `VendorBundle` **without** `spawn_capture`; ensure awaits
   archival separately.
4. **Ring list signature:** live `ChainSnapshotStore::list(&self, symbol: &str, limit: Option<usize>)`
   — plan uses that, not a fictional `list(T)`.
5. **Wake transport:** `tokio::sync::Notify` on `AppState.ensure_wake`; optional from closed-trio
   warm hits only.
6. **FE:** structural spec only; AC-25 wire tokens asserted in backend + GATE Q; FE proves trader
   silence.

---

## Out of scope (do not implement)

- Raising 48 / 14d ring retention
- Expanding ensure beyond SPY/QQQ/IWM
- Capture inside `refresh_analytics` / force-compute on every warm hit
- Fire-and-forget `spawn_capture` as ensure completion
- Day-scoped attempt-spent latch after first Massive (rejected by owner A)
- Unbounded Massive every warmer tick
- Invented Massive/exchange holiday calendar
- Program #3 join-smoke / #4 digest / #5 corpus / #6 AI-rec lab / #7 object-store / hist-chain
- Trader UI / Settings / Ask-AI / nav / Pages proxy of `_research`
- Fifth absence class (ensure-pending / lab-name / warm-cache excuse)
- Path-B / `batch-backtest` / `replay-outcome-join` CLI rewires
