# rebrand-convexa — brief

Goal:            **Complete the GammaFlow → Convexa rebrand** — extend it from UI-only to the whole
                 codebase. Rename the ~71 `gammaflow` references across `apps/api` (comments/docstrings/log
                 prefixes/app title/data-dir naming), `apps/dashboard`, `libs/api` (incl. the
                 `gammaflow.ts` client file + its exported identifiers), `docs`, and `CLAUDE.md`/`AGENTS.md`
                 to **Convexa/convexa**, set `.claude/project.json` `project_name` to "Convexa", and rename
                 the **GitHub repo** `gammaflow → convexa`. The hard part: **migrate the 4 durable
                 localStorage keys** (`gammaflow.positions.v2`, `gammaflow.ghost-trade.v1`,
                 `gammaflow.personas.v1`, `gammaflow.uiprefs.v1`) to `convexa.*` **loss-free** — existing
                 saved positions / ghost-trade / personas / UI prefs must survive the rename, using the
                 versioned read-old-write-new pattern already proven by the positions v1→v2 migration.

Decision impact: **N/A** (brand/infra class — trading-decision cull N/A; judge on brand consistency +
                 migration safety, not trading edge). It removes the GammaFlow/Convexa split that confuses
                 a fresh reader and makes the public repo coherent for sharing.

Feasibility:    pass. Footprint measured (~71 refs). **No package renames** — the workspace scope is `@org/*`,
                 not `gammaflow`. Repo rename is one `gh repo rename convexa` (GitHub keeps a redirect from
                 the old URL) + a local remote-URL update. The localStorage migration reuses the established
                 loss-free versioned-migration pattern (`apps/dashboard/src/app/positions/store.ts` v1→v2).
                 The backend `gammaflow` refs appear cosmetic (comments/log prefixes/title) with **no
                 interface/scoring impact** — the Architect confirms whether this is `NO_BACKEND_CHANGE` at
                 the interface level.

Effort:          M

Invariant watch: **REVERSES a locked decision (deliberate owner GATE-Z reversal, 2026-06-28):** the
                 "**Convexa = UI wordmark only — do NOT rename code/packages/repo/durable keys**" decision
                 (CONTEXT §1/§5, OPEN_THREADS §7d, DECISION_LEDGER app-shell-landing GATE-S note). The owner
                 has decided on a **full rename including storage keys**; this brief executes that reversal,
                 formalized in canon at this feature's GATE S (precedent: the `live-spot=NBBO-mid` /
                 `no-real-order-path` narrowings). Not a promoted-canon key, so it is updated in place in
                 CONTEXT/THREADS, not moved to the Demoted table.
                 **`[loss-free durable migration]` (HARD):** every existing localStorage value under an old
                 `gammaflow.*` key is preserved under its new `convexa.*` key — no saved positions / personas
                 / ghost-trade / prefs lost; corrupt/absent old blobs degrade gracefully (mirror the existing
                 v1→v2 migration's behavior). This is the primary QA acceptance focus.
                 **`[additive-keeps-score-byte-identical]` (CONTEXT §5):** the rename is cosmetic to the
                 engine — `opportunity_score`/`tier`/`state_fingerprint`/the entry gate stay byte-identical;
                 backend changes are identifier/comment-level only, no scoring or interface change.
                 **`[best-effort-isolated-or-null]` (CONTEXT §5):** preserved — no degradation path changes.

Context tags:    architecture,frontend,backend,conventions,ui,features

Entry point:     architect-first — the pivotal calls are technical: the **rename map** (what renames vs stays
                 — `@org` scope stays; durable keys migrate), the **loss-free storage-migration seam** (one
                 reusable versioned migrate-on-read helper vs per-store ad-hoc; how it composes with the
                 existing positions v1→v2 chain so a user on v1/v2 still lands whole), whether the backend is
                 `NO_BACKEND_CHANGE` at the interface (cosmetic-only), and explicit **non-goals** (the local
                 working-folder `C:\Dev\gammaflow-web` is NOT renamed — disruptive, local-only, cosmetic;
                 historical/provenance mentions of "GammaFlow" in archived contracts/ledger stay as record).

Source:          Owner 2026-06-28 — after confirming the earlier rebrand was deliberately recorded as
                 **UI-only**, the owner escalated to a **full rename including storage keys**. Reverses the
                 app-shell-landing "UI-only" brand decision.
