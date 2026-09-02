# R1 — ux position: research-lab-surface

## Position

### 0. What the surface actually is (and what it is not)

This is the **first operator dashboard** for the already-stored research corpus. The BRIEF’s observed job is: from a dedicated operator URL (pattern of `/_ops/metrics`), with the **metrics token** (not a trader cookie), **list SPY session books and open one dated book without starting Massive**. It is **not** the public `/lab` instrument-demo hub, **not** a trader nav item, **not** a Pages proxy of `_research`, **not** score-lab HTTP, **not** a second ticker replay player, **not** a morning-note product, **not** a keep/fill/ensure console.

Previous ships (`session-chain-archive`, `archive-coverage-guardrails`, `session-day-tape-capture`, `massive-flat-file-keep`) were `NO_UI_CHANGE` and explicitly deferred “research-lab UI.” This BRIEF **is** that deferred surface. I am not folding coverage into `/_ops/metrics`, and I am not occupying `/lab`.

`[operator-vs-trader-path-separation]` is HARD: own route, unlinked from trader nav, **off `AppShell`**, read-only, no vendor fetch / recompute / cache mutation / trader-route call. Pages trader origin still **404s** `/api/_research`. `[present-is-live-paid-only]` is HARD on every label. `[server-side-gate-enforcement]`: the metrics token is the gate; a trader session cookie is not. `[no-secrets-in-image]`: the token value never appears in copy, URLs, logs, or aria. `[absent-is-not-none]`: miss ≠ empty ≠ not-storing ≠ unreadable ≠ unauthorized. `[digested-labels-not-raw-dump]`: opening a book is an **identity digest**, not a chain dump. `[additive-keeps-score-byte-identical]`: the standing chip is **`Authorizes: nothing`**, from the payload field, not a slogan.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` is **Status: SET** — The Curvature Terminal. This surface **adheres**. I do **not** restate the token table. I request **no amendment** this slice: chrome clones `/_ops/metrics` (own `AppBar`, outlined `read-only` chip, `Container`, `Alert`, dense `Table`, `Chip`, `TextField`). No fourth convex arc, no new keyframe family, no hardcoded hex, no success/error tint on occupancy, no LabIndex hover-lift. Mode-aware values go through `extrasFor(theme)` / `elevationFor(theme)`.

**v1 vehicle lock (UX):**

| Vehicle | v1 on this screen? | Why |
|---|---|---|
| **Session books list + load** | **Yes — spine** | BRIEF observed-by. Occupancy of this vehicle is identity + `source` provenance, not coverage cells. |
| **Session-archive coverage** | **Yes — only admitted sibling** | Same prune-proof books, closed cells the operator already reads from `archive-coverage`. Answers “is today’s SPY book `present`?” without a CLI binge. |
| Session-day tape | **No** | Different occupancy deck (`not_storing` / `storing_ready` / Path-A clocks). Not a live paid book. Replay is out. |
| Chain snapshots (48/14d ring) | **No** | Different miss string (`no stored snapshot for <SYMBOL>`). Must never borrow session-book miss copy. |
| Flat-file extracts | **No** | Occupancy is **`kept`**, never `present` / `LiveMassive`. Mixing extract rows onto a coverage matrix is this feature’s defining integrity failure. |

If Architect/PM admit tape / snapshots / extracts onto this URL in v1, that is an R2 `product` conflict unless each vehicle is a **visually partitioned** region that prints **only its own closed deck**. I will not agree to a unified “status” column.

**Surfaces I own:**

| # | Surface | Who | Ownership |
|---|---|---|---|
| S0 | **Trader silence** — Landing, Ticker, Positions, Scanner, Settings, Ask-AI, `TopNav`, `/lab`, Pages trader origin | every trader | no operator entry, no corpus badge, no “Tuesday’s book”, no `/lab` hijack |
| S1 | **Operator chrome** — URL-only sibling of `/_ops/metrics`, off shell | research operator | title, `read-only` chip, token gate, no trader cookie, no token in copy |
| S2 | **Session-books list + load digest** | research operator | list rows, miss/empty/not-storing/unreadable copy, load digest fields, no chain dump, no `present` on list `source` |
| S3 | **Coverage matrix** (sibling card) | research operator | exact cells, last-readable, holes, verdict, evidence class, HTTP closing line |
| S4 | **Negative space** — `/lab`, `/_ops/metrics` internals, score-lab, replay player, keep CLI | anyone there | this page does not become those products; those products do not grow this chrome |

### 1. Intended user, primary job, information structure, vocabulary

- **Intended user:** the research operator / owner who already types `/_ops/metrics`. **Not** the anonymous or signed-in trader. **Not** a `/lab` visitor.
- **Primary job:** *Unlock with the metrics token, see whether this process has SPY (and the liquid trio) session books, open one dated book as a research read with zero Massive, and read today’s coverage cells without renaming `present` or treating a local matrix as hosted coverage.*
- **Failure I am designing against:** copy that asserts a meaning the payload does not support — especially `present` on an extract or tape row, `kept` as a synonym for `present`, `live` as a market-feed badge on `source: live_massive`, a chain dump billed as “the book”, `$398` on screen (BRIEF cost, not a field), or `Evidence: this process` labeled hosted/CI.

**Information structure (always this order):**

1. **Operator AppBar** — title · `read-only` · `Authorizes: nothing` (from payload once a body exists; withheld while locked).
2. **Token gate** (when the server requires it) — before any corpus claim.
3. **Standing / framing** from the envelope (`framing`, `provenance`, `license`, `vendor_called`, `authorizes`) — before any row.
4. **Symbol scope** — closed chips **SPY · QQQ · IWM**, default **SPY** (BRIEF observed-by). Coverage always shows the trio; the chips select the books list.
5. **Coverage card** (sibling) — one ET date D, cells, last readable, counts, holes, verdict.
6. **Books list** — dated rows for the selected symbol; columns are payload names, not coverage cells.
7. **Load digest** — one identity; counts of arrays; **never** `market.contracts[]` rendered.

**Route (UX lock):** `/_ops/research`. Sibling of `/_ops/metrics`, declared **outside** `<AppShell/>`, **unlinked** from `TopNav` (existing comment: “Deliberately NO operator entry”). **Forbidden:** `/lab`, `/lab/*`, in-shell routes, `/_research` as a dashboard path, a Pages Function proxy. Architect may rename the `/_ops/…` suffix; they may not land it on `/lab` or inside the shell.

**Token UX (UX lock):**

- Same gate as metrics: `Authorization: Bearer …` or `X-Metrics-Token`. **Not** the trader session cookie.
- Page-local **password** field, visible label **`Metrics token`**, submit **`Unlock`**. `autocomplete="off"`. Masked. Value **memory-only for the tab** — not `localStorage`, not query string, not `document.title`, not error text, not aria-live.
- Cold visit with no token stored: **unauthorized** (locked form), not a fake empty corpus.
- 401: stay on the form; show closed `metrics_unauthorized` detail (env **name** is operator copy; the **value** is not).
- If the server has no metrics token configured, skip the form and fetch without the header (today’s metrics client behavior). 401 is still first-class.
- Refreshing the tab forgets the token. That friction is accepted; persisting `METRICS_SECRET_TOKEN` in the browser is not.
- `/_ops/metrics` is **not** retrofitted this slice.

### 2. Fields the UI consumes (existing; not invented)

I do not name new JSON keys. The page reads already-generated schema members:

**Session books list** (`SessionBooksListBody`): `symbol`, `count`, `books[]` (`symbol`, `et_date`, `source_as_of`, `source`), `store`, `detail`, `vendor_called`, `framing`, `provenance`, `license`, `authorizes`.

**Session book load** (`SessionBookHitBody`): `symbol`, `et_date`, `source_as_of`, `source`, `store`, `vendor_called`, `framing`, `provenance`, `license`, `authorizes`. Array **lengths only** of `daily_bars`, `minutes`, `trades`, and `market.contracts` — never the contract rows. Miss (`SessionBookMissBody`): `error`, `detail`, `symbol`, `et_date`, `store`, `vendor_called`.

**Coverage** (`CoverageOkBody`): `framing`, `command`, `evidence`, `symbols`, `et_date`, `checkpoint`, `vendor_called`, `provenance`, `license`, `authorizes`, `verdict`, `expected_due`, `present`, `missing`, `unreadable`, `not_yet_due`, `blocked_occupancy`, `rows[]` (`symbol`, `et_date`, `cell`, `last_readable`), `holes[]` (`symbol`, `et_date`, `class`).

**Errors:** `error`, `detail`, `vendor_called`, optional `store`. 401 detail is the shipped metrics-gate sentence.

**Integrity rule — list `source` is not coverage `present`.** Coverage `present` is a **loadable `LiveMassive` body** (derive loads the object). List `source` is metadata (`live_massive` \| `fixture` \| `session_tape`). The books table prints `source` **verbatim**. It must **not** grow a `present` / `kept` column.

### 3. Closed vocabulary (sourced; no synonyms)

Reuse shipped operator decks. Do not invent a second language.

| Concept | On-screen (exact) | Banned |
|---|---|---|
| This page | AppBar **`Convexa · Session archive`**; `document.title` **`Session archive — Convexa`** | “Lab”, “Instrument lab”, “Live coverage”, “Corpus health”, “Research lab” as a `/lab` twin |
| What this is | Envelope **`framing`** | A second headline that contradicts framing |
| Session identity | **session book** · **session archive** · `(symbol, et_date)` | “live book”, “hist-chain”, “S3 book”, “kept extract” on this vehicle |
| Names | **SPY · QQQ · IWM** | “universe”, “all tickers”, trader recent-chips as nav |
| List/load hit framing | **`RESEARCH READ — SESSION BOOK`** | coverage framing on a load card |
| List empty framing | **`RESEARCH READ — NO SESSION BOOK`** | ring miss `no stored snapshot…` |
| List/load miss | **`no session book for <SYMBOL>`** (list) · **`no session book for <SYMBOL> on <ET_DATE>`** (load) | trader `—`; `unavailable this cycle`; `no options` |
| Store disabled | **`session archive not storing`** | treating as miss; three `missing` cells |
| Body bad | **`session book unreadable: <reason>`** (the `detail` string) | treating as miss or not-storing |
| List I/O fault | **`session archive store error: <reason>`** | aliasing to unreadable |
| Provenance (hit) | **`loaded from session archive · no vendor call`** | “refreshed”, “fetched from Massive”, “synced” |
| Provenance (miss/empty) | **`no vendor call`** | claiming a load that did not happen |
| License | **`Our research · not redistributed on a trader route.`** | “customer historical API” |
| Score posture | **`Authorizes: nothing`** (label `Authorizes:` + field `authorizes`) | implying live score used the book |
| Lineage token | **`live_massive`** \| **`fixture`** \| **`session_tape`** as `source` | badge `live` / `LIVE`; “this quote is live”; labeling `fixture`/`session_tape` as coverage `present` |
| Coverage framing | **`RESEARCH READ — SESSION ARCHIVE COVERAGE`** | session-book framing on the matrix |
| Coverage weekend framing | **`RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES`** | `[PASS]`; “coverage 100% (weekend)” |
| Coverage command | **`archive-coverage`** | `score-lab`; “production audit” |
| Coverage evidence | **`Evidence: this process`** (field `evidence`) | hosted / CI / production coverage; CLI `local` on this HTTP card |
| Checkpoint | **`after 16:00 America/New_York`** | inventing a second clock |
| Cell: live paid book | **`present`** | `ok`, `healthy`, `kept`, `live`, `captured`, `complete` |
| Cell: no row | **`missing`** | `unreadable`; not-storing; weekend; `not yet due` |
| Cell: pointer, body bad | **`unreadable`** | `missing`; “Permission denied” as the class |
| Cell: before clock | **`not yet due`** | `missing`; “late”; “ensure failed” |
| Cell: wrong occupant | **`blocked occupancy`** | `present`; `kept`; `fixture` as the cell; `RejectedSource` (module type, never printed) |
| Last readable | payload `last_readable` prefixed **`last readable: `** — already `SPY 2026-08-10` / `none (seed fixture excluded)` / `undetermined (walk cap)` | inventing a date; seed as last readable without the hedge |
| Hole line | **`{SYMBOL} {ET_DATE} {class}`** with `class` ∈ `missing` \| `unreadable` \| `blocked occupancy` | CLI-only gloss ` — occupant is not a live paid session book` on HTTP (that gloss is CLI-only; coverage HTTP has no reason field on `holes[]`) |
| Counts | **`Expected due: {n} · present: {p} · missing: {m} · unreadable: {u} · not yet due: {y}`** plus **`blocked occupancy: {b}`** from fields | bare percent; “healthy”; summing `not_yet_due` into `n` |
| Verdict | HTTP field **`pass`** \| **`fail`** \| **`not_due`** verbatim | `[PASS] n/n` CLI line (that line is **Evidence: local**); success-green “healthy” |
| Coverage closing | **`SESSION ARCHIVE COVERAGE — NOT A FILL · Authorizes: nothing`** | “filled”; “verified complete” |
| Token gate | **`metrics_unauthorized`** · **`Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token`** | “coverage unauthorized”; echoing the token **value** |
| Operator chrome | **`read-only`** (same chip as metrics) | `Instrumentation: ON` success chip reused as occupancy |
| Stale refresh | **`Couldn't refresh — keeping the last list.`** (metrics family; list, not trend) | blanking a warm list; fabricating zeros |
| Loading | **`Loading session archive…`** | “Loaded”, “Synced”, “All books present” |
| Cold error | **`Session archive readout unavailable.`** + caption **`Operator tool only — the trader bundle and SSE are unaffected.`** (metrics family) | trader toast; implying desk down |
| `$398` / weekly | **not on screen** | BRIEF cost as a vouched figure |

**Hard bans**

- `present` ≠ `kept`. Extracts never labeled live Massive / `present` / `LiveMassive`.
- `live` / `LIVE` as a market-feed badge on a research read. `source: live_massive` is provenance only.
- Trader absence literals (`—`, `unavailable this cycle`, `not recorded`) on occupancy cells.
- Green/red on occupancy or verdict (`pass` is not P/L). Coverage **`fail`** / unreadable / not-storing use **`warning.*` + icon always**, never brand amber alone.
- Percent-as-health. `$398`. Hosted/CI labels on `evidence: this process`.
- Raw chain / `market.contracts` dump. `[digested-labels-not-raw-dump]`.
- New motion. Lab card hover-lift. Fourth convex arc.
- TopNav / `/lab` / AppShell entry. Replay **Play**. Keep / ensure / fill buttons. Score-lab.

### 4. Component state matrix

Baseline set plus BRIEF-required **unauthorized** and load **success**. Coverage cells are **data inside default**, not extra page states — except weekend `not_due`, which is a first-class empty-of-expected, not “all present.”

| State | When | Operator sees | Can do next | Must not happen |
|---|---|---|---|---|
| **unauthorized** | No token in memory while the server requires one, **or** 401 `metrics_unauthorized` | AppBar **`Convexa · Session archive`** + `read-only`. Body: password field **`Metrics token`**, button **`Unlock`**. On 401, `Alert` **warning** + icon: **`metrics_unauthorized`**. Caption: **`Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token`**. Helper: **`Same token as Operator Metrics. Not a trader session.`** | Type token, Unlock (focus returns to the field on 401) | Fetching `_research` without the header after a 401; sending trader cookies as the gate; putting the value in the URL; listing books; saying “no session book” (that is empty, not locked); logging the value |
| **loading** | In-flight list and/or coverage with **no** prior body | AppBar + **`Loading session archive…`** + small `CircularProgress` (metrics pattern). No table. | Wait | “Loaded”; occupancy counts of 0 as if empty; skeleton rows that look like `missing` |
| **default** | 200 list with `count > 0` and/or 200 coverage with rows | Standing block from envelope. Coverage card (if admitted). Books table. Symbol chips. | Change SPY/QQQ/IWM; open a dated row; coverage `present` cell opens that identity | Labeling `source` as `present`; tinting cells green/red; dumping contracts |
| **empty** | 200 list `count === 0`, `store: miss`, `detail` present, framing **`RESEARCH READ — NO SESSION BOOK`** | Standing block **including** framing + provenance **`no vendor call`** + license + `Authorizes: nothing`. Info `Alert`: the **`detail`** string (`no session book for SPY`). No invented “add a book” CTA (this surface cannot keep). Coverage still renders if that GET succeeded. | Switch symbol; wait; read coverage | Using not-storing copy; ring miss string; `—`; treating as unauthorized |
| **error** | 5xx / 422 with **no** prior good body: not-storing, store error, unreadable load, unparseable `et_date`, `vendor_called: true` | Warning `Alert` + icon. Copy = payload **`detail`** (closed strings above). Caption: **`Operator tool only — the trader bundle and SSE are unaffected.`** | Retry (button **`Retry`**, metrics/ticker family) | Alias not-storing ↔ miss ↔ unreadable; claiming 0 Massive calls when `vendor_called` is not `false`; success chrome |
| **offline** | Network failure, no prior body | Same warning family as cold error: **`Session archive readout unavailable.`** + trader-unaffected caption. Distinct from empty. | Retry | Occupancy matrix of blanks; “no session book” |
| **stale** | Prior default/empty exists; a later poll/load fails or navigator is offline | Keep last list + last coverage + last digest. Warning chip (metrics family): **`Couldn't refresh — keeping the last list.`** | Retry; still open already-listed rows already in memory | Blank the page; interpolate zeros; stitch a new `present` |
| **success** | 200 load of one `(symbol, et_date)` | Digest **card** (not a toast, not a live badge). Heading = **`framing`**. Rows: `symbol`, `et_date`, `source_as_of`, `source`, `store`, `vendor_called`, `provenance`, `license`, `Authorizes: {authorizes}`. Counts: `daily_bars {n}` · `minutes {n}` · `trades {n}` · `contracts {n}` as **counts of payload arrays**, labeled with those field names, IBM Plex Mono (Convexa-asserted lengths of what arrived). | Back to list; open another date | Rendering strikes/greeks; `live` chip; starting Massive; navigating `/ticker`; replay; saying `present` unless this card is opened **from a coverage `present` cell** (then the coverage cell stays `present` and the digest still prints `source`, not a second `present` stamp) |

**Coverage nested states (inside default / empty-of-books):**

| Nested | When | Copy |
|---|---|---|
| Coverage default | Weekday envelope with rows | Framing · `Command: archive-coverage` · `Evidence: this process` · `Symbols: SPY · QQQ · IWM` · `Checkpoint: after 16:00 America/New_York` · `vendor_called` · counts line · matrix · last readable · holes · `verdict` · closing **`SESSION ARCHIVE COVERAGE — NOT A FILL · Authorizes: nothing`** |
| Coverage not due | `verdict: not_due` and/or weekend framing | Framing **`RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES`**. Do **not** print `pass`. No date column of `missing`. |
| Coverage fail | `verdict: fail` | Same matrix; holes listed; **warning + icon** on the verdict token `fail` — not error-red P/L, not brand amber alone |
| Coverage withheld | 500 not-storing / store error | Matrix-level **`session archive not storing`** or **`session archive store error: <reason>`** — not three `missing` cells |

**Per-control states:** token field rest / focus-visible (theme ring) / error (401). Symbol chips selected vs rest. Book row selected = the open digest’s `et_date`. Coverage cell is **text**; `present` is the only cell that loads. `missing` / `unreadable` / `not yet due` / `blocked occupancy` are not buttons that fetch a body.

### 5. Flows

1. Operator types `/_ops/research` (not a nav click). Off-shell chrome paints immediately.
2. If gated: **unauthorized** → enter metrics token → Unlock. Failure stays unauthorized.
3. Parallel GETs: session-books list for **SPY**; coverage (no `et_date` query → server today). No Massive. No trader routes.
4. **default:** read coverage cells; scan the SPY date list; click a row → **success** digest.
5. Coverage cell `present` on SPY/QQQ/IWM → load that identity (symbol chip follows). Other cells do not load.
6. Switch chip → new list GET; coverage stays the trio.
7. Refresh failure with data → **stale**. Cold failure → **error** / **offline**. Empty SPY list → **empty** (coverage may still show `missing` for today — those facts must not be collapsed into one string).

No keep, no ensure, no fill, no replay, no score-lab, no ticker jump.

### 6. Design-system application (not a second system)

- **Canon:** The Curvature Terminal. Operator-metrics is the sibling pattern: own `AppBar` `h6`, outlined `read-only` chip, `Container maxWidth="lg"`, `Alert`, dense tables, dotted-help tooltips, no live pulse.
- **Hierarchy:** token gate > framing > coverage (are today’s identities `present`?) > list (which dates exist?) > digest (what did we load?).
- **Type:** IBM Plex Sans for chrome/copy; IBM Plex Mono for `et_date`, `source_as_of`, counts, occupancy tokens, `verdict` (Convexa-asserted payload). Archivo is not required on this off-shell tool (metrics does not use display scale here).
- **Color:** occupancy is **not** signed direction — no success/error palettes on `present`/`missing`. `fail` / not-storing / unreadable / 401 = `warning.*` + icon. `pass` / `not_due` = default text.
- **Motion:** none. Honor `useReducedMotion` vacuously. Do not copy LabIndex `translateY` hover (that is a new family on this page even if lab already has it — this chrome is metrics, not lab).
- **A11y:** token field has a visible `<label>`; Unlock and chips ≥44px on coarse pointers; tables have column headers; coverage cells are text not color-only; 401 errors in `role="alert"`; focus-visible ring from theme; 393px stacks coverage above list, no horizontal overflow; `aria-busy` while loading; token input `type="password"` so the value is not announced as text.
- **Shared extraction:** second operator page is the 2nd consumer of off-shell chrome. Frontend may extract a local operator AppBar **this slice** (pages must not import sibling pages). That is not a DESIGN_SYSTEM amendment.

### 7. Acceptance criteria → states, with Verify-by

These are the user-visible criteria I need in SPEC §3. PM owns story wording; I own state homes and **Verify by** so frontend does not choose the requirement set.

| # | Criterion (observable) | State(s) | Verify by | Why |
|---|---|---|---|---|
| 1 | Dashboard route is `/_ops/…` (UX: `/_ops/research`), **outside** `AppShell`, declared so `/*` cannot shadow it, **not** `/lab` or `/lab/*`. | default (chrome) | **test** | Silent in-shell / `/lab` land is invisible on a copy pass. |
| 2 | `TopNav` / trader shell has **no** operator entry to this URL (existing “Deliberately NO operator entry” remains true for this path too). | S0 | **test** | Nav regression is silent. |
| 3 | `/lab` still renders `data-testid="lab-index"` instrument demos; this corpus is absent there. | S0 | **test** | Occupying `/lab` is a silent product swap. |
| 4 | A trader-origin `*.pages.dev` request to `/api/_research/...` still 404s. | S0 | **test** | Negative space; already poisoned in capture specs. |
| 5 | Product `convexa.ts` does **not** grow a trader `_research` helper; the operator page’s client does not import onto ticker/scanner/positions routes. | S0 | **test** | Structural leak compiles green. |
| 6 | Unlock sends the metrics token header; a trader session cookie alone still 401s. | unauthorized | **test** | Auth boundary. |
| 7 | Token value is absent from URL, `document.title`, visible DOM text, and aria after typing. | unauthorized → default | **test** | Secret leak is silent. |
| 8 | With a valid token, SPY list 200 shows `books[]` dates as `et_date` + `source` + `source_as_of` without a `present`/`kept` column. | default | **test** | Occupancy rename is silent. |
| 9 | Opening a dated book shows digest fields + `vendor_called` false; does not render `market.contracts` rows; does not call trader ticker/SSE. | success | **test** | Dump vs digest; no Massive/trader path. |
| 10 | Empty SPY list shows exact `detail` / framing **`RESEARCH READ — NO SESSION BOOK`**, not not-storing, not ring miss. | empty | **test** | Absence collapse. |
| 11 | Not-storing shows **`session archive not storing`**, not empty list copy. | error | **test** | Absence collapse. |
| 12 | Unreadable load shows **`session book unreadable:`** family from `detail`. | error | **test** | Absence collapse. |
| 13 | Coverage cells print only `present` \| `missing` \| `unreadable` \| `not yet due` \| `blocked occupancy`. | default | **test** | Closed deck. |
| 14 | Coverage `verdict: not_due` uses weekend/no-expected framing and does **not** print `pass`. | default (nested not due) | **test** | Vacuous pass is a fabricated claim. |
| 15 | Coverage counts use payload integers; no percent; `Evidence: this process` (not hosted/CI). | default | **test** | Evidence-class + percent bans. |
| 16 | `authorizes` renders as **`Authorizes: nothing`** when the field is `nothing`; load hit framing is session-book, not coverage. | default / success | **test** | Score-posture + framing mix-up. |
| 17 | Fixture / `session_tape` `source` is never labeled `present` or `kept`. | default / success | **test** | `present-is-live-paid-only`. |
| 18 | Flat-file / tape / snapshot vehicles are **absent** from v1 chrome (no `kept` extract table, no tape clock, no ring miss string). | default | **test** | Scope leak. |
| 19 | AppBar title string **`Convexa · Session archive`**, `read-only` chip present, token-field label **`Metrics token`**. | unauthorized / default | **review** | Visible/intentional copy. |
| 20 | Coverage standing/closing/last-readable/hole strings match §3 tables (HTTP twin, not CLI `[PASS] … local audit` line). | default | **review** | Copy inspection. |
| 21 | No new motion family; no hardcoded hex; warning states carry an icon; 393px no overflow. | all | **test** (existing structural specs + no-overflow e2e if this route is added to that set) | Theme/motion inventory is silent. |
| 22 | Stale refresh keeps last rows and shows **`Couldn't refresh — keeping the last list.`** | stale | **test** | Warm-blank is silent. |
| 23 | Offline/cold error is **`Session archive readout unavailable.`** + trader-unaffected caption — not empty. | offline / error | **test** | Empty vs error. |
| 24 | Coverage `fail` is warning+icon, not success green on `pass`, not direction red. | default | **review** | Color semantics are visible; pair with a test that `present` cells do not use `success`/`error` palette classes if that is cheap in jsdom. Prefer **test** if class identity is asserted without paint. |

**Harness note (H3):** dashboard already uses Vitest + jsdom and Playwright e2e. Invariants (route, nav, occupancy tokens, token header, no contracts dump) are **test**. Paint/focus-ring polish may stay **review** unless an existing a11y scan is extended — do not invent a new visual tier this slice. Load-bearing occupancy mapping belongs in a **pure lookup** so unit tests do not need DOM.

### 8. Copy deck (exact strings on screen)

**AppBar**

- Title: `Convexa · Session archive`
- Chip: `read-only`
- After a body: `Authorizes: nothing` (from field)

**Token**

- Label: `Metrics token`
- Button: `Unlock`
- Helper: `Same token as Operator Metrics. Not a trader session.`
- 401 title: `metrics_unauthorized`
- 401 body: `Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token`

**Loading:** `Loading session archive…`

**Cold error / offline:** `Session archive readout unavailable.` / `Operator tool only — the trader bundle and SSE are unaffected.` / button `Retry`

**Stale:** `Couldn't refresh — keeping the last list.`

**Books standing (hit):** framing `RESEARCH READ — SESSION BOOK` · provenance `loaded from session archive · no vendor call` · license `Our research · not redistributed on a trader route.` · `Authorizes: nothing`

**Books empty:** framing `RESEARCH READ — NO SESSION BOOK` · provenance `no vendor call` · detail `no session book for SPY` (symbol from payload)

**Load miss:** `no session book for SPY on 2026-08-10` (payload `detail`)

**Not storing:** `session archive not storing`

**Unreadable:** `session book unreadable: <reason>`

**List store fault:** `session archive store error: <reason>`

**Coverage standing:** `RESEARCH READ — SESSION ARCHIVE COVERAGE` · `Command: archive-coverage` · `Evidence: this process` · `Symbols: SPY · QQQ · IWM` · `Checkpoint: after 16:00 America/New_York`

**Coverage weekend:** `RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES`

**Coverage closing:** `SESSION ARCHIVE COVERAGE — NOT A FILL · Authorizes: nothing`

**Cells / holes / last readable / counts / verdict:** §3 tables — HTTP tokens, not CLI `[PASS]` local-audit line.

**Source tooltip (explain; do not rename):** `Provenance token. Not a live quote. Coverage present is a loadable LiveMassive body — this list column is not that cell.`

**Contracts count tooltip:** `Count of contracts in this stored book. Not a live chain. Rows are not shown.`

Do not print `$398`. Do not print “weekly corpus.”

### 9. Out of scope (named so they cannot sneak in as polish)

- `/lab` occupation or LabIndex cards for books.
- Trader nav, Settings, Ask-AI, Ticker chips, morning note.
- Replay player, score-lab HTTP, keep/ensure/fill controls.
- v1 tape / flat-files / 48-ring tables.
- Retrofit token UX onto `/_ops/metrics`.
- DESIGN_SYSTEM token/motion/arc amendments.
- Rendering `market.contracts` or tape ticks.
- CLI `[PASS] … local audit is not production coverage` on the HTTP card (wrong evidence class).
- CLI-only blocked gloss on HTTP holes.

---

## Risks I see

- **Occupancy synonym collapse** if PM/Architect drop extracts or tape onto the same table as coverage cells. `kept` will be spoken as `present` within a week.
- **List `source: live_massive` misread as coverage `present`.** List does not prove a loadable body. A `present` column on the books table would fabricate coverage.
- **Token in the URL or localStorage.** Weekly-use convenience will argue for `?token=` or remember-me. That is a secret in history/disk.
- **Chain dump.** Opening a book without a digest rule will render strikes because the payload has them. That violates `[digested-labels-not-raw-dump]` and Massive license copy (`not redistributed on a trader route`).
- **Success-green `pass`.** Metrics already uses `color="success"` for `Instrumentation: ON`. Copying that onto coverage `pass` spends direction green on a non-directional audit.
- **Weekend as `pass` / empty as not-storing / 401 as empty.** Three `[absent-is-not-none]` failures that look like polish.
- **`/lab` gravity.** The feature *name* is `research-lab-surface`. Implementers will mount under `/lab` because `LabIndex.tsx` exists. That is a product swap, not a route bikeshed.
- **Evidence-class mix-up.** Pasting CLI `[PASS] … local audit is not production coverage` onto an HTTP card whose `evidence` is `this process` is a fabricated local-vs-hosted claim.
- **`$398` on the chrome.** BRIEF decision-impact, not a vouched field. A cost chip would be copy asserting a number with no payload source.
- **Polling like metrics.** Coverage/list are not a 60s latency window. A noisy poll could be mistaken for live. v1 is on-demand GET (mount + symbol change + Retry), not a trend loop.

---

## Assumptions I'm making about the other two lanes

- **Architect** will mount this page as a **second off-shell route** beside `/_ops/metrics` in `app.tsx` (outside `<AppShell/>`, not under `/lab`), and will **not** add a `TopNav` / AppShell link; a structural test will poison both a shell child and a `/lab` path.
- **Architect** will keep Pages `functions/api/[[path]].ts` 404 on the entire `/api/_research/` prefix (no proxy “so the operator UI works on Pages”); trader-origin 404 remains the proof, not a dashboard rewrite.
- **Architect** will consume the **existing** list/load/coverage GETs (NO_BACKEND_CHANGE or a thin adapter that does **not** rename `present` / `kept` / `blocked occupancy` / `authorizes` / `framing` / `source` tokens); I will not receive a unified `status` field.
- **Architect** will **not** add a `_research` helper to product `libs/api/src/lib/convexa.ts`; the operator fetcher stays off ticker/scanner/positions import graphs.
- **Architect** will send `X-Metrics-Token` (or Bearer) from **page memory**, not from the trader cookie jar, and will not put the token in the query string.
- **Architect** will **not** retrofit `/_ops/metrics` token entry in this slice; that page staying headerless is accepted pre-existing behavior.
- **Architect** will **not** dump `market.contracts` in the load view; digest is identity + array **counts**.
- **PM** will lock v1 to **session books + coverage only**, and will write ACs that **forbid** tape / flat-files / snapshots / replay / score-lab / morning-note / `/lab` on this URL.
- **PM** will treat occupancy tokens as **acceptance criteria**, not as gloss: `present` ≠ `kept` ≠ `missing` ≠ `unreadable` ≠ `not yet due` ≠ `blocked occupancy` ≠ `session archive not storing` ≠ `no session book…`.
- **PM** will not require a `$398` or “weekly health %” figure on screen, and will not mark coverage HTTP with CLI **Evidence: local** wording.
- **PM** will keep `Authorizes: nothing` and Pages 404 and TopNav silence as SPEC §3 rows with **test** Verify-by, not review-only prose.
- **PM** will not re-scope the token to a trader login, and will not ask for remember-me persistence of `METRICS_SECRET_TOKEN`.
- **Both** will accept `/_ops/research` as the UX route recommendation; if Architect picks another `/_ops/…` suffix, it still must be unlinked, off-shell, and not `/lab`.
- **Both** will leave `DESIGN_SYSTEM.md` unamended this slice; operator-metrics chrome + existing tokens are sufficient.
- **Backend (via Architect)** still returns 200 + `count: 0` + `detail: no session book for {SYMBOL}` for an empty list (not 404), 401 with `metrics_unauthorized` for a bad/missing token when the env token is set, 500 `session archive not storing` as a **distinct** class, and coverage weekend as 200 `verdict: not_due` with `rows: []` — so the state matrix above has a vouched home for each copy line.
