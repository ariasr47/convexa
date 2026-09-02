# R1 — pm position: research-lab-surface

## Position

### Who this is for, and what job it does

The buyer is the **research operator / owner of the paid corpus**, not the trader on Landing /
Ticker / Positions / Scanner, and not a public visitor of `/lab`. Convexa already **keeps** prune-proof
session books for the liquid names, already **lists and loads** them on the existing research
family, and already **refuses** that family on the Pages trader origin. What it does **not** do is
let the operator **use that corpus weekly from a URL** the way they already use the metrics
surface — without a CLI binge, without a trader session, and without pretending the stored book is
live market.

The job: **from a dedicated operator URL (own chrome, unlinked, off the trader shell, not `/lab`),
with the metrics token and not a trader cookie, list SPY session books and open one dated book
without starting Massive.** Decision impact is whether the operator actually **opens the paid
corpus in a normal week**. A trader-origin Pages request to the research family still 404s. TopNav
still has no operator entry. `/lab` still means instrument demos.

This is an **operator corpus browser of already-kept session books**. It is not the public lab, not
a trader nav item, not a Pages proxy of research HTTP, not score-lab over HTTP, not a second ticker
replay player, and not a morning note. Occupancy words stay on the vehicles’ closed decks:
**`present` still means a loadable live-paid session book only; extracts stay `kept`.** This surface
does not launder those decks. `Authorizes: nothing`.

### Locked product rules (this slice)

| Lock | Product rule |
|---|---|
| **Audience** | Research operator / owner. Not a trader feature. Not a public `/lab` feature. |
| **v1 vehicle** | **Session books only** — the spine the brief names. List dated identities and load one book. |
| **Names** | Closed trio **SPY, QQQ, IWM**. Default list is **SPY** (the decision-impact observation). Not the scanner universe. |
| **Sibling vehicles** | **Not admitted this slice:** coverage matrix UI, day-tape browse/load, chain-snapshot ring browse, flat-file extract browse. Each has its own occupancy deck; mixing them on first ship is how `present` leaks onto `kept` / tape / fixtures. |
| **Route** | Dedicated operator URL **`/_ops/research`**, sibling of `/_ops/metrics` — **own chrome, unlinked from trader nav, not inside the trader shell, not a tab on metrics, not `/lab`, not `/_ops/lab`.** |
| **Public lab** | **`/lab` is unchanged:** instrument demos with synthetic data. This corpus browser **must not occupy it** and **must not be titled Lab** in operator-facing chrome (feature slug ≠ product name). |
| **Gate** | **Same operator metrics token** already used for the metrics surface. **Trader session cookie is not a gate and not a fallback.** Server is the boundary of record. |
| **Token UX** | Operator can complete list + open from the dedicated URL **without signing in as a trader**. Token is **never** placed in the URL, **never** shown in page copy after it is accepted, **never** logged. Query-string token is forbidden. Durable store of the raw token beside trader prefs is forbidden. After a successful gate in one sitting, further list/open in that sitting does not re-demand the token. Reload may re-ask — expected, not framed as data loss. When the service does **not** require a token (local unset), the surface still lists/loads; that is **not** the same state as “token accepted.” |
| **Read posture** | **List and load only.** No keep, no ensure, no fill, no vendor fetch, no recompute, no cache mutation, no trader-route call, no replay arm, no score-lab invocation. |
| **Open means** | A **digested research read** of that `(symbol, ET date)` session book: identity, capture time, research-not-live standing, authorizes-nothing, license (our research, not a trader feed), and enough digested confirmation that a paid options book loaded. **Not** a raw chain dump. **Not** the ticker workstation. **Not** a GEX chart. **Not** live tiles. **Not** SSE. **Not** replay. |
| **Occupancy on this screen** | This slice **does not speak the coverage deck** (`present` / `missing` / `not yet due` / `blocked occupancy`) because coverage UI is out. Vehicle language is **session book**. A loaded book is a **stored research session book**, never a Live badge, never “this quote is live.” Fixture / reconstructed / tape / extract occupants, if they appear at all, **cannot read as a live paid session book.** If provenance cannot support a live-paid claim, the UI **does not make that claim**. |
| **Origin** | Corpus data is available only from an origin allowed to reach the research family (the same class of access as operator metrics). **Pages trader origin still 404s the research family.** Opening this URL on that origin is **origin-blocked**, not an empty corpus. |
| **Freshness** | Static research read. **No auto-poll. No SSE.** Operator-initiated list/load only. Capture time is the as-of; the operator wall clock is not “the market is open now.” |
| **Backend** | **Product default: no new research HTTP and no new occupancy class.** Consume existing list/load. A thin adapter is not a product requirement. A lab/operator client, if any, **must not leak onto trader routes** and must not grow a trader research helper. |
| **Score / license** | **Authorizes: nothing.** Stored books remain our research, never a trader feed. Local list is **not** hosted/CI coverage. |

Exchange-holiday weekdays follow whatever the archive already kept; this surface does not invent a
holiday calendar. A date with no book is **no session book**, not ineligible, not a coverage miss
word.

### User stories

- **S1** — As the research operator, I want a **dedicated operator URL** I can type or bookmark
  (pattern of the metrics surface: own chrome, unlinked, off the trader shell) that **lists SPY
  session books** — and the same list for QQQ and IWM — so I can use the paid corpus in a normal
  week without a CLI binge and without opening trader nav.
- **S2** — As the research operator, I want to **open one dated session book** and see a **digested
  research read** of that identity (who, which ET date, when captured, not live, authorizes nothing)
  **without starting Massive**, so “Friday’s SPY book” is a URL action, not a shell session.
- **S3** — As the research operator, I want to do that with the **metrics token**, not a trader
  login, so a trader cookie cannot open the corpus and I am not asked to impersonate a trader to
  inspect our research.
- **S4** — As the research operator, I want **empty list ≠ archive not storing ≠ no such date ≠
  unreadable ≠ unauthorized ≠ origin-blocked ≠ in-flight ≠ refresh-failed-with-last-list**, so I
  never treat a gate failure as “we kept nothing,” and never treat a hole as a successful empty
  week (`absent-is-not-none`).
- **S5** — As the archive owner, I want this screen **unable to call a stored book live, unable to
  call an extract `present`, and unable to dump a raw chain**, so weekly use cannot launder
  occupancy or overwhelm the read (`present-is-live-paid-only`, `digested-labels-not-raw-dump`).
- **S6** — As the desk owner, I want this surface **off every trader path**, **unlinked**,
  **read-only**, **zero vendor I/O**, **Pages research 404 intact**, **`/lab` still demos**, and
  **score / tier / fingerprint byte-identical**, so browsing Tuesday cannot bill Massive, cannot
  take down the desk, and cannot become a public historical options API
  (`operator-vs-trader-path-separation`, `server-side-gate-enforcement`,
  `additive-keeps-score-byte-identical`).
- **S7** — As a reviewer, I want **no coverage/tape/snapshot/extract browser, no replay player, no
  score-lab HTTP, no morning note, no Pages proxy, no trader nav item**, so this ship cannot absorb
  the next harvest cluster.

### Scope

#### In

- Dedicated operator URL **`/_ops/research`**: own chrome, unlinked from trader nav, **not** inside
  the trader shell, **not** a tab on the metrics surface, **not** `/lab`.
- **Session-books corpus browser** for **SPY, QQQ, IWM** (default SPY): list dated identities;
  open one `(symbol, ET date)`.
- Operator supplies the **same metrics token** as the metrics surface; trader cookie does not pass;
  server refuses bypassed/absent client checks.
- **Digested research read** on successful open: identity, capture time, research-not-live
  standing, authorizes-nothing, license, digested confirmation — not a raw dump, not ticker chrome.
- Honest degraded states in S4, each distinguishable without reading source.
- Occupancy honesty: no Live badge; no `present` on extracts/tape/fixtures; fixture/reconstructed
  cannot read as a live paid session book.
- Read-only consume of **existing** research list/load; **zero vendor calls** on list, open, miss,
  unreadable, unauthorized, and origin-blocked.
- Pages trader origin continues to 404 the research family; this URL on that origin is
  origin-blocked, not empty-success.
- Structural silence on trader Landing / Ticker / Positions / Scanner / Settings / TopNav.
- `/lab` remains the public instrument-demo hub.
- Score / tier / fingerprint byte-identical; desk still serves if this surface fails.
- Secret hygiene: token never in URL, copy after accept, logs, or build artifacts.
- Local/this-environment list is not labeled hosted/CI/production coverage.
- Theme-token discipline and no new orchestrated motion (operator chrome in the existing metrics
  family). Dark/light parity is part of done.
- Hermetic GATE Q: planted books list and open; empty ≠ not-storing ≠ miss ≠ unreadable ≠
  unauthorized ≠ origin-blocked; zero vendor; Pages-style trader-origin refuse; TopNav still has no
  operator entry; `/lab` still demos.

#### Out

- Occupying **`/lab`** or renaming `/lab` into a corpus browser.
- A **trader nav item**, trader shell wrapping, Settings toggle, ticker widget, or Ask-AI line
  about kept books.
- A **tab on `/_ops/metrics`** (live pipeline trend ≠ static corpus).
- **Pages proxy** of the research family (the 404 stands).
- **Coverage matrix UI**, coverage audit command chrome, or speaking the coverage occupancy deck
  on this screen.
- **Day-tape** list/load UI; **chain-snapshot ring** list/load UI; **flat-file extract** list/load
  UI.
- **Second ticker replay player**, replay arm controls, pause/seek, or walking a book through the
  live ticker from this URL.
- **Score-lab over HTTP** (score-lab stays a CLI). Any in-app score comparison, train/holdout, or
  fingerprint rewrite.
- A **morning note** / grounded-morning snapshot product.
- Keep / ensure / fill / vendor fetch / recompute / cache mutation from this surface.
- Download/export of paid books (redistribution risk). Date-range search. Universe beyond the
  closed trio.
- Auto-poll or SSE on this surface.
- Query-string or durable-pref storage of the raw operator token.
- Changing live scoring, tier, entry gate, fingerprint, scanner, or live stream.
- Declaring the session-corpus wait complete; authorizing a score change.
- Parked harvest (Benzinga, squeeze, news, RL, hist-chain, public SaaS), remote body store,
  telemetry SLOs, Kubernetes/Kafka.

#### Future-dated

- Coverage matrix as a **sibling honesty read** on this operator URL family (closed coverage deck,
  still not `present` for extracts).
- Day-tape / chain-snapshot / flat-file vehicles on the **same operator URL family**, each with
  **its own occupancy deck** and no shared `present`.
- Deep-link a specific `(symbol, ET date)` for bookmarking Friday’s book.
- Optional digested structure-as-of-capture row (walls/flip/spot **as stored**, labeled captured,
  never live) — only if it stays a research digest, not a second ticker.
- Match token-entry habit with metrics if metrics later grows a tighter pattern; still no
  query-string token.
- Holiday calendar aligned with exchange closures (not required to browse what was actually kept).

### Product behavior

**Actors:** operator at a typed/bookmarked operator URL, holding the metrics token (or on a local
service that does not require one). **Not** the trader. **Not** a `/lab` visitor.

**Happy path**

| Situation | What must be true |
|---|---|
| Operator opens `/_ops/research` on an origin that can reach the research family, token accepted or not required | Own chrome. No trader shell nav. Default list is **SPY** session books. Zero Massive. |
| SPY has one or more kept session books | List names each as a **dated session identity** (symbol + ET date). Not labeled live. Not labeled hosted coverage. |
| Operator chooses QQQ or IWM | List is that symbol’s session books. Trio only. |
| Operator opens one dated SPY book that loads | Digested research read of **that** identity: capture time visible; standing is stored research, not live market; authorizes nothing; license our-research. **No Massive. No replay. No score-lab. No GEX workstation.** |
| Operator opens a second date in the same sitting | Allowed without re-passing the gate. Wrong date is not silently substituted. |
| Trader using the app as usual | Landing / Ticker / Positions / Scanner / TopNav unchanged. No new operator entry. `/lab` still demos. Score / tier / fingerprint unchanged. |
| Pages trader origin hits the research family | **404** — unchanged. |

**Degraded / edge states (each its own outcome — not footnotes on the happy path)**

| Situation | Observable outcome |
|---|---|
| Token required and missing | **Refused.** No book list body, no open body. Not an empty-corpus success. |
| Token required and wrong | **Refused** the same unauthorized class (no missing-vs-wrong oracle for an attacker). No corpus body. |
| Trader session cookie, no metrics token, token required | **Refused.** Cookie is not a fallback. |
| Token appears in the URL, in copy after accept, or in logs | **Forbidden.** Any of those is a fail. |
| Service does not require a token (local unset) | List/load **work**. Standing is not “authorized with token.” Distinct from refused and from token-accepted. |
| Selected symbol has no session books, archive is storing | **Empty list** — we checked, nothing kept for that name. Not not-storing, not unauthorized, not origin-blocked. |
| Session archive not storing | **Not storing** — distinct from empty list and from unauthorized. No fabricated week of books. Desk still serves. |
| Operator opens a date with no book | **No session book** for that identity. Does **not** substitute another date’s book. Zero Massive. |
| Identity exists but body cannot be loaded | **Unreadable**, not miss, not a successful research read, not live paid. Zero Massive. |
| First visit, network/API failure | **Error + retry.** Not an empty list. Not not-storing. |
| List had succeeded; a later refresh fails | **Last list kept** + could-not-refresh. Not emptied. No retry storm. |
| List/open in flight | **In-flight** standing, visually distinct from empty and from error. |
| This URL opened on an origin that 404s the research family (Pages trader origin) | **Origin-blocked / research unavailable.** Not empty-success. Not a proxy that then 200s the books. |
| Fixture / reconstructed occupant is listed or opened | **Cannot read as a live paid session book.** No Live badge. No coverage word `present`. |
| Extract / tape / snapshot would be the only occupant | **Not shown as a session book present.** Those vehicles are out; they must not appear under a live-paid or `present` label. |
| Operator asks the surface to keep / fill / fetch Massive / start replay / run score-lab | **Does not.** No such action succeeds. |
| `/lab` | Still **instrument demos**. This corpus is not there. |
| TopNav | **Still no operator entry.** |
| Coverage / hosted CI | This list is **this environment’s corpus**, not a hosted coverage pass. |

**Closed product rules (binding)**

1. **Operator feature, not a trader feature, not a public lab feature.**
2. **v1 vehicle = session books.** Coverage / tape / snapshots / extracts are Future vehicles, not
   unnamed siblings on first ship.
3. **URL = `/_ops/research`.** Not `/lab`, not `/_ops/lab`, not a metrics tab, not inside the
   trader shell, not linked from TopNav.
4. **Operator-facing name is not Lab.** `/lab` keeps that word.
5. **Gate = metrics token, server-side.** Trader cookie does not pass.
6. **Token never in URL / post-accept copy / logs / image.**
7. **Open = digested research read**, not raw dump, not ticker, not replay, not live.
8. **This screen does not use the coverage word `present`.** Session-book outcomes stay on the
   session-book deck (loaded research book ≠ no session book ≠ not storing ≠ unreadable).
9. **Read-only, zero vendor, no fill.**
10. **Pages research 404 stands.** Origin-blocked ≠ empty.
11. **Authorizes: nothing.** Local list ≠ hosted coverage.
12. **Do not absorb** score-lab HTTP, morning note, replay chrome, or parked harvest.

### Acceptance criteria

Observable from **the operator URL, trader nav, `/lab`, research-family reachability, vendor-call
absence, desk still serving, and score identity**. No source reading required. `Verify by` is
risk-based: `test` where silent regression is plausible; `review` where the behavior is
visible/intentional. Never one-test-per-AC. **(SB)** = ship-blocking.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-1 (SB)** | S1 | Given an origin that can reach the research family and a gate that is either accepted or not required, opening `/_ops/research` shows a list of **SPY** session books (dated identities) or the honest empty-list state for SPY — not a trader shell page, not `/lab`. | test |
| **AC-2 (SB)** | S1 | From that URL the operator can list **QQQ** and **IWM** session books the same way. Names outside the closed trio are not offered as corpus subjects. | test |
| **AC-3 (SB)** | S1 | Given at least one kept SPY session book, the list names that identity by **symbol and ET date**. | test |
| **AC-4 (SB)** | S1 | `/_ops/research` renders in **own operator chrome** and is **not** wrapped in the trader shell (no Ticker / Positions / Scanner nav on that URL). | test |
| **AC-5 (SB)** | S1 | Trader TopNav still has **no** control that navigates to this operator URL (or to any other operator/research URL). | test |
| **AC-6 (SB)** | S1 | `/lab` still presents the public **instrument-demo** hub and does **not** list or load session books. | test |
| **AC-7 (SB)** | S1 | `/_ops/research` is **not** the metrics URL: opening it does not replace or become `/_ops/metrics`, and the metrics URL still means the metrics surface. | test |
| **AC-8 (SB)** | S2 | Given a loadable SPY session book for ET date D, opening that identity shows a **digested research read of (SPY, D)** and completes with **zero vendor calls**. | test |
| **AC-9 (SB)** | S2 | A successful open shows **capture time**, **stored-research / not-live standing**, and **authorizes nothing** — visible without opening source. | test |
| **AC-10 (SB)** | S2 | Opening a session book does **not** start Massive, does **not** start ticker replay, does **not** open score-lab, and does **not** subscribe a live ticker stream. | test |
| **AC-11 (SB)** | S2 | The open view is a **digested** research read: it does not present a raw dump of the full options chain as the thing the operator is supposed to read. | review |
| **AC-12 (SB)** | S2 | Opening `(SPY, D)` does not silently show another date’s or another symbol’s book unlabeled. | test |
| **AC-13 (SB)** | S3 | When a token is required and none is supplied, list and open are **refused** and **no corpus body** is shown (not empty-success). | test |
| **AC-14 (SB)** | S3 | When a token is required and the wrong token is supplied, list and open are **refused** and **no corpus body** is shown. | test |
| **AC-15 (SB)** | S3 | When a token is required, a **trader session cookie without the metrics token** does not obtain the list or the book. | test |
| **AC-16 (SB)** | S3 | After a successful gate in one sitting, a subsequent list or open in that sitting succeeds **without** re-supplying the token. | test |
| **AC-17 (SB)** | S3 | When the service does not require a token, list/load still work, and that standing is **not** presented as token-accepted. | test |
| **AC-18 (SB)** | S3 | The operator token does **not** appear in the URL, in on-screen copy after it is accepted, or in logs produced by list/open. | test |
| **AC-19 (SB)** | S4 | Given a storing archive and zero session books for the selected trio name, the operator sees **empty list** (checked, nothing kept) — not not-storing, not unauthorized, not origin-blocked. | test |
| **AC-20 (SB)** | S4 | When the session archive is not storing, the operator sees **not storing** — not an empty-list success, not an all-books success — and the desk still serves. | test |
| **AC-21 (SB)** | S4 | Opening an identity with no session book reports **no session book** for that identity, does not substitute another book, and makes **zero vendor calls**. | test |
| **AC-22 (SB)** | S4 | Opening an identity whose stored body cannot be loaded reports **unreadable** — not miss, not a successful research read — and makes **zero vendor calls**. | test |
| **AC-23 (SB)** | S4 | On first visit, when the research family cannot be reached because of a network/API fault (not a trader-origin 404), the operator sees **error + retry** — not empty list, not not-storing. | test |
| **AC-24 (SB)** | S4 | After a successful list, a failed refresh **keeps the last list** and shows **could not refresh** — it does not empty the list and does not retry-storm. | test |
| **AC-25 (SB)** | S4 | While a list or open is in flight, that standing is **distinct from empty and from error**. | review |
| **AC-26 (SB)** | S4 | Given this URL on an origin that 404s the research family, the operator sees **origin-blocked / research unavailable** — not empty-success, and the research family is **not** proxied to 200. | test |
| **AC-27 (SB)** | S4 | Empty list, not-storing, no session book, unreadable, unauthorized, origin-blocked, and refresh-failed-with-last-list are **mutually distinguishable** without reading source. | test |
| **AC-28 (SB)** | S5 | A successful research read never shows a **Live** badge or copy that the quote/book is live market. | test |
| **AC-29 (SB)** | S5 | This surface does **not** label any extract, tape, fixture, reconstructed, or replay occupant as coverage **`present`** or as a live paid session book. | test |
| **AC-30 (SB)** | S5 | If a fixture or reconstructed identity is shown at all, it is **not** readable as a live paid session book. | test |
| **AC-31 (SB)** | S6 | List and open (including miss, unreadable, unauthorized, empty, not-storing) complete with **zero vendor calls**. | test |
| **AC-32 (SB)** | S6 | The surface offers **no** succeeding keep, ensure, fill, vendor-fetch, replay-start, or score-lab action. | test |
| **AC-33 (SB)** | S6 | A trader-origin request to the research family still **404s** (same family already refused on that origin). | test |
| **AC-34 (SB)** | S6 | No trader-facing route, nav item, Settings control, or ticker chrome is added for this corpus. | test |
| **AC-35 (SB)** | S6 | A trader API helper used on trader routes does **not** gain a research-family list/load helper. | test |
| **AC-36 (SB)** | S6 | If the operator surface fails (refused, origin-blocked, unreadable, not-storing, network error), trader bundle / scan / live stream still succeed. | test |
| **AC-37 (SB)** | S6 | For the same market inputs, opportunity score, tier, and state fingerprint are **byte-identical** with this surface unused vs used, and succeeding vs failing. | test |
| **AC-38 (SB)** | S6 | Canary secret values in the environment do not appear in this surface’s copy or logs. | test |
| **AC-39 (SB)** | S6 | Copy on a successful list does **not** claim hosted/CI/production coverage; a local/this-environment list cannot be read as a hosted pass. | test |
| **AC-40** | S7 | This ship does not add coverage-matrix UI, tape/snapshot/extract browsers, replay player chrome, score-lab HTTP, a morning note, or a Pages research proxy. | review |
| **AC-41** | S1 | Operator-facing chrome for this URL does **not** title the surface **Lab** (avoids collision with `/lab` demos). | review |
| **AC-42** | S1 | The surface introduces **no** new orchestrated motion family and binds color to theme tokens (zero hardcoded hex; dark/light parity). | review |

**Method notes (risk-based).**

- **`test` concentrates on silent path/occupancy/gate failures:** URL off-shell (AC-1/4/7), trio
  list (AC-2/3), TopNav and `/lab` non-occupation (AC-5/6), zero-vendor open and no live/replay
  start (AC-8/10/12), token refuse including trader-cookie (AC-13–15, AC-17), token egress
  (AC-18), class splits (AC-19–24, AC-26–27), occupancy (AC-28–30), zero vendor / no write actions
  (AC-31/32), Pages 404 and trader-helper leak (AC-33–35), desk isolation and score identity
  (AC-36/37), secrets and local≠hosted (AC-38/39). These can die under a “helpful” proxy, a
  trader-cookie fallback, or a Live badge while the page still looks like a demo.
- **`review` owns** digested-vs-dump composition (AC-11), in-flight vs empty as visible standing
  (AC-25), non-absorption of sibling vehicles (AC-40), not naming it Lab (AC-41), motion/token
  discipline (AC-42). A human notices a JSON dump, a “Lab” title, or a new animation; they may
  miss a TopNav href — that is why AC-5 is `test`.
- Prefer **one** operator-URL pass: token-required refuse → accept → SPY list with planted dated
  book → open that book zero-vendor + not-live standing → plant miss/unreadable/empty/not-storing
  as distinct → cookie-only refuse → origin that 404s research family → origin-blocked → TopNav
  scan → `/lab` still demos → score identity — not a named micro-harness per row.
- Dashboard unit/component tests plus the existing Playwright e2e harness may observe the URL,
  nav, and `/lab`. Do not demand one test per AC. Structural scans (TopNav, trader-helper leak,
  `/lab` fixture) are the right depth for path separation.
- GATE Q must show **both** a refusing unauthorized/origin-blocked path **and** an accepting
  list+open of a planted SPY book. A suite that only ever renders a page has not proved the gate.
- **H3:** this repo has a DOM harness (dashboard tests + Playwright). Paint-only copy stays
  `review`; load-bearing classification, gate, and path-separation stay `test`.

**Ship-blocking set:** AC-1–AC-39. AC-40–AC-42 are required scope/design-honesty checks (`review`).

### Product decisions locked in this position

1. **Audience = research operator.** Trader UI and public `/lab` are out.
2. **v1 vehicle = session books only.** Coverage / tape / snapshots / extracts are Future, not
   silent siblings.
3. **Names = SPY, QQQ, IWM; default SPY.**
4. **URL = `/_ops/research`.** Sibling of metrics; not a metrics tab; not `/lab`; not in the trader
   shell; not linked from TopNav.
5. **Product name on chrome ≠ Lab.**
6. **Gate = existing metrics token; server-side; cookie is not a fallback.**
7. **Token UX = in-sitting supply, never in URL, never durable beside trader prefs, never logged.**
8. **Open = digested research read of one dated book.** No raw dump, no ticker, no replay, no
   score-lab, no GEX chart.
9. **This screen does not say `present`.** Session-book deck only.
10. **NO_BACKEND_CHANGE is the product default.** Existing list/load is enough for these outcomes.
11. **Pages research 404 stands.** Origin-blocked is a first-class state.
12. **Authorizes: nothing.** Local list is not hosted coverage.
13. **Do not absorb** morning note, score-lab HTTP, replay chrome, or sibling corpora.

Architect names mechanism, client isolation, and whether any FE-only adapter is required to keep
trader helpers clean. Product binds the outcomes and locks above. If existing list/load **cannot**
list SPY books and open one dated book with zero vendor and distinguishable miss/unreadable/not-
storing, that is an **R2 conflict** — I will not silently shrink to a mock UI.

### Binding constraints restated

- **`operator-vs-trader-path-separation`:** own unlinked operator URL, off trader shell, read-only,
  no vendor fetch / recompute / cache mutation / trader-route call; Pages research 404 stands.
- **`present-is-live-paid-only`:** this UI never labels extracts / tape / fixtures as live paid
  `present`; it does not speak `present` at all this slice.
- **`server-side-gate-enforcement`:** metrics token is the gate; trader cookie is not; bypassed
  client check still refuses.
- **`additive-keeps-score-byte-identical`:** Authorizes nothing; never a scoring input.
- **`local-evidence-is-not-hosted-evidence`:** a local list is not hosted/CI coverage.
- **`no-secrets-in-image`:** token never logged, never in copy, never in URL, never baked.
- **`absent-is-not-none`:** empty ≠ not-storing ≠ miss ≠ unreadable ≠ unauthorized ≠ origin-blocked.
- **`structural-over-prose-enforcement`:** poison a TopNav operator entry, a `/lab` occupation, a
  trader research helper, a cookie-only pass, or a Live badge — and verification must go red.
- **`cited-code-is-verified-not-assumed`:** this position does not assert reusable source
  locations. Mechanism reuse is an architecture assumption below.
- **`single-motion-moment`:** no new orchestrated motion family.
- **`theme-token-discipline`:** operator chrome binds to the existing theme; dark/light parity.
- **`digested-labels-not-raw-dump`:** open is a digested research read, not a raw chain dump.

## Risks I see

- **Occupying `/lab` because the feature is named research-lab-surface.** That would destroy the
  public demo hub and violate the brief in one rename. AC-6/41.
- **Wrapping the URL in the trader shell “for consistency.”** That is a trader nav by another
  door. AC-4/5/34.
- **Tab-on-metrics.** Mixes a live poll surface with a static corpus and invites SSE habits onto
  books. AC-7.
- **Trader-cookie fallback** so “it works when I’m logged in.” That is a gate hole.
  `server-side-gate-enforcement`. AC-15.
- **Query-string token** for convenience. Leaks into history, screenshots, and support paste.
  AC-18.
- **Empty vs unauthorized vs origin-blocked collapsed.** A Pages 404 would read as “we kept
  nothing this week.” AC-13/19/26/27.
- **Live badge on a stored book.** Weekly use becomes a fake desk. AC-28–30.
- **Raw chain dump** as the open view. Unusable weekly; violates digested-labels. AC-11.
- **Helpful Massive fetch on miss** (“just get Friday”). Bills Options and races ensure. AC-10/31.
- **Pages proxy “so the operator can use it on the public site.”** The brief forbids it; the 404
  is the license wall. AC-26/33/40.
- **Admitting tape/extracts/coverage onto v1** and spending `present` on a `kept` file. I am
  **not** admitting those vehicles. AC-29/40. If architecture cannot distinguish fixture from
  live-paid on the books list, that is R2 — not a quiet `present`.
- **Growing a trader research helper** in the shared client because the operator URL needs one.
  AC-35.
- **Morning-note creep** (summarize the book as today’s briefing). Out. AC-40.
- **Unobservable criteria.** If synthesis rewrites rows into “the corpus is usable weekly”
  intentions, cut or restate them.

## Assumptions I'm making about the other two lanes

- The architecture lane can serve AC-1/3/8 from the **already-shipped** session-books list/load
  with a hard **vendor-call count of zero** on hit, miss, unreadable, empty, not-storing, and
  unauthorized — **without new research HTTP** (NO_BACKEND_CHANGE). If a new endpoint is required
  to list SPY books or open one dated book, that contradicts this default and is an R2 conflict,
  not a quiet adapter.
- The architecture lane can mount `/_ops/research` the same way `/_ops/metrics` is mounted:
  **first-class dashboard URL, outside the trader shell, unlinked.** If the only way to ship a
  dashboard URL is inside the trader shell, that contradicts AC-4 and is an R2 conflict — I will
  not accept “just hide the nav.”
- The architecture lane can keep `/lab` as the instrument-demo hub with **zero** session-book
  list/load on that route (AC-6). If they propose `/lab` as the corpus URL, that contradicts the
  brief sentence “**Not** the public `/lab` instrument-demo hub.”
- The architecture lane can reuse the **same metrics-token gate** the research family already
  uses, such that a trader cookie alone fails AC-15 and a missing/wrong token fails AC-13/14
  **at the server**, not only in the page.
- The architecture lane can keep the Pages trader origin **404 on the entire research prefix**
  with no new proxy path (AC-33/26). If they add a Pages proxy so the public site can browse
  books, that contradicts Out and is an R2 conflict.
- The architecture lane can isolate any operator/lab client so the **trader API module used on
  trader routes does not gain a research list/load helper** (AC-35), matching the brief’s
  structural guard. If the only client they will add is a trader-route helper, that is an R2
  conflict.
- The architecture lane can distinguish **session-book miss / not-storing / unreadable** on the
  existing list/load enough for AC-19–22 without inventing a coverage UI this slice. If they
  cannot, they must say so at R1/R2 — I will then demand a coverage sibling rather than collapse
  the classes.
- The architecture lane can prevent this UI from **starting Massive, replay, or score-lab** on
  open (AC-10/32) because those remain process/CLI vehicles, not this URL.
- The architecture lane will verify **live** dashboard route tables, Pages research 404, and
  research list/load gates — not Python-era paths (`cited-code-is-verified-not-assumed`). This
  position does not assume filenames, payload fields, or header names.
- The architecture lane can prove score / tier / fingerprint byte-identity without Massive
  credentials in the build environment (AC-37).
- The UX lane will **not** add a TopNav/Settings/ticker affordance whose destination is this
  URL. If UX proposes a trader entry, that contradicts AC-5/34 and
  `operator-vs-trader-path-separation`, and I will raise it as a conflict at R2.
- The UX lane will design **own operator chrome** in the metrics-surface family (own bar, off
  shell) and will **not** title the surface Lab (AC-4/41). If UX occupies `/lab` or names the
  chrome “Lab,” that contradicts the brief and AC-6/41.
- The UX lane owns exact wording for empty / not-storing / no session book / unreadable /
  unauthorized / origin-blocked / could-not-refresh / research-not-live / authorizes-nothing, and
  owns token-entry interaction — with the product forbids (no query-string token, no post-accept
  echo, no durable token beside trader prefs) held. I own only that those states exist and are
  mutually distinguishable.
- The UX lane will **not** design a GEX chart, live tiles, SSE, replay controls, coverage matrix,
  tape player, extract browser, or morning-note layout into v1. If they do, that contradicts the
  Out list and AC-10/40.
- The UX lane will render a **digested** open state (identity + capture time + standing), not a
  raw chain dump, using theme tokens only and no new orchestrated motion (AC-11/42).
- The UX lane can keep occupancy copy from using coverage `present` on this screen and from
  placing a Live badge on a stored book (AC-28–30). If UX needs the word `present` to mean
  “row exists,” that contradicts `present-is-live-paid-only` and is an R2 conflict.
