# day-replay-mock-adapter — council decisions

R3 input: `council/conflicts.json` (17 conflicts, 17/17 quotes verified, 6 self-revisions).

## Self-revisions (folded; not human, not a re-spawn)

- Architect withdraws **no consume-visible occupancy** (`bfe7b974…`). Replay publishes closed
  occupancy on the existing hub/SSE path: not paid-live; identity `(symbol, et_date)`; tape
  cursor time; phase playing/gap/ended/fault. Recency is wall-clock for drop detection only.
  `MarketDataPort` stays Live|Fixture; `StreamEvent` stays stamp-only.
- Architect withdraws **end-of-tape as recency age-out** (`7fbd4808…`). Playing keep-alive
  (non-tick) below the consume watchdog; last occupant publishes **ended**, then stop; no loop.
  RecvError/lag is drop, distinct from ended and fault.
- Architect withdraws **skip-emit gaps** (`4a47e321…`). Cursor passing a Path-A gap publishes
  gap occupancy (non-tick), then sleeps to the next stamped trade/quote. Unreadable container
  still refuses start.
- UX withdraws **Path-A-zero start-refuse** (`b211f952…`). Empty stored Path-A may walk; literal
  `no path-a ticks…` stays as empty standing, not a miss refuse.
- UX withdraws required **`/_ops/replay` Start page** (`96e2e86f…`). Arming is process-start /
  CLI this slice.
- UX withdraws required ticker **`session tape gap` chip** (`49ddf5b3…`) unless a vouched gap
  lands on the envelope. Negative stands: no live-lag copy for a recorded Path-A gap.

## Unanimous / conductor folds (no exchange)

- Exclusive construct at **process start**; production-profile plus arm **refuses startup**.
  Unset production still talks to Massive.
- Same ticker SSE path; **no second live UI path**; no trader play/pause/scrub; no Settings toggle.
- Locked trio SPY/QQQ/IWM; named ET weekday; missing/unreadable/not-storing **refuse** (silent hub).
- **Empty Path-A walk starts** (Path-B may still unfold). Empty ≠ missing. (`7a23ee55…`,
  `51e6698d…`, UX self-rev `b211f952…`.)
- **No `/_ops/replay` this slice.** CLI/process standing only. (`f8d325a0…`, `1a021b3a…`,
  UX self-rev `96e2e86f…`.)
- Replay never `LiveMassive` / coverage `present`. `Authorizes: nothing` on the score formula.
- Pace closed set `{1×, 4×, 10×}` at arming (PM); 60× out.
- Fixture and batch-backtest are not this clock.

## Human product rulings

- none — remaining product quotes were against withdrawn UX claims and folded above.

## Pending human product rulings

- none

## Technical exchanges (one round; all converged)

- **Consume occupancy (`ReplayConsumeOccupancy`) — architect ↔ ux.** Same ticker SSE.
  `MarketDataPort` stays `{Live, Fixture}`; `StreamEvent` stamp-only. Process occupancy:
  basis not paid-live while armed; envelope `live` forced false; identity `(symbol, et_date)`;
  tape cursor from stored stamps; phase `playing` | `gap` | `ended` | `drop` | `fault`.
  Playing keep-alive is non-tick JSON data (not SSE comments) period < 15s. Ended/fault
  **repeat** as data; silence is not the classifier. Drop ≠ live-offline (unset-arm only).
  S1 copy: `session tape · {SYM} · {humanSessionDate} · tape {HH:MM:SS} ET`; ended /
  stream-dropped / playback-fault distinct. Banned live interpolations are `test`.
- **Net-flow / Verify-by / partial — ux ↔ pm.** 1× may keep last-few-minutes net-flow;
  4×/10× must not claim tape minutes. Banned live interpolations `test`; exact standing
  prose `review`. Ticker never prints `partial captured day` or completeness %. Chip omits
  ` · 1×`; prints ` · 4×` / ` · 10×` only. Token `live` in closed negations (`not a live
  vendor feed`) is allowed; occupancy is the gate.

## Pending technical exchanges

- none
