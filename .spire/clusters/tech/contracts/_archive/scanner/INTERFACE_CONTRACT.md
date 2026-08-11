# scanner — INTERFACE_CONTRACT (Phase P3)

> GATE U·X deliverable. The **FE↔BE single source of truth ONLY** for the P3 read API: the endpoints,
> their request/response shapes, field names/types/presence, the closed enum vocabularies, error +
> degraded semantics, and the machine-checkable `## Conformance spec` (which **REFERENCES the standalone
> file**, never embeds a nested block). Both execution lanes bind here.
>
> Resolves **ARCHITECTURE_CONTRACT §10 Q7**. NOT here: server-internal implementation (no store adapter,
> no sweep loop, no `def`), no UI/layout/copy (that is `UX_BLUEPRINT.md`), no math derivation. The
> **wire keys of `ScanRow` and `SweepHeartbeat` are FIXED by the shipped P1 records** — this contract
> binds to `apps/api/src/scanstore/ports.py::ScanRow.to_wire()` / `SweepHeartbeat.to_wire()` and does
> **not** rename or invent row/heartbeat fields.

---

## 1. Endpoints (all on `apps/api`'s existing web surface; the worker exposes nothing)

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/scan` | **anonymous-open**, read-only, poll-friendly | the requested-or-default view as slim rows + sweep metadata |
| GET | `/api/scan/universe` | **anonymous-open**, read-only | the read-only owner-curated universe list for the view editor |
| GET | `/api/scan/view` | **anonymous-open**, read-only | the caller's effective view (account view if signed-in & saved, else the default view) |
| PUT | `/api/scan/view` | **server-gated WRITE** (real 401/403) | save the signed-in user's per-account view |

**Route registration order (ARCHITECTURE §9, HARD):** all four `/api/scan*` routes register **before**
any `/{ticker}` catch-all alias, so `scan`/`universe`/`view` are never swallowed as a ticker symbol.

**The warm-click is NOT a new endpoint.** It is a **best-effort read-through inside the EXISTING ticker
endpoint** (`GET /api/ticker/{ticker}` and its `/{ticker}` alias): a cold request for a **tracked**
symbol may read the scan store's bundle-blob before the vendor. **The served bundle bytes are
unchanged** — same shape, same numbers, same conformance as today; a miss/stale falls straight through
to the normal vendor fetch. No new wire, no new field, no new query param, no new status. Stated here as
a boundary only (BACKEND_EXECUTION_CONTRACT owns the read-through; it emits **nothing new** on the wire).

---

## 2. Shapes

### 2.1 The scan row (`ScanRow.to_wire` — FIXED P1 keys, do not rename)
Every numeric field is **nullable** (a partial/failed compute still yields an honest row). No raw series
ever rides a row (`[digested-labels-not-raw-dump]`).

```ts
interface ScanRow {
  symbol: string;                    // canonical UPPER-case
  price: number | null;             // last poll price
  chg_pct: number | null;           // % change since prior session close
  score: number | null;             // opportunity_score — CONSUMED from the bundle, never re-derived
  tier: string | null;              // opportunity_tier enum (closed lookup on the FE)
  regime: string | null;            // regime label enum (closed lookup)
  vol_regime: string | null;        // vol-regime label enum (closed lookup)
  flip: number | null;              // gamma flip level
  dist_to_flip_pct: number | null;  // signed % of price to the flip (display transport)
  call_wall: number | null;
  put_wall: number | null;
  dist_to_wall_pct: number | null;  // signed % of price to the NEARER wall
  as_of: number;                    // epoch-seconds of the compute that produced the row (NOT nullable)
  status: ScanStatus;               // one of the closed vocabulary below
}
```

### 2.2 The closed status vocabulary (authoritative on the wire; FE renders via closed lookup)
```ts
type ScanStatus = 'ok' | 'stale' | 'error' | 'building';
```
- `ok` — a fresh full compute produced this row.
- `stale` — last compute older than the freshness budget (worker behind/down); price frozen with its
  `as_of`.
- `error` — this symbol failed its last compute (degrades this row alone).
- `building` — tracked but not yet computed once (cold universe entry / pre-first-tick).

`tier`/`regime`/`vol_regime` are the engine's existing closed label enums as emitted on the wire; the FE
maps them through a **closed lookup and never re-derives** them (an unknown value renders no label).

### 2.3 The per-account view
```ts
type SortKey = 'score' | 'symbol' | 'price' | 'chg_pct' | 'dist_to_flip_pct' | 'dist_to_wall_pct';
interface ViewSort { key: SortKey; dir: 'asc' | 'desc'; }

interface ScanView {
  source: 'account' | 'default';    // where THIS response's view came from
  authenticated: boolean;           // whether the caller is signed in
  name: string | null;              // optional user label; null for the default view
  symbols: string[];                // subset ⊆ universe, IN DISPLAY ORDER (order IS the ordering)
  sort: ViewSort;                   // default { key: 'score', dir: 'desc' }
  density: 'compact' | 'comfortable'; // default 'compact'
}
```

### 2.4 The sweep metadata (`SweepHeartbeat.to_wire` — FIXED P1 keys)
```ts
interface SweepHeartbeat {
  updated_at: number;                    // last worker tick (epoch seconds)
  sweep_last_completed: number | null;   // epoch seconds of the last COMPLETED full pass, or null
  universe_size: number;                 // symbols the worker is tracking
}
```
The FE computes "sweep last ran X ago" (UX_BLUEPRINT §2.3) from these epochs vs its own clock; the wire
carries **no pre-rendered freshness copy** and never the word "live".

---

## 3. Per-endpoint request/response + error semantics

### 3.1 `GET /api/scan` — anonymous-open, best-effort, **always 200**
- **Request:** no required params. The **session cookie determines the effective view**: a signed-in
  user with a saved view → their account view; otherwise (anonymous, or signed-in with no saved view) →
  the **owner-curated default view** (D2: explicit list; when unset, top-20-by-current-score; when the
  store holds no computed rows, the configured/universe symbols in `building`). Deterministic, no
  per-user state for the default path.
- **Response 200:**
  ```ts
  interface ScanResponse {
    view: ScanView;                 // the effective view (source: 'account' | 'default')
    rows: ScanRow[];                // one row per view symbol; see the building-fill rule below
    sweep: SweepHeartbeat | null;   // null iff the worker has never written a heartbeat
  }
  ```
- **Building-fill (honest, never a dead screen — D2/AC-1/AC-8):** every symbol in `view.symbols` is
  present in `rows`. If the store has a row for it, that row is returned as-is; if the store has **no**
  row yet (pre-first-tick), the backend emits a **synthesized `building` placeholder** for it (numeric
  fields `null`, `status: 'building'`). For a synthesized building row `as_of` is **not a freshness
  claim** — the FE MUST branch on `status === 'building'` before rendering `as_of` (UX_BLUEPRINT §2.2).
- **Wire order:** `rows` are returned in the view's saved `symbols` order (default-view fallback:
  score-descending). The FE re-sorts client-side per `view.sort`; ordering on the wire is a convenience,
  not a contract the FE depends on beyond stability.
- **Degraded (`[best-effort-isolated-or-null]`):** a store outage / read fault → **200 with degraded
  content** (stale rows if any, `sweep` possibly `null`, per-row `status` carrying `stale`/`error`).
  **Never a 5xx for scan trouble.** The scan reads are **not** an auth failure domain.

### 3.2 `GET /api/scan/universe` — anonymous-open, **always 200**
- **Request:** none.
- **Response 200:**
  ```ts
  interface UniverseResponse {
    symbols: string[];     // the owner-curated tracked universe (canonical UPPER-case), stable order
    universe_size: number; // == symbols.length; the count the worker was configured with
  }
  ```
- No add/request/remove path in v1 (`[no-universe-admin]`); this is a read only.

### 3.3 `GET /api/scan/view` — anonymous-open, **always 200**
- **Request:** none (session-scoped).
- **Response 200:** a `ScanView`. Signed-in with a saved view → `source: 'account'`,
  `authenticated: true`. Otherwise → the **default view** (`source: 'default'`), with
  `authenticated` reflecting whether a session exists. Anonymous ALWAYS gets a readable default (AC-4);
  a read is never gated.

### 3.4 `PUT /api/scan/view` — **server-gated WRITE** (the one auth failure domain)
- **Request body:**
  ```ts
  interface ViewWriteBody {
    symbols: string[];              // subset ⊆ universe, IN DISPLAY ORDER (required)
    name?: string | null;           // optional label
    sort?: ViewSort;                // optional; defaults applied server-side if omitted
    density?: 'compact' | 'comfortable';
  }
  ```
- **200 (signed-in):** echoes the saved `ScanView` (`source: 'account'`, `authenticated: true`) — the
  server-wins saved bag (persistence-echo precedent of `PUT /api/auth/settings`).
- **401 / 403 (signed-out):** a **real auth refusal** (`[server-side-gate-enforcement]`, the sim-trade /
  ai-rec / `PUT /api/auth/settings` gate precedent) — **nothing is persisted**, even if the FE guard is
  bypassed/absent (AC-3). This is the `[best-effort-isolated-or-null]` **auth carve-out on WRITES only**.
- **422 (validation):** a symbol **not in the current universe**, or a bad `sort.key` / `density`. The
  editor cannot invent, add, or request universe symbols (AC-13).
- **Storage locus (D1):** the view is persisted **as a field on the existing per-user settings record**,
  behind the existing auth-settings ports, server-gated on writes. The **dedicated `/api/scan/view`
  endpoints are the FE↔BE truth** for the view (the scan wire stays cohesive); whether the view also
  rides the `/api/auth/settings` echo is a backend impl choice and is **not** part of this contract.

---

## 4. Warm-click boundary (no wire delta — restated for both lanes)
`GET /api/ticker/{ticker}` gains a best-effort **read-through** of the P2 bundle-blob for tracked
symbols **before** the vendor. Constraints that make it wire-invisible:
- The **served bundle bytes are byte-identical** to today (`[additive-keeps-score-byte-identical]`):
  `compute_ticker` stays the sole transform; the read-through only changes where the **input** came
  from, exactly as `chain_store` does. Score / tier / `state_fingerprint` / gate unchanged.
- **Freshness-gated:** a stale blob is a **miss**, never served as fresh → normal vendor fetch.
- **No new failure surface:** any miss/error falls straight through to the existing path. The ticker
  endpoint's conformance (`iv_rank.json` regression floor) is **unchanged**.

---

## 5. Conformance spec (system-1)

**Canonical spec: the standalone file `.spire/clusters/tech/state/conformance/scanner.json`** (the current convention
— mirrors `iv_rank.json` / `user-accounts.json`; **NOT** a nested ```json block embedded here, which is
the ai-recommendations GATE-Z trap). `interface_conformance.py` runs it via
`--spec .spire/clusters/tech/state/conformance/scanner.json`.

**What it asserts** — only the two **anonymous-open, cookieless-deterministic READS**, envelope-only:
- `GET /api/scan` → `view` (object) + `view.source`/`view.density` (string) + `view.symbols` (array) +
  `view.sort` (object) + `rows` (array) + `sweep` (**object|null**).
- `GET /api/scan/universe` → `symbols` (array) + `universe_size` (number).

**Excluded from the anonymous sweep:** `PUT /api/scan/view` — the gated WRITE returns a real 401/403 to a
cookieless probe by design (`[server-side-gate-enforcement]`), so it **cannot** be checked by the
cookieless tool, exactly as ai-recommendations' auth-gated POST was removed from its anonymous sweep. Its
signed-in echo shape (§3.4) and the gated-401 path are verified by the BE runtime proofs + FE tests.
`GET /api/scan/view` is anonymous-open too but is not added — the two reads above are the representative
anonymous surface.

**Why envelope-only, no deep leaf required:** the scanstore starts **empty** and the worker may not have
written a heartbeat yet, so on a fresh boot `rows` can be `[]` and `sweep` can be `null` — both honest,
not errors (`[best-effort-isolated-or-null]`). Asserting `rows[0].*` or a `sweep` child would FAIL a
legitimately-empty/pre-worker cycle. The `ScanRow`/`SweepHeartbeat` field types + presence + the closed
status vocabulary are pinned in §2 and verified off-harness by the BE runtime proofs + the FE test
matrix (UX_BLUEPRINT §6).

---

## 6. Binding for the execution lanes
- **BACKEND_EXECUTION_CONTRACT** binds here: it EMITS the four endpoints exactly as §1–§3 specify —
  anonymous-open best-effort-200 reads (the `ScanRow`/`SweepHeartbeat` P1 keys + the `ScanView`
  envelope), the building-fill rule, the default-view (D2) resolution, and the **server-gated PUT** with
  real 401/403 + 422; the warm-click read-through per §4 (emitting nothing new).
- **FRONTEND_EXECUTION_CONTRACT** — **NO_UI_CHANGE in P3.** The `/scanner` page + `libs/api` fetchers
  that CONSUME this wire are **P4**, built against `UX_BLUEPRINT.md` (the design authority) + this
  contract.
