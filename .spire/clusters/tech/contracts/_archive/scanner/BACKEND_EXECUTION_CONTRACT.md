# scanner — BACKEND_EXECUTION_CONTRACT (Phase P3 — the read API + gated view + warm-click)

> **Scope: PHASE P3 ONLY** (3rd of the four sequenced phases). **Overwrites the P2 contract** (P2
> shipped + GATE Q PASS 7/7; see git history + `QA_REPORT.md`). Binds the **backend lane** for P3.
>
> **Depends on P1 (ScanStore) + P2 (worker + bundle-blob), both shipped.** P3 adds the **web surface**
> that READS what P1/P2 produce (rows, heartbeat, bundle-blob) + the **server-gated per-account view**.
> It emits **exactly** what `INTERFACE_CONTRACT.md` pins — this contract references the interface for the
> wire and does **not** restate field shapes or any math.

---

## 1. What P3 delivers (backend, web-app only)

All on `apps/api`'s **existing web surface** (`main.py` is the orchestration boundary that mounts it —
the leaf-import boundary of §3 is untouched). No new process, no worker change.

1. **The scan read API** — four routes (INTERFACE §1), registered under `/api/` **before** any
   `/{ticker}` catch-all alias (ARCHITECTURE §9):
   - `GET /api/scan` — reads `ScanStore.read_rows` + `read_heartbeat`, resolves the requested-or-default
     view (D2), applies the **building-fill** rule (INTERFACE §3.1), returns the `ScanResponse` envelope.
     Anonymous-open, best-effort, **always 200 + status — never a 5xx for scan trouble**.
   - `GET /api/scan/universe` — reads the owner-curated universe config the worker was configured with
     (the P2 `src/scanner/config/universe.json` loader / its shared accessor), returns the read-only
     list. Anonymous-open, always 200.
   - `GET /api/scan/view` — resolves the caller's effective view (account view if signed-in & saved,
     else the default view). Anonymous-open, always 200.
   - `PUT /api/scan/view` — the **server-gated WRITE** (below).
2. **The server-gated per-account view (D1)** — persisted as **a field on the existing per-user settings
   record, behind the existing `apps/api/src/auth/` settings ports** (the same ports `PUT /api/auth/settings`
   rides). The PUT is **enforced server-side** (`[server-side-gate-enforcement]`): real **401/403** for a
   signed-out caller, **422** for a symbol outside the current universe / a bad `sort.key`/`density`,
   **200 echo** of the saved view for a signed-in caller. **Nothing is persisted when signed-out**, even
   if the FE guard is bypassed (AC-3). Reads (`GET /api/scan/view`) stay anonymous-open.
3. **The ticker warm-click read-through** — the **existing** ticker endpoint gains a best-effort
   read-through of the P2 **bundle-blob** for **tracked** symbols **before** the vendor: a fresh blob is
   deserialized and served; a **miss/stale is a miss** → the **normal vendor fetch** (the existing path,
   unchanged). This is the `chain_store` pre-warm precedent extended across the process boundary (worker
   writes, web reads). **It changes only where the INPUT came from — never the served bundle's bytes.**
4. **The standalone conformance spec** `.spire/clusters/tech/state/conformance/scanner.json` (already authored by this
   GATE U·X; the interface REFERENCES it, does not embed it) — the GATE-Q runnable surface for the two
   anonymous-open reads.

---

## 2. What it EMITS — bind to the interface (do NOT restate shapes here)

The four endpoints emit **exactly** the request/response shapes, field names/types/presence, the closed
status/enum vocabularies, and the 200 / 401 / 403 / 422 semantics pinned in **`INTERFACE_CONTRACT.md`
§1–§4**. The row/heartbeat wire keys are the **already-shipped** `ScanRow.to_wire()` /
`SweepHeartbeat.to_wire()` from `apps/api/src/scanstore/ports.py` — **reuse them, do not rename or add
keys**. The `ScanView`/`ScanResponse`/`UniverseResponse` envelopes are the interface's §2–§3.

---

## 3. Binding invariants (restate + honor — the boundaries P3 touches)

- **`[additive-keeps-score-byte-identical]` (HARD — the load-bearing boundary).** The warm-click
  read-through **must not change the served bundle's bytes.** `compute_ticker` stays the **sole
  transform**; the read-through only changes where the **input** (the computed bundle) came from —
  exactly like `chain_store`. Score / tier / `state_fingerprint` / gate stay **byte-identical** whether
  the blob was hit or the vendor was fetched, and whether the scanner exists or not. `scanstore/` stays a
  **one-way leaf**: `main.py` reads it; **no scoring module imports it** (`engine.py`/`signals.py`/
  `live.py`/`darkpool.py`/`chain_store.py`/the bundle-compute path). No scan row/view/heartbeat is ever a
  scoring input.
- **`[best-effort-isolated-or-null]`.** Every **READ** (`/api/scan`, `/api/scan/universe`,
  `/api/scan/view`) is best-effort **200 + status**: a store outage / read fault degrades content
  (stale rows, `sweep: null`, per-row `stale`/`error`) but **never 5xx's**. A single failed symbol
  degrades **that row alone** (AC-5). The scan reads are **not** an auth failure domain.
  **Auth carve-out — WRITES only:** `PUT /api/scan/view` is the one gated, state-bearing action and
  returns a **real 401/403** when signed-out (AC-3). The warm-click **adds no new failure surface** to
  the ticker endpoint (a miss falls straight through — ARCHITECTURE §5.3).
- **`[server-side-gate-enforcement]`.** The view WRITE gate is enforced **server-side**, never FE-only —
  a signed-out PUT is refused at the server and persists nothing (the `PUT /api/auth/settings` / sim-trade
  / ai-rec gate precedent).
- **`[live-vs-static-isolation]`.** The scan reads are **poll-based** (plain REST reads of the store);
  **no SSE, no per-row streams, no WebSocket** on the scan surface. Distinct from the ticker SSE path.
- **`[model-read-carries-its-assumptions]` / `[digested-labels-not-raw-dump]`.** The response carries the
  per-row `as_of` + `status` + the heartbeat epochs so the FE can be self-describing; closed enums +
  scalars only, no raw series. The backend never renders freshness copy or the word "live" — it emits
  epochs; the FE derives the copy (UX_BLUEPRINT §2).
- **`[no-real-order-path]`.** Display/read + a persisted view only. No broker/order/execution path.

---

## 4. GATE Q surface (how P3 is verified — mechanical + structural + the runnable conformance)

Run by a fresh de-correlated `qa-verify` after the lane reports done (venv =
`apps/api/.venv/Scripts/python.exe`, `cwd=apps/api`; boot `npx nx serve api` → uvicorn :8000):

1. **Conformance (system-1) GREEN** — `interface_conformance.py --spec .spire/clusters/tech/state/conformance/scanner.json`
   passes both anonymous-open reads (envelope-only; `rows` may be `[]`, `sweep` may be `null` on a fresh
   boot — both PASS). No ticker warm-up needed (store reads, not a cold vendor fetch).
2. **Route order** — grep/confirm the four `/api/scan*` routes register **before** any `/{ticker}`
   catch-all alias (ARCHITECTURE §9); `curl /api/scan/universe` is not swallowed as ticker `scan`.
3. **Anonymous-open reads, best-effort 200** — cookieless `GET /api/scan`, `/api/scan/universe`,
   `/api/scan/view` all return **200** with the interface envelope; a simulated store outage still
   returns **200 + degraded** (never 5xx). Default-view resolution (D2): explicit list → that list; unset
   → top-20-by-score; empty store → the configured/universe symbols as `building` (never a dead empty
   screen, AC-1/AC-8).
4. **The gated WRITE (the `[server-side-gate-enforcement]` catch)** — a **cookieless** `PUT /api/scan/view`
   returns a **real 401/403** and persists **nothing** (re-read shows no change); a **signed-in** PUT
   returns **200** + echoes the saved view and **persists across reload** (AC-2); a PUT with a symbol
   outside the universe / bad `sort.key`/`density` returns **422** (AC-13). Independently demonstrate the
   RED (drop the gate → an anonymous PUT persists) then restore.
5. **Warm-click byte-identity (HARD)** — a tracked-symbol ticker request with a **fresh** bundle-blob
   present serves a bundle **byte-identical** (score/tier/`state_fingerprint`) to the vendor-fetched
   bundle for the same inputs; a **stale** blob is a **miss** → normal fetch (never served as fresh);
   a **miss** falls straight through (no new failure surface). Confirm `compute_ticker` is unchanged and
   the ticker endpoint's existing `iv_rank.json` conformance floor still passes.
6. **Leaf/boundary AST (HARD)** — no scoring module imports `scanstore/`; `main.py` (web) is the only web
   orchestration boundary that reads it; the view write rides the **auth-settings ports**, not a new
   scoring path. `git diff` confined to `main.py` route wiring + the auth-settings view-field extension +
   the ticker read-through hook + the (already-committed) conformance spec — **0 edits to
   `engine.py`/`signals.py`/`live.py`/`darkpool.py`/`compute_ticker`**.

---

## 5. Lane rules

- Backend lane only; writes under `apps/api/` (+ the already-authored `.spire/clusters/tech/state/conformance/scanner.json`,
  which is this GATE's, not the backend lane's, to re-touch). Touch **no** UI, **no** `libs/api`, **no**
  engine/signals/scoring code. The only shared-file edits are **additive**: the `main.py` route
  registration + the ticker read-through hook, and the **one settings-field extension** on the existing
  auth-settings record/ports (D1). `compute_ticker` and the scoring path are **unchanged**.
- **Emit exactly the interface** (`INTERFACE_CONTRACT.md`). If you find the interface wrong or
  under-specified, **STOP and report** the exact endpoint + conflict (GATE-Z candidate) — do not invent
  a wire shape around it, and do not rename the shipped `ScanRow`/`SweepHeartbeat` keys.
- **Commit** per-task (local, on `main`). **Do NOT push** — the conductor pushes after P3's GATE Q. **Do
  NOT run `nx` folder renames** (daemon tree-lock gotcha; n/a here — files + route wiring only).
- Surface in your return summary: the default-view resolution behavior confirmed (D2 explicit-list vs
  top-20 fallback vs empty-store building), and the warm-click byte-identity result.
