# project-context-s2-is-python-era — brief
Goal:            Rewrite `PROJECT_CONTEXT.md` **§2 Architecture backend half** against the
                 live Axum/Tokio crate `api-rust` (`apps/api/src`, `libs/quant-engine`).
                 Today that section still names FastAPI `main.py` and `src/core/*.py` —
                 **23 Python-era markers** — while Python is archived at `archive/api-python/`.
                 §2 carries eleven of the most-used shard tags, so `context_for` serves a
                 deleted backend as ground truth to every tagged backend feature. This
                 is a **canon repair**, not a product screen or engine change.

Decision impact: Whether the next council/plan cites live Rust or a deleted tree.
                 Observed by: §2 no longer names `main.py` / `signals.py` / FastAPI as
                 the live server; it names `apps/api` + `quant-engine`; a grep for
                 `main.py` in that section is 0; frontend half remains (verified).

Feasibility:     pass — live tree is `apps/api/src` + `libs/quant-engine`. Do **not**
                 bundle a product feature. Own reviewable diff. May split §2 so each
                 shard is ≤150 lines (`project-context-shard-sizes` pairing, in-scope
                 for this repair).

Effort:          S–M

Invariant watch: `cited-code-is-verified-not-assumed` (**HARD**) · do not reopen math
                 in §3 · `operator-vs-trader-path-separation` in the map ·
                 `no-real-order-path` · `single-ticker-on-demand` narrowed form

Context tags:    architecture,backend

Source:          Owner 2026-08-20 after keep-paid-books builds drained. BACKLOG §B
                 Value H. Culled from every product BRIEF since 2026-08-14.

Considered:      project-context-s2-is-python-era (CHOSEN) ·
                 vol-normalized-gex (culled this gate: owner picked canon) ·
                 ci-standing-red (culled: hygiene) ·
                 commit-uncommitted-ships (culled: deploy is owner push) ·
                 ai-rec-lab-p4 (blocked-on session-corpus-wait)
