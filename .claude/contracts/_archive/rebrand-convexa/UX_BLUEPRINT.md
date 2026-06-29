# rebrand-convexa — UX BLUEPRINT

> Role: UX / Tech-Writer (runs after the PM). Inputs: PROJECT_CONTEXT, PRODUCT_CONTRACT (23 ACs,
> D1–D5), ARCHITECTURE_CONTRACT (rename map, §2 migration seam, NO interface change), BRIEF,
> OPEN_THREADS. Output: this blueprint + the three execution files. Scope = component states,
> microcopy, the brand-string inventory, and the AC→test matrix that becomes the FE "Tests to write"
> set. No server internals, no math, no final endpoint/payload decisions.

**This is a rename + a silent, loss-free localStorage migration ONLY.** The app renders
byte-identically; the migration is invisible. There is **NO new component state, NO migration UI**
(the PM ruled out any banner / toast / "we moved your data" prompt — adding one is a scope expansion
to BOUNCE, not add). The UX work here is almost entirely a copy inventory + the test matrix.

---

## 1. Component states — CONFIRMED: NONE NEW

Per PRODUCT_CONTRACT §5/§7 and ARCHITECTURE §5, the migration introduces **zero new component
states**. Every store already has its full state surface (default / populated / empty / corrupt-blob
degradation) and that surface is unchanged. The standard state matrix below is reproduced ONLY to
state explicitly that each existing state is byte-identical after the rename — none is added, removed,
or re-worded.

| Existing state | Trigger | Behavior after rename | New copy? |
|---|---|---|---|
| Default / populated | Stored data exists (new or migrated old) | Renders the SAME content for the same underlying data | none |
| Empty / clean new-user | No stored data under either brand | The store's existing empty state (no positions / no open trade / default prefs) | none |
| Loading / skeleton | Cold bundle / SSE / async AI-rec (ticker page) | Unchanged (skeleton-first load from ticker-load-experience) | none |
| Stale | Post-success poll failure | Unchanged ("Couldn't refresh — showing data from {age} ago") | none |
| Offline / live-degrade | SSE drop (payload-gap watchdog >15s) | Unchanged (`⚠ Live offline`, dimmed live tiles, `⏸ offline`) | none |
| Error | Cold-start bundle failure | Unchanged (red error + Retry) | none |
| Corrupt durable blob | Unreadable old OR new brand blob | The store's existing empty in-memory state; NO error into the UI; blob NOT destroyed (now mirrored across BOTH brand keys — §2 migration) | none |

**The only user-visible difference anywhere is brand text** (AC-C3). The migration itself surfaces
nothing — no notice, no spinner, no diff. Where each datum surfaces is also unchanged: positions on
`/positions`, ghost trade on the ticker/positions surfaces, personas in the PersonaPicker, theme +
default ticker via Settings — all reading the same shapes from the now-`convexa.*` keys.

---

## 2. Brand-copy string inventory (the strings that change — D1/D2)

Display/brand name = **"Convexa"** (title-case). Identifiers / storage-prefix / repo / download
filename-stems = lowercase **`convexa`**. The generic reusable delivery *method* stays **unbranded**
("the kit" / "the method" / "delivery-kit") — it is NOT "Convexa" (D1).

### 2A. User-visible product strings (FE — AC-B1)
| Where | Old | New (display) |
|---|---|---|
| Landing splash wordmark / hero | "GammaFlow" (any stray) | "Convexa" |
| AppShell nav wordmark (`shell-brand`) | already "Convexa" (UI-only era) | "Convexa" (no change; assert it) |
| Document `<title>` / page titles | any "GammaFlow" | "Convexa" |
| Brand mentions inside tooltips / help / glossary copy rendered in the UI | "GammaFlow" product name | "Convexa" |

No live "GammaFlow" product name remains on any user-visible FE surface (AC-B1). The AppShell
wordmark already shows "Convexa" from the prior UI-only rebrand; the work is removing any remaining
stray "GammaFlow" and reconciling the assertion tests (AC-B5).

### 2B. Download filename stems (FE — AC-B2)
| Where | Old stem | New stem |
|---|---|---|
| `ghost-trade/store.ts:70` decision-history export | `gammaflow-decision-history-{date}.json` | `convexa-decision-history-{date}.json` |
| `operator-metrics/useLatencyTrend.ts:219` latency-trend export | `gammaflow-latency-trend-{ts}.json` | `convexa-latency-trend-{ts}.json` |

Cosmetic stems only; not parsed on re-import. The `{date}`/`{ts}` suffix format is unchanged.

### 2C. Backend human-readable strings (BE — AC-B3)
| Where | Old | New |
|---|---|---|
| Python logger name (`getLogger("GammaFlowAsync")`, ~14 sites) | `"GammaFlowAsync"` | **`"Convexa"`** (drop the async suffix; D2 allows either — pick the clean brand word) |
| FastAPI app title (`main.py:439`) | `"GammaFlow Volatility API"` | `"Convexa Volatility API"` (brand word flips; descriptive remainder unchanged — D2) |
| Observability ContextVar label (`observability.py:49`) | `"gammaflow_request_trace"` | `"convexa_request_trace"` (internal label; NOT serialized in the trace payload) |
| Backend comments / docstrings / prompt-doc prose | product "GammaFlow" | "Convexa" (method/build-system prose → unbranded "the kit"/"the method", D1) |

### 2D. Docs / config strings (AC-B4)
| Where | Treatment |
|---|---|
| `README.md` (incl. line ~7 product-vs-engine split) | Product/codebase name → "Convexa"; **remove the old "Convexa product / GammaFlow engine" split**; generic method → unbranded |
| `CLAUDE.md`, `AGENTS.md`, `docs/SYSTEM_ANALYSIS.md`, `docs/blog/*`, `apps/api/README.md` | Product references → "Convexa"; build-system/method narrative → unbranded "the kit"/"the method" (D1) |
| `.claude/project.json` `project_name` | `"GammaFlow"` → `"Convexa"` (D2) |
| `_archive/**`, `DECISION_LEDGER.md` history | **UNTOUCHED** — provenance, not rewritten (D1/D5) |

### 2E. STAYS — do NOT rename (D5, ARCHITECTURE §1B)
- Local working folder `C:\Dev\gammaflow-web`; the `@org/*` scope / `@org/api` alias / tags / import paths.
- `DATA_DIR = "data"` + every persisted-data path; env var names; interface field names; `state_fingerprint`.
- The in-blob `schema_version` integers and the `.v1`/`.v2` key segments (brand-prefix rename only).

---

## 3. AC → state / test mapping (THIS IS THE REQUIRED-TESTS MATRIX)

Each AC maps to the component state(s) and the test case that satisfies it. The FE/BE implement this
set as a floor — they do NOT choose the requirement set. The full enumerated FE matrix is carried in
FRONTEND_EXECUTION_CONTRACT "Tests to write"; the BE byte-identity/conformance cases in
BACKEND_EXECUTION_CONTRACT. Brand string = lowercase `convexa.*` key; "old brand" = `gammaflow.*`.

| AC | Component state / surface | Required test case (named) |
|---|---|---|
| AC-A1 positions carried whole | Positions populated | `positions/migration` — seed `gammaflow.positions.v2`, no new key → same set/entry/P-L/Δ; new key now exists |
| AC-A2 customization + saved views carried | Positions customization restore | seed v2 w/ named views + column/sort/filter/density → restore exactly |
| AC-A3 closed/decision history carried | Positions history view | seed v2 w/ closed positions + decisions → fully present, unchanged |
| AC-A4 open ghost trade carried whole | Ghost-trade populated | seed `gammaflow.ghost-trade.v1` (read by ghost-trade store) → open trade + records present |
| AC-A5 custom personas carried | PersonaPicker list | seed `gammaflow.personas.v1` customs → every custom persona present |
| AC-A6 active-persona selection carried | Active persona | seed `gammaflow.personas.v1` `active_persona_id` → same persona active |
| AC-A7 UI prefs carried | Theme + default ticker | seed `gammaflow.uiprefs.v1` → same theme applied, same default ticker |
| AC-A8 legacy ghost-trade-v1 → Positions | Positions populated (chain) | seed ONLY `gammaflow.ghost-trade.v1`, no positions either brand → legacy trade whole in `convexa.positions.v2` (case 4) |
| AC-A9 idempotent | populated (re-read) | run resolution twice → identical; no dup/wipe/re-key; new key short-circuits 2nd read |
| AC-A10 old key never deleted | rollback-safe | after migration, `gammaflow.*` still present (assert `getItem(oldKey)` non-null) |
| AC-A11 corrupt old data degrades | corrupt-blob empty state | seed corrupt `gammaflow.*` → store empty state, NO throw, old blob intact |
| AC-A12 absent → clean new-user | empty / clean | no data either brand → clean default; data then created persists across reload |
| AC-A13 new-brand wins when both | populated (new) | seed BOTH `convexa.*` + `gammaflow.*` → new shown; old not merged/overriding |
| AC-B1 no stray live GammaFlow | landing / nav / title / tooltips | render landing + shell → "Convexa" present, no "GammaFlow" |
| AC-B2 Convexa download filenames | export action | trigger decision-history + latency-trend export → filename begins `convexa-`, no `gammaflow-` |
| AC-B3 backend Convexa-branded | BE surface | logger label + FastAPI title present "Convexa"; no live "GammaFlow" |
| AC-B4 docs carry no live GammaFlow | docs/README | README/CLAUDE/docs read "Convexa", split removed, method unbranded; `_archive`/ledger untouched |
| AC-B5 stale brand tests reconciled | test suite | `app-loads.spec.ts` + `positions-page.spec.tsx` assert single "Convexa", green |
| AC-C1 byte-identical engine | BE invariant | known score + `state_fingerprint` identical before/after |
| AC-C2 conformance passes | BE invariant | `interface_conformance.py` PASS post-rename (existing specs) |
| AC-C3 no rendered-surface change | every page | landing/ticker/positions/scanner/metrics render same content+behavior; only brand text differs |
| AC-C4 SSE/live untouched | live-degrade / page-scope | SSE opens page-scoped, closes on nav, reopens, no double-subscribe, degrades as before |
| AC-C5 existing suites green | regression | FE + `@org/api` suites pass; only intended brand-string updates changed |

**Resolution-order cases (AC-A1/A8/A13 composite, ARCHITECTURE §2.3) each get their own test:**
case 1 `convexa.positions.v2` → hydrate; case 2 `gammaflow.positions.v2` → hydrate + promote;
case 3 `convexa.ghost-trade.v1` → migrateV1 → write `convexa.positions.v2`; case 4
`gammaflow.ghost-trade.v1` → migrateV1 → write `convexa.positions.v2`. All four leave the source blob
intact.

---

## 4. Microcopy / tooltips / glossary

No microcopy changes beyond swapping the brand word "GammaFlow" → "Convexa" inside any tooltip /
help / glossary text that names the product (AC-B1). No NEW tooltip, label, or glossary entry is
authored. Degraded-state wording is UNCHANGED (no migration wording exists by design — §1). The
method/build-system prose flips to the unbranded "the kit"/"the method", not "Convexa" (D1).

---

## 5. Compressor #3 (Split Context) — emitted files

- `INTERFACE_CONTRACT.md` — NO interface/wire change; existing conformance specs stay PASSing; no new spec.
- `BACKEND_EXECUTION_CONTRACT.md` — cosmetic backend rename only (logger/title/ContextVar/prose); NO interface change.
- `FRONTEND_EXECUTION_CONTRACT.md` — the bulk: migrate-on-read helper, file rename, brand strings, stale-test reconciliation, the full "Tests to write" matrix.
