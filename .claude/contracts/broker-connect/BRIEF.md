# broker-connect — brief
Goal:            Convexa reads the owner's REAL brokerage positions, read-only, into the Positions
                 page's Live tab — behind a **`PositionsProvider` port** (mirroring the market-data
                 provider port). Adapter #1: **Webull-direct via the owner's own Individual OpenAPI
                 keys** (BYO-credential, the byo-ai-key precedent; free; positions endpoints +
                 official Python SDK). **SnapTrade** is the NAMED later adapter for external users
                 (OAuth, multi-broker, ~$1–2/user/mo) — designed-for, not built now. Real positions
                 flow into the existing leg-first book model (`positions-legs` was sequenced ahead of
                 this exactly so the importer never meets a model that can't represent what it
                 imports) and the reassessment/AI read can finally see the risk actually carried.
                 READ-ONLY is absolute: no order, no execution, no write of any kind to the broker.
Decision impact: Hold/trim/exit/roll decisions run against the REAL book instead of a hand-mirrored
                 sim copy. Observed: the Live tab shows the owner's actual Webull positions with an
                 honest as-of stamp; a reassessment request references a real holding; the outcome
                 ledger's inputs stop depending on manual mirroring fidelity (N2 friction drops).
Feasibility:     pass for DESIGN now; runtime verification blocked-on the owner's Webull Individual
                 API approval (~1–2 business days, application submitted by owner). The council must
                 treat the options/multi-leg payload shape as an OPEN QUESTION until real payloads
                 exist — the architect designs the port against a to-be-verified adapter contract,
                 and the build lane's first task is a payload capture against the live account.
Effort:          L
Invariant watch: `no-real-order-path` (READ-ONLY realizes the long-planned narrowing "read real
                 positions OK, no real order execution" — formalize at this GATE S as BACKLOG
                 2026-06-24 anticipated) · **system-6 Security/red-team FIRES HERE** (first
                 real-account connection — the standing trigger; council must scope it: threat
                 model, credential lifecycle, token storage, egress) · `secret-encrypted-at-rest`
                 (the Webull App Key/Secret: Fernet ciphertext-only via the UserCredentialStore
                 pattern, never logged/returned/browser-sent, masked hint + rotate/delete) ·
                 `server-side-gate-enforcement` (broker surfaces are signed-in + server-gated) ·
                 `best-effort-isolated-or-null` (broker outage/limits degrade the Live tab ONLY —
                 bundle/SSE/sim book untouched; broker code is a one-way leaf off the trading path) ·
                 `live-vs-static-isolation` + `model-read-carries-its-assumptions` (imported
                 positions carry their as-of/refresh basis visibly — never presented as live if
                 polled) · `absent-is-not-none` (unknown-book vs confirmed-empty-book are distinct
                 states on the wire and in the UI) · `loss-free-durable-migration` (BrokerPosition
                 is a NEW type beside the sim book — `PositionView` is the seam per OPEN_THREADS
                 §7x; if any durable shape moves, the chain composes) · `single-shared-sim-entry-
                 dialog` narrowing (no entry surface here at all; any future real-money surface is
                 structurally separate) · `additive-keeps-score-byte-identical` (real positions are
                 NEVER a scoring input; score/tier/fingerprint byte-identical with and without a
                 connected broker).
Context tags:    architecture,backend,frontend,features,decisions,personas
Source:          Roadmap X1 (`docs/ROADMAP_2026-08.md`, owner-adopted 2026-08-01) · BACKLOG queue #2
                 (corrected 2026-08-01: Webull-direct self-use viable; SnapTrade = external-users
                 adapter) · OPEN_THREADS §7x deferred seams (BrokerPosition/PositionView) · the
                 2026-06-24 OWNER PIVOT Track B (this IS that track, finally unblocked).
