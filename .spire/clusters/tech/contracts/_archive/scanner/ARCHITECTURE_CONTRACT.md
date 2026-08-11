# scanner — ARCHITECTURE_CONTRACT (v1)

> GATE A·X deliverable (architect-first → hands to PM). Technical SHAPE only: data-structure
> CONTENT, data-flow, component boundaries, isolation/error rules, restated binding constraints,
> phase seams, explicit non-goals. **NO UI/layout, NO endpoint signatures, NO wire/JSON field
> NAMES beyond what a boundary requires, NO copy, NO `def`-level code.** Those are PM / UX /
> Interface downstream (see §11). The design is **already owner-approved** — the authoritative
> source is `docs/superpowers/specs/2026-07-23-scanner-v1-design.md` (4 sections) + `BRIEF.md` +
> Plan 1 (`docs/superpowers/plans/2026-07-23-scanner-01-scanstore.md`, the ScanStore layer, already
> fully specified). This contract **RATIFIES** that design into the build authority and names the
> technical cruxes the execution lanes must honor — it does not re-open the design.

---

## 1. Restated goal (the shape that binds every phase)

Replace the `/scanner` stub with a real **multi-ticker surface** — morning triage first, ambient
radar after — one dense honest table answering "which ticker deserves the deep-dive right now?"
from **live-scored** data, every row one click (warm) from the Ticker page. **v1 scope: NO AI**
(AI-seeded views + batch recs are v2). A **global owner-curated tracked universe on the server**
(50–100 tickers); **per-account views** are subsets of it; anonymous users get a read-only **default
view**; untracked tickers stay fully usable via the existing single-ticker on-demand Ticker page.

The dominating structural fact: the scanner must run a bounded, budgeted **sweep with all tabs
closed** and serve everyone from a **shared store** — this is why the design is **approach C**
(a second sweep-worker process + a persistent `ScanStore` + a best-effort warm-click read-through),
and why the whole feature is built to leave the scoring transform byte-identical (§3). The scanner
**consumes** score/tier off the unchanged engine; it is never a scoring input.

---

## 2. The single-ticker-on-demand re-justification (formal — narrow at GATE S)

PROJECT_CONTEXT §5 records a **locked** decision: *"Single-ticker, on-demand (dropped the watchlist
scan) — bulk per-cycle calc was too slow."* This feature **revisits** that decision and must
**formally re-justify** it at GATE S. The re-justification, which the whole architecture embodies:

- **The original decision forbade a *market sweep*** — an unbounded, every-visible-ticker,
  per-request bulk recompute that made the page slow. Approach C is **not** that. It is a
  **bounded, owner-curated universe** (50–100, not the market), swept by a **separate process on a
  budgeted cadence** (never on the request path), through the **unchanged `compute_ticker`** at a
  **concurrency-bounded** pace (pool ~4, far under vendor guidance), with **move-triggered
  promotion** capped by round-robin fairness so a market-wide move degrades to base cadence rather
  than a thundering herd.
- **The bound moved.** The original constraint was the vendor's per-ticker options budget colliding
  with a synchronous request. The owner's highest Massive plan removes the vendor as the constraint
  (multi-ticker snapshot has no per-request ticker cap; unlimited REST < 100 req/s). The remaining
  bound is **our own engine CPU**, and it is held by the worker's pool, off the request path
  entirely. Nothing about the Ticker page's latency budget changes.
- **The narrowing to record at GATE S:** *"single-ticker, on-demand"* is narrowed from *"never sweep
  more than one ticker"* to *"the trading/serve REQUEST PATH computes exactly the one ticker asked
  for; multi-ticker computation happens only in a separate, bounded, off-request-path sweep worker
  writing a side-store."* The Ticker request path stays single-ticker-on-demand; the scanner is a
  budgeted background producer feeding a cache. This is a descriptive narrowing of a feature
  decision (like the auth "stateless-server → stateless *trading path*" narrowing), **not** a
  Promoted-canon demotion. Reopening it further (e.g. an in-request market sweep) would be a GATE-Z
  reversal.

---

## 3. Component boundaries + data-flow (approach C)

Three components, one strict dependency direction. The arrows are the whole design:

```
  owner config (universe + default-view lists, env/file)
        │  (read at worker start)
        ▼
  ┌───────────────┐   writes rows+heartbeat+bundle-blobs    ┌──────────────┐
  │  SWEEP WORKER │ ─────────────────────────────────────▶ │   ScanStore  │
  │  (2nd process)│                                          │  (persistent │
  └───────────────┘                                          │   side-leaf) │
                                                             └──────────────┘
                                             reads rows/heartbeat ▲   ▲ reads bundle-blob
                                                                  │   │ (warm-click)
                                              ┌───────────────────┘   └──────────────┐
                                              │  WEB APP (apps/api main.py)           │
                                              │   GET scan / view / universe          │
                                              │   + ticker warm-click read-through    │
                                              └───────────────────────────────────────┘
                                                          ▲ per-account view (auth-settings-adjacent)
```

### 3.1 The sweep worker — a NET-NEW 2nd process (same image, different start command)

- A **second process** built from the same `apps/api` codebase and container image, with a
  **different entrypoint/start command** — a second Railway service off the existing image (the
  deploy precedent). **All config env-injected** (`[no-secrets-in-image]`). It **exposes no HTTP
  surface** — its only outputs are writes to the `ScanStore`.
- **Local-dev seam:** an env flag (design names `SCANNER_EMBEDDED=1`) runs the same loop **inside**
  the dev server process (one terminal); production stays true multi-process C. The loop body is the
  same code in both modes — the flag only changes where it runs.
- **Two-speed loop** (the core data-flow):
  - **Fast lane — one multi-ticker snapshot poll (~20–30s):** a SINGLE request returns live-ish
    price/Δ% for **every** universe ticker (~2–3 req/min total) AND produces the **move-detection**
    signal. Prices/stamps update far faster than structure.
  - **Slow lane — a concurrency-bounded chain sweep (pool ~4):** each ticker runs through the
    **UNCHANGED `compute_ticker`** — the sole transform — producing the full per-ticker structure
    from which one **ScanRow** is projected (score/tier/regime/levels **consumed**, never
    re-derived). Baseline full pass ≈ 2–3 min at N=100.
  - **Move-triggered promotion:** a ticker whose price moved > X% since its last compute (X
    configurable, default ~0.75%) jumps the sweep queue; the promotion queue is **capped with
    round-robin fairness** — a market-wide move degrades to base cadence, never a herd.
- **Heartbeat:** every tick the worker writes a liveness marker + last-completed-full-pass time +
  universe size (the `SweepHeartbeat`, §4.2). This is the **honesty mechanism for the whole page**:
  the web app reads it to say "sweep last ran Xm ago" over stale rows.

### 3.2 The ScanStore — a persistent one-way side-leaf (P1, already specified)

`apps/api/src/scanstore/` — a **new subpackage, structural sibling of `src/marketdata/`** (the
iv-rank store family). Plan 1 has **already settled** its record/port/adapters/factory; this contract
references it as the **P1 shape** and does not re-derive it:

- **Port** (`ScanStore` ABC, 4 methods): idempotent **latest-wins** `upsert_row` (per symbol —
  rows are CURRENT STATE, not an accumulating series: the one deliberate divergence from iv-rank's
  insert-if-absent), a bounded/subset `read_rows`, `write_heartbeat`, `read_heartbeat`.
- **Adapters behind one port:** on-disk **SQLite** default (survives restart — the sweep is
  inherently accumulative), **Postgres** prod drop-in, an **env-selected factory** (`SCAN_STORE`,
  default `disk`; `SCAN_DATABASE_URL`→`DATABASE_URL`). Boot-safe: an unreachable Postgres defers the
  fault to first use, never crashes.
- **The leaf import rule is the load-bearing structural guarantee** (see §3.5). P2 adds a
  **bundle-blob** method to this same store (deferred from P1 by design — added when the P3 reader
  needs it; §4.3).

### 3.3 The read API — web-app-only (the worker exposes nothing)

Three reads + one gated write, all on `apps/api`'s existing web surface. **Endpoint signatures,
wire field names, and payload shapes are the Interface/UX lane's (GATE U·X)** — this contract names
only the boundaries they must respect:

- **The scan read** — the requested-or-default view as slim rows + sweep metadata (heartbeat age,
  last-completed sweep, universe size). **Anonymous-open, read-only, poll-friendly.** Best-effort
  degraded (200 + status), **never a 5xx for scan trouble** (§5).
- **The universe read** — read-only list for the view editor (the owner-curated server config the
  worker reads). "Request tracking" is a named later seam, not v1.
- **The per-account view (read + gated write)** — the signed-in user's view (a subset of the
  universe + ordering + display prefs), stored **behind the existing auth-settings ports**,
  **enforced server-side** (`[server-side-gate-enforcement]`; real 401/403 on WRITES per the auth
  error carve-out). Signed-out → default view + the standard inline sign-in prompt.
- **The default view** (anonymous/new-user) is itself owner-curated config: an explicit symbol list,
  or — when unset — a top-N-by-current-score fallback recomputed per request from the store
  (deterministic, **no per-user state**).

### 3.4 The warm-click read-through seam (C3 — across the process boundary)

The worker also stores each computed **full bundle** as a freshness-stamped blob (§4.3). The web
app's **existing ticker endpoint** gains a **best-effort read-through**: a cold request for a
**tracked** ticker checks the scan store's bundle-blob **before** the vendor; any miss/stale → the
**normal fetch** (no new failure surface). This is the **`chain_store` pre-warm precedent, extended
across the process boundary** (worker writes, web reads). Clicking a scanner row lands on a warm
Ticker page. **Freshness-gated**: a stale blob is a miss, never served as fresh. The warm-click path
**must not change the served bundle's bytes** — it only changes where the *input* came from, exactly
as `chain_store` does; `compute_ticker` remains the sole transform (§3.5).

### 3.5 The one-way-leaf boundary — the structural guarantee of `[additive-keeps-score-byte-identical]`

This is the single most important boundary in the feature and is **enforced structurally, not by
discipline**:

- `apps/api/src/scanstore/` and the sweep worker are **NEVER imported by** `engine.py` /
  `signals.py` / `live.py` / `darkpool.py` / `chain_store.py` / the bundle-compute path. `main.py`
  (web) and the worker entrypoint are the **only** orchestration boundaries that mount them.
- `compute_ticker` is the **UNCHANGED sole transform** — the same in the worker's sweep, the web
  request path, and the warm-click path. Same `market_data` in → **byte-identical bundle out**. The
  worker calls it; it does not fork or modify it.
- The scanner **CONSUMES** `opportunity_score` / `opportunity_tier` / regime / levels off the bundle
  the engine already produces. **No scan row, no view, no heartbeat can become a scoring input** —
  because the scoring modules cannot import the leaf. `opportunity_score` / `opportunity_tier` /
  `state_fingerprint` / the entry gate stay **byte-identical** with the scanner present or absent.
  This is the same enforcement shape as `src/auth/`, `ai_recommendation.py`, `context_pack.py`, and
  the iv-rank `marketdata` store.

---

## 4. Data-structure CONTENT (records + blobs — content, not wire names)

> Field **content** is the architect's lane; the **wire field names** are the Interface Contract's
> (GATE U·X). Plan 1 has already pinned the P1 record shape — restated here as the settled P1 shape,
> not re-derived.

### 4.1 The scan row (P1 `ScanRow`, latest-wins, one CURRENT row per tracked symbol)

Content: canonical **symbol**; last-poll **price** + **% change**; the **score** and **tier**
(consumed from the bundle, never re-derived); **regime** + **vol-regime** labels (closed wire
enums); the gamma **flip** + signed **distance-to-flip %**; **call/put walls** + signed
**distance-to-nearer-wall %**; an **as-of** epoch stamp (the compute that produced the row); and a
**status** from the closed vocabulary (§5.1). **Every numeric field is nullable** — a partial
compute (price-only, or a failed structure pass) still produces an honest row. **No raw series** ride
the row (`[digested-labels-not-raw-dump]`): closed enums + scalars only.

### 4.2 The sweep heartbeat (P1 `SweepHeartbeat`, singleton)

Content: last worker-tick time; last-**completed**-full-pass time (nullable); universe size. This
singleton drives the **worker-down banner** and the two-speed freshness header on the page.

### 4.3 The bundle-blob (P2 addition to the ScanStore — the warm-click payload)

Content: the **full computed bundle** for a tracked symbol (the same object the ticker endpoint
serves), plus a **freshness stamp**. It is a **freshness-gated cache blob**, keyed by symbol,
latest-wins. It is **not** re-shaped or re-scored on read — the web app either serves it (fresh) or
ignores it (stale/miss → normal vendor fetch). This method is deliberately **deferred from P1 to
P2** (added when the reader needs it), noted in Plan 1's self-review.

### 4.4 The per-account view (P3 — content only; storage locus is an OPEN QUESTION, §10)

Content: the user's **subset of the universe** (symbols ⊆ universe), an **ordering**, an optional
**name**, and **display prefs** (sort key + density). It is **server-side state behind the auth
ports** — score-neutral, per-account isolated, never a scoring input. **Whether it extends the
existing `SettingsRecord` or is a dedicated new gated store leaf is an open question for the PM**
(§10) — the architecture only mandates it live behind the auth-settings ports and be server-gated on
writes.

---

## 5. Isolation & error rules (binding)

The governing principle: **rows degrade, sweeps survive, the web app never notices.** Failure is
per-row / per-subsystem, best-effort, and honest.

### 5.1 The row-status vocabulary — the honesty mechanism (closed set)

`ok` (a fresh full compute produced this row) · `stale` (last compute older than the freshness
budget — worker behind/down) · `error` (this symbol failed its last compute; degrades this row
alone) · `building` (tracked but not yet computed once). **The FE renders these via a closed lookup
and NEVER re-derives** (`[digested-labels-not-raw-dump]`). Per-row degradation keeps the table alive
around any single failed ticker.

### 5.2 Best-effort degradation, per subsystem

- **Per-ticker vendor failure** → that row `error`/`stale`; the sweep **continues**; pool backoff on
  throttling. A failed price poll **freezes prices WITH their stamps** (never a fabricated price).
- **Move storm** → capped promotion queue + round-robin fairness (§3.1).
- **Store outage** → the worker **skips writes** (best-effort); the scan read returns **200 +
  degraded status**, never a 5xx. `[best-effort-isolated-or-null]` governs the **read** path.
- **The `[best-effort-isolated-or-null]` auth carve-out applies ONLY to view WRITES:** a view write
  is a state-bearing gated action and returns **real 401/403** (the auth error class), exactly as
  the sim-trade / ai-rec gates do. Every **read** (scan/universe/view-read) stays anonymous-open and
  best-effort-200. The scan reads are **not** an auth failure domain.

### 5.3 Failure-domain separation (worker vs web)

The worker and the web app are **separate failure domains**. A worker death **cannot 5xx the web
app**: the store still holds the last rows, the web serves them stale, and the **stale heartbeat
drives the page banner** ("sweep last ran Xm ago") — a Railway restart policy revives the worker.
Symmetrically, a store outage leaves the **ticker/SSE/trading path completely untouched** (that path
never reads the scan store except the best-effort warm-click, which falls straight through to the
vendor on any miss). **The warm-click read-through adds no new failure surface** to the Ticker page.

### 5.4 Live-vs-static honesty

Rows are **poll-based** with a **declared basis**: as-of + status per row, and the two-speed header
("prices ~30s · structure ~3 min, hot names faster"). **NO SSE, no per-row streams**, never the word
"live" on the table (`[live-vs-static-isolation]` + `[model-read-carries-its-assumptions]` applied to
a table). This is deliberately distinct from the Ticker page's SSE surface.

---

## 6. Net-new technical cruxes (the lanes MUST resolve these — no precedent)

These are the four places the design leaves the well-trodden path. Each phase's execution contract
must own its crux explicitly:

**(a) The multi-ticker snapshot provider method is NET-NEW.** The `MarketDataProvider` port
(`src/providers/base.py`) has only **single-ticker** methods (`fetch_options_market_state`,
`fetch_daily_bars`, `fetch_intraday_bars`, `fetch_recent_trades`). The fast lane needs a **new
multi-ticker stock-snapshot method on the port + the Massive adapter** — **no precedent exists**.
P2's first task must **read `apps/api/src/providers/massive.py::fetch_options_market_state`** and
mirror its request/auth/parse/error idiom for the new call. Flag: this widens the vendor-agnostic
port, so the method must be defined at the ABC (any future vendor must implement it) and stay
best-effort (a failed poll freezes prices).

**(b) The sweep worker is a NET-NEW 2nd process/entrypoint.** The repo has one FastAPI process; a
second long-running worker off the same image (the Railway second-service shape) is **new**. Cruxes
for P2: the entrypoint + nx target (`serve-worker`), the embedded-vs-multiprocess flag, the loop
lifecycle (start/stop/backoff), and — a **named-but-deferred** seam — **multi-replica worker
coordination** (v1 is a **single worker**; the store interface is the coordination seam; do not build
leader-election in v1). The worker holds no HTTP surface.

**(c) Tiering/promotion is the one algorithm that would silently rot** — make it **pure logic with an
injected clock.** Move-detection thresholding, promotion-queue capping, and round-robin fairness are
**pure functions** unit-tested via an injected clock (a `_selftest`, per the backend no-pytest
convention). This is the highest-risk logic in the feature (a subtle fairness/threshold bug degrades
silently to either a herd or a frozen queue) and must be isolated from I/O so it is testable without
the vendor or the store.

**(d) `no local Postgres` → the PG adapter is parity-reviewed, not live-verified** (the iv-rank /
persistent-db precedent). The SQLite adapter is the default that runs + is verified here; the
Postgres adapter is a **statement-level parity review** against the SQLite SQL + the leaf/deferred-
fault assertions, **not** a live-DB gate. The port contract (the `_selftest` parity harness) is the
review surface. This applies to both the scan-rows/heartbeat tables (P1) and the bundle-blob (P2).

---

## 7. Restated binding constraints

### Domain / math invariants (PROJECT_CONTEXT §3 — the scanner consumes, never re-derives)

- **The two gamma sources stay split** (vendor gamma for walls/net-GEX; analytic BS gamma for the
  flip) — the scanner surfaces the flip/walls **as the bundle computed them**; it must not unify or
  recompute them. Score, tier, flip, walls, regime, vol-regime on a ScanRow are **read straight off
  the bundle** `compute_ticker` produced. **No new gamma/flip/greeks/score math anywhere in this
  feature.**
- `gex_spot` vs display `price` semantics, the DTE/expiration window, max-pain/PCR full-chain rules,
  the ×100 IV unit — **all unchanged**; the sweep runs the engine with its existing defaults. The
  scanner introduces **no new derived market math** — it is projection + transport only.

### Promoted build invariants (PROJECT_CONTEXT §5 — restated for this feature)

- **`[additive-keeps-score-byte-identical]`** (HARD) — the leaf-import boundary (§3.5) is the
  enforcement; score/tier/`state_fingerprint`/gate byte-identical with the scanner present or absent.
- **`[best-effort-isolated-or-null]`** — per-row/per-subsystem degradation; store outage → degraded
  200; **auth carve-out on view WRITES only** (§5.2).
- **`[live-vs-static-isolation]`** — poll-based rows, declared basis, **no SSE** (§5.4).
- **`[server-side-gate-enforcement]`** — the view write gate is enforced server-side, never FE-only.
- **`[no-real-order-path]`** — the scanner is **display + links only**; a row-click navigates to the
  Ticker page. No broker, no order/execution path anywhere.
- **`[model-read-carries-its-assumptions]`** — as-of + status per row + the two-speed header; never
  a bare number implying more freshness than exists.
- **`[digested-labels-not-raw-dump]`** — closed wire enums (status/regime/vol-regime/tier); **no raw
  series** in rows; the FE renders enums via closed lookup, never re-derives.
- **`[theme-token-discipline]` + the convexa-design skill** (FE, P4) — token-only, dark/light parity;
  the **data-signal flash exemption** applies to price cells; **tier emphasis** per the amber census;
  **green/red for PRICE DIRECTION only**.
- **`[no-secrets-in-image]`** — the worker's config + the PG connection string are **runtime
  env-injected**, never baked.
- **`[loss-free-durable-migration]`** — **n/a** in v1: the per-account view is **server-side** state,
  no durable *client* key changes. (If a future variant caches a view client-side, it engages.)

### The "trading path stays stateless" narrowing (extended)

This is the **first persistent SCAN store**. Like iv-rank extended the "stateless server → stateless
*trading/bundle path*" narrowing to a market-data side-store, the scanner extends it to a
**scan-result side-store written by a separate process**. The compute transform stays stateless
(recompute-from-vendor, byte-identical); the store is a **best-effort compute cache** — a wiped store
**re-sweeps, never an error**. State outside the trading path, behind swappable ports.

---

## 8. Explicit non-goals (v1)

- **No AI.** AI-seeded views + batch/small-batch recommendations are **v2** (grounded in scan reads).
  **No AI affordances anywhere in the v1 UI.**
- **No SSE / no per-row streams.** The table is poll-based (§5.4). WS-based prices are a named later
  seam (only if poll cadence ever disappoints).
- **No alerts / thresholds / notifications.** (Future feature.)
- **No universe admin UI.** The universe is **owner-curated server config** (edit config + restart
  worker). A "request tracking" flow and a universe admin UI are **named later seams**.
- **No real order / broker path.** Display + links only (`[no-real-order-path]`).
- **No multi-replica worker coordination.** v1 is a **single worker**; the store interface is the
  seam (§6b).
- **No change to `compute_ticker` / the scoring path / the engine math** (§3.5, §7).
- **No new vendor beyond the added multi-ticker snapshot method** on the existing port.
- **No live Postgres verification in this program's gates** (§6d).
- **No UI / layout / copy / endpoint shapes / wire field names** — PM / UX / Interface downstream.

---

## 9. Phase seams (4 sequenced phases — each its own execution contract + GATE Q)

Run sequenced (P1→P4), like the redesign stages; each is an independently-testable deliverable with
its own execution contract and GATE Q. Dependency edges are strict.

| Phase | Owns | Depends on | Key deliverables |
|---|---|---|---|
| **P1 — ScanStore** | The persistence leaf | — | `scanstore/` port + record + SQLite (default) + Postgres (parity-reviewed) + env factory + `_selftest`. **Already fully specified (Plan 1).** |
| **P2 — Sweep worker + snapshot** | The producer | P1 | The 2nd-process entrypoint + nx `serve-worker` + embedded flag; the **net-new multi-ticker snapshot** method (port + Massive); the two-speed loop; **tiering/promotion pure logic (injected clock)**; heartbeat writes; the **bundle-blob** store method (§4.3). |
| **P3 — Read API + conformance + warm-click + view** | The web surface | P1 + P2 | The scan/universe reads; the **server-gated per-account view** (auth-settings ports); the standalone `.spire/clusters/tech/state/conformance/scanner.json`; the ticker **warm-click read-through** of the P2 bundle-blob. Routes register under `/api/` **before** any `/{ticker}` catch-all. |
| **P4 — Frontend `/scanner`** | The page | P3 | Swap the stub; the dense terminal table + view editor + the **four states** (skeleton / empty / worker-down banner / per-row degrade) + mobile card collapse; `libs/api` fetchers. References `docs/design/DESIGN_SYSTEM.md` (StatTile / TintChip[emphasis] / useFlashOnChange / Widget); joins the **393px no-overflow e2e** route set. |

**Dependency edges:** P2 consumes P1's `ScanStore`. P3 consumes P1 + P2 (reads rows/heartbeat +
the bundle-blob). P4 consumes P3's API. The **warm-click** couples P3's ticker-endpoint read to
P2's bundle-blob write across the process boundary — P3 owns the read-through; P2 owns the write.

**⚠ system-12 precedes P3's GATE U·X (hard).** BEFORE P3's design splits into build contracts,
reconcile the conformance-spec **authoring docs** (they still say "embed the ```json block"; the
**standalone `.spire/clusters/tech/state/conformance/{feature}.json`** convention is canonical — precedent
`iv_rank.json`). These are **kit-managed framework files** → the fix flows back **via the kit
(BACKLOG §E)**, not an in-place edit. Skipping this repeats the ai-recommendations GATE-Z bounce.

---

## 10. Open questions for the PM / UX (deliberately deferred — product/UX/interface decisions)

1. **Per-account view storage locus** — extend the existing `SettingsRecord` (one more settings
   field) **vs** a dedicated gated store leaf behind the auth ports. Architecture mandates only
   "behind the auth-settings ports, server-gated on writes" (§4.4); the choice is a
   product/complexity call. (View shape = symbols ⊆ universe + order + name + sort/density.)
2. **The default-view definition** — an owner-curated explicit symbol list **vs** the top-N-by-score
   fallback (and **what N** when unset). Both are supported by the architecture; which is the v1
   default, and the N, are product choices.
3. **Freshness / cadence copy + the two-speed header** — the exact words for "prices ~Xs · structure
   ~Ym, hot names faster", the "sweep last ran Xm ago" banner, and the per-row status/as-of framing.
   Architecture mandates *that* they are self-describing; PM/UX own the copy.
4. **The universe-config mechanism** — the concrete owner-curation surface for the 50–100 universe
   (env list vs a config file vs a checked-in JSON) and the "edit + restart worker" operational
   story. Architecture mandates "owner-curated server config the worker reads"; the exact mechanism
   is a PM/ops call. (Related: confirm 50–100 as the v1 ceiling and the pass-time expectation.)
5. **The move-detection default threshold + cadences** — X% (design suggests ~0.75%), the fast-lane
   interval (~20–30s), and the promotion-queue cap. Architecture mandates the mechanism + fairness;
   the tunables are product/ops.
6. **Column set, sort/density defaults, and the mobile card shape** — UX (references the DS + the
   Positions card-collapse pattern). Architecture fixes only the *content available* per row (§4.1).
7. **Endpoint shapes + wire field names** for scan/universe/view + the conformance spec — the
   Interface Contract's (GATE U·X); this contract fixes only the boundaries (§3.3).

---

## 11. Repo grounding (files this shape mirrors / touches — by path, not pasted)

- `docs/superpowers/specs/2026-07-23-scanner-v1-design.md` — the owner-approved design (authority).
- `docs/superpowers/plans/2026-07-23-scanner-01-scanstore.md` — Plan 1, the settled P1 ScanStore.
- `apps/api/src/marketdata/` (`ports.py`/`sqlite_store.py`/`postgres_store.py`/`__init__.py`) — the
  iv-rank store family the `scanstore/` leaf is a 1:1 structural sibling of.
- `apps/api/src/providers/base.py` — the `MarketDataProvider` ABC the net-new multi-ticker snapshot
  method widens (single-ticker methods only today).
- `apps/api/src/providers/massive.py` — `fetch_options_market_state`, the request/auth/parse idiom
  the new snapshot call mirrors.
- `apps/api/src/core/chain_store.py` — the best-effort side-store-around-stateless-compute + the
  pre-warm precedent the warm-click read-through extends across the process boundary.
- `apps/api/main.py` — the web orchestration boundary (attach-after-scoring, the `/api/` route
  registration order, the auth gate wiring) the read API + warm-click mount onto.
- `apps/api/src/auth/` — the auth-settings ports + server-side gate the per-account view rides.
- `.spire/clusters/tech/state/conformance/iv_rank.json` — the standalone-conformance-spec precedent `scanner.json`
  follows; `.spire/clusters/tech/contracts/_archive/iv-rank/` — the persistent-market-data-store precedent
  (one-way leaf + parity-reviewed-not-live-verified Postgres).
- `docs/design/DESIGN_SYSTEM.md` — the P4 component authority (StatTile / TintChip / useFlashOnChange
  / Widget).
```
