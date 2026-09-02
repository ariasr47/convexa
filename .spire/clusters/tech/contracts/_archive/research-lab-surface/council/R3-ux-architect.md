# R3 — ux ↔ architect: research-lab-surface

One exchange. Surface: runtime **API origin** (operator-visible, not a secret, not in the URL) + **origin-rejected / origin-blocked** in the state matrix, distinct from unauthorized, empty list, coverage-unavailable, and generic readout-unavailable.

Conflicts folded here (not re-fought): `c4d9ff27…` / `9e4eb456…` / `d366050e…` (page memory only; no `sessionStorage` / `localStorage`); `1632c838…` (PM self-revision: weekly list/open needs a runtime non-Pages API origin); architect `bef7d221…` classification (origin-blocked is the **research base URL**, not the dashboard location host).

Honor, not reopened: human **A** 2026-08-31 (books spine + partitioned coverage card; coverage speaks closed cells only; books table never says `present`); no export; DESIGN_SYSTEM SET — clone `/_ops/metrics` chrome; no new motion family; token never in query / title / error text / aria / logs.

I do not name new endpoints, JSON keys, or CORS allowlist env. Occupancy decks are untouched.

---

## Converged

**CONVERGED (this lane)** on architect’s already-named mechanism:

- Page-local client; absolute API origin as **runtime input**; `credentials: 'omit'`.
- Reject host `*.pages.dev`; **do not** retry relative `/api/_research`.
- Token + origin live in **page memory for this tab only**. Refresh re-asks both.
- Pages `_research` 404 stands. Dashboard JS may load on Pages; that location host is **not** the origin-blocked classifier.
- Origin is a **public URL**, not a secret — and still not baked, not in the query string, not in `document.title`, not interpolated into Alert/aria-live, not logged.

UX owns the control, the exact strings, and the matrix rows below. Architect owns parse / reject predicates, 404-vs-miss classification, and whether a fault is CORS vs unclassified network. If CORS cannot be classified, use **offline** copy — never empty, never occupancy, never `origin-blocked`.

Coverage (ruling **A**) is fetched **only** after origin is committed and not rejected/blocked. Origin-blocked suppresses both the books GET and the coverage GET. A later coverage-only fault is **not** origin-blocked.

---

## What I withdraw

From `R1-ux.md` (I can no longer defend these as the gate):

1. **Token-only unlock.** R1 specified a password field and `Unlock` with no API-origin control. Copying metrics’ relative fetch 404s the research family on Pages. I withdraw “metrics-like same-origin GET” as this page’s transport.

2. **“If the server has no metrics token configured, skip the form and fetch without the header (today’s metrics client behavior).”** Origin is still required. Token-unset means **omit the header**, not skip the form, not skip origin.

3. **“Cold visit with no token stored: unauthorized (locked form).”** Cold visit with **no committed origin** is the locked form, not `metrics_unauthorized` and not empty-corpus. Unauthorized is 401 (or a fetch sent with no header that 401s). Origin-rejected / origin-blocked are not 401.

4. **Generic `Session archive readout unavailable.` as the home for a research-family 404.** That string stays **offline / unclassified cold transport**. A 404 of the research family is `origin-blocked`.

5. Any reading of PM’s original “opening this URL on that origin is origin-blocked” as **dashboard-location** origin-blocked. I accept architect: classify on the **typed research base URL** (empty, `*.pages.dev`, or research-family 404). A Pages-hosted `/_ops/research` document is allowed; it still cannot same-origin list/open.

I do **not** withdraw: `/_ops/research` off-shell chrome; `Metrics token` + `Unlock`; `metrics_unauthorized` copy; coverage card (ruling A); books table prints `source` verbatim and never `present` / `kept`; no export; no new motion.

---

## Named chrome (API origin)

Clone `/_ops/metrics`: own `AppBar` `h6`, outlined `read-only` chip, `Container maxWidth="lg"`, `Alert` + icon on warning, dense body, no live pulse, no `Instrumentation: ON` cargo-cult, no fourth arc, no Lab hover-lift. Existing MUI `TextField` — **not** a DESIGN_SYSTEM amendment.

### Gate form (before any corpus claim)

Always this order, stacked at 393px (no horizontal overflow). Visible `<label>` on both fields (not placeholder-only). Unlock ≥44px on coarse pointers. `autocomplete="off"` on both. `spellCheck={false}` on origin. Focus-visible ring from theme.

| Control | Exact label / name | Type | Helper (exact) | Must not |
|---|---|---|---|---|
| Origin | **`API origin`** | `text` + `inputMode="url"` (not `password`, not `type="url"` — native “enter a URL” must not replace our Alert) | **`Public API base URL. Not a secret. Not the Pages host. Refresh forgets it.`** | Prefill from `window.location.origin`; bake a host; `?origin=`; remember-me; paste into query/hash |
| Token | **`Metrics token`** | `password` | **`Same token as Operator Metrics. Not a trader session.`** | Echo value; `autocomplete="token"`; trader cookie as fallback |
| Submit | **`Unlock`** | button | — | `color="success"`; a second “Connect” |

**ⓘ tooltip on `API origin` (exact):** `Absolute http(s) origin of the API that serves the research family. A Pages host 404s /api/_research. Do not paste a metrics token here. Refreshing this tab forgets the origin and the token.`

**ⓘ tooltip on `Metrics token` (exact):** `Same operator token as Operator Metrics. Not a trader session. The value is never shown after Unlock, never put in the URL, and never announced.`

**Form caption under the AppBar while locked (no Alert yet, exact):** `Unlock with the API origin and the metrics token. A Pages host 404s the research family.`

**Extra helper, only when `window.location.host` is `*.pages.dev` (exact, not a page state):** `This page is on Pages. Type the API origin. Do not use this host.`

This helper does **not** flip origin-blocked. Location host is not the classifier.

No placeholder host. No Railway name. No `$398`. No “weekly corpus.”

### Memory / commit

- Draft values live in the inputs. **Committed** origin + token are whatever the last **Unlock** accepted into page memory.
- Unlock with a rejected origin **does not fetch**. Committed origin stays previous (or none).
- Unlock with a non-Pages absolute `http:` / `https:` origin **commits** that origin, then GETs (token header only if the field is non-empty; empty token → omit header, do not skip origin).
- Refresh clears committed and draft memory. Re-ask is expected, not data loss.
- After a 200 list or coverage body: collapse the gate. Control **`Change origin or token`** reopens both fields (token still masked; origin value stays in the input, not copied into standing prose). Further list/open in the sitting does not re-demand Unlock until they change origin/token or refresh.
- Collapsed gate must **not** print the origin string as chrome (“Connected to …” is banned). The input is the only place the URL is visible, and only while the form is open.
- `document.title` stays **`Session archive — Convexa`**. AppBar stays **`Convexa · Session archive`**. Neither interpolates origin or token.

### Ban on leaking the origin string (same class as token, except the input itself)

Never place the typed origin or the token value in: query string, hash, `sessionStorage`, `localStorage`, `document.title`, Alert title/body/caption, `aria-live`, `aria-label` / `aria-describedby` of the Alert, logs. Alerts name the **class token** only. The origin input’s accessible name is `API origin`; its value is not copied into an announcer.

### Occupancy hygiene (hard)

Origin chrome is **not** a coverage cell and **not** a books-row status.

| Must never appear in origin / unauthorized / CORS / offline Alerts | Lives only here |
|---|---|
| `present` · `missing` · `unreadable` · `not yet due` · **`blocked occupancy`** | Coverage matrix cells / holes |
| `kept` | Out of v1 (extracts) |
| `RESEARCH READ — NO SESSION BOOK` · `no session book for …` | Empty list / load miss |
| `session archive not storing` | Not-storing error |
| `live` / `LIVE` / `LiveMassive` as a badge | Never (list `source` stays verbatim in the table) |

**`origin-blocked` must never contain `blocked occupancy`. A coverage cell `blocked occupancy` must never contain `origin-blocked`.** Different slots, different facts.

---

## State-matrix rows (gate + origin)

Baseline R1 rows (loading / default / empty / error / offline / stale / success / coverage nested) stand, with these **first-class** gate rows inserted **before** any corpus claim. Empty-of-books is still empty. Coverage-unavailable is nested, not a page origin class.

| State | When (classifier — Architect) | Operator sees (exact) | Can do next | Must not happen |
|---|---|---|---|---|
| **locked** | Cold visit: no committed origin, no Unlock yet | AppBar **`Convexa · Session archive`** + `read-only`. Caption **`Unlock with the API origin and the metrics token. A Pages host 404s the research family.`** Fields `API origin` + `Metrics token` + **`Unlock`**. No Alert. No table. No coverage card. `Authorizes:` withheld. | Type origin (and token if required), Unlock | Fetch `_research`; `metrics_unauthorized`; `origin-blocked`; `no session book…`; occupancy cells; relative `/api` GET |
| **origin-rejected** | Unlock (or equivalent commit) with: empty/whitespace origin, host `*.pages.dev`, or not an absolute `http:`/`https:` URL (including relative `/api…`). **No research GET.** | Warning `Alert` + icon, `role="alert"`. **Title `origin-rejected`.** Body is **exactly one** of: (empty) **`API origin is required. Type the API process base URL. Not a Pages host.`** · (pages.dev) **`Pages origin cannot serve the research family. Type a non-Pages API origin. Do not retry as a relative /api path.`** · (not absolute http(s) / relative) **`API origin must be an absolute http(s) URL. Relative /api paths 404 on Pages.`** Form stays. Focus → origin field. No corpus body. | Fix origin, Unlock | Any `_research` GET; relative retry; 401 copy; empty-list framing; `Session archive readout unavailable.`; `blocked occupancy`; keeping a prior list from another origin as if it were this one |
| **origin-blocked** | A research-family GET was issued to the committed origin and that origin **404s the research family** (Pages Function body or any 404 of this prefix). Not miss. Not empty. | Warning `Alert` + icon, `role="alert"`. **Title `origin-blocked`.** Body **`This API origin 404s the research family. Not an empty corpus. Pages does not proxy /api/_research.`** Caption **`Operator tool only — the trader bundle and SSE are unaffected.`** Form stays (or reopens). No books table. No coverage matrix. `Authorizes:` withheld. | Change origin, Unlock | Framing `RESEARCH READ — NO SESSION BOOK`; `no session book for SPY`; `metrics_unauthorized`; minting `missing` cells; proxying to 200; `Retry` that relative-fetches; occupancy words in the Alert |
| **unauthorized** | 401 `metrics_unauthorized` after a non-rejected origin GET (missing or wrong token; cookie-only still 401). Origin was accepted as non-Pages. | Warning `Alert` + icon, `role="alert"`. **Title `metrics_unauthorized`.** Body **`Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token`.** Helper **`Same token as Operator Metrics. Not a trader session.`** Form stays. Focus → token field. Origin field remains (not cleared). No corpus body. | Type token, Unlock | Origin-blocked copy; empty-list copy; fetching again without the header after 401; putting the value in the URL; logging the value; treating cookie as gate |
| **cors-fault** | View-model classifies **CORS / cross-origin block** (Architect). If unclassified TypeError → **offline**, not this row. | Warning `Alert` + icon, `role="alert"`. **Title `Cross-origin request blocked`.** Body **`The browser blocked this cross-origin research request. Not an empty corpus. Not unauthorized. Not a Pages research 404.`** Caption **`Operator tool only — the trader bundle and SSE are unaffected.`** Button **`Retry`**. Form may stay collapsed if origin was committed. No corpus body. | Retry (same committed origin); or Change origin or token | `origin-blocked`; `metrics_unauthorized`; `no session book…`; allowlist env names; claiming the corpus is empty; occupancy cells |
| **offline** (restated) | Network / unclassified transport failure, **no** prior body, **not** a research-family 404, **not** classified CORS, **not** 401 | Warning `Alert` + icon. **`Session archive readout unavailable.`** Caption **`Operator tool only — the trader bundle and SSE are unaffected.`** Button **`Retry`**. | Retry | Origin-blocked title; empty-list framing; coverage `missing` blanks |
| **empty** (restated) | 200 list `count === 0`, `store: miss`, framing **`RESEARCH READ — NO SESSION BOOK`** | Standing + info Alert of payload **`detail`** (e.g. `no session book for SPY`). Coverage card still renders if **that** GET succeeded. | Switch symbol; read coverage | `origin-blocked`; `origin-rejected`; `metrics_unauthorized`; not-storing copy |
| **coverage-unavailable** (nested; origin already committed) | List (or page) is not origin-blocked; coverage GET fails as transport/5xx that is **not** not-storing / not 401 / not research-family 404 | Partitioned coverage card: **`Coverage readout unavailable.`** Caption **`Session books below are not coverage cells.`** No matrix of `missing`. Books list **remains** if list 200. | Retry coverage with page Retry; read books | Filling three `missing` cells; `origin-blocked` on the card; `blocked occupancy` as the card title; hiding a good list |
| **coverage withheld** (nested; already R1) | Coverage 500 not-storing / store error | **`session archive not storing`** or **`session archive store error: <reason>`** at matrix level — not three `missing` cells, not origin-blocked | Retry | Collapsing into origin-blocked or empty list |
| **stale** (restated) | Prior default/empty exists; a later poll/load fails as **network/5xx**, committed origin unchanged and still not 404 | Keep last list + last coverage + last digest. Chip **`Couldn't refresh — keeping the last list.`** | Retry; open already-listed rows in memory | Blanking; treating this as origin-blocked; interpolating zeros |
| **stale vs origin-blocked** | Committed origin later 404s the research family | **origin-blocked** — hide corpus body (do not keep a list on a blocked origin) | Change origin, Unlock | AC-24 last-list keep (that row is refresh-fail, not 404-of-family) |

**Loading** (unchanged string): in-flight after a committed non-rejected origin, no prior body → **`Loading session archive…`** + small `CircularProgress`. Not origin-blocked, not empty.

**Not-storing / unreadable / load miss / invariant-fault** stay R1 error rows (`session archive not storing`, `session book unreadable: <reason>`, `no session book for <SYMBOL> on <ET_DATE>`, vendor_called / authorizes fault). None of those titles may be reused for origin classes.

### Distinguishability cheat-sheet (operator-visible titles)

| Class | Exact title / framing the operator can see without source |
|---|---|
| origin-rejected | `origin-rejected` |
| origin-blocked | `origin-blocked` |
| unauthorized | `metrics_unauthorized` |
| cors-fault | `Cross-origin request blocked` |
| empty list | `RESEARCH READ — NO SESSION BOOK` |
| coverage-unavailable | `Coverage readout unavailable.` |
| generic cold fail | `Session archive readout unavailable.` |
| coverage cell (wrong occupant) | `blocked occupancy` (matrix only) |

PM AC-26’s slash line `origin-blocked / research unavailable` is **not** on-screen. “Research unavailable” would collapse into generic readout-unavailable. I bind **`origin-blocked`** as the title.

### Flow (origin sitting)

1. Operator types `/_ops/research`. Locked chrome. No GET.
2. Types API origin (+ token if this API requires it) → **Unlock**.
3. Client reject → **origin-rejected**, no GET, no relative fallback.
4. Else GET list (default SPY) + coverage (server-default date) against committed origin, metrics header pair if token non-empty, credentials omit.
5. 404 family → **origin-blocked**. 401 → **unauthorized**. Classified CORS → **cors-fault**. Unclassified cold fail → **offline**. 200 empty list → **empty** (coverage may still be default). 200 with rows → **default**.
6. Coverage-only fail after a good list → nested **coverage-unavailable** or **coverage withheld**. Books stay.
7. Refresh tab → locked again (memory gone).

No export control. No `present` on the books table. Coverage cells stay the closed deck. `present` is the only cell that loads a book.

---

## Verify-by (origin arms → SPEC §3)

UX owns these marks. Dump-absence / sibling-vehicle Verify-by is the other pair.

| Observable | State(s) | Verify by | Why |
|---|---|---|---|
| Gate shows visible label **`API origin`** (not password) and **`Metrics token`** (password) and **`Unlock`** | locked / origin-rejected / unauthorized | **review** | Visible chrome |
| Typed origin and token are absent from URL, `document.title`, Alert text, and aria-live after typing / Unlock | all gate states | **test** | Secret / origin egress is silent |
| No `sessionStorage` / `localStorage` write of origin or token | all | **test** | Persistence is silent |
| Unlock with empty origin issues **no** research GET and shows title `origin-rejected` | origin-rejected | **test** | Collapse into empty is silent |
| Unlock with `*.pages.dev` origin issues **no** GET, does **not** relative-retry, title `origin-rejected` | origin-rejected | **test** | Pages fallback is silent |
| Research-family 404 → title `origin-blocked`, **not** `RESEARCH READ — NO SESSION BOOK`, **not** `metrics_unauthorized` | origin-blocked | **test** | AC-26/27 class split |
| 401 → title `metrics_unauthorized`, **not** `origin-blocked` | unauthorized | **test** | Gate split |
| 200 `count === 0` → empty framing, **not** `origin-blocked` | empty | **test** | Absence split |
| Classified CORS → `Cross-origin request blocked`, **not** `origin-blocked`, **not** empty | cors-fault | **test** | If the client cannot classify CORS, this row is N/A and offline tests apply — do not fake CORS copy |
| Unclassified cold transport → `Session archive readout unavailable.`, **not** `origin-blocked` | offline | **test** | Generic vs origin |
| List 200 + coverage transport fail → `Coverage readout unavailable.` with books still shown; no `missing` matrix; not `origin-blocked` | coverage-unavailable | **test** | Nested ≠ page origin |
| `origin-blocked` Alert text does not contain `blocked occupancy`; coverage cell `blocked occupancy` is absent from that Alert | origin-blocked | **test** | Occupancy rename |
| Pages trader-origin request to `/api/_research/...` still 404s (no Function proxy) | S0 | **test** | Already poisoned; unchanged |
| No export/download control | default / success | **test** | Folded Out |

Locked-form caption and ⓘ tooltips: **review**.

---

## Still split

None on chrome, copy, or which matrix row each class occupies.

Architect confirms (no new class, no new copy):

1. Empty / `*.pages.dev` / non-absolute URL = **origin-rejected**, zero GETs, no relative retry.
2. Any 404 of the research prefix after a committed origin = **origin-blocked**, not miss, not empty.
3. CORS only when the view-model can say so; otherwise **offline**.
4. Coverage GET is not issued while origin-rejected or origin-blocked.

I will not invent a fourth origin title. I will not put the origin string on the Alert to “help.”

**CONVERGED.** Ready for `decisions.md` fold.
)
