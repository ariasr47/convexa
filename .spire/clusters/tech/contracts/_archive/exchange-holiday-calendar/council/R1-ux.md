# R1 — ux position: exchange-holiday-calendar

## Position

### 0. What this surface is (and is not)

This is **occupancy honesty on NYSE full-day holidays**, not a calendar product. The operator (and the desk) must trust that a closed weekday is the same class Sat/Sun already are: **not due / ineligible** — not a missing paid book, not an empty extract, not a coverage hole, not an ensure wake, not a live RTH session.

The attach point is the **already-shipped weekend path**. I am not designing a holiday widget, a named-holiday glossary, a trader nav item, a `/lab` page, or a second occupancy language.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` is **Status: SET** — The Curvature Terminal. This feature **adheres**. I do **not** restate the token table. I request **no amendment**: no new tokens, no new shared component, no fourth convex arc, no new keyframe family, no hardcoded hex, no success/error tint on occupancy, no holiday chip palette. Mode-aware values stay on `extrasFor(theme)` / `elevationFor(theme)`. Occupancy is not signed direction.

**Authorizes: nothing.** Score, tier, fingerprint, and `opportunity_score` are not this feature. Pages trader origin still 404s `/api/_research`. `/lab` stays instrument demos. `present` remains a loadable `LiveMassive` body only.

**Half-days (early close): Future.** An early-close weekday still has a session. Treating it as full-day `not_due` / `closed` at 10:00 ET is a fabricated claim. This slice is **NYSE full-day** membership only.

### 1. Intended user, primary job, information structure, vocabulary

- **Intended users:** (1) the research operator on `/_ops/research` and the tape/keep CLIs; (2) the desk on existing Ticker chrome and Scanner session badge. **Not** a new audience. **Not** a `/lab` visitor.
- **Primary job:** *On a known NYSE full-day holiday ET date D, read occupancy as weekend-class empty expected / ineligible — and on the desk, read the session as Closed, not as a lagging RTH feed.*
- **Failure I am designing against:** copy that asserts a meaning the data does not support — especially `missing` / `[PASS]` / `empty extract` / `miss` on a holiday weekday; the word **`weekend` printed for a Thursday**; ticker copy that still blames **holiday as feed lag** once holidays are a closed session; a sixth coverage cell named `holiday`; `present` on anything that is not a loadable LiveMassive body.

**Information structure (no new regions):**

1. **Operator coverage card** (existing `/_ops/research`) — one ET date D. Holiday D uses the **same empty-expected presentation Sat/Sun already use**. No holiday name line. No new card.
2. **Tape / keep operator prints** (existing CLIs + research envelopes) — ineligible class, not miss, not empty-extract success. Weekend literals stay on Sat/Sun. Holiday weekdays get **holiday-honest** sibling literals. Internal type names do not print.
3. **Ticker connection chip** (existing `liveStatus`) — holiday weekday lands on the **closed** branch. The lag branch must stop naming holiday.
4. **Scanner session badge** (existing `SESSION_LABEL`) — **`Closed`**, not a fifth phase `Holiday`, not `RTH` at 10:00 ET.
5. **Trader silence** — Landing, Positions, Settings, Ask-AI, TopNav, `/lab` grow nothing. No holiday calendar on the Command Deck.

**Closed occupancy decks I will not rename**

| Deck | Members that may appear | Holiday D is |
|---|---|---|
| Coverage **cells** | `present` · `missing` · `unreadable` · `not yet due` · `blocked occupancy` | **none of these.** Empty expected. Not a sixth cell. |
| Coverage **verdict** | `pass` · `fail` · `not_due` | **`not_due`** |
| Coverage **framing** (HTTP, already on-screen for weekends) | `RESEARCH READ — SESSION ARCHIVE COVERAGE` · `RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES` | the **NO EXPECTED IDENTITIES** framing (it does not say weekend — keep it) |
| List/load **source** | `live_massive` · `fixture` · `session_tape` | unchanged; never `present` / `kept` |
| Keep occupancy tokens | existing closed set including **`ineligible weekend`** | sibling **`ineligible holiday`** — not `miss`, not `empty extract`, not `kept`, not `present` |
| Tape list `days[].clock` | `partial` · `through-window · not certified` · `ineligible weekend` | sibling **`ineligible holiday`** |
| Scanner session phase | `rth` · `pre` · `after` · `closed` | **`closed`** (label **`Closed`**) |
| Ticker `market_session` consumed today | `premarket` · `regular` · `afterhours` · `overnight` · `closed` | **`closed`** at 10:00 ET on D |

I do **not** invent a coverage cell `holiday`. I do **not** print `ineligible weekend` for a full-day holiday weekday. I do **not** print `ineligible holiday` for Saturday or Sunday. A holiday that *falls on* Sat/Sun remains weekend copy; Sat/Sun behavior is unchanged.

Holiday **names** (Thanksgiving, Christmas, …) are not on-screen unless a vouched name field exists. I assume the closed set is dates, not a named calendar UI. Fixture dates in criteria (e.g. a Thursday that the set contains) identify D; they are not labels.

### 2. Fields the UI consumes (existing; not invented)

I do not name new JSON keys or endpoints. Surfaces read what they already read.

**Coverage card** (`CoverageOkBody`, already consumed): `framing`, `command`, `evidence`, `symbols`, `et_date`, `checkpoint`, `vendor_called`, `authorizes`, `verdict`, `expected_due`, `present`, `missing`, `unreadable`, `not_yet_due`, `blocked_occupancy`, `rows[]` (`symbol`, `et_date`, `cell`, `last_readable`), `holes[]` (`symbol`, `et_date`, `class`).

Holiday D must arrive as the **weekend-class empty-expected envelope**: `verdict: not_due`, `framing` = `RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES`, `expected_due: 0`, `present/missing/unreadable/not_yet_due/blocked_occupancy` all `0`, `rows: []`, `holes: []`. The card already keys no-row / no-verdict chrome off `verdict === 'not_due'`. That branch is the holiday presentation — provided the envelope is empty-expected, **not** three `missing` rows with `verdict: fail` or `pass`.

Do **not** add a wire boolean named `weekend` that is true on Thanksgiving. The HTTP card does not receive that field today; the on-screen weekend framing string is already class-level. A future weekday that is `not_due` because cells are `not yet due` (rows present, framing **without** the no-expected suffix) is a different envelope — the operator page does not query future dates today; do not collapse that case into holiday chrome.

**Ticker chip** (`LiveUpdate`, already consumed): `live`, `market_session`, `mid`, `feed`. On holiday D at 10:00 ET the chip must see `live: false` and `market_session: 'closed'` so `liveStatus` takes the closed branch. I do not add `holiday: true` to SSE.

**Scanner badge** (`marketSessionPhase(nowMs)`): today a client America/New_York clock — Sat/Sun → `closed`, weekday 10:00 → `rth`. That clock is a weekend gate. It must consume the **same NYSE full-day holiday membership** the other weekend gates consume so Thanksgiving 10:00 ET is `closed`. I do **not** invent `GET /api/holidays` or a bundle field for this. Membership is the closed in-process set (BRIEF: no vendor fetch). How Architect shares that set into the dashboard clock is a module boundary I do not own; the **observable** is the badge.

**Tape / keep:** operator-facing `framing` + `detail` + occupancy / clock tokens. Fields already printed. Holiday uses the sibling literals in §8.

### 3. Component state matrix

Baseline operator / ticker / scanner states already exist. Holiday is **not** a new page state. It is a **nested occupancy / session classification** that must not land in the wrong existing state.

#### S3 — Coverage card (`/_ops/research`)

Weekend `not_due` is already first-class empty-of-expected (framing `NO EXPECTED IDENTITIES`; hide per-row cells and the verdict token so `[PASS]` cannot appear). Holiday D uses **that nested state**. The local implementation name `weekend` is not user-facing; user-facing copy must not say weekend on a holiday weekday.

| State | When | Operator sees | Can do next | Must not happen |
|---|---|---|---|---|
| **unauthorized / loading / error / offline / stale / withheld / invariant-fault** | unchanged from research-lab-surface | unchanged copy | unchanged | Holiday is not a lock, not a store fault, not three `missing` cells |
| **default (due weekday)** | D is an ET weekday **not** in the full-day holiday set; identities due | Existing coverage framing · counts · rows · `verdict` `pass`\|`fail` · `present` is the only load button | Open `present`; switch SPY/QQQ/IWM | Treating D as `not_due`; inventing a holiday caption |
| **nested not-due (empty expected)** | `verdict: not_due` **and** empty-expected envelope (Sat/Sun **or** NYSE full-day holiday D) | Framing **`RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES`**. Command / evidence / symbols / checkpoint unchanged. Counts line of zeros is honest. **No** row stack. **No** verdict token (`pass` / `fail` / `not_due` all withheld — framing carries the claim). Closing **`SESSION ARCHIVE COVERAGE — NOT A FILL · Authorizes: nothing`**. | Read the books list (independent vehicle). Retry. | Three `missing` cells; `[PASS]`; success-green; printing `weekend` on a holiday Thursday; printing `holiday` as a coverage **cell**; labeling zeros as `present`; hosted/CI evidence |
| **nested not-yet (future weekday)** | `verdict: not_due` but framing is the ordinary coverage framing and rows are `not yet due` | Existing due-matrix chrome with `not yet due` cells (not this feature’s holiday path) | Wait for checkpoint | Hiding those rows behind no-expected framing (today’s FE `verdict === 'not_due'` footgun — do not extend it; key empty-expected off **empty rows + no-expected framing**, not the verdict alone, if this card ever shows a non-today D) |

Books list / digest states are **unchanged**. A holiday date with no stored LiveMassive book is ordinary empty/miss of that vehicle, not a new “holiday empty.” Coverage `not_due` must not be paraphrased onto the books table as `present` or `kept`.

#### Ticker connection chip

| State | When | Desk sees | Must not happen |
|---|---|---|---|
| **live** | `live.live` and a covered session | existing `● live · …` | Holiday 10:00 ET in this state |
| **closed** | `live.live === false` and `market_session === 'closed'` (weekend **or** full-day holiday) | label **`○ market closed`** (+ last mid if present). Tip **`Market is closed (weekend/holiday). Showing the last completed session.`** Neutral tone (not warning-as-lag, not success). | Inventing a `Holiday` chip; warning-orange because “holiday”; green “session complete” |
| **overnight** | existing | existing overnight tip (Massive 4 AM–8 PM) | Using overnight copy for a holiday RTH clock |
| **no live ticks (lag)** | `live.live === false`, session is a **covered** session, not overnight, not closed | label **`○ no live ticks`**. Tip **must drop holiday.** Exact replacement: **`In a covered session but no ticks are arriving — the feed may be lagging.`** Warning + icon (true warning: feed lag). | **`or it is a market holiday`** — that clause is a fabricated alternative once holidays classify as `closed` |
| **stream offline / session-tape standing** | existing | existing | Holiday is not a tape phase; replay occupancy unchanged |

Existing closed-session treatments that **consume** `market_session === 'closed'` (mark ladder freeze, no modeled ticks, reassessment suppression, no live-cross fills) apply automatically. I add **no** holiday-specific freeze label. SIMULATED framing stays as shipped.

#### Scanner session badge + board

| State | When | Desk sees | Must not happen |
|---|---|---|---|
| **badge Closed** | ET Saturday/Sunday **or** NYSE full-day holiday (any clock hour that would otherwise be pre/rth/after) | **`Closed`** (`SESSION_LABEL.closed`). `aria` remains **`US equity session`**. | A fifth label `Holiday`; `RTH` at 10:00 ET on D; the word `live` on the table |
| **badge RTH / Pre / After** | ordinary weekday **not** in the full-day set | existing labels | Half-day Future: still these phases until a later early-close class exists |
| **idle ≠ worker-down** | scanner market-hours gate idles like a weekend (BRIEF) | Last-known rows stay. **No** `scan-worker-down` banner **if weekend idle does not show one**. Cadence header copy is methodology (`Prices live · structure ~3 min…`) — do not retune it into a holiday sentence. | Holiday idle presenting as **`Sweep last ran … ago — showing the last known rows.`** solely because the slow lane slept; a new “market holiday — scanner paused” banner |

### 4. Flows (no new journeys)

1. Operator unlocks `/_ops/research` as today. Coverage GET for default D. If D is a full-day holiday: nested not-due. If D is a normal weekday: default matrix. Sat/Sun: nested not-due, copy unchanged.
2. Operator keep / tape CLI on holiday D: ineligible-holiday print; process does not treat zero rows as empty-extract success; does not print miss.
3. Desk opens `/ticker/SPY` at 10:00 ET on D: connection chip **closed**, last completed session, not lag-warning-as-holiday.
4. Desk opens `/scanner` at 10:00 ET on D: badge **Closed**; board is last-known structure; not worker-down theater.
5. Next ordinary weekday: due/eligible/RTH as today.

No keep/ensure/fill button. No “acknowledge holiday.” No nav.

### 5. Design-system application (not a second system)

- **Canon:** The Curvature Terminal. Operator chrome stays metrics-sibling (`AppBar`, outlined `read-only`, `Alert`, dense table, token-only). Ticker chip stays the existing stream-driven status (not a toggle). Scanner badge stays the existing desk strip.
- **Hierarchy:** occupancy class before counts; session closed before lag; scanner badge is session truth, cadence line is methodology.
- **Type:** IBM Plex Sans for chrome; IBM Plex Mono for occupancy tokens, `et_date`, counts, `verdict` (Convexa-asserted payload). Holiday does not mint a new figure that needs the untraced-sans carve-out.
- **Color:** occupancy / `not_due` / `Closed` are **not** P/L. No success green on empty-expected. Lag remains `warning.*` + icon. Closed chip stays **neutral/default**, as shipped for weekends.
- **Motion:** none new. Honor `useReducedMotion` vacuously. Live-dot pulse stays gated on genuine live — holiday closed must not pulse.
- **A11y:** closed vs lag is **label + tooltip**, not color alone. Scanner badge already has `sessionAria`. Coarse-pointer 44px floor unchanged (no new controls). 393px: no extra holiday row that overflows. Chip/label text stays ≥11px.
- **No DESIGN_SYSTEM amendment.** Sibling `ineligible holiday` literals are occupancy-deck copy on existing operator vehicles, not a new shared pattern.

### 6. Copy integrity locks

- **`present` = loadable LiveMassive only.** Holiday never `present`.
- **`kept` ≠ `present`.** Holiday keep is not `kept` unless a real extract was stored on a due day — and holiday D is not due.
- **`missing` ≠ ineligible.** Three `missing` cells on Thanksgiving is the hole this feature exists to close.
- **`empty extract` ≠ ineligible.** The keep test `holiday_weekday_zero_rows_is_empty_extract_not_weekend` currently **documents the lie**. After this feature that outcome is forbidden: holiday weekday is ineligible, not a content-hit empty extract.
- **`miss` ≠ ineligible.** Tape/keep must not print miss for D.
- **`weekend` is a calendar fact, not a synonym for ineligible.** Printing `ineligible weekend` on a full-day holiday weekday is a silent rename. Printing `ineligible holiday` on Saturday is the same failure in reverse.
- **Ticker lag tip must not name holiday.** Cited live copy today: *“In a covered session but no ticks are arriving — the feed may be lagging, or it is a market holiday.”* After a calendar exists, holiday is not a covered session. Withdraw the clause.
- **Closed tip may keep `weekend/holiday`.** Cited live copy: *“Market is closed (weekend/holiday). Showing the last completed session.”* That sentence becomes true; do not “upgrade” it to a holiday name.
- **`[PASS]` stays banned on the HTTP card** (`BANNED_ON_SCREEN`). CLI `[NOT DUE] … Not a coverage pass.` stays the local-evidence line for empty-expected, including holiday D. Do not put the CLI `[NOT DUE]` wrapper on the HTTP card (wrong evidence class) — the HTTP card already uses no-expected framing instead.
- **No holiday name, no vendor, no “NYSE.com”.** Closed in-process set. Copy may say **holiday** as a class on operator keep/tape prints; it may not cite a feed that was not called.

### 7. Acceptance criteria → states, with Verify-by

User-visible / occupancy-visible criteria I need in SPEC §3. PM owns story wording; I own state homes and **Verify by** so frontend never chooses the requirement set.

Canonical holiday weekday D in oracles is **a Thursday (or other weekday) the closed set contains** — not Independence Day 2026 (Saturday). Sat/Sun oracles stay Sat/Sun. Ordinary weekday oracle stays a non-holiday weekday (e.g. 2026-08-10).

| # | Criterion (observable) | State(s) | Verify by | Why |
|---|---|---|---|---|
| 1 | On holiday weekday D, coverage HTTP/UI is `verdict: not_due`, framing **`RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES`**, `expected_due: 0`, empty `rows` / `holes`, counts all zero. | coverage nested not-due | **test** | Silent return to three `missing` cells. |
| 2 | That card does **not** print `[PASS]`, `pass`, or per-symbol `missing` / `present` / `unreadable` / `blocked occupancy` cells. | nested not-due | **test** | Vacuous pass / hole theater is invisible on a copy skim. |
| 3 | Coverage **cell** deck remains exactly `present` \| `missing` \| `unreadable` \| `not yet due` \| `blocked occupancy` — no member `holiday`. | default + nested not-due | **test** | Closed deck; rename is silent. |
| 4 | `present` still means a loadable LiveMassive body; holiday D never labels `present` / `kept` / `LiveMassive`. | nested not-due / books | **test** | `[present-is-live-paid-only]`. |
| 5 | Ordinary non-holiday weekday remains due/eligible coverage (rows exist; not empty-expected framing). | coverage default | **test** | Over-closing weekdays is silent. |
| 6 | Sat/Sun coverage presentation and weekend keep/tape literals are **byte-identical** to pre-feature weekend oracles. | nested not-due (weekend) | **test** | Weekend regression. |
| 7 | Keep on holiday D prints framing **`RESEARCH READ — MASSIVE FLAT FILES INELIGIBLE HOLIDAY`**, detail **`flat files ineligible holiday: {D}`**, occupancy token **`ineligible holiday`**. Not `miss`, not `empty extract`, not `ineligible weekend`. | keep ineligible | **test** | Current keep test locks the opposite lie. |
| 8 | Tape on holiday D prints framing **`RESEARCH READ — SESSION DAY TAPE INELIGIBLE HOLIDAY`**, detail **`session day tape ineligible holiday: {SYMBOL} on {D}`**, list clock **`ineligible holiday`**. Not miss, not `ineligible weekend`. | tape ineligible | **test** | Closed clock set; silent rename. |
| 9 | CLI coverage empty-expected (weekend **or** holiday) still uses **`[NOT DUE] archive-coverage — no expected weekday identities due in this window. Not a coverage pass.`** — never `[PASS] n/n`. | CLI nested not-due | **test** | Vacuous pass. |
| 10 | At 10:00 ET on holiday D, ticker `liveStatus` is the **closed** state (label `○ market closed`), not live, not overnight, not lag. | ticker closed | **test** | Session class is silent in screenshots of the mid. |
| 11 | Closed tooltip remains **`Market is closed (weekend/holiday). Showing the last completed session.`** | ticker closed | **review** | Intentional copy; human notices a rewrite. Pair with AC-10’s branch test. |
| 12 | Lag tooltip is **`In a covered session but no ticks are arriving — the feed may be lagging.`** — substring **`holiday` absent**. Holiday D at 10:00 ET does not take this branch. | ticker lag / closed | **test** | Re-introducing the holiday-as-lag clause is a silent integrity regression. |
| 13 | Scanner badge at 10:00 ET on holiday D is **`Closed`**, not `RTH`. Ordinary weekday 10:00 ET remains `RTH`. Sat/Sun remains `Closed`. | scanner badge | **test** | Client clock will silently keep saying RTH. |
| 14 | Scanner holiday idle does not engage `scan-worker-down` if weekend idle does not. Last-known rows remain. | scanner idle ≠ down | **test** | False worker-down on Thanksgiving is silent if rows still paint. |
| 15 | No new trader nav item; `/lab` still `data-testid="lab-index"`; `/_ops/research` stays off-shell; Pages `_research` still 404s. | S0 trader silence | **test** | Product swap / path leak. |
| 16 | Half-day (early close) weekday at 10:00 ET is **not** coverage `not_due` empty-expected and **not** ticker/scanner full-day Closed solely from the full-day set. | default / Future lock | **test** | Over-classification is silent. |
| 17 | Coverage `fail` / unreadable / not-storing still warning+icon; `not_due` / `Closed` are not success-green or direction-red. | default / nested not-due / closed | **review** (color) + **test** if palette class identity is asserted in jsdom | Visible color vs silent class. |
| 18 | AppBar / coverage standing / closing / `Evidence: this process` / `Authorizes: nothing` strings unchanged except the empty-expected framing already shipped. | nested not-due | **review** | Intentional copy presence. |
| 19 | Ensure does not wake SPY/QQQ/IWM on holiday D; operator coverage still `not_due` (not `missing` as if ensure failed). | nested not-due | **test** | Ensure wake is off-UI; occupancy lie is the operator-visible symptom. |
| 20 | `opportunity_score` / tier / `state_fingerprint` byte-identical; no ticker bundle field this slice invents. | S0 | **test** | Additive invariant; silent score drift. |

**Harness note (H3):** dashboard already uses Vitest + jsdom and Playwright. Occupancy tokens, session classification, nav/path negative space, and the lag-tip substring are **test**. Paint/focus-ring polish stays **review**. Load-bearing holiday membership for the scanner clock belongs in a **pure function** (same shape as `marketSessionPhase`) so unit tests do not need DOM.

### 8. Copy deck (exact strings)

**Coverage HTTP/UI (holiday D = weekend-class empty expected)**

- Framing: `RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES`
- Command: `Command: archive-coverage`
- Evidence: `Evidence: this process`
- Symbols: `Symbols: SPY · QQQ · IWM`
- Checkpoint: `Checkpoint: after 16:00 America/New_York`
- Counts: `Expected due: 0 · present: 0 · missing: 0 · unreadable: 0 · not yet due: 0 · blocked occupancy: 0`
- Closing: `SESSION ARCHIVE COVERAGE — NOT A FILL · Authorizes: nothing`
- CLI (local evidence): `[NOT DUE] archive-coverage — no expected weekday identities due in this window. Not a coverage pass.`

**Keep (holiday weekday D only)**

- Framing: `RESEARCH READ — MASSIVE FLAT FILES INELIGIBLE HOLIDAY`
- Detail: `flat files ineligible holiday: {et_date}`
- Occupancy token: `ineligible holiday`
- Weekend D unchanged: `RESEARCH READ — MASSIVE FLAT FILES INELIGIBLE WEEKEND` / `flat files ineligible weekend: {et_date}` / `ineligible weekend`

**Tape (holiday weekday D only)**

- Framing: `RESEARCH READ — SESSION DAY TAPE INELIGIBLE HOLIDAY`
- Detail: `session day tape ineligible holiday: {symbol} on {et_date}`
- List clock: `ineligible holiday`
- Weekend unchanged: `RESEARCH READ — SESSION DAY TAPE INELIGIBLE WEEKEND` / `session day tape ineligible weekend: {symbol} on {et_date}` / `ineligible weekend`

**Ticker**

- Closed tip (keep): `Market is closed (weekend/holiday). Showing the last completed session.`
- Lag tip (replace): `In a covered session but no ticks are arriving — the feed may be lagging.`
- Closed label (keep): `○ market closed`

**Scanner**

- Badge: `Closed`
- No new banner copy this slice.

**Banned on these surfaces**

- `[PASS]` · coverage cell `holiday` · `ineligible weekend` on a holiday weekday · `ineligible holiday` on Sat/Sun · `empty extract` as holiday success · `miss` as holiday absence · ticker lag naming holiday · `RTH` at 10:00 ET on D · `present` / `kept` / `LIVE` as holiday occupancy · `$398` · hosted/CI on `evidence: this process` · a holiday **name** without a vouched field · new trader nav · `/lab` corpus chrome

### 9. Out of scope (named so they cannot sneak in as polish)

- NYSE **half-days** / early close as ineligible or Closed at 10:00 ET.
- A named holiday calendar UI, tooltip glossary of Thanksgiving/Christmas, vendor fetch, or `/api/holidays`.
- New trader nav, Command Deck pin, Settings pref, Ask-AI holiday clause, morning note.
- Occupying `/lab`. Lifting Pages `_research` 404.
- Retuning `opportunity_score`. Ensure/scanner **UI** consoles.
- Tape / keep **tables** on `/_ops/research` (still absent; prints stay on their vehicles).
- Renaming coverage `not_due` or weekend no-expected framing to include the word weekend (it correctly does not).
- A fifth scanner phase `Holiday`.
- DESIGN_SYSTEM token / motion / arc amendments.

---

## Risks I see

1. **Weekend-print on a Thursday.** Architect unifies holiday into `IneligibleWeekend` / `is_et_weekend` and keep/tape continue to print `ineligible weekend`. Operators will not trust the calendar. That is this lane’s defining failure mode.
2. **Sixth coverage cell `holiday`.** Looks like honesty; it is a closed-deck break and a synonym for `not_due` empty-expected. I will not agree.
3. **Ticker lag clause left in place.** Header already *mentions* holiday without a calendar. Shipping a calendar without deleting that clause leaves the fabricated alternative on the desk.
4. **Scanner client clock not consuming the set.** Backend idles; badge still says `RTH`. Desk occupancy-adjacent lie. If Architect refuses to share membership into `apps/dashboard` without a new endpoint I did not invent, this is an R2 technical conflict.
5. **Holiday idle trips worker-down.** Slow lane sleeps; `updated_at` ages past 180s; banner claims the sweep is behind. Weekend idle already had this trap; holiday must reuse that idle heartbeat path.
6. **FE `verdict === 'not_due'` over-match.** Today it hides rows for every `not_due`, including a future weekday envelope that still has `not yet due` rows. Holiday must key off **empty-expected framing + empty rows**, not widen the footgun.
7. **Half-days silently in-scoped** as full-day Closed / `not_due`. Fabricated “no session” on a short session.
8. **Keep hole-test left green.** `holiday_weekday_zero_rows_is_empty_extract_not_weekend` currently asserts the defect. If it is not inverted, the suite certifies the lie.
9. **Holiday names without a field** (“Closed — Thanksgiving”) — copy with no vouched source.
10. **Success-green empty-expected** (“all clear, no holes”) — `not_due` is not a pass; CLI already says so.

---

## Assumptions I'm making about the other two lanes

- **Architect** ships **one** in-process America/New_York **full-day** holiday predicate (no vendor fetch, no holiday crate already in `Cargo.toml`) and **every existing weekend gate consumes it**: `MarketPhase::classify`, coverage `is_et_date_weekday`, ensure `is_et_weekday`, tape `is_et_date_weekday`, keep `is_et_weekend`, scanner `should_sweep`, and the dashboard scanner clock. I can name the consumed session/occupancy **fields above**; I am not choosing the module path.
- **Architect** makes coverage on holiday D **the same HTTP envelope as Sat/Sun**: `verdict: not_due`, framing `RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES`, `expected_due: 0`, empty `rows`/`holes` — not `pass`, not three `missing` cells, not a new `holiday` cell, not a new coverage key the card must learn this slice.
- **Architect** makes `MarketPhase::classify` at 10:00 ET on holiday D return **not** `Rth` (BRIEF: not `rth`); the ticker SSE `market_session` the chip already reads is **`closed`**, so existing `liveStatus` / mark-freeze / no-live-cross closed branches fire without a new SSE field.
- **Architect** does **not** print keep/tape **`weekend`** literals for a holiday weekday. Either they emit the sibling strings in §8 or they propose a unified print that does **not** contain `weekend` on a Thursday — I will R2 a Thanksgiving line that says `ineligible weekend`.
- **Architect** inverts the keep oracle `holiday_weekday_zero_rows_is_empty_extract_not_weekend`: after this feature, holiday D is ineligible, **not** `Occupancy::EmptyExtract`. Poisoning holiday D back to a due weekday (missing / empty extract / RTH / ensure-wake) makes the build red.
- **Architect** shares full-day membership with the **dashboard** scanner clock without a new trader HTTP resource (closed set, same as backend). If they require `GET /api/holidays` or a bundle calendar, that is out of my lane and I will not invent it — I will R2 the badge remaining `RTH`.
- **Architect** keeps scanner **idle heartbeats** on holiday the way weekend idle already avoids a 180s worker-down false alarm; ensure does not wake SPY/QQQ/IWM; tape/keep skip GET like weekend; `[single-ticker-on-demand]` holds.
- **Architect** leaves **half-days out of the full-day set**. Christmas Eve 10:00 ET remains a session for coverage/ticker/scanner this slice.
- **PM** does not re-scope this into a named holiday calendar, a trader nav item, `/lab`, Pages `_research` proxy, or an `opportunity_score` change (`Authorizes: nothing`).
- **PM** prices **half-days as Future**, not In. Early close is a distinct class; I will not write `not_due` copy for it.
- **PM** accepts **sibling** keep/tape occupancy tokens `ineligible holiday` (closed-deck amendment on those vehicles only) rather than overloading `ineligible weekend` or adding a coverage cell `holiday`.
- **PM** writes SPEC §3 rows that match BRIEF observed-by (coverage `not_due` empty-expected, tape/keep ineligible not miss/empty-extract, MarketPhase not `rth` at 10:00 ET, ensure off, scanner idles, normal weekday due, Sat/Sun unchanged) and leaves my **Verify by** marks in the table — frontend implements those cases; it does not choose the set.
- **PM** does not require on-screen holiday **names** or a count of “how many holidays this year” (no vouched field).
- **PM** treats Ticker lag-copy withdrawal and Scanner `Closed` badge as **in scope** desk honesty, not as a new surface — still no new nav.
