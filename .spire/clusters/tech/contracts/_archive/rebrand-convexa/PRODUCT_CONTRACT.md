# rebrand-convexa — PRODUCT CONTRACT

> Role: PM (runs 2nd, after the Architect). In: PROJECT_CONTEXT, OPEN_THREADS, BRIEF,
> ARCHITECTURE_CONTRACT. Out: this file only (compressed in place for the UX/Tech-Writer next).
> Scope = stories, in/out/future, behavior, ACs. NO code/endpoints/payload-field/data-structure/
> math/layout (Architect/UX own those). Every AC is observable WITHOUT reading code and is the
> required behavioral test QA traces.

**Rename + a loss-free localStorage migration ONLY.** Nothing the product does, computes, scores,
returns, or shows changes — only the brand name and the storage-key prefix. The ONLY new behavior is
the migration that carries a returning user's saved data forward from the old prefix to the new one
without loss.

Architect envelope (binding, restated):
- **`NO_BACKEND_CHANGE` at the interface** — bundle, `opportunity_score`, `opportunity_tier`,
  `state_fingerprint`, the entry gate, and SSE are byte-identical; `interface_conformance.py` still
  PASSES. Backend rename is cosmetic (log prefix, app title, internal label, prose) only.
- **§2 migration shape** — one reusable migrate-on-read helper; read-new-else-old; promote forward on
  first read; never delete old; never throw; idempotent; composes with the positions v1→v2 chain.
- If the technical shape can't support a product outcome below, the executioner BOUNCES it as an
  ARCHITECTURE amendment — never silently narrows.

---

## 1. Product decisions made here (resolving the Architect's §6)

Owner said proceed → these are DECIDED.

- **D1 — Docs/blog product-name vs method-name.** The live product/project/codebase/studio name is
  **Convexa** everywhere it appears as a name (blog, README, app title, prose). Where text means the
  *generic reusable delivery method* (the extracted framework), it is the **unbranded "delivery-kit" /
  "the kit" / "the method"** — NOT "Convexa". Net: after this feature, NO "GammaFlow" survives as a
  *live* product/project/codebase/method name; the old "Convexa-product-vs-GammaFlow-engine" split
  (README:7) is removed. Provenance mentions inside `_archive/**` + the DECISION_LEDGER stay (non-goal
  to rewrite history).
- **D2 — Exact strings.** Display/brand name **"Convexa"** (title-case); lowercase **`convexa`** for
  identifiers/storage-prefix/repo/download-stems/filename-stems. Backend logger **"Convexa"** (or
  "ConvexaAsync" if preserving the async suffix). Backend app/API title: brand word → "Convexa" (the
  descriptive remainder unchanged). Download filenames → `convexa-` stem. `project.json` `project_name`
  → **"Convexa"**.
- **D3 — Repo-rename timing.** Run at **GATE S (ship)**, AFTER code lands + QA passes (never before a
  green build): `gh repo rename convexa` (GitHub keeps an old-URL redirect) + local remote-URL update,
  performed by **the conductor** (not an executioner). No external link is known to depend on the old
  URL; the redirect covers strays.
- **D4 — Stale brand-assertion tests** (`app-loads.spec.ts`, `positions-page.spec.tsx`, any other
  brand-string assertion) are **IN SCOPE**: the FE updates them to assert the single "Convexa" brand
  and leaves them green. A pre-existing brand red is the FE's to reconcile here — NOT a QA bounce on an
  unrelated issue. QA traces them as AC-B5.
- **D5 — Local-folder & external-reference non-goal STANDS.** `C:\Dev\gammaflow-web` is NOT renamed;
  `@org/*` scope / `@org/api` alias / tags / import paths unchanged; `_archive/**` + ledger history
  unchanged. No external link is known to depend on the local-folder path.

---

## 2. The decision this feature REVERSES (for the GATE-S canon update)

Deliberately reverses the locked **"Convexa = UI wordmark only — do NOT rename code/packages/repo/
durable keys"** (owner GATE-Z, 2026-06-28). Recorded in CONTEXT §1/§6-app-shell-landing, THREADS §7d,
and the DECISION_LEDGER app-shell-landing GATE-S note.

**Canon-update direction (a GATE-S/Orchestrator deliverable — scoped here, not performed here):**
because it was prose + a GATE-S ledger note (NOT a promoted-invariants-table key), it is **updated IN
PLACE** — CONTEXT §1/§5 + THREADS §7d flip "UI-only" → "full rename, completed in rebrand-convexa",
and a NEW GATE-S note is appended to the ledger. It is **NOT moved to the Demoted table.** Precedent:
the `live-spot=NBBO-mid` and `no-real-order-path` owner narrowings (updated in place).

---

## 3. User stories

- **Returning trader (general):** opening the renamed app, I see all my saved positions, open ghost
  trade, decision history, custom personas, active-persona choice, theme, and default ticker exactly
  as I left them — I notice nothing was lost. (The migration is invisible; "it just still works.")
- **Returning legacy ghost-trade-only user:** my old single-position ghost trade is carried whole into
  the current Positions view — the rename doesn't strand the legacy-version user.
- **Brand-new user:** I use the app cleanly under the new brand — no migration noise, no error, no
  leftover empty state.
- **Any reader:** across landing, nav, titles, tooltips, exports, the API/log surface, and docs I only
  see "Convexa" — no stray live "GammaFlow" to confuse me.
- **Trader using the engine:** the numbers, scores, tiers, walls, flip, and every rendered surface are
  exactly as before — the rename changed the name on the door, not the math.
- **Owner sharing the public repo:** codebase/repo/identifiers/docs are coherently "Convexa" with no
  GammaFlow/Convexa split for a fresh reader.

---

## 4. Scope

**In:** loss-free migration of the 4 durable keys (positions, ghost-trade, personas, UI prefs)
old-prefix → `convexa.*`, including the legacy ghost-trade-v1 → positions-v2 chain across both brands;
flipping every user-visible brand string to "Convexa" (landing, nav wordmark, page/document titles,
brand mentions in tooltips/help, the 2 download filenames, backend app/API title, backend log prefix);
the code/identifier/file renames the Architect mapped (client file, logger, internal trace label,
project-config name) — all cosmetic, no interface/scoring change; docs/blog/README/CLAUDE/prose per
D1; reconciling stale brand-assertion tests green (D4); the GATE-S repo rename (D3, conductor); the
GATE-S canon update (§2, Orchestrator).

**Out (non-goals):** renaming `C:\Dev\gammaflow-web` (D5); renaming the `@org/*` scope / alias / tags /
import paths (D5); rewriting `_archive/**` or ledger history (D1/D5); any data-version bump / schema
change / blob transform (brand-PREFIX rename only; in-blob shapes + `schema_version` integers
untouched); deleting old `gammaflow.*` keys (kept as fallback); ANY behavioral/feature/scoring/
interface/endpoint/layout change (bundle/score/tier/gate/`state_fingerprint`/SSE/rendered surfaces
byte-identical).

**Future-dated:** renaming/migrating off the local working folder if the owner later chooses;
account-scoped server-side storage for the `convexa.*` stores (an existing user-accounts deferred seam,
orthogonal here).

---

## 5. Product behavior (the migration, observable terms)

The migration is the only behavior:
- On opening the renamed app, old-brand data is read and PROMOTED forward under the new prefix once;
  thereafter the app reads the new prefix.
- The old-brand data is **never deleted** (safety fallback → rollback-safe, re-runnable).
- The promotion is **idempotent** — reloading never duplicates, re-keys, or wipes; data is identical
  after the 1st, 2nd, Nth open.
- New post-rename data is written under the new prefix.
- Missing old data → the user starts clean under the new prefix (no error, no phantom record).
- Corrupt/unreadable old data → the app degrades to the same empty in-memory state it shows on a
  corrupt blob today; NO error thrown into the UI; the unreadable blob is NOT destroyed.
- After promotion, every stored surface (positions list / P/L / saved views / customization / decision
  history / open ghost trade / custom personas + active persona / theme + default ticker) returns
  exactly what it returned for the same underlying data before — nothing added, dropped, renamed, or
  re-typed.

---

## 6. Acceptance criteria

> Each AC = ONE observable behavior + a required behavioral test. Degraded/edge variants are their OWN
> ACs. All observable WITHOUT reading code. "Old brand" = pre-rename `gammaflow.*` data; "new brand" =
> the post-rename `convexa.*` data the user now sees.

### Group A — Loss-free durable migration (HARD `[loss-free durable migration]`, primary QA focus)
- **AC-A1 (positions carried whole).** Returning user with old-brand positions and no new-brand data:
  on load, the SAME positions appear — same set, same per-position entry details, same P/L, same
  Δ-since-entry. Nothing missing or altered.
- **AC-A2 (positions customization + saved views carried).** Old-brand positions data with saved named
  views + column/sort/filter/density customization: on load, those views and that customization are
  present and restore exactly as before.
- **AC-A3 (positions closed/decision history carried).** Old-brand positions data with closed
  positions / decision history: on load, that history is fully present and unchanged.
- **AC-A4 (open ghost trade carried whole).** Old-brand open ghost trade + decision records: on load,
  the open trade and its records are present and unchanged.
- **AC-A5 (custom personas carried).** Old-brand custom personas: on load, every custom persona is
  present and unchanged.
- **AC-A6 (active-persona selection carried).** Old-brand active-persona selection: on load, that same
  persona is still active (the selection survives, not just the list).
- **AC-A7 (UI prefs carried).** Old-brand saved theme + default ticker: on load, the same theme is
  applied and the same default ticker is in effect.

### Group A-Edge — legacy chain, idempotency, degradation (each its own test case)
- **AC-A8 (legacy ghost-trade-v1 lands whole in current Positions).** User with ONLY old-brand legacy
  single-position ghost-trade data (no positions data under either brand): on load, that legacy trade
  appears whole in the current multi-position Positions view — legacy-version + brand hop in one read,
  nothing stranded.
- **AC-A9 (idempotent — repeated opens never duplicate/wipe).** Already-migrated user: reloading
  repeatedly shows data identical to after the first load — no duplicated positions/trades/personas, no
  wiped data, no re-migration artifacts.
- **AC-A10 (old key never deleted — rollback-safe).** Migrated user: the old-brand stored data still
  exists afterward (not removed) — observable as: rolling back to the old build still finds the
  original data intact.
- **AC-A11 (corrupt old data degrades gracefully — no throw, no wipe).** Old-brand data is
  corrupt/unreadable: on load, the app shows the normal empty state for that store (no positions / no
  open trade / default prefs), throws NO error into the UI, and does NOT destroy the unreadable old
  data — matching today's corrupt-blob behavior.
- **AC-A12 (absent old data → clean new-user state).** Brand-new user, no stored data under either
  brand: on load, a clean empty/default state under the new brand, no error, no phantom record; data
  the user then creates is retained across reload.
- **AC-A13 (new-brand data wins when both exist).** User with BOTH new-brand and leftover old-brand
  data: on load, the new-brand data is shown (new prefix wins); the leftover old data does not override
  or merge into it.

### Group B — Brand strings (D1/D2/D4)
- **AC-B1 (no stray live "GammaFlow" in the running product).** Across landing, nav wordmark,
  page/document title, and brand mentions in tooltips/help, the brand shown is "Convexa"; no live
  "GammaFlow" product name appears.
- **AC-B2 (download filenames Convexa-branded).** Exporting the decision history and exporting the
  latency trend each downloads a file whose name begins with the `convexa-` stem (no `gammaflow-`).
- **AC-B3 (backend surface Convexa-branded).** The backend app/API title presents "Convexa" and the
  backend log prefix presents the Convexa label (D2) — no live "GammaFlow" on backend human-readable
  surfaces.
- **AC-B4 (docs/README carry no live GammaFlow name, no split).** README, CLAUDE guide, docs/blog, and
  prose present "Convexa" as the product/codebase name with the old product-vs-engine split removed;
  the generic reusable method is unbranded (D1). Archived/ledger provenance is intentionally untouched.
- **AC-B5 (stale brand-assertion tests reconciled + green).** The previously-stale brand-assertion
  tests now assert the single "Convexa" brand and pass; the suite is green with no pre-existing brand
  red.

### Group C — No behavioral / interface / scoring change (envelope invariants)
- **AC-C1 (byte-identical engine output).** For the same input, `opportunity_score`,
  `opportunity_tier`, the entry gate, and `state_fingerprint` are byte-identical before/after (QA
  re-proves a known score + fingerprint).
- **AC-C2 (conformance still passes).** `interface_conformance.py` PASSES post-rename — response
  shape, envelope keys, and `meta.*` keys unchanged (no renamed identifier escaped into the interface).
- **AC-C3 (no rendered-surface change).** Every page that renders today (landing, ticker viewer,
  positions, scanner stub, operator metrics) renders the same content + behavior after — the only
  visible difference anywhere is brand text. No layout/tile/chart/section changed.
- **AC-C4 (SSE / live path untouched).** Live stream still opens page-scoped to the ticker page,
  closes on nav-away, reopens on return, never double-subscribes, and degrades on an SSE drop exactly
  as before.
- **AC-C5 (existing suites green, no regression).** The existing frontend + shared-client suites pass
  after the rename with no regression beyond the intended brand-string updates (AC-B5).

---

## 7. Constraints the next role (UX, then executioners) must not violate

- The migration is silent — NO migration UI (no banner/toast/"we moved your data" prompt). A
  user-facing migration notice = scope expansion to BOUNCE, not add.
- The old `gammaflow.*` keys are NEVER deleted (rollback-safe fallback). Any copy implying
  cleanup/clear is out of scope.
- Brand copy = "Convexa" (title-case display, lowercase `convexa` for identifiers/stems). The generic
  reusable method stays unbranded — do not rename it "Convexa".
- No data-version bump / schema change / blob transform — brand-PREFIX rename only.
- No interface/endpoint/payload/field-name/scoring change; `NO_BACKEND_CHANGE` at the interface holds.
- Provenance (`_archive/**`, ledger history) is not rewritten; the local folder + `@org/*` scope are
  not renamed.
- If any backend `gammaflow` reference turns out to escape the process (env var, serialized field,
  persisted-data path), it is NOT covered by `NO_BACKEND_CHANGE` — BOUNCE as an ARCHITECTURE amendment,
  do not ship silently. (The Architect's audit found none.)
