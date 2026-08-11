# rebrand-convexa — ARCHITECTURE CONTRACT

> Role: Architect (entry, Architect-first). Inputs: PROJECT_CONTEXT.md, OPEN_THREADS.md,
> BRIEF.md. Output: this file only. Scope = technical shape (rename map, migration seam,
> component boundaries, isolation/error rules, non-goals, restated invariants). No UI/endpoint/
> payload/copy — those are open questions for the PM. No code is written here; the few snippets
> are the load-bearing CONTENT/behavior the executioner must hold, not final source.

This is a **rename + a loss-free localStorage migration ONLY**. No behavioral, feature, scoring,
interface, or layout change. Everything that renders, computes, or returns today must render,
compute, and return byte-identically after.

---

## 0. Footprint (measured)

`grep -i gammaflow` across the workspace (excluding `_archive/`): **134 occurrences in 51 files**.
They fall into a small number of *classes*, and the class — not the count — decides the treatment.
Material findings that shape the decisions:

- **Backend `gammaflow` is 100% cosmetic.** Every backend ref is one of: the Python logger name
  `logging.getLogger("GammaFlowAsync")` (~14 sites), the FastAPI `title="GammaFlow Volatility API"`
  (`main.py:439`), the observability ContextVar name `ContextVar("gammaflow_request_trace")`
  (`observability.py:49`), or comments/docstrings/prompt-doc prose (`prompts/*.md`,
  `market_state_glossary.md`, README). **None is an interface field, env var, scoring input, or a
  persisted-data path.** `DATA_DIR = "data"` (`main.py:55`) — the per-ticker JSON persist dir is
  literally `"data"`, NOT `gammaflow`; renaming touches it not at all and **orphans nothing**.
- **The `@org/api` client is consumed only through the package barrel.** Every dashboard consumer
  imports from `@org/api` (resolved via `libs/api/src/index.ts` → `export * from './lib/gammaflow'`).
  **No code imports `gammaflow.ts` by path** except `index.ts` and the colocated spec. There are
  **zero exported identifiers/consts named `gammaflow`** — the exports are `getTicker`, `TickerBundle`,
  `IvSkew`, etc. So renaming the FILE is a one-line barrel edit + the spec import; no consumer churns.
- **The 4 durable keys are exactly the 4 named** and live as module-level constants in 4 files
  (no inline string usage in production code; only specs hard-code them). No 5th durable key exists
  (`useGate.ts`/`ConvexaMark.tsx` mention localStorage only in comments; auth sessions are a
  server-side cookie, not localStorage). `gammaflow.personas.v1` carries BOTH custom personas AND
  `active_persona_id` (the Settings "active persona" pref reads it — see §3).
- **A migration CHAIN already exists** in `positions/store.ts`: if `gammaflow.positions.v2` is
  absent it reads `gammaflow.ghost-trade.v1`, re-keys v1 trades into the v2 flat map, writes v2,
  and **leaves the v1 blob intact**. The key rename must preserve this chain end-to-end (§2).
- **Two user-facing download filenames** embed the brand: `gammaflow-decision-history-*.json`
  (`ghost-trade/store.ts:70`) and `gammaflow-latency-trend-*.json` (`useLatencyTrend.ts:219`).
  These are cosmetic strings (not durable keys, not parsed on import) — rename for consistency.
- **Stale tests assert the OLD brand as visible UI:** `dashboard-e2e/app-loads.spec.ts:8`
  (`getByText('GammaFlow')`) and `positions-page.spec.tsx:319-321` assert *Convexa, not GammaFlow*.
  These reflect the already-shipped UI-only rebrand; flagged in §5 so the executioner reconciles
  them rather than the QA bouncing on a pre-existing red.

---

## 1. THE RENAME MAP (what renames vs what STAYS)

### 1A. RENAMES (in scope)

| Class | What | Treatment |
|---|---|---|
| Durable localStorage keys | `gammaflow.{positions.v2,ghost-trade.v1,personas.v1,uiprefs.v1}` | → `convexa.*` **via the migration seam in §2** (NOT a blind find-replace — the old blob must be read). The KEY CONSTANTS in the 4 store files change to `convexa.*`; the old `gammaflow.*` literal is retained only as the migration source. |
| TS client file | `libs/api/src/lib/gammaflow.ts` (+ `gammaflow.spec.ts`) | Rename file → `convexa.ts` (+ `convexa.spec.ts`). Update the ONE barrel line in `libs/api/src/index.ts` and the spec's relative import. No consumer changes (all use `@org/api`). |
| Backend logger name | `getLogger("GammaFlowAsync")` (~14 sites) | → `getLogger("Convexa")` (or "ConvexaAsync" — exact string is a PM/owner copy call, §6). Cosmetic log-prefix only. |
| Backend app title | `title="GammaFlow Volatility API"` (`main.py:439`) | → "Convexa …" — exact title string is a PM/owner copy call (§6). |
| Backend ContextVar name | `ContextVar("gammaflow_request_trace")` (`observability.py:49`) | → `"convexa_request_trace"`. Internal label only (not serialized in the trace payload). |
| Comments / docstrings / prose | backend `*.py` comments, `prompts/*.md`, `market_state_glossary.md`, README, `apps/api/README.md`, dashboard inline comments | Product references → Convexa. The prompt/glossary prose uses "GammaFlow" as the system that produces the bundle — see the §6 copy question (product-name vs method-name). |
| Project config | `.claude/project.json` `project_name` | `"GammaFlow"` → `"Convexa"`. |
| Repo docs | `CLAUDE.md`, `README.md`, `docs/SYSTEM_ANALYSIS.md`, `docs/blog/*` | Product references → Convexa; the blog narrative's use of "GammaFlow" as the BUILD-SYSTEM/method name is a §6 copy call. |
| Download filenames | `gammaflow-decision-history-*.json`, `gammaflow-latency-trend-*.json` | → `convexa-*`. Cosmetic; not parsed on re-import. |
| GitHub repo | remote `gammaflow` | `gh repo rename convexa` + local remote-URL update. Timing/coordination is a §6 open question. |
| Stale brand tests | `app-loads.spec.ts`, `positions-page.spec.tsx` brand assertions | Reconcile to assert the live brand (§5). |

### 1B. STAYS (explicit non-renames — do NOT touch)

- **The `@org/*` package scope.** It is not "gammaflow"; the npm scope, `tsconfig` path alias
  `@org/api`, project tags, and every `from '@org/api'` import are unchanged. (This is why the
  client-file rename is a one-line barrel edit, not a 50-file churn.)
- **The local working folder `C:\Dev\gammaflow-web`.** Disruptive, local-only, cosmetic — a
  **non-goal**. Paths in docs that reference it stay as-is (or are a §6 copy call, not a rename).
- **Archived contracts (`.claude/contracts/_archive/**`) and `DECISION_LEDGER.md`.** Historical
  "GammaFlow" is **provenance** — do not rewrite history. The grep scope for this feature
  EXCLUDES `_archive/`. The DECISION_LEDGER's existing GATE-S notes stay; this feature ADDS a new
  GATE-S note (§4), it does not edit the old ones.
- **`DATA_DIR = "data"` and all persisted-data paths.** Not "gammaflow"; leaving them alone is what
  keeps persisted backend dumps from orphaning. No change.
- **Env var names, interface field names, scoring identifiers, `state_fingerprint`.** None contains
  "gammaflow"; all stay byte-identical (§3, the invariant).

---

## 2. THE LOSS-FREE STORAGE-MIGRATION SEAM (load-bearing)

This is the HARD part and the primary QA focus (`[loss-free durable migration]`). The guarantee:
**a user who opens the renamed app with existing `gammaflow.*` localStorage loses nothing** — every
saved position, ghost-trade, decision record, custom persona, active-persona selection, theme, and
default-ticker survives under the new `convexa.*` key, with identical subsequent behavior.

### 2.1 SHAPE decision: a single reusable "migrate-on-read" helper, NOT per-store ad-hoc

Each of the 4 stores already has the same guarded read/write skeleton (`read()` hydrates from
localStorage into an in-memory cache, `write()` mirrors back, both wrapped so a storage/parse failure
degrades to in-memory and NEVER throws). The brand-key migration is the **same shape across all four**,
so it MUST be a single small reusable helper the 4 stores call, not 4 hand-rolled copies. This:
- single-sources the read-old-write-new + idempotency + degradation behavior (one place to verify);
- guarantees the 4 stores behave identically under the corrupt/absent/double-run cases;
- composes cleanly with the positions chain (§2.3) because that store layers its OWN v1→v2 logic
  ON TOP of the brand-key resolution, rather than entangling the two.

**Behavior the helper guarantees (CONTENT, not final code):** given a `newKey` and an `oldKey`,
on read it resolves the raw blob by precedence **newKey first, else oldKey**; on the first read that
finds only the old blob, it writes that blob forward under `newKey`; it NEVER deletes the old blob
(leave it intact as a fallback source — mirrors the existing v1 chain); a read/parse/write failure
at any step degrades to the empty/in-memory shape and never throws. Reference contract:

```
resolveDurable(newKey, oldKey):
  raw = localStorage.getItem(newKey)            # new wins
  if raw != null: return raw
  raw = localStorage.getItem(oldKey)            # else fall back to legacy brand key
  if raw != null:
      try localStorage.setItem(newKey, raw)     # promote forward, idempotent
      # DO NOT remove(oldKey) — leave intact, like the v1->v2 chain
      return raw
  return null                                   # nothing stored yet
# every getItem/setItem/JSON.parse stays inside the store's existing try/catch:
# any failure -> empty() in-memory, never throw, never wipe.
```

### 2.2 Per-store mapping (stores in scope)

| Store file | new key | old key (migration source) | Notes |
|---|---|---|---|
| `ghost-trade/store.ts` | `convexa.ghost-trade.v1` | `gammaflow.ghost-trade.v1` | Same shape `{schema_version,trades,decisions}`. |
| `positions/store.ts` | `convexa.positions.v2` | `gammaflow.positions.v2` | PLUS the v1→v2 chain — see §2.3. |
| `personas/store.ts` | `convexa.personas.v1` | `gammaflow.personas.v1` | Carries custom personas AND `active_persona_id`. |
| `auth/localPrefs.ts` | `convexa.uiprefs.v1` | `gammaflow.uiprefs.v1` | theme + default_ticker. |

The schema-version segment (`.v2`/`.v1`) does NOT change — this is a BRAND-PREFIX rename, not a data
version bump. The in-blob `schema_version` field is untouched.

### 2.3 Composition with the existing positions v1→v2 chain (do not break it)

`positions/store.ts` today: `read()` tries `gammaflow.positions.v2`; if absent it tries
`gammaflow.ghost-trade.v1`, runs `migrateV1`, writes v2, leaves v1 intact. After the rename the read
must still land a user **whole** whether their data sits under the OLD or NEW brand on EITHER version.
The resolution order the executioner must implement (4 cases, first hit wins):

1. `convexa.positions.v2` present → hydrate v2. (new brand, current version)
2. else `gammaflow.positions.v2` present → hydrate v2 + promote forward to `convexa.positions.v2`.
   (old brand, current version — pure brand migration)
3. else `convexa.ghost-trade.v1` present → `migrateV1` → write `convexa.positions.v2`.
   (new brand, legacy version — e.g. a ghost-trade user who never opened Positions, post-rename)
4. else `gammaflow.ghost-trade.v1` present → `migrateV1` → write `convexa.positions.v2`.
   (old brand, legacy version — the pre-rename ghost-trade-only user; the original chain + brand hop)

In all four the source blob is left intact (never deleted). A user on `gammaflow.ghost-trade.v1`
OR `gammaflow.positions.v2` therefore lands whole under `convexa.positions.v2`. Implementation note
for the executioner: this is "resolve the positions-v2 blob across both brands, ELSE resolve the
ghost-trade-v1 blob across both brands, then apply the unchanged `migrateV1`." The `migrateV1`
transform itself is byte-unchanged.

### 2.4 Idempotency, corruption, and degradation invariants (the executioner MUST hold)

- **Idempotent.** Running the resolution twice is a no-op after the first promote (the new key now
  exists, so precedence short-circuits at the new key). No double-migration, no re-keying twice.
- **Never wipe.** The old `gammaflow.*` blob is NEVER deleted. (Rationale: it is the only fallback if
  the new write fails mid-flight, and it makes the migration safely re-runnable / reversible.)
- **Corrupt/absent old blob degrades gracefully — never throws.** A `JSON.parse` failure on either
  brand's blob yields the store's empty in-memory shape (exactly today's `catch { memory = empty() }`),
  not an exception into the UI, and does not destroy the unparseable blob. Absent → empty shape,
  no migration, no error. This mirrors the existing v1→v2 migration's behavior verbatim
  (`[best-effort-isolated-or-null]` applied to the durable store).
- **Identical post-migration behavior.** After promotion, every store API (`allPositions`,
  `getTrade`, `loadCustoms`/`loadActiveId`, `loadLocalTheme`/`loadLocalDefaultTicker`, decision
  history, saved views, customization) returns exactly what it returned pre-rename for the same
  underlying data. No field added, dropped, renamed, or re-typed.
- **In-memory cache seam unchanged.** The existing `__resetMemory`/`__resetLocalPrefs` test seams and
  the `memory` cache stay; the helper sits underneath `read()`, not around the cache.

### 2.5 Data-structure / version invariants

- Blob SHAPES are unchanged: positions `{schema_version,positions,decisions,customization}`,
  ghost-trade `{schema_version,trades,decisions}`, personas `{schema_version,customs,active_persona_id}`,
  uiprefs `{schema_version,theme,default_ticker}`. The migration moves bytes between keys; it does NOT
  transform the blob (except the pre-existing, unchanged `migrateV1`).
- `schema_version` segments in the key names (`.v1`/`.v2`) and the in-blob `schema_version` integers
  are unchanged. This is a brand-prefix migration, orthogonal to data versioning.

---

## 3. BACKEND SCOPE — NO_BACKEND_CHANGE at the interface level

**Confirmed: the backend rename is cosmetic-only — `NO_BACKEND_CHANGE` at the interface.** Every
backend `gammaflow` ref is a logger name, the FastAPI title, an internal ContextVar label, or
comment/docstring/prompt prose (§0). None is:
- an interface field, envelope key, or `meta.*` key the FE consumes;
- an env var name (env vars carry no "gammaflow" — see CONTEXT §7);
- a scoring input, signal, gate, tier, or any contributor to `opportunity_score`/`opportunity_tier`/
  `state_fingerprint`;
- a persisted-data path (`DATA_DIR = "data"`, unaffected — nothing orphans).

Therefore the bundle/score/`state_fingerprint` stay **byte-identical** before/after
(`[additive-keeps-score-byte-identical]`). The ContextVar and logger renames are process-internal
labels; the trace payload and `/api/_metrics` field names contain no "gammaflow" and are unchanged.

**No non-cosmetic backend change found.** If, during execution, any backend `gammaflow` ref turns out
to touch a runtime value that escapes the process (an env var, a serialized field, a path that
persisted data lives under), the executioner MUST flag it as a contract amendment and treat it with
its own care — it is NOT covered by this NO_BACKEND_CHANGE finding. (The audit found none.)

The conformance check (`interface_conformance.py`) must still PASS post-rename, proving the live
response shape is unchanged.

---

## 4. THE DECISION REVERSAL (restated explicitly)

This feature **deliberately REVERSES** the locked decision that **"Convexa = UI wordmark only — do
NOT rename code / packages / repo / durable keys."** That decision is recorded in:
- PROJECT_CONTEXT §1 ("User-facing brand is Convexa (UI wordmark only — code/packages/repo still
  gammaflow)") and the §6 app-shell-landing feature note ("Brand is UI-only (no code/package/store-key
  rename)");
- OPEN_THREADS §7d ("the rebrand to 'Convexa' (UI wordmark only)" / "brand-UI-only (durable keys
  `gammaflow.positions.v2` / `gammaflow.ghost-trade.v1` unchanged)");
- DECISION_LEDGER, the app-shell-landing GATE-S note (line ~133: "rebrand (Convexa, **UI-only** — no
  code/package/store-key rename)").

The reversal is a **deliberate owner GATE-Z decision (2026-06-28)**: extend the rebrand to the whole
codebase + durable keys. Precedent for an owner narrowing/reversal of a recorded decision: the
`live-spot=NBBO-mid` last-trade narrowing and the `no-real-order-path` narrowing.

**It is NOT a promoted-canon key** (it lived in CONTEXT/THREADS prose + a GATE-S ledger note, not in
the Promoted-invariants table). Per the ledger convention it is therefore **updated in place** in
PROJECT_CONTEXT §1/§5 + OPEN_THREADS §7d (changing "UI-only" → "full rename, completed in
rebrand-convexa") and a NEW GATE-S note is appended to the DECISION_LEDGER — it is **NOT** moved to
the Demoted table. (Mechanics of the canon update are a GATE-S/Orchestrator action, noted here so the
PM scopes it as a deliverable, not so the Architect performs it.)

---

## 5. ISOLATION / ERROR RULES + EDGE CASES the build must hold

- **Migration is the only behavioral surface; it is best-effort + non-throwing + non-destructive**
  (§2.4). It can fail (private-mode quota, corrupt blob) only to the existing empty-in-memory
  degradation, never to a thrown error or a wiped blob.
- **No double-subscribe / no scoring touch / no SSE touch.** Renames do not alter the SSE path, the
  poll loop, the page-scoped live subscription, or any module import boundary (the one-way leaves —
  `ai_recommendation`, `auth`, `personas`, `observability` — keep their import graph; renaming a
  logger string does not move an import).
- **Stale brand tests (pre-existing red risk).** `dashboard-e2e/app-loads.spec.ts:8` and
  `positions-page.spec.tsx:319-321` already encode brand expectations from the UI-only era (one
  asserts `GammaFlow` visible, one asserts Convexa-not-GammaFlow). The executioner must reconcile
  these to the live brand as part of the rename so GATE Q does not bounce on a pre-existing
  inconsistency. (Which assertions / exact strings = a UX/copy detail, flagged §6.)
- **`@org/api` boundary intact.** The client-file rename must not change the package's public surface
  (same exports, same `@org/api` resolution); only the internal file name + the barrel line move.

---

## 6. OPEN QUESTIONS FOR THE PM (no UI/endpoint/payload/copy decided here)

1. **Docs/blog copy — product-name vs method-name.** The blog (`docs/blog/*`) and the prompt/glossary
   prose use "GammaFlow" partly as the BUILD-SYSTEM / codebase / method name, not only the product.
   Does the build-system/method narrative become "Convexa", or does "GammaFlow" stay as the method's
   historical name while only PRODUCT references flip? This is a copy/brand call — PM/owner decides;
   the Architect does not write copy. (README.md:7 already encodes the *old* split — "Convexa is the
   product/UI brand; GammaFlow is the engine and codebase name" — which this feature is reversing; the
   PM decides the new framing.)
2. **Exact new identifier/label strings.** The logger name (`"Convexa"` vs `"ConvexaAsync"` vs other),
   the FastAPI title string, the new download filename stems (`convexa-decision-history-*`,
   `convexa-latency-trend-*`), and the project-name casing — these are copy/naming calls. The
   Architect fixes the SHAPE (where they live, that they rename); the exact strings are the PM's.
3. **Repo-rename timing & coordination.** When to run `gh repo rename gammaflow → convexa` relative to
   the code merge (before/after), the local remote-URL update, and whether any external references
   (CI, links, the local-folder path in docs) need a follow-up. Sequencing is a PM/ops call.
4. **Stale-test reconciliation strings.** What the brand assertions in `app-loads.spec.ts` /
   `positions-page.spec.tsx` should assert post-rename depends on the §6.1 copy decision; PM to
   confirm the expected user-visible brand string for the tests.
5. **Local-folder & external-reference scope confirmation.** Confirm the non-goal stands: the local
   working folder `C:\Dev\gammaflow-web` and the `gammaflow-web` references in docs are NOT renamed
   (only the GitHub repo + product/code identifiers are). PM to confirm no external link depends on it.

---

## 7. EXPLICIT NON-GOALS

- Renaming the local working folder `C:\Dev\gammaflow-web` (disruptive, local-only, cosmetic).
- Renaming the `@org/*` package scope, the `@org/api` alias, project tags, or any import path.
- Rewriting archived contracts (`_archive/**`) or DECISION_LEDGER history (provenance stays).
- Any data version bump, schema change, or blob transform (this is a brand-prefix migration, the
  in-blob shapes + `schema_version` integers are untouched).
- Any behavioral / feature / scoring / interface / endpoint / layout change. Bundle, score, tier,
  gate, `state_fingerprint`, SSE payload, and every rendered surface stay byte-identical.
- Deleting old `gammaflow.*` localStorage keys (kept intact as the migration fallback source).

---

## 8. RESTATED BINDING CONSTRAINTS (must not violate)

- **`[loss-free durable migration]` (HARD — primary QA focus).** Every existing `gammaflow.*`
  localStorage value is preserved under its `convexa.*` key; corrupt/absent old blobs degrade
  gracefully (empty in-memory, never throw, never wipe), mirroring the v1→v2 migration. §2.
- **`[additive-keeps-score-byte-identical]` (CONTEXT §5).** The rename is cosmetic to the engine —
  the entry gate, `opportunity_score`, `opportunity_tier`, and `state_fingerprint` stay byte-
  identical; nothing renamed is a scoring input. Backend change is identifier/comment-level only. §3.
- **`[best-effort-isolated-or-null]` (CONTEXT §5).** No degradation path changes; the migration's
  failure mode IS this invariant applied to the durable store (null/empty, never an error). §2.4.
- **Module import boundaries / one-way leaves** (`ai_recommendation`, `auth`, `personas`,
  `observability`) — renaming logger strings / ContextVar labels does not move any import; the
  leaf-isolation graph is unchanged.
- **`@org` package scope, env var names, interface fields, persisted-data paths, `DATA_DIR`** — all
  unchanged (§1B, §3).
