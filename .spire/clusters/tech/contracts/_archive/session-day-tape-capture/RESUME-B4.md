# RESUME-B4 — Path-B persist hook

**Resume status:** DONE (re-verify blocked by sibling B3)

## Done

- Created `apps/api/src/services/day_tape/path_b.rs`:
  - `should_keep` / `is_path_b_capturing` / `maybe_spawn_persist` / `persist_at`
  - Keep only when store on + watchlist + warm on + mark in 09:30…16:00 fill + mark free
  - Arms Path-B capture-on when warm is on (before first snapshot)
  - Drops `source` via `prepare_path_b_body` before `put_path_b`
  - Fire-and-forget spawn; store Err → S2 skip line; never fails warmer
- Hooked `refresh_analytics` in `apps/api/src/services/analytics.rs` (no `spawn_capture`)
- Declared `pub mod path_b` in `day_tape/mod.rs` (necessary link; also listed in poison scan)

## Tests (observed green)

Command (focused filter; PLAN's dual `--lib` is invalid on this cargo):

```
cargo test -p api-rust --locked --lib -- path_b:: refresh_analytics_still_has_no_spawn_capture vendor_fixture_none_still_calls
```

**Exit code: 0** — 10 passed / 0 failed (captured before sibling `path_a` broke the crate):

- `at_most_one_snapshot_per_5min_mark_not_25s` (AC-11, AC-12)
- `persist_does_not_increment_vendor_counter` (AC-13)
- `mark_1600_filled_from_1604_not_left_gap_because_afterclose` (AC-14)
- `dropped_source_discriminant_never_live_massive_on_bytes` (AC-15)
- `through_window_zero_snapshots_derives_one_gap_per_mark` (AC-16)
- `warm_off_is_path_b_not_capturing_no_new_poller` (AC-17)
- `persist_does_not_insert_if_absent_or_ring_append` (AC-18)
- `persist_fail_skip_line_trader_compute_ok` (AC-38)
- `refresh_analytics_still_has_no_spawn_capture` (poison 1)
- `vendor_fixture_none_still_calls_the_four_fetch_join` (regression)

## Gotchas / blocked re-verify

Sibling B3 `path_a.rs` currently fails compile (wrong `include_str!` path to `ws.rs`; `dyn Fn` clock not `Sync` inside `tokio::spawn`). **Do not edit `path_a.rs` / `server.rs` from B4.** Fresh `cargo test -p api-rust --lib` is blocked until B3 lands a compiling Path-A.

## Next concrete step (for a fresh lane only if needed)

After B3 compiles: re-run the focused command above; expect exit 0. No conformance-receipt from B4.

## Invariants checked

- `[best-effort-isolated-or-null]` — tape write fail never fails refresh
- `[additive-keeps-score-byte-identical]` — no score/gate touch
- `[structural-over-prose-enforcement]` — poison: no `spawn_capture` in `refresh_analytics`
- No `LiveMassive` / `live_massive` on stored Path-B bytes
- No `WARM_SYMBOLS` mutation; no ring append; no `insert_if_absent`
