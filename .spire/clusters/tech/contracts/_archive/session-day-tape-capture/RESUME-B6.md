# RESUME-B6 — Optional clap `session-day-tape`

**Resume status:** DONE

## Done

- Created `apps/api/src/services/day_tape/cli.rs`:
  - `open_session_day_tape_for_cli` / `evaluate_cli` / `evaluate_load` / `evaluate_list`
  - Standing block SPEC §4 with **Evidence: local**; closing includes `local audit is not production coverage`
  - Weekend / not-elapsed / no-identity / not-in-watchlist → exit 0 + `Not a coverage miss.`
  - Not-storing / unreadable → non-zero `[ERROR]`
  - GATE Z: named past weekday with no container → no-identity `[OK]`, not a pre-store literal
  - No Massive / live port construct; `TAPE_CLI_VENDOR_CALLS` stays 0
- Wired `Commands::SessionDayTape` in `apps/api/src/main.rs` with `ExitCode` dispatch **before** `run()`
- Declared `pub mod cli` + poison scan includes `cli.rs` (standing `spawn_capture` split for source scan)

## Tests (observed green)

```
cargo test -p api-rust --locked --bin api-rust session_day_tape_wiring
```
**Exit code: 0** — 2 passed

```
cargo test -p api-rust --locked --lib day_tape::
```
**Exit code: 0** — 59 passed (includes 8 cli render + poison)

V3 smoke: `session-day-tape --help` exit 0; `--symbol NVDA --et-date 2020-01-02` exit 0 with `not in tape watchlist: NVDA` + `Not a coverage miss.` + `Evidence: local`.

## Carry forward

- Suggested commit (not made here): `feat(api): session-day-tape research CLI`
- B5 HTTP + B7 isolation still pending; B6 did not touch routes/OpenAPI/path_a/path_b/analytics/server
- Do not consume this file as ACTIVE — status is DONE
