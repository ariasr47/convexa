# R1 — ux position: archive-coverage-guardrails

## Position

### 0. What the surface actually is (and what it is not)

There is **no trader screen here.** The BRIEF is a **read-only coverage matrix**, **one structured warning per `(symbol, et_date)` after a locked ET checkpoint**, and a **local audit command that prints that same matrix and exits non-zero on a hole**. It does **not** fetch Massive, fill gaps, change live scoring, tape SSE, add trader UI, or move bodies.

`[operator-vs-trader-path-separation]` is HARD. Pages trader origin already 404s `/api/_research` and `/api/_metrics` (`functions/api/[[path]].ts`). Coverage stays on the operator/research side of that fence.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` is **Status: SET** (The Curvature Terminal). This feature consumes **no** dashboard route, component, token, motion, chip, or copy table. SPEC §4 must carry **`NO_UI_CHANGE`** and must **not** restate the token table. I request **no amendment** to `DESIGN_SYSTEM.md`. Anyone proposing a Ticker “archive coverage” chip, a Settings research toggle, an Ask-AI “we lost Tuesday’s book” line, a Scanner badge, or a **new `/_ops` coverage panel** is **re-scoping** — raise as an R2 `product` conflict; do not fold it in.

The existing unlinked `/_ops/metrics` page (`OperatorMetrics`) is **latency / cache / vendor-headroom chrome** with a closed stage set and trader-reserved `—` / `unknown` literals. Coverage is a **different datum**. Collapsing it into p50/p95, “Instrumentation: ON”, or a success chip is this feature’s defining integrity failure on that page. If Architect rides coverage JSON on `GET /api/_metrics`, that is a **curl/ops wire vehicle**, not permission to render a second matrix in the dashboard. Unknown JSON must remain **unrendered** there.

The user-facing surface I own is four coupled artifacts plus hard negative space:

| # | Surface | Who reads it | My ownership |
|---|---------|--------------|--------------|
| S0 | **Trader UI silence** — Landing, Ticker, Positions, Scanner, Settings, Ask-AI, shell nav; Pages trader origin | every trader | what must **never** appear: no coverage badge, hole toast, “missing SPY book”, corpus count, or Ask-AI grounding on archive holes |
| S1 | **Coverage matrix** — operator HTTP (Architect: `_metrics` vs sibling `_research`) + CLI stdout twin | research operator / owner | every cell literal, column meaning, count basis, last-readable wording, standing block, banned terms |
| S2 | **One structured warning** per expected `(symbol, et_date)` after checkpoint | operator logs / Railway logs | exact warning line; identity; missing vs unreadable; the ban on permission-denied floods |
| S3 | **Local audit command** — `archive-coverage` (BRIEF name; Architect may rename clap; stdout title must match) | maintainer on a shell; CI log | same matrix as S1; exit code agrees with holes; **Evidence: local**; not production coverage |
| S4 | **Negative space — `/_ops/metrics` + research-lab chrome** | anyone on the latency page or a score-lab receipt | coverage must **never** appear as a latency stage, research ranking, or “LIVE coverage” headline |

This is **not** a session-book **load** (`RESEARCH READ — SESSION BOOK`). Loading a body and classifying expected identities are different jobs. Do not reuse session-hit framing on a coverage matrix, or a skimming operator will think they fetched Tuesday’s chain.

This is **not** `score-lab` / `batch-backtest` / `capacity` . Those artifacts say **NOT LIVE** / **NOT A PRODUCTION MEASUREMENT** about replay or mocked load. This artifact says **expected identities in the session archive** and **Authorizes: nothing** on fill, score, or trader UI.

### 1. Intended user, primary job, information structure, vocabulary

- **Intended user:** the research operator / owner watching whether **SPY / QQQ / IWM** weekday session books exist and load — on Railway logs, a token-gated operator GET, or a local CLI. **Not** the anonymous or signed-in trader.
- **Primary job:** *On an eligible ET weekday after the checkpoint, see each expected identity classified `present` \| `missing` \| `unreadable`, with last readable identity when any; get exactly one warning per hole identity the same ET day it is a hole; run one local command that prints that matrix and fails the process if any expected identity is missing or unreadable — in time to notice before the 48-ring prunes the only copy.*
- **Failure I am designing against:** one “no data” / “coverage OK” / “live coverage 77.8%” string that collapses **missing ≠ unreadable ≠ ineligible ≠ disabled ≠ not yet due**, or a local CLI receipt quoted as **production coverage**, or a reconstructed/flat-file body labeled `present` / `live_massive`.

**Information structure (S1/S3), always in this order:**

1. **Standing / framing block first** (what this is — before any cell or count).
2. **Scope:** symbols · expected-identity rule · window the matrix actually covers · checkpoint standing · evidence class · vendor I/O.
3. **Matrix** — one row per `ENSURE_SYMBOLS` member (SPY, QQQ, IWM); one column per **expected** ET date in the named window; cells use the closed class literals.
4. **Last readable** identity per symbol when any (seed excluded).
5. **Counts** as `present / missing / unreadable / not yet due` against **n expected** — never a bare percent as a health score.
6. **Hole list** — only `missing` and `unreadable` identities; empty hole list is not the same as “ineligible window.”
7. **One verdict line** that agrees with the process exit code (CLI) or with the hole list (HTTP).
8. **Closing line:** authorizes nothing; local is not hosted/production evidence.

**User vocabulary — closed term set. These are the only words S1–S3 may use for these things.** Reuse shipped session-archive strings where the same fact is already named (`_archive/session-chain-archive/SPEC.md` §4). Do **not** invent a second deck for miss/unreadable/not-storing.

| Concept | Approved term / exact string | **Banned** (asserts a meaning the data cannot carry) |
|---|---|---|
| The prune-proof day identity | **session book** · **session archive** · identity **`(symbol, et_date)`** | “live book”, “hist-chain”, “raised 48-cap row”, “S3 book” |
| Names in scope | **SPY · QQQ · IWM** (the ensure set) | “lab names”, “all tickers”, “universe coverage”, “options coverage” |
| Expected identity | **expected identity** — `ENSURE_SYMBOLS` × eligible ET weekday in the named window, **seed fixture excluded** | calling a weekend or the seed “expected”; “should have a book” without the rule |
| Eligible weekday | **ET weekday** (cited `is_et_weekday`: Mon–Fri America/New_York) | “trading day” if that implies an exchange-holiday calendar this feature does not have; “market open” |
| Seed fixture (excluded) | **seed fixture `SPY` `2020-01-02`** — conformance plant, **not live coverage** | counting it in `n expected`; showing it as `present` coverage; using it as last readable without the seed hedge |
| Cell: readable expected book | **`present`** | “ok”, “healthy”, “live”, “captured”, “ensured”, “complete” |
| Cell: no expected identity | **`missing`** | `unreadable`; `session archive not storing`; weekend; `not yet due`; trader `—`; ring `no stored snapshot…` |
| Cell: identity/pointer, body bad | **`unreadable`** — operator detail family remains shipped **`session book unreadable: <reason>`** when a reason is shown | treating as `missing`; treating as not-storing; “Permission denied”; “object missing in S3” as a **new** class |
| Pre-checkpoint eligible today | **`not yet due`** | `missing`; warning-as-hole; “late”; “ensure failed” |
| Weekend / outside expected rule | **`ineligible`** — **not a matrix cell** for that date (date is omitted from expected columns) | `missing`; `present` with 0; “coverage 100% (weekend)” |
| Store disabled / unavailable | **`session archive not storing`** — **matrix-level error**, not nine `missing` cells | collapsing to all-missing; “coverage 0%” |
| List/metadata I/O fault | shipped **`session archive store error: <reason>`** | aliasing to unreadable or missing |
| Last readable identity | **`last readable: {SYMBOL} {ET_DATE}`** or **`last readable: none (seed fixture excluded)`** | inventing a date; substituting another symbol; labeling seed as last readable without the hedge; “never” |
| How the matrix was derived | **loaded from session archive · no vendor call** (same provenance family as session list) | “refreshed from Massive”; “filled”; “reconstructed”; “synced” |
| Reconstructed / flat-file body | **not a coverage `present`** · **never `live_massive`** | inserting it as a present expected book; “recovered Tuesday”; “backfilled” |
| The 48-ring | **48-ring** / **ring snapshot** | calling ring presence “session coverage”; using ring miss string on a coverage cell |
| Warning | **session archive coverage warning** · one per `(symbol, et_date)` | permission-denied flood; “5,000 write failures”; dollar-loss copy; trader toast |
| Audit command | **archive-coverage** (spoken name; clap may match) · **local audit** | “production audit”; “hosted coverage”; `score-lab`; `serve` alias |
| Evidence class | **`local`** on the CLI unless a later lock names another class this run actually is | a local pass labeled production / Railway / hosted / CI-verified-on-runners |
| Counts | **`{k} / {n} expected`** with the four class counts named | bare “77.8%”; “healthy”; “coverage OK”; “all good” on a vacuous window |
| Score / fill posture | **Authorizes: nothing** | “fetch the hole”; “fill from Massive”; “score used this book”; “verified complete” |
| License | **Our research · not redistributed on a trader route.** | “customer historical options API” |
| Live-as-market-feed | forbidden as a badge or “this quote is live” | audit column **“Live coverage”** (26 Aug prose header — **do not reuse**; that word is the Live chip) |
| Operator auth miss | reuse shipped **`metrics_unauthorized`** / `Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token` | “coverage unauthorized” as a second auth dialect |
| Pages trader origin | existing **404 `Not Found`** on `/api/_research` and `/api/_metrics` prefixes | proxying coverage to the trader origin; a trader-readable hole banner |

**Hard ban — silent rename of the four absences the BRIEF names:** `missing` ≠ `unreadable` ≠ `ineligible` ≠ `disabled` (`session archive not storing`). Add the fifth clock distinction: **`not yet due` ≠ `missing`**. That collapse is the fabricated claim `[absent-is-not-none]` forbids.

**Hard ban — `live` as a market-feed claim** on coverage/warning/CLI. Closed lineage `source: live_massive` \| `fixture` remains **provenance only** on a session-book load — coverage cells say `present`, never “Live”. The 26 Aug audit’s column title “Live coverage” is **retired as copy** for this ship.

**Hard ban — percent-as-health.** `7/9 expected` is a count. `77.8%` as a headline, SLO, or “healthy” is a renamed count with a success connotation the data does not carry.

**Hard ban — local-as-hosted.** `[local-evidence-is-not-hosted-evidence]`: a CLI receipt printed on a laptop is **Evidence: local**. It is not “production coverage 7/9”. The 26 Aug production audit remains a **human document**, not this command’s default output.

### 2. Binding framing (must ship on every matrix, including FAIL / NOT DUE / ERROR)

`(a)` **Standing block is first** on CLI stdout and on any human-printed HTTP twin, before any cell:

```
SESSION ARCHIVE COVERAGE — EXPECTED IDENTITIES · NOT A FILL
  Command:     archive-coverage
  Evidence:    local
  Symbols:     SPY · QQQ · IWM
  Expected:    ET weekdays in {window the run actually used} · seed fixture SPY 2020-01-02 excluded
  Checkpoint:  after {locked ET checkpoint} · before checkpoint a today-cell is not yet due, not missing
  Vendor I/O:  0 Massive calls
  Authorizes:  nothing. No fill, no Massive fetch, no live score/tier/gate/fingerprint change,
               no trader UI.
```

`{window}` and `{locked ET checkpoint}` are **PM/Architect locks, not UX numbers**. I own that they are **printed beside the matrix**, that a missing lock is a blocked run (not a pass), and that **Evidence: local** is on the CLI even when the operator wishes it were production.

If the vehicle is HTTP against a production process, the standing block may say **Evidence: this process** (not “hosted verified”, not “CI”). Still **not a fill**. Still **Authorizes: nothing**. Do not print `Evidence: local` on a Railway-origin GET, and do not print `Evidence: production` on a laptop CLI.

HTTP envelope framing (concept names only — **no invented payload keys**): this is a **coverage read**, not a session-book load. If Architect places it under `_research`, the human framing line is `RESEARCH READ — SESSION ARCHIVE COVERAGE` (or `… — NO EXPECTED IDENTITIES` on an ineligible window). **Do not** send `RESEARCH READ — SESSION BOOK` when no body was loaded. If Architect places it on `_metrics`, do **not** use research-load framing and do **not** reuse latency stage names.

`(b)` **Vendor I/O line is not decorative.** Print `0 Massive calls` only when the run can vouch it. If it cannot, the verdict is **ERROR / BLOCKED**, never a matrix that looks complete.

`(c)` Repeat one closing line at the bottom of stdout:

`SESSION ARCHIVE COVERAGE — NOT A FILL · Authorizes: nothing · local audit is not production coverage`

HTTP closing (this-process): `SESSION ARCHIVE COVERAGE — NOT A FILL · Authorizes: nothing`

`(d)` Human print, any JSON twin, hole list, and **CLI exit code must agree**. A success-sounding line with a non-zero exit (or the reverse) is a copy bug.

### 3. Where each datum surfaces

| Datum | Surfaces on | Does **not** surface on |
|---|---|---|
| Expected-identity classification `present` \| `missing` \| `unreadable` | S1 matrix cell; S3 same cell; S2 only for `missing` and `unreadable` after checkpoint | Trader UI; `/_ops/metrics` stages; session-book **load** body; score-lab report |
| `not yet due` | S1/S3 today-cell before checkpoint | S2 (no warning); trader UI |
| `ineligible` (weekend / not in rule) | S1/S3 standing + verdict **NOT DUE** when the window contains zero expected identities; date **omitted** from columns | a `missing` cell; a warning |
| `session archive not storing` | S1/S3 error state (matrix withheld); not a cell | nine `missing` warnings |
| Last readable identity | S1/S3 per-symbol trailing column / line | warning (warning names the **hole** identity, not a substitute date); trader UI |
| Seed fixture `SPY 2020-01-02` | exclusion line in standing block; last-readable hedge if it would otherwise be the only row | `n expected`; `present` coverage; unlabeled last readable |
| Checkpoint | standing block; today-cell class | trader freshness chip |
| One warning per hole identity | S2 structured operator log only | trader toast; SSE; bundle; a second warn line for the same `(symbol, et_date)` while the hole persists |
| Permission-denied / write-skip storms | **not this feature’s signal** — existing `session archive write skipped — trader path unchanged` may still log; coverage warning **replaces that flood as the operator’s checkpoint signal**, it does not reprint it | S1 cell copy (`Permission denied` is not a class) |
| CLI exit code | process status; verdict line | HTTP (HTTP does not fail the trader path) |
| `authorizes: nothing` / license | standing + hit/coverage envelope | implying stored books are a trader feed |
| Pages 404 | trader origin on `_research` / `_metrics` prefixes | Railway-direct operator GET (token-gated) |

I do **not** name new JSON fields. Architect/synthesizer own keys. I own the **literals and labels** the operator reads.

### 4. States (complete matrix)

Trader path (S0) has **one** required state: **unchanged**. Browser default / loading / empty / error / offline / stale on Landing / Ticker / Positions / Scanner / Settings / Ask-AI / shell are **N/A** (`NO_UI_CHANGE`). Coverage derive success, hole, warning, CLI fail, and store fault are **all invisible** there.

`/_ops/metrics` (S4) stays on its **existing** closed states (`Loading metrics…` / `Metrics readout unavailable.` / rolling latency tables). Coverage does **not** add a state to that page.

S1/S3 operator-visible states. Empty, not-due, missing, unreadable, disabled, and error must stay **visibly distinct** (`[absent-is-not-none]`). Progress copy is not a verdict.

| State | When | Operator sees | Must **not** happen |
|---|---|---|---|
| **default — matrix** | Eligible expected identities exist in the named window; store readable; each cell classified | Standing block → matrix with closed cell literals → last readable → `{k} / {n} expected` class counts → hole list or empty-holes line → verdict | “Live coverage”; mixing ring slots into cells; seed counted; reconstructed as `present` |
| **loading (CLI)** | Audit command in flight | `[RUNNING] archive-coverage — no verdict yet` | A partial file titled as a finished receipt; HTTP loading chrome (HTTP is request/response — **N/A**) |
| **loading (HTTP)** | **N/A** | No loading field | “fetching from Massive…”; OperatorMetrics spinner reused as coverage |
| **pass (CLI)** | Window had ≥1 expected identity due (checkpoint passed for those dates); every due expected identity is `present`; vendor I/O vouched 0 | Standing → matrix → `[PASS] archive-coverage — {n}/{n} expected present · 0 missing · 0 unreadable · 0 Massive calls · local audit is not production coverage` · **exit 0** | PASS on a vacuous weekend window; PASS with a hole; PASS labeled production |
| **fail — hole (CLI)** | ≥1 due expected identity is `missing` or `unreadable` | Standing remains; hole list names **each** `(symbol, et_date)` with **its** class; `[FAIL] archive-coverage — {h} expected identities missing or unreadable.` · **exit non-zero** | Generic “failed”; collapsing unreadable into missing; exit 0 |
| **not due / ineligible window** | Named window contains **zero** expected identities (weekend-only “today”, or today before checkpoint with no other due dates) | `[NOT DUE] archive-coverage — no expected weekday identities due in this window. Not a coverage pass.` · **exit 0** (BRIEF: non-zero **iff** a due expected identity is missing/unreadable — there are none) | `[PASS] … n/n present`; “coverage 100%”; classifying Saturday as `missing`; firing S2 |
| **cell — present** | Expected `(symbol, et_date)` exists and body loads; not seed; not reconstructed-as-live_massive | Cell literal **`present`** | Live badge; “ok”; green-as-health (green/red stay reserved for signed direction — even ANSI on CLI is optional and **must not be the only signal**) |
| **cell — missing** | Due expected identity has **no** archive row | Cell literal **`missing`**; hole list line `{SYMBOL} {ET_DATE} missing`; after checkpoint, **one** S2 warning of the missing family | `unreadable`; `no stored snapshot…`; trader `—`; `unavailable this cycle`; `n/a` |
| **cell — unreadable** | Due expected identity exists (or pointer exists) but body cannot be read | Cell literal **`unreadable`**; optional detail **`session book unreadable: <reason>`**; hole list `{SYMBOL} {ET_DATE} unreadable`; after checkpoint, **one** S2 warning of the unreadable family | Treating as `missing`; treating as not-storing; reprinting `Permission denied` as the class |
| **cell — not yet due** | Eligible weekday identity whose checkpoint has not passed | Cell literal **`not yet due`**; **no** hole list entry; **no** S2 | `missing`; warning; “late ensure” |
| **empty — no expected columns** | Same as not-due window; matrix may show symbol rows with **no date columns** plus the NOT DUE verdict | Explicit **no expected identities due** | Blank success; empty table that looks like “all present” |
| **error — not storing** | Archive disabled / unavailable | **`session archive not storing`** · no fabricated cells · CLI **exit non-zero** (`[ERROR]` — the audit could not classify; this is not “0 missing”) | Nine `missing` cells; nine warnings; silent Massive recovery |
| **error — store / derive fault** | List/load I/O failed in a way that is not per-identity unreadable | **`session archive store error: <reason>`** (list family) or `[ERROR] archive-coverage — {closed reason}. No pass recorded.` · exit non-zero | Treating as all-missing; treating as PASS |
| **error — unauthorized (HTTP)** | Operator token missing/wrong when token is configured | Shipped **401** `metrics_unauthorized` detail — **reuse**, do not mint coverage-auth copy | 200 empty matrix; trader-session cookie as the gate |
| **error — vendor I/O / paid feed** | Coverage path would call Massive or cannot vouch 0 vendor calls | `[ERROR] archive-coverage — coverage path must not call Massive. No pass recorded.` · exit non-zero | A matrix anyway; burning Options to “confirm” a hole |
| **blocked — reconstructed as present** | A reconstructed/flat-file artifact would be classified `present` or `live_massive` | Do **not** print `present`. If such a row is visible at all: it is **not an expected present**. Prefer error/blocked over a pretty cell. | “recovered”; filling the hole in the matrix |
| **warning (S2)** | After checkpoint, a due expected identity is `missing` or `unreadable` | **Exactly one** structured warning for that `(symbol, et_date)` (see §5). Repeats of the same identity do not multiply the signal | Permission-denied flood; one warning that only says “coverage low”; trader toast; failing ensure/bundle/SSE |
| **stale (trader SSE sense)** | N/A | — | `⏸ offline` / “Live offline” / `unavailable this cycle` on the matrix |
| **offline (trader SSE sense)** | N/A | Operator curl failure is a **client** error, not a coverage class | Inventing an offline cell |
| **HTTP success with holes** | Operator GET (if any) on a process that has holes | **200 + honest matrix** (coverage failure must not fail bundle/scan/SSE; this read is not the desk). Hole list still names missing/unreadable | HTTP 5xx because a book is missing; empty 200 that looks clean |
| **trader product (negative)** | Always | Unchanged Ticker/SSE/Settings/Ask-AI/`/_ops/metrics` copy | New route, nav, chip, toast, or Pages-proxied coverage |

**Closed cell literals (exact; one per expected cell; never synonyms):**

| Literal | Means |
|---|---|
| `present` | Due expected identity exists and body is readable; not seed; not reconstructed-as-`live_massive` |
| `missing` | Due expected identity has no archive row |
| `unreadable` | Due expected identity/pointer exists; body not readable |
| `not yet due` | Expected if/when checkpoint passes; checkpoint has not passed |

Banned competing empties on this matrix: `n/a`, blank, trader `—`, `unavailable this cycle`, `/_ops` `unknown`, research `no stored snapshot for <SYMBOL>`, `empty 48-ring`, `ok`, `fail`, `live`.

Shipped session-book **load** strings remain on the **load** vehicle only. A coverage cell does not print `no session book for SPY on 2026-08-24` as the cell (too easy to confuse with a load miss). The hole list **may** cite that shipped miss family as a **detail** under a `missing` cell, because it is the same fact. The **cell** stays `missing`.

### 5. Exact warning and verdict wording

Placeholders in braces are filled from **this run’s** vouched identities. Do not hard-code counts. Do not assert dollar loss (`$199 Options`) — that is the BRIEF’s decision-impact story, not a runtime-vouched field.

**S2 — exactly one structured warning per hole identity after checkpoint:**

| Class | Exact operator-facing line (log message) |
|---|---|
| Missing | `session archive coverage warning — missing expected book {SYMBOL} {ET_DATE}` |
| Unreadable | `session archive coverage warning — unreadable expected book {SYMBOL} {ET_DATE}` |

Rules:

- Identity is **`(SYMBOL, ET_DATE)`** America/New_York `YYYY-MM-DD`. No other key.
- **One** warning per identity while that class holds after checkpoint — not one per write attempt, not one per permission error, not a daily digest that omits the identity.
- Do **not** fire before checkpoint, on `ineligible` dates, on the seed fixture, or when the store is `session archive not storing` (that is the error state, not a per-cell warning storm).
- Do **not** put `Permission denied`, filesystem paths, or bucket names in the **closed** line. A backend `error=` field may exist for diagnosis; it is **not** a second product class and must not replace `missing` / `unreadable`.
- Do **not** fail bundle / scan / SSE / ensure because the warning fired (`[best-effort-isolated-or-null]`).
- Color may supplement; **plain text carries the whole meaning**.

**S3 — CLI verdict lines:**

| Verdict | Exit | Exact operator-facing line |
|---|---|---|
| Running | pending | `[RUNNING] archive-coverage — no verdict yet` |
| Pass | 0 | `[PASS] archive-coverage — {n}/{n} expected present · 0 missing · 0 unreadable · 0 Massive calls · local audit is not production coverage` |
| Hole | non-zero | `[FAIL] archive-coverage — {h} expected identities missing or unreadable.` |
| Not due | 0 | `[NOT DUE] archive-coverage — no expected weekday identities due in this window. Not a coverage pass.` |
| Not storing | non-zero | `[ERROR] archive-coverage — session archive not storing. No pass recorded.` |
| Derive/store fault | non-zero | `[ERROR] archive-coverage — session archive store error. No pass recorded.` |
| Massive on path | non-zero | `[ERROR] archive-coverage — coverage path must not call Massive. No pass recorded.` |
| Missing lock | non-zero | `[ERROR] archive-coverage — expected window or checkpoint not locked. No pass recorded.` |

Do not use “SLO miss”, “production down”, “verified”, “certified”, “healthy”, “Live”, or “Massive p95” in any generated line.

**S1 HTTP (if present):** no process exit. The hole list and class counts **are** the verdict. A matrix with holes is still a successful **read**. Do not translate holes into trader 5xx.

### 6. Coverage matrix (operator-visible layout)

Text table, symbols as rows in **SPY, QQQ, IWM** order (ensure-set order, cited `ENSURE_SYMBOLS`), expected ET dates as columns oldest→newest in the named window. Trailing column **last readable**. No “Live coverage” column.

```
  Symbol  2026-08-24  2026-08-25  2026-08-26  last readable
  SPY     missing     missing     present     SPY 2026-08-26
  QQQ     present     present     present     QQQ 2026-08-26
  IWM     present     present     present     IWM 2026-08-26

  Expected due: 9 · present: 7 · missing: 2 · unreadable: 0 · not yet due: 0
  Holes: SPY 2026-08-24 missing · SPY 2026-08-25 missing
```

Dates in the example are **illustrative of layout**, not a locked window. The 26 Aug audit’s 7/9 is **historical evidence**, not a number this feature may print unless **this run** observes it.

**Last readable:** latest `present` identity for that symbol inside the archive that is **not** the seed fixture. If none: `none (seed fixture excluded)`. Never silently use `SPY 2020-01-02` as proof we have a production book.

**CLI and HTTP print the same matrix** (BRIEF). Same cell literals, same row order, same hole phrasing. Standing evidence class may differ (`local` vs `this process`).

### 7. Glossary / tooltip text (operator only)

No trader glossary. No new `/_ops` tooltips. If a human print layer annotates headers, these are the **only** explanations — they explain; they do not invent metrics:

| Term | Glossary sentence |
|---|---|
| expected identity | A `(SPY\|QQQ\|IWM, ET weekday date)` this process is supposed to have in the session archive after the checkpoint. Weekends and the SPY 2020-01-02 seed fixture are not expected. |
| present | That expected identity exists and its body loaded from the session archive. Not a live quote. Not a fill. |
| missing | No session-archive row for that expected identity. Distinct from unreadable, weekend, disabled store, and not-yet-due. |
| unreadable | A row or pointer exists but the body could not be read. Distinct from missing. |
| not yet due | Today is an eligible weekday and the locked checkpoint has not passed. Not a hole. |
| last readable | The most recent present identity for that symbol, excluding the seed fixture. Not “current market.” |
| local audit | This command classified **this process’s** archive. It is not production/hosted coverage unless that is independently true of the process, and the receipt still must not say “verified on Railway” by default. |

### 8. Design-system / interaction (why NO_UI_CHANGE still binds)

Canon Status **SET**. No new tokens, components, patterns, arc spends, or motion. No hardcoded hex. Green/red remain **direction**, not coverage health. Warnings in any future UI would need `warning.*` + icon — **not requested**; S2 is a log line.

Keyboard/focus/a11y: N/A for trader UI. CLI meaning must survive **plain text / CI logs** (no ANSI-only). HTTP is curl/ops JSON + optional human print; not a dashboard table widget.

### 9. Acceptance criteria (UX-owned states + Verify by)

Actors: research operator / owner; trader (silence). Every user-visible or user-silence row maps to S0–S4. **(SB)** = ship-blocking for this feature’s honesty surface. PM may renumber into SPEC §3; marks travel with the rows. I do not invent payload keys in these rows.

| # | Story | Acceptance criterion | State(s) | Verify by |
|---|---|---|---|---|
| AC-U1 **(SB)** | US-T: As the desk owner, I want zero trader chrome for coverage holes. | `apps/dashboard` trader surfaces gain **no** new route, nav item, Settings copy, Ask-AI line, Ticker/Scanner/Positions affordance, tooltip, or toast mentioning session-archive coverage, missing SPY/QQQ/IWM books, or this audit command. | S0 unchanged | test |
| AC-U2 **(SB)** | US-T | Trader empty / error / offline / `unavailable this cycle` / `—` copy is **byte-unchanged** by coverage derive, warnings, CLI pass/fail, missing books, or unreadable books. | S0 unchanged | test |
| AC-U3 **(SB)** | US-T / Pages | Pages trader origin still **404s** `/api/_research` and `/api/_metrics` (and subpaths), including any coverage sibling under those prefixes. Coverage is not proxied to the trader origin. | S0 + S4 negative | test |
| AC-U4 **(SB)** | US-T / `/_ops` | `/_ops/metrics` gains **no** coverage matrix, coverage chip, or stage named from this feature. If coverage JSON rides `_metrics`, the existing page does **not** render it as p50/p95/headroom/`—`. | S4 unchanged | test |
| AC-U5 **(SB)** | US-O: As the operator, I want the same matrix on the audit command and the operator read. | CLI stdout and the operator coverage read print the **same** closed cell literals and hole phrasing for the same window. | S1 default + S3 | test |
| AC-U6 **(SB)** | US-O | On an eligible ET weekday **after** the locked checkpoint, each of SPY, QQQ, IWM is classified exactly one of `present` \| `missing` \| `unreadable` for that ET date. | S1/S3 cells | test |
| AC-U7 **(SB)** | US-O / honesty | `missing` ≠ `unreadable` ≠ `ineligible` ≠ `session archive not storing` ≠ `not yet due` end-to-end (cell, hole list, warning, verdict). No single “no data” / “coverage 0%” collapse. | all S1/S2/S3 degraded | test |
| AC-U8 **(SB)** | US-O / honesty | Weekend / `!is_et_weekday` dates are **not** expected columns and are **not** `missing`. A today-only weekend run is `[NOT DUE]`, not `[PASS] n/n present`. | not due / ineligible | test |
| AC-U9 **(SB)** | US-O / honesty | Seed fixture `(SPY, 2020-01-02)` is **excluded** from expected identities and from unlabeled last readable. | default + last readable | test |
| AC-U10 **(SB)** | US-O / clock | Before the locked checkpoint, today’s eligible cell is `not yet due` — not `missing` — and **no** S2 warning fires for that identity. | not yet due | test |
| AC-U11 **(SB)** | US-O | After checkpoint, a `missing` due identity produces **exactly one** structured warning `session archive coverage warning — missing expected book {SYMBOL} {ET_DATE}` for that pair (not a permission-denied flood). | S2 missing | test |
| AC-U12 **(SB)** | US-O | After checkpoint, an `unreadable` due identity produces **exactly one** structured warning `session archive coverage warning — unreadable expected book {SYMBOL} {ET_DATE}` — distinct from the missing line. | S2 unreadable | test |
| AC-U13 **(SB)** | US-O | `cargo run -p api-rust -- archive-coverage` (or Architect’s renamed clap that still prints this title) prints the matrix and exits **non-zero iff** any **due** expected identity is `missing` or `unreadable`. | S3 pass / fail | test |
| AC-U14 **(SB)** | US-O | Vacuous / not-due window exits **0** and prints `[NOT DUE]… Not a coverage pass.` — never a PASS-all-present. | not due | test |
| AC-U15 **(SB)** | US-O | Store disabled yields `session archive not storing`, **no** all-missing matrix, CLI **non-zero** `[ERROR]`, **no** per-cell warning storm. | error — not storing | test |
| AC-U16 **(SB)** | US-O | Coverage path makes **zero** Massive / vendor calls (including on missing/unreadable/disabled). A vouched vendor call is `[ERROR]`, not a filled hole. | default / error vendor | test |
| AC-U17 **(SB)** | US-O / honesty | A reconstructed / flat-file artifact is **never** classified `present` and **never** labeled `live_massive`. | blocked reconstructed | test |
| AC-U18 **(SB)** | US-O | Last readable is shown per symbol when any present non-seed identity exists; otherwise `none (seed fixture excluded)` — never a fabricated date or silent seed. | default | test |
| AC-U19 **(SB)** | US-O | CLI standing block includes **Evidence: local** and closing **local audit is not production coverage**. A local receipt is not labeled hosted/CI/production-verified. | S3 standing | test |
| AC-U20 **(SB)** | US-O | Coverage / warning / CLI failure **never** fails bundle / scan / SSE / ensure and does not change score / tier / fingerprint. | S0 + isolation | test |
| AC-U21 **(SB)** | US-O | Operator HTTP (if any) is token-gated like `_metrics` / `_research` (not trader session cookie). Bad token → shipped `metrics_unauthorized` copy, not a fake empty matrix. | HTTP unauthorized | test |
| AC-U22 **(SB)** | US-O | Counts print as class totals against **n expected due**, not a bare percent health score. Hole list uses `missing` / `unreadable` per identity. | default / fail | test |
| AC-U23 **(SB)** | US-O | No `live` / `LIVE` badge or “this quote is live” / “Live coverage” header on matrix, warning, or CLI. Provenance `live_massive` stays off this matrix (load vehicle only). | default | test |
| AC-U24 | US-scope | SPEC §4 carries **`NO_UI_CHANGE`**; no `DESIGN_SYSTEM.md` amendment; no new tokens/components/patterns. | S0 / canon | review |
| AC-U25 | US-scope | Standing-block wording, glossary sentences, and row order SPY→QQQ→IWM are the approved copy (intentional). | default | review |
| AC-U26 | US-O | Operator can obtain the matrix **without** the trader UI (CLI and/or Railway-direct operator GET). | S1 / S3 | review |
| AC-U27 | US-O | Warning copy does not assert dollar loss, prune timing, or Massive recoverability — those are not vouched fields on the warning. | S2 | review |
| AC-U28 | US-isolation | Existing session-book list/load closed strings (`no session book…`, `session book unreadable: <reason>`, `RESEARCH READ — SESSION BOOK`) remain on the **load/list** vehicle and are not overwritten by coverage framing. | S1 vs session load | test |

**Method notes (risk-based):**

- **`test`** — silent regressions: trader chrome absence (structural scan / empty-diff), Pages 404, `/_ops/metrics` closed stage set (coverage not rendered as latency), four-plus absence classes, seed exclusion, pre-checkpoint `not yet due`, one-warning-per-identity (including a flood-poison: many write errors still one coverage warning), CLI exit vs holes, vacuous NOT DUE ≠ PASS, disabled ≠ all-missing, zero vendor calls, reconstructed not `present`, last-readable seed hedge, local-evidence string on CLI, score/bundle isolation, token gate, no Live badge, list/load framing not overwritten.
- **`review`** — intentional copy (standing-block prose, glossary, SPY/QQQ/IWM order), SPEC §4 `NO_UI_CHANGE`, warning not claiming `$199`, operator path exists without trader UI.
- No DOM harness required for ship; trader silence is structural. CLI/HTTP literals asserted by unit / GATE Q. Do not invent parallel copy fixtures or a VERIFY_MATRIX.md.
- Hollow “renders without throw” does **not** satisfy the `test` marks on absence classes or one-warning.

### 10. Microcopy integrity (defining failure mode)

| Claim | Vouched by | Disposition |
|---|---|---|
| Cell `present` | Expected identity exists and body loaded from session archive | Allowed |
| Cell `missing` | No archive row for a **due** expected identity | Allowed |
| Cell `unreadable` | Row/pointer exists; body load failed | Allowed — **not** a rename of missing |
| `not yet due` | Eligible today + checkpoint not passed | Allowed |
| `ineligible` / NOT DUE | Window has zero due expected identities (`!is_et_weekday` or pre-checkpoint with no other due dates) | Allowed — **not** PASS |
| `session archive not storing` | Archive disabled/unavailable | Allowed — matrix withheld |
| Last readable `{SYMBOL} {ET_DATE}` | A non-seed present identity actually loaded | Allowed |
| `last readable: none (seed fixture excluded)` | No non-seed present identity | Allowed |
| `0 Massive calls` | Coverage path vendor counter / isolation | Allowed only if vouched |
| `Evidence: local` | This CLI process | Allowed on CLI; **banned** as a production label |
| “Live coverage 77.8%” / “healthy” / “verified” | **No field** | **Withdrawn / banned** |
| “Permission denied” as the coverage class | OS write error, not identity class | **Banned as the operator signal** (replaced by one missing/unreadable warning) |
| Seed `SPY 2020-01-02` as present coverage | Conformance plant | **Banned** from expected / unlabeled last readable |
| Reconstructed body as `present` / `live_massive` | Would falsify provenance | **Banned** |
| `$199 Options day lost` on the warning | BRIEF motive, not a runtime field | **Banned** on S2/S3 |
| Coverage as live score input | Score path must stay byte-identical | **Banned** |

### 11. Out of UX scope (hand to other lanes)

- Whether coverage JSON rides `GET /api/_metrics` or a sibling `_research` path (Architect). Both must stay operator-token, zero Massive, unlinked from trader UI. I own copy **on whichever vehicle**, and I own that `/_ops/metrics` does not grow a widget.
- Exact ET checkpoint clock and expected-date window (PM + Architect). I own that those locks are **printed** and that pre-checkpoint ≠ missing.
- Clap binary name if renamed; I own stdout title `archive-coverage` remaining grep-able and not an alias of `serve` / `score-lab`.
- Warning transport (tracing field set, metric counter vs log). I own the **one line per identity** and the flood ban.
- How list/load distinguishes missing vs unreadable internally. I own that the operator still sees two literals.
- Railway volume runbook thresholds (26 Aug rec #4) — **not** this matrix; do not label disk % as session-book coverage.
- Holiday calendars beyond `is_et_weekday`.
- Payload field names and endpoint signatures (Architect / synthesizer).

## Risks I see

1. **“Live coverage” leak from the 26 Aug audit table.** That document is source context. Reusing its header on CLI/HTTP collides with the Live-badge ban and will be quoted as a market feed. The replacement is **expected identities** + `present`.
2. **Vacuous PASS on weekends.** Exit 0 with zero expected dates will be screenshotted as “coverage green” unless `[NOT DUE]… Not a coverage pass.` is mandatory.
3. **All-missing when the store is disabled.** The helpful implementation prints 3×N `missing` plus N warnings — the exact collapse `[absent-is-not-none]` forbids. Disabled is an **error**, not a hole list.
4. **Permission-denied flood survives beside the new warning** without replacing it as the signal. Operators will still miss the one identity line. The coverage warning must be greppable as `session archive coverage warning` and must not require reading thousands of write skips.
5. **Local CLI quoted as production.** Highest integrity risk after class collapse. Standing **Evidence: local** is load-bearing.
6. **`/_ops/metrics` helpfulness.** Putting coverage on `_metrics` JSON plus “just one card” on the latency page re-scopes into a UI-touching spec without a design-system amendment. I refuse that in R1.
7. **Reconstructed fill pressure.** After the Aug 24–25 SPY hole, the temptation is to show a reconstructed book as `present`. That is a provenance lie. Matrix must stay empty/`missing` rather than look complete.
8. **Pre-checkpoint missing warnings.** A warning at 09:30 ET that “today is missing” trains the operator to ignore the real post-checkpoint hole. `not yet due` exists to stop that.
9. **Session-book load framing reused on coverage.** `RESEARCH READ — SESSION BOOK` on a matrix with no body is a silent rename of the load vehicle.
10. **Percent headline.** `7/9` becoming `78% healthy` in a dashboard or log aggregator.

## Assumptions I'm making about the other two lanes

- **Architect** will derive coverage from existing session-archive `list`/`load` (`apps/api/src/services/session_chain_archive/store.rs`) with **zero Massive** on that path, including miss/unreadable/disabled.
- **Architect** will place the operator matrix on **either** additive `GET /api/_metrics` JSON **or** a sibling `/api/_research/...` read — both operator-token (`METRICS_SECRET_TOKEN` / shipped `metrics_unauthorized` copy), both unlinked from trader UI, both still 404 from Pages if under those prefixes — and will **not** add a trader route.
- **Architect** will **not** extend `@convexa/api` `MetricsScope` / `OperatorMetrics` to render coverage as latency stages this ship (`NO_UI_CHANGE`).
- **Architect**’s expected-identity rule is `ENSURE_SYMBOLS` (SPY, QQQ, IWM) × `is_et_weekday` in a named window, **excluding** seed `(SPY, 2020-01-02)`; a weekend date is not an expected identity.
- **Architect** classifies `present` iff the expected identity exists **and** the body loads; `missing` iff no row; `unreadable` iff row/pointer without a readable body — three outcomes the operator can see without reading server internals.
- **Architect** exposes a locked ET checkpoint instant so UX can treat pre-checkpoint today as `not yet due` rather than `missing`; coverage/warning will not classify today as a hole before that instant.
- **Architect** emits **at most one** structured warning per `(symbol, et_date)` while that hole class holds after checkpoint (deduped; not per write attempt).
- **Architect** adds a clap command the operator can invoke as `archive-coverage` (BRIEF name; rename allowed if stdout still titles `archive-coverage`) that prints the **same** matrix as the HTTP read and sets process exit non-zero iff a **due** expected identity is missing or unreadable.
- **Architect** will not insert reconstructed/flat-file bodies as `source: live_massive`; coverage will not see a fourth “reconstructed” cell type unless they add a new source kind — in which case it still must not print `present`.
- **Architect** keeps coverage/warning failure off bundle / scan / SSE / ensure (`[best-effort-isolated-or-null]`) and off scoring inputs (`[additive-keeps-score-byte-identical]`).
- **PM** will lock the **window** of expected dates (today-after-checkpoint vs all eligible weekdays since the archive could store) and the **checkpoint clock**; those locks will appear in SPEC so the standing block can print them rather than invent them.
- **PM** will **not** add trader UI, a `/_ops` coverage widget, a paid monitoring subscription, or a coverage % SLO this ship; SPEC §4 will carry `NO_UI_CHANGE`.
- **PM** accepts `not yet due` and `[NOT DUE]` as product states required by `[absent-is-not-none]`, not as UX gold-plating.
- **PM** accepts that last readable **excludes** the seed fixture, even if that leaves `none` while `SPY 2020-01-02` exists in the store.
- **PM** will not require holiday-calendar eligibility beyond cited `is_et_weekday` (weekday US-market holidays may therefore appear as expected and `missing` if no book exists).
- **PM** will fold these AC-U rows into SPEC §3 with the `Verify by` marks intact, and will not replace `test` on absence-class / one-warning / exit-code rows with `review`.
- **PM** will not ask the warning or CLI to assert `$199`, prune remaining TTL, or Massive recoverability — those stay in research prose, not runtime copy.
)
