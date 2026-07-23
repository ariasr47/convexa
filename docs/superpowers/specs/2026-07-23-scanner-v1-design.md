# Scanner v1 — design spec (2026-07-23)

> Product: Convexa. Brainstormed owner + conductor 2026-07-23; four design sections approved
> in dialogue. This spec seeds the delivery pipeline (BRIEF update → GATE A·X) — the pipeline's
> contracts are the build authority; this document records the validated design and its
> decisions. Supersedes the AI-inclusive scope in `.claude/contracts/scanner/BRIEF.md` (v1 cut).

## 1. Purpose and shape

The Scanner replaces the `/scanner` stub with a real multi-ticker surface: **morning triage
first, ambient radar after** — one dense, honest table that answers "which ticker deserves the
deep-dive right now?" from live-scored data, with every row one click from the full Ticker view.

**Scope decisions (owner, 2026-07-23):**
- Watchlist scale: **50–100 tickers** tracked.
- **Global tracked universe on the server** (owner-curated config, v1: edit config + restart
  worker); **per-account views** are subsets of the universe (order + name + display prefs).
  Anonymous users get a read-only **default view**; untracked tickers remain fully usable via
  the single-ticker on-demand Ticker page (the long tail needs no scanner presence).
- **No AI in v1.** AI-seeded views and batch recommendations are explicitly deferred (v2
  candidates); the scan table itself is the triage value. No AI affordances in the UI.
- Vendor context (owner-provided): highest Massive plan — unlimited REST (stay < 100 req/s),
  multi-ticker snapshot has **no per-request ticker cap**, one options-WS connection
  (1,000-contract cap) which the scanner deliberately does NOT use.

## 2. Architecture — approach C (separate sweep worker + shared store)

Chosen over (A) an in-process sweep loop — the owner expects multi-replica; C is
multi-replica-correct from day one. (B) client-orchestrated sweeping was eliminated by the
universe decision (the sweep must run with all tabs closed; sweep-once-serve-everyone).

**C1. The sweep worker** — a second process from the same `apps/api` codebase and container
image (different start command; a second Railway service off the existing image; all config
env-injected per `[no-secrets-in-image]`). Two-speed loop:
- **Fast lane:** ONE multi-ticker stock snapshot poll (~20–30s) → live-ish price/Δ% for every
  universe ticker (~2–3 requests/min total) AND the move-detection signal.
- **Slow lane:** a chain sweep pool (concurrency ~4, far under vendor guidance) computing full
  per-ticker structure through the **unchanged `compute_ticker`** — the engine remains the sole
  transform (score byte-identity by construction). Baseline full pass ≈ 2–3 min at N=100.
- **Move-triggered promotion:** a ticker moving > X% since its last compute (X configurable,
  default ~0.75%) jumps the sweep queue. The promotion queue is capped with round-robin
  fairness — a market-wide move degrades to base cadence, never a thundering herd.
- Local dev: `SCANNER_EMBEDDED=1` runs the same loop inside the dev server process (one
  terminal); production stays true C.

**C2. The shared store** — a new `ScanStore` port in the established `apps/api/src/marketdata/`
family (port + SQLite-on-disk default + Postgres adapter behind the same interface — the
iv-rank pattern). Rows: `{symbol, price, chg_pct, score, tier, regime, vol_regime, flip,
dist_to_flip_pct, call_wall, put_wall, dist_to_wall_pct, as_of, status}` + a worker heartbeat
record + universe metadata. A wiped store re-sweeps; never an error (extends the
"trading path stays stateless; side-stores are compute caches" narrowing).

**C3. The warm-click seam** — the worker also stores each computed **full bundle** as a
freshness-stamped blob. The web app's ticker endpoint gains a **best-effort read-through**:
cold request for a tracked ticker checks the scan store before the vendor (freshness-gated,
any miss/stale → normal fetch, no new failure surface — the chain-prewarm precedent, across
process boundaries). Clicking a scanner row lands on a warm Ticker page.

## 3. API surface (web app only; the worker exposes nothing)

- **`GET /api/scan`** — the one read. The requested view (or default view) as slim rows +
  sweep metadata (`sweep_last_completed`, heartbeat age, universe size). Anonymous-open,
  read-only, poll-friendly. Best-effort degraded responses (200 + status), never a 5xx for
  scan trouble. **Ships a standalone conformance spec `.claude/tools/conformance/scanner.json`**
  — the feature system-12's doc reconciliation lands on (reconcile the authoring docs BEFORE
  the design splits into build contracts).
- **`GET/PUT /api/scan/view`** — the signed-in user's view (symbols ⊆ universe, order, name,
  sort/density prefs), stored behind the existing auth-settings ports, **enforced
  server-side** (`[server-side-gate-enforcement]`; real 401/403 on writes per the auth error
  carve-out). Signed-out: default view + the standard inline sign-in prompt.
- **`GET /api/scan/universe`** — read-only list for the view editor. Universe = owner-curated
  server config read by the worker. "Request tracking" flow: named later seam, not v1.
- **The default view** (what anonymous/new users see) is itself owner-curated config: an
  explicit symbol list, or — when unset — the top 20 universe rows by current score
  (deterministic, recomputed per request from the store; no per-user state involved).

## 4. The page (`/scanner`)

A dense terminal table — the most "terminal" surface in the product, on the Curvature
Terminal system:
- Columns: symbol · price + Δ% (mono `tabular-nums`; green/red = price direction, the
  legitimate use) · score · tier (consumes the wire tier; emphasis per the amber census —
  the scanner never re-derives) · regime (closed wire-enum lookup) · dist-to-flip ·
  dist-to-wall · a quiet `as of Xs` stamp + per-row status glyph. Default sort: score desc;
  sortable; sort/density persist in the view.
- **Honest aliveness:** price cells flash on change (the data-signal motion class — permitted
  by the consolidation ruling); the header states the two speeds plainly ("prices ~30s ·
  structure ~3 min, hot names faster"). No SSE, no per-row streams, never the word "live"
  ([model-read-carries-its-assumptions] applied to a table).
- **Four distinct states:** first-load skeleton · empty view ("pick tickers" CTA / default
  fallback) · worker-down banner ("sweep last ran Xm ago") over intact stale rows · per-row
  degrade (dimmed + glyph; the table lives on).
- **Mobile:** card collapse below `sm` (the Positions pattern); `/scanner` joins the 393px
  no-overflow e2e route set on day one.
- View editor: side panel, search + toggle + reorder over the universe; gated.
- Row click → `/ticker/:symbol` (warm via C3). No AI affordances, no alerts/thresholds
  (future features).

## 5. Failure modes

Rows degrade, sweeps survive, the web app never notices:
- Per-ticker vendor failure → that row `error`/`stale`, sweep continues; pool backoff on
  throttling; failed price poll freezes prices WITH their stamps.
- Move storm → capped promotion queue + round-robin fairness.
- Store outage → worker skips writes (best-effort); `/api/scan` → 200 + degraded status;
  ticker/SSE path untouched (separate failure domain).
- Worker death → stale heartbeat → page banner; Railway restart policy; rows persist.

## 6. Testing (risk-based, per qa-verify §4)

- `test:` tiering/promotion pure-logic units (injected clock) · ScanStore port contract
  parity SQLite↔Postgres (auth-store pattern) · wiped-store-re-sweeps · conformance
  `scanner.json` against `/api/scan` · byte-identity (engine/signals diff empty + existing
  invariant suite) · FE state matrix (skeleton/empty/worker-down/per-row) ·
  gate-awaited-before-view-write · `/scanner` in the 393 no-overflow e2e ·
  closed-lookup regime labels.
- `review:` two-speed header copy · tier emphasis rendering · card collapse ·
  flash-on-change feel.

## 7. Invariant watch (binding on the pipeline contracts)

`[additive-keeps-score-byte-identical]` (compute_ticker unchanged; scanner consumes, never
inputs) · the **single-ticker-on-demand re-justification** (this design IS it: bounded
owner-curated universe, budgeted concurrency, move-triggered priority, no market sweep —
formalize the narrowing at GATE S) · `[best-effort-isolated-or-null]` (per-row/per-subsystem
degradation as specified; auth carve-out on view writes) · `[live-vs-static-isolation]`
(poll-based rows, declared basis, no SSE) · `[server-side-gate-enforcement]` (view writes) ·
`[no-real-order-path]` (display + links only) · `[model-read-carries-its-assumptions]`
(as-of + basis on every row + the two-speed header) · `[digested-labels-not-raw-dump]`
(closed enums; no raw series in rows) · `[theme-token-discipline]` + the convexa-design
skill (data-signal flash exemption; tier emphasis per the amber census) ·
`[no-secrets-in-image]` (worker config env-injected) · `[loss-free-durable-migration]`
(n/a — no durable client keys change; view state is server-side).

## 8. Evolution seams (named, not built)

AI-seeded views + small-batch recs (v2; grounded in scan reads) · "request tracking" flow ·
universe admin UI · alerts/thresholds · WS-based prices (only if poll cadence ever
disappoints) · multi-replica worker coordination (single worker v1; the store interface is
the seam).
