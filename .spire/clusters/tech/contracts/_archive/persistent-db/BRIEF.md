# persistent-db — brief

Goal:            Replace the **in-memory SQLite** auth stores with a **persistent Postgres** store behind
                 the existing ports (`UserStore` / `SessionStore` / `UserSettingsStore` /
                 `UserCredentialStore` in `apps/api/src/auth/`), so **accounts, sessions, per-user settings,
                 and encrypted AI keys survive container restarts and are shared across replicas** — the
                 must-do-before-deploy persistence step. Add the Postgres adapter as **another adapter
                 selected by the existing env factory** (`ACCOUNT_STORE=postgres` + a `DATABASE_URL`), keeping
                 the **in-memory adapter as the default** for local/keyless/test runs. Define the **schema +
                 a migration path**. Document that the **encryption + session-signing keys must be STABLE**
                 in this mode (`AI_KEY_ENCRYPTION_KEY`, `AUTH_SESSION_SIGNING_KEY`) — else the now-durable
                 encrypted keys/cookies become unreadable after a deploy.

Decision impact: **N/A** (deploy-readiness / infra — trading-decision cull N/A). Turns the prototype into a
                 real multi-user-capable backend; the hard prerequisite for `deploy`. Observable: create an
                 account / save settings / save an AI key → **restart the backend → they're still there**;
                 and two backend instances share one store.

Feasibility:    pass to **BUILD**; **runtime-verify needs a Postgres instance** (a local Docker Postgres or a
                 managed one) which the dev box does not have → the adapter + migrations are written + tested
                 against the port contract, and the full live-DB verification is **deferred** (same pattern
                 as Docker not being installed). The **ports + env-selected factory already exist** (built in
                 `user-accounts` for exactly this swap — provider-pattern), so this is a **contained new
                 adapter + schema/migrations**, not a rewrite. New backend dep: a Postgres driver
                 (psycopg/asyncpg) + optionally a lightweight migration tool (Architect picks; raw-SQL to
                 match the existing `sqlite_store.py` style is viable). **No data migration of existing
                 durable data** — the in-memory store has none (it is empty each boot); fresh schema.

Effort:          L

Invariant watch: `[additive-keeps-score-byte-identical]` — the DB swap is **storage-only**; the trading/
                 bundle/SSE path stays stateless + untouched, the auth stores stay a one-way leaf the scoring
                 path never imports; score/tier/`state_fingerprint` byte-identical.
                 `[best-effort-isolated-or-null]` (auth carve-out) — a **DB outage** must degrade the **auth
                 subsystem** (sign-in/credential reads fail to their auth error class / treat-as-anonymous on
                 the trader path), and **must NOT take down the anonymous bundle/SSE path** (which never
                 touches the DB). The Architect specifies the fail mode (fail-closed for auth; trader path
                 unaffected).
                 `[secret-encrypted-at-rest]` — the per-user AI keys move into Postgres **still as ciphertext**
                 (encryption happens in the crypto leaf BEFORE storage; the DB only ever sees ciphertext + the
                 masked hint); the encryption key stays server-side env, never in the DB.
                 `[no-secrets-in-image]` — the `DATABASE_URL` / DB credentials are injected at **runtime via
                 env**, never baked into an image or committed.
                 `[server-side-gate-enforcement]` — unaffected (gating stays server-side; only the store
                 backend changes).

Context tags:    architecture,backend,api,conventions,decisions

Entry point:     architect-first — pivotal calls: the **Postgres adapter shape** (raw SQL mirroring
                 `sqlite_store.py` vs SQLAlchemy/ORM; **async vs sync** given FastAPI runs compute in
                 `to_thread` — match the existing concurrency model), **connection pooling**, the **schema**
                 for the 4 record types + the **migration approach** (how the schema is created/versioned),
                 the **env-factory extension** (`ACCOUNT_STORE=postgres` + `DATABASE_URL`, in-memory stays
                 default), the **DB-outage fail mode** (auth fails closed / trader path stays up — the
                 best-effort carve-out), **transaction/concurrency** for the per-admin metering counters and
                 the session lifecycle, and keeping the **ciphertext-only** boundary for AI keys. Non-goals:
                 no host/provider pick (any Postgres via `DATABASE_URL`), no deploy, no CI, no change to the
                 in-memory adapter's behavior, no app/scoring change.

Source:          Owner 2026-06-29 — next in the infra/deploy program after `containerize-apps`; the
                 persistence swap that makes the in-memory prototype deploy-ready (the §4 "externalize your
                 state" lesson). Followed by `deploy` (host pick) → Security/red-team (system-6) at go-live.
