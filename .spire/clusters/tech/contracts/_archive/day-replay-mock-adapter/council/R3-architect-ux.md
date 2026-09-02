# R3 — architect ↔ ux

One exchange. Conflicts `bfe7b974…` `7fbd4808…` `4a47e321…` (architect self-revisions, already folded in `decisions.md`), `c0a10b7e…` (PM), `098b970f…` (PM), `096836b6…` (UX), `cc3e3ef5…` (UX). Same consume-path; PM’s quotes are answered here so the ticker facts UX copies are the facts PM required. I do not author copy, layout, endpoint signatures, or JSON key spellings. Interface at R4 spells keys. Envelope **facts** below are what UX must consume.

Withdrawn and not restated as design: copy-only occupancy; end-of-tape as recency age-out; skip-emit of a stored Path-A gap with no consume-path signal.

## Converged

### 1. What I withdraw (so the replacement can be attacked)

I **withdraw** these R1 sentences as consume-path design:

- “Architect does not add a wire field; PM/UX must not treat recency-true as Massive-live.”
- “End-of-tape / player drop degrades like an SSE gap (recency ages out); last Path-B snapshot remains.”
- “Skip emit; occupancy already recorded the gap.”
- “Recency (`last_tick_wall`) stays wall clock so end-of-tape still degrades in 30s of operator time.” — withdrawn **as the end classifier**. Wall recency of a last **print** may still exist as an age; it does not mean ended, drop, fault, or paid-live.

Those sentences are no longer defensible. Verified consume path today:

- SSE JSON sets the paid-live classifier from **wall** `last_tick_wall` (`tick_age < 30s` → envelope `live`).
- Envelope `ts` is `Utc::now()` milliseconds, not tape time. `market_session()` is `Utc::now()` America/New_York.
- Quiet throttle emits SSE **comments** (`heartbeat`). `streamTicker` documents that EventSource **ignores comments**. Axum `KeepAlive` (15s) is also comments.
- Client watchdog `STREAM_OFFLINE_MS = 15_000` resets only on a parsed **data** payload. Silence → `streamOffline`.
- Client `isLive = (live?.live ?? false) && !streamOffline`. That boolean — not process occupancy — gates paid-live chrome and `evaluateOrder` fills.

Replay ticks **will** satisfy 30s wall recency. A Δt/k sleeper **will** go quiet longer than 15s at 1×. Comment keep-alive **will not** reset the watchdog. Stop-publish **will** look like vendor-down. Instructing UX not to treat recency as Massive-live is copy theater. `present-is-live-paid-only`, `live-vs-static-isolation`, and `honesty-is-structural` fail unless occupancy is **on this path**.

### 2. Named mechanism: ReplayConsumeOccupancy

**Same socket. Same ticker SSE. Not a third `MarketDataPort`. `StreamEvent` stays stamp-only (Trade|Quote + `ts_ns`). Occupancy is assembled in the existing ticker SSE loop from a process occupancy slot the player writes.**

| Option | Complexity | Cost | Familiarity | Decisive failure |
| --- | --- | --- | --- | --- |
| A. Process occupancy only; tell UX not to treat recency as live (R1) | lowest | none | high | paid-live chrome; copy-only |
| B. Provenance member on `StreamEvent` / fake Trade\|Quote keep-alives | med | hub schema; `apply_event` fabricates flow | med | invented prints; mixes occupancy with Path-A |
| C. Second EventSource / second hub | high | second live UI path | — | BRIEF forbids |
| **D. Armed occupancy **data** pump on the existing LiveUpdate path** (chosen) | low–med | additive envelope facts | **high** (existing 250ms throttle + `publish_event`) | none if `live` is forced false and keep-alive is data |

Decisive axes: **`present-is-live-paid-only` + `live-vs-static-isolation` + team familiarity**, then complexity under effort M. Familiarity with today’s recency bit loses: that bit is the paid-live classifier.

#### 2.1 Process occupancy slot (player writes, SSE reads)

One process slot (beside `ReplayHold`, not `vendor_fixture`, not coverage):

- **basis** — closed: this stream is **not paid-live** (session tape / research playback). Unset arm: today’s Massive path; no session-tape basis.
- **identity** — the armed `(symbol, et_date)` America/New_York `YYYY-MM-DD`. Process-scoped: every ticker SSE on an armed process carries this identity, not only the armed symbol’s socket.
- **tape cursor time** — last scheduler cursor from stored stamps (and Path-B marks converted onto `et_date`). **Not** envelope wall `ts`. **Not** client `Date.now()`. **Not** last-print `spot_ts` during a keep-alive between occupants (cursor may be ahead of the last trade).
- **phase** — closed: `playing` | `gap` | `ended` | `drop` | `fault`.
- **paid-live classifier** — the existing envelope `live` bit. **False while the construct is armed**, including keep-alive, ended, gap, drop, and fault payloads. Recency-true must not set it.

`MarketDataPort` remains `{Live, Fixture}`. Hub events that move price remain `StreamEvent` Trade/Quote with stored `ts_ns`. Keep-alives and phase pulses are **not** `apply_event` of a synthetic print: no fabricated last-trade, no buy/sell bump, no `PriceCache` write from a fake event.

#### 2.2 Armed SSE data pump (this is the keep-alive)

While armed, the existing ticker loop must emit **JSON data** occupancy on a **wall** period **strictly less than** `STREAM_OFFLINE_MS` (15s), with jitter margin (implementation: ≤5s wall). Independent of `k`. Real ticks still throttle as today when `dirty`. When `!dirty`, **do not** substitute a comment: emit occupancy data carrying last known tape numbers + the slot.

Why wall, not tape: a 1× lunch gap is minutes of tape and minutes of operator time; `k` compresses waits between occupants, not the watchdog.

After **ended** or **fault** is first published, **repeat** that occupancy on the same data period until the process stops. One-shot ended + silence is how a lost packet becomes live-offline. Repeat is the repair.

Production unset: pump off; `live` remains recency; comments remain comments; S0 byte-identical.

#### 2.3 Paid-live classifier false while armed

Mechanism: occupancy pump **overrides** `is_live = tick_age < 30s`. While armed, envelope `live` is **false** on every data payload for **every** ticker SSE on that process (exclusive construct: no Massive worker). `tick_age_s` may still be wall age of the last **print** (`apply_event` only). It is not provenance, not ended, not drop.

Assumption for UX (copy / client branch, not my strings): branch on **basis before** `live` / `feed` interpolation. Display-active (headline / tiles / flash) may follow session-tape numbers while phase is `playing` (or `gap`). Genuine `isLive` stays false so fills, live pulse, and live-session chip meaning stay off. Poison below still fails a payload that sets `live: true` with session-tape basis.

`feed` is not a live-vendor token while armed. I will not stamp `live_massive` there. UX must still not interpolate `Streaming live ${feed}` when basis is session tape.

#### 2.4 Tape time ≠ wall `Date.now()`

Two clocks, consumed separately:

| Clock | Drives | Must not drive |
| --- | --- | --- |
| **Tape cursor** (stored stamp on `et_date`) | chip tape time ET; `market_session` **while armed** (inject cursor into that classifier; default remains wall on unset production) | envelope wall `ts`; client `Date.now()` as “market now” |
| **Wall receive** | keep-alive period; last-print `tick_age_s`; transport drop timing | paid-live; ended; session classifier while armed |

Do not retask existing envelope `ts` as tape time. That field is wall today. Relabeling it is the lie UX named.

#### 2.5 Closed phases (playing keep-alive vs ended vs drop vs fault vs gap)

| Phase | Producer | Consume standing | Distinct from |
| --- | --- | --- | --- |
| **playing** | Sleeper running. Data keep-alives + real Trade/Quote when the cursor hits a stamped occupant. Path-B `ReplayHold.replace` at stored marks (not a phase of its own). | Clock is running. Last tape numbers may move on real prints; keep-alive repeats last numbers. | gap record; end; drop; fault; live Massive |
| **gap** | Cursor **visits a stored PathAGap** (no `ts_ns`; vec order between stamped neighbors). One **non-tick** gap occupancy pulse, then sleep to the next stamped Trade/Quote. Keep-alives **after** that pulse are **playing** — the wait is the clock. Unreadable `DayContainer` still refuses the whole start. No interpolated ticks. No sleep **on** the ts-less gap record. | A vouched recorded Path-A gap landed. UX may chip it **only because it is vouched**. Inter-arrival silence with no PathAGap record is **not** gap. | watchdog silence; ended; live “feed lagging” |
| **ended** | Last stored occupant emitted. Publish **ended**, then stop the sleeper; **do not loop**. Occupancy pump **repeats ended**. Last `ReplayHold` stays. No further Path-A. | End of captured day. Last tape numbers kept. Structure stays last snapshot. | live-offline; overnight / market-closed / no-live-ticks; drop; fault |
| **drop** | (1) Hub `RecvError::Lagged` or `Closed` **while phase was playing or gap**, if the SSE loop can still speak — publish drop. While armed, Lagged is **not** silent `continue`. (2) Else client: payload-gap watchdog while **last vouched phase was playing or gap**. | Session-tape stream dropped. Clock may still be running in-process; the consume path did not. | ended; fault; unset-arm Massive reconnect |
| **fault** | Player / tape-read / clock failure. Publish **fault** if the hub/SSE loop is still up. Last `ReplayHold` stays. No 5xx (`best-effort-isolated-or-null`). No fabricated ticks to paper over. | Replay fault. | ended; drop; live-offline |
| **(unset only) live-offline** | Production/unset recency + watchdog, as today. | Massive / live path down. | anything while armed |

**Client consume rule (binding, not copy):** the payload-gap watchdog may still flip a transport-offline bit. While last vouched **basis is session tape**:

- last phase `ended` | `fault` → **not** drop, **not** live-offline, **not** overnight-no-live-data;
- last phase `playing` | `gap` + payload gap → **drop**, **not** live-offline;
- `live` is false, so today’s `isLive` cannot become true;
- live-offline copy / `OFFLINE_CHIP_TOOLTIP` / `⏸ offline` as Massive reconnect is **unset-arm only**.

If the envelope cannot name fault (hub already dead), the ticker may only see **drop**. CLI/process occupancy can still be fault. Fault must not reuse live-offline.

**Not-the-armed-day:** occupancy identity is always the armed pair. A ticker SSE whose route symbol ≠ armed symbol still carries session-tape basis, `live: false`, and that identity — no Massive, no second tape, no fabricated prints. UX maps “not the armed day” from identity mismatch; I do not write the string. Silence on that socket without occupancy would recency-age into live-offline — the pump exists to prevent that.

**EmptyWhileStoring (already a product fold):** clock starts; zero Path-A `apply_event`; keep-alives **playing**; Path-B marks still fire if Occupied; empty ≠ missing. Gap pulses still only if stored PathAGap records exist.

### 3. Answers to the UX asks (yes, named)

- **On the existing ticker SSE envelope the dashboard already consumes: will replay force the paid-live classifier false, and add closed basis + vouched `et_date` + tape-time ET + phase the client can branch on before `feed` interpolation?** **Yes.** Phase closed set is `playing` | `gap` | `ended` | `drop` | `fault`, not only `playing`|`ended`. `playing`|`ended` are the minimum UX named; drop/fault/gap are the standings that keep end ≠ drop ≠ fault ≠ recorded-gap without inventing them from silence. Wire keys: Interface at R4.
- **What vouched ended (and replay-fault) signal prevents the 15s payload-gap watchdog from classifying end-of-tape as live-offline?** **Ended (and fault) as repeated JSON data occupancy on the same path**, plus the client rule in §2.5. Comment heartbeats and stop-publish are **not** that signal.

### 4. Poisons (non-vacuous)

1. Armed envelope with `live: true` **and** session-tape basis still drives paid-live chrome / fills / pulse — suite red (UX’s poison; I accept it as structural).
2. Occupancy implemented only as SSE comments or Axum KeepAlive — counts as no occupancy.
3. Keep-alive implemented as synthetic Trade/Quote `apply_event`.
4. Envelope wall `ts` or client `Date.now()` presented as tape time.
5. End classified by recency age-out or by watchdog silence.
6. Drop or fault mapped to unset-arm live-offline.
7. Stored PathAGap skipped with no vouched gap pulse **and** a required ticker gap chip (chip is not required without a pulse; a pulse without interpolated ticks is required when the record is visited).
8. `StreamEvent` grows a provenance member, or `MarketDataPort` grows `Replay`.
9. Production unset path changes `live` derivation or starts the occupancy pump.

### 5. UX mapping constraint (copy stays UX-owned)

I own types/facts. UX owns strings. Mapping that must remain possible without reading source:

- basis session-tape → never occupy live-session chip meaning, never `Live tape` / `Gamma flip (live)` / live pulse / fills;
- phase `ended` → end-of-captured-day standing; last numbers kept;
- phase `drop` (vouched or inferred per §2.5) → session-tape stream dropped;
- phase `fault` when vouched → replay-fault;
- phase `gap` when vouched → optional gap chrome; **negative**: no live lag / reconnect copy for a recorded Path-A gap (UX self-rev `49ddf5b3…` stands: no **required** gap chip from silence);
- identity `(symbol, et_date)` + tape cursor ET on the chip when vouched; drop tape-time before lying;
- unset arm → today’s live / live-offline bytes.

Exact English remains UX. These facts are the consume surface AC-U3/U4/U6/U7/U9/U27 test against.

## Still split (promote to product only if you cannot settle)

None. Residual choices are implementation bounds inside the mechanism (keep-alive ≤5s vs any period `< 15s`; Interface key spellings). They are not product clocks.

If a later voice asks to infer ended from silence, to keep `live: true` because ticks move, or to print wall now as tape time, that reopens a withdrawn claim — do not promote it as a new product question.
