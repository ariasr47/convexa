# R3 — ux ↔ architect

One exchange. Conflicts `c0a10b7ef5aa2279f81b7d9fa0c20a0efb429e62988778be1c8b1dcf4176c960` (consume-path standing), `096836b6fbe2090bdf2be3217c96aa77d9baaa6fc828b6a9b4d6c3135a2d9dd6` (`live` classifier / recency-true), `cc3e3ef5c3b74de59d5c2bac39561e895475e1e4604ef887afaeb116bf5c811a` (ended ≠ live-offline), plus folded self-rev proposals `bfe7b974…` (consume occupancy), `7fbd4808…` (keep-alive / ended occupancy), `4a47e321…` (gap occupancy) and UX self-rev `49ddf5b3…` (gap chip only if vouched). R1 not rewritten.

Already folded (not reopened): exclusive construct at process start; no `/_ops/replay`; no second live UI path; production-profile plus arm refuses; `MarketDataPort` stays Live|Fixture; `StreamEvent` stamp-only; empty Path-A may walk; coverage cells never on ticker.

Architect ask answered here: playing keep-alive occupancy **does** suppress the Massive watchdog during sleeper waits, including 1× waits longer than 15s, without fabricating ticks. Drop copy is **only** for hub RecvError/lag — never for a still-running sleeper, never for ended, never for a recorded Path-A gap.

UX asks answered by folding architect’s self-rev (not a new socket, not a third port kind): replayed ticker SSE updates keep the paid-live classifier **false** while armed; the existing envelope carries closed consume occupancy the client branches on **before** `live` / `feed` interpolation — stream basis is not paid-live; identity is the armed `(symbol, et_date)`; tape cursor time is the stored stamp (not wall receive); phase is `playing` | `gap` | `ended` | `fault`. I do not name payload keys.

## Converged (exact operator/ticker strings)

**CONVERGED.** Honesty is consume-path, not copy theater. Recency-true is not Massive-live. End-of-tape is not live-offline. Playing keep-alive is not Massive reconnect. I own strings and the client branch. Architect owns occupancy types and how they land on the existing ticker SSE. Internal names (`ReplayHold`, `PathAGap`, `RecvError`, `live_massive`, phase tokens) never print.

**Branch before `liveStatus` / `connectionChip` live-offline.** While stream basis is session tape (armed), the ticker **must not** call shipped `liveStatus` and **must not** take `streamOffline` → `⚠ Live offline — reconnecting…`. `live: false` alone is not enough: that fallthrough is `○ overnight — no live data`, `○ market closed`, or `○ no live ticks` / “feed may be lagging.” S0 (arm unset) keeps those strings byte-identical.

**Gates (S1):** display-active **may** be true (headline / tape tiles / flash-on-change of Path-A values). `isLive` **is false** while armed. Fills, `liveDotPulse`, `widgetLivePulse`, and live-session chip meaning stay off. Keep-alive is non-tick: numbers stay last vouched Path-A values; flash does not fire on occupancy with no print.

### Consume facts the ticker branches on (not a schema)

| Fact | While armed | Must not mean |
|---|---|---|
| Stream basis | session tape (not paid-live) | Massive live; `live_massive`; delayed live; Fixture-as-clock |
| Paid-live classifier | `live: false` on every replayed update, including keep-alive, gap, ended, fault | recency-true; `tick_age < 30s`; wall `ts` |
| Identity | armed `(symbol, et_date)` America/New_York `YYYY-MM-DD` | coverage identity; session-book `present` |
| Tape time | stored stamp, labeled ET | wall receive; `Date.now()`; “now” |
| Phase | `playing` \| `gap` \| `ended` \| `fault` | keep-alive as a fifth phase; `streamOffline` as ended |
| Drop | hub RecvError/lag only | sleeper wait; PathAGap; last occupant; production Massive reconnect |

Keep-alive is **still `playing`**. It is occupancy so the 15s payload watchdog does not fire. It is not a chip, not a pulse, not reconnect.

Ended occupancy is published on the last occupant, then the player stops. The **last envelope the client holds** must still classify `ended`. Heartbeat silence is not the ended classifier. Recency age-out is not the ended classifier.

Gap occupancy is vouched when the cursor passes a stored Path-A gap (non-tick, then sleep to the next stamped trade/quote). That restores the S1 gap chip. Inter-arrival keep-alive is **not** gap.

### S1 chip (same TintChip slot as today’s connection chip)

`dot` is `○` (hollow). `pulse` is **false**. Tone is `neutral` while playing; `warning` + icon for gap / ended / drop / fault. Never success/error direction green/red. Never `●`. If the chip would overflow at 393px, drop tape-time first, then speed, never the words `session tape` or the date. Omit tape-time when it is not vouched (empty Path-A before any stamp). Never substitute wall clock.

`{SYM}` is the ticker-route symbol. `{humanSessionDate}` is existing `humanSessionDate(et_date)` (`Fri Jul 3` for `2026-07-03`). `{HH:MM:SS}` is vouched tape time. `{n}×` only when the armed multiplier is vouched and copy is allowed to print it — never “live speed” / “real-time” / “1× = live”. Whether default 1× prints ` · 1×` is UX↔PM, not this pair.

| Phase | Chip `text` (no leading bullet in the text field) | Tooltip (exact) |
|---|---|---|
| playing (including keep-alive) | `session tape · {SYM} · {humanSessionDate} · tape {HH:MM:SS} ET` + optional ` · {n}×` | `Session day tape for {SYM} on {ET_DATE}. Research playback — not a live vendor feed, not live Massive. Headline and tape tiles follow stored Path-A ticks at tape time when present. Structure below is the snapshot path, not this tape’s live claim.` |
| gap (vouched Path-A gap occupancy only) | `session tape gap · {SYM} · {humanSessionDate}` | `A gap is recorded on this session day tape. This is not a live feed lag, and it is not reconnecting to Massive.` |
| ended | `session tape ended · {SYM} · {humanSessionDate}` | `This session day tape has no further Path-A ticks. Not live. Not reconnecting.` |
| drop (RecvError/lag only) | `⚠ Session tape stream dropped` | `The ticker stream dropped while session tape was playing. Structure levels stay as of the last snapshot. This is not live Massive reconnecting.` |
| fault | `⚠ Session tape playback fault` | `Session tape playback faulted. Last tape numbers may remain. This is not live Massive reconnecting.` |
| S0 arm unset | today’s `liveStatus` / `⚠ Live offline — reconnecting…` | today’s `Streaming live ${feed} ticks.` / `OFFLINE_CHIP_TOOLTIP` |

Visible playing/ended/gap strings include the hollow `○` via `dot`. Tests may match `○ session tape ended · {SYM} · {humanSessionDate}` as the operator-visible ended line.

### LiveTape widget + last trade (S1)

| Slot | S1 while armed | Banned while armed |
|---|---|---|
| title | `Session tape` | `Live tape` |
| subtitle (playing / keep-alive / gap) | `Session day tape · {SYM} · {humanSessionDate} · not a live feed` | `Live stream · not the structure snapshot below`; `Stream offline · last known ticks · structure levels stay current` |
| subtitle (ended) | `Session tape ended · last tape ticks · structure levels stay snapshot` | live-offline subtitle; overnight / market-closed chip copy in this slot |
| ⓘ | `Reads off the stored session day tape (Path-A trades and quotes). Not a live vendor feed. Structure tiles below stay snapshot reads; they are not this tape claiming live greeks.` | `Live-derived reads off the trade tape + quote stream…` |
| Gamma flip label | `Gamma flip` | `Gamma flip (live)` |
| Widget `live` / pulse | false | `widgetLivePulse` |
| Tile caption | none of the live-offline captions | `⏸ offline` |
| Last trade + print | `○ Last trade ${X}` (hollow; not `info.main` `●`) | `● Last trade ${X}` |
| Last trade + no print | `Last trade — no tape print at this tape time` | `Last trade — no recent print` as a live-empty claim; fabricated `$0` |
| Last trade ended | `○ Last trade ${X}` if a print was kept; else the no-print literal | `⏸ Last trade ${X}` |
| Last-trade tooltip | `The last stored trade print on this session day tape. Research readout only — not a live vendor feed. The headline follows the tape mid when session tape is playing; walls / gamma flip / max pain stay on the structure snapshot, not on this print.` | `LAST_TRADE_TOOLTIP` |

Keep-alive uses the **playing** row of both tables. Tiles do not dim. No reconnect copy. No live pulse.

Drop may dim tape numbers; it still must not caption `⏸ offline` and must not use `OFFLINE_CHIP_TOOLTIP`. Positions `⚠ Live marks paused — …` is a live-offline string — do not reuse it for ended, keep-alive, gap, drop, or fault.

### Banned live interpolations (S1 — `test`, not exact-English review)

While armed, visible ticker copy, tooltips, titles, labels, captions, pulses, and fill gates **must not** occupy these shipped live-session strings (or interpolate `feed` / recency into them):

- `● live · ${session}` / `● live ·`
- `Streaming live ${feed} ticks.`
- `Live tape`
- `Gamma flip (live)`
- `⚠ Live offline — reconnecting…`
- `OFFLINE_CHIP_TOOLTIP` (“Reconnecting automatically”)
- `○ overnight — no live data`
- `○ market closed` (as this arm’s standing)
- `○ no live ticks` / “the feed may be lagging”
- `LIVE_TAPE_SUBTITLE_LIVE` / `LIVE_TAPE_SUBTITLE_OFFLINE`
- `⏸ offline` / `⏸ Last trade`
- `liveDotPulse` / `widgetLivePulse`
- `evaluateOrder` fills / live-cross / mark live arm (`isLive` true)
- `this quote is live`
- `live_massive` / `LiveMassive` / `LIVE` as a feed badge
- `Live streaming is at capacity. Try again shortly.` as a tape miss or ended standing
- coverage cells `present` \| `missing` \| `unreadable` \| `not yet due` \| `blocked occupancy`

Negation in approved S1 tooltips (`not a live vendor feed`, `not live Massive`, `Not live. Not reconnecting.`) is **not** occupying the live-session classifier. That English is allowed. The gate for architect is: do not set `live: true`; do not let recency or `feed` reach those interpolations; do not let watchdog silence paint Massive reconnect.

Poison (`test`): a fixture with `live: true` **and** session-tape basis that still paints any row above. Client must still refuse live chrome when basis is session tape even if `live` is wrongly true.

### Keep-alive ≠ drop ≠ ended ≠ gap ≠ fault

| Occupancy | Chip | Watchdog | Ticks |
|---|---|---|---|
| Sleeper still running (keep-alive, including 1× wait > 15s) | playing | suppressed; **not** drop | none fabricated |
| Recorded Path-A gap | gap | suppressed by gap occupancy | none interpolated |
| Last stored occupant | ended, then stop; no loop | must **not** become live-offline | no further Path-A |
| Hub RecvError / lag | `⚠ Session tape stream dropped` | this **is** drop | last tape numbers may remain |
| Clock / tape-read fault | `⚠ Session tape playback fault` | not live-offline, not ended | last tape numbers may remain |
| Arm unset, vendor down | today’s `⚠ Live offline — reconnecting…` | today’s Massive reconnect | S0 only |

Last Path-B / structure snapshot may remain behind ended / drop / fault. FreshnessLine stays `Structure as-of …`. Path-B does not retitle structure widgets live.

### States this copy satisfies

| State | User sees | Must not happen |
|---|---|---|
| default (playing, incl. keep-alive) | playing chip + `Session tape` widget; numbers may move; `isLive` false | `● live`; pulses; fills; live-offline |
| stale (vouched gap) | gap chip; last tape values kept | live lag tip; keep-alive labeled gap; reconnect |
| end-of-tape | ended chip + ended subtitle; last numbers kept | `⚠ Live offline — reconnecting…`; overnight-no-live-data; blanked tape; loop |
| offline (SSE drop while armed) | `⚠ Session tape stream dropped` | Massive reconnect tooltip; `⏸` live-offline caption |
| error (replay-fault) | `⚠ Session tape playback fault` | desk 5xx; capacity copy; live-offline |
| empty Path-A (clock running) | playing chip; `Last trade — no tape print at this tape time` | refuse-as-missing; fabricated prints; live-empty `no recent print` as Massive |
| default (arm unset) | today’s live classifier | any session-tape chrome |

## Still split

None on consume occupancy, the `live` classifier, ended vs live-offline, keep-alive vs Massive reconnect, or vouched gap occupancy.

If the existing ticker SSE envelope cannot carry the consume facts above, that is a contract defect — I will not accept process occupancy the page cannot read. I do not pick JSON keys. 1× chip suffix and net-flow window wording stay UX↔PM.
)
