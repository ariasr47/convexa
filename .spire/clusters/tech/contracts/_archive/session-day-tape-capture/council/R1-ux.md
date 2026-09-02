# R1 — ux position: session-day-tape-capture

## Position

### 0. What the surface actually is (and what it is not)

There is **no trader screen here.** The BRIEF is a **research tape store**: append-only Path-A stock ticks that today hit `PriceCache` and die, plus timed Path-B options-structure snapshots the warmer already fetches and **drops**, so a cancelled Massive subscription does not erase Tuesday’s **price tape + periodic GEX structure** for a **closed watchlist**. It does **not** play the tape back into the ticker page, download S3 flat files, change live scoring, insert reconstructions as `LiveMassive`, add a trader UI, or move session-archive bodies.

`[operator-vs-trader-path-separation]` is HARD. Tape is research. Trader SSE is unchanged. A tape **read** makes **zero** extra vendor fetches. Pages trader origin already 404s `/api/_research` and `/api/_metrics` (`functions/api/[[path]].ts`). Tape stays on that side of the fence.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` is **Status: SET** (The Curvature Terminal). This feature consumes **no** dashboard route, component, token, motion, chip, LiveTape mode, or copy table. SPEC §4 must carry **`NO_UI_CHANGE`** and must **not** restate the token table. I request **no amendment** to `DESIGN_SYSTEM.md`. Anyone proposing a Ticker “replay Tuesday” / “tape saved” chip, a Settings research toggle, an Ask-AI “we kept Tuesday’s tape” line, a Scanner badge, a Landing lab teaser, or a **new `/_ops` tape panel** is **re-scoping** — raise as an R2 `product` conflict; do not fold it in.

The existing unlinked `/_ops/metrics` page (`OperatorMetrics`) is **latency / cache / vendor-headroom chrome**. Tape counts, Path-A/Path-B identities, and “Tuesday stored?” are **different data**. Collapsing them into p50/p95, “Instrumentation: ON”, a success chip, or a coverage-style `present` cell is this feature’s defining integrity failure on that page. If Architect rides tape JSON on `GET /api/_metrics`, that is a **curl/ops wire vehicle**, not permission to render a second matrix in the dashboard. Unknown JSON must remain **unrendered** there.

This is **not** session-archive **coverage**. Coverage cells `present` | `missing` | `unreadable` | `not yet due` | `blocked occupancy` classify **expected live-paid session books** (`present-is-live-paid-only`). Tape occupants are **never** those cells. A stored Tuesday tape does **not** fill a coverage hole. Coverage holes stay holes.

This is **not** a session-book **load** (`RESEARCH READ — SESSION BOOK`). A first-wins `(symbol, et_date)` book is often a start-of-day still photo (BRIEF: QQQ/IWM 24–26 Aug books had **0 trades**). Tape is the open-to-close stream that book does not keep. Do not reuse session-hit framing on a tape read, or a skimming operator will think they loaded Tuesday’s paid chain.

This is **not** the 48/14d ring (`RESEARCH READ — STORED CHAIN SNAPSHOT`). Warmer / `refresh_analytics` still **must not** `spawn_capture` into that ring (cited `analytics.rs`: “warmer / refresh_analytics must not capture”). Path-B tape persist is a **sibling research object**, not a raised ring cap.

This is **not** `day-replay-mock-adapter`. Fixture is a frozen `VendorBundle` at `as_of`, not a clock. This slice **stores**; it does **not** play. Load copy says **not a playback**.

This is **not** `massive-flat-file-keep` (culled). S3 reconstructs next-day price/quote history, not same-day greeks/IV/OI. Never label this tape “S3”, “flat file”, “hist-chain”, or `live_massive`.

The user-facing surface I own is five coupled artifacts plus hard negative space:

| # | Surface | Who reads it | My ownership |
|---|---------|--------------|--------------|
| S0 | **Trader UI silence** — Landing, Ticker (including LiveTape), Positions, Scanner, Settings, Ask-AI, shell nav; Pages trader origin | every trader | what must **never** appear: no tape badge, replay control, “saved Tuesday”, corpus count, Path-A/B caption, or Ask-AI grounding on stored ticks/snapshots |
| S1 | **Research list/load** — operator HTTP under the research fence + any human-printed twin | research operator / owner | framing, identity, Path-A vs Path-B sections, absence literals, provenance that is **not** `live_massive`, standing block, banned terms |
| S2 | **Write-skip / sidecar logs** | operator logs / Railway logs | exact skip lines; Path-A vs Path-B; ban on trader toasts; ban on failing bundle / scan / SSE / ensure |
| S3 | **CLI twin (if Architect adds clap)** | maintainer on a shell | same literals as S1; **Evidence: local**; not production coverage; stdout title grep-able as `session-day-tape` |
| S4 | **Negative space — `/_ops/metrics` + coverage + session-book + ring + score-lab** | anyone on those vehicles | tape must **never** appear as a latency stage, coverage `present`, session-book hit, ring snapshot, or “LIVE tape” headline |

**Explicit trader-product statement (carry into SPEC §4):** the trader UI does **not** gain chrome, routes, badges, toasts, Settings controls, Ask-AI disclosures, or a ticker playback surface for this tape. That is not a deferral — it is the product shape of this BRIEF.

### 1. Intended user, primary job, information structure, vocabulary

- **Intended user:** the research operator / owner who, after Massive is cancelled, still needs Tuesday’s **price tape + periodic GEX structure** for the locked watchlist — via token-gated research list/load, Railway-direct curl, logs, or a local CLI. **Not** the anonymous or signed-in trader.
- **Primary job:** *For locked watchlist symbol S on ET date D, can I load Path-A ticks and Path-B structure snapshots that this process stored that day — without paying Massive again, without being told this is a live paid session book, without being told this is ticker playback, and without collapsing “no ticks” into “we were not storing” or “coverage missing”?*
- **Failure I am designing against:** one “no data” / “Tuesday saved” / “LIVE tape” / coverage-`present` string that collapses **Path-A ticks ≠ Path-B structure snapshots ≠ session-archive books ≠ 48/14d ring**, or **no-ticks ≠ no-snapshots ≠ no-identity ≠ not-storing ≠ unreadable ≠ not-in-watchlist ≠ coverage-missing**, or a local receipt quoted as **production coverage**, or a tape occupant labeled `live_massive` / `present`.

**Information structure (S1/S3), always in this order, before any tick/snapshot dump:**

1. **Standing / framing block first** (what this is — before any count).
2. **Scope:** locked watchlist printed · identity `(symbol, et_date)` · evidence class · vendor I/O on **this read**.
3. **Path-A section** — ticks only: kind-split counts when the store vouches kinds; else an honest Path-A empty/error literal.
4. **Path-B section** — structure snapshots only: snapshot count + locked interval **if vouched**; else an honest Path-B empty/error literal.
5. **What this is / is not** (one block).
6. **License one-liner.**
7. **Closing line:** authorizes nothing; tape is not a live paid session book; local is not hosted/production evidence (CLI).

Do **not** lead with raw JSON a skimming operator can paste into a trader or coverage context without the hedge. Do **not** sort identities into a leaderboard. Do **not** print a bare percent “tape completeness” score.

**User vocabulary — closed term set. These are the only words S1–S3 may use for these things.** Reuse shipped session-archive / ring / coverage strings **only on those vehicles**. Do **not** invent a second deck for those objects, and do **not** borrow their occupancy cells for tape.

| Concept | Approved term / exact string | **Banned** (asserts a meaning the data cannot carry) |
|---|---|---|
| This store | **session day tape** · **day tape** · identity **`(symbol, et_date)`** America/New_York | “live book”, “session book”, “hist-chain”, “S3 tape”, “raised 48-cap”, “production coverage”, “ticker replay feed” |
| Path-A payload | **Path-A ticks** · **stock ticks** · **stocks WS** (not OPRA) | “OPRA”, “options quotes”, “live tape” as a product badge, “trades” for a quote event, “NBBO tape” if only trades are stored |
| Path-A event kinds | **`trade`** and **`quote`** as `StreamKind` already names them (`domain/price.rs`) | collapsing both into “ticks” when a count is printed; calling quotes “prints”; calling trades “quotes” |
| Path-B payload | **Path-B structure snapshots** · **timed options-structure snapshots** | “session book”, “stored chain snapshot”, “48-ring slot”, “warmer capture into the ring”, “live_massive book”, “intraday OI tape” |
| Path-B clock | **snapshot as-of \<UTC\>** · **locked interval {interval}** (PM/Architect lock, printed not invented) | “every 25s” unless that interval is the locked tape cadence; “fresh”; “now”; “live greeks” |
| Names in scope | **locked watchlist** — the closed set this run actually used, printed | defaulting copy to `WARM_SYMBOLS`, scanner universe, or `ENSURE_SYMBOLS` unless that set **is** the lock |
| Session-archive book (other object) | **session book** · **session archive** · coverage cells stay on the coverage vehicle | calling a tape row a session book; calling a tape hit `present` |
| 48/14d ring (other object) | **48-ring** / **stored chain snapshot** (capture’s term) | calling Path-B tape a ring snapshot; calling a ring row a day tape |
| Coverage occupancy (other object) | **`present`** = loadable **live paid** session book only | using `present` / `missing` / `not yet due` / `blocked occupancy` as **tape** cells |
| How obtained on read | **loaded from session day tape · no vendor call** | “refreshed from Massive”; “filled”; “reconstructed”; “synced”; “played into ticker” |
| The whole activity | **research read** / **session-day-tape read** | “market view”, “ticker reload”, “day replay”, “LIVE”, “playback” |
| No tape identity | **`no session day tape for <SYMBOL> on <ET_DATE>`** | `missing`; `no session book…`; `no stored snapshot…`; trader `—`; `unavailable this cycle`; “coverage 0%” |
| Path-A zero events, store on | **`no path-a ticks for <SYMBOL> on <ET_DATE>`** | `not-storing`; `unreadable`; coverage `missing`; “we did not capture”; “market closed” (unless that clock is vouched) |
| Path-B zero snapshots, store on | **`no path-b snapshots for <SYMBOL> on <ET_DATE>`** | collapsing into Path-A empty; `empty 48-ring…`; `no session book…` |
| Store disabled / unavailable | **`session day tape not storing`** — **store-level error**, not N empty tick cells | all-missing coverage matrix; “tape 0%”; treating as coverage-missing |
| Identity/pointer, body bad | **`session day tape unreadable: <reason>`** | treating as no-ticks; treating as not-storing; “Permission denied” as the class |
| Symbol not in locked watchlist | **`not in tape watchlist: <SYMBOL>`** | `no path-a ticks…` (implies we attempted capture); coverage `missing` |
| Write failure | **`session day tape write skipped — path-a · trader path unchanged`** / **`… — path-b · …`** | trader toast; failing bundle/scan/SSE/ensure; “save failed” on Ticker |
| Provenance on tape | **research tape** · Architect’s **non-`live_massive`** kind, printed as that kind’s operator token | `live_massive`; `LIVE`; `present`; `fixture` unless the row **is** a fixture (and then still never `present`) |
| Reconstructed / S3 / flat-file | **not this tape** · **never `live_massive`** · **never coverage `present`** | “recovered Tuesday”; “backfilled from S3”; inserting as a live paid session book |
| Evidence class | **`local`** on CLI unless the run actually is another class | local pass labeled production / Railway / hosted / CI-verified-on-runners |
| Counts | **`path-a ticks: {n_trade} trades · {n_quote} quotes`** and **`path-b snapshots: {k}`** against vouched store counts | bare “complete day”; “100% open-to-close”; mixing Path-A+Path-B into one unnamed `n` |
| Score / fill / playback posture | **Authorizes: nothing** | “fetch the hole”; “fill session archive”; “score used this tape”; “replayed on ticker”; “verified complete” |
| License | **Our research · not redistributed on a trader route.** | “customer historical API”; “OPRA flat files”; trader-route export |
| Operator auth miss | reuse shipped **`metrics_unauthorized`** / `Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token` | “tape unauthorized” as a second auth dialect |
| Pages trader origin | existing **404 `Not Found`** on `/api/_research` and `/api/_metrics` prefixes | proxying tape to the trader origin; a trader-readable “Tuesday saved” banner |
| Existing Path-A live CLIs | `stream-prices` / `price-get` remain **live cache** tools | aliasing them as session-day-tape read; printing their verbose line as research framing |

**Hard ban — silent rename of the four objects:** Path-A ticks ≠ Path-B structure snapshots ≠ session-archive books ≠ 48/14d ring. One label for two of these is a fabricated claim.

**Hard ban — silent rename of the absences:** no-ticks ≠ no-snapshots ≠ no-identity ≠ not-storing ≠ unreadable ≠ not-in-watchlist ≠ coverage-missing. That collapse is `[absent-is-not-none]`. Coverage-missing is a **foreign** class (session-archive vehicle only); it must not appear as a tape cell.

**Hard ban — `present` and `missing` on this vehicle.** Those words now mean session-archive coverage occupancy (`present-is-live-paid-only`). Tape hits say **loaded from session day tape**. Tape misses say **`no session day tape…`** / **`no path-a ticks…`** / **`no path-b snapshots…`**. A tape row is **never** a coverage `present` live paid book.

**Hard ban — `live` / `LIVE` / `live_massive` as a market-feed or occupancy claim on tape.** Closed lineage `live_massive` remains **session-book provenance only**. BRIEF: tape Path-B provenance is **not** `live_massive`. Tape / reconstructed occupants are never `present` `LiveMassive` session books.

**Hard ban — playback.** Load is inspect. Strings `replay`, `playback`, `play into ticker`, `mock adapter`, `LIVE tape` are **forbidden** on this slice’s output. `day-replay-mock-adapter` is a later feature.

**Hard ban — hist-chain / S3 / production coverage.** Culled or other-program names. Local CLI is **Evidence: local**, never “production coverage”.

**Hard ban — percent-as-health.** `{k} snapshots` is a count. `78% of the day captured` as a headline is a renamed count with a completeness connotation the data does not carry unless PM locks a session window **and** both paths report against it (they have not, in this BRIEF).

**Hard ban — default watchlist in copy.** Do not print SPY/QQQ/IWM, `WARM_SYMBOLS`, or the scanner universe as “the tape names” unless that exact set is the locked closed watchlist. BRIEF: do not default to `WARM_SYMBOLS` / universe. `ENSURE_SYMBOLS` is the **session-archive ensure set**, not automatically the tape watchlist.

### 2. Binding framing (must ship on every human print, including empty / error)

`(a)` **Standing block is first** on CLI stdout and on any human-printed HTTP twin, before any count:

```
SESSION DAY TAPE — RESEARCH STORE · NOT A LIVE PAID SESSION BOOK · NOT A PLAYBACK
  Command:     session-day-tape
  Evidence:    local
  Watchlist:   {locked closed list this run used}
  Identity:    (symbol, et_date) America/New_York
  Path-A:      append-only stock ticks · stocks WS · not OPRA
  Path-B:      timed options-structure snapshots · interval {locked interval}
  Provenance:  research tape · never live_massive · never coverage present
  Vendor I/O:  0 Massive calls on this read
  Authorizes:  nothing. No live score/tier/gate/fingerprint change, no trader UI,
               no ticker playback, no session-archive fill, no 48-ring spawn_capture.
```

`{locked closed list}` and `{locked interval}` are **PM/Architect locks, not UX numbers**. I own that they are **printed beside the read**, that a missing lock is a **blocked run** (not a pretty empty success), and that **Evidence: local** is on the CLI even when the operator wishes it were production.

If the vehicle is HTTP against a production process, the standing block may say **Evidence: this process** (not “hosted verified”, not “CI”). Still **not a playback**. Still **Authorizes: nothing**. Do not print `Evidence: local` on a Railway-origin GET, and do not print `Evidence: production` on a laptop CLI.

HTTP envelope framing (concept names only — **no invented payload keys**):

| Situation | Framing line (exact) |
|---|---|
| Combined identity loads (either path has data, or both empty-but-storing) | `RESEARCH READ — SESSION DAY TAPE` |
| No tape identity for that `(symbol, et_date)` | `RESEARCH READ — NO SESSION DAY TAPE` |
| Operator asked only Path-A and it hits | `RESEARCH READ — PATH-A TICKS` |
| Operator asked only Path-B and it hits | `RESEARCH READ — PATH-B STRUCTURE SNAPSHOTS` |
| Weekend / no identity / not in watchlist — still this family | never `RESEARCH READ — SESSION BOOK` / `… SESSION ARCHIVE COVERAGE` / `… STORED CHAIN SNAPSHOT` / `RESEARCH REPLAY — NOT LIVE` |

**Do not** send session-book, coverage, ring, or batch-backtest framing when the object is tape.

`(b)` **Vendor I/O line is not decorative.** Print `0 Massive calls` only when the **read** can vouch it. If it cannot, the verdict is **ERROR / BLOCKED**, never a dump that looks complete. Capture-time Massive (the stocks WS / paid REST we already fetch) is **not** a read-path vendor call and must not be relabeled as one on list/load.

`(c)` Repeat one closing line at the bottom of stdout:

`SESSION DAY TAPE — NOT A LIVE PAID SESSION BOOK · NOT A PLAYBACK · Authorizes: nothing · local audit is not production coverage`

HTTP closing (this-process): `SESSION DAY TAPE — NOT A LIVE PAID SESSION BOOK · NOT A PLAYBACK · Authorizes: nothing`

`(d)` Human print, any JSON twin, Path-A/Path-B counts, and absence literals **must agree**. A success-sounding line over an unreadable body (or the reverse) is a copy bug.

`(e)` **Is / is not block** on every successful or empty-but-storing read:

- **Is:** research tape for a locked watchlist ET day: Path-A append-only stock ticks from the stocks WS; Path-B timed options-structure snapshots the warmer already fetched.
- **Is not:** a live paid session book; not coverage `present`; not the 48/14d ring; not OPRA options-quote flat files; not S3 hist-chain; not ticker playback; not a scoring input; not a Massive product we newly bought.

### 3. Where each datum surfaces

| Datum | Surfaces on | Does **not** surface on |
|---|---|---|
| Path-A ticks (symbol, kind `trade`\|`quote`, vendor ts, price/size/bid/ask as present on the event) | S1 Path-A section; S3 same | Ticker LiveTape; SSE; session-book load; coverage matrix; `/_ops/metrics` stages |
| Path-B snapshots (symbol, as-of UTC, locked interval when vouched) | S1 Path-B section; S3 same | 48-ring list; session-book load; coverage `present`; trader widgets |
| Combined identity `(symbol, et_date)` | S1 list; S3 list | `ENSURE_SYMBOLS` coverage rows unless the watchlist lock **is** that set |
| Provenance token ≠ `live_massive` | S1/S3 provenance line | session-book `source: live_massive` (that vehicle keeps its own token) |
| `no path-a ticks…` / `no path-b snapshots…` / `no session day tape…` | S1/S3 empty states | coverage hole list; trader `—` |
| `session day tape not storing` / `… unreadable:` | S1/S3 error | nine coverage `missing` cells; trader offline chip |
| `not in tape watchlist:` | S1/S3 | coverage `missing`; Path-A empty (attempted capture) |
| Write skip Path-A / Path-B | S2 operator log only | trader toast; SSE; bundle error chrome |
| `authorizes: nothing` / license | standing + hit/empty envelope | implying stored ticks are a trader feed |
| Pages 404 | trader origin on `_research` / `_metrics` prefixes | Railway-direct operator GET (token-gated) |
| Live NBBO / last-trade on Ticker | **unchanged existing LiveTape / SSE** | must **not** dim, blank, or grow a “research tape” caption because sidecar write succeeded or failed (`[live-vs-static-isolation]`) |
| Session-archive coverage cells | existing coverage vehicle only | tape list/load |

I do **not** name new JSON fields or routes. Architect/synthesizer own keys and paths. I own the **literals and labels** the operator reads, and the fields the surface **consumes** as concepts: `symbol`, `et_date`, path (`path-a` / `path-b`), Path-A `kind`, Path-A vendor timestamp, Path-B `as_of`, provenance token, vouched trade/quote/snapshot counts, `vendor_called` on the read, store class (storing / not-storing / unreadable), watchlist membership.

### 4. States (complete matrix)

Trader path (S0) has **one** required state: **unchanged**. Browser default / loading / empty / error / offline / stale on Landing / Ticker / Positions / Scanner / Settings / Ask-AI / shell are **N/A** (`NO_UI_CHANGE`). Tape persist success, persist skip, list, load, and store fault are **all invisible** there. Live ticks must **not** dim or blank because the sidecar ran (`[live-vs-static-isolation]`).

`/_ops/metrics` (S4) stays on its **existing** closed states (`Loading metrics…` / `Metrics readout unavailable.` / rolling latency tables). Tape does **not** add a state to that page.

Session-archive coverage, session-book list/load, and 48-ring list/load keep **their** shipped framing. Tape does not overwrite them.

S1/S3 operator-visible states. Empty, partial, not-storing, unreadable, not-in-watchlist, and error must stay **visibly distinct** (`[absent-is-not-none]`). Progress copy is not a verdict. **Stale in the trader-SSE sense is N/A** — a dated Tuesday tape is **dated**, not stale-live.

| State | When | Operator sees | Must **not** happen |
|---|---|---|---|
| **default — both paths** | Identity exists; Path-A has ≥1 tick **and** Path-B has ≥1 snapshot; store readable | Standing → `RESEARCH READ — SESSION DAY TAPE` → Path-A counts (kind-split if vouched) → Path-B count + interval if vouched → is/is-not → license → close | `LIVE`; `live_massive`; coverage `present`; session-book framing; mixing both paths into one unnamed `n` |
| **default — Path-A only** | Identity storing; Path-A ≥1 tick; Path-B zero snapshots | Standing remains; Path-A dump/counts; Path-B exact **`no path-b snapshots for {SYMBOL} on {ET_DATE}`** | Calling the day “complete”; hiding Path-B; treating as error; calling Path-A a structure snapshot |
| **default — Path-B only** | Identity storing; Path-B ≥1 snapshot; Path-A zero ticks | Standing remains; Path-B section; Path-A exact **`no path-a ticks for {SYMBOL} on {ET_DATE}`** | Calling it a session book; treating zero ticks as not-storing; filling from session archive |
| **empty — no identity** | No tape row for `(symbol, et_date)` and store is storing; symbol **is** in watchlist | `RESEARCH READ — NO SESSION DAY TAPE` · **`no session day tape for {SYMBOL} on {ET_DATE}`** | `missing`; `no session book…`; `no stored snapshot…`; trader `—`; `unavailable this cycle` |
| **empty — Path-A zero** | Identity/store on; zero Path-A events | **`no path-a ticks for {SYMBOL} on {ET_DATE}`** | `session day tape not storing`; coverage `missing`; “market closed” without a vouched clock |
| **empty — Path-B zero** | Identity/store on; zero Path-B snapshots | **`no path-b snapshots for {SYMBOL} on {ET_DATE}`** | `empty 48-ring…`; `no session book…`; collapsing into Path-A empty |
| **empty — not in watchlist** | Requested symbol is outside the locked closed watchlist | **`not in tape watchlist: {SYMBOL}`** · no fabricated tick counts | `no path-a ticks…`; adding the symbol in copy as if captured |
| **loading (CLI)** | List/load in flight | `[RUNNING] session-day-tape — no verdict yet` | “fetching from Massive…”; a partial file titled as a finished receipt |
| **loading (HTTP)** | **N/A** | No loading field | OperatorMetrics spinner reused as tape |
| **error — not storing** | Tape store disabled / unavailable | **`session day tape not storing`** · no fabricated tick/snapshot cells · CLI **non-zero** `[ERROR]` if a CLI exists | N empty-tick rows; coverage all-missing; silent Massive recovery |
| **error — unreadable** | Identity/pointer exists; body cannot be read | **`session day tape unreadable: <reason>`** | Treating as no-ticks; treating as not-storing; trader-shaped 5xx on desk routes |
| **error — unauthorized (HTTP)** | Operator token missing/wrong when token is configured | Shipped **401** `metrics_unauthorized` detail — **reuse** | 200 empty tape; trader-session cookie as the gate |
| **error — vendor I/O on read** | Tape **read** would call Massive or cannot vouch 0 vendor calls | `[ERROR] session-day-tape — tape read must not call Massive. No load recorded.` | A dump anyway; burning Options/stocks REST to “confirm” a miss |
| **error — lock missing** | Watchlist or Path-B interval not locked and the print would have to invent them | `[ERROR] session-day-tape — watchlist or Path-B interval not locked. No load recorded.` | Printing `WARM_SYMBOLS` / “every 25s” as if they were the lock |
| **blocked — reconstructed / S3 / LiveMassive occupancy** | A reconstructed, flat-file, or `live_massive` artifact would be shown as this tape **or** inserted as a session-archive `present` | Do **not** print tape-hit framing. Prefer error/blocked: this is **not** a live paid session book and **not** this tape’s hit. | “recovered Tuesday”; coverage `present`; `live_massive` on a tape row |
| **write skipped (S2)** | Path-A or Path-B persist failed; live path otherwise succeeded | Exactly the Path-A or Path-B skip line (§5). Bundle / scan / SSE / ensure intact | Trader toast; dimmed LiveTape; failing SSE; “save failed” |
| **sidecar live isolation** | Path-A sidecar is appending (or skipping) while trader SSE runs | Trader LiveTape **unchanged** — no extra caption, no dim, no blank | “research capture on”; pause glyph because tape write failed |
| **stale (trader SSE sense)** | N/A | Dated `et_date` / as-of remains **research** | `⏸ offline` / “Live offline” / `unavailable this cycle` on the tape read |
| **offline (trader SSE sense)** | N/A | Operator curl failure is a **client** error, not a tape class | Inventing an offline cell |
| **HTTP success with empty paths** | Operator GET on a storing process with zero ticks and/or zero snapshots | **200 + honest empty literals** (empty tape must not fail the desk) | HTTP 5xx because Tuesday had no ticks; empty 200 that looks like a full book |
| **trader product (negative)** | Always | Unchanged Ticker/SSE/Settings/Ask-AI/`/_ops/metrics` copy | New route, nav, chip, toast, playback, or Pages-proxied tape |

**Closed absence / occupancy literals (exact; never synonyms):**

| Literal | Means |
|---|---|
| `no session day tape for {SYMBOL} on {ET_DATE}` | No tape identity for that pair; store is storing; symbol is in watchlist |
| `no path-a ticks for {SYMBOL} on {ET_DATE}` | Store on; Path-A event count is 0 |
| `no path-b snapshots for {SYMBOL} on {ET_DATE}` | Store on; Path-B snapshot count is 0 |
| `not in tape watchlist: {SYMBOL}` | Symbol is outside the locked closed set |
| `session day tape not storing` | Store disabled / unavailable — **not** a per-symbol empty |
| `session day tape unreadable: {reason}` | Identity/pointer exists; body not readable |

Banned competing empties on this vehicle: `present`, `missing`, `not yet due`, `blocked occupancy`, `n/a`, blank, trader `—`, `unavailable this cycle`, `/_ops` `unknown`, `no session book for {SYMBOL} on {ET_DATE}`, `no stored snapshot for {SYMBOL}`, `empty 48-ring for {SYMBOL}`, `ok`, `fail`, `live`, `LIVE`, `live_massive`.

Shipped session-book / ring / coverage strings remain on **those** vehicles only.

### 5. Exact warning / skip / verdict wording

Placeholders in braces are filled from **this run’s** vouched identities. Do not hard-code counts. Do not assert dollar loss (`$398` / `$199 Options`) — that is briefing/BRIEF motive, not a runtime-vouched field.

**S2 — write skip (operator log only):**

| Class | Exact operator-facing line |
|---|---|
| Path-A persist failed | `session day tape write skipped — path-a · trader path unchanged` |
| Path-B persist failed | `session day tape write skipped — path-b · trader path unchanged` |

Rules:

- Path-A and Path-B are **independent skip lines**. Do not emit one “tape failed” line that hides which path skipped.
- Do **not** fail bundle / scan / SSE / ensure because the skip fired (`[best-effort-isolated-or-null]`).
- Do **not** put filesystem paths, Redis keys, or bucket names in the **closed** line. A backend `error=` field may exist for diagnosis; it is **not** a second product class.
- Do **not** fire a skip line when the symbol is not in the locked watchlist (that is not a failed persist; it is out of scope).
- Color may supplement; **plain text carries the whole meaning**.

I am **not** proposing a coverage-style one-warning-per-identity “tape hole” after 16:00 ET. Empty Path-A ticks can be a real quiet tape; treating that as `[FAIL]` fabricates a capture outage. If PM later wants an audit command, it must use **this** vocabulary, not coverage `present`/`missing`.

**S3 — CLI lines (only if Architect adds clap; stdout title remains `session-day-tape` even if clap is renamed):**

| Verdict | Exit | Exact operator-facing line |
|---|---|---|
| Running | pending | `[RUNNING] session-day-tape — no verdict yet` |
| Load/list ok | 0 | `[OK] session-day-tape — loaded from session day tape · 0 Massive calls · not a live paid session book · local audit is not production coverage` |
| Empty identity | 0 | `[OK] session-day-tape — no session day tape for {SYMBOL} on {ET_DATE}. Not a coverage miss.` |
| Not storing | non-zero | `[ERROR] session-day-tape — session day tape not storing. No load recorded.` |
| Unreadable | non-zero | `[ERROR] session-day-tape — session day tape unreadable. No load recorded.` |
| Massive on read | non-zero | `[ERROR] session-day-tape — tape read must not call Massive. No load recorded.` |
| Missing lock | non-zero | `[ERROR] session-day-tape — watchlist or Path-B interval not locked. No load recorded.` |
| Not in watchlist | 0 | `[OK] session-day-tape — not in tape watchlist: {SYMBOL}` |

Do **not** use `[PASS] n/n present`, “SLO miss”, “production down”, “verified”, “certified”, “healthy”, “Live”, “hist-chain”, or “Massive p95” in any generated line. Empty identity is **not** a coverage `[FAIL]`.

**S1 HTTP:** no process exit. Empty paths are still a successful **read**. Do not translate no-ticks into trader 5xx.

**Provenance line on hit:** `loaded from session day tape · no vendor call`

**License (every human print):** `Our research · not redistributed on a trader route.`

### 6. List / load layout (operator-visible)

**List** — one row per stored identity in watchlist order as locked (do not invent SPY→QQQ→IWM unless that is the lock). Two count columns, never one:

```
  Symbol  ET date     Path-A ticks              Path-B snapshots
  {SYM}   {YYYY-MM-DD}  {n_trade} trades · {n_quote} quotes   {k} snapshots
```

If Architect stores **only** trades, the Path-A cell is `{n_trade} trades` — **do not** print `0 quotes` as if quotes were in the store. If only quotes, `{n_quote} quotes`. If kinds are stored but a kind-count is not vouched, print **`path-a ticks: {n}`** without inventing a kind split.

A zero is a **number**, not the word `missing`.

**Load** — standing block, then Path-A section, then Path-B section, even when one section is an empty literal. Do not omit the empty path; omission is a silent “complete day” claim.

Path-A human summary may name fields the events already carry: `kind`, vendor timestamp, `price`, `size`, `bid`, `ask`. It must **not** relabel last-trade as the structure anchor, or quotes as trades.

Path-B human summary may name `as_of` UTC and that the payload is an options-structure snapshot. It must **not** claim live OI, OPRA quotes, or that walls/flip are a price forecast.

**CLI and HTTP print the same literals** for the same identity. Standing evidence class may differ (`local` vs `this process`).

### 7. Glossary / tooltip text (operator only)

No trader glossary. No new `/_ops` tooltips. If a human print layer annotates headers, these are the **only** explanations — they explain; they do not invent metrics:

| Term | Glossary sentence |
|---|---|
| session day tape | Research store for one locked-watchlist symbol on one America/New_York calendar date. Not a live paid session book. Not ticker playback. |
| Path-A ticks | Append-only stock-stream events (stocks WebSocket, not OPRA) that otherwise latest-wins into `price:{SYM}` and die. |
| trade | A Path-A event whose kind is `trade`. Not a quote. |
| quote | A Path-A event whose kind is `quote`. Not a trade. |
| Path-B structure snapshots | Timed options-structure snapshots persisted from the warmer’s already-fetched vendor bundle at the locked interval. Not a 48-ring capture. Not a session book. |
| no path-a ticks | The tape is storing and this identity has zero Path-A events. Distinct from not-storing, unreadable, and coverage-missing. |
| no path-b snapshots | The tape is storing and this identity has zero Path-B snapshots. Distinct from an empty 48-ring and from no session book. |
| session day tape not storing | The tape store is disabled or unavailable. Not a list of empty symbols. |
| not in tape watchlist | This symbol is outside the locked closed set. Capture was not attempted. |
| present | **Not a tape word.** On coverage, a loadable live paid session book. Tape must not print it. |
| live_massive | **Not a tape provenance token.** Session-book paid-live source only. |
| local | This CLI classified **this process’s** tape. It is not production/hosted coverage. |

### 8. Design-system / interaction (why NO_UI_CHANGE still binds)

Canon Status **SET**. No new tokens, components, patterns, arc spends, or motion. No hardcoded hex. Green/red remain **direction**, not “tape health”. Warnings in any future UI would need `warning.*` + icon — **not requested**; S2 is a log line.

Keyboard/focus/a11y: N/A for trader UI. CLI meaning must survive **plain text / CI logs** (no ANSI-only). HTTP is curl/ops JSON + optional human print; not a dashboard table widget, not LiveTape, not a research-lab canvas (`research-lab-surface` was culled).

`[single-motion-moment]` / `[theme-token-discipline]`: empty dashboard diff is the enforcement. Do not “just add” a muted caption on Ticker.

### 9. Acceptance criteria (UX-owned states + Verify by)

Actors: research operator / owner; trader (silence). Every user-visible or user-silence row maps to S0–S4. **(SB)** = ship-blocking for this feature’s honesty surface. PM may renumber into SPEC §3; marks travel with the rows. I do not invent payload keys or routes in these rows.

| # | Story | Acceptance criterion | State(s) | Verify by |
|---|---|---|---|---|
| AC-U1 **(SB)** | US-T: As the desk owner, I want zero trader chrome for tape. | `apps/dashboard` trader surfaces gain **no** new route, nav item, Settings copy, Ask-AI line, Ticker/LiveTape/Scanner/Positions/Landing affordance, tooltip, or toast mentioning session day tape, Path-A ticks, Path-B snapshots, “saved Tuesday”, or playback. | S0 unchanged | test |
| AC-U2 **(SB)** | US-T | Trader empty / error / offline / `unavailable this cycle` / `—` / LiveTape copy is **byte-unchanged** by tape persist success, persist skip, list, load, not-storing, or unreadable. Live ticks do not dim or blank because the sidecar ran or skipped. | S0 unchanged + sidecar live isolation | test |
| AC-U3 **(SB)** | US-T / Pages | Pages trader origin still **404s** `/api/_research` and `/api/_metrics` (and subpaths), including any tape sibling under those prefixes. Tape is not proxied to the trader origin. | S0 + S4 negative | test |
| AC-U4 **(SB)** | US-T / `/_ops` | `/_ops/metrics` gains **no** tape matrix, tape chip, Path-A/B counts, or stage named from this feature. If tape JSON rides `_metrics`, the existing page does **not** render it as p50/p95/headroom/`—`. | S4 unchanged | test |
| AC-U5 **(SB)** | US-O: As the operator, I want Path-A and Path-B to stay two objects. | A load of `(symbol, et_date)` prints **separate** Path-A and Path-B sections (or independently addressable reads) with distinct literals; one path’s empty does not hide or rename the other. | default both / Path-A only / Path-B only | test |
| AC-U6 **(SB)** | US-O / honesty | Operator copy never labels Path-A ticks as a session book, Path-B snapshots as a 48-ring / stored chain snapshot, or either as coverage `present`. | default + S4 negative | test |
| AC-U7 **(SB)** | US-O / honesty | `no path-a ticks…` ≠ `no path-b snapshots…` ≠ `no session day tape…` ≠ `session day tape not storing` ≠ `session day tape unreadable:` ≠ `not in tape watchlist:` ≠ coverage `missing` end-to-end. No single “no data” collapse. | all S1/S3 degraded | test |
| AC-U8 **(SB)** | US-O / honesty | Tape list/load **never** prints coverage cells `present` \| `missing` \| `not yet due` \| `blocked occupancy` as tape occupancy. | default / empty | test |
| AC-U9 **(SB)** | US-O / `present-is-live-paid-only` | A tape occupant is **never** labeled `live_massive` and is **never** inserted or described as a `present` LiveMassive session book. Reconstructed / S3 / flat-file artifacts are not tape-hit framing. | blocked reconstructed | test |
| AC-U10 **(SB)** | US-O | Coverage holes stay holes: loading or listing a tape identity does **not** change session-archive coverage classification for that `(symbol, et_date)`. | S4 vs coverage | test |
| AC-U11 **(SB)** | US-O | Successful tape read framing includes **session day tape** and **loaded from session day tape · no vendor call**, and includes **no** `live` / `LIVE` badge or “this quote is live” / playback label. | default | test |
| AC-U12 **(SB)** | US-O | Tape **read** makes **zero** Massive / vendor calls (including on empty/unreadable/not-storing/not-in-watchlist). A vouched vendor call is `[ERROR]`, not a filled dump. | default / error vendor | test |
| AC-U13 **(SB)** | US-O | Store disabled yields `session day tape not storing`, **no** all-empty tick matrix pretending to be a classified day, CLI **non-zero** `[ERROR]` if CLI exists. | error — not storing | test |
| AC-U14 **(SB)** | US-O | Unreadable identity yields `session day tape unreadable: <reason>` and is not the no-ticks literal. | error — unreadable | test |
| AC-U15 **(SB)** | US-O | Symbol outside the locked watchlist yields `not in tape watchlist: {SYMBOL}` and no fabricated Path-A/Path-B counts. | empty — not in watchlist | test |
| AC-U16 **(SB)** | US-O | Path-A persist failure logs `session day tape write skipped — path-a · trader path unchanged` and does **not** fail bundle / scan / SSE / ensure. | write skipped Path-A + S0 | test |
| AC-U17 **(SB)** | US-O | Path-B persist failure logs `session day tape write skipped — path-b · trader path unchanged` and does **not** fail bundle / scan / SSE / ensure; warmer still must not `spawn_capture` into the 48/14d ring. | write skipped Path-B + S0 | test |
| AC-U18 **(SB)** | US-O | Tape persist / read / skip **never** changes score / tier / gate / fingerprint (`Authorizes: nothing`). | S0 + isolation | test |
| AC-U19 **(SB)** | US-O | Operator HTTP (if any) is token-gated like `_metrics` / `_research` (not trader session cookie). Bad token → shipped `metrics_unauthorized` copy, not a fake empty tape. | HTTP unauthorized | test |
| AC-U20 **(SB)** | US-O / kinds | When the store vouches Path-A `trade` and `quote` counts, they print as **two** numbers with those words; a quote is never labeled a trade. When only one kind is stored, the other kind is **omitted**, not printed as `0`. | default Path-A | test |
| AC-U21 **(SB)** | US-O | CLI standing block (if CLI exists) includes **Evidence: local** and closing **local audit is not production coverage**. A local receipt is not labeled hosted/CI/production-verified. | S3 standing | test |
| AC-U22 **(SB)** | US-O | Standing block prints the **locked watchlist** and **locked Path-B interval** actually used. Missing locks → `[ERROR]`, not `WARM_SYMBOLS` / “every 25s” invented copy. | error — lock missing / default | test |
| AC-U23 **(SB)** | US-isolation | Existing session-book / ring / coverage closed strings remain on **those** vehicles and are not overwritten by tape framing (`RESEARCH READ — SESSION BOOK`, `RESEARCH READ — STORED CHAIN SNAPSHOT`, `RESEARCH READ — SESSION ARCHIVE COVERAGE` stay where they are). | S1 vs other research | test |
| AC-U24 **(SB)** | US-O | Counts print as Path-A kind counts and Path-B snapshot counts, not a bare percent completeness score. | default | test |
| AC-U25 | US-scope | SPEC §4 carries **`NO_UI_CHANGE`**; no `DESIGN_SYSTEM.md` amendment; no new tokens/components/patterns/motion. | S0 / canon | review |
| AC-U26 | US-scope | Standing-block wording, is/is-not block, glossary sentences, and banned-term table in §1 are the approved copy (intentional). | default | review |
| AC-U27 | US-O | Operator can list/load tape **without** the trader UI (CLI and/or Railway-direct operator GET). | S1 / S3 | review |
| AC-U28 | US-O | Skip and empty copy do not assert dollar loss, prune timing, Massive recoverability, open-to-close completeness, or S3 reconstruct — those are not vouched fields on this surface. | S2 / empty | review |
| AC-U29 | US-O | License one-liner present on research read: research use, not trader-route redistribution. | default | review |
| AC-U30 | US-O | Loading copy (CLI) names a **session-day-tape read**, never “fetching/refreshing from Massive”, “loading 48-ring”, or “loading session book”. | loading | review |
| AC-U31 **(SB)** | US-T / client | Trader-consumed `@convexa/api` / dashboard code does **not** grow a tape list/load operation used by Landing/Ticker/Positions/Scanner/Settings/Ask-AI. OpenAPI churn, if any, stays unconsumed on the trader path. | S0 | test |

**Method notes (risk-based):**

- **`test`** — silent regressions: trader chrome absence (structural scan / empty-diff on `apps/dashboard`), Pages 404, `/_ops/metrics` closed stage set (tape not rendered as latency), four-object and six tape-absence distinctions plus foreign coverage-missing, no `present`/`live_massive` on tape, coverage holes unchanged, zero vendor calls on read, write-skip isolation, score byte-identity, live ticks not dimmed, token gate, kind split, lock-not-invented, other research framing not overwritten, no trader client consumption.
- **`review`** — intentional copy (standing-block prose, glossary, is/is-not), SPEC §4 `NO_UI_CHANGE`, skip/empty not claiming `$398`, operator path exists without trader UI, license presence, loading phrasing.
- No DOM harness required for ship; trader silence is structural. CLI/HTTP literals asserted by unit / GATE Q. Do not invent parallel copy fixtures or a VERIFY_MATRIX.md.
- Hollow “renders without throw” does **not** satisfy the `test` marks on absence classes, LiveMassive ban, or trader negative space.

### 10. Microcopy integrity (defining failure mode)

| Claim | Vouched by | Disposition |
|---|---|---|
| Path-A tick count / kind | Store’s Path-A events for that identity; `StreamKind` | Allowed when vouched; kind omitted when not stored |
| Path-B snapshot count / interval | Store’s Path-B snapshots; locked interval | Allowed when vouched; interval printed only if locked |
| `loaded from session day tape · no vendor call` | Read path vendor counter / isolation | Allowed only if vouched |
| `no path-a ticks for S on D` | Store on; Path-A count 0 | Allowed — **not** a rename of not-storing |
| `no path-b snapshots for S on D` | Store on; Path-B count 0 | Allowed — **not** a ring miss |
| `no session day tape for S on D` | No identity; store on; in watchlist | Allowed — **not** coverage `missing` |
| `session day tape not storing` | Store disabled/unavailable | Allowed — dump withheld |
| `not in tape watchlist: S` | Locked closed set membership | Allowed |
| `Evidence: local` | This CLI process | Allowed on CLI; **banned** as a production label |
| Watchlist printed | The lock this run used | Allowed; **banned** to default `WARM_SYMBOLS` / universe / `ENSURE_SYMBOLS` without that lock |
| Tape row as coverage `present` / `live_massive` | Would falsify `present-is-live-paid-only` | **Banned** |
| “LIVE tape” / ticker playback | No playback in this BRIEF | **Banned** |
| “hist-chain” / “S3 tape” / “OPRA” | Culled or other product | **Banned** |
| “complete open-to-close” / “78% of Tuesday” | No completeness field | **Banned** |
| `$398` / `$199` on skip/empty | BRIEF motive, not a runtime field | **Banned** on S1–S3 |
| Tape as live score input | Score path must stay byte-identical | **Banned** |
| Path-B as session book / 48-ring capture | Different objects; warmer must not `spawn_capture` | **Banned** |
| Quote labeled trade | `StreamKind` | **Banned** |

### 11. Out of UX scope (hand to other lanes)

- Path-A sidecar vs second socket (Architect). I own that live ticks do not dim and that operator copy never claims a second “live feed” product.
- Path-B downsample of warmer `_vendor` vs new REST (Architect). I own that Path-B is labeled **structure snapshots at the locked interval**, never a new hist-chain product and never ring `spawn_capture`.
- Trades vs quotes volume (PM + Architect). I own that printed kinds match what is stored, and that quotes are never called trades.
- Tape-store identity / retention / body location (Architect). I own that it is **not** named session archive or 48-ring in copy.
- Provenance enum variant name (Architect). I own that it is **never** `live_massive` on tape and never coverage `present`.
- Closed watchlist membership and Path-B interval (PM). I own that they are **printed** and not defaulted in copy to `WARM_SYMBOLS` / 25s unless locked.
- Clap binary name if any; I own stdout title `session-day-tape` remaining grep-able and not an alias of `serve` / `stream-prices` / `archive-coverage` / `score-lab`.
- Whether list/load is one combined GET or two path-scoped reads (Architect). I own two **sections** (or two framings) either way.
- Whether tape JSON rides `_research` or `_metrics` (Architect). Both must stay operator-token, zero Massive on read, unlinked from trader UI, still 404 from Pages if under those prefixes. I own copy **on whichever vehicle**, and I own that `/_ops/metrics` does not grow a widget.
- Payload field names and endpoint signatures (Architect / synthesizer).
- Day-replay playback, S3 flat files, remote archive-body move, research-lab UI (explicitly out).
- Holiday calendars beyond whatever capture window PM locks.

## Risks I see

1. **Helpful Ticker playback.** Highest-probability product drift: a LiveTape “replay Tuesday” toggle, a Settings “research tape” switch, or Ask-AI citing stored ticks as live grounding. The BRIEF forbids it. AC-U1/U2/U31 exist so that impulse fails a test, not a debate.
2. **Reusing coverage `present`/`missing` on tape.** After `archive-coverage-guardrails`, those words mean live-paid session-book occupancy. Printing them on tape either (a) pretends a tape row is a paid book (`present-is-live-paid-only`) or (b) pretends a quiet Path-A day is a coverage hole. AC-U8/U9/U10.
3. **One “no data” string for six tape absences plus coverage-missing.** Operators will then “fix” no-ticks by hitting Massive, or ignore a disabled store because it looks like a quiet tape. AC-U7.
4. **Path-B labeled as session book or 48-ring snapshot.** The warmer already fetches and drops `_vendor`; `spawn_capture` is forbidden there. If copy says “captured snapshot”, P3 replay attaches to the wrong object. AC-U6/U17/U23.
5. **`live_massive` provenance leak.** Path-B bytes came from paid REST. Storing them as `LiveMassive` makes the next ensure/coverage pass treat a periodic snapshot as the day’s live paid book. The invariant exists because this feature is the obvious violator. AC-U9.
6. **Local CLI quoted as production coverage.** `[local-evidence-is-not-hosted-evidence]`. Standing **Evidence: local** is load-bearing. AC-U21.
7. **`/_ops/metrics` helpfulness.** Tape JSON on `_metrics` plus “just one card” on the latency page re-scopes into a UI-touching spec without a design-system amendment. I refuse that in R1. AC-U4.
8. **Sidecar dims live ticks.** Write backpressure, a shared lock, or a “research capture on” caption would violate `[live-vs-static-isolation]` in the only place traders look. AC-U2.
9. **Invented watchlist / 25s cadence in copy.** BRIEF cites warmer default 25s and forbids defaulting to `WARM_SYMBOLS`. Printing either as if locked is my defining failure mode. AC-U22.
10. **Quotes called trades (or a fake `0 quotes`).** Council lock is trades vs quotes volume. A single “ticks” headline that is actually quotes, or a zero for a kind we did not store, is a fabricated market claim. AC-U20.
11. **Playback framing on a store-only slice.** `RESEARCH REPLAY — NOT LIVE` is batch-backtest’s family. Using it here pretends day-replay shipped. Framing stays **SESSION DAY TAPE**.
12. **My own failure mode, named:** inventing endpoint paths, clap flags, retention numbers, completeness percents, or a coverage-style `[PASS]/[FAIL]` tape audit that treats zero ticks as a hole. If the synthesized SPEC contains tape copy that asserts a watchlist, interval, or route I authored without a vouched lock, that is a defect — those come from Architect/PM.

## Assumptions I'm making about the other two lanes

- **Architect** will persist Path-A as append-only stock `StreamEvent`s (stocks WS, not OPRA) in a store that is **not** `PriceCache` latest-wins, **not** the session archive, and **not** the 48/14d ring — and will expose those events to research list/load with `symbol`, `et_date`, and `kind` (`trade` \| `quote`) when both kinds are stored.
- **Architect** will persist Path-B as timed `VendorBundle` structure snapshots at a **locked** interval, **without** `spawn_capture` into the 48/14d ring, and **without** `insert_if_absent` as `LiveMassive` into the session archive.
- **Architect** will give Path-B tape occupancy a provenance token that is **not** `live_massive` (and not silently the existing `MarketDataSourceKind::LiveMassive` arm), so coverage `present` cannot see a tape snapshot as a live paid session book.
- **Architect** will provide operator **list and load** of tape identities on a token-gated research/ops HTTP path under the existing `/api/_research` and/or `/api/_metrics` prefixes (Pages already 404s both), **not** on a trader route, **not** on SSE, and **not** as a new dashboard widget.
- **Architect** will **not** extend `OperatorMetrics` / trader-consumed `@convexa/api` types so `/_ops/metrics` or Ticker renders tape JSON this ship (`NO_UI_CHANGE`).
- **Architect**’s tape **read** path makes **zero** Massive calls on hit, miss, not-storing, unreadable, and not-in-watchlist; a vendor call on that path is a defect, not a fallback.
- **Architect** isolates Path-A and Path-B persist failure from bundle / scan / SSE / ensure (`[best-effort-isolated-or-null]`) and keeps the Path-A sidecar from dimming or blanking live ticks (`[live-vs-static-isolation]`).
- **Architect** will not play stored ticks or snapshots into the ticker SSE / LiveTape / bundle this slice (BRIEF non-goal); load is inspect, not playback.
- **Architect** will print or return enough structure for two sections (Path-A vs Path-B) even if the wire is one identity; I will contest a single undifferentiated blob that cannot say which path is empty.
- **Architect**, if adding clap, will keep stdout titled `session-day-tape` (rename allowed) and will **not** alias `stream-prices`, `price-get`, `archive-coverage`, or `serve` as this read.
- **PM** will lock the **closed watchlist** as an explicit named set (not an implicit `WARM_SYMBOLS`, scanner universe, or `ENSURE_SYMBOLS` default) so standing copy can print it rather than invent it.
- **PM** will lock Path-B **cadence** (downsample warmer vs new REST, and the interval) so standing copy can print `{locked interval}` rather than “every 25s” from warmer default.
- **PM** will lock **trades vs quotes** (which Path-A kinds are stored) so copy can omit an unstored kind instead of printing a fabricated zero.
- **PM** will **not** add trader UI, ticker playback, a `/_ops` tape widget, research-lab chrome, S3 flat-file keep, or a coverage-style tape matrix that reuses `present`/`missing` this ship; SPEC §4 will carry `NO_UI_CHANGE`.
- **PM** accepts that a stored Tuesday tape does **not** fill session-archive coverage holes, and will not require tape list/load to print coverage cells or to authorize a score change.
- **PM** accepts the six tape absences (no-ticks / no-snapshots / no-identity / not-storing / unreadable / not-in-watchlist) plus foreign coverage-missing as product states required by `[absent-is-not-none]`, not as UX gold-plating — including that zero Path-A ticks is **not** a `[FAIL]` coverage hole.
- **PM** will fold these AC-U rows into SPEC §3 with the `Verify by` marks intact, and will not replace `test` on trader negative space, absence classes, `live_massive`/`present` bans, Pages 404, or write-skip isolation with `review`.
- **PM** will not ask skip/empty/load copy to assert `$398`, open-to-close completeness, prune TTL, or Massive recoverability — those stay in research prose, not runtime copy.
