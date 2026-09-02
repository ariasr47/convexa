# R3 — architect ↔ ux

One exchange. Conflicts `c4d9ff27…` / `d366050e…` / `9e4eb456…` (sessionStorage — already folded in `decisions.md`: page memory only). Origin transport from R2 asks after PM self-revision `1632c838…` (weekly list/open needs a runtime non-Pages API origin + metrics token; Pages `_research` 404 stands). I do not re-fight human product ruling **A** (2026-08-31): books + partitioned coverage card on `/_ops/research`; coverage GET in v1; tape/snapshots/flat-files out; no minting `present` from list `source`. I do not author chrome, copy, endpoint signatures, or JSON key spellings. Interface at R4 spells keys. Types and predicates below are what UX must consume.

Honor, not restated as open: no export of a loaded book; no `sessionStorage` / `localStorage`; token not in query / copy / logs; `NO_BACKEND_CHANGE`; not `/lab`; not `/_ops/metrics` retrofit.

## Converged

All origin-transport items. No residual product clock. SessionStorage is withdrawn, not redesigned. Hosted weekly use is **cross-origin from the Pages document to a sitting research base**, not a Function proxy and not a relative metrics clone.

### 1. What I withdraw (so the replacement can be attacked)

I **withdraw** these R1 sentences as consume-path design:

- “API origin + metrics token live in **ephemeral** page memory (and at most `sessionStorage`).”
- “`[lane-check]`: live `ALLOWED_BROWSER_ORIGINS` is env, not in-repo. I assume the production Pages HTTPS origin is already a member (runtime guardrails require exact browser origins).”

The first cannot implement reload-reask or UX’s memory-only tab (`c4d9ff27…`, `d366050e…`, `9e4eb456…`). The second is no longer an assumption: live production membership was read 2026-08-31 (below). I do **not** withdraw “Opening this URL on that origin is **origin-blocked**” as a **research-base** fact — I already contradicted applying it to the **dashboard location host** (`bef7d221…`). That classification stands: origin-blocked is a property of the sitting research base / the request URL, not of `location.host`.

Not withdrawn: page-local client; `credentials: 'omit'`; existing token header pair; reject host `*.pages.dev` as research **base**; empty `apps/api` diff; Pages Function 404 of `/api/_research`; no bake of an API origin.

### 2. Named mechanism: SittingResearchBase

**The operator supplies a public API origin at runtime. It lives in page memory for the tab, beside the metrics token. It is not a secret, not baked, not durable, and not a Pages host. Research GETs are `absoluteBase + existing path`. Relative `/api/_research` is a poison.**

| Option | Complexity | Cost | Familiarity | Decisive failure |
| --- | --- | --- | --- | --- |
| A. Relative fetch like `fetchMetrics` | lowest | none | **high** (metrics) | Pages Function 404; hosted weekly use is empty-looking |
| B. Bake `VITE_` / compile-time Railway URL | low | env drift | Vite habit | `[no-secrets-in-image]` (baked origin); preview ≠ prod; still relative on miss |
| C. Persist origin/token in `sessionStorage` | low | plaintext at rest | high | reload-reask; already folded |
| **D. Sitting research base as runtime operator input** (chosen) | low | one sitting string | **high** (`fetch`) | none if CORS membership holds and arms stay distinct |

Decisive axes: **Pages `_research` 404 + `[no-secrets-in-image]` + reload-reask**, then familiarity. Metrics relative transport is the trap, not the precedent.

#### 2.1 Sitting store (page memory only)

One tab-scoped pair, not a durable product store:

- **research base** — public URL (scheme + host + optional port). Not a secret. Not password-class. May be visible. Never `sessionStorage`, `localStorage`, query string, `document.title`, error text, or aria.
- **metrics token** — secret. Header-only. Same memory lifetime. Refresh clears both. Expected, not data loss.

Mechanism: both values are JS bindings on the operator page module. Refresh reconstructs empty. No `convexa.*` key. `[loss-free-durable-migration]` does not apply because we create no durable store. Sharing this pair with `/_ops/metrics` is a 2nd consumer — out.

Unlock/sitting may collect both in one action (UX owns chrome). Architect constraint: a research GET is illegal until a **usable** sitting base exists. Empty base short-circuits **before** network, so it cannot become 401 or empty-list.

#### 2.2 Parse the sitting base (no network)

Trim. Then **one** of:

| Arm | Predicate | Network? | Distinct from |
| --- | --- | --- | --- |
| **OriginEmpty** | missing / whitespace-only | no | 401, empty-list, CORS, Pages 404 |
| **OriginPagesHost** | parsed host is `pages.dev` or ends with `.pages.dev` (ASCII case-insensitive) | no | OriginEmpty; Function 404 after a fetch; empty-list |
| **OriginUnusable** | not an absolute URL; userinfo / query / fragment; path other than empty or `/`; scheme not `https`, except `http` **only** when host is loopback (`127.0.0.1`, `localhost`, `::1`) | no | OriginEmpty; OriginPagesHost |
| *(usable)* | `https` (any non-Pages host) or loopback `http` | may fetch | — |

Canonical form: scheme + lowercased host + non-default port; strip trailing slash; **no path**. Existing research path tails are appended by the page-local client, not typed by the operator.

`*.pages.dev` is rejected as **research base**, not as dashboard location. Hosted weekly use **is** a Pages document talking cross-origin to a Railway (or other non-Pages) base.

Loopback `http` exists so local Vite GATE Q can type `http://127.0.0.1:8000` (`project.json` API port). That run is **local evidence**, not hosted Pages proof (`[local-evidence-is-not-hosted-evidence]`). Pages document + `http://` non-loopback is OriginUnusable (mixed content would otherwise collapse into CORS).

No compile-time default. An example public host in copy is UX’s choice; baking the string into the client is a fail.

#### 2.3 Issue the GET (only after a usable base)

Page-local client, not `convexa.ts`, not shared `http`:

- URL = sitting base + **existing** list / load / coverage path (already in `generated/schema.ts`). Type-only schema import allowed; no runtime helper under `libs/api/src` except `generated/`.
- Headers: existing pair — `Authorization: Bearer …` and/or `X-Metrics-Token`. One is enough (`metrics_token_ok` in `health.rs`). Token value never in the URL.
- `credentials: 'omit'` — trader cookie is not attached and is not a gate.
- `AbortController` — at most one in-flight book load; identity change aborts the previous GET. Abort is **not** OriginCors.
- Never construct a path-only `/api/_research/...` URL. Vite’s `/api` proxy (`vite.config.mts`) would 200 that locally and **hide** the Pages wall. Relative construction is a structural poison even when Vite would succeed.

`NO_BACKEND_CHANGE`. Empty `apps/api` product diff. Pages Function bytes stay the 404 they are (`functions/api/[[path]].ts` returns `Not Found` for the entire `/api/_research/` prefix before proxy).

### 3. Named mechanism: origin arms that cannot become empty-list

`[absent-is-not-none]`. Classifier is an exhaustive lookup on **how the request failed or was refused**, not on “no rows.” UX owns strings. I own arms and predicates.

**Priority (first match wins). Cold = no prior successful body. Warm refresh uses the stale arm, not a wipe.**

| Arm | When | Must not be classified as |
| --- | --- | --- |
| **OriginEmpty** | §2.2 empty sitting base | empty-list; 401; CORS; not-storing |
| **OriginPagesHost** | §2.2 host `*.pages.dev` | empty-list; 401; OriginPages404 (no fetch) |
| **OriginUnusable** | §2.2 parse/scheme fail | empty-list; OriginEmpty |
| **OriginRelative404** | request URL is path-only **or** request origin equals the document origin **and** that host is a Pages host. Client must not emit this; if a fetch still happens, Function 404 lands here, not on empty-list | empty-list; LoadMiss; OriginEmpty |
| **OriginCors** | `fetch` rejects with **no HTTP status** (TypeError: CORS preflight fail, mixed content, DNS, network). `response` is undefined | empty-list; 401; OriginPages404; offline-as-empty |
| **Unauthorized** | HTTP **401** and payload `error` is `metrics_unauthorized` (missing and wrong token are the **same** class — no missing-vs-wrong oracle) | empty-list; OriginEmpty; OriginCors |
| **OriginPages404** | HTTP **404** whose body is **not** the research-load miss JSON (`error: "no_session_book"`). Includes Function plaintext `Not Found` and any custom-domain Pages host that still 404s the prefix | empty-list; **LoadMiss**; OriginPagesHost (that one is pre-network) |
| **EmptyList** | HTTP **200** list, `store: "miss"`, `count === 0`, `books: []`, framing the no-session-book family | Origin*; 401; not-storing |
| **LoadMiss** | HTTP **404** JSON `error: "no_session_book"` (load of one identity) | OriginPages404; EmptyList |
| *(existing, unchanged)* | not-storing / store-error / unreadable / unparseable-date / invariant-fault (`vendor_called` true or `authorizes` ≠ nothing) / ready / stale-keep-last | any Origin* arm |

**404 split is load-bearing.** List empty is **200** (`research_session_books.rs` `store: miss`, `count: 0`) — never a 404. Load miss is **404 JSON** `no_session_book`. Pages Function 404 is **404 plaintext** `Not Found` (`functions/api/[[path]].ts`). Treating status 404 as one bucket would call “no Friday book” origin-blocked, or call a Function wall an empty week.

**401 vs empty origin.** Empty base does not fetch, so it cannot 401. Usable base + missing/wrong token fetches and 401s. Distinct.

**CORS vs 401.** When CORS membership fails, the browser hides the status — JS sees OriginCors, never Unauthorized. When membership holds, 401 is readable. Do not invent a 401 from a TypeError.

**Warm refresh.** OriginCors / OriginPages404 / 5xx after a prior good list **keep last rows** (stale). They must not zero `books[]` and must not become EmptyList.

**Coverage card (ruling A).** Same SittingResearchBase, same classifier. An origin arm **withholds** the matrix (zero cells, not three `missing`). A 200 coverage envelope still prints only its closed deck. Do not mint coverage cells from list `source`. Do not collapse coverage-withheld into empty books.

**Unknown list `source` (UX R2 ask).** Closed `{live_massive, fixture, session_tape}`; unknown wire → distinct **Unavailable** arm. Operator may see the raw token **verbatim** as provenance text. Never coerce to `present` or to `live_massive`. Not an origin arm.

### 4. Lane-check: production CORS allowlist

**Question:** is the production Pages HTTPS origin already on `production_cors_layer`’s allowlist, or does hosted weekly use fail even after the operator supplies an API origin?

**Answer: membership holds for production Pages. Hosted weekly use does not fail CORS for that document origin once a non-Pages research base and metrics token are supplied.** It still fails if the operator leaves the base empty, types `*.pages.dev`, uses a relative URL, or uses a **preview** Pages host that is not the exact listed origin.

Verified 2026-08-31:

- `apps/api/src/server.rs` `production_cors_layer` exact-matches the request `Origin` header against `ALLOWED_BROWSER_ORIGINS` (parsed by `runtime_guardrails/origins.rs`: HTTPS, no `*`, no path/query/userinfo, canonical host). It already `allow_headers` `authorization` and `x-metrics-token`, `allow_methods` includes `GET` and `HEAD`, and `allow_credentials(true)` (so ACAO is the exact origin, not `*`). Preflight (`OPTIONS`) accepts those headers via `production_browser_request_is_declared`. Tests reject lookalikes and **subdomains** (`https://sub.app.example` is not `https://app.example`).
- Live Railway production `api-rust` (`APP_ENV=prod`): `ALLOWED_BROWSER_ORIGINS` is `https://convexa.pages.dev`. That is the SPA origin in `docs/ENVIRONMENTS.md`. Public API host (the sitting base the operator types, **not** baked): `https://convexa-production.up.railway.app`.
- Trader production HTTP is still **same-origin through the Pages Function**. CORS is not what makes ticker/scan work today. This surface is the first operator page that **needs** that allowlist for weekly use.

`credentials: 'omit'` still sends `Origin`. It does not send the trader cookie. `allow_credentials(true)` on the layer does not require the client to include credentials; it requires a specific ACAO, which the Pages origin is.

**Residual CORS failures (ops allowlist, not a research adapter, not a Function 404 exception):**

- Pages **preview** (`https://<hash>.convexa.pages.dev`) — not an exact member; OriginCors even with a correct Railway base.
- A future custom SPA origin (docs mention `https://app.convexa.com`) — **not** on the live list today; OriginCors until ops adds it.
- Operator types a research base whose server does not echo this Origin — OriginCors.

Local Vite: `APP_ENV` ≠ `prod` → `non_production_cors_layer` is `Any`. Local green is not hosted proof.

**Fix for a CORS miss is ops `ALLOWED_BROWSER_ORIGINS`, not `NO_BACKEND_CHANGE` violation, not a Pages proxy hole.**

### 5. Answers to the UX asks (yes, named)

- **What operator input captures API origin (public URL, not a secret), and which state-matrix row is origin-blocked / origin-rejected?** SittingResearchBase §2. One tab-memory string, parsed per §2.2. UX owns the control. Origin-blocked is **not** “this URL on Pages.” Rows UX must have, distinct from empty-list and from each other: OriginEmpty, OriginPagesHost, OriginPages404, OriginRelative404, OriginCors, Unauthorized. Chrome/copy are UX.
- **If origin is a runtime field, which reject/fault arms must stay distinct so none collapse to empty-list or unauthorized?** The table in §3. Empty origin never fetches (not 401). `*.pages.dev` never fetches (not Function-404-as-empty). CORS has no status (not 401). Relative / Function 404 is OriginRelative404 or OriginPages404, **not** LoadMiss and **not** EmptyList. 401 is only HTTP 401 `metrics_unauthorized`.
- **Unknown list `source`?** Unavailable arm; raw token may print verbatim; never `present` / `live_massive`.
- **PM: is production Pages already on the browser-origin allowlist?** Yes for `https://convexa.pages.dev` (§4). Hosted weekly use from **that** document origin, after the operator supplies a non-Pages API origin + metrics token, is CORS-allowed. Preview/custom-domain SPA origins are not.

### 6. Poisons (non-vacuous)

1. Operator client issues path-only `/api/_research/...` (Vite-green, Pages-404) — suite red.
2. Empty sitting base, `*.pages.dev` base, Function `Not Found`, CORS TypeError, or 401 classified as EmptyList (`count: 0` / “no session book”).
3. Load JSON 404 `no_session_book` classified as OriginPages404 / origin-blocked.
4. Dashboard `location.host` `*.pages.dev` classified origin-blocked while a usable non-Pages sitting base exists.
5. Token or origin in `sessionStorage`, `localStorage`, query, copy, logs, `document.title`, or aria.
6. Baked API origin (`VITE_*`, hardcoded Railway host).
7. Pages Function branch that proxies `_research` when a token is present.
8. `convexa.ts` / trader import of a research helper.
9. Coverage cells minted from list `source`, or origin-withheld coverage printed as three `missing`.
10. `apps/api` product diff, `/lab` mount, `/_ops/metrics` retrofit, export of a loaded book.

### 7. UX mapping constraint (copy stays UX-owned)

I own types/predicates. UX owns strings and chrome. Mapping that must remain possible without reading source:

- OriginEmpty → no corpus claim; not locked-as-401 unless a 401 actually returned.
- OriginPagesHost → sitting base is the trader Pages origin; research family is not reachable there; 404 wall stands.
- OriginRelative404 / OriginPages404 → request hit the Pages `_research` 404 (or equivalent non-JSON 404); not “we kept nothing.”
- OriginCors → browser blocked the cross-origin read; not unauthorized; not empty week. Residual: preview/custom SPA origin not on the exact allowlist.
- Unauthorized → metrics gate; no corpus body.
- EmptyList → checked, storing, zero books for that symbol.
- LoadMiss → that identity has no book (JSON miss).
- Coverage withheld on any Origin* / Unauthorized — not a `missing` grid.
- Token never appears in the mapping strings.

Exact English remains UX. These arms are what AC-26/27 (origin-blocked ≠ empty ≠ unauthorized) and the origin-entry control test against.

## Still split (promote to product only if you cannot settle)

None. Residual choices are UX chrome (one field vs two, whether origin sits on the token form) and Interface key spellings. They are not product clocks.

If a later voice asks to persist the origin, to relative-fetch “when location is already Railway,” to treat Pages document host as origin-blocked, to proxy `_research` on Pages, or to collapse Function 404 into empty-list, that reopens a withdrawn claim — do not promote it as a new product question.
