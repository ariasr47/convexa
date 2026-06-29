# rebrand-convexa — FRONTEND EXECUTION CONTRACT (→ apps/dashboard + libs/api)

> Compressor #3 output. Lane: frontend executioner. Inputs: UX_BLUEPRINT, INTERFACE_CONTRACT.md (NO
> interface change), ARCHITECTURE_CONTRACT §1/§2 (rename map + the loss-free migration seam),
> PRODUCT_CONTRACT §5/§6/§7. This is the bulk of the feature: the durable migration + the brand swap.

## 0. Scope

Three workstreams: (A) the loss-free migrate-on-read helper across the 4 durable stores; (B) the
`@org/api` client-file rename + brand identifiers; (C) brand copy strings + download-filename stems +
reconciling the stale brand-assertion tests. **No interface change** — `@org/api` keeps the same
public surface and the same consumed fields (INTERFACE_CONTRACT.md). **No new component state, no
migration UI** (PRODUCT §7 — adding a banner/toast is a BOUNCE).

---

## A. The loss-free migrate-on-read helper (HARD — primary QA focus)

### A.1 Shape — one reusable helper, NOT per-store ad-hoc (ARCHITECTURE §2.1)

A single small reusable helper resolves the durable blob across both brand prefixes, shared by all 4
stores. Reference contract (CONTENT, not final code — ARCHITECTURE §2.1):

```
resolveDurable(newKey, oldKey):
  raw = localStorage.getItem(newKey)            # new wins
  if raw != null: return raw
  raw = localStorage.getItem(oldKey)            # else fall back to legacy brand key
  if raw != null:
      try localStorage.setItem(newKey, raw)     # promote forward, idempotent
      # DO NOT remove(oldKey) — leave intact (mirrors the v1->v2 chain)
      return raw
  return null                                   # nothing stored yet
```

Guarantees the helper MUST hold (ARCHITECTURE §2.1/§2.4):
- **new wins**: if `newKey` exists, return it and never consult `oldKey`.
- **promote-forward-once**: the first read that finds only the old blob writes it forward under
  `newKey`; subsequent reads short-circuit at `newKey` (idempotent — no re-key, no duplicate).
- **never delete old**: the `gammaflow.*` blob is NEVER removed (rollback-safe fallback).
- **never throw**: every `getItem`/`setItem`/`JSON.parse` stays inside the store's EXISTING try/catch
  → on any failure the store degrades to `empty()` in-memory, never throws into the UI, never wipes a
  blob. The helper sits UNDERNEATH `read()`, not around the in-memory `memory` cache (the
  `__resetMemory`/`__resetLocalPrefs` test seams stay).

### A.2 Per-store wiring (the 4 durable stores in scope)

The KEY CONSTANT in each store flips to `convexa.*`; the old `gammaflow.*` literal is retained ONLY
as the helper's `oldKey` migration source. The `.v1`/`.v2` segment and the in-blob `schema_version`
are UNCHANGED (brand-prefix rename only — ARCHITECTURE §2.5).

| Store file | const today | new key | old key (migration source) |
|---|---|---|---|
| `apps/dashboard/src/app/ghost-trade/store.ts` | `STORAGE_KEY = 'gammaflow.ghost-trade.v1'` | `convexa.ghost-trade.v1` | `gammaflow.ghost-trade.v1` |
| `apps/dashboard/src/app/positions/store.ts` | `V1_KEY`/`V2_KEY` | `convexa.positions.v2` (+ `convexa.ghost-trade.v1` as v1 source) | `gammaflow.positions.v2`, `gammaflow.ghost-trade.v1` (see A.3) |
| `apps/dashboard/src/app/personas/store.ts` | `KEY = 'gammaflow.personas.v1'` | `convexa.personas.v1` | `gammaflow.personas.v1` |
| `apps/dashboard/src/app/auth/localPrefs.ts` | `KEY = 'gammaflow.uiprefs.v1'` | `convexa.uiprefs.v1` | `gammaflow.uiprefs.v1` |

`personas/store.ts` carries BOTH custom personas AND `active_persona_id` in the one blob — migrating
the one key carries both (AC-A5 + AC-A6). `localPrefs.ts` carries theme + default_ticker (AC-A7).
Each store's existing `{...empty(), ...JSON.parse(raw)}` hydrate + corrupt-catch stays; the helper
only changes WHICH key supplies `raw`.

### A.3 Positions: compose with the existing v1→v2 chain (do NOT break it — ARCHITECTURE §2.3)

`positions/store.ts:read()` today: try `gammaflow.positions.v2`; else `gammaflow.ghost-trade.v1` →
`migrateV1` → write v2 (v1 left intact). After the rename the read must land a user **whole** whether
their data sits under OLD or NEW brand on EITHER version. **4-case resolution, first hit wins:**

1. `convexa.positions.v2` present → `hydrateV2`. (new brand, current version)
2. else `gammaflow.positions.v2` present → `hydrateV2` + promote forward to `convexa.positions.v2`.
   (old brand, current version — pure brand migration)
3. else `convexa.ghost-trade.v1` present → `migrateV1` → write `convexa.positions.v2`.
   (new brand, legacy version)
4. else `gammaflow.ghost-trade.v1` present → `migrateV1` → write `convexa.positions.v2`.
   (old brand, legacy version — the pre-rename ghost-trade-only user; the original chain + brand hop)

In all four the SOURCE blob is left intact (never deleted). Implementation note: "resolve the
positions-v2 blob across both brands (`resolveDurable('convexa.positions.v2','gammaflow.positions.v2')`),
ELSE resolve the ghost-trade-v1 blob across both brands
(`resolveDurable('convexa.ghost-trade.v1','gammaflow.ghost-trade.v1')`), then apply the UNCHANGED
`migrateV1`." `migrateV1`/`v1TradeToPosition`/`hydrateV2` are byte-unchanged.

> Note: the ghost-trade store and the positions store BOTH read `*.ghost-trade.v1`. The positions
> read promotes it forward into `convexa.positions.v2` (it does not write the ghost-trade key); the
> ghost-trade store independently promotes `gammaflow.ghost-trade.v1` → `convexa.ghost-trade.v1` on
> its own read. Both leave every source blob intact, so the two reads do not conflict.

### A.4 Invariants the build MUST hold (ARCHITECTURE §2.4)
- Idempotent (re-run = no-op after first promote). Never wipe the old blob. Corrupt/absent → empty
  in-memory shape, no throw, blob preserved. Identical post-migration behavior for every store API.

---

## B. `@org/api` client-file rename (ARCHITECTURE §1A)

- Rename `libs/api/src/lib/gammaflow.ts` → `libs/api/src/lib/convexa.ts` (+ `gammaflow.spec.ts` →
  `convexa.spec.ts`, fixing its relative import).
- Edit the ONE barrel line in `libs/api/src/index.ts`: `export * from './lib/gammaflow';` →
  `export * from './lib/convexa';`.
- Rename any `gammaflow`-named identifiers/consts INSIDE the file (the Architect found **zero exported
  identifiers named `gammaflow`** — exports are `getTicker`, `TickerBundle`, etc. — so this is a
  doc-comment/internal-name sweep, not an export rename). **No consumer changes** — every dashboard
  consumer imports via `@org/api` (AC-C5 protects against accidental consumer churn).
- The package public surface is UNCHANGED (same exports, same `@org/api` resolution) — INTERFACE §1.

---

## C. Brand copy strings + stale-test reconciliation

### C.1 User-visible product strings (AC-B1) — UX_BLUEPRINT §2A
Remove any stray live "GammaFlow" from landing / nav wordmark / document title / tooltips-help. The
AppShell `shell-brand` wordmark already shows "Convexa" (UI-only era) — keep it, assert it. No new
copy, no migration notice.

### C.2 Download-filename stems (AC-B2) — UX_BLUEPRINT §2B
- `ghost-trade/store.ts:70`: `gammaflow-decision-history-${date}.json` → `convexa-decision-history-${date}.json`.
- `operator-metrics/useLatencyTrend.ts:219`: `gammaflow-latency-trend-${ts}.json` → `convexa-latency-trend-${ts}.json`.

### C.3 Reconcile the stale brand-assertion tests (D4 — AC-B5; green, not bounced)
- `apps/dashboard-e2e/app-loads.spec.ts:8` — `page.getByText('GammaFlow')` → `page.getByText('Convexa')`
  (and the line-4 comment "the GammaFlow AppBar" → "the Convexa AppBar").
- `apps/dashboard/src/app/positions/positions-page.spec.tsx:319-321` — already asserts
  `getByText('Convexa')` + `queryByText('GammaFlow')` is null; keep/confirm GREEN under the new keys.
  Its seed fixtures that use `gammaflow.positions.v2` / `gammaflow.ghost-trade.v1` (e.g.
  `acceptance.spec.tsx:476,526`) feed the MIGRATION path — they may stay as old-brand seeds (they now
  exercise the migration) OR be updated to seed both; either way the suite must be GREEN with the AC
  cases below proving migration. Do NOT leave a pre-existing brand red for QA to bounce on.

---

## D. Tests to write (THE REQUIRED MATRIX — FE does not choose the set)

The FE implements ALL cases below (a floor) + may add unit tests (a ceiling); never silently drops a
required case (untestable → GATE Z bounce). Each AC maps to ≥1 named passing test (GATE-Q
traceability). Mock only the network boundary; never a live backend. Reference INTERFACE_CONTRACT.md.

### D.1 Loss-free migration — the centerpiece (Group A)
For EACH of the 4 stores, seed the OLD `gammaflow.*` key (no new key), reset the in-memory cache, read:
- **AC-A1** positions carried whole — same set / per-position entry / P/L / Δ-since-entry; new key now exists.
- **AC-A2** positions customization + saved named views restore exactly.
- **AC-A3** positions closed positions + decision history fully present, unchanged.
- **AC-A4** ghost-trade open trade + decision records present, unchanged.
- **AC-A5** custom personas all present.
- **AC-A6** `active_persona_id` selection still active (selection survives, not just the list).
- **AC-A7** theme applied + default ticker in effect.

### D.2 Resolution-order / chain cases (each its own named test — ARCHITECTURE §2.3)
- **case 1**: seed `convexa.positions.v2` only → hydrate v2, no migration.
- **case 2**: seed `gammaflow.positions.v2` only → hydrate + promote to `convexa.positions.v2`.
- **case 3**: seed `convexa.ghost-trade.v1` only (no positions either brand) → `migrateV1` → `convexa.positions.v2`.
- **AC-A8 (case 4)**: seed `gammaflow.ghost-trade.v1` ONLY → legacy trade lands WHOLE in
  `convexa.positions.v2` (legacy version + brand hop in one read); nothing stranded.

### D.3 Idempotency / safety / degradation (Group A-Edge)
- **AC-A9** idempotent — run resolution / reload twice → identical; no duplicated positions/trades/
  personas, no wipe, no re-migration artifact; 2nd read short-circuits at the new key.
- **AC-A10** old key never deleted — after migration `localStorage.getItem(oldKey)` is still non-null
  (rollback-safe), for each store.
- **AC-A11** corrupt old blob (e.g. `'{ corrupt'` under each `gammaflow.*` key) → store's empty
  in-memory state, NO throw into the UI, the unreadable old blob NOT destroyed. (Matches today's
  corrupt-blob behavior — see `acceptance.spec.tsx:526`.)
- **AC-A12** absent old data (nothing either brand) → clean empty/default state, no error, no phantom
  record; data the user then creates persists across a reload (write goes to the new key).
- **AC-A13** BOTH new + leftover old present → new-brand data shown (new wins); old does not merge/
  override; old still present afterward.

### D.4 Brand strings (Group B)
- **AC-B1** render landing + AppShell → "Convexa" present on wordmark/title; `queryByText('GammaFlow')` null.
- **AC-B2** trigger decision-history export AND latency-trend export → captured `a.download` begins
  `convexa-`, never `gammaflow-`.
- **AC-B5** `app-loads.spec.ts` + `positions-page.spec.tsx` assert the single "Convexa" brand and pass.

### D.5 No behavioral / interface change (Group C — FE slice)
- **AC-C3** every page (landing, ticker viewer, positions, scanner stub, operator metrics) renders the
  same content + behavior; only brand text differs (no layout/tile/chart/section change).
- **AC-C4** SSE opens page-scoped to the ticker page, closes on nav-away, reopens on return, never
  double-subscribes, degrades on an SSE drop exactly as before (reuse the existing live-degrade test).
- **AC-C5** the existing `nx test dashboard` + `@org/api` suites pass with no regression beyond the
  intended brand-string updates (B5). The `@org/api` rename does not break any `@org/api` consumer
  (same exports, same resolution).

### D.6 Byte-identical-engine checks (FE-observable slice; BE owns AC-C1/AC-C2 fully)
- The bundle parse + render is unchanged with the same payload (no `@org/api` type/field churn). AC-C1
  (known score + `state_fingerprint`) + AC-C2 (conformance) are BE-owned — see
  BACKEND_EXECUTION_CONTRACT.md / INTERFACE_CONTRACT.md.

---

## E. Out of scope (BOUNCE if requested)
- ANY migration UI (banner/toast/notice) — PRODUCT §7.
- Deleting `gammaflow.*` keys; any blob transform / schema-version bump / `.v1`/`.v2` segment change.
- Renaming `@org/*` scope / `@org/api` alias / tags / import paths / the local folder.
- Any interface/endpoint/payload/field-name/scoring change (INTERFACE_CONTRACT.md holds).
