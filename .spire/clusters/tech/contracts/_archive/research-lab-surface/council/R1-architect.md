# R1 — architect position: research-lab-surface

## Position

This slice is an **operator corpus browser** of **already-kept** research identities. It does not capture, recompute, replay, or score. Session-archive books are the spine; archive-coverage is the one sibling occupancy read I admit in v1. The public `/lab` hub stays instrument demos with synthetic data. Score-lab stays a clap command. Day replay stays process-start on the existing ticker SSE. `Authorizes: nothing`.

Verified live seams this position attaches to (read at source, not briefing HTML):

- Pages Function `functions/api/[[path]].ts` returns 404 **before proxy** for `/api/_metrics` and the entire `/api/_research/` prefix. Comment at the seam: the operator reads those prefixes **via the Railway URL directly**; token gate alone is not the trader-origin posture.
- Research HTTP already exists and is token-gated with the **metrics** token, not a session cookie: `apps/api/src/routes/research_session_books.rs`, `research_session_coverage.rs`, `research_session_day_tape.rs`, `research_chain_snapshots.rs`, `research_flat_files.rs`. Each calls `health::metrics_token_ok` (`Authorization: Bearer` or `X-Metrics-Token`; expected token is URL-safe base64 of ≥32 bytes). Cookie auth is not on this path.
- Session-book list is metadata `(symbol, et_date, source_as_of, source)` with `source` from `MarketDataSourceKind::{LiveMassive, Fixture, SessionTape}` mapped to `live_massive | fixture | session_tape`. Load of one `(symbol, et_date)` deserializes the stored capture and returns the full market/bars/minutes/trades body with `vendor_called: false` and `authorizes: "nothing"`. `RESEARCH_VENDOR_CALLS` is a dead counter that must stay 0.
- Coverage HTTP (`research_session_coverage.rs`) projects the closed cell deck `present | missing | unreadable | not yet due | blocked occupancy` (`coverage.rs` `cell_literal`). `present` is **only** a loadable `LiveMassive` body. Fixture and session-tape are `blocked occupancy`. `LastReadable` is a closed three-arm enum (`Found` / `None` / `Undetermined`), not an optional date. Envelope `evidence` is `"this process"`. `authorizes` is `"nothing"`.
- Flat-files occupancy includes `kept` and bans `present` (`research_flat_files.rs`). Tape provenance is a different store. Those decks are **not** v1 vehicles.
- `app.tsx` mounts `/_ops/metrics` **first**, **outside** `<AppShell/>`. Comment currently calls it the **only** nav-less route. `/lab` and `/lab/*` live **inside** the shell. `TopNav.tsx` NAV includes Lab and states “Deliberately NO operator entry”. `LabIndex.tsx` is `data-testid="lab-index"` — Canvas/WebGL instrument demos, synthetic data.
- `libs/api/src/lib/convexa.ts` has `fetchMetrics` against relative `/api/_metrics` and **no** `_research` helper. `libs/api/src/lib/client.ts` is a same-origin relative adapter (`credentials` only on auth/book/broker/scan/positions/rec POST). Structural specs (`session-chain-archive.structural.spec.ts`, `chain-snapshot-capture.structural.spec.ts`, `chain-archive-object-store.structural.spec.ts`) poison-test **all** dashboard production sources **and** `@convexa/api` (except `generated/`) for `/api/_research` / `session-books`. `generated/schema.ts` already lists the research paths.
- Production CORS (`server.rs` `production_cors_layer`) already allows `Authorization` and `x-metrics-token` on an exact-origin allowlist. Non-prod CORS is `Any`. Trader production HTTP is **same-origin through the Pages Function**, so CORS is not what makes ticker/scan work today.
- `main.rs` still dispatches `score-lab` and `session-day-replay` as clap; replay is not an HTTP surface (`SERVER` must not contain `session-day-replay`). Day-replay structural spec forbids `/_ops/replay`.

### Council locks (technical pick, axes named)

**1. v1 vehicles = session books (spine) + coverage (sibling). Not tape, snapshots, or flat-files.**

| Option | Complexity | Cost | Scalability | Familiarity |
| --- | --- | --- | --- | --- |
| A. Books list+load only | two existing GETs | smallest FE | one identity load | metrics-page pattern |
| B. Books + coverage | three GET families; two closed decks | one extra read | coverage is a 3-symbol matrix | coverage HTTP already shipped |
| C. A/B + tape/snapshots/flat-files | five occupancy vocabularies, huge bodies | weekly dump | multi-MB extracts + chains | false: “the corpus” is not one type |

Pick **B**. Decisive axes: **`present-is-live-paid-only` + BRIEF weekly-use**, then complexity. Books list answers “what identities are stored?” Coverage answers “is today’s expected live-paid book actually `present`?” Inventing `present` from a list row’s `source` would be a fabricated occupancy (`[absent-is-not-none]`). Tape / snapshots / flat-files keep their own closed decks (`kept`, tape provenance, ring snapshots) and are the dump/replay temptation; they stay non-goals.

Mechanism: the page-local client issues **existing** GETs only — per-symbol book list, one-book load by `(symbol, et_date)`, one coverage matrix (default date D as the server already defaults). No bulk-list adapter. Symbol set for v1 is the closed liquid trio **SPY / QQQ / IWM**, copied as a page-local table (do **not** import `ENSURE_SYMBOLS` / tape watchlist). BRIEF observation path (list SPY, open one dated book) is the spine walk; coverage is the honesty matrix beside it.

**2. NO_BACKEND_CHANGE. No digest endpoint, no Pages proxy hole, no score-lab HTTP.**

| Option | Complexity | Cost | Scalability | Familiarity |
| --- | --- | --- | --- | --- |
| A. Consume existing list/load/coverage unchanged | FE + scanner narrowing | empty `apps/api` diff | one book load ≈ one paid chain | every `_research` ship |
| B. Thin digest adapter | new OpenAPI ops + occupancy re-projection | review + contract gen | smaller payload | invents a second occupancy wire |
| C. Proxy `_research` on Pages when token present | Function branch | **breaks HARD 404** | trader-origin leak | tempting and forbidden |

Pick **A**. Decisive axes: **binding 404 + `Authorizes: nothing` + cost**. Load already returns the full capture. `[digested-labels-not-raw-dump]` is enforced **in the client projection**, not by a new backend shape: the contracts/bars/minutes/trades arrays stay in ephemeral memory for cardinality digests and optional local export; they are never rendered as a chain/OHLC/tape dump and never written to a durable store or trader route. Empty `apps/api` diff is the structural score-identity proof. Pages Function bytes stay the 404 they are today (poison-test remains).

**3. Off-shell `/_ops/...` sibling of metrics. Never `/lab`. Never AppShell. Never TopNav.**

| Option | Complexity | Cost | Scalability | Familiarity |
| --- | --- | --- | --- | --- |
| A. New nav-less `/_ops/...` route, first group with metrics | copy metrics mount | one lazy page | n/a | `app.tsx` + `pages/operator-metrics/` |
| B. Occupy `/lab` or a `/lab/*` child | fights shipped hub | product lie | n/a | Lab is public demos |
| C. In-shell page, unlinked | still trader chrome | confusion | n/a | forbidden by invariant |

Pick **A**. Decisive axis: **`operator-vs-trader-path-separation`**. Mechanism: declare the route in the **same first group** as `/_ops/metrics` (outside `<AppShell/>`, before the shell parent) so `/*` cannot shadow it. Exact slug is UX/PM; architect constraints: prefix `/_ops/`, **not** `/_ops/metrics`, **not** `/_ops/replay` (replay absence lock), **not** `/lab` or `/lab/*`. TopNav `NAV` and the mobile drawer stay exactly the trader set. No prefetch entry. The `app.tsx` comment that metrics is the only nav-less route becomes false and must be updated to “operator routes” (metrics + this surface). Folder name must not match the structural path-scan needles `session-books|_research|session-chain-archive` — those scans look at file paths as well as bytes.

**4. Dedicated operator HTTP client. Not `convexa.ts`, not relative trader-origin `/api/_research`.**

| Option | Complexity | Cost | Scalability | Familiarity |
| --- | --- | --- | --- | --- |
| A. Page-local client: absolute API origin + metrics-token headers + `credentials: 'omit'` | one module | CORS already lists the token headers | one-at-a-time GET | fetch, not a new SDK |
| B. Add `fetchResearch*` to `convexa.ts` / `@convexa/api` | one helper | **fails existing poison tests** | leaks onto ticker imports | forbidden by BRIEF + specs |
| C. Reuse `fetchMetrics` / shared `http` | zero new client | relative URL 404s on Pages; no token | broken weekly use | false familiarity |

Pick **A**. Decisive axes: **Pages 404 + structural isolation**, then familiarity.

Mechanism:

- The trader SPA is hosted on Pages. Same-origin `fetch('/api/_research/...')` **is** a trader-origin request and **must** 404. Copying `fetchMetrics()` (relative `/api/_metrics`, no token header) cannot satisfy weekly production-corpus use: production requires `METRICS_SECRET_TOKEN` (`production-fails-closed`), and Pages never proxies this prefix.
- Operator client is **page-local** (single consumer → stays under that `pages/` folder; `shared/` / `features/` only on a 2nd consumer). It does not import `getTicker`, `streamTicker`, `fetchMetrics`, or the shared `http` client.
- Every research GET is `origin + existing path`, with the **existing** token header pair (`Authorization: Bearer` and/or `X-Metrics-Token`). `credentials: 'omit'` so a trader session cookie is not attached and is not treated as a gate.
- API origin is a **runtime** operator input, not a baked backend URL (`[no-secrets-in-image]`). Reject any origin whose host is `*.pages.dev` (that origin 404s the prefix — fail closed, do not retry relative). Token never in the query string, never in `console.log` of headers, never in UI copy.
- Type-only use of generated schema types is allowed; a new runtime helper under `libs/api/src` (except `generated/`) is not.
- Structural scanners **narrow** from “all dashboard sources” to “trader sources + `@convexa/api`”: TopNav, AppShell, ticker/positions/scanner/lab/landing, `convexa.ts` still poison-test `/api/_research` and `session-books`. The operator page folder is an **explicit allowlist**. Mutation tests stay non-vacuous: poison TopNav → red; poison the allowlisted folder with a ticker import / `getTicker` / `/lab` occupancy → red.

`[lane-check]`: live `ALLOWED_BROWSER_ORIGINS` is env, not in-repo. I assume the production Pages HTTPS origin is already a member (runtime guardrails require exact browser origins). If false, hosted cross-origin list/load fails CORS and the fix is **ops allowlist**, not a research adapter and not a Pages 404 exception.

Local Vite GATE Q: non-prod CORS is `Any`; origin `http://127.0.0.1:8000` (API port from `project.json`) works. That run is **local evidence**, not hosted Pages evidence.

### Data-structure content

Three client-side closed decks. They are **not aliases**. A lookup in one deck must not mint a token from another.

**Book inventory row** (from list; identity + provenance only):

- Identity: `(symbol, et_date)` with `et_date` an America/New_York calendar date.
- Source kind: closed `{live_massive, fixture, session_tape}`. Unknown wire → a distinct **unavailable** arm, never coerced to `present`.
- `source_as_of` is mandatory on a successful load (existing server rule); list rows already carry it.
- List `store`: `hit | miss`. Empty `books` with `store: miss` means **checked, none for that symbol** — not unauthorized, not “not storing”.

**Book load digest** (from one load; not the raw capture):

- Same identity + source kind + `source_as_of`.
- Cardinality labels only: contract count, daily-bar count, minute count, trade count (counts of arrays, not the arrays).
- Standing: `vendor_called` must be false; `authorizes` must be the closed nothing-token. If either fails, the load is a **fault**, not a digest.
- Raw `market.contracts` / bars / minutes / trades are **not** a UI structure. Optional local JSON export may serialize the load body on the operator machine (metrics-page Export precedent: client-only, no server write).

**Coverage matrix** (from the existing coverage read):

- Symbols: the server’s trio.
- Per-row cell: closed `{present, missing, unreadable, not yet due, blocked occupancy}`. `present` **only** here, **only** loadable `LiveMassive`.
- `last_readable`: closed `{found, none, undetermined}` matching `LastReadable::{Found, None, Undetermined}`. `none` is not `missing`; `undetermined` is not `none`.
- Envelope `evidence` stays `"this process"` — never relabeled hosted/CI (`[local-evidence-is-not-hosted-evidence]`).
- `authorizes` remains nothing.

**Client transport/session state** (not a durable product store):

- API origin + metrics token live in **ephemeral** page memory (and at most `sessionStorage`). **Not** `localStorage`, not a `convexa.*` durable key. `[loss-free-durable-migration]` does not apply because we do not create a durable store. A plaintext token in durable storage would be a secret-at-rest without `[secret-encrypted-at-rest]`.
- In-flight load: at most one book body; an identity change aborts the previous GET (`AbortController`). No prefetch of N books.

**Operator view-model states** (type-level, `[absent-is-not-none]`): unauthorized (401) · origin-rejected (Pages origin / empty origin) · not-storing · store-error · unreadable · miss (checked empty) · unparseable-date (422) · transport/CORS fault · invariant-fault (`vendor_called` true or `authorizes` ≠ nothing) · ready. Unauthorized **must not** collapse to miss. Not-storing **must not** collapse to miss.

### Data flow

```
operator types dedicated /_ops/... URL
        │
        ├─► off-shell page (own chrome, no AppShell, no SSE, no getTicker)
        │         │
        │         ├─ runtime origin + metrics token (ephemeral)
        │         │     reject *.pages.dev origin
        │         │
        │         └─ page-local client (credentials omit)
        │               │
        │               ├─ GET coverage (existing) ──► occupancy matrix
        │               ├─ GET book list(symbol)  ──► inventory rows
        │               └─ GET book load(symbol, et_date) ──► digest (+ optional local export)
        │
        × no Pages Function change (trader-origin /api/_research still 404)
        × no Massive, no ensure worker, no cache mutation, no ticker/scan/SSE
        × no score-lab, no session-day-replay, no /_ops/replay
```

List is metadata-only and cheap. Load is the heavy read; bound it to **one identity at a time** (operator analogue of `[single-ticker-on-demand]`, off the trader request path). Coverage does not write books, does not start ensure, does not score (already true server-side; client must not call those paths either).

### Component boundaries

| Piece | Owns | Must not |
| --- | --- | --- |
| `app.tsx` route table | off-shell mount next to metrics | put this route under `AppShell`; link it from nav |
| Operator page module (`pages/…`, single consumer) | chrome, composition, ephemeral origin/token, view-model | import sibling pages; import ticker/lab/metrics internals |
| Page-local research client | absolute-origin GETs + token headers + status→state map | live in `convexa.ts`; send cookies; hit trader routes |
| Pure digest/occupancy lookup | closed-token projection | re-derive `present` from `source`; render raw series |
| Structural scanners | trader poison + operator allowlist + anti-vacuity | prose-only “don’t leak” |

Dependency direction stays downward (`pages` → `shared` theme/tokens only). This is not a 2nd consumer of operator-metrics: do not import that page. If a later slice shares token entry with metrics, **that** is the 2nd consumer and a `features/` leaf — not this v1.

### Isolation / error rules

- **Trader path:** zero new imports on ticker/positions/scanner/lab; zero SSE; zero `MarketDataPort` / Massive. A fault on this page cannot unmount AppShell because it is not inside AppShell (`ErrorBoundary` per-route already wraps lazy elements).
- **Server remains the gate:** a forged UI that skips the token still 401s (`[server-side-gate-enforcement]`). FE 401 handling is UX, not enforcement.
- **Pages 404 stands:** no Function edit, no “proxy if header present” branch. Conformance: a `*.pages.dev` request to `/api/_research/...` remains 404 even with a valid token.
- **Vendor isolation:** client treats `vendor_called !== false` as invariant-fault. No retry storm (metrics-page: failed poll keeps last data; here: failed load keeps last digest or empty-ready, one explicit retry).
- **Score isolation:** do not import `quant-engine`, do not POST recommendation, do not call ticker compute. Empty `apps/api` diff + no `convexa.ts` growth are the build proofs of `[additive-keeps-score-byte-identical]`.
- **Secret isolation:** token is header-only; never logged; never in copy; never in the image. Origin is a public URL but still not hardcoded.
- **Occupancy isolation:** coverage `present` never applied to a book row, tape, extract, or fixture. Book `source: fixture | session_tape` never labeled live paid.

### Explicit non-goals

- Public `/lab` occupation, LabIndex cards, or synthetic-demo coupling.
- Trader nav item, AppShell child, Settings link, ticker deep-link that “opens” a book on `/ticker/:symbol` (that starts the live path).
- Pages proxy of `_research` / `_metrics`.
- Score-lab HTTP/UI; batch-backtest chrome; replay player; `/_ops/replay`; second ticker SSE.
- Morning-note product; Benzinga/news.
- v1 tape / chain-snapshot / flat-file vehicles (sibling reads the council may admit later; I do not admit them).
- New backend list/digest/bulk endpoints; OpenAPI growth; `quant-engine` over a loaded book in-process from this page.
- Durable client store for corpus or token; encrypted-at-rest token wallet.
- Alerts, motion families, convex-arc spend, green/red occupancy tint (direction reservation is UX-binding; architect forbids occupancy→signed-direction mapping in the view-model).

### Restated binding constraints

- **`operator-vs-trader-path-separation` (HARD):** own `/_ops/...` route, unlinked, off shell, read-only; no vendor fetch / recompute / cache mutation / trader-route call; Pages `_research` 404 stands.
- **`present-is-live-paid-only`:** UI/view-model must not label extracts / tape / fixtures as live paid `present`. `present` is coverage-cell-only for loadable `LiveMassive`.
- **`server-side-gate-enforcement`:** metrics token is the gate; trader cookie is not.
- **`additive-keeps-score-byte-identical`:** `Authorizes: nothing`; empty `apps/api` diff.
- **`local-evidence-is-not-hosted-evidence`:** coverage `evidence: this process`; Vite GATE Q is local, not hosted Pages proof.
- **`no-secrets-in-image`:** token never logged / never in copy / never baked; no hardcoded API origin.
- **`absent-is-not-none`:** closed occupancy + client states; miss ≠ unauthorized ≠ not-storing ≠ undetermined last-readable.
- **`structural-over-prose-enforcement`:** poison trader sources / `convexa.ts` / Pages 404 / TopNav and the build goes red; operator allowlist is explicit; anti-vacuity required.
- **`cited-code-is-verified-not-assumed`:** seams above were read at source. Live CORS allowlist membership is `[lane-check]`.
- **`digested-labels-not-raw-dump`:** no raw chain/OHLC/tape dump; closed tokens + cardinalities.
- **`single-motion-moment`:** no new keyframe family.
- **`theme-token-discipline`:** mode-aware `extrasFor` / tokens only; UX owns visual application of DESIGN_SYSTEM (Status: SET — The Curvature Terminal).
- **`single-ticker-on-demand`:** this is not the trading request path; still load **one** book identity at a time; no in-request market sweep.
- Domain/math: gamma sourcing, flip grid, GEX formula, live NBBO-mid anchor — **untouched**. Opening a book is a research read, not a recompute.

## Risks I see

- **Transport lie:** copying `/_ops/metrics` chrome without copying a **different** transport (absolute API origin + token) yields a hosted page that 404s every list/load. Metrics itself uses relative fetch without a token header — that pattern is not reusable here.
- **CORS allowlist gap (`[lane-check]`):** if production Pages origin is not in `ALLOWED_BROWSER_ORIGINS`, hosted weekly use fails. Local Vite will still pass. That is exactly `[local-evidence-is-not-hosted-evidence]`.
- **Scanner collision:** adding `/api/_research` bytes to the operator page without narrowing F2 scans fails CI; narrowing without keeping trader poison + anti-vacuity silently deletes the invariant.
- **Occupancy conflation:** putting coverage `present` on a book list row, or calling a `kept` extract `present`, is the failure this feature exists to avoid.
- **Payload dump:** load returns a full capture; a table of contracts would violate `[digested-labels-not-raw-dump]` and could leak paid chain onto a screenshotable surface.
- **Token persistence:** “remember me” into `localStorage` makes a plaintext secret-at-rest.
- **Scope creep into replay/score-lab:** “open a book” must not mean “walk it on `/ticker`” or “run score-lab”. That would start Massive-adjacent live path or a CLI-shaped HTTP the BRIEF forbids.
- **Folder/path needles:** naming the page `session-books` or `_research` trips path-scans even if nav is clean.

## Assumptions I'm making about the other two lanes

- **PM** will accept v1 success as: from the dedicated off-shell URL, with the metrics token, list SPY (and the liquid trio via coverage), open one dated book **without** starting Massive / ticker / score-lab / replay — not a five-vehicle research workbench.
- **PM** will admit coverage as an in-v1 sibling (honesty of `present`) and keep tape, snapshots, and flat-files out of v1; if PM requires those vehicles in v1, lock 1 is false and I retract B.
- **PM** will keep `Authorizes: nothing` and `NO_BACKEND_CHANGE` (no digest/bulk endpoint, no Pages 404 exception). If PM requires a thinner wire, lock 2 is false.
- **PM** will treat a Vite-proxied GATE Q as **local** evidence and will not call it hosted Pages verification of weekly use.
- **UX** will own token and API-origin entry, and will not put the token in visible copy, in the query string, or in a durable `localStorage` key; if UX requires a remembered token, that is a new secret-at-rest feature I have not designed.
- **UX** will render occupancy via **closed lookup** of the two decks above and will not label book rows, fixtures, tape, or extracts as `present`.
- **UX** will not render the loaded contracts/bars/minutes/trades arrays (cardinality + provenance only); optional local export is operator-machine, not a second on-screen dump.
- **UX** will not add a TopNav/drawer entry, will not place this surface under `/lab`, and will not navigate “open book” onto `/ticker/:symbol`.
- **UX** will distinguish unauthorized / miss / not-storing / unreadable in the view (literals are UX; the **distinct arms** are required by `[absent-is-not-none]`).
- **UX** will bind chrome to DESIGN_SYSTEM tokens (`extrasFor`, no hardcoded hex) and will not add a keyframe family (`[single-motion-moment]`).
- **UX** will not require sharing ephemeral token state with `/_ops/metrics` in v1 (a shared holder is a 2nd consumer and a `features/` move).
- **Both** will leave exact HTTP path tails, JSON field names, and copy to the interface the synthesizer writes; I have constrained prefix (`/_ops/`, `/api/_research` existing), token header pair, and occupancy tokens because those are already shipped fences, not new signatures.
