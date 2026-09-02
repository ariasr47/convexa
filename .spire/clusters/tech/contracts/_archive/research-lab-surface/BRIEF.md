# research-lab-surface — brief
Goal:            Give the operator a **URL-only, off-shell** surface that **lists and
                 loads already-kept research corpus** (session books as the spine;
                 coverage / day-tape / flat-file extracts as sibling reads the
                 council may admit) using the **existing** `/api/_research/*`
                 list/load endpoints — so the $398 corpus is usable weekly without
                 a CLI binge. **Not** the public `/lab` instrument-demo hub.
                 **Not** a trader nav item. **Not** a Pages proxy of `_research`.
                 **Not** a score-lab HTTP/UI, **not** a second ticker replay
                 player, **not** a morning-note product. Occupancy words stay
                 the vehicles’ closed decks (`present` still means loadable
                 `LiveMassive` only; extracts stay `kept`). `Authorizes: nothing`.

Decision impact: Whether the operator **uses the paid corpus weekly** instead of
                 only during a CLI research binge. Observed by: from a dedicated
                 operator URL (pattern of `/_ops/metrics` — own chrome, unlinked
                 from trader nav, not inside AppShell), with the metrics token
                 (not a trader session cookie), list SPY session books and open
                 one dated book without starting Massive; a trader-origin
                 `*.pages.dev` request to `/api/_research/...` still 404s; TopNav
                 still has no operator entry; `/lab` still means instrument demos.

Feasibility:     pass — code-grounded 2026-08-31: Pages Function
                 `functions/api/[[path]].ts` 404s `/api/_metrics` and the entire
                 `/api/_research/` prefix (not proxied). Live research HTTP
                 already exists and is token-gated: `research_session_books.rs`
                 list/load, `research_session_coverage.rs`,
                 `research_session_day_tape.rs` list/load,
                 `research_chain_snapshots.rs`, `research_flat_files.rs`
                 list/load. Operator UI pattern: `app.tsx` mounts
                 `/_ops/metrics` **FIRST**, **outside** `<AppShell/>`, unlinked
                 (`TopNav.tsx` “Deliberately NO operator entry”). **Do not occupy
                 `/lab`:** `LabIndex.tsx` is a public in-shell hub for Canvas /
                 WebGL **instrument demos** with synthetic data
                 (`data-testid="lab-index"`). Generated
                 `libs/api/src/generated/schema.ts` already lists session-books
                 paths; product `convexa.ts` is guarded by structural specs
                 **not** to grow a trader `_research` helper — a lab client, if
                 any, must not leak onto trader routes. Score-lab remains clap
                 `score-lab` in `main.rs` (no HTTP). Replay remains process-start
                 `session-day-replay` on the existing ticker SSE. Council locks
                 v1 vehicle set (books-only vs books+coverage vs also tape /
                 snapshots / flat-files), route name (`/_ops/...` vs other
                 unlinked operator path — **not** `/lab`), token UX, and
                 NO_BACKEND_CHANGE vs a thin adapter.

Effort:          M

Invariant watch: `operator-vs-trader-path-separation` (**HARD** — own route,
                 unlinked, off shell, read-only, no vendor fetch / recompute /
                 cache mutation / trader-route call; Pages `_research` 404
                 stands) ·
                 `present-is-live-paid-only` (UI must not label extracts / tape /
                 fixtures as live paid `present`) ·
                 `server-side-gate-enforcement` (metrics token is the gate;
                 trader cookie is not) ·
                 `additive-keeps-score-byte-identical` (`Authorizes: nothing`) ·
                 `local-evidence-is-not-hosted-evidence` (local list is not
                 hosted/CI coverage) ·
                 `no-secrets-in-image` (token never logged / never in copy) ·
                 `absent-is-not-none` (closed occupancy decks to the screen) ·
                 `structural-over-prose-enforcement` ·
                 `cited-code-is-verified-not-assumed` ·
                 `single-motion-moment` ·
                 `theme-token-discipline` ·
                 `digested-labels-not-raw-dump` (no raw chain dump)

Context tags:    architecture,frontend,backend,observability,invariants,design,personas

Source:          harvest 2026-08-28 remaining survivor; unnamed `go` after
                 `massive-flat-file-keep` GATE S 2026-08-31 (BACKLOG harvest
                 default).

Considered:      research-lab-surface (CHOSEN — harvest default after keep
                 shipped; decision-impact: weekly use of paid corpus; first
                 slice is operator corpus browser of existing `_research`
                 list/load, not `/lab` demos, not score-lab HTTP, not replay
                 chrome) ·
                 remote-archive-body-store (culled: production-maturity #6 next
                 *in that program*; insurance for bodies, not a trading
                 decision; unnamed `go` is harvest pick-next) ·
                 grounded-morning-snapshot (culled: sequence after the corpus
                 is visible; every figure must trace; no Benzinga) ·
                 supply-chain-automation (blocked-on: historical secret,
                 RUSTSEC-2024-0436, hosted evidence; do not reopen) ·
                 session-corpus-wait (not a build — keep-paid-books #5 clock
                 from 2026-08-26; time-split ~2026-09-23 … 2026-10-07) ·
                 ai-rec-lab-p4 (blocked-on #5 clock + boring P2–P3) ·
                 telemetry-slos (parked — production-maturity #7 after #6) ·
                 replica-safe-workers (parked — #8) ·
                 SnapTrade readonly (parked — explicit product go, not this
                 drain; broker v1 is Webull) ·
                 project-context-shard-sizes (parked — canon hygiene; does not
                 steal the harvest slot) ·
                 complete-missing-names-after-keep-skip (Future of last ship;
                 not this surface) ·
                 OPRA/aggregates/indices/crypto files (out — last ship) ·
                 squeeze/Benzinga/news/RL/hist-chain/public-SaaS (parked by
                 2026-08-28 harvest) ·
                 horizontal-scale Redis/SSE-fan-out (premature — trigger is a
                 second replica) ·
                 Kubernetes/Kafka/mesh/GraphQL/microservices (culled — program
                 forbids without a measured bottleneck + owner letter).
