# iv-rank — brief

Goal:            Surface **IV Rank / IV Percentile** — where the ticker's current implied volatility
                 sits within its own recent history — as **AI-context + a Ticker display**, so the
                 AI (and the trader) can judge whether option premium is **rich or cheap** and pick
                 strategy accordingly (buy vs sell premium). THE options metric the app currently
                 lacks. Rides `market_state` as an additive nullable read; **never a scoring input**.
                 Because the vendor provides **no historical IV**, this feature must **accumulate**
                 a daily IV sample into a persistent store and compute rank/percentile over the
                 accumulated window — with an honest **"building history / insufficient history"**
                 state until enough days exist.

Decision impact: **Strategy selection** — is implied vol rich (favor defined-risk/selling premium)
                 or cheap (favor buying premium / long options)? Observed: the AI rec cites
                 "IV rank 82 — premium rich, lean debit spreads over long calls"; an IV-rank
                 readout renders on the ticker page with its window + sample size.

Feasibility:     **PARTIAL — architect-gated (the reason this is architect-first).** Confirmed via the
                 2026-07-06 market-backdrop vendor probe: the Massive account reads **current** option
                 snapshots (we already compute `atm_iv`) but provides **no historical IV series** and
                 **no index data** (VIX NOT_AUTHORIZED) — so IV Rank's 52-week form is **blocked-on
                 accumulation**, confirming the standing "blocked-on IV-history" note. The architect
                 MUST resolve, in order:
                 1. **What IV to sample** — the existing nearest-≥7-DTE `atm_iv`, or a more robust
                    constant-maturity (~30-day interpolated) IV. (Rank stability vs simplicity.)
                 2. **The accumulation mechanism** — WHO writes one IV sample per ticker per session
                    and WHEN (write-through on bundle serve w/ a once-per-session guard? a scheduled
                    job? backfill impossible — vendor has no history, so it starts empty and grows).
                 3. **Storage** — a NEW **market-data time-series** store/port (NOT the `src/auth/`
                    leaf), mirroring the `ACCOUNT_STORE`/provider-port pattern: an in-memory or
                    SQLite/file default for local/dev + **Postgres** (the shipped `persistent-db`)
                    for prod. **Constraint:** the dev box has **no local Postgres** (persistent-db
                    runtime-verify was deferred for exactly this) → design must build + verify with
                    the non-Postgres default; Postgres is the prod adapter behind the same port.
                 4. **Rank vs Percentile definitions** + the window (e.g. rolling 252-session / "since
                    inception until 252") and the **minimum-sample** floor below which it reads
                    "building history," never a misleading rank off 3 days.

Effort:          M–L (a new persistent time-series store + accumulation seam + the rank math + FE
                 read; the store/port is the bulk).

Invariant watch: `additive-keeps-score-byte-identical` (HARD — AI-context/display only; `signals.py`
                 untouched; the IV store never feeds score/tier/fingerprint) ·
                 `best-effort-isolated-or-null` (store outage / insufficient history / write failure →
                 null or "building" state, never an HTTP error; a write is best-effort + must never
                 perturb the bundle) · `live-vs-static-isolation` (IV rank is a STATIC daily read —
                 un-dimmed on an SSE drop; nothing on SSE) · `theme-token-discipline` ·
                 **`model-read-carries-its-assumptions`** (now PROMOTED canon — the rank carries its
                 window / sample-size / IV-basis visibly; "N sessions of history," never a bare number
                 implying more history than exists) · `digested-labels-not-raw-dump` (if a rich/cheap
                 band label is surfaced, it's a small digested band, not a raw series) ·
                 `secret-encrypted-at-rest` NOT touched (IV samples are non-secret market data).
                 **New property to note (not a violation):** this is the project's **first persistent
                 MARKET-DATA store** (distinct from the auth state store) — the architect should state
                 how it relates to the "trading/bundle path stays stateless" narrowing (a best-effort
                 side-store read/write around the stateless compute, like the chain-store pre-warm).

Context tags:    architecture,backend,data,math,decisions,features

Entry point:     architect-first — the accumulation mechanism + the new persistent time-series store
                 + the no-local-Postgres constraint + the rank/percentile/window definitions dominate;
                 all must be shaped before any product/UX layer.

Source:          The 2026-07-02 "enrich the downstream-AI's inputs" pool **runner-up** (owner
                 co-favourite); owner pick 2026-07-06 (b), after the market-backdrop index feed
                 verified NOT_AUTHORIZED (parked as blocked-on a plan upgrade / reshape available).
