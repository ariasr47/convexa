# R1 — ux position: day-replay-mock-adapter

## Position

### 0. What the surface actually is (and what it is not)

Play a **captured session day** for a locked-watchlist `(symbol, et_date)` on the **same ticker live path** the desk already uses. The walk surface is the existing Ticker page (`/ticker/:symbol`) consuming the existing SSE contract (`GET /api/stream/{ticker}` → `LiveUpdate` into `liveTapeStore` → CommandDeck connection chip, LastTradeReadout, LiveTape tiles, TapePulseStrip). This feature does **not** add a second live UI path, a Replay app, a research-lab canvas, a tape browser, or a coverage matrix.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` is **Status: SET** (The Curvature Terminal). Adhere. Do **not** invent a second system. Do **not** restate the token table in SPEC §4. I request **no amendment** for new tokens, new motion, a scrubber, or a parallel Replay chrome language. Replay states are **copy + existing TintChip / StatTile / Alert / operator AppBar**. Anyone proposing a video-editor timeline, a fourth convex arc, a new keyframe family, or a green “healthy replay” chip is re-scoping — raise as an R2 `product` conflict after this round; do not fold it in.

**This is not `NO_UI_CHANGE`.** Capture (`session-day-tape-capture`) was store-only and correctly silent on the trader product. Playback is the reason this slice exists. The trader-visible change is **honest not-live copy/states on the existing ticker surface** while a replay arm is playing. Production serve **without** an explicit replay arm still looks like today — including every current `live` chip, `Live tape` title, and `⚠ Live offline — reconnecting…` string.

**This is not session-archive coverage.** Cells `present` | `missing` | `unreadable` | `not yet due` | `blocked occupancy` stay on the coverage vehicle. They do **not** appear on Ticker, on the operator start/stop surface, or on replay CLI. A played Tuesday tape does **not** fill a coverage hole and is **not** a `present` live-paid book (`present-is-live-paid-only`).

**This is not a session-book load** (`RESEARCH READ — SESSION BOOK`) and **not** a 48/14d ring read. Fixture is a frozen `VendorBundle` at `as_of` — **not a clock**. Do not label replay “fixture”, “hist-chain”, “S3”, or `live_massive`.

**This is not indistinguishable live.** If Architect hides replay as Massive — `live: true`, `feed` interpolated into `Streaming live ${feed} ticks.`, `● live · open · $mid`, `liveDotPulse`, order fills off replayed mids — that is this council’s **defining failure**. Copy that reuses the live-session chip meaning is a fabricated market claim. I will not soften that.

Pages trader origin still **404s** `/api/_research` and `/api/_metrics` (`functions/api/[[path]].ts`, verified). Operator tape list/load stays behind that fence. The ticker SSE remains the trader-visible path; it must not become a tape dump, and it must not proxy `_research` to `*.pages.dev`.

The user-facing surface I own is four coupled artifacts plus hard negative space:

| # | Surface | Who reads it | My ownership |
|---|---------|--------------|--------------|
| S0 | **Production ticker (replay unset)** — CommandDeck / LiveTape / LastTrade / positions marks / orders on `/ticker/:symbol` | every trader | **byte-identical to today.** No replay chip, no session-tape title, no operator Start on the deck. Existing `● live · …` / `Live tape` / `⚠ Live offline — reconnecting…` remain. |
| S1 | **Ticker while replay is playing / gapped / ended** — same route, same SSE consumer | operator walking Tuesday; anyone on that process’s ticker | connection chip, widget title/subtitle/ⓘ, last-trade four-state rewrite, flash/pulse gates, end-of-tape ≠ live-offline, fill/mark `isLive` stays false |
| S2 | **Operator start/stop** — unlinked `/_ops/replay` (existing operator chrome) **plus** CLI twin if Architect adds clap | research operator / owner | Start / Stop, closed symbol+date, honest miss literals, no coverage cells, no `_research` via Pages |
| S3 | **Negative space** — Landing, Scanner, Settings, Ask-AI, shell nav, `/_ops/metrics`, coverage/session-book/ring vehicles, Positions “Live” tab | everyone else | no Replay app; no coverage `present`; no metrics stage named replay; no Ask-AI “this quote is live”; Pages 404 `_research` |

`/_ops/metrics` stays **read-only latency**. Start/stop is a side-effect; it does **not** nest on that page (the metrics surface is side-effect-free by canon). `/_ops/replay` is a **second unlinked operator route**, same chrome family as metrics (own AppBar, off `AppShell`, not in TopNav). It is **not** a Replay app: no tape corpus browser, no Path-A JSON dump, no coverage matrix, no lab demos. Three controls + honest status. If PM/Architect lock **CLI-only** start/stop, S2 visual may drop — ticker honesty (S0/S1) does not.

Verified at source (not assumed):

- Connection chip is a **status indicator, not a toggle** (`TickerHeader.tsx` `connectionChip` / `liveStatus`). Genuine live label is `` `● live · ${session} · $${mid}` `` with tip `` `Streaming live ${live.feed} ticks.` ``. Offline supersedes: `⚠ Live offline — reconnecting…` / `OFFLINE_CHIP_TOOLTIP`.
- `isLive = (live?.live ?? false) && !streamOffline` (`liveTapeStore.ts`). That boolean currently gates headline mid, value flash, `liveDotPulse`, `widgetLivePulse` (`Widget.tsx` `live` prop), LastTrade `●`, LiveTape subtitle, **and** order-engine fills (`orders/engine.ts`: `if (!tick.isLive || tick.streamOffline) return null`).
- LiveTape title is the string **`Live tape`**. Subtitles: `LIVE_TAPE_SUBTITLE_LIVE` = `Live stream · not the structure snapshot below`; offline = `Stream offline · last known ticks · structure levels stay current`. Gamma flip label becomes **`Gamma flip (live)`** when `isLive`.
- SSE watchdog is 15s (`STREAM_OFFLINE_MS`). Structure freshness is REST-only (`FreshnessLine` / `structureAsOfPhrase`) — keep it that way.
- Capacity refuse copy (unchanged, not ours to rewrite on the trader 503): `Live streaming is at capacity. Try again shortly.`
- Session-day-tape occupancy literals are **already closed** on the store vehicle. Replay miss copy **reuses** them. It does not invent a second deck.

### 1. Intended user, primary job, information structure, vocabulary

- **Intended user (walk):** the research operator / owner sitting on `/ticker/SPY` (or QQQ / IWM) after Massive is cancelled, walking a stored Tuesday as a clock. **Not** a parallel trader product. Anonymous production traders on Pages must **not** receive this arm.
- **Intended user (start/stop):** the same operator on CLI and/or unlinked `/_ops/replay`, token-gated like other operator surfaces. **Not** the signed-in trader on CommandDeck.
- **Primary job:** *Start one locked `(symbol, et_date)` that has a stored Path-A tape; watch that ticker’s existing tape row and headline move at tape time (or a locked multiplier); never be told this is live Massive; stop and have production-today look return; if there is no tape, be told the existing honest miss — not shown a fabricated day.*
- **Failure I am designing against:** a replayed tick that reuses the live-session chip meaning (`● live`, `Streaming live…`, `Live tape`, `Gamma flip (live)`, `this quote is live`, `live_massive`), or an end-of-tape that says `⚠ Live offline — reconnecting…`, or a missing tape that still plays zeros, or production-without-replay looking different from today, or a limit order filling because `isLive` stayed true.

**Information structure**

S1 (ticker, replay active) — **one chip in the existing status row**, never a second dashboard:

1. Regime chip unchanged (static signals).
2. **Connection chip replaced** by the replay chip (same TintChip slot; offline-during-replay has its own string, never the live-offline string).
3. Headline still `TICKER · $price` — price **may move** from replayed mid (display gate), but the chip/tooltip name the basis as session day tape.
4. Meta: last-trade readout in replay states + FreshnessLine still **`Structure as-of …`** (Path-B / REST; never “live as-of”).
5. LiveTape widget: title/subtitle/ⓘ swap to session-tape copy; tiles still show mid-derived tape fields; VWAP stays static (no offline, no live claim).
6. Static board (GEX, four metrics, dealer flow, IV rank, market context) stays snapshot language. Path-B marks refresh structure; they do **not** retitle those widgets as live.

S2 (operator start/stop), always in this order:

1. Standing / framing block **first**.
2. Closed identity: symbol (SPY / QQQ / IWM) · `et_date` America/New_York.
3. Optional locked speed, **only if** PM/Architect lock a closed set — printed as `{n}×`, never “real-time” / “live speed”.
4. Primary actions: **Start session tape** · **Stop**.
5. Status: playing / starting / ended / stopped / honest miss (closed literals).
6. Closing: not a live vendor feed; authorizes nothing on the score formula; not coverage `present`.

Do **not** lead S2 with a tick dump. Do **not** show coverage cells. Do **not** offer a scrubber.

**User vocabulary — closed term set.**

| Concept | Approved term / exact string | **Banned** (asserts a meaning the data cannot carry) |
|---|---|---|
| What is playing | **session tape** · **session day tape** · identity **`(symbol, et_date)`** | “live tape” as this arm’s title, “LIVE”, “live_massive”, “hist-chain”, “S3 tape”, “fixture clock”, “mock live”, “as if live” |
| Genuine Massive stream (S0 only) | existing **live** chip / **Live tape** widget — **only when replay unset** | using those strings while replay is playing; calling replay `live` because ticks move |
| SSE display gate (ticks moving) | **session tape playing** (UI). Implementation may split `isLive` from a display-active flag — I own that **fills and live-meaning stay off** | keeping `isLive === true` because “the clock is running” |
| Path-A events on the ticker | **session tape ticks** · last trade / mid / spread / net flow as today’s tile names | “this quote is live”; “live trade tape”; OPRA; “NBBO live” |
| Path-B on the ticker | **structure snapshot** · existing **Structure as-of** | “live greeks”; “live flip” label; coverage `present`; “session book” |
| Replay clock | **tape time** + `ET` when a vouched tape-time field exists | wall clock as market time; “now”; “real-time” as a live claim |
| Speed (only if locked) | **`{n}×`** | “live speed”, “realtime”, “1× = live” |
| Operator start | **Start session tape** | “Go live”, “Start live”, “Connect Massive”, “Play live” |
| Operator stop | **Stop** | “Disconnect live”, “Kill feed” as if Massive |
| Miss: no identity | **`no session day tape for {SYMBOL} on {ET_DATE}`** | coverage `missing`; fabricated silent day; trader `—` as the miss class |
| Miss: Path-A zero | **`no path-a ticks for {SYMBOL} on {ET_DATE}`** — **cannot start the walk** | playing a flat live-looking tape; `not-storing` |
| Path-B zero (Path-A present) | **`no path-b snapshots for {SYMBOL} on {ET_DATE}`** — warn; Path-A walk **may** start | refusing the walk by renaming this as no tape; fabricating 5-minute structure |
| Store off | **`session day tape not storing`** | all-missing coverage; ticker error 5xx |
| Unreadable | **`session day tape unreadable: {reason}`** | treating as no-ticks |
| Not in watchlist | **`not in tape watchlist: {SYMBOL}`** | starting NVDA as if captured |
| Weekend / not elapsed | shipped tape literals **`session day tape ineligible weekend: …`** / **`session day tape not elapsed: …`** | coverage `not yet due`; “market closed” as the miss class unless `market_session` is the genuine live classifier on S0 |
| End of tape | **`○ session tape ended`** | `⚠ Live offline — reconnecting…`; `⏸ offline` as the only caption |
| Replay SSE drop | **`⚠ Session tape stream dropped`** + warning icon | live-offline tooltip (“Reconnecting automatically” to Massive) |
| Path-A gap during play | **`○ session tape gap`** | “feed lagging” live tip; silent skip |
| Production default | **looks like today** | a permanent “replay mode” chrome when the arm is unset |
| Coverage occupancy | **not this surface** | `present` / `missing` / `not yet due` / `blocked occupancy` on S1/S2 |
| Provenance | **research tape · never live_massive · never coverage present** | `live_massive`; `LiveMassive`; `LIVE` as a feed badge |
| License | **Our research · not a live vendor feed.** | redistributing ticks as Massive; “customer live API” |
| Score | existing score/tier copy; **Authorizes: nothing** on the formula | “replay score”, “backtest grade”, “live score” as a new badge |
| Orders / marks | existing **SIMULATED**; fills still require genuine live | filling on replayed mids; “live cross” during session tape |
| Operator auth | shipped **`metrics_unauthorized`** | trader-session as the operator gate |
| Pages | existing **404 `Not Found`** on `_research` / `_metrics` | proxying tape start through `*.pages.dev` |

**Hard ban — live-session chip meaning on replayed ticks.** The live chip is a **paid-stream classifier** (`liveStatus` when `live.live` and not `streamOffline`). Replay **must not** occupy that meaning. Hollow `○`, no `liveDotPulse`, no `widgetLivePulse`, no `● live`.

**Hard ban — `live` / `LIVE` / `live_massive` / “this quote is live”** on S1/S2 copy, tooltips, `feed` interpolation, operator standing block, CLI, and provenance. S0 (replay unset) **keeps** today’s live words. That split is the product.

**Hard ban — end-of-tape as live-offline.** `OFFLINE_CHIP_TOOLTIP` promises automatic reconnect of the **live** stream and that structure stays current. Tape exhaustion is not a transport gap to Massive.

**Hard ban — silent rename of absences.** no session day tape ≠ no path-a ticks ≠ no path-b snapshots ≠ not storing ≠ unreadable ≠ not in watchlist ≠ ineligible weekend ≠ not elapsed ≠ coverage missing ≠ live capacity 503. Playing any of those as a day is `[absent-is-not-none]`.

**Hard ban — coverage cells on this surface.** `present` is a loadable `LiveMassive` book. Replay never prints it.

**Hard ban — parallel Replay app.** No `/replay`, no lab route as the walk surface, no CommandDeck “Replay” tab, no Settings toggle for traders.

**Hard ban — scrubber / completeness percent.** Play-forward (and Stop). `{k} snapshots` is a store fact, not a ticker health score.

### 2. Binding framing

**(a) Operator standing block (S2 + CLI), first, including miss / error:**

```
SESSION TAPE — RESEARCH PLAYBACK · NOT A LIVE VENDOR FEED
  Identity:    {SYMBOL} · {ET_DATE} America/New_York
  Source:      session day tape · Path-A ticks · Path-B 5-minute structure when present
  Provenance:  research tape · never live_massive · never coverage present
  Clock:       tape time ET{ · {n}× if a locked multiplier is on}
  Vendor I/O:  0 Massive calls on this playback
  Authorizes:  nothing on the score formula. Not a live paid session book.
               Not coverage present. Not redistributed as a live vendor feed.
```

**(b) Ticker chip (S1) — exact strings, same TintChip slot as today’s connection chip:**

| Replay phase | Chip `text` (no leading bullet in the text field; `dot` separate) | `dot` | `tone` | `pulse` |
|---|---|---|---|---|
| playing | `session tape · {SYM} · {humanSessionDate(et_date)} · tape {HH:MM:SS} ET` + optional ` · {n}×` | `○` | `neutral` | **false** |
| Path-A gap | `session tape gap · {SYM} · {humanSessionDate(et_date)}` | `○` | `warning` | false |
| ended | `session tape ended · {SYM} · {humanSessionDate(et_date)}` | `○` | `warning` | false |
| SSE dropped during replay | `⚠ Session tape stream dropped` | (none — warning pattern + icon) | `warning` | false |
| S0 replay unset | **today’s** `liveStatus` / live-offline strings, unchanged | today’s `●` / `○` | today’s | today’s live-only pulse |

Date on the chip uses existing `humanSessionDate` (`copy.ts`) — do not invent a second formatter.

If the chip would overflow at 393px, **drop tape-time first**, then speed, never the words `session tape` or the date. Type floor ≥11px holds.

**(c) Ticker chip tooltips (exact):**

| Phase | Tooltip |
|---|---|
| playing | `Session day tape for {SYM} on {ET_DATE}. Research playback — not a live vendor feed, not live Massive. Headline and tape tiles follow stored Path-A ticks at tape time. Structure below is the snapshot path, not this tape’s live claim.` |
| Path-A gap | `A gap is recorded on this session day tape. This is not a live feed lag, and it is not reconnecting to Massive.` |
| ended | `This session day tape has no further Path-A ticks. Not live. Not reconnecting.` |
| SSE dropped during replay | `The ticker stream dropped while session tape was playing. Structure levels stay as of the last snapshot. This is not live Massive reconnecting.` |
| S0 live (unchanged) | `Streaming live ${live.feed} ticks.` |
| S0 live-offline (unchanged) | `OFFLINE_CHIP_TOOLTIP` as shipped |

**(d) LiveTape widget (S1 vs S0):**

| Slot | S0 replay unset (today) | S1 replay playing |
|---|---|---|
| title | `Live tape` | `Session tape` |
| subtitle | `Live stream · not the structure snapshot below` | `Session day tape · {SYM} · {humanSessionDate(et_date)} · not a live feed` |
| ⓘ | `Live-derived reads off the trade tape + quote stream. These pause on a stream drop; the levels below stay current.` | `Reads off the stored session day tape (Path-A trades and quotes). Not a live vendor feed. Structure tiles below stay snapshot reads; they are not this tape claiming live greeks.` |
| Net flow ⓘ | shipped “from the **live** trade tape…” | `Aggressive buys minus sells over the tape’s last few minutes, from stored Path-A trades. Not a live vendor feed. Positive = buyers lifting the ask; negative = sellers hitting the bid.` |
| Gamma flip label | `Gamma flip (live)` when `isLive` | `Gamma flip` — **never** `(live)` |
| VWAP | unchanged static | unchanged static (still no offline, still not live) |
| ended subtitle | n/a | `Session tape ended · last tape ticks · structure levels stay snapshot` |
| S0 offline subtitle | `Stream offline · last known ticks · structure levels stay current` | **must not fire** for end-of-tape |

**(e) Last trade (S1). Today’s four states remain on S0. Replay replaces the live-looking ones:**

| State | Copy |
|---|---|
| replay + print | `○ Last trade ${X}` (hollow; **no** `●`; no live info.main bullet) |
| replay + no print | `Last trade — no tape print at this tape time` |
| replay ended, last print kept | `○ Last trade ${X}` + chip already says ended; **not** `⏸ Last trade` |
| replay SSE dropped | dim allowed; prefix **not** `⏸` if that caption is reserved for live-offline tiles — use the chip for the warning; last-trade stays the last tape print or the no-print literal |
| S0 | shipped `● Last trade $X` / `Last trade — no recent print` / `⏸ Last trade $X` / skeleton |

Last-trade tooltip during replay (replaces `LAST_TRADE_TOOLTIP`):

`The last stored trade print on this session day tape. Research readout only — not a live vendor feed. The headline follows the tape mid when session tape is playing; walls / gamma flip / max pain stay on the structure snapshot, not on this print.`

S0 keeps `LAST_TRADE_TOOLTIP` byte-identical.

**(f) Operator miss / status copy (S2 + CLI) — reuse capture literals; never synonyms:**

| Situation | Exact line |
|---|---|
| Start in flight | `Starting session tape…` (not “Connecting live…”) |
| Playing | `Playing session tape · {SYMBOL} · {ET_DATE}` |
| Stopped | `Stopped · ticker is not on session tape` |
| Ended | `session tape ended · {SYMBOL} on {ET_DATE}` |
| No identity | `no session day tape for {SYMBOL} on {ET_DATE}` |
| Path-A empty | `no path-a ticks for {SYMBOL} on {ET_DATE}` · Start **refused** |
| Path-B empty, Path-A present | `no path-b snapshots for {SYMBOL} on {ET_DATE}` · Start **allowed**; this line remains visible |
| Not storing | `session day tape not storing` |
| Unreadable | `session day tape unreadable: {reason}` |
| Not in watchlist | `not in tape watchlist: {SYMBOL}` |
| Weekend | `session day tape ineligible weekend: {SYMBOL} on {ET_DATE}` |
| Not elapsed | `session day tape not elapsed: {SYMBOL} on {ET_DATE}` |
| Unauthorized | shipped `metrics_unauthorized` |
| Replay fault must not 5xx the desk live path | ticker S0/S1 degrades honestly; no trader 5xx toast that names internals |

CLI twin (if clap exists). Stdout title grep-able as `session-day-replay` (not `serve`, not `session-day-tape` list/load, not `archive-coverage`):

| Verdict | Exact line |
|---|---|
| Running | `[RUNNING] session-day-replay — no verdict yet` |
| Playing | `[RUNNING] session-day-replay — {SYMBOL} {ET_DATE} · session day tape · not a live feed` |
| Stopped | `[OK] session-day-replay — stopped · not live Massive` |
| Ended | `[OK] session-day-replay — session tape ended · {SYMBOL} on {ET_DATE}` |
| Honest miss | `[OK]` or `[ERROR]` matching capture’s store-level vs empty-identity split: empty identity is **not** a coverage `[FAIL]`; not-storing / unreadable stay errors |
| Banned | `[PASS] n/n present`, `LIVE`, `live_massive`, “verified live”, “Massive replay” |

**(g) Is / is not on every S2 success print:**

- **Is:** research playback of a stored session day tape through the existing ticker SSE path.
- **Is not:** live Massive; not `live_massive`; not a live paid session book; not coverage `present`; not Fixture-as-clock; not OPRA; not S3 hist-chain; not a score-formula change; not a second live UI.

### 3. Fields the UI consumes (not a payload schema)

I do **not** own endpoint signatures. The ticker already consumes `LiveUpdate`: `ticker`, `mid`, `bid`, `ask`, `spread`, `net_flow`, `flow_window_s`, `last_trade`, `gamma_flip`, `live`, `market_session`, `feed`, `tick_age_s`, `ts`, `spot_ts`.

Replay **additionally** requires the UI to observe, without renaming:

| UI need | Consumed fact | Must not mean |
|---|---|---|
| Discriminator | a **closed stream basis** the client can branch on **before** `live` / `feed` interpolation | `live: true`; `feed: live_massive`; hiding replay as delayed Massive |
| Identity | `symbol` + `et_date` (America/New_York `YYYY-MM-DD`) | coverage identity; session-book `present` |
| Tape clock | vouched **tape time ET** for the chip (display string or clock the FE does not have to invent from `Date.now()`) | wall clock as session time |
| Speed | locked `{n}` only if product locked a multiplier | inventing a slider |
| Phase | closed `playing` \| `gap` \| `ended` (plus operator-only miss classes **before** the ticker enters S1) | `streamOffline` as the only ended signal |
| Path-B | existing structure snapshot fields on the bundle path; freshness remains **Structure as-of** | SSE ticks labeled live greeks |

**Split gates (binding on S1):**

| Gate | True when | Drives |
|---|---|---|
| **Display-active** | session tape playing and SSE delivering tape ticks | headline may use tape `mid`; LiveTape numbers; flash-on-change as a **data signal** (existing `useFlashOnChange`, no new keyframe) |
| **`isLive` (genuine)** | Massive live classifier · replay unset · not `streamOffline` | `● live` chip, `Live tape` title, `Gamma flip (live)`, `liveDotPulse`, `widgetLivePulse`, `LAST_TRADE_TOOLTIP`, **order fills**, mark-ladder live arm |

Replay ⇒ display-active **may** be true; `isLive` **is false**. If Architect sets `live: true` on replayed events, the shipped client **will** pulse, title Live tape, and fill limits. That is not a frontend choice — it is a contract defect. I will contest it in R2.

`feed` must **never** be interpolated into `Streaming live ${feed} ticks.` while the discriminator says session tape — even if Architect puts a benign string in `feed`.

### 4. Component states (complete matrix)

Baseline set plus BRIEF-required **end-of-tape**. Two surfaces.

#### S0 / S1 — Ticker (`/ticker/:symbol`)

| State | User sees | Can do next | Must not happen |
|---|---|---|---|
| **default (replay unset)** | Today’s ticker: `● live · …` or session classifier; widget **Live tape**; fills allowed only when genuinely live | trade as today | any session-tape chrome; any coverage cell |
| **loading (cold bundle)** | existing skeleton-first; last-trade skeleton | wait / Retry on cold error | replay chip before discriminator says playing; skeleton after success |
| **loading (operator starting)** | S0 ticker **until** playing is vouched; operator button busy `Starting session tape…` | wait / Stop on operator surface | “Connecting live…”; flashing live pulse on a still-Massive stream as if the day already started |
| **default (replay playing)** | S1 chip + Session tape widget + moving tape tiles; structure snapshot language; **no** live pulse | watch the day; Stop on S2 | `● live`; `Live tape`; `Gamma flip (live)`; fills; `live_massive` |
| **empty (cannot start — no identity)** | S0 ticker unchanged; S2 shows `no session day tape for {SYMBOL} on {ET_DATE}` | pick another date / symbol | fabricated ticks; coverage `missing` |
| **empty (Path-A zero)** | S0 unchanged; S2 `no path-a ticks…`; Start refused | inspect store; do not walk | a flat “live” day of zeros |
| **empty (Path-B zero, Path-A present)** | S1 Path-A walk; structure stays last snapshot; S2 keeps `no path-b snapshots…` | walk Path-A | fake 5-minute structure; “live greeks” |
| **stale (structure)** | FreshnessLine `Structure as-of …`; existing `Couldn't refresh — showing data from {humanAge} ago.` on REST poll fail | wait auto-retry | calling structure live; blanking GEX |
| **stale (tape gap)** | chip `session tape gap`; last tape values kept, dim **only** if we also dim live tiles today for pause — prefer **no** `⏸ offline` caption (that string is live-offline) | wait for next stored tick | live-offline tooltip |
| **offline (SSE drop during replay)** | `⚠ Session tape stream dropped` + warning icon; tape tiles may dim; structure remains | Stay; operator Stop; do not “refresh Massive” | `⚠ Live offline — reconnecting…`; `OFFLINE_CHIP_TOOLTIP` |
| **offline (SSE drop, replay unset)** | **today’s** `⚠ Live offline — reconnecting…` + `⏸ offline` on live tiles | nothing — auto reconnect copy as shipped | session-tape strings |
| **error (cold bundle)** | shipped red Alert + Retry | Retry | replay blamed; 5xx from replay fault on this path (`best-effort-isolated-or-null`) |
| **error (replay fault)** | S1 honest drop/ended/gap **or** return to S0; no desk 5xx | Stop | trader toast of filesystem paths; capacity copy `Live streaming is at capacity…` used as a tape miss |
| **end-of-tape** | chip `○ session tape ended · …`; widget subtitle ended; last tape numbers **kept**, not blanked; no pulse; fills still impossible | Stop (returns S0) or leave | `Live offline — reconnecting`; wiping structure; treating ended as `live: false` overnight classifier (`○ overnight — no live data`) |
| **success (Stop)** | S0 restored: today’s live classifier if the production arm is live; replay chip gone | use ticker as today | lingering `○ session tape` on a live process; lingering tape mid labeled `● live` |

Positions / orders on the ticker page: replay **never** satisfies `isLive` for `evaluateOrder` / mark live arm. Existing `⚠ Live marks paused — …` is a **positions live-offline** string — do **not** reuse it for end-of-tape. If the operator is on ticker with the book open, P/L must not mark off replayed mids as live. Scanner remains poll-based; the word **live** stays forbidden there as today.

#### S2 — Operator start/stop (`/_ops/replay` + CLI)

| State | User sees | Can do next | Must not happen |
|---|---|---|---|
| **default** | standing block; closed symbol select SPY/QQQ/IWM; date; Start idle; Stop idle/disabled if nothing playing | set identity | coverage matrix; metrics tables; trader nav link |
| **loading** | `Starting session tape…`; Start non-repeatable until resolve | wait | “Fetching Massive”; invented completeness % |
| **playing** | `Playing session tape · {SYMBOL} · {ET_DATE}`; Stop enabled | Stop; open `/ticker/{SYM}` (same SSE, S1 copy) | “LIVE”; `present` |
| **empty / miss** | exact capture literal; Start remains refused until identity changes | change date/symbol | ticker enters S1 |
| **error (unreadable / not storing / unauthorized)** | exact literal / `metrics_unauthorized`; dump withheld | fix store / token | empty-as-success; Pages proxy |
| **end-of-tape** | `session tape ended · …`; Stop still clears S1 chrome | Stop / start another day | auto-restart as live |
| **success (Stop)** | `Stopped · ticker is not on session tape` | Start another | “reconnected to live” unless production arm actually is |

CLI-only lock: same literals, no dashboard S2. S1 still required.

### 5. Where each datum surfaces

| Datum | Surfaces | Does not surface |
|---|---|---|
| Path-A trade/quote-derived mid, spread, net flow, last trade | S1 LiveTape tiles + headline + last-trade | Scanner; coverage; `/_ops/metrics`; Ask-AI as “live” |
| Path-B 5-minute structure | existing structure widgets + FreshnessLine | LiveTape title; live chip; coverage `present` |
| `et_date` / symbol of the tape | S1 chip + S2 standing | session-archive coverage cells |
| Tape time ET | S1 chip (drop first at 393px) | FreshnessLine (that is structure) |
| Speed `{n}×` | S1 chip + S2 if locked | “live speed” |
| Score / tier / fingerprint | existing ticker reads; formula unchanged | “replay score” badge |
| Coverage `present`/`missing` | **coverage vehicle only** | S0 S1 S2 |
| Tape list/load JSON | operator `_research` (Pages **404**) | trader `@convexa/api` walk path |
| Massive live classifier | S0 chip only | S1 |

### 6. Glossary

**Trader-visible (S1 tooltips / ⓘ only while replay playing):**

| Term | Sentence |
|---|---|
| session tape | Stored research day for one locked symbol on one America/New_York date, playing through this ticker’s existing stream. Not a live vendor feed. |
| tape time | The timestamp on the stored tick, America/New_York. Not wall-clock “now”. |
| live | **Not used on this chip while session tape is playing.** Live is the genuine Massive stream when replay is unset. |
| structure | The snapshot options book / GEX path. It is not this tape claiming live greeks. |
| present | **Not a ticker word.** On coverage, a loadable live paid session book. |

**Operator (S2 / CLI) — add to capture glossary, do not replace it:**

| Term | Sentence |
|---|---|
| session tape playback | Playing a stored session day tape on the existing ticker stream. Inspect-on-ticker, not a new live product. |
| Start session tape | Arm playback for one `(symbol, et_date)` that has Path-A ticks. Refuses honest misses. |
| session tape ended | No further Path-A ticks on that tape. Not live offline. |
| live_massive | **Not a playback provenance token.** Session-book paid-live source only. |
| present | **Not a playback word.** Coverage live-paid occupancy only. |

### 7. Design-system / interaction / a11y

Canon Status **SET**. Bind `extrasFor` / palette slots / `elevationFor` e1–e2. No hardcoded hex. Chip text ≥11px. Warning states (`session tape ended`, stream dropped, miss on S2) use **`warning.*` + icon always** — never brand amber alone. Green/red remain **direction** (net flow sign, P/L), never “replay health”.

Motion: **no new keyframes.** `liveDotPulse` / `widgetLivePulse` stay **genuine-live only**. Flash-on-change may run while display-active (existing data signal). `useReducedMotion` still freezes pulse (already false on replay) and flash.

`/_ops/replay` copies OperatorMetrics chrome: own AppBar, `Container`, `Alert`, `Button`, `Chip` — not a new catalog piece. Keyboard: Start/Stop are real buttons (≥44px coarse). Focus-visible ring unchanged. Do not `disabled` a control whose refusal reason must be read — reuse `aria-disabled` + visible reason if Start is refused (positions faulted pattern), with the miss literal adjacent.

393px: ticker chip wrapping already exists; replay chip must not overflow. Operator page: no horizontal overflow, same e2e class.

No fourth arc. No gradient CTA. Primary Start uses existing contained primary (amber fill), which is **action**, not a live badge.

I request **no** `DESIGN_SYSTEM.md` amendment. A scrubber, a new “replay pulse”, or a second type scale would be an Amendments event — I am not proposing them.

`[operator-vs-trader-path-separation]`: no TopNav / CommandDeck / Settings / Ask-AI link to `/_ops/replay`. `app.tsx` today calls metrics the only nav-less route — this ship may add **one** sibling `/_ops/replay`, still unlinked, still first-class off-shell. It must **not** render inside `AppShell`.

Pages: S2 HTTP that needs `_research` is **Railway-direct / local proxy**, not `*.pages.dev`. Ticker SSE may play only if the **server arm** is replay — the Pages Function still 404s `_research`. A start button on Pages that silently 404s must show the existing 404/unauthorized as **not a tape day**, never S1.

### 8. Acceptance criteria (UX-owned states + Verify by)

Actors: operator (start/stop + walk); trader (S0 silence / production-today). PM may renumber into SPEC §3; **Verify by travels with the row.** `(SB)` = ship-blocking honesty. I do not invent routes or payload keys in these rows beyond the existing ticker stream + unlinked `/_ops` chrome + named fields in §3.

| # | Story | Acceptance criterion | State(s) | Verify by |
|---|---|---|---|---|
| AC-U1 **(SB)** | US-prod | With replay **unset**, Ticker connection chip, LiveTape title/subtitles/ⓘ, last-trade four-state copy, `OFFLINE_CHIP_TOOLTIP`, `LAST_TRADE_TOOLTIP`, and `⚠ Live offline — reconnecting…` are **byte-identical to today**. | S0 default / live-offline | test |
| AC-U2 **(SB)** | US-walk | For a locked-watchlist `(symbol, et_date)` with Path-A ticks, the existing ticker stream path shows Path-A-derived tape tiles/headline moving **without** using the live-session chip meaning. | S1 playing | test |
| AC-U3 **(SB)** | US-honesty | While replay playing/gap/ended/dropped: visible copy, tooltips, widget title, gamma-flip label, and last-trade bullet **never** contain `live`, `LIVE`, `live_massive`, or `this quote is live` (case-sensitive tokens as banned in §1; English “live” as the Massive classifier). | S1 all replay phases | test |
| AC-U4 **(SB)** | US-honesty | Replay **does not** render `` `Streaming live ${feed} ticks.` ``, `● live ·`, `Live tape`, or `Gamma flip (live)`. | S1 playing | test |
| AC-U5 **(SB)** | US-chip | Playing chip is `○` + `session tape · {SYM} · {humanSessionDate} · tape {time} ET` (speed suffix only if locked). `pulse` is false. Tone is not success/error direction green/red. | S1 playing | test |
| AC-U6 **(SB)** | US-ended | End-of-tape shows `○ session tape ended · {SYM} · {humanSessionDate}` and **does not** show `⚠ Live offline — reconnecting…` or `OFFLINE_CHIP_TOOLTIP`. Last tape values are kept, not blanked. | S1 end-of-tape | test |
| AC-U7 **(SB)** | US-offline | SSE drop **during replay** shows `⚠ Session tape stream dropped` (warning + icon) and **does not** show live-offline copy. SSE drop **with replay unset** still shows today’s live-offline copy. | S1 offline-replay vs S0 offline | test |
| AC-U8 **(SB)** | US-gap | Path-A gap chip is `session tape gap · …` and does not use the live “feed may be lagging” tip. | S1 gap | test |
| AC-U9 **(SB)** | US-fills | Order engine / mark live arm treat replay as **not live**: no limit fill, no live-cross, no liveDotPulse, no widgetLivePulse. `isLive` remains false while the discriminator is session tape. | S1 playing + orders | test |
| AC-U10 **(SB)** | US-miss | Start on no identity shows `no session day tape for {SYMBOL} on {ET_DATE}` and the ticker **does not** enter S1. No fabricated ticks. | S2 empty + S0 | test |
| AC-U11 **(SB)** | US-miss | Start on Path-A zero shows `no path-a ticks for {SYMBOL} on {ET_DATE}` and refuses the walk. | S2 empty Path-A | test |
| AC-U12 **(SB)** | US-miss | Path-B zero with Path-A present warns `no path-b snapshots…` and does **not** fabricate structure marks; Path-A walk may proceed. | S2 + S1 Path-A-only | test |
| AC-U13 **(SB)** | US-absent | not-storing / unreadable / not-in-watchlist / weekend / not-elapsed keep **capture** literals; none collapse into one “no data”; none use coverage `missing`/`present`/`not yet due`/`blocked occupancy`. | S2 all misses | test |
| AC-U14 **(SB)** | US-coverage | Ticker, `/_ops/replay`, and replay CLI **never** render coverage cells `present` \| `missing` \| `unreadable` \| `not yet due` \| `blocked occupancy`. Playing a tape does not change coverage classification. | S1/S2 negative + coverage isolation | test |
| AC-U15 **(SB)** | US-provenance | Playback copy/provenance **never** says `live_massive` / `LiveMassive`. Standing block includes `research tape · never live_massive · never coverage present`. | S1/S2 default | test |
| AC-U16 **(SB)** | US-Pages | Pages trader origin still **404s** `/api/_research` and `/api/_metrics` (and subpaths). Start/stop does not become a trader-origin tape API. | S3 | test |
| AC-U17 **(SB)** | US-nav | Trader shell / TopNav / CommandDeck / Settings / Ask-AI / Landing / Scanner gain **no** link or control to start replay. `/_ops/replay` is unlinked if it exists. | S3 | test |
| AC-U18 **(SB)** | US-metrics | `/_ops/metrics` gains **no** replay Start, tape matrix, or stage named from this feature. | S3 | test |
| AC-U19 **(SB)** | US-prod-arm | Production serve without an explicit replay arm does **not** show S1 chrome and still talks to Massive as today (ticker looks like S0). | S0 | test |
| AC-U20 **(SB)** | US-stop | Stop removes S1 chrome and must **not** leave a tape mid labeled as `● live`. | S1 → S0 | test |
| AC-U21 **(SB)** | US-score | Replay does not change score / tier / fingerprint formula (`Authorizes: nothing`). UI adds no “replay score” / “live score” badge. | S1 + isolation | test |
| AC-U22 **(SB)** | US-isolation | Replay fault does not 5xx the desk’s live path; trader cold-error Alert remains the shipped bundle error, not a tape stacktrace. | S1 error / S0 | test |
| AC-U23 **(SB)** | US-watchlist | Operator symbol control is the locked tape watchlist **SPY / QQQ / IWM**. Other symbols → `not in tape watchlist: {SYMBOL}` and no walk. | S2 | test |
| AC-U24 **(SB)** | US-single | Replay still one ticker on the walk path: the chip identity matches the ticker route symbol or the walk is refused/stopped — no silent other-symbol tape on SPY’s page. | S1 | test |
| AC-U25 **(SB)** | US-structure | FreshnessLine / static widgets keep snapshot language during replay; Path-B does not retitle them live. | S1 playing + Path-B | test |
| AC-U26 **(SB)** | US-capacity | Missing tape / ended tape **must not** reuse `Live streaming is at capacity. Try again shortly.` | S2 miss / S1 ended | test |
| AC-U27 **(SB)** | US-client | Trader-consumed dashboard must branch on the closed discriminator; a fixture with `live: true` **and** session-tape basis fails the suite if copy/pulse/fills follow `live`. Poison: indistinguishable live. | S1 vs S0 | test |
| AC-U28 | US-copy | Standing block, chip/tooltip strings, widget title swap, glossary, and banned-term table in §1–§2 are the approved copy. | default | review |
| AC-U29 | US-canon | SPEC §4 **adheres** to DESIGN_SYSTEM (SET); **no** second token table; **no** silent amendment; no scrubber/new keyframes. | canon | review |
| AC-U30 | US-ops | `/_ops/replay` (if present) uses existing operator chrome; Start label is **Start session tape**; loading is `Starting session tape…`. | S2 default/loading | review |
| AC-U31 | US-license | S2/CLI standing includes research / not a live vendor feed. | S2 default | review |
| AC-U32 | US-a11y | Warning phases use warning + icon; Start refusal reason is visible; 393px no overflow on the replay chip (time drops first). | S1/S2 | review |
| AC-U33 | US-motion | No new keyframe family; reduced-motion already disables live pulse (replay never pulses). | S1 | test |

**Method notes:**

- **`test`** — silent regressions: live-word occupancy on replay, S0 byte-identity when unset, chip meaning split, `isLive`/fills/pulse, end-of-tape ≠ live-offline, absence-class split, coverage-cell absence, Pages 404, nav unlink, metrics closed set, production arm, Stop residue, score identity, discriminator poison (`live: true` must not win).
- **`review`** — intentional wording of standing block / glossary, Start label, license presence, SPEC §4 no token dump, warning-icon + 393px chip priority.
- Harness already in contract: Vitest on `@convexa/dashboard` (jsdom) + Playwright e2e. Do **not** invent a VERIFY_MATRIX.md. Hollow “renders without throw” does not satisfy AC-U3/U9/U27.
- Structural scans belong on banned tokens in ticker chrome during replay fixtures, and on S0 fixtures asserting shipped live strings still exist.

### 9. Microcopy integrity (defining failure mode)

| Claim | Vouched by | Disposition |
|---|---|---|
| Tape tiles moving | SSE events whose basis is session day tape + Path-A store | Allowed as **display**; **banned** as live |
| `● live · open · $mid` | `live.live` + Massive arm + replay unset | Allowed on S0; **banned** on S1 |
| `Streaming live ${feed} ticks.` | genuine live classifier | **Banned** on S1 regardless of `feed` string |
| `session tape · SYM · date · tape time ET` | discriminator + `et_date` + vouched tape time | Allowed when vouched; drop time before lying |
| `{n}×` | locked multiplier actually on | Allowed only if locked; **banned** “1× = live” |
| `no session day tape for S on D` | store on; no identity | Allowed — not coverage `missing` |
| `no path-a ticks…` | identity; Path-A count 0 | Allowed — refuse walk |
| `no path-b snapshots…` | Path-B count 0 | Allowed as warn — not a fake structure clock |
| End as `Live offline — reconnecting…` | would claim Massive reconnect | **Banned** |
| Coverage `present` on playback | would claim live-paid book | **Banned** |
| `live_massive` on chip/tooltip/CLI | would claim paid live provenance | **Banned** |
| Fills on replayed mid | `evaluateOrder` requires `isLive` | **Banned** |
| “complete open-to-close” / “78% of Tuesday” | no completeness field on ticker | **Banned** |
| `$398` Massive motive | briefing, not a runtime field | **Banned** on S1/S2 |
| Fixture / S3 / hist-chain as this clock | other products; Fixture is not a clock | **Banned** |
| Production ticker “replay mode” when unset | production default is Live Massive | **Banned** |

### 10. Out of UX scope (hand to other lanes)

- Replay arm vs new `MarketDataPort` kind (Architect). I own that the **ticker copy** never calls it live Massive / Fixture-as-clock, and that production unset still looks like today.
- Original timestamps vs speed multiplier (Architect / PM). I own: tape time is labeled ET; `{n}×` only if locked; no scrubber; “real-time” is not a live synonym.
- How events get onto the existing SSE (Architect). I own the fields the UI **branches on** (§3) and that `live: true` must not be that branch.
- Process-global vs isolated replay (Architect / PM). I own: Pages traders must not be silently walked; production default is S0. If replay is process-global on a research box, S1 honesty still binds.
- Path-B emit cadence internals (Architect). I own structure widgets staying snapshot-named.
- Clap vs HTTP start (Architect). I own literals and that Pages does not grow `_research`.
- Score formula (forbidden change). I own no “replay score” badge.
- Payload schema / route paths beyond consuming the existing ticker stream and an unlinked `/_ops` page (synthesizer / Architect).

## Risks I see

1. **Indistinguishable live — defining failure.** Architect emits replay on `LiveUpdate` with `live: true` (today’s age < 30s classifier in `stream.rs`) or the client keeps `isLive = live.live && !streamOffline`. Then the chip says `● live`, LiveTape stays **Live tape**, pulses run, and **orders fill**. AC-U3/U4/U9/U27 exist so that path is a red test, not a screenshot debate.
2. **End-of-tape as live-offline.** The 15s watchdog will fire when the clock stops. If nobody splits phase, traders get `⚠ Live offline — reconnecting…` — a lie. AC-U6/U7.
3. **Helpful Replay app.** A `/replay` lab, CommandDeck toggle, or Settings “research feed” re-scopes capture’s `NO_UI_CHANGE` into a second live path. BRIEF forbids it. AC-U17.
4. **Coverage vocabulary leak.** After archive-coverage, `present` means live-paid book. Printing it on playback falsifies `present-is-live-paid-only`. AC-U14/U15.
5. **Missing tape plays anyway.** Empty Path-A or no identity rendered as a quiet live session. AC-U10/U11.
6. **Production look drifts.** Adding a dormant replay chip on every ticker “for later” violates “production without replay still looks like today.” AC-U1/U19.
7. **`/_ops/metrics` Start button.** Side-effect on a read-only operator page. AC-U18.
8. **Pages start 404 interpreted as empty day.** Operator on `*.pages.dev` hits `_research`, gets 404, copy says `no session day tape`. That would rename a fence as a miss. Start/stop must not use that origin; 404 stays 404. AC-U16.
9. **Headline frozen because `isLive` is false.** If display stays tied to `isLive`, the walk is invisible and the feature fails its job. Display-active must split from live-meaning. Named in §3; R2 if Architect refuses a discriminator.
10. **Path-B titled live greeks.** Structure as-of is the honesty spine. AC-U25.
11. **New motion / scrubber.** `[single-motion-moment]` red-builds a new keyframe. A timeline is a DESIGN_SYSTEM amendment I am not requesting.
12. **My own failure mode, named:** writing copy that says “as if the clock were running” in the UI. That phrase is BRIEF motive. On-screen it becomes a live claim. Chip says **session tape** and **tape time ET**, never “as if live.”

## Assumptions I'm making about the other two lanes

- **Architect** will put replayed Path-A ticks onto the **existing** `GET /api/stream/{ticker}` `LiveUpdate` consumer path — not a second EventSource and not Fixture-at-`as_of` as the clock.
- **Architect** will emit a **closed stream-basis discriminator** the client can read on each update (or an equivalent vouched field) that is **not** `live: true` and **not** `live_massive`, and will keep `live: false` on replayed events so today’s `isLive` derivation cannot call them live.
- **Architect** will emit vouched `et_date` (America/New_York `YYYY-MM-DD`) and a **tape-time ET** the chip can print without using `Date.now()` as market time.
- **Architect** will signal **ended** and **Path-A gap** as distinct from SSE heartbeat silence, so the 15s watchdog is not the end-of-tape classifier.
- **Architect** will **not** `insert_if_absent` replay/tape as `LiveMassive`, will **not** count playback as coverage `present`, and will **not** fetch Massive to invent a missing day.
- **Architect**’s production construct **without** an explicit replay arm remains Live Massive; production-fails-closed — serve does not silently become replay.
- **Architect** isolates replay faults from desk 5xx on the live path (`best-effort-isolated-or-null`) and keeps Pages 404 on `/api/_research` and `/api/_metrics`.
- **Architect** will not require `/_ops/metrics` to grow Start/Stop or a tape widget; operator HTTP if any is token-gated like other `_research`/`_metrics` (not a trader cookie).
- **Architect**, if adding clap, will title stdout `session-day-replay` (grep-able) and will not alias `serve` / `session-day-tape` list / `archive-coverage` as playback.
- **Architect** will not ship a scrubber API or a second SSE schema the ticker must learn beyond named additive facts in §3.
- **PM** will not add a parallel Replay app, trader CommandDeck Start, Settings live/replay toggle, research-lab walk surface, or coverage cells on ticker/ops.
- **PM** will lock watchlist **SPY / QQQ / IWM** (already the tape lock) and will not ask NVDA/universe playback this ship.
- **PM** will lock **original timestamps vs a closed multiplier set** before copy prints `{n}×`; if only original timestamps, there is no speed control and no “real-time = live” label.
- **PM** accepts the display-active vs `isLive` split: the walk **moves** numbers; it does **not** inherit live fills, live pulse, or live chip meaning.
- **PM** accepts capture’s miss literals as the only miss deck (no new “tape 404” dialect; no coverage `missing`).
- **PM** accepts Path-B-empty ≠ cannot-walk, and Path-A-empty = cannot-walk.
- **PM** will fold these AC-U rows into SPEC §3 with `Verify by` intact, and will not move AC-U3/U6/U9/U16/U19/U27 to `review`.
- **PM** will not ask SPEC §4 to dump tokens or to amend DESIGN_SYSTEM for a scrubber/new pulse; §4 adheres to the SET canon and names existing ticker + operator chrome.
- **PM** will not require production Pages traders to start replay, or require Ask-AI to call replayed quotes live.
- **If Architect hides replay as indistinguishable live (`live: true`, live chip, live fills), that assumption is false — I will raise it as an R2 technical conflict quoting this section, and I will not agree to “the ticks are moving so the chip may say live.”**
